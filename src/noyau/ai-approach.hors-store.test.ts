import { describe, it, beforeEach, expect } from 'vitest';
import { aiApproachPlan, runEnemyAI } from './combatFlow';
import { chooseEnemyAction, type EnemyTurnInput } from './monde/ai';
import type { Combatant } from '../engine/types';
import { chebyshev } from '../engine/grid';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import { t } from '../i18n';
import { addCondition } from '../engine/conditions';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { budgetsDAllure } from './refusDuTour';
import type { BattleState } from './etat';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Parité héros/IA sur l'approche (LDB 15 l.35-41) : Charge à portée de Course (2M) quand la Marche
 * ne suffit pas à entrer au contact ; Course (Test `course`, pas d'attaque) au-delà.
 */
/** Les zones du joueur à M 4 (`budgetDeCharge`, `budgetDeCourse`) : Charge 2M, Course nominale M + 2M. */
const BUDGETS_M4 = { charge: 8, course: 12 };

const scene = () =>
  ({ id: 's', label: '', dimensions: { w: 30, h: 21 }, layers: [{ z: 0, tiles: Array(630).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never);

const C = (kind: 'heros' | 'ennemi', id: string, x: number, over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id, name: id, kind, pos: { x, y: 10 }, movement: 4,
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    conditions: [], skills: [], wounds: blessuresDeBase(10), advantage: 0, engagedWith: [], psychState: [],
    ...over,
  })) as unknown as Combatant;

/** Les budgets `budgets` que la porte du joueur laisse à `enemy` face à `hero` (`refusDeCharge`, `refusDeCourse`), comme
 *  le tour de l'IA les passe. */
function budgetsDuJoueur(enemy: Combatant, hero: Combatant, budgets: { charge: number; course: number }) {
  const battle = { combatants: [enemy, hero], order: [enemy.id], turn: 0, round: 1, acted: false, movementUsed: 0, reachable: new Map(), log: [] } as unknown as BattleState;
  return budgetsDAllure(scene(), battle, enemy, budgets);
}

function planFor(heroX: number, over: Partial<Combatant> = {}) {
  const enemy = C('ennemi', 'e', 2, over);
  const hero = C('heros', 'h', heroX);
  const input: EnemyTurnInput = { enemy, heroes: [hero], scene: scene(), env: { blocked: new Set([`${heroX},10`]) }, movement: 4, spells: [] };
  const action = chooseEnemyAction(input);
  return { enemy, hero, ...aiApproachPlan(input, action, budgetsDuJoueur(enemy, hero, BUDGETS_M4)), action };
}

describe('aiApproachPlan — Charge à portée de Course / Course au-delà', () => {
  it('À Terre ne fait que ramper (LDB 16 l.35, `gating.movement: crawl`) : ni Charge ni Course, le plan de Marche reste', () => {
    const enemy = C('ennemi', 'e', 2);
    addCondition(enemy, 'a-terre');
    const hero = C('heros', 'h', 25);
    const input: EnemyTurnInput = { enemy, heroes: [hero], scene: scene(), env: { blocked: new Set(['25,10']) }, movement: 2, spells: [] };
    const action = chooseEnemyAction(input);
    const { plan, allure } = aiApproachPlan(input, action, budgetsDuJoueur(enemy, hero, { charge: 4, course: 6 }));
    expect(allure).toBe('marche');
    expect(plan).toBe(action);
  });

  it('Marche suffisante (cible à 3) : plan inchangé, pas de Course', () => {
    const { plan, action, allure } = planFor(5);
    expect(plan).toBe(action);
    expect(allure).toBe('marche');
  });

  it('cible à 6 cases (M4) : CHARGE à portée de Course — arrive AU CONTACT, sans jet', () => {
    const { plan, allure } = planFor(8); // distance 6 : marche (4) insuffisante, Course (8) au contact
    expect(allure).toBe('charge'); // une charge ne demande pas de Test
    expect(plan.kind).toBe('deplacement');
    const to = (plan as { to: { x: number; y: number } }).to;
    expect(chebyshev(to, { x: 8, y: 10 })).toBe(1); // adjacent au héros
  });

  it('cible hors de portée de Charge : COURT (Test `course` joué au geste) et vise plus loin que la Marche', () => {
    const { plan, allure, action } = planFor(25); // distance 23 : même la Charge (8) n'atteint pas
    expect(allure).toBe('course');
    const to = (plan as { to: { x: number; y: number } }).to;
    const toWalk = (action as { to: { x: number; y: number } }).to;
    expect(to.x).toBeGreaterThan(toWalk.x); // porte plus loin que le plan de Marche
  });

  it('Engagé : jamais de re-planification (ni Charge étendue ni Course)', () => {
    const { plan, action, allure } = planFor(8, { engagedWith: ['h'] });
    expect(plan).toBe(action);
    expect(allure).toBe('marche');
  });
});

describe('Course ennemie — le journal du tour (LDB 15 l.41)', () => {
  it('se joue par le geste du joueur : la Course, Test joué d’office, et sa ligne, celle du héros (`cs.run`, cases parcourues)', () => {
    const enemy = C('ennemi', 'e', 2, { label: 'Gobelin' } as Partial<Combatant>);
    // Héros à 11 cases : hors de la Charge (8), au contact par la Course — l'ennemi s'arrête AVANT
    // d'épuiser son budget (Marche + Course + DR), et la ligne dit les cases PARCOURUES, pas le budget.
    const hero = C('heros', 'h', 13);
    banc.setState({ scene: scene(), party: [], pendingCascade: null, actorMove: null,
      battle: { combatants: [enemy, hero], order: ['e', 'h'], turn: 0, round: 1, log: [], over: null, action: null, reachable: new Map() } as never });
    seedBattleRng(3);
    const depart = { ...enemy.pos! };
    runEnemyAI(banc.getState, banc.setState, 'e');
    banc.reprendreLesEnAttente();
    const b = banc.getState().battle!;
    const lignes = b.log.filter((l) => l.actorId === 'e' && l.kind === 'deplacement').map((l) => l.text);
    expect(chebyshev(depart, enemy.pos!), 'au-delà de la Marche').toBeGreaterThan(4);
    expect(b.runBudget, 'le budget du Tour est celui de la Course jouée (LDB 15 l.41)').toBeGreaterThan(4);
    expect(lignes).toEqual([t('cs.run', { name: 'Gobelin', cost: chebyshev(depart, enemy.pos!), short: '' })]);
  });
});

describe('IA Engagée : le départ du contact paie sa voie du Désengagement (LDB 15 l.47, #5030)', () => {
  it('l’Avantage supérieur sacrifié lève l’Engagement avant le déplacement, une fois', () => {
    const arc = { name: 'Arc', type: 'distance', damage: { plusBF: false, flat: 4 }, qualities: [], range: 50 } as never;
    const enemy = C('ennemi', 'e', 2, { label: 'Gobelin', weapons: [arc], advantage: 2, engagedWith: ['h'] } as Partial<Combatant>);
    const hero = C('heros', 'h', 3, { engagedWith: ['e'] });
    banc.setState({ scene: scene(), party: [], pendingCascade: null, actorMove: null,
      battle: { combatants: [enemy, hero], order: ['e', 'h'], turn: 0, round: 1, log: [], over: null, action: null, reachable: new Map() } as never });
    seedBattleRng(3);
    runEnemyAI(banc.getState, banc.setState, 'e');
    banc.reprendreLesEnAttente();
    const e = banc.getState().battle!.combatants.find((c) => c.id === 'e')!;
    expect(e.pos!.x, 'le tireur s’est écarté').not.toBe(2);
    expect([e.advantage, e.engagedWith, hero.engagedWith]).toEqual([0, [], []]);
    expect(banc.getState().battle!.log.filter((l) => l.text === t('cs.disengageSacrifice', { name: 'Gobelin' }))).toHaveLength(1);
  });
});
