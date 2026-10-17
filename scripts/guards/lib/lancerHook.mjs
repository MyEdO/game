// Lance un POINT D'ENTRÉE de hook pour de vrai (`spawnSync`, stdin JSON) comme le harnais le lance :
// les tests en sous-processus visent le chemin réel (#2125). Surface Claude Code par défaut
// (`CLAUDE_PROJECT_DIR` posé) ; `surface: 'codex'` le retire.
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

/**
 * @param {string} script module de `scripts/hooks/` (`repartiteur.mjs`)
 * @param {object | string} charge l'entrée du hook, ou le texte brut du stdin
 * @param {{ env?: NodeJS.ProcessEnv, cwd?: string, surface?: 'claude' | 'codex' }} [options]
 * @returns {{ code: number | null, out: string, err: string, specifique: object | null }}
 */
export function lancerHook(script, charge, { env = process.env, cwd = RACINE, surface = 'claude' } = {}) {
  const environnement = { ...env }
  if (surface === 'claude') environnement.CLAUDE_PROJECT_DIR = RACINE
  else delete environnement.CLAUDE_PROJECT_DIR
  const r = spawnSync(process.execPath, [join(RACINE, 'scripts', 'hooks', script)], {
    input: typeof charge === 'string' ? charge : JSON.stringify(charge),
    encoding: 'utf8',
    cwd,
    env: environnement,
  })
  const out = r.stdout ?? ''
  return { code: r.status, out, err: r.stderr ?? '', specifique: out.trim() ? JSON.parse(out).hookSpecificOutput : null }
}

/** L'entrée d'un `PreToolUse` d'écriture (`Write` par défaut) sur `tool_input`. */
export const ecriture = (tool_input, tool_name = 'Write', hook_event_name = 'PreToolUse') => ({ hook_event_name, tool_name, tool_input })
