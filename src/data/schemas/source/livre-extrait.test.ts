// Contrat de la définition UNIQUE de « livre EXTRAIT » (`livre-extrait.ts`, #1739) : son prédicat sur
// une entrée du registre.
import { describe, it, expect } from 'vitest';
import { estLivreExtrait } from './livre-extrait';

describe('estLivreExtrait — `abbr` ET `dir` non vides', () => {
  it('une entrée porteuse d’un sigle et d’un dossier est extraite', () => {
    expect(estLivreExtrait({ abbr: 'LDB', dir: 'Source/x' })).toBe(true);
  });

  it('sans dossier, sans sigle, ou vides : pas extraite', () => {
    expect(estLivreExtrait({ abbr: 'LDB' })).toBe(false);
    expect(estLivreExtrait({ abbr: 'LDB', dir: null })).toBe(false);
    expect(estLivreExtrait({ abbr: 'LDB', dir: '' })).toBe(false);
    expect(estLivreExtrait({ abbr: '', dir: 'Source/x' })).toBe(false);
    expect(estLivreExtrait({ dir: 'Source/x' })).toBe(false);
  });

  it('pas d’entrée : pas extraite', () => {
    expect(estLivreExtrait(undefined)).toBe(false);
    expect(estLivreExtrait(null)).toBe(false);
  });
});
