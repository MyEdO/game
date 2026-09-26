// Test de la granularité SECTION adaptative de `coverage.mjs` (#454 défaut A/7, #604) : `sectionsOf`
// (découpe pure du texte d'un chapitre en sections, au niveau de heading `splitLevel`), `refSpansFor`
// (plages de ligne des refs `ABBR NN l.X`), `annotateSections` (recoupement section↔refs) et
// `classifyHole` (ventilation fiche/catalogue/scénario/hors-règle/trou, #604) — toutes PURES, aucun
// accès disque sauf les deux tests marqués « Disque RÉEL ». Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sectionsOf, refSpansFor, annotateSections, classifyHole, estCampagnePure,
  markerSplitStub, chapterTitleOf,
} from './coverage.mjs'
import { BOOKS, chapterFile, coeurDe, niveauDeSectionDe, readText } from './_lib.mjs'

// #604 (garde de classe) : le seam readText (_lib.mjs) normalise \r\n/\r -> \n AU POINT DE LECTURE --
// sectionsOf lui-meme reste nu (aucune tolerance interne). Repro root-cause : le '.' de regex exclut
// TOUT LineTerminator (dont \r, ECMA-262) donc le pattern de heading ancre en fin de ligne echoue net
// sur une ligne CRLF non normalisee, masquant les boundaries H2 (202 fichiers Source/**+docs/raw/**
// mutiles CRLF/mixte le 2026-07-07, contenu identique, index git reste LF). CRLF == LF une fois passe
// par readText, sur un texte porteur d'un enfoui (bullet) pour couvrir aussi ce chemin de decoupage.
test('sectionsOf (#604 garde de classe) : CRLF equivaut a LF une fois normalise par readText', () => {
  const lf = [
    '# BULLET TITRE DU CHAPITRE BULLET',
    '',
    '## Première section',
    'du texte couvert.',
    '',
    '## Section vide',
    'du texte non cité.',
  ].join('\n').replace(/BULLET/g, '•')
  const crlf = lf.replace(/\n/g, '\r\n')
  assert.deepEqual(sectionsOf(crlf.replace(/\r\n|\r/g, '\n'), 2), sectionsOf(lf, 2))
})

test('sectionsOf (#604 garde de classe) : preuve NEGATIVE du defaut -- sans normalisation, la boundary H2 disparait', () => {
    const raw = '# A\r\n## B\r\ntexte'
    assert.equal(sectionsOf(raw, 2).length, 1, 'non normalise : la boundary H2 est invisible (le bug)')
    assert.equal(sectionsOf(raw, 2)[0].title, '(intégral)')
    const normalized = raw.replace(/\r\n|\r/g, '\n')
    assert.equal(sectionsOf(normalized, 2).length, 2, 'normalise (readText) : intro + section B retrouvees')
  })
test('sectionsOf : section H2 sans aucune réf recoupante → trou', () => {
  const text = [
    '# • TITRE DU CHAPITRE •',
    '',
    '## Première section',
    'du texte couvert.',
    '',
    '## Section vide',
    'du texte non cité.',
  ].join('\n')
  const sections = sectionsOf(text)
  const spans = refSpansFor('AA', '9', [{ file: 'x.md', text: 'AA 9 l.4 — couvre la première section.' }])
  const ann = annotateSections(sections, spans)
  const vide = ann.find((s) => s.title === 'Section vide')
  assert.equal(vide.refs, 0)
})

test('sectionsOf : section H2 recoupée par une réf → couverte, pas un trou', () => {
  const text = [
    '# • TITRE •',
    '',
    '## Section couverte',
    'du texte cité en l.4.',
  ].join('\n')
  const sections = sectionsOf(text)
  const spans = refSpansFor('AA', '9', [{ file: 'x.md', text: 'AA 9 l.4 — cite ce passage.' }])
  const ann = annotateSections(sections, spans)
  assert.equal(ann[0].refs, 1)
})

