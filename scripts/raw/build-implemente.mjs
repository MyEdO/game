// Générateur du champ `**Implémente :**` des fiches docs/raw/*.md (#487) : le champ est DÉRIVÉ du
// code (jamais écrit à la main — cf. game-doc-derivee-jamais-ecrite-a-la-main). Patron de
// build-systemes.mjs : manifest éditorial (src/data/raw.manifest.json) + calcul + mode --check qui
// régénère en mémoire, compare au committé, exit 1 sans écrire.
// Re-run : node scripts/raw/build-implemente.mjs (npm run raw:implemente).
import { readFileSync, writeFileSync } from 'node:fs'
import { parUnitesDeCode } from '../guards/lib/lister.mjs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { refRe, span, bookOf, BOOKS, estLivreExtrait, esc, folioRange, allAbbrAlternation, pagesDeLAtlas, readText } from './_lib.mjs'
import { closureOf } from '../guards/lib/importGraph.mjs'
import { EXTS_IMPLEMENTANTES, fichiersCitants } from './lib/fichiersCitants.mjs'
import { estFichierVitest } from '../guards/lib/fichierVitest.mjs'

export const RAWDIR = 'docs/raw'
export const SRC_DIR = 'src'
const EXCLUDE_SRC_PREFIX = 'src/gameIso/rig/parts/tenues/defs/' // art de couverture, pas une règle
// Manifests ÉDITORIAUX de `src/data/` : ils parlent DU dépôt (dette d'un topic, inventaire d'une
// donnée), ils n'appliquent aucune règle. Leurs réfs sont de la méta, jamais une implémentation.
// La classe est TOUT `src/data/*.manifest.json` : un nom de fichier n'a pas à être deviné ici.
export const MANIFEST_EDITORIAL_RE = /^src\/data\/[^/]+\.manifest\.json$/
export const MANIFEST_PATH = 'src/data/raw.manifest.json'
export const BOOKS_JSON_PATH = 'src/data/books.json'
export const APP_ROOT_MODULE = 'src/main.tsx'
// Fenêtre de match ligne (épreuve 2026-07-16). Recalibrage empirique 2026-07-16 (mesure `--dry` TOL
// 10/5/2/0 → implémentés 286/282/273/264) : TOL n'est PAS le levier des faux « implémenté » des
// pages-catalogues denses. Les faux `activites#dressage`/`entrainement`/`faites-moi-une-faveur`
// viennent d'une plage FOLIO large (`activities.json` craft/learn → `LDB 23 l.50-191`) qui CONTIENT
// déjà le topic → TOL-immune. À l'inverse TOL=0 casse de vrais folio-implémentés (colique : topic
// `MSRC 16 l.109-111` vs plage folio `l.65-105`, décalage folio↔fiche de 4 l. que TOL comble).
// Tenu à 10 : `renderBlock` accepte un override `ctx.tol` (mesure) ; le remède des pages denses est
// côté FOLIO (feature #434), pas TOL — écart rapporté à l'orchestrateur.
export const TOL = 10

// Acceptation DÉCLARÉE à la couture (`pagesDeLAtlas`) : les FICHES seules — le champ `Implémente` ne
// vit que sur un topic de fiche.
export const CLASSES = ['fiche']
/** Le stem d'une fiche depuis son chemin RELATIF à l'Atlas (`<coeur>/<domaine>`) — dérivation UNIQUE
 *  (`parseFiche` et `reconcile`) : le stem PORTE le cœur, sans quoi deux cœurs collisionneraient sur
 *  le même id de topic. */
export const stemDeFiche = (relatif) => relatif.replace(/\.md$/, '')
/** Fichier de `src/` qui n'IMPLÉMENTE rien — art de couverture du rig, manifest éditorial : ses
 *  réfs ne comptent jamais pour l'implémentation d'un topic. Seule exclusion de `indexCode`. */
export const estHorsImplementation = (rel) => rel.startsWith(EXCLUDE_SRC_PREFIX) || MANIFEST_EDITORIAL_RE.test(rel)
// Rang du livre dans `BOOKS` (= son rang dans `books.json`), pour l'ordre des puces.
const RANG_DU_LIVRE = new Map(BOOKS.map(([abbr], i) => [abbr, i]))

