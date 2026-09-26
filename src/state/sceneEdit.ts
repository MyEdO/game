/**
 * MUTATIONS PURES de Scène (Scene → Scene) — Node-safe, ZÉRO dépendance UI/gameIso. Elles vivent
 * hors de l'éditeur pour que le compilateur headless-editor (`state/mapSpec.buildScene`, exécuté via
 * `tsx` par le générateur d'arène en Node) puisse les rejouer sans tirer le rendu.
 *
 * Chaque fonction renvoie une NOUVELLE Scène (immuable). `editorState.ts` les RÉ-EXPORTE : les câblages
 * du canvas (couplés UI/gameIso) y restent. NE JAMAIS importer `../ui/` ni `../gameIso/` ici.
 */
import { ActionAuthoree, DEFAULT_TERRAIN, Scene, SceneEntity, SceneEffectZone, Terrain, CellSide, EncounterMember, crenellatedAt, heightAt, layerTiles, tileAt, sceneMetresPerTile, WallSeg, WallSide, ArchitectureBody, ArchitectureEdgeRef, ArchitecturePart, ArchitectureRect, FacadeSection, BuildingMass, RoofDefaults, SceneRoofDefaults } from './scene';
import { memoByRef } from './sceneMemo';
import type { FireArc, AuthoredShipPoste } from '../engine/types';
import type { Dir8 } from './dir8';
import { EMPTY_FLOW } from './flow';
import { nextEntityId } from './entityId';
import { findTrappingById, findCreatureById, creatureLabel } from '../data';
import { siegeEmplacementEntity } from './siegeEmplacement';
import { stairFlightCells, interiorCells } from './planDefects';
import { estAbsent, terrainAbsent } from './terrain';
import { PARTY_MAX } from './combatants';
import {
  assignSeat,
  pruneSeatAssignments,
  releaseSeat,
  seatIsOccupiable,
  seatPoseOf,
  seatSlotsOf,
  type SeatAssignmentResult,
  type SeatAssignments,
  type SeatOccupant,
} from './seating';
import { METRES_PER_LEVEL } from './relief';
import { typeNonNomme } from '../data/schemas/defs-scenes/scene';
import { buildingRoofMaterial } from './buildings';
import { decorEnCaseEtage } from './decorIndex';

export type Rect = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };

/** Entité posée à `p` sur la couche `z` (défaut 0) — prédicat UNIQUE de picking/gomme/collision
 *  d'entités. Source unique remplaçant les comparaisons dupliquées `pos.x===p.x && pos.y===p.y`
 *  qui omettaient le filtre de couche (#835 FU-3) : `hitAt`/`eraseAt`/`addEnemyMember` et la pose
 *  directe (`entity`/`emplacement`) le partagent tous.
 *
 *  Un décor répond sur TOUTE son EMPREINTE (`state/decorIndex.ts`, la même lecture que le picking du
 *  jeu, `gameIso/stage/pickResolve.ts`) et rend son entité, donc sa case d'ANCRAGE : sans elle, la
 *  seconde case d'une table 2×1 ne se sélectionnait, ne s'effaçait et ne se déplaçait pas au canevas
 *  d'authoring, et un clic y posait une entité DANS le meuble. La pose EXACTE garde la priorité —
 *  un corps debout sur une case d'empreinte se désigne lui-même, pas le meuble sous ses pieds. */
export function entityAt(scene: Scene, p: Pt, z = 0): SceneEntity | undefined {
  return scene.entities.find((e) => e.pos.x === p.x && e.pos.y === p.y && (e.z ?? 0) === z)
    ?? decorEnCaseEtage(scene, p.x, p.y, z);
}

function boundedRect(scene: Scene, rect: Rect): Rect {
  const w = Math.max(1, Math.min(rect.w, scene.dimensions.w));
  const h = Math.max(1, Math.min(rect.h, scene.dimensions.h));
  return {
    x: Math.max(0, Math.min(scene.dimensions.w - w, rect.x)),
    y: Math.max(0, Math.min(scene.dimensions.h - h, rect.y)),
    w,
    h,
  };
}

function updateArchitectureBody(scene: Scene, bodyId: string, update: (body: ArchitectureBody) => ArchitectureBody): Scene {
  const body = scene.architecture?.find((candidate) => candidate.id === bodyId);
  if (!body) return scene;
  return { ...scene, architecture: scene.architecture!.map((candidate) => (candidate.id === bodyId ? update(candidate) : candidate)) };
}

/** Crée un corps BORNÉ dès sa naissance : son étage `z0` porte d'emblée un volume (`part`) à `foot`,
 *  l'emprise que le geste de création connaît (case visée à l'éditeur). Un corps sans aucun `part` est
 *  NON BORNÉ — sa dérivation (`deriveArchitectureMasses`) n'a plus d'autre arbitre que l'ordre du
 *  tableau, et deux tels corps se disputent silencieusement le même plancher : au plus UN par scène,
 *  vérifié par `validateArchitectureResiduals` (`state/mapSpec.ts`). L'auteur redimensionne ensuite ce
 *  volume (`resizeSel`) au lieu de partir d'un corps qui revendique toute la scène.
 *  `style` est le TYPE de bâtiment (`buildings.json`), OPTIONNEL au schéma : un corps qui n'en porte
 *  aucun est un bâti sans type (bourg, hameau, corps composite). */
export function addArchitectureBody(scene: Scene, style: string | undefined, foot: Rect): { scene: Scene; id: string } {
  const id = nextEntityId('architecture', (scene.architecture ?? []).map((body) => body.id));
  const part: ArchitecturePart = { id: nextEntityId('part', []), foot: boundedRect(scene, foot) };
  const body: ArchitectureBody = { id, ...(style === undefined ? {} : { style }), storeys: [{ id: 'z0', z: 0, parts: [part], roomZoneIds: [] }], facades: [], masses: [] };
  return { scene: { ...scene, architecture: [...(scene.architecture ?? []), body] }, id };
}

/** Ajoute un ÉTAGE au corps `bodyId` — comble le trou #841 FU-C : `addArchitectureBody` ne posait qu'un
 *  seul étage (`z0`) « en dur », sans aucun moyen d'en ajouter un second au clic. `id` frais (jamais `z0`,
 *  réservé au premier étage). null si le corps est introuvable. */
export function addArchitectureStorey(scene: Scene, bodyId: string, z: number): { scene: Scene; id: string } | null {
  const body = scene.architecture?.find((candidate) => candidate.id === bodyId);
  if (!body) return null;
  const id = nextEntityId('etage', body.storeys.map((storey) => storey.id));
  const storey = { id, z, parts: [], roomZoneIds: [] };
  return { scene: updateArchitectureBody(scene, bodyId, (candidate) => ({ ...candidate, storeys: [...candidate.storeys, storey] })), id };
}

export function addArchitecturePart(scene: Scene, bodyId: string, storeyId: string, foot: Rect): { scene: Scene; id: string } | null {
  const body = scene.architecture?.find((candidate) => candidate.id === bodyId);
  const storey = body?.storeys.find((candidate) => candidate.id === storeyId);
  if (!body || !storey) return null;
  const id = nextEntityId('part', storey.parts.map((part) => part.id));
  const part: ArchitecturePart = { id, foot: boundedRect(scene, foot) };
  return {
    scene: updateArchitectureBody(scene, bodyId, (candidate) => ({
      ...candidate,
      storeys: candidate.storeys.map((current) => current.id === storeyId ? { ...current, parts: [...current.parts, part] } : current),
    })),
    id,
  };
}

export function addFacadeSection(scene: Scene, bodyId: string, edge: ArchitectureEdgeRef, appearance: string): { scene: Scene; id: string } | null {
  const body = scene.architecture?.find((candidate) => candidate.id === bodyId);
  if (!body) return null;
  const id = nextEntityId('facade', body.facades.map((facade) => facade.id));
  const section: FacadeSection = { id, z: edge.z ?? 0, edges: [{ ...edge }], appearance };
  return { scene: updateArchitectureBody(scene, bodyId, (candidate) => ({ ...candidate, facades: [...candidate.facades, section] })), id };
}

export function addBuildingMass(scene: Scene, bodyId: string, foot: Rect, z: number): { scene: Scene; id: string } | null {
  const body = scene.architecture?.find((candidate) => candidate.id === bodyId);
  if (!body) return null;
  const id = nextEntityId('masse', body.masses.map((mass) => mass.id));
  const toiture = toitureEffective(scene, body);
  const mass: BuildingMass = {
    id,
    z,
    footprint: [boundedRect(scene, foot)],
    levels: 1,
    // Le PROFIL est le geste : une masse posée à la main est un pignon jusqu'à ce que l'auteur en
    // change, tandis que matière et pente viennent de la toiture EFFECTIVE du corps (#1715).
    profile: 'gable',
    pitchDeg: toiture.penteReference,
    material: toiture.material,
  };
  return { scene: updateArchitectureBody(scene, bodyId, (candidate) => ({ ...candidate, masses: [...candidate.masses, mass] })), id };
}

/** Rectangle inclusif englobant deux cases (drag de zone/bâtiment/remplissage). */
export function rectFrom(a: Pt, b: Pt): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
}

/** Réécrit les tuiles de la couche `z` (immuable) — base partagée des outils de terrain. */
function withLayerTiles(scene: Scene, z: number, tiles: Terrain[]): Scene {
  return { ...scene, layers: scene.layers.map((l) => (l.z === z ? { ...l, tiles } : l)) };
}

/** Peint un carré de côté `brush` centré sur p (terrain), sur la couche `z` (défaut base). */
export function paintTiles(scene: Scene, p: Pt, terrain: Terrain, brush: number, z = 0): Scene {
  const { w, h } = scene.dimensions;
  if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) return scene;
  const tiles = [...layerTiles(scene, z)];
  const r = Math.floor((brush - 1) / 2);
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = p.x + dx,
        y = p.y + dy;
      if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = terrain;
    }
  return withLayerTiles(scene, z, tiles);
}

/** Remplit un rectangle de terrain (sous-mode Rectangle), sur la couche `z` (défaut base). */
export function fillTerrainRect(scene: Scene, rect: Rect, terrain: Terrain, z = 0): Scene {
  const { w, h } = scene.dimensions;
  const tiles = [...layerTiles(scene, z)];
  for (let y = rect.y; y < rect.y + rect.h; y++)
    for (let x = rect.x; x < rect.x + rect.w; x++) if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = terrain;
  return withLayerTiles(scene, z, tiles);
}

