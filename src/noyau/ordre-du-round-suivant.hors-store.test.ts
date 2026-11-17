import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { advanceTurn, ordreDuRoundSuivant } from './combatFlow';
import { createHero } from '../engine/character';
import { seedBattleRng } from './battleRng';
import { setRule } from '../engine/policy';
import { testScene } from '../scenes/test-fixture';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Le combat `enc-mutants` ouvert, le héros promu en tête du Round 1 (« Agir en premier », LDB 17 l.25), le Round lancé. */
function ouvrirApresLaPromotion(): string {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero] });
  banc.getState().lancerLaScene(testScene());
  seedBattleRng(777);
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreChoisir('debutDuRound', 'promouvoir', hero.id);
  banc.getState().fenetreValider('debutDuRound');
  banc.abandonner();
  return hero.id;
}

/** Le Round franchi par `advanceTurn`, depuis le dernier tour du Round courant. */
function franchirLeRound(): void {
  const b = banc.getState().battle!;
  banc.setState({ battle: { ...b, turn: b.order.length - 1 } });
  advanceTurn(banc.getState, banc.setState);
}

describe('ordreDuRoundSuivant — l’ordre que le Round suivant jouera (LDB 17 l.22-25)', () => {
  it('l’ordre canonique, qui agit en dernier rejeté en fin : exactement l’ordre que `advanceTurn` installe', () => {
    const heros = ouvrirApresLaPromotion();
    const b = banc.getState().battle!;
    expect(b.order[0], 'témoin : le héros promu ouvre le Round 1').toBe(heros);
    expect(b.baseOrder![0], 'témoin : l’ordre canonique ne l’ouvre pas').not.toBe(heros);
    const dernier = b.baseOrder![0];
    banc.setState({ battle: { ...b, combatants: b.combatants.map((c) => (c.id === dernier ? { ...c, actLastNextRound: true } : c)) } });
    const prevu = ordreDuRoundSuivant(banc.getState().battle!);
    expect(prevu, 'l’ordre canonique, celui qui agit en dernier rejeté en fin').toEqual([...b.baseOrder!.filter((id) => id !== dernier), dernier]);
    franchirLeRound();
    expect(banc.getState().battle!.order, 'le Round suivant joue l’ordre annoncé').toEqual(prevu);
  });

  it('sous la relance d’Initiative à chaque Round, l’ordre n’est pas tiré', () => {
    setRule('combat-relancer-initiative', true);
    ouvrirApresLaPromotion();
    expect(ordreDuRoundSuivant(banc.getState().battle!)).toBeNull();
  });
});
