import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { openCombatEndCascade } from '../noyau/combatFlow';
import { fireTriggers } from '../noyau/triggeredEffects';
import { applyOps } from '../engine/ops';
import { diseaseDefs } from '../engine/disease';
import { easeDifficulty } from '../engine/tests';
import { DIFFICULTY_MODIFIERS } from '../engine/types';
import { seedBattleRng } from '../noyau/battleRng';
import type { Combatant } from '../engine/types';
import { desDuTest } from '../engine/dice.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

/**
 * Trait « Contagieux (Type) » — EDO App.2 l.228-230 : « La créature héberge la maladie indiquée, et
 * elle peut la transmettre au toucher. Dans ce cas, la victime doit tester s'il y a Contraction, mais
 * le Test est de 2 niveaux plus difficile que la normale. Si la maladie est contractée, son incubation
 * est changée en “Instantanée”. » 100 % DONNÉE (traits.json : effet onHit → op `exposeDisease`
 * étendue `difficultyShift:-2` + `incubation:'instant'`, maladie = l'arg d'instance `$arg`). « Au
 * toucher » : SANS exiger de perte de PB (≠ Infecté, dont le texte l'exige).
 */
const mk = (p: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id: 'x', label: 'X', kind: 'enemy',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  }) as Combatant);

const get = (() => ({ battle: { combatants: [] } })) as never;

beforeEach(() => { seedBattleRng(1); useGame.setState({ battle: null, mode: 'exploration', journal: [], pendingCascade: null }); });

describe('Contagieux (Type) — transmission au toucher (EDO App.2 l.228-230)', () => {
  it('touche SANS perte de PB → exposition quand même (« au toucher », ≠ Infecté), avec shift −2 + instant', () => {
    const atk = mk({ traits: [{ id: 'contagieux', arg: 'fievre-du-rongeur' }] as never });
    const vic = mk({ id: 'v', kind: 'hero' });
    fireTriggers(get, atk, 'onHit', { victim: vic, woundsDealt: 0 } as never);
    expect(vic.diseaseExposure).toEqual([{ disease: 'fievre-du-rongeur', difficultyShift: -2, instant: true }]);
  });

  it('trait posé SANS arg (Type manquant) → op droppée (aucune exposition, pas de plantage)', () => {
    const atk = mk({ traits: [{ id: 'contagieux' }] as never });
    const vic = mk({ id: 'v', kind: 'hero' });
    fireTriggers(get, atk, 'onHit', { victim: vic, woundsDealt: 3 } as never);
    expect(vic.diseaseExposure ?? []).toEqual([]);
  });

  it('double exposition à la MÊME maladie (Maladie (Type) puis Contagieux) → fusion en gardant la PIRE', () => {
    const vic = mk({ id: 'v', kind: 'hero' });
    applyOps(vic, [{ op: 'exposeDisease', disease: 'fievre-du-rongeur' }], { rng: desDuTest });
    applyOps(vic, [{ op: 'exposeDisease', disease: 'fievre-du-rongeur', difficultyShift: -2, incubation: 'instant' }], { rng: desDuTest });
    expect(vic.diseaseExposure).toEqual([{ disease: 'fievre-du-rongeur', difficultyShift: -2, instant: true }]);
    // L'ordre inverse donne le même résultat (le plus dur gagne, pas le dernier).
    const vic2 = mk({ id: 'v2', kind: 'hero' });
    applyOps(vic2, [{ op: 'exposeDisease', disease: 'fievre-du-rongeur', difficultyShift: -2, incubation: 'instant' }], { rng: desDuTest });
    applyOps(vic2, [{ op: 'exposeDisease', disease: 'fievre-du-rongeur' }], { rng: desDuTest });
    expect(vic2.diseaseExposure).toEqual([{ disease: 'fievre-du-rongeur', difficultyShift: -2, instant: true }]);
  });

  it('bilan de fin de combat : le Test de Contraction est 2 NIVEAUX plus difficile (Accessible → Complexe)', () => {
    const a = mk({ id: 'a', label: 'A', kind: 'hero', diseaseExposure: [{ disease: 'fievre-du-rongeur', difficultyShift: -2, instant: true }] });
    useGame.setState({ battle: { combatants: [a], order: ['a'], turn: 0, round: 1, log: [], over: null } as never, party: [mk({ id: 'a', kind: 'hero' })] });
    openCombatEndCascade(useGame.getState, useGame.setState);
    // #1117 L4 : le Test de Contraction est une RANGÉE de la bande de son entrée de règle (Contagion),
    // et c'est la rangée qui porte la cible et l'incubation propre à CE porteur.
    const bande = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'combatEndDisease')!;
    const row = bande.participants!.find((r) => r.id === 'a')!;
    const base = 30; // Résistance = E 30, sans avance
    expect(diseaseDefs()['fievre-du-rongeur'].contractDifficulty).toBe('accessible'); // normale : +20
    expect(easeDifficulty('accessible', -2)).toBe('complexe'); // « 2 niveaux plus difficile » : −10
    expect(row.target).toBe(base + DIFFICULTY_MODIFIERS.complexe); // 30 − 10 = 20 (vs 50 sans Contagieux)
    expect(row.meta?.instant).toBe(true);
  });

  it('contractée → incubation « Instantanée » : la maladie démarre ACTIVE (symptômes immédiats)', () => {
    seedBattleRng(4); // 1er d100 = 93 → Test de Contraction raté (cible 20)
    const a = mk({ id: 'a', label: 'A', kind: 'hero', diseaseExposure: [{ disease: 'fievre-du-rongeur', difficultyShift: -2, instant: true }] });
    useGame.setState({ battle: { combatants: [a], order: ['a'], turn: 0, round: 1, log: [], over: null } as never, party: [mk({ id: 'a', kind: 'hero' })] });
    openCombatEndCascade(useGame.getState, useGame.setState);
    const bande = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'combatEndDisease')!;
    useGame.getState().cascadeBatchRoll(bande.participants![0].id);
    useGame.getState().cascadeNext();
    const dz = a.diseases?.find((d) => d.id === 'fievre-du-rongeur');
    expect(dz).toBeTruthy();
    expect(dz!.phase).toBe('active'); // incubation « Instantanée » (3d10+5 jours d'incubation SAUTÉS)
  });

  it('SANS Contagieux (Infecté simple) : difficulté normale et incubation tirée (non-régression)', () => {
    seedBattleRng(4);
    const a = mk({ id: 'a', label: 'A', kind: 'hero', diseaseExposure: [{ disease: 'fievre-du-rongeur' }] });
    useGame.setState({ battle: { combatants: [a], order: ['a'], turn: 0, round: 1, log: [], over: null } as never, party: [mk({ id: 'a', kind: 'hero' })] });
    openCombatEndCascade(useGame.getState, useGame.setState);
    const bande = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'combatEndDisease')!;
    expect(bande.participants![0].target).toBe(30 + DIFFICULTY_MODIFIERS.accessible); // 50 — difficulté RAW de la maladie
    useGame.getState().cascadeBatchRoll(bande.participants![0].id); // 93 → raté
    useGame.getState().cascadeNext();
    const dz = a.diseases?.find((d) => d.id === 'fievre-du-rongeur');
    expect(dz).toBeTruthy();
    expect(dz!.phase).toBe('incubation'); // incubation 3d10+5 jours (RAW), pas « Instantanée »
  });
});
