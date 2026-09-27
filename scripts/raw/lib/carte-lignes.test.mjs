// Banc de la CARTE DE LIGNES EXACTE (`carte-lignes.mjs`, #1739) : les hunks sont ceux que `git diff
// -U0` écrit (en-têtes `@@ -a,b +c,d @@`), forgés ici — aucun dépôt n'est lu.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { carteDeLignes, carteDuFichier } from './carte-lignes.mjs'
import { hunksDe } from '../../guards/lib/hunks.mjs'

const carteDe = (diff) => carteDeLignes(hunksDe(diff))
const destins = (carte, n) => Array.from({ length: n }, (_, k) => carte(k + 1))

test('fichier inchangé (diff vide) → identité', () => {
  assert.deepEqual(hunksDe(''), [])
  assert.deepEqual(destins(carteDe(''), 4), [{ ligne: 1 }, { ligne: 2 }, { ligne: 3 }, { ligne: 4 }])
})

test('suppression pure : les lignes ôtées sont SUPPRIMÉES, les suivantes remontent', () => {
  const carte = carteDe('@@ -3,2 +2,0 @@\n-IV\n-12\n')
  assert.deepEqual(destins(carte, 6), [{ ligne: 1 }, { ligne: 2 }, { supprimee: true }, { supprimee: true }, { ligne: 3 }, { ligne: 4 }])
})

test('édition en place (hunk à compte égal) : appariement 1:1, rien ne bouge autour', () => {
  const carte = carteDe('@@ -4,2 +4,2 @@\n-### IV TITRE\n-texte IV\n+### TITRE\n+texte\n')
  assert.deepEqual(destins(carte, 6), [{ ligne: 1 }, { ligne: 2 }, { ligne: 3 }, { ligne: 4 }, { ligne: 5 }, { ligne: 6 }])
})

test('ancre de page posée EN PLACE dans un titre court : même ligne une fois les ancres ôtées, jamais ambiguë', () => {
  const carte = carteDe('@@ -31 +31 @@\n-# **COMMON MEANS**\n+# <span id="page-146-0" data-folio="147"></span>**COMMON MEANS**\n')
  assert.deepEqual(destins(carte, 32).slice(29), [{ ligne: 30 }, { ligne: 31 }, { ligne: 32 }])
})

test('ancre posée dans une ligne d’un hunk à compte inégal : appariée à son ancienne, la ligne ôtée SUPPRIMÉE', () => {
  const carte = carteDe('@@ -3,2 +3 @@\n-II\n-# **Wounds**\n+# <span id="page-28-0" data-folio="29"></span>**Wounds**\n')
  assert.deepEqual(destins(carte, 5), [{ ligne: 1 }, { ligne: 2 }, { supprimee: true }, { ligne: 3 }, { ligne: 4 }])
})

test('scission 1 → 2 : la ligne scindée est AMBIGUË avec ses candidates, les suivantes descendent', () => {
  const carte = carteDe('@@ -58 +58,2 @@\n-### A B\n+### A\n+### B\n')
  assert.deepEqual(carte(57), { ligne: 57 })
  assert.deepEqual(carte(58), { ambigue: true, candidates: [58, 59] })
  assert.deepEqual(carte(59), { ligne: 60 })
})

test('hunks multiples : suppression, insertion pure et édition se cumulent dans l’ordre', () => {
  const diff = [
    '@@ -2 +1,0 @@', '-II',                       // l.2 supprimée
    '@@ -5,0 +5,2 @@', '+a', '+b',                // 2 lignes insérées après l.5
    '@@ -8 +9 @@', '-### V TITRE', '+### TITRE',  // l.8 éditée en place
  ].join('\n')
  const carte = carteDe(diff)
  assert.deepEqual(destins(carte, 9), [
    { ligne: 1 }, { supprimee: true }, { ligne: 2 }, { ligne: 3 }, { ligne: 4 },
    { ligne: 7 }, { ligne: 8 }, { ligne: 9 }, { ligne: 10 },
  ])
})

// ---------- appariement EXACT dans un hunk à compte inégal ----------

test('2 → 1 : romain nu supprimé + titre voisin amputé de son romain — SUPPRIMÉE et APPARIÉE, pas ambiguës', () => {
  const carte = carteDe('@@ -5,2 +5 @@\n-IV\n-### IV **SELECTION OF POISONS**\n+### **SELECTION OF POISONS**\n')
  assert.deepEqual(destins(carte, 7).slice(3), [{ ligne: 4 }, { supprimee: true }, { ligne: 5 }, { ligne: 6 }])
})

test('3 → 1 : romain nu et folio supprimés, titre soudé amputé — deux SUPPRIMÉES, une APPARIÉE', () => {
  const carte = carteDe('@@ -10,3 +10 @@\n-XII\n-361\n-#### **Bounce** XII **Cold-blooded**\n+#### **Bounce** **Cold-blooded**\n')
  assert.deepEqual([10, 11, 12, 13].map(carte), [{ supprimee: true }, { supprimee: true }, { ligne: 10 }, { ligne: 11 }])
})

test('réordonnancement : l’appariement n’est pas CROISSANT → tout le hunk est AMBIGU, rapporté', () => {
  const carte = carteDe('@@ -4,2 +4,3 @@\n-alpha line\n-beta line\n+beta line\n+alpha line\n+gamma line\n')
  assert.deepEqual([4, 5].map(carte), [{ ambigue: true, candidates: [4, 5, 6] }, { ambigue: true, candidates: [4, 5, 6] }])
})

test('deux candidats à égalité : l’appariement n’est pas UNIQUE → tout le hunk est AMBIGU, rapporté', () => {
  const carte = carteDe('@@ -4,3 +4 @@\n-### IV POISONS\n-### V POISONS\n-IV\n+### POISONS\n')
  assert.deepEqual([4, 5, 6].map(carte), Array(3).fill({ ambigue: true, candidates: [4] }))
})

test('compte ÉGAL sans correspondance de rang (scission 1 → 2 + ligne vide voisine ôtée, diff git réel) → AMBIGU, jamais apparié 1:1', () => {
  const carte = carteDe('@@ -3,2 +3,2 @@\n-#### **Bounce** XII **Cold-blooded**\n-\n+#### **Bounce**\n+#### **Cold-blooded**\n')
  assert.deepEqual([3, 4].map((n) => carte(n)), Array(2).fill({ ambigue: true, candidates: [3, 4] }))
})

test('un FOLIO nu ne s’apparie pas par amputation (aucun jeton de 3 lettres) → rapporté', () => {
  const carte = carteDe('@@ -1,2 +1 @@\n-Page 361 of the book\n-XII\n+361\n')
  assert.deepEqual([1, 2].map((n) => carte(n)), Array(2).fill({ ambigue: true, candidates: [1] }))
})

test('carteDuFichier LÈVE sur un CR isolé (#604) — git et readText ne numérotent plus pareil', () => {
  const dir = mkdtempSync(join(tmpdir(), 'carte-cr-'))
  try {
    const f = join(dir, 'x.md')
    writeFileSync(f, 'a. If\rthey\nb\n')
    assert.throws(() => carteDuFichier(f), /CR isolé/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('un numéro de ligne qui n’en est pas un LÈVE — jamais un destin inventé', () => {
  assert.throws(() => carteDe('')(0), /entier ≥ 1/)
})
