/**
 * Marchandage RAW — achat (LDB 59 l.43) et vente (LDB 59 l.54) d'objets du commerce courant ; négoce
 * de cargaison (MDG 15 l.335/385, MSRC 13 l.127/158 → WFJDR p.291 = LDB 59 l.43).
 */
import { SL_ASTOUNDING } from './tests';

/** Issue d'un Test opposé de Marchandage, vue de l'acheteur (LDB 59 l.43). */
export interface BargainOutcome {
  won: boolean;
  /** DR net de l'Opposé. */
  drNet: number;
  negotiator: boolean;
}

/** Points de pourcentage d'un Marchandage gagné : LDB 59 l.43. */
const BARGAIN_WON_PCT = 10;
/** Points de pourcentage de plus au Succès Stupéfiant : LDB 59 l.43 ; DR net, LDB 12 l.107. */
const BARGAIN_ASTOUNDING_PCT = 10;
/** Points de pourcentage du Talent Négociateur, une fois : LDB 10 l.818, l.11, l.19 ; arbitrage #2547 (2026-10-09). */
export const NEGOTIATOR_PCT = 10;

/** Points de pourcentage au-delà du Marchandage gagné : LDB 59 l.43, LDB 10 l.818 ; arbitrage #2547 (2026-10-09). */
function bargainExtraPct(drNet: number, negotiator: boolean): number {
  return (drNet >= SL_ASTOUNDING ? BARGAIN_ASTOUNDING_PCT : 0) + (negotiator ? NEGOTIATOR_PCT : 0);
}

/** Ampleur d'un Marchandage, en points de pourcentage : LDB 59 l.43, LDB 10 l.818 ; arbitrage #2547 (2026-10-09). */
export function bargainPct(won: boolean, drNet: number, negotiator: boolean): number {
  return won ? BARGAIN_WON_PCT + bargainExtraPct(drNet, negotiator) : 0;
}

/** Facteur appliqué au prix d'ACHAT : `1 − bargainPct / 100`. */
export function bargainBuyFactor(won: boolean, drNet: number, negotiator: boolean): number {
  return (100 - bargainPct(won, drNet, negotiator)) / 100;
}

/** Hausse de VENTE en points de pourcentage, sur la base ½ : LDB 59 l.54, LDB 10 l.818 ; arbitrage #2547 (2026-10-09). */
export function bargainSellBonusPct(won: boolean, drNet: number, negotiator: boolean): number {
  return won ? bargainExtraPct(drNet, negotiator) : 0;
}

/** Facteur appliqué à la base de VENTE (½ du listé) : LDB 59 l.54, LDB 10 l.818 ; arbitrage #2547 (2026-10-09). */
export function bargainSellFactor(won: boolean, drNet: number, negotiator: boolean): number {
  return won ? (100 + bargainSellBonusPct(won, drNet, negotiator)) / 100 : 0.5;
}
