/**
 * ISSUE D'UNE ACTIVITÉ — source UNIQUE de ce qu'une Activité tenue applique à son acteur, à terre (postes
 * d'Étape, EDOC 8) comme en mer (chemin générique, MDG 15 l.266-300). Elle applique ce que la DONNÉE
 * déclare (`ActivityDef.onSuccess`, `failExtenue`, `stageOutcome`) et rien d'autre : une Activité en mer
 * qui ne déclare pas `failExtenue` n'épuise personne, sans branche de contexte.
 */
import { applyTravelActivityResult, type ActivityDef, type TravelActivityResult, type TravelActivitySpec } from '../engine/activities';
import { applyOps, type GameOp, type OpsCtx } from '../engine/ops';
import type { EchecSansJet } from '../engine/tests';
import type { Combatant } from '../engine/types';
import { t } from '../i18n';
import { battleRng } from './battleRng';
import type { Get } from './flowTypes';
import { freeCons, type Consequence } from './rollSeam';
import { idNeuf } from './plateforme';

/** Applique à `hero` l'issue de l'Activité `def` dont la spec et le jet (déjà résolu, sans jet, ou `null`
 *  pour une Activité sans Test) sont donnés. Rend l'issue PURE (`TravelActivityResult`, que l'agrégation
 *  d'Étape relit) et ses `Consequence[]` STRUCTURÉES (#295) :
 *   - Activité sans Test → `out.activityDone` ; spec FERMÉE sans Test → son refus nommé (#2588) ;
 *   - `onSuccess` → ops appliqués par `applyOps` ;
 *   - `failExtenue` → op `condition` Exténué, ligne dérivée par `opConsequenceLine` (EDOC 8 l.133) ;
 *   - issues individuelles (`countsAsRest`/`rerollToken`/`gatherInfo`) → notes narratives. */
export function appliquerIssueActivite(
  get: Get,
  hero: Combatant,
  def: ActivityDef,
  spec: TravelActivitySpec,
  roll: { roll: number; target: number; sl: number; success: boolean } | EchecSansJet | null,
): { result: TravelActivityResult; consequences: Consequence[] } {
  const r = applyTravelActivityResult({ ...spec, actorId: hero.id }, def, roll);
  const opsCtx: OpsCtx = { idNeuf, label: def.label, rng: battleRng(), now: get().gameTime, source: { kind: 'activity', id: def.id } };
  const cons: Consequence[] = [];
  if (roll == null && spec.refus != null) cons.push(...freeCons([spec.refus]));
  else if (roll == null) cons.push({ say: 'out.activityDone', vars: { name: hero.label, activity: def.label } });
  if (r.ops.length) cons.push(...freeCons(applyOps(hero, r.ops, opsCtx)));
  if (r.extenue) {
    const extenue: GameOp = { op: 'condition', id: 'extenue', value: 1 };
    applyOps(hero, [extenue], opsCtx);
    cons.push({ ops: [extenue] });
  }
  if (r.success && r.stageOutcome === 'countsAsRest') cons.push(...freeCons([t('tp.countsAsRest', { name: hero.label })]));
  else if (r.success && r.stageOutcome === 'rerollToken') cons.push(...freeCons([t('tp.practice', { name: hero.label })]));
  else if (r.success && r.stageOutcome === 'gatherInfo') cons.push(...freeCons([t('tp.gatherInfo', { name: hero.label })]));
  return { result: r, consequences: cons };
}
