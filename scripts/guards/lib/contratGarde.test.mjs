// Bancs des lectures partagées du contrat des gardes (`scripts/guards/lib/contratGarde.mjs`) : le
// chemin d'écriture résolu UNE fois, hors du contenu versionné sur preuve positive seulement (#1973).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cheminDEcriture, commandeDe, ecrituresDe, normaliserNomOutil, nomLeanCtx, outilCouvert, OUTILS_ECRITURE, OUTILS_CREATION, OUTILS_SHELL, MOTIF_LEAN_CTX, texteAvant, texteNeuf, texteRemplace, ecritLeFichierEntier } from './contratGarde.mjs'
import { instanceDeDepot } from './depotGabarit.mjs'

/** Graphie MSYS (`/c/Users/…`) d'un chemin win32 absolu. */
const versMsys = (p) => '/' + p[0].toLowerCase() + p.slice(2).replace(/\\/g, '/')
const ecriture = (file_path, opts) => cheminDEcriture({ file_path }, { base: tmpdir(), ...opts })

test('outils natifs : graphies MCP actives partagent le contrat et apply_patch est une écriture complète', () => {
  for (const prefixe of ['mcp__lean-ctx__', 'mcp__lean_ctx__']) {
    assert.equal(nomLeanCtx(prefixe + 'ctx_shell'), 'ctx_shell')
    assert.equal(normaliserNomOutil(prefixe + 'ctx_shell'), 'mcp__lean-ctx__ctx_shell')
    assert.ok(outilCouvert(OUTILS_SHELL, prefixe + 'ctx_shell'))
    assert.ok(outilCouvert([MOTIF_LEAN_CTX], prefixe + 'ctx_inconnu'))
  }
  assert.ok(OUTILS_ECRITURE.includes('apply_patch'))
  assert.ok(OUTILS_CREATION.includes('apply_patch'))
  assert.equal(commandeDe({ tool_name: 'apply_patch', tool_input: { command: 'git commit' } }), '')
  const op = { path: '/f', content: 'après entier', old_string: 'avant entier' }
  assert.deepEqual(ecrituresDe({ ecritures: [op] }), [op])
  assert.equal(texteAvant(op, () => 'disque'), 'avant entier')
  assert.equal(texteRemplace(op), 'avant entier')
  assert.equal(texteNeuf(op), 'après entier')
  assert.ok(ecritLeFichierEntier(op))
})

test('cheminDEcriture : dans un dépôt, racine + relatif, contenu versionné — graphie native ou MSYS', () => {
  const { racine } = instanceDeDepot()
  try {
    const cible = join(racine, 'src', 'data', 'x.json')
    const natif = ecriture(cible)
    assert.equal(natif.horsContenu, false)
    assert.equal(natif.relatif, 'src/data/x.json')
    assert.notEqual(natif.racine, null)
    if (process.platform === 'win32') assert.deepEqual(ecriture(versMsys(cible)), natif, 'MSYS = natif')
    assert.equal(cheminDEcriture({ path: cible }, { base: racine }).horsContenu, false, '`path` quand `file_path` manque')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('cheminDEcriture : hors de tout arbre → `horsContenu`, graphie native, MSYS, ou relatif résolu contre `base`', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'wfrp-scratch-'))
  const { racine } = instanceDeDepot()
  try {
    const vu = ecriture(join(scratch, 'note.md'))
    assert.equal(vu.horsContenu, true)
    assert.equal(vu.racine, null)
    if (process.platform === 'win32') assert.equal(ecriture(versMsys(join(scratch, 'note.md'))).horsContenu, true, 'MSYS')
    assert.equal(ecriture('note.md', { base: scratch }).horsContenu, true, 'relatif, base hors dépôt')
    assert.equal(ecriture('src/data/x.json', { base: racine }).horsContenu, false, 'relatif, base dans un dépôt')
  } finally {
    rmSync(scratch, { recursive: true, force: true })
    rmSync(racine, { recursive: true, force: true })
  }
})

test('cheminDEcriture : IGNORÉ par git → `horsContenu` ; un fichier SUIVI qu’un motif couvre reste du contenu', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'public/suivi.json': '{}\n', '.gitignore': '.claude/*\n!.claude/memory/\n' } })
  try {
    // Le motif posé APRÈS le commit couvre un fichier déjà suivi : `git check-ignore` sans `--no-index`
    // ne le compte pas ignoré.
    writeFileSync(join(racine, '.gitignore'), '.claude/*\n!.claude/memory/\npublic/\n')
    const vu = ecriture(join(racine, '.claude', 'worktrees', 'agent-x', 'src', 'a.ts'))
    assert.equal(vu.horsContenu, true, 'worktree mort sous `.claude/`')
    assert.notEqual(vu.racine, null, 'dans un dépôt : le verdict vient de git, pas de la racine')
    assert.equal(ecriture(join(racine, '.claude', 'memory', 'x.md')).horsContenu, false, '`!.claude/memory/`')
    assert.equal(ecriture(join(racine, 'public', 'suivi.json')).horsContenu, false, 'suivi sous un motif')
    assert.equal(ecriture(join(racine, 'public', 'neuf.json')).horsContenu, true, 'neuf sous un motif')
    if (process.platform === 'win32') {
      assert.equal(ecriture(versMsys(join(racine, '.claude', 'worktrees', 'x.md'))).horsContenu, true, 'MSYS')
    }
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('cheminDEcriture : sans preuve positive, le hook garde — aucun chemin, lecteur absent', () => {
  assert.equal(cheminDEcriture({}, { base: tmpdir() }), null)
  assert.equal(ecriture(''), null)
  const absent = process.platform === 'win32'
    ? [...'ZYXWVUTSRQPONMLKJIHGFE'].find((l) => !existsSync(`${l}:\\`))
    : null
  if (absent) assert.equal(ecriture(`${absent}:\\nope\\x.json`).horsContenu, false, `lecteur ${absent}: absent`)
})
