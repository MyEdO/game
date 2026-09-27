/**
 * `MapSpec` — format DÉCLARATIF d'une carte, compilé en `Scene` par `buildScene` (headless-editor).
 *
 * PUR et Node-safe (ZÉRO import ui/gameIso) : le générateur d'arène (`scripts/arene`, `tsx` en Node)
 * l'exécute sans tirer le rendu. `buildScene` ne fait que REJOUER les primitives pures de l'éditeur
 * (`state/sceneEdit`) dans un ORDRE FIXE — aucune logique ad hoc, chaque section = un appel de primitive.
 *
 * ORDRE DE COMPILATION (verrouillé par `mapSpec.test.ts`) :
 *   1. base       : `emptyScene(w,h)` + scalaires directs (id/nom/… comme les SceneProps de l'éditeur),
 *                   `metresPerTile`/`ambientLight`/`flags` via leurs primitives.
 *   2. terrain    : scan des marqueurs (`scanMarkers`) puis parse ASCII (`parseAsciiRows`) par étage,
 *                   posé via `putLayer`. Marqueurs nettoyés → base propre. Les grilles `walled` (box-drawing)
 *                   parsent tuiles + murs d'arête (`parseWalledAscii`) — les murs sont posés à l'étape 4.
 *   3. relief     : hauteurs métriques (`paintHeight`) par cellule — rect / cell / ramp (interpolation), puis
 *                   `cells` (enceinte/tunnel/départ) et `cells.stair` (volées : rampe interpolée entre deux
 *                   surfaces + trémie, #780 — connexité verticale DÉRIVÉE, pas d'escalier au
 *                   pathfinding).
 *   4. walls      : murs d'arête (`setEdgeWall` + `patchWall` structure) / diagonales (`toggleDiagonalWall`).
 *   5. architecture : `spec.architecture` copié tel quel (masses/façades) — non encore validé.
 *   6. entities   : `spec.entities` bruts + heroStart + interprétation du `bind` aux positions scannées.
 *   7. zones      : entryPoints / restZones / effectZones / triggers / dialogues.
 *   8. encounters : `buildEncounters` (terse → entités cachées + members).
 *   8bis. masses  : `deriveArchitectureMasses` COMPLÈTE les masses déclarées (surcharges, #829) avec
 *                   celles dérivées du plancher réel — plus d'obligation de tout couvrir à la main.
 *   9. validation : masses de bâtiment (`validateBuildingMasses`, garde-fou des SURCHARGES) + support
 *                    de plancher (`validateFloorSupport`) + ids de catalogue authorés
 *                    (`assertAuthoredIds`) + schéma de scène (`validateDocument(sceneSchema, …)`) —
 *                    fail-fast, une fois zones/plancher réel connus.
 */
import type {
  Scene,
  SceneEntity,
  Terrain,
  SceneEffectZone,
  Trigger,
  Dialogue,
  EncounterMember,
  EncounterDef,
  SceneStationAnchor,
  VictoryCondition,
  WallClimb,
  ArchitectureBody,
  ArchitectureRect,
  CellSide,
  WallOverlay,
} from './scene';
import { DEFAULT_TERRAIN, emptyScene, tileAt, wallOverlayOf } from './scene';
import { findStructureById, structureAppearances } from '../data';
// DÉFAUTS DE COMPILATION (#1716) : ce que ce compilateur pose quand la déclaration laisse le terrain
// implicite — chemin de ronde et masse d'une `cells` d'enceinte. Donnée éditable au Codex, même patron
// que `DEFAULT_TERRAIN = semencesDeScene.terrain` (`state/scene.ts`).
import { defautsDeCompilation } from '../data';
// PLAGE de pente : la source UNIQUE est le schéma de scène, qui en borne DÉJÀ le parse
// (`sceneRoofDefaultsSchema`/`roofDefaultsSchema`) — deux littéraux ici la feraient diverger en
// silence de la porte qui refuse une scène authorée.
import { PENTE_TOIT_DEG, sceneSchema } from '../data/schemas/defs-scenes/scene';
import { rapportDeFautes, validateDocument } from '../data/schemas/validate';
// SOLS NUS : la primitive PARTAGÉE de l'audit de plan (`terrains.json › built`, complément) — la CLI
// `map:check` (famille `etage-sans-appui`) et cette porte jugent le même appui sur le même ensemble.
import { groundTerrains } from './planDefects';
import { estAbsent, terrainAbsent } from './terrain';
import { planStairFlight, applyStairFlight } from './stairFlight';
import type { Flow } from './flow';
import type { FireArc } from '../engine/types';
import type { ThreatTier } from '../engine/advantagePool';
import type { Dir8 } from './dir8';
import { parseAsciiRows, parseWalledAscii, scanMarkers, walledRowsOf } from './asciiMap';
import { buildEncounter, type AuthoredEnemy } from './encounterAuthoring';
import { chebyshev } from '../engine/grid';
import { seatAssignmentDefects, type SeatAssignments } from './seating';
import {
  type Pt,
  canonEdge,
  setEdgeWall,
  edgeWallState,
  patchWall,
  toggleDiagonalWall,
  paintHeight,
  paintCrenellated,
  paintTiles,
  fillTerrainRect,
  addLayer,
  putLayer,
  placeEmplacement,
  setPosteCrew,
  setPosteSide,
  pasteEntity,
  addRestZone,
  setMetresPerTile,
  setAmbientLight,
  setSceneFlags,
  realFloorAt,
  roofExclusionsByZ,
  deriveArchitectureMasses,
  bodyFootCellsByZ,
  bodyFootCells,
  adoptableOpeningsAt,
} from './sceneEdit';

/** Hauteur (m) par défaut d'une ENCEINTE `cells` sans `height` explicite — chemin de ronde à ~4 m (un
 *  « niveau » de relief, cf. `METRES_PER_LEVEL`). */
const CELL_WALL_HEIGHT_M = 4;

/** Un segment de mur DÉCLARATIF : arête cardinale N/E/S/O (canonisée avant écriture) + door/overlay
 *  (`WallOverlay` : `structure` et/ou `appearance`), ou diagonale `\\`/`/` en travers de la case. Plus
 *  large que `scene.WallSeg` (qui n'admet que la forme CANONIQUE N/E) pour laisser l'auteur nommer
 *  n'importe quel côté d'une case. */
export interface WallSpec extends WallOverlay {
  x: number;
  y: number;
  side: CellSide | '\\' | '/';
  z?: number;
  door?: boolean;
  /** DÉCORATIF : l'arête porte une fenêtre au rendu (mur plein serti d'une vitre — ne change pas le combat). */
  window?: boolean;
  /** ESCALADABLE (LDB 15 l.53-57, cf. `WallSeg.climb`) : l'arête sépare deux surfaces de hauteurs
   *  différentes, franchissable en grimpant plutôt qu'à pied. */
  climb?: WallClimb;
}

/** Spec de relief EN COORDONNÉES (repli bas niveau ; préférer `elevate` piloté par l'ASCII) : boîte
 *  inclusive `rect`, cellule unique `cell` (UNE case [x,y]), ou rampe interpolée `ramp`. */
export type ReliefSpec =
  | { rect: [number, number, number, number]; height: number; z?: number }
  | { cell: [number, number]; height: number; z?: number }
  | { ramp: [number, number, number, number]; from: number; to: number; z?: number };

/** Une liaison de marqueur ASCII → pose. `'heroStart'` (départ héros), `{entry}` (point d'entrée),
 *  `{emplacement}` (poste d'artillerie), ou un TEMPLATE partiel de `SceneEntity` (posé par `pasteEntity`). */
/** Enrôle l'entité posée par un marqueur bind dans la rencontre `enc` (côté/IA/monture) — l'id étant
 *  GÉNÉRÉ à la pose (positions venant de l'ASCII), c'est le SEUL moyen de l'ajouter au roster. */
export type BindMember = { enc: string; side?: 'ally' | 'enemy'; ai?: boolean; mount?: boolean };

export type BindSpec =
  | 'heroStart'
  | { entry: string }
  /** `emplacement` (id d'engin) posé au marqueur : `crew` = id d'équipage servant, `side` = arc de tir naval
   *  (FireArc, absent = pivot libre), `facing` = orientation-monde de l'affût (Dir8), `z` HÉRITÉ de l'étage du
   *  marqueur (grille z1 → affût sur le chemin de ronde). `member` = enrôlement dans la rencontre. */
  | { emplacement: string; crew?: string; side?: FireArc; facing?: Dir8; member?: BindMember }
  | { entity: Partial<SceneEntity>; member?: BindMember }
  | Partial<SceneEntity>;

