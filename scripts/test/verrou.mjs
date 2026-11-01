// Verrou CONSULTATIF entre processus de la machine (#1679 L1c-M7, #2279 N0, #2187, #2603) : un fichier pris
// par `linkSync` exclusif, qui porte son tenant dès qu'il existe :
//   `{ pid, commande, cwd, date, generation, creation? }`
// `generation` (randomUUID) nomme LA prise ; `creation` (ms epoch) : `performance.timeOrigin` au PID courant,
// la mesure de l'`identite` à un PID tiers, absente si elle est indéterminée. Il refuse le second preneur en NOMMANT le premier, ou le fait
// attendre sous une échéance ; il ne tue personne.
import { createHash, randomUUID } from 'node:crypto'
import fsReel from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { NAISSANCE_ABSENTE, creationMemorisee, estPidVivant, estPidVivantDepuis } from '../guards/lib/pid.mjs'
import { attendreSync } from '../guards/lib/spawnResilient.mjs'
import { IDENTITE_MESUREE } from './identiteMesuree.mjs'

/** Préfixe des jetons de verrou d'environnement (#2603) : `lancerDetache` n'en transmet aucun. */
export const PREFIXE_JETON_VERROU = 'WFRP_VERROU_'
const instanceDuVerrou = (chemin) => process.platform === 'win32' ? resolve(chemin).toLowerCase() : resolve(chemin)
const variableDuVerrou = (chemin) => PREFIXE_JETON_VERROU + createHash('sha256').update(instanceDuVerrou(chemin)).digest('hex')

/** Les jetons `[clé, valeur]` du verrou `chemin` dans `env`, clé comparée sans casse (#2603). PURE.
 *  @param {NodeJS.ProcessEnv} env @param {string} chemin @returns {[string, string | undefined][]} */
export function jetonsDuVerrou(env, chemin) {
  const variable = variableDuVerrou(chemin).toUpperCase()
  return Object.entries(env).filter(([cle]) => cle.toUpperCase() === variable)
}

/** Les clés d'un jeton d'emprunt, triées. */
const CLES_DU_JETON = 'generation,instance,secret,version'

/**
 * Le verdict des `jetons` d'emprunt (`jetonsDuVerrou`) face au `tenant` du verrou d'`instance` (#2603) :
 * `{ ok: true }`, ou `{ raison, cause? }` — `DOUBLON` (plus d'un jeton), `JSON` (illisible, `cause` = l'erreur),
 * `CLES`, `VERSION`, `INSTANCE`, `GENERATION` (pas celle du tenant), `SECRET` (empreinte du tenant non
 * reconnue), `MORT` (tenant jugé mort par `vivant`). PURE hors de `vivant`.
 * @param {[string, string | undefined][]} jetons
 * @param {{ instance: string, tenant: Tenant | null, vivant: (tenant: Tenant) => boolean }} p
 * @returns {{ ok: true } | { raison: 'JSON' | 'DOUBLON' | 'CLES' | 'VERSION' | 'INSTANCE' | 'GENERATION' | 'SECRET' | 'MORT', cause?: unknown }}
 */
export function verdictDuJeton(jetons, { instance, tenant, vivant }) {
  if (jetons.length !== 1) return { raison: 'DOUBLON' }
  let jeton
  try {
    jeton = JSON.parse(jetons[0][1] ?? '')
  } catch (cause) {
    return { raison: 'JSON', cause }
  }
  if (jeton === null || typeof jeton !== 'object' || Object.keys(jeton).sort().join(',') !== CLES_DU_JETON) return { raison: 'CLES' }
  if (jeton.version !== 1) return { raison: 'VERSION' }
  if (jeton.instance !== instance) return { raison: 'INSTANCE' }
  if (!tenant || tenant.generation !== jeton.generation) return { raison: 'GENERATION' }
  if (typeof jeton.secret !== 'string' || tenant.empreinte !== createHash('sha256').update(jeton.secret).digest('hex')) return { raison: 'SECRET' }
  if (!vivant(tenant)) return { raison: 'MORT' }
  return { ok: true }
}

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
 * @typedef {{ pid: number, commande?: string, cwd?: string, date?: string, generation?: string, empreinte?: string, creation?: number }} Tenant
 * @typedef {{ echeanceMs: number, pasMs: number, parTenant?: boolean, plafondMs?: number, annoncer?: (tenant: Tenant | null) => void }} Attente
 * @typedef {{ lireCreation: (pid: number) => number | null, toleranceMs: number, pasMs?: number }} Identite
 * @typedef {{ identite?: Identite, estVivant?: (pid: number) => boolean, horloge?: () => number }} Juge
 * @typedef {{ chemin: string, libelle: string, pid?: number, commande?: string, cwd?: string,
 *   fs?: typeof fsReel, estVivant?: (pid: number) => boolean, maintenant?: () => string,
 *   attente?: Attente, horloge?: () => number, identite?: Identite, env?: NodeJS.ProcessEnv, signal?: AbortSignal,
 *   borneMs?: number | null, orphelins?: Map<string, Orphelin> }} Prise
 */

