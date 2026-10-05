/**
 * #1153 L6 — CLÔTURE : `rollTest` ne pose plus de valeur nue implicite.
 *
 * `LDB 12 l.160` départage un Test opposé sur la Compétence/Caractéristique — le Niveau de Compétence
 * NU (`LDB 09 l.17`), pas la valeur cible modifiée. Tant que `rollTest` posait `base = value`, tout
 * jet arrivait à `resolveOpposed` avec une grandeur FONDUE déguisée en nue : le départage pouvait
 * comparer la nue d'un camp à la fondue de l'autre sans que rien ne le signale.
 *
 * Contrat désormais tenu par construction :
 *  1. un `TestResult` ne porte de nue que si son producteur la POSE ;
 *  2. une opposition dont un camp n'en pose pas retombe sur les CIBLES des DEUX camps (`openValues`,
 *     tout-ou-rien) — un manque VISIBLE, jamais un départage mixte ;
 *  3. les producteurs de combat posent la leur à l'accesseur canon (`combatBaseValue`/`defenseBaseValue`).
 */
import { describe, it, expect } from 'vitest';
import { rollTest, resolveOpposed, opposedReasons, type TestResult } from './tests';
import { makeRNG } from './dice';
import { combatBaseValue, combatValue, defenseBaseValue, defenseValue, rollMeleeAttacker, rollMeleeDefender, rollGrappleForce, rollDisengageAttack, resolveMelee, finishMelee } from './combat';
import { hydrateTR } from './tests';
import { COND } from './conditions';
import type { Characteristics, Combatant, ItemInstance, Weapon } from './types';
import { objetDeTest } from './objetDeTest.testkit';

const chars = (over: Partial<Characteristics> = {}): Characteristics => ({
  'capacite-de-combat': 40, 'capacite-de-tir': 35, force: 30, endurance: 30, initiative: 30,
  agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, ...over,
});

const epee = { label: 'Épée', type: 'melee', subType: 'epee', damage: 4, qualities: [] } as unknown as Weapon;

function hero(opts: { conditions?: { id: string; value: number }[]; skills?: Combatant['skills']; enc?: number; chars?: Partial<Characteristics> } = {}): Combatant {
  const enc = opts.enc ?? 0;
  const items: ItemInstance[] = enc > 0 ? [objetDeTest({ uid: 'x', trappingId: 'corde', kind: 'misc', qualities: [], enc, equipped: false })] : [];
  return {
    id: 'h', label: 'Sujet', kind: 'hero',
    characteristics: chars(opts.chars),
    wounds: { current: 12, max: 12 },
    advantage: 0,
    conditions: opts.conditions ?? [],
    weapons: [epee],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items, skills: opts.skills ?? [], talents: [], movement: 4,
  } as unknown as Combatant;
}

const SKILLS_CC = [{ id: 'corps-a-corps', spec: 'epee', advances: 10 }] as unknown as Combatant['skills'];
const SKILLS_DODGE = [{ id: 'esquive', advances: 15 }] as unknown as Combatant['skills'];

/** Jet FORGÉ (aucun dé) : seul le triplet lu par le départage compte. */
const tr = (target: number, sl: number, base?: number): TestResult =>
  ({ roll: 1, target, success: true, sl, isDouble: false, ...(base != null ? { base } : {}) });

describe('#1153 L6 — `rollTest` ne pose aucune valeur nue', () => {
  it('la valeur TESTÉE ne se fait plus passer pour la nue du départage', () => {
    const t = rollTest(50, 'intermediaire', makeRNG(7));
    expect(t.target).toBe(50);
    expect(t.base).toBeUndefined();
  });
});

describe('#1153 L6 — une opposition sans nue explicite retombe sur les DEUX cibles, jamais un mixte', () => {
  it('un seul camp portant sa nue : le départage se fait sur les cibles des deux camps', () => {
    // Fixture DISCRIMINANTE : un départage MIXTE (nue 20 vs cible 40) donnerait le défenseur ;
    // le repli tout-ou-rien (cibles 55 vs 40) donne l'attaquant.
    const opp = resolveOpposed(tr(55, 2, 20), tr(40, 2));
    expect(opp.winner).toBe('attacker');
    expect(opp.decidedBy).toBe('valeur');
    const [why] = opposedReasons(opp);
    expect(why).toEqual({ by: 'valeur', own: 55, other: 40 }); // les CIBLES, la même grandeur des deux côtés
  });

  it('sur de VRAIS jets : le camp muet ne fait pas passer sa valeur testée pour une nue', () => {
    // A déclare sa nue (20) et teste Difficile (75 − 20 = cible 55) ; B ne déclare rien (cible 40).
    // Repli tout-ou-rien → [55, 40] : A l'emporte. Si `rollTest` reposait `base = value`, B opposerait
    // 40 à la nue 20 de A et RENVERSERAIT le verdict sur deux grandeurs différentes.
    const a = { ...rollTest(75, 'difficile', makeRNG(11)), base: 20, success: true, sl: 2 };
    const b = { ...rollTest(40, 'intermediaire', makeRNG(12)), success: true, sl: 2 };
    expect([a.target, b.target]).toEqual([55, 40]);
    const opp = resolveOpposed(a, b);
    expect(opp.winner).toBe('attacker');
    expect(opposedReasons(opp)[0]).toEqual({ by: 'valeur', own: 55, other: 40 });
  });

  it('aucune nue nulle part : idem — les cibles tranchent', () => {
    const opp = resolveOpposed(tr(40, 1), tr(55, 1));
    expect(opp.winner).toBe('defender');
    expect(opp.decidedBy).toBe('valeur');
  });

  it('les DEUX nues posées : la nue tranche — le camp pénalisé l’emporte malgré une cible plus basse', () => {
    // Attaquant sain (nue 40, cible 40) contre défenseur pénalisé (nue 45, cible 25) : à DR égal,
    // c'est la Compétence qui départage (LDB 12 l.160), pas la cible modifiée.
    const opp = resolveOpposed(tr(40, 1, 40), tr(25, 1, 45));
    expect(opp.winner).toBe('defender');
    expect(opp.decidedBy).toBe('valeur');
    const [, why] = opposedReasons(opp);
    expect(why).toEqual({ by: 'valeur', own: 45, other: 40 });
  });
});

