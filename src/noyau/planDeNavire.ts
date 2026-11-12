/**
 * Les ponts d'un navire posés dans une scène (#3686) : le navire est l'entité `personnage` dont le `vehicule` est un
 * véhicule à plan des ponts (`PLANS_DE_NAVIRE`), le combattant qu'il est en mer. Dans une scène à l'échelle de son
 * plan (`sceneMetresPerTile`), les ponts de son TYPE et ce qu'y ajoutent ses Améliorations (`pontsDuNavire`),
 * compilés par `buildScene`, se recopient centrés sur son empreinte de combattant (`footprintN`, coin nord-ouest à sa
 * `pos`), à son cap (`facing`, cardinal) et à son étage (`z`). Un pont devient l'étage `z + rang`, à ses hauteurs ;
 * ses cloisons, portes, échelles et décors tournent avec lui ; ses pièces et ses décors prennent l'id du navire en
 * préfixe. Le plan d'un type a sa proue à `x = 0`, tribord à `y = 0` : au cap `O`, il se pose tel quel. Les ponts
 * se dérivent au chargement d'une scène en jeu (`poserLesNavires`, `registerScene`) et dans la vue de l'éditeur
 * (`vueDeLaScene`), qui les pose (`poserUnNavire`) ; ce qu'ils posent garde le
 * navire d'où il vient (`provenanceDesNavires`), que l'hôte montre par le modèle 3D de son type posé au centre de
 * ses ponts (`naviresDeLaScene`), le repère du plan étant celui du modèle (`pontsDeLaFiche.ts`) ; l'occupant d'une
 * case que ce modèle rogne s'y tient au centre de son emprise libre (`stationsDuNavire`, #3767).
 */
import type { NavalTraitRef } from '../engine/types';
import { findNavalTrait, findVehicleById } from '../data';
import { nextEntityId } from '../lib/entityId';
import { vehicleCombatant } from '../engine/vehicle';
import type { Terrain } from '../data/schemas/defs-scenes/scene';
import { CAP_IDENTITE_PROP } from '../data/props.types';
import { DIR4_ORDER, estCardinal, rotateDir8, type Dir4 } from '../geometry/dir8';
import { garanti } from '../lib/garanti';
import type { Scene, SceneDuVolume, SceneEffectZone, SceneEntity, WallSeg } from './monde/scene';
import { edgeOf, heightAt, porteAuteur, sceneMetresPerTile, tileAt } from './monde/scene';
import { edgeKey } from './monde/facades';
import type { Pt } from './monde/path';
import { footprintN, propFootTiles } from './monde/footprint';
import { estAbsent } from './monde/terrain';
import { vehiculeDuCombattant, type VehiculeDuCombattant } from './apparence/combattant';
import { ficheDEntite } from './monde/sceneNpc';
import { memoByRef } from './monde/sceneMemo';
import { addEntity, addLayer, paintHeight, paintTiles, patchWall, setEdgeWall } from './sceneEdit';
import { buildScene, type MapSpec } from './mapSpec';
import { AMELIORATIONS_DE_LA_CARAQUE, PLAN_DE_LA_CARAQUE } from './planDeLaCaraque';
import { PLAN_DE_LA_BARGE } from './planDeLaBarge';

/** Ce qu'une Amélioration ajoute aux ponts d'un type de navire. */
export type ApportAuxPonts = Pick<MapSpec, 'terrainRects' | 'relief' | 'elevate' | 'walls' | 'entities'>;

/** Les ponts d'un type de navire (leur `id` est celui du véhicule), et ce que chacune de ses Améliorations (id de
 *  `naval-traits`) y ajoute. */
interface PlanDeNavire {
  ponts: MapSpec;
  ameliorations: Readonly<Record<string, ApportAuxPonts>>;
}

/** Les plans des types de navire qui en ont. */
export const PLANS_DE_NAVIRE: readonly PlanDeNavire[] = [
  { ponts: PLAN_DE_LA_CARAQUE, ameliorations: AMELIORATIONS_DE_LA_CARAQUE },
  { ponts: PLAN_DE_LA_BARGE, ameliorations: {} },
];

/** Le plan des ponts du type de navire `ref`, `undefined` s'il n'en a pas. */
const planDe = (ref: string | undefined): PlanDeNavire | undefined => PLANS_DE_NAVIRE.find((p) => p.ponts.id === ref);

