import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { FLOWS } from './rollFlowSpecs';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

// #1097 — l'Esquive de Désengagement (LDB 15 l.43) lit les lignes d'Esquive du contexte : monté −20 (LDB 14 l.184).
describe('Désengagement : Esquive du cavalier', () => {
  function ouvrir(monte: boolean) {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const [E, ...rest] = b.combatants.filter((c) => c.kind === 'enemy');
    rest.forEach((e) => (e.dead = true));
    H.size = 'moyenne'; E.size = 'moyenne';
    H.engagedWith = [E.id]; E.engagedWith = [H.id];
    if (monte) H.mountId = 'monture-sonde';
    banc.setState({ battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 0, acted: false } });
    banc.getState().battleDisengage();
    expect(banc.getState().pendingDisengage?.phase).toBe('choice');
  }
  const cible = () => banc.getState().pendingDisengage!.def!.target;

  it('disengageRoll : le cavalier esquive à −20 de son homologue à pied', () => {
    ouvrir(false); banc.getState().disengageRoll(); const pied = cible();
    ouvrir(true); banc.getState().disengageRoll(); const monte = cible();
    expect(monte).toBe(pied - 20);
  });

  it('relance par Chance (spec disengage) : même −20', () => {
    ouvrir(true); banc.getState().disengageRoll(); const premier = cible();
    const mover = banc.getState().battle!.combatants.find((c) => c.id === banc.getState().pendingDisengage!.moverId)!;
    mover.fortune = 1;
    FLOWS.disengage.reroll(banc.getState, banc.setState);
    expect(mover.fortune).toBe(0);
    expect(cible()).toBe(premier);
  });
});
