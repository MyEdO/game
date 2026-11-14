import { describe, it, expect } from 'vitest';
import { restServicePrice } from './restFlow';
import { placeServices, type MapPlace } from './worldMap';
import { refusAQuai } from './portFlow';
import { t } from '../i18n';
import { findTrappingById } from '../data';
import { toBrass, priceToMoney } from '../engine/money';
import type { LandMarketProfile } from '../engine/landCargo';

/**
 * SERVICES D'UN LIEU (#343) : composition des services d'un lieu, porte d'entrée au port, et convergence des prix
 * d'auberge sur le catalogue (`restServicePrice` lit trappings.json — source unique partagée avec `restCost`,
 * cf. rest-lodging-price-source.test).
 */

const market: LandMarketProfile = { taille: 3, richesse: 2, produits: ['commerce-terre'] };

const place = (over: Partial<MapPlace> = {}): MapPlace => ({
  id: 'bogenhafen', label: 'Bögenhafen', pos: { x: 40, y: 30 }, scene: { id: 'sc-bogen' }, ...over,
});

const townPlace = (): MapPlace => place({
  port: { taille: 4, richesse: 3, production: ['commerce-mer'] } as MapPlace['port'],
  market,
  services: [{ kind: { id: 'auberge' }, rest: { auberge: true, camp: true } }],
});

describe('placeServices — composition des services d’un lieu au hub (#343)', () => {
  it('liste port, marché puis auberge, chacun porteur de sa donnée référencée', () => {
    const list = placeServices(townPlace());
    expect(list.map((s) => s.id)).toEqual(['port', 'marche', 'auberge']);
    expect(list.find((s) => s.id === 'port')!.category).toBe('port');
    expect(list.find((s) => s.id === 'marche')!.market).toBe(market);
    const auberge = list.find((s) => s.id === 'auberge')!;
    expect(auberge.category).toBe('auberge');
    expect(auberge.rest).toEqual({ auberge: true, camp: true });
  });

  it('lieu sans service ni offre : liste vide (le hub n’a alors rien à ouvrir)', () => {
    expect(placeServices(place())).toEqual([]);
  });
});

describe('refusAQuai — le navire de campagne à quai au lieu du groupe (#4214)', () => {
  const carte = { id: 'm', label: 'Mer', places: [{ id: 'S', label: 'Salzenmund', pos: { x: 0, y: 0 } }, { id: 'D', label: 'Dietershafen', pos: { x: 1, y: 0 } }], routes: [] } as never;
  it('sans navire de campagne : refus nommé', () => {
    expect(refusAQuai({ vessel: null, lieu: 'D', worldMap: carte })).toBe(t('port.sansNavire'));
  });
  it('navire à quai au lieu du groupe : aucun refus', () => {
    expect(refusAQuai({ vessel: { vehicleId: 'barge', escale: 'D' } as never, lieu: 'D', worldMap: carte })).toBeNull();
  });
  it.each([['à quai ailleurs', 'S'], ['en mer', undefined]])('navire %s : refus nommé', (_cas, escale) => {
    expect(refusAQuai({ vessel: { vehicleId: 'barge', escale } as never, lieu: 'D', worldMap: carte })).toBe(t('port.pasAQuai'));
  });
});

describe('restServicePrice — prix d’auberge lus au catalogue trappings (source unique, LDB 66 l.12-16)', () => {
  it('chambre privée == trapping "chambre-privee-nuit"', () => {
    expect(toBrass(restServicePrice('privee'))).toBe(toBrass(priceToMoney(findTrappingById('chambre-privee-nuit')!.price)));
  });
  it('chambre commune == trapping "chambre-commune-nuit"', () => {
    expect(toBrass(restServicePrice('commune'))).toBe(toBrass(priceToMoney(findTrappingById('chambre-commune-nuit')!.price)));
  });
  it('repas == trapping "repas-auberge"', () => {
    expect(toBrass(restServicePrice('repas'))).toBe(toBrass(priceToMoney(findTrappingById('repas-auberge')!.price)));
  });
});
