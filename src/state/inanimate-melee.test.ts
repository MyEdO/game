import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyAttackResult } from './combatFlow';
import { resolveMelee } from '../engine/combat';
import { vehicleCombatant } from '../engine/vehicle';
import { isInanimate } from '../engine/structures';
import { findVehicleById } from '../data';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import type { Weapon } from '../engine/types';

/**
 * GÉNÉRALISATION inerte (`isInanimate`) : un VÉHICULE-coque (MDG) attaqué en MÊLÉE est traité EXACTEMENT comme
 * une STRUCTURE de siège — il NE PARE PAS, n'a PAS de Localisation (aucun membre dans le journal) et n'ENGAGE
 * PAS l'attaquant. Payoff de la factorisation `isStructure` → `isInanimate` (qui couvre aussi les véhicules).
 */
const hache = (): Weapon => ({ label: 'Hache', type: 'melee', damage: { plusBF: false, flat: 6 }, qualities: [] });

/** Enrôle une diligence (coque à PV) comme ENNEMI dans la scène de fixture, puis démarre le combat. */
function startWithVehicle() {
  useGame.getState().seedRng(1);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero] });
  const scene = structuredClone(testScene);
  scene.entities.push({ id: 'veh', kind: 'personnage', ref: 'diligence', pos: { x: 7, y: 10 } } as never);
  (scene.encounters[0].members ??= []).push({ entityId: 'veh' } as never);
  useGame.getState().startScene(scene);
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  return { veh: b.combatants.find((c) => c.id === 'veh')!, H: b.combatants.find((c) => c.kind === 'hero')! };
}

describe('Véhicule-coque attaqué en mêlée — inerte comme une structure (isInanimate)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('resolveMelee vs un véhicule : aucun jet de défense, Localisation absente, journal sans membre', () => {
    const veh = vehicleCombatant(findVehicleById('diligence')!)!; // E45 / B50, bodyShape 'vehicule'
    expect(veh.bodyShape).toBe('vehicule');
    expect(isInanimate(veh)).toBe(true);
    const atk = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    atk.characteristics['capacite-de-combat'] = 90; // touche quasi-certaine → coup résolu
    const res = resolveMelee(atk, veh, hache(), makeRNG(2));
    expect(res.hit).toBe(true);
    expect(res.defenderDetail).toBeUndefined(); // coque inerte : ni Parade ni Esquive
    expect(res.location).toBeUndefined();        // pas de Tableau de Localisation
    expect(res.log).not.toMatch(/\)\s*:/);       // « A touche … : » SANS « (membre) »
  });

  it('applyAttackResult vs un véhicule enrôlé : l’attaquant N’EST PAS engagé (objet inerte)', () => {
    const { veh, H } = startWithVehicle();
    expect(isInanimate(veh)).toBe(true);
    H.pos = { x: 6, y: 10 }; veh.pos = { x: 7, y: 10 }; // au contact
    const w = hache();
    const res = resolveMelee(H, veh, w, makeRNG(2)); // l'Engagement se pose en mêlée, touche ou non
    applyAttackResult(useGame.getState, useGame.setState, H, veh, w, res);
    const after = useGame.getState().battle!;
    const h2 = after.combatants.find((c) => c.id === H.id)!;
    const v2 = after.combatants.find((c) => c.id === veh.id);
    expect(h2.engagedWith ?? []).not.toContain(veh.id); // pas d'Engagement avec un objet inerte
    expect(v2?.engagedWith ?? []).not.toContain(H.id);  // ni dans l'autre sens (symétrie)
  });
});
