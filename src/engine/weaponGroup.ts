/**
 * Groupe d'arme CANONIQUE (WFRP4) dérivé de la donnée `Source/` (trappings.subType),
 * pas d'un parsing approximatif du libellé. Le Groupe pilote l'animation (brin G) :
 * le Livre de base classe épée/hache/masse/dague dans un même groupe « Base » — on
 * NE distingue donc PAS ces formes à l'animation (fidèle aux règles).
 *
 * Groupes (subType) : Base, Escrime, Cavalerie, Deux-mains, Armes d'hast, Fléau,
 * Parade, Bagarre / Arc, Arbalète, Poudre noire, Fronde, Lancer, Entraves,
 * Explosifs, Ingénierie.
 */
import type { Weapon } from './types';

/** id de Groupe (subType) → clé de famille propre (sans accents). */
const GROUP_KEY: Record<string, string> = {
  base: 'base', escrime: 'escrime', cavalerie: 'cavalerie', 'deux-mains': 'deuxmains',
  'armes-d-hast': 'hast', fleau: 'fleau', parade: 'parade', bagarre: 'bagarre',
  arc: 'arc', arbalete: 'arbalete', 'poudre-noire': 'poudre', fronde: 'fronde',
  lancer: 'lancer', entraves: 'entraves', explosifs: 'explosifs', ingenierie: 'ingenierie',
};

/** Groupe canonique : l'id `Weapon.subType` (#602), posé par le catalogue ou par l'éditeur ; absent =
 *  pas de Groupe (LDB 85 l.31-33). */
export function weaponGroup(w?: Weapon): string | null {
  return w?.subType ?? null;
}

/** Clé de famille d'arme (base/escrime/…/poudre) : Groupe → défaut par type. */
export function weaponGroupKey(w?: Weapon): string {
  if (!w) return 'base';
  const g = weaponGroup(w);
  if (g) return GROUP_KEY[g] ?? 'base';
  return w.type === 'ranged' ? 'arc' : 'base';
}
