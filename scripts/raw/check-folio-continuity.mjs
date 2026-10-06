// Garde de continuité des folios extraits (#397, item conditionnel du DoD « garde de complétude
// d'ancres si exprimable »). Chaque fichier `.md` de `Source/**` porte des ancres
// `<span id="page-N-0" data-folio="M"></span>` posées par l'extraction Marker. Le défaut #397
// (folios 235-236 sans ancre dans LDB 46) était INVISIBLE : rien ne vérifiait la CONTINUITÉ de la
// séquence des `data-folio`. Dans un fichier donné, la séquence doit être STRICTEMENT CROISSANTE
// ET CONSÉCUTIVE (delta 1) — tout delta ≠ 1 est un saut : une ou plusieurs pages n'ont reçu aucune
// ancre lors de l'extraction. La séquence seule est AVEUGLE à ses extrémités : un folio manquant
// APRÈS la dernière ancre du fichier ne casse aucun delta (VDM 15, folio 224). Second volet donc
// (`kind:'fin'`, cf. `scanBookDir`) : la plage attendue vient de l'en-tête `*Pages PDF N[-M]*`, et
// le manque se mesure au niveau du LIVRE — un folio de fin ancré dans le chapitre suivant est une
// page partagée, pas un trou.
// SECONDE PASSE sur le même parcours (#1457) : une séquence peut être parfaitement consécutive et
// la page tout de même PERDUE — deux ancres adjacentes sans un octet utile entre elles (LDB 08,
// folios 88/89 collés : la carrière de Juriste manque). Cf. `emptyFolioAnchorsInText` et ses DEUX
// stocks nominatifs triés au PDF (`empty-folios-perdues-stock.json`, `empty-folios-benignes-stock.json`,
// générés par `lib/empty-folios-stock.mjs`).
// Stock NOMINATIF des sauts (`scripts/raw/folio-gaps-stock.json`, écart `ecartDuVolet` de
// `scripts/guards/lib/stock.mjs`, clé `chapitre extrait :: '<ABBR NN> <from>→<to>' :: occurrence`) : un saut
// MESURÉ hors du stock échoue, une entrée sans saut mesuré (extraction réparée) échoue aussi et se
// retire. Les folios de la clé sont ceux du PDF, stables là où un numéro de ligne dériverait.
// Re-run : node scripts/raw/check-folio-continuity.mjs
// Régénération (`regenerations`, politique `DECROISSANT`) :
//   npx tsx scripts/guards/lib/regenStock.mts scripts/raw/check-folio-continuity.mjs
import { listerDossier } from '../guards/lib/lister.mjs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS, readText } from './_lib.mjs'
// Cet instrument juge la FORME de tout ce qui est servi, l'index COMPRIS : son stock le nomme sous
// son numéro d'extraction (`AA 0 folio -2`). D'où `estNomDExtraction` / `numeroDExtraction`, et non
// le prédicat de CHAPITRE.
import { estNomDExtraction, numeroDExtraction, plageDeLigne1 } from '../../src/data/source/decoupe.ts'
import { cleDeSite, ecartDuVolet, sitesEnEntrees } from '../guards/lib/stock.mjs'
import { DECROISSANT, lireEntreesDeSite } from '../guards/lib/stockDeSites.mjs'

const ICI = dirname(fileURLToPath(import.meta.url))
export const STOCK_PATH = join(ICI, 'folio-gaps-stock.json')
export const EMPTY_PERDUES_PATH = join(ICI, 'empty-folios-perdues-stock.json')
export const EMPTY_BENIGNES_PATH = join(ICI, 'empty-folios-benignes-stock.json')
const ANCHOR_RE = /id="page-(\d+)-0" data-folio="(-?\d+)"/g

