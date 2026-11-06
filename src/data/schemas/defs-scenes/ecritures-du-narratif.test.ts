/**
 * #3059 — écritures du narratif qui ne lisent que lui : l'id frais d'une entrée neuve ne recoupe aucun
 * registre, et les recoupements d'indices suivent un renommage ou tombent avec un retrait.
 */
import { describe, it, expect } from 'vitest';
import { ajouteEntree, idFrais, recoupementsSans, recoupementsVers } from './ecritures-du-narratif';
import { narratifSchema, type NarratifBlock } from './narratif';
import { emptyNarratif } from '../../../noyau/monde/campaignNarratif';

const narratif = (): NarratifBlock => ({
  ...emptyNarratif(),
  affaires: [{ id: 'affaire-1', titre: 'A' }],
  documents: [{ id: 'affaire-2', titre: 'Un document qui porte un id d’affaire', prose: 'x' }],
  indices: [
    { id: 'i1', affaireId: 'affaire-1', kind: 'indice', titre: 'I1', stades: [{ id: 's', prose: 'p' }] },
    { id: 'i2', affaireId: 'affaire-1', kind: 'indice', titre: 'I2', refs: ['i1'], stades: [{ id: 's', prose: 'p' }] },
  ],
});

describe('ajouteEntree', () => {
  it('l’id frais saute l’id porté par un AUTRE registre ; le bloc parse', () => {
    const out = ajouteEntree(narratif(), 'affaires', { titre: 'Neuve' });
    expect(out.id).toBe('affaire-3');
    expect(out.narratif.affaires.map((a) => a.id)).toEqual(['affaire-1', 'affaire-3']);
    expect(narratifSchema.safeParse(out.narratif).success).toBe(true);
  });

  it('idFrais part de la taille de la liste + 1', () => {
    expect(idFrais('stade', [{ id: 'x' }])).toBe('stade-2');
    expect(idFrais('stade', [{ id: 'stade-2' }])).toBe('stade-3');
  });
});

describe('recoupements', () => {
  it('suivent un renommage, tombent avec un retrait (la liste vidée se retire)', () => {
    expect(recoupementsVers(narratif(), 'i1', 'i-un').indices[1].refs).toEqual(['i-un']);
    expect(recoupementsSans(narratif(), 'i1').indices[1].refs).toBeUndefined();
  });
});
