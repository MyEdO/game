// Garde des CANAUX d'outil (#2180) : le répartiteur réel (spawnSync + stdin JSON), sur les formes
// d'entrée de lean-ctx `LEAN_CTX_VERSION` (`scripts/guards/lib/contratGarde.mjs`). Aucun fichier n'est écrit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ecriture, lancerHook } from '../guards/lib/lancerHook.mjs'
import { LEAN_CTX_VERSION, LECTURE, familleLeanCtx } from '../guards/lib/contratGarde.mjs'
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
    ['ctx_shell anodin', 'mcp__lean-ctx__ctx_shell', { command: 'git status', cwd: REPO }],
    ['shell (alias) anodin', 'mcp__lean-ctx__shell', { command: 'git status', cwd: REPO }],
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
    ['ops[] set_line + create:true', { path: SRC_NEUF, ops: [{ op: 'set_line', line: 1, hash: '00', new_text: 'export const A = 1', create: true }] }, 'ops[0].create'],
    ['set_line + backup + backup_path (préimage écrite ailleurs)', { op: 'set_line', path: DOC, line: 1, hash: '00', new_text: 'x', backup: true, backup_path: join(REPO, 'src', 'data', 'zz-sonde.json') }, 'backup_path'],
    ['ops[] set_line en old_string', { path: DOC, ops: [{ op: 'set_line', line: 1, hash: '00', new_text: 'b', old_string: 'a' }] }, 'ops[0].old_string'],
    ['dry_run de tête, ops[] set_line à dry_run:false', { path: DOC, dry_run: true, ops: [{ op: 'set_line', line: 1, hash: '00', new_text: 'b', dry_run: false }] }, 'ops[0].dry_run'],
    ['validate_syntax:false', { op: 'set_line', path: DOC, line: 1, hash: '00', new_text: 'x', validate_syntax: false }, 'validate_syntax'],
    ['content (Write-équivalent) sur ctx_patch', { op: 'replace_unique', path: DOC, old_text: 'a', new_text: 'b', content: 'x' }, 'content'],
    ['ops[] set_line + old_text (clé d’une autre op)', { path: DOC, ops: [{ op: 'set_line', line: 1, hash: '00', new_text: 'x', old_text: 'y' }] }, 'ops[0].old_text'],
    ['delete aux deux formes', { op: 'delete', path: DOC, line: 1, hash: '00', start_line: 2, start_hash: '11', end_line: 3, end_hash: '22' }, 'line'],
    ['op absente', { path: DOC, new_text: 'x' }, 'op absente'],
    ['op inconnue', { op: 'rewrite', path: DOC, new_text: 'x' }, 'op "rewrite" inconnue'],
    ['op de tête à côté de ops[]', { path: DOC, op: 'set_line', ops: [{ op: 'set_line', line: 1, hash: '00', new_text: 'x' }] }, 'op'],
  ]
  for (const surface of ['claude', 'codex']) {
    for (const [nom, entree, cle] of cas) {
      const { decision, raison } = decisionDe(`${P}ctx_patch`, entree, surface)
      assert.equal(decision, 'deny', `${surface} : ${nom}`)
      assert.ok(raison.includes(CONSIGNE) && raison.includes('hors du schéma') && raison.includes(cle), `${surface} : ${nom} : ${raison}`)
    }
  }
})

test('DRIVER : un `old_text` que l’op ne consomme pas (`replace_all`, `set_line`) est REFUSÉ, et le texte remplacé que lisent les gardes d’écriture est celui de l’op — surfaces claude et codex', () => {
  const POINTEUR = '- reste à traiter #1591 après la vague\n'
  const cas = [
    ['replace_all + old_text', { op: 'replace_all', path: DOC, find: 'foo', old_text: POINTEUR, replace: POINTEUR }],
    ['set_line + old_text', { op: 'set_line', path: DOC, line: 1, hash: '00', new_text: POINTEUR, old_text: POINTEUR }],
  ]
  for (const surface of ['claude', 'codex']) {
    for (const [nom, entree] of cas) {
      const { decision, raison } = decisionDe(`${P}ctx_patch`, entree, surface)
      assert.equal(decision, 'deny', `${surface} : ${nom}`)
      assert.ok(raison.includes(CONSIGNE) && raison.includes('hors du schéma') && raison.includes('old_text'), `${surface} : ${nom} : ${raison}`)
      const post = lancerHook('repartiteur.mjs', ecriture(entree, `${P}ctx_patch`, 'PostToolUse'), { surface })
      assert.equal(post.code, 0, post.err)
      assert.match(post.specifique?.additionalContext ?? '', /POINTEUR/, `${surface} : ${nom}`)
    }
  }
})