test('sectionsOf : titre H2 orné (•) qui N\'EST PAS le premier heading du fichier → chapitre enfoui', () => {
  const text = [
    '# • LE COMBAT MONTÉ •',
    '',
    '## **Le dressage**',
    'du texte.',
    '',
    '## LES INTÉRIMAIRES DE L\'AVENTURE • •',
    'du texte enfoui, rétrogradé de H1 à H2 par l\'extraction.',
  ].join('\n')
  const sections = sectionsOf(text)
  const dressage = sections.find((s) => s.title === 'Le dressage')
  const enfoui = sections.find((s) => s.title.includes('INTÉRIMAIRES'))
  assert.equal(dressage.enfoui, false)
  assert.equal(enfoui.enfoui, true)
})

test('sectionsOf : titre H1 orné (•) NON-premier = chapitre voisin bavé par l\'extraction → enfoui, absorbe sa sous-section H2 (patron réel ADE II 04 → 05)', () => {
  // `04 - Un peu de magie.md` se termine par `# • LE GRAND HOSPICE •` (folio 68, titre du chapitre 05)
  // suivi de `## DES HAVRES DE REPOS` : Marker a fait baver l'ouverture du ch.05 en queue du ch.04.
  // Le H1 orné doit être une frontière `enfoui` (le mécanisme ne voyait que H2→splitLevel) sinon la
  // sous-section H2 narrative compte à tort comme un trou de règle du ch.04.
  const text = [
    '## UN PEU DE MAGIE • •',            // titre PROPRE du fichier (premier heading, H2 orné) — pas enfoui
    '',
    '## TABLEAU DES BAGUETTES',           // vraie section de règle du chapitre courant
    'du texte de règle.',
    '',
    '# • LE GRAND HOSPICE •',             // titre de CHAPITRE (H1 orné) bavé — chapitre VOISIN
    '',
    '## **DES HAVRES DE REPOS**',
    'prose narrative de l\'hospice, aucune règle.',
  ].join('\n')
  const sections = sectionsOf(text)
  const hospice = sections.find((s) => s.title.includes('GRAND HOSPICE'))
  const havres = sections.find((s) => s.title.includes('HAVRES'))
  assert.ok(hospice, 'le H1 orné bavé est bien devenu une frontière')
  assert.equal(hospice.enfoui, true, 'le chapitre voisin H1 orné est enfoui')
  assert.equal(havres, undefined, 'sa sous-section H2 est ABSORBÉE dans la plage enfouie, pas une section trouable')
  const baguettes = sections.find((s) => s.title === 'TABLEAU DES BAGUETTES')
  assert.equal(baguettes.enfoui, false, 'la vraie section de règle en amont reste une section ordinaire')
  assert.equal(baguettes.hi, hospice.lo, 'elle s\'arrête là où commence le chapitre bavé (n\'avale pas le titre voisin)')
})

test('sectionsOf : titre H2 orné qui EST le premier heading du fichier → faux positif écarté (c\'est le titre du chapitre lui-même)', () => {
  // Patron réel : ADE I 02/03/05/06/07/08, ADE II 01/03/04/08/09 — l'extraction rend le titre de
  // CHAPITRE en H2 orné en tête de fichier (au lieu d'un H1) ; ce n'est pas un chapitre enfoui.
  const text = [
    '*Pages PDF 23-33*',
    '',
    '## <span id="page-22-0" data-folio="22"></span>CLANS HALFLING DU REIKLAND • •',
    '',
    'du texte narratif.',
  ].join('\n')
  const sections = sectionsOf(text)
  const titre = sections.find((s) => s.title.includes('CLANS HALFLING'))
  assert.ok(titre)
  assert.equal(titre.enfoui, false)
})

