/**
 * Gabarit SERPENTIN (serpent / sangsue) — limbless. Pas de pattes : un corps LOVÉ (mound de
 * boucles empilées, statique) + un cou dressé et une tête qui ONDULENT (FK générique). C'est
 * l'anim propre au plan : balancement de cobra au repos, lunge à l'attaque, tête affaissée à la
 * mort. Réutilise INTÉGRALEMENT la machinerie (FK worldTransformsG, palette tokenisée, rendu).
 */
import type { BonePose } from '../poses';
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette, PaletteDeclaree } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { SERPENT_SPECIES } from '../creatures';
import { sortByZ } from '../composite';

export type SerpentBoneId = 'corps' | 'cou' | 'tete' | 'queue';
type SBone = FKBone & { z: number };
export interface SerpentProps {
  sl: number; // échelle token (taille relative en jeu)
  girth: number; // épaisseur du corps lové
  hood: boolean; // capuchon de cobra (déployé derrière la tête)
  /** Robe à motif : bandes transversales sombres (@corpsO) + mouchetures claires (@corpsH)
   *  sur le lové et le cou. Absent = robe unie (comportement historique). */
  markings?: 'bandes';
  /** Couleur d'iris (défaut jaune historique '#d8b020'). */
  eye?: string;
  /** Extrémité AVEUGLE de ver/larve : bout arrondi charnu @corps, SANS yeux, SANS langue,
   *  SANS calotte sombre au dos — un ver n'a ni tête distincte ni traits faciaux (cf. Vers).
   *  Absent = tête de serpent historique, inchangée à l'octet. */
  blunt?: boolean;
  /** Queue PÂLE dressée qui se déploie en S au-dessus du lové (os `queue` dédié, animé) —
   *  colorée par @cheveux/@cheveuxO. Absent = pas de queue dressée (comportement historique). */
  tailUp?: boolean;
  palette: PaletteDeclaree; // robe par défaut (corps/corpsO/corpsH…)
}

function buildSkeleton(p: SerpentProps): Partial<Record<SerpentBoneId, SBone>> {
  const sk: Partial<Record<SerpentBoneId, SBone>> = {
    corps: { parent: null, pivot: { x: 60, y: 118 }, angle: 0, z: 2 },
    cou: { parent: 'corps', pivot: { x: 6, y: -14 }, angle: -8, z: 3 },
    tete: { parent: 'cou', pivot: { x: 0, y: -38 }, angle: 6, z: 4 },
  };
  if (p.tailUp) sk.queue = { parent: 'corps', pivot: { x: -18, y: 8 }, angle: 0, z: 1 };
  return sk;
}

