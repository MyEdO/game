// Ré-ancrage des citations de l'Atlas RAW — garde déterministe rejouable.
// Pour chaque réf `<ABRÉV> NN l.X[-Y]` ATTACHÉE à une citation verbatim « … », on relocalise la
// citation par MATCH EXACT (normalisé, accents conservés) dans le `.md` source courant, et on
// vérifie/répare le numéro de ligne (une ré-extraction Marker fait dériver les lignes). La réf est
// attachée APRÈS la citation (`« … » LDB 6 l.5`) ou EN TÊTE (`(l.24) : « … »`, `citationsEnTete`, #2199).
//   node scripts/raw/reanchor.mjs            → rapport + GATE (exit 1 sur dérive/ambigu/hausse ❌)
//   node scripts/raw/reanchor.mjs --apply    → réécrit dans les fiches les dérives HIGH (citation unique)
//   node scripts/raw/reanchor.mjs --check    → même GATE, puis comparaison du rapport au disque
//     (refusé avec `--apply`/`--remap`, qui réécrivent les FICHES et, pour `--remap`, les réfs des
//     racines citantes `RACINES_CITANTES` : `src`, `projets`, dossiers de fiches des projets). Le rapport décrit les fiches TELLES
//     QUE LE DISQUE LES PORTE : après `--apply`/`--remap`, il se rend d'un balayage de plus, sans mode.
// ✅ ligne juste · 🔧 dérive HIGH (auto) · 🟡 ambigu (MEDIUM, manuel) · ❌ introuvable (LOW) ·
// ➖ synthèse (réf sans citation).
// GATE (#434, « une réf verte peut pointer sur le mauvais texte ») : le script BLOQUE sur ses propres
// verdicts :
//   - 🔧 DRIFT : une dérive de fiche se corrige avec --apply. Pour un catalogue, la correction se
//     fait dans sa source. Toute dérive restante rend le rapport périmé.
//   - 🟡 MEDIUM : zéro tolérance, jamais d'auto-résolution — le candidat le plus proche d'une
//     citation ambiguë n'est pas forcément le texte cité.
//   - ❌ LOW : la réf MENT (citation introuvable à la ligne annoncée) — cliquet NOMINATIF PAR SITE
//     (`scripts/raw/reanchor-low-stock.json`, écart `ecartDuVolet` de `scripts/guards/lib/stock.mjs`, clé
//     `fiche :: réf citée :: occurrence`) : un site NEUF est une régression à corriger ou à déclarer,
//     une entrée dont le site a disparu est une dette SOLDÉE à retirer. L'entrée nomme sa fiche
//     `docs/raw/<x>.md` : l'ajouter est une croissance que la porte de plage compte (#1898). Soldé,
//     le stock est un fichier ABSENT, lu comme zéro entrée (`lireEntreesDeSite`) : tolérance ZÉRO.
//     Il se régénère par `npx tsx scripts/guards/lib/regenStock.mts scripts/raw/reanchor.mjs` ; un
//     site différé y entre par `--lot <#N>`, et un solde total retire le fichier.
//   - ⛔ PAST-EOF (hors-fichier) : NE PAS doubler — déjà cliqueté par `check-refs.mjs`
//     (`dead-refs-stock.json`), sur la borne HAUTE dépliée d'une plage (`span`), un sur-ensemble
//     de la borne de départ vérifiée ici.
import { sousLEpoque } from '../docs/lib/ecrivain-derives.mjs'
import { ecrireTexteAtomique } from '../guards/lib/ecritureJsonAtomique.mjs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BOOKS,
  SUFFIXE_DE_LIGNE,
  allAbbrAlternation,
  bookOf,
  chapterFile,
  livreDuSigle,
  normalize,
  refRe as refReDesCitants,
  ELLIPSIS_SENTINEL as SENT,
  readText,
} from './_lib.mjs'
import { RACINES_CITANTES, fichiersCitants } from './lib/fichiersCitants.mjs'
import { pagesDeLAtlasRendues } from './build-catalogs.mjs'
import { graphieDuFichier } from '../../src/data/source/decoupe.ts'
import { sansBr } from '../../src/data/source/normalize.ts'
import { ecartDuVolet } from '../guards/lib/stock.mjs'
import { SOUS_LOT, lireEntreesDeSite } from '../guards/lib/stockDeSites.mjs'
import { lancerDepuisCLI } from '../docs/lib/ecriture-derives.mjs'
import { carteDuFichier, destinEnTexte } from './lib/carte-lignes.mjs'
import { coupeAuMot } from '../../src/lib/coupeAuMot.mjs'
import { parUnitesDeCode } from '../../src/lib/ordre.mjs'
import { alternationDe } from '../../src/lib/regex.ts'
import { exigerRacineAtlas } from './lib/entree-atlas.mjs'

// --remap : ré-ancre les réfs de SYNTHÈSE (sans citation) de l'Atlas, les réfs du CODE (`RACINES_CITANTES`,
// `remapperLesCitants`) et leurs CONTINUATIONS nues par la carte de lignes EXACTE `git HEAD` → arbre
// de travail (`lib/carte-lignes.mjs`). Migration ONE-SHOT à lancer AVANT de committer la Source (une fois committée, HEAD == arbre → carte identité → no-op).
// Une réf dont la ligne est supprimée ou tombe dans un hunk ambigu est RAPPORTÉE, jamais réécrite.
const MIN_QUOTE_LEN = 24   // ancre verbatim < 24 car. → trop générique, on n'ancre pas
export const RAWDIR = 'docs/raw'
export const LOW_STOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'reanchor-low-stock.json')
/** Les sites LOW nomment la fiche depuis la racine du dépôt et la réf citée telle qu'écrite (`full`).
 * @param {readonly (Pick<import('../guards/lib/stock.mjs').Site, 'fichier'> & { full: string })[]} lowRows
 * @returns {import('../guards/lib/stock.mjs').Site[]}
 */
