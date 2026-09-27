/**
 * ÉJECTION DE LA RENCONTRE (`outOfRencontre`) — état de LA rencontre, qui TOMBE avec elle.
 *
 * RAW : « au lieu de mourir, votre Personnage est […] éjecté de l'action ; votre Personnage va
 * survivre […] mais il ne prendra plus part à la rencontre actuelle » (`LDB 17 l.31`), et « La
 * première option vous place hors-jeu, mais vous permet de vous battre à nouveau à un moment
 * ultérieur » (`LDB 17 l.35`).
 *
 * Le drapeau est posé en combat (Destin sacrifié, reddition, homme à la mer) ; le TEARDOWN
 * (`finalizeBattle`, writeback unique vers `party`) le remet à zéro. Sans ça, le héros éjecté restait
 * exclu de tout ce qui filtre le groupe hors combat — dont le QUORUM des ready-checks (nuit de repos)
 * et le carry-in du combat suivant (`startCombat`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { finalizeBattle } from './combatFlow';
import { siegesRequis, quorumAtteint } from './netOwnership';
import { emptyScene } from './scene';
import { createHero } from '../engine/character';
import type { BattleState } from './store';
import type { Combatant } from '../engine/types';

function hero(id: string, label: string): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, seed: 13 });
  h.id = id;
  h.pos = { x: 3, y: 3 };
  return h;
}

/** Combat coop fini : le héros du siège 1 a quitté la rencontre vivant (Destin sacrifié, LDB 17 l.31). */
function combatAvecEjecte() {
  const mien = hero('h1', 'Gunnar');
  const sien = hero('h2', 'Wilhelm');
  const ejecte: Combatant = { ...sien, outOfRencontre: true, exitReason: 'destin' };
  useGame.setState({
    party: [mien, sien], scene: emptyScene(), possessions: [],
    net: { ...useGame.getState().net, mode: 'host', mySeat: 0, ownership: { h1: 0, h2: 1 }, seatNames: { 0: 'L’hôte', 1: 'Antoine' } },
    battle: {
      combatants: [mien, ejecte], order: ['h1', 'h2'], baseOrder: ['h1', 'h2'], turn: 0, round: 4,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
      acted: false, log: [], over: null,
    } as unknown as BattleState,
  });
}

const partyHero = (id: string) => useGame.getState().party.find((h) => h.id === id)!;

beforeEach(() => {
  useGame.setState({ battle: null, net: { ...useGame.getState().net, mode: 'local', mySeat: 0, ownership: {}, seatNames: {} } });
});

describe('fin de rencontre — l’éjection ne survit pas au combat (LDB 17 l.31/l.35)', () => {
  it('après le teardown, plus aucun héros du groupe n’est hors rencontre', () => {
    combatAvecEjecte();
    finalizeBattle(useGame.getState, useGame.setState);
    expect(useGame.getState().party.filter((h) => h.outOfRencontre), 'un héros reste éjecté après la fin du combat').toEqual([]);
    expect(partyHero('h2').exitReason, 'la raison de sortie survit à la rencontre qu’elle décrit').toBeUndefined();
  });

  it('la MORT, elle, se reporte (témoin : le teardown ne blanchit pas tout)', () => {
    combatAvecEjecte();
    useGame.getState().battle!.combatants[1].dead = true;
    finalizeBattle(useGame.getState, useGame.setState);
    expect(partyHero('h2').dead).toBe(true);
  });

  it('le joueur dont le héros a quitté la rencontre est ATTENDU à la nuit de repos (quorum)', () => {
    combatAvecEjecte();
    finalizeBattle(useGame.getState, useGame.setState);
    expect(siegesRequis(useGame.getState()), 'le siège du héros éjecté n’est plus attendu').toEqual([0, 1]);
    expect(quorumAtteint(useGame.getState(), { 0: true }), 'la nuit part sans l’accord du siège 1').toBe(false);
    expect(quorumAtteint(useGame.getState(), { 0: true, 1: true })).toBe(true);
  });

  it('un héros MORT ne retient pas la nuit (le quorum n’attend que les héros en jeu)', () => {
    combatAvecEjecte();
    useGame.getState().battle!.combatants[1].dead = true;
    finalizeBattle(useGame.getState, useGame.setState);
    expect(siegesRequis(useGame.getState())).toEqual([0]);
  });
});
