/**
 * REGISTRE DES ACTIONS — le CODE derrière `src/data/actions.json` (spec HUD « Zone 12 »).
 *
 * Trois tables, trois responsabilités, aucune logique en JSON :
 *  - `ACTION_GATES`    — les PRÉDICATS d'offre, par id. Source UNIQUE : `CombatConsole` et `turnEconomy`
 *                        les consomment (ils en tenaient chacun une dérivation manuscrite, et la
 *                        divergence a déjà coûté un bug — Détermination, commit `0e14119b`).
 *  - `ACTION_CANDIDATES` — les SÉLECTEURS impurs (listes de cibles/objets), enveloppes NOMMÉES des
 *                        fonctions existantes : aucune n'est réécrite ici.
 *  - `ACTION_RUN`      — les DISPATCHERS : une entrée par méthode `battle*` du store.
 *
 * `runAction(id, get, ctx)` est la porte unique : le clavier, la console et les pastilles y passent,
 * plus jamais par des closures anonymes publiées positionnellement.
 */
import type { Combatant } from '../engine/types';
import type { BattleState, Jeu } from './etat';
import { entityPickables } from './combatEffects';
import { objetDuNarratif } from './monde/resolveursDuNarratif';
import { currentTargetingMode } from './targetingModes';
import { canTakeAction, isOutOfAction, raisonRefusDetermination, raisonVerrouEtat, refusVerrouDAction } from '../engine/conditions';
import { isEngaged } from '../engine/engagement';
import { isFrenzied, isFrenzyCapable } from '../engine/psychology';
import { isVehicle, estNavire } from '../engine/coque';
import { compatibleAmmo, activeLoadout, isUnarmed } from '../engine/items';
import { aRecharger } from '../engine/weaponLoad';
import { canPushback } from '../engine/qualities/dispatch';
import { hasBattement, hasDistraire } from '../engine/combatFeatures/dispatch';
import { actorHasSkill, possesses } from '../engine/skills';
import { isConsumable } from '../engine/consumables';
import { hasFreeWeaponAttack, battementFoes, distraireFoes, availableAttacks, type AttackOption } from './combatManeuvers';
import { selfManeuversOf, selfManeuverApplicable } from '../engine/creatureAttacks';
import { inBattleId } from './monde/combatants';
import { wastesAction, endTurnArmed } from './endTurnGuard';
import { HEAL_SKILL, healableTargets } from '../engine/healing';
import { hasWaterContainer, waterSprayCandidates } from '../engine/suffocation';
import { canAidTeam } from './monde/commandTeam';
import { controlsCombatant } from './netOwnership';
import { surfaceTientLaMain } from './modalArbiter';
import { dispellableSpellsOn } from '../engine/dispel';
import { combatAdvantageSkills } from '../engine/skillCombatApps';
import { activeCombatant, placingZoneOf, STANCE_BLOCK } from './combatFlow';
import { canMove, mountablesNear, mountMovement } from './mount';
import { servablePostes, crewPosteOf, shipOfCrew, posteARecharger } from './monde/shipPostes';
import { chanteurDuNavire, quartChante } from './shipCrew';
import { type ShipPoste } from '../engine/types';
import { pushSlot } from './siegePush';
import { ACTIONS, findConditionById, findSpellById, type ActionDef } from '../data/index';
import { isArcaneSpell, castBlockedBy, focusSkillFor, focusWindLabel } from '../engine/magic';
import { t } from '../i18n';
import { aPorteeDe } from './monde/exploreNav';
import { postesPretsAFaireFeu } from './monde/shipBattery';

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
  netMode?: string;
  /** L'ENTRÉE évaluée, posée par `actionGate` à partir de l'entrée résolue : un gate y lit ce que
   *  l'action DÉCLARE (l'État qu'elle traite) au lieu de nommer un id. */
  def?: ActionDef;
  /** PARAMÈTRES DE LA CASE (`ActionRunCtx` — la Compétence visée, l'arme, l'objet) : une entrée du
   *  registre peut être rendue N fois, une par candidat, et le verdict d'offre porte alors sur CE
   *  candidat (« au plafond de CETTE méthode d'Avantage »). Les gates de règle pure les ignorent ; le
   *  dispatcher reçoit exactement les mêmes (`runAction`), d'où une seule et même mesure. */
  args?: ActionRunCtx;
  /** L'heure de jeu (`Jeu.gameTime`) : le quart de veille (`chanteur-disponible`) s'y lit. Chaque surface la
   *  prend à SON état. */
  gameTime: number;
}

/** Le gate qui désigne une entrée comme REMÈDE de l'État qu'elle déclare : deux lecteurs le nomment,
 *  la donnée (`actions.json`) et `remedesPertinents`. */
export const GATE_ETAT_PORTE = 'etat-porte';

const ok: ActionGate = { ok: true };
const no = (reason: string): ActionGate => ({ ok: false, reason });

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
  const refus = refusVerrouDAction(active);
  return refus ? no(refus) : ok;
}

/** Le porteur PEUT-il effectuer une Action (`canTakeAction`, `LDB 16 l.125`) ? Composé par `actionLibre`,
 *  et seul par l'entrée qui n'engage pas l'Action du Tour elle-même (`select-attack`). */
function peutAgir({ active }: ActionCtx): ActionGate {
  return canTakeAction(active) ? ok : no(t('agate.unableToAct'));
}