// Retourne les sauts de la séquence de `data-folio` d'un texte (PUR, aucun accès fichier) :
// `[{ from, to, delta }]` pour chaque paire consécutive dont le delta ≠ 1 (saut ou régression).
export function folioGapsInText(text) {
  const re = /data-folio="(\d+)"/g
  const folios = []
  let m
  while ((m = re.exec(text))) folios.push(Number(m[1]))
  const gaps = []
  for (let i = 1; i < folios.length; i++) {
    const delta = folios[i] - folios[i - 1]
    if (delta !== 1) gaps.push({ from: folios[i - 1], to: folios[i], delta })
  }
  return gaps
}

// Plage de folios ATTENDUE d'un chapitre + son dernier folio ancré (PUR). L'en-tête `*Pages PDF
// N[-M]*` (pages humaines 1-based) se convertit en folios via l'offset K−folio lu sur les ancres du
// fichier LUI-MÊME. `null` = pas d'en-tête, pas d'ancre, ou offset non unique (rien à conclure).
export function chapterFolioSpan(text) {
  const plage = plageDeLigne1(text.split('\n')[0] || '')
  if (!plage) return null
  const anchors = [...text.matchAll(new RegExp(ANCHOR_RE))].map((a) => ({ k: Number(a[1]), folio: Number(a[2]) }))
  if (!anchors.length) return null
  const offsets = new Set(anchors.map((a) => a.k - a.folio))
  if (offsets.size !== 1) return null
  const offset = [...offsets][0]
  const expectedHi = (plage.pageFin - 1) - offset
  return { expectedHi, last: Math.max(...anchors.map((a) => a.folio)) }
}

// Fichiers-chapitre `NN - *.md` d'un dossier de livre, triés, avec leur texte. HELPER de lecture
// partagé par les deux passes de l'instrument (sauts de séquence ET ancres sans contenu) : chacune
// l'appelle pour son propre compte, le corpus est donc lu DEUX fois par exécution du CLI (312
// fichiers, coût mesuré négligeable devant la CI). Dossier introuvable → Map vide (hors sujet).
export function chapterTexts(dir) {
  const files = listerDossier(dir, { absent: 'vide' }).filter(estNomDExtraction)
  return new Map(files.map((f) => [f, readText(join(dir, f))]))
}

// Balaie un dossier de livre (fichiers `NN - *.md`) → `[{ abbr, nn, file, path, from, to, delta, kind, ref }]`.
// `ref` = le chapitre cité (`ABBR NN`) ; `path` = le CHEMIN du chapitre extrait depuis la racine du
// dépôt (`Source/<livre>/NN - X.md`, POSIX), le seul nom que le stock et la porte de plage
// partagent — le nom NU à espaces ne nomme aucun fichier pour `stocksNominatifs.mjs`. Deux familles :
//   `kind:'saut'` — trou ENTRE deux ancres du fichier (`folioGapsInText`) ;
//   `kind:'fin'`  — folios attendus APRÈS la dernière ancre du fichier, et ancrés NULLE PART dans le
//                   livre. Un folio de fin ancré dans le fichier SUIVANT est une page partagée entre
//                   deux chapitres (le split Marker suit les titres, pas les pages), pas un trou :
//                   la mesure se fait donc au niveau du LIVRE. Sans ce volet, un folio manquant en
//                   fin de fichier échappait au cliquet (VDM 15, folio 224).
export function scanBookDir(abbr, dir) {
  const texts = chapterTexts(dir)
  const files = [...texts.keys()]
  const bookFolios = new Set()
  for (const text of texts.values()) for (const m of text.matchAll(/data-folio="(\d+)"/g)) bookFolios.add(Number(m[1]))
  const out = []
  for (const file of files) {
    const nn = numeroDExtraction(file)
    const text = texts.get(file)
    const ref = `${abbr} ${nn}`
    const path = `${String(dir).split('\\').join('/').replace(/\/$/, '')}/${file}`
    for (const gap of folioGapsInText(text)) out.push({ abbr, nn, file, path, ...gap, kind: 'saut', ref })
    const span = chapterFolioSpan(text)
    if (!span) continue
    const orphans = []
    for (let f = span.last + 1; f <= span.expectedHi; f++) if (!bookFolios.has(f)) orphans.push(f)
    if (orphans.length) out.push({ abbr, nn, file, path, from: span.last, to: orphans[orphans.length - 1], delta: orphans.length, kind: 'fin', ref })
  }
  return out
}

