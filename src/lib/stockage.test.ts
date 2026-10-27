import { describe, it, expect } from 'vitest';
import { lireDictionnaire, lireLeTexte, retirerLaCle, type Stockage } from './stockage';
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
