// Verrou CONSULTATIF entre processus de la machine (#1679 L1c-M7, #2279 N0, #2187, #2603) : un fichier pris
// par `linkSync` exclusif, qui porte son tenant dès qu'il existe :
//   `{ pid, commande, cwd, date, generation, creation? }`
// `generation` (randomUUID) nomme LA prise ; `creation` (`performance.timeOrigin` du preneur, ms epoch)
// n'est écrit que sous l'option `identite`. Il refuse le second preneur en NOMMANT le premier, ou le fait
// attendre sous une échéance ; il ne tue personne.
import { randomUUID } from 'node:crypto'
import fsReel from 'node:fs'
import { basename, dirname } from 'node:path'
import { creationMemorisee, estPidVivant, estPidVivantDepuis } from '../guards/lib/pid.mjs'
import { attendreSync } from '../guards/lib/spawnResilient.mjs'

/** Préfixe des jetons de verrou d'environnement (#2603) : `lancerDetache` n'en transmet aucun. */
export const PREFIXE_JETON_VERROU = 'WFRP_VERROU_'

/** Message de refus : ce que le verrou garde (`libelle`), qui le tient, et les deux sorties. */
export function refusVerrou({ chemin, tenant, libelle }) {
  return [
    `[verrou] ${libelle} : tenu par le PID ${tenant.pid}`,
    `[verrou] commande : ${tenant.commande ?? '(inconnue)'}`,
    `[verrou] arbre : ${tenant.cwd ?? '(inconnu)'}${tenant.date ? ` · depuis ${tenant.date}` : ''}`,
    `[verrou] attendre la fin, ou tuer ce PID — verrou : ${chemin}`,
  ].join('\n')
}

/** Le tenant `tenant` en UNE ligne (l'annonce d'une attente) : PID, commande, arbre, depuis. */
export const tenantEnUneLigne = (tenant) =>
  `PID ${tenant?.pid ?? '?'} · ${tenant?.commande || '(commande inconnue)'} · arbre ${tenant?.cwd || '(inconnu)'} · depuis ${tenant?.date ?? '(inconnu)'}`

/**
 * @typedef {{ pid: number, commande?: string, cwd?: string, date?: string, generation?: string, creation?: number }} Tenant
 * @typedef {{ echeanceMs: number, pasMs: number, parTenant?: boolean, annoncer?: (tenant: Tenant | null) => void }} Attente
 * @typedef {{ lireCreation: (pid: number) => number | null, toleranceMs: number, pasMs: number }} Identite
 * @typedef {{ chemin: string, libelle: string, pid?: number, commande?: string, cwd?: string,
 *   fs?: typeof fsReel, estVivant?: (pid: number) => boolean, maintenant?: () => string,
 *   attente?: Attente, horloge?: () => number, identite?: Identite }} Prise
 */

/**
 * PREND le verrou `chemin`. REND `{ etat: 'pris', liberer }` ou `{ etat: 'refus', message, tenant? }`.
 * Sans `attente`, un seul essai. Avec `attente`, un refus se rejoue tous les `pasMs` après
 * `annoncer(tenant)`, jusqu'à `echeanceMs` : à échéance, le dernier refus — jamais d'exception, jamais
 * d'attente sans fin. `parTenant` remet l'échéance à zéro à chaque changement de tenant. Un verrou
 * laissé par un PID MORT, ou illisible, est REPRIS sous le verrou de reprise `<chemin>.reprise`
 * (`reprendre`). `liberer` ne retire que le verrou qui porte encore la `generation` de la prise.
 * `identite` : le tenant porte `creation`, et un PID vivant dont `lireCreation` rend une date postérieure à
 * `creation + toleranceMs` est un PID RÉUTILISÉ, donc mort ; `null` (indéterminé) vaut vivant. Lu une fois
 * par texte de verrou distinct, puis tous les `pasMs`. Refusée hors du processus courant.
 * `fs`, `estVivant`, `maintenant`, `dormir` et `horloge` s'injectent (mesure). Sommeil BLOQUANT
 * (`attendreSync`) : un appelant qui garde une boucle d'événements vivante prend `prendreVerrouAsync`.
 * `dormir` rythme aussi le rejeu de `liberer` ; `liberer` étant synchrone, la forme async y garde `attendreSync`.
 * @param {Prise & { dormir?: (ms: number) => void }} p
 */
export function prendreVerrou({ dormir = attendreSync, ...prise }) {
  return derouler(etapesDePrise({ ...prise, dormir }), dormir)
}

/** Le sommeil NON bloquant : une promesse résolue après `ms`. */
const dormirAsync = (ms) => new Promise((fini) => setTimeout(fini, ms))

