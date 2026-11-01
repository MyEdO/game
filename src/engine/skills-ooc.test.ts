import { describe, it, expect } from 'vitest';
import { testValue } from './skills';
import type { Combatant } from './types';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

function mk(opts: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id: 'c', label: 'c', kind: 'hero',
    characteristics: { 'capacite-de-combat': 35, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 35, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 } as never,
    conditions: [], skills: [], talents: [], items: [], activeEffects: [],
    advantage: 0, armour: {} as never, weapons: [], movement: 4, wounds: blessuresDeBase(10),
    ...opts,
  }) as Combatant;
}

describe('testValue HORS COMBAT — mêmes modulations qu’en combat (audit, LDB 16/18/61)', () => {
  it('État Empoisonné → −10 (LDB 16 l.72)', () => {
    expect(testValue(mk({ conditions: [{ id: 'empoisonne', value: 1 }] }), undefined, 'intelligence')).toBe(20); // 30 − 10
  });

  it('État Exténué ×2 → −20 (LDB 16 l.11/90)', () => {
    expect(testValue(mk({ conditions: [{ id: 'extenue', value: 2 }] }), undefined, 'intelligence')).toBe(10); // 30 − 20
  });

  it('Non-cumul (LDB 16 l.13) : Brisé(−10) + Exténué×2(−20) → −20 seulement', () => {
    const c = mk({ conditions: [{ id: 'brise', value: 1 }, { id: 'extenue', value: 2 }] });
    expect(testValue(c, undefined, 'intelligence')).toBe(10); // 30 − 20 (la pire), pas −30
  });

  it('Brisé : −10 sur un Test normal, EXEMPTÉ pour course (Athlétisme) / dissimulation (Discrétion) (l.55)', () => {
    const broke = mk({ conditions: [{ id: 'brise', value: 1 }] });
    const ok = mk();
    expect(testValue(ok, 'perception') - testValue(broke, 'perception')).toBe(10); // Test normal pénalisé
    expect(testValue(broke, 'athletisme')).toBe(testValue(ok, 'athletisme')); // course → pas de malus
    expect(testValue(broke, 'discretion')).toBe(testValue(ok, 'discretion')); // dissimulation → pas de malus
  });

  it('Caractéristique EFFECTIVE : un malus actif (effet/Traumatisme via effectiveChar) baisse la valeur (LDB 18)', () => {
    const c = mk({ activeEffects: [{ char: 'force', bonus: -10 }] as never });
    expect(testValue(c, undefined, 'force')).toBe(20); // 30 − 10 (effectiveChar)
  });

  it('Encombrement : Surchargé → −10 sur un Test d’Agilité (LDB 61)', () => {
    const heavy = mk({ items: [{ enc: 10, qualities: [] } as never] }); // capacité = BF+BE = 3+3 = 6 ; 10 > 6 → palier 1
    expect(testValue(mk(), undefined, 'agilite') - testValue(heavy, undefined, 'agilite')).toBe(10);
    // l'Encombrement ne touche QUE l'Agilité, pas les autres caractéristiques :
    expect(testValue(heavy, undefined, 'intelligence')).toBe(testValue(mk(), undefined, 'intelligence'));
  });

  it('combattant sain → valeur brute (aucune régression)', () => {
    expect(testValue(mk(), undefined, 'intelligence')).toBe(30);
    expect(testValue(mk({ skills: [{ id: 'perception', advances: 10 } as never] }), 'perception')).toBeGreaterThanOrEqual(30);
  });
});
