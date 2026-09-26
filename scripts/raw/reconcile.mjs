// Réconciliation déterministe CODE ↔ ATLAS RAW.
// Sens A (code → Atlas) : toute réf de règle citée dans src/ (`<ABRÉV> NN l.X`) dont le chapitre
//   n'est PAS couvert par l'Atlas (trou dur), ou dont la ligne n'est pinée par aucune citation
//   Atlas du même chapitre à ±TOL (trou fin) → l'app applique une règle absente de l'Atlas. UNE
//   table keyée (livre, chapitre) pour TOUS les livres du registre : la graphie d'une réf est UNE
//   (`refRe`, _lib.mjs), la mention LÂCHE aussi (`<ABRÉV> [ch.]NN`), l'indexation aussi.
// Sens B (Atlas → code) : B1 = lignes de l'Atlas marquées `(non implémenté)`, tous docs confondus
//   (aucune dimension de livre), ventilées par ÉTAT DE DETTE ; B2 = chapitres cités par l'Atlas jamais
//   référencés par le code, calculé par livre de CŒUR, après deux crédits : le FOLIO d'une donnée de
//   `src/data`, et la DETTE DE FICHE déclarée au manifest (#1825 — une dette se déclare UNE fois, à la
//   granularité de son ticket : un chapitre déjà sous dette de fiche ne se stocke pas une 2e fois).
// RÉGIME de CŒUR — le prédicat `coeurDe(abbr)` (champ `coeur` de `books.json`) décide du RÉGIME en
//   deux endroits, et nulle part ailleurs :
//   R1 un trou dur de Sens A d'un livre de cœur ne se STOCKE pas — il se CORRIGE à l'Atlas
//      (CLAUDE.md règle 1 : « devoir rouvrir `Source/` est un DÉFAUT DE L'ATLAS à corriger ») ;
//   R2 le Sens B2 et son crédit par folio se calculent par livre de cœur (`livresDeCoeur`) — un
//      supplément n'étant pas couvert fiche à fiche, son « Atlas hors-code » ne dirait rien.
//   Le même prédicat est relu en LIBELLÉ par `renderReport` (colonne « Cœur », marque « se corrige,
//   ne se stocke pas », titres B2) et par le groupement de `coverage.mjs` : dire ce qu'un livre EST
//   n'est pas lui appliquer un régime, et un libellé ne décide de rien.
//   Un cœur de plus est UNE clé `coeur` de `books.json`, zéro ligne ici.
// CLIQUET (#1709 lot D2, #925) : les TROUS DURS des deux sens — chapitre-livre cité par le code et
//   absent de l'Atlas (`hardA`), chapitre d'un livre de cœur décrit par l'Atlas jamais atteint par
//   le code après crédit folio (`b2[].horsCode`) — sont confrontés au STOCK NOMINATIF
//   `reconciliation-stock.json` : une entrée neuve OU une entrée du stock devenue caduque pose
//   `process.exitCode = 1` (double sens).
//   Les mesures fines (trous de ligne, `(non implémenté)`, folios ignorés, réfs sans chapitre) restent
//   IMPRIMÉES et jamais assertées. Lecteur = `lireStockJson` (check-code-refs.mjs), écart = `ecartsDeStock`
//   (guards/lib/stock.mjs) — jamais un troisième.
// Sortie : docs/raw/reconciliation.md  ·  Re-run : node scripts/raw/reconcile.mjs
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parUnitesDeCode } from '../guards/lib/lister.mjs'
import { ecartsDeStock } from '../guards/lib/stock.mjs'
import {
  refReDe, refFolioReDe, alternationDe, bookOfDe, booksDe, coeursDe, coeurDe, livresDeCoeur, looseReDe,
  REGISTRE_LIVRES, folioSpan, span, pagesDeLAtlas, readText,
} from './_lib.mjs'
import { lireStockJson } from './stockNominatif.mjs'
import { fichiersCitants } from './lib/fichiersCitants.mjs'
import {
  loadAbbrMap, folioCitationsFromJson, chargerDette, registresDeFiches, parseFiche,
  stemDeFiche, couvertureDe, stemDe, MANIFEST_PATH,
} from './build-implemente.mjs'
import { ecrireDoc } from '../docs/lib/empreinte-sources.mjs'

export const TOL = 20 // tolérance en lignes : la synthèse Atlas pine un ancrage proche, pas la ligne exacte
export const RAWDIR = 'docs/raw'
// Acceptation DÉCLARÉE à la couture : tout sauf les rapports générés (réfs illustratives de
// diagnostic). Un catalogue, une page d'auteur, une épreuve datée CITENT des chapitres de l'Atlas.
export const CLASSES = ['fiche', 'catalogue', 'auteur', 'epreuve']
export const STOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'reconciliation-stock.json')
/** Préfixe des clés de trou dur du Sens B2 — SOURCE UNIQUE : la clé s'écrit et se relit ici.
 *  Exporté pour que les bancs lisent le préfixe au lieu de le recopier. */
export const PREFIXE_B2 = 'B2 '

