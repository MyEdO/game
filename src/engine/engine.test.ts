import { describe, it, expect } from 'vitest';
import { makeRNG, RNG } from './dice';
import { addCondition, combatTestPenalty, meleeAttackerBonus, cannotDefend } from './conditions';
import { parseQualityInstance } from './qualities/normalize';
import { evaluateTest, resolveOpposed } from './tests';
import { bonus, maxWounds } from './characteristics';
import { effectiveWeaponDamage } from './weaponDamage';
import {
  reverseRoll,
  hitLocation,
  hitLocationByShape,
  shipHitLocation,
  locationLabel,
  resolveMelee,
  rangeBandModifier,
  rollMeleeAttacker,
  rollMeleeDefender,
  finishMelee,
  resolveMeleePassive,
  woundsFromHit,
} from './combat';
import { objetDeTest, type SurchargeDObjet } from './objetDeTest.testkit';

describe('Portée des tirs (table des Difficultés, 14 - _GoBack.md l.82-118 ; 1 case = 2 m)', () => {
  it('Bout portant +40, Courte +20, Moyenne +0, Longue −10, Extrême −30, au-delà = null', () => {
    const R = 50; // Arc : Portée 50 m
    expect(rangeBandModifier(2, R)).toBe(40); // 4 m ≤ 5 (÷10) — Bout portant
    expect(rangeBandModifier(10, R)).toBe(20); // 20 m ≤ 25 (÷2) — Courte
    expect(rangeBandModifier(24, R)).toBe(0); // 48 m ≤ 50 (×1) — Moyenne
    expect(rangeBandModifier(40, R)).toBe(-10); // 80 m ≤ 100 (×2) — Longue (l.99)
    expect(rangeBandModifier(70, R)).toBe(-30); // 140 m ≤ 150 (×3) — Extrême (l.118)
    expect(rangeBandModifier(80, R)).toBeNull(); // 160 m > 150 → hors de portée
  });
});

