/**
 * Un Test que son porteur ne peut pas tenter est un ÉCHEC, et l'applier en applique la conséquence d'échec
 * sans jet : il lit l'issue (`success`, `sl`), jamais le dé (LDB 09 l.30 ; #2588 Q1). Les étapes naissent
 * des monteurs de production (`rollStep`, `monoStep`, `bandStep`) ou de leur producteur réel.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { buildStageSteps } from './travelPostes';
import { buildSeaGenericStep, seaActivityRefus } from './seaActivities';
import { creditBourse } from './bourseFlow';
import { bourseOf } from '../engine/bourse';
import { toBrass } from '../engine/money';
import { applierDe, startCascade } from './cascade';
import { spyApplier } from './cascade.testkit';
import { ECHEC_SANS_JET } from '../engine/tests';
import { activityById, applyTravelActivityResult, travelActivitySpec } from '../engine/activities';
import { activiteMer, avecActivite } from '../engine/activiteMer.testkit';
import { refusNePeutTenter } from '../engine/skills';
import { datasetFile, datasetSerializeRoot, setDataset } from '../data/overrides';
import { validateDataset } from '../data/schemas/validate';
import { hasCondition } from '../engine/conditions';
import { MINUTES_PER_DAY } from '../engine/clock';
import { combatStakeRef, symptoms } from '../data';
import { t } from '../i18n';
import { bandStep, monoStep, resultLine, rollStep } from './rollSeam';
import type { PortProfile } from '../engine/seaVoyage';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from './pendings';
import type { PlayerText } from '../i18n/playerText';
import { avecLesTables, cleDeFixture } from './noyau.testkit';
import type { GenreDEtape } from './tablesPosees';
import { tablesDuJeu } from './tablesDuJeu';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const heros = (over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id: 'h', label: 'Hilda', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 40, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4, skills: [], ...structuredClone(over),
  }) as Combatant);
const INCONSCIENT = { conditions: [{ id: 'inconscient', value: 1 }] } as Partial<Combatant>;

const appliquer = (step: CascadeStep, hero?: Combatant) =>
  applierDe(step.kind)!(banc.getState, banc.setState, step, hero, { steps: [step], index: 0 });
const ligneDe = (out: ReturnType<typeof appliquer>): string => resultLine((out && 'consequences' in out ? out.consequences : undefined) ?? []);
const refusRagot = (h: Combatant) => refusNePeutTenter(h, { skill: 'ragot' });

/** Étape MONO de Ragot non tentable, montée par `monoStep` avec le refus de son porteur. */
const ragotSansJet = (kind: GenreDEtape, hero: Combatant, label: PlayerText, meta: Record<string, string | number>): CascadeStep =>
  monoStep({
    id: kind, kind, label, actor: hero, difficulty: 'intermediaire', stake: combatStakeRef(kind),
    ligne: { test: { skill: 'ragot', char: 'sociabilite' }, refus: refusRagot(hero) },
    meta,
  })!;

