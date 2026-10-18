import assert from 'node:assert/strict'
import { correspondGlob } from '../../guards/lib/lister.mjs'
import { GENERATORS, NON_GENERATOR_CHECKS } from '../../docs/build-all.mjs'
import { BLOCS_LINT as configEslint, REGLES_ORDRE_TOTAL } from '../../../oxlint.config.mjs'
/** Le bloc de la config réelle qui déclare cette règle du mur — UN seul (volet UNICITÉ). */
function blocDe(regle) {
  const bloc = configEslint.find((c) => c?.rules && regle in c.rules)
  assert.ok(bloc, `\`${regle}\` n’est déclarée par aucun bloc d’oxlint.config.mjs`)
  return bloc
}
/** Les blocs du mur de l'ordre total, un par règle de `REGLES_ORDRE_TOTAL`. */
const blocsDuMur = () => Object.keys(REGLES_ORDRE_TOTAL).map(blocDe)
const couvre = (bloc, rel) => bloc.files.some((g) => correspondGlob(rel, g))
const exempte = (bloc, rel) => (bloc.excludeFiles ?? []).some((g) => correspondGlob(rel, g))
const racinesDuRegistre = () => [...new Set([...GENERATORS.map((g) => g.script), ...NON_GENERATOR_CHECKS])].sort()

export { blocDe, blocsDuMur, couvre, exempte, racinesDuRegistre }
