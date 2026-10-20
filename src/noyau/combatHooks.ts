/**
 * HOOKS DE CYCLE DE VIE de combat — couture d'extension calquée sur les appliers de cascade. MODULE
 * FEUILLE : n'importe RIEN de combatFlow → pas de cycle. La machinerie (règles optionnelles, traits,
 * sorts…) se DÉCLARE dans les tables du jeu (`TablesDuJeu.crochetsDeCombat`, modules `combat/roundHooks`
 * et `combat/turnHooks`) au lieu d'éditer le monolithe combatFlow ; le cœur ne connaît pas les features,
 * il DISPATCHE via `runCombatHooks`. L'activation passe par le registre de règles optionnelles
 * (`policy.rule(enabledIf)`).
 *
 * RÈGLE D'OR (la résolution de combat N'EST PAS atomique : `applyAttackResult` peut poser `pendingFateSave`
 * et SUSPENDRE) : un hook qui doit suspendre (modale/choix) POUSSE une étape de cascade (`pushCombatStep`,
 * comme deviation/triggeredChoice le font déjà) — il ne RETOURNE JAMAIS de valeur. Le bus `EVT.BATTLE_OVER`
 * (bus.ts, fire-and-forget) est réservé aux FX/audio : c'est un faux-ami pour un hook mutateur, à NE PAS
 * utiliser ici. Contrat de pureté/sérialisabilité IDENTIQUE à CascadeApplier : l'argument est l'état
 * (get/set), jamais une closure capturée dans un pending (snapshoté/transmis en coop).
 */
import type { Get, Set as SetFn } from './flowTypes';
import type { BattleState } from './etat';
import type { Combatant, Weapon } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import { rule } from '../engine/policy';
import type { EffectTrigger } from '../engine/flowCore';
import { tablesPosees } from './tablesPosees';

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

/** Les hooks posés, par phase, triés par `order` croissant (tri STABLE : à `order` égal, l'ordre de
 *  déclaration). Indexés une fois par table posée. */
const parPhase = new WeakMap<readonly CombatHook[], Map<EffectTrigger, readonly CombatHook[]>>();
function hooksPosesDe(phase: EffectTrigger): readonly CombatHook[] {
  const crochets = tablesPosees().crochetsDeCombat;
  let index = parPhase.get(crochets);
  if (!index) {
    const tries = new Map<EffectTrigger, CombatHook[]>();
    for (const h of [...crochets].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
      const arr = tries.get(h.phase) ?? [];
      arr.push(h);
      tries.set(h.phase, arr);
    }
    index = tries;
    parPhase.set(crochets, index);
  }
  return index.get(phase) ?? [];
}

/** Joue les hooks d'un événement, dans l'ordre `order`, en sautant ceux dont la règle optionnelle
 *  `enabledIf` est inactive. SOURCE UNIQUE du dispatch machinerie — appelé par `emitCombatEvent`. */
export function runCombatHooks(phase: EffectTrigger, ctx: CombatHookCtx): void {
  for (const h of hooksPosesDe(phase)) if (!h.enabledIf || rule(h.enabledIf)) h.run(ctx);
}

/** Hooks posés d'un événement (diagnostic + garde-fou de test « chaque événement a ses hooks »). */
export function combatHooksOf(phase: EffectTrigger): readonly CombatHook[] {
  return hooksPosesDe(phase);
}
