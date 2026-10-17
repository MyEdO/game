import { describe, it, expect } from 'vitest';
import { useGame } from './store';
import type { Combatant } from '../engine/types';

/**
 * FOYER UNIQUE du plancher de DR d'un dé forcé en Test OPPOSÉ (`opposedForcedFloor`, #1000) : la
 * garantie « S'il s'agit d'un Test opposé, vous l'emportez avec au moins DR +1 » (LDB 17 l.68) vaut
 * DR de l'opposant + 1, JAMAIS moins de 1 — un opposant au DR NÉGATIF ne peut pas rabaisser la
 * réussite ACHETÉE en dessous de ce que le Point a payé. Sonde sur le Marchandage (LDB 59 l.43), dont
 * l'opposant figé peut afficher un DR négatif ; l'annulation mutuelle (#1000) ne s'y produit jamais
 * (l'opposant est figé, aucun verbe ne lui ouvre de forçage).
 */
const TR = (roll: number, target: number, sl: number, success = true) => ({ roll, target, sl, success, isDouble: false });

/** Marchandage forcé par Résilience, dé CHOISI 41 sur cible 45 → DR NATUREL 0 : seul le plancher parle. */
function bargainForcedSL(opposantSL: number): number {
  const hero = { id: 'H', label: 'H', name: 'H', kind: 'hero', resilience: 5, fortune: 0, characteristics: {}, skills: [], talents: [], weapons: [], items: [], conditions: [] } as unknown as Combatant;
  useGame.setState({
    party: [hero],
    pendingBargain: {
      playerId: 'H', playerSkill: 45,
      opposantRoll: TR(20, 50, opposantSL, opposantSL >= 0), roll: TR(45, 45, 0),
    },
  } as never);
  useGame.getState().bargainForceSuccess();
  useGame.getState().bargainSetForcedRoll(41);
  return useGame.getState().pendingBargain!.roll!.sl;
}

describe('#1000 — plancher de la garantie (LDB 17 l.68) : jamais en dessous de DR 1', () => {
  it('opposant au DR NÉGATIF : la réussite achetée garde DR 1 (le −3 ne la tire pas à 0)', () => {
    expect(bargainForcedSL(-3), 'DR −3 → plancher 1, pas −2 ni le DR naturel 0').toBe(1);
  });

  it('opposant au DR 0 : DR 1 (l’emporter d’au moins +1)', () => {
    expect(bargainForcedSL(0)).toBe(1);
  });

  it('opposant au DR 3 : DR 4 (l’emporter d’au moins +1)', () => {
    expect(bargainForcedSL(3)).toBe(4);
  });
});

describe('Victoire IMPOSÉE : le critère de départage la NOMME (`decidedBy: force`)', () => {
  /** Même sonde, mais on lit le CRITÈRE porté par l'issue au lieu du DR. */
  function bargainForcedDecidedBy(opposantSL: number, chooseDie: boolean): string {
    const hero = { id: 'H', label: 'H', name: 'H', kind: 'hero', resilience: 5, fortune: 0, characteristics: {}, skills: [], talents: [], weapons: [], items: [], conditions: [] } as unknown as Combatant;
    useGame.setState({
      party: [hero],
      pendingBargain: {
        playerId: 'H', playerSkill: 45,
        opposantRoll: TR(20, 50, opposantSL, opposantSL >= 0), roll: TR(45, 45, 0),
      },
    } as never);
    useGame.getState().bargainForceSuccess();
    if (chooseDie) useGame.getState().bargainSetForcedRoll(41);
    return useGame.getState().pendingBargain!.result!.decidedBy;
  }

  it('Résilience (dé par défaut) : la victoire est imposée, aucun DR ne l’a tranchée', () => {
    expect(bargainForcedDecidedBy(3, false)).toBe('force');
  });

  it('Résilience (dé CHOISI) : même critère — l’issue ne se réclame pas d’un départage joué', () => {
    expect(bargainForcedDecidedBy(3, true)).toBe('force');
  });
});