/** Décode une clé de trou dur — `<ABRÉV> <ch>` (Sens A) ou `B2 <ABRÉV> <ch>` (Sens B2) — en
 *  `{ sens, book, ch }`, ou `null` si la clé est hors grammaire (sigle absent du registre, chapitre
 *  non numérique). Le PRÉFIXE ne tranche pas à lui seul : un livre dont le sigle est `B2` produirait
 *  la clé de Sens A `B2 7`, qu'un `startsWith` avalerait comme du Sens B2 — elle échapperait à R1.
 *  Chaque lecture n'est retenue que si elle se PARSE : son sigle est au registre, son chapitre est
 *  un nombre. Les DEUX lectures valides à la fois (il faudrait au registre un livre `B2 <X>` ET un
 *  livre `<X>`) = clé AMBIGUË : le décodeur LÈVE en nommant les deux lectures. Une chaîne ne peut
 *  pas les départager, et deviner un régime silencieusement coûterait un refus R1 manquant. */
export function decodeCle(cle, abbrs) {
  const lire = (s) => {
    const i = s.lastIndexOf(' ')
    if (i <= 0) return null
    const book = s.slice(0, i)
    const ch = s.slice(i + 1)
    return abbrs.has(book) && /^\d+$/.test(ch) ? { book, ch } : null
  }
  const sensA = lire(cle)
  const sensB2 = cle.startsWith(PREFIXE_B2) ? lire(cle.slice(PREFIXE_B2.length)) : null
  if (sensA && sensB2) {
    throw new Error(
      `reconcile: clé de trou dur AMBIGUË « ${cle} » — lisible en Sens A (${sensA.book} ch.${sensA.ch}) `
      + `comme en Sens B2 (${sensB2.book} ch.${sensB2.ch}). Deux sigles du registre « ${sensA.book} » et `
      + `« ${sensB2.book} » se chevauchent sur le préfixe « ${PREFIXE_B2.trim()} » : renommer l'un des deux `
      + "`abbr` dans `src/data/books.json`, une clé en chaîne ne peut pas les départager.",
    )
  }
  return sensB2 ? { sens: 'B2', ...sensB2 } : sensA ? { sens: 'A', ...sensA } : null
}

// Clé de chapitre canonique du Sens A (#434 défaut 9 suite, #1156) : le code écrit le numéro
// zéro-préfixé (`AA 02`, `ADE II ch.03`, `LDB 08`), l'Atlas écrit les titres sans préfixe
// (`## [AA 2]`, `## [LDB 8]`) — comparaison textuelle brute = faux trou, et exemption catalogue
// morte pour toute réf zéro-préfixée. Normalise aux DEUX collectes (code ET Atlas) et pour TOUS
// les livres, miroir de `String(Number(nn))` déjà appliqué par `chapterFile` (_lib.mjs).
const chKey = (n) => String(Number(n))

const enChapitre = (table, book, ch, valeur) => {
  if (!table.has(book)) table.set(book, new Map())
  const chMap = table.get(book)
  if (!chMap.has(ch)) chMap.set(ch, [])
  chMap.get(ch).push(valeur)
}
const enSet = (table, book, ch) => {
  if (!table.has(book)) table.set(book, new Set())
  table.get(book).add(ch)
}
const setDe = (table, book) => table.get(book) || new Set()

/** Calcule la réconciliation CODE↔ATLAS. Pur vis-à-vis de l'écriture de fichier (aucun writeFileSync ici).
 *  `registre` = le registre des livres (`books.json` par défaut), `manifestPath` = la dette éditoriale :
 *  les tests en injectent des fixtures. */