/** Une rencontre DÉCLARATIVE. `enemies` (terse) → entités FRAÎCHES cachées + members (`buildEncounter`) ;
 *  `members` → enrôle des entités DÉJÀ posées (via `entities`/`bind`) par leur id (PNJ visibles, alliés-IA,
 *  affûts inertes). Les deux fusionnent dans un même roster — plus besoin de `scene.encounters.push` impératif. */
export interface EncounterSpec {
  id: string;
  enemies?: AuthoredEnemy[];
  members?: EncounterMember[];
  surprise?: 'party' | 'enemies';
  onVictory?: Flow;
  /** Rencontre invisible en exploration jusqu'au combat (embuscade visuelle) — pose `combat.hiddenUntilCombat`
   *  sur les entités enrôlées via `enemies`. Défaut false (visibles, RAW). */
  hidden?: boolean;
  /** Avantage initial — Manœuvrabilité (AA 11 l.53-65), cf. `EncounterDef.maneuverability`. */
  maneuverability?: 'party' | 'enemies';
  /** Avantage initial — Menace (AA 11 l.53-65), cf. `EncounterDef.threat`. */
  threat?: { camp: 'party' | 'enemies'; tier: ThreatTier };
  /** Avantage initial — Terrain (AA 11 l.53-65), cf. `EncounterDef.terrain`. */
  terrain?: { camp: 'party' | 'enemies'; heavy?: boolean };
  /** Objectif de victoire (#197), cf. `EncounterDef.victoryCondition`. Absent = `allEnemiesDead`. */
  victoryCondition?: VictoryCondition;
  /** Rencontre de SIÈGE, cf. `EncounterDef.siege`. Absent = false (l'IA ne cible aucune structure). */
  siege?: boolean;
}

/** RECETTE par LETTRE d'une CASE COMPLÈTE (sol + AU PLUS un rôle/structure dessus) — l'authoring unifié
 *  d'une enceinte : une lettre = la case entière, self-documentée — sol, structure et rôle décrits
 *  d'un seul tenant, à un seul endroit.
 *  - `wall` : ENCEINTE PLEINE. Auto-pose une ZONE REMPART sur la couche z+1 (bloc solide `height` m + chemin
 *    de ronde marchable + crénelure) → le z0 devient impassable (MASSE DE MUR) et le rendu (falaise + merlons)
 *    suit. `structure` = apparence crénelée (id `structureAppearance`). Le sol z0 = `terrain` (fondation).
 *  - `gate` : TUNNEL brèchable. Comme `wall` (chemin de ronde CONTINU au-dessus, gatehouse) MAIS le z0 reste
 *    PASSABLE et une structure-porte (`structure`, herse) est posée sur l'arête EXTÉRIEURE (`facing`) = la
 *    BOUCHE du périmètre. Intacte elle bloque le passage (`wallBetween`) ; abattue → brèche ouverte.
 *  - `hero` : départ du groupe à cette case.
 *  - `stair` : VOLÉE d'escalier (#780). Voir doc du champ ci-dessous. */
export interface CellRecipe {
  /** Sol / FONDATION de la case (défaut = base de l'étage — évite l'herbe surprise sous une enceinte). */
  terrain?: Terrain;
  wall?: { structure: string; facing?: CellSide; height?: number };
  gate?: { structure: string; facing?: CellSide };
  hero?: boolean;
  /** VOLÉE d'escalier : relie la surface de l'étage du run (couche z où la lettre est peinte) au
   *  plancher de l'étage `to`, par une rampe de hauteurs interpolées (Δ≤STEP_MAX_M). Connexité
   *  verticale DÉRIVÉE des hauteurs (surfaceLink) — aucun escalier au pathfinding. */
  stair?: { to: string };
}

export interface MapSpec {
  size: [number, number];
  id: string;
  label: string;
  desc?: string;
  ambiance?: Scene['ambiance'];
  weather?: Scene['weather'];
  ambientLight?: string;
  metresPerTile?: number;
  music?: Scene['music'];
  startMessage?: string;
  rest?: Scene['rest'];
  flags?: Record<string, boolean>;
  /** Terrain de base (z0 / couche unique). Absent = la SEMENCE du dépôt (`DEFAULT_TERRAIN`). */
  terrain?: Terrain;
  /** Légende ASCII (char → terrain) partagée par tous les étages. */
  legend?: Record<string, Terrain>;
  /** Char LAISSÉ sous un marqueur nettoyé (marqueur → char de LÉGENDE, ex. `{ B:'W' }` pour poser une pièce
   *  SUR le chemin de ronde 'W' sans y percer un trou). Le char résout ensuite via `legend`. Défaut : `'.'`
   *  → base de l'étage (herbe z0 / vide z1). */
  markerFill?: Record<string, string>;
  /** Grilles ASCII par étage (`z0`/`z1`/…). Sinon une couche pleine de `terrain`. */
  levels?: Record<string, string>;
  /** Grilles BOX-DRAWING par étage (`z0`/`z1`/…) : arêtes DANS l'ASCII (`parseWalledAscii`, (2W+1)×(2H+1)).
   *  Chaque étage → `putLayer(z, tiles)` + les murs d'arête/portes RETOURNÉS (avec `z`). Coexiste avec `levels`
   *  (étages différents) ; MÊME base que `levels` (z0 = `terrain`, z>0 = la tuile ABSENTE). Traité à l'étape 2 (terrain). */
  walled?: Record<string, string>;
  /** Char d'ARÊTE → ce qu'il ÉCRIT sur l'arête d'un étage `walled` (`WallOverlay`) : le char VAUT MUR,
   *  et porte une `structure` destructible (id de `structures.json`, ex. herse `porte-de-ville`), une
   *  `appearance` de rendu sans PV (id de `structureAppearance.json`, ex. cloison `mur-en-bois`), ou
   *  les deux. Ids validés contre les catalogues à la compilation (`assertAuthoredIds`). */
  wallLegend?: Record<string, WallOverlay>;
  /** HAUTEUR (relief) pilotée par l'ASCII (coordonnée-free) : char de LÉGENDE → hauteur métrique, `number` seul
   *  (`{ '4': 4, '3': 3 }` pour une rampe), OU `{ height, parapet }` pour une ZONE REMPART solide crénelée
   *  (`{ W: { height: 4, parapet: 'mur-en-pierre' } }` → face de maçonnerie + crénelure de périmètre au rendu).
   *  Toute case portant le char (n'importe quel étage) prend cette hauteur — remplace les `relief` en coordonnées. */
  elevate?: Record<string, number | { height: number; parapet: string }>;
  /** RECETTE par LETTRE de CASE COMPLÈTE (`CellRecipe`) : `wall` (enceinte pleine), `gate` (tunnel brèchable),
   *  `hero` (départ), `stair` (volée d'escalier, #780). Une lettre `cells` résout son `terrain` dans la
   *  légende ASCII, puis auto-pose sa structure/rôle (zone rempart z+1, herse, heroStart, rampe interpolée
   *  reliant deux surfaces). Point d'entrée UNIFIÉ d'une muraille — mécanisme GÉNÉRAL, toute
   *  forme/épaisseur. */
  cells?: Record<string, CellRecipe>;
  walls?: WallSpec[];
  relief?: ReliefSpec[];
  terrainRects?: { rect: [number, number, number, number]; terrain: Terrain; z?: number }[];
  architecture?: ArchitectureBody[];
  /** Cases d'étage dont le plancher NE REPOSE PAS sur quelque chose (vide/terre nue au-dessous) —
   *  défaut de plan MESURÉ et déjà signalé, toléré ICI par la case NOMMÉE (jamais un contournement
   *  silencieux) le temps du lot de correction du plan qui les traite (`validateFloorSupport`). */
  knownUnsupportedFloor?: { x: number; y: number; z: number }[];
  /** Table des marqueurs ASCII (char → pose). Les chars scannés sont nettoyés avant le parse terrain. */
  bind?: Record<string, BindSpec>;
  /** Entités BRUTES (SceneEntity complètes, ids préservés). */
  entities?: SceneEntity[];
  /** OCCUPATION des places assises du mobilier posé (`propId → slotId → occupant`). Ids FIXES
   *  seulement : `propId` comme `entityId` occupant doivent figurer LITTÉRALEMENT dans `entities`.
   *  Un id produit par `bind` naît d'un compteur (`nextEntityId`) et change dès qu'un marqueur bouge
   *  dans la grille — il ne peut pas être une clé d'assise. */
  seatAssignments?: SeatAssignments;
  /** Départ héros : `[x,y]` ou `{x,y,z}`. */
  heroStart?: [number, number] | { x: number; y: number; z?: number };
  entryPoints?: Record<string, [number, number]>;
  restZones?: { rect: { x: number; y: number; w: number; h: number }; places?: Scene['rest']; quality?: 'normale' | 'pietre' }[];
  effectZones?: SceneEffectZone[];
  /** Calque de ZONES DESCRIPTIVES par étage : grille de chars aux dimensions de l'étage (` `/`.` = aucune
   *  zone), compilée en `SceneEffectZone` purement descriptives (nom de pièce, sans effet mécanique). Recale
   *  les noms de pièces DANS la source. Un char = UNE zone contiguë (deux régions du même char = une zone
   *  fusionnée par bounding-box). */
  zoneMap?: Record<string, string | string[]>;
  /** Légende du calque `zoneMap` : char → libellé de zone. Un char de `zoneMap` absent d'ici = échec fail-fast. */
  zoneLegend?: Record<string, { id?: string; label: string; presentation?: 'interior' | 'exterior' }>;
  triggers?: Trigger[];
  dialogues?: Dialogue[];
  encounters?: EncounterSpec[];
  /** Ancres AUTHORÉES des Scènes de bataille sur le plan (S2, Puissance de Bataille) — passées telles
   *  quelles sur la Scène construite (`Scene.stations`), consommées par `battleScenesToStations`. */
  stations?: SceneStationAnchor[];
}

