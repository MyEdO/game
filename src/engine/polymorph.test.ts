import { describe, it, expect } from 'vitest';
import { polymorphOps } from './polymorph';
import { applyOps } from './ops';
import { blessuresPosees, effectiveChar } from './characteristics';
import { endOfRound } from './conditions';
import { creatures, findCreatureById, findTraitById } from '../data';
import { hasTraitKey } from './traits/dispatch';
import type { Combatant } from './types';
import { combattantDeTest, type SurchargeDeCombattant, blessuresSurLeProfil } from './combattantDeTest.testkit';
import { desDuTest } from './dice.testkit';

/**
 * Forme bestiale (LDB 48) : métamorphose en une Bête du Reikland — F/E/Ag/Dex remplacées + Traits
 * de la créature (sauf Bestial), le tout auto-restitué à l'expiration (charMod + grantTrait).
 */
/** Mage F30 E30 FM40 (formule Moyenne 3 + 6 + 4 = 13), né à B 14 imprimé : écart 1 (`blessuresPosees`). */
const dummy = (p: SurchargeDeCombattant = {}): Combatant => {
  const mage = combattantDeTest({
    id: 'x', label: 'Mage', kind: 'hero',
    characteristics: { 'capacite-de-combat': 40, initiative: 35, agilite: 40, dexterite: 45, intelligence: 40, 'force-mentale': 40 },
    ...p,
  });
  return blessuresSurLeProfil({ ...mage, wounds: blessuresPosees(mage, 14) });
};

describe('polymorphOps — Forme bestiale (Ours)', () => {
  it('remplace F/E/Ag/Dex par celles de l’Ours et accorde ses Traits (sauf Bestial)', () => {
    const ours = findCreatureById('ours')!;
    const c = dummy({});
    applyOps(c, polymorphOps(c, 'ours'), { rng: desDuTest, label: 'Forme bestiale', defaultDurationRounds: 3 });
    expect(effectiveChar(c, 'force')).toBe(ours.char.force); // 55
    expect(effectiveChar(c, 'endurance')).toBe(ours.char.endurance); // 45
    expect(effectiveChar(c, 'agilite')).toBe(ours.char.agilite); // 25
    expect(hasTraitKey(c.traits, 'morsure')).toBe(true); // Trait de l'Ours accordé
    expect(hasTraitKey(c.traits, 'bestial')).toBe(false); // Bestial exclu
  });

  it('reprend sa vraie forme à l’expiration (Caractéristiques restaurées, Traits retirés)', () => {
    const c = dummy({});
    applyOps(c, polymorphOps(c, 'Ours'), { rng: desDuTest, label: 'Forme bestiale', defaultDurationRounds: 1 });
    endOfRound(c, desDuTest); // 1 Round écoulé → l'effet expire
    expect(effectiveChar(c, 'force')).toBe(30); // base restaurée
    expect(effectiveChar(c, 'agilite')).toBe(40);
    expect(hasTraitKey(c.traits, 'morsure')).toBe(false); // Trait retiré
  });
});

describe('polymorphOps — Blessures recalculées sur le profil ET la Taille de la créature (LDB 48 l.23, l.27 ; LDB 85 l.393-401)', () => {
  it.each([
    // Ours (Grande) : (BF 5 + 2×BE 4 + BFM 4) × 2 = 34, + écart 1.
    ['ours', 35],
    // Rat géant (Petite) : 2×BE 2 + BFM 4 = 8, + écart 1 — jamais la formule Moyenne (3 + 4 + 4).
    ['rat-geant', 9],
  ] as const)('%s : 10/14 → maximum %i, 4 Points perdus conservés ; la fin du Sort rend 10/14', (ref, max) => {
    const c = dummy();
    c.wounds = { ...c.wounds, current: 10 };
    applyOps(c, polymorphOps(c, ref), { rng: desDuTest, label: 'Forme bestiale', defaultDurationRounds: 1 });
    expect(c.wounds).toEqual({ current: max - 4, max, ecart: 1 });
    endOfRound(c, desDuTest);
    expect(c.wounds).toEqual({ current: 10, max: 14, ecart: 1 });
  });

  it('un Trait Nuée accordé multiplie par 5 les Blessures d’une créature type, écart du livre compris (LDB 85 l.253)', () => {
    const c = dummy();
    applyOps(c, [{ op: 'grantTrait', trait: { id: 'nuee' } }], { rng: desDuTest, label: 'Nuée', defaultDurationRounds: 1 });
    expect(c.wounds).toEqual({ current: (13 + 1) * 5, max: (13 + 1) * 5, ecart: 1 });
    endOfRound(c, desDuTest);
    expect(c.wounds).toEqual({ current: 14, max: 14, ecart: 1 });
  });
});

describe('polymorphOps — Portée des Traits transférés (LDB 85 l.209)', () => {
  it('chaque Trait transférable à Portée d’une créature la porte dans son grantTrait', () => {
    const avecPortee = creatures.flatMap((cr) =>
      (cr.traits ?? []).filter((t) => t.range != null && !findTraitById(t.id)?.nonTransferable).map((t) => ({ creature: cr.id, trait: t.id, range: t.range })),
    );
    expect(avecPortee).not.toHaveLength(0);
    const c = dummy({});
    const perdues = avecPortee.filter(({ creature, trait, range }) =>
      !polymorphOps(c, creature).some((o) => o.op === 'grantTrait' && o.trait.id === trait && o.trait.range === range),
    );
    expect(perdues).toEqual([]);
  });
});
