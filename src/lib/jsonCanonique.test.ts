import { describe, it, expect } from 'vitest';
import { jsonCanonique } from './jsonCanonique.mjs';

describe('jsonCanonique', () => {
  it("deux valeurs égales en profondeur ont le même texte, quel que soit l'ordre de leurs clés", () => {
    expect(jsonCanonique({ b: 1, a: { d: [1, { f: 2, e: 3 }], c: 'x' } })).toBe(jsonCanonique({ a: { c: 'x', d: [1, { e: 3, f: 2 }] }, b: 1 }));
    expect(jsonCanonique({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
  it('omet une clé de valeur undefined, comme JSON.stringify', () => {
    expect(jsonCanonique({ a: undefined, b: null })).toBe('{"b":null}');
  });
  it('rend null un élément undefined de liste, comme JSON.stringify', () => {
    expect(jsonCanonique([undefined, 1])).toBe(JSON.stringify([undefined, 1]));
    expect(jsonCanonique([undefined])).not.toBe(jsonCanonique([]));
  });
  it("trie aux unités de code, comme .sort() sans comparateur", () => {
    expect(jsonCanonique({ é: 1, z: 2, Z: 3 })).toBe('{"Z":3,"z":2,"é":1}');
  });
  it('rend le JSON des scalaires et des listes', () => {
    expect(jsonCanonique([1, 'a', true, null])).toBe('[1,"a",true,null]');
  });
});
