// LES PLACES D'UNE PIÈCE DANS SA SUITE (#4471) : `POSITIONS_DANS_L_OUVERTURE` de `src/noyau/monde/piecesDArete.ts`, les
// places d'une arête dans son ouverture et d'une rampe dans sa suite (`PositionDansLOuverture`,
// `src/noyau/monde/aretes.ts`), celles des nœuds `<pièce>--<position>` des kits (`arete/geometrie.py`). Écrit sur la
// sortie standard leur liste.
//   node scripts/personnage-3d/arete/positions.mjs
import { chargerEvaluateur } from '../../../hotes/godot/asset/charger.mjs'

const { POSITIONS_DANS_L_OUVERTURE } = await chargerEvaluateur('../../../../src/noyau/monde/piecesDArete.ts')
process.stdout.write(JSON.stringify(POSITIONS_DANS_L_OUVERTURE))
