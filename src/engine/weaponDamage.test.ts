import { describe, it, expect } from 'vitest';
import { effectiveWeaponDamage, effectiveRange, applyAmmoMod, effectiveWeaponRange, isImprovised, damageWeapon, effectiveWeapon, improvisedProfile, solideSaveThreshold } from './weaponDamage';
import { recomputeLoadout, damageString } from './items';
import type { Weapon, Combatant } from './types';

const sword = (over: Partial<Weapon> = {}): Weapon => ({ label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [], ...over });
const bow = (over: Partial<Weapon> = {}): Weapon => ({ label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 9 }, qualities: [], range: 30, ...over });

describe('effectiveWeaponDamage (LDB 62 l.135)', () => {
  it('réduit les Dégâts de damageTaken', () => {
    expect(effectiveWeaponDamage(sword({ damageTaken: 2 }), 3)).toBe(5); // BF3 + (4-2)
    expect(effectiveWeaponDamage(bow({ damageTaken: 3 }), 3)).toBe(6);   // 9-3, pas de BF
  });
  it('plancher +0 (BF+0) → improvisée, ne descend pas sous BF', () => {
    expect(effectiveWeaponDamage(sword({ damageTaken: 9 }), 3)).toBe(3); // BF+0
    expect(isImprovised(sword({ damageTaken: 4 }))).toBe(true);
    expect(isImprovised(sword({ damageTaken: 3 }))).toBe(false);
    expect(isImprovised(bow({ damageTaken: 9 }))).toBe(true);
  });
  it("préserve une arme non endommagée (dégâts inchangés)", () => {
    const hache: Weapon = { label: 'Hache', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
    expect(effectiveWeaponDamage(hache, 3)).toBe(7); // BF3 + 4, arme intacte
  });
});

describe('effectiveRange (LDB 62) — résolution de la Portée à l’usage (miroir effectiveWeaponDamage)', () => {
  it('mètres fixes (number) → inchangés ; {bf} → BF×N ; null/undefined → null', () => {
    expect(effectiveRange(50, 4)).toBe(50); // arc : 50 m quel que soit le BF
    expect(effectiveRange({ bf: 3 }, 4)).toBe(12); // javelot : BF4 × 3
    expect(effectiveRange({ bf: 1 }, 5)).toBe(5);  // bombe : BF×1
    expect(effectiveRange(null, 4)).toBeNull();
    expect(effectiveRange(undefined, 4)).toBeNull();
  });
  it('DYNAMIQUE : un BF plus haut allonge la Portée de jet (≠ mètres fixes)', () => {
    expect(effectiveRange({ bf: 3 }, 2)).toBe(6);
    expect(effectiveRange({ bf: 3 }, 5)).toBe(15);
    expect(effectiveRange(30, 2)).toBe(30); // fixe : insensible au BF
  });
});

describe('applyAmmoMod + effectiveWeaponRange (LDB 62) — la munition modifie la Portée de l’arme', () => {
  it('applyAmmoMod : {mult} arrondi, {add} ± mètres (plancher 0), null/sans-Portée inchangé', () => {
    expect(applyAmmoMod(50, { mult: 0.5 })).toBe(25);
    expect(applyAmmoMod(50, { mult: 0.25 })).toBe(13); // round(12.5)
    expect(applyAmmoMod(50, { add: 50 })).toBe(100);
    expect(applyAmmoMod(50, { add: -10 })).toBe(40);
    expect(applyAmmoMod(5, { add: -10 })).toBe(0); // plancher 0
    expect(applyAmmoMod(50, null)).toBe(50);
    expect(applyAmmoMod(null, { mult: 0.5 })).toBeNull();
  });
  it('effectiveWeaponRange : arc 50 m + {mult:0.5} → 25 ; + {add:50} → 100 ; sans mod → 50', () => {
    expect(effectiveWeaponRange({ range: 50 }, { mult: 0.5 }, 3)).toBe(25);
    expect(effectiveWeaponRange({ range: 50 }, { add: 50 }, 3)).toBe(100);
    expect(effectiveWeaponRange({ range: 50 }, null, 3)).toBe(50);
    // arme de JET {bf} : BF×N résolu D'ABORD, puis modificateur de munition.
    expect(effectiveWeaponRange({ range: { bf: 3 } }, { mult: 0.5 }, 4)).toBe(6); // (4×3=12) → ½ = 6
  });
});

describe('recomputeLoadout — Portée = SPEC COPIÉE (résolue à l’usage, pas au loadout)', () => {
  it('une arme de jet conserve sa spec {bf} sur le Weapon actif (non pré-résolue)', () => {
    const c = hero([{ uid: 'jav', label: 'Javelot', kind: 'ranged', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], enc: 1, equipped: true, range: { bf: 3 } }]);
    recomputeLoadout(c);
    const jav = c.weapons.find((w) => w.label === 'Javelot');
    expect(jav?.range).toEqual({ bf: 3 }); // copiée telle quelle ; effectiveRange la résout au tir/affichage
  });
});

