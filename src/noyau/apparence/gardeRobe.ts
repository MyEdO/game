/**
 * LA GARDE-ROBE DES ÉLÉMENTS 3D (#2972 v4, D6(b) ; #3116) : les ids de pièce de `garde-robe.json` de l'ensemble qui
 * habille une chose, et les emplacements de la garde-robe, que la validation d'un élément 3D lit.
 */
import { findEmblemeById, findEnsembleParHabille, findPieceById, findVarianteById, type LigneDeGardeRobe } from '../../data';
import { idsDeLaSousListe } from '../../data/schemas/grammaire/ref';
import type { EmplacementId, HabilleDEnsemble } from '../../data/schemas/defs/garde-robe';

/** Les pièces de l'ensemble qui habille `habille`, aucune si la garde-robe n'en déclare pas. */
export const piecesDEnsemble = (habille: HabilleDEnsemble): LigneDeGardeRobe<'ensemble'>['pieces'] => findEnsembleParHabille(habille)?.pieces ?? [];

/** `id` est-il un emplacement de la garde-robe (`kind: emplacement`) ? */
export const estEmplacement = (id: string): id is EmplacementId => idsDeLaSousListe('gardeRobe', 'emplacement').includes(id);

/** La pièce `id`, ou la pièce dont la variante `id` est une autre apparence (#3446) ; `undefined` pour un id inconnu. */
export const pieceRacine = (id: string): LigneDeGardeRobe<'piece'> | undefined => findPieceById(id) ?? findPieceById(findVarianteById(id)?.piece.id);

/** La pièce ou la variante `id`, au libellé de la variante et à la catégorie de sa pièce (#3446). */
export const pieceOuVariante = (id: string): Pick<LigneDeGardeRobe<'piece'>, 'label' | 'categorie'> | undefined => {
  const racine = pieceRacine(id);
  return racine && { label: (findVarianteById(id) ?? racine).label, categorie: racine.categorie };
};

/** L'emplacement de la pièce d'accessoire `id` (ou de la pièce de la variante `id`), `undefined` pour toute autre pièce ou un
 *  id inconnu. */
export const emplacementDePiece = (id: string) => pieceRacine(id)?.emplacement?.id;

export type EmblemeResolu = Pick<LigneDeGardeRobe<'embleme'>, 'id'>;

export function emblemeDuPorteur(reference: { id: string } | null | undefined): EmblemeResolu | undefined {
  const embleme = findEmblemeById(reference?.id);
  return embleme ? { id: embleme.id } : undefined;
}
