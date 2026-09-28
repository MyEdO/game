// Rappel de GROUNDING à l'édition d'une donnée app-owned (`src/data/*.json`) : le hook est lancé POUR
// DE VRAI (spawnSync + stdin JSON). Il garde le contenu d'un DÉPÔT : un `src/data/x.json` qui vit hors
// de tout arbre git (le scratchpad de session) ne le regarde pas (#1973). Le chemin suffit au hook,
// aucun fichier n'est écrit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { ecriture, lancerHook } from '../guards/lib/lancerHook.mjs'

/** Contexte RENDU par le hook pour une édition de `<dossier>/src/data/qualities.json` (`''` s'il se tait). */
function rappelPour(dossier) {
  const run = lancerHook('repartiteur.mjs', ecriture({ file_path: join(dossier, 'src', 'data', 'qualities.json'), old_string: 'a', new_string: 'b' }, 'Edit'))
  assert.equal(run.code, 0, run.err)
  return run.specifique?.additionalContext ?? ''
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
