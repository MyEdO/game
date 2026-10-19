import { bonesToSvg } from './rig/renderBones';
import { usePlanAnim } from './usePlanAnim';
import { planOptsForRecord, type BodyPlanId } from './rig/bodyPlan';
import type { Dir8 } from '../noyau/monde/dir8';
import type { EntityAppearance } from '../engine/authoringAppearance';

/**
 * Token ANIMÉ GÉNÉRIQUE pour TOUT gabarit rigué non-bipède (quadrupède, ailé, serpentin,
 * arachnide, aviaire, céphalopode). Le PLAN et l'ESPÈCE sont RÉSOLUS par l'appelant (tokenBodyKind
 * via `resolveRender`, depuis la donnée explicite) et passés ici — plus aucun match par nom. L'anim
 * (poses du plan, vue 8-dir, marche/attaque bus) est déléguée à `usePlanAnim`, dont ce token est le
 * SEUL appelant. Hébergé dans la boîte 120×150 par tokenNode.
 */
export function AnimatedPlanToken({ id, planId, species, recordId, override, dead, prone, facing, pos }: { id: string; planId: BodyPlanId; species: string; recordId?: string; override?: EntityAppearance; dead?: boolean; prone?: boolean; facing?: Dir8; pos?: { x: number; y: number } }) {
  const { plan, species: sp, pose, view, mirror, wings } = usePlanAnim(id, planId, species, dead, facing, pos, prone);
  if (!plan) return null;
  const svg = bonesToSvg(plan.resolve(sp, view, pose, { ...planOptsForRecord(recordId, override), wings }));
  return <g transform={mirror ? 'translate(120,0) scale(-1,1)' : undefined} dangerouslySetInnerHTML={{ __html: svg }} />;
}
