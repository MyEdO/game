/**
 * KIT DE TEST de l'escalade entre deux couches (#4156) : la fixture du plancher grimpable, partagée par la garde de
 * symétrie du pas (`src/scenes/path-symetrie.test.ts`) et l'approche de l'IA
 * (`src/noyau/scenarios/approche-de-l-ia-derriere-un-mur.hors-store.test.ts`).
 */
import { emptyScene, type Scene } from './scene';
import type { Terrain } from '../../data/schemas/defs-scenes/scene';

/** Scène 5×4 : la rangée y=0 portée par un plancher à 4 m sur la couche 1, rien au rez sous lui ; l'arête N de (2,1)
 *  se gravit (`climb` `surface`). LDB 15 l.57. */
export function plancherGrimpable(): Scene {
  const w = 5, h = 4;
  const s = emptyScene('scene-test', w, h);
  const tiles = Array.from({ length: w * h }, (): Terrain => 'vide');
  const height = Array.from({ length: w * h }, () => 0);
  for (let x = 0; x < w; x++) { tiles[x] = 'plancher'; height[x] = 4; s.layers[0].tiles[x] = 'vide'; }
  s.layers.push({ z: 1, tiles, height });
  s.walls = [{ x: 2, y: 1, side: 'N', climb: { kind: 'surface' } }];
  return s;
}
