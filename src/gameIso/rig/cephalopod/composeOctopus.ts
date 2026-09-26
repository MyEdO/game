/**
 * Gabarit CÉPHALOPODE (pieuvre des tourbières — artwork LDB 79 p.325). Masse charnue BASSE et
 * grumeleuse posée au sol (verrues, marbrures @cheveux), petit œil discret noyé dans les replis
 * (iris @cuir), forêt de tentacules FINS et sinueux dressés en volutes étagées bien au-dessus du
 * corps (la plus haute frôle le haut du cadre 120×150) — les bras avant
 * s'enroulent devant le manteau ou rampent au sol. Anim propre au plan : ondulation des volutes
 * au repos, projection à l'attaque, affaissement à la mort. Réutilise la machinerie (FK, palette
 * tokenisée, rendu).
 */
import type { BonePose } from '../poses';
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, PaletteDeclaree } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { OCTOPUS_SPECIES } from '../creatures';
import { sortByZ } from '../composite';

export type OctoBoneId = 'tentacules' | 'corps' | 'bras';
type OBone = FKBone & { z: number };
export interface OctopusProps {
  sl: number;
  girth: number; // grosseur du manteau
  palette: PaletteDeclaree;
}

function buildSkeleton(): Record<OctoBoneId, OBone> {
  return {
    tentacules: { parent: 'corps', pivot: { x: 0, y: 16 }, angle: 0, z: 2 }, // volutes ARRIÈRE, derrière le manteau
    corps: { parent: null, pivot: { x: 60, y: 133 }, angle: 0, z: 3 }, // masse charnue posée au sol (base ≈ y150)
    bras: { parent: 'corps', pivot: { x: 0, y: 15 }, angle: 0, z: 4 }, // bras AVANT, devant le manteau
  };
}

// --- tentacule effilé en volute -------------------------------------------
type Pt = readonly [number, number];
const P = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
function norm(a: Pt, b: Pt): Pt {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  return [dy / l, -dx / l];
}
const off = (p: Pt, n: Pt, w: number): Pt => [p[0] + n[0] * w, p[1] + n[1] * w];
/** Amplifie la composante PERPENDICULAIRE d'un point de contrôle par rapport à la corde p0→p3
 *  (k>1 = courbe en S plus prononcée, sans déplacer ni la base ni la pointe). */
function sway(p0: Pt, p3: Pt, c: Pt, k: number): Pt {
  const cx = p3[0] - p0[0], cy = p3[1] - p0[1], l = Math.hypot(cx, cy) || 1;
  const ux = cx / l, uy = cy / l;
  const dx = c[0] - p0[0], dy = c[1] - p0[1];
  const par = dx * ux + dy * uy;
  return [p0[0] + par * ux + (dx - par * ux) * k, p0[1] + par * uy + (dy - par * uy) * k];
}
/** Ruban EFFILÉ le long d'une cubique p0→c1→c2→p3 : large (w) à la base, s'amincit VITE (le
 *  gros du bras est fin), pointe fine recourbée en crosse ample via `curl` (contrôle du bout).
 *  + ventouses (tirets clairs) et rugosités (taches sombres) le long de l'axe — le tentacule
 *  est charnu et grumeleux, pas un tube lisse. */
