/**
 * CONVERSION MONDE : les `Face` du pivot (`builders/types.ts`, GP = tuiles continues + hauteur en
 * MÈTRES) deviennent des triangles en repère three (Y = haut) : `(x, y, h) → (x·mpt, h, y·mpt)`.
 * Module PUR : ni DOM, ni renderer, ni `three`, ni catalogue (des points nus suffisent au maillage).
 *
 * Six politiques y vivent, chacune une fonction :
 *  - ORIENTATION (`orienterPoly`) : le DEHORS d'une face, selon le régime qu'elle DÉCLARE — la
 *    cuisson en tire son sens de parcours, l'instrument de QC son cull ; une seule définition ;
 *  - FAMILLE D'OMBRAGE (`shadeFamily`) : l'axe dominant de la normale ORIENTÉE. Le facteur
 *    d'irradiance de la famille est une lecture de catalogue et vit avec elle (`faceColors.ts`) ;
 *  - TRIANGULATION en ÉVENTAIL (les faces du pivot sont planes, convexes, ≤ 4 points) ;
 *  - VOLUME d'une face VERTICALE : une face du pivot est un plan d'épaisseur NULLE (l'affine peint des
 *    quads d'écran) — sans surface à 90° de plongée, sans chant à éclairer. Toute face verticale à qui
 *    l'appelant résout une profondeur (`FaceDepth`, catalogues d'apparence : `catalog/faceDepth.ts`) devient
 *    une BOÎTE MINCE centrée sur son plan (`wallBoxPolys`) ;
 *  - MONTANTS à 2 points (`walls.ts:119`, `floors.ts:163`) : deux quads verticaux CROISÉS, dont la
 *    largeur arrive PAR LE MÊME CANAL que les épaisseurs (`FaceDepth` → `uprightCrossM`, authorée en
 *    mètres au catalogue) ; ces quads entrent dans le calcul coplanaire au même titre que les faces
 *    pleines (un bras de la croix est DANS le plan du panneau qu'il décore) ;
 *  - BIAIS COPLANAIRE : l'affine départage les faces empilées d'un même plan par l'ORDRE d'émission ;
 *    au GPU il faut une séparation métrique — rang d'émission × `COPLANAR_BIAS_M` le long de la normale.
 */
import { TW } from '../../../geometry/iso';
import type { Face, GP } from '../../builders/types';

/** Point MÉTRIQUE en repère three : X = est, Y = haut, Z = sud. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Polygone monde d'une face (≥ 2 points : un montant n'en a que 2). */
export type WorldPoly = Vec3[];
export type Tri = [Vec3, Vec3, Vec3];

/** Pixels ÉCRAN par mètre de la projection affine : une tuile (TW px de large en losange) mesure
 *  `mpt` mètres, sa demi-diagonale projetée vaut `TW·√½` px (`geometry/iso.ts:14`). */
export function pxPerM(mpt: number): number {
  return (TW * Math.SQRT1_2) / mpt;
}

/** Épaisseur (m) d'un volume dont l'appelant n'a rien résolu : AUCUNE. Ce module ne connaît pas les
 *  matériaux — les épaisseurs sont authorées en mètres au catalogue et arrivent par `FaceDepth`
 *  (`catalog/faceDepth.ts`). Un appelant sans résolveur obtient donc des PLANS, jamais une épaisseur devinée. */
const SANS_VOLUME = 0;

/** Séparation métrique d'un cran de rang coplanaire. */
export const COPLANAR_BIAS_M = 0.0015;

/** GP (tuiles + mètres) → point métrique three. */
export function gpToWorld(p: GP, mpt: number): Vec3 {
  return { x: p.x * mpt, y: p.h, z: p.y * mpt };
}

/** Polygone monde d'une face. */
export function facePoly(face: Face, mpt: number): WorldPoly {
  return face.poly.map((p) => gpToWorld(p, mpt));
}

/** Normale unitaire d'un polygone (Newell) ; null si < 3 points ou aire nulle. */
export function polyNormal(poly: WorldPoly): Vec3 | null {
  if (poly.length < 3) return null;
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    nx += (a.y - b.y) * (a.z + b.z);
    ny += (a.z - b.z) * (a.x + b.x);
    nz += (a.x - b.x) * (a.y + b.y);
  }
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-12) return null;
  return { x: nx / len, y: ny / len, z: nz / len };
}

