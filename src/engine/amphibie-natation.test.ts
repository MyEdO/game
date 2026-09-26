import { describe, it, expect } from 'vitest';
import { skillDRBonus } from './ops';
import type { Combatant } from './types';

/**
 * Amphibie (LDB 85 l.21, VERBATIM du desc) : « Elle peut ajouter son bonus d'Agilité au DR de tous les Tests
 * de Natation… ». Exprimé en donnée : passive `skillDRBonus{ skill:'natation', bonus:{ bonusOf:'Ag' } }` —
 * lu par `skillDRBonus(c, skill)` que la couche de Test générique applique (rollFlows). Par-créature (BAg).
 */
const mk = (traits: { id: string }[], ag: number): Combatant => ({
  id: 'c', name: 'Bête', kind: 'enemy',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 0, force: 30, endurance: 30, initiative: 30, agilite: ag, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  movement: 6, wounds: { current: 20, max: 20 }, weapons: [], skills: [], talents: [], traits,
} as unknown as Combatant);

describe('Amphibie — +Bonus d’Agilité au DR des Tests de Natation (LDB 85 l.21)', () => {
  it('Ag 40 (BAg 4) → +4 DR à la Natation, et RIEN sur les autres Compétences', () => {
    const c = mk([{ id: 'amphibie' }], 40);
    expect(skillDRBonus(c, 'natation')).toBe(4);
    expect(skillDRBonus(c, 'escalade')).toBe(0);
    expect(skillDRBonus(c, 'athletisme')).toBe(0);
  });

  it('le bonus SUIT l’Agilité de la créature (Ag 25 → BAg 2)', () => {
    expect(skillDRBonus(mk([{ id: 'amphibie' }], 25), 'natation')).toBe(2);
  });

  it('sans le trait Amphibie → aucun bonus de Natation', () => {
    expect(skillDRBonus(mk([], 40), 'natation')).toBe(0);
  });
});
