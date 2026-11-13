/**
 * Base commune des actions JOUEUR qui valent EN COMBAT comme HORS COMBAT (soin, incantation,
 * Focalisation… et les futures actions hors combat). Le seul écart entre les deux contextes est
 * « dans quel ensemble vit l'acteur » : la file de combat (`battle.combatants`) ou le groupe (`party`).
 * On l'INFÈRE de `battle != null` plutôt que de stocker un drapeau par modale — une modale `pending*`
 * gèle toute autre action, donc le contexte ne peut pas changer pendant un flux (pas de combat qui
 * démarre/finit modale ouverte). Un seul point de vérité → moins de divergence entre actions.
 *
 * Patron d'une nouvelle action combat-ou-hors-combat :
 *   - ouverture : garder `if (battle) …` seulement si l'action est hors-combat-only ;
 *   - acteurs (lanceur/cible) : `actorIn(get(), id)` ;
 *   - re-rendu après mutation EN PLACE (Chance/Résilience) : `…touchActors(get())` dans le `set` ;
 *   - sortie : en combat → `battle.log` (+ conso de l'Action, `checkBattleOver`) ; hors combat → `journal`.
 *
 * Module-level : NON scanné par le garde-fou (qui n'inspecte que les actions du store).
 */
import type { Combatant } from '../engine/types';
import type { ModLine } from '../engine/combat';
import { windsModLine } from '../engine/windsOfMagic';
import type { Jeu } from './etat';
import type { Get, PatchDeFlux } from './flowTypes';
import { currentTargetingMode, type OptionsDuClic } from './targetingModes';
import { hoverTargeting } from './targeting';
import { isOutOfAction } from '../engine/conditions';
import type { SeaWind } from '../engine/domainAttributes';
import { inBattleId } from './monde/combatants';
import { combatantAtTile } from './monde/combatGeometry';
import { pointDeCase, type Pt } from './monde/path';
import { champAttendSaFenetre } from './targetingHolder';

/** SEULE couture de re-rendu après mutation EN PLACE d'un acteur : notifie l'ensemble que lit le jeu
 *  (`actorIn`) — la file de combat (`battle.combatants`) en combat, sinon le groupe et l'assaillant de la série
 *  d'attaques subies (`serieSubie`). */
export function touchActors(state: Jeu): PatchDeFlux {
  if (state.battle) return { battle: { ...state.battle, combatants: [...state.battle.combatants] } };
  return { party: [...state.party], ...(state.serieSubie ? { serieSubie: { ...state.serieSubie } } : {}) };
}

/**
 * Contexte « Magie des mers » (MDG 02 l.178-186, `DomainData.seaModifier`) pour `resolveFocus`/
 * `resolveCasting` : en mer = en VOYAGE maritime (`travelPlan.mode === 'mer'`) OU en COMBAT
 * d'abordage sur le NAVIRE DE CAMPAGNE (sa coque, `vessel.vehicleId`, est un combattant du combat
 * en cours — même détection que la persistance de coque en fin de combat, `combatFlow.ts`
 * `finishBattle`). `wind` = la météo du jour du voyage maritime (`travelPlan.sea.weather.vent`,
 * seule source de vent connue de l'état) ; `undefined` hors voyage maritime actif (silence RAW —
 * `domainSeaIncantationDR` neutralise déjà un vent inconnu).
 */
export function seaMagicContext(state: Jeu): { atSea: boolean; wind: SeaWind | undefined } {
  const vessel = state.vessel;
  const boarding = !!vessel && !!state.battle?.combatants.some((c) => c.creatureId === vessel.vehicleId);
  const atSea = state.travelPlan?.mode === 'mer' || boarding;
  return { atSea, wind: atSea ? state.travelPlan?.sea?.weather.vent : undefined };
}

/** Modificateur COURANT des Vents Tourbillonnants (LDB 46 l.179-190, option `vents-tourbillonnants`)
 *  — SOURCE UNIQUE lue par `resolveCasting`/`resolveFocus` (`extraMod`) ET l'aperçu pré-jet des
 *  modales (Cast/Focus). 0 hors combat ou option inactive (`battle.windsOfMagic` absent). */
export function windsMagicModOf(battle: Jeu['battle']): number {
  return battle?.windsOfMagic?.mod ?? 0;
}

/** La ligne des Vents COURANTS qu'annonce un jet d'Incantation ou de Focalisation : avant le dé, seulement révélés
 *  (Seconde vue) ; une fois le dé tombé, toujours. `null` sans Vents actifs. LDB 46 l.179-190 */
export function ventsAnnonces(battle: Jeu['battle'], jete: boolean): ModLine | null {
  const vents = battle?.windsOfMagic;
  return vents && (jete || vents.revealed) ? windsModLine(vents) : null;
}

/**
 * Cliquer un combattant — son TOKEN sur la carte OU son PORTRAIT dans la frise/dock — déclenche-t-il
 * une ACTION de combat ? L'inspection n'emprunte jamais ce geste : elle est le geste SECONDAIRE
 * (clic droit, appui long, touche Menu, touche `inspecter`). DÉRIVÉ du MODE de ciblage courant
 * (`targetingModes`) : « le mode courant cible des combattants ET `t` ∈ ses cibles » — un mode-CASE pur
 * (téléportation) ne cible aucun combattant ; un mode à liste (soin/Surincantation/Frappe Mortelle/2ᵉ
 * frappe) consulte ses `candidates` ; un mode à réticule (attaque/cast/bordée) consulte l'affordance
 * (≠ 'none') ; une pose de zone (commit sans affordance) agit sur la case de tout combattant cliqué.
 * Condition UNIQUE du clic d'un combattant, jouée par `jouerLeClicDuCombattant`. L'autorisation COOP
 * (`controlsActive`) reste gardée par l'APPELANT.
 */
