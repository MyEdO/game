/**
 * FUITE DE VAPEUR EN CADENCE COMMANDÉE (#1595) — la sauvegarde d'Initiative (`pendingSteamSave`) suspend
 * la journée AVANT son reste (MDG 12 l.326-328) ; le pilote immédiat n'en clôt pas le jour en
 * parallèle : la journée se clôt UNE fois, à la reprise par la sauvegarde (`steamSaveConfirm`).
 */
import { describe, it, expect, vi } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { emptyScene } from './scene';
import { seedBattleRng } from './battleRng';
import { buildSeaPlan, runSeaDay } from './seaVoyageFlow';
import { STEAM_BREAKDOWNS } from '../engine/shipBuild';
import type { WorldMap } from './worldMap';


const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);
const seaMap: WorldMap = {
  id: 'm', label: 'Mer des Griffes',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
    { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b' },
  ],
  routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
};

/** Graine dont la journée commandée lance une « Fuite de vapeur » (MDG 12 l.313-328) aux dés réels. */
const GRAINE = 16;

describe('#1595 — Fuite de vapeur sous ordres : un seul dénouement de la journée', () => {
  it('la journée attend la sauvegarde, puis se clôt une fois', () => {
    expect(STEAM_BREAKDOWNS.some((b) => b.id === 'fuite-de-vapeur')).toBe(true);
    seedBattleRng(GRAINE);
    set({
      party: makePregens().slice(0, 3),
      scene: { ...emptyScene(2, 2), id: 'port-a', label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
      battle: null, worldMap: seaMap, travelPlan: null, travelRecap: null, pendingCrewTest: null, pendingRest: null,
      pendingCascade: null, suspendedCascades: [], pendingSteamSave: null, gameTime: 8 * 60, lastUpkeepDay: 0, journal: [], partyWiped: false,
      vessel: { vehicleId: 'cogue', upgrades: [{ id: 'propulsion-a-vapeur' }], morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
    } as never);
    set({ travelPlan: buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'commande' })! });
    const halte = vi.fn();
    const unsub = useGame.subscribe((s, prev) => { if (s.pendingRest && !prev.pendingRest) halte(); });
    runSeaDay(get, set);
    const save = get().pendingSteamSave;
    expect(save, 'la Fuite de vapeur a ouvert sa sauvegarde').toBeTruthy();
    expect(halte, 'la journée ne se clôt pas sous la sauvegarde en attente').not.toHaveBeenCalled();
    get().steamSaveRoll();
    get().steamSaveConfirm();
    unsub();
    expect(halte, 'la journée se clôt UNE fois, à la reprise').toHaveBeenCalledTimes(1);
  });
});
