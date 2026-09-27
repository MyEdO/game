/**
 * BUILDER de TOITS — produit les éléments `roof` du pivot (cf. ./types) en PANS CONTINUS, DÉRIVÉS
 * d'une MASSE de bâtiment (#823 : remplace le toit authoré à la main — rectangles+axe+égout+pente
 * écrits par l'auteur). L'auteur ne déclare que l'INTENTION (`BuildingMass` : emprise, niveaux,
 * profil, pente en DEGRÉS, matériau) ; la géométrie entière (pans, faîte, noues, croupes, pignons) se
 * DÉRIVE d'une formule UNIQUE :
 *   `hauteur(case) = hauteurÉgout + distance(case, bord de la masse) × métresParCase × tan(pente)`
 * — `hip` mesure la distance dans TOUTES les directions (BFS 4-connexe depuis le bord de l'emprise
 * RÉELLE, pas sa boîte englobante : noues aux angles rentrants, croupes aux angles sortants,
 * AUTOMATIQUEMENT, y compris sur un corps en L) ; `gable`/`shed` mesurent la distance UNIQUEMENT
 * perpendiculairement à l'axe de faîtage (portée LOCALE par tranche le long du faîtage — une jupe plus
 * étroite qu'une aile voisine obtient sa propre portée). La distance se mesure sur le DOMAINE du
 * GROUPE DE NAPPE (`resolveNappes` : masses d'un même corps, même `z`, même égout mesuré, cellules
 * 4-adjacentes), qui vaut l'emprise de la masse dès qu'elle est seule — au joint de deux masses d'un
 * groupe, le versant continue au lieu de retomber deux fois à l'égout.
 *
 * Les cellules coplanaires ADJACENTES fusionnent en UN polygone de pan, et les cellules-SELLES (non
 * planes, aux arêtiers/noues diagonaux) sont SCINDÉES en 2 triangles le long de la diagonale de crête,
 * chaque triangle rejoignant le pan de son côté → arêtiers nets, UNE teinte par pan. Expose aussi les
 * LIGNES sémantiques (faîte, arêtiers, égout, rangs de tuiles espacés le long de la pente) et les
 * VÉRITÉS DE SCÈNE (visible, roofOccupied — cutaway). PUR et projection-agnostique : géométrie en
 * unités de GRILLE + MÈTRES (`GP`).
 *
 * Une nappe à VERSANTS DROITS (`gable`, `shed`) émet aussi ses FERMETURES DE COMBLE (`gableEnds`) —
 * une croupe (`hip`) n'en a aucune, ses rampants rejoignent déjà chaque bord. Ce sont des
 * pièces de la NAPPE — même `rule` de dégagement que ses pans, donc jamais un pignon qui reste quand
 * son toit part — dont la MATIÈRE est celle du MUR qu'elles prolongent (`closureAppearance`, face
 * `domain:'structure'`). C'est pourquoi ce module tient aussi l'indexation des murs et des façades
 * authorées (`edgeKey`/`facadeEdges`/`edgeAppearance`/`WALL_NB`), SOURCE UNIQUE relue par `walls.ts`.
 */
import { heightAt, sceneMetresPerTile, type ArchitectureBody, type ArchitectureRect, type BuildingMass, type Scene, type WallSeg, type WallSide } from '../../state/scene';
import { sceneZoneTiles } from '../../state/zones';
import { memoByRef } from '../../state/sceneMemo';
import { edgeKey, facadeEdges, type FacadeEdge } from '../../state/facadeEdges';
import { apparenceDeclaree } from '../../state/formeArete';
import { aretesA } from '../../state/wallIndex';
import { effectiveArchitecture, fittedPitchDeg, localCrossSpans, toitureEffective } from '../../state/sceneEdit';
import { roofMaterial } from '../catalog/roofs';
import { buildingsMeta } from '../../state/buildings';
import { facadeStructureAppearance, facadeWallFeatureAppearance } from '../catalog/facades';
import { wallApp, type StructureAppearanceDef } from '../catalog/structures';
import { WALL_H_M, isoPxToM } from '../iso';
import { interiorZoneTilesById, occupiedInteriorZoneIds } from '../stage/roomFocus';
import { cutawayForSection, type ClearedSpace } from '../stage/architectureVisibility';
import type { CellSide, Face, GP, RoofEl, RoofLine, RoofLineKind } from './types';
import { viewedBuilder, type Viewed, type ViewRule } from './viewTruth';

/** Le nom PEINT sur le plan pour une pièce de nappe (`authoring/roofsSvg`) : le libellé authoré du
 *  corps, sinon celui de son TYPE de bâtiment (`buildings.json`), sinon son id technique. */
function bodyLabel(body: ArchitectureBody): string {
  return body.label ?? (body.style === undefined ? undefined : buildingsMeta()[body.style]?.label) ?? body.id;
}

/** Montée de la nappe par CRAN de profondeur d'avant-toit (17 px-iso), en mètres — une seule
 *  vérité px⇔m (`isoPxToM`). Les rangs de tuiles se comptent PAR cran, et le débord de soffite y lit
 *  sa chute (`RoofMaterialDef.eaveOverhangM`). */
export const ROOF_SLOPE_M = isoPxToM(17);

/** Rangs de tuiles PAR CRAN de montée, dérivés du PAS MÉTRIQUE de la recette du matériau
 *  (`detail.courses.hM` — SOURCE UNIQUE de l'espacement, partagée builder ↔ backend toits) ; un
 *  matériau sans recette d'assises ne porte aucun rang. */
export function roofCoursesPerStep(det?: { courses?: { hM: number } }): number | undefined {
  const hM = det?.courses?.hM;
  return hM ? Math.max(1, Math.round(ROOF_SLOPE_M / hM)) : undefined;
}

const EPS = 1e-9;

/** VOLUME de l'avant-toit (Lot 3) piloté par la DONNÉE matériau (`RoofMaterialDef`) : `overhang` = run du
 *  soffite au-delà de l'égout, en CASES (drop = `overhang × ROOF_SLOPE_M`, coplanaire au pan) ; `fasciaDrop`
 *  = hauteur (m) de la planche de rive verticale (0 ⇒ pas de fascia). Les TONS (soffite/fascia) restent au
 *  backend — le builder ne produit que la GÉOMÉTRIE (faces `part:'soffite'`/`'fascia'`). */
export interface EaveSpec {
  overhang: number;
  fasciaDrop: number;
}

/** Forme RÉSOLUE (jamais l'authoring brut) : `ridge` toujours tranché (défaut = long axe appliqué par
 *  l'appelant), `pitch` toujours en MÈTRES PAR CASE de distance (dérivé de l'angle authoré × échelle de
 *  scène par l'appelant — `roofPans` ne connaît que la géométrie, jamais les degrés). `eaveSide` ne sert
 *  qu'à `shed` (côté d'égout bas déclaré, sans défaut deviné). */
export interface RoofShapeSpec {
  profile: 'gable' | 'hip' | 'shed' | 'flat';
  ridge: 'x' | 'y';
  pitch: number;
  eaveHeightM: number;
  eaveSide?: 'N' | 'E' | 'S' | 'O';
}

type VXY = { x: number; y: number };
const vk = (x: number, y: number) => `${x},${y}`;

/** Cellules d'un rectangle d'emprise (répété pour chaque MASSE de `footprint`). */
function rectCells(foot: ArchitectureRect): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let y = foot.y; y < foot.y + foot.h; y++)
    for (let x = foot.x; x < foot.x + foot.w; x++) cells.push({ x, y });
  return cells;
}

/** Union des rectangles d'une masse en un ensemble de cellules (clés « x,y »). */
export function massFootprintCells(footprint: readonly ArchitectureRect[]): Set<string> {
  const out = new Set<string>();
  for (const rect of footprint) for (const c of rectCells(rect)) out.add(vk(c.x, c.y));
  return out;
}

/** Axe de faîtage RÉSOLU : celui authoré, sinon le LONG axe de l'emprise réelle (jamais sa boîte
 *  englobante seule — mais bbox et emprise coïncident sur l'axe qui compte ici). Une masse carrée sans
 *  `ridge` authoré est refusée EN AMONT (`validateBuildingMasses`, `state/mapSpec.ts`) : ce repli 'x' ne
 *  sert qu'à ne jamais planter sur une donnée déjà validée. */
export function resolveMassRidge(mass: Pick<BuildingMass, 'ridge'>, cells: ReadonlySet<string>): 'x' | 'y' {
  if (mass.ridge) return mass.ridge;
  const coords = [...cells].map((k) => k.split(',').map(Number) as [number, number]);
  const w = Math.max(...coords.map(([x]) => x)) - Math.min(...coords.map(([x]) => x));
  const h = Math.max(...coords.map(([, y]) => y)) - Math.min(...coords.map(([, y]) => y));
  return w >= h ? 'x' : 'y';
}

// ── Dérivation de HAUTEUR : une seule formule, trois lectures de « distance au bord » ────────────────
type Dir = readonly [number, number];
const ALL4: Dir[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function vertsOfCells(cells: ReadonlySet<string>) {
  const has = (x: number, y: number) => cells.has(vk(x, y));
  const verts = new Map<string, VXY>();
  for (const k of cells) {
    const [x, y] = k.split(',').map(Number);
    for (const v of [{ x, y }, { x: x + 1, y }, { x, y: y + 1 }, { x: x + 1, y: y + 1 }]) verts.set(vk(v.x, v.y), v);
  }
  const inner = (v: VXY) => has(v.x - 1, v.y - 1) && has(v.x, v.y - 1) && has(v.x - 1, v.y) && has(v.x, v.y);
  return { verts, inner };
}

/** `hip` — profondeur BFS 4-connexe depuis le BORD de `cells` : distance de Manhattan au bord dans
 *  TOUTES les directions. Sur un corps en L, les vertex du coin RENTRANT sont à profondeur 0 comme
 *  ceux du bord — la triangulation par SELLE (plus bas) y ouvre la NOUE toute seule ; les coins
 *  SORTANTS convergent en croupe. Générale, ne suppose AUCUNE forme rectangulaire.
 *
 *  `eaveSegs` RESTREINT les amorces à un sous-ensemble du bord : les sommets qui ne touchent aucun
 *  de ces segments montent avec l'intérieur au lieu de retomber à l'égout. C'est ainsi qu'un champ
 *  de nappe porte une extrémité FERMÉE (pignon) — le versant y arrive à pleine hauteur et
 *  `gableEnds` le referme. Absent ⇒ tout le bord amorce (croupe pure). */
function bfsDepth(cells: ReadonlySet<string>, eaveSegs?: readonly BoundarySeg[]): Map<string, number> {
  const { verts, inner } = vertsOfCells(cells);
  const dep = new Map<string, number>();
  const queue: VXY[] = [];
  const seeds = eaveSegs && new Set(eaveSegs.flatMap((s) => [vk(s.x0, s.y0), vk(s.x1, s.y1)]));
  const isSeed = (v: VXY) => (seeds ? seeds.has(vk(v.x, v.y)) : !inner(v));
  for (const v of verts.values()) if (isSeed(v)) { dep.set(vk(v.x, v.y), 0); queue.push(v); }
  for (let i = 0; i < queue.length; i++) {
    const v = queue[i];
    const d = dep.get(vk(v.x, v.y))!;
    for (const [dx, dy] of ALL4) {
      const nx = v.x + dx, ny = v.y + dy, nk = vk(nx, ny);
      if (verts.has(nk) && !dep.has(nk)) { dep.set(nk, d + 1); queue.push({ x: nx, y: ny }); }
    }
  }
  return dep;
}

/** Arête de BORD de l'emprise : le côté d'une case dont la voisine est DEHORS. C'est la ligne
 *  d'égout, celle d'où la nappe monte. */
interface BoundarySeg { x0: number; y0: number; x1: number; y1: number }

/** Arêtes de BORD d'une emprise quelconque (L, U, anneau — chacune de leurs lignes d'égout). */
export function boundarySegs(cells: ReadonlySet<string>): BoundarySeg[] {
  const segs: BoundarySeg[] = [];
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    if (!cells.has(vk(x, y - 1))) segs.push({ x0: x, y0: y, x1: x + 1, y1: y });
    if (!cells.has(vk(x, y + 1))) segs.push({ x0: x, y0: y + 1, x1: x + 1, y1: y + 1 });
    if (!cells.has(vk(x - 1, y))) segs.push({ x0: x, y0: y, x1: x, y1: y + 1 });
    if (!cells.has(vk(x + 1, y))) segs.push({ x0: x + 1, y0: y, x1: x + 1, y1: y + 1 });
  }
  return segs;
}

