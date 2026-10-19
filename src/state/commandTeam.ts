/**
 * COMMANDANT D'ÉQUIPE (Talent, AA 13 l.29-35) — couche STATE pure (dépend de la GÉOMÉTRIE de combat comme
 * `shipPostes`/`fireArc` ; le moteur reste pur). Un Personnage doté du Talent peut, par un Test de Commandement
 * Intermédiaire (+0), AIDER une équipe servant une Arme d'équipe « à portée de voix » : sur réussite, l'équipe
 * tire ENSUITE au score de Projectiles DU COMMANDANT.
 *
 * « À portée de voix » n'est chiffrée NULLE PART (AA 13 l.35, LDB 09 l.128) : la portée est une RÈGLE
 * ÉDITABLE (`combat-voice-range-m`, `engine/policy.ts`), lue à chaque mesure, jamais une constante
 * enterrée. Mesurée par le MÊME mécanisme d'aura que les Traits (Chebyshev × 2 m/case, cf.
 * `state/combat/roundHooks` `recompute-auras`).
 */
import { combatValue, type ModLine } from '../engine/combat';
import { RULE_REF } from '../engine/ruleRefs';
import { hasCommandTeam } from '../engine/combatFeatures/dispatch';
import { isOutOfAction } from '../engine/conditions';
import { rule } from '../engine/policy';
import { chebyshev } from '../noyau/monde/path';
import type { Combatant, Weapon } from '../engine/types';

/** id du Défaut « Arme d'équipe » (registre de qualités) — même littéral que `engine/crewedWeapon`. */
const ARME_D_EQUIPE = 'arme-d-equipe';

/** Portée de voix de commandement EFFECTIVE, en mètres (règle `combat-voice-range-m`). */
export function voiceCommandRangeM(): number {
  return rule('combat-voice-range-m') as number;
}

/** Deux combattants sont-ils à portée de voix l'un de l'autre ? (géométrie d'aura : Chebyshev × 2 m/case). */
function withinVoice(a: Combatant, b: Combatant): boolean {
  return !!a.pos && !!b.pos && chebyshev(a.pos, b.pos) * 2 <= voiceCommandRangeM();
}

/** Le combattant SERT-il une Arme d'équipe (chef de pièce d'une arme au Défaut `arme-d-equipe`) ? On lit la
 *  pièce SERVIE (`mannedPoste.item`), source de vérité de l'équipement — pas l'arme déjà dégradée au tir. */
export function servesTeamWeapon(c: Combatant): boolean {
  const item = c.mannedPoste?.item;
  return !!item && (item.qualities ?? []).some((q) => q.id === ARME_D_EQUIPE);
}

/** Chefs de pièce QUE `commander` peut diriger MAINTENANT : un combattant de SON camp, encore en action,
 *  servant une Arme d'équipe À PORTÉE de voix. SOURCE UNIQUE de l'éligibilité (affordance JOUEUR + IA). PURE. */
export function teamCommandTargets(commander: Combatant, combatants: Combatant[]): Combatant[] {
  if (!commander.pos) return [];
  return combatants.filter(
    (c) =>
      c.id !== commander.id &&
      c.kind === commander.kind && // on ne dirige QUE sa propre équipe
      !isOutOfAction(c) &&
      servesTeamWeapon(c) &&
      withinVoice(commander, c),
  );
}

/** `commander` peut-il lancer l'action « Diriger l'équipe » ? (porte le Talent ET ≥ 1 chef dirigeable à portée). */
export function canAidTeam(commander: Combatant, combatants: Combatant[]): boolean {
  return hasCommandTeam(commander) && teamCommandTargets(commander, combatants).length > 0;
}

/** Le commandant ENCORE valide pour CE chef de pièce : il existe, est en action, porte le Talent, ET reste à
 *  portée de voix. Re-validé à CHAQUE tir (pas d'expiry à gérer) — s'il meurt ou s'éloigne, `undefined` →
 *  le bonus lapse de lui-même. PURE. */
export function effectiveCommander(chief: Combatant, combatants: Combatant[]): Combatant | undefined {
  const id = chief.teamCommanderId;
  if (!id) return undefined;
  const cmd = combatants.find((c) => c.id === id);
  if (!cmd || isOutOfAction(cmd) || !hasCommandTeam(cmd) || !withinVoice(chief, cmd)) return undefined;
  return cmd;
}

/** Substitution « Commandant d'équipe » (AA) en `ModLine` pour `attackEnv` : le `base` du jet est le score
 *  du CHEF → on pousse le DELTA (score du commandant − score du chef), si bien que `base + delta` = score du
 *  commandant. `null` si le chef ne tire pas la pièce servie, n'a pas de commandant lié, ou que le commandant
 *  a lapsé (mort / hors portée). Substitution de SCORE : `famille: 'jet'` — hors du plafond « Combiner
 *  les Difficultés » (`LDB 14 l.48/95`). PURE — couvre l'aperçu ET la résolution (même `env`). */
export function teamCommandMod(chief: Combatant, weapon: Weapon, combatants: Combatant[]): ModLine | null {
  // Seulement quand le chef tire l'ARME D'ÉQUIPE servie (« quand ils tirent avec l'arme », AA 13 l.35).
  if (!chief.mannedPoste || chief.teamCommanderId == null || weapon.uid !== chief.mannedPoste.item.uid) return null;
  const cmd = effectiveCommander(chief, combatants);
  if (!cmd) return null;
  const delta = combatValue(cmd, 'ranged', weapon) - combatValue(chief, 'ranged', weapon);
  if (delta === 0) return null; // aucune substitution à montrer
  return { label: 'Commandant d’équipe', value: delta, famille: 'jet', ref: RULE_REF['commandant-d-equipe'] };
}
