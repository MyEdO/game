// Mécanique d'INTÉGRITÉ DU FOLIO (#536, suite #278/#281/#309). `sourceRefInline.mjs` garde la FORME
// de `sourceRefSchema`, `citationCoverage.mjs` la COUVERTURE (chaque entrée cite-t-elle une source ?) :
// aucun des deux ne vérifie que le folio déclaré POINTE SUR LA BONNE PAGE. Ce module le prouve, en
// croisant deux invariants déjà posés par le dépôt :
//   1. règle stricte 5 (CLAUDE.md) — une `desc` est un copié/collé VERBATIM de la source, donc elle
//      DOIT se retrouver telle quelle dans le `Source/` du livre déclaré ;
//   2. `source.page` est le folio IMPRIMÉ du livre — JAMAIS l'index de la ré-extraction Marker
//      (`sourceRefSchema`, `src/data/schemas/grammaire/valeurs.ts`) —, et l'extraction
//      Marker sème des marqueurs `<span data-folio="N">` au fil du texte.
// La `desc` sert donc de LOCALISATEUR : on la retrouve dans le livre, on relève l'encadrement
// `data-folio` de l'occurrence, on le compare au folio déclaré. Le défaut fondateur : `redoutable`
// (ZI) déclarait `page: 11` et `fouissement` `page: 13` pour un texte réellement en folio 134
// (même import `7924eb20`, migration `frenchy-*.json`).
//
// Module ESM pur, exécutable par `node` nu — consommé par `src/data/book-source-integrity.test.ts`
// (verrou cliquet) ET par `scripts/data/audit-folios.mjs` (rapport).
//
// DEUX voies de réfutation, indépendantes :
//   A. PAGE IMPOSSIBLE — le folio déclaré dépasse le dernier folio ATTESTÉ du livre (`bookMaxFolio` :
//      dernier marqueur `data-folio` ET dernière page citée par `00 - Index.md`). Aucun besoin de la
//      `desc` : cette voie couvre donc AUSSI les entrées dont la desc est introuvable/trop courte.
//   B. FOLIO ENCADRÉ — la `desc` est retrouvée verbatim et son encadrement `data-folio` exclut le
//      folio annoncé.
//
// PRUDENCE DÉLIBÉRÉE — hors de ces deux voies, le module ne REFUTE rien et se tait :
//   - `desc` introuvable verbatim → `desc-introuvable`, JAMAIS un verdict d'encadrement. Ce n'est pas
//     une absolution de la règle 5 : la recherche exacte reste bruitée (tableaux, colonnes recollées,
//     puces `•`/`-`), et un cliquet bâti sur ce signal figerait du bruit — cf. le faux ami
//     `reconcile` (157 dettes, CI verte). La règle 5 garde sa propre voie.
//   - encadrement à borne haute INCONNUE (aucun marqueur ne suit dans le chapitre — l'extraction est
//     CREUSE par endroits : `09 - Competences.md` n'a que 2 marqueurs (117, 118) pour les folios
//     117-131) → borne ouverte : tout folio ≥ borne basse ET ≤ `bookMaxFolio` reste irréfutable.
// Un écart de la voie B n'est donc jamais un artefact de découpage : il est encadré des DEUX côtés
// par des marqueurs qui, eux, sont ancrés dans le texte.
//
// COUVERTURE — ce que la garde NE voit PAS (dit sans détour, cf. l'en-tête de `folioRatchetStock.mjs`) :
// une entrée dont la desc est reformulée (donc introuvable) ou trop courte, et dont le folio faux
// reste DANS les bornes du livre, n'est réfutée par AUCUNE des deux voies. La voie A ne ferme que
// l'évasion « page hors du livre ».
//
// PÉRIMÈTRE ET ANGLE MORT, EN CHIFFRES — mesure du 2026-09-06 (`node scripts/data/audit-folios.mjs`
// pour cette voie, `folioLineAlign.auditDataDir` pour l'autre) :
//   • `src/data/*.json` porte 4516 entrées à `source:{book,page}`. 1223 d'entre elles citent AUSSI
//     une ligne ; `folio-line-align` n'en juge que 321 (902 écartées : 896 hors-forme, 6 queue-trouée),
//     soit 321/4516 = 7,1 % des folios vérifiés machine par cette voie-là. Chiffres CLIQUETÉS par
//     `src/data/folio-line-align.test.ts` (`SCANNED_MIN` / `SANS_CITATION_MAX`), plus seulement écrits.
//   • ce module scanne les entrées à `desc` citable et en laisse une part hors de tout verdict
//     d'encadrement (desc introuvable, trop courte, chapitre sans marqueur, livre hors Atlas). Ces
//     deux populations VIVENT avec le corpus : le PLAFOND fait foi, jamais un chiffre écrit ici —
//     c'est `folioRatchetStock.mjs` qui les tient, et `node scripts/data/audit-folios.mjs` qui les
//     mesure. Diagnostic DATÉ du 2026-09-06 : 2723 scannées, 1254 hors verdict (880 descs
//     introuvables, 140 trop courtes, 92 en chapitre sans marqueur, 142 en livre hors Atlas) —
//     re-mesure avant de citer, le tronc a déjà fait bouger le premier de ces deux nombres.
//   • `noteAuthored` — la sortie par note d'auteur, jamais cliquetée — est empruntée 1 fois
//     (`maladies.json:infection-du-sang` p.186).

