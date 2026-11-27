import { describe, expect, it } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ouvrirLeBanc } from './banc.testkit';
import { voyageEnVue } from './voyageEnVue';
import type { RecapEvent, RecapLine } from './recapLine';
import { encounterTable } from '../engine/travelTables';
import { weatherCondition } from '../engine/travelStages';
import { scenario } from '../scenes/test-scenarios/15-commerce-fluvial';

describe('la voie d’un trajet en vue', () => {
  it('un passage payé suit le milieu de son véhicule : la barge descend le fleuve, le marcheur de la même carte tient la route', () => {
    const banc = ouvrirLeBanc();
    const carte = scenario.construire(idsDeTest).worldMap!;
    const voie = (mode: string) => {
      const route = carte.routes.find((r) => r.modes.includes(mode))!;
      banc.setState({ worldMap: carte, travelPlan: { routeId: route.id, fromPlaceId: route.a.id, toPlaceId: route.b.id, mode, departAt: 0, hoursPerDay: 6, km: route.km, kmDone: 12, interrupted: false } });
      return voyageEnVue(banc.getState())!.voie;
    };
    expect([voie('barge-fluviale'), voie('pied')]).toEqual(['fluvial', 'terrestre']);
  });
});

describe('la distance d’un trajet en vue', () => {
  it('à terre, en km exacts : la distance du trajet et la part faite, sans arrondi', () => {
    const banc = ouvrirLeBanc();
    const carte = scenario.construire(idsDeTest).worldMap!;
    const route = carte.routes.find((r) => r.modes.includes('pied'))!;
    banc.setState({ worldMap: carte, travelPlan: {
      routeId: route.id, fromPlaceId: route.a.id, toPlaceId: route.b.id, mode: 'pied', departAt: 0, hoursPerDay: 6, km: 30, kmDone: 24.5, interrupted: false,
    } });
    expect(voyageEnVue(banc.getState())).toMatchObject({ unite: 'km', km: 30, fait: 24.5, mode: { id: 'pied', nom: 'À pied' } });
  });
});

describe('les journées closes d’un trajet en vue (#4574)', () => {
  it('à terre : chaque jour clos en données, ses bornes exactes, sa météo par id et nom sans le jet, ses lignes, ses jets et ses événements avec le dé de leur table', () => {
    const banc = ouvrirLeBanc();
    const carte = scenario.construire(idsDeTest).worldMap!;
    const route = carte.routes.find((r) => r.modes.includes('pied'))!;
    const rencontre = encounterTable('dangereuses')[0];
    const evenement: RecapEvent = {
      source: { table: 'rencontres-dangereuses', id: rencontre.id }, title: rencontre.label, text: rencontre.desc, jet: { naturel: 40, effectif: 40 }, tone: 'echec',
    };
    const ligne: RecapLine = { text: 'Le groupe force l’allure.', tone: 'echec', phase: 'route' };
    banc.setState({ worldMap: carte, travelPlan: {
      routeId: route.id, fromPlaceId: route.a.id, toPlaceId: route.b.id, mode: 'pied', departAt: 0, hoursPerDay: 6, km: 30, kmDone: 24.5, interrupted: false,
      log: [{ kmFrom: 0, kmTo: 12.5, hours: 6.5, lines: [ligne], weather: { id: 'pluie', roll: 77 }, events: [evenement] }],
    } });
    expect(voyageEnVue(banc.getState())!.journees).toEqual([{
      depuis: 0, jusqua: 12.5, heures: 6.5, meteo: { id: 'pluie', nom: weatherCondition('pluie').label },
      lignes: [ligne], evenements: [{ ...evenement, de: { n: 1, sides: 100 } }], entrees: [], mer: null, fleuve: null,
    }]);
  });
});

describe('la cadence d’un trajet en vue', () => {
  const fixer = (cadence: string) => ({ cadence, geste: { verbe: 'fixerLaCadence', args: [cadence] } });
  /** La cadence du trajet à pied de la carte fluviale, ses `orders` posés tels quels, en mode `mode`. */
  function cadence(orders: { cadence: 'commande' | 'jourParJour' } | undefined, mode: 'local' | 'hote' = 'local') {
    const banc = ouvrirLeBanc();
    const carte = scenario.construire(idsDeTest).worldMap!;
    const route = carte.routes.find((r) => r.modes.includes('pied'))!;
    banc.setState({
      worldMap: carte, net: { ...banc.getState().net, mode },
      travelPlan: { routeId: route.id, fromPlaceId: route.a.id, toPlaceId: route.b.id, mode: 'pied', departAt: 0, hoursPerDay: 6, km: route.km, kmDone: 0, interrupted: false, ...(orders ? { orders } : {}) },
    });
    const v = voyageEnVue(banc.getState())!;
    return { joue: v.cadence, gestes: v.cadences };
  }

  const gestes = [fixer('jourParJour'), fixer('commande')];
  it('sous ordres : la cadence jouée, et le geste qui fixe chacune, celle du défaut en premier', () => {
    expect(cadence({ cadence: 'commande' })).toEqual({ joue: 'commande', gestes });
  });

  it('jour par jour : la cadence jouée, et le geste qui fixe chacune', () => {
    expect(cadence({ cadence: 'jourParJour' })).toEqual({ joue: 'jourParJour', gestes });
  });

  it('un plan sans ordres se joue jour par jour', () => {
    expect(cadence(undefined).joue).toBe('jourParJour');
  });

  it('hors mode local, la cadence n’a aucun effet : jour par jour, aucun geste', () => {
    expect(cadence({ cadence: 'commande' }, 'hote')).toEqual({ joue: 'jourParJour', gestes: [] });
  });
});