describe("Atouts d'arme (LDB Les armes)", () => {
  const rngOf = (roll: number): RNG => ({ int: () => roll });
  const fighter = (cc: number, weapon: Partial<Weapon> = {}): Combatant =>
    ({
      id: 'a',
      name: 'a',
      kind: 'enemy',
      characteristics: { 'capacite-de-combat': cc, 'capacite-de-tir': cc, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      wounds: { current: 20, max: 20 },
      advantage: 0,
      conditions: [],
      weapons: [{ label: 'W', type: 'melee', damage: { plusBF: false, flat: 5 }, qualities: [], ...weapon } as Weapon],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      skills: [],
      talents: [],
      movement: 4,
    }) as unknown as Combatant;

  it('Perforante ignore 1 PA (→ +1 Blessure)', () => {
    const def = fighter(30);
    def.armour.brasD = 3; // jet 44 → reverseRoll 44 → Bras droit
    const hit = (q: string[]) => {
      const atk = fighter(50, { qualities: q.map((s) => parseQualityInstance(s)!), damage: { plusBF: false, flat: 10 } });
      return resolveMelee(atk, def, atk.weapons[0], rngOf(44), { defense: 'none' });
    };
    expect(hit(['Perforante']).woundsLost! - hit([]).woundsLost!).toBe(1);
  });
  describe('Perforante — matériau (LDB 62 l.270)', () => {
    const arme = (perforante: boolean): Weapon =>
      ({ label: 'W', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: perforante ? [{ id: 'perforante' }] : [] } as unknown as Weapon);
    const piece = (over: SurchargeDObjet): ItemInstance =>
      objetDeTest({ uid: over.uid ?? 'i', trappingId: 'plastron', kind: 'armor', locs: ['corps'], equipped: true, qualities: [], ...over });
    const target = (armourCorps: number, items: ItemInstance[] = []): Combatant => {
      const t = fighter(30);
      t.armour.corps = armourCorps;
      t.items = items;
      return t;
    };

    it('cuir souple PA 1 + cotte de mailles PA 3 (même localisation) → 2 PA effectifs', () => {
      const t = target(4, [piece({ uid: 'l', subType: 'cuir-souple', pa: 1 }), piece({ uid: 'm', subType: 'mailles', pa: 3 })]);
      expect(woundsFromHit(arme(true), t, 'corps', 100, 0, 1, undefined)).toBe(100 - 3 - 2);
    });
    it('cuir seul PA 2 → 0 (tout le cuir ignoré)', () => {
      const t = target(2, [piece({ uid: 'l', subType: 'cuir-souple', pa: 2 })]);
      expect(woundsFromHit(arme(true), t, 'corps', 100, 0, 1, undefined)).toBe(100 - 3 - 0);
    });
    it('mailles seules PA 3 → 2 (le « premier point », UNE fois)', () => {
      const t = target(3, [piece({ uid: 'm', subType: 'mailles', pa: 3 })]);
      expect(woundsFromHit(arme(true), t, 'corps', 100, 0, 1, undefined)).toBe(100 - 3 - 2);
    });
    it('deux pièces MÉTALLIQUES PA 2 + PA 2 → 3, pas 2 (retrait plat, pas par couche)', () => {
      const t = target(4, [piece({ uid: 'm1', subType: 'mailles', pa: 2 }), piece({ uid: 'm2', subType: 'plate', pa: 2 })]);
      expect(woundsFromHit(arme(true), t, 'corps', 100, 0, 1, undefined)).toBe(100 - 3 - 3);
    });
    it('armure NATURELLE (PA hors item porté) PA 3 → 2 (matériau inconnu NON ignoré, #1255)', () => {
      const t = target(3, []);
      expect(woundsFromHit(arme(true), t, 'corps', 100, 0, 1, undefined)).toBe(100 - 3 - 2);
    });
    it('arme SANS Perforante → aucune des valeurs ci-dessus ne bouge (retrait plat + bypass inertes)', () => {
      const t = target(4, [piece({ uid: 'l', subType: 'cuir-souple', pa: 1 }), piece({ uid: 'm', subType: 'mailles', pa: 3 })]);
      expect(woundsFromHit(arme(false), t, 'corps', 100, 0, 1, undefined)).toBe(100 - 3 - 4);
    });
  });
  // Pointue, LDB 62 l.288 : « Gagnez un bonus de +1 DR à tout Test réussi quand vous attaquez avec
  // cette arme. » Le contrat porte sur le DR DU TEST — l'opposition, l'Avantage et les Dégâts en dérivent.
  const duel = (q: string[], cc: number, defCC: number, roll: number) => {
    const atk = fighter(cc, { qualities: q.map((s) => parseQualityInstance(s)!) });
    return resolveMelee(atk, fighter(defCC), atk.weapons[0], rngOf(roll), { defense: 'parade' });
  };
  it('Pointue : +1 DR au Test opposé RÉUSSI — CC 50 vs CC 50, jet 44 (témoin Imprécise au même seam)', () => {
    const base = duel([], 50, 50, 44); // DR 1 contre DR 1
    expect([base.hit, base.netSL, base.advantageTo]).toEqual([false, 0, null]);
    const pointue = duel(['Pointue'], 50, 50, 44); // DR 2 contre DR 1
    expect([pointue.hit, pointue.netSL, pointue.advantageTo]).toEqual([true, 1, 'attacker']);
    const imprecise = duel(['Imprécise'], 50, 50, 44); // DR 0 contre DR 1 (LDB 62 l.323)
    expect([imprecise.hit, imprecise.netSL, imprecise.advantageTo]).toEqual([false, 1, 'defender']);
  });
  it('Pointue : MUET sur un Test d’attaque RATÉ (CC 40 vs CC 30, jet 45 — l’attaquant l’emporte en échouant)', () => {
    expect(duel([], 40, 30, 45).netSL).toBe(1);
    expect(duel(['Pointue'], 40, 30, 45).netSL).toBe(1);
  });
  it('Pointue : le DR du Test alimente les Dégâts (attaque non opposée → +1 Blessure)', () => {
    const def = fighter(30);
    const hit = (q: string[]) => {
      const atk = fighter(50, { qualities: q.map((s) => parseQualityInstance(s)!) });
      return resolveMelee(atk, def, atk.weapons[0], rngOf(44), { defense: 'none' });
    };
    expect(hit(['Pointue']).netSL - hit([]).netSL).toBe(1);
    expect(hit(['Pointue']).woundsLost! - hit([]).woundsLost!).toBe(1);
  });
  it('Empaleuse : Critique sur un multiple de 10', () => {
    const emp = fighter(60, { qualities: [{ id: 'empaleuse' }] });
    const r = resolveMelee(emp, fighter(30), emp.weapons[0], rngOf(20), { defense: 'none' });
    expect(r.hit).toBe(true);
    expect(r.critical).toBe(true);
    const plain = fighter(60);
    expect(resolveMelee(plain, fighter(30), plain.weapons[0], rngOf(20), { defense: 'none' }).critical).toBe(false);
  });
  it("Précise : +10 au Test (touche là où l'arme nue échoue, même jet)", () => {
    const def = fighter(30);
    const plain = fighter(40); // CC 40, jet 45 → échec
    const prec = fighter(40, { qualities: [{ id: 'precise' }] }); // +10 → cible 50, jet 45 → réussite
    expect(resolveMelee(plain, def, plain.weapons[0], rngOf(45), { defense: 'none' }).hit).toBe(false);
    expect(resolveMelee(prec, def, prec.weapons[0], rngOf(45), { defense: 'none' }).hit).toBe(true);
  });
});

describe('Découpe de la résolution de mêlée (split attaquant/défenseur)', () => {
  const fighter = (cc: number, weapon: Partial<Weapon> = {}): Combatant =>
    ({
      id: 'x',
      name: 'x',
      kind: 'enemy',
      characteristics: { 'capacite-de-combat': cc, 'capacite-de-tir': cc, force: 30, endurance: 30, initiative: 30, agilite: 35, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      wounds: { current: 20, max: 20 },
      advantage: 0,
      conditions: [],
      weapons: [{ label: 'W', type: 'melee', damage: { plusBF: false, flat: 5 }, qualities: [], ...weapon } as Weapon],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      skills: [],
      talents: [],
      movement: 4,
    }) as unknown as Combatant;

  it('resolveMelee ≡ rollMeleeAttacker → rollMeleeDefender → finishMelee (Parade, même seed, même ordre RNG)', () => {
    const a = fighter(55);
    const d = fighter(45);
    const full = resolveMelee(a, d, a.weapons[0], makeRNG(7), { defense: 'parade' });
    const rng = makeRNG(7);
    const atk = rollMeleeAttacker(a, d, a.weapons[0], rng);
    const def = rollMeleeDefender(d, 'parade', rng);
    expect(finishMelee(a, d, a.weapons[0], atk, def, 'parade')).toEqual(full);
  });
  it('resolveMelee ≡ split (Esquive)', () => {
    const a = fighter(55);
    const d = fighter(45);
    const full = resolveMelee(a, d, a.weapons[0], makeRNG(11), { defense: 'esquive' });
    const rng = makeRNG(11);
    const atk = rollMeleeAttacker(a, d, a.weapons[0], rng);
    const def = rollMeleeDefender(d, 'esquive', rng);
    expect(finishMelee(a, d, a.weapons[0], atk, def, 'esquive')).toEqual(full);
  });
  it('le jet d’attaque est FIGÉ : même atk + def différents → même attackerRoll, defenderRoll différents', () => {
    const a = fighter(55);
    const d = fighter(45);
    const atk = rollMeleeAttacker(a, d, a.weapons[0], makeRNG(3));
    const def1 = rollMeleeDefender(d, 'parade', makeRNG(20));
    const def2 = rollMeleeDefender(d, 'parade', makeRNG(99));
    const r1 = finishMelee(a, d, a.weapons[0], atk, def1, 'parade');
    const r2 = finishMelee(a, d, a.weapons[0], atk, def2, 'parade');
    expect(r1.attackerRoll).toBe(atk.roll);
    expect(r2.attackerRoll).toBe(atk.roll); // l'attaque ne change pas quand on relance la défense
    expect(r1.defenderRoll).not.toBe(r2.defenderRoll);
  });
  it('resolveMeleePassive : un succès touche, un échec rate (Avantage au défenseur)', () => {
    const a = fighter(80);
    const d = fighter(30);
    const hit = resolveMeleePassive(a, d, a.weapons[0], { roll: 5, target: 80, success: true, sl: 7, isDouble: false });
    expect(hit.hit).toBe(true);
    const miss = resolveMeleePassive(a, d, a.weapons[0], { roll: 95, target: 80, success: false, sl: -2, isDouble: false });
    expect(miss.hit).toBe(false);
    expect(miss.advantageTo).toBe('defender');
  });
});

describe('Sur la défensive (+20 en défense, LDB Combat l.118)', () => {
  const rngOf = (roll: number): RNG => ({ int: () => roll });
  const mk = (cc: number, opts: Partial<Combatant> = {}): Combatant =>
    ({
      id: 'c',
      name: 'c',
      kind: 'enemy',
      characteristics: { 'capacite-de-combat': cc, 'capacite-de-tir': cc, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      wounds: { current: 20, max: 20 },
      advantage: 0,
      conditions: [],
      weapons: [{ name: 'W', type: 'melee', damage: { plusBF: false, flat: 5 }, qualities: [] }],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      skills: [],
      talents: [],
      movement: 4,
      ...opts,
    }) as unknown as Combatant;
  it('un défenseur sur la défensive est plus dur à toucher (même jet)', () => {
    // Le +20 se mesure sur le DR de la défense (l.118), jamais sur un départage d'égalité : à CC 40,
    // le défenseur passe de DR 0 (cible 40) à DR 2 (cible 60) sur le même dé, et dépasse l'attaquant.
    const atk = mk(50);
    const open = mk(40); // Parade = CC 40
    const guard = mk(40, { defensiveStance: true }); // +20 → 60
    expect(resolveMelee(atk, open, atk.weapons[0], rngOf(40), { defense: 'parade' }).hit).toBe(true);
    expect(resolveMelee(atk, guard, atk.weapons[0], rngOf(40), { defense: 'parade' }).hit).toBe(false);
  });
});

describe('États en combat (LDB 16)', () => {
  const mkc = (): Combatant => ({ conditions: [] } as unknown as Combatant);
  it('pénalité de combat non-cumul : la pire pénalité d’un seul État', () => {
    const c = mkc();
    addCondition(c, 'extenue', 3); // -30
    addCondition(c, 'aveugle'); // -10
    expect(combatTestPenalty(c)).toBe(-30); // pas -40 (non-cumul)
  });
  it('bonus d’attaquant : À Terre +20 prime sur Aveuglé +10', () => {
    const t = mkc();
    addCondition(t, 'a-terre');
    addCondition(t, 'aveugle');
    expect(meleeAttackerBonus(t)).toBe(20);
  });
  it('Surpris empêche de se défendre', () => {
    const t = mkc();
    addCondition(t, 'surpris');
    expect(cannotDefend(t)).toBe(true);
  });
  it('Empoisonné : endOfRound n’applique PLUS les dégâts (migrés en données — effects onRoundEnd → wounds {stacks})', () => {
    const c = { name: 'x', conditions: [], characteristics: { endurance: 30 }, skills: [], wounds: { current: 10, max: 10 } } as unknown as Combatant;
    addCondition(c, 'empoisonne', 2);
    endOfRound(c);
    // Dégâts de poison désormais data-driven (etats.json + fireConditionEffects, cf. state/etat-perround.test) :
    // endOfRound ne les applique plus → PB inchangés ici.
    expect(c.wounds.current).toBe(10);
  });
  it('En Flammes : endOfRound n’applique PLUS les dégâts (migrés en données — effects onRoundEnd → wounds {sum})', () => {
    const c = {
      name: 'x',
      conditions: [],
      characteristics: { endurance: 70 },
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      wounds: { current: 20, max: 20 },
    } as unknown as Combatant;
    addCondition(c, 'en-flammes', 3);
    endOfRound(c, { int: () => 4 }); // dégâts de feu désormais data-driven (cf. state/etat-perround.test)
    expect(c.wounds.current).toBe(20); // endOfRound seul : aucun dégât de feu
  });
  it('Sonné : endOfRound NE touche plus le Sonné — Test de Résistance migré en DONNÉES (l.125-127)', () => {
    const c = {
      name: 'x',
      conditions: [],
      skills: [],
      characteristics: { endurance: 50 },
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      wounds: { current: 10, max: 10 },
    } as unknown as Combatant;
    addCondition(c, 'sonne', 2);
    endOfRound(c, { int: () => 5 }); // la Résistance au Sonné est `effects: onRoundEnd test` (etats.json), résolue par le dispatcher
    expect(c.conditions.some((x) => x.id === 'sonne')).toBe(true);   // endOfRound ne retire aucun pion (cf. state/round-upkeep-cascade.test)
    expect(c.conditions.some((x) => x.id === 'extenue')).toBe(false);
  });
});

describe('Avantage en combat (LDB Déplacement l.37 : +10 par point)', () => {
  const rngOf = (roll: number): RNG => ({ int: () => roll });
  const mk = (cc: number, advantage = 0): Combatant => ({
    id: 'c',
    label: 'c',
    kind: 'enemy',
    characteristics: { 'capacite-de-combat': cc, 'capacite-de-tir': cc, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 10 },
    advantage,
    conditions: [],
    weapons: [{ label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
  });
  it('1 Avantage (+10) fait toucher là où 0 Avantage échoue (cible nue, même jet)', () => {
    const target = mk(30);
    // CC 40, jet 45 : sans Avantage cible=40 → échec ; +1 Avantage cible=50 → réussite.
    const a0 = resolveMelee(mk(40, 0), target, mk(40).weapons[0], rngOf(45), { defense: 'none' });
    const a1 = resolveMelee(mk(40, 1), target, mk(40).weapons[0], rngOf(45), { defense: 'none' });
    expect(a0.hit).toBe(false);
    expect(a1.hit).toBe(true);
  });
});
import { createHero } from './character';
import { DIFFICULTY_MODIFIERS } from './types';
import type { ActiveEffect, Characteristics, Combatant, ItemInstance, SkillInstance, Weapon } from './types';
import { effectiveChar } from './characteristics';
import { endOfRound } from './conditions';
import {
  castInfo,
  castingValue,
  missileDamage,
  durationClockMinutes,
  isMagicMissile,
  isArcaneSpell,
  knowsCastingSkill,
  resolveCasting,
  resolveMagicMissile,
  resolveFocus,
  castTestTalentDR,
  resolveCounterspell,
  isDispellableSpell,
  type SpellLike,
} from './magic';
import { rollMiscast } from './miscast';

describe('Tests & DR', () => {
  it('réussite si jet ≤ cible, DR = différence des dizaines', () => {
    // cible 45, jet 23 → succès, DR = 4 - 2 = 2
    const r = evaluateTest(23, 45);
    expect(r.success).toBe(true);
    expect(r.sl).toBe(2);
  });
  it('échec donne un DR négatif', () => {
    const r = evaluateTest(67, 45); // dizaines 4 - 6 = -2
    expect(r.success).toBe(false);
    expect(r.sl).toBe(-2);
  });
  it('détecte les doubles', () => {
    expect(evaluateTest(33, 50).isDouble).toBe(true);
    expect(evaluateTest(34, 50).isDouble).toBe(false);
    expect(evaluateTest(100, 50).isDouble).toBe(true);
  });
});

describe('Bonus & Blessures', () => {
  it('bonus = chiffre des dizaines', () => {
    expect(bonus(37)).toBe(3);
    expect(bonus(40)).toBe(4);
  });
  it('Blessures = BF + 2×BE + BFM', () => {
    const chars = { force: 35, endurance: 40, 'force-mentale': 30 } as Characteristics;
    expect(maxWounds(chars)).toBe(3 + 2 * 4 + 3); // 14
  });
  it('Halfling (Petit) = 2×BE + BFM', () => {
    const chars = { force: 30, endurance: 40, 'force-mentale': 30 } as Characteristics;
    expect(maxWounds(chars, 'petite')).toBe(2 * 4 + 3); // 11
  });
});

describe('Localisation', () => {
  it('inverse le jet du toucher', () => {
    expect(reverseRoll(23)).toBe(32);
    expect(reverseRoll(5)).toBe(50);
    expect(reverseRoll(100)).toBe(100);
  });
  it('mappe sur le Tableau de Localisation', () => {
    expect(hitLocation(5)).toBe('tete'); // 01-09
    expect(hitLocation(32)).toBe('brasD'); // 25-44
    expect(hitLocation(60)).toBe('corps'); // 45-79
    expect(hitLocation(95)).toBe('jambeD'); // 90-00
  });
});

describe('Localisation par forme du corps (LDB « Point d’Impact des Créatures » p.312)', () => {
  it('humanoïde / quadrupède / oiseau partagent le tableau humanoïde (mêmes cases)', () => {
    for (const r of [5, 18, 32, 60, 85, 95]) {
      expect(hitLocationByShape(r, 'quadrupede')).toBe(hitLocation(r));
      expect(hitLocationByShape(r, 'oiseau')).toBe(hitLocation(r));
      expect(hitLocationByShape(r)).toBe(hitLocation(r)); // défaut humanoïde
    }
  });
  it('serpent : Localisations Alternatives 01-19 Tête, 20-00 Corps', () => {
    expect(hitLocationByShape(1, 'serpent')).toBe('tete');
    expect(hitLocationByShape(19, 'serpent')).toBe('tete');
    expect(hitLocationByShape(20, 'serpent')).toBe('corps');
    expect(hitLocationByShape(100, 'serpent')).toBe('corps');
  });
  it('araignée : 01-09 Tête, 10-79 Pattes (Tableau des Jambes), 80-00 Abdomen (Tableau du Corps)', () => {
    expect(hitLocationByShape(9, 'araignee')).toBe('tete');
    expect(hitLocationByShape(10, 'araignee')).toBe('jambeD'); // Pattes → Tableau des Jambes
    expect(hitLocationByShape(79, 'araignee')).toBe('jambeD');
    expect(hitLocationByShape(80, 'araignee')).toBe('corps'); // Abdomen → Tableau du Corps
    expect(hitLocationByShape(100, 'araignee')).toBe('corps');
  });
  it('étiquettes propres à la forme (description)', () => {
    expect(locationLabel('brasD', 'quadrupede')).toBe('Membre antérieur droit');
    expect(locationLabel('jambeG', 'quadrupede')).toBe('Membre postérieur gauche');
    expect(locationLabel('brasG', 'oiseau')).toBe('Aile gauche');
    expect(locationLabel('jambeD', 'araignee')).toBe('Patte');
    expect(locationLabel('corps', 'araignee')).toBe('Abdomen');
    expect(locationLabel('tete', 'serpent')).toBe('Tête'); // inchangé
    expect(locationLabel('corps')).toBe('Corps'); // défaut humanoïde
  });
  it('navire : MÊME système (data + findTableEntry), colonne par gréement (MDG 13)', () => {
    // Un véhicule/navire = un Combattant touché par la même résolution ; seule la table de sortie diffère.
    expect(shipHitLocation('avirons', 15)).toBe('avirons');
    expect(shipHitLocation('voile', 15)).toBe('greement');
    expect(shipHitLocation('mixte', 30)).toBe('avirons');
    for (const rig of ['avirons', 'voile', 'mixte'] as const) {
      expect(shipHitLocation(rig, 1)).toBe('equipage');
      expect(shipHitLocation(rig, 50)).toBe('coque');
      expect(shipHitLocation(rig, 100)).toBe('cargaison');
    }
  });
});

describe('Dégâts d’arme (parsing via effectiveWeaponDamage)', () => {
  it('+BF+4 avec BF=3 → 7', () => {
    expect(effectiveWeaponDamage({ label: 'x', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] }, 3)).toBe(7);
  });
  it('+9 (distance) ignore BF', () => {
    expect(effectiveWeaponDamage({ label: 'x', type: 'ranged', damage: { plusBF: false, flat: 9 }, qualities: [] }, 3)).toBe(9);
  });
});

function dummy(name: string, chars: Partial<Characteristics>, wounds: number, weapon: Weapon): Combatant {
  const base: Characteristics = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
  return {
    id: name,
    label: name,
    kind: 'enemy',
    characteristics: { ...base, ...chars },
    wounds: { current: wounds, max: wounds },
    advantage: 0,
    conditions: [],
    weapons: [weapon],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
  };
}

describe('Résolution de mêlée', () => {
  it('produit un résultat cohérent et déterministe avec une graine', () => {
    const rng = makeRNG(42);
    const sword: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
    const a = dummy('Attaquant', { 'capacite-de-combat': 60, force: 40 }, 15, sword);
    const d = dummy('Défenseur', { 'capacite-de-combat': 25, endurance: 30 }, 12, sword);
    const res = resolveMelee(a, d, sword, rng);
    expect(typeof res.hit).toBe('boolean');
    if (res.hit) {
      expect(res.woundsLost).toBeGreaterThanOrEqual(1);
      expect(res.location).toBeDefined();
    }
  });
});

// --- Corrections issues de l'audit de fidélité ---------------------------
describe('Difficulté (canon : Accessible/Complexe/Difficile)', () => {
  it('table conforme au Livre de base', () => {
    expect(DIFFICULTY_MODIFIERS.accessible).toBe(20);
    expect(DIFFICULTY_MODIFIERS.complexe).toBe(-10);
    expect(DIFFICULTY_MODIFIERS.difficile).toBe(-20); // pas -10
    const keys = Object.keys(DIFFICULTY_MODIFIERS);
    expect(keys).not.toContain('moyen');
    expect(keys).not.toContain('epique');
  });
  it('Difficultés extrêmes EDO (App.2 l.156-165) : Presque Impossible −40, Impossible −50', () => {
    expect(DIFFICULTY_MODIFIERS.presqueImpossible).toBe(-40);
    expect(DIFFICULTY_MODIFIERS.impossible).toBe(-50);
  });
});

describe('Test opposé (départage canon, LDB 12 l.160)', () => {
  it('égalité de DR : la Compétence NUE la plus haute l’emporte, pas la cible modifiée', () => {
    // Compétence 45 sous Difficile (−20) → cible 25 ; Compétence 30 sous Facile (+40) → cible 70.
    const att = evaluateTest(21, 25, 45); // DR 0
    const def = evaluateTest(70, 70, 30); // DR 0
    const r = resolveOpposed(att, def);
    expect(att.sl).toBe(def.sl);
    expect(r.winner).toBe('attacker');
    expect(r.decidedBy).toBe('valeur');
  });
  it('égalité de DR : à valeurs nues égales, la cible modifiée ne départage PAS → tie', () => {
    const att = evaluateTest(21, 25, 45); // Compétence 45, cible 25
    const def = evaluateTest(41, 45, 45); // Compétence 45, cible 45 — même DR
    const r = resolveOpposed(att, def);
    expect(att.sl).toBe(def.sl);
    expect(r.winner).toBe('tie');
    expect(r.decidedBy).toBe('egalite');
    expect(r.attackerWins).toBe(false);
  });
  it('DR ET valeur nue égaux → statu quo (tie), aucun vainqueur', () => {
    const att = evaluateTest(23, 45, 45); // DR 2
    const def = evaluateTest(21, 45, 45); // DR 2
    const r = resolveOpposed(att, def);
    expect(r.winner).toBe('tie');
    expect(r.decidedBy).toBe('egalite');
    expect(r.attackerWins).toBe(false);
  });
  it('DR différents : le DR tranche, le départage par la valeur nue ne s’active jamais', () => {
    const att = evaluateTest(13, 45, 45); // DR 3
    const def = evaluateTest(31, 55, 90); // DR 2, Compétence nue 90 (la plus haute)
    const r = resolveOpposed(att, def);
    expect(att.sl).toBeGreaterThan(def.sl);
    expect(r.winner).toBe('attacker');
    expect(r.decidedBy).toBe('dr');
  });
  it('valeur nue ABSENTE des deux côtés (jet réhydraté) : la cible sert de repli', () => {
    const att = evaluateTest(13, 45);
    const def = evaluateTest(23, 55);
    const r = resolveOpposed(att, def);
    expect(att.sl).toBe(def.sl);
    expect(r.winner).toBe('defender');
    expect(r.decidedBy).toBe('valeur');
  });
  it('valeur nue d’UN SEUL côté : tout-ou-rien — on compare les deux CIBLES, jamais nue vs cible', () => {
    const att = evaluateTest(21, 25, 45); // Compétence nue 45, cible 25
    const def = evaluateTest(70, 70);     // réhydraté sans valeur nue, cible 70
    const r = resolveOpposed(att, def);
    expect(att.sl).toBe(def.sl);
    expect(r.winner).toBe('defender'); // cible 70 > cible 25 — la nue 45 n'affronte pas une cible
    expect(r.decidedBy).toBe('valeur');
  });
});

describe('Coup Critique au niveau moteur (LDB 18-Traumatisme : double uniquement)', () => {
  it('le moteur ne marque le critique que sur un double — l’OVERKILL est posé par le store (sur PB courants)', () => {
    const heavy: Weapon = { label: 'Maillet', type: 'melee', damage: { plusBF: true, flat: 20 }, qualities: [] };
    const a = dummy('Brute', { 'capacite-de-combat': 90, force: 40 }, 20, heavy);
    const d = dummy('Frêle', { 'capacite-de-combat': 20, endurance: 20 }, 3, heavy); // Blessures max 3
    const res = resolveMelee(a, d, heavy, makeRNG(1), { defense: 'none' });
    expect(res.hit).toBe(true);
    expect(res.woundsLost!).toBeGreaterThan(d.wounds.max); // gros coup → overkill géré par le STORE, plus par applyHit
    // `critical` du moteur = uniquement un double réussi (l'arme n'a pas l'Atout Empaleuse).
    expect(res.critical).toBe(res.attackerRoll % 11 === 0 || res.attackerRoll === 100);
  });
});

// --- Magie -----------------------------------------------------------------
function caster(chars: Partial<Characteristics>, skills: SkillInstance[] = [], wounds = 12): Combatant {
  const base: Characteristics = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
  return {
    id: 'c',
    label: 'Mage',
    kind: 'hero',
    characteristics: { ...base, ...chars },
    wounds: { current: wounds, max: wounds },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills,
    talents: [],
    movement: 4,
  };
}

const FLECHETTE: SpellLike = { label: 'Fléchette', ecole: 'Magie mineure', family: 'mineure', missile: true, damage: 0, cn: 0, duration: { kind: 'instant' }, desc: 'Il s’agit d’un Projectile magique avec Dégât +0.' };
const PRIERE: SpellLike = { label: 'Bénédiction de Bataille', ecole: 'Béni', family: 'beni', cn: null, duration: { kind: 'rounds', value: 6 }, desc: 'Votre cible gagne +10 en Capacité de Combat.' };
const ARCANE: SpellLike = { label: 'Boule de feu', ecole: 'Magie des Arcanes', family: 'arcane', cn: 8, duration: { kind: 'instant' }, desc: 'Projectile magique avec Dégâts +8.' };

describe('Magie — routage du test par branche', () => {
  it('les Prières (Béni/Invocation) utilisent Prière (Soc), sans NI', () => {
    const info = castInfo(PRIERE);
    expect(info.skill).toBe('priere');
    expect(info.requireNI).toBe(false);
  });
  it('les Sorts utilisent Langue (Magick) (Int), avec NI', () => {
    const info = castInfo(ARCANE);
    expect(info.skill).toBe('langue');
    expect(info.spec).toBe('magick');
    expect(info.requireNI).toBe(true);
  });
  it('isArcaneSpell distingue Arcane/Domaine de la Magie mineure et des Prières', () => {
    expect(isArcaneSpell(ARCANE)).toBe(true);
    expect(isArcaneSpell(FLECHETTE)).toBe(false);
    expect(isArcaneSpell(PRIERE)).toBe(false);
  });
});

describe('Magie — analyse des descriptions', () => {
  it('missileDamage lit les champs de données (Dégâts / ignore PA / ignore BE)', () => {
    const sp = (o: Partial<SpellLike>): SpellLike => ({ label: 'X', ecole: 'T', cn: 0, desc: '', ...o });
    expect(missileDamage(sp({ missile: true, damage: 8 }))).toEqual({ damage: 8, ignorePA: false, ignoreBE: false });
    expect(missileDamage(sp({ missile: true, damage: 0, ignorePA: true }))).toEqual({ damage: 0, ignorePA: true, ignoreBE: false });
    expect(missileDamage(sp({ missile: true, damage: 10, ignorePA: true, ignoreBE: true }))).toEqual({ damage: 10, ignorePA: true, ignoreBE: true });
    expect(missileDamage(sp({ missile: false }))).toBeNull();
  });
  it('isMagicMissile détecte les Projectiles magiques', () => {
    expect(isMagicMissile(FLECHETTE)).toBe(true);
    expect(isMagicMissile(PRIERE)).toBe(false);
  });
  // (parseDurationRounds/buffDurationRounds supprimés : la durée Rounds vient de la donnée structurée
  //  `SpellDuration`, dont le parser est testé dans spellDuration.test.ts.)
});

describe('Magie — valeur d’incantation', () => {
  it('Langue (Magick) = Int + avances', () => {
    const c = caster({ intelligence: 40 }, [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 15 }]);
    expect(castingValue(c, 'langue', 'magick')).toBe(55);
  });
  it('Prière = Soc + avances', () => {
    const c = caster({ sociabilite: 35 }, [{ id: 'priere', characteristic: 'sociabilite', advances: 10 }]);
    expect(castingValue(c, 'priere')).toBe(45);
  });
  it('sans la compétence, la Caractéristique seule est utilisée', () => {
    const c = caster({ intelligence: 33 });
    expect(castingValue(c, 'langue', 'magick')).toBe(33);
  });
});

describe('Magie — résolution de l’incantation', () => {
  it('un Sort réussi mais avec DR < NI n’est pas lancé', () => {
    // Valeur 95 → réussite quasi certaine, mais DR max ~9 < NI 20.
    const c = caster({ intelligence: 95 }, [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 1 }]);
    const spell: SpellLike = { ...ARCANE, cn: 20 };
    const res = resolveCasting(c, spell, makeRNG(3));
    expect(res.cast).toBe(false);
  });
  it('cohérence : lancé ⇔ réussite et DR ≥ NI', () => {
    const c = caster({ intelligence: 60 }, [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 1 }]);
    for (let seed = 0; seed < 20; seed++) {
      const res = resolveCasting(c, FLECHETTE, makeRNG(seed));
      const success = res.roll <= res.target;
      expect(res.cast).toBe(success && res.sl >= 0);
    }
  });
  it('une Prière réussie est lancée sans seuil de NI', () => {
    const c = caster({ sociabilite: 99 }, [{ id: 'priere', characteristic: 'sociabilite', advances: 1 }]);
    const res = resolveCasting(c, PRIERE, makeRNG(2));
    expect(res.cast).toBe(res.roll <= res.target);
  });
});

describe('Magie — Projectile magique', () => {
  it('Dégâts = Dégâts du sort + DR + BFM, Localisation = jet inversé', () => {
    const c = caster({ intelligence: 80, 'force-mentale': 40 }, [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 1 }]);
    const target = caster({ endurance: 30 }, [], 15);
    const spell: SpellLike = { ...FLECHETTE, damage: 4 };
    const res = resolveMagicMissile(c, target, spell, makeRNG(5));
    if (res.hit) {
      expect(res.location).toBe(hitLocation(reverseRoll(res.roll)));
      expect(res.damage).toBe(4 + Math.max(0, res.sl) + 4); // +4 sort, DR, BFM 4
      expect(res.woundsLost).toBe(Math.max(1, res.damage! - 3)); // BE 3, PA 0
    }
  });
});

