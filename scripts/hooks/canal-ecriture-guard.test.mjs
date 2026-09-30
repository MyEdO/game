// Garde des CANAUX d'écriture (#2180) : le répartiteur réel (spawnSync + stdin JSON), sur les formes
// d'entrée de lean-ctx 3.10.2. Aucun fichier n'est écrit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ecriture, lancerHook } from '../guards/lib/lancerHook.mjs'
import { REGISTRE } from './registre.mjs'
import { CONSIGNE, garde } from './canal-ecriture-guard.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FICHE = join(REPO, '.claude', 'memory', 'game-sonde-canal.md')

/** La décision et la raison du répartiteur pour `tool_name` sur `tool_input`. */
function decisionDe(tool_name, tool_input) {
  const r = lancerHook('repartiteur.mjs', ecriture(tool_input, tool_name))
  assert.equal(r.code, 0, r.err)
  return { decision: r.specifique?.permissionDecision ?? null, raison: r.specifique?.permissionDecisionReason ?? '' }
}

test('la garde est au registre PreToolUse du répartiteur, AVANT les gardes d’écriture', () => {
  assert.equal(REGISTRE.PreToolUse[0], garde)
})

test('DRIVER : une écriture que les gardes d’écriture ne sauraient juger est REFUSÉE, avec le canal prescrit', () => {
  const cas = [
    ['ctx_patch replace_symbol adressé par `name` seul', 'mcp__lean-ctx__ctx_patch', { op: 'replace_symbol', name: 'game-sonde-canal', new_text: 'SUPERSÉDÉ : x' }],
    ['ctx_call → ctx_edit', 'mcp__lean-ctx__ctx_call', { tool: 'ctx_edit', arguments: { path: FICHE, old_string: 'x', new_string: 'SUPERSÉDÉ : x' } }],
    ['ctx_edit', 'mcp__lean-ctx__ctx_edit', { path: FICHE, old_string: 'x', new_string: 'SUPERSÉDÉ : x' }],
    ['ctx_call → ctx_patch', 'mcp__lean-ctx__ctx_call', { tool: 'ctx_patch', arguments: { op: 'replace_unique', path: FICHE, old_text: 'x', new_text: 'SUPERSÉDÉ : x' } }],
    ['ctx_refactor', 'mcp__lean-ctx__ctx_refactor', { action: 'replace_symbol_body', name_path: 'f', body: 'x' }],
  ]
  for (const [nom, outil, entree] of cas) {
    const { decision, raison } = decisionDe(outil, entree)
    assert.equal(decision, 'deny', nom)
    assert.ok(raison.includes(CONSIGNE), `${nom} : ${raison}`)
  }
})

test('DRIVER : ctx_call vers un outil de LECTURE, ctx_patch AVEC chemin, et `dry_run` passent sans refus de canal', () => {
  assert.equal(decisionDe('mcp__lean-ctx__ctx_call', { tool: 'ctx_callgraph', arguments: { name: 'f' } }).decision, null)
  assert.equal(decisionDe('mcp__lean-ctx__ctx_patch', { op: 'replace_symbol', name: 'f', path: join(REPO, 'docs', 'x.md'), line: 1, new_text: 'x' }).decision, null)
  assert.equal(decisionDe('mcp__lean-ctx__ctx_patch', { op: 'replace_symbol', name: 'f', new_text: 'x', dry_run: true }).decision, null)
})
