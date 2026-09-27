import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { draineCascade } from './cascadeTestKit';
import { applyAttackResult } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { hasCondition } from '../engine/conditions';
import type { AttackResult } from '../engine/combat';

describe('0 PB → État À Terre, MÊME sur overkill/Critique (LDB 18 l.15)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    return { H, E };
  }

  it('un héros amené à 0 PB par OVERKILL n’est jamais « debout sans état » → À Terre (ou Inconscient/mort)', () => {
    useGame.getState().seedRng(5);
    const { H, E } = setup();
    H.wounds = { current: 3, max: 12, base: 12 } as never; // PB bas
    H.armour = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 } as never;
    useGame.setState({ battle: { ...useGame.getState().battle! } });
    // Touche NON-critique mais qui dépasse les PB courants (overkill 7) → Blessure critique + À Terre.
    const res: AttackResult = {
      hit: true, attackerRoll: 40, netSL: 2, location: 'corps', damage: 10, woundsLost: 10,
      critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
    };
    applyAttackResult(useGame.getState, useGame.setState, E, H, E.weapons[0], res);
    draineCascade(useGame.getState); // la sévérité du Critique se tire DANS la fenêtre (#1426)
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.wounds.current).toBeLessThanOrEqual(0);
    // Invariante : à 0 PB on n'est jamais debout sans état.
    expect(!!h.dead || hasCondition(h, 'inconscient') || hasCondition(h, 'a-terre')).toBe(true);
  });

  it('un héros amené EXACTEMENT à 0 PB (sans overkill) obtient aussi À Terre', () => {
    useGame.getState().seedRng(5);
    const { H, E } = setup();
    H.wounds = { current: 5, max: 12, base: 12 } as never;
    H.armour = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 } as never;
    useGame.setState({ battle: { ...useGame.getState().battle! } });
    const res: AttackResult = {
      hit: true, attackerRoll: 40, netSL: 1, location: 'corps', damage: 5, woundsLost: 5,
      critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
    };
    applyAttackResult(useGame.getState, useGame.setState, E, H, E.weapons[0], res);
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.wounds.current).toBe(0);
    expect(hasCondition(h, 'a-terre')).toBe(true);
  });
});
