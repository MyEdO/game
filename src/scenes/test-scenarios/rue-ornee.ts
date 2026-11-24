import { herosDeScenario } from './_heros';
import { buildScene, type WallSpec } from '../../noyau/mapSpec';
import type { TestScenario } from './_shared';
import type { Scene } from '../../noyau/monde/scene';

/** La chapelle (cases x 2..5, y 1..4), sa façade sud sur la rue, porte en (2,5). */
const CHAPELLE = { x: 2, y: 1, w: 4, h: 4 };
const FACADE_SUD = [2, 3, 4, 5].map((x) => ({ x, y: 5, side: 'N' as const }));
const MURS_DE_LA_CHAPELLE: WallSpec[] = [
  ...FACADE_SUD.map((a): WallSpec => (a.x === CHAPELLE.x ? { ...a, door: true } : a)),
  ...[2, 3, 4, 5].map((x): WallSpec => ({ x, y: CHAPELLE.y, side: 'N' })),
  ...[1, 2, 3, 4].flatMap((y): WallSpec[] => [{ x: CHAPELLE.x - 1, y, side: 'E' }, { x: CHAPELLE.x + CHAPELLE.w - 1, y, side: 'E' }]),
];
/** La grange close (cases x 2..7, y 8..10), au sud de la rue, en mur à ossature. */
const GRANGE = { x: 2, y: 8, w: 6, h: 3 };
const OSSATURE = 'mur-a-ossature-en-bois';
const MURS_DE_LA_GRANGE: WallSpec[] = [
  ...Array.from({ length: GRANGE.w }, (_, i) => GRANGE.x + i).flatMap((x): WallSpec[] => [
    { x, y: GRANGE.y, side: 'N', structure: OSSATURE },
    { x, y: GRANGE.y + GRANGE.h, side: 'N', structure: OSSATURE },
  ]),
  ...Array.from({ length: GRANGE.h }, (_, i) => GRANGE.y + i).flatMap((y): WallSpec[] => [
    { x: GRANGE.x - 1, y, side: 'E', structure: OSSATURE },
    { x: GRANGE.x + GRANGE.w - 1, y, side: 'E', structure: OSSATURE },
  ]),
];

const construireScene = (): Scene => buildScene({
  id: 'rue-ornee',
  label: 'Rue ornée',
  desc: 'Une rue entre une chapelle à enseigne, couverte d’un toit d’où sort la souche de sa cheminée, et une grange close.',
  size: [16, 12],
  terrain: 'herbe',
  ambiance: 'exterieur',
  heroStart: [8, 6],
  terrainRects: [{ rect: [0, 5, 16, 3], terrain: 'pave' }, { rect: [CHAPELLE.x, CHAPELLE.y, CHAPELLE.w, CHAPELLE.h], terrain: 'plancher' }],
  walls: [...MURS_DE_LA_CHAPELLE, ...MURS_DE_LA_GRANGE],
  entities: [{ id: 'cheminee-de-la-chapelle', kind: 'prop', pos: { x: 4, y: 2 }, facing: 'S', decor: { id: 'cheminee-interieure' } }],
  architecture: [{
    id: 'chapelle',
    label: 'Chapelle',
    style: { id: 'chapelle' },
    storeys: [],
    facades: [{
      id: 'rue', z: 0, edges: FACADE_SUD, appearance: 'auberge-relais-imperiale',
      features: [{ id: 'enseigne', kind: 'sign', edge: { x: 3, y: 5, side: 'N' }, offset: 0.5 }],
    }],
    masses: [],
  }],
  zoneMap: { z0: Array.from({ length: 12 }, (_, y) => Array.from({ length: 16 }, (_, x) => (x >= CHAPELLE.x && x < CHAPELLE.x + CHAPELLE.w && y >= CHAPELLE.y && y < CHAPELLE.y + CHAPELLE.h ? 'C' : '.')).join('')).join('\n') },
  zoneLegend: { C: { id: 'nef', label: 'Nef', presentation: 'interior' } },
  encounters: [{ id: 'enc-rue', enemies: [{ creature: { id: 'gobelin' }, pos: { x: 13, y: 6 }, facing: 'O' }] }],
});

export const scenario: TestScenario = {
  id: 'rue-ornee',
  order: 56,
  category: 'rendu',
  icon: 'scenario/village',
  title: 'Rue ornée',
  tests:
    'Ornements du bâti (#4471) : l’enseigne de la façade de la chapelle et la souche de sa cheminée, portée par la ' +
    'nappe de son toit ; vision du groupe (#3950) : les murs à ossature de la grange close, vus par leur face nord, ' +
    'ancrés dans la grange que le groupe ne voit pas.',
  partyNote: 'Soldat seul, dans la rue, face à un gobelin.',
  construire: (idNeuf) => ({ party: [herosDeScenario(idNeuf, 'soldat')], scene: construireScene() }),
  autoCombat: 'enc-rue',
};
