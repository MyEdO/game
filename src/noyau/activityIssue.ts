/**
 * ISSUE D'UNE ACTIVITÉ — source UNIQUE de ce qu'une Activité tenue applique à son acteur, à terre (postes
 * d'Étape, EDOC 8) comme en mer (chemin générique, MDG 15 l.266-300). Elle applique ce que la DONNÉE
 * déclare (`ActivityDef.onSuccess`, `failExtenue`, `stageOutcome`) et rien d'autre : une Activité en mer
 * qui ne déclare pas `failExtenue` n'épuise personne, sans branche de contexte.
 */
import { applyTravelActivityResult, type ActivityDef, type TravelActivityResult, type TravelActivitySpec } from '../engine/activities';
import { applyOps, type GameOp, type OpsCtx } from '../engine/ops';
import { absorberDans, type Applique } from '../engine/faits';
import { ligneDeTexte } from '../engine/journal';
import { tonnerLApplication } from './recapLine';
import type { EchecSansJet } from '../engine/tests';
import type { Combatant } from '../engine/types';
import { t } from '../i18n';
import { battleRng } from './battleRng';
import type { Get } from './flowTypes';
import { nomDe } from '../engine/nom';

/** Applique à `hero` l'issue de l'Activité `def` dont la spec et le jet (déjà résolu, sans jet, ou `null`
 *  pour une Activité sans Test) sont donnés. Rend l'issue PURE (`TravelActivityResult`, que l'agrégation
 *  d'Étape relit) et ce qu'elle a appliqué (`Applique`, #295, #4574) :
 *   - Activité sans Test → `out.activityDone` ; spec FERMÉE sans Test → son refus nommé (#2588) ;
 *   - `onSuccess` → ops appliqués par `applyOps` ;
 *   - `failExtenue` → op `condition` Exténué, ses faits appliqués (EDOC 8 l.133) ;
 *   - `reverseToken` → jeton d'inversion de la Compétence pratiquée (EDOC 8 l.172 ; décision de règle
 *     2026-11-03, #3059) ;
 *   - issues individuelles (`countsAsRest`/`gatherInfo`) → notes narratives. */
export function appliquerIssueActivite(
  get: Get,
  hero: Combatant,
  def: ActivityDef,
  spec: TravelActivitySpec,
  roll: { roll: number; target: number; sl: number; success: boolean } | EchecSansJet | null,
): { result: TravelActivityResult; applique: Applique } {
  const r = applyTravelActivityResult({ ...spec, actorId: hero.id }, def, roll);
  const opsCtx: OpsCtx = { idNeuf: get().forgerUnId, label: def.label, rng: battleRng(), now: get().gameTime, source: { kind: 'activite', id: def.id } };
  const applique: Applique = { lignes: [], faits: [] };
  if (roll == null && spec.refus != null) applique.lignes.push(ligneDeTexte(spec.refus));
  else if (roll == null) applique.lignes.push(ligneDeTexte(t('out.activityDone', { name: nomDe(hero), activity: def.label })));
  const jetonDePratique: GameOp[] = r.success && r.stageOutcome === 'reverseToken' && spec.target != null && spec.test.skill
    ? [{ op: 'grantReverseToken', skill: spec.test.skill }]
    : [];
  const ops = [...r.ops, ...jetonDePratique];
  if (ops.length) applique.lignes.push(...applyOps(hero, ops, opsCtx).lignes);
  if (r.extenue) {
    const extenue: GameOp = { op: 'condition', id: { id: 'extenue' }, value: 1 };
    absorberDans(applique, tonnerLApplication(applyOps(hero, [extenue], opsCtx)));
  }
  if (r.success && r.stageOutcome === 'countsAsRest') applique.lignes.push(ligneDeTexte(t('tp.countsAsRest', { name: nomDe(hero) })));
  else if (r.success && r.stageOutcome === 'gatherInfo') applique.lignes.push(ligneDeTexte(t('tp.gatherInfo', { name: nomDe(hero) })));
  return { result: r, applique };
}
