import { describe, it, expect } from 'vitest';
import { bandeAuDe, deDeLaTableTiree, facesDuDe, findTableEntry, findTableEntryIndex, findTierEntry, fourchette, tableOuverte } from './tables';
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

describe('findTierEntry — lookup d’une table à paliers (source unique)', () => {
  const paliers = [
    { seuil: 1, v: 'a' },
    { seuil: 3, v: 'b' },
    { seuil: 8, v: 'c' },
  ];
  it('retient le palier de plus grand seuil atteint (seuil inclus)', () => {
    expect(findTierEntry(paliers, 1)?.v).toBe('a');
    expect(findTierEntry(paliers, 2)?.v).toBe('a');
    expect(findTierEntry(paliers, 3)?.v).toBe('b');
    expect(findTierEntry(paliers, 7)?.v).toBe('b');
    expect(findTierEntry(paliers, 999)?.v).toBe('c');
  });
  it('`undefined` sous le plus bas palier : le repli est celui de l’appelant', () => {
    expect(findTierEntry(paliers, 0)).toBeUndefined();
    expect(findTierEntry([], 5)).toBeUndefined();
  });
  it('indépendant de l’ordre d’authoring', () => {
    const desordre = [paliers[2], paliers[0], paliers[1]];
    expect([0, 1, 2, 3, 7, 8, 20].map((n) => findTierEntry(desordre, n)?.v)).toEqual([0, 1, 2, 3, 7, 8, 20].map((n) => findTierEntry(paliers, n)?.v));
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

describe('deDeLaTableTiree — le dé se lit sur le nœud de sa table (#1667)', () => {
  it('lit le `die` de son nœud, table ou sous-tirage', () => {
    expect(deDeLaTableTiree({ die: '2d10' })).toEqual({ n: 2, sides: 10 });
    expect(deDeLaTableTiree({ die: 'd10' })).toEqual({ n: 1, sides: 10 });
  });
  it('refuse un dé illisible en nommant la table', () => {
    expect(() => deDeLaTableTiree({ id: 'fixture', die: 'deux dés' })).toThrow('fixture.die invalide');
  });
  it('un dé nu ne compile pas, ni chaîne ni `DiceSpec` littéral : `tsc` rougit (TS2578) si une directive cesse de servir', () => {
    const refuses = [
      // @ts-expect-error — chaîne : le dé d'une table se lit sur la table
      () => facesDuDe('d10'),
      // @ts-expect-error — `DiceSpec` littéral : la marque de lecture est absente
      () => bandeAuDe({ n: 1, sides: 10 }, 1, 5),
    ];
    expect(refuses).toHaveLength(2);
  });
});

describe('facesDuDe — faces d’un dé de table (source unique)', () => {
  it('d10 → 10, d100 → 100, 2d10 → 20', () => {
    expect(facesDuDe(deDeLaTableTiree({ die: 'd10' }))).toBe(10);
    expect(facesDuDe(deDeLaTableTiree({ die: 'd100' }))).toBe(100);
    expect(facesDuDe(deDeLaTableTiree({ die: '2d10' }))).toBe(20);
  });
});

describe('bandeAuDe — bande précédée du libellé de son dé (docs/charte-ui.md, « Bande de table »)', () => {
  it('libellé du schéma et faces du dé : « 1d100 01–35 », « 1d10 9–10 », bande ouverte « 1d100 96+ »', () => {
    const d100 = deDeLaTableTiree({ die: 'd100' });
    expect(bandeAuDe(d100, 1, 35)).toBe('1d100 01–35');
    expect(bandeAuDe(deDeLaTableTiree({ die: 'd10' }), 9, 10)).toBe('1d10 9–10');
    expect(bandeAuDe(d100, 96, null)).toBe('1d100 96+');
  });
});
