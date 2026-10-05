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

/** Contexte RENDU par le hook pour une écriture (`''` s'il se tait). */
function contexteDe(tool_input, tool_name) {
  const run = lancerHook('repartiteur.mjs', ecriture(tool_input, tool_name))
  assert.equal(run.code, 0, run.err)
  return run.specifique?.additionalContext ?? ''
}

/** Contexte RENDU par le hook pour une édition de `<dossier>/src/data/qualities.json` (`''` s'il se tait). */
function rappelPour(dossier) {
  return contexteDe({ file_path: join(dossier, 'src', 'data', 'qualities.json'), old_string: 'a', new_string: 'b' }, 'Edit')
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

test('DRIVER : ctx_patch (canal prescrit) reçoit le MÊME rappel qu’Edit — op seule, `replace_all`, lot `ops` visant deux fois la donnée', () => {
  const { racine } = instanceDeDepot()
  try {
    const donnee = join(racine, 'src', 'data', 'qualities.json')
    const edit = contexteDe({ file_path: donnee, old_string: 'a', new_string: 'b' }, 'Edit')
    assert.match(edit, /CHECK-FIRST/)
    assert.equal(contexteDe({ op: 'replace_unique', path: donnee, old_text: 'a', new_text: 'b' }, 'mcp__lean-ctx__ctx_patch'), edit)
    assert.equal(contexteDe({ op: 'replace_all', path: donnee, find: 'a', replace: 'b' }, 'mcp__lean-ctx__ctx_patch'), edit)
    const lot = contexteDe({ ops: [
      { op: 'set_line', path: donnee, line: 1, hash: '00', new_text: 'b' },
      { op: 'set_line', path: donnee, line: 2, hash: '00', new_text: 'c' },
    ] }, 'mcp__lean-ctx__ctx_patch')
    assert.equal(lot, edit, 'deux ops sur la même donnée : un seul rappel')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
