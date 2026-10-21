/**
 * Builders du Flow de SCÈNE (`data/schemas/defs-scenes/effets.ts` : `Flow`), fixés sur l'union `Effect`
 * — versions spécialisées des builders génériques `<E>` de `engine/flowCore`.
 */
import type { Effect, Flow } from '../../data/schemas/defs-scenes/effets';
import { flowFromEffects as coreFlowFromEffects, testFlow as coreTestFlow, type FlowTest } from '../../engine/flowCore';

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
