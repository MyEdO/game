import { describe, it, expect } from 'vitest';
import { combatConditionCtx, flowTestGated } from './flowEval';
import type { FlowTest } from '../../engine/flowCore';
import type { Combatant } from '../../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';

const mk = (over: Partial<Combatant> = {}): Combatant => (blessuresSurLeProfil({
  id: 'v', label: 'V', kind: 'enemy',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  wounds: blessuresDeBase(10), advantage: 0, conditions: [], skills: [], talents: [], traits: [], weapons: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  ...over,
}) as Combatant);

/** `flowTestGated` : un Test gaté est un no-op, ni étape ni branche, pour toutes ses voies. */
describe('flowTestGated — portes d’un nœud Flow `test`', () => {
  const gated = (ft: FlowTest, c: Combatant) => flowTestGated(ft, c, combatConditionCtx(c, {}));

  it('`onlyGroups` : le Test n’a lieu que pour un membre du Groupe (Épée de justice, « Criminel »)', () => {
    const ft: FlowTest = { skill: { id: 'resistance' }, difficulty: 'accessible', onlyGroups: ['Criminel'] };
    expect(gated(ft, mk())).toBe(true);
    expect(gated(ft, mk({ groups: ['Criminel'] }))).toBe(false);
  });

  it('`gate` d’Immunité : une cible Immunisée au poison ne teste pas (LDB 85 l.174)', () => {
    const ft: FlowTest = { skill: { id: 'resistance' }, difficulty: 'complexe', gate: { kind: 'not', of: { kind: 'has', who: 'target', what: 'immunity', value: 'poison' } } };
    expect(gated(ft, mk())).toBe(false);
    expect(gated(ft, mk({ traits: [{ id: 'immunite', arg: 'poison' }] }))).toBe(true);
  });
});
