/**
 * Harnais QC de cartes (#778) — helpers PURS transformant « chaque pièce accessible » (critère flou)
 * en assertions MÉCANIQUES générales, réutilisables par le test de N'IMPORTE QUELLE scène (`buildScene`).
 * Node-safe (aucun import d'hôte). RÉFUTE (échoue si une pièce est murée) plutôt que certifier.
 */
import { walkComponentAt, walkComponentsFrom, walkReachableFrom } from './monde/path';
import { champsDuPlan, isDescriptiveZone, isWalkable, porteAuteur, setDoorOpen, setDoorRevealed, type Scene, type SceneEffectZone } from './monde/scene';
import { memoByRef, memoByRefDeps } from './monde/sceneMemo';
import { versionDesDatasets } from '../data/versionDataset';
import { sceneZoneTiles } from './monde/zones';

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

/** Cases MARCHABLES d'une zone descriptive : son emprise (`sceneZoneTiles`), filtrée par `isWalkable` à
 *  l'étage de chaque case. */
export function zoneWalkableCells(scene: Scene, zone: SceneEffectZone): { x: number; y: number; z: number }[] {
  return sceneZoneTiles(zone)
    .map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 }))
    .filter((p) => isWalkable(scene, p.x, p.y, p.z));
}

/** La scène telle que l'AUTEUR la lit : chaque porte authorée (`porteAuteur`) est un PASSAGE — révélée si
 *  elle est secrète (`EDO 08 l.404`), ouverte si elle est fermée. PUR. */
const sceneSelonAuteur = memoByRef((scene: Scene): Scene =>
  (scene.walls ?? []).filter(porteAuteur).reduce((s, w) => {
    const z = w.z ?? 0;
    return setDoorOpen(setDoorRevealed(s, w.x, w.y, w.side, z, true), w.x, w.y, w.side, z, true);
  }, scene));

/** Zones descriptives (pièces nommées, `isDescriptiveZone`) dont AUCUNE case marchable n'est atteignable
 *  depuis `start`, toute porte authorée comprise (`sceneSelonAuteur`) — vide = toutes les pièces nommées sont
 *  accessibles. Une zone SANS aucune case marchable (posée sur du vide) est aussi « inatteignable ». */
export function unreachableDescriptiveZones(scene: Scene, start: { x: number; y: number; z?: number }): readonly SceneEffectZone[] {
  return zonesInatteignables(scene.layers, [versionDesDatasets(), ...champsDuPlan(scene), start.x, start.y, start.z ?? 0], () => zonesInatteignablesDepuis(scene, start));
}

/** Mémo de `unreachableDescriptiveZones` (`memoByRefDeps`), même clé et mêmes dépendances que les défauts de plan
 *  (`scenePlanDefects`), plus le départ : une écriture non spatiale ne refait pas la connexité. */
const zonesInatteignables = memoByRefDeps<Scene['layers'], readonly SceneEffectZone[]>();

function zonesInatteignablesDepuis(scene: Scene, start: { x: number; y: number; z?: number }): SceneEffectZone[] {
  const vue = sceneSelonAuteur(scene);
  const composantes = walkComponentsFrom(vue, start);
  const atteinte = (p: { x: number; y: number; z: number }) => {
    if (p.x === start.x && p.y === start.y && p.z === (start.z ?? 0)) return true;
    const c = walkComponentAt(vue, p.x, p.y, p.z);
    return c !== null && composantes.has(c);
  };
  return (scene.effectZones ?? []).filter(isDescriptiveZone).filter((zone) => !zoneWalkableCells(scene, zone).some(atteinte));
}

/** Étages (`z`) présents dans les cases atteignables depuis `start` — preuve de connexité verticale
 *  (une carte à étages habités z0..zN doit tous les faire apparaître ici). */
export function reachedFloors(scene: Scene, start: { x: number; y: number; z?: number }): Set<number> {
  const out = new Set<number>();
  for (const k of reachableCells(scene, start)) out.add(Number(k.split(',')[2]));
  return out;
}
