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
import { nomDe } from '../engine/nom';
import { inBattleId } from './monde/combatants';
import type { Jeu } from './etat';
import type { PlayerText } from '../i18n/playerText';
import type { SceneEntity } from './monde/scene';
import { combattantEnVue, entiteConnue, type EntreesDeLaConnaissance } from './visionDuGroupe';

/** Une personne désignable : son id de combattant (`Combatant.id`, celui d'une entité de scène hors combat),
 *  son nom, son camp et sa case. */
export interface Personne {
  readonly id: string;
  readonly label: PlayerText;
  readonly camp: Camp;
  readonly pos?: GridPt;
}

const personneDe = (c: Combatant): Personne => ({ id: c.id, label: nomDe(c), camp: campOf(c), ...(c.pos ? { pos: c.pos } : {}) });

/** Ce que lisent `personnesCandidates` et `personnesConnues` de l'état de la partie. */
export type EtatDesPersonnes = Pick<Jeu, 'battle' | 'party' | 'scene' | 'campaignNarratif'>;

/** Ce que le tri des personnes retient : un combattant du champ, un personnage de la scène. */
interface Retenue {
  combattant: (c: Combatant) => boolean;
  entite: (e: SceneEntity) => boolean;
}

const TOUTES: Retenue = { combattant: () => true, entite: () => true };

/** Les personnes autres que `cible` (« une autre personne », VDM 10 l.324) que `retenue` garde : en combat, les
 *  combattants en action ; hors combat, le groupe et les personnages de la scène. */
function personnesRetenues(s: EtatDesPersonnes, cible: Combatant, retenue: Retenue): Personne[] {
  if (inBattleId(s.battle, cible.id)) return s.battle!.combatants.filter((c) => c.id !== cible.id && !isOutOfAction(c) && retenue.combattant(c)).map(personneDe);
  const presetDe = presetDuNarratif(s.campaignNarratif);
  const pnj = (s.scene?.entities ?? [])
    .filter((e) => e.kind === 'personnage' && retenue.entite(e))
    .map((e) => sceneNpc(s.scene, e.id, presetDe))
    .filter((c): c is Combatant => !!c);
  return [...s.party.filter((c) => c.id !== cible.id && !c.dead), ...pnj].map(personneDe);
}

/** Les personnes que le décideur d'office (`personneDuDecideurAuto`) peut désigner pour `cible`. */
export const personnesCandidates = (s: EtatDesPersonnes, cible: Combatant): Personne[] => personnesRetenues(s, cible, TOUTES);

/** Les personnes que le groupe connaît, offertes au décideur surfacé pour `cible` : en combat, celles en vue
 *  (`combattantEnVue`) ; hors combat, le groupe et les personnages de la scène connus (`entiteConnue`). */
export const personnesConnues = (s: EtatDesPersonnes & EntreesDeLaConnaissance, cible: Combatant): Personne[] =>
  personnesRetenues(s, cible, { combattant: (c) => combattantEnVue(s, c), entite: (e) => entiteConnue(s, e) });

/** La cible et la personne sont-elles amies (VDM 10 l.327) ? Même camp (`relationBetween`). #3045 */
export function sontAmis(cible: Combatant, p: Personne): boolean {
  return relationBetween({ id: cible.id, camp: campOf(cible) }, p) === 'allie';
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
  const steps: Flow[] = autres.length ? [{ kind: 'effet', effet: { ...effet, ops: autres } }] : [];
  if (personne) {
    for (const o of effet.ops) {
      if (o.op !== 'grantPsychTrait' || o.envers !== 'personneChoisie') continue;
      const { envers: _envers, resistanceSiAmis, ...trait } = o;
      const pose: Flow = { kind: 'effet', effet: { ...effet, ops: [{ ...trait, cible: refDeCible(ciblePsy.individu(personne.id)) }] } };
      steps.push(amis && resistanceSiAmis ? { kind: 'test', test: resistanceSiAmis, reussite: EMPTY_FLOW, echec: pose } : pose);
    }
  }
  return { kind: 'sequence', etapes: steps };
}