/** CENTRE de la carte, en mètres et en repère three (X = est, Z = sud) : le repère dont la LOI
 *  D'ORIENTATION tire le DEHORS d'une surface ouverte verticale. */
export interface CentreCarte {
  x: number;
  z: number;
}

/** En deçà de cette composante verticale, une normale est tenue pour horizontale. */
const NORMALE_HORIZONTALE = 1e-6;

/** LOI D'ORIENTATION d'un polygone monde — UNIQUE définition du DEHORS, servie à la CUISSON
 *  (`sceneMeshes.ts:bakeWorldGeometry`, qui en tire le sens de parcours des triangles et la famille
 *  d'ombrage) comme à l'INSTRUMENT DE QC (`scripts/qc/lib/plancheVolumique.ts`, qui en tire son
 *  cull et sa teinte). Deux régimes, selon ce que la face DÉCLARE (`Face.oriented`) :
 *   - `oriented` : le sens de parcours PORTE déjà le dehors du volume (coquilles closes du décor
 *     volumique `builders/propVolumes.ts`, boîtes de mur) — il se propage tel quel ;
 *   - surface OUVERTE (sol, mur nu, toit, montant) : vers le HAUT si horizontale, vers l'EXTÉRIEUR de
 *     la carte si verticale.
 *  Un rendu en `DoubleSide` se moque du sens de parcours, mais la CARTE D'OMBRE non : le décalage de
 *  biais suit la normale, et une normale à l'envers pousse le receveur DANS son ombre.
 *  `normale` est la normale TELLE QUE LA LOI LA PRÉSENTE — retournée quand le parcours va à l'envers ;
 *  la normale géométrique nue ne porte de sens QUE sous le régime `oriented`. */
export function orienterPoly(
  poly: WorldPoly,
  oriented: boolean,
  centre: CentreCarte,
): { versLExterieur: boolean; normale: Vec3 | null } {
  const n = polyNormal(poly);
  const g = poly.reduce((s, p) => ({ x: s.x + p.x / poly.length, z: s.z + p.z / poly.length }), { x: 0, z: 0 });
  const dehors = n ? n.x * (g.x - centre.x) + n.z * (g.z - centre.z) : 0;
  const versLExterieur = oriented || !n ? true : Math.abs(n.y) > NORMALE_HORIZONTALE ? n.y > 0 : dehors >= 0;
  return { versLExterieur, normale: n && !versLExterieur ? { x: -n.x, y: -n.y, z: -n.z } : n };
}

/** FAMILLES D'ORIENTATION du modelé de forme (#1300) : les deux horizontales (`haut` = sol, toit,
 *  chant supérieur ; `bas` = soffite), et les quatre verticales NOMMÉES PAR LA DIRECTION QU'ELLES
 *  REGARDENT, dans l'ordre CYCLIQUE de la grille. */
export type ShadeFamily = 'haut' | 'bas' | '-z' | '+x' | '+z' | '-x';

/** L'ordre CYCLIQUE de la grille — l'index d'une verticale ici EST l'index de son facteur dans la
 *  donnée (`AMBIANCE.faceShade.verticales`), dont le schéma tient la décroissance stricte. Deux
 *  familles voisines dans ce cycle forment un ANGLE de la scène : c'est la paire qui doit se séparer.
 *  Le facteur d'irradiance de chaque famille est une lecture de CATALOGUE : il vit avec les autres
 *  (`faceColors.ts:shadeFactorOf`), ce module ne connaissant aucune donnée d'ambiance. */
export const SHADE_CYCLE: readonly ShadeFamily[] = ['-z', '+x', '+z', '-x'];

/** Famille d'une normale — l'axe DOMINANT décide, son signe nomme la famille. `null` pour une normale
 *  indéterminée (triangle dégénéré). Une pente à 45° compte pour horizontale : elle se marche.
 *  La normale attendue est celle que présente `orienterPoly` : lue avant elle, 100 % des triangles de
 *  sol (normale géométrique vers le bas) tomberaient en famille de soffite. */
export function shadeFamily(n: { x: number; y: number; z: number } | null): ShadeFamily | null {
  if (!n) return null;
  if (Math.abs(n.y) >= Math.max(Math.abs(n.x), Math.abs(n.z))) return n.y > 0 ? 'haut' : 'bas';
  return Math.abs(n.x) >= Math.abs(n.z) ? (n.x > 0 ? '+x' : '-x') : n.z > 0 ? '+z' : '-z';
}

