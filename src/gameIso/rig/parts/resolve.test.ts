import { describe, it, expect } from 'vitest';
import { resolveParts } from './resolve';
import { tenueFor } from './career';
import { armourPart, equipDe, pieceDeDessin } from './equipment';
import { viewOrFront } from './types';
import type { EquipCtx } from './equipment';
import type { ItemInstance, Weapon } from '../../../engine/types';

const empty: EquipCtx = equipDe([], []);
const wep = (name: string, type: 'melee' | 'ranged'): Weapon => ({ label: name, type, damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon);
const plastron: ItemInstance = { uid: '1', label: 'Plastron', kind: 'armor', qualities: [], pa: 4, locs: ['corps'], enc: 1, equipped: true };

describe('resolveParts — priorité', () => {
  it('sans rien : torse = tenue de la carrière (par-carrière)', () => {
    const r = resolveParts('Humain', 'M', 'soldat', empty, {}, 1);
    expect(r.torse?.svg).toBe(viewOrFront(tenueFor('soldat').torse, 'front'));
  });

  it('armure équipée sur le corps PRIME sur la tenue de carrière', () => {
    const equip: EquipCtx = equipDe([], [plastron]);
    const r = resolveParts('Humain', 'M', 'soldat', equip, {}, 1);
    expect(r.torse?.svg).toBe(viewOrFront(armourPart(pieceDeDessin(plastron), 'torse'), 'front'));
    expect(r.torse?.svg).not.toBe(viewOrFront(tenueFor('soldat').torse, 'front'));
  });

  it('arme et bouclier suivent l’équipement', () => {
    const equip: EquipCtx = equipDe([wep('Hache', 'melee'), { ...wep('Bouclier', 'melee'), trappingId: 'bouclier-targe', qualities: [{ id: 'protectrice', value: 1 }] }], []);
    const r = resolveParts('Humain', 'M', 'soldat', equip, {}, 1);
    expect(r.arme?.svg).toContain('<');
    expect(r.bouclier?.svg).toContain('<');
  });

  it('override éditeur (parts) PRIME sur l’équipement', () => {
    const equip: EquipCtx = equipDe([], [plastron]);
    const r = resolveParts('Humain', 'M', 'soldat', equip, { torse: 0 }, 1);
    expect(r.torse?.svg).not.toBe(viewOrFront(armourPart(pieceDeDessin(plastron), 'torse'), 'front'));
  });

  it('visage et cheveux sont toujours présents', () => {
    const r = resolveParts('Humain', 'M', 'soldat', empty, {}, 1);
    expect(r.visage?.svg).toContain('<');
    expect(r.cheveux?.svg).toContain('<');
  });
});

describe('resolveParts — dual-wield (main secondaire dessinée)', () => {
  const wh = (name: string, hand: 'main' | 'off', q: { id: string; value?: number }[] = []): Weapon => ({ label: name, type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: q, hand } as Weapon);

  it('épée + dague (hand off) → la 2e arme est dessinée à la main secondaire (os bouclier)', () => {
    const r = resolveParts('Humain', 'M', 'soldat', equipDe([wh('Épée', 'main'), wh('Dague', 'off')], []), {}, 1);
    expect(r.arme?.svg).toContain('<');
    expect(r.bouclier?.svg).toContain('<'); // dague dessinée à la main secondaire
  });

  it('épée seule → main secondaire vide', () => {
    const r = resolveParts('Humain', 'M', 'soldat', equipDe([wh('Épée', 'main')], []), {}, 1);
    expect(r.bouclier?.svg ?? '').toBe('');
  });

  it('épée + bouclier → le bouclier prime sur une arme à la main secondaire', () => {
    const shield = { ...wh('Bouclier', 'off', [{ id: 'protectrice', value: 1 }]), trappingId: 'bouclier-targe' };
    const r = resolveParts('Humain', 'M', 'soldat', equipDe([wh('Épée', 'main'), shield], []), {}, 1);
    expect(r.bouclier?.svg).toContain('<');
  });
});
