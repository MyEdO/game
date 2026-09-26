import { describe, it, expect } from 'vitest';
import { Characteristics, Combatant, ItemInstance } from './types';
import { encumbrancePenalties, effectiveMovement, agilityTestPenalty } from './encumbrance';

// F=30,E=30 → BF+BE = 3+3 = 6 → capacité d'Encombrement = 6 (LDB 61 l.5).
const chars = (F = 30, E = 30): Characteristics => ({
  'capacite-de-combat': 30, 'capacite-de-tir': 30, force: F, endurance: E, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
});

function combatant(opts: { force?: number; endurance?: number; movement?: number; enc?: number }): Combatant {
  const enc = opts.enc ?? 0;
  const items: ItemInstance[] = enc > 0 ? [{ uid: 'x', label: 'charge', kind: 'misc', qualities: [], enc, equipped: false }] : [];
  return {
    id: 'c', label: 'Test', kind: 'hero',
    characteristics: chars(opts.force, opts.endurance),
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items, skills: [], talents: [], movement: opts.movement ?? 4,
  };
}

describe('encumbrancePenalties — paliers du Livre de base (p.295)', () => {
  it('sous ou à la limite (capacité 6) : aucune pénalité', () => {
    for (const enc of [0, 3, 6]) {
      const p = encumbrancePenalties(combatant({ enc }));
      expect(p).toMatchObject({ tier: 0, movePenalty: 0, agilityPenalty: 0, travelFatigue: 0, immobile: false });
    }
  });

  it('au-delà de la limite jusqu’au double (7→12) : palier 1', () => {
    for (const enc of [7, 12]) {
      const p = encumbrancePenalties(combatant({ enc }));
      expect(p).toMatchObject({ tier: 1, movePenalty: 1, moveFloor: 3, agilityPenalty: -10, travelFatigue: 1, immobile: false });
    }
  });

  it('au-delà du double jusqu’au triple (13→18) : palier 2', () => {
    for (const enc of [13, 18]) {
      const p = encumbrancePenalties(combatant({ enc }));
      expect(p).toMatchObject({ tier: 2, movePenalty: 2, moveFloor: 2, agilityPenalty: -20, travelFatigue: 2, immobile: false });
    }
  });

  it('plus de trois fois la limite (≥19) : immobilisé', () => {
    const p = encumbrancePenalties(combatant({ enc: 19 }));
    expect(p).toMatchObject({ tier: 3, immobile: true });
  });

  it('la capacité dérive bien de BF + BE', () => {
    // F=40,E=20 → 4+2 = 6 ; enc 7 dépasse → palier 1
    expect(encumbrancePenalties(combatant({ force: 40, endurance: 20, enc: 7 })).tier).toBe(1);
    // F=50,E=50 → 5+5 = 10 ; enc 10 = limite → palier 0
    expect(encumbrancePenalties(combatant({ force: 50, endurance: 50, enc: 10 })).tier).toBe(0);
  });
});

describe('effectiveMovement', () => {
  it('non surchargé : Mouvement inchangé', () => {
    expect(effectiveMovement(combatant({ movement: 4, enc: 0 }))).toBe(4);
  });
  it('palier 1 : −1 avec plancher 3 (M4 → 3)', () => {
    expect(effectiveMovement(combatant({ movement: 4, enc: 8 }))).toBe(3);
  });
  it('palier 2 : −2 avec plancher 2 (M4 → 2)', () => {
    expect(effectiveMovement(combatant({ movement: 4, enc: 14 }))).toBe(2);
  });
  it('immobilisé : Mouvement 0', () => {
    expect(effectiveMovement(combatant({ movement: 4, enc: 20 }))).toBe(0);
  });
  it('garde-fou : un Mouvement déjà bas n’est jamais augmenté par le plancher', () => {
    expect(effectiveMovement(combatant({ movement: 2, enc: 8 }))).toBe(2); // min(2, max(1,3)) = 2
    expect(effectiveMovement(combatant({ movement: 3, enc: 14 }))).toBe(2); // min(3, max(1,2)) = 2
  });
  it('Sonné : déplacement réduit de moitié, arrondi à l’inférieur (LDB 16 l.125)', () => {
    const c = combatant({ movement: 4, enc: 0 });
    c.conditions.push({ id: 'sonne', value: 1 });
    expect(effectiveMovement(c)).toBe(2); // 4 → 2
    const odd = combatant({ movement: 3, enc: 0 });
    odd.conditions.push({ id: 'sonne', value: 1 });
    expect(effectiveMovement(odd)).toBe(1); // floor(3/2) = 1
  });
});

describe('agilityTestPenalty', () => {
  it('renvoie le modificateur signé selon le palier', () => {
    expect(agilityTestPenalty(combatant({ enc: 0 }))).toBe(0);
    expect(agilityTestPenalty(combatant({ enc: 8 }))).toBe(-10);
    expect(agilityTestPenalty(combatant({ enc: 14 }))).toBe(-20);
  });
});
