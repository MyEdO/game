// Volet POINTEUR DÉRÉFÉRENCÉ du hook au stylo : une note de `.claude/**` ou `docs/**` qui cite un
// ticket par son seul numéro se relit sans savoir de quoi il s'agit. Le hook est lancé POUR DE VRAI
// (spawnSync + stdin JSON) ; il n'écrit rien et ne décide rien (PostToolUse = contexte).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const HOOK = join(REPO, 'scripts', 'hooks', 'poison-postcheck.mjs')

/** Contexte RENDU par le hook (`''` s'il se tait). */
function contexteDe(tool_input, env = process.env) {
  const run = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input }), encoding: 'utf8', cwd: REPO, env,
  })
  assert.equal(run.status, 0, 'le hook a quitté en ' + run.status + ' : ' + run.stderr)
  if (!run.stdout.trim()) return ''
  return JSON.parse(run.stdout).hookSpecificOutput.additionalContext
}

test('un numéro de ticket NU écrit dans docs/ est signalé, avec la ligne fautive', () => {
  const ctx = contexteDe({
    file_path: join(REPO, 'docs', 'plans', 'exemple.md'),
    old_string: '',
    new_string: '- reste à traiter #1591 après la vague\n',
  })
  assert.match(ctx, /POINTEUR DÉRÉFÉRENCÉ/)
  assert.match(ctx, /#1591/)
  assert.match(ctx, /gh issue view/)
})

test('le TITRE recollé sur la même ligne suffit (guillemets ou parenthèse)', () => {
  const cite = { file_path: join(REPO, '.claude', 'memory', 'exemple.md'), old_string: '' }
  assert.equal(contexteDe({ ...cite, new_string: '- #1591 « garde de capture des runners » : posé\n' }), '')
  assert.equal(contexteDe({ ...cite, new_string: '- #1591 (garde de capture des runners) : posé\n' }), '')
})

test('hors .claude/ et docs/, et sur une ligne INCHANGÉE, le volet se tait', () => {
  assert.equal(contexteDe({
    file_path: join(REPO, 'server', 'notes.md'), old_string: '', new_string: 'voir #1591\n',
  }), '')
  assert.equal(contexteDe({
    file_path: join(REPO, 'docs', 'plans', 'exemple.md'),
    old_string: 'voir #1591\nautre', new_string: 'voir #1591\nautre chose',
  }), '', 'seules les lignes AJOUTÉES comptent')
})

// Le hook garde le contenu d'un DÉPÔT : un `scripts/x.mjs` du scratchpad (hors de tout arbre git) ne
// le regarde pas (#1973). Le fichier est RÉEL — le volet poison lit le disque.
test('un fichier scanné DANS un dépôt est jugé ; le même hors dépôt (scratchpad) → silence', () => {
  const tombale = '// ancien' + 'nement dans foo.mjs\nexport const a = 1\n'
  const poser = (dossier) => {
    const cible = join(dossier, 'scripts', 'x.mjs')
    mkdirSync(dirname(cible), { recursive: true })
    writeFileSync(cible, tombale)
    return contexteDe({ file_path: cible, content: tombale })
  }
  const { racine } = instanceDeDepot()
  const scratch = mkdtempSync(join(tmpdir(), 'wfrp-scratch-'))
  try {
    assert.match(poser(racine), /POISON pierre tombale/)
    assert.equal(poser(scratch), '')
  } finally {
    rmSync(racine, { recursive: true, force: true })
    rmSync(scratch, { recursive: true, force: true })
  }
})

// La mémoire de session s'écrit par une JONCTION vers `<dépôt>/.claude/memory` (#1973) : la note se
// juge sous son chemin RÉEL, relatif à l'arbre qui la contient.
test('une note écrite PAR UNE JONCTION vers la mémoire d’un dépôt forgé est suivie', () => {
  const { racine } = instanceDeDepot()
  const dehors = mkdtempSync(join(tmpdir(), 'wfrp-projets-'))
  try {
    const memoire = join(racine, '.claude', 'memory')
    mkdirSync(memoire, { recursive: true })
    const jonction = join(dehors, 'memory')
    symlinkSync(memoire, jonction, 'junction')
    assert.match(contexteDe({
      file_path: join(jonction, 'exemple.md'), old_string: '', new_string: 'voir #1591\n',
    }), /POINTEUR DÉRÉFÉRENCÉ/)
  } finally {
    rmSync(dehors, { recursive: true, force: true })
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un fichier scanné EXISTANT décide pareil en natif et en MSYS (le disque se lit au chemin réel)', { skip: process.platform !== 'win32' }, () => {
  const tombale = '// dépla' + 'cé vers src/engine/y.ts\nexport const a = 1\n'
  const { racine } = instanceDeDepot()
  try {
    const cible = join(racine, 'src', 'engine', 'x.ts')
    mkdirSync(dirname(cible), { recursive: true })
    writeFileSync(cible, tombale)
    const msys = '/' + cible[0].toLowerCase() + cible.slice(2).replace(/\\/g, '/')
    assert.match(contexteDe({ file_path: cible, content: tombale }), /POISON pierre tombale/, 'natif')
    assert.match(contexteDe({ file_path: msys, content: tombale }), /POISON pierre tombale/, 'MSYS')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('le fichier est rapporté sous son chemin COMPLET relatif à la racine, même imbriqué (`scripts/x/src/y.mjs`)', () => {
  const tombale = '// ancien' + 'nement dans foo.mjs\nexport const a = 1\n'
  const { racine } = instanceDeDepot()
  try {
    const cible = join(racine, 'scripts', 'x', 'src', 'y.mjs')
    mkdirSync(dirname(cible), { recursive: true })
    writeFileSync(cible, tombale)
    assert.match(contexteDe({ file_path: cible, content: tombale }), /POISON pierre tombale \(règle 6c, tolérance zéro\) — scripts\/x\/src\/y\.mjs:1 /)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// Une note n'est suivie que si git la suit : un dossier de worktree mort (sans `.git`) remonte au dépôt
// qui l'héberge, où `.claude/*` est ignoré.
test('une note IGNORÉE par git (worktree mort sous `.claude/`) → silence', () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '.claude/*\n' } })
  try {
    assert.equal(contexteDe({
      file_path: join(racine, '.claude', 'worktrees', 'agent-x', 'README.md'), old_string: '', new_string: 'voir #1591\n',
    }), '')
    assert.match(contexteDe({
      file_path: join(racine, 'docs', 'note.md'), old_string: '', new_string: 'voir #1591\n',
    }), /POINTEUR DÉRÉFÉRENCÉ/, 'une note suivie du même dépôt reste signalée')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// Git introuvable : rien ne prouve l'ignorance (`cheminDEcriture`, `horsContenu`), le hook garde.
test('git INDISPONIBLE : une note que git ignorerait est jugée, le pointeur est émis', () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '.claude/*\n' } })
  try {
    const note = { file_path: join(racine, '.claude', 'worktrees', 'agent-x', 'n.md'), old_string: '', new_string: 'voir #1591\n' }
    const sansGit = { ...process.env, PATH: dirname(process.execPath), Path: dirname(process.execPath) }
    assert.match(contexteDe(note, sansGit), /POINTEUR DÉRÉFÉRENCÉ/)
    assert.equal(contexteDe(note), '', 'git présent : ignorée, silence')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('le périmètre se juge sur le chemin RELATIF à la racine du dépôt, jamais sur une sous-chaîne du chemin absolu', () => {
  // Un worktree lié vit sous `.claude/worktrees/<agent>/` : par sous-chaîne, tout fichier y serait
  // une note suivie. Le même défaut se reproduit sans worktree avec un dossier `.claude/` ou `docs/`
  // NON racine — c'est la forme mordue ici, identique en arbre principal et en worktree.
  assert.equal(contexteDe({
    file_path: join(REPO, 'server', '.claude', 'notes.md'), old_string: '', new_string: 'voir #1591\n',
  }), '', 'un `.claude/` non racine n’est pas le périmètre des notes')
  assert.equal(contexteDe({
    file_path: join(REPO, 'src', 'docs', 'notes.md'), old_string: '', new_string: 'voir #1591\n',
  }), '', 'un `docs/` non racine n’est pas le périmètre des notes')
  assert.match(contexteDe({
    file_path: join(REPO, '.claude', 'memory', 'exemple.md'), old_string: '', new_string: 'voir #1591\n',
  }), /POINTEUR DÉRÉFÉRENCÉ/, 'la mémoire à la racine reste suivie')
})
