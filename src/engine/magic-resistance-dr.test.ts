/**
 * Résistance à la Magie (#1007) — la réduction vit au DR du Sort, jamais aux Blessures finales.
 *
 * RAW : trait `LDB 85 l.302` (« Le DR de tous les Sorts l'affectant est réduit du nombre indiqué »),
 * talent `LDB 10 l.1026` (« réduit de 2 par point (…) uniquement modifié par le plus haut score du
 * Talent (…) dans la zone de sa cible »), Dégâts d'un Projectile `LDB 46 l.101`, plancher de 1
 * Blessure `LDB 13 l.155-163`.
 *
 * Fixture du juge : BFM 4 / BE 3 / Projectile Dégâts +4 / DR 3 / Résistance 2.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setRule, resetRule } from './policy';
import {
  evaluateMissile, applyFullPower, spellDRModFor, spellSLFor, spellLandsOn, traitSpellDRMod, talentSpellDRMod,
  zoneTalentSpellDRMod, type CastResult,
} from './magic';
import type { Combatant } from './types';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

const VDM = 'magic-vdm-incantation';

function mk(p: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id: 'c', label: 'Sujet', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 42, sociabilite: 30 },
    wounds: blessuresDeBase(14), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], traits: [], spells: [], xp: 0,
    ...p,
  }) as Combatant;
}

const ap = (n: number) => ({ tete: n, brasG: n, brasD: n, corps: n, jambeG: n, jambeD: n });
/** Projectile SANS attribut de Domaine : Dégâts du Sort + DR + BFM seulement. NI 1. */
const projectile = { label: 'Trait d’essai', type: 'Magie des Arcanes', domainId: null, missile: true, damage: 4, cn: 1, range: null, target: 1, duration: null, desc: 'Projectile magique, Dégâts +4.' };
/** Jet réussi 44 (loc stable par dé inversé), DR 3, NI requis figé par `evaluateCasting`. */
const cast = (sl: number, niRequired = 1): CastResult => ({ cast: true, roll: 44, target: 60, sl, isCritical: false, isFumble: false, niRequired, log: 'jet' });

const caster = mk({ id: 'w', label: 'Mage' }); // BFM 4
const nu = () => mk({ id: 't', kind: 'enemy' }); // BE 3, aucune PA, aucune résistance
const trait2 = (over: Partial<Combatant> = {}) => mk({ id: 't', kind: 'enemy', traits: [{ id: 'resistance-a-la-magie', value: 2 }], ...over });
const talent = (times: number, over: Partial<Combatant> = {}) => mk({ id: 't', kind: 'enemy', talents: [{ talentId: 'resistance-a-la-magie', times }], ...over });

afterEach(() => resetRule(VDM));

describe('#1007 — Collecteurs : la réduction vient de la DONNÉE (op passive `incomingSpellDRMod`)', () => {
  it('trait : −1 par point d’Indice (`LDB 85 l.302`)', () => {
    expect(traitSpellDRMod(trait2())).toBe(-2);
    expect(traitSpellDRMod(mk({ traits: [{ id: 'resistance-a-la-magie', value: 5 }] }))).toBe(-5);
    expect(traitSpellDRMod(nu())).toBe(0);
  });
  it('talent : −2 par niveau (`LDB 10 l.1026`)', () => {
    expect(talentSpellDRMod(talent(1))).toBe(-2);
    expect(talentSpellDRMod(talent(3))).toBe(-6);
    expect(talentSpellDRMod(nu())).toBe(0);
  });
  it('#1007 DIVERGENCE 5 (clause de zone) : le plus haut score du TALENT parmi les cibles s’applique à tout le lancement', () => {
    const zone = [nu(), talent(1), talent(3)];
    expect(zoneTalentSpellDRMod(zone)).toBe(-6);
    expect(spellDRModFor(zone[0], zoneTalentSpellDRMod(zone))).toBe(-6); // la cible SANS talent subit le DR réduit de la zone
    expect(spellDRModFor(zone[1], zoneTalentSpellDRMod(zone))).toBe(-6); // jamais son propre −2
  });
  it('cumul Trait+Talent sur une MÊME cible : le plus FORT seul, jamais la somme (arbitrage 2026-08-03, #1040)', () => {
    // Trait 2 (−2, `LDB 85 l.302`) vs Talent 1 (−2) → −2 ; vs Talent 2 (−4) → −4. Jamais −4 / −6.
    expect(spellDRModFor(trait2({ talents: [{ talentId: 'resistance-a-la-magie', times: 1 }] }))).toBe(-2);
    expect(spellDRModFor(trait2({ talents: [{ talentId: 'resistance-a-la-magie', times: 2 }] }))).toBe(-4);
    expect(spellSLFor(5, trait2({ talents: [{ talentId: 'resistance-a-la-magie', times: 1 }] }))).toBe(3);
    // Le TRAIT seul et le TALENT seul restent leur propre réduction.
    expect(spellDRModFor(trait2())).toBe(-2);
    expect(spellDRModFor(talent(1))).toBe(-2);
  });
  it('entre TALENTS, le plus haut score de la zone s’applique SEUL (`LDB 10 l.1026`, verbatim de talents.json)', () => {
    const zone = [talent(1), talent(3)];
    expect(zoneTalentSpellDRMod(zone), 'jamais −2 + −6').toBe(-6);
    expect(spellDRModFor(zone[0], zoneTalentSpellDRMod(zone)), 'aucun trait ici : le talent de zone seul').toBe(-6);
  });
  it('DR réduit plancher à 0 (jamais négatif)', () => {
    expect(spellSLFor(1, talent(3))).toBe(0);
  });
});

