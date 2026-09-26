import { describe, it, expect } from 'vitest';
import { combatBaseValue, combatValueMods, combatValue, defenseBaseValue, defenseValueMods, defenseValue, combineMods } from './combat';
import { skillBaseValue } from './skills';
import { COND } from './conditions';
import type { Characteristics, Combatant, ItemInstance, Weapon } from './types';

// F=30,E=30 → BF+BE = 6 → capacité d'Encombrement 6 (LDB 61 l.5) : `enc:14` = palier 2 (−20 Ag).
const chars = (over: Partial<Characteristics> = {}): Characteristics => ({
  'capacite-de-combat': 40, 'capacite-de-tir': 35, force: 30, endurance: 30, initiative: 30,
  agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, ...over,
});

const epee = { label: 'Épée', type: 'melee', subType: 'epee', damage: 4, qualities: [] } as unknown as Weapon;

function hero(opts: {
  advantage?: number;
  conditions?: { id: string; value: number }[];
  activeEffects?: Combatant['activeEffects'];
  skills?: Combatant['skills'];
  enc?: number;
} = {}): Combatant {
  const enc = opts.enc ?? 0;
  const items: ItemInstance[] = enc > 0 ? [{ uid: 'x', label: 'charge', kind: 'misc', qualities: [], enc, equipped: false }] : [];
  return {
    id: 'h', label: 'Sujet', kind: 'hero',
    characteristics: chars(),
    wounds: { current: 12, max: 12 },
    advantage: opts.advantage ?? 0,
    conditions: opts.conditions ?? [],
    activeEffects: opts.activeEffects,
    weapons: [epee],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items, skills: opts.skills ?? [], talents: [], movement: 4,
  } as unknown as Combatant;
}

const SKILLS_CC = [{ id: 'corps-a-corps', spec: 'epee', advances: 10 }] as unknown as Combatant['skills'];
const SKILLS_DODGE = [{ id: 'esquive', advances: 15 }] as unknown as Combatant['skills'];
const fx = (effects: { testModChar: string; testMod: number; testModMovementOnly?: boolean }[]) => effects as unknown as Combatant['activeEffects'];

describe('combatBaseValue — Niveau de Compétence NU (LDB 09 l.17)', () => {
  it('insensible à l’Avantage, à l’État et aux mods de Test char-qualifiés — = skillBaseValue', () => {
    const nu = hero({ skills: SKILLS_CC });
    const charge = hero({
      skills: SKILLS_CC,
      advantage: 3,
      conditions: [{ id: COND.empoisonne, value: 1 }],
      activeEffects: fx([{ testModChar: 'capacite-de-combat', testMod: -20 }]),
    });
    expect(combatBaseValue(charge, 'melee', epee)).toBe(50);
    expect(combatBaseValue(charge, 'melee', epee)).toBe(skillBaseValue(charge, 'corps-a-corps', 'epee', 'capacite-de-combat'));
    expect(combatBaseValue(charge, 'melee', epee)).toBe(combatBaseValue(nu, 'melee', epee));
    // La fondue, elle, PORTE le mod char-qualifié.
    expect(combatValue(charge, 'melee', epee)).toBe(30);
    expect(combatValue(nu, 'melee', epee)).toBe(50);
  });

  it('sans la Spé du Groupe (LDB 09 l.44) : Caractéristique nue', () => {
    const c = hero({ skills: [{ id: 'corps-a-corps', spec: 'baton', advances: 20 }] as unknown as Combatant['skills'] });
    expect(combatBaseValue(c, 'melee', epee)).toBe(40);
  });

  it('arme à résolution ALTERNATIVE (ADE II 8 l.233) : Caractéristique nommée, sans mod char-qualifié', () => {
    const belier = { label: 'Bélier', type: 'melee', resolveChar: 'force', damage: 6, qualities: [] } as unknown as Weapon;
    const c = hero({ skills: SKILLS_CC, activeEffects: fx([{ testModChar: 'force', testMod: -10 }]) });
    expect(combatBaseValue(c, 'melee', belier)).toBe(30);
    expect(combatValueMods(c, 'melee', belier)).toBe(0);
    expect(combatValue(c, 'melee', belier)).toBe(30);
  });
});