test('sectionsOf : un chapitre enfoui suivi de N sections H2 ABSORBE ces sections jusqu\'au prochain enfoui ou EOF (#454 juge)', () => {
  // Patron réel `AA 09` : « LES INTÉRIMAIRES DE L'AVENTURE » (H2 enfoui : titre de CHAPITRE ornementé
  // `•`) est suivi de 10 H2
  // normaux (COMBLER LES LACUNES, Embaucher des gros bras…) qui sont SES sous-sections, pas des
  // sœurs du chapitre hôte — sinon la plage se réduit à 4 lignes de titre au lieu des ~300 réelles.
  const text = [
    '# • LE COMBAT MONTÉ •',
    '',
    '## **Le dressage**',
    'contenu du dressage.',
    '',
    '## LES INTÉRIMAIRES DE L\'AVENTURE • •',
    'intro du chapitre enfoui.',
    '',
    '## **COMBLER LES LACUNES**',
    'sous-section absorbée 1.',
    '',
    '## **Embaucher des gros bras**',
    'sous-section absorbée 2.',
  ].join('\n')
  const sections = sectionsOf(text)
  // UNE SEULE section enfouie, pas 3 sections sœurs (le dressage + 2 sous-sections non absorbées).
  assert.equal(sections.filter((s) => !s.isIntro).length, 2)
  const dressage = sections.find((s) => s.title === 'Le dressage')
  const enfoui = sections.find((s) => s.title.includes('INTÉRIMAIRES'))
  assert.ok(!sections.some((s) => s.title === 'COMBLER LES LACUNES'))
  assert.ok(!sections.some((s) => s.title === 'Embaucher des gros bras'))
  assert.equal(dressage.hi, enfoui.lo) // le dressage s'arrête bien où commence l'enfoui
  assert.equal(enfoui.hi, text.split('\n').length + 1) // l'enfoui absorbe jusqu'à l'EOF
})

test('sectionsOf : un DEUXIÈME chapitre enfoui borne l\'absorption du premier (n\'avale pas tout le fichier)', () => {
  const text = [
    '# • TITRE •',
    '',
    '## PREMIER CHAPITRE ENFOUI • •',
    'contenu 1.',
    '',
    '## sous-section du premier',
    'contenu absorbé.',
    '',
    '## SECOND CHAPITRE ENFOUI • •',
    'contenu 2.',
  ].join('\n')
  const sections = sectionsOf(text)
  const enfouis = sections.filter((s) => s.enfoui)
  assert.equal(enfouis.length, 2)
  const premier = enfouis.find((s) => s.title.includes('PREMIER'))
  const second = enfouis.find((s) => s.title.includes('SECOND'))
  assert.equal(premier.hi, second.lo) // le premier s'arrête où commence le second, pas à l'EOF
  assert.ok(!sections.some((s) => s.title === 'sous-section du premier'))
})

test('annotateSections : un chapitre enfoui absorbant N sous-sections ne produit PAS N trous indépendants', () => {
  const text = [
    '# • TITRE •',
    '## CHAPITRE ENFOUI • •',
    'a',
    '## sous-section A',
    'b',
    '## sous-section B',
    'c',
  ].join('\n')
  const sections = sectionsOf(text)
  const ann = annotateSections(sections, [])
  assert.equal(ann.length, 1) // 1 entrée (l'enfoui), pas 3
  assert.equal(ann[0].enfoui, true)
})

test('refSpansFor : suffixe "+N+M" (points DISCRETS) ne fabrique PAS une bbox couvrant tout l\'intervalle', () => {
  // Régression du bug mesuré sur `AA 09 l.157+228` : span()-bbox couvrait à tort [157,228], recoupant
  // 4 sections intermédiaires qui ne contiennent NI l.157 NI l.228.
  const spans = refSpansFor('AA', '9', [{ file: 'x.md', text: 'AA 9 l.157+228 — deux points isolés, pas un intervalle continu.' }])
  assert.deepEqual(spans.map((s) => [s.lo, s.hi]).sort((a, b) => a[0] - b[0]), [[157, 157], [228, 228]])
  const sections = [
    { title: 'entre les deux points', lo: 160, hi: 200, enfoui: false, isIntro: false },
  ]
  const ann = annotateSections(sections, spans)
  assert.equal(ann[0].refs, 0)
})

test('refSpansFor : suffixe "-N" (intervalle continu) recoupe toute section chevauchant la plage', () => {
  const spans = refSpansFor('LDB', '6', [{ file: 'x.md', text: 'LDB 6 l.10-20 — plage continue.' }])
  assert.deepEqual(spans, [{ lo: 10, hi: 20, file: 'x.md' }])
  const sections = [{ title: 'chevauche le milieu', lo: 15, hi: 18, enfoui: false, isIntro: false }]
  const ann = annotateSections(sections, spans)
  assert.equal(ann[0].refs, 1)
})

test('annotateSections : la section "(intro)" (avant le premier H2) est TOUJOURS écartée du détail', () => {
  const sections = sectionsOf(['*Folio 6+*', '', '# • TITRE •', '', '## Seule section', 'texte.'].join('\n'))
  assert.ok(sections.some((s) => s.isIntro))
  const ann = annotateSections(sections, [])
  assert.ok(!ann.some((s) => s.isIntro))
})

