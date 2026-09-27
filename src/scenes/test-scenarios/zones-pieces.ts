import { makeShowcaseParty } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import type { WallSpec } from '../../state/mapSpec';
import type { TestScenario } from './_shared';
import type { Scene } from '../../state/scene';

/** « Étiquettes de zone » — scénario de quatre pièces intérieures liées à un corps architectural. */
const FOOT = { x: 1, y: 1, w: 8, h: 6 };
const ROOM_IDS = ['cave', 'chambre', 'cuisine', 'salle-commune'];

const INTERIOR_WALLS: WallSpec[] = [
  ...Array.from({ length: 6 }, (_, i) => 1 + i).map((y) => ({ x: 4, y, side: 'E' as const, door: y === 2 })),
  ...Array.from({ length: 8 }, (_, i) => 1 + i).map((x) => ({ x, y: 3, side: 'S' as const, door: x === 2 || x === 6 })),
];

const PERIMETER_WALLS: WallSpec[] = [
  ...Array.from({ length: FOOT.w }, (_, i) => ({ x: FOOT.x + i, y: FOOT.y, side: 'N' as const })),
  ...Array.from({ length: FOOT.w }, (_, i) => ({ x: FOOT.x + i, y: FOOT.y + FOOT.h - 1, side: 'S' as const })),
  ...Array.from({ length: FOOT.h }, (_, i) => ({ x: FOOT.x, y: FOOT.y + i, side: 'O' as const, door: i === 2 })),
  ...Array.from({ length: FOOT.h }, (_, i) => ({ x: FOOT.x + FOOT.w - 1, y: FOOT.y + i, side: 'E' as const })),
].map((wall) => 'door' in wall && wall.door ? wall : { ...wall, structure: 'mur-en-bois' });

const construireScene = (): Scene => buildScene({
  id: 'zones-pieces',
  label: 'Étiquettes de zone',
  desc:
    'Une maisonnette à 4 pièces cloisonnées (Cave, Chambre, Cuisine, Salle commune) sous un même toit. ' +
    "Entrez : le toit se lève en cutaway et le nom de chaque pièce s'affiche, cuit au centre de son aire.",
  size: [10, 9],
  terrain: 'herbe',
  ambiance: 'exterieur',
  heroStart: [0, 3],
  startMessage: 'Une masure aux volets clos. La porte ouest est entrebâillée.',
  terrainRects: [{ rect: [FOOT.x, FOOT.y, FOOT.w, FOOT.h], terrain: 'plancher' }],
  walls: [...PERIMETER_WALLS, ...INTERIOR_WALLS],
  architecture: [{
    id: 'masure',
    label: 'Masure',
    style: 'maison',
    storeys: [{ id: 'masure-z0', z: 0, parts: [], roomZoneIds: ROOM_IDS }],
    facades: [],
    masses: [{
      id: 'toit-masure',
      z: 0,
      footprint: [FOOT],
      levels: 1,
      profile: 'gable',
      pitchDeg: 42,
      material: 'tuile',
      ridge: 'x',
    }],
  }],
  zoneMap: {
    z0: [
      '..........',
      '.AAAABBBB.',
      '.AAAABBBB.',
      '.AAAABBBB.',
      '.CCCCDDDD.',
      '.CCCCDDDD.',
      '.CCCCDDDD.',
      '..........',
      '..........',
    ].join('\n'),
  },
  zoneLegend: {
    A: { id: 'cave', label: 'Cave', presentation: 'interior' },
    B: { id: 'chambre', label: 'Chambre', presentation: 'interior' },
    C: { id: 'cuisine', label: 'Cuisine', presentation: 'interior' },
    D: { id: 'salle-commune', label: 'Salle commune', presentation: 'interior' },
  },
});

export const scenario: TestScenario = {
  id: 'zones-pieces',
  order: 55,
  category: 'rendu',
  icon: 'scenario/village',
  title: 'Étiquettes de zone',
  tests:
    "Étiquette CUITE au centre d'une zone descriptive (#782, `zoneMap`/`zoneLegend`) : 4 pièces cloisonnées " +
    "(murs d'arête + portes) sous un toit unique — révélation en cutaway (toit levé dès qu'un allié entre " +
    "dans l'empreinte), un nom par pièce, jamais au survol.",
  partyNote: 'Groupe vitrine (Soldat / Tueur / Sorcier / Chasseur) — promenade libre, aucun combat.',
  construire: () => ({ party: makeShowcaseParty(), scene: construireScene() }),
};
