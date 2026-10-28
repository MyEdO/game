import { describe, it, expect } from 'vitest';
import reglesOptionnelles from './reglesOptionnelles.json';

/**
 * Garde-fou « une règle optionnelle est SOURCÉE ou MAISON, jamais les deux, jamais aucune »
 * (#1467 L1b V-Src).
 *
 * La garde de couverture accepte `source` OU `maison` indifféremment (`isCitedItem`,
 * `citationCoverage.mjs:25-27`), donc une entrée portant les DEUX y passerait pour citée. Or les deux
 * champs se contredisent ici : `source` ancre la valeur à un folio imprimé, `maison` la déclare
 * arbitrée hors canon. Une entrée qui porte les deux ne dit plus d'où sa valeur vient.
 *
 * Le test pose des INVARIANTS, jamais des comptes (#2995) : ajouter, retirer ou reclasser une donnée
 * ne le rougit que si elle viole l'un d'eux.
 *
 * PORTÉE — À LIRE AVANT DE GÉNÉRALISER : « jamais les deux » est un invariant LOCAL de CE dataset,
 * pas une règle de fabrique. `document()` pose `source` ∨ `maison` (au moins l'un des deux) ; la
 * COEXISTENCE des deux est légitime ailleurs, sur des entrées de premier niveau (`maison` CHAÎNE non
 * vide) : une entrée y cite son folio ET dit ce que le canon n'a pas tranché. Étendre ce XOR à la
 * fabrique les casserait ; la fabrique est tenue par `grammaire/grammaire.test.ts` (« exige une PROVENANCE »).
 */

type Regle = { id: string; ref?: string; source?: { book: string; page: number }; maison?: string };

const REGLES = reglesOptionnelles as Regle[];

describe('reglesOptionnelles.json — partition source ⊕ maison (#1467 L1b)', () => {
  it('chaque entrée porte `source` XOR `maison` — jamais les deux, jamais aucune', () => {
    const deuxFois: string[] = [];
    const aucune: string[] = [];
    for (const r of REGLES) {
      const aSource = !!r.source;
      const aMaison = typeof r.maison === 'string' && r.maison.length > 0;
      if (aSource && aMaison) deuxFois.push(r.id);
      if (!aSource && !aMaison) aucune.push(r.id);
    }
    expect(deuxFois, `entrée(s) à la fois SOURCÉE et MAISON : ${deuxFois.join(', ')}`).toEqual([]);
    expect(aucune, `entrée(s) SANS provenance : ${aucune.join(', ')}`).toEqual([]);
  });

  it('une entrée SOURCÉE porte un folio numérique et un livre non vide', () => {
    const fautifs = REGLES.filter((r) => r.source).filter(
      (r) => typeof r.source!.page !== 'number' || !r.source!.book,
    );
    expect(fautifs.map((r) => r.id)).toEqual([]);
  });
});
