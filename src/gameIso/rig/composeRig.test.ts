import { describe, it, expect } from 'vitest';
import { resolveRig } from './composeRig';
import type { Appearance } from './appearance';
import { asRigSpeciesId } from './appearance';
import { equipDe } from './parts/equipment';
import type { EquipCtx } from './parts/equipment';

const app: Appearance = { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 7 };
const equip: EquipCtx = equipDe([], []);

describe('resolveRig', () => {
  it('produit des os triés par z croissant', () => {
    const bones = resolveRig(app, equip, {});
    for (let i = 1; i < bones.length; i++) expect(bones[i].z).toBeGreaterThanOrEqual(bones[i - 1].z);
  });
  it('attache la tenue de torse à l’os torse', () => {
    const bones = resolveRig(app, equip, {});
    const torse = bones.find((b) => b.id === 'torse');
    expect(torse?.parts.some((p) => p.svg.includes('<'))).toBe(true);
  });
  it('marque en miroir les parts du côté droit (slots symétriques)', () => {
    const bones = resolveRig(app, equip, {});
    const epauleD = bones.find((b) => b.id === 'epauleD');
    expect(epauleD?.parts.some((p) => p.mirror)).toBe(true);
  });
  it('déterministe : mêmes entrées → même sortie', () => {
    expect(JSON.stringify(resolveRig(app, equip, {}))).toBe(JSON.stringify(resolveRig(app, equip, {})));
  });
});

describe('resolveRig — échelle des parts par os', () => {
  const torse = (species: string, build = 0.5) =>
    resolveRig({ species: asRigSpeciesId(species), sex: 'M', build, seed: 1 }, equip, {}).find((b) => b.id === 'torse')!;

  it('humain build 0.5 = échelle ~1 ; Gnome plus petit ; Ogre plus grand', () => {
    const h = torse('humain');
    expect(Math.abs(h.scale[0] - 1)).toBeLessThan(0.15);
    expect(Math.abs(h.scale[1] - 1)).toBeLessThan(0.15);
    const g = torse('gnome');
    expect(g.scale[0]).toBeLessThan(h.scale[0]);
    expect(g.scale[1]).toBeLessThan(h.scale[1]);
    const o = torse('ogre');
    expect(o.scale[0]).toBeGreaterThan(h.scale[0]);
    expect(o.scale[1]).toBeGreaterThan(h.scale[1]);
  });

  it('la morphologie (build) élargit les parts', () => {
    expect(torse('humain', 1).scale[0]).toBeGreaterThan(torse('humain', 0).scale[0]);
  });

  it('l’arme (os de longueur nulle) hérite de l’échelle de son parent', () => {
    const weap = { label: 'Épée', type: 'melee' as const, damage: { plusBF: false, flat: 4 }, qualities: [] };
    const bones = resolveRig({ species: asRigSpeciesId('ogre'), sex: 'M', build: 0.5, seed: 1 }, equipDe([weap], []), {});
    const arme = bones.find((b) => b.id === 'arme');
    expect(arme).toBeTruthy();
    expect(arme!.scale[0]).toBeGreaterThan(1); // l'Ogre agrandit aussi son arme
    expect(arme!.scale[0]).toBe(arme!.scale[1]); // échelle UNIFORME → l'arme ne s'étire pas
  });
});

describe('resolveRig — vues (facing)', () => {
  it('view=profile change la pose de base (≠ front)', () => {
    const epF = resolveRig(app, equip, {}, undefined, 'front').find((b) => b.id === 'epauleG')?.matrix.join(',');
    const epP = resolveRig(app, equip, {}, undefined, 'profile').find((b) => b.id === 'epauleG')?.matrix.join(',');
    expect(epP).not.toBe(epF); // VIEW_POSE.profile a bougé epauleG
  });
  it('view=back sans art back retombe sur le SVG front (jamais vide)', () => {
    const torse = resolveRig(app, equip, {}, undefined, 'back').find((b) => b.id === 'torse');
    expect(torse?.parts.some((p) => p.svg.includes('<'))).toBe(true);
  });
});