/** Découpe une chaîne ASCII en lignes, en ne retirant QUE les lignes vides de tête/queue (une chaîne
 *  `String.raw` bordée de `\n` ne perd pas ses lignes internes ; une chaîne inline reste intacte). */
function rowsOf(str: string | string[]): string[] {
  if (Array.isArray(str)) return [...str];
  const rows = str.split('\n');
  while (rows.length && rows[0].trim() === '') rows.shift();
  while (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
  return rows;
}

function copyArchitecture(bodies: ArchitectureBody[]): ArchitectureBody[] {
  return bodies.map((body) => ({
    ...body,
    storeys: body.storeys.map((storey) => ({
      ...storey,
      parts: storey.parts.map((part) => ({ ...part, foot: { ...part.foot } })),
      roomZoneIds: [...storey.roomZoneIds],
    })),
    facades: body.facades.map((facade) => ({
      ...facade,
      edges: facade.edges.map((edge) => ({ ...edge })),
      ...(facade.roomZoneIds ? { roomZoneIds: [...facade.roomZoneIds] } : {}),
      ...(facade.features ? { features: facade.features.map((feature) => ({ ...feature, edge: { ...feature.edge } })) } : {}),
    })),
    masses: body.masses.map((mass) => ({
      ...mass,
      footprint: mass.footprint.map((rect) => ({ ...rect })),
    })),
  }));
}

/** Applique une `ReliefSpec` (cellule par cellule) via `paintHeight`. */
function applyRelief(s: Scene, r: ReliefSpec): Scene {
  const z = ('z' in r ? r.z : undefined) ?? 0;
  if ('cell' in r) {
    return paintHeight(s, { x: r.cell[0], y: r.cell[1] }, r.height, 1, z);
  }
  if ('rect' in r) {
    const [x0, y0, x1, y1] = r.rect;
    let out = s;
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) out = paintHeight(out, { x, y }, r.height, 1, z);
    return out;
  }
  // ramp : interpolation linéaire axiale du (from) au (to) le long de la ligne (x0,y0)→(x1,y1).
  const [x0, y0, x1, y1] = r.ramp;
  const steps = chebyshev({ x: x1, y: y1 }, { x: x0, y: y0 });
  let out = s;
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const x = x0 + Math.round((x1 - x0) * t);
    const y = y0 + Math.round((y1 - y0) * t);
    const height = r.from + (r.to - r.from) * t;
    out = paintHeight(out, { x, y }, height, 1, z);
  }
  return out;
}

/** Compile les recettes `cells.stair` (#780) : chaque composante connexe 4-connexe (même couche z) de
 *  cases `stair` est une VOLÉE — une file LINÉAIRE (jamais ramifiée/cyclique) reliant DEUX surfaces déjà
 *  posées (le sol de l'étage du run et le plancher de l'étage `to`) par une rampe de hauteurs interpolées
 *  (Δ par contremarche ≤ STEP_MAX_M). La connexité verticale est ensuite DÉRIVÉE des hauteurs par
 *  `surfaceLink`/`walkNeighbors` — AUCUN escalier au pathfinding, la volée n'est qu'un relief. Chaque garde
 *  échoue vite plutôt que de compiler une carte incohérente (run mélangé, ramifié, trop court, trémie
 *  bouchée, étage absent, orientation ambiguë). */
function applyStairs(s: Scene, spec: MapSpec, cellCells: { char: string; x: number; y: number; z: number }[]): Scene {
  type Cell = { char: string; x: number; y: number; z: number };
  const stairCells = cellCells.filter((c) => spec.cells![c.char].stair);
  if (!stairCells.length) return s;

  const key = (c: { x: number; y: number; z: number }) => `${c.x},${c.y},${c.z}`;
  const byKey = new Map(stairCells.map((c) => [key(c), c]));

  // Composantes connexes 4-connexes PAR couche z (une volée vit sur une seule couche) — BFS.
  const seen = new Set<string>();
  const runs: Cell[][] = [];
  for (const start of stairCells) {
    const k0 = key(start);
    if (seen.has(k0)) continue;
    seen.add(k0);
    const comp: Cell[] = [];
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift()!;
      comp.push(cur);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nk = `${cur.x + dx},${cur.y + dy},${cur.z}`;
        const n = byKey.get(nk);
        if (n && !seen.has(nk)) { seen.add(nk); queue.push(n); }
      }
    }
    runs.push(comp);
  }

  let out = s;
  for (const run of runs) {
    const first = run[0];
    const label = `stair (${first.x},${first.y})`;
    const recs = run.map((c) => spec.cells![c.char].stair!);
    const to = recs[0].to;
    if (recs.some((r) => r.to !== to)) throw new Error(`${label} : volée mélange plusieurs \`to\``);

    const z = first.z;
    const plan = planStairFlight(out, run, z, parseInt(to.replace('z', ''), 10));
    if (!plan.ok) throw new Error(`${label} : ${plan.reason}`);
    out = applyStairFlight(out, plan.steps, z);
  }

  return out;
}

/** Cellules `"x,y"` d'une couverture de rectangles. */
function archRectCells(footprint: readonly ArchitectureRect[]): Set<string> {
  const out = new Set<string>();
  for (const rect of footprint)
    for (let y = rect.y; y < rect.y + rect.h; y++)
      for (let x = rect.x; x < rect.x + rect.w; x++) out.add(`${x},${y}`);
  return out;
}

/** Un corps NON BORNÉ (aucun `storeys[].parts[].foot` — `bodyFootCells` vide) dérive sur TOUT le
 *  plancher que les autres n'ont pas pris : c'est le RÉSIDUEL de la scène, et il n'en tient qu'un. À
 *  DEUX, la dérivation (`deriveArchitectureMasses`) les départage sur le seul ORDRE du tableau
 *  `architecture` — mesuré sur La Diligence : ordre déclaré → `diligence` prend les 654 cases et ses 5
 *  masses, ordre inversé → `architecture-0` les prend toutes. Un tirage au sort silencieux n'est pas
 *  une attribution : `buildScene` REFUSE.
 *  Deux verdicts, dans cet ordre (le second n'est SAIN qu'une fois le premier tenu : à résiduel unique,
 *  ce qu'il dérive ne dépend plus de l'ordre) :
 *  1. CONCURRENCE — ≥2 corps non bornés alors qu'au moins une case de plancher réel n'est déclarée par
 *     personne (hors emprise d'un corps borné, hors masse authorée, hors ciel ouvert).
 *  2. DONNÉE MORTE — un corps non borné qui ne déclare RIEN (aucun `part`, `roomZoneIds`, façade, masse
 *     authorée ni `roofExclusions`) et ne porte AUCUNE masse dérivée : il ne décrit aucun bâti. */
