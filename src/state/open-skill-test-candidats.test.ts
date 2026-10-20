import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { runFlow } from '../noyau/combatEffects';
import { testFlow } from '../noyau/monde/flow';
import { EMPTY_FLOW } from '../engine/flowCore';
import type { Combatant } from '../engine/types';

/** Candidats d'un Test de scène (`openSkillTest`) : seul qui peut tenter le Test s'y porte (LDB 09 l.30,
 *  LDB 16 l.113). */

const CHARS = {
  'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30,
  agilite: 40, dexterite: 40, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
};

function hero(id: string, agilite: number, over: Partial<Combatant> = {}): Combatant {
  return {
    id, name: id, label: id, kind: 'hero',
    characteristics: { ...CHARS, agilite },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4,
    skills: [{ id: 'athletisme', characteristic: 'agilite', advances: 5 }], talents: [], items: [], psychState: [], engagedWith: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  } as unknown as Combatant;
}

describe('openSkillTest — candidats', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, pendingTest: null, pendingCascade: null, travelPlan: null, scene: null, flags: {} });
  });

  it('un Inconscient ne se porte pas candidat (LDB 16 l.113)', () => {
    const ko = hero('ko', 70, { conditions: [{ id: 'inconscient', value: 1 }] } as unknown as Partial<Combatant>);
    useGame.setState({ party: [ko, hero('a', 50), hero('b', 40)] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'athletisme' }, difficulty: 'intermediaire', requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = useGame.getState().pendingTest!;
    expect(pt.actorId).toBe('a');
    expect(pt.candidates?.map((c) => c.id), 'l’Inconscient n’est pas candidat').toEqual(['a', 'b']);
  });
});
