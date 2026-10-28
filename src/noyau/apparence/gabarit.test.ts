/**
 * #2972 — LE gabarit résolu : explicite, sinon celui de la race recouvert par sa surcharge, puis le
 * multiplicateur de jambes. Les attendus se lisent au catalogue (`findGabaritById`), jamais recopiés.
 */
import { describe, expect, it } from 'vitest';
import { gabaritResolu } from './gabarit';
import { findGabaritById, type GabaritId } from '../../data';

const lu = (id: GabaritId) => {
  const g = findGabaritById(id);
  if (!g) throw new Error(`fixture : « ${id} » absent de gabarits.json`);
  return { sl: g.sl, st: g.st, legs: g.legs, arms: g.arms ?? 1, head: g.head ?? 1 };
};

describe('gabaritResolu (#2972)', () => {
  it('sans gabarit explicite : celui de la race, recouvert clé par clé par sa surcharge', () => {
    const base = lu('brute');
    expect(gabaritResolu({ race: { gabarit: { id: 'brute' }, gabaritOverride: { sl: 1.32, legs: 0.9 } }, legsMult: 1 }))
      .toEqual({ ...base, sl: 1.32, legs: 0.9 });
  });

  it('un gabarit explicite remplace la carrure ENTIÈRE : la surcharge de la race ne s’y applique pas', () => {
    expect(gabaritResolu({ gabarit: 'courtaud', race: { gabarit: { id: 'brute' }, gabaritOverride: { sl: 1.32, legs: 0.9 } }, legsMult: 1 }))
      .toEqual(lu('courtaud'));
  });

  it('le multiplicateur de jambes se compose APRÈS la surcharge', () => {
    expect(gabaritResolu({ race: { gabarit: { id: 'moyen' }, gabaritOverride: { legs: 0.8 } }, legsMult: 0.5 }).legs).toBeCloseTo(0.4);
    expect(gabaritResolu({ gabarit: 'elance', race: { gabarit: { id: 'moyen' } }, legsMult: 0.5 }).legs).toBeCloseTo(lu('elance').legs * 0.5);
  });

  it('bras et tête valent 1 quand le gabarit les tait, et suivent ceux qu’il pose', () => {
    expect(gabaritResolu({ race: { gabarit: { id: 'moyen' } }, legsMult: 1 })).toMatchObject({ arms: 1, head: 1 });
    expect(gabaritResolu({ race: { gabarit: { id: 'gremlin-mini' } }, legsMult: 1 }).head).toBe(lu('gremlin-mini').head);
  });

  it('un id hors du catalogue est une erreur, jamais un repli silencieux', () => {
    expect(() => gabaritResolu({ race: { gabarit: { id: 'humain' as GabaritId } }, legsMult: 1 })).toThrow(/« humain » n'est aucun gabarit/);
  });
});
