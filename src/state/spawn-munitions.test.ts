import { describe, it, expect } from 'vitest';
import { testScenarios } from '../scenes/test-scenarios';
import { ficheDEntite } from './sceneNpc';
import { memoByRef } from './sceneMemo';
import { consumeAmmo } from '../engine/items';
import type { Scene, SceneEntity } from './scene';

// #2097 — `consumeAmmo` écrit le stock `poste.ammo` hydraté au spawn (`hydratePoste`).
const geler = memoByRef((s: Scene) => s);

function coqueArmee(): { scene: Scene; ent: SceneEntity } {
  const scene = testScenarios.find((s) => s.id === 'combat-naval')!.construire().scene;
  const ent = scene.entities.find((e) => e.kind === 'personnage' && e.postes?.some((p) => p.ammo?.length))!;
  expect(ent, 'combat-naval : une entité porte un poste armé de munitions').toBeDefined();
  return { scene, ent };
}

describe('munition tirée d’un poste né de la scène (#2097)', () => {
  it('la scène garde son stock', () => {
    const { ent } = coqueArmee();
    const avant = ent.postes![0].ammo![0].qty;
    const c = ficheDEntite(ent);
    c.mannedPoste = c.postes![0];
    consumeAmmo(c, c.postes![0].ammo![0]);
    expect(c.postes![0].ammo![0].qty).toBe(avant! - 1);
    expect(ent.postes![0].ammo![0].qty).toBe(avant);
  });

  it('une scène mémorisée (gelée) ne fait pas lever le tir', () => {
    const { scene, ent } = coqueArmee();
    geler(scene);
    expect(Object.isFrozen(ent.postes![0].ammo![0])).toBe(true);
    const c = ficheDEntite(ent);
    c.mannedPoste = c.postes![0];
    expect(() => consumeAmmo(c, c.postes![0].ammo![0])).not.toThrow();
  });
});
