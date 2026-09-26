// ORDRE DE LECTURE (#1739) : `lib/colonnes.mjs` sur des pages RÉELLES du CRB, telles que pdfminer les
// lit (`pdf-lignes.py` : boîtes et lignes), réduites à leurs boîtes (`fixtures/pages-crb/p<N>.json`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { colonnes, lignes } from './colonnes.mjs'
import { pageCrb as page } from './fixtures/page-crb.mjs'
const arrondis = (bords) => bords.map((b) => Math.round(b * 10) / 10)
const ligne = (ls, re) => ls.find((l) => re.test(l.texte))
const rang = (ls, re) => ls.findIndex((l) => re.test(l.texte))

test('#1739 : p.117 (impaire) — deux colonnes et l’onglet ; la gouttière ne soude pas « your enemy » à « You are a »', () => {
  const b = page(117)
  assert.deepEqual(arrondis(colonnes(b)), [58.1, 301.9, 579])
  const ls = lignes(b)
  const gauche = ligne(ls, /leaping\s+to\s+attack\s+your\s+enemy/)
  assert.equal(gauche.colonne, 0)
  assert.doesNotMatch(gauche.texte, /You are a/)
  assert.ok(rang(ls, /^Combat Reflexes$/) < rang(ls, /^Crack the Whip$/) && rang(ls, /^Crack the Whip$/) < rang(ls, /^Craftsman \(Trade\)$/), 'colonne gauche lue en entier avant la droite')
})

test('#1739 : p.221 — trois colonnes, les trois titres du même y sont trois lignes', () => {
  const ls = lignes(page(221))
  assert.deepEqual(arrondis(colonnes(page(221))), [58.1, 220.9, 383.6])
  for (const [t, k] of [['Blessing of Battle', 0], ['Blessing of Grace', 1], ['Blessing of Righteousness', 2]]) {
    assert.equal(ligne(ls, new RegExp(`^${t}$`))?.colonne, k, t)
  }
})

test('#1739 : p.38 — un titre de deux mots reste UNE ligne (« CHARACTERISTIC TABLE »)', () => {
  assert.ok(ligne(lignes(page(38)), /^CHARACTERISTIC TABLE$/))
})

test('#1739 : p.335 — petites capitales : l’initiale 18 pt et la suite 12,6 pt sont UNE ligne « Troll »', () => {
  const l = ligne(lignes(page(335)), /^Troll$/)
  assert.deepEqual(l.spans.map((s) => s.taille), [18, 12.6])
})

test('#1739 : p.154 — les cellules d’un tableau restent des lignes distinctes (pas de « PriceEncAvailability »)', () => {
  const ls = lignes(page(154))
  assert.ok(ligne(ls, /^Price$/))
  assert.equal(ls.some((l) => /PriceEnc|EncAvailability/.test(l.texte)), false)
})

test('#1739 : p.47 — chaque ligne porte son bord droit `x1` et la `marge` de sa boîte (preuve de la ligne coupée)', () => {
  const b = page(47)
  const ls = lignes(b)
  for (const l of ls.filter((x) => b.find((y) => y.lignes.length > 1 && y.lignes.some((z) => z.y0 === x.y0 && z.texte === x.texte)))) {
    const boite = b.find((x) => x.lignes.some((y) => y.x0 === l.x0 && y.y0 === l.y0 && y.texte === l.texte))
    assert.deepEqual([l.x1, l.marge], [boite.lignes.find((y) => y.x0 === l.x0 && y.y0 === l.y0 && y.texte === l.texte).x1, boite.x1])
  }
})

test('#1739 : la marge d’une boîte d’UNE ligne est celle de son bloc (même bord gauche, même colonne), jamais son propre bord (CRB p.47)', () => {
  const l = (x0, x1, y0) => ({ x0, y0, x1, texte: 'x', spans: [] })
  const b = (x0, x1, y1, ls) => ({ x0, y0: y1 - 12 * ls.length, x1, y1, lignes: ls })
  const ls = lignes([b(58, 308, 700, [l(58, 306, 690), l(58, 308, 678), l(58, 250, 666)]), b(72, 268, 600, [l(72, 268, 590)]), b(72, 289, 587, [l(72, 289, 577)]), b(72, 99, 574, [l(72, 99, 564)]), b(58, 200, 500, [l(58, 200, 490)]), b(318, 536, 700, [l(318, 530, 690), l(318, 536, 678)])])
  assert.deepEqual(ls.map((x) => [x.colonne, x.marge]), [[0, 308], [0, 308], [0, 308], [0, 289], [0, 289], [0, 289], [0, 308], [1, 536], [1, 536]])
})