test('refSpansFor (#606) : une ref FOLIO `ABBR NN p.X` credite le meme chapitre que `l.X`, sans throw', () => {
  // Disque REEL (LDB 10 = Talents, le cas fondateur du ticket) : la graphie folio des fiches de l'Atlas
  // resout une plage de lignes VIA folioRange -- jamais 0 span silencieux.
  const docs = [{ file: 'talents.md', text: 'LDB 10 p.132 — Table des Talents.' }]
  const stats = { ignoredFolios: 0 }
  const spans = refSpansFor('LDB', '10', docs, stats)
  assert.equal(spans.length, 1)
  assert.ok(spans[0].hi >= spans[0].lo && spans[0].lo > 0)
  assert.equal(stats.ignoredFolios, 0)
})

test('refSpansFor (#606) : un folio qui resout vers un AUTRE chapitre (frontiere) est IGNORE proprement, jamais credite au mauvais chapitre', () => {
  // Cas reel `LDB 49 p.255` (corruption.md) : le folio 255 vit en realite en LDB 48 (residu #454/#522).
  const docs = [{ file: 'corruption.md', text: 'Mauvais œil (LDB 49 p.255).' }]
  const stats = { ignoredFolios: 0 }
  const spans = refSpansFor('LDB', '49', docs, stats)
  assert.deepEqual(spans, [])
  assert.equal(stats.ignoredFolios, 1)
})

// --- #604 : granularité adaptative (`niveauDeSection` du registre) ---

test('sectionsOf(text, 3) : découpe sur H3, pas H2 — le LDB/MCLB ne ressortent plus vides', () => {
  const text = [
    '# • TITRE •',
    '',
    '### Première sous-section H3',
    'du texte couvert.',
    '',
    '### Deuxième sous-section H3',
    'du texte non cité.',
  ].join('\n')
  const sections = sectionsOf(text, 3)
  assert.equal(sections.filter((s) => !s.isIntro).length, 2)
  assert.ok(sections.some((s) => s.title === 'Deuxième sous-section H3'))
})

test('sectionsOf(text, 3) : sans override, splitLevel=2 par défaut → un texte purement H3 ne produit aucune section (comportement historique préservé pour les fixtures existantes)', () => {
  const text = ['# TITRE', '', '### Sous-section H3', 'texte.'].join('\n')
  const sections = sectionsOf(text) // splitLevel implicite = 2
  assert.equal(sections.filter((s) => !s.isIntro).length, 0)
  assert.equal(sections[0].title, '(intégral)') // capitule seulement si l'appelant n'a pas fourni le bon niveau
})

test('sectionsOf(text, 3) : CASCADE — les headings H2 restent aussi des boundaries quand splitLevel=3 (patron NADJ 16 : jeux H2 et H3 entrelacés)', () => {
  const text = [
    '# • JEUX DE TAVERNE •',
    '',
    '### LE BRAS DE FER',
    'jeu 1 (H3).',
    '',
    '## LA BÊTE PARMI LES TAILLEURS',
    'jeu 2 (H2, sœur malgré le niveau différent).',
    '',
    '### MIDDENBALL',
    'jeu 3 (H3), ne doit pas être absorbé dans LA BÊTE.',
  ].join('\n')
  const sections = sectionsOf(text, 3)
  const titles = sections.filter((s) => !s.isIntro).map((s) => s.title)
  assert.deepEqual(titles, ['LE BRAS DE FER', 'LA BÊTE PARMI LES TAILLEURS', 'MIDDENBALL'])
})

test('niveauDeSectionDe (#604, #1825 lot E) : `coverage.mjs` découpe au niveau que le REGISTRE déclare — absent = 2', () => {
  // RÈGLE, pas table : tout livre du registre découpe à un niveau de heading VALIDE, et celui qui ne
  // déclare rien retombe sur 2 (comportement historique). Aucun sigle recopié : la population vient
  // du registre, et le défaut se juge sur un sigle qu'AUCUNE entrée ne porte.
  for (const [ab] of BOOKS) {
    const n = niveauDeSectionDe(ab)
    assert.ok(Number.isInteger(n) && n >= 2 && n <= 6, `${ab} : niveau de section hors [2,6] (${n})`)
  }
  assert.equal(niveauDeSectionDe('SIGLE-ABSENT-DU-REGISTRE'), 2, 'absent du registre = défaut 2, jamais undefined')
})