// --- regex héritées (graphies du libellé de champ) ---
export const HEADING_RE = /^(#{1,6})\s+(.*)$/
export const FIELD_START_RE = /^\*\*Impl[ée]ment[ée]?\s*[:.]?\*\*/
export const FIELD_ANYWHERE_RE = /\*\*Impl[ée]ment[ée]?\s*[:.]?\*\*/
export const DECL_RE = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/
const COMMENT_OR_BLANK = /^\s*(?:\/\/|\/\*|\*|$)/

// Marqueur généré (SEULE graphie du non-implémenté) — et sa contre-épreuve d'invisibilité des gardes.
export const GEN_TAG = '_(généré — `npm run raw:implemente`)_'
export const NOT_IMPL = '(non implémenté)'
// Alternation DÉRIVÉE de `_lib.mjs` (#434 défaut 10 : une alternation écrite à la main ici se
// désynchronisait dès qu'un livre s'ajoutait à BOOKS — cf. allAbbrAlternation, source unique).
export const GUARD_LEAK_RE = new RegExp(`\\b(?:${allAbbrAlternation()}) ?\\d* l\\.`)

export function slugify(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Réfs `{ book, ch, lo, hi }` d'une ligne (spans dépliés par `span`). */
export function refsWithSpans(line) {
  const out = []
  const re = refRe()
  let m
  while ((m = re.exec(line))) {
    if (m[2] == null) continue
    const book = bookOf(m[1].replace(/\s+/g, ' ').trim())
    if (!book) continue
    const [lo, hi] = span(m[3], m[4])
    out.push({ book, ch: Number(m[2]), lo, hi })
  }
  return out
}

// --- Pont FOLIO : source:{book,page} des .json → citation {book, ch, lo, hi} (#434) ---
const BOOK_ABBRS = new Set(BOOKS.map(([a]) => a))

/** Map slug (`books.json.id`) → abbr canonique (`BOOKS`). Fail-fast : toute `abbr` de `books.json`
 *  absente de `BOOKS` = erreur (source unique du mapping, jamais une 2e table à la main). */
export function buildAbbrMap(books) {
  const bySlug = new Map()
  const knownIds = new Set()
  for (const b of books) {
    if (!b || typeof b.id !== 'string') continue
    knownIds.add(b.id)
    if (!estLivreExtrait(b)) continue
    if (!BOOK_ABBRS.has(b.abbr)) throw new Error(`books.json: abbr inconnue de BOOKS pour "${b.id}" → "${b.abbr}"`)
    bySlug.set(b.id, b.abbr)
  }
  return { abbrOf: bySlug, knownIds }
}
export function loadAbbrMap(path = BOOKS_JSON_PATH) {
  return buildAbbrMap(JSON.parse(readFileSync(path, 'utf8')))
}

const JSON_ID_RE = /"id"\s*:\s*"([^"]+)"/
const JSON_BOOK_RE = /"book"\s*:\s*"([^"]+)"/
const JSON_PAGE_RE = /"page"\s*:\s*(-?\d+)/

/** Extrait de `content` (.json) les citations FOLIO : chaque `source:{book,page}` est rattachée à
 *  l'entité PORTEUSE — l'`id` de l'objet ENGLOBANT le plus proche par profondeur d'accolades, jamais
 *  un `id` de référence emboîtée (`skill:{id}`, `talent:{id}`…) dont la portée est déjà refermée.
 *  Sa citation = {book:abbr, ch, lo, hi} de la plage folio (via `resolve(slug, page)`). `stats` (par
 *  abbr : resolved/notFound/ambiguous ; globaux : noAtlas/noPage) est mut é en place. `slug` inconnu
 *  de `knownIds` = fail-fast. */
export function folioCitationsFromJson(rel, content, { abbrOf, knownIds, stats }) {
  const out = []
  const lines = content.split('\n')
  const idAt = []            // idAt[d] = id de l'objet ouvert à la profondeur d (portées refermées purgées)
  const ID_G = new RegExp(JSON_ID_RE.source, 'g')
  const BOOK_G = new RegExp(JSON_BOOK_RE.source, 'g')
  let depth = 0, inString = false, escaped = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const events = []
    let m
    ID_G.lastIndex = 0
    while ((m = ID_G.exec(line))) events.push({ at: m.index, kind: 'id', v: m[1] })
    BOOK_G.lastIndex = 0
    const bm = BOOK_G.exec(line)
    if (bm) events.push({ at: bm.index, kind: 'book', v: bm[1] })
    events.sort((a, b) => a.at - b.at)
    let e = 0
    for (let c = 0; c <= line.length; c++) {
      while (e < events.length && events[e].at === c) {
        const ev = events[e++]
        if (ev.kind === 'id') { idAt.length = depth; idAt[depth] = ev.v; continue }
        const slug = ev.v
        if (!knownIds.has(slug)) throw new Error(`${rel}:${i + 1} source.book inconnu de books.json : "${slug}"`)
        let page = null
        const pm = JSON_PAGE_RE.exec(line)
        if (pm) page = Number(pm[1])
        else for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) { const p = JSON_PAGE_RE.exec(lines[j]); if (p) { page = Number(p[1]); break } }
        if (page == null) { stats.noPage++; continue }
        const abbr = abbrOf.get(slug)
        if (!abbr) { stats.noAtlas++; continue }
        const s = stats.byBook.get(abbr) || { resolved: 0, notFound: 0, ambiguous: 0 }
        stats.byBook.set(abbr, s)
        const r = folioRange(abbr, page)
        if (r === 'ambiguous') { s.ambiguous++; continue }
        if (r == null) { s.notFound++; continue }
        s.resolved++
        let porteur = null
        for (let d = Math.min(depth, idAt.length - 1); d >= 0; d--) if (idAt[d] != null) { porteur = idAt[d]; break }
        out.push({ book: abbr, ch: r.ch, lo: r.lo, hi: r.hi, file: rel, row: i + 1, isTs: false, sym: porteur, folio: true })
      }
      if (c === line.length) break
      const ch = line[c]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
      } else if (ch === '"') inString = true
      else if (ch === '{' || ch === '[') depth++
      else if (ch === '}' || ch === ']') { depth--; if (idAt.length > depth + 1) idAt.length = depth + 1 }
    }
  }
  return out
}

/** Nom de la déclaration top-level d'une ligne, ou null. */
export function declNameOf(line) {
  const m = DECL_RE.exec(line)
  return m ? m[1] : null
}

/** Symbole englobant la ligne `row` (1-based) : déclaration précédente, SAUF si la citation est dans
 *  un bloc de commentaire contigu à la déclaration SUIVANTE (≤15 lignes) → JSDoc d'en-tête. */
