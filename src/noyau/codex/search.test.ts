import { describe, it, expect } from 'vitest';
import type { CodexItem, CodexFacet } from './registry';
import { codexMatch, filterItems, facetValues, facetRows } from './search';

describe('Codex — facettes', () => {
  it('filterItems : ET entre facettes, OU à l’intérieur, item sans valeur écarté par une facette active', () => {
    const items: CodexItem[] = [
      { id: 'averland', label: 'Averland', source: { book: 'LDB', page: 1 }, group: 'G1' },
      { id: 'barak', label: 'Barak', source: { book: 'ADE', page: 2 }, group: 'G1' },
      { id: 'carroburg', label: 'Carroburg', source: { book: 'LDB', page: 3 }, group: 'G2' },
      { id: 'dotern', label: 'Dötern' },
    ];
    const facets: CodexFacet[] = [
      { key: 'book', label: 'Livre', valueOf: (i) => i.source?.book },
      { key: 'group', label: 'Groupe', valueOf: (i) => i.group },
    ];
    expect(filterItems(items, '', facets, {})).toHaveLength(4); // aucune facette active = tout passe
    expect(filterItems(items, '', facets, { book: ['LDB'] }).map((i) => i.label)).toEqual(['Averland', 'Carroburg']);
    expect(filterItems(items, '', facets, { book: ['LDB', 'ADE'] })).toHaveLength(3); // OU interne ; Dötern sans livre écarté
    expect(filterItems(items, '', facets, { book: ['LDB'], group: ['G1'] }).map((i) => i.label)).toEqual(['Averland']); // ET entre facettes
    expect(filterItems(items, 'carro', facets, { book: ['LDB'] }).map((i) => i.label)).toEqual(['Carroburg']); // recherche + facette
  });

  it('facetValues dérive les valeurs des items (comptées, triées FR)', () => {
    const facet: CodexFacet = { key: 'book', label: 'Livre', valueOf: (i) => i.source?.book };
    const items: CodexItem[] = [
      { id: 'a', label: 'A', source: { book: 'LDB', page: 1 } },
      { id: 'b', label: 'B', source: { book: 'ADE', page: 1 } },
      { id: 'c', label: 'C', source: { book: 'LDB', page: 2 } },
      { id: 'd', label: 'D' },
    ];
    expect(facetValues(items, facet)).toEqual([
      { value: 'ADE', count: 1 },
      { value: 'LDB', count: 2 },
    ]);
  });

  it('facetRows compte chaque facette sous la recherche et les AUTRES facettes, et omet une facette à valeur unique', () => {
    const items: CodexItem[] = [
      { id: 'a', label: 'Averland', source: { book: 'LDB', page: 1 }, group: 'G1' },
      { id: 'b', label: 'Barak', source: { book: 'ADE', page: 1 }, group: 'G1' },
      { id: 'c', label: 'Carroburg', source: { book: 'LDB', page: 2 }, group: 'G2' },
      { id: 'd', label: 'Delberz', source: { book: 'LDB', page: 3 }, group: 'G2' },
    ];
    const facets: CodexFacet[] = [
      { key: 'book', label: 'Livre', valueOf: (i) => i.source?.book },
      { key: 'group', label: 'Groupe', valueOf: (i) => i.group },
    ];
    const lignes = (term: string, sel: Record<string, string[]>) => facetRows(items, term, facets, sel).map((r) => [r.facet.key, r.values]);
    expect(lignes('', {})).toEqual([
      ['book', [{ value: 'ADE', count: 1 }, { value: 'LDB', count: 3 }]],
      ['group', [{ value: 'G1', count: 2 }, { value: 'G2', count: 2 }]],
    ]);
    // La sélection d'une facette ne réduit pas SES propres comptes, seulement ceux des autres.
    expect(lignes('', { book: ['ADE'] })).toEqual([
      ['book', [{ value: 'ADE', count: 1 }, { value: 'LDB', count: 3 }]],
    ]);
    expect(lignes('', { group: ['G2'] })).toEqual([
      ['group', [{ value: 'G1', count: 2 }, { value: 'G2', count: 2 }]],
    ]);
    // La recherche réduit tous les comptes.
    expect(lignes('a', {})).toEqual([
      ['book', [{ value: 'ADE', count: 1 }, { value: 'LDB', count: 2 }]],
      ['group', [{ value: 'G1', count: 2 }, { value: 'G2', count: 1 }]],
    ]);
  });
});

describe('Codex search', () => {
  it('le repli de la recherche couvre les LIGATURES : « coeur » trouve « Cœur vaillant »', () => {
    expect(codexMatch({ id: 'coeur-vaillant', label: 'Cœur vaillant' }, 'coeur')).toBe(true);
    expect(codexMatch({ id: 'coeur-vaillant', label: 'Cœur vaillant' }, 'CŒUR')).toBe(true);
  });

  it('terme vide = tout passe', () => {
    expect(codexMatch({ id: 'x', label: 'X' }, '')).toBe(true);
    expect(codexMatch({ id: 'x', label: 'X' }, '   ')).toBe(true);
  });

  it('match insensible casse/accents sur label, sub et desc', () => {
    const it = { id: 'benediction-de-chance', label: 'Bénédiction de Chance', sub: 'Béni', desc: 'relancer un Test' };
    expect(codexMatch(it, 'benediction')).toBe(true);
    expect(codexMatch(it, 'CHANCE')).toBe(true);
    expect(codexMatch(it, 'beni')).toBe(true);
    expect(codexMatch(it, 'relancer')).toBe(true);
    expect(codexMatch(it, 'dragon')).toBe(false);
  });
});
