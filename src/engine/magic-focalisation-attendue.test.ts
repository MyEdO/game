/**
 * `focusExpectedStep` (#4821) : l'espérance du pas d'un Round de Focalisation est la moyenne, sur les 100 jets
 * possibles, du pas que `resolveFocus` produit au même jet. LDB 46 l.128-132 ; LDB 46 l.173 ; LDB 12 l.170-185
 */
import { describe, it, expect } from 'vitest';
import { castingNumberOf, focusExpectedStep, resolveFocus } from './magic';
import { extendedTestStep } from './tests';
import { findSpellById } from '../data';
import type { Combatant } from './types';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

function sorcier(p: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id: 'w', label: 'Sorcier', kind: 'ennemi',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 55, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ id: 'langue', spec: 'magick', advances: 10 }, { id: 'focalisation', spec: 'cieux', advances: 10 }] as never,
    talents: [], spells: ['arc-de-t-essla'], xp: 0,
    ...p,
  }) as Combatant;
}

const arc = findSpellById('arc-de-t-essla')!;

/** Pas moyen des 100 Rounds que `resolveFocus` joue, le dé forcé à chaque valeur de 1 à 100. */
function pasMoyenJoue(c: Combatant): number {
  const ni = castingNumberOf(arc, false, {}, [], c);
  let somme = 0;
  for (let r = 1; r <= 100; r++) {
    const res = resolveFocus(c, arc, { int: () => r });
    somme += extendedTestStep(0, { success: res.success, sl: res.success ? res.dr : res.sl ?? 0 }, ni).sl;
  }
  return somme / 100;
}

describe('focusExpectedStep — espérance des Rounds de resolveFocus', () => {
  it('égale le pas moyen des 100 jets de resolveFocus, et rend le NI du Sort', () => {
    const c = sorcier();
    expect(focusExpectedStep(c, arc)).toEqual({ pas: pasMoyenJoue(c), ni: castingNumberOf(arc, false, {}, [], c) });
  });

  it('suit le doublement de la malepierre portée comme resolveFocus', () => {
    const c = sorcier({ items: [{ uid: 'm', id: 'malepierre', niPerGram: 20 }] as never });
    const attendu = focusExpectedStep(c, arc)!;
    expect(attendu.pas).toBe(pasMoyenJoue(c));
    expect(attendu.pas).toBeGreaterThan(focusExpectedStep(sorcier(), arc)!.pas);
  });

  it('sans Compétence de Focalisation du Vent : null', () => {
    expect(focusExpectedStep(sorcier({ skills: [{ id: 'langue', spec: 'magick', advances: 10 }] as never }), arc)).toBeNull();
  });
});
