import type { Combatant } from '../engine/types';
import type { BattleState } from './store';
import { isOutOfAction } from '../engine/conditions';
import { canStrikeFirst } from '../engine/qualities/dispatch';
import { actionGate, verdictDOffre, freeDisengage, type ActionCtx } from './actionRegistry';

/** Les options de l'économie du tour : l'id d'une entrée de `actions.json` (gate ET échappement au
 *  verrou d'État en donnée, lus par `actionGate`), ou un prédicat sans entrée (`{ gate }`, lu par
 *  `verdictDOffre`, sans échappement). Attaque · Mouvement (LDB 16 l.52) · Piétinement gratuit (LDB 85)
 *  · attaque d'Arme gratuite de Frénésie (LDB 21 l.33) · Détermination (LDB 17 l.59-61). */
const OPTIONS_DU_TOUR: (string | { gate: string })[] = [
  'attaque',
  'mouvement',
  { gate: 'pietinement-gratuit' },
  { gate: 'attaque-libre-frenesie' },
  'resolve-psych-immune',
];

/**
 * Le héros actif a-t-il ENCORE une option UTILE ce tour ? (R6 du diagnostic lisibilité-combat). Sert au
 * garde-fou « tour gâché » et au surlignage « Fin du tour ».
 *
 * Chaque option se juge par le verdict d'offre du REGISTRE (`actionGate` / `verdictDOffre`,
 * `src/state/actionRegistry.ts`), verrou d'État compris : la composition lue par la console.
 * Pur : les gates consommés ne lisent que l'acteur, son combat et l'heure de jeu.
 */
export function hasMeaningfulOption(active: Combatant, battle: BattleState, gameTime: number): boolean {
  if (active.kind !== 'hero') return false;
  const ctx: ActionCtx = { active, battle, gameTime };
  const offerte = (o: string | { gate: string }) =>
    (typeof o === 'string' ? actionGate(o, ctx) : verdictDOffre(o, ctx)).ok;
  // Désengagement gratuit (LDB 15 l.47).
  return OPTIONS_DU_TOUR.some(offerte) || freeDisengage(ctx);
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
