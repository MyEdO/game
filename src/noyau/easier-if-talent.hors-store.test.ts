import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { runFlow } from './combatEffects';
import { testFlow } from './monde/flow';
import { EMPTY_FLOW } from '../engine/flowCore';
import { flowTestSchema } from '../data/schemas/grammaire/mecanique';
import type { Combatant } from '../engine/types';
import { hasTalent } from '../engine/magic';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const CHARS = {
  'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30,
  agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
};

const hero = (talents: Combatant['talents']): Combatant => (blessuresSurLeProfil({
  id: 'h1', name: 'h1', label: 'h1', kind: 'hero',
  characteristics: { ...CHARS },
  wounds: blessuresDeBase(10), advantage: 0, conditions: [], movement: 4,
  skills: [{ id: 'charme', characteristic: 'sociabilite', advances: 5 }], talents, items: [], psychState: [], engagedWith: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
}) as unknown as Combatant);

describe('`FlowTest.easierIf.hasTalent` : un id de Talent (#1924)', () => {
  beforeEach(() => {
    banc.setState({ battle: null, pendingTest: null, pendingCascade: null, travelPlan: null, scene: null, flags: {} });
  });

  it('le schéma résout l’id au catalogue et refuse un libellé', () => {
    const t = (hasTalent: string) => flowTestSchema.safeParse({ skill: { id: 'charme' }, easierIf: { hasTalent } }).success;
    expect(t('beni')).toBe(true);
    expect(t('Béni')).toBe(false);
  });

  it('un héros qui porte le Talent (par id) allège la Difficulté, et l’allègement se nomme', () => {
    const flow = testFlow({ skill: { id: 'charme' }, difficulty: 'difficile', easierIf: { hasTalent: 'beni', steps: 1 } }, EMPTY_FLOW, EMPTY_FLOW);
    banc.setState({ party: [hero([{ talentId: 'beni', spec: 'sigmar', times: 1 }])] });
    runFlow(banc.getState, banc.setState, flow);
    const pt = banc.getState().pendingTest!;
    expect(pt.difficulty).toBe('complexe');
    expect(pt.easedBy).toBe('Béni');
    expect(hasTalent(banc.getState().party[0], 'Béni')).toBe(false);
  });

  it('sans le Talent, la Difficulté reste', () => {
    const flow = testFlow({ skill: { id: 'charme' }, difficulty: 'difficile', easierIf: { hasTalent: 'beni', steps: 1 } }, EMPTY_FLOW, EMPTY_FLOW);
    banc.setState({ party: [hero([])] });
    runFlow(banc.getState, banc.setState, flow);
    expect(banc.getState().pendingTest!.difficulty).toBe('difficile');
  });
});
