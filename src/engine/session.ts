/**
 * Fin de séance de jeu (Livre de base, « Ambitions » 05 l.793-841 & « Détermination » 17 l.79-85) :
 *  - Ambition à court terme accomplie → +50 PX ; à long terme → +500 PX (individuelle, l.795/799) ; les
 *    Ambitions de GROUPE accomplies rapportent la même chose à CHAQUE Joueur (l.837/841).
 *  - La Détermination est récupérée en agissant selon sa Motivation (l.81) : la Motivation cesse ainsi
 *    d'être une donnée morte.
 * PUR (aucun effet de bord) : la couche state applique ces valeurs (giveXp / resolve) + restaure la Chance.
 */
import { Combatant } from './types';
import { determinationDe, resolveMax } from './talentEffects';

/** PX d'une Ambition accomplie (LDB 05) : +50 (court terme, l.795) ou +500 (long terme, l.799). */
export function ambitionXp(scope: 'short' | 'long'): number {
  return scope === 'long' ? 500 : 50;
}

export interface SessionAmbition {
  /** Ambition à court terme accomplie cette séance. */
  short?: boolean;
  /** Ambition à long terme accomplie cette séance. */
  long?: boolean;
}

/**
 * PX gagnés par un héros en fin de séance : ses Ambitions PERSONNELLES accomplies (LDB 05 l.795/799)
 * PLUS les Ambitions de GROUPE accomplies — chaque Joueur reçoit la récompense de groupe (l.837/841).
 */
export function heroSessionXp(personal: SessionAmbition, group: SessionAmbition): number {
  let xp = 0;
  if (personal.short) xp += ambitionXp('short');
  if (personal.long) xp += ambitionXp('long');
  if (group.short) xp += ambitionXp('short');
  if (group.long) xp += ambitionXp('long');
  return xp;
}

/**
 * Détermination regagnée en agissant selon sa Motivation (LDB 17 l.81 : « La Détermination est récupérée
 * chaque fois que vous agissez en fonction de votre Motivation […] vous pouvez regagner un ou plusieurs
 * Points de Détermination »). +`points` Points, plafonnés au maximum du héros (`resolveMax`). Renvoie le
 * nouveau total de Détermination.
 */
export function regainDetermination(hero: Combatant, points = 1): number {
  return Math.min(resolveMax(hero), determinationDe(hero) + Math.max(0, points));
}