/** `prendreVerrou`, au sommeil NON bloquant (`dormir` rend une promesse). */
export function prendreVerrouAsync({ dormir = dormirAsync, ...prise }) {
  return deroulerAsync(etapesDePrise(prise), dormir)
}

/**
 * Rejoue `essai` jusqu'à `abouti` ou l'échéance de `attente` (`sousEcheance`), au sommeil NON bloquant :
 * REND le dernier essai. `annoncer(tenant)` de `attente` suit chaque refus, `tenant` lu sur l'essai.
 * @template T
 * @param {{ attente: Attente, horloge?: () => number, essai: () => T, abouti: (vu: T) => boolean, dormir?: (ms: number) => Promise<void> }} p
 * @returns {Promise<T>}
 */
export function sousEcheanceAsync({ attente, horloge = Date.now, essai, abouti, dormir = dormirAsync }) {
  return deroulerAsync(sousEcheance({ attente, horloge, essai, abouti }), dormir)
}

/**
 * ATTEND que le verrou `chemin` soit libre, sans le PRENDRE. REND `{ etat: 'libre' }` (absent, illisible,
 * ou tenu par un PID mort) ou, à `echeanceMs`, `{ etat: 'occupe', tenant }`. Même pas, même annonce que
 * `prendreVerrou`.
 * @param {{ chemin: string, attente?: Attente, fs?: typeof fsReel, estVivant?: (pid: number) => boolean,
 *   dormir?: (ms: number) => void, horloge?: () => number }} p
 */
export function attendreLibre({ chemin, attente, fs = fsReel, estVivant = estPidVivant, dormir = attendreSync, horloge = Date.now }) {
  const essai = () => {
    const tenant = tenantDuTexte(lireBrut(fs, chemin))
    return tenant && estVivant(tenant.pid) ? { etat: 'occupe', tenant } : { etat: 'libre' }
  }
  return derouler(sousEcheance({ attente, horloge, essai, abouti: (vu) => vu.etat === 'libre' }), dormir)
}

/** Les étapes d'une prise sous échéance (`sousEcheance`). */
function etapesDePrise({
  chemin,
  libelle,
  pid = process.pid,
  commande = '',
  cwd = '',
  fs = fsReel,
  estVivant = estPidVivant,
  maintenant = () => new Date().toISOString(),
  attente,
  horloge = Date.now,
  identite,
  dormir = attendreSync,
}) {
  if (identite && pid !== process.pid) {
    throw new Error(`[verrou] ${libelle} : l'identité ne se prend qu'au PID courant (${process.pid}), pas au PID ${pid}`)
  }
  const creation = identite ? performance.timeOrigin : undefined
  const vivant = vivantSelon({ estVivant, identite, horloge })
  return sousEcheance({
    attente, horloge,
    essai: () => prendreUneFois({ chemin, libelle, pid, commande, cwd, fs, vivant, maintenant, creation, dormir }),
    abouti: (vu) => vu.etat === 'pris',
  })
}

/**
 * Le juge de vie d'un tenant, `(tenant, brut) => boolean` : `estVivant(pid)`, puis, sous `identite`, sa
 * `creation` confrontée à la date que `lireCreation` mesure, une fois par texte `brut`, puis tous les `pasMs`.
 * @param {{ estVivant: (pid: number) => boolean, identite?: Identite, horloge: () => number }} p
 */
function vivantSelon({ estVivant, identite, horloge }) {
  if (!identite) return (/** @type {Tenant} */ tenant) => estVivant(tenant.pid)
  const lire = creationMemorisee(identite.lireCreation, { pasMs: identite.pasMs, horloge })
  return (/** @type {Tenant} */ tenant, /** @type {string | undefined} */ brut) => estPidVivantDepuis(tenant.pid, tenant.creation, {
    toleranceMs: identite.toleranceMs,
    lireCreation: (pid) => lire(pid, brut),
  }, { estVivant })
}

/** La clé du tenant d'un essai : sa `generation`, à défaut son texte. */
const cleDuTenant = (tenant) => (tenant ? (tenant.generation ?? JSON.stringify(tenant)) : null)

/** Rejoue `essai` jusqu'à `abouti` ou l'échéance de `attente` : CÈDE chaque sommeil, REND le dernier essai. */
function* sousEcheance({ attente, horloge, essai, abouti }) {
  let debut = horloge()
  let tenant
  for (;;) {
    const vu = essai()
    if (attente?.parTenant) {
      const cle = cleDuTenant(vu.tenant)
      if (tenant !== undefined && cle !== tenant) debut = horloge()
      tenant = cle
    }
    const reste = attente ? attente.echeanceMs - (horloge() - debut) : 0
    if (abouti(vu) || reste <= 0) return vu
    attente.annoncer?.(vu.tenant ?? null)
    yield Math.min(attente.pasMs, reste)
  }
}

