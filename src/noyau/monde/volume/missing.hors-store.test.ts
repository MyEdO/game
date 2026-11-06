/**
 * REPLI VISIBLE des catalogues de rendu (`catalogEntry`, `missing.ts`, #877) : contrat déclaré, l'entrée trouvée par la
 * résolution, sinon l'entrée de repli fournie — jamais l'identité d'une autre entrée, et rien ne lève.
 */
import { describe, it, expect } from 'vitest';
import { catalogEntry, MISSING_ID, MISSING_LABEL } from './missing';

const REPLI = { id: MISSING_ID, label: MISSING_LABEL };
const CATALOGUE: Record<string, { id: string; label: string }> = { pierre: { id: 'pierre', label: 'Pierre' } };

describe('catalogEntry — repli visible', () => {
  it('un id du registre rend son entrée', () => {
    expect(catalogEntry((id) => CATALOGUE[id], 'pierre', 'matière', REPLI)).toBe(CATALOGUE.pierre);
  });

  it('un id absent rend l’entrée de repli, nommée comme telle', () => {
    expect(catalogEntry((id) => CATALOGUE[id], 'marbre-inconnu', 'matière', REPLI)).toBe(REPLI);
  });

  it('la résolution est lue à l’appel : un catalogue muté en place se voit au prochain appel', () => {
    const vivant: Record<string, { id: string; label: string }> = {};
    expect(catalogEntry((id) => vivant[id], 'bois', 'matière', REPLI)).toBe(REPLI);
    vivant.bois = { id: 'bois', label: 'Bois' };
    expect(catalogEntry((id) => vivant[id], 'bois', 'matière', REPLI)).toBe(vivant.bois);
  });
});
