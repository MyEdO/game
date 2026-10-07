import { describe, it, expect } from 'vitest';
import { applyOps } from './ops';
import { endOfRound } from './conditions';
import { effectiveWeaponDamage } from './weaponDamage';
import { damageString, isImprovisedTrapping, isShieldTrapping, isUnarmedTrapping } from './items';
import { trappings } from '../data';
import { conjureFormOptions } from './conjuredWeapons';
import { runPureFlowLines } from '../state/combatEffects';
import { bonus } from './characteristics';
import type { Combatant } from './types';
import type { TriggeredEffect } from './flowCore';

/** `TriggeredEffect` onHit→victim portant `ops` (forme unifiée des onHit d'arme invoquée/enchantée). */
const onHitFlow = (ops: unknown[]): TriggeredEffect =>
  ({ trigger: 'onHit', on: 'victim', flow: { kind: 'do', effect: { type: 'ops', on: 'victim', ops } as never } });

/**
 * Armes INVOQUÉES temporaires (op `grantWeapon`, LDB 47/48) : un OBJET ordinaire `conjured` posé en
 * inventaire, tenu d'office (recomputeLoadout) puis retiré à l'expiration. Réutilise la base d'armes
 * (itemFromTrapping) et le loadout — seuls Dégâts (= BFM…) et l'Atout Magique sont surchargés.
 */
const mage = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'mage', label: 'Magister', kind: 'hero',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 35, agilite: 40, dexterite: 45, intelligence: 40, 'force-mentale': 45, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], items: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

describe('grantWeapon — objet temporaire (Arme aethyrique, Dégâts = BFM)', () => {
  it('crée un OBJET `conjured` en inventaire, tenu en tête de c.weapons, Dégâts FIXES = BFM', () => {
    const c = mage(); // FM 45 → BFM 4
    applyOps(c, [{ op: 'grantWeapon', label: 'Arme aethyrique', damage: { bonusOf: 'force-mentale' }, qualities: ['magique'] }],
      { label: 'Arme aethyrique', defaultDurationRounds: 4 });
    expect(c.items?.some((it) => it.conjured && it.label === 'Arme aethyrique')).toBe(true); // objet réel
    expect(c.weapons[0].label).toBe('Arme aethyrique'); // arme directrice
    expect(c.weapons[0].qualities.some((q) => q.id === 'magique')).toBe(true);
    expect(damageString(c.weapons[0].damage)).toBe('+4'); // BFM, pas de +BF
    expect(effectiveWeaponDamage(c.weapons[0], bonus(c.characteristics.force))).toBe(4);
  });

  it('formes proposées : toutes les armes réelles des Spé connues, « Arme simple » incluse (≠ junk)', () => {
    const c = mage({ skills: [{ id: 'corps-a-corps', spec: 'base', advances: 10 }] as Combatant['skills'] });
    const ids = conjureFormOptions(c).map((f) => f.weapon); // f.weapon = id de trapping
    expect(ids).toContain('arme-simple'); // arme de base commune (épée/hache/masse/lance courte)
    const boucliersDeBase = trappings.filter((t) => isShieldTrapping(t.id) && t.subType === 'base').map((t) => t.id);
    expect(boucliersDeBase, 'PRÉMISSE : des boucliers relèvent de la Spé Base').toEqual(expect.arrayContaining(['pavois', 'vision-de-vie']));
    expect(ids.filter((id) => isShieldTrapping(id) || isImprovisedTrapping(id) || isUnarmedTrapping(id))).toEqual([]); // #2240
    expect(conjureFormOptions(c).every((f) => f.group === 'base')).toBe(true); // seulement la Spé connue (id de Groupe)
  });

  it('forme LIBRE : clone le profil d’une arme RÉELLE de la Spé de Corps à corps choisie', () => {
    const c = mage({ skills: [{ id: 'corps-a-corps', spec: 'escrime', advances: 10 }] as Combatant['skills'] });
    const opt = conjureFormOptions(c)[0]; // arme réelle d'Escrime issue de la base (Rapière…)
    applyOps(c, [{ op: 'grantWeapon', label: 'Arme aethyrique', damage: { bonusOf: 'force-mentale' }, qualities: ['magique'], chooseForm: true }],
      { label: 'Arme aethyrique', defaultDurationRounds: 4, conjureForm: opt });
    expect(c.weapons[0].subType?.toLowerCase()).toBe('escrime'); // Groupe = la Spé choisie (profil réel)
    expect(c.weapons[0].label).toContain('Arme aethyrique');
    expect(damageString(c.weapons[0].damage)).toBe('+4'); // Dégâts toujours = BFM (le gabarit ne donne que le profil)
  });

  it('vit dans un SET dédié actif, retiré à l’expiration (set + objet + restauration)', () => {
    const c = mage();
    applyOps(c, [{ op: 'grantWeapon', label: 'Arme aethyrique', damage: { bonusOf: 'force-mentale' }, qualities: ['magique'] }],
      { label: 'Arme aethyrique', defaultDurationRounds: 1 });
    const conjuredUid = c.items?.find((it) => it.conjured)?.uid; // le SET dédié tient l'arme invoquée
    const conjuredSet = (c.loadouts ?? []).find((l) => l.main === conjuredUid);
    expect(conjuredSet).toBeTruthy(); // SET dédié créé…
    expect(c.activeLoadoutId).toBe(conjuredSet!.id); // …et actif
    expect(c.weapons.some((w) => w.label === 'Arme aethyrique')).toBe(true);
    endOfRound(c); // 1 Round → expire
    expect(c.items?.some((it) => it.conjured)).toBeFalsy(); // objet retiré
    expect((c.loadouts ?? []).some((l) => l.id === conjuredSet!.id)).toBe(false); // set retiré
    expect(c.activeLoadoutId).not.toBe(conjuredSet!.id); // set d'origine réactivé
    expect(c.weapons.some((w) => w.label === 'Arme aethyrique')).toBe(false);
  });
});

