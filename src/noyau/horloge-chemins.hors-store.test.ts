/**
 * #668, #2817 D7 — chaque chemin RÉEL qui avance l'horloge hors `advanceTime` (nuit du joueur `restFlow`,
 * voyages terrestre `travelFlow`, fluvial `riverVoyageFlow` et en mer `seaVoyageFlow`) passe par l'écrivain
 * unique `avancerLHorloge` : une échéance de l'échéancier narratif armée avant le chemin tire quand le flux
 * franchit sa borne.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyEffects } from './combatEffects';
import { flowFromEffects } from './monde/flow';
import { emptyScene, type Scene } from './monde/scene';
import type { WorldMap } from './worldMap';
import { seedBattleRng } from './battleRng';
import { makePregens } from '../data/pregens';
import { createHero, skillCharacteristicById } from '../engine/character';
import { creditBourse } from './bourseFlow';
import { buildScene } from './mapSpec';
import { fixtureText } from '../i18n/fixtureText';
import { campaignStart } from '../engine/clock';
import { draineCascade } from './cascade.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const get = () => banc.getState();
const set: Banc['setState'] = (e) => banc.setState(e);

/** Arme UNE échéance (`delayedEffect`, une heure plus tard) qui pose le drapeau `echeance`. */
function armeLEcheance(): number {
  applyEffects(get, set, [{ type: 'delayedEffect', afterMinutes: 60, flow: flowFromEffects([{ type: 'setFlag', flag: 'echeance' }]) }]);
  expect(get().scheduledEffects, 'l’échéance n’est pas armée').toHaveLength(1);
  return get().gameTime;
}

function attendQueLEcheanceTire(t0: number): void {
  expect(get().gameTime - t0, 'le chemin n’a pas franchi la borne').toBeGreaterThanOrEqual(60);
  expect(get().flags.echeance, 'l’échéance n’a pas tiré sur l’avance du chemin').toBe(true);
  expect(get().scheduledEffects).toHaveLength(0);
}

function scene(id: string): Scene {
  const s = emptyScene('scene-test', 10, 10); s.id = id; s.label = id; return s;
}

describe('l’horloge des chemins réels tire l’échéancier (#668)', () => {
  it('nuit du joueur (`restFlow`) : la modale de repos, Dormir, puis la cascade de nuit tirent l’échéance', () => {
    set({ party: makePregens().slice(0, 1), scene: emptyScene('scene-test', 10, 10), gameTime: campaignStart() + 20 * 60 });
    const t0 = armeLEcheance();
    get().openRest({ lieu: fixtureText('Ici'), places: { camp: true } });
    get().restSleep();
    expect(get().pendingRest, 'Dormir a été refusé').toBeNull();
    draineCascade(get, 30);
    attendQueLEcheanceTire(t0);
  });

  it('voyage terrestre (`travelFlow`) : la marche du jour tire l’échéance', () => {
    const carte: WorldMap = {
      id: 'c', label: 'c',
      places: [
        { id: 'pa', label: 'A', pos: { x: 20, y: 50 }, scene: 'lieu-a' },
        { id: 'pb', label: 'B', pos: { x: 70, y: 40 }, scene: 'lieu-b' },
      ],
      routes: [{ id: 'r1', a: 'pa', b: 'pb', km: 12, modes: ['pied'], perilDie: 0 }],
    };
    set({ party: makePregens().slice(0, 1) });
    get().loadProject({ scenes: [scene('lieu-a'), scene('lieu-b')], entryId: 'lieu-a', worldMap: carte, projet: null });
    set({ gameTime: campaignStart(), flags: {}, scheduledEffects: [] });
    const t0 = armeLEcheance();
    get().startTravel('r1', 'pied');
    attendQueLEcheanceTire(t0);
  });

  it('voyage fluvial (`riverVoyageFlow`) : la journée en barge tire l’échéance', () => {
    const gunnar = createHero({ speciesId: 'humains-reiklander', careerId: 'batelier', label: 'Gunnar', motivation: 'x', seed: 11, id: 'r-gunnar' });
    for (const [id, advances, spec] of [['ramer', 50, undefined], ['voile', 45, 'chaland']] as const) {
      const sk = gunnar.skills.find((x) => x.id === id && (x.spec ?? null) === (spec ?? null));
      if (sk) sk.advances = Math.max(sk.advances, advances);
      else gunnar.skills.push({ id, spec, characteristic: skillCharacteristicById(id), advances } as never);
    }
    const reik: WorldMap = {
      id: 'm', label: 'Le Reik',
      places: [
        { id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: 'quai-a' },
        { id: 'B', label: 'Altdorf', pos: { x: 90, y: 0 }, scene: 'quai-b' },
      ],
      routes: [{ id: 'r-reik', a: 'A', b: 'B', km: 45, modes: ['barge', 'pied'], river: true, inns: true, perilDie: 0 }],
    };
    const quai = (id: string) => buildScene({ id, label: id, desc: '.', size: [8, 6], terrain: 'planches', heroStart: [2, 3] });
    seedBattleRng(7);
    get().setParty([gunnar]);
    get().loadProject({ scenes: [quai('quai-a'), quai('quai-b')], entryId: 'quai-a', worldMap: reik, projet: null });
    set({ travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [], flags: {}, scheduledEffects: [] });
    creditBourse(get, set, gunnar.id, { gold: 500, silver: 0, brass: 0 });
    const t0 = armeLEcheance();
    get().startTravel('r-reik', 'barge', { cadence: 'jour-par-jour' });
    draineCascade(get, 30);
    attendQueLEcheanceTire(t0);
  });

  it('journée de mer (`seaVoyageFlow`) : la traversée jusqu’au crépuscule tire l’échéance', () => {
    const mer: WorldMap = {
      id: 'm', label: 'Mer des Griffes',
      places: [
        { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
        { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 3, richesse: 3, production: ['bois'] } },
      ],
      routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
    };
    set({
      party: makePregens().slice(0, 3), worldMap: mer, gameTime: 8 * 60, lastUpkeepDay: 0, suspendedCascades: [], pendingCrewTest: null,
      scene: { ...emptyScene('port-a', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
    } as never);
    const t0 = armeLEcheance();
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    draineCascade(get, 30);
    attendQueLEcheanceTire(t0);
  });
});
