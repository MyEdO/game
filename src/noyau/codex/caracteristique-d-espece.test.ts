/**
 * Base d'espèce d'une Caractéristique et son écart à la colonne Humain (`caracteristiqueDEspece`) : la
 * source de l'étape Race du créateur ET de la section Codex `raceCharSection`. LDB 05 l.351-369
 */
import { describe, it, expect } from 'vitest';
import { caracteristiqueDEspece, raceCharSection } from './registry';
import { species } from '../../data';

// Colonne Halfling partielle : CC 10, CT 30 ; Force absente du tableau de l'espèce.
const HALFLING_PARTIEL = { ...species[0], baseChar: { 'capacite-de-combat': 10, 'capacite-de-tir': 30 } };

describe('caracteristiqueDEspece — écart à la colonne Humain 20 (LDB 05 l.351-369)', () => {
  it('base de l’espèce, écart signé ; absente = colonne Humain, sans écart', () => {
    expect(caracteristiqueDEspece(HALFLING_PARTIEL, 'capacite-de-combat')).toEqual({ base: 10, ecart: '-10' });
    expect(caracteristiqueDEspece(HALFLING_PARTIEL, 'capacite-de-tir')).toEqual({ base: 30, ecart: '+10' });
    expect(caracteristiqueDEspece(HALFLING_PARTIEL, 'force')).toEqual({ base: 20, ecart: undefined });
  });

  it('la section Codex imprime la même base et le même écart', () => {
    const v = raceCharSection(HALFLING_PARTIEL).rows.map((r) => (r.t === 'kv' ? r.v : null));
    expect(v.slice(0, 3)).toEqual(['10 (-10)', '30 (+10)', '20']);
  });
});
