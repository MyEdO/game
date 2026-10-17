/**
 * Marchandage RAW — achat (LDB 59 l.43) et vente (LDB 59 l.54) d'objets du commerce courant.
 *
 * Homonyme `bargainPct` (`state/portFlow.ts`, MDG 15 l.335/385) : NON convergent, VOLONTAIREMENT —
 * source RAW distincte (négoce de cargaison, pas l'achat/vente d'objet du commerce courant), #351.
 */
import { SL_ASTOUNDING } from './tests';

/** Issue d'un Test opposé de Marchandage, vue de l'acheteur (LDB 59 l.43). */
export interface BargainOutcome {
  won: boolean;
  /** DR net de l'Opposé. */
  drNet: number;
  negotiator: boolean;
}

/** Remise d'ACHAT en points de pourcentage : LDB 59 l.43 ; Succès Stupéfiant au DR net, LDB 12 l.107. */
export function bargainBuyDiscountPct(won: boolean, drNet: number, negotiator: boolean): number {
  if (!won) return 0;
  return drNet >= SL_ASTOUNDING || negotiator ? 20 : 10;
}

/** Facteur appliqué au prix d'ACHAT : `1 − bargainBuyDiscountPct / 100`. */
export function bargainBuyFactor(won: boolean, drNet: number, negotiator: boolean): number {
  return (100 - bargainBuyDiscountPct(won, drNet, negotiator)) / 100;
}

/** Facteur appliqué à la base de VENTE (½ du listé) : gagné = 1 (½ plein), perdu = 0.5 (→ ¼). */
export function bargainSellFactor(won: boolean, _drNet: number, _negotiator: boolean): number {
  return won ? 1 : 0.5;
}
