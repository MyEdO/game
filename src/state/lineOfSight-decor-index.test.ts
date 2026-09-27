import { describe, it, expect } from 'vitest';
import { lineOfSightCover } from './lineOfSight';
import type { Scene, SceneEntity } from './scene';

function scene(w: number, h: number, entities: SceneEntity[]): Scene {
  return {
    id: 's',
    name: 's',
    dimensions: { w, h },
    ambiance: 'jour',
    layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }],
    entities,
    dialogues: [],
    triggers: [],
    encounters: [],
  } as unknown as Scene;
}
const prop = (id: string, ref: string, x: number, y: number): SceneEntity =>
  ({ id, kind: 'prop', pos: { x, y }, ref }) as SceneEntity;

describe('index de décor de la Ligne de Vue (mémoïsé par identité de `scene.entities`)', () => {
  it('deux décors sur la MÊME case : le PREMIER du tableau décide (préséance de l’ordre)', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 2, y: 0 };
    // `arbre` (couvert imparfait, non opaque) posé AVANT `statue` (opaque, couvert total).
    const arbreDAbord = lineOfSightCover(scene(3, 1, [prop('a', 'arbre', 1, 0), prop('s', 'statue', 1, 0)]), from, to, []);
    expect(arbreDAbord).toEqual({ blocked: false, cover: 'imparfaite' });
    // Ordre inverse : la statue décide → case opaque adjacente à la cible → couvert total.
    const statueDAbord = lineOfSightCover(scene(3, 1, [prop('s', 'statue', 1, 0), prop('a', 'arbre', 1, 0)]), from, to, []);
    expect(statueDAbord).toEqual({ blocked: false, cover: 'totale' });
  });

  it('NOUVELLE réf `entities` → l’index est rebâti ; l’ancienne réf garde le sien', () => {
    const sc = scene(3, 1, [prop('a', 'arbre', 1, 0)]);
    const from = { x: 0, y: 0 };
    const to = { x: 2, y: 0 };
    expect(lineOfSightCover(sc, from, to, []).cover).toBe('imparfaite');
    const sc2 = { ...sc, entities: [prop('s', 'statue', 1, 0)] } as Scene;
    expect(lineOfSightCover(sc2, from, to, []).cover).toBe('totale');
    expect(lineOfSightCover(sc, from, to, []).cover).toBe('imparfaite');
  });
});
