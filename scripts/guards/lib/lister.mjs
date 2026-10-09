// Lecteur de disque à ORDRE TOTAL — source UNIQUE des listings de répertoire des générateurs de
// dérivés et des libs qu'ils atteignent (#1679 L3b, incident #1620). Deux fonctions, aucune option
// de comparateur : l'ordre est une PROPRIÉTÉ du lecteur, pas une décision de chaque site.
//
// Pourquoi ici et pas dans chaque générateur : un doc dérivé généré sous Windows peut différer de sa
// régénération sur le runner Linux — NTFS rend un listing trié sans tenir compte de la casse, ext4
// rend l'ordre d'un hash — et le rouge de CI est alors MUET (le `.md` committé est simplement
// périmé). L'ordre des racines décide de l'ordre des sites cités par un rapport : sans ordre total,
// le même dépôt rend deux `.md` différents selon la machine.

import { lstatSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Les comparateurs d'ordre total vivent dans `src/lib/ordre.mjs`, module pur ; ce lecteur les
 *  ré-exporte pour ses consommateurs. */
export { parUnitesDeCode, parLibelle } from '../../../src/lib/ordre.mjs'

/**
 * Noms des enfants DIRECTS de `dir`, triés par unités de code.
 * @param {string} dir
 * @param {{ absent?: 'lever' | 'vide', avecTypes?: boolean }} [options] `absent: 'vide'` rend `[]` en mode noms quand le dossier
 *   n'existe pas (ENOENT) ou n'est pas un dossier (ENOTDIR) ; toute AUTRE erreur lève (une lecture
 *   refusée n'est pas un dossier vide).
 * @returns {string[] | { nature: 'directory' | 'absent' | 'other', entrees: { nom: string, nature: 'file' | 'directory' | 'link' | 'other' }[] }}
 */
export function listerDossier(dir, { absent = 'lever', avecTypes = false } = {}) {
  let noms
  try {
    noms = readdirSync(dir, avecTypes ? { withFileTypes: true } : undefined)
  } catch (err) {
    if (absent === 'vide' && (err?.code === 'ENOENT' || err?.code === 'ENOTDIR')) return avecTypes ? { nature: err.code === 'ENOENT' ? 'absent' : 'other', entrees: [] } : []
    throw err
  }
  if (!avecTypes) return noms.map(String).sort()
  return { nature: 'directory', entrees: noms.map((e) => ({ nom: e.name, nature: e.isSymbolicLink() ? 'link' : e.isFile() ? 'file' : e.isDirectory() ? 'directory' : 'other' })).sort((a, b) => a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0) }
}

/**
 * MOTIF de chemin de dépôt → expression régulière, aux règles de `.gitattributes` :
 *   · `*` ne traverse JAMAIS `/` ;
 *   · `**` entre deux `/` vaut ZÉRO ou PLUSIEURS dossiers : le motif atteint la page posée à la
 *     racine comme celle posée sous un dossier de cœur ;
 *   · `{a,b}` dans un segment vaut l'une de ses alternatives, sans imbrication (motif d'`import.meta.glob`
 *     de Vite, `src/test-setup.ts`).
 * C'est la grammaire que ce dépôt ÉCRIT (le motif des catalogues de l'Atlas,
 * `scripts/raw/motif-catalogues.mjs`, en aiguillage de fusion et en cible de générateur). Le PATHSPEC
 * git nu ne la partage PAS — il est en `fnmatch` sans `FNM_PATHNAME`, où `*` traverse `/` et où
 * `**` suivi d'un `/` exige un dossier réel ; seule la magie `:(glob)` la lui donne.
 * SEUL site du dépôt qui sait lire un motif.
 * @param {string} motif @returns {RegExp}
 */
export function motifDeGlob(motif) {
  const segments = String(motif).split('/')
  let corps = ''
  segments.forEach((seg, i) => {
    const suivi = i < segments.length - 1
    // `**` MÉDIAN consomme son propre `/` (d'où zéro dossier possible) ; FINAL, il prend tout le
    // reste du chemin, dossiers compris.
    if (seg === '**') { corps += suivi ? '(?:[^/]+/)*' : '.*'; return }
    corps += seg.split(/(\{[^{}/]*\})/).map((morceau) => /^\{.*\}$/.test(morceau)
      ? `(?:${morceau.slice(1, -1).split(',').map(litteralDeMotif).join('|')})`
      : litteralDeMotif(morceau)).join('') + (suivi ? '/' : '')
  })
  return new RegExp(`^${corps}$`)
}

/** Un morceau de segment sans alternative : `*` ne franchit pas `/`, le reste est littéral. */
const litteralDeMotif = (morceau) => morceau.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')

const motifsCompiles = new Map()
/** Ce chemin est-il visé par ce motif ? Séparateurs POSIX, quelle que soit la plateforme. */
export const correspondGlob = (chemin, motif) => {
  const cle = String(motif)
  let expression = motifsCompiles.get(cle)
  if (!expression) {
    expression = motifDeGlob(cle)
    if (motifsCompiles.size >= 256) motifsCompiles.delete(motifsCompiles.keys().next().value)
    motifsCompiles.set(cle, expression)
  }
  return expression.test(String(chemin ?? '').replace(/\\/g, '/'))
}

/**
 * Chemins RELATIFS POSIX des FICHIERS sous `dir`, à toute profondeur : dossiers parcourus dans
 * l'ordre trié ET résultat trié (le tri final décide, la marche ne fait que le rendre lisible).
 * Le type d'une entrée se lit par `lstatSync`, comme le `Dirent.isDirectory()` que cette fonction
 * remplace : un LIEN SYMBOLIQUE n'est jamais descendu, et un lien vers un fichier est rendu tel quel.
 * Une entrée dont `lstatSync` échoue (lien mort, course) est SAUTÉE — jamais une marche interrompue.
 * @param {string} dir
 * @param {{ filtre?: (rel: string) => boolean, descendre?: (rel: string) => boolean,
 *           absent?: 'lever' | 'vide' }} [options] `filtre` retient les FICHIERS, `descendre`
 *   autorise l'entrée dans un DOSSIER — les deux reçoivent le chemin relatif POSIX.
 * @returns {string[]}
 */
export function listerArbre(dir, { filtre, descendre, absent = 'lever' } = {}) {
  const out = []
  const marcher = (rel) => {
    for (const nom of listerDossier(rel ? join(dir, rel) : dir, { absent })) {
      const enfant = rel ? `${rel}/${nom}` : nom
      let st
      try { st = lstatSync(join(dir, enfant)) } catch { continue }
      if (st.isDirectory()) {
        if (!descendre || descendre(enfant)) marcher(enfant)
      } else if (!filtre || filtre(enfant)) out.push(enfant)
    }
  }
  marcher('')
  return out.sort()
}
