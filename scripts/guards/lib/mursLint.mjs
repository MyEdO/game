import { builtinRules } from 'eslint/use-at-your-own-risk'
import interne from './interneLint.mjs'

export default {
  meta: { name: 'murs' },
  rules: Object.fromEntries([
    ...['marques', 'conteneur', 'dialecte', 'ordre-total', 'ordre-total-locale', 'purete', 'mod-sans-regle', 'minuteries-appel', 'console-sans-title']
      .map((nom) => [nom, builtinRules.get('no-restricted-syntax')]),
    ...['ordre-total-imports', 'canal-issue', 'purete-imports', 'atelier', 'minuteries-import']
      .map((nom) => [nom, builtinRules.get('no-restricted-imports')]),
    ['stockage-web', builtinRules.get('no-restricted-properties')],
    ['stockage-web-global', builtinRules.get('no-restricted-globals')],
    ['minuteries', builtinRules.get('no-restricted-globals')],
    ['minuteries-hote', builtinRules.get('no-restricted-properties')],
    ['interne', interne],
  ]),
}
