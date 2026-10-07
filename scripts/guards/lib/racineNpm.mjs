// Le dépôt où `npm run <x>` se résout pendant l'évaluation d'UNE garde (#2125) : la racine npm du
// contexte (`scripts/hooks/repartition.mjs`, `construireContexte`, `racineNpmDe`), portée par la portée
// asynchrone de l'appel, jamais par une variable de module.
import { AsyncLocalStorage } from 'node:async_hooks'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const portee = new AsyncLocalStorage()

/** `fn()` évalué avec `dir` pour dépôt de résolution des scripts npm ; sa valeur (promesse comprise). */
export const sousRacineNpm = (dir, fn) => portee.run(dir || null, fn)

/** Le dépôt de résolution de la portée courante, `null` hors de toute portée. */
export const racineNpmCourante = () => portee.getStore() ?? null

/**
 * La racine npm d'une commande lancée dans `dir` : son premier ancêtre, lui compris, qui porte un
 * `package.json` ou un dossier `node_modules` (docs.npmjs.com, `folders`, « Local Prefix ») ; `dir`
 * lui-même sans ancêtre porteur, où aucun script ne se résout. `null` sans `dir`.
 * @param {string | null} dir @returns {string | null}
 */
export function racineNpmDe(dir) {
  if (!dir) return null
  const depart = resolve(dir)
  for (let courant = depart; ; courant = dirname(courant)) {
    if (existsSync(join(courant, 'package.json')) || existsSync(join(courant, 'node_modules'))) return courant
    if (dirname(courant) === courant) return depart
  }
}
