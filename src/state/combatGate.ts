/**
 * Garde unique de reprise du combat — « une modale / une pause empêche-t-elle l'IA d'avancer ? ».
 *
 * Avant, quatre sites (`resumeEnemyTurn`, `resumeSuspendedAI`, `advanceTurn`, `maybeRunEnemyTurn`)
 * recopiaient — et DIVERGEAIENT sur — la même liste de `pending*` bloquants. Ce module en fait UNE
 * définition. Étape A1 : strictement ISO-comportement, les divergences historiques de chaque site
 * (surveille-t-il `pendingCast` ? `pendingRoundStart` ?) sont rendues explicites via `opts`. L'étape
 * A1-bis unifie ces divergences (dérivation depuis le registre `MODAL_DEFS`).
 *
 * Module FEUILLE (convention « baril ») : n'importe RIEN de `combatFlow` ; ré-exporté par lui.
 */
import type { ArbiterState } from './modalArbiter';

// `aiDriven` vit désormais avec les primitives d'« qui pilote quoi » (`netOwnership`, dont dépend
// `controlsActive`) ; ré-exporté ICI pour ne pas casser ses consommateurs historiques (`from './combatGate'`).
export { aiDriven } from './netOwnership';

/**
 * Une modale de combat (ou la pause de Round) bloque-t-elle l'avancée/reprise de l'IA ?
 * `opts` reflète À L'IDENTIQUE ce que chaque garde historique surveillait :
 *  - `cast`       (défaut `true`)  : `resumeSuspendedAI` ne testait PAS `pendingCast`.
 *  - `roundStart` (défaut `false`) : seul `maybeRunEnemyTurn` testait `pendingRoundStart` ici
 *    (`advanceTurn` le fait par un `return` séparé en amont — comportement préservé côté appelant).
 */
export function combatAdvanceBlocked(
  s: ArbiterState,
  opts?: { cast?: boolean; roundStart?: boolean },
): boolean {
  if (!s.battle || s.battle.over) return true;
  if ((opts?.roundStart ?? false) && s.pendingRoundStart) return true;
  if ((opts?.cast ?? true) && s.pendingCast) return true;
  // NB : pas de `pendingFumble` ici — la Maladresse est une ÉTAPE de `pendingCascade` (source unique),
  // déjà couverte. La lister à part créait une 2ᵉ source de vérité désynchronisable → soft-lock.
  // NB : pas de file de révélations non plus — une révélation est une ÉTAPE de `pendingCascade`
  // (#942 L8), déjà couverte par le terme ci-dessus (même raison que `pendingFumble`).
  // Une défense vivante attend SA fenêtre (#1765) : le combat n'avance pas par-dessus.
  if (s.pendingFateSave || s.pendingCascade || s.pendingDefense) return true;
  return false;
}
