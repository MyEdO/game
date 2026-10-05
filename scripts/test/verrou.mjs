// Verrou de SUITE, à l'échelle de la MACHINE (#1679 L1c-M7) : deux suites complètes jouées en même
// temps (deux arbres de travail, deux sessions) se disputent les cœurs et la mémoire, et la classe
// « 245 rouges jsdom » en sort. Le verrou est CONSULTATIF : il refuse le second lanceur en NOMMANT
// le premier (PID + commande), il ne tue personne. Opt-out EXPLICITE par `WFRP_SUITE_LOCK=0`.
// PORTÉE : le chemin `npm test` (`scripts/test/run.mjs`) ET le lanceur de gates
// (`scripts/gates/toutes.mjs`), qui le tient pour TOUTE sa durée — ses trois lanes chargent la machine
// autant qu'une suite, et deux runs de gates concurrents se volaient cœurs et mémoire sans qu'aucune
// porte ne le dise (mesuré : trois plages où deux clés de gate distinctes écrivent en même temps).
// La suite lancée PAR les gates ne le reprend pas : le jeton `WFRP_SUITE_LOCK_TENU` la rend réentrante.
// Restent hors porte : `npm run test:watch`, `npm run test:map` (scripts/map, court) et tout
// `npx vitest run` tapé à la main — `scripts/lancer-local.mjs` leur sert au moins le vitest de CET arbre.
import { randomUUID } from 'node:crypto'
import fsReel from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Fichier de verrou partagé par tous les arbres de la machine. */
export const CHEMIN_VERROU = path.join(os.tmpdir(), 'wfrp-suite.lock')

/** Jeton de RÉENTRANCE : posé dans l'environnement par le processus qui TIENT déjà le verrou, il
 *  vaut le PID de ce tenant. Ses enfants (la suite lancée par les gates) ne le reprennent pas — sans
 *  quoi le lanceur se refuserait lui-même. Un jeton ne survit pas au processus qui le pose :
 *  l'environnement ne se propage qu'aux ENFANTS. */
export const JETON_REENTRANCE = 'WFRP_SUITE_LOCK_TENU'

/** Ce PID tourne-t-il ? `process.kill(pid, 0)` ne tue rien : il teste l'existence. */
export function estPidVivant(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** Message de refus : qui tient le verrou, et les DEUX sorties (attendre, ou tuer / opt-out). */
export function refusVerrou({ chemin, tenant }) {
  return [
    `[verrou] une suite complète tourne déjà sur cette machine : PID ${tenant.pid}`,
    `[verrou] commande : ${tenant.commande ?? '(inconnue)'}`,
    `[verrou] arbre : ${tenant.cwd ?? '(inconnu)'}${tenant.date ? ` · depuis ${tenant.date}` : ''}`,
    `[verrou] deux suites concurrentes se volent cœurs et mémoire — attendre la fin, ou tuer ce PID.`,
    `[verrou] verrou : ${chemin} · opt-out explicite : WFRP_SUITE_LOCK=0`,
  ].join('\n')
}

/**
 * PREND le verrou. REND `{ etat }` :
 *  - `pris` (+ `liberer()`) : le fichier a été créé par CE processus ; il porte son tenant dès qu'il
 *    existe — écrit dans un temporaire voisin, puis lié à `chemin` par `linkSync`, exclusif ;
 *  - `refus` (+ `message`) : un PID VIVANT le tient ;
 *  - `reentrant` : un ANCÊTRE de ce processus le tient déjà (jeton `WFRP_SUITE_LOCK_TENU`) ;
 *  - `ignore` (+ `avertissement`) : opt-out `WFRP_SUITE_LOCK=0`.
 * Un verrou laissé par un PID MORT (machine éteinte, run tué), ou illisible, est REPRIS sous le verrou
 * de reprise `<chemin>.reprise` (`reprendre`) ; un verrou absent ou inaccessible à la lecture se retente.
 * `fs` et `estVivant` sont injectés pour la mesure ; par défaut, le disque et `process.kill(pid, 0)`.
 */
export function prendreVerrou({
  chemin = CHEMIN_VERROU,
  pid = process.pid,
  commande = '',
  cwd = '',
  env = process.env,
  fs = fsReel,
  estVivant = estPidVivant,
  maintenant = () => new Date().toISOString(),
} = {}) {
  if (env.WFRP_SUITE_LOCK === '0') {
    return {
      etat: 'ignore',
      avertissement:
        `[verrou] WFRP_SUITE_LOCK=0 : verrou de suite DÉSACTIVÉ — une suite concurrente sur cette ` +
        `machine reste possible (cœurs et mémoire partagés).`,
    }
  }
  // RÉENTRANCE : le jeton ne suffit PAS — il doit désigner le PID qui tient RÉELLEMENT le verrou.
  // Un jeton ORPHELIN (gates tué par un signal, variable restée dans un shell) serait sinon un second
  // opt-out SILENCIEUX : il ferait passer une suite pendant qu'une autre tourne, sans un mot.
  const tenu = String(env[JETON_REENTRANCE] ?? '').trim()
  if (tenu) {
    const tenant = lireTenant(fs, chemin)
    if (tenant && String(tenant.pid) === tenu) return { etat: 'reentrant', tenantPid: tenant.pid }
    /* jeton orphelin : le verrou décide, comme pour n'importe quel appelant */
  }
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
    return prendreDepuis({ chemin, temporaire, fs, estVivant, liberer })
  } finally {
    fs.rmSync(temporaire, { force: true })
  }
}