/**
 * REDIMENSIONNE la grille : chaque couche est re-tissée à la nouvelle taille, tuiles, hauteurs
 * métriques ET crénelure recopiées dans la zone COMMUNE — les TROIS tableaux par case suivent
 * l'index aplati `y·w+x`, et un merlon hors de la nouvelle grille disparaît avec sa case. `height`
 * comme `crenellated` ne sont conservés que s'ils portent une valeur (≠ 0 pour l'un, non nulle pour
 * l'autre).
 *
 * La SEMENCE des cases neuves est celle de la naissance d'une couche (`addLayer`, `buildScene`) : la
 * base (`z === 0`) reçoit le sol de départ `DEFAULT_TERRAIN`, un étage naît ABSENT
 * (`terrainAbsent`) — agrandir une grille ne BÂTIT pas un plancher en surplomb.
 *
 * La pose passe par `putLayer`, jamais par une reconstruction directe de `layers` : le CARDINAL de la
 * grille (#1789) est gardé là et nulle part ailleurs. Les nouvelles dimensions sont posées D'ABORD,
 * c'est contre elles que le cardinal se mesure. PUR — l'éditeur n'en tient que l'appel.
 */
export function resizeGrid(scene: Scene, w: number, h: number): Scene {
  return scene.layers.reduce<Scene>((s, layer) => {
    const semence: Terrain = layer.z === 0 ? DEFAULT_TERRAIN : terrainAbsent();
    const tiles = new Array(w * h).fill(semence) as Terrain[];
    const height = new Array(w * h).fill(0) as number[];
    const crenellated = new Array(w * h).fill(null) as (string | null)[];
    let hasHeight = false;
    let hasCrenellated = false;
    for (let y = 0; y < Math.min(h, scene.dimensions.h); y++)
      for (let x = 0; x < Math.min(w, scene.dimensions.w); x++) {
        tiles[y * w + x] = tileAt(scene, x, y, layer.z);
        const hv = heightAt(scene, x, y, layer.z);
        if (hv) { height[y * w + x] = hv; hasHeight = true; }
        const cv = crenellatedAt(scene, x, y, layer.z);
        if (cv) { crenellated[y * w + x] = cv; hasCrenellated = true; }
      }
    return putLayer(s, layer.z, tiles, hasHeight ? height : undefined, hasCrenellated ? crenellated : undefined);
  }, { ...scene, dimensions: { w, h }, layers: [] });
}

/** Ajoute une couche à la cote `z` (grille « vide » = transparente, à construire), triée par z. No-op si
 *  une couche `z` existe déjà. Source unique de l'ajout de couche (éditeur multi-niveaux). */
export function addLayer(scene: Scene, z: number): Scene {
  if (scene.layers.some((l) => l.z === z)) return scene;
  const tiles = new Array(scene.dimensions.w * scene.dimensions.h).fill(terrainAbsent()) as Terrain[];
  return { ...scene, layers: [...scene.layers, { z, tiles }].sort((a, b) => a.z - b.z) };
}

/** Retire la couche `z`. La base (z=0) et la dernière couche sont protégées (jamais de scène sans couche). */
export function removeLayer(scene: Scene, z: number): Scene {
  if (z === 0 || scene.layers.length <= 1) return scene;
  return { ...scene, layers: scene.layers.filter((l) => l.z !== z) };
}

// ── Outil MURS (arêtes + portes + diagonales). Une cloison est stockée sous forme CANONIQUE N/E : le S
//    d'une case = le N de la case du dessous, le O = le E de la case de gauche → chaque arête n'existe
//    qu'une fois, quel que soit le côté cliqué. ──
// L'ARÊTE d'une case a UN terme, `CellSide` (`./scene`) : ce module n'en déclare pas un second.

/** Arête (case, side N/E/S/O) → forme CANONIQUE (case, N|E). */
export function canonEdge(x: number, y: number, side: CellSide): { x: number; y: number; side: 'N' | 'E' } {
  if (side === 'S') return { x, y: y + 1, side: 'N' };
  if (side === 'O') return { x: x - 1, y, side: 'E' };
  return { x, y, side };
}

/** État d'une arête : 'none' | 'wall' (pleine) | 'door' (franchissable), sur l'étage `z`. */
export function edgeWallState(scene: Scene, x: number, y: number, side: CellSide, z = 0): 'none' | 'wall' | 'door' {
  const e = canonEdge(x, y, side);
  const w = (scene.walls ?? []).find((w) => w.x === e.x && w.y === e.y && w.side === e.side && (w.z ?? 0) === z);
  return !w ? 'none' : w.door ? 'door' : 'wall';
}

/** Pose / change / retire l'arête à l'état `want`. Source unique de l'écriture d'une cloison cardinale.
 *  `structure` (id de `structures.json`) pose le MATÉRIAU en même temps que l'arête — l'outil de dessin
 *  porte son matériau, l'auteur n'a plus à repasser par l'inspecteur segment par segment (#830). */
export function setEdgeWall(scene: Scene, x: number, y: number, side: CellSide, z: number, want: 'none' | 'wall' | 'door', structure?: string): Scene {
  const e = canonEdge(x, y, side);
  const others = (scene.walls ?? []).filter((w) => !(w.x === e.x && w.y === e.y && w.side === e.side && (w.z ?? 0) === z));
  if (want === 'none') return { ...scene, walls: others.length ? others : undefined };
  const seg: WallSeg = { x: e.x, y: e.y, side: e.side, ...(z ? { z } : {}), ...(want === 'door' ? { door: true } : {}), ...(structure ? { structure } : {}) };
  return { ...scene, walls: [...others, seg] };
}

/** Clic de l'outil : l'arête prend l'état `want`, ou disparaît si elle l'avait déjà (toggle). */
export function toggleEdgeWall(scene: Scene, x: number, y: number, side: CellSide, z: number, want: 'wall' | 'door', structure?: string): Scene {
  return setEdgeWall(scene, x, y, side, z, edgeWallState(scene, x, y, side, z) === want ? 'none' : want, structure);
}

/** Diagonale `\\`/`/` en travers de la case (x,y) — une seule par case : poser l'autre la REMPLACE,
 *  re-cliquer la même l'enlève. */
export function toggleDiagonalWall(scene: Scene, x: number, y: number, diag: '\\' | '/', z: number): Scene {
  const isDiagHere = (w: WallSeg) => w.x === x && w.y === y && (w.z ?? 0) === z && (w.side === '\\' || w.side === '/');
  const others = (scene.walls ?? []).filter((w) => !isDiagHere(w));
  const had = (scene.walls ?? []).find((w) => w.x === x && w.y === y && (w.z ?? 0) === z && w.side === diag);
  if (had) return { ...scene, walls: others.length ? others : undefined };
  return { ...scene, walls: [...others, { x, y, side: diag, ...(z ? { z } : {}) }] };
}

/** Forme CANONIQUE compacte d'un segment d'arête : on n'écrit que les champs significatifs (pas de z:0,
 *  pas de door:false, closed sans porte, structure vide) — même convention que `setEdgeWall`. */
function normWall(w: WallSeg): WallSeg {
  const out: WallSeg = { x: w.x, y: w.y, side: w.side };
  if (w.z) out.z = w.z;
  if (w.door) out.door = true;
  if (w.door && w.closed) out.closed = true;
  if (w.structure) out.structure = w.structure;
  if (w.appearance) out.appearance = w.appearance;
  if (w.window) out.window = true; // fenêtre décorative (champ significatif : préservé au patch)
  if (w.climb) out.climb = w.climb;
  return out;
}

/** Patche le segment-mur canonique (x,y,side,z) : applique `patch` puis re-normalise (drop des champs
 *  vides). No-op (réf préservée par `map`) si aucun segment à cette arête. PUR — calqué sur `setEdgeWall`. */
export function patchWall(scene: Scene, x: number, y: number, side: WallSide, z: number, patch: Partial<WallSeg>): Scene {
  return {
    ...scene,
    walls: (scene.walls ?? []).map((w) =>
      w.x === x && w.y === y && w.side === side && (w.z ?? 0) === z ? normWall({ ...w, ...patch }) : w,
    ),
  };
}

/** Outil HAUTEUR : peint la hauteur métrique de la surface (`metres` : +1 estrade, +4 toit, −2 fosse,
 *  0 plat) sur un carré de côté `brush` centré sur p, sur la couche `z`. Crée le tableau `height`
 *  (rempli de 0) au besoin. Hauteur PORTEUSE (marchabilité/combat/chute, cf. `relief.ts`). */
export function paintHeight(scene: Scene, p: Pt, metres: number, brush: number, z = 0): Scene {
  const { w, h } = scene.dimensions;
  if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) return scene;
  const layer = scene.layers.find((l) => l.z === z) ?? scene.layers[0];
  const height = [...(layer.height ?? new Array(w * h).fill(0))];
  const r = Math.floor((brush - 1) / 2);
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = p.x + dx, y = p.y + dy;
      if (x >= 0 && y >= 0 && x < w && y < h) height[y * w + x] = metres;
    }
  return { ...scene, layers: scene.layers.map((l) => (l.z === layer.z ? { ...l, height } : l)) };
}

/** Marque un carré de côté `brush` centré sur p comme CRÉNELÉ (décoration de rendu ; id de structure
 *  crénelée = `structure`), sur la couche `z`. Miroir de `paintHeight` sur le tableau parallèle
 *  `crenellated`. `structure = null` efface. Marqueur de RENDU pur (le crest builder en dérive les merlons
 *  de périmètre) — n'affecte NI passabilité NI LdV ; orthogonal à la hauteur (`paintHeight`). */
export function paintCrenellated(scene: Scene, p: Pt, structure: string | null, brush: number, z = 0): Scene {
  const { w, h } = scene.dimensions;
  if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) return scene;
  const layer = scene.layers.find((l) => l.z === z) ?? scene.layers[0];
  const crenellated = [...(layer.crenellated ?? new Array(w * h).fill(null))] as (string | null)[];
  const r = Math.floor((brush - 1) / 2);
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = p.x + dx, y = p.y + dy;
      if (x >= 0 && y >= 0 && x < w && y < h) crenellated[y * w + x] = structure;
    }
  return { ...scene, layers: scene.layers.map((l) => (l.z === layer.z ? { ...l, crenellated } : l)) };
}

