// Test du garde `reconcile` (node --test). Lancé par `npm run test:raw`.
// CONTRAT vérifié ici, sur le VRAI dépôt (#434 défaut 9) : aucun chapitre d'un livre de CŒUR ne
// reste « à lignes non pinées » — la liste attendue est VIDE. Le cliquet ne verrouille que la
// DIRECTION : une HAUSSE est une régression (un chapitre dont les réfs de code retombent hors des
// plages pinées de l'Atlas, ±TOL=20) ; une baisse ne vaut que PROUVÉE par des réfs ré-ancrées au
// `Source/`, jamais par un artefact de mesure.
// Les TROUS DURS sont jugés par le CLIQUET de `raw:reconcile` contre le STOCK NOMINATIF
// `reconciliation-stock.json` (#1709 D2) ; ce banc juge la direction FINE et le régime du cliquet.
// Un livre de CŒUR n'a pas de voie de stock : son sens A est à tolérance ZÉRO, dans la GATE
// (`ecartsTrousDurs`, volet `coeur`) et verrouillé ici en régime, jamais en nombre.
// Les tests suivants fixent le vocabulaire de couverture : une fiche qui ne cite QU'en graphie folio
// des fiches de l'Atlas (`ABBR NN p.X`, #606) crédite son chapitre via `folioSpan`/`folioRange`, à
// l'égal d'une réf ligne.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { computeReconciliation, renderReport, trousDurs, ecartsTrousDurs, lireStock, STOCK_PATH, PREFIXE_B2, decodeCle, coeursEtrangers } from './reconcile.mjs'
import { BOOKS, coeurDe, coeursDe } from './_lib.mjs'
import { parseFiche, registresDeFiches, validerDette, orphelinsDeDette } from './build-implemente.mjs'
import { coeurDeBanc } from './atlasFixture.mjs'

// Registre de FIXTURE à DEUX cœurs (#1825 lot C) : le régime se juge sur le PRÉDICAT, jamais sur
// l'identité d'un livre réel — ces sigles n'existent nulle part ailleurs, et leurs dossiers non plus.
const QA = 'QQA', QB = 'QQB', QS = 'QQS'
/** Cœurs de FIXTURE, INVENTÉS eux aussi : un nom de cœur RÉEL écrit ici ferait juger l'identité d'un
 *  corpus là où le régime seul est en cause — et rendrait le banc HOMONYME de l'arbre (un dossier de
 *  fixture qui vaudrait un cœur réel passerait la couture pour la mauvaise raison). */
const COEUR_A = 'coeur-qa', COEUR_B = 'coeur-qb'
const REGISTRE = [
  { id: 'qa', abbr: QA, dir: 'Source/QA', coeur: COEUR_A },
  { id: 'qb', abbr: QB, dir: 'Source/QB', coeur: COEUR_B },
  { id: 'qs', abbr: QS, dir: 'Source/QS' },
]

/** Le cœur sous lequel les fixtures posent leurs pages — il doit être un cœur du registre que le
 *  cas INJECTE, la couture refusant tout autre sous-dossier : cœur inventé quand le cas injecte le
 *  registre de fixture, cœur du registre RÉEL quand il joue sur celui du dépôt. */
const COEUR = COEUR_A
const COEUR_REEL = coeurDeBanc()
/** Le stem d'une page de fixture : il PORTE son cœur, comme tout stem de l'Atlas. */
const stem = (nom) => `${COEUR}/${nom}`

test('non-régression : Sens A des livres de CŒUR sur le vrai repo = 0 chapitre à lignes non pinées', () => {
  const data = computeReconciliation()
  assert.deepEqual(
    data.softA.filter((s) => coeurDe(s.book)).map((s) => `${s.book} ${s.ch}`).sort(),
    [], // baseline à la baisse : si ce test casse par HAUSSE → régression réelle
  )
})

test("Sens A LDB (#606) : une fiche qui ne cite QU'en folio (`ABBR NN p.X`) credite bien son chapitre", () => {
  // `folioSpan`/`folioRange` resolvent contre le VRAI `Source/` (via `books.json`, pas les dirs isolés
  // de `withFixtures`) : le folio 132 du LDB tombe reellement dans le chapitre 10 (Talents), l.3-89 --
  // un code fixture citant une ligne DANS cette plage doit se retrouver couvert par la seule ref folio.
  withFixtures(
    { 'a.ts': '// règle LDB 10 l.50\n' },
    { 'fiche.md': 'LDB 10 p.132\n' },
    (opts) => {
      const data = computeReconciliation(opts)
      assert.equal(data.hardA.length, 0)
      assert.equal(data.softA.length, 0)
    },
  )
})

test('Sens B2 : le crédit FOLIO retire les chapitres-données ; normalisation dédoublonne 06/6', () => {
  const data = computeReconciliation()
  // UNE entrée B2 par livre de cœur du registre — ni plus, ni moins, zéro réf comprise
  assert.deepEqual(data.b2.map((e) => e.book).sort(), BOOKS.map(([a]) => a).filter((a) => coeurDe(a)).sort())
  assert.ok(data.b2.length > 0, 'aucun livre de cœur déclaré au registre')
  for (const e of data.b2) assert.equal(coeurDe(e.book), e.coeur)
  // le livre de cœur qui porte la dette : le crédit folio réduit strictement sa liste hors-code
  const porteur = data.b2.find((e) => e.avant.length)
  assert.ok(porteur, 'aucun livre de cœur ne porte de chapitre Atlas hors-code')
  assert.ok(porteur.horsCode.length < porteur.avant.length)
  // crédités et résiduels sont DISJOINTS, et leur réunion est la liste d'avant
  const after = new Set(porteur.horsCode)
  assert.ok(porteur.credites.every((c) => !after.has(c)))
  assert.equal(porteur.credites.length + porteur.horsCode.length, porteur.avant.length)
  // les chapitres de carrières sont crédités par `source:{book,page}`, jamais résiduels
  assert.ok(porteur.credites.length > 0, 'aucun chapitre crédité par folio')
  // normalisation `chKey` : pas de doublon, pas de forme zéro-préfixée `06`
  assert.deepEqual([...new Set(porteur.avant)], porteur.avant)
  assert.ok(!porteur.avant.includes('06'))
})