export const sitesLow = (lowRows) => lowRows.map(({ fichier, full }) => ({ fichier, ref: full }))
const QUOI =
  'Réfs FAUSSES (❌ LOW) de l’Atlas RAW (`scripts/raw/reanchor.mjs`, #434) : une citation verbatim ' +
  '« … » introuvable à la ligne que sa réf `<ABRÉV> NN l.X` annonce. Une ENTRÉE par SITE, clé ' +
  '`fichier :: ref :: occurrence` (régime #1711) ; `fichier` = la fiche `docs/raw/<x>.md` où la réf ' +
  'est lue, `ref` = la réf citée telle qu’écrite. Une entrée se solde en lisant le `Source/` et en ' +
  'réancrant la réf (ou la citation) ; le fichier se régénère par ' +
  '`npx tsx scripts/guards/lib/regenStock.mts scripts/raw/reanchor.mjs`, et un solde total le retire.'
// Acceptation DÉCLARÉE à la couture : fiches de DOMAINE et catalogues SEULS. Les rapports générés,
// les pages d'AUTEUR (index, conventions) et les épreuves DATÉES portent des réfs ILLUSTRATIVES,
// jamais des citations vivantes à ré-ancrer.
export const CLASSES = ['fiche', 'catalogue']

// Réf de chapitre `<ABRÉV> NN l.X[-Y][+n]` sur `allAbbrAlternation` (`_lib.mjs`) : capture sigle,
// chapitre, ligne et suffixe.
const ABBR_ALT = allAbbrAlternation()
const refRe = () => new RegExp(`\\b(${ABBR_ALT}) (\\d+) l\\.(\\d+)((?:[-+]\\d+)*)`, 'g')

// ---------- index ligne↔offset d'un chapitre source ----------
// `buildIndex` est PUR (aucun accès fichier) — testable en fixture. `lineIndex` l'enrobe de la
// résolution réelle (`chapterFile`) + d'un cache par chapitre.
export function buildIndex(rawLines) {
  const lineStartOffset = []
  let joined = ''
  for (let i = 0; i < rawLines.length; i++) {
    lineStartOffset.push(joined.length)
    joined += normalize(sansBr(rawLines[i]))
    if (i < rawLines.length - 1) joined += ' '   // le saut de ligne se replie en un espace
  }
  return { joined, lineStartOffset, count: rawLines.length }
}
const idxCache = new Map()
function lineIndex(abbr, ch) {
  const cf = chapterFile(abbr, ch)
  if (!cf) return null
  if (idxCache.has(cf.path)) return idxCache.get(cf.path)
  const res = { ...buildIndex(readText(cf.path).split('\n')), file: cf.file }
  idxCache.set(cf.path, res)
  return res
}
export function offsetToLine(off, lso) {
  let lo = 0, hi = lso.length - 1, ans = 0
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (lso[mid] <= off) { ans = mid; lo = mid + 1 } else hi = mid - 1 }
  return ans + 1   // 1-based : rawLines[X-1] est cité l.X
}
function allOccurrences(hay, needle) {
  const out = []; if (!needle) return out
  let i = hay.indexOf(needle)
  while (i !== -1) { out.push(i); i = hay.indexOf(needle, i + 1) }
  return out
}

// ---------- carte de lignes HEAD → arbre (pour --remap) ----------
// Carte d'un chapitre, ou `null` s'il n'a pas de fichier ou est absent de `HEAD`. Cache par chemin.
const mapCache = new Map()
export function carteDuChapitre(abbr, ch) {
  const cf = chapterFile(abbr, ch)
  if (!cf) return null
  if (!mapCache.has(cf.path)) mapCache.set(cf.path, carteDuFichier(`${cf.dir}/${cf.file}`)?.carte ?? null)
  return mapCache.get(cf.path)
}

// Nouveau libellé `l.X[-Y|+n|/n]…` d'une réf par la carte, ou la RAISON pour laquelle elle ne se
// remappe pas. Chaque numéro du suffixe est une ligne (`refNums` de `_lib.mjs`) et se remappe.
export function remapperRef(carte, depart, suffix = '') {
  const d = carte(depart)
  if (!('ligne' in d)) return { raison: `l.${depart} : ${destinEnTexte(d)}` }
  let texte = `l.${d.ligne}`, change = d.ligne !== depart
  for (const [, sep, n] of suffix.matchAll(/([-+/])(\d+)/g)) {
    const f = carte(Number(n))
    if (!('ligne' in f)) return { raison: `l.${n} (${sep === '-' ? 'fin de plage' : 'ligne citée'}) : ${destinEnTexte(f)}` }
    texte += `${sep}${f.ligne}`
    change ||= f.ligne !== Number(n)
  }
  return { texte, change }
}

const SUFFIXE_DE_REF_RE = new RegExp(`l\\.\\d+${SUFFIXE_DE_LIGNE}$`)

/**
 * `--remap` sur les réfs du CODE (`RACINES_CITANTES`) : chaque réf `<ABRÉV> NN l.X…` et ses continuations
 * nues se portent par la carte de leur chapitre, réécrites en place ; une réf que la carte ne porte pas
 * est RAPPORTÉE avec son site, jamais réécrite. Une réf de code ne cite pas de verbatim : le diff seul
 * la porte. `{ remappees, nonRemappees: [{ doc, ligne, full, detail }] }`.
 */
