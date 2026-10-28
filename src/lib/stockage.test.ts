import { describe, it, expect } from 'vitest';
import { lireDictionnaire, type Stockage } from './stockage';

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
