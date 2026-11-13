// Fusion 3-voies d'un texte, déléguée à `git merge-file -p` par l'hôte des commandes git des portes
// (`fusionDeTextes`, `fusionDiff3`, `scripts/guards/lib/gitPorte.mjs`). Consommée par les pilotes de fusion
// `merge-stocks.mjs` et `merge-imports.mjs`.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { depotDe, fusionDeTextes, fusionDiff3 } from '../guards/lib/gitPorte.mjs'
import { tailleDeMarqueur } from '../guards/lib/blocsDeFusion.mjs'

const LABELS = { ours: 'ours', base: 'base', theirs: 'theirs' }

/** Ce que `fusionner(depot, fichiers)` rend des trois textes posés en fichiers temporaires. */
function surFichiers(ours, base, theirs, fusionner) {
  const dir = mkdtempSync(join(tmpdir(), 'three-way-'))
  try {
    const put = (name, content) => { const f = join(dir, name); writeFileSync(f, content); return f }
    return fusionner(depotDe(dir), { ours: put('ours', ours), base: put('base', base), theirs: put('theirs', theirs) })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Fusion 3-voies de trois textes. Retourne `{ text, conflict }` ; `conflict` vrai = marqueurs présents
 *  dans `text`. */
export function threeWay(ours, base, theirs, labels = LABELS) {
  const { texte, conflit } = surFichiers(ours, base, theirs, (depot, fichiers) => fusionDeTextes(depot, fichiers, labels))
  return { text: texte, conflict: conflit }
}

/** Fusion 3-voies au style `diff3` : chaque bloc en conflit porte sa base, entre des marqueurs de `taille`
 *  caractères qu'aucune ligne des trois textes n'imite. Retourne `{ text, taille }`, à lire par
 *  `segmentsDeFusion` (`blocsDeFusion.mjs`) ; lève sur un contenu binaire. */
export function threeWayDiff3(ours, base, theirs) {
  const taille = tailleDeMarqueur(ours, base, theirs)
  const vu = surFichiers(ours, base, theirs, (depot, fichiers) => fusionDiff3(depot, fichiers, LABELS, taille))
  if ('binaire' in vu) throw new Error('three-way : contenu binaire')
  return { text: vu.texte, taille }
}
