// Garde des CANAUX d'outil (#2180) : le répartiteur réel (spawnSync + stdin JSON), sur les formes
// d'entrée de lean-ctx 3.10.2. Aucun fichier n'est écrit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ecriture, lancerHook } from '../guards/lib/lancerHook.mjs'
import { FAMILLES_LEAN_CTX, LECTURE } from '../guards/lib/contratGarde.mjs'
import { REGISTRE } from './registre.mjs'
import { CONSIGNE, garde } from './canal-outil-guard.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FICHE = join(REPO, '.claude', 'memory', 'game-sonde-canal.md')
const ECRIT = `node -e "require('fs').writeFileSync('${FICHE.replace(/\\/g, '/')}','x')"`

/** La décision et la raison du répartiteur pour `tool_name` sur `tool_input`. */
function decisionDe(tool_name, tool_input) {
  const r = lancerHook('repartiteur.mjs', ecriture(tool_input, tool_name))
  assert.equal(r.code, 0, r.err)
  return { decision: r.specifique?.permissionDecision ?? null, raison: r.specifique?.permissionDecisionReason ?? '' }
}

test('la garde est au registre PreToolUse du répartiteur, AVANT les gardes d’écriture', () => {
  assert.equal(REGISTRE.PreToolUse[0], garde)
})

test('DRIVER : tout outil lean-ctx NON classé, direct ou par la passerelle, et toute écriture non jugeable est REFUSÉ, avec le canal prescrit', () => {
  const cas = [
    ['ctx_execute (code arbitraire)', 'mcp__lean-ctx__ctx_execute', { action: 'code', language: 'javascript', code: 'require("fs")' }],
    ['ctx_call → ctx_execute', 'mcp__lean-ctx__ctx_call', { tool: 'ctx_execute', arguments: { action: 'code', language: 'shell', code: 'echo x' } }],
    ['ctx_call → shell (commande hors des gardes de commande)', 'mcp__lean-ctx__ctx_call', { tool: 'shell', arguments: { command: ECRIT } }],
    ['ctx_call → ctx_shell_background', 'mcp__lean-ctx__ctx_call', { tool: 'ctx_shell_background', arguments: { command: ECRIT } }],
    ['ctx_call → ctx_skillify', 'mcp__lean-ctx__ctx_call', { tool: 'ctx_skillify', arguments: { action: 'promote', slug: 'x' } }],
    ['ctx_call → ctx_refactor', 'mcp__lean-ctx__ctx_call', { tool: 'ctx_refactor', arguments: { action: 'rename' } }],
    ['ctx_call → ctx_patch', 'mcp__lean-ctx__ctx_call', { tool: 'ctx_patch', arguments: { op: 'replace_unique', path: FICHE, old_text: 'x', new_text: 'y' } }],
    ['ctx_call → ctx_edit', 'mcp__lean-ctx__ctx_call', { tool: 'ctx_edit', arguments: { path: FICHE, old_string: 'x', new_string: 'y' } }],
    ['ctx_call tool en casse autre', 'mcp__lean-ctx__ctx_call', { tool: 'CTX_EDIT', arguments: { path: FICHE } }],
    ['ctx_call sans tool (name)', 'mcp__lean-ctx__ctx_call', { name: 'ctx_edit', arguments: { path: FICHE } }],
    ['ctx_call tool non-chaîne', 'mcp__lean-ctx__ctx_call', { tool: ['ctx_edit'], arguments: { path: FICHE } }],
    ['ctx_edit', 'mcp__lean-ctx__ctx_edit', { path: FICHE, old_string: 'x', new_string: 'y' }],
    ['ctx_refactor', 'mcp__lean-ctx__ctx_refactor', { action: 'replace_symbol_body', name_path: 'f', body: 'x' }],
    ['ctx_tools call (passerelle aval)', 'mcp__lean-ctx__ctx_tools', { action: 'call', tool: 'lean-ctx::ctx_edit', arguments: { path: FICHE } }],
    ['outil lean-ctx inconnu', 'mcp__lean-ctx__ctx_outil_inconnu', {}],
    ['Write chemin vide', 'Write', { file_path: '', content: 'x' }],
    ['Write chemin fait de blancs', 'Write', { file_path: '   ', content: 'x' }],
    ['Edit sans chemin', 'Edit', { old_string: 'a', new_string: 'b' }],
    ['ctx_patch replace_symbol adressé par `name` seul', 'mcp__lean-ctx__ctx_patch', { op: 'replace_symbol', name: 'f', new_text: 'x' }],
    ['ctx_patch replace_symbol avec path+line (texte remplacé non résoluble)', 'mcp__lean-ctx__ctx_patch', { op: 'replace_symbol', path: join(REPO, 'docs', 'x.md'), line: 1, new_text: 'x' }],
    ['ctx_patch lot sans path', 'mcp__lean-ctx__ctx_patch', { ops: [{ op: 'set_line', line: 1, hash: '00', new_text: 'b' }] }],
    ['ctx_patch dry_run en chaîne (écrit)', 'mcp__lean-ctx__ctx_patch', { op: 'replace_symbol', name: 'x', new_text: 'x', dry_run: 'true' }],
  ]
  for (const [nom, outil, entree] of cas) {
    const { decision, raison } = decisionDe(outil, entree)
    assert.equal(decision, 'deny', nom)
    assert.ok(raison.includes(CONSIGNE), `${nom} : ${raison}`)
  }
})

test('DRIVER : un outil de LECTURE classé, direct ou par la passerelle, un shell classé, et une écriture jugeable passent sans refus de canal', () => {
  const passent = [
    ['ctx_read', 'mcp__lean-ctx__ctx_read', { path: FICHE }],
    ['ctx_call → ctx_read', 'mcp__lean-ctx__ctx_call', { tool: 'ctx_read', arguments: { path: FICHE } }],
    ['ctx_call → mcp__lean-ctx__ctx_callgraph', 'mcp__lean-ctx__ctx_call', { tool: 'mcp__lean-ctx__ctx_callgraph', arguments: { symbol: 'f' } }],
    ['ctx_shell anodin', 'mcp__lean-ctx__ctx_shell', { command: 'git status' }],
    ['shell (alias) anodin', 'mcp__lean-ctx__shell', { command: 'git status' }],
    ['ctx_patch create avec path', 'mcp__lean-ctx__ctx_patch', { op: 'create', path: join(REPO, 'docs', 'zz-sonde.md'), new_text: 'x' }],
    ['ctx_patch set_line avec path', 'mcp__lean-ctx__ctx_patch', { op: 'set_line', path: join(REPO, 'docs', 'x.md'), line: 1, hash: '00', new_text: 'x' }],
    ['ctx_patch lot vide', 'mcp__lean-ctx__ctx_patch', { path: FICHE, ops: [] }],
    ['ctx_patch dry_run', 'mcp__lean-ctx__ctx_patch', { op: 'replace_symbol', name: 'f', new_text: 'x', dry_run: true }],
  ]
  for (const [nom, outil, entree] of passent) assert.equal(decisionDe(outil, entree).decision, null, nom)
})

test('les outils que les sessions utilisent pour LIRE sont classés LECTURE (sinon toute session se bloque)', () => {
  for (const nu of ['ctx_read', 'ctx_search', 'ctx_glob', 'ctx_tree', 'ctx_compose', 'ctx_callgraph', 'ctx_knowledge', 'ctx_session', 'ctx_overview', 'ctx_expand', 'ctx_delta', 'ctx_graph', 'ctx_url_read'])
    assert.equal(FAMILLES_LEAN_CTX[nu], LECTURE, nu)
})
