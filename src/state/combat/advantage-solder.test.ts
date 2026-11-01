import { describe, it, expect, afterEach } from 'vitest';
import { setRule, resetRule } from '../../engine/policy';
import { seedBattleRng } from '../../noyau/battleRng';
import type { Combatant } from '../../engine/types';
import type { AdvantagePools } from '../../engine/advantagePool';
import {
  resolveBattement, battementEligible, battementRemoval,
  resolveDistraire, distraireEligible, distraireAttackValue, distraireDefenseValue,
} from '../../noyau/combatManeuvers';
import { resolveGrappleOpposed } from '../../noyau/combatFlow';
import { fearSourceFor } from '../../engine/psychology';
import { riderFearSize } from '../../noyau/mount';
import { retreatAdvantageCost, keptAdvantageOnDisengage, canDisengageWithLessAdvantage } from '../../engine/combatFeatures/dispatch';
import type { TestResult } from '../../engine/tests';
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';

// Chars de base (BF/BE = 4) — suffisant pour combatValue/effectiveChar sans surprise.
const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 35, force: 40, endurance: 40, initiative: 30, agilite: 35, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 } as const;

const mk = (id: string, kind: Combatant['kind'], over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id, label: id, kind, advantage: 0, conditions: [], talents: [], activeEffects: [], skills: [],
    characteristics: { ...CHARS }, weapons: [{ label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] }],
    wounds: blessuresDeBase(10), size: 'moyenne', engagedWith: [],
    ...over,
  })) as unknown as Combatant;

interface FakeBattle { combatants: Combatant[]; advantagePools?: AdvantagePools; over?: boolean }
const makeGet = (combatants: Combatant[], advantagePools?: AdvantagePools) => {
  const battle: FakeBattle = { combatants, advantagePools };
  return { get: (() => ({ battle })) as never, battle };
};

/** Jet de Test fabriqué (succès + DR voulu). */
const roll = (success: boolean, sl: number): TestResult => ({ roll: success ? 5 : 95, target: 45, success, sl } as TestResult);

afterEach(() => {
  resetRule('combat-aa-avantage-groupe');
});

describe('Battement (LDB 10 l.103 / AA 13 l.17)', () => {
  it('battementRemoval : LDB = 1 + DR ; mode groupe = 1 (+1 à 6 DR)', () => {
    expect(battementRemoval(0)).toBe(1);
    expect(battementRemoval(3)).toBe(4); // LDB : 1 + 3 DR
    setRule('combat-aa-avantage-groupe', true);
    expect(battementRemoval(3)).toBe(1); // AA : 1
    expect(battementRemoval(6)).toBe(2); // AA : 1 + 1 (6 DR)
  });

  it('éligibilité : foe ARMÉ, pas plus grand, Engagé', () => {
    const a = mk('h', 'hero', { engagedWith: ['e'] });
    const armed = mk('e', 'enemy');
    expect(battementEligible(a, armed)).toBe(true);
    const unarmed = mk('e2', 'enemy', { weapons: [] });
    a.engagedWith = ['e', 'e2'];
    expect(battementEligible(a, unarmed)).toBe(false); // pas d'arme
    const bigger = mk('e3', 'enemy', { size: 'enorme' });
    a.engagedWith = ['e', 'e2', 'e3'];
    expect(battementEligible(a, bigger)).toBe(false); // Taille supérieure
  });

  it('mode groupe : un Battement réussi RETIRE de la RÉSERVE adverse (−1, −2 à 6 DR)', () => {
    setRule('combat-aa-avantage-groupe', true);
    const a = mk('h', 'hero', { engagedWith: ['e'] });
    const e = mk('e', 'enemy');
    const { get, battle } = makeGet([a, e], { allies: 0, foes: 3 });
    resolveBattement(get, a, e, roll(true, 2)); // 2 DR → −1
    expect(battle.advantagePools).toEqual({ allies: 0, foes: 2 });
    resolveBattement(get, a, e, roll(true, 6)); // 6 DR → −2
    expect(battle.advantagePools).toEqual({ allies: 0, foes: 0 });
  });

  it('LDB : un Battement réussi retire 1 + DR de l’Avantage INDIVIDUEL du foe', () => {
    const a = mk('h', 'hero', { engagedWith: ['e'] });
    const e = mk('e', 'enemy', { advantage: 5 });
    const { get } = makeGet([a, e]);
    resolveBattement(get, a, e, roll(true, 2)); // 1 + 2 = 3
    expect(e.advantage).toBe(2);
  });

  it('un Battement RATÉ ne retire rien', () => {
    setRule('combat-aa-avantage-groupe', true);
    const a = mk('h', 'hero', { engagedWith: ['e'] });
    const e = mk('e', 'enemy');
    const { get, battle } = makeGet([a, e], { allies: 0, foes: 3 });
    resolveBattement(get, a, e, roll(false, -1));
    expect(battle.advantagePools).toEqual({ allies: 0, foes: 3 });
  });
});

