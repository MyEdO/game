import { describe, it, expect } from 'vitest';
import { placeServices, nomDuPoi, type MapPlace } from './worldMap';

const place = (over: Partial<MapPlace> = {}): MapPlace => ({
  id: 'bogenhafen', label: 'Bögenhafen', pos: { x: 40, y: 30 }, scene: { id: 'sc-bogen' }, ...over,
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
