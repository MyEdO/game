import { describe, it, expect } from 'vitest';
import { hitModifiers } from '../noyau/combat/hitModifiers';
import { isMagicallyAsleep, wakeSleeper } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import type { AttackResult } from '../engine/combat';

/**
 * Réveil d'un dormeur MAGIQUE à l'attaque (« bruits/bousculade la réveillent », sort Sommeil) — jadis un op
 * `narrative` « arbitrage MJ », désormais MÉCANISÉ (le MJ, c'est le moteur). Une cible qui dort EST Inconsciente,
 * mais on la distingue d'un KO à 0 PB par la DURÉE de son Inconscient + des PB > 0 : la première se RÉVEILLE
 * quand on l'attaque (pas de coup de grâce), la seconde reste un Inconscient achevable (LDB 16 l.113).
 */
const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 's', name: 'Dormeur', kind: 'hero', conditions: [{ id: 'inconscient', value: 1, roundsLeft: 3 }],
  wounds: { current: 12, max: 12, base: 12 }, traits: [], weapons: [], armour: { corps: 0 }, advantage: 0,
  characteristics: {} as never, skills: [], talents: [],
  ...over,
} as unknown as Combatant);

const wakeMod = hitModifiers().find((m) => m.id === 'wake-sleeper')!;
const run = (attacker: Combatant, target: Combatant, autoKill = true): AttackResult =>
  wakeMod.apply({
    attacker, target, weapon: { type: 'melee', name: 'Épée' } as never, attaque: 'melee',
    res: { hit: true, autoKill } as unknown as AttackResult,
    get: (() => ({ battle: { combatants: [] } })) as never, set: (() => {}) as never, sink: () => {},
    ouvrirSauvegarde: () => {}, // aucune sauvegarde ici : ce dormeur n'a aucun Trait à Indice
  });

describe('isMagicallyAsleep — dormeur ≠ KO', () => {
  it('Inconscient À DURÉE + PB > 0 = endormi magiquement', () => {
    expect(isMagicallyAsleep(mk())).toBe(true);
  });
  it('Inconscient SANS durée (KO au combat) = PAS endormi', () => {
    expect(isMagicallyAsleep(mk({ conditions: [{ id: 'inconscient', value: 1 }] as never }))).toBe(false);
  });
  it('Inconscient à durée mais 0 PB (mourant) = PAS endormi', () => {
    expect(isMagicallyAsleep(mk({ wounds: { current: 0, max: 12, base: 12 } as never }))).toBe(false);
  });
});

describe('wake-sleeper (modifier de touche)', () => {
  const foe = (traits: { id: string }[] = []): Combatant => ({ id: 'a', name: 'Brute', kind: 'enemy', traits } as unknown as Combatant);

  it('une attaque NORMALE réveille le dormeur et ANNULE le coup de grâce (il encaisse, ne meurt pas)', () => {
    const target = mk();
    const res = run(foe(), target);
    expect(target.conditions.find((c) => c.id === 'inconscient')).toBeUndefined(); // réveillé
    expect(res.autoKill).toBe(false); // pas achevé — il se relève
  });

  it('une créature à Salive analgésique NE réveille PAS sa proie (morsure indolore → s’accroche et draine)', () => {
    const target = mk();
    const res = run(foe([{ id: 'salive-analgesique' }]), target);
    expect(target.conditions.find((c) => c.id === 'inconscient')).toBeDefined(); // reste endormi
    expect(res.autoKill).toBe(true); // inchangé (le modifier n'est pas intervenu)
  });

  it('wakeSleeper retire l’Inconscient de sommeil', () => {
    const target = mk();
    wakeSleeper(target);
    expect(target.conditions).toHaveLength(0);
  });
});
