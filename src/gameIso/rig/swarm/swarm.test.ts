import { describe, it, expect } from 'vitest';
import { planById, resolveSpecies } from '../bodyPlan';
import { bonesToSvg } from '../renderBones';

describe('gabarit swarm (nuée — piloté par le trait « Nuée », LDB 85)', () => {
  it('le plan « swarm » existe et rend un AMAS de plusieurs petites bêtes', () => {
    const plan = planById('swarm');
    expect(plan).toBeTruthy();
    const svg = bonesToSvg(plan.resolve('Nuée', 'front', plan.restPose()));
    const critters = (svg.match(/#e8c84a/g) ?? []).length; // 1 reflet d'œil par bestiole de l'amas
    expect(critters).toBeGreaterThanOrEqual(6);
  });

  it('vit : idle ≠ repos (frémissement)', () => {
    const plan = planById('swarm');
    expect(plan.idlePose?.(0.25)).not.toEqual(plan.restPose());
  });

  it('une espèce sans trait Nuée ne route PAS vers swarm (humanoïde → biped)', () => {
    expect(resolveSpecies('humain').plan).toBe('biped');
  });
});
