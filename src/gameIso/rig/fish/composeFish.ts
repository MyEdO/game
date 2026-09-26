/**
 * Gabarit POISSON (brochet géant : Brochet du Stir — ZI). Corps fusiforme HORIZONTAL, longue gueule
 * dentée de brochet (à droite, +x), grande nageoire caudale fourchue (queue, -x) + dorsale/pectorale/
 * anale. Anim propre au plan : godille de la caudale au repos, ondulation à la nage, coup de queue
 * ample à l'attaque (« Queue mortelle »), affaissement à la mort. Réutilise la machinerie (FK générique,
 * palette tokenisée, rendu) — comme composeSerpent, mais squelette HORIZONTAL (≠ son tas lové).
 */
import type { BonePose } from '../poses';
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, PaletteDeclaree } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { FISH_SPECIES } from '../creatures';
import { sortByZ } from '../composite';

export type FishBoneId = 'corps' | 'caudale';
type FBone = FKBone & { z: number };
export interface FishProps {
  sl: number; // échelle token
  girth: number; // épaisseur (hauteur) du corps fusiforme
  palette: PaletteDeclaree; // dos (corps) / ventre (corpsH) / contour (corpsO)
}

function buildSkeleton(): Record<FishBoneId, FBone> {
  return {
    corps: { parent: null, pivot: { x: 52, y: 92 }, angle: 0, z: 3 }, // corps + tête + nageoires
    caudale: { parent: 'corps', pivot: { x: -30, y: 0 }, angle: 0, z: 2 }, // nageoire caudale (queue qui godille)
  };
}

function body(p: FishProps): string {
  const g = p.girth, H = (n: number) => (n * g).toFixed(1);
  // corps fusiforme : tête épaisse à droite (+x), effilé vers la queue (-x)
  const fish = `<path d="M-30 0 Q-22 ${H(-9)} -6 ${H(-11)} Q12 ${H(-12)} 26 ${H(-7)} Q33 ${H(-3)} 34 0 Q33 ${H(3)} 26 ${H(7)} Q12 ${H(12)} -6 ${H(11)} Q-22 ${H(9)} -30 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>`;
  const belly = `<path d="M-24 ${H(5)} Q0 ${H(11)} 24 ${H(5)} Q12 ${H(8)} -6 ${H(8)} Z" fill="@corpsH" opacity="0.4"/>`;
  const lateral = `<path d="M-26 ${H(-2)} Q0 ${H(-3)} 28 ${H(-1)}" stroke="@corpsO" stroke-width="0.7" fill="none" opacity="0.5"/>`;
  // robe MOUCHETÉE (art ZI 4 p.36) : rangées de taches claires ovales sur tout le flanc gris-vert
  let sd = '';
  const spots: [number, number, number][] = [
    [-25, -3, 0.9], [-20, -6, 1.0], [-17, 1, 1.1], [-12, -4, 1.2], [-9, 4, 1.0], [-4, -7, 1.1],
    [-2, 0, 1.3], [3, 6, 1.0], [5, -4, 1.2], [10, 2, 1.1], [12, -7, 1.0], [16, -2, 1.2],
    [20, 3, 0.9], [22, -5, 0.9], [-22, 4, 0.9], [-14, 7, 0.9], [8, 8, 0.8], [18, 6, 0.8],
  ];
  for (const [x, y, s] of spots) sd += `M${x - 1.4 * s} ${H(y)} a${(1.4 * s).toFixed(1)} ${(0.9 * s).toFixed(1)} 0 1 0 ${(2.8 * s).toFixed(1)} 0 a${(1.4 * s).toFixed(1)} ${(0.9 * s).toFixed(1)} 0 1 0 ${(-2.8 * s).toFixed(1)} 0 `;
  const mottling = `<path d="${sd}" fill="@corpsH" opacity="0.7"/>`;
  // museau de brochet (signature, art ZI 4 p.36) : LONG bec plat en « bec de canard », gueule
  // entrouverte hérissée de rangées de dents pointues
  const gape = `<path d="M27 ${H(-1.3)} Q44 ${H(-1.7)} 56.5 ${H(-1.3)} Q50 ${H(1.4)} 53.5 ${H(3)} Q42 ${H(2.1)} 27 ${H(2)} Z" fill="#231a10"/>`;
  const lower = `<path d="M27 ${H(2)} L40 ${H(2.2)} Q49 ${H(2.4)} 53.5 ${H(3.1)} Q49 ${H(5)} 40 ${H(5.6)} Q32 ${H(6)} 27 ${H(5.2)} Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`;
  const upper = `<path d="M27 ${H(-5.8)} Q40 ${H(-5.2)} 50 ${H(-3.6)} Q56 ${H(-2.4)} 57 ${H(-1.3)} Q46 ${H(-1.7)} 34 ${H(-1.4)} L27 ${H(-1.2)} Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M30 ${H(-4.4)} Q42 ${H(-4)} 52 ${H(-2.6)}" stroke="@corpsO" stroke-width="0.5" fill="none" opacity="0.5"/>` +
    `<circle cx="51" cy="${H(-2.6)}" r="0.6" fill="@corpsO" opacity="0.7"/>`; // narine
  let td = '', bd = '';
  for (let x = 30; x <= 54; x += 2.4) td += `M${x.toFixed(1)} ${H(-1.5)} l0.8 ${(2.4 * g).toFixed(1)} l0.8 ${(-2.4 * g).toFixed(1)} Z `;
  for (let x = 31.2; x <= 51.5; x += 2.4) bd += `M${x.toFixed(1)} ${H(2.4)} l0.8 ${(-2 * g).toFixed(1)} l0.8 ${(2 * g).toFixed(1)} Z `;
  const teeth = `<path d="${td}" fill="#ece4cc" stroke="#8a7f60" stroke-width="0.25"/><path d="${bd}" fill="#ece4cc" stroke="#8a7f60" stroke-width="0.25"/>`;
  const eye = `<circle cx="26" cy="${H(-4)}" r="2.4" fill="#d8c038"/><circle cx="26.7" cy="${H(-4)}" r="1.1" fill="#0a0603"/>`;
  // nageoires de brochet : dorsale RECULÉE près de la queue (face à l'anale), pelvienne au ventre
  const dorsal = `<path d="M-25 ${H(-4.5)} Q-19 ${H(-16.5)} -11 ${H(-9)} Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>`;
  const anal = `<path d="M-23 ${H(5)} Q-17 ${H(15)} -11 ${H(9)} Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>`;
  const pelvic = `<path d="M2 ${H(9)} Q7 ${H(16)} 12 ${H(9.5)} Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>`;
  const pectoral = `<path d="M16 ${H(5)} Q22 ${H(14)} 27 ${H(6)} Z" fill="@corps" stroke="@corpsO" stroke-width="0.6" opacity="0.85"/>`;
  return `<g>${dorsal}${anal}${fish}${belly}${lateral}${mottling}${pelvic}${pectoral}${gape}${lower}${upper}${teeth}${eye}</g>`;
}