export function validateArchitectureResiduals(scene: Scene): void {
  const bodies = scene.architecture ?? [];
  const unbounded = bodies.filter((body) => bodyFootCells(body).size === 0);
  if (!unbounded.length) return;

  const floorAt = realFloorAt(scene);
  const spokenFor = new Set<string>();
  for (const body of bodies) {
    for (const key of bodyFootCells(body)) spokenFor.add(key);
    for (const mass of body.masses) {
      if (mass.derived) continue;
      for (const key of archRectCells(mass.footprint)) spokenFor.add(key);
    }
    for (const cells of roofExclusionsByZ(body).values()) for (const key of cells) spokenFor.add(key);
  }
  const claimable = new Set<string>();
  for (const z of new Set([0, ...scene.layers.map((layer) => layer.z)]))
    for (const key of floorAt(z)) if (!spokenFor.has(key)) claimable.add(key);

  if (unbounded.length > 1 && claimable.size) {
    const noms = unbounded.map((body) => `« ${body.id} »`).join(', ');
    throw new Error(`corps NON BORNÉS en concurrence (${noms}) : ${claimable.size} case(s) de plancher ne relèvent d'aucune emprise déclarée, et leur attribution ne tient qu'à l'ORDRE du tableau \`architecture\` — déclare l'emprise (\`storeys[].parts[].foot\`) de l'un des deux, ou supprime le corps de trop`);
  }

  for (const body of unbounded) {
    const declare = body.masses.some((mass) => !mass.derived)
      || body.storeys.some((storey) => storey.parts.length || (storey.roomZoneIds ?? []).length)
      || body.facades.length > 0
      || (body.roofExclusions ?? []).length > 0;
    if (declare) continue;
    if (body.masses.some((mass) => archRectCells(mass.footprint).size)) continue;
    throw new Error(`corps « ${body.id} » : ne déclare RIEN (aucun volume, zone de pièce, façade, masse ni exclusion) et ne porte aucune masse dérivée — donnée MORTE, retire-le de \`architecture\``);
  }
}

/** Les règles FAIL-FAST d'une masse de bâtiment (#823) — l'auteur est un agent qui ne peut pas juger
 *  son résultat à l'œil : `buildScene` REFUSE une masse incohérente plutôt que de compiler un bâtiment
 *  troué. Chaque message nomme la case/masse fautive et dit QUOI corriger. Une masse à `levels` niveaux
 *  COUVRE tous les étages depuis `z − levels + 1` jusqu'à `z` : c'est sur CETTE PLAGE que les règles
 *  comparent, pas seulement l'étage `z` de la masse — sinon un étage entièrement couvert par une masse
 *  à étage serait accusé à tort d'un « plancher sans masse ».
 *  Note #829 : cette fonction tourne sur les masses FINALES (surcharges déclarées + dérivées par
 *  `deriveArchitectureMasses`, cf. `buildScene`). Deux portées : le CORPS (chaque règle se juge sur
 *  les masses d'un corps et, PAR ÉTAGE, sur l'emprise que ce corps y déclare — `bodyFootCellsByZ`,
 *  jamais sur le plancher de la scène entière que `realFloorAt` rend tous corps confondus) ; puis la
 *  SCÈNE (toute case de plancher réel relève d'un corps — masse ou exclusion à ciel ouvert). */
function validateBuildingMasses(scene: Scene): void {
  validateArchitectureResiduals(scene); // à qui revient le plancher non déclaré : à UN seul corps
  const massCells = (footprint: readonly ArchitectureRect[]): Set<string> => {
    const out = new Set<string>();
    for (const rect of footprint)
      for (let y = rect.y; y < rect.y + rect.h; y++)
        for (let x = rect.x; x < rect.x + rect.w; x++) out.add(`${x},${y}`);
    return out;
  };
  const isContiguous = (cells: ReadonlySet<string>): boolean => {
    if (cells.size <= 1) return true;
    const start = [...cells][0];
    const seen = new Set([start]);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i].split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const key = `${x + dx},${y + dy}`;
        if (cells.has(key) && !seen.has(key)) { seen.add(key); queue.push(key); }
      }
    }
    return seen.size === cells.size;
  };
  const layerZs = new Set(scene.layers.map((l) => l.z));
  const floorAt = realFloorAt(scene);
  /** Ce que CHAQUE corps couvre (masses par étage) ou dispense (ciel ouvert) — relu par la règle de
   *  COMPLÉTUDE de scène, une fois tous les corps passés. */
  const covered: { coverage: Map<number, Map<string, string>>; sky: ReadonlySet<string> }[] = [];

  for (const body of scene.architecture ?? []) {
    // CIEL DÉCLARÉ à la COLONNE : une `roofExclusions` dispense la case de couverture à TOUS ses
    // étages, comme la dérivation qui n'y pose plus aucune masse (`deriveArchitectureMasses`) —
    // l'exiger à l'étage du dessous réclamerait un toit sous le ciel que l'auteur vient d'ouvrir.
    const sky = new Set<string>();
    for (const cells of roofExclusionsByZ(body).values()) for (const key of cells) sky.add(key);
    // EMPRISE du corps PAR ÉTAGE (`bodyFootCellsByZ`) : `floorAt` rend le plancher de la scène
    // ENTIÈRE (tous corps confondus) et un bâtiment peut se décrire en plusieurs corps SUPERPOSÉS
    // (rez de l'un, étage de l'autre) — la couverture ne s'exige d'un corps qu'aux étages où il
    // déclare un volume, et seulement sur les cases de ce volume.
    const footByZ = bodyFootCellsByZ(body);
    for (const mass of body.masses) {
      if (!Number.isInteger(mass.levels) || mass.levels < 1)
        throw new Error(`masse « ${mass.id} » (corps « ${body.id} ») : \`levels\` invalide (${mass.levels}) — entier ≥ 1 attendu`);
      if (!Number.isFinite(mass.pitchDeg) || mass.pitchDeg < PENTE_TOIT_DEG.min || mass.pitchDeg > PENTE_TOIT_DEG.max)
        throw new Error(`masse « ${mass.id} » (corps « ${body.id} ») : pente ${mass.pitchDeg}° hors plage sensée [${PENTE_TOIT_DEG.min}°, ${PENTE_TOIT_DEG.max}°] — corrige \`pitchDeg\``);
      const cells = massCells(mass.footprint);
      if (!cells.size)
        throw new Error(`masse « ${mass.id} » (corps « ${body.id} ») : emprise vide — \`footprint\` doit contenir au moins un rectangle`);
      if (!isContiguous(cells))
        throw new Error(`masse « ${mass.id} » (corps « ${body.id} ») : emprise NON CONTIGUË — une masse est un seul bloc connexe (4-adjacence) ; scinde-la en plusieurs masses`);
      if ((mass.profile === 'gable' || mass.profile === 'hip') && !mass.ridge) {
        const xs = [...cells].map((k) => Number(k.split(',')[0]));
        const ys = [...cells].map((k) => Number(k.split(',')[1]));
        const bw = Math.max(...xs) - Math.min(...xs) + 1;
        const bh = Math.max(...ys) - Math.min(...ys) + 1;
        if (bw === bh)
          throw new Error(`masse « ${mass.id} » (corps « ${body.id} ») : emprise carrée (${bw}×${bh}) — l'axe de faîtage (\`ridge\`) est ambigu, déclare-le ('x' ou 'y')`);
      }
      if (mass.profile === 'shed' && !mass.eaveSide)
        throw new Error(`masse « ${mass.id} » (corps « ${body.id} ») : profil \`shed\` sans \`eaveSide\` déclaré — précise le côté d'égout bas ('N'|'E'|'S'|'O')`);
      if (mass.z !== 0 && !layerZs.has(mass.z))
        throw new Error(`masse « ${mass.id} » (corps « ${body.id} ») : étage ${mass.z} inexistant — ajoute la couche ou corrige \`z\``);
    }

    // Règle 1 (silhouette assertée) : au sommet `mass.z` d'une masse — le SEUL étage où son empreinte
    // est une AFFIRMATION explicite de l'auteur — toute case doit être BÂTIE : plancher réel à cet
    // étage, ou OUVERTURE que la dérivation sait coiffer (#1181) — trou enclos de la nappe, case de
    // volée qui débouche à cet étage — portant un plancher plus bas dans la plage de la masse. La
    // géométrie est celle de l'ADOPTION (`adoptableOpeningsAt`, `state/sceneEdit.ts`), partagée et non
    // recopiée : ce qu'une masse a le droit de couvrir sans plancher au sommet est exactement ce que
    // la dérivation adopte. Une encoche de BORD — jamais enclose, sans marche qui y monte — reste
    // refusée quel que soit `levels`, et le ciel ouvert se DÉCLARE (`roofExclusions`).
    // Règle 2/3 (couverture/chevauchement) : sur TOUTE la plage `z − levels + 1 … z`, PAS seulement le
    // sommet — une masse à étage COUVRE structurellement ses niveaux inférieurs par construction (les
    // murs vont jusqu'en bas), donc son empreinte y compte comme couverture SANS devoir coïncider
    // exactement avec le plancher intérieur du dessous (une pièce du rez peut être plus subdivisée /
    // moins étiquetée que la silhouette de l'étage qui la coiffe — mesuré sur La Diligence : 48 cases
    // d'étage sans étiquette de zone au rez, légitimes). Chevaucher DEUX masses au même étage reste
    // toujours une erreur, à N'IMPORTE quel niveau de la plage.
    const coverage = new Map<number, Map<string, string>>(); // z → (cellKey → massId propriétaire)
    for (const mass of body.masses) {
      const cells = massCells(mass.footprint);
      const floorTop = floorAt(mass.z);
      const adoptable = adoptableOpeningsAt(scene, mass.z);
      const bearing = (key: string): boolean => {
        if (!adoptable.has(key)) return false;
        for (let z = mass.z - mass.levels + 1; z < mass.z; z++) if (floorAt(z).has(key)) return true;
        return false;
      };
      for (const key of cells)
        if (!floorTop.has(key) && !bearing(key)) {
          const [x, y] = key.split(',').map(Number);
          throw new Error(`masse « ${mass.id} » (corps « ${body.id} ») : case (${x},${y}) hors du plancher réel de l'étage ${mass.z} — retire-la de l'emprise, ou étends/déclare la zone/le plancher qui la justifie`);
        }
      for (let z = mass.z - mass.levels + 1; z <= mass.z; z++) {
        const at = coverage.get(z) ?? (coverage.set(z, new Map()).get(z)!);
        for (const key of cells) {
          const owner = at.get(key);
          if (owner && owner !== mass.id) {
            const [x, y] = key.split(',').map(Number);
            throw new Error(`corps « ${body.id} » : case (${x},${y}) à l'étage ${z} CHEVAUCHÉE par les masses « ${owner} » et « ${mass.id} » — les masses doivent partitionner le plancher sans recouvrement`);
          }
          at.set(key, mass.id);
        }
      }
    }
    // Couverture exigée sur TOUT étage où le corps DÉCLARE un volume — pas seulement sur ceux où il
    // a POSÉ une masse : un corps dont l'emprise est bâtie mais qui finit SANS aucune masse (masses
    // authorées retirées et dérivation empêchée — cases déjà revendiquées par la surcharge d'un
    // autre corps) laisserait sinon son plancher nu sans que rien ne le dise.
    for (const [z, foot] of [...footByZ].sort((a, b) => a[0] - b[0])) {
      const at = coverage.get(z) ?? new Map<string, string>();
      const floor = floorAt(z);
      for (const key of floor) {
        if (!foot.has(key)) continue;
        if (sky.has(key)) continue; // #829 : cour à ciel ouvert déclarée — aucune masse n'est due
        if (!at.has(key)) {
          const [x, y] = key.split(',').map(Number);
          throw new Error(`corps « ${body.id} » : case de plancher (${x},${y}) à l'étage ${z} n'appartient à AUCUNE masse — ajoute-la à une masse existante ou crée une masse qui la couvre`);
        }
      }
    }
    covered.push({ coverage, sky });
  }

  // COMPLÉTUDE DE SCÈNE : la règle par-corps ci-dessus ne juge un corps que sur SON emprise déclarée
  // (`bodyFootCellsByZ`) — un `foot` plus PETIT que l'intérieur réellement clos par les murs laissait
  // donc la différence hors de toute masse SANS que rien ne le dise (mesuré : mur 4×4, `foot` 2×2 →
  // 12 cases nues, aucune erreur). Le plancher réel de la scène se juge donc AUSSI en entier : chaque
  // case appartient à la masse d'un corps, ou à l'exclusion à ciel ouvert d'un corps.
  for (const z of [...new Set([0, ...layerZs])].sort((a, b) => a - b)) {
    for (const key of floorAt(z)) {
      if (covered.some(({ coverage, sky }) => coverage.get(z)?.has(key) || sky.has(key))) continue;
      const [x, y] = key.split(',').map(Number);
      throw new Error(`case de plancher (${x},${y}) à l'étage ${z} n'est couverte par AUCUN corps — étends le \`foot\` du corps qui la contient, déclare une masse qui la couvre, ou une \`roofExclusions\` si elle est à ciel ouvert`);
    }
  }
}


