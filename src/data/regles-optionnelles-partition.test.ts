import { describe, it, expect } from 'vitest';
import regles from './reglesOptionnelles.json';
import { file } from './schemas/defs/reglesOptionnelles';
import { validateDataset } from './schemas/validate';
import { catalogueDuProcessus } from './catalogueDuProcessus';

const regleSourcee = regles.find(({ source }) => source !== undefined)!;
const { source, ...regleSansProvenance } = regleSourcee;
const maison = 'Motif d’arbitrage pour le test.';

describe('Provenance des règles optionnelles', () => {
  it('accepte le dataset et une nouvelle entrée avec une raison maison seule', () => {
    expect(validateDataset(file, regles, catalogueDuProcessus())).toBeNull();
    expect(validateDataset(file, [...regles, { ...regleSansProvenance, id: 'regle-maison-de-test', maison }], catalogueDuProcessus())).toBeNull();
  });

  it('accepte une référence au livre seule', () => {
    expect(validateDataset(file, [regleSourcee], catalogueDuProcessus())).toBeNull();
  });

  it.each([
    ['une double provenance', { source, maison }, /Arbitrage maison: provenance double/],
    ['une provenance absente', {}, /Source: provenance manquante/],
    ['une raison maison vide', { maison: '' }, /Arbitrage maison:/],
    ['une raison maison booléenne', { maison: true }, /Arbitrage maison:/],
    ['un livre vide', { source: { ...source, book: '' } }, /Source › livre:/],
    ['un folio en chaîne', { source: { ...source, page: '150' } }, /Source › page:/],
  ] as const)('refuse %s', (_cas, provenance, diagnostic) => {
    expect(validateDataset(file, [{ ...regleSansProvenance, ...provenance }], catalogueDuProcessus())).toMatch(diagnostic);
  });
});
