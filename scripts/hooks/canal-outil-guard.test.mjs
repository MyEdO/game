// Garde des CANAUX d'outil (#2180) : le répartiteur réel (spawnSync + stdin JSON), sur les formes
// d'entrée de lean-ctx 3.10.2. Aucun fichier n'est écrit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ecriture, lancerHook } from '../guards/lib/lancerHook.mjs'
import { LECTURE, familleLeanCtx } from '../guards/lib/contratGarde.mjs'
import { REGISTRE } from './registre.mjs'
import { CONSIGNE, garde } from './canal-outil-guard.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FICHE = join(REPO, '.claude', 'memory', 'game-sonde-canal.md')
const ECRIT = `echo x > '${FICHE.replace(/\\/g, '/')}'`

/** La décision et la raison du répartiteur pour `tool_name` sur `tool_input`, sur la `surface`. */
function decisionDe(tool_name, tool_input, surface = 'claude') {
  const r = lancerHook('repartiteur.mjs', ecriture(tool_input, tool_name), { surface })
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
    ['ctx_call name → ctx_edit', 'mcp__lean-ctx__ctx_call', { name: 'ctx_edit', arguments: { path: FICHE } }],
    ['ctx_call name → ctx_execute (clé du schéma)', 'mcp__lean-ctx__ctx_call', { name: 'ctx_execute', arguments: { action: 'code', language: 'shell', code: 'echo x' } }],
    ['ctx_call tool ctx_read + name ctx_execute (ambigu)', 'mcp__lean-ctx__ctx_call', { tool: 'ctx_read', name: 'ctx_execute', arguments: { action: 'code', code: 'x' } }],
    ['ctx_call sans name ni tool', 'mcp__lean-ctx__ctx_call', { arguments: { path: FICHE } }],
    ['ctx_call name non-chaîne', 'mcp__lean-ctx__ctx_call', { name: ['ctx_read'], arguments: { path: FICHE } }],
    ['ctx_knowledge export', 'mcp__lean-ctx__ctx_knowledge', { action: 'export', path: FICHE }],
    ['ctx_knowledge import', 'mcp__lean-ctx__ctx_knowledge', { action: 'import', path: FICHE }],
    ['ctx_knowledge EXPORT (casse)', 'mcp__lean-ctx__ctx_knowledge', { action: ' EXPORT ', path: FICHE }],
    ['ctx_knowledge action non-chaîne', 'mcp__lean-ctx__ctx_knowledge', { action: ['export'], path: FICHE }],
    ['ctx_session export', 'mcp__lean-ctx__ctx_session', { action: 'export', path: FICHE }],
    ['ctx_session import', 'mcp__lean-ctx__ctx_session', { action: 'import', path: FICHE }],
    ['ctx_verify proof', 'mcp__lean-ctx__ctx_verify', { action: 'proof' }],
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
    ['ctx_patch op de tête + ops vide', 'mcp__lean-ctx__ctx_patch', { path: join(REPO, 'docs', 'x.md'), op: 'replace_symbol', name: 'f', new_text: 'x', ops: [] }],
    ['ctx_patch op de tête jugeable + ops', 'mcp__lean-ctx__ctx_patch', { path: join(REPO, 'docs', 'x.md'), op: 'create', new_text: 'x', ops: [{ op: 'set_line', line: 1, hash: '00', new_text: 'b' }] }],
    ['ctx_patch ops non-objets', 'mcp__lean-ctx__ctx_patch', { path: join(REPO, 'docs', 'x.md'), ops: ['x', 3] }],
    ['ctx_patch ops non-tableau', 'mcp__lean-ctx__ctx_patch', { path: join(REPO, 'docs', 'x.md'), ops: '[{"op":"create"}]' }],
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
    ['ctx_call name → ctx_read (clé du schéma)', 'mcp__lean-ctx__ctx_call', { name: 'ctx_read', arguments: { path: FICHE } }],
    ['ctx_call name et tool concordants', 'mcp__lean-ctx__ctx_call', { name: 'ctx_read', tool: 'mcp__lean-ctx__ctx_read', arguments: { path: FICHE } }],
    ['ctx_knowledge recall', 'mcp__lean-ctx__ctx_knowledge', { action: 'recall', query: 'x' }],
    ['ctx_session status', 'mcp__lean-ctx__ctx_session', { action: 'status' }],
    ['ctx_verify stats', 'mcp__lean-ctx__ctx_verify', { action: 'stats' }],
    ['ctx_shell anodin', 'mcp__lean-ctx__ctx_shell', { command: 'git status' }],
    ['shell (alias) anodin', 'mcp__lean-ctx__shell', { command: 'git status' }],
    ['ctx_patch create avec path', 'mcp__lean-ctx__ctx_patch', { op: 'create', path: join(REPO, 'docs', 'zz-sonde.md'), new_text: 'x' }],
    ['ctx_patch set_line avec path', 'mcp__lean-ctx__ctx_patch', { op: 'set_line', path: join(REPO, 'docs', 'x.md'), line: 1, hash: '00', new_text: 'x' }],
    ['ctx_patch lot vide', 'mcp__lean-ctx__ctx_patch', { path: FICHE, ops: [] }],
    ['ctx_patch lot seul', 'mcp__lean-ctx__ctx_patch', { path: join(REPO, 'docs', 'x.md'), ops: [{ op: 'set_line', line: 1, hash: '00', new_text: 'b' }] }],
    ['ctx_patch dry_run', 'mcp__lean-ctx__ctx_patch', { op: 'replace_symbol', name: 'f', new_text: 'x', dry_run: true }],
  ]
  for (const [nom, outil, entree] of passent) assert.equal(decisionDe(outil, entree).decision, null, nom)
})

