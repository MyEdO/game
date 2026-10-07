// Test du hook `exception-add-guard` (node --test) : les contournements PROUVÉS de l'audit
// adversarial (2026-07-13) échouent désormais, et les cas légitimes restent silencieux.
// Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AVERTISSEMENT, entries, evaluate } from './exception-add-guard.mjs'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { ecriture, lancerHook } from '../guards/lib/lancerHook.mjs'

const GUARD = 'src/state/label-logic-guard.test.ts' // matche `estFichierGarde`
const edit = (before, after, file = GUARD) => evaluate({ file, before, after, isWrite: false, exists: true })
const avertit = (d) => {
  assert.ok(d && typeof d.contexte === 'string', 'attendu : avertissement')
  assert.ok(d.contexte.startsWith(AVERTISSEMENT), d.contexte)
  assert.equal(d.decision, undefined, 'un avertissement ne décide rien')
}
const silent = (d) => assert.equal(d, null, `attendu : silence, obtenu : ${d?.contexte}`)

// ── Contournements PROUVÉS (doivent AVERTIR) ─────────────────────────────────────────────────────
test('bypass (a) : deux entrées quotées PACKÉES sur une seule ligne → détecté', () => {
  const before = 'const W = [\n]'
  const after = "const W = [\n  'x.ts:1', 'y.ts:2',\n]"
  const b = entries(before), a = entries(after)
  assert.equal(a.get('x.ts:1'), 1)
  assert.equal(a.get('y.ts:2'), 1)
  assert.equal(b.get('x.ts:1') ?? 0, 0)
  avertit(edit(before, after))
})

test('bypass (b) : clé d\'objet NON quotée ajoutée → détecté', () => {
  const before = 'const W = {\n}'
  const after = 'const W = {\n  newKey: true,\n}'
  assert.equal(entries(after).get('newKey'), 1)
  avertit(edit(before, after))
})

test('HAUSSE de baseline de cliquet → avertissement', () => {
  const d = edit("const B = { 'components': 3 }", "const B = { 'components': 5 }")
  avertit(d)
  assert.match(d.contexte, /components : 3 → 5/)
})

// ── Cas légitimes (doivent RESTER silencieux) ────────────────────────────────────────────────────
test('CRÉATION d\'un fichier de garde (Write, inexistant) → silence (arbitrage 2026-09-28)', () => {
  silent(evaluate({ file: 'src/ui/relocated-guard.test.ts', before: '', after: "const W = ['a.ts:1']", isWrite: true, exists: false }))
  silent(evaluate({ file: 'scripts/guards/lib/newThing.mjs', before: '', after: "export const x = 'y'", isWrite: true, exists: false }))
})

test('re-pointage (chemin:ligne dont la ligne bouge) → silence', () => {
  silent(edit("const W = [\n  'a/b.ts:10',\n]", "const W = [\n  'a/b.ts:12',\n]"))
})

test('RETRAIT d\'une entrée → silence', () => {
  silent(edit("const W = [\n  'a.ts:1',\n  'b.ts:2',\n]", "const W = [\n  'a.ts:1',\n]"))
})

test('BAISSE de baseline → silence', () => {
  silent(edit("const B = { 'components': 5 }", "const B = { 'components': 3 }"))
})

test('fichier NON gardé (hors motif) → silence même en ajoutant des entrées', () => {
  silent(evaluate({ file: 'src/engine/combat.ts', before: 'const x = []', after: "const x = ['new.ts:1']", isWrite: false, exists: true }))
})

test('Write sur fichier de garde EXISTANT sans ajout net → silence', () => {
  silent(evaluate({ file: GUARD, before: "const W = ['a.ts:1']", after: "const W = ['a.ts:1']", isWrite: true, exists: true }))
})

// ── Driver : le hook garde les fichiers d'un DÉPÔT, et se tait hors de tout arbre git (#1973) ──────────
const TABLE = "export const W = ['a.ts:1']\n"

const AJOUT = "export const W = ['a.ts:1', 'b.ts:2']\n"

