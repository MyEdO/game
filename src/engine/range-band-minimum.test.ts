import { describe, it, expect } from 'vitest';
import { belowMinRangeBand, rangeBandId } from './combat';
import { trappings } from '../data';

/**
 * PORTÉE MINIMALE d'une machine de siège (ADE II 8 l.251/253) — `belowMinRangeBand` est le prédicat
 * EXACT que `firedAttackBlock` consulte pour REFUSER (pas un malus) un tir trop proche. On le vérifie en
 * unité PUIS on le DÉRIVE DU CATALOGUE : chaque machine de siège à distance ADE II doit refuser Bout
 * Portant (l.253), et le trébuchet/mortier tout ce qui est sous la Portée Courte (l.251) — sans liste en dur.
 */
describe('belowMinRangeBand — comparaison ordinale des bandes', () => {
  const R = 120; // canon : Bout portant ≤12 m, Courte ≤60 m, Moyenne ≤120 m (1 case = 2 m)
  it('minimale « courte » : Bout Portant refusé, Courte et au-delà autorisés', () => {
    expect(belowMinRangeBand(2, R, 'courte')).toBe(true); // 4 m → Bout portant → refusé
    expect(belowMinRangeBand(20, R, 'courte')).toBe(false); // 40 m → Courte → autorisé
    expect(belowMinRangeBand(40, R, 'courte')).toBe(false); // 80 m → Moyenne → autorisé
  });
  it('minimale « moyenne » : Bout Portant ET Courte refusés, Moyenne et au-delà autorisés', () => {
    expect(belowMinRangeBand(2, R, 'moyenne')).toBe(true); // Bout portant → refusé
    expect(belowMinRangeBand(20, R, 'moyenne')).toBe(true); // Courte → refusé (sous la Portée Courte, l.251)
    expect(belowMinRangeBand(40, R, 'moyenne')).toBe(false); // Moyenne → autorisé
  });
  it('cible HORS de portée → pas « trop proche » (false, géré par un autre gate)', () => {
    expect(rangeBandId(400, R)).toBeNull();
    expect(belowMinRangeBand(400, R, 'courte')).toBe(false);
  });
});

/** Les 9 machines de siège à DISTANCE d'ADE II (dérivées du catalogue : livre + catégorie + subType). */
const ade2RangedSiege = trappings.filter(
  (t) => t.categorie === 'ranged' && t.subType === 'armes-de-siege' && t.source.book === 'archives-de-l-empire-2',
);

describe('catalogue ADE II — portée minimale des machines de siège à distance', () => {
  it('il y a bien 9 machines de siège à distance ADE II', () => {
    expect(ade2RangedSiege).toHaveLength(9);
  });

  for (const m of ade2RangedSiege) {
    const range = typeof m.range === 'number' ? m.range : NaN;
    it(`${m.id} : porte une PORTÉE MINIMALE et refuse le tir à Bout Portant (l.253)`, () => {
      expect(m.minRangeBand).toBeDefined();
      expect(Number.isFinite(range)).toBe(true);
      // Distance 0 → Bout Portant : REFUSÉ pour les 9 (l.253 : « pas à Bout Portant »).
      expect(belowMinRangeBand(0, range, m.minRangeBand!)).toBe(true);
      // Distance en bande MOYENNE (m = Portée) : AUTORISÉ pour les 9 (jamais un refus au-delà de Courte).
      expect(belowMinRangeBand(range / 2, range, m.minRangeBand!)).toBe(false);
    });

    it(`${m.id} : à Courte portée, refusé SSI trébuchet/mortier (l.251 « sous la Portée Courte »)`, () => {
      const courteTiles = Math.round(range * 0.15); // m ≈ 0,3×Portée → strictement dans la bande Courte
      expect(rangeBandId(courteTiles, range)).toBe('courte'); // garde-fou : la distance choisie EST « Courte »
      // Seul trébuchet/mortier (minimale « moyenne ») refusent la Courte ; les autres l'autorisent.
      expect(belowMinRangeBand(courteTiles, range, m.minRangeBand!)).toBe(m.minRangeBand === 'moyenne');
    });
  }

  it('le trébuchet et le mortier ont pour minimale « moyenne » ; les 7 autres « courte »', () => {
    const byBand = (band: string) => ade2RangedSiege.filter((m) => m.minRangeBand === band).map((m) => m.id).sort();
    expect(byBand('moyenne')).toEqual(['mortier-ade2', 'trebuchet-ade2']);
    expect(byBand('courte')).toHaveLength(7);
  });
});
