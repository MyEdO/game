/**
 * Tranche « combat » du store (Zustand) — `createCombatSlice(get, set)` renvoie les ACTIONS de
 * combat inline (battleClick*, attaque/défense/cascade, désengagement, monture, fin de tour, Destin,
 * magie de combat, etc.) qui vivaient dans l'objet du `create` de `store.ts`. Elles sont déplacées
 * VERBATIM (mêmes corps, mêmes `get()/set()`, mêmes imports d'origine) et spreadées EN TÊTE du store :
 *   `create<GameState>((set, get) => ({ ...createCombatSlice(get, set), ...reste, ...état }))`.
 * L'ÉTAT reste assemblé dans le `create` (forme à plat unique) ; cette tranche n'expose que des
 * ACTIONS. Surface IDENTIQUE : aucune clé ajoutée/retirée/renommée. Pas de value-import de `store.ts`
 * (les actions ne référencent jamais `useGame`) → import de TYPE seulement, aucun cycle d'exécution.
 */
import type { Get, Set } from './flowTypes';
import { tickCombatAuto } from './combatAuto';
import type { GameState, BattleState, ShootingStanceKey } from './store';
import type { BattleActionMode } from './actionRegistry';
import type { PendingDefense, CounterParticipant, CounterDeclaration, SuiteDeCoup } from './pendings';
import { fleeBackstab, fleeCalme, fleeNeedCalme } from './pendings';
import { SceneEntity, structureIsDown } from './scene';
import * as travelFlow from './travelFlow';
import { continueRestNights } from './restFlow';
import { continueRiverDayAfterCascade, continueRiverDayAfterExposure } from './riverVoyageFlow';
import { Combatant, HitLocation, CHAR_LABELS, type FireArc, type Weapon } from '../engine/types';
import { rollLine, hostStep, openSequence, pushHost, pushDisplay } from './rollSeam';
import { creatureAttacks, type AttackKind } from '../engine/creatureAttacks';
import { battleRng } from './battleRng';
import { defenseDodgeMod, activeCombatant, STANCE_BLOCK, moveEnv, removeEntity, entityPickables, cleFeuilleRamassee, applyEffects, openSkillTest, applyIncomingMeleeAdvantage, firedWeapon, resolveAttack, openAttackCascade, disengageOutcome, startDisengage, completeFlee, startAuContact, startGrapple, resolveGrappleWin, auContactEligible, applyAttackResult, applyShieldReaction, openSurfacedDefense, castSpell, applyCast, castContextMods, applyZoneCrossings, effectiveSpellOf, finishPlayerAction, applyMiscast, useSpellComponent, checkBattleOver, applyCriticalToTarget, resumeEnemyTurn, advanceTurn, resolveRoundBoundary, enterRoundStartPause, runPreemptShots, inFiringBand, maybeRunEnemyTurn, resumeSuspendedAI, resumeManeuverDefense, aiDriven, attackerFumbled, defenderFumbled, applyOups, jouerLaSuiteDuCoup, cleaveTargets, dualStrikeTargets, resolveDualSecond, overcastTargetCandidates, drainerLesGratuites, resolveFreeAttacks, trampleTarget, TRAMPLE_WEAPON, trampleFreeMove, aiOvercastPlan, hasFreeWeaponAttack, attackWeaponOf, applyWail, resolveManeuver, spellSightOf, castZoneSpell, castCommitZone, zoneRadiusTilesAt, routeCounterspell, applyCounterspellOutcome, applyCounterspellFallback, counterspellChanted, counterspellJoinable, counterspellDeclarePhase, counterspellRolls, castRefused, resumeAfterCounterspell, openCastOppositionStep, castExtraTargets, resolveCastChain, openRoundStartPsych, displaceSmaller, applySurprise, resolveMovement, fearedSourceTowards, markActed, noteApproachMove, clearApproachMoves, frenzyTarget, rollInitiative, handleConditionGained, routeTriggeredTest, freeAttackHookImpl, setFreeAttackHook, applyFocusInterruption, setFocusInterruptHook, applyBladeTrap, setBladeTrapHook, setZoneCrossTestHook, zoneCrossTestHookImpl, fireTurnStartTriggers, resolveActGates, finishCombatEnd, resolveWeaponArea, areaTargets, battleAreaTargets, siegeBlastRadiusTiles, availableAttacks, aiWouldPrepareSpell, startBattement, startDistraire, resolveBattement, resolveDistraire, battementFoes, distraireFoes, selfManeuversOf, selfManeuverApplicable, startleOnStormAtCombatStart, stampEnvWeatherAtCombatStart, windsOfMagicAtCombatStart, releaseSeatsOfCombatants } from './combatFlow';
import { hasBattement, hasDistraire } from '../engine/combatFeatures/dispatch';
import { losClear } from './lineOfSight';
import { smokeOf, captureMoveSnapshot } from './combatGeometry';
import { discreetPrayerDifficulty } from '../engine/prayer';
import { setTriggeredTestRouter, fireOwnTestFailed } from './triggeredEffects';
import { emitCombatEvent } from './combatEvents';
import { turnEconomyStamp } from './endTurnGuard';
import { EMPTY_FLOW, flowEffects, type Flow } from './flow';
import { pickActiveModalKey } from './modalArbiter';
import { mountMovement, mountUp, dismount, mountOf, mountablesNear, isControlledMount, insertByInitiative } from './mount';
import { heroCombatMount } from '../engine/mountTravel';
import { ev, evLines } from './combatLog';
import { viewYawDeg } from './stageYaw';
import { chargeArmee, courseArmee } from './localIntent';
import { refuserGeste } from './refusVisible';
import { nePeutPasDifferer } from './combatEffects';
import type { MovementBlockReason } from './combatFlow';
import { t, type MsgKey } from '../i18n';
import { combatValue, rollMeleeDefender, rollDisengageAttack, rollGrappleForce, backstabWeapon, attackHandGate, type DefenseMode } from '../engine/combat';
import { disengageFrom, isEngaged, setContact, clearContact, meleeReachRank } from '../engine/engagement';
import { areGrappling, clearGrapple } from '../engine/grapple';
import { applyOps } from '../engine/ops';
import { groupAdvantage, mirrorPools } from '../engine/advantagePool';
import { campGain, campSpend, startAdvantagePools } from './combat/advantagePool';
import { skillAdvantageCap } from '../engine/skillCombatApps';
import { byId } from '../data/index';
import { rule } from '../engine/policy';
import { resolveMagicMissile, resolveCasting, isArcaneSpell, isMagicMissile, castBlockedBy, spellTargetCount, overcastSL, castAfterCrit, defaultCritChoice, castInfo, castInfoIsPrayer, focusCriticalDR, dispelOwnSpellDR, consumeMalepierre, malepierreItemOf } from '../engine/magic';
import { domainSeaFocusCritMiscastMajeure } from '../engine/domainAttributes';
import { type OvercastAxis, overcastSourceOf, overcastAxes, extraTargetCapacity, overcastDurationParts, overcastBudget } from '../engine/overcast';
import { resolveOpposed, extendedTestStep } from '../engine/tests';
import { dispellableSpellsOn, dissipateSpell } from '../engine/dispel';
import { effectiveChar, bonus } from '../engine/characteristics';
import { isFrenzyCapable, isFrenzied, spendResolveForPsychImmunity, animositeOrHaine } from '../engine/psychology';
import { weaponLoaded, reloadProgressOf } from '../engine/weaponLoad';
import { recomputeLoadout, itemFromGive, loadedAmmo, loadWeapon, unloadWeapon, setReloadProgress, setAmmoChoice, consumeAmmo, loadoutSetActive, loadoutLabel, mannedPosteWeapon, autoStowNewItem } from '../engine/items';
import { trappingById } from './campaignData';
import { canPushback, canStrikeFirst, reloadDRTarget } from '../engine/qualities/dispatch';
import { talentFearIndice, canPreemptRanged, reloadDRBonus, reloadGrantsAssessAdvantage, hasCommandTeam, retreatAdvantageCost, keptAdvantageOnDisengage, hasFocusHarmony } from '../engine/combatFeatures/dispatch';
import { teamCommandTargets } from './commandTeam';
import { isConsumable } from '../engine/consumables';
import { battleConsumeItem, runConsumable } from './consumableFlow';
import { effectiveMovement } from '../engine/encumbrance';
import { isOutOfAction, addCondition, removeCondition, hasCondition, canTakeAction, isActionLocked, stacks, recoveredStacks, COND, setConditionGainedHook, releaseConditionLocks, raisonRefusDetermination, fenetreDetermination, syncDerivedConditions, isConditionLocked, soinDeDetermination } from '../engine/conditions';
import { hasHealSkill, availableHealModes, resolveWoundsHeal, resolveBleedHeal, resolveExtractLodgedAmmo, healDifficulty, applyHealWounds, type HealMode } from '../engine/healing';
import { hasWaterContainer, waterSprayCandidates } from '../engine/suffocation';
import { treatTrauma, receiveMedicalAid, poseDeterminationCanceller } from '../engine/trauma';
import { suspendSource } from '../engine/suspension';
import { persistentConditions } from '../engine/persistence';
import { testValue, actorHasSkill, soutienDetail } from '../engine/skills';
import { rollOups } from '../engine/oups';
import { spawnEnemy, placeCombatant } from './spawn';
import { ficheDEntite } from './sceneNpc';
import { applyShipPostes, autoFormCrews, servingCrewPresent, shipOfCrew, servablePostes, serveAtPoste, leaveChef, isPosteManned } from './shipPostes';
import { posteHullOf, pushEligible, pushCrewOk, pushReachable } from './siegePush';
import { applyShipManeuver, maneuverCrewTotal, deriveManeuverFromCrew } from './shipManeuver';
import { crewTestContributors, shipCrewAssignments, shipMoraleScore, shipUndercrew, shipSaboteurDR, applyShipMoraleDelta, applyShantyToCrew, quartIndex, withCrewActed } from './shipCrew';
import { resolveSteamSave, continueSeaDayAfterCascade, continueSeaDayAfterScorbut, continueSeaDayAfterExposure, continueSeaDayAfterExhaustion, runSeaDay, finalizePortArrival } from './seaVoyageFlow';
import { continueSeaActivitiesAfterCascade } from './seaActivities';
import { resolveCrewTestByRoles, rudeEpreuveMoraleDelta, crewTestSuccess, capToSuccesMinime } from '../engine/crewMorale';
import { knownShanties } from '../engine/combatFeatures/dispatch';
import { findSeaShantyById, conditionLabel, libelleOuAbsence } from '../data';
import { findCrewTestTypeById, findCrewRoleById, findVehicleById, findStructureById, combatStakeRef } from '../data';
import { structureCombatant } from '../engine/structures';
import { targetArc, headingToBear } from './fireArc';
import { facingToward } from './dir8';
import { bearingPostes, mostArmedSide } from './shipBattery';
import { resolveVolley } from '../engine/volley';
import type { ShipManeuverParticipant } from './pendings';
import { isVehicle } from '../engine/vehicle';
import { navalTestTypeDR, hullNavalTraits } from '../engine/navalTraits';
import { crewedFireWeapon, crewedReloadStep } from '../engine/crewedWeapon';
import { exposedCrew } from '../engine/shipCritical';
import { sceneZonesToBattle } from './zones';
import { resetFields } from './stateFields';
import { seaMagicContext, windsMagicModOf } from './combatOrParty';
import { actorIn, inBattleId, garanti } from './combatants';
import { aPorteeDe } from './exploreNav';
import { controlsCombatant, defenseSurfaced, influencesLocally, quorumAtteint } from './netOwnership';
import { nextCursorTile, nextCaseCursorTile, tileModeValidTiles, cursorCommitIntent, type ScreenDir } from './combatCursor';
import { cycleTarget, cyclePrevTarget, cursorActor } from './targeting';
import { batteryBlock, currentTargetingMode, type BattleClickOpts, type TileClickOpts } from './targetingModes';
import { resolveRecoverTest } from './combat/recover';
import { resolveRenounce } from './corruptionFlow';
import { toMoney } from '../engine/money';
import { distributeCredit } from './bourseFlow';
import type {
  ConjureForm,
} from '../engine/conjuredWeapons';
import { findSpellById } from '../data/index';
import { reachable, moveReachFor, chebyshev, Pt } from './path';
import { combatDistance } from './footprint';
import { combatOrder } from './combatSetup';
import { isMerScene, sceneMetresPerTile } from './scene';
import { bus, EVT } from './bus';
import { advanceCascade, resolveRemainingCascade, finalizeCascade, setCascadeChoice, setCascadeAmount, rollCascadeTable, setCascadeTableForcedRoll, rollCascadeDe, setCascadeDeForcedRoll, suspendActiveCascade, resumeSuspendedCascade, setOwnTestFailedEmitter, poserCurseurCascade } from './cascade';
import { pursuitAbandon } from './pursuitFlow';
import { closeSequenceRound } from './sequenceCore';
import { checkPartyWiped } from './partyWipe';
import { FLOWS } from './rollFlowSpecs';
import { actionsAuthorees } from './usable';

/** Un flux DIFFÉRÉ tient la main (modale de jet/révélation, ciblage par carte : Frappe Mortelle,
 *  2ᵉ frappe, Surincantation +Cible, pose de zone) :
 *  toutes les actions d'INTENTION de la hotbar sont inertes — on ne change pas d'action au milieu
 *  d'un jet. La console masque ses cases, mais ce garde-fou couvre AUSSI le clavier, les
 *  intents coop et la recette. (La PAUSE de début de Round, elle, est gatée à l'entrée UI —
 *  performClick d'IsoStage — pour rester neutre vis-à-vis des harnais de test sans UI.) */
const combatBusy = (s: Pick<GameState, 'pendingCleave' | 'pendingDualStrike' | 'pendingCast'>): boolean =>
  !!(pickActiveModalKey(s as never) || s.pendingCleave || s.pendingDualStrike || s.pendingCast);

/** Animosité & Haine (ADE II Annexe I « Troubles psychologiques », règle facultative `psych-acquisition-optional`) :
 *  un héros qui DÉPENSE le Destin « pour rester en vie » effectue un Test de Calme Intermédiaire (+0) ; échec →
 *  Animosité envers « l'individu ou l'élément qui l'a presque tué » (Cible = son Groupe/nom), ou HAINE si une
 *  Animosité de même Cible existe déjà. Mute `hero.psychTraits` (l'APPLICATION que le noyau pur `animositeOrHaine`
 *  laisse à la couche state) et renvoie la ligne de journal (null : règle éteinte / Cible inconnue / Calme réussi). */
function acquireAnimositeOnFate(hero: Combatant, foeCible: string | undefined): string | null {
  if (!foeCible) return null;
  const res = animositeOrHaine(hero, foeCible, battleRng());
  if (!res?.trait) return null;
  if (res.replacesAnimosite) hero.psychTraits = (hero.psychTraits ?? []).filter((p) => !(p.type === 'animosite' && p.cible === foeCible));
  hero.psychTraits = [...(hero.psychTraits ?? []), res.trait];
  return res.trait.type === 'haine'
    ? `${hero.label} voue désormais une Haine à ${foeCible} (frôler la mort a durci son cœur).`
    : `${hero.label} développe une Animosité envers ${foeCible} (frôler la mort a laissé une marque).`;
}

/** OUVERTURE partagée d'un Test d'équipage MULTI (MDG 14) : contributeurs par rôle (`crewTestContributors` —
 *  UN jet par poste, PJ interactifs, l.9/39/41), Moral, Manque de bras (l.55) et SABOTAGE (l.45-47) dérivés du
 *  navire. SOURCE UNIQUE des 3 flux jumeaux (manœuvre / bordée / Test d'équipage générique) — le pending
 *  appelant y ajoute ses champs propres (turnSteps, targetId+side, testTypeId). `null` si aucun rôle tenu. */
function openCrewTestPending(get: Get, ship: Combatant, testTypeId: string): {
  participants: ShipManeuverParticipant[];
  essentialRoleId?: string;
  moraleScore: number;
  undercrew: ReturnType<typeof shipUndercrew>;
  extraDR?: number;
} | null {
  const battle = get().battle;
  if (!battle) return null;
  const partyIds = new Set(get().party.map((h) => h.id));
  const contributors = crewTestContributors(ship, battle.combatants, testTypeId, partyIds);
  if (!contributors.length) return null;
  const essentialRoleId = findCrewTestTypeById(testTypeId)?.essential;
  const participants: ShipManeuverParticipant[] = contributors.map((a) => ({
    id: a.crew.id,
    label: `${findCrewRoleById(a.roleId)?.label ?? a.roleId} — ${a.crew.label}${(battle.crewActed?.[ship.id] ?? []).includes(a.crew.id) ? ' −2 (cumul)' : ''}`,
    interactive: partyIds.has(a.crew.id),
    roleId: a.roleId,
    essential: a.roleId === essentialRoleId,
    cumul: (battle.crewActed?.[ship.id] ?? []).includes(a.crew.id), // déjà engagé dans un Test ce Round → cumul +2 crans (l.53)
    result: null,
  }));
  const saboteur = shipSaboteurDR(ship); // MDG 14 l.45-47 : −1..−5 DR plats
  // #221 : Traits/Améliorations navals ciblant CE type de Test d'équipage (op `skillDRBonus` à `testType`).
  const traits = hullNavalTraits(ship);
  const extraDR = saboteur + navalTestTypeDR(traits, testTypeId);
  return {
    participants, essentialRoleId,
    moraleScore: shipMoraleScore(get, ship),
    undercrew: shipUndercrew(get, ship, battle.combatants),
    ...(extraDR ? { extraDR } : {}),
  };
}

/** Ligne de journal des SERVANTS d'une bordée (MDG 14 l.39 — l'équipage s'exprime, jamais un poste muet) : un PJ
 *  tenant le rôle d'Artilleur DIRIGE la batterie (nominé, l.9) ; sinon l'équipage ABSTRAIT du bord fait feu (couche
 *  Mer, l.39). PUR (lit les assignations de rôle du navire pour ce Test). */
function bordeeGunnersLine(get: Get, ship: Combatant, side: FireArc): string {
  const battle = get().battle;
  const partyIds = new Set(get().party.map((h) => h.id));
  const chief = battle
    ? shipCrewAssignments(ship, battle.combatants, 'batterie').find((a) => a.roleId === 'artilleur' && partyIds.has(a.crew.id))?.crew
    : undefined;
  return chief
    ? t('cs.bordeeGunnersChief', { chief: chief.label, side, ship: ship.label })
    : t('cs.bordeeGunnersCrew', { side, ship: ship.label });
}

/**
 * APPLIQUE une bordée résolue (mutation) — corps PARTAGÉ par le confirm JOUEUR (`shipBatteryConfirm`, DR issu de la
 * modale des Artilleurs) ET l'auto-pilote NAVIRE (`shipAutoBattery`, DR issu du Test d'équipage headless). Un SEUL
 * chemin de dégâts : `resolveVolley` (munition + sous-effectif + Dégâts + Critiques, mêmes fns pures que le tir
 * individuel), Blessures sur la coque, Critiques de navire sur double, effets `onHit` et AIRE (Éclats), Recharge +
 * consommation de munition. `success` = le Test d'équipage a-t-il réussi (`crewTestSuccess`, MDG 14 l.13) : raté, les
 * pièces font feu et se déchargent mais la bordée MANQUE (aucun Dégât, aucun Critique, aucun effet `onHit`/d'AIRE).
 * Journalise les servants (l.39) puis la bordée. NE touche PAS au pending ni à `crewActed`
 * (propres à chaque appelant). Renvoie le nombre de pièces qui ont fait feu.
 */
function applyBatteryVolley(get: Get, set: Set, ship: Combatant, target: Combatant, side: FireArc, dr: number, success: boolean): number {
  const battle = get().battle;
  if (!battle) return 0;
  const merScale = isMerScene(get().scene);
  const postes = bearingPostes(ship, side);
  const rig = findVehicleById(target.creatureId ?? '')?.hull?.rig ?? 'mixte';
  const crew = (ship.crewIds ?? []).map((id) => inBattleId(battle, id)).filter((c): c is Combatant => !!c);
  const volley = resolveVolley(ship, postes, target, rig, dr, success, crew, battleRng(), { merScale }); // couche Mer : équipage abstrait sert les pièces
  target.wounds.current = Math.max(0, target.wounds.current - volley.totalWounds); // mute la coque (pattern combat)
  const critLines: string[] = [];
  const targetCrew = (target.crewIds ?? []).map((id) => inBattleId(battle, id)).filter((c): c is Combatant => !!c);
  const distTiles = ship.pos && target.pos ? chebyshev(ship.pos, target.pos) : 0;
  if (success) for (const s of volley.shots) {
    if (s.critical) applyCriticalToTarget(target, 'corps', true, 0, critLines, set, { ctx: { attackerId: ship.id, attackerKind: ship.kind, weapon: s.weaponName }, get });
    if (s.wounds > 0) emitCombatEvent('onHit', { get, set, battle, self: ship, sink: (line) => critLines.push(line), triggerCtx: { victim: target, weapon: s.weapon, woundsDealt: s.wounds, location: 'corps', attackType: 'ranged', rng: battleRng() } });
    const area = resolveWeaponArea(get, set,
      { attacker: ship, primaryTarget: target, weapon: s.weapon, damage: s.damage, location: 'corps', distanceTiles: distTiles },
      areaTargets(battle.combatants, sceneMetresPerTile(get().scene), () => targetCrew), battleRng());
    critLines.push(...area.lines);
  }
  for (const s of volley.shots) { // HORS du garde `success` : une bordée MANQUÉE a quand même fait feu (l.128)
    const poste = ship.postes?.find((pp) => pp.item.uid === s.posteUid);
    if (poste) unloadWeapon(undefined, undefined, poste); // couture UNIQUE : la PIÈCE a fait feu (le chef, lui, n'a pas tiré SON arme)
    const chef = poste?.crewIds?.[0] ? inBattleId(battle, poste.crewIds![0]) : undefined;
    if (chef && s.ammo) consumeAmmo(chef, s.ammo);
  }
  get().log(bordeeGunnersLine(get, ship, side)); // les servants s'expriment (l.39)
  get().log(success
    ? t('cs.bordee', { side, ship: ship.label, target: target.label, dr: dr >= 0 ? `+${dr}` : `${dr}`, n: volley.shots.length, wounds: volley.totalWounds, cur: target.wounds.current, max: target.wounds.max })
    : t('cs.bordeeManque', { side, ship: ship.label, target: target.label, dr: dr >= 0 ? `+${dr}` : `${dr}`, n: volley.shots.length }));
  for (const l of critLines) get().log(l);
  return volley.shots.length;
}

/**
 * SURPRISE NAVALE (couche Mer) traduite en AVANTAGE DE POSITION — PAS de tour gratuit (une coque n'a ni Action ni
 * psychologie ; l'État Surpris LDB 16 ne s'y transpose pas → arbitrage sobre, maison). L'assaillant NON repéré a eu le
 * temps de se PLACER : chaque coque ambusher se rapproche à ~portée MOYENNE du canon (75 m, MDG 12 l.401) de sa
 * cible et vire pour amener son bord le plus armé EN BATTERIE. Repérés (Perception réussie, `noSurprise`) → non appelée :
 * placement authoré (~150 m, aucun avantage). Mute pos + facing.
 */
function applyNavalSurprisePosition(get: Get, set: Set, surprisedSide: 'party' | 'enemies'): void {
  const { battle, scene } = get();
  if (!battle || !scene) return;
  const surprisedKind = surprisedSide === 'party' ? 'hero' : 'enemy';
  const ambushers = battle.combatants.filter((c) => isVehicle(c) && c.kind !== surprisedKind && c.pos);
  const victims = battle.combatants.filter((c) => isVehicle(c) && c.kind === surprisedKind && c.pos);
  if (!ambushers.length || !victims.length) return;
  const mpt = sceneMetresPerTile(scene);
  const gap = Math.max(1, Math.round(75 / mpt)); // ~portée moyenne du canon (MDG 12 l.401)
  const facing = { ...get().facing };
  const { w, h } = scene.dimensions;
  for (const amb of ambushers) {
    const victim = victims.reduce((a, b) => (chebyshev(amb.pos!, b.pos!) < chebyshev(amb.pos!, a.pos!) ? b : a));
    // Rapprochement le long de l'axe ambusher→victime, arrêt à ~`gap` cases (jamais plus près, jamais hors bornes).
    const dx = Math.sign(victim.pos!.x - amb.pos!.x), dy = Math.sign(victim.pos!.y - amb.pos!.y);
    let nx = amb.pos!.x, ny = amb.pos!.y;
    while (chebyshev({ x: nx + dx, y: ny + dy }, victim.pos!) >= gap
      && nx + dx >= 0 && ny + dy >= 0 && nx + dx < w && ny + dy < h) { nx += dx; ny += dy; }
    if (nx !== amb.pos!.x || ny !== amb.pos!.y) placeCombatant(amb, scene, { x: nx, y: ny });
    // Bord le plus armé DÉJÀ aligné en batterie sur la victime (l'assaillant a choisi son bord d'attaque).
    const primary = mostArmedSide(amb);
    if (primary) facing[amb.id] = headingToBear(primary, facingToward(amb.pos!, victim.pos!));
    battle.log.push(ev('detail', t('cs.navalSurprise', { ship: amb.label, target: victim.label }), amb.id));
  }
  set({ facing, battle: { ...battle } });
}

/** Avance l'étape-jet d'attaque/Piétinement de la cascade combat à la FIN de la chaîne (plus de
 *  `pendingAttack`/`pendingTrample` NI d'enchaînement balayage/dual) → conséquences inline (Coup Critique
 *  foldé) ou reprise. La cascade reste ouverte pendant la chaîne ; on n'avance qu'au bout. Partagé par
 *  attackConfirm / trampleConfirm / cleaveEnd / dualStrikeSkip (zéro duplication).
 *  L'étape 'defense' est admise pour l'INTERPOSITION de défense surfacée (#989) : le curseur y passe à
 *  l'ouverture de la fenêtre, et l'application de l'attaque (reprise d'`attackConfirm`) l'enchaîne au bout. */
function advanceCombatJet(get: () => GameState): void {
  const seq = get().pendingCascade;
  const jet = seq?.purpose === 'combat' ? seq.participants[seq.cursor]?.jet : undefined;
  if ((jet === 'attack' || jet === 'trample' || jet === 'defense')
    && !get().pendingAttack && !get().pendingTrample && !get().pendingCleave && !get().pendingDualStrike && !get().pendingDefense) get().cascadeNext();
}

/** Arme de PARADE réellement employée par le défenseur (uid choisi, sinon main principale) — l'Oups !
 *  et la Réaction de Porte-Bouclier portent sur ELLE (quelle arme casse), jamais sur `weapons[0]` par défaut. */
function parryWeaponOf(defender: Combatant, pd: PendingDefense): Weapon | undefined {
  return (pd.parryWeaponUid ? defender.weapons.find((w) => w.uid === pd.parryWeaponUid) : undefined) ?? defender.weapons[0];
}

/** Maladresse du DÉFENSEUR (sa défense ratée sur un double, LDB 14 l.13) → étape Oups! de SA cascade
 *  combat (donnée SUR l'étape), SANS déclencher la Frénésie de l'attaquant. SOURCE UNIQUE des DEUX chemins
 *  de défense (réactif ET interposé) : même garde, même ordre (APRÈS l'application de l'attaque). Le droit
 *  à l'étape suit le SURFAÇAGE de la défense (`defenseSurfaced` — celui qui a JOUÉ la défense joue son
 *  Oups!), pas l'affordance locale. Substitution sociale : ce n'est pas un Test d'arme → aucune Maladresse.
 *  Renvoie true si l'étape a été poussée (l'appelant place son curseur). */
function pushDefenderFumble(get: Get, set: Set, defender: Combatant, pd: PendingDefense): boolean {
  const parry = parryWeaponOf(defender, pd);
  if (!pd.result || !parry || pd.mode === 'social' || isOutOfAction(defender)) return false;
  if (!defenseSurfaced(get(), defender) || !defenderFumbled(pd.result, parry, defender)) return false;
  pushHost(get, set, { id: `cons-fumble-${defender.id}`, kind: 'fumbleJet', jet: 'fumble', actorId: defender.id, fumble: { weapon: parry, result: null } });
  return true;
}

/** Applique l'issue d'« Au Contact » (LDB 62 l.176) : pose/retire l'état au contact selon le choix du
 *  vainqueur (`'contact'`/`'normal'`, ou `null` = égalité → statu quo), CONSOMME l'Action (le Test
 *  opposé EST l'Action) et ferme la modale. Pas de jet ici — pose une relation symétrique. */
