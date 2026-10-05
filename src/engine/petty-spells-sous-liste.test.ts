/**
 * Sorts de Magie mineure (LDB 10 l.714) : les producteurs de la création (`fillPettySpellsToQuota`,
 * `creatorDefaults.ts`, `PettySpellsSection`) lisent la sous-liste de la feuille
 * `idDe('spell', 'mineure')` (`idsDeLaSousListe`), jamais un filtre `family` recopié (#1988).
 */
import { describe, it, expect } from 'vitest';
import { spells } from '../data';
import { idsDeLaSousListe } from '../data/schemas/grammaire/ref';
import { fillPettySpellsToQuota } from './creation';

const MINEURS = idsDeLaSousListe('spell', 'mineure');

describe('sous-liste `mineure` des sorts', () => {
  it('rend, dans l’ordre de la donnée, les sorts dont la famille est `mineure` (0 écart)', () => {
    expect(MINEURS.length).toBeGreaterThan(0);
    expect([...MINEURS]).toEqual(spells.filter((s) => s.family === 'mineure').map((s) => s.id));
  });

  it('`fillPettySpellsToQuota` complète par les premiers sorts de la sous-liste, sans remplacer l’authoré', () => {
    const [premier, second, troisieme] = MINEURS;
    expect(fillPettySpellsToQuota([], 2)).toEqual([premier, second]);
    expect(fillPettySpellsToQuota([troisieme], 2)).toEqual([troisieme, premier]);
  });
});