/** L'Action du Tour est-elle encore disponible ET utilisable ? Dépensée, impossible (`peutAgir`), ou
 *  verrouillée par un État (`horsVerrouDEtat`). La Frénésie est un gate à part (`action-libre-hors-frenesie`). */
function actionLibre(ctx: ActionCtx): ActionGate {
  if (ctx.battle.acted) return no(t('agate.actionSpent'));
  const capable = peutAgir(ctx);
  return capable.ok ? horsVerrouDEtat(ctx) : capable;
}

/** Désengagement (LDB 15 l.45-49) : l'entrée porte les deux options. Celle d'Esquive exige l'Action (non
 *  dépensée, `peutAgir`) ; celle d'Avantage non (`freeDisengage`). Sa pertinence (être Engagé) est le gate `engage`. */
function desengagementGate(ctx: ActionCtx): ActionGate {
  const esquive = ctx.battle.acted ? no(t('agate.actionSpentNoFreeDisengage')) : peutAgir(ctx);
  if (esquive.ok) return ok;
  return freeDisengage(ctx) ? ok : esquive;
}

/** Le désengagement est-il GRATUIT ? Avantage strictement supérieur à TOUS les foes Engagés encore
 *  en jeu (LDB 15 l.45-49, « Utiliser l'Avantage »). Prédicat PARTAGÉ (barre + économie du tour). */
export function freeDisengage({ active, battle }: ActionCtx): boolean {
  if (!isEngaged(active)) return false;
  const foes = (active.engagedWith ?? [])
    .map((id) => inBattleId(battle, id))
    .filter((c): c is Combatant => !!c && !isOutOfAction(c));
  return foes.length > 0 && active.advantage > Math.max(0, ...foes.map((f) => f.advantage));
}

/** Le Mouvement du Tour est-il ENCORE INTACT ? Prédicat PARTAGÉ (gestes qui exigent l'élan complet). */
function mouvementIntact({ active, battle }: ActionCtx): ActionGate {
  // Un porteur qu'un État CLOUE (`gating.movement: 'none'` — Inconscient, Surpris ; LDB 16 l.113/l.132)
  // n'a aucun Mouvement à dépenser : le geste qui en coûte se REFUSE en le disant, au lieu de laisser
  // le dispatcher rendre en silence. Le budget est celui de la monture s'il en a une (`mountMovement`).
  if (mountMovement(battle, active) <= 0) return no(t('agate.cannotMove'));
  return battle.movementUsed > 0 ? no(t('agate.movementStarted')) : ok;
}

/** L'acteur a-t-il un CORPS de fantassin ? Une coque n'en a pas (`engine/vehicle.ts` : « ni arme
 *  tenue, ni sort, ni marche de fantassin ») : les gestes du corps — marcher, courir, se mettre sur
 *  la défensive — ne lui sont pas offerts, et le refus le DIT au lieu de dépenser son Action. Un
 *  navire agit par ses Tests d'équipage et sa barre. */
