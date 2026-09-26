import { describe, it, expect } from 'vitest';
import { fireTriggers, applyTriggeredEffects } from './triggeredEffects';
import { hasCondition, COND } from '../engine/conditions';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import type { TriggeredEffect } from './flow';

/**
 * Démoniaque — bannissement « à la mort » (LDB 85 l.98 : « son âme retourne dans les Royaumes du Chaos,
 * ce qui la retire du jeu »). L'effet est 100 % DONNÉE : op `banish` portée par l'`effects` du trait,
 * déclenchée par `onSlain` — donc QUEL QUE SOIT le chemin de mort (0 PB, Critique LÉTAL/démembrement, mort
 * comme attaquant sous un Critique défensif, mort-auto), sans branche en dur dans applyAttackResult. Le
 * porteur réagit à SA PROPRE chute (le dispatcher autorise `on:'self'` sur une cible hors-combat) ; `onSlain`
 * n'est tiré qu'UNE fois (garde `slainNotified`, posée par `notifySlain`).
 */

const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'd', name: 'Démon', kind: 'enemy', characteristics: { endurance: 40 }, skills: [], talents: [], traits: [],
  conditions: [], activeEffects: [], liveTraits: [], weapons: [], armour: { corps: 0 },
  wounds: { current: 0, max: 12, base: 12 }, advantage: 0,
  ...over,
}) as unknown as Combatant;

const get = ((c: Combatant) => () => ({ battle: { combatants: [c] } })) as never;
const slain = (c: Combatant) => fireTriggers((get as (c: Combatant) => unknown)(c) as never, c, 'onSlain', {} as never);

describe('Démoniaque — banni à la mort (op `banish` en DONNÉE, déclenché par onSlain)', () => {
  it('mis hors de combat AVEC des PB restants (Critique LÉTAL — démembrement) → quand même banni + narré', () => {
    const demon = mk({ traits: [{ id: 'demoniaque', value: 8 }] as never, wounds: { current: 6, max: 12, base: 12 } as never, dead: true as never });
    const lines = slain(demon);
    expect(demon.dead).toBe(true);
    expect(lines.join(' ')).toMatch(/banni/i); // narration de bannissement émise même PB > 0
  });
  it('réduit à 0 PB → banni (dead)', () => {
    const demon = mk({ traits: [{ id: 'demoniaque', value: 8 }] as never });
    slain(demon);
    expect(demon.dead).toBe(true);
  });
  it('créature SANS Démoniaque mise hors de combat → inerte (pas de bannissement)', () => {
    const mortal = mk({ traits: [{ id: 'bestial' }] as never, dead: true as never });
    expect(slain(mortal).join(' ')).not.toMatch(/banni/i);
  });
});

describe('onWoundLoss — TOUTE perte de PB (mêlée OU distance) ; le type voyage en attribut', () => {
  const alive = (over: Partial<Combatant> = {}) => mk({ wounds: { current: 10, max: 10, base: 10 } as never, ...over });

  it('Sang corrosif éclabousse les Engagés même sur une perte à DISTANCE (RAW LDB 85 l.310 : « chaque fois »)', () => {
    const acid = alive({ id: 'ac', traits: [{ id: 'sang-corrosif' }] as never });
    const foe = alive({ id: 'fo', engagedWith: ['ac'] as never });
    const g = (() => ({ battle: { combatants: [acid, foe] } })) as never;
    const before = foe.wounds.current;
    fireTriggers(g, acid, 'onWoundLoss', { attackType: 'ranged', rng: makeRNG(1) } as never);
    expect(foe.wounds.current).toBeLessThan(before); // aucun gate « mêlée seulement »
  });

  it('un effet `attackType:\'melee\'` ne réagit qu’aux pertes de MÊLÉE', () => {
    const eff: TriggeredEffect = {
      trigger: 'onWoundLoss', on: 'self', attackType: 'melee',
      flow: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'sonne', value: 1 }] } } as never,
    };
    const g = ((c: Combatant) => () => ({ battle: { combatants: [c] } })) as never;
    const ranged = alive({ id: 'r' });
    applyTriggeredEffects((g as (c: Combatant) => unknown)(ranged) as never, ranged, [eff], 'onWoundLoss', { attackType: 'ranged' });
    expect(hasCondition(ranged, COND.sonne)).toBe(false); // type ≠ → ignoré
    const melee = alive({ id: 'm' });
    applyTriggeredEffects((g as (c: Combatant) => unknown)(melee) as never, melee, [eff], 'onWoundLoss', { attackType: 'melee' });
    expect(hasCondition(melee, COND.sonne)).toBe(true); // type = → réagit
  });
});