import { readFileSync } from 'node:fs'
import { parUnitesDeCode, listerDossier } from './lister.mjs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REGISTRE_LIVRES, estLivreCitable, livreDuSigle, sigleDe, sourceDirOf } from '../../raw/_lib.mjs'
import { resoudreProse } from '../../source/resoudre.mjs'


const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** Longueur normalisée minimale d'une `desc` pour servir de localisateur : sous ce seuil, une
 *  chaîne courte se retrouve un peu partout dans un livre et l'encadrement ne prouve rien. */
export const MIN_DESC = 60

const DROP = new Set(['*', '_', '`'])

/**
 * Normalise pour un match VERBATIM tolérant au seul habillage (casse, apostrophes typographiques,
 * espaces insécables, emphase Markdown, retours à la ligne, `<br>` d'une cellule de table), et retourne la carte index→offset BRUT
 * qui permet de relocaliser l'occurrence dans le texte d'origine (donc entre ses marqueurs).
 * @param {string} s @returns {{ text: string, idx: number[] }}
 */
export function normMap(s) {
  const src = s.normalize('NFC')
  const out = []
  const idx = []
  let prevSpace = false
  for (let i = 0; i < src.length; i++) {
    let c = src[i]
    if (c === '’' || c === '‘') c = "'"
    if (c === ' ' || c === ' ') c = ' '
    if (c === '<' && src.startsWith('<br>', i)) { c = ' '; i += 3 }
    if (DROP.has(c)) continue
    if (/\s/.test(c)) {
      if (prevSpace) continue
      out.push(' ')
      idx.push(i)
      prevSpace = true
      continue
    }
    prevSpace = false
    out.push(c.toLowerCase())
    idx.push(i)
  }
  return { text: out.join(''), idx }
}

/** Pied de page IMPRIMÉ `N sur M` — seule graphie de folio de l'extraction `frenchy-bzh`, rendue aussi
 *  `sur N M` (`frenchy.bzh 16 l.185`) ; aucune extraction de l'Atlas n'en porte (mesuré le 2026-09-23). */
const PIED_DE_PAGE = /^[ \t]*(?:(\d+)[ \t]+sur|sur[ \t]+(\d+))[ \t]+(\d+)[ \t]*$/gm
/** Pied FUSIONNÉ à la dernière ligne d'une note (`frenchy.bzh 84` l.10 : « … tiltent… 620 sur  630 ») :
 *  admis seulement si son total `M` est celui d'un pied SEUL du même chapitre — une prose « 3 sur 10 »
 *  en fin de ligne n'est pas un folio. */
const PIED_FUSIONNE = /\S[ \t]+(\d+)[ \t]+sur[ \t]+(\d+)[ \t]*$/gm
/** Pied pris dans une RANGÉE de table (`frenchy.bzh 46` l.58 : `||||||sur<br>268<br>630||`) : même
 *  admission par le total `M` qu'un pied fusionné. */
const PIED_EN_CELLULE = /\|[ \t]*sur<br>(\d+)<br>(\d+)[ \t]*\|/g

/**
 * Marqueurs de DÉBUT de folio `[offset, folio]` d'un chapitre brut, triés par offset. Deux graphies :
 * `<span data-folio="N">` (Marker) OUVRE la page N ; un pied de page `N sur M` (seul, fusionné ou pris dans une rangée) la
 * CLÔT — le texte qui le précède est en folio N, celui qui le suit en N+1. Le DERNIER pied ferme sa page
 * (marqueur de même folio N à sa fin quand rien ne le suit) et la fin du chapitre ferme la page N+1
 * (marqueur de même folio à la fin du texte) : aucune plage n'est ouverte sur les folios suivants. Un
 * pied manquant laisse l'encadrement ouvert sur deux folios.
 * @param {string} raw @returns {[number, number][]}
 */
export function marqueursDeFolio(raw) {
  /** @type {[number, number][]} */
  const folios = []
  for (const m of raw.matchAll(/data-folio="(\d+)"/g)) folios.push([m.index ?? 0, Number(m[1])])
  const seuls = [...raw.matchAll(PIED_DE_PAGE)].map((m) => ({ fin: (m.index ?? 0) + m[0].length, n: Number(m[1] ?? m[2]), total: m[3] }))
  const totaux = new Set(seuls.map((p) => p.total))
  const fusionnes = [...raw.matchAll(PIED_FUSIONNE), ...raw.matchAll(PIED_EN_CELLULE)]
    .filter((m) => totaux.has(m[2]))
    .map((m) => ({ fin: (m.index ?? 0) + m[0].length, n: Number(m[1]) }))
  const pieds = [...seuls, ...fusionnes].sort((a, b) => a.fin - b.fin)
  if (pieds.length > 0) folios.push([0, pieds[0].n])
  for (const p of pieds) folios.push([p.fin, raw.slice(p.fin).trim() ? p.n + 1 : p.n])
  const dernier = pieds[pieds.length - 1]
  if (dernier && raw.slice(dernier.fin).trim()) folios.push([raw.length, dernier.n + 1])
  return folios.sort((a, b) => a[0] - b[0])
}

const CACHE = new Map()

/** Chapitres d'un livre (par abréviation `books.json`), normalisés + marqueurs de folio positionnés
 *  (`marqueursDeFolio`) + TITRES de section positionnés (localisateur de secours, voie C).
 *  @param {string} abbr @returns {{ file: string, text: string, idx: number[], folios: [number, number][], heads: [number, string][] }[]} */
