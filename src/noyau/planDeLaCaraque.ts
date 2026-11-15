/**
 * Les ponts de la caraque en `MapSpec` que `buildScene` compile (#3686), lus dans `ponts` de sa fiche
 * (`pontsDeLaFiche`). Un étage par pont : `z0` cale, `z1` pont principal (la batterie), `z2` pont supérieur (l'embelle,
 * le dessous du gaillard d'avant et le château de poupe), `z3` gaillard d'avant, passerelle et plage arrière.
 * Ce qui s'écrit ici, aux cases de la source : les pièces de la légende des plans (MDG 12 l.286, planche
 * « Caraque », plans de ses ponts), leur mobilier (`MOBILIER`), valeur d'adaptation (#3686), hamacs (MDG 09 l.87)
 * et cabestan (MDG 12 l.213) compris, son décor (`DECOR`), que la scène garde ou retire, et ce que les Améliorations y
 * ajoutent.
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

/** Les pièces de la légende des plans, par pont (`.` : aucune ; `^` : une trappe, dans la pièce du pont où elle
 *  débouche, `pieceDeLaTrappe`). */
const PIECES: Record<string, string[]> = {
  z0: [
    '..................',
    '..CCCCCCCCCIIII...',
    '..C^CCCCCCC^CCCJ..',
    '..CCCCCCCCCCRR....',
    '..................',
  ],
  z1: [
    '....PPPPPPPPPM....',
    '.VPP^PPPPP^PPMMMG.',
    '.VP.PP..PPP.PPPPK.',
    '.VPP^PPPPP^PPNAAK.',
    '....PPPPPPPPPN....',
  ],
  z2: [
    '....SSSSSSSEFF....',
    '.OQQ.SSSSS.EFFXXBB',
    'OOQQSS..SSSHHHHHBB',
    '.OQ^.SSSSS.HH^YYBB',
    '....SSSSSSSHHH....',
  ],
  z3: [
    '..WW.......UUU....',
    '..WW.......UUUUUUU',
    '..WWZZZZZZZUUUUUUU',
    '..W........UU.UUUU',
    '..WW.......UUU....',
  ],
};

/** La pièce de la trappe (x, y) du pont `z` : celle de ses voisines du pont du dessus à sa hauteur, sans mot sur leur
 *  arête (#3815). */
