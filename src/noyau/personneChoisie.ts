/**
 * LA PERSONNE CHOISIE d'un Trait psy accordé `envers: 'personneChoisie'` (VDM 10 l.326-327) : qui peut l'être,
 * qui la désigne quand le décideur n'est pas surfacé, et le Flow qui pose le Trait une fois la personne
 * connue. Le walker d'acteur (`combat/triggeredTest.runCombatFlow`) l'appelle avant `applyOps`, en combat
 * comme hors combat. #1463 #3045
 */
import type { Combatant } from '../engine/types';
import { nomDe } from '../engine/nom';
import { isInanimate } from '../engine/structures';
import type { PlayerText } from '../i18n/playerText';
import { t } from '../i18n';
import { EMPTY_FLOW, type EffectOp } from '../engine/flowCore';
import type { GameOp } from '../engine/ops';
import { campOf, relationBetween, type Camp } from '../engine/relations';
import { chebyshev, type GridPt } from '../engine/grid';
import { isOutOfAction } from '../engine/conditions';
import { ciblePsy, refDeCible } from '../engine/psych/ciblage';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import { objetDuNarratif, presetDuNarratif } from './monde/resolveursDuNarratif';
import { sceneNpc } from './monde/sceneNpc';
import { inBattleId } from './monde/combatants';
import type { EtatDeJeu } from './etat';
import type { SceneEntity } from './monde/scene';
import { combattantEnVue, entiteConnue, nomDejaVu, nomObserve, personneDejaVue, type EntreesDeLaConnaissance } from './visionDuGroupe';

/** Une personne désignable : son id de combattant (`Combatant.id`, celui d'une entité de scène hors combat),
 *  son nom, son camp et sa case. */
export interface Personne {
  readonly id: string;
  readonly label: PlayerText;
  readonly camp: Camp;
  readonly pos?: GridPt;
}

const personneDe = (c: Combatant, label: PlayerText, pos?: GridPt): Personne =>
  ({ id: c.id, label, camp: campOf(c), ...(pos ? { pos } : {}) });

type EtatDesPersonnes = EntreesDeLaConnaissance & Pick<EtatDeJeu, 'battle' | 'party' | 'campaignNarratif' | 'personnesVues'>;
type Perception = (c: Combatant, enVue: boolean) => Personne | undefined;

function personnesRetenues(s: EtatDesPersonnes, cible: Combatant, percevoir: Perception, retenirEntite: (e: SceneEntity, enVue: boolean) => boolean): Personne[] {
  const retenues: Personne[] = [];
  const retenir = (c: Combatant, enVue: boolean) => {
    if (c.id === cible.id) return;
    const p = percevoir(c, enVue);
    if (p) retenues.push(p);
  };
  if (s.battle && inBattleId(s.battle, cible.id)) {
    for (const c of s.battle.combatants) if (!isOutOfAction(c)) retenir(c, combattantEnVue(s, c));
    return retenues;
  }
  for (const c of s.party) if (!c.dead) retenir(c, true);
  const presetDe = presetDuNarratif(s.campaignNarratif);
  const resolveTrapping = objetDuNarratif(s.campaignNarratif);
  for (const e of s.scene?.entities ?? []) {
    if (e.kind !== 'personnage') continue;
    const enVue = entiteConnue(s, e);
    if (!retenirEntite(e, enVue)) continue;
    const c = sceneNpc(s.scene, e.id, presetDe, resolveTrapping);
    if (c) retenir(c, enVue);
  }
  return retenues;
}

/** Les personnes que le décideur d'office peut désigner pour `cible` (VDM 10 l.324,327, #3045). */
export function personnesCandidates(s: EtatDesPersonnes, cible: Combatant): Personne[] {
  return personnesRetenues(s, cible, (c, enVue) => personneDe(c, enVue ? nomDe(c) : t('vision.horsDeVue'), c.pos), () => true);
}

/** Les personnes que le décideur surfacé peut désigner pour `cible` (#4017). Leur case sert au défaut quand elle est vue. */
export function personnesConnues(s: EtatDesPersonnes, cible: Combatant): Personne[] {
  return personnesRetenues(s, cible, (c, enVue) => {
    if (isInanimate(c)) return undefined;
    const nom = enVue ? nomObserve(c) : nomDejaVu(s, c.id);
    return nom === undefined ? undefined : personneDe(c, nom, enVue ? c.pos : undefined);
  }, (e, enVue) => enVue || personneDejaVue(s, e.id));
}

/** Le choix connu par défaut quand un joueur délègue sa désignation (#4017). */
export function personneConnueParDefaut(s: EtatDesPersonnes, cible: Combatant, personnes: readonly Personne[]): Personne | undefined {
  const cibleEnVue = !inBattleId(s.battle, cible.id) || combattantEnVue(s, cible);
  return (cibleEnVue ? personneDuDecideurAuto(cible, personnes) : undefined) ?? personnes[0];
}

/** Les options de Colérique et la correspondance privée des clés pour la résolution (#4017). */
export function choixDesPersonnesConnues(s: EtatDesPersonnes, cible: Combatant) {
  const personnes = personnesConnues(s, cible);
  const defaut = personneConnueParDefaut(s, cible, personnes);
  if (!defaut) return undefined;
  const options = personnes.map((p, rang) => ({ key: `personne/${rang}`, label: p.label }));
  return {
    options,
    defaultChoice: options[personnes.indexOf(defaut)].key,
    personnesEnOption: { sceneId: s.scene?.id ?? null, ids: personnes.map((p) => p.id) },
  };
}

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