test('DRIVER : `dry_run` et `ops` ne se lisent que sur `ctx_patch` — un `Write` qui les porte reste UNE écriture, jugée et refusée ; `ctx_patch` `dry_run` n’écrit rien — surfaces claude et codex', () => {
  const composant = 'export const A = 1\n'
  const cas = [
    ['Write + dry_run:true', { file_path: SRC_NEUF, content: composant, dry_run: true }],
    ['Write + ops[]', { file_path: SRC_NEUF, content: composant, ops: [{ op: 'set_line', path: DOC, line: 1, hash: '00', new_text: 'x' }] }],
  ]
  for (const surface of ['claude', 'codex']) {
    assert.equal(decisionDe('Write', { file_path: SRC_NEUF, content: composant }, surface).decision, 'deny', `${surface} : témoin Write`)
    for (const [nom, entree] of cas) assert.equal(decisionDe('Write', entree, surface).decision, 'deny', `${surface} : ${nom}`)
    assert.equal(decisionDe(`${P}ctx_patch`, { op: 'create', path: SRC_NEUF, new_text: composant, dry_run: true }, surface).decision, null, `${surface} : ctx_patch create dry_run`)
  }
})

test('CONTRAT : chaque op du schéma `ctx_patch`, avec ses seules clés déclarées, passe au jugement habituel — surfaces claude et codex', () => {
  const ops = [
    ['set_line', { op: 'set_line', path: DOC, line: 1, hash: '00', new_text: 'x' }],
    ['replace_lines', { op: 'replace_lines', path: DOC, start_line: 1, start_hash: '00', end_line: 2, end_hash: '11', new_text: 'x' }],
    ['insert_after', { op: 'insert_after', path: DOC, line: 1, hash: '00', new_text: 'x' }],
    ['delete', { op: 'delete', path: DOC, line: 1, hash: '00' }],
    ['delete (plage)', { op: 'delete', path: DOC, start_line: 1, start_hash: '00', end_line: 2, end_hash: '11' }],
    ['replace_unique', { op: 'replace_unique', path: DOC, old_text: 'a', new_text: 'b' }],
    ['create', { op: 'create', path: join(REPO, 'docs', 'zz-sonde.md'), new_text: 'x' }],
    ['replace_all', { op: 'replace_all', path: DOC, find: 'a', replace: 'b' }],
    ['lot ancré à un path', { path: DOC, ops: [{ op: 'set_line', line: 1, hash: '00', new_text: 'x' }, { op: 'replace_lines', path: DOC, start_line: 3, end_line: 4, new_text: 'y' }] }],
  ]
  for (const surface of ['claude', 'codex'])
    for (const [nom, entree] of ops) assert.equal(decisionDe(`${P}ctx_patch`, entree, surface).decision, null, `${surface} : ${nom}`)
  for (const [nom, entree] of [
    ['replace_symbol en tête', { op: 'replace_symbol', path: DOC, name: 'f', new_text: 'x' }],
    ['replace_symbol dans ops[]', { path: DOC, ops: [{ op: 'replace_symbol', name: 'f', new_text: 'x' }] }],
  ]) {
    const { raison } = decisionDe(`${P}ctx_patch`, entree)
    assert.ok(!raison.includes('hors du schéma') && raison.includes('non jugeable'), `${nom} : ${raison}`)
  }
})

