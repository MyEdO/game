import { describe, it, expect } from 'vitest';
import type { Combatant, Weapon } from './types';
import { skillAdvantageCap, combatAdvantageSkills, combatSubstitute, fearsBy } from './skillCombatApps';
import { defenseValue, defenseModifiers, rollMeleeDefender, finishMelee } from './combat';
import { skillBaseValue } from './skills';
import { makeRNG } from './dice';

function mk(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'a', name: 'A', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 40, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 45, 'force-mentale': 30, sociabilite: 38 },
    conditions: [], activeEffects: [], skills: [], talents: [], traits: [], psychState: [],
    weapons: [], armour: [], wounds: { current: 10, max: 10 }, advantage: 0,
    ...over,
  } as unknown as Combatant;
}

describe('Applications de combat — cumuler l’Avantage (LDB 09 l.305-308)', () => {
  it('Intuition (base) : plafond = Bonus d’Intelligence (Int 45 → 4)', () => {
    const c = mk();
    expect(skillAdvantageCap(c, 'intuition')).toBe(4); // Base : possédée sans Augmentation
  });
  it('Prière (avancée) : plafond = Bonus de Sociabilité, mais SEULEMENT si possédée', () => {
    const sansPriere = mk();
    expect(skillAdvantageCap(sansPriere, 'priere')).toBe(0); // avancée non prise → 0
    const avecPriere = mk({ skills: [{ id: 'priere', advances: 5 } as never] });
    expect(skillAdvantageCap(avecPriere, 'priere')).toBe(3); // Bonus Soc 38 → 3
  });
  it('une Compétence sans application « Avantage » → 0', () => {
    expect(skillAdvantageCap(mk(), 'corps-a-corps')).toBe(0);
  });
  it('combatAdvantageSkills liste les Compétences possédées éligibles', () => {
    const c = mk({ skills: [{ id: 'intuition', advances: 0 } as never, { id: 'savoir', advances: 2 } as never] });
    const ids = combatAdvantageSkills(c).map((s) => s.skillId).sort();
    expect(ids).toEqual(['intuition', 'savoir']);
  });
});

describe('Applications de combat — substitution sociale (LDB 09 l.207/287)', () => {
  const defender = () => mk({ id: 'def', skills: [{ id: 'intimidation', advances: 4 } as never] });
  const attacker = (fearsDef: boolean) => mk({
    id: 'atk',
    psychState: fearsDef ? [{ type: 'peur', sourceId: 'def', indice: 2, calmeDR: 0 } as never] : [],
  });

  it('gate `fear` : l’adversaire doit avoir Peur SOURCÉE par le personnage', () => {
    expect(fearsBy(attacker(true), defender())).toBe(true);
    expect(fearsBy(attacker(false), defender())).toBe(false);
  });
  it('Intimidation substitue Corps à corps en DÉFENSE quand l’attaquant a peur du défenseur', () => {
    const sub = combatSubstitute(defender(), attacker(true), 'defense');
    expect(sub?.skillId).toBe('intimidation');
    expect(sub?.value).toBe(44); // F 40 + 4 Augmentations
  });
  it('pas de peur → pas de substitution', () => {
    expect(combatSubstitute(defender(), attacker(false), 'defense')).toBeNull();
  });
  it('substitution aussi en ATTAQUE (role both) contre une cible effrayée', () => {
    const sub = combatSubstitute(defender(), attacker(true), 'attack');
    expect(sub?.skillId).toBe('intimidation');
  });
  it('sans la Compétence sociale → pas de substitution', () => {
    const plainDef = mk({ id: 'def' });
    expect(combatSubstitute(plainDef, attacker(true), 'defense')).toBeNull();
  });
  it('la valeur de substitution == skillBaseValue (source UNIQUE offre==résolution)', () => {
    const d = defender();
    expect(combatSubstitute(d, attacker(true), 'defense')!.value).toBe(skillBaseValue(d, 'intimidation'));
  });
});

describe('Mode de défense « social » branché dans le moteur (LDB 09 l.287)', () => {
  const fist: Weapon = { name: 'Mains nues', type: 'melee', damage: 0, group: 'brawling', qualities: [] } as unknown as Weapon;
  const defender = () => mk({ id: 'def', weapons: [fist], skills: [{ id: 'intimidation', advances: 4 } as never], dualStrikeDefensePenalty: true });
  const attacker = () => mk({ id: 'atk', weapons: [fist], psychState: [{ type: 'peur', sourceId: 'def', indice: 2, calmeDR: 0 } as never] });

  it('defenseValue(social) renvoie la base sociale fournie, pas Corps à corps ni Agilité', () => {
    expect(defenseValue(defender(), 'social', undefined, 44)).toBe(44);
    expect(defenseValue(defender(), 'social', undefined, undefined)).toBe(0);
  });
  it('defenseModifiers(social) : ni « Main secondaire », ni « Neige », ni « Maniement deux armes »', () => {
    const mods = defenseModifiers(defender(), 'social', [{ label: 'Neige épaisse', value: -30, famille: 'circonstance' }] /*neige ignorée*/, defender().weapons[0]);
    expect(mods.some((m) => m.label === 'Maniement deux armes')).toBe(false);
    expect(mods.some((m) => m.label === 'Main secondaire')).toBe(false);
    expect(mods.some((m) => m.label === 'Neige épaisse')).toBe(false);
  });
  it('finishMelee(social) : le breakdown défenseur porte le libellé + la base de la Compétence', () => {
    const def = defender(); const atk = attacker();
    const sub = combatSubstitute(def, atk, 'defense')!;
    const dRoll = rollMeleeDefender(def, 'social', makeRNG(1), [], undefined, atk.weapons[0], { base: sub.value, label: 'Intimidation' });
    const aRoll = { roll: 55, target: 40, success: false, sl: -1, isDouble: false };
    const res = finishMelee(atk, def, atk.weapons[0], aRoll, dRoll, 'social', { rng: makeRNG(1595) }, undefined, [], [], undefined, undefined, false, { base: sub.value, label: 'Intimidation' });
    expect(res.defenderDetail?.mode).toBe('social');
    expect(res.defenderDetail?.label).toBe('Intimidation');
    expect(res.defenderDetail?.base).toBe(sub.value); // = F + Augmentations d'Intimidation
  });
});
