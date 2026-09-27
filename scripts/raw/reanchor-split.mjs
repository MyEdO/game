// Ré-ancrage des réfs `AA 01 l.X` / `ZI 01 l.X` de l'Atlas RAW, qui visent les fichiers mono-bloc de
// `SPLIT_SOURCES`, remplacés par les fichiers-chapitres au commit `SPLIT_SOURCE_SHA` (#454).
// Ancre au TEXTE, jamais un offset arithmétique : pour chaque borne de ligne
// d'une réf `AA/ZI 01 l.X[-Y|+n…]`, on relit le texte de la ligne X dans le fichier d'ORIGINE
// (`git show <SPLIT_SOURCE_SHA>^:<path>`), on le retrouve par MATCH EXACT (normalize() de _lib.mjs)
// dans les fichiers-chapitres actuels du même livre, et on réécrit la réf sur le chapitre/ligne trouvés.
//   node scripts/raw/reanchor-split.mjs            → rapport seul (aucune écriture)
//   node scripts/raw/reanchor-split.mjs --apply     → réécrit en place docs/raw/*.md
import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { livreDuSigle, normalize, pagesDeLAtlas, readText } from './_lib.mjs'
import { echapperRegex } from '../../src/lib/regex.ts'
import { graphieDuFichier, numeroDuFichier } from '../../src/data/source/decoupe.ts'
import { RAWDIR, CLASSES } from './check-refs.mjs'

// Commit qui a éclaté ces 2 livres (bloc unique numéroté « 01 ») en fichiers-chapitres.
export const SPLIT_SOURCE_SHA = '77dab03c'
// Ces `path` sont des chemins DANS L'HISTOIRE (`git show ${SPLIT_SOURCE_SHA}^:<path>`), pas des
// chemins du disque d'aujourd'hui : ils portent le nom qu'avait le fichier À CE COMMIT et ne suivent
// AUCUN renommage postérieur — le passage des chemins de `Source/` en ASCII (#1699) ne les touche pas.
export const SPLIT_SOURCES = [
  { abbr: 'AA', oldNN: '01', path: 'Source/WH - V4 - Aux Armes/01 - WH - V4 - Aux Armes.md' },
  { abbr: 'ZI', oldNN: '01', path: "Source/WH - V4 - Le zoo impérial/01 - WH - V4 - Le zoo impérial.md" },
]

const MAX_CTX = 8 // rayon max (voisins non-vides) pour lever une ambiguïté de citation dupliquée

// Réfs `AA/ZI 01 l.X` dont la ligne d'ORIGINE citée ne correspond PAS au sujet du topic qui la cite
// (relecture manuelle ; le décalage précède le découpage, #454) : le ré-ancrage « au texte » les
// relocaliserait vers un contenu tout aussi hors-sujet. Exclues du ré-ancrage automatique pour ne pas
// maquiller le défaut derrière une réf qui a l'air juste ; rendues NON RÉSOLUES au rapport.
export const KNOWN_PREEXISTING_MISMATCH = new Set([
  'ZI 01 l.79-80', // topic "Redoutable (Indice)" ; l.79-80 d'origine = titre "L'OMBRE DU FLEUVE"
])

