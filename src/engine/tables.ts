/**
 * Lookup PARTAGÉ d'une entrée de table d100 par fourchette `[min, max]` — SOURCE UNIQUE des tirages
 * sur table (Critiques, Oups !, Imparfaites/Colère, Corruptions, péripéties d'interlude…). Repli sur
 * la DERNIÈRE entrée si le jet dépasse la table (ne devrait jamais arriver pour une table bien formée).
 *
 * Réutiliser ; ne JAMAIS réécrire `table.find((e) => roll >= e.min && roll <= e.max) ?? table.at(-1)`.
 */
export function findTableEntry<T extends { min: number; max: number }>(table: T[], roll: number): T {
  return table.find((e) => roll >= e.min && roll <= e.max) ?? table[table.length - 1];
}

/**
 * Bande d'une table dont la DERNIÈRE n'a pas de plafond — `max: null` (JSON n'a pas d'Infinity).
 * Quatre tables l'impriment ainsi : « 71 et + » (LDB 07 l.49/l.70, coût d'Augmentation), « 4 ou plus »
 * (MDG 15 l.383, prix d'offre), « 81+ » (MDG 12 l.129, taille de coque), « 96 ou plus » (AA 10 l.127,
 * Critique de Structure).
 */
export interface BandeOuverte { min: number; max: number | null }

/**
 * La table telle que `findTableEntry` la lit : SEULE la borne haute de la dernière bande s'ouvre,
 * parce que c'est la seule que les livres écrivent. La borne BASSE reste FERMÉE — rien n'entre sous
 * le premier échelon imprimé, et une valeur qui n'y tombe pas est une ANOMALIE que l'appelant NOMME
 * (`findTableEntryIndex` < 0), jamais le repli de `findTableEntry` sur la dernière bande.
 *
 * SOURCE UNIQUE des tables ouvertes du moteur : prix d'offre du commerce (`./cargo`), coût
 * d'Augmentation (`./advancement`), colonne « Taille » des coques (`./shipBuild`), Critiques de
 * Structure (`./structureCritical`). La forme ouverte
 * est déclarée UNE fois en grammaire (`plageOuverteSchema`), elle s'ouvre UNE fois ici.
 * PUR.
 */
export function tableOuverte<T extends BandeOuverte>(bandes: readonly T[]): (T & { max: number })[] {
  return bandes.map((b) => ({ ...b, max: b.max ?? Number.POSITIVE_INFINITY }));
}

/** Variante INDEX de `findTableEntry` — pour les appelants qui doivent ensuite décaler l'entrée
 *  trouvée dans la table (crans de bonus/malus). Repli à −1 si aucune entrée ne couvre `roll` (le
 *  repli, contrairement à `findTableEntry`, est laissé à l'appelant). */
export function findTableEntryIndex<T extends { min: number; max: number }>(table: T[], roll: number): number {
  return table.findIndex((e) => roll >= e.min && roll <= e.max);
}
