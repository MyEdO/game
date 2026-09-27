import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { hasCondition } from '../engine/conditions';

describe('À Terre — se relever / pas de Course (LDB 16 l.37, 18 l.15)', () => {
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
    H.engagedWith = [];
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, movementUsed: 0, acted: false } });
    return { H };
  }

  it('À Terre + ≥1 PB → battleStandUp retire À Terre et consomme le Mouvement (pas l’Action)', () => {
    const { H } = setup();
    H.conditions = [{ id: 'a-terre', value: 1 }];
    H.wounds = { current: 5, max: 12, base: 12 } as never;
    useGame.setState({ battle: { ...useGame.getState().battle! } });
    useGame.getState().battleStandUp();
    const st = useGame.getState();
    const h = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(hasCondition(h, 'a-terre')).toBe(false);
    expect(st.battle!.movementUsed).toBeGreaterThan(0); // se relever consomme le (plein) Mouvement
    expect(st.battle!.acted).toBe(false); // l'Action reste disponible
  });

  it('À Terre + 0 PB → ne peut PAS se relever (LDB 18 l.15)', () => {
    const { H } = setup();
    H.conditions = [{ id: 'a-terre', value: 1 }];
    H.wounds = { current: 0, max: 12, base: 12 } as never;
    useGame.setState({ battle: { ...useGame.getState().battle! } });
    useGame.getState().battleStandUp();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(hasCondition(h, 'a-terre')).toBe(true); // reste au sol
  });

  it('À Terre → battleRun n’ouvre rien (pas de Course au sol)', () => {
    const { H } = setup();
    H.conditions = [{ id: 'a-terre', value: 1 }];
    H.wounds = { current: 5, max: 12, base: 12 } as never;
    useGame.setState({ battle: { ...useGame.getState().battle! }, pendingRun: null });
    useGame.getState().battleRun();
    expect(useGame.getState().pendingRun).toBeNull();
  });
});
