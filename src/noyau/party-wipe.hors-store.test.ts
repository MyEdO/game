/**
 * ANÉANTISSEMENT DU GROUPE HORS COMBAT (`checkPartyWiped`) — la mort existe aussi hors de l'arène.
 * En combat, `checkBattleOver` constate `!heroesAlive` (défaite). Hors combat, ce test verrouille le
 * pendant : groupe entier tombé (faim/agonie…) → écran de défaite (`partyWiped`) + purge des flux
 * suspendus (voyage, repos) ; un survivant → rien ; le chemin de combat reste intact.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { checkPartyWiped } from './partyWipe';
import { emptyScene } from './monde/scene';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const hero = (p: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id: 'h1', label: 'Hilda', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: blessuresDeBase(12, 8), advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4, ...p,
  }) as Combatant);

beforeEach(() => {
  banc.setState({ scene: emptyScene('scene-test', 10, 10) });
});

describe('checkPartyWiped — invariant global hors combat', () => {
  it('groupe ENTIER tombé + voyage/repos suspendus → défaite présentée ET flux purgés', () => {
    banc.setState({
      party: [hero({ dead: true }), hero({ id: 'h2', label: 'Bruno', dead: true })],
      travelPlan: { routeId: 'r', fromPlaceId: 'a', toPlaceId: 'b', mode: 'mer', hoursPerDay: 24, km: 100, kmDone: 10, interrupted: false } as never,
      pendingRest: { places: { bord: true }, quality: 'normale', days: 1, perHero: {}, phase: 'setup' } as never,
    });
    expect(checkPartyWiped(banc.getState, banc.setState)).toBe(true);
    const s = banc.getState();
    expect(s.partyWiped).toBe(true);
    expect(s.travelPlan).toBeNull(); // jamais un écran de défaite SOUS le voyage/le campement
    expect(s.pendingRest).toBeNull();
  });

  it('un héros INCONSCIENT compte comme hors d’action (parité avec la victoire de combat)', () => {
    banc.setState({ party: [hero({ dead: true }), hero({ id: 'h2', label: 'Bruno', conditions: [{ id: 'inconscient', value: 1 }] })] });
    expect(checkPartyWiped(banc.getState, banc.setState)).toBe(true);
    expect(banc.getState().partyWiped).toBe(true);
  });

  it('UN survivant debout → aucune défaite', () => {
    banc.setState({ party: [hero({ dead: true }), hero({ id: 'h2', label: 'Bruno' })] });
    expect(checkPartyWiped(banc.getState, banc.setState)).toBe(false);
    expect(banc.getState().partyWiped).toBe(false);
  });

  it('EN COMBAT : no-op (la défaite reste gérée par checkBattleOver via `battle`)', () => {
    banc.setState({
      party: [hero({ dead: true }), hero({ id: 'h2', label: 'Bruno', dead: true })],
      battle: { combatants: [], order: [], turn: 0, round: 1, log: [] } as never,
    });
    expect(checkPartyWiped(banc.getState, banc.setState)).toBe(false);
    expect(banc.getState().partyWiped).toBe(false);
    expect(banc.getState().battle).not.toBeNull();
  });

  it('au TICK d’entretien (advanceTime) : groupe entier tombé → défaite + purge', () => {
    banc.setState({
      party: [hero({ dead: true }), hero({ id: 'h2', label: 'Bruno', dead: true })],
      pendingRest: { places: { bord: true }, quality: 'normale', days: 1, perHero: {}, phase: 'setup' } as never,
    });
    banc.getState().advanceTime(60);
    expect(banc.getState().partyWiped).toBe(true);
    expect(banc.getState().pendingRest).toBeNull();
  });
});
