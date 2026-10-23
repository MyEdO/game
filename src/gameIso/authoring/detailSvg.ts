/**
 * DÉTAIL de surface des PEINTRES SVG D'AUTHORING (frontière du module : `authoring/project.ts` ;
 * matériaux v2 « dessiné main ») — consomme les
 * `DetailRecipe` portées par les defs d'apparence (structure/relief/terrain).
 *
 * Règle structurante « pattern = structure, fill = couleur » : la face pose son FILL plein (teintable
 * nuit/estompe/brume), puis (a) un `<pattern userSpaceOnUse>` par (recette × ORIENTATION d'arête × plan)
 * ne dessine QUE les joints sur fond transparent — en affine, toutes les faces d'une même orientation
 * partagent le même vecteur d'arête écran → `patternTransform` CONSTANT, pattern PARTAGÉ par toute la
 * carte ; (b) des ACCENTS seedés (blocs nuancés alignés sur l'appareillage, mouchetis, touffes) sont
 * fusionnés en UN `<path>` multi-sous-chemins PAR FACE et PAR COULEUR. Anti-périodicité : `N_VARIANTS`
 * motifs pré-seedés par recette, choisis par hash(x,y[,side]) ; le seed d'un accent est TOUJOURS dérivé
 * de l'identité MONDE (`hash32(kind, x, y, z, side?)` selon `seedScope`) — jamais stocké.
 *
 * LOD par zoom : < 0.5 fills plats (rendu historique) ; < 0.7 motifs seuls ; ≥ 0.7 motifs + accents.
 * Toute couleur vient de la recette (donnée) ou dérive du fill par `shade` — aucun littéral ici.
 */
import { hash32, seedStream } from '../../data/hash';
import { expandRecipe, ACCENT_FRAC, BLOCK_INSET_M, BLOCK_SHADE_K, TIMBER_V0, TIMBER_V1, TINT_SPREAD } from '../detail/expand';
import {
  coursesKey,
  coursesPeriod,
  groundCoursesPeriod,
  patternWM,
  rowBoundaries,
  N_VARIANTS,
  variantOf,
  type Courses,
  type CourseLine,
  type CourseVertical,
} from '../detail/courses';
import type { DetailRecipe } from '../../data/materials.types';
import { shade, ao, spec } from '../shade';
import { isSquareView, type Dims } from '../../geometry/iso';
import { ISO_PX_PER_M } from '../iso';
import { tousLesTerrains, terrainEntree } from '../../noyau/monde/terrain';
import { terrainGradientId, terrainStopsOrdonnes } from '../catalog/terrain';
import { structureAppearances, matieresDe } from '../../data';
import { projGP, type Pt2 } from './project';
import type { GP } from '../builders/types';

// ── LOD ──────────────────────────────────────────────────────────────────────────────────────────────
export type Lod = 0 | 1 | 2;
/** Palier de détail selon le zoom : 0 = fills plats, 1 = motifs (joints), 2 = motifs + accents. */
export const lodOf = (zoom: number): Lod => (zoom < 0.5 ? 0 : zoom < 0.7 ? 1 : 2);
/** Zoom REPRÉSENTATIF de chaque palier : les memos des stages dépendent du PALIER (pas du zoom
 *  continu) et passent ce zoom-là aux backends — un coup de molette dans le même palier ne rebâtit rien. */
export const LOD_ZOOM: readonly [number, number, number] = [0.4, 0.6, 1];

/** Options de rendu des backends affines : `zoom` pilote le LOD, `mpt` = mètres par case de la scène
 *  (échelle des recettes métriques), `night` = ambiance nocturne (vitres de fenêtre allumées, ambrées
 *  émissives). Absents ⇒ plein détail à l'échelle RAW, de JOUR (QC, scripts). */
export interface DetailOpts { zoom?: number; mpt?: number; night?: boolean }
export const detailOf = (opts?: DetailOpts): { lod: Lod; mpt: number } => ({ lod: lodOf(opts?.zoom ?? 1), mpt: opts?.mpt ?? 2 });

// ── Constantes du motif ──────────────────────────────────────────────────────────────────────────────

const n2 = (v: number) => String(Math.round(v * 100) / 100);
const n3 = (v: number) => String(Math.round(v * 1000) / 1000);