/** Écart maximal (m) des sommets au plan moyen — 0 pour un polygone plan. INSTRUMENT DE GARDE, au même
 *  titre que `coplanarOverlapPairs` : avec `isConvex`, il mesure la PRÉCONDITION de `fanTriangles` sur
 *  les scènes-témoins (`worldTris.test.ts` : 0 face non-plane, 0 non-convexe). Aucun chemin de rendu ne
 *  l'appelle — c'est ce que mesure la garde, pas ce qu'elle décore. */
export function planarity(poly: WorldPoly): number {
  const n = polyNormal(poly);
  if (!n) return 0;
  const d = n.x * poly[0].x + n.y * poly[0].y + n.z * poly[0].z;
  let worst = 0;
  for (const p of poly) worst = Math.max(worst, Math.abs(n.x * p.x + n.y * p.y + n.z * p.z - d));
  return worst;
}

/** Convexe : tous les produits vectoriels d'arêtes consécutives pointent du même côté de la normale.
 *  INSTRUMENT DE GARDE, au même titre que `planarity` : avec lui, il mesure la PRÉCONDITION de
 *  `fanTriangles` sur les scènes-témoins (`worldTris.test.ts:79-99` : 0 face non-plane, 0 non-convexe).
 *  Aucun chemin de rendu ne l'appelle. */
export function isConvex(poly: WorldPoly): boolean {
  const n = polyNormal(poly);
  if (!n) return true;
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const c = poly[(i + 2) % poly.length];
    const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const v = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
    const cr = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x };
    const s = cr.x * n.x + cr.y * n.y + cr.z * n.z;
    if (Math.abs(s) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(s);
    else if (Math.sign(s) !== sign) return false;
  }
  return true;
}

/** Triangulation en ÉVENTAIL depuis le premier sommet. */
export function fanTriangles(poly: WorldPoly): Tri[] {
  const out: Tri[] = [];
  for (let i = 1; i + 1 < poly.length; i++) out.push([poly[0], poly[i], poly[i + 1]]);
  return out;
}

/** Les DEUX quads verticaux CROISÉS (X) centrés sur le segment [a,b], de largeur `wM` — la
 *  représentation volumique d'un montant que l'affine dessine en rectangle d'écran. */
export function crossQuadPolys(a: Vec3, b: Vec3, wM: number): WorldPoly[] {
  const h = wM / 2;
  const arms: Vec3[] = [{ x: h, y: 0, z: 0 }, { x: 0, y: 0, z: h }];
  return arms.map((e) => [
    { x: a.x - e.x, y: a.y - e.y, z: a.z - e.z },
    { x: a.x + e.x, y: a.y + e.y, z: a.z + e.z },
    { x: b.x + e.x, y: b.y + e.y, z: b.z + e.z },
    { x: b.x - e.x, y: b.y - e.y, z: b.z - e.z },
  ]);
}

/** PROFONDEUR MONDE (m) du volume d'une face, résolue par l'appelant depuis les catalogues d'apparence
 *  (`catalog/faceDepth.ts`) — ce module ne connaît aucun matériau. Pour un MONTANT (face à 2 points), c'est la
 *  LARGEUR de sa croix. `undefined` = rien de résolu : la face reste un PLAN (et un montant, un trait
 *  sans épaisseur). Une profondeur NULLE laisse elle aussi un plan unique, au plan médian. */
export type FaceDepth = (face: Face) => number | undefined;

/** Polygone DÉPLACÉ de `d` le long de `n`. */
function offsetPoly(poly: WorldPoly, n: Vec3, d: number): WorldPoly {
  return poly.map((p) => ({ x: p.x + n.x * d, y: p.y + n.y * d, z: p.z + n.z * d }));
}

/** Polygone parcouru à l'envers : sa normale (donc le sens du biais coplanaire) s'inverse. */
function reversePoly(poly: WorldPoly): WorldPoly {
  return [...poly].reverse();
}

/** BOÎTE MINCE (`tM`) centrée sur le plan vertical `poly` de normale `n` : les deux joues parallèles,
 *  la coiffe supérieure et les chants d'extrémité — une arête HORIZONTALE au point bas du polygone est
 *  omise (le dessous d'un mur ne se voit jamais). Chaque quad est réorienté vers le DEHORS de la boîte
 *  pour que le biais coplanaire pousse ses piles hors de la matière. */
