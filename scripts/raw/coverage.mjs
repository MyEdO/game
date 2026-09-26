// Registre de couverture de l'Atlas RAW — le backbone de « l'Atlas remplace la source ».
// Déterministe : pour chaque chapitre des livres autorisés, vérifie s'il est CITÉ (`ABBR NN l.`)
// par au moins une fiche docs/raw/*.md. Un chapitre non cité = trou (à couvrir ou à marquer hors-règle).
// #454 défaut A/7 : granularité SECTION en sus du chapitre — un chapitre à sujets multiples peut être
// ✅ au total (une section porte l'essentiel des refs) tout en enfouissant une section SANS AUCUNE réf.
// `sectionsOf`/`refSpansFor`/`annotateSections`/`classifyHole` sont PURES (testées) ; seule `classify`
// touche le disque (chapterFile). Re-run après chaque domaine pour voir les trous se réduire à zéro.
// #604 : granularité ADAPTATIVE (`niveauDeSection` de `books.json`, PAR LIVRE) — le LDB/MCLB structurent
// leurs chapitres en H3, pas H2 ; un simple argmax de comptage brut s'y ferait piéger par les listes
// profondément imbriquées (chronologies AA en gras, qui gonflent H4 même dans des livres réellement
// structurés en H2 — mesuré, cf. #604). Zéro masquage silencieux : un chapitre crédité par CATALOGUE ne
// supprime plus ses trous de section, il les ÉTIQUETTE (`classifyHole`) — fiche / catalogue / scénario /
// hors-règle / trou. Le dénominateur de la ligne de résumé est DÉRIVÉ (jamais un compte recopié).
// #1825 lot E : ce script ne NOMME aucun livre — un livre de plus, c'est de la DONNÉE. Ce qu'on sait
// du LIVRE (teneur, niveau de section) vit dans son entrée de `src/data/books.json` ; ce qu'on sait de
// ses CHAPITRES (hors-règle, catalogues) dans `scripts/raw/chapitres.json`. Les deux se lisent par les
// accesseurs de `_lib.mjs` — zéro ligne ici.
// Sortie : docs/raw/coverage.md
import { existsSync } from 'node:fs'
import { listerDossier, parUnitesDeCode } from '../guards/lib/lister.mjs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS, coeurDe, esc, chapterFile, estHorsRegle, folioSpan, motifHorsRegle, niveauDeSectionDe, pagesDeLAtlas, readText, teneurDe } from './_lib.mjs'
import { graphieDuFichier, numeroDuFichier, plageDeLigne1, titreDuFichier } from '../../src/data/source/decoupe.ts'
import { ecrireDoc } from '../docs/lib/empreinte-sources.mjs'
export const RAWDIR = 'docs/raw'
// Acceptation DÉCLARÉE à la couture (`pagesDeLAtlas`) : tout sauf les rapports générés — l'épreuve
// datée et les pages d'auteur CITENT des chapitres, et ce qu'elles citent est couvert.
export const CLASSES = ['fiche', 'catalogue', 'auteur', 'epreuve']
// Le front-matter (index/intro/préface) de TOUT livre est hors-règle par son TITRE — une propriété du
// fichier, pas du livre : elle reste ici, là où les chapitres hors-règle NOMMÉS vivent en donnée.
const isFrontMatter = (t) => /^index$|^introduction|avant-?propos|préface|^preface|^sommaire|^\*+$/i.test(t.trim())

// Nettoie un titre de heading Markdown brut (span d'ancre folio, gras) → texte comparable.
// Exportée (#604 défaut latent, `check-catalogue-complete.mjs`) : même nettoyage des DEUX côtés
// (section de chapitre / heading de bloc catalogue), jamais une resaisie divergente.
export function cleanTitle(t) {
  return t.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '').replace(/\*\*/g, '').trim()
}

// --- ARTEFACT d'extraction : jugé sur le CONTENU, jamais sur le titre de fichier (#1279 S4-a) ---

