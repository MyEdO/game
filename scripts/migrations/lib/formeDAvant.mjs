/**
 * FORME D'AVANT SEULE (#3080) — la reconnaissance commune des gestes des migrations datées.
 *
 * Un geste n'agit que sur la forme d'avant EXACTE de ce qu'il réécrit, comparée par égalité profonde
 * (`isDeepStrictEqual` : l'ordre des clés n'y compte pas) ; une entrée absente, déjà à la forme d'après,
 * ou révisée depuis la migration, passe sans faute. Patron : `2026-10-27-1463-etiquettes-a0a.mjs`.
 * La porte de classe : `scripts/corpus/migrations/retrait-des-entrees-nommees.test.mjs`.
 */
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { jsonCanonique } from '../../../src/lib/jsonCanonique.mjs';

/**
 * `valeur` porte-t-elle EXACTEMENT `tranche` : chaque clé de `tranche` à sa valeur, une clé valant
 * `undefined` ABSENTE de `valeur` ? Les clés hors de `tranche` ne comptent pas : ce sont celles que le
 * geste ne lit ni n'écrit.
 * @param {unknown} valeur
 * @param {Record<string, unknown>} tranche
 * @returns {boolean}
 */
export function porteLaTranche(valeur, tranche) {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) return false;
  return Object.entries(tranche).every(([cle, attendu]) =>
    attendu === undefined ? !Object.hasOwn(valeur, cle) : Object.hasOwn(valeur, cle) && isDeepStrictEqual(valeur[cle], attendu),
  );
}

/**
 * Dans `liste`, le premier élément EXACTEMENT égal à `avant` cède sa place aux éléments de `apres`.
 * Une liste absente, ou qui ne porte pas `avant`, reste telle quelle.
 * @param {unknown} liste
 * @param {unknown} avant
 * @param {unknown[]} apres
 * @returns {0 | 1} le nombre de gestes faits
 */
export function remplacerLaFormeDAvant(liste, avant, apres) {
  if (!Array.isArray(liste)) return 0;
  const i = liste.findIndex((x) => isDeepStrictEqual(x, avant));
  if (i < 0) return 0;
  liste.splice(i, 1, ...structuredClone(apres));
  return 1;
}

/**
 * L'EMPREINTE d'une forme d'avant trop longue pour s'écrire dans la migration (une entrée entière, sa
 * prose comprise) : SHA-256 de son JSON aux clés triées. Deux valeurs ont la même empreinte si et
 * seulement si elles sont égales en profondeur, quel que soit l'ordre de leurs clés.
 * @param {unknown} valeur
 * @returns {string}
 */
export const empreinteDeForme = (valeur) => createHash('sha256').update(jsonCanonique(valeur)).digest('hex');
