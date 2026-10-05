import { resolveStake } from '../data';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { contractDisease, contagiousDiseases } from '../engine/disease';
import { emptyScene } from './scene';
import { MINUTES_PER_DAY } from '../engine/clock';
import type { Combatant } from '../engine/types';
import type { CascadeStep, CascadeRoll } from './pendings';
import { objetDeTest } from '../engine/objetDeTest.testkit';

/**
 * #253 — les jets du BILAN quotidien (Faim, Exposition, Contagion) passent par la surface
 * INFLUENÇABLE (cascade de nuit), au même titre que leurs frères diseaseTick/weatherResistance :
 * chaque jet est une ÉTAPE lancée puis influençable à la Chance (LDB 17 l.21-25) AVANT de se
 * verrouiller. Ce test prouve, pour la nuit UNIQUE (chemin du bouton Repos, `restSleep` days=1) :
 *  1. le jet apparaît en étape de cascade (jamais pré-résolu dans le journal) ;
 *  2. la Chance est proposable sur la RANGÉE ratée (`cascadeBatchReroll` dépense 1 Point de Chance) ;
 *  3. la conséquence n'est appliquée qu'UNE fois (à la validation, pas aussi en eager).
 */
const hero = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'h1', label: 'Hilda', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4, fortune: 2, ...p,
  } as Combatant);

const ration = (uid: string) => objetDeTest({ uid, trappingId: 'ration' });

/** Fige un ÉCHEC sur la RANGÉE `rowId` de la bande `bandId` (dé 100, DR négatif) — pour exercer
 *  l'influence sur un jet raté. Depuis #1117 L3 le jet d'un Test de nuit vit sur SA rangée. */
function forceFail(bandId: string, rowId: string): void {
  const p = useGame.getState().pendingCascade!;
  const parts = p.participants.map((s): CascadeStep => (s.id === bandId
    ? { ...s, participants: s.participants!.map((r) => (r.id === rowId
      ? { ...r, result: { roll: 100, target: r.target, sl: -5, success: false } as CascadeRoll } : r)) } : s));
  useGame.setState({ pendingCascade: { ...p, participants: parts } });
}

const stepOfKind = (kind: string): CascadeStep | undefined =>
  useGame.getState().pendingCascade?.participants.find((s) => s.kind === kind);

beforeEach(() => {
  seedBattleRng(1);
  useGame.setState({ battle: null, mode: 'exploration', journal: [], pendingCascade: null, pendingRest: null, scene: emptyScene(10, 10) });
});

describe('#253 — FAIM du bilan : étape de cascade influençable, pas un jet tissé', () => {
  it('affamé sans ration → jet de Faim DIFFÉRÉ (non pré-résolu), Chance proposable, résolu 1×', () => {
    // A affamé (1 jour sans manger) et sans ration → le Test de Faim tombe cette nuit (l.417 : tous les 2 jours).
    const a = hero({ id: 'A', label: 'Affamée', hunger: { days: 1, tests: 0, failures: 0 }, fortune: 2 });
    const b = hero({ id: 'B', label: 'Repue', items: [ration('r1')] }); // B mange sa ration → aucun jet
    useGame.setState({ party: [a, b] });
    useGame.getState().openRest({ places: { camp: true } });
    useGame.getState().restSet('A', { food: 'rien' });
    useGame.getState().restSet('B', { food: 'ration' });
    useGame.getState().restSleep();

    // 1. Le jet est une ÉTAPE, PAS pré-résolu : hunger.tests/failures encore vierges tant que non validé.
    const faim = stepOfKind('faim');
    expect(faim).toBeTruthy();
    expect(faim!.participants!.map((r) => r.id)).toEqual(['A']); // UNE fenêtre Faim, une rangée par affamé
    expect(resolveStake(faim!.stake!).text).toContain('Test de Résistance'); // enjeu verbatim surfacé (NIGHT_STAKES)
    const aNow = useGame.getState().party.find((h) => h.id === 'A')!;
    expect(aNow.hunger!.tests).toBe(0); // DIFFÉRÉ, pas roulé en eager
    expect(aNow.hunger!.failures).toBe(0);

    // 2. Chance proposable sur l'échec : la relance dépense 1 Point de Chance.
    forceFail(faim!.id, 'A');
    const fortuneBefore = useGame.getState().party.find((h) => h.id === 'A')!.fortune;
    useGame.getState().cascadeBatchReroll('A');
    expect(useGame.getState().party.find((h) => h.id === 'A')!.fortune).toBe((fortuneBefore ?? 0) - 1);

    // 3. Conséquence appliquée 1× à la validation (applyFaimTest) — un seul Test compté, pas de double.
    forceFail(faim!.id, 'A'); // re-fige l'échec (la relance a pu réussir) pour vérifier la conséquence
    useGame.getState().cascadeNext();
    const aEnd = useGame.getState().party.find((h) => h.id === 'A')!;
    expect(aEnd.hunger!.tests).toBe(1); // exactement UN Test résolu
    expect(aEnd.hunger!.failures).toBe(1); // 1er échec → −10 F/E (l.422), pas de double-décompte
  });
});

