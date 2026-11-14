/**
 * Matière de l'Armure du Trait (#1463) : les règles qui contournent une matière la lisent sur le Trait comme sur
 * une pièce portée. LDB 62 l.270 (Perforante) ; LDB 48 l.106 (Cieux) ; LDB 46 l.150-152 (Repousser les Vents) ;
 * LDB 85 l.39. Profils de fixture : MCLB 04 l.29 (Armure (Peau) 2), EDO 02 l.284 (Armure (Chemise de mailles) 2).
 */
import { describe, it, expect } from 'vitest';
import type { Combatant, Weapon } from './types';
import type { CreatureData } from '../data';
import { idDeFixture } from '../data/idDeFixture.testkit';
import type { TraitInstance } from './statEntry';
import { creatureToCombatant } from '../noyau/monde/spawn';
import { woundsFromHit } from './woundsCalc';
import { domainMissileMods } from './domainAttributes';
import { effectiveArmourAt, bonus } from './characteristics';
import { armourCastDRPenalty } from './magic';

/** Profil de créature de fixture : seules ses Caractéristiques, ses Traits et ses Talents comptent ici. */
const profil = (armure: TraitInstance, talents: CreatureData['talents'] = []): Combatant =>
  creatureToCombatant({
    id: idDeFixture('creature', 'fixture'), type: 'creatures', label: 'Fixture', title: null, folder: null,
    char: { M: 4, 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 40, sociabilite: 30, B: 15 },
    traits: [armure], optionals: [], skills: [], talents, trappings: [], spells: [],
    source: { book: 'livre-de-base', page: 0 }, appearance: { species: 'humains-reiklander' },
  }, 'fixture', { x: 0, y: 0 });

const arme = (perforante: boolean): Weapon =>
  ({ label: 'W', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: perforante ? [{ id: 'perforante' }] : [] } as unknown as Weapon);

const PEAU: TraitInstance = { id: 'armure', arg: 'Peau', value: 2, matiere: 'peau' };
const MAILLES: TraitInstance = { id: 'armure', parLocalisation: { tete: 0, brasG: 0, brasD: 0, corps: 2, jambeG: 0, jambeD: 0 }, matiere: 'metal' };
const SANS_MATIERE: TraitInstance = { id: 'armure', value: 2 };

/** Blessures d'un coup de 100 Dégâts au Corps, BE et PA restants déduits. */
const blessures = (c: Combatant, perforante: boolean): number => woundsFromHit(arme(perforante), c, 'corps', 100, 0, 1, undefined);
const be = (c: Combatant): number => bonus(c.characteristics.endurance);

describe('Perforante contre l’Armure du Trait (LDB 62 l.270)', () => {
  it('la peau n’est pas du métal : tous ses PA sont ignorés', () => {
    const enfant = profil(PEAU);
    expect(effectiveArmourAt(enfant, 'corps')).toBe(2);
    expect(blessures(enfant, true)).toBe(100 - be(enfant));
    expect(blessures(enfant, false)).toBe(100 - be(enfant) - 2);
  });
  it('le métal du Trait : seul le premier point est ignoré', () => {
    const sergent = profil(MAILLES);
    expect(blessures(sergent, true)).toBe(100 - be(sergent) - 1);
    expect(blessures(sergent, false)).toBe(100 - be(sergent) - 2);
  });
  it('matière inconnue : aucun PA ignoré par la matière, seul le premier point', () => {
    const inconnu = profil(SANS_MATIERE);
    expect(blessures(inconnu, true)).toBe(100 - be(inconnu) - 1);
  });
});

describe('Projectile du Domaine des Cieux contre l’Armure du Trait (LDB 48 l.106)', () => {
  it('les PA de métal du Trait sont ignorés', () => {
    const sergent = profil(MAILLES);
    expect(domainMissileMods(sergent, { domainId: { id: 'cieux' } }, 'corps', effectiveArmourAt(sergent, 'corps'))).toEqual({ apIgnored: 2, bonusDamage: 0 });
  });
  it('la peau et la matière inconnue ne sont pas ignorées', () => {
    for (const armure of [PEAU, SANS_MATIERE]) {
      const c = profil(armure);
      expect(domainMissileMods(c, { domainId: { id: 'cieux' } }, 'corps', effectiveArmourAt(c, 'corps')).apIgnored).toBe(0);
    }
  });
});

describe('Repousser les Vents : le Trait Armure d’une matière d’armure est une armure portée (LDB 46 l.150-152)', () => {
  const sorcier = (spec: string): CreatureData['talents'] => [{ id: 'magie-des-arcanes', spec } as never];
  it('un PNJ à Trait Armure de métal subit −1 DR par PA', () => {
    expect(armourCastDRPenalty(profil(MAILLES, sorcier('feu')))).toBe(2);
  });
  it('Magie des Arcanes (Métal) ignore le métal du Trait', () => {
    expect(armourCastDRPenalty(profil(MAILLES, sorcier('metal')))).toBe(0);
  });
  it('la peau et la matière inconnue ne sont pas une armure portée', () => {
    expect(armourCastDRPenalty(profil(PEAU, sorcier('feu')))).toBe(0);
    expect(armourCastDRPenalty(profil(SANS_MATIERE, sorcier('feu')))).toBe(0);
  });
});
