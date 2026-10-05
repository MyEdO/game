import { builtinRules } from 'eslint/use-at-your-own-risk'
import { tableTotale } from '../../../src/lib/tableTotale.ts'

export default {
  meta: { name: 'core' },
  rules: tableTotale(['no-dupe-args', 'no-octal'], (nom) => builtinRules.get(nom)),
}
