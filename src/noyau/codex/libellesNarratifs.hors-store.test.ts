/**
 * Le libellé d'AFFICHAGE d'une entrée de chaque registre du narratif (`LIBELLE_NARRATIF`, `libellesNarratifs.ts`),
 * lu par `entreesNarratives` : contrat déclaré, l'id reste la valeur manipulée. Narratif FABRIQUÉ.
 */
import { describe, it, expect } from 'vitest';
import { entreesNarratives, libelleNarratif } from './libellesNarratifs';
import { emptyNarratif } from '../monde/campaignNarratif';
import { creatures } from '../../data';
import type { NarratifBlock } from '../../data/schemas/defs-scenes/narratif';

const base = creatures[0];
const narratif = (): NarratifBlock => ({
  ...emptyNarratif(),
  presetsPnj: [
    { id: 'p-nomme', profil: { label: 'Gunther le passeur' } },
    { id: 'p-de-base', base: base.id },
    { id: 'p-anonyme' },
  ],
  documents: [{ id: 'd1', titre: 'Lettre de Kastor' }],
} as unknown as NarratifBlock);

describe('LIBELLE_NARRATIF — libellés d’affichage des registres', () => {
  it('preset de PNJ : son profil nommé, sinon la créature de base, sinon son id', () => {
    expect(entreesNarratives(narratif(), 'presetId')).toEqual([
      { id: 'p-nomme', label: 'Gunther le passeur' },
      { id: 'p-de-base', label: base.label },
      { id: 'p-anonyme', label: 'p-anonyme' },
    ]);
  });

  it('document : son titre ; une entrée absente ne résout pas', () => {
    expect(libelleNarratif(narratif(), 'documentId', 'd1')).toBe('Lettre de Kastor');
    expect(libelleNarratif(narratif(), 'documentId', 'absent')).toBeUndefined();
  });
});
