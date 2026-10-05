/**
 * Harnais QC de cartes (#778) — helpers PURS transformant « chaque pièce accessible » (critère flou)
 * en assertions MÉCANIQUES générales, réutilisables par le test de N'IMPORTE QUELLE scène (`buildScene`).
 * Node-safe (ZÉRO import ui/gameIso). RÉFUTE (échoue si une pièce est murée) plutôt que certifier.
 */
import { walkReachableFrom } from './path';
import { isDescriptiveZone, isWalkable, porteAuteur, setDoorOpen, setDoorRevealed, type Scene, type SceneEffectZone } from './scene';
import { zoneAreaTiles } from './zones';

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

/** Toutes les cases atteignables À PIED depuis `start` (portée illimitée, cross-couche) — léguées par
 *  l'étiquetage des composantes marchables de la scène (`walkReachableFrom`, `path.ts` : la SOURCE
 *  UNIQUE de connectivité, bâtie une fois par scène), plus de parcours propre au harnais. Les clés
 *  portent TOUJOURS leur étage (« x,y,z ») — la convention de ce harnais, pas celle de `path.ts`. */
export function reachableCells(scene: Scene, start: { x: number; y: number; z?: number }): Set<string> {
  const seen = new Set<string>();
  for (const p of walkReachableFrom(scene, start)) seen.add(key(p.x, p.y, p.z ?? 0));
  return seen;
}

/** Cases MARCHABLES d'une zone descriptive (`zoneAreaTiles` 2D, filtrées par `isWalkable` à l'étage
 *  `zone.z ?? 0` de la zone). */
export function zoneWalkableCells(scene: Scene, zone: SceneEffectZone): { x: number; y: number; z: number }[] {
  const z = zone.z ?? 0;
  return zoneAreaTiles(zone.area)
    .filter((p) => isWalkable(scene, p.x, p.y, z))
    .map((p) => ({ x: p.x, y: p.y, z }));
}

/** La scène telle que l'AUTEUR la lit : chaque porte authorée (`porteAuteur`) est un PASSAGE — révélée si
 *  elle est secrète (`EDO 08 l.404`), ouverte si elle est fermée. PUR. */
function sceneSelonAuteur(scene: Scene): Scene {
  return (scene.walls ?? []).filter(porteAuteur).reduce((s, w) => {
    const z = w.z ?? 0;
    return setDoorOpen(setDoorRevealed(s, w.x, w.y, w.side, z, true), w.x, w.y, w.side, z, true);
  }, scene);
}

/** Zones descriptives (pièces nommées, `isDescriptiveZone`) dont AUCUNE case marchable n'est atteignable
 *  depuis `start`, toute porte authorée comprise (`sceneSelonAuteur`) — vide = toutes les pièces nommées sont
 *  accessibles. Une zone SANS aucune case marchable (posée sur du vide) est aussi « inatteignable ». */
export function unreachableDescriptiveZones(scene: Scene, start: { x: number; y: number; z?: number }): SceneEffectZone[] {
  const reached = reachableCells(sceneSelonAuteur(scene), start);
  return (scene.effectZones ?? []).filter(isDescriptiveZone).filter((zone) => {
    const walkable = zoneWalkableCells(scene, zone);
    return !walkable.some((p) => reached.has(key(p.x, p.y, p.z)));
  });
}

/** Étages (`z`) présents dans les cases atteignables depuis `start` — preuve de connexité verticale
 *  (une carte à étages habités z0..zN doit tous les faire apparaître ici). */
export function reachedFloors(scene: Scene, start: { x: number; y: number; z?: number }): Set<number> {
  const out = new Set<number>();
  for (const k of reachableCells(scene, start)) out.add(Number(k.split(',')[2]));
  return out;
}
