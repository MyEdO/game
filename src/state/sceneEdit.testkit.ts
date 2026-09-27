/**
 * KIT DE TEST du POURTOUR bâti — foyer UNIQUE des « murs autour d'un rectangle » des fixtures de plan
 * (#881 : ce sont les MURS qui font l'intérieur, `interiorCells`). Les quatre familles de fixtures qui
 * en avaient besoin (dérivation de masses, compilation `MapSpec`, toitures dérivées, affordances de
 * l'éditeur) composent d'ici, chacune dans sa forme de sortie.
 *
 * Il vit à côté de la primitive qu'il compose (`geometry/arete.ts` : `areteCanonique`, `sceneEdit.ts` : `setEdgeWall`) parce que
 * ses consommateurs s'étalent sur `state/`, `gameIso/` et `ui/editor/` : un kit hébergé chez l'un
 * d'eux redeviendrait le helper local d'un seul. La CANONICALISATION N/E n'est jamais réencodée ici :
 * elle passe par `areteCanonique`/`setEdgeWall`.
 */
import type { Scene, WallSeg } from './scene';
import { setEdgeWall } from './sceneEdit';
import type { CellSide } from '../data/schemas/defs-scenes/communs';
import { areteCanonique, cleArete } from '../geometry/arete';

/** Rectangle de cases d'un plan de fixture (mêmes champs qu'un `ArchitectureRect`). */
export interface PlanRect { x: number; y: number; w: number; h: number }

/** Arêtes BRUTES (côté N/E/S/O vu de la case) du POURTOUR de l'union de `rects` — jamais une arête
 *  interne entre deux rectangles adjacents : le pourtour d'une union en L est celui de la lettre. */
export function perimeterEdges(rects: readonly PlanRect[]): { x: number; y: number; side: CellSide }[] {
  const cells = new Set<string>();
  for (const r of rects)
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) cells.add(`${x},${y}`);
  const has = (x: number, y: number) => cells.has(`${x},${y}`);
  const out: { x: number; y: number; side: CellSide }[] = [];
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    if (!has(x, y - 1)) out.push({ x, y, side: 'N' });
    if (!has(x, y + 1)) out.push({ x, y, side: 'S' });
    if (!has(x - 1, y)) out.push({ x, y, side: 'O' });
    if (!has(x + 1, y)) out.push({ x, y, side: 'E' });
  }
  return out;
}

/** Le MÊME pourtour en segments de stockage `WallSeg` (forme canonique N/E par `areteCanonique`), dédoublonnés. */
export function perimeterWallSegs(rects: readonly PlanRect[], z = 0): WallSeg[] {
  const seen = new Set<string>();
  const out: WallSeg[] = [];
  for (const e of perimeterEdges(rects)) {
    const c = areteCanonique(e.x, e.y, e.side);
    const key = cleArete(c.x, c.y, c.side, z);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...c, ...(z ? { z } : {}) });
  }
  return out;
}

/** Le MÊME pourtour POSÉ sur une scène par la primitive d'édition (`setEdgeWall`) : la pièce close
 *  d'où la toiture et l'enveloppe se dérivent. S'AJOUTE aux murs déjà posés — une pièce de plus ne
 *  défait pas les précédentes. */
export function encloseRect(scene: Scene, r: PlanRect, z = 0): Scene {
  let next = scene;
  for (const e of perimeterEdges([r])) next = setEdgeWall(next, e.x, e.y, e.side, z, 'wall');
  return next;
}