/** Pose un EMPLACEMENT DE SIÈGE à p via le builder PARTAGÉ `siegeEmplacementEntity` (même source que les
 *  scénarios) : une SceneEntity-personnage portant `ref` (source de l'engin → la branche siège de
 *  `spawnEnemy` construit l'affût inerte) et un poste d'artillerie (`postes:[{ trappingId, crewIds:[] }]`).
 *  AUCUN `appearance.species` : le rig d'engin est DÉRIVÉ de la `ref` au rendu (éditeur ↔ explo ↔ combat).
 *  Au combat, `applyShipPostes` sert la pièce au chef (`crewIds[0]`). Posable ⇔ l'engin a un art d'affût
 *  (`siegeRig`) ; sinon → null (pas d'entité fantôme). */
export function placeEmplacement(scene: Scene, trappingId: string, p: Pt, z = 0, facing?: Dir8): { scene: Scene; id: string } | null {
  const id = nextEntityId('personnage', scene.entities.map((e) => e.id));
  const ent = siegeEmplacementEntity(id, trappingId, p, facing ? { facing } : {});
  if (!ent) return null; // posable ⇔ a un art d'affût (`siegeRig`)
  return { scene: addEntity(scene, ent, z), id };
}

/** Patche le poste UNIQUE (postes[0]) de l'emplacement `entityId` (no-op si l'entité n'en porte pas). */
function patchPoste0(scene: Scene, entityId: string, fn: (p: AuthoredShipPoste) => AuthoredShipPoste): Scene {
  const ent = scene.entities.find((e) => e.id === entityId && e.postes?.length);
  return ent ? editEntity(scene, entityId, { postes: ent.postes!.map((p, i) => (i === 0 ? fn(p) : p)) }) : scene;
}

/** Affecte l'équipage du poste (ids d'entités, ORDRE = chef de pièce en tête → `crewIds[0]`). */
export function setPosteCrew(scene: Scene, entityId: string, crewIds: string[]): Scene {
  return patchPoste0(scene, entityId, (p) => ({ ...p, crewIds }));
}

/** Pose / retire l'arc de tir du créneau : `side` absent = tir OMNI (pivot libre) ; présent = arc relatif
 *  à l'orientation-monde du chef de pièce. */
export function setPosteSide(scene: Scene, entityId: string, side: FireArc | undefined): Scene {
  return patchPoste0(scene, entityId, (p) => {
    const next = { ...p };
    if (side) next.side = side;
    else delete next.side;
    return next;
  });
}

/** Change l'engin du poste : nouvelle réf catalogue (`trappingId`) + libellé, ET restampe la `ref` sur
 *  l'entité — le rig d'affût étant DÉRIVÉ de la `ref`, le rendu suit l'engin servi sans `appearance.species`.
 *  La base est HYDRATÉE au spawn (#222 — plus d'`ItemInstance` matérialisée ici). Équipage conservé. No-op si
 *  l'engin est inconnu ou sans art d'affût (`siegeRig`). */
export function setPosteEngine(scene: Scene, entityId: string, trappingId: string): Scene {
  const t = findTrappingById(trappingId);
  if (!t?.siegeRig) return scene;
  const ent = scene.entities.find((e) => e.id === entityId && e.postes?.length);
  if (!ent) return scene;
  return editEntity(scene, entityId, {
    label: t.label,
    ref: trappingId,
    postes: ent.postes!.map((p, i) => (i === 0 ? { ...p, trappingId, item: undefined } : p)),
  });
}

/** Colle une copie de `data` (id frais) à la case p, sur la couche `z` (défaut 0 — jamais le z SOURCE
 *  de l'entité copiée, cf. #835 FU-3 : coller reprend la couche ACTIVE de l'éditeur). */
export function pasteEntity(scene: Scene, data: SceneEntity, p: Pt, z = 0): { scene: Scene; id: string } {
  const id = nextEntityId(data.kind, scene.entities.map((e) => e.id));
  const ent: SceneEntity = { ...(JSON.parse(JSON.stringify(data)) as SceneEntity), id, pos: { ...p } };
  return { scene: addEntity(scene, ent, z), id };
}

/** Pose un point d'entrée nommé `entree-N` (premier libre) à p, sur l'étage `z` (défaut 0) — comble le
 *  manque du POC : les transitions et la carte du monde les référencent mais rien ne permettait d'en
 *  créer. Étage éditable ensuite dans l'inspecteur (#835 FU-5). */
export function placeEntry(scene: Scene, p: Pt, z = 0): { scene: Scene; id: string } {
  const id = nextEntityId('entree', Object.keys(scene.entryPoints ?? {}));
  return { scene: { ...scene, entryPoints: { ...scene.entryPoints, [id]: { ...p, ...(z ? { z } : {}) } } }, id };
}

/** Renomme un point d'entrée (clé unique, non vide). Renvoie la scène inchangée si conflit. */
export function renameEntry(scene: Scene, from: string, to: string): Scene {
  const next = to.trim();
  if (!next || next === from || scene.entryPoints?.[next] || !scene.entryPoints?.[from]) return scene;
  const entries: Record<string, Pt> = {};
  for (const [k, v] of Object.entries(scene.entryPoints)) entries[k === from ? next : k] = v;
  return { ...scene, entryPoints: entries };
}

/** Crée un trigger sur `rect`, à l'étage `z` (id frais). */
export function addTrigger(scene: Scene, rect: Rect, z = 0): { scene: Scene; id: string } {
  const id = nextEntityId('trig', scene.triggers.map((t) => t.id));
  return { scene: { ...scene, triggers: [...scene.triggers, { id, rect: { ...rect, ...(z ? { z } : {}) }, once: true, flow: EMPTY_FLOW }] }, id };
}

/** Crée une zone de repos sur `rect`, à l'étage `z` (camp par défaut — lieux/qualité éditables dans l'inspecteur). */
export function addRestZone(scene: Scene, rect: Rect, z = 0): { scene: Scene; idx: number } {
  const zones = [...(scene.restZones ?? []), { rect: { ...rect, ...(z ? { z } : {}) }, places: { camp: true } }];
  return { scene: { ...scene, restZones: zones }, idx: zones.length - 1 };
}

/** CONTENU DE NAISSANCE d'une zone d'effet : ce que l'outil qui la dessine lui donne (pièce, piège,
 *  barrière…). `id`, `area` et `z` restent au créateur — ils viennent du geste, pas de l'appelant. */
export type EffectZoneSeed = Partial<Omit<SceneEffectZone, 'id' | 'area' | 'z'>>;

/** Crée une ZONE D'EFFET sur `rect`, à l'étage `z` (id frais pour le rendu/sélection). Tout ce que la
 *  zone PORTE vient de `seed` : sans seed, elle naît DESCRIPTIVE (`isDescriptiveZone`) et libellée par
 *  son id, renommable dans l'inspecteur. */
export function addEffectZone(scene: Scene, rect: Rect, z = 0, seed: EffectZoneSeed = {}): { scene: Scene; idx: number } {
  const id = nextEntityId('zone', (scene.effectZones ?? []).map((ez) => ez.id));
  const zones = [
    ...(scene.effectZones ?? []),
    { label: id, ...seed, id, area: { kind: 'rect' as const, ...rect }, ...(z ? { z } : {}) },
  ];
  return { scene: { ...scene, effectZones: zones }, idx: zones.length - 1 };
}

/** Renomme l'id d'une ZONE D'EFFET (référencée par `FacadeSection.roomZoneIds` — lien Façade↔Pièce) et
 *  REPROPAGE la référence, pour qu'un rebaptême n'aille pas casser un lien déjà posé dans l'éditeur.
 *  Renvoie la scène inchangée si `from` absent, `to` vide/identique, ou collision d'id. */
export function renameEffectZone(scene: Scene, from: string, to: string): Scene {
  const next = to.trim();
  const zones = scene.effectZones ?? [];
  if (!next || next === from || zones.some((z) => z.id === next) || !zones.some((z) => z.id === from)) return scene;
  return {
    ...scene,
    effectZones: zones.map((z) => (z.id === from ? { ...z, id: next } : z)),
    architecture: scene.architecture?.map((body) => ({
      ...body,
      facades: body.facades.map((f) => (f.roomZoneIds?.includes(from)
        ? { ...f, roomZoneIds: f.roomZoneIds.map((id) => (id === from ? next : id)) }
        : f)),
    })),
  };
}


/** Renommage d'un id d'ACTION AUTHORÉE sur un décor — MÊME LOI que `renameEffectZone` ci-dessus : un
 *  id vide, inchangé, absent, ou DÉJÀ PORTÉ par une autre action du même décor rend la liste INCHANGÉE
 *  (référence identique — l'appelant y lit le refus sans second canal).
 *
 *  L'unicité des ids d'action est une règle du SCHÉMA (`refine` du def d'entité) : sans garde au geste,
 *  elle ne mordait qu'au chargement, et la scène VIVANTE portait deux actions homonymes que
 *  `jouerAction` confondait (il joue la première, le drapeau `unique` vaut pour les deux). */
export function renameActionAuthoree(actions: ActionAuthoree[], from: string, to: string): ActionAuthoree[] {
  const next = to.trim();
  if (!next || next === from || !actions.some((a) => a.id === from) || actions.some((a) => a.id === next)) return actions;
  return actions.map((a) => (a.id === from ? { ...a, id: next } : a));
}

/** Rattache une entité existante à la rencontre `encId` (créée si absente). No-op si déjà membre. */
export function addMember(scene: Scene, encId: string, entityId: string): { scene: Scene; encId: string } {
  const encs = scene.encounters.map((e) => ({ ...e, members: [...(e.members ?? [])] }));
  let target = encs.find((e) => e.id === encId);
  if (!target) {
    target = { id: encId || nextEntityId('enc', scene.encounters.map((e) => e.id)), members: [] };
    encs.push(target);
  }
  if (!target.members!.some((m) => m.entityId === entityId)) target.members!.push({ entityId });
  return { scene: { ...scene, encounters: encs }, encId: target.id };
}

