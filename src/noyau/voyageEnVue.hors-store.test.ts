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
