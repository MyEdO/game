// CARTE DE LIGNES EXACTE d'un fichier : ancienne ligne (`git HEAD`) → son DESTIN dans l'arbre de
// travail, lue au diff `git diff -U0`, jamais interpolée (#1739). Deux consommateurs : les réfs à
// ligne de l'Atlas (`reanchor.mjs --remap`) et les clés de stock `slug#occ` (`recouper-source.mjs
// --suivre-diff`, par `carteDesSlugs`).
//
// Le destin d'une ancienne ligne :
//   { ligne: N }                     inchangée, éditée EN PLACE (hunk à compte égal dont chaque paire
//                                    de même rang CORRESPOND, appariée 1:1),
//                                    ou APPARIÉE sinon (`appariement`) ;
//   { supprimee: true }              disparue (suppression pure, ou non appariée d'un hunk dont
//                                    toutes les nouvelles lignes sont appariées) ;
//   { ambigue: true, candidates }    tout autre cas — la décision revient au consommateur.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { hunksDe } from '../../guards/lib/hunks.mjs'
import { normalize } from '../_lib.mjs'
import { stripSpans } from '../../../src/data/source/decoupe.ts'

/** @typedef {import('../../guards/lib/hunks.mjs').Hunk} Hunk */
/** @typedef {{ ligne: number } | { supprimee: true } | { ambigue: true, candidates: number[] }} Destin */

/** Texte comparé d'une ligne : ses ancres `<span>` ôtées (`stripSpans`), puis `normalize` — une ancre
 *  posée dans une ligne ne la change pas. */
const norme = (s) => normalize(stripSpans(s))
const jetons = (s) => norme(s).split(' ').filter(Boolean)
const NON_TRIVIAL = /\p{L}{3}/u

/** `petite` est-elle `grande` MOINS des jetons (sous-suite), avec un jeton commun non trivial ? */
function estAmputee(petite, grande) {
  if (!petite.some((t) => NON_TRIVIAL.test(t))) return false
  let k = 0
  for (const t of grande) if (k < petite.length && t === petite[k]) k++
  return k === petite.length
}

/** La nouvelle ligne CORRESPOND-elle à l'ancienne : (a) égale après `norme`, ou (b) son amputée ? */
const correspond = (nouvelle, ancienne) =>
  norme(nouvelle) === norme(ancienne) || estAmputee(jetons(nouvelle), jetons(ancienne))

/**
 * APPARIEMENT d'un hunk à compte inégal : pour chaque nouvelle ligne, l'ancienne qui lui est
 * (a) égale après `normalize`, sinon (b) dont elle est l'amputée (`estAmputee`) — retenue seulement
 * si elle est UNIQUE. L'appariement vaut s'il est injectif et CROISSANT ; sinon `null`. PUR.
 * @param {string[]} retirees @param {string[]} ajoutees
 * @returns {(number | null)[] | null} indice de l'ancienne ligne de chaque nouvelle (null = aucune)
 */
export function appariement(retirees, ajoutees) {
  const vieux = retirees.map(jetons)
  const egales = retirees.map(norme)
  const paires = ajoutees.map((l) => {
    const n = norme(l)
    const a = egales.flatMap((e, i) => (e === n ? [i] : []))
    if (a.length) return a.length === 1 ? a[0] : undefined
    const j = jetons(l)
    const b = vieux.flatMap((v, i) => (estAmputee(j, v) ? [i] : []))
    return b.length === 1 ? b[0] : b.length ? undefined : null
  })
  if (paires.includes(undefined)) return null
  const prises = paires.filter((i) => i !== null)
  for (let k = 1; k < prises.length; k++) if (prises[k] <= prises[k - 1]) return null
  return paires
}

/** Destins des anciennes lignes d'un hunk qui en retire (`b > 0`), dans l'ordre. Un hunk à compte
 *  égal ne s'apparie 1:1 que si CHAQUE paire de même rang correspond ; sinon il suit l'appariement. */
function destinsDuHunk(h) {
  const nouvelles = Array.from({ length: h.d }, (_, k) => h.c + k)
  if (h.d === 0) return Array.from({ length: h.b }, () => ({ supprimee: true }))
  const lu = h.retirees.length === h.b && h.ajoutees.length === h.d
  if (lu && h.d === h.b && h.ajoutees.every((l, k) => correspond(l, h.retirees[k]))) return nouvelles.map((ligne) => ({ ligne }))
  const ambigue = { ambigue: true, candidates: nouvelles }
  const paires = lu ? appariement(h.retirees, h.ajoutees) : null
  if (!paires) return Array.from({ length: h.b }, () => ambigue)
  const complet = !paires.includes(null)
  return Array.from({ length: h.b }, (_, i) => {
    const j = paires.indexOf(i)
    return j >= 0 ? { ligne: h.c + j } : complet ? { supprimee: true } : ambigue
  })
}

/**
 * La CARTE d'un fichier depuis ses hunks. PUR. Aucun hunk = identité.
 * Un hunk d'insertion pure (`b = 0`) insère APRÈS l'ancienne ligne `a` (git, format `-U0`).
 * @param {Hunk[]} hunks @returns {(n: number) => Destin}
 */
export function carteDeLignes(hunks) {
  const tries = [...hunks].sort((x, y) => x.a - y.a).map((h) => ({ h, destins: h.b > 0 ? destinsDuHunk(h) : [] }))
  return (x) => {
    if (!Number.isInteger(x) || x < 1) throw new TypeError(`carteDeLignes : « ${x} » n'est pas un numéro de ligne (entier ≥ 1)`)
    let decalage = 0
    for (const { h, destins } of tries) {
      const fin = h.b === 0 ? h.a : h.a + h.b - 1
      if (h.b > 0 && x >= h.a && x <= fin) return destins[x - h.a]
      if (fin >= x) break
      decalage += h.d - h.b
    }
    return { ligne: x + decalage }
  }
}

/** Le destin en TEXTE, pour un rapport. @param {Destin} d @returns {string} */
export const destinEnTexte = (d) =>
  'ligne' in d ? `l.${d.ligne}` : d.supprimee ? 'ligne supprimée' : `hunk ambigu, candidates l.${d.candidates.join('/')}`

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })

/**
 * ENROBAGE git : la version `HEAD` d'un fichier et sa carte vers l'arbre de travail — ou `null` si
 * le fichier est absent de `HEAD` (aucune ancienne ligne à porter). LÈVE si le fichier de l'arbre
 * porte un CR isolé (#604) : git n'y voit pas de fin de ligne, `readText` si — les deux
 * numérotations divergeraient.
 * @param {string} chemin depuis la racine du dépôt
 * @returns {{ texteHead: string, carte: (n: number) => Destin, hunks: Hunk[] } | null}
 */
export function carteDuFichier(chemin) {
  const posix = String(chemin).split('\\').join('/')
  if (/\r(?!\n)/.test(readFileSync(posix, 'utf8'))) {
    throw new Error(`carteDuFichier : « ${posix} » porte un CR isolé (#604) — la numérotation de git diverge de celle de readText ; corriger les fins de ligne d'abord`)
  }
  let texteHead
  try { texteHead = git(['show', `HEAD:${posix}`]) } catch { return null }
  const hunks = hunksDe(git(['-c', 'core.quotePath=false', 'diff', '-U0', '--no-color', '--no-ext-diff', '--no-textconv', '--no-renames', 'HEAD', '--', posix]))
  return { texteHead, carte: carteDeLignes(hunks), hunks }
}
