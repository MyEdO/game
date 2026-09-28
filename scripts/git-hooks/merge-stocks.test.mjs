// Garde du pilote de fusion des stocks de sites (scripts/git-hooks/merge-stocks.mjs). `npm run test:hooks`.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fusionnerStocks } from './merge-stocks.mjs'
import { threeWay } from './three-way.mjs'
import { FORMAT_JSON, FORMAT_MJS, formatDe } from '../guards/lib/stockDeSites.mjs'
import { ecartDuVolet, groupeDeSite, refusDeCroissance, sitesEnEntrees } from '../guards/lib/stock.mjs'

const PALETTE = 'scripts/guards/lib/paletteLiteralStock.mjs'
const TABLES = 'scripts/raw/source-tables-stock.json'
const FORMAT = 'scripts/raw/source-format-stock.json'
const lu = (chemin) => readFileSync(chemin, 'utf8')
const fusion = (chemin, base, ours, theirs) => fusionnerStocks({ base, ours, theirs, chemin })
const ordinaire = (base, ours, theirs) => threeWay(ours, base, theirs)

/** Le texte `texte` du stock `chemin` dont la collection `nom` passe par `f`, écrit par son format. */
function varie(chemin, texte, f, nom = [...formatDe(chemin).lire(texte, chemin).collections.keys()][0]) {
  const F = formatDe(chemin)
  const image = F.lire(texte, chemin)
  const collections = new Map(image.collections)
  collections.set(nom, f(collections.get(nom)))
  return F.ecrire({ ...image, collections })
}
const entrees = (chemin, texte, nom) => {
  const image = formatDe(chemin).lire(texte, chemin)
  return image.collections.get(nom ?? [...image.collections.keys()][0])
}
const sans = (...groupes) => (es) => es.filter((e) => !groupes.includes(groupeDeSite(e)))
const groupes = (es) => [...new Set(es.map(groupeDeSite))]

test('deux soldes disjoints → les deux', () => {
  const O = lu(PALETTE)
  const [g1, g2] = groupes(entrees(PALETTE, O))
  const r = fusion(PALETTE, O, varie(PALETTE, O, sans(g1)), varie(PALETTE, O, sans(g2)))
  assert.equal(r.conflict, false)
  assert.equal(r.text, varie(PALETTE, O, sans(g1, g2)))
})

test('un ajout d’un seul côté → gardé', () => {
  const O = lu(PALETTE)
  const [g1] = groupes(entrees(PALETTE, O))
  const neuf = { fichier: 'src/gameIso/rig/parts/tenues/defs/Neuf.ts', ref: 'neuf:torse:front', occurrence: 1 }
  const r = fusion(PALETTE, O, varie(PALETTE, O, (es) => [...es, neuf]), varie(PALETTE, O, sans(g1)))
  assert.equal(r.conflict, false)
  assert.equal(r.text, varie(PALETTE, O, (es) => [...sans(g1)(es), neuf]))
})

test('un retrait des deux côtés du même site → une fois', () => {
  const O = lu(PALETTE)
  const [g1, g2] = groupes(entrees(PALETTE, O))
  const r = fusion(PALETTE, O, varie(PALETTE, O, sans(g1)), varie(PALETTE, O, sans(g1, g2)))
  assert.equal(r.conflict, false)
  assert.equal(r.text, varie(PALETTE, O, sans(g1, g2)))
})

test('homonymes : le groupe se recompte par ordinal, la porte reste verte, la régénération répare', () => {
  const site = { file: 'src/gameIso/rig/parts/tenues/defs/Soldat.ts', ref: 'soldat:homonyme:front' }
  const avec = (n) => (es) => [...es, ...sitesEnEntrees(Array.from({ length: n }, () => site))]
  const O = varie(PALETTE, lu(PALETTE), avec(3))
  for (const [nA, nB, attendu, code] of [[2, 4, 3, 3], [2, 2, 2, 1]]) {
    const r = fusion(PALETTE, O, varie(PALETTE, lu(PALETTE), avec(nA)), varie(PALETTE, lu(PALETTE), avec(nB)))
    assert.equal(r.conflict, false)
    const stock = entrees(PALETTE, r.text).filter((e) => e.ref === site.ref)
    assert.deepEqual(stock.map((e) => e.occurrence), Array.from({ length: attendu }, (_, i) => i + 1), `${nA}/${nB}`)
    const sites = Array.from({ length: code }, () => site)
    assert.equal(ecartDuVolet({ sites, stock, ou: PALETTE }).neuves.length, 0, 'porte verte')
    assert.equal(refusDeCroissance(sitesEnEntrees(sites), stock, { nom: 'PALETTE', motif: '-' }), null, 'jamais REFUS')
    if (code < attendu) assert.equal(ecartDuVolet({ sites, stock, ou: PALETTE }).perimees.length, attendu - code, 'périmée')
  }
})