function volute(p0: Pt, rc1: Pt, rc2: Pt, p3: Pt, w: number, curl: Pt): string {
  // sinuosité : les contrôles s'écartent davantage de la corde → vrais S, pas des roseaux droits
  const c1 = sway(p0, p3, rc1, 1.55), c2 = sway(p0, p3, rc2, 1.55);
  const n0 = norm(p0, c1), n1 = norm(p0, c2), n2 = norm(c1, p3), n3 = norm(c2, p3);
  const w1 = w * 0.52, w2 = w * 0.24, w3 = w * 0.11;
  const d =
    `M${P(off(p0, n0, w))} C${P(off(c1, n1, w1))} ${P(off(c2, n2, w2))} ${P(off(p3, n3, w3))} ` +
    `L${P(off(p3, n3, -w3))} ` +
    `C${P(off(c2, n2, -w2))} ${P(off(c1, n1, -w1))} ${P(off(p0, n0, -w))} Z`;
  // crosse : TRAIT fin qui prolonge l'axe, dépasse `curl` puis se rabat vers le flanc interne
  // (-n3) — pointe enroulée en volute, ni bout arrondi ni lobe charnu
  const dx = curl[0] - p3[0], dy = curl[1] - p3[1], hl = Math.hypot(dx, dy);
  // départ de crosse TANGENT à l'axe (c2→p3) pour une jonction sans cassure
  const tx0 = p3[0] - c2[0], ty0 = p3[1] - c2[1], tl = Math.hypot(tx0, ty0) || 1;
  const ext: Pt = [p3[0] + (tx0 / tl) * hl * 1.1, p3[1] + (ty0 / tl) * hl * 1.1];
  const wrapC: Pt = [curl[0] + dx * 0.6 - n3[0] * hl * 0.6, curl[1] + dy * 0.6 - n3[1] * hl * 0.6];
  const hookEnd: Pt = [curl[0] - n3[0] * hl * 0.7, curl[1] - n3[1] * hl * 0.7];
  const hook = `M${P(p3)} C${P(ext)} ${P(wrapC)} ${P(hookEnd)}`;
  const crosse =
    `<path d="${hook}" fill="none" stroke="@corpsO" stroke-width="${(w * 0.22 + 1.1).toFixed(1)}" stroke-linecap="round"/>` +
    `<path d="${hook}" fill="none" stroke="@corps" stroke-width="${(w * 0.22).toFixed(1)}" stroke-linecap="round"/>`;
  const axis = `M${P(p0)} C${P(c1)} ${P(c2)} ${P(p3)}`;
  return `<path d="${d}" fill="@corps" stroke="@corpsO" stroke-width="0.7" stroke-linejoin="round"/>` + crosse +
    `<path d="${axis}" fill="none" stroke="@corpsO" stroke-width="${(w * 0.22).toFixed(1)}" opacity="0.18" stroke-dasharray="2.8 4.2"/>` +
    `<path d="${axis}" fill="none" stroke="@corpsH" stroke-width="0.7" opacity="0.45" stroke-dasharray="0.9 2.4"/>`;
}

/** Volutes ARRIÈRE (6 bras) : forêt de volutes FINES et sinueuses (courbes en S), dressées
 *  haut au-dessus du manteau — hauteurs étagées, la plus haute frôle le haut du cadre. */
function tentaclesArriere(view: View): string {
  if (view === 'profile') {
    // PROFIL : traîne au sol côté dos (-x) + volutes hautes étagées en S, pointes en crosse
    return `<g>` +
      volute([-18, -2], [-34, -4], [-46, -16], [-44, -34], 3.6, [-38, -42]) +
      volute([-13, -6], [-38, -30], [-8, -60], [-30, -92], 4, [-40, -96]) +
      volute([-6, -8], [-24, -36], [2, -58], [-14, -84], 3.8, [-22, -92]) +
      volute([2, -8], [18, -44], [-14, -78], [6, -122], 4, [16, -126]) +
      volute([8, -6], [28, -24], [6, -56], [24, -86], 3.8, [32, -90]) +
      volute([14, -4], [36, -14], [44, -44], [32, -70], 3.6, [22, -78]) +
      `</g>`;
  }
  return `<g>` +
    volute([-18, -6], [-40, -28], [-12, -64], [-30, -96], 4, [-40, -102]) +
    volute([-10, -8], [-28, -38], [0, -70], [-14, -104], 4, [-22, -112]) +
    volute([-3, -10], [12, -46], [-16, -80], [0, -122], 4, [8, -128]) +
    volute([4, -10], [22, -34], [-2, -70], [14, -100], 3.8, [24, -106]) +
    volute([11, -8], [30, -28], [10, -60], [26, -88], 3.8, [36, -92]) +
    volute([17, -6], [38, -20], [44, -52], [30, -78], 3.6, [22, -86]) +
    `</g>`;
}
/** Bras AVANT (3-4 bras) : s'enroulent devant le manteau, un bras rampe au sol. */
function tentaclesAvant(view: View): string {
  if (view === 'profile') {
    // PROFIL directionnel : un bras éclaireur rampe loin devant (+x), deux se dressent en crosse
    return `<g>` +
      volute([12, 0], [28, 6], [40, -2], [48, -10], 3.4, [50, -18]) +
      volute([14, -2], [28, -18], [18, -50], [30, -76], 3.6, [39, -80]) +
      volute([2, -2], [14, -20], [0, -40], [12, -60], 3.2, [20, -62]) +
      `</g>`;
  }
  return `<g>` +
    volute([-20, 0], [-30, -16], [-26, -44], [-34, -64], 3.8, [-40, -72]) +
    volute([20, 0], [30, -14], [24, -44], [32, -66], 3.8, [38, -74]) +
    volute([-13, 1], [-24, 3], [-34, 0], [-42, -4], 3.4, [-46, -10]) +
    volute([13, 1], [24, 3], [34, 0], [42, -4], 3.4, [46, -10]) +
    `</g>`;
}

