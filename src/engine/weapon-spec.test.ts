import { describe, it, expect } from 'vitest';
import { combatValue, defenseValue, hasWeaponGroupSkill, weaponGroupSkillMode, weaponUnmastered } from './combat';
import type { Combatant, ItemInstance, Weapon } from './types';

/**
 * Jalon ② — la Spécialisation de Corps à corps / Projectiles compte enfin.
 * RAW : Compétences Groupées (LDB 09 l.141/409) ; les Augmentations ne valent QUE pour la
 * Spécialisation correspondant au Groupe de l'arme tenue (exemple Sigrid, LDB 09 l.44).
 */
function hero(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', label: 'H', kind: 'hero',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, items: [],
    ...over,
  } as Combatant;
}
const wpn = (subType: string, type: Weapon['type'] = 'melee'): Weapon =>
  ({ label: subType, type, damage: { plusBF: true, flat: 0, bare: true }, qualities: [], subType });

describe('combatValue — Spécialisation de Corps à corps (LDB 09 l.44)', () => {
  // `spec` = id de Groupe d'arme STABLE (Phase 3 : plus de libellé FR — cf. `SkillData.specsSource`).
  const sk = (spec: string, advances: number) =>
    ({ id: 'corps-a-corps', spec, characteristic: 'capacite-de-combat', advances } as Combatant['skills'][number]);

  it('les Augmentations comptent quand la Spé correspond au Groupe de l’arme', () => {
    const c = hero({ skills: [sk('base', 20)] });
    expect(combatValue(c, 'melee', wpn('base'))).toBe(60); // CC 40 + 20 (Base)
  });

  it('sans la bonne Spé, on teste sur la Caractéristique brute (Sigrid)', () => {
    const c = hero({ skills: [sk('base', 20)] }); // entraîné en Base seulement
    expect(combatValue(c, 'melee', wpn('escrime'))).toBe(40); // CC 40, +20 ne s’applique PAS
  });

  it('Groupe d’arme « Deux-mains » ↔ Spé « À deux mains » (l.144)', () => {
    const c = hero({ skills: [sk('deux-mains', 15)] });
    expect(combatValue(c, 'melee', wpn('deux-mains'))).toBe(55); // CC 40 + 15
    // un escrimeur ne profite PAS de sa Spé Escrime avec une arme à deux mains
    const esc = hero({ skills: [sk('escrime', 15)] });
    expect(combatValue(esc, 'melee', wpn('deux-mains'))).toBe(40);
  });

  it('plusieurs Spés : seule celle du Groupe tenu s’applique', () => {
    const c = hero({ skills: [sk('base', 10), sk('deux-mains', 25)] });
    expect(combatValue(c, 'melee', wpn('base'))).toBe(50);
    expect(combatValue(c, 'melee', wpn('deux-mains'))).toBe(65);
  });

  it('arme omise (créature, affichage) → meilleure Spé disponible (historique)', () => {
    const c = hero({ skills: [sk('base', 10), sk('escrime', 25)] });
    expect(combatValue(c, 'melee')).toBe(65); // 40 + max(10,25)
  });

  it('Parade utilise la Spé de l’arme parante (defenseValue)', () => {
    const c = hero({ skills: [sk('escrime', 30)], weapons: [wpn('escrime')] });
    expect(defenseValue(c, 'parade')).toBe(70); // 40 + 30, arme = weapons[0]
    const cBase = hero({ skills: [sk('escrime', 30)], weapons: [wpn('base')] });
    expect(defenseValue(cBase, 'parade')).toBe(40); // pas d’Escrime sur une arme Base
  });
});

describe('combatValue — Spécialisation de Projectiles (LDB 62 l.180/184)', () => {
  const sk = (spec: string, advances: number) =>
    ({ id: 'projectiles', spec, characteristic: 'capacite-de-tir', advances } as Combatant['skills'][number]);

  it('les Augmentations comptent pour le bon Groupe à distance', () => {
    const c = hero({ skills: [sk('arc', 18)] });
    expect(combatValue(c, 'ranged', wpn('arc', 'ranged'))).toBe(58); // CT 40 + 18
  });

  it('Projectiles (Poudre noire) ne s’applique pas à un Arc (l.225)', () => {
    const c = hero({ skills: [sk('poudre-noire', 18)] });
    expect(combatValue(c, 'ranged', wpn('arc', 'ranged'))).toBe(40);
  });

  it('Projectiles (Ingénierie) couvre Poudre noire et Explosifs (l.234)', () => {
    const c = hero({ skills: [sk('ingenierie', 22)] });
    expect(combatValue(c, 'ranged', wpn('poudre-noire', 'ranged'))).toBe(62);
    expect(combatValue(c, 'ranged', wpn('explosifs', 'ranged'))).toBe(62);
    expect(combatValue(c, 'ranged', wpn('poudre-noire-et-ingenierie', 'ranged'))).toBe(62);
    // mais pas un Arc
    expect(combatValue(c, 'ranged', wpn('arc', 'ranged'))).toBe(40);
  });
});

