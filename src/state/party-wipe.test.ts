/**
 * ANÉANTISSEMENT DU GROUPE HORS COMBAT (`checkPartyWiped`) — la mort existe aussi hors de l'arène.
 * En combat, `checkBattleOver` constate `!heroesAlive` (défaite). Hors combat, ce test verrouille le
 * pendant : groupe entier tombé (faim/agonie…) → écran de défaite (`partyWiped`) + purge des flux
 * suspendus (voyage, repos) ; un survivant → rien ; le chemin de combat reste intact.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { checkPartyWiped } from '../noyau/partyWipe';
import { emptyScene } from '../noyau/monde/scene';
import { seedBattleRng } from '../noyau/battleRng';
import type { Combatant } from '../engine/types';

const hero = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'h1', label: 'Hilda', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 8, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4, ...p,
  } as Combatant);

beforeEach(() => {
  vi.useFakeTimers();
  seedBattleRng(1);
  useGame.setState({ battle: null, partyWiped: false, pendingRest: null, pendingCascade: null, travelPlan: null, scene: emptyScene(10, 10) });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('checkPartyWiped — invariant global hors combat', () => {
  it('groupe ENTIER tombé + voyage/repos suspendus → défaite présentée ET flux purgés', () => {
    useGame.setState({
      party: [hero({ dead: true }), hero({ id: 'h2', label: 'Bruno', dead: true })],
      travelPlan: { routeId: 'r', fromPlaceId: 'a', toPlaceId: 'b', mode: 'mer', hoursPerDay: 24, km: 100, kmDone: 10, interrupted: false } as never,
      pendingRest: { places: { bord: true }, quality: 'normale', days: 1, perHero: {}, phase: 'setup' } as never,
    });
    expect(checkPartyWiped(useGame.getState, useGame.setState)).toBe(true);
    const s = useGame.getState();
    expect(s.partyWiped).toBe(true);
    expect(s.travelPlan).toBeNull(); // jamais un écran de défaite SOUS le voyage/le campement
    expect(s.pendingRest).toBeNull();
  });

  it('un héros INCONSCIENT compte comme hors d’action (parité avec la victoire de combat)', () => {
    useGame.setState({ party: [hero({ dead: true }), hero({ id: 'h2', label: 'Bruno', conditions: [{ id: 'inconscient', value: 1 }] })] });
    expect(checkPartyWiped(useGame.getState, useGame.setState)).toBe(true);
    expect(useGame.getState().partyWiped).toBe(true);
  });

  it('UN survivant debout → aucune défaite', () => {
    useGame.setState({ party: [hero({ dead: true }), hero({ id: 'h2', label: 'Bruno' })] });
    expect(checkPartyWiped(useGame.getState, useGame.setState)).toBe(false);
    expect(useGame.getState().partyWiped).toBe(false);
  });

  it('EN COMBAT : no-op (la défaite reste gérée par checkBattleOver via `battle`)', () => {
    useGame.setState({
      party: [hero({ dead: true }), hero({ id: 'h2', label: 'Bruno', dead: true })],
      battle: { combatants: [], order: [], turn: 0, round: 1, log: [] } as never,
    });
    expect(checkPartyWiped(useGame.getState, useGame.setState)).toBe(false);
    expect(useGame.getState().partyWiped).toBe(false);
    expect(useGame.getState().battle).not.toBeNull();
  });

  it('au TICK d’entretien (advanceTime) : groupe entier tombé → défaite + purge', () => {
    useGame.setState({
      party: [hero({ dead: true }), hero({ id: 'h2', label: 'Bruno', dead: true })],
      pendingRest: { places: { bord: true }, quality: 'normale', days: 1, perHero: {}, phase: 'setup' } as never,
    });
    useGame.getState().advanceTime(60);
    expect(useGame.getState().partyWiped).toBe(true);
    expect(useGame.getState().pendingRest).toBeNull();
  });
});
