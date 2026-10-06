// Verrou CONSULTATIF entre processus de la machine (#1679 L1c-M7, #2279 N0, #2187) : un fichier pris par
// `linkSync` exclusif, qui porte son tenant `{ pid, commande, cwd, date }` dès qu'il existe. Il refuse le
// second preneur en NOMMANT le premier, ou le fait attendre sous une échéance ; il ne tue personne.
import { randomUUID } from 'node:crypto'
import fsReel from 'node:fs'
import { attendreSync } from '../guards/lib/spawnResilient.mjs'

/** Ce PID tourne-t-il ? `process.kill(pid, 0)` ne tue rien : il teste l'existence. */
export function estPidVivant(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
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

/**
 * @typedef {{ pid: number, commande?: string, cwd?: string, date?: string }} Tenant
 * @typedef {{ echeanceMs: number, pasMs: number, annoncer?: (tenant: Tenant | null) => void }} Attente
 * @typedef {{ chemin: string, libelle: string, pid?: number, commande?: string, cwd?: string,
 *   fs?: typeof fsReel, estVivant?: (pid: number) => boolean, maintenant?: () => string,
 *   attente?: Attente, horloge?: () => number }} Prise
 */

/**
 * PREND le verrou `chemin`. REND `{ etat: 'pris', liberer }` ou `{ etat: 'refus', message, tenant? }`.
 * Sans `attente`, un seul essai. Avec `attente`, un refus se rejoue tous les `pasMs` après
 * `annoncer(tenant)`, jusqu'à `echeanceMs` : à échéance, le dernier refus — jamais d'exception, jamais
 * d'attente sans fin. Un verrou laissé par un PID MORT, ou illisible, est REPRIS sous le verrou de reprise
 * `<chemin>.reprise` (`reprendre`). `fs`, `estVivant`, `maintenant`, `dormir` et `horloge` s'injectent
 * (mesure). Sommeil BLOQUANT (`attendreSync`) : un appelant qui garde une boucle d'événements vivante
 * prend `prendreVerrouAsync`.
 * @param {Prise & { dormir?: (ms: number) => void }} p
 */
export function prendreVerrou({ dormir = attendreSync, ...prise }) {
  return derouler(etapesDePrise(prise), dormir)
}

/** `prendreVerrou`, au sommeil NON bloquant (`dormir` rend une promesse). */
export function prendreVerrouAsync({ dormir = (ms) => new Promise((fini) => setTimeout(fini, ms)), ...prise }) {
  return deroulerAsync(etapesDePrise(prise), dormir)
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
    const tenant = tenantDe(lireBrut(fs, chemin))
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
}) {
  return sousEcheance({
    attente, horloge,
    essai: () => prendreUneFois({ chemin, libelle, pid, commande, cwd, fs, estVivant, maintenant }),
    abouti: (vu) => vu.etat === 'pris',
  })
}

/** Rejoue `essai` jusqu'à `abouti` ou l'échéance de `attente` : CÈDE chaque sommeil, REND le dernier essai. */
function* sousEcheance({ attente, horloge, essai, abouti }) {
  const debut = horloge()
  for (;;) {
    const vu = essai()
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

/** Un essai de prise : le tenant écrit dans un temporaire voisin, puis lié à `chemin`. */
function prendreUneFois({ chemin, libelle, pid, commande, cwd, fs, estVivant, maintenant }) {
  const liberer = () => {
    try {
      fs.rmSync(chemin, { force: true })
    } catch {
      /* verrou déjà retiré : rien à libérer */
    }
  }
  const temporaire = `${chemin}.${pid}.${randomUUID()}`
  fs.writeFileSync(temporaire, JSON.stringify({ pid, commande, cwd, date: maintenant() }), { flag: 'wx' })
  try {
    return prendreDepuis({ chemin, libelle, temporaire, fs, estVivant, liberer })
  } finally {
    fs.rmSync(temporaire, { force: true })
  }
}

/** Le corps de `prendreUneFois`, le tenant déjà écrit dans `temporaire`. */
function prendreDepuis({ chemin, libelle, temporaire, fs, estVivant, liberer }) {
  for (let essai = 0; essai < 3; essai += 1) {
    try {
      fs.linkSync(temporaire, chemin)
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      const brut = lireBrut(fs, chemin)
      if (brut === undefined) continue
      const tenant = tenantDe(brut)
      if (tenant && estVivant(tenant.pid)) {
        return { etat: 'refus', message: refusVerrou({ chemin, tenant, libelle }), tenant }
      }
      reprendre({ chemin, mort: brut, temporaire, fs, estVivant })
      continue
    }
    return { etat: 'pris', liberer }
  }
  return {
    etat: 'refus',
    message: `[verrou] ${libelle} : verrou disputé (${chemin}), un autre preneur le reprend en boucle — relancer.`,
  }
}

/**
 * Retire le verrou `chemin` s'il porte encore le texte `mort`, sous le verrou de reprise `<chemin>.reprise`
 * pris par `linkSync` de `temporaire` : deux repreneurs ne retirent jamais le verrou que l'un d'eux vient
 * de prendre. Un verrou de reprise tenu par un PID mort est retiré ; tenu par un vivant, rien n'est fait.
 */
function reprendre({ chemin, mort, temporaire, fs, estVivant }) {
  const reprise = `${chemin}.reprise`
  try {
    fs.linkSync(temporaire, reprise)
  } catch (e) {
    if (e.code !== 'EEXIST') throw e
    const tenant = tenantDe(lireBrut(fs, reprise))
    if (tenant && !estVivant(tenant.pid)) fs.rmSync(reprise, { force: true })
    return
  }
  try {
    if (lireBrut(fs, chemin) === mort) fs.rmSync(chemin, { force: true })
  } finally {
    fs.rmSync(reprise, { force: true })
  }
}

/** Le texte du verrou, ou `undefined` s'il est absent ou inaccessible à la lecture. */
function lireBrut(fs, chemin) {
  try {
    return fs.readFileSync(chemin, 'utf8')
  } catch {
    return undefined
  }
}

/** Le tenant que porte le texte `brut`, ou `null` s'il est absent, illisible ou sans PID exploitable. */
function tenantDe(brut) {
  try {
    const lu = JSON.parse(brut ?? '')
    return Number.isInteger(lu?.pid) ? lu : null
  } catch {
    return null
  }
}
