// Un suivi de vague de BANC, posé par l'outil (`editer`, scripts/ops/suivi.mjs) : un test ne construit
// jamais un suivi par un JSON écrit à la main (#2460).
import { editer } from '../ops/suivi.mjs'

/**
 * Pose, lot après lot, le suivi `epique` dans `dossier` ; le premier lot commence par `creer` si le suivi
 * n'existe pas. Un lot refusé lève son refus.
 * @param {{dossier: string, epique: number, lots: unknown[][], maintenant?: Date}} params
 */
export function poserSuivi({ dossier, epique, lots, maintenant = new Date() }) {
  for (const mutations of lots) {
    const vu = editer({ numero: epique, dossier, mutations, maintenant })
    if (vu.code !== 0) throw new Error(vu.stderr)
  }
}
