/**
 * LA PERSONNE CHOISIE d'un Trait psy accordé `envers: 'personneChoisie'` (VDM 10 l.326-327) : qui peut l'être,
 * qui la désigne quand le décideur n'est pas surfacé, et le Flow qui pose le Trait une fois la personne
 * connue. Le walker d'acteur (`combat/triggeredTest.runCombatFlow`) l'appelle avant `applyOps`, en combat
 * comme hors combat. #1463 #3045
 */
import type { Combatant } from '../engine/types';
import { EMPTY_FLOW, type EffectOp } from '../engine/flowCore';
import type { GameOp } from '../engine/ops';
import { campOf, relationBetween, type Camp } from '../engine/relations';
import { chebyshev, type GridPt } from '../engine/grid';
import { isOutOfAction } from '../engine/conditions';
import { ciblePsy, refDeCible } from '../engine/psych/ciblage';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import { presetDuNarratif } from './monde/resolveursDuNarratif';
import { sceneNpc } from './monde/sceneNpc';
import { inBattleId } from './monde/combatants';
import type { Jeu } from './etat';

/** Une personne désignable : son id de combattant (`Combatant.id`, celui d'une entité de scène hors combat),
 *  son nom, son camp et sa case. */
export interface Personne {
  readonly id: string;
  readonly label: string;
  readonly camp: Camp;
  readonly pos?: GridPt;
}

const personneDe = (c: Combatant): Personne => ({ id: c.id, label: c.label, camp: campOf(c), ...(c.pos ? { pos: c.pos } : {}) });

/** Ce que lit `personnesCandidates` de l'état de la partie. */
export type EtatDesPersonnes = Pick<Jeu, 'battle' | 'party' | 'scene' | 'campaignNarratif'>;

/** Les personnes que le décideur peut désigner pour `cible`, autres qu'elle (« une autre personne »,
 *  VDM 10 l.324) : en combat, les combattants en action ; hors combat, le groupe et les personnages de la
 *  scène. */
export function personnesCandidates(s: EtatDesPersonnes, cible: Combatant): Personne[] {
  if (inBattleId(s.battle, cible.id)) return s.battle!.combatants.filter((c) => c.id !== cible.id && !isOutOfAction(c)).map(personneDe);
  const presetDe = presetDuNarratif(s.campaignNarratif);
  const pnj = (s.scene?.entities ?? [])
    .filter((e) => e.kind === 'personnage')
    .map((e) => sceneNpc(s.scene, e.id, presetDe))
    .filter((c): c is Combatant => !!c);
  return [...s.party.filter((c) => c.id !== cible.id && !c.dead), ...pnj].map(personneDe);
}

/** La cible et la personne sont-elles amies (VDM 10 l.327) ? Même camp (`relationBetween`). #3045 */
export function sontAmis(cible: Combatant, p: Personne): boolean {
  return relationBetween({ id: cible.id, camp: campOf(cible) }, p) === 'ally';
}

/** La personne que désigne un décideur NON surfacé (VDM 10 l.327, « nommer ou désigner ») : la plus proche
 *  de la cible dans son camp, la première à distance égale ; aucune s'il n'y en a pas. #3045 */
export function personneDuDecideurAuto(cible: Combatant, candidates: readonly Personne[]): Personne | undefined {
  const distance = (p: Personne): number => (cible.pos && p.pos ? chebyshev(cible.pos, p.pos) : Infinity);
  let retenue: Personne | undefined;
  for (const p of candidates) if (sontAmis(cible, p) && (retenue === undefined || distance(p) < distance(retenue))) retenue = p;
  return retenue;
}

/** L'op vise-t-elle la personne que choisit le décideur ? */
export function visePersonneChoisie(o: GameOp): boolean {
  return o.op === 'grantPsychTrait' && o.envers === 'personneChoisie';
}

/** Le Flow qui joue la feuille `effet` une fois la personne connue : ses autres ops, puis chaque Trait
 *  envers `personne`, derrière son Test de résistance quand la cible et la personne sont amies
 *  (`resistanceSiAmis`, VDM 10 l.327). Sans personne, ces Traits restent sans effet. */
export function fluxDEnvers(effet: EffectOp, personne: Personne | undefined, amis: boolean): Flow {
  const autres = effet.ops.filter((o) => !visePersonneChoisie(o));
  const steps: Flow[] = autres.length ? [{ kind: 'do', effect: { ...effet, ops: autres } }] : [];
  if (personne) {
    for (const o of effet.ops) {
      if (o.op !== 'grantPsychTrait' || o.envers !== 'personneChoisie') continue;
      const { envers: _envers, resistanceSiAmis, ...trait } = o;
      const pose: Flow = { kind: 'do', effect: { ...effet, ops: [{ ...trait, cible: refDeCible(ciblePsy.individu(personne.id)) }] } };
      steps.push(amis && resistanceSiAmis ? { kind: 'test', test: resistanceSiAmis, success: EMPTY_FLOW, fail: pose } : pose);
    }
  }
  return { kind: 'seq', steps };
}
