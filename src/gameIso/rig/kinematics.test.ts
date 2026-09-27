import { describe, it, expect } from 'vitest';
import { translate, rotate, mul, apply, worldTransforms } from './kinematics';
import { addPose, lerpPose, rotOf, scalePose, xfOf } from './poses';
import type { Skeleton } from './bones';
import type { Pose } from './poses';

const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6);

describe('affine', () => {
  it('translate déplace un point', () => {
    const p = apply(translate(10, 5), { x: 0, y: 0 });
    close(p.x, 10); close(p.y, 5);
  });
  it('rotate 90° envoie (1,0) sur (0,1)', () => {
    const p = apply(rotate(90), { x: 1, y: 0 });
    close(p.x, 0); close(p.y, 1);
  });
  it('mul compose dans l’ordre parent∘local', () => {
    // translate puis rotate : on tourne d'abord, puis on translate
    const m = mul(translate(10, 0), rotate(90));
    const p = apply(m, { x: 1, y: 0 });
    close(p.x, 10); close(p.y, 1);
  });
});

describe('worldTransforms', () => {
  // squelette synthétique à 2 os pour vérifier la composition.
  const sk = {
    a: { id: 'a', parent: null, pivot: { x: 10, y: 0 }, length: 0, thickness: 0, angle: 0, z: 0 },
    b: { id: 'b', parent: 'a', pivot: { x: 0, y: 5 }, length: 0, thickness: 0, angle: 90, z: 0 },
  } as unknown as Skeleton;

  it('origine d’un os enfant = transform monde composé', () => {
    const w = worldTransforms(sk, {});
    // a : translate(10,0). b : a ∘ translate(0,5) ∘ rotate(90). origine de b = (10,5).
    const ob = apply(w['b' as keyof typeof w], { x: 0, y: 0 });
    close(ob.x, 10); close(ob.y, 5);
    // un point (1,0) dans b subit rotate(90) → (0,1), puis +(10,5) = (10,6).
    const pb = apply(w['b' as keyof typeof w], { x: 1, y: 0 });
    close(pb.x, 10); close(pb.y, 6);
  });

  it('pose = delta ADDITIF sur l’angle de repos (90 + 10 = 100°, pas 10°)', () => {
    const w = worldTransforms(sk, { b: 10 } as Pose);
    const ob = apply(w['b' as keyof typeof w], { x: 0, y: 0 });
    close(ob.x, 10); close(ob.y, 5); // origine inchangée (le pivot)
    // rotate(100°) de (1,0) = (cos100, sin100), + origine (10,5).
    const r = (100 * Math.PI) / 180;
    const p = apply(w['b' as keyof typeof w], { x: 1, y: 0 });
    close(p.x, 10 + Math.cos(r)); close(p.y, 5 + Math.sin(r));
  });
});

/**
 * CANAUX D'OS — une `Pose` transforme un os comme le font les moteurs 2D à squelette : rotation,
 * translation ET échelle, les trois HÉRITÉES par la chaîne d'enfants. Le squelette ci-dessous a une
 * chaîne à trois maillons (a → b → c) : ce qu'on fait à `a` doit se lire sur `c`.
 */
describe('canaux de la Pose — hérités par la chaîne (standard cutout)', () => {
  const chaine = {
    a: { id: 'a', parent: null, pivot: { x: 0, y: 0 }, length: 0, thickness: 0, angle: 0, z: 0 },
    b: { id: 'b', parent: 'a', pivot: { x: 0, y: 10 }, length: 0, thickness: 0, angle: 0, z: 0 },
    c: { id: 'c', parent: 'b', pivot: { x: 0, y: 10 }, length: 0, thickness: 0, angle: 0, z: 0 },
  } as unknown as Skeleton;
  const osC = (pose: Pose) => worldTransforms(chaine, pose)['c' as never];
  const bout = (pose: Pose) => apply(osC(pose), { x: 0, y: 0 });

  it('ROTATION seule : la matrice est celle d’avant les canaux, au bit près', () => {
    expect([...osC({ b: 30 } as Pose)]).toEqual([...osC({ b: { r: 30 } } as Pose)]);
  });

  it('TRANSLATION de la racine : toute la chaîne descend d’autant', () => {
    const repos = bout({});
    const descendu = bout({ a: { ty: 7 } } as Pose);
    close(descendu.y - repos.y, 7);
    close(descendu.x, repos.x);
  });

  it('ÉCHELLE d’un os : ses ENFANTS remontent (raccourcir la cuisse remonte genou et pied)', () => {
    const repos = bout({});
    close(repos.y, 20); // deux maillons de 10
    const raccourci = bout({ b: { sy: 0.5 } } as Pose);
    close(raccourci.y, 15); // le 2e maillon vaut seulement 5
  });

  it('l’échelle se compose AVANT la rotation du même os (repère local, comme en cutout)', () => {
    const p = bout({ b: { sy: 0.5, r: 180 } } as Pose);
    close(p.y, 5); // 10 (pivot de b) − 5 (maillon raccourci et retourné)
  });
});

describe('algèbre des poses — un canal absent est NEUTRE', () => {
  it('xfOf : un `number` est une rotation seule ; l’absence est neutre', () => {
    expect(xfOf<'b'>({ b: 12 }, 'b')).toEqual({ r: 12, tx: 0, ty: 0, sx: 1, sy: 1 });
    expect(xfOf<'b'>({}, 'b')).toEqual({ r: 0, tx: 0, ty: 0, sx: 1, sy: 1 });
    expect(rotOf<'b'>({ b: { r: 5, sy: 0.3 } }, 'b')).toBe(5);
  });

  it('addPose : rotations/translations s’ADDITIONNENT, échelles se MULTIPLIENT', () => {
    const somme = addPose<'b'>({ b: { r: 10, ty: 3, sy: 0.5 } }, { b: { r: 5, ty: 2, sy: 0.5 } });
    expect(somme.b).toEqual({ r: 15, tx: 0, ty: 5, sx: 1, sy: 0.25 });
  });

  it('addPose de deux poses d’ANGLES reste une pose d’angles (forme compacte)', () => {
    expect(addPose<'b'>({ b: 10 }, { b: 5 }).b).toBe(15);
  });

  it('lerpPose : les échelles convergent vers 1 au repos, jamais vers 0', () => {
    expect(lerpPose<'b'>({}, { b: { sy: 0.5 } }, 0).b).toBe(0);
    expect(xfOf(lerpPose<'b'>({}, { b: { sy: 0.5 } }, 0.5), 'b').sy).toBeCloseTo(0.75, 10);
    expect(xfOf(scalePose<'b'>({ b: { sy: 0.5, r: 20 } }, 0.5), 'b')).toEqual({ r: 10, tx: 0, ty: 0, sx: 1, sy: 0.75 });
  });
});
