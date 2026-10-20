/**
 * Objets consommables — drogues (LDB 71), herbes et potions (LDB 72), outils (LDB 67). L'effet est un
 * **Flow** (`ItemInstance.consumable`, copié du catalogue `TrappingData.consumable`) : MÊME structure
 * authorée que les sorts/triggers — feuilles `do` d'EffectOp, branches `if`, et nœuds `test` pour les
 * Tests « au boire » (Brise-cœur « Combattu avec un Test de Résistance Complexe (-10) », Belladone…),
 * résolus CADENCE-AWARE par le runner state (`noyau/consumableFlow.runConsumable`) — jamais un jet
 * silencieux de héros. Ce module ne porte que le PUR : prédicat, durée, bake.
 */
import { Combatant, ItemInstance } from './types';
import { type Flow, type EffectOp, walkFlow } from './flowCore';
import { resolveFormula, type Formula, type GameOp } from './ops';
import { RNG, defaultRNG } from './dice';

/** Durée d'HORLOGE des effets durables d'un consommable (LDB 71/72 « Durée : … ») — UNE durée par objet
 *  (une drogue a UNE durée, pas une par op). Résolue AU BOIRE (`consumableUntilTime`), avec dés
 *  (« 2d10 minutes », « 1d10+5 heures ») ou facteur (« 1d10 × 10 minutes » via Formula `times`). */
export interface ConsumableDuration {
  minutes?: Formula;
  hours?: Formula;
  days?: Formula;
}

/** L'objet est-il un consommable utilisable ? Flow présent et NON VIDE (un `seq` sans étape = rien à
 *  boire). Sert l'icône et tout filtre « utilisable » sans Combatant sous la main. */
export function isConsumable(item: ItemInstance): boolean {
  const f = item.consumable;
  return !!f && !(f.kind === 'seq' && f.steps.length === 0);
}

/** Échéance d'horloge des effets durables du consommable : `now + durée résolue` (minutes/heures/jours,
 *  dés tirés MAINTENANT — le RAW donne UNE durée par prise). Sans `consumableDuration` → undefined
 *  (les ops durables suivent le contexte appelant — permanent pour un retrait d'État instantané). */
export function consumableUntilTime(item: ItemInstance, now: number, target: Combatant, rng: RNG = defaultRNG): number | undefined {
  const d = item.consumableDuration;
  if (!d) return undefined;
  const min = resolveFormula(d.minutes ?? 0, target, rng)
    + resolveFormula(d.hours ?? 0, target, rng) * 60
    + resolveFormula(d.days ?? 0, target, rng) * 24 * 60;
  return min > 0 ? now + min : undefined;
}

/** BAKE le Flow d'un consommable pour UN buveur : chaque feuille EffectOp est ciblée sur LUI
 *  (`on:'hero'`, `heroId`) et porte l'échéance/le libellé résolus (`untilTime`/`label`) — ainsi une
 *  branche de `test` SUSPENDUE (sérialisée dans un pending/meta) garde sa durée et sa source quel que
 *  soit l'exécuteur qui la reprend (`leafOpsCtx`). PUR — rend un NOUVEAU Flow, la donnée n'est pas mutée. */
export function bakeConsumableFlow(flow: Flow, heroId: string, untilTime: number | undefined, label: string): Flow {
  const bake = (f: Flow): Flow => {
    switch (f.kind) {
      case 'do': {
        const e: EffectOp = { ...f.effect, on: 'hero', heroId, label, ...(untilTime != null ? { untilTime } : {}) };
        return { kind: 'do', effect: e };
      }
      case 'seq': return { kind: 'seq', steps: f.steps.map(bake) };
      case 'if': return { kind: 'if', cond: f.cond, then: bake(f.then), ...(f.else ? { else: bake(f.else) } : {}) };
      case 'test': return { kind: 'test', test: f.test, success: bake(f.success), fail: bake(f.fail) };
      case 'choice': return { kind: 'choice', prompt: f.prompt, ...(f.advantageCost != null ? { advantageCost: f.advantageCost } : {}), ...(f.icon ? { icon: f.icon } : {}), yes: bake(f.yes), ...(f.no ? { no: bake(f.no) } : {}) };
    }
  };
  return bake(flow);
}

/** Toutes les `GameOp` des feuilles d'un Flow de consommable (branches comprises) — pour les tests de
 *  données et les filtres (« cet objet enduit-il une arme ? » → cherche `augmentWeapon`). */
export function consumableOps(flow: Flow | undefined): GameOp[] {
  if (!flow) return [];
  const out: GameOp[] = [];
  walkFlow(flow, (n) => { if (n.kind === 'do') out.push(...n.effect.ops); });
  return out;
}
