/**
 * DOCUMENT MONO-TABLE (#1667, train (c)) — la forme que pose
 * `2026-11-06-1667-tableaux-racines-mono-tables.mjs` : un tableau RACINE de lignes devient
 * `{ …enveloppe, entries }`, ses lignes (les rangées) sans `type`. Une migration ANTÉRIEURE dans
 * l'ordre lexical reconnaît au rejeu la forme que cette POSTÉRIEURE produit.
 */

/** `racine` est-elle un document mono-table ? @param {unknown} racine @returns {boolean} */
export const estMonoTable = (racine) =>
  racine !== null && typeof racine === 'object' && !Array.isArray(racine) && Array.isArray(/** @type {{ entries?: unknown }} */ (racine).entries);

/** Les LIGNES d'un tableau racine, à sa forme d'avant (la racine) ou d'après (ses `entries`).
 *  @param {any} racine @returns {any[]} */
export const lignesDe = (racine) => (estMonoTable(racine) ? racine.entries : racine);
