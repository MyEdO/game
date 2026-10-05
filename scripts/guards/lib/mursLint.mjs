import { builtinRules } from 'eslint/use-at-your-own-risk'

export default {
  meta: { name: 'murs' },
  rules: Object.fromEntries([
    ...['marques', 'conteneur', 'dialecte', 'ordre-total', 'ordre-total-locale', 'purete', 'mod-sans-regle']
      .map((nom) => [nom, builtinRules.get('no-restricted-syntax')]),
    ...['ordre-total-imports', 'possession', 'canal-issue', 'purete-imports']
      .map((nom) => [nom, builtinRules.get('no-restricted-imports')]),
  ]),
}
