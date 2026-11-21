import { expect, it, vi } from 'vitest';
import { resetData, setDataset } from '../data/overrides';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { t } from '../i18n';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { ouvrirLeBanc } from './banc.testkit';
import { battleRng, seedBattleRng } from './battleRng';
import { avanceEtapeCascade } from './cascade.testkit';
import { checkBattleOver } from './combatFlow';
import { buildEncounter } from './monde/encounterAuthoring';
import { emptyScene } from './monde/scene';
import { buildSeaPlan, runSeaDay } from './seaVoyageFlow';
import type { WorldMap } from './worldMap';

const carte: WorldMap = {
  id: 'carte-test', label: 'Traversée',
  places: [
    { id: 'A', label: 'Port A', pos: { x: 0, y: 0 }, scene: { id: 'port-a' } },
    { id: 'B', label: 'Port B', pos: { x: 10, y: 0 }, scene: { id: 'port-b' } },
  ],
  routes: [{
    id: 'r1', a: { id: 'A' }, b: { id: 'B' }, km: 550, modes: ['mer'], sea: true, seaHeading: 'est',
    ambush: { scene: { id: 'abordage' }, encounter: 'ecumeurs', at: 0.5 },
  }],
};

const panne = 'Fuite de vapeur du banc';
const lignePanne = t('sv.steamBreakdown', { label: panne });
const prefixeMeteo = t('sv.weatherOfDay', { weather: '§', from: '§', heading: '§' }).split('§')[0];

