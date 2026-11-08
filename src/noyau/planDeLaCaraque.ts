/**
 * Les ponts de la caraque en `MapSpec` que `buildScene` compile (#3686), lus dans la seule source de leur forme :
 * `ponts` et `hauteursDesPonts` de sa fiche (`vehicles.json`), que la construction de son modèle 3D lit aussi
 * (`scripts/personnage-3d/vehicule/caraque/plan_de_jeu.py`). Une case de 2 m (`sceneMetresPerTile`), la proue à
 * `x = 0`, tribord à `y = 0`, la hauteur en mètres depuis la flottaison ; le centre du plan est l'origine du modèle.
 * Un étage par pont : `z0` cale, `z1` pont principal (la batterie), `z2` pont supérieur (l'embelle, le dessous du
 * gaillard d'avant et le château de poupe), `z3` chambre du château, `z4` gaillard d'avant et plage arrière. Une
 * trappe est la case du pont du dessous à la hauteur du pont du dessus, l'étage du dessus y est vide ; son échelle
 * (`MOTS_DES_PONTS.echelle`) est l'arête escaladable qui la joint au pont (LDB 15 l.55).
 * Ce qui s'écrit ici, aux cases de la source : les pièces de la légende des plans (MDG 12 l.286, planche
 * « Caraque », plans de ses ponts), leur mobilier (`MOBILIER`), valeur d'adaptation (#3686), hamacs (MDG 09 l.87)
 * et cabestan (MDG 12 l.213) compris, et ce que les Améliorations y ajoutent.
 */
import type { MapSpec, WallSpec } from './mapSpec';
import type { SceneEntity } from './monde/scene';
import type { Dir4 } from '../geometry/dir8';
import type { ApportAuxPonts } from './planDeNavire';
import { findVehicleById } from '../data';
import { MOTS_DES_PONTS, grilleDesPonts, type AreteDePont, type CaseDePont } from '../data/schemas/grammaire/carte-ascii';
import { garanti } from '../lib/garanti';
import { tableTotale } from '../lib/tableTotale';
import { terrainAbsent, terrainsAvecGlyphe } from './monde/terrain';

const CARAQUE = garanti(findVehicleById('caraque'), 'caraque', 'véhicule');
const PONTS = garanti(CARAQUE.ponts, 'caraque', 'ponts du véhicule');
const HAUTEURS = garanti(CARAQUE.hauteursDesPonts, 'caraque', 'hauteurs des ponts');
const GRILLE = grilleDesPonts(PONTS);

/** Le plancher des ponts : le terrain du glyphe `=` des plans. */
const PLANCHER = garanti(terrainsAvecGlyphe()['='], '=', 'terrain du plancher');

/** La case de pont (x, y) du pont `z`, si elle existe. */
const caseDuPont = (x: number, y: number, z: number): CaseDePont | undefined =>
  GRILLE.cases.find((c) => c.x === x && c.y === y && c.z === z);

/** L'arête de pont `e` comme `WallSpec`, portée par la case qui existe de ses deux côtés (la seconde d'abord). */
function areteDuPlan(e: AreteDePont): WallSpec {
  const seconde = caseDuPont(e.x, e.y, e.z);
  if (e.sens === 't') return seconde ? { x: e.x, y: e.y, side: 'O', z: e.z } : { x: e.x - 1, y: e.y, side: 'E', z: e.z };
  return seconde ? { x: e.x, y: e.y, side: 'N', z: e.z } : { x: e.x, y: e.y - 1, side: 'S', z: e.z };
}

const aretesDe = (mot: string): WallSpec[] => GRILLE.aretes.filter((e) => e.glyphe === mot).map(areteDuPlan);

/** Les cartes `walled` des ponts : une échelle y est une arête ouverte, un sabord une arête de coque murée. */
const CARTES: Record<string, string> = Object.fromEntries(PONTS.map((carte, z) => [`z${z}`, carte.split('\n').map((ligne, l) =>
  ligne.split(MOTS_DES_PONTS.echelle).join(' ').split(MOTS_DES_PONTS.sabord).join(l % 2 === 0 ? '-' : '|')).join('\n')]));

