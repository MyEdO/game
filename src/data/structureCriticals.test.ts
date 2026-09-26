import { describe, it, expect } from 'vitest';
import { STRUCTURE_CRITICALS } from './structureCriticals';
import { findTableEntry } from '../engine/tables';

describe('Blessures critiques sur une Structure (AA 10 l.116-127) — 3ᵉ famille du modèle de coque', () => {
  it('table d100 contiguë 1..100, chaque entrée nommée + id + note', () => {
    const e = [...STRUCTURE_CRITICALS].sort((a, b) => a.min - b.min);
    expect(e[0].min).toBe(1);
    expect(e[e.length - 1].max).toBe(100);
    for (let i = 1; i < e.length; i++) expect(e[i].min).toBe(e[i - 1].max + 1);
    for (const x of e) expect(x.id && x.label && x.note).toBeTruthy();
  });

  it('« T » = Blessure Triviale (0 PB, ne compte pas) ; « Effondrement » détruit', () => {
    const trivial = findTableEntry(STRUCTURE_CRITICALS, 1); // Ébréchée
    expect(trivial.id).toBe('ebrechee');
    expect(trivial.wounds).toBe(0);
    expect(trivial.trivial).toBe(true);
    const destroyed = findTableEntry(STRUCTURE_CRITICALS, 100); // Effondrement
    expect(destroyed.id).toBe('effondrement');
    expect(destroyed.destroyed).toBe(true);
    expect(destroyed.wounds).toBeNull();
  });

  it('Blessures par sévérité (Secouée 1 → Effondrement partiel 3)', () => {
    expect(findTableEntry(STRUCTURE_CRITICALS, 40).wounds).toBe(1); // Secouée
    expect(findTableEntry(STRUCTURE_CRITICALS, 65).wounds).toBe(2); // Ébranlée
    expect(findTableEntry(STRUCTURE_CRITICALS, 85).id).toBe('effondrement-partiel');
    expect(findTableEntry(STRUCTURE_CRITICALS, 85).wounds).toBe(3);
  });
});