/** Sauts mesurés → sites du stock : le CHAPITRE EXTRAIT et le saut lui-même (`<ABBR NN> <from>→<to>`,
 *  des folios du PDF). Un chapitre porte souvent plusieurs sauts — c'est le saut, pas le chapitre,
 *  qui est l'unité du cliquet. */
export const sitesDeSauts = (gaps) => gaps.map((g) => ({ file: g.path, ref: `${g.ref} ${g.from}→${g.to}` }))

/** Balaie tous les livres de `books` (BOOKS par défaut) → sauts de folios agrégés. */
export function scanAllBooks(books = BOOKS) {
  const out = []
  for (const [abbr, dir] of books) out.push(...scanBookDir(abbr, dir))
  return out
}

// ---------- passe 2 : ancre SANS CONTENU (#1457) ----------
// La séquence peut être parfaitement consécutive et la PAGE tout de même perdue : deux ancres
// `data-folio` ADJACENTES sans un octet utile entre elles (87→88→89, delta 1 partout, mais la page
// 88 n'a aucun texte). C'est la vérité citable de `Source/` qui manque, invisible à la passe 1.
// Contenu UTILE = tout ce qui n'est ni une ancre, ni un blanc (espaces, sauts, insécables, largeur
// nulle) : le stock mesuré montre que la perte se présente aussi bien collée (LDB 08, 0 octet) que
// séparée par des blancs seuls.
// PÉRIMÈTRE : seules les PAIRES d'ancres d'un MÊME fichier sont jugées ; la dernière ancre d'un
// fichier est donc hors mesure. Mesuré sur le corpus (2026-09-01) : 86 folios vides-au-livre sont
// dans ce cas, 83 sont repris par la tête du chapitre suivant (page partagée, rien à signaler).
// ANGLE MORT vrai : les 3 restants sont la dernière ancre du DERNIER fichier de leur livre, sans
// repreneur possible — AA folio 144, ZI folio 144, MDG folio 160, mesurés SANS contenu utile au PDF
// (cf. le test qui les nomme). Toute fin de livre qui deviendrait porteuse échapperait à la garde.
// `\s` couvre deja insecables et BOM en JS ; la largeur nulle U+200B, non.
const BLANKS_RE = /[\s\u200B]+/g
const ANCHOR_SPAN_RE = /<span[^>]*data-folio="(-?\d+)"[^>]*>\s*<\/span>/g

/** `[{ folio, line }]` : folios dont la page n'a AUCUN contenu utile dans le texte (PUR). */
export function emptyFolioAnchorsInText(text) {
  const anchors = [...text.matchAll(new RegExp(ANCHOR_SPAN_RE))]
  const out = []
  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1]
    const between = text.slice(prev.index + prev[0].length, anchors[i].index)
    if (between.replace(BLANKS_RE, '') !== '') continue
    out.push({
      folio: Number(prev[1]),
      line: text.slice(0, prev.index).split('\n').length,
    })
  }
  return out
}

/** Balaie un dossier de livre → `[{ abbr, nn, file, fichier, ref, folio, line }]`. `fichier` = le
 *  CHEMIN du chapitre extrait depuis la racine du dépôt (`Source/<livre>/NN - X.md`, POSIX) — même
 *  nom que `scanBookDir#path`, le seul que le stock et la porte de plage partagent. */