/** Joue les étapes, chaque sommeil par `dormir` (bloquant). */
function derouler(etapes, dormir) {
  for (let pas = etapes.next(); ; pas = etapes.next()) {
    if (pas.done) return pas.value
    dormir(pas.value)
  }
}

/** Joue les étapes, chaque sommeil attendu (`await dormir`). */
async function deroulerAsync(etapes, dormir) {
  for (let pas = etapes.next(); ; pas = etapes.next()) {
    if (pas.done) return pas.value
    await dormir(pas.value)
  }
}

/** Un essai de prise : le dossier de `chemin` créé, le tenant écrit dans un temporaire voisin, puis lié à `chemin`. */
function prendreUneFois({ chemin, libelle, pid, commande, cwd, fs, vivant, maintenant, creation, dormir }) {
  fs.mkdirSync(dirname(chemin), { recursive: true })
  const generation = randomUUID()
  const texte = JSON.stringify({ pid, commande, cwd, date: maintenant(), generation, ...(creation === undefined ? {} : { creation }) })
  const temporaire = `${chemin}.${pid}.${generation}`
  fs.writeFileSync(temporaire, texte, { flag: 'wx' })
  try {
    return prendreDepuis({ chemin, libelle, temporaire, fs, vivant, liberer: () => liberer({ chemin, texte, pid, generation, fs, vivant, dormir }) })
  } finally {
    fs.rmSync(temporaire, { force: true })
  }
}

/** Le corps de `prendreUneFois`, le tenant déjà écrit dans `temporaire`. */
function prendreDepuis({ chemin, libelle, temporaire, fs, vivant, liberer }) {
  for (let essai = 0; essai < 3; essai += 1) {
    try {
      fs.linkSync(temporaire, chemin)
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      const brut = lireBrut(fs, chemin)
      if (brut === undefined) continue
      const tenant = tenantDuTexte(brut)
      if (tenant && vivant(tenant, brut)) {
        return { etat: 'refus', message: refusVerrou({ chemin, tenant, libelle }), tenant }
      }
      reprendre({ chemin, mort: brut, temporaire, fs, vivant })
      continue
    }
    return { etat: 'pris', liberer }
  }
  return {
    etat: 'refus',
    message: `[verrou] ${libelle} : verrou disputé (${chemin}), un autre preneur le reprend en boucle — relancer.`,
  }
}

/** Essais et pas de `liberer` quand un vivant tient le verrou de reprise : le temps d'une reprise. */
const ESSAIS_DE_LIBERATION = 40
const PAS_DE_LIBERATION_MS = 25

/**
 * Retire `chemin` s'il porte encore la `generation` de la prise, sous le verrou de reprise `<chemin>.reprise`
 * (pris par `linkSync` d'un temporaire au `texte` du tenant). Un verrou de reprise tenu par un vivant est
 * rejoué `ESSAIS_DE_LIBERATION` fois, au sommeil `dormir`, puis LÈVE ; une erreur autre qu'ENOENT se propage.
 * Un dossier du verrou disparu (ENOENT à l'écriture du temporaire) vaut verrou absent : rien à libérer.
 */
function liberer({ chemin, texte, pid, generation, fs, vivant, dormir }) {
  const reprise = `${chemin}.reprise`
  const temporaire = `${chemin}.${pid}.${randomUUID()}`
  try {
    fs.writeFileSync(temporaire, texte, { flag: 'wx' })
  } catch (e) {
    if (e.code === 'ENOENT') return
    throw e
  }
  try {
    for (let essai = 0; essai < ESSAIS_DE_LIBERATION; essai += 1) {
      try {
        fs.linkSync(temporaire, reprise)
      } catch (e) {
        if (e.code !== 'EEXIST') throw e
        retirerRepriseMorte({ reprise, fs, vivant })
        dormir(PAS_DE_LIBERATION_MS)
        continue
      }
      try {
        if (tenantDuTexte(lireOuAbsent(fs, chemin))?.generation === generation) fs.rmSync(chemin, { force: true })
      } finally {
        fs.rmSync(reprise, { force: true })
      }
      return
    }
    throw new Error(`[verrou] ${chemin} : non libéré, le verrou de reprise ${reprise} reste tenu par un vivant`)
  } finally {
    fs.rmSync(temporaire, { force: true })
  }
}

/**
 * Retire le verrou `chemin` s'il porte encore le texte `mort`, sous le verrou de reprise `<chemin>.reprise`
 * pris par `linkSync` de `temporaire` : deux repreneurs ne retirent jamais le verrou que l'un d'eux vient
 * de prendre. Un verrou de reprise tenu par un MORT est retiré (`retirerRepriseMorte`) ; tenu par un
 * vivant, rien n'est fait.
 */
