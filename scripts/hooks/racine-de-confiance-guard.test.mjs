// node --test scripts/hooks/racine-de-confiance-guard.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RACINE_DE_CONFIANCE, garde } from './racine-de-confiance-guard.mjs'
import { REGISTRE } from './registre.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))
const BARRIERE = fileURLToPath(new URL('./barriere-outil.mjs', import.meta.url))
const evaluer = (tool_name, tool_input) => garde.evaluer({ hook_event_name: 'PreToolUse', tool_name, tool_input }, { dir: RACINE }).filter(Boolean)

test('la racine de confiance existe, et la garde est au registre PreToolUse', () => {
  assert.deepEqual(RACINE_DE_CONFIANCE.filter((rel) => !existsSync(join(RACINE, rel))), [])
  assert.ok(REGISTRE.PreToolUse.includes(garde))
})

test('une écriture qui casse la syntaxe d’un module de la racine est refusée ; une écriture saine passe', () => {
  const ligne = 'export const SORTIE_REFUS = 2'
  assert.ok(readFileSync(BARRIERE, 'utf8').includes(ligne))
  assert.match(evaluer('Edit', { file_path: BARRIERE, old_string: ligne, new_string: 'export const SORTIE_REFUS = {' })[0].raison, /node --check/)
  assert.deepEqual(evaluer('Edit', { file_path: BARRIERE, old_string: ligne, new_string: 'export const SORTIE_REFUS = 3' }), [])
  assert.match(evaluer('Write', { file_path: 'scripts/guards/lib/stdinBorne.mjs', content: 'export function (' })[0].raison, /stdinBorne\.mjs ne passerait plus/)
  assert.deepEqual(evaluer('Write', { file_path: 'scripts/hooks/panne-outil.mjs', content: 'export const x = 1\n' }), [])
  assert.deepEqual(evaluer('Edit', { file_path: BARRIERE, old_string: 'absent-2712', new_string: '{' }), [], 'l’outil échouera de lui-même')
})

test('une écriture que la garde ne rejoue pas est refusée sur la racine, ignorée ailleurs', () => {
  assert.match(evaluer('mcp__lean-ctx__ctx_patch', { path: BARRIERE, op: 'set_line', line: 1, content_line: '{' })[0].raison, /par Write ou Edit/)
  assert.deepEqual(evaluer('Write', { file_path: 'scripts/hooks/registre.mjs', content: '{' }), [])
})
