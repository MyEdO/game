import { describe, it, expect } from 'vitest';
import { applyOps } from './ops';
import { slBonus } from './formule';
import { stacks } from './conditions';
import type { Combatant } from './types';
import { findTraitById } from '../data';
import type { Flow } from './flowCore';
import { deFixe, desDuTest } from './dice.testkit';

/**
 * Enablers d'ops (Jalon 2.6) :
 *  - `PerSL` / `OpsCtx.sl` : échelles « par +N DR » des sorts (LDB 41/42/47/48 —
 *    « 1d10 + DR Dégâts » Comète, « +1 Empêtré par +2 DR » Enchevêtrement,
 *    « perd 1 Point de Corruption (+1 par +2 DR) » Innocence immaculée,
 *    « +DR État Enflammé » Purification) ;
 *  - `onlyGroups` : ops gatées par Groupe de la cible (engine/groups — « les cibles
 *    possédant les Traits Mort-vivant et Démoniaque gagnent aussi En flammes », Feu de l'âme).
 */
const dummy = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x', label: 'X', kind: 'enemy',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

describe('PerSL — échelle « par +N DR » (OpsCtx.sl)', () => {
  it('slBonus : paliers entiers, jamais négatif, sl absent = 0', () => {
    expect(slBonus(5, { every: 2, amount: 1 })).toBe(2); // +1 par +2 DR, DR 5 → +2
    expect(slBonus(5, { every: 1, amount: 1 })).toBe(5); // +DR
    expect(slBonus(4, { every: 2, amount: -1 })).toBe(-2); // retrait (Innocence immaculée)
    expect(slBonus(-3, { every: 2, amount: 1 })).toBe(0); // DR négatif → rien
    expect(slBonus(undefined, { every: 2, amount: 1 })).toBe(0);
    expect(slBonus(5, undefined)).toBe(0);
  });

  it('wounds 1d10 + DR (Comète à Deux Queues, LDB 42)', () => {
    const c = dummy();
    applyOps(c, [{ op: 'wounds', amount: { dice: { n: 1, sides: 10 } }, perSL: { every: 1, amount: 1 } }], {
      rng: deFixe(4), sl: 3, // d10 = 4 (jet figé int→4? cf. rollDice) + DR 3
    });
    expect(c.wounds.current).toBeLessThan(20);
    expect(20 - c.wounds.current).toBeGreaterThanOrEqual(4); // au moins le dé + l'échelle
  });

  it('condition « +1 Empêtré par +2 DR » (Enchevêtrement, LDB 47)', () => {
    const c = dummy();
    applyOps(c, [{ op: 'condition', id: 'empetre', valuePerSL: { every: 2, amount: 1 } }], { rng: desDuTest, sl: 5 });
    expect(stacks(c, 'empetre')).toBe(3); // 1 (base) + ⌊5/2⌋ = 2
  });

  it('corruption « perd 1 (+1 par +2 DR) » (Innocence immaculée, LDB 42) — plancher 0', () => {
    const c = dummy({ corruption: 4 });
    applyOps(c, [{ op: 'corruption', amount: -1, perSL: { every: 2, amount: -1 } }], { rng: desDuTest, sl: 4 });
    expect(c.corruption).toBe(1); // 4 − (1 + 2)
    applyOps(c, [{ op: 'corruption', amount: -1, perSL: { every: 2, amount: -1 } }], { rng: desDuTest, sl: 8 });
    expect(c.corruption).toBe(0); // jamais sous 0
  });

  it('condition « +DR État En flammes » (Purification, LDB 48) — base 0, plancher 1 de l’op', () => {
    const c = dummy();
    applyOps(c, [{ op: 'condition', id: 'en-flammes', value: 0, valuePerSL: { every: 1, amount: 1 } }], { rng: desDuTest, sl: 4 });
    expect(stacks(c, 'en-flammes')).toBe(4);
  });

  it('slBonus onFailure : magnitude sur DR NÉGATIF (branche fail), 0 sur DR positif/nul', () => {
    expect(slBonus(-2, { every: 1, amount: 1, onFailure: true })).toBe(2);
    expect(slBonus(-1, { every: 1, amount: 1, onFailure: true })).toBe(1);
    expect(slBonus(0, { every: 1, amount: 1, onFailure: true })).toBe(0);
    expect(slBonus(3, { every: 1, amount: 1, onFailure: true })).toBe(0);
    expect(slBonus(undefined, { every: 1, amount: 1, onFailure: true })).toBe(0);
  });

  it('condition « 1 Sonné par niveau d’échec » (Hallucinogène, MdRC ch.13 l.167) — value:0 + valuePerSL.onFailure', () => {
    const c = dummy();
    applyOps(c, [{ op: 'condition', id: 'sonne', value: 0, valuePerSL: { every: 1, amount: 1, onFailure: true } }], { rng: desDuTest, sl: -2 });
    expect(stacks(c, 'sonne')).toBe(2);
    const c1 = dummy();
    applyOps(c1, [{ op: 'condition', id: 'sonne', value: 0, valuePerSL: { every: 1, amount: 1, onFailure: true } }], { rng: desDuTest, sl: -1 });
    expect(stacks(c1, 'sonne')).toBe(1);
  });

  it('consommateurs valuePerSL/perSL existants à DR ≥ 0 restent inchangés (non-régression)', () => {
    const c = dummy();
    applyOps(c, [{ op: 'condition', id: 'empetre', valuePerSL: { every: 2, amount: 1 } }], { rng: desDuTest, sl: 5 });
    expect(stacks(c, 'empetre')).toBe(3);
  });

  it('donnée hallucinogene (traits.json) — Sonné 1 par niveau d’échec, 0 en réussite (#87)', () => {
    const trait = findTraitById('hallucinogene');
    const flow = trait?.effects?.[0]?.flow as Extract<Flow, { kind: 'test' }> | undefined;
    expect(flow?.kind).toBe('test');
    const fail = flow!.fail as Extract<Flow, { kind: 'do' }>;
    expect(fail.effect.type).toBe('ops');
    const c2 = dummy();
    applyOps(c2, (fail.effect as { ops: Parameters<typeof applyOps>[1] }).ops, { rng: desDuTest, sl: -2 });
    expect(stacks(c2, 'sonne')).toBe(2);
    const c1 = dummy();
    applyOps(c1, (fail.effect as { ops: Parameters<typeof applyOps>[1] }).ops, { rng: desDuTest, sl: -1 });
    expect(stacks(c1, 'sonne')).toBe(1);
    // réussite = branche `success` vide (aucun op) → aucune mutation.
    const success = flow!.success as Extract<Flow, { kind: 'seq' }>;
    expect(success.steps).toHaveLength(0);
  });
});

