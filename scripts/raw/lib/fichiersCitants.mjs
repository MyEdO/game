// Les fichiers que lisent les scanners de réfs du CODE (CLAUDE.md règle 1) : UNE marche, DEUX
// populations nommées. Le triage `audit-refs-chapitre.mjs`, qui balaie aussi `scripts/` et `docs/`,
// lit la même liste de CITANTS.
// - CITANTS : tout fichier qui peut porter une réf `<ABRÉV> <chap> l.<ligne>`. Sa FORME
//   (`citation-graphy-guard.mjs`), ses BORNES (`check-code-refs.mjs`), sa ligne non aveugle
//   (`rawRefIntegrity.mjs`) et sa présence à l'Atlas (`reconcile.mjs`) se vérifient partout où elle
//   s'écrit : une réf qu'aucun scanner ne lit pourrit en silence au premier réancrage.
// - IMPLÉMENTANTS : les citants dont une réf dit « ce code implémente ce passage » — ce que rend le
//   champ `**Implémente :**` (`build-implemente.mjs`). Une feuille `.css` ou un dessin de rig `.mts`
//   cite le passage qu'il habille, il ne l'implémente pas.
import { join } from 'node:path'
import { listerArbre } from '../../guards/lib/lister.mjs'

export const EXTS_CITANTES = ['.ts', '.tsx', '.mts', '.mjs', '.json', '.css', '.md']
export const EXTS_IMPLEMENTANTES = ['.ts', '.tsx', '.json']

/** Fichiers de `dir` aux extensions `exts`, `node_modules` exclu, en ORDRE TOTAL (`listerArbre`) :
 *  l'ordre départage deux puces de même (livre, chapitre) au rendu du champ `Implémente` (#1244). */
export function fichiersCitants(dir, exts = EXTS_CITANTES) {
  return listerArbre(dir, {
    descendre: (rel) => !rel.split('/').includes('node_modules'),
    filtre: (rel) => exts.some((x) => rel.endsWith(x)),
  }).map((rel) => join(dir, rel))
}
