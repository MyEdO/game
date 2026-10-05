// #2097
import { describe, it, expect } from 'vitest';
import { estUneDonneeGelee, gelerLaConstante, gelerProfond } from './gelerProfond';

describe('gelerProfond / gelerLaConstante (#2097)', () => {
  it('`gelerProfond` gèle en profondeur et MARQUE comme donnée', () => {
    const d = { a: { b: [1, { c: 2 }] } };
    gelerProfond(d);
    for (const o of [d, d.a, d.a.b, d.a.b[1] as object]) {
      expect(Object.isFrozen(o)).toBe(true);
      expect(estUneDonneeGelee(o)).toBe(true);
    }
  });

  it('`gelerLaConstante` gèle en profondeur SANS marquer, et rend sa racine', () => {
    const k = { a: { b: [1, { c: 2 }] } };
    expect(gelerLaConstante(k)).toBe(k);
    for (const o of [k, k.a, k.a.b, k.a.b[1] as object]) {
      expect(Object.isFrozen(o)).toBe(true);
      expect(estUneDonneeGelee(o)).toBe(false);
    }
  });

  it('une instance de classe n’est ni gelée ni parcourue', () => {
    const m = new Map([['x', { y: 1 }]]);
    gelerProfond({ m });
    expect(Object.isFrozen(m)).toBe(false);
    expect(Object.isFrozen(m.get('x'))).toBe(false);
  });
});