const P = 'mcp__lean-ctx__'

test('DRIVER : la passerelle vers un outil hors `LECTURES_LIBRES` est REFUSÉE quelle que soit la forme de l’appel (imbriqué, aplati, `arguments` null/objet), canal prescrit : l’outil appelé DIRECTEMENT — surfaces claude et codex', () => {
  const cas = [
    ['aplati ctx_knowledge export', { name: 'ctx_knowledge', action: 'export', format: 'okf', path: FICHE }],
    ['aplati ctx_knowledge import', { name: 'ctx_knowledge', action: 'import', path: FICHE, merge: 'replace' }],
    ['aplati ctx_session export', { name: 'ctx_session', action: 'export', value: FICHE }],
    ['aplati ctx_verify proof', { name: 'ctx_verify', action: 'proof' }],
    ['arguments null + action à plat', { name: 'ctx_knowledge', arguments: null, action: 'export', path: FICHE }],
    ['arguments {} + action à plat', { name: 'ctx_knowledge', arguments: {}, action: 'export' }],
    ['imbriqué ctx_knowledge export', { name: 'ctx_knowledge', arguments: { action: 'export', path: FICHE } }],
    ['imbriqué ctx_knowledge arguments non-objet', { name: 'ctx_knowledge', arguments: '{"action":"export"}' }],
    ['imbriqué ctx_knowledge recall (action inoffensive)', { name: 'ctx_knowledge', arguments: { action: 'recall', query: 'x' } }],
    ['aplati ctx_session status (action inoffensive)', { name: 'ctx_session', action: 'status' }],
    ['name avec espace', { name: ' ctx_read', path: FICHE }],
  ]
  for (const surface of ['claude', 'codex']) {
    for (const [nom, entree] of cas) {
      const { decision, raison } = decisionDe(`${P}ctx_call`, entree, surface)
      assert.equal(decision, 'deny', `${surface} : ${nom}`)
      assert.ok(raison.includes(CONSIGNE) && raison.includes(`appeler ${entree.name} DIRECTEMENT`), `${surface} : ${nom} : ${raison}`)
    }
  }
})

test('DRIVER : la passerelle vers un outil de `LECTURES_LIBRES` passe, aplatie comme imbriquée — surfaces claude et codex', () => {
  const passent = [
    ['aplati ctx_read', { name: 'ctx_read', path: FICHE, mode: 'full' }],
    ['imbriqué ctx_read', { name: 'ctx_read', arguments: { path: FICHE } }],
    ['arguments null ctx_read', { name: 'ctx_read', arguments: null, path: FICHE }],
  ]
  for (const surface of ['claude', 'codex'])
    for (const [nom, entree] of passent) assert.equal(decisionDe(`${P}ctx_call`, entree, surface).decision, null, `${surface} : ${nom}`)
})

const DOC = join(REPO, 'docs', 'x.md')
const SRC_NEUF = join(REPO, 'src', 'ui', 'ZzSondeNeuf.tsx')

