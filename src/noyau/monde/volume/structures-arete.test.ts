import { describe, it, expect } from 'vitest';
import { edgeAppearance, facadeStructureAppearance, wallApp } from './structures';
import type { FacadeEdge } from '../facades';
import type { WallSeg } from '../scene';

/**
 * #1180 — `edgeAppearance` est la loi d'apparence d'une ARÊTE du rendu web (`wallGeometry`, `walls.ts`), la règle
 * de l'apparence d'arête du noyau (`apparenceDArete`, `noyau/monde/facades`) résolue en sa def.
 */
describe('edgeAppearance — la loi d’arête partagée', () => {
  const facade = (appearance: string): FacadeEdge =>
    ({ bodyId: 'corps', sectionId: 'sud', appearance, features: [] });
  const arete = (seg: Partial<WallSeg> = {}): WallSeg => ({ x: 0, y: 0, side: 'N', ...seg } as WallSeg);

  it('la FAÇADE authorée l’emporte sur l’arête nue', () => {
    expect(edgeAppearance(facade('chapelle'), arete()).id).toBe(facadeStructureAppearance('chapelle').id);
  });

  it('une STRUCTURE posée sur le segment l’emporte sur la façade (bâti physique avant panneau)', () => {
    expect(edgeAppearance(facade('chapelle'), arete({ structure: 'mur-en-pierre' })).id).toBe('mur-en-pierre');
    expect(edgeAppearance(facade('chapelle'), arete({ appearance: 'mur-en-bois' })).id).toBe('mur-en-bois');
  });

  it('sans façade : `wallApp` seul — donc le mur nu quand la carte n’authore rien', () => {
    expect(edgeAppearance(undefined, arete()).id).toBe(wallApp(arete()).id);
    expect(edgeAppearance(undefined, arete()).id).toBe('plain');
    expect(edgeAppearance(undefined, arete({ structure: 'mur-en-bois' })).id).toBe('mur-en-bois');
  });
});
