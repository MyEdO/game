/**
 * Gabarit SQUIG (peau-verte fongoïde) — « une bouche sur pattes » : corps quasi sphérique
 * dominé par une ÉNORME gueule à crocs (mâchoire inférieure articulée qui CLAQUE), gros yeux,
 * crête d'épines dorsale, deux petites pattes griffues. Anim propre au plan : claquement de
 * mâchoire au repos, bonds (lean) au déplacement, gueule grande ouverte à l'attaque, sur le dos
 * à la mort. Réutilise la machinerie (FK générique, palette tokenisée, rendu).
 */
import type { BonePose } from '../poses';
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, PaletteDeclaree } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { SQUIG_SPECIES } from '../creatures';
import { sortByZ } from '../composite';

export type SquigBoneId = 'corps' | 'machoire';
type SBone = FKBone & { z: number };
export interface SquigProps {
  sl: number;
  girth: number; // rondeur du corps
  palette: PaletteDeclaree;
}

function buildSkeleton(): Record<SquigBoneId, SBone> {
  return {
    corps: { parent: null, pivot: { x: 60, y: 100 }, angle: 0, z: 3 },
    machoire: { parent: 'corps', pivot: { x: -16, y: 7 }, angle: 0, z: 4 }, // charnière au coin gauche
  };
}

