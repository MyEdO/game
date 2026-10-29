import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { emptyScene, type Scene } from './monde/scene';
import type { Terrain } from '../data/schemas/defs-scenes/scene';
import { poserLeGroupe } from './marcheDuGroupe';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Déplacement d'exploration z-aware : le groupe peut fouler une case d'une couche SUPÉRIEURE (tablier
 * `plancher` posé sur le « vide »), et `partyPos` porte alors son `z`. `moveParty` est gardé par la
 * marchabilité de la couche visée (`isWalkable(scene, x, y, z)`) : une case « vide » d'étage se refuse.
 * La hauteur métrique de la surface n'empêche pas de la fouler — seule sa marchabilité compte.
 */
function twoLayerScene(): Scene {
  const s = emptyScene('scene-test', 4, 4); // couche 0 : herbe marchable, 0 m
  const w = 4;
  const z1 = new Array(w * 4).fill('vide') as Terrain[];
  const h1 = new Array(w * 4).fill(0) as number[];
  z1[1 * w + 1] = 'plancher'; // une case de tablier marchable…
  h1[1 * w + 1] = 4; // …perchée à 4 m (surface porteuse : on peut s'y tenir)
  s.layers.push({ z: 1, tiles: z1, height: h1 });
  return s;
}

describe('exploration z-aware : moveParty', () => {
  beforeEach(() =>
    banc.setState({ mode: 'exploration', battle: null, dialogue: null, scene: twoLayerScene(), partyPos: { x: 0, y: 0 }, party: [] }),
  );

  it('foule une case de tablier (plancher, 4 m) → partyPos porte z=1', () => {
    poserLeGroupe(banc.getState, banc.setState, { x: 1, y: 1, z: 1 });
    expect(banc.getState().partyPos).toEqual({ x: 1, y: 1, z: 1 });
  });

  it('refuse une case « vide » d’étage (rien à fouler)', () => {
    poserLeGroupe(banc.getState, banc.setState, { x: 2, y: 2, z: 1 });
    expect(banc.getState().partyPos).toEqual({ x: 0, y: 0 }); // inchangé
  });

  it('un déplacement au SOL reste byte-identique (partyPos sans z)', () => {
    poserLeGroupe(banc.getState, banc.setState, { x: 3, y: 3 });
    expect(banc.getState().partyPos).toEqual({ x: 3, y: 3 });
  });
});
