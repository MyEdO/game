// Garde des RENVOIS D'ANCRE de l'Atlas RAW (#1824) : tout lien d'ancre écrit dans une page de
// `docs/raw/` désigne une ancre EXISTANTE de la page qu'il vise — `](#un-titre)` (la page courante),
// `](autre.md#un-titre)` (la sœur), `](../coeur/autre.md#un-titre)` (l'autre cœur). Une page visée
// que l'Atlas ne porte pas est un renvoi mort de même : le lien ne mène à rien.
// AUCUN STOCK, aucune exemption nominative : l'ancre se CALCULE (`lib/ancres.mjs`, définition
// unique), donc un renvoi mort est un renvoi FAUX, jamais un héritage à geler. Un renvoi mort se
// répare — `node scripts/raw/reparer-ancres.mjs --dry` rend ceux que le pliage de la cible citée
// résout, les autres se corrigent à la main, au titre qu'ils nomment.
// La POPULATION vient de la couture unique `pagesDeLAtlas` (toutes les classes de page) : une page,
// un cœur, une classe de plus coûte zéro ligne ici.
// Cette garde n'écrit RIEN.
// Re-run : node scripts/raw/check-ancres.mjs (npm run raw:check-ancres).
import { posix } from 'node:path'
import { CLASSES_DE_PAGE, pagesDeLAtlas, readText } from './_lib.mjs'
import { liensJugeables } from '../guards/lib/liensMarkdown.mjs'
import { tableDAncres } from './lib/ancres.mjs'

export const RAWDIR = 'docs/raw'

/** Les pages de l'Atlas, LUES une fois : chemin relatif → texte et TABLE de ses ancres. */
export function pagesAvecAncres(rawDir = RAWDIR) {
  const pages = new Map()
  for (const p of pagesDeLAtlas(rawDir, { classes: CLASSES_DE_PAGE })) {
    const texte = readText(p.chemin)
    pages.set(p.relatif, { texte, table: tableDAncres(texte) })
  }
  return pages
}

/**
 * Tous les RENVOIS D'ANCRE des pages reçues — PUR (les pages sont déjà lues).
 * `vise` est le chemin relatif de la page DÉSIGNÉE, résolu depuis le dossier de la page courante.
 * @param {Map<string, { texte: string }>} pages
 * @returns {Array<{ page: string, ligne: number, ecrit: string, cible: string, ancre: string, vise: string }>}
 */
export function renvoisDAncre(pages) {
  const renvois = []
  for (const [page, { texte }] of pages) {
    const { texteScanne, liens } = liensJugeables(texte, { ancresSeules: true })
    for (const lien of liens) {
      if (!lien.ancre) continue
      const ligne = texteScanne.slice(0, lien.index).split('\n').length
      const vise = lien.cible ? posix.normalize(posix.join(posix.dirname(page), lien.cible)) : page
      renvois.push({ page, ligne, ecrit: lien.ecrit, cible: lien.cible, ancre: lien.ancre, vise })
    }
  }
  return renvois
}

/** Les renvois MORTS parmi ceux qu'on lui donne, chacun avec sa CAUSE — PUR. */
export function renvoisMorts(pages, renvois = renvoisDAncre(pages)) {
  const morts = []
  for (const r of renvois) {
    const cible = pages.get(r.vise)
    if (!cible) { morts.push({ ...r, cause: `page visée absente de l’Atlas (${r.vise})` }); continue }
    if (!cible.table.has(r.ancre)) morts.push({ ...r, cause: `aucune ancre « ${r.ancre} » dans ${r.vise}` })
  }
  return morts
}

function main(rawDir = RAWDIR) {
  const pages = pagesAvecAncres(rawDir)
  const renvois = renvoisDAncre(pages)
  const morts = renvoisMorts(pages, renvois)
  console.log(`check-ancres : ${renvois.length} renvoi(s) d'ancre sur ${pages.size} page(s) de l'Atlas — ${morts.length} mort(s)`)
  if (morts.length) {
    for (const m of morts) console.log(`  ${rawDir}/${m.page}:${m.ligne} ](${m.ecrit}) — ${m.cause}`)
    console.log('Un renvoi d’ancre ne se gèle pas : `node scripts/raw/reparer-ancres.mjs --dry` plie les cibles citées, le reste se vise à la main.')
    process.exitCode = 1
    return
  }
  console.log('OK — chaque renvoi d’ancre de l’Atlas désigne une ancre existante de la page qu’il vise.')
}

if (import.meta.main) main()