test('DRIVER : une entrée `ctx_patch` qui porte une clé hors de son schéma MCP, en tête ou dans un élément de `ops[]`, est REFUSÉE avec le canal prescrit — surfaces claude et codex', () => {
  const cas = [
    ['replace_unique + create:true (fichier entier par ctx_edit)', { op: 'replace_unique', path: SRC_NEUF, old_text: 'x', new_text: 'export const A = 1', create: true }, 'create'],
    ['ops[] replace_unique + create:true', { path: SRC_NEUF, ops: [{ op: 'replace_unique', old_text: 'x', new_text: 'export const A = 1', create: true }] }, 'ops[0].create'],
    ['set_line + backup + backup_path (préimage écrite ailleurs)', { op: 'set_line', path: DOC, line: 1, hash: '00', new_text: 'x', backup: true, backup_path: join(REPO, 'src', 'data', 'zz-sonde.json') }, 'backup_path'],
    ['ops[] replace_unique en old_string/new_string', { path: DOC, ops: [{ op: 'replace_unique', old_string: 'a', new_string: 'b' }] }, 'ops[0].old_string'],
    ['dry_run de tête, ops[] replace_unique à dry_run:false', { path: DOC, dry_run: true, ops: [{ op: 'replace_unique', old_text: 'a', new_text: 'b', dry_run: false }] }, 'ops[0].dry_run'],
    ['validate_syntax:false', { op: 'set_line', path: DOC, line: 1, hash: '00', new_text: 'x', validate_syntax: false }, 'validate_syntax'],
    ['content (Write-équivalent) sur ctx_patch', { op: 'replace_unique', path: DOC, old_text: 'a', new_text: 'b', content: 'x' }, 'content'],
  ]
  for (const surface of ['claude', 'codex']) {
    for (const [nom, entree, cle] of cas) {
      const { decision, raison } = decisionDe(`${P}ctx_patch`, entree, surface)
      assert.equal(decision, 'deny', `${surface} : ${nom}`)
      assert.ok(raison.includes(CONSIGNE) && raison.includes('hors du schéma') && raison.includes(cle), `${surface} : ${nom} : ${raison}`)
    }
  }
})

test('CONTRAT : chaque op du schéma `ctx_patch`, avec ses seules clés déclarées, passe au jugement habituel — surfaces claude et codex', () => {
  const ops = [
    ['set_line', { op: 'set_line', path: DOC, line: 1, hash: '00', new_text: 'x' }],
    ['replace_lines', { op: 'replace_lines', path: DOC, start_line: 1, start_hash: '00', end_line: 2, end_hash: '11', new_text: 'x' }],
    ['insert_after', { op: 'insert_after', path: DOC, line: 1, hash: '00', new_text: 'x' }],
    ['delete', { op: 'delete', path: DOC, line: 1, hash: '00' }],
    ['replace_unique', { op: 'replace_unique', path: DOC, old_text: 'a', new_text: 'b' }],
    ['create', { op: 'create', path: join(REPO, 'docs', 'zz-sonde.md'), new_text: 'x' }],
    ['replace_all', { op: 'replace_all', path: DOC, find: 'a', replace: 'b' }],
    ['lot ancré + replace_unique', { path: DOC, ops: [{ op: 'set_line', line: 1, hash: '00', new_text: 'x' }, { op: 'replace_unique', path: DOC, old_text: 'a', new_text: 'b' }] }],
  ]
  for (const surface of ['claude', 'codex'])
    for (const [nom, entree] of ops) assert.equal(decisionDe(`${P}ctx_patch`, entree, surface).decision, null, `${surface} : ${nom}`)
  const { raison } = decisionDe(`${P}ctx_patch`, { op: 'replace_symbol', path: DOC, name: 'f', new_text: 'x' })
  assert.ok(!raison.includes('hors du schéma') && raison.includes('non jugeable'), raison)
})

test('les outils que les sessions utilisent pour LIRE sont classés LECTURE (sinon toute session se bloque)', () => {
  for (const nu of ['ctx_read', 'ctx_search', 'ctx_glob', 'ctx_tree', 'ctx_compose', 'ctx_callgraph', 'ctx_knowledge', 'ctx_session', 'ctx_overview', 'ctx_expand', 'ctx_delta', 'ctx_graph', 'ctx_url_read'])
    assert.equal(familleLeanCtx(nu), LECTURE, nu)
})
