/**
 * Les ponts d'un navire posés dans une scène (#3686, lots 2 et 2b) : les ponts de son TYPE (`PLANS_DE_NAVIRE`) et
 * ce qu'y ajoutent ses Améliorations, compilés par `buildScene`, recopiés à une position, un cap et un étage de la
 * scène hôte. Un pont devient l'étage `z + rang`, ses hauteurs se décalent de `hauteur` ; ses cloisons, portes,
 * échelles et décors tournent avec lui ; ses pièces et ses décors prennent l'id de la pose en préfixe. Le plan
 * d'un type a sa proue à `x = 0`, tribord à `y = 0` : au cap `O`, il se pose tel quel.
 */
import type { NavalTraitRef } from '../engine/types';
import { findNavalTrait } from '../data';
import { CAP_IDENTITE_PROP } from '../data/props.types';
import { rotateDir8 } from '../geometry/dir8';
import { garanti } from '../lib/garanti';
import type { CellSide, Scene, SceneEffectZone, SceneEntity, WallSeg } from './monde/scene';
import { edgeOf, heightAt, porteAuteur, sceneMetresPerTile, tileAt } from './monde/scene';
import { propFootTiles } from './monde/footprint';
import { estAbsent } from './monde/terrain';
import { addLayer, paintHeight, paintTiles, patchWall, setEdgeWall } from './sceneEdit';
import type { MapSpec } from './mapSpec';
import { AMELIORATIONS_DE_LA_CARAQUE, PLAN_DE_LA_CARAQUE } from './planDeLaCaraque';

/** Ce qu'une Amélioration ajoute aux ponts d'un type de navire. */
export type ApportAuxPonts = Pick<MapSpec, 'terrainRects' | 'relief' | 'walls' | 'entities'>;

/** Les ponts d'un type de navire (leur `id` est celui du véhicule), et ce que chacune de ses Améliorations (id de
 *  `naval-traits`) y ajoute. */
interface PlanDeNavire {
  ponts: MapSpec;
  ameliorations: Readonly<Record<string, ApportAuxPonts>>;
}

/** Les plans des types de navire qui en ont. */
const PLANS_DE_NAVIRE: readonly PlanDeNavire[] = [{ ponts: PLAN_DE_LA_CARAQUE, ameliorations: AMELIORATIONS_DE_LA_CARAQUE }];

/** Un navire posé : son type (`ref`, id de véhicule), l'id de la pose (préfixe de ses pièces et décors), la case
 *  hôte du coin nord-ouest de son emprise, son cap (où pointe la proue), l'étage hôte de son pont le plus bas, le
 *  décalage de ses hauteurs (m) et ses Améliorations d'instance. */
export interface PoseDeNavire {
  ref: string;
  id: string;
  x: number;
  y: number;
  cap: CellSide;
  z?: number;
  hauteur?: number;
  upgrades?: NavalTraitRef[];
}

/** Les ponts du type `ref` avec ce qu'y ajoutent les Améliorations `upgrades` ; une Amélioration qui ne change
 *  rien à bord (Bélier, Lissage…) n'y ajoute rien. */
export function pontsDuNavire(ref: string, upgrades: readonly NavalTraitRef[]): MapSpec {
  const plan = garanti(PLANS_DE_NAVIRE.find((p) => p.ponts.id === ref), ref, 'plan de navire');
  return upgrades.reduce<MapSpec>((ponts, { id }) => {
    garanti(findNavalTrait(id), id, 'Amélioration de navire');
    const apport = plan.ameliorations[id];
    if (!apport) return ponts;
    return {
      ...ponts,
      terrainRects: [...(ponts.terrainRects ?? []), ...(apport.terrainRects ?? [])],
      relief: [...(ponts.relief ?? []), ...(apport.relief ?? [])],
      walls: [...(ponts.walls ?? []), ...(apport.walls ?? [])],
      entities: [...(ponts.entities ?? []), ...(apport.entities ?? [])],
    };
  }, plan.ponts);
}

/** Quarts de tour horaires du plan vers l'hôte, par cap. */
const QUARTS: Record<CellSide, number> = { O: 0, N: 1, E: 2, S: 3 };

/** Case hôte de la case (x, y) d'un plan de `w` × `h` au cap `cap` : tribord reste à la droite de la proue. */
function versLHote(cap: CellSide, w: number, h: number): (x: number, y: number) => { x: number; y: number } {
  switch (cap) {
    case 'O': return (x, y) => ({ x, y });
    case 'E': return (x, y) => ({ x: w - 1 - x, y: h - 1 - y });
    case 'N': return (x, y) => ({ x: h - 1 - y, y: x });
    case 'S': return (x, y) => ({ x: y, y: w - 1 - x });
  }
}

/** Le vecteur (x, y) du plan tourné comme `versLHote` en tourne les cases : un quart horaire par quart du cap. */
function tournerLeVecteur(cap: CellSide, v: { x: number; y: number }): { x: number; y: number } {
  let { x, y } = v;
  for (let q = 0; q < QUARTS[cap]; q++) [x, y] = [0 - y, x]; // `0 - y` : jamais de zéro négatif dans la donnée
  return { x, y };
}

/** Les deux cases qu'une arête canonique sépare. */
const casesDeLArete = (w: WallSeg): [{ x: number; y: number }, { x: number; y: number }] =>
  w.side === 'N' ? [{ x: w.x, y: w.y }, { x: w.x, y: w.y - 1 }] : [{ x: w.x, y: w.y }, { x: w.x + 1, y: w.y }];

/** Les champs d'une arête au-delà de sa place. */
function champsDeLArete(w: WallSeg): Partial<WallSeg> {
  const { x: _x, y: _y, side: _side, z: _z, ...champs } = w;
  return champs;
}

/** `hote` avec les ponts de `navire` (la scène compilée de `pontsDuNavire`) posés selon `pose`. */
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
    s = patchWall(setEdgeWall(s, e.x, e.y, e.side, z, porteAuteur(arete) ? 'door' : 'wall'), e.x, e.y, e.side, z, champsDeLArete(arete));
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
  // Un décor garde son emprise : son ancre est le coin nord-ouest de ses cases tournées ; son calage tourne avec le
  // pont (le coffre reste contre la même cloison) et son appui prend le préfixe de la pose.
  const decors: SceneEntity[] = (navire.entities ?? []).map((e) => {
    const cases = propFootTiles(e.ref, e.pos, e.facing, sceneMetresPerTile(navire)).map((c) => versHote(c.x, c.y));
    return {
      ...e,
      id: `${pose.id}-${e.id}`,
      pos: { x: Math.min(...cases.map((c) => c.x)), y: Math.min(...cases.map((c) => c.y)) },
      z: z0 + (e.z ?? 0),
      facing: rotateDir8(e.facing ?? CAP_IDENTITE_PROP, 2 * QUARTS[pose.cap]),
      ...(e.calage ? { calage: tournerLeVecteur(pose.cap, e.calage) } : {}),
      ...(e.sur ? { sur: `${pose.id}-${e.sur}` } : {}),
    };
  });
  return { ...s, effectZones: [...(s.effectZones ?? []), ...pieces], entities: [...s.entities, ...decors] };
}