// ── Orientations d'arête (la rotation caméra vit dans dims, résolue par projGP) ─────────────────────
type Axis = 'x' | 'y' | 'd' | 'a';
const AXES: Axis[] = ['x', 'y', 'd', 'a'];
const AXIS_OF: Record<string, Axis> = { N: 'x', S: 'x', E: 'y', O: 'y', '\\': 'd', '/': 'a' };
/** Arête UNITÉ de chaque axe (coins de grille) — son vecteur écran par MÈTRE cale le motif. */
const AXIS_EDGE: Record<Axis, [GP, GP]> = {
  x: [{ x: -0.5, y: -0.5, h: 0 }, { x: 0.5, y: -0.5, h: 0 }],
  y: [{ x: -0.5, y: -0.5, h: 0 }, { x: -0.5, y: 0.5, h: 0 }],
  d: [{ x: -0.5, y: -0.5, h: 0 }, { x: 0.5, y: 0.5, h: 0 }],
  a: [{ x: 0.5, y: -0.5, h: 0 }, { x: -0.5, y: 0.5, h: 0 }],
};

/** Vecteur ÉCRAN d'1 MÈTRE le long d'une arête de l'axe (l'arête diagonale mesure √2 cases). */
function axisMetreVec(axis: Axis, dims: Dims, mpt: number): Pt2 {
  const [A, B] = AXIS_EDGE[axis];
  const a = projGP(A, dims);
  const b = projGP(B, dims);
  const len = (axis === 'd' || axis === 'a' ? Math.SQRT2 : 1) * mpt;
  return [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
}
/** Face de CHANT (arête quasi parallèle à la verticale écran, ex. murs E en edge-on) : motif dégénéré. */
const degenerate = (eu: Pt2): boolean => Math.abs(eu[0]) < 0.5;

// ── Recettes d'appareillage disponibles (structure + relief), dédupliquées par CONTENU ───────────────
/** Étiquette de PROJECTION dans l'id d'un motif/clip : son `patternTransform` dépend de la rotation/vue —
 *  une planche QC qui juxtapose plusieurs projections dans UN document SVG ne collisionne pas. */
export const projTag = (dims: Dims): string => (isSquareView(dims.view) ? 'top' : `${dims.rot ?? 0}${dims.edge ? 'e' : ''}`);
const patternId = (key: string, axis: Axis, variant: number, dims: Dims): string => `dt-${key}-${projTag(dims)}-${axis}${variant}`;

/** Le TRACÉ de période (bornes de rangs, joints, blocs nuancés) vit en géométrie métrique pure dans
 *  `detail/courses` ; il est re-exposé ici pour les backends affines qui l'alignent sur le motif :
 *  le backend TOITS pose ses bardeaux sur les MÊMES bornes seedées. */
export { coursesKey, patternWM, rowBoundaries, N_VARIANTS, type Courses };

/** Sérialisation ÉCRAN du tracé de période : les lignes de rang tremblées, puis les joints verticaux.
 *  Les coordonnées sont les MÈTRES du tracé — c'est le `patternTransform` qui les projette. */
const linesPath = (lines: readonly CourseLine[]): string =>
  lines.map((l) => `M0,${n3(l.y0)}` + l.pts.map((p) => `L${n3(p.u)},${n3(p.y)}`).join('')).join('');
const verticalsPath = (vs: readonly CourseVertical[]): string =>
  vs.map((v) => `M${n3(v.u)},${n3(v.y0)}L${n3(v.u)},${n3(v.y1)}`).join('');

/** Un motif d'appareillage pré-seedé : le tracé de période de `detail/courses` (joints horizontaux
 *  tremblés ancrés aux coutures + joints verticaux par parité de rang, en MÈTRES) posé en écran par le
 *  `patternTransform` (base [eu | (0, ISO_PX_PER_M)]) de l'orientation donnée. UN SEUL `<path>` par motif. */
function coursesPatternDef(c: Courses, key: string, axis: Axis, eu: Pt2, variant: number, dims: Dims): string {
  const p = coursesPeriod(c, key, variant);
  const d = linesPath(p.lines) + verticalsPath(p.verticals);
  return (
    `<pattern id="${patternId(key, axis, variant, dims)}" patternUnits="userSpaceOnUse" width="${n3(p.wM)}" height="${n3(p.hM)}"` +
    ` patternTransform="matrix(${n3(eu[0])} ${n3(eu[1])} 0 ${ISO_PX_PER_M} 0 0)">` +
    `<path d="${d}" fill="none" stroke="${c.joint}" stroke-width="${n3(c.jointW)}" stroke-linecap="round" opacity="0.85"/>` +
    `</pattern>`
  );
}

/** Recettes d'assises à motifs : toutes les defs de STRUCTURE et de RELIEF qui en portent une. */
function coursesRecipes(): Map<string, Courses> {
  const out = new Map<string, Courses>();
  for (const def of [...structureAppearances, ...matieresDe('relief')]) {
    const c = def.detail?.courses;
    if (c) out.set(coursesKey(c), c);
  }
  return out;
}

// ── Sol APPAREILLÉ (pavés/dalles/lattes) : motif CONTINU ancré au plan du sol ────────────────────────
/** Alpha des nuances de pierre CUITES dans le motif de sol, par unité de `paletteVar`. */
const GROUND_VAR_ALPHA = 1.7;

/** Base ÉCRAN du plan du SOL : vecteurs d'1 m le long des axes de grille (x → u du motif, y → v).
 *  null si le plan est dégénéré à l'écran (projection rasante). */
function groundBasis(dims: Dims, mpt: number): [Pt2, Pt2] | null {
  const ex = axisMetreVec('x', dims, mpt);
  const ey = axisMetreVec('y', dims, mpt);
  return Math.abs(ex[0] * ey[1] - ex[1] * ey[0]) < 0.05 ? null : [ex, ey];
}
const groundPatternId = (key: string, dims: Dims): string => `dt-${key}-${projTag(dims)}-g`;

/** Sous-chemin d'un bloc nuancé du tracé de sol (rectangle en mètres, retrait déjà pris). */
const rectSub = (r: { u0: number; v0: number; u1: number; v1: number }): string =>
  `M${n3(r.u0)},${n3(r.v0)}H${n3(r.u1)}V${n3(r.v1)}H${n3(r.u0)}Z`;

/** Motif de SOL appareillé, CONTINU à travers les tuiles (ancré au plan monde, `userSpaceOnUse`) :
 *  le tracé de période de `detail/courses` (joints en MÈTRES monde) projeté par la base du plan.
 *  Contrairement aux faces verticales (variantes par face), le sol est UNE surface continue → un seul
 *  motif, période élargie ; la « variance par pierre » est CUITE dans le motif (voiles `ao`/`spec` sur
 *  les blocs du tracé) : elle ne coûte AUCUN nœud par tuile et reste alignée d'une tuile à l'autre. */
function groundCoursesPatternDef(c: Courses, key: string, [ex, ey]: [Pt2, Pt2], dims: Dims): string {
  const p = groundCoursesPeriod(c, key);
  const joints = linesPath(p.lines) + verticalsPath(p.verticals);
  const light = p.light.map(rectSub).join('');
  const dark = p.dark.map(rectSub).join('');
  const alpha = Math.min(0.2, (c.paletteVar ?? 0) * GROUND_VAR_ALPHA);
  return (
    `<pattern id="${groundPatternId(key, dims)}" patternUnits="userSpaceOnUse" width="${n3(p.wM)}" height="${n3(p.hM)}"` +
    ` patternTransform="matrix(${n3(ex[0])} ${n3(ex[1])} ${n3(ey[0])} ${n3(ey[1])} 0 0)">` +
    `<path d="${joints}" fill="none" stroke="${c.joint}" stroke-width="${n3(c.jointW)}" stroke-linecap="round" opacity="0.8"/>` +
    (light ? `<path d="${light}" fill="${spec(alpha)}"/>` : '') +
    (dark ? `<path d="${dark}" fill="${ao(alpha)}"/>` : '') +
    `</pattern>`
  );
}

/** Id du motif de SOL appareillé d'un terrain (null : pas de recette d'assises, ou plan dégénéré). */
export function terrainCoursesPattern(terrainId: string, dims: Dims, mpt: number): string | null {
  const c = terrainEntree(terrainId)?.detail?.courses;
  return c && groundBasis(dims, mpt) ? groundPatternId(coursesKey(c), dims) : null;
}

/** DEFS des matériaux v2 pour la projection courante : variantes de dégradé de terrain (variance de
 *  teinte par tuile) + motifs de SOL appareillé (toutes projections, le sol reste affine en vue du
 *  dessus) + motifs d'appareillage vertical par (recette × orientation × variante). À joindre aux
 *  `<defs>` de tout stage/panneau affine dès que le LOD ≥ 1. */
export function detailPatternDefs(dims: Dims, mpt: number): string {
  let out = '';
  for (const t of tousLesTerrains()) {
    if (!t.detail?.tintVar) continue;
    for (let k = 0; k < TINT_SPREAD.length; k++) {
      const f = 1 + t.detail.tintVar * TINT_SPREAD[k];
      const stops = terrainStopsOrdonnes(t.stops)
        .map(([off, color]) => `<stop offset="${off}" stop-color="${shade(color, f)}"/>`)
        .join('');
      out += `<linearGradient id="${terrainGradientId(t.id)}-v${k}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`;
    }
  }
  const gb = groundBasis(dims, mpt);
  if (gb) {
    const seenT = new Set<string>();
    for (const t of tousLesTerrains()) {
      const c = t.detail?.courses;
      if (!c || seenT.has(coursesKey(c))) continue;
      seenT.add(coursesKey(c));
      out += groundCoursesPatternDef(c, coursesKey(c), gb, dims);
    }
  }
  if (isSquareView(dims.view)) return out; // vue du dessus : aucune face verticale → pas de motifs muraux
  for (const [key, c] of coursesRecipes()) {
    for (const axis of AXES) {
      const eu = axisMetreVec(axis, dims, mpt);
      if (degenerate(eu)) continue;
      for (let v = 0; v < N_VARIANTS; v++) out += coursesPatternDef(c, key, axis, eu, v, dims);
    }
  }
  return out;
}

// ── Sol : variance de teinte par tuile (variante de dégradé choisie au hash du monde) ────────────────

/** Id du dégradé de SOL d'une tuile : variante nuancée si la recette du terrain porte `tintVar` (et
 *  LOD ≥ 1), sinon le dégradé de base — le fill reste 1 nœud, la variance est GRATUITE. */
export function terrainFillGradient(terrainId: string, cell: { x: number; y: number; z: number }, lod: Lod): string | null {
  const t = terrainEntree(terrainId);
  if (!t) return null;
  const g = terrainGradientId(t.id);
  if (lod >= 1 && t.detail?.tintVar) return `${g}-v${hash32('tint', cell.x, cell.y, cell.z) % TINT_SPREAD.length}`;
  return g;
}

// ── Faces VERTICALES (murs, falaises) : motif partagé + accents alignés ──────────────────────────────
/** Contexte d'une face verticale porteuse de détail. `quad` = [haut-A, haut-B, bas-B, bas-A] écran ;
 *  `base` = fill DÉJÀ teinté de la face (les nuances de bloc en dérivent par `shade`) ; `reservedV` =
 *  intervalles [haut,bas] en MÈTRES depuis le HAUT de la face déjà occupés par un ornement PAR-DESSUS
 *  la maçonnerie (ferrures/bandes) — les accents s'y refusent (une nuance de pierre passe SOUS la ferrure). */
export interface VerticalFaceCtx {
  recipe: DetailRecipe;
  side: string;
  cell: { x: number; y: number; z: number };
  quad: Pt2[];
  faceWM: number;
  faceHM: number;
  base: string;
  seed: number;
  dims: Dims;
  mpt: number;
  reservedV?: [number, number][];
}

/** Soustrait les intervalles réservés d'un segment vertical [v0,v1] (mètres depuis le haut de face). */
function subtractReserved(v0: number, v1: number, reserved: [number, number][]): [number, number][] {
  let spans: [number, number][] = [[v0, v1]];
  for (const [r0, r1] of reserved) {
    const next: [number, number][] = [];
    for (const [a, b] of spans) {
      if (r1 <= a || r0 >= b) { next.push([a, b]); continue; }
      if (r0 > a) next.push([a, r0]);
      if (r1 < b) next.push([r1, b]);
    }
    spans = next;
  }
  return spans.filter(([a, b]) => b - a >= 0.08);
}

/** Surcouche de STRUCTURE d'une face verticale : le polygone de la face rempli du motif de joints
 *  partagé de son orientation. '' si la recette n'a pas d'assises ou si la face est de chant. */
export function coursesOverlaySvg(ctx: Pick<VerticalFaceCtx, 'recipe' | 'side' | 'cell' | 'quad' | 'dims' | 'mpt'>): string {
  const c = ctx.recipe.courses;
  const axis = AXIS_OF[ctx.side];
  if (!c || !axis || isSquareView(ctx.dims.view)) return '';
  if (degenerate(axisMetreVec(axis, ctx.dims, ctx.mpt))) return '';
  const id = patternId(coursesKey(c), axis, variantOf(ctx.cell, ctx.side), ctx.dims);
  return `<polygon points="${ctx.quad.map((p) => `${n2(p[0])},${n2(p[1])}`).join(' ')}" fill="url(#${id})"/>`;
}

/** Interpolation UV → écran d'un parallélogramme [tl,tr,br,bl] (u le long du haut, v vers le bas). */
const uvPoint = (quad: Pt2[], u: number, v: number): Pt2 => {
  const [tl, tr, , bl] = quad;
  return [tl[0] + u * (tr[0] - tl[0]) + v * (bl[0] - tl[0]), tl[1] + u * (tr[1] - tl[1]) + v * (bl[1] - tl[1])];
};

/** Petit losange « caillou » (sous-chemin) centré en `p`, rayon px. */
const dotSub = (p: Pt2, r: number): string =>
  `M${n2(p[0])},${n2(p[1] - r)}L${n2(p[0] + r * 1.2)},${n2(p[1])}L${n2(p[0])},${n2(p[1] + r * 0.8)}L${n2(p[0] - r * 1.1)},${n2(p[1])}Z`;

/** ACCENTS d'une face verticale (LOD 2) : blocs nuancés ALIGNÉS sur l'appareillage du motif (mêmes
 *  bornes de rangs/joints, énumérés en espace MOTIF via la base inverse) + mouchetis d'usure (UV de
 *  l'expansion, tassés au pied par `vBias`). Une recette SANS `blockWM` (rangs continus : planches)
 *  nuance des rangs ENTIERS — quelques planches plus claires/sombres. Sortie : UN `<path>` par couleur. */
export function verticalAccentsSvg(ctx: VerticalFaceCtx): string {
  const c = ctx.recipe.courses;
  const axis = AXIS_OF[ctx.side];
  if (!axis || isSquareView(ctx.dims.view)) return '';
  const eu = axisMetreVec(axis, ctx.dims, ctx.mpt);
  if (degenerate(eu)) return '';
  let out = '';

  if (c?.paletteVar) {
    // Espace MOTIF (mètres) : p_motif = M⁻¹·p_écran avec M = [eu | (0, ISO_PX_PER_M)] (sans translation).
    const inv = (p: Pt2): Pt2 => [p[0] / eu[0], (p[1] - (eu[1] * p[0]) / eu[0]) / ISO_PX_PER_M];
    const fwd = (pu: number, pv: number): Pt2 => [eu[0] * pu, eu[1] * pu + ISO_PX_PER_M * pv];
    const [tl, tr, , bl] = ctx.quad;
    const a = inv(tl), b = inv(tr);
    const pu0 = Math.min(a[0], b[0]), pu1 = Math.max(a[0], b[0]);
    const pv0 = inv(tl)[1], pv1 = inv(bl)[1];
    const key = coursesKey(c);
    const variant = variantOf(ctx.cell, ctx.side);
    const W = patternWM(c);
    const reserved = ctx.reservedV ?? [];
    let light = '', dark = '';
    for (let k = Math.floor(pv0 / c.hM); k * c.hM < pv1; k++) {
      const y0 = Math.max(k * c.hM, pv0) + BLOCK_INSET_M;
      const y1 = Math.min((k + 1) * c.hM, pv1) - BLOCK_INSET_M;
      if (y1 - y0 < 0.08) continue;
      const parity = (((k % 2) + 2) % 2) as 0 | 1;
      const bounds = rowBoundaries(c, key, variant, parity);
      const edges: number[] = [pu0];
      for (let n = Math.floor(pu0 / W); n * W <= pu1; n++)
        for (const bd of bounds) {
          const pos = n * W + bd;
          if (pos > pu0 && pos < pu1) edges.push(pos);
        }
      edges.sort((p, q) => p - q);
      edges.push(pu1);
      // Rang amputé des intervalles réservés (ferrures) : la nuance s'arrête à la ferrure, ne la couvre pas.
      const rowSpans = subtractReserved(y0 - pv0, y1 - pv0, reserved).map(([a, b]) => [a + pv0, b + pv0] as [number, number]);
      for (let i = 0; i + 1 < edges.length; i++) {
        const u0 = edges[i] + BLOCK_INSET_M, u1 = edges[i + 1] - BLOCK_INSET_M;
        if (u1 - u0 < 0.1) continue;
        const rv = seedStream(hash32(ctx.seed, 'blk', k, Math.round(edges[i] * 20)))();
        if (rv >= ACCENT_FRAC && rv <= 1 - ACCENT_FRAC) continue;
        for (const [s0, s1] of rowSpans) {
          const sub =
            `M${n2(fwd(u0, s0)[0])},${n2(fwd(u0, s0)[1])}L${n2(fwd(u1, s0)[0])},${n2(fwd(u1, s0)[1])}` +
            `L${n2(fwd(u1, s1)[0])},${n2(fwd(u1, s1)[1])}L${n2(fwd(u0, s1)[0])},${n2(fwd(u0, s1)[1])}Z`;
          if (rv < ACCENT_FRAC) light += sub;
          else dark += sub;
        }
      }
    }
    if (light) out += `<path d="${light}" fill="${shade(ctx.base, 1 + c.paletteVar * BLOCK_SHADE_K)}"/>`;
    if (dark) out += `<path d="${dark}" fill="${shade(ctx.base, 1 - c.paletteVar * BLOCK_SHADE_K)}"/>`;
  }

  if (ctx.recipe.speckle) {
    const e = expandRecipe({ speckle: ctx.recipe.speckle, seedScope: ctx.recipe.seedScope }, ctx.faceWM, ctx.faceHM, ctx.seed);
    const reserved = ctx.reservedV ?? [];
    const byColor = new Map<string, string>();
    for (const s of e.speckles) {
      const vM = s.v * ctx.faceHM; // mètres depuis le haut de la face
      if (reserved.some(([r0, r1]) => vM >= r0 - 0.03 && vM <= r1 + 0.03)) continue; // sous une ferrure
      byColor.set(s.color, (byColor.get(s.color) ?? '') + dotSub(uvPoint(ctx.quad, s.u, s.v), s.rM * ISO_PX_PER_M));
    }
    for (const [color, d] of byColor) out += `<path d="${d}" fill="${color}" opacity="0.75"/>`;
  }
  return out;
}

/** COLOMBAGE d'une face verticale (recette `timber`, LOD ≥ 1) : poteaux + écharpes X/V par travée
 *  (expansion déterministe, aucun aléa), bornés entre couronnement et plinthe, UN `<path>` stroké à la
 *  couleur de la recette. Dessiné APRÈS toutes les parties du mur — les pans de bois passent DEVANT le
 *  panneau, comme sur une façade à colombages. */
export function timberOverlaySvg(ctx: Pick<VerticalFaceCtx, 'recipe' | 'quad' | 'faceWM' | 'faceHM' | 'dims'>): string {
  const t = ctx.recipe.timber;
  if (!t || isSquareView(ctx.dims.view)) return '';
  const e = expandRecipe({ timber: t, seedScope: ctx.recipe.seedScope }, ctx.faceWM, ctx.faceHM, 0);
  if (!e.timber) return '';
  const v = (raw: number) => TIMBER_V0 + raw * (TIMBER_V1 - TIMBER_V0);
  const pt = (u: number, vRaw: number) => {
    const p = uvPoint(ctx.quad, u, v(vRaw));
    return `${n2(p[0])},${n2(p[1])}`;
  };
  let d = '';
  for (const u of e.timber.posts) d += `M${pt(u, 0)}L${pt(u, 1)}`;
  for (const b of e.timber.braces) d += `M${pt(b.u0, b.v0)}L${pt(b.u1, b.v1)}`;
  return `<path d="${d}" fill="none" stroke="${e.timber.color}" stroke-width="${n2(e.timber.wM * ISO_PX_PER_M)}" stroke-linecap="square"/>`;
}

// ── Sol : accents (touffes d'herbe, cailloux) ancrés MONDE — stables aux 4 rotations ─────────────────
/** Amplitude du PENCHÉ D'ÉCRAN d'une touffe : le 2ᵉ tirage du flux `blades` est étalé sur
 *  [−`TUFT_LEAN_AMPLITUDE`, +`TUFT_LEAN_AMPLITUDE`] avant d'entrer dans le tracé SVG. Quantum de CET
 *  émetteur seul — les backends monde (POV, WebGL) lisent le même rang comme un LACET et n'en ont pas
 *  l'usage. Exporté pour le test de parité `backends/webgl/groundAccents.test.ts`, qui décode le
 *  penché depuis le chemin SVG et doit savoir sur quoi il a été étalé. */
export const TUFT_LEAN_AMPLITUDE = 1.2;

/** ACCENTS de sol d'une tuile (LOD 2) : touffes (3 brins courbés par touffe, dressés à l'écran) et
 *  mouchetis, positions tirées en UV de TUILE puis projetées en GRILLE continue (`projGP`) → le brin
 *  reste sur le même point du MONDE quelle que soit la rotation caméra. BUDGET sol (≤ 2,5 nœuds/tuile) :
 *  la couleur se tire PAR TUILE dans la palette de la recette (UN `<path>` par section) — la variété
 *  de teinte vit ENTRE les tuiles (+ `tintVar`), pas entre les brins d'une même tuile.
 *
 *  CONTRAT DU FLUX `blades` — il a TROIS consommateurs : cet émetteur (penché d'écran), le POV
 *  et le WebGL (`backends/webgl/groundAccents.ts`), ces deux
 *  derniers lisant le 2ᵉ rang comme un LACET monde. L'ORDRE des tirages — DEUX par touffe, hauteur
 *  puis penché — est donc verrouillé : insérer, retirer ou permuter un tirage ici décale les trois
 *  backends et casse la parité mesurée par `backends/webgl/groundAccents.test.ts`. */
export function groundAccentsSvg(
  recipe: DetailRecipe,
  cell: { x: number; y: number; z: number },
  h: number,
  dims: Dims,
  mpt: number,
): string {
  const seed = hash32('floor', cell.x, cell.y, cell.z);
  const e = expandRecipe(recipe, mpt, mpt, seed);
  const at = (u: number, v: number): Pt2 => projGP({ x: cell.x - 0.5 + u, y: cell.y - 0.5 + v, h }, dims);
  const tileColor = (colors: string[], part: string) => colors[hash32(seed, part) % colors.length];
  let out = '';
  if (e.tufts.length) {
    const r = seedStream(hash32(seed, 'blades'));
    let d = '';
    for (const t of e.tufts) {
      const p = at(t.u, t.v);
      const hp = t.hM * ISO_PX_PER_M * (0.8 + r() * 0.5);
      const lean = (r() * 2 - 1) * TUFT_LEAN_AMPLITUDE;
      d +=
        `M${n2(p[0])},${n2(p[1])}q${n2(lean - 1.2)},${n2(-hp * 0.6)} ${n2(lean - 1.7)},${n2(-hp)}` +
        `M${n2(p[0])},${n2(p[1])}l${n2(lean * 0.4)},${n2(-hp * 1.15)}` +
        `M${n2(p[0])},${n2(p[1])}q${n2(lean + 1.2)},${n2(-hp * 0.6)} ${n2(lean + 1.7)},${n2(-hp * 0.85)}`;
    }
    out += `<path d="${d}" fill="none" stroke="${tileColor(recipe.tufts!.colors, 'tuftcol')}" stroke-width="0.9" stroke-linecap="round" opacity="0.9"/>`;
  }
  if (e.speckles.length) {
    let d = '';
    for (const s of e.speckles) d += dotSub(at(s.u, s.v), s.rM * ISO_PX_PER_M);
    out += `<path d="${d}" fill="${tileColor(recipe.speckle!.colors, 'dotcol')}" opacity="0.8"/>`;
  }
  return out;
}