describe('Distraire (LDB 10 l.364 / AA 13 l.51)', () => {
  it('éligibilité : adversaire vivant du camp opposé', () => {
    const a = mk('h', 'hero');
    expect(distraireEligible(a, mk('e', 'enemy'))).toBe(true);
    expect(distraireEligible(a, mk('h2', 'hero'))).toBe(false);
  });

  it('victoire de l’attaquant → cible distraite (2 Rounds)', () => {
    const a = mk('h', 'hero');
    const e = mk('e', 'enemy');
    resolveDistraire(a, e, roll(true, 3), roll(false, -1)); // atk gagne
    expect(e.distractedRounds).toBe(2);
  });

  it('défaite de l’attaquant → aucun effet', () => {
    const a = mk('h', 'hero');
    const e = mk('e', 'enemy');
    resolveDistraire(a, e, roll(false, -2), roll(true, 1)); // def gagne
    expect(e.distractedRounds).toBeUndefined();
  });

  it('les valeurs de Test lisent Ag/Athlétisme (attaquant) et FM/Calme (défenseur)', () => {
    const a = mk('h', 'hero', { skills: [{ id: 'athletisme', advances: 10 }] as never });
    const e = mk('e', 'enemy', { skills: [{ id: 'calme', advances: 5 }] as never });
    expect(distraireAttackValue(a)).toBe(CHARS.agilite + 10);
    expect(distraireDefenseValue(e)).toBe(CHARS['force-mentale'] + 5);
  });
});

describe('Cavalier émérite (AA 13 l.25) — Taille = monture face à la Peur de Taille', () => {
  it('riderFearSize : monture (mode groupe, porteur monté) ; undefined à pied ou hors mode groupe', () => {
    setRule('combat-aa-avantage-groupe', true);
    const horse = mk('m', 'hero', { size: 'grande' });
    const rider = mk('r', 'hero', { size: 'moyenne', mountId: 'm', talents: [{ talentId: 'cavalier-emerite', times: 1 }] as never });
    const { battle } = makeGet([rider, horse]);
    expect(riderFearSize(battle as never, rider)).toBe('grande'); // Taille effective = celle de la monture

    const onFoot = mk('r2', 'hero', { size: 'moyenne', talents: [{ talentId: 'cavalier-emerite', times: 1 }] as never });
    expect(riderFearSize(makeGet([onFoot]).battle as never, onFoot)).toBeUndefined(); // pas monté → pas d’override

    const noTalent = mk('r3', 'hero', { size: 'moyenne', mountId: 'm' });
    expect(riderFearSize(makeGet([noTalent, horse]).battle as never, noTalent)).toBeUndefined(); // pas le Talent

    resetRule('combat-aa-avantage-groupe'); // hors mode groupe : la variante AA du Talent est inerte
    expect(riderFearSize(battle as never, rider)).toBeUndefined();
  });

  it('fearSourceFor : un cavalier de Taille effective ≥ foe n’a PAS peur de la Taille (mais garde causesTerreur)', () => {
    const self = mk('r', 'hero', { size: 'moyenne' });
    const ogre = mk('o', 'enemy', { size: 'grande' }); // gap 1 → Peur 1 par la Taille
    expect(fearSourceFor(self, ogre)).toEqual({ kind: 'peur', indice: 1 }); // à pied : Peur de Taille
    // Monté sur une Grande monture (override Taille = grande) : plus d’écart de Taille → pas de Peur.
    expect(fearSourceFor(self, ogre, 'grande')).toBeNull();
    // Mais un démon (causesTerreur statbloc) fait TOUJOURS peur, monture ou non (RAW « uniquement par la Taille »).
    const demon = mk('d', 'enemy', { size: 'grande', causesTerreur: 3 } as never);
    expect(fearSourceFor(self, demon, 'grande')).toEqual({ kind: 'terreur', indice: 3 });
  });
});

