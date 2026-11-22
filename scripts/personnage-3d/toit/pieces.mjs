// LES PIÈCES D'UN SEGMENT DE TOIT (#4471) : `PIECES_DE_TOIT` de `src/noyau/monde/piecesDArete.ts`, les pièces que le
// noyau pose sur un segment de toit (`PieceDeToit`, `src/noyau/monde/faitieres.ts`), dont `test_toit.py` exige le nœud
// de chaque kit. Écrit sur la sortie standard leur liste.
//   node scripts/personnage-3d/toit/pieces.mjs
import { chargerEvaluateur } from '../../../hotes/godot/asset/charger.mjs'

const { PIECES_DE_TOIT } = await chargerEvaluateur('../../../../src/noyau/monde/piecesDArete.ts')
process.stdout.write(JSON.stringify(PIECES_DE_TOIT))