describe('Poste de voyage : la meilleure compétence TENTABLE, sinon un échec sans jet (EDOC 8 l.131-133)', () => {
  it('travelActivitySpec : sans Métier (Cartographe), Art (Dessin), compétence de base groupée, est retenue (LDB 09 l.64)', () => {
    const spec = travelActivitySpec(heros(), activityById('etablir-cartes')!)!;
    expect(spec.test).toEqual({ skill: { id: 'art', spec: 'dessin' } });
    expect(spec.refus).toBeUndefined();
  });

  it('travelActivitySpec : avec Métier (Cartographe), c’est lui qui est retenu', () => {
    const spec = travelActivitySpec(heros({ skills: [{ id: 'metier', spec: 'cartographe', advances: 10 }] as Combatant['skills'] }), activityById('etablir-cartes')!)!;
    expect(spec.test).toEqual({ skill: { id: 'metier', spec: 'cartographe' } });
    expect(spec.refus).toBeUndefined();
  });

  it('travelActivitySpec : un héros Inconscient (LDB 16 l.113) ne peut tenter aucune compétence du poste — refus nommé', () => {
    const h = heros(INCONSCIENT);
    const spec = travelActivitySpec(h, activityById('rester-aux-aguets')!)!;
    expect(spec.test).toEqual({ skill: { id: 'perception' } });
    expect(spec.refus).toBe(refusNePeutTenter(h, { skill: 'perception' }));
  });

  it('applyTravelActivityResult : ECHEC_SANS_JET → échec, aucun effet de réussite, Exténué', () => {
    const def = activityById('plein-air')!;
    const r = applyTravelActivityResult(travelActivitySpec(heros(), def)!, def, ECHEC_SANS_JET);
    expect(r.success).toBe(false);
    expect(r.sl).toBe(ECHEC_SANS_JET.sl);
    expect(r.ops).toEqual([]);
    expect(r.extenue).toBe(true);
    expect(r.roll).toBeUndefined();
  });

  describe('buildStageSteps puis la cascade : un posté Inconscient', () => {
    beforeEach(() => {
      banc.setState({
        party: [heros(INCONSCIENT)],
        journal: [],
        pendingCascade: null,
        travelPlan: { routeId: 'r', km: 24, postes: { h: { activityId: 'rester-aux-aguets' } }, stage: { results: [] } } as never,
      });
    });

    it('sa rangée naît sans jet, témoin, avec son refus nommé', () => {
      const batch = buildStageSteps(banc.getState, banc.setState, 'beau', 'ete').find((s) => s.kind === 'stagePosteBatch')!;
      const part = batch.participants!.find((p) => p.id === 'h')!;
      expect(part.result).toBe(ECHEC_SANS_JET);
      expect(part.refus).toBe(refusNePeutTenter(banc.getState().party[0], { skill: 'perception' }));
      expect(part.interactive).toBe(false);
    });

    it('validée, la rangée applique l’échec : Exténué (EDOC 8 l.133)', () => {
      const batch = buildStageSteps(banc.getState, banc.setState, 'beau', 'ete').find((s) => s.kind === 'stagePosteBatch')!;
      startCascade(banc.getState, banc.setState, { title: 'Étape', purpose: 'test', steps: [batch] });
      banc.getState().cascadeNext();
      const hilda = banc.getState().party.find((h) => h.id === 'h')!;
      expect(hasCondition(hilda, 'extenue')).toBe(true);
    });
  });
});

