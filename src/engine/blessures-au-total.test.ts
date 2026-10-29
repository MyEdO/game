import { describe, it, expect } from 'vitest';
import { applyOps, type GameOp } from './ops';
import { effectiveChar } from './characteristics';
import { endOfRound } from './conditions';
import type { Combatant } from './types';
import { desDuTest } from './dice.testkit';

/**
 * Blessures de profil AU TOTAL (#3060 ; LDB 71 l.20, Middenheim 04 l.27) : un `attrMod` de Blessures
 * `auTotal` déplace les Blessures max d'exactement `mod`, quels que soient les `charMod` de sa liste et les
 * autres modificateurs de F/E/FM, et son retrait rend la valeur d'avant.
 */

/** F 38 (BF 3), E 35 (BE 3), FM 31 (BFM 3) : B = 3 + 2×3 + 3 = 12. +10 en F ou en E franchit une dizaine. */
const heros = (): Combatant => ({
  id: 'h', label: 'Héros', kind: 'hero',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 38, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 31, sociabilite: 30 },
  movement: 4, wounds: { current: 12, max: 12, base: 12 }, advantage: 0, conditions: [],
  skills: [], talents: [], weapons: [], traits: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
} as unknown as Combatant);

const SOURCE_AU_TOTAL: GameOp[] = [
  { op: 'charMod', char: 'force', mod: 10 },
  { op: 'attrMod', attr: 'wounds', mod: 4, auTotal: true },
];

/** Pose `ops` pour un Round, sous le libellé `label`. */
const poser = (c: Combatant, ops: GameOp[], label: string) => applyOps(c, ops, { rng: desDuTest, label, defaultDurationRounds: 1 });

/** Frontière de Round : les durées tombent (`endOfRound`, retrait par `removeActiveEffects`). */
const finDeRound = (c: Combatant) => endOfRound(c, desDuTest);

describe('attrMod de Blessures au total — la source déplace les Blessures max d’exactement N', () => {
  it('pose : +4 exactement malgré la Force +10 ; la Force compte ailleurs ; retrait : la valeur d’avant', () => {
    const c = heros();
    poser(c, SOURCE_AU_TOTAL, 'Source au total');
    expect(effectiveChar(c, 'force')).toBe(48);
    expect(c.wounds.max).toBe(16);
    expect(c.wounds.current).toBe(16);
    finDeRound(c);
    expect(effectiveChar(c, 'force')).toBe(38);
    expect(c.wounds.max).toBe(12);
    expect(c.wounds.current).toBe(12);
  });

  it('la même source sans `auTotal` ajoute le recalcul par la Force (+5) : le marquage fait la différence', () => {
    const c = heros();
    poser(c, [{ op: 'charMod', char: 'force', mod: 10 }, { op: 'attrMod', attr: 'wounds', mod: 4 }], 'Source plate');
    expect(c.wounds.max).toBe(17);
  });

  it('cumul : un autre modificateur de F et d’E posé AVANT compte en plus, la source reste à +4, son retrait rend la valeur d’avant', () => {
    const c = heros();
    applyOps(c, [{ op: 'charMod', char: 'force', mod: 5 }, { op: 'charMod', char: 'endurance', mod: 10 }], { rng: desDuTest, label: 'Autre buff' });
    expect(c.wounds.max).toBe(15); // BF 4 (+1), BE 4 (+2)
    poser(c, SOURCE_AU_TOTAL, 'Source au total');
    expect(c.wounds.max).toBe(19);
    finDeRound(c);
    expect(c.wounds.max).toBe(15);
  });

  it('cumul : un autre modificateur de F posé APRÈS garde son propre recalcul, la source reste à +4', () => {
    const c = heros();
    poser(c, SOURCE_AU_TOTAL, 'Source au total');
    applyOps(c, [{ op: 'charMod', char: 'force', mod: 5 }], { rng: desDuTest, label: 'Autre buff' });
    expect(effectiveChar(c, 'force')).toBe(53);
    expect(c.wounds.max).toBe(17); // 12 + 1 (F 43 sans la source) + 4
    finDeRound(c);
    expect(c.wounds.max).toBe(13);
  });

  it('la liste couvre ses descentes : un `charMod` imbriqué (sous un `transform`) est marqué lui aussi', () => {
    const c = heros();
    poser(c, [
      { op: 'attrMod', attr: 'wounds', mod: 4, auTotal: true },
      { op: 'transform', tag: 'descente', ops: [{ op: 'charMod', char: 'endurance', mod: 10 }] },
    ], 'Source au total');
    expect(effectiveChar(c, 'endurance')).toBe(45);
    expect(c.wounds.max).toBe(16);
  });
});

describe('forme de profil par `transform` — « B +4 » au total, retrait par `endTransform`', () => {
  const TAG = 'forme-de-test';
  const FORME: GameOp[] = [
    { op: 'charMod', char: 'force', mod: 10 },
    { op: 'charMod', char: 'endurance', mod: 10 },
    { op: 'attrMod', attr: 'wounds', mod: 4, auTotal: true },
  ];

  it('la forme prend +4 exactement (le recalcul par F et E +10 en donnerait +3) ; son retrait rend 12', () => {
    const c = heros();
    applyOps(c, [{ op: 'transform', tag: TAG, ops: FORME }], { rng: desDuTest });
    expect(effectiveChar(c, 'force')).toBe(48);
    expect(effectiveChar(c, 'endurance')).toBe(45);
    expect(c.wounds.max).toBe(16);
    expect(c.wounds.current).toBe(16);
    applyOps(c, [{ op: 'endTransform', tag: TAG }], { rng: desDuTest });
    expect(c.wounds.max).toBe(12);
    expect(c.wounds.current).toBe(12);
  });

  it('cumul : un buff d’Endurance extérieur à la forme garde son recalcul, la forme reste à +4', () => {
    const c = heros();
    applyOps(c, [{ op: 'charMod', char: 'endurance', mod: 10 }], { rng: desDuTest, label: 'Autre buff' });
    expect(c.wounds.max).toBe(14);
    applyOps(c, [{ op: 'transform', tag: TAG, ops: FORME }], { rng: desDuTest });
    expect(c.wounds.max).toBe(18);
    applyOps(c, [{ op: 'endTransform', tag: TAG }], { rng: desDuTest });
    expect(c.wounds.max).toBe(14);
  });
});