export function wallBoxPolys(poly: WorldPoly, n: Vec3, tM: number): WorldPoly[] {
  const h = tM / 2;
  const front = offsetPoly(poly, n, h);
  const back = offsetPoly(poly, n, -h);
  const out: WorldPoly[] = [front, back];
  const yLo = Math.min(...poly.map((p) => p.y));
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (Math.abs(a.y - yLo) < 1e-9 && Math.abs(b.y - yLo) < 1e-9) continue;
    out.push([
      { x: a.x + n.x * h, y: a.y, z: a.z + n.z * h },
      { x: b.x + n.x * h, y: b.y, z: b.z + n.z * h },
      { x: b.x - n.x * h, y: b.y, z: b.z - n.z * h },
      { x: a.x - n.x * h, y: a.y, z: a.z - n.z * h },
    ]);
  }
  const c = polyBounds(out.flat());
  const mid = { x: (c.lo.x + c.hi.x) / 2, y: (c.lo.y + c.hi.y) / 2, z: (c.lo.z + c.hi.z) / 2 };
  return out.map((q) => {
    const qn = polyNormal(q);
    if (!qn) return q;
    const g = q.reduce((s, p) => ({ x: s.x + p.x / q.length, y: s.y + p.y / q.length, z: s.z + p.z / q.length }), { x: 0, y: 0, z: 0 });
    const dehors = qn.x * (g.x - mid.x) + qn.y * (g.y - mid.y) + qn.z * (g.z - mid.z);
    return dehors >= 0 ? q : reversePoly(q);
  });
}

/** Clé de PLAN arrondie au mm : normale CANONIQUE (première composante non nulle positive) + offset. */
function planeKey(poly: WorldPoly): string | null {
  const n = polyNormal(poly);
  if (!n) return null;
  const comps = [n.x, n.y, n.z];
  const lead = comps.find((c) => Math.abs(c) > 1e-9) ?? 1;
  const s = lead < 0 ? -1 : 1;
  const c = { x: n.x * s, y: n.y * s, z: n.z * s };
  const d = c.x * poly[0].x + c.y * poly[0].y + c.z * poly[0].z;
  const r = (v: number) => Math.round(v * 1000);
  return `${r(c.x)},${r(c.y)},${r(c.z)}|${r(d)}`;
}

/** Rang d'émission de chaque polygone parmi les faces de SON plan qui le RECOUVRENT (0 = rien dessous).
 *  Deux sols voisins partagent leur plan sans se recouvrir : tous deux au rang 0, aucun déplacement —
 *  seules les piles réelles (panneau/moulure/plinthe d'un mur, wedge sur son losange, jonction de deux
 *  éléments) se séparent. Un polygone sans plan (moins de 3 points, aire nulle) reçoit 0. La portée =
 *  la liste fournie, à passer à l'échelle de la SCÈNE (une pile peut enjamber deux éléments).
 *
 *  Le rang se cherche par BALAYAGE SPATIAL au sein de chaque plan (`ranksInPlane`), jamais contre tous
 *  les précédents : le plan du sol de l'arène porte 2 384 quads à lui seul (50×40), soit 2,8 millions de
 *  tests de boîtes pour une poignée de recouvrements réels — 475 ms des 532 ms de `bakeWorldGeometry`
 *  mesurés au banc (#1397). Le prédicat de recouvrement, lui, est INCHANGÉ : la grille ne fait que
 *  proposer un SUR-ENSEMBLE de candidats, que `boxesOverlap` tranche comme avant. */
export function coplanarRanks(polys: readonly WorldPoly[]): number[] {
  const ranks = new Array<number>(polys.length).fill(0);
  const groups = new Map<string, number[]>();
  polys.forEach((poly, i) => {
    const key = planeKey(poly);
    if (!key) return;
    const g = groups.get(key);
    if (g) g.push(i);
    else groups.set(key, [i]);
  });
  for (const idx of groups.values()) {
    const rangs = ranksInPlane(idx.map((i) => polyBounds(polys[i])));
    idx.forEach((i, k) => { ranks[i] = rangs[k]; });
  }
  return ranks;
}

/** Les trois axes, et les trois PAIRES d'axes dont `boxesOverlap` demande qu'une au moins recouvre. */
const AXES = ['x', 'y', 'z'] as const;
const PAIRES: readonly [number, number][] = [[0, 1], [0, 2], [1, 2]];

