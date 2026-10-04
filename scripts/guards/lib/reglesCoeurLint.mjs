import { builtinRules } from 'eslint/use-at-your-own-risk'

export default {
  meta: { name: 'core' },
  rules: Object.fromEntries(['no-dupe-args', 'no-octal'].map((nom) => [nom, builtinRules.get(nom)])),
}
