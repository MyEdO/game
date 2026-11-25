// Les fichiers que lisent les scanners de réfs du CODE (AGENTS.md règle 1) : UNE marche, DEUX
// populations nommées. Le triage `audit-refs-chapitre.mjs`, qui balaie aussi `scripts/` et `docs/`,
// lit la même liste de CITANTS.
// - CITANTS : tout fichier qui peut porter une réf `<ABRÉV> <chap> l.<ligne>`. Sa FORME
//   (`citation-graphy-guard.mjs`), ses BORNES (`check-code-refs.mjs`), sa ligne non aveugle
//   (`rawRefIntegrity.mjs`) se vérifient partout où elle s'écrit, sa présence à l'Atlas
//   (`reconcile.mjs`) dans le code : une réf qu'aucun scanner ne lit pourrit en silence au premier réancrage.
// - IMPLÉMENTANTS : les citants dont une réf dit « ce code implémente ce passage » — ce que rend le
//   champ `**Implémente :**` (`build-implemente.mjs`). Une feuille `.css` ou un script `.mts`/`.mjs`
//   cite le passage qu'il habille ou outille, il ne l'implémente pas.
// Deux jeux de RACINES, déclarés ici : `RACINES_CITANTES` (forme, bornes, ligne non aveugle) et
// `RACINES_DU_CODE` (présence à l'Atlas, champ `Implémente`). Une fiche de dossier de chapitre
// (`projets/<projet>/dossiers/`, #2290) cite le livre et n'implémente rien : citante, hors du code.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { EXTENSIONS_DE_SCRIPT } from '../../guards/lib/dialecte.mjs'
import { listerArbre, listerEntrees } from '../../guards/lib/lister.mjs'

/** Les fiches de dossier de chapitre commitées (#2290, #4936) : `projets/<projet>/dossiers/<ABBR>/<NN>.json`, trouvées par leur
 *  EMPLACEMENT. `dossiersDesProjets` en rend les dossiers, lus par `scripts/raw/lib/dossiers.mjs`. */
export const DOSSIERS_DES_PROJETS = Object.freeze({ racine: 'projets', dossier: 'dossiers' })

/** Le chemin `chemin` (relatif à la racine du dépôt, séparateur `/`) est-il sous le dossier des fiches d'un projet ? */
const sousLesFiches = (chemin) => {
  const [racine, , dossier] = chemin.split('/')
  return racine === DOSSIERS_DES_PROJETS.racine && dossier === DOSSIERS_DES_PROJETS.dossier
}

/** Les dossiers `<sousDossier>` des projets sous `racine` (le répertoire courant par défaut), relatifs à elle : chaque
 *  `projets/<projet>/<sousDossier>` présent, en ordre total. Par défaut, les dossiers de fiches. */
export function dossiersDesProjets(racine = '.', sousDossier = DOSSIERS_DES_PROJETS.dossier) {
  const projets = join(racine, DOSSIERS_DES_PROJETS.racine)
  return listerEntrees(projets, { absent: 'vide' }).entrees
    .filter((e) => e.nature === 'directory' && existsSync(join(projets, e.nom, sousDossier)))
    .map((e) => `${DOSSIERS_DES_PROJETS.racine}/${e.nom}/${sousDossier}`)
}

export const EXTS_CITANTES = [...EXTENSIONS_DE_SCRIPT, '.json', '.css', '.md']
/** `indexCode` (`build-implemente.mjs`) indexe les symboles TS/TSX et les références de folio des documents JSON. */
export const EXTS_IMPLEMENTANTES = ['.ts', '.tsx', '.json']

/** Les racines du CODE, le commun et les projets (#4936) : lues par `reconcile.mjs` et `build-implemente.mjs`. */
export const RACINES_DU_CODE = Object.freeze(['src', 'projets'])
/** Les racines CITANTES : le code, plus les dossiers de fiches des projets (#2290). Lues par
 *  `check-code-refs.mjs`, `citation-graphy-guard.mjs` et `rawRefIntegrity.mjs`. */
export const RACINES_CITANTES = Object.freeze([...RACINES_DU_CODE, ...dossiersDesProjets()])

/** Fichiers de `racines` (un dossier ou une liste) aux extensions `exts`, `node_modules` exclu, racine
 *  par racine en ORDRE TOTAL (`listerArbre`) : l'ordre départage deux puces de même (livre, chapitre)
 *  au rendu du champ `Implémente` (#1244). Un dossier de fiches n'est lu que comme racine nommée
 *  (`dossiersDesProjets`), jamais en descendant d'une racine du code : une fiche n'est ni lue deux fois, ni du code. */
export function fichiersCitants(racines, exts = EXTS_CITANTES) {
  return [racines].flat().flatMap((dir) => listerArbre(dir, {
    descendre: (rel) => !rel.split('/').includes('node_modules') && (sousLesFiches(dir) || !sousLesFiches(join(dir, rel).split('\\').join('/'))),
    filtre: (rel) => exts.some((x) => rel.endsWith(x)),
  }).map((rel) => join(dir, rel)))
}