function applyAuContact(get: Get, set: Set, mover: Combatant, foe: Combatant, choice: 'normal' | 'contact' | null): void {
  const battle = get().battle!;
  if (choice === 'contact') setContact(mover, foe);
  else if (choice === 'normal') clearContact(mover, foe);
  const key = choice === 'contact' ? 'cs.auContactClose' : choice === 'normal' ? 'cs.auContactNormal' : 'cs.auContactTie';
  const b = markActed(get, set, battle); // scellé AVANT la copie du journal (le déclencheur y pousse ses lignes)
  const log = [...b.log, ev('attack', t(key, { name: mover.label, foe: foe.label }), mover.id, foe.id)];
  set({ pendingAuContact: null, battle: { ...b, action: null, log } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** Applique le CHOIX du vainqueur d'un Test opposé d'Empoignade gagné (LDB 14 l.161) côté JOUEUR : délègue
 *  l'issue au cœur PARTAGÉ `resolveGrappleWin` (`damage` = BF+DR PA ignorés / `entangle` / `free`, tout en
 *  DONNÉE) puis ferme le pending. Le Test opposé EST l'Action → `acted`. `dr` = DR net du Test (→ `ctx.sl`). */
function applyGrapple(get: Get, set: Set, actor: Combatant, foe: Combatant, mode: 'damage' | 'entangle' | 'free', dr: number, forceRoll: number): void {
  const battle = get().battle!;
  // Application 100% en DONNÉE, PARTAGÉE avec le résolveur IA (`resolveGrappleWin`) : une SEULE voie d'issue,
  // deux orchestrations (cette modale joueur / instantané IA). Le flux n'orchestre ICI que la fermeture du pending.
  const line = resolveGrappleWin(actor, foe, mode, dr, forceRoll);
  set({ pendingGrapple: null, battle: { ...markActed(get, set, battle), action: null, log: [...battle.log, ev('attack', line, actor.id, foe.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
}

/**
 * Rangées d'une fenêtre MULTI que le siège local peut jouer et qui n'ont pas de jet : chacune jette.
 * SOCLE des verbes NULLAIRES du drive d'auto-cadence (#1030 — `STEP_WINDOW_AUTO`, `combatAuto.ts`, qui
 * n'enchaîne que des verbes sans argument alors que ces fenêtres sont par-`pid`). Une SEULE table de
 * possession (`influencesLocally`, #1005 : celle qui décide déjà de l'affordance de la rangée dans
 * `CastModal`), un seul parcours pour toutes les fenêtres réactives de l'incantation.
 */
function rollAllOwnedRows(
  s: GameState,
  rows: readonly { id: string; interactive?: boolean; result: unknown }[] | undefined,
  roll: (id: string) => void,
): void {
  for (const p of rows ?? []) if (!p.result && p.interactive && influencesLocally(s, p.id)) roll(p.id);
}

/** Ce qu'un clic-sol REFUSÉ dit au joueur, par raison du résolveur (`resolveMovement`). Les raisons
 *  ABSENTES sont des verrous structurels (pas de combat/scène, ciblage armé, tour d'un autre joueur,
 *  Engagement — routé vers le Désengagement avant d'arriver ici) : elles ne répondent à aucun geste, et
 *  ne disent donc rien. */
const REFUS_DEPLACEMENT: Partial<Record<MovementBlockReason, MsgKey>> = {
  'out-of-range': 'cs.refusCaseHorsPortee',
  'movement-spent': 'cs.refusMouvementEpuise',
  'no-path': 'cs.refusAucunChemin',
};

/**
 * « Retirez un État » par Détermination (LDB 17 l.61) — SOURCE UNIQUE des DEUX dépenses (l'actif du tour,
 * un porteur par id). Rend `false` quand la dépense n'a RIEN levé : le point n'est alors pas débité.
 *
 * Un État PORTÉ par un canal passif (`derivedFrom`) ne se retire pas à la main : le fait le reposerait
 * aussitôt. On SUSPEND donc la SOURCE qui le porte (`suspendSource`, le même applier que la Racine de
 * terre — LDB 72 l.28), le temps de la fenêtre que l'op PORTEUSE déclare (`fenetreDetermination`,
 * `ResolveWindow` en donnée ; défaut LDB 16 l.117) ; la réconciliation retire l'État, et l'expiration
 * de la fenêtre le repose. Aucune famille d'entité n'est nommée ici.
 *
 * Le pion peut être PARTAGÉ avec une cause native (KO à 0 PB — LDB 16 l.115) : ce que la suspension n'a
 * pas emporté, le retrait de LDB 17 l.61 l'emporte.
 * Le seul REFUS est celui que la donnée déclare (`raisonRefusDetermination`), ÉVALUÉ D'ABORD : rien
 * n'est soigné ni débité sur une dépense refusée. `soigne` = les Blessures que `EtatData.resolveHeals`
 * déclare (LDB 17 l.61), rendues AVANT le retrait — c'est ce soin qui lève le verrou d'À Terre
 * (LDB 18 l.15). La dépense est ATOMIQUE : retrait non acquis, le soin est repris.
 */
function retireEtatParDetermination(c: Combatant, conditionName: string, now: number): { retire: boolean; soigne: number } {
  if (raisonRefusDetermination(c, conditionName)) return { retire: false, soigne: 0 };
  const avant = stacks(c, conditionName);
  const soigne = soinDeDetermination(c, conditionName);
  if (soigne > 0) applyHealWounds(c, soigne, { skillCheck: false, wake: false, log: () => [] });
  const src = c.conditions.find((x) => x.id === conditionName)?.derivedFrom?.src;
  const fenetre = src ? fenetreDetermination(c, conditionName, now) : undefined;
  if (src && fenetre) {
    // GRANULAIRE (#1695) : « Retirez un État » (LDB 17 l.61) — une source qui en porte PLUSIEURS
    // (Transmutation de Chamon : Aveuglé, Assourdi, Sonné) ne perd que celui que la dépense vise.
    suspendSource(c, src, fenetre, 'Détermination (conscience)', determinationWindowId(conditionName), conditionName);
    syncDerivedConditions(c);
  }
  if (stacks(c, conditionName) >= avant) removeCondition(c, conditionName, 1); // « Retirez un État » (un pion), LDB 17 l.61
  const retire = stacks(c, conditionName) < avant;
  // ATOMICITÉ : le point n'est pas débité quand rien n'est levé (appelants) — le soin ne doit pas rester
  // non plus. Reste ici le retrait qu'un PLANCHER de pions dérivés refuse (`retireEtat`).
  if (!retire && soigne > 0) {
    c.wounds.current -= soigne;
    syncDerivedConditions(c);
  }
  return { retire, soigne: retire ? soigne : 0 };
}

/** `effectId` de la fenêtre ci-dessus — PRÉFIXE commun, que les lecteurs retrouvent par ce nom. */
export const DETERMINATION_CONSCIENCE_ID = 'determination-conscience';

/** IDENTITÉ d'une fenêtre de Détermination : une par ÉTAT visé (#1695). Une nouvelle dépense sur le MÊME
 *  État REMPLACE la sienne ; deux dépenses sur deux États d'une même source (LDB 17 l.61, « Retirez un
 *  État » par point) ouvrent DEUX fenêtres — la seconde n'écrase plus la première. */
export const determinationWindowId = (conditionId: string): string => `${DETERMINATION_CONSCIENCE_ID}:${conditionId}`;

/** Actions de combat inline du store — déplacées VERBATIM. Spreadées EN TÊTE du `create`. */
export function createCombatSlice(get: Get, set: Set) {
  // Câble le déclencheur `onGainCondition` (Mâchoires d'acier…) : le moteur `addCondition` est PUR
  // (hook injecté) ; la logique vit dans la brique feuille `combat/triggeredTest`, get/set liés ici.
  // Idem pour le ROUTEUR de Test des triggers (héros manuel → cascade ; sinon inline) — installé ICI
  // au RUNTIME (pas au top-level de la brique : `setTriggeredTestRouter` est en amont d'un cycle d'imports).
  setConditionGainedHook((c, name) => handleConditionGained(get, set, c, name));
  setTriggeredTestRouter(routeTriggeredTest);
  // Émetteur `onOwnTestFailed` du seam central `commitStep` (tests de cascade/entretien ratés → Crampes) —
  // injecté au runtime (inversion de dépendance, cf. `setOwnTestFailedEmitter`). Sous-Test FM inline.
  setOwnTestFailedEmitter((g, actor, sl) => fireOwnTestFailed(g, actor, { sl, rng: battleRng() })); // RNG SEEDABLE (battleRng, jamais defaultRNG) — determinisme + coop
  // Hook `grantFreeAttack` (op IMPURE) : pont exécuteur de Flow → vraie frappe — `runCombatFlow` l'appelle
  // sur le `do`/`grantFreeAttack` (Frappe réactive / Assaut féroce / Frénésie). Inversion de dépendance.
  setFreeAttackHook(freeAttackHookImpl);
  // Hook `interruptFocus` (op IMPURE) : conséquence d'un Test de Calme d'interruption de Focalisation RATÉ
  // (perte des DR + Imparfaite Mineure, LDB 46 l.144) — appelée par `runCombatFlow` sur le `do`/`interruptFocus`.
  setFocusInterruptHook(applyFocusInterruption);
  // Hook `breakBlade` (op IMPURE) : conséquence d'un Test opposé de Piège-lame GAGNÉ (désarme/brise la lame,
  // LDB 62 l.280) — appelée par `runCombatFlow` sur le `do`/`breakBlade`.
  setBladeTrapHook(applyBladeTrap);
  // Hook `crossTest` de zone (Forêt d'épines, LDB 48 l.749, #500) : traversée gatée par un Test —
  // délègue à `routeTriggeredTest` (héros manuel → cascade ; ennemi/auto → jet inline).
  setZoneCrossTestHook(zoneCrossTestHookImpl);
  // Clôture d'une cascade du JOUR de voyage (`purpose:'travelDay'`) : ROUTAGE par domaine — fluvial
  // (recalcul des km puis halte/arrivée) OU terrestre (marche forcée eager/nuit + halte/arrivée). Le
  // domaine se lit sur le plan (`river` présent = descente fluviale), pas par deux chemins ad hoc.
  // Partagé par `cascadeNext` (avance) et `cascadeFinish` (« Tout résoudre »).
  const dispatchCascadeDone = (done: ReturnType<typeof advanceCascade>) => {
    // Une cascade de NUIT/voyage (faim, exposition, maladie) a pu anéantir tout le groupe : défaite AVANT
    // de reprendre la route — no-op en combat (`combatEndBoundary` gère la défaite via `battle`).
    if (done && checkPartyWiped(get, set)) return;
    // `handled` : un dénouement a été joué (le filet `checkBattleOver` de fin ne se déclenche que pour
    // une clôture NON routée). Deux étages, dans l'ordre historique de la chaîne :
    //  (1) le dénouement de `purpose` — exclusif PAR CONSTRUCTION (une séquence porte UN `purpose`) ;
    //  (2) les BORNES portées par la séquence — CUMULATIVES depuis #942 L1 : deux fragments FUSIONNÉS
    //      (append de même `purpose`) apportent chacun sa borne ; une chaîne `else if` n'en jouait
    //      qu'UNE et affamait les autres (ex. `maneuverResume` mangé par `roundBoundary`).
    let handled = false;
    // Repos MULTI-JOURS (#347) : la nuit qui vient de se clore en enchaîne une AUTRE tant qu'il en
    // reste — AVANT le routage 'travel'/'travelHalt' (une nuit INTERMÉDIAIRE d'un séjour ne porte
    // jamais `travelHalt`, cf. `openRestNight` — seule la DERNIÈRE nuit peut le porter).
    if (done?.purpose === 'night' && done.restNights && done.restNights.nightsLeft > 0) { continueRestNights(get, set, done.restNights); handled = true; }
    else if (done?.purpose === 'travel' && done.travelHalt) { travelFlow.continueTravelAfterNight(get, set); handled = true; }
    else if (done?.purpose === 'travelDay') {
      handled = true;
      if (get().travelPlan?.river) continueRiverDayAfterCascade(get, set);
      // Mer : une « Fuite de vapeur » (pendingSteamSave) peut avoir suspendu la clôture DEPUIS l'applier
      // 'progression' (cascade fermée sans insert du reste du jour) — `resolveSteamSave` reprend la
      // journée lui-même à sa résolution ; ne pas clôturer prématurément ici.
      else if (get().travelPlan?.sea) { if (!get().pendingSteamSave) continueSeaDayAfterCascade(get, set); }
      else travelFlow.continueTravelDayAfterCascade(get, set, done);
    }
    // Exposition hydrique fluviale (MSRC 16) surfacée APRÈS le jour (#344) : la clôture reprend la fin du
    // jour (halte de nuit / arrivée), DIFFÉRÉE le temps du Test de Résistance — sinon le Repos et l'Exposition
    // se court-circuitent et la journée suivante ne se ré-arme jamais (patron du sibling `seaScorbut`).
    else if (done?.purpose === 'riverExposure') { continueRiverDayAfterExposure(get, set); handled = true; }
    else if (done?.purpose === 'sequence') { closeSequenceRound(get, set, done); handled = true; } // manche de SÉQUENCE close → le socle résout puis rouvre/dénoue (state/sequenceCore)
    // Entretien-survie maritime surfacé au MJ (#272 résiduel, seam #275) : la clôture enchaîne la phase suivante de la journée.
    else if (done?.purpose === 'seaScorbut') { continueSeaDayAfterScorbut(get, set, done.participants); handled = true; }
    else if (done?.purpose === 'seaExposure') { continueSeaDayAfterExposure(get, set, done.participants); handled = true; }
    else if (done?.purpose === 'seaExhaustion') { continueSeaDayAfterExhaustion(get, set, done.participants); handled = true; }
    else if (done?.purpose === 'seaActivities') { continueSeaActivitiesAfterCascade(get, set); handled = true; } // Activités en mer (#273 Étape 2) → Commerce d'opportunité séquencé puis halte
    // Mini-cascade AUTONOME d'un événement de bord maritime (`purpose:'test'` : Cogue pirate, Ouragan,
    // Prière d'un Présage — `resolveSeaDayEvent` a mis le jour EN ATTENTE) : sa clôture REPREND la conduite
    // du jour. Couture GÉNÉRIQUE (toute la classe, pas seulement « fuir ») : ici `pendingCascade` est DÉJÀ
    // null (post-`advanceCascade`), sans garde de synchronisation. Gaté sur `travelPlan.sea` : à
    // l'accostage `travelPlan` est nul (la désertion `purpose:'test'`
    // a sa propre reprise `resolvePortArrival`) ; `runSeaDay` re-garde de son côté combat/steamSave.
    else if (done?.purpose === 'test' && get().travelPlan?.sea && !get().pendingSteamSave) { runSeaDay(get, set); handled = true; }
    // ── Étage 2 : BORNES portées par la séquence — plus une chaîne EXCLUSIVE (#942 L1) ──
    // Accostage à FINALISER à la clôture (désertion à la relâche surfacée, #387) : `travelPlan` est déjà nul
    // ici (l'arrivée l'a annulé) — la séquence porte sa continuation dans `portArrival`. Couture GÉNÉRALE
    // (la CLASSE « séquence dont la fermeture finalise une transition ») : `pendingCascade` est DÉJÀ null.
    // INDÉPENDANTE des trois bornes de combat ci-dessous : elle se joue TOUJOURS si présente.
    if (done?.portArrival) { finalizePortArrival(get, set, done.portArrival); handled = true; }
    // Fin de combat : l'écran de victoire/défaite prend la main. EXCLUSION MÉTIER déclarée avec les deux
    // bornes suivantes (jamais un accident de chaîne) — combat TERMINÉ ⇒ ni tour à reprendre, ni Round
    // suivant à ouvrir.
    if (done?.combatEndBoundary) { finishCombatEnd(get, set); handled = true; } // Tests de fin de combat clos → écran de victoire/défaite
    // PRÉCÉDENCE déclarée `maneuverResume` > `roundBoundary` (le défaut que corrige #942 L1 était l'inverse :
    // la borne de Round, première dans la chaîne, AFFAMAIT la reprise de tour d'une séquence FUSIONNÉE).
    // Les deux bornes ne sont PAS équivalentes : au franchissement, `advanceTurn` a DÉJÀ posé `{turn: 0, round}` et
    // joué les décomptes une-fois-par-Round (combatFlow.ts:5245-5246 → `resolveRoundBoundary` →
    // `openRoundEndCascade`) ; le `roundBoundary` de la séquence porte seulement `enterRoundStartPause`.
    // Lui céder la place SACRIFIE donc, pour le Round COURANT, la pause de début de Round et son reset
    // per-Round (`shotsThisTurn`/`acted`/`movementUsed`…) — au profit du tour EN COURS. Moindre mal :
    // l'inverse perd le tour définitivement (la pause pose `turn: -1` et GÈLE la machinerie,
    // `combatAdvanceBlocked`), alors que ce qu'`advanceTurn` re-dérivera est la borne du Round SUIVANT.
    // Chemin sans producteur mesuré aujourd'hui : `combatGate` bloque la fusion pendant un combat.
    else if (done?.maneuverResume) { resumeManeuverDefense(get, set, done.maneuverResume); handled = true; } // défense de manœuvre de zone close → reprendre le tour de la créature (attaques gratuites restantes / avance)
    else if (done?.roundBoundary) { enterRoundStartPause(get, set); handled = true; } // Peur de fin de Round close → pause de début de Round (PAS resolveRoundBoundary : décomptes déjà appliqués)
    // REPRISE DE L'IA à la clôture — fondée sur l'ÉTAT (un combat tourne), jamais sur le `purpose` de
    // la séquence close : une séquence `'test'`/`'affichage'` peut s'ouvrir EN COMBAT (Test déclenché
    // par `routeTriggeredTest`, révélation d'un jet subi) et c'est ELLE qui gelait le tour via
    // `combatAdvanceBlocked` — la clôturer sans reprendre laissait l'IA figée. `resumeSuspendedAI`
    // porte ses propres gardes (`combatAdvanceBlocked` : bataille finie, autre pending, cascade encore
    // ouverte ; acteur actif non piloté par l'IA) : l'élargissement ne peut pas la faire agir à tort.
    // Continuation DÉTERMINISTE de la victoire différée (#345) d'abord : `checkBattleOver` a pu DIFFÉRER
    // la cascade de fin de combat tant que ce slot était occupé — on re-vérifie ICI, slot libre, sans
    // dépendre d'un clic (confirmRoundStart). Le garde `!pendingCascade` (checkBattleOver) protège la
    // double-ouverture. `handled` (dénouement déjà joué : pause de Round, reprise de manœuvre…) garde
    // la main sur son propre enchaînement.
    if (!handled && get().battle) {
      if (!checkBattleOver(get, set)) resumeSuspendedAI(get, set); // combat non terminé → reprendre l'IA
    }
    // REPRISE d'une séquence PARQUÉE (couture de CLÔTURE, #942 L1) : `suspendedCascades` ne se vidait qu'au
    // teardown de combat — une séquence parquée par une AUTRE séquence (`startCascade`/`pushStep` d'un
    // `purpose` différent) n'était reprise NULLE PART. Gaté sur slot LIBRE (le dénouement ci-dessus a pu
    // ouvrir la suite : elle passe d'abord) ET hors combat (une séquence parquée par `startCombat` reste
    // propriété du teardown, cf. `dismissVictory`/`dismissDefeat`).
    if (!get().battle && !get().pendingCascade) resumeSuspendedCascade(get, set);
  };

  /** Dissout l'INTENTION LOCALE armée et dit s'il y en avait une (spec zone 4) : le clic du champ qui
   *  la consomme reste, lui, le geste par défaut. */
  const consumeIntent = (): boolean => {
    if (!get().localIntent) return false;
    set({ localIntent: null });
    return true;
  };

  return {
    // Peek du planificateur IA exposé au store (convention feuille « tout via get().xxx ») : le hook de
    // Frénésie (`turnHooks`, module feuille) y lit la meilleure action sans importer `combatFlow` (pas de
    // cycle). Déterministe, zéro `battleRng`, ne mute rien.
    aiWouldCast: (id: string): boolean => {
      const e = inBattleId(get().battle, id);
      return !!e && aiWouldPrepareSpell(e, get);
    },
    // ── Combat monté : Monter / Descendre — MAISON [entériné 2026-07-17] (« Met les en Maison pour le
    // moment », #526) : aucune clause de coût citable (LDB 14/15/09 + AA 9 fouillés en entier) ;
    // cadre RAW du combat monté : LDB 14 l.175-187. ──
    // Enfourcher/descendre ne demande AUCUN jet (Chevaucher sans Test si l'on a la Compétence, LDB 09 l.112)
    // → ce n'est PAS une Action (critère : tout jet = une Action) : c'est juste du MOUVEMENT (repositionnement
    // sur/hors la monture). On consomme donc le Mouvement du tour, pas l'Action — on peut enfourcher PUIS attaquer.
    battleMount: (mountId?: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle, scene } = get();
      if (!battle || !scene || battle.over || battle.movementUsed > 0) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || active.mountId) return;
      const montures = mountablesNear(battle, active);
      // Monture EXPLICITE (pastille de CETTE monture) → elle, et seulement si elle est enfourchable ;
      // sinon (touche du registre) → la plus proche. Même patron que `battleManPoste`.
      const mount = mountId ? montures.find((m) => m.id === mountId) : montures[0];
      if (!mount) return;
      mountUp(active, mount);
      // Monture Nerveux chevauchée : elle perd son tour propre (LDB 14 l.182) → la retirer de l'ordre
      // (et décaler le pointeur si son slot précédait l'actif). Un destrier (sans Nerveux) garde son tour.
      const orderPatch: Partial<BattleState> = {};
      if (isControlledMount(mount)) {
        const mIdx = battle.order.indexOf(mount.id);
        orderPatch.order = battle.order.filter((id) => id !== mount.id);
        orderPatch.baseOrder = (battle.baseOrder ?? battle.order).filter((id) => id !== mount.id);
        if (mIdx >= 0 && mIdx < battle.turn) orderPatch.turn = battle.turn - 1;
      }
      set({ battle: { ...battle, ...orderPatch, movementUsed: mountMovement(battle, active), action: null, reachable: new Map(), log: [...battle.log, ev('move', t('cs.mount', { name: active.label, mount: mount.label }), active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    battleDismount: () => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle, scene } = get();
      if (!battle || !scene || battle.over || battle.movementUsed > 0) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || !active.mountId) return;
      const mount = mountOf(battle, active);
      const mountName = libelleOuAbsence(mount, 'combattant', active.mountId);
      const wasControlled = !!mount && isControlledMount(mount); // monture Nerveux exclue de l'ordre tant que montée
      dismount(battle, scene, active);
      // La monture Nerveux redevient un combattant indépendant → réintègre l'ordre à son rang d'Initiative.
      const orderPatch: Partial<BattleState> = {};
      if (wasControlled && mount) {
        orderPatch.order = insertByInitiative(battle.order, battle.combatants, mount.id);
        orderPatch.baseOrder = insertByInitiative(battle.baseOrder ?? battle.order, battle.combatants, mount.id);
        orderPatch.turn = orderPatch.order.indexOf(active.id); // garder le pointeur sur le cavalier qui descend
      }
      set({ battle: { ...battle, ...orderPatch, movementUsed: mountMovement(battle, active), action: null, reachable: new Map(), log: [...battle.log, ev('move', t('cs.dismount', { name: active.label, mount: mountName }), active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    // Combat monté (LDB 14 l.181) : applique le choix de cible (cavalier OU monture) puis relance l'attaque/charge
    // sur l'id choisi en court-circuitant la modale (skipMountChoice). Annuler ne consomme rien.
    mountTargetSelect: (id: string) => {
      const pm = get().pendingMountTarget;
      if (!pm) return;
      set({ pendingMountTarget: null });
      // Le verdict d'armement du clic d'origine revient avec la relance (même raison que le gate de Peur).
      get().battleClickEntity(id, { skipMountChoice: true, approche: pm.approche });
    },
    mountTargetCancel: () => set({ pendingMountTarget: null }),

    // ── Désengagement (héros Engagé qui veut quitter le combat, LDB 15 l.43-49) ──
    battleDisengage: () => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over) return; // option A (Sacrifier l'Avantage) reste possible même après avoir agi
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || !isEngaged(active)) return;
      startDisengage(get, set, active);
    },
    // « Sacrifier l'Avantage » (l.87) → ramener l'Avantage à 0, partir libre. L'Action N'EST PAS consommée.
    disengageConfirmA: () => {
      const { battle, scene, pendingDisengage: pd } = get();
      if (!battle || !scene || !pd || !pd.canSacrifice) return;
      const mover = inBattleId(battle, pd.moverId);
      if (!mover) return set({ pendingDisengage: null, pendingCascade: null });
      const foes = (mover.engagedWith ?? [])
        .map((id) => inBattleId(battle, id))
        .filter((c): c is Combatant => !!c);
      // « Ramener votre Avantage à 0 » (LDB 15 l.47) ; en mode « Avantage de groupe » c'est la
      // Retraite stratégique (AA 11 l.37) : dépense FIXE de 2 Avantages de la réserve du camp (1 avec
      // Impitoyable AA 13 l.74), débitée par `campSpend`. Mode LDB : Impitoyable (LDB 10 l.591) GARDE
      // niveau Avantages au lieu de tomber à 0.
      if (groupAdvantage()) campSpend(get, mover, retreatAdvantageCost(mover));
      else mover.advantage = Math.min(mover.advantage, keptAdvantageOnDisengage(mover));
      for (const f of foes) disengageFrom(mover, f); // se place hors de portée de TOUS (l.87)
      set({
        pendingDisengage: null,
        pendingCascade: null, // ferme la cascade-hôte du Désengagement
        battle: {
          ...battle,
          action: null, // mouvement libre rouvert (clic-sol), sans pénalité (l.87) ; Action préservée
          reachable: moveReachFor(mover, scene, mover.pos!, effectiveMovement(mover), moveEnv(battle, mover)),
          log: [...battle.log, ev('flee', t('cs.disengageSacrifice', { name: mover.label }), mover.id)],
        },
      });
      bus.emit(EVT.SCENE_DIRTY);
    },
    // « Esquiver » → Test opposé Esquive (mover) vs Corps à corps (foe), jet du foe figé. Passe en phase 'esquive'.
    disengageRoll: () => {
      const { battle, pendingDisengage: pd } = get();
      if (!battle || !pd || pd.phase !== 'choice') return;
      const mover = inBattleId(battle, pd.moverId);
      if (!mover) return;
      const def = rollMeleeDefender(mover, 'esquive', battleRng());
      const opp = resolveOpposed(def, pd.atk!); // mover = « attaquant » du Test opposé
      set({ pendingDisengage: { ...pd, phase: 'esquive', def, result: disengageOutcome(opp.winner) } });
    },
    // Cycle Chance/Pacte UNIFIÉ (spec `disengage`) : foe (atk) figé, seule l'Esquive du mover se (re)joue.

    // « Appliquer » : l'Esquive consomme l'Action dans les DEUX issues (l.89).
    disengageConfirm: () => {
      const { battle, scene, pendingDisengage: pd } = get();
      if (!battle || !scene || !pd || !pd.result) return;
      const mover = inBattleId(battle, pd.moverId);
      const foe = inBattleId(battle, pd.foeId);
      set({ pendingDisengage: null, pendingCascade: null });
      if (!mover || !foe) return;
      const b = markActed(get, set, battle); // le Test d'Esquive EST l'Action : scellé AVANT la copie du journal
      const log = [...b.log];
      if (pd.result === 'success') {
        campGain(get, mover); // +1 Avantage (l.89)
        mover.gainedAdvThisRound = true;
        // Esquive réussie = on s'extrait du corps à corps → libéré de TOUS les Engagements
        // (cohérent avec l'option A, qui libère aussi tous les foes).
        const foes = (mover.engagedWith ?? [])
          .map((id) => inBattleId(battle, id))
          .filter((c): c is Combatant => !!c);
        for (const f of foes) disengageFrom(mover, f);
        log.push(ev('flee', t('cs.disengageDodge', { name: mover.label }), mover.id, foe.id));
        set({
          battle: { ...b, action: null, reachable: moveReachFor(mover, scene, mover.pos!, effectiveMovement(mover), moveEnv(battle, mover)), log },
        });
      } else if (pd.result === 'tie') {
        // Égalité parfaite du Test opposé : statu quo — pas de fuite, mais pas d'avantage à
        // l'adversaire non plus (LDB Tests). L'Action est consommée par la tentative d'Esquive.
        log.push(ev('flee', t('cs.disengageNeutral', { name: mover.label }), mover.id, foe.id));
        set({ battle: { ...b, action: null, reachable: new Map(), log } });
      } else {
        campGain(get, foe); // l'adversaire gagne +1, la fuite échoue (l.89)
        foe.gainedAdvThisRound = true;
        log.push(ev('flee', t('cs.disengageFail', { name: mover.label, foe: foe.label }), mover.id, foe.id));
        set({ battle: { ...b, action: null, reachable: new Map(), log } });
      }
      bus.emit(EVT.SCENE_DIRTY);
    },
    // ── « Fuir » (LDB 15 l.59-68) : OUVRE le flux MULTI `flee` — un slot par acteur (coup dans le dos
    //    du FRAPPEUR, Test de Calme du FUYARD). Aucun jet ni aucune conséquence ici : `fleeConfirm`
    //    applique tout. La modale s'ouvre dès qu'UN des deux acteurs est JOUÉ (symétrie). ──
    disengageFlee: () => {
      const { battle, pendingDisengage: pd } = get();
      if (!battle || !pd) return;
      const mover = inBattleId(battle, pd.moverId);
      const foe = inBattleId(battle, pd.foeId);
      if (!mover || !foe) return set({ pendingDisengage: null, pendingCascade: null });
      campGain(get, foe); // l'adversaire gagne immédiatement +1 Avantage (l.63)
      foe.gainedAdvThisRound = true;
      // `interactive` = le slot est-il JOUÉ (héros du groupe, quel que soit le SIÈGE qui le possède) —
      // jamais `pilotedByHuman` (évalué chez l'hôte, il dégraderait le héros d'un autre siège en témoin).
      // Même prédicat que les autres multis (`openCrewTestPending` : `partyIds.has`).
      const partyIds = new Set(get().party.map((h) => h.id));
      const played = (c: Combatant) => partyIds.has(c.id);
      const cascade = get().pendingCascade;
      const cur = cascade?.participants[cascade.cursor];
      // Deux acteurs JOUÉS (potentiellement de deux SIÈGES) sur la même fenêtre → étape de GROUPE :
      // l'arbitre coop met l'owner à '*' et chacun influence SON slot (calque `forceDoor`). La bascule
      // REMINTE l'étape hôte au lieu de la muter — `hostStep` est le seul mint qui expose `groupOwner`
      // (#1262 B6), et il revérifie au passage que `pendingDisengage`, la donnée que la fenêtre rend,
      // est toujours posé. Une étape hôte ne porte que sa déclaration : la situation vit dans le pending.
      const partagee = cascade && cur?.jet === 'disengage' && played(foe) && played(mover)
        ? hostStep(get, {
          id: cur.id, kind: cur.kind, jet: 'disengage', actorId: cur.actorId ?? mover.id, groupOwner: true,
          ...(cur.label ? { label: cur.label } : {}),
          ...(cur.icon ? { icon: cur.icon } : {}),
          ...(cur.stake ? { stake: cur.stake } : {}),
          ...(cur.meta ? { meta: cur.meta } : {}),
        })
        : undefined;
      set({
        battle: { ...battle },
        pendingDisengage: {
          ...pd,
          phase: 'fuir',
          fuir: {
            participants: [
              { id: foe.id, kind: 'backstab', interactive: played(foe), result: null },
              { id: mover.id, kind: 'calme', interactive: played(mover), calme: null },
            ],
          },
        },
        ...(cascade && partagee
          ? { pendingCascade: { ...cascade, participants: cascade.participants.map((s, i) => (i === cascade.cursor ? partagee : s)) } }
          : {}),
      });
      bus.emit(EVT.SCENE_DIRTY);
      // Rangée TÉMOIN auto-roulée à l'ouverture (précédent `battleCrewTest`) : le coup dans le dos d'un
      // frappeur non joué est résolu tout de suite ; celui d'un héros l'attend (il porte son cycle).
      if (!played(foe)) get().fleeRoll(foe.id);
      // Aucune modale affichable (aucun des deux acteurs JOUÉ, combat fini, Destin en attente) →
      // résolution HEADLESS par LE MÊME flux (jamais un chemin de calcul parallèle). MÊME prédicat que
      // les rangées ci-dessus (`played`) — une fenêtre se joue exactement quand une rangée est
      // `interactive` ; jamais `pilotedByHuman`, pour la raison dite plus haut.
      const st = get();
      if (played(mover) || played(foe)) {
        if (!st.battle?.over && !st.pendingFateSave) return;
      }
      const pdOpen = get().pendingDisengage;
      if (!pdOpen?.fuir) return;
      if (!fleeBackstab(pdOpen)?.result) get().fleeRoll(foe.id);
      const pdRolled = get().pendingDisengage;
      if (pdRolled && fleeNeedCalme(pdRolled) && !fleeCalme(pdRolled)?.calme) get().fleeRoll(mover.id);
      get().fleeConfirm();
    },
    // ── « Fuir » — « Appliquer » : applique le coup dans le dos par l'applicateur CANONIQUE d'attaque
    //    (Coup Critique sur double LDB 13 l.183, Blessure critique + À Terre au dépassement LDB 13 l.161,
    //    Avantage, Frappe Mortelle), PUIS la fuite elle-même (`completeFlee` : États Brisés du Calme raté
    //    l.66 + libération des Engagements + budget de Course l.68). Le coup gratuit consomme des tirages
    //    de `battleRng` (localisation, Critique, effets déclenchés) : à graine égale, la suite d'un combat
    //    où l'on fuit DIVERGE de l'ancienne — assumé (l'application canonique prime sur la reproductibilité
    //    d'une graine historique). ──
    fleeConfirm: () => {
      const { battle, scene, pendingDisengage: pd } = get();
      if (!battle || !scene || !pd?.fuir) return;
      const mover = inBattleId(battle, pd.moverId);
      const foe = inBattleId(battle, pd.foeId);
      if (!mover || !foe) return set({ pendingDisengage: null, pendingCascade: null });
      const res = fleeBackstab(pd)?.result;
      if (!res) return; // le coup dans le dos n'est pas résolu : rien à appliquer
      const calmeSlot = fleeCalme(pd);
      if (fleeNeedCalme(pd) && !calmeSlot?.calme) {
        if (!calmeSlot || calmeSlot.interactive) return; // le fuyard joué n'a pas encore lancé son Calme
        get().fleeRoll(mover.id); // fuyard non joué : sa rangée témoin se résout par le flux, puis on applique
        return get().fleeConfirm();
      }
      const seqBefore = get().pendingCascade;
      const stepsBefore = seqBefore?.participants.length ?? 0;
      set({
        pendingDisengage: null, // la modale se ferme AVANT l'application (une conséquence peut ouvrir la sienne)
        battle: { ...battle, log: [...battle.log, ev('flee', t('cs.fleeBackstab', { name: mover.label, foe: foe.label }), mover.id, foe.id)] },
      });
      const prevActed = battle.acted;
      // Attaque GRATUITE (elle ne consomme pas l'Action du fuyard, dont c'est le tour) : le détail du
      // jet et ses conséquences sont journalisés par l'applicateur canonique juste après cette ligne.
      const suspended = applyAttackResult(get, set, foe, mover, backstabWeapon(foe), res);
      const b2 = get().battle!;
      set({ battle: { ...b2, acted: prevActed } });
      const calme = calmeSlot?.calme;
      const broken = calme && !calme.success ? 1 + Math.max(0, -calme.sl) : 0; // échec → 1 + DR négatif (LDB 15 l.66)
      if (suspended) {
        // Déviation Critique du fuyard : `applyAttackResult` a EMPILÉ son étape de choix — le coup gratuit
        // n'est PAS résolu. La fuite (Brisé + Course) attend SA résolution, dans la même fenêtre, via
        // l'étape de reprise `fleeMove` (LDB 15 l.68 : « une fois que ce coup gratuit est résolu… »).
        pushDisplay(set, { id: `flee-move-${mover.id}`, kind: 'fleeMove', actorId: mover.id, icon: 'melee/flee', label: t('step.fuite'), fleeMove: { moverId: mover.id, foeId: foe.id, broken } });
        const casc = get().pendingCascade;
        if (casc?.participants[casc.cursor]?.jet === 'disengage') get().cascadeNext(); // avancer sur l'étape de Déviation
        return;
      }
      completeFlee(get, set, mover.id, foe.id, broken);
      // Cascade-hôte : on ne ferme QUE si l'application n'a rien empilé (Coup Critique…) — jamais une
      // cascade FRAÎCHE créée par la conséquence elle-même (une porte d'append en ouvre une s'il n'y en a pas).
      const seq = get().pendingCascade;
      if (!seq) return; // rien à fermer
      if (!seqBefore) return; // cascade FRAÎCHE ouverte par la conséquence (Coup Critique) : elle est déjà sur SON étape
      if (seq.participants.length > stepsBefore) get().cascadeNext(); // conséquence APPENDUE → avancer dessus
      else set({ pendingCascade: null }); // rien d'empilé : la cascade-hôte du Désengagement se ferme
    },
    disengageCancel: () => set({ pendingDisengage: null, pendingCascade: null }), // renonce avant tout jet : aucun coût

    // ── « Au Contact » (LDB 62 l.176, Option « Longueur d'arme », règle `combat-weapon-reach`) :
    //    Test opposé de Corps à corps mover vs foe pour entrer dans la longueur d'arme ; le VAINQUEUR
    //    choisit « combat normal » ou « au contact » (toute arme > Courte y devient improvisée). ──
    battleAuContact: (targetId: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return; // le Test opposé coûte l'Action
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || !canTakeAction(active)) return;
      const foe = inBattleId(battle, targetId);
      if (!foe || !auContactEligible(active, foe)) return;
      startAuContact(get, set, active, foe);
    },
    // « Lancer » : jet de Corps à corps du mover, opposé au jet figé du foe (mover = « attaquant »).
    auContactRoll: () => {
      const { battle, pendingAuContact: pd } = get();
      if (!battle || !pd || pd.phase !== 'roll' || pd.def) return; // déjà lancé → no-op
      const mover = inBattleId(battle, pd.moverId);
      if (!mover || !pd.atk) return;
      const def = rollDisengageAttack(mover, battleRng());
      const opp = resolveOpposed(def, pd.atk);
      set({ pendingAuContact: { ...pd, def, result: disengageOutcome(opp.winner) } });
    },
    // Cycle Chance/+1 DR/Pacte/Résilience (spec `auContact`) : foe (atk) figé, seul le jet du mover se (re)joue.
    // « Appliquer » : le Test opposé EST l'Action. Le mover (héros) gagne → IL choisit (phase 'choice') ;
    // le foe gagne → l'IA tranche par heuristique (arme la plus courte = au contact) ; égalité → statu quo.
    auContactConfirm: () => {
      const { battle, pendingAuContact: pd } = get();
      if (!battle || !pd || !pd.result) return;
      const mover = inBattleId(battle, pd.moverId);
      const foe = inBattleId(battle, pd.foeId);
      if (!mover || !foe) return set({ pendingAuContact: null });
      if (pd.result === 'success') return set({ pendingAuContact: { ...pd, phase: 'choice' } }); // le héros tranche
      if (pd.result === 'tie') return applyAuContact(get, set, mover, foe, null); // statu quo, Action consommée
      // Le foe (IA) l'emporte → au contact si SON arme est plus COURTE (il neutralise l'allonge adverse).
      // Sans arme de mêlée, il frappe à Mains nues (« Personnelle », LDB 62 l.28/l.158) ; deux longueurs
      // comparables sont requises pour conclure (l.172), sinon statu quo.
      const fr = meleeReachRank(foe.weapons.find((w) => w.type === 'melee'));
      const mr = meleeReachRank(mover.weapons.find((w) => w.type === 'melee'));
      applyAuContact(get, set, mover, foe, fr != null && mr != null && fr < mr ? 'contact' : 'normal');
    },
    // Le vainqueur HÉROS tranche : « au contact » pose l'état, « combat normal » le retire.
    auContactChoose: (mode: 'normal' | 'contact') => {
      const { battle, pendingAuContact: pd } = get();
      if (!battle || !pd || pd.phase !== 'choice' || pd.result !== 'success') return;
      const mover = inBattleId(battle, pd.moverId);
      const foe = inBattleId(battle, pd.foeId);
      if (!mover || !foe) return set({ pendingAuContact: null });
      applyAuContact(get, set, mover, foe, mode);
    },
    auContactCancel: () => set({ pendingAuContact: null }), // renonce avant tout jet : aucun coût

    // ── Empoignade (LDB 14 l.161) : action à son tour entre deux Empoignés. Test opposé de FORCE OU
    //    « Briser » (Avantage supérieur, gratuit) ; le VAINQUEUR choisit Dégâts / Empêtrer / Se libérer. ──
    battleGrapple: (targetId: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return; // le Test opposé coûte l'Action
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || !canTakeAction(active)) return;
      const foe = inBattleId(battle, targetId);
      if (!foe || !areGrappling(active, foe) || isOutOfAction(foe)) return;
      startGrapple(get, set, active, foe);
    },
    // « Briser l'Empoignade » (l.161) : gratuit (via le Mouvement), réservé à un Avantage SUPÉRIEUR, AVANT
    // tout jet. Libère les deux + retire l'*Empêtré* lié de l'acteur. NE consomme PAS l'Action.
    grappleBreak: () => {
      const { battle, pendingGrapple: pd } = get();
      if (!battle || !pd || pd.phase !== 'roll' || pd.def || !pd.canBreak) return;
      const actor = inBattleId(battle, pd.actorId);
      const foe = inBattleId(battle, pd.foeId);
      if (!actor || !foe) return set({ pendingGrapple: null });
      clearGrapple(actor, foe);
      removeCondition(actor, COND.empetre, stacks(actor, COND.empetre)); // l'acteur se libère de l'*Empêtré* de l'Empoignade
      const log = [...battle.log, ev('dodge', t('cs.grappleBreak', { name: actor.label, foe: foe.label }), actor.id, foe.id)];
      set({ pendingGrapple: null, battle: { ...battle, log } }); // gratuit : pas d'`acted`
      bus.emit(EVT.SCENE_DIRTY);
    },
    // « Lancer » : jet de Force de l'acteur, opposé au jet figé du foe (acteur = « attaquant »).
    grappleRoll: () => {
      const { battle, pendingGrapple: pd } = get();
      if (!battle || !pd || pd.phase !== 'roll' || pd.def) return; // déjà lancé → no-op
      const actor = inBattleId(battle, pd.actorId);
      if (!actor || !pd.atk) return;
      const def = rollGrappleForce(actor, battleRng());
      const opp = resolveOpposed(def, pd.atk);
      set({ pendingGrapple: { ...pd, def, result: disengageOutcome(opp.winner) } });
    },
    // Cycle Chance/+1 DR/Pacte/Résilience (spec `grapple`) : foe (atk) figé, seul le jet de l'acteur se (re)joue.
    // « Appliquer » : le Test opposé EST l'Action. Succès → l'acteur choisit (phase 'options') ; échec →
    // +1 Avantage au foe (l.161) ; égalité → statu quo.
    grappleConfirm: () => {
      const { battle, pendingGrapple: pd } = get();
      if (!battle || !pd || !pd.result) return;
      const actor = inBattleId(battle, pd.actorId);
      const foe = inBattleId(battle, pd.foeId);
      if (!actor || !foe) return set({ pendingGrapple: null });
      if (pd.result === 'success') return set({ pendingGrapple: { ...pd, phase: 'options' }, battle: { ...markActed(get, set, battle), action: null } }); // l'acteur tranche ; Action dépensée
      if (pd.result === 'failure') campGain(get, foe, 1); // l'adversaire l'emporte → +1 Avantage
      const key = pd.result === 'failure' ? 'cs.grappleLose' : 'cs.grappleTie';
      const b = markActed(get, set, battle); // scellé AVANT la copie du journal (le déclencheur y pousse ses lignes)
      const log = [...b.log, ev('attack', t(key, { name: actor.label, foe: foe.label }), actor.id, foe.id)];
      set({ pendingGrapple: null, battle: { ...b, action: null, log } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    // Le vainqueur tranche : Dégâts (BF+DR, PA ignorés) / Empêtrer l'adversaire / Se libérer (LDB 14 l.161).
    grappleChoose: (mode: 'damage' | 'entangle' | 'free') => {
      const { battle, pendingGrapple: pd } = get();
      if (!battle || !pd || pd.phase !== 'options' || pd.result !== 'success') return;
      const actor = inBattleId(battle, pd.actorId);
      const foe = inBattleId(battle, pd.foeId);
      if (!actor || !foe || !pd.def || !pd.atk) return set({ pendingGrapple: null });
      const dr = Math.max(0, resolveOpposed(pd.def, pd.atk).netSL); // DR net du Test gagné
      applyGrapple(get, set, actor, foe, mode, dr, pd.def.roll);
    },
    grappleCancel: () => set({ pendingGrapple: null }), // renonce avant tout jet : aucun coût

    battleClickTile: (pt: Pt, opts?: TileClickOpts) => {
      const { battle, scene } = get();
      if (!battle || !scene || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active)) return;
      // INTENTION LOCALE armée (spec zone 4) : ce clic EST son commit — elle se dissout et vaut
      // confirmation (la case a été choisie sciemment).
      // VERDICT D'ARMEMENT de la Course (spec § 2026-08-19) : il vient des OPTS quand le geste a déjà
      // été jugé chez son émetteur (intent d'un invité — l'hôte n'a pas SON intention — ou relance d'un
      // geste différé, dont l'intention a été dissoute au premier clic) ; sinon on le lit ICI, AVANT que
      // `consumeIntent` ne l'efface.
      const courseDemandee = opts?.courseArmee ?? courseArmee(get);
      const armedTile = consumeIntent();
      const clickOpts = armedTile ? { ...opts, confirm: true } : opts;
      // Le MODE de ciblage courant peut posséder un commit-CASE (téléportation, pose de zone de sort
      // après jet, pilonnage indirect de siège, ouverture d'un sort de ZdE) — source UNIQUE targetingModes.
      const mode = currentTargetingMode(get);
      if (mode.commitTile) { mode.commitTile(get, set, active, pt); return; }
      // Mode NEUTRE = clic-sol implicite. Les modes restants sans commit-CASE (soin/munition/dissipation/
      // Détermination) ne déplacent pas au clic-case → inertes ; seul le mode neutre (action null) marche.
      if (battle.action !== null) return;
      // Engagé : pas de déplacement libre (LDB 15 l.45) → le clic-sol route vers le Désengagement.
      if (isEngaged(active)) {
        startDisengage(get, set, active);
        return;
      }
      const dest = pt;
      const movement = resolveMovement(get, dest);
      if (movement.status === 'blocked') {
        // Le clic-sol REFUSÉ le DIT (modèle de gestes 2026-08-19 ; le survol, lui, ne peint plus rien sur
        // une case injouable — arbitrage 2026-08-24). Seules les raisons qui répondent à un GESTE du
        // joueur parlent : les verrous structurels (pas de combat, ciblage armé, tour d'autrui) ne sont
        // pas des refus, ils n'ont rien à dire. Table locale à UN consommateur (ce site est le clic-sol).
        const dit = REFUS_DEPLACEMENT[movement.reason];
        if (dit) refuserGeste(get, set, t(dit));
        if (battle.preview) {
          set({ battle: { ...battle, preview: null }, hoverDelta: null });
          bus.emit(EVT.SCENE_DIRTY);
        }
        return;
      }
      // Peur (LDB 21 l.27) : se RAPPROCHER d'une source de Peur exige un Test de Calme Intermédiaire (+0)
      // — vérifié au COMMIT seulement (l'aperçu reste libre). Une tentative par Tour (battle.fearGate) :
      // succès → approches libres ce Tour ; échec → aucune approche ce Tour.
      const fearGateBlocks = (): boolean => {
        if (battle.fearGate === 'passed') return false;
        const feared = fearedSourceTowards(battle, active, dest);
        if (!feared) return false;
        if (battle.fearGate === 'failed') {
          refuserGeste(get, set, t('cs.fearNoApproach', { name: active.label, feared: feared.label }));
          return true;
        }
        // On rejoue le clic BRUT (`pt`) après le Test (l.962) → `battleClickTile` re-résout l'escalier
        // (sinon, stocker `dest` le re-traduirait une 2ᵉ fois et renverrait au pied). Le check de Peur, lui,
        // porte bien sur la destination réelle (`dest` ci-dessus).
        set({ pendingApproach: { combatantId: active.id, sourceId: feared.id, sourceName: feared.label, intent: { kind: 'tile', pt: { ...pt }, courseArmee: courseDemandee }, result: null }, battle: { ...battle, preview: null } });
        bus.emit(EVT.SCENE_DIRTY);
        return true;
      };
      // Frénésie (LDB 21 l.33) : « vous devez vous déplacer à votre maximum en direction de l'ennemi
      // le plus proche dans votre Ligne de Vue » → seules les cases qui RAPPROCHENT de cette cible.
      const frenzyBlocks = (): boolean => {
        if (!isFrenzied(active)) return false;
        const ft = frenzyTarget(get, active);
        if (!ft?.pos || chebyshev(dest, ft.pos) < chebyshev(active.pos!, ft.pos)) return false;
        refuserGeste(get, set, t('cs.frenzyMustCharge', { name: active.label, foe: ft.label }));
        return true;
      };
      const geom = mountOf(battle, active) ?? active;
      const prev = battle.preview;
      if (movement.kind === 'run') {
        // COURSE À ARMER (spec HUD § ARBITRAGE 2026-08-19, école BG3) : au-delà de la Marche, le champ
        // ne court plus tout seul — sans la case Course armée, le clic est REFUSÉ, et le refus se DIT
        // (bandeau d'annonce, `state/refusVisible`). L'intention armée reste armée : c'est le refus
        // qui informe, pas une punition.
        // EXEMPTION par NATURE : la Frénésie IMPOSE la course vers l'ennemi (LDB 21 l.33, verbatim
        // « la seule Action possible est un Test de Capacité de Combat ou un Test d'Athlétisme pour
        // atteindre votre ennemi le plus rapidement possible ») — ce que la règle impose ne s'arme pas.
        if (!courseDemandee && !isFrenzied(active)) return void refuserGeste(get, set, t('cs.refusCourseNonArmee'));
        // Zone de Course : tap 1 = aperçu « Courir » ; tap 2 = Test d'Athlétisme (pendingRun + destination).
        if (!clickOpts?.confirm && !(prev?.kind === 'run' && prev.path === movement.path)) {
          set({ battle: { ...battle, preview: { kind: 'run', tile: { ...dest }, path: movement.path, cost: movement.cost } }, hoverDelta: null });
          bus.emit(EVT.SCENE_DIRTY);
          return;
        }
        if (fearGateBlocks() || frenzyBlocks()) return;
        get().battleRun({ ...dest }, { path: movement.path, cost: movement.cost });
        return;
      }
      // Tap 1 : APERÇU (chemin + coût) — sauf confirmation directe ou re-tap de la même case.
      if (!clickOpts?.confirm && !(prev?.kind === 'move' && prev.path === movement.path)) {
        set({ battle: { ...battle, preview: { kind: 'move', tile: { ...dest }, path: movement.path, cost: movement.cost } }, hoverDelta: null });
        bus.emit(EVT.SCENE_DIRTY);
        return;
      }
      // Tap 2 : COMMIT.
      if (fearGateBlocks() || frenzyBlocks()) return;
      // Annulation (R6/LOT 6) : au PREMIER segment du Tour (movementUsed === 0), on capture l'état
      // positionnel AVANT de bouger, pour pouvoir tout annuler tant qu'aucune Action n'a été prise.
      const snapshot =
        (battle.movementUsed ?? 0) === 0 ? captureMoveSnapshot(battle, get().facing) : battle.moveSnapshot ?? null;
      const path = movement.path;
      const fromPos = { ...active.pos! };
      placeCombatant(active, scene, dest);
      if (geom !== active) placeCombatant(geom, scene, dest); // déplace la monture sous le cavalier (couple solidaire)
      displaceSmaller(get, geom); // un grand « dégage » les plus petits sous son empreinte (85 l.373-374)
      get().faceFromPath(active.id, path);
      if (geom !== active) get().faceFromPath(geom.id, path);
      bus.emit(EVT.ANIM_MOVE, { id: active.id, path });
      if (geom !== active) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path });
      applyZoneCrossings(get, set, active, path ?? [{ ...dest }]); // Mur de feu & co (L11) : traverser coûte
      noteApproachMove(active, fromPos); // LDB 21 l.27 — événement EN ATTENTE : scellé à l'Action ou à la fin du tour
      // Mouvement décomposable : cumule le coût du segment ; reste en mode neutre → le joueur peut
      // re-cliquer une case (s'il reste du Mouvement) OU enchaîner une Action. Si ce segment précède
      // l'Action, on marque `movedPreAction` (verrouille tout Mouvement post-Action).
      set({ battle: { ...battle, moveSnapshot: snapshot, movementUsed: (battle.movementUsed ?? 0) + movement.cost, movedPreAction: battle.movedPreAction || !battle.acted, action: null, reachable: new Map(), preview: null }, hoverDelta: null });
      bus.emit(EVT.SCENE_DIRTY);
    },

    cancelMove: () => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle } = get();
      if (!battle || battle.over) return;
      const snap = battle.moveSnapshot;
      const active = activeCombatant(battle);
      // Aide PRÉ-Action uniquement : on n'annule que tant qu'aucune Action n'a été prise ce Tour (sinon
      // l'Action aurait été résolue depuis une position effacée). Rien à annuler sans segment.
      if (!snap || !active || !controlsCombatant(get(), active) || battle.acted || (battle.movementUsed ?? 0) === 0) return;
      for (const c of battle.combatants) {
        const p = snap.pos[c.id];
        if (p) c.pos = { ...p }; // restaure TOUS (un grand a pu en déplacer d'autres sous son empreinte)
        clearApproachMoves(c); // position d'avant restaurée : le déplacement n'a jamais eu lieu (LDB 21 l.27)
        // Défait le `loseNextMovement` posé par une poussée d'engin annulée (siegePush.ts, #199) — sans
        // ce ré-arme, un servant perdrait son Mouvement suivant pour une poussée qui n'a jamais eu lieu.
        c.loseNextMovement = snap.loseNextMovement?.[c.id] ?? false;
      }
      set({
        facing: { ...snap.facing },
        // `cancelMove` est l'INVERSE de l'économie du tour : il la rend à son état d'avant le segment,
        // empreinte comprise (`endTurnGuard.ts`) — donc il désarme la fin de tour.
        battle: { ...battle, movementUsed: 0, movedPreAction: snap.movedPreAction, moveSnapshot: null, action: null, reachable: new Map(), preview: null, endTurnArmed: undefined },
      });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Curseur de combat CLAVIER/MANETTE ───────────────────────────────────────────────────────
    // Un seul curseur que clavier ET manette alimentent. Il pilote le réticule existant comme un survol
    // (IsoStage) et se commet via battleClickEntity/Tile → parité souris exacte (cf. combatCursor.ts).
    moveCursor: (dir: ScreenDir) => {
      const { battle, scene, camRot, viewMode, camEdge } = get();
      if (!battle || battle.over || !scene) return;
      const owner = cursorActor(get); // l'ACTIF, ou le tireur Tir rapide ARMÉ pendant la pause (le curseur suit ses yeux)
      if (!owner?.pos) return;
      const dims = { w: scene.dimensions.w, h: scene.dimensions.h, rot: camRot, view: viewMode, edge: camEdge, yawDeg: viewYawDeg(camRot, camEdge) };
      const mode = currentTargetingMode(get);
      if (mode.tileValidAt) {
        // Mode-CASE (#198, résidus) : le curseur ne navigue QUE l'ensemble VALIDE du mode (Pousser/
        // Téléportation/pose de zone) — jamais un snap sur une case non commettable (porte, hors reach).
        const valid = tileModeValidTiles(get, { tileValidAt: mode.tileValidAt }, owner);
        const next = nextCaseCursorTile(scene, get().combatCursor?.tile ?? null, dir, dims, owner.pos, valid);
        if (next) set({ combatCursor: { tile: next } });
        return;
      }
      set({ combatCursor: { tile: nextCursorTile(scene, get().combatCursor, dir, dims, owner.pos) } });
    },
    snapCursorToTarget: (step: 1 | -1) => {
      const cur = get().combatCursor?.snappedId ?? null;
      const tgt = step === 1 ? cycleTarget(get, cur) : cyclePrevTarget(get, cur);
      if (tgt?.pos) set({ combatCursor: { tile: { ...tgt.pos }, snappedId: tgt.id } });
    },
    commitCursor: () => {
      const s = get();
      const cur = s.combatCursor;
      if (!cur) return;
      const intent = cursorCommitIntent(get, cur);
      if (!intent) {
        // Mode-CASE (#198, résidus) : un commit qui tombe malgré tout sur une case non commettable
        // (occupant sans action pour ce mode) prévient — jamais muet — par la porte de refus commune
        // (`refusVisible` : le journal n'est pas affiché en combat). Hors mode-case : no-op voulu
        // (allié sans Inspection, cf. combatCursor.test.ts).
        if (currentTargetingMode(get).tileValidAt) refuserGeste(get, set, t('cs.cursorInvalidTile'));
        return;
      }
      if (intent.kind === 'entity') s.battleClickEntity(intent.id, { confirm: true });
      else if (intent.kind === 'inspect') s.setInspectId(intent.id);
      else s.battleClickTile(intent.pt, { confirm: true });
    },
    // INTENTION LOCALE (spec zone 4) : la case d'action ARME le geste que le prochain clic du champ
    // commettra, et sa PORTÉE se peint aussitôt (`localIntent.ts` → `HighlightsView.intentReach`).
    // Purement locale : aucun intent réseau ne part d'ici (seul le COMMIT du geste en émet un).
    // Re-armer la MÊME action, ou passer `null` (Échap), la dissout.
    battleArmIntent: (actionId: string | null) => {
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active)) return;
      const armed = get().localIntent;
      set({ localIntent: !actionId || armed?.actionId === actionId ? null : { actionId } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    clearCursor: () => {
      if (get().combatCursor) set({ combatCursor: null });
    },

    battleClickEntity: (id: string, opts?: BattleClickOpts) => {
      const battle = get().battle;
      if (!battle || battle.over) return;
      // Tir rapide ARMÉ (pause de début de Round, LDB 11 l.97-103) : cliquer un adversaire — token de carte OU portrait
      // de frise, tous deux passent ICI — déclenche l'interruption hors du tour (le tireur n'est pas l'actif).
      const aiming = get().preemptAiming;
      if (aiming) {
        set({ preemptAiming: null, combatCursor: null }); // désarme + retire le curseur clavier avant d'ouvrir la modale de tir
        get().preemptRangedShot(aiming, id);
        return;
      }
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active)) return;
      // INTENTION LOCALE armée (spec zone 4) : ce clic EST son commit — elle se dissout, et vaut
      // confirmation (la cible a déjà été choisie sciemment).
      // VERDICT D'ARMEMENT DE LA CHARGE (spec § 2026-08-19) : c'est lui — et lui seul — qui autorise
      // l'approche vers la cible cliquée. Même règle que le clic-case : il vient des OPTS quand le
      // geste a déjà été jugé chez son émetteur (intent d'un invité, ou relance d'un geste différé par
      // un gate), sinon il se lit ici, avant que `consumeIntent` ne l'efface.
      const approche = opts?.approche ?? chargeArmee(get);
      const armed = consumeIntent();
      const clickOpts = { ...opts, approche, ...(armed ? { confirm: true } : {}) };
      // Le MODE de ciblage courant possède le commit-COMBATTANT (attaque/cast/soin/bordée, ou flux
      // différés : Surincantation +Cible / Frappe Mortelle / 2ᵉ frappe, ou pose de zone sur la case
      // d'un combattant). Source UNIQUE : targetingModes (réticule au survol = ce même mode).
      currentTargetingMode(get).commitCombatant?.(get, set, active, id, clickOpts);
    },
    battleTrample: (targetId: string) => {
      if (combatBusy(get()) || get().pendingCascade) return; // flux différé / cascade en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      // Exige ≥1 Avantage (LDB 85 l.320), SAUF Se cabrer (`freeTrample`, LDB 85 l.314) qui paie
      // le Piétinement d'une Action de Mouvement au lieu d'un Avantage — donc SEULEMENT si cette
      // Action de Mouvement est encore entière (aucun Mouvement dépensé ce Tour, `movementUsed === 0`).
      const freeMoveAction = !!active && trampleFreeMove(battle, active); // prédicat PARTAGÉ (combatFlow) : porte, paiement et libellé de coût
      if (!active || !controlsCombatant(get(), active) || (active.advantage < 1 && !freeMoveAction)) return;
      const target = trampleTarget(battle, active, targetId); // adversaire adjacent plus petit
      if (!target) return;
      // Piétinement = étape 0 d'une cascade de COMBAT (comme l'attaque) : le jet ET son Coup Critique
      // vivent dans UNE fenêtre. `pendingTrample` coexiste comme porteur de données (résolu par
      // trampleConfirm) ; le jet se fait au clic « Lancer ».
      set({ pendingTrample: { attackerId: active.id, targetId: target.id, result: null }, battle: { ...battle, action: null } });
      const step = hostStep(get, { id: 'trample-jet', kind: 'trampleJet', jet: 'trample', actorId: active.id });
      if (step) openSequence(get, set, { title: 'Piétinement', icon: 'melee/trample', purpose: 'combat', steps: [step] });
    },
    // ── Sélection d'ATTAQUE (« Attaque ▾ ») : arme une `AttackOption` (Arme + gratuites/zone/Piétinement/
    // Tentacule). Source des entrées : `availableAttacks` (combatFlow). Le clic-ennemi résout l'armée. ──
    battleSelectAttack: (id: string) => {
      if (combatBusy(get())) return;
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active)) return;
      // Arme une attaque pour le clic-ennemi (mode neutre : `action===null`). Re-sélectionner revient à l'Arme.
      const next = battle.selectedAttack === id ? 'arme' : id;
      set({ battle: { ...battle, action: null, selectedAttack: next, selectedSpellId: null, preview: null }, pendingSiegeAim: null });
      // Pièce INDIRECTE servie (mortier/catapulte, AA 10 l.169/171) : ARMER l'option « Servir … » ouvre le PLACEUR
      // DE CASE (le tir vise un point au sol, pas un combattant) ; le désarmer (retour à 'arme') le referme.
      if (next === id) {
        const opt = availableAttacks(active, battle).find((o) => o.id === id);
        if (opt?.indirect && opt.weaponUid) {
          const w = active.weapons.find((x) => x.uid === opt.weaponUid);
          if (w?.uid) set({ pendingSiegeAim: { gunnerId: active.id, weaponUid: w.uid, radius: siegeBlastRadiusTiles(active, w, get().scene), rangeTiles: null } });
        }
      }
    },
    battleManeuverArea: (kind: AttackKind) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active)) return;
      const a = creatureAttacks(active.traits ?? []).find((x) => x.kind === kind);
      if (!a) return;
      if (active.advantage < a.avantage) return; // Hurlement : ≥ coût RAW (2, dépense tout à l'application)
      set({ battle: { ...battle, action: null } }); // referme le menu avant la résolution
      // Hurlement (LDB 85 l.170) : PAS de jet d'attaquant — chaque cible tire son 1d10 + Test de
      // Résistance (jets SUBIS montrés au feed). Aucune modale différable → résolution immédiate (le
      // wrapper roule les jets subis + checkBattleOver). Dépense TOUS les Avantages (min 2).
      if (kind === 'hurlement') applyWail(get, set, active);
    },
    battleSelfManeuver: (maneuverId: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return; // coûte l'Action du tour (2ᵉ via loseTurn des effets)
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || !canTakeAction(active)) return;
      const def = selfManeuversOf(active).find((m) => m.id === maneuverId);
      if (!def || !selfManeuverApplicable(active, def)) return; // périmée (déjà dans/hors de la forme)
      set({ battle: { ...battle, action: null } }); // referme le menu
      resolveManeuver(get, set, active, def, 0, null, 0, active); // cible = SOI (transformation, mue…)
      set({ battle: markActed(get, set, get().battle!) }); // Action consommée
      checkBattleOver(get, set);
    },
    trampleConfirm: () => {
      const { battle, pendingTrample: pt } = get();
      if (!battle || !pt || !pt.result) return;
      const attacker = inBattleId(battle, pt.attackerId);
      const target = inBattleId(battle, pt.targetId);
      set({ pendingTrample: null });
      if (attacker && target) {
        const prevActed = battle.acted; // action GRATUITE : ne consomme pas l'Action
        // Se cabrer (`freeTrample`, LDB 85 l.314) : 0 Avantage, payé par l'Action de Mouvement à la place
        // (`movementUsed` porté au plein Mouvement, précédent `loseNextMovement`) — cf. `applyTrample`.
        const free = trampleFreeMove(battle, attacker); // MÊME prédicat que la porte : le libellé affiché EST ce qui se débite
        campSpend(get, attacker, free ? 0 : 1); // coût : 1 Avantage (LDB 85 l.320) — réserve du camp en mode groupe (AA 11 l.30-38)
        applyAttackResult(get, set, attacker, target, TRAMPLE_WEAPON, pt.result); // un Coup Critique s'EMPILE (pushReveal) sur la cascade ouverte
        const b2 = get().battle!;
        set({ battle: { ...b2, acted: prevActed, movementUsed: free ? Math.max(b2.movementUsed, mountMovement(b2, attacker)) : b2.movementUsed } });
      }
      // Séquence de combat (jet = étape 0) : enchaîner sur le Coup Critique foldé DANS la même fenêtre,
      // ou clore l'étape (reprise IA) si aucune conséquence — plus de 2ᵉ fenêtre « Conséquences ».
      advanceCombatJet(get);
    },
    trampleCancel: () => set({ pendingTrample: null }),

    // ── Battement (LDB 10 l.103 / AA 13 l.17) : Action, Test de Corps à corps NON opposé retirant de
    //    l'Avantage adverse. Le jet passe par FLOWS.battement (Lancer/Chance/Pacte/Résilience) ;
    //    « Appliquer » (`battementConfirm`) appelle `resolveBattement` et consomme l'Action. ──
    battleBattement: (foeId?: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return; // l'Action de Battement est indisponible si déjà agi
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || !canTakeAction(active) || !hasBattement(active)) return;
      const foes = battementFoes(active, battle);
      const foe = foeId ? foes.find((c) => c.id === foeId) : foes[0]; // défaut = 1er éligible ; picker via `battementSetFoe`
      if (!foe) return;
      startBattement(get, set, active, foe);
    },
    // Change la cible du Battement AVANT le jet (picker OptionChooser de la modale) — re-ouvre sur le foe choisi.
    battementSetFoe: (foeId: string) => {
      const { battle, pendingBattement: pb } = get();
      if (!battle || !pb || pb.result) return; // verrouillé une fois lancé
      const active = inBattleId(battle, pb.attackerId);
      const foe = active && battementFoes(active, battle).find((c) => c.id === foeId);
      if (!active || !foe) return;
      startBattement(get, set, active, foe);
    },
    // Cycle Lancer/Chance/+1 DR/Pacte/Résilience (spec `battement`) : jet de CC de l'attaquant, non opposé.
    // « Appliquer » : `resolveBattement` retire l'Avantage adverse (LDB 10 l.103) ; consomme l'Action.
    battementConfirm: () => {
      const { battle, pendingBattement: pb } = get();
      if (!battle || !pb || !pb.result) return;
      const attacker = inBattleId(battle, pb.attackerId);
      const foe = inBattleId(battle, pb.foeId);
      set({ pendingBattement: null });
      if (!attacker || !foe) return;
      const line = resolveBattement(get, attacker, foe, pb.result); // MUTE le foe (et la réserve du camp)
      set({ battle: { ...markActed(get, set, get().battle!), action: null, log: [...get().battle!.log, ev('attack', line, attacker.id, foe.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      checkBattleOver(get, set);
    },
    battementCancel: () => set({ pendingBattement: null }),

    // ── Distraire (LDB 10 l.364 / AA 13 l.51) : MOUVEMENT, Test OPPOSÉ Athlétisme vs Calme. Le jet de
    //    Calme du foe est figé à l'ouverture (`startDistraire`) ; l'Athlétisme du mover passe par
    //    FLOWS.distraire (Lancer/Chance/Pacte/Résilience) ; « Appliquer » pose `distractedRounds` et
    //    consomme le MOUVEMENT (pas l'Action). ──
    battleDistraire: (foeId?: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle } = get();
      if (!battle || battle.over || battle.movementUsed > 0) return; // le Distraire coûte le Mouvement
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || !active.pos || !hasDistraire(active)) return;
      const foes = distraireFoes(active, battle);
      const foe = foeId ? foes.find((c) => c.id === foeId) : foes[0]; // défaut = 1er éligible ; picker via `distraireSetFoe`
      if (!foe) return;
      startDistraire(get, set, active, foe);
    },
    // Change la cible du Distraire AVANT le jet (picker OptionChooser) — re-fige le Calme du foe choisi.
    distraireSetFoe: (foeId: string) => {
      const { battle, pendingDistraire: pd } = get();
      if (!battle || !pd || pd.atk) return; // verrouillé une fois lancé
      const mover = inBattleId(battle, pd.moverId);
      const foe = mover && mover.pos && distraireFoes(mover, battle).find((c) => c.id === foeId);
      if (!mover || !foe) return;
      startDistraire(get, set, mover, foe);
    },
    // « Lancer » : jet d'Athlétisme du mover, opposé au jet de Calme figé du foe (spec `distraire`).
    // Cycle Chance/+1 DR/Pacte/Résilience : foe (defRoll) figé, seul l'Athlétisme du mover se (re)joue.
    // « Appliquer » : `resolveDistraire` pose `distractedRounds` sur une victoire ; consomme le MOUVEMENT.
    distraireConfirm: () => {
      const { battle, pendingDistraire: pd } = get();
      if (!battle || !pd || !pd.atk || !pd.result) return;
      const mover = inBattleId(battle, pd.moverId);
      const foe = inBattleId(battle, pd.foeId);
      set({ pendingDistraire: null });
      if (!mover || !foe) return;
      const line = resolveDistraire(mover, foe, pd.atk, pd.defRoll); // MUTE le foe (distractedRounds) sur une victoire
      set({ battle: { ...get().battle!, action: null, movementUsed: mountMovement(get().battle!, mover), reachable: new Map(), log: [...get().battle!.log, ev('attack', line, mover.id, foe.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      checkBattleOver(get, set);
    },
    distraireCancel: () => set({ pendingDistraire: null }),

    // ── Manœuvre de créature par modale (Souffle/Vomi/Langue/Regard/Étreinte — LDB 85) : le jet de
    //    l'ATTAQUANT passe par FLOWS.maneuver (Lancer/Chance/Pacte/Résilience) ; « Appliquer » roule les
    //    défenseurs et résout l'opposition au feed via le RÉSOLVEUR GÉNÉRIQUE `resolveManeuver`. ──
    maneuverConfirm: () => {
      const { battle, pendingManeuver: pm } = get();
      if (!battle || !pm || !pm.result) return;
      const attacker = inBattleId(battle, pm.attackerId);
      set({ pendingManeuver: null });
      if (!attacker) return;
      const a = creatureAttacks(attacker.traits ?? []).find((x) => x.def.id === pm.maneuverId);
      if (!a) return;
      const prevActed = battle.acted;
      // RÉSOLVEUR GÉNÉRIQUE unique : dépense `avantageSpent`, choisit la/les cible(s) (clic = `targetId`),
      // roule les défenseurs, applique les effets AUTHORÉS de la `ManeuverDef`. Étreinte/Regard = Action.
      const chosen = pm.targetId ? inBattleId(battle, pm.targetId) : undefined;
      resolveManeuver(get, set, attacker, a.def, a.indice, pm.result, pm.avantageSpent, chosen);
      // Manœuvre GRATUITE de zone (Souffle/Vomi/Langue/Regard) : 1/tour aussi (RAW « une Attaque gratuite ») —
      // même compteur partagé. (Étreinte/Regard à l'Action ne comptent pas — gérées par `acted` ci-dessous.)
      if (a.trigger === 'free') {
        const atk = inBattleId(get().battle, pm.attackerId);
        if (atk) atk.freeAttacksThisTurn = { ...atk.freeAttacksThisTurn, [a.kind]: (atk.freeAttacksThisTurn?.[a.kind] ?? 0) + 1 };
      }
      const acted = a.trigger === 'action' ? true : prevActed; // Action consommée seulement par Étreinte/Regard
      set({ battle: { ...get().battle!, acted } });
      checkBattleOver(get, set);
    },
    maneuverCancel: () => set({ pendingManeuver: null }),
    maneuverSetAvantage: (n: number) => {
      const { battle, pendingManeuver: pm } = get();
      if (!battle || !pm || pm.result) return; // pas après le jet (l'Avantage fixe le DR)
      const attacker = inBattleId(battle, pm.attackerId);
      if (!attacker) return;
      const clamped = Math.max(1, Math.min(n, attacker.advantage)); // 1..Avantage (LDB 85 l.290)
      set({ pendingManeuver: { ...pm, avantageSpent: clamped } });
    },

    // ── Course (LDB 15 l.41) : utilise l'Action + un Test d'Athlétisme (+20) → déplacement
    //    étendu (Marche + Course + DR) vers la destination cliquée dans la zone de Course. « Un jet = une
    //    modale » : le Test passe par pendingRun. ──
    battleRun: (dest?: Pt, movement?: { path: Pt[]; cost: number }) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.acted || battle.movementUsed > 0) return; // Course = Marche + Action (exige le plein Mouvement)
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || isEngaged(active) || hasCondition(active, COND.aTerre) || !canTakeAction(active)) return; // Engagé/À Terre → pas de Course (LDB 16 l.37)
      const resolved = dest && !movement ? resolveMovement(get, dest) : null;
      if (resolved?.status === 'blocked') return;
      const plan = movement ?? (resolved?.status === 'ok' ? { path: resolved.path, cost: resolved.cost } : undefined);
      set({ pendingRun: { combatantId: active.id, dest, ...plan, result: null }, battle: { ...battle, action: null, preview: null }, hoverDelta: null });
    },
    runConfirm: () => {
      const { battle, scene, pendingRun: pr } = get();
      if (!battle || !scene || !pr || !pr.result || !pr.dest) return;
      const c = inBattleId(battle, pr.combatantId);
      set({ pendingRun: null, hoverDelta: null });
      if (!c) return;
      // Combat monté : Course au Mouvement de la monture, empreinte/collisions de la monture (couple solidaire).
      const geom = mountOf(battle, c) ?? c;
      const range = mountMovement(battle, c) + pr.result.bonusCases; // Marche + (Course + DR) (LDB 15 l.41)
      const env = moveEnv(battle, geom);
      const skill = c.mountId ? 'Chevaucher' : 'Athlétisme';
      // Le jet peut porter MOINS loin que la destination demandée : on suit le chemin et on s'arrête au
      // dernier point que le budget permet (« au max qu'il puisse faire »).
      const reach = reachable(scene, c.pos!, range, env);
      const fallback = pr.path ? null : resolveMovement(get, pr.dest);
      const path = pr.path ?? (fallback?.status === 'ok' ? fallback.path : []);
      let stopIdx = -1;
      for (let i = path.length - 1; i >= 0; i--) {
        if (reach.has(`${path[i].x},${path[i].y}`)) { stopIdx = i; break; }
      }
      const stop = stopIdx >= 0 ? path[stopIdx] : null;
      if (!stop || (stop.x === c.pos!.x && stop.y === c.pos!.y)) {
        // Jet désastreux : aucun pas possible — l'Action est tout de même consommée (le Test a eu lieu).
        const b = markActed(get, set, get().battle!); // scellé AVANT la copie du journal (le déclencheur y pousse ses lignes)
        const log = [...b.log, ev('move', t('cs.runStumble', { name: c.label, skill, roll: pr.result.roll === 100 ? '00' : pr.result.roll }), c.id)];
        set({ battle: { ...b, action: null, runBudget: range, reachable: new Map(), preview: null, log } });
        bus.emit(EVT.SCENE_DIRTY);
        return;
      }
      const sub = path.slice(0, stopIdx + 1);
      const cost = reach.get(`${stop.x},${stop.y}`) ?? sub.length;
      const fromPos = { ...c.pos! };
      placeCombatant(c, scene, stop);
      if (geom !== c) placeCombatant(geom, scene, stop); // la monture court sous le cavalier
      noteApproachMove(c, fromPos); // LDB 21 l.27 — la Course est une Action : `markActed` scelle l'événement plus bas
      displaceSmaller(get, geom);
      get().faceFromPath(c.id, sub);
      if (geom !== c) get().faceFromPath(geom.id, sub);
      bus.emit(EVT.ANIM_MOVE, { id: c.id, path: sub });
      if (geom !== c) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path: sub });
      const short = stop.x !== pr.dest.x || stop.y !== pr.dest.y;
      // Budget du Tour étendu à Marche + Course + DR (l.80) : le reliquat non parcouru reste dépensable
      // en segments (A-M*) — `movementRemaining` lit `runBudget`.
      const b = markActed(get, set, get().battle!); // scellé AVANT la copie du journal (le déclencheur y pousse ses lignes)
      const log = [...b.log, ev('move', t('cs.run', { name: c.label, skill, roll: pr.result.roll === 100 ? '00' : pr.result.roll, cost, short: short ? t('cs.fragRunShort') : '' }), c.id)];
      set({ battle: { ...b, action: null, runBudget: range, movementUsed: (battle.movementUsed ?? 0) + cost, reachable: new Map(), preview: null, log } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    runCancel: () => set({ pendingRun: null, hoverDelta: null }),

    // ── Manœuvre navale (MDG 13) : le barreur (héros ACTIF, à la barre) dépense son Action pour un Test
    //    de Navigation → vire le cap (re-mappe les bordées) + avance la coque. « Un jet = une Action » : le
    //    jet passe par pendingShipManeuver, `acted` consommé au confirm. La direction se choisit au pré-jet. ──
    battleShipManeuver: (id: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || active.id !== id || aiDriven(get(), active) || !canTakeAction(active)) return;
      // À l'échelle MER, le NAVIRE est l'acteur (`id` = la coque, barreur = meilleur de l'équipage) ; au person-scale,
      // un héros-équipage prend la barre (`id` = le héros, navire dérivé via `shipOfCrew`).
      const ship = isVehicle(active) ? active : shipOfCrew(battle.combatants, id);
      if (!ship) return;
      const opened = openCrewTestPending(get, ship, 'manoeuvre');
      if (!opened) return; // aucun rôle tenu → le navire ne peut pas manœuvrer
      set({
        pendingShipManeuver: { shipId: ship.id, turnSteps: 0, ...opened },
        battle: { ...battle, action: null, preview: null },
      });
      // Auto-roule les TÉMOINS (marins PNJ) — leur jet initial est résolu sans influence (cf. makeRollFlow).
      for (const part of opened.participants) if (!part.interactive) get().shipManeuverRoll(part.id);
    },
    shipManeuverSetTurn: (steps: number) => {
      const p = get().pendingShipManeuver;
      if (p) set({ pendingShipManeuver: { ...p, turnSteps: steps } }); // virage ⟂ jet (le Test ne dépend pas du sens)
    },
    shipManeuverConfirm: () => {
      const { battle, pendingShipManeuver: p } = get();
      if (!battle || !p) return;
      if (p.participants.some((x) => !x.result)) return; // tous les contributeurs doivent avoir lancé
      const ship = inBattleId(battle, p.shipId);
      if (!ship) return;
      const total = maneuverCrewTotal(p.participants, p.essentialRoleId, p.moraleScore, p.undercrew, p.extraDR); // Σ DR (essentiel ×2) + Moral + Manque de bras + sabotage
      const result = deriveManeuverFromCrew(ship, total); // virage si le Test d'équipage est réussi (MDG 14 l.13)
      set({ pendingShipManeuver: null });
      applyShipManeuver(get, p.shipId, result, p.turnSteps); // vire (si succès) + avance ; logue
      const bM = get().battle!;
      set({ battle: { ...markActed(get, set, bM), action: null, preview: null, crewActed: withCrewActed(bM.crewActed, p.shipId, p.participants.map((x) => x.id)) } }); // un jet = une Action ; marins engagés ce Round
      bus.emit(EVT.SCENE_DIRTY);
    },
    shipManeuverCancel: () => set({ pendingShipManeuver: null }),

    // ── BORDÉE (« Tir de batterie », MDG 14 l.128) — JUMEAU de la manœuvre : Test d'équipage MULTI des Artilleurs (★),
    //    dont le DR PARTAGÉ remplace le jet de chaque pièce du bord qui porte. `battleShipBattery(shipId, targetId)` ouvre
    //    la modale (le bord est dérivé de la cible via `targetArc`) ; `shipBatteryConfirm` résout la volée (`resolveVolley`). ──
    battleShipBattery: (shipId: string, targetId: string) => {
      const battle = get().battle;
      if (!battle) return;
      const ship = inBattleId(battle, shipId);
      const target = inBattleId(battle, targetId);
      if (!ship || !target || !ship.pos || !target.pos) return;
      // ARC et PORTÉE jugés AU COMMIT, par la MÊME mesure que le survol (`batteryBlock`) : sans elle, le
      // clic tirait hors de portée, et l'arc ne se disait qu'au journal — invisible en combat.
      const block = batteryBlock(get, ship, target);
      if (block) return void refuserGeste(get, set, block.detail);
      const side = targetArc(get().facing[ship.id] ?? 'N', ship.pos, target.pos); // bord qui porte (auto-dérivé de la cible)
      const opened = openCrewTestPending(get, ship, 'batterie'); // Artilleurs (UN jet/poste)
      if (!opened) return; // aucun Artilleur apte → pas de bordée
      set({
        pendingShipBattery: { shipId: ship.id, targetId: target.id, side, ...opened },
        battle: { ...battle, action: null, preview: null },
      });
      for (const part of opened.participants) if (!part.interactive) get().shipBatteryRoll(part.id); // témoins (marins PNJ) auto-roulés
    },
    shipBatteryConfirm: () => {
      const { battle, pendingShipBattery: p } = get();
      if (!battle || !p) return;
      if (p.participants.some((x) => !x.result)) return; // tous les Artilleurs doivent avoir lancé
      const ship = inBattleId(battle, p.shipId);
      const target = inBattleId(battle, p.targetId);
      if (!ship || !target) { set({ pendingShipBattery: null }); return; }
      const dr = maneuverCrewTotal(p.participants, p.essentialRoleId, p.moraleScore, p.undercrew, p.extraDR); // DR PARTAGÉ (Σ, essentiel ×2, + Moral, + Manque de bras, + sabotage)
      set({ pendingShipBattery: null });
      applyBatteryVolley(get, set, ship, target, p.side, dr, crewTestSuccess(dr)); // corps de bordée PARTAGÉ (mêmes fns pures) — cf. shipAutoBattery
      const bB = get().battle!;
      set({ battle: { ...bB, action: null, preview: null, crewActed: withCrewActed(bB.crewActed, p.shipId, p.participants.map((x) => x.id)) } }); // Artilleurs engagés ce Round
      checkBattleOver(get, set);
      bus.emit(EVT.SCENE_DIRTY);
    },
    shipBatteryCancel: () => set({ pendingShipBattery: null }),

    // ── AUTO-PILOTE : bordée HEADLESS (aucun pending) — l'IA de coque (couche Mer) lâche une bordée sur un navire
    //    ennemi. Le Test d'équipage des Artilleurs se résout SANS modale (`resolveCrewTestByRoles`, équipage abstrait
    //    l.39 : les rôles nominaux tenus arment les pièces, le Manque de bras est LA pénalité RAW) → DR partagé,
    //    puis le MÊME corps de bordée que le joueur (`applyBatteryVolley`). Renvoie true si des pièces ont fait feu. ──
    shipAutoBattery: (shipId: string, targetId: string): boolean => {
      const battle = get().battle;
      if (!battle) return false;
      const ship = inBattleId(battle, shipId);
      const target = inBattleId(battle, targetId);
      if (!ship || !target || !ship.pos || !target.pos) return false;
      const side = targetArc(get().facing[ship.id] ?? 'N', ship.pos, target.pos); // bord qui porte (auto-dérivé de la cible)
      if (!bearingPostes(ship, side).length) return false; // aucune pièce chargée sur ce bord → rien à lâcher
      const assignments = shipCrewAssignments(ship, battle.combatants, 'batterie'); // équipage abstrait → rôles tenus (Artilleur ★)
      const undercrew = shipUndercrew(get, ship, battle.combatants);
      const traits = hullNavalTraits(ship);
      const extraDR = shipSaboteurDR(ship) + navalTestTypeDR(traits, 'batterie');
      // DR partagé calé sur le chemin JOUEUR (`maneuverCrewTotal`) : Σ contributions (essentiel ×2) + Moral +
      // Manque de bras (−2/tranche) + sabotage/traits ; plafonné à un Succès Minime dès qu'une tranche manque (l.55).
      const crewTest = resolveCrewTestByRoles(assignments, 'batterie', 'intermediaire', shipMoraleScore(get, ship), battleRng(), { extraDR: undercrew.dr + extraDR });
      const dr = undercrew.capSuccesMinime ? capToSuccesMinime(crewTest.total) : crewTest.total;
      applyBatteryVolley(get, set, ship, target, side, dr, crewTestSuccess(dr));
      const bB = get().battle!;
      const gunners = assignments.map((a) => a.crew.id);
      set({ battle: { ...bB, crewActed: withCrewActed(bB.crewActed, shipId, gunners) } }); // équipage engagé ce Round (Manque de bras / cumul, l.53)
      checkBattleOver(get, set);
      bus.emit(EVT.SCENE_DIRTY);
      return true;
    },

    // ── TEST D'ÉQUIPAGE GÉNÉRIQUE (MDG 14, « Types de Test d'équipage ») — 3ᵉ jumeau de la manœuvre/bordée,
    //    paramétré par `testTypeId`. Câblé en COMBAT : **Rude épreuve** (l.106-114 — « les gens ont peur de ce
    //    que pourrait prochainement subir le bateau ») : un total NÉGATIF réduit le Moral d'autant (l.110),
    //    persisté sur le navire de campagne. Les types de NAVIGATION/VOYAGE réutiliseront ce pending (7b). ──
    battleCrewTest: (shipId: string, testTypeId: string) => {
      if (combatBusy(get())) return;
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || aiDriven(get(), active) || !canTakeAction(active)) return;
      const ship = isVehicle(active) && active.id === shipId ? active : shipOfCrew(battle.combatants, active.id);
      if (!ship || ship.id !== shipId || !findCrewTestTypeById(testTypeId)) return;
      const opened = openCrewTestPending(get, ship, testTypeId);
      if (!opened) return; // aucun rôle tenu → pas de Test d'équipage
      set({
        pendingCrewTest: { shipId: ship.id, testTypeId, ...opened },
        battle: { ...battle, action: null, preview: null },
      });
      for (const part of opened.participants) if (!part.interactive) get().crewTestRoll(part.id); // témoins auto-roulés
    },
    crewTestConfirm: () => {
      const { battle, pendingCrewTest: p } = get();
      if (!p) return;
      if (p.participants.some((x) => !x.result)) return; // tous les contributeurs doivent avoir lancé
      if (!battle) return;
      const ship = inBattleId(battle, p.shipId);
      if (!ship) { set({ pendingCrewTest: null }); return; }
      const total = maneuverCrewTotal(p.participants, p.essentialRoleId, p.moraleScore, p.undercrew, p.extraDR);
      set({ pendingCrewTest: null });
      const testType = findCrewTestTypeById(p.testTypeId);
      const label = testType?.label ?? p.testTypeId;
      get().log(t('cs.crewTest', { label, ship: ship.label, dr: total >= 0 ? `+${total}` : `${total}`, outcome: crewTestSuccess(total) ? t('cs.crewTestOk') : t('cs.crewTestKo') })); // MDG 14 l.13
      // ISSUE PAR TYPE — le type de Test DÉCLARE que son total négatif coûte du Moral (MDG 14 l.110).
      // Persiste sur le navire de campagne.
      if (testType?.moraleOnNegativeDR) {
        for (const l of applyShipMoraleDelta(get, set, ship, rudeEpreuveMoraleDelta(total))) get().log(l);
      }
      const bC = get().battle!;
      set({ battle: { ...markActed(get, set, bC), action: null, preview: null, crewActed: withCrewActed(bC.crewActed, p.shipId, p.participants.map((x) => x.id)) } }); // un jet = une Action ; marins engagés ce Round
      bus.emit(EVT.SCENE_DIRTY);
    },
    crewTestCancel: () => set({ pendingCrewTest: null }),

    // ── CHANSON DE MARIN (Talent, MDG 09 l.32-40) : le chanteur (équipage doté du Talent) choisit une
    //    chanson CONNUE (spec du Talent) puis lance son Test de Divertissement (Chant) ; réussi → l'effet
    //    (`crewOps`/`captainOps`) couvre l'équipage 3 min + DR. Tâche PARALLÈLE du tour du navire (comme
    //    Recharger : le chant occupe le CHANTEUR, pas l'Action du navire) ; une chanson par QUART (l.40). ──
    battleSingShanty: (shipId: string) => {
      if (combatBusy(get())) return;
      const battle = get().battle;
      if (!battle || battle.over) return;
      const ship = inBattleId(battle, shipId);
      if (!ship || ship.lastShantyQuart === quartIndex(get().gameTime)) return; // « une seule chanson … par quart »
      const crew = exposedCrew((ship.crewIds ?? []).map((id) => inBattleId(battle, id)).filter((c): c is Combatant => !!c));
      // Le CHANTEUR : le marin apte au Talent qui connaît le plus de chansons (les specs = chansons apprises, l.36).
      const singer = crew.filter((c) => knownShanties(c).length > 0 && !c.singingShanty)
        .sort((a, b) => knownShanties(b).length - knownShanties(a).length)[0];
      if (!singer) return;
      const known = knownShanties(singer);
      set({
        pendingShanty: { shipId: ship.id, singerId: singer.id, shantyId: known.length === 1 ? findSeaShantyById(known[0])?.id ?? null : null, result: null },
        battle: { ...battle, action: null, preview: null },
      });
    },
    shantySetSong: (shantyId: string) => {
      const p = get().pendingShanty;
      if (p && !p.result) set({ pendingShanty: { ...p, shantyId } }); // choix pré-jet (chanson ⟂ dé)
    },
    shantyConfirm: () => {
      const { battle, pendingShanty: p } = get();
      if (!battle || !p || !p.result || !p.shantyId) return;
      const ship = inBattleId(battle, p.shipId);
      const singer = inBattleId(battle, p.singerId);
      set({ pendingShanty: null });
      if (!ship || !singer) return;
      if (p.result.success) {
        for (const l of applyShantyToCrew(get, ship, singer, p.shantyId, p.result.sl)) get().log(l);
      } else {
        ship.lastShantyQuart = quartIndex(get().gameTime); // la chanson a été chantée (30 s) — le quart est consommé, sans effet
        get().log(t('cs.shantyFail', { name: singer.label }));
      }
      set({ battle: { ...get().battle! } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    shantyCancel: () => set({ pendingShanty: null }),

    // ── Approche d'une source de Peur (LDB 21 l.27) : Test de Calme Intermédiaire (+0) qui DIFFÈRE le
    //    clic d'approche. Succès → fearGate 'passed' (approches libres ce Tour) + l'intention est relancée ;
    //    échec → fearGate 'failed' (aucune approche ce Tour). « Un jet = une modale ». ──
    approachConfirm: () => {
      const { battle, pendingApproach: pa } = get();
      if (!battle || !pa || !pa.result) return;
      const c = inBattleId(battle, pa.combatantId);
      const src = inBattleId(battle, pa.sourceId);
      set({ pendingApproach: null });
      if (!c) return;
      const ok = pa.result.success;
      const log = [...battle.log, ev('fear', ok
        ? t('cs.courageYes', { name: c.label, src: pa.sourceName })
        : t('cs.courageNo', { name: c.label, src: pa.sourceName }), c.id, src?.id)];
      set({ battle: { ...get().battle!, fearGate: ok ? 'passed' : 'failed', log } });
      if (ok) {
        // Relance l'intention différée (le gate est 'passed') AVEC son verdict d'armement :
        // l'intention qui l'a produite a été dissoute par le premier clic, la relire ici refuserait le
        // geste que le joueur vient de gagner à son Test de Calme.
        if (pa.intent.kind === 'tile') get().battleClickTile(pa.intent.pt, { confirm: true, courseArmee: pa.intent.courseArmee });
        else get().battleClickEntity(pa.intent.id, { confirm: true, approche: pa.intent.approche });
      }
      bus.emit(EVT.SCENE_DIRTY);
    },
    approachCancel: () => set({ pendingApproach: null }), // renonce avant le jet : aucune trace, re-cliquable

    // ── Bénédiction de Protection (LDB 41 l.142) : Test de FM Accessible (+20) qui DIFFÈRE la déclaration
    //    d'attaque sur une cible bénie. Succès → l'attaque est relancée (`wardCleared` saute ce gate) ;
    //    échec → l'attaque n'a pas lieu (rien n'est consommé). « Un jet = une modale ». ──
    wardConfirm: () => {
      const { battle, pendingWard: pw } = get();
      if (!battle || !pw || !pw.result) return;
      const attacker = inBattleId(battle, pw.attackerId);
      const target = inBattleId(battle, pw.targetId);
      set({ pendingWard: null });
      if (!attacker || !target) return;
      const ok = pw.result.success;
      const log = [...battle.log, ev('info', ok
        ? t('cs.shameOvercome', { name: attacker.label, roll: pw.result.roll, target: String(pw.result.target ?? '?'), foe: target.label })
        : t('cs.shameBlocked', { name: attacker.label, foe: target.label }), attacker.id, target.id)];
      set({ battle: { ...get().battle!, log } });
      // Succès : relance la déclaration d'attaque (le gate est franchi pour CE clic via `wardCleared`).
      if (ok) get().battleClickEntity(pw.targetId, { confirm: true, wardCleared: true, approche: pw.approche });
      bus.emit(EVT.SCENE_DIRTY);
    },
    wardCancel: () => set({ pendingWard: null }), // renonce avant le jet : aucune trace, re-cliquable

    // ── Se relever d'À Terre — LDB 16 l.35 · LDB 18 l.15. Le Mouvement, pas l'Action. ──
    battleStandUp: () => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.movementUsed > 0) return;
      const active = activeCombatant(battle);
      // MÊME lecture que la case du registre (gate `remede-atteignable`) : hors d'état d'agir, aucun
      // geste ; État verrouillé, aucun retrait (LDB 18 l.15).
      if (!active || !controlsCombatant(get(), active) || isOutOfAction(active)) return;
      const inst = active.conditions.find((c) => c.id === COND.aTerre);
      if (!inst || isConditionLocked(inst, active)) return;
      removeCondition(active, COND.aTerre);
      set({ battle: { ...battle, movementUsed: mountMovement(battle, active), action: null, log: [...battle.log, ev('move', t('cs.standUp', { name: active.label }), active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // « Servir cette pièce » (MDG 12-13) : le héros ACTIF REJOINT un poste de siège adjacent — CHEF s'il est
    // non servi (arme octroyée, taguée mountSide ; tire au tour suivant via l'option 'poste'), sinon SUPPORT (Arme
    // d'équipe : occupe la pièce, compte dans l'Indice contre le sous-effectif, mais ne tire pas). MÊME mutation
    // KIND-AGNOSTIQUE (`serveAtPoste`) que l'IA et l'author-time ; `recomputeLoadout` canonicalise l'arme du chef.
    // GRATUIT (ne consomme PAS l'Action) : on s'approche au Mouvement, on sert, et on tire/pousse le MÊME
    // Round — servir une pièce n'est pas un usage, juste s'y installer. « Tout le monde peut servir une arme
    // de siège » (cf. l'IA `manPoste`).
    battleManPoste: (target?: { hullId: string; posteUid: string }) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || aiDriven(get(), active) || isOutOfAction(active) || !canTakeAction(active)) return;
      const servable = servablePostes(active, battle.combatants);
      // Cible EXPLICITE (clic sur la pièce) → CE poste précis ; sinon (bouton hotbar) → le 1er servable.
      const chosen = target && typeof target === 'object' && 'hullId' in target
        ? servable.find((sp) => sp.hull.id === target.hullId && sp.poste.item.uid === target.posteUid)
        : servable[0];
      if (!chosen) return;
      const joining = isPosteManned(chosen.poste, battle.combatants); // pièce déjà servie → on REJOINT en renfort
      serveAtPoste(active, chosen.poste, battle.combatants);
      recomputeLoadout(active);
      set({ battle: { ...battle, action: null, log: [...battle.log, ev('detail', t(joining ? 'cs.joinPoste' : 'cs.manPoste', { name: active.label, weapon: chosen.poste.item.label }), active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    // « Quitter la pièce » (release) : le héros actif lâche le poste qu'il sert → il redevient servable par un autre.
    // `leaveChef` retire le lien + l'équipage + l'arme ; `recomputeLoadout` re-dérive sans la pièce. Coûte l'Action.
    // GRATUIT (ne consomme PAS l'Action, LDB 13 l.106 « Actions gratuites » : quitter un poste ne nécessite
    // aucun Test → action gratuite comme rengainer). Symétrique de `battleManPoste`.
    battleLeavePoste: () => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || aiDriven(get(), active)) return;
      const poste = active.mannedPoste;
      if (!poste) return;
      const weapon = poste.item.label;
      leaveChef(active, poste, battle.combatants);
      recomputeLoadout(active);
      set({ battle: { ...battle, action: null, log: [...battle.log, ev('detail', t('cs.leavePoste', { name: active.label, weapon }), active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    // « Pousser » un engin de siège CREWÉ à roues (ADE II 8 l.258, Lot 2 #156) : ouvre le mode de
    // ciblage-CASE 'push' — le clic-sol suivant (PUSH_MODE.commitTile, targetingModes.ts) commet la
    // translation de la formation. Gate : chef d'un poste MOBILE (`pushEligible`), Action dispo, Équipe ≥
    // moitié requise (`pushCrewOk`, sinon no-op — comme un tir sous-effectif refusé, `firedAttackBlock`).
    // Ne consomme RIEN ici (la dépense de l'Action a lieu au COMMIT, comme `battleClickTile`/`battleManPoste`).
    battlePushEngine: () => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      const scene = get().scene;
      if (!battle || battle.over || !scene) return;
      // Toggle (parité cast/heal) : re-cliquer « Pousser » alors qu'on est déjà en mode 'push' ferme le mode
      // (retour neutre, reachable purgé) sans consommer l'Action.
      if (battle.action === 'push') { set({ battle: { ...battle, action: null, reachable: new Map(), preview: null } }); bus.emit(EVT.SCENE_DIRTY); return; }
      const active = activeCombatant(battle);
      // Pousser = le MOUVEMENT (pas l'Action) : bloqué si le Mouvement du chef est déjà dépensé, PAS si l'Action
      // a été prise (on peut pousser puis assener, ou l'inverse — ordre libre, LDB 13 l.79). Et pas davantage
      // si l'Action lui est INTERDITE : un chef Sonné garde son Mouvement (LDB 16 l.125 — « incapable
      // d'effectuer votre Action […] vous ne pouvez vous déplacer que de la moitié de votre Mouvement »),
      // il pousse donc, à demi-budget. Ce que l'engin exige, c'est du MOUVEMENT — et le budget d'un
      // porteur cloué (Inconscient/Surpris, `gating.movement:'none'`) vaut déjà 0, ce que la ligne suivante
      // refuse. Exiger `canTakeAction` ici faisait mentir le coût déclaré au registre.
      if (!active || !controlsCombatant(get(), active) || !pushEligible(active) || (battle.movementUsed ?? 0) >= mountMovement(battle, active)) return;
      const poste = active.mannedPoste!;
      const hull = posteHullOf(poste, battle.combatants);
      const w = mannedPosteWeapon(active, poste);
      if (!hull || !hull.pos || !active.pos || !w || !pushCrewOk(poste, w, battle.combatants)) return;
      const reach = pushReachable(battle, scene, active, hull);
      set({ battle: { ...battle, action: 'push', reachable: reach, preview: null } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    // « Diriger l'équipe » (Commandant d'équipe, AA 13 l.29-35) : le Personnage doté du Talent aide une équipe
    // servant une Arme d'équipe à portée de voix — Test de Commandement Intermédiaire (+0) RÉUTILISÉ (openSkillTest/
    // pendingTest, LANCEUR restreint à l'acteur actif ; Soutien laissé au régime général du § Soutien,
    // LDB 12 l.187-198). Sur réussite, chaque chef dirigé est lié au commandant (op
    // `teamCommander`) → son équipe tire ensuite au score de Projectiles du commandant (substitution `attackEnv`).
    battleAidTeam: () => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || aiDriven(get(), active) || isOutOfAction(active) || !canTakeAction(active) || !hasCommandTeam(active)) return;
      const chiefs = teamCommandTargets(active, battle.combatants);
      if (!chiefs.length) return;
      const onSuccess: Flow = {
        kind: 'seq',
        steps: chiefs.map((c) => ({ kind: 'do', effect: { type: 'ops', on: 'hero', heroId: c.id, ops: [{ op: 'teamCommander', commanderId: active.id }] } })),
      };
      set({ battle: { ...markActed(get, set, battle), action: null } }); // le Test EST l'Action (réussite ou non)
      openSkillTest(get, set,
        { skill: { id: 'commandement' }, difficulty: 'intermediaire', label: 'Commandant d’équipe', stake: combatStakeRef('teamCommand') },
        onSuccess, EMPTY_FLOW, EMPTY_FLOW, { actorId: active.id });
      bus.emit(EVT.SCENE_DIRTY);
    },

    battleEndTurn: () => {
      if (combatBusy(get())) return; // finir le tour sous un flux différé corromprait l'état
      advanceTurn(get, set);
    },
    /** ARMEMENT du garde-fou « tour gâché » : le 1er geste de fin de tour EMPREINT l'économie du tour
     *  (`turnEconomyStamp`), le 2ᵉ passe la main. L'état vit dans `battle` — donc répliqué (l'invité
     *  voit son propre armement revenir de l'hôte) et lisible par la plaque de sortie. La POLITIQUE
     *  (quand armer) appartient à l'entrée de registre `end-turn`, porte unique des deux surfaces. */
    armEndTurn: () => {
      const b = get().battle;
      if (!b || b.over) return;
      set({ battle: { ...b, endTurnArmed: turnEconomyStamp(b) } });
    },

    // ── Chance, 3e usage : pré-emption d'initiative en début de Round (LDB 17 l.25) ──
    roundStartPromote: (heroId: string) => {
      const { battle, pendingRoundStart } = get();
      if (!battle || !pendingRoundStart) return;
      const hero = inBattleId(battle, heroId);
      // Réordonnancement d'initiative : arme Rapide (LDB 62 l.298-300) → gratuit ; sinon 1 point de Chance
      // (LDB 17 l.25). Tir rapide (interruption hors de l'ordre, LDB 11 l.97-103) ne passe PAS par ici (`preemptRangedShot`).
      const free = !!hero && canStrikeFirst(hero.weapons);
      if (!hero || !controlsCombatant(get(), hero) || (!free && (hero.fortune ?? 0) <= 0)) return;
      if (battle.order[0] === heroId) return; // déjà en tête
      if (!free) hero.fortune = (hero.fortune ?? 0) - 1;
      const order = [heroId, ...battle.order.filter((id) => id !== heroId)]; // en tête de l'ordre du Round
      set({ battle: { ...battle, order, log: [...battle.log, ev('info', t('cs.actFirst', { name: hero.label, reason: free ? t('cs.reasonFast') : t('cs.reasonLuck') }), hero.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    // ── Tir rapide (talent, LDB 11 l.97-103) : INTERRUPTION à distance en début de Round, hors de l'ordre d'Initiative ──
    preemptRangedShot: (heroId: string, targetId: string) => {
      const { battle, pendingRoundStart } = get();
      if (!battle || !pendingRoundStart || get().pendingAttack) return;
      const hero = inBattleId(battle, heroId);
      const target = inBattleId(battle, targetId);
      if (!hero || !controlsCombatant(get(), hero) || !canPreemptRanged(hero) || hero.loseNextAction) return; // 1 interruption / Round (loseNext = déjà tiré)
      if (!target || target.kind === hero.kind || isOutOfAction(target)) return;
      // Cible VALIDE seulement (arme à distance + bande de portée + Ligne de Vue) — sinon on N'OUVRE PAS la
      // modale (le tir résolu hors-tour heurterait la cascade). Le refus se DIT au point du geste
      // (`refusVisible`) : le survol, lui, ne montre plus rien sur une cible invalide (arbitrage 2026-08-24).
      const weapon = firedWeapon(hero, target, undefined, battle.combatants);
      const scene = get().scene;
      const blocked = !!(hero.pos && target.pos && scene) && !losClear(scene, hero.pos, target.pos, smokeOf(battle));
      // Chaque cause dit LA SIENNE : une cible hors de portée n'annonce pas un mur qui n'existe pas.
      if (weapon.type !== 'ranged') return void refuserGeste(get, set, t('cs.refusTirArmeDeMelee', { weapon: weapon.label }));
      if (!inFiringBand(hero, target, weapon, sceneMetresPerTile(scene))) return void refuserGeste(get, set, t('cf.outOfRange'));
      if (blocked) return void refuserGeste(get, set, t('cf.noLoSMasked'));
      // Le tir se résout par la modale de jet NORMALE (attackRoll/attackConfirm) ; le tireur n'est PAS actif.
      // `pendingAttack.interrupt` → attackConfirm applique le tir sans avancer le tour + épuise son tour normal.
      // La modale d'attaque est rendue par la CASCADE (CascadeModal → useAttackJetProps), comme TOUTE attaque :
      // on ouvre donc une cascade à une étape `jet:'attack'` pour le tireur (refermée par attackConfirm).
      // `heldGround: true` : l'interruption est un tir IMMOBILE d'office (elle coûte le Mouvement du tour) → pas
      // de pénalité « Tir en bougeant » (LDB 14), qui n'aurait aucun sens hors du tour du tireur.
      openAttackCascade(get, set, { attackerId: hero.id, targetId: target.id, location: null, result: null, interrupt: true, heldGround: true }, 'Tir rapide', 'action/shoot');
    },
    // ── Tir rapide : ARMER/DÉSARMER la visée d'un héros pendant la pause (badge de la frise → clic adversaire) ──
    armPreempt: (heroId: string | null) => {
      const { battle, pendingRoundStart } = get();
      if (!battle || !pendingRoundStart || heroId === null) { set({ preemptAiming: null }); return; }
      const hero = inBattleId(battle, heroId);
      if (!hero || !controlsCombatant(get(), hero) || !canPreemptRanged(hero) || hero.loseNextAction) { set({ preemptAiming: null }); return; }
      set({ preemptAiming: get().preemptAiming === heroId ? null : heroId }); // bascule
    },
    roundStartReady: (seat: number) => {
      const prs = get().pendingRoundStart;
      if (!prs) return;
      const readyBySeat = { ...(prs.readyBySeat ?? {}), [seat]: true };
      set({ pendingRoundStart: { ...prs, readyBySeat } });
      // L'HÔTE lance quand TOUS les sièges requis ont validé (quorum UNIQUE : `siegesRequis`).
      const s = get();
      if (s.net.mode === 'guest') return; // l'invité ne fait que marquer (l'intent porte son siège)
      if (quorumAtteint(s, readyBySeat)) get().confirmRoundStart();
    },
    confirmRoundStart: () => {
      set({ pendingRoundStart: null, preemptAiming: null }); // la pause se ferme → toute visée Tir rapide armée retombe
      runPreemptShots(get, set); // Tir rapide de l'IA (LDB 11 l.97-103) : tirs d'interruption AVANT les tours du Round — tous Rounds, tous modes
      const battle = get().battle;
      if (!battle || battle.over) return; // un tir d'interruption a pu clore le combat
      // Premier combattant valide de l'ordre (réordonné) à partir de l'index 0.
      let turn = 0;
      for (let i = 0; i < battle.order.length; i++) {
        const c = inBattleId(battle, battle.order[i]);
        if (c && !isOutOfAction(c)) {
          turn = i;
          break;
        }
      }
      const active = inBattleId(battle, battle.order[turn]);
      let movementUsed = 0;
      let acted = false;
      if (active) {
        active.defensiveStance = false;
        // Le tour peut s'ouvrir avec Action/Mouvement DÉJÀ dus (Maladresse Oups! 61-80 ; Tir rapide : le tour
        // NORMAL du tireur est épuisé, LDB 11 l.97-103) — le tour a bien lieu (effets début/fin) mais sans pouvoir agir.
        if (active.loseNextMovement) { movementUsed = mountMovement(battle, active); active.loseNextMovement = false; battle.log.push(ev('detail', t('cf.loseMovement', { name: active.label }), active.id)); }
        if (active.loseNextAction) { acted = true; active.loseNextAction = false; battle.log.push(ev('detail', t('cf.loseAction', { name: active.label }), active.id)); }
      }
      fireTurnStartTriggers(get, set, active); // effets de bord « début de tour » du 1ᵉʳ combattant du Round (inerte sans donnée)
      // Gate d'action par Round (op `actGate` — Mandragore) du 1ᵉʳ combattant du Round : même couture
      // que dans advanceTurn (héros manuel → étape influençable ; IA/auto → inline foldé au budget).
      const gate = active ? resolveActGates(get, set, active) : { loseMovement: false, lines: [] };
      if (active) for (const line of gate.lines) battle.log.push(ev('detail', line, active.id));
      if (gate.loseMovement && movementUsed === 0 && active) movementUsed = mountMovement(battle, active);
      set({ battle: { ...battle, turn, action: null, movementUsed, movedPreAction: false, acted, reachable: new Map() } });
      if (checkBattleOver(get, set)) return;
      bus.emit(EVT.SCENE_DIRTY);
      // Psychologie de DÉBUT de Round (LDB 21 l.9) : Traits ciblés (Animosité/Haine/…) + nouvelles
      // Terreurs → UNE cascade (un héros par étape) qui suspend l'IA jusqu'à résolution.
      openRoundStartPsych(get, set);
      if (get().pendingCascade) return; // la cascade tient la main ; sa fermeture reprendra l'IA
      maybeRunEnemyTurn(get, set);
    },

    /** Reprise après un CHANGEMENT DE CADENCE en plein combat. La cadence vit dans le registre de RÈGLES
     *  (engine/policy), pas dans le store → la passer en Auto/Rapide ne traverse NI la boucle de tours NI la
     *  souscription de `combatAuto` (aucun `set`) : le combat se figeait sur le tour courant. On RÉ-ENTRE donc
     *  explicitement : `tickCombatAuto` auto-résout une éventuelle modale ouverte, `maybeRunEnemyTurn` joue le
     *  tour de l'acteur si l'IA le pilote. No-op en mode manuel / hors combat (gardes internes). */
    resumeCadence: () => {
      const b = get().battle;
      if (!b || b.over) return;
      tickCombatAuto(get, set);
      maybeRunEnemyTurn(get, set);
    },

    // ── Destin sacrifié (LDB 17 l.31-35) — résolution de la suspension pendingFateSave ──
    fateNegate: () => {
      const { battle, pendingFateSave: p } = get();
      if (!battle || !p || p.source !== 'hit') return; // « Comment ça a pu rater ? » : coup létal seulement
      const hero = inBattleId(battle, p.heroId);
      set({ pendingFateSave: null });
      if (!hero) return;
      hero.fate = (hero.fate ?? 0) - 1;
      if (p.restoreWounds != null) hero.wounds.current = p.restoreWounds; // annule tout le coup (restaure les PB)
      hero.criticalWounds = Math.max(0, (hero.criticalWounds ?? 0) - 1);
      const anim = acquireAnimositeOnFate(hero, p.foeCible); // ADE II Annexe I (règle facultative)
      set({ battle: { ...battle, log: [...battle.log, ev('info', t('cs.fateDodge', { name: hero.label }), hero.id), ...(anim ? [ev('fear', anim, hero.id)] : [])] } });
      resumeEnemyTurn(get, set);
    },
    fateSurvive: () => {
      const { battle, pendingFateSave: p } = get();
      if (!battle || !p) return;
      const hero = inBattleId(battle, p.heroId);
      const source = p.source;
      set({ pendingFateSave: null });
      if (!hero) return;
      hero.fate = (hero.fate ?? 0) - 1;
      hero.outOfRencontre = true; // survit mais éjecté de la rencontre (vivant)
      hero.exitReason = 'destin'; // #237 : lu « hors-combat » (endState)
      if (!hero.conditions.some((c) => c.id === COND.inconscient)) addCondition(hero, COND.inconscient);
      const anim = acquireAnimositeOnFate(hero, p.foeCible); // ADE II Annexe I (règle facultative)
      set({ battle: { ...battle, log: [...battle.log, ev('info', t('cs.fateFlee', { name: hero.label }), hero.id), ...(anim ? [ev('fear', anim, hero.id)] : [])] } });
      if (source === 'slow') resolveRoundBoundary(get, set);
      else resumeEnemyTurn(get, set);
    },
    fateAccept: () => {
      const { battle, pendingFateSave: p } = get();
      if (!battle || !p) return;
      const hero = inBattleId(battle, p.heroId);
      const source = p.source;
      set({ pendingFateSave: null });
      if (hero) {
        hero.dead = true;
        set({ battle: { ...battle, log: [...battle.log, ev('death', t('cs.succumb', { name: hero.label }), hero.id)] } });
      }
      if (source === 'slow') resolveRoundBoundary(get, set);
      else resumeEnemyTurn(get, set);
    },

    battleDefendTotal: () => {
      if (!rule('combat-defensive-stance')) return; // règle optionnelle : Action « Sur la Défensive » désactivée (LDB 13 l.118)
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active)) return;
      if (!canTakeAction(active)) return; // Sonné : pas d'Action (LDB 16 l.125)
      active.defensiveStance = true;
      active.aiming = false; // une autre action que le tir gâche la visée
      set({ battle: { ...markActed(get, set, battle), action: null, log: [...battle.log, ev('defensive', t('cs.defensive', { name: active.label }), active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Changer de set d'armes en combat (Action gratuite LDB 13 l.106 ; plafond MAISON 1×/tour, AUTORISÉ même Engagé) ──
    battleSwitchLoadout: (loadoutId: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.loadoutSwapped) return; // plafond maison 1×/tour
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || active.activeLoadoutId === loadoutId) return;
      loadoutSetActive(active, loadoutId);
      recomputeLoadout(active); // re-dérive les armes actives du combattant
      const lo = active.loadouts?.find((l) => l.id === loadoutId);
      const name = lo ? loadoutLabel(lo, active) : 'set';
      set({ battle: { ...battle, loadoutSwapped: true, log: [...battle.log, ev('detail', t('cs.draw', { name: active.label, weapon: name }), active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Action Viser (LDB table des Difficultés, 14 - _GoBack.md l.90 : +20 au prochain tir, sans jet) ──
    battleAim: () => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || !canTakeAction(active)) return;
      if (!active.weapons.some((w) => w.type === 'ranged')) return; // viser = pour le tir
      active.aiming = true;
      set({ battle: { ...markActed(get, set, battle), action: null, log: [...battle.log, ev('aim', t('cs.aim', { name: active.label }), active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    // Perturbante (LDB 62 l.272-274) : arme le mode « Repousser » — la prochaine attaque réussie
    // repousse d'1 m/DR AU LIEU de causer des Dégâts. Simple bascule (pas une Action).
    battleTogglePushback: () => {
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || !active.weapons.some((w) => w.type === 'melee' && canPushback(w))) return;
      active.pushbackMode = !active.pushbackMode;
      set({ battle: { ...battle } });
    },

    // Posture de TIR pré-armée (spec HUD §1a G5) : le choix se pose AVANT toute cible, sur le
    // combattant actif (`battle.stances`), et la construction du `PendingAttack` le consomme
    // (`withArmedStance`, combatFlow). Bascule, pas une Action ; le gate est le prédicat unique de
    // la posture (`STANCE_BLOCK`), celui-là même que la case de console affiche.
    battleToggleStance: (stance: ShootingStanceKey) => {
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active)) return;
      if (STANCE_BLOCK[stance](battle, active)) return;
      const armee = battle.stances?.[active.id] ?? {};
      set({ battle: { ...battle, stances: { ...battle.stances, [active.id]: { ...armee, [stance]: !armee[stance] } } } });
    },

    // ── Rechargement = Test étendu de Projectiles (LDB 62 l.335 + LDB 12 l.170-174) — par modale ──
    // `weaponUid` DÉSIGNE l'arme rechargée : chaque arme à distance a son cycle (arbitrage utilisateur
    // 2026-08-16 : « si j ai 2 armes à distance elles gèrent chacune leur propre rechargement et
    // munition »).
    // Absent → la 1re arme à distance DÉCHARGÉE du set.
    battleReload: (weaponUid?: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle } = get();
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || !canTakeAction(active)) return;
      const reloadable = (x: Weapon) => x.type === 'ranged' && (x.reload ?? 0) > 0 && !weaponLoaded(active, x);
      const w0 = weaponUid ? active.weapons.find((x) => x.uid === weaponUid) : active.weapons.find(reloadable);
      if (!w0 || !reloadable(w0)) return; // rien à recharger (Arc = pas de défaut, ou déjà chargée)
      // Pièce SERVIE en sous-effectif : recharge ×2 (MDG 12 l.462). Le bake reflète les servants APTES présents
      // (effectif complet → recharge normale) ; pour un chef sans poste → arme inchangée (cas héros qui sert seul).
      const present = servingCrewPresent(active, battle.combatants);
      const w = present != null ? crewedFireWeapon(w0, present) : w0;
      const skillValue = combatValue(active, 'ranged', w); // CT + avances Projectiles (Spé du groupe d'arme)
      set({
        pendingReload: {
          actorId: active.id,
          actorName: active.label,
          weaponUid: w.uid!,
          reload: reloadDRTarget(w), // sous-effectif baké (recharge ×2) ; arme NON-équipe ou effectif complet → ×1
          progressBefore: reloadProgressOf(active, w0),
          skillValue,
          difficulty: 'intermediaire',
          roll: null,
          target: rollLine({ actor: active, difficulty: 'intermediaire', valeur: skillValue, combat: { kind: 'ranged', weapon: w } }).target,
          sl: 0,
          success: false,
        },
      });
    },
    // RECHARGE D'UN POSTE DE NAVIRE (MDG 12 l.462 / LDB 62 l.333) — Test étendu de Projectiles du CHEF de
    // pièce, avec le SOUTIEN générique des autres servants (`soutienBonus`, LDB 12). Tâche d'équipage PARALLÈLE :
    // elle occupe les servants (`crewActed`) mais NE consomme PAS le tour du navire (≠ `acted`). Réutilise le flux
    // `FLOWS.reload` (mono-jet) ; la branche d'application vit dans `reloadConfirm` (cf. `pr.posteUid`).
    battleShipReload: (shipId: string, posteUid: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over) return;
      const ship = inBattleId(battle, shipId);
      const poste = ship?.postes?.find((p) => p.item.uid === posteUid);
      if (!ship || !poste || poste.loaded !== false) return; // pièce déjà chargée → rien à recharger
      const chef = poste.crewIds?.[0] ? inBattleId(battle, poste.crewIds![0]) : undefined;
      if (!chef) return;
      if ((battle.crewActed?.[ship.id] ?? []).includes(chef.id)) return; // chef déjà engagé ce Round → 1 Test de recharge/pièce/Round
      const servants = (poste.crewIds ?? []).map((id) => inBattleId(battle, id)).filter((c): c is Combatant => !!c);
      const w0 = mannedPosteWeapon(chef, poste);
      if (!w0) return;
      // Effectif EFFECTIF = même décompte que le tir (servants aptes ET à la bonne Projectiles, AA 10 l.230) : la
      // recharge ×2 du sous-effectif suit la MÊME source que `firedWeapon`. Repli `exposedCrew` si le chef ne
      // « sert » pas formellement le poste (`mannedPoste` absent — état construit sans `applyShipPostes`).
      const present = servingCrewPresent(chef, battle.combatants) ?? exposedCrew(servants).length;
      const w = crewedFireWeapon(w0, present); // ×2 recharge si sous-effectif ; arme-d-equipe retirée
      // Soutien (LDB 12, primitive GÉNÉRIQUE) : +10 par AUTRE servant capable (Projectiles Poudre noire), plafonné.
      // DISTINCT du Défaut Arme d'équipe (MDG 12 l.464, `crewedFireWeapon`/`exposedCrew` ci-dessus — headcount
      // requis pour armer la pièce) : ceci reste le Soutien générique LDB 12, adjacence (l.196) gatée pareil
      // qu'ailleurs en combat (`combatDistance`) — s'annule d'elle-même si `chef` n'a pas de `pos` propre
      // (équipage navire PASSAGER hors case, shipPostes.ts l.244-245).
      const sout = soutienDetail(servants, chef, 'projectiles', undefined, 'Poudre noire',
        chef.pos ? (c) => !!c.pos && combatDistance(chef, c) <= 1 : undefined);
      const skillValue = combatValue(chef, 'ranged', w) + sout.bonus;
      set({
        pendingReload: {
          actorId: chef.id, actorName: chef.label, weaponUid: w.uid!,
          reload: reloadDRTarget(w), progressBefore: poste.reloadProgress ?? 0,
          skillValue, difficulty: 'intermediaire', roll: null,
          target: rollLine({
            actor: chef, difficulty: 'intermediaire', valeur: skillValue,
            soutien: sout.bonus ? sout : undefined, combat: { kind: 'ranged', weapon: w },
          }).target, sl: 0, success: false,
          posteUid, shipId, soutien: sout.bonus ? sout : undefined,
        },
      });
    },
    reloadConfirm: () => {
      const { battle, pendingReload: pr } = get();
      if (!battle || !pr || pr.roll == null) return;
      // — Recharge d'un POSTE de navire : applique le DR cumulé à la PIÈCE (pas au champ `loaded` du marin) et
      //   occupe l'équipage du poste (équipage-ressource), sans consommer le tour du navire.
      if (pr.posteUid && pr.shipId) {
        const ship = inBattleId(battle, pr.shipId);
        const chef = inBattleId(battle, pr.actorId);
        const poste = ship?.postes?.find((p) => p.item.uid === pr.posteUid);
        set({ pendingReload: null });
        if (!ship || !chef || !poste) return;
        const w = chef.weapons.find((x) => x.uid === pr.weaponUid);
        const reloadTalent = pr.success ? reloadDRBonus(chef, w) : 0; // Rechargement rapide / Artilleur (LDB 10)
        const step = crewedReloadStep(w ?? ({ reload: pr.reload, qualities: [] } as never), pr.progressBefore, pr.sl + reloadTalent);
        if (step.done) loadWeapon(chef, w, poste); // couture UNIQUE : la PIÈCE porte son état de charge et sa munition capturée
        else setReloadProgress(chef, w, step.progress, poste);
        if (pr.success && reloadGrantsAssessAdvantage(chef)) campGain(get, chef, 1); // AA 13 l.9/90 : recharger = Action Évaluer → +1 Avantage (mode groupe)
        // ISSUE dérivée par le goulot (`FLOWS.reload.apply`, canal COMBAT) : le pending est FOURNI (il
        // vient d'être fermé), le `ctx` porte le DR réalisé et le nom résolu de la pièce.
        const crewIssue = FLOWS.reload.apply(get, { p: pr, ctx: { after: step.progress, weapon: w?.label ?? 'pièce' } });
        set({ battle: { ...battle, action: null,
          crewActed: withCrewActed(battle.crewActed, ship.id, poste.crewIds ?? []), // chef + servants OCCUPÉS ce Round
          log: [...battle.log, ...evLines(crewIssue, 'reload', chef.id)] } });
        bus.emit(EVT.SCENE_DIRTY);
        return;
      }
      const a = inBattleId(battle, pr.actorId);
      set({ pendingReload: null });
      if (!a) return;
      a.aiming = false; // recharger est une autre action → la visée est perdue
      // ARME rechargée = celle du pending (chaque arme à distance a SON cycle — arbitrage utilisateur
      // 2026-08-16 : « si j ai 2 armes à distance elles gèrent chacune leur propre rechargement et
      // munition ») ;
      // repli sur la 1re arme à distance pour un pending sans uid (état antérieur).
      const rw = a.weapons.find((x) => x.uid === pr.weaponUid) ?? a.weapons.find((x) => x.type === 'ranged');
      // Rechargement rapide / Artilleur (LDB 10) : +niveau DR au Test de rechargement (sur un jet réussi).
      const reloadTalent = pr.success ? reloadDRBonus(a, rw) : 0;
      // Cumul LDB 12 mutualisé (`extendedTestStep`, #273 Étape 1) : même arithmétique que le Test étendu
      // générique (plancher 0) — la cadence reste un-jet-par-Action (progressBefore persiste sur l'arme).
      const { total: progress, done } = extendedTestStep(pr.progressBefore, { success: pr.success, sl: pr.sl + reloadTalent }, pr.reload);
      if (done) {
        loadWeapon(a, rw); // couture UNIQUE : état de charge + munition capturée, sur CETTE arme
      } else if (rw) {
        setReloadProgress(a, rw, progress);
      }
      if (pr.success && reloadGrantsAssessAdvantage(a)) campGain(get, a, 1); // AA 13 l.9/90 : recharger = Action Évaluer → +1 Avantage (mode groupe)
      // ISSUE dérivée par le goulot (`FLOWS.reload.apply`, canal COMBAT) : `progress` inclut le bonus de
      // Talent (réalisé à l'application), le nom d'arme est résolu ici (uid → NOM d'affichage).
      const reloadName = garanti(a.weapons.find((w) => w.uid === pr.weaponUid), pr.weaponUid, 'arme rechargée').label;
      const reloadIssue = FLOWS.reload.apply(get, { p: pr, ctx: { after: progress, weapon: reloadName } });
      set({ battle: { ...markActed(get, set, battle), action: null, log: [...battle.log, ...evLines(reloadIssue, 'reload', a.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      // Acteur PILOTÉ par l'IA (Auto-combat) : son tour était suspendu par la modale → reprise (comme cast/défense).
      if (aiDriven(get(), a) && get().battle) resumeEnemyTurn(get, set);
    },
    reloadCancel: () => set({ pendingReload: null }), // avant le jet : aucun coût
    // Main ensanglantée (AA 07 l.117) : « Appliquer » le Test de Dextérité PAR ACTION.
    handGateConfirm: () => {
      const { battle, pendingHandGate: pg } = get();
      if (!battle || !pg || pg.roll == null) return;
      const attacker = inBattleId(battle, pg.attackerId);
      set({ pendingHandGate: null });
      if (!attacker) return;
      if (pg.success) {
        // Réussite : l'Action déclarée s'ouvre TELLE QUELLE (`skipGate` pour ne pas re-tester). Une 2ᵉ frappe
        // « des deux armes » reprend sa résolution pré-figée (`dualStrikeAttack`) ; sinon la cascade d'attaque.
        if (pg.pa.dualSecond) get().dualStrikeAttack(pg.pa.targetId, true);
        else openAttackCascade(get, set, pg.pa, pg.title, pg.icon, true);
        return;
      }
      // Échec : l'objet glisse (op `disarm`, main gatée). Comme le gate de Bénédiction (`attackWardGate`),
      // rien d'AUTRE n'est consommé — le joueur choisit une autre cible ou Action (mais l'arme est perdue).
      const lines = applyOps(attacker, [{ op: 'disarm' }], { rng: battleRng(), location: pg.hand === 'off' ? 'brasG' : 'brasD' });
      const b1 = get().battle!;
      set({ battle: { ...b1, combatants: [...b1.combatants], log: [...b1.log, ...evLines(lines, 'attack', attacker.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      // 2ᵉ frappe « des deux armes » ratée : la 2ᵉ est renoncée (l'Action reste dépensée par la 1ʳᵉ frappe) →
      // on clôt le sous-flux dual et on reprend la cascade (calque `dualStrikeSkip`).
      if (pg.pa.dualSecond) { set({ pendingDualStrike: null }); advanceCombatJet(get); return; }
      // Héros PILOTÉ par l'IA (Auto-combat) : son tour était suspendu par la modale → reprise (calque reloadConfirm).
      if (aiDriven(get(), attacker) && get().battle) resumeEnemyTurn(get, set);
    },
    handGateCancel: () => set({ pendingHandGate: null }), // avant le jet : aucun coût (l'Action n'est pas encore ouverte)
    battleRecoverState: (state: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle } = get();
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || !canTakeAction(active)) return;
      const inst = active.conditions.find((c) => c.id === state);
      const n = inst?.value ?? 0;
      if (!inst || n <= 0) return; // pas porteur de l'État
      if (isConditionLocked(inst, active)) return; // État verrouillé : le Test ne l'ôterait pas (LDB 18)
      // Test de récupération (Empêtré « se libérer »/En flammes « se rouler », LDB 16 l.66/l.84) lu de la
      // DONNÉE (`EtatData.recover`) par la SOURCE UNIQUE `resolveRecoverTest` — Empêtré = opposé de Force
      // (escapeStrength figée prioritaire, sinon source vivante) ; En flammes = Athlétisme simple.
      const rt = resolveRecoverTest(active, state, battle);
      if (!rt) return; // État non récupérable par Action (pas de `recover` en donnée)
      set({
        pendingStateRecovery: {
          actorId: active.id, actorName: active.label, state,
          skillLabel: rt.skillLabel, skillValue: rt.skillValue, skillBase: rt.skillBase, difficulty: rt.difficulty,
          opposition: rt.opposition, requireSl: rt.requireSl,
          entangleOnFail: rt.entangleOnFail, struggleDamage: rt.struggleDamage, stacks: n,
          roll: null, opponentRoll: null, netSL: 0, success: false,
        },
      });
    },
    recoverConfirm: () => {
      const { battle, pendingStateRecovery: sr } = get();
      if (!battle || !sr || sr.roll == null) return;
      const a = inBattleId(battle, sr.actorId);
      set({ pendingStateRecovery: null });
      if (!a) return;
      // Filets barbelés (Zoo Impérial p.29) : Dégâts ignorant l'armure à CHAQUE tentative, réussie ou ratée.
      const struggleLines = sr.struggleDamage != null
        ? applyOps(a, [{ op: 'wounds', amount: sr.struggleDamage, ignoreTB: false }], { caster: a })
        : [];
      const removed = recoveredStacks(sr.netSL, stacks(a, sr.state), sr.success); // 1 + DR, borné
      if (removed > 0) removeCondition(a, sr.state, removed);
      // Filets (Zoo Impérial p.29) : un échec de libération AGGRAVE l'Empêtré (≠ Immobilisante générique).
      if (!sr.success && sr.entangleOnFail) addCondition(a, sr.state, 1);
      // ISSUE dérivée par le goulot (`FLOWS.recover.apply`, canal COMBAT) : le pending est FOURNI (fermé
      // juste avant), les Dégâts de débattement restent la conséquence propre du site.
      const recoverIssue = FLOWS.recover.apply(get, { p: sr });
      finishPlayerAction(get, set, [...struggleLines, ...recoverIssue], 'condition'); // consomme l'Action
    },
    recoverCancel: () => set({ pendingStateRecovery: null }), // avant le jet : aucun coût
    steamSaveConfirm: () => {
      const p = get().pendingSteamSave;
      if (!p || p.roll == null) return;
      set({ pendingSteamSave: null });
      resolveSteamSave(get, set, p); // échec → ébouillanté (scaldOps), puis la boucle maritime reprend
    },
    // La munition se fixe au CHARGEMENT — arbitrage utilisateur 2026-08-16 par AskUserQuestion, verbatim de la demande qui
    // l'ouvre : « on doit pouvoir choisir ses munitions avec nos armes de tir facilement depuis sa barre
    // d'action ». Sur une arme à Recharge DÉJÀ chargée, changer de munition la
    // DÉCHARGE — le Test étendu de rechargement est à refaire (LDB 62 l.335), et le chargeur d'une arme À
    // Répétition se vide avec (conséquence assumée de l'arbitrage). Re-choisir la munition déjà chargée est
    // sans effet. Rien n'est détruit : le stock n'est décompté qu'au tir (`consumeAmmo`).
    // `weaponUid` DÉSIGNE l'arme concernée (deux armes à distance = deux munitions) ; absent → la 1re.
    battleSelectAmmo: (uid: string, weaponUid?: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle } = get();
      if (!battle) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active)) return;
      const rw = weaponUid
        ? active.weapons.find((w) => w.uid === weaponUid && w.type === 'ranged')
        : active.weapons.find((w) => w.type === 'ranged');
      if (!rw) return; // aucune arme à distance : rien à choisir
      // Chef qui SERT cette pièce : le cycle de charge vit sur la PIÈCE — la bascule doit la décharger ELLE.
      const poste = active.mannedPoste?.item.uid === rw.uid ? active.mannedPoste : undefined;
      const swapsLoadedShot = (rw.reload ?? 0) > 0 && weaponLoaded(active, rw) && loadedAmmo(active, rw)?.uid !== uid;
      setAmmoChoice(active, rw, uid, poste); // écrivain UNIQUE : la sélection vit sur CETTE arme (ou sur la pièce servie)
      if (swapsLoadedShot) unloadWeapon(active, rw, poste); // couture UNIQUE : l'arme (et la pièce servie)
      set({ battle: { ...battle } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Détermination (Resolve) : retirer un État de l'actif (LDB 17 l.59-61) ──
    battleSpendResolve: (conditionName: string) => {
      const { battle } = get();
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || (active.resolve ?? 0) <= 0) return;
      if (!active.conditions.some((c) => c.id === conditionName)) return;
      const { retire, soigne } = retireEtatParDetermination(active, conditionName, get().gameTime);
      if (!retire) return; // rien à lever : le point n'est pas débité
      active.resolve = (active.resolve ?? 0) - 1;
      const extra = soigne > 0 ? t('cs.fragGettingUp') : '';
      // Le JOUEUR lit le LIBELLÉ de l'État (« Aveuglé »), jamais son id : `conditionLabel` est la porte.
      set({ battle: { ...battle, action: null, log: [...battle.log, ev('info', t('cs.determinationRemove', { name: active.label, cond: conditionLabel(conditionName), extra }), active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    /** Détermination (LDB 17 l.59-61) : même règle que `battleSpendResolve`, mais pour N'IMPORTE QUEL
     *  COMBATTANT porteur de Détermination, par id, sans toucher au mode d'action — un héros en défense
     *  (il n'est pas l'actif) comme un acteur AUTO-PILOTÉ Brisé (l'IA s'en sert pour se ressaisir : retirer
     *  un pion d'un État verrouillant sans coûter l'Action, hôte-autoritaire). Un ennemi sans Détermination
     *  (`resolve` 0/absent) → no-op : la garde `kind` héros est levée, seul le pool de Détermination compte. */
    spendResolveCondition: (combatantId: string, conditionName: string) => {
      const s = get();
      const hero = actorIn(s, combatantId);
      if (!hero || (hero.resolve ?? 0) <= 0) return;
      if (!hero.conditions.some((c) => c.id === conditionName)) return;
      const { retire, soigne } = retireEtatParDetermination(hero, conditionName, s.gameTime);
      if (!retire) return; // rien à lever : le point n'est pas débité
      hero.resolve = (hero.resolve ?? 0) - 1;
      const extra = soigne > 0 ? t('cs.fragGettingUp') : '';
      if (s.battle) {
        set({ battle: { ...s.battle, log: [...s.battle.log, ev('info', t('cs.determinationRemove', { name: hero.label, cond: conditionLabel(conditionName), extra }), hero.id)] } });
      } else {
        set({ party: [...s.party] });
      }
      bus.emit(EVT.SCENE_DIRTY);
    },
    /** Détermination (LDB 17 l.59) : immunisé à la Psychologie jusqu'à la fin du PROCHAIN Round. */
    battleResolvePsychImmune: () => {
      const { battle } = get();
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active)) return;
      const msg = spendResolveForPsychImmunity(active); // SOURCE UNIQUE de l'immunité par Détermination
      if (!msg) return;
      set({ battle: { ...battle, action: null, log: [...battle.log, ev('info', msg, active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    /** Détermination (LDB 17 l.60) : ignore les modificateurs de Blessure critique jusqu'au début du prochain Round. */
    battleResolveIgnoreCrit: () => {
      const { battle } = get();
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || (active.resolve ?? 0) <= 0) return;
      active.resolve = (active.resolve ?? 0) - 1;
      // Détermination (LDB 17 l.60) : `ActiveEffect` à durée 1 Round (système de Durée unifié) — ignore les
      // modifs de Critique ce Round, expiré au passage de Round, sans flag round-scopé ni hook dédié.
      poseDeterminationCanceller(active, { scale: 'rounds', left: 1 }, 'Détermination (Critique)');
      set({ battle: { ...battle, action: null, log: [...battle.log, ev('info', t('cs.determinationCrit', { name: active.label }), active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Ramasser un objet au sol pendant un Round (un à la fois, LDB 13 l.115-116) ──
    battlePickup: (entityId: string, key: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle, scene } = get();
      if (!battle || battle.over || battle.acted || !scene) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || !canTakeAction(active)) return; // ramasser = une Action
      const ent = scene.entities.find((e) => e.id === entityId && e.kind === 'prop');
      if (!ent || !active.pos || !aPorteeDe(active.pos, ent)) return; // adjacent/sur la case, même étage — source unique `exploreNav.aPorteeDe` (#800)
      // Clé = `<actionId>:eff:<index dans flowEffects(action.flow)>` (cf. `entityPickables`) : c'est
      // l'ACTION authorée qu'on grappille, et l'ÉPUISEMENT est celui du même exécuteur que
      // l'exploration — `actionsAuthorees` refuse d'elle-même une action déjà fermée par son drapeau.
      const [actionId, tag, idxStr] = key.split(':');
      if (tag !== 'eff') return;
      const action = actionsAuthorees(ent, get().flags).find((a) => a.id === actionId);
      if (!action) return;
      const idx = Number(idxStr);
      const eff = flowEffects(action.flow)[idx];
      if (!eff) return;
      let label: string; // assigné dans chaque branche atteignant l'usage (le cas `else` renvoie)
      if (eff.type === 'giveTrapping') {
        const it = itemFromGive(eff, undefined, trappingById); // catalogue, campagne-d'abord (#767), sinon objet custom
        label = it.label;
        // ajout NON équipé au combattant actif (clone battle) ET au membre party (persiste post-combat).
        active.items = [...(active.items ?? []), it];
        autoStowNewItem(active, it); // #204 : rangement par défaut
        recomputeLoadout(active);
        set((s) => ({
          party: s.party.map((h) => {
            if (h.id !== active.id) return h;
            const clone: Combatant = structuredClone(h);
            const itCopy = structuredClone(it);
            clone.items = [...(clone.items ?? []), itCopy];
            autoStowNewItem(clone, itCopy); // #204 : rangement par défaut
            recomputeLoadout(clone);
            return clone;
          }),
        }));
      } else if (eff.type === 'giveMoney') {
        label = 'Argent';
        // Une feuille `giveMoney` LITTÉRALE ne porte aucun canal de dés : le retrait de la feuille
        // ramassée qui suit ne peut donc pas passer devant un dé (#1508) — et si ça changeait, ça lèverait.
        nePeutPasDifferer(applyEffects(get, set, [eff]), 'combatSlice.pickupItem (giveMoney)'); // bourse party
      } else return; // effet non ramassable (journal/document…) : pas grappillable en combat
      // La feuille prise se FERME par un drapeau (`cleFeuilleRamassee`), jamais en réécrivant le Flow de
      // l'action : le document de scène est de la DONNÉE d'auteur, l'état de la partie vit dans les
      // drapeaux — et c'est le même drapeau que la fouille en exploration lit pour ne pas redonner ce
      // qui est déjà pris (`flowRestant`).
      set((s) => ({ flags: { ...s.flags, [cleFeuilleRamassee(entityId, action.id, idx)]: true } }));
      // Pool de ramassables vidé : `consume` → le décor disparaît ; sinon il reste (ses Effets non-objet
      // — journal/document — restent fouillables en exploration ; pas de sens à les grappiller en combat).
      if (entityPickables(ent, get().flags).length === 0 && action.consume) {
        removeEntity(get, set, entityId);
        set({ battle: { ...markActed(get, set, battle), action: null, log: [...battle.log, ev('item', t('cs.pickup', { name: active.label, label }), active.id)] } });
      } else {
        set({ scene: { ...scene }, battle: { ...markActed(get, set, battle), action: null, log: [...battle.log, ev('item', t('cs.pickup', { name: active.label, label }), active.id)] } });
      }
      bus.emit(EVT.SCENE_DIRTY);
    },

    attackSetLocation: (loc: HitLocation | null) => {
      const pa = get().pendingAttack;
      if (!pa || pa.result) return; // la visée ne change plus après le jet
      set({ pendingAttack: { ...pa, location: loc } });
    },
    attackSetWeapon: (uid: string | null) => {
      const pa = get().pendingAttack;
      if (!pa || pa.result) return; // choix d'arme avant le jet seulement
      set({ pendingAttack: { ...pa, weaponUid: uid ?? undefined } });
    },
    attackSetDualMode: (on: boolean) => {
      const pa = get().pendingAttack;
      if (!pa || pa.result) return; // choix avant le jet seulement
      // Mode « des deux armes » : l'attaque-Action utilise la MAIN DIRECTRICE (la 2ᵉ frappe suit, off-hand).
      const a = inBattleId(get().battle, pa.attackerId);
      const mainUid = a?.weapons.find((w) => w.hand === 'main' && w.type === 'melee' && (w.hands ?? 1) === 1)?.uid;
      set({ pendingAttack: { ...pa, dualMode: on, weaponUid: on ? (mainUid ?? pa.weaponUid) : pa.weaponUid } });
    },
    attackSetHarpoonRopeCut: (v: boolean) => {
      const pa = get().pendingAttack;
      if (!pa || pa.result) return; // choix avant le jet seulement (mode de tir, ADE II 02 l.677)
      set({ pendingAttack: { ...pa, harpoonRopeCut: v } });
    },
    attackSetWithhold: (v: boolean) => {
      const pa = get().pendingAttack;
      if (!pa || pa.result) return; // « Retenir ses coups » se déclare AVANT le jet (Aux Armes 07 l.59)
      set({ pendingAttack: { ...pa, withhold: v } });
    },
    attackSetGrapple: (v: boolean) => {
      const pa = get().pendingAttack;
      if (!pa || pa.result) return; // « Empoignade » se déclare AVANT le lancer pour toucher (LDB 14 l.159)
      set({ pendingAttack: { ...pa, grapple: v } });
    },
    attackSetCritLocation: (loc: HitLocation) => {
      const pa = get().pendingAttack;
      // RAW-2 (LDB 17 l.68) : réservé à un Coup Critique issu d'un succès FORCÉ (« Je ne faillirai pas ! »).
      if (!pa || !pa.forced || !pa.result?.critical) return;
      set({ pendingAttack: { ...pa, result: { ...pa.result, critLocation: loc } } });
    },
    attackRoll: () => {
      const { battle, pendingAttack: pa } = get();
      if (!battle || !pa || pa.result) return;
      const attacker = inBattleId(battle, pa.attackerId);
      const target = inBattleId(battle, pa.targetId);
      if (!attacker || !target) return;
      applyIncomingMeleeAdvantage(get, attacker, target); // +1 Avantage si cible Sonnée (LDB 16 l.125), avant le jet
      const r = resolveAttack(get, attacker, target, pa.location ?? undefined, pa.fromCharge, pa.intoCrowd, pa.heldGround, pa.weaponUid, pa.withhold, pa.harpoonRopeCut); // charge montée → Force+Taille de la monture aux dégâts (LDB 14 l.183) ; pa.withhold = Retenir ses coups (AA) ; pa.harpoonRopeCut = mode de tir corde séparée (ADE II 02 l.677)
      if (!r) {
        get().log(firedWeapon(attacker, target, pa.weaponUid).type === 'ranged' ? t('cf.noLoSMasked') : t('cs.meleeOutOfRange'));
        set({ pendingAttack: null });
        advanceCombatJet(get); // défense en profondeur : ne JAMAIS laisser la cascade d'attaque orpheline (sinon soft-lock de fin de tour)
        return;
      }
      // Contexte du jet FIGÉ sur le pending (#1153) : l'OBJET arme réellement tiré, la distance et la
      // pénalité d'esquive. Toutes les influences de la ligne résolue (Chance, Relancer, dé choisi,
      // Résilience) re-dérivent AVEC eux, sans repasser par le choix d'arme (`pickAttackWeaponList`),
      // qui reprend la mêlée dès qu'elle est à portée. `weaponUid` n'est JAMAIS réécrit : il porte le
      // choix du JOUEUR, et son absence discrimine l'attaque naturelle (`attackWeaponOf`, #1026).
      set({ pendingAttack: { ...pa, result: r.res, victimId: r.victim?.id, weapon: r.weapon,
        distanceTiles: combatDistance(attacker, target), dodgeMod: defenseDodgeMod(get, target) } });
    },
    // Cycle Chance/Pacte UNIFIÉ (spec `attack`) — Résilience (forceSuccess/setForcedRoll) plus bas.
    // `cancel` = « Annuler » unifié (défaire-charge dans `FLOWS.attack.onCancel`) — regénère `attackCancel`.
    attackConfirm: () => {
      const { battle, pendingAttack: pa } = get();
      if (!battle || !pa || !pa.result) return;
      const attacker = inBattleId(battle, pa.attackerId);
      const target = inBattleId(battle, pa.targetId);
      // Tir dévié dans la mêlée (LDB 14 l.116) : la touche est appliquée à l'allié intercalé, pas à la cible.
      const victim = pa.victimId ? inBattleId(battle, pa.victimId) ?? target : target;
      const wasChain = !!pa.cleave; // cette attaque faisait-elle partie d'un balayage en cours ?
      const dualBefore = get().pendingDualStrike; // données de la 1ʳᵉ frappe (présentes quand on confirme la 2ᵉ)
      set({ pendingAttack: null });
      if (attacker && target && victim && pa.interrupt) {
        // Tir rapide (INTERRUPTION, LDB 11 l.97-103) : le tireur n'est PAS actif (on est à pendingRoundStart). On
        // applique le tir puis on N'AVANCE PAS le tour ; on épuise son tour NORMAL — l'Action (= ce tir) et
        // le Mouvement, consommés à l'ouverture de son slot normal (loseNext*). Aucun effet début/fin de tour
        // n'est déplacé (ils vivent dans advanceTurn/confirmRoundStart, non touchés). Ce chemin
        // n'interpose AUCUNE fenêtre de Défense (#997) : `surfacedDefensePending` porte la même
        // exclusion (`pa.interrupt`), pour que la modale n'annonce pas une attente qui ne viendra pas.
        // La couture de Défense posée par #997 retire cette exclusion des DEUX côtés.
        const weapon = attackWeaponOf(battle, attacker, target, pa);
        const suspendu = applyAttackResult(get, set, attacker, victim, weapon, pa.result);
        attacker.loseNextAction = true; attacker.loseNextMovement = true; // PRIX du tir, dû quelle que soit l'issue du coup
        // Le coup SUSPENDU (sauvegarde « 1d10 ≥ Indice » LDB 85 l.98, Déviation) a poussé SON étape DANS
        // cette cascade-hôte : la refermer détruirait l'étape et le coup avec elle. On avance alors le
        // curseur dessus (MÊME couture que toute chaîne d'attaque, `advanceCombatJet`) et c'est la
        // cascade qui se referme au bout de ses propres étapes — sans avancer le tour, le tireur n'étant
        // pas actif (pause de début de Round, `turn: -1` : `resumeSuspendedAI`/`advanceTurn` y sont no-op).
        set({ battle: { ...get().battle! }, ...(suspendu ? {} : { pendingCascade: null }) }); // referme la cascade-hôte du tir SANS avancer le tour (le tireur n'est pas actif)
        if (suspendu) advanceCombatJet(get);
        bus.emit(EVT.SCENE_DIRTY);
        checkBattleOver(get, set);
        return;
      }
      if (attacker && target && victim) {
        // Arme RÉELLEMENT employée (arme naturelle d'une manœuvre de trait comprise) : primitive
        // PARTAGÉE avec la modale d'attaque (#1026) — deux résolutions divergentes rendraient deux
        // verdicts d'interposition opposés pour le même `pa`.
        const weapon = attackWeaponOf(battle, attacker, target, pa);
        // Défense SURFACÉE du défenseur (#989) : le jet d'attaquant est FINAL (influence jouée) — on interpose
        // SA fenêtre de défense AVANT toute application, dans la cascade d'attaque EN COURS (le curseur passe
        // sur l'étape 'defense' ci-dessous). `defenseConfirm` rend la main ICI avec le résultat opposé
        // (`pa.defended`) → un seul chemin d'application. Un tir DÉVIÉ (victime ≠ cible) et le pilonnage de
        // zone n'opposent personne (LDB 14 l.116) : gardes portées par `surfacedDefensePending`, prédicat
        // PARTAGÉ avec l'affichage de la modale d'attaque (#1004) — jamais une 2ᵉ dérivation ici.
        if (openSurfacedDefense(get, set, attacker, target, weapon, pa)) {
          // Curseur : étape 'attack' (résolue) → étape 'defense' que la fenêtre vient d'appendre. Sans
          // cascade d'attaque en cours, la fenêtre a ouvert la sienne (curseur DÉJÀ sur la défense).
          const seq = get().pendingCascade;
          if (seq?.purpose === 'combat' && seq.participants[seq.cursor]?.jet === 'attack') get().cascadeNext();
          return;
        }
        // PILONNAGE INDIRECT (« viser une case », AA 10 l.169/171) : la touche DÉTONE sur la CASE choisie
        // (`pa.center`). L'Atout Explosion/Tir de zone frappe UNIFORMÉMENT le rayon (RAW LDB 62 l.254) — AUCUNE
        // touche directe « primaire » ni Critique par victime (l'aire ne re-teste pas) ; `target` (l'ennemi le
        // plus proche de l'impact) n'a servi qu'à la BANDE DE PORTÉE/au DR. Réutilise le résolveur d'aire UNIQUE.
        if (pa.siege && pa.center) {
          const lines = pa.result.hit && pa.result.damage != null
            ? [t('cf.siegeImpact', { name: attacker.label }), ...resolveWeaponArea(get, set,
                { attacker, weapon, damage: pa.result.damage, location: pa.result.location ?? 'corps', distanceTiles: combatDistance(attacker, target), center: pa.center },
                battleAreaTargets(get), battleRng()).lines]
            : [t('cf.siegeMiss', { name: attacker.label })];
          const b2 = get().battle!;
          set({ battle: { ...markActed(get, set, b2), action: null, preview: null, log: [...b2.log, ...evLines(lines, 'shoot', attacker.id)] } });
          bus.emit(EVT.SCENE_DIRTY);
          checkBattleOver(get, set);
          advanceCombatJet(get);
          return;
        }
        const prevActed = battle.acted; // pour la Frénésie : la 1re attaque du Round est GRATUITE
        const isDualMain = !!pa.dualMode && !pa.dualSecond && attacker.kind === 'hero'; // main directrice d'un dual
        const isDualSecond = !!pa.dualSecond; // 2ᵉ frappe (off-hand)
        // Maladresse d'un HÉROS (jet propre raté + double, LDB 14 l.19) : jet PROPRE, indépendant de l'issue
        // du coup — mesurée AVANT l'application parce qu'elle exclut le balayage de la suite ci-dessous.
        const fumbled = controlsCombatant(get(), attacker) && attackerFumbled(pa.result, weapon, attacker);
        const off = attacker.weapons.find((w) => w.hand === 'off' && w.type === 'melee' && (w.hands ?? 1) === 1);
        const mainRoll = pa.result.attackerDetail?.roll;
        // CE QUE CE SITE FERA APRÈS LE COUP (#1508) — donnée d'ENTRÉE : tout ce qui DÉPEND de l'issue du
        // coup (Frappe Mortelle qui exige la mort LDB 14 l.9, ouverture de la 2ᵉ frappe qui lit l'étape de
        // Critique, effets de la manœuvre gratuite) voyage avec lui et se joue quand elle est connue — une
        // fenêtre de sauvegarde ouverte ici l'emporte dans sa charge. Maniement de deux armes (LDB 10
        // l.767-773) : l'Avantage des deux frappes est différé — accordé seulement si LES DEUX touchent
        // (cf. bloc isDualSecond ci-dessous). `pa.grapple` = Empoignade (LDB 14 l.159) : pose l'Empoignade
        // au lieu des Dégâts.
        const suite: SuiteDeCoup = {
          deferAttackerAdvantage: isDualMain || isDualSecond,
          grapple: pa.grapple,
          ...(pa.freeKind ? { freeAttack: { kind: pa.freeKind, prevActed } } : {}),
          // L'ENCHAÎNEMENT se DÉCLARE, toujours : une Maladresse de l'attaquant, une frappe du Maniement
          // de deux armes ou une manœuvre gratuite n'en ouvrent AUCUN (`aucun`) — sans déclaration, la
          // queue partagée tomberait dans le balayage de la machine (LDB 85 l.362), que ce site écarte.
          enchainement: !fumbled && !isDualMain && !isDualSecond && !pa.freeKind ? { mode: 'hero', wasChain } : { mode: 'aucun' },
          ...(isDualMain && off?.uid && mainRoll != null ? { dualMain: { offWeaponUid: off.uid, mainRoll } } : {}),
        };
        const suspendu = applyAttackResult(get, set, attacker, victim, weapon, pa.result, undefined, undefined, suite);
        if (fumbled) {
          // Maladresse = étape de la cascade d'attaque (comme le Critique) ; advanceCombatJet l'enchaîne au bout.
          // La donnée (arme/résultat) vit SUR l'étape — source unique, plus de `pendingFumble` à désynchroniser.
          pushHost(get, set, { id: `cons-fumble-${attacker.id}`, kind: 'fumbleJet', jet: 'fumble', actorId: attacker.id, fumble: { weapon, result: null } });
          set({ pendingCleave: null }); // elle interrompt le balayage
        }
        // La queue du coup, ÉCRITURE UNIQUE (`combatFlow.jouerLaSuiteDuCoup`) — sautée si le coup est
        // SUSPENDU (sauvegarde/Déviation) : c'est la reprise qui la jouera, une fois, avec la touche réelle.
        if (!suspendu) jouerLaSuiteDuCoup(get, set, attacker, victim, pa.result, suite);
        // Action « des deux armes » (LDB 10 l.767-773) : attaquer des deux armes impose −10 à toutes ses
        // défenses jusqu'à son prochain Tour — PRIX de la déclaration, dû que le coup touche ou non.
        if (isDualMain) {
          attacker.dualStrikeDefensePenalty = true;
          set({ battle: { ...get().battle! } });
        }
        // 2ᵉ frappe résolue (LDB 10 l.767-773) : +1 Avantage UNIQUE si LES DEUX frappes touchent (pas +1 par frappe).
        // `dualBefore` n'existe que si la 1ʳᵉ a touché ; `pa.result.hit` = la 2ᵉ touche → les deux touchent.
        if (isDualSecond) {
          if (dualBefore && pa.result.hit) { campGain(get, attacker); attacker.gainedAdvThisRound = true; }
          set({ pendingDualStrike: null, battle: { ...get().battle! } });
        }
        // Attaque gratuite de MANŒUVRE de mêlée (Morsure/Attaque caudale/Tentacules, LDB 85) : l'Action est
        // préservée et les effets onHit PROPRES à la manœuvre s'appliquent (Caudale → À Terre si plus petit ;
        // Tentacules → Empêtré). On COMPTE l'usage : RAW « une Attaque gratuite pendant son tour » → 1/tour
        // (ou N/tour « par tentacule »), plafond appliqué par `availableAttacks` (compteur partagé).
        if (attacker.kind === 'hero' && pa.freeKind) {
          attacker.freeAttacksThisTurn = { ...attacker.freeAttacksThisTurn, [pa.freeKind]: (attacker.freeAttacksThisTurn?.[pa.freeKind] ?? 0) + 1 };
          set({ battle: { ...get().battle! } }); // le COMPTEUR est dû dès la déclaration ; les effets et l'Action rendue sont dans la suite
        }
        // Attaque d'Arme GRATUITE accordée par un talent (Frénésie : `grantFreeAttack{available}`, LDB 21 l.33) :
        // la 1ʳᵉ attaque d'arme du Round ne consomme PAS l'Action ; on COMPTE l'usage (plafond /Round = niveau,
        // via `freeAttacksThisTurn['arme']`) → l'attaque d'arme suivante coûtera l'Action. Donnée, plus de booléen.
        if (attacker.kind === 'hero' && !wasChain && !isDualSecond && !pa.freeKind && hasFreeWeaponAttack(attacker)) {
          attacker.freeAttacksThisTurn = { ...attacker.freeAttacksThisTurn, arme: (attacker.freeAttacksThisTurn?.['arme'] ?? 0) + 1 };
          set({ battle: { ...get().battle!, acted: prevActed, log: [...get().battle!.log, ev('frenzy', t('cs.freeAttack', { name: attacker.label }), attacker.id)] } });
        }
        // Talents d'attaque DÉCLENCHÉE (Assaut féroce : « une fois par Round, si vous touchez en mêlée →
        // attaque supplémentaire ») : une touche du héros résout ses `grantFreeAttack{onHit, immediate}` en
        // DONNÉE — instantanées, Action préservée, plafond /Round (qui borne aussi toute récursion).
        if (attacker.kind === 'hero' && pa.result?.hit && !wasChain && !isDualSecond && !pa.freeKind) {
          resolveFreeAttacks(get, set, attacker, 'onHit', victim);
        }
        // Tir IMMOBILE (LDB 14 l.70) : le héros a renoncé à bouger pour annuler le −10 → on consomme son
        // Mouvement du Tour (il ne pourra plus se déplacer après ce tir). Seule CETTE posture tombe : elle
        // a un PRIX (le Mouvement), le tir l'a dépensée. « Dans le tas » ne coûte rien (`LDB 14 l.106` :
        // un modificateur de Test, aucune dépense) — elle vit jusqu'à la fin du Tour, où `stances` se vide.
        // HÉROS SEUL — parité stricte avec `attackEnv` et `heldGroundStanceBlock` : un tireur piloté par
        // l'IA n'obtient aucun gain de la posture, il ne doit donc pas en payer le Mouvement.
        if (pa.heldGround && weapon.type === 'ranged' && attacker.kind === 'hero') {
          const b2 = get().battle;
          if (b2) {
            const { heldGround: _depensee, ...restantes } = b2.stances?.[attacker.id] ?? {};
            set({ battle: { ...b2, movementUsed: mountMovement(b2, attacker), stances: { ...b2.stances, [attacker.id]: restantes } } });
          }
        }
      }
      // Séquence de combat (jet = étape 0) : enchaîner sur les conséquences empilées par applyAttackResult,
      // ou clore (resume) si aucune. La cascade RESTE ouverte tant qu'un enchaînement est en cours
      // (balayage `pendingCleave` / 2ᵉ frappe `pendingDualStrike`) → la frappe suivante se rend dans la MÊME
      // étape `attack` (`pendingAttack` mis à jour par cleaveAttack/dualStrikeAttack) ; on n'avance qu'au bout.
      advanceCombatJet(get);
    },
    // `attackCancel` (« Annuler » / défaire-charge) est GÉNÉRÉ par la fabrique
    // (`FLOWS.attack.onCancel`, cf. la liste de verbes ci-dessus) — plus d'action bespoke ici.
    // PILONNAGE INDIRECT (« viser une case », AA 10 l.169/171) : la case d'impact est déposée par le placeur
    // ('siege', commitPlacedZone). Ouvre la modale de tir de la pièce indirecte servie (`pendingAttack` siège) :
    // le JET de tir (DR) reste l'attaque NORMALE (Chance/Résilience par la cascade), mais la touche DÉTONE sur
    // la case — l'Explosion frappe tout le rayon (résolution dans attackConfirm). Cible-repère = ennemi le plus
    // proche de l'impact (bande de portée/DR) ; aucune dans le rayon → tir à vide annoncé, sans détonation.
    siegeAimCommit: (pt: Pt) => {
      const { battle, pendingSiegeAim: sa } = get();
      if (!battle || battle.over || !sa) return;
      const gunner = inBattleId(battle, sa.gunnerId);
      get().siegeAimCancel(); // referme le placeur — MÊME porte que la sortie d'interlude
      if (!gunner || isOutOfAction(gunner) || !canTakeAction(gunner) || battle.acted) return;
      const aim = battle.combatants
        .filter((c) => c.kind !== gunner.kind && !isOutOfAction(c) && c.pos && chebyshev(pt, c.pos) <= sa.radius)
        .sort((a, b) => chebyshev(pt, a.pos!) - chebyshev(pt, b.pos!))[0];
      if (!aim) { get().log(t('cf.siegeNoTarget', { name: gunner.label })); return; }
      // Pilonnage : la pièce est SERVIE (hors loadout main/off) → `openAttackCascade` ne gate jamais un
      // canon monté (`attackHandGate` = null), mais passe par le MÊME point partagé que les autres attaques.
      openAttackCascade(get, set, { attackerId: gunner.id, targetId: aim.id, location: null, result: null, weaponUid: sa.weaponUid, center: { ...pt }, siege: true }, 'Pilonnage', 'fire/blast');
    },
    /** REFERME le placeur de case du pilonnage SANS tirer : le pending tombe et l'option « Servir … »
     *  se désarme (l'attaque redevient celle de l'Arme) — l'état exact que laisse un re-clic sur la
     *  case d'attaque (`battleSelectAttack`, plus haut). Sortie de l'interlude `placing-zone` quand
     *  la zone en cours vient du siège (`placingZoneOf` source `siege`), et point de fermeture unique
     *  du commit ci-dessus. Aucun coût : rien n'a été jeté. */
    siegeAimCancel: () => {
      const { battle, pendingSiegeAim } = get();
      if (!battle || !pendingSiegeAim) return;
      set({ pendingSiegeAim: null, battle: { ...battle, selectedAttack: undefined, preview: null } });
    },
    cleaveAttack: (targetId: string) => {
      const { battle, pendingCleave: pc } = get();
      if (!battle || !pc) return;
      const attacker = inBattleId(battle, pc.attackerId);
      const target = inBattleId(battle, targetId);
      if (!attacker || !target) return;
      if (pc.count >= bonus(effectiveChar(attacker, 'capacite-de-combat'))) return; // borné à BCC enchaînements (LDB 14 l.9)
      if (!cleaveTargets(battle, attacker, pc.hitIds).some((t) => t.id === targetId)) return; // cible invalide (non adjacente / déjà frappée)
      set({ pendingAttack: { attackerId: attacker.id, targetId, location: null, result: null, cleave: true } });
    },
    cleaveEnd: () => { set({ pendingCleave: null }); advanceCombatJet(get); }, // fin du balayage → clore l'étape-jet de la cascade (reprise)
    dualStrikeAttack: (targetId: string, skipGate = false) => {
      const { battle, pendingDualStrike: ds } = get();
      if (!battle || !ds) return;
      const attacker = inBattleId(battle, ds.attackerId);
      const target = inBattleId(battle, targetId);
      if (!attacker || !target || isOutOfAction(target)) return;
      const off = attacker.weapons.find((w) => w.uid === ds.offWeaponUid);
      if (!off) { set({ pendingDualStrike: null }); return; }
      if (!dualStrikeTargets(battle, attacker, off).some((t) => t.id === targetId)) return; // cible invalide (hors d'Allonge)
      // Main ensanglantée (AA 07 l.117) : « des deux armes » est UNE Action impliquant les DEUX mains → UN SEUL Test
      // avant l'Action. La main directrice est testée à la déclaration (`openAttackCascade`) ; si SEULE la 2nde est
      // gatée (la main directrice a déjà consommé le Test le cas échéant), la 2ᵉ frappe joue le Test ICI. Échec →
      // l'objet de la 2nde main glisse (`disarm`), la 2ᵉ frappe est renoncée. `skipGate` : Test déjà PASSÉ (reprise).
      if (!skipGate && attackHandGate(attacker, off.uid) && !attackHandGate(attacker)) {
        const base = effectiveChar(attacker, 'dexterite'); // Dextérité effective — +20 « Accessible » via la Difficulté
        // Cible montée par le MONTEUR : elle passe donc par `clampTarget`, comme celle que `rollTest`
        // calculera au jet (`FLOWS.handGate`). Effet MESURÉ aux bornes seulement (Dex 85 : 105 → 99).
        set({ pendingHandGate: {
          attackerId: attacker.id, actorName: attacker.label, hand: 'off',
          skillValue: base, difficulty: 'accessible', target: rollLine({ actor: attacker, difficulty: 'accessible', valeur: base }).target,
          roll: null, sl: 0, success: false,
          pa: { attackerId: attacker.id, targetId, location: null, result: null, weaponUid: off.uid, dualSecond: true },
          title: 'Des deux armes', icon: 'action/attack',
        } });
        return;
      }
      // 2ᵉ frappe : jet IMPOSÉ (inversé / valeur du Critique) + pénalité main 2nde + nouveau jet de défense (LDB 10 l.767-773).
      const res = resolveDualSecond(get, attacker, target, off, ds.mainRoll, { critValue: ds.critValue });
      set({ pendingAttack: { attackerId: attacker.id, targetId, location: res.location ?? null, result: res, dualSecond: true, weaponUid: off.uid } });
    },
    dualStrikeSkip: () => { set({ pendingDualStrike: null }); advanceCombatJet(get); }, // « peut viser » = optionnel : pas de 2ᵉ → pas d'Avantage (LDB 10 l.767-773)
    // Maladresse : la donnée vit SUR l'étape COURANTE de la cascade (`step.fumble`) — source unique.
    fumbleRoll: () => {
      const pc = get().pendingCascade;
      const i = pc?.cursor ?? -1;
      const step = pc?.participants[i];
      if (!pc || step?.jet !== 'fumble' || !step.fumble || step.fumble.result) return; // un seul jet sur le Tableau des Oups !
      const result = rollOups(step.fumble.weapon, battleRng());
      set({ pendingCascade: { ...pc, participants: pc.participants.map((s, k) => (k === i ? { ...s, fumble: { ...s.fumble!, result } } : s)) } });
    },
    fumbleConfirm: () => {
      const { battle, pendingCascade: pc } = get();
      const step = pc?.participants[pc.cursor];
      if (!battle || !pc || step?.jet !== 'fumble' || !step.fumble?.result) return;
      const c = inBattleId(battle, step.actorId);
      if (c) applyOups(get, set, c, step.fumble.weapon, step.fumble.result);
      // La Maladresse est l'étape COURANTE de la cascade combat → enchaîner le curseur (sa clôture reprend l'IA).
      get().cascadeNext();
    },

    // ── Défense réactive (héros attaqué par l'IA en mêlée) ──
    defenseSetMode: (mode: DefenseMode, subSkillId?: string) => {
      const pd = get().pendingDefense;
      if (!pd || pd.result) return; // le mode ne change plus après le jet
      // Substitution sociale : fige la Compétence substituée (Intimidation/Dressage) ; sinon on l'efface.
      set({ pendingDefense: { ...pd, mode, substituteSkillId: mode === 'social' ? subSkillId : undefined } });
    },
    defenseSetParryWeapon: (uid: string | null) => {
      const pd = get().pendingDefense;
      if (!pd || pd.result) return; // choix d'arme de parade avant le jet seulement
      set({ pendingDefense: { ...pd, parryWeaponUid: uid ?? undefined } });
    },
    // Réaction de Porte-Bouclier (variante AA 13 l.84) déclarée avant l'Appliquer : 'damage'/'push' ou effacée.
    defenseSetShieldReaction: (kind: 'damage' | 'push' | null) => {
      const pd = get().pendingDefense;
      if (!pd) return;
      set({ pendingDefense: { ...pd, shieldReaction: kind ?? undefined } });
    },
    // Cycle unifié (spec `defense`) : jet initial = résolution pure (`atk` figé) ; Chance/Pacte ici,
    // Résilience (forceSuccess/setForcedRoll) plus bas. PAS de `cancel` : le RAW n'offre aucun « Subir »
    // volontaire (mêlée = Test opposé, LDB 13 l.123) → une fois offerte, la défense est obligatoire.
    defenseConfirm: () => {
      // « Appliquer » : applique le résultat puis REPREND le tour de l'IA suspendu.
      const { battle, pendingDefense: pd } = get();
      if (!battle || !pd || !pd.result) return;
      const attacker = inBattleId(battle, pd.attackerId);
      const defender = inBattleId(battle, pd.defenderId);
      // LE SLOT SE VIDE ET L'ÉTAPE SE FERME DANS LE MÊME ÉTAT (#1852) : `committed` DIT à l'état que
      // cette étape a rendu sa donnée. Sans lui, l'état intermédiaire (slot vide, curseur encore posé
      // dessus) est un hôte ORPHELIN pour tout lecteur — le rendu, l'arbitre, la garde du curseur —,
      // et seul le batching React le masquait. Le curseur, lui, quitte l'étape plus bas (`quitterLaDefense`),
      // une fois les conséquences du coup appliquées.
      set((s) => {
        const casc = s.pendingCascade;
        const cur = casc?.participants[casc.cursor];
        return {
          pendingDefense: null, // null AVANT la reprise → ré-entrance/double-advance impossibles
          ...(cur?.jet === 'defense'
            ? { pendingCascade: { ...casc!, participants: casc!.participants.map((st, i) => (i === casc!.cursor ? { ...st, committed: true } : st)) } }
            : {}),
        };
      });
      /**
       * QUITTER L'ÉTAPE DE DÉFENSE (#1852) — SOURCE UNIQUE de « cette fenêtre a rendu sa donnée, le
       * curseur n'a plus rien à y faire », pour les QUATRE sorties de `defenseConfirm`. Un slot
       * `pendingDefense` REPOSÉ entre-temps appartient à l'étape SUIVANTE (la frappe d'après) : on
       * avance TOUJOURS, sans quoi la donnée neuve s'afficherait dans la fenêtre de la précédente.
       * Rend `false` quand l'étape courante n'est plus la défense (la Maladresse a ouvert SA séquence).
       */
      const quitterLaDefense = (): boolean => {
        const casc = get().pendingCascade;
        if (casc?.purpose !== 'combat' || casc.participants[casc.cursor]?.jet !== 'defense') return false;
        get().cascadeNext();
        return true;
      };
      // Défense SURFACÉE d'une attaque PILOTÉE (#989, `openSurfacedDefense`) : l'issue OPPOSÉE rejoint le
      // chemin d'application UNIQUE de l'attaque — `attackConfirm` reprend avec le résultat défendu. Le
      // curseur est TOUJOURS sur l'étape 'defense' de la MÊME cascade d'attaque : aucun tour n'avance ici
      // (c'est `advanceCombatJet`, au bout d'`attackConfirm`, qui enchaîne le curseur).
      // CE QUE CETTE FENÊTRE FERA APRÈS LE COUP (#1858) : la DÉCLARATION de celui qui l'a ouverte, lue
      // ICI et nulle part ailleurs. Une sauvegarde « 1d10 ≥ Indice » (LDB 85 l.98) ou une Déviation
      // ouverte par l'application l'emporte dans SA charge (#1508) : c'est la reprise qui la joue.
      const suite = pd.suite;
      if (suite.mode === 'pilotee' && attacker && defender) {
        set({ pendingAttack: { ...suite.pa, result: pd.result, location: pd.result.location ?? suite.pa.location } });
        get().attackConfirm();
        // Réaction de Porte-Bouclier (variante AA 13 l.84) : APRÈS l'attaque, comme sur le chemin réactif.
        if (pd.shieldReaction && pd.mode === 'parade') applyShieldReaction(get, set, defender, attacker, pd.shieldReaction, parryWeaponOf(defender, pd));
        pushDefenderFumble(get, set, defender, pd); // MÊME helper, MÊME ordre (après application) que le chemin réactif
        return;
      }
      if (suite.mode === 'machine' && attacker && defender) {
        const suspended = applyAttackResult(get, set, attacker, defender, pd.weapon, pd.result, undefined, undefined, suite.coup);
        // Réaction de Porte-Bouclier (variante AA 13 l.84) déclarée pour cette défense : débite la réserve et
        // applique l'effet APRÈS l'attaque (poussée+désengagement ou Dégâts). Cadence 1×/Round vérifiée dans le helper.
        if (pd.shieldReaction && pd.mode === 'parade') applyShieldReaction(get, set, defender, attacker, pd.shieldReaction, (pd.parryWeaponUid ? defender.weapons.find((w) => w.uid === pd.parryWeaponUid) : defender.weapons[0]));
        if (suspended) {
          // Déviation Critique du héros : `applyAttackResult` a EMPILÉ l'étape 'deviation' APRÈS l'étape
          // défense courante ; on quitte la défense, elle a rendu sa donnée.
          quitterLaDefense();
          return; // la suite (autoCleave/Piétinement/fumble/reprise) part de l'applier 'deviation' (resolveDeviation)
        }
        jouerLaSuiteDuCoup(get, set, attacker, defender, pd.result, suite.coup); // ÉCRITURE UNIQUE de la queue d'un coup (effets de manœuvre + Action rendue, maillon de balayage, balayage automatique)
      }
      if (defender && pushDefenderFumble(get, set, defender, pd)) { quitterLaDefense(); return; }
      // Attaques GRATUITES de l'attaquant après CE coup : d'Arme « disponibles » (Frénésie LDB 21 l.33)
      // — jamais après une gratuite, que la suite de la fenêtre nomme — puis celles de créature. UNE file,
      // qui S'ARRÊTE à la première fenêtre ouverte : la fenêtre qui suit est celle de la gratuite
      // SUIVANTE, sur SA propre étape (LDB 85 l.41-43 — chaque gratuite est un Test d'attaque complet).
      const gratuite = suite.mode === 'machine' && !!suite.coup.freeAttack;
      if (attacker && drainerLesGratuites(get, set, attacker, { disponibles: !gratuite })) { quitterLaDefense(); return; }
      // La défense est l'étape de SA cascade combat → enchaîner le curseur (les conséquences empilées —
      // Critique/Maladresse — s'affichent inline ; la clôture reprend l'IA). Rien derrière elle : reprise.
      if (!quitterLaDefense()) resumeEnemyTurn(get, set);
    },
    renounceResolve: (renounce: boolean) => resolveRenounce(get, set, renounce),


    startCombat: (encounterId: string, onVictory?: Flow, opts?: { noSurprise?: boolean }) => {
      const { scene, party, partyPos } = get();
      if (!scene) return;
      const enc = scene.encounters.find((e) => e.id === encounterId);
      if (!enc) return;
      // Couture UNIVERSELLE de suspension (state/cascade.ts) : un combat qui s'ouvre PENDANT une
      // cascade active (ex. un abordage déclenché par l'applier d'une étape de voyage) la PARQUE au
      // lieu de la perdre au `resetFields('combatStart')` ci-dessous — jamais un cas spécial « mer ».
      suspendActiveCascade(get, set);
      // Placer les héros près de leur position de groupe, les ennemis selon l'encounter.
      // Carry-in : on n'instancie pas les morts/éjectés ; on ré-importe les États PERSISTANTS du
      // groupe (Hémorragique, Empoisonné…) et on réinitialise tout l'état de combat transitoire.
      const livingParty = party.filter((h) => !h.dead && !h.outOfRencontre);
      const heroes = livingParty.map((h, i) => {
        const c = {
          ...structuredClone(h),
          // z (étage) propagé depuis partyPos → Combatant.pos.z (omis au sol pour rester byte-identique, symétrique à #802 côté ennemis)
          pos: { x: Math.max(0, partyPos.x - 1), y: Math.min(scene.dimensions.h - 1, partyPos.y + i), ...(partyPos.z ? { z: partyPos.z } : {}) },
          advantage: 0,
          conditions: persistentConditions(h), // États persistants seuls (le transitoire est jeté)
          activeEffects: [],                    // buffs en Rounds : ne survivent pas entre combats
          engagedWith: [], // pas d'Engagement hérité d'un combat précédent
          meleeThisRound: [],
          roundsAtZero: 0, // l'horloge de mort lente repart à neuf
          soinRencontreUtilise: false, // nouvelle rencontre → droit à un soin de Blessures (LDB 09 l.233)
          woundDressed: false, // « pansé pendant CE combat » repart à zéro (anti-Infection, LDB 18 l.298)
          tookCriticalThisFight: false, // critique « de ce combat » : repart à zéro
          wounds: { ...h.wounds },
        } as Combatant;
        // Re-dérive les armes ACTIVES depuis les items persistés : une arme usée/détruite au combat
        // précédent (damageTaken/destroyed sur l'ItemInstance) reste usée/détruite (LDB 62 l.135).
        if (c.items?.length) recomputeLoadout(c);
        // Armes à distance CHARGÉES au début du combat (le cycle de charge ne joue que pour les armes à
        // Recharge) — CHACUNE la sienne. Le CHOIX de munition n'est PAS réinitialisé : la munition est un
        // état de l'ARME (arbitrage utilisateur 2026-08-16 : « si j ai 2 armes à distance elles gèrent
        // chacune leur propre rechargement et munition ») et se fixe au chargement
        // (AskUserQuestion 2026-08-16), donc celui posé au
        // combat précédent (ou à l'équipement) tient ; `loadWeapon` capture le choix courant, et
        // `selectedAmmo` retombe sur la 1re compatible quand il n'y en a aucun.
        for (const rw of c.weapons.filter((w) => w.type === 'ranged')) loadWeapon(c, rw);
        return c;
      });
      // Chaque membre RÉFÉRENCE une entité de la scène. L'entité PORTE le profil/apparence/arme/traits
      // — on résout (membre + entité appariés), puis on spawne en CONSERVANT l'id de l'entité :
      // identité UNIFIÉE explo↔combat (Combatant.id === SceneEntity.id) → apparence identique (même seed),
      // pas de figurant dupliqué, et réconciliation post-combat directe (finalizeBattle).
      const byEntity = new Map(scene.entities.map((e) => [e.id, e]));
      const roster = (enc.members ?? [])
        .map((m) => ({ m, ent: byEntity.get(m.entityId) }))
        .filter((r): r is { m: typeof r.m; ent: SceneEntity } => !!r.ent);
      const enemies = roster.map(({ ent }) => ficheDEntite(ent));
      // #30 — Blessures de COQUE persistantes : une coque spawnée qui EST le navire de campagne
      // (creatureId = vehicleId) repart de l'état persisté (writeback symétrique dans finalizeBattle).
      const vessel0 = get().vessel;
      if (vessel0) {
        // `enemies` porte TOUTES les coques spawnées (allié comme ennemi ; `kind` est réassigné plus bas).
        for (const c of enemies) if (c.creatureId === vessel0.vehicleId) {
          if (vessel0.wounds) c.wounds.current = Math.min(vessel0.wounds.current, c.wounds.max);
          if (vessel0.label) c.label = vessel0.label; // #230 — nom d'instance (affichage ; rendu keyé par creatureId)
        }
      }
      // Combat monté (LDB 14) : marquer les montures rideables, basculer les « alliés », puis appairer
      // les couples pré-montés (ridesEntityId → la monture). Le cavalier monte SUR sa monture.
      const idxByEntity = new Map(roster.map((r, i) => [r.ent.id, i]));
      roster.forEach(({ m }, i) => {
        if (m.side === 'ally') enemies[i].kind = 'hero';
        if (m.ai) enemies[i].aiControlled = true; // PNJ allié IA (défenseur de siège) : agit seul (aiDriven)
        if (m.mount) enemies[i].mountable = true;
      });
      roster.forEach(({ m }, i) => {
        if (m.ridesEntityId == null) return;
        const mi = idxByEntity.get(m.ridesEntityId);
        const mount = mi == null ? undefined : enemies[mi];
        if (!mount) return;
        mount.mountable = true;
        mountUp(enemies[i], mount); // partage la position/empreinte de la monture (LDB 14 l.179)
      });
      // Structures destructibles de siège (AA 10 l.94-127) : chaque arête portant une `structure` INTACTE devient
      // un Combattant inerte à PV (kind 'npc' → ne fausse pas la fin de combat, cf. checkBattleOver qui ne
      // compte que les 'enemy'). Son `structureEdge` mémorise l'arête à ABATTRE (BRÈCHE) à sa destruction ;
      // une structure déjà abattue n'est pas ré-instanciée. Source = WallSeg (≠ SceneEntity) → enrôlée ICI.
      const structures = (scene.walls ?? [])
        .filter((w) => !!w.structure && !structureIsDown(scene, w))
        .map((w) => {
          const data = findStructureById(w.structure!);
          if (!data) return null;
          const c = structureCombatant(data, `structure-${w.x}-${w.y}-${w.side}-${w.z ?? 0}`);
          c.pos = { x: w.x, y: w.y };
          c.structureEdge = { x: w.x, y: w.y, side: w.side, z: w.z ?? 0 };
          return c;
        })
        .filter((c): c is Combatant => !!c);
      // #621 — Montures-possession des héros (combat monté, LDB 14 l.179). Spawnée en ALLIÉ `pos-<uid>`
      // (writeback #618 dans finalizeBattle), appairée au cavalier.
      const mountCombatants: Combatant[] = [];
      for (const hero of heroes) {
        const mp = heroCombatMount(hero, get().possessions);
        if (!mp) continue;
        const mount = spawnEnemy(
          'creatureId' in mp.ref ? { ref: mp.ref.creatureId } : { statblock: mp.ref.custom },
          mp.uid,
          hero.pos ? { ...hero.pos } : { x: 0, y: 0 },
          { charsRolled: mp.charsRolled, learnedTraits: mp.learnedTraits },
        );
        mount.kind = 'hero'; // allié — exclue des DEUX bornes de fin de combat : `enemiesAlive` (kind:'enemy'
        // seulement) et `heroesAlive` (`!mountable`, checkBattleOver, combatFlow.ts) — jamais un héros.
        mount.mountable = true;
        if ('wounds' in mp && mp.wounds) mount.wounds.current = Math.min(mp.wounds.current, mount.wounds.max); // patron l.2476-2479
        mountUp(hero, mount); // câble mountId/riderId + partage la case (LDB 14 l.179)
        mountCombatants.push(mount);
      }
      const all = [...heroes, ...enemies, ...structures, ...mountCombatants];
      // COUCHE MER (navire-unité, MDG 14) : le groupe EMBARQUE — les PJ tiennent les rôles de leur navire
      // (l.39 « la performance des Personnages représente celle de tout l'équipage »). On les rattache à la coque
      // ALLIÉE (celle de campagne si connue, sinon la 1re coque alliée) → PASSAGERS (hors ordre ET hors rendu),
      // qui s'expriment par les Tests d'équipage (manœuvre / bordée) et n'ont pas de tour individuel person-scale.
      if (isMerScene(scene)) {
        const allyHull = all.find((c) => isVehicle(c) && c.kind === 'hero' && (!vessel0 || c.creatureId === vessel0.vehicleId))
          ?? all.find((c) => isVehicle(c) && c.kind === 'hero');
        if (allyHull) allyHull.crewIds = [...new Set([...(allyHull.crewIds ?? []), ...heroes.map((h) => h.id)])];
      }
      // Postes d'artillerie (MDG 12-13) : sert chaque poste de coque à son chef de pièce (mannedPoste +
      // octroi du canon dérivé). Après le spawn, sur TOUS les combattants (héros/allié/ennemi indifférent).
      applyShipPostes(all);
      // Formation runtime des servants d'un poste TERRESTRE crewé (#210 résidu) : un servant sans position
      // PROPRE authorée (pos == celle de la coque) est réparti en anneau autour de l'empreinte — AVANT le
      // stampage de hauteur ci-dessous, pour que sa `pos.h` finale soit celle de sa case de formation.
      autoFormCrews(all, scene, (hull) => byEntity.get(hull.id)?.facing);
      // Hauteur métrique au SPAWN : stampe `pos.h` (relief de la scène) sur TOUS les combattants posés —
      // héros, ennemis, structures et montures — pour que la distance verticale et le −10 « en contrebas »
      // partent justes (RAFRAÎCHIE ensuite à chaque déplacement via `placeCombatant`).
      for (const c of all) if (c.pos) placeCombatant(c, scene, c.pos);
      // Surprise (LDB 13) : si l'encounter le déclare, le camp embusqué teste Perception vs Discrétion.
      // `noSurprise` : le voyage annule l'embuscade quand le groupe « les voit venir » (Perception réussie).
      // Le Test (héros-atteignable) est ROUTÉ cadence-aware par `applySurprise` APRÈS la pose du `battle`
      // (héros manuel → cascade influençable ; embusqué ennemi → inline) — d'où le drapeau retenu ici.
      const doSurprise = !!enc.surprise && !opts?.noSurprise;
      // Initiative : on fixe l'Initiative de chaque combattant (point nommé `rollInitiative` — seam de la
      // règle « méthode d'Initiative »). Combat instinctif (LDB 10) : +10 × niveau, via talentInitiativeBonus.
      for (const c of all) c.initiative = rollInitiative(c, battleRng());
      // Effrayant (LDB 10) : le porteur inspire Peur (Indice = niveau) — comme un statbloc « Peur N ».
      for (const c of all) {
        const fear = talentFearIndice(c);
        if (fear > 0) c.causesPeur = Math.max(c.causesPeur ?? 0, fear);
      }
      // Ordre d'initiative (arme « Lente » en dernier, LDB 62 l.331). À l'échelle MER, l'équipage est PASSAGER
      // (hors `order`) : seules les coques ont un tour (navire-unité, MDG 14). Au person-scale, ordre complet.
      // Une STRUCTURE de siège ET un AFFÛT inerte servi (`inert`, ex. baliste/canon de rempart) n'ont PAS de
      // tour (ni pilotés par l'IA ni par le joueur : les laisser dans `order` figerait la boucle de tour). Ils
      // RESTENT dans `combatants` (ciblables / servables) ; seul leur slot d'`order` est retiré — même traitement
      // que les passagers de coque (MDG 14). Les coques-VÉHICULES, elles, GARDENT leur tour (unité navire).
      const turnlessIds = new Set([...structures.map((s) => s.id), ...all.filter((c) => c.inert).map((c) => c.id)]);
      const order = combatOrder(all, isMerScene(scene), battleRng()).filter((id) => !turnlessIds.has(id)); // départage RAW des égalités exactes par Test d'Ag (LDB 13 l.31)
      const battle: BattleState = {
        combatants: all,
        order,
        baseOrder: order,
        // Pause d'ouverture : PERSONNE n'est actif (turn -1) tant qu'on n'a pas « Commencé » —
        // toutes les affordances (marche/course, anneaux, visée, clics, IA) dérivent de l'actif
        // et se taisent d'elles-mêmes ; confirmRoundStart pose le vrai tour (LDB 17 l.25).
        turn: -1,
        round: 1,
        action: null,
        selectedSpellId: null,
        reachable: new Map(),
        movementUsed: 0,
        movedPreAction: false,
        acted: false,
        log: [ev('round', t('cs.combatStart'))],
        over: null,
        onVictory: onVictory ?? enc.onVictory,
        victoryCondition: enc.victoryCondition,
        banRanged: enc.banRanged,
        siege: enc.siege,
        // Pièges/hasards authorés de la scène → zones de bataille PERMANENTES (même runtime que les sorts).
        zones: sceneZonesToBattle(scene.effectZones, scene.dimensions),
        // Réserves d'Avantage par camp (AA 11 l.53-65) : seulement en mode « Avantage de groupe ».
        // Positionnement initial AUTO-dérivé : Surnombre + Surprise (calculés) + Manœuvrabilité/Menace/
        // Terrain (marqueurs éditables de la rencontre, AA 11 l.53-65).
        advantagePools: groupAdvantage() ? startAdvantagePools(all, doSurprise, enc) : undefined,
      };
      if (battle.advantagePools) mirrorPools(battle.advantagePools, all); // projette la réserve de départ sur chaque combattant
      // Repart d'aucune modale de jet héritée d'un combat/contexte précédent.
      // Ouverture = pause de début du Round 1 (pendingRoundStart) : champ visible, ordre d'Initiative dans la
      // frise, pré-emption « agir en premier » (Chance, #12a) — IA gelée. Un seul bouton « Commencer le combat »
      // (pas de phase « plan d'ensemble » séparée : c'était redondant avec la pause de Round).
      // Un combat MET DEBOUT ceux qu'il enrôle : un PNJ attablé qui devient combattant ne peut pas
      // rester assis sur sa place — ni le MENEUR, qui entre au combat depuis sa chaise. Fondu dans
      // l'écriture de pose du combat — donc avant toute capture de mutation, et sans une seconde
      // écriture de scène. `all` = tous les participants, groupe compris.
      const deboutScene = releaseSeatsOfCombatants(get().scene, all, get().party);
      set({ ...resetFields('combatStart'), battle, mode: 'battle', pendingRoundStart: { round: battle.round }, scene: deboutScene });
      // Effets « début de combat » authorés de chaque combattant (inerte tant qu'aucune donnée ne porte
      // un effet `onCombatStart`) — APRÈS la pose du `battle`, journalisés dans le journal de combat.
      emitCombatEvent('onCombatStart', {
        get, set, battle, sink: (line, c) => battle.log.push(ev('detail', line, c?.id)),
        audience: battle.combatants.filter((c) => !isOutOfAction(c)),
        triggerCtx: { rng: battleRng() },
      });
      // Météo du JOUR estampillée sur chaque combattant (#341) : SOURCE du canal « Tests physiques »
      // (`weatherTestMods`, lu par attack/defenseModifiers/baseTestMods) — AVANT tout jet de ce combat.
      stampEnvWeatherAtCombatStart(get, set);
      // Option « Vents Tourbillonnants » (LDB 46 l.179-190, #491) : tirage 1d10 de la force des Vents
      // + Test de Perception (Seconde vue) des porteurs — AVANT tout jet d'Incantation/Focalisation.
      windsOfMagicAtCombatStart(get, set);
      // Éclairs de la pluie diluvienne (EDOC 8 l.82, #341) : les montures Nerveuses non Dressées (Guerre)
      // sont effrayées à l'ouverture d'une embuscade sous l'orage — MÊME dispatcher onStartled/'noise'.
      startleOnStormAtCombatStart(get, set);
      // Surprise APRÈS la pose du `battle` : le Test du guetteur est cadence-aware (héros manuel → cascade
      // influençable, qui s'OUVRE par-dessus la pause d'ouverture ; embusqué ennemi → inline dans le journal).
      // COUCHE MER : la Surprise ne pose PAS l'État Surpris (une coque n'a ni Action ni psychologie — ce serait un
      // « tour gratuit de créature ») ; elle se traduit en AVANTAGE DE POSITION (l'assaillant a eu le temps de se
      // placer : entrée plus PRÈS + bord déjà aligné). Repérés (Perception réussie) → placement authoré (~150 m).
      if (doSurprise) { if (isMerScene(scene)) applyNavalSurprisePosition(get, set, enc.surprise!); else applySurprise(get, set, enc.surprise!); }
      get().faceAtCombatStart();
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Écran de victoire : assignation du butin (même flux que le marchand) + fermeture ──

    battleSelectAction: (a: BattleActionMode | null) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle, scene } = get();
      if (!battle || !scene) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active)) return;
      // Brisé (LDB 16 l.52) : Mouvement + Action doivent servir à FUIR / se cacher — aucune action
      // offensive. Le déplacement (fuite) passe par le clic-sol implicite (filtre dans computeMoveReach) ;
      // ici seule la fermeture (null) passe. La Détermination n'entre PLUS par cette porte : ses trois
      // dépenses (LDB 17 l.59-61) sont des dispatchers directs, qui n'arment aucun mode.
      // (« Se cacher » par Discrétion = pas de système de furtivité en combat ; approximé par « rester
      // hors de vue » → récupération en fin de Round, cf. brokenRecovery.)
      if (isActionLocked(active) && a !== null) {
        get().log(t('cs.brokenFlee', { name: active.label }));
        return;
      }
      // Pas d'Action ce tour (Sonné LDB 16 l.125 / Surpris l.135 — lu en DONNÉES via `canTakeAction`/gating,
      // jamais une branche par-nom) ; les manœuvres gratuites (Se relever, Se désengager…) sont des slots
      // DIRECTS qui n'appellent pas battleSelectAction. Surpris : message dédié (UX), le reste silencieux.
      if (a !== null && !canTakeAction(active)) {
        if (hasCondition(active, COND.surpris)) get().log(t('cs.surprised', { name: active.label }));
        return;
      }
      // Quitter le mode incantation oublie le sort sélectionné. Le déplacement et l'attaque sont
      // implicites au clic (battleClickTile/battleClickEntity), sans mode : le reachable stocké ne
      // porte que les budgets spéciaux (Course, post-Désengagement), on ne le touche pas ici.
      const selectedSpellId = a === 'cast' ? battle.selectedSpellId : null;
      // Changer (ou quitter) le mode armé oublie le PORTEUR élu du mode Dissiper : son panneau de
      // paramètre n'a plus de déclencheur allumé d'où naître.
      set({ battle: { ...battle, action: a, selectedSpellId, preview: null }, dispelCarrierId: null });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Guérison (LDB 09 l.254-269) — soin de Blessures / arrêt d'Hémorragie ──
    // Variante AA (AA 07 l.9) : retirer un État Hémorragique passe par un Test de Guérison
    // Accessible (+20) au lieu d'Intermédiaire (+0) — le soin de Blessures reste Intermédiaire dans
    // les deux versions. Gaté par la règle optionnelle `combat-aa-blessures` (policy.ts).

    battleHeal: (targetId: string, mode: HealMode) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle } = get();
      if (!battle) return;
      const healer = activeCombatant(battle);
      if (!healer || !controlsCombatant(get(), healer) || !hasHealSkill(healer) || battle.acted || !canTakeAction(healer)) return;
      const target = inBattleId(battle, targetId);
      if (!target || !availableHealModes(target).includes(mode)) return;
      const skillValue = testValue(healer, 'guerison');
      const difficulty = healDifficulty(mode);
      set({
        pendingHeal: {
          healerId: healer.id, healerName: healer.label, targetId: target.id, targetName: target.label,
          mode, intBonus: bonus(effectiveChar(healer, 'intelligence')),
          skillValue, difficulty, roll: null, success: false, sl: 0,
          target: rollLine({ actor: healer, test: { skill: 'guerison' }, difficulty, valeur: skillValue }).target,
        },
        battle: { ...battle, action: null },
      });
    },

    /** Pré-jet : bascule le MODE de soin (Blessures ⇄ Hémorragie) dans la modale, tant que le dé n'a
     *  pas été lancé. La Difficulté dépend du mode (variante AA, cf. `healDifficulty`) → recalculée avec
     *  `mode`. */
    healSetMode: (mode: HealMode) => {
      const ph = get().pendingHeal;
      if (!ph || ph.roll != null) return;
      const target = actorIn(get(), ph.targetId);
      if (!target || !availableHealModes(target).includes(mode)) return;
      const difficulty = healDifficulty(mode);
      const soigneur = actorIn(get(), ph.healerId);
      set({ pendingHeal: { ...ph, mode, difficulty, target: rollLine({
        actor: soigneur, ...(soigneur ? { test: { skill: 'guerison' } } : {}),
        difficulty, valeur: ph.skillValue, soutien: ph.support,
      }).target } });
    },

    // ── Infirmerie (hors combat) : modale de soins PERSISTANTE — cf. state/medicFlow ──

    // Chirurgie : jet INFLUENÇABLE d'une passe (le chirurgien peut être un héros) — surgeryNext applique
    // (medicFlow), surgeryCancel annule. openSurgeryPass POSE la passe (cf. délégations medic, store.ts).

    /** « Appliquer » : applique le soin (le jet est déjà figé). Coûte l'Action en combat. L'infirmerie
     *  (`medic`) n'est PAS touchée : la modale persistante reste ouverte pour l'acte suivant. */
    healConfirm: () => {
      const ph = get().pendingHeal;
      if (!ph || ph.roll == null) return;
      set({ pendingHeal: null });
      const st = get();
      const target = actorIn(st, ph.targetId);
      if (!target) return;
      let log: string[];
      if (ph.mode === 'wounds') {
        const r = resolveWoundsHeal(target, ph.intBonus, ph.sl, ph.success, battleRng());
        log = r.log;
        if (r.healed > 0) bus.emit(EVT.ANIM_FLOAT, { to: target.id, text: `+${r.healed}`, kind: 'heal' }); // flottant de soin (R8)
      } else if (ph.mode === 'bleed') {
        log = resolveBleedHeal(target, ph.sl, ph.success);
      } else if (ph.mode === 'ammo') {
        log = resolveExtractLodgedAmmo(target, ph.success); // LDB 62 l.250 — Test de Guérison Intermédiaire
      } else {
        log = treatTrauma(target, ph.sl, ph.success); // mode 'trauma' — l'échec consomme aussi le jet (LDB 18 l.222)
      }
      // Compétence Guérison RÉUSSIE = Aide Médicale (LDB 18 l.308) : lève l'escalade en attente (« Main
      // ouverte » : plus de doigt perdu par Round) ET les verrous d'État « par Aide Médicale » (LDB 18 :
      // Sonné/Inconscient/Aveuglé). Un échec ne soigne pas → n'est pas de l'Aide Médicale.
      if (ph.success) log = [...log, ...receiveMedicalAid(target), ...releaseConditionLocks(target, 'medicalAid')];
      finishPlayerAction(get, set, log, 'heal'); // sortie commune combat / hors combat
    },

    /** Annule avant tout jet. Acte PAYANT d'un PNJ (infirmerie) : remboursé tant que rien n'est lancé. */
    healCancel: () => {
      const ph = get().pendingHeal;
      // Remboursement au GROUPE (le débit est une DÉPENSE DE GROUPE — `payFromGroup`, medicFlow, LDB 75).
      if (ph?.paidCost && ph.roll == null) distributeCredit(get, set, toMoney(ph.paidCost));
      set({ pendingHeal: null });
    },

    // ── Contre-mesure « Asperger d'eau » (MDG 16 l.19, #497) — Créature marine hors de l'eau ──

    /** « Asperger d'eau » : Action DIRECTE (aucun jet, aucune modale) — pose `wateredThisRound` sur
     *  une Créature marine adjacente hors de l'eau, consomme l'Action. `targetId` explicite (choix
     *  parmi plusieurs candidats) sinon le 1ᵉʳ candidat éligible (MÊME patron que `battleManPoste`).
     *  Gate : l'aspergeur PORTE un contenant d'eau (`hasWaterContainer`, trapping `waterContainer`). */
    battleWater: (targetId?: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || battle.acted || !canTakeAction(active) || !hasWaterContainer(active)) return;
      const candidates = waterSprayCandidates(active, battle.combatants.filter((c) => c.kind === active.kind));
      const target = targetId ? candidates.find((c) => c.id === targetId) : candidates[0];
      if (!target) return;
      target.wateredThisRound = true;
      finishPlayerAction(get, set, [t('cs.waterSpray', { name: active.label, target: target.label })], 'detail');
    },

    /** Sélectionne un sort à incanter ; le clic suivant sur une cible le lance. Un sort de ZONE
     *  ouvre la modale DIRECTEMENT (flux « jet puis pose », LDB 47 l.15) — pas de cible à désigner. */
    battleSelectSpell: (spellId: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle } = get();
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || battle.acted) return;
      set({ battle: { ...battle, action: 'cast', selectedSpellId: spellId, reachable: new Map() } });
      castZoneSpell(get, set, active, spellId); // no-op si le sort n'est pas une ZdE chiffrable
      bus.emit(EVT.SCENE_DIRTY);
    },

    battleUseItem: (uid: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle } = get();
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active)) return;
      if (battle.acted || !canTakeAction(active)) return; // boire = une Action ; Sonné = pas d'Action
      const it = (active.items ?? []).find((i) => i.uid === uid);
      if (!it) return;
      if (!isConsumable(it)) return;
      // Le Flow du consommable passe par la voie de combat cadence-aware (un Test « au boire » devient
      // une étape de cascade influençable) — consommation + coût d'Action dans `battleConsumeItem`.
      battleConsumeItem(get, set, active, it);
      bus.emit(EVT.SCENE_DIRTY);
    },


    castRoll: () => {
      const { pendingCast: pc } = get();
      if (!pc || pc.result) return;
      const caster = actorIn(get(), pc.casterId);
      const target = actorIn(get(), pc.targetId);
      const spell = effectiveSpellOf(pc); // NI ×2 si lecture au grimoire (LDB 47 l.21)
      if (!caster || !target || !spell) return;
      // ZONE non posée (flux « jet puis pose ») : pas de cible désignée au jet — pas de ward
      // individuel (« N'écoutez point » protège une CIBLE), pas de résolution Projectile (les
      // Dégâts par cible sont dérivés du même jet À LA POSE, evaluateMissile).
      const unplacedZone = !!pc.zone && !pc.zone.center;
      // Contexte du jet (Sorcière + Domaine + Environnement) : MÊME source que la relance
      // (`FLOWS.cast.reresolve`) et que l'aperçu (`previewCast`) — un seul calcul, trois lectures.
      const ctx = castContextMods(get(), caster, target, spell, { skipWard: unplacedZone });
      const sigmar = ctx.ward; // « N'écoutez point la Sorcière »
      const aqshy = ctx.domain; // attribut d'Aqshy : +10/En flammes proche
      const winds = windsMagicModOf(get().battle); // Vents Tourbillonnants (LDB 46 l.179-190, option)
      const ward = ctx.total + winds;
      // « Prêchez, ma sœur ! » (LDB 40 l.40-42, option `prayer-conviction`) : une Prière murmurée
      // (`pc.discreet`) subit une Difficulté d'un cran plus dure. Ne concerne QUE les Prières.
      const discreet = !!pc.discreet && castInfoIsPrayer(spell) && !!rule('prayer-conviction');
      const difficulty = discreetPrayerDifficulty('intermediaire', discreet);
      const res = pc.missile && !unplacedZone
        ? resolveMagicMissile(caster, target, spell, battleRng(), pc.focused, ward, seaMagicContext(get()))
        : resolveCasting(caster, spell, battleRng(), difficulty, pc.focused, ward, seaMagicContext(get()));
      if (sigmar) get().log(t('cs.sigmarWard', { name: caster.label }));
      if (aqshy) get().log(t('cs.aqshyBonus', { name: caster.label, n: aqshy }));
      // Lanceur ENNEMI : Surincantation automatique (LDB 47 l.28-31) — le surplus de DR alloué à
      // l'axe Cible d'un Projectile (l'IA n'a pas de modale de choix ; ZdE déjà toutes-cibles).
      const auto = aiDriven(get(), caster) && pc.missile && !pc.zone
        ? aiOvercastPlan(caster, pc.targetId, spell, res, get().battle?.combatants ?? [], pc.focused, spellSightOf(get), !!pc.missile)
        : {};
      // Lanceur CONDUIT PAR LE MOTEUR (IA, cadence auto) : il n'a pas de modale pour trancher son
      // Incantation Critique — sa politique (`defaultCritChoice`) est son CHOIX, et elle s'ÉCRIT ici
      // (LDB 46 l.28-32 : « vous pouvez aussi choisir »). Plus aucun défaut lu en douce par les gardes.
      const critIA = aiDriven(get(), caster) && res.isCritical
        ? { critChoice: defaultCritChoice(res, !!pc.missile) }
        : {};
      set({ pendingCast: { ...pc, result: res, ...auto, ...critIA } });
      // Dissipation (LDB 46 l.156) : le Contre-sort s'aiguille ICI, AU JET, pour TOUT lanceur (héros,
      // ennemi IA, ennemi du siège MJ) — l'objet du Test opposé est le Test d'Incantation, et le DR
      // opposé module les DR (donc le budget de Surincantation) AVANT la pose. Gate + ancre de zone
      // vivent dans l'aiguilleur UNIQUE (`routeCounterspell`).
      routeCounterspell(get, set);
    },
    // Cycle Chance/Pacte UNIFIÉ (spec `cast`) — Résilience (forceSuccess/setForcedRoll) plus bas.
    castConfirm: () => {
      const { pendingCast: pc } = get();
      if (!pc || !pc.result) return;
      // Incantation CRITIQUE : le lanceur DOIT avoir tranché son effet (LDB 46 l.28-32) — la modale
      // grise « Appliquer » tant que rien n'est écrit, et cette garde tient face aux appelants qui ne
      // passent pas par elle (intentions réseau). Un lanceur conduit par le moteur a écrit le sien au jet.
      const critSpell = effectiveSpellOf(pc);
      if (pc.result.isCritical && !pc.critChoice && critSpell && !castInfoIsPrayer(critSpell)) return;
      // Choix tranché : l'aiguilleur du Contre-sort, différé au jet, s'exécute maintenant.
      if (pc.result.isCritical && !pc.counterspellRouted && routeCounterspell(get, set)) return;
      // Fenêtre de Contre-sort OUVERTE : l'incantation ne s'applique pas par-dessus (LDB 46 l.156 —
      // la Dissipation se résout AVANT). MÊME garde que `resolveCastChain` : elle vaut aussi pour les
      // appelants qui ne passent pas par la modale (auto-combat, intentions réseau).
      if (get().pendingCounterspell) return;
      // ZONE non posée → la confirmation NE résout JAMAIS en mono-cible sur l'ancre lanceur : ce bloc est
      // l'UNIQUE sortie d'une ZdE non posée (héros comme IA), exactement la même pour tous. Seul l'éventuel
      // « clic » de pose change de SOURCE (souris du héros / décision de l'IA), comme l'auto-combat fournit
      // déjà ses jets.
      if (pc.zone && !pc.zone.center) {
        const castable = castAfterCrit(pc.result, pc.critChoice, !!pc.missile);
        // Sort qui n'aboutit PAS (raté / DISSIPÉ par Contre-sort, LDB 46 l.156) : aucune zone à poser →
        // on ferme proprement la situation (data + cascade-hôte) — pas de soft-lock, cibles intactes.
        if (!castable) {
          const caster = actorIn(get(), pc.casterId);
          set({ pendingCast: null, pendingCascade: null });
          if (caster && aiDriven(get(), caster) && get().battle) resumeEnemyTurn(get, set);
          return;
        }
        // Lançable → la confirmation EST le passage en pose (la vraie application se fait à la pose,
        // castCommitZone).
        get().castPlaceZone(true);
        // IA = HÉROS (même flux) : le héros manuel attend le clic réel sur la carte (return ci-dessous) ;
        // un lanceur aiDriven FOURNIT son clic — le centre décidé par l'IA pure (`pc.zone.autoCenter`,
        // équivalent du curseur souris). On pose ici via le MÊME `castCommitZone`, puis on reprend le tour
        // de l'IA UNE seule fois.
        const caster = actorIn(get(), pc.casterId);
        if (caster && aiDriven(get(), caster) && pc.zone.autoCenter && get().battle) {
          castCommitZone(get, set, pc.zone.autoCenter);
          if (get().battle) resumeEnemyTurn(get, set);
        }
        return;
      }
      const caster = actorIn(get(), pc.casterId);
      const target = actorIn(get(), pc.targetId);
      const spell = effectiveSpellOf(pc); // NI ×2 si lecture au grimoire (LDB 47 l.21)
      // Surincantation : cibles supplémentaires + multiplicateur de durée (LDB 47 l.28-31).
      // ZdE : TOUTES les cibles de la zone sont visées (pas de budget de Surincantation).
      const extras = castExtraTargets(get, pc);
      // OPPOSITION (`spec.opposed`) : un Sort réussi dont la/les cible(s) opposent leur Test (FM/Int) voit
      // son application DIFFÉRÉE — on ouvre d'abord le multijet d'opposition DANS la modale (GARDE pendingCast).
      // `oppositionConfirm` repose `opposedOutcome` puis reprend la chaîne (`resolveCastChain`, ce bloc est alors sauté).
      if (openCastOppositionStep(get, set)) return;
      // FOLD : on ne ferme PLUS la cascade d'incantation ici — seulement le JET (CastModal disparaît).
      // La cascade `purpose:'combat'` (étape `jet:'cast'`) reste ACTIVE pour qu'un Critique de Sort
      // (pushReveal 'critical') ou une Imparfaite/Colère (étape appendue) s'y APPENDENT comme l'attaque.
      // On repère l'étape `jet:'cast'` SOUS le curseur AVANT applyCast (présente seulement si l'incantation
      // a été ouverte par openCastCascade ; absente quand un test/IA pose pendingCast à la main).
      const cascBefore = get().pendingCascade;
      const castStepIdx = cascBefore && cascBefore.purpose === 'combat' && cascBefore.participants[cascBefore.cursor]?.jet === 'cast'
        ? cascBefore.cursor : -1;
      set({ pendingCast: null }); // ferme le JET ; la cascade d'incantation reste active (cursor sur 'cast')
      if (caster && target && spell) {
        const ocDur = overcastDurationParts(overcastSourceOf(spell), pc.overcast?.duration ?? 0);
        applyCast(get, set, caster, target, spell, pc.result, pc.missile, pc.focused, pc.critChoice, {
          durationMult: ocDur.mult,
          durationBonusRounds: ocDur.bonusRounds,
          overcastDurationSteps: pc.overcast?.duration ?? 0,
          overcastDamageSteps: pc.overcast?.damage ?? 0,
          chosenTableRolls: pc.chosenTableRolls,
          extraTargets: extras,
          conjureForm: pc.conjureForm,
          opposedOutcome: pc.opposedOutcome,
        });
      }
      // Avance la cascade au-delà de l'étape `jet:'cast'` (résolue, CastModal éteint) : des conséquences
      // appendues (Critique/Imparfaite/Colère) → la cascade les joue (cursor+1) ; aucune → ferme la situation.
      // (Si pas de cascade d'incantation hôte — test/IA direct — on laisse intacte la cascade que les
      // conséquences ont éventuellement démarrée elles-mêmes, cursor déjà sur la 1ʳᵉ conséquence.)
      if (castStepIdx >= 0) {
        const casc = get().pendingCascade;
        if (casc && casc.purpose === 'combat' && casc.cursor === castStepIdx) {
          if (casc.participants.length > castStepIdx + 1) poserCurseurCascade(get, set, casc, castStepIdx + 1);
          else set({ pendingCascade: null });
        }
      }
      // Lanceur ENNEMI (modale témoin) : le tour de l'IA était suspendu → reprise. No-op si une autre
      // interaction bloquante s'est ouverte (Destin, révélations, OU la cascade de conséquences encore
      // ouverte) — elle reprendra elle-même (cascadeNext → resumeSuspendedAI à la clôture).
      if (caster && aiDriven(get(), caster) && get().battle) resumeEnemyTurn(get, set);
    },
    /** Incantation CRITIQUE (LDB 46 l.26-32) : le lanceur choisit l'effet bonus dans la modale. */
    castSetCritChoice: (choice: 'critique' | 'puissance' | 'ineluctable') => {
      const pc = get().pendingCast;
      if (!pc || !pc.result?.isCritical) return;
      set({ pendingCast: { ...pc, critChoice: choice } });
    },
    /** Arme invoquée à forme libre (Arme aethyrique) : le lanceur choisit la forme/Spé de Corps à corps. */
    castSetConjureForm: (form: ConjureForm) => {
      const pc = get().pendingCast;
      if (!pc) return;
      set({ pendingCast: { ...pc, conjureForm: form } });
    },
    /** « Prêchez, ma sœur ! » (LDB 40 l.42) : entonner la Prière à voix haute (défaut) ou discrètement
     *  (murmurée → Difficulté d'un cran plus dure). Choix AVANT le jet ; sans effet après lancer. */
    castSetDiscreet: (discreet: boolean) => {
      const pc = get().pendingCast;
      if (!pc || pc.result) return; // avant le jet seulement
      set({ pendingCast: { ...pc, discreet } });
    },
    /** Surincantation : un pas (`delta` +1/−1, stepper avec reset) coûte +2 DR du surplus — Sorts : DR − NI
     *  (LDB 47) ; Bénédictions/Miracles : DR entier (pas de NI). L'EFFET d'un pas est SOURCE-AWARE
     *  (`engine/overcast.ts`) ; l'axe doit être autorisé par la source (la ZdE n'existe qu'en arcane). */
    castAllocOvercast: (axis: OvercastAxis, delta: number) => {
      const pc = get().pendingCast;
      const spell = pc && findSpellById(pc.spellId);
      if (!pc || !pc.result?.cast || !spell) return;
      const source = overcastSourceOf(spell);
      if (!overcastAxes(source, !!pc.missile).includes(axis)) return; // axe interdit par la source (ex. ZdE divine)
      const oc = pc.overcast ?? { range: 0, zone: 0, duration: 0, targets: 0, damage: 0 };
      // Le NI n'entre au budget que si la branche de résolution l'oppose (`castInfo.requireNI`) —
      // `cn == null` n'est PAS un proxy de Prière (`LDB 40 l.13`).
      const ni = !castInfo(spell).requireNI || pc.focused ? 0 : spell.cn ?? 0;
      const budget = overcastBudget(source, overcastSL(pc.result, pc.critChoice, !!pc.missile), ni);
      const spent = oc.range + oc.zone + oc.duration + oc.targets + oc.damage;
      const v = oc[axis] + delta;
      if (delta > 0 && spent >= budget) return; // surplus épuisé (incrément)
      if (v < 0) return; // décrément borné à 0 (reset)
      const next = { ...oc, [axis]: v };
      // ZdE : chaque pas ajoute le Ø INITIAL — le rayon du gabarit suit (pose et aperçu lisent `zone.radius`).
      const zone = axis === 'zone' && pc.zone
        ? { ...pc.zone, radius: zoneRadiusTilesAt(pc.zone.r0m ?? 0, next.zone, sceneMetresPerTile(get().scene)) }
        : pc.zone;
      // Cible RÉDUITE : on élague les désignations au-delà de la nouvelle capacité (alloc ⊥ désignation).
      const caster = (get().battle?.combatants ?? get().party).find((c) => c.id === pc.casterId);
      const cap = caster ? extraTargetCapacity(source, next.targets, spellTargetCount(spell, caster)) : 0;
      const extraTargetIds = (pc.extraTargetIds ?? []).length > cap ? (pc.extraTargetIds ?? []).slice(0, cap) : pc.extraTargetIds;
      // Le choix de jets sur le Tableau (EDOC 13 l.276) reste borné aux pas Durée alloués : si l'axe
      // Durée redescend, re-clamp (jamais un choix > allocation) ; aucun choix explicite encore posé →
      // rien à clamper (défaut = tous les pas, résolu à l'application).
      const chosenTableRolls = axis === 'duration' && pc.chosenTableRolls != null
        ? Math.min(pc.chosenTableRolls, next.duration)
        : pc.chosenTableRolls;
      set({ pendingCast: { ...pc, overcast: next, ...(zone ? { zone } : {}), ...(extraTargetIds !== pc.extraTargetIds ? { extraTargetIds } : {}), ...(chosenTableRolls !== pc.chosenTableRolls ? { chosenTableRolls } : {}) } });
    },
    /** Jets sur le Tableau CHOISIS (EDOC 13 l.276, déclinable) : borné [0, pas Durée alloués]. */
    castSetChosenTableRolls: (n: number) => {
      const pc = get().pendingCast;
      if (!pc || !pc.result?.cast) return;
      const max = pc.overcast?.duration ?? 0;
      set({ pendingCast: { ...pc, chosenTableRolls: Math.max(0, Math.min(n, max)) } });
    },
    castToggleExtraTarget: (id: string) => {
      const pc = get().pendingCast;
      if (!pc || !pc.result?.cast) return;
      // Garde : seules les cibles ÉLIGIBLES (portée surincantée comprise / éveillées, LDB 47) sont
      // togglables — indispensable depuis le clic carte (pickingTargets), inoffensif depuis le picker.
      const pool = get().battle?.combatants ?? get().party;
      const caster = pool.find((c) => c.id === pc.casterId);
      const spell = findSpellById(pc.spellId);
      if (!caster || !spell || !overcastTargetCandidates(pool, caster, pc.targetId, spell, !!pc.missile, overcastSourceOf(spell), pc.overcast?.range ?? 0, spellSightOf(get)).some((c) => c.id === id)) return;
      // Capacité SOURCE-AWARE : pas × cible initiale (×initial arcane/miracle) ; pas × 1 (bénédiction).
      const cap = extraTargetCapacity(overcastSourceOf(spell), pc.overcast?.targets ?? 0, spellTargetCount(spell, caster));
      const cur = pc.extraTargetIds ?? [];
      const next = cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length < cap && id !== pc.targetId
          ? [...cur, id]
          : cur;
      set({ pendingCast: { ...pc, extraTargetIds: next } });
    },
    castPickTargets: (on: boolean) => {
      const pc = get().pendingCast;
      if (!pc || !pc.result?.cast || !get().battle) return; // hors combat : pas de carte tactique → picker en modale
      set({ pendingCast: { ...pc, pickingTargets: on } });
    },
    /** Pose de la ZONE (flux « jet puis pose ») : la modale s'efface, le gabarit FINAL suit le
     *  curseur, le clic-case dépose (castCommitZone) ; `false` = revenir à la modale. */
    castPlaceZone: (on: boolean) => {
      const pc = get().pendingCast;
      if (!pc?.zone || pc.zone.center || !pc.result || !get().battle) return;
      set({ pendingCast: { ...pc, zone: { ...pc.zone, placing: on } } });
    },
    castCancel: () => {
      const pc = get().pendingCast;
      if (!pc) return;
      const caster = actorIn(get(), pc.casterId);
      // VERROU POST-JET (#1031) — `LDB 46 l.24` : le Test d'Incantation jeté, le Sort « est lancé »
      // ou « la tentative échoue et rien ne se produit » ; le jet engage. Le geste est REFUSÉ et le
      // dit (l'UI neutralise déjà Échap, cette garde tient aussi face à un intent réseau, qui
      // laissait sinon un `pendingCounterspell` orphelin sans son incantation).
      if (pc.result) {
        if (caster) castRefused(get, set, caster, t('cs.castCancelLocked', { name: caster.label }));
        return;
      }
      // Pré-jet : rien ne peut avoir ouvert de fenêtre de Contre-sort (elle naît AU jet) — on la purge
      // tout de même, l'incantation qu'elle oppose disparaît ici.
      set({ pendingCast: null, pendingCascade: null, pendingCounterspell: null }); // TERMINAL : ferme data + cascade-hôte
      // Modale d'un lanceur ENNEMI fermée sans appliquer : reprendre le tour suspendu (anti soft-lock).
      if (caster && aiDriven(get(), caster) && get().battle) resumeEnemyTurn(get, set);
    },
    // Contre-sort (flux multi) : chaque verbe cible un participant via `pid` (fabrique unique).
    /** Toute rangée jouable ICI et sans jet lance son Contre-sort. Verbe NULLAIRE : le drive
     *  d'auto-cadence (`STEP_WINDOW_AUTO`, `combatAuto.ts`) n'enchaîne que des verbes sans argument, et
     *  la fenêtre est multi-participants (#1040) — un `counterspellRoll(pid)` par rangée.
     *  Table de possession UNIQUE (`influencesLocally`, #1005) : la même qui décide de l'affordance de
     *  la rangée dans `CastModal`. Idempotent (une rangée déjà roulée ne rejoue pas, garde `opRoll`). */
    counterspellRollAll: () => rollAllOwnedRows(get(), get().pendingCounterspell?.participants, (id) => get().counterspellRoll(id)),
    /**
     * DÉCLARATION d'une rangée de la fenêtre — PHASE 1 : contrer SEUL, s'UNIR au Test Soutenu
     * (`LDB 46 l.162`, transposé à la fenêtre réactive — cf. `counterspellConfirm` ci-dessous) ou
     * PASSER. Le MENEUR n'est pas un choix : il se DÉRIVE des rangées unies (`counterspellSoutenu`)
     * et se re-dérive à chaque déclaration. Chaque rangée choisit pour elle (mix libre : unis et
     * lanceurs seuls coexistent dans la MÊME fenêtre) — arbitrages utilisateur 2026-08-04
     * [entériné 2026-08-04], verbatims aux tickets #1042/#1059.
     * GARDES : rangée jouable au siège qui agit (`influencesLocally`, la table de possession de
     * l'affordance), éligibilité de Domaine pour `soutenu` (`counterspellJoinable`), et PHASE encore
     * ouverte (`counterspellDeclarePhase`) — la dernière déclaration FIGE la composition.
     */
    counterspellDeclare: (pid: string, choice: CounterDeclaration) => {
      const s = get();
      const pcs = s.pendingCounterspell;
      if (!pcs || !counterspellDeclarePhase(pcs)) return;
      const part = pcs.participants.find((p) => p.id === pid);
      if (!part || !part.interactive || !influencesLocally(s, pid)) return;
      if (choice === 'soutenu' && !counterspellJoinable(s, pcs, pid)) return;
      set({ pendingCounterspell: { ...pcs, participants: pcs.participants.map((p) => (p.id === pid ? { ...p, declared: choice } : p)) } });
      // PORTE UNIQUE : la phase close SANS aucun lanceur (tout le monde passe) n'a plus rien à jouer —
      // la fenêtre se referme par le résolveur CANONIQUE (`counterspellConfirm`, qui agrège et retombe
      // sur le repli IA), jamais par un troisième chemin de fermeture.
      const fresh = get().pendingCounterspell;
      if (fresh && !counterspellDeclarePhase(fresh) && !fresh.participants.some((p) => counterspellRolls(get(), fresh, p))) {
        get().counterspellConfirm();
      }
    },
    /** Déclare « contrer seul » toutes les rangées encore vierges de CE siège (verbe NULLAIRE du drive
     *  d'auto-cadence, `STEP_WINDOW_AUTO` — la cadence auto joue le geste que le joueur aurait fait en
     *  lançant). MÊME table de possession que le jet (`influencesLocally`) ; les rangées TÉMOIN sont
     *  déjà déclarées à l'ouverture (`autoDeclareWitnessRows`). */
    counterspellDeclareAll: () => {
      const s = get();
      for (const p of s.pendingCounterspell?.participants ?? []) {
        if (!p.declared && p.interactive && influencesLocally(s, p.id)) get().counterspellDeclare(p.id, 'solo');
      }
    },
    counterspellConfirm: () => {
      const pcs = get().pendingCounterspell;
      if (!pcs) return;
      // SITE CANONIQUE (#1040) : PLUSIEURS lanceurs peuvent tenter de dissiper le MÊME Sort, chacun
      // par son lancer SÉPARÉ (`VDM 02 l.184`, clarifie `LDB 46 l.162` — passage du § Sorts
      // permanents, TRANSPOSÉ à la fenêtre réactive : transposition maison, arbitrage utilisateur
      // 2026-08-03 [entériné 2026-08-03], verbatim au ticket). Chacun consomme SA tentative du Round
      // (`l.156`, `VDM 02 l.176`). AGRÉGATION maison : un succès quelconque dissipe (`l.156`) ;
      // échec collectif → le Sort se résout au meilleur DR opposé.
      const rolled = pcs.participants.filter((p): p is CounterParticipant & { result: NonNullable<CounterParticipant['result']> } => !!p.result);
      const disp = rolled.find((p) => p.result.dispelled);
      const best = disp ?? (rolled.length ? rolled.reduce((b, p) => (p.result.counter.sl > b.result.counter.sl ? p : b)) : undefined);
      set({ pendingCounterspell: null });
      if (best) {
        const counter = actorIn(get(), best.id);
        if (counter) applyCounterspellOutcome(get, set, counter, best.result); // mute `pendingCast.result`
      } else {
        // Fenêtre VIERGE : « Appliquer » referme le même état que « Laisser passer » — même repli IA,
        // sinon deux boutons rendaient deux issues opposées sur un état identique.
        applyCounterspellFallback(get, set, pcs);
      }
      resumeAfterCounterspell(get, set); // reprend la chaîne (opposition due, sinon application — mono-cible OU ZdE, + reprise IA) SAUF si le lanceur surfacé tient encore sa modale
    },
    counterspellCancel: () => {
      const pcs = get().pendingCounterspell;
      if (!pcs) return;
      // « Laisser passer » DÉCLINE la fenêtre ENTIÈRE : le geste n'existe plus dès qu'une rangée a
      // chanté — l'issue à appliquer se lit alors par « Appliquer » (`counterspellConfirm`, qui
      // agrège l'état courant). Sans ce refus, un clic tardif jetait un Contre-sort GAGNANT.
      // PORTE UNIQUE en PHASE 1 (#1042/#1059) : tant qu'une rangée n'a pas déclaré, un siège ne
      // referme pas la fenêtre des autres — décliner s'y dit `pass` sur SA rangée, et une fenêtre
      // toute-passée se clôt d'elle-même par `counterspellConfirm` (cf. `counterspellDeclare`).
      // La MÊME frontière est portée par la route de l'intent (`ROUTES`, netOwnership) : les deux bouts.
      if (counterspellChanted(pcs) || counterspellDeclarePhase(pcs)) return;
      set({ pendingCounterspell: null });
      applyCounterspellFallback(get, set, pcs); // aucun surfacé n'a tenté → l'IA chante à leur place
      resumeAfterCounterspell(get, set); // la chaîne reprend (agnostique IA/zone)
    },
    // Test Étendu SÉQUENTIEL (LDB 12) : chaque Round est un slot du flux multi (fabrique UNIQUE).
    // « Une situation = une modale » : le Test étendu EST une cascade à une étape `jet:'extended'`,
    // rendue par `CascadeModal` (via `useExtendedTestJetProps`). `pendingExtendedTest` coexiste comme
    // porteur de données (les Rounds y vivent) ; `extendedTestNext` ferme les deux à la réussite.

    cascadeChoose: (pid: string, key: string) => setCascadeChoice(get, set, pid, key),
    cascadeAmount: (pid: string, n: number) => setCascadeAmount(get, set, pid, n),
    cascadeTableRoll: (pid: string) => rollCascadeTable(get, set, pid),
    // MODE TABLE (#942 L3) : POSER le dé d'une étape à table (champ « Fixer le dé » OU clic sur une
    // ligne — `pid` + dé NATUREL). Délégué NU, comme `cascadeTableRoll` : l'option « Dés fixés » est
    // CLIENT-SIDE (elle arme l'affordance chez celui qui clique, `ui/forcedDieRow.ts`) et un geste reçu
    // par le réseau est autorisé par le SIÈGE ÉMETTEUR (`intentAllowedFor`) — cf. `opSetForcedRoll`.
    cascadeTableSetForcedRoll: (pid: string, roll: number) => setCascadeTableForcedRoll(get, set, pid, roll),
    // DÉ NU (#1508) : les deux mêmes verbes, le même goulot d'état — seule la LECTURE du dé change.
    cascadeDieRoll: (pid: string) => rollCascadeDe(get, set, pid),
    cascadeDieSetForcedRoll: (pid: string, roll: number) => setCascadeDeForcedRoll(get, set, pid, roll),
    cascadeNext: () => dispatchCascadeDone(advanceCascade(get, set)),
    // → BILAN (la modale reste ouverte) : rend `null`, rien à router. Rend une cascade FINALISÉE dans le
    // seul cas où la dernière étape a suspendu la séquence en plein vol (le BILAN n'est pas montrable) —
    // son dénouement passe alors par le MÊME routage que `cascadeNext`/`cascadeFinish`.
    cascadeResolveAll: () => { const done = resolveRemainingCascade(get, set); if (done) dispatchCascadeDone(done); },
    cascadeFinish: () => dispatchCascadeDone(finalizeCascade(get, set)),
    pursuitAbandon: () => pursuitAbandon(get, set), // poursuite terrestre : le groupe renonce (state/pursuitFlow)
    // Incantation OPPOSÉE (multijet `FLOWS.castOpposition`) : chaque cible oppose son Test ; cible IA
    // = rangée témoin (jet auto-roulé à l'ouverture, cf. openCastOpposition). Mêmes 6 verbes que les autres flux.
    // Préfixe store `opposition` ≠ clé de flux `castOpposition` (handler passé explicitement).
    /** Homologue d'opposition de `counterspellRollAll` : toute rangée jouable ICI et sans jet oppose
     *  son Test (mêmes conditions, même socle `rollAllOwnedRows`). Les rangées TÉMOIN sont déjà roulées
     *  à l'ouverture (`openCastOpposition`) — après ce verbe, plus rien n'est dû à `oppositionConfirm`. */
    oppositionRollAll: () => rollAllOwnedRows(get(), get().pendingCastOpposition?.participants, (id) => get().oppositionRoll(id)),
    oppositionConfirm: () => {
      const pco = get().pendingCastOpposition;
      const pc = get().pendingCast;
      if (!pco || !pc) return;
      // La confirmation EXIGE le `result` de chaque rangée INTERACTIVE : l'agrégat ci-dessous n'inscrit
      // dans `opposedOutcome` que les participants résolus, et `applyCast` traite un absent comme NON
      // résistant — une cible sans jet subirait donc le Sort alors que le Sort lui OUVRE ce Test opposé
      // (`SpellSpec.opposed`, réf portée par la donnée du Sort : Fauche-démon, Parole de Tzeentch…).
      const enAttente = pco.participants.filter((part) => part.interactive && !part.result);
      if (enAttente.length) {
        const names = enAttente.map((part) => actorIn(get(), part.id)?.label ?? part.id).join(', ');
        get().log(t('cs.oppositionAwaitingRolls', { names }));
        return;
      }
      // Issue par cible (résisté + marge de DR) → portée par `pendingCast.opposedOutcome`, lue par applyCast.
      const outcome: Record<string, { resisted: boolean; margin: number }> = {};
      for (const part of pco.participants) if (part.result) outcome[part.id] = { resisted: part.result.resisted, margin: part.result.margin };
      set({ pendingCastOpposition: null, pendingCast: { ...pc, opposedOutcome: outcome } });
      resolveCastChain(get, set); // opposition résolue → application (cibles résistantes ignorées, autres à la marge)
    },
    /** Ouvre une incantation HORS COMBAT (couture D) : un héros lanceur du groupe cible self/allié.
     *  Réservé aux sorts NON-offensifs — les Projectiles magiques exigent une cible ennemie (combat). */
    oocCastSpell: (casterId: string, spellId: string, targetId: string, fromGrimoire?: boolean) => {
      const { battle, party } = get();
      if (battle) return; // en combat : l'incantation passe par l'action de combat
      const caster = party.find((c) => c.id === casterId);
      const spell = findSpellById(spellId);
      if (!caster || !spell) return;
      if (isMagicMissile(spell)) {
        get().log(t('cs.magicMissileNeedsTarget', { spell: spell.label }));
        return;
      }
      const target = party.find((c) => c.id === targetId) ?? caster;
      castSpell(get, set, caster, target, spellId, fromGrimoire); // pose `pendingCast` (missile:false, focused selon caster.focus)
    },

    /** Focalise un sort d'Arcane/Domaine (Test étendu de Focalisation). */
    battleFocusSpell: (spellId: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle } = get();
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      // Le héros actif focalise (hotbar) OU l'IA focalise pour ELLE-MÊME (runEnemyAI → case 'focus').
      // On ne laisse PAS le joueur focaliser pendant le tour d'un acteur auto-piloté.
      if (!active || battle.acted || (!controlsCombatant(get(), active) && !aiDriven(get(), active))) return;
      const spell = findSpellById(spellId);
      // Sort non focalisable : le REFUS est rendu au point du geste par le gate `sort-focalisable`
      // (registre des actions) — le dispatcher ne garde que sa garde de validité.
      if (!spell || !isArcaneSpell(spell)) return;
      // Contrecoup bloquant la Focalisation (LDB 46/40), s'il y en a un d'actif.
      const fblocked = castBlockedBy(active, 'focalisation');
      if (fblocked) {
        get().log(t('cs.focusBlocked', { name: active.label, reason: fblocked }));
        return;
      }
      // OUVRE la modale (le Test étendu se fait au clic « Lancer »)
      set({ pendingFocus: { casterId: active.id, spellId: spell.id, result: null } });
    },
    // Focalisation COMMUNE combat/hors-combat (couture D) : acteur via `actorIn`, sortie journal hors combat.
    focusConfirm: () => {
      const { pendingFocus: pf } = get();
      if (!pf || !pf.result) return;
      const caster = actorIn(get(), pf.casterId);
      const spell = findSpellById(pf.spellId);
      set({ pendingFocus: null });
      if (!caster || !spell) return;
      const res = pf.result;
      const prev = caster.focus?.spell === pf.spellId ? caster.focus.dr : 0;
      caster.focus = { spell: pf.spellId, dr: prev + res.dr };
      // Malepierre PORTÉE (`VDM 02 l.163-165`) : le doublement du DR (déjà figé sur
      // `res.malepierreConsumed`, `engine/magic.ts`) décrémente ICI la réserve — seul point
      // d'ÉCRITURE (`consumeMalepierre`).
      const malepierreItem = res.malepierreConsumed ? malepierreItemOf(caster) : undefined;
      consumeMalepierre(caster, res.malepierreConsumed);
      // LDB 46 l.173 : « Incanter ou Focaliser à l'aide d'une malepierre entraîne une influence
      // corruptrice ». Réutilise le `corruptionExposure` déjà porté par l'entrée du catalogue
      // (`TrappingData.consumable`) — MÊME chemin d'exécution qu'un consommable bu (`runConsumable`),
      // jamais un second chemin ad hoc.
      if (malepierreItem) runConsumable(get, set, caster, malepierreItem);
      const ni = spell.cn ?? 0;
      const logLines = [res.log];
      // Composant d'incantation (LDB 46 l.107-113) : la Focalisation est une incantation en cours —
      // un composant adapté au Sort est consumé (si un contrecoup survient) et dégrade l'Imparfaite.
      const compUsed = (res.isCritical || res.isFumble) && useSpellComponent(caster, pf.spellId, logLines);
      // Focalisation CRITIQUE (LDB 46 l.136) : le sort est lançable au prochain Round
      // QUEL QUE SOIT le DR accumulé — mais tant de magie si vite concentrée provoque un
      // contrecoup : Imparfaite Mineure, sauf Talent Harmonisation aethyrique. Sous `VDM 02 l.145`
      // (`focusCriticalDR`) : un DR bonus égal au Bonus de Force Mentale s'ajoute, sans compléter.
      if (res.isCritical) {
        caster.focus = { spell: pf.spellId, dr: focusCriticalDR(caster, caster.focus.dr, ni) };
        logLines.push(t('cs.focusCrit', { name: caster.label, spell: spell.label }));
        // Vie/Ghyran en mer (MDG 02 l.186) : une Focalisation Critique donne une Imparfaite MAJEURE
        // au lieu de Mineure ; le porteur d'Harmonisation aethyrique n'échappe plus au contrecoup —
        // il lance quand même sur le tableau des Imparfaites MINEURES (au lieu d'y échapper).
        const seaMajeure = domainSeaFocusCritMiscastMajeure(spell, seaMagicContext(get()).atSea);
        if (hasFocusHarmony(caster)) {
          if (seaMajeure) logLines.push(...applyMiscast(get, set, caster, 'mineure', { componentDowngrade: compUsed, domainId: spell.domainId ?? undefined }));
          else logLines.push(t('cs.focusHarmonized'));
        } else {
          logLines.push(...applyMiscast(get, set, caster, seaMajeure ? 'majeure' : 'mineure', { componentDowngrade: compUsed, domainId: spell.domainId ?? undefined }));
        }
      }
      logLines.push(caster.focus.dr >= ni ? t('cs.focusEnough', { name: caster.label, spell: spell.label }) : t('cs.focusProgress', { dr: caster.focus.dr, ni }));
      // Maladresse en Focalisation → Incantation Imparfaite Majeure (LDB 46 l.140).
      if (res.isFumble) logLines.push(...applyMiscast(get, set, caster, 'majeure', { componentDowngrade: compUsed, domainId: spell.domainId ?? undefined }));
      finishPlayerAction(get, set, logLines, 'focus'); // sortie commune combat / hors combat (pose `acted:true`)
      // Lanceur ENNEMI (modale auto-pilotée) : le tour de l'IA était suspendu → reprise (calqué sur
      // castConfirm). No-op si une interaction bloquante s'est ouverte (Imparfaite/révélation) — elle
      // reprendra elle-même (resumeSuspendedAI à la clôture).
      if (aiDriven(get(), caster) && get().battle) resumeEnemyTurn(get, set);
    },
    focusCancel: () => set({ pendingFocus: null }),

    /** ÉLIT (ou oublie) le PORTEUR dont on va dissiper un Sort — porte UNIQUE de `dispelCarrierId` :
     *  le clic-token du mode Dissiper l'appelle, la fermeture du panneau-paramètre aussi. Aucun jet,
     *  aucune ressource : c'est un choix d'écran, annulable gratuitement. */
    dispelSelectCarrier: (carrierId: string | null) => set({ dispelCarrierId: carrierId }),
    /** Dissipe un Sort permanent (LDB 46 l.158-160). Action de combat RÉPÉTÉE chaque Round (comme la
     *  Focalisation) ; le DR cumule sur `caster.dispel` jusqu'au NI. */
    battleDispelSpell: (spellId: string, spellCasterId: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const { battle } = get();
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || battle.acted) return;
      if (!actorHasSkill(active, 'langue', 'magick')) { get().log(t('cs.cannotDispel')); return; }
      const target = dispellableSpellsOn(battle.combatants).find((d) => d.spellId === spellId && d.casterId === spellCasterId);
      if (!target) return;
      // SOUTIEN « même Domaine » (LDB 46 l.162) : les AUTRES héros encore en action, possédant Langue (Magick)
      // ET partageant un Domaine (Vent) avec le meneur, l'assistent (+10 chacun, plafond Bonus d'Int) — même
      // primitive `soutienBonus` (LDB 12) que les autres sites de combat, gatée par l'adjacence (l.196, les
      // héros sont dispersés en combat) via le MÊME prédicat `combatDistance` que `openSkillTest`.
      // `Combatant.spells` = ids STABLES au runtime → résolution par id SEULE (pas de repli libellé : interdit).
      const domainsOf = (h: Combatant) => new Set((h.spells ?? []).map((id) => findSpellById(id)?.subType).filter(Boolean) as string[]);
      const mine = domainsOf(active);
      const sup = soutienDetail(battle.combatants, active, 'langue', 'intelligence', 'magick',
        (c) => c.kind === active.kind && [...domainsOf(c)].some((d) => mine.has(d))
          && (!active.pos || (!!c.pos && combatDistance(active, c) <= 1)));
      const value = testValue(active, 'langue', undefined, 'magick') + sup.bonus;
      set({
        pendingDispel: {
          casterId: active.id, spellId, spellCasterId, label: target.label, ni: target.ni, value,
          support: sup.bonus > 0 ? sup : undefined,
          result: null,
        },
        // Le paramètre est choisi : le panneau borné qui l'a servi n'a plus lieu d'être.
        dispelCarrierId: null,
      });
    },
    // Dissipation COMMUNE combat/hors-combat (couture D, #461) : acteur via `actorIn`, sortie
    // journal hors combat (calque `focusConfirm`).
    dispelConfirm: () => {
      const { pendingDispel: pd } = get();
      if (!pd || !pd.result) return;
      const caster = actorIn(get(), pd.casterId);
      set({ pendingDispel: null });
      if (!caster) return;
      const res = pd.result;
      // Cumul LDB 12 mutualisé (`extendedTestStep`) : un Round réussi ajoute son DR, un raté le retire (planché à 0).
      const prev = caster.dispel?.spellId === pd.spellId && caster.dispel.spellCasterId === pd.spellCasterId ? caster.dispel.total : 0;
      // Bonus « propre Sort » (`VDM 02 l.186`) versé sur le DR du jet, PAS sur la cible du Test
      // (`skillDRBonus` vs `skillMod`, `ops.ts:180-184`) — un DR vaut une dizaine (`tests.ts:98`).
      const ownSl = res.sl + dispelOwnSpellDR(pd.spellCasterId === pd.casterId);
      const { total, done } = extendedTestStep(prev, { success: res.success, sl: ownSl }, pd.ni, !!rule('test-extended-min-sl'));
      const logLines = [t('cs.dispelRoll', { name: caster.label, spell: pd.label, roll: res.roll, target: res.target, sl: `${ownSl >= 0 ? '+' : ''}${ownSl}`, total, ni: pd.ni })];
      if (done) {
        // Réussite (DR cumulé ≥ NI, LDB 46 l.160) : retire les effets du sort de tous ses porteurs.
        // Dissipation COMMUNE combat/hors-combat (couture D, #461) : le porteur du sort peut être
        // hors du `battle.combatants` courant (cible du groupe hors combat) → cible la BONNE liste.
        caster.dispel = undefined;
        const b = get().battle;
        // Les États PORTÉS par le Sort partent à ce geste (#1695) : leurs lignes rejoignent CELLES de
        // l'Action (`finishPlayerAction` ci-dessous). Pas de récepteur `ConditionEmit` ici : le canal
        // déclaré du store (`pendingLogQueue.stateId`, `store.ts:676`) n'a encore AUCUN producteur.
        const n = dissipateSpell(b ? b.combatants : get().party, pd.spellId, pd.spellCasterId, undefined, logLines);
        if (b) set({ battle: { ...b, combatants: [...b.combatants] } });
        logLines.push(t('cs.dispelDone', { spell: pd.label, extra: n > 1 ? t('cs.fragTargetsFreed', { n }) : '' }));
      } else {
        caster.dispel = { spellId: pd.spellId, spellCasterId: pd.spellCasterId, total };
      }
      finishPlayerAction(get, set, logLines, 'cast'); // Action consommée (catégorie magie au journal)
    },
    dispelCancel: () => set({ pendingDispel: null }),
    /** Ouvre une Focalisation HORS COMBAT (couture D) : accumule `caster.focus` pour un Sort d'Arcane/Domaine. */
    oocFocusSpell: (casterId: string, spellId: string) => {
      const { battle, party } = get();
      if (battle) return; // en combat : Focalisation = action de combat
      const caster = party.find((c) => c.id === casterId);
      const spell = findSpellById(spellId);
      if (!caster || !spell) return;
      if (!isArcaneSpell(spell)) {
        get().log(t('cs.cannotFocus'));
        return;
      }
      const fblocked = castBlockedBy(caster, 'focalisation');
      if (fblocked) {
        get().log(t('cs.focusBlocked', { name: caster.label, reason: fblocked }));
        return;
      }
      set({ pendingFocus: { casterId: caster.id, spellId: spell.id, result: null } });
    },
    /** Ouvre une Dissipation HORS COMBAT (couture D, #461) : LDB 46 l.160 « pour votre Action » —
     *  la règle n'est pas bornée au combat. Calque `oocFocusSpell` ; réutilise `dispellableSpellsOn`/
     *  `testValue`/`dissipateSpell` de `battleDispelSpell` telles quelles. Soutien « même Domaine »
     *  (l.162) via la MÊME primitive `soutienBonus` — `!caster.pos` (pas de géométrie hors combat)
     *  ouvre l'éligibilité à tout le groupe du même Domaine, comme les autres Tests de groupe hors
     *  combat (le même prédicat couvre déjà ce cas EN combat, cf. `battleDispelSpell`). */
    oocDispelSpell: (casterId: string, spellId: string, spellCasterId: string) => {
      const { battle, party } = get();
      if (battle) return; // en combat : Dissipation = action de combat
      const caster = party.find((c) => c.id === casterId);
      if (!caster) return;
      if (!actorHasSkill(caster, 'langue', 'magick')) { get().log(t('cs.cannotDispel')); return; }
      const target = dispellableSpellsOn(party).find((d) => d.spellId === spellId && d.casterId === spellCasterId);
      if (!target) return;
      const domainsOf = (h: Combatant) => new Set((h.spells ?? []).map((id) => findSpellById(id)?.subType).filter(Boolean) as string[]);
      const mine = domainsOf(caster);
      const sup = soutienDetail(party, caster, 'langue', 'intelligence', 'magick',
        (c) => c.kind === caster.kind && [...domainsOf(c)].some((d) => mine.has(d)));
      const value = testValue(caster, 'langue', undefined, 'magick') + sup.bonus;
      set({ pendingDispel: {
        casterId: caster.id, spellId, spellCasterId, label: target.label, ni: target.ni, value,
        support: sup.bonus > 0 ? sup : undefined,
        result: null,
      } });
    },
    // Psychologie de COMBAT (Peur/Terreur/Traits ciblés, LDB 21) : CASCADE de Round (Traits/Terreur au
    // DÉBUT via openRoundStartPsych ; Peur — Test étendu — à la FIN via openRoundEndCascade), applier
    // 'combatPsych', résolue par les handlers `cascade*`. La Détermination (LDB 17 l.59) est offerte
    // sur la RANGÉE par `cascadeBatchDetermine`.
    // Psychologie À LA RENCONTRE (couture C, LDB 21) : cascade équivalente, applier 'encounterPsych',
    // ouverte par `openEncounterPsych` à l'entrée de scène.

    // ── Entrée en Frénésie d'un héros (LDB 21 l.31-35) : Test de FM, succès → +1 BF / immunité psy / attaque obligatoire ──

    battleFrenzy: () => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || isFrenzied(active) || !isFrenzyCapable(active)) return;
      // OUVRE la modale — le Test de FM se fait au clic « Lancer ».
      set({ pendingFrenzy: { combatantId: active.id, result: null }, battle: { ...battle, action: null } });
    },
    frenzyConfirm: () => {
      const { battle, pendingFrenzy: pf } = get();
      if (!battle || !pf || !pf.result) return;
      const c = inBattleId(battle, pf.combatantId);
      set({ pendingFrenzy: null });
      if (!c) return;
      // ISSUE dérivée par le goulot (`FLOWS.frenzy.apply`, canal COMBAT) : pending FOURNI (fermé juste avant).
      const log = FLOWS.frenzy.apply(get, { p: pf });
      if (pf.result.success) (c.psychState ??= []).push({ type: 'frenesie' });
      set({ battle: { ...markActed(get, set, get().battle!), action: null, log: [...battle.log, ...evLines(log, 'frenzy', c.id)] } });
      checkBattleOver(get, set);
    },
    frenzyCancel: () => set({ pendingFrenzy: null }),

    // ── Cumuler l'Avantage par une Compétence (LDB 09 l.305-308 : Intuition/Savoir/Survie → Int, Prière → Soc) ──
    // « Chaque Round que vous passez à [observer/prier]… réussissant un Test… vous gagnez +1 Avantage »
    // → une ACTION dont la modale de Test STANDARD (cascade, `pendingTest`) octroie l'Avantage plafonné
    // (`combatAdvantage` lu par `resolveTest`). Data-driven : l'action n'existe que si `skillAdvantageCap`
    // (donnée `SkillData.combatAdvantage`) est > 0 — aucune Compétence nommée en dur.
    battleGainAdvantage: (skillId: string) => {
      if (combatBusy(get())) return; // flux différé en cours : hotbar inerte
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active) || !canTakeAction(active)) return;
      const cap = skillAdvantageCap(active, skillId);
      if (cap <= 0 || (active.advantage ?? 0) >= cap) return; // pas d'application « Avantage », ou déjà au plafond de la méthode
      const sd = byId('skill', skillId);
      const skillLabel = sd?.label ?? skillId;
      // Le plafond est une DONNÉE PAR COMPÉTENCE (`SkillData.combatAdvantage.cap`, appliquée par
      // `skillAdvantageCap`) : Intuition relève de l'Initiative mais plafonne au Bonus d'Intelligence
      // (LDB 09 l.305+308). L'enjeu nomme donc CETTE Caractéristique — id en donnée, label à l'affichage.
      const capChar = sd?.combatAdvantage ? CHAR_LABELS[sd.combatAdvantage.cap] : '';
      set({ battle: { ...battle, action: null } });
      // COUTURE UNIQUE (`openSkillTest`) : l'observateur reste l'acteur imposé (`actorId`), et son
      // Test est PERSONNEL — `noSupport` (LDB 09 l.308, LDB 12 l.197).
      openSkillTest(get, set,
        { skill: { id: skillId }, difficulty: 'intermediaire', label: `Avantage — ${skillLabel}`, noSupport: true, stake: combatStakeRef('skillAdvantage', { entryId: skillId, values: { capChar } }) },
        EMPTY_FLOW, EMPTY_FLOW, EMPTY_FLOW,
        { actorId: active.id, combatAdvantage: { combatantId: active.id, cap }, cancellable: true });
    },

    // Résilience « Je ne faillirai pas ! » (LDB 17 l.68) du flux `cast` (forceSuccess/dé choisi) —
    // cycle UNIFIÉ par la fabrique rollFlow. (`attack`/`defense` plus haut ; `test` reste côté store.)
  };
}