describe('grantNaturalWeapon — armes naturelles accordées (Dent et griffe)', () => {
  it('attaque ADDITIONNELLE Magique, Dégâts SB-relatifs (+BF+N), retirée à l’expiration', () => {
    const c = mage();
    applyOps(c, [
      { op: 'grantNaturalWeapon', label: 'Morsure', damage: 3, qualities: ['magique'] },
      { op: 'grantNaturalWeapon', label: 'Griffe', damage: 4, qualities: ['magique'] },
    ], { label: 'Dent et griffe', defaultDurationRounds: 1 });
    const bite = c.weapons.find((w) => w.label === 'Morsure');
    const claw = c.weapons.find((w) => w.label === 'Griffe');
    expect(damageString(bite!.damage)).toBe('+BF+3');
    expect(damageString(claw!.damage)).toBe('+BF+4');
    expect(bite?.qualities.some((q) => q.id === 'magique')).toBe(true);
    expect(c.weapons.some((w) => w.label === 'Mains nues')).toBe(true); // ADDITIONNELLE (mains nues conservées)
    endOfRound(c); // 1 Round → expire
    expect(c.weapons.some((w) => w.label === 'Morsure' || w.label === 'Griffe')).toBe(false);
  });
});

describe('grantWeapon — variantes de domaine (stats fixes du Sort)', () => {
  it('Faux de Shyish : Armes d’hast à 2 mains, Dégâts = BFM+3', () => {
    const c = mage(); // BFM 4
    applyOps(c, [{ op: 'grantWeapon', label: 'Faux de Shyish', damage: { bonusOf: 'force-mentale' }, damagePlus: 3, subType: 'armes-d-hast', reach: 'Longue', hands: 2, qualities: ['magique'] }],
      { label: 'La Faux de Shyish', defaultDurationRounds: 4 });
    expect(c.weapons[0].label).toBe('Faux de Shyish');
    expect(c.weapons[0].hands).toBe(2);
    expect(c.weapons[0].subType).toBe('armes-d-hast'); // id de Groupe
    expect(damageString(c.weapons[0].damage)).toBe('+7'); // BFM 4 + 3
  });

  it('Épée ardente de Rhuin : Dégâts +6, Percutante + En flammes à la touche', () => {
    const c = mage();
    applyOps(c, [{ op: 'grantWeapon', label: 'Épée ardente de Rhuin', damage: 6, subType: 'base', reach: 'Moyenne', hands: 1, qualities: ['magique', 'percutante'], onHitEffects: [onHitFlow([{ op: 'condition', id: 'en-flammes' }])] }],
      { label: "L'Épée ardente de Rhuin", defaultDurationRounds: 4 });
    expect(damageString(c.weapons[0].damage)).toBe('+6');
    expect(c.weapons[0].qualities.map((q) => q.id)).toEqual(expect.arrayContaining(['magique', 'percutante']));
    // L'onHit de l'arme invoquée est replié sur l'arme active (weapon.onHitEffects), appliqué par le dispatcher.
    const eff = c.weapons[0].onHitEffects![0];
    const victim = mage();
    runPureFlowLines(victim, c, eff.flow, {});
    expect(victim.conditions.some((x) => x.id === 'en-flammes')).toBe(true);
  });
});
