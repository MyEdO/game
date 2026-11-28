/**
 * Évaluation d'un `FlowTest`/`Condition` EN COMBAT — briques PURES partagées par les trois voies de
 * résolution d'un Test déclenché (étape de cascade héros `testDeclenche`, jet inline ennemi/auto
 * `resolveFlowTest`, jet inline hors-cascade `resolveInlineFlowTest`). SOURCE UNIQUE : la vue d'acteur et
 * le `ConditionCtx` de combat vivent ICI ; la décision du Test, dans `engine/decisionDuTest`.
 *
 * Module FEUILLE : n'importe RIEN de combatFlow/combatEffects (que des briques engine + le modèle `flow`)
 * → aucun cycle. Définit l'hôte pur `runPureFlowLines` (`executerFlow`) ; réutilisé par `triggeredEffects` (resolveInlineFlowTest)
 * et `combat/triggeredTest` (resolveFlowTest / simpleTriggeredTestStep).
 */
import { type Combatant } from '../../engine/types';
import { buildActorView } from '../../engine/actorView';
import { applyOps, type OpsCtx } from '../../engine/ops';
import type { EntreeDuJournal } from '../../engine/journal';
import { executerFlow, flowHasOpADe, leafOpsCtx, type ConditionCtx } from '../../engine/flowCore';
import type { Effect, Flow } from '../../data/schemas/defs-scenes/effets';


/** SOURCE UNIQUE du `ConditionCtx` de combat : vues des acteurs + l'`OpsCtx` de la touche/du Round (géométrie
 *  d'arène, sl/location/woundsDealt, verdict de Cible en vue…). `target` = le combattant visé ou qui jette
 *  (absent hors cible) ; `caster` = le porteur (`ctx.caster`). Toute clé d'`OpsCtx` lue par une Condition
 *  passe ICI, pour toutes les voies (cascade, inline, nœud `si` de `runCombatFlow`). */
export function combatConditionCtx(c: Combatant | undefined, ctx: Omit<OpsCtx, 'rng' | 'idNeuf'>): ConditionCtx {
  return {
    flags: {}, gameTime: ctx.now ?? 0, party: c ? [c] : [], sl: ctx.sl,
    location: ctx.location, woundsDealt: ctx.woundsDealt, engagedAdvantageGap: ctx.engagedAdvantageGap, engagedAdvantageLead: ctx.engagedAdvantageLead,
    attackKind: ctx.attackKind, startleCause: ctx.startleCause,
    foeInLoS: ctx.foeInLoS, hiddenFromFoes: ctx.hiddenFromFoes, engaged: ctx.engaged, nearestFoeDist: ctx.nearestFoeDist,
    alliesAuContact: ctx.alliesAuContact,
    cibleEnVue: ctx.cibleEnVue,
    target: buildActorView(c), caster: buildActorView(ctx.caster),
  };
}

/**
 * Hôte PUR (`executerFlow`) d'un Flow d'EFFET DÉCLENCHÉ (traits/talents/atouts/États/psychologie/manœuvres/Attributs de
 * Domaine — JAMAIS les sorts, qui passent par `runCastFlow`→`runCombatFlow`) : exécute `sequence`/`effet`/`si`
 * contre une CIBLE (et le lanceur/porteur pour les feuilles `on:'caster'`), accumulant son journal dans
 * des entrées RENDUES, sans `get`/`set`. Couvre la Condition `compare` lue sur `target`/`caster` +
 * `sl`/`location`/`woundsDealt`/`attackKind` du contexte d'incantation.
 *
 * GARDE-FOU anti-jet-silencieux (calque `flattenFlow:280`) : un nœud `test` LÈVE — un Test EN COMBAT est
 * interactif/cadence-aware (étape de cascade ou jet inline avec branche honorée), résolu par
 * `resolveFlowTest`/`runCombatFlow`, JAMAIS en avalant la branche succès. Ses appelants sont
 * PROUVÉS sans nœud `test` au 1ᵉʳ niveau (un trigger `test` top-level est routé en amont par `routeTriggeredTest`,
 * une branche de Test n'en contient pas) ; si un `test` enfoui apparaît un jour (Lot 4), l'erreur le rend
 * détectable au lieu de redevenir un jet silencieux. MÊME doctrine pour une op qui DEMANDE UN DÉ
 * (#1508) : sa magnitude s'ouvre à la porte (`applyLeafOps`/`ouvrirChute`), et `applyOps` la tirerait
 * ici en silence — un `fall` authoré sur un passif/trait y perdait ses deux dés. */
export function runPureFlowLines(target: Combatant, caster: Combatant | undefined, flow: Flow, ctx: OpsCtx): EntreeDuJournal[] {
  if (flowHasOpADe(flow)) throw new Error('runPureFlowLines: une op à DÉ ouvre sa magnitude à la porte — utiliser applyLeafOps/runCombatFlow.');
  const lines: EntreeDuJournal[] = [];
  return executerFlow<Effect, EntreeDuJournal[]>(flow, {
    // Condition `compare` : `target` = la cible du sous-Flow, `caster` = le lanceur/porteur.
    // `location`/`woundsDealt` : contexte de la touche courante (Assommante Tête, Venin sur PB).
    conditions: () => combatConditionCtx(target, { ...ctx, caster }),
    feuille: (f) => {
      if (f.effet.type === 'ops') {
        const unit = f.effet.on === 'caster' ? caster : target;
        // Contexte de FEUILLE (`leafOpsCtx`) : untilTime/label bakés (consommable) priment sur le ctx
        // appelant. Les ops IMPURES (`delayed`…) sont routées en amont vers runCombatFlow (flowHasImpureOp).
        if (unit) lines.push(...applyOps(unit, f.effet.ops, leafOpsCtx(ctx, f.effet)).lignes);
      }
      return undefined;
    },
    test: () => {
      throw new Error('runPureFlowLines: un nœud `test` est cadence-aware — utiliser runCombatFlow/resolveFlowTest.');
    },
    choix: () => undefined,
    fin: () => lines,
  });
}
