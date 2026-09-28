import { useMemo } from 'react';
import { RigSprite, rigComposition } from './rig/composeRig';
import { ambientClip } from './rig/anim/ambientClips';
import { addPose } from './rig/poses';
import { useRigAnim } from './useRigAnim';
import type { EquipCtx } from './rig/parts/equipment';
import type { Dir8 } from '../state/dir8';
import type { Appearance } from './rig/appearance';
import type { RigOverlay } from './rig/bones';
import { RIG_GROUND_PIVOT, rigGroundPose, rigGroundTiltDeg, type GroundState } from './groundPose';

/**
 * TOKEN RIG UNIQUE — sert le combat ET l'exploration (aucune différence visuelle entre les
 * modes : même squelette, mêmes parts, même apparence). L'identité cosmétique vit ici ;
 * l'ANIMATION (clips bus + vue 8-dir) est déléguée à `useRigAnim`, dont ce token est le SEUL appelant.
 */
export function RigToken({
  id,
  appearance,
  equip,
  career,
  overlays,
  ambientAnim,
  facing,
  pos,
  outOfAction = false,
  ground = null,
}: {
  id: string;
  appearance: Appearance;
  equip: EquipCtx;
  /** Id de garde-robe (tenue OU carrière) — la carrière de jeu d'un héros sert de tenue par défaut. */
  career?: string;
  overlays?: RigOverlay[];
  ambientAnim?: string;
  /** Orientation MONDE authored (entité de scène) — fallback si le store n'a pas d'orientation vivante. */
  facing?: Dir8;
  /** Tuile de l'acteur (CULLING viewport : un rig hors-champ ne paie plus son rAF d'animation). */
  pos?: { x: number; y: number };
  outOfAction?: boolean;
  /** État AU SOL (groundPose.ts) : `corpse` = effondré, `prone` = À Terre conscient (coude levé). */
  ground?: GroundState;
}) {
  const restClip = ambientAnim ? ambientClip(ambientAnim) ?? undefined : undefined;
  const { pose, holdPose, view, mirror } = useRigAnim({ id, equip, restClip, facing, pos });
  const down: GroundState = outOfAction || ground === 'corpse' ? 'corpse' : ground;
  const couché = rigGroundPose(down);
  // COMPOSITION retenue tant que le personnage, la vue et le sens ne changent pas : l'animation (rAF de
  // `useRigAnim`) ne paie que la pose (`poseRig`).
  const comp = useMemo(() => rigComposition(appearance, equip, career, view, overlays, mirror), [appearance, equip, career, overlays, view, mirror]);
  const body = (
    <g transform={mirror ? 'translate(120,0) scale(-1,1)' : undefined}>
      <RigSprite comp={comp} pose={couché ?? addPose(holdPose, pose)} />
    </g>
  );
  // AU SOL : bascule de tout le rig autour de ses pieds (`rigGroundTiltDeg`, `RIG_GROUND_PIVOT` —
  // partagés avec le billboard volumique). La rotation est une TRANSITION CSS : la CHUTE est animée
  // (plus de téléportation au sol) et le RELEVÉ aussi, gratuitement. Pivot exprimé en sandwich
  // translate·rotate·translate (unités LOCALES — pas de transform-origin : le token iso n'a pas de
  // viewport propre, l'origine CSS pointerait la scène). Même structure dans les deux états →
  // interpolation fluide ; un élément monté déjà au sol ne transitionne pas.
  const deg = rigGroundTiltDeg(down);
  return (
    <g style={{ transform: `translate(${RIG_GROUND_PIVOT.x}px, ${RIG_GROUND_PIVOT.y}px) rotate(${deg}deg) translate(${-RIG_GROUND_PIVOT.x}px, ${-RIG_GROUND_PIVOT.y}px)`, transition: 'transform 420ms cubic-bezier(.34,.8,.42,1)' }}>
      {body}
    </g>
  );
}
