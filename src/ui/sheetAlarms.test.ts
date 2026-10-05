import { describe, it, expect } from 'vitest';
import { sheetAlarms, alarmsFingerprint } from './sheetAlarms';
import type { Combatant, Trauma, ItemInstance } from '../engine/types';
import type { Disease } from '../engine/disease';
import type { Mutation } from '../engine/corruption';
import { objetDeTest } from '../engine/objetDeTest.testkit';

/** Héros de test minimal — mêmes caractéristiques que le patron `EquipmentPanel.test.tsx` (mkHero). */
const mkHero = (mut?: (c: Combatant) => void): Combatant => {
  const c = {
    id: 'h',
    name: 'H',
    kind: 'hero',
    species: 'humains-reiklander',
    career: 'Soldat',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    conditions: [],
    skills: [],
    talents: [],
    movement: 4,
    items: [],
  } as unknown as Combatant;
  mut?.(c);
  return c;
};

const mkDisease = (id: string): Disease => ({
  id,
  symptoms: [],
  phase: 'active',
  minutesLeft: 100,
  durationMinutes: 100,
});

const mkItem = (uid: string, enc: number): ItemInstance => objetDeTest({ uid, trappingId: uid, kind: 'misc', enc, qualities: [] });

/** `sheetAlarms` sert UNIQUEMENT la règle d'atterrissage (auto-ouverture de l'onglet État à
 *  l'apparition d'une affliction NOUVELLE, `CharacterSheet.tsx`) — plus l'affichage de l'aside
 *  (désormais `EffectChips`). Contrat : détecter les afflictions par `key` d'identité + `label`
 *  porteur du compte/degré (les deux seuls champs lus par `alarmsFingerprint`). */
describe('sheetAlarms', () => {
  it('héros sain : aucune affliction', () => {
    expect(sheetAlarms(mkHero())).toEqual([]);
  });

  it('héros corrompu + malade + surchargé : afflictions détectées avec leur libellé porteur de degré', () => {
    const hero = mkHero((c) => {
      c.corruption = 3;
      c.diseases = [mkDisease('Fièvre Sanguinaire')];
      c.items = [mkItem('x', 999)];
    });
    const byKey = Object.fromEntries(sheetAlarms(hero).map((a) => [a.key, a.label]));
    expect(byKey['corruption']).toBe('Corruption 3');
    expect(byKey['maladie-Fièvre Sanguinaire']).toBe('Fièvre Sanguinaire');
    expect(byKey['surcharge']).toBe('Surchargé');
  });

  it('Corruption + DAMNÉ : le libellé porte la mention DAMNÉ (affliction distincte pour l’atterrissage)', () => {
    const hero = mkHero((c) => {
      c.corruption = 5;
      c.damned = true;
    });
    const corr = sheetAlarms(hero).find((a) => a.key === 'corruption');
    expect(corr?.label).toBe('Corruption 5 — DAMNÉ');
  });

  it('critiques ACTIVES : affliction « Critiques N » (compte décompté au soin, pas l’historique)', () => {
    const hero = mkHero((c) => { c.criticalWounds = 2; });
    expect(sheetAlarms(hero).find((a) => a.key === 'critiques')?.label).toBe('Critiques 2');
  });

  it('trauma cosmétique seul (cicatrice) : pas d’affliction Séquelles', () => {
    const hero = mkHero((c) => {
      c.traumas = [{ label: 'Cicatrice', location: 'corps', cosmetic: true } as Trauma];
    });
    expect(sheetAlarms(hero).some((a) => a.key === 'traumas')).toBe(false);
  });

  it('trauma NON cosmétique : affliction « Séquelles N »', () => {
    const hero = mkHero((c) => {
      c.traumas = [{ label: 'Bras cassé', location: 'brasG' } as Trauma];
    });
    expect(sheetAlarms(hero).find((a) => a.key === 'traumas')?.label).toBe('Séquelles 1');
  });

  it('fingerprint : stable pour le même relevé, différent si une affliction s’ajoute', () => {
    const hero = mkHero((c) => { c.corruption = 1; });
    const fp1 = alarmsFingerprint(sheetAlarms(hero));
    const fp2 = alarmsFingerprint(sheetAlarms(hero));
    expect(fp1).toBe(fp2);
    hero.mutations = [{ label: 'Griffes', kind: 'physique' } as Mutation];
    const fp3 = alarmsFingerprint(sheetAlarms(hero));
    expect(fp3).not.toBe(fp1);
  });
});
