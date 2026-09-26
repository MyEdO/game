// Garde de la PUCE IMPRIMÉE LUE COMME UN JETON (#1820). Les PDF sources impriment leurs listes avec
// un glyphe d'ornement (Core Rulebook 5e : le chiffre `0` de la police `onlyskulls`, un petit
// crâne) ; l'extraction Marker rend le CODE du glyphe, pas la puce. La ligne extraite porte alors un
// caractère que la page n'imprime nulle part, et toute fiche d'Atlas qui la cite cite un fantôme.
//
// CE QUI EST UN SITE : une LISTE dont au moins DEUX items consécutifs s'ouvrent par le MÊME jeton
// d'un seul caractère (`- 0 Texte` / `- 0 Texte`, ou sans marqueur `0 Texte` / `0 Texte` quand
// l'extraction a aussi perdu le `- `). Le jeton n'est écrit NULLE PART ici : c'est sa RÉPÉTITION qui
// le désigne — un livre dont la puce se lit `O`, `Q` ou `•` entre par la même porte, sans une ligne
// de plus.
// CE QUI N'EN EST PAS : une liste réellement NUMÉROTÉE (`0`, `1`, `2`…), dont les jetons DIFFÈRENT
// d'un item à l'autre ; c'est la contre-épreuve du banc.
// COUVERTURE DITE — deux formes restent invisibles, et le banc les DIT :
//  · l'item ISOLÉ (liste d'UN seul item, ou item sans frère portant le même jeton) : la répétition
//    EST le signal, et un item seul ne se distingue pas d'une valeur légitime en tête de ligne
//    (`0 Wounds`) ;
//  · la puce INTERNE à une ligne (colonnes de la page effondrées par l'extraction sur une seule
//    ligne, `- *Ablaze* 0 *Besmirched*`) : le jeton n'y ouvre pas la ligne.
//
// STOCK NOMINATIF (`scripts/raw/source-puces-stock.json`, régime #1711) : une ENTRÉE par SITE, clé
// `fichier :: ref :: occurrence` (`guards/lib/stock.mjs`, `cleDeSite`). La réf porte du CONTENU — le
// jeton et l'ouverture normalisée du premier item —, jamais une position : un paragraphe inséré
// au-dessus ne périme rien. Les deux sens sont rouges : un site MESURÉ hors du stock, une entrée
// SANS site mesuré (extraction réparée : la retirer).
//
// Re-run    : node scripts/raw/check-source-puces.mjs
// Régénérer : node scripts/raw/check-source-puces.mjs --ecrire-stock [--lot <#N …>] — le lot est REQUIS dès qu'une entrée NEUVE naît (`ecrireStockSousLot`, scripts/guards/lib/stock.mjs)
import { writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerDossier } from '../guards/lib/lister.mjs'
import { BOOKS, readText } from './_lib.mjs'
import { estNomDExtraction } from '../../src/data/source/decoupe.ts'
import { ecartDuVolet, ecrireStockSousLot, sitesEnEntrees, survieDeLecheance } from '../guards/lib/stock.mjs'
import { parCleDeSite, readStock, texteDeStock } from './stockNominatif.mjs'
import { normText } from '../../src/data/source/decoupe.ts'

export const STOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'source-puces-stock.json')

/** Longueur de l'ouverture citée dans la réf : assez pour nommer l'item, assez court pour survivre à
 *  une réparation de césure plus loin dans la ligne. */
const OUVERTURE = 60