/** Profondeur (en cases) d'un point QUELCONQUE sous une croupe : sa distance de Manhattan à la ligne
 *  d'égout la plus proche. Aux sommets ENTIERS elle vaut exactement la profondeur `bfsDepth` (garde
 *  `roofs.test.ts`) ; elle ÉTEND la même lecture aux points intermédiaires — ceux que le pavage
 *  insère quand le faîtage tombe entre deux sommets de grille. Elle remplace la lecture par boîte
 *  englobante, qui ne valait que pour une emprise rectangulaire. */
export function depthToEave(v: VXY, segs: readonly BoundarySeg[]): number {
  let best = Infinity;
  for (const s of segs) {
    const dx = s.x0 === s.x1 ? Math.abs(v.x - s.x0) : Math.max(0, s.x0 - v.x, v.x - s.x1);
    const dy = s.y0 === s.y1 ? Math.abs(v.y - s.y0) : Math.max(0, s.y0 - v.y, v.y - s.y1);
    best = Math.min(best, dx + dy);
  }
  return best;
}

/** Portée locale ENCADRANT un sommet de grille `v` : union des tranches de part et d'autre (`along−1`,
 *  `along`) — un sommet est le coin de deux tranches, sa montée se lit sur la plus enveloppante. */
function crossSpanAt(v: VXY, rows: Map<number, { lo: number; hi: number }>, axis: 'x' | 'y'): { lo: number; hi: number } {
  // Un sommet ENTIER est le coin de deux tranches (`along-1`, `along`) ; un point INTERMÉDIAIRE
  // n'appartient qu'à la sienne — `ceil-1`/`floor` rendent l'une et l'autre sans cas particulier.
  const along = axis === 'x' ? v.x : v.y;
  const cands = [rows.get(Math.ceil(along) - 1), rows.get(Math.floor(along))]
    .filter((r): r is { lo: number; hi: number } => !!r);
  return { lo: Math.min(...cands.map((r) => r.lo)), hi: Math.max(...cands.map((r) => r.hi)) };
}

/** Montée (m) d'un sommet de grille `v` pour l'emprise `cells` — LA formule (doc de tête), lue selon le
 *  profil : `hip` = BFS toutes directions ; `gable` = portée locale ⊥ `ridge`, DEUX côtés ; `shed` =
 *  portée locale ⊥ à l'axe d'égout déclaré, UN SEUL côté (0 à l'égout, montée vers l'intérieur) ; `flat`
 *  = 0 partout. SOURCE UNIQUE — `roofPans` (pavage), `gableEnds` (pignons) et `walls.ts` (jointures de
 *  toit, #819) y passent tous. */
export function riseAt(v: VXY, cells: ReadonlySet<string>, shape: RoofShapeSpec, cache?: { dep?: Map<string, number>; rows?: Map<number, { lo: number; hi: number }>; segs?: readonly BoundarySeg[] }): number {
  if (shape.profile === 'flat') return 0;
  if (shape.profile === 'hip') {
    const dep = cache?.dep ?? bfsDepth(cells);
    const key = vk(v.x, v.y);
    if (dep.has(key)) return dep.get(key)! * shape.pitch;
    // Point INTERMÉDIAIRE (coordonnée fractionnaire — sommet inséré par le pavage : arêtier RW/RE du
    // cas rectangulaire, demi-pas d'une portée impaire) : la MÊME profondeur, lue en continu.
    return depthToEave(v, cache?.segs ?? boundarySegs(cells)) * shape.pitch;
  }
  if (shape.profile === 'gable') {
    const rows = cache?.rows ?? localCrossSpans(cells, shape.ridge);
    const { lo, hi } = crossSpanAt(v, rows, shape.ridge);
    const cross = shape.ridge === 'x' ? v.y : v.x;
    return Math.min(cross - lo, hi - cross) * shape.pitch;
  }
  // shed : l'axe croisé est celui perpendiculaire au côté d'égout déclaré (N/S ⇒ axe 'x', E/O ⇒ 'y').
  const axis: 'x' | 'y' = shape.eaveSide === 'N' || shape.eaveSide === 'S' ? 'x' : 'y';
  const rows = cache?.rows ?? localCrossSpans(cells, axis);
  const { lo, hi } = crossSpanAt(v, rows, axis);
  const cross = axis === 'x' ? v.y : v.x;
  const lowIsSmallSide = shape.eaveSide === 'N' || shape.eaveSide === 'O';
  return (lowIsSmallSide ? cross - lo : hi - cross) * shape.pitch;
}

/** CHAMP DE HAUTEUR d'une nappe : le DOMAINE sur lequel la hauteur se lit, la forme qui la lit, et le
 *  cache de la lecture. Le domaine est DISTINCT des cellules qu'une masse PAVE : plusieurs masses
 *  d'un même groupe de nappe (`resolveNappes`) émettent chacune leurs pans sur LEURS cellules en
 *  lisant le MÊME champ — au joint, le versant continue et le BFS ouvre la noue. Domaine = cellules
 *  de la masse ⇒ le champ est exactement `riseAt(v, cells, shape)`. */
export interface RoofField {
  domain: ReadonlySet<string>;
  shape: RoofShapeSpec;
  cache: { dep?: Map<string, number>; rows?: Map<number, { lo: number; hi: number }>; segs?: readonly BoundarySeg[] };
}

/** Champ d'un domaine + d'une forme. `eaveSegs` (profil `hip`) restreint les amorces d'égout — les
 *  bords qui n'y sont pas portent une extrémité fermée (cf. `bfsDepth`). */
function roofField(domain: ReadonlySet<string>, shape: RoofShapeSpec, eaveSegs?: readonly BoundarySeg[]): RoofField {
  if (shape.profile === 'hip') {
    const segs = eaveSegs ?? boundarySegs(domain);
    return { domain, shape, cache: { dep: bfsDepth(domain, eaveSegs), segs } };
  }
  if (shape.profile === 'gable') return { domain, shape, cache: { rows: localCrossSpans(domain, shape.ridge) } };
  if (shape.profile === 'shed')
    return { domain, shape, cache: { rows: localCrossSpans(domain, shape.eaveSide === 'N' || shape.eaveSide === 'S' ? 'x' : 'y') } };
  return { domain, shape, cache: {} };
}

/** Hauteur (m) d'un point de grille DANS un champ — LA lecture unique des consommateurs de hauteur
 *  de toit (pavage, pignons, joints de nappes `walls.ts`, ornements de faîte `props.ts`). */
export function fieldHeightAt(field: RoofField, v: VXY): number {
  return field.shape.eaveHeightM + riseAt(v, field.domain, field.shape, field.cache);
}

export interface RoofPanGeometry {
  id: string;
  face: Face;
  faces: Face[];
  lines: RoofLine[];
}

/** Pièce PLANE du pavage (quad de cellule coplanaire, ou triangle issu d'une selle), sommets en ordre
 *  HORAIRE grille + gradient du plan (montée par +x / +y). */
interface Piece {
  pts: VXY[];
  gx: number;
  gy: number;
}

/** Orientation de la pente DESCENDANTE d'un plan (teinte du pan) : gx>0 : monte vers +x ⇒ descend
 *  vers l'ouest ; plat ⇒ 'N'. */
const partOf = (gx: number, gy: number): CellSide =>
  Math.abs(gx) >= Math.abs(gy) ? (gx > EPS ? 'O' : gx < -EPS ? 'E' : 'N') : gy > 0 ? 'N' : 'S';

/** Gradient du plan passant par 3 points (hauteurs comprises) — exact, det ≠ 0 (triangles de grille). */
function grad3(p0: VXY & { h: number }, p1: VXY & { h: number }, p2: VXY & { h: number }): { gx: number; gy: number } {
  const ux = p1.x - p0.x, uy = p1.y - p0.y, uh = p1.h - p0.h;
  const vx = p2.x - p0.x, vy = p2.y - p0.y, vh = p2.h - p0.h;
  const det = ux * vy - uy * vx;
  return { gx: (uh * vy - uy * vh) / det, gy: (ux * vh - uh * vx) / det };
}

/** Retire les sommets intermédiaires COLINÉAIRES d'une boucle (une arête d'égout de 4 crans devient un
 *  seul côté ; `h` suit automatiquement, linéaire sur le plan du pan). */
function simplifyLoop(loop: VXY[]): VXY[] {
  const n = loop.length;
  const out: VXY[] = [];
  for (let i = 0; i < n; i++) {
    const p = loop[(i + n - 1) % n], c = loop[i], q = loop[(i + 1) % n];
    const ax = c.x - p.x, ay = c.y - p.y, bx = q.x - c.x, by = q.y - c.y;
    if (ax * by - ay * bx !== 0 || ax * bx + ay * by <= 0) out.push(c);
  }
  return out;
}

type VXYH = VXY & { h: number };

/** Fusionne les segments COLINÉAIRES 3D CONTIGUS de même nature (sommets de grille entiers) : un faîte
 *  de 3 cellules ou un égout de façade = UNE ligne. La colinéarité se vérifie AUSSI en HAUTEUR (même
 *  pente h le long de la droite porteuse) : deux arêtiers opposés qui se rejoignent à l'apex d'une
 *  pyramide — ou à la noue d'un coin rentrant — partagent la même droite xy mais leur h est en CHEVRON
 *  → ils restent DEUX lignes (coin→apex chacun). */
