import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { runFlow } from './combatFlow';
import { testFlow, EMPTY_FLOW } from './flow';
import { flowTestSchema } from '../data/schemas/grammaire/mecanique';
import type { Combatant } from '../engine/types';
import { hasTalent } from '../engine/magic';

const CHARS = {
  'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30,
  agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
};

const hero = (talents: Combatant['talents']): Combatant => ({
  id: 'h1', name: 'h1', label: 'h1', kind: 'hero',
  characteristics: { ...CHARS },
  wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4,
  skills: [{ id: 'charme', characteristic: 'sociabilite', advances: 5 }], talents, items: [], psychState: [], engagedWith: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
} as unknown as Combatant);

describe('`FlowTest.easierIf.hasTalent` : un id de Talent (#1924)', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, pendingTest: null, pendingCascade: null, travelPlan: null, scene: null, flags: {} });
  });

  it('le schéma résout l’id au catalogue et refuse un libellé', () => {
    const t = (hasTalent: string) => flowTestSchema.safeParse({ skill: { id: 'charme' }, easierIf: { hasTalent } }).success;
    expect(t('beni')).toBe(true);
    expect(t('Béni')).toBe(false);
  });

  it('un héros qui porte le Talent (par id) allège la Difficulté, et l’allègement se nomme', () => {
    const flow = testFlow({ skill: { id: 'charme' }, difficulty: 'difficile', easierIf: { hasTalent: 'beni', steps: 1 } }, EMPTY_FLOW, EMPTY_FLOW);
    useGame.setState({ party: [hero([{ talentId: 'beni', spec: 'sigmar', times: 1 }])] });
    runFlow(useGame.getState, useGame.setState, flow);
    const pt = useGame.getState().pendingTest!;
    expect(pt.difficulty).toBe('complexe');
    expect(pt.easedBy).toBe('Béni');
    expect(hasTalent(useGame.getState().party[0], 'Béni')).toBe(false);
  });

  it('sans le Talent, la Difficulté reste', () => {
    const flow = testFlow({ skill: { id: 'charme' }, difficulty: 'difficile', easierIf: { hasTalent: 'beni', steps: 1 } }, EMPTY_FLOW, EMPTY_FLOW);
    useGame.setState({ party: [hero([])] });
    runFlow(useGame.getState, useGame.setState, flow);
    expect(useGame.getState().pendingTest!.difficulty).toBe('difficile');
  });
});