describe('#1007 — sonde du juge : les 6 divergences mesurées (BFM 4 / BE 3 / Projectile +4 / DR 3 / MR 2)', () => {
  it('DIFFÉRENTIEL — cible SANS résistance : Dégâts et Blessures inchangés (4 + DR 3 + BFM 4)', () => {
    const r = evaluateMissile(caster, nu(), projectile as never, cast(3));
    expect(r.hit).toBe(true);
    expect(r.damage).toBe(11);
    expect(r.woundsLost).toBe(8); // 11 − BE 3
    expect(spellDRModFor(nu())).toBe(0);
    expect(spellSLFor(3, nu())).toBe(3);
    expect(spellLandsOn(cast(3), nu())).toBe(true);
  });

  it('la réduction passe par le DR : Dégâts 4 + (3−2) + 4 = 9, Blessures 6', () => {
    const r = evaluateMissile(caster, trait2(), projectile as never, cast(3));
    expect(r.damage).toBe(9);
    expect(r.woundsLost).toBe(6);
  });

  it('#1007 DIVERGENCE 1 — PA 6 : le plancher de 1 Blessure TIENT (le code rendait 0, la cible blindée devenait immunisée)', () => {
    const r = evaluateMissile(caster, trait2({ armour: ap(6) }), projectile as never, cast(3));
    expect(r.damage).toBe(9); // 4 + (3−2) + 4
    expect(r.woundsLost).toBe(1); // max(1, 9 − (3 + 6)) — LDB 13 l.155-163
    const temoin = evaluateMissile(caster, mk({ id: 't', kind: 'enemy', armour: ap(6) }), projectile as never, cast(3));
    expect(temoin.woundsLost).toBe(2); // 11 − 9 : la résistance retire bien 1 Blessure, pas 2
  });

  it('#1007 DIVERGENCE 2 — option VDM ON : le DR n’entre plus dans les Dégâts, la réduction ne retire RIEN', () => {
    setRule(VDM, true);
    const resistant = evaluateMissile(caster, trait2(), projectile as never, cast(3));
    const temoin = evaluateMissile(caster, nu(), projectile as never, cast(3));
    expect(temoin.damage).toBe(8); // 4 + BFM 4 (`VDM 02 l.68`)
    expect(resistant.damage).toBe(8);
    expect(resistant.woundsLost).toBe(5); // 8 − BE 3 (le code retirait 2 Blessures → 3)
    expect(resistant.woundsLost).toBe(temoin.woundsLost);
  });

  it('#1007 sous-point NI (DIVERGENCE 3 = périmètre) — DR réduit sous le NI : le Sort ne touche pas cette cible', () => {
    const fort = cast(3, 4); // NI 4, DR 3 : lancé sur le jet, mais 3−2 = 1 < 4 contre la cible résistante
    expect(spellLandsOn(fort, trait2())).toBe(false);
    expect(evaluateMissile(caster, trait2(), projectile as never, fort).hit).toBe(false);
    expect(spellLandsOn(fort, nu())).toBe(true); // témoin : aucune réduction → jamais regaté
    expect(evaluateMissile(caster, nu(), projectile as never, fort).hit).toBe(true);
    // BORNE : DR réduit ÉGAL au NI → le Sort touche encore (le seuil est `>=`, jamais `>`).
    expect(spellLandsOn(cast(3, 1), trait2())).toBe(true); // 3 − 2 = 1 = NI 1
    expect(evaluateMissile(caster, trait2(), projectile as never, cast(3, 1)).hit).toBe(true);
    // « Puissance totale » (LDB 46 l.31) : « le Sort est lancé, quels que soient son NI et votre DR
    // obtenu » — le NI ne se re-confronte plus, même contre une cible résistante.
    setRule(VDM, true);
    const pleine = applyFullPower({ ...fort, cast: false, isCritical: true });
    expect(pleine.niRequired).toBeUndefined();
    expect(spellLandsOn(pleine, trait2())).toBe(true);
  });

  it('#1007 DIVERGENCE 5 — le TALENT de la zone s’applique à une cible qui ne le porte pas', () => {
    const sansTalent = nu();
    const zoneMod = zoneTalentSpellDRMod([sansTalent, talent(1)]);
    expect(zoneMod).toBe(-2);
    const r = evaluateMissile(caster, sansTalent, projectile as never, { ...cast(3), zoneSpellDRMod: zoneMod });
    expect(r.damage).toBe(9); // 4 + (3−2) + 4
    expect(r.woundsLost).toBe(6);
    const horsZone = evaluateMissile(caster, sansTalent, projectile as never, cast(3)); // témoin : la même cible seule
    expect(horsZone.damage).toBe(11);
  });
});
