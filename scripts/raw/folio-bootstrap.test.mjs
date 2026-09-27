// Tests de l'amorce d'ancrage `folio-bootstrap` (node --test) : lecture du folio imprimé, offset
// K−folio, plage de corpus, compactage en runs (#833). Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readPrintedFolio, resolveOffsetFromPdf, corpusRange, folioRuns, texteDePage } from './folio-bootstrap.mjs'

function withTempBookDir(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'folio-bootstrap-'))
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content, 'utf8')
    return fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ---------- readPrintedFolio ----------

test('readPrintedFolio : nombre nu en TÊTE de page → folio lu', () => {
  assert.equal(readPrintedFolio('24\nIV\nWARHAMMER FANTASY\nDu texte de prose.'), 24)
})

test('readPrintedFolio : nombre nu en PIED de page → folio lu', () => {
  assert.equal(readPrintedFolio('Du texte de prose.\nencore du texte\nsuite\nfin de page\nII\n137'), 137)
})

test('readPrintedFolio : aucun nombre nu isolé → null, jamais une valeur devinée', () => {
  assert.equal(readPrintedFolio('Page 24 sur 300\nUn Test de Calme (+20) et 1d10 dégâts.'), null)
  assert.equal(readPrintedFolio(''), null)
  assert.equal(readPrintedFolio(null), null)
})

test('readPrintedFolio : un nombre nu au MILIEU de la page est hors portée de la sonde', () => {
  const page = ['tete', 'a', 'b', 'c', '99', 'd', 'e', 'f', 'pied'].join('\n')
  assert.equal(readPrintedFolio(page), null)
})

test('readPrintedFolio : bandeau de DOUBLE PAGE (deux folios imprimés) → null', () => {
  // CRB K230 (offset réel −1, folio 231) : le bandeau de la planche imprime 230 ET 231 sur la page.
  const page = ['VIII', 'WARHAMMER FANTASY ROLEPLAY', '230', 'MA gic', '231', 'The Lore of Light',
    'The Lore of Light relates to Hysh, the White Wind.'].join('\n')
  assert.equal(readPrintedFolio(page), null)
})

test('readPrintedFolio : cellule de table `d10` valant 0 → null (0 n’est pas un folio)', () => {
  // CRB K269, pied de la table FELLOW TRAVELLERS.
  const page = ['WARHAMMER FANTASY ROLEPLAY', '270 271', 'FELLOW TRAVELLERS', 'd10 Encounter',
    'Salt of the Old World: Rustic folk such as a farmer driving a herd of sheep.',
    '0', 'Travellers from Distant Lands: An Estalian diestro seeking a challenge.'].join('\n')
  assert.equal(readPrintedFolio(page), null)
})

test('readPrintedFolio : second nombre nu AILLEURS dans la page → lecture ambiguë, null', () => {
  // CRB K269 lu à 5 lignes de bord : la cellule `1` de la table devenait un folio.
  const page = ['WARHAMMER FANTASY ROLEPLAY', '270 271', 'FELLOW TRAVELLERS', 'd10 Encounter', '1',
    'Salt of the Old World: Rustic folk.', '272'].join('\n')
  assert.equal(readPrintedFolio(page), null)
})

test('readPrintedFolio : folio imprimé + cellule `0` à côté → le folio est lu (0 hors ambiguïté)', () => {
  const page = ['231', 'THE LORE OF LIGHT', 'd10 Effect', '0', 'Rien ne se produit.'].join('\n')
  assert.equal(readPrintedFolio(page), 231)
})

test('readPrintedFolio : folio imprimé + cellule `1` au milieu → null (1 entre dans l’ambiguïté)', () => {
  const page = ['231', 'THE LORE OF LIGHT', 'a', 'b', 'd10 Effect', '1', 'Un effet.', 'suite', 'fin'].join('\n')
  assert.equal(readPrintedFolio(page), null)
})

test('readPrintedFolio : page SANS folio imprimé, un unique nombre nu aux bords → lecture RENDUE', () => {
  // La fonction ne peut pas savoir que `48` est la légende d’une planche et non un folio : elle rend
  // la lecture, et c’est l’unicité de l’offset (`resolveOffsetFromPdf` : « offset NON unique →
  // abandon ») qui la récuse.
  assert.equal(readPrintedFolio(['PLANCHE', 'Carte du Reikland', '48'].join('\n')), 48)
})

test('readPrintedFolio : le MÊME nombre en tête ET en pied reste univoque → lu', () => {
  assert.equal(readPrintedFolio(['272', 'WARHAMMER FANTASY ROLEPLAY', 'texte de prose', '272'].join('\n')), 272)
})

