/**
 * Constructeur d'arme UNIQUE (`engine/items.buildWeapon`) : stocke la `WeaponDamageSpec` STRUCTURÉE telle
 * quelle (jamais une chaîne re-parsée). Le token `BF` est désormais porté par le flag `plusBF` (lu par
 * `effectiveWeaponDamage` sans regex) ; le formateur `damageString` reste la source unique de l'écriture
 * canonique (« +BF+N »/« +N »/« +BF »/« -2 ») — vérifiée ici en round-trip.
 */
import { describe, it, expect } from 'vitest';
import { buildWeapon, armeInvoquee, damageString } from './items';

describe('buildWeapon — convention de Dégâts (le flag plusBF est porteur)', () => {
  it('SB-relatif → « +BF+N » (naturelles/invoquées/mains nues)', () => {
    expect(damageString(buildWeapon({ label: 'Griffe', damage: { plusBF: true, flat: 4 } }).damage)).toBe('+BF+4');
  });
  it('Indice de créature (SB déjà inclus) → « +N »', () => {
    expect(damageString(buildWeapon({ label: 'Morsure', damage: { plusBF: false, flat: 9 } }).damage)).toBe('+9');
  });
  it('« +BF » NU (Tentacule/Piétinement) ≠ « +BF+0 »', () => {
    expect(damageString(buildWeapon({ label: 'Tentacule', damage: { plusBF: true, flat: 0, bare: true } }).damage)).toBe('+BF');
    expect(damageString(buildWeapon({ label: 'X', damage: { plusBF: true, flat: 0 } }).damage)).toBe('+BF+0');
  });
  it('Indice négatif → « -2 » (pas « +-2 »)', () => {
    expect(damageString(buildWeapon({ label: 'Débile', damage: { plusBF: false, flat: -2 } }).damage)).toBe('-2');
  });
  it('literal → verbatim (catalogue)', () => {
    expect(damageString(buildWeapon({ label: 'Mains nues', damage: { literal: '+BF+0' } }).damage)).toBe('+BF+0');
  });
});

describe('buildWeapon — défauts, uid, copie', () => {
  it('défauts : mêlée, 1 main, qualities vide ; uid universel (« w-it-N ») ; pas de reach parasite', () => {
    const w = buildWeapon({ label: 'X', damage: { plusBF: true, flat: 0, bare: true } });
    expect(w).toMatchObject({ type: 'melee', hands: 1, qualities: [] });
    expect(w.uid).toMatch(/^w-it-\d+$/); // uid TOUJOURS défini (Pendings d'arme par uid)
    expect(w.reach).toBeUndefined();
  });
  it('uid : littéral conservé ; préfixe → « prefix-it-N » (UN seul newUid)', () => {
    expect(buildWeapon({ label: 'T', damage: { plusBF: true, flat: 0, bare: true }, uid: 'nat-tentacule' }).uid).toBe('nat-tentacule');
    expect(buildWeapon({ label: 'G', damage: { plusBF: true, flat: 3 }, uid: { prefix: 'nat-griffe' } }).uid).toMatch(/^nat-griffe-it-\d+$/);
  });
  it('qualities est COPIÉ (pas aliasé)', () => {
    const src = [{ id: 'magique' }];
    const w = buildWeapon({ label: 'X', damage: { plusBF: true, flat: 0, bare: true }, qualities: src });
    expect(w.qualities).toEqual(src);
    expect(w.qualities).not.toBe(src);
  });
});

describe('armeInvoquee — RÉUTILISE buildWeapon, bascule en ItemInstance désignée par sa source', () => {
  it('type→kind, ajoute enc/equipped/conjured/source, sans `label` ni `trappingId` ; partage la convention de Dégâts et l\'uid', () => {
    const source = { kind: 'spell', id: 'arme-aethyrique' } as const;
    const item = armeInvoquee({ damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'magique' }], uid: { prefix: 'conjure' }, source });
    expect(item).toMatchObject({ kind: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'magique' }], enc: 0, equipped: false, conjured: true, source });
    expect('label' in item || 'trappingId' in item).toBe(false);
    expect(item.uid).toMatch(/^conjure-it-\d+$/);
    expect((item as { type?: unknown }).type).toBeUndefined(); // pas de fuite du champ Weapon.type
  });
});
