// OUTIL de réparation des renvois d'ancre morts de l'Atlas RAW (#1824) — il sert la garde
// `check-ancres.mjs`, dont il prend la mesure (population des pages, table d'ancres, renvois morts)
// au lieu de la redire.
// PLIAGE ÉTAGÉ de l'ancre CITÉE contre les ancres de la page visée : 1. accents dépouillés ;
// 2. accents dépouillés ET suites de `-` fusionnées. Un seul candidat à l'étage atteint → le renvoi
// se réécrit sur l'ancre RÉELLE ; zéro ou plusieurs → le renvoi se rend tel quel, jamais deviné.
// Le `-` de BORD ne se rogne à aucun étage : mesuré sur le corpus, un rognage fait collider 21
// renvois avec des titres homonymes de `docs/raw/4e/combat.md`, et une collision se réécrit en
// silence sur la mauvaise section.
// Écrit en `\n` (l'arbre est `eol=lf`), et seulement sous `--apply` : sans lui, l'outil ne fait que
// rendre ce qu'il ferait. Idempotent — une seconde passe ne réécrit rien.
// Usage : node scripts/raw/reparer-ancres.mjs [--dry] [--apply]
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pagesAvecAncres, renvoisMorts, RAWDIR } from './check-ancres.mjs'

/** Les DEUX étages de pliage, dans l'ordre où on les essaie — le plus fidèle d'abord. */
export const ETAGES = [
  { nom: 'accents', plier: (s) => s.normalize('NFD').replace(/\p{M}/gu, '') },
  { nom: 'accents+tirets', plier: (s) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/-+/g, '-') },
]

/**
 * Le verdict d'un renvoi mort : l'ancre RÉELLE qu'il visait, ou ce qui empêche de le dire — PUR.
 * @param {string} ancre l'ancre CITÉE par le renvoi
 * @param {Set<string>} table les ancres de la page visée
 * @returns {{ etat: 'reparable', etage: string, ancre: string } | { etat: 'ambigu', etage: string, candidats: string[] } | { etat: 'residuel' }}
 */
export function verdictDeRenvoi(ancre, table) {
  const ancres = [...table]
  for (const { nom, plier } of ETAGES) {
    const cible = plier(ancre)
    const candidats = ancres.filter((a) => plier(a) === cible)
    if (candidats.length === 1) return { etat: 'reparable', etage: nom, ancre: candidats[0] }
    if (candidats.length > 1) return { etat: 'ambigu', etage: nom, candidats }
  }
  return { etat: 'residuel' }
}

/**
 * Les renvois morts de l'Atlas, chacun avec son verdict — l'outil ne lit rien que la garde ne lise.
 * @param {Map<string, { texte: string, table: Set<string> }>} pages
 */
export const verdicts = (pages) =>
  renvoisMorts(pages).map((m) => ({ ...m, ...verdictDeRenvoi(m.ancre, pages.get(m.vise)?.table ?? new Set()) }))

/**
 * Le texte d'une page, ses renvois réparables réécrits — PUR. La substitution est LITTÉRALE et
 * bornée à la ligne du renvoi : la cible seule change, la prose qui porte le lien n'est pas touchée.
 * @param {string} texte
 * @param {Array<{ ligne: number, ecrit: string, ancre: string }>} reparations
 * @returns {string}
 */
export function pageReecrite(texte, reparations) {
  const lignes = texte.split('\n')
  for (const r of reparations) {
    const i = r.ligne - 1
    const nouveau = `${r.ecrit.replace(/#.*$/, '')}#${r.ancre}`
    lignes[i] = lignes[i].split(`](${r.ecrit})`).join(`](${nouveau})`)
  }
  return lignes.join('\n')
}

/**
 * La passe complète : mesure, rapport, et — sous `--apply` — réécriture des pages.
 * @param {string[]} [argv] `--apply` pour écrire ; sans lui, l'outil ne fait que dire
 * @param {string} [rawDir] l'Atlas sur lequel il travaille (un banc lui donne un Atlas JETABLE)
 * @returns {{ reparables: number, ambigus: number, residuels: number, pages: number }}
 */
export function reparer(argv = process.argv.slice(2), rawDir = RAWDIR) {
  const applique = argv.includes('--apply')
  const pages = pagesAvecAncres(rawDir)
  const tous = verdicts(pages)
  const reparables = tous.filter((v) => v.etat === 'reparable')
  const ambigus = tous.filter((v) => v.etat === 'ambigu')
  const residuels = tous.filter((v) => v.etat === 'residuel')
  console.log(
    `reparer-ancres (${applique ? 'apply' : 'dry'}) : ${tous.length} renvoi(s) mort(s) — `
    + `${reparables.length} réparable(s), ${ambigus.length} ambigu(s), ${residuels.length} résiduel(s)`,
  )
  for (const e of ETAGES) console.log(`  étage « ${e.nom} » : ${reparables.filter((r) => r.etage === e.nom).length} réparable(s)`)
  for (const a of ambigus) console.log(`  AMBIGU ${rawDir}/${a.page}:${a.ligne} ](${a.ecrit}) → ${a.candidats.join(' | ')}`)
  for (const r of residuels) console.log(`  RÉSIDUEL ${rawDir}/${r.page}:${r.ligne} ](${r.ecrit}) — ${r.cause}`)
  for (const r of reparables) console.log(`  ${applique ? 'réécrit' : 'réécrirait'} ${rawDir}/${r.page}:${r.ligne} ](${r.ecrit}) → ](${r.ecrit.replace(/#.*$/, '')}#${r.ancre})`)
  const bilan = { reparables: reparables.length, ambigus: ambigus.length, residuels: residuels.length, pages: 0 }
  if (!applique) return bilan
  const parPage = new Map()
  for (const r of reparables) parPage.set(r.page, [...(parPage.get(r.page) ?? []), r])
  for (const [page, reparations] of parPage) {
    const avant = pages.get(page).texte
    const apres = pageReecrite(avant, reparations)
    if (apres === avant) continue
    writeFileSync(join(rawDir, page), apres, 'utf8')
    bilan.pages++
    console.log(`  écrit ${rawDir}/${page} (${reparations.length} renvoi(s))`)
  }
  return bilan
}

if (import.meta.main) reparer()
