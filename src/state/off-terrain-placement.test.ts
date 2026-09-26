import { describe, it, expect } from 'vitest';
import { placeCombatant } from './spawn';
import type { Scene } from './scene';
import type { Combatant } from '../engine/types';
import { gameOpSchema, OPS_NON_TYPEES } from '../data/schemas/grammaire/mecanique';

/** Scène minimale 3×1 : eau | sol | eau. */
const scene = {
  id: 's', label: 'Mer', dimensions: { w: 3, h: 1 },
  layers: [{ z: 0, tiles: ['eau', 'sol', 'eau'] }],
  entities: [], dialogues: [], triggers: [],
} as unknown as Scene;

const marine = (): Combatant => ({
  id: 'm1', name: 'Wyrm', kind: 'enemy',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 0, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  movement: 6, wounds: { current: 20, max: 20 }, weapons: [], skills: [], talents: [],
  traits: [{ id: 'creature-marine' }],
} as unknown as Combatant);

describe('placeCombatant — drapeau positionnel offTerrain (op offTerrainMod, MDG 16 l.17)', () => {
  it('posé HORS de l’eau, retiré DANS l’eau — re-dérivé à chaque placement (chokepoint unique)', () => {
    const c = marine();
    placeCombatant(c, scene, { x: 1, y: 0 }); // case 'sol'
    expect(c.offTerrain).toBe(true);
    placeCombatant(c, scene, { x: 0, y: 0 }); // case 'eau'
    expect(c.offTerrain).toBe(false);
  });

  it('un combattant SANS passif de terrain ne porte jamais le drapeau', () => {
    const c = { ...marine(), traits: [] } as Combatant;
    placeCombatant(c, scene, { x: 1, y: 0 });
    expect(c.offTerrain).toBeUndefined();
  });
});

/**
 * PAYLOAD STRICT de l'op (#1789) — `offTerrainMod` est une op TYPÉE (`OP_DEFS`) : son terrain
 * d'ÉLECTION est un `idDe('terrain')`, refusé AU PARSE s'il ne résout pas. Sans cette porte, un id
 * fantaisiste rendrait `requiredTerrains` non vide et `offTerrain` VRAI sur TOUTE case — un malus
 * permanent, muet.
 */
describe('offTerrainMod — le terrain d’élection est un id du registre, tenu au parse (#1789)', () => {
  it('accepte un id de `terrains.json` et refuse un id inconnu, en le NOMMANT', () => {
    const ok = gameOpSchema.safeParse({ op: 'offTerrainMod', terrain: 'eau', mSet: 1, testDR: -2, suffocates: true });
    expect(ok.success, JSON.stringify(ok.error?.issues)).toBe(true);

    const ko = gameOpSchema.safeParse({ op: 'offTerrainMod', terrain: 'lac-de-biere', mSet: 1 });
    expect(ko.success).toBe(false);
    expect(JSON.stringify(ko.error?.issues)).toContain('lac-de-biere');
  });

  it('l’op ne figure plus à l’inventaire des payloads non décrits', () => {
    expect(OPS_NON_TYPEES).not.toContain('offTerrainMod');
  });
});