/** Retire un membre (par entité) d'une rencontre — et toute monture qui le chevauchait. */
export function removeMember(scene: Scene, encId: string, entityId: string): Scene {
  return {
    ...scene,
    encounters: scene.encounters.map((e) => {
      if (e.id !== encId) return e;
      return {
        ...e,
        members: (e.members ?? [])
          .filter((m) => m.entityId !== entityId)
          .map((m) => (m.ridesEntityId === entityId ? { ...m, ridesEntityId: undefined } : m)),
      };
    }),
  };
}

/** Patche le contexte de rencontre d'un membre (camp/monture/chevauche). */
export function patchMember(scene: Scene, encId: string, entityId: string, patch: Partial<EncounterMember>): Scene {
  return {
    ...scene,
    encounters: scene.encounters.map((e) =>
      e.id === encId
        ? { ...e, members: (e.members ?? []).map((m) => (m.entityId === entityId ? { ...m, ...patch } : m)) }
        : e,
    ),
  };
}

/** Outil « combat » : POSE une entité-personnage de combat (cachée par défaut) à p, sur la couche `z`,
 *  ET l'enrôle dans la rencontre `encId` (créée si absente). `ref` = id STABLE d'une créature du
 *  bestiaire : la primitive VALIDE (fail-fast si l'id ne résout pas), elle ne normalise pas — un
 *  libellé passé à la place d'un id est une erreur d'appelant, jamais un cas à rattraper. Le libellé
 *  affiché se DÉRIVE de la créature résolue (`creatureLabel`), il ne recopie pas la clé.
 *  Une entité DÉJÀ posée à (p,z) est réutilisée (enrôlée) plutôt que dupliquée — même garde que les
 *  outils `entity`/`emplacement` (`entityAt`, #835 FU-3). */
export function addEnemyMember(scene: Scene, encId: string, ref: string, p: Pt, z = 0): { scene: Scene; encId: string; entityId: string } {
  const existing = entityAt(scene, p, z);
  if (existing) {
    const { scene: out, encId: usedEnc } = addMember(scene, encId, existing.id);
    return { scene: out, encId: usedEnc, entityId: existing.id };
  }
  if (!findCreatureById(ref))
    throw new Error(`addEnemyMember : « ${ref} » n'est pas un id de créature du bestiaire — une entité de scène se réfère par id STABLE (le libellé est de l'affichage)`);
  const id = nextEntityId('personnage', scene.entities.map((e) => e.id));
  const ent: SceneEntity = {
    id,
    kind: 'personnage',
    pos: { ...p },
    combat: { hiddenUntilCombat: true },
    ref,
    label: creatureLabel(ref),
  };
  const withEnt = addEntity(scene, ent, z);
  const { scene: out, encId: usedEnc } = addMember(withEnt, encId, id);
  return { scene: out, encId: usedEnc, entityId: id };
}

/** Gomme : retire l'entité posée sur p à l'étage `z` (les autres couches se suppriment via leur sélection). */
export function eraseAt(scene: Scene, p: Pt, z = 0): Scene {
  const ent = entityAt(scene, p, z);
  return ent ? removeEntity(scene, ent.id) : scene;
}

// ── Scalaires de scène (headless-editor) : champs sans widget SceneProps, posés par `buildScene`. Chacun
//    comble un gap identifié (échelle mer, lumière ambiante, flags initiaux). `undefined` retire le champ. ──

/** Échelle métrique d'une case (m/case). `undefined` = défaut (2 m). Pilote l'échelle MER (naval, MDG). */
export function setMetresPerTile(scene: Scene, m: number | undefined): Scene {
  const next = { ...scene };
  if (m === undefined) delete next.metresPerTile;
  else next.metresPerTile = m;
  return next;
}

/** Niveau de lumière ambiante par défaut (id). `undefined` = auto (horloge/ambiance). */
export function setAmbientLight(scene: Scene, id: string | undefined): Scene {
  const next = { ...scene };
  if (id === undefined) delete next.ambientLight;
  else next.ambientLight = id;
  return next;
}

/** NORD de la carte (degrés horaires depuis `−y`, cf. `Scene.northDeg`). `undefined` = nord implicite
 *  (0). La valeur est RAMENÉE dans `[0,360[` — un cap est un angle, pas un compteur : 450° et 90°
 *  désignent le même nord, et une valeur non finie n'en désigne aucun (le champ est alors retiré). */
export function setNorthDeg(scene: Scene, deg: number | undefined): Scene {
  const next = { ...scene };
  if (deg === undefined || !Number.isFinite(deg)) delete next.northDeg;
  else next.northDeg = ((deg % 360) + 360) % 360;
  return next;
}

/** Classification écologique (LDB 48 l.690, bonus de Domaine Vie/Ghyran). `undefined` = non spécifié
 *  (aucun bonus) — c'est une valeur distincte de rural/urbain/sauvage, pas un défaut caché. */
export function setEnvironment(scene: Scene, env: Scene['environment']): Scene {
  const next = { ...scene };
  if (env === undefined) delete next.environment;
  else next.environment = env;
  return next;
}

/** Fusionne des flags initiaux dans `scene.flags` (état de départ : porte ouverte, jalon posé…). */
export function setSceneFlags(scene: Scene, patch: Record<string, boolean>): Scene {
  return { ...scene, flags: { ...scene.flags, ...patch } };
}

/** Patche les champs de HAUT NIVEAU d'une entité (facing/label/crewIds/upgrades/light/statblock/foot…) —
 *  fusion superficielle. No-op si l'entité est absente. Source unique du câblage de données d'entité,
 *  partagée par `buildScene` (coque-navire : équipage/upgrades exposés, MDG 14) et l'inspecteur. */
