/**
 * Constructeur d'arme UNIQUE (`engine/items.buildWeapon`) : stocke la `WeaponDamageSpec` STRUCTURÉE telle
 * quelle (jamais une chaîne re-parsée). Le token `BF` est désormais porté par le flag `plusBF` (lu par
 * `effectiveWeaponDamage` sans regex) ; le formateur `damageString` reste la source unique de l'écriture
 * canonique (« +BF+N »/« +N »/« +BF »/« -2 ») — vérifiée ici en round-trip.
 */
import { describe, it, expect } from 'vitest';
import { buildWeapon, weaponItem, damageString, avecUidDArme, recomputeLoadout, unarmedWeapon, mainsNuesSiDesarme } from './items';
import type { Combatant, Weapon } from './types';
import type { Mutation } from './corruption';

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
  it('défauts : mêlée, 1 main, qualities vide ; aucun uid fabriqué ; pas de reach parasite', () => {
    const w = buildWeapon({ label: 'X', damage: { plusBF: true, flat: 0, bare: true } });
    expect(w).toMatchObject({ type: 'melee', hands: 1, qualities: [] });
    expect(w.uid, 'l’uid d’une arme sans objet est posé par l’assembleur de sa liste').toBeUndefined();
    expect(w.reach).toBeUndefined();
  });
  it('uid reçu conservé tel quel', () => {
    expect(buildWeapon({ label: 'T', damage: { plusBF: true, flat: 0, bare: true }, uid: 'nat-tentacule' }).uid).toBe('nat-tentacule');
  });
  it('qualities est COPIÉ (pas aliasé)', () => {
    const src = [{ id: 'magique' }];
    const w = buildWeapon({ label: 'X', damage: { plusBF: true, flat: 0, bare: true }, qualities: src });
    expect(w.qualities).toEqual(src);
    expect(w.qualities).not.toBe(src);
  });
});

describe('weaponItem — RÉUTILISE buildWeapon, bascule en ItemInstance', () => {
  it('type→kind, ajoute enc/equipped/conjured ; partage la convention de Dégâts et l\'uid', () => {
    const item = weaponItem({ label: 'Arme aethyrique', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'magique' }], uid: 'conjure-a', conjured: true });
    expect(item).toMatchObject({ kind: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'magique' }], enc: 0, equipped: false, conjured: true });
    expect(item.uid).toBe('conjure-a');
    expect((item as { type?: unknown }).type).toBeUndefined(); // pas de fuite du champ Weapon.type
  });
});

describe('uid d’une arme sans objet — posé par l’assembleur de la liste d’armes', () => {
  const arme = (label: string, uid?: string): Weapon => ({ ...buildWeapon({ label, damage: { plusBF: true, flat: 0 } }), ...(uid ? { uid } : {}) });

  it('la clé de l’entité source quand elle est libre, départagée par `nextEntityId` sinon ; un uid porté sert de clé', () => {
    const liste: Weapon[] = [];
    for (const [w, cle] of [[arme('A'), 'morsure'], [arme('B'), 'morsure'], [arme('C', 'nat-tentacule'), 'tentacules'], [arme('D'), 'morsure']] as const)
      liste.push(avecUidDArme(w, cle, liste));
    expect(liste.map((w) => w.uid)).toEqual(['morsure', 'morsure-0', 'nat-tentacule', 'morsure-1']);
  });

  it('recomputeLoadout : chaque arme de la liste a un uid unique, le même d’un assemblage à l’autre, jamais tiré d’un libellé', () => {
    const naturelle = (id: string, label: string): Mutation => ({
      id, label, desc: '', kind: 'physique', roll: 0,
      passive: [{ op: 'grantNaturalWeapon', label, damage: 2 }],
    } as Mutation);
    const c = {
      id: 'h', label: 'H', kind: 'hero', characteristics: {}, wounds: { current: 10, max: 10 }, advantage: 0, conditions: [],
      weapons: [], armour: {}, items: [],
      mutations: [naturelle('griffes-acerees', 'Griffes'), naturelle('griffes-acerees', 'Griffes'), naturelle('dents-de-fer', 'Morsure')],
    } as unknown as Combatant;
    recomputeLoadout(c);
    const premier = c.weapons.map((w) => w.uid);
    expect(premier).toEqual(['griffes-acerees', 'griffes-acerees-0', 'dents-de-fer', 'mains-nues']);
    recomputeLoadout(c);
    expect(c.weapons.map((w) => w.uid)).toEqual(premier);
  });

  it('mains nues : aucun uid avant la liste, `mains-nues` dans la liste du désarmé', () => {
    expect(unarmedWeapon().uid).toBeUndefined();
    const armes: Weapon[] = [];
    mainsNuesSiDesarme(armes);
    expect(armes.map((w) => w.uid)).toEqual(['mains-nues']);
  });
});
