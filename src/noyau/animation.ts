/**
 * LE VOCABULAIRE D'ANIMATION (#2972) : les rôles qu'un corps joue et le maniement d'une arme. Le rig SVG (`src/gameIso/rig/anim/`) et l'hôte Godot
 * (`hotes/godot/asset/manifeste.ts`) lisent ce seul type.
 *
 * Le MANIEMENT est l'axe d'animation (prise physique : une main, deux mains, lame, hampe, arc…), distinct du GROUPE
 * de règles (`src/engine/weaponGroup.ts`) : il se dérive de la FORME dessinée, qui encode la prise, et ne retombe
 * sur le Groupe que pour une arme sans forme.
 */
import type { FormeDArme } from './equipementDessine';
import { weaponGroupKey } from '../engine/weaponGroup';
import { racineDesCandidats } from '../engine/items';

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

export const MANIEMENTS = Object.freeze([
  'lame1m', 'escrime', 'lourde2m', 'hampe', 'lance_cav', 'fleau', 'parade', 'poings',
  'arc', 'arbalete', 'arme_feu', 'fronde', 'jet', 'entraves', 'explosif', 'cornes',
] as const);
export type Maniement = (typeof MANIEMENTS)[number];

/** Racine des candidats résolus → maniement. Clés = slugs des formes (`src/gameIso/rig/parts/weaponForms.ts`). */
const MANIEMENT_DE_FORME: Readonly<Record<string, Maniement>> = {
  // Lame/percussion à UNE main (taille au côté). bec-de-corbin = pic 1-main (≠ son Groupe Cavalerie).
  couteau: 'lame1m', dague: 'lame1m', improvisee: 'lame1m', bec_de_corbin: 'lame1m',
  // Escrime : estoc/fente, pointe en avant.
  fleuret: 'escrime', rapiere: 'escrime',
  // Lourde à DEUX mains : grand coup vertical, deux mains sur la poignée.
  epee_batarde: 'lourde2m', grande_hache: 'lourde2m', marteau_guerre: 'lourde2m', pioche_2m: 'lourde2m', zweihander: 'lourde2m',
  // Hampe : longue tige, deux mains, estoc.
  baton: 'hampe', hallebarde: 'hampe', lance: 'hampe', pique: 'hampe',
  // Lance de cavalerie : dressée au repos / couchée en charge.
  lance_cavalerie: 'lance_cav',
  // Fléau : tête articulée qui pend, moulinet.
  fleau: 'fleau', fleau_grain: 'fleau', fleau_armes: 'fleau',
  // Parade : arme défensive de main gauche.
  brise_epee: 'parade', main_gauche: 'parade',
  // Poings nus / cestes.
  poing: 'poings',
  // Arc : tenu vertical, bandé à deux mains.
  arc: 'arc', arc_court: 'arc', arc_elfique: 'arc', arc_long: 'arc',
  // Arbalète : bercée/horizontale, deux mains.
  arbalete: 'arbalete', arbalete_poing: 'arbalete', arbalete_lourde: 'arbalete',
  // Arme à feu (poudre + ingénierie) : portée, visée + recul + fumée.
  arquebuse: 'arme_feu', hochland: 'arme_feu', pistolet: 'arme_feu', tromblon: 'arme_feu',
  arquebus_rep: 'arme_feu', pistolet_rep: 'arme_feu',
  // Fronde : pend, moulinet.
  fronde: 'fronde', fustibale: 'fronde',
  // Jet : armé à l'épaule, lancer overhand.
  bolas: 'jet', couteau_lancer: 'jet', flechette: 'jet', hache_lancer: 'jet', javelot: 'jet', rocher: 'jet',
  // Entraves : fouet/lasso, grand arc + claquement.
  fouet: 'entraves', lasso: 'entraves',
  // Explosif : tenu bas, lob en cloche.
  bombe: 'explosif', bombe_incendiaire: 'explosif',
};

/** Repli : GROUPE canonique (`weaponGroupKey`) → maniement, pour une arme SANS forme dessinée. */
const MANIEMENT_DE_GROUPE: Readonly<Record<string, Maniement>> = {
  base: 'lame1m', escrime: 'escrime', deuxmains: 'lourde2m', hast: 'hampe', cavalerie: 'lance_cav',
  fleau: 'fleau', parade: 'parade', bagarre: 'poings',
  arc: 'arc', arbalete: 'arbalete', poudre: 'arme_feu', ingenierie: 'arme_feu',
  fronde: 'fronde', lancer: 'jet', entraves: 'entraves', explosifs: 'explosif',
};

/** Arme naturelle typée (`Weapon.attackKind`, id stable du trait) → maniement dédié. */
const MANIEMENT_NATUREL: Readonly<Record<string, Maniement>> = {
  tentacules: 'entraves',
  cornes: 'cornes',
};

/** Maniement d'une arme, par id stable : kind naturel (`attackKind`), puis racine des candidats, repli Groupe/type. */
export function maniementDe(w?: FormeDArme): Maniement {
  if (!w) return 'lame1m';
  if (w.attackKind) {
    const nat = MANIEMENT_NATUREL[w.attackKind];
    if (nat) return nat;
  }
  const forme = racineDesCandidats(w.candidats);
  if (forme) {
    const m = MANIEMENT_DE_FORME[forme];
    if (m) return m;
  }
  const m = MANIEMENT_DE_GROUPE[weaponGroupKey(w)];
  if (m) return m;
  return w.type === 'ranged' ? 'arc' : 'lame1m';
}

/** Maniements à DISTANCE (geste de tir/jet, esquive au lieu de parer en mêlée). */
export const MANIEMENTS_A_DISTANCE: ReadonlySet<Maniement> = new Set<Maniement>(['arc', 'arbalete', 'arme_feu', 'fronde', 'jet', 'entraves', 'explosif']);
export const estManiementADistance = (w?: FormeDArme): boolean => !!w && MANIEMENTS_A_DISTANCE.has(maniementDe(w));
