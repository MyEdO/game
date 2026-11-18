/**
 * LA RUE DU TEST (#4471), fixture des ornements du bâti (`ornementsDuBati`) : une chapelle couverte d'un toit à
 * deux pans (cases x 2 à 5, y 1 à 4), dont la façade sud, sur la rue (arêtes nord des cases y = 5), porte une
 * cheminée sur la couverture et une enseigne au mur, et une taverne (cases x 8 à 10, y 1 à 3) à porte au sud, en
 * (9, 4).
 */
import {
  emptyScene, type ArchitectureRect, type BuildingMass, type FacadeFeature, type Scene, type WallSeg,
} from '../scene';
import { nappeKey } from './toits';

/** L'apparence de la façade de la chapelle. */
export const FACADE = 'auberge-relais-imperiale';
/** La nappe du toit de la chapelle. */
export const NAPPE_DE_LA_CHAPELLE = nappeKey('chapelle', 'corps');
const MURS_DE_LA_RUE: WallSeg[] = [2, 3, 4, 5].map((x) => ({ x, y: 5, side: 'N', ...(x === 2 ? { door: true } : {}) }));
/** La cheminée, posée sur la couverture, puis l'enseigne, posée au mur, de la façade de la chapelle. */
export const FEATURES: FacadeFeature[] = [
  { id: 'cheminee', kind: 'chimney', edge: { x: 4, y: 5, side: 'N' }, offset: 0.25 },
  { id: 'enseigne', kind: 'sign', edge: { x: 3, y: 5, side: 'N' }, offset: 0.5 },
];

const masse = (foot: ArchitectureRect): BuildingMass => ({
  id: 'corps', z: 0, footprint: [foot], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 30,
  material: { id: 'tuile' },
});

/** La rue du test, neuve à chaque appel. */
export function laRue(): Scene {
  const s = emptyScene('la-rue-du-test', 14, 10);
  s.walls = [...MURS_DE_LA_RUE, { x: 9, y: 4, side: 'N', door: true }];
  const edges = MURS_DE_LA_RUE.map(({ x, y, side }) => ({ x, y, side }));
  s.architecture = [
    {
      id: 'chapelle', style: { id: 'chapelle' }, storeys: [], masses: [masse({ x: 2, y: 1, w: 4, h: 4 })],
      facades: [{ id: 'rue', z: 0, edges, appearance: FACADE, features: FEATURES }],
    },
    { id: 'taverne', style: { id: 'taverne' }, storeys: [], facades: [], masses: [masse({ x: 8, y: 1, w: 3, h: 3 })] },
  ];
  return s;
}
