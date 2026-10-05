import { describe, it, expect } from 'vitest';
import { wornArmourPoints, ignoredArmourAP, impenetrableAt } from '../items';
import { parseQualityInstance } from './normalize';
import type { Combatant, ItemInstance } from '../types';
import { objetDeTest } from '../objetDeTest.testkit';

/**
 * Lot B — Atouts/Défauts d'armure intrinsèques (LDB 63, Qualités des armures) :
 * Flexible (superposition), Impénétrable (Critiques impairs ignorés),
 * Partielle (PA ignorés sur pair/Critique), Points faibles (PA ignorés sur Critique Empaleuse).
 */
let uidSeq = 0;
const piece = (trappingId: string, pa: number, locs: ItemInstance['locs'], qualities: string[] = []): ItemInstance =>
  objetDeTest({ uid: `it-${uidSeq++}`, trappingId, kind: 'armor', equipped: true, pa, locs, qualities: qualities.map((s) => parseQualityInstance(s)!), enc: 1 });

function wearer(items: ItemInstance[]): Combatant {
  return {
    id: 'w', label: 'W', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, items,
  } as Combatant;
}

describe('Flexible — superposition (LDB 63 : « les bénéfices des deux »)', () => {
  it('mailles Flexible + plastron rigide au corps → PA cumulés', () => {
    const ap = wornArmourPoints([
      piece('chemise-de-mailles', 2, ['corps'], ['Flexible']),
      piece('plastron', 3, ['corps']),
    ]);
    expect(ap.corps).toBe(5);
  });
  it('deux pièces RIGIDES au même endroit → seule la meilleure compte (pas de cumul)', () => {
    const ap = wornArmourPoints([piece('plastron', 3, ['corps']), piece('cuir', 1, ['corps'])]);
    expect(ap.corps).toBe(3);
  });
  it('deux pièces Flexibles → pas de cumul entre elles', () => {
    const ap = wornArmourPoints([
      piece('mailles-a', 2, ['corps'], ['Flexible']),
      piece('mailles-b', 1, ['corps'], ['Flexible']),
    ]);
    expect(ap.corps).toBe(2);
  });
});

describe('Partielle — PA ignorés sur jet PAIR ou Coup Critique (LDB 63)', () => {
  const c = wearer([piece('calotte-de-cuir', 1, ['tete'], ['Partielle'])]);
  it('jet pair → PA de la pièce ignorés', () => {
    expect(ignoredArmourAP(c, 'tete', { roll: 44, critical: false, empaleuse: false })).toBe(1);
  });
  it('Coup Critique → PA ignorés même sur un jet impair', () => {
    expect(ignoredArmourAP(c, 'tete', { roll: 33, critical: true, empaleuse: false })).toBe(1);
  });
  it('jet impair sans Critique → PA conservés', () => {
    expect(ignoredArmourAP(c, 'tete', { roll: 33, critical: false, empaleuse: false })).toBe(0);
  });
  it('avec une couche Flexible NON-Partielle dessous, seule la pièce Partielle est ignorée', () => {
    const layered = wearer([
      piece('coiffe-de-mailles', 2, ['tete'], ['Flexible']),
      piece('heaume-ouvert', 1, ['tete'], ['Partielle']),
    ]);
    expect(ignoredArmourAP(layered, 'tete', { roll: 44, critical: false, empaleuse: false })).toBe(1);
  });
});

describe('Points faibles — PA ignorés sur Critique d’une arme Empaleuse (LDB 63)', () => {
  const c = wearer([piece('plastron-de-cuir', 2, ['corps'], ['Points faibles'])]);
  it('Critique + Empaleuse → PA ignorés', () => {
    expect(ignoredArmourAP(c, 'corps', { roll: 33, critical: true, empaleuse: true })).toBe(2);
  });
  it('Critique sans Empaleuse / Empaleuse sans Critique → PA conservés', () => {
    expect(ignoredArmourAP(c, 'corps', { roll: 33, critical: true, empaleuse: false })).toBe(0);
    expect(ignoredArmourAP(c, 'corps', { roll: 31, critical: false, empaleuse: true })).toBe(0);
  });
});

describe('Impénétrable — Critiques impairs ignorés (LDB 63)', () => {
  it('impenetrableAt : pièce Impénétrable avec PA restants à la localisation', () => {
    const c = wearer([piece('heaume', 2, ['tete'], ['Impénétrable', 'Points faibles'])]);
    expect(impenetrableAt(c, 'tete')).toBe(true);
    expect(impenetrableAt(c, 'corps')).toBe(false);
  });
  it('pièce brisée (damageTaken = PA) → ne protège plus', () => {
    const broken = piece('heaume', 2, ['tete'], ['Impénétrable']);
    broken.damageTaken = 2;
    expect(impenetrableAt(wearer([broken]), 'tete')).toBe(false);
  });
});
