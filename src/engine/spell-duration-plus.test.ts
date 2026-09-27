import { describe, it, expect } from 'vitest';
import { endOfRound, pendingPlusExtensions, resolvePlusExtension, spellDurationPlusSource } from './conditions';
import type { ActiveEffect, Combatant } from './types';
import { findSpellById } from '../data';

/**
 * Durée « + » de fin de Round (LDB 47 l.311, #543) : « tous les Sorts marqués d'un « + » à la fin de
 * leur Durée […] lorsque le Sort doit prendre fin, vous pouvez effectuer un Test de Force Mentale pour
 * prolonger la Durée pour +1 Round. »
 */
const dummy = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x', label: 'X', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 35, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

const plusEffect = (left: number): ActiveEffect => ({
  label: 'Arme aethyrique', bonus: 0, duration: { scale: 'rounds', left }, sourceSpellId: 'arme-aethyrique',
});
const noPlusEffect = (left: number): ActiveEffect => ({
  label: 'Perturbant', bonus: 0, duration: { scale: 'rounds', left }, sourceSpellId: 'perturbant',
});

describe('spellDurationPlusSource — LDB 47 l.311, #543', () => {
  it('sort source portant `duration.plus` → true (arme-aethyrique, LDB 47 l.319)', () => {
    expect(spellDurationPlusSource(plusEffect(1))).toBe(true);
  });
  it('sort source SANS marqueur → false (perturbant, LDB 47 l.459)', () => {
    expect(spellDurationPlusSource(noPlusEffect(1))).toBe(false);
  });
  it('effet sans sort source (non-magique) → false', () => {
    expect(spellDurationPlusSource({ label: 'X', bonus: 0, duration: { scale: 'rounds', left: 1 } })).toBe(false);
  });
});

describe('tickDurations/endOfRound — gel à l’expiration au lieu du retrait (#543)', () => {
  it('un effet plus-éligible à 0 Round est GELÉ (awaitingExtension), pas retiré', () => {
    const c = dummy({ activeEffects: [plusEffect(1)] });
    endOfRound(c);
    expect(c.activeEffects).toHaveLength(1); // toujours présent
    expect(c.activeEffects![0].awaitingExtension).toBe(true);
    expect(pendingPlusExtensions(c)).toHaveLength(1);
  });

  it('un effet SANS marqueur expire NORMALEMENT (régression, retrait direct)', () => {
    const c = dummy({ activeEffects: [noPlusEffect(1)] });
    const log = endOfRound(c);
    expect(c.activeEffects ?? []).toHaveLength(0);
    expect(log.join('\n')).toMatch(/se dissipe/);
    expect(pendingPlusExtensions(c)).toHaveLength(0);
  });
});

describe('inventaire des sorts frenchy-bzh marqués « + » — non re-perdables au sweep (#543)', () => {
  it.each([
    ['bouclier-ruine', "56 - Clan Skryre.md l.145 : « 2 Tours +/4 Tours +/5 Tours + » (3 statblocks skavens, tous « + »)"],
    ['armure-aethyrique', 'sweep #543'],
    ['rafale-hurlante', 'sweep #543'],
  ])('%s porte `duration.plus === true` (%s)', (id) => {
    const d = findSpellById(id)?.duration;
    expect(!!d && 'plus' in d && d.plus).toBe(true);
  });

  /**
   * fêlure-aethyrique (cn:3, range 70m, Zone Diamètre 7m, duration 7 rounds) est l'EXACT match de
   * « 43 - Ungors, Gors & Bestigors.md » l.694 (Shaman Gor NI3, « 7 Rounds », SANS « + »).
   * Le tiers « 4 Tours + » de « 46 - Sorcier du Chaos.md » l.72 (NI3 mais range 40m/diamètre 4m)
   * est un AUTRE statblock du même sort multi-tier — ne correspond pas aux stats curées ici.
   */
  it('felure-aethyrique NE porte PAS `duration.plus` (tiers frenchy-bzh multiples ; celui curé ici est le SEUL sans « + »)', () => {
    const d = findSpellById('felure-aethyrique')?.duration;
    expect(!!d && 'plus' in d && d.plus).toBe(false);
  });
});

describe('resolvePlusExtension — Test de Force Mentale (#543)', () => {
  it('succès → +1 Round, dégelé', () => {
    const c = dummy({ activeEffects: [plusEffect(1)] });
    endOfRound(c);
    const eff = pendingPlusExtensions(c)[0];
    const log = resolvePlusExtension(c, eff, true);
    expect(c.activeEffects).toHaveLength(1);
    expect(eff.awaitingExtension).toBeUndefined();
    expect(eff.duration).toEqual({ scale: 'rounds', left: 1 });
    expect(log.join('\n')).toMatch(/prolongé/);
  });

  it('échec/refus → expiration NORMALE (retrait effectif)', () => {
    const c = dummy({ activeEffects: [plusEffect(1)] });
    endOfRound(c);
    const eff = pendingPlusExtensions(c)[0];
    const log = resolvePlusExtension(c, eff, false);
    expect(c.activeEffects ?? []).toHaveLength(0);
    expect(log.join('\n')).toMatch(/se dissipe/);
  });

  it('RÉPÉTABLE : une prolongation réussie ré-offre à l’expiration SUIVANTE (pas de compteur dédié)', () => {
    const c = dummy({ activeEffects: [plusEffect(1)] });
    endOfRound(c); // Round 1 : expire → gelé
    resolvePlusExtension(c, pendingPlusExtensions(c)[0], true); // prolongé +1 Round
    expect(pendingPlusExtensions(c)).toHaveLength(0); // dégelé, actif de nouveau
    endOfRound(c); // Round 2 : le Round prolongé s'écoule → re-propose
    expect(pendingPlusExtensions(c)).toHaveLength(1);
  });
});
