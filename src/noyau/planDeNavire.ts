/**
 * Les ponts d'un navire posés dans une scène (#3686, lot 2) : les ponts de son TYPE (`PLANS_DE_NAVIRE`), compilés
 * par `buildScene`, recopiés à une position, un cap et un étage de la scène hôte. Un pont devient l'étage
 * `z + rang`, ses hauteurs se décalent de `hauteur` ; ses cloisons, portes et échelles tournent avec lui ; ses
 * pièces prennent l'id de la pose en préfixe. Le plan d'un type a sa proue à `x = 0`, tribord à `y = 0` :
 * au cap `O`, il se pose tel quel.
 */
import type { CellSide, Scene, SceneEffectZone, WallSeg } from './monde/scene';
import { edgeOf, heightAt, tileAt } from './monde/scene';
import { estAbsent } from './monde/terrain';
import { addLayer, paintHeight, paintTiles, patchWall, setEdgeWall } from './sceneEdit';
import type { MapSpec } from './mapSpec';
import { PLAN_DE_LA_CARAQUE } from './planDeLaCaraque';

/** Les ponts de chaque type de navire qui en a, par id de véhicule. */
export const PLANS_DE_NAVIRE: Readonly<Record<string, MapSpec>> = { caraque: PLAN_DE_LA_CARAQUE };

/** Un navire posé : son type (`ref`, id de véhicule), l'id de la pose (préfixe de ses pièces), la case hôte du coin
 *  nord-ouest de son emprise, son cap (où pointe la proue), l'étage hôte de son pont le plus bas et le décalage
 *  de ses hauteurs (m). */
export interface PoseDeNavire {
  ref: string;
  id: string;
  x: number;
  y: number;
  cap: CellSide;
  z?: number;
  hauteur?: number;
}

/** Case hôte de la case (x, y) d'un plan de `w` × `h` au cap `cap` : tribord reste à la droite de la proue. */
function versLHote(cap: CellSide, w: number, h: number): (x: number, y: number) => { x: number; y: number } {
  switch (cap) {
    case 'O': return (x, y) => ({ x, y });
    case 'E': return (x, y) => ({ x: w - 1 - x, y: h - 1 - y });
    case 'N': return (x, y) => ({ x: h - 1 - y, y: x });
    case 'S': return (x, y) => ({ x: y, y: w - 1 - x });
  }
}

/** Les deux cases qu'une arête canonique sépare. */
const casesDeLArete = (w: WallSeg): [{ x: number; y: number }, { x: number; y: number }] =>
  w.side === 'N' ? [{ x: w.x, y: w.y }, { x: w.x, y: w.y - 1 }] : [{ x: w.x, y: w.y }, { x: w.x + 1, y: w.y }];

/** Les champs d'une arête au-delà de sa place et de son état mur/porte. */
function champsDeLArete(w: WallSeg): Partial<WallSeg> {
  const { x: _x, y: _y, side: _side, z: _z, door: _door, ...champs } = w;
  return champs;
}

/** `hote` avec les ponts de `navire` (la scène compilée de son type) posés selon `pose`. */
export function poserLeNavire(hote: Scene, navire: Scene, pose: PoseDeNavire): Scene {
  const { w, h } = navire.dimensions;
  const z0 = pose.z ?? 0;
  const dh = pose.hauteur ?? 0;
  const tourne = versLHote(pose.cap, w, h);
  const versHote = (x: number, y: number) => {
    const p = tourne(x, y);
    return { x: pose.x + p.x, y: pose.y + p.y };
  };
  let s = hote;
  for (const couche of navire.layers) {
    const z = z0 + couche.z;
    s = addLayer(s, z);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const terrain = tileAt(navire, x, y, couche.z);
        if (estAbsent(terrain)) continue;
        const p = versHote(x, y);
        s = paintHeight(paintTiles(s, p, terrain, 1, z), p, heightAt(navire, x, y, couche.z) + dh, 1, z);
      }
  }
  for (const arete of navire.walls ?? []) {
    if (arete.side !== 'N' && arete.side !== 'E') continue;
    const [a, b] = casesDeLArete(arete).map((c) => versHote(c.x, c.y));
    const e = edgeOf(a.x, a.y, b.x, b.y)!;
    const z = z0 + (arete.z ?? 0);
    s = patchWall(setEdgeWall(s, e.x, e.y, e.side, z, arete.door ? 'door' : 'wall'), e.x, e.y, e.side, z, champsDeLArete(arete));
  }
  const pieces: SceneEffectZone[] = (navire.effectZones ?? []).map((zone) => {
    const tiles = (zone.tiles ?? []).map((t) => ({ ...versHote(t.x, t.y), z: z0 + (t.z ?? zone.z ?? 0) }));
    const xs = tiles.map((t) => t.x);
    const ys = tiles.map((t) => t.y);
    const [x, y] = [Math.min(...xs), Math.min(...ys)];
    return {
      ...zone,
      id: `${pose.id}-${zone.id}`,
      area: { kind: 'rect', x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 },
      tiles,
      z: z0 + (zone.z ?? 0),
    };
  });
  return { ...s, effectZones: [...(s.effectZones ?? []), ...pieces] };
}
