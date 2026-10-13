/**
 * PROGRESSION & MANŒUVRE d'un navire — couche PURE de MDG 13 « Navigation maritime ». BOOK-AGNOSTIC :
 * le « Personnage à la barre » et le Test de Navigation (Voile / Ramer) sont PARTAGÉS avec le Compagnon de
 * Mort sur le Reik ch.5 (fluvial) — on ne modélise donc rien de spécifiquement maritime ici, juste la
 * traduction RAW d'un DR de Test en déplacement / réussite de manœuvre. Les modificateurs propres à un
 * livre (Savoir (Océans) « premier chiffre » en mer ; Savoir (Voies fluviales) +1 DR en eau douce) sont
 * passés par l'appelant via `extraDR`, jamais codés ici.
 */
import navalProgressionJson from '../data/naval-progression.json';
import { findTableEntry } from './tables';

type ProgressionMode = 'plus2' | 'plus1' | 'normal' | 'minus1' | 'half';
interface ProgressionEntry {
  min: number;
  max: number;
  mode: ProgressionMode;
  desc: string;
}
const PROGRESSION = (navalProgressionJson as { entries: ProgressionEntry[] }).entries;

/** Déplacement effectif d'un navire de Mouvement `baseM` selon le DR du Test de Navigation (MDG 13
 *  l.68-75 : 4+ → M+2 ; 1 à 3 → M+1 ; −2 à 0 → M ; −3 à −4 → M−1 ; −5 ou moins → M÷2 arrondi inférieur). PUR. */
export function progressionMovement(baseM: number, dr: number): number {
  switch (findTableEntry(PROGRESSION, dr).mode) {
    case 'plus2': return baseM + 2;
    case 'plus1': return baseM + 1;
    case 'minus1': return baseM - 1;
    case 'half': return Math.floor(baseM / 2);
    default: return baseM;
  }
}

/** Issue d'un Test de Manœuvre : DR final, réussite du virage, déplacement effectif et libellé de progression. */
export interface ShipManeuverOutcome {
  /** DR final = DR du Test de Navigation + Man du bateau + `extraDR`. */
  dr: number;
  /** DR final ≥ 0. L'issue du virage est celle du Test qui le porte, posée par l'appelant :
   *  `deriveManeuver` (LDB 12 l.11), `deriveManeuverFromCrew` (MDG 14 l.13, l.76). */
  success: boolean;
  /** Déplacement effectif (cases) via la table de Progression. */
  movement: number;
  /** Libellé de progression verbatim (MDG 13). */
  label: string;
}

/**
 * Test de Manœuvre (MDG 13 l.119 ; MDG 12 l.50) : DR du Test de Navigation déjà résolu (`navTestDR`, RNG en
 * amont) + Man du bateau + `extraDR` (Salissures, météo, Détroit…) ; le déplacement suit la table de
 * Progression. `success` n'est pas l'issue du virage : LDB 12 l.11 (Test individuel), MDG 14 l.13, l.76
 * (Test d'équipage). PUR.
 */
export function resolveShipManeuver(navTestDR: number, baseM: number, manoeuvre: number, extraDR = 0): ShipManeuverOutcome {
  const dr = navTestDR + manoeuvre + extraDR;
  return { dr, success: dr >= 0, movement: progressionMovement(baseM, dr), label: findTableEntry(PROGRESSION, dr).desc };
}
