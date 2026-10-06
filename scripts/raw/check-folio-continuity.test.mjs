// Test de la garde `check-folio-continuity` (node --test) : une séquence data-folio non
// consécutive est détectée, une séquence consécutive reste silencieuse, et un folio attendu APRÈS
// la dernière ancre du fichier ne passe plus entre les mailles (#833). Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  folioGapsInText, chapterFolioSpan, scanBookDir, scanAllBooks, sitesDeSauts, regenerations, STOCK_PATH,
  emptyFolioAnchorsInText, scanEmptyFoliosInBook, scanAllEmptyFolios, entreesDAncresVides,
  assertEmptyFoliosAgainstStock, lireStocksAncresVides, EMPTY_PERDUES_PATH, EMPTY_BENIGNES_PATH,
  chapterTexts, SEUIL_UTILE,
} from './check-folio-continuity.mjs'
import { cleDeSite, ecartDuVolet } from '../guards/lib/stock.mjs'
import { regenerations as regenerationsDesAncres, trier } from './lib/empty-folios-stock.mjs'
import {
  FORMAT_JSON, ecartDeRegeneration, entreesRegenerees, lireEntreesDeSite, texteEnPlace, texteRegenere,
} from '../guards/lib/stockDeSites.mjs'
import { BOOKS, livreDuSigle } from './_lib.mjs'
import { parUnitesDeCode } from '../guards/lib/lister.mjs'

/** Un dossier de livre en chemin POSIX — la graphie que le stock et la porte de plage partagent. */
const posixDe = (dir) => String(dir).split('\\').join('/').replace(/\/$/, '')

function span(folio) { return `<span id="page-x-0" data-folio="${folio}"></span>` }

function withTempBookDir(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'folio-continuity-'))
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content, 'utf8')
    fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('folioGapsInText : séquence consécutive → aucun saut', () => {
  const text = `a ${span(10)} b\nc ${span(11)} d\ne ${span(12)} f\n`
  assert.deepEqual(folioGapsInText(text), [])
})

test('folioGapsInText : saut (page manquante) → détecté', () => {
  const text = `a ${span(10)} b\nc ${span(13)} d\n`
  const gaps = folioGapsInText(text)
  assert.equal(gaps.length, 1)
  assert.deepEqual(gaps[0], { from: 10, to: 13, delta: 3 })
})

test('folioGapsInText : plusieurs sauts dans le même fichier → tous détectés', () => {
  const text = `${span(1)} ${span(2)} ${span(5)} ${span(6)} ${span(9)}`
  const gaps = folioGapsInText(text)
  assert.equal(gaps.length, 2)
  assert.deepEqual(gaps[0], { from: 2, to: 5, delta: 3 })
  assert.deepEqual(gaps[1], { from: 6, to: 9, delta: 3 })
})

test('folioGapsInText : aucune ancre → aucun saut (hors sujet)', () => {
  assert.deepEqual(folioGapsInText('rien ici.\n'), [])
})

test('scanBookDir : ne scanne que les fichiers chapitre `NN - *.md`, ignore le reste', () => {
  withTempBookDir({
    '01 - Chapitre.md': `${span(1)} ${span(4)}`,
    'notes.md': `${span(1)} ${span(99)}`, // pas un fichier chapitre → ignoré
  }, (dir) => {
    const gaps = scanBookDir('TEST', dir)
    assert.equal(gaps.length, 1)
    assert.equal(gaps[0].file, '01 - Chapitre.md')
    assert.equal(gaps[0].ref, 'TEST 1')
    assert.equal(gaps[0].abbr, 'TEST')
    assert.equal(gaps[0].nn, 1)
  })
})

test('scanBookDir : dossier introuvable → aucun saut (hors sujet)', () => {
  assert.deepEqual(scanBookDir('TEST', join(tmpdir(), 'dossier-inexistant-xyz')), [])
})

test('scanAllBooks : agrège plusieurs livres', () => {
  const parent = mkdtempSync(join(tmpdir(), 'folio-continuity-books-'))
  const dirA = join(parent, 'A'); mkdirSync(dirA)
  const dirB = join(parent, 'B'); mkdirSync(dirB)
  try {
    writeFileSync(join(dirA, '01 - X.md'), `${span(1)} ${span(3)}`, 'utf8')
    writeFileSync(join(dirB, '02 - Y.md'), `${span(1)} ${span(2)}`, 'utf8')
    const gaps = scanAllBooks([['A', dirA], ['B', dirB]])
    assert.equal(gaps.length, 1)
    assert.equal(gaps[0].ref, 'A 1')
  } finally {
    rmSync(parent, { recursive: true, force: true })
  }
})

