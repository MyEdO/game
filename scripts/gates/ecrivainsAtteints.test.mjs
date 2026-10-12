import test, { mock } from 'node:test'

import assert from 'node:assert/strict'

import { corpusParGate, transitif } from './ecrivainsAtteints.mjs'

import fsReel, { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'

import { tmpdir } from 'node:os'

import { join } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { lancesDeGit, sousCommande } from '../test/gitDeBanc.mjs'

test('#2586 corpusParGate : liste unique par mesure, import édité et tests ajoutés ou retirés frais', (t) => {
  const fichiers = {
    'package.json': JSON.stringify({ scripts: { 'test:ops': 'node scripts/gates/testsSansEcriture.mjs test:ops', 'test:docs': 'node scripts/gates/testsSansEcriture.mjs test:docs' } }),
    '.github/workflows/ci.yml': 'jobs:\n  unique:\n    steps:\n      - run: npm run test:ops\n      - run: npm run test:docs\n',
    'scripts/gates/testsSansEcriture.mjs': 'export const lanceur = true',
    'scripts/ops/fixture.test.mjs': "import '../shared.mjs'",
    'scripts/docs/fixture.test.mjs': "import '../shared.mjs'",
    'scripts/shared.mjs': "export { a } from './a.mjs'",
    'scripts/a.mjs': 'export const a = 1',
    'scripts/b.mjs': 'export const a = 2',
  }
  const { racine } = instanceDeDepot({ fichiers })
  const lire = fsReel.readFileSync
  let lectures = 0
  const espion = mock.method(fsReel, 'readFileSync', (...args) => {
    if (String(args[0]).replaceAll('\\', '/') === join(racine, 'scripts/shared.mjs').replaceAll('\\', '/')) lectures++
    return lire(...args)
  })
  syncBuiltinESMExports()
  try {
    const premier = lancesDeGit(() => corpusParGate(racine))
    assert.equal(premier.lances.filter((a) => sousCommande(a) === 'ls-files' && a.includes('--cached')).length, 1)
    for (const corpus of Object.values(premier.valeur)) assert.ok(corpus.includes('scripts/a.mjs'))
    assert.equal(lectures, 1)
    lectures = 0
    writeFileSync(join(racine, 'scripts/shared.mjs'), "export { a } from './b.mjs'")
    writeFileSync(join(racine, 'scripts/ops/neuf.test.mjs'), "import '../b.mjs'")
    rmSync(join(racine, 'scripts/docs/fixture.test.mjs'))
    const seconde = lancesDeGit(() => corpusParGate(racine))
    assert.equal(seconde.lances.filter((a) => sousCommande(a) === 'ls-files' && a.includes('--cached')).length, 1)
    assert.ok(seconde.valeur['test:ops'].includes('scripts/b.mjs'))
    assert.ok(seconde.valeur['test:ops'].includes('scripts/ops/neuf.test.mjs'))
    assert.equal(seconde.valeur['test:ops'].includes('scripts/a.mjs'), false)
    assert.equal(seconde.valeur['test:docs'].includes('scripts/docs/fixture.test.mjs'), false)
    assert.equal(lectures, 1)
    t.diagnostic(JSON.stringify({ listagesGit: [premier, seconde].map((m) => m.lances.filter((a) => sousCommande(a) === 'ls-files').length) }))
  } finally { espion.mock.restore(); syncBuiltinESMExports(); rmSync(racine, { recursive: true, force: true }) }
})

test('R3 : le corpus suit les acquisitions exécutées et ignore le texte inerte', () => {
  const racine = mkdtempSync(join(tmpdir(), 'ecrivains-imports-'))
  try {
    writeFileSync(join(racine, 'a.ts'), 'export const b = 1; export type A = number; export type B = string;')
    const cas = [
      ["import type { A } from './a';", false],
      ["export type { A } from './a';", false],
      ["import { type A, type B } from './a';", false],
      ["import { type A, b } from './a';", false],
      ["import { type A, b } from './a'; console.log(b);", true],
      ["import './a';", true],
      ["export { b } from './a';", true],
      ["const p = import('./a');", true],
      ["const p = require('./a');", true],
      ["/* import './a'; */ const s = \"from './a'\";", false],
    ]
    for (const [source, atteint] of cas) {
      writeFileSync(join(racine, 'entree.ts'), source)
      assert.deepEqual(transitif(['entree.ts'], racine).sort(), atteint ? ['a.ts', 'entree.ts'] : ['entree.ts'], source)
    }
    assert.deepEqual(transitif(['absent.mjs'], racine), [])
    writeFileSync(join(racine, 'invalide.mjs'), 'const = ;')
    assert.throws(() => transitif(['invalide.mjs'], racine), /invalide\.mjs ne se parse pas/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
