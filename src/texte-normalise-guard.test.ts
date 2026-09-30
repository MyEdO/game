/**
 * Garde de la COMPARAISON DE TEXTE NORMALISÉ (#1887, lot 6a-2a) : deux textes se comparent par
 * `aligner` (texte libre contre rendu) ou `memeTexte` (clé ou rendu contre rendu), déclarés dans
 * `src/data/source/decoupe.ts`, le foyer. Hors du foyer, dans le code de PRODUCTION de `src/` et
 * `scripts/`, aucune égalité ni `.includes`/`.startsWith`/`.endsWith`/`.indexOf` dont un côté est un
 * appel à `normText` ou `joinNorm` importés de ce foyer (`comparaisonDAppel`).
 *
 * Ce que cette garde ne voit pas : le rendu lié à un nom avant la comparaison
 * (`const a = normText(x); a === b`), et tout rendu reçu par une liaison locale ou un paramètre —
 * la reconnaissance ne suit aucun flot.
 */
import { describe, it, expect } from 'vitest';
import {
  comparaisonDAppel, constructionsReserveesDuCorpus, scanConstructionsReservees,
} from '../scripts/guards/lib/canonUnique.mjs';
import { corpusDesGardes } from '../scripts/guards/lib/commentPoison.mjs';
import { estFichierVitest } from '../scripts/guards/lib/fichierVitest.mjs';

const FOYER = 'src/data/source/decoupe.ts';

const COMPARAISON_DE_TEXTE = [{
  ...comparaisonDAppel({ nom: 'comparaison de texte normalisé', fonctions: { [FOYER]: ['normText', 'joinNorm'] } }),
  foyer: FOYER,
  domaine: (rel: string) => !estFichierVitest(rel),
}];

const IMPORTE = "import { joinNorm, normText } from '../../src/data/source/decoupe.ts';\n";

/** Les constructions reconnues dans un texte, par défaut un script de `scripts/source/`. */
const fixture = (text: string, rel = 'scripts/source/fixture.mjs') =>
  scanConstructionsReservees({ rel, text }, COMPARAISON_DE_TEXTE).map((t) => t.construction);
const VUE = ['comparaison de texte normalisé'];

describe('comparaison de texte normalisé (#1887 6a-2a)', () => {
  it('aucune comparaison de texte normalisé hors du foyer dans le code de production', () => {
    expect(constructionsReserveesDuCorpus(corpusDesGardes(), COMPARAISON_DE_TEXTE)).toEqual([]);
  });

  it('une égalité ou une méthode de comparaison sur un appel importé', () => {
    expect(fixture(`${IMPORTE}const ok = normText(b.md).includes(D);`)).toEqual(VUE);
    expect(fixture(`${IMPORTE}const ok = normText(res.md) === D;`)).toEqual(VUE);
    expect(fixture(`${IMPORTE}const ko = cible !== normText(c);`)).toEqual(VUE);
    expect(fixture(`${IMPORTE}const ok = joinNorm(p).startsWith(x);`)).toEqual(VUE);
    expect(fixture(`${IMPORTE}const i = texte.indexOf(normText(x));`)).toEqual(VUE);
    expect(fixture(`${IMPORTE}const ok = (normText(a) as string) === b;`), 'cast traversé').toEqual(VUE);
    expect(fixture("import * as D from '../../src/data/source/decoupe.ts';\nconst ok = D.normText(a) === b;"), 'espace de noms').toEqual(VUE);
  });

  it('les primitives du foyer, la normalisation sans comparaison, les homonymes', () => {
    expect(fixture("import { memeTexte } from '../../src/data/source/decoupe.ts';\nconst ok = memeTexte(a, b);")).toEqual([]);
    expect(fixture(`${IMPORTE}const cible = normText(x);`), 'normalisation seule').toEqual([]);
    expect(fixture('const normText = (s) => s.trim();\nconst ok = normText(a) === b;'), 'homonyme local').toEqual([]);
    expect(fixture("import { normText } from '../../src/lib/normalize.ts';\nconst ok = normText(a) === b;"), 'homonyme d’un autre module').toEqual([]);
    expect(fixture(`${IMPORTE}const a = normText(x);\nconst ok = a === b;`), 'angle mort nommé : rendu lié à un nom').toEqual([]);
  });

  it('le foyer et les tests', () => {
    expect(fixture("const ok = normText(a) === b;", FOYER)).toEqual([]);
    expect(fixture(`${IMPORTE}const ok = normText(a) === b;`, 'scripts/source/fixture.test.mjs')).toEqual([]);
  });
});