/** Les types de navire qui se posent par leurs ponts, chacun l'id de son véhicule et son nom. */
export const TYPES_DE_NAVIRE: readonly { id: string; label: string }[] = PLANS_DE_NAVIRE.map(({ ponts }) => ({ id: ponts.id, label: ponts.label }));

/** Les caps où un navire se pose par ses ponts : les cardinaux (`poseDe`). */
export const CAPS_DES_PONTS: readonly Dir4[] = DIR4_ORDER;

/** `scene` est-elle à l'échelle du plan des ponts du type de navire `ref` ? Ses ponts ne s'y posent qu'alors. */
export const aLEchelleDesPonts = (scene: SceneDuVolume, ref: string): boolean =>
  sceneMetresPerTile(garanti(planDe(ref), ref, 'plan de navire').ponts) === sceneMetresPerTile(scene);

/** Les ponts du type `ref` avec ce qu'y ajoutent les Améliorations `upgrades` ; une Amélioration qui ne change
 *  rien à bord (Bélier, Lissage…) n'y ajoute rien. */
export function pontsDuNavire(ref: string, upgrades: readonly NavalTraitRef[]): MapSpec {
  const plan = garanti(planDe(ref), ref, 'plan de navire');
  return upgrades.reduce<MapSpec>((ponts, { id }) => {
    garanti(findNavalTrait(id), id, 'Amélioration de navire');
    const apport = plan.ameliorations[id];
    if (!apport) return ponts;
    return {
      ...ponts,
      terrainRects: [...(ponts.terrainRects ?? []), ...(apport.terrainRects ?? [])],
      relief: [...(ponts.relief ?? []), ...(apport.relief ?? [])],
      elevate: { ...ponts.elevate, ...apport.elevate },
      walls: [...(ponts.walls ?? []), ...(apport.walls ?? [])],
      entities: [...(ponts.entities ?? []), ...(apport.entities ?? [])],
    };
  }, plan.ponts);
}

/** Quarts de tour horaires du plan vers l'hôte, par cap. */
const QUARTS: Record<Dir4, number> = { O: 0, N: 1, E: 2, S: 3 };

/** Case hôte de la case (x, y) d'un plan de `w` × `h` au cap `cap` : tribord reste à la droite de la proue. */
function versLHote(cap: Dir4, w: number, h: number): (x: number, y: number) => Pt {
  switch (cap) {
    case 'O': return (x, y) => ({ x, y });
    case 'E': return (x, y) => ({ x: w - 1 - x, y: h - 1 - y });
    case 'N': return (x, y) => ({ x: h - 1 - y, y: x });
    case 'S': return (x, y) => ({ x: y, y: w - 1 - x });
  }
}

/** Le vecteur (x, y) du plan tourné comme `versLHote` en tourne les cases : un quart horaire par quart du cap. */
function tournerLeVecteur(cap: Dir4, v: { x: number; y: number }): { x: number; y: number } {
  let { x, y } = v;
  for (let q = 0; q < QUARTS[cap]; q++) [x, y] = [0 - y, x]; // `0 - y` : jamais de zéro négatif dans la donnée
  return { x, y };
}

/** Un navire posé : l'id de son entité, son type, ses Améliorations, son cap, la case hôte du coin nord-ouest de ses
 *  ponts et l'étage hôte de son pont le plus bas. */
interface PoseDeNavire {
  id: string;
  ref: string;
  upgrades: readonly NavalTraitRef[];
  cap: Dir4;
  x: number;
  y: number;
  z: number;
}

/** La pose des ponts du navire `ent` dans `scene`, `null` si `ent` n'est pas un navire à plan des ponts, si la scène
 *  n'est pas à l'échelle de son plan, ou s'il n'est pas à un cap cardinal, faute que le schéma de scène nomme
 *  (`refusDeLEntite`) : ses ponts ne se posent pas. Ses ponts se centrent sur son empreinte de combattant, la case centrée sur
 *  l'entier, au plus près quand leurs côtés n'ont pas la parité de l'empreinte. */
