import { describe, it, expect } from 'vitest';
import { emptyScene, type Scene, type WallClimb } from './scene';
import { planClimb } from './climbMove';

/**
 * `planClimb` traduit une ESCALADE d'arête (LDB 15 l.53-57) en plan jouable — sibling de `planJump` :
 * échelle = franchissement d'office, paroi = Test d'Escalade influençable (échec → chute), Grimpeur requis
 * sinon impossible, arête non grimpable → null. Chute = hauteur RÉELLE du relief (retombe au pied).
 */

// Scène 4×4 : falaise de 4 m entre le pied (2,1) à 0 m et le sommet (2,0) à 4 m ; l'arête N de (2,1)
// porte la grimpe. `climb` paramétré par test.
function cliffScene(climb: WallClimb): Scene {
  const s = emptyScene(4, 4);
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

  it('paroi → Test d’Escalade dont l’échec fait chuter de la hauteur réelle (4 m) au pied', () => {
    const plan = planClimb(cliffScene({ kind: 'surface' }), from, to, false);
    expect(plan?.kind).toBe('test');
    if (plan?.kind !== 'test') throw new Error('attendu test');
    expect(plan.flow.kind).toBe('test');
    if (plan.flow.kind !== 'test') throw new Error('attendu nœud test');
    expect(plan.flow.test.skill).toEqual({ id: 'escalade' });
    expect(plan.flow.test.difficulty).toBe('intermediaire');
    const fail = plan.flow.fail;
    // La branche d'échec déclenche un `fall` de 4 m repositionnant au pied.
    if (fail.kind !== 'seq' || fail.steps[0]?.kind !== 'do') throw new Error('attendu seq/do');
    expect(fail.steps[0].effect).toMatchObject({ type: 'fall', metres: 4, to: { x: 2, y: 1, z: 0 } });
  });

  it('paroi à difficulté éditée → le Test porte cette difficulté', () => {
    const plan = planClimb(cliffScene({ kind: 'surface', difficulty: 'difficile' }), from, to, false);
    if (plan?.kind !== 'test' || plan.flow.kind !== 'test') throw new Error('attendu test');
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

  it('en combat, un faller nommé retombe seul (target hero)', () => {
    const plan = planClimb(cliffScene({ kind: 'surface' }), from, to, false, 'hero-7');
    if (plan?.kind !== 'test' || plan.flow.kind !== 'test') throw new Error('attendu test');
    const fail = plan.flow.fail;
    if (fail.kind !== 'seq' || fail.steps[0]?.kind !== 'do') throw new Error('attendu seq/do');
    expect(fail.steps[0].effect).toMatchObject({ type: 'fall', target: 'hero', heroId: 'hero-7' });
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
