/**
 * REGISTRE DES ACTIONS — le CODE derrière `src/data/actions.json` (spec HUD « Zone 12 »).
 *
 * Trois tables, trois responsabilités, aucune logique en JSON :
 *  - `ACTION_GATES`    — les PRÉDICATS d'offre, par id. Source UNIQUE : `CombatConsole` et `turnEconomy`
 *                        les consomment (ils en tenaient chacun une dérivation manuscrite, et la
 *                        divergence a déjà coûté un bug — Détermination, commit `0e14119b`).
 *  - `ACTION_CANDIDATES` — les SÉLECTEURS impurs (listes de cibles/objets), enveloppes NOMMÉES des
 *                        fonctions existantes : aucune n'est réécrite ici.
 *  - `ENTREES_PAR_RUN` — les GESTES : le verbe du noyau qui joue chaque offre et ses arguments (#3610).
 *
 * Une offre est un geste déclaré (`Offre.geste`, `gesteDeLOffre`) : le clavier, la console, les pastilles et les hôtes
 * jouent son verbe ; le verbe de la barre juge son geste (`refusDuGeste`), dont l'offre est la projection sur ses
 * candidats (`Offre.gate`), plus
 * jamais par des closures anonymes publiées positionnellement.
 */
import type { IconId } from '../data/icons';
import type { Combatant } from '../engine/types';
import type { BattleState, Jeu } from './etat';
import type { Scene } from './monde/scene';
import type { Get, Set } from './flowTypes';
import type { FabriqueDuNoyau, JeuDuNoyau } from './machinerieDuNoyau';
import type { ActionsDuNoyau, GesteDuNoyau, VerbesDeLaBarre } from './actionsDuNoyau';
import type { AttackKind } from '../engine/creatureAttacks';
import type {
  IdDAttaque, IdDeCombattant, IdDeCompetence, IdDeCondition, IdDeManoeuvre, IdDEntiteDeScene, IdDeSort, IdDePanoplie, IdDObjet,
  IdDObjetRamassable, IdDePoste,
} from './designations';
import { refuserGesteDuSiege } from './refusVisible';
import { entityPickables } from './combatEffects';
import { objetDuNarratif } from './monde/resolveursDuNarratif';
import { currentTargetingMode } from './targetingModes';
import { isOutOfAction, refusDeDetermination, raisonVerrouEtat, refusVerrouDAction } from '../engine/conditions';
import { isEngaged } from '../engine/engagement';
import { desengagementSansAction, refusDEsquiveDeDesengagement } from './combat/desengagement';
import { isFrenzied, isFrenzyCapable } from '../engine/psychology';
import { isVehicle, estNavire } from '../engine/coque';
import { compatibleAmmo, activeLoadout, itemLabel, loadoutLabel } from '../engine/items';
import { canPushback } from '../engine/qualities/dispatch';
import { hasBattement, hasDistraire } from '../engine/combatFeatures/dispatch';
import { actorHasSkill } from '../engine/skills';
import { isConsumable } from '../engine/consumables';
import { hasFreeWeaponAttack, battementFoes, distraireFoes, availableAttacks, attaqueImmediate, type AttackOption } from './combatManeuvers';
import { selfManeuversOf, selfManeuverApplicable } from '../engine/creatureAttacks';
import { healableTargets, modesDOuverture } from '../engine/healing';
import { campAuContact } from './monde/combatGeometry';
import { hasWaterContainer, waterSprayCandidates } from '../engine/suffocation';
import { canAidTeam } from './monde/commandTeam';
import { controlsCombatant, decidingSeat, unSiegeAgit } from './netOwnership';
import { surfaceTientLaMain } from './modalArbiter';
import { dispellableSpellsOn, type DispellableSpell } from '../engine/dispel';
import { combatAdvantageSkills } from '../engine/skillCombatApps';
import { activeCombatant, placingZoneOf, STANCE_BLOCK } from './combatFlow';
import { canMove, mountablesNear } from './mount';
import { refusActionDepensee, refusCoque, refusDeCharge, refusDeCourse, refusHorsDEtatDAgir, refusMouvementEntame, refusPriereImposee, refusSansMouvement } from './refusDuTour';
import { servablePostes, crewPosteOf, shipOfCrew, rechargeDuTour } from './monde/shipPostes';
import { chanteurDuNavire, quartChante } from './shipCrew';
import { type ItemInstance, type ShipPoste, type Weapon, type WeaponLoadout } from '../engine/types';
import { pushSlot } from './siegePush';
import { ACTIONS, byId, type ManeuverDef, findConditionById, findSpellById, type ActionDef } from '../data/index';
import type { BattleActionMode, GateDAction, RunDAction, SelecteurDAction } from '../data/schemas/defs/actions';
import { garanti } from '../lib/garanti';
import { tableTotale } from '../lib/tableTotale';
import { isArcaneSpell, castBlockedBy, castInfoIsPrayer, focusSkillFor, focusWindLabel } from '../engine/magic';
import { t } from '../i18n';
import { aPorteeDe } from './monde/exploreNav';
import { postesPretsAFaireFeu } from './monde/shipBattery';
import { nomEnVue } from './visionDuGroupe';

/** Verdict d'un gate : l'indisponibilité PORTE SA RAISON (patron `GatedAction`, charte UI). */
export interface ActionGate {
  ok: boolean;
  reason?: string;
}

/** Contexte d'évaluation — PUR : l'acteur et son combat suffisent aux prédicats de règle. Les rares
 *  gates de TABLE (coop) lisent `netMode`, jamais le store entier. */
export interface ActionCtx {
  active: Combatant;
  battle: BattleState;
  scene: Scene | null;
  netMode?: string;
  /** L'ENTRÉE évaluée, posée par `actionGate` à partir de l'entrée résolue : un gate y lit ce que
   *  l'action DÉCLARE (l'État qu'elle traite) au lieu de nommer un id. */
  def?: ActionDef;
  /** PARAMÈTRES DE LA CASE (`ContexteDOffre` — la Compétence visée, l'arme, l'objet) : une entrée du
   *  registre peut être rendue N fois, une par candidat, et le verdict d'offre porte alors sur CE
   *  candidat (« au plafond de CETTE méthode d'Avantage »). Les gates de règle pure les ignorent ; le
   *  geste de l'offre se lit sur exactement les mêmes (`gesteDeLOffre`), d'où une seule et même mesure. */
  args?: ContexteDOffre;
  /** L'heure de jeu (`Jeu.gameTime`) : le quart de veille (`chanteur-disponible`) s'y lit. Chaque surface la
   *  prend à SON état. */
  gameTime: number;
}

/** Le gate qui désigne une entrée comme REMÈDE de l'État qu'elle déclare : deux lecteurs le nomment,
 *  la donnée (`actions.json`) et `remedesPertinents`. */
export const GATE_ETAT_PORTE = 'etat-porte' satisfies GateDAction;

const ok: ActionGate = { ok: true };
const no = (reason: string): ActionGate => ({ ok: false, reason });
/** Un refus élémentaire (`refusDuTour.ts`) en verdict de gate. */
const verdict = (refus: string | null): ActionGate => (refus ? no(refus) : ok);

/** L'ÉTAT qu'une entrée de remède déclare (`rule`, de type `etat`). FAIL-FAST : une entrée
 *  portée au gate `etat-porte` sans État déclaré est un bug de donnée, que la garde de registre
 *  (`action-atteignabilite.test`) refuse déjà — il ne se traduit pas en refus de jeu. */
function etatDeclare(def?: ActionDef): string {
  const id = def?.rule?.type === 'etat' ? def.rule.id : undefined;
  if (!id) throw new Error(`gate de remède : l'entrée « ${def?.id ?? '?'} » ne déclare aucun État (rule de type « etat »)`);
  return id;
}

/** L'instance de l'État que l'entrée traite, si le porteur l'a. */
const instanceDeLEtat = ({ active, def }: ActionCtx) =>
  active.conditions?.find((c) => c.id === etatDeclare(def));

/** Le porteur est-il libre de tout État qui VERROUILLE son Action et son Mouvement (`restrictsAction`,
 *  `refusVerrouDAction`) ? `LDB 16 l.52`. Ce qui sert la fuite ne le compose pas (course,
 *  mouvement, désengagement, se relever) ; tout ce qui coûte l'Action le compose par `action-libre`. */
function horsVerrouDEtat({ active }: ActionCtx): ActionGate {
  return verdict(refusVerrouDAction(active));
}

/** Le porteur PEUT-il effectuer une Action (`canTakeAction`, `LDB 16 l.125`) ? Composé par `actionLibre`,
 *  et seul par l'entrée qui n'engage pas l'Action du Tour elle-même (`attaque-trait`). */
function peutAgir({ active }: ActionCtx): ActionGate {
  return verdict(refusHorsDEtatDAgir(active));
}

/** L'Action du Tour est-elle encore disponible ET utilisable ? Dépensée, impossible (`peutAgir`),
 *  verrouillée par un État (`horsVerrouDEtat`), ou due à une Prière (`prierePourLAction`). La Frénésie est
 *  un gate à part (`action-libre-hors-frenesie`). */
function actionLibre(ctx: ActionCtx): ActionGate {
  return verdict(refusActionDepensee(ctx.battle) ?? refusHorsDEtatDAgir(ctx.active) ?? refusVerrouDAction(ctx.active) ?? prierePourLAction(ctx));
}

/** L'Action est due à une Prière (`refusPriereImposee`) : seule la case d'un sort qui EST une Prière y
 *  satisfait. LDB 40 l.74 */
function prierePourLAction({ active, args }: ActionCtx): string | null {
  const sort = args?.spellId ? findSpellById(args.spellId) : undefined;
  return sort && castInfoIsPrayer(sort) ? null : refusPriereImposee(active);
}

/** Désengagement (LDB 15 l.43-49) : ouvert si l'UNE de ses options l'est (`noyau/combat/desengagement.ts`) —
 *  l'Esquive, l'Avantage ou le départ libre. Sa pertinence (être Engagé) est le gate `engage`. */
function desengagementGate(ctx: ActionCtx): ActionGate {
  const refus = refusDEsquiveDeDesengagement(ctx);
  return !refus || desengagementSansAction(ctx) ? ok : no(refus);
}

