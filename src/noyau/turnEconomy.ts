import type { Combatant } from '../engine/types';
import type { BattleState, Jeu } from './etat';
import { isOutOfAction } from '../engine/conditions';
import { canStrikeFirst } from '../engine/qualities/dispatch';
import { ACTION_GATES, freeDisengage, type ActionCtx } from './actionRegistry';
import { controlsCombatant } from './netOwnership';
import { inBattleId } from './monde/combatants';

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
 * Ce combattant peut-il AGIR EN PREMIER ce Round (réordonnancement d'initiative) ? LDB 17 l.25, LDB 62 l.298-300.
 * Lu par la frise d'initiative pendant la pause de début de Round ; le CONTRÔLE (qui réordonne qui) est filtré par
 * `actFirstIds` (`controlsCombatant`). Tir rapide (LDB 11 l.97-103) : `preemptRangedShot`. Pur.
 */
export function canActFirst(c: Combatant, battle: BattleState): boolean {
  // ÉLIGIBILITÉ par RESSOURCE/position (Chance ou arme Rapide) — le `kind` n'est PAS un gate ici : le
  // CONTRÔLE (qui peut réordonner qui) est appliqué par `actFirstIds` (`controlsCombatant`).
  if (isOutOfAction(c)) return false;
  if (battle.order[0] === c.id) return false; // déjà en tête de l'ordre du Round
  // Réordonnancement d'initiative : Chance (LDB 17 l.25) ou arme Rapide (LDB 62 l.298-300).
  return (c.fortune ?? 0) > 0 || canStrikeFirst(c.weapons);
}

/** Les héros que `roundStartPromote` accepte pendant la pause de début de Round : ceux que le siège qui décide
 *  contrôle (`controlsCombatant`) et qui peuvent agir en premier (`canActFirst`). Vide hors pause. LDB 17 l.25. */
export function actFirstIds(s: Jeu): string[] {
  const battle = s.battle;
  if (!battle || battle.over || !s.pendingRoundStart) return [];
  return battle.order.filter((id) => {
    const c = inBattleId(battle, id);
    return !!c && controlsCombatant(s, c) && canActFirst(c, battle);
  });
}

/** Le RÉORDONNANCEMENT d'initiative est-il gratuit pour `c` ? (arme Rapide LDB 62 l.298-300 ; sinon il coûte
 *  1 point de Chance, LDB 17 l.25). Tir rapide (interruption hors de l'ordre, LDB 10) ne réordonne pas. */
export function freeActFirst(c: Combatant): boolean {
  return canStrikeFirst(c.weapons); // arme Rapide (LDB 62)
}