// --- art (repère LOCAL de l'os) -------------------------------------------
function coil(p: SerpentProps): string {
  const g = p.girth;
  // Boucles DÉCALÉES qui se chevauchent (croissants d'ombre = sens d'enroulement) + QUEUE qui
  // émerge du lové — les ellipses concentriques empilées lisaient « pile de pneus / poterie »
  // (verdict des juges aveugles, lot 4).
  const bands = p.markings === 'bandes';
  // bandes transversales par boucle (suivent la courbure de chaque anneau), dessinées SUR la
  // boucle concernée avant que la suivante la recouvre — motif de l'artwork LDB 79 p.319.
  const bandsBottom = bands ? `<path d="M${(-23 * g).toFixed(1)} 10 q4 8 1 16 M${(-9 * g).toFixed(1)} 6.5 q4 9 0.5 19 M${(8 * g).toFixed(1)} 6.5 q4 9 0.5 19 M${(22 * g).toFixed(1)} 9 q4 8 1 16" stroke="@corpsO" stroke-width="3.2" fill="none" opacity="0.55" stroke-linecap="round"/>` : '';
  const bandsMid = bands ? `<path d="M${(-8 * g).toFixed(1)} -0.5 q3.5 7 0 15 M${(6 * g).toFixed(1)} -1.5 q3.5 7.5 0 16.5 M${(19 * g).toFixed(1)} 0.5 q3 6.5 0 13.5" stroke="@corpsO" stroke-width="2.9" fill="none" opacity="0.55" stroke-linecap="round"/>` : '';
  const bandsTop = bands ? `<path d="M${(-8 * g).toFixed(1)} -5.5 q2.5 5 0 10.5 M${(4 * g).toFixed(1)} -6.5 q2.5 5.5 0 11.5" stroke="@corpsO" stroke-width="2.4" fill="none" opacity="0.55" stroke-linecap="round"/>` : '';
  const speckles = bands ? `<g fill="@corpsH" opacity="0.75"><circle cx="-16" cy="22" r="0.9"/><circle cx="2" cy="26" r="0.7"/><circle cx="17" cy="21" r="0.9"/><circle cx="${(28 * g).toFixed(1)}" cy="15" r="0.8"/><circle cx="${(-27 * g).toFixed(1)}" cy="17" r="0.8"/><circle cx="-2" cy="11" r="0.8"/><circle cx="12" cy="5.5" r="0.7"/><circle cx="-6" cy="-3" r="0.7"/><circle cx="5" cy="-2.5" r="0.6"/></g>` : '';
  return `<g>` +
    `<ellipse cx="0" cy="27" rx="${(36 * g).toFixed(1)}" ry="14" fill="@corpsO" opacity="0.9"/>` +
    `<ellipse cx="-4" cy="18" rx="${(33 * g).toFixed(1)}" ry="13.5" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    bandsBottom +
    `<path d="M${(20 * g).toFixed(1)} 22 Q${(34 * g).toFixed(1)} 24 ${(42 * g).toFixed(1)} 17 Q${(45 * g).toFixed(1)} 14 ${(42 * g).toFixed(1)} 12.5 Q${(36 * g).toFixed(1)} 16 ${(26 * g).toFixed(1)} 14 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` + // pointe de queue émergente
    `<ellipse cx="${(7 * g).toFixed(1)}" cy="8" rx="${(25 * g).toFixed(1)}" ry="10.5" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    bandsMid +
    `<path d="M${(-16 * g).toFixed(1)} 12.5 Q7 18 ${(28 * g).toFixed(1)} 9.5 Q7 13.5 ${(-14 * g).toFixed(1)} 9 Z" fill="@corpsO" opacity="0.5"/>` + // croissant : la boucle médiane passe DEVANT
    `<ellipse cx="-1" cy="-1" rx="${(16 * g).toFixed(1)}" ry="7.5" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    bandsTop +
    `<path d="M${(-12 * g).toFixed(1)} 2.5 Q2 6.5 ${(18 * g).toFixed(1)} 1 Q2 3 ${(-11 * g).toFixed(1)} -1 Z" fill="@corpsO" opacity="0.45"/>` +
    `<ellipse cx="-7" cy="15" rx="${(19 * g).toFixed(1)}" ry="5.2" fill="@corpsH" opacity="0.3"/>` +
    `<ellipse cx="${(9 * g).toFixed(1)}" cy="5.5" rx="${(13 * g).toFixed(1)}" ry="3.8" fill="@corpsH" opacity="0.28"/>` +
    speckles +
    `</g>`;
}
function neck(p: SerpentProps): string {
  // cou FUSELÉ en S (large à la base, fin vers la tête) — le tube rigide lisait « périscope ».
  const bands = p.markings === 'bandes'
    ? `<path d="M-6 -7 Q-1 -4 4.5 -7 M-4.5 -19 Q-0.5 -16 3.5 -19.5 M-3 -31 Q-0.5 -28.5 2.5 -32" stroke="@corpsO" stroke-width="2.4" fill="none" opacity="0.5" stroke-linecap="round"/>`
    : '';
  return `<g>` +
    `<path d="M-7 5 Q-9 -10 -4 -22 Q-1 -31 -2.5 -40 L3 -40 Q6 -27 3.5 -17 Q2 -6 7 5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    bands +
    `<path d="M-4.5 2 Q-6 -12 -1.5 -24 Q1 -32 0 -38" stroke="@corpsH" stroke-width="1.1" fill="none" opacity="0.4"/>` +
    `<path d="M-6.5 -3 Q-1 0 4.5 -3 M-5 -15 Q-1 -12 3.5 -15.5 M-3.5 -27 Q-0.5 -24.5 2.5 -28" stroke="@corpsO" stroke-width="0.7" fill="none" opacity="0.5"/>` +
    `</g>`;
}
/** Queue PÂLE dressée en S au-dessus du lové (artwork : extrémité claire, presque diaphane,
 *  déployée vers le haut) — repère local de l'os `queue`, effilée vers la pointe. */
function raisedTail(): string {
  return `<g>` +
    `<path d="M-9 8 Q-15 -8 -8 -22 Q-1 -34 -7 -47 Q-12 -59 -5 -70 Q-1 -77 4 -80 Q0 -71 0 -63 Q0 -53 -2 -45 Q-4 -34 1 -23 Q7 -9 0 8 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.9"/>` +
    `<path d="M-10 -14 q5 3 9 1 M-6 -40 q4 2.5 8 0.5 M-9 -60 q4 2.5 7.5 1" stroke="@cheveuxO" stroke-width="1" fill="none" opacity="0.55"/>` +
    `<path d="M-11 -18 Q-6 -32 -8 -50" stroke="#ffffff" stroke-width="1" fill="none" opacity="0.25"/>` +
    `</g>`;
}
function headProfile(p: SerpentProps): string {
  const hood = p.hood
    ? `<path d="M-5 4 Q-19 -4 -15 -21 Q-7 -14 -1 -9 Z" fill="@corpsO" opacity="0.8"/><path d="M5 4 Q19 -4 15 -21 Q7 -14 1 -9 Z" fill="@corpsO" opacity="0.8"/>`
    : '';
  return p.blunt
    // Bout de ver AVEUGLE (profil) : lobe arrondi charnu, un pli d'annulation, aucun trait facial.
    ? `<g>` +
      `<path d="M-5 3 Q-6 -8 0 -11 Q8 -12 12 -7 Q14 -3 10 1 Q4 2.5 -5 3 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
      `<path d="M-1 -10 Q-3 -4 -2 2" stroke="@corpsO" stroke-width="0.7" fill="none" opacity="0.5"/>` +
      `<path d="M2 -9 Q6 -8 9 -5" stroke="@corpsH" stroke-width="0.9" fill="none" opacity="0.5"/>` +
      `</g>`
    : `<g>${hood}` +
    `<path d="M-5 3 Q-6 -8 0 -11 Q10 -12 16 -7 Q19 -4 16 -1 Q8 -2 2 0 Q-3 2 -5 3 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<ellipse cx="3" cy="-6" rx="2" ry="2.3" fill="${p.eye ?? '#d8b020'}"/><ellipse cx="3" cy="-6" rx="0.5" ry="2.1" fill="#0a0603"/>` +
    `<path d="M3 -1.5 Q9 -2 15 -1" stroke="@corpsO" stroke-width="0.6" fill="none" opacity="0.6"/>` +
    `<path d="M15 -2 q5 -1.5 9 -0.5 M15 -1 q5 0.5 8 2.5" stroke="#b83030" stroke-width="0.8" fill="none" stroke-linecap="round"/>` +
    `</g>`;
}
function headFront(p: SerpentProps): string {
  const hood = p.hood
    ? `<path d="M-4 2 Q-20 -2 -18 -20 Q-9 -12 -2 -8 Z" fill="@corpsO" opacity="0.8"/><path d="M4 2 Q20 -2 18 -20 Q9 -12 2 -8 Z" fill="@corpsO" opacity="0.8"/>`
    : '';
  return p.blunt
    // Bout de ver AVEUGLE (face) : même silhouette arrondie, bourrelet buccal, ni yeux ni langue.
    ? `<g>` +
      `<path d="M-6 -8 Q-7 4 0 9 Q7 4 6 -8 Q0 -11 -6 -8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
      `<path d="M-4 2.5 Q0 5.5 4 2.5" stroke="@corpsO" stroke-width="0.8" fill="none" opacity="0.5"/>` +
      `<path d="M-3.5 -6.5 Q0 -8 3.5 -6.5" stroke="@corpsH" stroke-width="0.9" fill="none" opacity="0.45"/>` +
      `</g>`
    : `<g>${hood}` +
    `<path d="M-6 -8 Q-7 4 0 9 Q7 4 6 -8 Q0 -11 -6 -8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<ellipse cx="-3" cy="-4" rx="1.7" ry="2" fill="${p.eye ?? '#d8b020'}"/><ellipse cx="-3" cy="-4" rx="0.9" ry="0.6" fill="#0a0603"/>` +
    `<ellipse cx="3" cy="-4" rx="1.7" ry="2" fill="${p.eye ?? '#d8b020'}"/><ellipse cx="3" cy="-4" rx="0.9" ry="0.6" fill="#0a0603"/>` +
    `<path d="M-2 8 q2 1.5 4 0 M0 9 l-1.5 5 M0 9 l1.5 5" stroke="#b83030" stroke-width="0.8" fill="none" stroke-linecap="round"/>` +
    `</g>`;
}
function headBack(p: SerpentProps): string {
  const hood = p.hood
    ? `<path d="M-4 2 Q-20 -2 -18 -20 Q-9 -12 -2 -8 Z" fill="@corpsO"/><path d="M4 2 Q20 -2 18 -20 Q9 -12 2 -8 Z" fill="@corpsO"/>`
    : '';
  return p.blunt
    // Bout de ver AVEUGLE (dos) : chair @corps (pas de calotte sombre), un pli d'annulation.
    ? `<g><path d="M-6 -8 Q-7 4 0 9 Q7 4 6 -8 Q0 -11 -6 -8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/><path d="M-4 -1 Q0 1.5 4 -1" stroke="@corpsO" stroke-width="0.7" fill="none" opacity="0.5"/></g>`
    : `<g>${hood}<path d="M-6 -8 Q-7 4 0 9 Q7 4 6 -8 Q0 -11 -6 -8 Z" fill="@corpsO" stroke="@corpsO" stroke-width="0.8"/><path d="M0 -9 L0 7" stroke="@corps" stroke-width="0.6" opacity="0.4"/></g>`;
}

