/**
 * `tableTotale` (#1903) : la table keyée par les éléments d'une liste, et la construction réservée qui
 * la garde, `CONSTRUCTION_DE_TABLE_TOTALE` (`scripts/guards/lib/canonUnique.mjs`), jugée sur le
 * périmètre des gardes, `.mjs` compris, hors de son foyer.
 * Angles morts : une table keyée par une clé DÉRIVÉE de l'élément (`[x.id, …]`), qui n'est pas une
 * table sur la liste ; une table remplie par une boucle (`for (const k of XS) o[k] = …`).
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import { tableTotale } from './tableTotale';
import { corpusDesGardes } from '../../scripts/guards/lib/commentPoison.mjs';
import {
  CONSTRUCTION_DE_TABLE_TOTALE,
  constructionsReserveesDuCorpus,
  scanConstructionsReservees,
} from '../../scripts/guards/lib/canonUnique.mjs';

const TABLE_TOTALE = { ...CONSTRUCTION_DE_TABLE_TOTALE, foyer: 'src/lib/tableTotale.ts' };
const fixture = (text: string, rel = 'src/x.ts') => ({ rel, text });
const sites = (text: string, rel?: string) => scanConstructionsReservees(fixture(text, rel), [TABLE_TOTALE]).length;

describe('tableTotale (#1903)', () => {
  it('clés égales à la liste et dans son ordre, `f` appelée une fois par clé avec son indice', () => {
    const appels: [string, number][] = [];
    const t = tableTotale(['b', 'a', 'c'], (k, i) => (appels.push([k, i]), k.toUpperCase()));
    expect(Object.keys(t)).toEqual(['b', 'a', 'c']);
    expect(t).toEqual({ b: 'B', a: 'A', c: 'C' });
    expect(appels).toEqual([['b', 0], ['a', 1], ['c', 2]]);
    expect(tableTotale(['a', 'b'], (_k, indice) => indice)).toEqual({ a: 0, b: 1 });
  });

  it('type : `Record<K, T>` sur un tuple `as const`, `Record<string, T>` sur un `string[]`', () => {
    expectTypeOf(tableTotale(['a', 'b'] as const, () => 1)).toEqualTypeOf<Record<'a' | 'b', number>>();
    const libres: string[] = ['x'];
    expectTypeOf(tableTotale(libres, () => 1)).toEqualTypeOf<Record<string, number>>();
  });

  it('la construction ne s’écrit nulle part ailleurs dans le périmètre des gardes', () => {
    expect(constructionsReserveesDuCorpus(corpusDesGardes(), [TABLE_TOTALE])).toEqual([]);
  });

  it('la construction lit la FORME : paramètre rendu en clé, flèche ou `function`, casts compris', () => {
    expect(sites('const t = Object.fromEntries(XS.map((k) => [k, f(k)]));'), 'TypeScript').toBe(1);
    expect(sites('const t = Object.fromEntries(XS.map((k) => [k, f(k)]));', 'scripts/x.mjs'), '.mjs').toBe(1);
    expect(sites('const t = Object.fromEntries(xs.map((k, i) => [k, i]));'), 'indice lu').toBe(1);
    expect(sites('const t = Object.fromEntries(xs.map((k, i) => [k, i])) as Record<K, T>;'), 'cast de la table').toBe(1);
    expect(sites('const t = Object.fromEntries(xs.map(function (k) { return [k, 1]; }));'), '`function` à `return`').toBe(1);
    expect(sites('const t = Object.fromEntries(xs.map((x) => [x.id, x]));'), 'clé dérivée de l’élément').toBe(0);
    expect(sites('const t = new Map(xs.map((k) => [k, f(k)]));'), 'une `Map`').toBe(0);
    expect(sites('const t = Object.fromEntries(xs.map((k) => [k, f(k)]));', 'src/lib/tableTotale.ts'), 'le foyer').toBe(0);
  });
});
