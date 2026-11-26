/** Péché et Colère Divine. LDB 40 l.36 */
import { describe, it, expect } from 'vitest';
import { prayerWrathTriggered } from './magic';

describe('prayerWrathTriggered (LDB 40 l.36)', () => {
  it('dé des unités ≤ Péchés → Colère (même logique sur réussite ou échec : le jet seul compte)', () => {
    expect(prayerWrathTriggered(42, 3)).toBe(true); // unités 2 ≤ 3
    expect(prayerWrathTriggered(33, 3)).toBe(true); // unités 3 ≤ 3 (égalité)
    expect(prayerWrathTriggered(61, 3)).toBe(true); // unités 1 ≤ 3
  });

  it('dé des unités > Péchés → pas de Colère', () => {
    expect(prayerWrathTriggered(45, 3)).toBe(false); // unités 5 > 3
    expect(prayerWrathTriggered(99, 3)).toBe(false); // unités 9 > 3
  });

  it('unités 0 (jets en -0 et 00) comptent comme 0 → toujours ≤ Péchés dès 1 Péché', () => {
    expect(prayerWrathTriggered(30, 1)).toBe(true);
    expect(prayerWrathTriggered(100, 1)).toBe(true); // 00 → unités 0
  });

  it('à 0 Péché, la règle ne mord pas (le risque naît d\'avoir péché — section l.44)', () => {
    expect(prayerWrathTriggered(30, 0)).toBe(false); // unités 0, mais aucun Péché
    expect(prayerWrathTriggered(1, 0)).toBe(false);
  });
});
