/** #1667 C-e — le Diagramme de Dispersion (LDB 14 l.144-151) : ses rangées couvrent son dé d'un seul tenant,
 *  chaque décalage est une case voisine. */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import dispersionJson from '../../dispersion.json';

const FICHIER = 'dispersion.json';
const avecRangees = (entries: unknown[]) => ({ ...structuredClone(dispersionJson), entries });

describe('dispersion.json — rangées et décalages', () => {
  it('accepte le diagramme du livre', () => {
    expect(validateDataset(FICHIER, structuredClone(dispersionJson))).toBeNull();
  });

  it('REFUSE, en le nommant, un trou dans le d10', () => {
    const sansCinq = dispersionJson.entries.filter((r) => r.min !== 5);
    expect(validateDataset(FICHIER, avecRangees(sansCinq))).toMatch(/dispersion\.json › dispersion : les rangées ne couvrent pas le d10 d'un seul tenant/);
  });

  it('REFUSE un décalage hors des cases voisines', () => {
    const entries = dispersionJson.entries.map((r) => (r.min === 5 ? { ...r, dx: 2 } : r));
    expect(validateDataset(FICHIER, avecRangees(entries))).toMatch(/« dispersion-5 » › décalage en x/);
  });
});
