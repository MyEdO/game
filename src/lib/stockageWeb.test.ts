import { describe, it, expect, afterEach } from 'vitest';
import { lireDictionnaire, stockageWeb, type GenreDeStockage } from './stockageWeb';

const GENRES: GenreDeStockage[] = ['localStorage', 'sessionStorage'];

const poser = (genre: GenreDeStockage, descripteur: PropertyDescriptor): void => {
  Object.defineProperty(globalThis, genre, { configurable: true, ...descripteur });
};

describe.each(GENRES)('stockageWeb(%s) — l’accès protégé au stockage web', (genre) => {
  afterEach(() => {
    for (const g of GENRES) delete (globalThis as Partial<Record<GenreDeStockage, Storage>>)[g];
  });

  it('rend le stockage présent', () => {
    const s = { getItem: () => null } as unknown as Storage;
    poser(genre, { value: s, writable: true });
    expect(stockageWeb(genre)).toBe(s);
  });

  it('rend le stockage du genre demandé, jamais l’autre', () => {
    const demande = { getItem: () => 'demandé' } as unknown as Storage;
    const autre = { getItem: () => 'autre' } as unknown as Storage;
    poser(genre, { value: demande, writable: true });
    poser(GENRES.find((g) => g !== genre)!, { value: autre, writable: true });
    expect(stockageWeb(genre)).toBe(demande);
  });

  it('rend `null` quand il manque', () => {
    expect(stockageWeb(genre)).toBeNull();
  });

  it('rend `null` quand son accès lève (mode privé strict, iframe sandbox)', () => {
    poser(genre, { get: () => { throw new DOMException('accès refusé', 'SecurityError'); } });
    expect(stockageWeb(genre)).toBeNull();
  });
});

describe('lireDictionnaire — la valeur JSON d’une clé, quand c’est un dictionnaire (#2404)', () => {
  afterEach(() => {
    delete (globalThis as Partial<Record<GenreDeStockage, Storage>>).localStorage;
  });
  const avec = (raw: string | null) => poser('localStorage', { value: { getItem: () => raw } as unknown as Storage, writable: true });

  it('rend le dictionnaire stocké', () => {
    avec('{"a":1,"b":"x"}');
    expect(lireDictionnaire('localStorage', 'k')).toEqual({ a: 1, b: 'x' });
  });

  it.each([['absente', null], ['illisible', '{'], ['tableau', '[1]'], ['nombre', '3'], ['null', 'null']])('rend `null` : valeur %s', (_cas, raw) => {
    avec(raw);
    expect(lireDictionnaire('localStorage', 'k')).toBeNull();
  });

  it('rend `null` sans stockage', () => {
    expect(lireDictionnaire('localStorage', 'k')).toBeNull();
  });
});
