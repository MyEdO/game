import type { DesignationParCatalogue, ItemInstance, ItemInstanceCommun } from './types';

/** Surcharges d'une instance de test : tout champ commun, et la désignation de catalogue. */
export type SurchargeDObjet = Partial<ItemInstanceCommun> & Partial<Pick<DesignationParCatalogue, 'trappingId' | 'spec' | 'creatureId'>>;

/** Fabrique de TEST unique d'une instance d'objet DÉSIGNÉE par `trappingId` (#1988) : les champs requis de
 *  `ItemInstanceCommun` par défaut, les surcharges par-dessus. Aucune stat du catalogue n'est copiée : le
 *  test pose ce qu'il exerce ; une instance complète du catalogue naît par `itemFromTrappingById`. */
export function objetDeTest(o: SurchargeDObjet & { trappingId: string }): ItemInstance {
  return { uid: `test-${o.trappingId}`, kind: 'misc', qualities: [], enc: 0, equipped: false, ...o };
}
