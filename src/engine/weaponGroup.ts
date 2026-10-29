/**
 * Groupe d'arme CANONIQUE (WFRP4) dérivé de la donnée `Source/` (trappings.subType),
 * pas d'un parsing approximatif du libellé.
 */
import type { Weapon } from './types';
import { porteLeMarqueur } from '../data/schemas/grammaire/ref';

/** Groupe canonique : l'id `Weapon.subType` (#602), posé par le catalogue ou par l'éditeur ; absent =
 *  pas de Groupe (LDB 85 l.31-33). */
export function weaponGroup(w?: Pick<Weapon, 'subType'>): string | null {
  return w?.subType ?? null;
}

const marqueAPoudre = porteLeMarqueur('weaponGroup', 'poudre');
/** Groupe d'arme ou de munition À POUDRE : marqueur `poudre` de `weaponGroups.json`. LDB 62 l.99 ; LDB 62 l.129 */
export const groupeAPoudre = (id: string | null | undefined): boolean => !!id && marqueAPoudre(id);
