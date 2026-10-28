import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Combatant } from '../engine/types';
import { customTrapping } from '../engine/items';
import { armeDeTest, objetDeTest } from '../engine/objetsDeTest.testkit';
import type { PendingAttack } from '../noyau/pendings';
import { firedWeapon, weaponContextOf } from '../noyau/combatFlow';
import * as capabilities from '../engine/capabilities';

// ADE II 02 l.677 ; #476
afterEach(() => vi.restoreAllMocks());

const CHARS = { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const mk = (p: Partial<Combatant>): Combatant => ({
  id: 'a', name: 'X', kind: 'hero', characteristics: CHARS,
  wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
  engagedWith: [], pos: { x: 0, y: 0 }, size: 'moyenne', weapons: [], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  ...p,
} as unknown as Combatant);

const target = mk({ id: 't', kind: 'enemy', pos: { x: 1, y: 0 } });

const harpoon = armeDeTest('lance-harpon', { uid: 'hp' });
const harpoonItem = objetDeTest('lance-harpon', { uid: 'hp', equipped: true });

describe('Mode de tir « corde séparée » (Lance-harpon, ADE II 02 l.677, #476)', () => {
  it('toggle posé + arme éligible (ropeMode) → arme résolue au tir Portée 60, Immobilisante perdue', () => {
    vi.spyOn(capabilities, 'itemCapability').mockReturnValue(true);
    const atk = mk({ weapons: [harpoon], items: [harpoonItem] });
    const w = firedWeapon(atk, target, 'hp', undefined, true);
    expect(w.range).toBe(60);
    expect(w.qualities.some((q) => q.id === 'immobilisante')).toBe(false);
    expect(w.qualities.some((q) => q.id === 'recharge')).toBe(true); // ADE II 02 l.677
  });

  it('toggle NON posé (même arme éligible) → profil de base inchangé (Portée 20, Immobilisante conservée)', () => {
    vi.spyOn(capabilities, 'itemCapability').mockReturnValue(true);
    const atk = mk({ weapons: [harpoon], items: [harpoonItem] });
    const w = firedWeapon(atk, target, 'hp', undefined, false);
    expect(w.range).toBe(20);
    expect(w.qualities.some((q) => q.id === 'immobilisante')).toBe(true);
  });

  it('arme RÉELLE du catalogue (lance-harpon, capacité ropeMode posée) → le toggle est éligible', () => {
    const atk = mk({ weapons: [harpoon], items: [harpoonItem] });
    const ctx = weaponContextOf(atk, harpoon, target, { harpoonRopeCut: true });
    expect(ctx.harpoonRopeCut).toBe(true);
  });

  it('objet custom SANS capacité ropeMode → le toggle est ignoré même posé', () => {
    const otherItem = { ...customTrapping('Autre'), uid: 'hp', equipped: true };
    const atk = mk({ weapons: [harpoon], items: [otherItem] });
    const ctx = weaponContextOf(atk, harpoon, target, { harpoonRopeCut: true });
    expect(ctx.harpoonRopeCut).toBe(false);
  });

  it('relance (Chance/Résilience) : le profil sans-corde choisi AVANT le jet survit à firedWeapon(p.harpoonRopeCut)', () => {
    const atk = mk({ weapons: [harpoon], items: [harpoonItem] });
    const p = { weaponUid: 'hp', harpoonRopeCut: true } as PendingAttack;
    const w = firedWeapon(atk, target, p.weaponUid, undefined, p.harpoonRopeCut);
    expect(w.range).toBe(60);
    expect(w.qualities.some((q) => q.id === 'immobilisante')).toBe(false);
  });
});