export function symbolFor(lines, row) {
  for (let k = row + 1; k <= lines.length && k <= row + 15; k++) {
    const name = declNameOf(lines[k - 1])
    if (name) {
      let allComment = true
      for (let t = row; t < k; t++) if (!COMMENT_OR_BLANK.test(lines[t - 1])) { allComment = false; break }
      if (allComment) return name
      break
    }
    if (!COMMENT_OR_BLANK.test(lines[k - 1])) break
  }
  for (let k = row; k >= 1; k--) {
    const name = declNameOf(lines[k - 1])
    if (name) return name
  }
  return null
}

/** Une citation de code matche une réf de topic ssi même livre+chapitre ET intersection non vide
 *  entre `[lo-tol, hi+tol]` de la réf et `[lo, hi]` de la citation. `tol` par défaut = `TOL`. */
export function refMatches(topicRef, cit, tol = TOL) {
  return (
    topicRef.book === cit.book &&
    topicRef.ch === cit.ch &&
    topicRef.lo - tol <= cit.hi &&
    cit.lo <= topicRef.hi + tol
  )
}

/** Longueur d'intersection (en lignes) entre deux spans `[lo,hi]` (0 si disjoints). */
function spanOverlap(aLo, aHi, bLo, bHi) {
  const lo = Math.max(aLo, bLo), hi = Math.min(aHi, bHi)
  return hi >= lo ? hi - lo + 1 : 0
}

/** Règle folio-EXCLUSIVE (#434, EXPÉRIENCE — flag `--folio-exclusive`, JAMAIS par défaut) : une
 *  citation FOLIO n'est attribuée qu'au(x) topic(s) de MEILLEUR RECOUVREMENT — parmi les topics dont
 *  les réfs (avec `tol`) intersectent la plage folio, seul(s) le(s) recouvrement(s) MAXIMAL(aux)
 *  (longueur d'intersection brute réfs↔plage) la reçoivent ; égalité = tous les ex æquo la gardent.
 *  Retourne Map<cit, Set<topic>>. Citations de LIGNE (code) non concernées.
 *  MESURE 2026-07-16 (`--dry --folio-exclusive`) : NE SÉPARE PAS → non adopté. Le décalage folio↔fiche
 *  fait que colique (réf fiche `MSRC 16 l.109-111`, HORS de sa plage folio `l.65-105`) a un recouvrement
 *  NUL avec sa propre citation → volée par le voisin `vers-de-carie` (réf l.71-86, recouvre 16 l.) →
 *  colique RÉGRESSE en non implémenté ; et 2 dettes (dernieres-nouvelles/semer-la-dissension) restent
 *  implémentées. Gardé en expérience derrière le flag ; le vrai bruit est documenté à part. */
export function computeFolioWinners(fiches, index, tol = TOL) {
  const topics = []
  for (const fi of fiches) for (const f of fi.parsed.fields) topics.push({ topic: f.topic, refs: f.refs })
  const winners = new Map()
  for (const c of index.impl) {
    if (!c.folio) continue
    let best = -1
    const scored = []
    for (const t of topics) {
      let overlap = 0, matches = false
      for (const r of t.refs) {
        if (r.book !== c.book || r.ch !== c.ch) continue
        if (refMatches(r, c, tol)) matches = true
        overlap += spanOverlap(r.lo, r.hi, c.lo, c.hi)
      }
      if (matches) { scored.push({ topic: t.topic, overlap }); if (overlap > best) best = overlap }
    }
    winners.set(c, new Set(scored.filter((s) => s.overlap === best).map((s) => s.topic)))
  }
  return winners
}

/** Fusionne des spans `[lo,hi]` qui se CHEVAUCHENT (pas les adjacents). */
export function mergeSpans(spans) {
  const sorted = [...spans].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const out = []
  for (const [lo, hi] of sorted) {
    const last = out[out.length - 1]
    if (last && lo <= last[1]) last[1] = Math.max(last[1], hi)
    else out.push([lo, hi])
  }
  return out
}
const fmtSpan = ([lo, hi]) => (lo === hi ? `l.${lo}` : `l.${lo}-${hi}`)

/** Masque des blocs du champ `**Implémente**` d'une fiche : pour `lines`, retourne `isHeader[i]`
 *  (ligne d'ouverture `FIELD_START_RE`), `inFieldBlock[i]` (dans un bloc), `endIdxOf[i]` (fin
 *  exclusive du bloc ouvert en `i`). Un bloc court de sa ligne d'en-tête à la première ligne VIDE ou
 *  HEADING (exclue). Frontière PARTAGÉE — la garde de prose d'état (citation-graphy-guard) l'importe. */
export function fieldBlockMask(lines) {
  const isHeader = lines.map((ln) => FIELD_START_RE.test(ln))
  const inFieldBlock = new Array(lines.length).fill(false)
  const endIdxOf = new Array(lines.length).fill(-1)
  for (let i = 0; i < lines.length; i++) {
    if (!isHeader[i]) continue
    let j = i + 1
    while (j < lines.length && lines[j].trim() !== '' && !HEADING_RE.test(lines[j])) j++
    endIdxOf[i] = j
    for (let k = i; k < j; k++) inFieldBlock[k] = true
  }
  return { isHeader, inFieldBlock, endIdxOf }
}

