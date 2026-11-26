import { idsDeTest } from './idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { ajusterTraitsDuProfil, weaponFromTrait, renderWeaponsFromTraits, weaponsFromTraits } from './creatureEquip';
import { emptyArmour, hydratePoste, itemFromTrappingById, mannedPosteWeapon, recomputeLoadout, formeResolue } from './items';
import type { Combatant, ItemInstance, Weapon } from './types';
import { armourPhysiqueAt } from './armourBypass';
import { LOCALISATIONS_DE_COUP } from './types';
import { tableTotale } from '../lib/tableTotale';
import { effectiveWeaponRange } from './weaponDamage';
import { rangeBandModifier } from './combat';
import { traitsDuPorteur, type TraitInstance } from './statEntry';
import { porteurDuProfil, spawnEnemy } from '../noyau/monde/spawn';
import { findCreatureById, findTrappingById } from '../data';
import { traitInstanceSchema } from '../data/schemas/grammaire/reference';
import { attackDRAdjust, dangerousNine, qualityDamageStep, resolveQualities } from './qualities/dispatch';
import { resetRule, setRule } from './policy';

const t = (o: TraitInstance): TraitInstance => o;

describe('creatureEquip — dérivation traits → armes (source unique de l’armement ennemi/PNJ)', () => {
  it('admet une arme locale dans l’univers déclaré de son trait, et refuse l’autre univers', () => {
    const objet = { ...findTrappingById('arc')!, id: 'arc-de-campagne' };
    const resolveTrapping = (id: string) => id === objet.id ? objet : findTrappingById(id);
    expect(weaponFromTrait(t({ id: 'a-distance', arg: objet.id, value: 9 }), resolveTrapping)?.trappingId).toBe(objet.id);
    expect(weaponFromTrait(t({ id: 'arme', arg: objet.id, value: 7 }), resolveTrapping)?.trappingId).toBeUndefined();
  });
  it('trait « Arme (Épée) +7 » → arme de mêlée nommée', () => {
    const w = weaponFromTrait(t({ id: 'arme', arg: 'Épée', value: 7 }));
    expect(w).not.toBeNull();
    expect(w!.label).toBe('Épée');
    expect(w!.type).toBe('melee');
  });

  it('l’arme d’un Trait d’attaque porte les Traits qu’il confère (ZI 06 l.32)', () => {
    expect(weaponFromTrait(t({ id: 'arme', arg: 'Serres', value: 7, confere: [{ id: 'venin', arg: 'difficile' }] }))!.traitsConferes).toEqual([{ id: 'venin', arg: 'difficile' }]);
    expect(weaponFromTrait(t({ id: 'arme', arg: 'Serres', value: 7 }))!.traitsConferes).toBeUndefined();
  });

  it('trait « Arme » sans type ni Indice → arme de mêlée générique', () => {
    const w = weaponFromTrait(t({ id: 'arme' }));
    expect(w?.label).toBe('Arme');
    expect(w?.type).toBe('melee');
  });

  it('trait « À distance (Arbalète) +9 (60) » → arme à distance nommée', () => {
    const w = weaponFromTrait(t({ id: 'a-distance', arg: 'Arbalète', value: 9, range: 60 }));
    expect(w?.label).toBe('Arbalète');
    expect(w?.type).toBe('distance');
  });

  it('trait « À distance » SANS Indice de Dégâts → pas une arme jouable (RAW) → null', () => {
    expect(weaponFromTrait(t({ id: 'a-distance' }))).toBeNull();
  });

  it('trait « À distance » d\'arg CATALOGUE (id migré `arbalete`, specsSource weaponsRanged) → hérite forme/qualités/Recharge du trapping', () => {
    const w = weaponFromTrait(t({ id: 'a-distance', arg: 'arbalete', value: 9, range: 60 }));
    expect(w?.label).toBe('Arbalète'); // libellé du catalogue, jamais l'id brut
    expect(w?.type).toBe('distance');
    expect(w?.trappingId).toBe('arbalete');
    expect(formeResolue(w!)).toBe('arbalete'); // #2967
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

  it('weaponsFromTraits : sans trait d’arme, les Mains nues (LDB 85 l.31, LDB 62 l.28)', () => {
    const fallback = weaponsFromTraits([]);
    expect(fallback).toHaveLength(1);
    expect(fallback[0]).toMatchObject({ builtinId: 'mains-nues', damage: { plusBF: true, flat: 0 } });
    // avec un trait d'arme explicite, pas de repli ajouté
    expect(weaponsFromTraits([t({ id: 'arme', arg: 'Hache', value: 6 })])).toHaveLength(1);
  });
});

describe('PA du Trait Armure identifié par id stable', () => {
  const paDuProfil = (traits: TraitInstance[]) =>
    tableTotale(LOCALISATIONS_DE_COUP, (loc) => armourPhysiqueAt({ armour: emptyArmour(), traits }, loc));

  it('trait « armure » (id stable) value 2 → PA 2 sur toutes les localisations', () => {
    const ap = paDuProfil([t({ id: 'armure', value: 2 })]);
    expect(ap).toEqual({ tete: 2, brasG: 2, brasD: 2, corps: 2, jambeG: 2, jambeD: 2 });
  });

  it('Moritz (MCLB 02 l.698) : le Heaume à la Tête, le groupe PLATE ailleurs (LDB 63 l.53-58)', () => {
    const moritz = findCreatureById('moritz-valgeir')!;
    expect(paDuProfil(traitsDuPorteur(moritz.traits, porteurDuProfil(moritz.id, moritz.char)))).toEqual({ tete: 2, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 });
  });

  it('Indice par Localisation → chaque Localisation porte le sien', () => {
    const parLocalisation = { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 1, jambeD: 1 };
    expect(paDuProfil([t({ id: 'armure', parLocalisation })])).toEqual(parLocalisation);
  });

  it('un Aspect n’est pas un Indice : « Armure (Peau) » sans Indice → PA 0', () => {
    expect(paDuProfil([t({ id: 'armure', arg: 'Peau' })])).toEqual({ tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 });
  });

  it('aucun trait armure → PA 0 partout', () => {
    const ap = paDuProfil([t({ id: 'vol', value: 6 })]);
    expect(ap).toEqual({ tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 });
  });
});

/**
 * PROJECTION UNIQUE `weaponFromItem` (engine/items) : dériver une arme d'une Possession de catalogue se
 * fait par UN seul chemin, quel que soit le canal d'armement — possession de héros (`recomputeLoadout`),
 * dont l'inventaire d'auteur d'un PNJ (#3684), trait de statbloc (`weaponFromTrait`), poste d'artillerie servi
 * (`mannedPosteWeapon`). Une projection qui redeviendrait PARTIELLE (un champ de
 * profil porté par un canal et pas par l'autre) échoue ICI.
 */
describe('armement — la projection catalogue → arme est UNE, quel que soit le canal', () => {
  const chars = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
  const porteur = (items: ItemInstance[], traits: TraitInstance[] = []): Combatant =>
    ({ items, traits, weapons: [], armour: emptyArmour(), characteristics: chars }) as unknown as Combatant;
  /** Canal POSSESSION DE HÉROS : l'objet du catalogue équipé, projeté par `recomputeLoadout`. */
  const parPossession = (trappingId: string): Weapon | undefined => {
    const c = porteur([{ ...itemFromTrappingById(trappingId, idsDeTest)!, equipped: true }]);
    recomputeLoadout(c);
    return c.weapons.find((w) => w.trappingId === trappingId);
  };
  const chef = { characteristics: chars, weapons: [] } as unknown as Combatant;

  it('une Possession de tir : arme COMPLÈTE du catalogue (Dégâts, Portée, Groupe, identité, mains), la cible atteignable', () => {
    const w = parPossession('arc')!;
    expect([w.label, w.type, formeResolue(w), w.damage, w.range, w.subType, w.trappingId, w.hands]).toEqual(['Arc', 'distance', 'arc', { plusBF: true, flat: 3 }, 50, 'arc', 'arc', 2]);
    expect(rangeBandModifier(10, effectiveWeaponRange(w, undefined, 3)!, 2)).not.toBeNull(); // 10 cases = 20 m ≤ 50 m
  });

  it('une Possession de mêlée : type, Dégâts, Allonge du catalogue, `range` null (profil projeté, aucune Portée) ; la Recharge d’une arbalète (LDB 62 l.333)', () => {
    const w = parPossession('hache-d-armes')!;
    expect([w.type, w.damage, w.reach, w.range]).toEqual(['melee', { plusBF: true, flat: 4 }, 'Longue', null]);
    expect(parPossession('arbalete')!.reload).toBe(1);
  });

  it('le profil de mêlée conserve les Atouts de la variante et des possessions, retire ceux du groupe et fixe l’Allonge', () => {
    setRule('combat-aa-armement', true);
    try {
      const objet = itemFromTrappingById('fleuret', idsDeTest)!;
      objet.equipped = true;
      objet.qualities.push({ id: 'solide', value: 2 });
      const c = porteur([objet], [{ id: 'arme', arg: 'fleuret', value: 9, profilDArme: {
        allonge: 'Courte', retire: ['empaleuse'], qualites: [{ id: 'defensive' }],
      } }]);

      ajusterTraitsDuProfil(c, [objet], [], { armureDecriteParLeTrait: false });
      recomputeLoadout(c);

      const arme = c.weapons.find((w) => w.uid === objet.uid)!;
      expect(arme).toMatchObject({ reach: 'Courte', damage: { plusBF: false, flat: 9, bfInclus: true } });
      expect(resolveQualities(arme).map((q) => q.instance)).toEqual([
        { id: 'precise' }, { id: 'inoffensive' }, { id: 'solide', value: 2 }, { id: 'defensive' }, { id: 'rapide' },
      ]);
      expect(objet.qualities).toContainEqual({ id: 'solide', value: 2 });
      expect(objet.reach).toBe('Moyenne');
    } finally {
      resetRule('combat-aa-armement');
    }
  });

  it('la Recharge suit l’Indice posé sur l’attaque, sans changer l’entrée du catalogue', () => {
    const arme = weaponFromTrait(t({ id: 'a-distance', arg: 'arbalete', value: 9, profilDArme: {
      qualites: [{ id: 'recharge', value: 2 }],
    } }))!;
    expect(arme.qualities.filter((q) => q.id === 'recharge')).toEqual([{ id: 'recharge', value: 2 }]);
    expect(arme.reload).toBe(2);
    expect(parPossession('arbalete')!.reload).toBe(1);
  });

  it('une arme de prothèse reçoit le profil du Trait qui désigne la possession', () => {
    const crochet = { ...itemFromTrappingById('crochet', idsDeTest)!, equipped: true };
    const c = porteur([crochet], [{ id: 'arme', arg: 'crochet', value: 8, profilDArme: {
      qualites: [{ id: 'defensive' }],
    } }]);
    ajusterTraitsDuProfil(c, [crochet], [], { armureDecriteParLeTrait: false });
    recomputeLoadout(c);
    const arme = c.weapons.find((w) => w.derivedFromItem === crochet.uid)!;
    expect(arme).toMatchObject({ reach: 'Très courte', damage: { plusBF: false, flat: 8, bfInclus: true } });
    expect(resolveQualities(arme).map((q) => q.id)).toEqual(['defensive']);
    expect(crochet.derivedWeapon?.qualities).toEqual([]);
  });

  it('arme de catalogue à `onHitEffects` (Arc d’empathie sanglante) : la possession (héros ou inventaire de PNJ) et le trait de statbloc la portent', () => {
    const canaux = [
      parPossession('arc-d-empathie-sanglante')!,
      weaponFromTrait(t({ id: 'a-distance', arg: 'arc-d-empathie-sanglante', value: 9 }))!,
    ];
    for (const w of canaux) {
      expect(w.onHitEffects).toHaveLength(1);
      expect(w.trappingId).toBe('arc-d-empathie-sanglante'); // identité STABLE (weaponIdentity) → source des onHitEffects
      expect(w.subType).toBe('arc');
      expect(w.hands).toBe(2);
    }
  });

  it('la fiche du Canon à flammes nain fournit le profil du poste servi (ADE II 08 l.233-253, l.270)', () => {
    const trappingId = 'canon-a-flammes-nain-ade2';
    const arme = mannedPosteWeapon(chef, hydratePoste({ engin: { id: trappingId }, side: 'tribord' }, 'poste-de-test'));
    expect(arme).toMatchObject({ trappingId, minRangeBand: 'courte', weaponGroup: 'machine-de-guerre', reload: 3 });
    expect(arme?.onHitEffects).toHaveLength(1);
    expect(weaponFromTrait(t({ id: 'a-distance', arg: trappingId, value: 12 }))?.trappingId).toBeUndefined();
    expect(parPossession(trappingId)).toBeUndefined();
  });

  it('arme de JET (`range: {bf}`, LDB 62) : la SPEC traverse le constructeur d’arme, sans être reposée après coup', () => {
    const canaux = [
      parPossession('javelot')!,
      weaponFromTrait(t({ id: 'a-distance', arg: 'javelot', value: 5 }))!,
    ];
    for (const w of canaux) {
      expect(w.range).toEqual({ bf: 3 });
      expect(effectiveWeaponRange(w, undefined, 4)).toBe(12); // résolue au BF du porteur → arme réellement jouable en tir
    }
  });

  it('Lasso : Dégâts « – » (LDB 62 l.76) — portés par la projection UNIQUE, jamais redéclarés par un canal', () => {
    expect(parPossession('lasso')!.damage).toEqual({ aucun: true });
    // Canal TRAIT : l'Indice IMPRIMÉ du statbloc prime (LDB 85 l.9) — il n'y a rien à replier.
    expect(weaponFromTrait(t({ id: 'a-distance', arg: 'lasso', value: 4 }))!.damage).toEqual({ plusBF: false, flat: 4 });
  });

  it('Taille PRÉVUE d’une arme ogre (`sizeFor`, ADE II 2 l.753-757) : héritée par le canal TRAIT — un statbloc à massue ogre porte la même arme que la possession', () => {
    expect(weaponFromTrait(t({ id: 'arme', arg: 'massue-ogre', value: 7 }))!.sizeFor).toBe('grande');
    expect(parPossession('massue-ogre')!.sizeFor).toBe('grande');
  });
});

describe('statblocs armés au catalogue : Atouts/Allonge du catalogue, Dégâts et Portée du statbloc (LDB 85 l.9)', () => {
  const armesDe = (id: string): Weapon[] => {
    const c = findCreatureById(id)!;
    return renderWeaponsFromTraits(traitsDuPorteur(c.traits, porteurDuProfil(c.id, c.char)));
  };

  it('Vrisk Gratte-le-fer « Arme (Épée) +12 » : une Arme simple (LDB 62 l.127 ; MDG 16 l.499)', () => {
    const w = armesDe('vrisk-gratte-le-fer').find((a) => a.trappingId === 'arme-simple')!;
    expect([w.type, w.reach, w.qualities, w.damage]).toEqual(['melee', 'Moyenne', [], { plusBF: false, flat: 12, bfInclus: true }]);
  });

  it('le technomage tire au pistolet +9 (20) sans Dangereuse (ZI 13 l.205, l.222, l.224)', () => {
    const c = spawnEnemy({ ref: 'technomage-du-clan-skryre' }, 'technomage', undefined);
    const distance = c.weapons.filter((a) => a.type === 'distance');
    expect(distance).toHaveLength(2);
    const pistolet = distance.find((a) => a.trappingId === 'pistolet-a-malepierre')!;
    expect(pistolet).toMatchObject({ damage: { plusBF: false, flat: 9 }, range: 20, reload: 1, onHitEffects: [expect.any(Object)] });
    expect(resolveQualities(pistolet).map((q) => q.id)).toEqual([
      'pistolet', 'a-poudre-noire', 'devastatrice', 'empaleuse', 'perforante', 'recharge',
    ]);
    expect(dangerousNine(pistolet, 91, false)).toBe(false);
    expect(dangerousNine(weaponFromTrait(t({ id: 'a-distance', arg: 'pistolet-a-malepierre', value: 9 }))!, 91, false)).toBe(true);
  });

  it('le prototype ne subit pas Imprécise au canon et joue les deux Atouts de son poing (ZI 13 l.197, l.238–242)', () => {
    const c = spawnEnemy({ ref: 'prototype-du-clan-skryre' }, 'prototype', undefined);
    const canon = c.weapons.find((a) => a.trappingId === 'canon-ratling')!;
    expect(canon).toMatchObject({ damage: { plusBF: false, flat: 11 }, range: 40, onHitEffects: [expect.any(Object)] });
    expect(resolveQualities(canon).map((q) => q.id)).toEqual([
      'a-poudre-noire', 'empaleuse', 'a-explosion', 'perforante', 'dangereuse', 'arme-d-equipe',
    ]);
    expect(attackDRAdjust(canon, true)).toBe(0);
    expect(attackDRAdjust(weaponFromTrait(t({ id: 'a-distance', arg: 'canon-ratling', value: 11 }))!, true)).toBe(-1);

    const poing = c.weapons.find((w) => w.type === 'melee')!;
    expect(poing).toMatchObject({ label: 'Poing à pistons', sizeless: true, damage: { plusBF: false, flat: 12, bfInclus: true } });
    expect(poing.trappingId).toBeUndefined();
    const qualites = resolveQualities(poing);
    expect(qualites.map((q) => q.id)).toEqual(['assommante', 'percutante']);
    expect(qualites[0].data?.effects).toContainEqual(expect.objectContaining({ trigger: 'onHit' }));
    expect(qualityDamageStep(poing, { effDR: 2, units: 4 })).toEqual({ dmgDR: 2, bonus: 4 });
  });
});

describe('profil d’arme dans le Trait posé', () => {
  it('admet références de qualités et Allonge canoniques sur les Traits d’arme', () => {
    const melee = { id: 'arme', profilDArme: { qualites: [{ id: 'defensive' }], retire: ['percutante'], allonge: 'Moyenne' } };
    expect(traitInstanceSchema.parse(melee)).toEqual(melee);
    expect(traitInstanceSchema.safeParse({ id: 'a-distance', profilDArme: { retire: ['imprecise'] } }).success).toBe(true);
    expect(traitInstanceSchema.safeParse({ ...melee, id: 'a-distance' }).success).toBe(false);
    expect(traitInstanceSchema.safeParse({ ...melee, id: 'morsure' }).success).toBe(false);
    expect(traitInstanceSchema.safeParse({ ...melee, profilDArme: { retire: ['Inconnue'] } }).success).toBe(false);
  });
});
