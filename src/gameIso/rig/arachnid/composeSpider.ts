/**
 * Gabarit ARACHNIDE (araignée géante). Vue de dessus-3/4 : gros abdomen à l'arrière (qui PULSE),
 * céphalothorax devant avec yeux + chélicères, 8 pattes arquées rayonnant de part et d'autre.
 * Anim propre au plan : pulsation de l'abdomen + frémissement au repos, ruée à l'attaque, pattes
 * recroquevillées à la mort. Réutilise la machinerie (FK générique, palette tokenisée, rendu).
 */
import type { BonePose } from '../poses';
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, PaletteDeclaree } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { SPIDER_SPECIES } from '../creatures';
import { sortByZ } from '../composite';

export type SpiderBoneId = 'corps' | 'abdomen';
type SBone = FKBone & { z: number };
export interface SpiderProps {
  sl: number; // échelle token
  girth: number; // grosseur de l'abdomen
  palette: PaletteDeclaree; // robe (corps/corpsO/corpsH…)
}

function buildSkeleton(): Record<SpiderBoneId, SBone> {
  return {
    corps: { parent: null, pivot: { x: 60, y: 96 }, angle: 0, z: 3 }, // céphalothorax + pattes + face
    abdomen: { parent: 'corps', pivot: { x: 0, y: -15 }, angle: 0, z: 2 }, // gros bulbe arrière (derrière)
  };
}

