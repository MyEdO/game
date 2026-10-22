// PORTE DU DIALECTE GDSCRIPT (#2928) : code blanchi aux lignes et colonnes gardées, chaînes de toutes formes rendues,
// commentaires de lignes adjacentes fusionnés et leurs marqueurs de continuation blanchis. Patron des voisins de
// `scripts/guards/lib/` : `node:test` + `node:assert/strict`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { lexemesGdscript } from './gdscript.mjs'

test('le code : commentaires et chaînes blanchis, lignes et colonnes gardées ; les chaînes rendues', () => {
  const src = 'var a := "x # y" # randi()\nvar b := &"nom"\nvar c := """un\ndeux"""\nvar d := r"\\d"'
  const { code, chaines } = lexemesGdscript(src)
  assert.equal(code.length, src.length)
  assert.equal(code.split('\n').length, src.split('\n').length)
  assert.doesNotMatch(code, /randi|nom|deux/)
  assert.deepEqual(chaines, [{ texte: 'x # y', ligne: 1 }, { texte: 'nom', ligne: 2 }, { texte: 'un\ndeux', ligne: 3 }, { texte: '\\d', ligne: 5 }])
})

test('les commentaires : délimiteurs compris, lignes adjacentes fusionnées comme en TypeScript, continuations blanchies', () => {
  const src = '## un\n## deux\nvar a := 1 # trois\n\n# quatre\nvar t := "# pas un commentaire"'
  const { commentaires } = lexemesGdscript(src)
  assert.deepEqual(commentaires.map(({ text, line }) => ({ text, line })), [
    { text: '## un\n   deux\n  trois', line: 1 },
    { text: '# quatre', line: 5 },
  ])
  assert.deepEqual(commentaires.map(({ start, end }) => src.slice(start, end)), ['## un\n## deux\nvar a := 1 # trois', '# quatre'])
})
