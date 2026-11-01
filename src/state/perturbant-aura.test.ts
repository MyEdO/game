import { describe, it, expect } from 'vitest';
import { combatHooksOf } from '../noyau/combatHooks';
import { combatTestPenalty } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

/**
 * Perturbant (LDB 85 l.260-262) — MIGRÉ en DONNÉES : l'aura (−20 aux Tests à BE mètres, « Toute personne »,
 * NON cumulable) vit dans `TraitData.aura` ; le hook GÉNÉRIQUE `recompute-auras` la projette (par géométrie)
 * dans `Combatant.auraMods`, lu par `passiveMods` (kind `etat`) → `combatTestPenalty`. Aucun trait nommé.
 */
const mk = (over: Partial<Combatant> = {}): Combatant => (blessuresSurLeProfil({
  id: 'c', name: 'C', kind: 'enemy',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  wounds: blessuresDeBase(10), advantage: 0, conditions: [], skills: [], talents: [], traits: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4,
  pos: { x: 5, y: 5 },
  ...over,
})) as unknown as Combatant;

const recompute = (combatants: Combatant[]) => {
  const hook = combatHooksOf('onRoundEnd').find((h) => h.id === 'recompute-auras')!;
  hook.run({ get: () => ({ scene: null }), battle: { combatants } } as never);
};

describe('Perturbant — aura de DONNÉE projetée par le hook générique recompute-auras', () => {
  it('un ennemi à BE mètres d’une créature Perturbante subit −20 aux Tests', () => {
    const p = mk({ id: 'p', kind: 'enemy', traits: [{ id: 'perturbant' }] as never, pos: { x: 5, y: 5 } as never }); // BE 3 → 3 m
    const hero = mk({ id: 'h', kind: 'hero', pos: { x: 6, y: 5 } as never }); // 1 case = 2 m ≤ 3 m
    recompute([p, hero]);
    expect(hero.auraMods).toEqual([{ op: { op: 'testMod', amount: -20 }, src: { category: 'traits', id: 'perturbant' } }]);
    expect(combatTestPenalty(hero)).toBe(-20);
  });
  it('hors de portée → aucune aura', () => {
    const p = mk({ id: 'p', kind: 'enemy', traits: [{ id: 'perturbant' }] as never, pos: { x: 5, y: 5 } as never });
    const hero = mk({ id: 'h', kind: 'hero', pos: { x: 15, y: 5 } as never });
    recompute([p, hero]);
    expect(hero.auraMods ?? []).toEqual([]);
    expect(combatTestPenalty(hero)).toBe(0);
  });
  it('un ALLIÉ dans l’aura subit le −20 comme un ennemi (LDB 85 l.262 : « Toute personne »)', () => {
    const p = mk({ id: 'p', kind: 'enemy', traits: [{ id: 'perturbant' }] as never, pos: { x: 5, y: 5 } as never });
    const ally = mk({ id: 'a', kind: 'enemy', pos: { x: 6, y: 5 } as never });
    recompute([p, ally]);
    expect(ally.auraMods).toEqual([{ op: { op: 'testMod', amount: -20 }, src: { category: 'traits', id: 'perturbant' } }]);
    expect(combatTestPenalty(ally)).toBe(-20);
  });
  it('la créature Perturbante elle-même n’est JAMAIS touchée par son aura', () => {
    const p = mk({ id: 'p', kind: 'enemy', traits: [{ id: 'perturbant' }] as never, pos: { x: 5, y: 5 } as never });
    const ally = mk({ id: 'a', kind: 'enemy', pos: { x: 6, y: 5 } as never });
    recompute([p, ally]);
    expect(p.auraMods ?? []).toEqual([]);
    expect(combatTestPenalty(p)).toBe(0);
  });
  it('NON-CUMUL : deux créatures Perturbantes adjacentes → −20 (pas −40)', () => {
    const p1 = mk({ id: 'p1', kind: 'enemy', traits: [{ id: 'perturbant' }] as never, pos: { x: 5, y: 5 } as never });
    const p2 = mk({ id: 'p2', kind: 'enemy', traits: [{ id: 'perturbant' }] as never, pos: { x: 5, y: 6 } as never });
    const hero = mk({ id: 'h', kind: 'hero', pos: { x: 6, y: 5 } as never });
    recompute([p1, p2, hero]);
    expect(hero.auraMods?.length).toBe(2); // deux sources accumulées
    expect(combatTestPenalty(hero)).toBe(-20); // mais non-cumul (pool min), pas −40
  });
  it('HEIGHT/Z-AWARE (#805) : un étage au-dessus (même x,y, `pos.h` élevé) échappe à l’aura', () => {
    const p = mk({ id: 'p', kind: 'enemy', traits: [{ id: 'perturbant' }] as never, pos: { x: 5, y: 5, h: 0 } as never }); // BE 3 → 3 m
    const above = mk({ id: 'h', kind: 'hero', pos: { x: 5, y: 5, h: 10 } as never }); // même case au plan, 10 m plus haut
    recompute([p, above]);
    expect(above.auraMods ?? []).toEqual([]); // horizontalement adjacent (0) MAIS verticalement hors de portée
  });
  it('HEIGHT/Z-AWARE (#805) : même étage (`pos.h` identique) — l’aura porte comme avant', () => {
    const p = mk({ id: 'p', kind: 'enemy', traits: [{ id: 'perturbant' }] as never, pos: { x: 5, y: 5, h: 3 } as never });
    const hero = mk({ id: 'h', kind: 'hero', pos: { x: 6, y: 5, h: 3 } as never });
    recompute([p, hero]);
    expect(hero.auraMods).toEqual([{ op: { op: 'testMod', amount: -20 }, src: { category: 'traits', id: 'perturbant' } }]);
  });
  it('recalcul intégral : sorti de portée au Round suivant → aura effacée', () => {
    const p = mk({ id: 'p', kind: 'enemy', traits: [{ id: 'perturbant' }] as never, pos: { x: 5, y: 5 } as never });
    const hero = mk({ id: 'h', kind: 'hero', pos: { x: 6, y: 5 } as never });
    recompute([p, hero]);
    expect(hero.auraMods?.length).toBe(1);
    hero.pos = { x: 20, y: 20 } as never; // s'éloigne
    recompute([p, hero]);
    expect(hero.auraMods ?? []).toEqual([]); // reset + hors portée
  });
});
