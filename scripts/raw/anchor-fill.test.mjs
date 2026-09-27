// Tests de l'aligneur `anchor-fill` (node --test) : index compact, têtes de page pdfminer, bornage à
// deux côtés, ancre nue complétée, page sans texte, 1re page d'un chapitre, et la PORTE des têtes de
// page RÉELLES étiquetées au PDF (#1739). Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  applyEdits, buildCompactIndex, compactAnchor, existingFolioLines, folioBounds, nakedAnchorLines,
  planChapter, remonter, sequencesDeTete,
} from './anchor-fill.mjs'
import { lignes } from './lib/colonnes.mjs'
import { pageCrb } from './lib/fixtures/page-crb.mjs'

/** Une page synthétique : une ligne par texte, de haut en bas, dans une seule colonne. */
const page = (...textes) => textes.map((texte, i) => ({ colonne: 0, x0: 50, x1: 500, y0: 700 - 14 * i, texte, spans: [{ texte, police: '', taille: 10 }] }))

// ---------- compactAnchor ----------

test('compactAnchor : retrouve une tête dont le PDF a éclaté les lettres à l’intérieur des mots', () => {
  const lines = ['Lors de chaque Round, le sorcier doit réussir un Test de Focalisation pour maintenir son sort.']
  const idx = buildCompactIndex(lines)
  const head = 'L ors de chaque Round, le sorcier doit réussir un TesT de FocalisaT ion'
  const hit = compactAnchor(idx.joined, head.toLowerCase())
  assert.equal(hit.occ.length, 1)
  assert.equal(hit.occ[0], 0)
})

test('compactAnchor : tête absente → aucune occurrence', () => {
  const idx = buildCompactIndex(['Rien à voir avec la tête cherchée, mais assez longue pour la borne minimale.'])
  assert.deepEqual(compactAnchor(idx.joined, 'une tete de page totalement etrangere a ce texte la voila').occ, [])
})

test('compactAnchor : tête présente deux fois → deux occurrences (l’appelant exige l’unicité)', () => {
  const phrase = 'la meme tete de page repetee mot pour mot dans deux endroits du fichier'
  const idx = buildCompactIndex([phrase, 'intercalaire', phrase])
  assert.equal(compactAnchor(idx.joined, phrase).occ.length, 2)
})

test('compactAnchor : le préfixe retenu commence AU DÉBUT de la tête (offset jamais déplacé)', () => {
  const idx = buildCompactIndex(['pad pad pad', 'le début de la tête de page se poursuit ici avec beaucoup de mots communs, puis le md diverge.'])
  const hit = compactAnchor(idx.joined, 'le début de la tête de page se poursuit ici avec beaucoup de mots communs, mais la queue du candidat PDF est absente.')
  assert.equal(hit.occ.length, 1)
  assert.equal(hit.occ[0], buildCompactIndex(['pad pad pad', '']).joined.length)
})

// ---------- têtes de page pdfminer ----------

test('sequencesDeTete : page à COLONNES (CRB p.117) — la colonne gauche d’abord, le folio de pied écarté', () => {
  const [colonnes] = sequencesDeTete(lignes(pageCrb(117)))
  const rang = (re) => colonnes.findIndex((t) => re.test(t))
  assert.equal(colonnes[0], 'Combat Reflexes')
  assert.ok(rang(/^Crack the Whip$/) > rang(/completed or not\.$/), 'la colonne droite après la gauche')
  assert.equal(colonnes.some((t) => /^\d+$/.test(t)), false)
})

test('sequencesDeTete : page sans texte (planche, folio seul) → aucun ordre', () => {
  assert.deepEqual(sequencesDeTete([{ colonne: 0, x0: 300, x1: 310, y0: 30, texte: '37', spans: [{ taille: 9 }] }]), [])
  assert.deepEqual(sequencesDeTete([]), [])
})

test('remonter : la ligne trouvée remonte sur les lignes dont tous les mots sont parmi les lignes sautées', () => {
  const lines = ['*Pages PDF 2-3*', '### **Ça ne nous plaît guère**', '', 'V', '', 'En plus des fruits pourris, un spectacle']
  assert.equal(remonter(lines, 6, ['WA R H A M M E R', 'V', 'Ça ne nous plaît guère']), 2)
  assert.equal(remonter(lines, 6, ['WA R H A M M E R', 'V']), 4)
  assert.equal(remonter(lines, 6, ['V', 'Ça ne nous plaît guère'], 3), 4, 'jamais au-dessus de la borne basse')
})

// ---------- bornage ----------

test('existingFolioLines : chaque folio ancré → sa ligne 1-based, première occurrence retenue', () => {
  const text = ['entete', '<span id="page-4-0" data-folio="3"></span>a', 'b', '<span id="page-6-0" data-folio="5"></span>c', '<span id="page-4-0" data-folio="3"></span>bis'].join('\n')
  const map = existingFolioLines(text)
  assert.equal(map.get(3), 2)
  assert.equal(map.get(5), 4)
})

