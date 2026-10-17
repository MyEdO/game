// Hook UserPromptSubmit du rappel de méthode : lancé POUR DE VRAI, il injecte `RAPPEL`, et le skill qu'il
// nomme existe au dépôt.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { RAPPEL, SKILL_DE_METHODE } from './rappel-methode.mjs'

const HOOK = fileURLToPath(new URL('./rappel-methode.mjs', import.meta.url))
const SKILL = fileURLToPath(new URL(`../../.claude/skills/${SKILL_DE_METHODE}/SKILL.md`, import.meta.url))

test('le hook injecte le rappel comme contexte de la demande, en exit 0', () => {
  const vu = spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: 'x' }), encoding: 'utf8', timeout: 30_000 })
  assert.equal(vu.status, 0, vu.stderr)
  const sortie = JSON.parse(vu.stdout)
  assert.equal(sortie.hookSpecificOutput.hookEventName, 'UserPromptSubmit')
  assert.equal(sortie.hookSpecificOutput.additionalContext, RAPPEL)
})

test('le skill que le rappel nomme existe', () => {
  assert.ok(existsSync(SKILL), `${SKILL} absent`)
  assert.ok(RAPPEL.includes(`\`${SKILL_DE_METHODE}\``))
})
