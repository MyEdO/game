import { describe, expect, it, onTestFinished } from 'vitest';
import { ACTIVITIES, navalPorts, vehicles } from '../data';
import { datasetObject, setDataset, setObjectDataset } from '../data/overrides';
import { schema as schemaActivites } from '../data/schemas/defs/activities';
import type { ActivityDef } from '../engine/activities';
import { CARGO_ENTRIES, type CargoLot } from '../engine/cargo';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { customTrapping, encDeLaCapacite } from '../engine/items';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { imposerLesD100 } from './battleRng.testkit';
import { avanceEtapeCascade, inexplique } from './cascade.testkit';
import type { CampaignVessel } from './etat';
import { emptyScene } from './monde/scene';
import { buildSeaPlan } from './seaVoyageFlow';
import { jouerLaSemaine } from './semaineEnMer.testkit';
import { resolvePortRef, type WorldMap } from './worldMap';

const ACTIVITE = 'entretien-de-test';
const NAVIRE = 'navire-entretien-de-test';
const PORT = 'port-entretien-de-test';
const PIECES = 'pieces-detachees-de-test';
const BOIS = 'bois-mer';
const CHARPENTIER = 'charpentier';
const CONSTRUCTEUR = 'constructeur-de-navires';
const SOURCE_D_ESSAI = { book: 'mer-des-griffes', page: 134 };

const ACTIVITE_D_ESSAI: ActivityDef = {
  id: ACTIVITE, type: 'activities', label: 'Entretien de test',
  source: SOURCE_D_ESSAI, icon: 'voyage/reparer',
  resolver: 'shipMaintenance', contexts: ['mer'],
  tests: [
    { skill: { id: 'metier', spec: CHARPENTIER }, difficulty: 'intermediaire' },
    { skill: { id: 'metier', spec: CONSTRUCTEUR }, difficulty: 'intermediaire' },
  ],
  stake: 'Enjeu du Test.', stakeForm: 'descripteur',
};

function lot(cargoId: string, enc: number): CargoLot {
  return { uid: idsDeTest('it'), cargoId, enc, basePriceGold: 1 };
}

function heros(index: number, spec?: string, pieces = 0) {
  const h = tousLesHerosDeScenario(idsDeTest)[index];
  h.skills = h.skills.filter((s) => s.id !== 'metier');
  if (spec) h.skills.push({ id: 'metier', spec, characteristic: 'dexterite', advances: 25 });
  h.characteristics = { ...h.characteristics, dexterite: 40 };
  const piecesDetachees = Array.from({ length: pieces }, () => ({
    ...customTrapping('Pièces de test', idsDeTest), enc: 1, capabilities: { shipParts: true },
  }));
  h.items = [...(h.items ?? []), ...piecesDetachees];
  return h;
}

type Lieu = 'mer' | 'port' | 'chantier';

