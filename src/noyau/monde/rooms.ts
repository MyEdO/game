/**
 * PIÈCE — zone intérieure authorée. Une seule réponse à « quelle pièce contient cette case / ce
 * groupe ? », lue par l'état (navigation d'exploration, accès de pièce) comme par le rendu (toits,
 * dégagement, focus de pièce).
 *
 * ÉTAGE — une pièce vit à l'étage `zone.z` (défaut 0) : ses cases sont celles de `sceneZoneTiles`
 * posées à cet étage (`roomTiles`).
 *
 * CHEVAUCHEMENT — une case appartient à TOUTES les pièces qui la couvrent, dans l'ordre de
 * `scene.effectZones` (`roomsByTile`) : `occupiedRoomIds` les réunit toutes, et
 * `roomFocusAt` rend la PREMIÈRE de cet ordre.
 */
import { isDescriptiveZone, type Scene, type SceneEffectZone } from './scene';
import { tileKey, type Pt } from './path';
import { memoByRef } from './sceneMemo';
import { sceneZoneTiles } from './zones';

export interface RoomFocus {
  id: string;
  z: number;
  tiles: ReadonlySet<string>;
}

export interface RoomTile {
  point: Pt;
  zoneIds: string[];
}

/** Clé d'ESPACE `x,y,z` (z toujours écrit) des ensembles de cases rendus par `roomTilesById`
 *  et `RoomFocus.tiles` — la forme que compare la loi de dégagement (`gameIso/stage/architectureVisibility`). */
const spaceKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

/** Prédicat UNIQUE « zone intérieure » : zone descriptive (`isDescriptiveZone`) déclarée `interior`. */
export function isRoomZone(zone: SceneEffectZone): boolean {
  return isDescriptiveZone(zone) && zone.presentation === 'interior';
}

/** Cases d'une pièce, à son étage. */
export function roomTiles(zone: SceneEffectZone): Pt[] {
  const z = zone.z ?? 0;
  return sceneZoneTiles(zone).map((tile) => (z ? { x: tile.x, y: tile.y, z } : { x: tile.x, y: tile.y }));
}

/** Index case (`tileKey`) → pièces qui la couvrent, dans l'ordre de `scene.effectZones`. */
export const roomsByTile = memoByRef((scene: Scene): ReadonlyMap<string, RoomTile> => {
  const indexed = new Map<string, RoomTile>();
  for (const zone of scene.effectZones ?? []) {
    if (!isRoomZone(zone)) continue;
    for (const point of roomTiles(zone)) {
      const key = tileKey(point.x, point.y, point.z ?? 0);
      const current = indexed.get(key);
      if (current) current.zoneIds.push(zone.id);
      else indexed.set(key, { point, zoneIds: [zone.id] });
    }
  }
  return indexed;
});

/** Cases de chaque pièce, par id, en clés d'espace `x,y,z`. */
export const roomTilesById = memoByRef((scene: Scene): ReadonlyMap<string, ReadonlySet<string>> => {
  const zones = new Map<string, ReadonlySet<string>>();
  for (const zone of scene.effectZones ?? []) {
    if (!isRoomZone(zone)) continue;
    zones.set(zone.id, new Set(roomTiles(zone).map((tile) => spaceKey(tile.x, tile.y, tile.z ?? 0))));
  }
  return zones;
});

const roomIdsAt = (scene: Scene, x: number, y: number, z: number): readonly string[] =>
  roomsByTile(scene).get(tileKey(x, y, z))?.zoneIds ?? [];

/** Pièces occupées par au moins un héros, chacun à sa case visuelle arrondie et à son étage. */
export function occupiedRoomIds(scene: Scene, heroPositions: readonly Pt[]): Set<string> {
  const occupied = new Set<string>();
  for (const hero of heroPositions)
    for (const id of roomIdsAt(scene, Math.round(hero.x), Math.round(hero.y), hero.z ?? 0)) occupied.add(id);
  return occupied;
}

/** Pièce focalisée à la case du groupe : la première qui la couvre (voir CHEVAUCHEMENT). */
export function roomFocusAt(scene: Scene, partyPos: Pt): RoomFocus | null {
  const z = partyPos.z ?? 0;
  const [id] = roomIdsAt(scene, partyPos.x, partyPos.y, z);
  if (id === undefined) return null;
  return { id, z, tiles: roomTilesById(scene).get(id) ?? new Set<string>() };
}
