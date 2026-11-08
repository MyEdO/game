/**
 * Constructeur d'arme UNIQUE (`engine/items.buildWeapon`) : stocke la `WeaponDamageSpec` STRUCTURÉE telle
 * quelle (jamais une chaîne re-parsée). Le token `BF` est désormais porté par le flag `plusBF` (lu par
 * `effectiveWeaponDamage` sans regex) ; le formateur `damageString` reste la source unique de l'écriture
 * canonique (« +BF+N »/« +N »/« +BF »/« -2 ») — vérifiée ici en round-trip.
 */
import { describe, it, expect } from 'vitest';
import { buildWeapon, weaponItem, damageString } from './items';

describe('buildWeapon — convention de Dégâts (le flag plusBF est porteur)', () => {
  it('SB-relatif → « +BF+N » (naturelles/invoquées/mains nues)', () => {
    expect(damageString(buildWeapon({ label: 'Griffe', damage: { plusBF: true, flat: 4 }, uid: 'x' }).damage)).toBe('+BF+4');
  });
  it('Indice de créature (SB déjà inclus) → « +N »', () => {
    expect(damageString(buildWeapon({ label: 'Morsure', damage: { plusBF: false, flat: 9 }, uid: 'x' }).damage)).toBe('+9');
  });
  it('« +BF » NU (Tentacule/Piétinement) ≠ « +BF+0 »', () => {
    expect(damageString(buildWeapon({ label: 'Tentacule', damage: { plusBF: true, flat: 0, bare: true }, uid: 'x' }).damage)).toBe('+BF');
    expect(damageString(buildWeapon({ label: 'X', damage: { plusBF: true, flat: 0 }, uid: 'x' }).damage)).toBe('+BF+0');
  });
  it('Indice négatif → « -2 » (pas « +-2 »)', () => {
    expect(damageString(buildWeapon({ label: 'Débile', damage: { plusBF: false, flat: -2 }, uid: 'x' }).damage)).toBe('-2');
  });
  it('literal → verbatim (catalogue)', () => {
    expect(damageString(buildWeapon({ label: 'Mains nues', damage: { literal: '+BF+0' }, uid: 'x' }).damage)).toBe('+BF+0');
  });
});

describe('buildWeapon — défauts, uid, copie', () => {
  it('défauts : mêlée, 1 main, qualities vide ; pas de reach parasite', () => {
    const w = buildWeapon({ label: 'X', damage: { plusBF: true, flat: 0, bare: true }, uid: 'x' });
    expect(w).toMatchObject({ type: 'melee', hands: 1, qualities: [] });
    expect(w.reach).toBeUndefined();
  });
  it('uid : celui de la spec, tel quel, d’un appel à l’autre (#2907)', () => {
    const spec = { label: 'T', damage: { plusBF: true, flat: 0, bare: true }, uid: 'nat-tentacule' } as const;
    expect(buildWeapon(spec).uid).toBe('nat-tentacule');
    expect(buildWeapon(spec).uid).toBe('nat-tentacule');
  });
  it('qualities est COPIÉ (pas aliasé)', () => {
    const src = [{ id: 'magique' }];
    const w = buildWeapon({ label: 'X', damage: { plusBF: true, flat: 0, bare: true }, qualities: src, uid: 'x' });
    expect(w.qualities).toEqual(src);
    expect(w.qualities).not.toBe(src);
  });
});

describe('weaponItem — RÉUTILISE buildWeapon, bascule en ItemInstance', () => {
  it('type→kind, ajoute enc/equipped/conjured ; partage la convention de Dégâts et l\'uid', () => {
    const item = weaponItem({ label: 'Arme aethyrique', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'magique' }], uid: 'conjure-1', conjured: true });
    expect(item).toMatchObject({ kind: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'magique' }], enc: 0, equipped: false, conjured: true });
    expect(item.uid).toBe('conjure-1');
    expect((item as { type?: unknown }).type).toBeUndefined(); // pas de fuite du champ Weapon.type
  });
});
