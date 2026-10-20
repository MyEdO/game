/**
 * Hooks d'HORLOGE (`onDayStart`, `onWake`) — module BUS-OWNED, jumeau hors-combat de
 * `combat/roundHooks.ts` / `combat/turnHooks.ts` : sa boucle `fireTriggers` par PORTEUR EST la
 * machinerie du bus pour les événements de cycle CALENDAIRE, comme celles du Round et du tour le
 * sont pour le cycle de combat. Aucun dispatch par KIND : le porteur peut être un Trait, un Talent,
 * un État, un symptôme, une Mutation — `effectSourcesOf` (source unique) les réunit déjà.
 *
 * Périmètre : le GROUPE (`state.party`), seuls porteurs d'une continuité entre deux journées ; les
 * combattants d'une bataille sont des copies de spawn, sans horloge propre.
 *
 * Cadence : appelé par `runDailyUpkeep` (source unique anti-double-comptage des franchissements de
 * jour) — jamais depuis un flux, jamais deux fois pour la même journée.
 */
import { fireTriggers, effectSourcesOf } from './triggeredEffects';
import type { EffectTrigger } from '../engine/flowCore';
import type { RNG } from '../engine/dice';
import type { Get, Set as SetFn } from './flowTypes';

/** Déclencheurs portés par l'HORLOGE de campagne (≠ cycle de combat). */
export type ClockTrigger = Extract<EffectTrigger, 'onDayStart' | 'onWake'>;

/**
 * Déclenche `trigger` sur chaque héros VIVANT du groupe, dans l'ordre du groupe (ordre FIGÉ →
 * déroulé RNG déterministe). EARLY-OUT par porteur quand aucune de ses sources ne porte ce
 * déclencheur (coût nul pour la quasi-totalité des héros — patron `fireOwnTestFailed`).
 * Renvoie les lignes produites, que l'appelant range dans le bilan du jour.
 */
export function fireClockTriggers(get: Get, trigger: ClockTrigger, ctx: { rng?: RNG; set?: SetFn } = {}): string[] {
  const lines: string[] = [];
  for (const h of get().party) {
    if (h.dead) continue;
    if (!effectSourcesOf(h).some((s) => s.effects.some((e) => e.trigger === trigger))) continue;
    lines.push(...fireTriggers(get, h, trigger, ctx));
  }
  return lines;
}
