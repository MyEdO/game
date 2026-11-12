/**
 * Le coup encaissé hors bataille (#3892) : le flux EXISTANT `applyAttackResult`, `battle` nul, l'assaillant passé
 * par valeur (ni en bataille, ni au groupe). `.claude/rules/moteur-et-flux.md:13`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { heroDuDuel } from './combatDeTest.testkit';
import { imposerLesD100 } from './battleRng.testkit';
import { battleRng } from './battleRng';
import { applyAttackResult } from './combatFlow';
import { testScene } from '../scenes/test-fixture';
import { blesseDeTest, combattantDeTest } from '../engine/combattantDeTest.testkit';
import { ligneDuCoup, resolveMelee } from '../engine/combat';
import { addCondition, hasCondition, isOutOfAction } from '../engine/conditions';
import { resetRule, setRule } from '../engine/policy';
import type { Combatant } from '../engine/types';
import { t as tr } from '../i18n';

afterEach(() => {
  vi.restoreAllMocks();
  resetRule('combat-cible-inconsciente');
  resetRule('combat-mort-subite');
  resetRule('combat-aa-blessures');
});

/** Le héros du groupe, scène lancée, aucune bataille ; l'assaillant, un combattant par valeur. */
function horsBataille(): { banc: Banc; H: Combatant; E: Combatant } {
  const banc = ouvrirLeBanc();
  banc.setState({ party: [heroDuDuel()] });
  banc.getState().lancerLaScene(testScene());
  expect(banc.getState().battle).toBeNull();
  return { banc, H: banc.getState().party[0], E: combattantDeTest({ id: 'assaillant', kind: 'enemy', label: 'Assaillant' }) };
}

/** Le coup de `attaquant` sur `cible`, résolu par le moteur aux d100 imposés, puis appliqué ; l'arme est celle du héros. */
function frapper(banc: Banc, attaquant: Combatant, cible: Combatant, des: number[]) {
  const arme = banc.getState().party[0].weapons[0];
  imposerLesD100(...des);
  const res = resolveMelee(attaquant, cible, arme, battleRng());
  applyAttackResult(banc.getState, banc.setState, attaquant, cible, arme, res);
  return res;
}

