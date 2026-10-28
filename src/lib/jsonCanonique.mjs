// JSON CANONIQUE (#3080) — module PUR sans import (patron de `src/lib/ordre.mjs` : un `.mjs` entre dans
// la clôture statique de `npm run gates`, qui ne porte aucun module TypeScript).

/** Le JSON d'une valeur, clés TRIÉES à chaque niveau (ordre des unités de code, celui de `.sort()`), une clé
 *  de valeur `undefined` omise et un élément `undefined` de liste rendu `null`, comme par `JSON.stringify` :
 *  deux valeurs égales en profondeur ont le même texte, quel que soit l'ordre d'insertion de leurs clés.
 *  @type {(valeur: unknown) => string} */
export const jsonCanonique = (valeur) =>
  Array.isArray(valeur)
    ? `[${valeur.map((element) => (element === undefined ? 'null' : jsonCanonique(element))).join(',')}]`
    : valeur !== null && typeof valeur === 'object'
      ? `{${Object.keys(valeur).sort().filter((cle) => valeur[cle] !== undefined).map((cle) => `${JSON.stringify(cle)}:${jsonCanonique(valeur[cle])}`).join(',')}}`
      : JSON.stringify(valeur)
