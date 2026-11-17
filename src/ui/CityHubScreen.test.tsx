import { describe, it, expect } from 'vitest';
import { poiIcon, placeServices, lieuAUnPlan, nomDuPoi, type MapPlace } from '../noyau/worldMap';

/**
 * HUB DE VILLE (#343) — surfaces PURES de présentation : la porte de l'onglet Plan et l'icône d'un marqueur de plan.
 * Les services d'un lieu, la porte du port et les prix d'auberge : `src/noyau/worldMap-services.hors-store.test.ts`.
 */

const place = (over: Partial<MapPlace> = {}): MapPlace => ({
  id: 'bogenhafen', label: 'Bögenhafen', pos: { x: 40, y: 30 }, scene: { id: 'sc-bogen' }, ...over,
});

describe('lieuAUnPlan — porte de l’onglet Plan (#345 phase 5)', () => {
  it('lieu sans POI : pas d’onglet Plan', () => {
    expect(lieuAUnPlan(place())).toBe(false);
  });
  it('lieu avec au moins un POI : onglet Plan', () => {
    expect(lieuAUnPlan(place({ poi: [{ id: 'poi-1', pos: { x: 10, y: 10 }, service: { id: 'auberge' } }] }))).toBe(true);
  });
});

describe('poiIcon — résolution GÉNÉRALE de l’icône d’un marqueur de plan (#371, aucun backfill de donnée)', () => {
  // Un lieu de type ville : le service `temple` (catalogue) porte l'icône `foi/chapelle`, le port
  // `voyage/ancre` — la résolution les DÉRIVE de la cible sans que le POI ne redéclare son icône.
  const services = placeServices(place({
    port: { taille: 4, richesse: 3, production: ['commerce-mer'] } as MapPlace['port'],
    services: [{ id: 'temple', kind: { id: 'temple' } }],
  }));

  it('service sans icon authoré : DÉRIVE l’icône du service résolu (temple → foi/chapelle)', () => {
    expect(poiIcon({ id: 'p', pos: { x: 0, y: 0 }, service: { id: 'temple' } }, services)).toBe('foi/chapelle');
  });
  it('service = port automatique : icône du profil de port (voyage/ancre)', () => {
    expect(poiIcon({ id: 'p', pos: { x: 0, y: 0 }, service: { id: 'port' } }, services)).toBe('voyage/ancre');
  });
  it('icon authoré PRIME sur la cible (surcharge d’auteur)', () => {
    expect(poiIcon({ id: 'p', pos: { x: 0, y: 0 }, icon: 'navigation/des', service: { id: 'temple' } }, services)).toBe('navigation/des');
  });
  it('sceneId sans icon : porte (outil-de-carte/porte)', () => {
    expect(poiIcon({ id: 'p', label: 'Ailleurs', pos: { x: 0, y: 0 }, sceneId: { id: 'sc-x' } }, services)).toBe('outil-de-carte/porte');
  });
  it('service introuvable dans les services résolus : défaut navigation/point-d-entree', () => {
    expect(poiIcon({ id: 'p', pos: { x: 0, y: 0 }, service: { id: 'inconnu' } }, services)).toBe('navigation/point-d-entree');
  });
});

describe('nomDuPoi — le nom d’un point d’intérêt (#4277)', () => {
  const services = placeServices(place({
    port: { taille: 4, richesse: 3, production: ['commerce-mer'] } as MapPlace['port'],
    services: [{ id: 'auberge-du-port', kind: { id: 'auberge' }, label: 'Auberge du Port' }, { id: 'lits-miteux', kind: { id: 'auberge' } }],
  }));

  it('vers un établissement déclaré : le nom de l’établissement, sa surcharge ou le libellé de son type', () => {
    expect([
      nomDuPoi({ id: 'p', pos: { x: 0, y: 0 }, service: { id: 'auberge-du-port' } }, services),
      nomDuPoi({ id: 'q', pos: { x: 0, y: 0 }, service: { id: 'lits-miteux' } }, services),
    ]).toEqual(['Auberge du Port', 'Auberge']);
  });
  it('vers le port automatique : le libellé du catalogue', () => {
    expect(nomDuPoi({ id: 'p', pos: { x: 0, y: 0 }, service: { id: 'port' } }, services)).toBe('Port');
  });
  it('vers une scène : son libellé', () => {
    expect(nomDuPoi({ id: 'p', label: 'La cave', pos: { x: 0, y: 0 }, sceneId: { id: 'sc-x' } }, services)).toBe('La cave');
  });
});
