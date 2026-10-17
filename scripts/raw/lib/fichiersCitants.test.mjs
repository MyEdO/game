// Les deux jeux de racines de `fichiersCitants.mjs` (node --test, `npm run test:raw`), jugés sur les
// DÉFAUTS de leurs lecteurs : un arbre de fixture où `src/` cite un livre et `docs/dossiers/` un autre.
// Les scanners CITANTS (`check-code-refs`, `citation-graphy-guard`, `rawRefIntegrity`) voient les deux ;
// `reconcile` et `build-implemente` ne voient que le code (#2290).
// Les réfs sont CONSTRUITES (`ref`) : une réf littérale ici serait lue comme une citation vivante.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { livreDuSigle } from '../_lib.mjs'
import { scanDeadCodeRefs, scanEmptyLineCodeRefs } from '../check-code-refs.mjs'
import { scanTout } from '../citation-graphy-guard.mjs'
import { scanBlindRefs } from '../../guards/lib/rawRefIntegrity.mjs'
import { indexCode } from '../build-implemente.mjs'
import { computeReconciliation } from '../reconcile.mjs'

const CODE = 'EDOC'
const DOSSIER = 'EDO'
const CH = '97'
const ref = (abbr, l) => [abbr, CH, `l.${l}`].join(' ')
const folio = (abbr) => [abbr, CH, 'p.3'].join(' ')
const citant = (abbr) => `// voir ${ref(abbr, 2)}\n// voir ${ref(abbr, 9)}\n// voir ${folio(abbr)}\n`
const FICHIER_CODE = 'src/a.ts'
const FICHIER_DOSSIER = `docs/dossiers/${DOSSIER}/${CH}.json`

const depart = process.cwd()
let racine
before(() => {
  racine = mkdtempSync(join(tmpdir(), 'citants-'))
  for (const abbr of [CODE, DOSSIER]) {
    const dir = join(racine, livreDuSigle(abbr).dir)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${CH} - Fixture.md`), 'Quuxa bravissimo\n\nDelta foxtrots\n')
  }
  for (const [rel, abbr] of [[FICHIER_CODE, CODE], [FICHIER_DOSSIER, DOSSIER]]) {
    mkdirSync(join(racine, rel, '..'), { recursive: true })
    writeFileSync(join(racine, rel), citant(abbr))
  }
  mkdirSync(join(racine, 'docs/raw'), { recursive: true })
  writeFileSync(join(racine, 'raw.manifest.json'), '[]')
  process.chdir(racine)
})
after(() => {
  process.chdir(depart)
  rmSync(racine, { recursive: true, force: true })
})

const fichiers = (sites) => [...new Set(sites.map((s) => s.file))].sort()

test('CITANTS : bornes, ligne vide, ligne aveugle et graphie lisent le code ET les dossiers', () => {
  const attendu = [FICHIER_DOSSIER, FICHIER_CODE].sort()
  assert.deepEqual(fichiers(scanDeadCodeRefs()), attendu, 'check-code-refs (bornes)')
  assert.deepEqual(fichiers(scanEmptyLineCodeRefs()), attendu, 'check-code-refs (ligne vide)')
  assert.deepEqual(fichiers(scanBlindRefs()), attendu, 'rawRefIntegrity')
  assert.deepEqual(fichiers(scanTout().folioSrc), attendu, 'citation-graphy-guard')
})

test('CODE : le champ `Implémente` ignore les dossiers (build-implemente)', () => {
  assert.deepEqual(fichiers(indexCode().impl), [FICHIER_CODE])
})

test("CODE : la réconciliation à l'Atlas ignore les dossiers (reconcile)", () => {
  const { codeBooks } = computeReconciliation({ manifestPath: 'raw.manifest.json', catalogues: () => new Map() })
  assert.deepEqual([...codeBooks], [CODE], 'reconcile')
})