function pieceDeLaTrappe(x: number, y: number, z: number): string {
  const glyphe = (cx: number, cy: number, cz: number) => GRILLE.cases.find((c) => c.x === cx && c.y === cy && c.z === cz)?.glyphe;
  const hauteur = HAUTEURS[garanti(glyphe(x, y, z), `${x},${y},${z}`, 'case de trappe')];
  const lettres = new Set(([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).flatMap(([dx, dy]) => {
    const [nx, ny] = [x + dx, y + dy];
    const voisine = glyphe(nx, ny, z + 1);
    const [sens, ax, ay] = dx ? ['t', Math.max(x, nx), y] : ['l', x, Math.max(y, ny)];
    const mot = GRILLE.aretes.some((e) => e.z === z + 1 && e.sens === sens && e.x === ax && e.y === ay);
    return voisine !== undefined && HAUTEURS[voisine] === hauteur && !mot ? [PIECES[`z${z + 1}`][ny][nx]] : [];
  }));
  return garanti(lettres.size === 1 ? [...lettres][0] : undefined, `${x},${y},${z}`, 'pièce où débouche la trappe');
}

/** `PIECES`, chaque trappe dans la pièce où elle débouche : sous la minuscule de sa lettre, une pièce à l'étage de la
 *  trappe (une pièce vit à un seul étage, `roomTiles`). */
const PIECES_DU_PLAN: Record<string, string[]> = Object.fromEntries(Object.entries(PIECES).map(([etage, rangs]) =>
  [etage, rangs.map((rang, y) => [...rang].map((l, x) => (l === '^' ? pieceDeLaTrappe(x, y, Number(etage.slice(1))).toLowerCase() : l)).join(''))]));

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
  O: { id: 'proue', label: 'Proue', presentation: 'exterior' },
  Q: { id: 'quartiers-de-l-equipage', label: "Quartiers de l'équipage", presentation: 'interior' },
  S: { id: 'pont-superieur-des-canons', label: 'Pont supérieur des canons', presentation: 'exterior' },
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

/** `LEGENDE_DES_PIECES` et, pour chaque minuscule de `PIECES_DU_PLAN`, la part de sa pièce à l'étage de ses trappes. */
const LEGENDE_DU_PLAN: NonNullable<MapSpec['zoneLegend']> = {
  ...LEGENDE_DES_PIECES,
  ...Object.fromEntries(Object.entries(PIECES_DU_PLAN).flatMap(([etage, rangs]) => [...new Set(rangs.join('').match(/[a-z]/g))].map((l) => {
    const piece = garanti(LEGENDE_DES_PIECES[l.toUpperCase()], l, 'pièce où débouche une trappe');
    return [l, { ...piece, id: `${piece.id}-${etage}` }];
  }))),
};

/** Le mobilier de chaque pièce intérieure, par lettre de la légende : le décor (`ref` de `props.json`), la case
 *  du coin nord-ouest de son emprise, son cap, son calage dans le jeu libre de sa case (`SceneEntity.calage`, centré
 *  sans lui) et, posé sur un autre meuble de sa pièce, le `ref` et le rang de celui-ci (`SceneEntity.sur`). Le
 *  cabestan du pont principal entre la trappe de fret et le grand mât (#3815). Une case de porte, de trappe, de pied
 *  d'échelle ou seul passage vers d'autres reste libre ; la pièce montée à un poste (`postes` du manifeste) et son
 *  servant ne recouvrent aucun meuble de son pont. Une pièce reste vide quand aucune de ses cases n'en laisse la place. Le calage
 *  plaque un meuble à une cloison du plan ; près du bordé et de la muraille, chaque meuble se tient dans l'emprise libre
 *  que le modèle laisse à ses cases (`cases` du manifeste de `vehicule--caraque`, #3767). */
const MOBILIER: Readonly<Record<string, readonly (readonly [ref: string, x: number, y: number, facing: Dir4, calage?: Calage, sur?: string])[]>> = {
  C: [
    ['caisse', 5, 1, 'S'], ['tonneaux-pile', 6, 1, 'S', { x: 0, y: 1 }], ['tonneau', 7, 1, 'S'], ['caisse', 8, 1, 'S'], ['tonneau', 9, 1, 'S'],
    ['caisse', 4, 3, 'S', { x: 0, y: -1 }], ['tonneaux-pile', 5, 3, 'S'], ['caisse', 7, 3, 'S'], ['tonneaux-pile', 9, 3, 'S'],
    ['caisse', 8, 1, 'E', undefined, 'caisse-2'],
  ],
  I: [['etagere', 13, 1, 'S', { x: 0, y: -0.25 }], ['coffre', 14, 1, 'E', { x: -1, y: 1 }]],
  R: [['caisse', 13, 3, 'S', { x: -1, y: -1 }], ['tonneau', 13, 3, 'S', { x: 0.75, y: -1 }]],
  V: [['rouleau-de-cordage', 1, 2, 'S', { x: 0.5, y: 0 }]],
  P: [
    ['cabestan', 8, 2, 'S'],
    ['hamac', 4, 0, 'S', { x: 0, y: 1 }], ['hamac', 6, 0, 'S', { x: 0, y: 1 }], ['hamac', 11, 0, 'S', { x: 0, y: 1 }],
    ['hamac', 4, 4, 'S', { x: 0, y: -1 }], ['hamac', 6, 4, 'S', { x: 0, y: -1 }], ['hamac', 11, 4, 'S', { x: 0, y: -1 }],
  ],
  M: [
    ['caisse', 13, 1, 'S', { x: -1, y: -1 }], ['caisse', 13, 1, 'S', { x: -1, y: 1 }], ['tonneau', 13, 1, 'S', { x: 1, y: -1 }],
    ['tonneau', 15, 1, 'S', { x: -1, y: 1 }], ['tonneau', 15, 1, 'S', { x: 1, y: 1 }], ['banc', 13, 0, 'S', { x: 0, y: 1 }],
  ],
  N: [['coffre', 13, 4, 'N', { x: 0, y: -1 }]],
  A: [['coffre', 14, 3, 'S', { x: 0, y: 1 }]],
  K: [['brasero', 16, 3, 'S', { x: 0.5, y: -1 }], ['marmite', 16, 3, 'S', { x: -1, y: -1 }]],
  Q: [
    ['hamac', 3, 1, 'S', { x: 0, y: -1 }], ['hamac', 3, 1, 'S', { x: 0, y: 1 }],
    ['rouleau-de-cordage', 2, 1, 'S', { x: 0, y: 0.5 }], ['rouleau-de-cordage', 2, 3, 'S', { x: 0, y: -0.5 }],
  ],
  E: [['table', 11, 0, 'S', { x: 0, y: 1 }]],
  H: [['table', 11, 4, 'S', { x: 0, y: -1 }]],
  F: [['hamac', 13, 1, 'S', { x: 0, y: -1 }], ['coffre', 13, 1, 'N', { x: 0, y: 1 }]],
  X: [['bureau', 15, 1, 'S', { x: 0, y: -0.5 }], ['coffre', 15, 1, 'S', { x: -1, y: 1 }]],
  Y: [['hamac', 15, 3, 'S', { x: 0, y: 0.5 }], ['coffre', 15, 3, 'S', { x: -1, y: -1 }]],
  B: [['barre-de-navire', 17, 2, 'E', { x: -0.5, y: 0 }]],
};

/** Les décors de `MOBILIER`, chacun sur le pont de sa pièce, sous l'id de sa pièce suivi de son `ref` et de son rang. */
const MEUBLES: SceneEntity[] = Object.entries(MOBILIER).flatMap(([lettre, meubles]) => {
  const piece = garanti(LEGENDE_DES_PIECES[lettre], lettre, 'pièce meublée').id;
  const etage = garanti(Object.keys(PIECES).find((e) => PIECES[e].join('').includes(lettre)), lettre, 'pont de la pièce');
  return meubles.map(([ref, x, y, facing, calage, sur], i): SceneEntity => ({
    id: `${piece}-${ref}-${meubles.slice(0, i + 1).filter(([r]) => r === ref).length}`,
    kind: 'prop',
    decor: { id: ref },
    pos: { x, y },
    z: Number(etage.slice(1)),
    facing,
    ...(calage ? { calage } : {}),
    ...(sur ? { sur: `${piece}-${sur}` } : {}),
  }));
});

/** Le décor de la caraque, valeur d'adaptation (#3815) : le décor (`ref` de `props.json`), sa case, son pont, son cap et
 *  son calage dans le jeu libre de sa case (`SceneEntity.calage`, centré sans lui). Le fanal du couronnement, sur la
 *  plage arrière (illustration « Caraque », MDG 12 l.286). */
const DECOR: readonly (readonly [ref: string, x: number, y: number, z: number, facing: Dir4, calage: Calage])[] = [
  ['fanal', 17, 2, 3, 'S', { x: -0.5, y: 0 }],
];

/** Les décors de `DECOR`, chacun sous son `ref` suivi de son rang. */
const DECORS: SceneEntity[] = DECOR.map(([ref, x, y, z, facing, calage], i): SceneEntity => ({
  id: `${ref}-${DECOR.slice(0, i + 1).filter(([r]) => r === ref).length}`,
  kind: 'prop',
  decor: { id: ref },
  pos: { x, y },
  z,
  facing,
  calage,
}));

/** La caraque en `MapSpec`. */
export const PLAN_DE_LA_CARAQUE: MapSpec = {
  ...PONTS_DE_LA_CARAQUE,
  zoneMap: PIECES_DU_PLAN,
  zoneLegend: LEGENDE_DU_PLAN,
  entities: [...MEUBLES, ...DECORS],
};

/** Le glyphe de la case du grand mât dans la source, et celui de la hauteur du plancher de sa hune. */
const MAT = 'm';
const HUNE = 'n';
const CASE_DU_MAT = garanti(GRILLE.cases.find((c) => c.glyphe === MAT), MAT, 'case du grand mât');

/** Le glyphe de la passerelle dans la source ; le canot de l'Embarcation de bord, de sa case du coin nord-ouest (le pied
 *  de son sol) à celle du bout de sa coque, au pont de la passerelle. */
const PASSERELLE = 'z';
const CANOT: { pos: { x: number; y: number }; bout: { x: number; y: number }; z: number } = { pos: { x: 6, y: 3 }, bout: { x: 7, y: 3 }, z: 3 };

/**
 * Ce que chaque Amélioration ajoute aux ponts de la caraque, aux cases de la source :
 * - Nid-de-pie (MDG 12 l.297) : la case du grand mât monte au plancher de sa hune, au bout de l'échelle de ses
 *   haubans depuis l'embelle à tribord, bordée de son garde-corps ;
 * - Embarcation de bord (MDG 12 l.266) : le canot de 5 m sur les poutres de support de la passerelle (planche, « 5 »),
 *   à bâbord, au-dessus de l'embelle, son sol à la hauteur de la passerelle, valeur d'adaptation (#3815) ;
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
    relief: [{ rect: [CANOT.pos.x, CANOT.pos.y, CANOT.bout.x, CANOT.bout.y], height: garanti(HAUTEURS[PASSERELLE], PASSERELLE, 'hauteur de la passerelle'), z: CANOT.z }],
    entities: [{ id: 'embarcation-de-bord', kind: 'prop', decor: { id: 'barque' }, pos: CANOT.pos, z: CANOT.z, facing: 'S' }],
  },
  sabord: {
    walls: aretesDe(MOTS_DES_PONTS.sabord).map((e): WallSpec => ({ ...e, window: true, shuttered: true })),
  },
};
