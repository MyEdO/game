import { describe, it, expect } from 'vitest';
import { cityHubServices, cityHubHasPlan, cityHubCanEnterPort } from './CityHubScreen';
import { restServicePrice } from '../state/restFlow';
import { atLocationPlace, poiIcon, type MapPlace, type WorldMap } from '../state/worldMap';
import { findTrappingById } from '../data';
import { toBrass, priceToMoney } from '../engine/money';
import type { LandMarketProfile } from '../engine/landCargo';

/**
 * HUB DE VILLE (#343) — surfaces PURES (comme VoyageScreen.test) : composition des services d'un lieu,
 * porte du hub (`atLocationPlace`) et convergence des prix d'auberge sur le catalogue (`restServicePrice`
 * lit trappings.json — source unique partagée avec `restCost`, cf. rest-lodging-price-source.test).
 */

const market: LandMarketProfile = { taille: 3, richesse: 2, produits: ['commerce'] };

const place = (over: Partial<MapPlace> = {}): MapPlace => ({
  id: 'bogenhafen', label: 'Bögenhafen', pos: { x: 40, y: 30 }, scene: 'sc-bogen', ...over,
});

const townPlace = (): MapPlace => place({
  port: { taille: 4, richesse: 3, production: ['commerce'] } as MapPlace['port'],
  market,
  services: [{ kind: 'auberge', rest: { auberge: true, camp: true } }],
});

const worldMap = (places: MapPlace[]): WorldMap => ({ id: 'w', label: 'Reikland', places, routes: [] });

describe('cityHubServices — composition des services d’un lieu (#343)', () => {
  it('liste port, marché puis auberge, chacun porteur de sa donnée référencée', () => {
    const list = cityHubServices(townPlace());
    expect(list.map((s) => s.id)).toEqual(['port', 'marche', 'auberge']);
    expect(list.find((s) => s.id === 'port')!.category).toBe('port');
    expect(list.find((s) => s.id === 'marche')!.market).toBe(market);
    const auberge = list.find((s) => s.id === 'auberge')!;
    expect(auberge.category).toBe('auberge');
    expect(auberge.rest).toEqual({ auberge: true, camp: true });
  });

  it('lieu sans service ni offre : liste vide (le hub n’a alors rien à ouvrir)', () => {
    expect(cityHubServices(place())).toEqual([]);
  });
});

describe('cityHubHasPlan — porte de l’onglet Plan (#345 phase 5)', () => {
  it('lieu sans POI : pas d’onglet Plan', () => {
    expect(cityHubHasPlan(place())).toBe(false);
  });
  it('lieu avec au moins un POI : onglet Plan', () => {
    expect(cityHubHasPlan(place({ poi: [{ id: 'poi-1', label: 'Auberge', pos: { x: 10, y: 10 }, serviceKind: 'auberge' }] }))).toBe(true);
  });
});

describe('cityHubCanEnterPort — porte du bouton « Entrer au port » (affordance vs no-op silencieux de openPort)', () => {
  it('sans navire de campagne : porte fermée (openPort serait un no-op muet)', () => {
    expect(cityHubCanEnterPort(null)).toBe(false);
    expect(cityHubCanEnterPort(undefined)).toBe(false);
  });
  it('avec un navire de campagne : porte ouverte', () => {
    expect(cityHubCanEnterPort({ vehicleId: 'barge' })).toBe(true);
  });
});

describe('atLocationPlace — porte du hub de ville (#343)', () => {
  const map = worldMap([townPlace()]);
  it('exploration à un lieu de la carte : retourne ce lieu', () => {
    expect(atLocationPlace({ mode: 'exploration', travelPlan: null, worldMap: map, sceneId: 'sc-bogen' })?.id).toBe('bogenhafen');
  });
  it('voyage EN COURS : pas de hub (undefined)', () => {
    expect(atLocationPlace({ mode: 'exploration', travelPlan: {}, worldMap: map, sceneId: 'sc-bogen' })).toBeUndefined();
  });
  it('hors exploration (combat) : pas de hub', () => {
    expect(atLocationPlace({ mode: 'battle', travelPlan: null, worldMap: map, sceneId: 'sc-bogen' })).toBeUndefined();
  });
  it('scène qui n’est PAS un lieu de la carte : pas de hub', () => {
    expect(atLocationPlace({ mode: 'exploration', travelPlan: null, worldMap: map, sceneId: 'ailleurs' })).toBeUndefined();
  });
});

describe('poiIcon — résolution GÉNÉRALE de l’icône d’un marqueur de plan (#371, aucun backfill de donnée)', () => {
  // Un lieu de type ville : le service `temple` (catalogue) porte l'icône `faith/church`, le port
  // `travel/anchor` — la résolution les DÉRIVE de la cible sans que le POI ne redéclare son icône.
  const services = cityHubServices(place({
    port: { taille: 4, richesse: 3, production: ['commerce'] } as MapPlace['port'],
    services: [{ kind: 'temple' }],
  }));

  it('serviceKind sans icon authoré : DÉRIVE l’icône du service résolu (temple → faith/church)', () => {
    expect(poiIcon({ id: 'p', label: 'Temple', pos: { x: 0, y: 0 }, serviceKind: 'temple' }, services)).toBe('faith/church');
  });
  it('serviceKind = port automatique : icône du profil de port (travel/anchor)', () => {
    expect(poiIcon({ id: 'p', label: 'Port', pos: { x: 0, y: 0 }, serviceKind: 'port' }, services)).toBe('travel/anchor');
  });
  it('icon authoré PRIME sur la cible (surcharge d’auteur)', () => {
    expect(poiIcon({ id: 'p', label: 'X', pos: { x: 0, y: 0 }, icon: 'nav/dice', serviceKind: 'temple' }, services)).toBe('nav/dice');
  });
  it('sceneId sans icon : porte (map-tool/door)', () => {
    expect(poiIcon({ id: 'p', label: 'Ailleurs', pos: { x: 0, y: 0 }, sceneId: 'sc-x' }, services)).toBe('map-tool/door');
  });
  it('serviceKind introuvable dans les services résolus : défaut nav/entry-point', () => {
    expect(poiIcon({ id: 'p', label: 'Rien', pos: { x: 0, y: 0 }, serviceKind: 'inconnu' }, services)).toBe('nav/entry-point');
  });
  it('cible absente : défaut nav/entry-point', () => {
    expect(poiIcon({ id: 'p', label: 'Nu', pos: { x: 0, y: 0 } }, services)).toBe('nav/entry-point');
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
