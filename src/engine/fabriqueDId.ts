/**
 * LA FABRIQUE D'IDS DU MONDE (#2907) : ce qui forge l'id d'une chose qui entre dans l'état (objet, objet posé au sol, lot de cargaison, dépôt,
 * ligne de répartition ou de butin, enchantement, possession, faveur, héros créé dans la partie). Tout site qui forge la reçoit,
 * requise et sans défaut, comme un `RNG`. La fabrique d'une partie lit et avance le compteur de son état (`forgerUnId`,
 * `src/noyau/idsDuMonde.ts`) : deux rejeux d'un même fichier forgent les mêmes ids, et un id forgé après un chargement
 * dépasse tous ceux de la save.
 */
import type { IdDeHerosDuRoster } from '../lib/idDeHerosDuRoster';

/** Le genre d'un id du monde : son préfixe. */
export type GenreDId = 'it' | 'hero' | 'pos' | 'favor' | 'depot-au-sol' | 'assaillant';

/** Forge l'id neuf d'un genre. */
export type FabriqueDId = (genre: GenreDId) => string;

/** L'entropie de la plateforme, que l'hôte passe au roster : l'id d'un héros de roster et ceux de ses objets. */
export interface FabriqueDuRoster {
  (genre: 'hero'): IdDeHerosDuRoster;
  (genre: GenreDId): string;
}

/** L'id de rang `n` du genre `genre`. */
export const idDuGenre = (genre: GenreDId, n: number): string => `${genre}-${n}`;

/** Une fabrique LOCALE, hors de l'état : ce qu'elle forge n'y entre jamais (aperçu de création, galerie). `prefixe` tient
 *  ses ids à l'écart de ceux de l'état. */
export function fabriqueLocale(prefixe: string): FabriqueDId {
  let n = 0;
  return (genre) => `${prefixe}-${idDuGenre(genre, ++n)}`;
}
