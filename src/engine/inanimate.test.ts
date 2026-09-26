import { describe, it, expect } from 'vitest';
import { inanimateCombatant } from './inanimate';
import { structureCombatant } from './structures';
import { vehicleCombatant } from './vehicle';
import { woundsFromHit } from './woundsCalc';
import { findStructureById, findVehicleById } from '../data';
import type { Weapon } from './types';

/**
 * Builder UNIQUE des OBJETS INANIMÉS (`inanimateCombatant`) et ses trois saveurs :
 *  - STRUCTURE de siège (ADE II 8) — DESTRUCTIBLE, profil {E,B} ;
 *  - VÉHICULE-coque (MDG 12-13) — DESTRUCTIBLE, profil {E,B} (+ empreinte de navire) ;
 *  - ENGIN de siège INERTE (AA 10 l.136-195) — NON-DESTRUCTIBLE : 0 Blessure, immune via `woundsFromHit`.
 */

const mkWeapon = (over: Partial<Weapon> = {}): Weapon => ({
  label: 'arme',
  type: 'melee',
  damage: { plusBF: false, flat: 0 },
  qualities: [],
  ...over,
});

describe('structureCombatant (adaptateur destructible — ADE II 8)', () => {
  it('Porte : BE 2 → E 20, Blessures 8, Atout Résistant, forme structure', () => {
    const c = structureCombatant(findStructureById('porte')!);
    expect(c.bodyShape).toBe('structure');
    expect(c.characteristics.endurance).toBe(20); // BE 2 × 10
    expect(c.wounds.max).toBe(8);
    expect(c.traits?.some((t) => t.id === 'resistant')).toBe(true);
  });
});

describe('vehicleCombatant (adaptateur destructible — MDG 12-13)', () => {
  it('Barge : coque {E,B} + empreinte de navire reportée', () => {
    const v = findVehicleById('barge')!;
    const c = vehicleCombatant(v)!;
    expect(c.bodyShape).toBe('vehicule');
    expect(c.characteristics.endurance).toBe(v.hull!.char.endurance); // 45
    expect(c.wounds.max).toBe(v.hull!.char.B);        // 60
    expect(c.footprint).toBe(v.ship!.footprint);       // empreinte de grille (2)
  });
});

describe('inanimateCombatant — engin de siège INERTE (AA 10 l.136-195)', () => {
  it('aucun profil à PV : Blessures 0, E 0, immune à la Psychologie, immobile', () => {
    const c = inanimateCombatant({ id: 'e', label: 'Baliste', refId: 'baliste', bodyShape: 'engin', inert: true });
    expect(c.inert).toBe(true);
    expect(c.wounds.max).toBe(0);
    expect(c.characteristics.endurance).toBe(0);
    expect(c.bodyShape).toBe('engin');
    expect(c.psychImmune).toBe(true);
    expect(c.movement).toBe(0);
  });

  it('NON-DESTRUCTIBLE : `woundsFromHit` retourne 0 même pour un coup énorme (immune via `target.inert`)', () => {
    const c = inanimateCombatant({ id: 'e', label: 'Baliste', refId: 'baliste', bodyShape: 'engin', inert: true });
    const canon = mkWeapon({ label: 'Canon', type: 'ranged', qualities: [{ id: 'siege' }] });
    expect(woundsFromHit(canon, c, 'corps', 999, 0, 1, undefined)).toBe(0);
  });
});