/** Sortie RÉELLE du répartiteur (`spawnSync` + stdin JSON) pour un Write de `content` sur `file_path`. */
function sortieDuWrite(file_path, content = TABLE) {
  const run = lancerHook('repartiteur.mjs', ecriture({ file_path, content }))
  assert.equal(run.code, 0, run.err)
  return { decision: run.specifique?.permissionDecision ?? null, contexte: run.specifique?.additionalContext ?? '' }
}
/** Un fichier de garde EXISTANT (`TABLE`) dans `dossier`, re-sauvé avec une entrée de plus. */
function ajoutDansGarde(dossier) {
  const cible = join(dossier, 'run-guard.test.mjs')
  writeFileSync(cible, TABLE)
  return sortieDuWrite(cible, AJOUT)
}

test('DRIVER : une entrée ajoutée à un fichier de garde DANS un dépôt → avertissement sans décision ; hors dépôt (scratchpad) → silence', () => {
  const { racine } = instanceDeDepot()
  const scratch = mkdtempSync(join(tmpdir(), 'wfrp-scratch-'))
  try {
    const dedans = ajoutDansGarde(racine)
    assert.equal(dedans.decision, null)
    assert.ok(dedans.contexte.includes(AVERTISSEMENT), dedans.contexte)
    assert.match(dedans.contexte, /b\.ts:2/)
    assert.deepEqual(ajoutDansGarde(scratch), { decision: null, contexte: '' })
    assert.deepEqual(sortieDuWrite(join(racine, 'neuf-guard.mjs')), { decision: null, contexte: '' }, 'création : silence')
  } finally {
    rmSync(racine, { recursive: true, force: true })
    rmSync(scratch, { recursive: true, force: true })
  }
})

