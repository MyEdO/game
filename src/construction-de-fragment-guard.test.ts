/**
 * Garde de la CONSTRUCTION D'UN FRAGMENT d'adresse de prose (#1887) : un fragment se bâtit par les
 * constructeurs de `src/data/source/decoupe.ts`, le foyer (`fragmentBlocs`, `fragmentCellule`,
 * `scelle`), qui posent son empreinte `sum`. Hors du foyer, dans le code de PRODUCTION de `src/` et
 * `scripts/` (`scripts/migrations/` compris), aucun objet littéral de `kind` `'blocs'` ou `'cellule'`,
 * ni recopie par propagation qui pose `sum`, ni recopie qui pose un champ de désignation hors argument
 * direct d'un constructeur (`constructionDeFragment`). Natures et désignation se lisent aux schémas
 * `fragmentBlocsSchema` et `fragmentCelluleSchema` (`grammaire/valeurs.ts`).
 *
 * Les tests sont hors du DOMAINE, sans table d'exemptions : ils forgent exprès des fragments
 * invalides (bornes inversées, empreinte fausse, section absente) pour éprouver les codes d'erreur
 * du résolveur, ce qu'aucun constructeur ne bâtit.
 *
 * Homonymes de production mesurés le 2026-10-01 (`{ ...x, champ }` hors fragment) : `row` 9 (lignes
 * de jet), `table` 8 dont `renvoi.ts`, qui importe le foyer. `row` n'est donc lu que dans un fichier
 * qui importe le foyer (`designationLiee`), et `table` nulle part. Ce que cette garde ne voit pas : un
 * fragment bâti sans littéral (`Object.assign`, propriété posée après coup, `kind` lu d'une
 * variable), une recopie qui ne change que `table`, et une recopie qui ne change que `row` dans un
 * fichier qui n'importe pas le foyer. Faux positif déclaré : une propagation qui pose un `sum` d'une
 * autre nature (`{ ...totaux, sum: a + b }`).
 */
import { describe, it, expect } from 'vitest';
import {
  constructionDeFragment, constructionsReserveesDuCorpus, scanConstructionsReservees,
} from '../scripts/guards/lib/canonUnique.mjs';
import { corpusDesGardes } from '../scripts/guards/lib/commentPoison.mjs';
import { estFichierVitest } from '../scripts/guards/lib/fichierVitest.mjs';
import { fragmentBlocsSchema, fragmentCelluleSchema } from './data/schemas/grammaire/valeurs';

const FOYER = 'src/data/source/decoupe.ts';
const SCHEMAS = [fragmentBlocsSchema, fragmentCelluleSchema];
const NOM = 'construction de fragment';

const FRAGMENT = [{
  ...constructionDeFragment({
    nom: NOM,
    natures: SCHEMAS.map((s) => s.shape.kind.value),
    designation: [...new Set(SCHEMAS.flatMap((s) => Object.keys(s.shape)))].filter((k) => !['kind', 'sum', 'table', 'row'].includes(k)),
    designationLiee: ['row'],
    constructeurs: { [FOYER]: ['fragmentBlocs', 'fragmentCellule', 'scelle'] },
  }),
  foyer: FOYER,
  domaine: (rel: string) => !estFichierVitest(rel),
}];

const IMPORTE = "import { fragmentBlocs, scelle } from '../data/source/decoupe';\n";

/** Les constructions reconnues dans un texte, par défaut un module de `src/ui/`. */
const vu = (text: string, rel = 'src/ui/fixture.tsx') =>
  scanConstructionsReservees({ rel, text }, FRAGMENT).map((t) => t.construction);
const VUE = [NOM];

describe('construction d’un fragment d’adresse (#1887)', () => {
  it('aucune construction de fragment hors du foyer dans le code de production', () => {
    expect(constructionsReserveesDuCorpus(corpusDesGardes(), FRAGMENT)).toEqual([]);
  });

  it('un fragment littéral, des deux natures, et une empreinte posée sur une recopie', () => {
    expect(vu("const f = { kind: 'blocs', sec, secOcc, b0: 0, b1: 0, sum: '' };")).toEqual(VUE);
    expect(vu("const f = { kind: 'cellule', sec, secOcc, row, col, sum: '' };")).toEqual(VUE);
    expect(vu("const f = { kind: 'blocs' as const, sec, secOcc, b0, b1, sum };"), 'cast traversé').toEqual(VUE);
    expect(vu("const r = { book, ch, parts: [{ kind: 'blocs', sec, secOcc, b0, b1, sum }] };"), 'dans une adresse').toEqual(VUE);
    expect(vu('const g = { ...f, sum };'), 'empreinte abrégée').toEqual(VUE);
    expect(vu("const g = { ...f, sum: '' };"), 'empreinte en clé').toEqual(VUE);
    expect(vu("frag = { kind: 'cellule', sec, secOcc, row, col: '', sum: '' }", 'scripts/source/fixture.mjs'), '.mjs').toEqual(VUE);
  });

  it('une recopie qui change la désignation hors constructeur, et la même en argument d’un constructeur', () => {
    expect(vu('const g = { ...f, b0: n, b1: Math.max(n, f.b1) };')).toEqual(VUE);
    expect(vu('const g = { ...f, sec: s.slug, secOcc: s.occ };')).toEqual(VUE);
    expect(vu(`${IMPORTE}const g = fragmentBlocs(c, { ...f, b0: n });`), 'argument d’un constructeur').toEqual([]);
    expect(vu(`${IMPORTE}const g = scelle(c, { ...f, sec: s.slug, secOcc: s.occ });`), 'argument de `scelle`').toEqual([]);
    expect(vu('const fragmentBlocs = (c, x) => x;\nconst g = fragmentBlocs(c, { ...f, b0: n });'), 'homonyme local').toEqual(VUE);
    expect(vu(`${IMPORTE}const g = { ...f, row: v };`), '`row` dans un fichier lié au foyer').toEqual(VUE);
    expect(vu('const g = { ...st, row: i };'), '`row` hors fichier lié').toEqual([]);
  });

  it('les autres objets, le foyer et les tests', () => {
    expect(vu("const o = { kind: 'bloc', md };"), 'une autre nature').toEqual([]);
    expect(vu('const o = { ...base, table, niveau };'), '`table` hors désignation').toEqual([]);
    expect(vu('const o = { total: 1, sum };'), 'empreinte sans recopie').toEqual([]);
    expect(vu("const f = { kind: 'blocs', sec, secOcc, b0, b1, sum: '' };", FOYER)).toEqual([]);
    expect(vu("const f = { kind: 'blocs', sec, secOcc, b0, b1, sum: '' };", 'src/ui/fixture.test.tsx')).toEqual([]);
  });
});
