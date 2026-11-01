import { describe, it, expect } from 'vitest';
import { wornArmourPenalty, wornSocialMod } from './wearPenalty';
import { testValue, partyBest } from './skills';
import { qualitySocMod } from './qualities/dispatch';
import { totalEncumbrance } from './items';
import { parseQualityInstance } from './qualities/normalize';
import { slugId } from '../data/slug';
import type { Combatant, QualityInstance } from './types';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

/** Fixture : libellés FR ou prose de pénalité de port (« -10% en Discrétion ») → `QualityInstance[]` structurées.
 *  La prose de port mappe `en-<skillId>` + magnitude (forme réelle de la donnée d'armure). */
const WEAR = /^(-?\d+)%?\s*en\s+(.+)$/i;
const q_ = (labels: string[]): QualityInstance[] => labels.map((l) => {
  const m = WEAR.exec(l);
  return m ? { id: `en-${slugId(m[2])}`, value: parseInt(m[1], 10) } : parseQualityInstance(l)!;
});

function mkWearer(labels: string[]): Combatant {
  const qualities = q_(labels);
  return blessuresSurLeProfil({
    id: 'h', name: 'A', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 40, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(10), advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [{ uid: 'a1', name: 'Heaume', kind: 'armor', qualities, pa: 2, locs: ['tete'], enc: 2, equipped: true }],
  }) as unknown as Combatant;
}

describe('wornArmourPenalty', () => {
  it('somme la pénalité de la compétence portée (Perception -20 sur un Heaume)', () => {
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion', '-20% en Perception']), 'perception')).toBe(-20);
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion', '-20% en Perception']), 'discretion')).toBe(-10);
  });
  it('ignore une pièce NON équipée', () => {
    const c = mkWearer(['-20% en Perception']);
    c.items![0].equipped = false;
    expect(wornArmourPenalty(c, 'perception')).toBe(0);
  });
  it('Pratique réduit la pénalité d’un niveau (+10, plancher 0)', () => {
    expect(wornArmourPenalty(mkWearer(['-20% en Perception', 'Pratique']), 'perception')).toBe(-10);
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion', 'Pratique']), 'discretion')).toBe(0);
  });
  it('Peu Fiable double la pénalité', () => {
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion', 'Peu Fiable']), 'discretion')).toBe(-20);
  });
  it('le libellé accentué « Discrétion » est stocké en skillId stable (discretion, sans accent)', () => {
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion']), 'discretion')).toBe(-10);
    expect(wornArmourPenalty(mkWearer(['-10% en Discrétion']), 'discrétion')).toBe(0); // pas de match par libellé
  });
});

describe('testValue + port d’armure', () => {
  function hero(id: string, ag: number, items: unknown[]): Combatant {
    return blessuresSurLeProfil({
      id, name: id, kind: 'hero',
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: ag, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
      wounds: blessuresDeBase(10), advantage: 0, conditions: [], movement: 4,
      skills: [{ id: 'discretion', characteristic: 'agilite', advances: 0 }], talents: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items,
    }) as unknown as Combatant;
  }
  it('testValue soustrait la pénalité de Discrétion d’une cotte équipée', () => {
    const c = hero('h1', 40, [{ uid: 'a', name: 'Cotte de mailles', kind: 'armor', qualities: q_(['-10% en Discrétion']), enc: 3, equipped: true }]);
    expect(testValue(c, 'discretion')).toBe(30); // Ag 40 − 10
  });
  it('partyBest préfère le héros NON armuré pour un Test de Discrétion', () => {
    const armure = hero('arm', 45, [{ uid: 'a', name: 'Cotte de mailles', kind: 'armor', qualities: q_(['-10% en Discrétion']), enc: 3, equipped: true }]); // 35
    const leste = hero('leste', 40, []); // 40
    expect(partyBest([armure, leste], 'discretion')!.actor.id).toBe('leste');
  });
});

describe('qualitySocMod (Laid)', () => {
  it('somme socMod (Laid = -10 ; qualité sans socMod = 0)', () => {
    expect(qualitySocMod({ qualities: q_(['Laid']) })).toBe(-10);
    expect(qualitySocMod({ qualities: q_(['Précise']) })).toBe(0);
  });
});

describe('wornSocialMod', () => {
  it('somme les Laid ÉQUIPÉS (-10), ignore les non équipés', () => {
    const c = { items: [
      { uid: 'a', name: 'Heaume hideux', kind: 'armor', qualities: q_(['Laid']), enc: 2, equipped: true },
      { uid: 'b', name: 'Babiole', kind: 'misc', qualities: q_(['Laid']), enc: 0, equipped: false },
    ] } as unknown as Combatant;
    expect(wornSocialMod(c)).toBe(-10);
  });
});

describe('testValue + Laid (Sociabilité)', () => {
  it('un objet Laid équipé impose -10 aux Tests Soc (caractéristique brute)', () => {
    const c = { characteristics: { sociabilite: 40 }, skills: [], items: [{ uid: 'a', name: 'X', kind: 'armor', qualities: q_(['Laid']), enc: 1, equipped: true }] } as unknown as Combatant;
    expect(testValue(c, undefined, 'sociabilite')).toBe(30);
  });
  it('-10 sur une compétence Soc-based (Charme), rien sur une compétence non-Soc (Discrétion)', () => {
    const c = {
      characteristics: { sociabilite: 40, agilite: 40, force: 30, endurance: 30 }, // F/E requis : sinon maxEncumbrance = NaN → faux palier d'Encombrement
      skills: [{ id: 'charme', characteristic: 'sociabilite', advances: 0 }, { id: 'discretion', characteristic: 'agilite', advances: 0 }],
      items: [{ uid: 'a', name: 'X', kind: 'armor', qualities: q_(['Laid']), enc: 1, equipped: true }],
    } as unknown as Combatant;
    expect(testValue(c, 'charme')).toBe(30); // Soc 40 − 10
    expect(testValue(c, 'discretion')).toBe(40); // non-Soc, pas de pénalité d'armure → inchangé
  });
});

describe('Volumineux porté (garde — déjà câblé items.ts)', () => {
  it('une armure Volumineux portée vaut Enc 1 (LDB 60 l.62)', () => {
    const c = { items: [{ uid: 'a', name: 'Plastron lourd', kind: 'armor', qualities: q_(['Volumineux']), enc: 3, equipped: true }] } as unknown as Combatant;
    expect(totalEncumbrance(c)).toBe(1);
  });
});