// Anchors de structure ajoutés par le bakage de folio (absents de l'origine) : à ignorer comme le vide.
const SKIP = (k) => k === '' || k.startsWith('<span')
// Titre de heading : le niveau `#` a été redistribué par la découpe (même texte, niveau différent).
const stripHeading = (s) => s.replace(/^#+\s*/, '')
export const key = (line) => normalize(stripHeading(line))

// ---------- lecture de l'origine (git) + des chapitres actuels ----------
export function origLinesOf(source) {
  const text = execFileSync('git', ['show', `${SPLIT_SOURCE_SHA}^:${source.path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return text.split('\n')
}

export function buildBookIndex(abbr) {
  const dir = livreDuSigle(abbr)?.dir
  const files = listerDossier(dir).filter((f) => numeroDuFichier(f) != null)
  const index = {}
  for (const f of files) {
    const nn = graphieDuFichier(f)
    index[nn] = readText(join(dir, f)).split('\n').map(key)
  }
  return index
}

// ---------- résolution d'une borne (ligne originale) ----------
function findExact(bookIndex, k) {
  if (!k) return []
  const hits = []
  for (const [nn, keys] of Object.entries(bookIndex)) {
    keys.forEach((l, i) => { if (l === k) hits.push([nn, i + 1]) })
  }
  return hits
}

// Contexte = N voisins NON-VIDES de chaque côté (le nombre de lignes blanches dérive, on l'ignore).
function ctx(keys, pos, n) {
  const before = []
  for (let i = pos - 2; i >= 0 && before.length < n; i--) if (!SKIP(keys[i])) before.push(keys[i])
  const after = []
  for (let i = pos; i < keys.length && after.length < n; i++) if (!SKIP(keys[i])) after.push(keys[i])
  return before.reverse().join('|') + '||' + after.join('|')
}

function disambiguate(origKeys, pos, bookIndex, hits) {
  if (hits.length <= 1) return hits[0] || null
  let cands = hits
  for (let n = 1; n <= MAX_CTX; n++) {
    const target = ctx(origKeys, pos, n)
    const next = cands.filter(([nn, line]) => ctx(bookIndex[nn], line, n) === target)
    if (next.length === 1) return next[0]
    if (next.length === 0) return null
    cands = next
  }
  return null
}

function resolveNonBlank(origKeys, pos, bookIndex) {
  const hits = findExact(bookIndex, origKeys[pos - 1])
  if (!hits.length) return null
  return disambiguate(origKeys, pos, bookIndex, hits)
}

// Borne tombée sur une ligne VIDE (ou anchor de structure) : ancre son voisin non-vide le plus
// proche (arrière puis avant), et translate le même offset — accepté seulement si la position
// candidate est ELLE AUSSI vide dans le fichier actuel (sinon on ne devine pas).
function resolveBlank(origKeys, pos, bookIndex) {
  for (const dir of [-1, 1]) {
    let d = 1
    while (true) {
      const idx = pos - 1 + dir * d
      if (idx < 0 || idx >= origKeys.length) break
      if (!SKIP(origKeys[idx])) {
        const anchorLine = idx + 1
        const resolved = resolveNonBlank(origKeys, anchorLine, bookIndex)
        if (resolved) {
          const [nn, newAnchor] = resolved
          const candidate = newAnchor - dir * d
          const keys = bookIndex[nn]
          if (candidate >= 1 && candidate <= keys.length && SKIP(keys[candidate - 1])) return [nn, candidate]
        }
        break
      }
      d++
    }
  }
  return null
}

/** Résout une borne de ligne `pos` (1-based, dans `origKeys`) → `[nn, newLine]` ou `null`. */
export function resolveBound(origKeys, pos, bookIndex) {
  if (pos < 1 || pos > origKeys.length) return null
  return SKIP(origKeys[pos - 1]) ? resolveBlank(origKeys, pos, bookIndex) : resolveNonBlank(origKeys, pos, bookIndex)
}

function boundStatus(origKeys, pos, bookIndex) {
  if (pos < 1 || pos > origKeys.length) return 'hors-fichier'
  if (SKIP(origKeys[pos - 1])) return resolveBlank(origKeys, pos, bookIndex) ? 'ok' : 'borne vide non ancrée'
  const hits = findExact(bookIndex, origKeys[pos - 1])
  if (!hits.length) return 'texte introuvable'
  return disambiguate(origKeys, pos, bookIndex, hits) ? 'ok' : 'ambigu (non levé par le contexte)'
}

/** Parse la suite `l.<start><suffix>` en bornes `[start, ...tokens]` (`{op, val}` pour chacune). */
export function parseBounds(startStr, suffix) {
  const start = Number(startStr)
  const tokens = [...(suffix || '').matchAll(/([-+])(\d+)/g)].map((t) => ({ op: t[1], val: Number(t[2]) }))
  return { start, tokens }
}

/** Ré-ancre une réf entière (toutes ses bornes) → `{ nn, newStart, newSuffix }` ou `null` si une
 *  borne échoue ou si les bornes résolvent vers des chapitres différents. */
export function reanchorRef(origKeys, startStr, suffix, bookIndex) {
  const { start, tokens } = parseBounds(startStr, suffix)
  const bounds = [start, ...tokens.map((t) => t.val)]
  const resolved = bounds.map((b) => resolveBound(origKeys, b, bookIndex))
  if (resolved.some((r) => !r)) return null
  const nns = new Set(resolved.map((r) => r[0]))
  if (nns.size > 1) return null
  const nn = resolved[0][0]
  const newStart = resolved[0][1]
  const newSuffix = tokens.map((t, i) => `${t.op}${resolved[i + 1][1]}`).join('')
  return { nn, newStart, newSuffix }
}

/** Raison(s) d'échec d'une réf non ré-ancrée, une par borne fautive. */
export function explainFailure(origKeys, startStr, suffix, bookIndex) {
  const { start, tokens } = parseBounds(startStr, suffix)
  const bounds = [start, ...tokens.map((t) => t.val)]
  const statuses = bounds.map((b) => boundStatus(origKeys, b, bookIndex))
  const resolved = bounds.map((b) => resolveBound(origKeys, b, bookIndex))
  if (statuses.every((s) => s === 'ok') && new Set(resolved.filter(Boolean).map((r) => r[0])).size > 1) {
    return `bornes vers des chapitres différents (${resolved.map((r) => r && r[0]).join('/')})`
  }
  return bounds.map((b, i) => `l.${b} → ${statuses[i]}`).filter((_, i) => statuses[i] !== 'ok').join(' ; ') || 'échec inconnu'
}

// ---------- balayage docs/raw + réécriture ----------
export function scanAndApply(rawDir, classes, sources, apply) {
  const docs = pagesDeLAtlas(rawDir, { classes })
  const rewritten = []
  const unresolved = []
  for (const source of sources) {
    const origKeys = origLinesOf(source).map(key)
    const bookIndex = buildBookIndex(source.abbr)
    for (const { relatif: doc, chemin: path } of docs) {
      const lines = readText(path).split('\n')
      const editsByRow = new Map()
      for (let row = 0; row < lines.length; row++) {
        const re = new RegExp(`\\b(${echapperRegex(source.abbr)}) (\\d+) l\\.(\\d+)((?:[-+]\\d+)*)`, 'g')
        let m
        while ((m = re.exec(lines[row]))) {
          if (Number(m[2]) !== Number(source.oldNN)) continue
          if (KNOWN_PREEXISTING_MISMATCH.has(m[0])) {
            unresolved.push({ doc, row: row + 1, ref: m[0], reason: 'citation déjà hors-sujet avant le découpage (#454) — exclue du ré-ancrage auto' })
            continue
          }
          const result = reanchorRef(origKeys, m[3], m[4] || '', bookIndex)
          if (!result) {
            unresolved.push({ doc, row: row + 1, ref: m[0], reason: explainFailure(origKeys, m[3], m[4] || '', bookIndex) })
            continue
          }
          const newFull = `${source.abbr} ${result.nn} l.${result.newStart}${result.newSuffix}`
          if (!editsByRow.has(row)) editsByRow.set(row, [])
          editsByRow.get(row).push({ start: m.index, end: m.index + m[0].length, replacement: newFull })
          rewritten.push({ doc, row: row + 1, before: m[0], after: newFull, abbr: source.abbr })
        }
      }
      if (apply && editsByRow.size) {
        for (const [row, edits] of editsByRow) {
          edits.sort((a, b) => b.start - a.start)
          let s = lines[row]
          for (const e of edits) s = s.slice(0, e.start) + e.replacement + s.slice(e.end)
          lines[row] = s
        }
        writeFileSync(path, lines.join('\n'))
      }
    }
  }
  return { rewritten, unresolved }
}

function main() {
  const apply = process.argv.includes('--apply')
  const { rewritten, unresolved } = scanAndApply(RAWDIR, CLASSES, SPLIT_SOURCES, apply)
  const byAbbr = {}
  for (const r of rewritten) byAbbr[r.abbr] = (byAbbr[r.abbr] ?? 0) + 1
  console.log(`ré-ancrage split : ${rewritten.length} réf(s) ${apply ? 'réécrites' : 'à réécrire (relancer --apply)'} — ${Object.entries(byAbbr).map(([a, n]) => `${a} ${n}`).join(' · ')}`)
  console.log(`${unresolved.length} réf(s) non résolues (à reprendre à la main) :`)
  for (const u of unresolved) console.log(`  docs/raw/${u.doc}:${u.row} — \`${u.ref}\` — ${u.reason}`)
}

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
