/**
 * Un Test que son porteur ne peut pas tenter est un ÉCHEC, et l'applier en applique la conséquence d'échec
 * sans jet : il lit l'issue (`success`, `sl`), jamais le dé (LDB 09 l.30 ; #2588 Q1). Les étapes naissent
 * des monteurs de production (`rollStep`, `monoStep`, `bandStep`) ou de leur producteur réel.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { buildStageSteps } from './travelPostes';
import { buildSeaGenericStep } from './seaActivities';
import { cascadeAppliers, startCascade, setOwnTestFailedEmitter } from './cascade';
import { spyApplier } from './cascadeTestKit';
import { fireOwnTestFailed } from './triggeredEffects';
import { battleRng } from './battleRng';
import { ECHEC_SANS_JET } from '../engine/tests';
import { activityById, applyTravelActivityResult, travelActivitySpec } from '../engine/activities';
import { refusNePeutTenter } from '../engine/skills';
import { hasCondition } from '../engine/conditions';
import { MINUTES_PER_DAY } from '../engine/clock';
import { combatStakeRef, activityStakeRef } from '../data';
import { t } from '../i18n';
import { bandStep, monoStep, resultLine, rollStep } from './rollSeam';
import type { PortProfile } from '../engine/seaVoyage';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from './pendings';
import type { PlayerText } from '../i18n/playerText';

const heros = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'h', label: 'Hilda', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 40, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4, skills: [], ...over,
  } as Combatant);
const INCONSCIENT = { conditions: [{ id: 'inconscient', value: 1 }] } as Partial<Combatant>;

const appliquer = (step: CascadeStep, hero?: Combatant) =>
  cascadeAppliers[step.kind].apply(useGame.getState, useGame.setState, step, hero, { steps: [step], index: 0 });
const ligneDe = (out: ReturnType<typeof appliquer>): string => resultLine((out && 'consequences' in out ? out.consequences : undefined) ?? []);
const refusRagot = (h: Combatant) => refusNePeutTenter(h, { skill: 'ragot' });

/** Étape MONO de Ragot non tentable, montée par `monoStep` avec le refus de son porteur. */
const ragotSansJet = (kind: string, hero: Combatant, label: PlayerText, meta: Record<string, string | number>): CascadeStep =>
  monoStep({
    id: kind, kind, label, actor: hero, difficulty: 'intermediaire', stake: combatStakeRef(kind),
    ligne: { test: { skill: 'ragot', char: 'sociabilite' }, refus: refusRagot(hero) },
    meta,
  })!;

