/**
 * Builders du Flow d'un DOCUMENT de scène (`FlowDeScene`, `data/schemas/defs-scenes/effets.ts`) : feuille
 * `Effect`, Test de scène, coût littéral — instances des builders génériques de `engine/flowCore`. Un Flow
 * produit à l'exécution, au Test d'enjeu de catalogue, se pose par `testFlow<Effect>` du cœur.
 */
import type { Effect, FlowDeScene, TestDeScene } from '../../data/schemas/defs-scenes/effets';
import { flowFromEffects as coreFlowFromEffects, testFlow as coreTestFlow } from '../../engine/flowCore';

/** Builder FIXÉ sur le document : les littéraux d'effets de SCÈNE (giveXp/journal/startDialogue…) sont
 *  vérifiés CONTEXTUELLEMENT contre l'union `Effect` (et non élargis en `{type:string;…}`). */
export function flowFromEffects(effects: Effect[] | undefined): FlowDeScene {
  return coreFlowFromEffects(effects);
}

/** Builder FIXÉ sur le document : les deux branches sont des `FlowDeScene` (pas d'unification d'une feuille
 *  étroite inférée depuis l'UNE des branches) — un `success` (ex. EMPTY_FLOW / ops) et un `fail` (ex.
 *  journal/startDialogue) coexistent sans conflit de variance. */
export function testFlow(test: TestDeScene, success: FlowDeScene, fail: FlowDeScene): FlowDeScene {
  return coreTestFlow(test, success, fail);
}
