/**
 * Scénario « Métamorphose — Enfant d'Ulric » : vérifie de bout en bout, sur les VRAIS enregistrements du
 * bestiaire, la conception à deux variantes (« les deux ont le droit d'exister ») :
 *  - `enfant-d-ulric-humain` (forme humaine, trait Métamorphose) → l'IA décide de se transformer ;
 *  - `enfant-d-ulric` (forme hybride, bête prête, SANS Métamorphose) → ne se re-transforme jamais
 *    (pas de double-application des deltas).
 */
import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, type EnemyTurnInput } from '../../state/ai';
import { creatureToCombatant } from '../../state/spawn';
import { emptyScene } from '../../state/scene';
import { findCreatureById } from '../../data';
import { scenario } from './17-metamorphose-ulric';
import type { Combatant } from '../../engine/types';
const scenarioConstruit = scenario.construire();

const scene = emptyScene(16, 16);
const hero = (): Combatant => ({
  id: 'h', name: 'h', kind: 'hero', pos: { x: 6, y: 5 },
  characteristics: { 'capacite-de-combat': 35, 'capacite-de-tir': 30, force: 35, endurance: 35, initiative: 30, agilite: 35, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
  wounds: { current: 14, max: 14, base: 14 }, advantage: 0, conditions: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  skills: [], talents: [], movement: 4, weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] }],
} as unknown as Combatant);
const inputFor = (e: Combatant): EnemyTurnInput =>
  ({ enemy: e, heroes: [hero()], scene, blocked: new Set(['6,5']), movement: e.movement ?? 4, spells: [] });

describe('Scénario 17 — Métamorphose Enfant d’Ulric (records réels)', () => {
  it("la forme HUMAINE (enfant-d-ulric-humain) choisit de se métamorphoser", () => {
    const e = creatureToCombatant(findCreatureById('enfant-d-ulric-humain')!, 'e', { x: 5, y: 5 });
    expect(chooseEnemyAction(inputFor(e))).toEqual({ kind: 'selfManeuver', maneuverId: 'forme-hybride-ulric' });
  });

  it("la forme HYBRIDE (enfant-d-ulric, bête prête) ne se re-transforme pas — pas de trait Métamorphose", () => {
    const cr = findCreatureById('enfant-d-ulric')!;
    expect(cr.traits.some((t) => t.id === 'metamorphose')).toBe(false); // conception : la bête n'a plus le trait
    const e = creatureToCombatant(cr, 'e', { x: 5, y: 5 });
    expect(chooseEnemyAction(inputFor(e)).kind).not.toBe('selfManeuver');
  });

  it("le scénario spawne deux lycanthropes en forme humaine transformable", () => {
    const enc = scenarioConstruit.scene.encounters.find((x) => x.id === 'enc-ulric')!;
    const members = enc.members ?? [];
    expect(members.length).toBe(2);
    const refs = members.map((m) => scenarioConstruit.scene.entities.find((e) => e.id === m.entityId)?.ref);
    expect(refs.every((r) => r === 'enfant-d-ulric-humain')).toBe(true);
  });
});