/** Le corps de `prendreVerrou`, le tenant déjà écrit dans `temporaire`. */
function prendreDepuis({ chemin, temporaire, fs, estVivant, liberer }) {
  for (let essai = 0; essai < 3; essai += 1) {
    try {
      fs.linkSync(temporaire, chemin)
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      const brut = lireBrut(fs, chemin)
      if (brut === undefined) continue
      const tenant = tenantDe(brut)
      if (tenant && estVivant(tenant.pid)) {
        return { etat: 'refus', message: refusVerrou({ chemin, tenant }), tenant }
      }
      reprendre({ chemin, mort: brut, temporaire, fs, estVivant })
      continue
    }
    return { etat: 'pris', liberer }
  }
  // Trois reprises de suite : un autre lanceur recrée le verrou aussi vite qu'on le retire.
  return {
    etat: 'refus',
    message:
      `[verrou] verrou disputé (${chemin}) : un autre lanceur le reprend en boucle — relancer.`,
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

/**
 * Le verrou est-il REQUIS pour ce run ? Un positionnel qui désigne un DOSSIER est une suite (`npm
 * test src` énumère 1 580 fichiers) : seul un run dont CHAQUE filtre nomme un FICHIER s'en passe.
 * `estFichier` est injecté pour la mesure ; le lanceur y met un `statSync().isFile()`.
 */
export function verrouRequis(filtres, estFichier) {
  return filtres.length === 0 || !filtres.every((f) => estFichier(f))
}

/**
 * Contenu du verrou, ou `null` s'il est absent, illisible ou sans PID exploitable. Le JSON
 * `{ pid, commande, cwd, date }` ne se lit que par `lireBrut` puis `tenantDe` : `prendreVerrou`, `tenantVivant`
 * et la sonde du verrou (`scripts/ops/publier.mjs`) passent tous par là.
 * @param {typeof fsReel} fs @param {string} chemin
 */
export function lireTenant(fs = fsReel, chemin = CHEMIN_VERROU) {
  return tenantDe(lireBrut(fs, chemin))
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

/**
 * Le tenant du verrou s'il est VIVANT, sinon `null` — un verrou laissé par un PID mort ne tient
 * personne (`prendreVerrou` le reprend). Mêmes deux primitives que la prise : `lireTenant` pour le
 * contenu, `estPidVivant` pour la vie du PID.
 * @param {{chemin?:string, fs?:typeof fsReel, estVivant?:(pid:number)=>boolean}} p
 */
export function tenantVivant({ chemin = CHEMIN_VERROU, fs = fsReel, estVivant = estPidVivant } = {}) {
  const tenant = lireTenant(fs, chemin)
  return tenant && estVivant(tenant.pid) ? tenant : null
}
