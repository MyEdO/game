import { describe, it, expect } from 'vitest';
import { fireConditionEffects } from '../noyau/triggeredEffects';
import { addCondition, stacks } from '../engine/conditions';
import { vehicleCombatant } from '../engine/vehicle';
import { findVehicleById } from '../data';
import { makeRNG } from '../engine/dice';

// Stub `get` (hors combat) comme outOfCombatUpkeep — les États navals tickent par le MÊME pipeline
// data-driven (`fireConditionEffects` → onRoundEnd) que Empoisonné / En flammes / Hémorragique.
const GET = (() => ({ battle: undefined })) as never;
const tick = (c: any) => fireConditionEffects(GET, c, 'onRoundEnd', { rng: makeRNG(1) });
/** Coque de Diligence (E45 / B50) — un Combattant comme un autre (le navire suivra le même patron). */
const ship = () => vehicleCombatant(findVehicleById('diligence')!)!;

describe('États navals — data-driven, tickés par fireConditionEffects (MDG 13)', () => {
  it('En flammes (navire) : 1 Blessure par Round et par pion, à plat', () => {
    const c = ship(); // 50 PB, BE 4
    addCondition(c, 'en-flammes-navire', 3);
    tick(c);
    expect(c.wounds.current).toBe(47); // −3 (ignore le Bonus d'Endurance, ≠ 1d10+ humain)
  });

  it("Voie d'eau : chaque Round, l'Indice grossit le cumul d'Inondation", () => {
    const c = ship();
    addCondition(c, 'voie-d-eau', 4);
    tick(c);
    expect(stacks(c, 'inondation')).toBe(4);
    tick(c);
    expect(stacks(c, 'inondation')).toBe(8); // +4 chaque Round
  });

  it("Inondation ≥ moitié de l'Endurance → Alourdi (seuil relatif à une Caractéristique)", () => {
    const c = ship(); // E 45 → moitié 22,5
    addCondition(c, 'inondation', 23);
    tick(c);
    expect(stacks(c, 'alourdi')).toBe(1);
    expect(stacks(c, 'naufrage')).toBe(0); // 23 < 45
    tick(c);
    expect(stacks(c, 'alourdi')).toBe(1); // idempotent (garde « alourdi == 0 »)
  });

  it("Inondation ≥ Endurance → le navire COULE (Naufrage)", () => {
    const c = ship();
    addCondition(c, 'inondation', 45); // = Endurance
    tick(c);
    expect(stacks(c, 'naufrage')).toBe(1);
    expect(stacks(c, 'alourdi')).toBe(1);
  });
});
