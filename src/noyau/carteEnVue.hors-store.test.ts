import { describe, expect, it } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ouvrirLeBanc } from './banc.testkit';
import { trajetsDepuis } from './carteEnVue';
import { placeById, type WorldMap } from './worldMap';
import { scenario as maritime } from '../scenes/test-scenarios/14-voyage-maritime';
import { scenario as fluvial } from '../scenes/test-scenarios/15-commerce-fluvial';
import { scenario as voyage } from '../scenes/test-scenarios/voyage';

/** Le geste de chaque mode de la route `route` vue depuis le lieu `ici` de la carte `carte`. */
function departs(carte: WorldMap, route: string, ici: string) {
  const banc = ouvrirLeBanc();
  banc.setState({ worldMap: carte });
  const tr = trajetsDepuis(banc.getState(), carte, placeById(carte, ici)!).find((x) => x.route === route)!;
  return tr.modes.map((m) => m.geste);
}

/** La carte du scénario `voyage`, sa grand-route offerte aussi en selle. */
function carteAuxTroisModes(): WorldMap {
  const carte = voyage.construire(idsDeTest).worldMap!;
  return { ...carte, routes: carte.routes.map((r) => (r.id === 'r-grandroute' ? { ...r, modes: ['pied', 'monture', 'diligence'] } : r)) };
}

describe('le départ d’un trajet (`trajetsDepuis`) : un geste par mode, sans cadence, qui part sous les ordres par défaut', () => {
  const partir = (route: string, mode: string) => ({ verbe: 'partirEnVoyage', args: [route, mode] });

  it('à terre, à pied, en selle et en attelage', () => {
    expect(departs(carteAuxTroisModes(), 'r-grandroute', 'p-village')).toEqual(['pied', 'monture', 'diligence'].map((m) => partir('r-grandroute', m)));
  });

  it('en mer', () => {
    expect(departs(maritime.construire(idsDeTest).worldMap!, 'route-marienburg', 'p-salzenmund')).toEqual([partir('route-marienburg', 'mer')]);
  });

  it('au fleuve', () => {
    const fleuve = fluvial.construire(idsDeTest).worldMap!;
    const descente = fleuve.routes.find((r) => r.river)!;
    expect(departs(fleuve, descente.id, descente.a.id).find((g) => g.args[1] === 'barge-fluviale'), 'la barge').toEqual(partir(descente.id, 'barge-fluviale'));
  });
});
