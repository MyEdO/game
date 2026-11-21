import type { CharKey, Combatant } from './types';

/** Caractéristiques pénalisées par l'Ivresse (LDB 09 l.475). */
export const DRUNK_CARACS: CharKey[] = ['capacite-de-combat', 'capacite-de-tir', 'agilite', 'dexterite', 'intelligence'];

/** Nombre d'échecs de Résistance à l'alcool accumulés. */
export function alcoholFailures(c: Combatant): number {
  return c.drunk?.failedTests ?? 0;
}

/** LDB 09 l.475 */
export function drunkPenalty(c: Combatant): number {
  const f = alcoholFailures(c);
  return f > 0 ? -10 * Math.min(3, f) : 0;
}

/** LDB 09 l.475 */
export function drunkCharPenalties(c: Combatant, key: CharKey): number[] {
  const p = drunkPenalty(c);
  return p < 0 && DRUNK_CARACS.includes(key) ? [p] : [];
}
