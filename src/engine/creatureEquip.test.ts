import { describe, it, expect, vi } from 'vitest';
import { weaponFromTrait, renderWeaponsFromTraits, weaponsFromTraits, armourFromTraits, weaponFromId } from './creatureEquip';
import { emptyArmour, hydratePoste, itemFromTrappingById, mannedPosteWeapon, recomputeLoadout } from './items';
import type { Combatant, Weapon } from './types';
import { effectiveWeaponRange } from './weaponDamage';
import { rangeBandModifier } from './combat';
import type { TraitInstance } from './statEntry';
import { formeResolue } from '../gameIso/rig/parts/equipment';

const t = (o: { id: string; arg?: string; value?: number; range?: number; natural?: boolean }): TraitInstance => o as TraitInstance;

describe('creatureEquip — dérivation traits → armes (source unique de l’armement ennemi/PNJ)', () => {
  it('trait « Arme (Épée) +7 » → arme de mêlée nommée', () => {
    const w = weaponFromTrait(t({ id: 'arme', arg: 'Épée', value: 7 }));
    expect(w).not.toBeNull();
    expect(w!.label).toBe('Épée');
    expect(w!.type).toBe('melee');
  });

  it('trait « Arme » sans type ni Indice → arme de mêlée générique', () => {
    const w = weaponFromTrait(t({ id: 'arme' }));
    expect(w?.label).toBe('Arme');
    expect(w?.type).toBe('melee');
  });

  it('trait « À distance (Arbalète) +9 (60) » → arme à distance nommée', () => {
    const w = weaponFromTrait(t({ id: 'a-distance', arg: 'Arbalète', value: 9, range: 60 }));
    expect(w?.label).toBe('Arbalète');
    expect(w?.type).toBe('ranged');
  });

  it('trait « À distance » SANS Indice de Dégâts → pas une arme jouable (RAW) → null', () => {
    expect(weaponFromTrait(t({ id: 'a-distance' }))).toBeNull();
  });

  it('trait « À distance » d\'arg CATALOGUE (id migré `arbalete`, specsSource weaponsRanged) → hérite forme/qualités/Recharge du trapping', () => {
    const w = weaponFromTrait(t({ id: 'a-distance', arg: 'arbalete', value: 9, range: 60 }));
    expect(w?.label).toBe('Arbalète'); // libellé du catalogue, jamais l'id brut
    expect(w?.type).toBe('ranged');
    expect(w?.trappingId).toBe('arbalete');
    expect(formeResolue(w!)).toBe('arbalete'); // forme RÉSOLUE au catalogue, jamais recopiée
    expect(w?.reload).toBe(1); // Recharge 1 dérivée de la Qualité du trapping (LDB 62 l.333)
  });

  it('trait « Arme » d\'arg NATUREL hors catalogue (« Griffes ») → aucun crash, aucune forme de catalogue posée', () => {
    const w = weaponFromTrait(t({ id: 'arme', arg: 'Griffes', value: 5, natural: true }));
    expect(w).not.toBeNull();
    expect(w?.label).toBe('Griffes');
    expect(formeResolue(w!)).toBeUndefined();
  });

  it('trait non-armement (ex. Vol) → null', () => {
    expect(weaponFromTrait(t({ id: 'vol' }))).toBeNull();
  });

  it('renderWeaponsFromTraits : AUCUNE arme de repli (un PNJ sans trait d’arme reste mains libres)', () => {
    expect(renderWeaponsFromTraits([])).toHaveLength(0);
    expect(renderWeaponsFromTraits([t({ id: 'arme', arg: 'Hache', value: 6 })])).toHaveLength(1);
  });

  it('weaponsFromTraits : GARANTIT au moins une arme (pour pouvoir toujours frapper)', () => {
    const fallback = weaponsFromTraits([]);
    expect(fallback).toHaveLength(1);
    expect(fallback[0].label).toBe('Arme');
    // avec un trait d'arme explicite, pas de repli ajouté
    expect(weaponsFromTraits([t({ id: 'arme', arg: 'Hache', value: 6 })])).toHaveLength(1);
  });
});

