import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { emitCombatEvent } from './combatEvents';
import { applyOpposedCritical } from './combatFlow';
import './combatFlow'; // effet de bord : routeur de Test + appliers
import { traits } from '../data';
import { setDataset } from '../data/overrides';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';

import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import { hasCondition, COND } from '../engine/conditions';
import type { Combatant, Weapon } from '../engine/types';
import type { TriggeredEffect, EffectTrigger } from './flow';
import { resetCadence } from '../engine/cadence';

/**
 * #316 — les triggers ORPHELINS (jamais émis) sont désormais CÂBLÉS au bus (`emitCombatEvent`) à leur
 * site naturel : `onAttackResolved` (résolution d'attaque), `onCastResolved` (incantation résolue),
 * `onMiscast` (Imparfaite), `onCharged` (charge subie), et 7bis `onCrit` sur Critique OPPOSÉ. Preuve :
 * un effet de DONNÉE synthétique posé sur chaque trigger SE DÉCLENCHE via le bus.
 */

const bare = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'c', name: 'C', kind: 'enemy',
  characteristics: { force: 35, endurance: 35 } as never,
  wounds: { current: 15, max: 15 }, advantage: 0, conditions: [], skills: [], talents: [], traits: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
  ...over,
} as unknown as Combatant);

/** Stub de store (getter) exposant une battle minimale + pas de scène. */
const stub = (c: Combatant) => (() => ({ battle: { combatants: [c] }, scene: undefined })) as never;
const empetre = (c: Combatant) => c.conditions.find((x) => x.id === 'empetre');

/** Enregistre un trait synthétique (`effects` sur `trigger`) et le pose sur un combattant nu. */
function withSyntheticTrait(id: string, effects: TriggeredEffect[]): Combatant {
  setDataset('traits', [...traits, { id, label: id, effects } as never]);
  return bare({ traits: [{ id }] } as Partial<Combatant>);
}
const SELF_EMPETRE: TriggeredEffect = {
  trigger: 'onHit', on: 'self',
  flow: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'empetre', value: 1 }] } },
};

const TRAITS_LIVRES = [...traits];

describe('#316 — triggers orphelins câblés au bus (émission + déclenchement de donnée)', () => {
  afterEach(() => { setDataset('traits', TRAITS_LIVRES); });

  it.each<[EffectTrigger, string]>([
    ['onAttackResolved', 'synth-onattackresolved'],
    ['onCastResolved', 'synth-oncastresolved'],
    ['onMiscast', 'synth-onmiscast'],
  ])('un effet de donnée sur %s SE DÉCLENCHE via emitCombatEvent', (trigger, id) => {
    const c = withSyntheticTrait(id, [{ ...SELF_EMPETRE, trigger }]);
    emitCombatEvent(trigger, { get: stub(c), set: (() => {}) as never, battle: {} as never, self: c, audience: [c], sink: () => {}, triggerCtx: { rng: makeRNG(1) } });
    expect(empetre(c)?.value).toBe(1);
  });

  it('onCharged (point 4) : un effet NON-attaque-gratuite se déclenche ET grantFreeAttack reste INERTE (pas de double frappe)', () => {
    // Flow MIXTE : pose Empêtré (non-free) + grantFreeAttack (free). Via le bus (voie PURE), seul le
    // non-free s'applique ; grantFreeAttack est inerte → pas d'attaque gratuite comptée (la vraie frappe
    // ne part QUE de resolveFreeAttacks, cf. talent-free-attack.test.ts).
    const c = withSyntheticTrait('synth-oncharged-mixed', [{
      trigger: 'onCharged', on: 'self',
      flow: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [
        { op: 'condition', id: 'empetre', value: 1 },
        { op: 'grantFreeAttack', when: 'immediate' } as never,
      ] } },
    }]);
    emitCombatEvent('onCharged', { get: stub(c), set: (() => {}) as never, battle: {} as never, self: c, audience: [c], sink: () => {}, triggerCtx: { rng: makeRNG(1) } });
    expect(empetre(c)?.value).toBe(1); // effet non-free déclenché
    expect(c.freeAttacksThisTurn).toBeUndefined(); // grantFreeAttack NON exécuté par le bus → pas de double
  });
});

/**
 * 7bis (#316) : un Coup Critique OPPOSÉ (LDB 14 l.3 — double au Test opposé) est une Blessure Critique ;
 * `applyOpposedCritical` émet désormais `onCrit` via le bus → les Atouts d'arme « sur Critique » (Taillade
 * → Hémorragique, AA 8 l.87) s'appliquent, avec l'arme RÉELLE de l'attaquant (weaponObj).
 */
describe('7bis — applyOpposedCritical émet onCrit (Taillade sur Critique opposé)', () => {
  beforeEach(() => { vi.useFakeTimers(); resetCadence(); useGame.setState({ battle: null, pendingCascade: null, pendingLogQueue: [] }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  const taillade = (): Weapon => ({ label: 'Hache de Taillade', type: 'melee', damage: { plusBF: true, flat: 6 }, qualities: [{ id: 'taillade' }] } as Weapon);

  it('un Critique opposé de l’attaquant Taillade → la victime gagne Hémorragique', () => {
    seedBattleRng(3);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }; // pas de PA déviable → application directe
    E.weapons = [taillade()];
    useGame.setState({ battle: { ...b } });

    const log: string[] = [];
    applyOpposedCritical(useGame.getState, useGame.setState, H, 40, { attackerId: E.id, weapon: 'Hache de Taillade', weaponObj: taillade() }, log);

    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(hasCondition(h, COND.hemorragique)).toBe(true); // onCrit émis par le bus → Taillade appliquée
  });
});
