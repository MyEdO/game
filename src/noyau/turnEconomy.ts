import type { Combatant } from '../engine/types';
import type { BattleState } from './etat';
import { isOutOfAction } from '../engine/conditions';
import { canStrikeFirst } from '../engine/qualities/dispatch';
import { ACTION_GATES, freeDisengage, type ActionCtx } from './actionRegistry';

/**
 * Le héros actif a-t-il ENCORE une option UTILE ce tour ? (R6 du diagnostic lisibilité-combat). Sert au
 * garde-fou « tour gâché » et au surlignage « Fin du tour ».
 *
 * Les prédicats viennent du REGISTRE (`ACTION_GATES`, `src/noyau/actionRegistry.ts`) : ce module et
 * les surfaces (console, barre) lisent LA MÊME table — il n'y a plus de 2ᵉ dérivation manuscrite ici
 * (la divergence entre les deux dérivations a déjà coûté un bug, Détermination, commit `0e14119b`).
 * Pur : les gates consommés ne lisent que l'acteur et son combat.
 */
export function hasMeaningfulOption(active: Combatant, battle: BattleState): boolean {
  if (active.kind !== 'hero') return false;
  const ctx: ActionCtx = { active, battle };
  // Action disponible · Mouvement restant · désengagement gratuit (LDB 15 l.47) · Piétinement gratuit
  // (LDB 85) · attaque d'Arme gratuite de Frénésie (LDB 21 l.33) · Détermination en réserve (LDB 17 l.59-61).
  const gates = [
    'action-libre',
    'mouvement-restant',
    'pietinement-gratuit',
    'attaque-libre-frenesie',
    'determination-en-reserve',
  ];
  return gates.some((g) => ACTION_GATES[g](ctx).ok) || freeDisengage(ctx);
}

/**
 * Ce combattant peut-il choisir d'AGIR EN PREMIER ce Round (pré-emption d'initiative, LDB 17 l.25 :
 * « Au début du Round, choisissez le moment où vous allez agir, sans tenir compte de l'Ordre
 * d'Initiative ») ? Affiché dans la frise d'initiative (InitiativeStrip) pendant la pause de début de Round.
 *
 * Aujourd'hui : un combattant avec ≥1 point de Chance (ou une arme Rapide), pas déjà en tête de l'ordre, et
 * toujours en état d'agir. Le CONTRÔLE (qui peut réordonner) est filtré par l'appelant (`controlsCombatant`).
 * Point d'extension pour les RÉORDONNANCEMENTS d'initiative (Chance, arme Rapide). Tir rapide n'est PAS un
 * réordonnancement (interruption hors de l'ordre, LDB 10) → il ne passe PAS par ici. Pur.
 */
export function canActFirst(c: Combatant, battle: BattleState): boolean {
  // ÉLIGIBILITÉ par RESSOURCE/position (Chance ou arme Rapide) — le `kind` n'est PAS un gate ici : le
  // CONTRÔLE (qui peut réordonner qui) est appliqué par l'appelant UI (`controlsCombatant`, CampaignView).
  if (isOutOfAction(c)) return false;
  if (battle.order[0] === c.id) return false; // déjà en tête de l'ordre du Round
  // Réordonnancement d'initiative : Chance (LDB 17 l.25) ou arme Rapide (LDB 62 l.298-300).
  return (c.fortune ?? 0) > 0 || canStrikeFirst(c.weapons);
}

/** Le RÉORDONNANCEMENT d'initiative est-il gratuit pour `c` ? (arme Rapide LDB 62 l.298-300 ; sinon il coûte
 *  1 point de Chance, LDB 17 l.25). Tir rapide (interruption hors de l'ordre, LDB 10) ne réordonne pas. */
export function freeActFirst(c: Combatant): boolean {
  return canStrikeFirst(c.weapons); // arme Rapide (LDB 62)
}
