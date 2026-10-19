import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { computeMoveReach } from './combatFlow';
import { chooseEnemyAction } from './ai';
import { hasCondition } from '../engine/conditions';
import { chebyshev } from '../noyau/monde/path';
import type { Combatant } from '../engine/types';

const scene = () =>
  ({ id: 's', label: '', dimensions: { w: 12, h: 12 }, layers: [{ z: 0, tiles: Array(144).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never);

function setup(broken: boolean, enemyPos = { x: 9, y: 5 }) {
  const hero = { id: 'h', kind: 'hero', name: 'H', pos: { x: 5, y: 5 }, movement: 4, weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }], conditions: broken ? [{ id: 'brise', value: 1 }] : [], characteristics: { 'force-mentale': 40 }, skills: [], wounds: { current: 10, max: 10 }, advantage: 0, engagedWith: [], psychState: [] } as unknown as Combatant;
  const enemy = { id: 'e', kind: 'enemy', name: 'E', pos: enemyPos, conditions: [], wounds: { current: 10, max: 10 } } as unknown as Combatant;
  useGame.setState({ battle: { combatants: [hero, enemy], order: ['h', 'e'], baseOrder: ['h', 'e'], turn: 0, action: null, movementUsed: 0, acted: false, reachable: new Map(), over: false, round: 1, log: [] } as never, scene: scene() });
  return { hero, enemy };
}

describe('Brisé — restriction d\'action (LDB 16 l.52)', () => {
  // Purge inter-tests : `combatBusy` gèle la hotbar sous un jet OU une cascade en cours. Depuis que la
  // Charge ouvre une cascade combat (comme l'attaque normale), `battleClickEntity` laisse un `pendingCascade`
  // qu'il faut aussi purger (sinon le test suivant verra `combatBusy === true`).
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ battle: null, pendingAttack: null, pendingCascade: null }); });
  afterEach(() => { vi.useRealTimers(); });

  it('Brisé : le clic-ennemi est REFUSÉ (aucune action offensive)', () => {
    setup(true);
    useGame.getState().battleClickEntity('e', { confirm: true });
    expect(useGame.getState().pendingAttack).toBeNull();
  });

  it('non Brisé : le clic-ennemi APPROCHE-ET-FRAPPE quand la Charge est armée (régression)', () => {
    setup(false);
    vi.clearAllTimers();
    // La cible est hors d'Allonge : depuis la spec HUD § ARBITRAGE 2026-08-19, le clic ne s'approche
    // plus tout seul — le joueur ARME la Charge, et le verdict voyage avec le geste (`approche`).
    useGame.getState().battleClickEntity('e', { confirm: true, approche: true });
    vi.runOnlyPendingTimers(); // joue le glissé d'approche (charge) → ouvre la frappe
    expect(useGame.getState().pendingAttack).not.toBeNull();
  });

  // « Retirez un État » (LDB 17 l.61) ne connaît aucune restriction d'État : le Brisé se retire donc
  // à la Détermination, malgré la restriction d'Action de l'État lui-même (LDB 16 l.52). Depuis
  // #1411 P0-B lot 3 cette dépense n'ARME plus rien (`battle.action`) — elle part du geste de la
  // pastille de l'État, dispatcher DIRECT ; c'est ce chemin qui se mesure.
  it('Brisé : la Détermination le RETIRE (LDB 17 l.61), malgré la restriction d’Action', () => {
    const { hero } = setup(true);
    hero.resolve = 1;
    useGame.getState().battleSpendResolve('brise');
    expect(hasCondition(useGame.getState().battle!.combatants[0], 'brise')).toBe(false);
    expect(useGame.getState().battle!.combatants[0].resolve).toBe(0);
  });

  it('Brisé : le déplacement ne propose QUE des cases qui ne rapprochent pas d\'un ennemi (fuir)', () => {
    setup(true); // héros (5,5), ennemi (9,5)
    const r = computeMoveReach(useGame.getState);
    expect(r.has('4,5')).toBe(true); // s\'éloigne → permis
    expect(r.has('6,5')).toBe(false); // se rapproche de l\'ennemi → exclu
  });

  it('IA : un ennemi Brisé non Engagé FUIT (move s\'éloignant des héros)', () => {
    const enemy = { id: 'e', kind: 'enemy', name: 'E', pos: { x: 5, y: 5 }, movement: 4, weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }], conditions: [{ id: 'brise', value: 1 }], wounds: { current: 10, max: 10 }, engagedWith: [] } as unknown as Combatant;
    const h = { id: 'h', kind: 'hero', name: 'H', pos: { x: 6, y: 5 }, wounds: { current: 10, max: 10 } } as unknown as Combatant;
    const action = chooseEnemyAction({ enemy, heroes: [h], scene: scene(), blocked: new Set(['6,5']), movement: 4 } as never);
    expect(action.kind).toBe('move');
    const to = (action as { to: { x: number; y: number } }).to;
    expect(chebyshev(to, { x: 6, y: 5 })).toBeGreaterThan(1); // plus loin du héros que (5,5)
  });
});