export function bookDocs(abbr) {
  const hit = CACHE.get(abbr)
  if (hit) return hit
  const rel = sourceDirOf(livreDuSigle(abbr, REGISTRE_LIVRES, estLivreCitable))
  const docs = []
  if (rel) {
    const dir = join(ROOT, rel)
    for (const name of listerDossier(dir, { absent: 'vide' }).filter((f) => f.endsWith('.md'))) {
      const raw = readFileSync(join(dir, name), 'utf8')
      const { text, idx } = normMap(raw)
      const folios = marqueursDeFolio(raw)
      /** @type {[number, string][]} */
      const heads = []
      for (const m of raw.matchAll(/^#{1,6}[ \t]+(.+)$/gm)) heads.push([m.index ?? 0, m[1]])
      docs.push({ file: name, text, idx, folios, heads })
    }
  }
  CACHE.set(abbr, docs)
  return docs
}

/** Sentinelle de borne haute INCONNUE (extraction creuse : aucun marqueur ne suit dans le chapitre). */
export const OPEN = null

const MAX_CACHE = new Map()

/**
 * Dernier folio ATTESTÉ d'un livre — borne DURE de la voie A : un `source.page` au-delà ne désigne
 * aucune page existante, la desc n'a pas son mot à dire. Deux attestations, on retient la plus haute :
 *   - le plus grand marqueur `data-folio` de l'extraction ;
 *   - la plus grande page citée par `00 - Index.md`, dans ses DEUX formats : `— p. 94-98` (étendue de
 *     chapitre, ex. ADE II) et `— folio 25` (début de chapitre seul, ex. AA/ZI).
 * Prendre le MAX des deux est délibérément conservateur : sur les livres au format `— folio N`,
 * l'index ne borne que le DÉBUT du dernier chapitre, et l'extraction Marker peut laisser la queue du
 * livre sans marqueur — cette borne est alors un MINORANT du vrai dernier folio, jamais un majorant.
 * Elle ne réfute donc que ce qu'aucune des deux attestations ne couvre. Mesure à la pose : 0 entrée
 * légitime n'en est victime, les 15 réfutées le sont de 2 à 125 folios au-delà (ADE II, 98 pages).
 * @param {string} abbr @returns {number} 0 = livre sans attestation (aucune réfutation par cette voie)
 */
export function bookMaxFolio(abbr) {
  const hit = MAX_CACHE.get(abbr)
  if (hit !== undefined) return hit
  let max = 0
  for (const doc of bookDocs(abbr)) for (const [, f] of doc.folios) if (f > max) max = f
  const rel = sourceDirOf(livreDuSigle(abbr, REGISTRE_LIVRES, estLivreCitable))
  if (rel) {
    try {
      const t = readFileSync(join(ROOT, rel, '00 - Index.md'), 'utf8')
      for (const m of t.matchAll(/—\s*(?:p\.\s*(\d+)(?:\s*[-–]\s*(\d+))?|folio\s+(\d+))/g)) {
        const n = Number(m[2] ?? m[1] ?? m[3])
        if (n > max) max = n
      }
    } catch {
      /* pas d'index : les marqueurs seuls font la borne */
    }
  }
  MAX_CACHE.set(abbr, max)
  return max
}

/**
 * Folios possibles d'un extrait couvrant les offsets bruts `a..b` d'un chapitre.
 * @param {[number, number][]} folios @param {number} a @param {number} b
 * @returns {{ lo: number, hi: number | null } | null} `null` si aucun marqueur n'encadre l'extrait.
 */
export function folioRange(folios, a, b) {
  let before = null
  let after = null
  const inside = []
  for (const [off, n] of folios) {
    if (off <= a) before = n
    else if (off <= b) inside.push(n)
    else {
      after = n
      break
    }
  }
  if (before === null && inside.length === 0) return null
  const lo = before !== null ? before : inside[0]
  let hi
  if (inside.length > 0) hi = after !== null ? Math.max(inside[inside.length - 1], after - 1) : OPEN
  else hi = after !== null ? after - 1 : OPEN
  if (hi !== OPEN && hi < lo) hi = lo
  return { lo, hi }
}

/**
 * Verdict d'une entrée portant `source: {book, page}` + `desc`.
 * @param {{ book: string, page: number, desc: string }} entry
 * @returns {{ verdict: 'folio-ok'|'folio-ment'|'folio-impossible'|'desc-introuvable'|'livre-hors-atlas'|'desc-trop-courte'|'sans-marqueur', ranges?: {lo:number,hi:number|null,file:string}[], max?: number }}
 */
export function auditFolio({ book, page, desc }) {
  const abbr = sigleDe(book)
  if (!abbr) return { verdict: 'livre-hors-atlas' }
  const docs = bookDocs(abbr)
  if (docs.length === 0) return { verdict: 'livre-hors-atlas' }
  // Voie A AVANT la desc : une page hors du livre se réfute sans localisateur, ce qui couvre aussi
  // les entrées à desc trop courte ou introuvable.
  const max = bookMaxFolio(abbr)
  if (max > 0 && page > max) return { verdict: 'folio-impossible', max }
  const nd = normMap(desc).text
  if (nd.length < MIN_DESC) return { verdict: 'desc-trop-courte' }
  /** @type {{lo:number,hi:number|null,file:string}[]} */
  const ranges = []
  let found = false
  docs.forEach((doc, d) => {
    let from = 0
    for (;;) {
      const i = doc.text.indexOf(nd, from)
      if (i < 0) break
      found = true
      const a = doc.idx[i]
      const b = doc.idx[Math.min(i + nd.length - 1, doc.idx.length - 1)]
      const r = occurrenceRange(docs, d, a, b)
      if (r) ranges.push({ ...r, file: doc.file })
      from = i + 1
    }
  })
  if (!found) return { verdict: 'desc-introuvable' }
  if (ranges.length === 0) return { verdict: 'sans-marqueur' }
  // UNE occurrence encadrante suffit — non par confort, mais parce qu'une desc retrouvée SUR le folio
  // déclaré ne peut pas être dite mensongère : le texte y est. La contrepartie est que ce module ne
  // départage PAS deux occurrences : ce choix est une convention de citation, pas un fait réfutable —
  // `auditFolios` les SIGNALE (`multi`) pour arbitrage humain. Mesuré le 2026-09-23 (#1897) par
  // `auditFolios(src/data).multi` sur les 1783 entrées à desc située (`folio-ok` + `folio-ment`) :
  // 8 sont multi-occurrences.
  // 5 à folios DISTINCTS : `traits.json:fouissement` (23 et 134) et `traits.json:destabilisant`
  // (82 et 135), le ZI définissant chacun deux fois en toutes lettres, #563 ; `criticals.json:aa-corps-31`
  // (85 et 86), `aa-jambe-46` (85 et 86), `aa-jambe-66` (84 et 86). 3 au MÊME folio, sans choix à
  // faire : `mutations.json:tete-bestiale-taureau` (65+), `ship-stations.json:pont` (119),
  // `ship-stations.json:greement` (118).
  const ok = ranges.some(({ lo, hi }) => page >= lo && (hi === OPEN || page <= hi))
  return { verdict: ok ? 'folio-ok' : 'folio-ment', ranges }
}

// ============================================================================
// VOIE C — LOCALISATEUR DE SECOURS PAR TITRE DE SECTION (#1200)
// La voie B ne rend un verdict que si la `desc` se retrouve VERBATIM : 1003 des 2544 entrées citées
// restaient donc SANS verdict, en silence (779 desc introuvable + 135 desc trop courte + 89 chapitre
// sans marqueur) — dont les 7 folios faux de `psychology.json` (p.192 déclarée, texte en folio 190
// pour quatre entrées et 191 pour trois). Le titre de section est un second localisateur : il ne dépend
// pas de la règle 5, et il est ancré dans la même partition `data-folio`. Il ne REMPLACE pas la desc
// (une entrée dont la desc est reformulée reste une infraction à la règle 5) : il rend un verdict de
// FOLIO là où il n'y en avait aucun, et ce qu'il ne résout pas est COMPTÉ et LISTÉ, jamais tu.
//
// CE QUE LA VOIE C PROUVE, ET SES DEUX GARDE-FOUS. Retrouver `# **<Label>**` à un folio prouve
// « une section porte ce titre là », PAS « l'entrée est là » : un livre réemploie ses mots (`# **Mort**`
// du chapitre Traumatisme n'est pas le Domaine de la Mort). Sans garde-fou, la voie C accusait 25
// entrées sur la foi d'un homonyme distant de 15 à 257 folios, dont 10 pages PROUVÉES justes au
// Source. Une réfutation par titre exige donc les DEUX :
//   (a) le label est ABSENT du texte de la page DÉCLARÉE (`labelSurLaPage` : la tranche de folio, dans
//       tous les chapitres du livre) — s'il y est, la page est attestée et rien n'est réfuté ;
//   (b) l'écart au plus proche titre homonyme est ≤ `MAX_ECART_TITRE` — au-delà, l'homonymie est plus
//       probable que l'erreur de report, verdict `titre-homonyme-lointain`, aucune accusation.
// ============================================================================

/** Longueur normalisée minimale d'un label pour servir de localisateur par titre. */
export const MIN_TITLE = 3

/** Écart maximal, en folios, entre la page déclarée et le titre le plus proche pour que l'écart soit
 *  imputable à une ERREUR DE REPORT. Au-delà, l'homonymie explique mieux la distance : mesure à la
 *  pose (#1200) — les écarts imputables tiennent en ±5 folios, les 25 accusations abusives partaient
 *  de 15 et montaient à 257. */
export const MAX_ECART_TITRE = 10

/** Titre de section normalisé — les balises d'extraction sont retirées d'abord : Marker sème ses
 *  `<span data-folio="N">` AU MILIEU des titres (`# <span …>**MALADIES ET INFECTIONS**`).
 *  @param {string} title @returns {string} */
export function normHeading(title) {
  return normMap(title.replace(/<[^>]*>/g, ' ')).text.trim()
}

/**
 * Folios de la tête d'un chapitre, AVANT son premier marqueur : `folioRange` y rend `null` (aucun
 * marqueur n'encadre), or la page est connue par CONTINUITÉ — le chapitre précédent finit sur le
 * folio F, le premier marqueur d'ici ouvre le folio G, donc cette tête vit entre F et G-1. Sans cela
 * le titre `# **Peur (Indice)**` (l.23 de `21 - Psychologie.md`, avant le premier marqueur) resterait
 * sans verdict alors que la partition le situe sans ambiguïté en folio 190.
 * @param {{ folios: [number, number][] }[]} docs @param {number} i
 * @returns {{ lo: number, hi: number } | null} `null` = continuité non établie (rien à réfuter)
 */
export function preMarkerRange(docs, i) {
  const first = docs[i].folios[0]
  if (!first) return null
  const hi = first[1] - 1
  let lo = 0
  for (let j = i - 1; j >= 0; j--) {
    const f = docs[j].folios
    if (f.length > 0) {
      lo = f[f.length - 1][1]
      break
    }
  }
  if (lo === 0 || lo > hi) return null
  return { lo, hi }
}

/**
 * Plage de folios d'une occurrence `[a, b]` du document `docs[d]` : l'encadrement par marqueurs
 * (`folioRange`), sinon la continuité de tête de chapitre (`preMarkerRange`). Lecture UNIQUE des
 * trois voies — desc (`auditFolio`), titre (`auditFolioByTitle`), secondaire (`auditSecondaryRef`).
 * @param {{ folios: [number, number][] }[]} docs @param {number} d @param {number} a @param {number} b
 * @returns {{ lo: number, hi: number | null } | null}
 */
function occurrenceRange(docs, d, a, b) {
  return folioRange(docs[d].folios, a, b) ?? preMarkerRange(docs, d)
}

/** Premier index de `arr` (trié) dont la valeur est ≥ `v`. */
function lowerBound(arr, v) {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const m = (lo + hi) >> 1
    if (arr[m] < v) lo = m + 1
    else hi = m
  }
  return lo
}

/**
 * TRANCHES de texte normalisé qui composent un folio donné d'un livre : entre son marqueur et le
 * suivant, dans chaque chapitre qui le porte — plus la TÊTE d'un chapitre quand la continuité l'y
 * situe (`preMarkerRange`). Un folio peut avoir plusieurs tranches (chapitre qui s'ouvre en cours de
 * page). @param {string} abbr @param {number} page @returns {{ file: string, text: string }[]}
 */
export function pageSlices(abbr, page) {
  const docs = bookDocs(abbr)
  const out = []
  docs.forEach((doc, i) => {
    const f = doc.folios
    if (f.length === 0) return
    for (let k = 0; k < f.length; k++) {
      if (f[k][1] !== page) continue
      const a = lowerBound(doc.idx, f[k][0])
      const b = k + 1 < f.length ? lowerBound(doc.idx, f[k + 1][0]) : doc.text.length
      out.push({ file: doc.file, text: doc.text.slice(a, b) })
    }
    const tete = preMarkerRange(docs, i)
    if (tete && page >= tete.lo && page <= tete.hi) {
      out.push({ file: doc.file, text: doc.text.slice(0, lowerBound(doc.idx, f[0][0])) })
    }
  })
  return out
}

/**
 * ATTESTATION de la page déclarée : le `label` de l'entrée se lit-il quelque part DANS le folio
 * annoncé (pas seulement en titre — une ligne de table, une mention en prose suffisent) ? C'est le
 * garde-fou (a) de la voie C : tant que le livre nomme l'entrée là où la donnée le dit, aucun titre
 * homonyme trouvé ailleurs ne peut la contredire. Mesuré à la pose : 10 des 25 accusations lointaines
 * portaient sur une page ainsi attestée (`naval-ports` ×8 au folio 138 de `15 - Longs voyages.md`,
 * `sea-events:debris-marins` au 132, `spells:enchevetrement` au 244).
 * @param {string} book @param {number} page @param {string | undefined} label
 * @returns {string | null} `<chapitre> folio N` si attesté, `null` sinon
 */
export function labelSurLaPage(book, page, label) {
  const abbr = sigleDe(book)
  if (!abbr) return null
  const nl = typeof label === 'string' ? normHeading(label) : ''
  if (nl.length < MIN_TITLE) return null
  for (const s of pageSlices(abbr, page)) if (s.text.includes(nl)) return `${s.file} folio ${page}`
  return null
}

/**
 * Verdict de folio par TITRE de section (voie C) — appelé quand la desc n'a rien pu localiser.
 * Le titre doit correspondre EXACTEMENT au `label` (ou au `label` suivi d'un paramètre parenthésé,
 * forme du LDB : `# **Animosité (Cible)**`, `# **Peur (Indice)**`) : l'égalité stricte évite qu'un
 * label court s'accroche à un titre qui le contient.
 * Trois issues quand aucun titre ne couvre la page déclarée, cf. les garde-fous (a) et (b) en tête de
 * section : page ATTESTÉE par le label (`titre-page-attestee`), écart trop grand pour une erreur de
 * report (`titre-homonyme-lointain`), sinon seulement `titre-ment`. Les deux premières n'accusent
 * personne et rejoignent les irrésolues. `ecart` = distance en folios au titre le plus proche,
 * `proche` = ce titre (diagnostic : ce qui est prouvé est « un homonyme est là », jamais « l'entrée
 * est là »).
 * @param {{ book: string, page: number, label: string | undefined }} entry
 * @returns {{ verdict: 'titre-ok'|'titre-ment'|'titre-page-attestee'|'titre-homonyme-lointain'|'titre-introuvable'|'titre-sans-marqueur'|'titre-trop-court'|'livre-hors-atlas', ranges?: {lo:number,hi:number|null,file:string}[], ecart?: number, proche?: {lo:number,hi:number|null,file:string}, atteste?: string }}
 */
export function auditFolioByTitle({ book, page, label }) {
  const abbr = sigleDe(book)
  if (!abbr) return { verdict: 'livre-hors-atlas' }
  const docs = bookDocs(abbr)
  if (docs.length === 0) return { verdict: 'livre-hors-atlas' }
  const nl = typeof label === 'string' ? normHeading(label) : ''
  if (nl.length < MIN_TITLE) return { verdict: 'titre-trop-court' }
  /** @type {{lo:number,hi:number|null,file:string}[]} */
  const ranges = []
  let found = false
  docs.forEach((doc, i) => {
    for (const [off, title] of doc.heads) {
      const nt = normHeading(title)
      if (nt !== nl && !nt.startsWith(`${nl} (`)) continue
      found = true
      const r = occurrenceRange(docs, i, off, off + title.length)
      if (r) ranges.push({ lo: r.lo, hi: r.hi, file: doc.file })
    }
  })
  if (!found) return { verdict: 'titre-introuvable' }
  if (ranges.length === 0) return { verdict: 'titre-sans-marqueur' }
  if (ranges.some(({ lo, hi }) => page >= lo && (hi === OPEN || page <= hi))) return { verdict: 'titre-ok', ranges }
  const dist = (r) => Math.min(Math.abs(page - r.lo), Math.abs(page - (r.hi ?? r.lo)))
  const proche = ranges.reduce((a, b) => (dist(b) < dist(a) ? b : a))
  const ecart = dist(proche)
  const atteste = labelSurLaPage(book, page, label)
  if (atteste) return { verdict: 'titre-page-attestee', ranges, ecart, proche, atteste }
  if (ecart > MAX_ECART_TITRE) return { verdict: 'titre-homonyme-lointain', ranges, ecart, proche }
  return { verdict: 'titre-ment', ranges, ecart, proche }
}

/** Entrées d'un dataset portant `source.book` + `source.page` + `desc`, à TOUTE profondeur : la moitié
 *  des datasets n'est pas un tableau racine (`criticals.json` groupe par localisation, `sea-events.json`
 *  par rubrique…) — s'arrêter au 1er niveau laissait 180 entrées citées hors de tout scan.
 *  Clé = `id` STABLE quand il existe (0 collision mesurée sur les 2082 entrées), sinon le chemin JSON
 *  des 16 entrées anonymes — jamais un libellé (doctrine 2026-07-09).
 *  Le `label` accompagne l'entrée (localisateur de secours, voie C) — jamais une clé de logique, et
 *  la `note` authored de `source` (l'auteur y a déjà dit ce qu'il savait de l'emplacement).
 *
 *  PROSE ADRESSÉE (#1389, épique #1388) : une entrée qui porte `descRef` au lieu de `desc` entre au
 *  MÊME dénominateur, avec le texte que son adresse RÉSOUT — la preuve de folio se fait sur le texte
 *  résolu, `auditFolio` ne voit aucune différence. `resoudreProse` est FAIL-CLOSED : une adresse morte
 *  ou une empreinte divergente LÈVE ici aussi, plutôt que de retirer l'entrée de l'audit en silence.
 *  @param {unknown} data @returns {{ id: string, book: string, page: number, desc: string, label: string | undefined, note: string | undefined }[]} */
export function citedEntriesOf(data) {
  /** @type {{ id: string, book: string, page: number, desc: string, label: string | undefined, note: string | undefined }[]} */
  const out = []
  /** @param {unknown} node @param {string} path */
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach((x, i) => walk(x, `${path}[${i}]`))
      return
    }
    const rec = /** @type {Record<string, unknown>} */ (node)
    const src = rec.source
    if (src && typeof src === 'object' && !Array.isArray(src)) {
      const s = /** @type {Record<string, unknown>} */ (src)
      const cite = typeof s.book === 'string' && typeof s.page === 'number'
      const prose = !cite
        ? null
        : typeof rec.desc === 'string'
          ? rec.desc
          : rec.descRef !== undefined
            ? resoudreProse(rec).md
            : null
      if (cite && prose !== null) {
        out.push({
          id: typeof rec.id === 'string' ? rec.id : path || '?',
          book: s.book,
          page: s.page,
          desc: prose,
          label: typeof rec.label === 'string' ? rec.label : undefined,
          note: typeof s.note === 'string' ? s.note : undefined,
        })
      }
    }
    for (const [k, v] of Object.entries(rec)) {
      if (k === 'source') continue
      walk(v, path ? `${path}.${k}` : k)
    }
  }
  walk(data, '')
  return out
}

