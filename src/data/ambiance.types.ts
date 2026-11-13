/** VOCABULAIRE de visibilité d'une case, feuille de types partagée par la politique (`src/noyau/visibility.ts`) et
 *  les rendus (#2884). */

/** État de visibilité d'une case, du plus au moins connu (`visibilityOf`, `src/noyau/visibility.ts`). */
export type Visibility = 'visible' | 'explored' | 'unknown';
