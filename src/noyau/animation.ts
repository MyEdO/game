/**
 * LE VOCABULAIRE D'ANIMATION (#2972) : les rôles qu'un corps joue et le maniement d'une arme. L'hôte Godot
 * (`hotes/godot/asset/clips.ts`) lit ce seul type.
 *
 * Le MANIEMENT est l'axe d'animation (prise physique : une main, deux mains, lame, hampe, arc…), distinct du GROUPE
 * de règles (`src/engine/weaponGroup.ts`) : son vocabulaire est `maniementSchema` (`src/data/schemas/grammaire/valeurs.ts`) ;
 * il se lit sur la FORME dessinée (racine de `apparences.json`), qui encode la prise, et ne retombe sur le Groupe
 * (`weaponGroups.json`) que pour une forme qui n'en déclare pas.
 */
import type { FormeDArme } from './equipementDessine';
import { racineDesCandidats } from '../engine/items';
import { findApparenceById, findWeaponGroupById } from '../data';
import type { Maniement } from '../data/schemas/grammaire/valeurs';
import { maniementSchema, roleAmbiantSchema } from '../data/schemas/grammaire/valeurs';

/** Rôles de combat : un clip chacun. */
export const ROLES_DE_COMBAT = Object.freeze(['melee', 'tir', 'incantation', 'esquive', 'parade', 'coup', 'marche', 'repos'] as const);

/** Styles d'incantation. */
export const STYLES_DE_SORT = Object.freeze(['trait', 'benediction'] as const);

export const ROLES_D_ANIMATION = Object.freeze([...ROLES_DE_COMBAT, 'mort', ...roleAmbiantSchema.options, ...STYLES_DE_SORT] as const);
export type RoleDAnimation = (typeof ROLES_D_ANIMATION)[number];

/** Les maniements, dans l'ordre de leur déclaration (`maniementSchema`). */
export const MANIEMENTS: readonly Maniement[] = maniementSchema.options;

/** Le maniement que déclare la racine de la forme `forme` (`apparences.json`), elle-même ou celle dont elle est une
 *  variante (`forme`), aucun sans déclaration. */
export function maniementDeLaForme(forme: string): Maniement | undefined {
  const apparence = findApparenceById(forme);
  return (apparence?.forme ? findApparenceById(apparence.forme.id) : apparence)?.maniement;
}

/** Arme naturelle typée (`Weapon.attackKind`, id stable du trait) → maniement dédié. */
const MANIEMENT_NATUREL: Readonly<Record<string, Maniement>> = {
  tentacules: 'entraves',
  cornes: 'cornes',
};

/** Maniement d'une arme, par id stable : kind naturel (`attackKind`), puis `maniement` de la racine de ses
 *  candidats (`apparences.json`), puis celui de son Groupe (`weaponGroups.json`) ; une arme sans Groupe suit son
 *  type. */
export function maniementDe(w?: FormeDArme): Maniement {
  if (!w) return 'lame1m';
  if (w.attackKind) {
    const nat = MANIEMENT_NATUREL[w.attackKind];
    if (nat) return nat;
  }
  const forme = racineDesCandidats(w.candidats);
  const deLaForme = forme ? maniementDeLaForme(forme) : undefined;
  if (deLaForme) return deLaForme;
  const groupe = findWeaponGroupById(w.subType);
  if (groupe?.kind === 'weapon') return groupe.maniement;
  return w.type === 'distance' ? 'arc' : 'lame1m';
}
