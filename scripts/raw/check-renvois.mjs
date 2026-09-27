// Garde des RENVOIS « page N » du texte des livres de `Source/` (#1393, épique #1388). Le résolveur
// PUR `src/data/source/renvoi.ts` rend chaque renvoi en ADRESSE avec son niveau de preuve ; ce script
// l'applique à tout livre EXTRAIT dont la `language` (`src/data/books.json`) a sa table de motifs
// (`MOTIFS_DE_RENVOI`) — aucun livre n'est nommé ici.
//
// STOCK NOMINATIF (`scripts/raw/renvois-stock.json`, régime #1711) : une ENTRÉE par renvoi que la
// preuve ne départage pas — famille `ambigu` ou `introuvable` —, clé
// `famille :: fichier :: ref :: occurrence` (`guards/lib/stock.mjs`, `cleDeSite`). La `ref` est
// `slug#occ :: p.N :: rang R` : la SECTION porteuse (forme de `CLE_DE_REF`, `recouper-source.mjs`), le
// folio visé, et le rang du renvoi parmi ceux de la section vers ce folio — jamais une ligne, jamais
// un compte. Les deux sens sont rouges : un renvoi non résolu hors du stock, une entrée dont le
// renvoi se résout désormais (la retirer).
//
// Re-run    : node scripts/raw/check-renvois.mjs
// Régénérer : node scripts/raw/check-renvois.mjs --ecrire-stock [--lot <#N …>] — le lot est REQUIS dès qu'une entrée NEUVE naît (`ecrireStockSousLot`, scripts/guards/lib/stock.mjs)
import { writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REGISTRE_LIVRES, livreExtraitDe } from './_lib.mjs'
import { ecartDuVolet, ecrireStockSousLot, sitesEnEntrees, survieDeLecheance } from '../guards/lib/stock.mjs'
import { parCleDeSite, readStock, texteDeStock } from './stockNominatif.mjs'
import { chapitresParses } from '../source/lecteur-fs.mjs'
import { MOTIFS_DE_RENVOI, indexerLivre, renvoisDuLivre } from '../../src/data/source/renvoi.ts'

export const STOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'renvois-stock.json')

/** Les familles du stock : les niveaux où la preuve ne départage pas. */
export const FAMILLES = ['ambigu', 'introuvable']

/** Livres couverts : extraits, et dont la langue a ses motifs de renvoi. */
export const livresCouverts = (registre = REGISTRE_LIVRES) =>
  registre.filter((b) => livreExtraitDe(b.id, registre) && MOTIFS_DE_RENVOI[b.language])

/** Livre indexé depuis le disque (`scripts/source/lecteur-fs.mjs`). */
export const livreIndexe = (livre) => indexerLivre(livre.id, livre.language, chapitresParses(livre.id))

/** RÉF d'un renvoi : section porteuse, folio visé, rang dans la section vers ce folio. */
export const refDeRenvoi = (r) => `${r.slug}#${r.occ} :: p.${r.renvoi.folio} :: rang ${r.rang}`

/** Sites d'UN livre indexé (PUR) : ses renvois non résolus. */
export const sitesDuLivre = (dir, livre) =>
  renvoisDuLivre(livre)
    .filter((r) => FAMILLES.includes(r.resolution.niveau))
    .map((r) => ({ famille: r.resolution.niveau, file: `${dir}/${r.fichier}`, ref: refDeRenvoi(r) }))

/** Sites de tous les livres couverts. */
export const scanAll = (livres = livresCouverts()) => livres.flatMap((l) => sitesDuLivre(l.dir, livreIndexe(l)))

/** Les ENTRÉES du stock, en ordre canonique (`parCleDeSite`). */
export const entreesDe = (sites, { lot, date, ancien = [] }) =>
  FAMILLES.flatMap((famille) =>
    survieDeLecheance(sitesEnEntrees(sites.filter((s) => s.famille === famille), { famille }), { lot, date, ancien }),
  ).sort(parCleDeSite)

/** ÉCART au stock, famille par famille. */
export function ecartDuStock(sites, stock) {
  const neuves = []
  const perimees = []
  for (const famille of FAMILLES) {
    const r = ecartDuVolet({
      sites: sites.filter((s) => s.famille === famille),
      stock: stock.filter((e) => e.famille === famille),
      famille,
      ou: 'renvois-stock.json',
    })
    neuves.push(...r.neuves)
    perimees.push(...r.perimees)
  }
  return { neuves, perimees }
}

const QUOI =
  'Renvois « page N » du texte de `Source/` que le résolveur `src/data/source/renvoi.ts` ne départage ' +
  'pas (#1393) : famille `ambigu` (plusieurs sections candidates au folio, ou table nommée qu’aucun ' +
  'titre ne porte) ou `introuvable` (aucun texte au folio). Livres couverts : extraits, dont la ' +
  '`language` a ses motifs (`MOTIFS_DE_RENVOI`). Une ENTRÉE par renvoi, clé ' +
  '`famille :: fichier :: ref :: occurrence` (régime #1711) ; la réf est `slug#occ :: p.N :: rang R` — ' +
  'section porteuse, folio visé, rang parmi les renvois de la section vers ce folio. Ce fichier ' +
  'ne fait que décroître : une entrée part quand son renvoi se résout.'

/** Rend le CONTENU du fichier de stock pour des sites mesurés (source unique de sa forme). */
export const stockDe = (sites, { lot, date, ancien = [] }) => texteDeStock(QUOI, entreesDe(sites, { lot, date, ancien }))

function main() {
  const args = process.argv.slice(2)
  const sites = scanAll()
  const stock = readStock(STOCK_PATH)

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

  console.log(
    `renvois non résolus : ${sites.length} — ${FAMILLES.map((f) => `${f} ${sites.filter((s) => s.famille === f).length}`).join(', ')} ` +
      `(${livresCouverts().map((l) => l.abbr).join(', ')})`,
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