/**
 * Emplacements SECONDAIRES (`alsoIn[]`, #563 Lot 1 item 2) d'un dataset, à TOUTE profondeur — même
 * patron de walk que `citedEntriesOf`. Chaque item porte `label` (celui de l'entrée PORTEUSE, pour
 * l'attestation POSITIVE) et `quote` (auto-attestation authorée propre à CET emplacement).
 * @param {unknown} data @returns {{ key: string, book: string, page: number, label: string | undefined, quote: string | undefined }[]} */
export function secondaryEntriesOf(data) {
  /** @type {{ key: string, book: string, page: number, label: string | undefined, quote: string | undefined }[]} */
  const out = []
  /** @param {unknown} node @param {string} path */
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach((x, i) => walk(x, `${path}[${i}]`))
      return
    }
    const rec = /** @type {Record<string, unknown>} */ (node)
    const also = rec.alsoIn
    if (Array.isArray(also)) {
      const ownerId = typeof rec.id === 'string' ? rec.id : path || '?'
      const ownerLabel = typeof rec.label === 'string' ? rec.label : undefined
      also.forEach((ref, i) => {
        if (!ref || typeof ref !== 'object' || Array.isArray(ref)) return
        const r = /** @type {Record<string, unknown>} */ (ref)
        if (typeof r.book === 'string' && typeof r.page === 'number') {
          out.push({
            key: `${ownerId}.alsoIn[${i}]`,
            book: r.book,
            page: r.page,
            label: ownerLabel,
            quote: typeof r.quote === 'string' ? r.quote : undefined,
          })
        }
      })
    }
    for (const [k, v] of Object.entries(rec)) {
      if (k === 'source' || k === 'alsoIn') continue
      walk(v, path ? `${path}.${k}` : k)
    }
  }
  walk(data, '')
  return out
}

