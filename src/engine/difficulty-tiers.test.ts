import { describe, it, expect } from 'vitest';
import { rollTest, difficulteDeLArg, easeDifficulty, DIFFICULTY_LADDER } from './tests';
import { DIFFICULTY_MODIFIERS } from './types';
import { makeRNG } from './dice';

/**
 * Difficultés extrêmes de L'Ennemi dans l'Ombre (EDO App.2 l.156-165, « MAIS C'EST IMPOSSIBLE ! ») :
 * Presque Impossible (−40) et Impossible (−50), au-delà de Très Difficile (−30) du Livre de base.
 */
describe('Difficultés extrêmes EDO — Presque Impossible (−40) / Impossible (−50)', () => {
  it('DIFFICULTY_MODIFIERS porte les deux paliers', () => {
    expect(DIFFICULTY_MODIFIERS.presqueImpossible).toBe(-40);
    expect(DIFFICULTY_MODIFIERS.impossible).toBe(-50);
  });

  it('rollTest applique −50 / −40 sur la valeur cible (hors zone de clamp)', () => {
    const rng = makeRNG(1);
    // 80 − 50 = 30 ; 80 − 40 = 40 : aucune borne ne s'interpose, le modificateur brut transparaît.
    expect(rollTest(80, 'impossible', rng).target).toBe(30);
    expect(rollTest(80, 'presqueImpossible', rng).target).toBe(40);
  });

  it('Impossible peut écraser la cible jusqu’au plancher de la policy (targetMin = 1)', () => {
    const rng = makeRNG(1);
    // 50 − 50 = 0 → clampé au plancher des valeurs cible (LDB 12 : 1..99).
    expect(rollTest(50, 'impossible', rng).target).toBe(1);
  });

  it('difficulteDeLArg désigne chacun des deux paliers par son id (EDO App.2 l.156-165)', () => {
    expect(difficulteDeLArg('presqueImpossible')).toBe('presqueImpossible');
    expect(difficulteDeLArg('impossible')).toBe('impossible');
  });

  it('DIFFICULTY_LADDER reste trié facile→dur, les deux paliers à l’extrémité dure', () => {
    const mods = DIFFICULTY_LADDER.map((d) => DIFFICULTY_MODIFIERS[d]);
    // Strictement décroissant : chaque cran est plus dur que le précédent.
    for (let i = 1; i < mods.length; i++) expect(mods[i]).toBeLessThan(mods[i - 1]);
    const n = DIFFICULTY_LADDER.length;
    expect(DIFFICULTY_LADDER[n - 1]).toBe('impossible');
    expect(DIFFICULTY_LADDER[n - 2]).toBe('presqueImpossible');
  });

  it('easeDifficulty remonte d’un cran : impossible → presqueImpossible → tresDifficile', () => {
    expect(easeDifficulty('impossible', 1)).toBe('presqueImpossible');
    expect(easeDifficulty('impossible', 2)).toBe('tresDifficile');
  });
});
