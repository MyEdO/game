/**
 * `encumbranceFactor` (ADE II 2 l.753-757) — capacité de race/créature MULTIPLIANT (Bonus de Force +
 * Bonus d'Endurance) avant l'ajout additif de Costaud (`talentEncumbranceBonus`). Le porteur DONNÉE est le
 * Trait racial `ogre` (`traits.json`, capabilities.encumbranceFactor:2, lu par `traitEncumbranceFactor`,
 * `talentEffects.ts`) — le talent optionnel « Massif » (`archives-de-l-empire-2` l.241-257) est un mécanisme
 * DISTINCT (choix de Taille), pas le porteur de la règle inconditionnelle ADE II 2 l.755. `maxEncumbrance`
 * (`items.ts`) compose le PLUS GRAND facteur des Traits portés (`traitEncumbranceFactor`) — ce test
 * prouve le cœur PUR `maxEncumbranceFactor` ET l'intégration
 * bout-en-bout sur une créature réelle du registre (`ogre`).
 */
import { describe, it, expect } from 'vitest';
import { maxEncumbranceFactor } from './dispatch';
import { maxEncumbrance } from '../items';
import { findCreatureById } from '../../data';
import { bonus } from '../characteristics';
import type { Combatant } from '../types';

describe('encumbranceFactor (ADE II 2 l.755) — facteur MULTIPLICATIF sur BF+BE', () => {
  it('0 excédent : sans capacité, facteur = 1 (aucun effet)', () => {
    expect(maxEncumbranceFactor([])).toBe(1);
    expect(maxEncumbranceFactor([{}])).toBe(1);
  });

  it('cas nominal : le facteur porté (×2) l’emporte', () => {
    expect(maxEncumbranceFactor([{ encumbranceFactor: 2 }])).toBe(2);
  });

  it('non cumulatif : le plus grand facteur l’emporte, jamais la somme', () => {
    expect(maxEncumbranceFactor([{ encumbranceFactor: 2 }, { encumbranceFactor: 2 }])).toBe(2);
  });

  it("maxEncumbrance compose le facteur AVANT l'ajout additif de Costaud (LDB 10) : sans capacité, la formule est INCHANGÉE", () => {
    const c = { characteristics: { force: 35, endurance: 42 }, talents: [] } as unknown as Combatant;
    expect(maxEncumbrance(c)).toBe(3 + 4); // (BF+BE) × 1 + 0 — parité avec le comportement pré-#513
  });

  it('#513 — un ogre RÉEL du registre (bestiaire) porte le Trait racial `ogre` : maxEnc = (BF+BE) × 2', () => {
    const ogre = findCreatureById('ogre')!;
    expect(ogre.traits.some((t) => t.id === 'ogre')).toBe(true);
    const c = { characteristics: ogre.char, talents: [], traits: ogre.traits } as unknown as Combatant;
    const bf = bonus(ogre.char.force ?? 0);
    const be = bonus(ogre.char.endurance ?? 0);
    expect(maxEncumbrance(c)).toBe((bf + be) * 2);
  });

  it('#513 — un NON-ogre (Trait racial absent) reste au facteur ×1', () => {
    const humain = findCreatureById('humain')!;
    expect(humain.traits.some((t) => t.id === 'ogre')).toBe(false);
    const c = { characteristics: humain.char, talents: [], traits: humain.traits } as unknown as Combatant;
    const bf = bonus(humain.char.force ?? 0);
    const be = bonus(humain.char.endurance ?? 0);
    expect(maxEncumbrance(c)).toBe(bf + be);
  });

  it('#513 — le PLUS GRAND facteur l’emporte, jamais le cumul (deux Traits porteurs ×2 et ×3 → ×3)', () => {
    // Cœur PUR : deux capacités porteuses ×2 et ×3 composent au PLUS GRAND (×3), jamais ×5 (somme).
    expect(maxEncumbranceFactor([{ encumbranceFactor: 2 }, { encumbranceFactor: 3 }])).toBe(3);
  });
});