// ---------- volet FIN de fichier (#833) ----------

function chapter(pdfLo, pdfHi, folios, offset = 1) {
  const body = folios.map((f) => `<span id="page-${f + offset}-0" data-folio="${f}"></span>prose du folio ${f}`).join('\n')
  return `*Pages PDF ${pdfLo}-${pdfHi}*\n\n${body}\n`
}

test('chapterFolioSpan : plage attendue (en-tête + offset lu sur les ancres) et dernier folio ancré', () => {
  assert.deepEqual(chapterFolioSpan(chapter(25, 36, [23, 24, 25])), { expectedHi: 34, last: 25 })
})

test('chapterFolioSpan : sans en-tête, sans ancre, ou offset non unique → null', () => {
  assert.equal(chapterFolioSpan('pas d’en-tête\n'), null)
  assert.equal(chapterFolioSpan('*Pages PDF 25-36*\n\nprose sans ancre\n'), null)
  const bancal = '*Pages PDF 25-36*\n\n<span id="page-24-0" data-folio="23"></span>a\n<span id="page-30-0" data-folio="25"></span>b\n'
  assert.equal(chapterFolioSpan(bancal), null)
})

test('scanBookDir : folio attendu APRÈS la dernière ancre et ancré nulle part → trou rapporté', () => {
  withTempBookDir({ '15 - Fin.md': chapter(217, 228, [215, 216, 217]) }, (dir) => {
    const gaps = scanBookDir('TEST', dir).filter((g) => g.kind === 'fin')
    assert.equal(gaps.length, 1)
    assert.deepEqual([gaps[0].from, gaps[0].to, gaps[0].delta], [217, 226, 9])
    assert.equal(gaps[0].ref, 'TEST 15')
  })
})

test('scanBookDir : folio de fin ancré dans le chapitre SUIVANT (page partagée) → aucun trou', () => {
  withTempBookDir({
    '01 - A.md': chapter(10, 13, [8, 9, 10]),        // attend 8..11, s'arrête à 10
    '02 - B.md': chapter(13, 16, [11, 12, 13, 14]),  // le folio 11 vit ici
  }, (dir) => {
    assert.deepEqual(scanBookDir('TEST', dir).filter((g) => g.kind === 'fin'), [])
  })
})

test('scanBookDir : la séquence SEULE est aveugle en fin de fichier — le second volet la couvre', () => {
  withTempBookDir({ '15 - Fin.md': chapter(217, 228, [215, 216, 217]) }, (dir) => {
    const text = chapter(217, 228, [215, 216, 217])
    assert.deepEqual(folioGapsInText(text), [], 'aucun delta ≠ 1 : le trou est APRÈS la dernière ancre')
    assert.equal(scanBookDir('TEST', dir).length, 1)
  })
})

// ---------- passe 1 : le STOCK NOMINATIF des sauts (#1711 T4) ----------

test('sitesDeSauts : un site = le CHAPITRE EXTRAIT et le saut lui-même, jamais le chapitre seul', () => {
  withTempBookDir({ '01 - Chapitre.md': `${span(1)} ${span(4)} ${span(8)}` }, (dir) => {
    const gaps = scanBookDir('TEST', dir)
    assert.equal(gaps.length, 2, 'deux sauts dans le MÊME chapitre')
    const sites = sitesDeSauts(gaps)
    assert.deepEqual(sites.map((s) => s.ref), ['TEST 1 1→4', 'TEST 1 4→8'], 'chaque saut a sa propre clé')
    for (const s of sites) assert.equal(s.file, `${dir.split('\\').join('/')}/01 - Chapitre.md`, 'le site nomme le chapitre par son CHEMIN')
  })
})

