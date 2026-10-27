import { describe, it, expect } from 'vitest';
import { savedProjectSchema } from './bibliotheque';
import { mesurerCheminsNommes } from '../../../scripts/guards/lib/cheminsNommes.mts';

describe('savedProjectSchema — l’enveloppe d’une entrée de bibliothèque', () => {
  it('nomme tous les champs des objets propriétaires de la bibliothèque', () => {
    const mesure = mesurerCheminsNommes([savedProjectSchema]);
    expect(mesure.objets).toBeGreaterThanOrEqual(2);
    expect(mesure.champs).toBeGreaterThanOrEqual(10);
    expect(mesure.fautes).toEqual([]);
  });
});