/** Une case d'étage (z>0) doit REPOSER sur quelque chose — plancher/pavé au sol, ou une masse de
 *  l'étage inférieur — jamais un sol NU, c.-à-d. tout terrain sans `built` (#825ter, mesuré : 5 cases de La Diligence
 *  posées sur l'herbe, rien ne le détectait). Portée aux SEULS étages qui portent une masse de
 *  bâtiment (`ArchitectureBody.masses`) : un chemin de ronde (`elevate`+parapet, hors masses) est un
 *  système DÉJÀ validé à part (#818) — sa surface porte sur la maçonnerie du rempart, jamais un
 *  plancher/pavé, et ce n'est pas ce que cette règle vérifie. `tolerated` = cases DÉJÀ mesurées
 *  fautives sur un plan EXISTANT (`MapSpec.knownUnsupportedFloor`), tolérées ICI le temps du lot de
 *  correction du plan qui les traite — jamais un contournement silencieux : chaque case tolérée est
 *  NOMMÉE par son auteur. */
function validateFloorSupport(scene: Scene, tolerated: ReadonlySet<string>): void {
  if (!(scene.architecture ?? []).some((body) => body.masses.length)) return; // aucun bâtiment authoré
  const { w, h } = scene.dimensions;
  // Sols NUS lus à la DONNÉE (`groundTerrains`, complément de `built`) : réciter trois ids laissait
  // les 14 autres sols nus (`sable`, `boue`, `neige`, `eau`, `lave`…) hors de la règle — la même case
  // d'étage levait sur « herbe » et passait en silence sur « sable ».
  const solsNus = groundTerrains();
  for (const layer of scene.layers) {
    if (layer.z <= 0) continue;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (estAbsent(tileAt(scene, x, y, layer.z))) continue;
        if (tolerated.has(`${x},${y},${layer.z}`)) continue;
        const belowZ = layer.z - 1;
        const belowTerrain = tileAt(scene, x, y, belowZ);
        if (!solsNus.has(belowTerrain)) continue;
        const built = (scene.architecture ?? []).some((body) =>
          body.masses.some((mass) => belowZ >= mass.z - mass.levels + 1 && belowZ <= mass.z
            && mass.footprint.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)));
        if (built) continue;
        throw new Error(`case d'étage (${x},${y},z${layer.z}) posée sur « ${belowTerrain} » — un plancher d'étage doit reposer sur une SURFACE BÂTIE (\`terrains.json › built\`) ou sur une masse de l'étage inférieur, jamais sur un sol nu (\`MapSpec.knownUnsupportedFloor\` pour tolérer un défaut de plan déjà mesuré)`);
      }
  }
}

