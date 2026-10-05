// Les fichiers que lisent les scanners de réfs du CODE (CLAUDE.md règle 1) : UNE marche, DEUX
// populations nommées. Le triage `audit-refs-chapitre.mjs`, qui balaie aussi `scripts/` et `docs/`,
// lit la même liste de CITANTS.
// - CITANTS : tout fichier qui peut porter une réf `<ABRÉV> <chap> l.<ligne>`. Sa FORME
//   (`citation-graphy-guard.mjs`), ses BORNES (`check-code-refs.mjs`), sa ligne non aveugle
//   (`rawRefIntegrity.mjs`) se vérifient partout où elle s'écrit, sa présence à l'Atlas
//   (`reconcile.mjs`) dans le code : une réf qu'aucun scanner ne lit pourrit en silence au premier réancrage.
// - IMPLÉMENTANTS : les citants dont une réf dit « ce code implémente ce passage » — ce que rend le
//   champ `**Implémente :**` (`build-implemente.mjs`). Une feuille `.css` ou un dessin de rig `.mts`
//   cite le passage qu'il habille, il ne l'implémente pas.
// Deux jeux de RACINES, déclarés ici : `RACINES_CITANTES` (forme, bornes, ligne non aveugle) et
// `RACINES_DU_CODE` (présence à l'Atlas, champ `Implémente`). Une fiche de dossier de chapitre
// (`docs/dossiers/`, #2290) cite le livre et n'implémente rien : citante, hors du code.
import { join } from 'node:path'
import { listerArbre } from '../../guards/lib/lister.mjs'

/** Racine des fiches de dossier de chapitre commitées (#2290), lues par `scripts/raw/lib/dossiers.mjs`. */
export const DOSSIERS_DIR = 'docs/dossiers'

export const EXTS_CITANTES = ['.ts', '.tsx', '.mts', '.mjs', '.json', '.css', '.md']
export const EXTS_IMPLEMENTANTES = ['.ts', '.tsx', '.json']

/** Les racines du CODE : lues par `reconcile.mjs` et `build-implemente.mjs`. */
export const RACINES_DU_CODE = Object.freeze(['src'])
/** Les racines CITANTES : le code, plus les fiches de dossier de chapitre (#2290). Lues par
 *  `check-code-refs.mjs`, `citation-graphy-guard.mjs` et `rawRefIntegrity.mjs`. */
export const RACINES_CITANTES = Object.freeze([...RACINES_DU_CODE, DOSSIERS_DIR])

/** Fichiers de `racines` (un dossier ou une liste) aux extensions `exts`, `node_modules` exclu, racine
 *  par racine en ORDRE TOTAL (`listerArbre`) : l'ordre départage deux puces de même (livre, chapitre)
 *  au rendu du champ `Implémente` (#1244). */
export function fichiersCitants(racines, exts = EXTS_CITANTES) {
  return [racines].flat().flatMap((dir) => listerArbre(dir, {
    descendre: (rel) => !rel.split('/').includes('node_modules'),
    filtre: (rel) => exts.some((x) => rel.endsWith(x)),
  }).map((rel) => join(dir, rel)))
}