function body(p: SquigProps, view: View): string {
  const g = p.girth, rx = 23 * g, ry = 25 * g;
  const feet = `<path d="M-10 ${ry - 4} q-4 7 -1 12 l7 0 q1 -6 -2 -11 Z" fill="@cuir" stroke="@corpsO" stroke-width="0.5"/>` +
    `<path d="M10 ${ry - 4} q4 7 1 12 l-7 0 q-1 -6 2 -11 Z" fill="@cuir" stroke="@corpsO" stroke-width="0.5"/>` +
    `<path d="M-12.4 ${ry + 7.4} l-1.6 2.6 M-9 ${ry + 8} l-0.4 3 M11 ${ry + 8} l0.4 3 M12.8 ${ry + 7.4} l1.6 2.6" stroke="#15110c" stroke-width="1.2" stroke-linecap="round"/>`; // griffes
  // crête d'épines dorsale
  const crest = `<path d="M-13 ${-ry + 6} l-3 -9 l7 5 M-3 ${-ry + 2} l-1 -11 l6 7 M7 ${-ry + 4} l2 -10 l3 8 M15 ${-ry + 9} l4 -7 l1 7" fill="@corpsO" stroke="@corpsO" stroke-width="0.5"/>`;
  const ball = `<ellipse cx="0" cy="0" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<ellipse cx="-6" cy="-8" rx="${(rx * 0.5).toFixed(1)}" ry="${(ry * 0.45).toFixed(1)}" fill="@corpsH" opacity="0.3"/>`;
  if (view === 'back') return `<g>${feet}${ball}${crest}<path d="M0 ${-ry + 6} L0 ${ry - 6}" stroke="@corpsO" stroke-width="1" opacity="0.4"/></g>`;
  if (view === 'profile') {
    // PROFIL : gueule de CÔTÉ fendue vers l'avant (+x), UN œil, crête orientée — fini le
    // « même pose que de face » (verdict des juges aveugles, lot 4).
    const mawP = `<path d="M-2 2 Q${rx * 0.4} -2 ${rx - 2} 1 Q${rx} ${ry * 0.4} ${rx * 0.45} ${ry * 0.56} Q-1 ${ry * 0.52} -2 2 Z" fill="#2a0e0c"/>`;
    const fangsP = `<path d="M${rx * 0.16} 1 l1.8 7.5 l2.6 -7 Z M${rx * 0.45} 0 l1.8 8.5 l2.6 -8 Z M${rx * 0.72} 0.5 l1.6 7 l2.4 -6.6 Z" fill="#efe6cf"/>`;
    const eyeP = `<ellipse cx="${rx * 0.34}" cy="-10" rx="3.6" ry="4" fill="#f4ecd8"/><circle cx="${rx * 0.4}" cy="-9.4" r="1.8" fill="#1a0a06"/>` +
      `<path d="M${rx * 0.12} -14.5 Q${rx * 0.36} -17 ${rx * 0.56} -13.5" stroke="@corpsO" stroke-width="1.2" fill="none"/>`;
    return `<g>${feet}${ball}${crest}${mawP}${fangsP}${eyeP}</g>`;
  }
  // FACE : la gueule mange la MOITIÉ INFÉRIEURE du corps (un squig ≈ 80 % mâchoire — la fente
  // étroite lisait « ballon à fente ») + yeux PETITS excentrés haut (fini les yeux googly).
  const maw = `<path d="M${-rx + 5} 2 Q0 -3 ${rx - 5} 2 Q${rx - 7} ${ry * 0.6} 0 ${ry * 0.68} Q${-rx + 7} ${ry * 0.6} ${-rx + 5} 2 Z" fill="#2a0e0c"/>`;
  const upperFangs = `<path d="M${-rx + 8} 2 l2 9 l3 -8.4 Z M-8 -0.5 l1.8 10 l2.8 -9.4 Z M0 -1 l1.6 10.5 l2.6 -10 Z M8 -0.5 l1.6 9.5 l2.6 -9 Z M${rx - 13} 1.5 l1.4 8 l2.4 -7.4 Z" fill="#efe6cf"/>`;
  const eyes = `<ellipse cx="-12" cy="-13" rx="3.2" ry="3.6" fill="#f4ecd8"/><circle cx="-11.2" cy="-12.6" r="1.6" fill="#1a0a06"/>` +
    `<ellipse cx="12" cy="-13" rx="3.2" ry="3.6" fill="#f4ecd8"/><circle cx="11.2" cy="-12.6" r="1.6" fill="#1a0a06"/>` +
    `<path d="M-16 -17.5 Q-11.5 -20 -7.5 -16.5 M7.5 -16.5 Q11.5 -20 16 -17.5" stroke="@corpsO" stroke-width="1.3" fill="none"/>`; // sourcils enfoncés
  return `<g>${feet}${ball}${crest}${maw}${upperFangs}${eyes}</g>`;
}
function jaw(p: SquigProps, view: View): string {
  if (view === 'back') return '';
  const g = p.girth, rx = 23 * g;
  if (view === 'profile') // mâchoire de profil : bec inférieur massif vers l'avant, crocs dressés
    return `<g><path d="M2 0 Q${14 + rx * 0.3} 2 ${16 + rx * 0.7} 0 Q${17 + rx * 0.7} 10 ${10 + rx * 0.35} 13 Q3 12 2 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
      `<path d="M${8 + rx * 0.1} 0.5 l1.6 -7 l2.6 6.4 M${12 + rx * 0.34} 0 l1.6 -8 l2.6 7.4 M${15 + rx * 0.55} 0 l1.4 -6.5 l2.4 6 Z" fill="#efe6cf"/></g>`;
  // mâchoire inférieure FACE : bac massif qui ferme la demi-gueule, gros crocs dressés
  const W = rx * 2 - 8;
  return `<g><path d="M0 0 Q${W / 2} -3 ${W} 0 Q${W + 1} 12 ${W / 2} 16 Q-1 12 0 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M${W * 0.12} 0 l1.8 -8 l2.8 7.4 M${W * 0.32} -1.4 l1.8 -8.6 l2.8 8 M${W * 0.52} -1.6 l1.8 -8.6 l2.8 8 M${W * 0.72} -1 l1.6 -8 l2.6 7.4 M${W * 0.88} 0 l1.4 -6.6 l2.2 6 Z" fill="#efe6cf"/>` +
    `<path d="M${W * 0.2} 8 Q${W / 2} 12 ${W * 0.8} 8" stroke="@corpsO" stroke-width="0.8" fill="none" opacity="0.6"/></g>`;
}

// --- poses (DELTA additif ; mâchoire s'ouvre en angle +) ------------------
export const SQUIG_REST: Record<string, number> = {};
/** Claquement de mâchoire + dandinement au repos. phase ∈ [0,1). */
export function squigChomp(phase: number): Record<string, number> {
  const s = (Math.sin(phase * Math.PI * 2) + 1) / 2; // 0..1
  return { machoire: s * 14, corps: Math.sin(phase * Math.PI * 4) * 2 };
}
/** Bond : le corps s'incline d'avant en arrière (sautillement). phase ∈ [0,1). */
export function squigHop(phase: number): Record<string, number> {
  return { corps: Math.sin(phase * Math.PI * 2) * 9, machoire: 6 };
}
/** Morsure : gueule grande ouverte. phase ∈ [0,1]. */
export function squigBite(phase: number): Record<string, number> {
  return { machoire: Math.sin(Math.min(1, phase) * Math.PI) * 30 };
}
/** Mort : sur le dos (corps basculé), mâchoire molle. */
export const SQUIG_DEATH: Record<string, number> = { corps: 165, machoire: 8 };

export function resolveSquigFromProps(
  p: SquigProps,
  view: View = 'front',
  pose: BonePose = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<SquigBoneId, Matrix>;
  const tmap = buildTokenMap([p.palette], colors ?? {});
  const art: Record<SquigBoneId, string> = { corps: body(p, view), machoire: jaw(p, view) };
  return sortByZ((Object.keys(sk) as SquigBoneId[])
    .filter((id) => art[id])
    .map((id) => ({
      id, matrix: world[id], scale: [1, 1] as [number, number], z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    })));
}

export const SQUIG_DEFAULT: SquigProps = {
  sl: 0.85, girth: 1.0,
  palette: { corps: '#a82828', corpsO: '#6e1616', corpsH: '#d85a4a', cheveux: '#5a1010', cheveuxO: '#3a0a0a', cuir: '#2a2018' },
};

export function resolveSquig(species: string, view: View = 'front', pose: BonePose = {}, colors?: Palette): ResolvedBone[] {
  return resolveSquigFromProps(SQUIG_SPECIES[species] ?? SQUIG_DEFAULT, view, pose, colors);
}

export const squigPlan: BodyPlan = {
  id: 'squig',
  resolve: (sp, view, pose, opts) => resolveSquig(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(SQUIG_SPECIES),
  restPose: () => SQUIG_REST,
  idlePose: squigChomp, // mâchoire qui claque
  walkPose: squigHop,
  attackPose: squigBite,
  deathPose: () => SQUIG_DEATH,
  hasView: () => true,
};

export function squigSvg(p: SquigProps, view: View, opts: { dead?: boolean; phase?: number; colors?: Palette } = {}): string {
  const pose = opts.dead ? SQUIG_DEATH : opts.phase != null ? squigChomp(opts.phase) : {};
  return bonesToSvg(resolveSquigFromProps(p, view, pose, opts.colors));
}