export function computeReconciliation({ srcDir = 'src', rawDir = RAWDIR, registre = REGISTRE_LIVRES, manifestPath = MANIFEST_PATH } = {}) {
  const books = booksDe(registre)
  const coeurs = coeursDe(registre)
  const ALT = alternationDe(books)
  const bookOf = bookOfDe(books)
  const SRC = fichiersCitants(srcDir)
  const DOCS = pagesDeLAtlas(rawDir, { classes: CLASSES, registre })

  // --- regex de réfs (source unique : _lib.mjs ; instances stateful /g locales) ---
  const REF_RE = refReDe(ALT)
  // Miroir FOLIO (#606) : la graphie folio des fiches de l'Atlas (`ABBR NN p.folio`) est aussi une
  // citation de chapitre valide côté ATLAS (jamais côté CODE — le code cite des lignes, la donnée
  // cite déjà son folio via `source:{book,page}`, traité par le crédit `codeFolioCh` plus bas) ; convertie en
  // plage de LIGNES via `folioSpan`, fusionnée aux spans d'`atlas` — la couverture ne doit voir
  // qu'UNE mesure, jamais un chemin parallèle qui recompte différemment.
  const REF_FOLIO_RE = refFolioReDe(ALT)
  let folioIgnored = 0 // folios cités en Atlas sans ancre `data-folio` résoluble dans le bon chapitre

  // === collecte CODE ===
  const code = new Map()      // book -> ch -> [{line, file, row, text}]  (réfs ligne strictes)
  const codeNoCh = new Map()  // book -> [{line, file, row, text}]  (réfs SANS chapitre : `AA l.4395`)
  const codeLoose = new Map() // book -> Set(ch)  — tout chapitre mentionné (lâche)
  for (const f of SRC) {
    const text = readFileSync(f, 'utf8')
    for (const mm of text.matchAll(looseReDe(ALT))) enSet(codeLoose, mm[1], chKey(mm[2]))
    const lines = text.split('\n')
    lines.forEach((ln, i) => {
      let m
      REF_RE.lastIndex = 0
      while ((m = REF_RE.exec(ln))) {
        const book = bookOf(m[1].replace(/\s+/g, ' ').trim())
        if (!book) continue
        const rec = { line: Number(m[3]), file: f.replace(/\\/g, '/'), row: i + 1, text: ln.trim().slice(0, 160) }
        if (m[2] == null) {
          if (!codeNoCh.has(book)) codeNoCh.set(book, [])
          codeNoCh.get(book).push(rec)
        } else {
          enChapitre(code, book, chKey(m[2]), rec)
        }
      }
    })
  }

  // === crédit FOLIO (#434) : chapitres atteints par une source `{book,page}` d'un src/data/*.json ===
  // Réutilise l'extraction canonique (`folioCitationsFromJson` → `folioIndexOf`/`folioRange`, mapping
  // slug→abbr de books.json) — jamais une 2e implémentation. Un chapitre-données (carrières LDB 26-35,
  // possessions 66-70…) est « référencé dans le code » via le folio même sans réf de LIGNE.
  const codeFolioCh = new Map() // book -> Set(ch)
  let abbrMap
  try { abbrMap = loadAbbrMap() } catch { abbrMap = null }
  if (abbrMap) {
    const folioStats = { byBook: new Map(), noAtlas: 0, noPage: 0 }
    for (const f of SRC) {
      const rel = f.replace(/\\/g, '/')
      if (!rel.endsWith('.json') || /\.(test|spec)\./.test(rel)) continue
      for (const c of folioCitationsFromJson(rel, readFileSync(f, 'utf8'), { ...abbrMap, stats: folioStats })) {
        if (bookOf(c.book)) enSet(codeFolioCh, c.book, chKey(c.ch))
      }
    }
  }

  // === collecte ATLAS ===
  const atlas = new Map()      // book -> ch -> [[lo,hi], …]
  const atlasLoose = new Map() // book -> Set(ch)  — mention lâche
  const catalog = new Map()    // book -> Set(ch)  — chapitres couverts par un catalogue (verbatim)
  const docOwner = new Map()   // `book|ch` -> doc (le + de réfs) — le PROPRIÉTAIRE du chapitre
  const ownerCount = new Map() // `book|ch|doc` -> n
  // Les FICHES qui décrivent un chapitre (`book|ch` -> Set de stems) : `atlasLoose` est contribué par
  // TOUS les docs — catalogues, index, épreuves compris, dont beaucoup de chapitres qu'aucune fiche
  // ne décrit — or une dette se déclare au niveau d'une FICHE. Seules elles sont comptées ici.
  const fichesDuChapitre = new Map()
  // CŒUR ÉTRANGER — une FICHE de l'Atlas synthétise le corps de règles de SON cœur, celui que son
  // CHEMIN déclare : une fiche qui cite le livre de cœur d'un AUTRE cœur présente comme UNE règle ce
  // que deux systèmes disent différemment, et le lecteur (agent ou joueur) n'a aucun moyen de savoir
  // lequel s'applique. Un SUPPLÉMENT (`coeur` absent) ne compte pas : il ne porte pas de corps de
  // règles propre.  relatif de fiche -> cœur étranger -> sigles cités
  const etrangersParFiche = new Map()
  const fiches = []            // { doc, content, parsed } — le parse des fiches, source des registres d'`id`
  for (const { relatif: nom, chemin: d, classe, coeur: coeurDeLaFiche } of DOCS) {
    const text = readText(d)
    const estFiche = classe === 'fiche'
    if (estFiche) fiches.push({ doc: nom, content: text, parsed: parseFiche(nom, text) })
    for (const mm of text.matchAll(looseReDe(ALT))) {
      enSet(atlasLoose, mm[1], chKey(mm[2]))
      if (classe === 'catalogue') enSet(catalog, mm[1], chKey(mm[2]))
      if (estFiche) {
        enSet(fichesDuChapitre, `${mm[1]}|${chKey(mm[2])}`, stemDeFiche(nom))
        const coeurCite = coeurDe(mm[1], coeurs)
        if (coeurCite && coeurCite !== coeurDeLaFiche) {
          if (!etrangersParFiche.has(nom)) etrangersParFiche.set(nom, new Map())
          const parCoeur = etrangersParFiche.get(nom)
          if (!parCoeur.has(coeurCite)) parCoeur.set(coeurCite, new Set())
          parCoeur.get(coeurCite).add(mm[1])
        }
      }
    }
    // Pine le span et désigne le doc PROPRIÉTAIRE du chapitre — pour TOUT livre.
    const piner = (book, ch, sp) => {
      enChapitre(atlas, book, ch, sp)
      const cle = `${book}|${ch}`
      const key = `${cle}|${nom}`
      ownerCount.set(key, (ownerCount.get(key) || 0) + 1)
      if (!docOwner.has(cle) || ownerCount.get(key) > ownerCount.get(`${cle}|${docOwner.get(cle)}`))
        docOwner.set(cle, nom)
    }
    let m
    REF_RE.lastIndex = 0
    while ((m = REF_RE.exec(text))) {
      if (m[2] == null) continue // réf Atlas sans chapitre : pas d'unité chapitre à indexer
      const book = bookOf(m[1].replace(/\s+/g, ' ').trim())
      if (!book) continue
      piner(book, chKey(m[2]), span(m[3], m[4]))
    }
    REF_FOLIO_RE.lastIndex = 0
    while ((m = REF_FOLIO_RE.exec(text))) {
      if (m[2] == null) continue
      const book = bookOf(m[1].replace(/\s+/g, ' ').trim())
      if (!book) continue
      const ch = chKey(m[2])
      const resolved = folioSpan(book, ch, m[3], m[4])
      if (!resolved) { folioIgnored++; continue }
      piner(book, ch, resolved)
    }
  }

  const covered = (book, ch, line) =>
    ((atlas.get(book) || new Map()).get(ch) || []).some(([lo, hi]) => line >= lo - TOL && line <= hi + TOL)

  // === SENS A : code → Atlas, UNE table (livre, chapitre) ===
  const hardA = [] // chapitres-livre dans le code, absents de l'Atlas
  const softA = [] // chapitres-livre couverts, lignes non pinées
  for (const [book, chMap] of [...code].sort((a, b) => parUnitesDeCode(a[0], b[0]))) {
    const looseCh = setDe(atlasLoose, book)
    const catalogChSet = setDe(catalog, book)
    for (const [ch, refs] of [...chMap].sort((a, b) => Number(a[0]) - Number(b[0]) || parUnitesDeCode(a[0], b[0]))) {
      const uniqLines = [...new Set(refs.map((r) => r.line))].sort((a, b) => a - b)
      if (!looseCh.has(ch)) {
        hardA.push({ book, ch, count: refs.length, lines: uniqLines, sample: refs.slice(0, 4) })
      } else if (catalogChSet.has(ch)) {
        // chapitre couvert par un catalogue (données verbatim au niveau chapitre) — pas un trou de ligne
      } else {
        const miss = uniqLines.filter((l) => !covered(book, ch, l))
        if (miss.length) {
          const ex = miss.map((l) => refs.find((r) => r.line === l)).filter(Boolean)
          // Chapitre couvert par la seule mention LÂCHE (aucun span pinné) : personne ne le possède.
          const proprietaire = docOwner.get(`${book}|${ch}`) || '—'
          softA.push({ book, ch, missCount: miss.length, totalLines: uniqLines.length, ex, proprietaire })
        }
      }
    }
  }

  // Résumé par livre (le compte central du #434 défaut 9)
  const bookStats = new Map()
  const stat = (book) => {
    if (!bookStats.has(book)) bookStats.set(book, { hard: 0, soft: 0, noCh: 0 })
    return bookStats.get(book)
  }
  for (const h of hardA) stat(h.book).hard++
  for (const s of softA) stat(s.book).soft++
  for (const [book, refs] of codeNoCh) stat(book).noCh = refs.length

  // Dette éditoriale — UNE lecture, la couture de `build-implemente.mjs` (jamais un 2e lecteur du
  // manifest) : ses `id` se résolvent contre les registres tirés du parse des fiches ci-dessus.
  const dette = chargerDette(registresDeFiches(fiches), manifestPath)
  // Ligne du champ `**Implémente :**` → son topic, pour rattacher un marqueur B1 à sa dette.
  const topicParLigne = new Map() // doc -> Map(row -> topic)
  for (const fi of fiches) {
    const rows = new Map()
    for (const f of fi.parsed.fields) rows.set(f.headerIdx + 1, f.topic)
    topicParLigne.set(fi.doc, rows)
  }

  // === SENS B1 : lignes marquées « (non implémenté) » — GLOBAL, aucune dimension de livre.
  // Chaque marqueur dit s'il est COUVERT par une dette déclarée (entrée de topic ou de fiche) ou SANS
  // entrée : sans cette ventilation, un chiffre de tête qui grossit ne distingue plus l'instruit du reste.
  const nonImpl = []
  for (const { relatif: nom, chemin } of DOCS) {
    const rows = topicParLigne.get(nom)
    readText(chemin).split('\n').forEach((ln, i) => {
      if (!/non impl[ée]ment[ée]/i.test(ln)) return
      const topic = rows?.get(i + 1)
      const entree = topic ? dette.detteDe(topic) : undefined
      nonImpl.push({ doc: nom, row: i + 1, text: ln.trim().slice(0, 200), topic, dette: entree })
    })
  }

  // DÉCROISSANCE de chaque entrée de FICHE : combien de ses topics elle couvre ENCORE, sur combien.
  // L'état est lu au marqueur de l'Atlas COMMITTÉ (`(non implémenté)`), la vérité que `raw:implemente`
  // vient d'y écrire — aucun second index du code ici. Imprimé, jamais asserté : la garde qui REFUSE
  // une entrée sans objet vit dans `raw:implemente` (`dettesDeFicheSansObjet`).
  const marqueurs = new Set(nonImpl.filter((n) => n.topic).map((n) => n.topic))
  const topicsParFiche = new Map()
  for (const fi of fiches) {
    for (const f of fi.parsed.fields) {
      const stem = stemDe(f.topic)
      if (!topicsParFiche.has(stem)) topicsParFiche.set(stem, [])
      topicsParFiche.get(stem).push({ topic: f.topic, implemente: !marqueurs.has(f.topic) })
    }
  }
  const dettesDeFiche = dette.entreesDeFiche().map((entree) => ({
    fiche: entree.id,
    ticket: entree.ticket,
    couverts: couvertureDe(entree, topicsParFiche.get(entree.id) ?? [], dette).length,
    total: (topicsParFiche.get(entree.id) ?? []).length,
  }))
  // === SENS B2 (R2, régime de CŒUR) : chapitres cités par l'Atlas jamais référencés dans le code
  // (`atlasLoose`/`codeLoose` portent déjà la clé canonique `chKey`, #434 défaut 11 — `LDB 06` et
  // `LDB 6` sont une seule entrée). Crédite le FOLIO : un chapitre atteint par une source
  // `{book,page}` de src/data est référencé (donnée), pas hors-code.
  // Second crédit, la DETTE DE FICHE (#1825) : un chapitre que le code n'atteint pas, mais dont
  // TOUTES les fiches qui le décrivent sont sous dette de fiche déclarée, est déjà déclaré — à sa
  // granularité, celle du ticket. Le déclarer une seconde fois au stock nominatif serait la même
  // dette écrite deux fois. Un chapitre qu'aucune fiche ne décrit ne peut pas être crédité ainsi.
  const b2 = []
  for (const [book] of livresDeCoeur(books, coeurs)) {
    const coeur = coeurDe(book, coeurs)
    const cite = setDe(codeLoose, book)
    const folio = setDe(codeFolioCh, book)
    const avant = [...setDe(atlasLoose, book)].filter((ch) => !cite.has(ch)).sort((a, b) => Number(a) - Number(b))
    const sousDette = []
    const horsCode = []
    for (const ch of avant.filter((c) => !folio.has(c))) {
      const stems = [...(fichesDuChapitre.get(`${book}|${ch}`) ?? [])].sort()
      const entrees = stems.map((s) => dette.detteDeFiche(s))
      if (stems.length && entrees.every(Boolean)) sousDette.push({ ch, fiches: stems, tickets: [...new Set(entrees.map((e) => e.ticket))] })
      else horsCode.push(ch)
    }
    b2.push({ book, coeur, avant, credites: avant.filter((ch) => folio.has(ch)), sousDette, horsCode })
  }

  const codeBooks = new Set([...code.keys(), ...codeNoCh.keys()])
  const atlasBooks = new Set([...atlas.keys(), ...atlasLoose.keys()])

  return {
    hardA, softA, nonImpl, dettesDeFiche, b2, codeNoCh, bookStats, codeBooks, atlasBooks, folioIgnored, coeurs,
    etrangers: coeursEtrangers(etrangersParFiche), fichesJugees: DOCS.filter((p) => p.classe === 'fiche').length,
  }
}

