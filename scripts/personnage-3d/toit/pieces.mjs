// LES PIÈCES D'UNE ARÊTE DE TOIT (#4471) : `PIECES_DE_TOIT` de `src/noyau/monde/piecesDArete.ts`, les pièces que le
// noyau pose sur une arête de toit (`PieceDeToit`, `src/noyau/monde/piecesDeToit.ts`), et `DEMI_LARGEUR_DE_POSE_M`, la
// demi-largeur qu'il leur suppose pour reculer les arêtes aux nœuds : `test_toit.py` exige que les nœuds racine de
// chaque kit soient exactement ces pièces, et qu'aucune ne passe cette demi-largeur en travers. Écrit sur la sortie
// standard `{ pieces, demiLargeurDePoseM }`.
//   node scripts/personnage-3d/toit/pieces.mjs
import { chargerEvaluateur } from '../../../hotes/godot/asset/charger.mjs'

const { PIECES_DE_TOIT, DEMI_LARGEUR_DE_POSE_M } = await chargerEvaluateur('../../../../src/noyau/monde/piecesDArete.ts')
process.stdout.write(JSON.stringify({ pieces: PIECES_DE_TOIT, demiLargeurDePoseM: DEMI_LARGEUR_DE_POSE_M }))
