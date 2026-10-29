/**
 * LE VOCABULAIRE D'ANIMATION (#2972) : les rôles qu'un corps joue et le maniement d'une arme. Le rig SVG (`src/gameIso/rig/anim/`) et l'hôte Godot
 * (`hotes/godot/asset/manifeste.ts`) lisent ce seul type.
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

/** Rôles de combat du rig : un clip chacun (`src/gameIso/rig/anim/clips.ts`). */
export const ROLES_DE_COMBAT = Object.freeze(['melee', 'ranged', 'cast', 'dodge', 'parry', 'hit', 'walk', 'idle'] as const);
export type RoleDeCombat = (typeof ROLES_DE_COMBAT)[number];

/** Rôles ambiants en boucle (`src/gameIso/rig/anim/ambientClips.ts`). */
export const ROLES_AMBIANTS = Object.freeze(['feeding', 'praying', 'cowering', 'standing', 'howling'] as const);
export type RoleAmbiant = (typeof ROLES_AMBIANTS)[number];

/** Styles d'incantation (`src/gameIso/rig/anim/spellClips.ts`). */
export const STYLES_DE_SORT = Object.freeze(['bolt', 'blessing'] as const);
export type StyleDeSort = (typeof STYLES_DE_SORT)[number];

export const ROLES_D_ANIMATION = Object.freeze([...ROLES_DE_COMBAT, 'death', ...ROLES_AMBIANTS, ...STYLES_DE_SORT] as const);
export type RoleDAnimation = (typeof ROLES_D_ANIMATION)[number];

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
  const deLaForme = forme ? findApparenceById(forme)?.maniement : undefined;
  if (deLaForme) return deLaForme;
  const groupe = findWeaponGroupById(w.subType);
  if (groupe?.kind === 'weapon') return groupe.maniement;
  return w.type === 'ranged' ? 'arc' : 'lame1m';
}

/** Maniements à DISTANCE (geste de tir/jet, esquive au lieu de parer en mêlée). */
export const MANIEMENTS_A_DISTANCE: ReadonlySet<Maniement> = new Set<Maniement>(['arc', 'arbalete', 'arme_feu', 'fronde', 'jet', 'entraves', 'explosif']);
export const estManiementADistance = (w?: FormeDArme): boolean => !!w && MANIEMENTS_A_DISTANCE.has(maniementDe(w));