function mergeSegs(segs: { a: VXYH; b: VXYH; kind: RoofLineKind }[]): { a: VXYH; b: VXYH; kind: RoofLineKind }[] {
  const buckets = new Map<string, { t0: number; t1: number; a: VXYH; b: VXYH; kind: RoofLineKind }[]>();
  for (const s of segs) {
    let { a, b } = s;
    let dx = b.x - a.x, dy = b.y - a.y;
    if (dx < 0 || (dx === 0 && dy < 0)) { [a, b] = [b, a]; dx = -dx; dy = -dy; }
    const g = Math.abs(gcd(dx, dy)) || 1;
    const ux = dx / g, uy = dy / g;
    const key = `${s.kind}|${ux},${uy}|${a.x * uy - a.y * ux}`; // nature + direction + droite porteuse
    const t = (p: VXY) => p.x * ux + p.y * uy;
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push({ t0: t(a), t1: t(b), a, b, kind: s.kind });
  }
  const slope = (s: { t0: number; t1: number; a: VXYH; b: VXYH }) => (s.b.h - s.a.h) / (s.t1 - s.t0);
  const out: { a: VXYH; b: VXYH; kind: RoofLineKind }[] = [];
  for (const list of buckets.values()) {
    list.sort((p, q) => p.t0 - q.t0);
    let cur = list[0];
    for (let i = 1; i < list.length; i++) {
      const s = list[i];
      if (s.t0 === cur.t1 && Math.abs(slope(s) - slope(cur)) < EPS) cur = { ...cur, t1: s.t1, b: s.b };
      else { out.push(cur); cur = s; }
    }
    out.push(cur);
  }
  return out;
}
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** PANS CONTINUS + LIGNES d'un toit couvrant `cells` (clés « x,y », forme quelconque), pour `shape`
 *  (profil/faîtage RÉSOLUS, pente en m/case, hauteur d'égout). CŒUR PUR (testable sur un L) consommé
 *  par `buildAuthoredRoofs`/`buildRoofs` : hauteurs de sommet par `riseAt` (LA formule, doc de tête),
 *  pavage en pièces PLANES (quads coplanaires / selles scindées), fusion des pièces adjacentes de même
 *  plan (annulation d'arêtes internes → polygone de bord), classification des arêtes restantes (égout
 *  au bord, faîte/arêtier entre deux pans), rangs de tuiles en courbes de niveau du plan (`courses`
 *  rangs par cran de montée).
 *
 *  `field` dissocie le DOMAINE de hauteur des cellules PAVÉES (`resolveNappes`) : les cellules restent
 *  celles de la masse (identité des pans, exclusions, cutaway), la hauteur se lit sur le domaine du
 *  groupe. Une arête de bord de `cells` INTÉRIEURE au domaine n'est alors pas un égout — la nappe
 *  continue chez la masse voisine, qui pave la suite. Absent ⇒ domaine = `cells`. */
export function roofPans(
  cells: ReadonlySet<string>,
  matId: string,
  courses: number | undefined,
  eave: EaveSpec | undefined,
  shape: RoofShapeSpec,
  field?: RoofField,
): { faces: Face[]; lines: RoofLine[]; pans?: RoofPanGeometry[] } {
  if (!cells.size) return { faces: [], lines: [] };
  const cellCoords = [...cells].map((key) => key.split(',').map(Number) as [number, number]);
  const minCellX = Math.min(...cellCoords.map(([x]) => x));
  const maxCellX = Math.max(...cellCoords.map(([x]) => x)) + 1;
  const minCellY = Math.min(...cellCoords.map(([, y]) => y));
  const maxCellY = Math.max(...cellCoords.map(([, y]) => y)) + 1;

  const fld = field ?? roofField(cells, shape);
  const wholeDomain = fld.domain.size === cells.size; // domaine élargi ⇒ le pré-cut de bbox ne vaut plus
  const rectangular = wholeDomain && cells.size === (maxCellX - minCellX) * (maxCellY - minCellY);
  const hV = (v: VXY): number => fieldHeightAt(fld, v);
  const withH = (v: VXY) => ({ ...v, h: hV(v) });

  // ── Pavage en pièces PLANES : quad si la cellule est plane (h_TL + h_BR = h_TR + h_BL), sinon
  //    CELLULE-SELLE scindée le long de la diagonale de CRÊTE — celle au plus grand écart de hauteur
  //    (elle relie le coin bas à la pointe haute : l'arêtier/la noue) ; chaque triangle est plan.
  const pieces: Piece[] = [];
  const splitX: number[] = [];
  const splitY: number[] = [];
  // Pré-cut au faîtage GLOBAL réservé au cas RECTANGULAIRE (emprise == boîte englobante : la portée
  // locale coïncide partout avec la bbox, la ligne de faîte est donc unique et globale). Sur une forme
  // irrégulière, imposer une coupe globale désaligne le pavage de la vraie portée LOCALE (`riseAt`) — le
  // pavage par cellule (branche `else` ci-dessous) suit alors `hV` cellule par cellule, sans pré-cut.
  if (rectangular && (shape.profile === 'gable' || shape.profile === 'hip')) {
    if (shape.ridge === 'x') {
      const mid = (minCellY + maxCellY) / 2;
      splitY.push(mid);
      if (shape.profile === 'hip') {
        const inset = Math.min((maxCellY - minCellY) / 2, (maxCellX - minCellX) / 2);
        splitX.push(minCellX + inset, maxCellX - inset);
      }
    } else {
      const mid = (minCellX + maxCellX) / 2;
      splitX.push(mid);
      if (shape.profile === 'hip') {
        const inset = Math.min((maxCellX - minCellX) / 2, (maxCellY - minCellY) / 2);
        splitY.push(minCellY + inset, maxCellY - inset);
      }
    }
  }
  const cuts = (lo: number, hi: number, splits: number[]) =>
    [...new Set([lo, ...splits.filter((value) => value > lo + EPS && value < hi - EPS), hi])]
      .sort((a, b) => a - b);
  const addPiece = (raw: VXY[]) => {
    const pts = raw.filter((point, index) => index === 0 || point.x !== raw[index - 1].x || point.y !== raw[index - 1].y);
    if (pts.length > 2 && pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y) pts.pop();
    const lifted = pts.map(withH);
    for (let i = 1; i + 1 < lifted.length; i++) {
      const det = (lifted[i].x - lifted[0].x) * (lifted[i + 1].y - lifted[0].y)
        - (lifted[i].y - lifted[0].y) * (lifted[i + 1].x - lifted[0].x);
      if (Math.abs(det) < EPS) continue;
      pieces.push({ pts, ...grad3(lifted[0], lifted[i], lifted[i + 1]) });
      return;
    }
  };
  if (rectangular) {
    const TL = { x: minCellX, y: minCellY }, TR = { x: maxCellX, y: minCellY };
    const BR = { x: maxCellX, y: maxCellY }, BL = { x: minCellX, y: maxCellY };
    if (shape.profile === 'flat' || shape.profile === 'shed') addPiece([TL, TR, BR, BL]);
    else if (shape.ridge === 'x') {
      const mid = (minCellY + maxCellY) / 2;
      const inset = shape.profile === 'hip'
        ? Math.min((maxCellY - minCellY) / 2, (maxCellX - minCellX) / 2)
        : 0;
      const RW = { x: minCellX + inset, y: mid }, RE = { x: maxCellX - inset, y: mid };
      addPiece([TL, TR, RE, RW]);
      if (shape.profile === 'hip') addPiece([TR, BR, RE]);
      addPiece([RW, RE, BR, BL]);
      if (shape.profile === 'hip') addPiece([TL, RW, BL]);
    } else {
      const mid = (minCellX + maxCellX) / 2;
      const inset = shape.profile === 'hip'
        ? Math.min((maxCellX - minCellX) / 2, (maxCellY - minCellY) / 2)
        : 0;
      const RN = { x: mid, y: minCellY + inset }, RS = { x: mid, y: maxCellY - inset };
      addPiece([TL, RN, RS, BL]);
      if (shape.profile === 'hip') addPiece([TL, TR, RN]);
      addPiece([RN, TR, BR, RS]);
      if (shape.profile === 'hip') addPiece([BL, RS, BR]);
    }
  } else {
    // Le pavage n'échantillonne `hV` qu'aux sommets ENTIERS. Sur une portée IMPAIRE, le faîtage tombe
    // ENTRE deux sommets : la nappe s'y aplatit en une bande de cellules toutes plates, peinte comme
    // une face à part (mesuré #947 : 18 cases de bande claire au sommet de la croupe du rez de La
    // Diligence). Le cas rectangulaire coupe déjà au vrai milieu (`splitX`/`splitY`) ; sur une emprise
    // irrégulière, on raffine au DEMI-PAS — sur TOUTE l'emprise, pour qu'aucune arête de cellule ne
    // reste face à deux demi-arêtes (T-jonction, donc fente).
    const flatCell = (x: number, y: number): boolean => {
      const h0 = hV({ x, y });
      return [[1, 0], [0, 1], [1, 1]].every(([dx, dy]) => Math.abs(hV({ x: x + dx, y: y + dy }) - h0) < EPS);
    };
    const halfStep = shape.profile !== 'flat' && [...cells].some((k) => {
      const [x, y] = k.split(',').map(Number);
      return flatCell(x, y);
    });
    for (const k of cells) {
      const [x, y] = k.split(',').map(Number);
      const xs = cuts(x, x + 1, halfStep ? [x + 0.5] : splitX);
      const ys = cuts(y, y + 1, halfStep ? [y + 0.5] : splitY);
      for (let yi = 0; yi + 1 < ys.length; yi++)
        for (let xi = 0; xi + 1 < xs.length; xi++) {
          const TL = withH({ x: xs[xi], y: ys[yi] });
          const TR = withH({ x: xs[xi + 1], y: ys[yi] });
          const BR = withH({ x: xs[xi + 1], y: ys[yi + 1] });
          const BL = withH({ x: xs[xi], y: ys[yi + 1] });
          if (Math.abs(TL.h + BR.h - TR.h - BL.h) < EPS) {
            pieces.push({ pts: [TL, TR, BR, BL], gx: (TR.h - TL.h) / (TR.x - TL.x), gy: (BL.h - TL.h) / (BL.y - TL.y) });
          } else {
            const tris = Math.abs(TL.h - BR.h) >= Math.abs(TR.h - BL.h)
              ? [[TL, TR, BR], [TL, BR, BL]]
              : [[TL, TR, BL], [TR, BR, BL]];
            for (const triangle of tris) pieces.push({ pts: triangle, ...grad3(triangle[0], triangle[1], triangle[2]) });
          }
        }
    }
  }

  // ── Fusion en PANS : deux pièces partageant une arête ET de même gradient sont coplanaires (l'arête
  //    commune ancre le plan) → union-find. Les arêtes recensent aussi leurs propriétaires (lignes).
  const parent = pieces.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const ek = (a: VXY, b: VXY) => [vk(a.x, a.y), vk(b.x, b.y)].sort().join('|');
  const edgeOwners = new Map<string, number[]>();
  pieces.forEach((p, i) =>
    p.pts.forEach((a, j) => {
      const key = ek(a, p.pts[(j + 1) % p.pts.length]);
      (edgeOwners.get(key) ?? edgeOwners.set(key, []).get(key)!).push(i);
    }),
  );
  for (const owners of edgeOwners.values())
    if (owners.length === 2) {
      const [a, b] = owners;
      if (Math.abs(pieces[a].gx - pieces[b].gx) < EPS && Math.abs(pieces[a].gy - pieces[b].gy) < EPS) parent[find(a)] = find(b);
    }
  const groups = new Map<number, number[]>();
  pieces.forEach((_, i) => {
    const r = find(i);
    (groups.get(r) ?? groups.set(r, []).get(r)!).push(i);
  });

  // ── Bord de chaque pan : annulation des arêtes internes (parcours horaire cohérent → toute arête
  //    partagée dans le groupe apparaît dans les deux sens), chaînage en boucle(s), simplification.
  const toGP = (v: VXY) => ({ x: v.x - 0.5, y: v.y - 0.5, h: hV(v) });
  const faces: Face[] = [];
  const rangs: { a: VXY; b: VXY; kind: RoofLineKind; h0: number; h1: number }[] = [];
  for (const members of groups.values()) {
    const dirSet = new Map<string, [VXY, VXY]>();
    for (const i of members)
      pieces[i].pts.forEach((a, j) => {
        const b = pieces[i].pts[(j + 1) % pieces[i].pts.length];
        const rev = `${vk(b.x, b.y)}>${vk(a.x, a.y)}`;
        if (dirSet.has(rev)) dirSet.delete(rev);
        else dirSet.set(`${vk(a.x, a.y)}>${vk(b.x, b.y)}`, [a, b]);
      });
    const nextOf = new Map<string, VXY[]>();
    for (const [a, b] of dirSet.values()) {
      const ka = vk(a.x, a.y);
      (nextOf.get(ka) ?? nextOf.set(ka, []).get(ka)!).push(b);
    }
    const { gx, gy } = pieces[members[0]];
    const part = partOf(gx, gy);
    // Boucles (une par pan ; un pan annulaire pathologique — toit en anneau à plat — en émettrait
    // plusieurs, chacune devient sa propre face).
    const loops: VXY[][] = [];
    for (const [start, outs] of nextOf) {
      while (outs.length) {
        const loop: VXY[] = [];
        let cur = outs.pop()!;
        while (vk(cur.x, cur.y) !== start) {
          loop.push(cur);
          cur = nextOf.get(vk(cur.x, cur.y))!.pop()!;
        }
        loop.push(cur);
        loops.push(simplifyLoop(loop));
      }
    }
    for (const loop of loops)
      faces.push({ poly: loop.map(toGP), material: { domain: 'roof', id: matId, part }, oriented: false }); // nappe OUVERTE

    // RANGS de tuiles : courbes de niveau du plan du pan, `courses` rangs par cran de montée, décalées
    // d'un demi-pas (jamais sur un sommet → intersections franches), clippées au(x) bord(s) du pan.
    if (courses && courses > 0 && (Math.abs(gx) > EPS || Math.abs(gy) > EPS)) {
      let hMin = Infinity, hMax = -Infinity;
      for (const loop of loops) for (const v of loop) { const h = hV(v); hMin = Math.min(hMin, h); hMax = Math.max(hMax, h); }
      const step = shape.pitch / courses;
      for (let lvl = hMin + step / 2; lvl < hMax - EPS; lvl += step) {
        const cross: { x: number; y: number; s: number }[] = [];
        for (const loop of loops)
          for (let i = 0; i < loop.length; i++) {
            const a = withH(loop[i]), b = withH(loop[(i + 1) % loop.length]);
            if (a.h < lvl !== b.h < lvl) {
              const t = (lvl - a.h) / (b.h - a.h);
              const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
              cross.push({ x, y, s: x * -gy + y * gx }); // trié LE LONG de la courbe de niveau (⊥ gradient)
            }
          }
        cross.sort((p, q) => p.s - q.s);
        for (let i = 0; i + 1 < cross.length; i += 2)
          rangs.push({ a: cross[i], b: cross[i + 1], kind: 'rang', h0: lvl, h1: lvl });
      }
    }
  }

  // ── Lignes de STRUCTURE : bord du toit (1 pièce) = égout ; entre deux PANS = faîte (horizontale) ou
  //    arêtier/noue (dénivelée). Fusion des tronçons colinéaires 3D, puis conversion en GP. Une arête de
  //    bord qui reste INTÉRIEURE au domaine du champ n'est ni l'un ni l'autre : la nappe s'y poursuit
  //    chez la masse voisine du groupe — ni ligne, ni avant-toit (les deux se posent sur les `lines`).
  const onDomainEdge = (a: VXY, b: VXY): boolean => {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const [c0, c1] = a.x === b.x
      ? [{ x: a.x - 1, y: Math.floor(my) }, { x: a.x, y: Math.floor(my) }]
      : [{ x: Math.floor(mx), y: a.y - 1 }, { x: Math.floor(mx), y: a.y }];
    return !fld.domain.has(vk(c0.x, c0.y)) || !fld.domain.has(vk(c1.x, c1.y));
  };
  const structSegs: { a: VXYH; b: VXYH; kind: RoofLineKind }[] = [];
  for (const [key, owners] of edgeOwners) {
    const [a, b] = key.split('|').map((k) => { const [x, y] = k.split(',').map(Number); return withH({ x, y }); });
    if (owners.length === 1) { if (wholeDomain || onDomainEdge(a, b)) structSegs.push({ a, b, kind: 'egout' }); }
    else if (find(owners[0]) !== find(owners[1]))
      structSegs.push({ a, b, kind: Math.abs(a.h - b.h) < EPS ? 'faite' : 'aretier' });
  }
  const lines: RoofLine[] = mergeSegs(structSegs).map((s) => ({
    a: { x: s.a.x - 0.5, y: s.a.y - 0.5, h: s.a.h },
    b: { x: s.b.x - 0.5, y: s.b.y - 0.5, h: s.b.h },
    kind: s.kind,
  }));

  // ── AVANT-TOIT (VOLUME) : chaque ÉGOUT (jamais un arêtier/faîte) projette un SOFFITE coplanaire au pan
  //    (le débord PROLONGE la nappe vers l'extérieur, en CONTINUANT la pente → son bord extérieur descend
  //    de `overhang × ROOF_SLOPE_M` sous l'égout) + une FASCIA verticale pendant sous ce bord. ADDITIF :
  //    posé APRÈS le pavage/fusion/classification, il ne perturbe NI les pans NI les lignes. Un égout est
  //    axis-aligné (empreinte = union de cellules) et sa normale SORTANTE (⊥ à l'égout, opposée au
  //    centroïde de l'empreinte) coïncide avec la ligne de plus grande pente du pan → soffite COPLANAIRE.
  //    Les bouts sont prolongés d'`overhang` LE LONG de l'égout : aux angles convexes, deux soffites/
  //    fascias voisins se RECOUVRENT (même ton) au lieu de laisser un trou — coin fermé, net à toute vue.
  if (eave && eave.overhang > EPS) {
    const e = eave.overhang;
    let cX = 0, cY = 0;
    for (const k of cells) { const [x, y] = k.split(',').map(Number); cX += x; cY += y; }
    cX /= cells.size; cY /= cells.size; // centroïde d'empreinte (repère GP : centre de cellule = (cx,cy))
    for (const ln of lines) {
      if (ln.kind !== 'egout') continue;
      const { a, b } = ln;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < EPS) continue;
      const ux = dx / len, uy = dy / len; // le long de l'égout
      let nx = -uy, ny = ux; // normale
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (nx * (mx - cX) + ny * (my - cY) < 0) { nx = -nx; ny = -ny; } // orientée vers l'EXTÉRIEUR
      const plane = pieces.find((piece) => {
        const p0 = piece.pts[0];
        const onPlane = (point: GP) =>
          Math.abs(hV(p0) + piece.gx * (point.x + 0.5 - p0.x) + piece.gy * (point.y + 0.5 - p0.y) - point.h) < EPS;
        return onPlane(a) && onPlane(b);
      });
      const lift = e * ((plane?.gx ?? 0) * nx + (plane?.gy ?? 0) * ny);
      const a2: GP = { x: a.x - ux * e, y: a.y - uy * e, h: a.h }; // bord intérieur, prolongé aux angles
      const b2: GP = { x: b.x + ux * e, y: b.y + uy * e, h: b.h };
      const aO: GP = { x: a2.x + nx * e, y: a2.y + ny * e, h: a2.h + lift };
      const bO: GP = { x: b2.x + nx * e, y: b2.y + ny * e, h: b2.h + lift };
      faces.push({ poly: [a2, b2, bO, aO], material: { domain: 'roof', id: matId, part: 'soffite' }, oriented: false });
      if (eave.fasciaDrop > EPS) {
        const aF: GP = { x: aO.x, y: aO.y, h: aO.h - eave.fasciaDrop };
        const bF: GP = { x: bO.x, y: bO.y, h: bO.h - eave.fasciaDrop };
        faces.push({ poly: [aO, bO, bF, aF], material: { domain: 'roof', id: matId, part: 'fascia' }, oriented: false });
      }
    }
  }

  for (const r of rangs)
    lines.push({ a: { x: r.a.x - 0.5, y: r.a.y - 0.5, h: r.h0 }, b: { x: r.b.x - 0.5, y: r.b.y - 0.5, h: r.h1 }, kind: r.kind });
  const slopeFaces = faces.filter((face) => ['N', 'E', 'S', 'O'].includes(face.material.part!));
  const planeOf = (face: Face) => {
    const [p0, p1] = face.poly;
    for (let i = 2; i < face.poly.length; i++) {
      const p2 = face.poly[i];
      const det = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
      if (Math.abs(det) < EPS) continue;
      const gx = ((p1.h - p0.h) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.h - p0.h)) / det;
      const gy = ((p1.x - p0.x) * (p2.h - p0.h) - (p1.h - p0.h) * (p2.x - p0.x)) / det;
      return (p: GP) => Math.abs(p0.h + gx * (p.x - p0.x) + gy * (p.y - p0.y) - p.h) < EPS;
    }
    return (p: GP) => Math.abs(p.h - p0.h) < EPS;
  };
  const partCounts = new Map<string, number>();
  const pans = slopeFaces.map((face) => {
    const part = face.material.part!;
    const n = partCounts.get(part) ?? 0;
    partCounts.set(part, n + 1);
    const onPlane = planeOf(face);
    return {
      id: `${part.toLowerCase()}-${n}`,
      face,
      faces: [
        face,
        ...faces.filter((candidate) => candidate !== face
          && (candidate.material.part === 'soffite' || candidate.material.part === 'fascia')
          && candidate.poly.slice(0, 2).every(onPlane)),
      ],
      lines: lines.filter((line) => onPlane(line.a) && onPlane(line.b)),
    };
  });
  return { faces, lines, pans };
}

