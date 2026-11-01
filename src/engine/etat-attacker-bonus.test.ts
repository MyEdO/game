import { describe, it, expect } from 'vitest';
import { meleeAttackerBonus, incomingMeleeAdvantage, addCondition, COND } from './conditions';
import type { Combatant } from './types';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

/** Combattant nu (le bonus dépend UNIQUEMENT des États portés, lus en données via passiveMods). */
const mk = (): Combatant => (blessuresSurLeProfil({
  id: 'x', name: 'X', kind: 'enemy', characteristics: {}, skills: [], talents: [], traits: [],
  conditions: [], activeEffects: [], liveTraits: [], weapons: [], armour: [],
  wounds: blessuresDeBase(10), advantage: 0,
})) as unknown as Combatant;

describe('meleeAttackerBonus — bonus à l’attaquant lu en DONNÉES (etats.json, plus de branche par-nom)', () => {
  it('À Terre → +20', () => {
    const c = mk(); addCondition(c, COND.aTerre);
    expect(meleeAttackerBonus(c)).toBe(20);
  });
  it('Surpris → +20', () => {
    const c = mk(); addCondition(c, COND.surpris);
    expect(meleeAttackerBonus(c)).toBe(20);
  });
  it('Aveuglé → +10', () => {
    const c = mk(); addCondition(c, COND.aveugle);
    expect(meleeAttackerBonus(c)).toBe(10);
  });
  it('non-cumul (LDB 16) : Aveuglé + À Terre → le MEILLEUR seul (+20)', () => {
    const c = mk(); addCondition(c, COND.aveugle); addCondition(c, COND.aTerre);
    expect(meleeAttackerBonus(c)).toBe(20);
  });
  it('aucun État pertinent (Empoisonné n’octroie pas de bonus) → 0', () => {
    const c = mk(); addCondition(c, COND.empoisonne);
    expect(meleeAttackerBonus(c)).toBe(0);
  });
});

describe('Assourdi — +10 flanc/derrière (LDB 16 l.29) : conditionnel à l’angle, ADDITIF', () => {
  it('Assourdi de FACE → aucun bonus', () => {
    const c = mk(); addCondition(c, COND.assourdi);
    expect(meleeAttackerBonus(c)).toBe(0);
    expect(meleeAttackerBonus(c, { flankRear: false })).toBe(0);
  });
  it('Assourdi par le flanc/derrière → +10', () => {
    const c = mk(); addCondition(c, COND.assourdi);
    expect(meleeAttackerBonus(c, { flankRear: true })).toBe(10);
  });
  it('plusieurs Assourdi n’augmentent pas le +10 (« pas augmenté avec de multiples Assourdi »)', () => {
    const c = mk(); addCondition(c, COND.assourdi, 3);
    expect(meleeAttackerBonus(c, { flankRear: true })).toBe(10);
  });
  it('SUPPLÉMENTAIRE : Assourdi (+10 flanc) s’ajoute à À Terre (+20 inconditionnel) → +30', () => {
    const c = mk(); addCondition(c, COND.assourdi); addCondition(c, COND.aTerre);
    expect(meleeAttackerBonus(c, { flankRear: true })).toBe(30); // 20 (À Terre) + 10 (Assourdi flanc)
    expect(meleeAttackerBonus(c, { flankRear: false })).toBe(20); // de face : seul À Terre
  });
});

describe('incomingMeleeAdvantage — Avantage donné à l’assaillant lu en DONNÉES (Sonné, plus de branche par-nom)', () => {
  it('Sonné → +1 Avantage à l’attaquant en mêlée (LDB 16 l.125)', () => {
    const c = mk(); addCondition(c, COND.sonne);
    expect(incomingMeleeAdvantage(c)).toBe(1);
  });
  it('le bonus de TOUCHE (incomingAttackMod) et l’AVANTAGE (incomingAdvantage) sont distincts : Sonné ne donne PAS de +toucher', () => {
    const c = mk(); addCondition(c, COND.sonne);
    expect(meleeAttackerBonus(c)).toBe(0);      // Sonné n'a pas d'incomingAttackMod
    expect(incomingMeleeAdvantage(c)).toBe(1);  // … mais un incomingAdvantage
  });
  it('À Terre donne +toucher mais PAS d’Avantage (≠ Sonné)', () => {
    const c = mk(); addCondition(c, COND.aTerre);
    expect(incomingMeleeAdvantage(c)).toBe(0);
  });
});
