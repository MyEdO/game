/**
 * Base d'espèce d'une Caractéristique et son écart à la colonne Humain (`caracteristiqueDEspece`) : la
 * source de l'étape Race du créateur ET de la section Codex `raceCharSection`. LDB 05 l.351-369
 */
import { describe, it, expect } from 'vitest';
import { caracteristiqueDEspece, raceCharSection } from './registry';
import { species } from '../../data';

// Colonne d'espèce : CC 10, CT 30, Force égale à la colonne Humain.
const COLONNE_D_ESPECE = { ...species[0], baseChar: { ...species[0].baseChar, 'capacite-de-combat': 10, 'capacite-de-tir': 30, force: 20 } };

describe('caracteristiqueDEspece — écart à la colonne Humain 20 (LDB 05 l.351-369)', () => {
  it('base de l’espèce, écart signé ; égale à la colonne Humain, sans écart', () => {
    expect(caracteristiqueDEspece(COLONNE_D_ESPECE, 'capacite-de-combat')).toEqual({ base: 10, ecart: '-10' });
    expect(caracteristiqueDEspece(COLONNE_D_ESPECE, 'capacite-de-tir')).toEqual({ base: 30, ecart: '+10' });
    expect(caracteristiqueDEspece(COLONNE_D_ESPECE, 'force')).toEqual({ base: 20, ecart: undefined });
  });

  it('la section Codex imprime la même base et le même écart', () => {
    const v = raceCharSection(COLONNE_D_ESPECE).rows.map((r) => (r.t === 'kv' ? r.v : null));
    expect(v.slice(0, 3)).toEqual(['10 (-10)', '30 (+10)', '20']);
  });
});