describe('effectiveWeapon — bascule Arme improvisée à +0 (LDB 62 l.135)', () => {
  it('arme usée à +0 → +BF+1, Inoffensive, sans Atout (Empaleuse/Perforante perdus)', () => {
    const w = effectiveWeapon(sword({ damageTaken: 4, qualities: [{ id: 'empaleuse' }, { id: 'perforante' }] }));
    expect(damageString(w.damage)).toBe('+BF+1');
    expect(w.qualities).toEqual([{ id: 'inoffensive' }]);
    expect(effectiveWeaponDamage(w, 3)).toBe(4); // BF3 + 1
  });
  it('arme non usée renvoyée telle quelle (même référence)', () => {
    const w = sword({ damageTaken: 2, qualities: [{ id: 'empaleuse' }] });
    expect(effectiveWeapon(w)).toBe(w);
  });
});

describe('Solide (Indice) — absorption des Dégâts d’arme + sauvegarde (LDB 60 l.30-32)', () => {
  it('Solide(N) absorbe les N premiers points de damageTaken (pas de pénalité)', () => {
    expect(effectiveWeaponDamage(sword({ damageTaken: 3, qualities: [{ id: 'solide', value: 3 }] }), 3)).toBe(7); // BF3+4 (3 absorbés)
    expect(effectiveWeaponDamage(sword({ damageTaken: 4, qualities: [{ id: 'solide', value: 3 }] }), 3)).toBe(6); // BF3 + (4 - max(0,4-3))
    expect(isImprovised(sword({ damageTaken: 4, qualities: [{ id: 'solide', value: 3 }] }))).toBe(false);
    expect(isImprovised(sword({ damageTaken: 7, qualities: [{ id: 'solide', value: 3 }] }))).toBe(true);
  });
  it('seuil de sauvegarde : 9+ (Solide 1), 8+ (Solide 2), null sans Solide', () => {
    expect(solideSaveThreshold(sword({ qualities: [{ id: 'solide', value: 1 }] }))).toBe(9);
    expect(solideSaveThreshold(sword({ qualities: [{ id: 'solide', value: 2 }] }))).toBe(8);
    expect(solideSaveThreshold(sword({ qualities: [{ id: 'solide', value: 4 }] }))).toBe(6);
    expect(solideSaveThreshold(sword())).toBeNull();
  });
});

describe('damageWeapon', () => {
  it('incrémente damageTaken', () => { const w = sword(); damageWeapon(w); expect(w.damageTaken).toBe(1); });
  it('Incassable exempte des dégâts', () => {
    const w = sword({ qualities: [{ id: 'incassable' }] });
    damageWeapon(w); expect(w.damageTaken ?? 0).toBe(0);
  });
});

function hero(items: Combatant['items']): Combatant {
  return {
    id: 'h', label: 'T', kind: 'hero',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, items,
  } as Combatant;
}

describe("recomputeLoadout — propagation des Dégâts d'arme", () => {
  it("propage damageTaken de l'ItemInstance vers le Weapon actif", () => {
    const c = hero([{ uid: 'w1', label: 'Épée', kind: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [], enc: 1, equipped: true, damageTaken: 2 }]);
    recomputeLoadout(c);
    const s = c.weapons.find((w) => w.label === 'Épée');
    expect(s?.damageTaken).toBe(2);
  });
  it("une arme détruite n'est pas équipée (repli mains nues)", () => {
    const c = hero([{ uid: 'w1', label: 'Épée', kind: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [], enc: 1, equipped: true, destroyed: true }]);
    recomputeLoadout(c);
    expect(c.weapons.some((w) => w.label === 'Épée')).toBe(false);
    expect(c.weapons.some((w) => w.label === 'Mains nues')).toBe(true);
  });
});

