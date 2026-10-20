/**
 * Registre de HOOKS DE CYCLE DE VIE de combat — couture d'extension calquée 1:1 sur `cascadeAppliers`
 * (cascade.ts). MODULE FEUILLE : n'importe RIEN de combatFlow → pas de cycle. Les features (règles optionnelles, traits, sorts…) s'ENREGISTRENT comme handlers depuis des
 * modules feuilles (`defs/`, effet de bord à l'import — comme restFlow/travelFlow peuplent cascadeAppliers)
 * au lieu d'éditer le monolithe combatFlow ; le cœur ne connaît plus les features, il DISPATCHE via
 * `runCombatHooks`. L'activation passe par le registre de règles optionnelles (`policy.rule(enabledIf)`).
 *
 * RÈGLE D'OR (la résolution de combat N'EST PAS atomique : `applyAttackResult` peut poser `pendingFateSave`
 * et SUSPENDRE) : un hook qui doit suspendre (modale/choix) POUSSE une étape de cascade (`pushCombatStep`,
 * comme deviation/triggeredChoice le font déjà) — il ne RETOURNE JAMAIS de valeur. Le bus `EVT.BATTLE_OVER`
 * (bus.ts, fire-and-forget) est réservé aux FX/audio : c'est un faux-ami pour un hook mutateur, à NE PAS
 * utiliser ici. Contrat de pureté/sérialisabilité IDENTIQUE à CascadeApplier : l'argument est l'état
 * (get/set), jamais une closure capturée dans un pending (snapshoté/transmis en coop).
 */
import type { Get, Set as SetFn } from './flowTypes';
import type { BattleState } from '../state/store';
import type { Combatant, Weapon } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import { rule } from '../engine/policy';
import type { EffectTrigger } from '../engine/flowCore';

/** Le moment du cycle de vie = un `EffectTrigger` (taxonomie UNIQUE, partagée avec les triggers de
 *  DONNÉES — plus de `CombatPhase` séparé). Les hooks portés ici sont le rôle MACHINERIE de l'arène
 *  sur ce vocabulaire (tick de durées, zones, mort…) ; le contenu d'entité = `TriggeredEffect` data. */

/** Contexte d'un hook : l'état (get/set) + les protagonistes du moment + un `sink(line, c?)` pour
 *  journaliser (remplace les `tickLine` locales des séquences extraites de combatFlow). */
export interface CombatHookCtx {
  get: Get;
  set: SetFn;
  battle: BattleState;
  /** Combattant concerné (acteur du tour, défenseur d'une attaque, lanceur d'un sort…) selon la phase. */
  self?: Combatant;
  target?: Combatant;
  weapon?: Weapon;
  res?: AttackResult;
  /** Journalise une ligne (option : attribuée à un combattant). */
  sink: (line: string, c?: Combatant) => void;
}

/** Un hook = une conséquence NOMMÉE d'une phase. `order` fixe sa position dans la séquence (les
 *  dépendances d'ordre RAW — ex. Frénésie avant psychologie, Destin avant décomptes — sont encodées
 *  par `order`). `enabledIf` = id d'une règle optionnelle (`policy`) ; absent = toujours actif. */
export interface CombatHook {
  id: string;
  phase: EffectTrigger;
  order?: number;
  enabledIf?: string;
  run(ctx: CombatHookCtx): void;
}

const HOOKS: Partial<Record<EffectTrigger, CombatHook[]>> = {};

/** Enregistre (ou REMPLACE par `id`) un hook et garde la phase triée par `order` croissant. Idempotent
 *  par id (sûr face au double-import / HMR), contrairement au `push` brut de cascadeAppliers. */
export function registerCombatHook(h: CombatHook): void {
  const arr = (HOOKS[h.phase] ??= []);
  const i = arr.findIndex((x) => x.id === h.id);
  if (i >= 0) arr[i] = h;
  else arr.push(h);
  arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Joue les hooks d'un événement, dans l'ordre `order`, en sautant ceux dont la règle optionnelle
 *  `enabledIf` est inactive. SOURCE UNIQUE du dispatch machinerie — appelé par `emitCombatEvent`. */
export function runCombatHooks(phase: EffectTrigger, ctx: CombatHookCtx): void {
  const arr = HOOKS[phase];
  if (!arr) return;
  for (const h of arr) if (!h.enabledIf || rule(h.enabledIf)) h.run(ctx);
}

/** Hooks enregistrés d'un événement (diagnostic + garde-fou de test « chaque événement a ses hooks »). */
export function combatHooksOf(phase: EffectTrigger): readonly CombatHook[] {
  return HOOKS[phase] ?? [];
}
