/**
 * Plans de test BÂTIS pour la géométrie du monde : bâtiment à étage, volées, portes, pièces, cours.
 * Aucun paquet de campagne : la scène se construit ici, par `buildScene`, pour les suites qui l'éprouvent.
 */
import { buildScene, type WallSpec } from '../../noyau/mapSpec';
import type { CellSide, SceneEffectZone } from '../../noyau/monde/scene';

interface Rect { x: number; y: number; w: number; h: number }

/** Arête canonique `x,y,N|E` d'une arête de case, quel que soit le côté qui la nomme. */
function canon(x: number, y: number, side: CellSide): { x: number; y: number; side: 'N' | 'E' } {
  if (side === 'S') return { x, y: y + 1, side: 'N' };
  if (side === 'O') return { x: x - 1, y, side: 'E' };
  return { x, y, side };
}

/** Les murs du pourtour de chaque rectangle, à l'étage `z`, dédoublonnés, hors les arêtes `ouvertures`. */
function cloisons(rects: readonly Rect[], z: number, ouvertures: readonly WallSpec[]): WallSpec[] {
  const percees = new Set(ouvertures.filter((o) => (o.z ?? 0) === z).map((o) => `${o.x},${o.y},${o.side}`));
  const out = new Map<string, WallSpec>();
  for (const r of rects)
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        const bords: [boolean, CellSide][] = [[y === r.y, 'N'], [y === r.y + r.h - 1, 'S'], [x === r.x, 'O'], [x === r.x + r.w - 1, 'E']];
        for (const [bord, side] of bords) {
          if (!bord) continue;
          const c = canon(x, y, side);
          const k = `${c.x},${c.y},${c.side}`;
          if (!percees.has(k)) out.set(k, z ? { ...c, z } : c);
        }
      }
  return [...out.values()];
}

/** Grille ASCII `w×h` : `fond` partout, puis chaque rectangle peint de son char, dans l'ordre. */
function grille(w: number, h: number, fond: string, peints: readonly [Rect, string][]): string {
  const rows = Array.from({ length: h }, () => Array.from({ length: w }, () => fond));
  for (const [r, ch] of peints)
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) rows[y][x] = ch;
  return rows.map((row) => row.join('')).join('\n');
}

const W = 24;
const H = 20;

/** Corps du relais, aux deux étages : x 3..16, y 2..14 au rez ; l'étage couvre y 2..9, la dernière marche de chaque volée n'a de flancs qu'au rez. */
const SALLE: Rect = { x: 3, y: 2, w: 7, h: 6 };
const CUISINE: Rect = { x: 10, y: 2, w: 7, h: 6 };
const VESTIBULE: Rect = { x: 3, y: 8, w: 14, h: 7 };
const CHAMBRE_OUEST: Rect = { x: 3, y: 2, w: 7, h: 6 };
const CHAMBRE_EST: Rect = { x: 10, y: 2, w: 7, h: 6 };
const GALERIE: Rect = { x: 3, y: 8, w: 14, h: 2 };
/** Potager clos, sans aucune ouverture vers la cour, et la remise qui s'y ouvre. */
const POTAGER: Rect = { x: 17, y: 0, w: 7, h: 8 };
const REMISE: Rect = { x: 20, y: 1, w: 3, h: 3 };

/** Les deux volées du vestibule, du rez (bas) au plancher de la galerie (haut). */
export const VOLEES_DU_RELAIS = [
  { bas: { x: 4, y: 13 }, haut: { x: 4, y: 10 } },
  { bas: { x: 15, y: 13 }, haut: { x: 15, y: 10 } },
] as const;

const PORTE = { door: true, structure: 'solide-porte-en-bois' } as const;
/** Portes et fenêtres, en arêtes canoniques. La porte de la remise porte un matériau DISTINCT des autres. */
const OUVERTURES: WallSpec[] = [
  { x: 2, y: 5, side: 'E', ...PORTE }, // salle → cour (ouest)
  { x: 9, y: 4, side: 'E', ...PORTE }, // salle → cuisine
  { x: 6, y: 8, side: 'N', ...PORTE }, // salle → vestibule
  { x: 13, y: 8, side: 'N', ...PORTE }, // cuisine → vestibule
  { x: 10, y: 15, side: 'N', ...PORTE }, // vestibule → cour (sud)
  { x: 21, y: 4, side: 'N', door: true, structure: 'porte' }, // remise → potager
  { x: 6, y: 2, side: 'N', window: true, structure: 'mur-a-ossature-en-bois' },
  { x: 6, y: 8, side: 'N', z: 1, ...PORTE }, // chambre ouest → galerie
  { x: 13, y: 8, side: 'N', z: 1, ...PORTE }, // chambre est → galerie
  { x: 13, y: 2, side: 'N', z: 1, window: true, structure: 'mur-a-ossature-en-bois' },
];

