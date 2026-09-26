import { describe, it, expect } from 'vitest';
import { buildWalls } from './walls';
import { emptyScene, setDoorOpen, setStructureDown, type Scene, type WallSeg } from '../../state/scene';
import { structureAppearances } from '../../data';

/**
 * GOLDEN de l'assemblage des faces d'arête (#1883) : chaque apparence de `structureAppearance.json`
 * × mur nu / porte fermée / porte ouverte / fenêtre × intact / abattu, lue par la couture publique
 * `buildWalls`. Une retouche du builder qui déplace une face d'une apparence que le geste ne vise pas
 * rougit ici.
 */

type Variante = { nom: string; seg: Partial<WallSeg>; open?: boolean };
const VARIANTES: Variante[] = [
  { nom: 'mur', seg: {} },
  { nom: 'porte-fermee', seg: { door: true, closed: true } },
  { nom: 'porte-ouverte', seg: { door: true }, open: true },
  { nom: 'fenetre', seg: { window: true } },
];

function rendu(appearance: string, v: Variante, down: boolean) {
  let s: Scene = emptyScene(4, 4);
  s.walls = [{ x: 1, y: 1, side: 'N', structure: 'cloture-en-clayonnage', appearance, ...v.seg }];
  if (v.open) s = setDoorOpen(s, 1, 1, 'N', 0, true);
  if (down) s = setStructureDown(s, 1, 1, 'N', 0, true);
  const el = buildWalls(s)[0];
  return { states: el.states, faces: el.faces.map((f) => ({ part: f.material.part, poly: f.poly })) };
}

describe('buildWalls — golden par apparence (#1883)', () => {
  for (const { id } of structureAppearances) {
    it(id, () => {
      const out: Record<string, unknown> = {};
      for (const v of VARIANTES)
        for (const down of [false, true]) out[`${v.nom}|${down ? 'abattu' : 'intact'}`] = rendu(id, v, down);
      expect(out).toMatchSnapshot();
    });
  }
});
