/**
 * Bus d'événements de combat — SOURCE UNIQUE de dispatch. À chaque moment canonique du cycle de
 * vie/combat, `emitCombatEvent(event, ctx)` :
 *   (a) joue les abonnés MACHINERIE (registre `combatHooks`, ordonnés par `order`) — règles de l'arène
 *       qui ne nomment AUCUNE entité (tick de durées, zones, mort…) ; PUIS
 *   (b) diffuse l'événement aux TRIGGERS DE DONNÉES des entités de `audience` (`fireTriggers` →
 *       `TraitData`/`QualityData`/`Talent`/`État` `.effects`).
 * Les deux journalisent via le même `sink`. Module FEUILLE : n'importe RIEN de combatFlow (ré-exporté
 * par le baril) → pas de cycle. Voir docs/combat-events-coherence.md.
 *
 * `audience` = les entités qui REÇOIVENT l'événement comme trigger de données. Défaut : `self` seul (ou
 * aucune si absent). Lifecycle « pour tout le monde » (début/fin de combat, début/fin de Round) : passer
 * la liste des combattants concernés. Réaction ciblée (à la touche, sur la victime…) : `audience: [x]`.
 */
import { runCombatHooks, type CombatHookCtx } from './combatHooks';
import { fireTriggers, type TriggerCtx } from './triggeredEffects';
import type { EffectTrigger } from '../engine/flowCore';
import type { Combatant } from '../engine/types';

export interface CombatEventCtx extends CombatHookCtx {
  /** Entités recevant l'événement comme trigger de DONNÉES (défaut : `self` seul, sinon aucune). */
  audience?: Combatant[];
  /** Contexte transmis aux triggers de données (victim/woundsDealt/location/attackKind/rng…). `set` est
   *  injecté depuis `ctx.set` (routage cadence-aware des Tests de trigger). */
  triggerCtx?: Omit<TriggerCtx, 'set'>;
}

export function emitCombatEvent(event: EffectTrigger, ctx: CombatEventCtx): void {
  // (a) Machinerie : hooks moteur ordonnés.
  runCombatHooks(event, ctx);
  // (b) Données : triggers d'entités.
  const audience = ctx.audience ?? (ctx.self ? [ctx.self] : []);
  for (const actor of audience) {
    for (const line of fireTriggers(ctx.get, actor, event, { ...ctx.triggerCtx, set: ctx.set })) {
      ctx.sink(line, actor);
    }
  }
}
