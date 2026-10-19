import { builtinRules } from 'eslint/use-at-your-own-risk'
import interne from './interneLint.mjs'

/** Les murs qu'une directive au site peut éteindre (#2724) ; tout autre mur, et toute règle native de
 *  restriction, n'en admet aucune : `scripts/corpus/guards/directivesMurs.test.mjs`. */
export const MURS_EXEMPTABLES_AU_SITE = Object.freeze(['marques', 'conteneur', 'purete-imports', 'ordre-total', 'ordre-total-imports', 'ordre-total-locale'].map((nom) => `murs/${nom}`))

export default {
  meta: { name: 'murs' },
  rules: Object.fromEntries([
    ...['marques', 'conteneur', 'dialecte', 'ordre-total', 'ordre-total-locale', 'purete', 'mod-sans-regle', 'minuteries-appel', 'console-sans-title']
      .map((nom) => [nom, builtinRules.get('no-restricted-syntax')]),
    ...['ordre-total-imports', 'canal-issue', 'purete-imports', 'atelier', 'minuteries-import']
      .map((nom) => [nom, builtinRules.get('no-restricted-imports')]),
    ...['stockage-web', 'minuteries-hote', 'alea-serveur']
      .map((nom) => [nom, builtinRules.get('no-restricted-properties')]),
    ...['stockage-web-global', 'minuteries']
      .map((nom) => [nom, builtinRules.get('no-restricted-globals')]),
    ['interne', interne],
  ]),
}
