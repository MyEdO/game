import { describe, it, expect } from 'vitest';
import { notifySlain } from './combatFlow';
import type { Combatant } from '../engine/types';
import type { Scene } from '../noyau/monde/scene';

/**
 * Trait Charnier (frenchy.bzh) — « si la créature est vaincue, 3D10 Zombies sortent de sa carcasse ».
 * Câblé 100% en DONNÉE via l'op IMPURE `summon` portée par un effet `onSlain` : `summon` est inerte dans
 * applyOps (grille/initiative) ; `notifySlain` la moissonne (`resolveTriggerImpureOps`, GÉNÉRIQUE — pas
 * limité à summon) et la résout par `summonFlow.applySummon`, comme au lancement d'un sort d'invocation.
 */
const charnier = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'ch', name: 'Charnier', kind: 'enemy',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  wounds: { current: 0, max: 12, base: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
  traits: [{ id: 'charnier' }], weapons: [], armour: { corps: 0 }, pos: { x: 5, y: 5 }, dead: true,
  ...over,
}) as unknown as Combatant;
const scene = (): Scene => ({ id: 's', name: 's', dimensions: { w: 14, h: 14 }, ambiance: 'exterieur', layers: [{ z: 0, tiles: new Array(14 * 14).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as unknown as Scene);
const battle = (cs: Combatant[]): any => ({ combatants: cs, order: cs.map((c) => c.id), baseOrder: cs.map((c) => c.id), turn: 0, round: 1, log: [], zones: [], over: false });
function harness(b: any) { let s: any = { battle: b, scene: scene() }; return { get: () => s, set: (p: any) => { s = { ...s, ...p }; }, state: () => s }; }

describe('Trait Charnier — death-spawn de Zombies (op summon onSlain résolue par notifySlain)', () => {
  it('à la mort, invoque ≥3 Zombies hostiles au groupe (même camp que le défunt)', () => {
    const c = charnier();
    const h = harness(battle([c]));
    notifySlain(h.get as never, h.set as never, c);
    const z = h.state().battle.combatants.filter((x: Combatant) => x.summon);
    expect(z.length).toBeGreaterThanOrEqual(3); // 3d10 → au moins 3
    expect(z.every((s: Combatant) => s.kind === 'enemy')).toBe(true); // camp du défunt (enemy) → attaquent le groupe
    expect(z.every((s: Combatant) => /zombie/i.test(s.label))).toBe(true);
  });

  it('sans le trait Charnier → aucun spawn à la mort', () => {
    const c = charnier({ traits: [] as never });
    const h = harness(battle([c]));
    notifySlain(h.get as never, h.set as never, c);
    expect(h.state().battle.combatants.filter((x: Combatant) => x.summon).length).toBe(0);
  });
});
