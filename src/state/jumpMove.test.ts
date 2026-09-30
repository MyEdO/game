import { describe, it, expect } from 'vitest';
import { emptyScene, type Scene, type Terrain, type Effect } from './scene';
import { flowEffects, type Flow } from './flow';
import { planJump } from './jumpMove';

/**
 * `planJump` traduit un PAS de saut (du chemin 3D) en plan jouable, SANS nouveau flux : un saut dans
 * la portée libre (LDB 15 l.76) se franchit d'office ; un saut plus long = l'Effet `test` existant
 * (Athlétisme, « Saut ») dont l'échec déclenche `fall` dans le gouffre/niveau inférieur. Réutilise
 * `test` + `fall` (déjà livrés) → zéro modale dédiée.
 */
function platformGap(): Scene {
  const s = emptyScene(5, 3); // couche 0 : herbe marchable PARTOUT (le parterre sous le gouffre), 0 m
  const z1 = new Array(15).fill('vide') as Terrain[];
  const h1 = new Array(15).fill(0) as number[];
  for (const x of [0, 1, 3, 4]) for (let y = 0; y < 3; y++) { z1[y * 5 + x] = 'plancher'; h1[y * 5 + x] = 4; } // 2 plateformes à 4 m, gouffre en x=2
  s.layers.push({ z: 1, tiles: z1, height: h1 });
  return s;
}

describe('planJump', () => {
  const scene = platformGap();

  it('saut dans la portée libre = franchissement d’office (kind « free »)', () => {
    const plan = planJump(scene, { x: 1, y: 1, z: 1 }, { x: 3, y: 1, z: 1 }, 12, 0); // M=12 → libre=2 cases ≥ 2
    expect(plan.kind).toBe('free');
  });

  it('saut trop long pour un humain = nœud Test « Saut » dont l’échec tombe dans le gouffre', () => {
    const plan = planJump(scene, { x: 1, y: 1, z: 1 }, { x: 3, y: 1, z: 1 }, 4, 0); // M=4 → libre=0 → Test requis
    expect(plan.kind).toBe('test');
    const node = (plan.kind === 'test' ? plan.flow : null) as Extract<Flow, { kind: 'test' }>;
    expect(node.kind).toBe('test');
    expect(node.test.skill).toEqual({ id: 'athletisme' });
    expect(node.test.difficulty).toBe('intermediaire'); // sans élan
    const fall = flowEffects(node.fail)[0] as Extract<Effect, { type: 'fall' }>;
    expect(fall.type).toBe('fall');
    expect(fall.to).toEqual({ x: 2, y: 1, z: 0 }); // tombe sur le parterre (z0) sous le gouffre (x=2)
    expect(fall.metres).toBe(4); // 1 étage ≈ 4 m
  });

  it('avec un élan suffisant (≥ M/2 cases), le Test est Accessible (+20)', () => {
    const plan = planJump(scene, { x: 1, y: 1, z: 1 }, { x: 3, y: 1, z: 1 }, 4, 2); // élan 2 ≥ ceil(4/2)=2
    expect(plan.kind === 'test' && (plan.flow as Extract<Flow, { kind: 'test' }>).test.difficulty).toBe('accessible');
  });

  it('gouffre SANS surface sous lui (même étage, aucune couche) : refus NOMMÉ, jamais une chute sur rien', () => {
    const s = emptyScene(5, 3);
    s.layers[0].tiles[1 * 5 + 2] = 'vide'; // le gouffre (2,1) au rez, rien dessous
    expect(planJump(s, { x: 1, y: 1 }, { x: 3, y: 1 }, 4, 0)).toEqual({ kind: 'none', raison: 'aucune-surface' });
  });
});
