import { describe, it, expect } from 'vitest';
import { prayerSinLock, priestCult, type SpellLike } from './magic';
import { findGodById } from '../data';
import type { Combatant } from './types';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

/**
 * VERROU de Péché des cultes (MDG 11 l.148, verbatim) : « Stromfels retire à un suivant la capacité
 * d'utiliser le Talent *Invocation* s'il possède au moins deux Points de Péché et celle d'utiliser le
 * Talent *Béni* s'il possède au moins cinq Points de Péché. » — champ GÉNÉRIQUE `GodData.sinLocks`
 * (aucun culte LDB n'en porte : LDB 40 ne connaît que la Colère au dé des unités), consommé par le
 * flux de Prière (`castSpell`/`castZoneSpell` → refus AVANT la modale).
 */
const priest = (cult: string, sin: number, kind: 'beni' | 'invocation' = 'invocation'): Combatant =>
  (blessuresSurLeProfil({
    id: 'p1', name: 'Prêtre', kind: 'hero', sinPoints: sin,
    talents: [{ talentId: kind, spec: cult, times: 1 }],
    skills: [], characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), weapons: [], movement: 4,
  })) as unknown as Combatant;

const miracle: SpellLike = { label: 'Lame de fond', ecole: 'Miracle', cn: null, desc: '', family: 'invocation' };
const blessing: SpellLike = { label: 'Bénédiction de Bataille', ecole: 'Bénédiction', cn: null, desc: '', family: 'beni' };
const arcane: SpellLike = { label: 'Trait', ecole: 'Sort', cn: 0, desc: '', family: 'arcane' };

describe('Gating Péché des cultes (MDG 11 l.148 — Stromfels, GodData.sinLocks)', () => {
  it('la donnée Stromfels porte le verrou RAW : Invocation ≥ 2, Béni ≥ 5', () => {
    expect(findGodById('stromfels')?.sinLocks).toEqual({ invocation: 2, beni: 5 });
  });

  it('priestCult lit la spec du Talent de Prière (data-driven, castingKind)', () => {
    expect(priestCult(priest('stromfels', 0))).toBe('stromfels');
    expect(priestCult(priest('sigmar', 0, 'beni'))).toBe('sigmar');
  });

  it('Invocation verrouillée dès 2 Points de Péché (pas à 1)', () => {
    expect(prayerSinLock(priest('stromfels', 1), miracle)).toBeNull();
    expect(prayerSinLock(priest('stromfels', 2), miracle)).toEqual({ family: 'invocation', threshold: 2, cult: 'stromfels' });
    expect(prayerSinLock(priest('stromfels', 7), miracle)).toEqual({ family: 'invocation', threshold: 2, cult: 'stromfels' });
  });

  it('Béni verrouillé dès 5 Points de Péché (pas à 4) — le prêtre à 4 Péchés garde ses Bénédictions', () => {
    const p = priest('stromfels', 4, 'beni');
    expect(prayerSinLock(p, blessing)).toBeNull();
    expect(prayerSinLock(priest('stromfels', 5, 'beni'), blessing)).toEqual({ family: 'beni', threshold: 5, cult: 'stromfels' });
  });

  it('un culte SANS sinLocks (Sigmar, LDB) ne verrouille jamais ; un Sort arcanique n’est jamais gaté', () => {
    expect(prayerSinLock(priest('sigmar', 9, 'beni'), blessing)).toBeNull();
    expect(prayerSinLock(priest('stromfels', 9), arcane)).toBeNull();
  });
});