/** Les fiches qui citent le livre de cœur d'un AUTRE cœur que celui de leur CHEMIN, triées — PUR
 *  (aucun accès fichier). L'entrée est la table bâtie au balayage : relatif -> cœur étranger -> sigles. */
export function coeursEtrangers(etrangersParFiche) {
  const etrangers = []
  for (const [fiche, parCoeur] of [...etrangersParFiche].sort((a, b) => parUnitesDeCode(a[0], b[0]))) {
    etrangers.push({
      fiche,
      coeurs: [...parCoeur]
        .sort((a, b) => parUnitesDeCode(a[0], b[0]))
        .map(([coeur, livres]) => ({ coeur, livres: [...livres].sort(parUnitesDeCode) })),
    })
  }
  return etrangers
}

/** État d'un marqueur B1 : hors d'un champ `**Implémente :**` c'est de la PROSE (aucune dette à
 *  attendre) ; sur un topic, le ticket ou le blocage qui le couvre, sinon rien de déclaré. */
const etatDeDette = (n) =>
  !n.topic ? 'hors champ Implémente (prose)'
    : n.dette?.ticket ? `dette ${n.dette.ticket}`
      : n.dette?.bloque ? 'bloqué'
        : 'SANS entrée de dette'

/** Rend le Markdown `docs/raw/reconciliation.md` — pur (aucun accès fichier). */
export function renderReport(data) {
  const { hardA, softA, nonImpl, dettesDeFiche = [], b2, codeNoCh, bookStats, codeBooks, atlasBooks, folioIgnored, coeurs = new Map() } = data
  const coeur = (book) => coeurDe(book, coeurs)
  const noChapterCount = [...codeNoCh.values()].reduce((n, a) => n + a.length, 0)
  const sousDetteDe = (e) => e.sousDette ?? []
  const surTopic = nonImpl.filter((n) => n.topic)
  const couverts = surTopic.filter((n) => n.dette)
  const sansEntree = surTopic.filter((n) => !n.dette)
  const prose = nonImpl.filter((n) => !n.topic)

  const L = []
  L.push('# Atlas RAW — Réconciliation CODE ↔ ATLAS', '')
  L.push(
    '> Déterministe (`node scripts/raw/reconcile.mjs`). **Sens A** = règles que l\'app applique',
    '> (réfs `<ABRÉV> NN l.X` dans `src/`, tous livres) absentes de l\'Atlas. **Sens B1** = lignes de',
    '> l\'Atlas marquées « (non implémenté) », tous docs, ventilées par état de dette. **Sens B2** =',
    '> chapitres que l\'Atlas décrit hors du code, par livre de CŒUR (champ `coeur` de `books.json`),',
    '> après crédit du folio d\'une donnée et de la dette de fiche déclarée au manifest.',
    `> Tolérance ligne = ±${TOL}.`,
    '',
  )
  L.push(`**Sens A — code → Atlas (tous livres)** : ${hardA.length} chapitre(s)-livre cités par le code & absents de l'Atlas · ${softA.length} chapitre(s)-livre couverts avec des lignes non pinées · ${noChapterCount} réf(s) sans chapitre (non réconciliables par cette mesure). Réfs folio (\`ABBR NN p.X\`, #606) côté Atlas : ${folioIgnored} ignorée(s) proprement (ancre absente/ambiguë/hors-chapitre).`)
  // Le résumé de TÊTE porte les NOMBRES, jamais un compte de livres : par livre de cœur, ses trois
  // mesures de Sens B2 — dérivées de `b2`, donc un cœur de plus s'y lit sans une ligne ici.
  const b2Tete = b2
    .map((e) => `${e.book} (cœur ${e.coeur}) : ${e.horsCode.length} chapitre(s) cité(s) par l'Atlas jamais référencé(s) dans le code (avant crédits : ${e.avant.length} · ${e.credites.length} crédité(s) par une source folio de \`src/data\` · ${sousDetteDe(e).length} sous dette de fiche déclarée)`)
    .join(' · ')
  L.push(`**Sens B — Atlas → code** : ${nonImpl.length} marqueur(s) « (non implémenté) » (tous docs), dont ${couverts.length} sous dette déclarée, ${sansEntree.length} sans entrée et ${prose.length} hors champ Implémente${b2Tete ? ` · ${b2Tete}` : ' · aucun livre de cœur au registre'}.`, '')

  L.push('## A0 — Résumé Sens A par livre', '')
  if (!bookStats.size) L.push('_Aucune réf de code vers un livre du registre._', '')
  else {
    L.push('| Livre | Cœur | Trous durs (chapitres) | Chapitres à lignes non pinées | Réfs sans chapitre |', '|---|---|---|---|---|')
    for (const [book, st] of [...bookStats].sort((a, b) => parUnitesDeCode(a[0], b[0])))
      L.push(`| ${book} | ${coeur(book) ?? '—'} | ${st.hard} | ${st.soft} | ${st.noCh} |`)
    L.push('')
  }

  L.push('## A1 — Chapitres appelés par le CODE, ABSENTS de l\'Atlas (trous durs)', '')
  if (!hardA.length) L.push('_Aucun. Tout chapitre référencé dans le code est cité par au moins une fiche._', '')
  else for (const h of hardA) {
    const regime = coeur(h.book) ? ` — livre de cœur (${coeur(h.book)}) : se corrige, ne se stocke pas` : ''
    L.push(`### ${h.book} ${h.ch} — ${h.count} réf(s) code, 0 dans l'Atlas${regime}`)
    for (const s of h.sample) L.push(`- \`${s.file}:${s.row}\` (l.${s.line}) — ${s.text}`)
    L.push('')
  }

  L.push('## A2 — Lignes appelées par le CODE non pinées par l\'Atlas (chapitre couvert, règle peut-être survolée)', '')
  if (!softA.length) L.push('_Aucune._', '')
  else for (const s of [...softA].sort((a, b) => b.missCount - a.missCount)) {
    L.push(`### ${s.book} ${s.ch} — ${s.missCount}/${s.totalLines} ligne(s) code hors couverture (propriétaire : ${s.proprietaire})`)
    for (const r of s.ex.slice(0, 12)) L.push(`- l.${r.line} — \`${r.file}:${r.row}\` — ${r.text}`)
    if (s.ex.length > 12) L.push(`- … +${s.ex.length - 12} autres`)
    L.push('')
  }

  L.push('## A3 — Réfs de CODE sans chapitre (`<ABRÉV> l.X`, pas d\'unité chapitre à couvrir)', '')
  if (!codeNoCh.size) L.push('_Aucune._', '')
  else for (const [book, refs] of [...codeNoCh].sort((a, b) => parUnitesDeCode(a[0], b[0]))) {
    L.push(`### ${book} — ${refs.length} réf(s) sans chapitre`)
    for (const r of refs.slice(0, 4)) L.push(`- \`${r.file}:${r.row}\` (l.${r.line}) — ${r.text}`)
    if (refs.length > 4) L.push(`- … +${refs.length - 4} autres`)
    L.push('')
  }

  L.push('## B1 — Règles décrites par l\'Atlas marquées « (non implémenté) »', '')
  if (!nonImpl.length) L.push('_Aucun marqueur._', '')
  else {
    L.push(`${couverts.length} sous dette déclarée · ${sansEntree.length} sans entrée de \`src/data/raw.manifest.json\` · ${prose.length} hors champ \`**Implémente :**\`.`, '')
    for (const n of nonImpl) L.push(`- **${n.doc}** L${n.row} — ${etatDeDette(n)} — ${n.text}`)
  }
  L.push('')
  L.push('### Dettes de FICHE — ce qu\'elles couvrent ENCORE', '')
  if (!dettesDeFiche.length) L.push('_Aucune entrée de fiche au manifest._', '')
  else {
    for (const d of dettesDeFiche) L.push(`- **${d.fiche}.md** (${d.ticket}) — couvre ${d.couverts} topic(s) sur ${d.total}`)
    L.push('')
  }

  for (const e of b2) {
    L.push(`## B2 ${e.book} (cœur ${e.coeur}) — Chapitres cités par l'Atlas, jamais référencés dans le code`, '')
    L.push(`_Avant crédits (${e.avant.length})_ : ${e.avant.length ? e.avant.map((c) => `${e.book} ${c}`).join(' · ') : '—'}`, '')
    L.push(`_Crédités par une source folio de \`src/data/*.json\` (${e.credites.length}, donnée référencée sans réf de ligne)_ : ${e.credites.length ? e.credites.map((c) => `${e.book} ${c}`).join(' · ') : '—'}`, '')
    const sd = sousDetteDe(e)
    L.push(`_Sous dette de fiche déclarée (${sd.length}, toutes les fiches qui décrivent le chapitre sont ticketées)_ : ${sd.length ? sd.map((s) => `${e.book} ${s.ch} (${s.tickets.join(', ')} — ${s.fiches.join(', ')})`).join(' · ') : '—'}`, '')
    L.push('**VRAIS hors-code (après crédits) :**')
    if (!e.horsCode.length) L.push('_Aucun._', '')
    else L.push(e.horsCode.map((c) => `${e.book} ${c}`).join(' · '), '')
  }

  L.push('## Livres vus par la mesure', '')
  L.push(`Code : ${[...codeBooks].sort().join(', ') || '—'}`)
  L.push(`Atlas : ${[...atlasBooks].sort().join(', ') || '—'}`, '')

  return L.join('\n')
}

