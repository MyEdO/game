/**
 * Garde-fou des Tables de Corruption (mutationTables.json) : chaque table d100 doit couvrir 1..100
 * SANS trou ni chevauchement, et chaque `mutation` référencée doit exister dans mutations.json (réf
 * par id stable). Protège la transcription des tables (LDB 19 + par Puissance du Chaos, EDOC 12).
 */
import { describe, it, expect } from 'vitest';
import mutationTables from './mutationTables.json';
import mutations from './mutations.json';
import { rollMutation } from './mutations';
import type { RNG } from '../engine/dice';
import { desEnSuite } from '../engine/dice.testkit';

const IDS = new Set((mutations as { id: string }[]).map((m) => m.id));

/** RNG scriptée : `int()` renvoie les valeurs fournies dans l'ordre (ignore min/max → d100 direct). */
const scripted = (vals: number[]): RNG => desEnSuite(vals, { boucle: true });

describe('mutationTables — tables de Corruption d100', () => {
  for (const t of mutationTables as { id: string; ranges: { min: number; max: number; mutation: string }[] }[]) {
    it(`${t.id} : couvre 1..100 sans trou ni chevauchement`, () => {
      const sorted = [...t.ranges].sort((a, b) => a.min - b.min);
      let expected = 1;
      for (const r of sorted) {
        expect(r.min, `${t.id}: trou/chevauchement avant ${r.min}`).toBe(expected);
        expect(r.max).toBeGreaterThanOrEqual(r.min);
        expected = r.max + 1;
      }
      expect(expected, `${t.id}: doit finir à 100`).toBe(101);
    });
    it(`${t.id} : toutes les mutations référencées existent`, () => {
      const bad = t.ranges.map((r) => r.mutation).filter((m) => !IDS.has(m));
      expect(bad, `${t.id}: réfs de mutation inconnues`).toEqual([]);
    });
  }
});

describe('rollMutation — tables EDOC + sous-table Tête Bestiale (résolution data-driven)', () => {
  it('tire sur la table EDOC alignée demandée', () => {
    expect(rollMutation('edoc-phys-toute', scripted([4])).id).toBe('sang-acide'); // toute 04 → Sang acide
  });
  it('« Tête bestiale » re-tire sur la sous-table de MÊME alignement (suffixe hérité)', () => {
    // edoc-phys-toute 07-10 → tete-bestiale (subTable) ; sous-table toute 51-55 → Araignée géante
    expect(rollMutation('edoc-phys-toute', scripted([8, 51])).id).toBe('tete-bestiale-araignee-geante');
    // edoc-phys-khorne 10-15 → tete-bestiale ; sous-table khorne 01-10 → Ours
    expect(rollMutation('edoc-phys-khorne', scripted([12, 5])).id).toBe('tete-bestiale-ours');
  });
});
