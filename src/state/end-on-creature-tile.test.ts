import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { emptyScene } from './scene';
import { reachable, flyReachable } from './path';
import { occupied, cannotStopOn } from './combatGeometry';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { attackPlan, computeMoveReach, computeRunReach } from './combatFlow';
import { sizeFootprint } from './footprint';
import type { Combatant } from '../engine/types';
import type { BattleState } from './store';
import type { SizeCategory } from '../engine/size';
import { inBattleId } from './combatants';

/**
 * INVARIANT (LDB 85 l.373-374 vs Frappe Mortelle) : on TRAVERSE la case d'une créature plus petite
 * (« dégage du chemin ») mais on ne FINIT JAMAIS son déplacement sur la case d'une autre créature.
 * La SEULE entrée DANS la case adverse est la Frappe Mortelle (LDB 85 l.362). Bug d'origine : la case
 * d'un ennemi plus petit était proposée comme destination de Mouvement (le héros « entrait dedans »).
 */

const C = (id: string, x: number, y: number, size?: SizeCategory): Combatant =>
  ({ id, pos: { x, y }, size, conditions: [], wounds: { current: 10, max: 10 } }) as unknown as Combatant;
const battleOf = (combatants: Combatant[]): BattleState => ({ combatants, zones: [] }) as unknown as BattleState;
const empty = new Set<string>();

describe('reachable/flyReachable — `noStop` : on TRAVERSE mais on ne s\'ARRÊTE pas', () => {
  it('couloir 1 case de large : la case noStop est franchie mais retirée des destinations', () => {
    const corridor = emptyScene(5, 1); // x=0..4, une seule rangée → x=2 est l'UNIQUE passage vers x≥3
    const sans = reachable(corridor, { x: 0, y: 0 }, 4, { blocked: empty });
    expect(sans.has('2,0')).toBe(true); // sans contrainte : c'est une destination

    const avec = reachable(corridor, { x: 0, y: 0 }, 4, { blocked: empty, noStop: new Set(['2,0']) });
    expect(avec.has('2,0')).toBe(false); // interdite à l'ARRÊT
    expect(avec.has('3,0')).toBe(true); // …mais TRAVERSÉE : l'au-delà reste atteignable (pass-through RAW)
    expect(avec.has('4,0')).toBe(true);
    expect(avec.has('0,0')).toBe(true); // la case de départ n'est jamais un noStop
  });

  it('flyReachable : pas d\'atterrissage sur une case noStop', () => {
    const sky = emptyScene(5, 5);
    const fly = flyReachable(sky, { x: 0, y: 0 }, 4, { blocked: empty, noStop: new Set(['2,0']) });
    expect(fly.has('2,0')).toBe(false);
    expect(fly.has('3,0')).toBe(true); // le vol atteint l'au-delà en ligne directe
  });
});

describe('cannotStopOn — qui interdit l\'arrêt sur quelle case', () => {
  it('mover 1×1 : interdit de finir sur une créature plus PETITE (dégagée du chemin mais non écrasée)', () => {
    const hero = C('h', 6, 10, 'moyenne');
    const small = C('s', 8, 10, 'petite');
    const set = cannotStopOn(battleOf([hero, small]), hero);
    expect(set.has('8,10')).toBe(true);
  });

  it('mover 1×1 : une créature de Taille ÉGALE n\'est pas listée ici (déjà infranchissable via occupied)', () => {
    const hero = C('h', 6, 10, 'moyenne');
    const peer = C('p', 8, 10, 'moyenne');
    const b = battleOf([hero, peer]);
    expect(cannotStopOn(b, hero).has('8,10')).toBe(false); // gérée par le TRANSIT (occupied), pas ici
    expect(occupied(b, hero).has('8,10')).toBe(true); // …et bien infranchissable
  });

  it('mover à empreinte > 1 : VIDE — en arrivant il DÉPLACE les plus petits (`displaceSmaller`)', () => {
    const big = C('b', 6, 10, 'grande'); // empreinte 2×2
    const small = C('s', 9, 10, 'petite');
    expect(cannotStopOn(battleOf([big, small]), big).size).toBe(0);
  });

  it('ignore les combattants hors d\'action et soi-même', () => {
    const hero = C('h', 6, 10, 'moyenne');
    const dead = { ...C('d', 8, 10, 'petite'), wounds: { current: 0, max: 10 } } as Combatant;
    expect(cannotStopOn(battleOf([hero, dead]), hero).has('8,10')).toBe(false);
  });
});

describe('intégration store — un héros ne peut pas FINIR sur la case d\'un ennemi plus petit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGame.setState({ battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    return { H, enemies };
  }

  it('computeMoveReach exclut la case de l\'ennemi plus petit ; attackPlan vise une case ADJACENTE', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    H.pos = { x: 6, y: 10 };
    E.size = 'petite';
    E.pos = { x: 8, y: 10 };
    const b = useGame.getState().battle!;
    useGame.setState({ battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 0, acted: false } });

    const battle = useGame.getState().battle!;
    const hero = inBattleId(battle, H.id)!;

    // TRANSIT : l'ennemi plus petit ne bloque pas le passage (LDB 85) — il est absent de `occupied`.
    expect(occupied(battle, hero).has('8,10')).toBe(false);

    // DESTINATION : sa case n'est JAMAIS proposée comme arrêt de Mouvement.
    expect(computeMoveReach(useGame.getState).has('8,10')).toBe(false);

    // L'attaque vise une case ADJACENTE (jamais la case de la cible).
    const plan = attackPlan(useGame.getState, hero, E);
    expect(plan.kind === 'moveAttack' || plan.kind === 'charge').toBe(true);
    if (plan.kind === 'moveAttack' || plan.kind === 'charge') {
      expect(plan.dest).not.toEqual({ x: 8, y: 10 });
      expect(sizeFootprint(hero.size)).toBe(1); // garde-fou : le héros EST 1×1 (sinon le scénario ne teste rien)
    }
  });

  it('computeRunReach exclut AUSSI la case de l\'ennemi plus petit (même invariant moveEnv/noStop que la Marche)', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    H.pos = { x: 6, y: 10 };
    H.engagedWith = []; // non Engagé : garde de computeRunReach (la Course exige le Mouvement libre)
    E.size = 'petite';
    E.pos = { x: 8, y: 10 };
    const b = useGame.getState().battle!;
    useGame.setState({ battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 0, acted: false } });

    const run = computeRunReach(useGame.getState);
    expect(run.size).toBeGreaterThan(0); // la Course produit bien des cases (sinon l'assertion serait vacue)
    expect(run.has('8,10')).toBe(false); // un futur producteur de portée qui oublie noStop/moveEnv est attrapé ici
  });
});
