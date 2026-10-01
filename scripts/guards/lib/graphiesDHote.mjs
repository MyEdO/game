/**
 * Lectures qui donnent au code du dépôt la graphie de chemin de l'HÔTE, là où le rendu sous win32
 * (`scripts/docs/lib/plateforme-win32.mjs`, #1801) ne peut pas lui substituer celle de Windows :
 * ses hooks de résolution ESM ne voient ni l'initialisation d'`import.meta`, ni le chargeur CJS.
 *
 * La lecture porte sur l'AST (`globalesNode.mjs`, qui définit les valeurs, les formes lues et ce qui
 * est HORS DE PORTÉE) : un commentaire ou une chaîne n'est pas du code. Est une lecture d'hôte :
 *   1. `import.meta.dirname` et `import.meta.filename` — accès `.`, `?.`, crochets, déstructuration
 *      (`{ dirname } = import.meta`), sur `import.meta` ou sur un nom qui lui est lié ;
 *   2. l'acquisition de `path` ou `url` (préfixe `node:` et sous-chemins `/posix`, `/win32` compris)
 *      par `require(…)`, `require?.(…)`, `module.require(…)`, `process.getBuiltinModule(…)` ou
 *      `getBuiltinModule(…)` (et `?.(…)`), `createRequire(…)(…)`, ou un nom lié (déclaration,
 *      affectation, alias d'import `{ createRequire as cr }`) à l'un de ces chargeurs.
 * N'en sont PAS : `import.meta.url`, `import.meta.main`, `import … from 'node:path'` et
 * `import('node:path')` (hooks ESM), `createRequire(…)('typescript')`.
 * HORS DE PORTÉE, en plus de celui de `globalesNode.mjs` : le code d'un processus enfant écrit dans
 * une chaîne.
 */
import { sitesDeGlobalesNode } from './globalesNode.mjs'

/** Termes sans lesquels aucune règle ne conclut (préfiltre de `globalesNode.mjs`). */
const TERMES = [/dirname|filename/, /['"`](?:node:)?(?:path|url)(?:\/(?:posix|win32))?['"`]/]

const MODULE_DE_CHEMIN = /^module:(?:path|url)(?:\/(?:posix|win32))?$/

/**
 * Lectures d'hôte que le rendu sous win32 ne simule pas, dans une source.
 * @param {string} source texte du fichier
 * @param {string} [chemin] nom du fichier, qui fixe le dialecte de parse
 * @returns {{ ligne: number, extrait: string }[]} `ligne` 1-based, valable pour la source d'origine
 */
export function lecturesDHote(source, chemin = 'source.ts') {
  return sitesDeGlobalesNode(source, chemin, {
    termes: TERMES,
    retenir: ({ sorte, valeurs }) =>
      (sorte !== 'nom' && valeurs.has('hote')) || (sorte === 'expression' && [...valeurs].some((v) => MODULE_DE_CHEMIN.test(v))),
  })
}
