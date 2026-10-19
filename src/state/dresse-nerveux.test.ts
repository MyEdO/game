import { describe, it, expect } from 'vitest';
import { fireTriggers } from '../noyau/triggeredEffects';
import { hasCondition, stacks, COND } from '../engine/conditions';
import { effectiveChar } from '../engine/characteristics';
import { isBestial, isTerritorial } from '../engine/traits/dispatch';
import { creatureToCombatant } from './spawn';
import { findCreatureById } from '../data';
import type { Combatant } from '../engine/types';

/**
 * Dressé × Nerveux (LDB 85) — Phase 2 du chantier « Dressé en traits de 1re classe ». Le Trait Nerveux
 * (l.197 : « facilement effrayée par la magie ou les bruits forts → +3 Brisé ») est exempté par les
 * disciplines de Dressage (l.89) : Guerre ignore les BRUITS FORTS, Magie ignore la MAGIE. La cause de
 * l'effarouchement (`startleCause`) voyage dans le contexte du Trigger ; le gate vit ENTIÈREMENT en
 * DONNÉE (Condition Flow `startleCause` + `has trait dresse-…` dans l'effet onStartled de Nerveux) —
 * aucun code par-nom de discipline.
 */
const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'x', name: 'X', kind: 'enemy', characteristics: { 'capacite-de-combat': 30, endurance: 40 }, skills: [], talents: [], traits: [],
  conditions: [], activeEffects: [], liveTraits: [], weapons: [], armour: { corps: 0 },
  wounds: { current: 10, max: 10, base: 10 }, advantage: 0,
  ...over,
}) as unknown as Combatant;

const get = ((c: Combatant) => () => ({ battle: { combatants: [c] } })) as never;
const startle = (c: Combatant, cause: 'noise' | 'magic') =>
  fireTriggers((get as (c: Combatant) => unknown)(c) as never, c, 'onStartled', { startleCause: cause } as never);

describe('Nerveux — effarouchement → +3 Brisé (effet de DONNÉE onStartled)', () => {
  it('bruits forts → +3 Brisé', () => {
    const c = mk({ traits: [{ id: 'nerveux' }] as never });
    startle(c, 'noise');
    expect(stacks(c, COND.brise)).toBe(3);
  });
  it('magie → +3 Brisé', () => {
    const c = mk({ traits: [{ id: 'nerveux' }] as never });
    startle(c, 'magic');
    expect(stacks(c, COND.brise)).toBe(3);
  });
  it('déjà Brisé → ne re-stacke pas (unlessCondition brise)', () => {
    const c = mk({ traits: [{ id: 'nerveux' }] as never, conditions: [{ id: 'brise', value: 1 }] as never });
    startle(c, 'noise');
    expect(stacks(c, COND.brise)).toBe(1);
  });
});

describe('Dressé (Guerre) — ignore Nerveux pour les BRUITS FORTS seulement (LDB 85 l.110)', () => {
  it('bruits forts → AUCUN Brisé (exemption)', () => {
    const c = mk({ traits: [{ id: 'nerveux' }, { id: 'dresse-guerre' }] as never });
    startle(c, 'noise');
    expect(hasCondition(c, COND.brise)).toBe(false);
  });
  it('magie → +3 Brisé (Guerre n’exempte PAS la magie)', () => {
    const c = mk({ traits: [{ id: 'nerveux' }, { id: 'dresse-guerre' }] as never });
    startle(c, 'magic');
    expect(stacks(c, COND.brise)).toBe(3);
  });
});

describe('Dressé (Magie) — ignore Nerveux en présence de MAGIE seulement (LDB 85 l.110)', () => {
  it('magie → AUCUN Brisé (exemption)', () => {
    const c = mk({ traits: [{ id: 'nerveux' }, { id: 'dresse-magie' }] as never });
    startle(c, 'magic');
    expect(hasCondition(c, COND.brise)).toBe(false);
  });
  it('bruits forts → +3 Brisé (Magie n’exempte PAS les bruits)', () => {
    const c = mk({ traits: [{ id: 'nerveux' }, { id: 'dresse-magie' }] as never });
    startle(c, 'noise');
    expect(stacks(c, COND.brise)).toBe(3);
  });
});

describe('Dressé (Guerre) — passive +10 CC (charMod, LDB 85 l.110) quand la discipline est EN DIRECT', () => {
  it('liveTrait dresse-guerre → +10 CC via le collecteur passif', () => {
    const c = mk({ characteristics: { 'capacite-de-combat': 30 } as never, liveTraits: [{ id: 'dresse-guerre' }] as never });
    expect(effectiveChar(c, 'capacite-de-combat')).toBe(40);
  });
  it('sans la discipline → CC de base', () => {
    const c = mk({ characteristics: { 'capacite-de-combat': 30 } as never });
    expect(effectiveChar(c, 'capacite-de-combat')).toBe(30);
  });
});

describe('Dressé (Dompté) — ignore le Trait Bestial (suppression générique, LDB 85 l.106)', () => {
  it('Bestial + Dompté → isBestial false (capacité supprimée)', () => {
    const c = mk({ traits: [{ id: 'bestial' }, { id: 'dresse-dompte' }] as never });
    expect(isBestial(c.traits)).toBe(false);
  });
  it('Bestial seul → isBestial true (la suppression vient de Dompté)', () => {
    const c = mk({ traits: [{ id: 'bestial' }] as never });
    expect(isBestial(c.traits)).toBe(true);
  });
});

describe('Dressé (Garde) — octroie le Trait Territorial (capability, LDB 85 l.108)', () => {
  it('Garde → isTerritorial true sans lister Territorial à part', () => {
    const c = mk({ traits: [{ id: 'dresse-garde' }] as never });
    expect(isTerritorial(c.traits)).toBe(true);
  });
  it('sans Garde ni Territorial → isTerritorial false', () => {
    const c = mk({ traits: [{ id: 'nerveux' }] as never });
    expect(isTerritorial(c.traits)).toBe(false);
  });
});

describe('Bestiaire — une monture Dressé (Guerre) réelle est exemptée des bruits, pas de la magie', () => {
  it('destrier (cheval de guerre) : Nerveux + Dressé (Guerre) → bruits inertes, magie → Brisé', () => {
    const def = findCreatureById('destrier-cheval-de-guerre-lourd');
    if (!def) return; // robustesse si l'id du bestiaire évolue
    const traitIds = (def.traits ?? []).map((t) => (typeof t === 'string' ? t : t.id));
    // Ne tester que si le profil porte bien Nerveux + Dressé (Guerre).
    if (!traitIds.includes('nerveux') || !traitIds.includes('dresse-guerre')) return;
    const noise = creatureToCombatant(def, 'm1', { x: 0, y: 0 });
    startle(noise, 'noise');
    expect(hasCondition(noise, COND.brise)).toBe(false);
    const magic = creatureToCombatant(def, 'm2', { x: 0, y: 0 });
    startle(magic, 'magic');
    expect(stacks(magic, COND.brise)).toBe(3);
  });
});
