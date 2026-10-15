// Verrou MACHINE des gestes lourds (#2603, #2435, #2517) : une instance de `prendreVerrou` (`./verrou.mjs`),
// sous le `.git` commun (`npm ci` efface `node_modules/.cache`). Preneur : `scripts/docs/build-all.mjs`.
import { join } from 'node:path'
import { depotDe, dossierGitCommun } from '../guards/lib/gitPorte.mjs'
import { mesurerProcessusWorktrees, toleranceDeMesure } from '../guards/lib/processusWorktrees.mjs'

/** L'attente d'un geste lourd : échéance par tenant (valeur maison), un pas de 10 s. */
export const ATTENTE_GESTES_LOURDS = Object.freeze({ echeanceMs: 30 * 60 * 1000, pasMs: 10_000, parTenant: true })

/** Borne d'une mesure de création ; son échéance vaut indéterminé. */
const BORNE_DE_MESURE_MS = 10_000

/**
 * La date de création (ms epoch) du processus `pid`, mesurée par `mesurerProcessusWorktrees` sous
 * `BORNE_DE_MESURE_MS` ; `null` si elle est INDÉTERMINÉE (échéance, erreur, processus absent).
 * @param {number} pid
 * @param {{ mesurer?: typeof mesurerProcessusWorktrees }} [injections]
 * @returns {number | null}
 */
export function creationMesuree(pid, { mesurer = mesurerProcessusWorktrees } = {}) {
  let vue
  try {
    vue = mesurer({ pids: [pid], timeout: BORNE_DE_MESURE_MS })
  } catch {
    return null
  }
  if (vue.indeterminee) return null
  const creation = Date.parse(vue.processus.find((p) => p.pid === pid)?.creation ?? '')
  return Number.isFinite(creation) ? creation : null
}

/**
 * Le verrou machine des gestes lourds du dépôt de `racine` : `{ chemin, libelle, attente, identite }`, à
 * passer à `prendreVerrou`. LÈVE si le `.git` commun est introuvable (`dossierGitCommun`).
 * @param {string} racine
 * @param {{ platform?: string }} [options]
 */
export function verrouGestesLourds(racine, { platform = process.platform } = {}) {
  const commun = dossierGitCommun(depotDe(racine))
  if (!commun.disponible) throw new Error(commun.raison)
  return {
    chemin: join(commun.valeur, 'gestes-lourds.verrou'),
    libelle: 'un geste lourd tient la machine',
    attente: ATTENTE_GESTES_LOURDS,
    identite: { lireCreation: creationMesuree, toleranceMs: toleranceDeMesure(platform), pasMs: ATTENTE_GESTES_LOURDS.pasMs },
  }
}
