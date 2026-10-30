import { describe, it, beforeEach, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * FOYER UNIQUE du plancher de DR d'un dé forcé en Test OPPOSÉ (`opposedForcedFloor`, #1000) : la
 * garantie « S'il s'agit d'un Test opposé, vous l'emportez avec au moins DR +1 » (LDB 17 l.68) vaut
 * DR de l'opposant + 1, JAMAIS moins de 1 — un opposant au DR NÉGATIF ne peut pas rabaisser la
 * réussite ACHETÉE en dessous de ce que le Point a payé. Sonde sur le Marchandage (LDB 59 l.43), dont
 * l'opposant figé peut afficher un DR négatif ; l'annulation mutuelle (#1000) ne s'y produit jamais
 * (le marchand est figé, aucun verbe ne lui ouvre de forçage).
 */
const TR = (roll: number, target: number, sl: number, success = true) => ({ roll, target, sl, success, isDouble: false });

/** Marchandage forcé par Résilience, dé CHOISI 41 sur cible 45 → DR NATUREL 0 : seul le plancher parle. */
function bargainForcedSL(merchantSL: number): number {
  const hero = combattantDeTest({ id: 'H', label: 'H', kind: 'hero', resilience: 5, fortune: 0, characteristics: {}, skills: [], talents: [], weapons: [], items: [], conditions: [] });
  banc.setState({
    party: [hero],
    pendingBargain: {
      playerId: 'H', merchantId: 'm', playerSkill: 45,
      merchantRoll: TR(20, 50, merchantSL, merchantSL >= 0), roll: TR(45, 45, 0),
    },
  } as never);
  banc.getState().bargainForceSuccess();
  banc.getState().bargainSetForcedRoll(41);
  return banc.getState().pendingBargain!.roll!.sl;
}

describe('#1000 — plancher de la garantie (LDB 17 l.68) : jamais en dessous de DR 1', () => {
  it('marchand au DR NÉGATIF : la réussite achetée garde DR 1 (le −3 ne la tire pas à 0)', () => {
    expect(bargainForcedSL(-3), 'DR −3 → plancher 1, pas −2 ni le DR naturel 0').toBe(1);
  });

  it('marchand au DR 0 : DR 1 (l’emporter d’au moins +1)', () => {
    expect(bargainForcedSL(0)).toBe(1);
  });

  it('marchand au DR 3 : DR 4 (l’emporter d’au moins +1)', () => {
    expect(bargainForcedSL(3)).toBe(4);
  });
});

describe('Victoire IMPOSÉE : le critère de départage la NOMME (`decidedBy: force`)', () => {
  /** Même sonde, mais on lit le CRITÈRE porté par l'issue au lieu du DR. */
  function bargainForcedDecidedBy(merchantSL: number, chooseDie: boolean): string {
    const hero = combattantDeTest({ id: 'H', label: 'H', kind: 'hero', resilience: 5, fortune: 0, characteristics: {}, skills: [], talents: [], weapons: [], items: [], conditions: [] });
    banc.setState({
      party: [hero],
      pendingBargain: {
        playerId: 'H', merchantId: 'm', playerSkill: 45,
        merchantRoll: TR(20, 50, merchantSL, merchantSL >= 0), roll: TR(45, 45, 0),
      },
    } as never);
    banc.getState().bargainForceSuccess();
    if (chooseDie) banc.getState().bargainSetForcedRoll(41);
    return banc.getState().pendingBargain!.result!.decidedBy;
  }

  it('Résilience (dé par défaut) : la victoire est imposée, aucun DR ne l’a tranchée', () => {
    expect(bargainForcedDecidedBy(3, false)).toBe('force');
  });

  it('Résilience (dé CHOISI) : même critère — l’issue ne se réclame pas d’un départage joué', () => {
    expect(bargainForcedDecidedBy(3, true)).toBe('force');
  });
});
