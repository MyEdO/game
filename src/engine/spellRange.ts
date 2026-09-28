/**
 * Portée et Cible d'un sort — données STRUCTURÉES (LDB 46/47), lues telles quelles par le moteur ;
 * l'affichage est dérivé par `spellRangeFormat.ts`. La MESURE est une `Formula` (engine/ops).
 */
import type { Formula } from './ops';
import type { Condition } from './flowCore';

/** Portée d'un sort — d'OÙ il peut être lancé. */
export type SpellRange =
  | { kind: 'self' } // « Vous »
  | { kind: 'touch' } // « Contact » / « Toucher »
  | { kind: 'distance'; value: Formula; unit: 'm' | 'km' } // « 6 mètres », « (Force Mentale) mètres », « (Bonus de FM) mètres »
  | { kind: 'special'; text: string }; // « Spécial »/« Voir texte »/valeur non chiffrable (homebrew)

/** Cible d'un sort — QUI/QUOI il affecte.
 *
 *  `affects` (formes de ZONE) : `Condition` évaluée PAR CANDIDAT à l'énumération de la zone
 *  (`target` = le candidat, `caster` = le lanceur) — le candidat n'entre en zone que si elle est
 *  vraie. Champ ABSENT = LDB 47 l.28. Vocabulaire partagé `Condition` (`flowCore.ts`), aucune
 *  énumération de camp propre au sort.
 *
 *  `maison` : valeur maison ÉDITABLE portant sa justification, quand le RAW laisse un point ouvert
 *  — CLAUDE.md règle 7. */
export type SpellTarget =
  | { kind: 'self' } // « Vous »
  | { kind: 'count'; n: Formula } // 1, « (Bonus d'Intelligence) alliés »
  | { kind: 'area'; span: 'radius' | 'diameter'; meters: Formula; excludesCaster?: boolean; affects?: Condition; maison?: string } // toute forme de ZONE
  | { kind: 'cone'; lengthMeters: Formula; widthMeters: Formula; affects?: Condition; maison?: string } // « Cône Longueur (8 m) x Largeur (2 m) »
  | { kind: 'special'; text: string }; // « Spécial », « 1 voilier… », « ZdE (un lieu unique) », homebrew
