import { describe, it, expect } from 'vitest';
import { outnumberMod, crowdMod } from './combat';
import { ligneDeRegle } from './reglesChiffrees';

/** Surnombre en mêlée — LDB « Difficulté de Combat » (14 - _GoBack.md l.85/92) :
 *  2 contre 1 → +20 (Accessible) ; 3 contre 1 → +40 (Facile). */
describe('outnumberMod', () => {
  it('seul (1 attaquant) : aucun modificateur', () => {
    expect(outnumberMod(1)).toBeNull();
    expect(outnumberMod(0)).toBeNull();
  });
  it('2 contre 1 → +20', () => {
    expect(outnumberMod(2)).toEqual(ligneDeRegle('superiorite-numerique', 'deux-contre-un'));
  });
  it('3 contre 1 → +40', () => {
    expect(outnumberMod(3)).toEqual(ligneDeRegle('superiorite-numerique', 'trois-contre-un'));
  });
  it('4 et plus : plafonné à +40', () => {
    expect(outnumberMod(6)).toEqual(ligneDeRegle('superiorite-numerique', 'trois-contre-un'));
  });
});

/** « Tirer dans le tas » (LDB 14 l.106) : chaque palier est une rangée de la fiche `regles/tirer-dans-le-tas`,
 *  que la chip du breakdown ouvre. */
describe('crowdMod', () => {
  it('cible isolée ou duo (<3) : aucun modificateur', () => {
    expect(crowdMod(2)).toBeNull();
  });
  it('petit groupe (3-6) → +20', () => {
    expect(crowdMod(3)).toEqual(ligneDeRegle('tirer-dans-le-tas', 'petit-groupe'));
    expect(crowdMod(6)).toEqual(ligneDeRegle('tirer-dans-le-tas', 'petit-groupe'));
  });
  it('groupe important (7-12) → +40', () => {
    expect(crowdMod(7)).toEqual(ligneDeRegle('tirer-dans-le-tas', 'groupe-important'));
  });
  it('foule (13+) → +60', () => {
    expect(crowdMod(13)).toEqual(ligneDeRegle('tirer-dans-le-tas', 'foule'));
  });
});
