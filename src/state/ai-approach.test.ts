import { describe, it, expect, vi, afterEach } from 'vitest';
import { aiApproachPlan, runEnemyAI } from '../noyau/combatFlow';
import { chooseEnemyAction, type EnemyTurnInput } from '../noyau/monde/ai';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import { chebyshev } from '../engine/grid';
import { useGame } from './store';
import { battleRng, seedBattleRng } from '../noyau/battleRng';
import { testDeRegle } from '../engine/reglesChiffrees';
import { valeurDuTest } from '../engine/skills';
import { cibleDuTest, evaluateTest } from '../engine/tests';
import { traceLineOf, testTraceLabel } from '../engine/traceLine';
import { runFromTest } from '../engine/movement';
import { refLabel } from '../data';
import { t } from '../i18n';
import { addCondition } from '../engine/conditions';

/**
 * Parité héros/IA sur l'approche (LDB 15 l.35-41) : Charge à portée de Course (2M) quand la Marche
 * ne suffit pas à entrer au contact ; Course (Test `course`, pas d'attaque) au-delà.
 */
const scene = () =>
  ({ id: 's', label: '', dimensions: { w: 30, h: 21 }, layers: [{ z: 0, tiles: Array(630).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never);

const C = (kind: 'hero' | 'enemy', id: string, x: number, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, name: id, kind, pos: { x, y: 10 }, movement: 4,
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    conditions: [], skills: [], wounds: { current: 10, max: 10 }, advantage: 0, engagedWith: [], psychState: [],
    ...over,
  }) as unknown as Combatant;

function planFor(heroX: number, over: Partial<Combatant> = {}) {
  const enemy = C('enemy', 'e', 2, over);
  const hero = C('hero', 'h', heroX);
  const input: EnemyTurnInput = { enemy, heroes: [hero], scene: scene(), blocked: new Set([`${heroX},10`]), movement: 4, spells: [] };
  const action = chooseEnemyAction(input);
  return { enemy, hero, ...aiApproachPlan(input, enemy, action, makeRNG(3)), action };
}

describe('aiApproachPlan — Charge à portée de Course / Course au-delà', () => {
  it('À Terre ne fait que ramper (LDB 16 l.35, `gating.movement: crawl`) : ni Charge ni Course, le plan de Marche reste', () => {
    const enemy = C('enemy', 'e', 2);
    addCondition(enemy, 'a-terre');
    const hero = C('hero', 'h', 25);
    const input: EnemyTurnInput = { enemy, heroes: [hero], scene: scene(), blocked: new Set(['25,10']), movement: 2, spells: [] };
    const action = chooseEnemyAction(input);
    const { plan, ran } = aiApproachPlan(input, enemy, action, makeRNG(3));
    expect(ran).toBeNull();
    expect(plan).toBe(action);
  });

  it('Marche suffisante (cible à 3) : plan inchangé, pas de Course', () => {
    const { plan, action, ran } = planFor(5);
    expect(plan).toBe(action);
    expect(ran).toBeNull();
  });

  it('cible à 6 cases (M4) : CHARGE à portée de Course — arrive AU CONTACT, sans jet', () => {
    const { plan, ran } = planFor(8); // distance 6 : marche (4) insuffisante, Course (8) au contact
    expect(ran).toBeNull(); // une charge ne demande pas de Test
    expect(plan.kind).toBe('move');
    const to = (plan as { to: { x: number; y: number } }).to;
    expect(chebyshev(to, { x: 8, y: 10 })).toBe(1); // adjacent au héros
  });

  it('cible hors de portée de Course : COURT (Test `course`) et avance plus loin que la Marche', () => {
    const { plan, ran, action } = planFor(25); // distance 23 : même la Course (8) n'atteint pas
    expect(ran).not.toBeNull(); // jet de Course consommant l'Action
    expect(ran!.budget).toBeGreaterThan(4); // Marche + Course + DR
    const to = (plan as { to: { x: number; y: number } }).to;
    const toWalk = (action as { to: { x: number; y: number } }).to;
    expect(to.x).toBeGreaterThan(toWalk.x); // porte plus loin que le plan de Marche
  });

  it('Engagé : jamais de re-planification (ni Charge étendue ni Course)', () => {
    const { plan, action, ran } = planFor(8, { engagedWith: ['x'] });
    expect(plan).toBe(action);
    expect(ran).toBeNull();
  });
});

describe('Course ennemie — le journal du tour (LDB 15 l.41)', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); useGame.setState({ battle: null, actorMove: null } as never); });

  it('contient EXACTEMENT la ligne du Test de `course` puis la Course, à la forme de celle du héros (`cs.run`, cases parcourues)', () => {
    vi.useFakeTimers();
    const enemy = C('enemy', 'e', 2, { label: 'Gobelin' } as Partial<Combatant>);
    // Héros à 11 cases : hors de la Charge (8), au contact par la Course — l'ennemi s'arrête AVANT
    // d'épuiser son budget (Marche + Course + DR), et la ligne dit les cases PARCOURUES, pas le budget.
    const hero = C('hero', 'h', 13);
    useGame.setState({ scene: scene(), party: [], pendingCascade: null, actorMove: null,
      battle: { combatants: [enemy, hero], order: ['e', 'h'], turn: 0, round: 1, log: [], over: null } as never });
    seedBattleRng(3);
    const des = vi.spyOn(battleRng(), 'int');
    const depart = { ...enemy.pos! };
    runEnemyAI(useGame.getState, useGame.setState, 'e');
    vi.runOnlyPendingTimers();
    const d100 = des.mock.calls.flatMap((args, i) => (args[0] === 1 && args[1] === 100 ? [des.mock.results[i].value as number] : []));
    expect(d100, 'un seul d100 au tour : celui de la Course').toHaveLength(1);
    const course = testDeRegle('course', 'courir');
    const jet = evaluateTest(d100[0], cibleDuTest(valeurDuTest(enemy, course), course.difficulty));
    const lignes = useGame.getState().battle!.log.filter((l) => l.actorId === 'e' && l.kind === 'move').map((l) => l.text);
    expect(chebyshev(depart, enemy.pos!), 'arrêt avant le budget').toBeLessThan(4 + runFromTest(jet, 4).bonusCases);
    expect(lignes).toEqual([
      traceLineOf({ who: 'Gobelin', label: testTraceLabel(refLabel('skills', course.skill), course.difficulty), roll: jet.roll, target: jet.target, sl: jet.sl, success: jet.success }),
      t('cs.run', { name: 'Gobelin', cost: chebyshev(depart, enemy.pos!), short: '' }),
    ]);
  });
});
