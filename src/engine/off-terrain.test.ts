import { describe, it, expect } from 'vitest';
import { offTerrainMoveCap, offTerrainTestDR, requiredTerrains } from './ops';
import { effectiveMovement } from './encumbrance';
import type { Combatant } from './types';

/** Créature du bestiaire portant un trait à `offTerrainMod` (Créature marine / Aquatique — traits.json). */
const seaCreature = (traitId: string, offTerrain: boolean): Combatant => ({
  id: 'c1', name: 'Bête', kind: 'enemy',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 0, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  movement: 6, wounds: { current: 20, max: 20 }, weapons: [], skills: [], talents: [],
  traits: [{ id: traitId }],
  ...(offTerrain ? { offTerrain: true } : {}),
} as unknown as Combatant);

describe('offTerrainMod — Créature marine (MDG 16 l.17) / Aquatique (MSRC 15 l.139), mécanique GÉNÉRIQUE de terrain', () => {
  it('Créature marine DANS l’eau : plein Mouvement, aucun malus', () => {
    const c = seaCreature('creature-marine', false);
    expect(offTerrainMoveCap(c)).toBeNull();
    expect(offTerrainTestDR(c)).toBe(0);
    expect(effectiveMovement(c)).toBe(6);
  });

  it('Créature marine HORS de l’eau : « son M tombe à 1 et tous les Tests qu’elle effectue subissent –2 DR »', () => {
    const c = seaCreature('creature-marine', true);
    expect(offTerrainMoveCap(c)).toBe(1);
    expect(offTerrainTestDR(c)).toBe(-2);
    expect(effectiveMovement(c)).toBe(1);
  });

  it('Aquatique HORS de l’eau : « ne peut pas se déplacer sur la terre ferme » → M 0 (sans malus de Test)', () => {
    const c = seaCreature('aquatique', true);
    expect(offTerrainMoveCap(c)).toBe(0);
    expect(offTerrainTestDR(c)).toBe(0);
    expect(effectiveMovement(c)).toBe(0);
  });

  it('requiredTerrains : le terrain d’élection est lu en DONNÉE (aucun nom de créature en code)', () => {
    expect(requiredTerrains(seaCreature('creature-marine', false))).toEqual(['eau']);
    expect(requiredTerrains(seaCreature('aquatique', false))).toEqual(['eau']);
    const landCreature = { ...seaCreature('coriace', false) };
    expect(requiredTerrains(landCreature)).toEqual([]);
  });
});