test('folioBounds : encadre par les VOISINS immédiats, pas par le dernier posé', () => {
  const known = new Map([[23, 3], [25, 21], [27, 87], [32, 268]])
  assert.deepEqual(folioBounds(known, 24), { lo: 3, hi: 21, loFolio: 23, hiFolio: 25 })
  assert.deepEqual(folioBounds(known, 30), { lo: 87, hi: 268, loFolio: 27, hiFolio: 32 })
})

test('folioBounds : sans voisin d’un côté, la borne reste OUVERTE', () => {
  const known = new Map([[10, 40]])
  assert.deepEqual(folioBounds(known, 5), { lo: 0, hi: 40, loFolio: null, hiFolio: 10 })
  assert.deepEqual(folioBounds(known, 12), { lo: 40, hi: Infinity, loFolio: 10, hiFolio: null })
  assert.deepEqual(folioBounds(new Map(), 7), { lo: 0, hi: Infinity, loFolio: null, hiFolio: null })
})

test('planChapter : un candidat unique mais HORS des bornes voisines est refusé, avec sa raison', () => {
  const lines = [
    '*Pages PDF 2-4*',
    '<span id="page-1-0" data-folio="1"></span>tete du folio un, prose assez longue pour ancrer',
    'suite du folio un, encore de la prose bien fournie ici',
    '<span id="page-3-0" data-folio="3"></span>tete du folio trois, prose assez longue pour ancrer',
    'une ligne bien plus bas qui ne peut pas appartenir au folio deux du tout',
  ]
  const pages = { 2: page('une ligne bien plus bas qui ne peut pas appartenir au folio deux du tout') }
  const plan = planChapter('01 - X.md', lines.join('\n'), 0, (K) => pages[K])
  assert.deepEqual(plan.missing, [2])
  assert.deepEqual(plan.placed, [])
  assert.match(plan.skipped[0].reason, /hors bornes .*folio 1.*folio 3/)
})

test('planChapter : le même candidat DANS les bornes est posé', () => {
  const lines = [
    '*Pages PDF 2-4*',
    '<span id="page-1-0" data-folio="1"></span>tete du folio un, prose assez longue pour ancrer',
    'tete du folio deux, prose assez longue pour ancrer sans ambiguite',
    '<span id="page-3-0" data-folio="3"></span>tete du folio trois, prose assez longue pour ancrer',
  ]
  const pages = { 2: page('tete du folio deux, prose assez longue pour ancrer sans ambiguite') }
  const plan = planChapter('01 - X.md', lines.join('\n'), 0, (K) => pages[K])
  assert.deepEqual(plan.placed.map((p) => [p.folio, p.line]), [[2, 3]])
})

test('applyEdits : sur une ligne de titre, l’ancre se pose APRÈS la marque de bloc — la ligne reste un titre', () => {
  const lines = ['*Pages PDF 2-3*', 'tete du folio un, prose assez longue pour ancrer', '### **Tête du folio deux**, un titre assez long pour ancrer']
  const pages = { 1: page('tete du folio un, prose assez longue pour ancrer'), 2: page('Tête du folio deux, un titre assez long pour ancrer') }
  const plan = planChapter('01 - X.md', lines.join('\n'), 0, (K) => pages[K])
  const out = applyEdits(lines.join('\n'), plan.edits).split('\n')
  assert.equal(out[1], '<span id="page-1-0" data-folio="1"></span>tete du folio un, prose assez longue pour ancrer')
  assert.equal(out[2], '### <span id="page-2-0" data-folio="2"></span>**Tête du folio deux**, un titre assez long pour ancrer')
})

// ---------- ancre NUE, page sans texte, 1re page (#1739) ----------

test('nakedAnchorLines : ancre SANS data-folio → K et sa ligne ; une ancre folioée n’y entre pas', () => {
  const text = [
    '*Pages PDF 5-14*',
    '# <span id="page-5-0"></span>*So, what’s drawn you to my door, wastrel?*',
    '<span id="page-6-0"></span>I **Using This Book** explique comment le jeu fonctionne.',
    '<span id="page-9-0" data-folio="10"></span>deja folioee',
  ].join('\n')
  assert.deepEqual([...nakedAnchorLines(text).entries()], [[5, 2], [6, 3]])
})

test('planChapter : une ancre NUE est COMPLÉTÉE de son data-folio, en place — jamais un second id', () => {
  const lines = [
    '*Pages PDF 28-28*',
    '',
    '# <span id="page-27-0"></span>**DWARFS**',
    'prose de la page vingt-huit, assez longue pour ancrer sans ambiguite',
  ]
  const plan = planChapter('009 - Dwarfs.md', lines.join('\n'), -1, () => undefined)
  assert.deepEqual(plan.completed, [{ folio: 28, line: 3 }])
  assert.equal(plan.alreadyCount, 1)
  const out = applyEdits(lines.join('\n'), plan.edits).split('\n')
  assert.equal(out[2], '# <span id="page-27-0" data-folio="28"></span>**DWARFS**')
  assert.equal(out.join('\n').match(/id="page-27-0"/g).length, 1)
})

