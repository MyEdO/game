import { describe, it, expect } from 'vitest';
import { resolveRun } from './movement';
import { makeRNG } from './dice';

describe('resolveRun — Course (LDB 15 l.41)', () => {
  it('succès → bonus de Course ≥ 2×Mouvement (DR ≥ 0)', () => {
    const r = resolveRun(90, 'accessible', 4, makeRNG(3));
    expect(r.success).toBe(true);
    expect(r.bonusCases).toBeGreaterThanOrEqual(8); // 2×Mouvement (cases)
    expect(typeof r.roll).toBe('number');
  });

  it('la cible est la valeur + le modificateur de la Difficulté REÇUE', () => {
    expect(resolveRun(50, 'difficile', 4, makeRNG(3)).target).toBe(30);
    expect(resolveRun(50, 'accessible', 4, makeRNG(3)).target).toBe(70);
  });

  it('bonus = max(0, 2×Mouvement + round(DR/2)) — jamais négatif', () => {
    const r = resolveRun(20, 'accessible', 5, makeRNG(7));
    expect(r.bonusCases).toBe(Math.max(0, 2 * 5 + Math.round(r.dr / 2)));
    expect(r.bonusCases).toBeGreaterThanOrEqual(0);
  });
});