/**
 * Verdict d'attestation POSITIVE d'un emplacement SECONDAIRE (#563 Lot 1 item 2) : la CHARGE de la
 * preuve est sur l'auteur (comme la règle 5 pour `desc`) — pas d'attestation = REFUSÉ, jamais une
 * réfutation par absence. Deux preuves possibles, cherchées dans le SPAN du folio DÉCLARÉ (jamais
 * n'importe où dans le livre, contrairement à `auditFolio` qui cherche la desc PUIS vérifie le
 * folio) : le `label` de l'entrée porteuse, ou le `quote` authoré (cas d'une table qui n'imprime pas
 * le `label` — ex. `zweihander-flamberge`).
 * @param {{ book: string, page: number, label: string | undefined, quote: string | undefined }} entry
 * @returns {{ verdict: 'attesté'|'non-attesté'|'folio-impossible'|'livre-hors-atlas', via?: 'label'|'quote', max?: number }}
 */
export function auditSecondaryRef({ book, page, label, quote }) {
  const abbr = sigleDe(book, REGISTRE_LIVRES, estLivreCitable)
  if (!abbr) return { verdict: 'livre-hors-atlas' }
  const docs = bookDocs(abbr)
  if (docs.length === 0) return { verdict: 'livre-hors-atlas' }
  const max = bookMaxFolio(abbr)
  if (max > 0 && page > max) return { verdict: 'folio-impossible', max }
  /** @type {[string, 'label'|'quote'][]} */
  const candidates = []
  if (typeof quote === 'string' && quote.trim().length > 0) candidates.push([quote, 'quote'])
  if (typeof label === 'string' && label.trim().length > 0) candidates.push([label, 'label'])
  for (const [needle, via] of candidates) {
    const nd = normMap(needle).text
    if (!nd) continue
    for (const [d, doc] of docs.entries()) {
      let from = 0
      for (;;) {
        const i = doc.text.indexOf(nd, from)
        if (i < 0) break
        const a = doc.idx[i]
        const b = doc.idx[Math.min(i + nd.length - 1, doc.idx.length - 1)]
        const r = occurrenceRange(docs, d, a, b)
        if (r && page >= r.lo && (r.hi === OPEN || page <= r.hi)) return { verdict: 'attesté', via }
        from = i + 1
      }
    }
  }
  return { verdict: 'non-attesté' }
}

