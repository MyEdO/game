/**
 * Gabarit NUÉE / ESSAIM (trait « Nuée », LDB 85) — une créature unique qui EST une masse grouillante
 * de petites bêtes (rats, araignées, marcassins, nurglings, snotlings, squigs, noctecorbes, zombies…).
 * Rendu DATA-DRIVEN par l'ESPÈCE : `appearance.species` désigne une FORME (`SWARM_FORMS`, cf. `forms.ts`)
 * dont la silhouette d'UN constituant tapisse l'amas + une palette par défaut. Pas d'if-par-nom : la
 * forme vient de la table, et `appearance.colors` la surcharge. Anim propre : frémissement au repos.
 */
import type { BonePose } from '../poses';
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette } from '../palette';
import { worldTransformsG, type FKBone, type Matrix } from '../kinematics';
import { buildTokenMap, applyTokenMap } from '../palette';
import { bonesToSvg } from '../renderBones';
import { SWARM_FORMS, swarmFormOf, DEFAULT_FORM, type SwarmForm } from './forms';

type SwarmBoneId = 'corps';
type SBone = FKBone & { z: number };

const buildSkeleton = (): Record<SwarmBoneId, SBone> => ({
  corps: { parent: null, pivot: { x: 60, y: 92 }, angle: 0, z: 1 },
});

// Amas TERRESTRE : carpette grouillante ANCRÉE AU SOL (la rangée avant atteint la ligne de pieds
// d'une créature, y≈52 local → bas de la tuile) ; arrière petit/haut → avant gros/bas, chevauchant.
const SPOTS: [number, number, number, number][] = [
  [-24, 27, 1.0, 1], [-8, 25, 0.96, -1], [9, 27, 1.02, 1], [25, 26, 0.96, -1],
  [-30, 38, 1.18, -1], [-12, 37, 1.24, 1], [5, 39, 1.2, -1], [21, 38, 1.16, 1], [32, 36, 1.05, -1],
  [-20, 49, 1.4, 1], [-2, 51, 1.44, -1], [15, 49, 1.4, 1], [30, 47, 1.22, -1],
];
// Flock AÉRIEN (formes volantes) : dispersé en hauteur, sans amas au sol (pas d'ombre rampante).
const SPOTS_AERIAL: [number, number, number, number][] = [
  [-20, -2, 0.78, 1], [4, -6, 0.74, -1], [22, 2, 0.8, 1],
  [-26, 12, 0.84, -1], [-6, 8, 0.92, 1], [14, 14, 0.88, -1], [26, 22, 0.8, 1],
  [-16, 24, 0.96, 1], [6, 28, 0.94, -1],
];
/** Tapisse l'amas de constituants de la FORME donnée, terrestre ou aérien selon `form.aerial`. */
function heap(form: SwarmForm, view: View): string {
  const spots = form.aerial ? SPOTS_AERIAL : SPOTS;
  // Ombre portée au sol pour les nuées TERRESTRES : ancre l'amas sur la tuile (sinon il « flotte »).
  const shadow = form.aerial ? '' : '<ellipse cx="0" cy="55" rx="38" ry="7.5" fill="#0a0a0c" opacity="0.28"/>';
  return `<g>${shadow}${spots.map(([x, y, s, f]) => form.critter(x, y, s, f < 0, view)).join('')}</g>`;
}

// --- poses (delta additif) : la masse frémit / ondule légèrement ---------------
const SWARM_REST: Record<string, number> = {};
const swarmSeethe = (phase: number): Record<string, number> => ({ corps: Math.sin(phase * Math.PI * 2) * 2.5 });
const swarmScuttle = (phase: number): Record<string, number> => ({ corps: Math.sin(phase * Math.PI * 2) * 5 });
const swarmSurge = (phase: number): Record<string, number> => ({ corps: Math.sin(Math.min(1, phase) * Math.PI) * 7 });
const SWARM_DEATH: Record<string, number> = { corps: 10 };

/** FORME d'une espèce : id de forme direct → repli par plan de la def créature → générique brun. */
function formFor(species: string): SwarmForm {
  return SWARM_FORMS[species] ?? swarmFormOf(species) ?? DEFAULT_FORM;
}

function resolveSwarm(species: string, view: View, pose: BonePose = {}, colors?: Palette): ResolvedBone[] {
  const form = formFor(species);
  const sk = buildSkeleton();
  const world = worldTransformsG(sk, pose) as Record<SwarmBoneId, Matrix>;
  const tmap = buildTokenMap([form.palette], colors ?? {});
  return [{ id: 'corps', matrix: world.corps, scale: [1, 1], z: sk.corps.z, parts: [{ svg: applyTokenMap(heap(form, view), tmap), layer: 0 }] }];
}

export const swarmPlan: BodyPlan = {
  id: 'swarm',
  resolve: (sp, view, pose, opts) => resolveSwarm(sp, view, pose, opts?.colors),
  speciesNames: () => Object.keys(SWARM_FORMS),
  restPose: () => SWARM_REST,
  idlePose: swarmSeethe,
  walkPose: swarmScuttle,
  attackPose: swarmSurge,
  deathPose: () => SWARM_DEATH,
  hasView: () => true,
};

/** Rend une nuée d'UNE forme en SVG plat (QC / galeries). */
export function swarmSvg(species: string, view: View = 'front', opts: { dead?: boolean; idlePhase?: number; colors?: Palette } = {}): string {
  const pose = opts.dead ? SWARM_DEATH : opts.idlePhase != null ? swarmSeethe(opts.idlePhase) : {};
  return bonesToSvg(resolveSwarm(species, view, pose, opts.colors));
}