it.each([
  { voie: 'sans vigie', vapeur: false },
  { voie: 'sans vigie après la sauvegarde de vapeur', vapeur: true },
])('#4184 — $voie : la reprise classe chaque ligne et chaque entrée au jour du combat', ({ vapeur }) => {
  const banc = ouvrirLeBanc();
  const get = banc.getState;
  const set = banc.setState;
  const abordage = emptyScene('abordage', 10, 10);
  const rencontre = buildEncounter({
    id: 'ecumeurs',
    enemies: [{
      statblock: { type: 'statblock', label: 'Écumeur', char: { 'capacite-de-combat': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, B: 8 } },
      pos: { x: 5, y: 5 },
    }],
  });
  abordage.entities.push(...rencontre.entities);
  abordage.encounters = [rencontre.encounter];

  const [heros] = tousLesHerosDeScenario(idsDeTest);
  set({ party: [heros] });
  get().chargerLeProjet({
    scenes: [emptyScene('port-a', 2, 2), emptyScene('port-b', 2, 2), abordage],
    entryId: 'port-a', worldMap: carte, projet: null,
  });
  set({
    party: [{
      ...heros, shipRole: vapeur ? 'capitaine' : 'repos', diseaseImmunities: ['mal-de-mer'],
      ...(vapeur ? { skills: [...(heros.skills ?? []), { id: 'commandement', characteristic: 'sociabilite', advances: 10 }] } : {}),
    }],
    vessel: {
      uid: 'navire-test', vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] },
      ...(vapeur ? { upgrades: [{ id: 'propulsion-a-vapeur' }] } : {}),
    },
    gameTime: 8 * 60, lastUpkeepDay: 0,
  });
  seedBattleRng(7);
  const plan = buildSeaPlan(get, 'r1', 'A', 'B', carte.routes[0], { cadence: 'commande' })!;
  const compteur = 5;
  set({ travelPlan: { ...plan, kmDone: 270 } });

  if (vapeur) {
    setDataset('steamBreakdowns', [{
      id: 'panne-test', min: 1, max: 100, label: panne, desc: 'La chaudière fuit.',
      failDamage: { dice: { n: 1, sides: 10, plus: -5 } },
      source: { book: 'mer-des-griffes', page: 99 },
    }]);
    try {
      const rng = battleRng();
      const tirer = rng.int;
      let premierD100 = true;
      vi.spyOn(rng, 'int').mockImplementation((min, max) => {
        if (min !== 1 || max !== 100 || !premierD100) return tirer(min, max);
        premierD100 = false;
        return 55;
      });
      runSeaDay(get, set);
    } finally {
      vi.restoreAllMocks();
      resetData();
    }
    expect(get().pendingSteamSave?.actorId).toBe(heros.id);
    expect(get().battle).toBeNull();
    get().jetLancer('fuiteDeVapeur');
    get().jetImposerLeResultat('fuiteDeVapeur', 1);
    get().jetValider('fuiteDeVapeur');
  } else {
    runSeaDay(get, set);
  }
  banc.reprendreTout();

  const combat = get().battle;
  expect(combat, 'l’embuscade ancrée ouvre le combat').toBeTruthy();
  const [suspendu] = get().suspendedCascades;
  expect(get().suspendedCascades.map((c) => c.purpose)).toEqual(['travelDay']);
  expect(suspendu.participants.find((etape) => etape.kind === 'equipage-embuscade')?.worldOwner).toBe(true);
  if (!vapeur) expect(suspendu.participants.map((etape) => etape.kind)).toEqual(['equipage-embuscade']);
  const interrompu = get().travelPlan!;
  expect(interrompu.log ?? []).toEqual([]);
  expect(get().vessel?.daysToEvent).toBe(compteur - 1);
  const lignesAuCombat = interrompu.sea!.lines;
  const pvAuCombat = interrompu.procesVerbal ?? [];
  expect(lignesAuCombat.filter((l) => l === t('sv.lookoutKo'))).toHaveLength(1);
  expect(lignesAuCombat.filter((l) => l === lignePanne)).toHaveLength(vapeur ? 1 : 0);
  expect(pvAuCombat.map((e) => e.d?.roll)).toEqual(vapeur ? [55] : []);

  set({ battle: { ...combat!, combatants: combat!.combatants.map((c) => c.kind === 'ennemi' ? { ...c, dead: true } : c) } });
  checkBattleOver(get, set);
  expect(get().pendingVictory).toBeTruthy();
  get().fenetreFermer('victoire');
  banc.reprendreTout();

  const jouerJusquALaHalte = () => {
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      if (get().pendingCascade) avanceEtapeCascade(get);
      else if (get().travelPlan?.interrupted) get().reprendreLeVoyage();
      else break;
      banc.reprendreTout();
    }
    expect(get().pendingRest, 'la journée ouvre sa halte').toBeTruthy();
  };
  jouerJusquALaHalte();
  const premierSoir = get().travelPlan!;
  expect([premierSoir.sea!.daysAtSea, get().vessel?.daysToEvent, premierSoir.log?.length]).toEqual([1, compteur - 1, 1]);
  const [premierJour] = premierSoir.log!;
  const entreesDuPremierJour = premierJour.entries ?? [];
  expect(entreesDuPremierJour.map((e) => e.stake && 'key' in e.stake ? e.stake.key.kind : undefined))
    .toEqual(vapeur ? ['equipage-progression', 'equipage-orientation'] : []);
  expect(entreesDuPremierJour.slice(0, pvAuCombat.length)).toEqual(pvAuCombat);
  expect(premierSoir.procesVerbal ?? []).toEqual([]);
  for (const ligne of new Set(lignesAuCombat)) {
    expect(premierJour.lines.filter((l) => l.text === ligne)).toHaveLength(lignesAuCombat.filter((l) => l === ligne).length);
  }
  expect(premierJour.lines.filter((l) => l.text.startsWith(prefixeMeteo))).toHaveLength(1);

  get().fenetreValider('repos');
  banc.reprendreTout();
  jouerJusquALaHalte();

  const deuxiemeSoir = get().travelPlan!;
  expect([deuxiemeSoir.sea!.daysAtSea, get().vessel?.daysToEvent, deuxiemeSoir.log?.length]).toEqual([2, compteur - 2, 2]);
  const [jourConserve, lendemain] = deuxiemeSoir.log!;
  expect(jourConserve).toEqual(premierJour);
  expect(lendemain.lines.filter((l) => l.text.startsWith(prefixeMeteo))).toHaveLength(1);
  expect(lendemain.lines.filter((l) => l.text === t('sv.lookoutKo') || l.text === lignePanne)).toEqual([]);
  for (const entree of entreesDuPremierJour) expect(lendemain.entries).not.toContainEqual(entree);
});