/**
 * Scanne `src/data/*.json` pour les emplacements SECONDAIRES (`alsoIn[]`) et rend ceux REFUSÉS
 * (folio hors livre, ou ni label ni quote attesté dans le span déclaré).
 * @param {string} dataDir
 * @returns {{ violations: {key:string,file:string,book:string,page:number,verdict:'non-attesté'|'folio-impossible',max?:number}[], total: number }}
 */
export function auditSecondaries(dataDir) {
  const violations = []
  let total = 0
  const files = listerDossier(dataDir).filter((f) => f.endsWith('.json') && f !== 'books.json')
  for (const f of files) {
    let data
    try {
      data = JSON.parse(readFileSync(join(dataDir, f), 'utf8'))
    } catch {
      continue
    }
    for (const e of secondaryEntriesOf(data)) {
      total++
      const r = auditSecondaryRef(e)
      if (r.verdict === 'non-attesté' || r.verdict === 'folio-impossible') {
        violations.push({ key: `${f}:${e.key}`, file: f, book: e.book, page: e.page, verdict: r.verdict, max: r.max })
      }
    }
  }
  return { violations, total }
}

/**
 * Scanne `src/data/*.json` et rend les entrées dont le folio est RÉFUTÉ (par l'une ou l'autre voie),
 * le décompte par verdict, le TOTAL scanné (`stats` en somme — aucune catégorie n'est retranchée du
 * rapport), et les entrées MULTI-occurrences à arbitrer.
 * Quand la desc ne localise rien, la voie C (TITRE de section) reprend la main : ses réfutations
 * sortent à part (`titleViolations`, stock propre) et ce qu'elle ne résout pas non plus sort dans
 * `unresolved` — le silence de la voie B devient un skip BRUYANT. `livre-hors-atlas` (aucune
 * extraction FR) n'entre dans aucune des deux listes : il n'y a rien à mesurer, `stats` le dit.
 * Une entrée réfutée par le titre mais porteuse d'une `source.note` AUTHORÉE sort dans `noteAuthored`,
 * jamais dans le stock : l'auteur a déjà décrit l'emplacement (« section continue p.186-188 »…), la
 * contradiction se tranche par un arbitrage humain, pas par un cliquet qui la fige.
 * @param {string} dataDir
 * @returns {{ violations: {key:string,file:string,id:string,book:string,page:number,voie:'encadrement'|'hors-livre',ranges:{lo:number,hi:number|null,file:string}[],max:number|null}[], titleViolations: {key:string,file:string,id:string,book:string,page:number,ecart:number,proche:{lo:number,hi:number|null,file:string}|null,ranges:{lo:number,hi:number|null,file:string}[]}[], noteAuthored: {key:string,file:string,page:number,note:string,proche:{lo:number,hi:number|null,file:string}|null}[], unresolved: {key:string,file:string,page:number,descVerdict:string,titreVerdict:string}[], stats: Record<string, number>, total: number, multi: {key:string,page:number,ranges:{lo:number,hi:number|null,file:string}[]}[] }}
 */
