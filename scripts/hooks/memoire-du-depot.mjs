// La MÉMOIRE committée du dépôt (`.claude/memory/`), que seule une session LOCALE charge (doc memory :
// « Auto memory is machine-local ») : en conteneur distant, les hooks la portent au contexte de la
// session (`bootstrap-conteneur.mjs`) et des sous-agents qui peuvent la lire (`memoire-sous-agent.mjs`), #2710.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Le dépôt qui porte ces hooks, et donc la mémoire qu'ils impriment. */
export const RACINE_DU_DEPOT = fileURLToPath(new URL('../../', import.meta.url))

/** L'index de la mémoire, relatif à la racine du dépôt. */
export const INDEX_MEMOIRE = '.claude/memory/MEMORY.md'

/** Marqueur d'un conteneur distant Claude Code (`CLAUDE_CODE_REMOTE=true`). */
export const estConteneurDistant = (env) => env.CLAUDE_CODE_REMOTE === 'true'

/** Le texte qui porte l'index au contexte, en conteneur distant seulement ; `''` ailleurs ou sans index. */
export function memoireDuConteneur(env = process.env, racine = RACINE_DU_DEPOT) {
  const chemin = join(racine, INDEX_MEMOIRE)
  if (!estConteneurDistant(env) || !existsSync(chemin)) return ''
  return `[conteneur] mémoire du dépôt (\`${INDEX_MEMOIRE}\`, fiches sous \`.claude/memory/\`) :\n${readFileSync(chemin, 'utf8').trim()}\n`
}
