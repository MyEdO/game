import { describe, it, expect } from 'vitest';
import { findStructureById } from '../data';
import { woundsFromHit } from './woundsCalc';
import { structureCombatant } from './structures';
import type { Weapon, Combatant } from './types';

/**
 * Inoffensive (LDB 62 l.327) : « Tous les PA sont doublés contre les armes Inoffensives. De plus,
 * vous n'infligez pas automatiquement le minimum de 1 Blessure sur une touche réussie en combat. »
 * `woundsFromHit` = POINT UNIQUE (#473).
 */
const mkWeapon = (over: Partial<Weapon> = {}): Weapon => ({
  label: 'arme',
  type: 'melee',
  damage: { plusBF: false, flat: 0 },
  qualities: [],
  ...over,
});

const target = (armour: number): Combatant =>
  ({
    bodyShape: 'humanoide',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    armour: { tete: armour, brasG: armour, brasD: armour, corps: armour, jambeG: armour, jambeD: armour },
  } as Combatant);

describe('woundsFromHit — Inoffensive (LDB 62 l.327)', () => {
  it('PA doublés : 2 PA (arme normale) vs 4 PA effectifs (arme Inoffensive), BE identique', () => {
    const normale = mkWeapon({ qualities: [] });
    const inoffensive = mkWeapon({ qualities: [{ id: 'inoffensive' }] });
    // BE(30)=3, PA=2, Dégâts totaux=10 → normale : 10-(3+2)=5 ; Inoffensive : 10-(3+4)=3.
    expect(woundsFromHit(normale, target(2), 'corps', 10, 0, 1, undefined)).toBe(5);
    expect(woundsFromHit(inoffensive, target(2), 'corps', 10, 0, 1, undefined)).toBe(3);
  });

  it('minimum de 1 Blessure NON forcé : une touche trop faible tombe à 0 (≠ arme normale, plancher 1)', () => {
    const normale = mkWeapon({ qualities: [] });
    const inoffensive = mkWeapon({ qualities: [{ id: 'inoffensive' }] });
    // BE(30)=3, PA=2 → normale : max(1, 4-(3+2))=1(plancher) ; Inoffensive : PA doublés à 4 → max(0, 4-(3+4))=0.
    expect(woundsFromHit(normale, target(2), 'corps', 4, 0, 1, undefined)).toBe(1);
    expect(woundsFromHit(inoffensive, target(2), 'corps', 4, 0, 1, undefined)).toBe(0);
  });

  it('branche STRUCTURE intacte (ADE II 8) : minWounds=0 déjà géré, PA=0 (aucune Localisation)', () => {
    const canon = mkWeapon({ label: 'Canon', type: 'distance', qualities: [{ id: 'siege' }] });
    const struct = structureCombatant(findStructureById('porte')!);
    expect(woundsFromHit(canon, struct, undefined, 10, 0, 1, undefined)).toBe(18); // BE 2 (E20) → 20 dégâts (×2 Siège) - 2 = 18
  });
});
