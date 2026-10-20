import { describe, it, expect, afterEach } from 'vitest';
import { rollInitiative } from './combatSetup';
import { makeRNG } from '../engine/dice';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';

describe('combatSetup — rollInitiative : DÉFAUT RAW = fixed-i (LDB 13 l.29, tri par Initiative sans dé)', () => {
  const c = (over: Partial<Combatant> = {}) =>
    ({ characteristics: { initiative: 40 }, liveTraits: [], talents: [], ...over }) as unknown as Combatant;

  it('= Initiative de base (profil+traits), SANS dé + Combat instinctif (0 sans le talent)', () => {
    expect(rollInitiative(c(), makeRNG(5))).toBe(40);
  });

  it('ne consomme AUCUN tirage du RNG (ordre stable d’un Round à l’autre)', () => {
    const rng = makeRNG(9);
    rollInitiative(c(), rng);
    expect(rng.int(1, 10)).toBe(makeRNG(9).int(1, 10)); // RNG intact : aucun tirage consommé
  });
});

describe('rollInitiative — méthodes ALÉATOIRES optionnelles (combat-init-method, LDB 13 l.40)', () => {
  afterEach(() => resetRule('combat-init-method'));
  const ci = () => ({ characteristics: { initiative: 45, agilite: 30 }, liveTraits: [], talents: [], activeEffects: [] }) as unknown as Combatant;

  it('roll-i (option aléatoire) : 1d10 + Initiative', () => {
    setRule('combat-init-method', 'roll-i');
    const d = makeRNG(3).int(1, 10);
    expect(rollInitiative(ci(), makeRNG(3))).toBe(45 + d);
  });
  it('roll-bi : 1d10 + Bonus d’Initiative (4) + Bonus d’Agilité (3)', () => {
    setRule('combat-init-method', 'roll-bi');
    const d = makeRNG(3).int(1, 10);
    expect(rollInitiative(ci(), makeRNG(3))).toBe(d + 4 + 3);
  });
});
