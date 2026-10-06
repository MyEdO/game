import type { DesignationParCatalogue, ItemInstance, ItemInstanceCommun } from './types';
import type { TrappingData } from '../data';
import { brancherObjetsDeCampagne } from './items';

/** Surcharges d'une instance de test : tout champ commun, et la désignation de catalogue. */
export type SurchargeDObjet = Partial<ItemInstanceCommun> & Partial<Pick<DesignationParCatalogue, 'trappingId' | 'spec' | 'creatureId'>>;

/** Fabrique de TEST unique d'une instance d'objet DÉSIGNÉE par `trappingId` (#1988) : les champs requis de
 *  `ItemInstanceCommun` par défaut, les surcharges par-dessus. Aucune stat du catalogue n'est copiée : le
 *  test pose ce qu'il exerce ; une instance complète du catalogue naît par `itemFromTrappingById`. */
export function objetDeTest(o: SurchargeDObjet & { trappingId: string }): ItemInstance {
  return { uid: `test-${o.trappingId}`, kind: 'misc', qualities: [], enc: 0, equipped: false, ...o };
}

/** Pose `objets` en couche de campagne (`brancherObjetsDeCampagne`) le temps de `f`, puis REMET le
 *  fournisseur précédent — pour un test du moteur sans store. Un test d'état pose `campaignNarratif`. */
export function avecObjetsDeCampagne<T>(objets: readonly TrappingData[], f: () => T): T {
  const precedent = brancherObjetsDeCampagne(() => new Map(objets.map((o) => [o.id, o])));
  try {
    return f();
  } finally {
    brancherObjetsDeCampagne(precedent);
  }
}
