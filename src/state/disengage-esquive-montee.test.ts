import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { FLOWS } from '../noyau/rollFlowSpecs';

// #1097 — l'Esquive de Désengagement (LDB 15 l.43) lit les lignes d'Esquive du contexte : monté −20 (LDB 14 l.184).
describe('Désengagement : Esquive du cavalier', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ pendingDisengage: null, battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function ouvrir(monte: boolean) {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const [E, ...rest] = b.combatants.filter((c) => c.kind === 'enemy');
    rest.forEach((e) => (e.dead = true));
    H.size = 'moyenne'; E.size = 'moyenne';
    H.engagedWith = [E.id]; E.engagedWith = [H.id];
    if (monte) H.mountId = 'monture-sonde';
    useGame.setState({ battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 0, acted: false } });
    useGame.getState().battleDisengage();
    expect(useGame.getState().pendingDisengage?.phase).toBe('choice');
  }
  const cible = () => useGame.getState().pendingDisengage!.def!.target;

  it('disengageRoll : le cavalier esquive à −20 de son homologue à pied', () => {
    ouvrir(false); useGame.getState().disengageRoll(); const pied = cible();
    ouvrir(true); useGame.getState().disengageRoll(); const monte = cible();
    expect(monte).toBe(pied - 20);
  });

  it('relance par Chance (spec disengage) : même −20', () => {
    ouvrir(true); useGame.getState().disengageRoll(); const premier = cible();
    const mover = useGame.getState().battle!.combatants.find((c) => c.id === useGame.getState().pendingDisengage!.moverId)!;
    mover.fortune = 1;
    FLOWS.disengage.reroll(useGame.getState, useGame.setState);
    expect(mover.fortune).toBe(0);
    expect(cible()).toBe(premier);
  });
});