/** Débouchés des volées sur la galerie : le garde-corps s'ouvre au droit de la dernière marche et de ses deux flancs. */
const DEBOUCHES: WallSpec[] = VOLEES_DU_RELAIS.flatMap(({ haut }) => [-1, 0, 1].map((dx): WallSpec => ({ x: haut.x + dx, y: haut.y, side: 'N', z: 1 })));

/** Clôture du potager : le flanc nord du relais (x 16|17, y 0..1) et sa lisière sud (y 7|8). */
const CLOTURE: WallSpec[] = [
  { x: 16, y: 0, side: 'E' }, { x: 16, y: 1, side: 'E' },
  ...Array.from({ length: POTAGER.w }, (_, i): WallSpec => ({ x: POTAGER.x + i, y: POTAGER.y + POTAGER.h, side: 'N' })),
];

const zone = (id: string, label: string, area: Rect, z = 0): SceneEffectZone =>
  ({ id, label, presentation: 'interior', area: { kind: 'rect', ...area }, ...(z ? { z } : {}) });

/** Les pièces intérieures du relais, aux deux étages, et de la remise. La galerie de l'étage reste NON zonée. */
export const PIECES_DU_RELAIS: readonly SceneEffectZone[] = [
  zone('salle-commune', 'Salle commune', SALLE),
  zone('cuisine', 'Cuisine', CUISINE),
  zone('vestibule', 'Vestibule', VESTIBULE),
  zone('chambre-ouest', 'Chambre ouest', CHAMBRE_OUEST, 1),
  zone('chambre-est', 'Chambre est', CHAMBRE_EST, 1),
  zone('remise', 'Remise', REMISE),
];

/** Case de la galerie (étage z1, couverte, non zonée). */
export const GALERIE_DU_RELAIS = { x: 8, y: 9, z: 1 } as const;
/** Case du potager clos, coupé de la cour. */
export const POTAGER_DU_RELAIS = { x: 18, y: 1 } as const;
/** Id de l'âtre posé dans la salle commune (source de lumière du document). */
export const ATRE_DU_RELAIS = 'relais-atre';

/**
 * « Relais à étage » (24×20, deux couches) : au rez, salle commune, cuisine et vestibule, reliés par des portes ;
 * deux volées montent du vestibule à la galerie de l'étage ; à l'étage, deux chambres zonées et une galerie
 * couverte non zonée ; une cour ouverte au sud et à l'ouest ; un potager clos à l'est, isolé de la cour, où
 * s'ouvre une remise. Un seul corps d'architecture, non borné : ses masses se dérivent du plancher.
 */
export function relaisAEtage() {
  const volee = (v: (typeof VOLEES_DU_RELAIS)[number]): Rect =>
    ({ x: v.bas.x, y: v.haut.y, w: 1, h: v.bas.y - v.haut.y + 1 });
  return buildScene({
    id: 'relais-a-etage',
    label: 'Relais à étage',
    size: [W, H],
    terrain: 'herbe',
    legend: { P: 'plancher', Q: 'plancher' },
    elevate: { Q: 4 },
    levels: {
      z0: grille(W, H, '.', [[SALLE, 'P'], [CUISINE, 'P'], [VESTIBULE, 'P'], [REMISE, 'P'], ...VOLEES_DU_RELAIS.map((v): [Rect, string] => [volee(v), 'E'])]),
      z1: grille(W, H, '.', [[CHAMBRE_OUEST, 'Q'], [CHAMBRE_EST, 'Q'], [GALERIE, 'Q'], ...VOLEES_DU_RELAIS.map((v): [Rect, string] => [volee(v), '.'])]),
    },
    cells: { E: { terrain: 'pierre', stair: { to: 'z1' } } },
    walls: [
      ...cloisons([SALLE, CUISINE, VESTIBULE, REMISE], 0, OUVERTURES),
      ...cloisons([CHAMBRE_OUEST, CHAMBRE_EST, GALERIE], 1, [...OUVERTURES, ...DEBOUCHES]),
      ...OUVERTURES,
      ...CLOTURE,
    ],
    architecture: [
      { id: 'relais', style: { id: 'maison' }, storeys: [], facades: [], masses: [] },
    ],
    effectZones: [...PIECES_DU_RELAIS],
    entities: [{ id: ATRE_DU_RELAIS, kind: 'prop', decor: { id: 'brasero' }, pos: { x: 4, y: 3 } }],
    heroStart: [1, 16],
  });
}
