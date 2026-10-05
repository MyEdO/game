// La porte CRLF de l'index : volet PUR (sorties littérales de `git ls-files --eol`) et volet MESURÉ
// sur un dépôt JETABLE, où le blob CRLF est fabriqué par le seul chemin qui le produit en vrai
// (`git apply --index`, qui ne renormalise pas).
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { envDeDepotForge } from './depotGabarit.mjs'
import { cheminsMalNormalises, raisonDeRefusEol } from './eolStage.mjs'
import { depotDe, eolsDe } from './gitPorte.mjs'
import { gitDe } from '../../test/gitDeBanc.mjs'

const ligne = (i, attr, chemin) => ({ index: i, travail: 'lf', attr, chemin })

test('un blob d’index en CRLF sur un chemin déclaré eol=lf est fautif', () => {
  assert.deepEqual(
    cheminsMalNormalises([ligne('crlf', 'text=auto eol=lf', 'src/a.ts')]),
    [{ chemin: 'src/a.ts', index: 'crlf' }],
  )
})

test('un blob MIXTE l’est aussi — il porte des \\r, c’est tout ce qui compte', () => {
  assert.deepEqual(
    cheminsMalNormalises([ligne('mixed', 'text=auto eol=lf', 'notes/b.md')]),
    [{ chemin: 'notes/b.md', index: 'mixed' }],
  )
})

test('un blob en LF, vide ou binaire ne dit rien', () => {
  const entrees = [
    ligne('lf', 'text=auto eol=lf', 'src/a.ts'),
    ligne('none', 'text=auto eol=lf', 'src/vide.ts'),
    ligne('-text', 'binary', 'public/x.png'),
  ]
  assert.deepEqual(cheminsMalNormalises(entrees), [])
})

test('un chemin SANS eol=lf n’est pas jugé, CRLF ou non (angle mort dit)', () => {
  assert.deepEqual(cheminsMalNormalises([ligne('crlf', 'text', 'vendor/c.txt')]), [])
  assert.deepEqual(cheminsMalNormalises([ligne('crlf', '', 'vendor/d.txt')]), [])
})

test('aucune entrée ne produit aucun fautif', () => {
  assert.deepEqual(cheminsMalNormalises([]), [])
})

test('le refus NOMME les chemins ET le geste de réparation', () => {
  assert.equal(raisonDeRefusEol([]), null)
  const msg = raisonDeRefusEol([{ chemin: 'src/a.ts', index: 'crlf' }])
  assert.match(msg, /src\/a\.ts \(i\/crlf\)/)
  assert.match(msg, /git add --renormalize src\/a\.ts/)
})

test('dépôt JETABLE : `git apply --index` d’un patch CRLF stage un blob CRLF, et la porte le voit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eol-stage-'))
  const git = gitDe(dir)
  try {
    git('init', '-q', '-b', 'main')
    git('config', 'user.email', 'x@y.z')
    git('config', 'user.name', 'x')
    git('config', 'core.autocrlf', 'true')
    writeFileSync(join(dir, '.gitattributes'), '* text=auto eol=lf\n')
    writeFileSync(join(dir, 'a.txt'), 'une\ndeux\n')
    git('add', '.gitattributes', 'a.txt')
    git('commit', '-q', '-m', 'socle', '--no-verify')
    // Le SEUL chemin qui produit le blob fautif : un patch dont les lignes portent `\r`, appliqué à
    // l'index. Un `git add` du disque, lui, renormalise.
    const patch = [
      'diff --git a/b.txt b/b.txt',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/b.txt',
      '@@ -0,0 +1,2 @@',
      '+une\r',
      '+deux\r',
      '',
    ].join('\n')
    writeFileSync(join(dir, 'p.patch'), patch)
    git('apply', '--index', '--whitespace=nowarn', 'p.patch')
    const eols = (...chemins) => eolsDe(depotDe(dir, { env: envDeDepotForge() }), chemins)
    const sortie = eols('a.txt', 'b.txt')
    // `a.txt`, stagé par `git add`, est en LF ; `b.txt`, stagé par le patch, ne l'est pas.
    assert.deepEqual(cheminsMalNormalises(sortie).map((f) => f.chemin), ['b.txt'])
    // Et le geste NOMMÉ par le refus le répare.
    git('add', '--renormalize', 'b.txt')
    assert.deepEqual(cheminsMalNormalises(eols('b.txt')), [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
