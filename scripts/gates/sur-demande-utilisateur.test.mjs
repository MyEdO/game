import { test } from 'node:test'
import assert from 'node:assert/strict'
import { demandeDe, rejouer } from './sur-demande-utilisateur.mjs'

test('ANNONCE : raison publiée avant délégation, code et gates transmis', async () => {
  const lignes = []
  const code = await rejouer({
    argv: ['--raison', 'demande du 6 octobre', '--gates', 'lint,typecheck'],
    journal: t => lignes.push(t),
    deleguer: ({ argv }) => {
      assert.match(lignes.join(''), /Rejeu local exceptionnel.*demande du 6 octobre/)
      assert.deepEqual(argv.slice(2), ['--gates', 'lint,typecheck'])
      return 7
    },
  })
  assert.equal(code, 7)
})

test('aucune délégation sur une demande invalide', async () => {
  for (const argv of [[], ['--gates','lint'], ['--raison',' ','--gates','lint'], ['--raison','$x','--gates','lint'], ['--raison','oui','--gates','x'], ['--raison','oui','--gates','lint','--root','.']]) {
    assert.equal(demandeDe(argv), null)
    assert.equal(await rejouer({ argv, journal: () => {}, deleguer: () => { throw new Error('gate lancée') } }), 1)
  }
})