describe('creatureEquip — weaponFromId (canal d’authoring de scène `weapon` = trappingId)', () => {
  it('trappingId valide → arme COMPLÈTE du catalogue (Dégâts, Portée, Groupe, identité), pas une coquille de rendu', () => {
    const w = weaponFromId('arc');
    expect(w).not.toBeNull();
    expect(w!.label).toBe('Arc');
    expect(w!.type).toBe('ranged');
    expect(formeResolue(w!)).toBe('arc');
    expect(w!.damage).toEqual({ plusBF: true, flat: 3 });
    expect(w!.range).toBe(50);
    expect(w!.subType).toBe('arc'); // Groupe d'arme → Spécialisation de Projectiles (weaponGroupSkillMode)
    expect(w!.trappingId).toBe('arc');
    expect(w!.hands).toBe(2);
  });

  it('la Portée du catalogue rend la cible ATTEIGNABLE : effectiveWeaponRange non nulle et bande de tir valide', () => {
    const w = weaponFromId('arc')!;
    expect(effectiveWeaponRange(w, undefined, 3)).toBe(50);
    expect(rangeBandModifier(10, effectiveWeaponRange(w, undefined, 3)!, 2)).not.toBeNull(); // 10 cases = 20 m ≤ 50 m
  });

  it('mêlée : type, Dégâts, Allonge et Recharge du catalogue', () => {
    const w = weaponFromId('hache-d-armes')!;
    expect(w.type).toBe('melee');
    expect(w.damage).toEqual({ plusBF: true, flat: 4 });
    expect(w.reach).toBe('Longue');
    // Contrat de `Weapon.range` : `null` = profil de catalogue PROJETÉ, réponse « aucune Portée » (ce que
    // `ItemInstance.range` porte déjà, `t.range ?? null`) ; ABSENT = la question n'a pas été posée (arme
    // SYNTHÉTIQUE : naturelle, mains nues, générique hors catalogue). Une arme de mêlée du catalogue est
    // donc `null` sur les TROIS canaux d'armement, comme la possession d'un héros.
    expect(w.range).toBeNull();
  });

  it('Recharge dérivée de la Qualité du catalogue (LDB 62 l.333)', () => {
    expect(weaponFromId('arbalete')!.reload).toBe(1);
  });

  it('trappingId INCONNU → console.error bruyant (#223) + AUCUNE arme devinée (null)', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = weaponFromId('Arc'); // un LIBELLÉ n'est pas un id
    expect(w).toBeNull();
    expect(err).toHaveBeenCalledWith(expect.stringContaining('Arc'));
    err.mockRestore();
  });

  it('trapping qui n’est PAS une arme → console.error + null (aucune arme inventée depuis un objet)', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(weaponFromId('corde')).toBeNull();
    expect(err).toHaveBeenCalledWith(expect.stringContaining('corde'));
    err.mockRestore();
  });
});

describe('creatureEquip — armourFromTraits (lookup par id stable)', () => {
  it('trait « armure » (id stable) value 2 → PA 2 sur toutes les localisations', () => {
    const ap = armourFromTraits([t({ id: 'armure', value: 2 })]);
    expect(ap).toEqual({ tete: 2, brasG: 2, brasD: 2, corps: 2, jambeG: 2, jambeD: 2 });
  });

  it('aucun trait armure → PA 0 partout', () => {
    const ap = armourFromTraits([t({ id: 'vol', value: 6 })]);
    expect(ap).toEqual({ tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 });
  });
});

/**
 * PROJECTION UNIQUE `weaponFromItem` (engine/items) : dériver une arme d'une Possession de catalogue se
 * fait par UN seul chemin, quel que soit le canal d'armement — possession de héros (`recomputeLoadout`),
 * trait de statbloc (`weaponFromTrait`), `weapon:` d'authoring de scène (`weaponFromId`), poste
 * d'artillerie servi (`mannedPosteWeapon`). Une projection qui redeviendrait PARTIELLE (un champ de
 * profil porté par un canal et pas par l'autre) échoue ICI.
 */