/** FERMETURE DE COMBLE (pignon) à une extrémité du faîtage — le volume que ni les rampants (qui
 *  s'arrêtent à l'égout) ni le mur d'étage (qui ne monte que jusqu'à sa hauteur de base) ne produisent,
 *  laissant VOIR À TRAVERS le comble. Géométrie PURE, déduite du MÊME champ de hauteur que `roofPans`
 *  (`riseAt`) — aucune donnée d'auteur nouvelle : base au sommet des murs (`eaveHeightM`), arête haute
 *  suivant la nappe sommet par sommet (triangle pour un `gable` de portée paire, polygone exact sinon,
 *  rampe pour un `shed`). `hip`/`flat` n'en ont aucune (`[]`).
 *
 *  L'étendue suit les cellules RÉELLES qui touchent cette extrémité (jamais la bbox) — un corps en L
 *  ferme à SA largeur. Et la JOINTURE se tranche CASE PAR CASE (`covered`), jamais sur un échantillon :
 *  une extrémité dont quelques cases sont déjà couvertes par une autre nappe ferme TOUT le reste, en
 *  autant de fermetures qu'elle compte de tronçons ouverts contigus. */
export interface GableEnd {
  /** Polygone de fermeture (ordre monde : profil haut de gauche à droite, puis retour par la base). */
  poly: GP[];
  /** Arêtes de mur que la fermeture PROLONGE — une par case de son étendue : c'est là que se lit sa
   *  MATIÈRE (`closureAppearance`), jamais un id en dur. */
  edges: { x: number; y: number; side: WallSide }[];
  /** Cases couvertes par la nappe, côté INTÉRIEUR de la fermeture (une par case d'étendue). */
  inside: { x: number; y: number }[];
  /** Cases juste au-delà, côté EXTÉRIEUR (hors de l'empreinte de cette masse). */
  outside: { x: number; y: number }[];
}

