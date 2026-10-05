// Banc des FORMATS et de la RÉGÉNÉRATION des stocks de sites (node --test) : lecture sur disque, les
// deux formats (`FORMAT_JSON`, `FORMAT_MJS`), les entrées régénérées, les trois politiques de
// croissance, `texteRegenere`, `ecartDeRegeneration`, et la commande `regenStock.mts`. Le CONTRAT de
// la clé et de l'écart vit avec la primitive (`stock.test.mjs`). Fixtures sous un `mkdtempSync` de
// `os.tmpdir()`, retirées par `rmSync` ; l'arbre du dépôt n'est jamais écrit. Lancé par
// `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { CHAMPS_DE_CLE, CHAMPS_D_ECHEANCE, SEPARATEUR_DE_REMEDE, cleDeSite, sitesEnEntrees } from './stock.mjs'
import {
  DECROISSANT, FORMAT_JSON, FORMAT_MJS, REMESURE, SOUS_LOT, comptesParFamille, ecartDeRegeneration,
  entreesRegenerees, formatDe, lireEntreesDeSite, lireStockJson, texteDeStock, texteEnPlace, texteRegenere,
} from './stockDeSites.mjs'
import { lotDeLaLigne, regenererStock } from './regenStock.mts'
import { constructionsReserveesDuCorpus, scanConstructionsReservees, ECRITURE_DE_STOCK_JSON } from './canonUnique.mjs'
import { listerDossier } from './lister.mjs'
import { corpusDesGardes } from './commentPoison.mjs'
import { RACINE } from './bindingsVivants.mjs'

const ICI = fileURLToPath(new URL('.', import.meta.url))
const REGEN = join(ICI, 'regenStock.mts')

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'stock-de-sites-'))
  try { return fn(dir) } finally { rmSync(dir, { recursive: true, force: true }) }
}

/** Une déclaration à une collection. */
const decl = (chemin, politique, sites, { motif, ...reste } = {}) =>
  ({ chemin, politique, collections: [{ nom: chemin.endsWith('.json') ? 'entrees' : 'A_STOCK', sites, motif }], ...reste })

// ── Lecture sur disque ─────────────────────────────────────────────────────────────────────────────

const ENTREE = { fichier: 'src/a.ts', ref: 'LDB 6 l.2', occurrence: 1 }

test('lireEntreesDeSite : fichier absent → aucune entrée (zéro-tolérance), fichier présent → ses entrées', () => {
  assert.deepEqual(lireEntreesDeSite(join(tmpdir(), 'inexistant-stock-de-sites.json')), [])
  assert.equal(texteEnPlace(join(tmpdir(), 'inexistant-stock-de-sites.json')), null)
  withTempDir((dir) => {
    const path = join(dir, 'stock.json')
    writeFileSync(path, '{"entrees":[{"fichier":"src/a.ts","ref":"LDB 6 l.2","occurrence":1}]}', 'utf8')
    assert.deepEqual(lireEntreesDeSite(path).map(cleDeSite), [cleDeSite(ENTREE)])
  })
})

test('lireStockJson : un stock absent rend un document VIDE, un stock présent rend son JSON entier', () => {
  assert.deepEqual(lireStockJson(join(tmpdir(), 'inexistant-stock-de-sites.json')), {})
  withTempDir((dir) => {
    const path = join(dir, 'stock.json')
    writeFileSync(path, '{"quoi":"fixture","entrees":[]}', 'utf8')
    assert.deepEqual(lireStockJson(path), { quoi: 'fixture', entrees: [] })
  })
})

// ── L'écriture du format JSON a UN écrivain ────────────────────────────────────────────────────────

const ECRITURE = { ...ECRITURE_DE_STOCK_JSON, foyer: 'scripts/guards/lib/stockDeSites.mjs' }

test('ECRITURE_DE_STOCK_JSON : aucune écriture du format JSON des stocks hors de `texteDeStock`', () => {
  assert.deepEqual(constructionsReserveesDuCorpus(corpusDesGardes(), [ECRITURE]), [])
})