function fixture(lieu: Lieu, navire: Partial<CampaignVessel> = {}, party = [heros(0, CHARPENTIER)]) {
  const activitesAvant = [...ACTIVITIES];
  const naviresAvant = [...vehicles];
  const portsAvant = [...navalPorts];
  const cargaisonsAvant = [...CARGO_ENTRIES];
  const navigationAvant = structuredClone(datasetObject('seaNavigation'));
  onTestFinished(() => {
    setDataset('activities', activitesAvant);
    setDataset('vehicles', naviresAvant);
    setDataset('navalPorts', portsAvant);
    setDataset('cargoes', cargaisonsAvant);
    setObjectDataset('seaNavigation', navigationAvant);
  });
  setObjectDataset('seaNavigation', {
    ...navigationAvant,
    reparation: { ...navigationAvant.reparation, piecesEncParTranche: 2, piecesBlessuresParTranche: 5 },
  });
  setDataset('cargoes', [...cargaisonsAvant, {
    id: PIECES, type: 'cargoes', label: 'Pièces de cale de test', source: SOURCE_D_ESSAI,
    voie: 'mer', shipParts: true, price: { printemps: 1, ete: 1, automne: 1, hiver: 1 },
  }]);
  setDataset('activities', [...activitesAvant.filter((a) => a.resolver !== 'shipMaintenance'), ACTIVITE_D_ESSAI]);
  setDataset('vehicles', [...naviresAvant, {
    id: NAVIRE, type: 'vehicles', label: 'Navire d’essai', source: SOURCE_D_ESSAI,
    hull: { char: { endurance: 40, B: 50 }, bodyShape: 'vehicule', propulsion: 'maritime' },
    ship: { crew: 15, manoeuvre: 0, lengthM: 25, capacity: 120, sail: { m: 5, crew: 8, spec: 'cogue' }, traits: [] },
  }]);
  setDataset('navalPorts', [...portsAvant, {
    id: PORT, type: 'naval-ports', label: 'Port d’essai', source: SOURCE_D_ESSAI,
    region: 'Région d’essai', taille: 3, richesse: 3,
    ...(lieu === 'chantier' ? { chantierNavalSpecialise: SOURCE_D_ESSAI } : {}),
  }]);

  const worldMap: WorldMap = {
    id: 'carte', label: 'Mer', places: [
      {
        id: 'A', label: 'Escale', pos: { x: 0, y: 0 }, scene: { id: 'port' },
        port: resolvePortRef({ ref: PORT }),
      },
      { id: 'B', label: 'Destination', pos: { x: 10, y: 0 }, scene: { id: 'destination' } },
    ],
    routes: [{ id: 'route', a: { id: 'A' }, b: { id: 'B' }, km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
  };
  const banc = ouvrirLeBanc({
    graine: 3, cadence: 'manuel', desFixes: true, etat: {
      party,
      scene: { ...emptyScene('port', 2, 2), layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
      worldMap, lieu: 'A', gameTime: 8 * 60,
      vessel: {
        uid: 'navire-essai', vehicleId: NAVIRE, escale: 'A', morale: { score: 75, lastMoraleWeek: 0, factors: [] },
        wounds: { current: 42, max: 50 }, usure: 4,
        criticals: ['Avarie du gréement', 'Avarie du gréement', 'Fêlure de coque'],
        cargo: [lot(PIECES, 35), lot(BOIS, 30)], ...navire,
      },
    },
  });
  const get = banc.getState;
  if (lieu === 'mer') {
    const plan = buildSeaPlan(get, 'route', 'A', 'B', worldMap.routes[0])!;
    banc.setState({
      vessel: { ...get().vessel!, escale: undefined },
      travelPlan: { ...plan, kmDone: 40, sea: { ...plan.sea!, daysAtSea: 7, daysToEvent: 5 } },
    });
    get().reprendreLeVoyage();
    for (let i = 0; i < 40 && !get().pendingSeaActivities && get().pendingCascade; i++) {
      avanceEtapeCascade(get);
      banc.avancer(0);
    }
  } else {
    get().ouvrirEntretienDuNavire();
  }
  return banc;
}

function courant(get: Banc['getState']) {
  const cascade = get().pendingCascade!;
  return cascade.participants[cascade.cursor];
}

function choisir(get: Banc['getState'], choix: string) {
  expect(courant(get).options, 'le choix de travaux est ouvert').toBeDefined();
  avanceEtapeCascade(get, undefined, () => choix);
}

function saisir(get: Banc['getState'], n: number) {
  const etape = courant(get);
  expect(etape.quantity, 'aucun dé pour la saisie de la quantité').toBeDefined();
  expect(etape.target).toBeUndefined();
  get().jetRegler('cascade', 'quantite', n, etape.id);
  avanceEtapeCascade(get);
}

function tester(get: Banc['getState'], de: number) {
  imposerLesD100(de);
  avanceEtapeCascade(get);
}

function entretien(get: Banc['getState'], herosEnEntretien = get().party) {
  expect(get().pendingSeaActivities).not.toBeNull();
  jouerLaSemaine(get, Object.fromEntries(herosEnEntretien.map((h) => [h.id, { activityId: ACTIVITE }])));
  expect(courant(get).kind).toBe('merEntretienChoix');
}

const stock = (get: Banc['getState'], id: string) =>
  (get().vessel!.cargo ?? []).filter((l) => l.cargoId === id).reduce((enc, l) => enc + l.enc, 0);

describe('Entretien du navire (MDG 15 l.302-306)', () => {
  it.each([
    ['mer', CHARPENTIER, -20], ['port', CONSTRUCTEUR, 0], ['chantier', CHARPENTIER, 20],
  ] as const)('applique le modificateur de lieu en %s au Test d’Usure et au Test Critique', (lieu, metier, mod) => {
    const { getState: get } = fixture(lieu, {}, [heros(0, metier)]);
    entretien(get);

    choisir(get, 'usure');
    const usure = courant(get);
    expect(usure.skill?.spec).toBe(metier);
    expect(usure.difficulty).toBe('intermediaire');
    expect(usure.target! - usure.base!).toBe(mod);
    expect(inexplique(usure)).toBe(0);
    tester(get, 98);
    expect(stock(get, PIECES)).toBe(35);
    expect(get().vessel!.usure).toBe(4);

    choisir(get, '0');
    saisir(get, 8);
    const critique = courant(get);
    expect(critique.skill?.spec).toBe(metier);
    expect(critique.difficulty).toBe('difficile');
    expect(critique.target! - critique.base!).toBe(mod - 20);
    expect(inexplique(critique)).toBe(0);
    tester(get, 98);
    expect(stock(get, PIECES)).toBe(35);
    expect(stock(get, BOIS)).toBe(30);
    expect(get().vessel!.criticals).toHaveLength(3);
    choisir(get, 'terminer');
  });

  it('à la huitième journée, restaure seulement l’Usure et débite 25 Enc sur la cale puis les héros', () => {
    const { getState: get } = fixture('mer', { cargo: [lot(PIECES, 23)] }, [heros(0, CHARPENTIER, 5)]);
    entretien(get);
    choisir(get, 'usure');
    tester(get, 1);
    expect(get().vessel!.wounds).toEqual({ current: 46, max: 50 });
    expect(get().travelPlan!.vehicle!.wounds.current).toBe(46);
    expect(get().vessel!.usure ?? 0).toBe(0);
    expect(get().vessel!.criticals).toHaveLength(3);
    expect(stock(get, PIECES)).toBe(0);
    expect(encDeLaCapacite(get().party, 'shipParts')).toBe(3);
    choisir(get, 'terminer');
    expect(get().pendingSeaActivities).toBeNull();
    expect(get().pendingRest).not.toBeNull();
  });

  it('restaure 6 Blessures ordinaires pour 4 Enc sans Test, même sans Métier', () => {
    const { getState: get } = fixture('port', { usure: 2, cargo: [lot(PIECES, 4)] }, [heros(0)]);
    entretien(get);
    choisir(get, 'blessures');
    expect(courant(get).quantity).toMatchObject({ min: 1, max: 8 });
    saisir(get, 6);
    expect(get().vessel!.wounds).toEqual({ current: 48, max: 50 });
    expect(get().vessel!.usure).toBe(2);
    expect(stock(get, PIECES)).toBe(0);
    expect(get().vessel!.criticals).toHaveLength(3);
    choisir(get, 'terminer');
    expect(get().pendingSeaActivities).toBeNull();
    expect(get().pendingRest).toBeNull();
  });

  it('traite chaque occurrence d’un Critique par un Test distinct et consomme le mélange choisi', () => {
    const { getState: get } = fixture('chantier');
    entretien(get);
    choisir(get, '1');
    saisir(get, 8);
    tester(get, 1);
    expect(get().vessel!.criticals).toEqual(['Avarie du gréement', 'Fêlure de coque']);
    expect(stock(get, PIECES)).toBe(27);
    expect(stock(get, BOIS)).toBe(13);
    expect(get().vessel!.wounds!.current).toBe(42);

    choisir(get, '0');
    expect(courant(get).quantity).toMatchObject({ min: 12, max: 24 });
    saisir(get, 12);
    expect(courant(get).difficulty).toBe('difficile');
    tester(get, 1);
    expect(get().vessel!.criticals).toEqual(['Fêlure de coque']);
    expect(stock(get, PIECES)).toBe(15);
    expect(stock(get, BOIS)).toBe(0);
    expect(courant(get).options?.find((o) => o.key === '0')?.refus).toMatch(/bois et des pièces/);
    choisir(get, 'terminer');
  });

  it('ferme avant le jet les travaux qui manquent de Métier, de pièces ou de bois', () => {
    const { getState: get } = fixture('port', { cargo: [lot(PIECES, 2)] }, [heros(0)]);
    entretien(get);
    const options = courant(get).options!;
    expect(options.find((o) => o.key === 'usure')?.refus).toMatch(/25 points/);
    expect(options.find((o) => o.key === '0')?.refus).toMatch(/bois et des pièces/);
    expect(options.find((o) => o.key === 'blessures')?.refus).toBeUndefined();
    choisir(get, 'usure');
    expect(courant(get).kind).toBe('merEntretienChoix');
    expect(courant(get).target).toBeUndefined();
    expect(stock(get, PIECES)).toBe(2);
  });

  it('refuse un Test faute de Métier même lorsque les deux stocks sont disponibles', () => {
    const { getState: get } = fixture('port', {}, [heros(0)]);
    entretien(get);
    const options = courant(get).options!;
    expect(options.find((o) => o.key === 'usure')?.refus).toMatch(/Charpentier/i);
    expect(options.find((o) => o.key === '0')?.refus).toMatch(/Charpentier/i);
  });

  it('refuse l’ouverture sans escale et revalide l’escale avant la consommation', () => {
    const { getState: get, setState: set } = fixture('port');
    entretien(get);
    choisir(get, 'usure');
    set({ vessel: { ...get().vessel!, escale: 'B' } });
    tester(get, 1);
    expect(stock(get, PIECES)).toBe(35);
    expect(get().vessel!.usure).toBe(4);
    expect(get().pendingSeaActivities).toBeNull();
    get().ouvrirEntretienDuNavire();
    expect(get().pendingSeaActivities).toBeNull();
  });

  it('une composition déjà engagée refuse une seconde validation et une modification tardive', () => {
    const { getState: get } = fixture('port');
    entretien(get);
    const cascade = get().pendingCascade;
    const pending = get().pendingSeaActivities;
    const pid = get().party[0].id;

    get().fenetreValider('activitesEnMer');
    expect.soft(get().pendingCascade).toBe(cascade);
    expect.soft(get().pendingSeaActivities).toBe(pending);
    const journal = get().journal;
    expect.soft(journal[journal.length - 1] ?? '').toMatch(/L’action est engagée/);

    get().fenetreChoisir('activitesEnMer', 'activite', null, pid);
    expect(get().pendingSeaActivities?.picks[pid]).toEqual({ activityId: ACTIVITE });

    choisir(get, 'usure');
    tester(get, 1);
    choisir(get, 'terminer');
    expect(get().vessel?.wounds?.current).toBe(46);
    expect(stock(get, PIECES)).toBe(10);
    expect(get().pendingSeaActivities).toBeNull();
  });

  it.each([
    ['tests', { tests: undefined }],
    ['contexts', { contexts: ['voyage'] }],
    ['stake', { stake: undefined, stakeForm: undefined }],
  ] as const)('le catalogue d’Entretien exige %s', (champ, remplacement) => {
    const reference = schemaActivites.safeParse([ACTIVITE_D_ESSAI]);
    expect(reference.error?.issues).toBeUndefined();
    const resultat = schemaActivites.safeParse([{ ...ACTIVITE_D_ESSAI, ...remplacement }]);
    expect(resultat.success).toBe(false);
    if (!resultat.success) expect(resultat.error.issues.map((issue) => issue.path)).toContainEqual([0, champ]);
  });

  it('un catalogue remplacé entre le choix et le Test rend le refus sans consommer', () => {
    const { getState: get } = fixture('port');
    entretien(get);
    const original = [...ACTIVITIES];
    try {
      setDataset('activities', original.map((a) => String(a.id) === ACTIVITE ? { ...a, tests: undefined } : a));
      choisir(get, 'usure');
      expect(get().journal).toContainEqual(expect.stringContaining('L’entretien du navire n’est plus ouvert'));
      expect(courant(get).kind).toBe('merEntretienChoix');
      expect(courant(get).options?.find((o) => o.key === 'usure')?.refus).toBeDefined();
      expect(stock(get, PIECES)).toBe(35);
    } finally {
      setDataset('activities', original);
    }
  });

  it('le deuxième héros reçoit des choix évalués après la dépense du premier', () => {
    const { getState: get } = fixture('port', { cargo: [lot(PIECES, 25)] }, [heros(0, CHARPENTIER), heros(1, CONSTRUCTEUR)]);
    entretien(get);
    choisir(get, 'usure');
    tester(get, 1);
    choisir(get, 'terminer');
    expect(courant(get).actorId).toBe(get().party[1].id);
    expect(courant(get).options?.find((o) => o.key === 'blessures')?.refus).toMatch(/pièces détachées/);
  });
});