export function patchEntity(scene: Scene, id: string, patch: Partial<SceneEntity>): Scene {
  return { ...scene, entities: scene.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}

// ── ASSISE AUTHORÉE — LE SEAM UNIQUE ───────────────────────────────────────────────────────────────
// INVARIANT : toute mutation d'éditeur qui touche une entité (pos, facing, z, ref, suppression —
// meuble OU corps) traverse `normaliseAssises`. Un seul point d'appel par primitive ; aucune écriture
// d'`entities` en direct depuis `src/ui/**`. La Scène rendue par un geste est donc TOUJOURS un
// document que `seatAssignmentDefects` accepte — jamais une correction différée au chargement.

/**
 * TAILLE de groupe que l'ÉDITEUR fait valoir. Un document authore des EMPLACEMENTS (« Héros 1 »…
 * « Héros N »), pas des héros : les quatre emplacements sont donc tous tenus pour déclarables, et
 * aucun ne s'élague à l'authoring. C'est au CHARGEMENT que la taille réelle du groupe tranche.
 */
const GROUPE_A_L_AUTHORING = PARTY_MAX;

/**
 * SEAM UNIQUE D'ASSISE — la scène rendue est normalisée en trois temps, dans cet ordre :
 *  1. ÉLAGAGE d'existence (`pruneSeatAssignments`) : meuble déposé, slot que la ref n'offre plus,
 *     corps disparu ;
 *  2. ÉLAGAGE d'OCCUPABILITÉ : une place que le prédicat unique `seatIsOccupiable` refuse (abord
 *     effectif devenu infranchissable — meuble poussé dans un recoin, passage muré) est LEVÉE, jamais
 *     honorée en posant un corps dans un mur ;
 *  3. REBASE : chaque corps authoré encore assis se tient sur l'abord RE-RÉSOLU de sa place. La
 *     résolution est celle de `seatSlotsOf` (réservation à l'échelle de la SCÈNE) : deux corps ne
 *     peuvent pas se retrouver sur la même case.
 * Une scène qui n'a jamais porté d'assise n'en gagne pas le champ (même référence rendue).
 */
export function normaliseAssises(scene: Scene, partySize: number): Scene {
  if (!scene.seatAssignments) return scene;
  const existants = pruneSeatAssignments(scene, partySize);
  const apresExistence = { ...scene, seatAssignments: existants };
  const occupables: SeatAssignments = {};
  for (const [propId, parMeuble] of Object.entries(existants)) {
    const places = seatSlotsOf(apresExistence, propId);
    for (const [slotId, occupant] of Object.entries(parMeuble)) {
      const place = places.find((candidate) => candidate.slotId === slotId);
      if (place && seatIsOccupiable(apresExistence, place)) (occupables[propId] ??= {})[slotId] = occupant;
    }
  }
  return rebaseSeatedBodies({ ...scene, seatAssignments: occupables });
}

/** Recale chaque corps AUTHORÉ assis sur l'abord RE-RÉSOLU de sa place. Appelé UNIQUEMENT par
 *  `normaliseAssises`, après les deux élagages : toute place encore là est occupable, donc l'abord
 *  posé est praticable. Scène INCHANGÉE (même référence) si personne n'a bougé. */
function rebaseSeatedBodies(scene: Scene): Scene {
  const cibles = new Map<string, Pt>();
  for (const [propId, parMeuble] of Object.entries(scene.seatAssignments ?? {})) {
    const places = seatSlotsOf(scene, propId);
    for (const [slotId, occupant] of Object.entries(parMeuble)) {
      if (occupant.kind !== 'entity') continue;
      const place = places.find((candidate) => candidate.slotId === slotId);
      if (place) cibles.set(occupant.entityId, { x: place.approach.x, y: place.approach.y });
    }
  }
  if (!cibles.size) return scene;
  let touche = false;
  const entities = scene.entities.map((e) => {
    const cible = cibles.get(e.id);
    if (!cible || (e.pos.x === cible.x && e.pos.y === cible.y)) return e;
    touche = true;
    return { ...e, pos: { ...e.pos, x: cible.x, y: cible.y } };
  });
  return touche ? { ...scene, entities } : scene;
}

/** Assoit `occupant` à la place `slotId` du meuble `propId` ET pose la `pos` du corps sur l'abord
 *  résolu, dans la MÊME écriture. `partySize` vient de l'APPELANT (l'éditeur fait valoir les
 *  emplacements déclarables, le jeu la taille réelle du groupe).
 *  Refus (raison stable) → scène d'entrée inchangée. */
export function seatOccupant(
  scene: Scene,
  propId: string,
  slotId: string,
  occupant: SeatOccupant,
  partySize: number,
): SeatAssignmentResult {
  const res = assignSeat(scene, propId, slotId, occupant, partySize);
  return res.ok ? { ...res, scene: normaliseAssises(res.scene, partySize) } : res;
}

/** Un patch d'authoring qui RETIRERAIT le type nommé d'une entité (`typeNonNomme`, #877, #1882). */
export class TypeNonNomme extends Error {
  constructor(absence: string) {
    super(`patch refusé — ${absence}`);
    this.name = 'TypeNonNomme';
  }
}

/** Patch d'AUTHORING d'une entité (libellé, orientation, étage, ref, statblock…) : la seule porte
 *  d'écriture d'entité ouverte à `src/ui/**`. Traverse le seam — tourner ou monter d'un étage un
 *  meuble attablé recale ou lève ses places dans la MÊME mutation. Juge la TRANSITION du type
 *  (`PORTEURS_DU_TYPE`) : un porteur avant, aucun après → `TypeNonNomme`, qui nomme l'entité. Une
 *  entité déjà sans type reçoit tout patch ; sa faute est dite par `validateScene`. */
export function editEntity(scene: Scene, id: string, patch: Partial<SceneEntity>): Scene {
  const avant = scene.entities.find((e) => e.id === id);
  const patchee = patchEntity(scene, id, patch);
  const apres = patchee.entities.find((e) => e.id === id);
  const absence = avant && apres && !typeNonNomme(avant) ? typeNonNomme(apres) : undefined;
  if (absence) throw new TypeNonNomme(absence);
  return normaliseAssises(patchee, GROUPE_A_L_AUTHORING);
}

/** Idem pour le sous-objet `combat` (fusion non écrasante) — même porte, même seam. */
export function editEntityCombat(scene: Scene, id: string, patch: Partial<NonNullable<SceneEntity['combat']>>): Scene {
  return normaliseAssises(patchEntityCombat(scene, id, patch), GROUPE_A_L_AUTHORING);
}

/** Pose d'AUTHORING d'une entité NEUVE (palette, collage, builder d'emplacement) — la seule porte
 *  d'AJOUT ouverte à `src/ui/**`. L'ajout ne casse aucune assise, mais il n'est pas moins une
 *  écriture d'`entities` : il passe par la même porte, et l'interface n'a plus aucun motif d'en
 *  fabriquer la liste. L'ÉTAGE se pose ICI, une fois (`z` = couche demandée ; sol (0) = champ
 *  absent, convention du modèle) — l'appelant ne le recolle plus sur l'entité. */
export function addEntity(scene: Scene, ent: SceneEntity, z = 0): Scene {
  const pose: SceneEntity = { ...ent, z };
  if (!z) delete pose.z;
  return normaliseAssises({ ...scene, entities: [...scene.entities, pose] }, GROUPE_A_L_AUTHORING);
}

/** Suppression d'AUTHORING d'une entité — traverse le seam. */
export function removeEntity(scene: Scene, id: string): Scene {
  return normaliseAssises({ ...scene, entities: scene.entities.filter((e) => e.id !== id) }, GROUPE_A_L_AUTHORING);
}

/** Déplacement d'AUTHORING d'une entité : pose la case demandée, lève le corps de sa place s'il quitte
 *  l'abord de son siège, puis traverse le seam (qui emmène les attablés quand c'est le MEUBLE qui
 *  bouge, et lève les places devenues inoccupables). */
export function moveEntityTo(scene: Scene, id: string, to: Pt): Scene {
  const deplacee = { ...scene, entities: scene.entities.map((e) => (e.id === id ? { ...e, pos: { ...e.pos, x: to.x, y: to.y } } : e)) };
  const occupant: SeatOccupant = { kind: 'entity', entityId: id };
  const pose = seatPoseOf(scene, occupant);
  const quitte = !!pose && (pose.approach.x !== to.x || pose.approach.y !== to.y);
  return normaliseAssises(quitte ? releaseSeat(deplacee, occupant) : deplacee, GROUPE_A_L_AUTHORING);
}

/** Patche le sous-objet `combat` d'une entité SANS écraser l'existant (fusionne skills/spells/optionals/
 *  hiddenUntilCombat). Qualifie p.ex. un servant-ref au bon Groupe de Projectiles (AA 10 l.142). No-op si absente. */
export function patchEntityCombat(scene: Scene, id: string, patch: Partial<NonNullable<SceneEntity['combat']>>): Scene {
  return { ...scene, entities: scene.entities.map((e) => (e.id === id ? { ...e, combat: { ...e.combat, ...patch } } : e)) };
}

/** Pose (ou REMPLACE) la couche `z` avec des tuiles complètes + hauteurs et crénelure optionnelles, triée
 *  par z. Brique d'import d'une grille ASCII entière (`buildScene`) — là où `paintTiles`/`paintHeight`/
 *  `paintCrenellated` posent case par case. `crenellated` ABSENT garde celle de la couche remplacée (la
 *  pose ne parle que de ce qu'elle porte) ; PRÉSENT, il la remplace — c'est la voie du redimensionnement,
 *  qui remappe les merlons sur la nouvelle grille. */
export function putLayer(scene: Scene, z: number, tiles: Terrain[], height?: number[], crenellated?: (string | null)[]): Scene {
  // CARDINAL de la grille (#1789) : le refine du schéma garde les DOCUMENTS, ce mutateur garde le
  // RUNTIME — une couche posée courte rendrait des trous que `tileAt` devrait replier, et le repli
  // masquerait la pose malformée (`terrainWalkable(undefined) === false` là où le sol est praticable).
  const attendu = scene.dimensions.w * scene.dimensions.h;
  const court = ([['tiles', tiles.length], ['height', height?.length], ['crenellated', crenellated?.length]] as const).find(
    ([, n]) => n !== undefined && n !== attendu,
  );
  if (court)
    throw new Error(
      `putLayer : couche z=${z}, \`${court[0]}\` porte ${court[1]} entrée(s) pour une grille `
      + `${scene.dimensions.w}×${scene.dimensions.h} — il en faut EXACTEMENT ${attendu}`,
    );
  const prev = scene.layers.find((l) => l.z === z);
  const merlons = crenellated ?? prev?.crenellated;
  const layer = { z, tiles, ...(height ? { height } : {}), ...(merlons ? { crenellated: merlons } : {}) };
  const others = scene.layers.filter((l) => l.z !== z);
  return { ...scene, layers: [...others, layer].sort((a, b) => a.z - b.z) };
}

// ── Toiture DÉRIVÉE du plan (#829/#841) ──────────────────────────────────────────────────────────

/** Emprise RÉELLE d'un étage — RÈGLE PARTAGÉE par `validateBuildingMasses` (`state/mapSpec.ts`) et
 *  `deriveArchitectureMasses` : `z=0` se lit sur `interiorCells` (`planDefects.ts`, #881) — closes par
 *  les murs ET non déclarées à ciel ouvert (le rez peut avoir une cour à ciel ouvert, jamais toitée) ;
 *  `z>0` sur le PLANCHER RÉEL (terrain non-vide, PAS `isWalkable` — un décor multi-cases ne change pas
 *  la structure) : un étage est BÂTI par construction, y compris au-dessus d'une cour (galerie en
 *  anneau), mesuré sur La Diligence (#825ter). */
export function realFloorAt(scene: Scene): (z: number) => ReadonlySet<string> {
  const layerZs = new Set(scene.layers.map((l) => l.z));
  const { w, h } = scene.dimensions;
  const cache = new Map<number, Set<string>>();
  return (z: number): ReadonlySet<string> => {
    if (z === 0) return interiorCells(scene, 0);
    const cached = cache.get(z);
    if (cached) return cached;
    const out = new Set<string>();
    if (layerZs.has(z))
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!estAbsent(tileAt(scene, x, y, z))) out.add(`${x},${y}`);
    cache.set(z, out);
    return out;
  };
}

/** Cases explicitement retirées de la dérivation/couverture (#829, `ArchitectureBody.roofExclusions`,
 *  cour à ciel ouvert à ÉTAGE) — indexées par étage, partagées par `validateBuildingMasses` (la
 *  couverture n'y est plus exigée) et `deriveArchitectureMasses` (le plancher réel y est ignoré). */
export function roofExclusionsByZ(body: ArchitectureBody): Map<number, Set<string>> {
  const out = new Map<number, Set<string>>();
  for (const ex of body.roofExclusions ?? []) {
    const set = out.get(ex.z) ?? (out.set(ex.z, new Set()).get(ex.z)!);
    for (let y = ex.rect.y; y < ex.rect.y + ex.rect.h; y++)
      for (let x = ex.rect.x; x < ex.rect.x + ex.rect.w; x++) set.add(`${x},${y}`);
  }
  return out;
}

/**
 * TOITURE EFFECTIVE d'un corps — SEUL site qui lit ensemble les trois porteurs (#1715), dans cet
 * ordre : la SURCHARGE du corps (`ArchitectureBody.roofDefaults`), puis la couverture du TYPE de
 * bâtiment (`buildings.json › roofMaterial` — une forge est couverte d'ardoise par son type), puis la
 * toiture de la SCÈNE (`Scene.roofDefaults`, EXIGÉE au schéma : aucun repli en code ne reste).
 * Le type ne porte QUE la matière. La pente de RÉFÉRENCE se lit sur la SCÈNE SEULE — un `pitchDeg` de
 * corps POSE une pente qui ne s'adapte jamais à la portée (rendue telle quelle ci-dessous), il ne
 * surcharge pas la référence ; la borne de comble, elle, se lit corps > scène.
 *
 * `penteReference` est la pente la plus RAIDE que la dérivation pose : `fittedPitchDeg` la rabat
 * jusqu'à ce que le comble tienne dans `riseMaxStoreys` (#947). `profile`/`pitchDeg`/`eaveSide` sont
 * rendus tels que le corps les porte — absents, ils restent des CHOIX du socle : le profil se lit sur
 * la PORTÉE, la pente se dérive.
 */
export function toitureEffective(scene: Scene, body: ArchitectureBody): {
  material: string;
  riseMaxStoreys: number;
  penteReference: number;
  profile?: RoofDefaults['profile'];
  pitchDeg?: number;
  eaveSide?: RoofDefaults['eaveSide'];
} {
  const corps = body.roofDefaults;
  const scenique: SceneRoofDefaults = scene.roofDefaults;
  return {
    material: corps?.material ?? buildingRoofMaterial(body.style) ?? scenique.material,
    riseMaxStoreys: corps?.riseMaxStoreys ?? scenique.riseMaxStoreys,
    penteReference: scenique.pitchDeg,
    ...(corps?.profile !== undefined ? { profile: corps.profile } : {}),
    ...(corps?.pitchDeg !== undefined ? { pitchDeg: corps.pitchDeg } : {}),
    ...(corps?.eaveSide !== undefined ? { eaveSide: corps.eaveSide } : {}),
  };
}