/** Compile un `MapSpec` en `Scene` — PUR, rejoue les primitives de `sceneEdit` dans l'ordre figé (cf. header). */
export function buildScene(spec: MapSpec): Scene {
  const [w, h] = spec.size;

  // 1. base + scalaires
  let s = emptyScene(w, h);
  s.id = spec.id;
  s.label = spec.label;
  if (spec.desc !== undefined) s.desc = spec.desc;
  if (spec.ambiance !== undefined) s.ambiance = spec.ambiance;
  if (spec.weather !== undefined) s.weather = spec.weather;
  if (spec.music !== undefined) s.music = spec.music;
  if (spec.rest !== undefined) s.rest = spec.rest;
  if (spec.startMessage !== undefined) s.startMessage = spec.startMessage;
  if (spec.metresPerTile !== undefined) s = setMetresPerTile(s, spec.metresPerTile);
  if (spec.ambientLight !== undefined) s = setAmbientLight(s, spec.ambientLight);
  s = setSceneFlags(s, spec.flags ?? {});

  // 2. terrain + scan des marqueurs
  const bindChars = Object.keys(spec.bind ?? {}).join('');
  const scanned: { char: string; pos: Pt; z: number }[] = [];
  const walledWalls: WallSpec[] = [];
  // LÉGENDE EFFECTIVE : les lettres `cells` résolvent leur `terrain` (fondation ; défaut = base d'étage) dans
  // l'ASCII, en surchargeant `legend` et les glyphes `ascii` de `terrains.json` → un `#` d'enceinte tombe
  // sur la fondation de la lettre, pas sur le terrain que le glyphe désigne par défaut ni sur la base.
  const cellTerrains: Record<string, Terrain> = {};
  for (const [ch, rec] of Object.entries(spec.cells ?? {})) cellTerrains[ch] = rec.terrain ?? spec.terrain ?? DEFAULT_TERRAIN;
  const effLegend = { ...spec.legend, ...cellTerrains };
  // Cases repérées dans l'ASCII pour les char-maps coordonnée-free (`elevate` hauteur/rempart, `cells`
  // recette de case) — le char est de LÉGENDE (marqueurs déjà nettoyés → markerFill).
  // `elevate` est appliqué à l'étape 3bis (APRÈS le relief) ; `cells` à l'étape 3ter, et génère des
  // `WallSpec` (herses) posés à l'étape 4.
  const elevateCells: { char: string; x: number; y: number; z: number }[] = [];
  const cellCells: { char: string; x: number; y: number; z: number }[] = [];
  const scanChars = (rows: string[], z: number, colAt: (r: string, x: number) => string) => {
    if (!spec.elevate && !spec.cells) return;
    for (let y = 0; y < rows.length; y++)
      for (let x = 0; x < w; x++) {
        const ch = colAt(rows[y], x);
        if (spec.elevate?.[ch] !== undefined) elevateCells.push({ char: ch, x, y, z });
        if (spec.cells?.[ch]) cellCells.push({ char: ch, x, y, z });
      }
  };
  if (spec.levels) {
    for (const [key, rows] of Object.entries(spec.levels)) {
      const z = parseInt(key.replace('z', ''), 10);
      const { positions, cleaned } = scanMarkers(rowsOf(rows), bindChars, spec.markerFill);
      for (const [ch, list] of Object.entries(positions)) for (const p of list) scanned.push({ char: ch, pos: p, z });
      const base: Terrain = z === 0 ? (spec.terrain ?? DEFAULT_TERRAIN) : terrainAbsent();
      const tiles = parseAsciiRows(cleaned, base, effLegend).tiles;
      s = putLayer(s, z, tiles);
      scanChars(cleaned, z, (r, x) => r[x] ?? ' ');
    }
  }
  if (spec.walled) {
    // Grille BOX-DRAWING par étage : `parseWalledAscii` extrait tuiles + murs d'arête/portes. Chaque rangée est
    // recomplétée à 2W+1 (les ASCII éditables retirent les espaces de fin) ; les murs héritent du `z` de l'étage.
    for (const [key, rows] of Object.entries(spec.walled)) {
      const z = parseInt(key.replace('z', ''), 10);
      const base: Terrain = z === 0 ? (spec.terrain ?? DEFAULT_TERRAIN) : terrainAbsent();
      const padded = walledRowsOf(rows, w);
      const parsed = parseWalledAscii(padded, base, effLegend, { wallLegend: spec.wallLegend });
      s = putLayer(s, z, parsed.tiles);
      for (const seg of parsed.walls) walledWalls.push({ x: seg.x, y: seg.y, side: seg.side, ...(z ? { z } : {}), ...(seg.door ? { door: true } : {}), ...(seg.window ? { window: true } : {}), ...wallOverlayOf(seg) });
      scanChars(padded.filter((_, i) => i % 2 === 1), z, (r, x) => r[2 * x + 1] ?? ' '); // tuiles aux slots impairs
    }
  }
  if (!spec.levels && !spec.walled) {
    s = putLayer(s, 0, new Array(w * h).fill(spec.terrain ?? DEFAULT_TERRAIN) as Terrain[]);
  }
  for (const { rect: [x, y, rw, rh], terrain, z = 0 } of spec.terrainRects ?? []) {
    s = fillTerrainRect(s, { x, y, w: rw, h: rh }, terrain, z);
  }

  // 3. relief (coordonnées, repli) PUIS 3bis les hauteurs pilotées par l'ASCII (`elevate`) : nombre = pente/
  //    palier ; objet `{height, parapet}` = hauteur + marquage CRÉNELÉ (décoration de crête sur le pourtour).
  for (const r of spec.relief ?? []) s = applyRelief(s, r);
  for (const c of elevateCells) {
    const cfg = spec.elevate![c.char];
    s = paintHeight(s, { x: c.x, y: c.y }, typeof cfg === 'number' ? cfg : cfg.height, 1, c.z);
    if (typeof cfg === 'object') s = paintCrenellated(s, { x: c.x, y: c.y }, cfg.parapet, 1, c.z);
  }

  // 3ter. cells : recette par LETTRE de case complète. Une lettre-mur/porte AUTO-POSE une ZONE REMPART sur
  //   la couche z+1 (bloc solide de `height` m + chemin de ronde marchable + crénelure `structure`) → le z0
  //   devient impassable (MASSE DE MUR, `isWalkable`) et le rendu (falaise + merlons) suit tout seul. Une
  //   porte laisse EN PLUS le z0 en TUNNEL (via `gateTunnelAt`) et pose sa herse (`WallSpec structure`) sur la
  //   BOUCHE = l'arête `facing` UNIQUEMENT là où elle borde l'EXTÉRIEUR de la bande (voisin hors bande) ; les
  //   arêtes internes d'une bande épaisse n'en portent pas (une seule herse à abattre). GÉNÉRAL, toute forme.
  const bandSet = new Set(cellCells.filter((c) => spec.cells![c.char].wall || spec.cells![c.char].gate).map((c) => `${c.x},${c.y},${c.z}`));
  // Apparence de CRÉNELURE de la bande = la structure du mur plein (`#`) — merlons de PÉRIMÈTRE dérivés par
  // `crestGeometry` (décoration de rendu, ne coupe pas la LdV plongeante). Toute la bande la porte (crête continue).
  const crestApp = Object.values(spec.cells ?? {}).find((r) => r.wall)?.wall?.structure;
  const cellWalls: WallSpec[] = [];
  for (const c of cellCells) {
    const rec = spec.cells![c.char];
    const build = rec.wall ?? rec.gate;
    if (build) {
      const zz = c.z + 1;
      const height = rec.wall?.height ?? CELL_WALL_HEIGHT_M;
      // MASSE : un mur plein → le BLOC PLEIN du défaut de compilation, posé au SOL (le moteur en dérive
      // toutes les faces à partir du relief, dont la PAROI
      // du tunnel qu'il borde, comme un bâtiment). Une PORTE laisse le sol z0 tel quel → passable = le TUNNEL.
      if (rec.wall) s = paintTiles(s, { x: c.x, y: c.y }, defautsDeCompilation.masse, 1, c.z);
      // CHEMIN DE RONDE : une COUCHE DE SOL marchable posée par-dessus, à `height` m (dessus du bloc / toit
      // du tunnel). Sur une porte, ce sol coiffe un vide → SURPLOMB → son dessous = le plafond (règle générale).
      s = addLayer(s, zz);
      s = paintTiles(s, { x: c.x, y: c.y }, defautsDeCompilation.cheminDeRonde, 1, zz);
      s = paintHeight(s, { x: c.x, y: c.y }, height, 1, zz);
      // CRÉNELURE (décoration) : marque le chemin de ronde → merlons sur le PÉRIMÈTRE de la bande.
      if (crestApp) s = paintCrenellated(s, { x: c.x, y: c.y }, crestApp, 1, zz);
    }
    if (rec.gate) {
      const facing = rec.gate.facing ?? 'N';
      const [nx, ny] = facing === 'N' ? [c.x, c.y - 1] : facing === 'E' ? [c.x + 1, c.y] : facing === 'S' ? [c.x, c.y + 1] : [c.x - 1, c.y];
      if (!bandSet.has(`${nx},${ny},${c.z}`)) // arête de BOUCHE (borde l'extérieur), pas une arête interne
        cellWalls.push({ x: c.x, y: c.y, side: facing, ...(c.z ? { z: c.z } : {}), structure: rec.gate.structure });
    }
    if (rec.hero) {
      const pos = { x: c.x, y: c.y };
      s = pasteEntity(s, { id: '', kind: 'heroStart', pos, ...(c.z ? { z: c.z } : {}) }, pos, c.z).scene;
    }
  }

  // 3quater. stair : volées d'escalier — rampe interpolée entre deux surfaces + trémie (#780).
  s = applyStairs(s, spec, cellCells);

  // 4. walls : arêtes extraites de `walled`, PUIS les herses de `cells`, PUIS les `walls` déclaratifs
  //    en coordonnées.
  const allWalls = [...walledWalls, ...cellWalls, ...(spec.walls ?? [])];
  // Passe 1 : murs orthogonaux (N/E/S/O) — les diagonales lisent l'état des arêtes voisines pour leur
  // garde de coin (ci-dessous), elles doivent donc être TOUTES posées d'abord.
  for (const wall of allWalls) {
    if (wall.side === '\\' || wall.side === '/') continue;
    const z = wall.z ?? 0;
    s = setEdgeWall(s, wall.x, wall.y, wall.side, z, wall.door ? 'door' : 'wall');
    if (wall.structure || wall.appearance || wall.window || wall.climb) {
      const c = canonEdge(wall.x, wall.y, wall.side);
      s = patchWall(s, c.x, c.y, c.side, z, { ...(wall.structure ? { structure: wall.structure } : {}), ...(wall.appearance ? { appearance: wall.appearance } : {}), ...(wall.window ? { window: true } : {}), ...(wall.climb ? { climb: wall.climb } : {}) });
    }
  }
  // Passe 2 : diagonales — arête PUREMENT VISUELLE (scene.ts:698-700) : déplacement/vision/grimpe restent
  // orthogonaux (`edgeOf`/`wallBetween`/`vision.ts` ne résolvent QUE N/E) → `climb`/`structure`/`door`
  // ne bloqueraient/ouvriraient jamais rien : les poser mentirait silencieusement sur leur effet.
    // `window` et `appearance` restent décoratifs purs (aucune règle mécanique ne les lit).
  for (const wall of allWalls) {
    if (wall.side !== '\\' && wall.side !== '/') continue;
    const z = wall.z ?? 0;
    if (wall.climb || wall.structure || wall.door) {
      throw new Error(
        `buildScene: WallSpec diagonal (${wall.x},${wall.y}) ne peut pas porter climb/structure/door — arête oblique purement visuelle (mouvement/vision/grimpe restent orthogonaux, cf. scene.ts WallSide)`,
      );
    }
    // Garde #781 : un pan diagonal BISEAUTE deux coins opposés — il n'est légal que s'il adosse au
    // moins un coin FERMÉ (ses deux arêtes orthogonales murées), sinon c'est un pan flottant qui ferait
    // croire à une séparation/un blocage inexistants (le pan reste un habillage, jamais une frontière).
    const closed = (edgeA: CellSide, edgeB: CellSide) =>
      edgeWallState(s, wall.x, wall.y, edgeA, z) === 'wall' && edgeWallState(s, wall.x, wall.y, edgeB, z) === 'wall';
    const legal = wall.side === '\\' ? closed('N', 'O') || closed('S', 'E') : closed('N', 'E') || closed('S', 'O');
    if (!legal) {
      throw new Error(
        `buildScene: pan diagonal (${wall.x},${wall.y}) sans coin orthogonal muré — orthogonalise l'enveloppe ou adosse le pan à deux murs pleins formant le coin qu'il adoucit (mouvement/vision restent orthogonaux, cf. scene.ts WallSide)`,
      );
    }
    s = toggleDiagonalWall(s, wall.x, wall.y, wall.side, z);
    if (wall.window || wall.appearance) s = patchWall(s, wall.x, wall.y, wall.side, z, {
      ...(wall.window ? { window: true } : {}),
      ...(wall.appearance ? { appearance: wall.appearance } : {}),
    });
  }

  // 5. architecture (copie non validée — la validation tourne en fin de fonction, §9, une fois les
  //    zones connues : les masses se valident contre le plancher RÉEL, pas contre elles-mêmes).
  if (spec.architecture?.length) s = { ...s, architecture: copyArchitecture(spec.architecture) };

  // 6. entities brutes + heroStart + bind
  if (spec.entities?.length) s = { ...s, entities: [...s.entities, ...spec.entities] };
  if (spec.heroStart) {
    const hs = Array.isArray(spec.heroStart) ? { x: spec.heroStart[0], y: spec.heroStart[1] } : spec.heroStart;
    const z = (Array.isArray(spec.heroStart) ? undefined : spec.heroStart.z) ?? 0;
    s = pasteEntity(s, { id: '', kind: 'heroStart', pos: { x: hs.x, y: hs.y }, ...(z ? { z } : {}) }, { x: hs.x, y: hs.y }, z).scene;
  }
  const boundMembers: { enc: string; member: EncounterMember }[] = [];
  const mkMember = (entityId: string, m: BindMember): EncounterMember => {
    const mem: EncounterMember = { entityId };
    if (m.side) mem.side = m.side;
    if (m.ai) mem.ai = m.ai;
    if (m.mount) mem.mount = m.mount;
    return mem;
  };
  for (const { char, pos, z: markerZ } of scanned) {
    const bind = spec.bind?.[char];
    if (!bind) continue;
    if (bind === 'heroStart') {
      s = pasteEntity(s, { id: '', kind: 'heroStart', pos }, pos).scene;
    } else if ('entry' in bind && typeof (bind as { entry: string }).entry === 'string') {
      const name = (bind as { entry: string }).entry;
      s = { ...s, entryPoints: { ...s.entryPoints, [name]: { x: pos.x, y: pos.y } } };
    } else if ('emplacement' in bind && typeof (bind as { emplacement: string }).emplacement === 'string') {
      const b = bind as { emplacement: string; crew?: string; side?: FireArc; facing?: Dir8; member?: BindMember };
      // z HÉRITÉ de l'étage du marqueur (grille z1 → affût sur le chemin de ronde) ; `facing` = orientation-monde.
      const placed = placeEmplacement(s, b.emplacement, pos, markerZ, b.facing);
      if (placed) {
        s = placed.scene;
        if (b.crew) s = setPosteCrew(s, placed.id, [b.crew]);
        if (b.side) s = setPosteSide(s, placed.id, b.side);
        if (b.member) boundMembers.push({ enc: b.member.enc, member: mkMember(placed.id, b.member) });
      }
    } else if ('entity' in bind && (bind as { entity: Partial<SceneEntity> }).entity) {
      const b = bind as { entity: Partial<SceneEntity>; member?: BindMember };
      const z = b.entity.z ?? 0;
      const placed = pasteEntity(s, { ...(b.entity as SceneEntity), id: '', kind: b.entity.kind ?? 'personnage', pos, ...(z ? { z } : {}) }, pos, z);
      s = placed.scene;
      if (b.member) boundMembers.push({ enc: b.member.enc, member: mkMember(placed.id, b.member) });
    } else {
      const tmpl = bind as Partial<SceneEntity>;
      const z = tmpl.z ?? 0;
      s = pasteEntity(s, { ...(tmpl as SceneEntity), id: '', kind: tmpl.kind ?? 'personnage', pos, ...(z ? { z } : {}) }, pos, z).scene;
    }
  }

  // 6bis. assise authorée — APRÈS `entities`+`heroStart`+`bind` (les corps doivent être posés), et à
  //       ids FIXES seulement : un id que seul `bind` a fabriqué change au moindre déplacement de
  //       marqueur. Puis le validateur strict COMMUN du document (`state/seating`), fail-fast.
  if (spec.seatAssignments) {
    const fixes = new Set((spec.entities ?? []).map((e) => e.id));
    const exigeFixe = (id: string, quoi: string) => {
      if (!fixes.has(id))
        throw new Error(`buildScene: seatAssignments n'accepte que des ids fixes de \`entities\` — ${quoi} « ${id} » n'y figure pas (un id posé par \`bind\` est généré et change avec la grille)`);
    };
    for (const [propId, parMeuble] of Object.entries(spec.seatAssignments)) {
      exigeFixe(propId, 'le décor');
      for (const occupant of Object.values(parMeuble))
        if (occupant.kind === 'entity') exigeFixe(occupant.entityId, "l'occupant");
    }
    s = { ...s, seatAssignments: spec.seatAssignments };
    const defauts = seatAssignmentDefects(s);
    if (defauts.length) throw new Error(`buildScene: ${defauts.map((d) => d.message).join(' ; ')}`);
  }

  // 7. zones
  if (spec.entryPoints) {
    const pts: Record<string, { x: number; y: number }> = { ...s.entryPoints };
    for (const [name, [x, y]] of Object.entries(spec.entryPoints)) pts[name] = { x, y };
    s = { ...s, entryPoints: pts };
  }
  for (const rz of spec.restZones ?? []) {
    const added = addRestZone(s, rz.rect);
    s = added.scene;
    if (rz.places || rz.quality) {
      s = {
        ...s,
        restZones: (s.restZones ?? []).map((z, i) =>
          i === added.idx ? { ...z, ...(rz.places ? { places: rz.places } : {}), ...(rz.quality ? { quality: rz.quality } : {}) } : z,
        ),
      };
    }
  }
  if (spec.effectZones?.length) s = { ...s, effectZones: [...(s.effectZones ?? []), ...spec.effectZones] };
  if (spec.zoneMap) {
    // Calque de ZONES DESCRIPTIVES (#782) : un char = une zone contiguë par étage, bounding-box de ses
    // cellules. Char hors légende → fail-fast (même doctrine que `parseAsciiRows`).
    const zoneCells: { char: string; x: number; y: number; z: number }[] = [];
    for (const [key, rows] of Object.entries(spec.zoneMap)) {
      const z = parseInt(key.replace('z', ''), 10);
      const lines = rowsOf(rows);
      for (let y = 0; y < lines.length; y++) {
        for (let x = 0; x < lines[y].length; x++) {
          const ch = lines[y][x];
          if (ch === ' ' || ch === '.') continue;
          if (!spec.zoneLegend?.[ch]) throw new Error(`zoneMap: char inconnu « ${ch} » (étage ${key}, ligne ${y})`);
          zoneCells.push({ char: ch, x, y, z });
        }
      }
    }
    const byCharZ = new Map<string, {
      char: string;
      z: number;
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
      tiles: { x: number; y: number; z: number }[];
    }>();
    for (const c of zoneCells) {
      const k = `${c.char}|${c.z}`;
      const cur = byCharZ.get(k);
      if (!cur) byCharZ.set(k, {
        char: c.char,
        z: c.z,
        minX: c.x,
        minY: c.y,
        maxX: c.x,
        maxY: c.y,
        tiles: [{ x: c.x, y: c.y, z: c.z }],
      });
      else {
        cur.tiles.push({ x: c.x, y: c.y, z: c.z });
        cur.minX = Math.min(cur.minX, c.x);
        cur.minY = Math.min(cur.minY, c.y);
        cur.maxX = Math.max(cur.maxX, c.x);
        cur.maxY = Math.max(cur.maxY, c.y);
      }
    }
    const namedZones: SceneEffectZone[] = [...byCharZ.values()].map((b) => ({
      id: spec.zoneLegend![b.char].id ?? `zone-${b.char}-z${b.z}`,
      label: spec.zoneLegend![b.char].label,
      presentation: spec.zoneLegend![b.char].presentation,
      area: { kind: 'rect', x: b.minX, y: b.minY, w: b.maxX - b.minX + 1, h: b.maxY - b.minY + 1 },
      tiles: b.tiles,
      z: b.z,
    }));
    if (namedZones.length) s = { ...s, effectZones: [...(s.effectZones ?? []), ...namedZones] };
  }
  if (spec.triggers?.length) s = { ...s, triggers: [...s.triggers, ...spec.triggers] };
  if (spec.dialogues?.length) s = { ...s, dialogues: [...s.dialogues, ...spec.dialogues] };

  // 8. encounters : terse (`enemies` → entités fraîches cachées) FUSIONNÉ avec `members` (entités déjà
  //    posées) ET les membres enrôlés par bind (`boundMembers`, ids générés aux marqueurs ASCII).
  const encEntities: SceneEntity[] = [];
  const encDefs: EncounterDef[] = [];
  for (const e of spec.encounters ?? []) {
    const built = buildEncounter({
      id: e.id, enemies: e.enemies ?? [], surprise: e.surprise, onVictory: e.onVictory, hidden: e.hidden,
      maneuverability: e.maneuverability, threat: e.threat, terrain: e.terrain, victoryCondition: e.victoryCondition,
      siege: e.siege,
    });
    encEntities.push(...built.entities);
    const bound = boundMembers.filter((b) => b.enc === e.id).map((b) => b.member);
    encDefs.push({ ...built.encounter, members: [...(built.encounter.members ?? []), ...(e.members ?? []), ...bound] });
  }
  // Marqueurs bind vers une rencontre NON déclarée dans `encounters` → on la crée (roster = ces membres).
  const declared = new Set(encDefs.map((e) => e.id));
  const orphans = new Map<string, EncounterMember[]>();
  for (const b of boundMembers) {
    if (declared.has(b.enc)) continue;
    if (!orphans.has(b.enc)) orphans.set(b.enc, []);
    orphans.get(b.enc)!.push(b.member);
  }
  for (const [id, members] of orphans) encDefs.push({ id, members });
  s = { ...s, entities: [...s.entities, ...encEntities], encounters: encDefs };

  // Ancres de Scènes de bataille (S2) : posées telles quelles sur la Scène (repli sur les postes navals).
  if (spec.stations) s = { ...s, stations: spec.stations };

  // 8bis. masses de bâtiment DÉRIVÉES par défaut depuis le plancher réel (#829, corrige #822) — les
  // masses de `spec.architecture` deviennent des SURCHARGES ; le reste du plancher les reçoit sans
  // déclaration. Après les zones (`interiorFloorAt0` en dépend) et avant la validation, qui tourne sur
  // ce résultat combiné.
  if (spec.architecture?.length) s = { ...s, architecture: deriveArchitectureMasses(s) };

  // 9. validation : les 6 règles fail-fast d'une masse (#823) tournent ICI, une fois le plancher réel
  //    et les zones connus — une masse se valide contre le bâtiment RÉEL, jamais contre elle-même.
  if (spec.architecture?.length) validateBuildingMasses(s);
  validateFloorSupport(s, new Set((spec.knownUnsupportedFloor ?? []).map((c) => `${c.x},${c.y},${c.z}`)));
  assertAuthoredIds(spec, s);
  // La scène compilée passe la porte de TOUT document de scène (unicité des ids à clé comprise).
  const fautes = validateDocument(sceneSchema, s);
  if (fautes) throw new Error(rapportDeFautes(`buildScene « ${spec.id} »`, fautes));

  return s;
}

