import { describe, it, expect } from 'vitest';
import { clockLabel } from './duration';

describe('clockLabel — forme exacte (durée écoulée ou estimée, #2533)', () => {
  it('décompose en jours, heures et minutes, arrondi à la minute', () => {
    expect(clockLabel(160, { exact: true })).toBe('2 h 40 min');
    expect(clockLabel(180, { exact: true })).toBe('3 h');
    expect(clockLabel(45, { exact: true })).toBe('45 min');
    expect(clockLabel(24 * 60 + 6 * 60, { exact: true })).toBe('1 j 6 h');
    expect(clockLabel(2 * 24 * 60 + 5 * 60 + 15, { exact: true })).toBe('2 j 5 h 15 min');
    expect(clockLabel(3 * 24 * 60 + 5, { exact: true })).toBe('3 j 5 min');
    expect(clockLabel(159.6, { exact: true })).toBe('2 h 40 min');
  });

  it('la forme courte (reste d’un effet) est inchangée', () => {
    expect(clockLabel(160)).toBe('3 h');
    expect(clockLabel(0, { exact: true })).toBeUndefined();
  });
});
