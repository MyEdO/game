import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { runFlow } from '../noyau/combatEffects';
import { testFlow } from '../noyau/monde/flow';
import { EMPTY_FLOW } from '../engine/flowCore';
import type { Combatant } from '../engine/types';

/**
 * INTÉGRATION scène → jet : les limites du Soutien (LDB 12 l.195/l.196/l.197) réellement gatées par
 * `openSkillTest` (#467, #1057) — Augmentation dans la Compétence (l.195), adjacence en combat
 * (géométrie `battle.combatants`, l.196), exclusion déclarative (`FlowTest.noSupport`, l.197).
 */
const skilled = (id: string, pos: { x: number; y: number } | undefined, agilite = 30, advances = 1): Combatant => ({
  id, name: id, kind: 'hero', pos,
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4,
  skills: [{ id: 'perception', characteristic: 'agilite', advances }], talents: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
} as unknown as Combatant);

const battleOf = (combatants: Combatant[]) => ({ combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, log: [], over: null } as never);

describe('Soutien à un Test — Augmentation + adjacence + exclusion (#467/#1057, LDB 12 l.195/l.196/l.197)', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingTest: null, party: [] }); });

  it('EN COMBAT, dispersé : seul le supporter ADJACENT (l.196) compte, le lointain est écarté', () => {
    const leader = skilled('h1', { x: 5, y: 5 }, 40, 5); // Ag 40 + 5 Augmentations → base 45, BAg 4
    const near = skilled('h2', { x: 6, y: 5 }); // adjacent (Chebyshev 1), 1 Augmentation
    const far = skilled('h3', { x: 20, y: 20 }); // hors de portée
    useGame.setState({ battle: battleOf([leader, near, far]), party: [leader, near, far] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'perception' }, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(useGame.getState().pendingTest!.skillValue).toBe(55); // 45 + 1×10 (near seul)
  });

  it('EN COMBAT, tous adjacents : les DEUX supporters comptent (plafond BAg 4 non atteint)', () => {
    const leader = skilled('h1', { x: 5, y: 5 }, 40, 5); // base 45
    const near1 = skilled('h2', { x: 6, y: 5 });
    const near2 = skilled('h3', { x: 4, y: 5 });
    useGame.setState({ battle: battleOf([leader, near1, near2]), party: [leader, near1, near2] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'perception' }, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(useGame.getState().pendingTest!.skillValue).toBe(65); // 45 + 2×10
  });

  it('EN COMBAT, adjacent mais SANS Augmentation (l.195) : aucun +10', () => {
    const leader = skilled('h1', { x: 5, y: 5 }, 40, 5); // base 45
    const near = skilled('h2', { x: 6, y: 5 }, 30, 0); // adjacent, 0 Augmentation
    useGame.setState({ battle: battleOf([leader, near]), party: [leader, near] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'perception' }, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(useGame.getState().pendingTest!.skillValue).toBe(45); // base seule
  });

  it('HORS COMBAT : supporter à 1 Augmentation → +10 ; à 0 Augmentation (l.195) → rien', () => {
    const leader = skilled('h1', undefined, 40, 5); // base 45
    const avance = skilled('h2', undefined, 30, 1);
    useGame.setState({ battle: null, party: [leader, avance] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'perception' }, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(useGame.getState().pendingTest!.skillValue).toBe(55); // 45 + 10

    const novice = skilled('h3', undefined, 30, 0);
    useGame.setState({ battle: null, pendingTest: null, party: [leader, novice] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'perception' }, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(useGame.getState().pendingTest!.skillValue).toBe(45);
  });

  it('`noSupport` (l.197, résistance maladie/poison/peur/danger) : AUCUN Soutien même adjacent/capable', () => {
    const leader = skilled('h1', { x: 5, y: 5 }, 40, 5); // base 45
    const near = skilled('h2', { x: 6, y: 5 });
    useGame.setState({ battle: battleOf([leader, near]), party: [leader, near] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'perception' }, requireSL: 0, noSupport: true }, EMPTY_FLOW, EMPTY_FLOW));
    expect(useGame.getState().pendingTest!.skillValue).toBe(45); // base seule, Soutien coupé à la source
  });
});