describe('combatValue/weaponGroupSkillMode — exceptions Groupes d’Armes à distance (LDB 62 l.184-192)', () => {
  const sk = (spec: string, advances: number) =>
    ({ id: 'projectiles', spec, characteristic: 'capacite-de-tir', advances } as Combatant['skills'][number]);

  it('Arbalète/Lancer tirés avec N’IMPORTE QUELLE Spé de Tir → bonus intégral, mode dégradé (l.184)', () => {
    const c = hero({ skills: [sk('arc', 18)] });
    expect(combatValue(c, 'ranged', wpn('arbalete', 'ranged'))).toBe(58); // CT 40 + 18 (Compétence de Tir)
    expect(weaponGroupSkillMode(c, wpn('arbalete', 'ranged'), 'ranged')).toBe('degraded');
    expect(combatValue(c, 'ranged', wpn('lancer', 'ranged'))).toBe(58);
    expect(weaponGroupSkillMode(c, wpn('lancer', 'ranged'), 'ranged')).toBe('degraded');
    // dégradé ≠ « Spé du Groupe » (AA 10 l.228-247, Qualification d'Arme d'équipe) : `hasWeaponGroupSkill`
    // reste strict — seul un match PLEIN qualifie une pièce servie.
    expect(hasWeaponGroupSkill(c, wpn('arbalete', 'ranged'), 'ranged')).toBe(false);
  });

  it('Arbalète tirée avec la Spé Arbalète elle-même → mode plein (pas de dégradation)', () => {
    const c = hero({ skills: [sk('arbalete', 25)] });
    expect(combatValue(c, 'ranged', wpn('arbalete', 'ranged'))).toBe(65);
    expect(weaponGroupSkillMode(c, wpn('arbalete', 'ranged'), 'ranged')).toBe('full');
  });

  it('sans AUCUNE Spé de Projectiles → mode none, carac brute', () => {
    const c = hero({ skills: [] });
    expect(combatValue(c, 'ranged', wpn('arbalete', 'ranged'))).toBe(40);
    expect(weaponGroupSkillMode(c, wpn('arbalete', 'ranged'), 'ranged')).toBe('none');
    expect(hasWeaponGroupSkill(c, wpn('arbalete', 'ranged'), 'ranged')).toBe(false);
  });

  it('Ingénierie utilisée via Poudre noire → bonus intégral, mode dégradé (l.188)', () => {
    const c = hero({ skills: [sk('poudre-noire', 20)] });
    expect(combatValue(c, 'ranged', wpn('ingenierie', 'ranged'))).toBe(60);
    expect(weaponGroupSkillMode(c, wpn('ingenierie', 'ranged'), 'ranged')).toBe('degraded');
  });

  it('Ingénierie utilisée via Ingénierie elle-même → mode plein', () => {
    const c = hero({ skills: [sk('ingenierie', 12)] });
    expect(combatValue(c, 'ranged', wpn('ingenierie', 'ranged'))).toBe(52);
    expect(weaponGroupSkillMode(c, wpn('ingenierie', 'ranged'), 'ranged')).toBe('full');
  });

  it('Poudre noire/Explosifs via Ingénierie reste SANS pénalité (non-régression, l.192)', () => {
    const c = hero({ skills: [sk('ingenierie', 22)] });
    expect(weaponGroupSkillMode(c, wpn('poudre-noire', 'ranged'), 'ranged')).toBe('full');
    expect(weaponGroupSkillMode(c, wpn('explosifs', 'ranged'), 'ranged')).toBe('full');
  });
});

describe('combatValue — résolution ALTERNATIVE déclarée par l\'arme (bélier → Force, ADE II 8 l.233)', () => {
  it('weapon.resolveChar court-circuite CC (mêlée) et ignore toute Spé de Corps à corps', () => {
    const c = hero({ skills: [{ id: 'corps-a-corps', spec: 'base', characteristic: 'capacite-de-combat', advances: 30 }], characteristics: { ...hero().characteristics, 'capacite-de-combat': 40, force: 55 } });
    const belier: Weapon = { label: 'Bélier', type: 'melee', damage: { plusBF: true, flat: 10 }, reach: 'Moyenne', qualities: [], resolveChar: 'force' };
    expect(combatValue(c, 'melee', belier)).toBe(55); // Force brute (55), PAS CC+Spé (40+30=70)
  });

  it('sans resolveChar, une arme de mêlée résout normalement sur CC (non-régression)', () => {
    const c = hero({ characteristics: { ...hero().characteristics, 'capacite-de-combat': 40, force: 55 } });
    const epee: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
    expect(combatValue(c, 'melee', epee)).toBe(40);
  });
});