export function combatantClickActs(get: Get, combatant: Pick<Combatant, 'id'>): boolean {
  const battle = get().battle;
  if (!battle || battle.over) return false;
  // Tir rapide ARMÉ (pause de début de Round, LDB 10) : cliquer un adversaire DÉCLENCHE l'interruption — même
  // prédicat partagé carte ⇄ frise, donc les DEUX surfaces l'honorent (sinon la carte serait inerte hors tour).
  // Le store (`declencherLeTirPreventif`) valide portée/Ligne de Vue/état ; ici on n'ouvre l'affordance que sur un adversaire.
  const aiming = get().preemptAiming;
  if (aiming) {
    const shooter = inBattleId(battle, aiming);
    const target = inBattleId(battle, combatant.id);
    return !!shooter && !!target && target.kind !== shooter.kind && !isOutOfAction(target);
  }
  if (champAttendSaFenetre(get())) return false;
  const active = inBattleId(battle, battle.order[battle.turn]);
  if (!active) return false;
  const mode = currentTargetingMode(get);
  if (!mode.commitCombatant) return false; // mode-CASE pur (téléportation) : aucun combattant à cibler
  const target = inBattleId(battle, combatant.id);
  if (!target) return false;
  // La porte ne filtre que le HORS-SUJET (`none`) : une cible que le mode déclare `invalid` PASSE, pour
  // que son commit prononce le refus (`refuserGeste`) au point du geste — sans quoi le clic serait muet
  // là où le survol ne montre déjà plus rien. Un refus ne consomme RIEN (contrat de `refusVisible`),
  // le laisser passer est gratuit. Les `candidates` d'un mode servent au CURSEUR (Tab), jamais à fermer
  // le clic : un mode sans affordance (pose de zone) retombe sur eux, sinon sur tout combattant cliqué.
  if (mode.affordance) return hoverTargeting(get, active, target).kind !== 'none';
  return mode.candidates ? mode.candidates(get, active).some((c) => c.id === combatant.id) : true;
}

/** Le clic du champ sur le combattant `id` : `cliquerLaCase` sur sa case, le combattant désigné, et `true` ; rien sans
 *  case au combat, `false`. Le verbe se lit dans l'état AU MOMENT du clic (chez l'invité coop, il porte l'enrobage
 *  d'intention, `reseau.ts`). */
export function cliquerSurLeCombattant(get: Get, id: string, opts?: OptionsDuClic): boolean {
  const pos = inBattleId(get().battle, id)?.pos;
  if (!pos) return false;
  get().cliquerLaCase({ ...pos }, id, opts);
  return true;
}

/**
 * LE clic d'un combattant — jeton, portrait de frise, structure frappée, occupant d'une case : s'il passe
 * `combatantClickActs`, le joue (`cliquerSurLeCombattant`) et rend `true` ; sinon rien, `false`. L'autorisation COOP
 * (`controlsActive`) reste gardée par l'APPELANT.
 */
export function jouerLeClicDuCombattant(get: Get, id: string, confirm: boolean): boolean {
  return combatantClickActs(get, { id }) && cliquerSurLeCombattant(get, id, { confirm });
}

/** Ce qu'un clic de case désigne en combat : un combattant (son id), une case libre. */
type IntentionDuClicDeCase = { kind: 'combattant'; id: string } | { kind: 'case'; pt: Pt };

/**
 * Ce que joue un clic sur une CASE de combat : l'occupant d'une tuile de son empreinte, à l'étage `z`, se
 * joue s'il passe `combatantClickActs` ; un occupant qui ne la passe pas ne joue rien (jamais de clic-case
 * sous un combattant) ; une case libre se joue en déplacement. `null` hors combat.
 */
export function intentionDuClicDeCase(get: Get, tuile: Pt): IntentionDuClicDeCase | null {
  const battle = get().battle;
  if (!battle || battle.over) return null;
  const { x, y } = tuile;
  const z = tuile.z ?? 0;
  const occupant = combatantAtTile(battle.combatants, x, y, z);
  if (occupant) return combatantClickActs(get, occupant) ? { kind: 'combattant', id: occupant.id } : null;
  return { kind: 'case', pt: pointDeCase(x, y, z) };
}

/**
 * LE clic d'une CASE de combat, source unique du clic-sol (`useStagePointer.performClick`) et du commit du
 * curseur clavier/manette (`commitCursor`) : l'occupant se joue par `jouerLeClicDuCombattant`, une case libre
 * par `cliquerLaCase` sans entité, lu dans l'état AU MOMENT du clic. `false` si la case ne joue
 * rien (`intentionDuClicDeCase` nulle) : le refus éventuel appartient à l'appelant.
 */
export function jouerLeClicDeCase(get: Get, tuile: Pt, confirm: boolean): boolean {
  const intention = intentionDuClicDeCase(get, tuile);
  if (!intention) return false;
  if (intention.kind === 'combattant') return jouerLeClicDuCombattant(get, intention.id, confirm);
  get().cliquerLaCase(intention.pt, undefined, { confirm });
  return true;
}
