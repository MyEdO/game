import { CODE_DIFFERE, generateursDeCode } from '../docs/build-all.mjs'

export function argumentsDeGenerationCode(test, generateurs) {
  return test
    ? ['--check', '--only', ...generateursDeCode(generateurs).map((g) => g.script)]
    : ['--code', '--quiet']
}

/** Le verdict du code de sortie `statut` d'une génération de code (#2603) : `CODE_DIFFERE` (le tenant de l'écrivain
 *  des dérivés écrit les cibles de code) est `differe` ; `CODE_SOURCE_MODIFIEE` (source encore modifiée au bout des
 *  rejeux) laisse les cibles à produire, `echec`. PURE.
 *  @param {number | null} statut @returns {'ok' | 'differe' | 'echec'} */
export const verdictDeGenerationCode = (statut) =>
  (statut === 0 ? 'ok' : statut === CODE_DIFFERE ? 'differe' : 'echec')
