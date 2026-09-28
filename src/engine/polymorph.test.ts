import { describe, it, expect } from 'vitest';
import { polymorphOps } from './polymorph';
import { applyOps } from './ops';
import { effectiveChar } from './characteristics';
import { endOfRound } from './conditions';
import { creatures, findCreatureById, findTraitById } from '../data';
import { hasTraitKey } from './traits/dispatch';
import type { Combatant } from './types';

/**
 * Forme bestiale (LDB 48) : métamorphose en une Bête du Reikland — F/E/Ag/Dex remplacées + Traits
 * de la créature (sauf Bestial), le tout auto-restitué à l'expiration (charMod + grantTrait).
 */
const dummy = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x', label: 'Mage', kind: 'hero',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 35, agilite: 40, dexterite: 45, intelligence: 40, 'force-mentale': 40, sociabilite: 30 },
    wounds: { current: 14, max: 14 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

describe('polymorphOps — Forme bestiale (Ours)', () => {
  it('remplace F/E/Ag/Dex par celles de l’Ours et accorde ses Traits (sauf Bestial)', () => {
    const ours = findCreatureById('ours')!;
    const c = dummy({});
    applyOps(c, polymorphOps(c, 'ours'), { label: 'Forme bestiale', defaultDurationRounds: 3 });
    expect(effectiveChar(c, 'force')).toBe(ours.char.force); // 55
    expect(effectiveChar(c, 'endurance')).toBe(ours.char.endurance); // 45
    expect(effectiveChar(c, 'agilite')).toBe(ours.char.agilite); // 25
    expect(hasTraitKey(c.traits, 'morsure')).toBe(true); // Trait de l'Ours accordé
    expect(hasTraitKey(c.traits, 'bestial')).toBe(false); // Bestial exclu
  });

  it('reprend sa vraie forme à l’expiration (Caractéristiques restaurées, Traits retirés)', () => {
    const c = dummy({});
    applyOps(c, polymorphOps(c, 'Ours'), { label: 'Forme bestiale', defaultDurationRounds: 1 });
    endOfRound(c); // 1 Round écoulé → l'effet expire
    expect(effectiveChar(c, 'force')).toBe(30); // base restaurée
    expect(effectiveChar(c, 'agilite')).toBe(40);
    expect(hasTraitKey(c.traits, 'morsure')).toBe(false); // Trait retiré
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
      !polymorphOps(c, creature).some((o) => o.op === 'grantTrait' && o.traitId === trait && o.range === range),
    );
    expect(perdues).toEqual([]);
  });
});
