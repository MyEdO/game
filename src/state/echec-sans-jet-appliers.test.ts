/**
 * Un Test que son porteur ne peut pas tenter est un ÉCHEC, et l'applier en applique la conséquence d'échec
 * sans jet : il lit l'issue (`success`, `sl`), jamais le dé (LDB 09 l.30 ; #2588 Q1).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { buildStageSteps } from './travelPostes';
import { cascadeAppliers } from './cascade';
import { ECHEC_SANS_JET, ligneSansJet } from '../engine/tests';
import { activityById, applyTravelActivityResult, travelActivitySpec } from '../engine/activities';
import { hasCondition } from '../engine/conditions';
import { MINUTES_PER_DAY } from '../engine/clock';
import { t } from '../i18n';
import { resultLine } from './rollSeam';
import type { PortProfile } from '../engine/seaVoyage';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from './pendings';

const heros = (skills: Combatant['skills'] = []): Combatant =>
  ({
    id: 'h', label: 'Hilda', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 40, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4, skills,
  } as Combatant);

const appliquer = (step: CascadeStep, hero?: Combatant) =>
  cascadeAppliers[step.kind].apply(useGame.getState, useGame.setState, step, hero, { steps: [step], index: 0 });
const ligneDe = (out: ReturnType<typeof appliquer>): string => resultLine((out && 'consequences' in out ? out.consequences : undefined) ?? []);
const REFUS = 'Hilda ne peut pas tenter le Test.';
/** Étape mono née sans jet, par la paire du monteur (`ligneSansJet`) : porte, aucun producteur ne la pose ici. */
const etapeSansJet = (kind: string, meta: Record<string, unknown>, extra: Partial<CascadeStep> = {}): CascadeStep =>
  ({ id: kind, kind, actorId: 'h', label: kind, meta, ...ligneSansJet(REFUS), ...extra }) as CascadeStep;

describe('Activité de voyage non tentable : conséquence d’échec, jamais « Activité sans Test » (EDOC 8 l.133)', () => {
  it('applyTravelActivityResult : ECHEC_SANS_JET → échec, aucun effet de réussite, Exténué', () => {
    const def = activityById('plein-air')!;
    const r = applyTravelActivityResult(travelActivitySpec(heros(), def), def, ECHEC_SANS_JET);
    expect(r.success).toBe(false);
    expect(r.sl).toBe(ECHEC_SANS_JET.sl);
    expect(r.ops).toEqual([]);
    expect(r.extenue).toBe(true);
    expect(r.roll).toBeUndefined();
  });

  describe('poste Cartographie tenu par un héros sans Métier (Cartographe) ni Art (Dessin)', () => {
    beforeEach(() => {
      useGame.setState({
        party: [heros()],
        journal: [],
        travelPlan: { routeId: 'r', km: 24, postes: { h: { activityId: 'etablir-cartes' } }, stage: { results: [] } } as never,
      });
    });

    // Porte : aucun producteur de poste ne déclare la ligne non tentable ; la paire est celle du monteur.
    it('rangée sans jet : le pas des postes lui applique l’échec — Exténué, issue d’échec au bilan', () => {
      const batch = buildStageSteps(useGame.getState, useGame.setState, 'beau', 'ete').find((s) => s.kind === 'stagePosteBatch')!;
      const part = batch.participants!.find((p) => p.id === 'h')!;
      Object.assign(part, ligneSansJet(REFUS));
      appliquer(batch);
      const hilda = useGame.getState().party.find((h) => h.id === 'h')!;
      expect(hasCondition(hilda, 'extenue')).toBe(true);
      const issue = useGame.getState().travelPlan!.stage!.results.find((r) => r.actorId === 'h')!;
      expect(issue.success).toBe(false);
    });
  });
});

describe('Ragot non tentable : la journée de recherche est perdue (LDB 59 l.50)', () => {
  it('merchant-ragot : la journée passe, le réassort se tire sans bonus de recherche', () => {
    useGame.setState({ party: [heros()], journal: [], merchant: { entityId: 'm', archetype: '__aucun__' } as never });
    const avant = useGame.getState().gameTime;
    const out = appliquer(etapeSansJet('merchant-ragot', { entityId: 'm' }));
    expect(useGame.getState().gameTime).toBe(avant + MINUTES_PER_DAY);
    expect(ligneDe(out)).toContain(t('mf.searchSansJet'));
  });

  it('port-sell-gossip : aucun acheteur, aucune recherche d’acheteur enchaînée (MDG 15 l.366-372)', () => {
    const PORT = { taille: 4, richesse: 4, production: [] } as unknown as PortProfile;
    useGame.setState({
      party: [heros()], journal: [], pendingCascade: null,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [{ cargoId: 'bois', enc: 40, basePriceGold: 10 }], lastVoyageMilles: 0 },
      port: { placeId: 'P', label: 'Port', port: PORT, freeEnc: 300, maxLoadEnc: 450, offers: [] },
    } as never);
    const out = appliquer(etapeSansJet('port-sell-gossip', { cargoIndex: 0 }));
    expect(ligneDe(out)).toBe(t('port.gossipSansJet', { name: 'Hilda', issue: t('port.gossipFail', { relation: t('port.produces') }) }));
    expect(useGame.getState().pendingCascade).toBeNull();
  });
});

describe('Psychologie non tentable : la source garde son emprise (LDB 21)', () => {
  const decl = { kind: 'peur' as const, sourceId: 'goule', sourceName: 'la Goule', indice: 1 };
  const bande = (cle: 'encounterPsych' | 'combatPsych'): CascadeStep =>
    ({ id: cle, kind: cle, label: cle, [cle]: decl, aggregate: 'none', participants: [{ id: 'h', ...ligneSansJet(REFUS) }] }) as unknown as CascadeStep;

  beforeEach(() => useGame.setState({ party: [heros()], journal: [], battle: null }));

  it('encounterPsych : la rangée sans jet porte l’échec de la Peur', () => {
    const step = bande('encounterPsych');
    appliquer(step);
    expect(step.participants![0].outcome?.map((l) => l.text)).toContain(t('out.fear', { name: 'Hilda', foe: 'la Goule' }));
  });

  it('combatPsych : la rangée sans jet reste sous l’emprise, aucun DR de Calme cumulé', () => {
    const step = bande('combatPsych');
    appliquer(step);
    expect(step.participants![0].outcome?.map((l) => l.text)).toContain("Hilda reste sous l'emprise de la Peur (0/1 DR).");
  });
});