/** Le Mouvement du Tour est-il ENCORE INTACT ? Prédicat PARTAGÉ (gestes qui exigent l'élan complet). */
function mouvementIntact({ active, battle }: ActionCtx): ActionGate {
  // Un porteur qu'un État CLOUE (`gating.movement: 'none'` — Inconscient, Surpris ; LDB 16 l.113/l.132)
  // n'a aucun Mouvement à dépenser : le geste qui en coûte se REFUSE en le disant, au lieu de laisser
  // le verbe rendre en silence. Le budget est celui de la monture s'il en a une (`mountMovement`).
  return verdict(refusSansMouvement(battle, active) ?? refusMouvementEntame(battle));
}

/** L'acteur a-t-il un CORPS de fantassin ? Une coque n'en a pas (`engine/vehicle.ts` : « ni arme
 *  tenue, ni sort, ni marche de fantassin ») : les gestes du corps — marcher, courir, se mettre sur
 *  la défensive — ne lui sont pas offerts, et le refus le DIT au lieu de dépenser son Action. Un
 *  navire agit par ses Tests d'équipage et sa barre. */
function fantassin({ active }: ActionCtx): ActionGate {
  return verdict(refusCoque(active));
}

/** ET séquentiel de gates : le PREMIER refus l'emporte, avec SA raison (aucune raison fabriquée). */
const et =
  (...gates: ((ctx: ActionCtx) => ActionGate)[]) =>
  (ctx: ActionCtx): ActionGate => {
    for (const g of gates) {
      const v = g(ctx);
      if (!v.ok) return v;
    }
    return ok;
  };

/** Les PRÉDICATS d'offre du registre, par id (`gate` de `actions.json`). */
export const ACTION_GATES: Record<GateDAction, (ctx: ActionCtx) => ActionGate> = {
  toujours: () => ok,
  'hors-verrou-d-etat': horsVerrouDEtat,
  'peut-agir': peutAgir,
  'action-libre': actionLibre,
  'action-libre-hors-frenesie': (ctx) =>
    isFrenzied(ctx.active) ? no(t('agate.frenzyOnly')) : actionLibre(ctx),
  'action-libre-hors-frenesie-fantassin': (ctx) =>
    et(fantassin, ACTION_GATES['action-libre-hors-frenesie'])(ctx),
  'mouvement-intact': mouvementIntact,
  'mouvement-restant-fantassin': (ctx) => et(fantassin, ACTION_GATES['mouvement-restant'])(ctx),
  /** MIROIR de la garde de `annulerLeDeplacement` (`combatSlice.ts:976-980`) : le segment restaurable est le
   *  SNAPSHOT, pas le compteur — `seRelever` écrit `movementUsed` sans en poser un, et le
   *  verbe n'aurait rien à défaire. Le contrôle du siège n'entre pas ici (il est au verbe
   *  et aux contextes de surface : `live` pour la console, `cur` pour la touche). */
  'deplacement-annulable': ({ battle }) => {
    if (!battle.moveSnapshot || (battle.movementUsed ?? 0) === 0) return no(t('agate.noMoveToUndo'));
    return verdict(refusActionDepensee(battle));
  },
  /** Charge — fiche `regles/charger` (`LDB 15 l.35-37`), foyer du verbatim au Codex. */
  'charge-possible': ({ active, battle }) => verdict(refusDeCharge(battle, active)),
  'mouvement-restant': ({ active, battle }) => (canMove(battle, active) ? ok : no(t('agate.noMovementLeft'))),
  desengagement: desengagementGate,
  /** Course — verdict `refusDeCourse` (`refusDuTour.ts`, LDB 15 l.41), que lisent aussi `ouvrirLaCourse` et `computeRunReach`. */
  'course-possible': ({ active, battle }) => verdict(refusDeCourse(battle, active)),
  /** Verdict `refusDeDetermination` (LDB 17 l.59-61, LDB 20 l.188), que lisent aussi `depenserLaDetermination` et `DeterminationButton`. */
  'determination-en-reserve': ({ active, args }) => verdict(refusDeDetermination(active, args?.conditionId) ?? null),
  'attaque-libre-frenesie': ({ active }) =>
    hasFreeWeaponAttack(active) ? ok : no(t('agate.noFreeWeaponAttack')),
  'pietinement-gratuit': ({ active, battle, scene }) =>
    availableAttacks(scene, active, battle).some((o) => o.freeKind === 'pietinement') ? ok : no(t('agate.noTrample')),
  'set-commutable': ({ active, battle }) =>
    (active.loadouts?.length ?? 0) < 2
      ? no(t('agate.singleLoadout'))
      : battle.loadoutSwapped
        ? no(t('agate.loadoutSwapped'))
        : ok,
  /** PERTINENCE d'un remède : le porteur a l'État que l'entrée déclare. */
  [GATE_ETAT_PORTE]: (ctx) => (instanceDeLEtat(ctx) ? ok : no(t('agate.stateNotCarried'))),
  /** REMÈDE ATTEIGNABLE : le porteur n'est pas hors d'état d'agir (`isOutOfAction`, lu aussi par
   *  `seRelever`), et l'instance de l'État n'est pas VERROUILLÉE — verrou de type (`etats.json`),
   *  d'instance, ou acte de soin attendu. Ce verrou (`raisonVerrouEtat`) est l'invariant que les deux
   *  verbes de remède partagent avec cette case. `LDB 18 l.15`. */
  'remede-atteignable': (ctx) => {
    const inst = instanceDeLEtat(ctx);
    if (!inst) return no(t('agate.stateNotCarried'));
    if (isOutOfAction(ctx.active)) return no(t('agate.unableToAct'));
    const verrou = raisonVerrouEtat(inst, ctx.active);
    return verrou ? no(verrou) : ok;
  },
  /** L'État se retire-t-il par un TEST ? Prérequis du verbe `seRemettreDeLEtat` (`EtatData.recover`),
   *  pas une propriété du remède : un remède-GESTE ne le porte pas. */
  'etat-recuperable-par-test': (ctx) =>
    findConditionById(etatDeclare(ctx.def))?.recover ? ok : no(t('agate.stateNoRecoverTest')),
  /** Cumuler l'Avantage (LDB 09 l.305-308) : chaque méthode a SON plafond (`skillAdvantageCap`), et
   *  au plafond le Test ne peut plus rien rendre. Le refus est DIT (« Avantage au plafond (N) ») et la
   *  case reste dessinée : la faire disparaître privait le joueur de la raison. La méthode visée vient
   *  des ARGS de la case — les mêmes que le verbe `gagnerLAvantage` reçoit. */
  'avantage-sous-plafond': (ctx) =>
    et(ACTION_GATES['action-libre-hors-frenesie'], ({ active, args }) => {
      const methode = combatAdvantageSkills(active).find((s) => s.skillId === args?.skillId);
      return methode && active.advantage >= methode.cap
        ? no(t('agate.advantageCapped', { n: methode.cap }))
        : ok;
    })(ctx),
  /** Postures de tir (spec §1a G5) — PRÉDICATS UNIQUES de `combatFlow`, partagés avec le store
   *  (`basculerLaPosture`), le versement dans le pending et la fenêtre de jet. Le refus est celui
   *  du prédicat : la raison appartient à `STANCE_BLOCK`, jamais au gate. */
  'tir-immobile-armable': ({ active, battle, scene }) => {
    const refus = STANCE_BLOCK.tirImmobile(scene, battle, active);
    return refus ? no(refus) : ok;
  },
  'tir-dans-le-tas-armable': ({ active, battle, scene }) => {
    const refus = STANCE_BLOCK.dansLeTas(scene, battle, active);
    return refus ? no(refus) : ok;
  },
  /** Battement (`LDB 10 l.103` · `AA 13 l.11-17` · `LDB 13 l.114`) : la case porte le prédicat du
   *  verbe (`battementFoes`, `combatManeuvers.ts`) — offerte si et seulement si `faireUnBattement`
   *  a un adversaire à traiter, sinon refusée AVEC sa raison. */
  'battement-cible-eligible': ({ active, battle, args }) =>
    battementFoes(active, battle).some((f) => !args?.targetId || f.id === args.targetId) ? ok : no(t('agate.noBattementTarget')),
  /** Distraire (`LDB 10 l.364` · `AA 13 l.46-51`) : même prédicat que le verbe (`distraireFoes`) —
   *  offerte si et seulement si `tenterDeDistraire` a un adversaire à traiter. */
  'distraire-cible-eligible': ({ active, battle, args }) =>
    distraireFoes(active, battle).some((f) => !args?.targetId || f.id === args.targetId) ? ok : no(t('agate.noDistraireTarget')),
  /** Focalisation (`LDB 46` — fiche `regles/focalisation-etendue`) : le SORT visé vient des ARGS de
   *  l'alvéole (le geste secondaire de la case d'un sort), et le verdict porte donc sur CE sort.
   *  MÊMES prédicats que le verbe `focaliserLeSort` (`isArcaneSpell`, `castBlockedBy`) et que
   *  `resolveFocus` (`focusSkillFor`) : le refus se DIT au point du geste au lieu de partir au
   *  journal. */
  'sort-focalisable': ({ active, args }) => {
    const spell = args?.spellId ? findSpellById(args.spellId) : undefined;
    if (!spell || !isArcaneSpell(spell)) return no(t('agate.spellNotFocusable'));
    // Focalisation est une Compétence AVANCÉE (`LDB 09 l.30`), spécialisée par Vent (`LDB 46`) : le
    // MÊME prédicat que l'offre de l'IA (`combatFlow.ts`) et que `resolveFocus`.
    if (!focusSkillFor(active, spell)) {
      const wind = focusWindLabel(spell);
      return no(wind
        ? t('agate.noFocusSkillWind', { name: active.label, wind })
        : t('agate.noFocusSkill', { name: active.label }));
    }
    const bloque = castBlockedBy(active, 'focalisation');
    return bloque ? no(t('agate.focusBlocked', { reason: bloque })) : ok;
  },
  coop: ({ netMode }) => (netMode && netMode !== 'local' ? ok : no(t('agate.localGame'))),
  /** ÉQUIPAGE de poussée SUFFISANT — verdict de la source unique (`pushSlot.undercrew`, seuil ADE II
   *  8 l.233). Le geste reste OFFERT et porte sa raison : un engin sous-servi se voit, il ne disparaît
   *  pas (loi du refus visible au point du geste, arbitrage 2026-08-19). */
  'equipage-suffisant': ({ active, battle }) =>
    (pushSlot(active, battle.combatants).undercrew ? no(t('agate.pushUndercrew')) : ok),
  'navire-action': ({ battle }) => (battle.acted ? no(t('agate.vesselActionSpent')) : ok),
  // ── PRÉALABLES DE VERBE : le prédicat même que lit le verbe, pour que l'offre refuse ce qu'il refuse.
  /** L'arme de la case (`args.weaponUid`), ou à défaut une arme du Tour, est à recharger par un porteur à l'Action
   *  libre (`rechargeDuTour`, lu par `rechargerLArme`). */
  'arme-a-recharger': ({ active, battle, args }) =>
    (rechargeDuTour(active, battle, args?.weaponUid) ? ok : no(t('agate.nothingToReload'))),
  /** Chant de marin (MDG 09 l.32-40) : le quart n'a pas eu sa chanson (`quartChante`) et un chanteur est libre
   *  (`chanteurDuNavire`) — les prédicats de `chanterLaChanson`. */
  'chanteur-disponible': ({ active, battle, gameTime }) => {
    if (quartChante(active, gameTime)) return no(t('agate.shantyQuartSung'));
    return chanteurDuNavire(active, battle) ? ok : no(t('agate.noShantySinger'));
  },
  /** Une pièce du navire est prête à faire feu (`postesPretsAFaireFeu`, lu par `ouvrirLaBordee` via `batteryBlock`). */
  'pieces-au-navire': ({ active }) => (postesPretsAFaireFeu(active).length > 0 ? ok : no(t('agate.noLoadedPostes'))),
  // ── PERTINENCE (#2911) : l'entrée a-t-elle lieu d'être offerte à CE porteur (`GATES_DE_PERTINENCE`) ?
  fantassin,
  /** Déjà en joue : Viser n'a pas lieu d'être offert (`LDB 14 l.61`). */
  'pas-deja-en-joue': ({ active }) => (active.aiming ? no(t('agate.alreadyAiming')) : ok),
  'set-de-melee': (ctx) => et(fantassin, ({ active }) => (setDeMelee(active) ? ok : no(t('agate.noMeleeSet'))))(ctx),
  tireur: ({ active }) => (armesADistance(active).length > 0 ? ok : no(t('agate.noRangedWeapon'))),
  'arme-de-repousse': ({ active }) =>
    (active.weapons.some((w) => w.type === 'melee' && canPushback(w)) ? ok : no(t('agate.noPushbackWeapon'))),
  engage: ({ active }) => (isEngaged(active) ? ok : no(t('agate.notEngaged'))),
  'battement-connu': ({ active }) => (hasBattement(active) ? ok : no(t('agate.noBattement'))),
  'distraire-connu': ({ active }) => (hasDistraire(active) ? ok : no(t('agate.noDistraire'))),
  'frenesie-possible': ({ active }) => (isFrenzyCapable(active) && !isFrenzied(active) ? ok : no(t('agate.noFrenzy'))),
  'equipe-a-aider': ({ active, battle }) => (canAidTeam(active, battle.combatants) ? ok : no(t('agate.noTeamToAid'))),
  monte: ({ active }) => (active.mountId ? ok : no(t('agate.notMounted'))),
  'poste-servi': ({ active }) => (active.mannedPoste ? ok : no(t('agate.noPosteManned'))),
  /** La barre : le BARREUR la tient (`shipOfCrew`), et la COQUE elle-même (`manoeuvrerLeNavire` accepte l'un ou l'autre). */
  'a-la-barre': ({ active, battle }) =>
    (estNavire(active) || shipOfCrew(battle.combatants, active.id) ? ok : no(t('agate.notAtHelm'))),
  navire: ({ active }) => (estNavire(active) ? ok : no(t('agate.notAVessel'))),
  vehicule: ({ active }) => (isVehicle(active) ? ok : no(t('agate.notAVehicle'))),
  /** La pause de début de Round (`LDB 17 l.25`) : personne n'agit encore (`turn: -1`, `enterRoundStartPause`). */
  'pause-de-round': ({ battle }) => (battle.turn < 0 ? ok : no(t('agate.notRoundStart'))),
};

