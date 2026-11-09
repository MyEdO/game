/**
 * Les ponts de la caraque en `MapSpec` que `buildScene` compile (#3686), lus dans `ponts` de sa fiche
 * (`pontsDeLaFiche`). Un étage par pont : `z0` cale, `z1` pont principal (la batterie), `z2` pont supérieur (l'embelle,
 * le dessous du gaillard d'avant et le château de poupe), `z3` gaillard d'avant, passerelle et plage arrière.
 * Ce qui s'écrit ici, aux cases de la source : les pièces de la légende des plans (MDG 12 l.286, planche
 * « Caraque », plans de ses ponts), leur mobilier (`MOBILIER`), valeur d'adaptation (#3686), hamacs (MDG 09 l.87)
 * et cabestan (MDG 12 l.213) compris, et ce que les Améliorations y ajoutent.
 */
import type { MapSpec, WallSpec } from './mapSpec';
import type { SceneEntity } from './monde/scene';
import type { Dir4 } from '../geometry/dir8';
import type { ApportAuxPonts } from './planDeNavire';
import type { Calage } from '../data/props.types';
import { MOTS_DES_PONTS } from '../data/schemas/grammaire/carte-ascii';
import { garanti } from '../lib/garanti';
import { pontsDeLaFiche } from './pontsDeLaFiche';

const { hauteurs: HAUTEURS, grille: GRILLE, aretesDe, plan: PONTS_DE_LA_CARAQUE } = pontsDeLaFiche('caraque');

/** Les pièces de la légende des plans, par pont (`.` : aucune). */
const PIECES: NonNullable<MapSpec['zoneMap']> = {
  z0: [
    '..................',
    '....CCCCCCCCII....',
    '....CCCCCCCCCCCJ..',
    '....CCCCCCCCCR....',
    '..................',
  ],
  z1: [
    '.....PPPPPPP......',
    '...PPPPPPPPPPMMMG.',
    '..VP.PPPPPP.PPPPK.',
    '...PPPPPPPPPPNNAK.',
    '.....PPPPPPP......',
  ],
  z2: [
    '.....SSSSSSE......',
    '..OQS.SSSSSEFFXXBB',
    '..OQSSSTTSSHHHHHBB',
    '..OQS.SSSS.HHHYYBB',
    '.....SSSSSSH......',
  ],
  z3: [
    '...........U......',
    'WWWW.......UUUUUUU',
    'WWWWZZZZZZZUUUUUUU',
    'WWW........UU.UUUU',
    '...........U......',
  ],
};

const LEGENDE_DES_PIECES: NonNullable<MapSpec['zoneLegend']> = {
  C: { id: 'cale', label: 'Cale', presentation: 'interior' },
  I: { id: 'infirmerie', label: 'Infirmerie', presentation: 'interior' },
  R: { id: 'reserves-du-charpentier', label: 'Réserves du charpentier', presentation: 'interior' },
  J: { id: 'cachot', label: 'Cachot', presentation: 'interior' },
  V: { id: 'reserve-de-voiles-et-de-cordes', label: 'Réserve de voiles et de cordes', presentation: 'interior' },
  P: { id: 'pont-principal-des-canons', label: "Pont principal des canons/Poste d'équipage", presentation: 'interior' },
  M: { id: 'reserve-de-munitions', label: 'Réserve de munitions', presentation: 'interior' },
  N: { id: 'reserve-de-poudre-noire', label: 'Réserve de Poudre noire', presentation: 'interior' },
  A: { id: 'armurerie', label: 'Armurerie', presentation: 'interior' },
  K: { id: 'cuisine', label: 'Cuisine', presentation: 'interior' },
  G: { id: 'garde-manger', label: 'Garde-manger', presentation: 'interior' },
  O: { id: 'proue', label: 'Proue', presentation: 'interior' },
  Q: { id: 'quartiers-de-l-equipage', label: "Quartiers de l'équipage", presentation: 'interior' },
  S: { id: 'pont-superieur-des-canons', label: 'Pont supérieur des canons', presentation: 'exterior' },
  T: { id: 'trappe-de-fret', label: 'Trappe de fret', presentation: 'exterior' },
  E: { id: 'salle-d-apparat', label: "Salle d'apparat", presentation: 'interior' },
  F: { id: 'quartiers-des-officiers', label: 'Quartiers des officiers', presentation: 'interior' },
  H: { id: 'mess-des-officiers', label: 'Mess des officiers', presentation: 'interior' },
  X: { id: 'quartiers-du-capitaine', label: 'Quartiers du capitaine', presentation: 'interior' },
  Y: { id: 'quartiers-du-timonier', label: 'Quartiers du timonier', presentation: 'interior' },
  B: { id: 'barre', label: 'Barre', presentation: 'interior' },
  W: { id: 'gaillard-d-avant', label: "Gaillard d'avant", presentation: 'exterior' },
  Z: { id: 'passerelle', label: 'Passerelle', presentation: 'exterior' },
  U: { id: 'plage-arriere', label: 'Plage arrière', presentation: 'exterior' },
};

