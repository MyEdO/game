/**
 * MUTATIONS PURES de Scène (Scene → Scene) — Node-safe, ZÉRO dépendance UI/gameIso. Elles vivent
 * hors de l'éditeur pour que le compilateur headless-editor (`noyau/mapSpec.buildScene`, exécuté via
 * `tsx` par le générateur d'arène en Node) puisse les rejouer sans tirer le rendu.
 *
 * Chaque fonction renvoie une NOUVELLE Scène (immuable) : ce sont les ÉCRIVAINS de l'éditeur, sa scène
 * vit hors du store. Les lectures (outil, sélection, picking, emprise du pinceau) vivent dans
 * `./sceneEditLecture`. NE JAMAIS importer `../ui/` ni `../gameIso/` ici.
 */
import {
  ActionAuthoree,
  DEFAULT_TERRAIN,
  dialoguesDeLaScene,
  emptyScene,
  Scene,
  SceneEntity,
  SceneEffectZone,
  type SceneStationAnchor,
  type Dialogue,
  type DialogueChoice,
  type Trigger,
  type EncounterDef,
  CellSide,
  canonEdge,
  EncounterMember,
  crenellatedAt,
  heightAt,
  layerTiles,
  porteAuteur,
  secretAuteur,
  tileAt,
  sceneMetresPerTile,
  reposDeScene,
  WallSeg,
  WallSide,
  ArchitectureBody,
  ArchitectureEdgeRef,
  ArchitecturePart,
  type ArchitectureStorey,
  type FacadeFeature,
  ArchitectureRect,
  FacadeSection,
  BuildingMass,
  RoofDefaults,
  ZoneArea,
  type SceneDesToits,
} from './monde/scene';
import { aretesA } from './monde/wallIndex';
import { memoByRef } from './monde/sceneMemo';
import type { FireArc, AuthoredShipPoste } from '../engine/types';
import type { Dir8 } from '../geometry/dir8';
import { EMPTY_FLOW } from '../engine/flowCore';
import type { Effect } from '../data/schemas/defs-scenes/effets';
import type { MapPlace, MapRoute, PlacePoi, WorldMap } from './worldMap';
import {
  ajouterLieu,
  ajouterPoi,
  BORNES_DE_CARTE,
  lierLieux,
  majCarte,
  majLieu,
  majRoute,
  supprimerLieu,
  supprimerRoute,
  type PatchDeCarte,
  type PatchDeRoute,
} from './worldMapEdit';
import { t as tr } from '../i18n';
import { nextEntityId } from '../lib/entityId';
import { findCreatureById, findPropById, refEstVolumique, semencesDeScene, siegeEngines } from '../data';
import { siegeEmplacementEntity } from './monde/siegeEmplacement';
import { stairFlightCells, interiorCells } from './planDefects';
import { estAbsent, terrainAbsent } from './monde/terrain';
import { PARTY_MAX } from './monde/combatants';
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
} from './monde/seating';
import { METRES_PER_LEVEL } from './monde/relief';
import {
  entityKindSchema,
  refusDeLEntite,
  typeNonNomme,
  type Terrain,
  type SceneRoofDefaults,
  type ReliefDefaults,
  PENTE_TOIT_DEG,
} from '../data/schemas/defs-scenes/scene';
import {
  champsDeclares,
  choixDuNoeud,
  cleOfferte,
  elementDuNoeud,
  formeAuPoint,
  recordDuNoeud,
  unionDuNoeud,
  varianteCourante,
  videDuNoeud,
  type ChoixDuContexte,
  type ContexteDuChamp,
} from './codex/editFields';
import { gestesDeLaListe, valeurNeuveDe, variantesAChoisir } from './valeursNeuves';
import { jsonCanonique } from '../lib/jsonCanonique.mjs';
import { buildingRoofMaterial } from './monde/buildings';
import { sceneZoneTiles, zoneAreaTiles } from './monde/zones';
import { tileKey, type Pt as ScenePt } from './monde/path';
import { premiereCaseEnAnneaux, tientDebout } from './monde/combatGeometry';
import { entiteFootTiles } from './monde/spawn';
import { actionNeuve } from './monde/usable';
import { CAP_IDENTITE_PROP, capDecorAdmis, type Calage } from '../data/props.types';
import { ancreDuDecor } from './monde/footprint';
import { appuiSous, emporterLesObjets, normaliserLesAppuis, poseDeLAncre } from './monde/poseDuDecor';
import { entitesEnCaseEtage } from './monde/decorIndex';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';
import { sitesDeLaScene } from '../data/schemas/defs-scenes/sites-de-paquet';
import {
  cheminOffert,
  choixDuChamp,
  DOCUMENTS,
  ecritureOfferte,
  noeudNeuf,
  formeDuPorteur,
  projetAvecLePorteur,
  type CadreDuPorteur,
  type ProjetDEdition,
  type DonneeDuPorteur,
  type SorteDePorteur,
  type EntityTool,
  type Sel,
  type Tool,
  EFFECT_ZONE_SEEDS,
  dansLaCarte,
  edgeWallState,
  effectZoneArea,
  effectZoneRect,
  empriseDuPinceau,
  entityAt,
  selPos,
  selRect,
  accesDe,
} from './sceneEditLecture';
import { estObjet } from '../lib/objet.mjs';
import { adresseRecalee, adresseRescellee, adressesScellees, estCheminDerive } from './edition/adresseDeProse';

export type Rect = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };

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

/** Réécrit le corps `bodyId` par `update`. No-op si le corps est absent. */
export function updateArchitectureBody(scene: Scene, bodyId: string, update: (body: ArchitectureBody) => ArchitectureBody): Scene {
  const body = scene.architecture?.find((candidate) => candidate.id === bodyId);
  if (!body) return scene;
  return { ...scene, architecture: scene.architecture!.map((candidate) => (candidate.id === bodyId ? update(candidate) : candidate)) };
}

/** Pose le libellé et le type de bâtiment du corps `bodyId` ; `undefined` retire le champ. Le type gouverne
 *  la couverture des toitures dérivées (`toitureEffective`) : le changer re-dérive les masses dans le geste. */
export function patchArchitectureBody(scene: Scene, bodyId: string, patch: Partial<Pick<ArchitectureBody, 'label' | 'style'>>): Scene {
  const out = updateArchitectureBody(scene, bodyId, (body) => champs(body, patch));
  return 'style' in patch ? rederiveRoofMasses(out) : out;
}

/** Pose un champ de l'INTENTION de toiture du corps (`poseToitureDeCorps`) et re-dérive ses masses. */
export function poseToitureDuCorps(scene: Scene, bodyId: string, champ: keyof RoofDefaults, valeur: RoofDefaults[keyof RoofDefaults] | undefined): Scene {
  return rederiveRoofMasses(updateArchitectureBody(scene, bodyId, (body) => poseToitureDeCorps(body, champ, valeur)));
}

type ExclusionDeToiture = NonNullable<ArchitectureBody['roofExclusions']>[number];

/** Ajoute au corps une exclusion de toiture sur `rect` (plafonné à la carte), à l'étage `z`, et re-dérive ses masses. */
export function addRoofExclusion(scene: Scene, bodyId: string, z: number, rect: Rect): Scene {
  return rederiveRoofMasses(updateArchitectureBody(scene, bodyId, (body) => ({
    ...body,
    roofExclusions: [...(body.roofExclusions ?? []), { z, rect: boundedRect(scene, rect) }],
  })));
}

/** Patche l'exclusion de toiture `i` du corps (rectangle plafonné à la carte) et re-dérive ses masses. */
export function patchRoofExclusion(scene: Scene, bodyId: string, i: number, patch: Partial<ExclusionDeToiture>): Scene {
  return rederiveRoofMasses(updateArchitectureBody(scene, bodyId, (body) => ({
    ...body,
    roofExclusions: (body.roofExclusions ?? []).map((ex, j) => (j === i ? { ...ex, ...patch, ...(patch.rect ? { rect: boundedRect(scene, patch.rect) } : {}) } : ex)),
  })));
}

/** Retire l'exclusion de toiture `i` du corps (la dernière retirée, le champ quitte le corps) et re-dérive. */
export function removeRoofExclusion(scene: Scene, bodyId: string, i: number): Scene {
  return rederiveRoofMasses(updateArchitectureBody(scene, bodyId, (body) => {
    const roofExclusions = (body.roofExclusions ?? []).filter((_, j) => j !== i);
    if (roofExclusions.length) return { ...body, roofExclusions };
    const { roofExclusions: _vide, ...sans } = body;
    return sans;
  }));
}

/** Patche l'étage `storeyId` du corps `bodyId`. */
export function patchArchitectureStorey(scene: Scene, bodyId: string, storeyId: string, patch: Partial<ArchitectureStorey>): Scene {
  return updateArchitectureBody(scene, bodyId, (body) => ({
    ...body,
    storeys: body.storeys.map((storey) => (storey.id === storeyId ? { ...storey, ...patch } : storey)),
  }));
}

/** Patche le volume `partId` ; son emprise est plafonnée à la carte (`boundedRect`, comme à sa création). */
export function patchArchitecturePart(scene: Scene, bodyId: string, storeyId: string, partId: string, patch: Partial<ArchitecturePart>): Scene {
  return updateArchitectureBody(scene, bodyId, (body) => ({
    ...body,
    storeys: body.storeys.map((storey) => (storey.id !== storeyId ? storey : {
      ...storey,
      parts: storey.parts.map((part) => (part.id !== partId ? part : { ...part, ...patch, ...(patch.foot ? { foot: boundedRect(scene, patch.foot) } : {}) })),
    })),
  }));
}

/** Patche le pan de façade `facadeId` du corps `bodyId`. */
export function patchFacadeSection(scene: Scene, bodyId: string, facadeId: string, patch: Partial<FacadeSection>): Scene {
  return updateArchitectureBody(scene, bodyId, (body) => ({
    ...body,
    facades: body.facades.map((facade) => (facade.id === facadeId ? { ...facade, ...patch } : facade)),
  }));
}

/** Arête `edge` portée à l'étage `z` (l'étage 0 est implicite). */
function areteALEtage<T extends { z?: number }>(edge: T, z: number): T {
  const { z: _avant, ...reste } = edge;
  return (z === 0 ? reste : { ...reste, z }) as T;
}

/** BORNES d'une ouverture de façade, en fraction de son arête : `offset` place son centre (0 = début,
 *  1 = fin), `width` est sa largeur. Lues par l'Inspecteur pour ses champs, tenues ici à l'écriture. */
export const BORNES_D_OUVERTURE = { offset: { min: 0, max: 1 }, width: { min: 0.05, max: 1 } } as const;
/** La position et la largeur d'une ouverture qui n'en porte pas, en fraction de l'arête. */
export const DEFAUTS_D_OUVERTURE = { offset: 0.5, width: 0.6 } as const;

/** Ouverture `feature` patchée par `patch`, chaque fraction ramenée dans `BORNES_D_OUVERTURE` ;
 *  `undefined` retire le champ (défaut de rendu). */
function ouverturePatchee(feature: FacadeFeature, patch: Partial<Omit<FacadeFeature, 'id'>>): FacadeFeature {
  const borne = (cle: keyof typeof BORNES_D_OUVERTURE, v: number | undefined) =>
    v === undefined ? undefined : Math.max(BORNES_D_OUVERTURE[cle].min, Math.min(BORNES_D_OUVERTURE[cle].max, Number.isFinite(v) ? v : BORNES_D_OUVERTURE[cle].min));
  const next = champs(feature, patch);
  return champs(next, { offset: borne('offset', next.offset), width: borne('width', next.width) });
}

/** Ajoute au pan de façade une ouverture en pignon sur sa première arête (id frais). null sans pan ni arête. */
export function addFacadeFeature(scene: Scene, bodyId: string, facadeId: string): { scene: Scene; id: string } | null {
  const facade = scene.architecture?.find((body) => body.id === bodyId)?.facades.find((f) => f.id === facadeId);
  const edge = facade?.edges[0];
  if (!facade || !edge) return null;
  const id = nextEntityId('feature', (facade.features ?? []).map((feature) => feature.id));
  return { scene: patchFacadeSection(scene, bodyId, facadeId, { features: [...(facade.features ?? []), { id, kind: 'gable', edge: { ...edge } }] }), id };
}

/** Patche l'ouverture `featureId` du pan de façade, aux bornes de `BORNES_D_OUVERTURE`. */
export function patchFacadeFeature(scene: Scene, bodyId: string, facadeId: string, featureId: string, patch: Partial<Omit<FacadeFeature, 'id'>>): Scene {
  const facade = scene.architecture?.find((body) => body.id === bodyId)?.facades.find((f) => f.id === facadeId);
  if (!facade?.features?.some((f) => f.id === featureId)) return scene;
  return patchFacadeSection(scene, bodyId, facadeId, { features: facade.features.map((f) => (f.id === featureId ? ouverturePatchee(f, patch) : f)) });
}

/** Retire l'ouverture `featureId` du pan de façade ; la dernière retirée, le champ quitte le pan. */
export function removeFacadeFeature(scene: Scene, bodyId: string, facadeId: string, featureId: string): Scene {
  const facade = scene.architecture?.find((body) => body.id === bodyId)?.facades.find((f) => f.id === facadeId);
  if (!facade?.features?.some((f) => f.id === featureId)) return scene;
  return updateArchitectureBody(scene, bodyId, (body) => ({
    ...body,
    facades: body.facades.map((f) => {
      if (f.id !== facadeId) return f;
      const features = (f.features ?? []).filter((feature) => feature.id !== featureId);
      if (features.length) return { ...f, features };
      const { features: _vide, ...sans } = f;
      return sans;
    }),
  }));
}

/** Porte le pan de façade `facadeId` à l'étage `z` : ses arêtes et celles de ses ouvertures le suivent. */
export function setFacadeSectionZ(scene: Scene, bodyId: string, facadeId: string, z: number): Scene {
  const facade = scene.architecture?.find((body) => body.id === bodyId)?.facades.find((f) => f.id === facadeId);
  if (!facade) return scene;
  return patchFacadeSection(scene, bodyId, facadeId, {
    z,
    edges: facade.edges.map((edge) => areteALEtage(edge, z)),
    features: facade.features?.map((feature) => ({ ...feature, edge: areteALEtage(feature.edge, z) })),
  });
}

/** Patche la masse de toiture `massId` aux bornes du schéma : chaque rectangle d'emprise plafonné à la
 *  carte, au moins un niveau entier, une pente dans `PENTE_TOIT_DEG`. */
export function patchBuildingMass(scene: Scene, bodyId: string, massId: string, patch: Partial<BuildingMass>): Scene {
  const borne: Partial<BuildingMass> = {
    ...patch,
    ...(patch.footprint ? { footprint: patch.footprint.map((r) => boundedRect(scene, r)) } : {}),
    ...(patch.levels !== undefined ? { levels: Math.max(1, Math.round(patch.levels) || 1) } : {}),
    ...(patch.pitchDeg !== undefined ? { pitchDeg: Math.max(PENTE_TOIT_DEG.min, Math.min(PENTE_TOIT_DEG.max, patch.pitchDeg || PENTE_TOIT_DEG.min)) } : {}),
  };
  return updateArchitectureBody(scene, bodyId, (body) => ({
    ...body,
    masses: body.masses.map((mass) => (mass.id === massId ? { ...mass, ...borne } : mass)),
  }));
}

