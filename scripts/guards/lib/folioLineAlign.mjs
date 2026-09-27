// Mécanique de mesure « le FOLIO déclaré tombe-t-il sur la LIGNE citée ? » (#1318 E8).
//
// Une entrée de `src/data/*.json` peut citer sa source DEUX fois : par `source: {book, page}` (le
// folio IMPRIMÉ) et par une citation à la LIGNE de l'extraction Marker (`source.note` ou le champ
// `ref` frère, forme `<ABRÉV> <chapitre> l.<ligne>`). Les deux doivent désigner le même endroit :
// l'extraction sème des ancres `<span … data-folio="N">`, donc la ligne citée tombe sous une ancre,
// et cette ancre EST le folio de l'entrée. Quand les deux divergent, l'un des deux ment — et le
// mensonge est indétectable à la lecture (les deux ont l'air d'une citation).
//
// Frontière avec `folioIntegrity.mjs` (#536, voie A/B/C) : celle-là part de la `desc` VERBATIM et
// cherche où elle vit ; celle-ci ne lit aucun texte d'entrée — elle confronte deux MÉTADONNÉES
// entre elles. Elle mord donc les datasets sans `desc` (`flow-stakes`, `combat-stakes`,
// `voyage-stakes`, `reglesOptionnelles`…), invisibles de la voie A/B/C.
//
// Module ESM pur (`node` nu), consommé par `folioLineAlignAudit.ts` (qui nourrit le cliquet
// `src/data/folio-line-align.test.ts`), `src/data/criticals-folio.test.ts`, et prouvé par
// `scripts/guards/lib/folioLineAlign.test.mjs`.
import { readFileSync } from 'node:fs'
import { listerDossier } from './lister.mjs'
import { livreDuSigle, sigleDe } from '../../raw/_lib.mjs'
// Le NUMÉRO DE CHAPITRE (prédicat, motif, résolution) vient de sa maison PURE, jamais de la couche
// `scripts/raw` — `guards/lib` n'en dépend pas.
import { fichierDuChapitre } from '../../../src/data/source/decoupe.ts'
import { FOLIO_ATTR } from '../../../src/data/source/ancre-vide.ts'
import { join } from 'node:path'

/** Citation à la ligne : `LDB 12 l.28`, `ADE II 09 l.3`, `AA 07 l.1-185`, `MDG 14 l.13-19`… Le
 *  numéro de chapitre y est de LARGEUR QUELCONQUE, comme dans `refRe` (`scripts/raw/_lib.mjs`). */
const LINE_CITE_RE = /^([A-Za-zÀ-ÿ]+(?:\s+I{1,3})?)\s+(\d+)\s+l\.(\d+)/

/** Découpe une citation à la ligne en `{abbr, chapter, line}` — `null` si la forme n'en est pas une.
 *  PUR (aucun disque). @param {unknown} cite @returns {{abbr:string,chapter:number,line:number}|null} */
export function parseLineCitation(cite) {
  if (typeof cite !== 'string') return null
  const m = LINE_CITE_RE.exec(cite.trim())
  if (!m) return null
  return { abbr: m[1].trim(), chapter: Number(m[2]), line: Number(m[3]) }
}

/** Toutes les ancres `data-folio` d'un chapitre, dans l'ordre. PUR.
 *  @param {string[]} lines @returns {number[]} */
export function folioAnchors(lines) {
  return anchorsAt(lines).map((a) => a.folio)
}

/** Ancres `data-folio` d'un chapitre AVEC leur ligne (1-based), dans l'ordre. PUR.
 *  @param {string[]} lines @returns {{folio:number,line:number}[]} */
export function anchorsAt(lines) {
  const out = []
  lines.forEach((l, i) => {
    const [m] = l.matchAll(FOLIO_ATTR)
    if (m) out.push({ folio: Number(m[1]), line: i + 1 })
  })
  return out
}