test('scanBookDir : `path` est le chemin POSIX du chapitre, celui que la porte de plage reconnaît', () => {
  // Le corpus RENVOIE le livre : le premier saut mesuré fait foi — aucun sigle ni rang écrit ici.
  let gap, dir
  for (const [a, d] of BOOKS) { gap = scanBookDir(a, d)[0]; dir = d; if (gap) break }
  assert.ok(gap, 'le corpus `Source/` porte au moins un saut de folio mesuré')
  assert.equal(gap.path, `${dir}/${gap.file}`)
  assert.match(gap.path, /^Source\/[^\\]+\.md$/, 'racine `Source/`, séparateurs POSIX, extension `.md`')
})

test('stock COMMITTÉ : chaque saut mesuré y a son entrée, et aucune entrée n’est soldée', () => {
  const { neuves, perimees } = ecartDuVolet({
    sites: sitesDeSauts(scanAllBooks()), stock: lireEntreesDeSite(STOCK_PATH), ou: 'folio-gaps-stock.json',
  })
  assert.deepEqual(neuves, [], `saut(s) de folio hors du stock :\n${neuves.join('\n')}`)
  assert.deepEqual(perimees, [], `entrée(s) SOLDÉE(s) à retirer :\n${perimees.join('\n')}`)
})

test('stock COMMITTÉ : chaque entrée nomme son chapitre et son saut de folio', () => {
  const entrees = lireEntreesDeSite(STOCK_PATH)
  for (const e of entrees) {
    assert.match(e.fichier, /^Source\/.+\.md$/, `entrée sans chapitre extrait : ${JSON.stringify(e)}`)
    assert.match(e.ref, /^.+ \d+→\d+$/, `entrée sans saut de folio : ${JSON.stringify(e)}`)
  }
})

// Le stock EST le point fixe de `regenerations()`, régénéré par
// `npx tsx scripts/guards/lib/regenStock.mts scripts/raw/check-folio-continuity.mjs` : ce test le
// vérifie à l'octet, donc à la clé ET à l'ORDRE, là où `ecartDuVolet` ci-dessus ne juge que les
// ensembles. Un stock ré-ordonné à la main rougit ici.
test('stock COMMITTÉ : le rendu EXACT et ORDONNÉ des sites mesurés sur l’arbre', () => {
  for (const r of regenerations()) assert.equal(ecartDeRegeneration(r, texteEnPlace(r.chemin)), null)
})

// L'ÉCHÉANCE (`lot`, `date`) n'est PAS un paramètre de la régénération sous `DECROISSANT`, et ce test
// dit pourquoi : `survieDeLecheance` ne pose une échéance NEUVE que sur une entrée dont la clé manque au
// stock, et c'est exactement la classe que `DECROISSANT` refuse d'écrire. Les deux volets se mesurent
// ENSEMBLE : sur le stock réel, zéro entrée neuve ; sur un stock amputé, l'entrée neuve existe ET la
// barrière la nomme.
test('échéance : seule une entrée HORS du stock la prendrait — et celle-là est REFUSÉE', () => {
  const [r] = regenerations()
  const enPlace = texteEnPlace(r.chemin)
  const image = FORMAT_JSON.lire(enPlace)
  const ancien = image.collections.get('entrees')
  const sites = r.collections[0].sites
  const sansEcheance = (entrees) => entrees.filter((e) => !e.lot && !e.date)
  assert.deepEqual(sansEcheance(entreesRegenerees(sites, { ancien })), [],
    'une entrée écrite sans échéance : elle vient d’ailleurs que du stock commité')

  const ampute = ancien.slice(1)
  const neuves = sansEcheance(entreesRegenerees(sites, { ancien: ampute }))
  assert.equal(neuves.length, 1, 'le volet est inerte : retirer une entrée n’en rend aucune neuve')
  const { refus } = texteRegenere(r, {
    enPlace: FORMAT_JSON.ecrire({ horsCollections: image.horsCollections, collections: new Map([['entrees', ampute]]) }),
  })
  assert.ok(refus?.includes(ancien[0].ref), `la barrière NOMME le saut neuf : ${refus}`)
})

// La RÉGÉNÉRATION rend le fichier COMMITTÉ à l'octet — échéances manuscrites (`lot`, `date`)
// comprises, par `survieDeLecheance`. Sans cette épreuve, une régénération qui rajeunit les dates ou
// reformate le JSON passerait inaperçue jusqu'au prochain commit.
test('régénérateur : ré-écrire le stock en place rend le MÊME octet', () => {
  const [r] = regenerations()
  assert.equal(texteRegenere(r, { enPlace: texteEnPlace(r.chemin) }).texte, readFileSync(STOCK_PATH, 'utf8'))
})