/**
 * PREND le verrou `chemin`. REND `{ etat: 'pris', liberer }` ou `{ etat: 'refus', message, tenant? }`.
 * Sans `attente`, un seul essai. Avec `attente`, un refus se rejoue tous les `pasMs` après
 * `annoncer(tenant)`, jusqu'à `echeanceMs` : à échéance, le dernier refus, jamais d'exception.
 * `parTenant` remet l'échéance à zéro à chaque changement de tenant : une rotation de tenants l'attend
 * alors sans fin, sauf `plafondMs`, qui borne l'attente totale quel que soit le tenant. Un verrou
 * laissé par un PID MORT, ou illisible, est REPRIS sous le verrou de reprise `<chemin>.reprise`
 * (`reprendre`). `liberer` ne retire que le verrou qui porte encore la `generation` de la prise.
 * `identite` (`IDENTITE_MESUREE` par défaut) : un PID vivant dont `lireCreation` rend une date postérieure à la
 * `creation` du tenant + `toleranceMs` est un PID RÉUTILISÉ, donc mort ; `null` (indéterminé) vaut vivant ; un
 * tenant sans `creation` se juge sur son existence (`naissanceDuTenant`). Lu une fois par texte de verrou
 * distinct, puis tous les `pasMs` (sans `pasMs`, à chaque jugement). `estVivant` est la sonde d'existence de
 * `estPidVivantDepuis`. `borneMs` et `orphelins` : le juge est `consignant` (âge borné, tenant absent consigné).
 * La prise écrit sa `creation` : `performance.timeOrigin` au PID courant, `identite.lireCreation(pid)` à un PID tiers.
 * Un jeton d'emprunt du verrou dans `env` est jugé par `verdictDuJeton` : valide, la prise est empruntée ;
 * invalide, refus DÉFINITIF qui nomme sa raison.
 * `fs`, `estVivant`, `maintenant`, `dormir` et `horloge` s'injectent (mesure). Sommeil BLOQUANT
 * (`attendreSync`) : un appelant qui garde une boucle d'événements vivante prend `prendreVerrouAsync`.
 * `dormir` rythme aussi le rejeu de `liberer` ; `liberer` étant synchrone, la forme async y garde `attendreSync`.
 * @param {Prise & { dormir?: (ms: number) => void }} p
 */
export function prendreVerrou({ dormir = attendreSync, ...prise }) {
  return derouler(etapesDePrise({ ...prise, dormir }), dormir)
}

/** Le sommeil NON bloquant : une promesse résolue après `ms`. */
const dormirAsync = (ms, signal) => new Promise((fini) => {
  const terminer = () => { clearTimeout(minuterie); signal?.removeEventListener('abort', terminer); fini() }
  const minuterie = setTimeout(terminer, ms)
  signal?.addEventListener('abort', terminer, { once: true })
  if (signal?.aborted) terminer()
})

/** Les réveils des attentes async de ce processus, par instance de verrou, que `liberer` appelle (#2586). */
const reveils = new Map()

/** Le sommeil de `dormir` abrégé par une libération de `instance` dans ce processus (`reveils`), ou par `signal`. */
const dormirJusquALiberation = (dormir, instance, signal) => async (ms) => {
  const reveil = new AbortController()
  const abonnes = reveils.get(instance) ?? new Set()
  reveils.set(instance, abonnes)
  const reveiller = () => reveil.abort()
  abonnes.add(reveiller)
  try {
    await dormir(ms, signal ? AbortSignal.any([signal, reveil.signal]) : reveil.signal)
  } finally {
    abonnes.delete(reveiller)
    if (!abonnes.size) reveils.delete(instance)
  }
}