export function auditFolios(dataDir) {
  /** @type {Record<string, number>} */
  const stats = {}
  const violations = []
  const titleViolations = []
  const noteAuthored = []
  const unresolved = []
  const multi = []
  let total = 0
  const files = listerDossier(dataDir).filter((f) => f.endsWith('.json') && f !== 'books.json')
  for (const f of files) {
    let data
    try {
      data = JSON.parse(readFileSync(join(dataDir, f), 'utf8'))
    } catch {
      continue
    }
    for (const e of citedEntriesOf(data)) {
      total++
      const r = auditFolio(e)
      stats[r.verdict] = (stats[r.verdict] ?? 0) + 1
      const key = `${f}:${e.id}`
      if ((r.ranges?.length ?? 0) > 1) multi.push({ key, page: e.page, ranges: r.ranges ?? [] })
      if (r.verdict === 'folio-ment' || r.verdict === 'folio-impossible') {
        violations.push({
          key,
          file: f,
          id: e.id,
          book: e.book,
          page: e.page,
          voie: r.verdict === 'folio-impossible' ? 'hors-livre' : 'encadrement',
          ranges: r.ranges ?? [],
          max: r.max ?? null,
        })
      }
      if (r.verdict === 'desc-introuvable' || r.verdict === 'desc-trop-courte' || r.verdict === 'sans-marqueur') {
        const t = auditFolioByTitle(e)
        stats[`titre:${t.verdict}`] = (stats[`titre:${t.verdict}`] ?? 0) + 1
        if (t.verdict === 'titre-ment' && e.note) {
          stats['titre:note-authoree'] = (stats['titre:note-authoree'] ?? 0) + 1
          noteAuthored.push({ key, file: f, page: e.page, note: e.note, proche: t.proche ?? null })
        } else if (t.verdict === 'titre-ment') {
          titleViolations.push({
            key,
            file: f,
            id: e.id,
            book: e.book,
            page: e.page,
            ecart: t.ecart ?? 0,
            proche: t.proche ?? null,
            ranges: t.ranges ?? [],
          })
        } else if (t.verdict !== 'titre-ok') {
          unresolved.push({ key, file: f, page: e.page, descVerdict: r.verdict, titreVerdict: t.verdict })
        }
      }
    }
  }
  return { violations, titleViolations, noteAuthored, unresolved, stats, total, multi }
}

