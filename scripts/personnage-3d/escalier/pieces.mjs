// LES PIÈCES D'UN CÔTÉ DE MARCHES (#4471) : `PIECES_D_ESCALIER` de `src/noyau/monde/piecesDArete.ts`, les pièces que le
// noyau pose sur le côté d'une case de marches (`PieceDEscalier`, `src/noyau/monde/cotesDeMarches.ts`), les nœuds que
// `test_escalier.py` exige de chaque kit. Écrit sur la sortie standard leur liste.
//   node scripts/personnage-3d/escalier/pieces.mjs
import { chargerEvaluateur } from '../../../hotes/godot/asset/charger.mjs'

const { PIECES_D_ESCALIER } = await chargerEvaluateur('../../../../src/noyau/monde/piecesDArete.ts')
process.stdout.write(JSON.stringify(PIECES_D_ESCALIER))