describe('#1153 L6 — les producteurs de combat POSENT leur nue (accesseur canon)', () => {
  it('attaque de mêlée : `base` = `combatBaseValue`, pas la valeur de combat fondue', () => {
    const attacker = hero({ skills: SKILLS_CC, conditions: [{ id: COND.empoisonne, value: 1 }] });
    const defender = hero({ skills: SKILLS_DODGE });
    const t = rollMeleeAttacker(attacker, defender, epee, makeRNG(3));
    expect(t.base).toBe(combatBaseValue(attacker, 'melee', epee));
  });

  it('défense : `base` = `defenseBaseValue` — l’Encombrement reste dans la CIBLE, hors du départage', () => {
    const defender = hero({ skills: SKILLS_DODGE, enc: 14 }); // palier 2 → −20 en Agilité (LDB 61)
    const t = rollMeleeDefender(defender, 'esquive', makeRNG(3));
    expect(defenseBaseValue(defender, 'esquive')).toBe(45);
    expect(defenseValue(defender, 'esquive')).toBe(25); // la valeur testée, elle, porte la charge
    expect(t.base).toBe(45);
  });

  it('Empoignade (Force) et Désengagement (Corps à corps) posent aussi la leur', () => {
    const c = hero({ skills: SKILLS_CC });
    expect(rollGrappleForce(c, makeRNG(5)).base).toBe(c.characteristics.force);
    expect(rollDisengageAttack(c, makeRNG(5)).base).toBe(combatBaseValue(c, 'melee', epee));
    expect(combatValue(c, 'melee', epee)).toBe(combatBaseValue(c, 'melee', epee)); // sain : identité, la nue n'invente rien
  });
});

/**
 * La nue doit SURVIVRE au détail de jet : la fenêtre de défense oppose un attaquant RÉHYDRATÉ
 * (`hydrateTR(attackerDetail)`) au jet frais du défenseur, et la Chance re-hydrate le défenseur de son
 * propre détail. Tant que le détail ne portait que la valeur TESTÉE (`RollBreakdown.base`), ces deux
 * chemins reprenaient la fondue : mixte au premier, verdict qui BOUGE au second — à jet inchangé.
 */
describe('#1153 L6 — la nue survit au RollBreakdown (fenêtre de défense, Chance)', () => {
  /** Attaquant sous un effet char-qualifié +20 (`testMod{capacite-de-combat}`) : fondue 70 ≠ nue 50. */
  const boosted = (): Combatant => ({
    ...hero({ skills: SKILLS_CC }),
    activeEffects: [{ label: 'Bénédiction de Bataille', testModChar: 'capacite-de-combat', testMod: 20 }],
  } as unknown as Combatant);

  it('l’attaquant réhydraté de son détail garde sa NUE — pas de mixte contre le défenseur frais', () => {
    const A = boosted();
    const D = hero({ skills: SKILLS_DODGE, chars: { agilite: 50 } }); // nue 65, aucun modificateur
    expect([combatBaseValue(A, 'melee', epee), combatValue(A, 'melee', epee)]).toEqual([50, 70]);
    const res = resolveMelee(A, D, epee, makeRNG(3));
    const atk = hydrateTR(res.attackerDetail!);
    const def = rollMeleeDefender(D, 'esquive', makeRNG(9));
    expect(atk.base, 'la nue traverse le détail d’attaque').toBe(50);
    expect(def.base).toBe(defenseBaseValue(D, 'esquive'));
    // À DR égal, 50 (nue de l'attaquant) < 45+20 (nue du défenseur) : le RAW donne le défenseur. Avec
    // la fondue 70, l'attaquant l'emportait — sur une grandeur que l'écran ne montre nulle part.
    expect(defenseBaseValue(D, 'esquive')).toBe(65);
    expect(resolveOpposed({ ...atk, sl: 2 }, { ...def, sl: 2 }).winner).toBe('defender');
  });

  it('la Chance ne change pas la GRANDEUR du départage : même nue avant et après re-hydratation', () => {
    const A = hero({ skills: SKILLS_CC });
    const D = hero({ skills: SKILLS_DODGE, enc: 14 }); // fondue 25 ≠ nue 45
    const atk = hydrateTR(resolveMelee(A, D, epee, makeRNG(3)).attackerDetail!);
    const def1 = rollMeleeDefender(D, 'esquive', makeRNG(9));
    const detail = finishMelee(A, D, epee, atk, def1, 'esquive').defenderDetail!;
    const def2 = hydrateTR(detail); // exactement `FLOWS.defense.bonus.derive`, hors bumpSL
    expect(detail.base, 'le détail AFFICHE toujours la valeur testée').toBe(defenseValue(D, 'esquive'));
    expect(def2.base, 'mais le jet réhydraté reprend la NUE').toBe(def1.base);
    expect(def2.base).toBe(45);
  });
});
