import { fortuneMax } from './talentEffects';
import type { Combatant } from './types';

/**
 * Relance d'un Test par un Point de Chance — LDB 17 l.23 ; unicité de la relance — LDB 12 l.40.
 * `ownRollFailed` se juge sur le jet PROPRE du personnage (LDB 12 l.13), jamais sur l'issue d'une
 * opposition.
 */
export function canReroll(ownRollFailed: boolean, alreadyRerolled: boolean): boolean {
  return ownRollFailed && !alreadyRerolled;
}

/**
 * COUTURE UNIQUE de « début de séance de jeu » : restaure les Points de Chance (LDB 17 l.41 : « Vous
 * regagnez tous vos Points de Chance au début de chaque session de jeu, jusqu'à un maximum équivalent
 * à votre Destin actuel. »)
 * ET remet à zéro les compteurs PAR-SÉANCE (Résistance (Menace), LDB 10 l.1016-1020 : « à chaque
 * séance de jeu » → `resistanceUsed`). PUR : renvoie un nouveau tableau (héros seulement ; un héros
 * sans Destin garde sa Chance mais voit tout de même ses compteurs de séance remis).
 * Le plafond restauré est `fortuneMax` — le MAXIMUM effectif, que Chanceux (LDB 10 l.160) et les
 * effets actifs déplacent au-dessus du seul Indice de Destin — jamais `fate` nu.
 * SOURCE UNIQUE partagée par l'Effet de scène `restoreFortune` (combatEffects), l'action de store
 * `restoreFortuneNow()` (règle optionnelle « Longues Séances de Jeu », LDB 17 l.47) et la fin de
 * séance (`endSession`, partyFlow).
 */
export function restoreFortune(party: Combatant[]): Combatant[] {
  return party.map((h) => (h.kind === 'hero'
    ? { ...h, ...(h.fate != null ? { fortune: fortuneMax(h) } : {}), resistanceUsed: undefined }
    : h));
}

/** Sauvetage par le Destin (LDB 17 l.29) : sur le coup qui porte (`hit`) ou sur une mort lente (`slow`). */
export type FateSaveSource = 'hit' | 'slow';

/** Option du sacrifice : `survive` LDB 17 l.31, `negate` LDB 17 l.32. */
export type FateSaveOption = 'survive' | 'negate';

/** Options OFFERTES selon la source, dans l'ordre du livre : LDB 17 l.31-32. Source unique de la
 *  fenêtre, de son enjeu, du verbe `fateNegate` et de l'auto-combat. */
export function fateSaveOptions(source: FateSaveSource): readonly FateSaveOption[] {
  return source === 'hit' ? ['survive', 'negate'] : ['survive'];
}

/** Mort certaine évitée en brûlant 1 Point de Destin (LDB 17 l.29-37) : Destin −1 et la cible
 *  survit à 1 Blessure minimum (true) ; sans Destin, elle meurt (`dead`, false). La prose du
 *  dénouement reste au call-site (contexte : hémorragie, op kill, tick de maladie). */
export function fateSaveOrDie(c: Combatant): boolean {
  if ((c.fate ?? 0) > 0) {
    c.fate = (c.fate ?? 0) - 1;
    c.wounds.current = Math.max(1, c.wounds.current);
    return true;
  }
  c.dead = true;
  return false;
}
