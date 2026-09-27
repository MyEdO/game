import { describe, it, expect } from 'vitest';
import { alternationDe, alternationDeRegex, echapperRegex, espacesExtensibles } from './regex';

const SYNTAX_CHARACTERS = '^$\\.*+?()[]{}|';
const IMPRIMABLES = [
  ...Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCharCode(0x20 + i)),
  ...'éà·–—«»',
];
const DRAPEAUX = ['', 'u', 'v'] as const;
const exacte = (source: string, drapeau: string): RegExp => new RegExp(`^(?:${source})$`, drapeau);

describe('echapperRegex', () => {
  it('échappe exactement les SyntaxCharacter, et aucun autre caractère', () => {
    for (const c of IMPRIMABLES) {
      expect(echapperRegex(c)).toBe(SYNTAX_CHARACTERS.includes(c) ? `\\${c}` : c);
    }
  });

  it('rend une regex valide qui ne matche que la chaîne, sous les drapeaux "", u et v, sur toute paire', () => {
    for (const drapeau of DRAPEAUX) {
      for (const a of IMPRIMABLES) {
        for (const b of IMPRIMABLES) {
          const s = a + b;
          const re = exacte(echapperRegex(s), drapeau);
          expect(re.test(s), `${JSON.stringify(s)} sous "${drapeau}"`).toBe(true);
        }
      }
      expect(exacte(echapperRegex(SYNTAX_CHARACTERS), drapeau).test(SYNTAX_CHARACTERS)).toBe(true);
      expect(exacte(echapperRegex('a.c'), drapeau).test('abc')).toBe(false);
    }
  });
});

describe('alternationDe', () => {
  it('met la plus longue d\'abord', () => {
    expect(alternationDe(['AB', 'ABC'])).toBe('ABC|AB');
    expect(new RegExp(`^(?:${alternationDe(['AB', 'ABC'])})`).exec('ABC')?.[0]).toBe('ABC');
  });

  it('garde l\'ordre de l\'appelant à longueur égale (tri stable)', () => {
    expect(alternationDe(['QR', 'ABC', 'XY', 'AB'])).toBe('ABC|QR|XY|AB');
    expect(alternationDe(['XY', 'AB', 'QR'])).toBe('XY|AB|QR');
  });

  it('dédoublonne', () => {
    expect(alternationDe(['AB', 'ABC', 'AB', 'ABC'])).toBe('ABC|AB');
  });

  it('trie sur la chaîne d\'origine, puis échappe chaque chaîne', () => {
    expect(alternationDe(['a.b', 'a.bc', '(x)'])).toBe('a\\.bc|a\\.b|\\(x\\)');
    expect(alternationDe(['...', 'abcd'])).toBe('abcd|\\.\\.\\.');
  });

  it('accepte tout itérable de chaînes', () => {
    expect(alternationDe(new Set(['AB', 'ABC']))).toBe('ABC|AB');
  });

  it('lève sur un élément qui n\'est pas une chaîne, en le nommant', () => {
    expect(() => alternationDe([['AB']] as unknown as string[])).toThrow(/\["AB"\]/);
    expect(() => alternationDe(['AB', 3] as unknown as string[])).toThrow(/3/);
  });

  it('parChaine transforme chaque chaîne échappée sans changer le tri', () => {
    const parChaine = (e: string): string => `${e}s?`;
    expect(alternationDe(['a.b', 'a.bcd', 'xyz'], { parChaine })).toBe('a\\.bcds?|a\\.bs?|xyzs?');
    expect(alternationDe(['A', 'BCD'], { parChaine: () => 'TRES-LONG' })).toBe('TRES-LONG|TRES-LONG');
  });

  it('rend (?!) sur une liste vide, qui ne matche rien, pas même la chaîne vide', () => {
    expect(alternationDe([])).toBe('(?!)');
    for (const drapeau of DRAPEAUX) {
      expect(new RegExp(alternationDe([]), drapeau).test('')).toBe(false);
      expect(new RegExp(alternationDe([]), drapeau).test('AB')).toBe(false);
    }
  });
});

describe('alternationDeRegex', () => {
  it('prend une RegExp par sa .source, une chaîne telle quelle, chacune en (?:…), dans l\'ordre de l\'appelant', () => {
    expect(alternationDeRegex([/a+/, 'b|c', /\d{2}/])).toBe('(?:a+)|(?:b|c)|(?:\\d{2})');
    expect(alternationDeRegex(['x', 'xyz'])).toBe('(?:x)|(?:xyz)');
  });

  it('lève sur une RegExp qui porte des drapeaux', () => {
    expect(() => alternationDeRegex([/a/, /b/i])).toThrow(/b\/i/);
    expect(() => alternationDeRegex([/a/g])).toThrow();
  });

  it('rend (?!) sur une liste vide', () => {
    expect(alternationDeRegex([])).toBe('(?!)');
    expect(new RegExp(alternationDeRegex([]), 'v').test('')).toBe(false);
  });
});

describe('espacesExtensibles', () => {
  it('fait de chaque espace une suite de blancs', () => {
    expect(espacesExtensibles('a b  c')).toBe('a\\s+b\\s+\\s+c');
    const re = new RegExp(`^${espacesExtensibles(echapperRegex('a.b c'))}$`);
    expect(re.test('a.b \n\t c')).toBe(true);
    expect(re.test('a.bc')).toBe(false);
  });

  it('se compose en parChaine, au pluriel compris', () => {
    const seul = alternationDe(['mot clef', 'x'], { parChaine: espacesExtensibles });
    expect(seul).toBe('mot\\s+clef|x');
    const pluriel = alternationDe(['a.b c', 'dé'], {
      parChaine: (e) => espacesExtensibles(e.split(' ').map((mot) => `${mot}s?`).join(' ')),
    });
    expect(pluriel).toBe('a\\.bs?\\s+cs?|dés?');
    const re = new RegExp(`^(?:${pluriel})$`, 'v');
    expect(re.test('a.bs\n cs')).toBe(true);
    expect(re.test('dés')).toBe(true);
    expect(re.test('aXb c')).toBe(false);
  });
});
