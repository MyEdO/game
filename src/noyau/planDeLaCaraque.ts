/**
 * Les ponts de la caraque, relevés sur ses plans (MDG 12 l.286, planche « Caraque », plans de ses ponts), en `MapSpec` que
 * `buildScene` compile (#3686) : une case de 2 m, 18 × 5 cases pour les 35 m de `ship.lengthM`, la proue à
 * `x = 0`, tribord à `y = 0`, la hauteur en mètres depuis la flottaison (repère du modèle 3D de la caraque).
 * Un étage par pont : `z0` pont de cargaison, `z1` pont principal, `z2` pont supérieur (le château de poupe
 * à l'arrière), `z3` gaillard d'avant, passerelle et plage arrière. Une trappe est la case du pont du dessous
 * posée à la hauteur du pont du dessus (`elevate`, l'étage du dessus y est vide) ; son échelle est l'arête
 * escaladable qui la joint au pont (LDB 15 l.55). Le calque `zoneMap` nomme les pièces de la légende des plans.
 * Les plans ne meublent pas leurs pièces : leur mobilier (`MOBILIER`) est une valeur d'adaptation (#3686), hamacs
 * (MDG 09 l.87) et cabestan (MDG 12 l.213) compris.
 */
import type { MapSpec, WallSpec } from './mapSpec';
import type { SceneEntity } from './monde/scene';
import type { Dir4 } from '../geometry/dir8';
import type { ApportAuxPonts } from './planDeNavire';
import { findVehicleById } from '../data';
import { garanti } from '../lib/garanti';
import { tableTotale } from '../lib/tableTotale';
import { terrainAbsent, terrainsAvecGlyphe } from './monde/terrain';

/** Hauteur (m) du plancher de chaque pont, de la cale à la plage arrière. */
const PONTS = { cale: -2, principal: 0, superieur: 1.95, gaillard: 5.6, plageArriere: 5.85 } as const;

/** Le plancher des ponts : le terrain du glyphe `=` des plans. */
const PLANCHER = garanti(terrainsAvecGlyphe()['='], '=', 'terrain du plancher');

const W = 18;
const H = 5;

const CALE = String.raw`
+ + + + +-+-+-+-+-+-+-+-+-+-+-+ + + +
        |= = = = = = =|= = = =|
+ + + +-+ + + + + + + + + + + +-+-+ +
      |= = = = = = = =|= = = =|= =|
+ + + + + + + + + + + +-+:+-+-+ + + +
      |j = = = = = = = j = = =:= =|
+ + + + + + + + + + + + + +-+-+ + + +
      |= = = = = = = = = =:= =|= =|
+ + + +-+ + + + + + + + + + + +-+-+ +
        |= = = = = = = = =|= =|
+ + + + +-+-+-+-+-+-+-+-+-+-+-+ + + +
`;

const PRINCIPAL = String.raw`
+ + + +-+-+-+-+-+-+-+-+-+-+-+-+-+ + +
      |= = = = = = = = = =|= =|=|
+ + +-+ + + + + + + + + + + + +:+-+ +
    |=:= = k = = = = = = =|= =|= =|
+ +-+ + + + + + + + + + + +-+:+ + + +
  |= =|  = = = = = = =   = = =:= =|
+ +-+ + + + + + + + + + + +:+:+ + + +
    |=:= = = = = = k = = =|=|=|= =|
+ + +-+ + + + + + + + + + + + + +-+ +
      |= = = = = = = = = =|=|=|=|
+ + + +-+-+-+-+-+-+-+-+-+-+-+-+-+ + +
`;

const SUPERIEUR = String.raw`
+ + +-+-+o+o+o+o+o+o+-+-+-+-+-+-+ + +
    |= =|= = = = = =|= =|= =|= =|
+ +-+ + + + + + + + + + + + + + +-+-+
  |=|= =|=   = = = =|= =|= =|= =|= =|
+-+ + + + + + + + + +-+:+:+-+:+-+ + +
|= =:= =:= = = = = =:= = = = = =:= =|
+-+ + + + + + + + + + + + + +:+-+ + +
  |=|= g|= = = = =  |= = = h|= =|= =|
+ +-+ + + + + + + + + + + + + + +-+-+
    |= =|= = = = = =|= = = =|= =|
+ + +-+-+o+o+o+o+o+o+-+-+-+-+-+-+ + +
`;

