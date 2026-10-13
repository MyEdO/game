/**
 * Pratiquer une Compétence (EDOC 8 l.131 ; `activities.json › pratiquer-competence`) : le poste porte la
 * Compétence CHOISIE, de l'épinglage (`setTravelRole`) jusqu'à l'applier. Sans Compétence choisie, le poste
 * échoue sans jet avec son refus nommé (#2588) ; une Compétence que le héros ne peut pas tenter est fermée
 * (LDB 09 l.30).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { buildStageSteps } from './travelPostes';
import { cascadeAppliers } from './cascade';
import { resultLine } from './rollSeam';
import { competencesAPratiquer, stageAssignmentFromRoles } from '../engine/activities';
import { refusNePeutTenter } from '../engine/skills';
import { hasCondition } from '../engine/conditions';
import { ECHEC_SANS_JET } from '../engine/tests';
import { refLabel } from '../data';
import { t } from '../i18n';
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

  it('les candidats sont les Compétences du héros ; une Avancée sans Augmentation est fermée avec son refus', () => {
    const h = heros();
    expect(competencesAPratiquer(h)).toEqual([
      { ref: { id: 'escalade' } },
      { ref: { id: 'evaluation' }, refus: refusNePeutTenter(h, { skill: 'evaluation' }) },
    ]);
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

  it('sans Compétence choisie : jamais une réussite — échec sans jet, refus nommé, Exténué de la donnée', () => {
    const steps = etape({ activityId: 'pratiquer-competence' });
    expect(steps.some((s) => s.kind === 'stagePosteBatch')).toBe(false);
    const poste = steps.find((s) => s.kind === 'stagePoste')!;
    const hero = useGame.getState().party[0];
    const out = cascadeAppliers[poste.kind].apply(useGame.getState, useGame.setState, poste, hero, { steps: [poste], index: 0 });
    expect(resultLine((out && 'consequences' in out ? out.consequences : undefined) ?? [])).toContain(t('refus.competenceNonChoisie', { qui: 'Hilda' }));
    const [r] = useGame.getState().travelPlan!.stage!.results;
    expect(r.success).toBe(false);
    expect(r.stageOutcome).toBe('rerollToken');
    expect(hasCondition(useGame.getState().party[0], 'extenue')).toBe(true);
  });
});
