/**
 * LA GARDE-ROBE DES ÉLÉMENTS 3D (#2972 v4, D6(b) ; #3116) : les ids de pièce de `garde-robe.json` de l'ensemble qui
 * habille une chose, et les emplacements de la garde-robe, que la validation d'un élément 3D lit.
 */
import { findEnsembleParHabille, findPieceById } from '../../data';
import { idsDeLaSousListe } from '../../data/schemas/grammaire/ref';
import type { EmplacementId, HabilleDEnsemble, PieceId } from '../../data/schemas/defs/garde-robe';

/** Les pièces de l'ensemble qui habille `habille`, aucune si la garde-robe n'en déclare pas. */
export const piecesDEnsemble = (habille: HabilleDEnsemble): readonly PieceId[] => findEnsembleParHabille(habille)?.pieces ?? [];

/** `id` est-il un emplacement de la garde-robe (`kind: emplacement`) ? */
export const estEmplacement = (id: string): id is EmplacementId => idsDeLaSousListe('gardeRobe', 'emplacement').includes(id);

/** L'emplacement de la pièce d'accessoire `id`, `undefined` pour toute autre pièce ou un id inconnu. */
export const emplacementDePiece = (id: string): EmplacementId | undefined => findPieceById(id)?.emplacement?.id;