test('JSON point fixe : une `preuve` posée par %B sur un groupe que %A ne touche pas pendant que %A solde un autre groupe → gardée', () => {
  const O = lu(TABLES)
  const es = entrees(TABLES, O)
  const sansPreuve = es.find((e) => !e.preuve)
  const autre = groupes(es).find((g) => g !== groupeDeSite(sansPreuve))
  const B = varie(TABLES, O, (xs) => xs.map((e) => (e === sansPreuve ? { ...e, preuve: 'PDF p.1 : jugé', date: '2026-09-27' } : e)))
  const r = fusion(TABLES, O, varie(TABLES, O, sans(autre)), B)
  assert.equal(r.conflict, false)
  assert.equal(r.text, varie(TABLES, B, sans(autre)))
})

test('JSON point fixe : une `date` changée par %B seul sur un groupe → gardée', () => {
  const O = lu(TABLES)
  const es = entrees(TABLES, O)
  const [g1, g2] = groupes(es)
  const B = varie(TABLES, O, (xs) => xs.map((e) => (groupeDeSite(e) === g1 ? { ...e, date: '2026-09-27' } : e)))
  const r = fusion(TABLES, O, varie(TABLES, O, sans(g2)), B)
  assert.equal(r.conflict, false)
  assert.equal(r.text, varie(TABLES, B, sans(g2)))
})

test('JSON : le même groupe à champs hors clé changé des deux côtés → 3-voies', () => {
  const O = lu(TABLES)
  const [g1] = groupes(entrees(TABLES, O))
  const date = (d) => (xs) => xs.map((e) => (groupeDeSite(e) === g1 ? { ...e, date: d } : e))
  const [A, B] = [varie(TABLES, O, date('2026-09-26')), varie(TABLES, O, date('2026-09-27'))]
  assert.deepEqual(fusion(TABLES, O, A, B), ordinaire(O, A, B))
})

test('JSON : une version qui n’est pas un POINT FIXE de son format → 3-voies', () => {
  const O = lu(TABLES)
  const [g1, g2] = groupes(entrees(TABLES, O))
  const A = varie(TABLES, O, sans(g1))
  const B = `${JSON.stringify(JSON.parse(varie(TABLES, O, sans(g2))), null, 4)}\n`
  assert.deepEqual(fusion(TABLES, O, A, B), ordinaire(O, A, B))
})

test('`reconciliation-stock.json` et un `empty-folios-*-stock.json` changés des deux côtés → 3-voies, `trous` intact', () => {
  const R = 'scripts/raw/reconciliation-stock.json'
  const O = lu(R)
  const brut = JSON.parse(O)
  const [A, B] = ['A', 'B'].map((c) => `${JSON.stringify({ ...brut, quoi: `${brut.quoi} ${c}` }, null, 2)}\n`)
  const r = fusion(R, O, A, B)
  assert.deepEqual(r, ordinaire(O, A, B))
  const E = 'scripts/raw/empty-folios-perdues-stock.json'
  const Oe = lu(E)
  const [g1] = groupes(entrees(E, Oe))
  const pdf = (n) => (xs) => xs.map((e) => (groupeDeSite(e) === g1 ? { ...e, pdfChars: n } : e))
  const [Ae, Be] = [varie(E, Oe, pdf(1)), varie(E, Oe, pdf(2))]
  assert.deepEqual(fusion(E, Oe, Ae, Be), ordinaire(Oe, Ae, Be))
  assert.equal(JSON.stringify(JSON.parse(lu(R)).trous), JSON.stringify(brut.trous))
})

test('`source-format-stock.json` : deux soldes de groupes disjoints de TAILLES différentes, `quoi` inchangé → les deux, sans conflit', () => {
  const O = lu(FORMAT)
  const [g1, g2, g3] = groupes(entrees(FORMAT, O))
  const r = fusion(FORMAT, O, varie(FORMAT, O, sans(g1)), varie(FORMAT, O, sans(g2, g3)))
  assert.equal(r.conflict, false)
  const image = FORMAT_JSON.lire(O)
  assert.equal(r.text, FORMAT_JSON.ecrire({ ...image, collections: new Map([['entrees', sans(g1, g2, g3)(image.collections.get('entrees'))]]) }))
})

test('une base %O vide (ajout des deux côtés) → 3-voies', () => {
  const A = lu(FORMAT)
  const [g1] = groupes(entrees(FORMAT, A))
  const B = varie(FORMAT, A, sans(g1))
  assert.deepEqual(fusion(FORMAT, '', A, B), ordinaire('', A, B))
})

const FIXTURE = 'scripts/guards/lib/fixtureStock.mjs'
const site = (fichier, occurrence = 1) => `{ fichier: '${fichier}', ref: 'r', occurrence: ${occurrence} }`
const module = (...collections) => `// en-tête\n${collections.map(([nom, corps]) => `export const ${nom} = ${corps};\n`).join('')}`