export function scanEmptyFoliosInBook(abbr, dir) {
  const racine = String(dir).split('\\').join('/').replace(/\/$/, '')
  const out = []
  for (const [file, text] of chapterTexts(dir)) {
    const nn = numeroDExtraction(file)
    for (const e of emptyFolioAnchorsInText(text)) {
      out.push({ abbr, nn, file, fichier: `${racine}/${file}`, ref: `${abbr} ${nn}`, ...e })
    }
  }
  return out
}

/** Balaie tous les livres de `books` (BOOKS par défaut) → ancres sans contenu agrégées. */
export function scanAllEmptyFolios(books = BOOKS) {
  const out = []
  for (const [abbr, dir] of books) out.push(...scanEmptyFoliosInBook(abbr, dir))
  return out
}

const QUOI =
  "Sauts de la séquence `data-folio` des chapitres extraits : une ENTRÉE par saut mesuré (`<ABBR NN> " +
  "<from>→<to>`, des folios du PDF), sous le chapitre qui le porte. Dette d'EXTRACTION, pas de " +
  "rédaction : une entrée se solde en ré-extrayant la ou les pages manquantes. Mise à la forme " +
  "nominative le 2026-09-12 (#1711 T4) par conversion du compte par chapitre qui le précédait, à " +
  "somme égale chapitre par chapitre (76 sites, 46 chapitres). Ce fichier EST le rendu de " +
  "regenerations() de scripts/raw/check-folio-continuity.mjs, clé pour clé et dans l'ORDRE CANONIQUE " +
  "de la clé (parCleDeSite) — jamais dans l'ordre du balayage, donc réordonner src/data/books.json ne " +
  "le réécrit pas. Après une ré-extraction Marker il se réécrit par `npx tsx " +
  "scripts/guards/lib/regenStock.mts scripts/raw/check-folio-continuity.mjs`, qui refuse d'entériner " +
  "un saut NEUF (refusDeCroissance) et fait survivre les échéances posées à la main — il n'en pose " +
  "donc jamais lui-même ; scripts/raw/check-folio-continuity.test.mjs le vérifie."

/** La RÉGÉNÉRATION du stock des sauts (`RegenerationDeStock`, `stockDeSites.mjs`), sur des sauts (par
 *  défaut, ceux de tous les livres). */
export const regenerations = (gaps = scanAllBooks()) => [{
  chemin: STOCK_PATH,
  politique: DECROISSANT,
  horsCollections: QUOI,
  collections: [{
    nom: 'entrees',
    sites: sitesDeSauts(gaps),
    motif: 'Un saut NEUF se corrige en ré-extrayant la ou les pages manquantes ; le déclarer exige un `CLIQUET:` au message de commit.',
  }],
}]

/** Le SITE d'une ancre sans contenu, seule écriture de sa réf : le LIEU est le chapitre extrait, le
 *  FAIT est le folio (`<ABBR NN> folio <F>`) — même partage que `sitesDeSauts`, où `ref` porte le saut. */
export const siteDAncreVide = (ancre) => ({ file: ancre.fichier, ref: `${ancre.ref} folio ${ancre.folio}` })

/** Ancres sans contenu MESURÉES → entrées de site (`sitesEnEntrees`, définition unique de
 *  `guards/lib/stock.mjs`) : la clé `cleDeSite` se CALCULE, elle ne se grave pas. La `line` suit
 *  l'entrée hors clé, pour l'affichage seul : elle dérive. */
export const entreesDAncresVides = (vides) => sitesEnEntrees(vides.map((a) => ({ ...siteDAncreVide(a), line: a.line })))