export function remapperLesCitants({ racines = RACINES_CITANTES, carteDe = carteDuChapitre } = {}) {
  let remappees = 0
  const nonRemappees = []
  for (const fichier of fichiersCitants(racines)) {
    const texte = readFileSync(fichier, 'utf8')
    if (!texte.includes(' l.')) continue
    const doc = fichier.split('\\').join('/')
    let modifie = false
    const lignes = texte.split('\n').map((ligne, i) => {
      const sites = [...ligne.matchAll(refReDesCitants())]
        .filter((m) => m[2] != null && bookOf(m[1]))
        .map((m) => ({ index: m.index, full: m[0], abbr: bookOf(m[1]), ch: m[2], depart: Number(m[3]), suffix: m[4] }))
      sites.push(...continuations(ligne))
      let out = ligne
      for (const s of sites.sort((a, b) => b.index - a.index)) {
        const r = porterSite(s, carteDe)
        if (r.raison) { nonRemappees.push({ doc, ligne: i + 1, full: s.full, detail: r.raison }); continue }
        if (!r.change) continue
        out = out.slice(0, s.index) + s.full.replace(SUFFIXE_DE_REF_RE, r.texte) + out.slice(s.index + s.full.length)
        remappees++
        modifie = true
      }
      return out
    })
    if (modifie) ecrireTexteAtomique(fichier, lignes.join('\n'))
  }
  return { remappees, nonRemappees: nonRemappees.sort((a, b) => parUnitesDeCode(a.doc, b.doc) || a.ligne - b.ligne) }
}

// Porte un site par la carte de son chapitre : `{ texte, change }`, ou la RAISON de le rapporter. Un site au
// rattachement INCERTAIN (`candidats`) n'est jamais réécrit : rapporté dès qu'un chapitre candidat bouge
// sous lui, laissé tel quel sinon.
export function porterSite(s, carteDe) {
  if (s.candidats) {
    const bouge = s.candidats.some(({ abbr, ch }) => {
      const carte = carteDe(abbr, ch)
      const r = carte && remapperRef(carte, s.depart, s.suffix || '')
      return r && (r.raison || r.change)
    })
    return bouge ? { raison: `rattachement incertain (${s.candidats.map(({ abbr, ch }) => `${abbr} ${ch}`).join(' ou ')})` } : { change: false }
  }
  const carte = carteDe(s.abbr, s.ch)
  return carte ? remapperRef(carte, s.depart, s.suffix || '')
    : { raison: chapterFile(s.abbr, s.ch) ? 'chapitre absent de HEAD' : 'chapitre introuvable' }
}

// Écart entre l'hôte et un `l.N` nu : sans chiffre ni source nommée, la continuation hérite de l'hôte ;
// la forme multi-chapitres `/NN l.` (`_lib.mjs` refReDe) change son chapitre. Tout autre chiffre (`; 14 `,
// `App.2 `, `Nain 30, `, `–18, `) et toute SOURCE nommée (sigle de `BOOKS`, dossier `Source/<livre>/`,
// `VO`) rendent le rattachement INCERTAIN, et les continuations suivantes de la ligne en héritent.
// Candidats `{ abbr, ch }` : l'hôte, puis la dernière source nommée de l'écart avec chaque numéro qui la
// suit (`NADJ (…) « 15 - _GoBack.md »`) — sans source nommée, l'hôte avec le numéro collé au `l.`.
const MULTI_CHAPITRES_RE = /^\s*\/\s*(?:ch\.)?(\d+)\s+$/
const NUMERO_COLLE_RE = /(\d+)\s+$/
const SIGLE_DU_DOSSIER = new Map(BOOKS.map(([abbr, dir]) => [`${dir}/`, abbr]))
const DOSSIER_ALT = alternationDe(SIGLE_DU_DOSSIER.keys())
const SOURCE_NOMMEE_RE = () => new RegExp(`\\b(${ABBR_ALT})\\b|(${DOSSIER_ALT})|\\bVO\\b`, 'g')

function candidatsDeLEcart(hote, ecart) {
  const cle = ({ abbr, ch }) => `${abbr} ${ch}`
  const out = new Map((hote.candidats ?? [{ abbr: hote.abbr, ch: hote.ch }]).map((c) => [cle(c), c]))
  const nommee = [...ecart.matchAll(SOURCE_NOMMEE_RE())].at(-1)
  const abbr = nommee ? nommee[1] ?? SIGLE_DU_DOSSIER.get(nommee[2]) : hote.abbr
  const numeros = nommee ? ecart.slice(nommee.index + nommee[0].length).match(/\d+/g) ?? [] : ecart.match(NUMERO_COLLE_RE)?.slice(1) ?? []
  if (abbr) for (const ch of numeros) out.set(cle({ abbr, ch }), { abbr, ch })
  return [...out.values()]
}

// CONTINUATIONS nues d'une ligne d'Atlas ou de code : un `l.N` qui SUIT une réf `<ABRÉV> NN l.X` dans la
// même ligne — ou, sur une ligne de table, dans la même CELLULE — hérite de son `<ABRÉV> NN`. PUR.
export function continuations(ligne) {
  const re = new RegExp(`\\b(?:(${ABBR_ALT}) (\\d+) )?l\\.(\\d+)(${SUFFIXE_DE_LIGNE})`, 'g')
  const table = /^\s*\|/.test(ligne)
  const out = []
  let hote = null, m
  while ((m = re.exec(ligne))) {
    if (table && hote && ligne.slice(hote.fin, m.index).includes('|')) hote = null
    if (m[1]) { hote = { abbr: m[1], ch: m[2], fin: m.index + m[0].length }; continue }
    if (!hote) continue
    const ecart = ligne.slice(hote.fin, m.index)
    const multi = !hote.candidats && ecart.match(MULTI_CHAPITRES_RE)
    if (multi) hote.ch = multi[1]
    else if (/\d/.test(ecart) || SOURCE_NOMMEE_RE().test(ecart)) hote.candidats = candidatsDeLEcart(hote, ecart)
    out.push({ index: m.index, full: m[0], abbr: hote.abbr, ch: hote.ch, depart: Number(m[3]), suffix: m[4], ...(hote.candidats && { candidats: hote.candidats }) })
    hote.fin = m.index + m[0].length
  }
  return out
}