describe('Poste de voyage : la meilleure compétence TENTABLE, sinon un échec sans jet (EDOC 8 l.131-133)', () => {
  it('travelActivitySpec : sans Métier (Cartographe), Art (Dessin), compétence de base groupée, est retenue (LDB 09 l.64)', () => {
    const spec = travelActivitySpec(heros(), activityById('etablir-cartes')!);
    expect(spec.used).toEqual({ id: 'art', spec: 'dessin' });
    expect(spec.refus).toBeUndefined();
  });

  it('travelActivitySpec : avec Métier (Cartographe), c’est lui qui est retenu', () => {
    const spec = travelActivitySpec(heros({ skills: [{ id: 'metier', spec: 'cartographe', advances: 10 }] as Combatant['skills'] }), activityById('etablir-cartes')!);
    expect(spec.used).toEqual({ id: 'metier', spec: 'cartographe' });
    expect(spec.refus).toBeUndefined();
  });

  it('travelActivitySpec : un héros Inconscient (LDB 16 l.113) ne peut tenter aucune compétence du poste — refus nommé', () => {
    const h = heros(INCONSCIENT);
    const spec = travelActivitySpec(h, activityById('rester-aux-aguets')!);
    expect(spec.used).toEqual({ id: 'perception' });
    expect(spec.refus).toBe(refusNePeutTenter(h, { skill: 'perception' }));
  });

  it('applyTravelActivityResult : ECHEC_SANS_JET → échec, aucun effet de réussite, Exténué', () => {
    const def = activityById('plein-air')!;
    const r = applyTravelActivityResult(travelActivitySpec(heros(), def), def, ECHEC_SANS_JET);
    expect(r.success).toBe(false);
    expect(r.sl).toBe(ECHEC_SANS_JET.sl);
    expect(r.ops).toEqual([]);
    expect(r.extenue).toBe(true);
    expect(r.roll).toBeUndefined();
  });

  describe('buildStageSteps puis la cascade : un posté Inconscient', () => {
    beforeEach(() => {
      useGame.setState({
        party: [heros(INCONSCIENT)],
        journal: [],
        pendingCascade: null,
        travelPlan: { routeId: 'r', km: 24, postes: { h: { activityId: 'rester-aux-aguets' } }, stage: { results: [] } } as never,
      });
    });

    it('sa rangée naît sans jet, témoin, avec son refus nommé', () => {
      const batch = buildStageSteps(useGame.getState, useGame.setState, 'beau', 'ete').find((s) => s.kind === 'stagePosteBatch')!;
      const part = batch.participants!.find((p) => p.id === 'h')!;
      expect(part.result).toBe(ECHEC_SANS_JET);
      expect(part.refus).toBe(refusNePeutTenter(useGame.getState().party[0], { skill: 'perception' }));
      expect(part.interactive).toBe(false);
    });

    it('validée, la rangée applique l’échec : Exténué (EDOC 8 l.133)', () => {
      const batch = buildStageSteps(useGame.getState, useGame.setState, 'beau', 'ete').find((s) => s.kind === 'stagePosteBatch')!;
      startCascade(useGame.getState, useGame.setState, { title: 'Étape', purpose: 'test', steps: [batch] });
      useGame.getState().cascadeNext();
      const hilda = useGame.getState().party.find((h) => h.id === 'h')!;
      expect(hasCondition(hilda, 'extenue')).toBe(true);
    });
  });
});

describe('Activités en mer non tentables', () => {
  beforeEach(() => useGame.setState({ party: [heros()], journal: [] }));

  it('sea-activity-chart : la ligne sans jet donne des relevés inutilisables, aucune Carte marine', () => {
    const hero = useGame.getState().party[0];
    const step = monoStep({
      id: 'sea-activity-chart-h', kind: 'sea-activity-chart', actor: hero, label: t('step.stagePostes'), difficulty: 'complexe',
      stake: activityStakeRef('cartographie'),
      ligne: { test: { skill: 'metier', spec: 'cartographe' }, refus: refusNePeutTenter(hero, { skill: 'metier', spec: 'cartographe' }) },
      meta: { stashGold: 0 },
    })!;
    expect(step.result).toBe(ECHEC_SANS_JET);
    const out = appliquer(step, hero);
    expect(ligneDe(out)).toBe(t('sact.chartKo', { name: 'Hilda' }));
    expect(hero.items).toEqual([]);
  });

  it('sea-activity-generic : buildSeaGenericStep monte la ligne d’un héros Inconscient sans jet, refus nommé', () => {
    useGame.setState({ party: [heros(INCONSCIENT)] });
    const hero = useGame.getState().party[0];
    const step = buildSeaGenericStep(useGame.getState, useGame.setState, hero, activityById('rester-aux-aguets')!)!;
    expect(step.result).toBe(ECHEC_SANS_JET);
    expect(step.refus).toBe(refusNePeutTenter(hero, { skill: 'perception' }));
    expect(appliquer(step, hero)).toEqual({ consequences: [] });
  });
});