/**
 * Écrit UN champ de la SURCHARGE de toiture d'un corps (#1715) — pur, testé hors JSX. `undefined` =
 * « suivre » : le champ QUITTE le corps, et un corps qui ne surcharge plus rien perd `roofDefaults`
 * entier. C'est ce qui garde le premier réglage MINIMAL : régler la couverture ne matérialise ni
 * profil ni pente, donc la pente continue de s'adapter à la portée et le profil de suivre la portée.
 * Appelé par le panneau de CORPS de l'inspecteur (`ui/editor/Inspector.tsx`).
 */
export function poseToitureDeCorps(
  body: ArchitectureBody,
  // Le champ est une CLÉ, jamais un paramètre de type : la garde d'éditabilité (#841,
  // `scene-field-editability-guard`) crédite une clé calculée par les littéraux de chaîne de SON
  // type — un `K extends keyof …` ne lui rend rien, et les cinq champs passeraient pour orphelins.
  champ: keyof RoofDefaults,
  valeur: RoofDefaults[keyof RoofDefaults] | undefined,
): ArchitectureBody {
  const { [champ]: _retire, ...reste } = (body.roofDefaults ?? {}) as RoofDefaults;
  if (valeur !== undefined) {
    const roofDefaults: RoofDefaults = { ...reste, [champ]: valeur };
    return { ...body, roofDefaults };
  }
  if (Object.keys(reste).length === 0) {
    const { roofDefaults: _vide, ...sansToiture } = body;
    return sansToiture;
  }
  return { ...body, roofDefaults: reste };
}

/** Pente (°) d'une nappe DÉRIVÉE de portée `spanTiles` : la pente de RÉFÉRENCE, rabattue jusqu'à ce
 *  que le comble tienne dans `riseMaxStoreys` hauteurs d'étage. C'est la PENTE qui s'adapte à la
 *  portée — jamais la couverture qui se redécoupe (#947) : un corps profond porte un toit plus PLAT,
 *  comme le bâti réel. `montée = portée / 2 × tan(pente)` (`riseAt`, `gameIso/builders/roofs.ts`) ⇒
 *  `pente ≤ atan(2 × montéeMax / portée)`. Arrondie au dixième de degré vers le BAS : la borne reste
 *  tenue et la pente écrite dans la masse reste lisible à l'inspecteur. AUCUN plancher de pente — une
 *  portée qui en exigerait une hors plage sensée sort en masse SIGNALÉE (`validateScene`), jamais
 *  repliée en silence sur une valeur arbitraire. */
export function fittedPitchDeg(spanTiles: number, metresPerTile: number, referencePitchDeg: number, riseMaxStoreys: number): number {
  const capDeg = (Math.atan((2 * riseMaxStoreys * METRES_PER_LEVEL) / (spanTiles * metresPerTile)) * 180) / Math.PI;
  return Math.floor(Math.min(referencePitchDeg, capDeg) * 10) / 10;
}

/** Portée (m) au-delà de laquelle un corps ne se coiffe plus d'un simple PIGNON — la distance
 *  d'égout à égout qu'une nappe à deux pentes franchit en gardant un comble de proportion tenable.
 *  C'est une contrainte de FORME, jamais de NOMBRE : un corps plus profond garde UNE toiture, en
 *  CROUPE (`hip`) — ses extrémités s'abattent au lieu de dresser deux grands pignons triangulaires,
 *  et le volume se ferme. Valeur relevée sur la planche officielle (`art-ref/page012_img3.png`) :
 *  pour ~48 m de façade, les ailes du plan tiennent dans une bande de 4 à 8 m de profondeur, et leur
 *  élévation ne montre que des pignons. Convertie en cases par `metresPerTile` de la scène — la
 *  borne est MÉTRIQUE, jamais un nombre de cases figé. */
export const ROOF_GABLE_SPAN_MAX_M = 8;

function vkey(x: number, y: number): string { return `${x},${y}`; }

/** Cellules d'une emprise de masse. */
function footprintCells(footprint: readonly ArchitectureRect[]): Set<string> {
  const out = new Set<string>();
  for (const rect of footprint)
    for (let y = rect.y; y < rect.y + rect.h; y++)
      for (let x = rect.x; x < rect.x + rect.w; x++) out.add(vkey(x, y));
  return out;
}

/** EMPRISE d'un corps PAR ÉTAGE — les `foot` des volumes (`parts[]`) du `storey` de CE `z`. Un corps
 *  n'occupe pas les mêmes cases à tous ses niveaux (retraits, ailes basses, tour), et un bâtiment
 *  peut se décrire en PLUSIEURS corps qui se superposent (rez d'un corps, étage d'un autre) : juger
 *  la couverture sur l'union tous-étages exigerait d'un corps qu'il coiffe l'étage d'un voisin.
 *  Lue par `validateBuildingMasses` (`state/mapSpec.ts`, portée par-étage de la règle de couverture). */
export function bodyFootCellsByZ(body: ArchitectureBody): Map<number, Set<string>> {
  const out = new Map<number, Set<string>>();
  for (const storey of body.storeys ?? []) {
    const set = out.get(storey.z) ?? (out.set(storey.z, new Set<string>()).get(storey.z)!);
    for (const key of footprintCells(storey.parts.map((part) => part.foot))) set.add(key);
  }
  return out;
}

/** EMPRISE d'un corps, tous étages confondus — union de `bodyFootCellsByZ`. BORNE de ce qu'un corps
 *  peut revendiquer à la dérivation (`deriveArchitectureMasses`) : une colonne se lit du haut de la
 *  scène vers le bas, donc sur toutes ses cases sans distinction d'étage. Vide = corps NON BORNÉ (le
 *  résiduel qui prend tout le plancher que les autres n'ont pas déclaré — au plus un par scène,
 *  `validateArchitectureResiduals` de `state/mapSpec.ts`) : la dérivation y est sans borne. */
export function bodyFootCells(body: ArchitectureBody): Set<string> {
  const out = new Set<string>();
  for (const cells of bodyFootCellsByZ(body).values()) for (const key of cells) out.add(key);
  return out;
}

/** Composantes 4-connexes de `cells`. */
function componentsOf4(cells: ReadonlySet<string>): Set<string>[] {
  const remaining = new Set(cells);
  const out: Set<string>[] = [];
  while (remaining.size) {
    const start = remaining.values().next().value as string;
    remaining.delete(start);
    const component = new Set<string>([start]);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i].split(',').map(Number);
      for (const next of [vkey(x - 1, y), vkey(x + 1, y), vkey(x, y - 1), vkey(x, y + 1)]) {
        if (!remaining.delete(next)) continue;
        component.add(next);
        queue.push(next);
      }
    }
    out.push(component);
  }
  return out;
}

/** Cases de la grille `w×h` ENCLOSES par `sheet` : hors de `sheet`, et sans chemin 4-connexe vers le
 *  DEHORS de la grille qui évite `sheet`. C'est la lecture géométrique d'un TROU — une trémie, un
 *  puits, une cour — par opposition à ce qui borde la nappe (une aile basse accolée communique avec le
 *  dehors, elle n'est enclose de rien). Lue par `deriveArchitectureMasses` : un trou enclos est TOITÉ
 *  par la nappe qui l'entoure. */
function enclosedHolesOf(sheet: ReadonlySet<string>, w: number, h: number): Set<string> {
  const outside = new Set<string>();
  const queue: [number, number][] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const key = vkey(x, y);
    if (sheet.has(key) || outside.has(key)) return;
    outside.add(key);
    queue.push([x, y]);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
  }
  const holes = new Set<string>();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const key = vkey(x, y);
      if (!sheet.has(key) && !outside.has(key)) holes.add(key);
    }
  return holes;
}

/** Cases de VOLÉE qui DÉBOUCHENT à l'étage `z` — leurs marches montent du plancher de `z-1` jusqu'à
 *  celui de `z` (`stairFlightCells`, `planDefects.ts`). Vide dès qu'une des deux couches manque : un
 *  trou n'est une trémie que s'il y a un plancher à trouer, et au dernier étage l'ouverture au-dessus
 *  d'une case est le CIEL. Indexée par l'étage de DÉBOUCHÉ, jamais par celui de la marche : c'est la
 *  seule nappe qu'une volée puisse ouvrir. */
export function flightOpeningsAt(scene: Scene, z: number): ReadonlySet<string> {
  const storeyZs = new Set(scene.layers.map((l) => l.z));
  if (!storeyZs.has(z) || !storeyZs.has(z - 1)) return new Set<string>();
  return stairFlightCells(scene, z - 1, z);
}

/** Cases qu'une nappe d'étage `z` peut légitimement COIFFER sans porter de plancher à `z` — les deux
 *  lectures géométriques de l'ADOPTION (`deriveArchitectureMasses`) : trou ENCLOS du plancher de cet
 *  étage (`enclosedHolesOf` — puits, cage, trémie), ou case de volée qui y DÉBOUCHE
 *  (`flightOpeningsAt`). RÈGLE PARTAGÉE avec `validateBuildingMasses` (`state/mapSpec.ts`) : ce
 *  qu'une masse a le droit de couvrir sans plancher au sommet est exactement ce que la dérivation
 *  sait adopter. Hors de ces deux lectures, une case sans plancher est un trou d'authoring — et le
 *  ciel se DÉCLARE (`roofExclusions`). */
export function adoptableOpeningsAt(scene: Scene, z: number): ReadonlySet<string> {
  const { w, h } = scene.dimensions;
  const out = enclosedHolesOf(realFloorAt(scene)(z), w, h);
  for (const key of flightOpeningsAt(scene, z)) out.add(key);
  return out;
}

