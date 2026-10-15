import { describe, it, expect } from 'vitest';
import { progressionMovement, resolveShipManeuver } from './shipNavigation';

/**
 * PROGRESSION & MANŒUVRE d'un navire (MDG 13 « Navigation maritime ») — couche PURE, book-agnostic
 * (le « Personnage à la barre » + Test de Navigation Voile/Ramer est partagé avec le Compagnon de Mort
 * sur le Reik ch.5, fluvial). Le Test de Manœuvre = Test de Navigation modifié par la Caractéristique Man
 * du bateau (l.119). La table de Progression (l.68-75) traduit le DR en déplacement effectif.
 */
describe('progressionMovement — table de Progression (MDG 13 l.68-75)', () => {
  it('DR → déplacement effectif (M+2 / M+1 / M / M−1 / M÷2 arrondi à l’inférieur)', () => {
    expect(progressionMovement(5, 4)).toBe(7); // 4 ou plus → M+2
    expect(progressionMovement(5, 9)).toBe(7);
    expect(progressionMovement(5, 1)).toBe(6); // 1 à 3 → M+1
    expect(progressionMovement(5, 3)).toBe(6);
    expect(progressionMovement(5, 0)).toBe(5); // −2 à 0 → M
    expect(progressionMovement(5, -2)).toBe(5);
    expect(progressionMovement(5, -3)).toBe(4); // −3 à −4 → M−1
    expect(progressionMovement(5, -4)).toBe(4);
    expect(progressionMovement(5, -5)).toBe(2); // −5 ou moins → M÷2 (floor)
    expect(progressionMovement(3, -10)).toBe(1); // floor(3/2)
  });
});

describe('resolveShipManeuver — Test de Manœuvre = Navigation + Man du bateau (MDG 13 l.119)', () => {
  it('DR final = DR de Navigation + Man + extraDR ; déplacement et libellé lus à la Progression au DR final', () => {
    const r = resolveShipManeuver(2, 5, 1); // 2 + 1 = 3
    expect(r).toEqual({ dr: 3, movement: 6, label: expect.stringContaining('progresse bien') }); // 1 à 3 → M+1
    expect(resolveShipManeuver(1, 6, 0, -2)).toMatchObject({ dr: -1, movement: 6 }); // −2 à 0 → M
    expect(resolveShipManeuver(-1, 6, -2, -2)).toMatchObject({ dr: -5, movement: 3 }); // −5 ou moins → M÷2
  });
});
