// Banc du reporter des durées `node --test` (#2400) : l'enveloppe du fichier, sinon la somme de ses tests de premier niveau.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import dureesNodeTest from './dureesNodeTest.mjs'

async function* evenements(liste) {
  for (const e of liste) yield e
}

test('dureesNodeTest : somme par fichier des tests de premier niveau, réussis ou échoués ; imbriqués et sans fichier ignorés', async () => {
  const rendus = []
  for await (const morceau of dureesNodeTest(evenements([
    { type: 'test:pass', data: { nesting: 0, file: '/r/a.test.mjs', details: { duration_ms: 5 } } },
    { type: 'test:pass', data: { nesting: 1, file: '/r/a.test.mjs', details: { duration_ms: 4 } } },
    { type: 'test:fail', data: { nesting: 0, file: '/r/a.test.mjs', details: { duration_ms: 3 } } },
    { type: 'test:pass', data: { nesting: 0, file: '/r/b.test.mjs', details: { duration_ms: 2 } } },
    { type: 'test:pass', data: { nesting: 0, details: { duration_ms: 7 } } },
    { type: 'test:diagnostic', data: { nesting: 0, file: '/r/b.test.mjs', message: 'x' } },
  ]))) rendus.push(morceau)
  assert.deepEqual(rendus.map((r) => JSON.parse(r)), [{ '/r/a.test.mjs': 8, '/r/b.test.mjs': 2 }])
})

test('dureesNodeTest : l’ENVELOPPE du fichier (`test:complete` sans `test:pass`/`test:fail` homonyme) prime sur la somme', async () => {
  const rendus = []
  for await (const morceau of dureesNodeTest(evenements([
    { type: 'test:complete', data: { nesting: 0, name: 'cas', file: '/r/a.test.mjs', details: { duration_ms: 5 } } },
    { type: 'test:pass', data: { nesting: 0, name: 'cas', file: '/r/a.test.mjs', details: { duration_ms: 5 } } },
    { type: 'test:complete', data: { nesting: 0, name: 'a.test.mjs', file: '/r/a.test.mjs', details: { duration_ms: 70 } } },
    { type: 'test:complete', data: { nesting: 0, name: 'seul', file: '/r/b.test.mjs', details: { duration_ms: 3 } } },
    { type: 'test:fail', data: { nesting: 0, name: 'seul', file: '/r/b.test.mjs', details: { duration_ms: 3 } } },
  ]))) rendus.push(morceau)
  assert.deepEqual(rendus.map((r) => JSON.parse(r)), [{ '/r/a.test.mjs': 70, '/r/b.test.mjs': 3 }])
})
