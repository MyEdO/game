/**
 * Les SPÉCIAUX d'un jeu de taverne (NADJ 16 l.82) et la clause d'égalité déclarée (NADJ 16 l.105),
 * au MOTEUR : `specialsApplicables`, `difficulteDuJoueur`, `resolveTavernRound`, `fastTavernGame`.
 */
import { describe, expect, it } from 'vitest';
import { makePregens } from '../data/pregens';
import {
  difficulteDuJoueur, fastTavernGame, findTavernGameById, resolveTavernRound, specialsApplicables, type TavernSpecial,
} from './tavernGame';
import type { Combatant } from './types';
import type { TestResult } from './tests';

const SOURCE = { book: 'nuits-agitees-et-dures-journees', page: 93 };
const cran = (crans: number): TavernSpecial => ({ effet: 'cran', hasTalent: 'tireur-d-elite', steps: crans, source: SOURCE });

/** Un héros, avec ou sans Tireur d'élite. */
function heros(tireur: boolean): Combatant {
  const h = makePregens()[0] as Combatant;
  const autres = (h.talents ?? []).filter((t) => t.talentId !== 'tireur-d-elite');
  return { ...h, talents: tireur ? [...autres, { talentId: 'tireur-d-elite', times: 1 }] : autres };
}

describe('difficulteDuJoueur — NADJ 16 l.82', () => {
  it('« un cran plus facile » : Accessible devient Facile', () => {
    expect(difficulteDuJoueur('accessible', [cran(1)])).toBe('facile');
  });
  it('sans Spécial, la Difficulté de base reste', () => {
    expect(difficulteDuJoueur('accessible', [])).toBe('accessible');
  });
  it('les Spéciaux s’appliquent dans leur ordre de déclaration', () => {
    const impose: TavernSpecial = { effet: 'difficulte', hasTalent: 'tireur-d-elite', difficulty: 'difficile', source: SOURCE };
    expect(difficulteDuJoueur('accessible', [impose])).toBe('difficile');
    expect(difficulteDuJoueur('accessible', [impose, cran(1)])).toBe('complexe');
    expect(difficulteDuJoueur('accessible', [cran(1), impose])).toBe('difficile');
  });
});

describe('specialsApplicables — « si vous avez le Talent » (NADJ 16 l.82)', () => {
  const arene = findTavernGameById('arene')!;
  it('le porteur du Talent reçoit le Spécial de l’Arène', () => {
    expect(specialsApplicables(arene, heros(true))).toEqual(arene.specials);
    expect(arene.specials?.length).toBe(1);
  });
  it('sans le Talent, ou sans fiche, aucun', () => {
    expect(specialsApplicables(arene, heros(false))).toEqual([]);
    expect(specialsApplicables(arene, undefined)).toEqual([]);
  });
});

describe('fastTavernGame — le régime RAPIDE (NADJ 16 l.11) ne joue aucun Spécial', () => {
  it('la projection n’emporte pas `specials`', () => {
    const arene = findTavernGameById('arene')!;
    expect(arene.specials?.length).toBe(1);
    expect(fastTavernGame(arene)).not.toHaveProperty('specials');
  });
});

describe('resolveTavernRound — la clause d’égalité DÉCLARÉE remplace le départage général', () => {
  const jet = (base: number, sl: number): TestResult => ({ roll: 30, target: base + 20, base, sl, success: true, isDouble: false });
  it('Dominos (`tieBreak` déclaré) : à DR égal, la valeur ne départage pas', () => {
    expect(resolveTavernRound(findTavernGameById('dominos')!, jet(30, 2), jet(60, 2)).winner).toBe('tie');
  });
  it('sans clause (régime rapide), la valeur la plus haute l’emporte (LDB 12 l.160)', () => {
    expect(resolveTavernRound(fastTavernGame(findTavernGameById('dominos')!), jet(30, 2), jet(60, 2)).winner).toBe('opponent');
  });
  it('avec clause, le DR décide toujours d’abord', () => {
    expect(resolveTavernRound(findTavernGameById('dominos')!, jet(30, 3), jet(60, 2)).winner).toBe('player');
  });
});