test('readPrintedFolio : folio SEUL en pied, texte sans autre nombre nu → lu', () => {
  // CRB K271 (folio 272) : `272 273` du bandeau n’est pas un nombre NU, il ne gêne pas.
  const page = ['WARHAMMER FANTASY ROLEPLAY', '272 273', 'GLORIOUS REIKLAND',
    'Standing proud in the heart of the Old World.', '272'].join('\n')
  assert.equal(readPrintedFolio(page), 272)
})

test('texteDePage : le folio de pied d’une colonne, au MILIEU de l’ordre de lecture, revient en bord de texte → lu', () => {
  const colonne = (x) => [700, 660, 620, 580, 540].map((y0, i) => ({ texte: `ligne ${x} ${i} de prose`, x0: x, y0 }))
  const lecture = [...colonne(50), { texte: '272', x0: 60, y0: 30 }, ...colonne(320)]
  assert.equal(readPrintedFolio(lecture.map((l) => l.texte).join('\n')), null)
  assert.equal(readPrintedFolio(texteDePage(lecture)), 272)
})

// ---------- resolveOffsetFromPdf ----------

test('resolveOffsetFromPdf : offset K−folio constant → accepté, avec ses lectures', () => {
  const pages = [[10, '7\ntexte'], [11, '8\ntexte'], [12, '9\ntexte']]
  const off = resolveOffsetFromPdf(pages)
  assert.equal(off.ok, true)
  assert.equal(off.offset, 3)
  assert.deepEqual(off.reads.map((r) => r.folio), [7, 8, 9])
})

test('resolveOffsetFromPdf : page sans folio lisible → ignorée, jamais fatale', () => {
  const off = resolveOffsetFromPdf([[10, '7\ntexte'], [11, 'planche pleine page'], [12, '9\ntexte']])
  assert.equal(off.ok, true)
  assert.equal(off.offset, 3)
  assert.equal(off.reads.length, 2)
})

test('resolveOffsetFromPdf : offset NON unique → abandon (jamais rattrapé par une majorité)', () => {
  const off = resolveOffsetFromPdf([[10, '7\na'], [11, '8\nb'], [12, '4\nc']])
  assert.equal(off.ok, false)
  assert.match(off.reason, /non unique/)
})

test('resolveOffsetFromPdf : aucune page folioée → abandon', () => {
  const off = resolveOffsetFromPdf([[10, 'planche'], [11, 'planche']])
  assert.equal(off.ok, false)
  assert.match(off.reason, /aucun folio imprimé/)
})

// ---------- corpusRange ----------

test('corpusRange : min/max des en-têtes `*Pages PDF N[-M]*`, en K (0-based)', () => {
  const range = withTempBookDir({
    '01 - A.md': '*Pages PDF 10-23*\n\ntexte',
    '02 - B.md': '*Pages PDF 24-40*\n\ntexte',
    '03 - C.md': '*Pages PDF 41*\n\ntexte',
  }, corpusRange)
  assert.deepEqual(range, { lo: 9, hi: 40 })
})

test('corpusRange : fichier sans en-tête ignoré ; aucun en-tête du tout → null', () => {
  const withOne = withTempBookDir({ '01 - A.md': '*Pages PDF 10-23*\n', '02 - B.md': 'sans en-tête\n' }, corpusRange)
  assert.deepEqual(withOne, { lo: 9, hi: 22 })
  assert.equal(withTempBookDir({ '01 - A.md': 'sans en-tête\n' }, corpusRange), null)
})

// ---------- folioRuns ----------

test('folioRuns : suite continue → un seul run', () => {
  const reads = [{ k: 10, folio: 7 }, { k: 11, folio: 8 }, { k: 12, folio: 9 }]
  assert.deepEqual(folioRuns(reads), [{ kFrom: 10, kTo: 12, folioFrom: 7, folioTo: 9 }])
})

test('folioRuns : une rupture (page non folioée) ouvre un nouveau run', () => {
  const reads = [{ k: 10, folio: 7 }, { k: 11, folio: 8 }, { k: 13, folio: 10 }]
  assert.deepEqual(folioRuns(reads), [
    { kFrom: 10, kTo: 11, folioFrom: 7, folioTo: 8 },
    { kFrom: 13, kTo: 13, folioFrom: 10, folioTo: 10 },
  ])
})

test('folioRuns : aucune lecture → aucun run', () => {
  assert.deepEqual(folioRuns([]), [])
})
