/**
 * LA RUE DU TEST (#4471), fixture des ornements du bâti (`ornementsDuBati`) : une chapelle couverte d'un toit à
 * deux pans de faîte est-ouest (cases x 2 à 5, y 1 à 4), dont la façade sud, sur la rue (arêtes nord des cases
 * y = 5), porte une enseigne au mur, dont le pignon ouest porte un épi à son sommet, et dont l'intérieur abrite une
 * cheminée adossée au mur nord ; une taverne (cases x 8 à 10, y 1 à 3) à porte au sud, en (9, 4) ; un foyer de forge
 * dehors, au bord de la rue.
 */
import type { RectDeCases } from '../../../data/schemas/grammaire/valeurs';
import {
  emptyScene, type BuildingMass, type FacadeFeature, type Scene, type SceneEntity, type WallSeg,
} from '../scene';
import { nappeKey } from './toits';

/** L'apparence de la façade de la chapelle. */
export const FACADE = 'auberge-relais-imperiale';
/** La nappe du toit de la chapelle. */
export const NAPPE_DE_LA_CHAPELLE = nappeKey('chapelle', 'corps');
const MURS_DE_LA_RUE: WallSeg[] = [2, 3, 4, 5].map((x) => ({ x, y: 5, side: 'N', ...(x === 2 ? { door: true } : {}) }));
/** L'enseigne, posée au mur, de la façade de la chapelle. */
export const FEATURES: FacadeFeature[] = [
  { id: 'enseigne', kind: 'sign', edge: { x: 3, y: 5, side: 'N' }, offset: 0.5 },
];
/** L'épi du pignon ouest de la chapelle, au bout de l'arête qui touche le faîte (y = 2,5). */
export const EPI: FacadeFeature = { id: 'epi', kind: 'faitage', edge: { x: 1, y: 2, side: 'E' }, offset: 1 };
/** La cheminée de la chapelle, adossée au mur nord de sa case, sous la couverture. */
export const FOYER_DE_LA_CHAPELLE: SceneEntity = {
  id: 'foyer-de-la-chapelle', kind: 'prop', pos: { x: 4, y: 2 }, facing: 'S', decor: { id: 'cheminee-interieure' },
};
/** Le foyer de forge posé dehors, sous aucun toit. */
export const FOYER_DEHORS: SceneEntity = {
  id: 'foyer-dehors', kind: 'prop', pos: { x: 12, y: 7 }, facing: 'S', decor: { id: 'foyer-de-forge' },
};

const masse = (foot: RectDeCases): BuildingMass => ({
  id: 'corps', z: 0, footprint: [foot], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 30,
  material: { id: 'tuile' },
});

/** La rue du test, neuve à chaque appel. */
export function laRue(): Scene {
  const s = emptyScene('la-rue-du-test', 14, 10);
  s.walls = [...MURS_DE_LA_RUE, { x: 9, y: 4, side: 'N', door: true }, { ...EPI.edge }];
  s.entities = [{ ...FOYER_DE_LA_CHAPELLE }, { ...FOYER_DEHORS }];
  const edges = MURS_DE_LA_RUE.map(({ x, y, side }) => ({ x, y, side }));
  s.architecture = [
    {
      id: 'chapelle', style: { id: 'chapelle' }, storeys: [], masses: [masse({ x: 2, y: 1, w: 4, h: 4 })],
      facades: [
        { id: 'rue', z: 0, edges, appearance: FACADE, features: FEATURES },
        { id: 'pignon-ouest', z: 0, edges: [{ ...EPI.edge }], appearance: FACADE, features: [EPI] },
      ],
    },
    { id: 'taverne', style: { id: 'taverne' }, storeys: [], facades: [], masses: [masse({ x: 8, y: 1, w: 3, h: 3 })] },
  ];
  return s;
}