/**
 * Tous les ids de CATALOGUE authorés par un `MapSpec`, validés à la compilation contre `src/data` —
 * un id faux ne produirait sinon qu'un `console.warn` DEV au rendu (`gameIso/catalog/missing.ts`) et la
 * carte se construirait avec une arête sans matière. La garde porte sur TOUTES les sources d'id du
 * spec, jamais sur la seule table la plus récente : `wallLegend` (y compris un char déclaré mais absent
 * de la grille), les arêtes COMPILÉES (`walled`, `walls[]`, diagonales, herses de `cells`),
 * `cells.wall/gate` et `elevate[].parapet`. Même politique fail-fast que la collision de graines de
 * `zonesFromSeeds` : un plan faux ne se joue pas à moitié.
 */
function assertAuthoredIds(spec: MapSpec, scene: Scene): void {
  const inconnus: { source: string; quoi: string; id: string; catalogue: string }[] = [];
  const appearanceIds = new Set(structureAppearances.map((a) => a.id));
  // Un MÊME id faux est atteint par plusieurs sources (le char de `wallLegend` ET chacune des arêtes
  // qu'il a posées) : une faute = UNE ligne, nommée par la source la PLUS PROCHE de l'auteur — les
  // tables du spec sont parcourues avant les arêtes compilées.
  const vus = new Set<string>();
  const signale = (quoi: string, id: string, catalogue: string, source: string) => {
    const cle = `${quoi} « ${id} »`;
    if (vus.has(cle)) return;
    vus.add(cle);
    inconnus.push({ source, quoi, id, catalogue });
  };
  const structure = (id: string | undefined, source: string) => {
    if (id !== undefined && !findStructureById(id)) signale('structure', id, 'structures.json', source);
  };
  const appearance = (id: string | undefined, source: string) => {
    if (id !== undefined && !appearanceIds.has(id)) signale('apparence', id, 'structureAppearance.json', source);
  };
  for (const [ch, overlay] of Object.entries(spec.wallLegend ?? {})) {
    structure(overlay.structure, `wallLegend['${ch}']`);
    appearance(overlay.appearance, `wallLegend['${ch}']`);
  }
  for (const seg of scene.walls ?? []) {
    const source = `arête (${seg.x},${seg.y},${seg.side}) z${seg.z ?? 0}`;
    structure(seg.structure, source);
    appearance(seg.appearance, source);
  }
  for (const [ch, rec] of Object.entries(spec.cells ?? {})) {
    appearance(rec.wall?.structure, `cells.${ch}.wall.structure`); // crénelure = APPARENCE (cf. `CellRecipe`)
    structure(rec.gate?.structure, `cells.${ch}.gate.structure`);
  }
  for (const [ch, cfg] of Object.entries(spec.elevate ?? {}))
    if (typeof cfg === 'object') appearance(cfg.parapet, `elevate.${ch}.parapet`);
  if (inconnus.length)
    throw new Error(
      `buildScene « ${spec.id} » : id(s) de catalogue inconnu(s) —\n  ` +
        inconnus.map((e) => `${e.source} : ${e.quoi} « ${e.id} » absent(e) de ${e.catalogue}`).join('\n  '),
    );
}
