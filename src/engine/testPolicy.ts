/**
 * Politique de résolution d'un Test d100 (LDB 12) — dérivée du registre des règles optionnelles.
 *
 * `evaluateTest`, `rollTest` et `maxForcedRoll` (tests.ts) LISENT cette policy : c'est le SEUL
 * endroit qui décide comment une réussite, un DR et les bandes automatiques sont calculés. Changer
 * une règle de Test (panneau in-game ou défaut du registre) suffit ; aucun autre fichier ne bouge.
 *
 * - bandsMode : 'normal' = RAW (01..autoSuccessMax réussite auto, autoFailMin..00 échec auto, LDB 12
 *   l.46) ; 'inverted' = règle maison (les deux bandes échangées) ; 'off' = aucune bande.
 * - slMode : 'standard' = DR par différence de dizaines ; 'fast' = sur une réussite, DR = dizaines
 *   du jet (« Calculer Rapidement un DR », LDB 12 l.102).
 */
import { rule } from './policy';

export type BandsMode = 'normal' | 'inverted' | 'off';
export type SLMode = 'standard' | 'fast';

export interface TestPolicy {
  /** 01..autoSuccessMax = bande basse (LDB 12 l.28). */
  autoSuccessMax: number;
  /** autoFailMin..00 = bande haute (LDB 12 l.28). */
  autoFailMin: number;
  bandsMode: BandsMode;
  slMode: SLMode;
  /** Bornes d'une valeur cible (LDB 12 : 1..99). */
  targetMin: number;
  targetMax: number;
}

/** Policy EFFECTIVE courante (lit les règles optionnelles). Appelée à chaque Test → reflète les
 *  surcharges in-game en direct. */
export function getTestPolicy(): TestPolicy {
  // Largeur des bandes auto réglable (LDB 12 l.32) : 01..N réussite, (101−N)..00 échec. Défaut 5 → 01-05 / 96-00.
  const bandWidth = rule('test-largeur-bandes-auto') as number;
  return {
    autoSuccessMax: bandWidth,
    autoFailMin: 101 - bandWidth,
    bandsMode: rule('test-bandes-auto') as BandsMode,
    slMode: rule('test-dr-rapide') ? 'fast' : 'standard',
    targetMin: 1,
    // « Tests >100 % » (LDB 12 l.77) : on lève le plafond → tens(valeur) donne +1 DR par 10 % au-delà de 100.
    targetMax: rule('test-plus-de-100') ? 999 : 99,
  };
}
