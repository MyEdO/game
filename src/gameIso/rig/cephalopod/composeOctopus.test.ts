import { describe, it, expect } from 'vitest';
import {
  resolveOctopusFromProps, octoWrithe, octoLunge, OCTO_REST, OCTO_DEATH, OCTOPUS_DEFAULT,
} from './composeOctopus';

describe('gabarit céphalopode', () => {
  it('résout tentacules (derrière) puis manteau puis bras (avant), avec 8 bras + yeux à pupille horizontale', () => {
    const bones = resolveOctopusFromProps(OCTOPUS_DEFAULT, 'front', {});
    expect(bones.map((b) => b.id)).toEqual(['tentacules', 'corps', 'bras']); // z : tentacules derrière, bras devant
    const tent = bones.find((b) => b.id === 'tentacules')!.parts[0].svg;
    const bras = bones.find((b) => b.id === 'bras')!.parts[0].svg;
    const totalPaths = (tent.match(/<path/g) ?? []).length + (bras.match(/<path/g) ?? []).length;
    expect(totalPaths).toBeGreaterThanOrEqual(24); // 8 bras × 3 traits, répartis derrière/devant
    const corps = bones.find((b) => b.id === 'corps')!.parts[0].svg;
    expect(corps).toContain(OCTOPUS_DEFAULT.palette.cuir); // iris (@cuir)
    expect(corps).toContain('<rect'); // pupille horizontale (rect)
  });

  it('recolor : colors.corps change le markup', () => {
    const a = JSON.stringify(resolveOctopusFromProps(OCTOPUS_DEFAULT, 'front', {}));
    const b = JSON.stringify(resolveOctopusFromProps(OCTOPUS_DEFAULT, 'front', {}, { corps: '#4a5a38' }));
    expect(a).not.toEqual(b);
  });

  it('de dos : pas d’yeux', () => {
    const back = resolveOctopusFromProps(OCTOPUS_DEFAULT, 'back', {}).find((b) => b.id === 'corps')!.parts[0].svg;
    expect(back).not.toContain(OCTOPUS_DEFAULT.palette.cuir);
  });

  it('les poses diffèrent (ondulation ≠ repos, projection tend les bras, mort affaisse)', () => {
    expect(octoWrithe(0.25)).not.toEqual(OCTO_REST);
    expect(octoLunge(0.5).tentacules).toBeGreaterThan(10);
    expect(OCTO_DEATH.tentacules).toBeGreaterThan(20);
  });
});
