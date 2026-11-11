/** #3578 L1 — le Tableau des Talents aléatoires (LDB 05 l.514-531) : rangées en référence de Talent, couverture du d100. */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import talentsAleatoiresJson from '../../talents-aleatoires.json';

type Table = { id: string; die: string; entries: { id: string; min: number; max: number }[] };
const clone = () => structuredClone(talentsAleatoiresJson) as unknown as Table[];

describe('talents-aleatoires.json — références de Talent et couverture du dé', () => {
  it('le schéma accepte le document RÉEL', () => {
    expect(validateDataset('talents-aleatoires.json', talentsAleatoiresJson)).toBeNull();
  });

  it('REFUSE une rangée qui désigne un Talent inexistant', () => {
    const doc = clone();
    doc[0].entries[3].id = 'talent-qui-n-existe-pas';
    expect(validateDataset('talents-aleatoires.json', doc)).toMatch(/talent-qui-n-existe-pas/);
  });

  it('REFUSE, en nommant le trou, une rangée retirée', () => {
    const doc = clone();
    const [retiree] = doc[0].entries.splice(5, 1);
    expect(validateDataset('talents-aleatoires.json', doc)).toMatch(
      new RegExp(`talents-aleatoires : les rangées ne couvrent pas le d100 d'un seul tenant — .*${retiree.min}`),
    );
  });
});