// #1825 : l'ordre des livres vit dans `src/data/books.json` et n'a aucune raison d'être figé.
// Le stock COMMITTÉ ne doit donc rien à cet ordre — sinon déplacer une entrée du registre (insérer
// un livre ailleurs qu'à la fin) forcerait à réécrire un artefact, et le critère « un livre de plus =
// UNE entrée de books.json » tomberait. Registre INJECTÉ (`scanAllBooks(books)`), jamais le fichier.
test('#1825 le rendu du stock est INDIFFÉRENT à l’ordre du registre (registre inversé)', () => {
  const sitesDe = (books) => sitesDeSauts(scanAllBooks(books)).map((s) => `${s.file} :: ${s.ref}`)
  const rendu = (books) => texteRegenere(regenerations(scanAllBooks(books))[0], { enPlace: texteEnPlace(STOCK_PATH) }).texte
  const inverse = [...BOOKS].reverse()
  assert.notDeepEqual(sitesDe(inverse), sitesDe(BOOKS), 'le balayage rend le même ordre : sonde inerte')
  assert.equal(rendu(inverse), rendu(BOOKS))
})

test('stock TRUQUÉ : une entrée retirée rend son site NEUF, une entrée sans site est SOLDÉE', () => {
  const sites = sitesDeSauts(scanAllBooks())
  const stock = lireEntreesDeSite(STOCK_PATH)
  const ampute = ecartDuVolet({ sites, stock: stock.slice(1), ou: 'folio-gaps-stock.json' })
  assert.equal(ampute.neuves.length, 1)
  assert.match(ampute.neuves[0], /site NEUF/)
  assert.ok(ampute.neuves[0].includes(stock[0].ref), `le rouge NOMME le saut : ${ampute.neuves[0]}`)
  assert.deepEqual(ampute.perimees, [])

  const fantome = { ...stock[0], ref: `${stock[0].ref}0` }
  const gonfle = ecartDuVolet({ sites, stock: [...stock, fantome], ou: 'folio-gaps-stock.json' })
  assert.deepEqual(gonfle.neuves, [])
  assert.equal(gonfle.perimees.length, 1)
  assert.match(gonfle.perimees[0], /entrée SOLDÉE/)
})

// ---------- passe 2 : ancre SANS CONTENU (#1457) ----------

test('emptyFolioAnchorsInText : ancres COLLÉES (0 octet) → page sans contenu détectée', () => {
  const text = `prose ${span(87)}page 87\n${span(88)}${span(89)}page 89\n`
  assert.deepEqual(emptyFolioAnchorsInText(text).map((e) => e.folio), [88])
})

test('emptyFolioAnchorsInText : ancres séparées par des BLANCS SEULS → détectée aussi', () => {
  const text = `${span(10)}\n\n   \n\t\n${span(11)}prose du 11\n`
  const vides = emptyFolioAnchorsInText(text)
  assert.equal(vides.length, 1)
  assert.equal(vides[0].folio, 10)
})

test('emptyFolioAnchorsInText : le moindre contenu utile entre deux ancres → rien à signaler', () => {
  assert.deepEqual(emptyFolioAnchorsInText(`${span(10)}\n\n#\n\n${span(11)}`), [])
  assert.deepEqual(emptyFolioAnchorsInText(`${span(10)} prose ${span(11)} prose ${span(12)}`), [])
})

test('emptyFolioAnchorsInText : la DERNIÈRE ancre du fichier est hors sujet (page partagée avec le chapitre suivant)', () => {
  assert.deepEqual(emptyFolioAnchorsInText(`${span(10)}prose\n${span(11)}\n\n`), [])
})

test('emptyFolioAnchorsInText : la séquence est CONSÉCUTIVE et pourtant la page est perdue — la passe 1 est aveugle', () => {
  const text = `${span(87)}prose du 87\n${span(88)}${span(89)}prose du 89\n`
  assert.deepEqual(folioGapsInText(text), [], 'delta 1 partout : aucun saut')
  assert.deepEqual(emptyFolioAnchorsInText(text).map((e) => e.folio), [88])
})

