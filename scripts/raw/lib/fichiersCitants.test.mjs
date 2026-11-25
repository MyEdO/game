// Les deux jeux de racines de `fichiersCitants.mjs` (node --test, `npm run test:raw`), jugés sur les
// DÉFAUTS de leurs lecteurs : un arbre de fixture où `src/` et `projets/` citent un livre et `docs/dossiers/` un autre.
// Les scanners CITANTS (`check-code-refs`, `citation-graphy-guard`, `rawRefIntegrity`) voient les trois ;
// `reconcile` et `build-implemente` ne voient que le code, celui du commun et celui des projets (#2290, #4936).
// Les réfs sont CONSTRUITES (`ref`) : une réf littérale ici serait lue comme une citation vivante.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanDeadCodeRefs, scanEmptyLineCodeRefs } from '../check-code-refs.mjs'
import { scanTout } from '../citation-graphy-guard.mjs'
import { scanBlindRefs } from '../../guards/lib/rawRefIntegrity.mjs'
import { indexCode, rendre as rendreImplementation, RAPPORT as RAPPORT_IMPLEMENTATION, validerDette, registresDeFiches } from '../build-implemente.mjs'
import { computeReconciliation } from '../reconcile.mjs'

const CODE = 'EDOC'
const DOSSIER = 'EDO'
const CH = '97'
const ref = (abbr, l) => [abbr, CH, `l.${l}`].join(' ')
const folio = (abbr) => [abbr, CH, 'p.3'].join(' ')
const citant = (abbr) => `// voir ${ref(abbr, 2)}\n// voir ${ref(abbr, 9)}\n// voir ${folio(abbr)}\n`
const FICHIER_CODE = 'src/a.ts'
const FICHIER_PROJET = 'projets/p/a.ts'
const FICHIER_DOSSIER = `docs/dossiers/${DOSSIER}/${CH}.json`

const depart = process.cwd()
const chapitres = new Map()
const chapitreDe = (abbr, nn) => nn === CH ? chapitres.get(abbr) ?? null : null
let racine
before(() => {
  racine = mkdtempSync(join(tmpdir(), 'citants-'))
  for (const abbr of [CODE, DOSSIER]) {
    const dir = join(racine, 'Source', abbr)
    const file = `${CH} - Fixture.md`
    const path = join(dir, file)
    mkdirSync(dir, { recursive: true })
    writeFileSync(path, 'Quuxa bravissimo\n\nDelta foxtrots\n')
    chapitres.set(abbr, { path, file, dir })
  }
  for (const [rel, abbr] of [[FICHIER_CODE, CODE], [FICHIER_PROJET, CODE], [FICHIER_DOSSIER, DOSSIER]]) {
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

const fichiers = (sites) => [...new Set(sites.map((s) => s.fichier))].sort()

test('CITANTS : bornes, ligne vide, ligne aveugle et graphie lisent le code, celui des projets compris, ET les dossiers', () => {
  const attendu = [FICHIER_DOSSIER, FICHIER_CODE, FICHIER_PROJET].sort()
  const horsBornes = scanDeadCodeRefs(undefined, chapitreDe).map(({ fichier, kind }) => [fichier, kind]).sort()
  assert.deepEqual(horsBornes, attendu.map((file) => [file, 'out-of-bounds']), 'check-code-refs (bornes)')
  assert.deepEqual(fichiers(scanEmptyLineCodeRefs(undefined, chapitreDe)), attendu, 'check-code-refs (ligne vide)')
  assert.deepEqual(fichiers(scanBlindRefs(undefined, chapitreDe)), attendu, 'rawRefIntegrity')
  assert.deepEqual(fichiers(scanTout().folioSrc), attendu, 'citation-graphy-guard')
})

test('CODE : le champ `Implémente` lit le code du commun et des projets, et ignore les dossiers (build-implemente)', () => {
  assert.deepEqual([...new Set(indexCode().impl.map((r) => r.file))].sort(), [FICHIER_PROJET, FICHIER_CODE].sort())
})

test("CODE : la réconciliation à l'Atlas ignore les dossiers (reconcile)", () => {
  const fiches = []
  const rapportImplementation = rendreImplementation({
    fiches, index: indexCode(), closure: new Set(), dette: validerDette([], registresDeFiches(fiches)),
  }).get(RAPPORT_IMPLEMENTATION)
  const { codeBooks } = computeReconciliation({ manifestPath: 'raw.manifest.json', catalogues: () => new Map(), rapportImplementation })
  assert.deepEqual([...codeBooks], [CODE], 'reconcile')
})
