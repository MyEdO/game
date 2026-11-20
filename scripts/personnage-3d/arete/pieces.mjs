// LES PIÈCES D'UNE ARÊTE (#4471) : `PIECES_D_ARETE` de `src/noyau/monde/piecesDArete.ts`, les pièces que le noyau pose
// sur une arête (`PieceDArete`, `src/noyau/monde/aretes.ts`), les nœuds que `test_arete.py` exige de chaque kit. Écrit
// sur la sortie standard leur liste.
//   node scripts/personnage-3d/arete/pieces.mjs
import { chargerEvaluateur } from '../../../hotes/godot/asset/charger.mjs'

const { PIECES_D_ARETE } = await chargerEvaluateur('../../../../src/noyau/monde/piecesDArete.ts')
process.stdout.write(JSON.stringify(PIECES_D_ARETE))