test('SCHÉMA lean-ctx « Cross-file ops[] batch (incl. replace_unique) supported; replace_all and create must be sent as separate top-level calls, not inside ops[] » — surfaces claude et codex', () => {
  const ancree = { op: 'set_line', line: 1, hash: '00', new_text: 'x' }
  const contreTemoins = [
    ['replace_all dans ops[]', { path: DOC, ops: [{ op: 'replace_all', find: 'a', replace: 'b' }] }, 'ops[0].op replace_all hors lot'],
    ['create dans ops[]', { path: DOC, ops: [{ op: 'create', new_text: 'x' }] }, 'ops[0].op create hors lot'],
    ['déléguée puis ancrée', { path: DOC, ops: [{ op: 'replace_unique', old_text: 'a', new_text: 'b' }, ancree] }, 'ambigu'],
    ['A : ancrée puis déléguée à old_text vide', { path: DOC, ops: [ancree, { op: 'replace_unique', old_text: '', new_text: 'b' }] }, 'ops[1].old_text vide'],
    ['B : ancrée puis déléguée sans new_text', { path: DOC, ops: [ancree, { op: 'replace_unique', old_text: '' }] }, 'ops[1].new_text absente'],
    ['C : ancrée puis déléguée à old_text non-chaîne', { path: DOC, ops: [ancree, { op: 'replace_unique', old_text: 5, new_text: 'b' }] }, 'ops[1].old_text non-chaîne'],
    ['D : déléguée valide puis déléguée sans new_text', { path: DOC, ops: [{ op: 'replace_unique', old_text: 'a', new_text: 'b' }, { op: 'replace_unique', old_text: 'c' }] }, 'ops[1].new_text absente'],
  ]
  for (const surface of ['claude', 'codex']) {
    assert.equal(decisionDe(`${P}ctx_patch`, { path: DOC, ops: [{ op: 'replace_unique', old_text: 'a', new_text: 'b' }] }, surface).decision, null, `${surface} : replace_unique dans ops[]`)
    for (const [nom, entree, motif] of contreTemoins) {
      const { decision, raison } = decisionDe(`${P}ctx_patch`, entree, surface)
      assert.equal(decision, 'deny', `${surface} : ${nom}`)
      assert.ok(raison.includes(motif), `${surface} : ${nom} : ${raison}`)
      if (/^[A-D] :/.test(nom)) assert.ok(raison.includes('hors du schéma'), `${surface} : ${nom} : ${raison}`)
    }
    const { raison } = decisionDe(`${P}ctx_patch`, { op: 'replace_unique', path: DOC, old_text: 'a' }, surface)
    assert.ok(!raison.includes('new_text'), `${surface} : replace_unique de tête sans new_text : ${raison}`)
  }
})

test('les outils que les sessions utilisent pour LIRE sont classés LECTURE (sinon toute session se bloque)', () => {
  for (const nu of ['ctx_read', 'ctx_search', 'ctx_glob', 'ctx_tree', 'ctx_compose', 'ctx_callgraph', 'ctx_knowledge', 'ctx_session', 'ctx_overview', 'ctx_expand', 'ctx_delta', 'ctx_graph', 'ctx_url_read'])
    assert.equal(familleLeanCtx(nu), LECTURE, nu)
})

test('le lean-ctx de l’hôte est `LEAN_CTX_VERSION`, celle aux sources de laquelle le classement est audité', (t) => {
  const r = spawnSync('lean-ctx', ['--version'], { encoding: 'utf8', timeout: 20000 })
  if (r.error?.code === 'ENOENT') return t.skip('lean-ctx absent de l’hôte (CI) : version non confrontée')
  assert.equal(r.status, 0, r.error?.message ?? r.stderr)
  const version = /lean-ctx (\S+)/.exec(r.stdout)?.[1]
  assert.equal(version, LEAN_CTX_VERSION.version,
    `lean-ctx ${version} ≠ LEAN_CTX_VERSION ${LEAN_CTX_VERSION.version} (tag ${LEAN_CTX_VERSION.tag}) : re-auditer FAMILLES_LEAN_CTX et OPS_CTX_PATCH (scripts/guards/lib/contratGarde.mjs) aux sources du tag de ${version}, puis porter sa version et son tag dans LEAN_CTX_VERSION`)
})
