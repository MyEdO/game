import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { runFlow } from './combatFlow';
import { testFlow, EMPTY_FLOW } from '../noyau/monde/flow';
import { traumaById } from '../engine/trauma';
import type { Combatant } from '../engine/types';

/**
 * INTÉGRATION scène → jet : un Test de Perception authoré sur un nœud de Flow (`FlowTest.sense`) fait
 * réellement FIRER la restriction de Surdité (LDB 18 : « Tests de Perception basés sur l'ouïe » seulement).
 * PREUVE de bout en bout que le sens du CONTEXTE de Test, transmis par `openSkillTest` → `testValue`,
 * exempte le sourd d'un Test VISUEL tout en le pénalisant sur un Test AUDITIF. (Un seul héros → pas de
 * Soutien LDB 12 qui viendrait masquer le −20.)
 */
describe('Surdité — restriction fire par le sens authoré du Test de scène (LDB 18)', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingTest: null }); });

  const deafHero = (): Combatant => ({
    id: 'h1', name: 'Sourd', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 40, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4,
    skills: [{ id: 'perception', characteristic: 'initiative', advances: 0 }], talents: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
    traumas: [traumaById('surdite', undefined, 'tete')],
  } as unknown as Combatant);

  it('Test de Perception AUDITIF (sense:ouie) → −20 appliqué', () => {
    useGame.setState({ party: [deafHero()] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'perception' }, sense: 'ouie', requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(useGame.getState().pendingTest!.skillValue).toBe(20); // I 40 − 20 (Surdité)
  });

  it('Test de Perception VISUEL (sense:vue) → PAS de pénalité (le sourd voit)', () => {
    useGame.setState({ party: [deafHero()] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'perception' }, sense: 'vue', requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(useGame.getState().pendingTest!.skillValue).toBe(40); // I 40, malus auditif inapplicable
  });

  it('Test de Perception GÉNÉRIQUE (sans sens authoré) → −20 par défaut (conservateur : indices sonores ratés)', () => {
    useGame.setState({ party: [deafHero()] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'perception' }, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(useGame.getState().pendingTest!.skillValue).toBe(20); // I 40 − 20 (défaut applique)
  });
});
