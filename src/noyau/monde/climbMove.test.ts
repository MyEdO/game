import { describe, it, expect } from 'vitest';
import { emptyScene, type Scene, type WallClimb } from './scene';
import { planClimb } from './climbMove';

// Scène 4×4 : falaise de 4 m entre le pied (2,1) à 0 m et le sommet (2,0) à 4 m ; l'arête N de (2,1)
// porte la grimpe. `climb` paramétré par test.
function cliffScene(climb: WallClimb): Scene {
  const s = emptyScene('scene-test', 4, 4);
  const w = 4;
  const h = new Array(w * 4).fill(0) as number[];
  h[0 * w + 2] = 4; // (2,0) sommet à 4 m
  s.layers[0].height = h;
  s.walls = [{ x: 2, y: 1, side: 'N', climb }];
  return s;
}

const from = { x: 2, y: 1 }; // pied
const to = { x: 2, y: 0 }; // sommet

describe('planClimb', () => {
  it('échelle → franchissement d’office (pas de Test)', () => {
    const plan = planClimb(cliffScene({ kind: 'ladder' }), from, to, false);
    expect(plan).toEqual({ kind: 'free' });
  });

  it('en montée, le départ au pied ne risque aucune chute', () => {
    const plan = planClimb(cliffScene({ kind: 'surface' }), from, to, false);
    expect(plan).toMatchObject({
      kind: 'test',
      flow: { test: { skill: { id: 'escalade' }, difficulty: 'intermediaire', stake: { key: { kind: 'escalade-test-sans-chute' } } } },
      escalade: { arrivee: to },
    });
    if (plan?.kind !== 'test') throw new Error('attendu Test');
    expect(plan.escalade.chute).toBeUndefined();
  });

  it('en descente, la chute possible rejoint le pied depuis l’appui de départ', () => {
    const plan = planClimb(cliffScene({ kind: 'surface' }), to, from, false);
    expect(plan).toMatchObject({
      kind: 'test',
      flow: { test: { stake: { key: { kind: 'escalade-test' }, values: { metres: 4 } } } },
      escalade: { arrivee: from, chute: { type: 'fall', target: 'groupe', metres: 4, to: { ...from, z: 0 } } },
    });
  });

  it('la chute rejoint le premier palier sous le départ et ignore les étages à niveau ou au-dessus', () => {
    const scene = cliffScene({ kind: 'surface' });
    for (const [z, hauteur] of [[1, 2], [2, 4], [3, 5]]) {
      scene.layers.push({ z, tiles: new Array(16).fill('plancher'), height: new Array(16).fill(hauteur) });
    }
    const plan = planClimb(scene, to, from, false, 'hero-7');
    expect(plan).toMatchObject({
      kind: 'test',
      escalade: { chute: { type: 'fall', target: 'heros', heroId: 'hero-7', metres: 2, to: { ...from, z: 1 } } },
    });
  });

  it('la chute ignore un palier occupé et rejoint le premier appui libre en dessous', () => {
    const scene = cliffScene({ kind: 'surface' });
    scene.layers.push({ z: 1, tiles: new Array(16).fill('plancher'), height: new Array(16).fill(2) });
    const plan = planClimb(scene, to, from, false, 'hero-7', false, (appui) => appui.z !== 1);
    expect(plan).toMatchObject({
      kind: 'test',
      flow: { test: { stake: { key: { kind: 'escalade-test' }, values: { metres: 4 } } } },
      escalade: { chute: { metres: 4, to: { ...from, z: 0 } } },
    });
  });

  it('en montée depuis un palier, la chute part de l’appui occupé et atteint celui dessous', () => {
    const scene = cliffScene({ kind: 'surface' });
    for (const [z, hauteur] of [[1, 2], [2, 4]]) {
      scene.layers.push({ z, tiles: new Array(16).fill('plancher'), height: new Array(16).fill(hauteur) });
    }
    scene.walls = [{ ...from, z: 1, side: 'N', climb: { kind: 'surface' } }];
    const plan = planClimb(scene, { ...from, z: 1 }, { ...to, z: 2 }, false);
    expect(plan).toMatchObject({
      kind: 'test',
      flow: { test: { stake: { key: { kind: 'escalade-test' }, values: { metres: 2 } } } },
      escalade: { chute: { type: 'fall', metres: 2, to: { ...from, z: 0 } } },
    });
  });

  it('paroi à difficulté éditée → le Test porte cette difficulté', () => {
    const plan = planClimb(cliffScene({ kind: 'surface', difficulty: 'difficile' }), from, to, false);
    if (plan?.kind !== 'test') throw new Error('attendu Test');
    expect(plan.flow.test.difficulty).toBe('difficile');
  });

  it('paroi exigeant Grimpeur, Talent absent → impossible', () => {
    const plan = planClimb(cliffScene({ kind: 'surface', requiresGrimpeur: true }), from, to, false);
    expect(plan).toEqual({ kind: 'impossible' });
  });

  it('paroi exigeant Grimpeur, Talent présent → Test jouable', () => {
    const plan = planClimb(cliffScene({ kind: 'surface', requiresGrimpeur: true }), from, to, true);
    expect(plan?.kind).toBe('test');
  });

  it('arête sans grimpe → null (le geste ne s’applique pas)', () => {
    const s = cliffScene({ kind: 'surface' });
    s.walls = [{ x: 2, y: 1, side: 'N' }]; // mur nu, pas de climb
    expect(planClimb(s, from, to, false)).toBeNull();
  });

  // Grimpant (LDB 85 l.160-162) : `autoSucceed` — aucun jet, même sur une paroi exigeant le Talent Grimpeur.
  it('autoSucceed (Grimpant) : paroi sans Talent → free, marquée `auto`, pas de Test', () => {
    const plan = planClimb(cliffScene({ kind: 'surface', requiresGrimpeur: true }), from, to, false, undefined, true);
    expect(plan).toEqual({ kind: 'free', auto: true });
  });

  it('autoSucceed (Grimpant) : échelle → free SANS le flag `auto` (franchissement d’office générique)', () => {
    const plan = planClimb(cliffScene({ kind: 'ladder' }), from, to, false, undefined, true);
    expect(plan).toEqual({ kind: 'free' });
  });
});