// Plus longue séquence de mots EN TÊTE de la citation présente dans le texte source. Tolère les
// retouches du build (parenthèse inline supprimée, ponctuation finale ajoutée, préfixe « Note : »
// retiré) qui font échouer le match exact intégral — l'ancre reste un fragment VERBATIM ≥ MIN_QUOTE_LEN.
export function headAnchor(joined, head) {
  const words = head.split(' ').filter(Boolean)
  for (let len = words.length; len >= 1; len--) {
    const a = words.slice(0, len).join(' ')
    if (a.length < MIN_QUOTE_LEN) break
    const occ = allOccurrences(joined, a)
    if (occ.length >= 1) return { occ, anchor: a, full: len === words.length }
  }
  return { occ: [], anchor: null, full: false }
}

// ---------- extraction de la citation précédant une réf ----------
const isBQ = (line) => /^\s*>/.test(line)
const stripBQ = (line) => line.replace(/^\s*>\s?/, '')
// `preceding` = texte (bloc replié) avant le token de réf ; renvoie la citation brute ou null.
function extractQuote(preceding) {
  const close = preceding.lastIndexOf('»')
  if (close === -1) return null
  const gap = preceding.slice(close + 1)                 // entre » et la réf : seulement un séparateur
  if (!/^[\s—–(`'":-]*$/.test(gap)) return null
  const open = preceding.indexOf('«')                    // guillemets imbriqués : 1er « / dernier »
  if (open === -1 || open > close) return null
  return preceding.slice(open + 1, close)
}

// ---------- citation EN TÊTE : la réf PRÉCÈDE la citation (#2199) ----------
// Forme `<réf>[, <réf>…][, *libellé*][)`] <lien> « … »`, le lien étant deux-points, tiret, `.** *` ou un
// simple blanc — `> **Verbatim** (l.24) : « … »`, `LDB 05 l.345 — « … »`, `(l.184).** *« … »*`.
// La i-ᵉ réf du groupe porte la i-ᵉ citation qui suit les deux-points. Une réf NUE (`l.X`) hérite du
// chapitre de la réf à sigle qui la précède dans son groupe ; sans elle, `chapitre` vaut `null` et
// l'appelant le cherche dans son paragraphe (`chapitreDuParagraphe`), puis dans l'en-tête « Sources
// RAW » de la section (`chapitresDeLaSection`), puis dans le texte qui la précède depuis le titre qui
// ouvre sa section. Un lien DÉDUIT — simple blanc entre réf et citation (`lienDeduit`), ou chapitre pris
// à ce dernier repli — ne se répare jamais seul : sa dérive sort à trancher (🟡), hors de `--apply`. PUR.
const REF_TETE = () => new RegExp(`(?:\\b(${ABBR_ALT}) (\\d+) )?\\bl\\.(\\d+)((?:[-+]\\d+)*)`, 'g')
const LIEN_DE_GROUPE = /^[\s`]*(?:,|·|et|→)[\s`]*$/
const FIN_DE_TETE = /^(?:,\s*\*[^*«»]+\*)?[\s)`]*(:|[—–]|\.\*\*\s*\*)?\s*(?=«)/
export function citationsEnTete(ligne, suite = []) {
  const refs = [...ligne.matchAll(REF_TETE())].map((m) => ({
    index: m.index, fin: m.index + m[0].length, ecrit: m[0], abbr: m[1] ?? null, ch: m[2] ?? null,
    depart: Number(m[3]), suffix: m[4] ?? '',
  }))
  const out = []
  for (let k = 0; k < refs.length;) {
    let j = k
    while (j + 1 < refs.length && LIEN_DE_GROUPE.test(ligne.slice(refs[j].fin, refs[j + 1].index))) j++
    const groupe = refs.slice(k, j + 1)
    k = j + 1
    const fin = FIN_DE_TETE.exec(ligne.slice(groupe.at(-1).fin))
    if (!fin) continue
    const citations = citationsApres([ligne.slice(groupe.at(-1).fin + fin[0].length), ...suite.map(stripBQ)])
    let hote = null
    groupe.forEach((r, i) => {
      if (r.abbr) hote = r
      if (i < citations.length) out.push({ ...r, abbr: hote?.abbr ?? null, ch: hote?.ch ?? null, citation: citations[i], lienDeduit: !fin[1] })
    })
  }
  return out
}
// Citations « … » successives d'un texte qui COMMENCE par un `«` ; une citation non fermée sur sa ligne
// se poursuit sur les lignes de `suite`. Le `\|` d'une cellule de table Markdown est le `|` cité.
function citationsApres(morceaux) {
  const texte = morceaux.join(' ').replace(/\\\|/g, '|')
  const out = []
  const re = /«([^»]*)»/g
  let m
  while ((m = re.exec(texte))) out.push(m[1])
  return out
}
// Chapitre `<ABRÉV> NN` de la DERNIÈRE réf à sigle qui précède la colonne `col` de la ligne `i` dans
// son paragraphe (lignes non vides contiguës) — ou, `section` vrai, depuis le titre `#`/`##` qui ouvre
// sa section — ou `null`. PUR.
export function chapitreDuParagraphe(lines, i, col, section = false) {
  let debut = i
  while (debut > 0 && (section ? !/^#{1,2} /.test(lines[debut - 1]) : lines[debut - 1].trim() && !/^#/.test(lines[debut - 1]))) debut--
  const texte = [...lines.slice(debut, i), lines[i].slice(0, col)].join(' ')
  const refs = [...texte.matchAll(new RegExp(`\\b(${ABBR_ALT}) (\\d+) l\\.\\d`, 'g'))]
  const m = refs.at(-1)
  return m ? { abbr: m[1], ch: m[2] } : null
}
// Chapitres `<ABRÉV> NN` de l'en-tête « Sources RAW » de la section qui contient la ligne `i` (remontée
// jusqu'au titre `#`/`##` qui l'ouvre). PUR.
export function chapitresDeLaSection(lines, i) {
  for (let j = i; j >= 0; j--) {
    if (/\*\*Sources RAW\s*[:.]\*\*/.test(lines[j])) {
      const vus = new Map()
      for (const m of lines[j].matchAll(new RegExp(`\\b(${ABBR_ALT}) (\\d+)\\b`, 'g'))) vus.set(`${m[1]} ${m[2]}`, { abbr: m[1], ch: m[2] })
      return [...vus.values()]
    }
    if (/^#{1,2} /.test(lines[j]) && j < i) return []
  }
  return []
}

// ---------- recherche cross-chapitre (suggestion manuelle sur LOW, jamais auto) ----------
function crossChapter(abbr, head, excludeCh) {
  const dir = livreDuSigle(abbr)?.dir; if (!dir) return null
  const files = listerDossier(dir, { absent: 'vide' })
  const hits = []
  for (const f of files) {
    const nn = graphieDuFichier(f)
    if (nn == null || Number(nn) === Number(excludeCh)) continue
    const li = lineIndex(abbr, nn); if (!li) continue
    const { occ } = headAnchor(li.joined, head)
    if (occ.length === 1) hits.push({ ch: Number(nn), line: offsetToLine(occ[0], li.lineStartOffset) })
  }
  return hits.length === 1 ? hits[0] : null
}

// ---------- classification d'une réf à citation ----------
// PURE : ne prend QUE l'index déjà construit (`li`) et un résolveur cross-chapitre injectable
// (`findCross`) — aucun accès fichier ni à `BOOKS`/`chapterFile`. Testable en fixture (reproduit
// le bug réel « citation absente ici, présente ailleurs » sans toucher Source/).
export function classifyQuote(li, citedStart, rawQuote, findCross) {
  if (!li) return { status: 'NO-SOURCE' }
  const norm = normalize(rawQuote)
  const head = norm.split(SENT)[0].trim()          // 1er segment (avant toute ellipse)
  const { occ, anchor, full } = headAnchor(li.joined, head)
  if (!anchor) {
    const xc = findCross ? findCross(head) : null
    return { status: 'LOW', reason: xc ? `texte trouvé en ${xc.label}` : 'aucune occurrence', li, norm, wrongChapter: xc }
  }
  if (occ.length === 1) {
    const foundStart = offsetToLine(occ[0], li.lineStartOffset)
    return { status: foundStart === citedStart ? 'OK' : 'DRIFT', conf: 'HIGH', foundStart, li, norm, edited: !full }
  }
  // plusieurs occurrences → MEDIUM, candidat le plus proche de la ligne citée
  const cands = occ.map((o) => offsetToLine(o, li.lineStartOffset))
  const nearest = cands.reduce((a, b) => (Math.abs(b - citedStart) < Math.abs(a - citedStart) ? b : a))
  return { status: 'MEDIUM', conf: 'MEDIUM', foundStart: nearest, li, norm, candidates: cands }
}

// ---------- balayage de l'Atlas ----------
// `scan` est le cœur RÉUTILISABLE (CLI ET tests) : parcourt `rawDir`, classe chaque réf, applique
// les réécritures --apply/--remap sur DISQUE (seul effet de bord — pas d'écriture de rapport ici,
// à charge de l'appelant), et renvoie tally + lignes de rapport + les réfs LOW (pour le cliquet) +
// les réfs que --remap n'a pas pu porter (`nonRemappees`). `carteDe(abbr, ch)` fournit la carte de
// lignes d'un chapitre (injectable en banc), `catalogues` la source des catalogues (`pagesDeLAtlasRendues`).
export function scan(rawDir = RAWDIR, { apply = false, remap = false, classes = CLASSES, carteDe = carteDuChapitre, catalogues } = {}) {
  const DOCS = pagesDeLAtlasRendues(rawDir, { classes }, catalogues)
  const tally = { OK: 0, DRIFT: 0, MEDIUM: 0, LOW: 0, RANGE: 0, 'PAST-EOF': 0, 'NO-SOURCE': 0 }
  let totalRefs = 0, totalQuotes = 0, appliedTotal = 0, remappedTotal = 0
  const lowRows = []   // [{ fichier: chemin de la FICHE, full, detail }] — un SITE = une unité du cliquet
  const nonRemappees = []   // [{ doc, ligne, full, detail }] — réf sur une ligne supprimée ou ambiguë
  const sections = []  // [{ file, classe, rows }] pour le rapport

  for (const { relatif: file, chemin: path, classe, texte } of DOCS) {
    const fiche = classe === 'fiche'
    const lines = texte.split('\n')
    const rows = []
    const edits = new Map()   // lineIdx -> [{start,end,replacement}]
    const consumed = new Set()  // lignes (index i) dont la citation a déjà été prise (cf. clé ci-dessous)
    // Porte UNE réf (directe ou continuation) par la carte : réécriture planifiée, ou site RAPPORTÉ.
    const remapperSite = (i, site) => {
      const { index, full } = site
      const r = porterSite(site, carteDe)
      const raison = r.raison ?? (r.change && !fiche ? 'référence à corriger dans la source de cette page' : null)
      if (raison) {
        rows.push({ full, status: 'NON-REMAP', detail: raison })
        nonRemappees.push({ doc: path.split('\\').join('/'), ligne: i + 1, full, detail: raison })
        return { raison }
      }
      if (r.change) {
        if (!edits.has(i)) edits.set(i, [])
        edits.get(i).push({ start: index, end: index + full.length, replacement: full.replace(SUFFIXE_DE_REF_RE, r.texte) })
        remappedTotal++
      }
      return r
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const suite = []
      for (let j = i + 1; j < lines.length && isBQ(line) && isBQ(lines[j]) && !line.slice(line.lastIndexOf('«')).includes('»') && suite.length < 4; j++) {
        suite.push(lines[j])
        if (lines[j].includes('»')) break
      }
      const enTete = citationsEnTete(line, suite)
      const aSigleEnTete = new Set(enTete.filter((c) => c.ecrit !== `l.${c.depart}${c.suffix}`).map((c) => c.index))
      if (enTete.length) consumed.add(i)
      for (const c of enTete) {
        totalRefs++
        // Ancre trop courte pour être un verbatim discriminant (`headAnchor`) : la réf reste de synthèse.
        if (normalize(c.citation).split(SENT)[0].trim().length < MIN_QUOTE_LEN) { tally.RANGE++; continue }
        totalQuotes++
        const deSection = chapitreDuParagraphe(lines, i, c.index, true)
        const candidats = c.abbr ? [{ abbr: c.abbr, ch: c.ch }]
          : [chapitreDuParagraphe(lines, i, c.index), ...chapitresDeLaSection(lines, i), deSection && { ...deSection, deduit: true }].filter(Boolean)
              .filter((x, n, t) => t.findIndex((y) => y.abbr === x.abbr && y.ch === x.ch) === n)
        const lu = c.abbr ? c.ecrit : `${c.ecrit} [${candidats.map((x) => `${x.abbr} ${x.ch}`).join(' | ') || '?'}]`
        if (!candidats.length) { rows.push({ full: lu, status: 'NO-SOURCE', detail: 'réf nue sans chapitre : ni réf à sigle dans son paragraphe, ni en-tête « Sources RAW » dans sa section' }); tally['NO-SOURCE']++; continue }
        const verdicts = candidats.map((x) => {
          const li = lineIndex(x.abbr, x.ch)
          return { ...(li ? classifyQuote(li, c.depart, c.citation, null) : { status: 'NO-SOURCE' }), deduit: c.lienDeduit || !!x.deduit }
        })
        const v = ['OK', 'DRIFT', 'MEDIUM', 'LOW'].map((st) => verdicts.find((w) => w.status === st)).find(Boolean) ?? verdicts[0]
        const r = v.status === 'DRIFT' && v.deduit
          ? { ...v, status: 'MEDIUM', candidates: [v.foundStart], aTrancher: true }
          : v
        const snippet = coupeAuMot(r.norm || normalize(c.citation), 46)
        if (r.status === 'OK') { tally.OK++; continue }
        tally[r.status]++
        if (r.status === 'DRIFT') {
          rows.push({ full: lu, status: 'DRIFT', cited: c.depart, found: r.foundStart, detail: `« ${snippet} » → l.${r.foundStart}` + (r.edited ? ' (ancre partielle)' : '') })
          if (apply && fiche) {
            const rg = c.suffix.match(/^-(\d+)/)
            const neuf = `l.${r.foundStart}` + (rg ? `-${r.foundStart + (Number(rg[1]) - c.depart)}` + c.suffix.slice(rg[0].length) : c.suffix)
            if (!edits.has(i)) edits.set(i, [])
            edits.get(i).push({ start: c.index, end: c.fin, replacement: c.ecrit.replace(`l.${c.depart}${c.suffix}`, neuf) })
            appliedTotal++
          }
        } else if (r.status === 'MEDIUM') {
          rows.push({ full: lu, status: 'MEDIUM', cited: c.depart, found: r.foundStart, detail: r.aTrancher
            ? `« ${snippet} » → l.${r.foundStart} par un lien DÉDUIT (blanc seul ou chapitre de section) : à trancher au Source, jamais par --apply`
            : `« ${snippet} » candidats l.${r.candidates.join('/')} → plus proche l.${r.foundStart}` })
        } else if (r.status === 'LOW') {
          const detail = `« ${snippet} » — ${r.reason}`
          rows.push({ full: lu, status: 'LOW', cited: c.depart, detail })
          lowRows.push({ fichier: path.split('\\').join('/'), full: lu, detail })
        } else {
          rows.push({ full: lu, status: 'NO-SOURCE', detail: 'chapitre source introuvable' })
          tally['NO-SOURCE']++
        }
      }
      const re = refRe(); let m
      while ((m = re.exec(line))) {
        const [full, abbr, ch, startStr, suffix] = m
        if (aSigleEnTete.has(m.index)) continue
        const citedStart = Number(startStr)
        totalRefs++
        // texte précédant la réf (bloc blockquote replié, ou ligne courante)
        let preceding
        if (isBQ(line)) {
          let j = i; while (j - 1 >= 0 && isBQ(lines[j - 1])) j--
          const prefixText = lines.slice(j, i).map(stripBQ).join(' ')
          const prefixLen = line.length - stripBQ(line).length
          preceding = (prefixText ? prefixText + ' ' : '') + stripBQ(line).slice(0, Math.max(0, m.index - prefixLen))
        } else {
          preceding = line.slice(0, m.index)
        }
        // Clé de consommation = la LIGNE de la réf (le `»` de fermeture est toujours sur cette ligne) :
        // une 2ᵉ réf sur la MÊME ligne ne re-prend pas la citation, mais deux lignes-citations empilées
        // dans un même bloc sont vérifiées chacune.
        const rawQuote = consumed.has(i) ? null : extractQuote(preceding)

        if (!rawQuote) {
          // réf de synthèse (sans citation à ancrer) : vérifier la plage + ré-ancrer par diff (--remap)
          const li = lineIndex(abbr, ch)
          if (!li) { rows.push({ full, status: 'NO-SOURCE', detail: 'chapitre source introuvable' }); tally['NO-SOURCE']++; continue }
          const eof = citedStart > li.count
          if (eof) tally['PAST-EOF']++; else tally.RANGE++
          if (remap) {
            const r = remapperSite(i, { index: m.index, full, abbr, ch, depart: citedStart, suffix })
            if (eof) rows.push({ full, status: 'PAST-EOF', detail: r?.change ? `→ ${r.texte} (ré-ancré par diff)` : `l.${citedStart} > ${li.count} lignes (non ré-ancré)` })
          } else if (eof) rows.push({ full, status: 'PAST-EOF', detail: `l.${citedStart} > ${li.count} lignes` })
          continue
        }
        consumed.add(i)
        totalQuotes++
        const li = lineIndex(abbr, ch)
        const findCross = (head) => {
          const xc = crossChapter(abbr, head, ch)
          return xc ? { label: `${abbr} ${xc.ch} l.${xc.line}` } : null
        }
        const r = li ? classifyQuote(li, citedStart, rawQuote, findCross) : { status: 'NO-SOURCE' }
        const snippet = coupeAuMot(r.norm || normalize(rawQuote), 46)
        if (r.status === 'OK') { tally.OK++; continue }
        tally[r.status]++
        if (r.status === 'DRIFT') {
          const detail = `« ${snippet} » → l.${r.foundStart}` + (r.edited ? ' (ancre partielle)' : '')
          rows.push({ full, status: 'DRIFT', cited: citedStart, found: r.foundStart, detail })
          if (apply && fiche) {
            // réécrit l.X→l.found ; plage -Y : largeur préservée (translatée du même décalage)
            let newSuffix = suffix || ''
            const rg = (suffix || '').match(/^-(\d+)/)
            if (rg) newSuffix = `-${r.foundStart + (Number(rg[1]) - citedStart)}` + suffix.slice(rg[0].length)
            const newFull = full.replace(`l.${startStr}${suffix || ''}`, `l.${r.foundStart}${newSuffix}`)
            if (!edits.has(i)) edits.set(i, [])
            edits.get(i).push({ start: m.index, end: m.index + full.length, replacement: newFull })
            appliedTotal++
          }
        } else if (r.status === 'MEDIUM') {
          rows.push({ full, status: 'MEDIUM', cited: citedStart, found: r.foundStart, detail: `« ${snippet} » candidats l.${r.candidates.join('/')} → plus proche l.${r.foundStart}` })
        } else if (r.status === 'LOW') {
          const detail = `« ${snippet} » — ${r.reason}`
          rows.push({ full, status: 'LOW', cited: citedStart, detail })
          lowRows.push({ fichier: path.split('\\').join('/'), full, detail })
        } else if (r.status === 'NO-SOURCE') {
          rows.push({ full, status: 'NO-SOURCE', detail: 'chapitre source introuvable' })
        }
      }
      if (remap) for (const c of continuations(line)) remapperSite(i, c)
    }

    // applique les réécritures (droite→gauche par ligne pour ne pas décaler les offsets)
    if (fiche && edits.size) {
      for (const [li, es] of edits) {
        es.sort((a, b) => b.start - a.start)
        let s = lines[li]
        for (const e of es) s = s.slice(0, e.start) + e.replacement + s.slice(e.end)
        lines[li] = s
      }
      sousLEpoque(path, () => ecrireTexteAtomique(path, lines.join('\n')))
    }

    if (rows.length) sections.push({ file, classe, rows })
  }

  return { DOCS, tally, sections, lowRows, nonRemappees, totalRefs, totalQuotes, appliedTotal, remappedTotal }
}

/** La RÉGÉNÉRATION du stock des réfs FAUSSES (`RegenerationDeStock`, `stockDeSites.mjs`), sur des
 *  sites LOW (par défaut, ceux du balayage de l'Atlas).
 * @returns {import('../guards/lib/stockDeSites.mjs').RegenerationDeStock[]}
 */
export const regenerations = (lowRows = scan().lowRows) => [{
  chemin: LOW_STOCK_PATH,
  politique: SOUS_LOT,
  horsCollections: QUOI,
  collections: [{ nom: 'entrees', sites: sitesLow(lowRows) }],
}]

const remedeDeDerive = (classe) => classe === 'fiche'
  ? 'corriger les fiches avec --apply'
  : 'corriger les références de catalogue dans leur source'

// ---------- rapport Markdown ----------
function buildReport(result) {
  const { DOCS, tally, sections, totalRefs, totalQuotes } = result
  const out = ['# Atlas RAW — Ré-ancrage des citations', '',
    '> Déterministe (`node scripts/raw/reanchor.mjs`). GATE (#434) :',
    '> exit 1 sur dérive non appliquée, ambiguïté, ou hausse de réf FAUSSE (❌) — voir en-tête du script.',
    '> Chaque citation verbatim « … » est relocalisée dans le `.md` source courant pour vérifier le n° de ligne cité.',
    '> ✅ juste · 🔧 dérive (HIGH, citation unique) · 🟡 ambigu (MEDIUM, manuel)',
    '> ❌ introuvable (LOW, paraphrase/mauvais chapitre) · ➖ synthèse (réf sans citation).', '']
  const MARK = { OK: '✅', DRIFT: '🔧', MEDIUM: '🟡', LOW: '❌', RANGE: '➖', 'PAST-EOF': '⛔', 'NO-SOURCE': '⚠️', 'NON-REMAP': '🧭' }
  for (const { file, classe, rows } of sections) {
    out.push(`## ${file}`, '', '| Réf | Statut | Détail |', '|---|---|---|')
    for (const r of rows) {
      const remede = r.status === 'DRIFT' ? ` · ${remedeDeDerive(classe)}` : ''
      out.push(`| \`${r.full}\` | ${MARK[r.status]} ${r.status} | ${r.detail}${remede} |`)
    }
    out.push('')
  }
  out.splice(6, 0,
    `**Bilan : ✅ ${tally.OK} · 🔧 ${tally.DRIFT} dérives · 🟡 ${tally.MEDIUM} ambigus · ❌ ${tally.LOW} introuvables · ➖ ${tally.RANGE} synthèses** ` +
    `(⛔ ${tally['PAST-EOF']} hors-fichier · ⚠️ ${tally['NO-SOURCE']} sans source) sur ${totalRefs} réfs · ${totalQuotes} citations · ${DOCS.length} pages.`, '')
  return out.join('\n')
}

const RAPPORT = `${RAWDIR}/reanchor.md`

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre(result = scan(RAWDIR)) {
  return new Map([[RAPPORT, buildReport(result)]])
}

export function* produire({ check }) {
  exigerRacineAtlas()
  const apply = process.argv.includes('--apply')
  const remap = process.argv.includes('--remap')
  if (check && (apply || remap)) {
    console.error('raw:reanchor — REFUS : `--check` compare sans écrire, `--apply` réécrit les fiches de l’Atlas, `--remap` aussi les réfs des racines citantes (`src`, `projets`, dossiers de fiches des projets) — jamais les deux ensemble.')
    process.exitCode = 1
    return
  }
  const code = remap ? remapperLesCitants() : { remappees: 0, nonRemappees: [] }
  const result = scan(RAWDIR, { apply, remap })
  const { tally, totalRefs, totalQuotes, appliedTotal, remappedTotal, DOCS, sections, lowRows } = result
  const nonRemappees = [...code.nonRemappees, ...result.nonRemappees]

  const driftLabel = apply ? `🔧 ${appliedTotal} corrigées` : `🔧 ${tally.DRIFT} dérives`
  const remapLabel = remap ? ` · 🧭 ${remappedTotal} synthèses et ${code.remappees} réfs du code ré-ancrées (diff), ${nonRemappees.length} non portées` : ''
  console.log(`ré-ancrage : ✅ ${tally.OK} · ${driftLabel} · 🟡 ${tally.MEDIUM} · ❌ ${tally.LOW} · ➖ ${tally.RANGE}${remapLabel} (⛔${tally['PAST-EOF']} ⚠️${tally['NO-SOURCE']})`)
  console.log(`${totalQuotes} citations vérifiées sur ${totalRefs} réfs (${DOCS.length} pages)` + (remap ? ` — ${remappedTotal} synthèses ré-ancrées par diff` : apply ? ` — ${appliedTotal} réécrites` : ''))

  // ---------- GATE (#434) ----------
  let fail = false
  const derivesRestantes = tally.DRIFT - appliedTotal
  if (derivesRestantes > 0) {
    const remedes = new Set(sections
      .filter(({ classe, rows }) => !(apply && classe === 'fiche') && rows.some((row) => row.status === 'DRIFT'))
      .map(({ classe }) => remedeDeDerive(classe)))
    console.log(`RÉGRESSION — ${derivesRestantes} dérive(s) 🔧 restante(s) : ${[...remedes].join(' et ')}.`)
    fail = true
  }
  if (tally['NO-SOURCE'] > 0) {
    console.log(`RÉGRESSION — ${tally['NO-SOURCE']} citation(s) ⚠️ sans chapitre source : la réf ne dit pas où lire le texte qu'elle cite.`)
    fail = true
  }
  if (tally.MEDIUM > 0) {
    console.log(`RÉGRESSION — ${tally.MEDIUM} réf(s) ambiguë(s) 🟡 : trancher manuellement (jamais d'auto-résolution, cf. #434).`)
    fail = true
  }
  if (nonRemappees.length) {
    console.log(`RÉGRESSION — ${nonRemappees.length} réf(s) non ré-ancrée(s) : corriger les cas signalés dans leurs sources.`)
    for (const n of nonRemappees) console.log(`  ${n.doc}:${n.ligne} \`${n.full}\` — ${n.detail}`)
    fail = true
  }
  const { neuves, perimees } = ecartDuVolet({
    sites: sitesLow(lowRows), stock: lireEntreesDeSite(LOW_STOCK_PATH), ou: 'reanchor-low-stock.json',
  })
  if (neuves.length) {
    console.log('RÉGRESSION — site(s) de réf FAUSSE (❌ LOW) hors du stock :')
    for (const o of neuves) console.log(`  ${o}`)
    fail = true
  }
  if (perimees.length) {
    console.log('Entrée(s) SOLDÉE(s) (réfs réparées) :')
    for (const s of perimees) console.log(`  ${s}`)
    fail = true
  }
  if (fail) process.exitCode = 1

  yield {
    out: rendre(apply || remap ? scan(RAWDIR) : result).get(RAPPORT),
    path: RAPPORT,
    staleMsg: `raw:reanchor — ${RAPPORT} est PÉRIMÉ (fiche de l'Atlas ou Source changée).`,
    rerunMsg: '  → relancer `npm run raw:reanchor` (dérivé jamais commité, #2203).',
  }
}

if (import.meta.main) await lancerDepuisCLI(import.meta, produire)
