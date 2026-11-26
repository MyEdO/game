// Contrat de la définition UNIQUE de « livre EXTRAIT » (`livre-extrait.ts`, #1739) : son prédicat sur
// une entrée du registre, et sa lecture par l'app (`estExtrait`) dans le registre du catalogue passé.
import { describe, it, expect } from 'vitest';
import { estLivreExtrait } from './livre-extrait';
import { estExtrait } from '../grammaire/livres-extraits';
import { catalogueAvec } from '../../catalogueAvec.testkit';
import { catalogueDuProcessus } from '../../catalogueDuProcessus';

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

describe('estExtrait — l’app lit le registre du catalogue passé', () => {
  it('un livre du seul catalogue est extrait, sa copie sans `dir` ne l’est pas', () => {
    const extrait = catalogueDuProcessus()['books.json'].find((b) => estLivreExtrait(b));
    expect(extrait, 'aucun livre extrait au registre livré').toBeDefined();
    const cat = catalogueAvec({
      'books.json': [{ ...extrait!, id: 'livre-extrait-de-test' }, { ...extrait!, id: 'livre-sans-dossier-de-test', dir: null }],
    });
    expect(estExtrait('livre-extrait-de-test', cat)).toBe(true);
    expect(estExtrait('livre-sans-dossier-de-test', cat)).toBe(false);
  });
});