// Marker nomme un fichier de découpe d'après la PREMIÈRE ancre HTML qu'il y rencontre : un chapitre
// entier peut donc s'appeler `_GoBack` ou `_Hlk18182212`. Juger « artefact » sur ce nom est un
// non-sequitur, et il a coûté cher : `NADJ 17 - _GoBack.md` porte la SUITE du chapitre 16 — quatre
// jeux de taverne complets, chacun avec son bloc « Jeu : » (LES MOULINS, QUESTIONS-RÉPONSES,
// L'IMPÉRATRICE ÉCARLATE, LES PIERRES) — et n'a jamais été listé en trou parce qu'il était écarté
// AVANT toute analyse. Douze autres chapitres subissaient le même sort, dont `LDB 45` (ouverture
// « • MAGIE • ») et `LDB 58` (« • GUIDE DE L'ÉQUIPEMENT • »).
//
// Le VRAI artefact a une signature de CONTENU, posée par l'extraction elle-même : le fichier ne
// contient que la note de page partagée, sans une ligne de source. PURE (testée).
const SPLIT_NOTE = /page \d+ partagée avec un chapitre voisin/i
export function markerSplitStub(text) {
  const reste = text.split('\n')
    .filter((l) => l.trim())
    .filter((l) => plageDeLigne1(l) == null)          // en-tête de découpe
    .filter((l) => !/^#{1,6}\s/.test(l))              // titre (l'ancre Marker elle-même)
    .filter((l) => !SPLIT_NOTE.test(l))               // la note de page partagée
  return reste.length === 0
}

// TITRE affiché d'un chapitre : le nom de fichier, sauf quand ce nom est une ancre Marker (`_…`) —
// auquel cas le premier heading du fichier dit la vérité (« • MAGIE • »). Un stub de découpe n'a rien
// à dire (« artefact OCR ») ; un chapitre réel SANS aucun heading non plus, mais il n'est pas un
// artefact pour autant — il le DIT, plutôt que d'emprunter l'étiquette qui l'a fait disparaître.
// PURE (testée).
export function chapterTitleOf(title, text) {
  if (!/^_/.test(title)) return title
  if (markerSplitStub(text)) return '*(artefact OCR)*'
  const h = text.split('\n').find((l) => /^#{1,6}\s/.test(l) && !/^#{1,6}\s*_/.test(l))
  return h ? cleanTitle(h.replace(/^#{1,6}\s*/, '').replace(/<\/?[a-z]+>/gi, '')) : '*(section sans titre)*'
}

// Chapitres crédités par un CATALOGUE (catalogue-*.md = données mécaniques verbatim ré-extraites, sans
// réf `l.X` ligne — créditées au niveau CHAPITRE via `ABBR NN`) → Set de clés « ABBR NN » (tous livres).
// Extraite de `main()` (#604 défaut latent) : SOURCE UNIQUE consommée par `classify` (mark `📖`) ET par
// `check-catalogue-complete.mjs` (vérifie que la convention qui justifie ce mark tient vraiment).
export function catalogChaptersOf(docs) {
  const catalogCh = new Set()
  for (const d of docs) {
    if (d.classe !== 'catalogue') continue
    for (const [ab] of BOOKS) {
      const re = new RegExp(`\\b${esc(ab)} (\\d+)\\b`, 'g')
      let m
      while ((m = re.exec(d.text))) catalogCh.add(`${ab} ${Number(m[1])}`)
    }
  }
  return catalogCh
}

// Découpe le texte d'un fichier-chapitre en sections `[{ title, lo, hi, enfoui, isIntro }]` (`lo`/`hi` =
// lignes 1-based, `hi` EXCLUSIF), au niveau de heading `splitLevel` (2/3/4, #604 `niveauDeSection`) — les
// boundaries retenues sont TOUS les headings de niveau `[2, splitLevel]` (CASCADE, pas le seul niveau
// dominant) : un livre H3-dominant (ex. NADJ) porte aussi de vrais titres H2 sœurs (`NADJ 16` : « LA
// BÊTE… », « LE TORCHON TREMPÉ » sont H2, entrelacés avec des jeux H3 comme « MIDDENBALL » l.113) — les
// ignorer les ferait absorber comme du texte de la section H3 précédente, un second masquage silencieux.
// `enfoui` : le titre porte l'ornement `•` (marque d'un titre de CHAPITRE dans la source — normalement
// rendu en H1) ET ce heading n'est PAS le premier du fichier (le premier heading orné = le titre du
// CHAPITRE COURANT lui-même, faux positif ; validé sur `ADE I 02/03/05/06/07/08`, `ADE II 01/03/04/08/09`
// : tous à la ligne 3-5 du fichier). ⚠ Un enfoui n'est PAS une section sœur de celles qui suivent : c'est
// un titre de CHAPITRE rétrogradé, donc les boundaries normales qui le suivent lui appartiennent (ce sont
// SES sous-sections), au même titre que « Le dressage » appartient à « LE COMBAT MONTÉ » (H1). Sa plage
// s'étend jusqu'au PROCHAIN enfoui du fichier (nouveau chapitre embarqué), ou à défaut jusqu'à la fin du
// fichier — jamais juste jusqu'à la prochaine boundary littérale (mesuré : `AA 09 l.191` réduit à 4
// lignes de titre au lieu des ~311 lignes réelles avant #454 juge, absorbant à tort 10 sous-sections
// comme sœurs). `splitLevel` par défaut 2 (comportement historique, tests synthétiques H2 inchangés).
export function sectionsOf(text, splitLevel = 2) {
  const lines = text.split('\n')
  const headingRe = /^(#{1,6})\s*(.*)$/
  let firstHeadingLine = null
  const boundaries = []
  lines.forEach((l, i) => {
    const m = headingRe.exec(l)
    if (!m) return
    const isFirst = firstHeadingLine == null
    if (isFirst) firstHeadingLine = i + 1
    const level = m[1].length
    const title = cleanTitle(m[2])
    // Frontières : niveaux [2, splitLevel] comme d'habitude, PLUS tout titre H1 ORNÉ (`•`) qui n'est
    // PAS le premier heading du fichier. Le `•` marque un titre de CHAPITRE (rendu H1 dans la source) ;
    // un tel titre APRÈS le titre propre du fichier = un chapitre VOISIN qui a « bavé » à l'extraction
    // Marker (ex. `# • LE GRAND HOSPICE •` folio 68, en queue de `ADE II 04`, appartient à `ADE II 05`).
    // Sans cette frontière, ses sous-sections H2 (« DES HAVRES DE REPOS ») comptent à tort comme des
    // trous de règle du chapitre courant ; ajoutée, `isEnfoui` (ci-dessous, même critère `•`) les absorbe
    // dans la plage du chapitre enfoui. Le `!isFirst` protège le titre H1 propre du fichier (jamais une
    // frontière — il ouvre l'intro), donc les chapitres sans bavure sont inchangés (boundaries identiques).
    if ((level >= 2 && level <= splitLevel) || (level === 1 && !isFirst && /•/.test(title)))
      boundaries.push({ line: i + 1, title })
  })
  const eof = lines.length + 1
  const sections = []
  if (boundaries.length && boundaries[0].line > 1) {
    sections.push({ title: '(intro)', lo: 1, hi: boundaries[0].line, enfoui: false, isIntro: true })
  }
  const isEnfoui = (h) => /•/.test(h.title) && h.line !== firstHeadingLine
  let k = 0
  while (k < boundaries.length) {
    const h = boundaries[k]
    if (isEnfoui(h)) {
      let j = k + 1
      while (j < boundaries.length && !isEnfoui(boundaries[j])) j++
      const hi = j < boundaries.length ? boundaries[j].line : eof
      sections.push({ title: h.title, lo: h.line, hi, enfoui: true, isIntro: false })
      k = j
    } else {
      const hi = k + 1 < boundaries.length ? boundaries[k + 1].line : eof
      sections.push({ title: h.title, lo: h.line, hi, enfoui: false, isIntro: false })
      k++
    }
  }
  // #604 : aucun fallback « (intégral) » silencieux quand `splitLevel` ne trouve rien — l'appelant
  // (`classify`) est responsable de DESCENDRE de niveau avant d'accepter une capitulation ; ici on ne
  // capitule QUE s'il n'y a vraiment aucun heading exploitable (chapitre court, réellement monolithique).
  if (!sections.length) sections.push({ title: '(intégral)', lo: 1, hi: eof, enfoui: false, isIntro: true })
  return sections
}

// Plages de ligne `{ lo, hi, file }` de toutes les refs `ABBR NN l.X[suffixe]` ET `ABBR NN p.folio[suffixe]`
// (#606 : la graphie folio des fiches de l'Atlas etait invisible ici) d'un chapitre, dans DOCS.
// ⚠ N'utilise PAS `span()` de `_lib.mjs` : cette derniere reduit un suffixe `+N+M` (points DISCRETS,
// « et aussi l.N, l.M ») a une bbox `[X, max(N,M)]` — correct pour son usage (borne « dans le
// chapitre »), mais ici cette bbox fabrique un FAUX chevauchement de section (mesure : `AA 09
// l.157+228` couvrait a tort 4 sections entre l.157 et l.228 qui ne contiennent RIEN de ces deux
// points). On emet un span PAR POINT DISCRET (`+N` = son propre point) ; seul `-N` reste un
// intervalle continu — meme granularite appliquee aux refs folio, converties en lignes via
// `folioSpan` (accès disque UNIQUEMENT si des refs `p.` sont presentes dans `docs`). `stats`
// (optionnel, `{ ignoredFolios }`) accumule les folios ignores proprement (ancre absente,
// ambigue, ou resolue vers un AUTRE chapitre — jamais un throw, #606).
export function refSpansFor(ab, nn, docs, stats) {
  const reLine = new RegExp(`\\b${esc(ab)} 0*${Number(nn)} l\\.(\\d+)((?:[-+]\\d+)*)`, 'g')
  const rePage = new RegExp(`\\b${esc(ab)} 0*${Number(nn)} p\\.(\\d+)((?:[-+]\\d+)*)`, 'g')
  const spans = []
  for (const d of docs) {
    reLine.lastIndex = 0
    let m
    while ((m = reLine.exec(d.text))) {
      const line = Number(m[1]); const suffix = m[2]
      const range = suffix.match(/^-(\d+)/)
      if (range) { spans.push({ lo: line, hi: Number(range[1]), file: d.file }); continue }
      spans.push({ lo: line, hi: line, file: d.file })
      for (const p of (suffix.match(/\+(\d+)/g) || [])) {
        const n = Number(p.slice(1))
        spans.push({ lo: n, hi: n, file: d.file })
      }
    }
    rePage.lastIndex = 0
    while ((m = rePage.exec(d.text))) {
      const resolved = folioSpan(ab, nn, m[1], m[2])
      if (!resolved) { if (stats) stats.ignoredFolios = (stats.ignoredFolios || 0) + 1; continue }
      spans.push({ lo: resolved[0], hi: resolved[1], file: d.file })
    }
  }
  return spans
}

// Annote chaque section (hors intro) de son nombre de refs qui la recoupent → `{ ...section, refs }`.
export function annotateSections(sections, spans) {
  return sections.filter((s) => !s.isIntro).map((s) => {
    const refs = spans.filter((sp) => sp.lo < s.hi && sp.hi >= s.lo).length
    return { ...s, refs }
  })
}

// #604 : ventilation EXPLICITE d'une section NON couverte par une fiche (`refs === 0`), PURE — jamais un
// masquage silencieux. Cinq destins pour une section (hors enfoui, qui reste hors-classement) :
//   - 'fiche'      : recoupée par une réf `l.`/`p.` d'une fiche de règles (traitée, pas juste recopiée).
//   - 'hors-regle' : le CHAPITRE entier est explicitement exclu (`horsRegle` de `scripts/raw/chapitres.json`,
//     ou front-matter détecté au titre) — hors sujet
//     par construction, quel que soit le contenu de la section.
//   - 'catalogue'  : le chapitre est crédité par un `catalogue-*.md` (transcription verbatim au chapitre,
//     jamais en ligne) — la section n'est pas TRAITÉE, elle est RECOPIÉE (#604 DoD : transcrit ≠ traité).
//   - 'scenario'   : livre de teneur `scenario` (campagne pure) — bruit de scénario, jamais une règle propre.
//   - 'trou'       : candidat trou de RÈGLE — aucune des exemptions ci-dessus ne s'applique.
/** Campagne PURE (#454) : seule teneur dont une section sans fiche est du bruit, jamais un trou de règle. */
export const estCampagnePure = (ab) => teneurDe(ab) === 'scenario'

export function classifyHole(refs, { cat = false, horsRegle = false, isPur = false } = {}) {
  if (refs > 0) return 'fiche'
  if (horsRegle) return 'hors-regle'
  if (cat) return 'catalogue'
  if (isPur) return 'scenario'
  return 'trou'
}

// Classe un chapitre : ✅ fiche (propriétaire ≥3 refs ligne) · 📖 catalogue SEUL (transcrit, pas traité) ·
// 🟡 effleuré (1-2 refs, sans catalogue) · ⬜ trou (aucune ref, aucun catalogue).
// `sections` : détail section-granulaire (trous ET chapitres enfouis), calculé quel que soit le mark
// chapitre — un chapitre ✅ (des refs abondantes ailleurs) peut enfouir une section SANS AUCUNE réf ;
// c'est exactement le défaut A (#454) : ne JAMAIS gater le détail par le mark chapitre.
function classify(ab, nn, horsRegle, isPur, docs, catalogCh) {
  // (l|p) : les deux graphies canoniques de citation d'un chapitre comptent pour sa couverture (#606)
  const re = new RegExp(`\\b${esc(ab)} 0*${Number(nn)} (?:l|p)\\.`, 'g')
  let total = 0, owner = '', ownerN = 0
  for (const d of docs) {
    const n = (d.text.match(re) || []).length
    total += n
    if (n > ownerN) { ownerN = n; owner = d.file }
  }
  const cat = catalogCh.has(`${ab} ${Number(nn)}`)
  if (cat && ownerN < 3) owner = owner || 'catalogue-*.md'
  // #604 : ✅ fiche (réf de ligne, ≥3) prime sur 📖 catalogue-seul (transcrit, jamais traité) — distinct
  // au chapitre ET, ci-dessous, distinct au niveau section (`classifyHole`).
  const mark = ownerN >= 3 ? '✅' : cat ? '📖' : total > 0 ? '🟡' : '⬜'

  let holes = [], enfoui = []
  const folioStats = { ignoredFolios: 0 }
  const info = chapterFile(ab, nn)
  if (info) {
    const text = readText(info.path)
    const splitLevel = niveauDeSectionDe(ab)
    const sections = sectionsOf(text, splitLevel)
    const spans = refSpansFor(ab, nn, docs, folioStats)
    const annotated = annotateSections(sections, spans)
    enfoui = annotated.filter((s) => s.enfoui)
    // #604 : ZÉRO masquage silencieux — un chapitre catalogué ou hors-règle ne suppprime plus ses
    // sections non-fiche, il les ÉTIQUETTE via `classifyHole` (jamais `holes = []`). Un chapitre de livre
    // à teneur déclarée mais crédité ✅ par des refs de règle embarquées (ex. NADJ 16 « Jeux de taverne »,
    // crédité pour PRÉCISÉMENT ce contenu, #454 faux vert) n'y perd rien : `isPur` (book-level, PAS
    // `horsRegle`) ventile alors ses sections vides en 'scenario' seulement pour les campagnes PURES.
    holes = annotated
      .filter((s) => !s.enfoui)
      .map((s) => ({ ...s, hole: classifyHole(s.refs, { cat, horsRegle, isPur }) }))
      .filter((s) => s.hole !== 'fiche')
  }
  return { total, owner, ownerN, mark, cat, holes, enfoui, ignoredFolios: folioStats.ignoredFolios }
}

const HOLE_MARK = { catalogue: '📖', scenario: '⬜', trou: '⬜', 'hors-regle': '➖' }
const HOLE_LABEL = { catalogue: 'transcrit en catalogue, jamais traité', scenario: 'bruit de scénario', trou: 'candidat trou de règle', 'hors-regle': 'hors-règle (narratif/cadre), chapitre par ailleurs couvert' }

/** Les pages LUES par cette acceptation, texte compris — source UNIQUE de `check-catalogue-complete`
 *  et de leurs bancs. Une page est identifiée par son chemin RELATIF à l'Atlas : deux cœurs portent
 *  le même nom de fiche. */
export const pagesLues = (rawDir = RAWDIR) => pagesDeLAtlas(rawDir, { classes: CLASSES })
  .map((p) => ({ file: p.relatif, classe: p.classe, text: readText(p.chemin) }))

function main(rawDir = RAWDIR) {
  // Profondeur-conscient : on garde chaque fiche séparée pour compter les refs et trouver la fiche PROPRIÉTAIRE.
  const docs = pagesLues(rawDir)
  // Chapitres crédités par un catalogue : source unique `catalogChaptersOf` (#604 défaut latent —
  // extraite pour être réutilisée par `check-catalogue-complete.mjs`, jamais une resaisie).
  const catalogCh = catalogChaptersOf(docs)

  const SUMMARY_PLACEHOLDER = '__SUMMARY_LINE__'
  const out = ['# Atlas RAW — Registre de couverture', '',
    `> Contrat « l'Atlas remplace la source » : chaque chapitre des ${BOOKS.length} livres doit être **couvert**`,
    '> (cité par une fiche `docs/raw/`, ✅) ou explicitement **hors-règle** (narratif). Un chapitre `⬜` = trou.',
    '> `📖` = crédité par un CATALOGUE seul (donnée verbatim ré-extraite au chapitre) — **transcrit, pas',
    '> traité** : recourir à la source pour un point qui y vit encore = un défaut de l\'Atlas à corriger.',
    '> Régénéré par `node scripts/raw/coverage.mjs`. Détail **section-granulaire** (niveau de heading',
    '> ADAPTATIF par livre, #604) sous la table d\'un chapitre qui enfouit ou troue une section :',
    '> `⬜` = section sans aucune réf de fiche dans sa plage (`trou` = candidate règle non couverte,',
    '> `scénario` = bruit de campagne pure) · `📖` = section 0-réf d\'un chapitre catalogué (transcrite,',
    '> jamais traitée — plus jamais masquée) · `🔻 enfoui` = titre orné (`•`) rétrogradé par l\'extraction',
    '> — un défaut d\'extraction, pas une section ordinaire (#454).', '',
    SUMMARY_PLACEHOLDER, '']

  let gOk = 0, gCat = 0, gMid = 0, gHole = 0
  let gSecEnfoui = 0
  // #604 : ventilation section-granulaire en CINQ comptes distincts, dérivés (jamais un total confondu) —
  // `classifyHole` est l'UNIQUE source de vérité de cette classification.
  let gSecCatalogue = 0, gSecHorsRegle = 0, gSecHolesScenario = 0, gSecHolesRegle = 0
  let gIgnoredFolios = 0 // #606 : folios cites en docs sans ancre data-folio resoluble dans le bon chapitre
  const perBook = []
  // Résumé de tête par GROUPE de livres : un corps de règles (`coeur` de books.json) ne se somme pas
  // avec un autre, ni avec les suppléments — chaque groupe porte SES comptes et SON dénominateur.
  // DÉRIVÉ du registre : un cœur de plus y apparaît sans une ligne ici.
  const parGroupe = new Map() // clé de cœur (ou `null`) -> { ok, cat, mid, hole }
  const groupe = (ab) => {
    const cle = coeurDe(ab)
    if (!parGroupe.has(cle)) parGroupe.set(cle, { ok: 0, cat: 0, mid: 0, hole: 0 })
    return parGroupe.get(cle)
  }
  // ANOMALIE (#1279 S4-a) : stubs de découpe CITÉS par l'Atlas — des réfs qui pointent dans le vide.
  const stubsCites = []
  const info0 = (ab, nn) => chapterFile(ab, nn)?.path ?? `${ab} ${nn}`
  for (const [ab, dir] of BOOKS) {
    if (!existsSync(dir)) { out.push(`## ${ab} — ⚠ dossier introuvable (${dir})`, ''); continue }
    const files = listerDossier(dir).filter((f) => numeroDuFichier(f) != null)
    let bOk = 0, bCat = 0, bMid = 0, bHole = 0
    const lines2 = ['| Ch. | Titre | État | refs (propriétaire) |', '|---|---|---|---|']
    const detailBlocks = []
    const isPur = estCampagnePure(ab)
    for (const f of files) {
      const nn = graphieDuFichier(f)
      const title = titreDuFichier(f)
      // Le CONTENU tranche (cf. `markerSplitStub`/`chapterTitleOf`) : un nom de fichier `_GoBack` est
      // une ancre Marker, pas un verdict. Seul un stub de découpe sort du registre.
      const chText = (() => { const i = chapterFile(ab, nn); return i ? readText(i.path) : '' })()
      const shown = chapterTitleOf(title, chText)
      const horsRegle = estHorsRegle(ab, nn) || isFrontMatter(title)
      const narrative = horsRegle || teneurDe(ab) != null
      const c = classify(ab, nn, horsRegle, isPur, docs, catalogCh)
      // Un stub de découpe sort du registre — MAIS seulement s'il n'est cité par personne. Un stub
      // CITÉ par l'Atlas est une anomalie qui doit HURLER : ses réfs `ABBR NN l.X` pointent dans un
      // fichier sans une ligne de source (mesuré : `LDB 06` « Classes », 6 réfs, fichier vide). Le
      // taire serait remplacer un masquage par un autre.
      if (chText && markerSplitStub(chText)) {
        if (c.total === 0) { lines2.push(`| ${nn} | *(artefact OCR)* | ➖ | |`); continue }
        stubsCites.push(`- **${ab} ${nn}** (${info0(ab, nn)}) — stub de découpe SANS source, pourtant cité ${c.total} fois par l'Atlas (${c.owner} ×${c.ownerN}) : ces réfs pointent dans le vide.`)
      }
      if (c.mark !== '✅' && c.mark !== '📖' && narrative) {
        // Le MOTIF d'exclusion est de la donnée (`chapitres.json`) : il se LIT ici, à la ligne même
        // qu'il justifie — sans quoi le lecteur doit ouvrir le registre pour savoir POURQUOI. Vide
        // pour un hors-règle déduit du front-matter : c'est le TITRE qui le dit.
        const motif = motifHorsRegle(ab, nn)
        lines2.push(`| ${nn} | ${shown} | ➖ hors-règle |${motif ? ` ${motif} ` : ' '}|`)
        // #604 : ZÉRO masquage — le chapitre reste hors du dénominateur chapitre (contrat inchangé), mais
        // ses sections ne disparaissent plus de la ventilation section-granulaire (juste comptées, sans
        // le détail exhaustif — le point d'entrée « ➖ hors-règle » de la ligne ci-dessus reste la preuve).
        const info = chapterFile(ab, nn)
        if (info) {
          const text = readText(info.path)
          const sections = sectionsOf(text, niveauDeSectionDe(ab))
          gSecHorsRegle += sections.filter((s) => !s.isIntro && !s.enfoui).length
        }
        continue
      }
      if (c.mark === '✅') bOk++; else if (c.mark === '📖') bCat++; else if (c.mark === '🟡') bMid++; else bHole++
      gIgnoredFolios += c.ignoredFolios
      const detail = c.total ? `${c.total} (${c.owner} ×${c.ownerN})` : (c.owner ? `catalogue (${c.owner})` : '')
      lines2.push(`| ${nn} | ${shown} | ${c.mark} | ${detail} |`)
      const enfouiRows = c.enfoui.map((s) => `  - 🔻 enfoui l.${s.lo}-${s.hi - 1} « ${s.title.replace(/\s*•\s*/g, ' ').trim()} » — titre orné rétrogradé par l'extraction, ${s.refs} réf`)
      const holeRows = c.holes.map((s) => `  - ${HOLE_MARK[s.hole]} l.${s.lo}-${s.hi - 1} « ${s.title} » — ${HOLE_LABEL[s.hole]}, 0 réf`)
      // Ordre de branchement EXHAUSTIF (miroir de `classifyHole`) : un chapitre `✅`/`📖` peut
      // rester hors-règle/front-matter par ailleurs (ex. `AA 02 INTRODUCTION`, `EDOC 13`, `MDG 03`) — sa
      // section 0-réf classe alors 'hors-regle', JAMAIS absorbée dans le compte `gSecHolesRegle` (défaut
      // mesuré par le juge adversarial : 41 sections `undefined` dans coverage.md + `gSecHolesRegle` gonflé
      // de +18 %). `else` final = 'trou' STRICT, plus un fourre-tout.
      for (const s of c.holes) {
        if (s.hole === 'catalogue') gSecCatalogue++
        else if (s.hole === 'hors-regle') gSecHorsRegle++
        else if (s.hole === 'scenario') gSecHolesScenario++
        else gSecHolesRegle++
      }
      if (c.enfoui.length || c.holes.length) {
        gSecEnfoui += c.enfoui.length
        detailBlocks.push(`- **${ab} ${nn}** (${title}) :`, ...enfouiRows, ...holeRows)
      }
    }
    gOk += bOk; gCat += bCat; gMid += bMid; gHole += bHole
    const g = groupe(ab); g.ok += bOk; g.cat += bCat; g.mid += bMid; g.hole += bHole
    perBook.push(`${ab} ✅${bOk}·📖${bCat}·🟡${bMid}·⬜${bHole}`)
    out.push(`## ${ab} — ✅ ${bOk} · 📖 ${bCat} · 🟡 ${bMid} · ⬜ ${bHole}`, '', ...lines2, '')
    if (detailBlocks.length) {
      const label = `**Sections trouées/cataloguées/enfouies** (niveau de heading ${niveauDeSectionDe(ab) === 2 ? 'H2' : `H${niveauDeSectionDe(ab)} adaptatif`}) :`
      out.push(label, '', ...detailBlocks, '')
    }
  }

  if (stubsCites.length) {
    out.push('## ⚠ Stubs de découpe CITÉS par l’Atlas', '',
      '> Le fichier-chapitre ne contient que la note de page partagée : il ne porte AUCUNE ligne de',
      '> source. Les réfs ci-dessous sont donc mortes par construction — à ré-ancrer sur le chapitre',
      '> voisin qui porte réellement le texte.', '',
      ...stubsCites, '')
  }
  const denom = gOk + gCat + gMid + gHole
  const gSecHoles = gSecHolesScenario + gSecHolesRegle
  // Ventilation « Hn pour A/B/C » DÉRIVÉE du registre (#604) : un livre qui déclare son niveau de
  // section s'y voit sans second geste — une liste recopiée à la main serait une garde de synchronisation.
  const parNiveau = new Map()
  for (const [ab] of BOOKS) {
    const n = niveauDeSectionDe(ab)
    if (!parNiveau.has(n)) parNiveau.set(n, [])
    parNiveau.get(n).push(ab)
  }
  const niveauxTxt = [...parNiveau.entries()].sort((a, b) => a[0] - b[0]).map(([n, abs]) => `H${n} pour ${abs.join('/')}`).join(', ')
  // Une ligne par GROUPE rencontré, chacune avec SES comptes et SON dénominateur : deux corps de
  // règles ne s'additionnent pas, et un supplément ne se range sous aucun d'eux (la compatibilité
  // par supplément n'est pas modélisée). Les cœurs d'abord, les livres sans cœur déclaré ensuite.
  // Les DEUX populations de la ventilation section-granulaire, DÉRIVÉES du registre dans son ordre :
  // les campagnes PURES (teneur `scenario`, dont une section vide est du bruit) d'un côté, TOUT le
  // reste de l'autre (livres de règles et compagnons mixtes, où elle peut cacher une règle).
  const siglesOu = (garde) => BOOKS.filter(([ab]) => garde(ab)).map(([ab]) => ab).join('/')
  const campagnesPures = siglesOu(estCampagnePure)
  const resteDesLivres = siglesOu((ab) => !estCampagnePure(ab))
  const lignesGroupe = [...parGroupe]
    .sort((a, b) => (a[0] === null) - (b[0] === null) || parUnitesDeCode(String(a[0]), String(b[0])))
    .map(([cle, g]) => `- **${cle ? `Cœur ${cle}` : 'Livres sans cœur déclaré'}** : ✅ ${g.ok} traités par une fiche · 📖 ${g.cat} transcrits par un catalogue seul (jamais traités) · 🟡 ${g.mid} effleurés · ⬜ ${g.hole} trous, sur ${g.ok + g.cat + g.mid + g.hole} chapitres-règles (hors artefacts OCR).`)
  const summaryLine = ['**Couverture (profondeur), par groupe de livres** :', '', ...lignesGroupe, '', `Section-granulaire (niveau de heading ADAPTATIF par livre — ${niveauxTxt}, #604), ventilation DÉRIVÉE (jamais un compte recopié) sur ${gSecCatalogue + gSecHorsRegle + gSecHoles} section(s) non couvertes par une fiche : **${gSecCatalogue} transcrite(s) en catalogue** (recopiées, pas traitées) · **${gSecHorsRegle} hors-règle** (chapitre explicitement exclu) · **${gSecHolesScenario} bruit de scénario** (livres de teneur \`scenario\` ${campagnesPures} : prose de campagne, aucune règle) · **${gSecHolesRegle} candidat(s) trou de règle** (reste : ${resteDesLivres} — livres de règles et compagnons mixtes, où une section vide peut cacher une vraie règle non couverte) — et ${gSecEnfoui} titre(s) de chapitre enfoui(s) détecté(s) (titre orné rétrogradé par l'extraction). Ce chiffre reste un PLANCHER : les sections couvertes par une fiche (✅ au niveau section) ne sont pas dénombrées ici (volume, cf. #604 DoD « la sortie ne liste pas l'exhaustif »). Réfs folio (\`ABBR NN p.X\`, #606) : ${gIgnoredFolios} ignorée(s) proprement (ancre absente/ambiguë/hors-chapitre). Par livre : ${perBook.join(' · ')}.`].join('\n')
  const summaryIdx = out.indexOf(SUMMARY_PLACEHOLDER)
  out[summaryIdx] = summaryLine
  ecrireDoc(join(rawDir, 'coverage.md'), out.join('\n'))
  console.log(`coverage profondeur : ✅ ${gOk} · 📖 ${gCat} · 🟡 ${gMid} · ⬜ ${gHole} (sur ${denom} chapitres) · sections non-fiche : catalogue ${gSecCatalogue} · hors-règle ${gSecHorsRegle} · scénario ${gSecHolesScenario} · règle ${gSecHolesRegle} · 🔻enfoui ${gSecEnfoui} · folios ignorés ${gIgnoredFolios}`)
  console.log('par livre : ' + perBook.join(' · '))
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