test('scanEmptyFoliosInBook : nomme livre, chapitre, CHEMIN du chapitre, folio et ligne', () => {
  withTempBookDir({ '08 - Statut.md': `intro\n${span(87)}prose\n${span(88)}${span(89)}suite\n` }, (dir) => {
    const vides = scanEmptyFoliosInBook('TEST', dir)
    assert.equal(vides.length, 1)
    assert.deepEqual(
      { ref: vides[0].ref, file: vides[0].file, folio: vides[0].folio, line: vides[0].line },
      { ref: 'TEST 8', file: '08 - Statut.md', folio: 88, line: 3 },
    )
    assert.equal(vides[0].fichier, `${posixDe(dir)}/08 - Statut.md`, 'le CHEMIN complet du chapitre, le seul nom que le stock et la porte de plage partagent')
  })
})

const CHAP = 'Source/WH - V4 - Le zoo imperial/05 - Amibe.md'
const MESURE_PERDUE = { abbr: 'ZI', fichier: CHAP, ref: 'ZI 5', folio: 62, line: 10 }
const MESURE_BENIGNE = { abbr: 'ZI', fichier: CHAP, ref: 'ZI 5', folio: 58, line: 5 }
const PERDUE = { fichier: CHAP, ref: 'ZI 5 folio 62', occurrence: 1, pdfChars: 2136 }
const BENIGNE = { fichier: CHAP, ref: 'ZI 5 folio 58', occurrence: 1, pdfChars: 12 }

test('entreesDAncresVides : une mesure devient une entrée `{ fichier, ref, occurrence }`, et la clé se CALCULE', () => {
  assert.deepEqual(entreesDAncresVides([MESURE_PERDUE]), [{ fichier: CHAP, ref: 'ZI 5 folio 62', occurrence: 1, line: 10 }])
  assert.equal(cleDeSite(entreesDAncresVides([MESURE_PERDUE])[0]), cleDeSite(PERDUE), 'mesure et entrée de stock rendent la MÊME clé')
})

test('assertEmptyFoliosAgainstStock : stock aligné → aucune anomalie', () => {
  const stock = { perdues: [PERDUE], benignes: [BENIGNE] }
  assert.deepEqual(assertEmptyFoliosAgainstStock([MESURE_PERDUE, MESURE_BENIGNE], stock), { inconnues: [], restituees: [], benignesDisparues: [], malClassees: [] })
})

test('assertEmptyFoliosAgainstStock : ancre sans contenu ABSENTE du stock → régression nominative', () => {
  const r = assertEmptyFoliosAgainstStock([MESURE_PERDUE], { perdues: [], benignes: [] })
  assert.deepEqual(r.inconnues.map(cleDeSite), [cleDeSite(PERDUE)])
})

test('assertEmptyFoliosAgainstStock : page RESTITUÉE → entrée périmée, le stock doit décroître', () => {
  const r = assertEmptyFoliosAgainstStock([], { perdues: [PERDUE], benignes: [] })
  assert.deepEqual(r.restituees, [PERDUE])
  assert.deepEqual(r.inconnues, [])
  assert.deepEqual(r.malClassees, [])
})

test('assertEmptyFoliosAgainstStock : entrée bénigne sans mesure → périmée elle aussi', () => {
  const r = assertEmptyFoliosAgainstStock([], { perdues: [], benignes: [BENIGNE] })
  assert.deepEqual(r.benignesDisparues, [BENIGNE])
})

// ---------- le SEUIL vit dans le CODE, et il est opposé au stock (#1457 grief G1, #1727 T2) ----------

test('assertEmptyFoliosAgainstStock : perdue reclassée bénigne → MAL CLASSÉE nominative (le blanchiment est REFUSÉ)', () => {
  const r = assertEmptyFoliosAgainstStock([MESURE_PERDUE], { perdues: [], benignes: [PERDUE] })
  assert.deepEqual(r.malClassees.map((e) => [cleDeSite(e), e.cls, e.pdfChars]), [[cleDeSite(PERDUE), 'benignes', 2136]])
  assert.deepEqual([r.inconnues, r.restituees, r.benignesDisparues], [[], [], []], 'les trois autres volets restent muets : seul le classement ment')
})

