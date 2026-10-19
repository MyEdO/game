/**
 * VITRINE — bâtiments (ornements par type) : la spec de carte qui montre, côte à côte, les cinq styles
 * d'`ArchitectureBody` avec leur ornement d'identité (enseigne de taverne, cheminée de forge, clocheton
 * de chapelle, étal d'échoppe). Aucune LOGIQUE de jeu : c'est une scène de VITRINE de rendu.
 *
 * Elle vit sous `src/scenes/` (et non dans `scripts/qc/`) parce qu'elle a DEUX consommateurs de camps
 * opposés : les bancs de rendu (Node) et l'app (Vite, navigateur) — une spec importée par l'app ne peut
 * pas vivre dans `scripts/`. Elle reste HORS de `test-scenarios/` : ce n'est pas un scénario jouable
 * (pas de groupe, pas de registre `_registry.generated.ts`, aucune entrée au menu des scénarios).
 */
import { buildScene, type MapSpec } from '../state/mapSpec';
import { doorKey, structureDownKey, type Scene } from '../noyau/monde/scene';

function vitrinePerimeterWalls(
  foot: { x: number; y: number; w: number; h: number },
  door: { x: number; y: number; side: 'N' | 'E' | 'S' | 'O' },
) {
  const runs = [
    Array.from({ length: foot.w }, (_, i) => ({ x: foot.x + i, y: foot.y, side: 'N' as const })),
    Array.from({ length: foot.w }, (_, i) => ({ x: foot.x + i, y: foot.y + foot.h - 1, side: 'S' as const })),
    Array.from({ length: foot.h }, (_, i) => ({ x: foot.x, y: foot.y + i, side: 'O' as const })),
    Array.from({ length: foot.h }, (_, i) => ({ x: foot.x + foot.w - 1, y: foot.y + i, side: 'E' as const })),
  ];
  return runs.flatMap((run) => run.map((wall, i) => {
    if (wall.x === door.x && wall.y === door.y && wall.side === door.side) return { ...wall, door: true };
    return {
      ...wall,
      structure: 'mur-en-bois',
      ...(i > 0 && i < run.length - 1 && i % 3 === 1 ? { window: true } : {}),
    };
  }));
}

function vitrineBody(
  id: string,
  label: string,
  style: string,
  foot: { x: number; y: number; w: number; h: number },
  material: string,
) {
  const roomId = `piece-${id}`;
  return {
    id,
    label,
    style,
    storeys: [{ id: `${id}-z0`, z: 0, parts: [{ id: `${id}-volume`, foot }], roomZoneIds: [roomId] }],
    facades: [],
    masses: [{ id: `toit-${id}`, z: 0, footprint: [{ ...foot }], levels: 1, profile: 'gable' as const, ridge: 'x' as const, pitchDeg: 42, material }],
  };
}

const VITRINE_BODIES = [
  { id: 'vit-taverne', label: 'Taverne', style: 'taverne', foot: { x: 3, y: 3, w: 15, h: 10 }, material: 'tuile', door: { x: 10, y: 12, side: 'S' as const } },
  { id: 'vit-maison', label: 'Maison', style: 'maison', foot: { x: 21, y: 4, w: 7, h: 7 }, material: 'tuile', door: { x: 24, y: 10, side: 'S' as const } },
  { id: 'vit-forge', label: 'Forge', style: 'forge', foot: { x: 5, y: 16, w: 10, h: 5 }, material: 'toit-ardoise', door: { x: 9, y: 16, side: 'N' as const } },
  { id: 'vit-chapelle', label: 'Chapelle', style: 'chapelle', foot: { x: 20, y: 14, w: 4, h: 5 }, material: 'toit-ardoise', door: { x: 21, y: 18, side: 'S' as const } },
  { id: 'vit-echoppe', label: 'Échoppe', style: 'echoppe', foot: { x: 25, y: 16, w: 3, h: 3 }, material: 'chaume', door: { x: 26, y: 18, side: 'S' as const } },
];

