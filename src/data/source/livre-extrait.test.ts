// Contrat de la définition UNIQUE de « livre EXTRAIT » (`livre-extrait.ts`, #1739) : son prédicat sur
// une entrée du registre, et sa lecture VIVANTE par l'app (`estExtrait`) après une édition au seam.
import { describe, it, expect, afterEach } from 'vitest';
import { estLivreExtrait } from './livre-extrait';
import { estExtrait } from '../schemas/grammaire/livres-extraits';
import { books, type BookData } from '../index';
import { setDataset } from '../overrides';

const REGISTRE_LIVRE: BookData[] = [...books];

afterEach(() => {
  setDataset('books', REGISTRE_LIVRE);
});

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

describe('estExtrait — l’app lit le registre VIVANT', () => {
  it('un livre extrait dont on vide le `dir` au seam cesse d’être extrait, et le redevient restauré', () => {
    const extrait = REGISTRE_LIVRE.find((b) => estLivreExtrait(b));
    expect(extrait, 'aucun livre extrait au registre livré').toBeDefined();
    const id = extrait!.id;
    expect(estExtrait(id)).toBe(true);

    setDataset('books', REGISTRE_LIVRE.map((b) => (b.id === id ? { ...b, dir: null } : b)));
    expect(estExtrait(id)).toBe(false);

    setDataset('books', REGISTRE_LIVRE);
    expect(estExtrait(id)).toBe(true);
  });
});