describe('effectiveWeapon — Lance-harpon, corde séparée (ADE II 02 l.677, mode de tir choisi #476)', () => {
  const harpoon = (): Weapon => ({
    label: 'Lance-harpon', type: 'ranged', damage: { plusBF: false, flat: 10 }, range: 20,
    qualities: [{ id: 'immobilisante' }, { id: 'recharge', value: 2 }],
  });
  it('sans ctx.harpoonRopeCut : profil de base inchangé (Portée 20, Immobilisante conservée)', () => {
    const w = harpoon();
    const eff = effectiveWeapon(w);
    expect(eff.range).toBe(20);
    expect(eff.qualities).toEqual([{ id: 'immobilisante' }, { id: 'recharge', value: 2 }]);
  });
  it('ctx.harpoonRopeCut : Portée → 60, Immobilisante perdue, Recharge(2) conservée', () => {
    const eff = effectiveWeapon(harpoon(), { harpoonRopeCut: true });
    expect(eff.range).toBe(60);
    expect(eff.qualities).toEqual([{ id: 'recharge', value: 2 }]);
  });
});

/**
 * Test de CÂBLAGE — le profil d'Arme improvisée est LU dans l'entrée `arme-improvisee` de
 * `trappings.json` (LDB 62 l.31), pas recopié en dur. La preuve n'est pas l'égalité des valeurs (elle
 * passerait aussi avec des littéraux) : c'est qu'un RÉSOLVEUR injecté portant d'AUTRES valeurs déplace
 * le profil rendu. Débrancher la lecture fait échouer ce test.
 */
describe('improvisedProfile — profil LU dans la donnée (`arme-improvisee`)', () => {
  const fakeTrapping = (over: Record<string, unknown>) =>
    ({ id: 'arme-improvisee', label: 'Arme improvisée', type: 'melee', qualities: [], ...over }) as never;

  it('suit la donnée : dégâts, Atouts et Allonge viennent de l’entrée résolue', () => {
    const resolver = () => fakeTrapping({
      damage: { plusBF: true, flat: 7 }, qualities: [{ id: 'assommante' }], reach: 'Longue',
    });
    const eff = improvisedProfile(sword(), resolver);
    expect(eff.damage).toEqual({ plusBF: true, flat: 7 });
    expect(eff.qualities).toEqual([{ id: 'assommante' }]);
    expect(eff.reach).toBe('Longue');
  });

  it('donnée réelle (LDB 62 l.31) : +BF+1, Inoffensive, Allonge Variable', () => {
    const eff = improvisedProfile(sword());
    expect(eff.damage).toEqual({ plusBF: true, flat: 1 });
    expect(eff.qualities).toEqual([{ id: 'inoffensive' }]);
    expect(eff.reach).toBe('Variable');
  });

  it('mécaniques de dérivation conservées : `subType` intact, usure remise à 0, familles bloquées', () => {
    const eff = improvisedProfile(sword({ subType: 'escrime', damageTaken: 5 }));
    expect(eff.subType).toBe('escrime'); // la Spé de Groupe survit à l'improvisation
    expect(eff.damageTaken).toBe(0);
    expect(eff.noFamilyQualities).toBe(true);
  });

  it('entrée absente = donnée cassée, BRUYANTE — jamais un profil deviné', () => {
    expect(() => improvisedProfile(sword(), () => undefined)).toThrow(/arme-improvisee/);
  });

  it('les 4 branches improvisées d’`effectiveWeapon` rendent TOUTES ce même profil de donnée', () => {
    const ref = improvisedProfile(sword());
    const usure = effectiveWeapon(sword({ damageTaken: 9 }));                                   // l.178
    const lance = effectiveWeapon(sword({ label: 'Lance de cavalerie', subType: 'cavalerie' }), { charged: false }); // l.59
    const contact = effectiveWeapon(sword({ reach: 'Longue' }), { auContact: true });            // l.176
    const funnel = effectiveWeapon(sword(), { improvised: true });                               // ADE II 8 l.249
    for (const eff of [usure, lance, contact, funnel]) {
      expect({ damage: eff.damage, qualities: eff.qualities, reach: eff.reach, noFamilyQualities: eff.noFamilyQualities })
        .toEqual({ damage: ref.damage, qualities: ref.qualities, reach: ref.reach, noFamilyQualities: true });
    }
  });
});
