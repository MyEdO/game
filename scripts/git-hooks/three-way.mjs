// Fusion 3-voies d'un texte, déléguée à `git merge-file -p` par l'hôte des commandes git des portes
// (`fusionDeTextes`, `scripts/guards/lib/gitPorte.mjs`). Consommée par les pilotes de fusion
// `merge-docs.mjs` et `merge-stocks.mjs`.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { depotDe, fusionDeTextes } from '../guards/lib/gitPorte.mjs'

/** Fusion 3-voies de trois textes. Retourne `{ text, conflict }` ; `conflict` vrai = marqueurs présents
 *  dans `text`. */
export function threeWay(ours, base, theirs, labels = { ours: 'ours', base: 'base', theirs: 'theirs' }) {
  const dir = mkdtempSync(join(tmpdir(), 'three-way-'))
  try {
    const put = (name, content) => { const f = join(dir, name); writeFileSync(f, content); return f }
    const fichiers = { ours: put('ours', ours), base: put('base', base), theirs: put('theirs', theirs) }
    const { texte, conflit } = fusionDeTextes(depotDe(dir), fichiers, labels)
    return { text: texte, conflict: conflit }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