/** Au-delà de ce nombre de cases couvertes, une boîte n'est plus indexée : elle rejoint le lot des
 *  GROSSES, que chaque requête balaie de toute façon. Une dalle qui couvrirait la carte entière rendrait
 *  sinon la maille inutile (une case par mètre carré de scène).
 *  ANGLE MORT ASSUMÉ : un plan fait de N boîtes toutes hors maille retombe en O(N²), même si elles sont
 *  DISJOINTES — mesuré 192 ms à N = 4 000, rang max 0. Aucune scène du dépôt n'en approche (arène 20 ms,
 *  opéra 110 ms pour tous leurs plans réunis) ; une carte qui l'atteindrait demanderait une maille par
 *  plan plutôt qu'un lot à balayer. */
const CASES_MAX = 64;

/** Grille de hachage d'une PAIRE d'axes : les index déjà posés, par case, plus le lot des grosses. */
interface Grille {
  a: number;
  b: number;
  pasA: number;
  pasB: number;
  cases: Map<number, number[]>;
  grosses: number[];
}

/** Pas de maille d'un axe : la MÉDIANE des étendues non dégénérées — une tuile de sol pour un plancher,
 *  la hauteur d'une assise pour un mur. Aucune étendue (axe plat) : le pas n'a alors aucun office. */
function pasDeMaille(boxes: readonly Bounds[], a: number): number {
  const k = AXES[a];
  const ext = boxes.map((b) => b.hi[k] - b.lo[k]).filter((e) => e > RECOUVREMENT_MIN_M).sort((x, y) => x - y);
  return ext.length ? Math.max(ext[ext.length >> 1], RECOUVREMENT_MIN_M) : 1;
}

/** Case d'un point sur un axe de la grille. */
const caseDe = (v: number, pas: number): number => Math.floor(v / pas);

/** Clé de case — un ALIASING éventuel (deux cases lointaines dans le même seau) n'ajoute que des
 *  candidats : le prédicat exact les écarte ensuite. */
const cleCase = (ia: number, ib: number): number => ia * 1048576 + ib;

/** Étendue en cases d'une boîte sur la grille, ou `null` si elle en couvre trop (cf. `CASES_MAX`). */
function plage(g: Grille, box: Bounds): { a0: number; a1: number; b0: number; b1: number } | null {
  const a0 = caseDe(box.lo[AXES[g.a]], g.pasA);
  const a1 = caseDe(box.hi[AXES[g.a]], g.pasA);
  const b0 = caseDe(box.lo[AXES[g.b]], g.pasB);
  const b1 = caseDe(box.hi[AXES[g.b]], g.pasB);
  if ((a1 - a0 + 1) * (b1 - b0 + 1) > CASES_MAX) return null;
  return { a0, a1, b0, b1 };
}

/**
 * Rangs coplanaires des boîtes d'UN MÊME PLAN, dans leur ordre d'émission.
 *
 * `boxesOverlap` demande un recouvrement sur au moins DEUX des trois axes. Un axe dont AUCUNE boîte du
 * plan n'a d'étendue ne peut jamais recouvrir : le plan horizontal d'un sol (y plat) et le plan
 * d'arête d'un mur (x ou z plat) se ramènent donc à UNE paire d'axes, une seule grille. Un plan
 * OBLIQUE (pan de toit) garde ses trois axes vivants : les trois paires s'indexent, et l'union de leurs
 * candidats reste un sur-ensemble (deux boîtes qui recouvrent sur deux axes partagent une case dans la
 * grille de cette paire).
 */
function ranksInPlane(boxes: readonly Bounds[]): number[] {
  const n = boxes.length;
  const ranks = new Array<number>(n).fill(0);
  if (n < 2) return ranks;
  const vivants: number[] = [];
  for (let k = 0; k < 3; k++)
    if (boxes.some((b) => b.hi[AXES[k]] - b.lo[AXES[k]] > RECOUVREMENT_MIN_M)) vivants.push(k);
  if (vivants.length < 2) return ranks; // moins de deux axes recouvrables : aucune pile possible
  const paires = vivants.length === 2 ? [[vivants[0], vivants[1]] as [number, number]] : PAIRES;
  const grilles: Grille[] = paires.map(([a, b]) => ({
    a, b, pasA: pasDeMaille(boxes, a), pasB: pasDeMaille(boxes, b), cases: new Map(), grosses: [],
  }));
  const vus = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    let rang = 0;
    const examiner = (j: number): void => {
      if (vus[j] === i) return;
      vus[j] = i;
      if (boxesOverlap(boxes[j], boxes[i])) rang = Math.max(rang, ranks[j] + 1);
    };
    for (const g of grilles) {
      for (const j of g.grosses) examiner(j);
      const p = plage(g, boxes[i]);
      if (!p) { for (let j = 0; j < i; j++) examiner(j); continue; }
      for (let ia = p.a0; ia <= p.a1; ia++)
        for (let ib = p.b0; ib <= p.b1; ib++) {
          const seau = g.cases.get(cleCase(ia, ib));
          if (seau) for (const j of seau) examiner(j);
        }
    }
    ranks[i] = rang;
    for (const g of grilles) {
      const p = plage(g, boxes[i]);
      if (!p) { g.grosses.push(i); continue; }
      for (let ia = p.a0; ia <= p.a1; ia++)
        for (let ib = p.b0; ib <= p.b1; ib++) {
          const cle = cleCase(ia, ib);
          const seau = g.cases.get(cle);
          if (seau) seau.push(i);
          else g.cases.set(cle, [i]);
        }
    }
  }
  return ranks;
}