test('assertEmptyFoliosAgainstStock : bénigne promue perdue → MAL CLASSÉE elle aussi (la règle est une équivalence)', () => {
  const r = assertEmptyFoliosAgainstStock([MESURE_BENIGNE], { perdues: [BENIGNE], benignes: [] })
  assert.deepEqual(r.malClassees.map((e) => [cleDeSite(e), e.cls]), [[cleDeSite(BENIGNE), 'perdues']])
})

test('aucun stock ne porte de champ `seuil` : le seul critère est SEUIL_UTILE', () => {
  for (const chemin of [EMPTY_PERDUES_PATH, EMPTY_BENIGNES_PATH]) {
    const json = JSON.parse(readFileSync(chemin, 'utf8'))
    assert.deepEqual(Object.keys(json), ['quoi', 'entrees'], `${chemin} : la forme nominative, et RIEN d’autre — une copie du seuil en donnée se relèverait dans le MÊME geste que le reclassement qu’elle doit dénoncer`)
  }
  assert.equal(SEUIL_UTILE, 200, 'le seuil COMMITTÉ, en UN endroit : check-folio-continuity.mjs, chez la garde qui l’oppose au stock')
  const r = assertEmptyFoliosAgainstStock([MESURE_PERDUE], { perdues: [], benignes: [PERDUE] })
  assert.equal(r.malClassees[0]?.seuil, SEUIL_UTILE, 'la garde nomme le seuil au nom duquel elle refuse, et c’est celui du code')
})

test('un `--seuil` complaisant ne vit que dans l’INSTRUMENT : le stock qu’il rend est DÉMENTI par la garde', () => {
  const mesures = [{ ...MESURE_PERDUE, pdfChars: PERDUE.pdfChars }, { ...MESURE_BENIGNE, pdfChars: BENIGNE.pdfChars }]
  const large = trier(mesures, 5000)
  assert.deepEqual(large.perdues, [], 'régénérer avec `--seuil 5000` vide la classe PERDUES…')
  assert.equal(large.benignes.length, 2)
  const stockLarge = { perdues: entreesRegenerees(large.perdues), benignes: entreesRegenerees(large.benignes) }
  const r = assertEmptyFoliosAgainstStock([MESURE_PERDUE, MESURE_BENIGNE], stockLarge)
  assert.deepEqual(r.malClassees.map(cleDeSite), [cleDeSite(PERDUE)], '… et la garde, qui ne connaît que SEUIL_UTILE, nomme l’entrée blanchie')
  assert.deepEqual(entreesRegenerees(trier(mesures, SEUIL_UTILE).perdues).map(cleDeSite), [cleDeSite(PERDUE)], 'au seuil du code, elle est PERDUE')
})

test('assertEmptyFoliosAgainstStock : entrée sans `pdfChars` → INAUDITABLE, donc mal classée', () => {
  const nue = { fichier: CHAP, ref: 'ZI 5 folio 62', occurrence: 1 }
  const r = assertEmptyFoliosAgainstStock([MESURE_PERDUE], { perdues: [nue], benignes: [] })
  assert.deepEqual(r.malClassees.map((e) => [cleDeSite(e), e.pdfChars]), [[cleDeSite(PERDUE), undefined]], 'une entrée sans mesure ne s’oppose à aucun seuil : c’est le même contournement par une autre porte')
  assert.equal(assertEmptyFoliosAgainstStock([MESURE_PERDUE], { perdues: [PERDUE], benignes: [] }).malClassees.length, 0, 'la même entrée, mesure à l’appui, passe')
})

// ---------- les stocks COMMITTÉS, confrontés au corpus réel ----------

const STOCK = lireStocksAncresVides()

test('stock : le folio 88 du LDB (carrière de Juriste) est RESTITUÉ — porteur au corpus, absent de la mesure comme du stock', () => {
  const dir = livreDuSigle('LDB').dir
  const cle = cleDeSite({ fichier: `${posixDe(dir)}/08 - Statut.md`, ref: 'LDB 8 folio 88', occurrence: 1 })
  const md = readFileSync(join(dir, '08 - Statut.md'), 'utf8')
  const page = md.split('data-folio="88"')[1].split('data-folio="89"')[0]
  assert.match(page, /\*\*JURISTE\*\* Halfling, Haut Elfe, Humain, Nain/, 'titre et espèces de la page')
  assert.match(page, /Schéma de Progression du Juriste/, 'schéma de progression')
  for (const niveau of ['Étudiant en Droit – Bronze 4', 'Juriste – Argent 3', 'Maître du Barreau – Or 1', 'Juge – Or 2']) {
    assert.ok(page.includes(niveau), `niveau « ${niveau} » au corpus`)
  }
  assert.ok(!entreesDAncresVides(scanEmptyFoliosInBook('LDB', dir)).some((e) => cleDeSite(e) === cle), 'le détecteur ne voit plus de page 88 sans contenu')
  assert.ok(!STOCK.perdues.some((e) => cleDeSite(e) === cle), 'et le stock ne la porte plus')
})

