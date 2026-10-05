import { describe, it, expect } from 'vitest';
import { applyOps } from './ops';
import { endOfRound } from './conditions';
import { effectiveWeaponDamage } from './weaponDamage';
import { damageString, itemFromTrappingById, itemLabel } from './items';
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
/** L'Effet producteur de l'arme invoquée : le sort, par id (`DesignationParSource`). */
const ARME_AETHYRIQUE = { kind: 'spell', id: 'arme-aethyrique' } as const;

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
    applyOps(c, [{ op: 'grantWeapon', damage: { bonusOf: 'force-mentale' }, qualities: ['magique'] }],
      { label: 'Arme aethyrique', defaultDurationRounds: 4, source: ARME_AETHYRIQUE });
    const objet = c.items?.find((it) => it.conjured);
    expect(objet).toMatchObject({ conjured: true, source: ARME_AETHYRIQUE }); // objet réel, désigné par son sort
    expect(objet && 'trappingId' in objet).toBe(false);
    expect(itemLabel(objet!)).toBe('Arme aethyrique'); // libellé DÉRIVÉ de la source
    expect(c.weapons[0].label).toBe('Arme aethyrique'); // arme directrice
    expect(c.weapons[0].qualities.some((q) => q.id === 'magique')).toBe(true);
    expect(damageString(c.weapons[0].damage)).toBe('+4'); // BFM, pas de +BF
    expect(effectiveWeaponDamage(c.weapons[0], bonus(c.characteristics.force))).toBe(4);
  });

  it('formes proposées : toutes les armes réelles des Spé connues, « Arme simple » incluse (≠ junk)', () => {
    const c = mage({ skills: [{ id: 'corps-a-corps', spec: 'base', advances: 10 }] as Combatant['skills'] });
    const ids = conjureFormOptions(c).map((f) => f.weapon); // f.weapon = id de trapping
    expect(ids).toContain('arme-simple'); // arme de base commune (épée/hache/masse/lance courte)
    expect(ids.every((l) => !/bouclier|improvis|mains-nues/i.test(l))).toBe(true); // junk exclu
    expect(conjureFormOptions(c).every((f) => f.group === 'base')).toBe(true); // seulement la Spé connue (id de Groupe)
  });

  it('forme LIBRE : clone le profil d’une arme RÉELLE de la Spé de Corps à corps choisie', () => {
    const c = mage({ skills: [{ id: 'corps-a-corps', spec: 'escrime', advances: 10 }] as Combatant['skills'] });
    const opt = conjureFormOptions(c)[0]; // arme réelle d'Escrime issue de la base (Rapière…)
    applyOps(c, [{ op: 'grantWeapon', damage: { bonusOf: 'force-mentale' }, qualities: ['magique'], chooseForm: true }],
      { label: 'Arme aethyrique', defaultDurationRounds: 4, conjureForm: opt, source: ARME_AETHYRIQUE });
    expect(c.weapons[0].subType?.toLowerCase()).toBe('escrime'); // Groupe = la Spé choisie (profil réel)
    expect(c.items?.find((it) => it.conjured)?.form).toBe(opt.weapon); // la forme CHOISIE, par id
    expect(c.weapons[0].label).toBe(`Arme aethyrique (${itemLabel({ trappingId: opt.weapon })})`); // « (forme) » si chooseForm
    expect(damageString(c.weapons[0].damage)).toBe('+4'); // Dégâts toujours = BFM (le gabarit ne donne que le profil)
  });

  it('vit dans un SET dédié actif, retiré à l’expiration (set + objet + restauration)', () => {
    const c = mage();
    applyOps(c, [{ op: 'grantWeapon', damage: { bonusOf: 'force-mentale' }, qualities: ['magique'] }],
      { label: 'Arme aethyrique', defaultDurationRounds: 1, source: ARME_AETHYRIQUE });
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

  it('sans `ctx.source`, l’op lève : l’arme invoquée n’est désignée que par l’Effet qui la produit', () => {
    expect(() => applyOps(mage(), [{ op: 'grantWeapon', damage: { bonusOf: 'force-mentale' } }], { label: 'Arme aethyrique', defaultDurationRounds: 4 }))
      .toThrow(/grantWeapon : `ctx\.source` absent/);
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
    applyOps(c, [{ op: 'grantWeapon', damage: { bonusOf: 'force-mentale' }, damagePlus: 3, subType: 'armes-d-hast', reach: 'Longue', hands: 2, qualities: ['magique'], form: 'serpe-de-guerre' }],
      { label: 'La Faux de Shyish', defaultDurationRounds: 4, source: { kind: 'spell', id: 'la-faux-de-shyish' } });
    expect(c.weapons[0].label).toBe('La Faux de Shyish'); // libellé du sort, sans « (forme) » : la silhouette est FIXE
    const objet = c.items!.find((it) => it.conjured)!;
    expect(objet.form).toBeUndefined();
    expect(objet.shape).toBe(itemFromTrappingById('serpe-de-guerre')!.shape); // silhouette fixe par le `shape` de l'entrée
    expect(c.weapons[0].hands).toBe(2);
    expect(c.weapons[0].subType).toBe('armes-d-hast'); // id de Groupe
    expect(damageString(c.weapons[0].damage)).toBe('+7'); // BFM 4 + 3
  });

  it('Épée ardente de Rhuin : Dégâts +6, Percutante + En flammes à la touche', () => {
    const c = mage();
    applyOps(c, [{ op: 'grantWeapon', damage: 6, subType: 'base', reach: 'Moyenne', hands: 1, qualities: ['magique', 'percutante'], onHitEffects: [onHitFlow([{ op: 'condition', id: 'en-flammes' }])] }],
      { label: "L'Épée ardente de Rhuin", defaultDurationRounds: 4, source: { kind: 'spell', id: 'l-epee-ardente-de-rhuin' } });
    expect(c.weapons[0].label).toBe("L'Épée ardente de Rhuin");
    expect(damageString(c.weapons[0].damage)).toBe('+6');
    expect(c.weapons[0].qualities.map((q) => q.id)).toEqual(expect.arrayContaining(['magique', 'percutante']));
    // L'onHit de l'arme invoquée est replié sur l'arme active (weapon.onHitEffects), appliqué par le dispatcher.
    const eff = c.weapons[0].onHitEffects![0];
    const victim = mage();
    runPureFlowLines(victim, c, eff.flow, {});
    expect(victim.conditions.some((x) => x.id === 'en-flammes')).toBe(true);
  });
});