/** Rectangle PLEIN d'aire maximale inscrit dans `cells` — histogramme de colonnes + pile, une passe
 *  en O(cases) : chaque rectangle maximal est examiné une fois, à la dépile de sa colonne la plus
 *  basse. Départage entièrement DÉTERMINISTE, du plus significatif au moins : aire, puis grand côté
 *  (le faîtage le plus long l'emporte à aire égale), puis `y` le plus petit, puis `x` le plus petit —
 *  aucun aléa, la même emprise rend toujours le même rectangle. `null` si `cells` est vide. */
function largestRectIn(cells: ReadonlySet<string>): ArchitectureRect | null {
  if (!cells.size) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const width = maxX - minX + 1;
  const heights = new Array<number>(width).fill(0);
  const stack: number[] = [];
  let best: ArchitectureRect | null = null;
  const beats = (a: ArchitectureRect, b: ArchitectureRect | null): boolean => {
    if (!b) return true;
    if (a.w * a.h !== b.w * b.h) return a.w * a.h > b.w * b.h;
    const longA = Math.max(a.w, a.h), longB = Math.max(b.w, b.h);
    if (longA !== longB) return longA > longB;
    if (a.y !== b.y) return a.y < b.y;
    return a.x < b.x;
  };
  for (let y = minY; y <= maxY; y++) {
    for (let i = 0; i < width; i++) heights[i] = cells.has(vkey(minX + i, y)) ? heights[i] + 1 : 0;
    stack.length = 0;
    for (let i = 0; i <= width; i++) {
      const cur = i < width ? heights[i] : 0;
      while (stack.length && heights[stack[stack.length - 1]] > cur) {
        const bar = heights[stack.pop()!];
        const left = stack.length ? stack[stack.length - 1] + 1 : 0;
        const candidate = { x: minX + left, y: y - bar + 1, w: i - left, h: bar };
        if (beats(candidate, best)) best = candidate;
      }
      stack.push(i);
    }
  }
  return best;
}

/** Portées LOCALES d'une emprise le long de `axis` : pour chaque tranche (toutes les cellules de même
 *  coordonnée sur `axis`), l'intervalle `[lo, hi[` occupé sur l'axe CROISÉ, en coordonnées de SOMMETS
 *  (`hi` = dernière cellule + 1). Emprise réelle, jamais boîte englobante : une jupe étroite accolée à
 *  une aile large garde SA portée. SOURCE UNIQUE de la lecture de portée, partagée par la dérivation
 *  des masses (choix du faîtage et du profil) et par la formule de montée du builder de toitures
 *  (`riseAt`, `gameIso/builders/roofs.ts`). */
export function localCrossSpans(cells: ReadonlySet<string>, axis: 'x' | 'y'): Map<number, { lo: number; hi: number }> {
  const rows = new Map<number, { lo: number; hi: number }>();
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    const along = axis === 'x' ? x : y;
    const cross = axis === 'x' ? y : x;
    const row = rows.get(along);
    if (!row) rows.set(along, { lo: cross, hi: cross + 1 });
    else { row.lo = Math.min(row.lo, cross); row.hi = Math.max(row.hi, cross + 1); }
  }
  return rows;
}

/** Portée MAXIMALE (cases) d'une emprise coiffée d'un faîtage porté par `ridge` — la plus large des
 *  tranches perpendiculaires au faîtage. C'est elle qui fixe la montée de la nappe (`montée =
 *  portée / 2 × tan(pente)`), donc la hauteur du comble. */
export function maxCrossSpan(cells: ReadonlySet<string>, ridge: 'x' | 'y'): number {
  let max = 0;
  for (const { lo, hi } of localCrossSpans(cells, ridge).values()) max = Math.max(max, hi - lo);
  return max;
}

/** Axe de faîtage d'une emprise DÉRIVÉE : celui qui donne la plus PETITE portée maximale — le faîtage
 *  court dans le sens de la longueur du corps, et le comble reste le plus bas que la forme permette.
 *  Départage déterministe à portée égale : le grand côté de la boîte englobante, puis 'x'. */
export function ridgeAxisOf(cells: ReadonlySet<string>): 'x' | 'y' {
  const spanX = maxCrossSpan(cells, 'x');
  const spanY = maxCrossSpan(cells, 'y');
  if (spanX !== spanY) return spanX < spanY ? 'x' : 'y';
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return maxX - minX >= maxY - minY ? 'x' : 'y';
}

/** COUVERTURE rectangulaire d'une emprise — extraction gloutonne du rectangle plein d'aire maximale
 *  (`largestRectIn`), répétée sur le reste jusqu'à épuisement. Le résultat PARTITIONNE `cells`
 *  exactement (aucun recouvrement, aucune case perdue) : c'est la forme sous laquelle un `footprint`
 *  (liste de rectangles) décrit un corps en L, en U ou en anneau autour d'une cour. DÉTERMINISTE, et
 *  la récurrence termine toujours — une case isolée est encore un rectangle 1×1. */
export function rectCoverOf(cells: ReadonlySet<string>): ArchitectureRect[] {
  const remaining = new Set(cells);
  const out: ArchitectureRect[] = [];
  while (remaining.size) {
    const rect = largestRectIn(remaining)!;
    out.push(rect);
    for (let y = rect.y; y < rect.y + rect.h; y++)
      for (let x = rect.x; x < rect.x + rect.w; x++) remaining.delete(vkey(x, y));
  }
  return out;
}

/** Portée maximale d'un PIGNON en CASES pour cette scène — `ROOF_GABLE_SPAN_MAX_M` ramenée à
 *  l'échelle de la grille, plancher à 1 case (une scène à très grosses cases garde le pignon sur une
 *  case de portée plutôt que sur aucune). */
export function gableSpanMaxTiles(scene: Scene): number {
  return Math.max(1, Math.floor(ROOF_GABLE_SPAN_MAX_M / sceneMetresPerTile(scene)));
}

/** DÉRIVE les masses manquantes de CHAQUE corps depuis le plancher réel (#829, corrige #822 : éditer
 *  un mur ne devait jamais exiger de re-déclarer les toitures). Les masses AUTHORÉES (sans
 *  `BuildingMass.derived`) restent des SURCHARGES — leurs cellules sont retirées du pool à dériver sur
 *  toute la plage `z-levels+1..z` qu'elles couvrent ; `roofExclusions` retire des cellules SANS les
 *  couvrir (cour à ciel ouvert). Les masses PORTANT `derived` sont jetées puis recalculées : la
 *  fonction est IDEMPOTENTE et rejouable sur une scène déjà compilée — c'est ce qui permet à
 *  l'éditeur de faire suivre la toiture quand l'intention change (#841), sans repasser par `buildScene`.
 *  Note : plusieurs corps peuvent coexister sur la MÊME scène — `claimed` est un pool PARTAGÉ, rempli
 *  par les surcharges de TOUS les corps d'abord, puis par chaque dérivation dans l'ORDRE du tableau :
 *  un corps ne dérive JAMAIS une case déjà prise par un autre (surcharge ou dérivation précédente),
 *  sinon deux corps se disputeraient le même plancher et doubleraient le toit. L'ordre du tableau ne
 *  décide POURTANT de rien pour un corps à volumes DÉCLARÉS : il est BORNÉ à son emprise
 *  (`bodyFootCells`, tous étages confondus — une colonne se lit du haut vers le bas) et, hors d'elle,
 *  ne revendique rien. Un corps SANS volume est non borné, donc ordre-dépendant : au plus UN par scène
 *  (`validateArchitectureResiduals`, `state/mapSpec.ts`), sinon l'attribution serait un tirage au sort.
 *  Le reste du plancher réel d'un corps se
 *  regroupe par colonne `(topZ, levels)` — le sommet naturel de la colonne (première case non prise en
 *  descendant depuis le haut de la scène) et le nombre de niveaux qu'elle porte en dessous (plancher
 *  contigu, mêmes retraits) ; une colonne OUVERTE au sommet (trémie de volée, trou enclos de la nappe)
 *  ADOPTE le groupe de ses voisines, le toit passe CONTINU au-dessus d'elle (#1181) — puis chaque
 *  groupe se décompose en composantes 4-connexes, et chaque
 *  composante porte UNE masse : un corps de bâtiment reçoit UN toit. Son emprise se décrit par une
 *  COUVERTURE de rectangles (`rectCoverOf` — un L, un U, un anneau autour d'une cour restent UNE masse),
 *  son faîtage court le long de sa plus grande dimension (`ridgeAxisOf`), et la portée ne règle que la
 *  FORME : au-delà de `gableSpanMaxTiles`, la nappe s'abat en CROUPE plutôt que de dresser deux grands
 *  pignons, et la HAUTEUR du comble est bornée par la pente (`fittedPitchDeg`, #947) : sur une
 *  grande portée la nappe s'aplatit au lieu de monter en pyramide. Profil/pente/matériau =
 *  `body.roofDefaults` — un profil et une pente AUTHORÉS passent avant la lecture de portée, croupe
 *  comprise ; faîtage TOUJOURS explicite pour ne jamais tomber sur le fail-fast
 *  « emprise carrée ». */
