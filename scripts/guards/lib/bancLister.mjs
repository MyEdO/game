import * as importe19_0 from 'node:assert/strict'
import * as importe19_1 from './lister.mjs'
import * as importe19_2 from '../../docs/build-all.mjs'
import * as importe19_3 from '../../../oxlint.config.mjs'
export const banclistertestmjs = (() => {
const assert = importe19_0.default
const correspondGlob = importe19_1.correspondGlob
const GENERATORS = importe19_2.GENERATORS
const NON_GENERATOR_CHECKS = importe19_2.NON_GENERATOR_CHECKS
const configEslint = importe19_3.BLOCS_LINT
const REGLES_ORDRE_TOTAL = importe19_3.REGLES_ORDRE_TOTAL
function blocDe(regle) {
  const bloc = configEslint.find((c) => c?.rules && regle in c.rules)
  assert.ok(bloc, `\`${regle}\` n’est déclarée par aucun bloc d’oxlint.config.mjs`)
  return bloc
}
const blocsDuMur = () => Object.keys(REGLES_ORDRE_TOTAL).map(blocDe)
const couvre = (bloc, rel) => bloc.files.some((g) => correspondGlob(rel, g))
const exempte = (bloc, rel) => (bloc.excludeFiles ?? []).some((g) => correspondGlob(rel, g))
const racinesDuRegistre = () => [...new Set([...GENERATORS.map((g) => g.script), ...NON_GENERATOR_CHECKS])].sort()
return { blocDe, blocsDuMur, couvre, exempte, racinesDuRegistre }
})()
