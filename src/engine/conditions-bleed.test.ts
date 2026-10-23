import { describe, it, expect, afterEach } from 'vitest';
import { bleedDeathRoll, loseWounds, applyZeroWounds, appliquerMortSubite, addCondition, hasCondition, removeCondition, stacks, setConditionGainedHook } from './conditions';
import { applyOps } from './ops';
import { applyHealWounds } from './healing';
import { setRule, resetRule } from './policy';
import type { Combatant } from './types';
import { deFixe, desDuTest } from './dice.testkit';

const fixed = deFixe;
/** Porteur à 0 PB et Inconscient (LDB 16 l.105), ou à `pb` PB conscient. */
function mk(pions: number, pb = 0): Combatant {
  const conditions = [...(pions ? [{ id: 'hemorragique', value: pions }] : []), ...(pb ? [] : [{ id: 'inconscient', value: 1 }])];
  return { name: 'X', label: 'X', wounds: { current: pb, max: 10 }, conditions } as unknown as Combatant;
}

describe('bleedDeathRoll — mort par Hémorragique (LDB 16 l.105)', () => {
  it('aucun Hémorragique → pas de jet, pas de mort', () => {
    expect(bleedDeathRoll(mk(0), fixed(5))).toEqual({ died: false, log: [] });
  });

  it('DOUBLE → coagulation (retire 1 pion), pas de mort (le double prime)', () => {
    const c = mk(3);
    const r = bleedDeathRoll(c, fixed(22)); // 22 = double, et ≤ 30 → coagule au lieu de tuer
    expect(r.died).toBe(false);
    expect(c.conditions.find((x) => x.id === 'hemorragique')!.value).toBe(2);
  });

  it('jet non-double ≤ 10×pions → mort', () => {
    expect(bleedDeathRoll(mk(3), fixed(15)).died).toBe(true); // 15 ≤ 30 (3 pions)
    expect(bleedDeathRoll(mk(1), fixed(5)).died).toBe(true); // 5 ≤ 10 (1 pion)
  });

  it('jet non-double > 10×pions → survit, et le jet se lit au journal', () => {
    const r = bleedDeathRoll(mk(3), fixed(50)); // 50 > 30
    expect(r.died).toBe(false);
    expect(r.log).toEqual(["X survit à l'hémorragie (50 > 30)."]);
    expect(bleedDeathRoll(mk(1), fixed(45)).died).toBe(false); // 45 > 10
  });

  it('porteur conscient → aucun jet', () => {
    expect(bleedDeathRoll(mk(3, 4), fixed(5))).toEqual({ died: false, log: [] });
  });
});

