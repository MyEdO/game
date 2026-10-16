import { describe, it, expect } from 'vitest';
import { STRUCTURE_CRITICALS } from './structureCriticals';
import { findTableEntry } from '../engine/tables';
import { tableDesCritiquesDeStructure } from '../engine/structureCritical';
import { ecartsDeCouverture } from './schemas/grammaire/valeurs';

describe('Blessures critiques sur une Structure (AA 10 l.116-127) — 3ᵉ famille du modèle de coque', () => {
  it('table contiguë depuis 1, dernière bande « 96 ou plus » sans plafond (AA 10 l.127), chaque entrée nommée + id + note', () => {
    expect(ecartsDeCouverture(STRUCTURE_CRITICALS, 1, 'ouverte', (e) => e.id)).toEqual([]);
    for (const x of STRUCTURE_CRITICALS) expect(x.id && x.label && x.note).toBeTruthy();
    expect(findTableEntry(tableDesCritiquesDeStructure(), 140).id, 'un dé effectif au-delà de 100 lit l’Effondrement').toBe('effondrement');
  });

  it('« T » = Blessure Triviale (0 PB, ne compte pas) ; « Effondrement » détruit', () => {
    const trivial = findTableEntry(tableDesCritiquesDeStructure(), 1); // Ébréchée
    expect(trivial.id).toBe('ebrechee');
    expect(trivial.wounds).toBe(0);
    expect(trivial.trivial).toBe(true);
    const destroyed = findTableEntry(tableDesCritiquesDeStructure(), 100); // Effondrement
    expect(destroyed.id).toBe('effondrement');
    expect(destroyed.destroyed).toBe(true);
    expect(destroyed.wounds).toBeNull();
  });

  it('Blessures par sévérité (Secouée 1 → Effondrement partiel 3)', () => {
    expect(findTableEntry(tableDesCritiquesDeStructure(), 40).wounds).toBe(1); // Secouée
    expect(findTableEntry(tableDesCritiquesDeStructure(), 65).wounds).toBe(2); // Ébranlée
    expect(findTableEntry(tableDesCritiquesDeStructure(), 85).id).toBe('effondrement-partiel');
    expect(findTableEntry(tableDesCritiquesDeStructure(), 85).wounds).toBe(3);
  });
});
