import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { runFlow } from './combatFlow';
import { testFlow, EMPTY_FLOW } from './flow';
import type { Combatant } from '../engine/types';
import type { TravelPlan } from './travelFlow';
import { RULE_REF } from '../engine/ruleRefs';

/**
 * INTÉGRATION scène → jet : le malus de Précipitations (MDG 13 l.185-200, canal `precipitationTestMods`)
 * atteint RÉELLEMENT un Test joué par `openSkillTest` (#183).
 */
const meteo = (): unknown[] => (useGame.getState().pendingTest!.mods ?? []).filter((m) => m.ref === RULE_REF['meteo-maritime']);
describe('Météo maritime — Précipitations injectées au Test réel (#183, MDG 13 l.187-201)', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingTest: null, travelPlan: null }); });

  const sailor = (): Combatant => ({
    id: 'h1', name: 'Marin', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 40, dexterite: 40, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], movement: 4,
    skills: [
      { id: 'athletisme', characteristic: 'agilite', advances: 0 },
      { id: 'escalade', characteristic: 'agilite', advances: 0 },
      { id: 'projectiles', spec: 'arc', characteristic: 'dexterite', advances: 0 },
      { id: 'projectiles', spec: 'poudre-noire', characteristic: 'dexterite', advances: 0 },
    ],
    talents: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
  } as unknown as Combatant);

  const seaPlan = (precip: 'legeres' | 'abondantes' | 'tres-abondantes'): TravelPlan => ({
    routeId: 'r', fromPlaceId: 'a', toPlaceId: 'b', mode: 'mer', hoursPerDay: 8, km: 100, kmDone: 0,
    sea: {
      heading: 'ouest', windFrom: 'ouest', daysToEvent: 5, daysAtSea: 0, step: 'meteo', lines: [], milesToday: 0,
      weather: { precipitations: precip, temperature: 'mediane', visibilite: 'degage', vent: 'brise-fraiche' },
    },
  } as unknown as TravelPlan);

  it('Athlétisme, hors voyage en mer : pas de malus', () => {
    useGame.setState({ party: [sailor()] });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'athletisme' }, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(useGame.getState().pendingTest!.target).toBe(40); // Ag 40, aucun mod
    expect(meteo()).toEqual([]);
  });

  it('Athlétisme sous Précipitations Abondantes (−20) : le breakdown porte le malus', () => {
    useGame.setState({ party: [sailor()], travelPlan: seaPlan('abondantes') });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'athletisme' }, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = useGame.getState().pendingTest!;
    expect(pt.skillValue).toBe(40); // base INCHANGÉE (le mod reste une ligne à part, pas fondu)
    expect(pt.target).toBe(20); // 40 − 20
    expect(meteo()).toEqual([expect.objectContaining({ label: 'Météo : Abondantes', value: -20, famille: 'circonstance' })]);
  });

  it('Escalade sous Précipitations Légères (−10)', () => {
    useGame.setState({ party: [sailor()], travelPlan: seaPlan('legeres') });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'escalade' }, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(useGame.getState().pendingTest!.target).toBe(30); // Ag 40 − 10
  });

  it('Projectiles (Poudre noire) sous Précipitations Très abondantes (−30) : la spécialisation gate le mod', () => {
    useGame.setState({ party: [sailor()], travelPlan: seaPlan('tres-abondantes') });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'projectiles', spec: 'poudre-noire' }, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    expect(useGame.getState().pendingTest!.target).toBe(10); // Dex 40 − 30
  });

  it('Projectiles (Arc) sous la MÊME météo (Abondantes) : AUCUN malus (spécialisation non ciblée par la Précipitation)', () => {
    useGame.setState({ party: [sailor()], travelPlan: seaPlan('abondantes') });
    runFlow(useGame.getState, useGame.setState, testFlow({ skill: { id: 'projectiles', spec: 'arc' }, requireSL: 0 }, EMPTY_FLOW, EMPTY_FLOW));
    const pt = useGame.getState().pendingTest!;
    expect(pt.target).toBe(40); // Dex 40, inchangé (le −10 « tous les autres Tests » n'existe qu'en Très abondantes)
    expect(meteo()).toEqual([]);
  });
});