// une patte ARTICULÉE d'un côté (sx=±1) : coxa au corps → GENOU HAUT marqué → tibia qui plonge
// au pied. Fidélité artwork (LDB 78 p.316) : SEGMENTÉE (fémur épais / tibia plus fin + bandes pâles
// aux articulations), VELUE (soies dressées le long des segments), GRIFFE sombre marquée au tarse.
// dx = biais directionnel (profil).
function leg(sx: number, ay: number, kneeX: number, footX: number, footY: number, dx = 0): string {
  const bx = sx * 9, kx = sx * kneeX + dx, fx = sx * footX + dx * 1.6;
  const ky = ay - 15;
  const dF = `M${bx} ${ay} Q${(bx + (kx - bx) * 0.7).toFixed(1)} ${ay - 12} ${kx.toFixed(1)} ${ky}`; // fémur
  const dT = `M${kx.toFixed(1)} ${ky} Q${(kx + (fx - kx) * 0.3).toFixed(1)} ${(ky + (footY - ky) * 0.55).toFixed(1)} ${fx.toFixed(1)} ${footY}`; // tibia+métatarse
  // bandes pâles PERPENDICULAIRES au tibia (segmentation de l'artwork)
  const band = (t: number, w: number) => {
    const px = kx + (fx - kx) * t, py = ky + (footY - ky) * t;
    const len = Math.hypot(fx - kx, footY - ky) || 1;
    const nx = (-(footY - ky) / len) * w, ny = ((fx - kx) / len) * w;
    return `M${(px - nx).toFixed(1)} ${(py - ny).toFixed(1)} L${(px + nx).toFixed(1)} ${(py + ny).toFixed(1)}`;
  };
  // soies (pilosité) : courtes, dressées vers l'extérieur, sur fémur ET tibia
  const hairs = `M${(bx + (kx - bx) * 0.45).toFixed(1)} ${ay - 8} l${sx * 2.4} -2.4` +
    ` M${(bx + (kx - bx) * 0.8).toFixed(1)} ${(ay - 12.6).toFixed(1)} l${sx * 2} -2.2` +
    ` M${(kx + (fx - kx) * 0.35).toFixed(1)} ${(ky + (footY - ky) * 0.4).toFixed(1)} l${sx * 2.6} -1` +
    ` M${(kx + (fx - kx) * 0.7).toFixed(1)} ${(ky + (footY - ky) * 0.75).toFixed(1)} l${sx * 2.4} -0.8`;
  return `<path d="${dF}" fill="none" stroke="@corps" stroke-width="6.2" stroke-linecap="round"/>` +
    `<path d="${dT}" fill="none" stroke="@corps" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="${dF} ${dT}" fill="none" stroke="@corpsO" stroke-width="0.9" opacity="0.45" stroke-linecap="round"/>` +
    `<path d="${band(0.38, 1.9)} ${band(0.72, 1.6)}" stroke="@corpsH" stroke-width="1.1" opacity="0.7" fill="none"/>` +
    `<path d="${hairs}" stroke="@corpsO" stroke-width="0.7" stroke-linecap="round" fill="none"/>` +
    `<circle cx="${kx.toFixed(1)}" cy="${ky}" r="2.6" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` + // genou

    `<path d="M${fx.toFixed(1)} ${footY} q${sx * 1.4} 1.6 ${sx * 2.6} 2 M${fx.toFixed(1)} ${footY} q${sx * 0.1} 1.9 ${sx * 0.9} 2.9" fill="none" stroke="#1a130c" stroke-width="1.1" stroke-linecap="round"/>`; // griffe
}
const LEGS = [
  { ay: -8, kneeX: 24, footX: 23, footY: 16 },
  { ay: -3, kneeX: 31, footX: 31, footY: 27 },
  { ay: 3, kneeX: 31, footX: 31, footY: 38 },
  { ay: 8, kneeX: 25, footX: 21, footY: 48 },
];
function cephalo(view: View): string {
  // PROFIL : sprawl DIRECTIONNEL (les paires avant tendues vers +x, les arrière en arrière)
  // + face décalée vers l'avant — la roue radiale identique à la face tuait l'orientation.
  const prof = view === 'profile';
  const legs = LEGS.map((l, i) => {
    const bias = prof ? (i < 2 ? 6 : -6) : 0;
    return leg(1, l.ay, l.kneeX, l.footX, l.footY, bias) + leg(-1, l.ay, l.kneeX * (prof ? 0.8 : 1), l.footX * (prof ? 0.78 : 1), l.footY, bias);
  }).join('');
  // chélicères ÉPAISSES + crochets COURBÉS vers l'intérieur (les bâtonnets droits lisaient inoffensifs)
  const chelicerae = `<path d="M-3.2 14 Q-5 18 -2.8 20.6 M3.2 14 Q5 18 2.8 20.6" fill="none" stroke="@corpsO" stroke-width="2.7" stroke-linecap="round"/>` +
    `<path d="M-2.8 20 Q-3.6 23.4 -0.8 24.6 Q-2.8 22.8 -1.7 20.2 Z" fill="#e8e0c8" stroke="#9a8f78" stroke-width="0.3"/>` +
    `<path d="M2.8 20 Q3.6 23.4 0.8 24.6 Q2.8 22.8 1.7 20.2 Z" fill="#e8e0c8" stroke="#9a8f78" stroke-width="0.3"/>`;
  // cluster de 8 yeux BIEN VISIBLES (artwork LDB 78 p.316) : plaque oculaire pâle, globes noirs
  // vernissés cerclés de crème, reflet clair — paire médiane dominante + rangées latérales.
  const eye = (x: number, y: number, r: number) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#171d12" stroke="#e6d8b4" stroke-width="${(r * 0.28).toFixed(2)}"/>` +
    `<circle cx="${(x - r * 0.3).toFixed(1)}" cy="${(y - r * 0.35).toFixed(1)}" r="${(r * 0.32).toFixed(2)}" fill="#f4eede" opacity="0.85"/>`;
  const eyeCluster = `<ellipse cx="0" cy="10.6" rx="7" ry="4.8" fill="@corpsH" opacity="0.55"/>` +
    eye(-2.3, 9.2, 2.2) + eye(2.3, 9.2, 2.2) +
    eye(-5.3, 10.6, 1.25) + eye(5.3, 10.6, 1.25) +
    eye(-1.8, 12.8, 1.05) + eye(1.8, 12.8, 1.05) +
    eye(-4.3, 13.4, 0.85) + eye(4.3, 13.4, 0.85);
  const face = view === 'back'
    ? '' // de dos : pas d'yeux/chélicères (on voit la nuque)
    : prof
      ? `<g transform="translate(5,0)">${eyeCluster}${chelicerae}</g>`
      : `<g>${eyeCluster}${chelicerae}</g>`;
  return `<g>${legs}` +
    `<ellipse cx="${prof ? 2 : 0}" cy="3" rx="11" ry="13" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<ellipse cx="${prof ? 1 : 0}" cy="0" rx="7" ry="8" fill="@corpsH" opacity="0.3"/>` +
    // soies du céphalothorax (pilosité générale de l'artwork)
    `<path d="M-10.6 -2 l-2 -1.4 M10.6 -2 l2 -1.4 M-9.4 7 l-2 0.8 M9.4 7 l2 0.8 M-6 -9.5 l-1.4 -1.8 M6 -9.5 l1.4 -1.8" stroke="@corpsO" stroke-width="0.6" stroke-linecap="round" fill="none"/>` +
    face + `</g>`;
}
function abdomen(p: SpiderProps, view: View): string {
  const g = p.girth, rx = 15 * g, ry = 17 * g;
  const off = view === 'profile' ? -5 : 0; // profil : l'abdomen TRAÎNE derrière (-x)
  const mark = view === 'back'
    ? `<path d="M0 ${-ry + 4} L0 ${ry - 4}" stroke="@corpsO" stroke-width="1.2" opacity="0.6"/>` // sillon dorsal
    // robe MOUCHETÉE de l'artwork (taches sombres irrégulières) + sillon dorsal — pas de sablier
    : `<g fill="@corpsO" opacity="0.26">` +
      `<ellipse cx="${(off - 6).toFixed(1)}" cy="${(-ry * 0.48).toFixed(1)}" rx="3.6" ry="2" transform="rotate(-18 ${(off - 6).toFixed(1)} ${(-ry * 0.48).toFixed(1)})"/>` +
      `<ellipse cx="${(off + 3.5).toFixed(1)}" cy="${(-ry * 0.22).toFixed(1)}" rx="2.6" ry="1.5" transform="rotate(14 ${(off + 3.5).toFixed(1)} ${(-ry * 0.22).toFixed(1)})"/>` +
      `<ellipse cx="${(off + 6.5).toFixed(1)}" cy="${(ry * 0.14).toFixed(1)}" rx="2.2" ry="1.3" transform="rotate(30 ${(off + 6.5).toFixed(1)} ${(ry * 0.14).toFixed(1)})"/>` +
      `<ellipse cx="${(off - 4).toFixed(1)}" cy="${(ry * 0.3).toFixed(1)}" rx="2.8" ry="1.4" transform="rotate(-24 ${(off - 4).toFixed(1)} ${(ry * 0.3).toFixed(1)})"/>` +
      `</g>` +
      `<path d="M${off} ${(-ry + 3).toFixed(1)} Q${off - 1.5} 0 ${off} ${(ry - 5).toFixed(1)}" stroke="@corpsO" stroke-width="0.8" fill="none" opacity="0.5"/>`;
  return `<g>` +
    `<ellipse cx="${off}" cy="0" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<ellipse cx="-3" cy="-4" rx="${(rx * 0.5).toFixed(1)}" ry="${(ry * 0.5).toFixed(1)}" fill="@corpsH" opacity="0.28"/>` +
    mark +
    // pilosité DENSE sur le pourtour (texture pileuse générale de l'artwork)
    `<path d="M${-rx + 1} -2 l-2 -1 M${rx - 1} -2 l2 -1 M-6 ${-ry + 1} l-1 -2 M6 ${-ry + 1} l1 -2 M0 ${-ry} l0 -2.4` +
    ` M${(-rx * 0.72).toFixed(1)} ${(-ry * 0.66).toFixed(1)} l-1.6 -1.8 M${(rx * 0.72).toFixed(1)} ${(-ry * 0.66).toFixed(1)} l1.6 -1.8` +
    ` M${(-rx + 1).toFixed(1)} 6 l-2.2 0.6 M${(rx - 1).toFixed(1)} 6 l2.2 0.6 M-4 ${(ry - 1).toFixed(1)} l-1 2.2 M4 ${(ry - 1).toFixed(1)} l1 2.2" stroke="@corpsO" stroke-width="0.7" stroke-linecap="round" fill="none"/>` +
    `</g>`;
}