export function deriveArchitectureMasses(scene: Scene): ArchitectureBody[] {
  const floorAt = realFloorAt(scene);
  const layerZs = [...new Set(scene.layers.map((l) => l.z))].sort((a, b) => b - a);
  const { w, h } = scene.dimensions;
  const bodies = scene.architecture ?? [];

  // TRÉMIES de volée, indexées par l'étage de la MARCHE. Une case de volée porte bien un plancher (ses
  // marches) : ce qui la sépare du bâti voisin n'est PAS une ligne de toit, c'est l'ABSENCE de plancher
  // AU-DESSUS d'elle — l'ouverture par laquelle on monte. Sa colonne DÉBOUCHE donc sur la nappe du
  // dessus et en prend le groupe (adoption ci-dessous) : sans cette lecture, la dérivation en fait une
  // composante isolée, donc un édifice, dont l'égout se pose à la cote de la marche (`resolveMass` :
  // relief + `WALL_H_M`) — soit une nappe plantée DANS le volume que le bâti voisin enferme, qui
  // ressort en travers de sa façade.
  // La définition est celle des audits de plan (`stairFlightCells`, `planDefects.ts`) : la MÊME trémie
  // que `auditStairwells` déclare légitime et que `auditFacade` s'interdit de compter en mur manquant.
  // Une seule vérité géométrique — cotes de marches franchissables jusqu'au plancher du dessus —, jamais
  // un seuil de taille ni un test d'encerclement.
  // Indexées par l'étage de DÉBOUCHÉ (`flightOpeningsAt`), jamais par celui de la marche : une volée
  // n'ouvre QUE vers la nappe où elle monte.
  const openings = new Map<number, ReadonlySet<string>>();
  for (const z of layerZs) openings.set(z, flightOpeningsAt(scene, z));

  const claimed = new Set<string>(); // `${x},${y},${z}` déjà pris (surcharge/exclusion de N'IMPORTE quel corps)
  for (const body of bodies) {
    for (const mass of body.masses) {
      if (mass.derived) continue;
      const cells = footprintCells(mass.footprint);
      for (let z = mass.z - mass.levels + 1; z <= mass.z; z++)
        for (const key of cells) claimed.add(`${key},${z}`);
    }
    for (const [z, cells] of roofExclusionsByZ(body))
      for (const key of cells) claimed.add(`${key},${z}`);
  }

  // CIEL DÉCLARÉ : une `roofExclusions` vaut pour la COLONNE, pas pour le seul étage où elle est
  // écrite. Retirer la case du seul `z` déclaré laissait la colonne se rabattre d'un cran plus bas et
  // poser une nappe DANS le volume, sous le ciel que l'auteur venait d'ouvrir. Aucune masse d'aucun
  // étage ne coiffe une case déclarée à ciel ouvert.
  const sky = new Set<string>();
  for (const body of bodies)
    for (const cells of roofExclusionsByZ(body).values()) for (const key of cells) sky.add(key);

  return bodies.map((body) => {
    const overrides = body.masses.filter((mass) => !mass.derived);
    const defaults = toitureEffective(scene, body);
    // BORNE d'emprise : un corps ne dérive que SUR SON PROPRE plancher (`bodyFootCells`), jamais sur
    // celui d'un voisin — `floorAt` rend le plancher de la scène ENTIÈRE, tous corps confondus.
    // Emprise vide (corps sans volume déclaré) = aucune borne : le pool partagé `claimed` reste le
    // seul arbitre, comme pour un bâtiment en cours de saisie à l'éditeur.
    const foot = bodyFootCells(body);
    const bounded = foot.size > 0;

    // COLONNE de chaque case : son sommet naturel (première case non prise en descendant depuis le
    // haut de la scène) et le nombre de niveaux qu'elle porte en dessous.
    type Column = { topZ: number; levels: number };
    const tops = new Map<string, Column>(); // "x,y" → colonne
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (bounded && !foot.has(vkey(x, y))) continue;
        if (sky.has(vkey(x, y))) continue; // ciel déclaré : la colonne entière est hors nappe
        let topZ: number | null = null;
        for (const z of layerZs) {
          if (claimed.has(`${x},${y},${z}`)) continue;
          if (floorAt(z).has(vkey(x, y))) { topZ = z; break; }
        }
        if (topZ === null) continue;
        let levels = 0;
        for (let z = topZ; z >= 0; z--) {
          if (claimed.has(`${x},${y},${z}`)) break;
          if (!floorAt(z).has(vkey(x, y))) break;
          levels++;
        }
        if (!levels) continue;
        tops.set(vkey(x, y), { topZ, levels });
      }

    // ADOPTION des colonnes OUVERTES au sommet (#1181) : une case bâtie dont le plancher s'arrête plus
    // bas que la nappe qui la borde prend le GROUPE de cette nappe — le toit passe CONTINU au-dessus
    // d'elle, à la hauteur de ce qui l'entoure, au lieu de laisser un trou de couverture ou de poser
    // une nappe basse dans le volume. Deux lectures géométriques, jamais un cas « escalier » :
    // la case est un TROU ENCLOS de la nappe (`enclosedHolesOf` — puits de lumière, cage), ou sa
    // propre colonne DÉBOUCHE sur CETTE nappe (`openings`, indexé par l'étage de débouché : ses
    // marches montent jusqu'à ce plancher-là, pas jusqu'à celui d'une tour accolée qui le dépasse).
    // Ce qui borde la nappe sans être enclos ni déboucher — une aile basse accolée — garde
    // sa propre hauteur. Le CIEL OUVERT se DÉCLARE (`roofExclusions`) : ses colonnes n'ont pas de
    // sommet du tout (`sky`), aucune adoption ne les reprend. Une case sans plancher NULLE PART (cour
    // du rez déclarée `exterior`) n'a pas de colonne, donc rien à adopter. Point fixe : chaque adoption fait monter le
    // sommet d'une case, la boucle termine sur le nombre d'étages.
    for (;;) {
      const sheets = new Map<number, Set<string>>();
      for (const [key, col] of tops)
        (sheets.get(col.topZ) ?? sheets.set(col.topZ, new Set<string>()).get(col.topZ)!).add(key);
      const holes = new Map<number, Set<string>>();
      for (const [z, sheet] of sheets) holes.set(z, enclosedHolesOf(sheet, w, h));
      const moves: [string, Column][] = [];
      for (const [key, col] of tops) {
        const [x, y] = key.split(',').map(Number);
        let best: Column | null = null;
        for (const nk of [vkey(x - 1, y), vkey(x + 1, y), vkey(x, y - 1), vkey(x, y + 1)]) {
          const nc = tops.get(nk);
          if (!nc || nc.topZ <= col.topZ) continue;
          if (floorAt(nc.topZ).has(key)) continue; // la case a SON plancher là-haut : rien d'ouvert
          const debouche = nc.topZ === col.topZ + 1 && openings.get(nc.topZ)?.has(key);
          if (!debouche && !holes.get(nc.topZ)?.has(key)) continue;
          let free = true;
          for (let z = nc.topZ - nc.levels + 1; z <= nc.topZ; z++) if (claimed.has(`${key},${z}`)) free = false;
          if (!free) continue;
          if (!best || nc.topZ > best.topZ || (nc.topZ === best.topZ && nc.levels > best.levels)) best = nc;
        }
        if (best) moves.push([key, { topZ: best.topZ, levels: best.levels }]);
      }
      if (!moves.length) break;
      for (const [key, col] of moves) tops.set(key, col);
    }

    const groups = new Map<string, Set<string>>(); // "topZ:levels" → cellules "x,y"
    for (const [key, col] of tops) {
      // Trémie qu'AUCUNE nappe ne domine (dernier étage exclu par construction, ou débouché déjà pris
      // par une surcharge) : elle ne fonde pas d'édifice à la cote de ses marches.
      if (openings.get(col.topZ + 1)?.has(key)) continue;
      const gkey = `${col.topZ}:${col.levels}`;
      const set = groups.get(gkey) ?? (groups.set(gkey, new Set<string>()).get(gkey)!);
      set.add(key);
    }

    const derived: BuildingMass[] = [];
    const spanMaxTiles = gableSpanMaxTiles(scene);
    for (const [key, cells] of groups) {
      const [topZStr, levelsStr] = key.split(':');
      const topZ = Number(topZStr);
      const levels = Number(levelsStr);
      let index = 0;
      for (const component of componentsOf4(cells)) {
        const ridge = ridgeAxisOf(component);
        const span = maxCrossSpan(component, ridge);
        derived.push({
          id: `${body.id}-auto-z${topZ}-l${levels}-${index++}`,
          z: topZ,
          footprint: rectCoverOf(component),
          levels,
          // La portée ne choisit plus un NOMBRE de toits, elle choisit une FORME : au-delà de la portée
          // de pignon, le corps garde sa nappe unique et s'abat en croupe.
          profile: defaults.profile
            ?? (span <= spanMaxTiles ? 'gable' : 'hip'),
          // La PENTE s'adapte à la portée sous la borne de comble ; une pente POSÉE par l'auteur ne
          // s'adapte jamais.
          pitchDeg: defaults.pitchDeg ?? fittedPitchDeg(
            span, sceneMetresPerTile(scene), defaults.penteReference, defaults.riseMaxStoreys,
          ),
          material: defaults.material,
          ridge,
          // `shed` : le côté d'égout bas vient de l'auteur (`RoofDefaults.eaveSide`) — la dérivation le
          // recopie, elle n'en invente aucun. Sans lui, la masse produite est signalée invalide
          // (`validateScene`) plutôt que repliée en silence sur un versant arbitraire.
          ...(defaults.profile === 'shed' && defaults.eaveSide ? { eaveSide: defaults.eaveSide } : {}),
          derived: true,
        });
        for (const cellKey of component)
          for (let z = topZ - levels + 1; z <= topZ; z++) claimed.add(`${cellKey},${z}`);
      }
    }
    return { ...body, masses: [...overrides, ...derived] };
  });
}

/** Corps d'architecture EFFECTIFS d'une scène — SOURCE UNIQUE lue au point de CONSOMMATION (#841) :
 *  l'intention (`roofDefaults`/`roofExclusions`, masses authorées) et le PLAN (zones intérieures au
 *  rez, plancher réel aux étages) sont les ENTRÉES ; les masses `derived` en sont le CALCUL, jamais un
 *  état à re-synchroniser après chaque mutation. Tout consommateur de `ArchitectureBody.masses` passe
 *  ICI (`gameIso/builders/` roofs/walls/props) : déplacer une pièce, peindre une case ou
 *  ajouter un étage fait suivre la toiture sans qu'aucune mutation n'ait à le savoir. Les masses
 *  AUTHORÉES (sans `derived`) traversent telles quelles — elles sont l'intention de l'auteur.
 *
 *  Mémoïsée par le patron canonique `memoByRef` (mesuré : 19 ms de dérivation pour 12 corps sur
 *  64×64×3, soit 34 % du coût de `buildRoofs`, et trois builders la lisent). */
const derivedArchitecture = memoByRef((scene: Scene) => deriveArchitectureMasses(scene));

export function effectiveArchitecture(scene: Scene): readonly ArchitectureBody[] {
  if (!scene.architecture?.length) return scene.architecture ?? [];
  return derivedArchitecture(scene);
}

/** MATÉRIALISE la dérivation DANS la scène : forme sous laquelle `buildScene` compile les masses et
 *  sous laquelle l'inspecteur les écrit. Instantané rejoué à la lecture par `effectiveArchitecture` —
 *  aucun consommateur ne s'y adosse. */
export function rederiveRoofMasses(scene: Scene): Scene {
  if (!scene.architecture?.length) return scene;
  return { ...scene, architecture: deriveArchitectureMasses(scene) };
}