describe('Magie — Focalisation', () => {
  it('cumule un DR positif sur réussite', () => {
    const c = caster({ 'force-mentale': 90 }, [{ id: 'focalisation', spec: 'Aqshy', characteristic: 'force-mentale', advances: 1 }]);
    const res = resolveFocus(c, ARCANE, makeRNG(4));
    expect(res.dr).toBeGreaterThanOrEqual(0);
    if (res.roll <= 90) expect(res.dr).toBe(Math.max(0, Math.floor(90 / 10) - Math.floor(res.roll / 10)));
  });
});

describe('Magie — effets actifs (buffs temporisés)', () => {
  it('effectiveChar applique le meilleur bonus, sans cumul', () => {
    const c = caster({ 'capacite-de-combat': 35 });
    c.activeEffects = [
      { label: 'A', char: 'capacite-de-combat', bonus: 10, duration: { scale: 'rounds', left: 6 } },
      { label: 'B', char: 'capacite-de-combat', bonus: 20, duration: { scale: 'rounds', left: 6 } },
    ];
    expect(effectiveChar(c, 'capacite-de-combat')).toBe(55); // 35 + max(10,20)
  });
  it('endOfRound décrémente et dissipe les effets expirés', () => {
    const c = caster({ 'capacite-de-combat': 35 });
    const eff: ActiveEffect = { label: 'Bénédiction de Bataille', char: 'capacite-de-combat', bonus: 10, duration: { scale: 'rounds', left: 1 } };
    c.activeEffects = [eff];
    endOfRound(c);
    expect(c.activeEffects.length).toBe(0);
    expect(effectiveChar(c, 'capacite-de-combat')).toBe(35);
  });
  // Pénalités (omission-majeure corrigée) : meilleur bonus + pire pénalité, sommés.
  it('effectiveChar applique le meilleur bonus ET la pire pénalité (l.168)', () => {
    const c = caster({ agilite: 40 });
    c.activeEffects = [
      { label: 'buff', char: 'agilite', bonus: 10, duration: { scale: 'rounds', left: 6 } },
      { label: 'autre buff', char: 'agilite', bonus: 20, duration: { scale: 'rounds', left: 6 } },
      { label: 'Écorce', char: 'agilite', bonus: -10, duration: { scale: 'rounds', left: 6 } },
    ];
    expect(effectiveChar(c, 'agilite')).toBe(50); // 40 + max(10,20) + min(-10) = 40+20-10
  });
  it('effectiveChar garde la pénalité la PIRE entre deux malus', () => {
    const c = caster({ dexterite: 45 });
    c.activeEffects = [
      { label: 'a', char: 'dexterite', bonus: -10, duration: { scale: 'rounds', left: 6 } },
      { label: 'b', char: 'dexterite', bonus: -20, duration: { scale: 'rounds', left: 6 } },
    ];
    expect(effectiveChar(c, 'dexterite')).toBe(25); // 45 + 0 - 20
  });
});