describe('#253 — CONTAGION de promiscuité : étape de cascade influençable', () => {
  it('un compagnon contagieux → jet de Contraction DIFFÉRÉ pour le sain, Chance proposable, contracté 1×', () => {
    const sick = contractDisease('verole-urticante', { int: () => 1 }, { incubation: 0, duration: 5 })!;
    const a = hero({ id: 'A', label: 'Malade', diseases: [sick] });
    expect(contagiousDiseases(a).length).toBe(1); // garde : la maladie est bien active + contagieuse (l.206)
    const b = hero({ id: 'B', label: 'Sain', fortune: 2 });
    useGame.setState({ party: [a, b] });
    useGame.getState().openRest({ places: { camp: true } });
    useGame.getState().restSet('A', { food: 'rien' });
    useGame.getState().restSet('B', { food: 'rien' });
    useGame.getState().restSleep();

    const cont = stepOfKind('contagion');
    expect(cont).toBeTruthy();
    expect(cont!.participants!.map((r) => r.id)).toEqual(['B']); // c'est le SAIN qui résiste à la Contraction
    expect(cont!.meta?.diseaseName).toBe('verole-urticante');

    // Chance proposable sur l'échec.
    forceFail(cont!.id, 'B');
    const fortuneBefore = useGame.getState().party.find((h) => h.id === 'B')!.fortune;
    useGame.getState().cascadeBatchReroll('B');
    expect(useGame.getState().party.find((h) => h.id === 'B')!.fortune).toBe((fortuneBefore ?? 0) - 1);

    // Contraction appliquée 1× (pas de double entrée de maladie) sur un échec verrouillé.
    forceFail(cont!.id, 'B');
    useGame.getState().cascadeNext();
    const bEnd = useGame.getState().party.find((h) => h.id === 'B')!;
    expect(bEnd.diseases!.filter((d) => d.id === 'verole-urticante').length).toBe(1);
  });
});

