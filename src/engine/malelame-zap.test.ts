/**
 * L'Atout ZAP ! et la décharge de la malelame à deux mains jouent par l'arme de CATALOGUE que désigne l'`arg`
 * d'un Trait Arme de statbloc. MDG 16 l.536 ; ZI 13 l.199 ; LDB 85 l.31-35 ; #4202.
 */
import { describe, it, expect } from 'vitest';
import type { Combatant, Weapon } from './types';
import { idDeFixture } from '../data/idDeFixture.testkit';
import type { TraitInstance } from './statEntry';
import { creatureToCombatant } from '../noyau/monde/spawn';
import { woundsFromHit } from './woundsCalc';
import { weaponFromTrait } from './creatureEquip';
import { bonus } from './characteristics';
import { qualityArmourBypasses } from './qualities/dispatch';
import { applyEnchants, improvisedProfile } from './weaponDamage';

/** Profil de créature de fixture : seuls son Endurance et son Trait Armure comptent ici. */
const cible = (armure: TraitInstance): Combatant =>
  creatureToCombatant({
    id: idDeFixture('creature', 'fixture'), type: 'creatures', label: 'Fixture', title: null, folder: null,
    char: { M: 4, 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 40, sociabilite: 30, B: 15 },
    traits: [armure], optionals: [], skills: [], talents: [], trappings: [], spells: [],
    source: { book: 'livre-de-base', page: 0 }, appearance: { species: 'humains-reiklander' },
  }, 'fixture', { x: 0, y: 0 });

const MAILLES: TraitInstance = { id: 'armure', parLocalisation: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 }, matiere: 'metal' };
const PEAU: TraitInstance = { id: 'armure', arg: 'Peau', value: 3, matiere: 'peau' };

/** Blessures d'un coup de 100 Dégâts au Corps porté par l'arme du Trait `arme` d'argument `arg`. */
const blessures = (arg: string, c: Combatant): number =>
  woundsFromHit(weaponFromTrait({ id: 'arme', value: 8, arg }) ?? undefined, c, 'corps', 100, 0, 1, undefined);

describe('ZAP ! par la malelame à une main du catalogue (MDG 16 l.536)', () => {
  it('ignore les PA d’une armure en métal', () => {
    const c = cible(MAILLES);
    expect(blessures('malelame-a-une-main', c)).toBe(100 - bonus(c.characteristics.endurance));
  });

  it('retire 1 PA à une armure d’une autre matière', () => {
    const c = cible(PEAU);
    expect(blessures('malelame-a-une-main', c)).toBe(100 - bonus(c.characteristics.endurance) - 2);
  });

  it('un argument hors catalogue ne porte aucun Atout : tous les PA comptent', () => {
    const c = cible(MAILLES);
    expect(blessures('Électro-Lame', c)).toBe(100 - bonus(c.characteristics.endurance) - 3);
  });
});

/** Blessures d'un coup de 100 Dégâts au Corps porté par l'arme `w`. */
const blessuresDe = (w: Weapon, c: Combatant): number => woundsFromHit(w, c, 'corps', 100, 0, 1, undefined);
const malelameADeuxMains = (): Weapon => weaponFromTrait({ id: 'arme', value: 8, arg: 'malelame-a-deux-mains' })!;

describe('la décharge de la malelame à deux mains ignore les PA des armures métalliques (ZI 13 l.199)', () => {
  it('ignore les PA d’une armure en métal', () => {
    const c = cible(MAILLES);
    expect(blessuresDe(malelameADeuxMains(), c)).toBe(100 - bonus(c.characteristics.endurance));
  });

  it('compte tous les PA d’une armure d’une autre matière', () => {
    const c = cible(PEAU);
    expect(blessuresDe(malelameADeuxMains(), c)).toBe(100 - bonus(c.characteristics.endurance) - 3);
  });

  it('s’additionne à l’ignorance de PA d’un enchantement, sans être écrasée', () => {
    expect(qualityArmourBypasses(applyEnchants(malelameADeuxMains(), [{ id: 'e', bypass: 2 }]))).toEqual(['metal']);
  });

  it('usée jusqu’à l’Arme improvisée, elle perd sa décharge et ses effets à la touche (LDB 62 l.135)', () => {
    const c = cible(MAILLES);
    const improvisee = improvisedProfile(malelameADeuxMains());
    expect(improvisee.onHitEffects).toBeUndefined();
    // Même Blessures qu'une arme sans décharge usée de même : les PA de métal comptent (Atouts de l'improvisée).
    const temoin = improvisedProfile(weaponFromTrait({ id: 'arme', value: 8, arg: 'Électro-Lame' })!);
    expect(blessuresDe(improvisee, c)).toBe(blessuresDe(temoin, c));
    expect(blessuresDe(improvisee, c)).toBeLessThan(100 - bonus(c.characteristics.endurance));
  });
});