function fantassin({ active }: ActionCtx): ActionGate {
  return isVehicle(active) ? no(t('agate.hullHasNoBody')) : ok;
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
export const ACTION_GATES: Record<string, (ctx: ActionCtx) => ActionGate> = {
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
  /** MIROIR de la garde de `cancelMove` (`combatSlice.ts:976-980`) : le segment restaurable est le
   *  SNAPSHOT, pas le compteur — `battleStandUp` écrit `movementUsed` sans en poser un, et le
   *  dispatcher n'aurait rien à défaire. Le contrôle du siège n'entre pas ici (il est au dispatcher
   *  et aux contextes de surface : `live` pour la console, `cur` pour la touche). */
  'deplacement-annulable': ({ battle }) => {
    if (!battle.moveSnapshot || (battle.movementUsed ?? 0) === 0) return no(t('agate.noMoveToUndo'));
    return battle.acted ? no(t('agate.actionSpent')) : ok;
  },
  /** Charge — fiche `regles/charger` (`LDB 15 l.35-37`), foyer du verbatim au Codex. */
  'charge-possible': (ctx) => (isEngaged(ctx.active) ? no(t('agate.alreadyEngaged')) : mouvementIntact(ctx)),
  'mouvement-restant': ({ active, battle }) => (canMove(battle, active) ? ok : no(t('agate.noMovementLeft'))),
  desengagement: desengagementGate,
  // Deux refus, un seul gate : plus de point en réserve, OU un État que rien ne lève (le fait porteur
  // le déclare — LDB 20 l.188 ; source unique `raisonRefusDetermination`). `conditionId` absent (dépenses
  // Psychologie/Critique de LDB 17 l.59-60) : seule la réserve compte.
  'determination-en-reserve': ({ active, args }) => {
    if ((active.resolve ?? 0) <= 0) return no(t('agate.noResolve'));
    const refus = args?.conditionId ? raisonRefusDetermination(active, args.conditionId) : undefined;
    return refus ? no(refus) : ok;
  },
  'attaque-libre-frenesie': ({ active }) =>
    hasFreeWeaponAttack(active) ? ok : no(t('agate.noFreeWeaponAttack')),
  'pietinement-gratuit': ({ active, battle }) =>
    availableAttacks(active, battle).some((o) => o.freeKind === 'pietinement') ? ok : no(t('agate.noTrample')),
  'set-commutable': ({ active, battle }) =>
    (active.loadouts?.length ?? 0) < 2
      ? no(t('agate.singleLoadout'))
      : battle.loadoutSwapped
        ? no(t('agate.loadoutSwapped'))
        : ok,
  /** PERTINENCE d'un remède : le porteur a l'État que l'entrée déclare. */
  [GATE_ETAT_PORTE]: (ctx) => (instanceDeLEtat(ctx) ? ok : no(t('agate.stateNotCarried'))),
  /** REMÈDE ATTEIGNABLE : le porteur n'est pas hors d'état d'agir (`isOutOfAction`, lu aussi par
   *  `battleStandUp`), et l'instance de l'État n'est pas VERROUILLÉE — verrou de type (`etats.json`),
   *  d'instance, ou acte de soin attendu. Ce verrou (`raisonVerrouEtat`) est l'invariant que les deux
   *  dispatchers de remède partagent avec cette case. `LDB 18 l.15`. */
  'remede-atteignable': (ctx) => {
    const inst = instanceDeLEtat(ctx);
    if (!inst) return no(t('agate.stateNotCarried'));
    if (isOutOfAction(ctx.active)) return no(t('agate.unableToAct'));
    const verrou = raisonVerrouEtat(inst, ctx.active);
    return verrou ? no(verrou) : ok;
  },
  /** L'État se retire-t-il par un TEST ? Prérequis du dispatcher `battleRecoverState` (`EtatData.recover`),
   *  pas une propriété du remède : un remède-GESTE ne le porte pas. */
  'etat-recuperable-par-test': (ctx) =>
    findConditionById(etatDeclare(ctx.def))?.recover ? ok : no(t('agate.stateNoRecoverTest')),
  /** Cumuler l'Avantage (LDB 09 l.305-308) : chaque méthode a SON plafond (`skillAdvantageCap`), et
   *  au plafond le Test ne peut plus rien rendre. Le refus est DIT (« Avantage au plafond (N) ») et la
   *  case reste dessinée : la faire disparaître privait le joueur de la raison. La méthode visée vient
   *  des ARGS de la case — les mêmes que le dispatcher `battleGainAdvantage` reçoit. */
  'avantage-sous-plafond': (ctx) =>
    et(ACTION_GATES['action-libre-hors-frenesie'], ({ active, args }) => {
      const methode = combatAdvantageSkills(active).find((s) => s.skillId === args?.skillId);
      return methode && active.advantage >= methode.cap
        ? no(t('agate.advantageCapped', { n: methode.cap }))
        : ok;
    })(ctx),
  /** Postures de tir (spec §1a G5) — PRÉDICATS UNIQUES de `combatFlow`, partagés avec le store
   *  (`battleToggleStance`), le versement dans le pending et la fenêtre de jet. Le refus est celui
   *  du prédicat : la raison appartient à `STANCE_BLOCK`, jamais au gate. */
  'tir-immobile-armable': ({ active, battle }) => {
    const refus = STANCE_BLOCK.heldGround(battle, active);
    return refus ? no(refus) : ok;
  },
  'tir-dans-le-tas-armable': ({ active, battle }) => {
    const refus = STANCE_BLOCK.intoCrowd(battle, active);
    return refus ? no(refus) : ok;
  },
  /** Battement (`LDB 10 l.103` · `AA 13 l.11-17` · `LDB 13 l.114`) : la case porte le prédicat du
   *  dispatcher (`battementFoes`, `combatManeuvers.ts`) — offerte si et seulement si `battleBattement`
   *  a un adversaire à traiter, sinon refusée AVEC sa raison. */
  'battement-cible-eligible': ({ active, battle }) =>
    battementFoes(active, battle).length > 0 ? ok : no(t('agate.noBattementTarget')),
  /** Distraire (`LDB 10 l.364` · `AA 13 l.46-51`) : même prédicat que le dispatcher (`distraireFoes`) —
   *  offerte si et seulement si `battleDistraire` a un adversaire à traiter. */
  'distraire-cible-eligible': ({ active, battle }) =>
    distraireFoes(active, battle).length > 0 ? ok : no(t('agate.noDistraireTarget')),
  /** Focalisation (`LDB 46` — fiche `regles/focalisation-etendue`) : le SORT visé vient des ARGS de
   *  l'alvéole (le geste secondaire de la case d'un sort), et le verdict porte donc sur CE sort.
   *  MÊMES prédicats que le dispatcher `battleFocusSpell` (`isArcaneSpell`, `castBlockedBy`) et que
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
  // ── PRÉALABLES DE DISPATCHER : le prédicat même que lit le dispatcher, pour que l'offre refuse ce qu'il refuse.
  /** L'arme de la case (`args.weaponUid`), ou à défaut l'une des armes du porteur, a un cycle de charge à faire
   *  (`aRecharger`, lu par `battleReload`). */
  'arme-a-recharger': ({ active, args }) => {
    const armes = args?.weaponUid ? active.weapons.filter((w) => w.uid === args.weaponUid) : active.weapons;
    return armes.some((w) => aRecharger(active, w)) ? ok : no(t('agate.nothingToReload'));
  },
  /** Chant de marin (MDG 09 l.32-40) : le quart n'a pas eu sa chanson (`quartChante`) et un chanteur est libre
   *  (`chanteurDuNavire`) — les prédicats de `battleSingShanty`. */
  'chanteur-disponible': ({ active, battle, gameTime }) => {
    if (quartChante(active, gameTime)) return no(t('agate.shantyQuartSung'));
    return chanteurDuNavire(active, battle) ? ok : no(t('agate.noShantySinger'));
  },
  /** La pièce de la case (`args.posteUid`) est déchargée et son chef libre ce Round (`posteARecharger`, lu par
   *  `battleShipReload`). LDB 62 l.335. */
  'piece-dechargee': ({ active, battle, args }) => {
    const poste = active.postes?.find((p) => p.item.uid === args?.posteUid);
    return poste && posteARecharger(active, poste, battle) ? ok : no(t('agate.noPosteToReload'));
  },
  /** Une pièce du navire est prête à faire feu (`postesPretsAFaireFeu`, lu par `battleShipBattery` via `batteryBlock`). */
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
  /** La barre : le BARREUR la tient (`shipOfCrew`), et la COQUE elle-même (`battleShipManeuver` accepte l'un ou l'autre). */
  'a-la-barre': ({ active, battle }) =>
    (estNavire(active) || shipOfCrew(battle.combatants, active.id) ? ok : no(t('agate.notAtHelm'))),
  navire: ({ active }) => (estNavire(active) ? ok : no(t('agate.notAVessel'))),
  vehicule: ({ active }) => (isVehicle(active) ? ok : no(t('agate.notAVehicle'))),
  /** La pause de début de Round (`LDB 17 l.25`) : personne n'agit encore (`turn: -1`, `enterRoundStartPause`). */
  'pause-de-round': ({ battle }) => (battle.turn < 0 ? ok : no(t('agate.notRoundStart'))),
};

/** Les gates de PERTINENCE (#2911) : une entrée dont l'un refuse n'a pas lieu d'être pour ce porteur, et
 *  `offresDeLActif` ne l'offre pas ; tout autre refus FERME l'offre en gardant sa raison. */
export const GATES_DE_PERTINENCE: ReadonlySet<string> = new Set([
  'fantassin', 'set-de-melee', 'tireur', 'arme-de-repousse', 'engage', 'battement-connu', 'distraire-connu',
  'frenesie-possible', 'equipe-a-aider', 'monte', 'pas-deja-en-joue', 'poste-servi', 'a-la-barre', 'navire', 'vehicule', 'pause-de-round', GATE_ETAT_PORTE,
]);

/** Les armes à distance du porteur — population du sélecteur `armes-a-distance` et du gate `tireur`. */
function armesADistance(active: Combatant) {
  return active.weapons.filter((w) => w.type === 'ranged');
}

/** Le set au poing ouvre-t-il un corps à corps ? Arme de mêlée DU set, ou set MAINS NUES (`LDB 15 l.35-37`,
 *  `LDB 13 l.90`). Sans set (statbloc de créature), l'arsenal réel, Mains nues écartées (`isUnarmed`). */
function setDeMelee(active: Combatant): boolean {
  const set = activeLoadout(active);
  const armes = set
    ? [set.main, set.off].flatMap((uid) => active.weapons.filter((w) => !!uid && w.uid === uid))
    : active.weapons.filter((w) => !isUnarmed(w));
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
  const inconnu = noms.find((g) => !ACTION_GATES[g]);
  if (inconnu) return no(`gate inconnu : ${inconnu}`);
  return et(...noms.map((g) => ACTION_GATES[g]))({ ...ctx, def });
}

/** Contexte des sélecteurs : impurs par nature (ils lisent le combat, parfois la scène). */
export interface ActionSelectorCtx extends ActionCtx {
  state?: Jeu;
  /** Arme visée quand le sélecteur dépend d'une arme précise (munitions compatibles). */
  weaponUid?: string;
}

/** Les SÉLECTEURS de candidats, par id (`candidates` de `actions.json`) — enveloppes nommées des
 *  fonctions déjà écrites (la liste manuscrite de l'IA n'a plus lieu d'être). */
export const ACTION_CANDIDATES: Record<string, (ctx: ActionSelectorCtx) => unknown[]> = {
  'montures-adjacentes': ({ active, battle }) => mountablesNear(battle, active),
  'pieces-servables': ({ active, battle }) => servablePostes(active, battle.combatants),
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
  'cibles-soin': ({ active, battle }) =>
    possesses(active, HEAL_SKILL)
      ? healableTargets(active, battle.combatants.filter((c) => c.kind === active.kind), { adjacency: true })
      : [],
  'cibles-aspersion': ({ active, battle }) =>
    hasWaterContainer(active) ? waterSprayCandidates(active, battle.combatants.filter((c) => c.kind === active.kind)) : [],
  /** Dissiper est un Test de Langue (Magick) (`LDB 46 l.158-162`) : sans elle, rien n'est dissipable par ce porteur. */
  'sorts-dissipables': ({ active, battle }) =>
    actorHasSkill(active, 'langue', 'magick') ? dispellableSpellsOn(battle.combatants) : [],
  /** Méthodes d'Avantage POSSÉDÉES (dédupliquées par Compétence : un Savoir groupé = une case). Le
   *  PLAFOND ne filtre plus ici : il est le verdict d'offre `avantage-sous-plafond`, qui laisse la case
   *  dessinée fermée avec sa raison — une seule source, jamais un filtre muet doublé d'un gate. */
  'competences-avantage': ({ active }) =>
    [...new Map(combatAdvantageSkills(active).map((s) => [s.skillId, s])).values()],
  /** Attaques de TRAIT qui ARMENT le clic (`select-attack`) et attaques de ZONE immédiates (`maneuver-area`) :
   *  l'attaque d'ARME est le geste du conduit (`attaque`), jamais une case de la grille. Le tri se lit au
   *  discriminant `kind` et au `targeting` de `AttackOption`. */
  'attaques-de-trait': ({ active, battle }) => availableAttacks(active, battle).filter((a) => a.kind !== 'arme' && a.targeting !== 'zone'),
  'attaques-de-zone': ({ active, battle }) => availableAttacks(active, battle).filter((a) => a.kind !== 'arme' && a.targeting === 'zone'),
  'sorts-du-heros': ({ active }) => active.spells ?? [],
  /** Les États PORTÉS : la réserve de Détermination est le verdict d'offre (`determination-en-reserve`), qui dit son refus. */
  'etats-retirables': ({ active }) => active.conditions,
  consommables: ({ active }) => (active.items ?? []).filter(isConsumable),
  'armes-a-distance': ({ active }) => armesADistance(active),
  /** Les armes à distance qui ont un cycle de charge (`reload`) : c'est l'arme que `battleReload` recharge. */
  'armes-a-recharge': ({ active }) => armesADistance(active).filter((w) => (w.reload ?? 0) > 0),
  /** Les munitions compatibles de l'arme visée, ou de chaque arme à distance quand aucune n'est visée. */
  'munitions-compatibles': ({ active, weaponUid }) => {
    const visee = active.weapons.find((x) => x.uid === weaponUid);
    return (visee ? [visee] : armesADistance(active)).flatMap((w) => compatibleAmmo(active, w));
  },
  'manoeuvres-sur-soi': ({ active }) => selfManeuversOf(active).filter((m) => selfManeuverApplicable(active, m)),
  'sets-d-armes': ({ active }) => active.loadouts ?? [],
  'objets-au-sol': ({ active, state }) => {
    if (!state || !active.pos) return [];
    const flags = state.flags ?? {};
    return (state.scene?.entities ?? [])
      // La portée se lit à la SOURCE UNIQUE (`exploreNav.aPorteeDe`, étage compris) : ce que l'alvéole
      // propose de ramasser est exactement ce que `battlePickup` acceptera.
      .filter((e) => e.kind === 'prop' && aPorteeDe(active.pos!, e))
      // L'ÉPUISEMENT n'est plus une garde séparée : `entityPickables` ne rend que les feuilles des
      // actions ENCORE jouables (`actionsAuthorees` filtre les drapeaux), donc un décor épuisé sort
      // avec zéro candidat sans qu'une seconde garde ait à redire la même chose.
      .flatMap((e) => entityPickables(e, flags, objetDuNarratif(state.campaignNarratif)).map((p) => ({ entityId: e.id, ...p })));
  },
};

/** L'IDENTITÉ DÉCLARÉE d'un candidat : QUI le PORTE (`porteurId` — une entité du champ pour une
 *  pastille, l'objet paramètre d'une alvéole pour un geste secondaire), les PARAMÈTRES que son
 *  dispatcher attend, et le nom du candidat quand un même porteur en offre plusieurs (deux pièces
 *  d'une coque, deux objets d'un tas). */
export interface ActionPorteur {
  porteurId: string;
  args: ActionRunCtx;
  /** Nom du CANDIDAT (pas de l'action) — porté par le panneau-paramètre quand le porteur en offre N. */
  label?: string;
}

/** Les PORTEURS, par id de SÉLECTEUR (`candidates`) : une enveloppe NOMMÉE par sélecteur, qui traduit
 *  SON candidat en identité + arguments de dispatch. Même patron qu'`ACTION_RUN` (une entrée = une
 *  forme, jamais un aiguillage par type de candidat écrit dans une surface). C'est ce qui remplace la
 *  DEVINETTE d'identité (`o?.id ?? o?.uid`) : le registre la DÉCLARE, les deux surfaces qui offrent
 *  des candidats (pastilles du champ, gestes secondaires de la console) la LISENT. Toute action dont
 *  la surface offre par candidat doit avoir la sienne — garde `action-atteignabilite`. */
export const ACTION_PORTEURS: Record<string, (candidat: unknown) => ActionPorteur | null> = {
  'montures-adjacentes': (c) => {
    const m = c as Combatant;
    return { porteurId: m.id, args: { targetId: m.id } };
  },
  'pieces-servables': (c) => {
    const sp = c as { hull: Combatant; poste: ShipPoste };
    return { porteurId: sp.hull.id, args: { shipId: sp.hull.id, posteUid: sp.poste.item.uid }, label: sp.poste.item.label };
  },
  'piece-poussable': (c) => {
    const sp = c as { hull: Combatant; poste: ShipPoste };
    return { porteurId: sp.hull.id, args: {}, label: sp.poste.item.label };
  },
  'objets-au-sol': (c) => {
    const o = c as { entityId: string; key: string; label: string };
    return { porteurId: o.entityId, args: { entityId: o.entityId, pickKey: o.key }, label: o.label };
  },
  /** Un SORT du héros — le candidat EST son id (`Combatant.spells: string[]`) : c'est lui que porte
   *  l'alvéole du sort, et lui que le geste secondaire de Focalisation paramètre. */
  'sorts-du-heros': (c) => {
    const id = c as string;
    return { porteurId: id, args: { spellId: id } };
  },
  /** Une ARME à distance : son `uid` porte le candidat (l'alvéole de recharge en est paramétrée). */
  'armes-a-distance': porteurDArme,
  'armes-a-recharge': porteurDArme,
  /** Une ATTAQUE de trait : son id porte le candidat, et c'est lui que `battleSelectAttack` arme. */
  'attaques-de-trait': (c) => {
    const a = c as AttackOption;
    return { porteurId: a.id, args: { attackId: a.id }, label: a.label };
  },
  /** Une attaque de ZONE : `battleManeuverArea` la résout par son `kind`. */
  'attaques-de-zone': (c) => {
    const a = c as AttackOption;
    return { porteurId: a.id, args: { attackKind: a.kind }, label: a.label };
  },
};

function porteurDArme(c: unknown): ActionPorteur {
  const w = c as { uid: string; label?: string };
  return { porteurId: w.uid, args: { weaponUid: w.uid }, label: w.label };
}

/** Ce que l'acte prend dans l'économie du tour, en toutes lettres — la donnée `cost` du registre, dite
 *  à l'endroit du geste (spec HUD zone 4 : « coût de l'Action affiché »). `null` = rien à annoncer. */
export function actionCostLabel(def: ActionDef): string | null {
  return def.coutAction === 'aucun' ? null : t(`acost.${def.coutAction}`);
}

/** Paramètres d'exécution — l'action nomme SA cible ; jamais une closure qui la capture. */
export interface ActionRunCtx {
  targetId?: string;
  weaponUid?: string;
  ammoUid?: string;
  spellId?: string;
  casterId?: string;
  skillId?: string;
  itemUid?: string;
  loadoutId?: string;
  conditionId?: string;
  maneuverId?: string;
  attackId?: string;
  attackKind?: string;
  entityId?: string;
  pickKey?: string;
  /** COQUE visée (`hullId`) — bordée, chant, rechargement de pièce, service d'un poste. */
  shipId?: string;
  /** MEMBRE D'ÉQUIPAGE qui agit sur la coque (`battleShipManeuver(crewId)`, `noyau/combatSlice.ts`) : c'est le
   *  barreur, pas le navire. Deux champs parce que ce sont deux entités — un seul mentait. */
  crewId?: string;
  posteUid?: string;
  crewTestId?: string;
  /** Bascule d'un mode ARMÉ : `true` = désarmer (re-clic sur la même case). */
  toggleOff?: boolean;
}

type Dispatcher = (get: () => Jeu, ctx: ActionRunCtx, def: ActionDef) => void;

/** Les DISPATCHERS, par id (`run` de `actions.json`) : une entrée = une méthode du store. */
export const ACTION_RUN: Record<string, Dispatcher> = {
  battleSelectAction: (get, ctx, def) =>
    get().battleSelectAction(
      (ctx.toggleOff ? null : (def.armed ?? null)) as Parameters<Jeu['battleSelectAction']>[0],
    ),
  battleSelectAttack: (get, ctx) => get().battleSelectAttack(ctx.attackId ?? 'arme'),
  battleManeuverArea: (get, ctx) =>
    get().battleManeuverArea(ctx.attackKind as Parameters<Jeu['battleManeuverArea']>[0]),
  battleAim: (get) => get().battleAim(),
  battleReload: (get, ctx) => get().battleReload(ctx.weaponUid),
  battleSelectAmmo: (get, ctx) => { if (ctx.ammoUid) get().battleSelectAmmo(ctx.ammoUid, ctx.weaponUid); },
  battleTogglePushback: (get) => get().battleTogglePushback(),
  battleToggleStance: (get, _ctx, def) => { if (def.stance) get().battleToggleStance(def.stance); },
  battleWater: (get, ctx) => get().battleWater(ctx.targetId),
  battleUseItem: (get, ctx) => { if (ctx.itemUid) get().battleUseItem(ctx.itemUid); },
  battleDefendTotal: (get) => get().battleDefendTotal(),
  battleDisengage: (get) => get().battleDisengage(),
  /** L'alvéole d'un sort ARME le mode d'incantation sur CE sort (`armed`) : le re-clic le désarme,
   *  comme toute case à mode armé — annulation gratuite, rien n'est engagé avant le clic-cible. */
  battleSelectSpell: (get, ctx) => {
    if (ctx.toggleOff) { get().battleSelectAction(null); return; }
    if (ctx.spellId) get().battleSelectSpell(ctx.spellId);
  },
  battleFocusSpell: (get, ctx) => { if (ctx.spellId) get().battleFocusSpell(ctx.spellId); },
  battleDispelSpell: (get, ctx) => { if (ctx.spellId && ctx.casterId) get().battleDispelSpell(ctx.spellId, ctx.casterId); },
  battleGainAdvantage: (get, ctx) => { if (ctx.skillId) get().battleGainAdvantage(ctx.skillId); },
  // L'État traité est celui que l'ENTRÉE déclare : aucun paramètre de case ne le porte.
  battleRecoverState: (get, _ctx, def) => get().battleRecoverState(etatDeclare(def)),
  battleStandUp: (get) => get().battleStandUp(),
  battleBattement: (get, ctx) => get().battleBattement(ctx.targetId),
  battleDistraire: (get, ctx) => get().battleDistraire(ctx.targetId),
  battleFrenzy: (get) => get().battleFrenzy(),
  battleSelfManeuver: (get, ctx) => { if (ctx.maneuverId) get().battleSelfManeuver(ctx.maneuverId); },
  battleResolvePsychImmune: (get) => get().battleResolvePsychImmune(),
  battleResolveIgnoreCrit: (get) => get().battleResolveIgnoreCrit(),
  battleSpendResolve: (get, ctx) => { if (ctx.conditionId) get().battleSpendResolve(ctx.conditionId); },
  battleMount: (get, ctx) => get().battleMount(ctx.targetId),
  battleDismount: (get) => get().battleDismount(),
  battleManPoste: (get, ctx) =>
    get().battleManPoste(ctx.shipId && ctx.posteUid ? { hullId: ctx.shipId, posteUid: ctx.posteUid } : undefined),
  battleLeavePoste: (get) => get().battleLeavePoste(),
  battlePushEngine: (get) => get().battlePushEngine(),
  battleAidTeam: (get) => get().battleAidTeam(),
  battlePickup: (get, ctx) => { if (ctx.entityId && ctx.pickKey) get().battlePickup(ctx.entityId, ctx.pickKey); },
  battleShipManeuver: (get, ctx) => { if (ctx.crewId) get().battleShipManeuver(ctx.crewId); },
  battleCrewTest: (get, ctx) => { if (ctx.shipId && ctx.crewTestId) get().battleCrewTest(ctx.shipId, ctx.crewTestId); },
  battleSingShanty: (get, ctx) => { if (ctx.shipId) get().battleSingShanty(ctx.shipId); },
  battleShipReload: (get, ctx) => { if (ctx.shipId && ctx.posteUid) get().battleShipReload(ctx.shipId, ctx.posteUid); },
  battleSwitchLoadout: (get, ctx) => { if (ctx.loadoutId) get().battleSwitchLoadout(ctx.loadoutId); },
  /** FIN DU TOUR — porte unique de la plaque de sortie de la console ET de la touche. Le garde-fou
   *  « tour gâché » (spec §1c-bis COIN) est la POLITIQUE DE CETTE ENTRÉE : finir avec l'Action intacte
   *  ARME (empreinte de l'économie du tour, répliquée), le geste suivant passe la main. `battleEndTurn`
   *  reste le verbe BRUT (l'IA et les flux internes passent, eux, par `advanceTurn`). */
  battleEndTurn: (get) => {
    const s = get();
    const b = s.battle;
    const active = b ? activeCombatant(b) : undefined;
    if (b && active && wastesAction(active, b, s.pendingCleave) && !endTurnArmed(b)) { s.armEndTurn(); return; }
    s.battleEndTurn();
  },
  cancelMove: (get) => get().cancelMove(),
  /** PORTE UNIQUE de la pause d'initiative (LDB 17 l.25) : le bandeau de phase de la console ET la
   *  touche du registre (`keybindings.round-start`) passent ICI. Solo, le geste OUVRE le Round ; en
   *  réseau, il ne fait que marquer le siège PRÊT — c'est le quorum (`roundStartReady`, sièges requis)
   *  qui lance, jamais un client. Deux branchements séparés laissaient le bouton court-circuiter le
   *  ready-check que la touche, elle, respectait. */
  roundStart: (get) => {
    const s = get();
    if (s.net.mode === 'local') { s.confirmRoundStart(); return; }
    if (!s.pendingRoundStart?.readyBySeat?.[s.net.mySeat]) s.roundStartReady();
  },
  /** Demande de pause au prochain Round — INTERRUPTEUR : `toggleOff` retire la demande (annulation
   *  gratuite, `lowerHand`), même porte et même routage réseau que la pose. */
  raiseHand: (get, ctx) => (ctx.toggleOff ? get().lowerHand() : get().raiseHand()),
  // ── SORTIES D'INTERLUDE (`surface: 'interlude'`) : une enveloppe NOMMÉE par entrée, jamais un
  //    dispatcher mutualisé — deux interludes ne partagent ni leur verbe ni ses gardes (`cleaveEnd`
  //    clôt l'étape-jet de la cascade, `battleSelectAction` est avalé sous `combatBusy`).
  cleaveEnd: (get) => get().cleaveEnd(),
  dualStrikeSkip: (get) => get().dualStrikeSkip(),
  castPickTargetsOff: (get) => get().castPickTargets(false),
  /** Sortie du placeur de zone, ROUTÉE PAR LA SOURCE que mesure `placingZoneOf` — symétrique de
   *  `commitPlacedZone` (même aiguilleur pour poser et pour renoncer) : un sort revient à sa modale,
   *  un pilonnage referme son placeur. Une seule entrée d'interlude pour le mode `placing-zone`. */
  placingZoneOff: (get) => {
    const pz = placingZoneOf(get());
    if (!pz) return;
    switch (pz.source) {
      case 'cast': get().castPlaceZone(false); return;
      case 'siege': get().siegeAimCancel(); return;
      default: pz.source satisfies never;
    }
  },
  batterySelectNone: (get) => get().battleSelectAction(null),
  /** Téléportation (`combatFlow.ts:5381` : `action: 'teleport'` + `reachable` = `flyReachable` depuis
   *  la case du lanceur, qui contient donc SA case au coût 0, `path.ts:318`) : la sortie de l'interlude
   *  est un ARRIVAGE sur place — le même commit que le clic-sol, par la même porte. */
  teleportStay: (get) => {
    const battle = get().battle;
    const active = battle && activeCombatant(battle);
    if (active?.pos) get().battleClickTile({ ...active.pos });
  },
};

/** Exécute une action par son ID. Porte UNIQUE — le clavier, les cases et les pastilles y passent.
 *  Une action déclarée `blocked` (aucun dispatcher) ne fait rien : le registre le DIT, il ne feint pas.
 *  Une action qui déclare une INTENTION (`intent`) arme d'abord le mode local qui peint sa portée
 *  (`localIntent.ts`, spec zone 4) : c'est le clic du champ, ensuite, qui commet le geste. Les deux
 *  ne s'excluent pas — l'attaque arme son option ET affiche sa portée. */
export function runAction(actionId: string, get: () => Jeu, ctx: ActionRunCtx = {}): void {
  const def = ACTIONS.find((a) => a.id === actionId);
  if (!def) return;
  if (def.intent) get().battleArmIntent(ctx.toggleOff ? null : def.id);
  if (def.run) ACTION_RUN[def.run]?.(get, ctx, def);
}

/** La forme ACTION de la porte `runAction` (#2898), pour un hôte qui joue en intentions : `jouerLOffre`. */
export function creerActionsDuRegistre(get: () => Jeu) {
  return {
    jouerLOffre: (actionId: string, ctx?: ActionRunCtx) => runAction(actionId, get, ctx),
  };
}

/** UNE offre : de quoi la peindre (libellé, icône, coût), la refuser avec sa raison (`gate`), et la
 *  commettre par la porte unique du registre (`actionId` + `args`). */
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
  icon: string;
  /** Coût dans l'économie du tour, en toutes lettres — `null` quand l'acte n'en prend aucun. */
  cost: string | null;
  args: ActionRunCtx;
  gate: ActionGate;
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
 *    évalué sur les arguments mêmes du dispatch (« au plafond de CETTE méthode »).
 *  • Une entrée dont le sélecteur ne rend aucun candidat n'offre rien.
 *  • Toute autre entrée est UNE offre, sans argument, au verdict d'`actionGate`.
 * Une offre fermée reste une offre (`gate.ok === false`), et sa surface la montre avec sa raison (loi du refus
 * visible, arbitrage 2026-08-19). Des entrées d'interlude, seule compte la sortie du ciblage courant
 * (`currentInterludeAction`), quand `ctx.state` est posé.
 */
export function offresDeLActif(ctx: ActionSelectorCtx): Offre[] {
  const etat = ctx.state;
  const interlude = etat ? currentInterludeAction(() => etat) : undefined;
  const offre = (def: ActionDef, args: ActionRunCtx, p?: ActionPorteur): Offre => ({
    actionId: def.id, def, label: def.label, ...(p ? { porteurId: p.porteurId, candidat: p.label } : {}),
    icon: def.icon, cost: actionCostLabel(def), args, gate: actionGate(def.id, { ...ctx, args }),
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

/** L'offre que des ARGUMENTS de dispatch désignent : celle de l'entrée `actionId` dont chaque argument est repris par
 *  `args`. Une offre par candidat se reconnaît à ses arguments (le sort, l'arme, l'attaque) ; une offre unique, sans
 *  argument, à son seul id. La console y reconnaît ses cases, l'hôte texte le geste qu'il joue. */
export function offreDesignee(offres: readonly Offre[], actionId: string, args: ActionRunCtx = {}): Offre | undefined {
  const voulus = args as Record<string, unknown>;
  return offres.find((o) => o.actionId === actionId && Object.entries(o.args).every(([k, v]) => voulus[k] === v));
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
  if (!controlsCombatant(s, active)) return { forme: 'spectatrice', raison: t('barre.nonPilote', { name: active.label }) };
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

/** Modes ARMABLES de `battle.action`, DÉRIVÉS du registre (`armed`) + les modes qui n'appartiennent
 *  à aucune action de barre, déclarés ici avec leur porteur (garde de parité :
 *  `src/state/action-atteignabilite.test.ts`). */
export const MODES_HORS_REGISTRE = {
  /** Armé par la RÉSOLUTION d'un sort de Téléportation (case d'arrivée), jamais par une case. */
  teleport: 'sort de Téléportation (combatFlow)',
} as const;

/** Union des valeurs légales de `BattleState.action` — le type raconte le registre. */
export type BattleActionMode =
  | 'cast'
  | 'heal'
  | 'dispel'
  | 'battery'
  | 'push'
  | keyof typeof MODES_HORS_REGISTRE;

/** Les MÊMES valeurs, énumérables à l'exécution — la garde `action-atteignabilite` vérifie qu'elles
 *  couvrent EXACTEMENT les `armed` du registre + `MODES_HORS_REGISTRE` (union validée, pas dérivée :
 *  un JSON importé n'a pas de type littéral). */
export const BATTLE_ACTION_MODES: readonly BattleActionMode[] = [
  'cast', 'heal', 'dispel', 'battery', 'push', 'teleport',
];