describe('Magie — correctifs de fidélité (audit)', () => {
  // B1 — Projectile ignorant le Bonus d'Endurance : le BE n'est pas déduit.
  it('B1 : un Projectile « ignore le Bonus d’Endurance » ne déduit pas le BE', () => {
    const c = caster({ intelligence: 80, 'force-mentale': 30 }, [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 1 }]);
    const target = caster({ endurance: 39 }, [], 20); // BE 3
    const spell: SpellLike = {
      label: 'Vortex d’âmes',
      ecole: 'Magie des Arcanes',
      cn: 0,
      duration: { kind: 'instant' },
      missile: true,
      damage: 10,
      ignorePA: true,
      ignoreBE: true,
      desc: 'Projectile magique avec Dégâts +10 qui ignore le Bonus d’Endurance et les PA.',
    };
    const res = resolveMagicMissile(c, target, spell, makeRNG(5));
    if (res.hit) {
      // mitigation BE+PA = 0 → toutes les Blessures passent.
      expect(res.woundsLost).toBe(res.damage);
    }
  });

  // A4 (cascade #T3) — durées d'HORLOGE (LDB 47) : minutes/heures/jours/« lever du soleil », depuis la
  // durée STRUCTURÉE. (L'échelle Rounds est portée par `{kind:'rounds'}`, hors de durationClockMinutes.)
  it('durationClockMinutes : clock littéral/(Bonus de X)/(X), untilDawn ; null hors-horloge', () => {
    const c = caster({ 'force-mentale': 45, intelligence: 38 }); // BFM 4 ; Int 38
    expect(durationClockMinutes({ kind: 'clock', value: 1, unit: 'hours' }, c, 0)).toBe(60);
    expect(durationClockMinutes({ kind: 'clock', value: { bonusOf: 'force-mentale' }, unit: 'days' }, c, 0)).toBe(4 * 24 * 60);
    expect(durationClockMinutes({ kind: 'clock', value: { bonusOf: 'force-mentale' }, unit: 'minutes' }, c, 0)).toBe(4);
    expect(durationClockMinutes({ kind: 'clock', value: { charOf: 'intelligence' }, unit: 'minutes' }, c, 0)).toBe(38); // carac PLEINE
    // « Jusqu'au lever du soleil » : prochaine aube (05:00) ; à l'aube pile → un cycle entier.
    expect(durationClockMinutes({ kind: 'untilDawn' }, c, 0)).toBe(5 * 60);
    expect(durationClockMinutes({ kind: 'untilDawn' }, c, 5 * 60)).toBe(24 * 60);
    // Hors-horloge : Rounds (échelle tactique), Instantané, Spécial → null (rien d'inventé).
    expect(durationClockMinutes({ kind: 'rounds', value: 6 }, c, 0)).toBeNull();
    expect(durationClockMinutes({ kind: 'instant' }, c, 0)).toBeNull();
    expect(durationClockMinutes({ kind: 'special', text: 'Spécial' }, c, 0)).toBeNull();
    // AUCUN plancher moteur : à BFM 0, « (Bonus de FM) heures » vaut 0 minute — comme la même formule
    // en Rounds. Un minimum vit dans la FORMULE du sort (`{minimum, of}`), jamais ici.
    const faible = caster({ 'force-mentale': 9 });
    expect(durationClockMinutes({ kind: 'clock', value: { bonusOf: 'force-mentale' }, unit: 'hours' }, faible, 0)).toBe(0);
    expect(durationClockMinutes({ kind: 'clock', value: { minimum: 1, of: { bonusOf: 'force-mentale' } }, unit: 'hours' }, faible, 0)).toBe(60);
  });
});

