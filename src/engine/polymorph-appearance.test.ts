import { describe, it, expect } from 'vitest';
import { applyOps, type OpsCtx } from './ops';
import { liveMorphRef } from './polymorph';
import type { Combatant } from './types';

function combatant(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', label: 'T', kind: 'hero', species: 'humain',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, items: [], activeEffects: [], traits: [],
    ...over,
  } as Combatant;
}

/** #17 — l'op `polymorph` pose l'id de la forme (morphRef) le temps de l'effet. */
describe('#17 polymorph → apparence', () => {
  it('pose un morphRef temporisé sur la durée du sort', () => {
    const c = combatant();
    applyOps(c, [{ op: 'polymorph', ref: 'loup-blanc' }], { caster: c, defaultDurationRounds: 6 } as OpsCtx);
    expect(liveMorphRef(c)).toBe('loup-blanc');
    expect(c.activeEffects!.some((e) => e.morphRef === 'loup-blanc' && e.duration.scale === 'rounds')).toBe(true);
  });

  it('forme de base : liveMorphRef = undefined', () => {
    expect(liveMorphRef(combatant())).toBeUndefined();
  });
});