/**
 * Folio gouvernant une (chapitre, ligne) AVEC le motif du verdict — `folio: null` dès que
 * l'extraction ne permet PAS de trancher. C'est la couverture du détecteur qui est rendue ici :
 * elle se lit, se compte et se verrouille (`src/data/folio-line-align.test.ts`).
 *
 * Trois refus, tous MESURÉS sur le dépôt :
 * - `span-a-trou` — la ligne tombe entre deux ancres qui ne se SUIVENT pas (ancre 150 puis 153 :
 *   les folios 151 et 152 n'ont pas d'ancre). Le span porte plusieurs folios imprimés et rien ne
 *   dit lequel ; 29 chapitres sur 215 sont dans ce cas (résidu #522).
 * - `queue-trouee` — la ligne est au-delà de la DERNIÈRE ancre du chapitre, et le chapitre suivant
 *   ne REPREND pas la numérotation (`folio` ou `folio+1`) : même trou, en bout de fichier. Ex.
 *   `EDOC 12` (ancres 64 et 65 pour un chapitre qui court jusqu'au folio 71).
 * - `sans-ancre` — aucune ancre avant la ligne, ni dans le chapitre ni en amont.
 *
 * Le seul REPORT accepté : la ligne précède la première ancre de son chapitre et le folio a été
 * ouvert dans le fichier-chapitre précédent (`LDB 63 l.30` vit sur le folio 299, ouvert dans
 * `62 - Les armes.md`) — à condition que la première ancre du chapitre d'arrivée continue bien la
 * numérotation.
 * PUR : `chapterLines(ch)` fournit les lignes d'un chapitre, ou `null` s'il n'existe pas.
 * @param {(ch:number)=>string[]|null} chapterLines @param {number} chapter @param {number} line
 * @returns {{folio:number|null, reason:'ok'|'span-a-trou'|'queue-trouee'|'sans-ancre'|'chapitre-absent'}}
 */
export function folioGoverningWhy(chapterLines, chapter, line) {
  const own = chapterLines(chapter)
  if (!own) return { folio: null, reason: 'chapitre-absent' }
  const anchors = anchorsAt(own)
  let k = -1
  for (let i = 0; i < anchors.length && anchors[i].line <= line; i++) k = i
  if (k >= 0) {
    const folio = anchors[k].folio
    if (k + 1 < anchors.length) {
      // Borné à DROITE : le span n'est jugeable que si l'ancre suivante enchaîne (+1).
      return anchors[k + 1].folio === folio + 1 ? { folio, reason: 'ok' } : { folio: null, reason: 'span-a-trou' }
    }
    return continues(chapterLines, chapter + 1, folio) ? { folio, reason: 'ok' } : { folio: null, reason: 'queue-trouee' }
  }
  for (let ch = chapter - 1; ch >= 0; ch--) {
    const prev = chapterLines(ch)
    if (!prev) continue
    const prevAnchors = anchorsAt(prev)
    if (!prevAnchors.length) continue
    const carried = prevAnchors[prevAnchors.length - 1].folio
    // Le report n'est fiable que si le chapitre d'arrivée REPREND la numérotation là où elle s'est
    // arrêtée : sa première ancre vaut le folio reporté ou le suivant.
    if (!anchors.length) return { folio: null, reason: 'queue-trouee' }
    return anchors[0].folio === carried || anchors[0].folio === carried + 1
      ? { folio: carried, reason: 'ok' }
      : { folio: null, reason: 'queue-trouee' }
  }
  return { folio: null, reason: 'sans-ancre' }
}

/** Vue « folio seul » de `folioGoverningWhy` — `null` = non jugeable. PUR.
 *  @param {(ch:number)=>string[]|null} chapterLines @param {number} chapter @param {number} line
 *  @returns {number|null} */
export function folioGoverning(chapterLines, chapter, line) {
  return folioGoverningWhy(chapterLines, chapter, line).folio
}

/** Le chapitre `ch` (ou le premier suivant qui porte des ancres) reprend-il la numérotation à
 *  `folio` ou `folio + 1` ? `true` aussi quand plus aucun chapitre n'a d'ancre (fin de livre :
 *  rien ne contredit). PUR. */
function continues(chapterLines, ch, folio) {
  for (let c = ch; c < ch + 12; c++) {
    const lines = chapterLines(c)
    if (!lines) continue
    const anchors = folioAnchors(lines)
    if (!anchors.length) continue
    return anchors[0] === folio || anchors[0] === folio + 1
  }
  return true
}