/** Crée un corps BORNÉ dès sa naissance : son étage `z0` porte d'emblée un volume (`part`) à `foot`,
 *  l'emprise que le geste de création connaît (case visée à l'éditeur). Un corps sans aucun `part` est
 *  NON BORNÉ — sa dérivation (`deriveArchitectureMasses`) n'a plus d'autre arbitre que l'ordre du
 *  tableau, et deux tels corps se disputent silencieusement le même plancher : au plus UN par scène,
 *  vérifié par `validateArchitectureResiduals` (`noyau/mapSpec.ts`). L'auteur redimensionne ensuite ce
 *  volume (`resizeSel`) au lieu de partir d'un corps qui revendique toute la scène.
 *  `style` est le TYPE de bâtiment (`buildings.json`), OPTIONNEL au schéma : un corps qui n'en porte
 *  aucun est un bâti sans type (bourg, hameau, corps composite). */
export function addArchitectureBody(scene: Scene, style: ArchitectureBody['style'], foot: Rect): { scene: Scene; id: string; storeyId: string } {
  const id = nextEntityId('architecture', (scene.architecture ?? []).map((body) => body.id));
  const part: ArchitecturePart = { id: nextEntityId('part', []), foot: boundedRect(scene, foot) };
  const body: ArchitectureBody = { id, ...(style === undefined ? {} : { style }), storeys: [{ id: 'z0', z: 0, parts: [part], roomZoneIds: [] }], facades: [], masses: [] };
  return { scene: { ...scene, architecture: [...(scene.architecture ?? []), body] }, id, storeyId: body.storeys[0].id };
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

/** Ajoute au corps `bodyId` l'étage juste au-dessus de son plus haut étage, et la couche de scène qui le
 *  porte si elle manque (`addLayer`). null si le corps est introuvable. */
export function addStoreyAbove(scene: Scene, bodyId: string): { scene: Scene; id: string; z: number } | null {
  const body = scene.architecture?.find((candidate) => candidate.id === bodyId);
  if (!body) return null;
  const z = Math.max(...body.storeys.map((storey) => storey.z)) + 1;
  const out = addArchitectureStorey(scene, bodyId, z);
  return out && { scene: addLayer(out.scene, z), id: out.id, z };
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

/** Pose un pan de façade sur l'arête `edge` ; sa structure par défaut est la semence (`semences-de-scene.json`). */
export function addFacadeSection(scene: Scene, bodyId: string, edge: ArchitectureEdgeRef, appearance: string = semencesDeScene.facade.id): { scene: Scene; id: string } | null {
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
  const cases = empriseDuPinceau(scene.dimensions, p, brush);
  if (!cases.length) return scene;
  const { w } = scene.dimensions;
  const tiles = [...layerTiles(scene, z)];
  for (const c of cases) tiles[c.y * w + c.x] = terrain;
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
  if (aretesA(scene, x, y, diag, z).length) return { ...scene, walls: others.length ? others : undefined };
  return { ...scene, walls: [...others, { x, y, side: diag, ...(z ? { z } : {}) }] };
}

/** Forme CANONIQUE compacte d'un segment d'arête : on n'écrit que les champs significatifs (pas de z:0,
 *  pas de door:false, closed sans porte, secret hors porte fermée, fenêtre sur une porte, shuttered sans
 *  fenêtre, allège et suspendu hors croisée franchissable, structure vide) — même convention que `setEdgeWall`. */
function normWall(w: WallSeg): WallSeg {
  const porte = porteAuteur(w);
  const secret = secretAuteur(w);
  const fenetre = !porte && !!w.window;
  return {
    x: w.x, y: w.y, side: w.side,
    ...(w.z ? { z: w.z } : {}),
    ...(porte ? { door: true } : {}),
    ...(porte && w.closed ? { closed: true } : {}),
    ...(w.structure ? { structure: w.structure } : {}),
    ...(w.appearance ? { appearance: w.appearance } : {}),
    ...(porte && w.closed && secret ? { secret } : {}),
    ...(fenetre ? { window: true } : {}),
    ...(fenetre && w.shuttered ? { shuttered: true } : {}),
    ...(fenetre && w.crossable ? { crossable: true } : {}),
    ...(fenetre && w.crossable && w.allege !== undefined ? { allege: w.allege } : {}),
    ...(fenetre && w.crossable && w.suspendu !== undefined ? { suspendu: w.suspendu } : {}),
    ...(w.climb ? { climb: w.climb } : {}),
  };
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
  const cases = empriseDuPinceau(scene.dimensions, p, brush);
  if (!cases.length) return scene;
  const { w, h } = scene.dimensions;
  const layer = scene.layers.find((l) => l.z === z) ?? scene.layers[0];
  const height = [...(layer.height ?? new Array(w * h).fill(0))];
  for (const c of cases) height[c.y * w + c.x] = metres;
  return { ...scene, layers: scene.layers.map((l) => (l.z === layer.z ? { ...l, height } : l)) };
}

/** Marque un carré de côté `brush` centré sur p comme CRÉNELÉ (décoration de rendu ; id de structure
 *  crénelée = `structure`), sur la couche `z`. Miroir de `paintHeight` sur le tableau parallèle
 *  `crenellated`. `structure = null` efface. Marqueur de RENDU pur (le crest builder en dérive les merlons
 *  de périmètre) — n'affecte NI passabilité NI LdV ; orthogonal à la hauteur (`paintHeight`). */
export function paintCrenellated(scene: Scene, p: Pt, structure: string | null, brush: number, z = 0): Scene {
  const cases = empriseDuPinceau(scene.dimensions, p, brush);
  if (!cases.length) return scene;
  const { w, h } = scene.dimensions;
  const layer = scene.layers.find((l) => l.z === z) ?? scene.layers[0];
  const crenellated = [...(layer.crenellated ?? new Array(w * h).fill(null))] as (string | null)[];
  for (const c of cases) crenellated[c.y * w + c.x] = structure;
  return { ...scene, layers: scene.layers.map((l) => (l.z === layer.z ? { ...l, crenellated } : l)) };
}

/** Pose à p un emplacement via `siegeEmplacementEntity` : sa référence et son poste désignent un
 *  trapping du sous-type `armes-de-siege`. Les autres trappings et les ids inconnus rendent `null`. */
export function placeEmplacement(scene: Scene, trappingId: string, p: Pt, z = 0, facing?: Dir8): { scene: Scene; id: string } | null {
  const id = nextEntityId('personnage', scene.entities.map((e) => e.id));
  const ent = siegeEmplacementEntity(id, trappingId, p, facing ? { facing } : {});
  if (!ent) return null;
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
  return patchPoste0(scene, entityId, (p) => champ(p, 'side', side || undefined));
}

/** Change l'engin du poste : référence catalogue, libellé et `engin` de l'entité, équipage conservé.
 *  Seul un trapping du sous-type `armes-de-siege`, sélectionné par `siegeEngines`, est accepté. */
export function setPosteEngine(scene: Scene, entityId: string, trappingId: string): Scene {
  const t = siegeEngines().find((engin) => engin.id === trappingId);
  if (!t) return scene;
  const ent = scene.entities.find((e) => e.id === entityId && e.postes?.length);
  if (!ent) return scene;
  return editEntity(scene, entityId, {
    label: t.label,
    engin: { id: trappingId },
    postes: ent.postes!.map((p, i) => (i === 0 ? { ...p, trappingId } : p)),
  });
}

/** Clé d'appartenance d'une case à une emprise — (x,y) seuls : l'étage est celui de la ZONE. */
const cleDEmprise = (p: Pt) => tileKey(p.x, p.y);

/** Case de l'emprise, à l'étage de la zone (`z` omis au rez, comme `zoneAreaTiles`). */
const carveTile = (p: Pt, z?: number): ScenePt => (z ? { x: p.x, y: p.y, z } : { x: p.x, y: p.y });

/** Emprise NORMALISÉE : `tiles` disparaît dès que la découpe couvre TOUTE l'aire (« pleine » n'a
 *  qu'une seule représentation) et se matérialise sinon, triée pour un document stable. */
function withCarve(zone: SceneEffectZone, tiles: ScenePt[]): SceneEffectZone {
  const pleine = tiles.length >= zoneAreaTiles(zone.area, zone.z).length;
  return champ(zone, 'tiles', pleine ? undefined : [...tiles].sort((a, b) => a.y - b.y || a.x - b.x));
}

/** Boîte englobant la boîte de `area` ET la case `p` — support d'une emprise peinte HORS de l'aire. */
function areaCovering(area: ZoneArea, p: Pt): ZoneArea {
  const r = effectZoneRect(area);
  const x = Math.min(r.x, p.x);
  const y = Math.min(r.y, p.y);
  return { kind: 'rect', x, y, w: Math.max(r.x + r.w, p.x + 1) - x, h: Math.max(r.y + r.h, p.y + 1) - y };
}

/** PINCEAU d'emprise : met la case `p` DANS la zone (`add`) ou l'en SORT (`remove`), sans jamais
 *  basculer — repasser sur une case déjà peinte au glissé la laisse telle quelle. Peindre hors de la
 *  boîte de l'aire l'ÉTEND à la boîte englobante et matérialise l'emprise : la boîte n'est alors
 *  qu'un cadre, `sceneZoneTiles` reste exactement ce qui est peint (un disque peint au-delà de son rayon
 *  devient donc une emprise explicite dans une boîte rect). */
function paintEffectZoneTile(zone: SceneEffectZone, p: Pt, paint: 'add' | 'remove'): SceneEffectZone {
  const cur = sceneZoneTiles(zone);
  const key = cleDEmprise(p);
  const inside = cur.some((t) => cleDEmprise(t) === key);
  if (inside === (paint === 'add')) return zone;
  if (paint === 'remove') return withCarve(zone, cur.filter((t) => cleDEmprise(t) !== key));
  const full = zoneAreaTiles(zone.area, zone.z);
  const area = full.some((t) => cleDEmprise(t) === key) ? zone.area : areaCovering(zone.area, p);
  return withCarve({ ...zone, area }, [...cur, carveTile(p, zone.z)]);
}

/** Peint l'emprise de la zone d'id STABLE `zoneId` — couture de l'outil `zoneTiles` du canevas. */
export function paintEffectZone(scene: Scene, zoneId: string, p: Pt, paint: 'add' | 'remove'): Scene {
  const zones = scene.effectZones ?? [];
  if (!zones.some((z) => z.id === zoneId)) return scene;
  return { ...scene, effectZones: zones.map((z) => (z.id === zoneId ? paintEffectZoneTile(z, p, paint) : z)) };
}

/** Rétablit l'emprise PLEINE (la zone occupe toute son aire) — retire la découpe. */
export function clearEffectZoneCarve(zone: SceneEffectZone): SceneEffectZone {
  return champ(zone, 'tiles', undefined);
}

/** Change l'AIRE d'une zone en emportant sa découpe : les cases retenues SUIVENT la boîte (translation)
 *  puis sont ROGNÉES à la nouvelle aire. Sans ce recalage, déplacer ou redimensionner une zone découpée
 *  laisserait une emprise qui ne correspond plus à rien. */
export function setEffectZoneArea(zone: SceneEffectZone, area: ZoneArea): SceneEffectZone {
  if (!zone.tiles) return { ...zone, area };
  const from = effectZoneRect(zone.area);
  const to = effectZoneRect(area);
  const moved = zone.tiles.map((t) => carveTile({ x: t.x + (to.x - from.x), y: t.y + (to.y - from.y) }, zone.z));
  const inside = new Set(zoneAreaTiles(area, zone.z).map(cleDEmprise));
  return withCarve({ ...zone, area }, moved.filter((t) => inside.has(cleDEmprise(t))));
}

function clamp(v: number, max: number): number {
  return Math.max(0, Math.min(max - 1, v));
}
/** Case `p` plafonnée à la carte et ramenée à une case entière — la convention de pose du noyau : un geste
 *  hors carte se pose au bord. */
export function borneALaCarte(scene: Scene, p: Pt): Pt {
  return { x: clamp(Math.floor(p.x), scene.dimensions.w), y: clamp(Math.floor(p.y), scene.dimensions.h) };
}


/** Déplace la sélection vers `to` (clampée dans la carte). Scene inchangée si sélection invalide. */
export function moveSel(scene: Scene, sel: Sel, to: Pt): Scene {
  const { w, h } = scene.dimensions;
  if (sel?.type === 'entity') return moveEntityTo(scene, sel.id, borneALaCarte(scene, to));
  if (sel?.type === 'entry') {
    const pos = scene.entryPoints?.[sel.id];
    if (!pos) return scene;
    return { ...scene, entryPoints: { ...scene.entryPoints, [sel.id]: { ...pos, ...borneALaCarte(scene, to) } } };
  }
  if (sel?.type === 'trigger')
    return {
      ...scene,
      triggers: scene.triggers.map((t) =>
        t.id === sel.id ? { ...t, rect: { ...t.rect, x: clamp(to.x, w - t.rect.w + 1), y: clamp(to.y, h - t.rect.h + 1) } } : t,
      ),
    };
  if (sel?.type === 'restZone')
    return {
      ...scene,
      restZones: (scene.restZones ?? []).map((z, i) =>
        i === sel.idx ? { ...z, rect: { ...z.rect, x: clamp(to.x, w - z.rect.w + 1), y: clamp(to.y, h - z.rect.h + 1) } } : z,
      ),
    };
  if (sel?.type === 'effectZone')
    return {
      ...scene,
      effectZones: (scene.effectZones ?? []).map((z) => {
        if (z.id !== sel.id) return z;
        const r = effectZoneRect(z.area);
        const moved = { x: clamp(to.x, w - r.w + 1), y: clamp(to.y, h - r.h + 1), w: r.w, h: r.h };
        return setEffectZoneArea(z, effectZoneArea(z.area.kind, moved));
      }),
    };
  if (sel?.type === 'architecturePart')
    return {
      ...scene,
      architecture: scene.architecture?.map((body) => body.id !== sel.bodyId ? body : {
        ...body,
        storeys: body.storeys.map((storey) => storey.id !== sel.storeyId ? storey : {
          ...storey,
          parts: storey.parts.map((part) => part.id === sel.id ? { ...part, foot: { ...part.foot, x: clamp(to.x, w - part.foot.w + 1), y: clamp(to.y, h - part.foot.h + 1) } } : part),
        }),
      }),
    };
  if (sel?.type === 'roofSection')
    return {
      ...scene,
      architecture: scene.architecture?.map((body) => body.id !== sel.bodyId ? body : {
        ...body,
        masses: body.masses.map((mass) => {
          if (mass.id !== sel.id || mass.footprint.length === 0) return mass;
          const minX = Math.min(...mass.footprint.map((part) => part.x));
          const minY = Math.min(...mass.footprint.map((part) => part.y));
          const maxX = Math.max(...mass.footprint.map((part) => part.x + part.w));
          const maxY = Math.max(...mass.footprint.map((part) => part.y + part.h));
          const dx = clamp(to.x, w - (maxX - minX) + 1) - minX;
          const dy = clamp(to.y, h - (maxY - minY) + 1) - minY;
          return { ...mass, footprint: mass.footprint.map((part) => ({ ...part, x: part.x + dx, y: part.y + dy })) };
        }),
      }),
    };
  return scene;
}

/** Décale la sélection de (dx, dy) depuis son ancrage (`selPos`), plafonnée comme `moveSel`. */
export function nudgeSel(scene: Scene, sel: Sel, dx: number, dy: number): Scene {
  const p = selPos(scene, sel);
  return p ? moveSel(scene, sel, { x: p.x + dx, y: p.y + dy }) : scene;
}

/** Redimensionne le rect de la sélection (trigger/zone repos) : coin NW fixe, coin SE = `to` (≥ NW, clampé). */
export function resizeSel(scene: Scene, sel: Sel, to: Pt): Scene {
  const r = selRect(scene, sel);
  if (!r) return scene;
  const { w, h } = scene.dimensions;
  const next = rectFrom({ x: r.x, y: r.y }, { x: Math.max(r.x, clamp(to.x, w)), y: Math.max(r.y, clamp(to.y, h)) });
  if (sel?.type === 'trigger') return { ...scene, triggers: scene.triggers.map((t) => (t.id === sel.id ? { ...t, rect: { ...next, ...(t.rect.z ? { z: t.rect.z } : {}) } } : t)) };
  if (sel?.type === 'restZone') return { ...scene, restZones: (scene.restZones ?? []).map((z, i) => (i === sel.idx ? { ...z, rect: { ...next, ...(z.rect.z ? { z: z.rect.z } : {}) } } : z)) };
  if (sel?.type === 'effectZone') return { ...scene, effectZones: (scene.effectZones ?? []).map((z) => (z.id === sel.id ? setEffectZoneArea(z, effectZoneArea(z.area.kind, next)) : z)) };
  if (sel?.type === 'architecturePart') return {
    ...scene,
    architecture: scene.architecture?.map((body) => body.id !== sel.bodyId ? body : {
      ...body,
      storeys: body.storeys.map((storey) => storey.id !== sel.storeyId ? storey : { ...storey, parts: storey.parts.map((part) => part.id === sel.id ? { ...part, foot: next } : part) }),
    }),
  };
  if (sel?.type === 'roofSection') {
    const mass = scene.architecture?.find((body) => body.id === sel.bodyId)?.masses.find((candidate) => candidate.id === sel.id);
    // Section à UNE seule partie : le geste n'est pas ambigu, la poignée redimensionne cette partie.
    // Masse MULTI-parties : quelle partie redimensionner ? Ambigu — no-op explicite (#837), jamais une devinette.
    if (!mass || mass.footprint.length !== 1) return scene;
    return {
      ...scene,
      architecture: scene.architecture?.map((body) => body.id !== sel.bodyId ? body : {
        ...body,
        masses: body.masses.map((candidate) => candidate.id !== sel.id ? candidate : { ...candidate, footprint: [next] }),
      }),
    };
  }
  return scene;
}

/** Supprime l'élément sélectionné. Scene inchangée si rien/introuvable. Supprimer une entité retire
 *  aussi ses rattachements de rencontre (membre + toute monture qui la chevauchait). */
export function deleteSel(scene: Scene, sel: Sel): Scene {
  if (sel?.type === 'entity') {
    const encounters = scene.encounters.map((e) => {
      const members = (e.members ?? []).filter((m) => m.entityId !== sel.id);
      if (members.length === (e.members ?? []).length) return e;
      return { ...e, members: members.map((m) => (m.ridesEntityId?.id === sel.id ? { ...m, ridesEntityId: undefined } : m)) };
    });
    return { ...removeEntity({ ...scene, encounters }, sel.id) };
  }
  if (sel?.type === 'trigger') return { ...scene, triggers: scene.triggers.filter((t) => t.id !== sel.id) };
  // #841 FU-C : les CONTENEURS (corps/étage) étaient inatteignables (audit #835 les avait
  // signalés « feuilles seules ») — le corps entier disparaît avec ses étages/parties/façades/masses ;
  // l'étage protège le DERNIER de son corps (mirroir de `removeLayer` protégeant la base de la scène).
  if (sel?.type === 'architectureBody') return { ...scene, architecture: scene.architecture?.filter((body) => body.id !== sel.id) };
  if (sel?.type === 'architectureStorey') return {
    ...scene,
    architecture: scene.architecture?.map((body) => {
      if (body.id !== sel.bodyId || body.storeys.length <= 1) return body;
      return { ...body, storeys: body.storeys.filter((storey) => storey.id !== sel.id) };
    }),
  };
  if (sel?.type === 'facadeSection') return {
    ...scene,
    architecture: scene.architecture?.map((body) => body.id === sel.bodyId ? { ...body, facades: body.facades.filter((facade) => facade.id !== sel.id) } : body),
  };
  if (sel?.type === 'roofSection') return {
    ...scene,
    architecture: scene.architecture?.map((body) => body.id === sel.bodyId ? { ...body, masses: body.masses.filter((mass) => mass.id !== sel.id) } : body),
  };
  if (sel?.type === 'architecturePart') return {
    ...scene,
    architecture: scene.architecture?.map((body) => body.id !== sel.bodyId ? body : {
      ...body,
      storeys: body.storeys.map((storey) => storey.id === sel.storeyId ? { ...storey, parts: storey.parts.filter((part) => part.id !== sel.id) } : storey),
    }),
  };
  if (sel?.type === 'restZone') return { ...scene, restZones: (scene.restZones ?? []).filter((_, i) => i !== sel.idx) };
  if (sel?.type === 'effectZone') return { ...scene, effectZones: (scene.effectZones ?? []).filter((z) => z.id !== sel.id) };
  if (sel?.type === 'wall') {
    const others = (scene.walls ?? []).filter((w) => !(w.x === sel.x && w.y === sel.y && w.side === sel.side && (w.z ?? 0) === sel.z));
    return { ...scene, walls: others.length ? others : undefined };
  }
  if (sel?.type === 'entry') {
    const entries = { ...scene.entryPoints };
    delete entries[sel.id];
    return { ...scene, entryPoints: Object.keys(entries).length ? entries : undefined };
  }
  return scene;
}

/** Change le TYPE de décor d'une entité `prop` (avec ses défauts de pose et son cap admis,
 *  `propRefPatch`) et traverse le seam d'assise : le nouveau type n'offre pas les places de l'ancien, elles tombent dans la MÊME
 *  mutation. */
export function changePropRef(scene: Scene, propId: string, ref: string): Scene {
  const ent = scene.entities.find((e) => e.id === propId && e.kind === 'prop');
  return ent ? editEntity(scene, propId, propRefPatch(ref, ent)) : scene;
}

/** Pose une entité à p (id frais) depuis l'OUTIL tel que la palette le porte — il tient déjà le décor
 *  ou la fiche élue : aucun cas muet ne subsiste ici. Les props appliquent leurs défauts de catalogue
 *  (empreinte, interactif si fouillable) et se posent au point visé `point` (`poseAuPoint` : case, calage, appui) ;
 *  un personnage porte sa fiche en `creature` et le libellé de la fiche, son apparence se dérive du record (#1882). Une
 *  fiche absente du bestiaire lève. */
export function placeEntity(scene: Scene, outil: EntityTool, p: Pt, z = 0, point: Pt = p): { scene: Scene; id: string } {
  const id = nextEntityId(outil.kind, scene.entities.map((e) => e.id));
  const base: SceneEntity = { id, kind: outil.kind, pos: { ...p } };
  if (outil.kind === 'personnage' && !findCreatureById(outil.ref))
    throw new Error(`placeEntity : « ${outil.ref} » n'est pas une fiche du bestiaire — un personnage NOMME sa fiche par id STABLE (#1882)`);
  // #1463 S3 · #1882 : `nomDEntite`.
  const decor = (ref: string): SceneEntity => {
    const ent: SceneEntity = { ...base, ...propRefPatch(ref, undefined), label: findPropById(ref)?.label, ...(z ? { z } : {}) };
    return { ...ent, ...poseAuPoint(scene, ent, point) };
  };
  const ent: SceneEntity = outil.kind === 'prop'
    ? decor(outil.ref)
    : outil.kind === 'personnage'
      ? { ...base, creature: { id: outil.ref } }
      : { ...base, label: libelleDeValeur(entityKindSchema, outil.kind) };
  return { scene: addEntity(scene, ent, z), id }; // l'étage se pose à la porte d'ajout
}

/** AIMANT du calage : une composante à moins de cette distance du centre ou d'un bord s'y pose, pour qu'un décor se
 *  recentre ou se plaque sans viser au millimètre. */
const AIMANT_DU_CALAGE = 0.15;

const aimante = (c: number): number => (Math.abs(c) < AIMANT_DU_CALAGE ? 0 : Math.abs(c) > 1 - AIMANT_DU_CALAGE ? Math.sign(c) : c);

/** La POSE du décor `ent` dont l'ancre tombe au point `a` (cases continues), sur sa couche : la case de l'empreinte
 *  dont le centre est le plus proche du point, son calage dans son jeu libre (`calageDuDecalage`, aimanté, absent au
 *  centre) et le décor sur le dessus duquel elle tombe alors (`appuiSous`, jamais `ent` ni ce qu'il porte). La règle
 *  unique de la pose au point : la palette et le glissé la partagent. */
function poseAuPoint(scene: Scene, ent: SceneEntity, a: Pt): { pos: Pt; calage?: Calage; sur?: string } {
  const brut = poseDeLAncre(scene, ent, a);
  const calage: Calage = { x: aimante(brut.calage.x), y: aimante(brut.calage.y) };
  const pose = { pos: brut.pos, calage: calage.x || calage.y ? calage : undefined };
  const support = appuiSous(scene, ancreDuDecor({ ...ent, ...pose }, sceneMetresPerTile(scene)), ent.z ?? 0, ent.id);
  return { ...pose, sur: support?.id };
}

/** Pose le décor `id` au point `a` de la carte (`poseAuPoint`) : sa case, son calage et ce qui le porte, et ce qu'il
 *  porte le suit (`emporterLesObjets`). Le geste de glissé d'un décor à l'éditeur. */
export function poserLeDecorAuPoint(scene: Scene, id: string, a: Pt): Scene {
  const ent = scene.entities.find((e) => e.id === id && e.kind === 'prop');
  if (!ent) return scene;
  const pose = poseAuPoint(scene, ent, a);
  const posee = champ(champ({ ...ent, pos: pose.pos }, 'calage', pose.calage), 'sur', pose.sur);
  const apres = { ...scene, entities: scene.entities.map((e) => (e.id === id ? posee : e)) };
  return normaliserLaPose(emporterLesObjets(scene, apres, id));
}


/** Patch d'inspecteur quand on choisit un décor : pré-arme une action authorée `fouiller` si le prop
 *  est `searchable` ET que l'instance n'en porte encore AUCUNE. Ne touche jamais une liste d'actions
 *  existante. L'empreinte n'est PAS patchée : elle vient du catalogue (`PropData.foot`) et suit la ref
 *  au rendu. Un cap que le nouveau type refuse (`capDecorAdmis`) retombe au cap d'identité dans le
 *  MÊME patch : le geste ne crée pas de faute. PUR. */
export function propRefPatch(ref: string, avant: Pick<SceneEntity, 'usable' | 'facing'> | undefined): Partial<SceneEntity> {
  const usable = avant?.usable;
  const cap = capDecorAdmis(refEstVolumique(ref), avant?.facing) ? {} : { facing: CAP_IDENTITE_PROP };
  if (findPropById(ref)?.searchable && !usable?.actions?.length)
    return { decor: { id: ref }, ...cap, usable: { ...usable, actions: [actionNeuve([])] } };
  return { decor: { id: ref }, ...cap };
}

/** Colle une copie de `data` (id frais) à la case p plafonnée à la carte (`borneALaCarte`, comme
 *  `moveSel`), sur la couche `z` (défaut 0 — jamais le z SOURCE de l'entité copiée, cf. #835 FU-3 :
 *  coller reprend la couche ACTIVE de l'éditeur). */
export function pasteEntity(scene: Scene, data: SceneEntity, p: Pt, z = 0): { scene: Scene; id: string } {
  const id = nextEntityId(data.kind, scene.entities.map((e) => e.id));
  const ent: SceneEntity = { ...(JSON.parse(JSON.stringify(data)) as SceneEntity), id, pos: borneALaCarte(scene, p) };
  return { scene: addEntity(scene, ent, z), id };
}

/** Colle une copie de l'entité `ent` sur la case voisine au sud-est de la sienne (`pasteEntity`), sur sa couche. */
export function dupliquerLEntite(scene: Scene, ent: SceneEntity): { scene: Scene; id: string } {
  return pasteEntity(scene, ent, { x: ent.pos.x + 1, y: ent.pos.y + 1 }, ent.z ?? 0);
}

/** Pose une troupe de `n` copies du personnage `ent` (`pasteEntity`), chacune sur la case la plus proche de la sienne
 *  (`premiereCaseEnAnneaux`), sur sa couche, où toute son empreinte (`entiteFootTiles`) tient debout (`tientDebout`,
 *  joignable à pied depuis `ent`) hors des cases d'une autre entité de la couche ou d'une copie déjà posée. Chaque copie
 *  tire ses Caractéristiques au hasard (LDB 77 l.108) et entre dans chaque rencontre de `ent` au même titre, sans la
 *  monture qu'il chevauche. Moins de `n` copies quand la couche manque de cases. */
export function poserUneTroupe(scene: Scene, ent: SceneEntity, n: number): { scene: Scene; ids: string[] } {
  const z = ent.z ?? 0;
  const mpt = sceneMetresPerTile(scene);
  const cles = (e: SceneEntity) => entiteFootTiles(e, mpt).map((t) => tileKey(t.x, t.y, z));
  const tenues = new Set(scene.entities.filter((e) => (e.z ?? 0) === z).flatMap(cles));
  const tient = tientDebout(scene, { ...ent.pos, z }, tenues);
  const modele: SceneEntity = { ...ent, combat: { ...ent.combat, randomChars: true } };
  const portee = Math.max(scene.dimensions.w, scene.dimensions.h);
  let posee = scene;
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = premiereCaseEnAnneaux(ent.pos, 1, portee, (x, y) => entiteFootTiles({ ...modele, pos: { x, y } }, mpt).every((t) => tient(t.x, t.y)));
    if (!p) break;
    for (const k of cles({ ...modele, pos: p })) tenues.add(k);
    const copie = pasteEntity(posee, modele, p, z);
    posee = copie.scene;
    ids.push(copie.id);
  }
  const encounters = posee.encounters.map((enc) => {
    const m = enc.members?.find((mm) => mm.entityId === ent.id);
    return m ? { ...enc, members: [...enc.members!, ...ids.map((entityId) => ({ ...m, entityId, ridesEntityId: undefined }))] } : enc;
  });
  return { scene: { ...posee, encounters }, ids };
}

/** Pose un point d'entrée nommé `entree-N` (premier libre) à p, plafonné sur une case de la carte comme
 *  `editEntry` (`borneALaCarte`), sur l'étage `z` (défaut 0). Les transitions et la carte du monde le
 *  référencent par son id (#835 FU-5). */
export function placeEntry(scene: Scene, p: Pt, z = 0): { scene: Scene; id: string } {
  const id = nextEntityId('entree', Object.keys(scene.entryPoints ?? {}));
  return { scene: { ...scene, entryPoints: { ...scene.entryPoints, [id]: { ...borneALaCarte(scene, p), ...(z ? { z } : {}) } } }, id };
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

/** Patche le trigger `id` (`champs` : une clé portée à `undefined` en retire le champ). */
export function patchTrigger(scene: Scene, id: string, patch: Partial<Trigger>): Scene {
  return { ...scene, triggers: scene.triggers.map((t) => (t.id === id ? champs(t, patch) : t)) };
}

/** Renomme le trigger `from`. Refusé (scène inchangée) pour un id vide ou déjà porté par un autre trigger. */
export function renameTrigger(scene: Scene, from: string, to: string): Scene {
  const next = to.trim();
  if (!next || next === from || scene.triggers.some((t) => t.id === next) || !scene.triggers.some((t) => t.id === from)) return scene;
  return { ...scene, triggers: scene.triggers.map((t) => (t.id === from ? { ...t, id: next } : t)) };
}

/** Renomme la rencontre `from` et le PROPAGE à chaque effet « Démarrer un combat » et « Poursuite » de la scène qui la
 *  désigne (`sitesDeLaScene`). Refusé (scène inchangée) pour un id vide ou déjà porté par une autre rencontre.
 *  `sceneSchema` (portée `encounters`). */
export function renameEncounter(scene: Scene, from: string, to: string): Scene {
  const next = to.trim();
  if (!next || next === from || scene.encounters.some((e) => e.id === next) || !scene.encounters.some((e) => e.id === from)) return scene;
  const copie = structuredClone(scene);
  for (const { effet } of sitesDeLaScene(copie).effets) {
    const lance = effet as Effect;
    if ((lance.type === 'startCombat' || lance.type === 'startPursuit') && lance.encounter?.id === from) lance.encounter = { id: next };
  }
  return { ...copie, encounters: copie.encounters.map((e) => (e.id === from ? { ...e, id: next } : e)) };
}

/** Crée un dialogue d'un seul nœud de départ, sans choix (id frais). */
export function addDialogue(scene: Scene): { scene: Scene; id: string } {
  const id = nextEntityId('dlg', [...dialoguesDeLaScene(scene).keys()]);
  return { scene: { ...scene, dialogues: [...scene.dialogues, { id, start: { id: 'n1' }, nodes: [{ id: 'n1', choices: [] }] }] }, id };
}

/** Remplace le dialogue `id` par `dialogue` (son id compris). */
export function replaceDialogue(scene: Scene, id: string, dialogue: Dialogue): Scene {
  return { ...scene, dialogues: scene.dialogues.map((d) => (d.id === id ? dialogue : d)) };
}

/** Retire le dialogue `id`. */
export function removeDialogue(scene: Scene, id: string): Scene {
  return { ...scene, dialogues: scene.dialogues.filter((d) => d.id !== id) };
}

/** Renomme le dialogue `from` et le PROPAGE à ses ouvreurs : le `dialogueId` des entités et chaque effet
 *  « Ouvrir un dialogue » de la scène (`sitesDeLaScene`). Refusé (scène inchangée) pour un id vide ou
 *  déjà porté par un autre dialogue. `sceneSchema` (portée `dialogues`), `EFFECT_HANDLERS.startDialogue.refs`. */
export function renameDialogue(scene: Scene, from: string, to: string): Scene {
  const next = to.trim();
  const declares = dialoguesDeLaScene(scene);
  if (!next || next === from || declares.has(next) || !declares.has(from)) return scene;
  const copie = structuredClone(scene);
  for (const { effet } of sitesDeLaScene(copie).effets) {
    const ouvre = effet as Effect;
    if (ouvre.type === 'startDialogue' && ouvre.dialogue.id === from) ouvre.dialogue = { id: next };
  }
  const renomme = { ...copie, dialogues: copie.dialogues.map((d) => (d.id === from ? { ...d, id: next } : d)) };
  return renomme.entities.filter((e) => e.dialogueId?.id === from).reduce((s, e) => editEntity(s, e.id, { dialogueId: { id: next } }), renomme);
}

/** Ajoute au dialogue son nœud neuf (`noeudNeuf`). */
export function addDialogueNode(dialogue: Dialogue): { dialogue: Dialogue; id: string } {
  const noeud = noeudNeuf(dialogue);
  return { dialogue: { ...dialogue, nodes: [...dialogue.nodes, noeud] }, id: noeud.id };
}

/** Renomme le nœud `from` et le PROPAGE au départ et à chaque `next`, la boucle du nœud sur lui-même
 *  comprise. Refusé (dialogue inchangé) pour un id vide ou déjà porté par un autre nœud. `dialogueSchema`
 *  (portée `nodes`). */
export function renameDialogueNode(dialogue: Dialogue, from: string, to: string): Dialogue {
  const next = to.trim();
  if (!next || next === from || dialogue.nodes.some((n) => n.id === next) || !dialogue.nodes.some((n) => n.id === from)) return dialogue;
  return {
    ...dialogue,
    start: dialogue.start.id === from ? { id: next } : dialogue.start,
    nodes: dialogue.nodes.map((n) => ({
      ...n,
      id: n.id === from ? next : n.id,
      choices: n.choices.map((c) => (c.next?.id === from ? { ...c, next: { id: next } } : c)),
    })),
  };
}

/** Supprime le nœud `id` et COUPE chaque `next` qui le visait : le choix mène à la fin
 *  (`dialogueChoiceSchema.next` facultatif). Refusé (dialogue inchangé) pour le nœud de départ, que
 *  `dialogueSchema.start` exige. */
export function removeDialogueNode(dialogue: Dialogue, id: string): Dialogue {
  if (dialogue.start.id === id || !dialogue.nodes.some((n) => n.id === id)) return dialogue;
  const coupe = (c: DialogueChoice): DialogueChoice => {
    if (c.next?.id !== id) return c;
    const { next: _coupe, ...reste } = c;
    return reste;
  };
  return { ...dialogue, nodes: dialogue.nodes.filter((n) => n.id !== id).map((n) => ({ ...n, choices: n.choices.map(coupe) })) };
}

/** Crée une rencontre sans membre (id frais). */
export function addEncounter(scene: Scene): { scene: Scene; id: string } {
  const id = nextEntityId('enc', scene.encounters.map((e) => e.id));
  return { scene: { ...scene, encounters: [...scene.encounters, { id, members: [] }] }, id };
}

/** Patche la rencontre `id`. */
export function patchEncounter(scene: Scene, id: string, patch: Partial<EncounterDef>): Scene {
  return { ...scene, encounters: scene.encounters.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}

/** Retire la rencontre `id`. */
export function removeEncounter(scene: Scene, id: string): Scene {
  return { ...scene, encounters: scene.encounters.filter((e) => e.id !== id) };
}

/** Pose les blocs avancés lus (`lireBlocsAvances`) : chaque bloc présent REMPLACE celui de la scène. */
export function poseBlocsAvances(scene: Scene, blocs: { dialogues?: Dialogue[]; triggers?: Trigger[]; encounters?: EncounterDef[] }): Scene {
  return {
    ...scene,
    ...(blocs.dialogues !== undefined ? { dialogues: blocs.dialogues } : {}),
    ...(blocs.triggers !== undefined ? { triggers: blocs.triggers } : {}),
    ...(blocs.encounters !== undefined ? { encounters: blocs.encounters } : {}),
  };
}

/** Crée une zone de repos sur `rect`, à l'étage `z` (camp par défaut — lieux/qualité éditables dans l'inspecteur). */
export function addRestZone(scene: Scene, rect: Rect, z = 0): { scene: Scene; idx: number } {
  const zones = [...(scene.restZones ?? []), { rect: { ...rect, ...(z ? { z } : {}) }, places: reposDeScene({}) }];
  return { scene: { ...scene, restZones: zones }, idx: zones.length - 1 };
}

/** Patche la zone de repos d'indice `idx`. */
export function patchRestZone(scene: Scene, idx: number, patch: Partial<NonNullable<Scene['restZones']>[number]>): Scene {
  return { ...scene, restZones: (scene.restZones ?? []).map((z, i) => (i === idx ? { ...z, ...patch } : z)) };
}

/** Ce que l'inspecteur écrit sur la zone sélectionnée (`patchZone`) : sa couche ; d'un déclencheur, s'il ne joue
 *  qu'une fois ; d'une zone de repos, ses lieux et sa qualité piètre ; d'une zone d'effet, son nom, sa nature (`null` :
 *  non déclarée), sa forme, son emprise rendue pleine (`clearEffectZoneCarve`), si elle masque la ligne de vue et si
 *  elle barre le passage ; d'un déclencheur ou d'une zone d'effet, les entrées de fiche qu'il couvre (`null` : aucune). */
export interface PatchDeZone {
  z?: number;
  once?: boolean;
  lieux?: NonNullable<Scene['restZones']>[number]['places'];
  pietre?: boolean;
  nom?: string;
  presentation?: 'interior' | 'exterior' | null;
  forme?: ZoneArea['kind'];
  pleine?: true;
  blocksLoS?: boolean;
  barrier?: boolean;
  couvre?: string[] | null;
}

/** LA règle d'absence des écrivains de l'éditeur : `o` où le champ `k` vaut `v`, ou s'en retire quand `v` est
 *  `undefined`. */
function champ<T extends object, K extends keyof T>(o: T, k: K, v: T[K] | undefined): T {
  const out = { ...o };
  if (v === undefined) delete out[k];
  else out[k] = v;
  return out;
}

/** `o` où chaque champ de `patch` est posé par `champ` : une clé portée à `undefined` RETIRE le champ. */
function champs<T extends object>(o: T, patch: Partial<NoInfer<T>>): T {
  const poses: Partial<T> = patch;
  return (Object.keys(poses) as (keyof T)[]).reduce((out, k) => champ<T, keyof T>(out, k, poses[k]), o);
}

/** Un pas du chemin d'un champ dans sa donnée : une clé d'objet, ou un rang de liste. */
export type Segment = string | number;

type Objet = Record<string, unknown>;

/** Le nœud admet-il que son champ soit retiré ? */
const retirable = (noeud: unknown): boolean => videDuNoeud(noeud) === undefined;

/** La valeur `valeur` est-elle de la sorte du nœud `noeud`, où la valeur `actuelle` est écrite ? `undefined` : s'il
 *  admet le retrait ; d'un champ à choix, l'une de ses valeurs (`choixDuNoeud`) ; d'un objet, sa valeur neuve
 *  (`valeurNeuveDe`) ; d'une union, l'une de ses variantes à choisir (`variantesAChoisir`), ou de l'union qu'est sa
 *  variante courante ; d'une liste, l'actuelle après l'un de ses gestes (`gestesDeLaListe`) ; sinon, et pour une union
 *  ou une liste saisie entière, une valeur que le nœud parse. */
function admise(noeud: unknown, actuelle: unknown, valeur: unknown): boolean {
  if (valeur === undefined) return retirable(noeud);
  const choix = choixDuNoeud(noeud);
  if (choix) return choix.some((o) => o.valeur === valeur);
  if (champsDeclares(noeud)) return jsonCanonique(valeur) === jsonCanonique(valeurNeuveDe(noeud));
  const parse = () => (noeud as { safeParse: (v: unknown) => { success: boolean } }).safeParse(valeur).success;
  const jouee = jsonCanonique(valeur);
  const union = unionDuNoeud(noeud);
  if (union) {
    const courante = varianteCourante(union, actuelle)?.noeud;
    return variantesAChoisir(noeud, actuelle)!.some((v) => jsonCanonique(v.valeur) === jouee)
      || (unionDuNoeud(courante) !== undefined && admise(courante, actuelle, valeur)) || parse();
  }
  const element = elementDuNoeud(noeud);
  if (element !== undefined) {
    const gestes = gestesDeLaListe(Array.isArray(actuelle) ? actuelle : [], valeurNeuveDe(element));
    return [gestes.ajouter, ...gestes.elements.flatMap((e) => [e.retirer, e.monter])].some((l) => l && jsonCanonique(l) === jouee) || parse();
  }
  return parse();
}

/** Le conteneur `o` où le champ au chemin `[cle, ...reste]` vaut `valeur`, posé par `champ` (un élément de liste se
 *  remplace à son rang) ; un objet que ce retrait vide, au rang `rang` du chemin, en part aussi quand `vidable(rang)`. */
function ecrit(o: unknown, [cle, ...reste]: readonly Segment[], valeur: unknown, vidable: (rang: number) => boolean, rang = 0): unknown {
  const sous = (o as Record<Segment, unknown>)[cle];
  const suite = reste.length ? ecrit(sous, reste, valeur, vidable, rang + 1) : valeur;
  if (Array.isArray(o)) return o.map((e, i) => (i === cle ? suite : e));
  const vide = valeur === undefined && reste.length > 0 && Object.keys(sous as object).length > 0 && !Object.keys(suite as object).length;
  return champ(o as Objet, cle as string, vide && vidable(rang) ? undefined : suite);
}

/** Le nœud du pas `pas` depuis le point de nœud `noeud` et de valeur `point`, où le contexte pose les choix `poses` : le
 *  rang d'un élément d'une liste présente (`elementDuNoeud`) ; une clé du record présent (`recordDuNoeud`) qu'il porte, ou
 *  qu'il offre (`champsDuRecord`) : l'un des choix admis que le contexte y pose, sinon une clé qu'admet son nœud ; une clé
 *  déclarée de l'objet présent (`champsDeclares`), à travers ses unions (`formeAuPoint`), ni discriminant que tient le
 *  choix d'une variante, ni identité (`cleOfferte`) ; `undefined` si le formulaire ne l'offre pas. */
function noeudDuPas(noeud: unknown, point: unknown, pas: Segment, poses: () => readonly ChoixDuContexte[] | undefined): unknown {
  if (typeof pas === 'number') {
    const element = elementDuNoeud(noeud);
    return element !== undefined && Array.isArray(point) && Number.isInteger(pas) && pas >= 0 && pas < point.length ? element : undefined;
  }
  if (!estObjet(point)) return undefined;
  const record = recordDuNoeud(noeud);
  if (record) {
    const cles = poses();
    const offerte = cles ? cles.some((c) => c.refus === null && c.valeur === pas) : (record.cle as { safeParse: (v: unknown) => { success: boolean } }).safeParse(pas).success;
    return offerte || Object.keys(point).includes(pas) ? record.valeur : undefined;
  }
  const forme = formeAuPoint(noeud, point);
  const n = forme && champsDeclares(forme.noeud)?.find(([cle]) => cle === pas)?.[1];
  return n !== undefined && !forme!.tenus.includes(pas) && cleOfferte(pas, n) ? n : undefined;
}

/** Les nœuds de chaque pas du chemin `chemin` (`noeudDuPas`) depuis la donnée `donnee` de l'objet de schéma `objet`, aux
 *  choix `choix` que pose le contexte de son porteur, et la valeur au bout ; `undefined` si le formulaire n'offre pas
 *  l'un de ses pas, ou s'il est vide. */
function noeudsDuChemin(objet: unknown, donnee: Objet, chemin: readonly Segment[], choix: ContexteDuChamp['choix']): { noeuds: unknown[]; point: unknown } | undefined {
  const noeuds: unknown[] = [];
  let point: unknown = donnee;
  for (const [rang, pas] of chemin.entries()) {
    const noeud = noeudDuPas(noeuds.length ? noeuds[noeuds.length - 1] : objet, point, pas, () => choix(chemin.slice(0, rang)));
    if (noeud === undefined) return undefined;
    noeuds.push(noeud);
    point = (point as Record<Segment, unknown>)[pas];
  }
  return noeuds.length ? { noeuds, point } : undefined;
}

/** L'objet `point`, de nœud `noeud`, porte-t-il une donnée exigée présente hors de sa clé `cle` : un champ déclaré de
 *  sa forme (`formeAuPoint`) présent, dont l'absence n'est pas admise (`retirable`), ni `cle` ni un discriminant que
 *  tient le choix d'une variante ? */
function porteUneAutreExigee(noeud: unknown, point: unknown, cle: Segment): boolean {
  const forme = formeAuPoint(noeud, point);
  return (champsDeclares(forme?.noeud) ?? []).some(([k, n]) => k !== cle && !forme!.tenus.includes(k) && !retirable(n) && (point as Objet)[k] !== undefined);
}

/** Le chemin où s'écrit le retrait du champ au chemin `chemin` de la donnée `donnee` de l'objet de schéma `objet`, aux
 *  choix `choix` : le sien si son absence est admise (son nœud l'admet, ou il est l'entrée d'un record) ; sinon, de
 *  proche en proche à travers les clés des objets qui le portent, tant que chacun ne porte aucune autre donnée exigée
 *  présente (`porteUneAutreExigee`), celui du plus proche dont l'absence est admise, qui se retire entier, ses champs
 *  facultatifs avec lui ; ou son refus : un chemin que le formulaire n'offre pas (`nonOffert`), un champ que son objet
 *  exige (`requis`). */
function cheminDuRetrait(objet: unknown, donnee: Objet, chemin: readonly Segment[], choix: ContexteDuChamp['choix']): readonly Segment[] | 'nonOffert' | 'requis' {
  const noeuds = noeudsDuChemin(objet, donnee, chemin, choix)?.noeuds;
  if (!noeuds) return 'nonOffert';
  const absenceAdmise = (rang: number) => retirable(noeuds[rang]) || recordDuNoeud(rang ? noeuds[rang - 1] : objet) !== undefined;
  if (absenceAdmise(noeuds.length - 1)) return chemin;
  const points = chemin.reduce<unknown[]>((pts, pas) => [...pts, (pts[pts.length - 1] as Record<Segment, unknown>)[pas]], [donnee]);
  for (let rang = noeuds.length - 2; rang >= 0 && typeof chemin[rang + 1] === 'string'; rang--) {
    if (porteUneAutreExigee(noeuds[rang], points[rang + 1], chemin[rang + 1])) return 'requis';
    if (absenceAdmise(rang)) return chemin.slice(0, rang + 1);
  }
  return 'requis';
}

/** Pourquoi une valeur ne s'écrit pas : le formulaire n'offre pas son chemin, elle n'est pas de la sorte du champ, elle
 *  est arrivée `null` (un JSON illisible) là où le champ ne l'admet pas, elle est absente d'un champ que son objet exige
 *  (`cheminDuRetrait`), ou son porteur écrit enfreint une règle, dite. */
export type RefusDeValeur = 'nonOffert' | 'horsSorte' | 'illisible' | 'requis' | { regle: string };

/** Ce qu'écrit une valeur : la donnée écrite, ou son refus. */
export type EcritureDeValeur<T> = { ok: true; valeur: T } | { ok: false; refus: RefusDeValeur };

/** Les fautes du parse de l'objet de schéma `objet` sur `donnee`, chacune par son message et son chemin, ses rangs
 *  effacés : un retrait décale les rangs des éléments qui le suivent. */
const fautesDuParse = (objet: unknown, donnee: unknown): { cle: string; message: string }[] =>
  ((objet as { safeParse: (v: unknown) => { error?: { issues: { path: PropertyKey[]; message: string }[] } } }).safeParse(donnee).error?.issues ?? [])
    .map((i) => ({ cle: jsonCanonique([i.path.map((p) => (typeof p === 'number' ? '#' : String(p))), i.message]), message: i.message }));

/** Le message de la première faute du parse de `objet` sur `apres` qui n'était pas déjà sur `avant`, compte tenu des
 *  fautes égales (`fautesDuParse`) ; `undefined` sans faute neuve. */
function fauteNeuve(objet: unknown, avant: unknown, apres: unknown): string | undefined {
  const deja = new Map<string, number>();
  for (const { cle } of fautesDuParse(objet, avant)) deja.set(cle, (deja.get(cle) ?? 0) + 1);
  for (const { cle, message } of fautesDuParse(objet, apres)) {
    const reste = deja.get(cle) ?? 0;
    if (!reste) return message;
    deja.set(cle, reste - 1);
  }
  return undefined;
}

/** La donnée `donnee` de l'objet de schéma `objet` où `valeur` s'écrit au chemin `chemin` (`ecrit`), le champ retiré si
 *  elle vaut `undefined` (l'entrée d'un record partiel ou à clé ouverte, `recordDuNoeud`, se retire toujours), une liste
 *  vidée retirée si son nœud admet l'absence ; ou son refus : un pas que le formulaire n'offre pas (`noeudDuPas`), une
 *  valeur qui n'est pas l'un des choix admis que le contexte de son porteur y pose (`choix`, qui, d'un record, pose ses
 *  clés), ou, sans eux, pas de la sorte du champ (`admise`) ni, d'une liste, elle où s'ajoute en fin l'un des choix
 *  admis que ce contexte pose au rang qui suit son dernier élément ; un retrait (le champ retiré, la liste raccourcie) dont
 *  l'objet écrit porte une faute de son parse que la donnée ne portait pas (`fauteNeuve`), dite. Hors retrait, le schéma
 *  entier ne se vérifie qu'à l'enregistrement et à l'essai (#3606, décision 3). */
export function avecLaValeur(objet: unknown, donnee: Objet, chemin: readonly Segment[], valeur: unknown, choix: ContexteDuChamp['choix'] = () => undefined): EcritureDeValeur<Objet> {
  const pas = noeudsDuChemin(objet, donnee, chemin, choix);
  if (!pas) return { ok: false, refus: 'nonOffert' };
  const { noeuds, point } = pas;
  const dernier = noeuds[noeuds.length - 1];
  const ecrite = Array.isArray(valeur) && !valeur.length && elementDuNoeud(dernier) !== undefined && retirable(dernier) ? undefined : valeur;
  const poses = ecrite === undefined || recordDuNoeud(dernier) ? undefined : choix(chemin);
  const entreeRetiree = ecrite === undefined && recordDuNoeud(noeuds.length > 1 ? noeuds[noeuds.length - 2] : objet) !== undefined;
  const liste = Array.isArray(point) ? point : [];
  const ajoutee = () => elementDuNoeud(dernier) !== undefined && !!choix([...chemin, liste.length])?.some((c) => c.refus === null && jsonCanonique([...liste, c.valeur]) === jsonCanonique(ecrite));
  const ecrivable = poses ? poses.some((c) => c.refus === null && jsonCanonique(c.valeur) === jsonCanonique(ecrite)) : entreeRetiree || admise(dernier, point, ecrite) || ajoutee();
  if (!ecrivable) return { ok: false, refus: valeur === null ? 'illisible' : 'horsSorte' };
  const apres = ecrit(donnee, chemin, ecrite, (rang) => retirable(noeuds[rang])) as Objet;
  const retrait = ecrite === undefined || (Array.isArray(point) && Array.isArray(ecrite) && ecrite.length < point.length);
  const faute = retrait ? fauteNeuve(objet, donnee, apres) : undefined;
  return faute === undefined ? { ok: true, valeur: apres } : { ok: false, refus: { regle: faute } };
}

/** Où s'écrit `valeur` au chemin `chemin` du formulaire `forme` (`formeDuPorteur`) du porteur de sorte `sorte`, de
 *  donnée `donnee`, dans le cadre `cadre` : le chemin, ou, `valeur` absente, celui de son retrait (`cheminDuRetrait`) ;
 *  ou son refus : celui du retrait, une écriture hors de ses champs, ou qui emporte un champ qu'ils n'offrent pas
 *  (`ecritureOfferte`), à ce qu'une adresse de prose dérive (`estCheminDerive`), n'est pas offerte. */
function ouSEcrit<S extends SorteDePorteur>({ noeud, champs: offerts }: ReturnType<typeof formeDuPorteur>, sorte: S, donnee: DonneeDuPorteur[S], chemin: readonly Segment[], valeur: unknown, cadre: CadreDuPorteur): { ok: true; noeud: unknown; ecrit: readonly Segment[] } | { ok: false; refus: RefusDeValeur } {
  const ecrit = valeur === undefined ? cheminDuRetrait(noeud, donnee as unknown as Objet, chemin, (ici) => choixDuChamp(sorte, donnee, ici, cadre)) : chemin;
  if (typeof ecrit === 'string') return { ok: false, refus: ecrit };
  const actuelle = ecrit.reduce<unknown>((o, pas) => (estObjet(o) || Array.isArray(o) ? (o as Record<Segment, unknown>)[pas] : undefined), donnee);
  return ecritureOfferte(offerts, ecrit, actuelle) && !estCheminDerive(noeud, donnee, ecrit) ? { ok: true, noeud, ecrit } : { ok: false, refus: 'nonOffert' };
}

/** Le retrait de chaque champ, à son chemin, du formulaire du porteur de sorte `sorte`, de donnée `donnee`, dans le
 *  cadre `cadre`, s'écrit-il (`ouSEcrit`), sans compter les fautes du parse qu'il porterait (`fauteNeuve`) ? */
export function retraitOffert<S extends SorteDePorteur>(sorte: S, donnee: DonneeDuPorteur[S], cadre: CadreDuPorteur): (chemin: readonly Segment[]) => boolean {
  const forme = formeDuPorteur(sorte, donnee, cadre);
  return (chemin) => ouSEcrit(forme, sorte, donnee, chemin, undefined, cadre).ok;
}

/** La donnée `donnee` du porteur de sorte `sorte` où `valeur` s'écrit au chemin `chemin` de son formulaire, là où elle
 *  s'écrit (`ouSEcrit`, dans le cadre `cadre` ; `avecLaValeur`, aux choix que son contexte y pose, `choixDuChamp`), son
 *  adresse de prose recalée (`adresseRecalee`) et chaque fragment d'adresse scellé sur le `Source/` du cadre
 *  (`adressesScellees`) ; ou son refus : celui de `ouSEcrit`, ou une écriture qui apporte un fragment que seul un
 *  chapitre non chargé scellerait, n'est pas offerte. */
export function avecLaValeurDuPorteur<S extends SorteDePorteur>(sorte: S, donnee: DonneeDuPorteur[S], chemin: readonly Segment[], valeur: unknown, cadre: CadreDuPorteur): EcritureDeValeur<DonneeDuPorteur[S]> {
  const ou = ouSEcrit(formeDuPorteur(sorte, donnee, cadre), sorte, donnee, chemin, valeur, cadre);
  if (!ou.ok) return ou;
  const { noeud, ecrit } = ou;
  const ecrite = avecLaValeur(noeud, donnee as unknown as Objet, ecrit, valeur, (ici) => choixDuChamp(sorte, donnee, ici, cadre));
  if (!ecrite.ok) return ecrite;
  const scellee = adressesScellees(noeud, donnee, adresseRecalee(noeud, donnee, ecrite.valeur, ecrit), cadre.source);
  return scellee === undefined ? { ok: false, refus: 'nonOffert' } : { ok: true, valeur: scellee as DonneeDuPorteur[S] };
}

/** La donnée `donnee` du porteur de sorte `sorte` où l'adresse de prose au chemin `chemin` de son formulaire est
 *  rescellée après relecture (`adresseRescellee`), sur le `Source/` du cadre `cadre` ; ou son refus : un chemin que son
 *  formulaire n'offre pas, qui ne désigne pas une adresse, ou dont le chapitre n'est pas chargé. */
export function avecLAdresseRescellee<S extends SorteDePorteur>(sorte: S, donnee: DonneeDuPorteur[S], chemin: readonly Segment[], cadre: CadreDuPorteur): EcritureDeValeur<DonneeDuPorteur[S]> {
  const { noeud, champs: offerts } = formeDuPorteur(sorte, donnee, cadre);
  const rescellee = cheminOffert(offerts, chemin) ? adresseRescellee(noeud, donnee, chemin, cadre.source) : undefined;
  return rescellee === undefined ? { ok: false, refus: 'nonOffert' } : { ok: true, valeur: rescellee as DonneeDuPorteur[S] };
}

/** Le patch qui fait de `avant` l'objet `apres` : chaque champ de premier niveau qui change, posé à sa valeur
 *  d'`apres`, `undefined` s'il en est absent. */
function patchEntre<T extends object>(avant: T, apres: T): Partial<T> {
  const cles = new Set([...Object.keys(avant), ...Object.keys(apres)]);
  return Object.fromEntries([...cles].flatMap((cle) => {
    const v = (apres as Record<string, unknown>)[cle];
    return v === (avant as Record<string, unknown>)[cle] ? [] : [[cle, v]];
  })) as Partial<T>;
}

/** La scène `scene` où l'entité `avant` devient `apres`, chaque champ de premier niveau qui change posé par sa porte
 *  (`editEntity`) ; ou son refus, dit : la règle qu'enfreint l'entité écrite et que l'entité d'avant n'enfreignait pas
 *  (`TypeNonNomme`, `refusDeLEntite`), une entité déjà fautive restant éditable. */
function sceneAvecLEntite(scene: Scene, avant: SceneEntity, apres: SceneEntity): EcritureDeValeur<Scene> {
  const patch = patchEntre(avant, apres);
  let ecrite: Scene;
  try {
    ecrite = editEntity(scene, avant.id, patch);
  } catch (e) {
    if (e instanceof TypeNonNomme) return { ok: false, refus: { regle: e.message } };
    throw e;
  }
  const deja = new Set(refusDeLEntite(avant).map((f) => f.message));
  const neuve = ecrite.entities.filter((e) => e.id === avant.id).flatMap(refusDeLEntite).find((f) => !deja.has(f.message));
  return neuve ? { ok: false, refus: { regle: neuve.message } } : { ok: true, valeur: ecrite };
}

/** Ce qu'une table d'écriture déclare d'un porteur de la scène : la scène où sa donnée `avant` devient `apres`, ou son
 *  refus ; et, pour la sorte qui les a, la scène où un porteur neuf est créé, sous son identifiant ; celle où le porteur
 *  `de` prend l'identifiant `vers`, propagé à ce qui le désigne dans la scène ; celle où le porteur `id` est retiré ;
 *  celle où l'élément `de` de la sous-collection à clé du porteur `id` prend l'identifiant `vers`. Un renommage sous un
 *  identifiant vide ou déjà pris rend la scène telle quelle. */
interface EcritureDeScene<D> {
  ecrire: (scene: Scene, avant: D, apres: D) => EcritureDeValeur<Scene>;
  creer?: (scene: Scene) => { scene: Scene; id: string };
  renommer?: (scene: Scene, de: string, vers: string) => Scene;
  retirer?: (scene: Scene, id: string) => Scene;
  renommerElement?: (scene: Scene, id: string, de: string, vers: string) => Scene;
}

/** Ce que la table d'écriture d'une sorte de porteur déclare, sur le projet `projet` où la scène `sceneId` est
 *  montrée : le projet où sa donnée `avant` devient `apres`, ou son refus ; et, pour la sorte qui les a, le projet où un
 *  porteur neuf est créé depuis la sélection `depuis`, avec l'identifiant `avec` qu'elle offre (`avecs`), sous son
 *  identifiant (`undefined` : refusé) ; celui où le porteur `de` prend l'identifiant `vers`, propagé à ce qui
 *  le désigne ; celui où le porteur `id` est retiré ; celui où l'élément `de` de la sous-collection à clé du porteur
 *  `id` prend l'identifiant `vers` ; et ce qui refuse le retrait du porteur `id`, dit. Un renommage sous un identifiant
 *  vide ou déjà pris rend le projet tel quel. #3606 */
interface EcritureDuPorteur<D> {
  ecrire: (projet: ProjetDEdition, sceneId: string, avant: D, apres: D) => EcritureDeValeur<ProjetDEdition>;
  creer?: (projet: ProjetDEdition, sceneId: string, depuis: Sel, avec?: string) => { projet: ProjetDEdition; id: string } | undefined;
  avecs?: (projet: ProjetDEdition, sceneId: string, depuis: Sel) => readonly string[];
  renommer?: (projet: ProjetDEdition, sceneId: string, de: string, vers: string) => ProjetDEdition;
  retirer?: (projet: ProjetDEdition, sceneId: string, id: string) => ProjetDEdition;
  renommerElement?: (projet: ProjetDEdition, sceneId: string, id: string, de: string, vers: string) => ProjetDEdition;
  refusDeRetirer?: (projet: ProjetDEdition, sceneId: string, id: string) => string | undefined;
}

/** L'écriture du porteur que la table `e` écrit dans la scène montrée du projet (`DOCUMENTS`, `scene`) : chacun de ses
 *  écrivains relevé au projet, la scène lue puis réécrite, le projet tel quel quand elle l'est. */
function deLaScene<D>(e: EcritureDeScene<D>): EcritureDuPorteur<D>;
function deLaScene(e: Omit<EcritureDeScene<never>, 'ecrire'>): Omit<EcritureDuPorteur<never>, 'ecrire'>;
function deLaScene<D>(e: Partial<EcritureDeScene<D>>): Partial<EcritureDuPorteur<D>> {
  const { lire, ecrire } = DOCUMENTS.scene;
  const releve = (projet: ProjetDEdition, sceneId: string, f: (scene: Scene) => Scene): ProjetDEdition => {
    const scene = lire(projet, sceneId)!;
    const ecrite = f(scene);
    return ecrite === scene ? projet : ecrire(projet, sceneId, ecrite);
  };
  const { ecrire: ecrireLaScene, creer, renommer, retirer, renommerElement } = e;
  return {
    ...(ecrireLaScene && { ecrire: (projet: ProjetDEdition, sceneId: string, avant: D, apres: D): EcritureDeValeur<ProjetDEdition> => {
      const ecrite = ecrireLaScene(lire(projet, sceneId)!, avant, apres);
      return ecrite.ok ? { ok: true, valeur: ecrire(projet, sceneId, ecrite.valeur) } : ecrite;
    } }),
    ...(creer && { creer: (projet: ProjetDEdition, sceneId: string) => {
      const cree = creer(lire(projet, sceneId)!);
      return { projet: ecrire(projet, sceneId, cree.scene), id: cree.id };
    } }),
    ...(renommer && { renommer: (projet: ProjetDEdition, sceneId: string, de: string, vers: string) => releve(projet, sceneId, (sc) => renommer(sc, de, vers)) }),
    ...(retirer && { retirer: (projet: ProjetDEdition, sceneId: string, id: string) => releve(projet, sceneId, (sc) => retirer(sc, id)) }),
    ...(renommerElement && { renommerElement: (projet: ProjetDEdition, sceneId: string, id: string, de: string, vers: string) => releve(projet, sceneId, (sc) => renommerElement(sc, id, de, vers)) }),
  };
}

/** L'écriture du porteur de sorte `sorte` qui remplace sa donnée dans son document (`projetAvecLePorteur`). */
const remplace = <S extends SorteDePorteur>(sorte: S): EcritureDuPorteur<DonneeDuPorteur[S]>['ecrire'] =>
  (projet, sceneId, avant, apres) => ({ ok: true, valeur: projetAvecLePorteur(accesDe(sorte), projet, sceneId, avant, apres) });

/** Les routes de la carte du monde du projet `projet` dont l'embuscade lance la rencontre `id` de la scène `sceneId`
 *  (`WorldMap.routes[].ambush`). */
const routesDeLEmbuscade = (projet: ProjetDEdition, sceneId: string, id: string): WorldMap['routes'] =>
  (projet.worldMap?.routes ?? []).filter((r) => r.ambush?.scene.id === sceneId && r.ambush.encounter === id);

/** Ce qui, sur la carte du monde du projet `projet`, désigne la rencontre `id` de la scène `sceneId` : les embuscades
 *  de route qui la lancent (`routesDeLEmbuscade`), dites ; `undefined` sans elles. #3606 */
function embuscadesDeLaRencontre(projet: ProjetDEdition, sceneId: string, id: string): string | undefined {
  const routes = routesDeLEmbuscade(projet, sceneId, id).map((r) => `« ${r.id} »`);
  return routes.length ? tr('ecran.editeur.rencontre.embuscade', { id, routes: routes.join(', ') }) : undefined;
}

/** Le projet `projet` où la rencontre `de` de la scène `sceneId` prend l'identifiant `vers` (`renameEncounter`), propagé
 *  à l'embuscade de chaque route qui la lance (`routesDeLEmbuscade`). #3606 */
function rencontreRenommee(projet: ProjetDEdition, sceneId: string, de: string, vers: string): ProjetDEdition {
  const scene = DOCUMENTS.scene.lire(projet, sceneId)!;
  const renommee = renameEncounter(scene, de, vers);
  if (renommee === scene) return projet;
  const avec = DOCUMENTS.scene.ecrire(projet, sceneId, renommee);
  const routes = new Set(routesDeLEmbuscade(projet, sceneId, de));
  const carte = projet.worldMap;
  if (!carte || !routes.size) return avec;
  const encounter = vers.trim();
  return DOCUMENTS.carte.ecrire(avec, sceneId, { ...carte, routes: carte.routes.map((r) => (routes.has(r) ? { ...r, ambush: { ...r.ambush!, encounter } } : r)) });
}

/** La scène `scene` où l'action authorée `de` du décor `id` prend l'identifiant `vers` (`renameActionAuthoree`). */
function actionRenommee(scene: Scene, id: string, de: string, vers: string): Scene {
  const ent = scene.entities.find((e) => e.id === id);
  const actions = ent?.usable?.actions;
  const renommees = actions && renameActionAuthoree(actions, de, vers);
  return ent && renommees !== actions ? editEntity(scene, id, { usable: { ...ent.usable, actions: renommees } }) : scene;
}

/** La scène `scene` où le nœud `de` du dialogue `id` prend l'identifiant `vers` (`renameDialogueNode`). */
function noeudRenomme(scene: Scene, id: string, de: string, vers: string): Scene {
  const dialogue = scene.dialogues.find((d) => d.id === id);
  const renomme = dialogue && renameDialogueNode(dialogue, de, vers);
  return dialogue && renomme !== dialogue ? replaceDialogue(scene, id, renomme!) : scene;
}

/** Le projet `projet` dont la carte du monde devient celle que `f` écrit ; tel quel sans carte. */
function surLaCarte(projet: ProjetDEdition, f: (carte: WorldMap) => WorldMap): ProjetDEdition {
  const carte = projet.worldMap;
  return carte ? DOCUMENTS.carte.ecrire(projet, '', f(carte)) : projet;
}

/** Le projet `projet` où la route `avant` devient `apres` par son écrivain (`majRoute`), du patch qui les sépare
 *  (`patchEntre`) ; refusé, dit, quand l'écrivain rend la carte telle quelle alors que la route change : elle n'offrirait
 *  plus le mode d'un de ses billets. #3606 */
function routeEcrite(projet: ProjetDEdition, _sceneId: string, avant: MapRoute, apres: MapRoute): EcritureDeValeur<ProjetDEdition> {
  const carte = projet.worldMap!;
  const ecrite = majRoute(carte, avant.id, patchEntre(avant, apres) as PatchDeRoute);
  if (ecrite === carte && jsonCanonique(avant) !== jsonCanonique(apres)) return { ok: false, refus: { regle: tr('ecran.editeur.route.modeDuBillet', { id: avant.id }) } };
  return { ok: true, valeur: DOCUMENTS.carte.ecrire(projet, '', ecrite) };
}

/** Le lieu sélectionné par `depuis` sur la carte du projet `projet`, `undefined` hors d'un lieu. */
const lieuDeLaSel = (projet: ProjetDEdition, depuis: Sel): MapPlace | undefined =>
  (depuis?.type === 'place' ? projet.worldMap?.places.find((p) => p.id === depuis.id) : undefined);

/** La carte `carte` où un lieu neuf est posé à `pos` (`ajouterLieu`, borné et décalé), sous un identifiant qu'aucun de
 *  ses lieux ne porte (`nextEntityId`), lié à la première des scènes `scenes`. #3606 */
export function lieuNeuf(carte: WorldMap, pos: MapPlace['pos'], scenes: readonly { id: string }[]): { carte: WorldMap; id: string } {
  const id = nextEntityId('lieu', carte.places.map((p) => p.id));
  return { carte: ajouterLieu(carte, id, pos, scenes), id };
}

/** La carte `carte` où un point d'intérêt neuf est posé au plan du lieu `lieu`, à `pos` (`ajouterPoi`, borné), sous un
 *  identifiant qu'aucun point de la carte ne porte (`nextEntityId`), menant à la première des scènes `scenes`, dont il
 *  prend le nom ; `undefined` pour un lieu inconnu. #3606 */
export function poiNeuf(carte: WorldMap, lieu: string, pos: PlacePoi['pos'], scenes: readonly Pick<Scene, 'id' | 'label'>[]): { carte: WorldMap; id: string } | undefined {
  const id = nextEntityId('poi', carte.places.flatMap((p) => (p.poi ?? []).map((x) => x.id)));
  const [scene] = scenes;
  const posee = ajouterPoi(carte, lieu, { id, label: scene.label, pos, sceneId: { id: scene.id } });
  return posee === carte ? undefined : { carte: posee, id };
}

/** Le centre des bornes de la carte (`BORNES_DE_CARTE`). */
const CENTRE_DE_CARTE = { x: (BORNES_DE_CARTE.x.min + BORNES_DE_CARTE.x.max) / 2, y: (BORNES_DE_CARTE.y.min + BORNES_DE_CARTE.y.max) / 2 };

/** Le projet `projet` où un lieu neuf est posé au centre des bornes de sa carte (`lieuNeuf`) ; `undefined` sans carte.
 *  Le pointeur, lui, le pose au point appuyé. #3606 */
function lieuCree(projet: ProjetDEdition): { projet: ProjetDEdition; id: string } | undefined {
  const carte = projet.worldMap;
  if (!carte) return undefined;
  const pose = lieuNeuf(carte, CENTRE_DE_CARTE, projet.scenes);
  return { projet: DOCUMENTS.carte.ecrire(projet, '', pose.carte), id: pose.id };
}

/** La route neuve que `lierLieux` pose du lieu `depuis` au lieu `vers` de la carte `carte`, sous un identifiant
 *  qu'aucune de ses routes ne porte (`nextEntityId`) ; `undefined` si elle la refuse. */
export function routeLiee(carte: WorldMap, depuis: string, vers: string): { carte: WorldMap; id: string } | undefined {
  const id = nextEntityId('trajet', carte.routes.map((r) => r.id));
  const liee = lierLieux(carte, id, depuis, vers);
  return liee === carte ? undefined : { carte: liee, id };
}

/** Les lieux de la carte du projet `projet` que le lieu sélectionné par `depuis` peut rejoindre par une route neuve
 *  (`routeLiee`). #3606 */
function lieuxAJoindre(projet: ProjetDEdition, _sceneId: string, depuis: Sel): readonly string[] {
  const lieu = lieuDeLaSel(projet, depuis);
  const carte = projet.worldMap;
  return lieu && carte ? carte.places.flatMap((p) => (routeLiee(carte, lieu.id, p.id) ? [p.id] : [])) : [];
}

/** Le projet `projet` où une route neuve relie le lieu sélectionné par `depuis` au lieu `avec` (`routeLiee`) ;
 *  `undefined` sans lui ou si elle est refusée. #3606 */
function routeCreee(projet: ProjetDEdition, _sceneId: string, depuis: Sel, avec?: string): { projet: ProjetDEdition; id: string } | undefined {
  const lieu = lieuDeLaSel(projet, depuis);
  const liee = lieu && avec !== undefined ? routeLiee(projet.worldMap!, lieu.id, avec) : undefined;
  return liee && { projet: DOCUMENTS.carte.ecrire(projet, '', liee.carte), id: liee.id };
}

/** La table d'écriture des porteurs de formulaire, par sorte : d'une zone d'effet, d'un déclencheur, d'un dialogue,
 *  d'une rencontre ou de la scène, le remplacement dans son document (`remplace`) ; d'une entité, sa porte (`sceneAvecLEntite`), et le
 *  renommage d'une action d'un décor (`actionRenommee`) ; d'un déclencheur, son renommage (`renameTrigger`) et son
 *  retrait (`deleteSel`) ; d'un dialogue, sa création (`addDialogue`), son renommage (`renameDialogue`), son retrait
 *  (`removeDialogue`) et le renommage d'un de ses nœuds (`noeudRenomme`) ; d'une rencontre, sa création
 *  (`addEncounter`), son renommage propagé aux embuscades de route (`rencontreRenommee`), son retrait
 *  (`removeEncounter`), refusé tant qu'une embuscade de route la lance (`embuscadesDeLaRencontre`) ; d'un lieu, son
 *  écriture (`majLieu`), sa création (`lieuCree`) et son retrait, ses routes avec lui (`supprimerLieu`) ; d'une route,
 *  son écriture (`routeEcrite`), sa création depuis le lieu
 *  sélectionné vers l'un de ceux qu'il rejoint (`routeCreee`, `lieuxAJoindre`) et son retrait (`supprimerRoute`) ; de la
 *  carte, son écriture (`majCarte`) et son retrait du projet, qui n'offre plus de voyage ; des réglages du projet, leur
 *  remplacement (`remplace`). Les écrivains de la scène y sont relevés au projet (`deLaScene`). */
export const ECRITURES_DES_PORTEURS: { readonly [S in SorteDePorteur]: EcritureDuPorteur<DonneeDuPorteur[S]> } = {
  zone: { ecrire: remplace('zone') },
  declencheur: { ...deLaScene({ renommer: renameTrigger, retirer: (scene, id) => deleteSel(scene, { type: 'trigger', id }) }), ecrire: remplace('declencheur') },
  entite: deLaScene({ ecrire: sceneAvecLEntite, renommerElement: actionRenommee }),
  dialogue: { ...deLaScene({ creer: addDialogue, renommer: renameDialogue, retirer: removeDialogue, renommerElement: noeudRenomme }), ecrire: remplace('dialogue') },
  rencontre: {
    ...deLaScene({ creer: addEncounter, retirer: removeEncounter }),
    ecrire: remplace('rencontre'),
    renommer: rencontreRenommee,
    refusDeRetirer: embuscadesDeLaRencontre,
  },
  scene: { ecrire: remplace('scene') },
  lieu: {
    ecrire: (projet, _sceneId, avant, apres) => ({ ok: true, valeur: surLaCarte(projet, (carte) => majLieu(carte, avant.id, patchEntre(avant, apres))) }),
    creer: lieuCree,
    retirer: (projet, _sceneId, id) => surLaCarte(projet, (carte) => supprimerLieu(carte, id)),
  },
  route: {
    ecrire: routeEcrite,
    creer: routeCreee,
    avecs: lieuxAJoindre,
    retirer: (projet, _sceneId, id) => surLaCarte(projet, (carte) => supprimerRoute(carte, id)),
  },
  carte: {
    ecrire: (projet, _sceneId, avant, apres) => ({ ok: true, valeur: surLaCarte(projet, (carte) => majCarte(carte, patchEntre(avant, apres) as PatchDeCarte)) }),
    retirer: (projet) => {
      const { worldMap: _carte, ...sans } = projet;
      return sans;
    },
  },
  projet: { ecrire: remplace('projet') },
};

/** Le projet `projet`, où la scène `sceneId` est montrée, sans le porteur `porteur`, retiré par la table de sa sorte
 *  (`ECRITURES_DES_PORTEURS`, `retirer`) ; ou son refus : celui que la table dit (`refusDeRetirer`), sinon la première
 *  faute du parse de son document (`DOCUMENTS`, `schema`) que le document d'avant ne portait pas (`fauteNeuve`), dite ;
 *  un document retiré avec son porteur singulier n'en porte aucune. `undefined` : sa sorte ne se retire pas par la table. */
export function projetSansLePorteur(projet: ProjetDEdition, sceneId: string, porteur: { sorte: SorteDePorteur; id: string }): { ok: true; valeur: ProjetDEdition } | { ok: false; regle: string } | undefined {
  const { retirer, refusDeRetirer } = ECRITURES_DES_PORTEURS[porteur.sorte];
  if (!retirer) return undefined;
  const refus = refusDeRetirer?.(projet, sceneId, porteur.id);
  if (refus !== undefined) return { ok: false, regle: refus };
  const apres = retirer(projet, sceneId, porteur.id);
  const document = DOCUMENTS[accesDe(porteur.sorte).document] as { lire: (p: ProjetDEdition, id: string) => unknown; schema: unknown };
  const lu = document.lire(apres, sceneId);
  const faute = lu === undefined ? undefined : fauteNeuve(document.schema, document.lire(projet, sceneId), lu);
  return faute === undefined ? { ok: true, valeur: apres } : { ok: false, regle: faute };
}

/** La liste ou le record `v` d'un patch, `undefined` (son absence, `champ`) quand il est vide ou `null`. */
export const sansVide = <T extends object>(v: T | null): T | undefined => (v && Object.keys(v).length ? v : undefined);

/** La couche `z` d'un patch, `undefined` (son absence, `champ`) au sol. */
export const coucheEcrite = (z: number): number | undefined => z || undefined;

/** Le rectangle `r` porté à la couche `z` (`z` omis au rez). */
const rectALaCouche = (r: Rect, z: number) => ({ x: r.x, y: r.y, w: r.w, h: r.h, ...(z ? { z } : {}) });

/** La zone d'effet `zone` portée à la couche `z`, son emprise découpée avec elle. */
function zoneDEffetALaCouche(zone: SceneEffectZone, z: number): SceneEffectZone {
  const out = champ(zone, 'z', coucheEcrite(z));
  return zone.tiles ? { ...out, tiles: zone.tiles.map((t) => carveTile(t, z)) } : out;
}

/** La zone d'effet `zone` patchée de `patch` (`PatchDeZone`). Barrer le passage garde les groupes qu'elle bloquait. */
function zoneDEffetPatchee(zone: SceneEffectZone, patch: PatchDeZone): SceneEffectZone {
  let out = patch.z === undefined ? zone : zoneDEffetALaCouche(zone, patch.z);
  if (patch.nom !== undefined) out = { ...out, label: patch.nom };
  if (patch.presentation !== undefined) out = champ(out, 'presentation', patch.presentation ?? undefined);
  if (patch.forme) out = setEffectZoneArea(out, effectZoneArea(patch.forme, effectZoneRect(out.area)));
  if (patch.pleine) out = clearEffectZoneCarve(out);
  if (patch.blocksLoS !== undefined) out = champ(out, 'blocksLoS', patch.blocksLoS || undefined);
  if (patch.barrier !== undefined) out = champ(out, 'barrier', patch.barrier ? zone.barrier ?? {} : undefined);
  return patch.couvre === undefined ? out : champ(out, 'couvre', sansVide(patch.couvre));
}

/** La zone sélectionnée `sel` de `scene` (déclencheur, zone de repos ou d'effet) patchée de `patch` ; `scene` telle
 *  quelle hors d'une zone. */
export function patchZone(scene: Scene, sel: Sel, patch: PatchDeZone): Scene {
  if (sel?.type === 'trigger') {
    return {
      ...scene,
      triggers: scene.triggers.map((t) => {
        if (t.id !== sel.id) return t;
        let out = patch.z === undefined ? t : { ...t, rect: rectALaCouche(t.rect, patch.z) };
        if (patch.once !== undefined) out = champ(out, 'once', patch.once || undefined);
        return patch.couvre === undefined ? out : champ(out, 'couvre', sansVide(patch.couvre));
      }),
    };
  }
  if (sel?.type === 'restZone') {
    return {
      ...scene,
      restZones: (scene.restZones ?? []).map((r, i) => {
        if (i !== sel.idx) return r;
        const out = { ...r, rect: patch.z === undefined ? r.rect : rectALaCouche(r.rect, patch.z), places: { ...r.places, ...patch.lieux } };
        return patch.pietre === undefined ? out : champ(out, 'quality', patch.pietre ? 'pietre' : undefined);
      }),
    };
  }
  if (sel?.type === 'effectZone') {
    const zone = scene.effectZones?.find((z) => z.id === sel.id);
    return zone ? replaceEffectZone(scene, sel.id, zoneDEffetPatchee(zone, patch)) : scene;
  }
  return scene;
}

/** CONTENU DE NAISSANCE d'une zone d'effet : ce que l'outil qui la dessine lui donne (pièce, piège,
 *  barrière…). `id`, `area` et `z` restent au créateur — ils viennent du geste, pas de l'appelant. */
export type EffectZoneSeed = Partial<Omit<SceneEffectZone, 'id' | 'area' | 'z'>>;

/** Remplace la zone d'effet `id` par `zone`. */
export const replaceEffectZone = (scene: Scene, id: string, zone: SceneEffectZone): Scene => ({ ...scene, effectZones: (scene.effectZones ?? []).map((z) => (z.id === id ? zone : z)) });

/** Crée une ZONE D'EFFET sur `rect`, à l'étage `z` (id frais pour le rendu/sélection). Tout ce que la
 *  zone PORTE vient de `seed` : sans seed, elle naît DESCRIPTIVE (`isDescriptiveZone`) et libellée par
 *  son id, renommable dans l'inspecteur. */
export function addEffectZone(scene: Scene, rect: Rect, z = 0, seed: EffectZoneSeed = {}): { scene: Scene; id: string } {
  const id = nextEntityId('zone', (scene.effectZones ?? []).map((ez) => ez.id));
  const zones = [
    ...(scene.effectZones ?? []),
    { label: id, ...seed, id, area: { kind: 'rect' as const, ...rect }, ...(z ? { z } : {}) },
  ];
  return { scene: { ...scene, effectZones: zones }, id };
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
          .map((m) => (m.ridesEntityId?.id === entityId ? { ...m, ridesEntityId: undefined } : m)),
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
 *  libellé passé à la place d'un id est une erreur d'appelant, jamais un cas à rattraper. Le nom
 *  affiché se lit par `nomDEntite` (`sceneNpc.ts`).
 *  Une entité DÉJÀ posée à (p,z) est réutilisée (enrôlée) plutôt que dupliquée — même garde que les
 *  outils `entity`/`emplacement` (`entityAt`, #835 FU-3). */
export function addEnemyMember(scene: Scene, encId: string, ref: string, p: Pt, z = 0): { scene: Scene; encId: string; entityId: string } {
  const existing = entitesEnCaseEtage(scene, p.x, p.y, z).find((e) => e.kind === 'personnage');
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
    creature: { id: ref },
  };
  const withEnt = addEntity(scene, ent, z);
  const { scene: out, encId: usedEnc } = addMember(withEnt, encId, id);
  return { scene: out, encId: usedEnc, entityId: id };
}

/** Gomme : retire l'entité posée sur p à l'étage `z` la plus proche du point visé (`entityAt`) ; les autres couches se
 *  suppriment via leur sélection. */
export function eraseAt(scene: Scene, p: Pt, z = 0, point: Pt = p): Scene {
  const ent = entityAt(scene, p, z, point);
  return ent ? removeEntity(scene, ent.id) : scene;
}

// ── Champs de HAUT NIVEAU de la scène : chaque écriture de l'Inspecteur et du LogicDock a ici son écrivain,
//    pour qu'un hôte qui embarque le noyau édite la scène sans `src/ui`. ──

/** Les champs SCALAIRES EFFAÇABLES de la scène : une valeur sans invariant propre, posée telle quelle, et
 *  facultative au schéma. `label`, requis, n'en est pas : il se pose par `setSceneLabel`. */
export type ScalairesDeScene = Partial<Pick<Scene, 'desc' | 'ambiance' | 'weather' | 'couvre' | 'groups' | 'metresPerTile' | 'ambientLight' | 'environment'>>;

/** Pose le nom de la scène, champ requis du schéma. */
export function setSceneLabel(scene: Scene, label: string): Scene {
  return { ...scene, label };
}

/** Pose les champs scalaires de `patch` ; une clé portée à `undefined` RETIRE le champ du document. */
export function setSceneScalaires(scene: Scene, patch: ScalairesDeScene): Scene {
  return champs(scene, patch);
}

/** NORD de la carte (degrés horaires depuis `−y`, cf. `Scene.northDeg`). `undefined` = nord implicite
 *  (0). La valeur est RAMENÉE dans `[0,360[` — un cap est un angle, pas un compteur : 450° et 90°
 *  désignent le même nord, et une valeur non finie n'en désigne aucun (le champ est alors retiré). */
export function setNorthDeg(scene: Scene, deg: number | undefined): Scene {
  return champ(scene, 'northDeg', deg === undefined || !Number.isFinite(deg) ? undefined : ((deg % 360) + 360) % 360);
}

/** Renomme la scène éditée. Refusé (scène rendue inchangée) pour un id vide, ou déjà porté par une autre
 *  scène du projet (`autres`) : les transitions et la carte du monde désignent une scène par son id. */
export function renameScene(scene: Scene, autres: readonly Pick<Scene, 'id'>[], to: string): Scene {
  const next = to.trim();
  if (!next || next === scene.id || autres.some((s) => s.id === next)) return scene;
  return { ...scene, id: next };
}

/** Réécrit le point d'entrée `id` : sa case est plafonnée à la carte et ramenée à une case entière
 *  (`borneALaCarte`, comme `moveSel`) ; l'étage 0 est implicite. No-op si l'entrée est absente. */
export function editEntry(scene: Scene, id: string, patch: { x?: number; y?: number; z?: number }): Scene {
  const pos = scene.entryPoints?.[id];
  if (!pos) return scene;
  const { z, ...case_ } = { ...pos, ...patch };
  return { ...scene, entryPoints: { ...scene.entryPoints, [id]: { ...borneALaCarte(scene, case_), ...(z ? { z } : {}) } } };
}

/** Ajoute une ancre de bataille vers la Scène de Round `sceneId`, à la case (0,0). */
export function addStation(scene: Scene, sceneId: string): Scene {
  return { ...scene, stations: [...(scene.stations ?? []), { sceneId, pos: { x: 0, y: 0 } }] };
}

/** Patche l'ancre de bataille d'indice `i` ; la scène telle quelle sans elle. */
export function patchStation(scene: Scene, i: number, patch: Partial<SceneStationAnchor>): Scene {
  const stations = scene.stations ?? [];
  return i in stations ? { ...scene, stations: stations.map((st, j) => (j === i ? { ...st, ...patch } : st)) } : scene;
}

/** Retire l'ancre de bataille d'indice `i` ; la dernière retirée, le champ quitte le document. La scène telle quelle
 *  sans elle. */
export function removeStation(scene: Scene, i: number): Scene {
  const stations = scene.stations ?? [];
  if (!(i in stations)) return scene;
  const reste = stations.filter((_, j) => j !== i);
  return champ(scene, 'stations', reste.length ? reste : undefined);
}

/** Pose la piste `piste` de la musique de scène : un id du registre, `null` pour le silence, `undefined` pour la
 *  piste du contexte ; sans aucune piste posée, le champ quitte le document. */
export function setSceneMusic(scene: Scene, piste: keyof NonNullable<Scene['music']>, v: string | null | undefined): Scene {
  const pistes = { ...scene.music, [piste]: v };
  const music = champs<NonNullable<Scene['music']>>({}, { ambient: pistes.ambient, combat: pistes.combat });
  return champ(scene, 'music', Object.keys(music).length ? music : undefined);
}

/** Pose le texte du message d'introduction ; un texte vide retire le message (provenance comprise). */
export function setStartMessageTexte(scene: Scene, texte: string): Scene {
  return champ(scene, 'startMessage', texte ? { ...scene.startMessage, texte } : undefined);
}

/** Patche la provenance du message d'introduction. No-op sans message. */
export function patchStartMessage(scene: Scene, patch: Partial<NonNullable<Scene['startMessage']>>): Scene {
  return scene.startMessage ? { ...scene, startMessage: { ...scene.startMessage, ...patch } } : scene;
}

/** Pose la matière de la partie de relief `part`. */
export function setReliefDefault(scene: Scene, part: keyof ReliefDefaults, matiere: ReliefDefaults[keyof ReliefDefaults]): Scene {
  return { ...scene, reliefDefaults: { ...scene.reliefDefaults, [part]: matiere } };
}

/** Patche la toiture par défaut, et re-dérive dans le geste les masses qu'elle gouverne
 *  (`rederiveRoofMasses`) : le rendu ne lit que les masses matérialisées. */
export function patchSceneRoofDefaults(scene: Scene, patch: Partial<SceneRoofDefaults>): Scene {
  return rederiveRoofMasses({ ...scene, roofDefaults: { ...scene.roofDefaults, ...patch } });
}

/** Patche l'offre de repos de la scène entière, à partir de l'offre effective (`reposDeScene`). */
export function setSceneRest(scene: Scene, patch: Partial<NonNullable<Scene['rest']>>): Scene {
  return { ...scene, rest: { ...reposDeScene(scene), ...patch } };
}

/** Fusionne des flags initiaux dans `scene.flags` (état de départ : porte ouverte, jalon posé…). */
export function setSceneFlags(scene: Scene, patch: Record<string, boolean>): Scene {
  return { ...scene, flags: { ...scene.flags, ...patch } };
}

/** Retire le drapeau initial `key`. */
export function removeSceneFlag(scene: Scene, key: string): Scene {
  return { ...scene, flags: Object.fromEntries(Object.entries(scene.flags).filter(([k]) => k !== key)) };
}

/** Patche les champs de HAUT NIVEAU d'une entité (facing/label/crewIds/upgrades/light/statblock/foot…), chacun posé par
 *  `champs` : une clé portée à `undefined` le retire. No-op si l'entité est absente. Écriture mécanique privée au
 *  module : la porte publique est `editEntity`, qui la compose avec le seam d'assise. */
function patchEntity(scene: Scene, id: string, patch: Partial<SceneEntity>): Scene {
  return { ...scene, entities: scene.entities.map((e) => (e.id === id ? champs(e, patch) : e)) };
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
      if (occupant.kind !== 'entite') continue;
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

/** Le geste d'AUTHORING d'une place : `occupant` assis à la place `slotId` du meuble `propId`, son tenant et l'ancienne
 *  place de `occupant` libérés dans la même écriture ; `null` libère la place. Une place vide qu'on vide rend la scène
 *  telle quelle. */
export function assoirALaPlace(scene: Scene, propId: string, slotId: string, occupant: SeatOccupant | null): { ok: true; scene: Scene } | Extract<SeatAssignmentResult, { ok: false }> {
  const tenant = scene.seatAssignments?.[propId]?.[slotId];
  const liberee = tenant ? releaseSeat(scene, tenant) : scene;
  if (!occupant) return { ok: true, scene: tenant ? normaliseAssises(liberee, GROUPE_A_L_AUTHORING) : scene };
  const res = seatOccupant(releaseSeat(liberee, occupant), propId, slotId, occupant, GROUPE_A_L_AUTHORING);
  return res.ok ? { ok: true, scene: res.scene } : res;
}

/** Un patch d'authoring qui RETIRERAIT le type nommé d'une entité (`typeNonNomme`, #877, #1882). */
export class TypeNonNomme extends Error {
  constructor(absence: string) {
    super(`patch refusé — ${absence}`);
    this.name = 'TypeNonNomme';
  }
}

/** Un patch d'authoring qui toucherait l'IDENTITÉ d'une entité (`id`, `kind`) : changer `id` délie la
 *  sélection, les triggers et les dialogues qui la nomment, changer `kind` casse l'union du schéma. */
export class IdentiteNonPatchable extends Error {
  constructor(readonly cles: readonly string[]) {
    super(`« ${cles.join(', ')} » : clé d'IDENTITÉ, jamais patchable — supprimez l'entité et reposez-la pour changer son id ou sa nature`);
    this.name = 'IdentiteNonPatchable';
  }
}

/** LE SEAM de la pose authorée : tout écrivain d'entité de l'éditeur rend sa scène par lui. Les appuis qui ne tiennent
 *  plus tombent (`normaliserLesAppuis` : l'objet retombe au sol), puis les places (`normaliseAssises`). */
function normaliserLaPose(scene: Scene): Scene {
  return normaliseAssises(normaliserLesAppuis(scene), GROUPE_A_L_AUTHORING);
}

/** Patch d'AUTHORING d'une entité (libellé, orientation, étage, ref, statblock…) : la seule porte
 *  d'écriture d'entité ouverte à `src/ui/**`. Traverse le seam — tourner ou monter d'un étage un
 *  meuble attablé recale ou lève ses places dans la MÊME mutation. Juge la TRANSITION du type
 *  (`PORTEURS_DU_TYPE`) : un porteur avant, aucun après → `TypeNonNomme`, qui nomme l'entité. Une
 *  entité déjà sans type reçoit tout patch ; sa faute est dite par `validateScene`. Un patch qui
 *  nomme `id` ou `kind` → `IdentiteNonPatchable`. */
export function editEntity(scene: Scene, id: string, patch: Partial<SceneEntity>): Scene {
  const identite = Object.keys(patch).filter((cle) => cle === 'id' || cle === 'kind');
  if (identite.length) throw new IdentiteNonPatchable(identite);
  const avant = scene.entities.find((e) => e.id === id);
  const patchee = patchEntity(scene, id, patch);
  const apres = patchee.entities.find((e) => e.id === id);
  const absence = avant && apres && !typeNonNomme(avant) ? typeNonNomme(apres) : undefined;
  if (absence) throw new TypeNonNomme(absence);
  return normaliserLaPose(patchee);
}

/** Idem pour le sous-objet `combat` (fusion non écrasante) — même porte, même seam. */
export function editEntityCombat(scene: Scene, id: string, patch: Partial<NonNullable<SceneEntity['combat']>>): Scene {
  return normaliserLaPose(patchEntityCombat(scene, id, patch));
}

/** Pose d'AUTHORING d'une entité NEUVE (palette, collage, builder d'emplacement) — la seule porte
 *  d'AJOUT ouverte à `src/ui/**`. L'ajout ne casse aucune assise, mais il n'est pas moins une
 *  écriture d'`entities` : il passe par la même porte, et l'interface n'a plus aucun motif d'en
 *  fabriquer la liste. L'ÉTAGE se pose ICI, une fois (`z` = couche demandée ; sol (0) = champ
 *  absent, convention du modèle) — l'appelant ne le recolle plus sur l'entité. */
export function addEntity(scene: Scene, ent: SceneEntity, z = 0): Scene {
  return normaliserLaPose({ ...scene, entities: [...scene.entities, champ(ent, 'z', coucheEcrite(z))] });
}

/** Suppression d'AUTHORING d'une entité — traverse le seam. */
export function removeEntity(scene: Scene, id: string): Scene {
  return normaliserLaPose({ ...scene, entities: scene.entities.filter((e) => e.id !== id) });
}

/** Déplacement d'AUTHORING d'une entité : pose la case demandée, lève le corps de sa place s'il quitte
 *  l'abord de son siège, emmène ce qu'un décor porte (`emporterLesObjets`), puis traverse le seam (qui emmène les
 *  attablés quand c'est le MEUBLE qui bouge, et lève les places devenues inoccupables). */
export function moveEntityTo(scene: Scene, id: string, to: Pt): Scene {
  const deplacee = emporterLesObjets(scene, { ...scene, entities: scene.entities.map((e) => (e.id === id ? { ...e, pos: { ...e.pos, x: to.x, y: to.y } } : e)) }, id);
  const occupant: SeatOccupant = { kind: 'entite', entityId: id };
  const pose = seatPoseOf(scene, occupant);
  const quitte = !!pose && (pose.approach.x !== to.x || pose.approach.y !== to.y);
  return normaliserLaPose(quitte ? releaseSeat(deplacee, occupant) : deplacee);
}

/** Patche le sous-objet `combat` d'une entité SANS écraser l'existant (fusionne skills/spells/optionals/
 *  hiddenUntilCombat). No-op si absente. Écriture mécanique privée au module : la porte publique est
 *  `editEntityCombat`. AA 10 l.142 */
function patchEntityCombat(scene: Scene, id: string, patch: Partial<NonNullable<SceneEntity['combat']>>): Scene {
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

/** Emprise RÉELLE d'un étage — RÈGLE PARTAGÉE par `validateBuildingMasses` (`noyau/mapSpec.ts`) et
 *  `deriveArchitectureMasses` : `z=0` se lit sur `interiorCells` (`planDefects.ts`, #881) — closes par
 *  les murs ET non déclarées à ciel ouvert (le rez peut avoir une cour à ciel ouvert, jamais toitée) ;
 *  `z>0` sur le PLANCHER RÉEL (terrain non-vide, PAS `isWalkable` — un décor multi-cases ne change pas
 *  la structure) : un étage est BÂTI par construction, y compris au-dessus d'une cour (galerie en
 *  anneau), mesuré sur La Diligence (#825ter). */
export function realFloorAt(scene: Pick<Scene, 'dimensions' | 'effectZones' | 'layers' | 'walls'>): (z: number) => ReadonlySet<string> {
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
export function toitureEffective(scene: Pick<Scene, 'roofDefaults'>, body: ArchitectureBody): {
  material: SceneRoofDefaults['material'];
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
 *  comme le bâti réel. `montée = portée / 2 × tan(pente)` (`riseAt`, `noyau/monde/volume/toits.ts`) ⇒
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
 *  Lue par `validateBuildingMasses` (`noyau/mapSpec.ts`, portée par-étage de la règle de couverture). */
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
 *  `validateArchitectureResiduals` de `noyau/mapSpec.ts`) : la dérivation y est sans borne. */
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
export function flightOpeningsAt(scene: Pick<Scene, 'dimensions' | 'layers'>, z: number): ReadonlySet<string> {
  const storeyZs = new Set(scene.layers.map((l) => l.z));
  if (!storeyZs.has(z) || !storeyZs.has(z - 1)) return new Set<string>();
  return stairFlightCells(scene, z - 1, z);
}

/** Cases qu'une nappe d'étage `z` peut légitimement COIFFER sans porter de plancher à `z` — les deux
 *  lectures géométriques de l'ADOPTION (`deriveArchitectureMasses`) : trou ENCLOS du plancher de cet
 *  étage (`enclosedHolesOf` — puits, cage, trémie), ou case de volée qui y DÉBOUCHE
 *  (`flightOpeningsAt`). RÈGLE PARTAGÉE avec `validateBuildingMasses` (`noyau/mapSpec.ts`) : ce
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
 *  (`riseAt`, `noyau/monde/volume/toits.ts`). */
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
export function gableSpanMaxTiles(scene: Pick<Scene, 'metresPerTile'>): number {
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
 *  (`validateArchitectureResiduals`, `noyau/mapSpec.ts`), sinon l'attribution serait un tirage au sort.
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
export function deriveArchitectureMasses(scene: SceneDesToits): ArchitectureBody[] {
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
 *  Mémoïsée par scène et version des datasets (`memoByRef`, la dérivation lit les terrains : `estAbsent`) (mesuré :
 *  19 ms de dérivation pour 12 corps sur 64×64×3, soit 34 % du coût de `buildRoofs`, et trois builders la lisent). */
const derivedArchitecture = memoByRef(deriveArchitectureMasses);

export function effectiveArchitecture(scene: SceneDesToits): readonly ArchitectureBody[] {
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

/** Ce qu'un geste d'outil porte en plus de sa case : la couche active, la taille du pinceau, la
 *  rencontre que l'outil de rencontre complète et la fiche qu'il pose, l'arête visée par l'outil murs, et le point
 *  visé en cases continues (défaut le centre de la case), où la palette pose un décor et que la gomme désigne. */
export type GesteDOutil = { z: number; brush: number; encId: string; encRef: string; side?: CellSide; point?: Pt };
/** Ce qu'un geste rend : la scène, la sélection qu'il désigne, et la rencontre qu'il a complétée. */
export type EffetDOutil = { scene: Scene; sel?: Sel; encId?: string };

/** Applique l'outil `tool` à la case `p` — routine unique de l'appui et du glissé. null hors de la carte,
 *  pour un outil qui n'écrit pas à la case (sélection, zone au rectangle, tracé de volée), ou quand la pose
 *  est refusée. Un décor se pose toujours, au point visé, parmi ce que la case porte déjà ; sur une entité déjà posée,
 *  les autres outils de pose la désignent sans rien écrire. */
export function appliquerOutil(scene: Scene, tool: Tool, p: Pt, geste: GesteDOutil): EffetDOutil | null {
  if (!dansLaCarte(scene, p)) return null;
  const { z, brush } = geste;
  switch (tool.mode) {
    case 'terrain': return { scene: paintTiles(scene, p, tool.terrain, brush, z) };
    case 'hauteur': return { scene: paintHeight(scene, p, tool.metres, brush, z) };
    case 'crenelage': return { scene: paintCrenellated(scene, p, tool.structure, brush, z) };
    case 'casesDeZone': return { scene: paintEffectZone(scene, tool.zoneId, p, tool.paint) };
    case 'gomme': return { scene: eraseAt(scene, p, z, geste.point) };
    case 'entite':
    case 'emplacement': {
      if (tool.mode === 'entite' && tool.kind === 'prop') {
        const out = placeEntity(scene, tool, p, z, geste.point);
        return { scene: out.scene, sel: { type: 'entity', id: out.id } };
      }
      const existing = entityAt(scene, p, z, geste.point);
      if (existing) return { scene, sel: { type: 'entity', id: existing.id } };
      const out = tool.mode === 'entite' ? placeEntity(scene, tool, p, z) : placeEmplacement(scene, tool.trappingId, p, z);
      return out && { scene: out.scene, sel: { type: 'entity', id: out.id } };
    }
    case 'entree': {
      const out = placeEntry(scene, p, z);
      return { scene: out.scene, sel: { type: 'entry', id: out.id } };
    }
    case 'rencontre': {
      const out = addEnemyMember(scene, geste.encId, geste.encRef, p, z);
      return { scene: out.scene, sel: { type: 'entity', id: out.entityId }, encId: out.encId };
    }
    case 'arete': {
      if (!geste.side) return null;
      if (tool.paint === 'diagBack') return { scene: toggleDiagonalWall(scene, p.x, p.y, '\\', z) };
      if (tool.paint === 'diagFwd') return { scene: toggleDiagonalWall(scene, p.x, p.y, '/', z) };
      return { scene: toggleEdgeWall(scene, p.x, p.y, geste.side, z, tool.paint === 'door' ? 'door' : 'wall', tool.structure) };
    }
    case 'selection':
    case 'zone':
    case 'escalier':
      return null;
  }
}

/** Valide le rectangle `rect` tracé à l'outil `tool` sur la couche `z` : une zone (déclencheur, repos,
 *  pièce, zone d'effet) qu'il désigne, ou le terrain qu'il remplit. null pour un outil sans rectangle. */
export function validerRectangle(scene: Scene, tool: Tool, rect: Rect, z: number): EffetDOutil | null {
  if (tool.mode === 'terrain') return { scene: fillTerrainRect(scene, rect, tool.terrain, z) };
  if (tool.mode !== 'zone') return null;
  if (tool.zone === 'trigger') {
    const out = addTrigger(scene, rect, z);
    return { scene: out.scene, sel: { type: 'trigger', id: out.id } };
  }
  if (tool.zone === 'rest') {
    const out = addRestZone(scene, rect, z);
    return { scene: out.scene, sel: { type: 'restZone', idx: out.idx } };
  }
  const out = addEffectZone(scene, rect, z, EFFECT_ZONE_SEEDS[tool.zone]);
  return { scene: out.scene, sel: { type: 'effectZone', id: out.id } };
}

/** Les scènes d'un projet autour de la scène éditée : l'ordre du document, la première est l'entrée. */
export type ProjectScenes = { avant: Scene[]; scene: Scene; apres: Scene[] };

function versLaFin(p: ProjectScenes, scene: Scene): ProjectScenes {
  return { avant: [...p.avant, p.scene, ...p.apres], scene, apres: [] };
}

/** Ajoute une scène vide d'id `id` en fin de projet et l'édite. L'id vient de l'hôte (son entropie). */
export function addProjectScene(p: ProjectScenes, id: string): ProjectScenes {
  return versLaFin(p, { ...emptyScene(id), label: 'Nouvelle scène' });
}

/** Copie la scène éditée sous l'id `id`, en fin de projet, et édite la copie. */
export function duplicateProjectScene(p: ProjectScenes, id: string): ProjectScenes {
  const copie = JSON.parse(JSON.stringify(p.scene)) as Scene;
  return versLaFin(p, { ...copie, id, label: `${p.scene.label || p.scene.id} (copie)` });
}

/** Retire la scène éditée et édite sa suivante, sinon sa précédente. null pour la seule scène du projet. */
export function deleteProjectScene(p: ProjectScenes): ProjectScenes | null {
  if (p.apres.length > 0) return { avant: p.avant, scene: p.apres[0], apres: p.apres.slice(1) };
  if (p.avant.length > 0) return { avant: p.avant.slice(0, -1), scene: p.avant[p.avant.length - 1], apres: [] };
  return null;
}

/** Édite la scène `id` du projet, à sa place dans l'ordre du document. null si `id` est la scène éditée
 *  ou n'est pas au projet. */
export function switchProjectScene(p: ProjectScenes, id: string): ProjectScenes | null {
  if (id === p.scene.id) return null;
  const toutes = [...p.avant, p.scene, ...p.apres];
  const i = toutes.findIndex((s) => s.id === id);
  return i < 0 ? null : { avant: toutes.slice(0, i), scene: toutes[i], apres: toutes.slice(i + 1) };
}
