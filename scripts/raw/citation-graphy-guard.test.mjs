// Test du garde `citation-graphy-guard` (node --test) : chaque classe est éprouvée sur des formes
// NUES en arbre temporaire, les faux positifs plausibles (dates, ids composés) n'accrochent pas, et
// le VRAI dépôt est confronté aux classes à zéro et au stock des familles cliquetées.
// Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  scanGraphyViolations, scanDocsRawViolations, scanImplProseViolations, BOOK_NO_CHAPTER_RE,
  scanChDotViolations, scanBareFolioViolations, scanBookNoChapterSrcViolations, scanUnknownAbbrViolations,
  scanChapterBoundaryFolioViolations, scanFolioSrcViolations, scanMultiFolioSplitViolations, readStock, STOCK_PATH,
  scanTout, cliquets, FAMILLES_CLIQUETEES,
} from './citation-graphy-guard.mjs'
import { allAbbrAlternation, chapterBoundaryRisk, siglesDeCoeur } from './_lib.mjs'
import { avecAtlasFixture } from './atlasFixture.mjs'

// Des sigles RÉELS, pris au registre par leur RÉGIME (livre de cœur) — jamais recopiés : la classe se
// juge sur ce que la graphie VOIT, pas sur l'identité d'un livre. Résolveur PARTAGÉ avec les autres
// bancs (`siglesDeCoeur`, _lib.mjs) : il nomme sa cause quand le registre ne porte aucun cœur, et il
// les rend TOUS — juger le seul premier laisserait le cœur N+1 hors de la couverture du banc.
const SIGLES_COEUR = siglesDeCoeur()

function withTempSrcDir(content, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'graphy-guard-'))
  mkdirSync(join(dir, 'src'), { recursive: true })
  const file = join(dir, 'src', 'fixture.ts')
  writeFileSync(file, content, 'utf8')
  try { fn(join(dir, 'src')) } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('graphie chapitre-relative simple (18-Traumatisme l.417) → détectée', () => {
  withTempSrcDir('// Faim (18-Traumatisme l.417-422) : sans nourriture ni boisson…\n', (srcDir) => {
    const v = scanGraphyViolations(srcDir)
    assert.equal(v.length, 1)
    assert.equal(v[0].row, 1)
    assert.match(v[0].text, /18-Traumatisme l\.417/)
  })
})

test('graphie abrégée (15-Dépl l.87) → détectée', () => {
  withTempSrcDir('// Sacrifier l\'Avantage (LDB 15-Dépl l.87)\n', (srcDir) => {
    const v = scanGraphyViolations(srcDir)
    assert.equal(v.length, 1)
  })
})

test('forme canonique LDB NN l.X (sans nom de chapitre) → silence', () => {
  withTempSrcDir('// Faim (LDB 18 l.337-343) : sans nourriture ni boisson…\n', (srcDir) => {
    const v = scanGraphyViolations(srcDir)
    assert.equal(v.length, 0)
  })
})

test('faux positif évité : une date ISO ne matche pas (chiffres des deux côtés du tiret)', () => {
  withTempSrcDir('// Décision utilisateur 2026-07-15 : reformulé après audit — l.42 mentionné ailleurs.\n', (srcDir) => {
    const v = scanGraphyViolations(srcDir)
    assert.equal(v.length, 0)
  })
})

test('faux positif évité : un id composé (ticket-42, variant-15) ne matche pas sans " l.<n>" collé', () => {
  withTempSrcDir("// Voir ticket-42 et variant-15 pour le contexte ; l.10 est une réf isolée sans lien.\n", (srcDir) => {
    const v = scanGraphyViolations(srcDir)
    assert.equal(v.length, 0)
  })
})