function mantle(p: OctopusProps, view: View): string {
  const g = p.girth;
  // masse BASSE et bosselée (pas de tête-sac dressée) : contour irrégulier, base large au sol
  const body = `<path d="M-20 8 C-22 2 -21 -4 -16 -7 Q-13 -11 -8 -9 Q-4 -13 1 -10 Q6 -13 10 -9 Q15 -11 17 -6 C21 -3 22 3 20 8 C15 13 6 14 0 14 C-7 14 -15 13 -20 8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8" stroke-linejoin="round"/>`;
  const warts = `<g fill="@corpsO" opacity="0.35"><circle cx="-11" cy="-3" r="1.2"/><circle cx="-5" cy="-7" r="0.9"/><circle cx="4" cy="-6" r="1.1"/><circle cx="12" cy="-2" r="0.9"/><circle cx="-15" cy="3" r="1"/><circle cx="9" cy="5" r="1.3"/><circle cx="-2" cy="2" r="0.8"/></g>` +
    `<g fill="@corpsH" opacity="0.5"><circle cx="-8" cy="-5" r="0.6"/><circle cx="2" cy="-8" r="0.55"/><circle cx="14" cy="1" r="0.6"/><circle cx="-13" cy="0" r="0.5"/></g>`;
  const marbling = `<g fill="@cheveux" opacity="0.45"><path d="M-17 -1 q4 -4 8 -2 q3 2 -1 4 q-5 2 -7 -2 z"/><path d="M3 6 q5 -3 9 0 q2 3 -3 4 q-6 1 -6 -4 z"/><path d="M6 -9 q4 -2 6 1 q1 2 -3 2 q-4 0 -3 -3 z"/></g>`;
  const sheen = `<ellipse cx="-3" cy="-5" rx="8" ry="3.5" fill="@corpsH" opacity="0.22"/>`;
  const flesh = body + warts + marbling + sheen;
  if (view === 'back') return `<g transform="scale(${g})">${flesh}<path d="M0 -10 L0 12" stroke="@corpsO" stroke-width="0.7" opacity="0.4"/></g>`;
  if (view === 'profile') {
    // PROFIL : UN seul PETIT œil noyé dans un repli, côté avant (+x)
    const eye = `<path d="M8.6 -4.4 q3.6 -2.2 6.8 -0.4" fill="none" stroke="@corpsO" stroke-width="0.7" opacity="0.6"/>` +
      `<ellipse cx="12" cy="-2" rx="2.2" ry="1.8" fill="@cuir" stroke="@corpsO" stroke-width="0.5"/>` +
      `<rect x="10.9" y="-2.5" width="2.2" height="1" rx="0.5" fill="#0a0603"/>`;
    return `<g transform="scale(${g}) rotate(-4)">${flesh}${eye}</g>`;
  }
  // FACE : deux PETITS yeux discrets sous des replis de chair, pupille horizontale (tell céphalopode)
  const eyes = `<path d="M2.6 -3.6 q4 -2.4 7.4 -0.6" fill="none" stroke="@corpsO" stroke-width="0.7" opacity="0.6"/>` +
    `<ellipse cx="6" cy="-1" rx="2.2" ry="1.8" fill="@cuir" stroke="@corpsO" stroke-width="0.5"/>` +
    `<rect x="4.9" y="-1.5" width="2.2" height="1" rx="0.5" fill="#0a0603"/>` +
    `<path d="M-9.4 -2.8 q2.4 -1.8 4.6 -0.6" fill="none" stroke="@corpsO" stroke-width="0.7" opacity="0.6"/>` +
    `<ellipse cx="-7" cy="-1.2" rx="1.8" ry="1.4" fill="@cuir" stroke="@corpsO" stroke-width="0.5"/>` +
    `<rect x="-7.9" y="-1.6" width="1.8" height="0.9" rx="0.45" fill="#0a0603"/>`;
  return `<g transform="scale(${g})">${flesh}${eyes}</g>`;
}

