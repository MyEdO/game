import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { currentMarket } from './landMarketFlow';
import { resolvePortRef, type MapPlace, type MarcheDAuteur } from './worldMap';
import { availabilityPct } from '../engine/landCargo';
import { mapPlaceSchema } from '../data/schemas/defs-scenes/worldmap';
import { navalPorts } from '../data';

/** La Taille d'un lieu a un porteur : son port, sinon le lieu ; le marché la lit. MSRC 13 l.44-50 */

const MARCHE: MarcheDAuteur = { richesse: 2, produits: ['vivres'] };
const lieu = (over: Partial<MapPlace>): MapPlace => ({ id: 'l', label: 'Lieu', pos: { x: 0, y: 0 }, scene: { id: 's' }, ...over });

/** Le marché que le jeu ouvre au lieu `place` où se tient le groupe (`currentMarket`). */
function marcheAuLieu(place: MapPlace) {
  const banc = ouvrirLeBanc();
  banc.setState({ worldMap: { id: 'w', label: 'W', places: [place], routes: [] }, lieu: place.id });
  return currentMarket(() => banc.getState())?.market;
}

/** Les chemins des refus que le schéma du lieu oppose à `place`. */
const refus = (place: unknown) => (mapPlaceSchema.safeParse(place).error?.issues ?? []).map((i) => i.path.join('.'));

describe('Taille du lieu (MSRC 13 l.44-50)', () => {
  it('un lieu sans port à Taille 3 : son marché la reçoit (MSRC 13 l.24-26)', () => {
    const market = marcheAuLieu(lieu({ taille: 3, market: MARCHE }));
    expect([market?.taille, market && availabilityPct(market)]).toEqual([3, 50]);
  });

  it('un lieu à port du catalogue : son marché lit la Taille du port', () => {
    const ref = navalPorts.find((p) => p.taille !== 3)!;
    const market = marcheAuLieu(lieu({ port: resolvePortRef({ ref: ref.id }), market: MARCHE }));
    expect([market?.taille, market && availabilityPct(market)]).toEqual([ref.taille, (ref.taille + 2) * 10]);
  });

  it('le schéma refuse la Taille posée avec un port, et un marché sans Taille', () => {
    const port = { ref: navalPorts[0].id };
    expect(refus(lieu({ taille: 3, port: port as MapPlace['port'] }))).toContain('taille');
    expect(refus(lieu({ market: MARCHE }))).toContain('market');
    expect(refus(lieu({ taille: 3, market: MARCHE }))).toEqual([]);
    expect(refus(lieu({ port: port as MapPlace['port'], market: MARCHE }))).toEqual([]);
  });
});