/** Les pièces de la légende des plans, par pont (`.` : aucune). */
const PIECES: NonNullable<MapSpec['zoneMap']> = {
  z0: [
    '..................',
    '....CCCCCCIIII....',
    '....CCCCCCCCCCCC..',
    '....CCCCCCRRJJ....',
    '..................',
  ],
  z1: [
    '.....PPPPMMM......',
    '...PPPPPPPPPPPAAG.',
    '..VP.PPPPPPPPPKKK.',
    '...PPPP.PPPPPPKKK.',
    '.....PPPPPNN......',
  ],
  z2: [
    '.....SSSSSSS......',
    '..OQS.SSSSSSEEFFF.',
    '..OQSSTTSSSSHHHHH.',
    '..OQSSSSSS.SHHHHH.',
    '.....SSSSSSS......',
  ],
  z3: [
    '..................',
    '...............XXX',
    '..............BB.B',
    '...............YYY',
    '..................',
  ],
  z4: [
    '..................',
    'WWWW........UUUUUU',
    'WWWW.........UUUUU',
    'WWW.........UUUUUU',
    '..................',
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
  U: { id: 'plage-arriere', label: 'Plage arrière', presentation: 'exterior' },
};

/** Le mobilier de chaque pièce intérieure, par lettre de la légende : le décor (`ref` de `props.json`), la case
 *  du coin nord-ouest de son emprise et son cap (`S` par défaut). Une case de porte, de trappe ou de pied
 *  d'échelle reste libre, et le garde-manger et la réserve de voiles, dont la seule case est celle de leur porte,
 *  restent vides. */
const MOBILIER: Readonly<Record<string, readonly (readonly [ref: string, x: number, y: number, facing?: Dir4])[]>> = {
  C: [
    ['tonneaux-pile', 4, 1], ['caisse', 5, 1], ['tonneau', 7, 1], ['caisse', 8, 1],
    ['caisse', 4, 3], ['tonneaux-pile', 5, 3], ['caisse', 7, 3], ['tonneaux-pile', 9, 3], ['tonneau', 14, 2],
  ],
  I: [['lit', 10, 1], ['etagere', 13, 1]],
  R: [['etabli', 11, 3]],
  J: [['banc', 12, 3]],
  P: [
    ['cabestan', 7, 2],
    ['hamac', 5, 0], ['hamac', 6, 0], ['hamac', 7, 0], ['hamac', 5, 4], ['hamac', 6, 4], ['hamac', 7, 4],
  ],
  M: [['caisse', 9, 0], ['tonneau', 11, 0]],
  N: [['tonneau', 10, 4]],
  A: [['armoire', 15, 1]],
  K: [['cheminee-interieure', 16, 3, 'O'], ['marmite', 15, 3], ['tonneau', 14, 3]],
  O: [['rouleau-de-cordage', 2, 1], ['rouleau-de-cordage', 2, 3]],
  Q: [['hamac', 3, 1]],
  E: [['table', 13, 1]],
  F: [['lit', 15, 1]],
  H: [['table-2x1', 12, 3], ['banc', 14, 3]],
  X: [['lit', 16, 1]],
  Y: [['lit', 16, 3]],
  B: [['barre-de-navire', 17, 2, 'E']],
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
  label: CARAQUE.label,
  size: [GRILLE.w, GRILLE.h],
  terrain: terrainAbsent(),
  legend: tableTotale(Object.keys(HAUTEURS), () => PLANCHER),
  walled: CARTES,
  elevate: HAUTEURS,
  zoneMap: PIECES,
  zoneLegend: LEGENDE_DES_PIECES,
  entities: MEUBLES,
  walls: aretesDe(MOTS_DES_PONTS.echelle).map((e): WallSpec => ({ ...e, climb: { kind: 'ladder' } })),
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
    entities: [{ id: 'embarcation-de-bord', kind: 'prop', ref: 'barque', pos: { x: 6, y: 2 }, z: 2, facing: 'S' }],
  },
  sabord: {
    walls: aretesDe(MOTS_DES_PONTS.sabord).map((e): WallSpec => ({ ...e, window: true, shuttered: true })),
  },
};
