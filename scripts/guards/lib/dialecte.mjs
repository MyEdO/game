// Dialecte de parse d'un fichier — source UNIQUE de « extension → `ts.ScriptKind` » (#1679 L3b).
// Chaque garde AST recopiait sa propre table (14 sites, de 2 à 3 branches) : une extension neuve
// (`.mts` d'un script d'outillage, `.cts`) entrait alors en `TS` ici et en `JS` là, et un scan
// silencieusement faux ne se voit pas — l'AST se construit quand même.
//
// Le compilateur est chargé À LA DEMANDE (`createRequire`) : cette lib est atteinte par le garde
// PreToolUse, qui tourne à CHAQUE commande du canal — un `import` de tête ferait payer le
// chargement de `typescript` à un `ls` — et par des migrations datées, rejouées sur un export sans
// `node_modules` (`scripts/migrations/replay-head.mjs`). `typescript()` est le SEUL chargeur du
// compilateur des libs atteintes par ce garde ou par une migration datée.

import { createRequire } from 'node:module'

let compilateur = null
/** Le compilateur TypeScript du dépôt, chargé au PREMIER appel. */
export const typescript = () => (compilateur ??= createRequire(import.meta.url)('typescript'))

/** Extension → dialecte. Un `.mjs`/`.cjs` se lit en JS, une table `.json` en JSON. */
const DIALECTE = { ts: 'TS', mts: 'TS', cts: 'TS', tsx: 'TSX', js: 'JS', mjs: 'JS', cjs: 'JS', jsx: 'JSX', json: 'JSON' }

/**
 * `ts.ScriptKind` du fichier, d'après sa seule extension.
 * @param {string} fichier chemin ou nom de fichier (séparateur POSIX ou Windows).
 * @param {{ inconnu?: 'TS' | 'refus' }} [options] extension hors table : `'TS'` (défaut — le corpus
 *   des gardes est du TypeScript) ou `'refus'`, qui rend `null` pour que l'appelant ne parse pas.
 * @returns {number | null} valeur de `ts.ScriptKind`, ou `null` sous `inconnu: 'refus'`.
 */
export function scriptKindDe(fichier, { inconnu = 'TS' } = {}) {
  const nom = String(fichier ?? '').replace(/\\/g, '/').split('/').pop() ?? ''
  const ext = nom.includes('.') ? nom.split('.').pop().toLowerCase() : ''
  const dialecte = DIALECTE[ext] ?? (inconnu === 'refus' ? null : inconnu)
  // eslint-disable-next-line murs/dialecte -- la source elle-même : la table du dialecte vit ici
  return dialecte === null ? null : typescript().ScriptKind[dialecte]
}
