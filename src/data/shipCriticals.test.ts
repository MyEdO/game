import { describe, it, expect } from 'vitest';
import { SHIP_CRITICAL_TABLES, type ShipCritTable } from './shipCriticals';
import { findTableEntry } from '../engine/tables';

/** Une table d10 bien formée couvre 1..10 de façon CONTIGUË, chaque entrée nommée + décrite. */
function expectContiguousD10(table: ShipCritTable) {
  const e = [...table].sort((a, b) => a.min - b.min);
  expect(e[0].min).toBe(1);
  expect(e[e.length - 1].max).toBe(10);
  for (let i = 1; i < e.length; i++) expect(e[i].min).toBe(e[i - 1].max + 1);
  for (const x of e) expect(x.id && x.label && x.note).toBeTruthy();
}

describe('Blessures critiques sur un navire (MDG 13)', () => {
  it('les 5 Localisations ont une table d10 contiguë', () => {
    expect(Object.keys(SHIP_CRITICAL_TABLES).sort()).toEqual(['avirons', 'cargaison', 'coque', 'equipements', 'greement']);
    for (const t of Object.values(SHIP_CRITICAL_TABLES)) expectContiguousD10(t);
  });

  it('effets « État » AUTHORÉS en GameOp + indices structurés (Éclats / Coque)', () => {
    // Coque : 8 → Voie d'eau 1 (Éclats 6) ; 10 → Voie d'eau 4 — effet en op condition (langue unique).
    expect(findTableEntry(SHIP_CRITICAL_TABLES.coque, 8).ops).toEqual([{ op: 'condition', id: { id: 'voie-d-eau' }, value: 1 }]);
    expect(findTableEntry(SHIP_CRITICAL_TABLES.coque, 8).shrapnel).toBe(6);
    expect(findTableEntry(SHIP_CRITICAL_TABLES.coque, 10).ops).toEqual([{ op: 'condition', id: { id: 'voie-d-eau' }, value: 4 }]);
    // Cargaison : 3-4 → En flammes 1 ; 9-10 → 3 En flammes + 1d10 Critiques Coque.
    expect(findTableEntry(SHIP_CRITICAL_TABLES.cargaison, 3).ops).toEqual([{ op: 'condition', id: { id: 'en-flammes-navire' }, value: 1 }]);
    expect(findTableEntry(SHIP_CRITICAL_TABLES.cargaison, 10).ops).toEqual([{ op: 'condition', id: { id: 'en-flammes-navire' }, value: 3 }]);
    expect(findTableEntry(SHIP_CRITICAL_TABLES.cargaison, 10).hullCrits).toEqual({ dice: { n: 1, sides: 10 } });
    // Gréement : 10 → Mât brisé (réf par id), Éclats 10.
    expect(findTableEntry(SHIP_CRITICAL_TABLES.greement, 10).id).toBe('mat-brise');
    expect(findTableEntry(SHIP_CRITICAL_TABLES.greement, 10).shrapnel).toBe(10);
  });
});
