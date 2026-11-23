/**
 * Marchandage RAW — achat (LDB 59 l.43) et vente (LDB 59 l.54) d'objets du commerce courant ; négoce
 * de cargaison (MDG 15 l.335/385, MSRC 13 l.127/158 → WFJDR p.291 = LDB 59 l.43).
 */
import { SL_ASTOUNDING, type OpposedResult } from './tests';

/** Le sens d'un prix marchandé : ce que le groupe achète ou ce qu'il vend. */
export type SensDuPrix = 'achat' | 'vente';

/** Issue d'un Test opposé de Marchandage, vue de l'acheteur (LDB 59 l.43). */
export interface BargainOutcome {
  won: boolean;
  /** DR net de l'Opposé. */
  drNet: number;
  negotiator: boolean;
}

/** L'issue, vue de l'acheteur, du Test opposé de Marchandage `opp` (le groupe attaquant) au négociateur `negotiator` :
 *  perdue tant que l'Opposé n'est pas tranché. LDB 59 l.43 */
export function issueDuMarchandage(opp: Pick<OpposedResult, 'attackerWins' | 'netSL'> | null, negotiator: boolean): BargainOutcome {
  return { won: opp?.attackerWins ?? false, drNet: opp?.netSL ?? 0, negotiator };
}

/** Points de pourcentage d'un Marchandage gagné : LDB 59 l.43. */
const BARGAIN_WON_PCT = 10;
/** Points de pourcentage de plus au Succès Stupéfiant : LDB 59 l.43 ; DR net, LDB 12 l.107. */
const BARGAIN_ASTOUNDING_PCT = 10;
/** Points de pourcentage du Talent Négociateur, une fois : LDB 10 l.818, l.11, l.19 ; arbitrage #2547 (2026-10-09). */
export const NEGOTIATOR_PCT = 10;
/** Le prix sans Marchandage, ou au Marchandage perdu, en pourcent de la base du sens : le listé à l'achat (LDB 59 l.43),
 *  la moitié de la base ½ du listé à la vente (LDB 59 l.54). */
const SANS_MARCHANDAGE_PCT: Readonly<Record<SensDuPrix, number>> = { achat: 100, vente: 50 };
/** Facteur appliqué à la base de vente sans Marchandage (`SANS_MARCHANDAGE_PCT`). */
export const FACTEUR_DE_VENTE_SANS_MARCHANDAGE = SANS_MARCHANDAGE_PCT.vente / 100;

/** Points de pourcentage au-delà du Marchandage gagné : LDB 59 l.43, LDB 10 l.818 ; arbitrage #2547 (2026-10-09). */
function bargainExtraPct(drNet: number, negotiator: boolean): number {
  return (drNet >= SL_ASTOUNDING ? BARGAIN_ASTOUNDING_PCT : 0) + (negotiator ? NEGOTIATOR_PCT : 0);
}

/** Ampleur d'un Marchandage, en points de pourcentage : LDB 59 l.43, LDB 10 l.818 ; arbitrage #2547 (2026-10-09). */
export function bargainPct(won: boolean, drNet: number, negotiator: boolean): number {
  return won ? BARGAIN_WON_PCT + bargainExtraPct(drNet, negotiator) : 0;
}

/** Hausse d'une vente marchandée gagnée, en points de pourcentage sur la base ½ du listé : LDB 59 l.54, LDB 10 l.818 ;
 *  arbitrage #2547 (2026-10-09). */
export function hausseDeVente(issue: BargainOutcome): number {
  return issue.won ? bargainExtraPct(issue.drNet, issue.negotiator) : 0;
}

/** Le prix qu'un Marchandage du groupe fait dans le sens `sens`, en pourcent de la base du sens (`SANS_MARCHANDAGE_PCT`). */
function prixMarchandePct(issue: BargainOutcome, sens: SensDuPrix): number {
  if (sens === 'achat') return 100 - bargainPct(issue.won, issue.drNet, issue.negotiator);
  return issue.won ? 100 + hausseDeVente(issue) : SANS_MARCHANDAGE_PCT.vente;
}

/** Variation signée, en points de pourcentage, qu'un Marchandage du groupe fait dans le sens `sens` au prix sans
 *  Marchandage (`SANS_MARCHANDAGE_PCT`), celui que le marchand affiche avant lui. LDB 59 l.43, l.54 ; LDB 10 l.818 ;
 *  arbitrage #2547 (2026-10-09). */
export function variationDuMarchandage(issue: BargainOutcome, sens: SensDuPrix): number {
  return (100 * prixMarchandePct(issue, sens)) / SANS_MARCHANDAGE_PCT[sens] - 100;
}

/** Variation signée, en points de pourcentage, qu'un négoce de cargaison fait au prix dans le sens `sens`, le groupe
 *  attaquant de l'Opposé `opp` ; `negociateur` : qui porte le Talent Négociateur. MSRC 13 l.127, l.158 ; MDG 15 l.335,
 *  l.385 ; LDB 59 l.43. */
export function variationDuNegoce(
  opp: Pick<OpposedResult, 'winner' | 'netSL'>, sens: SensDuPrix, negociateur: { joueur: boolean; marchand: boolean },
): number {
  if (opp.winner === 'egalite') return 0;
  const joueur = opp.winner === 'attaquant';
  const ampleur = bargainPct(true, opp.netSL, joueur ? negociateur.joueur : negociateur.marchand);
  return joueur === (sens === 'vente') ? ampleur : -ampleur;
}

/** Facteur appliqué au prix d'ACHAT. */
export function bargainBuyFactor(issue: BargainOutcome): number {
  return prixMarchandePct(issue, 'achat') / 100;
}

/** Facteur appliqué à la base de VENTE. */
export function bargainSellFactor(issue: BargainOutcome): number {
  return prixMarchandePct(issue, 'vente') / 100;
}