/**
 * Rend le TEXTE de `folioRatchetStock.mjs` depuis une mesure. SOURCE UNIQUE du format du stock : le
 * solde d'une clé se fait en corrigeant le folio au Source puis en RE-RENDANT, jamais en recopiant une
 * ligne à la main. `scripts/data/audit-folios.mjs --stock` refuse d'écrire un stock plus GRAND que
 * l'actuel : l'outil ne peut que solder ; faire croître le stock reste un geste manuel, donc visible.
 * @param {ReturnType<typeof auditFolios>['violations']} violations @param {string} entete
 * @returns {string}
 */
export function renderStock(violations, entete) {
  const lignes = []
  let fichier = null
  for (const v of [...violations].sort((a, b) => parUnitesDeCode(a.key, b.key))) {
    if (v.file !== fichier) {
      fichier = v.file
      lignes.push(`  // ${fichier}`)
    }
    const reel =
      v.voie === 'hors-livre'
        ? `hors livre (dernier folio ${v.max})`
        : v.ranges.map((r) => (r.hi === null ? `${r.lo}+` : r.lo === r.hi ? `${r.lo}` : `${r.lo}-${r.hi}`)).join(',')
    lignes.push(`  '${v.key}', // p.${v.page} -> ${reel}`)
  }
  return `${entete}\n/** @type {ReadonlySet<string>} */\nexport const FOLIO_RATCHET = new Set([\n${lignes.join('\n')}\n])\n`
}

/**
 * Même office pour le stock de la voie C (`folioTitleRatchetStock.mjs`) : le format des deux stocks
 * vit dans ce module, jamais dans une ligne recopiée à la main. Le diagnostic dit ce qui est PROUVÉ —
 * « un titre homonyme est à tel folio » — jamais un emplacement réel que la voie C n'a pas établi.
 * @param {ReturnType<typeof auditFolios>['titleViolations']} violations @param {string} entete
 * @returns {string}
 */
export function renderTitleStock(violations, entete) {
  const lignes = []
  let fichier = null
  for (const v of [...violations].sort((a, b) => parUnitesDeCode(a.key, b.key))) {
    if (v.file !== fichier) {
      fichier = v.file
      lignes.push(`  // ${fichier}`)
    }
    const r = v.proche ?? v.ranges[0]
    const folio = r ? (r.hi === null ? `${r.lo}+` : r.lo === r.hi ? `${r.lo}` : `${r.lo}-${r.hi}`) : '?'
    lignes.push(`  '${v.key}', // p.${v.page} -> titre le plus proche : folio ${folio} (${r?.file ?? '?'}), écart ${v.ecart}`)
  }
  return `${entete}\n/** @type {ReadonlySet<string>} */\nexport const FOLIO_TITLE_RATCHET = new Set([\n${lignes.join('\n')}\n])\n`
}

export { basename }