/** Polygone DÉPLACÉ de `rank × COPLANAR_BIAS_M` le long de SA normale (l'ordre de peinture affine
 *  devient une séparation métrique). Un montant est rendu tel quel. */
export function biasPoly(poly: WorldPoly, rank: number): WorldPoly {
  const n = polyNormal(poly);
  if (!n || rank === 0) return poly;
  const d = rank * COPLANAR_BIAS_M;
  return poly.map((p) => ({ x: p.x + n.x * d, y: p.y + n.y * d, z: p.z + n.z * d }));
}

/** Boîte englobante monde d'un polygone. */
export interface Bounds {
  lo: Vec3;
  hi: Vec3;
}
export function polyBounds(poly: WorldPoly): Bounds {
  const lo = { x: Infinity, y: Infinity, z: Infinity };
  const hi = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of poly) {
    lo.x = Math.min(lo.x, p.x); lo.y = Math.min(lo.y, p.y); lo.z = Math.min(lo.z, p.z);
    hi.x = Math.max(hi.x, p.x); hi.y = Math.max(hi.y, p.y); hi.z = Math.max(hi.z, p.z);
  }
  return { lo, hi };
}

/** Recouvrement MINIMAL (m) qui compte sur un axe — sous lui, deux boîtes se touchent, elles ne se
 *  recouvrent pas. C'est aussi le seuil qui décide qu'un axe est PLAT pour un plan (`ranksInPlane`). */
const RECOUVREMENT_MIN_M = 1e-6;

/** Deux boîtes se RECOUVRENT si elles s'intersectent sur ≥ 2 axes (dans un plan, le 3ᵉ est dégénéré). */
export function boxesOverlap(a: Bounds, b: Bounds): boolean {
  let axes = 0;
  for (const k of AXES)
    if (Math.min(a.hi[k], b.hi[k]) - Math.max(a.lo[k], b.lo[k]) > RECOUVREMENT_MIN_M) axes++;
  return axes >= 2;
}

/** Paires de polygones COPLANAIRES (même plan au mm) dont les boîtes se recouvrent sur ≥ 2 axes :
 *  la mesure du z-fighting. Instrument de la garde autant que du diagnostic. */
export function coplanarOverlapPairs(polys: readonly WorldPoly[]): [number, number][] {
  const groups = new Map<string, number[]>();
  polys.forEach((poly, i) => {
    const key = planeKey(poly);
    if (!key) return;
    const g = groups.get(key);
    if (g) g.push(i);
    else groups.set(key, [i]);
  });
  const pairs: [number, number][] = [];
  for (const idx of groups.values()) {
    const boxes = idx.map((i) => polyBounds(polys[i]));
    for (let a = 0; a < idx.length; a++)
      for (let b = a + 1; b < idx.length; b++)
        if (boxesOverlap(boxes[a], boxes[b])) pairs.push([idx[a], idx[b]]);
  }
  return pairs;
}

/** Géométrie GPU d'une face : ses triangles et leurs DEUX jeux d'UV, sa normale, son rang coplanaire. */
export interface FaceGeom {
  /** UV PLANAIRES MONDE (mètres) des 3 sommets de chaque triangle, dans le plan de SON quad — de quoi
   *  répéter une texture à l'échelle métrique, continue d'un quad à l'autre du même plan. */
  uv: [UV, UV, UV][];
  /** UV NORMALISÉES [0,1]² de la FACE d'origine des 3 sommets de chaque triangle — de quoi cuire un
   *  ornement calé sur la face (colombage, accents), quel que soit le volume qu'elle a engendré. */
  uv1: [UV, UV, UV][];
  tris: Tri[];
  normal: Vec3 | null;
  rank: number;
  /** Le sens de parcours des triangles porte déjà le DEHORS (cf. `faceQuadsOriented`). */
  oriented: boolean;
}