/** Fixtures isolées : un `src/`, un `docs/raw/` et la DETTE éditoriale (`raw.manifest.json`) du cas.
 *  La dette est injectée comme le registre des livres — jamais le manifest réel du dépôt, dont les
 *  `id` sont inconnus d'un Atlas de fixture. */
function withFixtures(srcFiles, docFiles, fn, dette = [], coeur = COEUR_REEL) {
  const root = mkdtempSync(join(tmpdir(), 'reconcile-'))
  const srcDir = join(root, 'src')
  const rawDir = join(root, 'raw')
  const manifestPath = join(root, 'raw.manifest.json')
  writeFileSync(manifestPath, JSON.stringify(dette, null, 2), 'utf8')
  mkdirSync(srcDir, { recursive: true })
  mkdirSync(join(rawDir, coeur), { recursive: true })
  for (const [name, content] of Object.entries(srcFiles)) {
    const p = join(srcDir, name)
    mkdirSync(join(p, '..'), { recursive: true })
    writeFileSync(p, content, 'utf8')
  }
  // Les pages de l'Atlas vivent SOUS un cœur : la partition est le contrat, et la couture refuse
  // une page de règles posée à la racine.
  for (const [name, content] of Object.entries(docFiles)) writeFileSync(join(rawDir, coeur, name), content, 'utf8')
  try { fn({ srcDir, rawDir, manifestPath }) } finally { rmSync(root, { recursive: true, force: true }) }
}

/** Les mêmes fixtures, posées sous un cœur du registre de FIXTURE — pour tout cas qui injecte
 *  `REGISTRE` : la couture juge le sous-dossier contre le registre qu'on lui donne. */
const withFixturesDuRegistre = (srcFiles, docFiles, fn, dette = []) => withFixtures(srcFiles, docFiles, fn, dette, COEUR)

// --- Sens B2, crédit par DETTE DE FICHE (#1825) : une dette se déclare UNE fois ---
// Le cœur de fixture `QQA` : son chapitre 7 est décrit par l'Atlas, jamais cité par le code.

const FICHE_QA7 = '# Atlas RAW — Fixture\n\n## Sujet\n\n**Sources RAW :** `QQA 7 l.10`\n\n**Implémente :** x\n'

test('Sens B2 : chapitre de cœur dont la SEULE fiche est sous dette de fiche → crédité, nommé avec son ticket', () => {
  withFixturesDuRegistre(
    { 'a.ts': '// rien\n' },
    { 'fiche.md': FICHE_QA7 },
    (opts) => {
      const data = computeReconciliation({ ...opts, registre: REGISTRE })
      const e = data.b2.find((x) => x.book === QA)
      assert.deepEqual(e.horsCode, [], 'le chapitre est déjà déclaré en dette : il ne se stocke pas une 2e fois')
      assert.deepEqual(e.sousDette.map((s) => s.ch), ['7'])
      assert.deepEqual(e.sousDette[0].tickets, ['#1825'])
      assert.deepEqual(e.sousDette[0].fiches, [stem('fiche')])
      assert.match(renderReport(data), new RegExp(`Sous dette de fiche déclarée \\(1[\\s\\S]*QQA 7 \\(#1825 — ${stem('fiche')}\\)`))
    },
    [{ id: stem('fiche'), ticket: '#1825' }],
  )
})

test('Sens B2 : le MÊME chapitre sans entrée de dette → trou dur B2 neuf', () => {
  withFixturesDuRegistre(
    { 'a.ts': '// rien\n' },
    { 'fiche.md': FICHE_QA7 },
    (opts) => {
      const data = computeReconciliation({ ...opts, registre: REGISTRE })
      const e = data.b2.find((x) => x.book === QA)
      assert.deepEqual(e.horsCode, ['7'])
      assert.deepEqual(e.sousDette, [])
      assert.deepEqual(trousDurs(data).map((t) => t.cle), [`${PREFIXE_B2}${QA} 7`])
    },
  )
})

test('Sens B2 : chapitre décrit par DEUX fiches dont une seule sous dette → PAS de crédit', () => {
  withFixturesDuRegistre(
    { 'a.ts': '// rien\n' },
    { 'fiche.md': FICHE_QA7, 'autre.md': '# Autre\n\n## Sujet\n\n**Sources RAW :** `QQA 7 l.80`\n\n**Implémente :** x\n' },
    (opts) => {
      const data = computeReconciliation({ ...opts, registre: REGISTRE })
      const e = data.b2.find((x) => x.book === QA)
      assert.deepEqual(e.sousDette, [], 'une fiche non déclarée décrit encore ce chapitre')
      assert.deepEqual(e.horsCode, ['7'])
    },
    [{ id: stem('fiche'), ticket: '#1825' }],
  )
})

