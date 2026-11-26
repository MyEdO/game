/** #1667 C-g — la table Capricieux (MSRC 15 l.151-159) couvre son dé d'un seul tenant. */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import capricieuxJson from '../../tableau-capricieux.json';
import { catalogueDuProcessus } from '../../catalogueDuProcessus';

const FICHIER = 'tableau-capricieux.json';

describe('tableau-capricieux.json — rangées', () => {
  it('accepte la table du livre', () => {
    expect(validateDataset(FICHIER, structuredClone(capricieuxJson), catalogueDuProcessus())).toBeNull();
  });

  it('REFUSE, en le nommant, un trou dans le d10', () => {
    const entries = capricieuxJson.entries.filter((r) => r.min !== 4);
    expect(validateDataset(FICHIER, { ...structuredClone(capricieuxJson), entries }, catalogueDuProcessus())).toMatch(/tableau-capricieux\.json › tableau-capricieux : les rangées ne couvrent pas le 1d10 d'un seul tenant/);
  });
});