/** Parse une fiche : champs Implémente (topic, bloc, réfs collectées) + anomalies non-début-de-ligne. */
export function parseFiche(relatif, content) {
  const lines = content.split('\n')
  const fields = []
  const anomalies = []
  const slugCount = new Map()
  const stem = stemDeFiche(relatif)

  const { isHeader, inFieldBlock, endIdxOf } = fieldBlockMask(lines)

  let nearestHeading = null
  let pending = []
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    const h = HEADING_RE.exec(ln)
    if (h) {
      nearestHeading = h[2].trim()
      if (h[1].length === 2) pending = []
      // Réfs portées par la ligne de heading (`### Racine des Tombes (MSRC 04 l.204-229)`) : rattachées
      // au segment que ce heading OUVRE (dans `pending`, consommé par le prochain champ) — jamais au
      // topic précédent (son champ a déjà vidé `pending`). Corrige les topics dont la SEULE réf vit
      // dans leur titre (sinon `refs = []`, « non implémenté » mécanique quel que soit le code).
      for (const r of refsWithSpans(ln)) pending.push(r)
      continue
    }
    if (!isHeader[i] && !/^\s*>/.test(ln) && FIELD_ANYWHERE_RE.test(ln)) {
      anomalies.push({ doc: relatif, row: i + 1, text: ln.trim().slice(0, 160) })
    }
    if (isHeader[i]) {
      const slug = slugify(nearestHeading || stem)
      const n = (slugCount.get(slug) || 0) + 1
      slugCount.set(slug, n)
      const topic = `${stem}#${slug}${n > 1 ? '-' + n : ''}`
      // `heading` = le titre VERBATIM d'où le slug du topic est tiré, exposé ici pour que personne
      // n'ait à re-dériver l'appariement titre↔topic (cf. `libelleDe`).
      fields.push({ topic, heading: nearestHeading || stem, headerIdx: i, endIdx: endIdxOf[i], refs: pending })
      pending = []
      continue
    }
    if (inFieldBlock[i]) continue
    for (const r of refsWithSpans(ln)) pending.push(r)
  }
  return { fields, anomalies }
}

/** Index du code : citations non-test / test, lignes des .ts(x) (symboles), textes non-test (appelants).
 *  `abbrMap` (optionnel, `loadAbbrMap()`) active le pont FOLIO des `.json` : chaque `source:{book,page}`
 *  devient une citation `impl` (id = symbole), stats folio accumulées dans `folioStats`. */
export function indexCode(srcDir = SRC_DIR, abbrMap = null) {
  const impl = []
  const tests = []
  const fileLines = new Map()       // rel -> lines[]  (.ts/.tsx)
  const nonCommentText = new Map()  // rel -> lignes NON-commentaires jointes (non-test, pour les appelants)
  const folioStats = { byBook: new Map(), noAtlas: 0, noPage: 0 }
  for (const f of fichiersCitants(srcDir, EXTS_IMPLEMENTANTES)) {
    const rel = f.replace(/\\/g, '/')
    if (estHorsImplementation(rel)) continue
    const isTest = estFichierVitest(rel)
    const content = readFileSync(f, 'utf8')
    const lines = content.split('\n')
    const isTs = /\.tsx?$/.test(rel)
    if (isTs) fileLines.set(rel, lines)
    if (!isTest) nonCommentText.set(rel, lines.filter((ln) => !COMMENT_OR_BLANK.test(ln)).join('\n'))
    lines.forEach((ln, i) => {
      for (const r of refsWithSpans(ln)) (isTest ? tests : impl).push({ ...r, file: rel, row: i + 1, isTs })
    })
    if (abbrMap && !isTest && rel.endsWith('.json')) {
      for (const c of folioCitationsFromJson(rel, content, { ...abbrMap, stats: folioStats })) impl.push(c)
    }
  }
  return { impl, tests, fileLines, nonCommentText, folioStats }
}

/** Un symbole EXPORTÉ est « sans appelant » ssi aucune occurrence `\b<nom>\b` HORS commentaire dans
 *  un autre fichier src non-test, NI dans son propre fichier en dehors de sa déclaration. Un symbole
 *  non exporté (usage local uniquement) n'est JAMAIS flagué. */
export function isDeadExport(name, defFile, index) {
  const defLines = index.fileLines.get(defFile)
  if (!defLines) return false
  let declIdx = -1
  let exported = false
  for (let i = 0; i < defLines.length; i++) {
    const dn = declNameOf(defLines[i])
    if (dn === name) { declIdx = i; exported = /^export\b/.test(defLines[i]); break }
  }
  if (declIdx < 0 || !exported) return false
  const re = new RegExp(`\\b${esc(name)}\\b`)
  for (let i = 0; i < defLines.length; i++) {
    if (i === declIdx || COMMENT_OR_BLANK.test(defLines[i])) continue
    if (re.test(defLines[i])) return false // appelant local (hors commentaire, hors déclaration)
  }
  for (const [rel, text] of index.nonCommentText) {
    if (rel === defFile) continue
    if (re.test(text)) return false // appelant dans un autre fichier non-test (hors commentaire)
  }
  return true
}

/** ÉTAT d'un topic, PUR : puces d'implémentation ordonnées, groupes `sans code`, fichiers de test,
 *  fichiers de code cités. C'est la mesure — le rendu, les stats, les orphelins de dette et
 *  `reconcile.mjs` la LISENT ; personne ne renifle le Markdown produit pour la retrouver. */