describe('Activités en mer non tentables', () => {
  beforeEach(() => banc.setState({ party: [heros()], journal: [] }));

  const semaine = () => banc.setState({
    pendingSeaActivities: { picks: {}, day: { kmFrom: 0, kmTo: 40, hours: 24, lines: [] } },
    pendingCascade: null, pendingExtendedTest: null, pendingRest: null,
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [], lastVoyageMilles: 0 },
    travelPlan: { routeId: 'r', km: 40, sea: { lines: [] } },
  } as never);

  it('seaActivityRefus : Métier (Cartographe), compétence avancée, ferme la Cartographie au seul héros qui ne l’a pas (MDG 15 l.290)', () => {
    const sans = heros();
    const avec = heros({ id: 'c', skills: [{ id: 'metier', spec: 'cartographe', advances: 10 }] as Combatant['skills'] });
    const carto = activityById('cartographie')!;
    expect(seaActivityRefus(sans, carto)).toBe(refusNePeutTenter(sans, { skill: 'metier', spec: 'cartographe' }));
    expect(seaActivityRefus(avec, carto)).toBeUndefined();
  });

  it('sea-activity-chart : buildSeaChartStep monte la ligne du héros sans Métier (Cartographe) sans jet, refus nommé ; appliquée, aucune Carte marine', () => {
    semaine();
    const hero = banc.getState().party[0];
    banc.getState().seaActivitiesConfirm({ h: { activityId: 'cartographie' } });
    const step = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'sea-activity-chart')!;
    expect(step.result).toBe(ECHEC_SANS_JET);
    expect(step.refus).toBe(refusNePeutTenter(hero, { skill: 'metier', spec: 'cartographe' }));
    const out = appliquer(step, hero);
    expect(ligneDe(out)).toBe(t('sact.chartKo', { name: 'Hilda' }));
    expect(hero.items).toEqual([]);
  });

  it('Commerce d’opportunité d’un héros Inconscient : ni mise ni Test étendu, son refus nommé au bilan (MDG 15 l.274-286)', () => {
    banc.setState({ party: [heros(INCONSCIENT)] });
    semaine();
    creditBourse(banc.getState, banc.setState, 'h', { gold: 100, silver: 0, brass: 0 });
    const hero = banc.getState().party[0];
    const avant = toBrass(bourseOf(hero));
    banc.getState().seaActivitiesConfirm({ h: { activityId: 'commerce-opportunite', investGold: 10 } });
    expect(banc.getState().pendingExtendedTest).toBeNull();
    expect(toBrass(bourseOf(banc.getState().party[0]))).toBe(avant);
    expect(banc.getState().travelPlan!.log!.slice(-1)[0]!.lines.map((l) => l.text)).toContain(refusNePeutTenter(hero, { skill: 'marchandage' }));
  });

  // Porte de `CodexEdit.save` : la racine sérialisée du dataset, validée contre le schéma de son fichier.
  const enregistrement = () => validateDataset(datasetFile('activities'), datasetSerializeRoot('activities'));

  it('Compendium : l’enregistrement refuse une Activité de contexte mer à Compétence libre — `SeaActivityPick` ne porte aucune Compétence choisie (MDG 15 l.266-300)', () => {
    const { skills: _skills, ...sansCompetence } = activiteMer();
    expect(avecActivite(activiteMer(), enregistrement)).toBeNull();
    expect(avecActivite({ ...sansCompetence, freeSkill: [{ id: 'orientation' }] }, enregistrement))
      .toMatch(/veille-en-mer : une Activité de contexte mer ne déclare pas de Compétence libre/);
  });

  it('Compendium : l’enregistrement refuse une Activité de contexte mer qui déclare « Échec inflige Exténué » (EDOC 8 l.133 ; MDG 15 l.266-300)', () => {
    expect(avecActivite(activiteMer(), enregistrement)).toBeNull();
    expect(avecActivite(activiteMer({ failExtenue: true }), enregistrement))
      .toMatch(/veille-en-mer : une Activité de contexte mer ne déclare pas « Échec inflige Exténué »/);
  });

  describe('sea-activity-generic : une Activité de contexte mer sans résolveur', () => {
    beforeEach(() => banc.setState({ party: [heros(INCONSCIENT)] }));

    it('héros Inconscient : la ligne naît sans jet, refus nommé ; appliquée, aucun Exténué, aucune conséquence', () => {
      const hero = banc.getState().party[0];
      const mer = activiteMer();
      avecActivite(mer, () => {
        const step = buildSeaGenericStep(banc.getState, banc.setState, hero, mer)!;
        expect(step.kind).toBe('sea-activity-generic');
        expect(step.result).toBe(ECHEC_SANS_JET);
        expect(step.refus).toBe(refusNePeutTenter(hero, { skill: mer.skills![0].id, spec: mer.skills![0].spec }));
        expect(appliquer(step, hero)).toEqual({ consequences: [] });
      });
      expect(hasCondition(hero, 'extenue')).toBe(false);
    });
  });
});

describe('Ragot non tentable : la journée de recherche est perdue (LDB 59 l.50)', () => {
  beforeEach(() => banc.setState({ party: [heros()], journal: [], pendingCascade: null }));

  it('merchant-ragot : la journée passe, le réassort se tire sans bonus de recherche', () => {
    banc.setState({ merchant: { entityId: 'm', archetype: '__aucun__' } as never });
    const hero = banc.getState().party[0];
    const step = ragotSansJet('merchant-ragot', hero, t('mf.rechercheActive'), { entityId: 'm' });
    expect(step.refus).toBe(refusRagot(hero));
    const avant = banc.getState().gameTime;
    const out = appliquer(step, hero);
    expect(banc.getState().gameTime).toBe(avant + MINUTES_PER_DAY);
    expect(ligneDe(out)).toContain(t('mf.searchSansJet'));
  });

  it('port-sell-gossip : aucun acheteur, aucune recherche d’acheteur enchaînée (MDG 15 l.366-372)', () => {
    const PORT = { taille: 4, richesse: 4, production: [] } as unknown as PortProfile;
    banc.setState({
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [{ cargoId: 'bois', enc: 40, basePriceGold: 10 }], lastVoyageMilles: 0 },
      port: { placeId: 'P', label: 'Port', port: PORT, offers: [] },
    } as never);
    const hero = banc.getState().party[0];
    const out = appliquer(ragotSansJet('port-sell-gossip', hero, t('port.buyerSearch'), { cargoIndex: 0 }), hero);
    expect(ligneDe(out)).toBe(t('port.gossipSansJet', { name: 'Hilda', issue: t('port.gossipFail', { relation: t('port.produces') }) }));
    expect(banc.getState().pendingCascade).toBeNull();
  });
});

