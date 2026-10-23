/** Banc de la fabrique d'ids (#2907). */
import { fabriqueEnSequence, type FabriqueDId } from './entityId';

/** La fabrique en séquence, pour un banc qui reproduit les ids d'une partie d'hôte (`it-1`, `hero-1`) : hors de
 *  `src/hote`, elle ne s'importe que d'ici (`murs/fabrique-import`, `oxlint.config.mjs`). */
export { fabriqueEnSequence };

const enSequence = fabriqueEnSequence();

/** La fabrique des tests qui bâtissent hors d'une partie (héros, objets, ops) ou ouvrent une partie du noyau sans
 *  hôte. Partagée par tout un worker (`isolate: false`), elle ne rend jamais deux fois le même id, et sa forme
 *  `genre-banc-n` ne croise aucun id authoré d'une fixture (`it-1`, `hero-1`). */
export const idNeufDeBanc: FabriqueDId = (genre) => enSequence(`${genre}-banc`);