// --- poses (DELTA additif) ------------------------------------------------
export const OCTO_REST: Record<string, number> = {};
/** Ondulation : les volutes ondulent (avant/arrière en contre-phase), le manteau pulse. phase ∈ [0,1). */
export function octoWrithe(phase: number): Record<string, number> {
  const s = Math.sin(phase * Math.PI * 2);
  return { tentacules: s * 6, bras: -s * 5, corps: s * 2 };
}
/** Projection : le corps fonce, les bras se tendent en avant. phase ∈ [0,1]. */
export function octoLunge(phase: number): Record<string, number> {
  const k = Math.sin(Math.min(1, phase) * Math.PI);
  return { corps: k * 14, tentacules: k * 22, bras: k * 26 };
}
/** Mort : manteau affaissé, volutes retombées. */
export const OCTO_DEATH: Record<string, number> = { corps: 22, tentacules: 30, bras: 34 };

export function resolveOctopusFromProps(
  p: OctopusProps,
  view: View = 'front',
  pose: BonePose = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<OctoBoneId, Matrix>;
  const tmap = buildTokenMap([p.palette], colors ?? {});
  const art: Record<OctoBoneId, string> = { tentacules: tentaclesArriere(view), corps: mantle(p, view), bras: tentaclesAvant(view) };
  return sortByZ((Object.keys(sk) as OctoBoneId[])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    })));
}

export const OCTOPUS_DEFAULT: OctopusProps = {
  sl: 1.05, girth: 1.0,
  palette: { corps: '#8a6238', corpsO: '#452e16', corpsH: '#c2a068', cheveux: '#6b6d3a', cheveuxO: '#3a3c1f', cuir: '#b98f47' },
};

export function resolveOctopus(species: string, view: View = 'front', pose: BonePose = {}, colors?: Palette): ResolvedBone[] {
  return resolveOctopusFromProps(OCTOPUS_SPECIES[species] ?? OCTOPUS_DEFAULT, view, pose, colors);
}
export const cephalopodPlan: BodyPlan = {
  id: 'cephalopod',
  resolve: (sp, view, pose, opts) => resolveOctopus(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(OCTOPUS_SPECIES),
  restPose: () => OCTO_REST,
  idlePose: (phase) => octoWrithe(phase * 0.5), // ondulation douce des volutes au repos
  walkPose: octoWrithe,
  attackPose: octoLunge,
  deathPose: () => OCTO_DEATH,
  hasView: () => true,
};

export function octopusSvg(
  p: OctopusProps,
  view: View,
  opts: { dead?: boolean; writhePhase?: number; colors?: Palette } = {},
): string {
  const pose = opts.dead ? OCTO_DEATH : opts.writhePhase != null ? octoWrithe(opts.writhePhase) : {};
  return bonesToSvg(resolveOctopusFromProps(p, view, pose, opts.colors));
}
