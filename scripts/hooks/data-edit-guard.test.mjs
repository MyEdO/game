// Rappel de GROUNDING à l'édition d'une donnée app-owned (`src/data/*.json`) : le hook est lancé POUR
// DE VRAI (spawnSync + stdin JSON). Il garde le contenu d'un DÉPÔT : un `src/data/x.json` qui vit hors
// de tout arbre git (le scratchpad de session) ne le regarde pas (#1973). Le chemin suffit au hook,
// aucun fichier n'est écrit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'

const HOOK = fileURLToPath(new URL('./data-edit-guard.mjs', import.meta.url))

/** Contexte RENDU par le hook pour une édition de `<dossier>/src/data/qualities.json` (`''` s'il se tait). */
function rappelPour(dossier) {
  const run = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: { file_path: join(dossier, 'src', 'data', 'qualities.json'), old_string: 'a', new_string: 'b' } }),
    encoding: 'utf8',
  })
  assert.equal(run.status, 0, run.stderr)
  return run.stdout.trim() ? JSON.parse(run.stdout).hookSpecificOutput.additionalContext : ''
}

test('une donnée src/data/ DANS un dépôt reçoit le rappel ; la même hors dépôt (scratchpad) → silence', () => {
  const { racine } = instanceDeDepot()
  const scratch = mkdtempSync(join(tmpdir(), 'wfrp-scratch-'))
  try {
    assert.match(rappelPour(racine), /CHECK-FIRST/)
    assert.equal(rappelPour(scratch), '')
  } finally {
    rmSync(racine, { recursive: true, force: true })
    rmSync(scratch, { recursive: true, force: true })
  }
})
