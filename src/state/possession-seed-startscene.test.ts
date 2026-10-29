/**
 * Semis des Possessions de dotation au démarrage d'une partie neuve (#617/#618 SOCLE POSSESSIONS
 * Lot 1) — seam `startScene` (`noyau/entreeEnScene.ts`), JAMAIS `loadGame` (la save restaure `data.possessions`).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useGame } from './store';
import { seedStartingPossessions } from '../noyau/possessionsFlow';
import { createHero } from '../engine/character';
import { emptyScene } from '../noyau/monde/scene';
import type { Possession } from '../engine/possession';
import type { Combatant } from '../engine/types';
import type { GameState } from './store';
import type { Get, Set } from '../noyau/flowTypes';
import { poserLeLocalStorage } from '../lib/stockage.testkit';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';

/** Harnais MINIMAL (get/set) — même patron que `possessionsFlow.test.ts`. */
function makeHarness(party: Combatant[], possessions: Possession[] = []): { get: Get; set: Set } {
  let state = { party, possessions, flags: {}, gameTime: 0, log: () => {}, net: { ownership: {} as Record<string, number> } } as unknown as GameState;
  const get: Get = () => state;
  const set: Set = (p) => { state = { ...state, ...(typeof p === 'function' ? p(state) : p) }; };
  return { get, set };
}

describe('Semis de Possessions — startScene (#617/#618 Lot 1)', () => {
  beforeEach(() => {
    poserLeLocalStorage();
    vi.useFakeTimers();
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('dotation {vehicleId} (contrebandier niv.2 → barque-fluviale, careerLevels.json) → possession vehicule avec-le-groupe, owner = héros', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'contrebandier', label: 'Contreb.', seed: 1 });
    hero.careerLevel = 2; // la dotation barque-fluviale est portée par ce Niveau, pas le 1
    useGame.getState().setParty([hero]);
    const sc = emptyScene('scene-test', 6, 6);
    sc.id = 'test-seed-vehicule';
    useGame.getState().startScene(sc);
    const { possessions } = useGame.getState();
    const vehicule = possessions.find((p) => p.nature === 'vehicule');
    expect(vehicule).toBeDefined();
    expect(vehicule).toMatchObject({
      nature: 'vehicule', vehicleId: 'barque-fluviale', ownerId: hero.id, location: { kind: 'avec-le-groupe' }, items: [],
    });
  });

  it("héros sans carrière (party fixture nue) → aucun crash, aucune possession semée", () => {
    const lead = combattantDeTest({ id: 'lead', label: 'L', xp: 0 });
    useGame.getState().setParty([lead]);
    const sc = emptyScene('scene-test', 5, 5);
    sc.id = 'test-seed-sans-carriere';
    useGame.getState().startScene(sc);
    expect(useGame.getState().possessions).toHaveLength(0);
  });

  it('loadGame NE redéclenche PAS le semis — la save fait foi, jamais de doublon (#617/#618 §3)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'contrebandier', label: 'Contreb.', seed: 1 });
    hero.careerLevel = 2;
    useGame.getState().setParty([hero]);
    const sc = emptyScene('scene-test', 6, 6);
    sc.id = 'test-seed-loadgame';
    useGame.getState().startScene(sc);
    expect(useGame.getState().possessions).toHaveLength(1); // semé UNE fois par startScene
    vi.clearAllTimers();
    expect(useGame.getState().saveGame(1)).toBe(true);
    // Simule un rechargement (état vidé, groupe reformé) puis loadGame — la save restaure le
    // registre TEL QUEL, aucun re-semis ne doit s'y ajouter.
    useGame.setState({ party: [], possessions: [], scene: null });
    expect(useGame.getState().loadGame(1)).toBe(true);
    expect(useGame.getState().possessions).toHaveLength(1);
  });

  it("anti-double-semis : héros ayant DÉJÀ une possession au registre n'est pas re-semé", () => {
    const hero = combattantDeTest({ id: 'h1', career: 'contrebandier', careerLevel: 2 });
    const existing: Possession = {
      uid: 'pos-1', ownerId: 'h1', nature: 'vehicule', vehicleId: 'chariot-leger', location: { kind: 'avec-le-groupe' }, items: [],
    };
    const { get, set } = makeHarness([hero], [existing]);
    seedStartingPossessions(get, set);
    expect(get().possessions).toHaveLength(1); // toujours 1 : aucun 2e semis pour ce héros
  });
});