export function etatDuTopic(field, ctx) {
  const { index, closure } = ctx
  const { impl, tests } = index
  const tol = ctx.tol ?? TOL
  const refs = field.refs
  // Règle folio-exclusive (expérience) : une citation FOLIO ne compte pour CE topic que s'il fait
  // partie de ses gagnants au meilleur recouvrement (`computeFolioWinners`). OFF → comportement d'origine.
  const folioOk = (c) =>
    !c.folio || !ctx.folioExclusive || (ctx.folioWinners && ctx.folioWinners.get(c)?.has(field.topic))

  const refGroups = new Map() // 'BOOK|CH' -> { book, ch, refs:[] }
  for (const ref of refs) {
    const key = ref.book + '|' + ref.ch
    if (!refGroups.has(key)) refGroups.set(key, { book: ref.book, ch: ref.ch, refs: [] })
    refGroups.get(key).refs.push(ref)
  }

  const bullets = []       // { book, ch, order, text }
  const sansCodeGroups = new Map() // 'BOOK|CH' -> { book, ch, spans:[] }
  const fichiers = new Set()
  for (const g of refGroups.values()) {
    const matchedSpans = []
    const citMap = new Map() // file:row -> cit
    for (const ref of g.refs) {
      const matched = impl.filter((c) => c.book === g.book && c.ch === g.ch && refMatches(ref, c, tol) && folioOk(c))
      if (matched.length) {
        matchedSpans.push([ref.lo, ref.hi])
        for (const c of matched) { citMap.set(c.file + ':' + c.row, c); fichiers.add(c.file) }
      } else {
        const k = ref.book + '|' + ref.ch
        if (!sansCodeGroups.has(k)) sansCodeGroups.set(k, { book: ref.book, ch: ref.ch, spans: [] })
        sansCodeGroups.get(k).spans.push([ref.lo, ref.hi])
      }
    }
    if (!matchedSpans.length) continue
    bullets.push(buildMatchBullet(g, matchedSpans, [...citMap.values()], { index, closure }))
  }
  bullets.sort(ordreDesPuces)

  // Fichiers de test : mesurés SEULEMENT quand aucune puce ne sort — « cité par tests seulement »
  // est l'état d'un topic sans implémentation.
  const testFiles = new Set()
  if (!bullets.length) for (const ref of refs) for (const c of tests) if (refMatches(ref, c, tol)) testFiles.add(c.file)

  return {
    topic: field.topic,
    implemente: bullets.length > 0,
    bullets,
    sansCode: [...sansCodeGroups.values()],
    testFiles,
    fichiers,
  }
}

/** Rend le bloc (lignes) d'un champ pour un topic, depuis son ÉTAT mesuré. Déterministe. */
export function renderBlock(field, ctx) {
  const etat = etatDuTopic(field, ctx)
  const out = []
  if (etat.implemente) {
    out.push(`**Implémente :** ${GEN_TAG}`)
    for (const b of etat.bullets) out.push(b.text)
    const sansCode = renderSansCode(etat.sansCode)
    if (sansCode) out.push(sansCode)
  } else {
    out.push(`**Implémente :** ${NOT_IMPL}`)
    if (etat.testFiles.size) {
      const list = [...etat.testFiles].sort()
      const shown = list.slice(0, 4).map((f) => `\`${f}\``)
      if (list.length > 4) shown.push(`+${list.length - 4}`)
      out.push(`- cité par tests seulement : ${shown.join(', ')}`)
    }
  }
  // Une seule lecture du manifest, la couture `detteDe` — c'est ELLE qui sait si la dette d'un topic
  // implémenté existe (son entrée propre) ou non (la couverture de fiche ne le vise pas).
  const dette = ctx.dette.detteDe(field.topic, { implemente: etat.implemente })
  if (dette?.ticket) out.push(`- dette : ${dette.ticket}`)
  if (dette?.bloque) out.push(`- bloqué : ${dette.bloque}`)
  return out
}

function buildMatchBullet(g, matchedSpans, cits, { index, closure }) {
  const spans = mergeSpans(matchedSpans)
  const symFirstRow = new Map()
  const files = new Set()
  for (const c of cits) {
    files.add(c.file)
    // Symbole : déclaration englobante pour les .ts(x) ; id d'entrée porté par la citation FOLIO des .json.
    const name = c.isTs ? symbolFor(index.fileLines.get(c.file), c.row) : c.sym
    if (name) {
      const cur = symFirstRow.get(name)
      // Départage TOTAL : à `row` égal entre deux fichiers, le chemin lexicographiquement plus petit
      // fixe `defFile` — sinon le premier VU gagne, et `defFile` alimente `isDeadExport` (⚠sans-appelant).
      if (cur == null || c.row < cur.row || (c.row === cur.row && c.file < cur.defFile)) symFirstRow.set(name, { row: c.row, defFile: c.file })
    }
  }
  const symbols = [...symFirstRow.entries()]
    .sort((a, b) => a[1].row - b[1].row || parUnitesDeCode(a[0], b[0]))
    .map(([name, info]) => {
      const dead = isDeadExport(name, info.defFile, index)
      return `\`${name}\`${dead ? ' ⚠sans-appelant' : ''}`
    })
  const fileToks = [...files].sort().map((f) => `\`${f}\`${closure.has(f) ? '' : ' ⚠hors-app'}`)

  const symShown = symbols.slice(0, 10)
  if (symbols.length > 10) symShown.push(`+${symbols.length - 10}`)
  const fileShown = fileToks.slice(0, 6)
  if (fileToks.length > 6) fileShown.push(`+${fileToks.length - 6} fichiers`)

  const after = symShown.length ? `${symShown.join(', ')} — ${fileShown.join(', ')}` : fileShown.join(', ')
  return { book: g.book, ch: g.ch, text: `- \`${g.book} ${g.ch}\` (${spans.map(fmtSpan).join(', ')}) → ${after}` }
}

