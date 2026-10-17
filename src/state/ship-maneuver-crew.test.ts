import { describe, it, expect } from 'vitest';
import { maneuverCrewTotal, deriveManeuverFromCrew } from './shipManeuver';
import { moraleBand } from '../engine/crewMorale';
import type { Combatant } from '../engine/types';

const mkShip = (): Combatant =>
  ({ id: 'ship', name: 'Navire', creatureId: 'bateau-de-patrouille', conditions: [], wounds: { current: 50, max: 50, base: 50 } }) as unknown as Combatant;

describe('Manœuvre = Test d’équipage (MDG 14)', () => {
  const parts = [
    { roleId: 'timonier', result: { roll: 30, target: 50, sl: 2 } },
    { roleId: 'mousse', result: { roll: 40, target: 50, sl: 1 } },
  ];

  it('maneuverCrewTotal : Σ des DR, rôle ESSENTIEL ×2, + bande de Moral', () => {
    const m = moraleBand(75).crewTestDR;
    expect(maneuverCrewTotal(parts, 'timonier', 75)).toBe(2 * 2 + 1 + m); // Timonier essentiel → 4 + 1
    expect(maneuverCrewTotal(parts, 'mousse', 75)).toBe(2 + 1 * 2 + m);   // Mousse essentiel → 2 + 2
  });

  it('un contributeur NON lancé (témoin pas résolu) est ignoré', () => {
    const m = moraleBand(75).crewTestDR;
    expect(maneuverCrewTotal([parts[0], { roleId: 'mousse', result: null }], 'timonier', 75)).toBe(4 + m);
  });

  it('deriveManeuverFromCrew : navDR = total équipage ; virage réussit si DR final ≥ 1 (ch.14)', () => {
    const ship = mkShip();
    expect(deriveManeuverFromCrew(ship, 5, 'maritime').navDR).toBe(5);
    expect(deriveManeuverFromCrew(ship, 20, 'maritime').success).toBe(true);  // large total → succès
    expect(deriveManeuverFromCrew(ship, -20, 'maritime').success).toBe(false); // très négatif → le cap tient
  });
});