test('Sens B2 : chapitre décrit par AUCUNE fiche (catalogue seul) → jamais crédité par une dette de fiche', () => {
  // Beaucoup de chapitres de l'Atlas ne sont cités que par un catalogue, un index ou une épreuve :
  // aucune fiche ne les décrit, donc aucune dette de fiche ne peut les couvrir.
  withFixturesDuRegistre(
    { 'a.ts': '// rien\n' },
    { 'catalogue-x.md': '# Catalogue\n\nQQA 7 : entrées verbatim\n', 'fiche.md': '# F\n\n## Sujet\n\n**Sources RAW :** `QQA 9 l.10`\n\n**Implémente :** x\n' },
    (opts) => {
      const e = computeReconciliation({ ...opts, registre: REGISTRE }).b2.find((x) => x.book === QA)
      assert.deepEqual(e.sousDette.map((s) => s.ch), ['9'], 'seule la fiche déclarée est créditée')
      assert.deepEqual(e.horsCode, ['7'], 'le chapitre du catalogue reste hors-code')
    },
    [{ id: stem('fiche'), ticket: '#1825' }],
  )
})

// --- LOT F SIMULé : un second cœur extrait AVANT toute implémentation, déclaré par 2 lignes ---
// Les DEUX portes se jugent ensemble : `raw:reconcile` (aucun trou dur B2 à stocker) et
// `raw:implemente` (aucun topic orphelin). C'est l'invariant du lot : une dette se déclare UNE fois.
// Les fiches portent le marqueur que `raw:implemente` vient d'y écrire : aucun code ne les couvre.
const F1 = '# Atlas RAW — Carac 5e\n\n## Jets\n\n**Sources RAW :** `QQB 3 l.10`\n\n**Implémente :** (non implémenté)\n\n## Avantage\n\n**Sources RAW :** `QQB 3 l.50`\n\n**Implémente :** (non implémenté)\n'
const F2 = '# Atlas RAW — Combat 5e\n\n## Attaque\n\n**Sources RAW :** `QQB 4 l.10`\n\n**Implémente :** (non implémenté)\n'
const DOCS_LOT_F = { 'carac-5e.md': F1, 'combat-5e.md': F2 }

/** Les orphelins de `raw:implemente` pour les mêmes docs et la même dette — aucun code n'existe.
 *  Les docs sont adressés par leur RELATIF à l'Atlas, cœur compris : c'est ce que le lecteur voit. */
const orphelinsDe = (dette, docs) => {
  const fiches = Object.entries(docs).map(([nom, content]) => ({ doc: stem(nom), content, parsed: parseFiche(stem(nom), content) }))
  const ctx = {
    index: { impl: [], tests: [], fileLines: new Map(), nonCommentText: new Map() },
    closure: new Set(),
    dette: validerDette(dette, registresDeFiches(fiches)),
    fiches,
  }
  return orphelinsDeDette(ctx)
}

test('#1825 lot F déclaré : 2 entrées de fiche → AUCUN trou dur B2 à stocker ET aucun orphelin', () => {
  const dette = [{ id: stem('carac-5e'), ticket: '#1900' }, { id: stem('combat-5e'), ticket: '#1900' }]
  withFixturesDuRegistre({ 'a.ts': '// rien\n' }, DOCS_LOT_F, (opts) => {
    const data = computeReconciliation({ ...opts, registre: REGISTRE })
    const e = data.b2.find((x) => x.book === QB)
    assert.deepEqual(e.horsCode, [])
    assert.deepEqual(e.sousDette.map((s) => `${s.ch}:${s.tickets.join()}`), ['3:#1900', '4:#1900'])
    assert.deepEqual(trousDurs(data).map((t) => t.cle), [], 'aucune entrée à écrire au stock nominatif')
    assert.deepEqual(data.dettesDeFiche, [
      { fiche: stem('carac-5e'), ticket: '#1900', couverts: 2, total: 2 },
      { fiche: stem('combat-5e'), ticket: '#1900', couverts: 1, total: 1 },
    ])
  }, dette)
  assert.deepEqual(orphelinsDe(dette, DOCS_LOT_F), [])
})

test('#1825 ticket fermé, entrées retirées : les trous B2 et les orphelins RESSURGISSENT, nommés', () => {
  withFixturesDuRegistre({ 'a.ts': '// rien\n' }, DOCS_LOT_F, (opts) => {
    const data = computeReconciliation({ ...opts, registre: REGISTRE })
    assert.deepEqual(data.b2.find((x) => x.book === QB).horsCode, ['3', '4'])
    assert.deepEqual(trousDurs(data).map((t) => t.cle), [`${PREFIXE_B2}${QB} 3`, `${PREFIXE_B2}${QB} 4`])
  })
  assert.deepEqual(orphelinsDe([], DOCS_LOT_F), [`${stem('carac-5e')}#jets`, `${stem('carac-5e')}#avantage`, `${stem('combat-5e')}#attaque`])
})

test('#1825 une entrée pour DEUX fiches : la couverture est bornée à la fiche déclarée', () => {
  const dette = [{ id: stem('carac-5e'), ticket: '#1900' }]
  withFixturesDuRegistre({ 'a.ts': '// rien\n' }, DOCS_LOT_F, (opts) => {
    const data = computeReconciliation({ ...opts, registre: REGISTRE })
    const e = data.b2.find((x) => x.book === QB)
    assert.deepEqual(e.sousDette.map((s) => s.ch), ['3'])
    assert.deepEqual(e.horsCode, ['4'], 'la fiche non déclarée garde son trou')
  }, dette)
  assert.deepEqual(orphelinsDe(dette, DOCS_LOT_F), [`${stem('combat-5e')}#attaque`])
})

