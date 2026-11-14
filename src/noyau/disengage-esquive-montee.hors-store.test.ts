import { idsDeTest } from '../engine/idsDeTest.testkit';
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
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const [E, ...rest] = b.combatants.filter((c) => c.kind === 'ennemi');
    rest.forEach((e) => (e.dead = true));
    H.size = 'moyenne'; E.size = 'moyenne';
    H.engagedWith = [E.id]; E.engagedWith = [H.id];
    if (monte) H.mountId = 'monture-sonde';
    banc.setState({ battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 0, acted: false } });
    banc.getState().rompreLEngagement();
    expect(banc.getState().pendingDisengage?.phase).toBe('choix');
  }
  const cible = () => banc.getState().pendingDisengage!.def!.target;

  it('jetLancer@desengagement : le cavalier esquive à −20 de son homologue à pied', () => {
    ouvrir(false); banc.getState().jetLancer('desengagement'); const pied = cible();
    ouvrir(true); banc.getState().jetLancer('desengagement'); const monte = cible();
    expect(monte).toBe(pied - 20);
  });

  it('relance par Chance (spec disengage) : même −20', () => {
    ouvrir(true); banc.getState().jetLancer('desengagement'); const premier = cible();
    const mover = banc.getState().battle!.combatants.find((c) => c.id === banc.getState().pendingDisengage!.moverId)!;
    mover.fortune = 1;
    FLOWS.desengagement.relancer(banc.getState, banc.setState);
    expect(mover.fortune).toBe(0);
    expect(cible()).toBe(premier);
  });
});
