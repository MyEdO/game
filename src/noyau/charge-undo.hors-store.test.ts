import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState } from './etat';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Annuler une CHARGE (retour playtest) : dans un jeu vidéo, on annule un déplacement et une attaque —
 * on doit pouvoir annuler une charge (manœuvre combinée déplacement + attaque) tant qu'aucun dé n'est
 * lancé (misclic). `attackCancel` restaure alors positions, Mouvement, Avantage (+1 de charge rendu) et
 * `chargedThisTurn`. Une fois le dé lancé (`result` posé), la charge est ENGAGÉE (RAW LDB 15) → pas d'undo.
 */
const chars = { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };

function setup(): void {
  const hero = blessuresSurLeProfil({
    id: 'h', name: 'H', kind: 'hero', characteristics: chars, wounds: blessuresDeBase(20),
    advantage: 1, conditions: [], movement: 4, skills: [], talents: [], traits: [], armour,
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [] }],
    pos: { x: 6, y: 5 }, chargedThisTurn: true, gainedAdvThisRound: true, // état APRÈS la charge
  }) as unknown as Combatant;
  const enemy = blessuresSurLeProfil({
    id: 'e', name: 'E', kind: 'enemy', characteristics: chars, wounds: blessuresDeBase(20),
    advantage: 0, conditions: [], movement: 4, skills: [], talents: [], traits: [], weapons: [], armour, pos: { x: 7, y: 5 },
  }) as unknown as Combatant;
  const battle = {
    combatants: [hero, enemy], order: ['h', 'e'], baseOrder: ['h', 'e'], turn: 0, round: 1, action: null,
    selectedSpellId: null, reachable: new Map(), movementUsed: 4, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({ battle, mode: 'battle' });
}
// État d'AVANT la charge : le héros était en (2,5), Mouvement 0, sans Avantage de charge ni chargedThisTurn.
const chargeUndo = { pos: { h: { x: 2, y: 5 }, e: { x: 7, y: 5 } }, facing: {}, movedPreAction: false, movementUsed: 0, advGained: 1, gainedAdvBefore: false, chargedBefore: false };
const h = () => banc.getState().battle!.combatants.find((c) => c.id === 'h')!;

describe('attackCancel — annuler une charge (déplacement + attaque)', () => {
  it('AVANT le jet : restaure position, Mouvement, Avantage (+1 rendu) et chargedThisTurn', () => {
    setup();
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'e', location: null, result: null, fromCharge: true, chargeUndo } as never });
    banc.getState().attackCancel();
    const s = banc.getState();
    expect(h().pos).toEqual({ x: 2, y: 5 }); // position d'avant la charge
    expect(s.battle!.movementUsed).toBe(0);   // Mouvement rendu
    expect(h().advantage).toBe(0);            // +1 de charge rendu
    expect(h().chargedThisTurn).toBe(false);
    expect(s.pendingAttack).toBeNull();
  });

  it('APRÈS le jet (result posé) : refuse l’annulation (charge engagée, RAW LDB 15)', () => {
    setup();
    const pa = { attackerId: 'h', targetId: 'e', location: null, result: { hit: false } as never, fromCharge: true, chargeUndo } as never;
    banc.setState({ pendingAttack: pa });
    banc.getState().attackCancel();
    expect(banc.getState().pendingAttack).toBe(pa); // inchangé — engagé
    expect(h().pos).toEqual({ x: 6, y: 5 });           // reste au contact
  });
});
