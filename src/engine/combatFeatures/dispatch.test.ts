import { describe, it, expect } from 'vitest';
import { offHandPenalty, attackModesFor, hasInstinctiveDiction, hasFocusHarmony } from './dispatch';
import { slugId } from '../../data/slug';
import type { Combatant } from '../types';

const mk = (talents: { name: string; times: number }[]): Combatant =>
  ({ id: 'c', name: 'X', kind: 'hero', talents: talents.map((t) => ({ talentId: slugId(t.name), times: t.times })), skills: [] } as unknown as Combatant);

describe('offHandPenalty (registre de capacités)', () => {
  it('sans Ambidextre : -20 (LDB 14 l.181)', () => {
    expect(offHandPenalty(mk([]))).toBe(-20);
  });
  it('Ambidextre 1x : -10 (LDB 10 l.50)', () => {
    expect(offHandPenalty(mk([{ name: 'Ambidextre', times: 1 }]))).toBe(-10);
  });
  it('Ambidextre 2x : 0', () => {
    expect(offHandPenalty(mk([{ name: 'Ambidextre', times: 2 }]))).toBe(0);
  });
  it('insensible a la casse du nom de talent', () => {
    expect(offHandPenalty(mk([{ name: 'ambidextre', times: 1 }]))).toBe(-10);
  });
});

describe('attackModesFor (registre de capacités)', () => {
  it('héros avec Maniement de deux armes → contient "dual-wield" (LDB 10 l.767-773)', () => {
    expect(attackModesFor(mk([{ name: 'Maniement de deux armes', times: 1 }]))).toContain('dual-wield');
  });
  it('sans le talent → vide', () => {
    expect(attackModesFor(mk([]))).toEqual([]);
  });
});

describe('hasInstinctiveDiction / hasFocusHarmony (#317 — prévention d\'Imparfaite par CombatFeature)', () => {
  it('Diction instinctive (LDB 10 l.344) → hasInstinctiveDiction', () => {
    expect(hasInstinctiveDiction(mk([{ name: 'Diction instinctive', times: 1 }]))).toBe(true);
    expect(hasInstinctiveDiction(mk([]))).toBe(false);
  });
  it('Harmonisation aethyrique (LDB 10 l.556) → hasFocusHarmony', () => {
    expect(hasFocusHarmony(mk([{ name: 'Harmonisation aethyrique', times: 1 }]))).toBe(true);
    expect(hasFocusHarmony(mk([]))).toBe(false);
  });
});