/** Entrées de TROU DUR d'une réconciliation, NOMMÉES (jamais un compte) — l'unité du cliquet.
 *  Clé : `<ABRÉV> <ch>` pour le sens A (code → Atlas), `B2 <ABRÉV> <ch>` pour le sens B2
 *  (Atlas → code, livres de cœur). `sites` = les `fichier:ligne` échantillonnés, pour le message nominatif. */
export function trousDurs({ hardA = [], b2 = [] }) {
  const site = (s) => `${s.file}:${s.row}`
  const entrees = []
  for (const h of hardA)
    entrees.push({ cle: `${h.book} ${h.ch}`, quoi: `${h.count} réf(s) de code, 0 dans l'Atlas`, sites: (h.sample ?? []).map(site) })
  for (const e of b2)
    for (const ch of e.horsCode ?? [])
      entrees.push({ cle: `${PREFIXE_B2}${e.book} ${ch}`, quoi: "chapitre décrit par l'Atlas, jamais référencé par le code (ni crédité par un folio de `src/data`)", sites: [] })
  return entrees
}

/** Stock committé des trous durs : `{ cle: { sites, lot, date, quoi } }` — chaque entrée nomme ses
 *  SITES (le cliquet de plage `stocksNominatifs.mjs` ne voit une entrée que si son sous-arbre nomme
 *  un fichier), son LOT et sa DATE. Fichier absent = `{}` (tolérance ZÉRO, `lireStockJson` de
 *  check-code-refs.mjs — même lecteur que les autres cliquets de `scripts/raw/`). */