/** Les gates de PERTINENCE (#2911) : une entrée dont l'un refuse n'a pas lieu d'être pour ce porteur, et
 *  `offresDeLActif` ne l'offre pas ; tout autre refus FERME l'offre en gardant sa raison. */
export const GATES_DE_PERTINENCE: ReadonlySet<GateDAction> = new Set<GateDAction>([
  'fantassin', 'set-de-melee', 'tireur', 'arme-de-repousse', 'engage', 'battement-connu', 'distraire-connu',
  'frenesie-possible', 'equipe-a-aider', 'monte', 'pas-deja-en-joue', 'poste-servi', 'a-la-barre', 'navire', 'vehicule', 'pause-de-round', GATE_ETAT_PORTE,
]);

/** L'arme à distance que prend `approvisionnerLArme` sans arme désignée : la première du porteur. */
export function armeADistanceParDefaut(active: Combatant) {
  return active.weapons.find((w) => w.type === 'distance');
}

/** Les armes à distance du porteur — population du sélecteur `armes-a-distance` et du gate `tireur`. */
function armesADistance(active: Combatant) {
  return active.weapons.filter((w) => w.type === 'distance');
}

/** Le set au poing ouvre-t-il un corps à corps ? Arme de mêlée DU set, ou set MAINS NUES (`LDB 15 l.35-37`,
 *  `LDB 13 l.90`). Sans set (statbloc de créature), l'arsenal réel, Mains nues comprises (`LDB 14 l.155`). */
function setDeMelee(active: Combatant): boolean {
  const set = activeLoadout(active);
  const armes = set
    ? [set.main, set.secondaire].flatMap((uid) => active.weapons.filter((w) => !!uid && w.uid === uid))
    : active.weapons;
  return armes.length === 0 || armes.some((w) => w.type === 'melee');
}

/** Les entrées de REMÈDE du registre — celles que la donnée porte au gate `etat-porte`. */
export const REMEDES = ACTIONS.filter((a) => [a.gate].flat().includes(GATE_ETAT_PORTE));

/** LE GESTE QUI REMÈDE À CET ÉTAT — source unique de son libellé pour les surfaces qui le nomment
 *  (fenêtre du Test de récupération). */
export function remedeDeLEtat(stateId: string): ActionDef | undefined {
  return REMEDES.find((a) => a.rule?.type === 'etat' && a.rule.id === stateId);
}

/** Les remèdes PERTINENTS pour ce porteur : ceux dont l'État est porté (le verdict du gate, pris une
 *  fois). Lecture UNIQUE des surfaces — elles n'indexent pas `ACTION_GATES`. L'ordre est celui de la
 *  donnée. */
export function remedesPertinents(ctx: ActionCtx): ActionDef[] {
  return REMEDES.filter((def) => ACTION_GATES[GATE_ETAT_PORTE]({ ...ctx, def }).ok);
}

/** Verdict d'offre d'une action, par son id — porte de lecture UNIQUE pour les surfaces.
 *  Le champ `gate` de l'entrée peut nommer PLUSIEURS prédicats : ils se composent par l'ET séquentiel
 *  déjà écrit (`et`) — toutes passent, sinon la PREMIÈRE raison refusée est rendue (aucune raison
 *  fabriquée). Une condition de plus sur une action = une ligne de JSON, jamais un gate composé à la main. */
export function actionGate(actionId: string, ctx: ActionCtx): ActionGate {
  const def = ACTIONS.find((a) => a.id === actionId);
  if (!def) return no(`action inconnue : ${actionId}`);
  const noms = Array.isArray(def.gate) ? def.gate : [def.gate];
  return et(...noms.map((g) => ACTION_GATES[g]))({ ...ctx, def });
}

/** Contexte des sélecteurs : impurs par nature (ils lisent le combat, parfois la scène). */
export interface ActionSelectorCtx extends ActionCtx {
  state?: Jeu;
  /** Arme visée quand le sélecteur dépend d'une arme précise (munitions compatibles). */
  weaponUid?: string;
}

/** Les Sorts que le porteur peut dissiper (`dispellableSpellsOn`), Langue (Magick) exigée (`LDB 46 l.158-162`). */
function sortsDissipables({ active, battle }: ActionSelectorCtx): DispellableSpell[] {
  return actorHasSkill(active, { id: 'langue', spec: 'magick' }) ? dispellableSpellsOn(battle.combatants) : [];
}

/** Les SÉLECTEURS de candidats, par id (`candidates` de `actions.json`) — enveloppes nommées des
 *  fonctions déjà écrites (la liste manuscrite de l'IA n'a plus lieu d'être). */