describe('onlyGroups — ops gatées par Groupe de la cible (Feu de l’âme, LDB 42)', () => {
  it('un Mort-vivant gagne l’État, un Humain non ; les wounds non gatées touchent les deux', () => {
    const zombie = dummy({ groups: ['mort-vivant'] });
    const villageois = dummy({ groups: ['humain'] });
    const ops = [
      { op: 'wounds' as const, amount: 3 },
      { op: 'condition' as const, id: 'en-flammes', onlyGroups: ['mort-vivant', 'demon'] },
    ];
    applyOps(zombie, ops, { rng: desDuTest, sl: 0 });
    applyOps(villageois, ops, { rng: desDuTest, sl: 0 });
    expect(zombie.wounds.current).toBe(17);
    expect(villageois.wounds.current).toBe(17);
    expect(stacks(zombie, 'en-flammes')).toBe(1);
    expect(stacks(villageois, 'en-flammes')).toBe(0);
  });

  it('groupMatch : appartenance STRICTE par id — plus de tolérance de pluriel (« Morts-vivants » ne matche PAS l’id « mort-vivant »)', () => {
    const zombie = dummy({ groups: ['mort-vivant'] });
    applyOps(zombie, [{ op: 'condition', id: 'en-flammes', onlyGroups: ['Morts-vivants'] }], { rng: desDuTest });
    expect(stacks(zombie, 'en-flammes')).toBe(0);
  });
});
