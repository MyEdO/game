// LITTÉRAL DE CHAÎNE JS entre guillemets simples : le seul échappeur ÉCRIT du dépôt (#2007). Ses
// consommateurs : l'écrivain des stocks `.mjs` (`FORMAT_MJS`, `stockDeSites.mjs`) et les générateurs
// des registres (`scripts/gen-registry.mjs`) et des espaces (`scripts/gen-espaces.mts`).
// `JSON.stringify` écrit aussi un littéral JS valide, entre guillemets doubles, par la plateforme : ce
// n'est pas une règle d'échappement du dépôt. Garde : `litteralJs.test.mjs` (construction
// `ECHAPPEUR_DE_LITTERAL`, `canonUnique.mjs`).

const ECHAPPES = new Map([
  ['\\', '\\\\'],
  ["'", "\\'"],
  ['\n', '\\n'],
  ['\r', '\\r'],
  [String.fromCharCode(0x2028), '\\u2028'],
  [String.fromCharCode(0x2029), '\\u2029'],
])

/** Le littéral JS, entre guillemets simples, qui rend `v` : l'antislash, le guillemet simple, `\n`,
 *  `\r`, U+2028 et U+2029 échappés. PURE. @param {string} v @returns {string} */
export const litteralJs = (v) => `'${[...v].map((c) => ECHAPPES.get(c) ?? c).join('')}'`
