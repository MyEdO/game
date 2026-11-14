import { describe, it, expect } from 'vitest';
import { reachTiles, meleeReachTiles, meleeReachRank, longerThanShort } from './engagement';
import { REACH_IDS, reachIdOf, reachRankOf } from './items';
import { REACH_LABELS, REACH_VARIABLE } from './types';
import type { Weapon } from './types';

const w = (over: Partial<Weapon>): Weapon => ({ label: 'X', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], ...over } as Weapon);

/**
 * Allonge = portée d'ENGAGEMENT/d'attaque de mêlée (LDB 62 l.163 « Très longue » → 4 m ; l.164
 * « Considérable » → 6 m), convertie en cases avec 1 case = 2 m (LDB 15 l.12). L'axe des sept
 * longueurs (l.156-164) est keyé par `ReachId` : AUCUNE comparaison de libellé ici.
 */
describe('reachTiles — Allonge d’engagement', () => {
  it('Très longue = 2 cases (4 m)', () => expect(reachTiles(w({ reach: 'Très longue' }))).toBe(2));
  it('Considérable = 3 cases (6 m)', () => expect(reachTiles(w({ reach: 'Considérable' }))).toBe(3));
  it('Moyenne / Longue / Très courte = contact (1 case)', () => {
    expect(reachTiles(w({ reach: 'Moyenne' }))).toBe(1);
    expect(reachTiles(w({ reach: 'Longue' }))).toBe(1);
    expect(reachTiles(w({ reach: 'Très courte' }))).toBe(1);
  });
  it('arme à distance, sans Allonge, ou absente → 1', () => {
    expect(reachTiles(w({ type: 'distance', reach: null }))).toBe(1);
    expect(reachTiles(w({ reach: null }))).toBe(1);
    expect(reachTiles(undefined)).toBe(1);
  });
});

describe('meleeReachTiles — Allonge de l’arme de mêlée d’un combattant', () => {
  it('prend l’arme de MÊLÉE (ignore l’arme à distance)', () => {
    expect(meleeReachTiles([w({ type: 'distance' }), w({ reach: 'Très longue' })])).toBe(2);
  });
  it('arme de mêlée normale → 1 ; aucune arme → 1', () => {
    expect(meleeReachTiles([w({ reach: 'Moyenne' })])).toBe(1);
    expect(meleeReachTiles([])).toBe(1);
  });
});

describe('REACH_LABELS — table d’AFFICHAGE adossée à l’axe (aucune 2e échelle)', () => {
  it('un libellé par id d’axe, et chacun retombe sur SON id (LDB 62 l.158-164)', () => {
    expect(Object.keys(REACH_LABELS)).toEqual([...REACH_IDS]);
    for (const id of REACH_IDS) expect(reachIdOf(REACH_LABELS[id])).toBe(id);
  });
  it('les libellés sont ordonnés du plus COURT au plus LONG (« progressivement plus grandes », l.156)', () => {
    const rangs = REACH_IDS.map((id) => reachRankOf(REACH_LABELS[id]));
    expect(rangs).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
  it('« Variable » (Arme improvisée, l.31) est HORS axe : aucun id, aucun rang', () => {
    expect(reachIdOf(REACH_VARIABLE)).toBeNull();
    expect(reachRankOf(REACH_VARIABLE)).toBeNull();
  });
});

describe('meleeReachRank — rang du combat de mêlée (Mains nues incluses)', () => {
  it('aucune arme de mêlée → Mains nues, « Personnelle » = rang le plus COURT (LDB 62 l.28, l.158)', () => {
    expect(meleeReachRank(undefined)).toBe(REACH_IDS.indexOf('personnelle'));
    expect(meleeReachRank(null)).toBe(0);
    expect(meleeReachRank(w({ reach: 'Personnelle' }))).toBe(0);
  });
  it('Allonge « Variable » ou absente → null (longueur non ordonnable, rien à conclure)', () => {
    expect(meleeReachRank(w({ reach: REACH_VARIABLE }))).toBeNull();
    expect(meleeReachRank(w({ reach: null }))).toBeNull();
  });
  it('arme à DISTANCE → null (l’Allonge est une longueur de mêlée)', () => {
    expect(meleeReachRank(w({ type: 'distance', reach: 'Longue' }))).toBeNull();
  });
});

describe('longerThanShort — « plus longue que Courte » (LDB 62 l.176)', () => {
  it('Moyenne / Longue / Très longue / Considérable → vrai', () => {
    for (const r of ['Moyenne', 'Longue', 'Très longue', 'Considérable'] as const) {
      expect(longerThanShort(w({ reach: r }))).toBe(true);
    }
  });
  it('Courte / Très courte / Personnelle / mains nues → faux', () => {
    for (const r of ['Courte', 'Très courte', 'Personnelle'] as const) {
      expect(longerThanShort(w({ reach: r }))).toBe(false);
    }
    expect(longerThanShort(undefined)).toBe(false);
  });
  it('« Variable » et Allonge absente → faux (aucune longueur à reclasser)', () => {
    expect(longerThanShort(w({ reach: REACH_VARIABLE }))).toBe(false);
    expect(longerThanShort(w({ reach: null }))).toBe(false);
  });
});
