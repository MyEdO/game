import { builtinRules } from 'eslint/use-at-your-own-risk'
import interne from './interneLint.mjs'

export default {
  meta: { name: 'murs' },
  rules: Object.fromEntries([
    ...['marques', 'conteneur', 'dialecte', 'ordre-total', 'ordre-total-locale', 'purete', 'mod-sans-regle']
      .map((nom) => [nom, builtinRules.get('no-restricted-syntax')]),
    ...['ordre-total-imports', 'canal-issue', 'purete-imports', 'atelier']
      .map((nom) => [nom, builtinRules.get('no-restricted-imports')]),
    ['interne', interne],
  ]),
}
