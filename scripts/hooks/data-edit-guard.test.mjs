// Renvoi à `.claude/rules/donnees.md` à l'édition d'une donnée app-owned (`src/data/*.json`) : silence sur les
// canaux où la règle est déjà chargée (Write et Edit natifs, édition lean-ctx projetée), renvoi sur les autres
// (`apply_patch`). Il garde le contenu d'un DÉPÔT : un `src/data/x.json` qui vit hors de tout arbre git (le
// scratchpad de session) ne le regarde pas (#1973). Le chemin suffit à la garde, aucun fichier n'est écrit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { ecriture, lancerHook } from '../guards/lib/lancerHook.mjs'
import { REGLE_DES_DONNEES, garde } from './data-edit-guard.mjs'

/** Contexte RENDU par le répartiteur réel pour une écriture (`''` s'il se tait). */
function contexteDe(tool_input, tool_name) {
  const run = lancerHook('repartiteur.mjs', ecriture(tool_input, tool_name))
  assert.equal(run.code, 0, run.err)
  return run.specifique?.additionalContext ?? ''
}

/** Les contextes de la garde pour un `apply_patch` qui écrit `<dossier>/src/data/qualities.json`. */
const renvoisPour = (dossier) => garde.evaluer(
  { tool_name: 'apply_patch', ecritures: [{ path: join(dossier, 'src', 'data', 'qualities.json'), content: '{}\n', existeAvant: true }] },
  { dir: dossier },
).filter(Boolean).map((v) => v.contexte)

test('apply_patch : une donnée src/data/ DANS un dépôt reçoit le renvoi à la règle ; la même hors dépôt (scratchpad) → silence', () => {
  const { racine } = instanceDeDepot()
  const scratch = mkdtempSync(join(tmpdir(), 'wfrp-scratch-'))
  try {
    const renvois = renvoisPour(racine)
    assert.equal(renvois.length, 1)
    assert.ok(renvois[0].includes(REGLE_DES_DONNEES), renvois[0])
    assert.deepEqual(renvoisPour(scratch), [])
  } finally {
    rmSync(racine, { recursive: true, force: true })
    rmSync(scratch, { recursive: true, force: true })
  }
})

test('DRIVER : Edit natif et ctx_patch (op seule, `replace_all`, lot `ops`) ne reçoivent pas le renvoi, la règle y est chargée', () => {
  const { racine } = instanceDeDepot()
  try {
    const donnee = join(racine, 'src', 'data', 'qualities.json')
    const entrees = [
      [{ file_path: donnee, old_string: 'a', new_string: 'b' }, 'Edit'],
      [{ op: 'replace_unique', path: donnee, old_text: 'a', new_text: 'b' }, 'mcp__lean-ctx__ctx_patch'],
      [{ op: 'replace_all', path: donnee, find: 'a', replace: 'b' }, 'mcp__lean-ctx__ctx_patch'],
      [{ ops: [
        { op: 'set_line', path: donnee, line: 1, hash: '00', new_text: 'b' },
        { op: 'set_line', path: donnee, line: 2, hash: '00', new_text: 'c' },
      ] }, 'mcp__lean-ctx__ctx_patch'],
    ]
    for (const [tool_input, tool_name] of entrees) assert.ok(!contexteDe(tool_input, tool_name).includes(REGLE_DES_DONNEES), tool_name)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