// --- poses (DELTA additif) ------------------------------------------------
export const SPIDER_REST: Record<string, number> = {};
/** Frémissement au repos : l'abdomen pulse (léger balancement). phase ∈ [0,1). */
export function spiderIdle(phase: number): Record<string, number> {
  return { abdomen: Math.sin(phase * Math.PI * 2) * 4 };
}
/** Ruée : le corps se penche en avant, l'abdomen se relève. phase ∈ [0,1]. */
export function spiderRush(phase: number): Record<string, number> {
  const k = Math.sin(Math.min(1, phase) * Math.PI);
  return { corps: k * 10, abdomen: -k * 8 };
}
/** Mort : sur le dos (corps basculé), pattes en l'air. */
export const SPIDER_DEATH: Record<string, number> = { corps: 168 };

export function resolveSpiderFromProps(
  p: SpiderProps,
  view: View = 'front',
  pose: BonePose = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<SpiderBoneId, Matrix>;
  const tmap = buildTokenMap([p.palette], colors ?? {});
  const art: Record<SpiderBoneId, string> = { corps: cephalo(view), abdomen: abdomen(p, view) };
  return sortByZ((Object.keys(sk) as SpiderBoneId[])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    })));
}

export const SPIDER_DEFAULT: SpiderProps = {
  sl: 1.0, girth: 1.0,
  palette: { corps: '#2e2622', corpsO: '#181210', corpsH: '#574438', cheveux: '#181210', cheveuxO: '#0e0a08', cuir: '#7a1010' },
};

export function resolveSpider(species: string, view: View = 'front', pose: BonePose = {}, colors?: Palette): ResolvedBone[] {
  return resolveSpiderFromProps(SPIDER_SPECIES[species] ?? SPIDER_DEFAULT, view, pose, colors);
}
export const arachnidPlan: BodyPlan = {
  id: 'arachnid',
  resolve: (sp, view, pose, opts) => resolveSpider(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(SPIDER_SPECIES),
  restPose: () => SPIDER_REST,
  idlePose: (phase) => spiderIdle(phase * 0.5), // frémissement de l'abdomen au repos
  walkPose: spiderIdle, // scuttle = pulsation ample
  attackPose: spiderRush,
  deathPose: () => SPIDER_DEATH,
  hasView: () => true,
};

export function spiderSvg(
  p: SpiderProps,
  view: View,
  opts: { dead?: boolean; idlePhase?: number; colors?: Palette } = {},
): string {
  const pose = opts.dead ? SPIDER_DEATH : opts.idlePhase != null ? spiderIdle(opts.idlePhase) : {};
  return bonesToSvg(resolveSpiderFromProps(p, view, pose, opts.colors));
}
