/**
 * Possession pas prévue pour la Taille du porteur (ADE II 2 l.710 : « Un ogre subit une pénalité de
 * −20 à tous les Tests lorsqu'il tente d'utiliser des possessions qui ne sont pas prévues pour sa Taille »).
 * Portée couverte ICI : le maniement d'armes (`attackModifiers`, Corps à corps/Projectiles). Le lot données
 * pose `sizeFor` sur le catalogue ogre ; les Tests hors combat (compétences/UI) restent hors périmètre.
 */
import { describe, it, expect } from 'vitest';
import { attackModifiers, freeAttackWeapon } from './combat';
import { itemFromTrappingById } from './items';
import { weaponsFromTraits } from './creatureEquip';
import { attaqueNaturelle } from './creatureAttacks';
import { findCreatureById } from '../data';
import { ligneDe } from './modLine.testkit';
import { refDeRegle } from './reglesChiffrees';
import type { Combatant, Weapon } from './types';

const PAS_A_SA_TAILLE = refDeRegle('possession-pas-a-sa-taille');
const attacker = (size?: Combatant['size']): Combatant => ({ advantage: 0, conditions: [], skills: [], size } as unknown as Combatant);
const weapon = (sizeFor?: Weapon['sizeFor']): Weapon => ({ name: 'Massue', type: 'melee', hands: 1, qualities: [], sizeFor }) as unknown as Weapon;

describe('sizeFor — pénalité de Taille (ADE II 2 l.710)', () => {
  it('0 excédent : `sizeFor` EGAL à la Taille du porteur → aucune ligne', () => {
    const mods = attackModifiers(attacker('grande'), null, weapon('grande'), { kind: 'melee' });
    expect(ligneDe(mods, PAS_A_SA_TAILLE)).toBeUndefined();
    // Le porteur SANS `size` explicite (Moyenne implicite, effectiveSize) avec une arme `sizeFor:'moyenne'`
    const modsDefault = attackModifiers(attacker(undefined), null, weapon('moyenne'), { kind: 'melee' });
    expect(ligneDe(modsDefault, PAS_A_SA_TAILLE)).toBeUndefined();
  });
  it("cas nominal : un ogre (Taille Grande) maniant une arme `sizeFor:'moyenne'` (pas taillée pour lui) subit −20", () => {
    const mods = attackModifiers(attacker('grande'), null, weapon('moyenne'), { kind: 'melee' });
    expect(ligneDe(mods, PAS_A_SA_TAILLE)?.value).toBe(-20);
  });
  it("symétrique : un combattant de Taille Moyenne maniant une arme `sizeFor:'grande'` (taille ogre) subit −20", () => {
    const mods = attackModifiers(attacker('moyenne'), null, weapon('grande'), { kind: 'melee' });
    expect(ligneDe(mods, PAS_A_SA_TAILLE)?.value).toBe(-20);
  });
  it("catalogue ogre réel (`massue-ogre`) : un ogre la manie SANS −20, une créature Moyenne SUBIT −20 (ADE II 2 l.604 : « pratiquement inutilisables entre les mains des créatures de Taille Moyenne »)", () => {
    const massue = itemFromTrappingById('massue-ogre')! as unknown as Weapon;
    expect(ligneDe(attackModifiers(attacker('grande'), null, massue, { kind: 'melee' }), PAS_A_SA_TAILLE)).toBeUndefined();
    expect(ligneDe(attackModifiers(attacker('moyenne'), null, massue, { kind: 'melee' }), PAS_A_SA_TAILLE)?.value).toBe(-20);
  });
  it("arme SANS `sizeFor` (possession ORDINAIRE du catalogue, implicitement Moyenne) : un ogre (Taille Grande) subit −20 (ADE II 2 l.710, ex. « un pistolet à répétition humain »)", () => {
    const mods = attackModifiers(attacker('grande'), null, weapon(), { kind: 'melee' });
    expect(ligneDe(mods, PAS_A_SA_TAILLE)?.value).toBe(-20);
  });
  it("arme SANS `sizeFor` maniée par un porteur PLUS PETIT que la Moyenne (halfling, Taille Petite) : aucune ligne — la LDB (Talent Petit, ch.10 l.939-943) est muette sur une pénalité d'équipement ordinaire", () => {
    const mods = attackModifiers(attacker('petite'), null, weapon(), { kind: 'melee' });
    expect(ligneDe(mods, PAS_A_SA_TAILLE)).toBeUndefined();
  });

  // LDB 85 l.387 ; LDB 85 l.237 ; LDB 85 l.47 ; LDB 85 l.405
  it.each([['pietinement', ''], ['morsure', 'morsure'], ['caudale', 'attaque-caudale'], ['cornes', 'cornes'], ['tentacules', 'tentacules']])('attaque gratuite de créature « %s » : arme NATURELLE, jamais de −20 pour un porteur Énorme', (kind, trait) => {
    const w = freeAttackWeapon(attaqueNaturelle(trait ? [{ id: trait, value: 7 }] : [], kind)!);
    expect(w.natural).toBe(true);
    expect(ligneDe(attackModifiers(attacker('enorme'), null, w, { kind: 'melee' }), PAS_A_SA_TAILLE)).toBeUndefined();
  });

  it("arme NATURELLE (`Weapon.natural`, LDB 85 l.33) : jamais de −20 même pour un porteur plus grand que la Moyenne — sa taille effective EST celle du porteur", () => {
    const w = { name: 'Griffes', type: 'melee', hands: 1, qualities: [], natural: true } as unknown as Weapon;
    const mods = attackModifiers(attacker('grande'), null, w, { kind: 'melee' });
    expect(ligneDe(mods, PAS_A_SA_TAILLE)).toBeUndefined();
  });

  it("régression #ogre : la créature `ogre` du REGISTRE (trait « Arme » générique, sans arg catalogue) attaque avec son arme innée SANS malus (repro recette — auparavant « 30 −20 »), tout en gardant sa silhouette d'arme au rendu (`sizeless` ≠ `natural`)", () => {
    const ogre = findCreatureById('ogre')!;
    const [w] = weaponsFromTraits(ogre.traits);
    expect(w.sizeless).toBe(true);
    expect(w.natural).toBeUndefined(); // ne vide PAS les mains au rendu (weaponFamily)
    const mods = attackModifiers(attacker('grande'), null, w, { kind: 'melee' });
    expect(ligneDe(mods, PAS_A_SA_TAILLE)).toBeUndefined();
  });

  it("l'ogre avec une épée du CATALOGUE (sans `sizeFor`) garde son −20 (objet manufacturé, pas une arme naturelle/sizeless)", () => {
    const epee = itemFromTrappingById('dague')! as unknown as Weapon;
    expect(epee.natural).toBeUndefined();
    expect(epee.sizeless).toBeUndefined();
    const mods = attackModifiers(attacker('grande'), null, epee, { kind: 'melee' });
    expect(ligneDe(mods, PAS_A_SA_TAILLE)?.value).toBe(-20);
  });
});
