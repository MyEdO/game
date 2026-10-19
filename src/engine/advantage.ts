import type { Combatant } from './types';
import { rule } from './policy';
import { bonus, effectiveChar } from './characteristics';

/** Plafond d'Avantage FIXE — règle optionnelle « Limiter les Avantages » (LDB 14 l.198 :
 *  « 10 fonctionne plutôt bien puisque vous pouvez facilement les comptabiliser avec 1d10 »).
 *  Registre `combat-advantage-cap`. */
export function advantageCap(): number {
  return rule('combat-advantage-cap') as number;
}

/** Plafond d'Avantage EFFECTIF d'un combattant — SOURCE UNIQUE (gain + affichage). Par défaut le
 *  plafond fixe ; si « Plafond = Bonus d'Initiative » est actif (LDB 14 l.197), le Bonus
 *  d'Initiative du combattant prime (plafond par combattant). */
export function advantageCapFor(c: Combatant): number {
  return rule('combat-advantage-cap-bi') ? bonus(effectiveChar(c, 'initiative')) : advantageCap();
}

/** Gain d'Avantage CENTRALISÉ (héros ET ennemis) : clamp au plafond effectif du combattant. Les
 *  remises à zéro restent des affectations directes (LDB 14 l.219, 16 l.7…). Pure. */
export function gainAdvantage(c: Combatant, n = 1): void {
  c.advantage = avantageApresGain(c.advantage, n, advantageCapFor(c));
}

/** Avantage d'un porteur qui en tient `avant` après un gain de `n`, sous `plafond` — l'arithmétique de
 *  `gainAdvantage`, pour un porteur sans fiche suivie (LDB 14 l.198). Pure. */
export function avantageApresGain(avant: number, n: number, plafond: number): number {
  return n > 0 ? Math.min(plafond, avant + n) : avant;
}

/** Avantage d'un porteur qui en tient `avant` après en avoir perdu `n` — tous sans `n`, plancher 0
 *  (LDB 14 l.219). Pure. */
export function avantageApresPerte(avant: number, n?: number): number {
  return Math.max(0, avant - (n ?? avant));
}
