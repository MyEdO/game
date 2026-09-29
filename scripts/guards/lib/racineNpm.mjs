// Le dépôt où `npm run <x>` se résout pendant l'évaluation d'UNE garde (#2125) : le répertoire cible du
// contexte (`scripts/hooks/repartiteur.mjs`, `construireContexte`), porté par la portée asynchrone de
// l'appel, jamais par une variable de module.
import { AsyncLocalStorage } from 'node:async_hooks'

const portee = new AsyncLocalStorage()

/** `fn()` évalué avec `dir` pour dépôt de résolution des scripts npm ; sa valeur (promesse comprise). */
export const sousRacineNpm = (dir, fn) => portee.run(dir || null, fn)

/** Le dépôt de résolution de la portée courante, `null` hors de toute portée. */
export const racineNpmCourante = () => portee.getStore() ?? null