test('stock : chaque ancre sans contenu du corpus est triée, et aucune entrée périmée', () => {
  const r = assertEmptyFoliosAgainstStock(scanAllEmptyFolios(), STOCK)
  assert.deepEqual(r.inconnues.map(cleDeSite), [], 'ancre sans contenu non triée (relancer npx tsx scripts/guards/lib/regenStock.mts scripts/raw/lib/empty-folios-stock.mjs)')
  assert.deepEqual(r.restituees.map(cleDeSite), [], 'page restituée : supprimer l’entrée du stock')
  assert.deepEqual(r.benignesDisparues.map(cleDeSite), [], 'entrée bénigne périmée : la supprimer du stock')
  assert.deepEqual(r.malClassees.map(cleDeSite), [], 'classement démenti par le pdfChars mesuré')
})

test('stock : les DEUX fichiers committés SONT ce que la fonction d’ÉCRITURE du générateur rend, à l’octet', () => {
  // Les mesures telles que le générateur les tenait : le PDF n'est pas suivi, `pdfChars` se RELIT
  // au stock, il ne se re-mesure pas.
  const mesures = [...STOCK.perdues, ...STOCK.benignes]
    .map((e) => {
      const m = /^(.+) folio (-?\d+)$/.exec(e.ref)
      assert.ok(m, `réf non conforme : ${e.ref}`)
      return { fichier: e.fichier, ref: m[1], folio: Number(m[2]), pdfChars: e.pdfChars }
    })
    .sort((a, b) => parUnitesDeCode(a.ref, b.ref) || a.folio - b.folio)
  const declarations = regenerationsDesAncres({ mesures, manque: [] }, SEUIL_UTILE)
  assert.deepEqual(declarations.map((r) => r.chemin), [EMPTY_PERDUES_PATH, EMPTY_BENIGNES_PATH])
  for (const r of declarations) {
    assert.equal(ecartDeRegeneration(r, texteEnPlace(r.chemin)), null, `${r.chemin} : le fichier committé et le rendu du générateur divergent — régénérer, jamais éditer à la main`)
  }
  const { perdues, benignes } = trier(mesures, SEUIL_UTILE)
  assert.deepEqual([perdues.length, benignes.length], [STOCK.perdues.length, STOCK.benignes.length], 'le tri au seuil du code redonne les deux classes committées')
})

test('le stock committé est un point fixe de sa régénération', (t) => {
  for (const r of regenerationsDesAncres()) {
    if (r.manque.length > 0) {
      t.skip(r.manque.join(' ; '))
      return
    }
    assert.equal(ecartDeRegeneration(r, texteEnPlace(r.chemin)), null)
  }
})

test('une mesure incomplète refuse, rien n’est écrit', () => {
  const phrase = 'ZI — NON TRIABLE (PDF absent) : 3 candidat(s)'
  const declarations = regenerationsDesAncres({ mesures: [], manque: [phrase] }, SEUIL_UTILE)
  assert.equal(declarations.length, 2)
  for (const r of declarations) {
    const ecart = ecartDeRegeneration(r, texteEnPlace(r.chemin))
    assert.ok(ecart?.includes('mesure incomplète') && ecart.includes(phrase), `${r.chemin} : ${ecart}`)
  }
})

test('stock COMMITTÉ truqué : déplacer une PERDUE vers `benignes` → rouge NOMINATIF (le compte baissait sans un mot)', () => {
  const deplacee = STOCK.perdues[0]
  const truque = { perdues: STOCK.perdues.slice(1), benignes: [...STOCK.benignes, deplacee] }
  const r = assertEmptyFoliosAgainstStock(scanAllEmptyFolios(), truque)
  assert.deepEqual(r.malClassees.map(cleDeSite), [cleDeSite(deplacee)], 'l’entrée déplacée est nommée')
  assert.equal(r.malClassees[0].cls, 'benignes')
  assert.ok(r.malClassees[0].pdfChars > SEUIL_UTILE, 'et c’est son pdfChars mesuré qui la dément')
  assert.deepEqual([r.inconnues, r.restituees, r.benignesDisparues].map((a) => a.length), [0, 0, 0], 'aucun autre volet ne bronche : ce volet est le seul qui voie le reclassement')
})