test('une collection `= []` écrite en ligne SUIVIE d’une autre collection → la collection suivante intacte', () => {
  const O = module(['VIDE', '[]'], ['SUITE', `[\n  ${site('a.ts')},\n  ${site('b.ts')},\n  ${site('c.ts')},\n]`])
  const A = module(['VIDE', '[]'], ['SUITE', `[\n  ${site('b.ts')},\n  ${site('c.ts')},\n]`])
  const B = module(['VIDE', '[]'], ['SUITE', `[\n  ${site('a.ts')},\n  ${site('b.ts')},\n]`])
  const r = fusion(FIXTURE, O, A, B)
  assert.equal(r.conflict, false)
  assert.equal(r.text, module(['VIDE', '[]'], ['SUITE', `[\n  ${site('b.ts')},\n]`]))
})

test('une collection vide des deux côtés → pas de plantage', () => {
  const O = module(['UNE', `[\n  ${site('a.ts')},\n]`], ['DEUX', `[\n  ${site('b.ts')},\n]`])
  const A = module(['UNE', '[]'], ['DEUX', `[\n  ${site('b.ts')},\n]`])
  const B = module(['UNE', '[]'], ['DEUX', '[]'])
  assert.deepEqual(fusion(FIXTURE, O, A, B), { text: B, conflict: false })
})

test('un fichier SANS collection modifié des deux côtés → 3-voies, propre sur des lignes disjointes, marqueurs sur les mêmes', () => {
  for (const chemin of ['scripts/guards/lib/plageStock.mjs', 'scripts/guards/lib/legacyVocabStock.mjs', 'scripts/guards/lib/slotsStock.mjs']) {
    const O = lu(chemin)
    assert.equal(FORMAT_MJS.lire(O, chemin).collections.size, 0, chemin)
    const lignes = O.split('\n')
    const change = (i, s) => lignes.map((l, j) => (j === i ? `${l}${s}` : l)).join('\n')
    const disjoint = fusion(chemin, O, change(0, ' A'), change(lignes.length - 2, ' B'))
    assert.deepEqual(disjoint, ordinaire(O, change(0, ' A'), change(lignes.length - 2, ' B')))
    assert.equal(disjoint.conflict, false, chemin)
    const memes = fusion(chemin, O, change(0, ' A'), change(0, ' B'))
    assert.equal(memes.conflict, true, chemin)
    assert.match(memes.text, /^<<<<<<< /m)
  }
})

test('un tableau hors forme de site (`slotsStock.mjs`) est du texte hors collections, qui suit la règle du côté changé', () => {
  const ligne = (date) => `{ dataset: "actions.json", champ: "armed", occurrences: 3, lot: "L2/L3 #1473", date: "${date}" }`
  const avec = (date, sites) => module(['SLOTS_SANS_DECLARATION', `[\n  ${ligne(date)},\n]`], ['SITES', sites])
  const O = avec('2026-08-26', '[]')
  assert.deepEqual([...FORMAT_MJS.lire(O, FIXTURE).collections.keys()], ['SITES'])
  const B = avec('2026-09-27', '[]')
  const A = varie(FIXTURE, O, () => [{ fichier: 'src/x.ts', ref: 'r', occurrence: 1 }], 'SITES')
  const r = fusion(FIXTURE, O, A, B)
  assert.equal(r.conflict, false)
  assert.equal(r.text, varie(FIXTURE, B, () => [{ fichier: 'src/x.ts', ref: 'r', occurrence: 1 }], 'SITES'))
})

test('des en-têtes changés des deux côtés différemment → 3-voies', () => {
  const O = lu(PALETTE)
  const [A, B] = [O.replace('// STOCK', '// A STOCK'), O.replace('// STOCK', '// B STOCK')]
  assert.deepEqual(fusion(PALETTE, O, A, B), ordinaire(O, A, B))
})

test('un `.mjs` à effet de bord au niveau module n’est jamais exécuté', () => {
  const O = `globalThis.__pilote = 1;\n${module(['S', `[\n  ${site('a.ts')},\n  ${site('b.ts')},\n]`])}`
  const A = `globalThis.__pilote = 1;\n${module(['S', `[\n  ${site('b.ts')},\n]`])}`
  const B = `globalThis.__pilote = 1;\n${module(['S', `[\n  ${site('a.ts')},\n]`])}`
  const r = fusion(FIXTURE, O, A, B)
  assert.equal(r.conflict, false)
  assert.equal(r.text, `globalThis.__pilote = 1;\n${module(['S', '[]'])}`)
  assert.equal(globalThis.__pilote, undefined)
})

test('des temporaires %O/%A/%B sans extension, %P en `.mjs` → lus par `FORMAT_MJS`', () => {
  const dir = mkdtempSync(join(tmpdir(), 'merge-stocks-test-'))
  try {
    const O = lu(PALETTE)
    const [g1, g2] = groupes(entrees(PALETTE, O))
    const [fO, fA, fB] = ['O', 'A', 'B'].map((n) => join(dir, n))
    writeFileSync(fO, O)
    writeFileSync(fA, varie(PALETTE, O, sans(g1)))
    writeFileSync(fB, varie(PALETTE, O, sans(g2)))
    const r = spawnSync(process.execPath, ['scripts/git-hooks/merge-stocks.mjs', fO, fA, fB, PALETTE], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    assert.equal(readFileSync(fA, 'utf8'), varie(PALETTE, O, sans(g1, g2)))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
