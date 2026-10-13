/**
 * Pratiquer une Compétence (EDOC 8 l.172 ; `activities.json › pratiquer-competence`) : le poste porte la
 * Compétence CHOISIE, de l'épinglage (`setTravelRole`) jusqu'à l'applier. Les Compétences offertes sont
 * celles que le héros peut tenter (LDB 09 l.30) ; sans Compétence choisie, il n'y a pas de Test, donc ni
 * échec ni Exténué (EDOC 8 l.133) : le poste n'est pas tenu.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { buildStageSteps } from './travelPostes';
import { activityById, competencesAPratiquer, refusCandidatActivite, stageAssignmentFromRoles } from '../engine/activities';
import { refusNePeutTenter } from '../engine/skills';
import { hasCondition } from '../engine/conditions';
import { ECHEC_SANS_JET } from '../engine/tests';
import { refLabel, skills } from '../data';
import type { Combatant } from '../engine/types';

const heros = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'h', label: 'Hilda', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 40, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4,
    skills: [{ id: 'escalade', advances: 10 }, { id: 'evaluation', advances: 0 }] as Combatant['skills'],
    ...over,
  } as Combatant);

/** Étape montée par le producteur réel : le poste épinglé (`setTravelRole`) → `stageAssignmentFromRoles`. */
function etape(posting: Parameters<ReturnType<typeof useGame.getState>['setTravelRole']>[1]) {
  useGame.setState({ party: [heros()], journal: [], pendingCascade: null });
  useGame.getState().setTravelRole('h', posting);
  useGame.setState({ travelPlan: { routeId: 'r', km: 24, postes: stageAssignmentFromRoles(useGame.getState().party), stage: { results: [] } } as never });
  return buildStageSteps(useGame.getState, useGame.setState, 'beau', 'ete');
}

describe('Pratiquer une Compétence : le poste porte sa Compétence choisie', () => {
  beforeEach(() => useGame.setState({ party: [heros()], journal: [] }));

  it('les candidats sont les Compétences de sa fiche, une Avancée sans Augmentation fermée avec son refus', () => {
    const h = heros();
    const offertes = competencesAPratiquer(h);
    expect(offertes.slice(0, 2)).toEqual([
      { ref: { id: 'escalade' } },
      { ref: { id: 'evaluation' }, refus: refusNePeutTenter(h, { skill: 'evaluation' }) },
    ]);
  });

  it('les Compétences de base hors fiche sont offertes, ouvertes (LDB 09 l.30) ; aucune Avancée hors fiche', () => {
    const offertes = competencesAPratiquer(heros());
    expect(offertes).toContainEqual({ ref: { id: 'orientation' } });
    const horsFiche = offertes.filter((o) => o.ref.id !== 'escalade' && o.ref.id !== 'evaluation');
    expect(horsFiche.every((o) => skills.find((sd) => sd.id === o.ref.id)?.acces === 'base' && !o.refus)).toBe(true);
    expect(offertes.some((o) => o.ref.id === 'metier')).toBe(false);
  });

  it('candidat : ouvert s’il peut tenter une Compétence ; Inconscient, fermé dès le premier niveau avec sa raison', () => {
    const def = activityById('pratiquer-competence')!;
    expect(refusCandidatActivite(heros(), def)).toBeUndefined();
    const ko = heros({ conditions: [{ id: 'inconscient', value: 1 }] } as Partial<Combatant>);
    expect(competencesAPratiquer(ko).every((o) => o.refus)).toBe(true);
    expect(refusCandidatActivite(ko, def)).toBe(refusNePeutTenter(ko, { action: def.label }));
  });

  it('Compétence choisie : la rangée de la bande la teste, elle', () => {
    const batch = etape({ activityId: 'pratiquer-competence', freeSkill: { id: 'escalade' } }).find((s) => s.kind === 'stagePosteBatch')!;
    const part = batch.participants!.find((p) => p.id === 'h')!;
    expect(part.label).toBe(refLabel('skills', { id: 'escalade' }));
    expect(part.result).toBeNull();
  });

  it('Compétence choisie que le héros ne peut pas tenter : la rangée naît sans jet, refus nommé', () => {
    const batch = etape({ activityId: 'pratiquer-competence', freeSkill: { id: 'evaluation' } }).find((s) => s.kind === 'stagePosteBatch')!;
    const part = batch.participants!.find((p) => p.id === 'h')!;
    expect(part.result).toBe(ECHEC_SANS_JET);
    expect(part.refus).toBe(refusNePeutTenter(useGame.getState().party[0], { skill: 'evaluation' }));
  });

  it('sans Compétence choisie (état hérité) : poste non tenu — aucune étape, aucune issue, aucun Exténué', () => {
    expect(etape({ activityId: 'pratiquer-competence' })).toEqual([]);
    expect(useGame.getState().travelPlan!.postes).toEqual({});
    expect(hasCondition(useGame.getState().party[0], 'extenue')).toBe(false);
  });

  it('sans Compétence choisie dans un plan déjà posé : l’Étape ne monte ni rangée ni pas de poste pour lui', () => {
    useGame.setState({ party: [heros()], journal: [], pendingCascade: null, travelPlan: { routeId: 'r', km: 24, postes: { h: { activityId: 'pratiquer-competence' } }, stage: { results: [] } } as never });
    const steps = buildStageSteps(useGame.getState, useGame.setState, 'beau', 'ete');
    expect(steps.map((s) => s.kind)).toEqual(['stageAggregate']);
    expect(useGame.getState().travelPlan!.stage!.results).toEqual([]);
    expect(hasCondition(useGame.getState().party[0], 'extenue')).toBe(false);
  });
});