/** Porteur de 2 Hémorragique : BE 3, 3 PB, aucune armure (fixture nommée « Ilyanwe saignée »). */
function ilyanweSaignee(pb = 3): Combatant {
  return {
    name: 'Ilyanwe', label: 'Ilyanwe', kind: 'hero', skills: [], advantage: 0,
    characteristics: { endurance: 30 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    wounds: { current: pb, max: 18 }, conditions: [{ id: 'hemorragique', value: 2 }],
  } as unknown as Combatant;
}

describe('Hémorragique à 0 Blessure (LDB 16 l.105)', () => {
  afterEach(() => resetRule('combat-aa-blessures'));

  it('atteindre 0 par un coup → Inconscient (et À Terre)', () => {
    const c = ilyanweSaignee();
    expect(loseWounds(c, 10, null)).toBe(3);
    expect(hasCondition(c, 'inconscient')).toBe(true);
    expect(hasCondition(c, 'a-terre')).toBe(true);
  });

  it('atteindre 0 par le saignement (op `wounds` des pions) → Inconscient', () => {
    const c = ilyanweSaignee(2);
    applyOps(c, [{ op: 'wounds', amount: 2 }], { rng: desDuTest });
    expect(c.wounds.current).toBe(0);
    expect(hasCondition(c, 'inconscient')).toBe(true);
  });

  it('coup critique déjà décompté (PB posés à 0 par le flux d\'attaque) → Inconscient à `applyZeroWounds`', () => {
    const c = ilyanweSaignee(0);
    applyZeroWounds(c);
    expect(hasCondition(c, 'inconscient')).toBe(true);
  });

  it('sans Hémorragique, 0 PB ne fait pas perdre connaissance (LDB 18 l.15)', () => {
    const c = { ...ilyanweSaignee(), conditions: [] } as Combatant;
    loseWounds(c, 10, null);
    expect(hasCondition(c, 'a-terre')).toBe(true);
    expect(hasCondition(c, 'inconscient')).toBe(false);
  });

  it("variante Aux Armes : le Test d'AA 07 l.5 décide, 0 PB seul ne pose pas l'Inconscient", () => {
    setRule('combat-aa-blessures', 'aa');
    const c = ilyanweSaignee();
    loseWounds(c, 10, null);
    expect(hasCondition(c, 'inconscient')).toBe(false);
  });

  it('journal de l\'op `wounds` : les Blessures réellement perdues, rien à 0 PB', () => {
    const c = ilyanweSaignee(1);
    expect(applyOps(c, [{ op: 'wounds', amount: 2 }], { rng: desDuTest })).toEqual(['Ilyanwe subit 1 Blessure(s) (ignorant BE et PA).']);
    expect(applyOps(c, [{ op: 'wounds', amount: 2 }], { rng: desDuTest })).toEqual([]);
  });
});

describe('Inconscient du saignement : verrou et jet de mort (LDB 16 l.105 ; AA 07 l.7)', () => {
  afterEach(() => resetRule('combat-aa-blessures'));

  it('un soin ne réveille pas le porteur tant qu’un État Hémorragique reste', () => {
    const c = ilyanweSaignee();
    loseWounds(c, 10, null);
    const log = applyHealWounds(c, 2);
    expect(c.wounds.current).toBe(2);
    expect(hasCondition(c, 'inconscient'), 'verrou : Hémorragique encore porté').toBe(true);
    expect(log).toEqual(['Ilyanwe : +2 PB (2/18).']);
    removeCondition(c, 'hemorragique', 2);
    expect(applyHealWounds(c, 1)).toContain('Ilyanwe reprend connaissance.');
    expect(hasCondition(c, 'inconscient')).toBe(false);
  });

  /** Soignée à 1 PB, toujours Inconsciente sous le verrou, 2 Hémorragique. */
  function soigneeA1PB(): Combatant {
    const c = ilyanweSaignee();
    loseWounds(c, 10, null);
    applyHealWounds(c, 1);
    expect(hasCondition(c, 'inconscient')).toBe(true);
    return c;
  }

  it('mode ldb : soignée à 1 PB, Inconsciente et Hémorragique → jet de mort', () => {
    expect(bleedDeathRoll(soigneeA1PB(), fixed(15)).died).toBe(true); // 15 ≤ 20 (2 pions)
  });

  it('mode aa, 2 Hémorragique : le double 11 tue, le double 33 coagule (AA 07 l.7)', () => {
    const [tue, coagule] = [soigneeA1PB(), soigneeA1PB()];
    setRule('combat-aa-blessures', 'aa');
    expect(bleedDeathRoll(tue, fixed(11)), 'un double ≤ 10×pions n’évite pas la mort').toEqual({ died: true, log: ['Ilyanwe succombe à l\'hémorragie (11 ≤ 20).'] });
    expect(stacks(tue, 'hemorragique')).toBe(2);
    expect(bleedDeathRoll(coagule, fixed(33)).died, 'le double qui évite la mort coagule').toBe(false);
    expect(stacks(coagule, 'hemorragique')).toBe(1);
  });

  it('mode aa : soignée à 1 PB, Inconsciente et Hémorragique → jet de mort', () => {
    const c = soigneeA1PB();
    setRule('combat-aa-blessures', 'aa');
    expect(bleedDeathRoll(c, fixed(15)).died).toBe(true);
  });
});

/** Un soin d'1 PB réveille-t-il le porteur ? Non tant que le verrou du saignement tient : LDB 16 l.105. */
const sombreSousLeVerrou = (c: Combatant): boolean => {
  applyHealWounds(c, 1);
  return hasCondition(c, 'inconscient');
};

describe('Inconscient du saignement, quel que soit l’ordre des deux faits (LDB 16 l.105 ; AA 07 l.5)', () => {
  afterEach(() => resetRule('combat-aa-blessures'));

  const sansHemorragique = (pb: number): Combatant => ({ ...ilyanweSaignee(pb), conditions: [] }) as Combatant;
  const matrice: [string, () => Combatant][] = [
    ['perte de PB, puis État', () => { const c = sansHemorragique(3); loseWounds(c, 10, null); addCondition(c, 'hemorragique'); return c; }],
    ['État, puis perte de PB', () => { const c = ilyanweSaignee(3); loseWounds(c, 10, null); return c; }],
    ['op `wounds` à 0 PB', () => { const c = ilyanweSaignee(2); applyOps(c, [{ op: 'wounds', amount: 2 }], { rng: desDuTest }); return c; }],
    ['op `condition` Hémorragique sur une cible à 0 PB', () => { const c = sansHemorragique(3); loseWounds(c, 10, null); applyOps(c, [{ op: 'condition', id: 'hemorragique', value: 1 }], { rng: desDuTest }); return c; }],
  ];

  it.each(matrice)('mode ldb, %s : 0 PB, Inconscient verrouillé, À Terre', (_, porter) => {
    const c = porter();
    expect(c.wounds.current).toBe(0);
    expect(hasCondition(c, 'a-terre'), 'LDB 18 l.15').toBe(true);
    expect(sombreSousLeVerrou(c), 'LDB 16 l.105').toBe(true);
  });

  it.each(matrice)('mode aa, %s : le Test d’AA 07 l.5 décide, aucun Inconscient', (_, porter) => {
    setRule('combat-aa-blessures', 'aa');
    expect(hasCondition(porter(), 'inconscient')).toBe(false);
  });

  it('déjà Inconscient sans verrou, porté à 0 PB : À Terre et verrou du saignement (LDB 18 l.15 ; LDB 16 l.105)', () => {
    const c = ilyanweSaignee(3);
    c.conditions.push({ id: 'inconscient', value: 1 });
    loseWounds(c, 10, null);
    expect(hasCondition(c, 'a-terre')).toBe(true);
    expect(sombreSousLeVerrou(c)).toBe(true);
  });

  it('Mort subite d’un figurant déjà Inconscient : aucun État regagné, aucun Avantage reperdu (LDB 16 l.7 ; LDB 18 l.44)', () => {
    const c = { name: 'X', label: 'X', kind: 'enemy', advantage: 2, wounds: { current: 0, max: 10 }, conditions: [{ id: 'inconscient', value: 1 }, { id: 'a-terre', value: 1 }] } as unknown as Combatant;
    const gagnes: string[] = [];
    const precedent = setConditionGainedHook((_, name) => gagnes.push(name));
    try {
      appliquerMortSubite(c, [], null);
    } finally {
      setConditionGainedHook(precedent);
    }
    expect(gagnes).toEqual([]);
    expect(c.advantage).toBe(2);
  });

  it('Mort subite d’un figurant saigné : À Terre et verrou du saignement (LDB 18 l.15, l.44 ; LDB 16 l.105)', () => {
    const c = { ...ilyanweSaignee(3), kind: 'enemy' } as Combatant;
    appliquerMortSubite(c, [], null);
    expect(c.wounds.current).toBe(0);
    expect(hasCondition(c, 'a-terre')).toBe(true);
    expect(sombreSousLeVerrou(c)).toBe(true);
  });
});