function headFor(p: SerpentProps, view: View): string {
  return view === 'front' ? headFront(p) : view === 'back' ? headBack(p) : headProfile(p);
}

// --- poses (DELTA additif sur l'angle de repos) ---------------------------
export const SERPENT_REST: Record<string, number> = {};
/** Balancement de cobra : le cou ondule, la tête contre-balance. phase ∈ [0,1). */
export function serpentSway(phase: number): Record<string, number> {
  const s = Math.sin(phase * Math.PI * 2);
  return { cou: s * 7, tete: -s * 5, queue: -s * 4 }; // la queue dressée contre-balance (ignorée si absente)
}
/** Lunge d'attaque : le cou se projette en avant, la gueule s'ouvre. phase ∈ [0,1]. */
export function serpentStrike(phase: number): Record<string, number> {
  const k = Math.sin(Math.min(1, phase) * Math.PI); // 0→1→0
  return { cou: k * 34, tete: k * 18, queue: -k * 12 };
}
/** Mort : tête et cou affaissés sur le côté, queue dressée retombée. */
export const SERPENT_DEATH: Record<string, number> = { cou: 74, tete: 36, queue: -70 };

// --- compose --------------------------------------------------------------
export function resolveSerpentFromProps(
  p: SerpentProps,
  view: View = 'profile',
  pose: BonePose = {},
  colors?: Palette,
): ResolvedBone[] {
  const sk = buildSkeleton(p) as Record<SerpentBoneId, SBone>;
  const world = worldTransformsG(sk, pose) as Record<SerpentBoneId, Matrix>;
  const tmap = buildTokenMap([p.palette], colors ?? {});
  const art: Record<SerpentBoneId, string> = { corps: coil(p), cou: neck(p), tete: headFor(p, view), queue: raisedTail() };
  return sortByZ((Object.keys(sk) as SerpentBoneId[])
    .map((id) => ({
      id,
      matrix: world[id],
      scale: [1, 1] as [number, number],
      z: sk[id].z,
      parts: [{ svg: applyTokenMap(art[id], tmap), layer: 0 }],
    })));
}