describe('coup encaissé hors bataille, assaillant par valeur (#3892)', () => {
  it('touche simple : Blessures retirées, la ligne du coup au journal', () => {
    const { banc, H, E } = horsBataille();
    const avant = H.wounds.current;
    const res = frapper(banc, E, H, [23, 95]);
    expect(res.hit && !!res.woundsLost).toBe(true);
    expect(H.wounds.current).toBe(avant - res.woundsLost!);
    expect(banc.getState().journal).toContain(ligneDuCoup(res));
  });

  it('Critique sur un double réussi malgré l’échange perdu : LDB 13 l.183 ; LDB 14 l.3', () => {
    const { banc, H, E } = horsBataille();
    const res = frapper(banc, E, H, [22, 12]);
    expect(res.hit).toBe(false);
    expect(res.attackerDetail).toMatchObject({ roll: 22, success: true });
    expect(H.criticalWounds).toBe(1);
  });

  it('Critique létal du double, Destin > 0 : `pendingFateSave` désigne l’assaillant par valeur', () => {
    const { banc, H, E } = horsBataille();
    expect(H.fate ?? 0).toBeGreaterThan(0);
    frapper(banc, E, H, [22, 12, 1, 100]);
    expect(banc.getState().pendingFateSave).toMatchObject({ heroId: H.id, source: 'hit', foeId: E.id });
    expect(H.dead).toBeFalsy();
  });

  it('Mort subite d’un figurant frappé par le héros : LDB 18 l.46', () => {
    const { banc, H } = horsBataille();
    setRule('combat-mort-subite', 'figurants');
    const figurant = blesseDeTest(3, { id: 'figurant', kind: 'enemy', label: 'Figurant' });
    const res = frapper(banc, H, figurant, [23, 95]);
    expect(res.woundsLost!).toBeGreaterThan(3);
    expect(isOutOfAction(figurant)).toBe(true);
    expect(figurant.slainNotified).toBe(true);
  });

  it('perte de Surpris après la première tentative de toucher : LDB 16 l.139', () => {
    const { banc, H, E } = horsBataille();
    addCondition(H, 'surpris');
    frapper(banc, E, H, [23, 95]);
    expect(hasCondition(H, 'surpris')).toBe(false);
  });

  it('mort-auto d’un héros Inconscient, Destin > 0 : `pendingFateSave` posé, rien ne lève : LDB 16 l.113', () => {
    const { banc, H, E } = horsBataille();
    setRule('combat-cible-inconsciente', 'mort-auto');
    addCondition(H, 'inconscient');
    const res = frapper(banc, E, H, [23]);
    expect(res.autoKill).toBe(true);
    expect(banc.getState().pendingFateSave).toMatchObject({ heroId: H.id, foeId: E.id });
  });

  it('mort-auto d’un héros Inconscient sans Destin : mort, `slainNotified` : LDB 16 l.113', () => {
    const { banc, H, E } = horsBataille();
    setRule('combat-cible-inconsciente', 'mort-auto');
    H.fate = 0;
    addCondition(H, 'inconscient');
    frapper(banc, E, H, [23]);
    expect(H.dead).toBe(true);
    expect(H.slainNotified).toBe(true);
    expect(banc.getState().pendingFateSave).toBeNull();
  });

  it('Martyr : le prêtre du groupe encaisse à la place de la cible : LDB 43 l.107', () => {
    const { banc, H, E } = horsBataille();
    const pretre = heroDuDuel();
    pretre.id = 'pretre';
    pretre.label = 'Prêtre';
    banc.setState({ party: [H, pretre] });
    H.activeEffects = [{ label: 'Martyr', bonus: 0, duration: { scale: 'rounds', left: 4 }, martyrGuard: pretre.id }] as never;
    const hAvant = H.wounds.current;
    const pAvant = pretre.wounds.current;
    const res = frapper(banc, E, H, [23, 95]);
    expect(res.hit).toBe(true);
    expect(H.wounds.current).toBe(hAvant);
    const encaisse = pAvant - pretre.wounds.current;
    expect(encaisse).toBeGreaterThan(0);
    expect(banc.getState().journal.join(' ')).toContain(tr('cf.martyrTakes', { priest: pretre.label, name: H.label, taken: encaisse }));
  });
});

/** Variante Aux Armes : la sévérité se tire au résolveur, sans étape (`critSeverityInSeam`). AA 07. */
describe('coup encaissé hors bataille sous `combat-aa-blessures: aa` (#3892)', () => {
  it('le coup qui fait tomber à 0 inflige la Blessure critique : AA 07 l.36', () => {
    const { banc, H, E } = horsBataille();
    setRule('combat-aa-blessures', 'aa');
    H.wounds.current = 1;
    const res = frapper(banc, E, H, [23, 95, 50, 50]);
    expect(res.woundsLost!).toBeGreaterThanOrEqual(1);
    expect(H.criticalWounds).toBe(1);
  });

  it('un double qui fait aussi tomber à 0 n’inflige qu’une Blessure critique : AA 07 l.42', () => {
    const { banc, H, E } = horsBataille();
    setRule('combat-aa-blessures', 'aa');
    H.wounds.current = 1;
    const res = frapper(banc, E, H, [22, 95, 32, 50, 50, 50]);
    expect(res.hit && res.woundsLost! >= 1).toBe(true);
    expect(res.location).toBe('brasD');
    expect(H.criticalWounds).toBe(1);
  });

  it('cible déjà à 0 Blessure : la Localisation se relance (1d100), sans inverser le jet : AA 07 l.25, l.52', () => {
    const { banc, H, E } = horsBataille();
    setRule('combat-aa-blessures', 'aa');
    H.wounds.current = 0;
    const res = frapper(banc, E, H, [23, 95, 5, 50, 50]);
    expect(res.hit).toBe(true);
    expect(res.location).toBe('tete');
    expect(H.criticalWounds).toBe(1);
  });
});