/** Quads d'une face soumis au biais coplanaire : le polygone lui-même, ou les DEUX quads croisés d'un
 *  montant (2 points), ou la BOÎTE MINCE de toute face VERTICALE à qui l'appelant a résolu une
 *  profondeur. Un bras de la croix d'un montant est EXACTEMENT dans le plan du
 *  panneau qu'il décore : il entre donc dans le rang coplanaire comme une face pleine (mesuré sur
 *  `arene` : 388 paires montant↔montant + 2 607 paires montant↔face pleine, invisibles tant que les
 *  montants étaient exclus). */
export function faceQuads(face: Face, mpt: number, depthM?: number): WorldPoly[] {
  return faceQuadsOriented(face, mpt, depthM).quads;
}

/** Quads d'une face + le drapeau `oriented` : `true` quand le sens de parcours des quads PORTE déjà une
 *  information (chaque quad regarde le DEHORS de la boîte qui vient d'être fabriquée), `false` quand la
 *  face est rendue telle que le pivot l'a authorée (aucune convention de sens) et qu'il revient au
 *  consommateur de l'orienter.
 *
 *  UNE forme, deux familles de matière (`catalog/structures` `wallPartRelief`) : une partie POSÉE devant
 *  la matière pleine (panneau, moulure, plinthe…) comme une partie qui BOUCHE une ouverture (vantail,
 *  herse, gravats — le pivot n'émet AUCUNE face derrière elles) deviennent la MÊME boîte centrée sur le
 *  plan médian du mur. Centrée, parce qu'une `Face` de mur ne porte AUCUNE notion de joue intérieure ou
 *  extérieure (`builders/walls.ts` ne renseigne jamais `face.side`) : il n'y a pas de côté à choisir, un
 *  seul volume est visible des deux bords. Profondeur NULLE ⇒ plan unique au médian, et le sens rendu
 *  est celui que la FACE déclare (`Face.oriented`) : une face qui ferme déjà un volume (décor
 *  volumique) porte son dehors dans son parcours, une face qui n'en déclare aucun n'a pas de sens à
 *  propager — il serait arbitraire, et la carte d'ombre le suivrait. */
export function faceQuadsOriented(face: Face, mpt: number, depthM?: number): { quads: WorldPoly[]; oriented: boolean } {
  const poly = facePoly(face, mpt);
  // Un MONTANT n'est pas un polygone : ses deux quads croisés sont fabriqués ici, aucun sens d'auteur
  // ne les précède.
  if (poly.length === 2)
    return { quads: crossQuadPolys(poly[0], poly[1], depthM ?? SANS_VOLUME), oriented: false };
  const porté = face.oriented;
  const n = polyNormal(poly);
  if (!n || Math.abs(n.y) > 1e-6) return { quads: [poly], oriented: porté }; // seul un plan VERTICAL a une épaisseur d'arête
  const t = depthM ?? SANS_VOLUME;
  if (t <= 0) return { quads: [poly], oriented: porté };
  return { quads: wallBoxPolys(poly, n, t), oriented: true };
}

// ————————————————————————————————————————————————————————————————
// UV — deux jeux : la MAILLE du monde (mètres) et la FACE d'origine ([0,1]²)
// ————————————————————————————————————————————————————————————————

/** Coordonnée de texture d'un sommet. */
export interface UV {
  u: number;
  v: number;
}

/** Repère orthonormé d'un plan. */
export interface PlanarFrame {
  eu: Vec3;
  ev: Vec3;
}

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

/** Repère PLANAIRE d'un plan de normale `n`, ancré à l'ORIGINE DU MONDE (jamais au quad) : deux quads
 *  coplanaires — deux dalles de sol voisines, deux tronçons d'un même mur, une face et sa copie de joue —
 *  reçoivent des UV qui se raccordent, sans couture au joint ni motif qui redémarre.
 *  Plan HORIZONTAL (ou normale indéterminée) : u = est, v = sud. Sinon : u = l'horizontale du plan
 *  (`up × n`), v descend (composante y ≤ 0), comme la convention de face des recettes de détail. */
