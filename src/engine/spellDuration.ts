/**
 * Durée d'un sort — donnée STRUCTURÉE (LDB 47), lue telle quelle par le moteur ; l'affichage est
 * dérivé (`spellRangeFormat.formatSpellDuration`). La MESURE est une `Formula` (engine/ops).
 */
import type { Formula } from './ops';

export type SpellDuration =
  | { kind: 'instant' } // « Instantané »
  | { kind: 'rounds'; value: Formula; plus?: true } // « (Bonus de FM) Rounds », « 6 rounds » (échelle tactique) ; LDB 47 l.311
  | { kind: 'clock'; value: Formula; unit: 'minutes' | 'hours' | 'days' } // « 1 heure », « (FM) minutes »
  | { kind: 'untilDawn' } // « Jusqu'au (prochain) lever du soleil »
  | { kind: 'special'; text: string; plus?: true }; // « Spécial », « Variable », « 8 Tours » (non chiffrable), homebrew ; LDB 47 l.311