test('classifyHole (#604) : ventilation ferme, JAMAIS un masquage silencieux', () => {
  assert.equal(classifyHole(3, {}), 'fiche') // recoupée par une réf de fiche → traitée
  assert.equal(classifyHole(0, { horsRegle: true, cat: true, isPur: true }), 'hors-regle') // priorité au périmètre explicite
  assert.equal(classifyHole(0, { cat: true, isPur: true }), 'catalogue') // transcrite, pas hors-règle → catalogue prime sur scénario
  assert.equal(classifyHole(0, { isPur: true }), 'scenario')
  assert.equal(classifyHole(0, {}), 'trou') // aucune exemption : candidat trou de règle
})

test('classifyHole (#604) : un chapitre catalogué mais crédité par une réf de fiche à CETTE section précise reste `fiche`, jamais `catalogue`', () => {
  assert.equal(classifyHole(1, { cat: true }), 'fiche')
})

// --- Disque RÉEL : les 3 recettes du DoD #604 ---

test('#604 recette : NADJ 16 « MIDDENBALL » (H3 l.113) ressort nommément comme sa PROPRE section, plus absorbé par LE TORCHON TREMPÉ (H2)', () => {
  const info = chapterFile('NADJ', '16')
  const text = readText(info.path)
  const sections = sectionsOf(text, niveauDeSectionDe('NADJ'))
  const middenball = sections.find((s) => s.title === 'MIDDENBALL')
  assert.ok(middenball, 'MIDDENBALL doit apparaître comme sa propre section (H3, plus jamais absorbé par un H2 voisin)')
  assert.equal(middenball.lo, 113)
  const torchon = sections.find((s) => s.title === 'LE TORCHON TREMPÉ')
  assert.ok(torchon)
  assert.ok(torchon.hi <= middenball.lo, 'LE TORCHON TREMPÉ (H2) ne doit plus engloutir MIDDENBALL (H3) dans sa plage')
})

test('#604 recette : MCLB (0 section en H2) obtient de VRAIES sections en H3 adaptatif', () => {
  const info = chapterFile('MCLB', '2') // Guide du visiteur — 0 H2, 255 H3 (mesuré)
  const text = readText(info.path)
  const h2Sections = sectionsOf(text, 2).filter((s) => !s.isIntro)
  const h3Sections = sectionsOf(text, niveauDeSectionDe('MCLB')).filter((s) => !s.isIntro)
  assert.equal(h2Sections.length, 0, 'confirme l\'angle mort H2 mesuré (#604)')
  assert.ok(h3Sections.length > 0, 'la granularité adaptative doit produire de vraies sections MCLB')
})

// `niveauDeSection` et `teneur` sont de la DONNÉE ÉDITABLE : le contrat #454/#604 ne se tient pas en
// recopiant leurs valeurs (garde de synchronisation) mais par le COMPORTEMENT, sur le disque RÉEL, au
// cas NOMMÉ que l'arbitrage visait — même patron que les recettes NADJ 16 / MCLB / AA 09.

test('#604 recette : LDB 10 « Talents » — le niveau déclaré du LDB révèle ses sujets ; le défaut H2 les rend AVEUGLES', () => {
  // Cas fondateur mesuré (#604, #606) : le chapitre des Talents s'organise en H3. Au défaut H2 il ne
  // rend que 2 sections — des dizaines de talents deviennent invisibles à la ventilation. Retirer ou
  // baisser le niveau déclaré du LDB fait rougir ICI, pas dans une table recopiée.
  const text = readText(chapterFile('LDB', '10').path)
  const aveugle = sectionsOf(text, 2).filter((s) => !s.isIntro)
  const declare = sectionsOf(text, niveauDeSectionDe('LDB')).filter((s) => !s.isIntro)
  assert.equal(aveugle.length, 2, 'confirme l\'angle mort H2 mesuré sur LDB 10')
  assert.ok(declare.length > 10 * aveugle.length, `le niveau déclaré du LDB doit découper ses SUJETS (${declare.length} sections, contre ${aveugle.length} en H2)`)
})