/**
 * Seuil de caractères utiles au-dessus duquel la page PDF est jugée PORTEUSE de texte : c'est LUI qui
 * partage `perdues` de `benignes`, et il n'en existe pas d'autre écriture. Mesuré sur le corpus
 * (rapport de `lib/empty-folios-stock.mjs`) : les pages bénignes plafonnent bas (titre courant
 * + légende, la plus haute à 114), les pages perdues sont des pages de prose (la plus basse à 263).
 * IL VIT ICI, chez la GARDE, et pas chez l'instrument qui trie au PDF : le sens de l'import est
 * garde ← instrument, et le retourner fermerait un cycle ESM (l'instrument importe déjà la garde) et
 * ferait charger à la garde CI le module d'extraction PDF (`anchor-fill.mjs`), alors que son contrat
 * est de ne lire que les JSON committés.
 * Il ne vit SURTOUT pas dans la donnée : une copie `"seuil"` au stock se relèverait dans le MÊME
 * geste que le reclassement qu'elle doit dénoncer.
 */
export const SEUIL_UTILE = 200

/** Les DEUX stocks d'ancres sans contenu, lus sur le disque (`{ perdues, benignes }`). */
export const lireStocksAncresVides = () => ({
  perdues: lireEntreesDeSite(EMPTY_PERDUES_PATH),
  benignes: lireEntreesDeSite(EMPTY_BENIGNES_PATH),
})

// Confronte les ancres sans contenu MESURÉES aux DEUX stocks triés
// (`empty-folios-perdues-stock.json`, `empty-folios-benignes-stock.json` — tri fait par la mesure PDF
// de `lib/empty-folios-stock.mjs`, jamais à la main). Quatre anomalies : `inconnues` (mesurée, absente
// des stocks — à trier au PDF), `restituees` (page perdue revenue au `.md` → l'entrée se SUPPRIME, le
// stock décroît), `benignesDisparues` (l'ancre bénigne n'est plus adjacente à du vide → entrée
// périmée), et `malClassees` : le `pdfChars` porté par l'entrée ne s'accorde pas à sa classe au regard
// de `SEUIL_UTILE` (perdue ⇔ `pdfChars > seuil`). Sans ce dernier volet, déplacer une entrée de
// `perdues` vers `benignes` — ou regarnir le stock avec un `--seuil` complaisant — ferait baisser le
// compte des PERDUES sans un mot. Le seuil est unique et vit au code (`SEUIL_UTILE`, ci-dessus) : la
// garde ne lit aucun seuil de la DONNÉE, qu'un même geste aurait relevé avec le classement qu'il doit
// dénoncer.
// Une entrée dont le `pdfChars` n'est pas un nombre est INAUDITABLE, donc mal classée : c'est le même
// contournement par une autre porte.
// CE QUE LA CI NE REJOUE PAS : l'observé de la CLASSE. Aucun PDF n'est suivi par le dépôt
// (`git ls-files "*.pdf"` = 0), donc `pdfChars` est une mesure TRANSPORTÉE, faite une fois au PDF par
// le générateur ; la garde ne la vérifie QUE contre `SEUIL_UTILE`. Ce que la CI tient : la présence
// (`inconnues`/`restituees`/`benignesDisparues`) et la cohérence classe↔mesure.
// La restitution des entrées encore au stock (les folios ≤ 1, tous dans `00 - Index.md` : pages de
// garde et sommaires) est prioritée à #1622.
export function assertEmptyFoliosAgainstStock(measured, stock) {
  const mesurees = entreesDAncresVides(measured)
  const byKey = new Map(mesurees.map((e) => [cleDeSite(e), e]))
  const known = new Map()
  for (const cls of ['perdues', 'benignes']) for (const e of stock[cls] ?? []) known.set(cleDeSite(e), { cls, e })
  const inconnues = mesurees.filter((e) => !known.has(cleDeSite(e)))
  const restituees = []
  const benignesDisparues = []
  const malClassees = []
  for (const [key, { cls, e }] of known) {
    const auditable = typeof e.pdfChars === 'number'
    if (!auditable || (e.pdfChars > SEUIL_UTILE) !== (cls === 'perdues')) malClassees.push({ ...e, cls, seuil: SEUIL_UTILE })
    if (byKey.has(key)) continue
    ;(cls === 'perdues' ? restituees : benignesDisparues).push(e)
  }
  return { inconnues, restituees, benignesDisparues, malClassees }
}

