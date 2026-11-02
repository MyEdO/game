/**
 * Départage d'égalité du chemin MAGIE — LDB 12 l.160 (#1150, suite de #1149).
 *
 * « Si les deux participants obtiennent le même DR, c'est le groupe avec la Compétence ou la
 * Caractéristique la plus élevée qui l'emporte. » La Compétence, elle, se lit `LDB 09 l.17` :
 * « la Caractéristique associée [+] le nombre d'Augmentations prises ».
 *
 * Ce que ces cas verrouillent : la grandeur comparée est le NIVEAU DE COMPÉTENCE (`castingBaseValue`),
 * relu à sa source par les deux points de passage du chemin magie (`evaluateCasting` côté lanceur,
 * `counterspellOutcomeFrom` côté chanteur) — jamais la valeur TESTÉE, qui fond l'Avantage
 * (LDB 46 l.123-125), le contrecoup, le ward de circonstance et le Soutien (LDB 12 l.189).
 * Les jets passent donc par la COMPOSITION RÉELLE (`resolveCasting`/`resolveCounterspell`), pas par
 * des `base` posés à la main.
 */
import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { evaluateTest, resolveOpposed } from './tests';
import {
  castingBaseValue, castingValue, castTestOf, counterspellOutcomeFrom, evaluateCasting,
  resolveCasting, type CastResult, type SpellLike,
} from './magic';
import type { Characteristics, Combatant, SkillInstance } from './types';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

const ARCANE: SpellLike = { label: 'Sort d’essai', ecole: 'Magie des Arcanes', family: 'arcane', cn: 1, duration: { kind: 'instant' }, desc: '' };

function mage(intelligence: number, advances: number, over: Partial<Combatant> = {}, id = 'c'): Combatant {
  const base: Characteristics = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
  const skills: SkillInstance[] = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances }];
  return blessuresSurLeProfil({
    id, label: `Mage ${id}`, kind: 'hero',
    characteristics: { ...base, intelligence },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills, talents: [], traits: [], spells: [], xp: 0, movement: 4,
    ...over,
  }) as unknown as Combatant;
}

/** Jet d'incantation FIGÉ d'un lanceur de Niveau 45, obtenu par la composition réelle (dé 13, cible 25
 *  sous Difficile) — reconstruit ici pour opposer un DR contrôlé. */
const cast45 = (): CastResult => evaluateCasting(mage(30, 15), ARCANE, evaluateTest(13, 25, 999));

describe('LDB 12 l.160 — le chemin MAGIE départage sur le NIVEAU DE COMPÉTENCE (#1150)', () => {
  it('`castingBaseValue` = Caractéristique + Augmentations SEULES ; `castingValue` y ajoute les modificateurs', () => {
    const nu = mage(48, 15);
    const avantage = mage(48, 15, { advantage: 2 });
    expect(castingBaseValue(nu, 'langue', 'magick')).toBe(63);
    expect(castingBaseValue(avantage, 'langue', 'magick'), 'l’Avantage est un modificateur, pas un Niveau de Compétence').toBe(63);
    expect(castingValue(avantage, 'langue', 'magick'), 'la valeur TESTÉE, elle, porte l’Avantage (LDB 46 l.123-125)').toBe(83);
  });

  it('CONTRAT (a) : `resolveCasting.base` est la NUE — insensible à l’Avantage, au ward et à la Difficulté', () => {
    const nu = resolveCasting(mage(48, 15), ARCANE, makeRNG(7), 'difficile');
    // 2 Avantage (+20) ET un ward de circonstance (+15, `extraMod`) : la cible bouge, la Compétence non.
    const charge = resolveCasting(mage(48, 15, { advantage: 2 }), ARCANE, makeRNG(7), 'difficile', false, 15);
    expect(nu.base).toBe(63);
    expect(charge.base, 'l’Avantage/le ward ont fui dans la valeur nue').toBe(63);
    expect(charge.target, 'ils restent, eux, dans la cible testée').toBe(63 + 20 + 15 - 20);
    expect(castTestOf(charge).base, '`castTestOf` doit reconduire la NUE').toBe(63);
  });

  it('CONTRAT (b) : à DR égal, la nue la plus haute l’emporte — le contre-lanceur 50 dissipe un lanceur 45 SOUTENU', () => {
    // Sonde de RÉGRESSION (juge G-2) : le chanteur est SOUTENU (+20) et le lanceur a 2 Avantage — les
    // valeurs testées s'inversent (65 contre 50+20), les Compétences NUES restent 45 < 50.
    const caster = mage(30, 15, { advantage: 2 });     // Langue (Magick) NUE 45, testée 65
    const counter = mage(35, 15, {}, 'k');             // Langue (Magick) NUE 50
    expect(castingBaseValue(caster, 'langue', 'magick')).toBe(45);
    expect(castingBaseValue(counter, 'langue', 'magick')).toBe(50);
    const cast = evaluateCasting(caster, ARCANE, evaluateTest(13, 65, 999)); // dé 13 sur cible 65 → DR 5
    const counterT = evaluateTest(23, 70, 999);                              // Soutien +20 → cible 70, DR 7-2=5
    expect(counterT.sl).toBe(cast.sl); // DR égal : le départage joue
    const out = counterspellOutcomeFrom(counter, counterT, castTestOf(cast));
    expect(out.dispelled, 'nue 50 > 45 : le Contre-sort l’emporte et dissipe').toBe(true);
    expect(out.counter.base, 'la nue du chanteur est relue, Soutien exclu (LDB 12 l.189)').toBe(50);
  });

  it('à DR égal, le lanceur l’emporte quand SA nue est la plus haute (le Sort n’est pas dissipé)', () => {
    const cast = cast45();
    const counter = mage(30, 0, {}, 'k'); // Langue (Magick) NUE 30
    const counterT = evaluateTest(23, 30, 999);
    expect(counterT.sl).toBe(cast.sl);
    const opp = resolveOpposed(castTestOf(cast), counterspellOutcomeFrom(counter, counterT, castTestOf(cast)).counter);
    expect(opp.decidedBy).toBe('valeur');
    expect(opp.winner).toBe('attacker');
    expect(counterspellOutcomeFrom(counter, counterT, castTestOf(cast)).dispelled).toBe(false);
  });

  it('DR ET Niveaux de Compétence égaux → statu quo, aucun vainqueur (aucune dissipation)', () => {
    const cast = cast45();
    const counter = mage(30, 15, {}, 'k'); // NUE 45, comme le lanceur
    const counterT = evaluateTest(13, 25, 999);
    const opp = resolveOpposed(castTestOf(cast), counterspellOutcomeFrom(counter, counterT, castTestOf(cast)).counter);
    expect(opp.decidedBy).toBe('egalite');
    expect(opp.winner).toBe('tie');
    expect(counterspellOutcomeFrom(counter, counterT, castTestOf(cast)).dispelled).toBe(false);
  });

  it('Compat : une incantation RÉHYDRATÉE sans nue fait retomber les DEUX camps sur leurs cibles', () => {
    const legacy: CastResult = { cast: true, roll: 13, target: 25, sl: 1, isCritical: false, isFumble: false, log: '' };
    const counterT = evaluateTest(23, 30, 30);
    const opp = resolveOpposed(castTestOf(legacy), counterT);
    expect(opp.decidedBy).toBe('valeur');
    expect(opp.winner, 'tout-ou-rien : jamais une nue contre une cible modifiée').toBe('defender');
  });
});