export function lireStock(path = STOCK_PATH) {
  return lireStockJson(path).trous ?? {}
}

/** Écart NOMINATIF des trous durs mesurés à leur stock, dans les deux sens (`ecartsDeStock`), PLUS
 *  le refus des livres de CŒUR (R1) : une clé de Sens A `<ABRÉV> <ch>` d'un livre de cœur — trou
 *  observé OU entrée de stock — est refusée, un livre de cœur étant couvert fiche à fiche par
 *  l'Atlas et un chapitre manquant s'y CORRIGEANT (CLAUDE.md règle 1 : « devoir rouvrir `Source/`
 *  = un défaut de l'Atlas à corriger »). Le sens B2 n'est pas concerné : il dit l'Atlas hors-code,
 *  pas l'Atlas incomplet.
 *  Pur : aucun exit — l'appelant décide (frontière de `guards/lib/stock.mjs`). */
export function ecartsTrousDurs(entrees, stock, registre = REGISTRE_LIVRES) {
  const coeurs = coeursDe(registre)
  const abbrs = new Set(booksDe(registre).map(([a]) => a))
  // R1 ne vise que le Sens A : c'est le DÉCODEUR qui tranche le sens, jamais le préfixe seul.
  const estDeCoeur = (cle) => {
    const d = decodeCle(cle, abbrs)
    return d?.sens === 'A' && coeurDe(d.book, coeurs) != null
  }
  const coeur = [
    ...entrees.filter((e) => estDeCoeur(e.cle)).map((e) => `${e.cle} — ${e.quoi}${e.sites.length ? ` · ${e.sites.join(' , ')}` : ''}`),
    ...Object.keys(stock).filter(estDeCoeur).map((cle) => `${cle} — entrée de stock INADMISSIBLE (${stock[cle]?.quoi ?? stock[cle]})`),
  ]
  const { neuves, perimees } = ecartsDeStock({
    observe: entrees,
    stock: Object.keys(stock).map((cle) => ({ cle })),
    cle: (e) => e.cle,
    remede: {
      neuve: (cle, e) => `${cle} — ${e.quoi}${e.sites.length ? ` · ${e.sites.join(' , ')}` : ''}`,
      perimee: (cle) => `${cle} — ${stock[cle]?.quoi ?? stock[cle]} (${stock[cle]?.lot ?? 'lot non dit'})`,
    },
  })
  return { neuves, perimees, coeur }
}