export const ACTION_CANDIDATES: Record<SelecteurDAction, (ctx: ActionSelectorCtx) => unknown[]> = {
  'montures-adjacentes': ({ active, battle, scene }) => mountablesNear(battle, scene, active),
  'pieces-servables': ({ active, battle, scene }) => servablePostes(scene, active, battle.combatants),
  /** La pièce POUSSABLE que l'actif sert — l'entité qui porte le geste de Pousser (spec zone 4 : le
   *  geste vit sur ce qui l'offre). Le verdict d'AFFORDANCE est celui de la source unique déjà écrite
   *  (`pushSlot.show` : chef d'un engin à roues résolu, arme + affût présents, ADE II 8 l.258) — une
   *  pièce non poussable (pierrier naval) n'est donc pas un candidat, et n'ouvre aucune pastille muette.
   *  La coque, elle, se lit à la source unique de l'appartenance à un équipage (`crewPosteOf`). */
  'piece-poussable': ({ active, battle }) => {
    if (!pushSlot(active, battle.combatants).show) return [];
    const sp = crewPosteOf(active.id, battle.combatants);
    return sp ? [sp] : [];
  },
  'cibles-soin': ({ active, battle, scene }) =>
    healableTargets(campAuContact(scene, battle, active)).filter((c) => modesDOuverture(c, active).length > 0),
  'cibles-aspersion': ({ active, battle, scene }) =>
    hasWaterContainer(active) ? waterSprayCandidates(active, campAuContact(scene, battle, active)) : [],
  /** Dissiper est un Test de Langue (Magick) (`LDB 46 l.158-162`) : sans elle, rien n'est dissipable par ce porteur. Le
   *  mode Dissiper (`dissipation`) s'offre une fois s'il en existe un. */
  'sorts-dissipables': sortsDissipables,
  /** Les MÊMES Sorts, chacun le candidat de son geste (`dissipation-sort` → `dissiperLeSort`, `ACTION_PORTEURS`). */
  'sorts-a-dissiper': sortsDissipables,
  /** Méthodes d'Avantage POSSÉDÉES (dédupliquées par Compétence : un Savoir groupé = une case). Le
   *  PLAFOND ne filtre plus ici : il est le verdict d'offre `avantage-sous-plafond`, qui laisse la case
   *  dessinée fermée avec sa raison — une seule source, jamais un filtre muet doublé d'un gate. */
  'competences-avantage': ({ active }) =>
    [...new Map(combatAdvantageSkills(active).map((s) => [s.skillId, s])).values()],
  /** Attaques de TRAIT qui ARMENT le clic, une cible ou un point à désigner (`attaque-trait`), et attaques IMMÉDIATES,
   *  sans cible (`attaque-zone`) : le tri se lit à la forme de ciblage de leur manœuvre (`attaqueImmediate`). L'attaque
   *  d'ARME est le geste du conduit (`attaque`), jamais une case de la grille. */
  'attaques-de-trait': ({ active, battle, scene }) => availableAttacks(scene, active, battle).filter((a) => a.kind !== 'arme' && !attaqueImmediate(a)),
  'attaques-de-zone': ({ active, battle, scene }) => availableAttacks(scene, active, battle).filter((a) => a.kind !== 'arme' && attaqueImmediate(a)),
  'sorts-du-heros': ({ active }) => active.spells ?? [],
  /** Les États PORTÉS : la réserve de Détermination est le verdict d'offre (`determination-en-reserve`), qui dit son refus. */
  'etats-retirables': ({ active }) => active.conditions,
  consommables: ({ active }) => (active.items ?? []).filter(isConsumable),
  /** Les objets que l'actif porte : chacun se pose au sol (`poserLObjet`). */
  'objets-portes': ({ active }) => active.items ?? [],
  'armes-a-distance': ({ active }) => armesADistance(active),
  /** Les armes à distance qui ont un cycle de charge (`reload`) : c'est l'arme que `rechargerLArme` recharge. */
  'armes-a-recharge': ({ active }) => armesADistance(active).filter((w) => (w.reload ?? 0) > 0),
  /** Les munitions compatibles de l'arme visée, ou de chaque arme à distance quand aucune n'est visée : la paire de
   *  l'arme et de sa munition, que `approvisionnerLArme` reçoit. */
  'munitions-compatibles': ({ active, weaponUid }) => {
    const visee = active.weapons.find((x) => x.uid === weaponUid);
    return (visee ? [visee] : armesADistance(active)).flatMap((arme) => compatibleAmmo(active, arme).map((munition) => ({ arme, munition })));
  },
  'manoeuvres-sur-soi': ({ active }) => selfManeuversOf(active).filter((m) => selfManeuverApplicable(active, m)),
  /** Les sets d'armes du porteur, chacun nommé par son contenu (`loadoutLabel`). */
  'sets-d-armes': ({ active }) => (active.loadouts ?? []).map((set) => ({ set, label: loadoutLabel(set, active) })),
  'objets-au-sol': ({ active, state }) => {
    if (!state || !active.pos) return [];
    const flags = state.flags ?? {};
    return (state.scene?.entities ?? [])
      // La portée se lit à la SOURCE UNIQUE (`exploreNav.aPorteeDe`, étage compris) : ce que l'alvéole
      // propose de ramasser est exactement ce que `ramasserLObjet` acceptera.
      .filter((e) => e.kind === 'prop' && aPorteeDe(active.pos!, e))
      // L'ÉPUISEMENT n'est plus une garde séparée : `entityPickables` ne rend que les feuilles des
      // actions ENCORE jouables (`actionsAuthorees` filtre les drapeaux), donc un décor épuisé sort
      // avec zéro candidat sans qu'une seconde garde ait à redire la même chose.
      .flatMap((e) => entityPickables(e, flags, objetDuNarratif(state.campaignNarratif), state.objetsAuSol).map((p) => ({ entityId: e.id, ...p })));
  },
};

/** L'IDENTITÉ DÉCLARÉE d'un candidat : QUI le PORTE (`porteurId` — une entité du champ pour une
 *  pastille, l'objet paramètre d'une alvéole pour un geste secondaire), les PARAMÈTRES que son
 *  verbe attend, et le nom du candidat quand un même porteur en offre plusieurs (deux pièces
 *  d'une coque, deux objets d'un tas). */
export interface ActionPorteur {
  porteurId: string;
  args: ContexteDOffre;
  /** Nom du CANDIDAT (pas de l'action), quand ce n'est pas une entité du champ : ce qui le distingue des autres
   *  candidats de la même entrée. */
  label?: string;
}

/** Un PORTEUR déclaré : la fonction qui traduit un candidat en identité + arguments, et les CLÉS de case que ces
 *  arguments portent (`cles`), que le registre lit sans candidat (verrou de chargement `CLES_DESIGNABLES`). */
export type PorteurDeclare = ((candidat: unknown) => ActionPorteur | null) & { readonly cles: readonly (keyof ContexteDOffre)[] };

/** Déclare un porteur sur ses clés `cles` : ses arguments n'en portent pas d'autre (vérifié à la compilation). */
export function declarerPorteur<K extends keyof ContexteDOffre>(
  cles: readonly K[], porter: (candidat: unknown) => (Omit<ActionPorteur, 'args'> & { args: Pick<ContexteDOffre, K> }) | null,
): PorteurDeclare {
  return Object.assign((c: unknown) => porter(c), { cles });
}

const porteurDArme = declarerPorteur(['weaponUid'], (c) => {
  const w = c as { uid: string; label?: string };
  return { porteurId: w.uid, args: { weaponUid: w.uid }, label: w.label };
});

/** Les PORTEURS, par id de SÉLECTEUR (`candidates`) : une enveloppe NOMMÉE par sélecteur, qui traduit
 *  SON candidat en identité + arguments de son geste. Même patron qu'`ENTREES_PAR_RUN` (une entrée = une
 *  forme, jamais un aiguillage par type de candidat écrit dans une surface). C'est ce qui remplace la
 *  DEVINETTE d'identité (`o?.id ?? o?.uid`) : le registre la DÉCLARE, les deux surfaces qui offrent
 *  des candidats (pastilles du champ, gestes secondaires de la console) la LISENT. Toute action dont
 *  la surface offre par candidat doit avoir la sienne — garde `action-atteignabilite`. */
export const ACTION_PORTEURS: Partial<Record<SelecteurDAction, PorteurDeclare>> = {
  'montures-adjacentes': declarerPorteur(['targetId'], (c) => {
    const m = c as Combatant;
    return { porteurId: m.id, args: { targetId: m.id } };
  }),
  'pieces-servables': declarerPorteur(['posteUid'], (c) => {
    const sp = c as { hull: Combatant; poste: ShipPoste };
    return { porteurId: sp.hull.id, args: { posteUid: sp.poste.item.uid }, label: sp.poste.item.label };
  }),
  'piece-poussable': declarerPorteur([], (c) => {
    const sp = c as { hull: Combatant; poste: ShipPoste };
    return { porteurId: sp.hull.id, args: {}, label: sp.poste.item.label };
  }),
  'objets-au-sol': declarerPorteur(['entityId', 'pickKey'], (c) => {
    const o = c as { entityId: string; key: string; label: string };
    return { porteurId: o.entityId, args: { entityId: o.entityId, pickKey: o.key }, label: o.label };
  }),
  /** Un SORT du héros — le candidat EST son id (`Combatant.spells: string[]`) : c'est lui que porte
   *  l'alvéole du sort, et lui que le geste secondaire de Focalisation paramètre. */
  'sorts-du-heros': declarerPorteur(['spellId'], (c) => {
    const id = c as string;
    return { porteurId: id, args: { spellId: id }, label: garanti(findSpellById(id), id, 'sort du héros').label };
  }),
  /** Une ARME à distance : son `uid` porte le candidat (l'alvéole de recharge en est paramétrée). */
  'armes-a-distance': porteurDArme,
  'armes-a-recharge': porteurDArme,
  /** Une ATTAQUE de trait : son id porte le candidat, et c'est lui que `armerLAttaque` arme. */
  'attaques-de-trait': declarerPorteur(['attackId'], (c) => {
    const a = c as AttackOption;
    return { porteurId: a.id, args: { attackId: a.id }, label: a.label };
  }),
  /** Une MUNITION d'une arme à distance : la paire que `approvisionnerLArme` reçoit. */
  'munitions-compatibles': declarerPorteur(['ammoUid', 'weaponUid'], (c) => {
    const { arme, munition } = c as { arme: Weapon; munition: ItemInstance };
    return { porteurId: munition.uid, args: { ammoUid: munition.uid, weaponUid: arme.uid }, label: munition.label };
  }),
  /** Un allié à asperger (`aspergerDEau`) : une entité du champ. */
  'cibles-aspersion': declarerPorteur(['targetId'], (c) => {
    const cible = c as Combatant;
    return { porteurId: cible.id, args: { targetId: cible.id } };
  }),
  /** Une méthode d'Avantage : sa Compétence (`gagnerLAvantage`). */
  'competences-avantage': declarerPorteur(['skillId'], (c) => {
    const { skillId } = c as { skillId: IdDeCompetence };
    return { porteurId: skillId, args: { skillId }, label: byId('skill', skillId)?.label };
  }),
  /** Une manœuvre sur soi (`manoeuvrerSurSoi`). */
  'manoeuvres-sur-soi': declarerPorteur(['maneuverId'], (c) => {
    const m = c as ManeuverDef;
    return { porteurId: m.id, args: { maneuverId: m.id }, label: m.label };
  }),
  /** Un Sort à dissiper, par son lanceur (`dissiperLeSort`). */
  'sorts-a-dissiper': declarerPorteur(['spellId', 'casterId'], (c) => {
    const d = c as DispellableSpell;
    return { porteurId: `${d.spellId}@${d.casterId}`, args: { spellId: d.spellId, casterId: d.casterId }, label: d.label };
  }),
  /** Un consommable du porteur (`utiliserLObjet`). */
  consommables: declarerPorteur(['itemUid'], (c) => {
    const objet = c as ItemInstance;
    return { porteurId: objet.uid, args: { itemUid: objet.uid }, label: objet.label };
  }),
  /** Un objet du porteur à poser au sol (`poserLObjet`). */
  'objets-portes': declarerPorteur(['itemUid'], (c) => {
    const objet = c as ItemInstance;
    return { porteurId: objet.uid, args: { itemUid: objet.uid }, label: itemLabel(objet) };
  }),
  /** Un set d'armes du porteur (`prendreLaPanoplie`). */
  'sets-d-armes': declarerPorteur(['loadoutId'], (c) => {
    const { set, label } = c as { set: WeaponLoadout; label: string };
    return { porteurId: set.id, args: { loadoutId: set.id }, label };
  }),
  /** Un État porté (`depenserLaDetermination(…, 'retirerUnEtat', id)`) : la pastille de l'État. */
  'etats-retirables': declarerPorteur(['conditionId'], (c) => {
    const etat = c as { id: IdDeCondition };
    return { porteurId: etat.id, args: { conditionId: etat.id }, label: findConditionById(etat.id)?.label };
  }),
  /** Une attaque de ZONE : `lancerLAttaqueDeZone` la résout par son `kind`. */
  'attaques-de-zone': declarerPorteur(['attackKind'], (c) => {
    const a = c as AttackOption;
    return { porteurId: a.id, args: { attackKind: a.kind }, label: a.label };
  }),
};