describe('identité combatValue = combatBaseValue + modificateurs (plafond −30 compris)', () => {
  const cases: { name: string; effects: { testModChar: string; testMod: number }[] }[] = [
    { name: 'aucun modificateur', effects: [] },
    { name: 'bonus +10', effects: [{ testModChar: 'capacite-de-combat', testMod: 10 }] },
    { name: 'malus −20', effects: [{ testModChar: 'capacite-de-combat', testMod: -20 }] },
    // PLAFOND ATTEINT : −40 cumulés. Ces modificateurs vivent DANS la valeur — les verser dans
    // `combineMods` les amputerait à −30 (cible dérivée de +10).
    { name: 'malus cumulés −40 (au-delà du plafond de Difficulté)', effects: [{ testModChar: 'capacite-de-combat', testMod: -20 }, { testModChar: 'capacite-de-combat', testMod: -20 }] },
    { name: 'malus cumulés −70', effects: [{ testModChar: 'capacite-de-combat', testMod: -50 }, { testModChar: 'capacite-de-combat', testMod: -20 }] },
  ];
  for (const cs of cases) {
    it(cs.name, () => {
      const c = hero({ skills: SKILLS_CC, advantage: 2, activeEffects: fx(cs.effects) });
      const mods = combatValueMods(c, 'melee', epee);
      expect(mods).toBe(cs.effects.reduce((s, e) => s + e.testMod, 0));
      expect(combatValue(c, 'melee', epee)).toBe(combatBaseValue(c, 'melee', epee) + mods);
    });
  }
  it('les modificateurs de la VALEUR échappent au plafond de Difficulté (LDB 14 l.91-96)', () => {
    const c = hero({ skills: SKILLS_CC, activeEffects: fx([{ testModChar: 'capacite-de-combat', testMod: -40 }]) });
    expect(combineMods([{ label: 'x', value: -40, famille: 'circonstance' }])).toBe(-30); // le plafond, LUI, ampute
    expect(combatValue(c, 'melee', epee)).toBe(10); // 50 − 40, PAS 50 − 30
  });
});

describe('defenseBaseValue / defenseValueMods — Esquive, Parade, substitution sociale', () => {
  it('Esquive : nue = Agilité + Augmentations ; mobilité et effets actifs sont des modificateurs', () => {
    const c = hero({ skills: SKILLS_DODGE, enc: 14, advantage: 4 }); // Encombrement palier 2 → −20
    expect(defenseBaseValue(c, 'esquive')).toBe(45);
    expect(defenseBaseValue(c, 'esquive')).toBe(skillBaseValue(c, 'esquive', undefined, 'agilite'));
    expect(defenseValueMods(c, 'esquive')).toBe(-20);
    expect(defenseValue(c, 'esquive')).toBe(25);
  });

  it('Esquive : mobilité −20 + effet « déplacement » −20 = −40 NON plafonné (identité préservée)', () => {
    const c = hero({ skills: SKILLS_DODGE, enc: 14, activeEffects: fx([{ testModChar: 'agilite', testMod: -20, testModMovementOnly: true }]) });
    expect(defenseValueMods(c, 'esquive')).toBe(-40);
    expect(defenseValue(c, 'esquive')).toBe(defenseBaseValue(c, 'esquive') + defenseValueMods(c, 'esquive'));
    expect(defenseValue(c, 'esquive')).toBe(5); // 45 − 40, PAS 45 − 30
  });

  it('Parade : nue = celle du Corps à corps avec l’arme parante ; Social : la base fournie, sans modificateur', () => {
    const c = hero({ skills: SKILLS_CC, activeEffects: fx([{ testModChar: 'capacite-de-combat', testMod: -10 }]) });
    expect(defenseBaseValue(c, 'parade', epee)).toBe(combatBaseValue(c, 'melee', epee));
    expect(defenseValue(c, 'parade', epee)).toBe(combatValue(c, 'melee', epee));
    expect(defenseBaseValue(c, 'social', undefined, 62)).toBe(62);
    expect(defenseValueMods(c, 'social')).toBe(0);
    expect(defenseValue(c, 'social', undefined, 62)).toBe(62);
  });
});
