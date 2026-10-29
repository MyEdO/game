/**
 * Bénédiction de Chance (LDB 41) : « Votre cible peut relancer le prochain Test auquel elle
 * échoue. Le second résultat doit être conservé. » — drapeau `freeReroll` (ActiveEffect),
 * consommé AU POINT DE RELANCE des flux de jet, sans dépenser de Point de Chance.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { hasActiveFlag } from '../engine/activeFlags';
import { EMPTY_FLOW } from '../engine/flowCore';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function reset() {
  banc.setState({
    screen: 'menu', party: [], scene: null, mode: 'exploration',
    partyPos: { x: 0, y: 0 }, flags: {}, journal: [], dialogue: null, battle: null,
    pendingTest: null, pendingAttack: null, pendingDefense: null, pendingCast: null,
  });
}

function blessedHero(fortune = 0) {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Béni', seed: 5 });
  hero.fortune = fortune;
  hero.activeEffects = [{ label: 'Bénédiction de Chance', bonus: 0, duration: { scale: 'rounds', left: 6 }, freeReroll: true }];
  return hero;
}

function openFailedTest(heroId: string, heroName: string) {
  banc.setState({
    pendingTest: {
      actorId: heroId, actorName: heroName, label: 'Test de Force', skillValue: 50,
      difficulty: 'intermediaire', requireSL: 0, target: 50, roll: null, success: false, sl: 0,
      onSuccess: EMPTY_FLOW, onFailure: EMPTY_FLOW,
    },
  });
  banc.getState().testRoll();
  // Jet propre RATÉ forcé (gate de relance, LDB 12 l.13).
  banc.setState({ pendingTest: { ...banc.getState().pendingTest!, roll: 99, success: false } });
}

describe('Bénédiction de Chance — relance gratuite au point de relance (rollFlow)', () => {
  beforeEach(reset);

  it('fortune 0 + drapeau : la relance marche, consomme le drapeau, pas la Chance', () => {
    const hero = blessedHero(0);
    banc.setState({ party: [hero] });
    openFailedTest(hero.id, hero.label);
    banc.getState().testReroll();
    const h = banc.getState().party[0];
    expect(banc.getState().pendingTest!.rerolled).toBe(true); // relance effectuée
    expect(hasActiveFlag(h, 'freeReroll')).toBe(false); // drapeau consommé
    expect(h.fortune ?? 0).toBe(0); // pas de Chance dépensée
  });

  it('fortune 0 SANS drapeau : la relance reste impossible', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Sec', seed: 6 });
    hero.fortune = 0;
    banc.setState({ party: [hero] });
    openFailedTest(hero.id, hero.label);
    banc.getState().testReroll();
    expect(banc.getState().pendingTest!.rerolled).toBeFalsy();
  });

  it('drapeau ET fortune : le drapeau est consommé d’abord, la Chance est préservée', () => {
    const hero = blessedHero(2);
    banc.setState({ party: [hero] });
    openFailedTest(hero.id, hero.label);
    banc.getState().testReroll();
    const h = banc.getState().party[0];
    expect(h.fortune).toBe(2); // Chance intacte
    expect(hasActiveFlag(h, 'freeReroll')).toBe(false);
    expect(banc.getState().pendingTest!.rerolled).toBe(true);
  });
});