test('#1825 chapitre co-décrit par une fiche sous dette ET un doc NON-fiche → crédité', () => {
  // La couverture se juge sur les FICHES : un index ou un catalogue qui mentionne le même chapitre ne
  // porte aucune dette et n'en portera jamais. Exiger qu'il soit déclaré ne créditerait jamais rien,
  // l'immense majorité des chapitres de l'Atlas étant aussi cités hors des fiches.
  const dette = [{ id: stem('carac-5e'), ticket: '#1900' }, { id: stem('combat-5e'), ticket: '#1900' }]
  withFixturesDuRegistre(
    { 'a.ts': '// rien\n' },
    { ...DOCS_LOT_F, '00-index.md': '# Index\n\nvoir QQB 3 et QQB 4\n' },
    (opts) => {
      const e = computeReconciliation({ ...opts, registre: REGISTRE }).b2.find((x) => x.book === QB)
      assert.deepEqual(e.sousDette.map((s) => s.ch), ['3', '4'])
      assert.deepEqual(e.horsCode, [])
    },
    dette,
  )
})

test('Sens B1 : un marqueur « (non implémenté) » dit s’il est sous dette, sans entrée, ou hors champ Implémente', () => {
  withFixturesDuRegistre(
    { 'a.ts': '// rien\n' },
    {
      'fiche.md': '# F\n\n## Sujet\n\n**Sources RAW :** `QQA 7 l.10`\n\n**Implémente :** (non implémenté)\n',
      'libre.md': '# L\n\nprose qui parle de (non implémenté)\n',
    },
    (opts) => {
      const data = computeReconciliation({ ...opts, registre: REGISTRE })
      const parDoc = new Map(data.nonImpl.map((n) => [n.doc, n]))
      assert.equal(parDoc.get(stem('fiche.md')).topic, `${stem('fiche')}#sujet`)
      assert.equal(parDoc.get(stem('fiche.md')).dette.ticket, '#1825')
      assert.equal(parDoc.get(stem('libre.md')).topic, undefined, 'une prose n’est pas un topic : aucune dette à lui demander')
      const rapport = renderReport(data)
      assert.match(rapport, /1 sous dette déclarée · 0 sans entrée de `src\/data\/raw\.manifest\.json` · 1 hors champ/)
      assert.match(rapport, new RegExp(`\\*\\*${stem('fiche')}\\.md\\*\\* L7 — dette #1825`))
      assert.match(rapport, new RegExp(`\\*\\*${stem('libre')}\\.md\\*\\* L3 — hors champ Implémente \\(prose\\)`))
    },
    [{ id: stem('fiche'), ticket: '#1825' }],
  )
})

test('Sens A LDB : chapitre absent de l\'Atlas → trou dur', () => {
  withFixtures(
    { 'a.ts': '// règle LDB 6 l.3\n' },
    { 'fiche.md': 'rien à voir\n' },
    (opts) => {
      const data = computeReconciliation(opts)
      assert.equal(data.hardA.length, 1)
      assert.equal(data.hardA[0].ch, '6')
    },
  )
})

test('Sens A LDB : chapitre cité, ligne hors tolérance → trou fin', () => {
  withFixtures(
    { 'a.ts': '// règle LDB 6 l.500\n' },
    { 'fiche.md': 'LDB 6 l.3\n' },
    (opts) => {
      const data = computeReconciliation(opts)
      assert.equal(data.hardA.length, 0)
      assert.equal(data.softA.length, 1)
      assert.equal(data.softA[0].missCount, 1)
    },
  )
})

test('Sens A LDB : chapitre cité, ligne dans ±TOL → couvert', () => {
  withFixtures(
    { 'a.ts': '// règle LDB 6 l.10\n' },
    { 'fiche.md': 'LDB 6 l.3\n' },
    (opts) => {
      const data = computeReconciliation(opts)
      assert.equal(data.hardA.length, 0)
      assert.equal(data.softA.length, 0)
    },
  )
})

test('Sens A LDB : chapitre couvert par un catalogue → jamais un trou de ligne', () => {
  withFixtures(
    { 'a.ts': '// règle LDB 6 l.500\n' },
    { 'catalogue-x.md': 'LDB 6 mentionné, données verbatim\n' },
    (opts) => {
      const data = computeReconciliation(opts)
      assert.equal(data.hardA.length, 0)
      assert.equal(data.softA.length, 0)
    },
  )
})

test('Sens A LDB : chapitre zéro-préfixé au CODE, catalogue non préfixé → exemption catalogue VIVANTE (#1156)', () => {
  withFixtures(
    { 'a.ts': '// règle LDB 08 l.500\n' },
    { 'catalogue-x.md': '## [LDB 8] Statut\ndonnées verbatim\n' },
    (opts) => {
      const data = computeReconciliation(opts)
      assert.equal(data.hardA.length, 0)
      assert.equal(data.softA.length, 0)
    },
  )
})

test('Sens A LDB : Atlas zéro-préfixé, code non préfixé → la ligne est pinée (graphies croisées, #1156)', () => {
  withFixtures(
    { 'a.ts': '// règle LDB 8 l.500\n' },
    { 'fiche.md': 'LDB 08 l.3-600\n' },
    (opts) => {
      const data = computeReconciliation(opts)
      assert.equal(data.hardA.length, 0)
      assert.equal(data.softA.length, 0)
    },
  )
})

test('Sens A LDB : chapitre RÉELLEMENT absent (numéro différent) reste un trou dur malgré la normalisation (#1156)', () => {
  withFixtures(
    { 'a.ts': '// règle LDB 09 l.3\n' },
    { 'catalogue-x.md': '## [LDB 8] Statut\ndonnées verbatim\n' },
    (opts) => {
      const data = computeReconciliation(opts)
      assert.equal(data.hardA.length, 1)
      assert.equal(data.hardA[0].ch, '9')
    },
  )
})

test('Sens A (autres livres) : chapitre absent de l\'Atlas → trou dur PAR LIVRE', () => {
  withFixtures(
    { 'a.ts': '// règle AA 07 l.3\n' },
    { 'fiche.md': 'rien à voir\n' },
    (opts) => {
      const data = computeReconciliation(opts)
      assert.equal(data.hardA.length, 1)
      assert.equal(data.hardA[0].book, 'AA')
      assert.equal(data.hardA[0].ch, '7')
      assert.equal(data.bookStats.get('AA').hard, 1)
    },
  )
})

