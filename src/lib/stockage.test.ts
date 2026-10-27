import { describe, it, expect } from 'vitest';
import { lesChaines, lireDictionnaire, lireLeTexte, lireTableau, retirerLaCle, type Stockage } from './stockage';
import { stockageEnMemoire, stockageQuiLeve } from './stockage.testkit';

const avec = (raw: string | null): Stockage => ({ getItem: () => raw, setItem: () => {}, removeItem: () => {} });

describe('lireDictionnaire — la valeur JSON d’une clé, quand c’est un dictionnaire (#2404)', () => {
  it('rend le dictionnaire stocké', () => {
    expect(lireDictionnaire(avec('{"a":1,"b":"x"}'), 'k')).toEqual({ a: 1, b: 'x' });
  });

  it.each([['absente', null], ['illisible', '{'], ['tableau', '[1]'], ['nombre', '3'], ['null', 'null']])('rend `null` : valeur %s', (_cas, raw) => {
    expect(lireDictionnaire(avec(raw), 'k')).toBeNull();
  });

  it('rend `null` sans stockage', () => {
    expect(lireDictionnaire(null, 'k')).toBeNull();
  });

  it('rend `null` quand la lecture lève', () => {
    const levant: Stockage = { ...avec(null), getItem: () => { throw new DOMException('accès refusé', 'SecurityError'); } };
    expect(lireDictionnaire(levant, 'k')).toBeNull();
  });
});

describe('lireTableau — la valeur JSON d’une clé, quand c’est un tableau (#2404)', () => {
  it('rend le tableau stocké', () => {
    expect(lireTableau(avec('[1,"a",{"id":"x"}]'), 'k')).toEqual([1, 'a', { id: 'x' }]);
  });

  it.each([['absente', null], ['illisible', '['], ['dictionnaire', '{"a":1}'], ['chaîne', '"a"'], ['null', 'null']])('rend `null` : valeur %s', (_cas, raw) => {
    expect(lireTableau(avec(raw), 'k')).toBeNull();
  });

  it('rend `null` sans stockage, ou quand la lecture lève', () => {
    expect(lireTableau(null, 'k')).toBeNull();
    expect(lireTableau(stockageQuiLeve, 'k')).toBeNull();
  });
});

describe('lesChaines — les chaînes d’une valeur relue', () => {
  it('garde les seuls éléments chaînes d’un tableau', () => {
    expect(lesChaines(['a', 1, null, 'b', { id: 'c' }])).toEqual(['a', 'b']);
  });

  it.each([['absente', undefined], ['null', null], ['dictionnaire', { a: 'x' }], ['chaîne', 'a']])('rend `[]` : valeur %s', (_cas, v) => {
    expect(lesChaines(v)).toEqual([]);
  });
});

describe('lireLeTexte, retirerLaCle — les accès protégés d’un stockage', () => {
  it('lit le texte d’une clé, et la retire', () => {
    const s = stockageEnMemoire();
    s.setItem('k', 'v');
    expect(lireLeTexte(s, 'k')).toBe('v');
    retirerLaCle(s, 'k');
    expect(lireLeTexte(s, 'k')).toBeNull();
  });

  it('stockage absent ou qui lève : `null` à la lecture, le retrait ne lève pas', () => {
    for (const s of [null, stockageQuiLeve]) {
      expect(lireLeTexte(s, 'k')).toBeNull();
      expect(() => retirerLaCle(s, 'k')).not.toThrow();
    }
  });
});