/** RUINE de vitrine — la rangée d'arêtes qui porte les parties de BRÈCHE qu'aucune scène-témoin du
 *  aucune scène-témoin ne montrait (mesuré : `gravats`, `gravats-tas` et `seuil` à 0 face sur les six scènes) : une
 *  courtine ABATTUE (tas de gravats dentelé + moignons de poteau) et un corps de garde ABATTU (seuil
 *  d'éboulis sous son linteau). S'y ajoutent, en comparaison à vue, le même corps de garde INTACT
 *  (herse — déjà présente au siège) et une porte de bois FERMÉE (vantail + joints de planches +
 *  poignée — parties déjà émises par les deux portes closes des bâtiments de la vitrine, dont elle
 *  n'est qu'une troisième occurrence, isolée du bâti). */
const VITRINE_RUINE = {
  y: 22,
  /** Courtine de pierre abattue (une arête par case). */
  courtine: [4, 5, 6, 7],
  /** Corps de garde abattu / intact. */
  porterieAbattue: 9,
  porterieIntacte: 11,
  /** Porte de bois maintenue FERMÉE (flag `__door_…` = false, comme les portes closes des bâtiments). */
  porteFermee: 13,
} as const;

const ruineWalls = [
  ...VITRINE_RUINE.courtine.map((x) => ({ x, y: VITRINE_RUINE.y, side: 'N' as const, structure: 'mur-en-pierre' })),
  { x: VITRINE_RUINE.porterieAbattue, y: VITRINE_RUINE.y, side: 'N' as const, structure: 'porte-de-ville' },
  { x: VITRINE_RUINE.porterieIntacte, y: VITRINE_RUINE.y, side: 'N' as const, structure: 'porte-de-ville' },
  { x: VITRINE_RUINE.porteFermee, y: VITRINE_RUINE.y, side: 'N' as const, structure: 'mur-en-bois', door: true },
];

const ruineFlags = Object.fromEntries([
  ...[...VITRINE_RUINE.courtine, VITRINE_RUINE.porterieAbattue].map((x) => [structureDownKey(x, VITRINE_RUINE.y, 'N'), true]),
  [doorKey(VITRINE_RUINE.porteFermee, VITRINE_RUINE.y, 'N'), false],
]);

/** Spec de la vitrine — SOURCE UNIQUE (consommée par la planche QC headless ET par les gardes de rendu). */
export const vitrineSpec: MapSpec = {
  size: [30, 24],
  id: 'vitrine-batiments',
  label: 'Vitrine — bâtiments (ornements par type)',
  ambiance: 'exterieur',
  terrain: 'herbe',
  heroStart: { x: 24, y: 22 },
  // Portes CLOSES de la taverne et de la maison — l'arête est celle du côté N de la case du dessous
  // (une porte authorée 'S' en (x,y) vit sur l'arête N de (x, y+1)).
  flags: { [doorKey(10, 13, 'N')]: false, [doorKey(24, 11, 'N')]: false, ...ruineFlags },
  architecture: VITRINE_BODIES.map(({ id, label, style, foot, material }) => vitrineBody(id, label, style, foot, material)),
  walls: [...VITRINE_BODIES.flatMap(({ foot, door }) => vitrinePerimeterWalls(foot, door)), ...ruineWalls],
  terrainRects: VITRINE_BODIES.map(({ foot }) => ({ rect: [foot.x, foot.y, foot.w, foot.h] as [number, number, number, number], terrain: 'plancher' })),
  effectZones: VITRINE_BODIES.map(({ id, label, foot }) => ({
    id: `piece-${id}`,
    label,
    presentation: 'interior' as const,
    area: { kind: 'rect' as const, ...foot },
    z: 0,
  })),
  entities: [
    { id: 'orn-vit-taverne-enseigne', kind: 'prop', pos: { x: 10, y: 13 }, facing: 'S', ref: 'enseigne' },
    { id: 'orn-vit-forge-cheminee', kind: 'prop', pos: { x: 10, y: 18 }, ref: 'cheminee' },
    { id: 'orn-vit-chapelle-clocheton', kind: 'prop', pos: { x: 22, y: 16 }, ref: 'clocheton' },
    { id: 'orn-vit-echoppe-etal', kind: 'prop', pos: { x: 26, y: 19 }, facing: 'S', ref: 'etal-marche' },
  ],
};

/** Scène construite depuis `vitrineSpec`. */
export function buildVitrineScene(): Scene {
  return buildScene(vitrineSpec);
}