/** `prendreVerrou`, au sommeil NON bloquant (`dormir(ms, signal)` rend une promesse), réveillé par `dormirJusquALiberation`. */
export async function prendreVerrouAsync({ dormir = dormirAsync, signal, ...prise }) {
  const resultat = await deroulerAsync(etapesDePrise({ ...prise, signal }), dormirJusquALiberation(dormir, instanceDuVerrou(prise.chemin), signal))
  if (signal?.aborted && resultat.etat === 'pris') {
    resultat.liberer()
    return { etat: 'refus', message: '[verrou] acquisition annulée' }
  }
  return resultat
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
 * ou tenu par un PID mort ou réutilisé) ou, à `echeanceMs`, `{ etat: 'occupe', tenant }`. Même pas, même annonce,
 * même juge de vie (`identite`) que `prendreVerrou`.
 * @param {{ chemin: string, attente?: Attente, fs?: typeof fsReel, estVivant?: (pid: number) => boolean,
 *   dormir?: (ms: number) => void, horloge?: () => number, identite?: Identite }} p
 */
export function attendreLibre({ chemin, attente, fs = fsReel, estVivant = estPidVivant, dormir = attendreSync, horloge = Date.now, identite = IDENTITE_MESUREE }) {
  const vivant = vivantSelon({ estVivant, identite, horloge })
  const essai = () => {
    const brut = lireBrut(fs, chemin)
    const tenant = tenantDuTexte(brut)
    return tenant && vivant(tenant, brut) ? { etat: 'occupe', tenant } : { etat: 'libre' }
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
  identite = IDENTITE_MESUREE,
  dormir = attendreSync,
  env = {},
  signal,
  borneMs = null,
  orphelins,
}) {
  const creation = pid === process.pid ? performance.timeOrigin : (identite.lireCreation(pid) ?? undefined)
  const vivant = consignant(chemin, borneMs, { estVivant, identite, horloge }, orphelins)
  const instance = instanceDuVerrou(chemin)
  const secret = randomUUID()
  const empreinte = createHash('sha256').update(secret).digest('hex')
  const annule = () => ({ etat: 'refus', message: `[verrou] ${libelle} : acquisition annulée` })
  return sousEcheance({
    attente, horloge,
    essai: () => {
      if (signal?.aborted) return annule()
      const jetons = jetonsDuVerrou(env, chemin)
      if (jetons.length) {
        const brut = lireBrut(fs, chemin)
        const verdict = verdictDuJeton(jetons, { instance, tenant: tenantDuTexte(brut), vivant: (tenant) => vivant(tenant, brut) })
        if ('ok' in verdict) return { etat: 'pris', emprunte: true, env: { [variableDuVerrou(chemin)]: jetons[0][1] }, liberer() {} }
        const message = `[verrou] ${libelle} : jeton d'emprunt invalide (${verdict.raison})`
        return { etat: 'refus', definitif: true, message, ...('cause' in verdict ? { cause: verdict.cause } : {}) }
      }
      const prise = prendreUneFois({ chemin, libelle, pid, commande, cwd, fs, vivant, maintenant, creation, dormir, empreinte })
      if (prise.etat === 'pris') {
        if (signal?.aborted) { prise.liberer(); return annule() }
        prise.env = { [variableDuVerrou(chemin)]: JSON.stringify({ version: 1, instance, generation: prise.generation, secret }) }
      }
      return prise
    },
    abouti: (vu) => vu.etat === 'pris' || vu.definitif || signal?.aborted,
  })
}

/**
 * Le juge de vie d'un tenant, `(tenant, brut) => boolean` : `estPidVivantDepuis` à sa naissance
 * (`naissanceDuTenant`), la date que `lireCreation` mesure lue une fois par texte `brut`, puis tous les `pasMs`.
 * @param {Juge} [juge]
 */
function vivantSelon({ estVivant = estPidVivant, identite = IDENTITE_MESUREE, horloge = Date.now } = {}) {
  const lire = creationMemorisee(identite.lireCreation, { pasMs: identite.pasMs ?? 0, horloge })
  return (/** @type {Tenant} */ tenant, /** @type {string | undefined} */ brut) => estPidVivantDepuis(tenant.pid, naissanceDuTenant(tenant), {
    toleranceMs: identite.toleranceMs,
    lireCreation: (pid) => lire(pid, brut),
  }, { estVivant })
}

/** La clé du tenant d'un essai : sa `generation`, à défaut son texte. */
const cleDuTenant = (tenant) => (tenant ? (tenant.generation ?? JSON.stringify(tenant)) : null)

