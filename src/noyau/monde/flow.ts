/**
 * FLOW (modèle du monde du noyau) — fine instanciation du NOYAU PUR `engine/flowCore`. Le modèle (Flow/Condition/
 * FlowTest/TriggeredEffect), l'évaluation des Conditions et tous les helpers PURS vivent désormais en
 * `engine/` (cf. #8 : le moteur ne doit JAMAIS importer `state` — règle 3). Ici on ne fait qu'INSTANCIER
 * la FEUILLE générique `Flow<E>` / `TriggeredEffect<E>` avec l'union `Effect` complète (transition,
 * startCombat, startDialogue… — irréductiblement du monde) : c'est le Flow de SCÈNE/campagne.
 *
 * Condition/FlowTest/EffectOp/evalCondition/conditionCtx/les walkers s'importent de `engine/flowCore` ;
 * ce module ne déclare que les deux alias qui spécialisent `Flow`/`TriggeredEffect` sur `Effect` et
 * les deux builders fixés sur `Effect`.
 */
import type { Effect } from './scene';
import { flowFromEffects as coreFlowFromEffects, testFlow as coreTestFlow, type FlowTest } from '../../engine/flowCore';


/** Flow de SCÈNE/campagne : la feuille `do` porte l'union `Effect` COMPLÈTE (transition/startCombat/
 *  startDialogue/journal… — state). Spécialise le `Flow<E>` générique du noyau engine. */
export type Flow = import('../../engine/flowCore').Flow<Effect>;

/** Effet DÉCLENCHÉ de scène : son `flow` peut porter tout `Effect` (≠ `EffectOp` engine-pur, défaut du
 *  noyau). Spécialise le `TriggeredEffect<E>` générique du noyau engine. */
export type TriggeredEffect = import('../../engine/flowCore').TriggeredEffect<Effect>;

/** Builder FIXÉ sur `Effect` (≠ version générique `<E>` de `engine/flowCore`). Côté state,
 *  les littéraux d'effets de SCÈNE (giveXp/journal/startDialogue…) sont vérifiés CONTEXTUELLEMENT contre
 *  l'union `Effect` (et non élargis en `{type:string;…}`), et le Flow produit est un `Flow<Effect>` —
 *  pas d'inférence de feuille trop étroite/élargie depuis les littéraux. */
export function flowFromEffects(effects: Effect[] | undefined): Flow {
  return coreFlowFromEffects(effects);
}

/** Builder FIXÉ sur `Effect` : les deux branches sont des `Flow<Effect>` (pas d'unification d'une feuille
 *  étroite inférée depuis l'UNE des branches) — un `success` (ex. EMPTY_FLOW / ops) et un `fail` (ex.
 *  journal/startDialogue) coexistent sans conflit de variance. */
export function testFlow(test: FlowTest, success: Flow, fail: Flow): Flow {
  return coreTestFlow(test, success, fail);
}