/** Retire les sommets consécutifs CONFONDUS (base et profil se rejoignent aux deux bouts d'un pignon
 *  triangulaire : sans ça le triangle porterait 5 points dont 2 doublons). */
function dedupeLoop(loop: GP[]): GP[] {
  const same = (a: GP, b: GP) => a.x === b.x && a.y === b.y && Math.abs(a.h - b.h) < EPS;
  const out: GP[] = [];
  for (const p of loop) if (!out.length || !same(out[out.length - 1], p)) out.push(p);
  while (out.length > 1 && same(out[0], out[out.length - 1])) out.pop();
  return out;
}

export function gableEnds(
  cells: ReadonlySet<string>,
  shape: RoofShapeSpec,
  covered?: (x: number, y: number) => boolean,
  field?: RoofField,
): GableEnd[] {
  if (shape.profile !== 'gable' && shape.profile !== 'shed') return [];
  const coords = [...cells].map((key) => key.split(',').map(Number) as [number, number]);
  if (!coords.length) return [];
  const fld = field ?? roofField(cells, shape); // même repli que `roofPans` : le champ SOLO de l'emprise
  const minCellX = Math.min(...coords.map(([x]) => x));
  const maxCellX = Math.max(...coords.map(([x]) => x)) + 1;
  const minCellY = Math.min(...coords.map(([, y]) => y));
  const maxCellY = Math.max(...coords.map(([, y]) => y)) + 1;

  const ends = shape.ridge === 'x' ? [minCellX, maxCellX] : [minCellY, maxCellY];
  const out: GableEnd[] = [];
  ends.forEach((along, i) => {
    const isMin = i === 0;
    const cols: number[] = [];
    for (const [cx, cy] of coords) {
      const onEnd = shape.ridge === 'x' ? (isMin ? cx === along : cx + 1 === along) : (isMin ? cy === along : cy + 1 === along);
      if (onEnd) cols.push(shape.ridge === 'x' ? cy : cx);
    }
    if (!cols.length) return;
    cols.sort((a, b) => a - b);
    const insideOf = (c: number) => (shape.ridge === 'x'
      ? { x: isMin ? along : along - 1, y: c }
      : { x: c, y: isMin ? along : along - 1 });
    const outsideOf = (c: number) => (shape.ridge === 'x'
      ? { x: isMin ? along - 1 : along, y: c }
      : { x: c, y: isMin ? along - 1 : along });
    // L'arête PHYSIQUE prolongée : la droite porteuse est en `along − 0.5`, soit le côté 'E' de la case
    // `along−1` (faîtage x) ou le côté 'N' de la case `along` (faîtage y). L'ancrage se lit sur l'ARÊTE
    // et non sur la case intérieure : à l'extrémité MIN celle-ci est du mauvais côté du plan de pignon,
    // et un pignon qui désigne l'arête du voisin y cherche sa matière et sa profondeur de tri.
    const edgeOf = (c: number): { x: number; y: number; side: WallSide } =>
      (shape.ridge === 'x' ? { x: along - 1, y: c, side: 'E' } : { x: c, y: along, side: 'N' });

    // Tronçons OUVERTS contigus : une case déjà couverte au-delà est une JOINTURE (le toit continue,
    // aucun mur entre deux volumes — un éventuel saut de hauteur est la charge de `roofSeamGeometry`).
    const runs: number[][] = [];
    for (const c of cols) {
      const o = outsideOf(c);
      if (covered?.(o.x, o.y)) continue;
      const last = runs[runs.length - 1];
      if (last && last[last.length - 1] === c - 1) last.push(c);
      else runs.push([c]);
    }
    const at = (t: number, h?: number): GP => {
      const v = shape.ridge === 'x' ? { x: along, y: t } : { x: t, y: along };
      return { x: v.x - 0.5, y: v.y - 0.5, h: h ?? fieldHeightAt(fld, v) };
    };
    const ridgeT = (cols[0] + cols[cols.length - 1] + 1) / 2; // faîte : milieu de la portée LOCALE
    for (const run of runs) {
      const a = run[0];
      const b = run[run.length - 1] + 1;
      const ts = new Set<number>();
      for (let t = a; t <= b; t++) ts.add(t);
      if (shape.profile === 'gable' && ridgeT > a + EPS && ridgeT < b - EPS) ts.add(ridgeT);
      // Profil de l'arête haute, échantillonné à chaque sommet de grille (+ le faîte) puis DÉBARRASSÉ
      // de ses points COLINÉAIRES : un versant est droit, il ne doit pas coûter un sommet par case —
      // un pignon de 6 cases reste le triangle à 3 points que sa nappe dessine.
      const sampled = [...ts].sort((p, q) => p - q).map((t) => ({ t, gp: at(t) }));
      const kept = sampled.filter((p, k) => {
        if (k === 0 || k === sampled.length - 1) return true;
        const prev = sampled[k - 1], next = sampled[k + 1];
        const lerp = prev.gp.h + ((next.gp.h - prev.gp.h) * (p.t - prev.t)) / (next.t - prev.t);
        return Math.abs(p.gp.h - lerp) > EPS;
      });
      const profile = kept.map((p) => p.gp);
      if (profile.every((p) => Math.abs(p.h - shape.eaveHeightM) < EPS)) continue; // plan de la nappe = sommet des murs : rien à fermer
      out.push({
        poly: dedupeLoop([...profile, at(b, shape.eaveHeightM), at(a, shape.eaveHeightM)]),
        edges: run.map(edgeOf),
        inside: run.map(insideOf),
        outside: run.map(outsideOf),
      });
    }
  });
  return out;
}

// ── MATIÈRE d'une fermeture : le MUR qu'elle prolonge ────────────────────────────────────────────────
/** Case VOISINE de l'autre côté d'une arête de mur (diagonales : la case elle-même). SOURCE UNIQUE
 *  partagée avec `walls.ts` — deux tables qui divergent, c'est un mur qui change de camp. */
export const WALL_NB: Record<WallSide, [number, number]> = { N: [0, -1], E: [1, 0], '\\': [0, 0], '/': [0, 0] };

/** Apparence d'une ARÊTE de mur — SOURCE UNIQUE des deux rendus (`wallGeometry` de `walls.ts` et les
 *  fermetures d'architecture d'ici) : la façade authorée sur l'arête l'emporte tant que le segment ne
 *  pose ni structure ni override, sinon `wallApp` — une DONNÉE de la carte, jamais une cote (#1180).
 *  Un seul site : les deux rendus ne peuvent pas diverger. */
export function edgeAppearance(facade: FacadeEdge | undefined, seg: WallSeg): StructureAppearanceDef {
  return facade && !apparenceDeclaree(seg)
    ? facadeStructureAppearance(facade.appearance)
    : wallApp(seg);
}

/** Murs de scène indexés par CASE BORDÉE (`x,y,z`) — mémoïsé par scène. L'index par ARÊTE, lui, est le
 *  PARTAGÉ (`state/wallIndex.ts`, même clé `x,y,side,z` qu'`edgeKey`) : `aretesA` rend la liste des
 *  segments d'une arête, `[0]` le premier au sens du document. Mesure sur les 65 scènes livrées
 *  (37 scénarios + 4 campagnes, 3 143 murs) : ZÉRO arête porte plus d'un segment — premier et dernier
 *  sont le même mur, le verdict est celui d'ici. */
const wallCellIndexOf = memoByRef((scene: Scene) => {
  const byCell = new Map<string, WallSeg[]>();
  for (const seg of scene.walls ?? []) {
    const z = seg.z ?? 0;
    const [nx, ny] = WALL_NB[seg.side];
    for (const [x, y] of [[seg.x, seg.y], [seg.x + nx, seg.y + ny]] as [number, number][]) {
      const key = `${x},${y},${z}`;
      (byCell.get(key) ?? byCell.set(key, []).get(key)!).push(seg);
    }
  }
  return { byCell };
});

/** Apparence RÉSOLUE d'un segment de mur — par la loi d'arête PARTAGÉE (`edgeAppearance`). */
function segAppearance(facades: ReadonlyMap<string, FacadeEdge>, seg: WallSeg): string {
  return edgeAppearance(facades.get(edgeKey(seg)), seg).id;
}

/** Apparence DOMINANTE des murs bordant un ensemble de cases `x,y,z` (ordre d'id à égalité : verdict
 *  déterministe, jamais dépendant de l'ordre d'itération). */
function dominantAppearance(
  facades: ReadonlyMap<string, FacadeEdge>,
  index: { byCell: Map<string, WallSeg[]> },
  space: Iterable<string>,
): string | undefined {
  const tally = new Map<string, number>();
  const seen = new Set<WallSeg>();
  for (const key of space)
    for (const seg of index.byCell.get(key) ?? []) {
      if (seen.has(seg)) continue;
      seen.add(seg);
      const id = segAppearance(facades, seg);
      tally.set(id, (tally.get(id) ?? 0) + 1);
    }
  return [...tally].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0];
}

/** MATIÈRE d'une fermeture d'architecture (pignon de comble, joint de nappes) — elle PROLONGE un mur,
 *  elle en prend donc la matière. Aucun repli sur un id en dur (#877) ; quatre lectures, de la plus
 *  précise à la plus large, toutes tirées de la DONNÉE de la scène :
 *   1. la FAÇADE authorée sur l'une des arêtes, quand elle route une feature `gable` ;
 *   2. le MUR PHYSIQUE porté par l'une de ces arêtes (du niveau haut vers le bas) ;
 *   3. à défaut, l'apparence DOMINANTE des murs du VOLUME fermé (emprise × niveaux) ;
 *   4. puis celle des murs du CORPS entier — un pignon prolonge SON bâtiment.
 *  `undefined` = ce corps ne porte AUCUN mur : il n'y a pas de bâti à fermer, et rien ne se peint. */
