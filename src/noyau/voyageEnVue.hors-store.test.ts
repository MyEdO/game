import { describe, expect, it } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ouvrirLeBanc } from './banc.testkit';
import { voyageEnVue } from './voyageEnVue';
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
    expect([voie('barge'), voie('pied')]).toEqual(['fluvial', 'terrestre']);
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

  const gestes = [fixer('commande'), fixer('jourParJour')];
  it('sous ordres : la cadence jouée, et le geste qui fixe chacune, celle des ordres en premier', () => {
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
