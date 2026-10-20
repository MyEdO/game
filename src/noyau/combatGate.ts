/**
 * Garde unique de reprise du combat — « une modale / une pause empêche-t-elle l'IA d'avancer ? ».
 *
 * Les quatre sites de reprise (`resumeEnemyTurn`, `resumeSuspendedAI`, `advanceTurn`,
 * `maybeRunEnemyTurn`) lisent UNE définition de la liste des `pending*` bloquants ; ce que chacun
 * surveille en propre (`pendingCast` ? `pendingRoundStart` ?) est explicite via `opts`.
 *
 * Module FEUILLE : n'importe RIEN de `combatFlow`.
 */
import type { ArbiterState } from './modalArbiter';

/**
 * Une modale de combat (ou la pause de Round) bloque-t-elle l'avancée/reprise de l'IA ?
 * `opts` dit ce que chaque site surveille en propre :
 *  - `cast`       (défaut `true`)  : `resumeSuspendedAI` ne teste PAS `pendingCast`.
 *  - `roundStart` (défaut `false`) : `maybeRunEnemyTurn` teste `pendingRoundStart` ici
 *    (`advanceTurn` le fait par un `return` séparé en amont).
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
