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

/** Le porteur tel qu'il était juste avant le coup qui le tue : ce que rétablit LDB 17 l.32. */
export type PorteurAvantLeCoup = Combatant;

/** Photographie du porteur AVANT que le coup ne lui écrive quoi que ce soit (PB, Critiques, États,
 *  Traumatismes, Avantage) — SOURCE UNIQUE des sites qui peuvent ouvrir le sauvetage `hit`, et SEUL
 *  prédicat de son ouverture : `undefined` pour qui n'a aucun Point de Destin à brûler (LDB 17 l.29). */
export function avantLeCoup(c: Combatant): PorteurAvantLeCoup | undefined {
  return (c.fate ?? 0) > 0 ? structuredClone(c) : undefined;
}

/** « Comment ça a pu rater ? » (LDB 17 l.32) : le porteur redevient, en place, celui d'avant le coup, puis
 *  brûle 1 Point de Destin. Chez les autres, la chute n'a rien écrit : `reglerLesChutes` attend. */
export function rateParLeDestin(c: Combatant, avant: PorteurAvantLeCoup): void {
  const porteur = c as unknown as Record<string, unknown>;
  for (const cle of Object.keys(porteur)) if (!(cle in avant)) delete porteur[cle];
  Object.assign(c, structuredClone(avant));
  c.fate = (c.fate ?? 0) - 1;
}

/** Le sauvetage offert : sur le coup, avec le porteur d'avant le coup à rétablir (LDB 17 l.32), ou sur une
 *  mort lente (LDB 17 l.29). */
export type SauvetageDuDestin = { source: Extract<FateSaveSource, 'hit'>; avant: PorteurAvantLeCoup } | { source: Exclude<FateSaveSource, 'hit'> };

/** Ce que rétablirait « Comment ça a pu rater ? » (LDB 17 l.32), `undefined` quand l'option n'est pas
 *  offerte — SEULE ouverture de la négation. */
export function avantANier(p: SauvetageDuDestin): PorteurAvantLeCoup | undefined {
  return p.source === 'hit' ? p.avant : undefined;
}

/** Options OFFERTES, dans l'ordre du livre : LDB 17 l.31-32. Source unique de la fenêtre, de son enjeu et
 *  de l'auto-combat. */
export function fateSaveOptions(p: SauvetageDuDestin): readonly FateSaveOption[] {
  return avantANier(p) ? ['survive', 'negate'] : ['survive'];
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