export function closureAppearance(
  scene: Scene,
  edges: readonly { x: number; y: number; side: WallSide; z: number }[],
  space: Iterable<string>,
  bodySpace: Iterable<string>,
): string | undefined {
  const facades = facadeEdges(scene);
  const index = wallCellIndexOf(scene);
  for (const edge of edges) {
    const facade = facades.get(edgeKey(edge));
    const routed = facade && facadeWallFeatureAppearance(facade.appearance, 'gable');
    if (routed) return routed;
  }
  for (const edge of edges) {
    const seg = aretesA(scene, edge.x, edge.y, edge.side, edge.z)[0];
    if (seg) return segAppearance(facades, seg);
  }
  return dominantAppearance(facades, index, space)
    ?? dominantAppearance(facades, index, bodySpace);
}

/** Vérité de JEU pilotant le cutaway (PAS une caméra) : positions des ALLIÉS, ÉTAGE COMPRIS. Le `z`
 *  (défaut 0) n'est pas décoratif — c'est lui qui tranche la PIÈCE où se tient l'allié : deux pièces
 *  superposées portent des zones DISTINCTES, et une masse ne couvre que la plage `z-levels+1..z`.
 *
 *  `sight` = les cases `"x,y,z"` que le groupe VOIT (`state/vision.ts`) : sans elle, aucune nappe
 *  n'est régie par la vision (éditeur, QC, POV). */
export interface RoofView {
  allies?: { x: number; y: number; z?: number }[];
  sight?: ReadonlySet<string>;
}

function panCells(face: Face, all: { x: number; y: number }[]): { x: number; y: number }[] {
  const inside = (x: number, y: number) => {
    let hit = false;
    for (let i = 0, j = face.poly.length - 1; i < face.poly.length; j = i++) {
      const a = face.poly[i], b = face.poly[j];
      const cross = (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);
      const dot = (x - a.x) * (x - b.x) + (y - a.y) * (y - b.y);
      if (Math.abs(cross) < EPS && dot <= EPS) return true;
      if (a.y > y !== b.y > y && x < a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y)) hit = !hit;
    }
    return hit;
  };
  const selected = all.filter((cell) => inside(cell.x, cell.y));
  if (selected.length) return selected;
  const cx = face.poly.reduce((sum, point) => sum + point.x, 0) / face.poly.length;
  const cy = face.poly.reduce((sum, point) => sum + point.y, 0) / face.poly.length;
  return [[...all].sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0]];
}

/** Une masse de toit est l'ENVELOPPE du bâtiment PAR NATURE (jamais une cloison intérieure, cf.
 *  `envelopeEdges` walls.ts) : elle ne porte pas de voile de brouillard — elle est peinte quand le
 *  groupe la VOIT (`seenSections`), retirée quand il est DESSOUS (`roofOccupied` — allié dans
 *  l'ESPACE couvert), les deux par la loi UNIQUE `cutawayForSection`. #818, #950. */

const GROUPED_DETAIL_CELL_THRESHOLD = 64;

/** `roomZoneIds` DÉRIVÉS (#823, plus de redistribution manuelle) : les zones INTÉRIEURES de
 *  `scene.effectZones` dont au moins une case tombe dans l'emprise de la masse, à l'un des étages
 *  qu'elle couvre (`z` = plancher sommet, `levels` niveaux DEPUIS `z` en descendant — une masse de 2
 *  niveaux à z=1 couvre z=0 ET z=1, comme l'ancien `RoofSection.roomZoneIds` authoré à la main pour un
 *  toit à étage). */
export function massRoomZoneIds(scene: Scene, mass: BuildingMass, cells: ReadonlySet<string>): string[] {
  const zMin = mass.z - mass.levels + 1;
  const ids = new Set<string>();
  for (const zone of scene.effectZones ?? []) {
    if (zone.presentation !== 'interior') continue;
    const z = zone.z ?? 0;
    if (z < zMin || z > mass.z) continue;
    if (sceneZoneTiles(zone).some((t) => cells.has(vk(t.x, t.y)) && (t.z ?? 0) === z)) ids.add(zone.id);
  }
  return [...ids];
}

/** Cases de l'ESPACE d'une masse : son emprise, à CHACUN des niveaux qu'elle couvre (`levels`
 *  niveaux depuis `z` en descendant). C'est ce que la masse enferme, et donc ce que la loi de
 *  dégagement (`cutawayForSection`) compare à l'espace dégagé. */
export function massSpaceCells(mass: Pick<BuildingMass, 'z' | 'levels'>, cells: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (let z = mass.z - mass.levels + 1; z <= mass.z; z++) for (const key of cells) out.push(`${key},${z}`);
  return out;
}

/** SOUS COUVERT — la définition de référence : cette masse coiffe-t-elle la case `x,y` au niveau `z` ?
 *  Son emprise contient la case, et sa nappe est au niveau de la case ou au-dessus. Un niveau
 *  STRICTEMENT plus haut que la nappe est dehors (on est monté sur le toit) ; tout ce qui est dessous
 *  est abrité, qu'il soit enfermé dans le volume (`levels`) ou seulement coiffé (porche, passage
 *  couvert). Consommée par le DÉGAGEMENT (`clearedSpace` ci-dessous) et par la MÉTÉO volumique
 *  (`shelterField`) : deux lecteurs, une vérité — sans quoi il pleuvrait dans la taverne. La
 *  GÉOMÉTRIE de toit, elle, tient SA propre carte de cases coiffées PAR NIVEAU (`roofedAtZ`, dans
 *  `buildRoofs`) pour savoir quel bord de pignon fermer (`gableEnds`) : un index de DESSIN, pas un
 *  second verdict d'abri. */
export function massCovers(mass: Pick<BuildingMass, 'z'>, cells: ReadonlySet<string>, x: number, y: number, z: number): boolean {
  return z <= mass.z && cells.has(vk(x, y));
}

/** Le COUVERT d'une colonne `x,y` : le niveau de la nappe la plus haute qui la coiffe, la cote
 *  MÉTRIQUE d'égout la plus haute — le point bas du toit, donc la hauteur sous laquelle plus rien ne
 *  tombe du ciel — et la SECTION à laquelle appartient CETTE cote.
 *
 *  `sectionId` suit `ceilingM`, PAS `topZ`. Les deux peuvent désigner deux masses différentes sur une
 *  même colonne : une masse basse posée sur une butte a son égout plus HAUT qu'une masse haute posée
 *  dans le creux. C'est l'égout qui ARRÊTE la pluie (`isSheltered`), donc c'est SA masse que la météo
 *  doit interroger — sinon la vue répond pour une autre nappe et la pluie s'arrête encore en l'air
 *  (#1247). `sectionId` est la MASSE (`mass.id`), la clé même que lit la loi de dégagement
 *  (`cutawayForSection`, `seenSections`) : aucun second verdict n'est reposé. */
export interface ShelterColumn { topZ: number; ceilingM: number; sectionId: string }

const shelterOfScene = memoByRef((scene: Scene): ReadonlyMap<string, ShelterColumn> => {
  const out = new Map<string, ShelterColumn>();
  for (const nappe of resolveNappes(scene).values())
    for (const key of nappe.cells) {
      const prev = out.get(key);
      const arreteLaPluie = !prev || nappe.shape.eaveHeightM > prev.ceilingM; // l'égout le plus HAUT
      out.set(key, {
        topZ: Math.max(prev?.topZ ?? -Infinity, nappe.mass.z),
        ceilingM: Math.max(prev?.ceilingM ?? -Infinity, nappe.shape.eaveHeightM),
        sectionId: arreteLaPluie ? nappe.mass.id : prev.sectionId,
      });
    }
  return out;
});

/** COUVERT BÂTI de la scène, par colonne — l'agrégat de `massCovers` sur toutes les nappes
 *  (`resolveNappes`, la source unique des hauteurs de toit), mémoïsé par scène. Il ne dépend NI de la
 *  vue NI du dégagement : une nappe levée par le cutaway reste un toit, et il n'y pleut pas dessous.
 *  La mémoïsation est PAR RÉFÉRENCE de scène : tout plan modifié — l'éditeur qui retire une masse
 *  (`ui/editor/editorState.ts`) — recalcule son couvert. Aucun mécanisme de PARTIE n'abat de masse :
 *  `structureDown` (`state/scene.ts`) porte sur les arêtes de mur. */
export function shelterField(scene: Scene): ReadonlyMap<string, ShelterColumn> {
  return shelterOfScene(scene);
}

/** La case `x,y` est-elle SOUS COUVERT à la cote `hM` ? Sous l'égout de la nappe qui la coiffe. */
export function isSheltered(field: ReadonlyMap<string, ShelterColumn>, x: number, y: number, hM: number): boolean {
  const col = field.get(vk(Math.round(x), Math.round(y)));
  return !!col && hM < col.ceilingM;
}

/** La SECTION qui COIFFE la case `x,y`, ou `null` si elle est à ciel ouvert — le même index et la
 *  même vérité qu'`isSheltered`, lus par la clé de la loi de dégagement. C'est la couture par
 *  laquelle la météo volumique demande à la VUE ce qu'elle fait du toit qui l'arrête (#1247). */
export function shelterSectionAt(field: ReadonlyMap<string, ShelterColumn>, x: number, y: number): string | null {
  return field.get(vk(Math.round(x), Math.round(y)))?.sectionId ?? null;
}

/** ESPACE DÉGAGÉ par les alliés (#818), résolution UNIQUE de la scène — consommée par la loi
 *  `cutawayForSection` (`stage/architectureVisibility.ts`) pour les toits ICI et pour les murs et
 *  façades dans l'hôte du monde (`stage/MondeDeCampagne`) : une seule vérité, jamais deux qui
 *  pourraient diverger.
 *
 *  Un allié dégage l'ESPACE HABITÉ où il se tient, à l'échelle entière de cet espace : la PIÈCE quand
 *  il en occupe une (toutes ses cases, quel que soit le nombre de travées de charpente qui la
 *  traversent — le découpage de charpente est une vérité de SILHOUETTE, il ne découpe pas ce que le
 *  joueur a le droit de voir). Le bâti n'est pas zoné partout — un auteur trace ses murs avant de
 *  poser ses pièces (mesuré sur La Diligence : 119 des 959 cases couvertes par une masse
 *  n'appartiennent à aucune zone intérieure) : sans pièce déclarée, l'espace de l'allié est
 *  l'EMPRISE de la masse qui l'abrite, à l'un des niveaux qu'elle couvre.
 *
 *  Il dégage AUSSI le COUVERCLE (`overheadCells`) : les cases de toute masse dont l'emprise le
 *  surplombe, aux niveaux strictement au-dessus du sien. Une masse peut le coiffer sans qu'il en
 *  occupe aucun niveau — mesuré sur La Diligence : sous le passage couvert (17,12,z0), la seule
 *  masse qui porte l'étage est `diligence-auto-z1-l1-0` (z=1, levels=1), et l'allié y était DEHORS
 *  pour la loi de dégagement : 0 nappe levée sur 76.
 *
 *  Un allié à ciel ouvert ne dégage rien — aucune pièce, aucune emprise ne le contient ni ne le coiffe.
 *
 *  Il dit ENFIN quelles nappes le groupe VOIT (`seenSections`, #950), depuis les cases que le moteur
 *  de vision lui donne (`sight`, `state/vision.ts`) : la nappe d'un corps se peint quand le groupe
 *  voit le PIED de ce corps — une case de son emprise élargie d'1, à l'un des niveaux qu'il porte
 *  (MÊME critère que les ornements de toiture, `builders/props.ts`). Un allié DEDANS — sa pièce, ou
 *  le volume d'une masse dont il occupe un niveau — n'en voit AUCUNE : on ne regarde pas au travers
 *  d'un plafond (`computeVisible` ne marque jamais une case au-dessus du viewer). Le porche et le
 *  passage couvert ne sont PAS dedans : la masse les coiffe sans les enfermer, la vue y reste ouverte
 *  de tous côtés. `sight` absente ⇒ `null` : la vue n'est régie par aucune vision (éditeur, QC, POV). */
