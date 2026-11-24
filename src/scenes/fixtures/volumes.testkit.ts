/**
 * Scènes CONSTRUITES pour les suites du volume, des toits, du couvert, de l'index d'arêtes, de la vision et des gestes
 * à l'étage (#4936). Aucune ne vient d'un paquet de campagne.
 */
import { buildScene, type WallSpec } from '../../noyau/mapSpec';
import { emptyScene, type Scene } from '../../noyau/monde/scene';
import { perimeterWallSegs } from '../../noyau/sceneEdit.testkit';

type Rect = { x: number; y: number; w: number; h: number };

/**
 * LE RELAIS_COUVERT À ÉTAGE — un corps bâti `relais` sans masse authorée : toute sa toiture se dérive du plan.
 *  - REZ : deux ailes murées (`ouest`, `est`) qui s'ouvrent par une porte sur un PASSAGE couvert pavé, ouvert au nord
 *    et au sud, et un APPENTIS bas, détaché, à un niveau ; dans l'aile ouest, une volée d'ESCALIER monte à l'étage.
 *  - ÉTAGE (plancher à 4 m) : les deux ailes et le passage, d'un seul tenant, la trémie de l'escalier ouverte ; les
 *    ailes sont murées et percées de croisées, le passage s'ouvre au nord et au sud sur le vide.
 * Ce qu'il exerce : des masses dérivées aux DEUX niveaux (rez de l'appentis et de la cage d'escalier, étage du reste), trois masses d'étage
 * 4-adjacentes de même égout et de portées impaires (un groupe de nappe au demi-pas, dont une à deux rampants sur
 * le passage), des portes, des pièces nommées aux deux niveaux, et des dénivelés au bord du plancher de l'étage (bouts
 * du passage, trémie) que le groupe rejoint depuis tout le relais.
 */
export const RELAIS_COUVERT = {
  corps: 'relais',
  ouest: { x: 1, y: 2, w: 7, h: 13 },
  passage: { x: 8, y: 2, w: 3, h: 13 },
  est: { x: 11, y: 2, w: 9, h: 13 },
  appentis: { x: 22, y: 6, w: 4, h: 5 },
  /** La volée d'escalier du rez, d'ouest en est, et la trémie qui l'ouvre à l'étage. */
  escalier: { x: 2, y: 14, w: 4, h: 1 },
  tremie: { x: 1, y: 13, w: 5, h: 2 },
  /** Une case du plancher de l'étage, dans l'aile ouest. */
  caseALEtage: { x: 4, y: 8, z: 1 },
  /** Une arête de façade du rez de l'aile est, sous la toiture de l'étage. */
  facadeEst: { x: 19, y: 5, side: 'E' as const, z: 0 },
} as const;

const W = 28;
const H = 17;

const dans = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** Une grille d'étage : `char` sur les cases des `rects`, `.` ailleurs. */
const grille = (paves: readonly (readonly [Rect, string])[]): string =>
  Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => paves.find(([r]) => dans(r, x, y))?.[1] ?? '.').join('')).join('\n');

/** Les arêtes d'un pourtour, celles de `percees` (`"x,y,side"`) remplacées par leur ouverture. */
const pourtour = (rects: readonly Rect[], z: number, percees: Readonly<Record<string, Omit<WallSpec, 'x' | 'y' | 'side' | 'z'>>>): WallSpec[] =>
  perimeterWallSegs(rects, z).map((w) => ({ ...w, z, ...percees[`${w.x},${w.y},${w.side}`] }));

const CROISEE = { window: true } as const;

/** Les croisées de l'étage : une travée sur deux des longs pans nord et sud de chaque aile. */
const croisees = (r: Rect): Record<string, typeof CROISEE> => {
  const out: Record<string, typeof CROISEE> = {};
  for (let x = r.x + 1; x < r.x + r.w - 1; x += 2) {
    out[`${x},${r.y},N`] = CROISEE;
    out[`${x},${r.y + r.h},N`] = CROISEE;
  }
  return out;
};

export function relaisCouvert(): Scene {
  const { ouest, passage, est, appentis, escalier, tremie } = RELAIS_COUVERT;
  return buildScene({
    id: 'test-relais-a-etage',
    label: 'Relais à étage',
    size: [W, H],
    terrain: 'herbe',
    ambiance: 'exterieur',
    legend: { D: 'dalle', C: 'pave', P: 'plancher' },
    levels: {
      z0: grille([[escalier, 'E'], [ouest, 'D'], [passage, 'C'], [est, 'D'], [appentis, 'D']]),
      z1: grille([[tremie, '.'], [ouest, 'P'], [passage, 'P'], [est, 'P']]),
    },
    elevate: { P: 4 },
    cells: { E: { terrain: 'dalle', stair: { to: 'z1' } } },
    walls: [
      ...pourtour([ouest], 0, { [`${ouest.x + ouest.w - 1},${ouest.y + 6},E`]: { door: true } }),
      ...pourtour([est], 0, { [`${est.x - 1},${est.y + 6},E`]: { door: true } }),
      ...pourtour([appentis], 0, { [`${appentis.x + 1},${appentis.y + appentis.h},N`]: { door: true } }),
      ...pourtour([ouest], 1, croisees(ouest)).filter((w) => !(w.side === 'E' && w.x === ouest.x + ouest.w - 1)),
      ...pourtour([est], 1, croisees(est)).filter((w) => !(w.side === 'E' && w.x === est.x - 1)),
    ],
    architecture: [{ id: RELAIS_COUVERT.corps, label: 'Relais', style: { id: 'maison' }, storeys: [], facades: [], masses: [] }],
    zoneMap: {
      z0: grille([[ouest, 'S'], [est, 'E'], [appentis, 'A']]),
      z1: grille([[ouest, 'O'], [passage, 'G'], [est, 'R']]),
    },
    zoneLegend: {
      S: { id: 'salle', label: 'Salle', presentation: 'interior' },
      E: { id: 'ecurie', label: 'Écurie', presentation: 'interior' },
      A: { id: 'appentis', label: 'Appentis', presentation: 'interior' },
      O: { id: 'chambre-ouest', label: 'Chambre ouest', presentation: 'interior' },
      G: { id: 'galerie', label: 'Galerie', presentation: 'interior' },
      R: { id: 'chambre-est', label: 'Chambre est', presentation: 'interior' },
    },
    heroStart: { x: 4, y: 16 },
  });
}

/** Une scène à l'échelle MER (`MDG 13 l.362`). */
export function sceneMer(): Scene {
  return { ...emptyScene('test-mer', 1, 1), metresPerTile: 10 };
}
