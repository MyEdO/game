// Porte au MESSAGE (#1728 train B) — la règle PURE (`scripts/guards/lib/sujetDeCommit.mjs`), le
// driver appelé comme git l'appelle (fichier du message en `$1`), et un `git commit` RÉEL dans un
// dépôt jetable, `core.hooksPath` pointé sur un dossier de hooks qui n'appelle que celui-ci.
//
// POURQUOI UN DOSSIER DE HOOKS À PART, et non `scripts/git-hooks` en entier : un dépôt jetable n'est
// pas ce dépôt — y jouer le `pre-commit` de ce projet mesurerait ses gardes sur un arbre étranger, et
// le refus lu ne serait plus celui qu'on teste. Le relais posé pointe le commit-msg.mjs RÉEL, par son
// chemin absolu : c'est bien ce code-ci que git exécute.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { SUJET_MAX, refusDeSujet, sujetDuMessage } from '../guards/lib/sujetDeCommit.mjs'
import { jugerFichierDeMessage } from './commit-msg.mjs'

const ICI = dirname(fileURLToPath(import.meta.url))
const DRIVER = join(ICI, 'commit-msg.mjs')

const SUJET_LONG = `fix(x): refs #1728 — ${'a'.repeat(130)}`

test('sujetDuMessage = première ligne non vide, les lignes de commentaire # ignorées', () => {
  assert.equal(sujetDuMessage('\n# gabarit de git\n\n  fix(x): sujet  \n\ncorps'), 'fix(x): sujet')
  assert.equal(sujetDuMessage('# tout en commentaire\n'), '')
  assert.equal(sujetDuMessage(''), '')
})

test('un sujet de plus de 100 caractères est REFUSÉ, sa longueur nommée ; un CORPS long passe', () => {
  const refus = refusDeSujet(SUJET_LONG)
  assert.match(refus, new RegExp(`SUJET de commit de ${SUJET_LONG.length} caractères`))
  assert.match(refus, /le solde et les preuves dans le CORPS/)
  assert.equal(refusDeSujet(`fix(x): refs #1728 — porte de budget\n\n${'preuve '.repeat(400)}`), null)
  assert.equal(refusDeSujet('a'.repeat(SUJET_MAX)), null)
  assert.equal(refusDeSujet('a'.repeat(SUJET_MAX + 1)).length > 0, true)
})

test('AUCUNE exemption : un « Merge branch » automatique passe par sa LONGUEUR, pas par une règle à part', () => {
  assert.equal(refusDeSujet("Merge branch 'wt-1728-L2' into main\n"), null)
  assert.ok(refusDeSujet(`Merge branch '${'x'.repeat(120)}'`), 'une fusion au sujet trop long est refusée comme les autres')
})

test('sans fichier de message lisible, le driver ne juge RIEN plutôt que de refuser', () => {
  assert.equal(jugerFichierDeMessage(undefined), null)
  assert.equal(jugerFichierDeMessage('/absent/COMMIT_EDITMSG', { lire: () => { throw new Error('ENOENT') } }), null)
})

test('le driver appelé comme git l’appelle : exit 1 sur un sujet long, exit 0 sur un sujet court', () => {
  const dir = mkdtempSync(join(tmpdir(), 'msg-'))
  try {
    const fichier = join(dir, 'COMMIT_EDITMSG')
    writeFileSync(fichier, `${SUJET_LONG}\n\n# Please enter the commit message\n`, 'utf8')
    const rouge = spawnSync(process.execPath, [DRIVER, fichier], { cwd: dir, encoding: 'utf8' })
    assert.equal(rouge.status, 1)
    assert.match(rouge.stderr, /SUJET de commit de \d+ caractères/)

    writeFileSync(fichier, 'fix(x): refs #1728 — porte au message\n\ncorps très long ' + 'x'.repeat(500) + '\n', 'utf8')
    assert.equal(spawnSync(process.execPath, [DRIVER, fichier], { cwd: dir, encoding: 'utf8' }).status, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

/** Dossier de hooks jetable dont le `commit-msg` exécute le driver RÉEL de ce dépôt. */
function dossierDeHooks() {
  const dir = mkdtempSync(join(tmpdir(), 'hooks-'))
  const relais = join(dir, 'commit-msg')
  writeFileSync(relais, `#!/bin/sh\nexec node "${DRIVER.replace(/\\/g, '/')}" "$@"\n`, 'utf8')
  chmodSync(relais, 0o755)
  return dir
}

test('un `git commit` RÉEL est refusé sur un sujet de plus de 100 caractères, et passe en dessous', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'v1\n' }, message: 'socle' })
  const hooks = dossierDeHooks()
  try {
    const git = (...args) => spawnSync('git', args, { cwd: racine, encoding: 'utf8' })
    execFileSync('git', ['config', 'core.hooksPath', hooks.replace(/\\/g, '/')], { cwd: racine })
    writeFileSync(join(racine, 'a.txt'), 'v2\n', 'utf8')
    execFileSync('git', ['add', 'a.txt'], { cwd: racine })

    const refuse = git('commit', '-m', SUJET_LONG)
    assert.notEqual(refuse.status, 0, 'git a accepté un sujet trop long')
    assert.match(refuse.stderr, /SUJET de commit de \d+ caractères/)
    assert.equal(git('log', '--oneline').stdout.trim().split('\n').length, 1, 'aucun commit n’a été posé')

    const passe = git('commit', '-m', 'fix(a): refs #1728 — un sujet court, les preuves au corps')
    assert.equal(passe.status, 0, passe.stderr)
    assert.equal(git('log', '--oneline').stdout.trim().split('\n').length, 2)
  } finally {
    rmSync(hooks, { recursive: true, force: true })
    rmSync(racine, { recursive: true, force: true })
  }
})