function caudal(p: FishProps): string {
  const g = p.girth, v = (n: number) => (n * g).toFixed(1);
  // grande nageoire caudale FOURCHUE (verticale) au bout de la queue (-x)
  return `<path d="M0 0 Q-6 ${v(-3)} -17 ${v(-16)} Q-11 ${v(-6)} -5 0 Q-11 ${v(6)} -17 ${v(16)} Q-6 ${v(3)} 0 0 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M-5 0 Q-10 ${v(-6)} -15 ${v(-13)} M-5 0 Q-10 ${v(6)} -15 ${v(13)}" stroke="@corpsO" stroke-width="0.5" fill="none" opacity="0.5"/>`;
}

// --- poses (DELTA additif sur les angles d'os) ----------------------------
export const FISH_REST: Record<string, number> = {};
/** Godille au repos : la caudale balaie doucement. phase ∈ [0,1). */
export function fishGodille(phase: number): Record<string, number> {
  const s = Math.sin(phase * Math.PI * 2);
  return { caudale: s * 16, corps: s * 2 };
}
/** Nage : ondulation ample. phase ∈ [0,1). */
export function fishSwim(phase: number): Record<string, number> {
  const s = Math.sin(phase * Math.PI * 2);
  return { caudale: s * 26, corps: s * 5 };
}
/** Coup de queue (« Queue mortelle ») : la caudale se projette d'un côté. phase ∈ [0,1]. */
export function fishLash(phase: number): Record<string, number> {
  const k = Math.sin(Math.min(1, phase) * Math.PI);
  return { caudale: k * 42, corps: k * 8 };
}
/** Mort : la queue retombe, le corps s'affaisse (poisson échoué). */
export const FISH_DEATH: Record<string, number> = { corps: 10, caudale: -22 };

export function resolveFishFromProps(
  p: FishProps,
  _view: View = 'profile',
  pose: BonePose = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<FishBoneId, Matrix>;
  const tmap = buildTokenMap([p.palette], colors ?? {});
  const art: Record<FishBoneId, string> = { corps: body(p), caudale: caudal(p) };
  return sortByZ((Object.keys(sk) as FishBoneId[])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    })));
}

export const FISH_DEFAULT: FishProps = {
  sl: 1.0, girth: 1.0,
  palette: { corps: '#5a6850', corpsO: '#32402a', corpsH: '#b2bea2', cheveux: '#32402a', cheveuxO: '#1e2818', cuir: '#7c8868' },
};

export function resolveFish(species: string, view: View = 'profile', pose: BonePose = {}, colors?: Palette): ResolvedBone[] {
  return resolveFishFromProps(FISH_SPECIES[species] ?? FISH_DEFAULT, view, pose, colors);
}

export const fishPlan: BodyPlan = {
  id: 'fish',
  resolve: (sp, view, pose, opts) => resolveFish(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(FISH_SPECIES),
  restPose: () => FISH_REST,
  idlePose: (phase) => fishGodille(phase),
  walkPose: fishSwim,
  attackPose: fishLash,
  deathPose: () => FISH_DEATH,
  hasView: () => true,
};

export function fishSvg(p: FishProps, view: View, opts: { dead?: boolean; idlePhase?: number; colors?: Palette } = {}): string {
  const pose = opts.dead ? FISH_DEATH : opts.idlePhase != null ? fishGodille(opts.idlePhase) : {};
  return bonesToSvg(resolveFishFromProps(p, view, pose, opts.colors));
}