test('#604 recette : AU1 02 — un livre H4-dominant perd 45 sections dès qu’on le ramène au H3', () => {
  // AU1 est le seul livre du registre dont les sujets vivent en H4 (mesuré : 4 sections en H3, 49 en
  // H4 sur « Si un regard pouvait tuer »). Passer sa déclaration à 3 rendrait ses rencontres muettes.
  const text = readText(chapterFile('AU1', '2').path)
  const h3 = sectionsOf(text, 3).filter((s) => !s.isIntro)
  const declare = sectionsOf(text, niveauDeSectionDe('AU1')).filter((s) => !s.isIntro)
  assert.ok(declare.length > 5 * h3.length, `AU1 doit découper plus FIN que le H3 (${declare.length} vs ${h3.length})`)
})

test('#454 recette : NADJ 16 « MIDDENBALL » — une section de RÈGLE d’un compagnon MIXTE sort en candidat trou, jamais en bruit de scénario', () => {
  // #454 juge tour 2, défaut 1 : NADJ (jeux de taverne, ch.16) et ACE (annexes de règles, ch.11-12
  // transcrits en catalogue) NE SONT PAS des campagnes pures — un trou de section y cache une VRAIE
  // règle. Basculer leur `teneur` en `scenario` à l'atelier reclasserait ces sections en bruit, en
  // silence : la garde est ICI, sur une section RÉELLE, à travers le classifieur de PRODUCTION.
  const sections = sectionsOf(readText(chapterFile('NADJ', '16').path), niveauDeSectionDe('NADJ'))
  const middenball = sections.find((s) => s.title === 'MIDDENBALL')
  assert.ok(middenball, 'la section de règle doit exister sur le disque')
  assert.equal(classifyHole(0, { isPur: estCampagnePure('NADJ') }), 'trou')
})

test('#454 recette : ACE — un livre qui alimente les catalogues de RÈGLE n’est pas une campagne pure', () => {
  // ACE 11 est transcrit au catalogue `divin` : des données de RÈGLE, pas une rencontre. Ses sections
  // non transcrites restent donc des candidats trou de règle.
  assert.ok(chapterFile('ACE', '11'), 'le chapitre de règles cité doit exister')
  assert.equal(classifyHole(0, { isPur: estCampagnePure('ACE') }), 'trou')
})

test('#604 recette (régression #453) : AA 09 « LES INTÉRIMAIRES DE L\'AVENTURE » reste un chapitre enfoui l.191-502 (AA reste H2, non affecté par la granularité adaptative)', () => {
  const info = chapterFile('AA', '9')
  const text = readText(info.path)
  const sections = sectionsOf(text, niveauDeSectionDe('AA'))
  const enfoui = sections.find((s) => s.title.includes('INTÉRIMAIRES'))
  assert.ok(enfoui, 'le chapitre enfoui doit toujours être détecté')
  assert.equal(enfoui.enfoui, true)
  assert.equal(enfoui.lo, 191)
  assert.equal(enfoui.hi - 1, 502)
})

// --- #604 défaut adversarial (juge) : intégration render/compte, pas seulement `classifyHole` en PUR ---
// Le défaut initial vivait dans le MAILLON entre `classifyHole` (déjà correct) et son consommateur
// (`HOLE_MARK`/`HOLE_LABEL` sans clé `'hors-regle'`, boucle de comptage sans branche `'hors-regle'`) —
// invisible des 22 tests PURS ci-dessus, qui n'exercent jamais ce maillon de rendu/comptage. Preuve par
// un run RÉEL du script complet (`main()`, via sous-processus — le seul moyen d'exercer main() qui n'est
// PAS exporté) sur `docs/raw/coverage.md` généré.
test('#604 intégration (régression juge adversarial) : coverage.md régénéré ne contient AUCUNE ligne `undefined` (chapitre ✅/📖 par ailleurs hors-règle, ex. AA 02/EDOC 13/MDG 03)', async () => {
  const { execFileSync } = await import('node:child_process')
  execFileSync(process.execPath, ['scripts/raw/coverage.mjs'], { cwd: process.cwd(), stdio: 'pipe' })
  const md = readText('docs/raw/coverage.md')
  const undefinedLines = md.split('\n').filter((l) => l.includes('undefined'))
  assert.deepEqual(undefinedLines, [], `aucune ligne « undefined » ne doit apparaître (poison de rendu, #604 juge) — trouvé :\n${undefinedLines.join('\n')}`)
})

