/**
 * Réserve de Focalisation : LDB 46 l.128-132 (option désactivée) ; VDM 02 l.48, l.131-137 sous
 * `magie-vdm-incantation`. Couture unique `castingNumberOf(…, caster)` → `reserveDeFocalisation`.
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { Combatant } from './types';
import { setRule, resetRule } from './policy';
import {
  castingNumberOf, niSansFocalisation, reserveDeFocalisation, focalisationAboutie, evaluateCasting,
  castOvercastBudget, incantationFocaliseeEchouee, rederiveCastSL, castLandProbability, type CastResult,
} from './magic';
import { overcastBudget, overcastSourceOf } from './overcast';
import { findSpellById } from '../data';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';
import type { TestResult } from './tests';
import type { CastingNumberMod } from './castingNumber';

const RULE = 'magie-vdm-incantation';
const LU_AU_GRIMOIRE: CastingNumberMod[] = [{ multiply: 2, source: { book: 'VDM', page: 162 }, desc: 'grimoire' }];
afterEach(() => resetRule(RULE));

function wiz(focus?: Combatant['focus'], focalisation: { spec?: string } = { spec: 'feu' }): Combatant {
  return blessuresSurLeProfil({
    id: 'w', label: 'Sorcière', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 50, 'force-mentale': 45, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [
      { id: 'langue', spec: 'magick', advances: 10 },
      { id: 'focalisation', ...focalisation, advances: 10 },
    ] as never,
    talents: [],
    ...(focus ? { focus } : {}),
  }) as Combatant;
}

const sort = (id: string) => findSpellById(id)!;
const CAUTERISER = sort('cauteriser'); // Feu, NI 4
const COEURS = sort('coeurs-ardents'); // Feu, NI 8
const ILLUSION = sort('illusion'); // Ombres, NI 8
const ARME = sort('arme-aethyrique'); // Arcane commun, NI 2
const jet = (sl: number, success = true): TestResult => ({ roll: success ? 22 : 87, target: 50, success, sl, isDouble: false });

describe('option désactivée — LDB 46 l.132, inchangé', () => {
  it('Focalisation aboutie : NI 0 sur CE sort seulement ; inaboutie : aucun effet', () => {
    const c = wiz({ spell: 'cauteriser', dr: 4 });
    expect(castingNumberOf(CAUTERISER, {}, [], c)).toBe(0);
    expect(castingNumberOf(COEURS, {}, [], c)).toBe(8);
    expect(castingNumberOf(CAUTERISER, {}, [], wiz({ spell: 'cauteriser', dr: 3 }))).toBe(4);
  });

  it('NI 0 même quand un modificateur porté le relève (grimoire ×2)', () => {
    expect(castingNumberOf(CAUTERISER, {}, LU_AU_GRIMOIRE, wiz({ spell: 'cauteriser', dr: 4 }))).toBe(0);
  });

  it('échec du jet → perte ; réussite sous un DR abaissé → pas de perte', () => {
    const c = wiz({ spell: 'cauteriser', dr: 4 });
    expect(incantationFocaliseeEchouee(evaluateCasting(c, CAUTERISER, jet(-2, false)))).toBe(true);
    expect(incantationFocaliseeEchouee({ ...evaluateCasting(c, CAUTERISER, jet(1)), sl: -1, cast: false })).toBe(false);
  });

  it('budget de Surincantation sur NI 0', () => {
    const res = evaluateCasting(wiz({ spell: 'cauteriser', dr: 4 }), CAUTERISER, jet(3));
    expect(res.niRequired).toBe(0);
  });
});

describe('option VDM — réserve du Vent (VDM 02 l.131-133)', () => {
  it('réduit de 1 par DR, plancher 0, tout sort du même Vent', () => {
    setRule(RULE, true);
    expect(castingNumberOf(COEURS, {}, [], wiz({ spell: 'cauteriser', dr: 2 }))).toBe(6);
    expect(castingNumberOf(COEURS, {}, [], wiz({ spell: 'cauteriser', dr: 9 }))).toBe(0);
    expect(castingNumberOf(CAUTERISER, {}, [], wiz({ spell: 'cauteriser', dr: 2 }))).toBe(2);
  });

  it('autre Vent : aucun effet ; Arcane commun et Focalisation non spécialisée : profitent', () => {
    setRule(RULE, true);
    expect(castingNumberOf(ILLUSION, {}, [], wiz({ spell: 'cauteriser', dr: 2 }))).toBe(8);
    expect(castingNumberOf(ARME, {}, [], wiz({ spell: 'cauteriser', dr: 1 }))).toBe(1);
    expect(castingNumberOf(ILLUSION, {}, [], wiz({ spell: 'cauteriser', dr: 2 }, {}))).toBe(6);
  });

  it('une Prière ne consomme pas la réserve', () => {
    setRule(RULE, true);
    expect(reserveDeFocalisation(wiz({ spell: 'cauteriser', dr: 2 }, {}), sort('benediction-de-bataille'))).toBe(0);
  });

  it('Surincantation : budget sur le NI réduit, la réserve jamais ajoutée au DR (l.137)', () => {
    setRule(RULE, true);
    const res = evaluateCasting(wiz({ spell: 'cauteriser', dr: 3 }), COEURS, jet(7));
    expect(res.niRequired).toBe(5);
    expect(res.sl).toBe(7);
    expect(castOvercastBudget(COEURS, res, undefined)).toBe(overcastBudget(overcastSourceOf(COEURS), 7, 5));
  });

  it('échec du jet, puis réussite au DR sous le NI réduit : perte et Imparfaite Mineure (l.48, l.135)', () => {
    setRule(RULE, true);
    const c = wiz({ spell: 'cauteriser', dr: 3 });
    expect(incantationFocaliseeEchouee(evaluateCasting(c, COEURS, jet(-2, false)))).toBe(true);
    const sous = evaluateCasting(c, COEURS, jet(4));
    expect(sous.cast).toBe(false);
    expect(incantationFocaliseeEchouee(sous)).toBe(true);
    expect(incantationFocaliseeEchouee(evaluateCasting(c, COEURS, jet(5)))).toBe(false);
  });

  it('rejeu Chance et probabilité relisent le NI réduit', () => {
    setRule(RULE, true);
    const c = wiz({ spell: 'cauteriser', dr: 3 });
    const cur: CastResult = evaluateCasting(c, COEURS, jet(4));
    expect(rederiveCastSL(c, c, COEURS, cur, false, 1).cast).toBe(true);
    expect(castLandProbability(c, COEURS)).toBeGreaterThan(castLandProbability(wiz(), COEURS));
  });

  it('accumulation et dissipation : NI sans réserve ; aboutie contre ce NI', () => {
    setRule(RULE, true);
    const c = wiz({ spell: 'coeurs-ardents', dr: 8 });
    expect(niSansFocalisation(COEURS, c)).toBe(8);
    expect(focalisationAboutie(c, COEURS)).toBe(true);
    expect(castingNumberOf(COEURS, {}, [], c)).toBe(0);
  });
});