function poseDe(scene: SceneDuVolume, ent: SceneEntity): PoseDeNavire | null {
  const plan = planDe(ent.vehicule?.id);
  if (!plan || !aLEchelleDesPonts(scene, plan.ponts.id)) return null;
  const cap = ent.facing ?? 'N';
  if (!estCardinal(cap)) return null;
  const ref = plan.ponts.id;
  const n = footprintN(garanti(vehicleCombatant(garanti(findVehicleById(ref), ref, 'véhicule')), ref, 'coque de navire'));
  const [w, h] = plan.ponts.size;
  const [cx, cy] = cap === 'E' || cap === 'O' ? [w, h] : [h, w];
  const coin = (ancre: number, cote: number) => Math.floor(ancre + (n - 1) / 2 - (cote - 1) / 2 + 0.5);
  return { id: ent.id, ref, upgrades: ent.upgrades ?? [], cap, x: coin(ent.pos.x, cx), y: coin(ent.pos.y, cy), z: ent.z ?? 0 };
}

/** Les poses des navires de `scene`. */
const posesDe = (scene: SceneDuVolume): PoseDeNavire[] => scene.entities.flatMap((e) => poseDe(scene, e) ?? []);

const idsDesNaviresPoses = memoByRef((scene: Scene): ReadonlySet<string> => new Set(posesDe(scene).map((pose) => pose.id)));

/** Le combattant `id` est-il un navire dont `scene` pose les ponts ? Ses ponts portent alors son corps. */
export const estPoseParSesPonts = (scene: Scene, id: string): boolean => idsDesNaviresPoses(scene).has(id);

/** La case hôte, en cases continues, de chaque point (x, y) des ponts `navire` posés selon `pose`. */
function versLaScene(navire: Scene, pose: PoseDeNavire): (x: number, y: number) => Pt {
  const tourne = versLHote(pose.cap, navire.dimensions.w, navire.dimensions.h);
  return (x, y) => {
    const p = tourne(x, y);
    return { x: pose.x + p.x, y: pose.y + p.y };
  };
}

/** Les deux cases qu'une arête canonique sépare. */
const casesDeLArete = (w: WallSeg): [Pt, Pt] =>
  w.side === 'N' ? [{ x: w.x, y: w.y }, { x: w.x, y: w.y - 1 }] : [{ x: w.x, y: w.y }, { x: w.x + 1, y: w.y }];

/** Les champs d'une arête au-delà de sa place. */
function champsDeLArete(w: WallSeg): Partial<WallSeg> {
  const { x: _x, y: _y, side: _side, z: _z, ...champs } = w;
  return champs;
}

/** Ce que les ponts `navire` posés selon `pose` occupent dans la scène hôte : chaque case d'un sol, à son étage, avec son
 *  terrain et sa hauteur ; chaque sol hors des cases (une hauteur du plan sans terrain, qui porte un décor), à son étage,
 *  avec sa hauteur ; et chaque arête canonique, à son étage, avec l'arête des ponts qu'elle recopie. */
function emprise(navire: Scene, pose: PoseDeNavire): { cases: (Pt & { z: number; terrain: Terrain; hauteur: number })[]; sols: (Pt & { z: number; hauteur: number })[]; aretes: { arete: WallSeg; place: { x: number; y: number; side: 'N' | 'E'; z: number } }[] } {
  const z0 = pose.z;
  const vers = versLaScene(navire, pose);
  const { w, h } = navire.dimensions;
  const places = navire.layers.flatMap((couche) => Array.from({ length: w * h }, (_, i) => ({ x: i % w, y: Math.floor(i / w), z: couche.z })));
  const cases = places.flatMap(({ x, y, z }) => {
    const terrain = tileAt(navire, x, y, z);
    return estAbsent(terrain) ? [] : [{ ...vers(x, y), z: z0 + z, terrain, hauteur: heightAt(navire, x, y, z) }];
  });
  const sols = places.flatMap(({ x, y, z }) =>
    estAbsent(tileAt(navire, x, y, z)) && heightAt(navire, x, y, z) !== 0 ? [{ ...vers(x, y), z: z0 + z, hauteur: heightAt(navire, x, y, z) }] : []);
  const aretes = (navire.walls ?? []).flatMap((arete) => {
    if (arete.side !== 'N' && arete.side !== 'E') return [];
    const [a, b] = casesDeLArete(arete).map((c) => vers(c.x, c.y));
    return [{ arete, place: { ...edgeOf(a.x, a.y, b.x, b.y)!, z: z0 + (arete.z ?? 0) } }];
  });
  return { cases, sols, aretes };
}

