/**
 * Doublure du RNG de bataille (#2817, D8) : impose la SÉQUENCE des d100 que tire le flux, par l'espion
 * de `battleRng().int`. Un tirage d'une autre plage (d10…) reçoit la même fraction du dé, rapportée à
 * sa plage. Au-delà de la séquence, chaque dé vaut 1. L'espion se lève par `vi.restoreAllMocks()`.
 */
import { vi } from 'vitest';
import { battleRng } from './battleRng';

export function imposerLesD100(...des: number[]): void {
  const file = [...des];
  vi.spyOn(battleRng(), 'int').mockImplementation((min, max) => min + Math.floor((((file.shift() ?? 1) - 0.5) / 100) * (max - min + 1)));
}