/** L'offre de `def` sur `args` est-elle armée ? Son intention est celle que vise le siège (`localIntent`), ou le mode
 *  qu'elle arme (`armed`, son `mode`) est celui du combat, sur le sort élu (`selectedSpellId`) quand elle en désigne un. */
export function offreArmee(etat: Pick<Jeu, 'battle' | 'localIntent'>, def: ActionDef, args: ContexteDOffre = {}): boolean {
  const b = etat.battle;
  if (def.intent && etat.localIntent?.actionId === def.id) return true;
  return !!def.armed && !!b && b.action === def.mode && (!args.spellId || b.selectedSpellId === args.spellId);
}

/** Ce que l'acte prend dans l'économie du tour, en toutes lettres — la donnée `cost` du registre, dite
 *  à l'endroit du geste (spec HUD zone 4 : « coût de l'Action affiché »). `null` = rien à annoncer. */
export function actionCostLabel(def: ActionDef): string | null {
  return def.coutAction === 'aucun' ? null : t(`acost.${def.coutAction}`);
}

/** Le CONTEXTE d'une offre — elle nomme SA cible ; jamais une closure qui la capture. */
export interface ContexteDOffre {
  targetId?: IdDeCombattant;
  weaponUid?: IdDObjet;
  ammoUid?: IdDObjet;
  spellId?: IdDeSort;
  /** Le PORTEUR du Sort à dissiper (`dissiperLeSort`). */
  casterId?: IdDeCombattant;
  skillId?: IdDeCompetence;
  itemUid?: IdDObjet;
  loadoutId?: IdDePanoplie;
  conditionId?: IdDeCondition;
  maneuverId?: IdDeManoeuvre;
  attackId?: IdDAttaque;
  attackKind?: AttackKind;
  entityId?: IdDEntiteDeScene;
  pickKey?: IdDObjetRamassable;
  /** COQUE visée (`hullId`) — bordée, chant, rechargement de pièce. */
  shipId?: IdDeCombattant;
  /** MEMBRE D'ÉQUIPAGE qui agit sur la coque (`manoeuvrerLeNavire(crewId)`, `noyau/combatSlice.ts`) : c'est le
   *  barreur, pas le navire. Deux champs parce que ce sont deux entités — un seul mentait. */
  crewId?: IdDeCombattant;
  posteUid?: IdDePoste;
}

/** Ce que l'entrée d'une offre lit pour déclarer son geste : l'entrée, les arguments de sa case, l'état, et le combattant
 *  actif (`undefined` hors du tour d'un combattant : la pause de Round). */
interface OffreAJouer {
  def: ActionDef;
  args: ContexteDOffre;
  etat: Jeu;
  active: Combatant | undefined;
}

/** Le geste du verbe `verbe` sur ses arguments, typés par sa signature : une offre ne déclare qu'un verbe du noyau, à ses
 *  paramètres. Les arguments omis en fin ne s'écrivent pas. */
function geste<V extends keyof ActionsDuNoyau>(verbe: V, ...args: Parameters<ActionsDuNoyau[V]>): GesteDuNoyau {
  return { verbe, args: sansFinAbsente(args) };
}

/** Les arguments sans les `undefined` qui ferment la liste ; un `null` déclaré reste une valeur (`jetRegler(…, null)`). */
function sansFinAbsente(args: readonly unknown[]): unknown[] {
  const ecrits = [...args];
  while (ecrits.length && ecrits[ecrits.length - 1] === undefined) ecrits.pop();
  return ecrits;
}

/** L'id du combattant actif, que l'offre d'un porteur prend pour porteur. */
const idDeLActif = (o: OffreAJouer): IdDeCombattant => garanti(o.active, o.def.id, 'actif de l’offre').id;

/** Le candidat que le CORPS d'un verbe prend pour une position omise, dans le combat de l'actif : l'argument même qu'il
 *  recevrait, lu aux fonctions que lit le corps. */
type DefautDuCorps = (b: Pick<ActionCtx, 'active' | 'battle' | 'scene'>) => unknown;

/** Ce que porte une position d'argument d'un verbe de la barre :
 *  - une clé du contexte de la case (`cle`) ;
 *    `defaut` est le candidat que le corps prend quand elle est omise, et `omissible` dit que la signature l'admet
 *    (l'offre ne l'écrit alors pas) ;
 *  - ou la valeur qu'un champ déclaré de l'ENTRÉE lui donne (`entree`), qui désigne l'entrée elle-même. */
type ArgumentDuVerbe =
  | { readonly cle: keyof ContexteDOffre; readonly defaut?: DefautDuCorps; readonly omissible?: true }
  | { readonly entree: (def: ActionDef) => unknown };

/** LA LECTURE D'UN VERBE DE LA BARRE (#3610), une déclaration lue dans les deux sens : l'offre en tire son geste (le
 *  contexte de sa case vers les arguments, `gesteDuVerbeDeLaBarre`), le verbe son contexte (les arguments vers le candidat,
 *  `contexteDesArguments`), défauts du corps compris.
 *  - `args` : ce que porte chaque position ;
 *  - `requis` : les clés sans lesquelles la case attend son paramètre, que la surface choisit (geste `null`). */
interface LectureDuVerbe {
  args?: readonly ArgumentDuVerbe[];
  requis?: readonly (keyof ContexteDOffre)[];
}

/** L'actif, que le corps prend pour sa coque ou son barreur. */
const lActif: DefautDuCorps = ({ active }) => active.id;

/** La lecture de chaque verbe de la barre (`VerbesDeLaBarre`), entrée des offres qui le déclarent par leur `run` : un
 *  verbe de la barre sans lecture, ou absent de `RUNS_D_ACTION`, ne compile pas. Chaque clé d'argument d'une entrée se désigne par les candidats de son
 *  porteur, par un PRÉALABLE qui la lit (`CLES_DES_PREALABLES`) ou par son défaut : sinon le registre lève au chargement
 *  (`CLES_DESIGNABLES`). */
const ARGUMENTS_DE_LA_BARRE: { readonly [V in keyof VerbesDeLaBarre]: LectureDuVerbe } = {
  armerLIntention: { args: [{ entree: (def) => def.id }] },
  armerLeMode: { args: [{ entree: (def) => def.mode }] },
  armerLAttaque: { args: [{ cle: 'attackId', defaut: () => 'arme' }] },
  lancerLAttaqueDeZone: { args: [{ cle: 'attackKind' }], requis: ['attackKind'] },
  prendreLaVisee: {},
  rechargerLArme: { args: [{ cle: 'weaponUid', defaut: ({ active, battle }) => rechargeDuTour(active, battle)?.arme.uid, omissible: true }] },
  approvisionnerLArme: {
    args: [{ cle: 'ammoUid' }, { cle: 'weaponUid', defaut: ({ active }) => armeADistanceParDefaut(active)?.uid, omissible: true }],
    requis: ['ammoUid'],
  },
  basculerLaRepousse: {},
  basculerLaPosture: { args: [{ entree: (def) => def.stance }] },
  aspergerDEau: { args: [{ cle: 'targetId', defaut: ({ active, battle, scene }) => waterSprayCandidates(active, campAuContact(scene, battle, active))[0]?.id, omissible: true }] },
  prendreLaDefensive: {},
  rompreLEngagement: {},
  gagnerLAvantage: { args: [{ cle: 'skillId' }], requis: ['skillId'] },
  // L'État traité est celui que l'ENTRÉE déclare : aucun paramètre de case ne le porte.
  seRemettreDeLEtat: { args: [{ entree: etatDeclare }] },
  seRelever: {},
  faireUnBattement: { args: [{ cle: 'targetId', defaut: ({ active, battle }) => battementFoes(active, battle)[0]?.id, omissible: true }] },
  tenterDeDistraire: { args: [{ cle: 'targetId', defaut: ({ active, battle }) => distraireFoes(active, battle)[0]?.id, omissible: true }] },
  entrerEnFrenesie: {},
  manoeuvrerSurSoi: { args: [{ cle: 'maneuverId' }], requis: ['maneuverId'] },
  monterEnSelle: { args: [{ cle: 'targetId', defaut: ({ active, battle, scene }) => mountablesNear(battle, scene, active)[0]?.id, omissible: true }] },
  mettrePiedATerre: {},
  servirLePoste: { args: [{ cle: 'posteUid', defaut: ({ active, battle, scene }) => servablePostes(scene, active, battle.combatants)[0]?.poste.item.uid, omissible: true }] },
  quitterLePoste: {},
  pousserLEngin: {},
  aiderLEquipe: {},
  // La barre : le barreur la tient, ou la coque elle-même (`manoeuvrerLeNavire` accepte l'un ou l'autre).
  manoeuvrerLeNavire: { args: [{ cle: 'crewId', defaut: lActif }] },
  chanterLaChanson: { args: [{ cle: 'shipId', defaut: lActif }] },
  annulerLeDeplacement: {},
  terminerLeTour: {},
} satisfies Partial<Record<RunDAction, LectureDuVerbe>>;

