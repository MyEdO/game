import { describe, it, expect } from 'vitest';
import { tirerLeCapricieux } from './social';
import { deSelonLaPlage, desEnSuite } from './dice.testkit';
import { sousLeDe } from '../data/deDeLaTable.testkit';

/**
 * Capricieux (Trait de créature, MSRC 15 l.151-159) : « lancez un dé selon le Tableau suivant : »
 * | 1d10 | 1 Soustraire 2 au DR | 2-3 Soustraire 1 au DR | 4-7 Utiliser le DR indiqué | 8-9 Ajouter 1 au DR | 10 Ajouter 2 au DR |.
 * Son application au DR du Test RÉSOLU est mesurée par `noyau/capricieux-flow.hors-store.test.ts`.
 */
describe('tirerLeCapricieux — la table Capricieux (MSRC 15 l.151-159)', () => {
  it.each([
    [1, -2], [2, -1], [3, -1], [4, 0], [7, 0], [8, 1], [9, 1], [10, 2],
  ])('face %i → DR %i', (face, dr) => {
    expect(tirerLeCapricieux(desEnSuite([face]))).toEqual({ roll: face, dr });
  });

  it('le tirage se fait au dé que porte la table', () => {
    sousLeDe('tableauCapricieux', 'd4', () => {
      const plages: [number, number][] = [];
      tirerLeCapricieux(deSelonLaPlage((min, max) => { plages.push([min, max]); return max; }));
      expect(plages).toEqual([[1, 4]]);
    });
  });
});