test('plusieurs fichiers, tous les CITANTS scannés (`EXTS_CITANTES`, fichiersCitants.mjs)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'graphy-guard-multi-'))
  mkdirSync(join(dir, 'src', 'sub'), { recursive: true })
  writeFileSync(join(dir, 'src', 'a.ts'), '// 07-Carrières l.45\n', 'utf8')
  writeFileSync(join(dir, 'src', 'sub', 'b.tsx'), '// 09-Compétences l.226\n', 'utf8')
  writeFileSync(join(dir, 'src', 'sub', 'c.json'), '{"note": "20-Maladies l.145"}\n', 'utf8')
  writeFileSync(join(dir, 'src', 'sub', 'e.mts'), '// 18-Traumatisme l.60\n', 'utf8')
  writeFileSync(join(dir, 'src', 'f.css'), '/* 14-Tests l.198 */\n', 'utf8')
  writeFileSync(join(dir, 'src', 'g.md'), '20-Maladies l.12\n', 'utf8')
  writeFileSync(join(dir, 'src', 'd.snap'), '// 20-Maladies l.999 (extension hors périmètre, ignorée)\n', 'utf8')
  try {
    const v = scanGraphyViolations(join(dir, 'src'))
    assert.equal(v.length, 6)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('node_modules ignoré', () => {
  const dir = mkdtempSync(join(tmpdir(), 'graphy-guard-nm-'))
  mkdirSync(join(dir, 'src', 'node_modules'), { recursive: true })
  writeFileSync(join(dir, 'src', 'node_modules', 'x.ts'), '// 18-Traumatisme l.417\n', 'utf8')
  try {
    const v = scanGraphyViolations(join(dir, 'src'))
    assert.equal(v.length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// --- scans docs/raw (#434) : plage à tiret cadratin (a) + réf de livre sans chapitre (b) ---
// Les pages vivent SOUS un cœur : un Atlas est PARTITIONNÉ, et la couture refuse une page de règles
// posée à sa racine. Fabrique PARTAGÉE avec les autres bancs de lecteurs (`atlasFixture.mjs`).
const withTempRawDir = (files, fn) => avecAtlasFixture(files, (dir) => fn(dir), { prefixe: 'graphy-docs-' })

/** Réf de FIXTURE : `spec(s, 18, '417-422')` → « <s> 18 l.417-422 » (patron `spec` de `_lib.test.mjs`).
 *  SPÉCIMEN CONSTRUIT, jamais écrit en graphie canonique : ce fichier est lui-même balayé par les
 *  gardes de réf du dépôt, qui ne distinguent pas un spécimen de test d'une citation vivante. */
const spec = (sigle, ch, tail) => [sigle, String(ch), `l.${tail}`].join(' ')

test('docs/raw (a) : plage à tiret cadratin (l.417–422 / l.417—422) → détectée, tiret-moins silencieux', () => {
  for (const sigle of SIGLES_COEUR) {
    withTempRawDir({
      'en.md': `Faim (${spec(sigle, 18, '417–422')}) en cadratin\n`,   // en-dash U+2013
      'em.md': `Soif (${spec(sigle, 18, '417—422')}) em-cadratin\n`,    // em-dash U+2014
      'ok.md': `Faim (${spec(sigle, 18, '417-422')}) tiret-moins\n`,     // hyphen-minus → canonique
    }, (raw) => {
      const v = scanDocsRawViolations(raw).filter((x) => x.kind === 'emdash-range')
      assert.equal(v.length, 2, `livre de cœur ${sigle}`)
      assert.deepEqual(v.map((x) => x.file.split('/').pop()).sort(), ['em.md', 'en.md'])
    })
  }
})

test('docs/raw (b) : réf de livre SANS chapitre (AA l.4395, ADE II l.653) → détectée ; avec chapitre → silence', () => {
  withTempRawDir({
    'a.md': 'Art (Écriture) (AA l.3574)\n',
    'b.md': 'ogres : Langue Magick (ADE II l.653)\n',
    'ok.md': 'forme canonique `AA 13 l.3574` et `MSRC 16 l.104-118`\n',
  }, (raw) => {
    const v = scanDocsRawViolations(raw).filter((x) => x.kind === 'book-no-chapter')
    assert.equal(v.length, 2)
    assert.deepEqual(v.map((x) => x.file.split('/').pop()).sort(), ['a.md', 'b.md'])
  })
})

test('docs/raw (b) : TOUT livre de CŒUR est DANS la classe, au même titre ; EDO/EDOC & MSR/MSRC désambiguïsés', () => {
  const desambigues = ['EDOC l.101', 'EDO l.5', 'MSRC l.71', 'MSR l.9']
  withTempRawDir({
    'x.md': [...SIGLES_COEUR.map((s) => `${s} l.162`), ...desambigues].join('\n') + '\n',
  }, (raw) => {
    const kinds = scanDocsRawViolations(raw).filter((x) => x.kind === 'book-no-chapter').map((x) => x.text)
    assert.equal(kinds.length, SIGLES_COEUR.length + desambigues.length)
    for (const s of SIGLES_COEUR) assert.ok(kinds.some((t) => t.startsWith(`${s} l.162`)), `le livre de cœur ${s} échappe à la classe`)
  })
})

test('docs/raw (c) : nom de fichier de chapitre en backticks (`08 - Titre.md` l.89) → détecté ; réf nue → silence', () => {
  withTempRawDir({
    'a.md': '**Source :** ADE II `08 - Le theatre de la guerre.md` l.89-131.\n',
    'b.md': '**Source :** ADE II `09 - Annexe I.md` l.32-33.\n',
    'ok.md': 'forme canonique `ADE II 8 l.89-131`.\n',
  }, (raw) => {
    const v = scanDocsRawViolations(raw).filter((x) => x.kind === 'backtick-file')
    assert.equal(v.length, 2)
    assert.deepEqual(v.map((x) => x.file.split('/').pop()).sort(), ['a.md', 'b.md'])
  })
})

// COMPORTEMENT, jamais la formule : un test qui ré-écrit l'expression construisant la regex est une
// tautologie (il passe même si les deux côtés sont faux). On assert ce que la classe VOIT.
test('docs/raw (b) : la classe voit TOUT livre de cœur, un sigle PRÉFIXE d’un autre, et un sigle À ESPACE', () => {
  const vu = (s) => [...s.matchAll(BOOK_NO_CHAPTER_RE())].map((m) => m[1])
  for (const s of SIGLES_COEUR) {
    assert.deepEqual(vu(`${s} l.162`), [s])                           // un livre de cœur, comme les autres
    assert.equal(allAbbrAlternation().split('|').includes(s), true)
  }
  assert.deepEqual(vu('EDOC l.101'), ['EDOC'])                        // pas 'EDO' (tri par longueur)
  assert.deepEqual(vu('MSRC l.71'), ['MSRC'])                         // pas 'MSR'
  assert.deepEqual(vu('ADE II l.653'), ['ADE II'])                    // sigle à espace
  assert.deepEqual(vu('LDB 16 l.13'), [])                             // chapitre PRÉSENT → hors classe
  assert.deepEqual(vu('ADE2 l.65'), [])                               // graphie inconnue → invisible
})

test('docs/raw (b) : identité stricte (#585 lot B) — MDG canonique détecté, anciennes graphies ADEII/Midd invisibles (hors alternation)', () => {
  withTempRawDir({
    'mdg.md': 'Requins-taureaux (MDG l.812)\n',
    'adeii.md': 'ogres : Langue Magick (ADEII l.653)\n',
    'midd.md': 'Loup Blanc (Midd l.3)\n',
  }, (raw) => {
    const v = scanDocsRawViolations(raw).filter((x) => x.kind === 'book-no-chapter')
    assert.deepEqual(v.map((x) => x.file.split('/').pop()).sort(), ['mdg.md'])
  })
})

test('docs/raw : rapports (coverage/reconciliation/reanchor) et épreuves exclus des scans', () => {
  withTempRawDir({
    'coverage.md': 'AA l.4395\n',
    'reconciliation.md': 'AA l.4395\n',
    'reanchor.md': 'AA l.4395\n',
    'epreuve-x.md': 'AA l.4395\n',
    'combat.md': 'AA l.4395\n',
  }, (raw) => {
    const v = scanDocsRawViolations(raw)
    assert.equal(v.length, 1)
    assert.equal(v[0].file.split('/').pop(), 'combat.md')
  })
})

// --- scan (d) : prose d'état d'implémentation hors bloc de champ généré `**Implémente**` ---
test('docs/raw (d) singulier : « n\'est pas implémenté » / « non implémentée » hors champ → détecté', () => {
  withTempRawDir({
    'a.md': '## Sujet\n\nCe passage n\'est pas implémenté dans le moteur.\n',
    'b.md': '## Autre\n\nLa table n\'est pas encore implémentée côté code.\n',
  }, (raw) => {
    const v = scanImplProseViolations(raw)
    assert.equal(v.length, 2)
    assert.deepEqual(v.map((x) => x.file.split('/').pop()).sort(), ['a.md', 'b.md'])
  })
})

test('docs/raw (d) PLURIEL : « ne sont pas implémentés » (graphie qui échappait au regex historique) → détecté', () => {
  withTempRawDir({ 'a.md': '## Sujet\n\nCes effets ne sont pas implémentés.\n' }, (raw) => {
    assert.equal(scanImplProseViolations(raw).length, 1)
  })
})

test('docs/raw (d) : « non câblé / pas encore câblés » → détecté', () => {
  withTempRawDir({
    'a.md': '## X\n\nLe déclencheur est non câblé.\n',
    'b.md': '## Y\n\nCes triggers sont pas encore câblés.\n',
  }, (raw) => {
    assert.equal(scanImplProseViolations(raw).length, 2)
  })
})

test('docs/raw (d) : ligne DANS le bloc de champ généré `**Implémente**` → ignorée', () => {
  withTempRawDir({
    'a.md': '## Sujet\n\n**Implémente :** (non implémenté)\n- dette : #123\n\nProse RAW sans état.\n',
  }, (raw) => {
    assert.equal(scanImplProseViolations(raw).length, 0)
  })
})

test('docs/raw (d) : prose d\'état APRÈS la fin du bloc de champ (ligne vide) → détectée', () => {
  withTempRawDir({
    'a.md': '## Sujet\n\n**Implémente :** (non implémenté)\n\nCette règle n\'est pas implémentée par ailleurs.\n',
  }, (raw) => {
    const v = scanImplProseViolations(raw)
    assert.equal(v.length, 1)
    assert.match(v[0].text, /n'est pas implémentée/)
  })
})

test('docs/raw (d) : 00-index.md exclu (sa ligne de garde décrit le marqueur)', () => {
  withTempRawDir({
    '00-index.md': 'Le champ vaut `(non implémenté)` sinon — description du marqueur.\n',
    'combat.md': '## X\n\nCe passage n\'est pas implémenté.\n',
  }, (raw) => {
    const v = scanImplProseViolations(raw)
    assert.equal(v.length, 1)
    assert.equal(v[0].file.split('/').pop(), 'combat.md')
  })
})

test('docs/raw (d) : rapports (coverage/reconciliation/reanchor) et épreuves exclus', () => {
  withTempRawDir({
    'coverage.md': 'X n\'est pas implémenté\n',
    'reconciliation.md': 'X n\'est pas implémenté\n',
    'reanchor.md': 'X n\'est pas implémenté\n',
    'epreuve-x.md': 'X n\'est pas implémenté\n',
    'combat.md': '## S\n\nX n\'est pas implémenté\n',
  }, (raw) => {
    const v = scanImplProseViolations(raw)
    assert.equal(v.length, 1)
    assert.equal(v[0].file.split('/').pop(), 'combat.md')
  })
})

test('non-régression : le VRAI docs/raw/ du repo est à ZÉRO prose d\'état d\'implémentation (#487 suite, lot 1)', () => {
  const v = scanImplProseViolations()
  assert.deepEqual(
    v.map((x) => `${x.file}:${x.row}`),
    [],
    `prose(s) d'état d'implémentation survivante(s) :\n${v.map((x) => `  ${x.file}:${x.row}  ${x.text}`).join('\n')}`,
  )
})

test('non-régression : le VRAI docs/raw/ du repo est à ZÉRO graphie de fiche (#434 défaut 10)', () => {
  const v = scanDocsRawViolations()
  assert.deepEqual(
    v.map((x) => `${x.file}:${x.row}`),
    [],
    `graphie(s) de fiche survivante(s) :\n${v.map((x) => `  ${x.file}:${x.row}  [${x.kind}]  ${x.text}`).join('\n')}`,
  )
})

test('non-régression : le VRAI src/ du repo est à ZÉRO graphie chapitre-relative (#487 lot 1+2)', () => {
  const v = scanGraphyViolations()
  assert.deepEqual(
    v.map((x) => `${x.file}:${x.row}`),
    [],
    `graphie(s) chapitre-relative(s) survivante(s) :\n${v.map((x) => `  ${x.file}:${x.row}  ${x.text}`).join('\n')}`,
  )
})

// Le scan (g) — abréviation INCONNUE — était éprouvé sur FIXTURE seulement : sa « zéro tolérance »
// ne s'exerçait sur aucun fichier réel, et une graphie morte (`NADAJ`, 101 occurrences, #1279 Sf)
// a vécu des mois sans qu'aucune exécution ne la voie. Le VRAI `src/` entre donc au garde, comme
// les autres familles ci-dessus : pas de baseline — une abréviation hors `books.json` est une
// citation qui ne mène nulle part.
test('non-régression : le VRAI src/ du repo est à ZÉRO abréviation INCONNUE (#585 lot A, câblé #1279 Sf)', () => {
  const v = scanUnknownAbbrViolations()
  assert.deepEqual(
    v.map((x) => `${x.file}:${x.row} [${x.abbr}]`),
    [],
    `abréviation(s) hors books.json :\n${v.map((x) => `  ${x.file}:${x.row}  [${x.abbr}]  ${x.text}`).join('\n')}`,
  )
})


// --- (#585 lot A) scan (e) : ch. cosmétique ---
function withTempSrcAndRawDir(srcFiles, rawFiles, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'graphy-585-'))
  mkdirSync(join(dir, 'src'), { recursive: true })
  for (const [name, content] of Object.entries(srcFiles)) writeFileSync(join(dir, 'src', name), content, 'utf8')
  try {
    return withTempRawDir(rawFiles, (rawDir) => fn(join(dir, 'src'), rawDir))
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('(e) ch. cosmétique : détecté en src (LDB ch.6) et en docs/raw (AA ch.7), forme sans ch. silencieuse', () => {
  withTempSrcAndRawDir(
    { 'x.ts': '// LDB ch.6 l.2 : forme déviante\n// LDB 6 l.2 : forme canonique, silence\n' },
    { 'combat.md': 'AA ch.7 l.4 déviant\nAA 7 l.4 canonique, silence\n' },
    (srcDir, rawDir) => {
      const v = scanChDotViolations(srcDir, ['.ts', '.tsx', '.json'], rawDir)
      assert.equal(v.length, 2)
      assert.deepEqual(v.map((x) => x.row).sort(), [1, 1])
    },
  )
})

test('(e) ch. cosmétique : rapports générés (coverage/reconciliation/reanchor) exclus des docs/raw', () => {
  withTempSrcAndRawDir({}, { 'coverage.md': 'AA ch.7 l.4\n' }, (srcDir, rawDir) => {
    assert.equal(scanChDotViolations(srcDir, ['.ts', '.tsx', '.json'], rawDir).length, 0)
  })
})

// --- portée des classes (f)/(h)/(i) : les fiches seules ; en `src/**`, la classe (j) voit toute réf au folio ---
test('(f)/(h)/(i) : un arbre src/ portant un folio nu, un multi-folio et un folio en fin de chapitre ne nourrit que (j)', () => {
  withTempSrcAndRawDir(
    { 'x.ts': '// Amphibie (LDB p.338) : folio nu\n// Mauvais œil (LDB 48 p.255) : folio en fin de chapitre\n// Outre à eau (LDB 64 p.301/303) : multi-folio à cheval\n' },
    {},
    (srcDir, rawDir) => {
      const passe = scanTout(srcDir, ['.ts', '.tsx', '.json'], rawDir)
      assert.deepEqual(passe.bareFolio, [])
      assert.deepEqual(passe.chapterBoundaryFolio, [])
      assert.deepEqual(passe.multiFolioSplit, [])
      assert.deepEqual(passe.folioSrc.map((v) => v.ref), ['LDB p.338', 'LDB 48 p.255', 'LDB 64 p.301'])
    },
  )
})

// --- (#585 lot A) scan (b) étendu à src ---
test('(b) étendu à src : réf de livre SANS chapitre détectée en .ts, forme avec chapitre silencieuse', () => {
  withTempSrcAndRawDir(
    { 'x.ts': '// EDOC l.172 : règle libre\n// EDOC 8 l.172 : forme canonique, silence\n' },
    {},
    (srcDir) => {
      const v = scanBookNoChapterSrcViolations(srcDir, ['.ts', '.tsx', '.json'])
      assert.equal(v.length, 1)
      assert.equal(v[0].row, 1)
    },
  )
})

// --- (#454 DoD) scans (b)/(f) étendus à docs/raw : la garde était auparavant AVEUGLE à ces fiches ---
test('(#454) (f) folio nu : détecté dans docs/raw (toute ligne, pas seulement commentaire/champ "ref"), forme chapitrée silencieuse', () => {
  withTempSrcAndRawDir(
    {},
    { 'combat.md': '**Source :** LDB p.339\n', 'ok.md': '**Source :** LDB 85 l.90\n' },
    (srcDir, rawDir) => {
      const v = scanBareFolioViolations(rawDir)
      assert.equal(v.length, 1)
      assert.equal(v[0].file.endsWith('combat.md'), true)
    },
  )
})

test('(#454) (f) folio nu : rapports générés (coverage/reconciliation/reanchor) et épreuves exclus de docs/raw', () => {
  withTempSrcAndRawDir({}, { 'coverage.md': 'LDB p.339\n' }, (srcDir, rawDir) => {
    assert.equal(scanBareFolioViolations(rawDir).length, 0)
  })
})

test('(#454) (b) étendu à docs/raw : réf de livre SANS chapitre détectée, forme avec chapitre silencieuse', () => {
  withTempSrcAndRawDir(
    {},
    { 'combat.md': 'EDOC l.172 : règle libre\n', 'ok.md': 'EDOC 8 l.172 : forme canonique, silence\n' },
    (srcDir, rawDir) => {
      const v = scanBookNoChapterSrcViolations(srcDir, ['.ts', '.tsx', '.json'], rawDir)
      assert.equal(v.length, 1)
      assert.equal(v[0].file.endsWith('combat.md'), true)
    },
  )
})

// --- (#585 lot A) scan (g) : abréviation INCONNUE (zéro tolérance, pas de baseline) ---
test('(g) abréviation inconnue : détectée nominativement, abréviation connue (LDB) silencieuse', () => {
  withTempSrcAndRawDir(
    { 'x.ts': '// RAW 16 l.105 : abréviation inventée\n// LDB 16 l.105 : abréviation connue, silence\n' },
    {},
    (srcDir, rawDir) => {
      const v = scanUnknownAbbrViolations(srcDir, ['.ts', '.tsx', '.json'], rawDir)
      assert.equal(v.length, 1)
      assert.equal(v[0].abbr, 'RAW')
    },
  )
})

test('(g) abréviation inconnue : ancienne graphie ADEII (tout capitales) EST désormais une inconnue (identité stricte, #585 lot B) ; "Midd" reste hors format (casse mixte, invisible d\'UNKNOWN_ABBR_RE)', () => {
  withTempSrcAndRawDir(
    { 'x.ts': '// ADEII 5 l.10, Midd 3 l.4 : anciennes graphies, plus tolérées\n' },
    {},
    (srcDir, rawDir) => {
      const v = scanUnknownAbbrViolations(srcDir, ['.ts', '.tsx', '.json'], rawDir)
      assert.equal(v.length, 1)
      assert.deepEqual(v.map((x) => x.abbr), ['ADEII'])
    },
  )
})

// --- (#522 juge adversarial) scan (h) : multi-folios d'une fiche à cheval sur un AUTRE chapitre ---
test('(h) multi-folio en fiche : LDB 64 p.301/303 (folios hors du chapitre 64) → détecté', () => {
  withTempSrcAndRawDir({}, { 'combat.md': "**Source :** Contenant d'eau (Outre à eau/Seau, LDB 64 p.301/303)\n" }, (srcDir, rawDir) => {
    const v = scanMultiFolioSplitViolations(rawDir)
    assert.equal(v.length, 1)
    assert.equal(v[0].row, 1)
    assert.equal(v[0].file.endsWith('combat.md'), true)
    // 301 résout ch63 (l'ancre de folio vit dans le chapitre PRÉCÉDENT, ch64 n'a pas d'ancre propre)
    // et 303 résout ch66 — les deux diffèrent du chapitre ÉCRIT (64), donc tous deux fautifs.
    assert.deepEqual(v[0].folios.map((f) => f.folio), [301, 303])
  })
})

test('(h) multi-folio en fiche : LDB 85 p.338-343 (même chapitre 85) → silence', () => {
  withTempSrcAndRawDir({}, { 'combat.md': '**Source :** Registre des Traits de créature (LDB 85 p.338-343)\n' }, (srcDir, rawDir) => {
    assert.deepEqual(scanMultiFolioSplitViolations(rawDir), [])
  })
})

test('(h) multi-folio : rapports générés (coverage/reconciliation/reanchor) et épreuves exclus des fiches', () => {
  withTempSrcAndRawDir({}, { 'coverage.md': 'LDB 64 p.301/303\n', 'epreuve-x.md': 'LDB 64 p.301/303\n' }, (srcDir, rawDir) => {
    assert.deepEqual(scanMultiFolioSplitViolations(rawDir), [])
  })
})

test('non-régression : le VRAI docs/raw/ du repo est à ZÉRO multi-folio à cheval sur un autre chapitre (#522)', () => {
  const v = scanMultiFolioSplitViolations()
  assert.deepEqual(
    v.map((x) => `${x.file}:${x.row}`),
    [],
    `multi-folio(s) fautif(s) survivant(s) :\n${v.map((x) => `  ${x.file}:${x.row}  ${JSON.stringify(x.folios)}  ${x.text}`).join('\n')}`,
  )
})

// --- (#454 juge adversarial) scan (i) : folio simple en fin de chapitre (AVERTISSEMENT cliqueté) ---
test('(i) chapterBoundaryRisk (pur, fixture synthétique) : dernier folio de N + N+1 ouvre sur X → risque', () => {
  const map = new Map([
    [10, [{ ch: 1, lo: 1, hi: 5 }]],
    [11, [{ ch: 1, lo: 6, hi: 10 }, { ch: 2, lo: 11, hi: 20 }]], // ch2 s'ouvre AUSSI sur 11 (même folio, contenu à cheval)
  ])
  assert.equal(chapterBoundaryRisk(map, 1, 11), true)
})

test('(i) chapterBoundaryRisk (pur) : N+1 ouvre sur X+1 (cas prouvé LDB 48→49 p.255→256) → risque', () => {
  const map = new Map([
    [10, [{ ch: 1, lo: 1, hi: 5 }]],
    [11, [{ ch: 1, lo: 6, hi: 10 }]],  // dernier folio du ch1 = 11
    [12, [{ ch: 2, lo: 11, hi: 20 }]], // ch2 s'ouvre sur 12 = X+1
  ])
  assert.equal(chapterBoundaryRisk(map, 1, 11), true)
})

test('(i) chapterBoundaryRisk (pur) : folio milieu de chapitre (pas le dernier) → pas de risque', () => {
  const map = new Map([
    [10, [{ ch: 1, lo: 1, hi: 5 }]],
    [11, [{ ch: 1, lo: 6, hi: 10 }]],
    [12, [{ ch: 2, lo: 11, hi: 20 }]],
  ])
  assert.equal(chapterBoundaryRisk(map, 1, 10), false)
})

test('(i) chapterBoundaryRisk (pur) : dernier folio de N mais N+1 s\'ouvre loin (X+5) → pas de risque', () => {
  const map = new Map([
    [10, [{ ch: 1, lo: 1, hi: 5 }]],
    [11, [{ ch: 1, lo: 6, hi: 10 }]],
    [16, [{ ch: 2, lo: 11, hi: 20 }]],
  ])
  assert.equal(chapterBoundaryRisk(map, 1, 11), false)
})

test('(i) scan : LDB 48 p.255 (cas PROUVÉ — Mauvais œil réellement en 49) → détecté ; LDB 49 p.255 (forme corrigée) → silence', () => {
  withTempSrcAndRawDir(
    {},
    { 'combat.md': 'Mauvais œil (LDB 48 p.255) forme fautive\nMauvais œil (LDB 49 p.255) forme corrigée\n' },
    (srcDir, rawDir) => {
      const v = scanChapterBoundaryFolioViolations(rawDir)
      assert.equal(v.length, 1)
      assert.equal(v[0].row, 1)
      assert.equal(v[0].abbr, 'LDB')
      assert.equal(v[0].ch, 48)
      assert.equal(v[0].folio, 255)
    },
  )
})

test('(i) scan : chaque fiche scannée est jugée à part (fautive détectée, corrigée silencieuse)', () => {
  withTempSrcAndRawDir(
    {},
    { 'combat.md': 'Mauvais œil (LDB 48 p.255) forme fautive\n', 'ok.md': 'Mauvais œil (LDB 49 p.255) forme corrigée\n' },
    (srcDir, rawDir) => {
      const v = scanChapterBoundaryFolioViolations(rawDir)
      assert.equal(v.length, 1)
      assert.equal(v[0].file.endsWith('combat.md'), true)
    },
  )
})

test('(i) scan : un folio suivi d\'un autre (LDB 48 p.255/256) n\'est pas un folio simple → silence', () => {
  withTempSrcAndRawDir(
    {},
    { 'combat.md': 'LDB 48 p.255/256 : suffixe multi-folio, jamais compté ici\n' },
    (srcDir, rawDir) => {
      assert.equal(scanChapterBoundaryFolioViolations(rawDir).length, 0)
    },
  )
})

// --- (#585 lot A) stock NOMINATIF par SITE, cliqueté dans les deux sens (patron check-code-refs.mjs) ---
// Le verdict se lit par `cliquets`, la couture même de `main()` : une table recopiée ici ferait un
// cliquet muet dès qu'une famille s'ajoute à la garde.

test('non-régression : les familles cliquetées du VRAI repo sont exactement les sites de graphy-stock.json', () => {
  const stock = readStock()
  assert.ok(stock.length > 0, 'la dette de graphie est encore ouverte : un stock vide ici serait une perte de mesure')
  for (const { family, neuves, perimees } of cliquets(scanTout(), stock)) {
    assert.deepEqual(neuves, [], `${family} — site(s) NEUF(s) :\n${neuves.join('\n')}`)
    assert.deepEqual(perimees, [], `${family} — entrée(s) SOLDÉE(s) :\n${perimees.join('\n')}`)
  }
})

test('graphy-stock.json existe, et chaque entrée nomme sa famille, son fichier, sa réf et son échéance', () => {
  assert.equal(existsSync(STOCK_PATH), true)
  const familles = new Set(FAMILLES_CLIQUETEES.map(({ family }) => family))
  for (const e of readStock()) {
    assert.equal(familles.has(e.famille), true, `famille inconnue de la garde : ${e.famille}`)
    for (const champ of ['fichier', 'ref', 'occurrence', 'lot', 'date']) {
      assert.ok(e[champ] !== undefined && e[champ] !== '', `entrée sans ${champ} : ${JSON.stringify(e)} — sans lot ni date, une ligne de stock est un régime, pas un cliquet`)
    }
  }
})

// --- (#1898) classe (j) : réf au FOLIO en `src/**`, TOUTE ligne, cliquet nominatif ---
// Formes NUES, arbre temporaire : la classe se juge sur ce qu'elle voit, jamais sur l'arbre du jour.
const FOLIO_SRC = {
  'tete.ts': '// Coup de grâce (LDB 47 p.244)\n',
  'fin.ts': 'const x = 1 // LDB 47 p.244\n',
  'titre.test.ts': "it('coup de grâce (LDB 47 p.244)', () => {})\n",
  'chaine.tsx': "const label = 'Coup de grâce (LDB 47 p.244)'\n",
  'champ.json': '{ "note": "Coup de grâce, LDB 47 p.244" }\n',
  'sans-chapitre.ts': 'const y = 2 // ACE p.220\n',
}

test('(j) réf au folio : commentaire de tête, de fin de ligne, titre de test, chaîne affichée, champ JSON, réf sans chapitre → une par site', () => {
  withTempSrcAndRawDir(FOLIO_SRC, {}, (srcDir) => {
    const v = scanFolioSrcViolations(srcDir)
    assert.deepEqual(
      v.map((x) => `${x.file.split('/').pop()}:${x.row} ${x.ref}`).sort(),
      [
        'chaine.tsx:1 LDB 47 p.244',
        'champ.json:1 LDB 47 p.244',
        'fin.ts:1 LDB 47 p.244',
        'sans-chapitre.ts:1 ACE p.220',
        'tete.ts:1 LDB 47 p.244',
        'titre.test.ts:1 LDB 47 p.244',
      ],
    )
  })
})

test('(j) réf au folio : une réf à la LIGNE n\'est pas une violation', () => {
  withTempSrcAndRawDir(
    { 'ok.ts': `const z = 3 // ${spec('LDB', 47, '120-125')}\nit('coup (${spec('ACE', 9, '14')})', () => {})\n` },
    {},
    (srcDir) => assert.deepEqual(scanFolioSrcViolations(srcDir), []),
  )
})

const entreeFolio = (fichier, ref) => ({ famille: 'folioSrc', fichier, ref, occurrence: 1, lot: '#1898', date: '2026-09-23' })
const jugeFolioSrc = (passe, stock) => cliquets(passe, stock).find((c) => c.family === 'folioSrc')

test('(j) cliquet : un site DU stock ne fait pas échouer, un site NEUF et une entrée SOLDÉE font échouer', () => {
  withTempSrcAndRawDir({ 'fin.ts': 'const x = 1 // LDB 47 p.244\n' }, {}, (srcDir, rawDir) => {
    const passe = scanTout(srcDir, ['.ts', '.tsx', '.json'], rawDir)
    const fichier = passe.folioSrc[0].file

    const couvert = jugeFolioSrc(passe, [entreeFolio(fichier, 'LDB 47 p.244')])
    assert.deepEqual([couvert.neuves, couvert.perimees], [[], []])

    const neuf = jugeFolioSrc(passe, [])
    assert.equal(neuf.neuves.length, 1)
    assert.match(neuf.neuves[0], /LDB 47 p\.244 :: 1 — site NEUF/)

    const solde = jugeFolioSrc(passe, [entreeFolio(fichier, 'LDB 47 p.244'), entreeFolio(fichier, 'ACE p.220')])
    assert.deepEqual(solde.neuves, [])
    assert.equal(solde.perimees.length, 1)
    assert.match(solde.perimees[0], /ACE p\.220 :: 1 — entrée SOLDÉE/)
  })
})

// --- (#925) la PASSE UNIQUE nourrit les dix classes : un corpus jouet portant UNE ligne fautive
// par famille, UN seul `scanTout`, chaque détecteur voit la sienne. Un détecteur débranché de la
// passe rougit ici en nommant sa classe (le rapport du garde, lui, resterait muet sur elle).
const JOUET_SRC = [
  '// 18-Traumatisme l.417 : graphie chapitre-relative',                 // 1  graphy
  '// LDB ch.6 l.2 : ch. cosmétique',                                    // 2  chDot
  '// EDOC l.172 : réf de livre sans chapitre',                          // 3  bookNoChapterSrc
  '// RAW 16 l.105 : abréviation inconnue',                              // 4  unknownAbbr
  'const x = 1 // Amphibie (LDB p.338) : réf au folio',                  // 5  folioSrc
].join('\n') + '\n'
const jouetFiche = (sigle) => [
  `Faim (${spec(sigle, 18, '417–422')}) plage à tiret cadratin`,           // 1  docsRaw emdash-range
  'ogres : Langue Magick (ADE II l.653)',                                // 2  docsRaw book-no-chapter + bookNoChapterSrc
  '**Source :** ADE II `08 - Le theatre de la guerre.md` l.89-131.',      // 3  docsRaw backtick-file
  "Ce passage n'est pas implémenté.",                                    // 4  implProse
  'Voir RAW 16 l.105 : abréviation inconnue en fiche',                    // 5  unknownAbbr
  '**Source :** LDB p.339',                                              // 6  bareFolio
  'Mauvais œil (LDB 48 p.255) : folio en fin de chapitre',               // 7  chapterBoundaryFolio
  'Outre à eau (LDB 64 p.301/303) : multi-folio à cheval',               // 8  multiFolioSplit
].join('\n') + '\n'

test('(#925) passe UNIQUE : une ligne fautive par classe, un seul scanTout, chaque classe est nourrie', () => {
  for (const sigle of SIGLES_COEUR) {
    withTempSrcAndRawDir({ 'x.ts': JOUET_SRC }, { 'combat.md': jouetFiche(sigle) }, (srcDir, rawDir) => {
    const passe = scanTout(srcDir, ['.ts', '.tsx', '.json'], rawDir)
    const sites = (famille) => passe[famille].map((v) => `${v.file.split('/').pop()}:${v.row}`)
    const attendu = {
      graphy: ['x.ts:1'],
      chDot: ['x.ts:2'],
      bookNoChapterSrc: ['x.ts:3', 'combat.md:2'], // les DEUX corpus de la même passe
      unknownAbbr: ['x.ts:4', 'combat.md:5'], // les DEUX corpus de la même passe
      folioSrc: ['x.ts:5'],
      bareFolio: ['combat.md:6'],
      chapterBoundaryFolio: ['combat.md:7'],
      multiFolioSplit: ['combat.md:8'],
      docsRaw: ['combat.md:1', 'combat.md:2', 'combat.md:3'],
      implProse: ['combat.md:4'],
    }
    for (const [famille, sitesAttendus] of Object.entries(attendu)) {
      assert.deepEqual(sites(famille), sitesAttendus, `classe ${famille} : la passe unique ne la nourrit pas comme attendu`)
    }
    assert.deepEqual(passe.docsRaw.map((v) => v.kind), ['emdash-range', 'book-no-chapter', 'backtick-file'])
    assert.equal(passe.unknownAbbr[0].abbr, 'RAW')
    assert.equal(passe.folioSrc[0].ref, 'LDB p.338')
    assert.deepEqual(passe.multiFolioSplit[0].folios.map((f) => f.folio), [301, 303])
    assert.deepEqual(
      [passe.chapterBoundaryFolio[0].abbr, passe.chapterBoundaryFolio[0].ch, passe.chapterBoundaryFolio[0].folio],
      ['LDB', 48, 255],
    )
    })
  }
})

test('(#925) ce que rend une passe est GELÉ : un appelant ne peut pas écrire dans le mémo', () => {
  for (const sigle of SIGLES_COEUR) {
    withTempSrcAndRawDir({ 'x.ts': JOUET_SRC }, { 'combat.md': jouetFiche(sigle) }, (srcDir, rawDir) => {
      const exts = ['.ts', '.tsx', '.json']
      const premier = scanGraphyViolations(srcDir, exts)
      assert.equal(Object.isFrozen(premier), true)
      assert.throws(() => premier.push({ file: 'x.ts', row: 99, text: 'intrus' }), TypeError)
      const second = scanGraphyViolations(srcDir, exts)
      assert.deepEqual(second.map((v) => `${v.row}`), premier.map((v) => `${v.row}`))
      assert.equal(Object.isFrozen(scanTout(srcDir, exts, rawDir).chDot), true)
    })
  }
})