test('DRIVER : un fichier de garde EXISTANT décide pareil en natif et en MSYS (sans ajout : silence ; avec : avertissement)', { skip: process.platform !== 'win32' }, () => {
  const { racine } = instanceDeDepot()
  try {
    const cible = join(racine, 'run-guard.test.mjs')
    writeFileSync(cible, TABLE)
    const msys = '/' + cible[0].toLowerCase() + cible.slice(2).replace(/\\/g, '/')
    for (const [chemin, surface] of [[cible, 'natif'], [msys, 'MSYS']]) {
      assert.deepEqual(sortieDuWrite(chemin), { decision: null, contexte: '' }, surface)
      assert.ok(sortieDuWrite(chemin, AJOUT).contexte.includes(AVERTISSEMENT), surface)
    }
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('DRIVER : ctx_patch (old_text/new_text, find/replace, lot `ops`) avertit comme Edit', () => {
  const { racine } = instanceDeDepot()
  try {
    const cible = join(racine, 'run-guard.test.mjs')
    writeFileSync(cible, TABLE)
    const contexte = (tool_input, tool_name = 'mcp__lean-ctx__ctx_patch') => lancerHook('repartiteur.mjs', ecriture(tool_input, tool_name)).specifique?.additionalContext ?? ''
    const edit = contexte({ file_path: cible, old_string: TABLE, new_string: AJOUT }, 'Edit')
    assert.ok(edit.includes(AVERTISSEMENT), edit)
    assert.equal(contexte({ op: 'replace_unique', path: cible, old_text: TABLE, new_text: AJOUT }), edit)
    assert.equal(contexte({ op: 'replace_all', path: cible, find: TABLE, replace: AJOUT }), edit)
    assert.equal(contexte({ ops: [{ op: 'set_line', path: cible, line: 1, hash: '00', new_text: AJOUT.trimEnd() }, { op: 'set_line', path: cible, line: 1, hash: '00', new_text: AJOUT.trimEnd() }] }), edit)
    assert.equal(contexte({ op: 'create', path: join(racine, 'neuf-guard.mjs'), new_text: AJOUT }), '', 'création : silence')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('DRIVER : une op ANCRÉE qui ré-écrit une entrée déjà présente → silence ; qui en ajoute une → avertissement', () => {
  const { racine } = instanceDeDepot()
  try {
    const cible = join(racine, 'run-guard.test.mjs')
    writeFileSync(cible, TABLE)
    const contexte = (tool_input) => lancerHook('repartiteur.mjs', ecriture(tool_input, 'mcp__lean-ctx__ctx_patch')).specifique?.additionalContext ?? ''
    assert.equal(contexte({ op: 'set_line', path: cible, line: 1, hash: '00', new_text: TABLE.trimEnd() }), '')
    assert.ok(contexte({ op: 'set_line', path: cible, line: 1, hash: '00', new_text: AJOUT.trimEnd() }).includes(AVERTISSEMENT))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('DRIVER : un lot `ops` que lean-ctx n’applique pas à UNE préimage (op ancrée après une déléguée, ou deux `path` d’un même fichier) est REFUSÉ ; un lot ancré à un `path`, ou ancré puis délégué, reste jugé — surfaces claude et codex', () => {
  const { racine } = instanceDeDepot()
  try {
    const cible = join(racine, 'tables-guard.test.mjs')
    const autre = join(racine, 'autre-guard.test.mjs')
    const table = "export const EXC_B = [\n  'src/b.ts',\n]\nexport const EXC_A = [\n  'src/a.ts',\n]\n"
    writeFileSync(cible, table)
    writeFileSync(autre, table)
    const ajout = "// B bis\n// B ter\nexport const EXC_B = [\n  'src/b.ts',\n  'src/a.ts',"
    const refuses = [
      ['déléguée puis ancrée', { path: cible, ops: [
        { op: 'replace_unique', old_text: 'export const EXC_B = [', new_text: '// B\n// B bis\n// B ter\nexport const EXC_B = [' },
        { op: 'replace_lines', start_line: 2, end_line: 5, new_text: ajout },
      ] }],
      ['deux runs ancrés séparés par une déléguée sur un autre fichier', { path: cible, ops: [
        { op: 'insert_after', line: 0, new_text: '// B\n// B bis\n// B ter' },
        { op: 'replace_unique', path: autre, old_text: 'EXC_A', new_text: 'EXC_Z' },
        { op: 'replace_lines', start_line: 2, end_line: 5, new_text: ajout },
      ] }],
      ['deux `path` du même fichier', { ops: [
        { op: 'insert_after', path: cible, line: 0, new_text: '// B\n// B bis\n// B ter' },
        { op: 'replace_lines', path: `${racine}/./tables-guard.test.mjs`, start_line: 2, end_line: 5, new_text: ajout },
      ] }],
    ]
    for (const surface of ['claude', 'codex']) {
      const sortie = (tool_input) => lancerHook('repartiteur.mjs', ecriture(tool_input, 'mcp__lean-ctx__ctx_patch'), { surface }).specifique ?? {}
      for (const [nom, entree] of refuses) assert.equal(sortie(entree).permissionDecision, 'deny', `${surface} : ${nom}`)
      const ancre = sortie({ path: cible, ops: [{ op: 'replace_lines', start_line: 1, end_line: 2, new_text: "export const EXC_B = [\n  'src/b.ts',\n  'src/a.ts'," }] })
      assert.equal(ancre.permissionDecision, undefined, `${surface} : lot ancré`)
      assert.ok((ancre.additionalContext ?? '').includes(AVERTISSEMENT), `${surface} : lot ancré jugé : ${ancre.additionalContext}`)
      const ancreePuisDeleguee = sortie({ path: cible, ops: [
        { op: 'set_line', line: 1, hash: '00', new_text: 'export const EXC_B = [' },
        { op: 'replace_unique', old_text: "export const EXC_A = [\n  'src/a.ts',", new_text: "export const EXC_A = [\n  'src/a.ts',\n  'src/c.ts'," },
      ] })
      assert.equal(ancreePuisDeleguee.permissionDecision, undefined, `${surface} : ancrée puis déléguée`)
      assert.ok((ancreePuisDeleguee.additionalContext ?? '').includes(AVERTISSEMENT), `${surface} : déléguée jugée : ${ancreePuisDeleguee.additionalContext}`)
    }
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
