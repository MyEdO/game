import { itemFromTrappingById, weaponFromItem } from './engine/items';
import type { ItemInstance, Weapon } from './engine/types';

type EtatDObjetDeTest = Partial<Pick<ItemInstance, 'uid' | 'equipped'>>;
type EtatDArmeDeTest = EtatDObjetDeTest & Pick<Partial<Weapon>, 'hand'>;

export function objetDeTest(id: string, etat: EtatDObjetDeTest = {}): ItemInstance {
  const objet = itemFromTrappingById(id);
  if (!objet) throw new Error(`Objet de test inconnu : ${id}`);
  return Object.assign(objet, etat);
}

export function armeDeTest(id: string, { hand, ...etat }: EtatDArmeDeTest = {}): Weapon {
  return weaponFromItem(objetDeTest(id, etat), hand);
}
