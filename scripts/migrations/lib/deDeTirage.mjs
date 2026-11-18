/**
 * Le dé de TIRAGE d'une table aux deux formes de l'histoire des migrations : l'expression « NdM »
 * d'avant `2026-11-18-4056-de-de-tirage-objet.mjs`, le `DiceSpec` `{ n, sides }` d'après
 * (`deDeTirageSchema`, `src/data/schemas/grammaire/valeurs.ts`). Une migration antérieure à #4056 tient
 * la forme objet pour la forme qu'elle attendait : rejouée sur l'arbre migré, elle reste muette.
 */
import { isDeepStrictEqual } from 'node:util';
import { estObjet } from '../../../src/lib/objet.mjs';

const DE_LU = /^(\d*)d(\d+)$/i;

/**
 * Le `DiceSpec` de l'expression « NdM » (N omis vaut 1), ou `null` si elle est illisible.
 * @param {string} texte
 * @returns {{ n: number, sides: number } | null}
 */
export function deLu(texte) {
  const m = DE_LU.exec(texte.trim());
  const n = m ? (m[1] ? Number(m[1]) : 1) : 0;
  const sides = m ? Number(m[2]) : 0;
  return n < 1 || sides < 1 ? null : { n, sides };
}

/**
 * `valeur` est-elle un dé de tirage, expression ou `{ n, sides }` aux entiers de 1 ?
 * @param {unknown} valeur
 * @returns {boolean}
 */
export const estUnDeDeTirage = (valeur) =>
  typeof valeur === 'string' ||
  (estObjet(valeur) &&
    Object.keys(valeur).length === 2 &&
    [valeur.n, valeur.sides].every((x) => Number.isInteger(x) && x >= 1));

/**
 * `valeur` est-elle le dé `expression`, sous l'une de ses deux formes ?
 * @param {unknown} valeur
 * @param {string} expression
 * @returns {boolean}
 */
export const vautLeDe = (valeur, expression) => valeur === expression || isDeepStrictEqual(valeur, deLu(expression));
