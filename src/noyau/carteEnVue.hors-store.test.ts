import { describe, expect, it } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ouvrirLeBanc } from './banc.testkit';
import { trajetsDepuis } from './carteEnVue';
import { placeById, type WorldMap } from './worldMap';
import { scenario as maritime } from '../scenes/test-scenarios/14-voyage-maritime';
import { scenario as fluvial } from '../scenes/test-scenarios/15-commerce-fluvial';
import { scenario as voyage } from '../scenes/test-scenarios/voyage';
import type { Jeu } from './etat';

/** Chaque départ de la route `route` vu depuis le lieu `ici` de la carte `carte`, en mode `mode` (`local` par
 *  défaut) : la cadence de chaque choix, et le geste de chacun de ses modes. */
function departs(carte: WorldMap, route: string, ici: string, mode: Jeu['net']['mode'] = 'local') {
  const banc = ouvrirLeBanc();
  banc.setState({ worldMap: carte, net: { ...banc.getState().net, mode } });
  const tr = trajetsDepuis(banc.getState(), carte, placeById(carte, ici)!).find((x) => x.route === route)!;
  return tr.departs.map((d) => [d.cadence, d.modes.map((m) => m.geste)]);
}

/** La carte du scénario `voyage`, sa grand-route offerte aussi en selle. */
function carteAuxTroisModes(): WorldMap {
  const carte = voyage.construire(idsDeTest).worldMap!;
  return { ...carte, routes: carte.routes.map((r) => (r.id === 'r-grandroute' ? { ...r, modes: ['pied', 'monture', 'diligence'] } : r)) };
}

describe('la cadence au départ d’un trajet (`trajetsDepuis`)', () => {
  const partir = (route: string, mode: string, cadence: string) => ({ verbe: 'partirEnVoyage', args: [route, mode, { cadence }] });

  it('à terre, à pied, en selle et en attelage : un départ par cadence, celle des ordres en premier', () => {
    const modes = ['pied', 'monture', 'diligence'];
    expect(departs(carteAuxTroisModes(), 'r-grandroute', 'p-village')).toEqual([
      ['commande', modes.map((m) => partir('r-grandroute', m, 'commande'))],
      ['jourParJour', modes.map((m) => partir('r-grandroute', m, 'jourParJour'))],
    ]);
  });

  it('en mer : un départ par cadence, celle des ordres en premier', () => {
    const mer = maritime.construire(idsDeTest).worldMap!;
    expect(departs(mer, 'route-marienburg', 'p-salzenmund')).toEqual([
      ['commande', [partir('route-marienburg', 'mer', 'commande')]],
      ['jourParJour', [partir('route-marienburg', 'mer', 'jourParJour')]],
    ]);
  });

  it('au fleuve : un départ par cadence, celle des ordres en premier', () => {
    const fleuve = fluvial.construire(idsDeTest).worldMap!;
    const descente = fleuve.routes.find((r) => r.river)!;
    expect(departs(fleuve, descente.id, descente.a.id).map(([cadence, gestes]) => [cadence, (gestes as { args: unknown[] }[]).find((g) => g.args[1] === 'barge')]), 'la barge').toEqual([
      ['commande', partir(descente.id, 'barge', 'commande')],
      ['jourParJour', partir(descente.id, 'barge', 'jourParJour')],
    ]);
  });

  it('hors mode local, la cadence n’a aucun effet : un seul départ, sans cadence', () => {
    expect(departs(carteAuxTroisModes(), 'r-grandroute', 'p-village', 'hote')).toEqual([
      [null, ['pied', 'monture', 'diligence'].map((m) => ({ verbe: 'partirEnVoyage', args: ['r-grandroute', m] }))],
    ]);
  });
});
