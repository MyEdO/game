/**
 * LA DÉFAITE HORS COMBAT, PAR TOUT PILOTE (#1595) — une séquence close hors combat constate la
 * non-viabilité du groupe (`checkPartyWiped`) AVANT tout dénouement, qu'elle soit pilotée par la modale
 * (`dispatchCascadeDone`) ou par le pilote IMMÉDIAT (`runCascadeImmediate`, cadence commandée). Un
 * groupe entièrement à terre n'ouvre pas son campement : l'écran de défaite prend la main, le voyage et
 * la halte sont purgés.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { buildSeaPlan, runSeaDay, continueSeaDayAfterCascade, resolveShoreLeave } from './seaVoyageFlow';
import { runCascadeImmediate, registerCascadeApplier } from './cascade';
import { checkPartyWiped } from './partyWipe';
import { setCadence, resetCadence } from '../engine/cadence';
import { buildRiverPlan, runRiverDays } from './riverVoyageFlow';
import { creditBourse } from './bourseFlow';
import { seedBattleRng } from './battleRng';
import { emptyScene } from './scene';
import { buildScene } from './mapSpec';
import { createHero, skillCharacteristicById } from '../engine/character';
import { draineCascade } from './cascadeTestKit';
import { fixtureText } from '../i18n/fixtureText';
import type { WorldMap } from './worldMap';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from './pendings';

const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);
type Cadence = 'commande' | 'jour-par-jour';

const aTerre = (party: Combatant[]): Combatant[] => party.map((h) => ({ ...h, conditions: [{ id: 'inconscient', value: 1 }] }));
const issue = () => ({ partyWiped: get().partyWiped, travelPlan: get().travelPlan, pendingRest: get().pendingRest });
const DEFAITE = { partyWiped: true, travelPlan: null, pendingRest: null };

const seaMap: WorldMap = {
  id: 'm', label: 'Mer',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
    { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 3, richesse: 3, production: ['bois'] } },
  ],
  routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
} as never;

function journeeDeMer(cadence: Cadence): void {
  seedBattleRng(1);
  set({
    party: makePregens().slice(0, 3),
    scene: { ...emptyScene(2, 2), id: 'port-a', label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    battle: null, worldMap: seaMap, travelPlan: null, travelRecap: null, pendingCrewTest: null, pendingRest: null,
    pendingCascade: null, suspendedCascades: [], gameTime: 8 * 60, lastUpkeepDay: 0,
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } }, journal: [], partyWiped: false,
  } as never);
  const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0] as never, { cadence })!;
  set({ travelPlan: plan, party: aTerre(get().party) });
  runSeaDay(get, set);
  draineCascade(get, 80);
}

function journeeDeFleuve(cadence: Cadence): void {
  seedBattleRng(7);
  const g = createHero({ speciesId: 'humains-reiklander', careerId: 'batelier', label: 'Gunnar', motivation: 'x', seed: 11, id: 'r-gunnar' });
  for (const [id, adv] of [['ramer', 50], ['voile', 45]] as const) g.skills.push({ id, characteristic: skillCharacteristicById(id), advances: adv } as never);
  const o = createHero({ speciesId: 'humains-reiklander', careerId: 'garde', label: 'Otto', motivation: 'x', seed: 12, id: 'r-otto' });
  get().setParty([g, o]);
  const quai = (id: string, label: string) => buildScene({ id, label, desc: '.', size: [8, 6], terrain: 'planches', heroStart: [2, 3] } as never);
  get().loadProject([quai('quai-a', 'A'), quai('quai-b', 'B')], 'quai-a', {
    id: 'm', label: 'Reik',
    places: [{ id: 'A', label: 'A', pos: { x: 0, y: 0 }, scene: 'quai-a' }, { id: 'B', label: 'B', pos: { x: 90, y: 0 }, scene: 'quai-b' }],
    routes: [{ id: 'r-reik', a: 'A', b: 'B', km: 45, modes: ['barge', 'pied'], river: true, inns: true, perilDie: 0 }],
  } as never);
  set({ travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [], partyWiped: false } as never);
  creditBourse(get, set, get().party[0].id, { gold: 500, silver: 0, brass: 0 });
  const plan = buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0], { cadence })!;
  set({ travelPlan: plan, party: aTerre(get().party) });
  runRiverDays(get, set);
  draineCascade(get, 80);
}

describe('#1595 — un groupe à terre est vaincu, quel que soit le pilote de sa journée', () => {
  for (const cadence of ['commande', 'jour-par-jour'] as const) {
    it(`mer, cadence ${cadence} : défaite, voyage et halte purgés`, () => {
      journeeDeMer(cadence);
      expect(issue()).toEqual(DEFAITE);
    });
    it(`fleuve, cadence ${cadence} : défaite, voyage et halte purgés`, () => {
      journeeDeFleuve(cadence);
      expect(issue()).toEqual(DEFAITE);
    });
  }
});

describe('#1595 — le reste du jour repris après une Fuite de vapeur, sans jet : un groupe à terre est vaincu', () => {
  it('sauvegarde confirmée, aucun Test de reste du jour : défaite, voyage et halte purgés', () => {
    seedBattleRng(1);
    set({
      party: makePregens().slice(0, 3),
      scene: { ...emptyScene(2, 2), id: 'port-a', label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
      battle: null, worldMap: seaMap, travelPlan: null, travelRecap: null, pendingCrewTest: null, pendingRest: null,
      pendingCascade: null, suspendedCascades: [], gameTime: 8 * 60, lastUpkeepDay: 0,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } }, journal: [], partyWiped: false,
    } as never);
    set({ travelPlan: buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0] as never, { cadence: 'commande' })!, party: aTerre(get().party) });
    const h = get().party[0];
    set({ pendingSteamSave: { actorId: h.id, actorName: h.label, skillValue: 40, target: 40, difficulty: 'intermediaire', scaldOps: [], roll: 5, success: true, sl: 3 } });
    get().steamSaveConfirm();
    expect(issue()).toEqual(DEFAITE);
    expect(get().party.flatMap((x) => x.diseases ?? []), 'la clôture du jour s’est jouée avant la défaite').toEqual([]);
  });
});

describe('#1595 — le pilote immédiat s’arrête sur un groupe anéanti EN VOL', () => {
  it('l’étape 1 anéantit le groupe : l’étape 2 n’est jamais appliquée, retour `undefined`', () => {
    set({ battle: null, pendingCascade: null, suspendedCascades: [], partyWiped: false, journal: [], party: makePregens().slice(0, 2) } as never);
    const vus: string[] = [];
    registerCascadeApplier('sondeWipe', (g, s, step) => {
      vus.push(step.id);
      if (step.id === 'a') { s({ party: aTerre(g().party) }); checkPartyWiped(g, s); }
      return undefined;
    });
    const steps: CascadeStep[] = [{ id: 'a', kind: 'sondeWipe', label: fixtureText('A') }, { id: 'b', kind: 'sondeWipe', label: fixtureText('B') }];
    const r = runCascadeImmediate(get, set, steps, { title: 'T', purpose: 'test' });
    expect(get().partyWiped).toBe(true);
    expect(r).toBeUndefined();
    expect(vus).toEqual(['a']);
  });
});

describe('#1595 — relâche à terre résolue sur place : un groupe à terre n’accoste pas', () => {
  afterEach(() => resetCadence());

  it('désertion en surface I, groupe à terre : défaite, et l’accostage n’est jamais finalisé', () => {
    seedBattleRng(1);
    set({
      party: makePregens().slice(0, 3),
      scene: { ...emptyScene(2, 2), id: 'port-a', label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
      battle: null, worldMap: seaMap, travelPlan: null, travelRecap: null, pendingCrewTest: null, pendingRest: null, pendingShoreLeave: null,
      pendingCascade: null, suspendedCascades: [], gameTime: 8 * 60, lastUpkeepDay: 0,
      vessel: { vehicleId: 'cogue', morale: { score: 30, lastMoraleWeek: 0, factors: [] } }, journal: [], partyWiped: false,
    } as never);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0] as never)!;
    set({ travelPlan: { ...plan, kmDone: plan.km - 5, sea: { ...plan.sea!, daysAtSea: 5, milesToday: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    draineCascade(get, 80);
    expect(get().pendingShoreLeave, 'l’accostage attend le choix de relâche').toBeTruthy();

    set({ party: aTerre(get().party) });
    setCadence('rapide');
    resolveShoreLeave(get, set, true);

    expect(get().partyWiped).toBe(true);
    expect(get().journal.some((l) => l.includes('Événement de port')), 'aucun événement de port sous l’écran de défaite').toBe(false);
    expect(get().scene?.id, 'aucune transition vers le port').toBe('port-a');
  });
});