/** Rejoue `essai` jusqu'à `abouti` ou l'échéance de `attente` : CÈDE chaque sommeil, REND le dernier essai. */
function* sousEcheance({ attente, horloge, essai, abouti }) {
  const origine = horloge()
  let debut = origine
  let tenant
  for (;;) {
    const vu = essai()
    if (attente?.parTenant) {
      const cle = cleDuTenant(vu.tenant)
      if (tenant !== undefined && cle !== tenant) debut = horloge()
      tenant = cle
    }
    const maintenant = horloge()
    const reste = attente ? Math.min(attente.echeanceMs - (maintenant - debut), (attente.plafondMs ?? Infinity) - (maintenant - origine)) : 0
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
function prendreUneFois({ chemin, libelle, pid, commande, cwd, fs, vivant, maintenant, creation, dormir, empreinte }) {
  fs.mkdirSync(dirname(chemin), { recursive: true })
  const generation = randomUUID()
  const texte = JSON.stringify({ pid, commande, cwd, date: maintenant(), generation, empreinte, ...(creation === undefined ? {} : { creation }) })
  const temporaire = `${chemin}.${pid}.${generation}`
  fs.writeFileSync(temporaire, texte, { flag: 'wx' })
  try {
    const prise = prendreDepuis({ chemin, libelle, temporaire, fs, vivant, liberer: () => liberer({ chemin, texte, pid, generation, fs, vivant, dormir }) })
    return prise.etat === 'pris' ? { ...prise, generation } : prise
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
      for (const reveiller of [...(reveils.get(instanceDuVerrou(chemin)) ?? [])]) reveiller()
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

/** La naissance du PID d'un tenant : sa `creation`, `NAISSANCE_ABSENTE` pour un tenant qui n'en porte pas (#2603). PURE. @param {Tenant} tenant */
export const naissanceDuTenant = (tenant) => tenant.creation ?? NAISSANCE_ABSENTE

/** L'âge (s) d'un tenant à l'`horloge`, `null` sans date lisible. PURE. */
export const ageDe = (tenant, horloge) => {
  const date = Date.parse(tenant?.date ?? '')
  return Number.isFinite(date) ? Math.round((horloge() - date) / 1000) : null
}

/** Le tenant `tenant` n'a-t-il pas dépassé `borneMs` d'âge (`null` : sans borne) à l'`horloge` ? PURE. */
const sousBorne = (tenant, borneMs, horloge) => {
  const age = borneMs === null ? null : ageDe(tenant, horloge)
  return age === null || age * 1000 <= /** @type {number} */ (borneMs)
}

/**
 * Le juge de vie `(tenant, brut) => boolean` d'un tenant (`vivantSelon` de `juge`) qui n'a pas dépassé `borneMs` d'âge.
 * @param {number | null} borneMs @param {Juge} [juge]
 */
export const vivantSousBorne = (borneMs, juge = {}) => {
  const vivant = vivantSelon(juge)
  return (/** @type {Tenant} */ tenant, /** @type {string | undefined} */ brut) => vivant(tenant, brut) && sousBorne(tenant, borneMs, juge.horloge ?? Date.now)
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
 * Le juge de vie `(tenant, brut) => boolean` du verrou `chemin` (`vivantSousBorne`, sans borne si `borneMs` est
 * `null`) qui CONSIGNE dans `orphelins` (clé `chemin`) son tenant jugé absent (#2493) : `PID mort` (mort ou
 * réutilisé, `vivantSelon`), ou `âge > borne`.
 * @param {string} chemin @param {number | null} borneMs @param {Juge} [juge] @param {Map<string, Orphelin>} [orphelins]
 */
export const consignant = (chemin, borneMs, juge = {}, orphelins) => {
  const vivant = vivantSelon(juge)
  return (/** @type {Tenant} */ tenant, /** @type {string | undefined} */ brut) => {
    const enVie = vivant(tenant, brut)
    const retenu = enVie && sousBorne(tenant, borneMs, juge.horloge ?? Date.now)
    if (!retenu) orphelins?.set(chemin, { verrou: chemin, pid: tenant.pid, depuis: tenant.date ?? mtimeDe(chemin), preuve: enVie ? 'âge > borne' : 'PID mort' })
    return retenu
  }
}

/** Les orphelins `orphelins` nommés : `<nom> (PID p mort depuis d, preuve)`, joints par `, `. PURE. @param {Orphelin[]} orphelins */
export const nomDesOrphelins = (orphelins) => orphelins
  .map((o) => `${basename(o.verrou)} (PID ${o.pid}${o.preuve === 'âge > borne' ? '' : ' mort'} depuis ${o.depuis ?? '?'}, ${o.preuve})`).join(', ')
