// LA HAUTEUR D'UN NIVEAU (#4471) : `METRES_PER_LEVEL` de `src/noyau/monde/relief.ts`, la hauteur que le noyau donne aux
// arêtes d'une apparence sans `wallHeightM` (`src/noyau/monde/aretes.ts`), que lit `arete/colombage/donnees.py`. Écrit
// sur la sortie standard le nombre de mètres.
//   node scripts/personnage-3d/arete/niveau.mjs
import { chargerEvaluateur } from '../../../hotes/godot/asset/charger.mjs'

const { METRES_PER_LEVEL } = await chargerEvaluateur('../../../../src/noyau/monde/relief.ts')
process.stdout.write(JSON.stringify(METRES_PER_LEVEL))
