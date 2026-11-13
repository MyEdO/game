/** #1667 C-g — la table de Réaction au Statut (LDB 08 l.40-46) couvre son dé d'un seul tenant. */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import reactionJson from '../../reaction-au-statut.json';

const FICHIER = 'reaction-au-statut.json';

describe('reaction-au-statut.json — rangées', () => {
  it('accepte la table du livre', () => {
    expect(validateDataset(FICHIER, structuredClone(reactionJson))).toBeNull();
  });

  it('REFUSE, en le nommant, un trou dans le d10', () => {
    const entries = reactionJson.entries.filter((r) => r.min !== 3);
    expect(validateDataset(FICHIER, { ...structuredClone(reactionJson), entries })).toMatch(/reaction-au-statut\.json › reaction-au-statut : les rangées ne couvrent pas le d10 d'un seul tenant/);
  });

  it('REFUSE une issue hors du tableau', () => {
    const entries = reactionJson.entries.map((r) => (r.min === 3 ? { ...r, issue: 'indifference' } : r));
    expect(validateDataset(FICHIER, { ...structuredClone(reactionJson), entries })).toMatch(/issue/);
  });
});
