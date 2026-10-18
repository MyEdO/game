import { describe, it, expect } from 'vitest';
import { bandeAuDe, facesDuDe, findTableEntry, findTableEntryIndex, fourchette, tableOuverte } from './tables';
import { tableDesCritiquesDeStructure } from './structureCritical';

describe('findTableEntry — lookup d100 par fourchette [min,max] (source unique)', () => {
  const table = [
    { min: 1, max: 10, v: 'a' },
    { min: 11, max: 20, v: 'b' },
    { min: 21, max: 100, v: 'c' },
  ];
  it('trouve l’entrée contenant le jet (bornes incluses)', () => {
    expect(findTableEntry(table, 5).v).toBe('a');
    expect(findTableEntry(table, 11).v).toBe('b'); // borne basse
    expect(findTableEntry(table, 20).v).toBe('b'); // borne haute
    expect(findTableEntry(table, 50).v).toBe('c');
  });
  it('repli sur la DERNIÈRE entrée si le jet dépasse la table', () => {
    expect(findTableEntry(table, 999).v).toBe('c');
  });
});

describe('fourchette — graphie d’une bande de table', () => {
  it('bande ouverte (« 96 ou plus », AA 10 l.127) : « 96+ » ; bande fermée : « 01–35 »', () => {
    const t = tableDesCritiquesDeStructure();
    expect(fourchette(t[t.length - 1].min, t[t.length - 1].max, 100)).toBe('96+');
    expect(fourchette(t[0].min, t[0].max, 100)).toBe('01–35');
  });

  it('bande finale sans plafond en donnée (`max: null`, MDG 12 l.129 « 81+ »), borne unique, sans dé', () => {
    expect(fourchette(81, null)).toBe('81+');
    expect(fourchette(7, 7, 10)).toBe('7');
    expect(fourchette(1, 10)).toBe('1–10');
  });

  it('bande initiale sans plancher (`min: null`, MDG 14 l.199 « 50 ou moins ») : « ≤50 », en donnée comme ouverte', () => {
    expect(fourchette(null, 50)).toBe('≤50');
    expect(fourchette(Number.NEGATIVE_INFINITY, 50)).toBe('≤50');
    expect(fourchette(null, -5)).toBe('≤−5');
  });

  it('borne négative (MDG 13 l.73-74) : signe moins « − » et séparateur « à »', () => {
    expect(fourchette(-4, -3)).toBe('−4 à −3');
    expect(fourchette(-2, 0)).toBe('−2 à 0');
    expect(fourchette(-5, -5)).toBe('−5');
  });
});

describe('tableOuverte — la borne que le livre n’écrit pas s’ouvre à l’infini', () => {
  it('`min: null` → −∞, `max: null` → +∞, une borne écrite reste telle quelle', () => {
    const t = tableOuverte([{ min: null, max: -5 }, { min: -4, max: 3 }, { min: 4, max: null }]);
    expect(t.map((b) => [b.min, b.max])).toEqual([[Number.NEGATIVE_INFINITY, -5], [-4, 3], [4, Number.POSITIVE_INFINITY]]);
    expect(findTableEntryIndex(t, -1e6)).toBe(0);
    expect(findTableEntryIndex(t, 1e6)).toBe(2);
  });
});

describe('facesDuDe — faces d’un dé de table (source unique)', () => {
  it('d10 → 10, d100 → 100', () => {
    expect(facesDuDe('d10')).toBe(10);
    expect(facesDuDe('d100')).toBe(100);
  });
});

describe('bandeAuDe — bande précédée du libellé de son dé (docs/charte-ui.md, « Bande de table »)', () => {
  it('libellé du schéma et faces du dé : « 1d100 01–35 », « 1d10 9–10 », bande ouverte « 1d100 96+ »', () => {
    expect(bandeAuDe('d100', 1, 35)).toBe('1d100 01–35');
    expect(bandeAuDe('d10', 9, 10)).toBe('1d10 9–10');
    expect(bandeAuDe('d100', 96, null)).toBe('1d100 96+');
  });
});