/** Ordre TOTAL des puces d'un champ `**Implémente :**` : livre (rang dans `BOOKS`), chapitre, puis le
 *  TEXTE de la puce — qui porte les fichiers cités. PUR (aucune lecture disque). Sans ce dernier
 *  départage, deux puces de même (livre, chapitre) issues de deux fichiers gardaient l'ordre
 *  d'insertion, c'est-à-dire celui de la marche du disque (#1244). Les groupes `sans code` n'ont pas
 *  de `text` : leur clé `book|ch` est unique, le départage y est inerte.
 *  Un livre HORS `BOOKS` est un BUG D'APPELANT (toute puce vient de `refsWithSpans`, qui écarte ce
 *  que `bookOf` ne reconnaît pas, ou du pont folio, dont `buildAbbrMap` refuse l'`abbr` inconnue) :
 *  il se REFUSE ici, nommément. Un rang par défaut entrelacerait ses puces en silence. */
const rangDe = (puce) => {
  const rang = RANG_DU_LIVRE.get(puce.book)
  if (rang === undefined) throw new Error(`ordreDesPuces : livre "${puce.book}" hors de BOOKS — puce : ${puce.text ?? `${puce.book} ${puce.ch}`}`)
  return rang
}
export const ordreDesPuces = (a, b) =>
  rangDe(a) - rangDe(b)
  || a.ch - b.ch
  || parUnitesDeCode(a.text ?? '', b.text ?? '')

function renderSansCode(groups) {
  if (!groups.length) return null
  groups.sort(ordreDesPuces)
  const parts = []
  let count = 0
  let overflow = 0
  for (const g of groups) {
    const merged = mergeSpans(g.spans)
    const take = merged.slice(0, Math.max(0, 8 - count))
    if (take.length) {
      parts.push(`\`${g.book} ${g.ch}\` (${take.map(fmtSpan).join(', ')})`)
      count += take.length
    }
    overflow += merged.length - take.length
  }
  let line = `- sans code : ${parts.join(', ')}`
  if (overflow > 0) line += ` +${overflow}`
  return line
}

/** Régénère le contenu d'une fiche (SEULS les blocs de champs changent). */
export function regenerateFiche(relatif, content, ctx) {
  const { fields } = parseFiche(relatif, content)
  if (!fields.length) return content
  const lines = content.split('\n')
  const reps = fields.map((f) => ({ f, block: renderBlock(f, ctx) })).sort((a, b) => b.f.headerIdx - a.f.headerIdx)
  for (const { f, block } of reps) lines.splice(f.headerIdx, f.endIdx - f.headerIdx, ...block)
  return lines.join('\n')
}

/** Le stem de fiche porté par un `id` de dette : `<fiche>#<slug>` → `<fiche>` ; un stem est le sien. */
export const stemDe = (id) => String(id).split('#')[0]

/** Titre H1 d'une fiche — il y en a UN, le reste est un défaut de la fiche (fail-fast). */
function titreDeFiche(stem, content) {
  const h1 = content.split('\n').map((ln) => HEADING_RE.exec(ln)).filter((m) => m && m[1].length === 1)
  if (h1.length !== 1) throw new Error(`fiche « ${stem}.md » : ${h1.length} titre(s) H1 (1 attendu)`)
  return h1[0][2].trim()
}

/**
 * Libellé d'un `id` de dette — dérivation UNIQUE des deux formes : un TOPIC `<fiche>#<slug>` rend le
 * heading VERBATIM de sa section, un STEM de fiche rend le titre H1 de la fiche. Le topic passe par
 * `parseFiche`, donc par la MÊME dérivation que le générateur, disambiguation `-N` comprise : aucun
 * second slugify parallèle ne peut diverger. Fail-fast si la fiche, le topic ou le H1 manque.
 * Consommé par la migration `2026-08-28-l1b-10b-rawmanifest-label.mjs` et par sa garde.
 */
export function libelleDe(id, rawDir = RAWDIR) {
  const stem = stemDe(id)
  const content = readFileSync(join(rawDir, `${stem}.md`), 'utf8')
  if (stem === String(id)) return titreDeFiche(stem, content)
  const { fields } = parseFiche(stem, content)
  const hit = fields.filter((f) => f.topic === id)
  if (hit.length !== 1) throw new Error(`topic « ${id} » : ${hit.length} champ(s) dans ${stem}.md (1 attendu)`)
  return hit[0].heading
}

/** Charge + valide la dette éditoriale (fail-fast). `registres` = `{ topics, stems }` des fiches. */
export function chargerDette(registres, path = MANIFEST_PATH) {
  return validerDette(JSON.parse(readFileSync(path, 'utf8')), registres)
}

/**
 * Valide les entrées de dette et rend la couture qui les LIT. Une entrée porte son identité en `id`,
 * qui vit soit dans l'espace des topics (`<fiche>#<slug>`), soit dans celui des fiches (`<fiche>`) —
 * d'où la confrontation aux deux registres, dérivés du même parse. Une entrée de FICHE couvre tout
 * topic de sa fiche sans entrée propre ; sa portée large n'est bornée que par la VIE de son ticket,
 * `ticket` y est donc obligatoire — à la fermeture du ticket l'entrée part et les topics encore non
 * implémentés redeviennent orphelins (#1825).
 */
