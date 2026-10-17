import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { addCondition } from '../engine/conditions';
import { vehicleCombatant } from '../engine/vehicle';
import { findVehicleById } from '../data';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';

// MDG 13 l.588 ; LDB 16 l.84 ; #1595 c.6242576877
describe('En flammes (navire) — N États, N Blessures par Round, par le chemin réel de fin de Tour', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingCascade: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const hull = () => useGame.getState().battle!.combatants.find((c) => c.id === 'navire')!;

  /** Joue chaque Tour du Round par `battleEndTurn`, en vérifiant que la coque ne brûle pas entre deux Tours. */
  function playRound(woundsAtStart: number) {
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const round = useGame.getState().battle!.round;
    let turns = 0;
    while (useGame.getState().battle!.round === round) {
      expect(hull().wounds.current).toBe(woundsAtStart);
      useGame.getState().battleEndTurn();
      vi.clearAllTimers();
      turns += 1;
    }
    return turns;
  }

  it('2 États En flammes, 4 combattants : −2 Blessures au 1er Round, −4 après le 2e', () => {
    seedBattleRng(1);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    const b = useGame.getState().battle!;
    const ship = vehicleCombatant(findVehicleById('diligence')!, 'navire')!;
    addCondition(ship, 'en-flammes-navire', 2);
    const others = b.order.filter((id) => b.combatants.some((c) => c.id === id && !c.dead));
    const order = ['navire', ...others];
    useGame.setState({ battle: { ...b, combatants: [...b.combatants, ship], order, baseOrder: order, turn: 0 } });
    const start = hull().wounds.current;

    expect(playRound(start)).toBeGreaterThanOrEqual(3);
    expect(hull().wounds.current).toBe(start - 2);

    playRound(start - 2);
    expect(hull().wounds.current).toBe(start - 4);
  });
});
