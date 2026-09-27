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
import { weaponGroupIdByWeaponLabel } from '../data';
import { norm } from '../lib/normalize';

/** id de Groupe (subType) → clé de famille propre (sans accents). */
const GROUP_KEY: Record<string, string> = {
  base: 'base', escrime: 'escrime', cavalerie: 'cavalerie', 'deux-mains': 'deuxmains',
  'armes-d-hast': 'hast', fleau: 'fleau', parade: 'parade', bagarre: 'bagarre',
  arc: 'arc', arbalete: 'arbalete', 'poudre-noire': 'poudre', fronde: 'fronde',
  lancer: 'lancer', entraves: 'entraves', explosifs: 'explosifs', ingenierie: 'ingenierie',
};

/**
 * Alias EXACTS (pas de sous-chaîne) pour les libellés génériques joués mais absents de
 * la table (le LDB abstrait beaucoup d'armes). Repli APRÈS la donnée canonique.
 */
const ALIAS_GROUP: Record<string, string> = {
  epee: 'base', 'epee courte': 'base', sabre: 'escrime', rapiere: 'escrime',
  hache: 'base', 'hache de main': 'base', hachette: 'base', masse: 'base', massue: 'base',
  gourdin: 'base', marteau: 'base', baton: 'hast', 'baton de combat': 'hast',
  lance: 'hast', pique: 'hast', hallebarde: 'hast', arc: 'arc', 'arc long': 'arc',
  arbalete: 'arbalete', pistolet: 'poudre', mousquet: 'poudre', tromblon: 'poudre',
  arquebuse: 'poudre', fronde: 'fronde', dague: 'base', couteau: 'base', javelot: 'lancer',
  fouet: 'entraves', lasso: 'entraves', bolas: 'lancer', bombe: 'explosifs',
  'mains nues': 'bagarre', 'coup-de-poing': 'bagarre',
};

/**
 * COUTURE texte→id (#602) : libellé d'arme SAISI (arme custom, statbloc sans identité de catalogue) →
 * Groupe canonique. Prend du TEXTE, jamais une entité en main — une arme qui porte son `subType` se
 * résout par son ID (cf. `weaponGroup`). null si non catalogué. La conversion libellé→id est DÉLÉGUÉE
 * au résolveur VIVANT `weaponGroupIdByWeaponLabel` (`src/data/index.ts`, seule couture tolérée).
 */
export function weaponGroupFromText(text: string): string | null {
  return weaponGroupIdByWeaponLabel(text) ?? null;
}

/** COUTURE texte→id (#602) : alias EXACT d'un libellé d'arme non catalogué → clé de famille. */
function aliasGroupFromText(text: string): string | undefined {
  return ALIAS_GROUP[norm(text)];
}

/** Groupe canonique (subType) — IDENTITÉ STABLE d'abord (#602 : `Weapon.subType` PORTE l'id du Groupe,
 *  posé par `toWeapon` depuis le catalogue) ; repli par TEXTE pour une arme sans identité. */
export function weaponGroup(w?: Weapon): string | null {
  if (!w) return null;
  return w.subType ?? weaponGroupFromText(w.label);
}

/** Clé de famille d'arme (base/escrime/…/poudre) : donnée → alias → défaut par type. */
export function weaponGroupKey(w?: Weapon): string {
  if (!w) return 'base';
  const g = weaponGroup(w);
  if (g) return GROUP_KEY[g] ?? 'base';
  const a = aliasGroupFromText(w.label);
  if (a) return a;
  return w.type === 'ranged' ? 'arc' : 'base';
}
