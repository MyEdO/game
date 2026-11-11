/** #3578 L4 — le Tableau des Races aléatoires (LDB 04 l.93-101) : les rangées d'un document couvrent son dé
 *  d'un seul tenant. */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';

const FICHIER = 'especes-aleatoires.json';
const table = (entries: { id: string; min: number; max: number }[]) => [
  { id: 'races-fixture', type: 'especes-aleatoires', label: 'Fixture', die: 'd100', source: { book: 'livre-de-base', page: 24 }, entries },
];

describe('especes-aleatoires.json — couverture du dé', () => {
  it('accepte une table qui couvre le d100 d’un seul tenant', () => {
    expect(validateDataset(FICHIER, table([{ id: 'humains-reiklander', min: 1, max: 99 }, { id: 'nains', min: 100, max: 100 }]))).toBeNull();
  });

  it('REFUSE, en le nommant, un trou entre deux rangées', () => {
    expect(validateDataset(FICHIER, table([{ id: 'humains-reiklander', min: 1, max: 90 }, { id: 'nains', min: 92, max: 100 }]))).toMatch(
      /especes-aleatoires\.json › races-fixture : les rangées ne couvrent pas le d100 d'un seul tenant/,
    );
  });
});