test('planChapter : une page SANS texte est ancrée VIDE juste avant l’ancre de la page qui la suit', () => {
  const lines = [
    '*Pages PDF 8-10*',
    '',
    '# <span id="page-7-0"></span>**INTRODUCTION**',
    'fin de la page huit, de la prose assez longue pour ancrer',
    '# <span id="page-9-0"></span>**CHAPTER ONE** suite',
  ]
  const pages = { 8: page('37').map((l) => ({ ...l, y0: 30 })) }
  const plan = planChapter('004 - Introduction.md', lines.join('\n'), -1, (K) => pages[K])
  assert.deepEqual(plan.placed.map((p) => [p.folio, p.line, !!p.sansTexte]), [[9, 5, true]])
  const out = applyEdits(lines.join('\n'), plan.edits).split('\n')
  assert.equal(out[4], '# <span id="page-8-0" data-folio="9"></span><span id="page-9-0" data-folio="10"></span>**CHAPTER ONE** suite')
})

test('planChapter : la 1re page d’un chapitre qui s’ouvre en milieu de page porte son folio — le même que le chapitre précédent', () => {
  const lines = ['*Pages PDF 40-41*', '', '### **Talent Two**', 'suite de la page quarante et un, prose assez longue pour ancrer']
  const pages = { 39: page('Talent One, tête de la page, dans le chapitre précédent seulement') }
  const plan = planChapter('016 - Talents.md', lines.join('\n'), -1, (K) => pages[K])
  assert.deepEqual(plan.placed.map((p) => [p.folio, p.line]), [[40, 3]])
  assert.deepEqual(plan.skipped.map((s) => s.folio), [41])
})

test('planChapter : second passage sur un chapitre déjà posé → aucune pose (idempotence)', () => {
  const lines = [
    '*Pages PDF 2-3*',
    '<span id="page-1-0" data-folio="1"></span>tete du folio un, prose assez longue pour ancrer sans ambiguite',
    '# <span id="page-2-0" data-folio="2"></span>tete du folio deux, prose assez longue pour ancrer',
  ]
  const plan = planChapter('01 - X.md', lines.join('\n'), 0, (K) => page(`page ${K}`))
  assert.deepEqual(plan.placed, [])
  assert.deepEqual(plan.completed, [])
  assert.equal(plan.edits.size, 0)
})

// ---------- PORTE : têtes de page RÉELLES, ligne vraie étiquetée au PDF (#1739) ----------
// `lib/fixtures/tetes-de-page.json` : les pages K-1 et K telles que `lib/pdf-lignes.py` les lit
// (boîtes), la fenêtre `.md` autour de la ligne vraie (l'ancre du disque retirée), la ligne vraie
// (`null` : la page n'a pas de texte dans ce fichier). Hors porte : LDB 85 K346, non tranché au PDF.
// Cas CRB : têtes jugées (072 K256, 007 K24, 009 K27, 029 K146 — table imprimée deux fois, p.146 et
// p.147), planche sans texte (004 K8), chapitre ouvert en milieu de page (016 K38), et têtes « sur K »
// au critère du juge (la ligne ouverte est sur K, la précédente ne l'est pas).
const FIXTURE = JSON.parse(readFileSync(new URL('./lib/fixtures/tetes-de-page.json', import.meta.url), 'utf8'))
const boitesDe = (bs) => bs.map(([x0, y0, x1, y1, ls]) => ({ x0, y0, x1, y1, lignes: ls.map(([lx0, ly0, lx1, texte, taille]) => ({ x0: lx0, y0: ly0, x1: lx1, texte, spans: [[texte, '', taille]] })) }))

test(`porte des têtes de page : ${FIXTURE.cas.length} pages réelles, chacune à sa ligne vraie`, () => {
  const ecarts = []
  for (const c of FIXTURE.cas) {
    const folio = c.K - c.offset
    const lines = c.premiere ? c.md : [`*Pages PDF ${c.K}-${c.K + 1}*`, ...c.md]
    const decalage = c.premiere ? 0 : c.debut - 2
    const pages = { [c.K]: c.boites, ...(c.precedente ? { [c.K - 1]: c.precedente } : {}) }
    const plan = planChapter(c.fichier, lines.join('\n'), c.offset, (K) => (pages[K] ? lignes(boitesDe(pages[K])) : undefined))
    const pose = plan.placed.find((p) => p.folio === folio)
    const ligne = pose ? pose.line + decalage : null
    if (ligne !== c.vraie) ecarts.push(`${c.livre} ${c.fichier} K${c.K} : l.${ligne} au lieu de l.${c.vraie}`)
  }
  assert.deepEqual(ecarts, [])
})