test('Sens A (autres livres) : chapitre zéro-préfixé au CODE, non préfixé à l\'ATLAS → PAS un trou (#434)', () => {
  withFixtures(
    { 'a.ts': '// règle AA 02 l.3\n' },
    { 'fiche.md': '## [AA 2] INTRODUCTION\nAA 2 l.3\n' },
    (opts) => {
      const data = computeReconciliation(opts)
      assert.equal(data.hardA.length, 0)
      assert.equal(data.softA.length, 0)
    },
  )
})

test('Sens A (autres livres) : chapitre RÉELLEMENT absent (numéro différent) reste un trou dur malgré la normalisation', () => {
  withFixtures(
    { 'a.ts': '// règle AA 09 l.3\n' },
    { 'fiche.md': '## [AA 2] INTRODUCTION\nAA 2 l.3\n' },
    (opts) => {
      const data = computeReconciliation(opts)
      assert.equal(data.hardA.length, 1)
      assert.equal(data.hardA[0].book, 'AA')
      assert.equal(data.hardA[0].ch, '9')
    },
  )
})

test('Sens A (autres livres) : chapitre cité, ligne hors tolérance → trou fin PAR LIVRE', () => {
  withFixtures(
    { 'a.ts': '// règle AA 07 l.500\n' },
    { 'fiche.md': 'AA 07 l.3\n' },
    (opts) => {
      const data = computeReconciliation(opts)
      assert.equal(data.hardA.length, 0)
      assert.equal(data.softA.length, 1)
      assert.equal(data.softA[0].book, 'AA')
      assert.equal(data.bookStats.get('AA').soft, 1)
    },
  )
})

test('Sens A (autres livres) : réf SANS chapitre (`AA l.X`) → comptée à part, jamais un trou', () => {
  withFixtures(
    { 'a.ts': '// règle AA l.4395\n' },
    { 'fiche.md': 'rien à voir\n' },
    (opts) => {
      const data = computeReconciliation(opts)
      assert.equal(data.hardA.length, 0)
      assert.equal(data.softA.length, 0)
      assert.equal(data.codeNoCh.get('AA').length, 1)
      assert.equal(data.bookStats.get('AA').noCh, 1)
    },
  )
})

test('Sens A (autres livres) : chapitre couvert par un catalogue (autre livre) → jamais un trou de ligne', () => {
  withFixtures(
    { 'a.ts': '// règle AA 07 l.500\n' },
    { 'catalogue-x.md': 'AA 07 mentionné, données verbatim\n' },
    (opts) => {
      const data = computeReconciliation(opts)
      assert.equal(data.hardA.length, 0)
      assert.equal(data.softA.length, 0)
    },
  )
})

test('Sens A (autres livres) : Atlas en PLAGE (AA 07 l.3-600) couvre toute la plage, pas juste la borne basse (#586 jumeau)', () => {
  withFixtures(
    { 'a.ts': '// règle AA 07 l.500\n' },
    { 'fiche.md': 'AA 07 l.3-600\n' },
    (opts) => {
      const data = computeReconciliation(opts)
      assert.equal(data.hardA.length, 0)
      assert.equal(data.softA.length, 0)
    },
  )
})

test('Sens A (autres livres) : deux livres distincts n\'interfèrent pas l\'un avec l\'autre', () => {
  withFixtures(
    { 'a.ts': '// règles AA 07 l.3 et ZI 02 l.9\n' },
    { 'fiche.md': 'AA 07 l.3 couvert. rien pour ZI.\n' },
    (opts) => {
      const data = computeReconciliation(opts)
      assert.equal(data.hardA.length, 1)
      assert.equal(data.hardA[0].book, 'ZI')
      assert.equal(data.softA.length, 0)
    },
  )
})

// --- CLIQUET des trous durs (#1709 lot D2, #925) : la gate rougit, et le stock décroît ---
// Les fixtures vivent DANS les tests : un littéral de PORTÉE MODULE qui nomme un fichier
// (`sample: [{ file: 'src/a.ts' }]`) est une entrée de stock pour la porte de plage
// (`scripts/guards/lib/stocksNominatifs.mjs`, `PORTEURS` couvre `scripts/**.test.mjs`) — seul le
// stock RAW doit être compté par cette porte.

test('cliquet : `trousDurs` nomme les DEUX familles (Sens A par livre, Sens B2 par livre de cœur)', () => {
  const e = trousDurs({
    hardA: [
      { book: QA, ch: '6', count: 2, sample: [{ file: 'src/a.ts', row: 12 }] },
      { book: QS, ch: '7', count: 1, sample: [{ file: 'src/b.ts', row: 3 }] },
    ],
    b2: [{ book: QA, coeur: COEUR_A, avant: ['38'], credites: [], horsCode: ['38'] }],
  })
  assert.deepEqual(e.map((x) => x.cle), [`${QA} 6`, `${QS} 7`, `B2 ${QA} 38`])
  assert.deepEqual(e[0].sites, ['src/a.ts:12'])
  assert.deepEqual(e[2].sites, [])
})

test('cliquet : stock EXACT → aucun écart (ni neuve, ni périmée)', () => {
  const e = trousDurs({
    hardA: [{ book: QS, ch: '7', count: 1, sample: [] }],
    b2: [{ book: QA, coeur: COEUR_A, avant: ['38'], credites: [], horsCode: ['38'] }],
  })
  const stock = { [`${QS} 7`]: { quoi: 'dette instruite' }, [`B2 ${QA} 38`]: { quoi: 'dette instruite' } }
  const { neuves, perimees } = ecartsTrousDurs(e, stock, REGISTRE)
  assert.deepEqual(neuves, [])
  assert.deepEqual(perimees, [])
})