test('#604 intégration : une section 0-réf d\'un chapitre ✅/📖 hors-règle (ex. AA 02 « INTRODUCTION », front-matter) rend `➖` (mark hors-regle), jamais un fallback undefined', () => {
  const md = readText('docs/raw/coverage.md')
  const block = md.slice(md.indexOf('- **AA 02**'), md.indexOf('- **AA 02**') + 400)
  assert.ok(block.includes('➖ l.'), 'AA 02 doit porter au moins une section ➖ hors-règle détaillée')
  assert.ok(!block.includes('undefined'))
})

test('#604 intégration : le total ventilé (catalogue + hors-règle + scénario + trou) de la ligne de résumé est COHÉRENT avec la somme annoncée, jamais un total qui dérive du détail', () => {
  const md = readText('docs/raw/coverage.md')
  const summary = md.split('\n').find((l) => l.startsWith('Section-granulaire'))
  assert.ok(summary)
  const totalM = /sur (\d+) section\(s\) non couvertes par une fiche/.exec(summary)
  const catM = /(\d+) transcrite\(s\) en catalogue/.exec(summary)
  const horsM = /(\d+) hors-règle/.exec(summary)
  const scenM = /(\d+) bruit de scénario/.exec(summary)
  const trouM = /(\d+) candidat\(s\) trou de règle/.exec(summary)
  assert.ok(totalM && catM && horsM && scenM && trouM)
  const sum = Number(catM[1]) + Number(horsM[1]) + Number(scenM[1]) + Number(trouM[1])
  assert.equal(sum, Number(totalM[1]), 'la somme des 4 buckets doit reconstituer EXACTEMENT le total annoncé')
})

// #1825 lot C : le résumé de tête ne somme plus DEUX corps de règles en un total. Une ligne par
// GROUPE (une par valeur de `coeur` rencontrée, une pour les livres sans cœur déclaré), chacune
// avec SES comptes et SON dénominateur, et la réunion des dénominateurs couvre tous les chapitres.
test('#1825 : le résumé de tête rend UNE ligne par groupe de livres, jamais un total confondu', () => {
  const md = readText('docs/raw/coverage.md')
  const lignes = md.split('\n').filter((l) => /^- \*\*(Cœur |Livres sans cœur déclaré)/.test(l))
  const coeurs = new Set(BOOKS.map(([a]) => coeurDe(a)).filter((c) => c))
  assert.equal(lignes.length, coeurs.size + 1, 'une ligne par cœur, plus celle des livres sans cœur')
  for (const c of coeurs) assert.ok(lignes.some((l) => l.startsWith(`- **Cœur ${c}**`)), `groupe manquant : ${c}`)
  for (const l of lignes) assert.match(l, /sur \d+ chapitres-règles/, 'chaque groupe porte SON dénominateur')
  assert.equal(md.split('\n').some((l) => l.startsWith('**Couverture (profondeur) :')), false, 'plus de total confondu')
})