function main() {
  const data = computeReconciliation()
  ecrireDoc(join(RAWDIR, 'reconciliation.md'), renderReport(data))
  const noChapterCount = [...data.codeNoCh.values()].reduce((n, a) => n + a.length, 0)
  console.log(`Sens A : ${data.hardA.length} trou(s) dur(s) chapitre-livre · ${data.softA.length} chapitre(s)-livre à lignes non pinées · ${noChapterCount} réf(s) sans chapitre (hors mesure) · folios Atlas ignorés ${data.folioIgnored}`)
  for (const [book, st] of [...data.bookStats].sort((a, b) => parUnitesDeCode(a[0], b[0])))
    console.log(`  ${book} : ${st.hard} trous durs · ${st.soft} chapitres non pinés · ${st.noCh} réfs sans chapitre`)
  const surTopic = data.nonImpl.filter((n) => n.topic)
  console.log(`Sens B1 : ${data.nonImpl.length} (non implémenté) — ${surTopic.filter((n) => n.dette).length} sous dette déclarée, ${surTopic.filter((n) => !n.dette).length} sans entrée, ${data.nonImpl.length - surTopic.length} hors champ Implémente`)
  for (const d of data.dettesDeFiche)
    console.log(`  dette de fiche ${d.fiche}.md (${d.ticket}) : couvre ${d.couverts} topic(s) sur ${d.total}`)
  for (const e of data.b2)
    console.log(`Sens B2 ${e.book} (cœur ${e.coeur}) : ${e.avant.length} → ${e.horsCode.length} chapitre(s) Atlas hors-code (${e.credites.length} crédité(s) par folio, ${e.sousDette.length} sous dette de fiche)`)

  if (data.etrangers.length) {
    console.log(`CŒUR ÉTRANGER — ${data.etrangers.length} fiche(s) sur ${data.fichesJugees} citent le livre de cœur d'un AUTRE cœur que le leur :`)
    for (const m of data.etrangers)
      console.log(`  ${m.fiche} : ${m.coeurs.map((c) => `cœur ${c.coeur} (${c.livres.join(', ')})`).join(' ET ')}`)
    console.log("  Remède : une fiche synthétise le cœur que son CHEMIN déclare — déplacer la fiche, la scinder, ou retirer la citation étrangère.")
  } else {
    console.log(`Cœur étranger : aucune des ${data.fichesJugees} fiche(s) ne cite le livre de cœur d'un autre cœur que le sien.`)
  }

  const entrees = trousDurs(data)
  const stock = lireStock()
  const { neuves, perimees, coeur } = ecartsTrousDurs(entrees, stock)
  if (coeur.length) {
    console.log(`LIVRE DE CŒUR — ${coeur.length} chapitre(s) : un livre de cœur se CORRIGE, il ne se stocke pas.`)
    for (const p of coeur) console.log(`  ${p}`)
    console.log("  Remède : couvrir le chapitre dans une fiche de l'Atlas (ou retirer la réf de code) — aucune voie de stock en Sens A pour un livre de cœur.")
  }
  if (neuves.length) {
    console.log(`TROU(S) DUR(S) NEUF(S) — ${neuves.length} chapitre(s) hors du stock \`scripts/raw/reconciliation-stock.json\` :`)
    for (const n of neuves) console.log(`  ${n}`)
    console.log("  Remède : couvrir le chapitre dans l'Atlas (ou retirer la réf de code) — l'ajouter au stock ne se fait qu'avec une dette instruite.")
  }
  if (perimees.length) {
    console.log(`STOCK À DÉCROÎTRE — ${perimees.length} entrée(s) de \`scripts/raw/reconciliation-stock.json\` sans trou mesuré : retirer l'entrée.`)
    for (const p of perimees) console.log(`  ${p}`)
  }
  if (neuves.length || perimees.length || coeur.length || data.etrangers.length) process.exitCode = 1
  else console.log(`Cliquet des trous durs : ${entrees.length} trou(s) dur(s), tous au stock (${Object.keys(stock).length} entrée(s)) — aucun neuf, aucun périmé, aucun livre de cœur.`)
}

const isMain = process.argv[1] && process.argv[1].endsWith('reconcile.mjs')
if (isMain) main()