/** Toute entrée d'un dataset qui porte À LA FOIS `source:{book,page}` et une citation à la ligne
 *  (`source.note` ou le champ `ref` frère). PUR (aucun disque) — `data` est le JSON déjà parsé.
 *  @param {unknown} data @param {string} file
 *  @returns {{file:string,id:string,book:string,page:number,cite:string}[]} */
export function citedEntries(data, file) {
  const out = []
  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`))
    if (!node || typeof node !== 'object') return
    const s = node.source
    if (s && typeof s === 'object' && !Array.isArray(s) && typeof s.book === 'string' && typeof s.page === 'number') {
      const cite = typeof s.note === 'string' ? s.note : typeof node.ref === 'string' ? node.ref : null
      if (cite) out.push({ file, id: typeof node.id === 'string' ? node.id : path || '(racine)', book: s.book, page: s.page, cite })
    }
    for (const [k, v] of Object.entries(node)) if (k !== 'source') walk(v, `${path}.${k}`)
  }
  walk(data, '')
  return out
}

/** Confronte les entrées à leur folio mesuré. `abbrOf(bookId)` donne l'abréviation du livre,
 *  `chapterLines(abbr, ch)` ses lignes (ou `null` : livre non extrait / chapitre absent).
 *  `ignored` rend la COUVERTURE du détecteur : chaque entrée non jugée y figure avec SON motif
 *  (`folioGoverningWhy`), pour être comptée et verrouillée plutôt que perdue en silence. PUR.
 *  @param {{file:string,id:string,book:string,page:number,cite:string}[]} entries
 *  @param {(bookId:string)=>string|undefined} abbrOf
 *  @param {(abbr:string,ch:number)=>string[]|null} chapterLines
 *  @returns {{scanned:number, violations:{key:string,file:string,id:string,cite:string,page:number,folio:number}[], ignored:{key:string,file:string,id:string,cite:string,page:number,reason:string}[]}} */
export function auditAlignment(entries, abbrOf, chapterLines) {
  const violations = []
  const ignored = []
  let scanned = 0
  for (const e of entries) {
    const key = `${e.file}#${e.id}`
    const parsed = parseLineCitation(e.cite)
    const abbr = abbrOf(e.book)
    // La citation doit désigner LE livre de l'ancre : une `note` qui renvoie à un AUTRE livre
    // (renvoi croisé) ne dit rien du folio déclaré ici.
    if (!parsed || !abbr || parsed.abbr.toUpperCase() !== abbr.toUpperCase()) {
      ignored.push({ key, file: e.file, id: e.id, cite: e.cite, page: e.page, reason: 'hors-forme' })
      continue
    }
    const { folio, reason } = folioGoverningWhy((ch) => chapterLines(abbr, ch), parsed.chapter, parsed.line)
    if (folio === null) {
      ignored.push({ key, file: e.file, id: e.id, cite: e.cite, page: e.page, reason })
      continue
    }
    scanned++
    if (folio !== e.page) violations.push({ key, file: e.file, id: e.id, cite: e.cite, page: e.page, folio })
  }
  return { scanned, violations, ignored }
}

/** Lecture disque des chapitres d'un livre (cache par (abbr, chapitre)). */
export function makeChapterReader(books) {
  const cache = new Map()
  return (abbr, ch) => {
    const key = `${abbr}|${ch}`
    if (cache.has(key)) return cache.get(key)
    const dir = livreDuSigle(abbr, books)?.dir
    let res = null
    if (dir) {
      const f = fichierDuChapitre(listerDossier(dir, { absent: 'vide' }), ch)
      if (f) res = readFileSync(join(dir, f), 'utf8').split('\n')
    }
    cache.set(key, res)
    return res
  }
}

/** Audit complet de `src/data/*.json` depuis le disque. @param {string} dataDir */
export function auditDataDir(dataDir) {
  const books = JSON.parse(readFileSync(join(dataDir, 'books.json'), 'utf8'))
  const chapterLines = makeChapterReader(books)
  const entries = []
  for (const f of listerDossier(dataDir).filter((x) => x.endsWith('.json'))) {
    let data
    try { data = JSON.parse(readFileSync(join(dataDir, f), 'utf8')) } catch { continue }
    entries.push(...citedEntries(data, f))
  }
  return auditAlignment(entries, (id) => sigleDe(id, books), chapterLines)
}