test('cliquet : trou dur NEUF (hors stock) → écart NOMINATIF portant le chapitre et ses sites', () => {
  const e = trousDurs({ hardA: [{ book: QS, ch: '7', count: 1, sample: [{ file: 'src/b.ts', row: 3 }] }] })
  const { neuves, perimees } = ecartsTrousDurs(e, {}, REGISTRE)
  assert.deepEqual(neuves, [`${QS} 7 — 1 réf(s) de code, 0 dans l'Atlas · src/b.ts:3`])
  assert.deepEqual(perimees, [])
})

test('cliquet : chapitre B2 neuf (Atlas hors-code) → écart nominatif, clé préfixée `B2`', () => {
  const b2 = [{ book: QA, coeur: COEUR_A, avant: ['38'], credites: [], horsCode: ['38'] }]
  const { neuves } = ecartsTrousDurs(trousDurs({ b2 }), {}, REGISTRE)
  assert.equal(neuves.length, 1)
  assert.match(neuves[0], new RegExp(`^B2 ${QA} 38 — chapitre décrit par l'Atlas`))
})

test('cliquet à DOUBLE SENS : entrée du stock SOLDÉE (plus de trou mesuré) → refus « stock à décroître »', () => {
  const stock = { [`${QS} 7`]: { quoi: 'dette soldée depuis', lot: '#1709 D2' } }
  const { neuves, perimees } = ecartsTrousDurs(trousDurs({}), stock, REGISTRE)
  assert.deepEqual(neuves, [])
  assert.deepEqual(perimees, [`${QS} 7 — dette soldée depuis (#1709 D2)`])
})

test('R1 : un livre de CŒUR n\'a PAS de voie de stock en Sens A — tolérance ZÉRO', () => {
  // CLAUDE.md règle 1 : « devoir rouvrir `Source/` = un défaut de l'Atlas à corriger ». Un livre de
  // cœur est couvert fiche à fiche par l'Atlas : un chapitre qu'il cite et que l'Atlas ignore se
  // CORRIGE. Un supplément n'a pas cette couverture — sa dette se stocke, nommée et datée.
  const trou = trousDurs({ hardA: [{ book: QA, ch: '6', count: 1, sample: [{ file: 'src/a.ts', row: 1 }] }] })
  const attendu = `${QA} 6 — 1 réf(s) de code, 0 dans l'Atlas · src/a.ts:1`
  // (a) trou observé, stock VIDE → refus nominatif par la GATE (volet `coeur`), pas seulement ici
  const observe = ecartsTrousDurs(trou, {}, REGISTRE)
  assert.deepEqual(observe.coeur, [attendu])
  assert.deepEqual(observe.neuves, [attendu])
  // (b) le stock qui PORTE la clé ne l'absout pas : l'entrée elle-même est refusée
  const stocke = ecartsTrousDurs(trou, { [`${QA} 6`]: { quoi: 'dette prétendue' } }, REGISTRE)
  assert.deepEqual(stocke.neuves, [], 'la clé est bien au stock…')
  assert.deepEqual(stocke.coeur, [
    attendu,
    `${QA} 6 — entrée de stock INADMISSIBLE (dette prétendue)`,
  ], '…et pourtant la gate refuse : un livre de cœur se corrige, il ne se stocke pas')
  // (c) le SECOND cœur du registre reçoit le même régime, sans une ligne de plus
  const trouB = trousDurs({ hardA: [{ book: QB, ch: '6', count: 1, sample: [{ file: 'src/a.ts', row: 1 }] }] })
  assert.equal(ecartsTrousDurs(trouB, {}, REGISTRE).coeur.length, 1)
  // (d) MUTATION : le même trou, le même livre SANS `coeur` au registre → redevient stockable. Le
  // prédicat est la SEULE cause du refus.
  const sansCoeur = REGISTRE.filter((b) => b.abbr !== QA).concat([{ id: 'qa', abbr: QA, dir: 'Source/QA' }])
  assert.deepEqual(ecartsTrousDurs(trou, {}, sansCoeur).coeur, [])
  // (e) un livre SANS cœur garde sa voie de stock
  const trouS = trousDurs({ hardA: [{ book: QS, ch: '6', count: 1, sample: [] }] })
  assert.deepEqual(ecartsTrousDurs(trouS, { [`${QS} 6`]: { quoi: 'dette instruite' } }, REGISTRE).coeur, [])
  // (f) le sens B2 n'est PAS concerné : `B2 <cœur> <ch>` reste stockable
  const b2 = [{ book: QA, coeur: COEUR_A, avant: ['38'], credites: [], horsCode: ['38'] }]
  assert.deepEqual(ecartsTrousDurs(trousDurs({ b2 }), { [`B2 ${QA} 38`]: { quoi: 'dette instruite' } }, REGISTRE).coeur, [])
})

test('R2 : deux livres de CŒUR citant le MÊME numéro de chapitre restent DEUX entrées partout', () => {
  withFixturesDuRegistre(
    { 'a.ts': `// règles ${QA} 6 l.500 et ${QB} 6 l.500 et ${QA} l.20\n` },
    { 'fiche.md': `${QA} 6 l.3\n${QB} 6 l.3\n` },
    (opts) => {
      const data = computeReconciliation({ ...opts, registre: REGISTRE })
      // Sens A : deux chapitres-livre DISTINCTS, chacun son propriétaire
      assert.deepEqual(data.softA.map((s) => `${s.book} ${s.ch} ${s.proprietaire}`), [`${QA} 6 ${stem('fiche.md')}`, `${QB} 6 ${stem('fiche.md')}`])
      // bookStats : deux livres comptés séparément ; la réf de cœur SANS chapitre est COMPTÉE
      assert.equal(data.bookStats.get(QA).soft, 1)
      assert.equal(data.bookStats.get(QB).soft, 1)
      assert.equal(data.bookStats.get(QA).noCh, 1)
      assert.deepEqual(data.codeNoCh.get(QA).map((r) => r.line), [20])
      // Sens B2 : une entrée PAR livre de cœur, rendue même à zéro
      assert.deepEqual(data.b2.map((e) => [e.book, e.coeur, e.horsCode.length]), [[QA, COEUR_A, 0], [QB, COEUR_B, 0]])
    },
  )
})