describe("#253 — AVANCE D'HORLOGE (advanceTime) : bilan en cascade influençable, plus de témoin pré-résolu", () => {
  it('advanceTime 24h, héros affamé sans ration → étape de Faim DIFFÉRÉE (purpose upkeep), Chance proposable, résolue 1×', () => {
    const a = hero({ id: 'A', label: 'Affamée', hunger: { days: 1, tests: 0, failures: 0 }, fortune: 2 });
    useGame.setState({ party: [a], gameTime: 0, lastUpkeepDay: 0, lastNightDay: 0, pendingCascade: null });
    useGame.getState().advanceTime(MINUTES_PER_DAY);

    // 1. Le franchissement de jour OUVRE une cascade d'entretien (jamais un reveal-témoin pré-résolu).
    const p = useGame.getState().pendingCascade;
    expect(p).toBeTruthy();
    expect(p!.purpose).toBe('upkeep');
    expect(p!.participants.some((s) => s.kind === 'round')).toBe(false); // pas de témoin groupé quand un jet est différé
    const faim = stepOfKind('faim');
    expect(faim).toBeTruthy();
    expect(faim!.participants!.map((r) => r.id)).toEqual(['A']);
    const aNow = useGame.getState().party.find((h) => h.id === 'A')!;
    expect(aNow.hunger!.days).toBe(2); // jour ENREGISTRÉ (l.201) mais Test NON roulé (différé)
    expect(aNow.hunger!.tests).toBe(0);
    expect(aNow.hunger!.failures).toBe(0);

    // 2. Chance proposable sur l'échec.
    forceFail(faim!.id, 'A');
    const fortuneBefore = useGame.getState().party.find((h) => h.id === 'A')!.fortune;
    useGame.getState().cascadeBatchReroll('A');
    expect(useGame.getState().party.find((h) => h.id === 'A')!.fortune).toBe((fortuneBefore ?? 0) - 1);

    // 3. Conséquence appliquée 1× à la validation — un seul Test compté, pas de double-résolution.
    forceFail(faim!.id, 'A');
    useGame.getState().cascadeNext();
    const aEnd = useGame.getState().party.find((h) => h.id === 'A')!;
    expect(useGame.getState().pendingCascade).toBeNull(); // cascade close (purpose upkeep : aucune suite)
    expect(aEnd.hunger!.tests).toBe(1);
    expect(aEnd.hunger!.failures).toBe(1);
  });

  it('advanceTime 24h, héros IVRE → étape de Dessoûlage DIFFÉRÉE, Chance proposable, dessoûlé 1×', () => {
    const a = hero({ id: 'A', label: 'Éméché', drunk: { failedTests: 2, drunk: true }, fortune: 2 });
    useGame.setState({ party: [a], gameTime: 0, lastUpkeepDay: 0, lastNightDay: 0, pendingCascade: null });
    useGame.getState().advanceTime(MINUTES_PER_DAY);

    const p = useGame.getState().pendingCascade;
    expect(p!.purpose).toBe('upkeep');
    const step = stepOfKind('dessoulage');
    expect(step).toBeTruthy();
    expect(step!.participants!.map((r) => r.id)).toEqual(['A']);
    expect(useGame.getState().party.find((h) => h.id === 'A')!.drunk).toBeTruthy(); // DIFFÉRÉ : encore ivre tant que non validé

    forceFail(step!.id, 'A');
    const fortuneBefore = useGame.getState().party.find((h) => h.id === 'A')!.fortune;
    useGame.getState().cascadeBatchReroll('A');
    expect(useGame.getState().party.find((h) => h.id === 'A')!.fortune).toBe((fortuneBefore ?? 0) - 1);

    // Dessoûlage appliqué 1× à la validation (soberUp lève l'état, quelle que soit l'issue du DR).
    useGame.getState().cascadeNext();
    expect(useGame.getState().party.find((h) => h.id === 'A')!.drunk).toBeUndefined();
  });

  it('advanceTime 24h SANS jet (ration consommée) → témoin groupé en ÉTAPE d’affichage de la MÊME séquence', () => {
    const a = hero({ id: 'A', label: 'Repue', items: [ration('r1')] });
    useGame.setState({ party: [a], gameTime: 0, lastUpkeepDay: 0, lastNightDay: 0, pendingCascade: null });
    useGame.getState().advanceTime(MINUTES_PER_DAY);

    // #942 L8 : les deux issues du MÊME entretien ouvrent la MÊME séquence ('upkeep') — le témoin
    // groupé des lignes SANS jet (rations…) y est l'étape d'AFFICHAGE, plus une file parallèle.
    const c = useGame.getState().pendingCascade;
    expect(c?.purpose).toBe('upkeep');
    expect(c!.participants).toHaveLength(1);
    expect(c!.participants[0].reveal?.title).toBe('Entretien quotidien');
    expect(c!.participants[0].autoCloseMs, 'la fermeture d’une révélation est EXPLICITE (#1270) — aucun timer non déclaré').toBeUndefined();
  });
});

describe('#253 — EXPOSITION de campement : étape de cascade influençable', () => {
  it('nuit de pluie dehors sans abri → jets d’Exposition DIFFÉRÉS, Chance proposable', () => {
    const sc = emptyScene(10, 10);
    sc.weather = 'pluie'; // difficile → Tests d'Exposition ; aucune compétence Survie → pas d'abri, jets directs
    const a = hero({ id: 'A', label: 'Transi', fortune: 2 });
    useGame.setState({ party: [a], scene: sc });
    useGame.getState().openRest({ places: { camp: true } });
    useGame.getState().restSet('A', { lodging: 'dehors', food: 'rien' });
    useGame.getState().restSleep();

    // L'abri de fortune (Survie en extérieur) ouvre la séquence ; son échec INSÈRE les jets d'Exposition.
    const abri = stepOfKind('shelter');
    if (abri) { forceFail(abri.id, 'A'); useGame.getState().cascadeNext(); }

    const expo = stepOfKind('exposure');
    expect(expo).toBeTruthy();
    expect(expo!.participants!.map((r) => r.id)).toEqual(['A']);

    forceFail(expo!.id, 'A');
    const fortuneBefore = useGame.getState().party.find((h) => h.id === 'A')!.fortune;
    useGame.getState().cascadeBatchReroll('A');
    expect(useGame.getState().party.find((h) => h.id === 'A')!.fortune).toBe((fortuneBefore ?? 0) - 1);
  });
});
