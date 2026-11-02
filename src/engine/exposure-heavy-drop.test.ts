import { describe, it, expect } from 'vitest';
import { heaviestPossession, dropHeaviestPossession } from './exposure';
import type { Combatant, ItemInstance } from './types';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

/**
 * « Vous débarrasser d'une Possession lourde annule 1 Test échoué » (LDB 18 l.332, Exposition
 * CHALEUR). Aucun seuil inventé : la Possession lourde = l'objet PORTÉ à l'Encombrement le plus
 * élevé (strictement positif).
 */
const dummy = (items: Partial<ItemInstance>[] = []): Combatant =>
  (blessuresSurLeProfil({
    id: 'x', name: 'Cobaye', kind: 'hero', movement: 4,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 25, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 45 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: items as ItemInstance[],
  }) as unknown as Combatant);

describe('heaviestPossession — Possession lourde (LDB 18 l.332)', () => {
  it('aucun objet → undefined', () => {
    expect(heaviestPossession(dummy())).toBeUndefined();
  });

  it('objets tous à Encombrement 0 → undefined (rien de « lourd » à jeter)', () => {
    const c = dummy([{ uid: 'a', label: 'Dague', kind: 'melee', qualities: [], equipped: true, enc: 0 }]);
    expect(heaviestPossession(c)).toBeUndefined();
  });

  it('renvoie l’objet le plus lourd (Encombrement max), pas le premier ni le dernier', () => {
    const c = dummy([
      { uid: 'a', label: 'Gourde', kind: 'misc', qualities: [], equipped: false, enc: 1 },
      { uid: 'b', label: 'Armure lourde', kind: 'armor', qualities: [], equipped: true, enc: 4 },
      { uid: 'c', label: 'Sac de couchage', kind: 'misc', qualities: [], equipped: false, enc: 1 },
    ]);
    expect(heaviestPossession(c)?.uid).toBe('b');
  });
});

describe('dropHeaviestPossession — se débarrasser (LDB 18 l.332)', () => {
  it('rien à jeter → undefined, inventaire inchangé', () => {
    const c = dummy();
    expect(dropHeaviestPossession(c)).toBeUndefined();
    expect(c.items).toHaveLength(0);
  });

  it('retire l’objet le plus lourd de l’inventaire et renvoie son nom', () => {
    const c = dummy([
      { uid: 'a', label: 'Gourde', kind: 'misc', qualities: [], equipped: false, enc: 1 },
      { uid: 'b', label: 'Armure lourde', kind: 'armor', qualities: [], equipped: true, enc: 4 },
    ]);
    const name = dropHeaviestPossession(c);
    expect(name).toBe('Armure lourde');
    expect(c.items?.map((it) => it.uid)).toEqual(['a']); // seule la légère reste
  });
});
