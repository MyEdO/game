// Test du hook `exception-add-guard` (node --test) : les contournements PROUVÉS de l'audit
// adversarial (2026-07-13) échouent désormais, et les cas légitimes restent silencieux.
// Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { entries, evaluate } from './exception-add-guard.mjs'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'

const GUARD = 'src/state/label-logic-guard.test.ts' // matche `estFichierGarde`
const edit = (before, after, file = GUARD) => evaluate({ file, before, after, isWrite: false, exists: true })
const asks = (d) => assert.ok(d && typeof d.reason === 'string', 'attendu : ask')
const silent = (d) => assert.equal(d, null, `attendu : silence, obtenu : ${d?.reason}`)

// ── Contournements PROUVÉS (doivent ASK) ─────────────────────────────────────────────────────────
test('bypass (a) : deux entrées quotées PACKÉES sur une seule ligne → détecté', () => {
  const before = 'const W = [\n]'
  const after = "const W = [\n  'x.ts:1', 'y.ts:2',\n]"
  const b = entries(before), a = entries(after)
  assert.equal(a.get('x.ts:1'), 1)
  assert.equal(a.get('y.ts:2'), 1)
  assert.equal(b.get('x.ts:1') ?? 0, 0)
  asks(edit(before, after))
})

test('bypass (b) : clé d\'objet NON quotée ajoutée → détecté', () => {
  const before = 'const W = {\n}'
  const after = 'const W = {\n  newKey: true,\n}'
  assert.equal(entries(after).get('newKey'), 1)
  asks(edit(before, after))
})

test('bypass (c) : CRÉATION d\'un fichier de garde (Write, inexistant) → ask systématique', () => {
  const d = evaluate({ file: 'src/ui/relocated-guard.test.ts', before: '', after: 'anything', isWrite: true, exists: false })
  asks(d)
  assert.match(d.reason, /création d'un fichier de garde/)
})

test('CRÉATION d\'une lib guards/ neuve → ask', () => {
  asks(evaluate({ file: 'scripts/guards/lib/newThing.mjs', before: '', after: 'export const x = 1', isWrite: true, exists: false }))
})

test('HAUSSE de baseline de cliquet → ask', () => {
  asks(edit("const B = { 'components': 3 }", "const B = { 'components': 5 }"))
})

// ── Cas légitimes (doivent RESTER silencieux) ────────────────────────────────────────────────────
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

/** Décision RÉELLE du hook (`spawnSync` + stdin JSON) pour un Write de `TABLE` sur `file_path`. */
function decisionDuWrite(file_path) {
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('./exception-add-guard.mjs', import.meta.url))], {
    input: JSON.stringify({ tool_input: { file_path, content: TABLE } }),
    encoding: 'utf8',
  })
  assert.equal(run.status, 0, run.stderr)
  return run.stdout.trim() ? JSON.parse(run.stdout).hookSpecificOutput.permissionDecision : null
}
const creationDeGarde = (dossier) => decisionDuWrite(join(dossier, 'run-guard.mjs'))

test('DRIVER : créer un fichier de garde DANS un dépôt → ask ; le même hors dépôt (scratchpad) → silence', () => {
  const { racine } = instanceDeDepot()
  const scratch = mkdtempSync(join(tmpdir(), 'wfrp-scratch-'))
  try {
    assert.equal(creationDeGarde(racine), 'ask')
    assert.equal(creationDeGarde(scratch), null)
  } finally {
    rmSync(racine, { recursive: true, force: true })
    rmSync(scratch, { recursive: true, force: true })
  }
})

test('DRIVER : un fichier de garde EXISTANT re-sauvé sans ajout décide pareil en natif et en MSYS (silence)', { skip: process.platform !== 'win32' }, () => {
  const { racine } = instanceDeDepot()
  try {
    const cible = join(racine, 'run-guard.mjs')
    writeFileSync(cible, TABLE)
    assert.equal(decisionDuWrite(cible), null, 'natif')
    assert.equal(decisionDuWrite('/' + cible[0].toLowerCase() + cible.slice(2).replace(/\\/g, '/')), null, 'MSYS')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