test('rendu : le résumé de TÊTE porte les nombres de Sens B2 PAR livre de cœur, jamais un compte de livres', () => {
  const data = {
    hardA: [], softA: [], nonImpl: [{ doc: 'x.md', row: 1, text: '(non implémenté)' }],
    codeNoCh: new Map(), bookStats: new Map(), codeBooks: new Set(), atlasBooks: new Set(),
    folioIgnored: 0, coeurs: coeursDe(REGISTRE),
    b2: [
      { book: QA, coeur: COEUR_A, avant: ['26', '38', '40'], credites: ['26'], sousDette: [{ ch: '40', fiches: ['f'], tickets: ['#1825'] }], horsCode: ['38'] },
      { book: QB, coeur: COEUR_B, avant: [], credites: [], sousDette: [], horsCode: [] },
    ],
  }
  const tete = renderReport(data).split('\n').find((l) => l.startsWith('**Sens B —'))
  assert.match(tete, new RegExp(`${QA} \\(cœur ${COEUR_A}\\) : 1 chapitre\\(s\\) cité\\(s\\) par l'Atlas jamais référencé\\(s\\) dans le code \\(avant crédits : 3 · 1 crédité\\(s\\).*· 1 sous dette de fiche déclarée\\)`))
  assert.match(tete, new RegExp(`${QB} \\(cœur ${COEUR_B}\\) : 0 chapitre\\(s\\).*avant crédits : 0 · 0 crédité\\(s\\).*· 0 sous dette de fiche déclarée\\)`))
  assert.equal(/\d+ livre\(s\) de cœur/.test(tete), false, 'un compte de LIVRES n’est pas un compte de trous')
  // Registre sans aucun cœur : la tête le DIT, elle ne rend pas une phrase tronquée.
  const sansCoeur = renderReport({ ...data, b2: [], coeurs: new Map() }).split('\n').find((l) => l.startsWith('**Sens B —'))
  assert.match(sansCoeur, /aucun livre de cœur au registre/)
})

// --- NAMESPACE des clés : le préfixe B2 partage l'espace des clés de Sens A (sonde du juge du diff,
// 2026-09-19). Le sigle collisionnant se LIT au module (`PREFIXE_B2`), jamais recopié ici.
const QCOL = PREFIXE_B2.trim()
const REGISTRE_COLLISION = [
  { id: 'qcol', abbr: QCOL, dir: 'Source/QCOL', coeur: COEUR_A },
  { id: 'qs', abbr: QS, dir: 'Source/QS' },
]

test('R1 : un livre de CŒUR dont le sigle EST le préfixe B2 ne s\'échappe pas du refus', () => {
  // `B2 7` est une clé de SENS A (chapitre 7 du livre dont le sigle vaut le préfixe) : un
  // `startsWith` la prendrait pour du Sens B2 et R1 la laisserait filer — refus 0 au lieu de 1.
  const trou = trousDurs({ hardA: [{ book: QCOL, ch: '7', count: 1, sample: [{ file: 'src/a.ts', row: 1 }] }] })
  assert.deepEqual(trou.map((e) => e.cle), [`${QCOL} 7`])
  const { coeur } = ecartsTrousDurs(trou, {}, REGISTRE_COLLISION)
  assert.equal(coeur.length, 1, 'le trou de Sens A du livre de cœur doit être REFUSÉ')
  // ... et son VRAI Sens B2 (`B2 B2 <ch>`) reste, lui, stockable
  const b2 = [{ book: QCOL, coeur: COEUR_A, avant: ['9'], credites: [], horsCode: ['9'] }]
  const cleB2 = trousDurs({ b2 })[0].cle
  assert.equal(cleB2, `${PREFIXE_B2}${QCOL} 9`)
  assert.deepEqual(ecartsTrousDurs(trousDurs({ b2 }), { [cleB2]: { quoi: 'dette instruite' } }, REGISTRE_COLLISION).coeur, [])
})

test('decodeCle : le SENS se décode, il ne se renifle pas ; la clé doublement lisible LÈVE', () => {
  const abbrs = new Set([QCOL, QS])
  assert.deepEqual(decodeCle(`${QCOL} 7`, abbrs), { sens: 'A', book: QCOL, ch: '7' })
  assert.deepEqual(decodeCle(`${PREFIXE_B2}${QS} 9`, abbrs), { sens: 'B2', book: QS, ch: '9' })
  assert.equal(decodeCle(`${QS} sept`, abbrs), null, 'chapitre non numérique : hors grammaire')
  assert.equal(decodeCle('INCONNU 7', abbrs), null, 'sigle hors registre : hors grammaire')
  // AMBIGUË : le registre porte à la fois `B2 ZZ` et `ZZ`, donc `B2 ZZ 9` se lit des DEUX façons.
  assert.throws(
    () => decodeCle(`${PREFIXE_B2}ZZ 9`, new Set([`${QCOL} ZZ`, 'ZZ'])),
    /clé de trou dur AMBIGUË/,
  )
})