export function clearedSpace(
  scene: Scene,
  allies: readonly { x: number; y: number; z?: number }[],
  sight?: ReadonlySet<string>,
): ClearedSpace {
  const zoneIds = new Set<string>();
  const zoneCells = new Map<string, ReadonlySet<string>>();
  const roomlessCells = new Set<string>();
  const overheadCells = new Set<string>();
  if (!allies.length) return { zoneIds, zoneCells, roomlessCells, overheadCells, seenSections: null };
  const masses = effectiveArchitecture(scene).flatMap((body) =>
    body.masses.map((mass) => ({ mass, cells: massFootprintCells(mass.footprint) })));
  let openSky = false; // au moins un allié qui n'est enfermé dans aucun volume bâti
  for (const ally of allies) {
    const x = Math.round(ally.x);
    const y = Math.round(ally.y);
    const z = ally.z ?? 0;
    const rooms = occupiedInteriorZoneIds(scene, [{ x, y, z }]);
    for (const id of rooms) zoneIds.add(id);
    let dedans = rooms.size > 0;
    for (const { mass, cells } of masses) {
      if (!massCovers(mass, cells, x, y, z)) continue;
      const bottom = mass.z - mass.levels + 1;
      if (z >= bottom) dedans = true; // dans le VOLUME de la masse, pas seulement sous son couvercle
      if (!rooms.size && z >= bottom) for (const key of massSpaceCells(mass, cells)) roomlessCells.add(key);
      for (let mz = Math.max(z + 1, bottom); mz <= mass.z; mz++)
        for (const key of cells) overheadCells.add(`${key},${mz}`);
    }
    openSky ||= !dedans;
  }
  const tilesById = interiorZoneTilesById(scene); // les cases d'une pièce : UNE dérivation (`stage/roomFocus`)
  for (const id of zoneIds) zoneCells.set(id, tilesById.get(id) ?? new Set<string>());
  const seenSections = sight
    ? new Set(openSky ? masses.filter(({ mass, cells }) => footInSight(mass.z, cells, sight)).map(({ mass }) => mass.id) : [])
    : null;
  return { zoneIds, zoneCells, roomlessCells, overheadCells, seenSections };
}

/** Le PIED d'une masse est-il en vue ? Son emprise ÉLARGIE d'1 (on voit un bâtiment quand on voit le
 *  sol à son pied — l'intérieur, lui, est derrière ses murs), à l'un des niveaux qu'elle porte. */
function footInSight(z: number, cells: ReadonlySet<string>, sight: ReadonlySet<string>): boolean {
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        for (let lvl = 0; lvl <= z; lvl++) if (sight.has(`${x + dx},${y + dy},${lvl}`)) return true;
  }
  return false;
}

/** Forme résolue + emprise + `roomZoneIds` dérivés d'une masse — calcul PARTAGÉ par `buildAuthoredRoofs`
 *  et `walls.ts` (pignons/jointures/enveloppe) : une seule dérivation, jamais deux formules qui
 *  pourraient diverger. */
export function resolveMass(scene: Scene, mass: BuildingMass): { cells: Set<string>; shape: RoofShapeSpec; roomZoneIds: string[] } {
  const cells = massFootprintCells(mass.footprint);
  const ridge = resolveMassRidge(mass, cells);
  const pitch = sceneMetresPerTile(scene) * Math.tan((mass.pitchDeg * Math.PI) / 180);
  // Hauteur d'égout ABSOLUE (`GP.h`, cf. `backends/project.projGP`) : le toit repose sur le SOMMET des
  // murs de l'étage `mass.z`, et un mur s'assoit sur le RELIEF de SA case (`buildWalls` : `heightAt`
  // + `WALL_H_M`). L'égout se lit donc sur la MÊME source — la cote métrique du plancher sous
  // l'emprise, jamais une cote déduite de l'index d'étage : un bâtiment sur une butte, une terrasse ou
  // un quai surélevé garde son toit sur ses murs. `levels` ne compte que les niveaux COUVERTS vers le
  // bas (`massRoomZoneIds`) et ne dit RIEN de l'altitude.
  //
  // EMPRISE NON PLANE (cage d'escalier, bâtiment à cheval sur un dénivelé) : l'égout est UNE cote et se
  // prend au point HAUT. C'est le seul choix cohérent avec les murs : au point BAS, la nappe passerait
  // SOUS le sommet des murs des cases hautes — le grief même qu'on corrige — et jusque SOUS leur
  // plancher quand le dénivelé atteint une hauteur de mur. Au point haut, aucun mur porté n'est
  // traversé et le volume coiffé garde au moins un étage de hauteur partout.
  let topFloorM = -Infinity;
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    topFloorM = Math.max(topFloorM, heightAt(scene, x, y, mass.z));
  }
  const eaveHeightM = topFloorM + WALL_H_M;
  const shape: RoofShapeSpec = { profile: mass.profile, ridge, pitch, eaveHeightM, eaveSide: mass.eaveSide };
  return { cells, shape, roomZoneIds: massRoomZoneIds(scene, mass, cells) };
}

/** NAPPE d'une masse : ce qu'elle PAVE (`cells`, sa forme propre — les traitements d'EXTRÉMITÉ, cf.
 *  `gableEnds`) et le CHAMP de hauteur qu'elle LIT, celui de son GROUPE. Un groupe réunit les masses
 *  d'un même corps, au même `z`, de même égout MESURÉ, dont les cellules sont 4-adjacentes et que
 *  `mayShareNappe` autorise à partager une pente : leur champ court sur l'union de leurs emprises, si
 *  bien qu'au joint le versant CONTINUE (le BFS y ouvre la noue) au lieu de retomber deux fois à
 *  l'égout. Un groupe impose UNE pente, refittée sur la portée de l'union (`groupField`) : y entrer
 *  coûte sa pente propre, ce qu'une masse DÉRIVÉE peut payer et une masse AUTHORÉE non. Un groupe
 *  d'UNE masse : domaine = ses cellules, forme = la sienne — le champ est alors exactement
 *  `riseAt(v, cells, shape)`. */
export interface MassNappe {
  bodyId: string;
  mass: BuildingMass;
  cells: Set<string>;
  shape: RoofShapeSpec;
  roomZoneIds: string[];
  field: RoofField;
  groupId: string;
}

type ResolvedMass = { mass: BuildingMass; cells: Set<string>; shape: RoofShapeSpec; roomZoneIds: string[] };

const segKey = (x0: number, y0: number, x1: number, y1: number) => `${x0},${y0}|${x1},${y1}`;

/** Bords du domaine qui AMORCENT l'égout : tout le bord, MOINS les extrémités de faîtage des masses à
 *  versants droits (`gable`) — un pignon les ferme (`gableEnds`), le versant y arrive donc à pleine
 *  hauteur au lieu de s'abattre en croupe. */
function groupEaveSegs(domain: ReadonlySet<string>, group: readonly ResolvedMass[]): BoundarySeg[] {
  const closed = new Set<string>();
  for (const r of group) {
    if (r.mass.profile !== 'gable') continue;
    const coords = [...r.cells].map((key) => key.split(',').map(Number) as [number, number]);
    const along = (c: [number, number]) => (r.shape.ridge === 'x' ? c[0] : c[1]);
    const lo = Math.min(...coords.map(along));
    const hi = Math.max(...coords.map(along));
    for (const [cx, cy] of coords) {
      if (r.shape.ridge === 'x') {
        if (cx === lo) closed.add(segKey(cx, cy, cx, cy + 1));
        if (cx === hi) closed.add(segKey(cx + 1, cy, cx + 1, cy + 1));
      } else {
        if (cy === lo) closed.add(segKey(cx, cy, cx + 1, cy));
        if (cy === hi) closed.add(segKey(cx, cy + 1, cx + 1, cy + 1));
      }
    }
  }
  const all = boundarySegs(domain);
  const kept = all.filter((s) => !closed.has(segKey(s.x0, s.y0, s.x1, s.y1)));
  return kept.length ? kept : all; // aucun bord amorçant : le champ n'aurait plus d'origine
}

/** Champ COMMUN d'un groupe de plusieurs masses : domaine = union des emprises, profondeur BFS depuis
 *  les seuls bords amorçants, et UNE pente refittée sur la portée du domaine (`fittedPitchDeg`,
 *  `state/sceneEdit.ts` — la borne de comble #947 est celle du corps, jamais une seconde copie).
 *  `2 × profondeur` est la portée que cette borne lit : elle rapporte la montée à `portée/2`. */
function groupField(scene: Scene, body: ArchitectureBody, group: readonly ResolvedMass[]): RoofField {
  const domain = new Set<string>();
  for (const r of group) for (const key of r.cells) domain.add(key);
  const segs = groupEaveSegs(domain, group);
  const dep = bfsDepth(domain, segs);
  let deepest = 0;
  for (const d of dep.values()) deepest = Math.max(deepest, d);
  const metresPerTile = sceneMetresPerTile(scene);
  const pitchDeg = fittedPitchDeg(
    2 * deepest,
    metresPerTile,
    Math.max(...group.map((r) => r.mass.pitchDeg)),
    toitureEffective(scene, body).riseMaxStoreys,
  );
  const shape: RoofShapeSpec = {
    profile: 'hip',
    ridge: resolveMassRidge({}, domain),
    pitch: metresPerTile * Math.tan((pitchDeg * Math.PI) / 180),
    eaveHeightM: group[0].shape.eaveHeightM,
  };
  return { domain, shape, cache: { dep, segs } };
}

/** Deux masses voisines peuvent-elles lire UN champ commun ? Entrer dans un groupe, c'est céder sa
 *  pente au refit du domaine union (`groupField`, toujours `hip`). Une masse DÉRIVÉE (`derived`) ne
 *  porte aucun geste d'auteur — sa pente est déjà calculée, la recalculer ne jette rien. Une masse
 *  AUTHORÉE porte une intention : elle ne rejoint que ce qui a EXACTEMENT son profil et sa pente, et
 *  jamais si ce profil est `flat` (terrasse) ou `shed` (mono-pente), qu'un champ `hip` détruirait. */
