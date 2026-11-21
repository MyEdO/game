import { describe, expect, it } from 'vitest';
import { MINUTES_PER_DAY } from '../engine/clock';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { toBrass } from '../engine/money';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { ouvrirLeBanc } from './banc.testkit';
import { creditBourse, partyMoneyTotal } from './bourseFlow';
import { draineCascade } from './cascade.testkit';
import { emptyScene } from './monde/scene';
import type { SeaVoyageState } from './seaVoyageFlow';
import type { WorldMap } from './worldMap';

const navire = (daysToEvent?: number) => ({
  uid: 'cogue-des-pj',
  vehicleId: 'cogue',
  morale: { score: 75, lastMoraleWeek: 0, factors: [] },
  ...(daysToEvent === undefined ? {} : { daysToEvent }),
});

const depart = { id: 'A', label: 'Départ', pos: { x: 0, y: 0 }, scene: { id: 'quai-a' } };
const arrivee = { id: 'B', label: 'Arrivée', pos: { x: 10, y: 0 }, scene: { id: 'quai-b' } };

function monterLeTrajet(route: WorldMap['routes'][number], daysToEvent?: number) {
  const worldMap: WorldMap = {
    id: 'trajets',
    label: 'Trajets',
    places: [depart, { ...arrivee, port: { taille: 3, richesse: 3, production: [] } }],
    routes: [route],
  };
  const banc = ouvrirLeBanc({
    graine: 7,
    etat: {
      worldMap,
      lieu: 'A',
      scene: emptyScene('quai-a', 2, 2),
      gameTime: 8 * 60,
      lastUpkeepDay: 0,
      vessel: navire(daysToEvent),
    },
  });
  banc.getState().fixerLeGroupe(tousLesHerosDeScenario(idsDeTest).slice(0, 3));
  return banc;
}

describe('le délai de l’événement de bord hors des jours de mer détaillés (#4141)', () => {
  it.each([undefined, 3])('sur 800 milles en rapide, une Rude épreuve et un palier couvrent 9 jours (compteur %s)', (daysToEvent) => {
    const banc = monterLeTrajet({ id: 'mer', a: { id: 'A' }, b: { id: 'B' }, km: 800, modes: ['mer'], sea: true, seaHeading: 'est' }, daysToEvent);
    const get = banc.getState;
    const debut = get().gameTime;
    const paliersAppliques = new Set<NonNullable<SeaVoyageState['fast']>>();
    const arreterDObserver = banc.subscribe(({ travelPlan }) => {
      const rapide = travelPlan?.sea?.fast;
      if (rapide?.palierId && rapide.pendingFinalize === false) paliersAppliques.add(rapide);
    });

    get().partirEnVoyage('mer', 'mer', { fast: true });
    const planAuDepart = get().travelPlan?.sea;
    expect(planAuDepart?.fast).toEqual({ days: 9, weeks: 1 });
    expect(planAuDepart?.daysAtSea).toBe(0);
    expect(planAuDepart).not.toHaveProperty('daysToEvent');
    expect(get().vessel?.daysToEvent).toBe(daysToEvent);
    const etapes = draineCascade(get);
    expect(etapes.filter((kind) => kind === 'equipage-voyage-rapide')).toHaveLength(1);
    expect(etapes).not.toContain('mer-evenement-de-bord');
    banc.reprendreTout();
    arreterDObserver();

    const arrive = get();
    const [palier] = [...paliersAppliques];
    expect(paliersAppliques.size).toBe(1);
    expect(palier.result).toBe(palier.roll! - 1 + palier.crewDR! + palier.manannTens!);
    expect(arrive.gameTime - debut).toBe(9 * MINUTES_PER_DAY);
    expect(arrive.pendingShoreLeave).toBeTruthy();
    expect(arrive.travelPlan).toBeNull();
    expect(arrive.vessel?.daysToEvent).toBe(daysToEvent);
  });

  it('le billet de la barge débite le groupe et laisse son propre navire à quai', () => {
    const banc = monterLeTrajet({
      id: 'fleuve', a: { id: 'A' }, b: { id: 'B' }, km: 16, modes: ['barge-fluviale'], river: true,
      billets: { 'barge-fluviale': { prix: { pont: 13 }, depuis: { id: 'A' }, maison: 'Billet du banc' } },
    }, 3);
    const get = banc.getState;
    banc.setState({
      party: get().party.map((hero) => ({ ...hero, skills: [] })),
      vessel: { ...navire(3), escale: 'A' },
    });
    creditBourse(get, banc.setState, get().party[0].id, { gold: 1, silver: 0, brass: 0 });
    const bourse = toBrass(partyMoneyTotal(get));
    const debut = get().gameTime;
    const plans = new Map<string, { mer: boolean; fleuveJoue: boolean }>();
    const arreterDObserver = banc.subscribe(({ travelPlan }) => {
      if (travelPlan) plans.set(travelPlan.mode, { mer: !!travelPlan.sea, fleuveJoue: !!travelPlan.river });
    });

    get().partirEnVoyage('fleuve', 'barge-fluviale', { classeId: 'pont' });
    draineCascade(get);
    banc.reprendreTout();
    arreterDObserver();

    const arrive = get();
    expect(bourse - toBrass(partyMoneyTotal(get))).toBe(3 * 13);
    expect([...plans]).toEqual([['barge-fluviale', { mer: false, fleuveJoue: false }]]);
    expect(arrive.gameTime - debut).toBe(120);
    expect(arrive.lieu).toBe('B');
    expect(arrive.vessel).toMatchObject({ uid: 'cogue-des-pj', escale: 'A', daysToEvent: 3 });
  });
});