function reprendre({ chemin, mort, temporaire, fs, vivant }) {
  const reprise = `${chemin}.reprise`
  try {
    fs.linkSync(temporaire, reprise)
  } catch (e) {
    if (e.code !== 'EEXIST') throw e
    retirerRepriseMorte({ reprise, fs, vivant })
    return
  }
  try {
    if (lireBrut(fs, chemin) === mort) fs.rmSync(chemin, { force: true })
  } finally {
    fs.rmSync(reprise, { force: true })
  }
}

/** Retire le verrou de reprise `reprise` tenu par un MORT, si son texte relu est encore celui jugé mort. */
function retirerRepriseMorte({ reprise, fs, vivant }) {
  const brut = lireBrut(fs, reprise)
  const tenant = tenantDuTexte(brut)
  if (tenant && !vivant(tenant, brut) && lireBrut(fs, reprise) === brut) fs.rmSync(reprise, { force: true })
}

/** Le texte du verrou, ou `undefined` s'il est absent ou inaccessible à la lecture. */
function lireBrut(fs, chemin) {
  try {
    return fs.readFileSync(chemin, 'utf8')
  } catch {
    return undefined
  }
}

/** Le texte du verrou, ou `undefined` s'il est absent ; toute autre erreur se propage. */
function lireOuAbsent(fs, chemin) {
  try {
    return fs.readFileSync(chemin, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return undefined
    throw e
  }
}

/** Le tenant que porte le texte `brut`, ou `null` s'il est absent, illisible ou sans PID exploitable. */
function tenantDuTexte(brut) {
  try {
    const lu = JSON.parse(brut ?? '')
    return Number.isInteger(lu?.pid) ? lu : null
  } catch {
    return null
  }
}

/** Le tenant que porte le verrou `chemin`, `null` s'il est absent, illisible ou sans PID. @param {string} chemin */
export const tenantDe = (chemin) => tenantDuTexte(lireBrut(fsReel, chemin))

/** L'âge (s) d'un tenant à l'`horloge`, `null` sans date lisible. PURE. */
export const ageDe = (tenant, horloge) => {
  const date = Date.parse(tenant?.date ?? '')
  return Number.isFinite(date) ? Math.round((horloge() - date) / 1000) : null
}

/**
 * Le `estVivant` d'une prise du verrou `chemin` : `estVivant(pid)`, et le tenant `pid` relu n'a pas dépassé
 * `borneMs` d'âge.
 * @param {string} chemin @param {number} borneMs @param {(pid: number) => boolean} estVivant @param {() => number} horloge
 */
export const vivantSousBorne = (chemin, borneMs, estVivant, horloge) => (/** @type {number} */ pid) => {
  if (!estVivant(pid)) return false
  const tenant = tenantDe(chemin)
  const age = tenant?.pid === pid ? ageDe(tenant, horloge) : null
  return age === null || age * 1000 <= borneMs
}

/** La date de modification ISO du fichier `chemin`, `null` s'il manque. @param {string} chemin */
export function mtimeDe(chemin) {
  try {
    return fsReel.statSync(chemin).mtime.toISOString()
  } catch {
    return null
  }
}

/** @typedef {{ verrou: string, pid: number, depuis: string | null, preuve: 'jeton du journal' | 'PID mort' | 'âge > borne' }} Orphelin */

/**
 * Le `estVivant` d'une prise du verrou `chemin` (`vivantSousBorne`, sans borne si `borneMs` est `null`) qui
 * CONSIGNE dans `orphelins` (clé `chemin`) son tenant jugé absent (#2493) : `PID mort`, ou `âge > borne`.
 * @param {string} chemin @param {number | null} borneMs @param {(pid: number) => boolean} estVivant @param {() => number} horloge
 * @param {Map<string, Orphelin>} orphelins
 */
export const consignant = (chemin, borneMs, estVivant, horloge, orphelins) => (/** @type {number} */ pid) => {
  const tenant = tenantDe(chemin)
  const vivant = borneMs === null ? estVivant(pid) : vivantSousBorne(chemin, borneMs, estVivant, horloge)(pid)
  if (!vivant && tenant?.pid === pid) {
    orphelins.set(chemin, { verrou: chemin, pid, depuis: tenant.date ?? mtimeDe(chemin), preuve: estVivant(pid) ? 'âge > borne' : 'PID mort' })
  }
  return vivant
}

/** Les orphelins `orphelins` nommés : `<nom> (PID p mort depuis d, preuve)`, joints par `, `. PURE. @param {Orphelin[]} orphelins */
export const nomDesOrphelins = (orphelins) => orphelins
  .map((o) => `${basename(o.verrou)} (PID ${o.pid}${o.preuve === 'âge > borne' ? '' : ' mort'} depuis ${o.depuis ?? '?'}, ${o.preuve})`).join(', ')
