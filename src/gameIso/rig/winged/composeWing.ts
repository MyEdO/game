/**
 * Gabarit AILÉ (griffon / pégase / hippogriffe / dragon). Un ailé = QUADRUPÈDE + ailes :
 * on réutilise INTÉGRALEMENT la machinerie quadrupède (squelette, parts, FK, palette) via
 * resolveQuadFromProps ; seules changent les PROPS (tête aigle/dragon, serres, ailes, queue).
 * Le dragon est un ailé à grande taille (sl) — la taille est un simple paramètre, pas un modèle
 * dédié, conformément au but « ajouter facilement des monstres de toute taille ».
 */
import type { BonePose } from '../poses';
import type { ResolvedBone } from '../composeRig';
import type { BodyPlan } from '../bodyPlan';
import type { View } from '../facing';
import type { Palette } from '../palette';
import { resolveQuadFromProps, quadPropsWithHarnais } from '../quadruped/composeQuad';
import { QUAD_REST, quadWalkPose, quadBitePose, quadLeapPose, quadFlinchPose, QUAD_DEATH } from '../quadruped/quadPose';
import { quadAttackPose } from '../anim/creatureAttackPoses';
import { WINGED_SPECIES, wingedSpeciesNames } from '../creatures';

// La DATA des espèces ailées (Griffon/Pégase/Hippogriffe/Dragon + alias) vit dans
// `creatures/defs/<Nom>.ts` (plan: 'winged'). Ce module ne garde que le RENDU (resolveWing,
// plan, svg, échelle). On re-exporte la table/matcher dérivés (consommateurs inchangés).
export { WINGED_SPECIES, wingedSpeciesNames };

/** (espèce ailée, vue, pose, couleurs, ailes, yeux, set d'équipement) → os résolus (réutilise le
 *  pipeline quadrupède, `harnais` compris : un set peut DÉCLARER une espèce ailée).
 *  `wings` : REPLIÉES au repos (défaut) / DÉPLOYÉES en vol/attaque (cf. WingState). */
export function resolveWing(
  species: string,
  view: View = 'profile',
  pose: BonePose = {},
  colors?: Palette,
  wings: 'folded' | 'spread' = 'folded',
  eyes?: { G?: string; D?: string },
  harnais?: string,
): ResolvedBone[] {
  const p = WINGED_SPECIES[species] ?? WINGED_SPECIES.griffon;
  return resolveQuadFromProps(quadPropsWithHarnais(p, species, harnais), view, pose, colors, wings, eyes);
}

// Battement d'ailes (sinusoïde sur aileD/aileG, signes opposés). Vit DANS le plan : l'idle bat
// doucement (créature vivante), la marche/vol bat ample. AnimatedPlanToken l'anime — plus de
// pion ailé dédié.
const wingFlap = (phase: number, amp: number): Record<string, number> => {
  const f = Math.sin(phase * Math.PI * 2) * amp;
  return { aileD: -f, aileG: f };
};
export const wingedPlan: BodyPlan = {
  id: 'winged',
  resolve: (sp, view, pose, opts) => resolveWing(sp, view, pose, opts?.colors, opts?.wings, opts?.eyes, opts?.harnais),
  speciesNames: () => Object.keys(WINGED_SPECIES),
  restPose: () => QUAD_REST,
  idlePose: (phase) => wingFlap(phase, 2.5), // frémissement d'ailes PLIÉES au repos (subtil)
  walkPose: (phase) => ({ ...quadWalkPose(phase), ...wingFlap(phase, 26) }), // pattes + battement ample (déployées)
  attackPose: quadBitePose,
  attackKindPose: quadAttackPose,
  flinchPose: quadFlinchPose,
  deathPose: () => QUAD_DEATH,
  leapPose: (phase) => ({ ...quadLeapPose(phase), ...wingFlap(phase, 26) }), // Bond ailé = détente + battement
  hasView: () => true,
};