export function validerDette(entrees, { topics = new Set(), stems = new Set() } = {}) {
  const parTopic = new Map()
  const parFiche = new Map()
  const erreurs = []
  for (const e of entrees) {
    if (!e.id) { erreurs.push(`entrée de dette sans id : ${JSON.stringify(e)}`); continue }
    if (parTopic.has(e.id) || parFiche.has(e.id)) erreurs.push(`id dupliqué dans le manifest : ${e.id}`)
    if (!e.ticket && !e.bloque) erreurs.push(`entrée de dette sans ticket ni bloque : ${e.id}`)
    const estTopic = topics.has(e.id)
    const estFiche = stems.has(e.id)
    if (estTopic && estFiche) erreurs.push(`id AMBIGU — topic ET fiche portent « ${e.id} »`)
    else if (estTopic) parTopic.set(e.id, e)
    else if (estFiche) {
      if (!e.ticket) erreurs.push(`entrée de FICHE sans ticket : ${e.id} — une dette de fiche vit aussi longtemps que son ticket`)
      parFiche.set(e.id, e)
    } else erreurs.push(`id inconnu des fiches : ${e.id}`)
  }
  if (erreurs.length) throw new Error(`raw.manifest.json — ${erreurs.length} erreur(s) d'intégrité :\n  ${erreurs.join('\n  ')}`)
  return {
    entrees,
    /** Dette qui couvre `topic`, la plus spécifique d'abord :
     *  - son entrée de TOPIC, dans les DEUX états — elle nomme un RESTE choisi par son auteur, et
     *    la plupart des entrées réelles annotent un topic déjà implémenté ;
     *  - sinon, et SEULEMENT si le topic n'est pas implémenté, l'entrée de sa FICHE : une couverture
     *    large ne dit rien d'un topic implémenté, que personne n'a examiné (#1825). */
    detteDe: (topic, { implemente } = {}) =>
      parTopic.get(topic) ?? (implemente ? undefined : parFiche.get(stemDe(topic))),
    /** Dette déclarée au niveau d'une FICHE (son stem), ou `undefined`. */
    detteDeFiche: (stem) => parFiche.get(stem),
    /** Les entrées de FICHE déclarées, dans l'ordre du manifest. */
    entreesDeFiche: () => [...parFiche.values()],
  }
}

/** Les topics qu'une entrée de FICHE couvre RÉELLEMENT parmi `topics` (`{ topic, implemente }` de sa
 *  fiche) : ni implémentés, ni porteurs d'une entrée propre. Passe par `detteDe`, donc par la MÊME
 *  règle de couverture que le rendu — source unique de la garde « entrée sans objet » et de la
 *  ventilation du rapport de réconciliation. */
export function couvertureDe(entree, topics, dette) {
  return topics.filter((t) => dette.detteDe(t.topic, { implemente: t.implemente }) === entree)
}

/** Contexte complet (index code + closure + dette) + parse de toutes les fiches. */
export function buildContext({ rawDir = RAWDIR, srcDir = SRC_DIR, manifestPath = MANIFEST_PATH, booksPath = BOOKS_JSON_PATH } = {}) {
  const index = indexCode(srcDir, loadAbbrMap(booksPath))
  const closure = closureOf([APP_ROOT_MODULE])
  const fiches = pagesDeLAtlas(rawDir, { classes: CLASSES }).map(({ relatif: doc, chemin }) => {
    const content = readText(chemin)
    return { doc, content, parsed: parseFiche(doc, content) }
  })
  const { topics, stems } = registresDeFiches(fiches)
  const dette = chargerDette({ topics, stems }, manifestPath)
  const folioWinners = computeFolioWinners(fiches, index)
  return { index, closure, dette, fiches, rawDir, folioWinners }
}

/** Les deux espaces d'`id` d'une dette, du MÊME parse : les topics, et les fiches qui les portent. */
export function registresDeFiches(fiches) {
  const topics = new Set()
  const stems = new Set()
  for (const fi of fiches) for (const f of fi.parsed.fields) { topics.add(f.topic); stems.add(stemDe(f.topic)) }
  return { topics, stems }
}

/** États des topics (mesure PURE, `etatDuTopic`) + anomalies de champ des fiches. */
export function etatsDesTopics(ctx) {
  const perTopic = []
  const anomalies = []
  for (const fi of ctx.fiches) {
    for (const a of fi.parsed.anomalies) anomalies.push(a)
    for (const f of fi.parsed.fields) perTopic.push(etatDuTopic(f, ctx))
  }
  return { perTopic, anomalies }
}

/** Garde #434 (Sens B) : tout topic non implémenté DOIT être couvert par une dette déclarée (entrée
 *  de topic ou entrée de sa fiche). Retourne les topics ORPHELINS — un topic implémenté n'en est
 *  jamais un. */
export function orphelinsDeDette(ctx, all = etatsDesTopics(ctx)) {
  return all.perTopic.filter((t) => !t.implemente && !ctx.dette.detteDe(t.topic, { implemente: false })).map((t) => t.topic)
}

