/** `versionCourante` (#2226) : la valeur ET le type littéral de la version courante, dérivés d'une table. */
import { describe, expect, expectTypeOf, it } from 'vitest';
import { versionCourante } from './versionCourante';

describe('versionCourante (#2226)', () => {
  it('la plus grande clé + 1, quel que soit l’ordre des clés', () => {
    expect(versionCourante({ 58: 'a', 59: 'b', 60: 'c' })).toBe(61);
    expect(versionCourante({ 3: 'c', 1: 'a', 2: 'b' })).toBe(4);
    expect(versionCourante({ 0: () => {} })).toBe(1);
  });

  it('le TYPE est le littéral : une valeur périmée ne compile pas', () => {
    const table = { 15: (d: object) => d, 16: (d: object) => d };
    const courante = versionCourante(table);
    expectTypeOf(courante).toEqualTypeOf<17>();
    // @ts-expect-error 16 n'est pas la version courante
    const perimee: 16 = courante;
    expect(perimee).toBe(17);
  });

  it('le type tient sur une table haute', () => {
    expectTypeOf(versionCourante({ 997: 'a', 998: 'b' })).toEqualTypeOf<999>();
  });
});
