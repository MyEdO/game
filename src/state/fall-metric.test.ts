import { describe, it, expect } from 'vitest';
import { applyFall } from '../engine/movement';
import { hasCondition } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

/**
 * CHUTE MÉTRIQUE (LDB 15 l.78-84) — `applyFall(c, metres, d10Chute)` : dégâts = 3 × mètres + 1d10,
 * réduits par le Bonus d'Endurance mais PAS par les PA ; État À Terre si les Blessures subies
 * DÉPASSENT le BE. Modèle unifié : la chute se mesure en MÈTRES (Δhauteur du relief), plus en
 * « niveaux » forfaitaires. NE PAS changer la formule (RAW).
 */

/** Combattant minimal à Endurance `E` et `wounds` PB courants. */
function mkC(E: number, wounds = 20): Combatant {
  return blessuresSurLeProfil({
    id: 'c', name: 'c', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: E, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(wounds),
    conditions: [], traits: [], advantage: 0,
  }) as unknown as Combatant;
}

describe('applyFall — dégâts métriques (3/m + 1d10 − BE)', () => {
  it('4 m, d10 = 5, BE 3 → 3×4 + 5 − 3 = 14 PB perdus', () => {
    const c = mkC(30, 20); // E 30 → BE 3
    applyFall(c, 4, 5);
    expect(c.wounds.current).toBe(20 - 14);
  });

  it('la MÊME chute perd MOINS de PB avec un BE plus élevé (réduite par l’Endurance)', () => {
    const faible = mkC(30, 40); // BE 3 → perd 12+5−3 = 14
    const robuste = mkC(50, 40); // BE 5 → perd 12+5−5 = 12
    applyFall(faible, 4, 5);
    applyFall(robuste, 4, 5);
    const perteFaible = 40 - faible.wounds.current;
    const perteRobuste = 40 - robuste.wounds.current;
    expect(perteFaible).toBe(14);
    expect(perteRobuste).toBe(12);
    expect(perteRobuste).toBeLessThan(perteFaible);
  });
});

describe('applyFall — État À Terre ssi perte > BE (seuil STRICT)', () => {
  it('perte (7) > BE (3) → À Terre', () => {
    const c = mkC(30, 20); // BE 3
    applyFall(c, 2, 4); // 3×2 + 4 − 3 = 7 > 3
    expect(c.wounds.current).toBe(20 - 7);
    expect(hasCondition(c, 'a-terre')).toBe(true);
  });

  it('perte (2) ≤ BE (4) → PB perdus mais PAS À Terre', () => {
    const c = mkC(40, 20); // BE 4
    applyFall(c, 1, 3); // 3×1 + 3 − 4 = 2 ≤ 4
    expect(c.wounds.current).toBe(20 - 2);
    expect(hasCondition(c, 'a-terre')).toBe(false);
  });

  it('mètres négatifs clampés à 0 (aucune chute) : perte nulle, pas À Terre', () => {
    const c = mkC(100, 20); // BE 10
    applyFall(c, -5, 1); // m = 0 → max(0, 0 + 1 − 10) = 0
    expect(c.wounds.current).toBe(20);
    expect(hasCondition(c, 'a-terre')).toBe(false);
  });
});
