/**
 * Garde-fou des Tables de Corruption (mutationTables.json) : chaque table doit couvrir son dé de tirage
 * (`die`) SANS trou ni chevauchement, et chaque `mutation` référencée doit exister dans mutations.json
 * (réf par id stable). Protège la transcription des tables (LDB 19 + par Puissance du Chaos, EDOC 12).
 */
import { describe, it, expect } from 'vitest';
import { mutationTables, mutations } from './index';
import { rollMutation } from './mutations';
import { totalDuDe, type RNG } from '../engine/dice';
import { deDeLaTableTiree } from '../engine/tables';
import { desEnSuite } from '../engine/dice.testkit';

const IDS = new Set<string>(mutations.map((m) => m.id));

/** RNG scriptée : `int()` renvoie les valeurs fournies dans l'ordre (ignore min/max → jet direct). */
const scripted = (vals: number[]): RNG => desEnSuite(vals, { boucle: true });

describe('mutationTables — tables de Corruption', () => {
  for (const t of mutationTables) {
    it(`${t.id} : couvre son ${t.die} sans trou ni chevauchement`, () => {
      const de = deDeLaTableTiree(t);
      const sorted = [...t.entries].sort((a, b) => a.min - b.min);
      let expected = totalDuDe(de, de.n);
      for (const r of sorted) {
        expect(r.min, `${t.id}: trou/chevauchement avant ${r.min}`).toBe(expected);
        expect(r.max).toBeGreaterThanOrEqual(r.min);
        expected = r.max + 1;
      }
      expect(expected, `${t.id}: doit finir au plus grand total du ${t.die}`).toBe(totalDuDe(de, de.n * de.sides) + 1);
    });
    it(`${t.id} : toutes les mutations référencées existent`, () => {
      const bad = t.entries.map((r) => r.mutation).filter((m) => !IDS.has(m));
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