describe('armement — la projection catalogue → arme est UNE, quel que soit le canal', () => {
  const chars = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
  /** Canal POSSESSION DE HÉROS : l'objet du catalogue équipé, projeté par `recomputeLoadout`. */
  const parPossession = (trappingId: string): Weapon | undefined => {
    const c = {
      items: [{ ...itemFromTrappingById(trappingId)!, equipped: true }],
      weapons: [], armour: emptyArmour(), characteristics: chars,
    } as unknown as Combatant;
    recomputeLoadout(c);
    return c.weapons.find((w) => w.trappingId === trappingId);
  };
  const chef = { characteristics: chars, weapons: [] } as unknown as Combatant;

  it('arme de catalogue à `onHitEffects` (Arc d’empathie sanglante) : les TROIS canaux la portent — possession de héros, trait de statbloc, `weapon:` d’authoring', () => {
    const canaux = [
      parPossession('arc-d-empathie-sanglante')!,
      weaponFromTrait(t({ id: 'a-distance', arg: 'arc-d-empathie-sanglante', value: 9 }))!,
      weaponFromId('arc-d-empathie-sanglante')!,
    ];
    for (const w of canaux) {
      expect(w.onHitEffects).toHaveLength(1);
      expect(w.trappingId).toBe('arc-d-empathie-sanglante'); // identité STABLE (weaponIdentity) → source des onHitEffects
      expect(w.subType).toBe('arc');
      expect(w.hands).toBe(2);
    }
  });

  it('machine de guerre ADE II (Canon à flammes nain) : `onHitEffects`, `minRangeBand`, Groupe de Projectiles et Recharge portés par le trait, par `weapon:` ET par le poste servi', () => {
    const canaux = [
      mannedPosteWeapon(chef, hydratePoste({ trappingId: 'canon-a-flammes-nain-ade2', side: 'tribord' }))!,
      weaponFromTrait(t({ id: 'a-distance', arg: 'canon-a-flammes-nain-ade2', value: 12 }))!,
      weaponFromId('canon-a-flammes-nain-ade2')!,
    ];
    for (const w of canaux) {
      expect(w.onHitEffects).toHaveLength(1);
      expect(w.minRangeBand).toBe('courte'); // ADE II 8 l.253
      expect(w.weaponGroup).toBe('machine-de-guerre');
      expect(w.reload).toBe(3); // LDB 62 l.333
    }
    // Divergence LÉGITIME entre canaux, ≠ trou de projection : une machine à Équipe (ADE II 8 l.233) ne se
    // manie jamais en loadout solo — le canal « possession de héros » la REFUSE, elle doit être servie.
    expect(parPossession('canon-a-flammes-nain-ade2')).toBeUndefined();
  });

  it('arme de JET (`range: {bf}`, LDB 62) : la SPEC traverse le constructeur d’arme, sans être reposée après coup', () => {
    const canaux = [
      parPossession('javelot')!,
      weaponFromTrait(t({ id: 'a-distance', arg: 'javelot', value: 5 }))!,
      weaponFromId('javelot')!,
    ];
    for (const w of canaux) {
      expect(w.range).toEqual({ bf: 3 });
      expect(effectiveWeaponRange(w, undefined, 4)).toBe(12); // résolue au BF du porteur → arme réellement jouable en tir
    }
  });

  it('Possession de catalogue SANS profil de Dégâts (Lasso) : « +BF » nu — convention du profil d’arme, portée par la projection UNIQUE, jamais redéclarée par un canal', () => {
    const nu = { plusBF: true, flat: 0, bare: true };
    expect(weaponFromId('lasso')!.damage).toEqual(nu);
    expect(parPossession('lasso')!.damage).toEqual(nu);
    // Canal TRAIT : l'Indice IMPRIMÉ du statbloc prime (LDB 85 l.9) — il n'y a rien à replier.
    expect(weaponFromTrait(t({ id: 'a-distance', arg: 'lasso', value: 4 }))!.damage).toEqual({ plusBF: false, flat: 4 });
  });

  it('Taille PRÉVUE d’une arme ogre (`sizeFor`, ADE II 2 l.706-710) : héritée par le canal TRAIT — un statbloc à massue ogre porte la même arme que la possession', () => {
    expect(weaponFromTrait(t({ id: 'arme', arg: 'massue-ogre', value: 7 }))!.sizeFor).toBe('grande');
    expect(weaponFromId('massue-ogre')!.sizeFor).toBe('grande');
    expect(parPossession('massue-ogre')!.sizeFor).toBe('grande');
  });
});