/** Le mobilier de chaque pièce intérieure, par lettre de la légende : le décor (`ref` de `props.json`), la case
 *  du coin nord-ouest de son emprise, son cap, son calage dans le jeu libre de sa case (`SceneEntity.calage`, centré
 *  sans lui) et, posé sur un autre meuble de sa pièce, le `ref` et le rang de celui-ci (`SceneEntity.sur`). Une case
 *  de porte, de trappe ou de pied d'échelle reste libre, et une pièce dont la seule case est celle de sa porte reste
 *  vide. Le calage plaque un meuble à une cloison du plan ; près du bordé et de la muraille, chaque meuble se tient dans
 *  l'emprise libre que le modèle laisse à ses cases (`cases` du manifeste de `vehicule--caraque`, #3767). */
const MOBILIER: Readonly<Record<string, readonly (readonly [ref: string, x: number, y: number, facing: Dir4, calage?: Calage, sur?: string])[]>> = {
  C: [
    ['tonneaux-pile', 4, 1, 'S', { x: 0, y: 1 }], ['caisse', 5, 1, 'S'], ['tonneau', 7, 1, 'S'], ['caisse', 8, 1, 'S'], ['tonneau', 9, 1, 'S'],
    ['caisse', 4, 3, 'S', { x: 0, y: -1 }], ['tonneaux-pile', 5, 3, 'S'], ['caisse', 7, 3, 'S'], ['tonneaux-pile', 9, 3, 'S'],
    ['caisse', 8, 1, 'E', undefined, 'caisse-2'],
  ],
  I: [['etagere', 12, 1, 'S', { x: 0, y: -0.25 }], ['coffre', 12, 1, 'E', { x: -1, y: 1 }]],
  P: [
    ['cabestan', 7, 2, 'S'],
    ['hamac', 5, 0, 'S', { x: 1, y: 1 }], ['hamac', 6, 0, 'S', { x: 0, y: 1 }], ['hamac', 7, 0, 'S', { x: 0, y: 1 }],
    ['hamac', 5, 4, 'S', { x: 1, y: -1 }], ['hamac', 6, 4, 'S', { x: 0, y: -1 }], ['hamac', 7, 4, 'S', { x: 0, y: -1 }],
  ],
  M: [
    ['caisse', 13, 1, 'S', { x: -1, y: -1 }], ['caisse', 13, 1, 'S', { x: -1, y: 1 }], ['tonneau', 13, 1, 'S', { x: 1, y: -1 }],
    ['tonneau', 15, 1, 'S', { x: -1, y: 1 }], ['tonneau', 15, 1, 'S', { x: 1, y: 1 }],
  ],
  N: [['tonneau', 14, 3, 'S', { x: -1, y: 1 }], ['tonneau', 14, 3, 'S', { x: 1, y: 1 }], ['tonneau', 14, 3, 'S', { x: 1, y: -1 }]],
  K: [['brasero', 16, 3, 'S', { x: 0.5, y: -1 }], ['marmite', 16, 3, 'S', { x: -1, y: -1 }]],
  O: [['rouleau-de-cordage', 2, 1, 'S', { x: 0, y: 0.5 }], ['rouleau-de-cordage', 2, 3, 'S', { x: 0, y: -0.5 }]],
  Q: [['hamac', 3, 1, 'S', { x: 0, y: -1 }], ['hamac', 3, 1, 'S', { x: 0, y: 1 }]],
  E: [
    ['table', 11, 0, 'S', { x: 0.75, y: 1 }], ['chaise', 11, 0, 'E', { x: -0.75, y: 0 }],
    ['chandelier', 11, 0, 'S', { x: 0.75, y: -0.15 }], ['lettre', 11, 0, 'S', { x: 0.5, y: 0.6 }, 'table-1'],
  ],
  F: [['hamac', 13, 1, 'S', { x: 0, y: -1 }], ['coffre', 13, 1, 'N', { x: 0, y: 1 }]],
  H: [
    ['table', 11, 3, 'S', { x: -0.5, y: 0 }], ['banc', 11, 3, 'S', { x: -0.5, y: -1 }], ['banc', 11, 3, 'S', { x: -0.5, y: 1 }],
    ['bourse', 11, 3, 'S', { x: -0.3, y: 0.3 }, 'table-1'],
    ['tonneau', 11, 4, 'S', { x: -0.75, y: -0.25 }], ['chandelier', 11, 4, 'S', { x: 0.75, y: -0.25 }],
  ],
  X: [
    ['bureau', 15, 1, 'S', { x: 0, y: -1 }], ['coffre', 15, 1, 'N', { x: 1, y: 1 }],
    ['lettre', 15, 1, 'S', { x: -0.4, y: -0.75 }, 'bureau-1'], ['cle', 15, 1, 'S', { x: 0.4, y: -0.75 }, 'bureau-1'],
  ],
  Y: [['hamac', 15, 3, 'S', { x: 0, y: 1 }], ['coffre', 15, 3, 'S', { x: 1, y: -1 }]],
  B: [['barre-de-navire', 17, 2, 'E', { x: -0.5, y: 0 }]],
};

