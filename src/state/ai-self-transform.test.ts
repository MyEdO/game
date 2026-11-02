/**
 * IA — auto-transformation (Métamorphose, op `transform`) : un ennemi Enfant d'Ulric adopte sa FORME DE
 * COMBAT (hybride) s'il n'y est pas déjà. La décision est data-driven : `chooseEnemyAction`
 * énumère les manœuvres `targeting:'self'` octroyées par ses traits, les score via `opValue` (le `transform`
 * mesure le gain de combat réel), et le gate d'applicabilité (déjà dans la forme) empêche le spam. AUCUN
 * nom d'entité en dur dans l'IA. La résolution (store) reprend le chemin joueur (`resolveManeuver` sur soi).
 */
import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, type EnemyTurnInput } from '../noyau/monde/ai';
import { emptyScene } from '../noyau/monde/scene';
import type { Combatant, Weapon } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

const MELEE: Weapon = { label: 'Griffes', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
const C = { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const scene = emptyScene('scene-test', 16, 16);

function mk(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, opts: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id, label: id, kind, pos, wounds: blessuresDeBase(14), characteristics: C as never,
    advantage: 0, conditions: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } as never,
    skills: [], talents: [], movement: 4, weapons: [MELEE], ...opts,
  }) as Combatant;
}
const input = (enemy: Combatant, heroes: Combatant[]): EnemyTurnInput =>
  ({ enemy, heroes, scene, blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)), movement: enemy.movement, spells: [] });

describe('chooseEnemyAction — auto-transformation (forme de combat lycanthrope)', () => {
  it('Enfant d’Ulric NON transformé, foe au contact → adopte sa forme hybride (self-buff prioritaire)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { traits: [{ id: 'metamorphose' }] });
    const h = mk('h', 'hero', { x: 6, y: 5 }); // adjacent
    expect(chooseEnemyAction(input(e, [h]))).toEqual({ kind: 'selfManeuver', maneuverId: 'forme-hybride-ulric' });
  });

  it('DÉJÀ dans la forme (activeEffect « ulric-hybride ») → gate : ne re-transforme pas, il frappe', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, {
      traits: [{ id: 'metamorphose' }],
      activeEffects: [{ label: 'ulric-hybride', effectId: 'ulric-hybride', bonus: 0, duration: { scale: 'permanent' } }] as never,
    });
    const h = mk('h', 'hero', { x: 6, y: 5 });
    const a = chooseEnemyAction(input(e, [h]));
    expect(a.kind).not.toBe('selfManeuver'); // reprendre la forme humaine ne vaut rien (opValue 0) → jamais choisi
    expect(a.kind).toBe('melee'); // foe adjacent → il attaque
  });

  it('sans le trait Métamorphose, aucune option de transformation', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 });
    const h = mk('h', 'hero', { x: 6, y: 5 });
    expect(chooseEnemyAction(input(e, [h])).kind).not.toBe('selfManeuver');
  });
});