test('R2 : un chapitre d\'un livre de cœur décrit par l\'Atlas et jamais cité par le code → trou B2 nominatif', () => {
  withFixturesDuRegistre(
    { 'a.ts': '// aucune réf de code\n' },
    { 'fiche.md': `${QB} 9 l.3\n` },
    (opts) => {
      const data = computeReconciliation({ ...opts, registre: REGISTRE })
      const e = data.b2.find((x) => x.book === QB)
      assert.deepEqual(e.avant, ['9'])
      assert.deepEqual(e.horsCode, ['9'])
      assert.deepEqual(trousDurs(data).map((x) => x.cle), [`B2 ${QB} 9`])
      // un supplément n'a PAS de Sens B2 : son Atlas hors-code ne dit rien
      assert.equal(data.b2.some((x) => x.book === QS), false)
    },
  )
})

test('cliquet : le STOCK COMMITTÉ couvre EXACTEMENT les trous durs du vrai repo (aucun neuf, aucun périmé)', () => {
  // Doublon ASSUMÉ du verdict de `npm run raw:reconcile` : cette lane-ci (`test:raw`) tourne dans la
  // lane des lecteurs de `docs/raw/`, l'autre en phase SÉRIE — un stock périmé par un commit voisin
  // se voit ici sans attendre l'écrivain, et le message nomme le remède au lieu d'un exit nu.
  const { neuves, perimees, coeur } = ecartsTrousDurs(trousDurs(computeReconciliation()), lireStock())
  // R1 sur le stock RÉEL : aucune clé de Sens A d'un livre de cœur n'y est admise (trou OU entrée).
  assert.deepEqual(coeur, [], 'un livre de cœur se corrige, il ne se stocke pas')
  assert.deepEqual(neuves, [], 'trou dur neuf : couvrir le chapitre dans l\'Atlas, ou instruire la dette au stock')
  assert.deepEqual(perimees, [], 'entrée périmée : retirer l\'entrée de reconciliation-stock.json')
})

test('cliquet : chaque entrée du stock nomme ses SITES, son LOT et sa DATE (jamais un régime)', () => {
  for (const [cle, e] of Object.entries(lireStock())) {
    assert.ok(Array.isArray(e.sites) && e.sites.length, `${cle} : aucun site nommé`)
    assert.ok(e.lot && /#\d+/.test(e.lot), `${cle} : lot absent`)
    assert.match(e.date ?? '', /^\d{4}-\d{2}-\d{2}$/, `${cle} : date absente`)
    assert.ok(e.quoi, `${cle} : dette non dite`)
  }
})

test('cliquet : le fichier de stock ABSENT vaut tolérance ZÉRO (lireStockJson), jamais un stock ouvert', () => {
  assert.deepEqual(lireStock(join(tmpdir(), 'stock-qui-nexiste-pas.json')), {})
  assert.ok(STOCK_PATH.endsWith('reconciliation-stock.json'))
})

// ── CŒUR ÉTRANGER — une fiche synthétise le cœur que son CHEMIN déclare ──────────────────────
// Sigles et cœurs de FIXTURE : un banc qui recopierait des sigles réels réintroduirait la table de
// livres que #1825 vient de sortir du code.
test('coeursEtrangers : aucune fiche ne cite de cœur étranger → personne n’est nommé', () => {
  assert.deepEqual(coeursEtrangers(new Map()), [])
})

test('coeursEtrangers : chaque fiche est nommée par son RELATIF, avec les cœurs ÉTRANGERS qu’elle cite et leurs livres', () => {
  const parFiche = new Map([
    ['alpha/magie.md', new Map([['gamma', new Set(['BKG'])], ['beta', new Set(['BKB2', 'BKB'])]])],
    ['alpha/combat.md', new Map([['beta', new Set(['BKB'])]])],
  ])
  assert.deepEqual(coeursEtrangers(parFiche), [
    { fiche: 'alpha/combat.md', coeurs: [{ coeur: 'beta', livres: ['BKB'] }] },
    { fiche: 'alpha/magie.md', coeurs: [{ coeur: 'beta', livres: ['BKB', 'BKB2'] }, { coeur: 'gamma', livres: ['BKG'] }] },
  ])
})

test('fixture : une fiche posée sous UN cœur qui cite le livre de cœur d’un AUTRE cœur est NOMMÉE', () => {
  withFixturesDuRegistre(
    { 'a.ts': '// rien\n' },
    { 'fiche.md': `# F\n\n## Sujet\n\n**Sources RAW :** \`${QB} 3 l.10\`\n\n**Implémente :** x\n` },
    (opts) => {
      const data = computeReconciliation({ ...opts, registre: REGISTRE })
      assert.deepEqual(data.etrangers.map((e) => e.fiche), [`${COEUR}/fiche.md`])
      assert.deepEqual(data.etrangers[0].coeurs, [{ coeur: coeurDe(QB, coeursDe(REGISTRE)), livres: [QB] }])
    },
  )
})

test('fixture : la MÊME fiche citant le livre de cœur de SON PROPRE cœur ne déclenche rien', () => {
  withFixturesDuRegistre(
    { 'a.ts': '// rien\n' },
    { 'fiche.md': `# F\n\n## Sujet\n\n**Sources RAW :** \`${QA} 3 l.10\`\n\n**Implémente :** x\n` },
    (opts) => {
      assert.deepEqual(computeReconciliation({ ...opts, registre: REGISTRE }).etrangers, [])
    },
  )
})

test('arbre réel : aucune fiche de l’Atlas ne cite le livre de cœur d’un autre cœur que le sien (#1825)', () => {
  const { etrangers, fichesJugees } = computeReconciliation()
  assert.ok(fichesJugees > 0, 'aucune fiche balayée — la garde ne mesure rien')
  assert.deepEqual(etrangers, [])
})
