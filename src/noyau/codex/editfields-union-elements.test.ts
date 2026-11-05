/**
 * CLIQUET UNITAIRE de l'UNION (#1548) — `inferFields` classe un champ-TABLEAU sur l'union de ses
 * éléments à travers TOUTES les entrées, jamais sur le premier échantillon non-null.
 *
 * Pourquoi un cliquet unitaire EN PLUS du scan générique (`editfields-listes-objets.test.ts`) :
 * mesuré 2026-08-31, le scan générique reste VERT sous l'algorithme « premier échantillon », parce
 * qu'il filtre d'abord `dedicatedFieldKeys`/`refFieldCfg` — les champs que la donnée réelle ferait
 * basculer y sont tous couverts par un éditeur dédié. Il mesure la DONNÉE du dépôt ; celui-ci mesure
 * l'ALGORITHME, et mord donc même si la donnée change.
 */
import { describe, it, expect } from 'vitest';
import { inferFields } from './editFields';

const kindDe = (entries: Record<string, unknown>[], key: string): string =>
  inferFields(entries).find((f) => f.key === key)!.kind;

describe('inferFields — un champ-tableau se classe sur l’UNION de ses éléments (#1548)', () => {
  it('un `[]` en tête ne fait pas passer une liste d’OBJETS pour une liste de chaînes', () => {
    expect(kindDe([{ k: [] }, { k: [{ a: 1 }] }], 'k')).toBe('json');
  });

  it('un `[]` en tête ne fait pas passer une liste de TABLEAUX pour une liste de chaînes', () => {
    expect(kindDe([{ k: [] }, { k: [['a']] }], 'k')).toBe('json');
  });

  it('un objet APRÈS des chaînes fait tomber le champ en json (l’union, pas la 1re entrée)', () => {
    expect(kindDe([{ k: ['a'] }, { k: [{ a: 1 }] }], 'k')).toBe('json');
  });

  it('une liste HOMOGÈNE de chaînes reste `stringList`, de nombres `numberList`', () => {
    expect(kindDe([{ k: [] }, { k: ['a'] }, { k: ['b', 'c'] }], 'k')).toBe('stringList');
    expect(kindDe([{ k: [] }, { k: [1] }, { k: [2, 3] }], 'k')).toBe('numberList');
  });

  it('un champ-tableau VIDE partout reste `stringList` (aucun élément ne contredit)', () => {
    expect(kindDe([{ k: [] }, { k: [] }], 'k')).toBe('stringList');
  });

  it('un champ NON-tableau garde le classement de son premier échantillon non-null', () => {
    expect(kindDe([{ k: null }, { k: 3 }], 'k')).toBe('number');
    expect(inferFields([{ k: null }, { k: 3 }]).find((f) => f.key === 'k')!.nullable).toBe(true);
  });
});
