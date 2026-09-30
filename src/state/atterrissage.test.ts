import { describe, it, expect } from 'vitest';
import { emptyScene, setTileCollapsed, surfaceDAtterrissage, type Scene, type Terrain } from './scene';

/**
 * `surfaceDAtterrissage` (LDB 15 l.82) : la plus haute surface MARCHABLE, toutes couches, dont la
 * hauteur ne dépasse pas le départ d'un pas — l'unique réponse à « où atterrit-on ? ».
 */

/** 3×3 ; couche 0 au sol (0 m) ; couche 1 = un tablier de pont à 3 m sur la seule case (1,1). */
function pontScene(): Scene {
  const s = emptyScene(3, 3);
  const tiles = new Array(9).fill('vide') as Terrain[];
  tiles[1 * 3 + 1] = s.layers[0].tiles[0];
  const height = new Array(9).fill(0) as number[];
  height[1 * 3 + 1] = 3;
  s.layers.push({ z: 1, tiles, height });
  return s;
}

describe('surfaceDAtterrissage', () => {
  it('plusieurs couches : on atterrit sur le TABLIER quand on tombe de plus haut', () => {
    expect(surfaceDAtterrissage(pontScene(), 1, 1, 8)).toEqual({ kind: 'surface', to: { x: 1, y: 1, z: 1 }, hauteur: 3 });
  });

  it('plusieurs couches : sous le tablier (départ au sol), on reste au sol', () => {
    expect(surfaceDAtterrissage(pontScene(), 1, 1, 0)).toEqual({ kind: 'surface', to: { x: 1, y: 1, z: 0 }, hauteur: 0 });
  });

  it('hors du tablier : seul le sol porte', () => {
    expect(surfaceDAtterrissage(pontScene(), 0, 0, 8)).toEqual({ kind: 'surface', to: { x: 0, y: 0, z: 0 }, hauteur: 0 });
  });

  it('tuile de tablier EFFONDRÉE : exclue, on atterrit au sol', () => {
    const s = setTileCollapsed(pontScene(), 1, 1, 1);
    expect(surfaceDAtterrissage(s, 1, 1, 8)).toEqual({ kind: 'surface', to: { x: 1, y: 1, z: 0 }, hauteur: 0 });
  });

  it('aucune surface marchable → refus nommé', () => {
    const s = pontScene();
    s.layers[0].tiles[0] = 'mur';
    expect(surfaceDAtterrissage(s, 0, 0, 8)).toEqual({ kind: 'aucune-surface' });
  });
});
