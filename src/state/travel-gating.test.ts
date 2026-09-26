/**
 * VERROU PAR CONSTRUCTION du gating de carte (#684) — le refus ne vit PAS dans la vue.
 *
 * `routesFrom`/`visiblePlaces` sont des LECTEURS : ils cadrent ce que l'écran propose. Le verrou, lui,
 * est aux deux coutures qui AGISSENT sur la carte, et il tient quel que soit l'appelant (devtools,
 * coop, reprise de sauvegarde, script de recette) :
 *  - `startTravel` refuse une route dont le `when` est faux — AU MÊME NIVEAU que le refus d'une route
 *    prise à contresens (`from`), et la raison d'auteur (`MapRoute.refus`) part au journal ;
 *  - le naufrage n'échoue jamais le groupe sur un lieu que le récit n'a pas révélé (`MapPlace.when`) :
 *    le balayage du rivage passe par `visiblePlaces`, jamais par `map.places` brut.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { beginShipwreck } from './shipwreck';
import { makePregens } from '../data/pregens';
import { emptyScene, type Scene } from './scene';
import { campaignStart } from '../engine/clock';
import type { TravelPlan } from './travelFlow';
import type { WorldMap } from './worldMap';

const get = () => useGame.getState();
const set = useGame.setState;

const scenePlate = (id: string): Scene => {
  const s = emptyScene(6, 6);
  s.id = id;
  s.label = id;
  return s;
};

const REFUS = 'Les gardes ont barré le pont de Bögen.';

/** Trois routes entre les MÊMES deux lieux : l'aller, le retour à contresens, et une jumelle fermable. */
const carte: WorldMap = {
  id: 'ch1',
  label: 'Chapitre 1',
  places: [
    { id: 'pa', label: 'La Diligence', pos: { x: 20, y: 50 }, scene: 'monde-a' },
    { id: 'pb', label: 'Altdorf', pos: { x: 70, y: 40 }, scene: 'monde-b' },
  ],
  routes: [
    { id: 'aller', a: 'pa', b: 'pb', from: 'pa', km: 400, modes: ['pied'], perilDie: 0 },
    { id: 'retour', a: 'pa', b: 'pb', from: 'pb', km: 400, modes: ['pied'], perilDie: 0 },
    {
      id: 'jumelle-fermable',
      a: 'pa',
      b: 'pb',
      from: 'pa',
      km: 400,
      modes: ['pied'],
      perilDie: 0,
      when: { kind: 'not', of: { kind: 'flag', expr: 'ch1-clos' } },
      refus: REFUS,
    },
  ],
};

function auDepart(flags: Record<string, boolean> = {}): void {
  set({
    party: makePregens().slice(0, 3),
    travelPlan: null,
    pendingRest: null,
    pendingCascade: null,
    suspendedCascades: [],
    travelRecap: null,
    battle: null,
  });
  get().loadProject([scenePlate('monde-a'), scenePlate('monde-b')], 'monde-a', carte);
  set({ gameTime: campaignStart(), flags, journal: [] });
}

describe('`startTravel` — le trajet FERMÉ est refusé au départ, au même niveau que le sens interdit', () => {
  beforeEach(() => auDepart());

  it('route prise à CONTRESENS (`from`) : aucun voyage ne démarre', () => {
    get().startTravel('retour', 'pied');
    expect(get().travelPlan).toBeNull();
    expect(get().journal).toEqual([]);
  });

  it('route FERMÉE par le récit (`when` faux) : aucun voyage ne démarre, la raison part au journal', () => {
    auDepart({ 'ch1-clos': true });
    get().startTravel('jumelle-fermable', 'pied');
    expect(get().travelPlan).toBeNull();
    expect(get().journal).toEqual([REFUS]);
  });

  it('la MÊME route, chapitre ouvert : le départ a lieu (le refus vient du `when`, pas de la route)', () => {
    get().startTravel('jumelle-fermable', 'pied');
    expect(get().journal.join('\n')).toContain('Altdorf');
    expect(get().journal.join('\n')).not.toContain(REFUS);
  });
});

const carteNaufrage: WorldMap = {
  id: 'mer',
  label: 'Mer des Griffes',
  places: [
    { id: 'pa', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'monde-a' },
    { id: 'pb', label: 'Erengrad', pos: { x: 100, y: 0 }, scene: 'monde-b' },
    // Le PLUS PROCHE du point de naufrage — mais le récit ne l'a pas révélé.
    {
      id: 'ile-cachee',
      label: 'L’Île aux Cormorans',
      pos: { x: 50, y: 0 },
      scene: 'monde-c',
      when: { kind: 'flag', expr: 'ile-revelee' },
    },
    { id: 'refuge', label: 'La Crique', pos: { x: 56, y: 0 }, scene: 'monde-d' },
  ],
  routes: [{ id: 'rmer', a: 'pa', b: 'pb', km: 100, modes: ['mer'], sea: true, seaHeading: 'est' }],
};

/** Traversée coulée à MI-CHEMIN : le point estimé tombe pile sur l'île cachée. */
function enPleineTraversee(flags: Record<string, boolean> = {}): void {
  const plan: TravelPlan = {
    routeId: 'rmer', fromPlaceId: 'pa', toPlaceId: 'pb', mode: 'mer',
    hoursPerDay: 6, km: 100, kmDone: 50, interrupted: false,
  };
  set({
    party: makePregens().slice(0, 2),
    worldMap: carteNaufrage,
    scene: scenePlate('monde-a'),
    travelPlan: plan,
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, cargo: [] },
    pendingCascade: null,
    suspendedCascades: [],
    journal: [],
    battle: null,
    flags,
  });
}

describe('naufrage — le rivage d’échouage se prend dans les lieux RÉVÉLÉS', () => {
  it('lieu non révélé le plus proche : le groupe s’échoue au lieu VISIBLE suivant', () => {
    enPleineTraversee();
    beginShipwreck(useGame.getState, set);
    const etape = get().pendingCascade!.participants[0];
    expect(String(etape.meta!.shoreId)).toBe('refuge');
  });

  it('lieu révélé : il redevient un rivage possible (le gating est la SEULE différence)', () => {
    enPleineTraversee({ 'ile-revelee': true });
    beginShipwreck(useGame.getState, set);
    const etape = get().pendingCascade!.participants[0];
    expect(String(etape.meta!.shoreId)).toBe('ile-cachee');
  });
});