describe('Magie — compétences Avancées (gating)', () => {
  it('knowsCastingSkill exige au moins 1 augmentation', () => {
    const sansSkill = caster({ intelligence: 80 });
    const zero = caster({ intelligence: 80 }, [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 0 }]);
    const ok = caster({ intelligence: 80 }, [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 1 }]);
    expect(knowsCastingSkill(sansSkill, 'langue', 'magick')).toBe(false);
    expect(knowsCastingSkill(zero, 'langue', 'magick')).toBe(false);
    expect(knowsCastingSkill(ok, 'langue', 'magick')).toBe(true);
  });
  it('un Sort est refusé sans la compétence Avancée (pas de repli sur la Caractéristique)', () => {
    const c = caster({ intelligence: 95 }); // aucune compétence Langue
    const res = resolveCasting(c, FLECHETTE, makeRNG(1));
    expect(res.cast).toBe(false);
    expect(res.log).toContain('ne maîtrise pas');
  });
  it('Talents liés au Test (LDB 10 l.19) : +1 DR par acquisition sur Test d’incantation RÉUSSI (Diction instinctive)', () => {
    const skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence' as const, advances: 10 }];
    const sans = caster({ intelligence: 80 }, skills);
    const avec = caster({ intelligence: 80 }, skills);
    avec.talents = [{ talentId: 'diction-instinctive', times: 2 }];
    expect(castTestTalentDR(avec, 'langue', 'magick')).toBe(2);
    expect(castTestTalentDR(sans, 'langue', 'magick')).toBe(0);
    // même graine = même d100 : sur un jet RÉUSSI, le DR final diffère exactement du niveau du Talent
    for (let seed = 1; seed <= 6; seed++) {
      const a = resolveCasting(sans, FLECHETTE, makeRNG(seed));
      const b = resolveCasting(avec, FLECHETTE, makeRNG(seed));
      expect(b.sl).toBe(a.sl + (a.roll <= a.target ? 2 : 0));
    }
  });

  it('un Talent lié à une AUTRE Langue ne booste pas l’incantation (Langue (Magick) exigé)', () => {
    const c = caster({ intelligence: 80 });
    c.talents = [{ talentId: 'linguistique', times: 3 }]; // test data : « Langue (Toutes) » ? — ne doit pas matcher Magick
    expect(castTestTalentDR(c, 'langue', 'magick')).toBe(0);
  });

  it('Harmonisation aethyrique ×N : +N DR aux Tests de Focalisation réussis (LDB 10 l.19)', () => {
    const skills = [{ id: 'focalisation', spec: 'Aqshy', characteristic: 'force-mentale' as const, advances: 5 }];
    const sans = caster({ 'force-mentale': 85 }, skills);
    const avec = caster({ 'force-mentale': 85 }, skills);
    avec.talents = [{ talentId: 'harmonisation-aethyrique', times: 3 }];
    for (let seed = 1; seed <= 6; seed++) {
      const a = resolveFocus(sans, ARCANE, makeRNG(seed));
      const b = resolveFocus(avec, ARCANE, makeRNG(seed));
      if (a.roll <= (a.target ?? 0)) expect(b.dr).toBe(a.dr + 3);
      else expect(b.dr).toBe(a.dr); // échec : pas de bonus (« utilisation réussie »)
    }
  });

  it('Dissipation (LDB 46 l.156) : Test opposé — gagné → dissipé ; perdu → le Sort garde le DR NET', () => {
    const langue = (adv: number) => [{ id: 'langue', spec: 'magick', characteristic: 'intelligence' as const, advances: adv }];
    // contre-lanceur écrasant (valeur 99 clampée) vs jet d'incantation médiocre figé (DR 1)
    const fort = caster({ intelligence: 89 }, langue(10));
    const castT = { roll: 40, target: 50, base: 50, success: true, sl: 1, isDouble: false };
    let dispelCount = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const out = resolveCounterspell(fort, castT, makeRNG(seed));
      expect(out.casterNetSL).toBe(castT.sl - out.counter.sl); // « le DR du Test opposé »
      // Aucune ÉGALITÉ de DR sur ces 12 graines (mesuré) : les deux branches sont strictes ici, et le
      // départage à DR égal (LDB 12 l.160) se joue dans `magie-departage-nue.test.ts`.
      if (out.dispelled) {
        dispelCount++;
        expect(out.counter.sl, 'dissipation obtenue sans battre le DR du lanceur').toBeGreaterThan(castT.sl);
      } else {
        expect(out.counter.sl, 'aucune dissipation alors que le chant tenait le DR du lanceur').toBeLessThan(castT.sl);
      }
    }
    expect(dispelCount).toBeGreaterThan(6); // valeur 99 vs DR 1 : la dissipation domine
    // contre-lanceur nul : jamais dissipé sur un DR adverse élevé
    const nul = caster({ intelligence: 10 }, langue(0));
    const fortCast = { roll: 11, target: 95, base: 95, success: true, sl: 8, isDouble: false };
    for (let seed = 1; seed <= 8; seed++) expect(resolveCounterspell(nul, fortCast, makeRNG(seed)).dispelled).toBe(false);
  });

  it('Dissipation : seul un SORT se dissipe — pas une Prière (LDB 46 « Si un Sort vous cible »)', () => {
    expect(isDispellableSpell(FLECHETTE)).toBe(true);
    expect(isDispellableSpell({ label: 'Bénédiction', ecole: 'Béni', family: 'beni', cn: null, duration: null, desc: '' })).toBe(false);
  });

  it('le Trait « Lanceur de Sorts » (LDB 85 : « La créature peut lancer des Sorts ») dispense de la Compétence', () => {
    const c = caster({ intelligence: 95 }); // statbloc de bestiaire : aucune Compétence
    c.traits = [{ id: 'lanceur-de-sorts', arg: 'Sorcellerie' }];
    expect(knowsCastingSkill(c, 'langue', 'magick')).toBe(true);
    const res = resolveCasting(c, FLECHETTE, makeRNG(1));
    expect(res.log).not.toContain('ne maîtrise pas'); // le Test se fait sur Int seule
  });
});