// #1825 lot E : la ligne de résumé ne NOMME plus aucun livre à la main. Ses deux listes de sigles
// PARTITIONNENT le registre par la TENEUR lue en donnée — avant, la seconde (« compagnons mixtes
// ACE/NADJ/ADE/MCLB/EDOC/MSRC/MDG ») n'était produite par AUCUNE table, et citait `ADE`, un sigle
// qu'aucune entrée ne porte. Elle ne cite pas davantage un identifiant de CODE au lecteur.
test('#1825 : les deux listes de la ventilation sont DÉRIVÉES du registre et le partitionnent', () => {
  const md = readText('docs/raw/coverage.md')
  const summary = md.split('\n').find((l) => l.startsWith('Section-granulaire'))
  assert.ok(summary)
  const pures = /bruit de scénario\*\* \(livres de teneur `scenario` ([^ ]+) :/.exec(summary)
  const reste = /candidat\(s\) trou de règle\*\* \(reste : (.+?) — livres de règles/.exec(summary)
  assert.ok(pures && reste, 'les deux listes de sigles doivent être présentes')
  assert.deepEqual(pures[1].split('/'), BOOKS.filter(([a]) => estCampagnePure(a)).map(([a]) => a))
  assert.deepEqual(reste[1].split('/'), BOOKS.filter(([a]) => !estCampagnePure(a)).map(([a]) => a))
  assert.equal(pures[1].split('/').length + reste[1].split('/').length, BOOKS.length, 'les deux listes partitionnent le registre')
  // La classe se mesure par la graphie SCREAMING_SNAKE : les titres de chapitre en capitales portent
  // des ESPACES, jamais des underscores.
  const identifiants = [...new Set(md.match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g) ?? [])]
  assert.deepEqual(identifiants, [], `aucun identifiant de code dans un doc de lecture : ${identifiants.join(', ')}`)
})

// --- ARTEFACT jugé sur le CONTENU, pas sur le titre de fichier (#1279 S4-a) ---
// Cas FONDATEUR, à faire rougir s'il se réintroduit : `NADJ 17 - _GoBack.md` porte la SUITE du
// chapitre 16 (quatre jeux de taverne, chacun avec son bloc « Jeu : ») et sortait du registre sur le
// seul motif que Marker l'avait nommé d'après une ancre HTML. Un `_` en tête de nom de fichier n'est
// PAS un verdict ; seul un stub de découpe (note de page partagée, aucune ligne de source) en est un.
test('markerSplitStub : un chapitre RÉEL nommé d\'après une ancre Marker n\'est PAS un artefact', () => {
  const reel = [
    '*Pages PDF 97-98*', '', '### **LES MOULINS**', '',
    'Ce jeu pour deux joueurs se joue sur un plateau quadrillé.', '',
    '**Jeu :** faites un Test opposé étendu d\'**Intelligence Facile (+40)**.',
  ].join('\n')
  assert.equal(markerSplitStub(reel), false)
  assert.equal(chapterTitleOf('_GoBack', reel), 'LES MOULINS')
})

test('markerSplitStub : un VRAI stub de découpe (note de page partagée seule) reste un artefact', () => {
  const stub = [
    '*Pages PDF 70*', '', '# _GoBack', '',
    '*(Page 70 partagée avec un chapitre voisin — le contenu de cette section figure dans le chapitre adjacent de l\'extraction Marker.)*',
  ].join('\n')
  assert.equal(markerSplitStub(stub), true)
  assert.equal(chapterTitleOf('_GoBack', stub), '*(artefact OCR)*')
})

test('chapterTitleOf : un nom de fichier ORDINAIRE n\'est jamais réécrit', () => {
  assert.equal(chapterTitleOf('JEUX DE TAVERNE', '# autre chose'), 'JEUX DE TAVERNE')
})

// INVARIANT, sur le disque RÉEL : tout chapitre que le registre écarte en « artefact OCR » DOIT être
// un stub de découpe vérifiable dans `Source/`. C'est la garde du PROCHAIN fichier coupé — le cas
// fondateur (NADJ 17, quatre jeux de taverne écartés sur leur seul nom de fichier) a été réparé À LA
// SOURCE par fusion dans son chapitre (#1279 S4-a), il n'existe donc plus comme ligne à surveiller ;
// ce qui reste à surveiller, c'est la RÈGLE qui l'avait laissé passer.
test('#1279 intégration (disque RÉEL) : aucun chapitre écarté en « artefact OCR » ne porte de contenu de source', () => {
  const md = readText('docs/raw/coverage.md')
  const menteurs = []
  let livre = null
  for (const l of md.split('\n')) {
    const h = /^## ([A-Z][A-Z0-9 ]*?) — /.exec(l)
    if (h) { livre = h[1].trim(); continue }
    const row = /^\| (\d+) \| \*\(artefact OCR\)\* \|/.exec(l)
    if (!row || !livre) continue
    const info = chapterFile(livre, row[1])
    if (info && !markerSplitStub(readText(info.path))) menteurs.push(`${livre} ${row[1]} (${info.path})`)
  }
  assert.deepEqual(menteurs, [], `« artefact OCR » ne se juge QUE sur le contenu — ces chapitres portent de la source :\n${menteurs.join('\n')}`)
})
