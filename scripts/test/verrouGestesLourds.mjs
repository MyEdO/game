// Verrou MACHINE des gestes lourds (#2603, #2435, #2517) : une instance de `prendreVerrou` (`./verrou.mjs`),
// sous le `.git` commun (`npm ci` efface `node_modules/.cache`). Preneur : `scripts/docs/build-all.mjs`.
import { join } from 'node:path'
import { depotDe, dossierGitCommun } from '../guards/lib/gitPorte.mjs'
import { IDENTITE_MESUREE } from './identiteMesuree.mjs'

/** L'attente d'un geste lourd : échéance par tenant (valeur maison), un pas de 10 s. */
export const ATTENTE_GESTES_LOURDS = Object.freeze({ echeanceMs: 30 * 60 * 1000, pasMs: 10_000, parTenant: true })

/**
 * Le verrou machine des gestes lourds du dépôt de `racine` : `{ chemin, libelle, attente, identite }`, à
 * passer à `prendreVerrou`. LÈVE si le `.git` commun est introuvable (`dossierGitCommun`).
 * @param {string} racine
 */
export function verrouGestesLourds(racine) {
  const commun = dossierGitCommun(depotDe(racine))
  if (!commun.disponible) throw new Error(commun.raison)
  return {
    chemin: join(commun.valeur, 'gestes-lourds.verrou'),
    libelle: 'un geste lourd tient la machine',
    attente: ATTENTE_GESTES_LOURDS,
    identite: { ...IDENTITE_MESUREE, pasMs: ATTENTE_GESTES_LOURDS.pasMs },
  }
}