/** Dual de `orphelinsDeDette` (#1825) : une entrée de FICHE qui ne couvre plus AUCUN topic — tous
 *  implémentés, ou tous porteurs de leur entrée propre — est SANS OBJET. Sans cette garde elle
 *  survivrait en silence jusqu'à la fermeture de son ticket, en masquant une couverture qui ne
 *  couvre rien. Rend `{ entree, couverts, total }` pour chaque entrée sans objet. */
export function dettesDeFicheSansObjet(ctx, all = etatsDesTopics(ctx)) {
  const parFiche = new Map()
  for (const t of all.perTopic) {
    const stem = stemDe(t.topic)
    if (!parFiche.has(stem)) parFiche.set(stem, [])
    parFiche.get(stem).push(t)
  }
  return ctx.dette.entreesDeFiche()
    .map((entree) => {
      const topics = parFiche.get(entree.id) ?? []
      return { entree, couverts: couvertureDe(entree, topics, ctx.dette).length, total: topics.length }
    })
    .filter((e) => e.couverts === 0)
}

function printOrphans(orphans) {
  console.error(`raw:implemente — ${orphans.length} topic(s) NON IMPLÉMENTÉ(s) sans dette déclarée :`)
  for (const t of orphans) console.error(`  ${t}`)
  console.error('  → ticketer la dette (entrée `ticket`) ou consigner le blocage (entrée `bloque`) dans src/data/raw.manifest.json.')
}

function printSansObjet(sansObjet) {
  console.error(`raw:implemente — ${sansObjet.length} entrée(s) de FICHE SANS OBJET (plus aucun topic couvert) :`)
  for (const { entree, total } of sansObjet)
    console.error(`  ${entree.id} (${entree.ticket}) — les ${total} topic(s) de docs/raw/${entree.id}.md sont implémentés ou portent leur propre entrée`)
  console.error('  → retirer l\'entrée de src/data/raw.manifest.json ; fermer ou re-scoper son ticket.')
}

const citeParTestsSeulement = (t) => !t.implemente && t.testFiles.size > 0

function printStats(ctx, { perTopic, anomalies }, touched) {
  const impl = perTopic.filter((t) => t.implemente).length
  const testsOnly = perTopic.filter(citeParTestsSeulement).length
  const notImpl = perTopic.length - impl - testsOnly
  console.log(`fiches : ${touched}/${ctx.fiches.length} · champs : ${perTopic.length} · implémentés : ${impl} · non implémentés : ${notImpl} · tests seulement : ${testsOnly} · anomalies (non-début-de-ligne) : ${anomalies.length}`)
  for (const a of anomalies) console.log(`  anomalie ${a.doc}:${a.row} — ${a.text}`)
  printFolioStats(ctx.index.folioStats)
}

function printFolioStats(fs) {
  if (!fs) return
  const rows = [...fs.byBook.entries()].sort((a, b) => parUnitesDeCode(a[0], b[0]))
  let R = 0, N = 0, A = 0
  for (const [, s] of rows) { R += s.resolved; N += s.notFound; A += s.ambiguous }
  console.log(`folio : ${R} résolus · ${N} introuvables · ${A} ambigus · ${fs.noAtlas} hors-Atlas (slug sans abbr) · ${fs.noPage} sans page`)
  for (const [book, s] of rows) console.log(`  ${book} : ${s.resolved} résolus · ${s.notFound} introuvables · ${s.ambiguous} ambigus`)
}

function main() {
  const args = process.argv.slice(2)
  const CHECK = args.includes('--check')
  const DRY = args.includes('--dry')
  const ctx = buildContext()
  ctx.folioExclusive = args.includes('--folio-exclusive') // expérience #434 (mesure avant adoption)

  const all = etatsDesTopics(ctx)
  const orphans = orphelinsDeDette(ctx, all)
  const sansObjet = dettesDeFicheSansObjet(ctx, all)

  const regenerated = ctx.fiches.map((fi) => ({ doc: fi.doc, content: regenerateFiche(fi.doc, fi.content, ctx), orig: fi.content }))
  const touched = regenerated.filter((r) => r.content !== r.orig)

  if (DRY) {
    printStats(ctx, all, touched.length)
    if (orphans.length) printOrphans(orphans)
    if (sansObjet.length) printSansObjet(sansObjet)
    console.log('--- topics ---')
    for (const t of all.perTopic) {
      const state = t.implemente ? `implémenté(${t.fichiers.size} fichiers)` : citeParTestsSeulement(t) ? 'tests seulement' : 'non implémenté'
      console.log(`${t.topic} → ${state}`)
    }
    return
  }

  if (CHECK) {
    let failed = false
    if (touched.length) {
      console.error(`raw:implemente — ${touched.length} fiche(s) PÉRIMÉE(s) (champ Implémente divergent du code) :`)
      for (const r of touched) console.error(`  docs/raw/${r.doc}`)
      console.error('  → relancer `npm run raw:implemente` et committer.')
      failed = true
    }
    if (orphans.length) { printOrphans(orphans); failed = true }
    if (sansObjet.length) { printSansObjet(sansObjet); failed = true }
    if (failed) process.exit(1)
    console.log('raw:implemente — OK (champs Implémente à jour · tout non-implémenté ticketé · toute dette de fiche couvre un topic)')
    return
  }

  for (const r of touched) writeFileSync(join(ctx.rawDir, r.doc), r.content)
  printStats(ctx, all, touched.length)
  if (orphans.length) printOrphans(orphans)
  if (sansObjet.length) printSansObjet(sansObjet)
  if (orphans.length || sansObjet.length) process.exit(1)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