const mayShareNappe = (a: ResolvedMass, b: ResolvedMass): boolean => {
  if (a.mass.derived && b.mass.derived) return true;
  for (const r of [a, b])
    if (!r.mass.derived && (r.mass.profile === 'flat' || r.mass.profile === 'shed')) return false;
  return a.mass.profile === b.mass.profile && a.mass.pitchDeg === b.mass.pitchDeg;
};

function nappesOfBody(scene: Scene, body: ArchitectureBody): MassNappe[] {
  const resolved: ResolvedMass[] = body.masses.map((mass) => ({ mass, ...resolveMass(scene, mass) }));
  const owner = new Map<string, number>();
  resolved.forEach((r, i) => { for (const key of r.cells) if (!owner.has(key)) owner.set(key, i); });
  const parent = resolved.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  resolved.forEach((r, i) => {
    for (const key of r.cells) {
      const [x, y] = key.split(',').map(Number);
      for (const [dx, dy] of ALL4) {
        const j = owner.get(vk(x + dx, y + dy));
        if (j === undefined || j === i) continue;
        const o = resolved[j];
        if (r.mass.z === o.mass.z && Math.abs(r.shape.eaveHeightM - o.shape.eaveHeightM) < EPS && mayShareNappe(r, o))
          parent[find(i)] = find(j);
      }
    }
  });
  const comps = new Map<number, number[]>();
  resolved.forEach((_, i) => {
    const root = find(i);
    (comps.get(root) ?? comps.set(root, []).get(root)!).push(i);
  });
  const out: MassNappe[] = [];
  for (const members of comps.values()) {
    const group = members.map((i) => resolved[i]);
    const groupId = `${body.id}:${group.map((r) => r.mass.id).join('+')}`;
    const field = group.length === 1 ? roofField(group[0].cells, group[0].shape) : groupField(scene, body, group);
    for (const r of group) out.push({ bodyId: body.id, ...r, field, groupId });
  }
  return out;
}

/** Clé d'indexation d'une nappe — `bodyId` compris : deux corps peuvent nommer leurs masses pareil. */
export const nappeKey = (bodyId: string, massId: string): string => `${bodyId}|${massId}`;

const nappesOfScene = memoByRef((scene: Scene) => {
  const out = new Map<string, MassNappe>();
  for (const body of effectiveArchitecture(scene))
    for (const nappe of nappesOfBody(scene, body)) out.set(nappeKey(body.id, nappe.mass.id), nappe);
  return out;
});

/** Nappes de la scène, par `nappeKey` — SOURCE UNIQUE de la hauteur de toit : `buildRoofs` (pans et
 *  pignons), `walls.ts` (joints de nappes) et `props.ts` (ornements de faîte) lisent LE MÊME champ,
 *  jamais deux formules qui pourraient diverger. Mémoïsée par scène (`memoByRef`). */
export function resolveNappes(scene: Scene): ReadonlyMap<string, MassNappe> {
  return nappesOfScene(scene);
}

/** Éléments `roof` de la scène, DÉRIVÉS des masses de bâtiment. Les corps se lisent par
 *  `effectiveArchitecture` (`state/sceneEdit.ts`) : les masses `derived` se RECALCULENT du plan à
 *  chaque construction — toute mutation de plan (pièce, case, étage, exclusion) fait suivre la
 *  toiture, sans qu'aucune mutation n'ait à la re-matérialiser ; les masses authorées passent
 *  intactes. Une nappe de toit ne prend pas le voile case par case (#818, enveloppe par nature — cf.
 *  doc de `buildWalls`) : pas de paramètre `visible` ici, `roofOccupied` porte SEUL son sort — à
 *  l'échelle de l'ESPACE HABITÉ couvert et de la MASSE vue, jamais de la travée de charpente (loi
 *  `cutawayForSection`, espace et vue résolus par `clearedSpace`), et c'est la SEULE vérité de vue
 *  portée par la règle de chaque pan (#808 : la géométrie, elle, ne bouge pas au pas). */
function roofGeometry(scene: Scene): Viewed<RoofEl, ClearedSpace>[] {
  const out: Viewed<RoofEl, ClearedSpace>[] = [];
  const bodies = effectiveArchitecture(scene);
  const nappes = resolveNappes(scene);
  // Cases COUVERTES par une nappe, par niveau — la jointure de deux volumes contigus se lit ici, case
  // par case (`gableEnds(..., covered)`).
  const roofedAtZ = new Map<number, Set<string>>();
  for (const body of bodies)
    for (const mass of body.masses) {
      const set = roofedAtZ.get(mass.z) ?? roofedAtZ.set(mass.z, new Set<string>()).get(mass.z)!;
      for (const key of massFootprintCells(mass.footprint)) set.add(key);
    }
  for (const body of bodies) {
    // ESPACE du CORPS entier : dernière lecture de matière d'une fermeture (`closureAppearance`).
    const bodySpace = new Set<string>();
    for (const mass of body.masses)
      for (const key of massSpaceCells(mass, massFootprintCells(mass.footprint))) bodySpace.add(key);
    for (const mass of body.masses) {
      // La masse PAVE ses cellules ; la HAUTEUR vient du champ de son groupe de nappe (`resolveNappes`).
      const { cells, shape, roomZoneIds, field } = nappes.get(nappeKey(body.id, mass.id))!;
      // Le dégagement se décide au CONTEXTE (espace dégagé, résolu une fois par appel) et non par
      // case de brouillard : une nappe ne porte pas de voile, elle est peinte ou elle ne l'est pas.
      const space = { sectionId: mass.id, roomZoneIds, cells: massSpaceCells(mass, cells) };
      const rule: ViewRule<ClearedSpace> = { kind: 'contexte', truth: (cleared) => cutawayForSection(space, cleared) === 'hidden' };
      const simplifiedCourses = cells.size > GROUPED_DETAIL_CELL_THRESHOLD;
      const def = roofMaterial(mass.material);
      const courses = def.detail?.courses?.hM
        ? Math.max(1, Math.round(field.shape.pitch / def.detail.courses.hM))
        : undefined;
      const eave = { overhang: def.eaveOverhangM ?? 0, fasciaDrop: def.fasciaDropM ?? 0 };
      const sectionCells = [...cells].map((key) => {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
      });
      const geometry = roofPans(cells, mass.material, simplifiedCourses ? 1 : courses, eave, field.shape, field);
      for (const pan of geometry.pans ?? []) {
        const panCellsList = panCells(pan.face, sectionCells);
        const minX = Math.min(...panCellsList.map((cell) => cell.x));
        const minY = Math.min(...panCellsList.map((cell) => cell.y));
        const maxX = Math.max(...panCellsList.map((cell) => cell.x));
        const maxY = Math.max(...panCellsList.map((cell) => cell.y));
        out.push({
          off: {
            kind: 'roof',
            key: `roof:${body.id}:${mass.id}:${pan.id}`,
            bodyId: body.id,
            sectionId: mass.id,
            panId: pan.id,
            roomZoneIds: [...roomZoneIds],
            profile: field.shape.profile,
            ridge: field.shape.ridge,
            pitch: field.shape.pitch,
            eaveHeightM: field.shape.eaveHeightM,
            ...(simplifiedCourses ? { simplifiedCourses: true } : {}),
            cell: { x: minX, y: minY, z: mass.z },
            span: { w: maxX - minX + 1, h: maxY - minY + 1 },
            cells: panCellsList,
            material: mass.material,
            label: bodyLabel(body),
            faces: pan.faces,
            lines: pan.lines,
            states: {
              visible: true,
              roofOccupied: false,
            },
          },
          rule,
        });
      }

      // ── FERMETURES DE COMBLE (pignons) — pièces de la NAPPE, pas des cloisons de la scène : elles
      //    portent la MÊME `rule` que ses pans, donc le MÊME sort au dégagement — un pignon ne survit
      //    jamais seul à la levée de son toit. Leur MATIÈRE est celle du mur qu'elles prolongent —
      //    d'où une face `domain:'structure'`, peinte par le backend avec l'appareillage et le
      //    colombage de ce mur. Le traitement d'extrémité reste celui de LA MASSE (`shape`) — le champ
      //    du groupe donne les hauteurs, il ne décide pas si une extrémité se ferme.
      const closureSide: CellSide = shape.ridge === 'x' ? 'E' : 'N';
      gableEnds(cells, shape, (x, y) => roofedAtZ.get(mass.z)?.has(vk(x, y)) ?? false, field).forEach((end, i) => {
        const edges = [];
        for (let z = mass.z; z >= mass.z - mass.levels + 1; z--)
          for (const edge of end.edges) edges.push({ ...edge, z });
        const appearance = closureAppearance(scene, edges, space.cells, bodySpace);
        if (!appearance) return; // corps sans AUCUN mur : pas de bâti, donc pas de pignon à prolonger
        const minX = Math.min(...end.inside.map((cell) => cell.x));
        const minY = Math.min(...end.inside.map((cell) => cell.y));
        const maxX = Math.max(...end.inside.map((cell) => cell.x));
        const maxY = Math.max(...end.inside.map((cell) => cell.y));
        out.push({
          off: {
            kind: 'roof',
            key: `roof:${body.id}:${mass.id}:pignon-${i}`,
            bodyId: body.id,
            sectionId: mass.id,
            panId: `pignon-${i}`,
            roomZoneIds: [...roomZoneIds],
            profile: mass.profile,
            ridge: shape.ridge,
            pitch: field.shape.pitch,
            eaveHeightM: field.shape.eaveHeightM,
            cell: { x: minX, y: minY, z: mass.z },
            span: { w: maxX - minX + 1, h: maxY - minY + 1 },
            cells: end.inside,
            material: mass.material,
            label: bodyLabel(body),
            faces: [{ poly: end.poly, material: { domain: 'structure', id: appearance, part: 'face' }, side: closureSide, oriented: false }],
            lines: [],
            states: { visible: true, roofOccupied: false },
          },
          rule,
        });
      });
    }
  }
  return out;
}

/** Éléments `roof` de la scène. La GÉOMÉTRIE des nappes est mémoïsée (`viewedBuilder`) : un pas ne
 *  re-dérive AUCUNE masse — il ne rejoue que le DÉGAGEMENT, et rend le TABLEAU PRÉCÉDENT tant que
 *  l'espace dégagé ne change pas. Le dégagement est calculé UNE fois par masse et porté par TOUS ses
 *  pans : deux pans d'une même nappe ne se lèvent jamais l'un sans l'autre. */
export const buildRoofs: (scene: Scene, view?: RoofView) => RoofEl[] = (() => {
  const build = viewedBuilder<RoofEl, RoofView, ClearedSpace>({
    derive: roofGeometry,
    key: () => '', // la géométrie des nappes ne dépend d'AUCUN paramètre de vue
    context: (scene, view) => clearedSpace(scene, view?.allies ?? [], view?.sight),
    withTruth: (off) => ({ ...off, states: { ...off.states, roofOccupied: true } }),
  });
  return (scene, view) => build(scene, undefined, view);
})();

