/**
 * Vocabulaire GameOp ajouté pour authorer les MANŒUVRES en donnée (L1) :
 *  - Formula `{indiceOf}` : injecte l'Indice de l'attaque naturelle (`ctx.indice`) dans un `wounds` op
 *    → Dégâts « Indice » codables en GameOp (mitigés par les drapeaux ignoreTB/ignoreAP).
 *  - Condition `{slThreshold, atLeast}` : « si la marge ≥ N DR » (`ctx.sl`) → issues échelonnées d'une
 *    manœuvre (Regard pétrifiant : ≥6 → Pétrifié) authorées en Flow `if`.
 */
import { describe, it, expect } from 'vitest';
import { resolveFormula, applyOps } from '../engine/ops';
import { evalCondition, type Flow } from './flow';
import { runPureFlowLines } from './combat/flowEval';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';

const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'c', label: 'C', kind: 'enemy',
  characteristics: { 'capacite-de-combat': 35, 'capacite-de-tir': 25, force: 35, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 25, 'force-mentale': 25, sociabilite: 25 },
  wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
  ...over,
} as Combatant);

describe('Formula {indiceOf} — Dégâts « Indice » en GameOp', () => {
  it('resolveFormula lit ctx.indice', () => {
    expect(resolveFormula({ indiceOf: true }, mk(), makeRNG(1), undefined, 12)).toBe(12);
    expect(resolveFormula({ indiceOf: true }, mk(), makeRNG(1))).toBe(0); // hors contexte
  });
  it('wounds {indiceOf} applique l’Indice, mitigé par les drapeaux', () => {
    const t = mk();
    applyOps(t, [{ op: 'wounds', amount: { indiceOf: true }, ignoreTB: true, ignoreAP: true }], { indice: 10 });
    expect(t.wounds.current).toBe(10); // 10 Dégâts ignorant BE+PA
  });
  it('wounds {indiceOf} déduit BE si ignoreTB:false', () => {
    const t = mk(); // BE = 3
    applyOps(t, [{ op: 'wounds', amount: { indiceOf: true }, ignoreTB: false, ignoreAP: false }], { indice: 10 });
    expect(t.wounds.current).toBe(13); // 10 − BE 3 − PA 0
  });
});

describe('Condition {slThreshold} — issue échelonnée sur la marge', () => {
  it('vrai si ctx.sl ≥ atLeast', () => {
    expect(evalCondition({ kind: 'slThreshold', op: '>=', value: 6 }, { flags: {}, gameTime: 0, sl: 6 })).toBe(true);
    expect(evalCondition({ kind: 'slThreshold', op: '>=', value: 6 }, { flags: {}, gameTime: 0, sl: 5 })).toBe(false);
    expect(evalCondition({ kind: 'slThreshold', op: '>=', value: 6 }, { flags: {}, gameTime: 0 })).toBe(false); // sl absent = 0
  });
  it('Flow if(slThreshold) branche sur la marge (Regard : ≥6 → Pétrifié)', () => {
    const flow: Flow = {
      kind: 'if', cond: { kind: 'slThreshold', op: '>=', value: 6 },
      then: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'Pétrifié' }] } },
      else: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'sonne' }] } },
    };
    const hi = mk({ id: 'h' });
    runPureFlowLines(hi, mk({ id: 'a' }), flow, { sl: 6 });
    expect(hi.conditions.find((c) => c.id === 'Pétrifié')).toBeTruthy();
    const lo = mk({ id: 'l' });
    runPureFlowLines(lo, mk({ id: 'a' }), flow, { sl: 3 });
    expect(lo.conditions.find((c) => c.id === 'sonne')).toBeTruthy();
    expect(lo.conditions.find((c) => c.id === 'Pétrifié')).toBeUndefined();
  });
});