test('ECRITURE_DE_STOCK_JSON : une recopie neuve hors du foyer est un site, la même dans le foyer ne l’est pas', () => {
  const vu = (text, rel = 'scripts/fixture.mjs') => scanConstructionsReservees({ rel, text }, [ECRITURE]).map((t) => t.construction)
  assert.deepEqual(vu('const t = JSON.stringify({ ...brut, entrees }, null, 2)'), ['ECRITURE_DE_STOCK_JSON'])
  assert.deepEqual(vu('const t = JSON.stringify({ entrees })'), ['ECRITURE_DE_STOCK_JSON'])
  assert.deepEqual(vu('const t = JSON.stringify({ quoi, n: 1 })'), [])
  assert.deepEqual(vu('const t = JSON.stringify({ quoi, entrees }, null, 2)', 'scripts/guards/lib/stockDeSites.mjs'), [])
})

// ── Entrées régénérées, comptes par famille ────────────────────────────────────────────────────────

test('entreesRegenerees : les entrées sont RANGÉES par clé, quel que soit l’ordre du balayage', () => {
  const sites = [{ file: 'src/b.ts', ref: 'r' }, { file: 'src/a.ts', ref: 'r' }, { file: 'src/a.ts', ref: 'q' }]
  assert.deepEqual(entreesRegenerees(sites).map((e) => `${e.fichier}|${e.ref}`), ['src/a.ts|q', 'src/a.ts|r', 'src/b.ts|r'])
})

test('comptesParFamille : toutes les familles présentes, même à zéro, dans leur ordre', () => {
  assert.deepEqual(comptesParFamille([{ famille: 'b' }, { famille: 'b' }], ['a', 'b']), { a: 0, b: 2 })
  assert.deepEqual(Object.keys(comptesParFamille([], ['b', 'a'])), ['b', 'a'])
})

test('sitesEnEntrees : le reste d’un site (`line`, `pdfChars`) suit l’entrée, après l’occurrence', () => {
  const [e] = sitesEnEntrees([{ famille: 'f', file: 'src/a.ts', ref: 'r', line: 12, pdfChars: 40 }])
  assert.deepEqual(Object.keys(e), [...CHAMPS_DE_CLE, 'line', 'pdfChars'])
})

// ── Régénération sous lot (JSON) ───────────────────────────────────────────────────────────────────

const ANCIEN = [{ famille: 'f', fichier: 'Source/L/01 - A.md', ref: 'a', occurrence: 1, lot: '#1 X', date: '2026-01-01' }]
const CONNUE = { famille: 'f', fichier: 'Source/L/01 - A.md', ref: 'a', occurrence: 1 }
const NEUVE = { famille: 'f', fichier: 'Source/L/01 - A.md', ref: 'b', occurrence: 1 }
const site = (e, reste = {}) => ({ famille: e.famille, file: e.fichier, ref: e.ref, ...reste })
const regenerer = (args, sites, { ancien = ANCIEN, date = '2026-09-23' } = {}) => texteRegenere(
  decl('x-stock.json', SOUS_LOT, sites),
  { enPlace: texteDeStock('q', ancien), lot: lotDeLaLigne(args), date, amorce: args.includes('--amorce') },
)
const entreesDe = (r) => JSON.parse(r.texte).entrees