/** Les décors de `MOBILIER`, chacun sur le pont de sa pièce, sous l'id de sa pièce suivi de son `ref` et de son rang. */
const MEUBLES: SceneEntity[] = Object.entries(MOBILIER).flatMap(([lettre, meubles]) => {
  const piece = garanti(LEGENDE_DES_PIECES[lettre], lettre, 'pièce meublée').id;
  const etage = garanti(Object.keys(PIECES).find((e) => [PIECES[e]].flat().join('').includes(lettre)), lettre, 'pont de la pièce');
  return meubles.map(([ref, x, y, facing, calage, sur], i): SceneEntity => ({
    id: `${piece}-${ref}-${meubles.slice(0, i + 1).filter(([r]) => r === ref).length}`,
    kind: 'prop',
    ref,
    pos: { x, y },
    z: Number(etage.slice(1)),
    facing,
    ...(calage ? { calage } : {}),
    ...(sur ? { sur: `${piece}-${sur}` } : {}),
  }));
});

/** La caraque en `MapSpec`. */
export const PLAN_DE_LA_CARAQUE: MapSpec = {
  ...PONTS_DE_LA_CARAQUE,
  zoneMap: PIECES,
  zoneLegend: LEGENDE_DES_PIECES,
  entities: MEUBLES,
};

/** Le glyphe de la case du grand mât dans la source, et celui de la hauteur du plancher de sa hune. */
const MAT = 'm';
const HUNE = 'n';
const CASE_DU_MAT = garanti(GRILLE.cases.find((c) => c.glyphe === MAT), MAT, 'case du grand mât');

/**
 * Ce que chaque Amélioration ajoute aux ponts de la caraque, aux cases de la source :
 * - Nid-de-pie (MDG 12 l.297) : la case du grand mât monte au plancher de sa hune, au bout de l'échelle de ses
 *   haubans depuis l'embelle à tribord, bordée de son garde-corps ;
 * - Embarcation de bord (MDG 12 l.266) : le canot de 5 m sur l'embelle, sur la trappe de fret ;
 * - Sabord (MDG 12 l.364) : les sabords de la source, fermés.
 */
export const AMELIORATIONS_DE_LA_CARAQUE: Readonly<Record<string, ApportAuxPonts>> = {
  'nid-de-pie': {
    elevate: { [MAT]: garanti(HAUTEURS[HUNE], HUNE, 'hauteur de la hune') },
    walls: [
      { x: CASE_DU_MAT.x, y: CASE_DU_MAT.y, side: 'N', z: CASE_DU_MAT.z, climb: { kind: 'ladder' } },
      ...(['S', 'O', 'E'] as const).map((side): WallSpec => ({ x: CASE_DU_MAT.x, y: CASE_DU_MAT.y, side, z: CASE_DU_MAT.z, window: true })),
    ],
  },
  'embarcation-de-bord': {
    entities: [{ id: 'embarcation-de-bord', kind: 'prop', ref: 'barque', pos: { x: 7, y: 2 }, z: 2, facing: 'S' }],
  },
  sabord: {
    walls: aretesDe(MOTS_DES_PONTS.sabord).map((e): WallSpec => ({ ...e, window: true, shuttered: true })),
  },
};