/** `verbe` est-il un verbe de la barre (`VerbesDeLaBarre`) ? */
export function estVerbeDeLaBarre(verbe: string): verbe is keyof VerbesDeLaBarre {
  return Object.prototype.hasOwnProperty.call(ARGUMENTS_DE_LA_BARRE, verbe);
}

/** Les clés du contexte de case qu'une position porte. */
const clesDe = (a: ArgumentDuVerbe): (keyof ContexteDOffre)[] => ('cle' in a ? [a.cle] : []);

/** L'argument d'une position, tiré du contexte `ctx` (`undefined` quand il n'y est pas). */
function argumentDuContexte(a: ArgumentDuVerbe, def: ActionDef, ctx: ContexteDOffre, i: number): unknown {
  if ('entree' in a) return garanti(a.entree(def), def.id, `argument ${i} déclaré par l’entrée`);
  return ctx[a.cle];
}

/** Les arguments du verbe lu par `lecture` que le contexte `ctx` de l'entrée `def` déclare. */
function argumentsDuContexte(lecture: LectureDuVerbe, def: ActionDef, ctx: ContexteDOffre): unknown[] {
  return sansFinAbsente((lecture.args ?? []).map((a, i) => argumentDuContexte(a, def, ctx, i)));
}

/** Sens CANDIDAT → ARGUMENTS : le geste du verbe de la barre `verbe` qu'une offre déclare, ou `null` quand sa case attend
 *  son paramètre (`requis`). Une position que la signature exige (non `omissible`) prend le défaut du corps. */
function gesteDuVerbeDeLaBarre(verbe: keyof VerbesDeLaBarre, o: OffreAJouer): GesteDuNoyau | null {
  const lecture = ARGUMENTS_DE_LA_BARRE[verbe];
  if ((lecture.requis ?? []).some((cle) => o.args[cle] === undefined)) return null;
  const ctx: Record<string, unknown> = { ...o.args };
  for (const a of lecture.args ?? []) {
    if ('entree' in a || a.omissible || !a.defaut || argumentDuContexte(a, o.def, o.args, 0) !== undefined) continue;
    Object.assign(ctx, versLeContexte(a, a.defaut({ active: garanti(o.active, o.def.id, 'actif de l’offre'), battle: garanti(o.etat.battle, o.def.id, 'combat de l’offre'), scene: o.etat.scene })));
  }
  return { verbe, args: argumentsDuContexte(lecture, o.def, ctx as ContexteDOffre) };
}

/** Les clés de contexte qu'un argument `v` de la position `a` pose. */
function versLeContexte(a: ArgumentDuVerbe, v: unknown): Record<string, unknown> {
  if (v === undefined || v === null || 'entree' in a) return {};
  return { [a.cle]: v };
}

/** Sens ARGUMENTS → CANDIDAT : le contexte de case que les arguments `args` du verbe lu par `lecture` désignent, dans le
 *  combat `b`. Un argument omis (`undefined`, ou `null` qu'un hôte JSON écrit pour omettre) prend le défaut du corps. */
function contexteDesArguments(lecture: LectureDuVerbe, args: readonly unknown[], b: Pick<ActionCtx, 'active' | 'battle' | 'scene'>): ContexteDOffre {
  return Object.assign({}, ...(lecture.args ?? []).map((a, i) => {
    const pose = args[i] ?? undefined;
    return versLeContexte(a, pose === undefined && !('entree' in a) && a.defaut ? a.defaut(b) : pose);
  })) as ContexteDOffre;
}

/** L'entrée `def` est-elle celle que désignent les arguments `args` de son verbe (positions `entree` de sa lecture) ? */
function entreeDesignee(lecture: LectureDuVerbe, def: ActionDef, args: readonly unknown[]): boolean {
  return (lecture.args ?? []).every((a, i) => !('entree' in a) || a.entree(def) === args[i]);
}

/** L'ENTRÉE d'une offre (#3610) : le geste qui la joue (`null` : sa case attend son paramètre), et sa place. `barre` :
 *  l'offre est un geste du tour de l'actif, refusée hors de la barre ouverte (`etatDeLaBarre`) ; hors de la barre, elle se
 *  joue hors du tour de son siège (pause de Round, levée de main, sortie d'interlude), au verdict de ses gates, et le verbe
 *  qu'elle déclare juge avec sa propre route. */
interface EntreeDOffre {
  barre: boolean;
  geste: (o: OffreAJouer) => GesteDuNoyau | null;
}

const duTour = (g: EntreeDOffre['geste']): EntreeDOffre => ({ barre: true, geste: g });
const horsDuTour = (g: EntreeDOffre['geste']): EntreeDOffre => ({ barre: false, geste: g });

/** Le geste que joue le paramètre `valeur` de la case, `null` sans lui. */
const avec = <T>(valeur: T | undefined, jouer: (v: T) => GesteDuNoyau): GesteDuNoyau | null => (valeur === undefined ? null : jouer(valeur));

/** Les entrées des offres qui déclarent un verbe hors de `VerbesDeLaBarre`, par leur `run` : un verbe que d'autres gestes
 *  jouent aussi, son porteur l'actif, ou la sortie d'une phase. */
const ENTREES_HORS_DES_VERBES_DE_LA_BARRE: Readonly<Record<Exclude<RunDAction, keyof VerbesDeLaBarre>, EntreeDOffre>> = {
  utiliserLObjet: duTour((o) => avec(o.args.itemUid, (uid) => geste('utiliserLObjet', uid))),
  poserLObjet: duTour((o) => avec(o.args.itemUid, (uid) => geste('poserLObjet', uid))),
  ramasserLObjet: duTour((o) => (o.args.entityId && o.args.pickKey ? geste('ramasserLObjet', o.args.entityId, o.args.pickKey) : null)),
  /** L'alvéole d'un sort ARME le mode d'incantation sur CE sort (`armed`, son `mode`) : le re-clic le désarme (`desarmerLeMode`),
   *  comme toute case à mode armé — annulation gratuite, rien n'est engagé avant le clic-cible. */
  incanterLeSort: duTour((o) => avec(o.args.spellId, (sort) => geste('incanterLeSort', idDeLActif(o), sort))),
  focaliserLeSort: duTour((o) => avec(o.args.spellId, (sort) => geste('focaliserLeSort', idDeLActif(o), sort))),
  dissiperLeSort: duTour((o) => (o.args.spellId && o.args.casterId ? geste('dissiperLeSort', idDeLActif(o), o.args.spellId, o.args.casterId) : null)),
  prendreLaPanoplie: duTour((o) => avec(o.args.loadoutId, (id) => geste('prendreLaPanoplie', idDeLActif(o), id))),
  immuniserALaPsychologie: duTour((o) => geste('depenserLaDetermination', idDeLActif(o), 'immuniserALaPsychologie')),
  ignorerLesCritiques: duTour((o) => geste('depenserLaDetermination', idDeLActif(o), 'ignorerLesCritiques')),
  retirerUnEtat: duTour((o) => avec(o.args.conditionId, (etat) => geste('depenserLaDetermination', idDeLActif(o), 'retirerUnEtat', etat))),
  /** PORTE UNIQUE de la pause d'initiative (LDB 17 l.25) : la validation de la pause, qui marque le siège PRÊT — c'est le
   *  quorum (sièges requis) qui lance, jamais un client ; en solo, le quorum est ce siège. */
  lancerLeRound: horsDuTour(() => geste('fenetreValider', 'debutDuRound')),
  /** Demande de pause au prochain Round — INTERRUPTEUR, lu dans l'état de l'émetteur : son siège l'a déjà posée, elle se
   *  retire (annulation gratuite), sinon elle se pose. */
  leverLaMain: horsDuTour(({ etat }) => geste('leverLaMain', !(etat.battle?.handRaisedBy ?? []).includes(decidingSeat(etat)))),
  // ── SORTIES D'INTERLUDE (`surface: 'interlude'`) : une entrée NOMMÉE par interlude, chacune la sortie de sa fenêtre.
  fermerLeBalayage: horsDuTour(() => geste('fenetreFermer', 'frappeMortelle')),
  renoncerALaSecondeFrappe: horsDuTour(() => geste('fenetreFermer', 'secondeFrappe')),
  renoncerALaCarte: horsDuTour(() => geste('jetRegler', 'incantation', 'carte', null)),
  /** Sortie du placeur de zone, ROUTÉE PAR LA SOURCE que mesure `placingZoneOf` — symétrique de `commitPlacedZone` (même
   *  aiguilleur pour poser et pour renoncer) : un sort revient à sa modale, un pilonnage referme son placeur. */
  renoncerALaZone: horsDuTour(({ etat }) => {
    const pz = placingZoneOf(etat);
    if (!pz) return null;
    switch (pz.source) {
      case 'incantation': return geste('jetRegler', 'incantation', 'carte', null);
      case 'siege': return geste('fenetreFermer', 'viseeDeSiege');
      default: return pz.source satisfies never;
    }
  }),
  desarmerLaBatterie: horsDuTour(() => geste('desarmerLeMode')),
  /** Téléportation (`combatFlow.ts:5381` : `action: 'teleportation'` + `reachable` = `flyReachable` depuis la case du lanceur,
   *  qui contient donc SA case au coût 0, `path.ts:318`) : la sortie de l'interlude est un ARRIVAGE sur place — le même
   *  clic que le clic-sol. */
  resterSurPlace: horsDuTour(({ active }) => (active?.pos ? geste('cliquerLaCase', { ...active.pos }) : null)),
};

/** Les entrées des offres, par `run` : celle de chaque verbe de la barre, et les autres. */
const ENTREES_PAR_RUN: Readonly<Record<RunDAction, EntreeDOffre>> = {
  ...ENTREES_HORS_DES_VERBES_DE_LA_BARRE,
  ...tableTotale(Object.keys(ARGUMENTS_DE_LA_BARRE) as (keyof VerbesDeLaBarre)[], (verbe) => duTour((o) => gesteDuVerbeDeLaBarre(verbe, o))),
};

