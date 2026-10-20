/**
 * REFUS VISIBLE — la porte UNIQUE par laquelle un geste demandé par le joueur est refusé en combat.
 *
 * Spec HUD § ARBITRAGE 2026-08-19, loi d'accompagnement (verbatim) : « Refus VISIBLE par construction
 * — jamais un refus muet au journal (doctrine #516 ; le journal n'est pas affiché en combat,
 * `LogDrawer`) ; le refus se dit à l'écran au point du geste. »
 *
 * Mesure qui fonde ce module (2026-08-19) : en combat, `ui/LogDrawer` rend `battle.log` et JAMAIS
 * `state.journal` — un refus passé à `store.log` n'atteint aucun écran pendant un combat.
 *
 * CE QU'UN REFUS EST : un retour d'IHM LOCAL, adressé au joueur qui vient de cliquer. Il vit donc à la
 * RACINE du store, hors `battle` (même patron que `localIntent`) :
 *  - il NE VOYAGE PAS (exclu du snapshot `netFlow`) — le refus opposé au geste de l'hôte n'a rien à
 *    dire à ses invités, et l'hôte qui exécute l'intent d'un invité ne lui vole pas son message ;
 *  - il NE PERSISTE PAS dans le journal de combat : ce tiroir garde les FAITS de jeu, un clic refusé
 *    n'en est pas un ;
 *  - il porte un `nonce` STRICTEMENT croissant : deux refus identiques d'affilée sont deux évènements
 *    distincts, que la bannière ré-anime au lieu de rester muette (`ui/CombatBanner`).
 * HORS COMBAT il n'y a pas de bannière : le refus retombe alors sur le journal de partie, qui est LA
 * surface visible de ce contexte. Jamais de no-op silencieux.
 */
import type { Get, Set } from './flowTypes';

/** Le refus AFFICHÉ (un seul à la fois : le dernier geste refusé). */
export interface RefusIHM {
  texte: string;
  /** Identité de l'évènement — clé de ré-animation ET cible de l'effacement différé. */
  nonce: number;
}

let compteur = 0;

/**
 * Refuse le geste courant EN LE DISANT. Renvoie `true` (le refus a été prononcé) pour que les sites
 * d'appel s'écrivent `return refuserGeste(...)`. N'a AUCUN autre effet de bord : l'aperçu, l'intention
 * armée et le tour appartiennent au site d'appel, qui les gère lui-même.
 */
export function refuserGeste(get: Get, set: Set, texte: string): boolean {
  if (!get().battle) {
    get().log(texte); // hors combat, le journal EST la surface visible — le refus s'y dit vraiment
    return true;
  }
  set({ refus: { texte, nonce: ++compteur } });
  return true;
}

/** Éteint le refus affiché — SI c'est toujours celui qu'on croit : un refus survenu entre-temps a sa
 *  propre durée d'affichage, et la minuterie du précédent ne doit pas la couper. */
export function eteindreRefus(get: Get, set: Set, nonce: number): void {
  if (get().refus?.nonce === nonce) set({ refus: null });
}

/** Durée d'affichage d'un refus (ms) — le temps de le lire, pas plus : c'est un retour de geste. */
export const REFUS_MS = 2600;
