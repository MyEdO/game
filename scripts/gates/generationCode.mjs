import { generateursDeCode } from '../docs/build-all.mjs'

export function argumentsDeGenerationCode(test, generateurs) {
  return test
    ? ['--check', '--only', ...generateursDeCode(generateurs).map((g) => g.script)]
    : ['--code', '--quiet']
}