describe('Ragot non tentable : la journée de recherche est perdue (LDB 59 l.50)', () => {
  beforeEach(() => useGame.setState({ party: [heros()], journal: [], pendingCascade: null }));

  it('merchant-ragot : la journée passe, le réassort se tire sans bonus de recherche', () => {
    useGame.setState({ merchant: { entityId: 'm', archetype: '__aucun__' } as never });
    const hero = useGame.getState().party[0];
    const step = ragotSansJet('merchant-ragot', hero, t('mf.rechercheActive'), { entityId: 'm' });
    expect(step.refus).toBe(refusRagot(hero));
    const avant = useGame.getState().gameTime;
    const out = appliquer(step, hero);
    expect(useGame.getState().gameTime).toBe(avant + MINUTES_PER_DAY);
    expect(ligneDe(out)).toContain(t('mf.searchSansJet'));
  });

  it('port-sell-gossip : aucun acheteur, aucune recherche d’acheteur enchaînée (MDG 15 l.366-372)', () => {
    const PORT = { taille: 4, richesse: 4, production: [] } as unknown as PortProfile;
    useGame.setState({
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [{ cargoId: 'bois', enc: 40, basePriceGold: 10 }], lastVoyageMilles: 0 },
      port: { placeId: 'P', label: 'Port', port: PORT, freeEnc: 300, maxLoadEnc: 450, offers: [] },
    } as never);
    const hero = useGame.getState().party[0];
    const out = appliquer(ragotSansJet('port-sell-gossip', hero, t('port.buyerSearch'), { cargoIndex: 0 }), hero);
    expect(ligneDe(out)).toBe(t('port.gossipSansJet', { name: 'Hilda', issue: t('port.gossipFail', { relation: t('port.produces') }) }));
    expect(useGame.getState().pendingCascade).toBeNull();
  });
});

describe('Psychologie non tentable : la source garde son emprise (LDB 21)', () => {
  const decl = { kind: 'peur' as const, sourceId: 'goule', sourceName: 'la Goule', indice: 1 };
  const bande = (cle: 'encounterPsych' | 'combatPsych'): CascadeStep => {
    const hero = useGame.getState().party[0];
    const ligne = rollStep({ actor: hero, test: { skill: 'calme' }, difficulty: 'intermediaire', refus: refusNePeutTenter(hero, { skill: 'calme' }) });
    return bandStep({ id: cle, kind: cle, [cle]: decl }, [{ id: hero.id, interactive: true, result: null, ...ligne }])!;
  };

  beforeEach(() => useGame.setState({ party: [heros(INCONSCIENT)], journal: [], battle: null }));

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

describe('SEAM `onOwnTestFailed` : un échec sans jet est un Test raté de son porteur (LDB 09 l.30 ; MSRC 16 l.152)', () => {
  const emis: { id: string; sl: number }[] = [];
  beforeEach(() => {
    emis.length = 0;
    useGame.setState({ party: [heros()], journal: [], pendingCascade: null });
    setOwnTestFailedEmitter((_g, actor, sl) => { emis.push({ id: actor.id, sl }); return []; });
  });
  afterEach(() => setOwnTestFailedEmitter((g, actor, sl) => fireOwnTestFailed(g, actor, { sl, rng: battleRng() })));

  it('étape MONO sans jet : l’événement part pour son porteur, DR 0', () => {
    const hero = useGame.getState().party[0];
    spyApplier('mono-sans-jet', [], () => null);
    const step = monoStep({
      id: 'mono-sans-jet', kind: 'mono-sans-jet', label: t('mf.rechercheActive'), actor: hero, difficulty: 'intermediaire', stake: combatStakeRef('merchant-ragot'),
      ligne: { test: { skill: 'ragot' }, refus: refusRagot(hero) },
    })!;
    startCascade(useGame.getState, useGame.setState, { title: 'X', purpose: 'test', steps: [step] });
    useGame.getState().cascadeNext();
    expect(emis).toEqual([{ id: 'h', sl: 0 }]);
  });

  it('rangée de BANDE sans jet : l’événement part pour SON porteur, DR 0', () => {
    const hero = useGame.getState().party[0];
    spyApplier('bande-sans-jet', [], () => null);
    const ligne = rollStep({ actor: hero, test: { skill: 'ragot' }, difficulty: 'intermediaire', refus: refusRagot(hero) });
    startCascade(useGame.getState, useGame.setState, { title: 'X', purpose: 'test', steps: [bandStep({ id: 'bande-sans-jet', kind: 'bande-sans-jet' }, [{ id: hero.id, interactive: true, result: null, ...ligne }])!] });
    useGame.getState().cascadeNext();
    expect(emis).toEqual([{ id: 'h', sl: 0 }]);
  });
});
