/**
 * Créature sans Trait d'arme : elle frappe à Mains nues, +BF +0. LDB 85 l.31 ; LDB 14 l.155 ; LDB 62 l.28.
 */
import { describe, it, expect } from 'vitest';
import { statblockToCombatant } from './monde/spawn';
import { resolveMelee } from '../engine/combat';
import { makeRNG } from '../engine/dice';
import type { CustomStatblock } from '../engine/statblock';

const profil = (label: string): CustomStatblock => ({
  type: 'statblock', label,
  char: { M: 4, 'capacite-de-combat': 95, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, B: 12 },
});

describe('créature sans Trait d’arme — Mains nues', () => {
  it('BF 3, jet 63 sous 95 (DR 3) : 6 Dégâts', () => {
    const brute = statblockToCombatant(profil('Brute'), 'brute', { x: 0, y: 0 });
    const cible = statblockToCombatant(profil('Cible'), 'cible', { x: 1, y: 0 });
    const [poings] = brute.weapons;
    expect(poings.builtinId).toBe('mains-nues');
    const res = resolveMelee(brute, cible, poings, makeRNG(1), { defense: 'aucune' });
    expect(res).toMatchObject({ hit: true, attackerRoll: 63, netSL: 3, damage: 6 });
  });
});
