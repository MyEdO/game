import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { addCondition } from '../engine/conditions';
import { vehicleCombatant } from '../engine/vehicle';
import { findVehicleById } from '../data';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

// MDG 13 l.588 ; LDB 16 l.84 ; #1595 c.6242576877
describe('En flammes (navire) — N États, N Blessures par Round, par le chemin réel de fin de Tour', () => {
  beforeEach(() => {
    banc.setState({ pendingCascade: null, battle: null });
  });

  const hull = () => banc.getState().battle!.combatants.find((c) => c.id === 'navire')!;

  /** Joue chaque Tour du Round par `battleEndTurn`, en vérifiant que la coque ne brûle pas entre deux Tours. */
  function playRound(woundsAtStart: number) {
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const round = banc.getState().battle!.round;
    let turns = 0;
    while (banc.getState().battle!.round === round) {
      expect(hull().wounds.current).toBe(woundsAtStart);
      banc.getState().battleEndTurn();
      banc.abandonner();
      turns += 1;
    }
    return turns;
  }

  it('2 États En flammes, 4 combattants : −2 Blessures au 1er Round, −4 après le 2e', () => {
    seedBattleRng(1);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    const b = banc.getState().battle!;
    const ship = vehicleCombatant(findVehicleById('diligence')!, 'navire')!;
    addCondition(ship, 'en-flammes-navire', 2);
    const others = b.order.filter((id) => b.combatants.some((c) => c.id === id && !c.dead));
    const order = ['navire', ...others];
    banc.setState({ battle: { ...b, combatants: [...b.combatants, ship], order, baseOrder: order, turn: 0 } });
    const start = hull().wounds.current;

    expect(playRound(start)).toBeGreaterThanOrEqual(3);
    expect(hull().wounds.current).toBe(start - 2);

    playRound(start - 2);
    expect(hull().wounds.current).toBe(start - 4);
  });
});