/** Props par défaut (serpent générique) — repli si une espèce n'est pas dans le registre. */
export const SERPENT_DEFAULT: SerpentProps = {
  sl: 1.0, girth: 1.0, hood: true,
  palette: { corps: '#5a7a44', corpsO: '#37502a', corpsH: '#82a05e', cheveux: '#2c3a20', cheveuxO: '#1a2410', cuir: '#caa23a' },
};

/** (espèce, vue, pose, couleurs) → os résolus, depuis la table d'espèces du registre. */
export function resolveSerpent(species: string, view: View = 'profile', pose: BonePose = {}, colors?: Palette): ResolvedBone[] {
  return resolveSerpentFromProps(SERPENT_SPECIES[species] ?? SERPENT_DEFAULT, view, pose, colors);
}
/** Gabarit serpentin enregistrable. L'ondulation de cobra est l'IDLE du plan (animée en continu
 *  par AnimatedPlanToken) ; la marche reprend l'ondulation amplifiée. */
export const serpentinePlan: BodyPlan = {
  id: 'serpentine',
  resolve: (sp, view, pose, opts) => resolveSerpent(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(SERPENT_SPECIES),
  restPose: () => SERPENT_REST,
  idlePose: (phase) => serpentSway(phase * 0.5), // ondulation douce au repos
  walkPose: serpentSway, // ondulation ample en déplacement
  attackPose: serpentStrike,
  deathPose: () => SERPENT_DEATH,
  hasView: () => true,
};

/** SVG (string, boîte 120×150) d'un serpent prêt à injecter — pose mort/sway intégrée. */
export function serpentSvg(
  p: SerpentProps,
  view: View,
  opts: { dead?: boolean; swayPhase?: number; colors?: Palette } = {},
): string {
  const pose = opts.dead ? SERPENT_DEATH : opts.swayPhase != null ? serpentSway(opts.swayPhase) : {};
  return bonesToSvg(resolveSerpentFromProps(p, view, pose, opts.colors));
}