describe('Magie — Incantations Imparfaites & Colère des dieux', () => {
  it('chaque jet d’une table tombe sur une entrée nommée', () => {
    for (const sev of ['mineure', 'majeure', 'colere'] as const) {
      for (let seed = 0; seed < 30; seed++) {
        const r = rollMiscast(sev, makeRNG(seed));
        expect(r.label.length).toBeGreaterThan(0);
        expect(r.log).toContain(sev === 'colere' ? 'Colère des dieux' : 'Incantation Imparfaite');
      }
    }
  });
  it('les effets mécaniques (États / Blessures) sont structurés en GameOps', () => {
    // Balaye assez de graines pour observer au moins une entrée à effet.
    let sawCondition = false;
    let sawWounds = false;
    for (let seed = 0; seed < 200 && !(sawCondition && sawWounds); seed++) {
      const r = rollMiscast('majeure', makeRNG(seed));
      for (const op of r.ops) {
        if (op.op === 'condition') sawCondition = true;
        if (op.op === 'wounds') sawWounds = true;
      }
    }
    expect(sawCondition).toBe(true);
    expect(sawWounds).toBe(true);
  });
  it('la Colère ajoute +10 par Point de Péché au jet', () => {
    // Avec assez de Péché, on peut atteindre les entrées >100 (Châtiment → reduceToZero).
    let sawReduce = false;
    for (let seed = 0; seed < 50 && !sawReduce; seed++) {
      const r = rollMiscast('colere', makeRNG(seed), 10); // +100 → jet 101-200
      if (r.ops.some((o) => o.op === 'reduceToZero')) sawReduce = true;
    }
    expect(sawReduce).toBe(true);
  });
});

describe('Création de héros', () => {
  it('génère un personnage jouable et reproductible', () => {
    const hero = createHero({
      speciesId: 'humains-reiklander',
      careerId: 'agitateur',
      label: 'Test',
      seed: 7,
    });
    expect(hero.kind).toBe('hero');
    expect(hero.skills.length).toBeGreaterThan(0);
    expect(hero.wounds.max).toBeGreaterThan(0);
    expect(hero.movement).toBe(4);
    // 40 augmentations de carrière (+5 × 8) + 24 d'espèce (3×+5 + 3×+3, LDB 05 l.484)
    const totalAdv = hero.skills.reduce((s, sk) => s + sk.advances, 0);
    expect(totalAdv).toBe(64);
  });
});