test('régénération sous lot : une entrée NEUVE sans `--lot` REFUSE l’écriture, nommée — rien n’est écrit', () => {
  for (const args of [[], ['--lot'], ['--lot', '--amorce']]) {
    const r = regenerer(args, [site(CONNUE), site(NEUVE)])
    assert.equal(r.texte, undefined, JSON.stringify(args))
    assert.match(r.refus, /^REFUS : x-stock\.json : entrees porte 1 entrée\(s\) NEUVE\(S\) ou ACCRUE\(S\) au regard du stock en place \(1 entrée\(s\)\) :\n/)
    assert.ok(r.refus.includes(cleDeSite(NEUVE)))
    assert.match(r.refus, /Passer `--lot <#N …>` : rien n'est écrit\.$/)
  }
})

test('régénération sous lot : `--lot` étiquette la NEUVE, la CONNUE garde le sien ; sans neuve, aucun lot requis', () => {
  const r = regenerer(['--lot', '#1739 3b-2b'], [site(CONNUE), site(NEUVE)])
  assert.deepEqual(entreesDe(r).map((e) => [e.lot, e.date]), [['#1 X', '2026-01-01'], ['#1739 3b-2b', '2026-09-23']])
  const sansNeuve = regenerer([], [site(CONNUE)])
  assert.equal(sansNeuve.texte, texteDeStock('q', ANCIEN))
  const amorceAvecLot = regenerer(['--amorce', '--lot', '#9 y'], [site(CONNUE), site(NEUVE)])
  assert.deepEqual(entreesDe(amorceAvecLot)[1], { ...NEUVE, lot: '#9 y', date: '2026-09-23' })
})

test('régénérer un stock dont un nombre a GRANDI est refusé sans `--lot` ; `--lot` date la croissance', () => {
  const tenue = { ...ANCIEN[0], nombre: 3, preuve: 'PDF p.1' }
  const regen = (args, nombre) => regenerer(args, [site(CONNUE, { nombre })], { ancien: [tenue], date: '2026-09-25' })
  const refus = regen([], 4)
  assert.ok(refus.refus.includes(cleDeSite(CONNUE)))
  assert.deepEqual(entreesDe(regen(['--lot', '#1739 x'], 4)), [{ ...CONNUE, nombre: 4, lot: '#1739 x', date: '2026-09-25' }])
  assert.deepEqual(entreesDe(regen([], 2)), [{ ...CONNUE, nombre: 2, lot: '#1 X', date: '2026-01-01', preuve: 'PDF p.1' }])
})

test('SOUS_LOT : une entrée qui porte une `preuve`, régénérée sans `--lot`, garde sa preuve à l’octet, après sa date', () => {
  const tenue = { ...ANCIEN[0], preuve: 'PDF p.7 : « lu »   fin.' }
  const r = regenerer([], [site(CONNUE)], { ancien: [tenue] })
  assert.equal(r.texte, texteDeStock('q', [tenue]))
  assert.deepEqual(Object.keys(entreesDe(r)[0]), [...CHAMPS_DE_CLE, ...CHAMPS_D_ECHEANCE, 'preuve'])
})

// ── Politiques ─────────────────────────────────────────────────────────────────────────────────────

const MJS = (corps) => `// fixture\nexport const A_STOCK = ${corps}\n\nexport const HORS = 1\n`
const LIGNES = (...e) => `[\n${e.map((x) => `  { fichier: '${x.fichier}', ref: '${x.ref}', occurrence: ${x.occurrence} },`).join('\n')}\n]`
const A1 = { fichier: 'src/a.ts', ref: 'r1', occurrence: 1 }
const B1 = { fichier: 'src/b.ts', ref: 'r2', occurrence: 1 }
const Z1 = { fichier: 'src/z.ts', ref: 'r9', occurrence: 1 }
const s = (e, reste = {}) => ({ file: e.fichier, ref: e.ref, ...reste })

test('DECROISSANT : un échange à somme nulle est refusé ; le même sous l’amorce est écrit', () => {
  const r = decl('x.mjs', DECROISSANT, [s(A1), s(B1)], { motif: 'Corriger.' })
  const enPlace = MJS(LIGNES(A1, Z1))
  const refus = texteRegenere(r, { enPlace })
  assert.match(refus.refus, /^REFUS : x\.mjs : A_STOCK porte 1 entrée\(s\) NEUVE\(S\)/)
  assert.ok(refus.refus.includes(cleDeSite(B1)))
  assert.match(refus.refus, /Cet outil ne peut qu'écrire un stock PLUS PETIT\. Corriger\.$/)
  assert.equal(texteRegenere(r, { enPlace, amorce: true }).texte, MJS(LIGNES(A1, B1)))
})

test('DECROISSANT : un `nombre` accru est refusé et nommé ; égal ou plus petit, l’échéance en place survit', () => {
  const tenue = { ...CONNUE, nombre: 3, lot: '#1711', date: '2026-09-12' }
  const r = (nombre) => texteRegenere(decl('x-stock.json', DECROISSANT, [site(CONNUE, { nombre })]), { enPlace: texteDeStock('q', [tenue]) })
  assert.ok(r(4).refus.includes(`${cleDeSite(CONNUE)}${SEPARATEUR_DE_REMEDE}nombre 4 > 3 en stock`))
  assert.deepEqual(entreesDe(r(3)), [tenue])
  assert.deepEqual(entreesDe(r(2)), [{ ...tenue, nombre: 2 }])
})

test('DECROISSANT : sur un stock JSON daté, les `lot`/`date` en place survivent, aucune entrée n’en reçoit', () => {
  const autre = { ...CONNUE, ref: 'c' }
  const r = texteRegenere(decl('x-stock.json', DECROISSANT, [site(CONNUE)]), { enPlace: texteDeStock('q', [ANCIEN[0], { ...autre, lot: '#2', date: '2026-02-02' }]), lot: '#9', date: '2030-01-01' })
  assert.deepEqual(entreesDe(r), [ANCIEN[0]])
  const sansDate = texteRegenere(decl('x-stock.json', DECROISSANT, [site(CONNUE)]), { enPlace: texteDeStock('q', [CONNUE, autre]), lot: '#9', date: '2030-01-01' })
  assert.deepEqual(entreesDe(sansDate), [CONNUE])
})

test('DECROISSANT : sur un `.mjs` sans échéance, aucun `lot` ni `date` n’est écrit', () => {
  const r = texteRegenere(decl('x.mjs', DECROISSANT, [s(A1)]), { enPlace: MJS(LIGNES(A1, B1)), lot: '#9', date: '2030-01-01' })
  assert.equal(r.texte, MJS(LIGNES(A1)))
})

test('REMESURE : une entrée neuve et une soldée donnent un texte, sans refus, amorce ou non', () => {
  const r = decl('x.mjs', REMESURE, [s(A1), s(B1)])
  for (const amorce of [false, true]) assert.equal(texteRegenere(r, { enPlace: MJS(LIGNES(A1, Z1)), amorce }).texte, MJS(LIGNES(A1, B1)))
})

test('SOUS_LOT sur un stock `.mjs` : sans `--lot`, refus ; avec, l’entrée neuve datée ; relue, une seconde passe est identique', () => {
  const r = decl('x.mjs', SOUS_LOT, [s(A1), s(B1)])
  assert.ok(texteRegenere(r, { enPlace: MJS(LIGNES(A1)), lot: null, date: '2026-09-27' }).refus.includes(cleDeSite(B1)))
  const date = texteRegenere(r, { enPlace: MJS(LIGNES(A1)), lot: '#1903', date: '2026-09-27' }).texte
  assert.ok(date.includes(`  { fichier: 'src/b.ts', ref: 'r2', occurrence: 1, lot: '#1903', date: '2026-09-27' },`))
  assert.equal(texteRegenere(r, { enPlace: date, lot: null, date: '2026-09-28' }).texte, date)
})

// ── Formats ────────────────────────────────────────────────────────────────────────────────────────

test('FORMAT_MJS : un champ hors clé (`pdfChars: 12`) s’écrit et se relit à l’identique ; un booléen lève', () => {
  const r = decl('x.mjs', REMESURE, [s(A1, { pdfChars: 12 })])
  const texte = texteRegenere(r, { enPlace: MJS('[]') }).texte
  assert.ok(texte.includes(`  { fichier: 'src/a.ts', ref: 'r1', occurrence: 1, pdfChars: 12 },`))
  assert.deepEqual(FORMAT_MJS.lire(texte, 'x.mjs').collections.get('A_STOCK'), [{ ...A1, pdfChars: 12 }])
  assert.equal(FORMAT_MJS.ecrire(FORMAT_MJS.lire(texte, 'x.mjs')), texte)
  assert.throws(() => texteRegenere(decl('x.mjs', REMESURE, [s(A1, { vu: true })]), { enPlace: MJS('[]') }), /x\.mjs : A_STOCK\.vu/)
})

test('FORMAT_MJS : une collection `[]` en ligne suivie d’une autre collection laisse la suivante intacte', () => {
  const texte = `export const A_STOCK = []\nexport const B_STOCK = ${LIGNES(B1)}\n`
  const r = decl('x.mjs', REMESURE, [s(A1)])
  assert.equal(texteRegenere(r, { enPlace: texte }).texte, `export const A_STOCK = ${LIGNES(A1)}\nexport const B_STOCK = ${LIGNES(B1)}\n`)
})

test('un stock `.mjs` et un stock JSON passent par le même `texteRegenere`', () => {
  assert.equal(texteRegenere(decl('x.mjs', REMESURE, [s(A1)]), { enPlace: MJS('[]') }).texte, MJS(LIGNES(A1)))
  assert.equal(texteRegenere(decl('x-stock.json', REMESURE, [s(A1)]), { enPlace: texteDeStock('q', []) }).texte, texteDeStock('q', [A1]))
  assert.equal(formatDe('a/b.mjs'), FORMAT_MJS)
  assert.equal(formatDe('a/b-stock.json'), FORMAT_JSON)
  assert.equal(FORMAT_JSON.ecrire({ horsCollections: 'q', collections: new Map([['entrees', [Z1, A1, B1]]]) }), texteDeStock('q', [A1, B1, Z1]))
  assert.throws(() => formatDe('a/b.yaml'), /a\/b\.yaml/)
})

test('une collection déclarée absente du fichier, un fichier illisible par son format : lève ; une collection non déclarée est reprise telle', () => {
  assert.throws(() => texteRegenere(decl('x.mjs', REMESURE, [s(A1)]), { enPlace: 'export const AUTRE = []\n' }), /x\.mjs : collection A_STOCK absente/)
  assert.throws(() => texteRegenere(decl('x-stock.json', REMESURE, [s(A1)]), { enPlace: '{"quoi":1,"trous":[]}' }), /x-stock\.json : illisible/)
  assert.throws(() => texteRegenere(decl('x-stock.json', REMESURE, [s(A1)]), { enPlace: '{"quoi":1,"entrees":[],"trous":[]}' }), /x-stock\.json : illisible/)
  const deux = `export const A_STOCK = []\nexport const B_STOCK = ${LIGNES(B1, Z1)}\n`
  assert.equal(texteRegenere(decl('x.mjs', REMESURE, [s(A1)]), { enPlace: deux }).texte, `export const A_STOCK = ${LIGNES(A1)}\nexport const B_STOCK = ${LIGNES(B1, Z1)}\n`)
})

test('stock JSON absent : image vide de la déclaration ; soldé, `texte: null` ; né, avec le `horsCollections` déclaré', () => {
  const vide = decl('x-stock.json', SOUS_LOT, [], { horsCollections: 'né' })
  assert.deepEqual(texteRegenere(vide, { enPlace: null }), { texte: null, tailles: 'entrees=0' })
  const neuf = decl('x-stock.json', SOUS_LOT, [s(A1)], { horsCollections: 'né' })
  assert.ok(texteRegenere(neuf, { enPlace: null, lot: null }).refus.includes(cleDeSite(A1)))
  assert.equal(texteRegenere(neuf, { enPlace: null, lot: '#1', date: '2026-09-27' }).texte, texteDeStock('né', [{ ...A1, lot: '#1', date: '2026-09-27' }]))
  assert.equal(texteRegenere(vide, { enPlace: texteDeStock('q', [ANCIEN[0]]) }).texte, null)
  assert.throws(() => texteRegenere(decl('x.mjs', REMESURE, []), { enPlace: null }), /x\.mjs : fichier absent/)
  assert.throws(() => texteRegenere(decl('x-stock.json', REMESURE, []), { enPlace: null }), /horsCollections/)
})

test('une mesure incomplète (`manque`) refuse sous toute politique, amorce et `--lot` compris, et nomme chaque phrase', () => {
  const manque = ['CRB — NON TRIABLE (PDF absent) : 3 candidat(s)', 'ZI — NON SONDABLE (x)']
  for (const politique of [DECROISSANT, SOUS_LOT, REMESURE]) {
    for (const opts of [{}, { amorce: true }, { lot: '#1' }]) {
      for (const [enPlace, sites] of [[texteDeStock('q', [A1]), [s(A1)]], [texteDeStock('q', [A1]), []], [null, []]]) {
        const r = texteRegenere(decl('x-stock.json', politique, sites, { horsCollections: 'q', manque }), { enPlace, ...opts })
        assert.equal(r.texte, undefined)
        assert.equal(r.refus, `REFUS : x-stock.json : mesure incomplète, rien n'est écrit :\n  ${manque[0]}\n  ${manque[1]}`)
      }
    }
  }
  assert.equal(texteRegenere(decl('x-stock.json', REMESURE, [s(A1)], { manque: [manque[0]] }), { enPlace: null }).refus, `REFUS : x-stock.json : mesure incomplète, rien n'est écrit :\n  ${manque[0]}`)
  const r = decl('x-stock.json', REMESURE, [s(A1)], { manque })
  assert.equal(ecartDeRegeneration(r, texteDeStock('q', [A1])), texteRegenere(r, { enPlace: null }).refus)
  for (const m of [[], undefined]) {
    assert.equal(texteRegenere(decl('x-stock.json', REMESURE, [s(A1)], { manque: m }), { enPlace: texteDeStock('q', []) }).texte, texteDeStock('q', [A1]))
  }
})

test('ecartDeRegeneration : point fixe → null ; périmé → « Stock PÉRIMÉ » ; refus → sa phrase ; soldé absent → null', () => {
  const r = decl('x-stock.json', DECROISSANT, [s(A1)], { horsCollections: 'q' })
  assert.equal(ecartDeRegeneration(r, texteDeStock('q', [A1])), null)
  assert.equal(ecartDeRegeneration(r, texteDeStock('q', [A1, B1])), 'x-stock.json : Stock PÉRIMÉ (entrees=1)')
  assert.match(ecartDeRegeneration(r, texteDeStock('q', [])), /^REFUS : x-stock\.json : entrees/)
  assert.equal(ecartDeRegeneration(decl('x-stock.json', DECROISSANT, [], { horsCollections: 'q' }), null), null)
})

test('les stocks `*Stock.mjs` du dépôt sont des POINTS FIXES de `FORMAT_MJS`', () => {
  const stocks = listerDossier(ICI).filter((f) => f.endsWith('Stock.mjs'))
  assert.ok(stocks.length > 0)
  for (const f of stocks) {
    const texte = readFileSync(join(ICI, f), 'utf8')
    assert.equal(FORMAT_MJS.ecrire(FORMAT_MJS.lire(texte, `scripts/guards/lib/${f}`)), texte, f)
  }
})

// ── Entrées-sorties : `regenererStock` et la commande ──────────────────────────────────────────────

test('regenererStock --check : une liste dont la seconde déclaration est périmée rend 1 ; à jour, 0', () => withTempDir((dir) => {
  const [a, b] = [join(dir, 'a-stock.json'), join(dir, 'b-stock.json')]
  writeFileSync(a, texteDeStock('q', [A1]))
  writeFileSync(b, texteDeStock('q', [A1, B1]))
  const liste = [decl(a, DECROISSANT, [s(A1)]), decl(b, DECROISSANT, [s(A1)])]
  assert.equal(regenererStock(liste, { outil: 'banc', args: ['--check'] }), 1)
  writeFileSync(b, texteDeStock('q', [A1]))
  assert.equal(regenererStock(liste, { outil: 'banc', args: ['--check'] }), 0)
}))

test('regenererStock : écrit le texte régénéré, retire un stock JSON soldé, laisse absent un stock absent', () => withTempDir((dir) => {
  const a = join(dir, 'a-stock.json')
  writeFileSync(a, texteDeStock('q', [A1, B1]))
  assert.equal(regenererStock([decl(a, DECROISSANT, [s(A1)])], { outil: 'banc', args: [] }), 0)
  assert.equal(readFileSync(a, 'utf8'), texteDeStock('q', [A1]))
  assert.equal(regenererStock([decl(a, DECROISSANT, [])], { outil: 'banc', args: [] }), 0)
  assert.equal(existsSync(a), false)
  assert.equal(regenererStock([decl(a, DECROISSANT, [], { horsCollections: 'q' })], { outil: 'banc', args: [] }), 0)
  assert.equal(existsSync(a), false)
}))

test('regenererStock --amorce : l’avertissement nomme chaque stock et sa politique, et la politique reçoit l’amorce', () => withTempDir((dir) => {
  const a = join(dir, 'a-stock.json')
  writeFileSync(a, texteDeStock('q', [A1]))
  const liste = [decl(a, DECROISSANT, [s(A1), s(B1)])]
  assert.equal(regenererStock(liste, { outil: 'banc', args: [] }), 1)
  assert.equal(readFileSync(a, 'utf8'), texteDeStock('q', [A1]))
  const avertissements = []
  const warn = console.warn
  console.warn = (m) => avertissements.push(m)
  try {
    assert.equal(regenererStock(liste, { outil: 'banc', args: ['--amorce'] }), 0)
  } finally {
    console.warn = warn
  }
  assert.equal(readFileSync(a, 'utf8'), texteDeStock('q', [A1, B1]))
  assert.equal(avertissements.length, 1)
  assert.match(avertissements[0], /^AMORÇAGE : .*a-stock\.json, politique DECROISSANT/)
}))

/** La commande sur `args`, par le même `tsx` que `npx tsx`. */
const commande = (args) => spawnSync(process.execPath, ['--import', 'tsx', REGEN, ...args], { cwd: RACINE, encoding: 'utf8' })

test('la commande sans module, avec deux modules ou un drapeau inconnu rend l’usage et le code 2', () => {
  for (const args of [[], ['a.mjs', 'b.mjs'], ['a.mjs', '--ecrire-stock']]) {
    const r = commande(args)
    assert.equal(r.status, 2, JSON.stringify(args))
    assert.match(r.stderr, /Usage : npx tsx scripts\/guards\/lib\/regenStock\.mts <module qui mesure>/)
  }
})

test('la commande refuse, code 2, un module sans `regenerations`, une valeur qui n’est pas une liste, un chemin hors `merge=stocks`', () => withTempDir((dir) => {
  const module = (nom, corps) => { const p = join(dir, nom); writeFileSync(p, corps); return p }
  const sans = module('sans.mjs', 'export const autre = 1\n')
  assert.deepEqual([commande([sans]).status, commande([sans]).stderr.includes(sans)], [2, true])
  const pasListe = module('pas-liste.mjs', 'export function regenerations() { return 3 }\n')
  const r1 = commande([pasListe])
  assert.equal(r1.status, 2)
  assert.ok(r1.stderr.includes(pasListe))
  const hors = join(dir, 'x-stock.json')
  const asynchrone = module('asynchrone.mjs', `export async function regenerations() { return [{ chemin: ${JSON.stringify(hors)}, collections: [] }] }\n`)
  const r2 = commande([asynchrone])
  assert.equal(r2.status, 2)
  assert.ok(r2.stderr.includes(hors), r2.stderr)
  assert.ok(!r2.stderr.includes(asynchrone), r2.stderr)
  const nonSuivi = 'scripts/guards/lib/banc-hors-motif-stock.json'
  const horsMotif = module('hors-motif.mjs', `export function regenerations() { return [{ chemin: ${JSON.stringify(join(RACINE, nonSuivi))}, collections: [] }] }\n`)
  const r3 = commande([horsMotif])
  assert.equal(r3.status, 2)
  assert.ok(r3.stderr.includes(join(RACINE, nonSuivi)), r3.stderr)
  assert.equal(existsSync(join(RACINE, nonSuivi)), false)
}))