describe('Psychologie non tentable : la source garde son emprise (LDB 21)', () => {
  const decl = { kind: 'peur' as const, sourceId: 'goule', sourceName: 'la Goule', indice: 1 };
  const bande = (cle: 'encounterPsych' | 'combatPsych'): CascadeStep => {
    const hero = banc.getState().party[0];
    const ligne = rollStep({ actor: hero, test: { skill: 'calme' }, difficulty: 'intermediaire', refus: refusNePeutTenter(hero, { skill: 'calme' }) });
    return bandStep({ id: cle, kind: cle, [cle]: decl }, [{ id: hero.id, interactive: true, result: null, ...ligne }])!;
  };

  beforeEach(() => banc.setState({ party: [heros(INCONSCIENT)], journal: [], battle: null }));

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
  /** Symptôme de fixture : sur un Test raté, Sonné à DR 0 exactement, À Terre à DR négatif — l'échec
   *  SANS JET est un échec de DR 0 (`ECHEC_SANS_JET`). */
  const SONDE = 'sonde-echec-sans-jet';
  const SYMPTOMES_LIVRES = [...symptoms];
  const porteur = (): Combatant => heros({
    diseases: [{ id: 'colique', phase: 'active', symptoms: [{ symptomId: SONDE }], minutesLeft: 1e5, durationMinutes: 1e5 }],
  } as Partial<Combatant>);
  beforeEach(() => {
    setDataset('symptoms', [...SYMPTOMES_LIVRES, {
      id: SONDE, type: 'symptoms', label: 'Sonde',
      effects: [
        { trigger: 'onOwnTestFailed', on: 'self', flow: { kind: 'if', cond: { kind: 'slThreshold', op: '==', value: 0 }, then: { kind: 'do', effect: { type: 'ops', ops: [{ op: 'condition', id: 'sonne' }] } } } },
        { trigger: 'onOwnTestFailed', on: 'self', flow: { kind: 'if', cond: { kind: 'slThreshold', op: '<', value: 0 }, then: { kind: 'do', effect: { type: 'ops', ops: [{ op: 'condition', id: 'a-terre' }] } } } },
      ],
    } as never]);
    banc.setState({ party: [porteur()], journal: [], pendingCascade: null });
    avecLesTables({ appliers: { ...tablesDuJeu().appliers, 'mono-sans-jet': spyApplier([], () => null), 'bande-sans-jet': spyApplier([], () => null) } });
  });
  afterEach(() => setDataset('symptoms', SYMPTOMES_LIVRES));

  it('étape MONO sans jet : le porteur subit l’effet de son Test raté, à DR 0', () => {
    const hero = banc.getState().party[0];
    const step = monoStep({
      id: 'mono-sans-jet', kind: cleDeFixture('mono-sans-jet'), label: t('mf.rechercheActive'), actor: hero, difficulty: 'intermediaire', stake: combatStakeRef('merchant-ragot'),
      ligne: { test: { skill: 'ragot' }, refus: refusRagot(hero) },
    })!;
    startCascade(banc.getState, banc.setState, { title: 'X', purpose: 'test', steps: [step] });
    banc.getState().cascadeNext();
    expect(hasCondition(banc.getState().party[0], 'sonne'), 'Test raté à DR 0 : Sonné posé par le symptôme').toBe(true);
    expect(hasCondition(banc.getState().party[0], 'a-terre'), 'aucun DR négatif').toBe(false);
  });

  it('rangée de BANDE sans jet : SON porteur subit l’effet de son Test raté, à DR 0', () => {
    const hero = banc.getState().party[0];
    const ligne = rollStep({ actor: hero, test: { skill: 'ragot' }, difficulty: 'intermediaire', refus: refusRagot(hero) });
    startCascade(banc.getState, banc.setState, { title: 'X', purpose: 'test', steps: [bandStep({ id: 'bande-sans-jet', kind: cleDeFixture('bande-sans-jet') }, [{ id: hero.id, interactive: true, result: null, ...ligne }])!] });
    banc.getState().cascadeNext();
    expect(hasCondition(banc.getState().party[0], 'sonne'), 'Test raté à DR 0 : Sonné posé par le symptôme').toBe(true);
    expect(hasCondition(banc.getState().party[0], 'a-terre'), 'aucun DR négatif').toBe(false);
  });
});