// Un item de liste dont le CONTENU s'ouvre par un jeton d'UN caractère suivi d'une espace. Le
// marqueur `- ` est OPTIONNEL : l'extraction le perd là où la puce imprimée était seule sur sa
// colonne, et la classe est la même. Le jeton doit être suivi d'un contenu : `- 0 ` nu n'est rien.
// La PONCTUATION DE STRUCTURE Markdown est hors jeu (`STRUCTURE`) : un marqueur de liste, une
// rangée de table, un titre ou une citation ne sont pas des glyphes imprimés sur la page, et un
// `|` répété d'une rangée à l'autre nommerait toutes les tables du corpus.
const STRUCTURE = '-*+>|#='
const ITEM = new RegExp(`^[ \\t]*(?:- )?([^\\s${STRUCTURE.replace(/[-*+|]/g, '\\$&')}]) (\\S.*)$`)
// Le jeton est HORS DE LA PHRASE : ce qui le suit OUVRE un item (majuscule, chiffre, ou habillage
// Markdown d'un intitulé). Sans cette borne, toute prose anglaise ouvrant deux paragraphes par
// « A … » se lirait comme un item à jeton `A`, et aucune de ces suites n'est un glyphe.
const OUVRE_UN_ITEM = /^(?:\*|\[|\d|\p{Lu})/u
// Le jeton lui-même n'est jamais une PONCTUATION OUVRANTE. Un caractère de catégorie Unicode `Pi`
// ou `Ps` (`«`, `“`, `‹`, `(`, `[`…) ouvre une citation ou une incise dont la page IMPRIME le
// signe : ce qui suit est du texte cité, pas un item. Propriété de la catégorie, aucune liste de
// caractères ni de livre. À ne pas confondre avec `OUVRE_UN_ITEM`, qui admet `[` en position de
// CONTENU (un intitulé entre crochets), APRÈS le jeton.
const PONCTUATION_OUVRANTE = /^[\p{Pi}\p{Ps}]$/u

/** Le jeton d'ouverture d'une ligne et son contenu, ou `null` (PUR). */
export function jetonDeLigne(ligne) {
  const m = ITEM.exec(String(ligne).replace(/\r$/, ''))
  if (!m || PONCTUATION_OUVRANTE.test(m[1]) || !OUVRE_UN_ITEM.test(m[2])) return null
  return { jeton: m[1], contenu: m[2] }
}

/** RÉF d'un site : le JETON et l'ouverture NORMALISÉE du premier item de la suite — du contenu,
 *  jamais une position. */
export const refDeSuite = (jeton, contenu) => `« ${jeton} » :: ${normText(contenu).slice(0, OUVERTURE)}`

/**
 * Sites d'UN chapitre (PUR : aucun accès disque) : les suites d'au moins DEUX items consécutifs
 * partageant le même jeton. Une ligne VIDE ne rompt pas la suite (l'extraction sépare souvent les
 * items par un blanc) ; toute autre ligne la rompt.
 * @param {string} texte @param {string} file @returns {{ file: string, ref: string }[]}
 */
export function sitesDuChapitre(texte, file) {
  const out = []
  let suite = null
  const solder = () => {
    if (suite && suite.items.length >= 2) out.push({ file, ref: refDeSuite(suite.jeton, suite.items[0]) })
    suite = null
  }
  for (const ligne of String(texte).split('\n')) {
    if (ligne.trim() === '') continue
    const item = jetonDeLigne(ligne)
    if (!item) { solder(); continue }
    if (suite && suite.jeton === item.jeton) { suite.items.push(item.contenu); continue }
    solder()
    suite = { jeton: item.jeton, items: [item.contenu] }
  }
  solder()
  return out
}

/** Chemin POSIX d'un chapitre depuis la racine du dépôt (`Source/<livre>/<NN - X>.md`). */
const cheminDe = (dir, file) => `${String(dir).split('\\').join('/').replace(/\/$/, '')}/${file}`

/** Balaie un dossier de livre → sites de tous ses chapitres. */
export function scanBookDir(dir) {
  const out = []
  // Toute la FORME servie est jugée, l'index compris : il porte des puces comme un chapitre.
  for (const file of listerDossier(dir, { absent: 'vide' }).filter(estNomDExtraction)) {
    out.push(...sitesDuChapitre(readText(join(dir, file)), cheminDe(dir, file)))
  }
  return out
}

/** Balaie tous les livres de `books` (BOOKS par défaut) → sites agrégés, dans l'ordre du corpus. */
export function scanAllBooks(books = BOOKS) {
  const out = []
  for (const [, dir] of books) out.push(...scanBookDir(dir))
  return out
}

/**
 * Les ENTRÉES du stock, en ORDRE CANONIQUE (`parCleDeSite`) — c'est CE rendu que le fichier porte.
 * L'ordre du BALAYAGE n'y entre pas : réordonner `src/data/books.json` ne réécrit pas le fichier
 * (#1825). `ancien` porte la SURVIE de l'échéance (`survieDeLecheance`, seule définition du dépôt).
 */
export const entreesDe = (sites, { lot, date, ancien = [] }) =>
  survieDeLecheance(sitesEnEntrees(sites), { lot, date, ancien }).sort(parCleDeSite)

/** ÉCART au stock, dans les deux sens. */
export const ecartDuStock = (sites, stock) =>
  ecartDuVolet({ sites, stock, ou: 'source-puces-stock.json' })

/** Compte des sites par LIVRE (`dir` du registre), dans l'ordre du registre. */
export function comptesParLivre(sites, books = BOOKS) {
  const parDir = new Map(books.map(([abbr, dir]) => [`${String(dir).split('\\').join('/').replace(/\/$/, '')}/`, abbr]))
  const out = new Map(books.map(([abbr]) => [abbr, 0]))
  for (const s of sites) {
    for (const [prefixe, abbr] of parDir) if (s.file.startsWith(prefixe)) { out.set(abbr, out.get(abbr) + 1); break }
  }
  return out
}

const QUOI =
  'Listes du `Source/` dont au moins DEUX items consécutifs s’ouvrent par le MÊME jeton d’un seul ' +
  'caractère (#1820) : la PUCE imprimée que l’extraction Marker a rendue par le CODE de son glyphe ' +
  'd’ornement, un caractère que la page n’imprime nulle part. Une ENTRÉE par SITE, clé ' +
  '`fichier :: ref :: occurrence` (régime #1711) ; la réf porte le jeton et l’ouverture normalisée ' +
  'du premier item, jamais une position. Le geste de solde est celui de ' +
  '`docs/ajouter-un-livre-source.md` : le jeton PART si la page n’imprime qu’une puce (et devient le ' +
  'marqueur `- ` là où l’extraction l’a perdu), il RESTE si la page l’imprime. Ce fichier ne décroît ' +
  'que quand un site disparaît du `Source/` ; il ne porte AUCUN livre en code, seulement les ' +
  'chapitres mesurés.'

/** Rend le CONTENU du fichier de stock pour des sites mesurés (source unique de sa forme). */
export const stockDe = (sites, { lot, date, ancien = [] }) =>
  texteDeStock(QUOI, entreesDe(sites, { lot, date, ancien }))

function main() {
  const sites = scanAllBooks()
  const stock = readStock(STOCK_PATH)

  const args = process.argv.slice(2)
  if (args.includes('--ecrire-stock')) {
    const r = ecrireStockSousLot(
      args,
      (lot, date) => ({ entrees: entreesDe(sites, { lot, date, ancien: stock }), texte: stockDe(sites, { lot, date, ancien: stock }) }),
      (texte) => writeFileSync(STOCK_PATH, texte),
      STOCK_PATH,
    )
    ;(r.code ? console.error : console.log)(r.message)
    process.exitCode = r.code
    return
  }

  const parLivre = [...comptesParLivre(sites)].filter(([, n]) => n > 0).map(([a, n]) => `${a} ${n}`)
  console.log(
    `puces lues comme un jeton : ${sites.length} site(s) sur ${new Set(sites.map((s) => s.file)).size} chapitre(s)` +
      ` — ${parLivre.join(', ') || 'aucun livre porteur'}`,
  )
  const { neuves, perimees } = ecartDuStock(sites, stock)
  for (const l of [...neuves, ...perimees]) console.error(l)
  if (neuves.length || perimees.length) {
    console.error(`\nstock : ${stock.length} entrée(s), ${neuves.length} neuve(s), ${perimees.length} soldée(s).`)
    process.exitCode = 1
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
