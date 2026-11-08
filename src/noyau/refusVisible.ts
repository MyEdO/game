/**
 * REFUS VISIBLE — la porte UNIQUE par laquelle un geste demandé par le joueur est refusé en combat.
 *
 * Spec HUD § ARBITRAGE 2026-08-19, loi d'accompagnement (verbatim) : « Refus VISIBLE par construction
 * — jamais un refus muet au journal (doctrine #516 ; le journal n'est pas affiché en combat,
 * `LogDrawer`) ; le refus se dit à l'écran au point du geste. »
 *
 * Mesure qui fonde ce module (2026-08-19) : en combat, le tiroir du journal rend `battle.log` et JAMAIS
 * `state.journal` — un refus passé à `store.log` n'atteint aucun écran pendant un combat.
 *
 * CE QU'UN REFUS EST : un retour d'IHM LOCAL, adressé au joueur qui vient de cliquer. Il vit donc à la
 * RACINE du store, hors `battle` (même patron que `localIntent`) :
 *  - il NE VOYAGE PAS (exclu de l'instantané coop, `coop.LOCALES_AU_CLIENT`) — le refus opposé au geste de l'hôte n'a rien à
 *    dire à ses invités, et l'hôte qui exécute l'intent d'un invité ne lui vole pas son message ;
 *  - il NE PERSISTE PAS dans le journal de combat : ce tiroir garde les FAITS de jeu, un clic refusé
 *    n'en est pas un ;
 *  - chaque refus est un objet neuf : son IDENTITÉ le distingue du précédent, même de texte égal, pour qui
 *    l'éteint (`eteindreRefus`) ou le compare (hôtes) ; son `nonce`, dérivé du refus affiché, ne sert qu'à la clé
 *    d'affichage qui ré-anime la bannière.
 * HORS COMBAT il n'y a pas de bannière : le refus retombe alors sur le journal de partie, qui est LA
 * surface visible de ce contexte. Jamais de no-op silencieux.
 */
import type { Get, Set } from './flowTypes';
import { decidingSeat } from './netOwnership';

/** Le refus AFFICHÉ (un seul à la fois : le dernier geste refusé). */
export interface RefusIHM {
  texte: string;
  /** Clé d'affichage : la bannière ré-anime un refus de nonce neuf. L'identité du refus est son objet. */
  nonce: number;
}

/**
 * Refuse le geste courant EN LE DISANT. Renvoie `true` (le refus a été prononcé) pour que les sites
 * d'appel s'écrivent `return refuserGeste(...)`. N'a AUCUN autre effet de bord : l'aperçu, l'intention
 * armée et le tour appartiennent au site d'appel, qui les gère lui-même.
 */
export function refuserGeste(get: Get, set: Set, texte: string): boolean {
  if (!get().battle) {
    get().ecrireAuJournal(texte); // hors combat, le journal EST la surface visible — le refus s'y dit vraiment
    return true;
  }
  set({ refus: { texte, nonce: (get().refus?.nonce ?? 0) + 1 } });
  return true;
}

/** `refuserGeste` pour un geste qui peut arriver d'un AUTRE siège : appliqué chez l'hôte au nom d'un invité
 *  (`decidingSeat` ≠ `mySeat`), le refus n'est pas posé ici, l'invité le lit au gate de sa propre console.
 *  Renvoie `true` (le geste est refusé) dans les deux cas. */
export function refuserGesteDuSiege(get: Get, set: Set, texte: string): boolean {
  if (decidingSeat(get()) !== get().net.mySeat) return true;
  return refuserGeste(get, set, texte);
}

/** Éteint le refus `refus` — SI c'est toujours lui qui s'affiche (identité d'objet) : un refus survenu entre-temps a sa
 *  propre durée d'affichage, et la minuterie du précédent ne doit pas la couper. */
export function eteindreRefus(get: Get, set: Set, refus: RefusIHM): void {
  if (get().refus === refus) set({ refus: null });
}

/** Durée d'affichage d'un refus (ms) — le temps de le lire, pas plus : c'est un retour de geste. */
export const REFUS_MS = 2600;