describe('Arme inhabituelle — maîtrise requise (ACE 12 l.17 « Entraînement avec une arme inhabituelle »)', () => {
  const sk = (spec: string, advances: number) =>
    ({ id: 'corps-a-corps', spec, characteristic: 'capacite-de-combat', advances } as Combatant['skills'][number]);
  const item: ItemInstance = {
    uid: 'u1', trappingId: 'couteau-de-harald', label: 'Couteau de Harald', kind: 'melee',
    qualities: [], enc: 0, equipped: true, requiresMastery: true,
  };
  const w: Weapon = { ...wpn('base'), uid: 'u1' };

  it('non maîtrisée : carac brute (mécanique LDB 09 l.44) + Groupe réputé NON couvert (Défauts contextuels)', () => {
    const c = hero({ skills: [sk('base', 20)], items: [item] });
    expect(weaponUnmastered(c, w)).toBe(true);
    expect(combatValue(c, 'melee', w)).toBe(40); // CC 40, les +20 (Base) ne s'appliquent PAS
    expect(hasWeaponGroupSkill(c, w, 'melee')).toBe(false);
  });

  it('maîtrisée (masteredWeapons, par id de trapping) : la Spé du Groupe compte à nouveau', () => {
    const c = hero({ skills: [sk('base', 20)], items: [item], masteredWeapons: ['couteau-de-harald'] });
    expect(weaponUnmastered(c, w)).toBe(false);
    expect(combatValue(c, 'melee', w)).toBe(60);
    expect(hasWeaponGroupSkill(c, w, 'melee')).toBe(true);
  });

  it('arme ordinaire (sans requiresMastery) ou hors inventaire (créature) : gate inerte', () => {
    const c = hero({ skills: [sk('base', 20)], items: [{ ...item, requiresMastery: undefined }] });
    expect(combatValue(c, 'melee', w)).toBe(60);
    const noItems = hero({ skills: [sk('base', 20)] });
    expect(weaponUnmastered(noItems, w)).toBe(false); // uid non retrouvé → inerte
  });
});

// #193 — Épaule luxée (LDB/AA) : « Tests effectués avec ce bras » subissent -10 pendant 1d10 jours.
// `recoverDisabledLimb` scope le testMod{char:'CC'} à la main du membre (weaponHand) — PAS l'autre main.
describe('combatValue/defenseValue — testMod{char} scopé par main (#193, weaponHand)', () => {
  const withPenalty = (hand: 'main' | 'off') => hero({
    activeEffects: [{ label: 'Épaule luxée (récupération)', bonus: 0, duration: { scale: 'permanent' }, testMod: -10, testModChar: 'capacite-de-combat', testModHand: hand }],
  });

  it("pénalise l'attaque/parade avec l'arme tenue dans LA main visée (main)", () => {
    const c = withPenalty('main');
    expect(combatValue(c, 'melee', { ...wpn('base'), hand: 'main' })).toBe(30); // CC 40 − 10
    expect(defenseValue(c, 'parade', { ...wpn('base'), hand: 'main' })).toBe(30);
  });

  it("laisse INTACTE l'arme tenue dans L'AUTRE main (off)", () => {
    const c = withPenalty('main');
    expect(combatValue(c, 'melee', { ...wpn('base'), hand: 'off' })).toBe(40); // pas de −10
  });

  it('sans arme (weapon absent, manœuvre générique) : le mod hand-scopé ne s’applique pas (info manquante)', () => {
    const c = withPenalty('main');
    expect(combatValue(c, 'melee')).toBe(40);
  });
});

// #193 — Genou démis (LDB/AA) : « Tests impliquant cette jambe » subissent -10 pendant 1d10 jours —
// scopé aux Tests classés « déplacement » (SkillData.movement), Esquive INCLUSE (defenseValue).
describe('defenseValue — Esquive scopée par movementOnly (#193)', () => {
  it('Esquive (Test de déplacement) subit le malus', () => {
    const c = hero({
      activeEffects: [{ label: 'Genou démis (récupération)', bonus: 0, duration: { scale: 'permanent' }, testMod: -10, testModChar: 'agilite', testModMovementOnly: true }],
      skills: [{ id: 'esquive', characteristic: 'agilite', advances: 0 }],
    });
    expect(defenseValue(c, 'esquive')).toBe(30); // Ag 40 − 10
  });
});