// ---------- frontière de COUVERTURE : les fins de LIVRE (angle mort déclaré, #1457 grief G2) ----------

test('couverture : la DERNIÈRE ancre de chaque LIVRE est hors mesure — aucun chapitre suivant ne la reprend', () => {
  const mesure = scanAllEmptyFolios()
  // Le périmètre est le REGISTRE (`BOOKS`), jamais une liste de livres recopiée : un livre de plus
  // entre ici par `books.json`, avec sa propre dernière ancre lue au disque (#1825).
  // Un livre SANS aucune ancre de folio n'est pas un saut muet : c'est un cas NOMMÉ et COMPTÉ
  // (l'extraction Marker ne bake pas le folio imprimé de tous les livres). Les deux populations
  // recouvrent le registre entier — aucun livre ne disparaît entre les deux.
  const vus = []
  const sansAncre = []
  for (const [abbr, dir] of BOOKS) {
    const texts = chapterTexts(dir)
    const dernier = [...texts.keys()].pop()
    const ancres = dernier === undefined
      ? []
      : [...texts.get(dernier).matchAll(/data-folio="(-?\d+)"/g)].map((m) => Number(m[1]))
    const folio = ancres.pop()
    if (folio === undefined) { sansAncre.push(abbr); continue }
    vus.push(abbr)
    assert.ok(!mesure.some((e) => e.abbr === abbr && e.folio === folio), `${abbr} ${folio} (${dernier}) : hors mesure, faute de paire d’ancres`)
  }
  assert.equal(vus.length + sansAncre.length, BOOKS.length, `livres du registre non classés : vus [${vus}] / sans ancre [${sansAncre}] contre ${BOOKS.length} livres`)
  assert.ok(vus.length > 0, `aucune dernière ancre lue : le banc serait vert par vacuité (sans ancre : ${sansAncre})`)
})

// ---------- MORSURE sur le CAS D'OR réel : la page 88 du LDB, re-vidée EN MÉMOIRE (#1457, grief G4) ----------

test('détecteur : re-vider le folio 88 du VRAI `08 - Statut.md` le fait ressortir, et le stock le dénonce comme INCONNU', () => {
  const dir = livreDuSigle('LDB').dir
  const md = readFileSync(join(dir, '08 - Statut.md'), 'utf8')
  const finAncre88 = md.indexOf('</span>', md.indexOf('data-folio="88"')) + '</span>'.length
  const debutAncre89 = md.lastIndexOf('<span', md.indexOf('data-folio="89"'))
  assert.ok(finAncre88 > 0 && debutAncre89 > finAncre88, 'les ancres 88 puis 89 se suivent bien dans le chapitre')
  const revide = `${md.slice(0, finAncre88)}\n\n${md.slice(debutAncre89)}`

  assert.deepEqual(emptyFolioAnchorsInText(md), [], 'au corpus COMMITTÉ, le chapitre ne porte aucune ancre sans contenu')
  const vides = emptyFolioAnchorsInText(revide)
  assert.equal(vides.length, 1)
  assert.equal(vides[0].folio, 88, 'la page 88 vidée de son contenu utile est celle que le détecteur nomme')

  const fichier = `${posixDe(dir)}/08 - Statut.md`
  const mesure = [...scanAllEmptyFolios(), { abbr: 'LDB', fichier, ref: 'LDB 8', folio: 88, line: vides[0].line }]
  const r = assertEmptyFoliosAgainstStock(mesure, STOCK)
  assert.deepEqual(r.inconnues.map(cleDeSite), [cleDeSite({ fichier, ref: 'LDB 8 folio 88', occurrence: 1 })], 'perte NON triée → nommée par la garde')
  assert.deepEqual([r.restituees, r.benignesDisparues, r.malClassees].map((a) => a.length), [0, 0, 0], 'aucun autre volet ne bronche : la perte n’entrait que par celui-là')
})