// Passe 1 — séquence de folios (stock nominatif des sauts). Retourne `true` si anomalie.
function reportGaps() {
  const gaps = scanAllBooks()
  const { neuves, perimees } = ecartDuVolet({
    sites: sitesDeSauts(gaps), stock: lireEntreesDeSite(STOCK_PATH), ou: 'folio-gaps-stock.json',
  })

  console.log(`sauts de folio (data-folio non consécutif) : ${gaps.length} site(s) sur ${new Set(gaps.map((g) => g.ref)).size} chapitre(s)-réf`)

  if (neuves.length) {
    console.log('RÉGRESSION — saut(s) de folio hors du stock :')
    for (const o of neuves) console.log(`  ${o}`)
  }
  if (perimees.length) {
    console.log('Entrée(s) SOLDÉE(s) (sauts réparés) :')
    for (const s of perimees) console.log(`  ${s}`)
  }
  if (!neuves.length && !perimees.length) {
    console.log('OK — cliquet aligné, aucune régression.')
    return false
  }
  console.log('Détail (fichier — saut de folio N→M, ou folios de fin sans ancre dans le livre) :')
  for (const g of gaps) {
    const what = g.kind === 'fin'
      ? `folios ${g.from + 1}–${g.to} attendus après la dernière ancre (folio ${g.from}), ancrés nulle part dans le livre`
      : `folio ${g.from} → ${g.to} (Δ${g.delta})`
    console.log(`${g.abbr} ${g.nn} (${g.file}) — ${what}`)
  }
  return true
}

// Passe 2 — ancres sans contenu (stock nominatif trié). Retourne `true` si anomalie.
function reportEmptyFolios() {
  const measured = scanAllEmptyFolios()
  const stock = lireStocksAncresVides()
  const { inconnues, restituees, benignesDisparues, malClassees } = assertEmptyFoliosAgainstStock(measured, stock)
  const perdues = stock.perdues

  console.log(`ancres sans contenu (page vide entre deux ancres) : ${measured.length} mesurée(s) — stock : ${perdues.length} PERDUE(s) au PDF, ${stock.benignes.length} bénigne(s)`)
  const situe = (e) => `${e.ref} (${e.fichier})${e.line ? ` l.${e.line}` : ''}`

  if (inconnues.length) {
    console.log('RÉGRESSION — ancre sans contenu ABSENTE du stock (à trier au PDF : npx tsx scripts/guards/lib/regenStock.mts scripts/raw/lib/empty-folios-stock.mjs) :')
    for (const e of inconnues) console.log(`  ${situe(e)}`)
  }
  if (restituees.length) {
    console.log('Stock PÉRIMÉ — page restituée dans le .md : SUPPRIMER l\'entrée de empty-folios-perdues-stock.json :')
    for (const e of restituees) console.log(`  ${situe(e)}`)
  }
  if (benignesDisparues.length) {
    console.log('Stock PÉRIMÉ — entrée bénigne sans mesure correspondante : SUPPRIMER de empty-folios-benignes-stock.json :')
    for (const e of benignesDisparues) console.log(`  ${situe(e)}`)
  }
  if (malClassees.length) {
    console.log(`Stock INCOHÉRENT — classement démenti par le pdfChars mesuré (seuil ${SEUIL_UTILE}, check-folio-continuity.mjs) :`)
    for (const e of malClassees) console.log(`  ${situe(e)} — classée ${e.cls}, ${e.pdfChars} car. utiles au PDF`)
  }
  if (!inconnues.length && !restituees.length && !benignesDisparues.length && !malClassees.length) {
    console.log('OK — stock aligné, aucune régression.')
    return false
  }
  return true
}

function main() {
  const koGaps = reportGaps()
  const koEmpty = reportEmptyFolios()
  if (koGaps || koEmpty) process.exitCode = 1
}

if (import.meta.main) main()
