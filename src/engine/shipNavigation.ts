/**
 * PROGRESSION & MANŒUVRE d'un navire — couche PURE de MDG 13 « Navigation maritime ». BOOK-AGNOSTIC :
 * le « Personnage à la barre » et le Test de Navigation (Voile / Ramer) sont PARTAGÉS avec le Compagnon de
 * Mort sur le Reik ch.5 (fluvial) — on ne modélise donc rien de spécifiquement maritime ici, juste la
 * traduction RAW d'un DR de Test en déplacement. Les modificateurs propres à un
 * livre (Savoir (Océans) « premier chiffre » en mer ; Savoir (Voies fluviales) +1 DR en eau douce) sont
 * passés par l'appelant via `extraDR`, jamais codés ici.
 */
import navalProgressionJson from '../data/naval-progression.json';
import { findTableEntry, tableOuverte, type BandeOuverte } from './tables';
import { memoParVersion } from '../data/versionDataset';

type ProgressionMode = 'plus2' | 'plus1' | 'normal' | 'minus1' | 'half';
interface ProgressionEntry extends BandeOuverte {
  mode: ProgressionMode;
  desc: string;
}
/** La table telle que `findTableEntry` la lit (`tableOuverte`) : « 4 ou plus » et « –5 ou moins »
 *  (MDG 13 l.71, l.75) sont ouvertes. Mémoïsée sur le dataset, que le Codex édite. */
const progression = memoParVersion('navalProgression', () => tableOuverte((navalProgressionJson as { entries: ProgressionEntry[] }).entries));

/** Déplacement effectif d'un navire de Mouvement `baseM` selon le DR du Test de Navigation (MDG 13
 *  l.68-75). PUR. */
export function progressionMovement(baseM: number, dr: number): number {
  switch (findTableEntry(progression(), dr).mode) {
    case 'plus2': return baseM + 2;
    case 'plus1': return baseM + 1;
    case 'minus1': return baseM - 1;
    case 'half': return Math.floor(baseM / 2);
    default: return baseM;
  }
}

/** Résultat chiffré d'un Test de Manœuvre : DR final, déplacement effectif et libellé de progression. */
export interface ShipManeuverOutcome {
  /** DR final = DR du Test de Navigation + Man du bateau + `extraDR`. */
  dr: number;
  /** Déplacement effectif (cases) via la table de Progression. */
  movement: number;
  /** Libellé de progression verbatim (MDG 13). */
  label: string;
}

/**
 * Test de Manœuvre (MDG 13 l.119 ; MDG 12 l.50) : DR du Test de Navigation déjà résolu (`navTestDR`, RNG en
 * amont) + Man du bateau + `extraDR` (Salissures, météo, Détroit…) ; le déplacement suit la table de
 * Progression (MDG 13 l.68-75). PUR.
 */
export function resolveShipManeuver(navTestDR: number, baseM: number, manoeuvre: number, extraDR = 0): ShipManeuverOutcome {
  const dr = navTestDR + manoeuvre + extraDR;
  return { dr, movement: progressionMovement(baseM, dr), label: findTableEntry(progression(), dr).desc };
}