describe('Empoignade opposée (LDB 14 l.161) — le +1 du vainqueur crédite la réserve', () => {
  it('mode groupe : quand l’actor PERD, foe gagne +1 dans la RÉSERVE de son camp (pas per-combattant)', () => {
    setRule('combat-aa-avantage-groupe', true);
    // actor (héros) F 5 vs foe (ennemi) F 90 → l’ennemi gagne le Test opposé de Force sur (presque) tout seed.
    // On balaie des seeds jusqu’à observer UNE défaite de l’actor et on vérifie le crédit de RÉSERVE (foes=1),
    // et que l’Avantage INDIVIDUEL du foe reste 0 (projection = réserve, pas un +1 per-combattant).
    let sawDefeat = false;
    for (let seed = 1; seed <= 40 && !sawDefeat; seed++) {
      seedBattleRng(seed);
      const actor = mk('h', 'hero', { characteristics: { ...CHARS, force: 5 }, grapplingWith: ['e'] });
      const foe = mk('e', 'enemy', { characteristics: { ...CHARS, force: 90 }, grapplingWith: ['h'] });
      const { get, battle } = makeGet([actor, foe], { allies: 0, foes: 0 });
      const line = resolveGrappleOpposed(get, actor, foe);
      if (line.includes(foe.label) && battle.advantagePools!.foes === 1) {
        sawDefeat = true;
        expect(battle.advantagePools).toEqual({ allies: 0, foes: 1 }); // crédit de RÉSERVE
        expect(foe.advantage).toBe(1); // projeté depuis la réserve (mirror), pas un +1 direct
      }
    }
    expect(sawDefeat).toBe(true); // une défaite a bien été observée et créditée à la réserve
  });
});

describe('Retraite stratégique / Impitoyable (AA 11 l.37 / AA 13 l.74, LDB 10 l.591)', () => {
  it('retreatAdvantageCost : 2 par défaut, 1 avec Impitoyable AA', () => {
    setRule('combat-aa-avantage-groupe', true);
    const plain = mk('h', 'hero');
    expect(retreatAdvantageCost(plain)).toBe(2);
    const imp = mk('h2', 'hero', { talents: [{ talentId: 'impitoyable', times: 1 }] as never });
    expect(retreatAdvantageCost(imp)).toBe(1); // variante AA : coût de la Retraite stratégique = 1
    // En mode groupe, la variante AA SUPPRIME l’effet LDB (keep/less-advantage) au profit du seul coût.
    expect(canDisengageWithLessAdvantage(imp)).toBe(false);
    expect(keptAdvantageOnDisengage(imp)).toBe(0);
  });

  it('Impitoyable LDB (mode Livre de base) : garde niveau Avantages + Désengagement sans supériorité', () => {
    const imp = mk('h', 'hero', { talents: [{ talentId: 'impitoyable', times: 1 }] as never });
    expect(canDisengageWithLessAdvantage(imp)).toBe(true); // peut Sacrifier même avec moins d’Avantage
    expect(keptAdvantageOnDisengage(imp)).toBe(1); // garde niveau (1) au lieu de tomber à 0
    const plain = mk('h2', 'hero');
    expect(canDisengageWithLessAdvantage(plain)).toBe(false);
    expect(keptAdvantageOnDisengage(plain)).toBe(0);
  });
});