/** Les ponts compilés (`buildScene`) du type et des Améliorations de `pose`. */
const pontsCompiles = (pose: PoseDeNavire): Scene => buildScene(pontsDuNavire(pose.ref, pose.upgrades));

/** `hote` avec les ponts de `navire` (la scène compilée de `pontsDuNavire`) posés selon `pose` ; une pièce ou un décor
 *  déjà posé sous le même id est remplacé : poser deux fois la même pose rend la même scène. */
function poserLeNavire(hote: Scene, navire: Scene, pose: PoseDeNavire): Scene {
  const z0 = pose.z;
  const vers = versLaScene(navire, pose);
  const { cases, sols, aretes } = emprise(navire, pose);
  let s = navire.layers.reduce((acc, couche) => addLayer(acc, z0 + couche.z), hote);
  for (const c of cases) s = paintHeight(paintTiles(s, c, c.terrain, 1, c.z), c, c.hauteur, 1, c.z);
  for (const c of sols) s = paintHeight(s, c, c.hauteur, 1, c.z);
  for (const { arete, place } of aretes)
    s = patchWall(setEdgeWall(s, place.x, place.y, place.side, place.z, porteAuteur(arete) ? 'door' : 'wall'), place.x, place.y, place.side, place.z, champsDeLArete(arete));
  const pieces: SceneEffectZone[] = (navire.effectZones ?? []).map((zone) => {
    const tiles = (zone.tiles ?? []).map((t) => ({ ...vers(t.x, t.y), z: z0 + (t.z ?? zone.z ?? 0) }));
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
    const cases = propFootTiles(e.decor?.id, e.pos, e.facing, sceneMetresPerTile(navire)).map((c) => vers(c.x, c.y));
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
  const remplaces = (ids: { id: string }[]) => new Set(ids.map((e) => e.id));
  const [idsDesPieces, idsDesDecors] = [remplaces(pieces), remplaces(decors)];
  return {
    ...s,
    effectZones: [...(s.effectZones ?? []).filter((z) => !idsDesPieces.has(z.id)), ...pieces],
    entities: [...s.entities.filter((e) => !idsDesDecors.has(e.id)), ...decors],
  };
}

/** `scene` avec les ponts de chacun de ses navires posés (`poserLeNavire`) : la dérivation qu'une scène subit à son
 *  chargement en jeu, et la vue que l'éditeur en montre ; la dériver de nouveau rend la même scène. Mémoïsée par
 *  l'identité de `scene` (`memoByRef`). */
export const poserLesNavires = memoByRef((scene: Scene): Scene =>
  posesDe(scene).reduce((s, pose) => poserLeNavire(s, pontsCompiles(pose), pose), scene));

/** `scene` où un navire du type `ref` se pose : l'entité de son véhicule, nommée de son type, à la case `p` de la couche
 *  `z`, au cap `cap`, et son id ; `null` si `scene` n'est pas à l'échelle de son plan (`aLEchelleDesPonts`), où ses
 *  ponts ne se poseraient pas. */
export function poserUnNavire(scene: Scene, ref: string, p: Pt, z: number, cap: Dir4): { scene: Scene; id: string } | null {
  if (!aLEchelleDesPonts(scene, ref)) return null;
  const id = nextEntityId('navire', scene.entities.map((e) => e.id));
  const { label } = garanti(planDe(ref), ref, 'plan de navire').ponts;
  return { scene: addEntity(scene, { id, kind: 'personnage', vehicule: { id: ref }, pos: { x: p.x, y: p.y }, facing: cap, label }, z), id };
}

/** Ce que les ponts des navires de `scene` y posent, par l'id de leur entité : leurs cases (clés `x,y,z`) et leurs arêtes
 *  (`edgeKey`), qu'un hôte garde pour la marche et le pointage, le navire se montrant par son modèle 3D
 *  (`naviresDeLaScene`) ; et sa flottaison : les cases (clés `x,y,z`) du rectangle de ses ponts à l'étage de son pont le
 *  plus bas, la mer qui borde sa coque, sa flottaison étant à la hauteur 0 de la scène. */
export function provenanceDesNavires(scene: SceneDuVolume): { cases: ReadonlyMap<string, string>; aretes: ReadonlyMap<string, string>; flottaison: ReadonlyMap<string, string> } {
  const cases = new Map<string, string>();
  const aretes = new Map<string, string>();
  const flottaison = new Map<string, string>();
  for (const pose of posesDe(scene)) {
    const navire = pontsCompiles(pose);
    const e = emprise(navire, pose);
    for (const c of e.cases) cases.set(`${c.x},${c.y},${c.z}`, pose.id);
    for (const { place } of e.aretes) aretes.set(edgeKey(place), pose.id);
    const vers = versLaScene(navire, pose);
    const { w, h } = navire.dimensions;
    for (let i = 0; i < w * h; i++) {
      const c = vers(i % w, Math.floor(i / w));
      flottaison.set(`${c.x},${c.y},${pose.z}`, pose.id);
    }
  }
  return { cases, aretes, flottaison };
}

/** Les arêtes de `scene` hors de celles des ponts de ses navires (`provenanceDesNavires`) : celles qu'un hôte dessine. */
export function aretesHorsDesNavires(scene: Scene): WallSeg[] {
  const { aretes } = provenanceDesNavires(scene);
  return (scene.walls ?? []).filter((seg) => !aretes.has(edgeKey(seg)));
}

/** Un navire de la scène tel qu'un hôte le montre : l'id de son entité, son véhicule (`vehiculeDuCombattant` de sa
 *  fiche, à son cap, à sa taille réelle, celle du plateau de ses ponts), le point de la scène (en cases continues, la
 *  case centrée sur l'entier) sous l'origine de son modèle 3D, le centre de ses ponts ; la flottaison du modèle est à
 *  la hauteur 0 de la scène, celle de son plan. */
export interface NavireDeLaScene {
  id: string;
  vehicule: VehiculeDuCombattant;
  centre: Pt;
}

/** Les navires de `scene` tels qu'un hôte les montre. PUR. */
export function naviresDeLaScene(scene: Scene): NavireDeLaScene[] {
  return posesDe(scene).map((pose) => {
    const navire = pontsCompiles(pose);
    const fiche = ficheDEntite(garanti(scene.entities.find((e) => e.id === pose.id), pose.id, 'entité de navire'), () => undefined);
    return {
      id: pose.id,
      vehicule: { ...garanti(vehiculeDuCombattant(fiche, pose.cap), pose.id, 'fiche de véhicule'), taille: 'reelle' },
      centre: versLaScene(navire, pose)((navire.dimensions.w - 1) / 2, (navire.dimensions.h - 1) / 2),
    };
  });
}

/** L'emprise libre des cases des ponts d'un navire que son modèle rogne (`cases` du manifeste de son élément `vehicule`,
 *  #3767) : par case `x,y,z` de son plan, [x0, y0, x1, y1] en cases du plan, la case (x, y) couvrant [x, x+1] × [y, y+1]. */
export type EmprisesDesCases = Readonly<Record<string, readonly [number, number, number, number]>>;

/** Où se tient l'occupant d'une case de la scène que le modèle d'un navire rogne : la case, à son étage, et le point de la
 *  scène, en cases continues (la case centrée sur l'entier). */
export interface StationDeNavire {
  x: number;
  y: number;
  z: number;
  point: Pt;
}

/** Les stations des cases des ponts du navire `id` de `scene` que son modèle rogne (`emprises`) : le centre de l'emprise
 *  de chacune, posé avec ses ponts. PUR. */
export function stationsDuNavire(scene: Scene, id: string, emprises: EmprisesDesCases): StationDeNavire[] {
  const pose = garanti(posesDe(scene).find((p) => p.id === id), id, 'pose de navire');
  const vers = versLaScene(pontsCompiles(pose), pose);
  return Object.entries(emprises).map(([cle, [x0, y0, x1, y1]]) => {
    const [x, y, z] = cle.split(',').map(Number);
    return { ...vers(x, y), z: pose.z + z, point: vers((x0 + x1 - 1) / 2, (y0 + y1 - 1) / 2) };
  });
}
