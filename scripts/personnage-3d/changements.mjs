// Ce qui a changé pour la chaîne 3D (#3412, lot 4C), imprimé en JSON pour `scripts/personnage-3d/entrees.py` :
// `{ racines, base, chemins }`. `racines`, ce que lit une reconstruction (`racinesDesReconstructions`, #5037) ;
// `base`, la base du diff de `classerPush` (`baseDuDiff`, scripts/gates/classerPush.mjs), `merge-base origin/main HEAD`
// hors de son contexte de push ; `chemins`, les chemins suivis changés de cette base à l'arbre de travail et les
// non-suivis non ignorés. Sans base, `base` et `chemins` valent `null` et `motif` dit pourquoi : l'appelant reconstruit
// tout.
//   node scripts/personnage-3d/changements.mjs
import { stdout } from 'node:process'
import { fileURLToPath } from 'node:url'
import { baseDuDiff } from '../gates/classerPush.mjs'
import { clotureDImports } from '../guards/lib/importGraph.mjs'
import { SUIVI, TRAVAIL, ceQuiChange, depotDe, listerImage } from '../guards/lib/gitPorte.mjs'
import { porteDeTousLesProjets } from '../guards/lib/porteDesProjets.mjs'

/** Les fichiers hors de la chaîne qu'ouvre une reconstruction (`construire.py`, `element/construire.py`), relevés par
 *  `construire_en_relevant` (`entrees.py`) : `seuils.py`, `habillage.py`, `arete/apparences.py`, `decor/gabarit.py`,
 *  `vehicule/plan_de_jeu.py`. */
const LUS_PAR_LA_CHAINE = [
  'hotes/godot/asset/evaluateur/gardes/seuils.json',
  'src/data/materials.json',
  'src/data/structureAppearance.json',
  'src/data/props.json',
  'src/data/vehicles.json',
]

/** Les modules dont un lanceur node d'une reconstruction rend les valeurs (`chargerEvaluateur`,
 *  hotes/godot/asset/charger.mjs), que le relevé ne voit pas : `arete/niveau.mjs`, `arete/positions.mjs`,
 *  `decor/polygones.mjs`, `base/gabarit.mjs` (opérations `formesDeTete`, `silhouettes`). */
const MODULES_EVALUES = [
  'src/noyau/monde/relief.ts',
  'src/noyau/monde/piecesDArete.ts',
  'src/data/schemas/props.types.ts',
  'src/lib/formesDeTete.ts',
  'hotes/godot/asset/silhouettes.ts',
]

/** Les racines des entrées d'une reconstruction (`est_entree`, entrees.py) : la chaîne, ses modèles publiés, ce
 *  qu'elle ouvre et la clôture d'exécution des modules évalués (`clotureDImports`, scripts/guards/lib/importGraph.mjs). */
export function racinesDesReconstructions() {
  const evalues = clotureDImports(MODULES_EVALUES, { racine: fileURLToPath(new URL('../..', import.meta.url)), typesEffaces: true })
  return ['scripts/personnage-3d/', 'hotes/godot/projet/modeles/', ...new Set([...LUS_PAR_LA_CHAINE, ...evalues])]
}

/** Les chemins suivis changés de `base` à l'arbre de travail, et les non-suivis non ignorés, triés. */
export function cheminsChanges(base) {
  const depot = depotDe(process.cwd(), { porte: porteDeTousLesProjets })
  const suivis = new Set(listerImage(depot, SUIVI))
  const nonSuivis = listerImage(depot, TRAVAIL).filter((chemin) => !suivis.has(chemin))
  return [...new Set([...ceQuiChange(depot, base, SUIVI).chemins(), ...nonSuivis])].sort()
}

if (import.meta.main) {
  const racines = racinesDesReconstructions()
  const socle = baseDuDiff({ sha: 'HEAD' })
  stdout.write(JSON.stringify(socle.base === null
    ? { racines, base: null, chemins: null, motif: socle.motif }
    : { racines, base: socle.base, chemins: cheminsChanges(socle.base) }))
}