/** L'entrée d'offre de chaque action qui se joue (`run`). */
const ENTREE_DE_L_ACTION: ReadonlyMap<string, EntreeDOffre> = new Map(ACTIONS.flatMap((def) => (def.run ? [[def.id, ENTREES_PAR_RUN[def.run]] as const] : [])));

/** L'entrée du registre d'id `id`, ou `undefined`. */
export const offreDeId = (id: unknown): ActionDef | undefined => ACTIONS.find((a) => a.id === id);

/**
 * LE GESTE D'UNE OFFRE (#3610), comme toute projection du noyau (`batailleEnVue`) : le verbe qui joue l'offre `def` sur
 * les arguments `args` de sa case dans l'état `etat`, celui que déclare son entrée ; l'offre armée (`offreArmee`) se
 * désarme (`desarmerLeMode`, le re-clic de sa case). `null` : sa case attend son paramètre, ou l'action ne se joue pas
 * (`blocked`).
 */
export function gesteDeLOffre(etat: Jeu, def: ActionDef, args: ContexteDOffre = {}): GesteDuNoyau | null {
  return gesteSurLActif(etat, etat.battle ? activeCombatant(etat.battle) : undefined, def, args);
}

/** Le geste de l'offre `def` (`gesteDeLOffre`), son porteur l'actif `active` de l'état `etat`. */
function gesteSurLActif(etat: Jeu, active: Combatant | undefined, def: ActionDef, args: ContexteDOffre): GesteDuNoyau | null {
  if (offreArmee(etat, def, args)) return geste('desarmerLeMode');
  return ENTREE_DE_L_ACTION.get(def.id)?.geste({ def, args, etat, active }) ?? null;
}

/**
 * LE VERDICT D'UNE OFFRE HORS DE LA BARRE (#3371) : la raison qui refuse l'offre `actionId` dans l'état `s`, ou `null`.
 * Une telle offre se joue hors du tour de son siège (pause de Round, levée de main, sortie d'interlude) : son verdict est
 * celui de ses gates, sur le combat en cours ; le verbe qu'elle déclare juge ensuite, avec sa route. Une offre de la barre
 * se juge par le geste qui la joue (`refusDuGeste`).
 */
export function refusDeLOffreHorsDuTour(s: Jeu, actionId: string): string | null {
  const b = s.battle && !s.battle.over ? s.battle : undefined;
  const active = b && (activeCombatant(b) ?? b.combatants[0]);
  if (!b || !active) return t('barre.personneNAgit');
  const gate = actionGate(actionId, { active, battle: b, scene: s.scene, netMode: s.net.mode, gameTime: s.gameTime });
  return gate.ok ? null : garanti(gate.reason, actionId, 'raison du refus de l’offre');
}

/** Le candidat `candidat` (les arguments que son porteur déclare) est-il celui que désigne le contexte `poses` ? Chacun de
 *  ses arguments y est repris. Règle UNIQUE de la désignation : le verdict d'un geste (`refusDuGeste`) et la case qui se
 *  reconnaît parmi les offres (`offreDesignee`). */
function designe(candidat: ContexteDOffre, poses: ContexteDOffre): boolean {
  const voulus = poses as Record<string, unknown>;
  return Object.entries(candidat).every(([k, v]) => voulus[k] === v);
}

/** Les clés de case que lit chaque PRÉALABLE DE VERBE : un argument qu'il lit est jugé par lui. */
const CLES_DES_PREALABLES: Readonly<Record<string, readonly (keyof ContexteDOffre)[]>> = {
  'arme-a-recharger': ['weaponUid'],
  'battement-cible-eligible': ['targetId'],
  'distraire-cible-eligible': ['targetId'],
};

/** Les clés de case que l'entrée `def` désigne par un candidat (celles que son porteur DÉCLARE) ou par un préalable qui
 *  les lit. */
function clesJugees(def: ActionDef): { porteur: ReadonlySet<keyof ContexteDOffre>; prealables: ReadonlySet<keyof ContexteDOffre> } {
  return {
    porteur: new Set(def.candidates ? ACTION_PORTEURS[def.candidates]?.cles ?? [] : []),
    prealables: new Set([def.gate].flat().flatMap((g) => CLES_DES_PREALABLES[g] ?? [])),
  };
}

/** Le verrou de chargement : chaque clé d'argument de chaque entrée d'un verbe de la barre se désigne (porteur, préalable
 *  ou défaut du corps). Une entrée qui prendrait un argument sans pouvoir dire ses candidats lève ici, en la nommant. */
const CLES_DESIGNABLES = ACTIONS.flatMap((def) => {
  if (!def.run || !estVerbeDeLaBarre(def.run)) return [];
  const { porteur, prealables } = clesJugees(def);
  for (const a of ARGUMENTS_DE_LA_BARRE[def.run].args ?? []) {
    if ('entree' in a || a.defaut) continue;
    const orpheline = clesDe(a).find((k) => !porteur.has(k) && !prealables.has(k));
    if (orpheline) throw new Error(`entrée ${def.id} : l’argument ${orpheline} de ${def.run} ne désigne aucun candidat (porteur, préalable ou défaut du corps)`);
  }
  return [def.id];
});
void CLES_DESIGNABLES;

/** La raison qui refuse la DÉSIGNATION du contexte `args` (défauts du corps posés) par l'entrée `def`, ou `null`.
 *  - Une clé requise absente : aucun candidat.
 *  - Une entrée à sélecteur : un candidat existe ; avec un porteur, l'un d'eux est désigné (`designe`), comme l'offre les
 *    énumère (`offresDeLActif`).
 *  - Toute autre clé posée est lue par un préalable de l'entrée, ou vaut le défaut du corps : son seul candidat. */
function refusDeDesignation(def: ActionDef, lecture: LectureDuVerbe, ctx: ActionSelectorCtx, args: ContexteDOffre): string | null {
  if ((lecture.requis ?? []).some((cle) => args[cle] === undefined)) return t('offre.sansCandidat');
  const selecteur = def.candidates ? ACTION_CANDIDATES[def.candidates] : undefined;
  const porteur = def.candidates ? ACTION_PORTEURS[def.candidates] : undefined;
  const candidats = selecteur ? selecteur(ctx) : [];
  const porteurs = porteur ? candidats.flatMap((c) => { const p = porteur(c); return p ? [p] : []; }) : [];
  if (selecteur && !(porteur ? porteurs : candidats).length) return t('offre.sansCandidat');
  if (porteur && !porteurs.some((p) => designe(p.args, args))) return t('offre.sansCandidatDuContexte');
  const { porteur: parLesCandidats, prealables } = clesJugees(def);
  const defauts = contexteDesArguments({ args: (lecture.args ?? []).filter((a) => !('entree' in a) && a.defaut) }, [], ctx);
  const poses = args as Record<string, unknown>;
  const horsCandidat = (Object.keys(poses) as (keyof ContexteDOffre)[]).some((k) => !parLesCandidats.has(k) && !prealables.has(k)
    && poses[k] !== (defauts as Record<string, unknown>)[k]);
  return horsCandidat ? t('offre.sansCandidatDuContexte') : null;
}

/**
 * LE REFUS D'UN GESTE DE LA BARRE (#3610), une fonction pure du geste, comme `refusDeSceneDeBataille` : l'entrée qui
 * admet le geste `g` dans l'état `s`, ou la raison qui le refuse. Le verbe l'applique (`creerVerbesDeLaBarre`), l'émetteur
 * invité aussi (`localIntent.ts`), et l'offre en est la projection sur ses candidats (`Offre.gate`).
 *  1. la barre est ouverte (`etatDeLaBarre`) ;
 *  2. les entrées de son verbe (`run`), celles que ses arguments désignent (`entree`), PERTINENTES pour l'actif ;
 *  3. ses arguments repris en contexte de case par la lecture du verbe (`contexteDesArguments`) : un argument omis prend
 *     le défaut du corps ;
 *  4. chaque clé posée désigne un candidat de l'entrée (`refusDeDesignation`) : parmi ceux de son porteur, par un
 *     préalable qui la lit, ou en valant le défaut du corps, son seul candidat ;
 *  5. les gates de l'entrée sur ce contexte (`actionGate`), les PRÉALABLES DE VERBE compris.
 * La première entrée qui passe admet le geste ; sinon la raison est celle de la première entrée pertinente que ses gates
 * refusent, à défaut celle de sa désignation.
 */
export function refusDuGeste(s: Jeu, g: GesteDuNoyau): { def: ActionDef; args: ContexteDOffre } | { refus: string } {
  const barre = etatDeLaBarre(s);
  if (barre.forme !== 'ouverte') return { refus: barre.raison };
  if (!estVerbeDeLaBarre(g.verbe)) return { refus: t('offre.sansEntree') };
  const lecture: LectureDuVerbe = ARGUMENTS_DE_LA_BARRE[g.verbe];
  const base: ActionSelectorCtx = { active: barre.active, battle: barre.battle, scene: s.scene, netMode: s.net.mode, gameTime: s.gameTime, state: s };
  const defs = ACTIONS.filter((def) => def.run === g.verbe && entreeDesignee(lecture, def, g.args));
  if (!defs.length) return { refus: t('offre.sansEntree') };
  const pertinentes = defs.filter((def) => pertinente(def, base));
  if (!pertinentes.length) return { refus: garanti(actionGate(defs[0].id, base).reason, defs[0].id, 'raison de la pertinence') };
  const args = contexteDesArguments(lecture, g.args, base);
  let refusDeRegle: string | undefined;
  let refusDeCandidat: string | undefined;
  for (const def of pertinentes) {
    const gate = actionGate(def.id, { ...base, args });
    const designation = refusDeDesignation(def, lecture, base, args);
    if (gate.ok && !designation) return { def, args };
    if (!gate.ok) refusDeRegle ??= garanti(gate.reason, def.id, 'raison du refus du geste');
    refusDeCandidat ??= designation ?? undefined;
  }
  return { refus: garanti(refusDeRegle ?? refusDeCandidat, g.verbe, 'raison du refus du geste') };
}

/** Arme l'intention que l'offre `def` déclare (`ActionDef.intent`) : l'armement est l'état LOCAL de l'émetteur
 *  (`localIntent`), jamais posé chez l'hôte au nom d'un siège. Le verbe de la barre l'arme où il se joue ; l'invité qui
 *  envoie un verbe de la barre l'arme avant l'envoi (`INTENT_PREPARATION_LOCALE`, `localIntent.ts`). */
