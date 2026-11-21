import type { CharKey, Combatant } from './types';

/** LDB 18 l.342 */
export function hungerCharPenalties(c: Combatant, key: CharKey): number[] {
  const f = c.hunger?.failures ?? 0;
  if (f >= 1 && (key === 'force' || key === 'endurance')) return [-10];
  if (f >= 2 && key !== 'force' && key !== 'endurance') return [-10];
  return [];
}

/** LDB 18 l.340 */
export function thirstCharPenalties(c: Combatant, key: CharKey): number[] {
  const f = c.thirst?.failures ?? 0;
  const first = key === 'intelligence' || key === 'force-mentale' || key === 'sociabilite';
  if (f >= 1 && first) return [-10];
  if (f >= 2 && !first) return [-10];
  return [];
}