export function planarFrame(n: Vec3 | null): PlanarFrame {
  if (!n || Math.abs(n.y) > 1 - 1e-9) return { eu: { x: 1, y: 0, z: 0 }, ev: { x: 0, y: 0, z: 1 } };
  const len = Math.hypot(n.z, n.x);
  const eu = { x: n.z / len, y: 0, z: -n.x / len };
  const ev = cross(n, eu);
  return { eu, ev: ev.y > 0 ? { x: -ev.x, y: -ev.y, z: -ev.z } : ev };
}

/** UV PLANAIRES MONDE d'un point, en MÈTRES : sa projection sur les deux axes du repère du plan.
 *  L'application est une ISOMÉTRIE du plan — deux sommets distants d'un mètre le sont dans l'UV. Un
 *  déplacement le long de la normale (biais coplanaire, joue de mur) ne la change pas. */
export function planarUV(p: Vec3, f: PlanarFrame): UV {
  return { u: dot(p, f.eu), v: dot(p, f.ev) };
}

/** Cadre d'une FACE dans son propre plan : le repère planaire + l'emprise de la face, de quoi
 *  normaliser un point en [0,1]². Une emprise dégénérée (face à 2 points : montant) vaut 1 — la
 *  division reste finie et l'UV se rabat sur le bord. */
export interface FaceUvFrame extends PlanarFrame {
  u0: number;
  v0: number;
  du: number;
  dv: number;
}

export function faceUvFrame(poly: WorldPoly): FaceUvFrame {
  const f = planarFrame(polyNormal(poly));
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const p of poly) {
    const uv = planarUV(p, f);
    u0 = Math.min(u0, uv.u); u1 = Math.max(u1, uv.u);
    v0 = Math.min(v0, uv.v); v1 = Math.max(v1, uv.v);
  }
  if (!poly.length) return { ...f, u0: 0, v0: 0, du: 1, dv: 1 };
  return { ...f, u0, v0, du: u1 - u0 > 1e-9 ? u1 - u0 : 1, dv: v1 - v0 > 1e-9 ? v1 - v0 : 1 };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** UV NORMALISÉES [0,1]² d'un point dans le cadre de la face — u le long de la face, v du HAUT (0) vers
 *  le BAS (1), la convention des `DetailRecipe`. Un point hors de l'emprise (bras d'une croix de
 *  montant, chant d'une boîte de mur qui déborde du plan de face) se rabat sur le bord. */
export function faceUv1(p: Vec3, f: FaceUvFrame): UV {
  const uv = planarUV(p, f);
  return { u: clamp01((uv.u - f.u0) / f.du), v: clamp01((uv.v - f.v0) / f.dv) };
}

/** Faces → triangles monde, biais coplanaire appliqué, montants développés en croix et faces verticales
 *  développées en boîtes minces à la profondeur que `depthOf` leur résout. Le RANG se calcule
 *  sur la liste FOURNIE (cf. `coplanarRanks` : la porter à l'échelle de la scène), quads de montants
 *  compris. Le `rank` rendu pour un montant est le PLUS HAUT de ses deux quads. */
export function facesGeometry(faces: readonly Face[], mpt: number, depthOf?: FaceDepth): FaceGeom[] {
  const parts = faces.map((f) => faceQuadsOriented(f, mpt, depthOf?.(f)));
  const ranks = coplanarRanks(parts.flatMap((p) => p.quads));
  const out: FaceGeom[] = [];
  let k = 0;
  faces.forEach((face, i) => {
    const { quads: qs, oriented } = parts[i];
    const faceFrame = faceUvFrame(facePoly(face, mpt));
    const tris: Tri[] = [];
    const uv: [UV, UV, UV][] = [];
    const uv1: [UV, UV, UV][] = [];
    let rank = 0;
    let normal: Vec3 | null = null;
    for (const q of qs) {
      const r = ranks[k++];
      rank = Math.max(rank, r);
      const biased = biasPoly(q, r);
      if (qs.length === 1) normal = polyNormal(biased); // une croix de montant n'a pas UNE normale
      const quadFrame = planarFrame(polyNormal(biased)); // chaque quad porte SA maille de monde
      for (const tri of fanTriangles(biased)) {
        tris.push(tri);
        uv.push(tri.map((p) => planarUV(p, quadFrame)) as [UV, UV, UV]);
        uv1.push(tri.map((p) => faceUv1(p, faceFrame)) as [UV, UV, UV]);
      }
    }
    out.push({ tris, uv, uv1, normal, rank, oriented });
  });
  return out;
}