export function armerLOffre(get: Get<JeuDuNoyau>, def: ActionDef): void {
  if (def.intent && !unSiegeAgit()) get().poserLIntention(def.id);
}

/** Les corps des verbes de la barre, ceux du combat (`createCombatSlice`) : armer l'intention d'une offre est tout son
 *  geste, que son verdict joue (`armerLOffre`) ; le mode du combat se désarme par `null`. */
type CorpsDeLaBarre = Omit<VerbesDeLaBarre, 'armerLIntention' | 'armerLeMode'> & { armerLeMode: (mode: BattleActionMode | null) => void };

/** Les verbes de la barre (#3610), chacun jugé par le refus de son geste (`refusDuGeste`) : refusé, et dit, hors de
 *  l'entrée qui l'admet, l'intention qu'elle arme armée, puis son corps joué ; et `desarmerLeMode`, la sortie gratuite de ce
 *  qu'une offre arme. */
export function creerVerbesDeLaBarre(get: Get<JeuDuNoyau>, set: Set, corps: CorpsDeLaBarre): VerbesDeLaBarre & Pick<ActionsDuNoyau, 'desarmerLeMode'> {
  const corpsDe = (verbe: keyof VerbesDeLaBarre): ((...args: unknown[]) => void) | undefined =>
    (verbe === 'armerLIntention' ? undefined : corps[verbe] as (...args: unknown[]) => void);
  const verbes = tableTotale(Object.keys(ARGUMENTS_DE_LA_BARRE) as (keyof VerbesDeLaBarre)[], (verbe) => (...args: unknown[]) => {
    const verdict = refusDuGeste(get(), { verbe, args });
    if ('refus' in verdict) return void refuserGesteDuSiege(get, set, verdict.refus);
    armerLOffre(get, verdict.def);
    // Le corps reçoit le candidat que le verdict a désigné, défauts du corps compris.
    corpsDe(verbe)?.(...argumentsDuContexte(ARGUMENTS_DE_LA_BARRE[verbe], verdict.def, verdict.args));
  }) as unknown as VerbesDeLaBarre;
  return {
    ...verbes,
    desarmerLeMode: () => {
      if (!unSiegeAgit()) get().poserLIntention(null);
      corps.armerLeMode(null);
    },
  } satisfies FabriqueDuNoyau;
}

/** UNE offre : de quoi la peindre (libellé, icône, coût), la refuser avec sa raison (`gate`), et le geste qui la joue
 *  (`geste`). */
export interface Offre {
  actionId: string;
  /** L'entrée elle-même — la surface y lit ce dont elle a besoin (`hote`, `armed`…) sans re-chercher. */
  def: ActionDef;
  /** Libellé de l'ACTION (« Monter », « Ramasser ») — ce que le joueur lit. */
  label: string;
  /** QUI porte l'offre quand l'entrée s'offre par candidat (`ACTION_PORTEURS`) : une entité du champ, l'objet
   *  paramètre d'une alvéole. Absent pour une entrée offerte une fois. */
  porteurId?: string;
  /** Nom du CANDIDAT quand un même porteur en offre plusieurs (une pièce parmi deux, un objet d'un tas). */
  candidat?: string;
  icon: IconId;
  /** Coût dans l'économie du tour, en toutes lettres — `null` quand l'acte n'en prend aucun. */
  cost: string | null;
  args: ContexteDOffre;
  /** Le verdict de l'entrée sur les arguments de son candidat (`actionGate`) : la projection du refus de son geste
   *  (`refusDuGeste`), dont l'offre, candidat énuméré, passe la désignation. */
  gate: ActionGate;
  /** Le verbe qui la joue et ses arguments (`gesteDeLOffre`) ; `null` : sa case attend son paramètre, que la surface
   *  choisit. */
  geste: GesteDuNoyau | null;
}

/** Les offres d'une SURFACE, groupées par PORTEUR (l'identité déclarée du candidat). */
export interface OffresParPorteur {
  porteurId: string;
  offres: Offre[];
}

/** L'entrée est-elle PERTINENTE pour ce porteur ? Aucun de ses gates de `GATES_DE_PERTINENCE` ne refuse. */
function pertinente(def: ActionDef, ctx: ActionCtx): boolean {
  return [def.gate].flat().every((g) => !GATES_DE_PERTINENCE.has(g) || ACTION_GATES[g]({ ...ctx, def }).ok);
}

/**
 * TOUTES LES OFFRES DE L'ACTIF (#2898, #2911) — l'énumération UNIQUE du registre, que lisent la console, les
 * pastilles du champ et l'hôte texte. Ordre : celui du registre ; l'ordre d'affichage, le regroupement par site et
 * l'habillage appartiennent à la surface.
 *  • Une entrée qu'un gate de PERTINENCE refuse n'est pas offerte : elle n'a pas lieu d'être pour ce porteur.
 *  • Une entrée dont le sélecteur a un porteur déclaré (`ACTION_PORTEURS`) s'offre PAR CANDIDAT, son verdict
 *    évalué sur les arguments mêmes du geste (« au plafond de CETTE méthode »).
 *  • Une entrée dont le sélecteur ne rend aucun candidat n'offre rien.
 *  • Toute autre entrée est UNE offre, sans argument, au verdict d'`actionGate`.
 * Une offre fermée reste une offre (`gate.ok === false`), et sa surface la montre avec sa raison (loi du refus
 * visible, arbitrage 2026-08-19). Des entrées d'interlude, seule compte la sortie du ciblage courant
 * (`currentInterludeAction`).
 */
export function offresDeLActif(ctx: ActionSelectorCtx & { state: Jeu }): Offre[] {
  // Le combat de l'offre est celui du contexte, que l'état lu par son geste reprend.
  const etat: Jeu = { ...ctx.state, battle: ctx.battle };
  const interlude = currentInterludeAction(() => etat);
  const offre = (def: ActionDef, args: ContexteDOffre, p?: ActionPorteur): Offre => ({
    actionId: def.id, def, label: def.label, ...(p ? { porteurId: p.porteurId, candidat: p.label } : {}),
    icon: def.icon, cost: actionCostLabel(def), args, gate: actionGate(def.id, { ...ctx, args }), geste: gesteSurLActif(etat, ctx.active, def, args),
  });
  return ACTIONS.flatMap((def): Offre[] => {
    if (def.surface === 'interlude' && def !== interlude) return [];
    if (!pertinente(def, ctx)) return [];
    const selecteur = def.candidates ? ACTION_CANDIDATES[def.candidates] : undefined;
    if (!selecteur) return [offre(def, {})];
    const candidats = selecteur(ctx);
    const porteur = ACTION_PORTEURS[def.candidates!];
    if (!porteur) return candidats.length ? [offre(def, {})] : [];
    return candidats.flatMap((c) => {
      const p = porteur(c);
      return p ? [offre(def, p.args, p)] : [];
    });
  });
}

/** L'offre que des ARGUMENTS de geste désignent : celle de l'entrée `actionId` dont chaque argument est repris par
 *  `args`. Une offre par candidat se reconnaît à ses arguments (le sort, l'arme, l'attaque) ; une offre unique, sans
 *  argument, à son seul id. La console y reconnaît ses cases, l'hôte texte le geste qu'il joue. */
export function offreDesignee(offres: readonly Offre[], actionId: string, args: ContexteDOffre = {}): Offre | undefined {
  return offres.find((o) => o.actionId === actionId && designe(o.args, args));
}

/** Les offres d'une SURFACE qui offre par candidat (pastilles du champ, gestes secondaires d'une alvéole),
 *  groupées par PORTEUR. Une offre sans porteur n'y désigne personne (garde `action-atteignabilite`). */
export function offresParPorteur(offres: readonly Offre[], surface: ActionDef['surface']): OffresParPorteur[] {
  const groupes = new Map<string, OffresParPorteur>();
  for (const o of offres) {
    if (o.def.surface !== surface || !o.porteurId) continue;
    const g = groupes.get(o.porteurId) ?? { porteurId: o.porteurId, offres: [] };
    g.offres.push(o);
    groupes.set(o.porteurId, g);
  }
  return [...groupes.values()];
}

/** L'état de la BARRE de l'actif (#2898) — verdict UNIQUE, lu par la console et par l'hôte texte :
 *  • `spectatrice` — personne n'agit (pause de Round, combat clos), ou l'actif n'est pas piloté par ce siège
 *    (`controlsCombatant` : ennemi, Auto-combat, autre siège coop) ;
 *  • `tenue` — une surface partagée tient la main (`surfaceTientLaMain` : modale, fenêtre hors-modale qui se
 *    déclare `tientLaMain`, surface hors `pending*`) ;
 *  • `ouverte` — l'actif joue ses offres (`offresDeLActif`). */
export type EtatDeLaBarre =
  | { forme: 'ouverte'; active: Combatant; battle: BattleState }
  | { forme: 'spectatrice' | 'tenue'; raison: string };

export function etatDeLaBarre(s: Jeu): EtatDeLaBarre {
  const battle = s.battle;
  const active = battle && !battle.over ? activeCombatant(battle) : undefined;
  if (!battle || !active) return { forme: 'spectatrice', raison: t('barre.personneNAgit') };
  if (!controlsCombatant(s, active)) return { forme: 'spectatrice', raison: t('barre.nonPilote', { name: garanti(nomEnVue(s, active.id), active.id, 'nom de l’actif') }) };
  if (surfaceTientLaMain(s)) return { forme: 'tenue', raison: t('barre.mainTenue') };
  return { forme: 'ouverte', active, battle };
}

/** L'action d'INTERLUDE du ciblage COURANT : l'entrée `surface: 'interlude'` dont le `mode` est celui
 *  que rend l'aiguilleur (`currentTargetingMode`). C'est la SORTIE d'un ciblage par la carte — le
 *  bandeau de phase de la console la rend, la touche d'annulation ne prend que celles qui portent
 *  `exitSafe`. `undefined` = aucun interlude en cours (mode ordinaire : attaque, cast, soin…). */
export function currentInterludeAction(get: () => Jeu): ActionDef | undefined {
  const modeId = currentTargetingMode(get).id;
  return ACTIONS.find((a) => a.surface === 'interlude' && a.mode === modeId);
}
