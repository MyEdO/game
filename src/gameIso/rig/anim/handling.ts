/**
 * CLASSE DE MANIEMENT — l'axe d'ANIMATION (port/idle, attaque, parade, prise des mains).
 *
 * Distinct du GROUPE de règles (`weaponGroup.ts`, subType WFRP). Le Groupe sert aux
 * RÈGLES (entraînement) et conflate des armes maniées différemment : « Base » mêle dague
 * 1-main et trucs improvisés, « Cavalerie » mêle lance et bec-de-corbin (un pic 1-main).
 * Pour ANIMER, ce qui compte c'est la PRISE physique (1 main / 2 mains, lame / hampe /
 * arc / arme à feu…) — donc on dérive le maniement de la FORME (silhouette dessinée), qui
 * encode la prise, et on ne retombe sur le Groupe que pour les armes NON dessinées.
 */
import type { FormeDArme } from '../parts/equipment';
import { weaponGroupKey } from '../../../engine/weaponGroup';

export type Handling =
  | 'lame1m' | 'escrime' | 'lourde2m' | 'hampe' | 'lance_cav' | 'fleau' | 'parade' | 'poings'
  | 'arc' | 'arbalete' | 'arme_feu' | 'fronde' | 'jet' | 'entraves' | 'explosif' | 'cornes';

/** FORME (slug d'art résolu, `FormeDArme.forme`) → classe de maniement. Clés = slugs des formes (weaponForms.ts). */
const FORM_HANDLING: Record<string, Handling> = {
  // Lame/percussion à UNE main (taille au côté). bec-de-corbin = pic 1-main (≠ son Groupe Cavalerie).
  couteau: 'lame1m', dague: 'lame1m', gourdin: 'lame1m', improvisee: 'lame1m', bec_de_corbin: 'lame1m',
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

/** Repli : GROUPE canonique (weaponGroupKey) → classe, pour les armes SANS forme dessinée. */
const GROUP_HANDLING: Record<string, Handling> = {
  base: 'lame1m', escrime: 'escrime', deuxmains: 'lourde2m', hast: 'hampe', cavalerie: 'lance_cav',
  fleau: 'fleau', parade: 'parade', bagarre: 'poings',
  arc: 'arc', arbalete: 'arbalete', poudre: 'arme_feu', ingenierie: 'arme_feu',
  fronde: 'fronde', lancer: 'jet', entraves: 'entraves', explosifs: 'explosif',
};

/** ARMES NATURELLES TYPÉES (kind STABLE stampé sur l'arme, `Weapon.attackKind`) → geste dédié :
 *  le tentacule FOUETTE (classe entraves), les cornes donnent un COUP DE TÊTE. Clés = ids de kind
 *  (`AttackKind` / id de trait naturel), JAMAIS un libellé. */
const NATURAL_HANDLING: Record<string, Handling> = {
  tentacules: 'entraves',
  cornes: 'cornes',
};

/** Classe de maniement d'une arme — routage PAR ID STABLE (plus aucun lookup de libellé au runtime) :
 *  kind naturel (`attackKind`) d'abord, puis FORME résolue (`forme`, encode la prise), repli Groupe/type. */
export function handlingClass(w?: FormeDArme): Handling {
  if (!w) return 'lame1m';
  if (w.attackKind) {
    const nat = NATURAL_HANDLING[w.attackKind];
    if (nat) return nat;
  }
  if (w.forme) {
    const h = FORM_HANDLING[w.forme];
    if (h) return h;
  }
  const h = GROUP_HANDLING[weaponGroupKey(w)];
  if (h) return h;
  return w.type === 'ranged' ? 'arc' : 'lame1m';
}

/** Classes maniées à DEUX mains (la main gauche vient tenir l'arme/la hampe/l'arc/le fût). */
const TWO_HANDED = new Set<Handling>(['lourde2m', 'hampe', 'arc', 'arbalete', 'arme_feu']);
export const isTwoHanded = (w?: FormeDArme): boolean => !!w && TWO_HANDED.has(handlingClass(w));

/** Classes à DISTANCE (geste de tir/jet, esquive au lieu de parer en mêlée). */
const RANGED = new Set<Handling>(['arc', 'arbalete', 'arme_feu', 'fronde', 'jet', 'entraves', 'explosif']);
export const isRangedHandling = (w?: FormeDArme): boolean => !!w && RANGED.has(handlingClass(w));