const HAUT = String.raw`
+ + +o+o+o+ + + + + +o+o+o+o+o+o+ + +
    o= = =o         oa a a a a ao
+ + + + + + + + + + + + + + + + +o+o+
    o= = =o         oa a a a a a a ao
+ + + + + +o+o+o+o+o+ + + + + + + + +
    o= = = = = = = = a a a a a a a ao
+ + + + + +o+o+o+o+o+ + + + + + + + +
    o=   =o         oa a a   a a a ao
+ + + + + + + + + + + + + + + + +o+o+
    o= = =o         oa a a a a ao
+ + +o+o+o+ + + + + +o+o+o+o+o+o+ + +
`;

/** Les pièces de la légende des plans, par pont (`.` : aucune). */
const PIECES: NonNullable<MapSpec['zoneMap']> = {
  z0: [
    '....CCCCCCCIIII...',
    '...CCCCCCCCIIIIJJ.',
    '...CCCCCCCCCCCCJJ.',
    '...CCCCCCCCCCRRJJ.',
    '....CCCCCCCCCRR...',
  ],
  z1: [
    '...PPPPPPPPPPMMG..',
    '..VPPPPPPPPPPMMKK.',
    '.VV.PPPPPPP.PPPKK.',
    '..VPPPPPPPPPPNAKK.',
    '...PPPPPPPPPPNAK..',
  ],
  z2: [
    '..QQSSSSSSEEFFXX..',
    '.OQQS.SSSSEEFFXXBB',
    'OOQQSSSTTSHHHHHHBB',
    '.OQQSSSSS.HHHHYYBB',
    '..QQSSSSSSHHHHYY..',
  ],
  z3: [
    '..WWW.....UUUUUU..',
    '..WWW.....UUUUUUUU',
    '..WWWZZZZZUUUUUUUU',
    '..W.W.....UUU.UUUU',
    '..WWW.....UUUUUU..',
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
 *  du coin nord-ouest de son emprise et son cap (`S` par défaut). Une case de porte, de trappe ou de pied
 *  d'échelle reste libre, et le garde-manger, dont la seule case est celle de sa porte, reste vide. */
const MOBILIER: Readonly<Record<string, readonly (readonly [ref: string, x: number, y: number, facing?: Dir4])[]>> = {
  C: [
    ['tonneaux-pile', 5, 0], ['caisse', 6, 0], ['tonneau', 8, 0], ['caisse', 9, 0],
    ['caisse', 5, 4], ['tonneaux-pile', 6, 4], ['caisse', 8, 4], ['tonneaux-pile', 9, 4], ['tonneau', 11, 4],
  ],
  I: [['lit', 11, 0], ['lit', 13, 0], ['etagere', 14, 1]],
  R: [['etabli', 14, 3], ['caisse', 14, 4]],
  J: [['banc', 16, 1], ['tas-foin', 16, 3]],
  V: [['rouleau-de-cordage', 1, 2], ['rouleau-de-cordage', 2, 2]],
  P: [
    ['cabestan', 7, 2],
    ['hamac', 10, 0], ['hamac', 11, 0], ['hamac', 12, 0], ['hamac', 10, 4], ['hamac', 11, 4], ['hamac', 12, 4],
  ],
  M: [['caisse', 13, 0], ['tonneau', 14, 0], ['caisse', 13, 1]],
  N: [['tonneau', 13, 4]],
  A: [['armoire', 14, 4, 'N']],
  K: [['table', 16, 1], ['cheminee-interieure', 16, 2, 'O'], ['marmite', 16, 3], ['tonneau', 15, 4]],
  O: [['rouleau-de-cordage', 1, 1], ['rouleau-de-cordage', 1, 3]],
  Q: [['hamac', 2, 0], ['hamac', 3, 0], ['coffre', 2, 1], ['hamac', 2, 4], ['hamac', 3, 4]],
  E: [['table', 10, 0], ['chaise', 11, 0, 'O'], ['chaise', 10, 1, 'N']],
  F: [['lit', 12, 0], ['coffre', 13, 1]],
  H: [['table-2x1', 10, 3], ['banc', 10, 4], ['banc', 11, 4]],
  X: [['lit', 14, 0], ['bureau', 15, 1]],
  Y: [['lit', 14, 4], ['coffre', 15, 3]],
  B: [['barre-de-navire', 16, 1, 'E']],
};

/** Les décors de `MOBILIER`, chacun sur le pont de sa pièce, sous l'id de sa pièce suivi de son `ref` et de son rang. */
const MEUBLES: SceneEntity[] = Object.entries(MOBILIER).flatMap(([lettre, meubles]) => {
  const piece = garanti(LEGENDE_DES_PIECES[lettre], lettre, 'pièce meublée').id;
  const etage = garanti(Object.keys(PIECES).find((e) => [PIECES[e]].flat().join('').includes(lettre)), lettre, 'pont de la pièce');
  return meubles.map(([ref, x, y, facing = 'S'], i): SceneEntity => ({
    id: `${piece}-${ref}-${meubles.slice(0, i + 1).filter(([r]) => r === ref).length}`,
    kind: 'prop',
    ref,
    pos: { x, y },
    z: Number(etage.slice(1)),
    facing,
  }));
});

/** La caraque en `MapSpec`. */
export const PLAN_DE_LA_CARAQUE: MapSpec = {
  id: 'caraque',
  label: garanti(findVehicleById('caraque'), 'caraque', 'véhicule').label,
  size: [W, H],
  terrain: terrainAbsent(),
  // `a` : plage arrière ; `j`, `k`, `g`, `h` : trappes vers le pont principal, le pont supérieur, le gaillard
  // et la plage arrière ; toutes du plancher des ponts (`=`).
  legend: tableTotale([...'ajkgh'], () => PLANCHER),
  walled: { z0: CALE, z1: PRINCIPAL, z2: SUPERIEUR, z3: HAUT },
  relief: [PONTS.cale, PONTS.principal, PONTS.superieur, PONTS.gaillard].map((height, z) => ({ rect: [0, 0, W - 1, H - 1], height, z })),
  elevate: { a: PONTS.plageArriere, j: PONTS.principal, k: PONTS.superieur, g: PONTS.gaillard, h: PONTS.plageArriere },
  zoneMap: PIECES,
  zoneLegend: LEGENDE_DES_PIECES,
  entities: MEUBLES,
  walls: [
    { x: 4, y: 2, side: 'O', z: 0, climb: { kind: 'ladder' } },
    { x: 10, y: 2, side: 'E', z: 0, climb: { kind: 'ladder' } },
    { x: 6, y: 1, side: 'O', z: 1, climb: { kind: 'ladder' } },
    { x: 8, y: 3, side: 'E', z: 1, climb: { kind: 'ladder' } },
    { x: 3, y: 2, side: 'S', z: 2, climb: { kind: 'ladder' } },
    { x: 12, y: 3, side: 'E', z: 2, climb: { kind: 'ladder' } },
  ],
};

/** Un sabord fermé sur l'arête de coque (x, y, côté) du pont `z`. */
const sabord = (x: number, y: number, side: WallSpec['side'], z: number): WallSpec => ({ x, y, side, z, window: true, shuttered: true });

/** Hauteur (m) du plancher de la hune du grand mât, depuis la flottaison (modèle 3D de la caraque). */
const HUNE = 23.9;

/**
 * Ce que chaque Amélioration ajoute aux ponts de la caraque, aux places du modèle 3D (manifeste de la caraque,
 * `ancrages` et `selon.sabord.postes`) ramenées aux cases du plan :
 * - Nid-de-pie (MDG 12 l.297) : la hune du grand mât (case 9 de la longueur), au bout de l'échelle de ses haubans
 *   depuis la passerelle, bordée de son garde-corps ;
 * - Embarcation de bord (MDG 12 l.266) : le canot de 5 m sur l'embelle, sur la trappe de fret ;
 * - Sabord (MDG 12 l.364) : les sabords fermés de la batterie du pont principal (deux par bord), du château (une
 *   case de flanc chacun) et du tableau de poupe (deux).
 */
export const AMELIORATIONS_DE_LA_CARAQUE: Readonly<Record<string, ApportAuxPonts>> = {
  'nid-de-pie': {
    terrainRects: [{ rect: [9, 1, 1, 1], terrain: PLANCHER, z: 3 }],
    relief: [{ cell: [9, 1], height: HUNE, z: 3 }],
    walls: [
      { x: 9, y: 2, side: 'N', z: 3, climb: { kind: 'ladder' } },
      ...(['N', 'O', 'E'] as const).map((side): WallSpec => ({ x: 9, y: 1, side, z: 3, window: true })),
    ],
  },
  'embarcation-de-bord': {
    entities: [{ id: 'embarcation-de-bord', kind: 'prop', ref: 'barque', pos: { x: 6, y: 2 }, z: 2, facing: 'S' }],
  },
  sabord: {
    walls: [
      ...[5, 7].flatMap((x) => [sabord(x, 0, 'N', 1), sabord(x, 4, 'S', 1)]),
      ...[12, 13, 14, 15].flatMap((x) => [sabord(x, 0, 'N', 2), sabord(x, 4, 'S', 2)]),
      sabord(16, 1, 'N', 2),
      sabord(16, 3, 'S', 2),
      sabord(17, 1, 'E', 2),
      sabord(17, 3, 'E', 2),
    ],
  },
};
