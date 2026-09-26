/**
 * Flux de combat (tour par tour) — module à part du store, qui le ré-expose.
 * Fonctions (get,set) : combat, magie, IA, desengagement, effets. RNG via ./battleRng.
 */
import type { PlayerText } from '../i18n/playerText';
import type { GameState, BattleState, RevealEntry, ShootingStanceKey } from './store';
import type { Get, Set as SetFn } from './flowTypes';
import type { PendingCast, PendingDeviation, PendingCritSeverity, DeviationCtx, PendingBladeTrap, FreeAttackFreeze, BladeTrapFreeze, ScheduledRespawn, PendingReload, PendingAttack, CascadeTableDecl, CascadeTableDone, PendingMiscastStep, CascadeStep, CascadeRoll, BatchParticipant, PendingCounterspell, CounterParticipant, CounterDeclaration } from './pendings';
import { FLOWS } from './rollFlowSpecs';
import { toRecapLines } from './recapLine';
import { Combatant, HitLocation, Weapon, Difficulty, type ShipPoste, type EffectSource } from '../engine/types';
import { rule } from '../engine/policy';
import { battleRng } from './battleRng';
import { ev, evLines, journaliser, type CombatEventKind } from './combatLog';
import { t as tr } from '../i18n'; // alias : `t` est un identifiant local très fréquent ici (cibles/jets)
import { TEMPO } from './tempo';
import { beatHold, approachMs, afterApproach } from './combatDirector';
import { scheduleCombatTimer } from './combatTimers';
import { facingToward, DIR8_ORDER, type Dir8 } from './dir8';
import { d10 } from '../engine/dice';
import { rollWindsOfMagic, hasSecondeVue, windsModLine } from '../engine/windsOfMagic';
import { setVesselHull } from './seaVoyageFlow';
import {
  resolveMelee,
  resolveRanged,
  bestRangedDefense,
  rangedDefenseModes,
  rollRangedAttacker,
  combatValue,
  hasWeaponGroupSkill,
  weaponGroupSkillMode,
  attackModifiers,
  rollMeleeAttacker,
  rollDisengageAttack,
  rollGrappleForce,
  assertAttackWeapon,
  hitLocationByShape,
  locationLabel,
  reverseRoll,
  woundsFromHit,
  woundsAtCritLocation,
  rangeBandModifier,
  rangeBandName,
  belowMinRangeBand,
  resolveStrayRangedHit,
  resolveTrample,
  resolveMeleePassive,
  finishMelee,
  rollMeleeDefender,
  AttackResult,
  ModLine,
  outnumberMod,
  crowdMod,
  defenseTargetMods,
  composeAttack,
  frozenDifficulty,
  type DifficultyShown,
  defenseValue,
  DEFENSE_LABEL,
  attackHandGate,
  conditionModLines,
  canFireWhileEngaged,
} from '../engine/combat';
import { RULE_REF } from '../engine/ruleRefs';
import { engage, markAttacked, isEngaged, decayEngagement, chargeAdvantage, disengageFrom, clearEngagementOf, areInContact, reachTiles, meleeReachTiles } from '../engine/engagement';
import { areGrappling, clearGrapple, grappleEnvMod } from '../engine/grapple';
import { gainAdvantage } from '../engine/advantage';
import { groupAdvantage } from '../engine/advantagePool';
import { campGain, campSpend, spendableAdvantage, reversalStealOne, roundEndAdvantageTransfer } from './combat/advantagePool';
import { sizeGap } from '../engine/size';
import { combatDistance, sizeFootprint, footprintN, footprintChebyshev } from './footprint';
import { isUnbreakable, hasQuality, dangerousNine, hasBladeTrap, strikesLast, isFirearmQuality, reloadDRTarget } from '../engine/qualities/dispatch';
import { applyTriggeredEffects, maneuverEffectsOf, freeAttackSourcesOf, triggerEffectOps, fireOwnTestFailed } from './triggeredEffects';
import { hasStealAdvantage, stealsOneAdvantage, shieldAdvantageLevel, shieldReactionCost, canCounterOnDefenseWin, talentCritExtraWounds, reloadDRBonus, arcaneDomainIdOf, retreatAdvantageCost, canDisengageWithLessAdvantage, hasBattement, hasDistraire, canPreemptRanged, hasInstinctiveDiction, hasCritRollTwiceTalent, fleeMovementBonus } from '../engine/combatFeatures/dispatch';
import {
  isStupid,
  flyMeters, runMultiplier,
  isSkittishMount, immuneToSpellDomain,
  traitCapability,
} from '../engine/traits/dispatch';
import {
  isMagicMissile,
  prayerWrathTriggered,
  castBlockedBy,
  prayerSinLock,
  evaluateMissile,
  spellDRModFor, spellSLFor, spellLandsOn, talentSpellDRMod, zoneTalentSpellDRMod,
  applyFullPower,
  defaultCritChoice,
  spellRangeTiles, effectiveSpellRangeTiles,
  durationClockMinutes,
  castInfo,
  castingValue,
  castingBaseValue,
  castPenaltyMod,
  knowsCastingSkill,
  isDispellableSpell,
  resolveCounterspell,
  soutenuPartners,
  soutenuLeaderOf,
  soutenuBonusOf,
  castTestOf,
  rederiveCastSL,
  zdeDiameterMeters,
  zdeRadiusTiles,
  isArcaneSpell,
  castInfoIsPrayer,
  focusSkillFor,
  castLandProbability,
  magicDeviationEligible,
  malevolentInfluenceSeverity,
  malepierreItemOf,
  consumeMalepierre,
  sorceryMandatoryMiscast,
  type CastResult,
  type MissileResult,
  type CounterspellOutcome,
  type SpellLike,
} from '../engine/magic';
import { type OvercastSource, overcastSourceOf, overcastDurationParts, overcastBudget, overcastAxes, extraTargetCapacity, zoneDiameterMultiplier } from '../engine/overcast';
import type { SpellRange } from '../engine/spellRange';
import { evalCondition } from '../engine/flowCore';
import { combatConditionCtx } from './combat/flowEval';
import { applyOps, resolveFormula, skillDRBonus, type GameOp, type OpsCtx } from '../engine/ops';
import { applySummon } from './summonFlow';
import { runConsumable } from './consumableFlow';
import type { ConjureForm } from '../engine/conjuredWeapons';
import { gainCorruption } from './corruptionFlow';
import { corruptionGain } from '../engine/corruption';
import { libelleDeValeur } from '../data/schemas/grammaire/meta';
import { critTableSchema } from '../data/schemas/defs/criticals';
import { canCastFromGrimoire } from '../engine/grimoire';
import { effectiveCastingNumber } from '../engine/castingNumber';
import type { CastingNumberMod } from '../engine/castingNumber';
import {
  rollMiscast, componentDowngrade, miscastTableId, miscastRowAt, miscastRowSource, MISCAST_TABLES, MISCAST_TABLE_ROWS,
  type MiscastSeverity, type MiscastResult,
} from '../engine/miscast';
import { opposedTest, rollTest, evaluateTest, resolveOpposed, isDoubleRoll, extendedTestStep, easeDifficulty, hydrateTR } from '../engine/tests';
import { effectiveChar, bonus } from '../engine/characteristics';
import { testValue, type SupportDetail } from '../engine/skills';
import { findManeuverById, findDomainById, diseaseLabel, refLabel, findPsychologyById, findVehicleById, combatStakeRef, GRAPPLE, type SpellData, type ManeuverDef, libelleOuAbsence } from '../data';
import { applyHullCritical, exposedCrew } from '../engine/shipCritical';
import { endShanty, resolveShipUnits } from './shipCrew';
import { beginShipwreck } from './shipwreck';
import { isInanimate, isStructure, structureAimCell, ramVsNonDoor } from '../engine/structures';
import { rollStructureCritical, structureCollapseLog, type StructureCriticalResolved } from '../engine/structureCritical';
import { STRUCTURE_CRITICALS } from '../data/structureCriticals';
import { actorIn, inBattleId, garanti } from './combatants';
import { followsCharacterRules, effectivelyHostile } from '../engine/relations';
import type { ShipRig } from '../engine/combat';
import { norm } from '../lib/normalize';
import { loadRegister, weaponLoaded, reloadProgressOf } from '../engine/weaponLoad';
import { recomputeLoadout, weaponWithAmmo, loadedAmmo, loadWeapon, unloadWeapon, setReloadProgress, spendChamberedRound, consumeAmmo, ammoFamily, ammoFamilyLabel, damageArmour, deviatableArmourAt, buildWeapon, isUnarmed } from '../engine/items';
import { hasCapability, itemCapability } from '../engine/capabilities';
import { effectiveMovement } from '../engine/encumbrance';
import { isOutOfAction, addCondition, removeCondition, hasCondition, cannotDefend, canTakeAction, applyZeroWounds, usesSuddenDeath, inDeathCondition, stacks, recoveredStacks, incomingMeleeAdvantage, removeActiveEffects, effectRef, COND } from '../engine/conditions';
import { creatureAttacks, selfManeuversOf, selfManeuverApplicable, type CreatureAttack } from '../engine/creatureAttacks';
import { hasActiveFlag } from '../engine/activeFlags';

/** Deux lancers de Blessure Critique, dont le porteur CHOISIT le résultat gardé (LDB 41 l.170) :
 *  Bénédiction de Sauvagerie (drapeau TEMPORAIRE `hasActiveFlag`) OU Frappe blessante — variante AA
 *  (AA 13 l.57, capacité PERMANENTE de talent `hasCritRollTwiceTalent`). Point de fusion UNIQUE —
 *  `resolveCritique` ne connaît que le booléen, et le tri des deux dés se déclare sur l'étape à table
 *  (`CascadeTableDecl.keepHighest` : politique du maximum, défaut de l'IA — le choix que le RAW
 *  confie au porteur n'est pas surfacé au joueur, #982). */
function critRollTwiceFor(c: Combatant | undefined | null): boolean {
  return !!c && (hasActiveFlag(c, 'critRollTwice') || hasCritRollTwiceTalent(c));
}
import { domainOnHitEffects, domainCasterOps, isSorceryDomain, domainEnvironmentBonus } from '../engine/domainAttributes';
import { decayZones, discTiles, wallTiles, clampZoneTiles, metersToTiles, resolveZoneMeters, type BattleZone } from './zones';
import { carryOverState } from '../engine/persistence';
import { contractionDue, applyContraction, hasActiveCapability, diseaseDefs } from '../engine/disease';
import { resolveCritique, jeuDeCritique, critiqueTriviale, critWoundLocation, critImmediateSummary, prendreAmputationsDifferees, critSeverityReduction, critTableKeyFor, critTableRows, type CriticalResolved, type CritTableKey } from '../engine/critical';
import { findTableEntry } from '../engine/tables';
import { isFumble, rollOups, type OupsResolved } from '../engine/oups';
import { rollArtillerySalveMisfire } from '../engine/artilleryMisfire';
import { traumaById, dechirureFractureFicheId, consolidateAmputations, maxFingersLostForWeapon, reinjuryBleed } from '../engine/trauma';
import { effectiveWeaponDamage, effectiveWeaponRange, isThrownWeapon, damageWeapon, destroyWeapon, isImprovised, solideSaveThreshold, effectiveWeapon, type WeaponContext } from '../engine/weaponDamage';
import { scatter } from '../engine/scatter';
import { TIME_COST } from '../engine/timeCost';
import { MINUTES_PER_DAY } from '../engine/clock';
import { findSpell, findSpellById } from '../data/index';

/** Résout un sort par ID STABLE. SOURCE UNIQUE de la résolution de sort dans le flux de combat.
 *  `Combatant.spells` = ids au runtime (créatures via spawn, héros via pregens) → AUCUN repli libellé
 *  (un fallback id→libellé = rétro-compatibilité, proscrite). Les libellés restent au seul niveau AUTHORING. */
const resolveSpell = (id: string) => findSpellById(id);
import { toBrass, fromBrass } from '../engine/money';
import { partyMoneyTotal, condCtx } from './bourseFlow';
import { Scene, sceneMetresPerTile, isMerScene, setStructureDown, setTileCollapsed, parapetTilesAbove, heightAt, structureIsDown, climbEdgeBetween, type VictoryCondition } from './scene';
import { STEP_MAX_M } from './relief';
import { placeCombatant } from './spawn';
import { rollInitiative, combatOrder } from './combatSetup'; // relance d'Initiative par Round (LDB 13 l.43)
import { sweepDismountDeaths, mountedAttackMods, mountedDodgePenalty, mountMovement, mountOf, mountUp, mountableNear, movementRemaining, canMove, riderFearSize, combatGeomOf, attackGeomOf, meleeWeaponInRange, pickAttackWeaponList } from './mount';
import { lineOfSightCover, losClear, tilesBetween, tileSeenByFoe, makeLosMemo } from './lineOfSight';
import { coverModifier, couvertLePlusProtecteur } from '../engine/cover';
import { shipOfCrew, mountedWeaponBears, servingCrewPresent, servablePostes, serveAtPoste, crewPosteOf } from './shipPostes';
import { isVehicle } from '../engine/vehicle';
import { targetArc, headingToBear } from './fireArc';
import { bearingPostes, mostArmedSide } from './shipBattery';
import { shipHelmsman, maneuverShip } from './shipManeuver';
import { crewedFireWeapon } from '../engine/crewedWeapon';
import { warMachineFireWeapon, warMachineCrewRequired, warMachineCrewPenalty } from '../engine/warMachineCrew';
import { fearSourceFor, refreshAllDefendedPsych, sansPeurVs, failConditionAmount, isPsychImmune, isFrenzied, clearPsychOf, targetedTrigger, supersededLines, psychResolution, psychBranchOps, psychBranchFlow, gainPhobieIfThreshold, estCibleType, cibleLabel, PsychType } from '../engine/psychology';
import { groupMatch } from '../engine/groups';
import { sceneCombatModifiers } from './sceneRules';
import {
  weatherCondition, weatherRangedMod, weatherRangedUseless, weatherPowderUseless,
  weatherLightningNervous, weatherRef,
  type Weather,
} from '../engine/travelStages';
import { weaponGroupKey } from '../engine/weaponGroup';
import { moveReachFor, flyReachable, fleeReachable, pushAway, pullToward, pathTo, chebyshev, tileKey, Pt, climbTraverseFor } from './path';
import { chooseEnemyAction, consumeAiRanking, type EnemyAction, type EnemyTurnInput, type CastableSpell, type AiCandTrace } from './ai';
import { resolveRun, chargeReach } from '../engine/movement';
import type { RNG } from '../engine/dice';
import { bus, EVT } from './bus';
import { emitCombatEvent } from './combatEvents';
import { massBattleTrackHit } from './massBattleFlow';
// Géométrie de combat extraite (placement/déplacement/zones/flanc-dos/vision) — importée pour
// l'usage interne ET ré-exportée (baril) pour les importeurs de combatFlow.
import {
  occupied, cannotStopOn, moveEnv, displaceSmaller, removeEntities, inRect,
  applyZoneCrossings, isFlankOrRear, seesInDark, smokeOf, porteeEnCases,
} from './combatGeometry';
export * from './combatGeometry';
import { releaseSeat, releaseUnavailableSeats } from './seating';
// --- Résolveur d'aire des munitions/armes à effet de zone (Tir de zone / Explosion) extrait → combatArea.ts (baril) ---
export * from './combatArea';
import { resolveWeaponArea, areaTargets, blastRadiusTiles, type AreaTargets } from './combatArea';
// --- Garde de reprise unique (« une modale / une pause bloque l'IA ? ») extraite → combatGate.ts (baril) ---
export * from './combatGate';
import { combatAdvanceBlocked, aiDriven } from './combatGate';
import { perceivedTiles } from './visionState';
import { cadenceAutoCombat } from '../engine/cadence';


// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

export function activeCombatant(battle: BattleState): Combatant | undefined {
  return inBattleId(battle, battle.order[battle.turn]);
}

// --- Effets de scène/campagne extraits → combatEffects.ts (baril) ---
export * from './combatEffects';
import { pushReveal, pushCombatStep, applyEffects, gearFromEffects, drainPendingLog, registerCastSpellEffect, registerSuiteCombat, ouvrirChute, cloturer, registerCloture, revealPurpose } from './combatEffects';
import { teamCommandMod } from './commandTeam';
// --- Manœuvres de créature (énumération + résolveurs roll/apply) extraites → combatManeuvers.ts (baril) ---
export * from './combatManeuvers';
// --- Refonte par coutures : registre de hooks de cycle de vie + mise en place (barils, modules FEUILLES) ---
export * from './combatHooks';
export * from './combatSetup';
import { collectHeroRoundEndUpkeep } from './combat/roundHooks';
import { controlsCombatant, defenseSurfaced, jetSurfaced, tenuParUnHumain } from './netOwnership';
import { resolveRecoverTest } from './combat/recover';
import { fireTurnStartTriggers, fireTurnEndTriggers, resolveActGates } from './combat/turnHooks'; // effets de bord de tour (onTurnStart/onTurnEnd, dont la sortie de Frénésie en données) + gate d'action (Mandragore)
export { collectHeroRoundEndUpkeep } from './combat/roundHooks'; // baril : enregistre les hooks de franchissement de Round (effet de bord) + ré-export pour la cascade d'upkeep
export * from './combat/triggeredTest'; // baril : enregistre l'applier de cascade `triggeredTest` + installe le routeur de Test des triggers (effet de bord)
import { runCombatFlow, routeTriggeredTest, bandeTriggeredTest, rollFrozenOpposedAttacker, frozenOpposedBatchStep, simpleBatchTestStep } from './combat/triggeredTest'; // usage interne (applyCast : exécuteur de Flow de sort EN COMBAT, after-aware → canal de journal unique ; Surprise : opposition figée + bande de guetteurs)
export { aiMaybeFrenzy, resolvePsychAI, fireTurnStartTriggers, fireTurnEndTriggers, resolveActGates } from './combat/turnHooks'; // baril : enregistre les hooks de début de tour ennemi (effet de bord) + ré-export pour frenzy*.test / psych*.test + effets de bord de tour + gate d'action
// Sauvegardes post-touche en registre `HitModifier` ordonné (state/combat/hitModifiers, module FEUILLE).
import { runHitModifiers, toucheSauvee } from './combat/hitModifiers'; // usage interne (applyAttackResult + applyCast : SITE UNIQUE des sauvegardes de touche)
export { runHitModifiers, registerHitModifier, martyrGuardOf, wardedAgainst, organicProjectile, toucheSauvee } from './combat/hitModifiers'; // baril : enregistre les modifiers (effet de bord) + ré-export pour applyCast / les tests (l11-sorts-zones, etc.)
import {
  trampleTarget, bestDefenseMode,
  rollManeuverAttacker, maneuverAttackerDifficulty, resolveManeuver, availableFreeAttackOps,
  resolveBattement, battementEligible, resolveDistraire, distraireEligible, distraireAttackValue, distraireDefenseValue,
  setManeuverPostHitHook,
} from './combatManeuvers';
import { spellFlowFor, spellOps, testFlow, flowHasFreeAttack, flattenFlow, EMPTY_FLOW, type Flow, type FlowTest, type EffectTrigger } from './flow';
import { registerCascadeApplier, registerCascadeTableFold, runCascadeImmediate, registerTableStep, rollTableStep, poserCurseurCascade, lireEnSeuil, etapesDeLaFenetre } from './cascade';
import { nightBands, splitBandRows } from './nightBands';
import { combatEndBands, combatEndRowMeta } from './combatEndBands';
import type { CascadeStepMeta, ChaineDeBalayage, EnchainementDuCoup, RebondDeChaine, SeuilDeSauvegarde, SauvegardeSuite, SuiteDeCoup, ToucheDeProjectile } from './pendings';
import {
  freeCons, resultLines, rollLine, rollStep, rollSansPilote, surfaceOf, monoStep, pousseSi,
  hostStep, idDansLaSequence, openSequence, openBand, pushHost, pushTableDone, pushTable, pushChoice, pushDisplay, pushDie, tableStep, makeBandFactory,
  type Consequence, type TableSpec,
} from './rollSeam';
import { revealToStep } from './revealStep';
import type { BuiltCascadeStep } from './stepBrand';
import { dataLabel } from '../data';
import { stepPrecision, stepPsych } from './rollSeam';

/** L'État du défenseur accorde-t-il un Avantage à l'assaillant en mêlée ? Lu en DONNÉES
 *  (`incomingMeleeAdvantage` → `passive` `incomingAdvantage`, kind `etat`). Sonné : « +1 Avantage avant
 *  l'attaque » (LDB 16 l.125) — ce gain profite déjà au jet en cours puis persiste. À appeler une seule
 *  fois par attaque (avant le 1er jet ; pas sur une relance). L'État est lu par sa DONNÉE, jamais par son nom. */
export function applyIncomingMeleeAdvantage(get: Get, attacker: Combatant, target: Combatant): void {
  const adv = attacker.weapons[0]?.type === 'melee' ? incomingMeleeAdvantage(target) : 0;
  if (adv > 0) {
    campGain(get, attacker, adv);
    attacker.gainedAdvThisRound = true;
  }
}

/**
 * Arme RÉELLEMENT employée par une attaque PILOTÉE (`PendingAttack`) — SOURCE UNIQUE (#1026) consommée
 * par l'application (`attackConfirm`) ET par la modale d'attaque : deux résolutions séparées peuvent
 * rendre des armes de type/portée différents pour le MÊME `pa`, donc deux verdicts d'interposition
 * (`surfacedDefensePending`) opposés — l'écran annoncerait le résultat puis la fenêtre l'invaliderait.
 *
 * Manœuvre de mêlée d'un trait SANS arme équipée (Morsure/Attaque caudale) : l'arme naturelle est
 * synthétisée (même helper que l'IA, `freeAttackWeapon`) avec l'Indice lu du profil. La mutation
 * Tentacule, elle, A une arme équipée (`nat-tentacule`) → `firedWeapon` la résout normalement.
 */
export function attackWeaponOf(battle: BattleState, attacker: Combatant, target: Combatant, pa: PendingAttack): Weapon {
  // L'attaque NATURELLE prime : son arme est SYNTHÉTISÉE (aucune arme tenue ne la porte), donc ni
  // l'objet figé au jet — qui est l'arme TENUE, `resolveAttack` passant par `firedWeapon` — ni le
  // repli par uid ne peuvent la rendre.
  const freeNatural = pa.freeKind && !attacker.weapons.some((w) => w.uid === pa.weaponUid)
    ? freeAttackWeapon(pa.freeKind, creatureAttacks(attacker.traits ?? []).find((a) => a.kind === pa.freeKind)?.bonus ?? 0)
    : null;
  // Sinon l'arme FIGÉE au jet (#1153) : `Combatant.weapons` ne porte que le loadout ACTIF, un uid seul
  // peut donc être introuvable et rendre la main à l'auto-choix. Repli = pending d'avant le gel.
  return freeNatural ?? pa.weapon ?? firedWeapon(attacker, target, pa.weaponUid, battle.combatants);
}

/** Arme effectivement tirée : mêlée au contact, distance sinon (Atout Pistolet pour tirer en Combat
 *  rapproché — LDB Armes l.297-298), AUGMENTÉE de la munition pour un héros (Dégâts + Atouts combinés).
 *  Centralisé pour que résolution / Chance / application voient la MÊME arme (munition, Empaleuse, reload). */
export function firedWeapon(attacker: Combatant, target: Combatant, weaponUid?: string, combatants?: Combatant[], harpoonRopeCut?: boolean): Weapon {
  // Choix explicite du joueur (uid) sinon auto-choix PAR-ARME (#BUG-A, poule-et-œuf) : chaque candidate de
  // mêlée est évaluée avec SA PROPRE géométrie (`pickAttackWeaponList`) — un cavalier au contact par sa
  // monture choisit la mêlée (LDB 14), un chef de bélier via l'empreinte de LA PIÈCE, mais une arme
  // personnelle (épée du chef) ne bénéficie JAMAIS de l'allonge de la coque servie.
  const base = pickAttackWeaponList(combatants, attacker, target, weaponUid);
  const ammo = base.type === 'ranged' && attacker.kind === 'hero' ? loadedAmmo(attacker, base) : undefined;
  let w = ammo ? weaponWithAmmo(base, ammo) : base;
  // Pièce SERVIE en sous-effectif (poste) : bake les Défauts d'Arme d'équipe selon les servants APTES présents
  // (MDG 12 l.448-460) — recharge ×2 / Imprécise / Dangereuse, effectif COMPLET → tir net. `combatants` n'est
  // fourni QUE par les chemins de tir réels (résolution / aperçu / modale / re-jet) ; un chef sans poste → inchangé.
  if (combatants && attacker.mannedPoste) {
    const present = servingCrewPresent(attacker, combatants);
    if (present != null) w = crewedFireWeapon(w, present);
    // Machine de guerre ADE II (Qualité `equipe`, ch.08 l.233) : effectif BRUT du poste — le RAW ne pose
    // ICI aucune exigence de Compétence pour compter dans l'Équipe (≠ AA 10 l.230/MDG 12 l.442 ci-dessus) — 3ᵉ courbe,
    // jamais mêlée à celle d'AA (`warMachineFireWeapon` ne touche QUE `crewTeamPenalty`, pas la Recharge).
    if (warMachineCrewRequired(w) > 0) {
      const crew = (attacker.mannedPoste.crewIds ?? [])
        .map((id) => combatants.find((c) => c.id === id))
        .filter((c): c is Combatant => !!c);
      w = warMachineFireWeapon(w, exposedCrew(crew).length);
    }
  }
  // Règles d'arme CONTEXTUELLES de Groupe (LDB 62) repliées sur le profil : Lance de cavalerie hors Charge
  // → improvisée (l.59) ; Fléau sans la Spécialisation → Dangereuse + aucun Atout (l.146-147). Liées ICI —
  // funnel UNIQUE attaquant ⊕ arme ⊕ contexte — donc la MÊME arme transformée sert la touche/les Dégâts
  // (`resolveAttack` → `applyHit`) ET la Maladresse sur un RATÉ : `attackConfirm` et l'IA RE-DÉRIVENT l'arme
  // par `firedWeapon`, si bien que `dangerousNine` voit la Dangereuse du Fléau sans compétence.
  return effectiveWeapon(w, weaponContextOf(attacker, w, target, { harpoonRopeCut }));
}

/** Contexte d'usage d'une arme (règles d'arme CONTEXTUELLES de Groupe, LDB 62) dérivé de l'attaquant.
 *  SOURCE UNIQUE de la dérivation : `firedWeapon` (attaque principale) ET `resolveDualSecond` (2ᵉ frappe du
 *  Maniement de deux armes) l'appellent — aucune duplication de l'inférence `charged`/`mounted`/`hasGroupSkill`.
 *  `target` (optionnel — rétro-compat) sert le combat « au contact » (LDB 62 l.176) : une arme plus longue
 *  que Courte devient improvisée quand attaquant et cible sont entrés dans la longueur d'arme l'un de l'autre. */
export function weaponContextOf(attacker: Combatant, w: Weapon, target?: Combatant, opts?: { harpoonRopeCut?: boolean }): WeaponContext {
  const heroItem = (attacker.items ?? []).find((it) => it.uid === w.uid);
  return {
    charged: !!attacker.chargedThisTurn,
    mounted: !!attacker.mountId,
    hasGroupSkill: hasWeaponGroupSkill(attacker, w, w.type === 'ranged' ? 'ranged' : 'melee'),
    groupSkillMode: weaponGroupSkillMode(attacker, w, w.type === 'ranged' ? 'ranged' : 'melee'), // LDB 62 l.184/188
    auContact: !!target && areInContact(attacker, target),
    improvised: !!target && ramVsNonDoor(w, target), // Bélier hors-porte → improvisée (ADE II 8 l.249)
    // Mode de tir « corde séparée » (Lance-harpon, ADE II 02 l.677) : choix joueur (`opts`, #476) GATÉ sur
    // la capacité de l'arme (`ItemCapabilities.ropeMode`) — jamais un id d'arme en dur.
    harpoonRopeCut: !!opts?.harpoonRopeCut && !!heroItem && itemCapability(heroItem, 'ropeMode'),
  };
}

/** Restriction d'armes à distance EFFECTIVE (#471, NADJ 06 l.181 : « la PLUPART des lois locales
 *  interdisent de faire appel à des projectiles ») — SEUL point de résolution du défaut, consommé
 *  par `firedAttackBlock` (gate joueur/IA) ET `resolveAttack` (application). `banRanged` explicite
 *  PRIME (`true`/`false` = dérogation assumée par l'auteur) ; absent + `firstBlood` = interdit PAR
 *  DÉFAUT (le duel judiciaire est la seule rencontre où le RAW pose la restriction par défaut) ;
 *  absent hors `firstBlood` = autorisé (défaut historique, non-régression). */
export function banRangedActive(battle: BattleState | null | undefined): boolean {
  return battle?.banRanged ?? (battle?.victoryCondition?.type === 'firstBlood');
}

/** Rencontre de SIÈGE effective (`EncounterDef.siege` — arbitrage utilisateur du 2026-09-04, verbatims
 *  au foyer unique : JSDoc de `siege`, `data/schemas/defs-scenes/scene.ts`) — SEUL point
 *  de résolution, consommé par `buildAiInput` pour offrir (ou non) les structures destructibles au
 *  choix de cible de l'IA. Défaut LITTÉRAL `false` : contrairement à `banRangedActive`, rien n'est
 *  dérivé d'un autre champ — ni de `victoryCondition`, ni de la présence d'une structure dans la
 *  scène. L'auteur déclare le siège, ou il n'y en a pas. */
export function siegeActif(battle: BattleState | null | undefined): boolean {
  return battle?.siege === true;
}

/** Tir héros refusé — LÉGALITÉ de l'arme employée (tir en étant *Engagé*, `LDB 14 l.41` ; armes à distance
 *  bannies de la rencontre) ou RESSOURCE : arme à défaut Recharge non chargée (LDB 62 l.335) ou plus
 *  de munition compatible — `null` si le tir peut partir. Concern ORTHOGONAL à la géométrie (`attackPlan`),
 *  rejoué À L'IDENTIQUE par le clic (`battleClickEntity`) ET le survol (`hoverTargeting`) pour que
 *  l'affordance ne mente jamais : un réticule de tir sur une arbalète vide DOIT dire « recharger », pas
 *  proposer une attaque qui se solderait par un log silencieux. Mêlée / pas d'arme à distance → `null`
 *  (la Recharge ne concerne que l'arme effectivement tirée, `firedWeapon`). */
export function firedAttackBlock(get: Get, active: Combatant, target: Combatant, weaponUid?: string): { reason: 'unloaded' | 'noammo' | 'arc' | 'sous-effectif' | 'portee-min' | 'armeBannie' | 'engaged'; detail: string; need?: string } | null {
  if (active.kind !== 'hero') return null;
  const b = get().battle;
  // Arme effectivement testée + distance PAR CETTE ARME (#BUG-A, poule-et-œuf) : choix EXPLICITE (poste
  // servi → `weaponUid`) sinon chaque candidate de mêlée évaluée avec SA PROPRE géométrie (`pickAttackWeapon`,
  // MÊME arbitrage que `firedWeapon`) — le gate ne doit pas mentir sur une AUTRE arme que celle qui tirera.
  const w = b
    ? pickAttackWeaponList(b.combatants, active, target, weaponUid)
    : (weaponUid ? active.weapons.find((x) => x.uid === weaponUid) : undefined) ?? assertAttackWeapon(active.weapons, combatDistance(active, target) <= meleeReachTiles(active.weapons));
  const distanceTiles = b ? combatDistance(attackGeomOf(b, active, w), combatGeomOf(b, target)) : combatDistance(active, target);
  // Machine de guerre ADE II (Qualité `equipe`, ch.08 l.233) sous LA MOITIÉ de l'Équipe requise : INUTILISABLE
  // — mêlée (bélier, Force) ET distance, donc AVANT le early-return ranged-only ci-dessous.
  const required = warMachineCrewRequired(w);
  if (required > 0 && active.mannedPoste) {
    const crew = (active.mannedPoste.crewIds ?? []).map((id) => inBattleId(b, id)).filter((c): c is Combatant => !!c);
    if (warMachineCrewPenalty(exposedCrew(crew).length, required).unusable)
      return { reason: 'sous-effectif', detail: `${active.label} : Équipe trop réduite pour servir ${w.label}.` };
  }
  if (w.type !== 'ranged') return null;
  // Tir en étant *Engagé* : impossible sauf Atout d'arme Pistolet (`LDB 14 l.41`, `LDB 62 l.284-285`).
  // Refus AVANT les gates de ressource : recharger ne débloquerait rien.
  if (isEngaged(active) && !canFireWhileEngaged(w))
    return { reason: 'engaged', detail: `${active.label} est Engagé : ${w.label} ne peut pas tirer (Atout Pistolet requis).` };
  // Restriction d'armes à distance de la rencontre (#471, NADJ 06 l.181) — même refus AVANT tout autre
  // gate de ressource (Recharge/munition), pour ne pas dire « recharger » à une arme de toute façon bannie.
  if (banRangedActive(b)) return { reason: 'armeBannie', detail: `${w.label} : les armes à distance sont interdites (duel judiciaire).` };
  if (!weaponLoaded(active, w)) return { reason: 'unloaded', detail: `${active.label} doit recharger ${w.label}.` };
  // Munition requise UNIQUEMENT si l'arme en consomme (famille de munition) ; un tir sans munition suivie
  // (ex. arme sans Groupe) reste possible. `ammoFamily` falsy ⇒ pas de suivi de munition (cf. compatibleAmmo).
  if (ammoFamily(w.subType) && !loadedAmmo(active, w)) {
    const need = ammoFamilyLabel(w.subType, w.defaultAmmo);
    return { reason: 'noammo', detail: `Pas de munitions (${need}) pour ${w.label}.`, need };
  }
  // PORTÉE MINIMALE d'une machine de siège (ADE II 8 l.251/253) : REFUS (pas un malus) si la cible est
  // plus PROCHE que la bande minimale de l'arme — machines à distance : pas de Bout Portant (l.253) ;
  // trébuchet/mortier : rien sous la Portée Courte (l.251). DONNÉE générique `w.minRangeBand` (pas un flag par-machine).
  if (w.minRangeBand) {
    const rangeM = effectiveWeaponRange(w, loadedAmmo(active, w)?.ammoRangeMod, () => bonus(effectiveChar(active, 'force')));
    if (rangeM != null && belowMinRangeBand(distanceTiles, rangeM, w.minRangeBand))
      return { reason: 'portee-min', detail: `${w.label} ne peut pas tirer d'aussi près (${rangeBandName(distanceTiles, rangeM) ?? 'trop proche'}).` };
  }
  // Pièce d'artillerie à ARC (poste) : ne porte que dans son arc. NAVAL = relatif au cap de la coque support
  // (`shipOfCrew` → `facing[ship.id]`, `ship.pos`). EMPLACEMENT AU SOL (siège) : pas de coque (`shipOfCrew`
  // → undefined) → l'arc pivote avec l'orientation-monde ET la position DU CHEF lui-même. KIND-AGNOSTIQUE.
  // `mountSide` absent (arme non montée / pivot libre) → aucune contrainte. NB : l'IA aura le MÊME prédicat.
  if (w.mountSide && target.pos) {
    const battle = get().battle;
    const ship = battle ? shipOfCrew(battle.combatants, active.id) : undefined;
    const heading = ship ? get().facing[ship.id] : get().facing[active.id];
    const pos = ship?.pos ?? active.pos;
    if (!mountedWeaponBears(w, heading, pos, target.pos))
      return { reason: 'arc', detail: `${w.label} ne porte pas dans cet arc (${w.mountSide}).` };
  }
  return null;
}

/** Résout une attaque (le JET) SANS l'appliquer — pour le flux par modale (« Lancer »
 *  puis éventuel point de Chance). Retourne null si la cible est hors de portée de mêlée. */
/** Tir dans la mêlée (LDB 14 l.116) : si la pénalité de −20 a transformé une réussite en échec, le
 *  tir touche un allié intercalé de la cible. Retourne l'allié (le 1er Engagé côté tireur, « au
 *  hasard » approximé — le cas courant n'a qu'un allié au contact), ou null si non applicable. */
export function strayShotVictim(res: AttackResult, attacker: Combatant, target: Combatant, battle: BattleState): Combatant | null {
  if (res.hit || !res.attackerDetail) return null;
  if (res.attackerRoll > res.attackerDetail.target + 20) return null; // n'aurait pas touché même sans le −20
  const allies = (target.engagedWith ?? [])
    .map((id) => inBattleId(battle, id))
    .filter((c): c is Combatant => !!c && c.kind === attacker.kind && !isOutOfAction(c));
  return allies[0] ?? null;
}

/** Cibles éligibles d'un « Tir dans le tas » (LDB 14 l.106) : TOUT le monde serré autour de la
 *  cible (au contact, Chebyshev — diagonale incluse), vivant et positionné, LE TIREUR EXCLU — les
 *  DEUX camps : « vous touchez l'un des adversaires de la cible au hasard » → ça peut être un de vos
 *  PROPRES alliés engagés dans la mêlée (tir fratricide), pas forcément un ennemi. Un tir réussi en
 *  touche UNE au hasard. Base partagée avec le futur surlignage des zones d'effet (Explosion / sorts). */
export function crowdEligible(battle: BattleState, attacker: Combatant, target: Combatant): Combatant[] {
  return battle.combatants.filter(
    (c) => c.id !== attacker.id && !isOutOfAction(c) && c.pos && combatDistance(c, target) <= 1,
  );
}

// smokeOf → combatGeometry.ts

/** Bénédiction de Protection (LDB 41 — L13) : si la cible est bénie, l'attaquant doit réussir un
 *  Test de FM Accessible (+20) pour OSER attaquer — joué à la DÉCLARATION ; sur un échec, « ils
 *  doivent choisir une cible ou une Action différente » (rien n'est consommé). */
export function attackWardGate(attacker: Combatant, target: Combatant, rng: RNG = battleRng()): { allowed: boolean; lines: string[] } {
  if (!hasActiveFlag(target, 'attackWardFM')) return { allowed: true, lines: [] };
  const t = rollTest(effectiveChar(attacker, 'force-mentale'), 'accessible', rng);
  if (t.success) {
    return { allowed: true, lines: [tr('cs.shameOvercome', { name: attacker.label, roll: t.roll, target: t.target, foe: target.label })] };
  }
  return {
    allowed: false,
    lines: [
      tr('cf.wardTestFail', { name: attacker.label, roll: t.roll, target: t.target }),
      tr('cs.shameBlocked', { name: attacker.label, foe: target.label }),
    ],
  };
}

// applyZoneCrossings → combatGeometry.ts

/** Surprise au début du combat (LDB 13 l.52-81) : le camp pris en EMBUSCADE (`surprisedSide`) subit UN
 *  Test opposé de Discrétion/Perception (l.77) — la Discrétion la plus FAIBLE des embusqueurs, jetée UNE
 *  fois, contre TOUS les guetteurs. Ce jet unique (`rollFrozenOpposedAttacker`) est le FREEZE partagé par
 *  les deux voies : les guetteurs pilotés par un humain forment UNE bande (étape BATCH `triggeredBatchTest`,
 *  une rangée influençable par guetteur dans la MÊME fenêtre) ; les autres (ennemi embusqué, héros en cadence
 *  auto) passent par l'exécuteur cadence-aware (`runCombatFlow`, jet inline) avec le MÊME freeze en
 *  `opposedFreeze`. L'embusqueur (`sneak`) est le `caster` ; Furtif (LDB 85) est baké en `attackerBonusSL`.
 *  Sur défaite d'un guetteur (branche `fail`) : Vigilance (talent, LDB 10) interpose un Test de Perception
 *  (+0) pour ignorer la Surprise, sinon l'État `Surpris` — la branche est jouée PAR RANGÉE, donc ce second
 *  Test n'est appendu à la cascade que pour le porteur concerné. Appelée APRÈS la pose du `battle` (sujet
 *  HORS-TOUR : Round 1 pas encore commencé) ; à la fermeture de la cascade, `resumeSuspendedAI` est un no-op
 *  (turn -1 = aucun acteur). Les lignes inline partent dans la file différée → drainées ici. */
export function applySurprise(get: Get, set: SetFn, surprisedSide: 'party' | 'enemies'): void {
  const battle = get().battle;
  if (!battle) return;
  const surprisedKind = surprisedSide === 'party' ? 'hero' : 'enemy';
  const surprised = battle.combatants.filter((c) => (surprisedKind === 'hero' ? c.kind === 'hero' : c.kind !== 'hero') && !isOutOfAction(c));
  const ambushers = battle.combatants.filter((c) => (surprisedKind === 'hero' ? c.kind !== 'hero' : c.kind === 'hero') && !isOutOfAction(c));
  if (!surprised.length || !ambushers.length) return;
  // L'embusqueur de référence = la Discrétion la plus FAIBLE du groupe (l.77). Furtif (LDB 85
  // p.339) : « Ajoutez son bonus d'Agilité au DR de tous ses Tests de Discrétion » → attackerBonusSL.
  const sneak = ambushers.reduce((a, b) => (testValue(b, 'discretion') < testValue(a, 'discretion') ? b : a));
  const sneakDR = skillDRBonus(sneak, 'discretion'); // Furtif : +Bonus d'Agilité au DR (donnée : passive skillDRBonus)
  // Conséquence d'une défaite du guetteur : l'État Surpris. Vigilance (talent `vigilance`) interpose AVANT un
  // Test de Perception (+0) cadence-aware — réussite = pas de Surprise, échec = Surpris.
  // `sense` NON posé sur les deux Tests ci-dessous (Surprise ET Vigilance) — DÉCISION, pas un oubli : LDB 13
  // l.53-59 mélange des déclencheurs visuels ET auditifs (dans le noir/sous un épais brouillard = la vue est
  // spécifiquement défaite, l'ouïe reste le dernier recours ; détonations/rixe = indices sonores). Un guetteur
  // Sourd reste donc VULNÉRABLE par défaut (`senseMatches`, trauma.ts : sens du Test inconnu → pénalité
  // appliquée, conservateur) plutôt qu'exempté en bloc — cohérent avec les scénarios d'embuscade cités.
  const surprise: Flow = { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: COND.surpris, value: 1 }] } };
  const onLose: Flow = {
    kind: 'if', cond: { kind: 'has', who: 'target', what: 'talent', value: 'vigilance' },
    then: testFlow({ skill: { id: 'perception' }, difficulty: 'intermediaire', label: 'Vigilance', stake: combatStakeRef('ambushVigilance') }, EMPTY_FLOW, surprise),
    else: surprise,
  };
  // Embusqueur (Discrétion, FIGÉE comme attaquant opposé) vs guetteurs (Perception, les défenseurs qui jettent).
  const difficulty: Difficulty = 'intermediaire';
  const test: FlowTest = {
    skill: { id: 'perception' }, difficulty, label: 'Surprise', stake: combatStakeRef('ambushSurprise'),
    opposed: { attacker: 'agilite', attackerSkill: 'discretion', attackerBonusSL: sneakDR },
  };
  const branches = { onSuccess: EMPTY_FLOW, onFail: onLose }; // le guetteur résiste → pas de Surprise
  // UN SEUL jet d'embusqueur pour toute l'embuscade (l.77) : tiré ici, partagé par la bande et les inlines.
  const aT = rollFrozenOpposedAttacker(sneak, test.opposed!, difficulty);
  // SURFACE (#1262), pas affordance locale : le guetteur d'un AUTRE siège entre dans la bande — c'est SON
  // joueur qui roulera sa rangée. Les deux boucles lisent le MÊME prédicat : décaler l'une perdrait le
  // Test (ni rangée ni inline) ou le doublerait.
  const bande = surprised.filter((c) => surfaceOf(get, c.id));
  const step = bande.length ? frozenOpposedBatchStep(bande, test, branches, EMPTY_FLOW, difficulty, sneak, aT) : undefined;
  if (step) pushCombatStep(set, step);
  for (const c of surprised) {
    if (surfaceOf(get, c.id)) continue; // sa rangée est dans la bande
    runCombatFlow({ mode: 'combat', get, set, target: c, caster: sneak, label: 'Surprise', opposedFreeze: aT }, testFlow(test, branches.onSuccess, branches.onFail));
  }
  // Inline (embusqué ennemi / héros auto) : les lignes partent dans la file différée → on les folde dans le
  // journal de combat. Le héros manuel suspend (cascade) et n'en pousse aucune.
  const drained = drainPendingLog(get, set);
  if (drained.length) set({ battle: { ...get().battle!, log: [...get().battle!.log, ...drained] } });
}

// DIR8_RING / isFlankOrRear → combatGeometry.ts

/** Environnement d'attaque (LdV/couvert/météo/mouvement/tir-mêlée/surnombre/monture) — SOURCE UNIQUE
 *  des modificateurs positionnels/scéniques, partagée par la RÉSOLUTION (`resolveAttack`) ET l'APERÇU
 *  (`previewAttack`), pour que l'aperçu affiche EXACTEMENT ce que le jet appliquera (R4). Pur (lit l'état).
 *  `blocked` = tir sans Ligne de Vue ; `inMelee`/`crowd`/`cm`/`sc` servent à la résolution (tir dévié,
 *  « Tirer dans le tas », dodge météo) — l'aperçu n'utilise que `env`/`blocked`. */
// seesInDark → combatGeometry.ts

/** Météo du JOUR de voyage EN COURS (EDOC 8) portée par le plan de voyage — contexte de « conditions
 *  du jour » COMMUN aux Activités de l'Étape ET au combat qui s'ouvre pendant la journée (embuscade sous
 *  l'orage). `undefined` hors voyage terrestre / règle Étapes éteinte. SOURCE unique de lecture. */
export function activeDayWeather(get: Get): Weather | undefined {
  const plan = get().travelPlan;
  const w = plan?.recap?.days[plan.recap.days.length - 1]?.weather ?? get().pendingRest?.travelDay?.weather;
  return w?.id;
}

/** Estampille la météo du JOUR (`activeDayWeather`) sur CHAQUE combattant à l'ouverture du combat (#341) —
 *  SOURCE de `Combatant.envWeather`, seule entrée du canal « Tests physiques » (`weatherTestMods`, lu par
 *  attack/defenseModifiers/baseTestMods). Un combat hors voyage (pas de météo de jour) laisse le champ vide
 *  (aucune pénalité). No-op si pas de combat. */
export function stampEnvWeatherAtCombatStart(get: Get, set: SetFn): void {
  const battle = get().battle;
  if (!battle) return;
  const w = activeDayWeather(get);
  if (!w) return;
  set({ battle: { ...battle, combatants: battle.combatants.map((c) => (c.envWeather === w ? c : { ...c, envWeather: w })) } });
}

/**
 * Éclairs de la pluie diluvienne (EDOC 8 l.82, #341) : à l'OUVERTURE d'un combat pendant un jour de
 * voyage sous pluie diluvienne (`lightningNervous` en donnée `weather.json`), chaque créature au Trait
 * Nerveux est effrayée UNE fois (une seule ouverture de combat par embuscade). MÊME dispatcher que le coup
 * d'arme à feu (bruits forts, l.1936) : le tonnerre est un bruit fort → `startleCause:'noise'`, donc une
 * monture Dressée (Guerre) est exemptée par la donnée du Trait Nerveux (aucune branche par-nom ici).
 */
export function startleOnStormAtCombatStart(get: Get, set: SetFn): void {
  const battle = get().battle;
  if (!battle) return;
  const dayW = activeDayWeather(get);
  if (!dayW || !weatherLightningNervous(dayW)) return;
  for (const c of battle.combatants) {
    if (!isOutOfAction(c)) emitCombatEvent('onStartled', { get, set, battle, self: c, sink: (line) => battle.log.push(ev('condition', line, c.id)), triggerCtx: { startleCause: 'noise' } });
  }
}

/**
 * Option « Vents Tourbillonnants » (LDB 46 l.179-190) : tirage 1d10 de la force des Vents — à
 * l'OUVERTURE du combat (grain `scene`, défaut), et re-tirable au Round (`state/combat/roundHooks.ts`,
 * grain `round`, « zones de turbulences magiques »). Un héros porteur du Talent Seconde vue tente un
 * Test de Perception Facile (+40, l.181) : succès → force RÉVÉLÉE (HUD) ; sans détection, le
 * modificateur reste appliqué (Vents subis sans être repérés) mais invisible tant qu'il n'a pas été
 * révélé — la modale de jet le montre au moment du jet (breakdown post-jet). Inerte hors combat (le
 * moteur ne modélise le grain « scène » qu'au niveau du combat, cf. grounding #491) et si l'option est
 * 'off' (aucun tirage RNG → golden préservé).
 */
export function rerollWindsOfMagic(get: Get, set: SetFn): void {
  const battle = get().battle;
  if (!battle || rule('vents-tourbillonnants') === 'off') return;
  const { roll, mod } = rollWindsOfMagic(battleRng());
  let revealed = false;
  const lines: { line: string; id: string }[] = [];
  for (const c of battle.combatants) {
    if (c.kind !== 'hero' || isOutOfAction(c) || !hasSecondeVue(c)) continue;
    const res = rollTest(testValue(c, 'perception'), 'facile', battleRng());
    if (res.success) {
      revealed = true;
      lines.push({ line: tr('cs.windsOfMagicSeen', { name: c.label }), id: c.id });
    }
  }
  battle.windsOfMagic = { roll, mod, revealed };
  for (const { line, id } of lines) battle.log.push(ev('info', line, id));
  set({ battle: { ...battle } });
}

/** Tirage d'OUVERTURE de combat des Vents Tourbillonnants (grain `scene`, défaut RAW). */
export function windsOfMagicAtCombatStart(get: Get, set: SetFn): void {
  if (!get().battle) return;
  rerollWindsOfMagic(get, set);
}

/** Une arme tire-t-elle à la POUDRE noire (poudre exposée inutilisable sous la pluie diluvienne, EDOC 8 l.82) ? */
function isBlackPowderWeapon(w: Weapon): boolean {
  const k = weaponGroupKey(w);
  return k === 'poudre' || k === 'ingenierie';
}

/**
 * Le combat VU AVEC l'attaquant à la position qu'il OCCUPERA au moment de frapper.
 *
 * Un geste combiné (Charge, rejoindre-puis-attaquer) s'aperçoit depuis sa case d'ARRIVÉE : les
 * appelants passent un attaquant `{ ...actif, pos: destination }`. Or l'environnement du Test se lit
 * sur `battle.combatants` — Surnombre (`LDB 14 l.110`), Empoignade, occupants de la Ligne de Vue, monture :
 * sans substitution, l'attaquant y reste à sa case de DÉPART et ne se compte pas au contact de sa
 * propre cible, si bien que l'aperçu annonce un palier que le jet contredit (mesuré 2026-08-23,
 * #1411 P2-D : survol « Intermédiaire (+0) », modale « Accessible (+20) »).
 *
 * Substitution PAR ID, à l'identité près : quand l'attaquant EST déjà l'objet du combat, le `battle`
 * repart tel quel (aucune copie, aucun changement de comportement pour les appelants sur place).
 */
export function withAttackerAt(battle: BattleState, attacker: Combatant): BattleState {
  const i = battle.combatants.findIndex((c) => c.id === attacker.id);
  if (i < 0 || battle.combatants[i] === attacker) return battle;
  const combatants = battle.combatants.slice();
  combatants[i] = attacker;
  return { ...battle, combatants };
}

export interface AttackEnv { env: ModLine[]; blocked: boolean; inMelee: boolean; crowd: Combatant[]; cm: ModLine | null; sc: ReturnType<typeof sceneCombatModifiers>; flankRear?: boolean; }
export function attackEnv(
  get: Get,
  attacker: Combatant,
  target: Combatant,
  weapon: Weapon,
  opts?: { intoCrowd?: boolean; heldGround?: boolean },
): AttackEnv {
  const scene = get().scene!;
  // Environnement composé sur le combat où l'attaquant est DÉJÀ à sa case d'attaque (Charge/rejoindre).
  const battle = withAttackerAt(get().battle!, attacker);
  const sc = sceneCombatModifiers(scene, get().gameTime);
  const dayW = activeDayWeather(get);
  const env: ModLine[] = [];
  // Empoignade (LDB 14 l.169) : un attaquant NON partie à l'Empoignade gagne +20 (cible au plus FAIBLE
  // Avantage des deux Empoignés) ou +10 (au plus FORT) pour la toucher — mêlée comme tir.
  const gm = grappleEnvMod(attacker, target, battle.combatants);
  if (gm) env.push(gm);
  if (weapon.type === 'ranged') {
    const occupants = battle.combatants
      .filter((c) => c.id !== attacker.id && c.id !== target.id && !isOutOfAction(c) && c.pos)
      .map((c) => c.pos!);
    // Tir sur une STRUCTURE : on vise sa FACE exposée (la case côté tireur) — sinon l'arête de la structure
    // elle-même coupe la LdV vers la case DERRIÈRE elle (un canon ne « voit pas à travers » la porte qu'il vise).
    const losTo = isStructure(target) ? structureAimCell(attacker.pos!, target) : target.pos!;
    const los = lineOfSightCover(scene, attacker.pos!, losTo, occupants, smokeOf(battle));
    if (los.blocked) return { env, blocked: true, inMelee: false, crowd: [], cm: null, sc }; // pas de LdV (LDB 13 l.114)
    // Météo du JOUR (EDOC 8) : le tir sous l'orage encaisse la pénalité de temps (Pluie -10 l.76,
    // Pluie diluvienne -20 l.82), la poudre EXPOSÉE meurt (l.82), le Blizzard rend le tir impossible
    // (l.127) — MÊME contexte de « conditions du jour » que les Activités de l'Étape.
    if (dayW) {
      if (weatherRangedUseless(dayW)) return { env, blocked: true, inMelee: false, crowd: [], cm: null, sc };
      if (weatherPowderUseless(dayW) && isBlackPowderWeapon(weapon)) return { env, blocked: true, inMelee: false, crowd: [], cm: null, sc };
      const rm = weatherRangedMod(dayW);
      if (rm) env.push({ label: tr('tp.modWeather', { weather: weatherCondition(dayW).label }), value: rm, famille: 'circonstance', ref: weatherRef(dayW) });
    }
    // Commandant d'équipe (AA 13 l.29-35) : un chef de pièce dirigé tire au score de Projectiles de son
    // commandant — re-validé ICI (vivant + à portée de voix) → un delta sur la base du chef (aperçu ET résolution).
    const tcMod = teamCommandMod(attacker, weapon, battle.combatants);
    if (tcMod) env.push(tcMod);
    // Couvert de PONT du défenseur (#248) : un servant à un poste couvert (Sabord/Plat-bord/Murs blindés,
    // MSRC f.66 l.111) reçoit sa classe par le MÊME chemin que le couvert de terrain — le plus protecteur
    // des deux (`DeckCoverClass ⊂ CoverClass`). `crewPosteOf` couvre tout l'équipage (chef ET support).
    const posteCover = crewPosteOf(target.id, battle.combatants)?.poste.cover;
    const cover = posteCover ? couvertLePlusProtecteur(los.cover, posteCover) : los.cover;
    if (cover !== 'none') env.push({ label: tr('cf.coverLabel', { cover }), value: coverModifier(cover), famille: 'circonstance' });
    // Vision nocturne / Infravision (LDB 85) ou Talent Vision nocturne : annule la pénalité d'obscurité.
    if (sc.concealed && !seesInDark(attacker)) env.push({ label: sc.label || 'Obscurité', value: -20, famille: 'circonstance', ref: RULE_REF['cible-dissimulee'] }); // cible dissimulée (LDB 14 l.75)
    else if (sc.attackMod) env.push({ label: sc.label, value: sc.attackMod, famille: 'circonstance' }); // tempête (LDB 14 l.76) / neige (l.82)
    // Tir en bougeant (LDB 14 l.70) : −10 si l'on bouge ET tire au même Round. Le Mouvement étant
    // DÉCOMPOSABLE (on peut bouger APRÈS le tir), un HÉROS qui garde sa mobilité encaisse le −10 par défaut ;
    // il ne l'évite qu'en décidant de tirer IMMOBILE (heldGround → consomme son Mouvement, cf. attackConfirm)
    // — ou s'il NE PEUT PAS bouger (Mouvement effectif 0 : Empêtré/Surpris…), il est immobile d'office.
    // L'IA/ennemi (pas d'option) : −10 seulement s'il a effectivement bougé ce Tour.
    const mobileShot = attacker.kind === 'hero'
      ? (battle.movementUsed > 0 || (mountMovement(battle, attacker) > 0 && !opts?.heldGround))
      : battle.movementUsed > 0;
    if (mobileShot) env.push({ label: 'Tir en bougeant', value: -10, famille: 'circonstance', ref: RULE_REF['tir-en-mouvement'] });
    // Tir dans la mêlée (LDB 14 l.116) : la cible est Engagée avec un allié du tireur. Règle optionnelle
    // « Tir dans un corps à corps » (LDB 14 l.112-116) : si désactivée, pas de −20 NI d'artefact d'aperçu
    // (`inMelee` reste false → pas de tir égaré non plus).
    const inMelee = !!rule('combat-ranged-melee-penalty') && (target.engagedWith ?? []).some((id) => {
      const ally = inBattleId(battle, id);
      return !!ally && ally.kind === attacker.kind;
    });
    if (inMelee && !opts?.intoCrowd) env.push({ label: 'Tir dans la mêlée', value: -20, famille: 'circonstance', ref: RULE_REF['tir-dans-un-combat-au-corps-a-corps'] }); // « Tirer dans le tas » REMPLACE ce −20 par le bonus (l.116)
    env.push(...mountedAttackMods(battle, attacker, target, 'ranged')); // Combat monté : +20 cible plus petite que la monture (LDB 14 l.180)
    // « Tirer dans le tas » (LDB 14 l.106) : bonus +20/+40/+60 selon la taille du groupe serré.
    const crowd = opts?.intoCrowd ? crowdEligible(battle, attacker, target) : [];
    const cm = opts?.intoCrowd ? crowdMod(crowd.length) : null;
    if (cm) env.push(cm);
    return { env, blocked: false, inMelee, crowd, cm, sc };
  }
  // Mêlée : la météo (tempête/neige) pénalise l'attaque ; la neige pénalise aussi l'esquive (dodgeMod).
  if (sc.attackMod) env.push({ label: sc.label, value: sc.attackMod, famille: 'circonstance' });
  // La pénalité météo « Tests physiques » (EDOC 8 l.82) n'est PLUS ajoutée ici : le CANAL UNIQUE
  // `weatherTestMods` (attackModifiers, lu depuis `attacker.envWeather`) la porte pour l'attaque ET la défense
  // ET les activités — jamais recâblée par surface (#341). Seuls les mods météo WEAPON-contextuels restent (tir).
  // Flanc/dos (LDB 14 l.62) : +20 pour attaquer un adversaire ENGAGÉ dans le dos ou sur les côtés —
  // orientation du défenseur AVANT cette attaque (il se retourne vers l'attaquant ENSUITE, applyAttackResult).
  const tFacing = get().facing?.[target.id]; // `facing` peut être absent (état épars / contexte sans orientation)
  const flankRear = !!(tFacing && isEngaged(target) && attacker.pos && target.pos && isFlankOrRear(tFacing, facingToward(target.pos, attacker.pos)));
  if (flankRear) env.push({ label: 'Flanc/dos', value: 20, famille: 'circonstance', ref: RULE_REF['attaque-de-flanc-ou-de-dos'] });
  // En contrebas (Difficultés de Combat) : l'attaquant le PLUS BAS subit −10 (la hauteur ne donne AUCUN
  // bonus « high-ground » — RAW : seul ce malus existe). Comparaison de la hauteur métrique des surfaces.
  if ((target.pos?.h ?? 0) - (attacker.pos?.h ?? 0) > STEP_MAX_M) env.push({ label: 'En contrebas de la cible', value: -10, famille: 'circonstance', ref: RULE_REF['cible-en-contrebas'] });
  // Surnombre (LDB 14 l.110) : attaquants du camp de l'attaquant au contact de la cible (2 → +20, 3+ → +40).
  const onm = outnumberMod(battle.combatants.filter((c) => c.kind === attacker.kind && !isOutOfAction(c) && c.pos && combatDistance(c, target) <= 1).length);
  if (onm) env.push(onm);
  env.push(...mountedAttackMods(battle, attacker, target, 'melee')); // Combat monté : +20 cible < monture / −10 viser le cavalier (LDB 14 l.180/181)
  return { env, blocked: false, inMelee: false, crowd: [], cm: null, sc, flankRear };
}

export function resolveAttack(
  get: Get,
  attacker: Combatant,
  target: Combatant,
  location?: HitLocation,
  fromCharge?: boolean,
  intoCrowd?: boolean,
  heldGround?: boolean,
  weaponUid?: string,
  withhold?: boolean, // « Retenir ses coups » (Aux Armes 07 l.59-61) — déclaré avant le jet, mêlée seule
  harpoonRopeCut?: boolean, // mode de tir « corde séparée » (Lance-harpon, ADE II 02 l.677) — déclaré avant le jet, #476
): { res: AttackResult; weapon: Weapon; victim?: Combatant } | null {
  const battle = get().battle!;
  const mpt = sceneMetresPerTile(get().scene);
  const weapon = firedWeapon(attacker, target, weaponUid, battle.combatants, harpoonRopeCut); // arme choisie + munition + sous-effectif du poste servi
  // Restriction d'armes à distance de la rencontre (#471, `EncounterDef.banRanged`, NADJ 06 l.181) —
  // convergence UNIQUE joueur ET IA (tout tir passe par `resolveAttack`) : refus AVANT le jet, même
  // chemin de refus silencieux que la LdV bloquée ci-dessous (`blocked`). Défaut effectif : `banRangedActive`.
  if (banRangedActive(battle) && weapon.type === 'ranged') return null;
  // Distance de COMBAT PAR L'ARME EFFECTIVEMENT tirée (#BUG-A, suite LDB 14) : géométrie de la MONTURE
  // (cavalier/cible monté — sinon une attaque de charge qui rapproche la MONTURE au contact serait jugée
  // hors d'allonge sur le cavalier 1×1 → `null`, cascade d'attaque ORPHELINE) OU de la COQUE SEULEMENT si
  // `weapon` est la pièce de mêlée servie — jamais pour une arme personnelle (`attackGeomOf`).
  const dist = combatDistance(attackGeomOf(battle, attacker, weapon), combatGeomOf(battle, target));
  if (dist > reachTiles(weapon) && weapon.type === 'melee') return null; // hors de portée de mêlée (Allonge incluse, RAW-3)
  // (Sonné → +1 Avantage à l'attaquant en mêlée, LDB 16 l.125 : DÉJÀ géré par le flux d'attaque existant.)
  const { env, blocked, inMelee, crowd, cm, flankRear } = attackEnv(get, attacker, target, weapon, { intoCrowd, heldGround });
  if (blocked) return null; // pas de Ligne de Vue (mur/décor/fumée) → pas de tir (LDB 13 l.114)
  if (weapon.type === 'ranged') {
    // « Tirer dans le tas » (LDB 14 l.106) : un ennemi AU HASARD est touché ; succès dû au seul bonus = 0 DR.
    if (intoCrowd) {
      const res = resolveRanged(attacker, target, weapon, battleRng(), dist, location, env, undefined, mpt);
      if (res.hit && crowd.length) {
        const victim = crowd[battleRng().int(0, crowd.length - 1)]; // « appliqué au hasard parmi les cibles éligibles »
        const ad = res.attackerDetail!;
        const rescued = res.attackerRoll > ad.target - (cm?.value ?? 0); // aurait échoué sans le bonus → 0 DR (l.146)
        const stray = resolveStrayRangedHit(attacker, victim, weapon, res.attackerRoll, rescued ? res.attackerRoll : ad.target, ad);
        stray.log = tr('cf.strayHit', { name: victim.label, rescued: rescued ? tr('cf.fragRescued') : '' });
        return { res: stray, weapon, victim };
      }
      return { res, weapon };
    }
    // Défense RAW contre le tir (Protectrice 2+ / Bout Portant / tireur Engagé) : un défenseur dont la
    // défense n'est PAS surfacée oppose AUTOMATIQUEMENT sa meilleure défense (la Ligne de Vue est acquise —
    // `blocked` a déjà rendu null). Un défenseur SURFACÉ (`defenseSurfaced` : héros manuel, ennemi conduit
    // par le siège MJ) la joue dans SA fenêtre réactive → pas d'auto-défense ici. Le `kind` ne décide de
    // rien : un héros `aiControlled` n'est pas surfacé et garde donc son repli.
    // La pénalité d'ESQUIVE du contexte (neige épaisse `LDB 14 l.82`, défenseur monté `l.184`) pèse
    // aussi sur la défense CONTRE UN TIR : même source unique que le pré-jet de la rangée adverse.
    const rd = defenseSurfaced(get(), target)
      ? undefined
      : (() => {
        const best = bestRangedDefense(attacker, target, weapon, dist, true, mpt);
        return best && { ...best, dodgeMod: defenseDodgeMod(get, target) };
      })();
    const res = resolveRanged(attacker, target, weapon, battleRng(), dist, location, env, rd, mpt);
    // Tir dans la mêlée (LDB 14 l.116) : si le −20 a transformé une réussite en échec, le tir dévie
    // et frappe un allié intercalé (touche acquise, dégâts recalculés sur l'allié).
    if (inMelee && !res.hit) {
      const ally = strayShotVictim(res, attacker, target, battle);
      if (ally) return { res: resolveStrayRangedHit(attacker, ally, weapon, res.attackerRoll, res.attackerDetail!.target + 20, res.attackerDetail), weapon, victim: ally };
    }
    return { res, weapon };
  }
  // Charge montée (LDB 14 l.183) : pour les DÉGÂTS, on substitue la Force (Bonus) et la Taille de la monture.
  // Combat monté (l.184) : un défenseur à cheval subit −20 à l'Esquive (sauf Acrobaties équestres) → dodgeMod.
  const chargeMount = fromCharge ? mountOf(battle, attacker) : undefined;
  const dmgProxy = chargeMount ? { sb: bonus(effectiveChar(chargeMount, 'force')), size: chargeMount.size } : undefined;
  // Défenseur SURFACÉ (`defenseSurfaced`) : sa défense se joue dans SA fenêtre, jamais ici — on résout le
  // seul jet d'ATTAQUANT (`defense:'none'`) et l'interposition (`openSurfacedDefense`, chemin piloté) ou la
  // fenêtre réactive (`maybeOpenDefense`, chemin IA) opposera le jet de défense au jet figé.
  const surfaced = defenseSurfaced(get(), target);
  return { res: resolveMelee(attacker, target, weapon, battleRng(), { defense: surfaced ? 'none' : bestDefenseMode(target), location, env, dodgeMod: defenseDodgeMod(get, target), dmgProxy, withhold, flankRear }), weapon };
}

/** 2ᵉ attaque du Maniement de deux armes (LDB 10 l.767-773). Jet d'attaquant IMPOSÉ : `reverseRoll(mainRoll)`,
 *  ou `critValue` (valeur du tableau des Critiques) si la 1ʳᵉ frappe était un Critique. Le `target` (valeur à
 *  toucher) inclut déjà la pénalité de main secondaire (l'arme `off` porte `hand:'off'`, cf. plan #1). Le
 *  défenseur fait un NOUVEAU jet de défense (l.638 « opposée à un nouveau lancer de défense »). */
export function resolveDualSecond(
  get: Get,
  attacker: Combatant,
  target: Combatant,
  offWeapon: Weapon,
  mainRoll: number,
  opts?: { critValue?: number; location?: HitLocation },
): AttackResult {
  // Règles d'arme contextuelles de Groupe (LDB 62) AUSSI pour la 2ᵉ frappe : Fléau sans Spé → Dangereuse +
  // aucun Atout, Lance hors Charge → improvisée. Replié AVANT touche/Dégâts (même `weaponContextOf` que
  // `firedWeapon` — source unique du ctx) car `applyAttackResult` fait confiance au `res` pré-calculé.
  offWeapon = effectiveWeapon(offWeapon, weaponContextOf(attacker, offWeapon, target));
  const { env } = attackEnv(get, attacker, target, offWeapon, {});
  const mods = attackModifiers(attacker, target, offWeapon, { kind: 'melee', location: opts?.location, env });
  const valeur = combatValue(attacker, 'melee', offWeapon); // `TestResult.base` : départage du Test opposé (LDB 12 l.160), même grandeur que `rollMeleeAttacker`
  // Cible par le MONTEUR CANONIQUE (#1153) : plafond des Difficultés (LDB 14 l.91-96) puis MÊME
  // écrêtage que `rollTest` — la 2ᵉ frappe vise la cible que le moteur jetterait pour la 1ʳᵉ.
  const toHit = rollLine({
    actor: attacker, difficulty: 'intermediaire', combat: { kind: 'melee', weapon: offWeapon },
    surLaCible: mods, plafond: 'difficultes',
  }).target;
  const atkRoll = opts?.critValue != null ? opts.critValue : reverseRoll(mainRoll);
  const atk = evaluateTest(atkRoll, toHit, valeur);
  // MÊME composition que la cible montée ci-dessus (`mods`, plafond compris) : les deux branches la
  // reçoivent FIGÉE — la 2ᵉ frappe annonce la Difficulté qui a fait sa cible.
  const compo = composeAttack(mods);
  const mode = (cannotDefend(target) || isInanimate(target)) ? 'none' : bestDefenseMode(target); // OBJET INANIMÉ (structure/véhicule/affût) : jamais de défense
  if (mode === 'none') return resolveMeleePassive(attacker, target, offWeapon, atk, opts?.location, env, undefined, false, compo);
  const def = rollMeleeDefender(target, mode, battleRng(), 0, target.weapons[0], offWeapon); // NOUVEAU jet de défense (LDB 10 l.767-773)
  return finishMelee(attacker, target, offWeapon, atk, def, mode, opts?.location, env, 0, undefined, target.weapons[0], false, undefined, compo);
}

/** Cibles VALIDES de la 2ᵉ frappe du Maniement de deux armes (LDB 10 l.767-773 : « un adversaire disponible de
 *  votre choix ») : adversaires encore actifs, à portée de l'arme secondaire (Allonge). Sans position connue
 *  (tests purs) → non filtré sur la distance. */
export function dualStrikeTargets(battle: BattleState, attacker: Combatant, offWeapon: Weapon): Combatant[] {
  return battle.combatants.filter((c) => {
    if (c.kind === attacker.kind || isOutOfAction(c)) return false;
    if (!attacker.pos || !c.pos) return true;
    return combatDistance(attacker, c) <= reachTiles(offWeapon);
  });
}

/** Aperçu d'attaque (R4) : la valeur de toucher (cible du d100) et sa décomposition de modificateurs, SANS
 *  tirer le dé. Rejoue le MÊME `attackEnv` + `attackModifiers` que la résolution → l'aperçu ne ment jamais.
 *  `inRange` = cible atteignable (mêlée : Allonge ; tir : dans une bande de portée) ; `blocked` = tir sans LdV. */
export interface AttackPreview {
  weapon: Weapon; kind: 'melee' | 'ranged'; inRange: boolean; blocked: boolean; target: number; mods: ModLine[];
  /** Difficulté du jet d'attaque, POSÉE À LA SOURCE — LDB 13 l.118 : « Lors d'un Combat, les Difficultés
   *  sont supposées être au niveau Intermédiaire (+0). » L'affichage la rend, il ne la devine pas.
   *  Quand des circonstances en composent un autre palier (`LDB 14 l.91-96`), c'est le monteur —
   *  jamais l'affichage — qui la DÉRIVE, et `difficultyParts` en porte la composition. */
  difficulty: Difficulty;
  /** Modificateur RÉEL des circonstances quand il ne tombe sur AUCUN cran de l'échelle
   *  (`RollLineParts.difficultyCombined`) : présent ⇒ `difficulty` est la DÉCLARÉE, et l'affichage
   *  compose « Combinée (+30) ». DÉRIVÉ par le monteur — aucun site ne le pose. */
  difficultyCombined?: number;
  /** Composition du palier DÉRIVÉ (`RollLineParts.difficultyParts`) : ces lignes ne sont PAS dans
   *  `mods`, le palier les porte. Absente = palier déclaré, tous les modificateurs sont en chips. */
  difficultyParts?: ModLine[];
  /** Valeur de combat NUE (`combatBaseValue`, lignes volatiles de Caractéristique sorties) —
   *  décomposition `target = base + Difficulté + Σ mods` pour l'affichage : la somme des chips est
   *  BRUTE, ce que le palier absorbe (circonstances, plafond) n'y est plus (#1153 L3b). */
  base: number;
  /** ÉCRÊTAGE réellement subi par la cible (`TestResult.clamped`) : la seule donnée qui autorise la
   *  chip « plafond 99 » sur le pré-jet (`PendingRoll.clamped`). Absent = aucun bornage. */
  clamped?: number;
  /** Dégâts d'arme (Force incluse) AVANT le DR du jet. La Blessure réelle = `dmg` + DR − `soak` (plancher 1). */
  dmg: number;
  /** Encaissé par la cible à la localisation visée (Bonus d'Endurance + PA, réduction d'armure des Atouts déduite). */
  soak: number;
}
export function previewAttack(
  get: Get,
  attacker: Combatant,
  target: Combatant,
  location?: HitLocation,
  opts?: { intoCrowd?: boolean; heldGround?: boolean; weaponUid?: string; harpoonRopeCut?: boolean },
): AttackPreview {
  const battle = get().battle;
  const mpt = sceneMetresPerTile(get().scene);
  const weapon = firedWeapon(attacker, target, opts?.weaponUid, battle?.combatants, opts?.harpoonRopeCut);
  const kind: 'melee' | 'ranged' = weapon.type === 'ranged' ? 'ranged' : 'melee';
  // Distance de COMBAT PAR L'ARME EFFECTIVEMENT visée (#BUG-A) : géométrie de la MONTURE pour un
  // cavalier/cible monté (LDB 14 — le reach/la bande de portée se mesurent du couple, pas du cavalier 1×1),
  // ou de la COQUE SEULEMENT si `weapon` est la pièce de mêlée servie (`attackGeomOf`) — jamais pour une
  // arme personnelle. L'aperçu DOIT rejouer EXACTEMENT la même géométrie que `attackPlan`/la résolution.
  const dist = battle
    ? combatDistance(attackGeomOf(battle, attacker, weapon), combatGeomOf(battle, target))
    : combatDistance(attacker, target);
  // Estimation de dégâts (R4) : dégâts d'arme (Force incluse) et encaissé de la cible. Le `soak` est dérivé
  // de `woundsFromHit` (oracle) avec un dégât large → capture exactement PA + réduction d'armure (Perforante…).
  const dmg = effectiveWeaponDamage(weapon, bonus(effectiveChar(attacker, 'force')));
  const base = combatValue(attacker, kind, weapon);
  const loc = location ?? 'corps';
  const soak = (dmg + 20) - woundsFromHit(weapon, target, loc, dmg + 20, 0, 1, attacker.size);
  if (kind === 'melee' && dist > reachTiles(weapon)) return { weapon, kind, inRange: false, blocked: false, target: 0, base, mods: [], dmg, soak, difficulty: 'intermediaire' };
  const { env, blocked } = attackEnv(get, attacker, target, weapon, opts);
  if (blocked) return { weapon, kind, inRange: true, blocked: true, target: 0, base, mods: [], dmg, soak, difficulty: 'intermediaire' };
  const distanceTiles = kind === 'ranged' ? dist : undefined;
  const mods = attackModifiers(attacker, target, weapon, { kind, location, distanceTiles, env, metresPerTile: mpt });
  const rangeM = effectiveWeaponRange(weapon, loadedAmmo(attacker, weapon)?.ammoRangeMod, () => bonus(effectiveChar(attacker, 'force'))); // Portée résolue (jet `{bf}` → BF×N) + modificateur de la munition sélectionnée ; null = hors bande
  const inRange = kind === 'ranged' ? (rangeM != null && rangeBandModifier(dist, rangeM, mpt) != null) : dist <= reachTiles(weapon);
  // Ligne montée par le MONTEUR CANONIQUE (#1153) : base de combat NUE, composantes fondues dans la
  // valeur (lignes volatiles de Caractéristique — issue #202 — et mods de Test char-qualifiés) en
  // chips, PALIER composé par les circonstances (LDB 14 l.91-96) et MÊME écrêtage que le jet
  // (`clampTarget`). La Difficulté RENDUE est celle du monteur, jamais celle déclarée à l'entrée.
  const line = rollLine({
    actor: attacker, difficulty: 'intermediaire', combat: { kind, weapon },
    surLaCible: mods, plafond: 'difficultes',
  });
  return {
    weapon, kind, inRange, blocked: false,
    target: line.target, base: line.base, mods: line.mods,
    ...(line.clamped ? { clamped: line.clamped } : {}),
    dmg, soak, difficulty: line.difficulty,
    ...(line.difficultyCombined != null ? { difficultyCombined: line.difficultyCombined } : {}),
    ...(line.difficultyParts ? { difficultyParts: line.difficultyParts } : {}),
  };
}

/** La Difficulté d'une attaque APERÇUE, telle que la modale du jet la dira — la DONNÉE (cran de
 *  l'échelle + modificateur combiné quand la composition ne tombe sur aucun cran), que l'affichage met
 *  en mots par l'unique `ui/difficultyText`. `undefined` sur un aperçu sans cible atteignable (hors
 *  portée / LdV coupée), où `previewAttack` ne compose aucune Difficulté. SOURCE UNIQUE de la question
 *  « que dira le jet de ce geste ? » : réticule au survol comme badge de l'aperçu tap-1. PUR. */
export function difficultyOf(p: AttackPreview): DifficultyShown | undefined {
  if (p.blocked || !p.inRange) return undefined;
  return { difficulty: p.difficulty, ...(p.difficultyCombined != null ? { difficultyCombined: p.difficultyCombined } : {}) };
}

/** Pénalité d'ESQUIVE que le contexte impose au défenseur — SOURCE UNIQUE du jet résolu (`attackAt`
 *  → `resolveMelee({ dodgeMod })`) et du pré-jet (`previewDefense`) : météo de la scène (neige
 *  épaisse, `LDB 14 l.82`) + défenseur monté (`LDB 14 l.184`). Deux lecteurs, un calcul — sinon la
 *  rangée adverse annonce une Difficulté que le jet contredit (#1153 L4). */
export function defenseDodgeMod(get: Get, defender: Combatant): number {
  const scene = get().scene;
  return (scene ? sceneCombatModifiers(scene, get().gameTime).dodgeMod : 0) + mountedDodgePenalty(defender);
}
/** Ligne ADVERSE du panneau de jet pré-rempli (modale d'attaque) : ce que le joueur est en droit
 *  de savoir de la défense à venir — la compétence probable (« Parade » / « Esquive ») et ses
 *  bonus/malus visibles (Avantage, États, Sur la défensive…), SANS la valeur de compétence ni
 *  l'encaissé. Compétence = meilleure défense (`bestDefenseMode`) par défaut ; Bestial → Esquive
 *  seule. `forcee` : la défense que le contexte IMPOSE (tir défendu, `bestRangedDefense` — LDB 13 l.135),
 *  `dodgeMod` la pénalité d'esquive du contexte (neige épaisse, monté) — celle-là même que la
 *  résolution passera au jet.
 *
 *  Montée par le MONTEUR CANONIQUE en mode plafonné, comme l'attaque, sur les modificateurs QUI FONT
 *  LA CIBLE du jet de défense (`defenseTargetMods` — source unique partagée avec `rollMeleeDefender`
 *  et la ligne résolue). La valeur est celle du moteur (`defenseValue`) et n'est pas un Niveau de
 *  Compétence — la rangée la masque de toute façon. */
export function previewDefense(
  defender: Combatant,
  ctx?: { mode?: 'parade' | 'esquive'; parryWeapon?: Weapon; vsWeapon?: Weapon; dodgeMod?: number },
): { label: string; mods: ModLine[]; difficulty: Difficulty; difficultyCombined?: number; difficultyParts?: ModLine[] } {
  const mode = ctx?.mode ?? bestDefenseMode(defender);
  const arme = ctx && 'parryWeapon' in ctx ? ctx.parryWeapon : defender.weapons[0];
  const line = rollLine({
    difficulty: 'intermediaire', // LDB 13 l.118
    valeur: defenseValue(defender, mode, arme), valeurEtrangere: true,
    surLaCible: defenseTargetMods(defender, mode, ctx?.dodgeMod ?? 0, arme, ctx?.vsWeapon), plafond: 'difficultes',
  });
  return {
    label: DEFENSE_LABEL[mode], mods: line.mods, difficulty: line.difficulty,
    ...(line.difficultyCombined != null ? { difficultyCombined: line.difficultyCombined } : {}),
    ...(line.difficultyParts ? { difficultyParts: line.difficultyParts } : {}),
  };
}

/** Pré-jet d'INCANTATION pour le panneau de jet (même rôle que previewAttack/previewDefense) : valeur
 *  du Test = compétence nue + Avantage (LDB 46 l.123-125) / Contrecoup actif en chips = cible. La CastModal
 *  ne fait que poser cette ligne `pending` dans le RollPanel partagé (pas de calcul inline). */
export function previewCast(
  caster: Combatant,
  spell: NonNullable<ReturnType<typeof findSpell>>,
  opts?: {
    missile?: boolean; focused?: boolean;
    /** Vents Tourbillonnants (LDB 46 l.179-190) : n'entre dans l'APERÇU pré-jet que si RÉVÉLÉS
     *  (Seconde vue) — sinon on subit les Vents sans les avoir repérés (le mod reste appliqué au
     *  jet, cf. `castRoll`/`resolveCasting`, mais n'apparaît qu'au breakdown POST-jet). */
    winds?: { roll: number; mod: number } | null;
    /** CONTEXTE du jet (état + cible visée) : l'aperçu annonce alors la CIBLE RÉELLE — protection de
     *  la victime, attribut et environnement de Domaine (`castContextMods`) compris. Absent (aucune
     *  cible désignée) : aperçu de la seule valeur du lanceur. */
    ctx?: { s: GameState; target: Combatant; skipWard?: boolean };
  },
): { label: string; base: number; target: number; mods: ModLine[] } {
  const ci = castInfo(spell);
  const target = castingValue(caster, ci.skill, ci.spec);
  const advMod = 10 * (caster.advantage ?? 0); // l'Avantage s'applique aux Tests d'Incantation
  const penMod = castPenaltyMod(caster, ci.skill); // contrecoups actifs (Imparfaite/Colère)
  const windsLine = windsModLine(opts?.winds);
  const windsMod = opts?.winds?.mod ?? 0;
  const isPrayer = !ci.requireNI; // la branche de résolution, pas un proxy sur `cn`
  const ni = opts?.focused ? 0 : spell.cn ?? 0;
  const ctx = opts?.ctx ? castContextMods(opts.ctx.s, caster, opts.ctx.target, spell, { skipWard: opts.ctx.skipWard }) : null;
  const mods: ModLine[] = [
    ...(advMod ? [{ label: 'Avantage', value: advMod, famille: 'jet' as const, ref: RULE_REF.avantage }] : []),
    ...(penMod ? [{ label: 'Contrecoup', value: penMod, famille: 'jet' as const }] : []),
    ...(ctx?.mods ?? []),
    ...(windsLine ? [windsLine] : []),
  ];
  return {
    label: isPrayer ? tr('cf.prayerLabel') : tr('cf.castLabel', { ni }), // le test reste Langue (Magick) — « Projectile magique » ne change QUE Localisation/Dégâts après réussite (LDB 46 l.155-156)
    base: castingBaseValue(caster, ci.skill, ci.spec),
    target: target + windsMod + (ctx?.total ?? 0),
    mods,
  };
}

/** Delta de RESSOURCES de l'aperçu de clic (tap 1, `battle.preview`) — pour le retour « clignotant »
 *  des gouttières de l'arche : ce qu'une opération en attente va COÛTER (Action / Mouvement en cases) et
 *  RAPPORTER (Avantage) AVANT le commit du 2ᵉ clic. Tout à 0 si aucun aperçu en cours. */
export function previewResourceDelta(battle: BattleState | null): { action: number; move: number; adv: number } {
  const p = battle?.preview;
  if (!p) return { action: 0, move: 0, adv: 0 };
  // AUCUNE valeur de coût/gain n'est codée ici (anti-duplication — Action comme Mouvement comme Avantage) :
  //  - Mouvement : lu sur `p.cost`, le MÊME coût que le commit consomme (`movementUsed += cost`) ;
  //                la CHARGE est une manœuvre PLEINE → tout le Mouvement (mountMovement, comme le commit).
  //  - Avantage  : lu sur `p.adv`, SOURCE UNIQUE `chargeAdvantage()` partagée par preview / commit / IA.
  //  - Action    : DÉRIVÉE de la structure — viser un ennemi (`targetId`) = attaque, et la COURSE
  //                consomme aussi l'Action (LDB 15 l.41 — le commit passe par pendingRun).
  const action = 'targetId' in p || p.kind === 'run' ? 1 : 0;
  const active = battle?.combatants ? activeCombatant(battle) : undefined; // (les tests passent des battles minces)
  const move = p.kind === 'move' || p.kind === 'run' || p.kind === 'moveAttack'
    ? p.cost
    : p.kind === 'charge' && battle && active ? mountMovement(battle, active) : 0;
  const adv = p.kind === 'charge' ? p.adv : 0;
  return { action, move, adv };
}

/** Cibles VALIDES de l'attaque du héros actif (R4) : ennemis en vie atteignables (mêlée à l'Allonge / tir
 *  dans une bande de portée AVEC Ligne de Vue) — MÊMES prédicats que la résolution (via `previewAttack`),
 *  pour surligner les cibles cliquables et griser les inéligibles. Pur. Vide hors tour de héros. */
/** L'actif s'il est un héros-ATTAQUANT (arme à brandir + position) — précondition PARTAGÉE des calculs
 *  d'éligibilité de cible. Un navire-coque (sans arme) renvoie null : il agit en UNITÉ (Tests d'équipage), il
 *  n'attaque pas au fusil/à l'épée → `previewAttack` n'est pas appelé sur lui (et planterait faute d'arme). */
function activeHeroAttacker(get: Get): Combatant | null {
  const battle = get().battle;
  if (!battle) return null;
  const active = activeCombatant(battle);
  return active && controlsCombatant(get(), active) && !!active.pos && active.weapons.length > 0 ? active : null;
}

export function eligibleAttackTargetIds(get: Get): Set<string> {
  const battle = get().battle;
  const ids = new Set<string>();
  if (!battle) return ids;
  const active = activeHeroAttacker(get);
  if (!active) return ids;
  for (const c of battle.combatants) {
    if (c.kind === active.kind || isOutOfAction(c) || !c.pos) continue; // camp RELATIF (l'actif conduit peut être un ennemi)
    const p = previewAttack(get, active, c);
    if (p.inRange && !p.blocked) ids.add(c.id);
  }
  return ids;
}

/** Ennemis SANS Ligne de Vue depuis le héros actif (LDB 13 l.114 — le tir est impossible) :
 *  l'UI les GRISE pour distinguer « hors LdV » de « hors de portée » (pas d'anneau dans les
 *  deux cas). Même vérité que l'attaque réelle (`previewAttack.blocked`, arme à distance
 *  seulement — la mêlée n'est jamais bloquée par la LdV). */
export function outOfSightTargetIds(get: Get): Set<string> {
  const battle = get().battle;
  const ids = new Set<string>();
  if (!battle) return ids;
  const active = activeHeroAttacker(get); // navire-coque (sans arme) → aucune cible « hors de vue » à griser
  if (!active) return ids;
  for (const c of battle.combatants) {
    if (c.kind === active.kind || isOutOfAction(c) || !c.pos) continue; // camp RELATIF
    if (previewAttack(get, active, c).blocked) ids.add(c.id);
  }
  return ids;
}

/** Ligne de Vue d'un SORT (LDB 46 l.121 : « sauf indication contraire, vous devez toujours être
 *  capable de voir – par exemple, avoir en Ligne de vue – votre cible ») : BINAIRE — un Sort n'est
 *  pas un tir, aucune règle ne lui applique de malus de couvert → seul `.blocked` compte.
 *  Occupants ignorés (une créature ne bloque pas la vue, elle ne donne que du couvert — hors sorts). */
export function castSightBlocked(get: Get, from: Pt, to: Pt): boolean {
  const { scene, battle } = get();
  if (!scene) return false;
  return !losClear(scene, from, to, battle ? smokeOf(battle) : []);
}

/** Aperçu de DÉPLACEMENT vers `pt` (Marche ou Course) au SURVOL — composé des MÊMES sources que
 *  le clic-sol (`displayedReach`/`computeRunReach`/`pathTo`, géométrie de la monture incluse) :
 *  l'aperçu ne ment pas. Les gates de COMMIT (Peur à l'approche, Frénésie) restent au clic,
 *  comme pour le tap-1 tactile. null = case non atteignable / pas en mode neutre. */
export type MovementBlockReason =
  | 'no-battle'
  | 'no-scene'
  | 'combat-over'
  | 'targeting'
  | 'no-active'
  | 'not-controlled'
  | 'engaged'
  | 'movement-spent'
  | 'out-of-range'
  | 'no-path';

export type MovementResolution =
  | { status: 'ok'; kind: 'move' | 'run'; path: Pt[]; cost: number }
  | { status: 'blocked'; reason: MovementBlockReason };

export function resolveMovement(get: Get, pt: Pt): MovementResolution {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle) return { status: 'blocked', reason: 'no-battle' };
  if (!scene) return { status: 'blocked', reason: 'no-scene' };
  if (battle.over) return { status: 'blocked', reason: 'combat-over' };
  if (battle.action !== null) return { status: 'blocked', reason: 'targeting' };
  const active = activeCombatant(battle);
  if (!active?.pos) return { status: 'blocked', reason: 'no-active' };
  if (!controlsCombatant(get(), active)) return { status: 'blocked', reason: 'not-controlled' };
  if (isEngaged(active)) return { status: 'blocked', reason: 'engaged' };
  if (!canMove(battle, active)) return { status: 'blocked', reason: 'movement-spent' };
  const k = tileKey(pt.x, pt.y, pt.z ?? 0); // z-aware : une case de rempart (z1) ne matche plus la clé « x,y » du sol
  const reach = displayedReach(get);
  const inWalk = reach.has(k);
  const runReach = inWalk ? null : computeRunReach(get);
  if (!inWalk && !runReach?.has(k)) return { status: 'blocked', reason: 'out-of-range' };
  const preview = battle.preview;
  if ((preview?.kind === 'move' || preview?.kind === 'run')
    && preview.tile.x === pt.x && preview.tile.y === pt.y && (preview.tile.z ?? 0) === (pt.z ?? 0)) {
    return { status: 'ok', kind: preview.kind, path: preview.path, cost: preview.cost };
  }
  const geom = mountOf(battle, active) ?? active;
  const path = pathTo(scene, active.pos, pt, moveEnv(battle, geom));
  if (!path || path.length < 2) return { status: 'blocked', reason: 'no-path' };
  return { status: 'ok', kind: inWalk ? 'move' : 'run', path, cost: (inWalk ? reach.get(k) : runReach!.get(k)) ?? 0 };
}

export function movePreviewAt(get: Get, pt: Pt): { kind: 'move' | 'run'; path: Pt[]; cost: number } | null {
  const resolution = resolveMovement(get, pt);
  return resolution.status === 'ok'
    ? { kind: resolution.kind, path: resolution.path, cost: resolution.cost }
    : null;
}

/** Ennemis SANS Ligne de Vue depuis le héros actif pour un SORT (LDB 46 l.121) — même grisage
 *  que le tir, mais indépendant de l'arme portée (mode incantation). */
export function castOutOfSightTargetIds(get: Get): Set<string> {
  const battle = get().battle;
  const ids = new Set<string>();
  if (!battle) return ids;
  const active = activeCombatant(battle);
  if (!active || !controlsCombatant(get(), active) || !active.pos) return ids;
  for (const c of battle.combatants) {
    if (c.kind === active.kind || isOutOfAction(c) || !c.pos) continue; // camp RELATIF
    if (castSightBlocked(get, active.pos, c.pos)) ids.add(c.id);
  }
  return ids;
}

/** Applique un résultat d'attaque déjà résolu : Blessures, États, Assommante,
 *  Avantage, animation, journal, fin de combat. */
/** Issue du Test opposé d'Esquive du Désengagement : le mover est l'« attaquant » du test ;
 *  une égalité parfaite (tie) = statu quo (ni fuite, ni avantage à l'adversaire — LDB Tests). */
export function disengageOutcome(winner: 'attacker' | 'defender' | 'tie'): 'success' | 'failure' | 'tie' {
  return winner === 'attacker' ? 'success' : winner === 'tie' ? 'tie' : 'failure';
}

/** Lance le Désengagement d'un combattant Engagé (LDB 15 l.43-49) : option A
 *  (Avantage > adversaires → résolue direct) ou option B (Test opposé d'Esquive vs le
 *  foe le plus dangereux). No-op « rouvre le mouvement » si plus aucun foe vivant. */
export function startDisengage(get: Get, set: SetFn, mover: Combatant): void {
  const battle = get().battle!;
  const foes = (mover.engagedWith ?? [])
    .map((id) => inBattleId(battle, id))
    .filter((c): c is Combatant => !!c && !isOutOfAction(c));
  // Désengagement GRATUIT du plus grand (LDB 85 l.373-374) : une créature plus grande que TOUS ses
  // adversaires Engagés les écarte et se déplace librement, sans Test ni sacrifice d'Avantage.
  // Plus grand que TOUS ses Engagés (85 l.373-374) OU Nuée (ignore l'Engagement en se déplaçant, LDB 85 l.253) → départ libre.
  const freeDisengage = foes.length > 0 && (mover.swarm || foes.every((f) => sizeGap(mover.size, f.size) >= 1));
  if (!foes.length || freeDisengage) {
    if (freeDisengage) {
      for (const f of foes) disengageFrom(mover, f); // lève les liens Engagé avec les plus petits écartés
      battle.log.push(ev('move', tr('cf.pushThrough', { name: mover.label }), mover.id));
    }
    // Lien d'Engagement périmé (foe mort/parti) OU désengagement gratuit : rouvrir le déplacement normal.
    set({ battle: { ...battle, action: null, reachable: moveReachFor(mover, get().scene!, mover.pos!, effectiveMovement(mover), moveEnv(battle, mover)) } });
    return;
  }
  // Option A du menu de Désengagement : « Sacrifier l'Avantage » (LDB 15 l.47, Avantage STRICTEMENT
  // supérieur → tombe à 0) OU, en mode « Avantage de groupe », « Retraite stratégique » (AA 11 l.37 : dépense
  // FIXE de 2 Avantages de la réserve du camp, abaissée à 1 par Impitoyable AA 13 l.74). Un seul chemin d'UI.
  const maxFoeAdv = Math.max(...foes.map((f) => f.advantage));
  // Impitoyable (LDB 10 l.591) : peut Sacrifier l'Avantage même sans supériorité stricte (mais il faut au
  // moins 1 Avantage à dépenser). En mode groupe : Retraite stratégique = dépense FIXE de la réserve du camp.
  const canSacrifice = groupAdvantage()
    ? spendableAdvantage(get, mover) >= retreatAdvantageCost(mover)
    : canDisengageWithLessAdvantage(mover)
      ? mover.advantage > 0
      : mover.advantage > maxFoeAdv; // Avantage strictement supérieur (l.87)
  // Après avoir agi, seule l'option A (Sacrifier l'Avantage) reste possible — sans Avantage supérieur
  // il n'y a RIEN à faire → no-op (pas de menu vide, et pas de relance d'Esquive : anti-boucle l.89).
  if (battle.acted && !canSacrifice) return;
  // Ouvre le MENU de choix. L'adversaire de référence (Esquive opposée + cible de la Fuite) =
  // le foe Engagé à la meilleure Compétence de Corps à corps (l.89). Son jet de CC est figé d'avance.
  const foe = foes.reduce((a, b) => (combatValue(b, 'melee') > combatValue(a, 'melee') ? b : a));
  const atk = rollDisengageAttack(foe, battleRng());
  set({
    pendingDisengage: {
      moverId: mover.id,
      foeId: foe.id,
      canSacrifice,
      canEsquive: !battle.acted, // Esquive/Fuite coûtent l'Action — indispo si déjà agi (anti-boucle)
      phase: 'choice',
      atk,
      def: null,
      result: null,
    },
  });
  // « Une situation = une modale » : le Désengagement est hôté dans la cascade (rendu par CascadeModal
  // via l'étape `jet:'disengage'`). `pendingDisengage` reste le porteur de données/phases ; les
  // résolveurs ferment LES DEUX. La ligne d'attaque figée du foe et les portraits restent inchangés.
  const step = hostStep(get, { id: 'disengage', kind: 'disengageStep', jet: 'disengage', actorId: mover.id });
  if (step) openSequence(get, set, { title: 'Se désengager', icon: '↩', purpose: 'combat', steps: [step] });
}

/**
 * COMPLÉTION de la Fuite (LDB 15 l.66-68), APRÈS que le coup gratuit soit résolu : États Brisés d'un
 * Test de Calme raté, puis libération de TOUS les Engagements et budget de Course dans la direction
 * opposée à l'adversaire (« Une fois que ce coup gratuit est résolu, vous pouvez vous déplacer jusqu'à
 * la limite de votre Mouvement de Course […] dans la direction opposée à celle de votre adversaire »).
 * SOURCE UNIQUE des deux chemins : application directe (`fleeConfirm`) et reprise APRÈS une étape de
 * Déviation Critique (applier `fleeMove` ci-dessous) — le Mouvement se calcule donc toujours sur l'état
 * du fuyard APRÈS le coup (une Blessure critique à la jambe le ralentit).
 */
export function completeFlee(get: Get, set: SetFn, moverId: string, foeId: string, broken: number): void {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene) return;
  const mover = inBattleId(battle, moverId);
  const foe = inBattleId(battle, foeId);
  if (!mover || !foe) return;
  const log = [...battle.log];
  if (broken > 0) {
    addCondition(mover, COND.brise, broken);
    log.push(ev('fear', tr('cs.panic', { name: mover.label, broken }), mover.id));
  }
  const foes = (mover.engagedWith ?? []).map((id) => inBattleId(battle, id)).filter((c): c is Combatant => !!c);
  for (const f of foes) disengageFrom(mover, f);
  // Fuite ! (LDB 10) : Mouvement +1 quand on fuit ; Course = 2× Mouvement (l.68).
  const reach = mover.pos && foe.pos
    ? fleeReachable(scene, mover.pos, foe.pos, (effectiveMovement(mover) + fleeMovementBonus(mover)) * 2, moveEnv(battle, mover))
    : new Map<string, number>();
  set({ battle: { ...battle, action: null, reachable: reach, log } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
}

/** Étape de reprise « fuite » : la Déviation Critique du coup dans le dos a SUSPENDU l'application ; une
 *  fois le Critique tranché (Dévier/Subir), la fuite se complète ICI — jamais avant (LDB 15 l.68). */
registerCascadeApplier('fleeMove', (get, set, step) => {
  const f = step.fleeMove;
  if (f) completeFlee(get, set, f.moverId, f.foeId, f.broken);
});

/** Lance l'action « Au Contact » d'un héros Engagé en mêlée (LDB 62 l.176, Option « Longueur d'arme »,
 *  règle `combat-weapon-reach`) : Test opposé de Corps à corps `mover` vs `foe`. Le jet du foe est tiré et
 *  FIGÉ d'avance (pattern Désengagement/Défense — montré dans la ligne adverse de la modale) ; le mover
 *  jouera SON jet influençable, et le VAINQUEUR choisira « combat normal » ou « au contact ». */
export function startAuContact(_get: Get, set: SetFn, mover: Combatant, foe: Combatant): void {
  const atk = rollDisengageAttack(foe, battleRng()); // Corps à corps du foe, figé (jamais relancé)
  set({ pendingAuContact: { moverId: mover.id, foeId: foe.id, phase: 'roll', atk, def: null, result: null } });
}

/** Ouvre l'action d'Empoignade d'un combattant à son tour (LDB 14 l.161). Test opposé de FORCE `actor`
 *  vs `foe` ; le jet du foe est tiré et FIGÉ d'avance (pattern Désengagement/Au Contact). `canBreak` =
 *  l'acteur a un Avantage STRICTEMENT supérieur → il peut BRISER l'Empoignade gratuitement, ou tenter le
 *  Test opposé pour son Action (Dégâts / Empêtré). Le VAINQUEUR du Test choisit. */
/** Ancrage de regle des effets d'Empoignade (LDB 14 l.159-161) — entree `empoignade` de `regles.json`. */
const GRAPPLE_SOURCE = { kind: 'rule', id: 'empoignade' } as const;

export function startGrapple(_get: Get, set: SetFn, actor: Combatant, foe: Combatant): void {
  const atk = rollGrappleForce(foe, battleRng()); // Force du foe, figée (jamais relancée)
  const canBreak = actor.advantage > foe.advantage;
  set({ pendingGrapple: { actorId: actor.id, foeId: foe.id, phase: 'roll', canBreak, atk, def: null, result: null } });
}

/** Cœur PARTAGÉ (flux joueur ET résolveur IA) d'une victoire d'Empoignade (LDB 14 l.161) : applique
 *  `GRAPPLE.win[mode]` (DONNÉE) — `free` se libère SOI-MÊME, `damage`/`entangle` frappent l'adversaire — et
 *  renvoie la ligne de journal. `dr` = DR du Test gagné (→ `ctx.sl`) ; `forceRoll` = jet de Force du VAINQUEUR
 *  (Localisation au lancer de Force, l.161). MUTE actor/foe ; ne touche NI `battle` NI `pending` (chaque
 *  appelant fait son propre `set`) → une SEULE application, deux orchestrations (modale joueur / instantané IA). */
export function resolveGrappleWin(actor: Combatant, foe: Combatant, mode: 'damage' | 'entangle' | 'free', dr: number, forceRoll: number): string {
  const beforeW = foe.wounds.current;
  const beforeEmp = stacks(actor, COND.empetre);
  applyOps(mode === 'free' ? actor : foe, GRAPPLE.win[mode], { caster: actor, sl: dr, source: GRAPPLE_SOURCE });
  if (mode === 'damage') {
    const loc = locationLabel(hitLocationByShape(reverseRoll(forceRoll), foe.bodyShape), foe.bodyShape); // Localisation au lancer de Force (l.161)
    return tr('cs.grappleDamage', { name: actor.label, foe: foe.label, n: beforeW - foe.wounds.current, loc });
  }
  if (mode === 'entangle') return tr('cs.grappleEntangle', { name: actor.label, foe: foe.label });
  return tr('cs.grappleFree', { name: actor.label, n: beforeEmp - stacks(actor, COND.empetre) });
}

/** Résolution PARTAGÉE d'un Test opposé de FORCE d'Empoignade par l'IA (LDB 14 l.161) : `actor` (« attaquant »)
 *  vs `foe`, jets de Force FIGÉS (jamais relancés). Sur succès → option Dégâts (BF+DR, PA ignorés ; Localisation
 *  au lancer de Force, via `resolveGrappleWin`) ; sur échec → `foe` gagne +1 Avantage ; égalité → rien. Renvoie
 *  la ligne de journal. MUTE actor/foe ; ne touche NI `battle` NI `pending` (l'appelant orchestre — Action
 *  verrouillée vs Attaque gratuite de tentacule/langue). SOURCE UNIQUE de l'issue opposée IA. */
export function resolveGrappleOpposed(get: Get, actor: Combatant, foe: Combatant): string {
  const actorRoll = rollGrappleForce(actor, battleRng());
  const foeRoll = rollGrappleForce(foe, battleRng());
  const opp = resolveOpposed(actorRoll, foeRoll);
  const result = disengageOutcome(opp.winner);
  if (result === 'success') return resolveGrappleWin(actor, foe, 'damage', Math.max(0, opp.netSL), actorRoll.roll);
  if (result === 'failure') campGain(get, foe, 1); // l'adversaire l'emporte → +1 Avantage (l.161) — réserve du camp en mode groupe (AA 11 l.11-13)
  return tr(result === 'failure' ? 'cs.grappleLose' : 'cs.grappleTie', { name: actor.label, foe: foe.label });
}

/** Case ATTEIGNABLE adjacente à `target` qui coûte le moins de Mouvement (point d'arrivée d'une Charge). */
export function bestAdjacentReachable(reach: Map<string, number>, target: Pt, targetN = 1, moverN = 1): Pt | null {
  let best: Pt | null = null;
  let bestD = Infinity;
  for (const k of reach.keys()) {
    const [x, y] = k.split(',').map(Number);
    // Adjacent à l'EMPREINTE de la cible (toute case du bloc N×N, pas seulement l'ancre) → un grand (créature,
    // navire) s'attaque depuis N'IMPORTE quel côté. `footprintChebyshev` coïncide avec `chebyshev` pour deux 1×1.
    if (footprintChebyshev({ x, y }, moverN, target, targetN) !== 1) continue;
    const d = reach.get(k)!;
    if (d < bestD) {
      bestD = d;
      best = { x, y };
    }
  }
  return best;
}

/** Cases de Mouvement LIBRE cliquables MAINTENANT (héros actif, mode neutre) : Marche restante
 *  (mouvement décomposable), géométrie de la monture, règle M-A-M, filtre Brisé. Vide si Engagé
 *  (le déplacement passe par le Désengagement — LDB 15 l.45). Source unique pour l'affichage ET la
 *  validation des clics de déplacement. */
export function computeMoveReach(get: Get): Map<string, number> {
  const { battle, scene } = get();
  if (!battle || !scene || battle.over) return new Map();
  const active = activeCombatant(battle);
  if (!active || !controlsCombatant(get(), active) || !active.pos) return new Map();
  if (isEngaged(active) || !canMove(battle, active)) return new Map();
  const geom = mountOf(battle, active) ?? active;
  const reach = moveReachFor(geom, scene, active.pos, movementRemaining(battle, active), moveEnv(battle, geom));
  return briseFleeFilter(scene, battle, active, reach);
}

/** Brisé (LDB 16 l.52) : « se déplacer jusqu'à se retrouver à l'abri, HORS DE VUE de l'ennemi ». Si des
 *  cases atteignables BRISENT la Ligne de Vue de tout adversaire (`tileSeenByFoe` faux), on s'y limite
 *  (gagner une cachette prime) ; sinon, à défaut de cachette, fuir = ne pas se rapprocher (distance). */
function briseFleeFilter(scene: Scene, battle: BattleState, active: Combatant, reach: Map<string, number>): Map<string, number> {
  if (!hasCondition(active, COND.brise)) return reach;
  const foes = battle.combatants.filter((c) => c.kind !== active.kind && !isOutOfAction(c) && c.pos);
  if (!foes.length) return reach;
  const smoke = smokeOf(battle);
  const hiddenTiles = new Map([...reach].filter(([k]) => {
    const [x, y] = k.split(',').map(Number);
    return !tileSeenByFoe(scene, foes, { x, y }, smoke);
  }));
  if (hiddenTiles.size) return hiddenTiles; // une cachette atteignable → s'y mettre à l'abri (RAW)
  const distNow = Math.min(...foes.map((e) => chebyshev(active.pos!, e.pos!)));
  return new Map([...reach].filter(([k]) => {
    const [x, y] = k.split(',').map(Number);
    return Math.min(...foes.map((e) => chebyshev({ x, y }, e.pos!))) >= distNow;
  }));
}

/** Zone NOMINALE de Course (LDB 15 l.41) : Marche + Course (3M cases, avant DR) — affichée dans une
 *  autre couleur ; un clic dedans demande le Test d'Athlétisme (+20), le déplacement réel dépendant du
 *  jet. Mêmes conditions que la Course : plein Mouvement, Action libre, non Engagé, pas À Terre. */
export function computeRunReach(get: Get): Map<string, number> {
  const { battle, scene } = get();
  if (!battle || !scene || battle.over || battle.acted || battle.movementUsed > 0) return new Map();
  // Mode-CASE (#198, résidus) : Pousser/Téléportation/pose de zone posent LEUR PROPRE ensemble dans
  // `battle.reachable` (déjà priorisé par `displayedReach` ci-dessous) — la zone de Course NOMINALE
  // (Marche+Course normales) n'a pas de sens pendant ces modes et ne doit pas s'y superposer (sinon la
  // grille 'run', qui porte `data-tile`, ratisse toute la carte au lieu du seul ensemble du mode).
  if (battle.reachable.size > 0) return new Map();
  const active = activeCombatant(battle);
  if (!active || !controlsCombatant(get(), active) || !active.pos) return new Map();
  if (isEngaged(active) || hasCondition(active, COND.aTerre) || !canTakeAction(active)) return new Map();
  const geom = mountOf(battle, active) ?? active;
  const M = mountMovement(battle, active);
  if (M <= 0) return new Map();
  const reach = moveReachFor(geom, scene, active.pos, M * 3, moveEnv(battle, geom));
  return briseFleeFilter(scene, battle, active, reach);
}

/** Zone d'arrivée d'une CHARGE (LDB 15 l.35-37) : les cases atteignables avec le budget `chargeReach`
 *  (Course du Tableau des Mouvements, `engine/movement`). MÊMES portes que la branche `charge` de
 *  `attackPlan` — non Engagé, Mouvement intact, pas À Terre — pour que la bande AFFICHÉE soit
 *  exactement celle où un clic-ennemi partira en charge. Vide quand la Charge n'est pas offerte. */
export function computeChargeReach(get: Get): Map<string, number> {
  const { battle, scene } = get();
  if (!battle || !scene || battle.over || battle.movementUsed > 0) return new Map();
  const active = activeCombatant(battle);
  if (!active || !controlsCombatant(get(), active) || !active.pos) return new Map();
  if (isEngaged(active) || hasCondition(active, COND.aTerre) || !canTakeAction(active)) return new Map();
  const geom = mountOf(battle, active) ?? active;
  const M = mountMovement(battle, active);
  if (M <= 0) return new Map();
  return moveReachFor(geom, scene, active.pos, chargeReach(M, runMultiplier(geom.traits)), moveEnv(battle, geom));
}

/** Cases cliquables affichées/validées : budget SPÉCIAL stocké (Course, post-Désengagement)
 *  prioritaire, sinon Marche restante dérivée. */
export function displayedReach(get: Get): Map<string, number> {
  const battle = get().battle;
  if (!battle) return new Map();
  return battle.reachable.size > 0 ? battle.reachable : computeMoveReach(get);
}

/**
 * PARITÉ héros/IA sur l'approche (LDB 15 l.35-41) : si le plan de MARCHE n'amène pas l'ennemi au
 * contact, un combattant de mêlée non Engagé tente une CHARGE à portée de Course (2M × Bond/Foulée) ;
 * si même la Course ne suffit pas, il COURT (Action + Test d'Athlétisme — Chevaucher à cheval —,
 * résolution instantanée IA) : budget = Marche + Course + DR, et il n'attaque PAS ce tour.
 * Pure (rng injecté) — renvoie le plan retenu et le jet de Course éventuel.
 */
export function aiApproachPlan(
  input: EnemyTurnInput,
  geom: Combatant,
  action: EnemyAction,
  rng: RNG,
): { plan: EnemyAction; ran: { roll: number; budget: number } | null } {
  const enemy = input.enemy;
  const none = { plan: action, ran: null };
  if (action.kind !== 'move') return none;
  if (isEngaged(enemy) || hasCondition(enemy, COND.aTerre) || !canTakeAction(enemy)) return none;
  if (!enemy.weapons.some((w) => w.type === 'melee')) return none;
  const M = effectiveMovement(geom);
  if (M <= 0) return none;
  const atContact = (a: EnemyAction): boolean =>
    a.kind === 'move' && combatDistance({ ...enemy, pos: a.to } as Combatant, input.heroes.find((h) => h.id === a.thenTargetId) ?? input.heroes[0]) <= meleeReachTiles(enemy.weapons);
  if (atContact(action)) return none; // la Marche suffit déjà
  // Charge (portée de Course, sans Test — LDB 15 l.35-37).
  const courseBudget = chargeReach(M, runMultiplier(geom.traits));
  if (courseBudget <= input.movement) return none;
  // Les deux ré-énumérations ci-dessous rejouent l'approche à un budget de mouvement SUPÉRIEUR sur la
  // MÊME géométrie : elles partagent le mémo de Ligne de Vue de la décision (posé par `buildAiInput` ;
  // un appel PUR sans mémo en reçoit un ici) — une case atteinte aux trois budgets n'est évaluée qu'une fois.
  const inp: EnemyTurnInput = input.losMemo ? input : { ...input, losMemo: makeLosMemo(input.scene, input.smoke ?? []) };
  const charge = chooseEnemyAction({ ...inp, movement: courseBudget });
  if (charge.kind === 'move' && atContact(charge)) return { plan: charge, ran: null };
  // Course (LDB 15 l.41) : Test d'Athlétisme/Chevaucher, budget = Marche + Course + DR ; pas d'attaque.
  const r = resolveRun(testValue(enemy, enemy.mountId ? 'chevaucher' : 'athletisme'), M, rng);
  const runBudget = M + r.bonusCases;
  const run = runBudget > input.movement ? chooseEnemyAction({ ...inp, movement: runBudget }) : action;
  if (run.kind === 'move' && (run.to.x !== action.to.x || run.to.y !== action.to.y))
    return { plan: run, ran: { roll: r.roll, budget: runBudget } };
  // La Course ne porte pas plus loin que le plan de Marche : marcher normalement (pas d'Action gâchée).
  return none;
}

/** Cible IMPOSÉE d'un combattant en Frénésie (LDB 21 l.33) : l'ennemi le plus proche dans sa Ligne
 *  de Vue (à distance égale, le plus blessé — même critère que l'IA). Null si pas frénétique ou
 *  aucun ennemi visible (alors pas de contrainte). */
export function frenzyTarget(get: Get, c: Combatant): Combatant | null {
  const { battle, scene } = get();
  if (!battle || !scene || !isFrenzied(c) || !c.pos) return null;
  const visible = battle.combatants.filter(
    (e) => e.kind !== c.kind && !isOutOfAction(e) && e.pos && losClear(scene, c.pos!, e.pos!, smokeOf(battle)),
  );
  if (!visible.length) return null;
  return visible.sort((a, b) => {
    const da = combatDistance(c, a), db = combatDistance(c, b);
    if (da !== db) return da - db;
    return a.wounds.current - b.wounds.current;
  })[0];
}

/** Source de PEUR active dont `dest` RAPPROCHE l'acteur (LDB 21 l.27) — null si aucune, ou si
 *  immunisé à la Psychologie. « Sous l'emprise » ⟺ Test étendu de Calme pas encore au niveau
 *  de l'Indice (calmeDR < indice). Pure. */
export function fearedSourceTowards(battle: BattleState, active: Combatant, dest: Pt): Combatant | null {
  if (!active.pos || isPsychImmune(active)) return null;
  for (const p of active.psychState ?? []) {
    if (p.type !== 'peur' || (p.calmeDR ?? 0) >= (p.indice ?? 1)) continue;
    const src = inBattleId(battle, p.sourceId);
    if (src?.pos && !isOutOfAction(src) && chebyshev(dest, src.pos) < chebyshev(active.pos, src.pos)) return src;
  }
  return null;
}

export type AttackPlan =
  | { kind: 'attack' }
  | { kind: 'charge'; dest: Pt; path: Pt[]; adv: 0 | 1 }
  | { kind: 'moveAttack'; dest: Pt; path: Pt[]; cost: number }
  | { kind: 'blocked'; reason: string };

/** Ce qu'un clic sur CET ennemi ferait : attaque directe (Allonge / tir), Charge implicite
 *  (non Engagé + Mouvement intact + mêlée, portée de Course — LDB 15 l.35-37), ou
 *  rejoindre-et-attaquer dans la Marche restante (pas une Charge → pas de bonus). Pure-store. */
export function attackPlan(get: Get, active: Combatant, target: Combatant, opts?: { reach?: number; forceMelee?: boolean; weaponUid?: string }): AttackPlan {
  const battle = get().battle!;
  const scene = get().scene!;
  // Géométrie de COMBAT (LDB 14) : un cavalier mesure reach/adjacence depuis l'empreinte de sa MONTURE
  // (le couple partage position+empreinte, souvent 2×2) ; idem si la CIBLE est montée. Un chef de pièce
  // de MÊLÉE servie (bélier, #210) mesure depuis l'empreinte de la COQUE — `combatGeomOf` (SOURCE UNIQUE).
  const geom = combatGeomOf(battle, active);
  const tgtGeom = combatGeomOf(battle, target);
  // `opts` (attaque CHOISIE : arme tenue vs attaque naturelle gratuite) : `reach` impose l'Allonge (gratuites
  // de mêlée = 1, géométrie PERSONNELLE — soi/monture — jamais la coque d'une pièce que cette attaque
  // naturelle ne concerne pas) ; sans `reach`, chaque arme de mêlée TENUE est évaluée avec SA PROPRE
  // géométrie (`meleeWeaponInRange`, #BUG-A) — une arme personnelle n'hérite jamais de l'allonge de la
  // coque servie, et réciproquement la pièce (bélier) reste disponible même chef loin. `forceMelee` ignore
  // la branche distance même avec une arme à distance tenue.
  const inMeleeRange = opts?.reach != null
    ? combatDistance(mountOf(battle, active) ?? active, tgtGeom) <= opts.reach
    : !!meleeWeaponInRange(battle, active, target);
  if (inMeleeRange) return { kind: 'attack' };
  // L'arme du SET ACTIF décide : quand l'option ÉPINGLE une arme (`weaponUid` → pièce de poste servie, canon
  // OU bélier), on tranche par SON type ; sinon repli sur l'arme par défaut du set (`assertAttackWeapon` sur
  // TOUTES les armes tenues — poste inclus). Ne PAS passer par `personalWeaponsOf` ici : un chef qui ne porte
  // QUE la pièce servie (bélier, #210) n'a aucune arme personnelle et ferait échouer l'invariant mains-nues.
  // `assertAttackWeapon(active.weapons)` seul masquait le canon d'un poste RANGED (arme d'équipe, MDG 12) : le
  // tir joueur retombait sur une arme perso de mêlée et refusait « hors de portée » (#BUG-A). Gate PRÉ-clic
  // (parité sort) : sans Ligne de Vue (LDB 13 l.114) ou au-delà de la bande Extrême (Portée ×3), refuser AVANT
  // la modale — sinon « Lancer » fabrique un raté garanti qui consomme l'Action. Les gates de la résolution
  // restent (défense en profondeur). Le gate de RESSOURCE (Recharge/munition) est porté par `firedAttackBlock`
  // (concern orthogonal), rejoué par le clic ET le survol sur ce `{kind:'attack'}`.
  const decisive = (opts?.weaponUid ? active.weapons.find((w) => w.uid === opts.weaponUid) : undefined)
    ?? assertAttackWeapon(active.weapons, false);
  if (!opts?.forceMelee && decisive.type === 'ranged') {
    const p = previewAttack(get, active, target, undefined, { weaponUid: opts?.weaponUid });
    if (p.blocked) return { kind: 'blocked', reason: tr('cf.noLoSMasked') };
    if (!p.inRange) return { kind: 'blocked', reason: tr('cf.outOfRange') };
    return { kind: 'attack' };
  }
  // Mêlée hors d'Allonge :
  // Une STRUCTURE (ADE II 8) est inanimée : pas de Charge ni d'approche-puis-frappe implicite (la
  // frapper est une ACTION délibérée, sans +1 Avantage ni `fromCharge` qui bloquerait « Renoncer »).
  // On refuse → le joueur s'approche par un clic-sol normal (undoable), puis frappe une fois au contact.
  if (isInanimate(target)) return { kind: 'blocked', reason: tr('cf.approcheToiPourFrapper') };
  if (isEngaged(active)) return { kind: 'blocked', reason: tr('cf.desengageAvantDeRejoindre') };
  const env = moveEnv(battle, geom);
  if (battle.movementUsed === 0 && !hasCondition(active, COND.aTerre)) {
    // Charge (LDB 15 l.35-37) : manœuvre PLEINE, portée de Course (2M × Bond/Foulée), arrivée
    // adjacente la moins chère.
    const M = mountMovement(battle, active);
    const reach = moveReachFor(geom, scene, active.pos!, chargeReach(M, runMultiplier(geom.traits)), env);
    const dest = bestAdjacentReachable(reach, target.pos!, footprintN(target), footprintN(geom));
    if (!dest) return { kind: 'blocked', reason: tr('cf.chargeHorsPortee') };
    return { kind: 'charge', dest, path: pathTo(scene, active.pos!, dest, env) ?? [], adv: chargeAdvantage(M, footprintChebyshev(active.pos!, footprintN(geom), target.pos!, footprintN(target))) };
  }
  // Mouvement entamé (ou À Terre) : rejoindre dans la Marche restante.
  const reach = displayedReach(get);
  const dest = bestAdjacentReachable(reach, target.pos!, footprintN(target), footprintN(geom));
  if (!dest) return { kind: 'blocked', reason: tr('cs.meleeOutOfRange') };
  return { kind: 'moveAttack', dest, path: pathTo(scene, active.pos!, dest, env) ?? [], cost: reach.get(`${dest.x},${dest.y}`)! };
}

/** Mort d'un combattant : pour un héros à Destin, suspend (pendingFateSave) au lieu de mourir
 *  (LDB 17 l.31-35) ; sinon finalise la mort. `restoreWounds` = PB d'avant le coup létal.
 *  `foe` = « l'individu ou l'élément qui l'a presque tué » (coup direct) → Cible d'une éventuelle
 *  Animosité si le Destin est dépensé (ADE II Annexe I, règle facultative) ; absent pour la mort lente. */
export function finalizeHeroDeath(_get: Get, set: SetFn, hero: Combatant, source: 'hit' | 'slow', restoreWounds?: number, foe?: Pick<Combatant, 'label' | 'groups'>): void {
  // Le vrai gate est la RESSOURCE (`fate > 0`, présente sur tout kind), pas le `kind` : un combattant à
  // Destin (héros, ou ennemi conduit doté de Destin) est sauvé ; sinon la mort est finalisée.
  if ((hero.fate ?? 0) > 0) {
    const foeCible = foe ? (foe.groups?.[0] ?? foe.label) : undefined;
    set({ pendingFateSave: { heroId: hero.id, source, restoreWounds, ...(foeCible ? { foeCible } : {}) } });
  } else {
    hero.dead = true;
  }
}

/** Émet le déclencheur `onSlain` UNE seule fois pour un combattant mis HORS DE COMBAT — effets de DONNÉE
 *  « à la mort » (Démoniaque banni, LDB 85 l.98 ; futur explose/se dédouble). Atteignable par plusieurs
 *  chemins de mort (0 PB, Critique létal, mort-auto, mort lente) → garde d'unicité `slainNotified`.
 *  Renvoie les lignes de journal de l'effet (tissées par l'appelant à sa position). */
export function notifySlain(get: Get, set: SetFn, c: Combatant): string[] {
  if (!isOutOfAction(c) || c.slainNotified) return [];
  c.slainNotified = true;
  releaseSeatsOfDowned(get, set); // un corps mis hors d'action ne tient plus sa chaise
  const lines: string[] = [];
  emitCombatEvent('onSlain', { get, set, battle: get().battle!, self: c, sink: (line) => lines.push(line), triggerCtx: { rng: battleRng() } });
  // Ops IMPURES « à la mort » (Charnier : 3d10 Zombies ; toute zone laissée en mourant) — inertes dans
  // applyOps, résolues ici (grille/initiative) comme au lancement d'un sort d'invocation/zone.
  lines.push(...resolveTriggerImpureOps(get, set, c, 'onSlain'));
  return lines;
}

/** Tables d'étape des Blessures critiques du LDB (une par table de rattachement — les six Localisations
 *  s'y projettent par `critTableKeyFor`). Les fourchettes et les ids STABLES viennent de la DONNÉE
 *  (`criticals.json`, passée PAR RÉFÉRENCE) ; la ligne d'affichage est le libellé de l'entrée atteinte. */
export const CRIT_TABLE_IDS: Record<CritTableKey, string> = {
  tete: 'criticals-tete', bras: 'criticals-bras', corps: 'criticals-corps', jambe: 'criticals-jambe',
};
/** Catégorie Codex où vit CHAQUE ligne de ces tables — c'est elle qui fait descendre l'enjeu de
 *  l'étape à la Blessure critique RÉELLEMENT tirée (#1117, `stakeAtTableRow`). */
const CRIT_TABLE_CATEGORIES: Record<CritTableKey, string> = {
  tete: 'criticalsTete', bras: 'criticalsBras', corps: 'criticalsCorps', jambe: 'criticalsJambe',
};
for (const key of Object.keys(CRIT_TABLE_IDS) as CritTableKey[]) {
  const rows = critTableRows('ldb', key);
  registerTableStep(CRIT_TABLE_IDS[key], {
    label: `Blessures critiques — ${libelleDeValeur(critTableSchema, key)}`,
    die: 100,
    rows,
    lines: (die) => [findTableEntry(rows, die).label],
    entryCategory: CRIT_TABLE_CATEGORIES[key],
  });
}

/**
 * La SÉVÉRITÉ se tire-t-elle sur les tables LDB (donc par une étape à table) ? Prédicat UNIQUE, qui LIT
 * le choix de jeu du moteur (`jeuDeCritique`) plutôt que de le recalculer — le seam, la déclaration et la
 * FENÊTRE de pose s'y gatent tous, sinon le dé posé irait à une table qui ne le lit pas. Variante Aux
 * Armes : ses tables (décalage +10/Blessure propre) ne sont pas déclarées en étapes → dé au résolveur,
 * sans étape (couverture AA : #974).
 */
export function critSeverityInSeam(twice?: boolean): boolean {
  return jeuDeCritique(twice) === 'ldb';
}

/** DÉCLARATION du tirage de SÉVÉRITÉ d'une Blessure critique (LDB 18) : la table de la Localisation,
 *  d100, et la réduction d'overkill portée en `mod` NÉGATIF (source unique `critSeverityReduction`).
 *  `clamp` : plancher « avec un résultat minimum de 01 » (LDB 18 l.17), la même borne que le
 *  `Math.max(1, …)` du lookup moteur. `keepHighest: 2` sous Bénédiction de Sauvagerie (LDB 41 l.170).
 *  Le dé de la déclaration est le dé NATUREL (le `mod` s'applique au lookup) : c'est exactement ce que
 *  `resolveCritique` attend en `forcedRoll`, qui applique LUI-MÊME la réduction — les deux lookups tombent
 *  donc sur la même ligne. LÈVE hors du périmètre du seam (défense en profondeur : une déclaration LDB
 *  fabriquée sous la variante AA promettrait une ligne que le résolveur AA n'appliquerait pas). */
export function critSeverityDecl(target: Combatant, location: HitLocation, overkill: number, twice?: boolean): CascadeTableDecl {
  if (!critSeverityInSeam(twice)) {
    throw new Error(`critSeverityDecl : tables LDB déclarées sous la variante « combat-aa-blessures » — la sévérité y est résolue sur les tables AA (#974).`);
  }
  return {
    tableId: CRIT_TABLE_IDS[critTableKeyFor(location)], spec: { n: 1, sides: 100 },
    mod: -critSeverityReduction(target, overkill), clamp: true,
    ...(twice ? { keepHighest: 2 } : {}),
  };
}

/**
 * SEAM du d100 de SÉVÉRITÉ d'une Blessure critique (#942 L4) : le dé passe par le résolveur d'étape
 * UNIQUE (`rollTableStep`) — Sauvagerie comprise (`keepHighest` : les DEUX lancers sont consommés là,
 * et le dé RETENU est celui qui s'affiche) — puis le moteur (`resolveCritique`) résout la ligne sur CE dé
 * naturel. Rend le Critique ET la déclaration résolue (portée par l'étape poussée → dé et ligne
 * visibles, journal « dé fixé » compris).
 *
 * `forcedNatural` = dé POSÉ (mode table) : aucun dé consommé, et `keepHighest` ne s'applique pas
 * (`rollTableStep` : `forcedRoll` PRIME). Le multi-lancer (`LDB 41 l.170`, `AA 13 l.57`) confie le
 * résultat gardé au porteur ; un dé posé nomme ce résultat directement — le RAW n'impose ici aucune
 * contrainte défavorable qu'un dé unique escamoterait. `twice` reste passé au moteur : il ne pèse
 * plus sur les dés (déjà tirés ici) mais garde la bifurcation AA exacte (`critSeverityInSeam`).
 */
export function resolveCritSeverity(
  target: Combatant, location: HitLocation, overkill: number, twice?: boolean, forcedNatural?: number,
): { crit: CriticalResolved; table?: CascadeTableDone } {
  if (!critSeverityInSeam(twice)) {
    return { crit: resolveCritique(jeuDeCritique(twice), target, location, battleRng(), { overkill, twice }) };
  }
  const decl = critSeverityDecl(target, location, overkill, twice);
  const rolled = rollTableStep({ ...decl, forcedRoll: forcedNatural }, battleRng());
  const crit = resolveCritique(jeuDeCritique(twice), target, location, battleRng(), { overkill, twice, forcedRoll: rolled.roll });
  return { crit, table: { ...decl, forcedRoll: rolled.roll, result: rolled } };
}

/** Applique une Blessure critique (Coup Critique ou overkill) à `target` : PB (ignore BE+PA,
 *  plancher 0) + États + compteur. Mort Subite pour les figurants en overkill. RETOURNE `true`
 *  si le résultat est létal (le caller finalise via finalizeHeroDeath). Pousse le journal dans `log`. */
export function applyCriticalToTarget(
  target: Combatant,
  location: HitLocation,
  isCoupCritique: boolean,
  overkill: number,
  log: string[],
  set: SetFn,
  opts: {
    ctx?: DeviationCtx; // qui inflige le coup + l'arme (→ modale enrichie) ; critTwice = B. de Sauvagerie de l'attaquant
    prerolled?: CriticalResolved; // Critique déjà tiré (déviation : on a montré CE Critique → on l'applique tel quel, sans re-tirer)
    suppressReveal?: boolean; // la modale de déviation a DÉJÀ affiché le Critique → ne pas re-pousser une révélation
    /** REQUIS : résout l'ÉQUIPAGE (`crewIds`) d'un navire, et OUVRE par la porte le Test que la rangée
     *  impose (`CriticalResolved.testFlow`) — un appelant sans `get` perdrait ce jet en silence. */
    get: Get;
  },
): boolean {
  const { ctx, prerolled, suppressReveal, get } = opts;
  // Structure de siège (AA 10 l.114) : modèle de Critique DISTINCT du personnage — table propre (pas de Trauma
  // humain) et pas de « Mort » de personnage. Filet de sécurité pour TOUT appelant (opposé/magie) ; le chemin
  // d'attaque normal passe déjà par `applyStructureCriticalToTarget` (cf. `applyAttackResult`).
  if (target.bodyShape === 'structure') {
    applyStructureCriticalToTarget(set, target, { attackerId: ctx?.attackerId, attackerKind: ctx?.attackerKind, weapon: ctx?.weapon }, log);
    return false; // une Structure ne « meurt » pas comme un personnage : la destruction = ses Blessures → BRÈCHE
  }
  if (overkill > 0 && !isCoupCritique && usesSuddenDeath(target)) {
    // Figurant : Mort Subite (LDB 18 l.42-46) — sortie directe.
    target.wounds.current = 0;
    if (!target.conditions.some((c) => c.id === COND.inconscient)) addCondition(target, COND.inconscient);
    log.push(tr('cf.collapse', { name: target.label }));
    return false;
  }
  // Coque inerte (véhicule / navire) : aucun Trauma humain. Le coup se résout sur les tables de NAVIRE
  // (MDG 13) via le module FRÈRE `shipCritical` — localisation par gréement (Coque/Gréement/Avirons/…
  // vs Équipage), effets en `GameOp` (Voie d'eau / En flammes) posés par `applyOps`. (Le `resolveCritique` de
  // personnage indexerait des Traumatismes humains, hors-sujet pour une coque.)
  if (target.bodyShape === 'vehicule') {
    return applyHullCriticalToTarget(target, log, set, { ctx, suppressReveal, get });
  }
  // La Localisation est RÉSOLUE par l'appelant (Coup Critique = 1d100 frais via `critWoundLocation`, qui
  // honore aussi la loc choisie « Je ne faillirai pas ! » / le Critique pré-montré ; overkill = loc de
  // touche) et passée telle quelle : `applyCriticalToTarget` ne re-tire JAMAIS la loc → zéro double tirage.
  const loc = location;
  const severity = prerolled ? undefined : resolveCritSeverity(target, loc, overkill, ctx?.critTwice); // dé de sévérité par l'étape à table (seam UNIQUE)
  const crit = prerolled ?? severity!.crit;
  // Variante Aux Armes (l.79) : un Coup Critique « T » (trivial) n'est PAS compté dans le nombre de
  // Blessures Critiques nécessaires pour tuer → il n'incrémente pas `criticalWounds` (le LDB n'a pas de
  // trivial : chaque Critique compte). `critTwice` (Sauvagerie) reste tables LDB même en mode AA (critical.ts).
  const aaTrivial = jeuDeCritique(ctx?.critTwice) === 'aa' && critiqueTriviale('aa', crit.location, crit.roll);
  if (!aaTrivial) target.criticalWounds = (target.criticalWounds ?? 0) + 1;
  target.tookCriticalThisFight = true; // fin de combat : Résistance Très Facile (+60) ou Infection Mineure (LDB 20 l.90)
  // Historique d'occurrence PAR ID D'ENTRÉE (LDB 18 l.71) : appendé après résolution — persiste à vie (jamais
  // réinitialisé au combat). `resolveCritique` l'a LU avant (`onRepeat` sur une 2e occurrence).
  target.critEntriesSuffered = [...(target.critEntriesSuffered ?? []), crit.entryId];
  log.push(crit.log);
  const revealLines = [crit.log];
  // Effets DÉTAILLÉS pour la modale enrichie : chaque trauma (Amputation, Fracture…) AVEC son explication
  // RAW (note) — « à quoi ça correspond » (#critique). Localisation FR, et pas de « (Jambe droite) (jambeD) ».
  const details: { text: string; note?: string }[] = [];
  if (crit.traumas.length) {
    target.traumas = [...(target.traumas ?? []), ...crit.traumas];
    for (const t of crit.traumas) {
      const text = `${t.label} (${locationLabel(t.location, target.bodyShape)})`;
      log.push(`  ↳ ${text}.`);
      revealLines.push(`  ↳ ${text}.`);
      details.push({ text, note: t.desc });
    }
    // Cumuls par comptage (LDB 18) : chaque séquelle applique SA règle déclarée (`TraumaCumul`) —
    // agrégation par bras/porteur, effet par palier, et escalade au seuil (main tranchée, Cécité, Surdité).
    for (const l of consolidateAmputations(target)) {
      log.push(`  ↳ ${l}`);
      revealLines.push(`  ↳ ${l}`);
      details.push({ text: l });
    }
  }
  if (!crit.lethal) {
    // `now` : horloge de jeu — sans elle, un effet d'HORLOGE (durée en jours, #153) calculerait son
    // échéance depuis 0 → expirerait immédiatement au tick suivant (`purgeClockEffects` compare à `get().gameTime`
    // réel). `location` : main affectée par l'op `disarm` (#153, convention DROITIER `brasD`→main/`brasG`→off).
    applyOps(target, crit.ops, { rng: battleRng(), now: get().gameTime, location: loc }); // effet immédiat (PB ignorant BE+PA + États) — langue GameOp
    if (crit.desc) {
      log.push(`  ↳ ${crit.desc}`); // effet long terme journalisé, non simulé
      revealLines.push(`  ↳ ${crit.desc}`);
      details.push({ text: crit.desc });
    }
  }
  // « Un jet = une modale » : modale de Coup Critique COMPLÈTE (qui inflige + arme + dé + localisation +
  // Blessures + États + effets expliqués), au niveau de la modale d'attaque. (Sautée si la modale de
  // déviation l'a déjà affichée — la déviation fusionne choix ET révélation sur une seule modale.)
  // SEULEMENT si un héros est concerné — il le SUBIT ou l'INFLIGE (arbitrage 2026-06-11, spec coop
  // §4bis) ; un critique purement ennemi↔ennemi reste au journal/bandeau (les lignes sont déjà dans `log`).
  const heroConcerned = target.kind === 'hero' || ctx?.attackerKind === 'hero';
  if (!suppressReveal && heroConcerned) {
    const sum = critImmediateSummary(crit.ops);
    pushReveal(set, {
      kind: 'critical', title: 'Coup Critique', dice: crit.roll, lines: revealLines, subjectId: target.id,
      severity: 'grave',
      actorId: ctx?.attackerId, weapon: ctx?.weapon, details,
      crit: { location: locationLabel(crit.location, target.bodyShape), woundsLost: sum.woundsLost, conditions: sum.conditions.length ? sum.conditions : undefined },
    }, { table: severity?.table }); // la DÉCLARATION résolue voyage avec la révélation : dé + ligne atteinte sur la rangée
  }
  // Le(s) Test(s) que la Blessure impose (LDB 18 : « Réussissez un Test de Résistance… » ; l.74 pour un
  // déclencheur de séquelle) passent par la PORTE canonique, APRÈS la révélation du Critique : le SOCLE
  // seul décide de la surface (porteur tenu → étape influençable ; sinon voie inline). Patron
  // `MiscastResult.testFlow` (`finishMiscast`). Létal : le RAW n'applique aucun effet supplémentaire (l'`applyOps`
  // ci-dessus est gaté pareillement) — le Test n'a plus d'objet.
  if (crit.testFlow && !crit.lethal) routeTriggeredTest(get, set, target, target, crit.testFlow, { label: crit.label });
  return crit.lethal; // « Mort » instantané → finalisé par le caller (sauvetage par Destin possible)
}

/**
 * Critique encaissé par une COQUE (véhicule/navire, `bodyShape:'vehicule'`) — MDG 13-14. On lit le gréement
 * de la coque (`vehicles.json` → `hull.rig`) pour la colonne de Localisation, puis on DÉLÈGUE au résolveur engine
 * PUR `applyHullCritical`, qui pose les États NAVALS sur la coque (`GameOp`) ET répercute sur l'ÉQUIPAGE : un coup
 * « Équipage » devient un Critique de PERSONNAGE sur un marin exposé, les Éclats infligent 9 Dégâts à autant de
 * marins. L'équipage est résolu depuis `target.crewIds` via la bataille (`get`) ; absent → effets de coque seuls.
 * La destruction de la coque NE passe PAS par un « Mort » de Critique mais par ses Blessures / l'État Naufrage —
 * on renvoie donc toujours `false`.
 */
export function applyHullCriticalToTarget(
  target: Combatant,
  log: string[],
  set: SetFn,
  opts?: { ctx?: DeviationCtx; suppressReveal?: boolean; get?: Get; forcedLocRoll?: number; forcedCritRoll?: number },
): boolean {
  const { ctx, suppressReveal, get, forcedLocRoll, forcedCritRoll } = opts ?? {};
  const hull = findVehicleById(target.creatureId ?? '')?.hull;
  const rig: ShipRig = hull?.rig ?? 'mixte';
  const crew = get && target.crewIds
    ? (target.crewIds.map((id) => actorIn(get(), id)).filter(Boolean) as Combatant[])
    : [];
  // Réfs data-driven : `navire`/`ship-criticals` (MDG, défaut) ou `navire-fluvial`/`river-criticals` (MSRC 7).
  // Les dés IMPOSÉS sont ceux que le moteur accepte déjà (`applyHullCritical`) : la recette s'en sert
  // pour atteindre une Localisation VOULUE sans chemin parallèle — le jeu applique le sien.
  const outcome = applyHullCritical(target, crew, rig, battleRng(), forcedLocRoll, forcedCritRoll, {
    locationTable: hull?.locationTable, criticalTable: hull?.criticalTable,
  });
  target.criticalWounds = (target.criticalWounds ?? 0) + 1;
  for (const l of outcome.lines) log.push(l);
  const heroConcerned = target.kind === 'hero' || ctx?.attackerKind === 'hero'
    || crew.some((c) => c.kind === 'hero');
  if (!suppressReveal && heroConcerned) {
    pushReveal(set, {
      kind: 'critical', title: 'Critique de navire', dice: outcome.crewCrit?.crit.roll ?? 0, lines: outcome.lines,
      subjectId: target.id, severity: 'grave', actorId: ctx?.attackerId, weapon: ctx?.weapon, details: [],
    });
  }
  // Les Test(s) que la rangée impose passent par la PORTE canonique, APRÈS la révélation — mêmes deux
  // voies que `applyCriticalToTarget`, et le socle seul décide de la surface :
  //  · Localisation « Équipage » → le marin encaisse un Critique de PERSONNAGE, dont le nœud de rangée
  //    (LDB 18) est celui de `resolveCritique` ;
  //  · sinon → le coup à l'équipage de la rangée (MSRC 07 l.78/l.94, MDG 13 l.763) sur N marins :
  //    UNE bande de N rangées pour ceux que des sièges tiennent, voie inline pour les autres.
  if (get) {
    const crit = outcome.crewCrit;
    const blesse = crit ? crew.find((c) => c.id === crit.crewId) : undefined;
    if (crit?.crit.testFlow && !crit.crit.lethal && blesse) {
      routeTriggeredTest(get, set, blesse, blesse, crit.crit.testFlow, { label: crit.crit.label });
    }
    const coup = outcome.crewHit;
    if (coup?.testFlow) {
      const victimes = coup.victims.map((id) => crew.find((c) => c.id === id)).filter(Boolean) as Combatant[];
      pushCombatStep(set, (index) => bandeTriggeredTest(
        get, set, victimes, coup.testFlow!, `ship-crew-hit-${target.id}-${index}`, { label: coup.label, hull: target },
      ));
    }
  }
  return false;
}

/** Table d'étape du Critique de Structure (AA 10 l.116-127) — la DONNÉE `structure-criticals.json` porte les
 *  fourchettes et les ids ; le TIRAGE passe par le résolveur unique `rollTableStep`, le FORMATAGE des
 *  lignes reste au moteur (`rollStructureCritical`, appelé avec le dé déjà tiré : aucun dé consommé). */
export const STRUCTURE_CRIT_TABLE = 'structure-criticals';
registerTableStep(STRUCTURE_CRIT_TABLE, {
  label: 'Blessures critiques sur une Structure',
  die: 100,
  rows: STRUCTURE_CRITICALS,
  lines: (die) => { const o = rollStructureCritical(battleRng(), die); return o.note ? [...o.log, o.note] : [...o.log]; },
  entryCategory: 'structureCriticals',
});

/**
 * Critique de Structure (AA 10 l.112-127) — calqué sur `applyHullCriticalToTarget`. Le dé passe par
 * l'étape à TABLE (`rollTableStep`, #942 L2 — site UNIQUE du tirage, `forcedRoll` = l'injection) ; le
 * moteur (`rollStructureCritical`) reste la source du LOOKUP mécanique sur CE dé : Blessures
 * supplémentaires (langue `GameOp`, ignore BE/PA) et, sur un Effondrement (96+), Structure à 0 Blessure
 * (la destruction se matérialise en BRÈCHE par `collapseStructure`, à la clôture de la résolution).
 * Empile l'étape « Critique de Structure » (déclaration de table + charge riche) si un héros est
 * concerné. PUR vis-à-vis de la grille (aucun retrait ici).
 */
export function applyStructureCriticalToTarget(
  set: SetFn,
  target: Combatant,
  ctx: { attackerId?: string; attackerKind?: Combatant['kind']; weapon?: string },
  log: string[],
  forcedRoll?: number,
): StructureCriticalResolved {
  // CONTRAINTE des deux `forcedRoll` de cette fonction — ils ne portent PAS le même dé :
  //  - celui de la DÉCLARATION (`table.forcedRoll`, = le paramètre de cette fonction) est le dé NATUREL,
  //    car `rollTableStep` lui applique encore `mod` avant son lookup ;
  //  - celui passé au MOTEUR est le dé EFFECTIF (`rolled.die`) : `rollStructureCritical` refait SON
  //    lookup et n'a aucun concept de `mod` — lui donner le naturel décalerait la ligne mécanique de
  //    celle affichée par l'étape.
  const table: CascadeTableDecl = { tableId: STRUCTURE_CRIT_TABLE, spec: { n: 1, sides: 100 }, forcedRoll };
  const rolled = rollTableStep(table, battleRng());
  const outcome = rollStructureCritical(battleRng(), rolled.die);
  target.criticalWounds = (target.criticalWounds ?? 0) + 1;
  applyOps(target, outcome.ops, { rng: battleRng() }); // Blessures supplémentaires (GameOp `wounds`, ignore BE+PA)
  if (outcome.destroyed) target.wounds.current = 0; // Effondrement → la Structure s'écroule (BRÈCHE à la clôture)
  for (const l of outcome.log) log.push(l);
  if (outcome.note) log.push(`  ↳ ${outcome.note}`); // effets verbatim sur les personnes (débris/Tests), non simulés
  if (target.kind === 'hero' || ctx.attackerKind === 'hero') {
    // Étape à TABLE de la séquence : `table` DÉCLARE le tirage (id de ligne stable, dé naturel/effectif),
    // `reveal` porte le rendu détaillé partagé (`CriticalBody` : qui inflige → arme → victime).
    const entry: RevealEntry = {
      kind: 'critical', title: 'Critique de Structure', dice: rolled.roll, lines: rolled.lines,
      subjectId: target.id, severity: outcome.destroyed ? 'grave' : 'minor', actorId: ctx.attackerId, weapon: ctx.weapon, details: [],
    };
    // Étape poussée DÉJÀ tirée : le mint fait descendre l'enjeu à la ligne atteinte (`stakeAtTableRow`
    // lit la catégorie déclarée par la table), et porte la charge riche dans son slot `reveal`.
    pushTableDone(set, {
      id: `cons-critical-structure-${target.id}-${target.criticalWounds}`,
      kind: 'critical', actorId: target.id, icon: 'journal/critical', label: dataLabel(entry.title),
      table, result: rolled, reveal: entry, outcome: toRecapLines(rolled.lines),
      stake: combatStakeRef('structureCritical'),
    });
  }
  return outcome;
}

/** Effondrement d'une STRUCTURE de siège tombée à 0 Blessure (AA 10 l.114/127) → BRÈCHE franchissable : pose le flag
 *  `structureDown` sur l'arête (`structureEdge`), RETIRE le Combattant inerte de la bataille et re-render
 *  (SCENE_DIRTY). Appelée à la CLÔTURE de la résolution (APRÈS le `set` qui réécrit `battle` depuis sa capture)
 *  → pas de clobber. No-op (réf inchangée pour la scène) si la cible n'a pas d'arête (structure hors scène). */
export function collapseStructure(get: Get, set: SetFn, target: Combatant): void {
  const e = target.structureEdge;
  // QUI tombe et de QUELLE hauteur — LU AVANT la transaction, sur la scène et la file courantes : un
  // updater Zustand est une fonction PURE de l'état, il ne remplit pas un tableau au passage (il peut
  // être rejoué). Le 1d10 des Dégâts est un dé comme un autre et part à la porte APRÈS (#1508,
  // `ouvrirChute`) — la transaction ci-dessous ne fait que la brèche, le déplacement et le journal.
  const avant = get();
  const tombants = !e || !avant.scene ? [] : parapetTilesAbove(avant.scene, e).flatMap((tl) => {
    const sc = avant.scene!;
    // Hauteur de chute = vraie hauteur métrique (relief) de la passerelle (z=tl.z) au-dessus du sol (z=0).
    const metres = Math.abs(heightAt(sc, tl.x, tl.y, tl.z) - heightAt(sc, tl.x, tl.y, 0));
    return (avant.battle?.combatants ?? [])
      .filter((c) => c.id !== target.id && c.pos?.x === tl.x && c.pos?.y === tl.y && (c.pos?.z ?? 0) === 1)
      .map((c) => ({ id: c.id, metres }));
  });
  set((s: GameState) => {
    const log = [...(s.battle?.log ?? []), ev('death', structureCollapseLog(target.label), target.id)];
    let combatants = s.battle?.combatants.filter((c) => c.id !== target.id) ?? [];
    let scene = s.scene;
    if (e && scene) {
      // Brèche : pose le flag `structureDown` sur l'arête (le Combattant-structure inerte est déjà retiré).
      scene = setStructureDown(scene, e.x, e.y, e.side, e.z ?? 0, true);
      // Effondrement de la PASSERELLE (z=1) portée par la structure abattue : ses occupants CHUTENT au
      // sol (dégâts de chute, LDB 15) et les tuiles deviennent infranchissables (`setTileCollapsed`).
      for (const tl of parapetTilesAbove(scene, e)) {
        const sc = scene; // réf non-null capturée pour les closures (scene est un `let` réassigné plus bas)
        combatants = combatants.map((c) => {
          if (c.pos?.x !== tl.x || c.pos?.y !== tl.y || (c.pos?.z ?? 0) !== 1) return c;
          const fallen = { ...c, wounds: { ...c.wounds }, conditions: c.conditions.map((x) => ({ ...x })) };
          placeCombatant(fallen, sc, { x: tl.x, y: tl.y }); // chute au sol (z=0, omis) + hauteur rafraîchie
          log.push(ev('damage', tr('cf.gangwayCollapse', { name: c.label }), c.id));
          return fallen;
        });
        scene = setTileCollapsed(scene, tl.x, tl.y, tl.z);
      }
    }
    return { scene, battle: s.battle ? { ...s.battle, combatants, log } : s.battle };
  });
  for (const tb of tombants) {
    const c = inBattleId(get().battle, tb.id);
    if (c) ouvrirChute(set, c, tb.metres);
  }
  clearEngagementOf(get().battle?.combatants ?? [], target.id); // l'attaquant n'est plus Engagé avec la brèche
  bus.emit(EVT.SCENE_DIRTY);
}

/** Construit la révélation d'affichage d'un Coup Critique PRÉ-TIRÉ, SANS muter la cible (pour la modale
 *  de déviation : on montre le Critique qui menace avant le choix Dévier/Subir). Détails de base (sans la
 *  consolidation des amputations multiples, calculée seulement à l'application). */
export function previewCritEntry(target: Combatant, crit: CriticalResolved, ctx?: { attackerId?: string; weapon?: string }): RevealEntry {
  const lines = [crit.log];
  const details: { text: string; note?: string }[] = [];
  for (const t of crit.traumas) {
    const text = `${t.label} (${locationLabel(t.location, target.bodyShape)})`;
    lines.push(`  ↳ ${text}.`);
    details.push({ text, note: t.desc });
  }
  if (!crit.lethal && crit.desc) {
    lines.push(`  ↳ ${crit.desc}`);
    details.push({ text: crit.desc });
  }
  const sum = critImmediateSummary(crit.ops);
  return {
    kind: 'critical', title: 'Coup Critique', dice: crit.roll, lines, subjectId: target.id,
    actorId: ctx?.attackerId, weapon: ctx?.weapon, details,
    crit: { location: locationLabel(crit.location, target.bodyShape), woundsLost: sum.woundsLost, conditions: sum.conditions.length ? sum.conditions : undefined },
  };
}

/** Dévier 1 PA pour IGNORER le Critique (LDB 63 l.30) : sacrifie 1 PA à `location` ; la cible subit
 *  quand même les Blessures normales + `extraWounds` (recalcul à PA−1). RETOURNE false si aucune PA
 *  sacrifiable → la Déviation n'a pas lieu. Arme-agnostique (l'`extraWounds` est calculé par l'appelant). */
function deflectCrit(target: Combatant, location: HitLocation, extraWounds: number, log: string[]): boolean {
  if (!damageArmour(target, location)) return false;
  if (extraWounds > 0) target.wounds.current = Math.max(0, target.wounds.current - extraWounds);
  log.push(tr('cf.deflect', { name: target.label }));
  return true;
}

/** Triptyque PARTAGÉ d'application d'un Critique (mêlée/opposé/magie) : applique la table puis finalise
 *  une éventuelle mort par le chemin normal. `woundsBefore` = PB AVANT les dégâts de base (passé par
 *  l'appelant → restauration Destin correcte au Subir). */
function applyCritAndFinalize(
  get: Get, set: SetFn, target: Combatant, location: HitLocation, isCoupCritique: boolean, overkill: number,
  log: string[], ctx: DeviationCtx, woundsBefore: number, crit?: CriticalResolved, suppressReveal?: boolean,
): boolean {
  const lethal = applyCriticalToTarget(target, location, isCoupCritique, overkill, log, set, { ctx, prerolled: crit, suppressReveal, get });
  if (lethal) finalizeHeroDeath(get, set, target, 'hit', woundsBefore, inBattleId(get().battle, ctx.attackerId));
  return lethal;
}

/**
 * DÉVIATION DÉCIDÉE PAR L'AUTOMATE (LDB 63 l.30) : rule-gated, sacrifie 1 PA à la loc du Critique si
 * possible → Critique ignoré. RETOURNE true si la Déviation a eu lieu. Révélation « dévié » si un héros
 * est concerné (parité avec la révélation du Critique subi). Source UNIQUE pour les 3 chemins.
 *
 * KIND-AGNOSTIQUE : son corps ne lit que la règle, l'armure et la cible. QUI décide est la question des
 * appelants, et elle a UNE réponse (#1426) — `tenuParUnHumain` : le RAW donne le choix à la victime
 * (« Cela ne se produit que si vous le choisissez », LDB 63 l.30), donc l'automate ne tranche que pour un
 * porteur qu'AUCUN siège humain ne tient. Un ennemi sous siège MJ reçoit l'étape Dévier/Subir comme un héros.
 */
function autoDeviate(
  set: SetFn, target: Combatant, location: HitLocation, extraWounds: number,
  ctx: { attackerId?: string; weapon?: string }, roll: number, log: string[], heroConcerned: boolean,
): boolean {
  if (!rule('combat-critical-deflect')) return false;
  if (deviatableArmourAt(target, location) <= 0) return false;
  if (!deflectCrit(target, location, extraWounds, log)) return false;
  if (heroConcerned)
    pushReveal(set, {
      kind: 'critical', title: tr('cf.critDeflectedTitle'), dice: roll, severity: 'minor',
      lines: [tr('cf.critDeflectedReveal', { loc: locationLabel(location, target.bodyShape) }), tr('cf.deflect', { name: target.label })],
      subjectId: target.id, actorId: ctx.attackerId, weapon: ctx.weapon,
    });
  return true;
}

/** DÉCLARATION de l'étape UNIQUE d'une Blessure critique (#1426) : le d100 de SÉVÉRITÉ (LDB 18) et la
 *  décision Dévier/Subir (LDB 63 l.30) sont la MÊME fenêtre. `severite` = la table reste à tirer (le
 *  Critique n'existe qu'APRÈS le dé — il est posé par le PLI post-dé, `registerCascadeTableFold`) ;
 *  `pretire` = aucune table déclarée pour ce cas (variante Aux Armes, chemins auto-contenus opposé et
 *  projectile magique), le Critique voyage alors dans la charge dès le mint. */
interface DeviationStepSpec {
  targetId: string;
  /** La décision est-elle OFFERTE ? Sans voies, l'étape ne porte que le tirage — le Critique est subi. */
  offerte: boolean;
  severite?: { decl: CascadeTableDecl; charge: PendingCritSeverity; label: PlayerText };
  pretire?: PendingDeviation;
}

/** Pousse l'étape « Blessure critique » — tirage de sévérité et/ou choix Dévier/Subir dans UNE fenêtre.
 *  Builder UNIQUE des 3 chemins. */
function pushDeviationStep(set: SetFn, spec: DeviationStepSpec): void {
  const options = spec.offerte
    ? [{ key: 'devier', label: tr('opt.devier') }, { key: 'subir', label: tr('opt.subir') }]
    : undefined;
  // UNE INSTANCE = UN ID : deux Critiques sur la MÊME cible à la MÊME localisation dans la même
  // séquence (Balayage, deux frappes du Maniement de deux armes) portaient le même id d'étape — les
  // seams keyés par id (`liveMerge` de `commitStep`, la pose du dé `cascadeTableSetForcedRoll`) ne les
  // distinguaient plus. L'INDEX d'append est le discriminant canonique de la porte (`rollSeam`, forme
  // FABRIQUE : « il distingue deux étapes de MÊME clé dans une séquence »).
  if (spec.severite) {
    const sev = spec.severite;
    pushTable(set, (index) => ({
      id: `cons-deviation-${spec.targetId}-${sev.charge.location}-${index}`,
      // Le titre d'étape porte la LOCALISATION : c'est elle qui dit sur QUELLE table le dé se pose.
      kind: 'deviation', actorId: spec.targetId, icon: 'journal/critical',
      label: sev.label,
      table: sev.decl,
      critSeverity: sev.charge,
      ...(options ? { options, defaultChoice: 'devier' } : {}),
      // Avant le dé, l'enjeu est celui du TABLEAU (fiche `blessures-critiques`) ; après, la re-pose
      // le fait descendre à la Blessure tirée (catégorie déclarée par la table de la Localisation).
      stake: combatStakeRef('critSeverity'),
    }));
    return;
  }
  const dev = spec.pretire!;
  pushChoice(set, (index) => ({
    id: `cons-deviation-${dev.targetId}-${index}`, kind: 'deviation', actorId: dev.targetId, icon: 'fire/blast',
    label: tr('step.critDevier'),
    options: options ?? [{ key: 'devier', label: tr('opt.devier') }, { key: 'subir', label: tr('opt.subir') }],
    defaultChoice: 'devier', deviation: dev, reveal: dev.reveal,
  }));
}

/**
 * PLI POST-DÉ de l'étape « Blessure critique » (#1426) — le dé de l'étape EST le dé naturel du Critique :
 * le moteur en fait la ligne AU MOMENT où le dé tombe (`resolveCritique` en `forcedRoll`, qui prime sur
 * `twice`), et le résultat est POSÉ sur l'étape. Il ne peut pas être re-dérivé au rendu : `resolveCritique`
 * consomme du RNG (amputation, relances) même sous dé posé, donc chaque redessin donnerait une autre
 * Blessure. C'est un pli IMPUR : le site unique de pose le MÉMORISE par valeur de dé sur l'étape
 * (`tableStepResolved`), de sorte qu'explorer les poses puis revenir sur un dé déjà vu rend LE MÊME
 * Critique. La révélation riche n'est portée par l'étape QUE si une décision y est offerte (le Critique
 * s'y lit pour choisir) ; sans options, elle reste due au chemin normal, après application.
 */
registerCascadeTableFold('deviation', (step, get) => {
  const p = step.critSeverity;
  const rolled = step.table?.result;
  if (!p || !rolled) return step;
  const target = inBattleId(get().battle, p.targetId);
  if (!target) return step;
  const crit = resolveCritique(jeuDeCritique(p.twice), target, p.location, battleRng(), { overkill: p.overkill, twice: p.twice, forcedRoll: rolled.roll });
  const reveal = previewCritEntry(target, crit, { attackerId: p.attackerId, weapon: p.weapon?.label });
  const dev: PendingDeviation = {
    mode: 'melee', attackerId: p.attackerId, targetId: p.targetId, weapon: p.weapon, res: p.res,
    crit, reveal, resumeAfter: true, ...(p.suite ? { suite: p.suite } : {}),
  };
  return { ...step, deviation: dev, ...(step.options ? { reveal } : {}) };
});

/** Une armure Bâclée frappée par un Coup Critique à sa localisation casse (LDB 60 l.50) — héros (pièces). */
function breakBacleArmour(target: Combatant, loc: HitLocation, log: string[]): void {
  const piece = (target.items ?? []).find(
    (i) => i.equipped && i.kind === 'armor' && i.locs?.includes(loc) && hasQuality(i, 'bacle') && (i.pa ?? 0) - (i.damageTaken ?? 0) > 0,
  );
  if (!piece) return;
  piece.damageTaken = piece.pa ?? 0; // inutilisable
  recomputeLoadout(target);
  log.push(tr('cf.shoddyBreaks', { name: target.label, loc }));
}

/** « Arme possédant une lame » (Piège-lame, LDB 62 l.278) — flag maison éditable (le RAW ne liste
 *  pas les armes), keyé par id (`Weapon.bladed`), jamais par le libellé. */
export function weaponHasBlade(w: Weapon | undefined): boolean {
  return w?.type === 'melee' && !!w.bladed;
}

/** Blessure critique « sèche » d'un Test opposé (LDB 14 l.3) : un double réussi inflige une Blessure
 *  critique à l'adversaire indépendamment du vainqueur de l'échange. Localisation = 1d100 frais (LDB 18
 *  l.53). Critique « sec » → aucune composante de Dégâts de base (overkill=0, deflectExtraWounds=0). La
 *  Déviation Critique (LDB 63 l.30) est offerte sur les TROIS chemins via les atomes partagés, sous le
 *  MÊME prédicat (#1426, `tenuParUnHumain`) : un porteur blindé TENU par un siège humain CHOISIT (étape
 *  `self`), un porteur blindé que personne ne tient voit l'automate trancher (`autoDeviate`, rule-gated),
 *  sinon le Critique est subi (`applyCritAndFinalize`). */
export function applyOpposedCritical(
  get: Get,
  set: SetFn,
  victim: Combatant,
  roll: number,
  ctx: { attackerId?: string; weapon?: string; weaponObj?: Weapon },
  log: string[],
): void {
  const loc = critWoundLocation(battleRng(), victim.bodyShape); // LDB 18 l.53 : Coup Critique → 1d100 frais (pas l'inversion de touche)
  // B. de Sauvagerie (LDB 41) : l'attaquant à l'origine du double tire deux lancers de Critique.
  const attacker = ctx.attackerId ? inBattleId(get().battle, ctx.attackerId) : undefined;
  const heroConcerned = victim.kind === 'hero' || attacker?.kind === 'hero';
  const c2: DeviationCtx = { ...ctx, attackerKind: attacker?.kind, critTwice: attacker ? critRollTwiceFor(attacker) : undefined };
  const deviable = !!rule('combat-critical-deflect') && deviatableArmourAt(victim, loc) > 0;
  if (deviable && !tenuParUnHumain(get(), victim.id)) {
    if (autoDeviate(set, victim, loc, 0, ctx, roll, log, heroConcerned)) return;
  } else if (deviable) {
    // Porteur blindé TENU : on SUSPEND pour son choix Dévier/Subir (étape `self`, Critique « sec » pré-tiré).
    const { crit } = resolveCritSeverity(victim, loc, 0, c2.critTwice); // dé de sévérité par l'étape à table (seam UNIQUE)
    const reveal = previewCritEntry(victim, crit, ctx);
    pushDeviationStep(set, { targetId: victim.id, offerte: true, pretire: {
      mode: 'self', attackerId: ctx.attackerId ?? '', targetId: victim.id, location: loc, crit,
      isCoupCritique: true, overkill: 0, deflectExtraWounds: 0, woundsBefore: victim.wounds.current, reveal, resumeAfter: true, ctx: c2,
    } });
    return;
  }
  applyCritAndFinalize(get, set, victim, loc, true, 0, log, c2, victim.wounds.current);
  // 7bis (#316) : un Coup Critique OPPOSÉ (LDB 14 l.3) est une Blessure Critique — le bus émet `onCrit`
  // pour l'attaquant, afin que ses effets de donnée « sur Critique » (Taillade → Hémorragique) s'appliquent
  // ici aussi. Chemin mutuellement exclusif de la déviation (self → émis au Subir de resolveDeviation).
  emitOpposedCrit(get, set, attacker, victim, loc, ctx.weaponObj, log);
}

/** Émet `onCrit` via le bus pour un Critique OPPOSÉ/dévié (7bis, #316) : audience = l'attaquant à l'origine
 *  du double. `sink` → `log` (mêmes lignes que les autres effets déclenchés). No-op sans attaquant en combat. */
function emitOpposedCrit(get: Get, set: SetFn, attacker: Combatant | undefined, victim: Combatant, loc: HitLocation, weaponObj: Weapon | undefined, log: string[]): void {
  if (!attacker) return;
  emitCombatEvent('onCrit', {
    get, set, battle: get().battle!, self: attacker, sink: (line) => log.push(line),
    triggerCtx: { victim, weapon: weaponObj, location: loc, attackType: weaponObj?.type, rng: battleRng() },
  });
}

/** Fabrique de cibles d'aire pour le combat COURANT (terre = rayon métrique à l'échelle de la scène ;
 *  navire = équipage exposé via `crewIds`) — SOURCE UNIQUE de la résolution `crewOf`, partagée par l'aire du
 *  tir individuel (`applyAttackResult`) ET le PILONNAGE INDIRECT (`siegeAimCommit`). Évite la re-duplication. */
export function battleAreaTargets(get: Get): (indice: number) => AreaTargets {
  const battle = get().battle!;
  return areaTargets(battle.combatants, sceneMetresPerTile(get().scene), (ship) => (ship.crewIds ?? []).map((id) => inBattleId(battle, id)).filter((c): c is Combatant => !!c));
}

/** Rayon (cases) de l'aire d'une pièce indirecte servie par `gunner` (munition CHARGÉE prise en compte —
 *  l'Explosion vient de la bombe), à l'échelle de la scène. Sert à dimensionner le placeur de case. */
export function siegeBlastRadiusTiles(gunner: Combatant, weapon: Weapon, scene: Scene | null): number {
  const ammo = gunner.kind === 'hero' ? loadedAmmo(gunner, weapon) : undefined;
  const eff = ammo ? weaponWithAmmo(weapon, ammo) : weapon;
  return blastRadiusTiles(eff, sceneMetresPerTile(scene));
}

/**
 * POUSSE l'étape de SAUVEGARDE « 1d10 ≥ Indice » (#1508) — FABRIQUE UNIQUE des deux chemins de touche
 * (coup physique et Projectile magique) : même étape, même lecture, un seul endroit à changer.
 *
 * AUCUNE gate de possession sur le TIRAGE, comme pour la table d'un Critique : l'étape est poussée pour
 * TOUT porteur (héros, PNJ, démon) et c'est le SOCLE qui décide de la fenêtre — un porteur qu'aucun siège
 * humain ne tient voit son dé résolu D'OFFICE et franchi, visible au bilan.
 *
 * GRAPPE : un seul dé ouvert à la fois (`seuils[0]`), le suivant n'étant poussé par l'applier que si
 * celui-ci a RATÉ (LDB 85 l.98 / l.278 : chaque Trait offre SA sauvegarde, aucune n'est mintée d'avance).
 */
function pousserSauvegarde(set: SetFn, porteurId: string, seuils: SeuilDeSauvegarde[], suite: SauvegardeSuite): void {
  pushDie(set, {
    id: `sauvegarde-${porteurId}`,
    kind: 'sauvegarde',
    label: tr('step.sauvegarde'),
    icon: 'journal/critical',
    spec: { n: 1, sides: 10 },
    actorId: porteurId,
    seuil: seuils[0],
    wardSave: { seuils, suite },
  }, revealPurpose('sequence', false));
}

/**
 * APPLIER de l'étape de SAUVEGARDE (#1508) : le dé est tombé (lancé ou POSÉ). La lecture est celle du
 * socle (`cascade.lireEnSeuil`), qui écrit AUSSI la ligne — un dé jeté s'écrit, qu'il sauve ou non.
 *  - RATÉ et un seuil reste → le dé suivant de la grappe s'ouvre (patron `ouvrirDesDOps`) ;
 *  - sinon → la suite du coup RÉ-ENTRE à son site d'origine avec la sauvegarde décidée, jamais une
 *    application parallèle (patron de l'applier `deviation`, qui rejoue `applyAttackResult`).
 */
registerCascadeApplier('sauvegarde', (get, set, step, porteur) => {
  const ws = step.wardSave;
  if (!ws || !step.de?.result) return;
  // Porteur introuvable = conséquence PERDUE : elle se DIT (patron `opsDe`/`chuteDe`).
  if (!porteur) return { consequences: freeCons([tr('cascade.cibleDisparue', { label: step.label ?? '' })]) };
  const { sauve, ligne } = lireEnSeuil(ws.seuils[0], step.de.result, porteur.label);
  const reste = ws.seuils.slice(1);
  if (!sauve && reste.length) {
    pousserSauvegarde(set, porteur.id, reste, ws.suite);
    return { consequences: freeCons([ligne]) };
  }
  return { consequences: freeCons([ligne, ...reprendreApresSauvegarde(get, set, ws.suite, sauve)]) };
});

/** RÉ-ENTRE dans le site que la sauvegarde avait suspendu, avec son issue. La décision voyage sur la
 *  TOUCHE elle-même (`AttackResult.sauvegarde`, jumeau de `prerolledCrit`) : elle survit ainsi à la
 *  fenêtre SUIVANTE (Déviation Critique), qui repasse par le registre sans rejouer de dé. */
function reprendreApresSauvegarde(get: Get, set: SetFn, suite: SauvegardeSuite, sauve: boolean): string[] {
  if (suite.mode === 'projectile') {
    const appliquee = appliquerToucheDeProjectile(get, set, suite.touche, { sauve });
    // La reprise JOUE ce que l'appelant avait DÉCLARÉ : le rebond relit les PB FRAIS de la cible — un
    // coup IGNORÉ par la sauvegarde (`LDB 85 l.98`) n'a réduit personne, il ne rebondit pas. Une
    // Déviation Critique enchaînée ici le remporte dans SA charge : c'est elle qui le jouera.
    if (appliquee.issue !== 'appliquee') return appliquee.lignes;
    return [...appliquee.lignes, ...jouerLeRebond(get, set, suite.touche)];
  }
  resumeMeleeAfterSuspension(get, set, suite.attackerId, suite.targetId, suite.weapon,
    { ...suite.res, sauvegarde: { sauve } }, suite.deviated, undefined, suite.suite);
  return [];
}

export function applyAttackResult(
  get: Get,
  set: SetFn,
  attacker: Combatant,
  target: Combatant,
  weapon: Weapon,
  res: AttackResult,
  deviated?: boolean,
  prerolledCrit?: CriticalResolved, // « Subir » après déviation : applique CE Critique (déjà montré) sans re-tirer
  // CE QUE L'APPELANT FERA APRÈS CE COUP (#1508) — les drapeaux qui font de ce coup CE coup (Avantage
  // différé du Maniement de deux armes, Empoignade) et ce qui reste à jouer derrière lui (maillon de
  // balayage, attaque gratuite). Donnée d'ENTRÉE : toute fenêtre ouverte ici l'emporte dans sa charge et
  // la rend à la reprise, si bien qu'une fenêtre de plus (sauvegarde PUIS Déviation) ne la perd pas.
  suite?: SuiteDeCoup,
): boolean {
  const deferAttackerAdvantage = suite?.deferAttackerAdvantage;
  const grapple = suite?.grapple;
  // SEAM du télégraphe (#1143) : cette fonction est l'entonnoir UNIQUE de résolution d'une attaque —
  // toutes ses sorties écrivent la ligne de journal du geste, que le bandeau prend alors. Le réticule
  // d'intention n'a donc plus lieu d'être ici, quel que soit le chemin qui a mené à l'application.
  clearActorAim(get, set);
  // Surpris (LDB 16 l.139) : « après la première tentative effectuée pour vous toucher, vous perdez
  // l'État Surpris ». On le retire après une attaque STANDARD (deviated===undefined) — le +20 / l'absence
  // de défense ont déjà joué pour CELLE-CI ; les suivantes n'en bénéficieront plus. Les attaques GRATUITES
  // groupées d'une créature (Morsure+Piétinement, deviated===false) forment UN assaut-surprise : on garde
  // l'État jusqu'à la fin du Round (sinon la 2ᵉ attaque gratuite rouvrirait une défense en plein milieu).
  if (deviated === undefined && hasCondition(target, COND.surpris)) removeCondition(target, COND.surpris, 1);
  // Sauvegardes SYNCHRONES « après la touche » en registre ordonné (state/combat/hitModifiers) :
  // 5 réveil d'un dormeur → 8 Bouclier anti-flèches → 10 sauvegarde « 1d10 ≥ Indice », UNIQUE (traits
  // propres ET Trait octroyé par un Dôme, RNG) → 40 Martyr → 50 Perturbante.
  // Chaque modifier RE-TESTE l'état courant de `res` et le TRANSFORME — ordre encodé par `order`.
  // Un modifier ne suspend RIEN lui-même : il DÉCLARE (`ouvrirSauvegarde`), c'est ICI que l'étape est
  // poussée et la résolution suspendue ; autoKill et l'offre de Déviation Critique restent INLINE
  // ci-dessous. Les saves posent leur ligne dans `res.log` (journalisé par l'`ev(evKind, res.log, …)`
  // final) → `sink` no-op ici. `encaisse` : ce qu'un TIERS a pris (Martyr) — l'interruption de
  // Focalisation du prêtre vit ici, le registre n'important rien de ce module.
  const tiersLog: string[] = [];
  // La SAUVEGARDE « 1d10 ≥ Indice » (LDB 85 l.98 / l.278, LDB 47 l.410) ne se roule plus ici : le registre
  // la DÉCLARE, la porte la joue, et la résolution du coup est SUSPENDUE jusque-là — AUCUNE mutation de la
  // cible avant (ni Empoignade, ni mort-auto, ni Critique), exactement comme la fenêtre de Déviation
  // ci-dessous. L'applier de l'étape RÉ-ENTRE ici avec la décision portée par la touche (`res.sauvegarde`).
  const apresModifiers = runHitModifiers({
    get, set, attacker, target, weapon, res, sink: () => {},
    attaque: weapon.type === 'melee' ? 'melee' : 'ranged',
    encaisse: (c) => { tiersLog.push(...checkFocusInterruption(get, set, c)); },
    ouvrirSauvegarde: (seuils, courant) => {
      pousserSauvegarde(set, target.id, seuils, {
        mode: 'melee', attackerId: attacker.id, targetId: target.id, weapon, res: courant,
        ...(deviated !== undefined ? { deviated } : {}),
        ...(suite ? { suite } : {}),
      });
    },
  });
  res = apresModifiers.res;
  // Un dé déclaré a ARRÊTÉ la chaîne : aucun modifier d'ordre supérieur n'a muté quoi que ce soit. La
  // résolution repart de l'applier 'sauvegarde', qui rejouera la chaîne ENTIÈRE une fois la touche connue.
  if (apresModifiers.suspendu) return true;
  // Empoignade (LDB 14 l.159) : « Au lieu d'infliger des Dégâts ». Sur une touche, on NEUTRALISE Dégâts,
  // Critique et mort-auto de CE coup (les branches Surpris/Engagé/Avantage/journal restent intactes) ; la
  // pose de l'Empoignade + de l'État *Empêtré* se fait après l'Engagement, plus bas.
  if (grapple && res.hit) res = { ...res, woundsLost: 0, critical: false, autoKill: false };
  // Cible Inconsciente — règle optionnelle « mort-auto » (LDB 16 l.113) : en CORPS À CORPS la cible est
  // tuée automatiquement. On applique la mort par le MÊME chemin que les morts normales (`finalizeHeroDeath`
  // → un héros à Destin est suspendu via pendingFateSave, sinon `dead = true`), pas un early-return brutal.
  // Le reste du flux d'attaque (États/Avantage/Critiques) est court-circuité : la cible est hors de combat.
  if (res.hit && res.autoKill) {
    const battle = get().battle!;
    attacker.aiming = false;
    if (weapon.type === 'melee' && !isInanimate(target)) engage(attacker, target); // Engagé symétrique (LDB 13 l.174-175) — jamais avec un objet INANIMÉ
    if (!isInanimate(target)) markAttacked(attacker, target); // trace orientée du Round (LDB 85 l.383, `agressifEnvers`)
    const currentBefore = target.wounds.current;
    target.wounds.current = 0;
    finalizeHeroDeath(get, set, target, 'hit', currentBefore, attacker); // Destin possible (héros) ; sinon mort directe
    if (isOutOfAction(target)) {
      clearEngagementOf(get().battle?.combatants ?? [], target.id);
      clearPsychOf(get().battle?.combatants ?? [], target.id);
      refreshAllDefendedPsych(get().battle?.combatants ?? []); // l’Amour ne se clôt pas à la chute d’UN aimé (l.75) : verdict re-mesuré
    }
    if (attacker.pos && target.pos) {
      set((s: GameState) => ({ facing: { ...s.facing, [attacker.id]: facingToward(attacker.pos!, target.pos!), [target.id]: facingToward(target.pos!, attacker.pos!) } }));
    }
    bus.emit(EVT.ANIM_ATTACK, { from: attacker.id, to: target.id, result: res, kind: 'melee', defense: 'none', weapon, parryWeapon: res.parryWeapon, creatureAttack: creatureAttackKind(weapon) });
    const b = markActed(get, set, battle); // scellé AVANT la copie du journal (le déclencheur y pousse ses lignes)
    const log = [...b.log, ev('attack', tr('cf.finishHelpless', { name: attacker.label, foe: target.label }), attacker.id, target.id)];
    if (isOutOfAction(target)) log.push(ev('death', tr('cf.outOfAction', { name: target.label }), target.id));
    for (const line of notifySlain(get, set, target)) log.push(ev('death', line, target.id)); // effet « à la mort » (banni…) — mort-auto du désespéré
    set({ battle: { ...b, action: null, log } });
    bus.emit(EVT.SCENE_DIRTY);
    checkBattleOver(get, set);
    return false; // application complète (mort-auto) — non suspendu côté cascade d'attaque
  }
  // Déviation Critique (LDB 63 l.30-32) : un HÉROS subit un Coup Critique à une localisation où il
  // porte de la PA → on SUSPEND pour son choix Dévier/Subir (modale). AUCUN effet de bord ici ; la
  // résolution (étape 'deviation', resolveDeviation) rappelle cette fonction avec `deviated` défini (early-return sauté →
  // application UNE seule fois). Les sous-attaques (balayage/Piétinement) passent `deviated` explicite
  // pour résoudre instantanément (pas de modale imbriquée). Les sorts (applyCast) gèrent leurs Critiques
  // à part : ils n'atteignent jamais cette fonction, donc pas de garde « arme » nécessaire.
  // #80 (LDB 18 l.55) : un Coup Critique RE-TIRE sa localisation, et « TOUTE la résolution du coup — Dégâts
  // non-critiques, DÉVIATION, armure Bâclée, table de Critiques — utilise CETTE localisation ». L'éligibilité
  // #43.2 à la Déviation (LDB 63 l.30, « emplacement protégé par une armure ») se teste donc sur la
  // localisation RE-TIRÉE du Critique — là où `deflectCrit` sacrifiera le PA — et NON sur la localisation de
  // touche, sinon on offrirait au héros une Déviation sans PA sacrifiable à la zone réellement frappée. Figée
  // ici (réutilisée sans re-tirer par la reprise Dévier/Subir). RNG-neutre : le tirage est seulement AVANCÉ
  // (aucun `battleRng` intercalé jusqu'à son point d'origine, au bloc Critique ci-dessous).
  // Blessure Critique = Coup Critique sur double OU dépassement (LDB 18 l.53) — la Déviation couvre LES DEUX
  // (LDB 63 l.30). `overkill0` = PB COURANTS dépassés par les Dégâts de base (avant re-localisation du Critique).
  const overkill0 = Math.max(0, (res.woundsLost ?? 0) - target.wounds.current);
  const dloc = (res.critical && deviated === undefined && target.kind === 'hero')
    ? (res.critLocation ??= critWoundLocation(battleRng(), target.bodyShape))
    : (res.location ?? 'corps'); // dépassement (≠ double) : loc de touche, pas de re-tirage
  // UNE SEULE FENÊTRE pour la Blessure critique (#1426) : le d100 de SÉVÉRITÉ (LDB 18) et la décision
  // Dévier/Subir (LDB 63 l.30) sont la MÊME étape — le dé se lance (ou se pose, option « Dés fixés »),
  // le Critique tiré s'affiche, les voies se tranchent dessous. La résolution du coup est SUSPENDUE
  // jusque-là (aucune mutation de la cible ici) ; l'applier ré-entre avec le Critique construit
  // (`prerolledCrit`), d'où la garde `!prerolledCrit` — une seule fenêtre par coup.
  //
  // AUCUNE gate de possession sur le TIRAGE : dès qu'une table est à jouer, l'étape est poussée pour
  // TOUT porteur, et c'est le SOCLE qui décide de la fenêtre au rang du curseur — un porteur qu'aucun
  // siège humain ne tient voit sa table résolue D'OFFICE et franchie (`cascade.poserLeCurseur`),
  // visible au bilan. Même code pour une table de personnage et une table de monde.
  // La DÉCISION Dévier/Subir, elle, est gatée — parce que le RAW en fait un CHOIX du porteur (LDB 63
  // l.30) : sans humain pour le tenir, l'automate tranche AVANT toute poussée (`autoDeviate` ci-dessous),
  // sinon le dé de sévérité serait tiré puis jeté. Le prédicat de cette gate est celui de la TENUE
  // (`tenuParUnHumain`), le même qui décide si les voies sont OFFERTES : une seule table de vérité.
  //
  // `critSeverityInSeam` borne la DÉCLARATION de table au périmètre du seam et de la bifurcation du
  // moteur : sous la variante Aux Armes (hors Sauvagerie) la sévérité se résout sur les tables AA, qui
  // ne sont pas déclarées en étapes — l'étape n'y porte alors QUE la décision, sur un Critique tiré au
  // mint. Coque/Structure ont leurs propres tables (non déclarées ici) → aucune étape ici.
  const twice = critRollTwiceFor(attacker);
  if (deviated === undefined && !prerolledCrit && res.hit && res.woundsLost && (res.critical || overkill0 > 0)
      && !isStructure(target) && target.bodyShape !== 'vehicule') {
    const cloc = res.critical ? critWoundLocation(battleRng(), target.bodyShape, res.critLocation) : dloc;
    if (res.critical) res.critLocation = cloc; // LDB 18 l.55 (#80) : loc FIGÉE avant la suspension (jamais re-tirée)
    // UN SEUL PRÉDICAT (#1426) : la Déviation appartient à la VICTIME (« Cela ne se produit que si vous
    // le choisissez », LDB 63 l.30) → un porteur TENU par un siège humain reçoit l'étape Dévier/Subir,
    // quel que soit son kind ; un porteur que personne ne tient voit l'AUTOMATE trancher (`autoDeviate`
    // plus bas) sans jamais consulter le Tableau des Critiques — sa décision se prend AVANT toute
    // poussée, sinon le dé de sévérité serait tiré puis jeté (`applyCritAndFinalize` est sauté quand la
    // déviation a eu lieu). `tenuParUnHumain` est SEAT-AGNOSTIQUE (le MJ tient ses ennemis) et
    // cadence-AGNOSTIQUE : en Rapide/Auto l'étape s'ouvre et se tranche à son `defaultChoice`.
    const deviable = !!rule('combat-critical-deflect') && deviatableArmourAt(target, cloc) > 0;
    const tenu = tenuParUnHumain(get(), target.id);
    if (!(deviable && !tenu)) {
      const offerte = deviable && tenu;
      if (critSeverityInSeam(twice)) {
        pushDeviationStep(set, {
          targetId: target.id, offerte,
          severite: {
            decl: critSeverityDecl(target, cloc, overkill0, twice),
            charge: { attackerId: attacker.id, targetId: target.id, weapon, res, location: cloc, overkill: overkill0, twice, ...(suite ? { suite } : {}) },
            label: stepPrecision(tr('step.blessureCritique'), locationLabel(cloc, target.bodyShape)),
          },
        });
        return true; // suspendu — la résolution part de l'applier 'deviation'
      }
      if (offerte) {
        // Aucune table déclarée pour ce cas (variante Aux Armes) : le Critique est tiré au mint par le
        // seam UNIQUE et voyage dans la charge — la décision se prend quand même devant lui.
        const crit = resolveCritSeverity(target, cloc, overkill0, twice).crit;
        const reveal = previewCritEntry(target, crit, { attackerId: attacker.id, weapon: weapon?.label });
        pushDeviationStep(set, {
          targetId: target.id, offerte: true,
          pretire: { mode: 'melee', attackerId: attacker.id, targetId: target.id, weapon, res, crit, reveal, resumeAfter: true, ...(suite ? { suite } : {}) },
        });
        return true; // suspendu — la résolution part de l'applier 'deviation'
      }
    }
  }
  const battle = get().battle!;
  attacker.aiming = false; // l'attaque consomme la visée (tir : +20 déjà appliqué ; mêlée : visée gâchée)
  if (attacker.nextActionPenalty) attacker.nextActionPenalty = undefined; // pénalité de Maladresse consommée par ce Test

  if (weapon.type === 'melee' && !isInanimate(target)) engage(attacker, target); // Engagé symétrique sur toute attaque de mêlée (LDB 13 l.169-171) — jamais avec un objet INANIMÉ
  if (!isInanimate(target)) markAttacked(attacker, target); // trace orientée du Round (LDB 85 l.383, `agressifEnvers`) — tir compris
  const critLog: string[] = [...tiersLog];
  // Avantage de l'attaquant (LDB 13 l.123, étape « 1 : Lancer pour Toucher ») — crédité AVANT le bloc
  // Critique (LDB 13 l.177, après les étapes 2 et 3) : un déclencheur `onCrit` lit ainsi la MÊME réserve
  // que `onHit`, et l'offre à X Avantages qu'il pose (Taillade, AA 08 l.87) est abordable comme le store
  // l'entend à l'application (`spendableAdvantage` reste l'unique source des deux verdicts).
  if (res.advantageTo === 'attacker' && !deferAttackerAdvantage) {
    // Renversement : « au lieu de gagner +1, prendre l'Avantage adverse ». LDB 10 → tout l'Avantage
    // individuel de la cible (quand c'est mieux que +1) ; variante « Avantage de groupe » (AA 13 l.92-98) →
    // 1 dans la réserve adverse. Sinon +1 au vainqueur du Test opposé (per-combattant OU réserve du camp).
    if (weapon.type === 'melee' && stealsOneAdvantage(attacker)) {
      if (reversalStealOne(get, attacker, target)) critLog.push(tr('cf.reversal', { name: attacker.label }));
    } else if (weapon.type === 'melee' && hasStealAdvantage(attacker) && (target.advantage ?? 0) > 1) {
      gainAdvantage(attacker, target.advantage);
      target.advantage = 0;
      critLog.push(tr('cf.reversal', { name: attacker.label }));
    } else campGain(get, attacker);
    attacker.gainedAdvThisRound = true;
  }
  // Empoignade (LDB 14 l.159) : « vous ET votre adversaire êtes Empoignés, et votre adversaire gagne
  // l'État *Empêtré* ». Pose APRÈS l'Engagement (les deux Empoignés) ; le bloc de Dégâts ci-dessous est
  // inerte (woundsLost neutralisé plus haut). RAW : pas de Dégâts sur l'initiation.
  if (grapple && res.hit) {
    // VOIE UNIQUE d'initiation, en DONNÉE : `GRAPPLE.init` pose l'*Empêtré* ET la relation (op `condition
    // {grapple:true}`) — mêmes effets qu'avant, mais éditables, partagés avec Constricteur/Tentacules/Langue.
    applyOps(target, GRAPPLE.init, { caster: attacker, source: GRAPPLE_SOURCE });
    critLog.push(tr('cf.grappleInit', { name: attacker.label, foe: target.label }));
  }
  if (res.hit && res.woundsLost && isStructure(target)) {
    // STRUCTURE de siège (AA 10 l.105/114) : modèle DISTINCT du personnage — pas de Localisation, d'À Terre, de
    // Déviation d'armure ni de Trauma humain. Les Blessures sont déjà mitigées par `woundsFromHit` (Siège
    // ×2 / Résistant-Impénétrable-Bélier → 0). Un double qui retire AUSSI ≥25 % des Blessures RESTANTES
    // déclenche un Critique de Structure ; la chute à 0 Blessure devient une BRÈCHE (posée par
    // `collapseStructure` à la clôture, hors clobber du `set` final).
    const before = target.wounds.current;
    target.wounds.current = Math.max(0, before - res.woundsLost);
    if (res.critical && before > 0 && res.woundsLost >= before * 0.25 && target.wounds.current > 0)
      applyStructureCriticalToTarget(set, target, { attackerId: attacker.id, attackerKind: attacker.kind, weapon: weapon?.label }, critLog);
  } else if (res.hit && res.woundsLost) {
    // LDB 18 l.53-55 : un Coup Critique RE-TIRE la localisation (1d100 frais, ou choix RAW-2 « Je ne
    // faillirai pas ! », ou Critique déjà pré-tiré pour la Déviation) ; TOUTE la résolution du coup — Dégâts
    // NON-critiques (+ PA), Déviation, armure Bâclée, table de Critiques — utilise CETTE localisation. On la
    // fige sur `res` (location + critLocation) pour que l'aval (deflectCrit/autoDeviate/breakBacleArmour/
    // applyCritAndFinalize) la lise, puis on RECALCULE les Blessures de base à cette localisation
    // (`woundsAtCritLocation`). L'overkill (≠ Coup Critique) garde la localisation de la touche.
    if (res.critical) {
      const fresh = critWoundLocation(battleRng(), target.bodyShape, prerolledCrit?.location ?? res.critLocation);
      res.critLocation = fresh;
      res.location = fresh;
      res.woundsLost = woundsAtCritLocation(res, weapon, target, fresh);
    }
    const currentBefore = target.wounds.current;
    const overkill = res.woundsLost - currentBefore; // > 0 si le coup dépasse les PB COURANTS (LDB 18 l.30)
    target.wounds.current = Math.max(0, currentBefore - res.woundsLost);
    const loc = res.location ?? 'corps';
    // Réouverture d'une plaie critique (LDB 18 / AA 07) : un nouveau Dégât à CETTE Localisation octroie ses
    // États Hémorragique (la plaie qui l'a posée est stampée APRÈS ce coup, elle ne se déclenche donc pas
    // elle-même). Point d'application des Dégâts localisés — jumeau du Projectile magique (appliquerTouchePourCible).
    const reinj = reinjuryBleed(target, loc);
    if (reinj > 0) { addCondition(target, COND.hemorragique, reinj); critLog.push(tr('cf.reinjuryBleed', { name: target.label, n: reinj, loc: locationLabel(loc, target.bodyShape) })); }
    if (res.critical) breakBacleArmour(target, loc, critLog); // armure Bâclée brisée par le Critique (LDB 60 l.50)
    // Blessures supplémentaires d'une Déviation (Dégâts recalculés à PA−1, LDB 63 l.30) : la PA n'est pas
    // encore sacrifiée ici (deflectCrit/autoDeviate le font) → on recompute woundsFromHit à PA−1
    // (`extraAP:-1`) et on isole le DELTA par rapport aux Blessures de base déjà appliquées.
    const extra = Math.max(0, woundsFromHit(weapon, target, loc, res.damage ?? 0, -1, 1, attacker.size) - (res.woundsLost ?? 0));
    // Déviation (LDB 63 l.30-32), MÊME prédicat qu'à la fenêtre ci-dessus : un porteur que personne ne
    // tient voit l'automate trancher (`autoDeviate`, rule-gated) ; un porteur TENU a déjà eu son étape et
    // ne dévie que s'il l'a CHOISI (deviated===true, `deflectCrit`) — un « Subir » du MJ sur son propre
    // ennemi est donc respecté. Sacrifient 1 PA puis ajoutent `extra`.
    let deviationApplied = false;
    if (res.critical || overkill > 0) {
      if (!tenuParUnHumain(get(), target.id))
        deviationApplied = autoDeviate(set, target, loc, extra, { attackerId: attacker.id, weapon: weapon?.label }, prerolledCrit?.roll ?? res.attackerRoll, critLog, attacker.kind === 'hero');
      else if (deviated === true)
        deviationApplied = deflectCrit(target, loc, extra, critLog);
    }
    if (!deviationApplied && (res.critical || overkill > 0)) {
      // « Subir » après déviation proposée : applique LA Blessure Critique déjà montrée (prerolledCrit), sans
      // re-tirer ni re-révéler (la modale l'a affichée). Sinon : tirage + révélation normaux. Le pré-tiré qui
      // arrive AVEC `deviated === undefined` vient de la fenêtre de pose du dé (#942 L4) : il n'a été montré
      // par AUCUNE modale → sa révélation reste due.
      const lethal = applyCritAndFinalize(get, set, target, loc, !!res.critical, Math.max(0, overkill), critLog, { attackerId: attacker.id, attackerKind: attacker.kind, weapon: weapon?.label, critTwice: critRollTwiceFor(attacker) }, currentBefore, prerolledCrit, !!prerolledCrit && deviated !== undefined);
      // Frappe blessante (LDB 10) : +niveau Blessures quand on inflige une Blessure Critique.
      const fb = talentCritExtraWounds(attacker);
      if (fb > 0 && !lethal) {
        target.wounds.current = Math.max(0, target.wounds.current - fb);
        critLog.push(tr('cf.woundingStrike', { name: target.label, n: fb }));
      }
      // Effets « sur Critique » (Taillade → Hémorragique, Aux Armes p.89, et tout futur Trait/Talent/Atout/État)
      // — DISPATCHER UNIQUE générique (data-driven `effects:[{trigger:'onCrit'}]`), comme `onHit`. Plus de
      // boucle bespoke par capacité. (`woundingStrike`/`onCrit` restent dans la branche Subir uniquement.)
      if (res.critical && !lethal)
        emitCombatEvent('onCrit', { get, set, battle, self: attacker, sink: (line) => critLog.push(line), triggerCtx: { victim: target, weapon, location: loc, woundsDealt: res.woundsLost, attackType: weapon.type, rng: battleRng() } });
    }
    // Premier sang (#471) mesuré ICI, au point où le COUP est intégralement finalisé (Blessures de base +
    // Blessure Critique/Déviation ajoutées par `applyCritAndFinalize` + Frappe blessante `fb`) — pas juste
    // les Blessures de base : un coup 2 base + 2 Critique = 4 doit déclencher le seuil au même titre qu'un
    // coup non-critique de 4. UN seul appel (celui d'avant, sur la perte de base seule, est supprimé).
    resolveFirstBlood(target, battle.victoryCondition, currentBefore - target.wounds.current, critLog);
    // 0 PB → À Terre (LDB 18 l.15) : TOUJOURS quand on tombe à 0, EN PLUS du Critique éventuel (l'overkill
    // déclenche une Blessure critique mais ne dispense pas de l'État À Terre) ; sauf si déjà KO/mort.
    if (target.wounds.current <= 0 && !target.dead && !hasCondition(target, COND.inconscient)) applyZeroWounds(target);
    // Cible neutralisée → on ne reste pas Engagé avec elle (LDB 13) : on lève ses liens immédiatement
    // (sinon ils persisteraient jusqu'au franchissement de Round, bloquant Charge/déplacement libre).
    // Et ses effets PSYCHOLOGIQUES (Peur/Terreur/traits ciblés) prennent fin : on les retire des autres.
    if (isOutOfAction(target)) {
      clearEngagementOf(get().battle?.combatants ?? [], target.id);
      clearPsychOf(get().battle?.combatants ?? [], target.id);
      refreshAllDefendedPsych(get().battle?.combatants ?? []); // l’Amour ne se clôt pas à la chute d’UN aimé (l.75) : verdict re-mesuré
    }
  }
  // Critiques du Test opposé (LDB 14 l.3) : « Si vous obtenez un Critique, votre adversaire reçoit
  // immédiatement une Blessure critique […] le DR est calculé comme d'habitude, tout comme la
  // détermination du vainqueur. » Un double RÉUSSI inflige donc un Critique même sans gagner l'échange.
  // (Pas de garde `deviated` : une 1ʳᵉ entrée qui SUSPEND (déviation) fait son early-return AVANT ce
  // bloc — la reprise « Dévier »/« Subir » l'exécute donc UNE seule fois, comme les sous-attaques.)
  if (weapon.type === 'melee' && res.defenderDetail) {
    const ad = res.attackerDetail;
    const dd = res.defenderDetail;
    // (a) Attaquant : Critique au jet mais échange PERDU (pas de touche) → le défenseur subit un Critique sec.
    if (ad && ad.success && isDoubleRoll(ad.roll) && !res.hit && !isOutOfAction(target)) {
      critLog.push(tr('cf.critDespiteLoss', { name: attacker.label }));
      applyOpposedCritical(get, set, target, ad.roll, { attackerId: attacker.id, weapon: weapon?.label, weaponObj: weapon }, critLog);
    }
    // (b) Défenseur : Critique sur sa défense → l'attaquant subit un Critique sec — UNIQUEMENT en PARADE
    // (« Test de Corps à corps », LDB 13 l.183) ; l'Esquive est un Test d'AGILITÉ → ne génère PAS de Critique.
    // `res.parryWeapon` n'est posé qu'en Parade (finishMelee). Un HÉROS qui PARE avec une arme Piège-lame face
    // à une lame peut choisir de PIÉGER à la place (LDB 62 l.278) → étape de séquence.
    if (dd.success && isDoubleRoll(dd.roll) && !isOutOfAction(attacker) && res.parryWeapon) {
      if (target.kind === 'hero' && res.parryWeapon && hasBladeTrap(res.parryWeapon) && weaponHasBlade(weapon)) {
        // Folding P3b : le choix Piéger/Critique devient une ÉTAPE de la séquence (texte + options),
        // au lieu d'une modale `pendingBladeTrap` séparée. L'applier 'bladeTrap' appelle resolveBladeTrap.
        const pbt: PendingBladeTrap = { defenderId: target.id, attackerId: attacker.id, weapon, parryWeaponUid: res.parryWeapon.uid!, defSL: dd.sl, roll: dd.roll };
        pushChoice(set, {
          id: `cons-bladetrap-${target.id}`, kind: 'bladeTrap', actorId: target.id, icon: 'item/weapon',
          label: tr('step.paradePiegerLame'),
          options: [{ key: 'trap', label: tr('opt.piegerLame') }, { key: 'crit', label: tr('opt.coupCritique') }],
          defaultChoice: 'crit', bladeTrap: pbt,
          outcome: toRecapLines([
            `${target.label} place un Critique en parant avec ${res.parryWeapon.label} — la lame de ${attacker.label} (${weapon.label}) est à portée.`,
            `Piéger : Test opposé de Force (+${dd.sl} DR). Succès → ${attacker.label} lâche sa lame (Stupéfiant → brisée).`,
          ]),
        });
      } else {
        critLog.push(tr('cf.critOnDefense', { name: target.label }));
        applyOpposedCritical(get, set, attacker, dd.roll, { attackerId: target.id, weapon: res.parryWeapon?.label, weaponObj: res.parryWeapon }, critLog);
      }
    }
  }
  // Contre-attaque sur Test opposé de défense GAGNÉ en mêlée (Champion LDB 85 « cause autant de Dégâts
  // que si elle était l'attaquant » ; Riposte LDB 10 avec arme Rapide). « Qui peut contrer » lu en DONNÉES
  // (`canCounterOnDefenseWin` → capacité générique `counterOnDefenseWin`) ; la RÉSOLUTION (frappe avec le
  // jet de défense gagnant) reste machinerie (règle universelle).
  if (weapon.type === 'melee' && res.advantageTo === 'defender' && res.netSL > 0
      && canCounterOnDefenseWin(target, res.parryWeapon)
      && !isOutOfAction(target) && target.weapons[0]) {
    // La cible de cette frappe EST celle du jet de défense gagnant : les modificateurs à annoncer sont
    // donc ceux de la DÉFENSE (`defenderDetail`), pas ceux d'une attaque que personne n'a roulée.
    const riposte = resolveMeleePassive(target, attacker, target.weapons[0],
      { roll: res.defenderRoll ?? 1, target: res.defenderDetail?.target ?? 1, success: true, sl: res.netSL, isDouble: false },
      undefined, [], undefined, false, frozenDifficulty(res.defenderDetail));
    if (riposte.hit && riposte.woundsLost) {
      const before = attacker.wounds.current;
      attacker.wounds.current = Math.max(0, before - riposte.woundsLost);
      critLog.push(tr('cf.riposte', { name: target.label, n: riposte.woundsLost }));
      if (attacker.wounds.current <= 0 && !attacker.dead && !hasCondition(attacker, COND.inconscient)) applyZeroWounds(attacker);
      if (isOutOfAction(attacker)) {
        clearEngagementOf(get().battle?.combatants ?? [], attacker.id);
        clearPsychOf(get().battle?.combatants ?? [], attacker.id);
      refreshAllDefendedPsych(get().battle?.combatants ?? []); // l’Amour ne se clôt pas à la chute d’UN aimé (l.75) : verdict re-mesuré
      }
    }
  }
  // Exposition aux Maladies (Infecté/Rongeur/Maladie (Type) ; munition Infecté) MIGRÉE en données :
  // `effects: onHit → if woundsDealt>0 → exposeDisease(<id>)` sur les traits/qualité de l'ATTAQUANT,
  // dispatchés par le `fireTriggers('onHit')` ci-dessous. Op GÉNÉRIQUE unique, paramétrée par l'id de maladie.
  // Le bilan reste héros-only : exposer un non-héros est inerte. (LDB 20 l.25/51 ; LDB 85 l.187/225.)
  // Nausée (LDB 20 l.170) : un Test de DÉPLACEMENT raté (Esquive) fait vomir → État Sonné.
  if (res.defenderDetail?.mode === 'esquive' && !res.defenderDetail.success
      && hasActiveCapability(target, 'nausea') && !hasCondition(target, COND.sonne)) {
    addCondition(target, COND.sonne);
    critLog.push(tr('cf.vomitStun', { name: target.label }));
  }
  // Effet DÉCLENCHÉ « à la perte de PB » authoré (Sang corrosif : 1d10 aux Engagés, BE+PA, min 1, sur
  // TOUTE Blessure subie — LDB 85 l.310 ; Démoniaque : banni à 0 PB — `if woundsCurrent<=0`). Le TYPE
  // d'attaque (`weapon.type`) voyage dans le contexte ; un effet peut s'y restreindre (`attackType`).
  // Dispatcher générique (state/triggeredEffects) : l'effet est authoré en donnée sur l'entité.
  if (res.hit && res.woundsLost) {
    emitCombatEvent('onWoundLoss', { get, set, battle, self: target, sink: (line) => critLog.push(line), triggerCtx: { rng: battleRng(), attackType: weapon.type, woundsDealt: res.woundsLost } });
    // Chanson de marin (MDG 09 l.38) : « Si le Personnage subit des Dégâts …, sa Chanson de marin prend fin. »
    if (target.singingShanty) critLog.push(...endShanty(get, target));
  }
  // Effet déclenché « à la mise hors de combat d'un adversaire » authoré (Affamé : Test de FM ou
  // festoie — perd Action + Mouvement) — dispatcher générique (state/triggeredEffects).
  if (res.hit && isOutOfAction(target) && !isOutOfAction(attacker)) {
    emitCombatEvent('onKill', { get, set, battle, self: attacker, sink: (line) => critLog.push(line), triggerCtx: { rng: battleRng() } });
  }
  // Effet « à la mort » du SLAIN lui-même (Démoniaque banni…) — pour TOUT chemin de mort de cette
  // résolution : la CIBLE (touche, Critique létal, 0 PB) ET l'ATTAQUANT (Critique défensif opposé qui le
  // tue PENDANT sa charge). Émis une fois (garde `slainNotified`).
  for (const c of [target, attacker]) critLog.push(...notifySlain(get, set, c));
  // Taille (arme) : sur une touche réussie, endommage de 1 PA l'armure frappée (LDB 62 l.307).
  if (res.hit && hasQuality(weapon, 'taille')) damageArmour(target, res.location ?? 'corps');
  // Munition du coup : CELLE QUI ÉTAIT DANS L'ARME (`loadedAmmo`), lue AVANT que le tir ne décharge.
  const firedAmmo = weapon.type === 'ranged' && attacker.kind === 'hero' ? loadedAmmo(attacker, weapon) : undefined;
  // Tir avec une arme à Recharge → DÉCHARGÉE après le coup (LDB 62 l.335) : un Test étendu de Projectiles est
  // requis avant de retirer. Vaut pour TOUT tireur (héros ET ennemi) — parité du cycle de Rechargement (#126) ;
  // aucun état ni chemin parallèle pour l'IA.
  if (weapon.type === 'ranged' && (weapon.reload ?? 0) > 0) {
    // À répétition (Indice) (LDB 62 l.229/231) : Indice munitions auto-rechargées entre les coups ; le
    // rechargement complet (Test étendu) n'est exigé qu'une fois le chargeur vide. Écrivains UNIQUES.
    if (!spendChamberedRound(attacker, weapon)) {
      // Couture UNIQUE : le registre de CE coup — l'arme tirée, ou la PIÈCE si c'est elle qu'il a servie.
      unloadWeapon(attacker, weapon, attacker.mannedPoste?.item.uid === weapon.uid ? attacker.mannedPoste : undefined);
    }
  }
  // Munition + Salve : suivi HÉROS-only (les ennemis ne comptabilisent pas de munitions, #126). `consumeAmmo` =
  // source unique du décrément (stock du poste servi OU inventaire).
  if (weapon.type === 'ranged' && attacker.kind === 'hero') {
    attacker.shotsThisTurn = (attacker.shotsThisTurn ?? 0) + 1; // Salve : compteur de tirs du tour (−10 cumulatif)
    if (firedAmmo) consumeAmmo(attacker, firedAmmo);
  }
  // Interruption du rechargement (LDB 62 l.335) : tout tireur touché en plein rechargement recommence à
  // zéro — sur le REGISTRE de chacune de ses armes (l'objet possédé porte la progression), pièce servie
  // comprise, sinon la remise à zéro s'écrit sur une copie que personne ne relit.
  if (res.hit && res.woundsLost) {
    for (const w of target.weapons ?? []) if (reloadProgressOf(target, w) > 0) setReloadProgress(target, w, 0);
    if ((target.mannedPoste?.reloadProgress ?? 0) > 0) setReloadProgress(target, undefined, 0, target.mannedPoste);
  }
  // Avantage (LDB Déplacement l.30-40) : +1 au défenseur vainqueur du Test opposé ; perte de TOUT
  // l'Avantage en échouant un Test opposé ou en perdant une Blessure.
  if (res.advantageTo === 'defender') {
    // Renversement côté défenseur (même règle qu'à l'attaque : voler l'Avantage adverse, ou +1).
    if (weapon.type === 'melee' && stealsOneAdvantage(target)) {
      if (reversalStealOne(get, target, attacker)) critLog.push(tr('cf.reversal', { name: target.label }));
    } else if (weapon.type === 'melee' && hasStealAdvantage(target) && (attacker.advantage ?? 0) > 1) {
      gainAdvantage(target, attacker.advantage);
      critLog.push(tr('cf.reversal', { name: target.label }));
    } else campGain(get, target);
    target.gainedAdvThisRound = true;
    if (!groupAdvantage()) attacker.advantage = 0; // l'attaquant a échoué au Test opposé (LDB ; pas de perte per-combattant en mode groupe)
  }
  if (res.hit && res.woundsLost && !groupAdvantage()) target.advantage = 0; // perdre une Blessure → perte de tout Avantage (LDB ; inerte en mode groupe)
  // Porte-Bouclier (LDB 10 l.972, VERBATIM) : « vous gagnez [niveau] Avantages SI VOUS PERDEZ le Test opposé »
  // en vous défendant au Bouclier — consolation d'une « situation désespérée », APRÈS la perte d'Avantage due
  // à la Blessure / au Test perdu. Défense PERDUE = l'attaquant a gagné (`advantageTo === 'attacker'`) et le
  // défenseur a paré au Bouclier (`res.parryWeapon`). Variante groupe AA → `shieldAdvantageLevel` = 0.
  if (res.advantageTo === 'attacker') {
    const shieldAdv = shieldAdvantageLevel(target, res.parryWeapon);
    if (shieldAdv) { campGain(get, target, shieldAdv); target.gainedAdvThisRound = true; }
  }
  const kind = weapon.type === 'ranged' ? 'ranged' : 'melee';
  const defense = weapon.type === 'ranged' ? 'none' : bestDefenseMode(target);
  // Orientation : l'attaquant se tourne vers la cible, le défenseur vers l'attaquant (frappe offensive).
  if (attacker.pos && target.pos) {
    set((s: GameState) => ({ facing: { ...s.facing, [attacker.id]: facingToward(attacker.pos!, target.pos!), [target.id]: facingToward(target.pos!, attacker.pos!) } }));
  }
  // `weapon`/`parryWeapon` voyagent dans l'événement : le rig joue le geste de l'arme EMPLOYÉE
  // (2e frappe de dague gauche, tentacule…) et la parade de l'arme QUI A PARÉ (main-gauche,
  // bouclier) — pas ceux de l'arme principale.
  bus.emit(EVT.ANIM_ATTACK, { from: attacker.id, to: target.id, result: res, kind, defense, weapon, parryWeapon: res.parryWeapon, creatureAttack: creatureAttackKind(weapon) });
  const evKind: CombatEventKind = weapon.type === 'ranged' ? 'shoot' : 'attack';
  const log = [...battle.log, ev(evKind, res.log, attacker.id, target.id)];
  // Dispersion (LDB 14 l.144-151) : une arme de JET (Portée `{bf}`) dont le Test de Projectiles (Lancer)
  // ÉCHOUE dévie vers une tuile (1d10 direction / 9 = pieds du lanceur / 10 = pieds de la cible, 2d10 m
  // plafonnés à la demi-distance). Le jeu ne modélise pas l'arme au sol → l'effet visible RAW = la tuile
  // d'atterrissage (floater FX + journal). Les tirs à Portée FIXE (arc/arbalète/poudre) ratent sans dévier.
  if (!res.hit && isThrownWeapon(weapon) && attacker.pos && target.pos) {
    const land = scatter(attacker.pos, target.pos, battleRng(), sceneMetresPerTile(get().scene), get().scene?.dimensions);
    bus.emit(EVT.ANIM_FLOAT, { pos: land, text: tr('cf.scatterFloat'), kind: 'miss' });
    log.push(ev(evKind, tr('cf.scatter', { name: attacker.label }), attacker.id, target.id));
  }
  log.push(...evLines(critLog, 'crit', attacker.id, target.id));
  // Nerveux (LDB 85 l.249) : « facilement effrayée par […] les bruits forts » — un coup d'arme à
  // feu (Poudre noire/Explosion) terrifie les créatures Nerveuses présentes : +3 État Brisé.
  if (weapon.type === 'ranged' && isFirearmQuality(weapon)) {
    for (const c of battle.combatants) {
      // Nerveux (effet déclenché onStartled : +3 Brisé) — fired par le dispatcher générique (no-op si absent).
      // Cause 'noise' (bruits forts) → exemption Dressé (Guerre) lue par la Condition Flow `startleCause`.
      if (!isOutOfAction(c)) emitCombatEvent('onStartled', { get, set, battle, self: c, sink: (line) => log.push(ev('condition', line, c.id)), triggerCtx: { startleCause: 'noise' } });
    }
  }
  // Effets DÉCLENCHÉS « à la touche » authorés (donnée éditable) : Traits de l'attaquant (Toile, Venin…),
  // Atouts de l'arme (Assommante, Immobilisante…) et Enchantements actifs — agrégés et appliqués par UN
  // dispatcher générique (state/triggeredEffects). `location` (Assommante Tête) et `woundsDealt` (Venin
  // sur PB) alimentent les Conditions Flow de gating.
  if (res.hit) emitCombatEvent('onHit', { get, set, battle, self: attacker, sink: (line) => log.push(ev('condition', line, target.id)), triggerCtx: { victim: target, weapon, woundsDealt: res.woundsLost, margin: res.netSL, location: res.location, attackKind: creatureAttackKind(weapon), attackType: weapon.type, rng: battleRng() } });
  // Combat de masse (ADE II 08 l.139/145) : une Scène de COMBAT compte les touches des PJ sur l'ennemi
  // (−1/touche) ; no-op hors bataille de masse. Réduction PUIS résolue à la victoire (massBattleResumeCombat).
  if (res.hit) massBattleTrackHit(get, set, attacker, target);
  // Munitions/armes à AIRE (Tir de zone / Explosion) — résolveur UNIQUE partagé avec la bordée navale
  // (`combatArea.resolveWeaponArea`). Bande de portée + rayon en mètres convertis à l'échelle de la scène ;
  // les États « infligés par l'arme » sont propagés par le chemin GÉNÉRIQUE onHit (cf. `hitSecondary`).
  if (res.hit && weapon.type === 'ranged' && res.damage != null && attacker.pos && target.pos && !isOutOfAction(target)) {
    const area = resolveWeaponArea(get, set, {
      attacker, primaryTarget: target, weapon, damage: res.damage, location: res.location ?? 'corps', distanceTiles: combatDistance(attacker, target), margin: res.netSL,
    }, battleAreaTargets(get), battleRng());
    log.push(...evLines(area.lines, 'shoot', attacker.id, target.id));
  }
  // Interruption de Focalisation (LDB 46 l.144) : Dégâts subis pendant qu'on focalise
  // → Test de Calme Difficile (−20) ou perte des DR accumulés + Imparfaite Mineure.
  if (res.hit && res.woundsLost) log.push(...evLines(checkFocusInterruption(get, set, target), 'detail', target.id));
  if (isOutOfAction(target) && !isStructure(target)) log.push(ev('death', tr('cf.outOfAction', { name: target.label }), target.id)); // structure → ligne d'Effondrement (collapseStructure), pas « hors de combat »
  // Salve (Aux Armes p.126) : un héros qui tire une arme à Salve gardant des tirs (chambered > 0) ne
  // consomme PAS son Action — il peut tirer encore ce tour (chaque tir suivant à −10 cumulatif).
  const salvoContinues = attacker.kind === 'hero' && weapon.type === 'ranged' && hasQuality(weapon, 'salve') && (loadRegister(attacker, weapon).chambered ?? 0) > 0;
  // Lignes de journal différées par un hook profond (ex. `onGainCondition` ennemi/auto déclenché plus
  // haut dans cette résolution) → foldées dans le MÊME `log` réécrit, avant que ce `set` ne le clobbere.
  // Effet déclenché « après résolution de l'attaque » (touche OU raté) — dispatcher générique via le bus.
  // Point d'émission = fin de résolution d'attaque (LDB 14, Test de combat résolu). Inerte sans donnée.
  emitCombatEvent('onAttackResolved', { get, set, battle, self: attacker, sink: (line) => log.push(ev('condition', line, target.id)), triggerCtx: { victim: target, weapon, woundsDealt: res.woundsLost, margin: res.netSL, location: res.location, attackKind: creatureAttackKind(weapon), attackType: weapon.type, rng: battleRng() } });
  // SEAM `onOwnTestFailed` (MSRC 16 — Crampes) : le PORTEUR qui ÉCHOUE son PROPRE Test réagit. Une passe
  // d'armes porte DEUX Tests du porteur : (a) l'ATTAQUANT rate son jet d'attaque CC/CT (`attackerDetail`) ;
  // (b) le DÉFENSEUR rate sa Parade/Esquive (`defenderDetail`, Test opposé). PAS la défense adverse d'un
  // non-porteur. Cadence-aware (`set` → héros : le FM de palier 2 en cascade, comme onGainCondition ; PNJ inline).
  if (res.attackerDetail && !res.attackerDetail.success) log.push(...evLines(fireOwnTestFailed(get, attacker, { sl: res.attackerDetail.sl, set, rng: battleRng() }), 'condition', attacker.id));
  if (res.defenderDetail && !res.defenderDetail.success) log.push(...evLines(fireOwnTestFailed(get, target, { sl: res.defenderDetail.sl, set, rng: battleRng() }), 'condition', target.id));
  log.push(...drainPendingLog(get, set));
  set({ battle: { ...battle, acted: !salvoContinues, action: null, log } });
  // Structure de siège tombée à 0 Blessure → BRÈCHE : retrait du Combattant inerte + flag d'arête abattue.
  // APRÈS le `set` ci-dessus (qui réécrit `battle` depuis la capture STALE) pour ne pas re-réintroduire la structure.
  if (isStructure(target) && target.wounds.current <= 0) collapseStructure(get, set, target);
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
  resolveEnemyFumble(get, set, attacker, weapon, res); // Maladresse d'un ENNEMI attaquant → résolue instantanément
  // Maladresse d'un ENNEMI défenseur (Test opposé, LDB 14 l.13) : sa Parade/Esquive ratée sur un double.
  if (target.kind === 'enemy' && defenderFumbled(res, target.weapons[0], target) && !isOutOfAction(target) && target.weapons[0]) {
    applyOups(get, set, target, target.weapons[0], rollOups(target.weapons[0], battleRng()));
  }
  return false; // non suspendu : application complète terminée
}

/**
 * Interruption de Focalisation (LDB 46 l.144) : « La concentration est vitale pour focaliser. Si vous êtes
 * perturbé par quelque chose – bruits forts, Dégâts subis… –, vous devrez réussir un Test de Calme Difficile
 * (-20) ou subir une Incantation Imparfaite Mineure et perdre tous les DR accumulés jusque-là au Test étendu
 * de Focalisation. »
 *
 * Le Test de Calme du focaliseur est ROUTÉ par l'exécuteur de Flow CADENCE-AWARE (`runCombatFlow`) : héros en
 * cadence MANUELLE → étape de cascade INFLUENÇABLE (il PEUT dépenser sa Chance / sa Résilience pour garder son
 * sort) ; ennemi / cadence auto → jet inline. La branche d'ÉCHEC porte le marqueur `interruptFocus`, dont la
 * conséquence PROCÉDURALE (perte des DR + Imparfaite Mineure) s'exécute APRÈS le Test résolu, via le hook
 * `focusInterrupt` (→ `applyFocusInterruption`). Le résultat est porté par l'étape de cascade (manuel) ou la
 * ligne inline (auto). Le journal inline part dans la file différée (`pendingLogQueue`,
 * drainée par l'appelant — `applyAttackResult` / `applyCast`).
 */
export function checkFocusInterruption(get: Get, set: SetFn, target: Combatant): string[] {
  if (!target.focus || target.focus.dr <= 0) return [];
  // Branche d'échec : marqueur `interruptFocus` sur la cible (le focaliseur) → hook injecté. Succès = rien
  // (concentration maintenue, DR conservés). Le nœud `test` est résolu cadence-aware par `runCombatFlow`.
  const flow = testFlow(
    { skill: { id: 'calme' }, difficulty: 'difficile', label: 'Focalisation interrompue', stake: combatStakeRef('focusInterrupt') },
    EMPTY_FLOW,
    { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'interruptFocus' }] } },
  );
  runCombatFlow({ mode: 'combat', get, set, target, caster: target, label: 'Focalisation interrompue' }, flow);
  return []; // le journal voyage par la cascade (manuel) ou la file différée (inline) — pas de retour inline
}

/**
 * Conséquence PROCÉDURALE d'un Test de Calme d'interruption RATÉ (op `interruptFocus`, hook `focusInterrupt`) :
 * le focaliseur perd tous les DR accumulés sur son Sort focalisé (couverts par son composant — LDB 46 l.111) et
 * subit une Incantation Imparfaite Mineure (LDB 46 l.144). L'Imparfaite garde son rendu propre (étape de cascade
 * `miscast` pour un héros / lignes pour un ennemi) : le Test de Calme est l'étape influençable visible,
 * l'Imparfaite est sa conséquence en aval. Les lignes partent dans la file
 * différée (`pendingLogQueue`), drainée par l'appelant qui réécrit `battle.log`.
 */
export function applyFocusInterruption(get: Get, set: SetFn, focuser: Combatant): void {
  if (!focuser.focus || focuser.focus.dr <= 0) return; // garde (le composant/DR a pu changer entre Test et conséquence)
  const focusedSpellId = focuser.focus.spell;
  const lines: string[] = [tr('cf.focusLost', { name: focuser.label, dr: focuser.focus.dr, spell: findSpellById(focusedSpellId)?.label ?? focusedSpellId })];
  focuser.focus = undefined;
  const compUsed = useSpellComponent(focuser, focusedSpellId, lines); // un composant couvre aussi la Focalisation (incantation en cours)
  lines.push(...applyMiscast(get, set, focuser, 'mineure', { componentDowngrade: compUsed, domainId: findSpellById(focusedSpellId)?.domainId ?? undefined }));
  set({ pendingLogQueue: [...get().pendingLogQueue, ...lines.map((line) => ({ line, cid: focuser.id }))] });
}

/** Une Maladresse de l'attaquant dans un résultat d'attaque ? (jet propre raté + double, LDB 14 l.19 ;
 *  arme Dangereuse : aussi tout jet raté incluant un 9, LDB 62 l.315 ; Doigts amputés : escalade par
 *  chiffre des unités si `attacker` fourni, LDB 18 l.251 — réutilise `maxFingersLostForWeapon`, #144). */
export function attackerFumbled(res: AttackResult, weapon?: Weapon, attacker?: Combatant): boolean {
  if (!res.attackerDetail) return false;
  const { roll, success } = res.attackerDetail;
  const fingers = attacker && weapon ? maxFingersLostForWeapon(attacker, weapon) : 0;
  return isFumble(roll, success, fingers) || dangerousNine(weapon, roll, success);
}

/** Une Maladresse du DÉFENSEUR (Test opposé) : sa défense propre ratée sur un double (LDB 14 l.13 ;
 *  parade avec une arme Dangereuse : aussi tout jet raté incluant un 9, LDB 62 l.315 ; Doigts amputés :
 *  escalade par chiffre des unités si `defender` fourni, LDB 18 l.251, #144). */
export function defenderFumbled(res: AttackResult, parryWeapon?: Weapon, defender?: Combatant): boolean {
  if (!res.defenderDetail) return false;
  const { roll, success } = res.defenderDetail;
  const fingers = defender && parryWeapon ? maxFingersLostForWeapon(defender, parryWeapon) : 0;
  return isFumble(roll, success, fingers) || dangerousNine(parryWeapon, roll, success);
}

/** La cible est-elle dans une bande de tir/portée VALIDE de `weapon` pour `shooter` (LDB 14 l.54-84) ?
 *  Tir → bande de portée non nulle (munition + BF inclus) ; mêlée → Allonge (`reachTiles`). Position
 *  inconnue (tests) → vrai (aucun filtre géométrique). Source UNIQUE du test « à distance de frappe ». */
export function inFiringBand(shooter: Combatant, target: Combatant, weapon: Weapon, metresPerTile = 2): boolean {
  if (!shooter.pos || !target.pos) return true;
  const d = combatDistance(shooter, target);
  if (weapon.type === 'ranged') {
    const rm = effectiveWeaponRange(weapon, loadedAmmo(shooter, weapon)?.ammoRangeMod, () => bonus(effectiveChar(shooter, 'force')));
    return rm != null && rangeBandModifier(d, rm, metresPerTile) != null;
  }
  return d <= reachTiles(weapon);
}

/** Alliés (même camp) encore actifs, hors `c`, et À PORTÉE de `weapon` (LDB 14 l.30 : « à distance »).
 *  Sans position connue (tests), on ne filtre pas. */
function alliesAtRange(battle: BattleState, c: Combatant, weapon: Weapon, metresPerTile = 2): Combatant[] {
  return battle.combatants.filter((x) => x.id !== c.id && x.kind === c.kind && !isOutOfAction(x) && inFiringBand(c, x, weapon, metresPerTile));
}

/**
 * Tir rapide (talent, LDB 10) — chemin IA. À l'ouverture d'un Round (sommet de `confirmRoundStart`, choke
 * commun à tous les Rounds et tous les modes), chaque combattant PILOTÉ PAR L'IA capable d'interrompre à
 * distance tire UNE fois, hors de l'ordre d'Initiative, sur l'ennemi valide le plus proche (Ligne de Vue +
 * bande de portée). Le tir ÉPUISE son tour normal — Action + Mouvement dus, consommés à l'ouverture de son
 * slot (loseNext*, mêmes champs que la Maladresse Oups! 61-80). Plusieurs tireurs : celui qui a pris le
 * talent le plus de fois agit d'abord (LDB 10). Les tirs de l'HUMAIN passent, eux, par `preemptRangedShot`
 * pendant la pause de début de Round (avant ce choke).
 */
export function runPreemptShots(get: Get, set: SetFn): void {
  const battle = get().battle;
  if (!battle || battle.over) return;
  const tirRapideTimes = (c: Combatant) => c.talents?.find((tl) => tl.talentId === 'tir-rapide')?.times ?? 1;
  const shooters = battle.combatants
    .filter((s) => aiDriven(get(), s) && canPreemptRanged(s) && canTakeAction(s) && !s.loseNextAction && !isOutOfAction(s) && !!s.pos)
    .sort((a, b) => tirRapideTimes(b) - tirRapideTimes(a)); // le plus « entraîné » tire d'abord (LDB 10)
  const scene = get().scene!;
  const mpt = sceneMetresPerTile(scene);
  const smoke = smokeOf(battle);
  let changed = false;
  for (const shooter of shooters) {
    if (isOutOfAction(shooter) || shooter.loseNextAction) continue; // tué / déjà tiré par un tir précédent de ce Round
    // Cible = ennemi valide le plus proche AVEC Ligne de Vue (LDB 10). La LdV se tranche ici (`losClear`,
    // même `losTo` que `resolveAttack` l.470-472) AVANT le gate : un candidat plus proche mais masqué ne
    // consomme aucun Test — le gate ne joue qu'UNE fois, sur la cible réellement tirée.
    const t0 = battle.combatants
      .filter((f) => f.kind !== shooter.kind && !isOutOfAction(f) && !!f.pos)
      .map((f) => ({ f, weapon: firedWeapon(shooter, f, undefined, battle.combatants) }))
      .filter((x) => x.weapon.type === 'ranged' && inFiringBand(shooter, x.f, x.weapon, mpt))
      .sort((a, b) => combatDistance(shooter, a.f) - combatDistance(shooter, b.f))
      .find((x) => losClear(scene, shooter.pos!, isStructure(x.f) ? structureAimCell(shooter.pos!, x.f) : x.f.pos!, smoke))?.f;
    if (!t0) continue; // aucune cible en Ligne de Vue → pas d'interruption
    // Main ensanglantée (AA 07 l.117) : le tireur gaté joue le MÊME Test de Dextérité (+20) AVANT son Tir rapide
    // (point IA UNIQUE `aiHandGate`) ; Échec → l'arme lui glisse (`disarm`) et il renonce à l'interruption.
    if (!aiHandGate(get, set, shooter, firedWeapon(shooter, t0, undefined, battle.combatants).uid)) { changed = true; continue; }
    const r = resolveAttack(get, shooter, t0);
    if (r) {
      get().battle!.log.push(ev('shoot', tr('cf.tirRapide', { name: shooter.label }), shooter.id)); // marqueur AVANT le résultat (applyAttackResult recopie battle.log)
      applyAttackResult(get, set, shooter, r.victim ?? t0, r.weapon, r.res);
      shooter.loseNextAction = true; shooter.loseNextMovement = true; // tour normal épuisé (LDB 10)
      changed = true;
    }
    if (changed && checkBattleOver(get, set)) return;
  }
  if (changed) { set({ battle: { ...get().battle! } }); bus.emit(EVT.SCENE_DIRTY); }
}

/** Use/détruit l'arme sur l'ItemInstance SOURCE (héros → persiste, `recomputeLoadout` re-dérive),
 *  sinon sur le Weapon actif (ennemi/figurant, transient). Respecte Incassable (LDB 62 l.262). */
function wearActiveWeapon(c: Combatant, weapon: Weapon, destroy: boolean): void {
  // L'ItemInstance source de l'arme tenue : match par `uid` (posé par recomputeLoadout sur le Weapon dérivé).
  // Mains nues / Crochet n'ont pas d'uid → pas d'item source (usure transient via le `else` ci-dessous).
  const it = weapon.uid ? (c.items ?? []).find((i) => i.uid === weapon.uid) : undefined;
  if (isUnbreakable(it ?? weapon)) return; // Incassable : ni dégât ni destruction (LDB 62 l.262)
  // Sauvegarde Solide(N) contre une cassure instantanée : 1d10 ≥ seuil → l'arme résiste (LDB 60 l.30-32).
  if (destroy) {
    const thr = solideSaveThreshold(weapon);
    if (thr != null && d10(battleRng()) >= thr) return;
  }
  if (it) {
    if (destroy) {
      it.destroyed = true;
    } else {
      // Une Arme improvisée déjà à +0 qui prend un Dégât de plus devient inutilisable (LDB 62 l.135).
      if (isImprovised({ ...weapon, damageTaken: it.damageTaken ?? 0 })) it.destroyed = true;
      it.damageTaken = (it.damageTaken ?? 0) + 1;
    }
    recomputeLoadout(c); // re-dérive c.weapons depuis l'item usé (persiste via carryOverState items)
  } else if (destroy) {
    destroyWeapon(weapon);
  } else {
    damageWeapon(weapon);
  }
}

/**
 * Applique l'effet du Tableau des Oups ! au combattant `c` (mute + journalise). LDB 14 l.21-30.
 * Le chiffre des unités du jet sert de DR pour les touches (l.30).
 */
export function applyOups(get: Get, set: SetFn, c: Combatant, weapon: Weapon, r: OupsResolved): void {
  const battle = get().battle!;
  const log: string[] = [tr('cf.oups', { name: c.label, effet: r.label })];
  // Bâclé : l'arme casse sur toute Maladresse (Test raté + double, LDB 60 l.50) — sauvegarde Solide possible.
  if (hasQuality(weapon, 'bacle')) wearActiveWeapon(c, weapon, true);
  const sb = bonus(effectiveChar(c, 'force'));
  const units = r.roll % 10;
  switch (r.kind) {
    case 'selfWound':
      c.wounds.current = Math.max(0, c.wounds.current - 1); // ignore BE+PA (l.18)
      if (c.wounds.current <= 0) applyZeroWounds(c);
      break;
    case 'weaponDamageActLast':
      wearActiveWeapon(c, weapon, false); // 1 Dégât d'arme, persisté sur l'ItemInstance source
      c.actLastNextRound = true;
      break;
    case 'actionPenalty':
      c.nextActionPenalty = 10;
      break;
    case 'loseMovement':
      c.loseNextMovement = true;
      break;
    case 'loseAction':
      c.loseNextAction = true;
      break;
    case 'trauma': {
      c.criticalWounds = (c.criticalWounds ?? 0) + 1; // « compte comme une Blessure critique » (l.41)
      const leg: HitLocation = battleRng().int(0, 1) === 0 ? 'jambeG' : 'jambeD'; // « se tord la cheville »
      c.traumas = [...(c.traumas ?? []), traumaById(dechirureFractureFicheId('dechirure', 'mineur', leg), { be: bonus(effectiveChar(c, 'endurance')) }, leg)];
      log.push(tr('cf.fumbleTear', { leg: leg === 'jambeG' ? tr('cf.legLeft') : tr('cf.legRight') }));
      break;
    }
    case 'hitAlly': {
      const allies = alliesAtRange(battle, c, weapon, sceneMetresPerTile(get().scene));
      if (allies.length) {
        const ally = allies[battleRng().int(0, allies.length - 1)];
        const loc = hitLocationByShape(reverseRoll(r.roll), ally.bodyShape);
        const lost = woundsFromHit(weapon, ally, loc, effectiveWeaponDamage(weapon, sb) + units, 0, 1, c.size); // plancher 1 (l.165)
        ally.wounds.current = Math.max(0, ally.wounds.current - lost);
        if (ally.wounds.current <= 0) applyZeroWounds(ally);
        log.push(tr('cf.fumbleHitAlly', { name: ally.label, loc: locationLabel(loc, ally.bodyShape), lost }));
      } else {
        addCondition(c, COND.sonne); // « Si personne n'est à distance, vous vous frappez tout seul → Sonné » (l.45-46)
        log.push(tr('cf.fumbleSelfStun'));
      }
      break;
    }
    case 'misfire': {
      const lost = woundsFromHit(weapon, c, 'brasD', effectiveWeaponDamage(weapon, sb) + units, 0, 1, c.size); // plancher 1
      c.wounds.current = Math.max(0, c.wounds.current - lost);
      if (c.wounds.current <= 0) applyZeroWounds(c);
      wearActiveWeapon(c, weapon, true); // arme détruite, persistée sur l'ItemInstance source
      log.push(tr('cf.fumbleMisfire', { lost }));
      // Arme d'équipe (MDG 12 l.464) : « Si une arme dotée du Défaut Arme d'équipe subit un Incident de
      // tir, tous les membres de son équipage sont affectés. » → CHAQUE servant APTE du poste (hors le
      // tireur, déjà frappé ci-dessus) subit le même coup (Dégâts au Bras principal, mitigés à SA fiche).
      if (hasQuality(weapon, 'arme-d-equipe') && c.mannedPoste) {
        const servants = exposedCrew((c.mannedPoste.crewIds ?? [])
          .filter((id) => id !== c.id)
          .map((id) => inBattleId(battle, id))
          .filter((x): x is Combatant => !!x));
        for (const s of servants) {
          const sLost = woundsFromHit(weapon, s, 'brasD', effectiveWeaponDamage(weapon, sb) + units, 0, 1, c.size);
          s.wounds.current = Math.max(0, s.wounds.current - sLost);
          if (s.wounds.current <= 0) applyZeroWounds(s);
          log.push(tr('cf.fumbleMisfireCrew', { name: s.label, lost: sLost }));
        }
      }
      // Table AA « Incidents de Tir d'Artillerie par Salve » (AA 10 l.270-277) : une arme à Atout
      // Salve qui subit un Incident de tir tire EN PLUS sur ce tableau d10 dédié (AA 10 l.264 : « Si
      // l'arme subit un Incident de tir à n'importe quel moment du processus, déterminez-en les effets
      // puis faites un jet dans le tableau suivant. ») — DISTINCT de l'Incident de tir GÉNÉRIQUE d'Arme
      // d'équipe (MDG 12 l.464) déjà résolu ci-dessus.
      if (hasQuality(weapon, 'salve')) {
        const salve = rollArtillerySalveMisfire(loadRegister(c, weapon).chambered ?? 0, battleRng());
        log.push(tr('cf.artillerySalveIncident', { entry: salve.label }));
        if (salve.destroyed) wearActiveWeapon(c, weapon, true); // pièce détruite (idempotent si déjà cassée)
        const salveCrew = [c, ...(hasQuality(weapon, 'arme-d-equipe') && c.mannedPoste
          ? exposedCrew((c.mannedPoste.crewIds ?? [])
              .filter((id) => id !== c.id)
              .map((id) => inBattleId(battle, id))
              .filter((x): x is Combatant => !!x))
          : [])];
        for (let i = 0; i < salve.hits; i++) {
          for (const s of salveCrew) {
            const loc: HitLocation = salve.entry.location === 'brasPrincipal' ? 'brasD' : hitLocationByShape(reverseRoll(battleRng().int(1, 100)), s.bodyShape);
            const sLost = woundsFromHit(weapon, s, loc, effectiveWeaponDamage(weapon, sb) + battleRng().int(0, 9), 0, 1, c.size);
            s.wounds.current = Math.max(0, s.wounds.current - sLost);
            if (s.wounds.current <= 0) applyZeroWounds(s);
            log.push(tr('cf.artillerySalveHit', { name: s.label, lost: sLost, loc: locationLabel(loc, s.bodyShape) }));
          }
        }
        if (salve.entry.strayFire) log.push(tr('cf.artillerySalveStray', { note: salve.note }));
      }
      break;
    }
  }
  set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(log, 'info', c.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
}

/** Maladresse d'un attaquant PILOTÉ PAR L'IA : résolue instantanément (IA abstraite). No-op si piloté humain/pas de fumble. */
export function resolveEnemyFumble(get: Get, set: SetFn, enemy: Combatant, weapon: Weapon, res: AttackResult): void {
  if (!aiDriven(get(), enemy) || !attackerFumbled(res, weapon, enemy)) return;
  applyOups(get, set, enemy, weapon, rollOups(weapon, battleRng()));
}

/**
 * Réaction de Porte-Bouclier — variante « Avantage de groupe » (AA 13 l.84, VERBATIM : « une fois par Round,
 * vous pouvez dépenser 2 Avantages soit pour causer des Dégâts quand vous êtes attaqué comme s'il s'agissait
 * de votre Action, soit pour pousser votre adversaire sur 2 mètres dans la direction directement opposée à
 * vous et ne plus être considéré comme Engagé »). Brique GÉNÉRALE de réaction à coût d'Avantages : le coût et
 * l'éligibilité viennent de la DONNÉE (`shieldReactionCost`), jamais d'un dispatch par nom. Débite la réserve
 * (`campSpend`), marque la cadence 1×/Round, puis applique l'effet via les coutures existantes (poussée
 * `pushAway` + désengagement `disengageFrom` ; Dégâts `resolveMeleePassive` — même voie que la Riposte).
 */
export function applyShieldReaction(get: Get, set: SetFn, defender: Combatant, attacker: Combatant, kind: 'damage' | 'push', parryWeapon: Weapon | undefined): void {
  const battle = get().battle;
  if (!battle || isOutOfAction(defender)) return;
  const cost = shieldReactionCost(defender, parryWeapon);
  if (cost <= 0 || defender.usedShieldReactionRound || spendableAdvantage(get, defender) < cost) return;
  campSpend(get, defender, cost);
  defender.usedShieldReactionRound = true;
  const log = [...battle.log];
  if (kind === 'push') {
    if (defender.pos && attacker.pos && !isOutOfAction(attacker)) {
      const tiles = Math.max(1, Math.round(2 / sceneMetresPerTile(get().scene))); // 2 m RAW → cases
      const r = pushAway(get().scene!, defender.pos, attacker.pos, tiles, { blocked: occupied(battle, attacker) });
      if (r.pushed > 0) {
        const from = { ...attacker.pos };
        placeCombatant(attacker, get().scene, r.dest);
        bus.emit(EVT.ANIM_MOVE, { id: attacker.id, path: [{ ...r.dest }] });
        applyZoneCrossings(get, set, attacker, [...tilesBetween(from, r.dest), { ...r.dest }]);
      }
    }
    disengageFrom(defender, attacker); // « ne plus être considéré comme Engagé »
    log.push(ev('detail', tr('cf.shieldReactionPush', { name: defender.label, foe: attacker.label }), defender.id, attacker.id));
  } else {
    // « causer des Dégâts comme s'il s'agissait de son Action » : une frappe de mêlée (arme principale) vers
    // l'attaquant, résolue passivement — même voie que la Riposte, surfacée au journal (jet dans le log).
    const weapon = defender.weapons.find((w) => !isUnarmed(w)) ?? defender.weapons[0];
    const atk = rollMeleeAttacker(defender, attacker, weapon, battleRng());
    const res = resolveMeleePassive(defender, attacker, weapon, atk, undefined, [], undefined, false, composeAttack(attackModifiers(defender, attacker, weapon, { kind: 'melee' })));
    if (res.hit && res.woundsLost) {
      attacker.wounds.current = Math.max(0, attacker.wounds.current - res.woundsLost);
      if (attacker.wounds.current <= 0 && !attacker.dead && !hasCondition(attacker, COND.inconscient)) applyZeroWounds(attacker);
      if (isOutOfAction(attacker)) {
        clearEngagementOf(battle.combatants, attacker.id);
        clearPsychOf(battle.combatants, attacker.id);
      refreshAllDefendedPsych(battle.combatants); // l’Amour ne se clôt pas à la chute d’UN aimé (l.75) : verdict re-mesuré
      }
    }
    log.push(ev('damage', tr('cf.shieldReactionDamage', { name: defender.label, foe: attacker.label }), defender.id, attacker.id));
    log.push(ev(res.hit ? 'damage' : 'attack', res.log, defender.id, attacker.id));
  }
  set({ battle: { ...get().battle!, log } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
}

/**
 * UNE DÉFENSE EST-ELLE EN COURS ? (#1852) — LE prédicat du slot `pendingDefense`, lu par la PORTE
 * d'ouverture (`maybeOpenDefense`) et par les trois FILES de frappes (`drainerLesGratuites`,
 * `runCleaveChain`, `resolveFreeAttacks`). LDB 85 l.41-43 : une attaque gratuite est un Test d'attaque
 * COMPLET, donc résolue entièrement — fenêtre du défenseur comprise — avant que la suivante soit
 * déclarée. Une file qui le lit s'ARRÊTE sans rien consommer : sa frappe est reprise à la fermeture.
 */
export function defenseEnCours(s: Pick<GameState, 'pendingDefense'>): boolean {
  return s.pendingDefense != null;
}

/** REFUS d'ouverture : un producteur déclare une frappe par-dessus une défense vivante. DEV = throw
 *  (le producteur fautif se voit au premier passage) ; PROD = journal. CE QUI EST GARANTI : la frappe
 *  n'est jamais résolue SANS la fenêtre de son défenseur (LDB 85 l.41-43), et le `true` rendu empêche
 *  l'appelant de retomber sur la résolution instantanée. CE QUI NE L'EST PAS : cette frappe-là est
 *  ABANDONNÉE — aucun producteur ne la remet en file ; la file de frappes du tour est #1858. */
function refuserLaDefense(attacker: Combatant, target: Combatant): boolean {
  const msg = `[combat] défense déjà ouverte : ${attacker.label} déclare une frappe sur ${target.label} `
    + 'avant que la précédente soit résolue — la frappe est refusée (LDB 85 l.41-43).';
  console.error(msg);
  if (import.meta.env?.DEV) throw new Error(msg);
  return true;
}

/** OUVRE la fenêtre de Défense HÔTÉE par la cascade — les trois interpositions (tir réactif, mêlée
 *  réactive, défense du chemin d'attaque piloté) ouvrent la MÊME fenêtre. `pendingDefense`, posé par
 *  l'appelant JUSTE avant, porte la donnée que la fenêtre rend ; l'étape porte la possession du
 *  DÉFENSEUR (`actorId` → son siège), et le mint refuse d'ouvrir sans le pending.
 *
 *  RENVOIE si la fenêtre s'est ouverte : en PROD un refus du mint DÉGRADE (journalise, ne jette pas),
 *  et un appelant qui répondrait `true` d'office laisserait l'attaquant suspendu devant une fenêtre
 *  qui n'existe pas. Le verdict remonte donc au site d'interposition, à lui de résoudre sans elle. */
function openDefenseCascade(get: Get, set: SetFn, target: Combatant): boolean {
  // Une attaque GRATUITE rouvre une défense DANS la même séquence de combat (LDB 85 l.41-43 — chaque
  // gratuite est un Test d'attaque complet, donc SA fenêtre) : l'id se distingue par le compteur de la
  // séquence d'accueil (#1852).
  const step = hostStep(get, { id: idDansLaSequence(get, 'defense-jet', 'combat'), kind: 'defenseJet', jet: 'defense', actorId: target.id });
  if (!step) return false;
  openSequence(get, set, { title: 'Défense', icon: 'action/defend', purpose: 'combat', steps: [step] });
  return true;
}

/** Ouvre la fenêtre de défense réactive quand le DÉFENSEUR est surfacé (`defenseSurfaced` — le pilote de
 *  l'attaquant n'entre PAS dans la condition), en mêlée, à portée, cible CAPABLE de se défendre (pas
 *  Surpris). Fige le jet d'attaque et suspend le tour de l'attaquant. Retourne true si la fenêtre s'est
 *  ouverte. Chemin d'attaque INSTANTANÉE (IA, attaques gratuites) ; le chemin d'attaque PILOTÉE (modale
 *  d'attaque) interpose sa défense à l'application, cf. `openSurfacedDefense`. */
export function maybeOpenDefense(
  get: Get,
  set: SetFn,
  attacker: Combatant,
  target: Combatant,
  weapon: Weapon = attacker.weapons[0],
  suite?: SuiteDeCoup,
  fromCharge?: boolean,
): boolean {
  if (defenseEnCours(get())) return refuserLaDefense(attacker, target);
  if (!defenseSurfaced(get(), target)) return false;
  // TIR sur un héros : ouvre la défense réactive UNIQUEMENT si le RAW l'autorise (Protectrice 2+ en
  // Ligne de Vue LDB 62 l.296 / Bout Portant LDB 14 l.40 / tireur Engagé LDB 14 l.44). Vide = tir non
  // opposable → résolution simple (resolveAttack). LoS acquise : l'IA ne tire que si elle voit (doAttack).
  if (weapon?.type === 'ranged') {
    const mpt = sceneMetresPerTile(get().scene);
    const dist = combatDistance(attacker, target);
    const modes = rangedDefenseModes(attacker, target, weapon, dist, true, mpt);
    if (!modes.length) return false;
    const { env } = attackEnv(get, attacker, target, weapon);
    const atk = rollRangedAttacker(attacker, target, weapon, battleRng(), dist, undefined, env, mpt); // tir figé
    const best = bestRangedDefense(attacker, target, weapon, dist, true, mpt);
    // Composée HORS du littéral : la Difficulté du tir figé, avec les mêmes options que `rollRangedAttacker`.
    const atkCompo = composeAttack(attackModifiers(attacker, target, weapon, { kind: 'ranged', distanceTiles: dist, env, metresPerTile: mpt }));
    set({
      pendingDefense: {
        attackerId: attacker.id, defenderId: target.id, weapon, location: null, atk, env, atkCompo,
        mode: best?.mode ?? modes[0], parryWeaponUid: best?.parryWeapon?.uid, modes, distanceTiles: dist, def: null, result: null,
        suite: { mode: 'machine', coup: suite ?? {} },
      },
    });
    return openDefenseCascade(get, set, target);
  }
  if (weapon?.type !== 'melee') return false;
  if (combatDistance(attacker, target) > reachTiles(weapon)) return false; // Allonge incluse (RAW-3)
  if (cannotDefend(target)) return false; // Surpris → résolution instantanée (LDB 16 l.135)
  applyIncomingMeleeAdvantage(get, attacker, target); // +1 Avantage si cible Sonnée, AVANT le jet (une seule fois)
  // Le MÊME env que resolveAttack (météo, Flanc/dos +20, Surnombre, Combat monté) : le jet figé de la
  // défense réactive l'omettait — un cavalier IA attaquait un héros sans son +20 (LDB 14 l.180). Le
  // drapeau `flankRear` n'est PAS un champ du pending : il n'agit qu'ICI, au GEL du jet d'attaquant
  // (bonus d'Assourdi de flanc, LDB 16 l.29) ; ce qui voyage ensuite dans la fenêtre, c'est `env`.
  const { env, flankRear } = attackEnv(get, attacker, target, weapon);
  const atk = rollMeleeAttacker(attacker, target, weapon, battleRng(), undefined, env, flankRear); // jet d'attaque figé, flanc/dos compris
  // Charge montée (LDB 14 l.183) : Force (Bonus) + Taille de la MONTURE aux DÉGÂTS — la fenêtre porte le
  // proxy, sinon l'opposition différée le perdrait (le chemin inline le passe, resolveAttack).
  const chargeMount = fromCharge ? mountOf(get().battle!, attacker) : undefined;
  // Composée HORS du littéral, avec les MÊMES options que le jet figé ci-dessus (flanc/dos compris) :
  // la Difficulté affichée après la fenêtre est celle qui a fait la cible, pas une recomposition d'un
  // contexte appauvri.
  const atkCompo = composeAttack(attackModifiers(attacker, target, weapon, { kind: 'melee', env, flankRear }));
  set({
    pendingDefense: {
      attackerId: attacker.id,
      defenderId: target.id,
      weapon,
      location: null, // l'IA ne vise pas de localisation
      atk,
      env,
      atkCompo,
      ...(chargeMount ? { dmgProxy: { sb: bonus(effectiveChar(chargeMount, 'force')), size: chargeMount.size } } : {}),
      mode: bestDefenseMode(target),
      def: null,
      result: null,
      // CE QUE LA FERMETURE JOUERA : la suite que le producteur aurait passée à `applyAttackResult` sur
      // son chemin instantané (coup nu, maillon de balayage, gratuite — LDB 85 l.41-43).
      suite: { mode: 'machine', coup: suite ?? {} },
    },
  });
  return openDefenseCascade(get, set, target);
}

/**
 * Une fenêtre de Défense va-t-elle s'interposer entre CE jet d'attaque figé et son application ?
 * Test PUR (aucun `set`, aucun jet) — SOURCE UNIQUE consommée par `openSurfacedDefense` (qui ouvre la
 * fenêtre) ET par la modale d'attaque (qui doit taire le verdict d'une résolution `defense:'none'`
 * contre PERSONNE, #1004). Deux dérivations séparées divergeraient au premier changement de garde.
 *
 * Gardes : jet d'attaquant posé, sans jet de défense au résultat ; défenseur SURFACÉ (`defenseSurfaced`), capable
 * de défendre (`cannotDefend`) et animé ; tir DÉVIÉ (LDB 14 l.116), pilonnage de zone (AA 10
 * l.122-123) et Tir rapide en INTERRUPTION (`pa.interrupt`, chemin d'application sans couture de
 * Défense — #997 ; la couture posée par #997 retire cette exclusion) n'ouvrent aucune fenêtre ;
 * gardes RAW de mode (portée de mêlée Allonge comprise —
 * RAW-3 ; `rangedDefenseModes` : un tir sans mode reste NON OPPOSÉ, LDB 13 l.125).
 *
 * L'ARME employée se résout par `attackWeaponOf` (#1026) chez TOUS les appelants : une arme lue
 * autrement ferait diverger ce prédicat de la fenêtre réellement ouverte.
 */
export function surfacedDefensePending(s: GameState, attacker: Combatant, target: Combatant, weapon: Weapon, pa: PendingAttack): boolean {
  if (pa.defended || !pa.result?.attackerDetail || pa.result.defenderDetail) return false;
  if (pa.siege || pa.interrupt) return false;
  const victimId = (pa.victimId && s.battle ? inBattleId(s.battle, pa.victimId)?.id : undefined) ?? target.id;
  if (victimId !== target.id) return false;
  if (!defenseSurfaced(s, target) || cannotDefend(target) || isInanimate(target)) return false;
  const dist = combatDistance(attacker, target);
  if (weapon.type === 'ranged') return rangedDefenseModes(attacker, target, weapon, dist, true, sceneMetresPerTile(s.scene)).length > 0;
  return weapon.type === 'melee' && dist <= reachTiles(weapon);
}

/**
 * INTERPOSITION de la défense sur le chemin d'attaque PILOTÉE (`attackConfirm`) : le jet d'attaquant est
 * FIGÉ et FINAL (Chance/Pacte/Résilience déjà joués), le défenseur surfacé joue MAINTENANT sa défense dans
 * SA fenêtre. Gardes = `surfacedDefensePending` (source unique, partagée avec l'affichage). `pa` voyage sur le
 * `pendingDefense` : `defenseConfirm` le rend à `attackConfirm` avec le résultat OPPOSÉ, de sorte que le
 * chemin d'application de l'attaque reste UNIQUE. Retourne true si la fenêtre s'est ouverte.
 */
export function openSurfacedDefense(get: Get, set: SetFn, attacker: Combatant, target: Combatant, weapon: Weapon, pa: PendingAttack): boolean {
  if (!surfacedDefensePending(get(), attacker, target, weapon, pa)) return false;
  const atk = hydrateTR(pa.result!.attackerDetail!);
  const mpt = sceneMetresPerTile(get().scene);
  const dist = combatDistance(attacker, target);
  // Contexte d'OPPOSITION transporté À L'IDENTIQUE de l'appel inline (`resolveAttack`) : `env` (breakdown
  // d'attaque), « Retenir ses coups » (AA 07 l.59-61) et le proxy de Charge montée (LDB 14 l.183) — sans
  // eux, la même attaque donnerait des Dégâts différents selon qu'elle traverse ou non la fenêtre.
  const { env } = attackEnv(get, attacker, target, weapon);
  const chargeMount = pa.fromCharge ? mountOf(get().battle!, attacker) : undefined;
  const base = {
    attackerId: attacker.id, defenderId: target.id, weapon, location: pa.location, atk, def: null, result: null,
    env, withhold: pa.withhold, atkCompo: frozenDifficulty(pa.result!.attackerDetail!),
    ...(chargeMount ? { dmgProxy: { sb: bonus(effectiveChar(chargeMount, 'force')), size: chargeMount.size } } : {}),
    suite: { mode: 'pilotee' as const, pa: { ...pa, defended: true } },
  };
  if (weapon.type === 'ranged') {
    const modes = rangedDefenseModes(attacker, target, weapon, dist, true, mpt);
    const best = bestRangedDefense(attacker, target, weapon, dist, true, mpt);
    set({ pendingDefense: { ...base, mode: best?.mode ?? modes[0], parryWeaponUid: best?.parryWeapon?.uid, modes, distanceTiles: dist } });
  } else {
    set({ pendingDefense: { ...base, mode: bestDefenseMode(target) } });
  }
  return openDefenseCascade(get, set, target);
}

/** Le TIR IMMOBILE est-il armable ? Renvoie la RAISON du refus, `null` si armable.
 * PRÉDICAT UNIQUE de la posture (`LDB 14 l.70`) — TROIS lecteurs, aucun recodage : le gate du registre
 * d'actions (case de console), le store (`battleToggleStance`) et la fenêtre de jet
 * (`useAttackJetProps`). Il dit exactement ce que `attackEnv` mesure : seul un HÉROS a le choix (l'IA
 * encaisse le −10 dès qu'elle a bougé, elle n'arbitre rien), et une fois le Mouvement du Tour entamé —
 * ou sans Mouvement à céder — la posture n'annule plus rien.
 * `weapon` = l'arme d'UN tir précis (fenêtre de jet) ; absente, la question est celle de l'ARSENAL
 * (la console arme la posture avant toute cible). */
export function heldGroundStanceBlock(battle: BattleState, c: Combatant, weapon?: Weapon): string | null {
  if (c.kind !== 'hero') return tr('agate.stanceHeroOnlyHold');
  const tir = weapon ? weapon.type === 'ranged' : c.weapons.some((w) => w.type === 'ranged');
  if (!tir) return tr(weapon ? 'agate.stanceNotAShot' : 'agate.stanceNoRangedWeapon');
  if (battle.movementUsed > 0) return tr('agate.movementStarted');
  if (mountMovement(battle, c) <= 0) return tr('agate.stanceNoMovementToYield');
  return null;
}

/** « TIRER DANS LE TAS » est-il armable ? Même contrat de retour que `heldGroundStanceBlock`.
 * `LDB 14 l.106` (bonus +20/+40/+60 selon la taille du groupe, succès appliqué au hasard) et
 * `LDB 14 l.116` (« Si vous n'avez cure de savoir sur qui vous tirez, vous gagnez un bonus allant de
 * +20 à +60 ») : c'est un CHOIX du tireur, donc une posture — et il n'a d'objet que face à un groupe
 * SERRÉ (le seuil est celui de `crowdMod`, jamais un compte recopié).
 * `target` absente = question de CONTEXTE (la console arme avant toute cible) : un groupe suffit. */
export function intoCrowdStanceBlock(battle: BattleState, c: Combatant, weapon?: Weapon, target?: Combatant): string | null {
  if (c.kind !== 'hero') return tr('agate.stanceHeroOnlyCrowd');
  const tir = weapon ? weapon.type === 'ranged' : c.weapons.some((w) => w.type === 'ranged');
  if (!tir) return tr(weapon ? 'agate.stanceNotAShot' : 'agate.stanceNoRangedWeapon');
  const serre = (t: Combatant) => !!crowdMod(crowdEligible(battle, c, t).length);
  const groupe = target
    ? serre(target)
    : battle.combatants.some((t) => t.id !== c.id && !isOutOfAction(t) && !!t.pos && serre(t));
  if (!groupe) return tr('agate.stanceNoCrowd');
  return null;
}

/** Les postures de tir, par champ armé : UNE table, un seul contrat de prédicat. Le store, le gate du
 *  registre et la fenêtre de jet la lisent — aucune posture ne peut naître sans son prédicat. */
export const STANCE_BLOCK: Record<ShootingStanceKey, (battle: BattleState, c: Combatant, weapon?: Weapon, target?: Combatant) => string | null> = {
  heldGround: heldGroundStanceBlock,
  intoCrowd: intoCrowdStanceBlock,
};

/** Verse les POSTURES PRÉ-ARMÉES de l'attaquant (`battle.stances`, spec HUD §1a G5) dans le
 *  `PendingAttack` en construction. Un champ DÉJÀ porté par l'appelant prime — le Tir rapide
 *  d'interruption arme son `heldGround` d'office (`combatSlice`), la posture ne le contredit pas.
 *  Chaque posture est ÉVALUÉE SUR CE COUP (arme réelle `attackWeaponOf` + cible réelle) : une attaque
 *  de MÊLÉE ne porte jamais `heldGround`/`intoCrowd` — le champ y mentirait, et rien ne le lirait. */
function withArmedStance(get: Get, pa: PendingAttack): PendingAttack {
  const battle = get().battle;
  const attacker = battle ? inBattleId(battle, pa.attackerId) : null;
  const target = battle ? inBattleId(battle, pa.targetId) : null;
  const armee = battle?.stances?.[pa.attackerId];
  if (!battle || !attacker || !target || !armee) return pa;
  const weapon = attackWeaponOf(battle, attacker, target, pa);
  let out = pa;
  for (const key of Object.keys(STANCE_BLOCK) as ShootingStanceKey[]) {
    if (!armee[key] || pa[key] !== undefined) continue;
    if (STANCE_BLOCK[key](battle, attacker, weapon, target)) continue; // posture périmée / sans objet pour CE coup
    out = { ...out, [key]: true };
  }
  return out;
}
/**
 * OUVRE l'Action d'attaque des sites de déclaration CÔTÉ JOUEUR (flux normal `targetingModes` / Tir rapide /
 * Pilonnage) — point PARTAGÉ du gate « Main ensanglantée » (AA 07 l.117 ; le balayage/2ᵉ frappe sont des
 * CONTINUATIONS de la MÊME Action déjà gatée, non re-gatées). Si l'arme employée est tenue dans une main
 * gatée (`attackHandGate`), interpose d'abord un Test de Dextérité (+20) INFLUENÇABLE (`pendingHandGate`,
 * calque `reload`) : sur RÉUSSITE `handGateConfirm` RAPPELLE ce helper (le `pa`/`title`/`icon` FIGÉS →
 * l'attaque s'ouvre telle quelle) ; sur ÉCHEC l'objet glisse (op `disarm`) et l'Action est consommée. Sans
 * gate, ouvre directement la cascade `attackJet`. `pa.weaponUid` doit déjà être résolu (sinon = main directrice).
 *
 * RENVOIE si une fenêtre est ouverte (gate de main OU jet d'attaque) : le mint peut REFUSER l'étape
 * hôte, et c'est l'appelant — pas la porte — qui décide de ce qu'on fait d'une Action sans fenêtre. */
export function openAttackCascade(get: Get, set: SetFn, pa0: PendingAttack, title: string, icon: string, skipGate = false): boolean {
  const pa = withArmedStance(get, pa0);
  const attacker = actorIn(get(), pa.attackerId);
  const hand = !skipGate && attacker ? attackHandGate(attacker, pa.weaponUid) : null; // `skipGate` : gate déjà PASSÉ (reprise `handGateConfirm`) → pas de re-test
  if (attacker && hand) {
    const base = effectiveChar(attacker, 'dexterite'); // Dextérité effective (LDB) — +20 « Accessible » via la Difficulté
    // Cible montée par le MONTEUR : elle passe donc par `clampTarget`, comme celle que `rollTest`
    // calculera au jet (`FLOWS.handGate`). Effet MESURÉ aux bornes seulement (Dex 85 : 105 → 99).
    set({ pendingHandGate: {
      attackerId: attacker.id, actorName: attacker.label, hand,
      skillValue: base, difficulty: 'accessible', target: rollLine({ actor: attacker, difficulty: 'accessible', valeur: base }).target,
      roll: null, sl: 0, success: false, pa, title, icon,
    } });
    return true; // la fenêtre ouverte est celle du GATE ; l'attaque s'ouvrira à sa réussite
  }
  set({ pendingAttack: pa });
  // Une chaîne d'attaques (balayage, deux armes, gratuite) rejoint la séquence déjà ouverte : l'id se
  // distingue par le compteur de la séquence d'accueil (#1852).
  const step = hostStep(get, { id: idDansLaSequence(get, 'attack-jet', 'combat'), kind: 'attackJet', jet: 'attack', actorId: pa.attackerId });
  if (!step) return false;
  openSequence(get, set, { title, icon, purpose: 'combat', steps: [step] });
  return true;
}

/** Main ensanglantée (AA 07 l.117) — Test de Dextérité (+20) JOUÉ INLINE pour un attaquant PILOTÉ PAR L'IA
 *  (jamais de modale, résolution forcée). SOURCE UNIQUE des chemins IA : attaque normale (`doAttack`), Tir
 *  rapide (`runPreemptShots`) et pilonnage servi (même point). Renvoie `true` si le coup peut se poursuivre ;
 *  sur ÉCHEC, l'objet de la main gatée glisse (op `disarm`) et l'on renvoie `false` (l'IA renonce à CE coup).
 *  `weaponUid` = arme réellement employée : une pièce SERVIE hors loadout main/off → `attackHandGate` = null →
 *  jamais gatée (parité avec le pilonnage joueur, canon monté). */
export function aiHandGate(get: Get, set: SetFn, attacker: Combatant, weaponUid?: string): boolean {
  const gHand = attackHandGate(attacker, weaponUid);
  if (!gHand) return true;
  const gt = rollSansPilote(get, attacker, effectiveChar(attacker, 'dexterite'), 'accessible', battleRng());
  const bg = get().battle;
  if (!gt.success) {
    applyOps(attacker, [{ op: 'disarm' }], { rng: battleRng(), location: gHand === 'off' ? 'brasG' : 'brasD' });
    if (bg) set({ battle: { ...bg, combatants: [...bg.combatants], log: [...bg.log, ev('info', tr('cf.handGateFail', { name: attacker.label, roll: gt.roll, target: gt.target }), attacker.id)] } });
    return false;
  }
  if (bg) set({ battle: { ...bg, log: [...bg.log, ev('info', tr('cf.handGatePass', { name: attacker.label, roll: gt.roll, target: gt.target }), attacker.id)] } });
  return true;
}

export function doAttack(get: Get, set: SetFn, attacker: Combatant, target: Combatant): boolean {
  // Bénédiction de Protection (LDB 41 — L13) : Test de FM Accessible (+20) pour oser attaquer le
  // béni ; échec → l'IA renonce à CE coup (simplification : pas de re-ciblage, documentée).
  const ward = attackWardGate(attacker, target);
  const b0 = get().battle;
  if (ward.lines.length && b0) set({ battle: { ...b0, log: [...b0.log, ...evLines(ward.lines, 'info', attacker.id)] } });
  if (!ward.allowed) return false;
  // Main ensanglantée (AA 07 l.117) : l'attaquant gaté joue le Test de Dextérité (+20) sur l'arme EMPLOYÉE contre
  // cette cible ; Échec → l'arme glisse et il renonce à CE coup (une pièce servie hors loadout n'est jamais gatée).
  if (!aiHandGate(get, set, attacker, firedWeapon(attacker, target).uid)) return false;
  if (maybeOpenDefense(get, set, attacker, target, undefined, undefined, attacker.chargedThisTurn)) return true; // suspendu : reprise via defenseConfirm/Cancel ; `chargedThisTurn` = le MÊME `fromCharge` que le `resolveAttack` ci-dessous
  // Tir ennemi : l'annoncer dans le journal de COMBAT (battle.log → fil + tiroir) DÈS la décision — un tir
  // n'ouvre pas de modale de défense, donc « on ne savait jamais sur qui il tirait » (#12d). Avant, l'annonce
  // partait dans le journal du GROUPE (invisible en combat).
  if (firedWeapon(attacker, target).type === 'ranged') {
    const b0 = get().battle;
    if (b0) set({ battle: { ...b0, log: [...b0.log, ev('shoot', tr('cf.aim', { name: attacker.label, target: target.label }), attacker.id, target.id)] } });
  }
  applyIncomingMeleeAdvantage(get, attacker, target); // +1 Avantage si cible Sonnée (LDB 16 l.125), avant le jet
  // Charge montée (LDB 14 l.183) : si l'attaquant a chargé ce tour, ses dégâts utilisent la Force + la
  // Taille de sa monture — PARITÉ avec le joueur (le proxy ne s'applique que s'il chevauche réellement).
  const r = resolveAttack(get, attacker, target, undefined, attacker.chargedThisTurn);
  if (!r) {
    get().log(firedWeapon(attacker, target).type === 'ranged' ? tr('cf.noLoSMasked') : tr('cs.meleeOutOfRange'));
    return false;
  }
  const suspended = applyAttackResult(get, set, attacker, r.victim ?? target, r.weapon, r.res); // r.victim = allié touché par un tir dévié (LDB 14 l.116)
  if (suspended) return true; // Déviation Critique du héros : la modale reprendra (autoCleave/Piétinement/advance rejoués au resolve)
  autoCleave(get, set, attacker, r.victim ?? target, r.res); // Frappe Mortelle : balayage auto si l'ennemi est plus grand
  return false;
}

// ---------------------------------------------------------------------------
// Frappe Mortelle — balayage (LDB 14 - _GoBack.md l.9-12 + 85 l.299)
// ---------------------------------------------------------------------------

/** Cibles de balayage : adversaires encore actifs, ADJACENTS (Chebyshev ≤ 1 — « à portée de ses
 *  attaques » = adjacence tant que l'Allonge n'est pas modélisée) et non déjà frappés dans ce
 *  balayage. Sans position connue (tests purs), on ne filtre pas sur la distance. */
export function cleaveTargets(battle: BattleState, attacker: Combatant, hitIds: string[]): Combatant[] {
  return battle.combatants.filter((c) => {
    if (c.kind === attacker.kind || isOutOfAction(c) || hitIds.includes(c.id)) return false;
    if (!attacker.pos || !c.pos) return true;
    return combatDistance(attacker, c) <= 1;
  });
}

/** Poursuit la chaîne de balayage. Chaque enchaînement passe par la MÊME couture d'ouverture que l'attaque
 *  principale (`maybeOpenDefense`, patron `applyFreeAttack`) : le maillon SUIVANT est la suite que le coup
 *  emporte, que la fenêtre du défenseur SURFACÉ s'interpose (`defenseConfirm` la joue) ou non — la chaîne
 *  n'est jamais roulée en silence. */
function runCleaveChain(get: Get, set: SetFn, attacker: Combatant, chain: ChaineDeBalayage): void {
  let hitIds = chain.hitIds;
  for (let n = chain.n; n < chain.bcc; n++) {
    const battle = get().battle;
    if (!battle || battle.over) break;
    const next = cleaveTargets(battle, attacker, hitIds)[0];
    if (!next) break;
    hitIds = [...hitIds, next.id];
    // Le maillon SUIVANT entre AVEC le coup, par le HAUT : la MÊME valeur va à la fenêtre du défenseur
    // surfacé (qui la joue à sa fermeture) et à l'application instantanée ; la case libérée ne se lit
    // qu'APRÈS l'application (`resumeCleaveChain`).
    const suite: SuiteDeCoup = { enchainement: { mode: 'chaine', hitIds, n: n + 1, bcc: chain.bcc, fm: chain.fm } };
    if (maybeOpenDefense(get, set, attacker, next, undefined, suite)) return; // chaîne suspendue : la reprise part de `defenseConfirm`
    const r = resolveAttack(get, attacker, next);
    if (!r) continue; // hors de portée (ne devrait pas : déjà filtré adjacent) — borne consommée tout de même
    if (applyAttackResult(get, set, attacker, r.victim ?? next, r.weapon, r.res, false, undefined, suite)) return;
    const killed = isOutOfAction(next);
    if (killed && next.pos) {
      placeCombatant(attacker, get().scene, next.pos); // se déplace sur la case libérée
      displaceSmaller(get, attacker); // dégage les plus petits sous l'empreinte (85 l.373-374)
    }
    if (chain.fm && !killed) break; // Frappe Mortelle : on ne poursuit qu'en TUANT (LDB 14 l.9)
  }
  set({ battle: { ...get().battle! } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** REPREND une chaîne de balayage que le coup portait dans sa suite (`enchainement: 'chaine'`), une fois
 *  l'enchaînement appliqué : recalage sur la case d'une cible tuée (LDB 14 l.9) puis suite de la chaîne. */
export function resumeCleaveChain(get: Get, set: SetFn, attacker: Combatant, defender: Combatant, chain: ChaineDeBalayage): void {
  const killed = isOutOfAction(defender);
  if (killed && defender.pos) {
    placeCombatant(attacker, get().scene, defender.pos);
    displaceSmaller(get, attacker);
  }
  if (chain.fm && !killed) { // Frappe Mortelle : on ne poursuit qu'en TUANT (LDB 14 l.9)
    set({ battle: { ...get().battle! } });
    bus.emit(EVT.SCENE_DIRTY);
    return;
  }
  runCleaveChain(get, set, attacker, chain);
}

/** Balayage AUTOMATIQUE d'un attaquant conduit par l'IA après une touche de mêlée d'un plus grand
 *  (`res.cleave`, LDB 85 l.362) : enchaîne jusqu'à BCC attaques sur des adversaires adjacents non encore
 *  frappés, se déplaçant sur la case d'une cible tuée (l.10).
 *  MACHINERIE GÉOMÉTRIQUE (pas une réaction d'entité câblée par-nom) : le déclencheur `res.cleave` est
 *  dérivé GÉNÉRIQUEMENT (combat.ts : `attacker.swarm` ∨ `sizeGap ≥ 1`) et la Frappe Mortelle est une
 *  RÈGLE OPTIONNELLE (`combat-frappe-mortelle`) ; le ciblage est l'adjacence pure (`cleaveTargets`). Aucun
 *  trait/talent n'est nommé — règle universelle de l'arène pour les attaquants surdimensionnés/Nuée. */
export function autoCleave(get: Get, set: SetFn, attacker: Combatant, primaryTarget: Combatant, res: AttackResult): void {
  if (!aiDriven(get(), attacker)) return;
  const sizeCleave = !!res.cleave; // Taille/Nuée : enchaîne sur une simple TOUCHE (LDB 85 l.362)
  // Frappe Mortelle (option, hors Taille) : enchaîner seulement après avoir TUÉ en un coup (LDB 14 l.9).
  const fm = !sizeCleave && !!rule('combat-frappe-mortelle') && isOutOfAction(primaryTarget);
  if (!sizeCleave && !fm) return;
  const bcc = bonus(effectiveChar(attacker, 'capacite-de-combat'));
  if (bcc < 1) return;
  // Cible primaire tuée → l'attaquant se déplace sur sa case avant d'enchaîner (l.10).
  if (isOutOfAction(primaryTarget) && primaryTarget.pos) {
    placeCombatant(attacker, get().scene, primaryTarget.pos);
    displaceSmaller(get, attacker); // en se recalant, un grand dégage les plus petits sous son empreinte (85 l.373-374)
  }
  runCleaveChain(get, set, attacker, { hitIds: [primaryTarget.id], n: 0, bcc, fm });
}

/** Balayage d'un HÉROS (interactif) : appelé après l'application d'une attaque. Démarre le balayage
 *  sur une touche d'un plus grand (`res.cleave`), ou le poursuit si `wasChain` (un enchaînement vient
 *  d'être résolu). Ouvre/maintient `pendingCleave` tant qu'il reste des cibles adjacentes ET que le
 *  nombre d'enchaînements reste < BCC (LDB 14 l.9) ; sinon le ferme. Déplacement sur la case d'une
 *  cible tuée (l.9). */
export function maybeHeroCleave(get: Get, set: SetFn, attacker: Combatant, target: Combatant, res: AttackResult, wasChain: boolean): void {
  // SURFACE (#1426), jamais l'affordance LOCALE : le balayage d'un héros possédé par un siège DISTANT
  // est une FENÊTRE qui appartient à ce siège (`pendingCleave` → `modalArbiter`). Les deux chemins du
  // balayage se PARTAGENT tous les porteurs sans trou : ici ceux qu'un siège humain tient, `autoCleave`
  // (gaté `aiDriven`) ceux qu'un automate conduit — un prédicat seat-local laisserait un porteur entre
  // les deux, donc un enchaînement dû (LDB 14 l.9 / 85 l.362) jamais offert ni résolu.
  if (!tenuParUnHumain(get(), attacker.id)) return;
  const pc = get().pendingCleave;
  const sizeCleave = !!res.cleave; // Taille : enchaîne sur une simple TOUCHE (LDB 85 l.362)
  // Démarrage Frappe Mortelle (option, hors Taille) : la cible doit être TUÉE en un coup (LDB 14 l.9).
  const fmStart = !pc && !sizeCleave && !!rule('combat-frappe-mortelle') && isOutOfAction(target);
  if (!pc && !sizeCleave && !fmStart) return; // ni balayage en cours, ni déclenché par cette touche
  const fm = pc ? !!pc.fm : fmStart; // mode porté par le pending (Taille vs Frappe Mortelle)
  const count = wasChain ? (pc?.count ?? 0) + 1 : pc?.count ?? 0; // un enchaînement résolu consomme une attaque
  const hitIds = pc ? [...new Set([...pc.hitIds, target.id])] : [target.id];
  if (isOutOfAction(target) && target.pos) {
    placeCombatant(attacker, get().scene, target.pos); // case libérée (l.10)
    displaceSmaller(get, attacker); // dégage les plus petits sous l'empreinte (85 l.373-374)
  }
  const battle = get().battle!;
  const bcc = bonus(effectiveChar(attacker, 'capacite-de-combat'));
  const remaining = cleaveTargets(battle, attacker, hitIds);
  // Frappe Mortelle : la poursuite EXIGE d'avoir tué la cible enchaînée (LDB 14 l.9) ; la Taille enchaîne sur une touche.
  const fmStop = fm && wasChain && !isOutOfAction(target);
  if (!battle.over && count < bcc && remaining.length && !fmStop) {
    set({ pendingCleave: { attackerId: attacker.id, hitIds, count, fm }, battle: { ...battle } });
  } else {
    set({ pendingCleave: null, battle: { ...battle } });
  }
}

/**
 * CE QU'ON FAIT APRÈS UN COUP APPLIQUÉ (#1508) — ÉCRITURE UNIQUE de la queue d'un coup, jouée par le
 * site d'origine quand rien ne l'a suspendu, et par la DERNIÈRE reprise sinon (`resumeMeleeAfterSuspension`).
 * Tout ce qu'elle joue DÉPEND de l'issue du coup : le jouer avant le dé de sauvegarde, c'est le juger
 * sur une touche dont l'effet sera peut-être ignoré (LDB 85 l.98).
 *
 * La touche est lue TELLE QU'ELLE A SURVÉCU (`hitModifiers.toucheSauvee`) : le coup a bien eu lieu
 * (LDB 13 l.123), seul son effet est ignoré.
 *
 * Les deux premières branches sont MUTUELLEMENT EXCLUSIVES par construction du site d'origine
 * (`dualMain` exige la main directrice ; `freeAttack` exige une manœuvre) — leur ordre interne n'a donc
 * aucun effet observable, et l'enchaînement `hero` exige de n'être ni l'une ni l'autre.
 * L'ENCHAÎNEMENT est une DÉCLARATION du site d'origine (`SuiteDeCoup.enchainement`), jamais un défaut
 * muet : les deux portes du balayage ne sont PAS exclusives pour un héros conduit par l'Auto-combat
 * (`tenuParUnHumain` vrai ET `aiDriven` vrai), et un fall-through en aurait ouvert une que le site
 * d'origine avait écartée. Un coup qui ne déclare RIEN est un coup de la machine : il enchaîne comme
 * `autoCleave` l'a toujours fait à la reprise (gardé par `aiDriven`).
 */
export function jouerLaSuiteDuCoup(get: Get, set: SetFn, attacker: Combatant, target: Combatant, res: AttackResult, suite?: SuiteDeCoup): void {
  const touche = res.sauvegarde?.sauve ? toucheSauvee(res) : res;
  if (suite?.freeAttack) {
    applyFreeAttackEffects(get, attacker, target, suite.freeAttack.kind, touche);
    set({ battle: { ...get().battle!, acted: suite.freeAttack.prevActed } }); // gratuite : l'Action rendue APRÈS le `markActed` de l'application
  }
  // Maniement de deux armes (LDB 10 l.767-773) : la main directrice a touché → sélection de la 2ᵉ cible.
  if (suite?.dualMain && touche.hit) {
    // Exception Critique : la 2ᵉ frappe utilise la valeur du tableau des Critiques — lue sur l'ÉTAPE de
    // Critique que l'application vient d'appender à la séquence (elle n'existe qu'après le coup). Jouée
    // depuis un APPLIER (reprise d'une sauvegarde), cette poussée vit encore dans la FENÊTRE d'insertion
    // et pas dans `participants` : les deux se lisent, la fenêtre en dernier (elle est la plus récente).
    const critValue = touche.critical
      ? [...(get().pendingCascade?.participants ?? []), ...etapesDeLaFenetre()].reverse().find((s) => s.kind === 'critical')?.reveal?.dice
      : undefined;
    set({ pendingDualStrike: { attackerId: attacker.id, offWeaponUid: suite.dualMain.offWeaponUid, mainRoll: suite.dualMain.mainRoll, critValue } });
  }
  const enchainement: EnchainementDuCoup = suite?.enchainement ?? { mode: 'auto' };
  switch (enchainement.mode) {
    case 'hero': maybeHeroCleave(get, set, attacker, target, touche, enchainement.wasChain); break;
    case 'chaine': resumeCleaveChain(get, set, attacker, target, enchainement); break; // la chaîne reprend où elle s'est arrêtée
    case 'auto': autoCleave(get, set, attacker, target, touche); break; // balayage d'un attaquant conduit par l'IA
    case 'aucun': break; // le site d'origine a tranché : aucun balayage ne suit ce coup
  }
}

// ---------------------------------------------------------------------------
// Piétinement — action gratuite à 1 Avantage (LDB 85 - Traits de creature.md l.387)
// ---------------------------------------------------------------------------

/** Arme abstraite du Piétinement : Corps à corps (Bagarre), Dégâts = Bonus de Force (+0). */
export const TRAMPLE_WEAPON: Weapon = buildWeapon({ label: 'Piétinement', attackKind: 'pietinement', damage: { plusBF: true, flat: 0, bare: true } });

/** La voie GRATUITE du Piétinement est-elle ouverte ? « Se cabrer » (LDB 85 l.314) paie le Piétinement
 *  d'une Action de MOUVEMENT : elle exige donc que cette Action soit ENTIÈRE (aucun Mouvement dépensé
 *  ce Tour) — sinon le Piétinement retombe sur la voie ordinaire, 1 Avantage (l.320-321). SOURCE UNIQUE
 *  du prédicat : la porte de l'action (`battleTrample`), les PAIEMENTS (`trampleConfirm`, `applyTrample`)
 *  et le libellé de coût de la fenêtre (`useTrampleJetProps`) le consomment tous — un site qui ne testait
 *  que le trait annonçait « coûte 1 Avantage » et n'en débitait aucun. */
export function trampleFreeMove(battle: BattleState | null | undefined, attacker: Combatant): boolean {
  return !!battle && traitCapability(attacker.traits, 'freeTrample') && battle.movementUsed === 0;
}

/** Résout un Piétinement : dépense 1 Avantage (coût de l'action gratuite), SAUF Se cabrer (`freeTrample`,
 *  LDB 85 l.314 : payé d'une Action de Mouvement) → 0 Avantage, mais tout le Mouvement restant du Tour
 *  est dépensé à la place (`movementUsed = M`, précédent `loseNextMovement` l.4928 : « le Tour perd son
 *  Action de Mouvement » s'encode en portant `movementUsed` au plein Mouvement). Puis applique
 *  `resolveTrample` (BF +0, Corps à corps). Ne consomme PAS l'Action (« action gratuite »). */
export function applyTrample(get: Get, set: SetFn, attacker: Combatant, target: Combatant): void {
  const prevActed = get().battle?.acted ?? false; // « action gratuite » : ne doit pas consommer l'Action
  const free = trampleFreeMove(get().battle, attacker);
  campSpend(get, attacker, free ? 0 : 1); // coût : 1 Avantage (LDB 85 l.387) — réserve du camp en mode groupe (AA 11 l.30-38)
  const res = resolveTrample(attacker, target, battleRng());
  applyAttackResult(get, set, attacker, target, TRAMPLE_WEAPON, res, false); // pose acted=true (attaque standard)… ; Piétinement = résolution instantanée (pas de modale)
  const battle = get().battle!;
  set({ battle: { ...battle, acted: prevActed, movementUsed: free ? Math.max(battle.movementUsed, mountMovement(battle, attacker)) : battle.movementUsed } }); // …qu'on restaure : le Piétinement est gratuit ; Se cabrer y consomme l'Action de Mouvement
}

/** Résolution IA des attaques d'Arme GRATUITES « disponibles » (`grantFreeAttack {when:'available'}` —
 *  aujourd'hui l'état Frénésie, LDB 21 l.33 : « un Test de CC gratuit chaque Round ») d'un combattant PILOTÉ
 *  PAR L'IA. Gate `!aiDriven` : ennemi OU héros en Auto-combat (un héros MANUEL la déclenche lui-même via
 *  l'affordance UI `hasFreeWeaponAttack`). DÉLÈGUE chaque op au MÊME résolveur que les attaques gratuites
 *  RÉACTIVES (`applyTalentFreeAttack` : plafond, coût d'Avantage, jet d'attaque, Action préservée) — un seul
 *  résolveur partagé, plus de chemin frenzy-spécifique ni de jet dupliqué. Cible = adversaire adjacent.
 *
 *  REND SA SUSPENSION (#1852) : une frappe qui ouvre une fenêtre de défense ARRÊTE la file — une
 *  attaque gratuite est un Test d'attaque COMPLET (LDB 85 l.41-43), donc résolue entièrement, fenêtre
 *  du défenseur comprise, avant que la suivante soit déclarée. */
export function aiAvailableFreeAttack(get: Get, set: SetFn, actor: Combatant): boolean {
  if (!aiDriven(get(), actor) || isOutOfAction(actor)) return false;
  const battle = get().battle;
  if (!battle || battle.over || !actor.pos) return false;
  const target = battle.combatants.find(
    (t) => t.kind !== actor.kind && !isOutOfAction(t) && !!t.pos && combatDistance(actor, t) <= 1,
  );
  if (!target) return false;
  for (const { op, cap } of availableFreeAttackOps(actor))
    if (applyTalentFreeAttack(get, set, actor, op, { targetId: target.id, key: 'arme', cap })) return true;
  return false;
}

/**
 * LES GRATUITES D'UN COMBATTANT, EN UNE FILE (#1852) — les attaques d'Arme « disponibles » (Frénésie,
 * LDB 21 l.33) PUIS les gratuites de créature (Morsure/Caudale/Piétinement…, LDB 85), dans l'ordre du
 * code existant (inchangé : le RAW est muet sur l'ordre de N gratuites). UN SEUL appel pour les trois
 * sites qui chaînaient les deux résolveurs sans lire le verdict du premier (`defenseConfirm`, le tour
 * d'IA, la reprise de manœuvre) : la file S'ARRÊTE à la PREMIÈRE fenêtre ouverte, et l'appelant qui
 * reçoit `true` ne reprend NI le tour NI la suite. Les unités NON consommées restent en tête de
 * `pendingFreeAttacks` ; ce qui les rappelle à la fermeture dépend du chemin (un coup interrompu par
 * un Critique à dévier n'a aujourd'hui personne pour les redemander — #1858).
 *
 * `disponibles` : les gratuites d'Arme ne suivent QUE l'Action (jamais une gratuite — celle que nomme la
 * `suite` de la fenêtre —, ni une manœuvre gratuite), le site le déclare.
 */
export function drainerLesGratuites(get: Get, set: SetFn, actor: Combatant, opts: { disponibles: boolean }): boolean {
  if (defenseEnCours(get())) return true; // une fenêtre est déjà vivante : la file attend sa fermeture
  if (opts.disponibles && aiAvailableFreeAttack(get, set, actor)) return true;
  return aiCreatureFreeAttacks(get, set, actor);
}

// ── Attaques GRATUITES accordées par un TALENT déclenché (Assaut féroce `onHit`, Frappe réactive
//    `onCharged`) : op `grantFreeAttack{when:'immediate'}` portée en DONNÉE par le talent. Résolution
//    INSTANTANÉE (motif aiAvailableFreeAttack — pas de modale), arme TENUE, Action PRÉSERVÉE. La frappe est
//    OUVERTE par le hook `freeAttack` que `runCombatFlow` appelle sur le `do`/`grantFreeAttack` — un
//    éventuel jet préalable (Frappe réactive : Test d'Initiative LDB 10 l.496-500) est un nœud Flow
//    `test` EN AMONT (cadence-aware : héros manuel = jet influençable ; ennemi/auto = inline). ──

/** Résout UNE attaque gratuite de talent contre la cible `fa.targetId` (un TIERS : le chargeur pour Frappe
 *  réactive, la victime touchée pour Assaut féroce) : plafond /Round (`fa.cap` = niveau, via
 *  `freeAttacksThisTurn[fa.key]`) + 1× par chargeur ; coût (Avantage) ; puis frappe INSTANTANÉE à l'arme
 *  tenue, Action préservée. Le plafond borne aussi la récursion (un onHit qui touche → +1 attaque, recomptée
 *  → s'arrête au niveau). Appelée par le hook `freeAttack` quand `runCombatFlow` exécute le `do`/`grantFreeAttack`
 *  (le Test préalable a déjà réussi en amont, c'est un nœud Flow). */
function applyTalentFreeAttack(get: Get, set: SetFn, actor: Combatant, op: Extract<GameOp, { op: 'grantFreeAttack' }>, fa: FreeAttackFreeze): boolean {
  const target = inBattleId(get().battle, fa.targetId);
  if (!target || isOutOfAction(actor) || isOutOfAction(target) || !actor.pos || !target.pos) return false;
  if ((actor.weapons[0]?.type ?? 'melee') !== 'melee') return false; // attaque d'arme de mêlée (l'arme tenue)
  const uses = actor.freeAttacksThisTurn ?? {};
  if ((uses[fa.key] ?? 0) >= fa.cap) return false; // plafond /Round atteint (= niveau du talent)
  const ck = `${fa.key}:${target.id}`;
  if (op.perChargerOncePerRound && (uses[ck] ?? 0) >= 1) return false; // 1 riposte par chargeur (Frappe réactive)
  if (op.advantageCost != null && actor.advantage < op.advantageCost) return false; // Avantage insuffisant
  if (op.advantageOrMovement && actor.advantage <= 0) return false; // simplifié : Avantage requis (« ou Mouvement » = raffinement)
  if (op.advantageCost != null) campSpend(get, actor, op.advantageCost); // réserve du camp en mode groupe (AA 11 l.30-38) / le combattant (LDB)
  else if (op.advantageOrMovement) campSpend(get, actor, 1);
  actor.freeAttacksThisTurn = { ...uses, [fa.key]: (uses[fa.key] ?? 0) + 1, ...(op.perChargerOncePerRound ? { [ck]: 1 } : {}) };
  const prevActed = get().battle?.acted ?? false; // gratuite : Action préservée
  // L'Action entre AVEC le coup : la MÊME suite va à la fenêtre du défenseur SURFACÉ et à l'application
  // instantanée, et la reprise rend l'Action APRÈS son `markActed`.
  const suite: SuiteDeCoup = { freeAttack: { kind: fa.key, prevActed } };
  // Défenseur SURFACÉ : la frappe passe par la MÊME couture d'ouverture que les autres gratuites
  // (patron `applyFreeAttack`) — suspendue ici, appliquée à `defenseConfirm` (Action restaurée).
  // REND sa suspension (#1852) : l'appelant s'arrête, la frappe suivante attend la fermeture.
  if (maybeOpenDefense(get, set, actor, target, actor.weapons[0], suite)) return true;
  const r = resolveAttack(get, actor, target);
  if (!r) return false;
  if (applyAttackResult(get, set, actor, r.victim ?? target, r.weapon, r.res, false, undefined, suite)) return true; // conséquence influençable ouverte (Critique, sauvegarde) : même suspension
  // MÊME écriture de queue que la reprise ; enchaînement absent = `auto` (LDB 85 l.362).
  jouerLaSuiteDuCoup(get, set, actor, r.victim ?? target, r.res, suite);
  return false;
}

/** HOOK `freeAttack` (injecté dans la brique `combat/triggeredTest` par `createCombatSlice`) : pont
 *  exécuteur de Flow → vraie frappe. Appelé par `runCombatFlow` sur un `do`/`grantFreeAttack`. REND la
 *  suspension de la frappe (#1852) — le dispatcher d'ops s'arrête à la première fenêtre ouverte. */
export function freeAttackHookImpl(get: Get, set: SetFn, actor: Combatant, op: Extract<GameOp, { op: 'grantFreeAttack' }>, fa: FreeAttackFreeze): boolean {
  return applyTalentFreeAttack(get, set, actor, op, fa);
}

/** Résout les attaques gratuites DÉCLENCHÉES des talents de `actor` pour `trigger` (contre `victim`) —
 *  source : les `effects` du talent (donnée). Le Flow de chaque talent est JOUÉ par `runCombatFlow` (le
 *  nœud `choice`/`test` éventuel y est cadence-aware ; le `do`/`grantFreeAttack` ouvre la frappe via le
 *  hook contre `victim`, le tiers threadé dans `ctx.freeAttack`). Vaut héros ET IA. */
export function resolveFreeAttacks(get: Get, set: SetFn, actor: Combatant, trigger: EffectTrigger, victim: Combatant | undefined): boolean {
  if (!victim) return false;
  // TOUTES les sources (Talent/Trait/Atout/État), pas seulement les talents : une réaction `grantFreeAttack`
  // (Frappe réactive `onCharged`, Assaut féroce `onHit`, et demain un Trait de créature) est jouée
  // indifféremment du KIND. On NE garde que les Flows qui accordent une attaque gratuite (`flowHasFreeAttack`) :
  // ils ciblent le TIERS via `freeAttack` ; les autres effets de ces triggers sont déjà joués par `fireTriggers`.
  for (const src of freeAttackSourcesOf(actor)) {
    for (const eff of src.effects) {
      if (eff.trigger !== trigger || !flowHasFreeAttack(eff.flow)) continue;
      if (defenseEnCours(get())) return true; // fenêtre vivante : la source suivante se déclarera à la fermeture
      // L'ENTITÉ PORTEUSE de la réaction (Talent/Trait/Atout, taguée par `withSource`) voyage dans
      // l'`opsCtx` : un Test enfoui dans son Flow en DÉRIVE son enjeu (#1262 V2 L6d).
      runCombatFlow(
        { mode: 'combat', get, set, target: actor, caster: actor, label: src.label, freeAttack: { targetId: victim.id, cap: src.cap, key: src.key }, ...(eff.source ? { opsCtx: { source: eff.source } } : {}) },
        eff.flow,
      );
      // Le verdict se lit sur le SLOT : le Flow (nœud `test`/`choice` en amont) ne le remonte pas.
      if (defenseEnCours(get())) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Attaques GRATUITES de créature (Taille & traits) — chacune au prix de 1 Avantage, OPPOSÉE
// (la cible se défend Parade/Esquive, comme une attaque normale) et NE consomme PAS l'Action.
// RAW : Piétinement (LDB 85 l.387, BF+0), Morsure/Attaque caudale (l.237/47, Indice) ; priorité
// Morsure/Caudale (Indice) avant Piétinement (BF+0) — cf. exemple Aventures à Ubersreik.
// ---------------------------------------------------------------------------

/** Arme abstraite d'une attaque gratuite : Piétinement = BF+0 ; Morsure/Caudale/Tentacules = +Indice
 *  (BF inclus). STAMPE `attackKind: kind` → la pose/Condition lit le champ STABLE, pas le nom. */
export function freeAttackWeapon(kind: string, bonus: number): Weapon {
  if (kind === 'pietinement') return TRAMPLE_WEAPON; // déjà stampé attackKind:'pietinement'
  const name = kind === 'caudale' ? 'Attaque caudale' : kind === 'cornes' ? 'Cornes' : kind === 'tentacules' ? 'Tentacules' : 'Morsure';
  return buildWeapon({ label: name, attackKind: kind, damage: { plusBF: false, flat: bonus } }); // Indice de créature (SB déjà inclus) → « +N »
}

/** Type de pose d'attaque (rendu créature) : le champ STABLE `weapon.attackKind` stampé à la
 *  construction (multilangue-safe), sinon repli par NOM (armes de statbloc/dérivées/grantNatural non
 *  stampées : « Griffe »/« Morsure »…). undefined = arme manufacturée → pose générique du gabarit.
 *  Sert au tintage de l'animation d'attaque (AnimatedPlanToken) et à la Condition Flow `attackKind`. */
export function creatureAttackKind(weapon: { attackKind?: string; label: string }): string | undefined {
  if (weapon.attackKind) return weapon.attackKind;
  const n = weapon.label.toLowerCase();
  if (n.includes('morsure')) return 'morsure';
  if (n.includes('caudale') || n.includes('queue')) return 'caudale';
  if (n.includes('piétin') || n.includes('pietin')) return 'pietinement';
  if (n.includes('corne')) return 'cornes';
  if (n.includes('tentacule')) return 'tentacules';
  if (n.includes('griffe') || n === 'arme') return 'arme';
  return undefined;
}

/** Effets RAW post-touche d'une attaque gratuite (sur PB infligés) : Attaque caudale → cible de Taille
 *  INFÉRIEURE → À Terre (LDB 85 l.47). Le Venin est un `effects` du trait (dispatché par le
 *  `fireTriggers('onHit')` d'`applyAttackResult`, atteint aussi par les attaques gratuites). */
export function applyFreeAttackEffects(get: Get, attacker: Combatant, target: Combatant, kind: string, res: AttackResult): void {
  if (!res.hit) return; // les effets se déclenchent sur une touche réussie
  // (Constricteur = `effects` onHit du trait → Empêtré sur toute touche, appliqué par le
  //  `fireTriggers('onHit')` d'`applyAttackResult` — atteint aussi les attaques gratuites.)
  if (!res.woundsLost) return; // les effets suivants exigent des Points de Blessure perdus
  // Effets onHit AUTHORÉS de la manœuvre (donnée éditable `maneuver.effects` : Attaque caudale → À Terre
  // si la cible est plus petite ; Tentacules → Empêtré) — appliqués SCOPED à cette manœuvre (≠ l'onHit
  // générique des traits/atouts), via le MÊME exécuteur de Flow.
  const mEffects = maneuverEffectsOf(attacker, kind);
  if (mEffects.length) applyTriggeredEffects(get, attacker, mEffects, 'onHit', { victim: target, woundsDealt: res.woundsLost, attackKind: kind, rng: battleRng() }).forEach((l) => get().log(l));
  // (Vampirique = `effects` onHit du trait `vampirique`, gaté par la Condition Flow `attackKind: 'morsure'` →
  //  Vol de vie ; appliqué par le `fireTriggers('onHit')` d'`applyAttackResult` — atteint aussi les attaques gratuites.)
  // (Venin = `effects` du trait `Venin`, appliqué par le `fireTriggers('onHit')` d'`applyAttackResult`.)
}

/** Cible d'une attaque gratuite : adversaire adjacent actif (Piétinement exige une Taille inférieure). */
function freeAttackTarget(battle: BattleState, c: Combatant, kind: string): Combatant | undefined {
  if (kind === 'pietinement') return trampleTarget(battle, c);
  return battle.combatants.find((t) => t.kind !== c.kind && !isOutOfAction(t) && !!t.pos && !!c.pos && combatDistance(c, t) <= 1);
}

/** Résout UNE attaque gratuite de `kind` contre `target`, OPPOSÉE et GRATUITE : ouvre la modale de
 *  défense (héros) → suspendu (true) ; sinon résout instantanément (opposé auto, ou passif si Surpris),
 *  restaure l'Action et applique les effets. Dépense `cost` Avantage (coût RAW par type :
 *  Cornes/Tentacules 0, Morsure/Caudale/Piétinement 1). */
function applyFreeAttack(get: Get, set: SetFn, attacker: Combatant, target: Combatant, kind: string, bonus: number, cost = 1): boolean {
  const prevActed = get().battle?.acted ?? false;
  campSpend(get, attacker, cost); // réserve du camp en mode groupe (AA 11 l.30-38) / le combattant (LDB)
  const weapon = freeAttackWeapon(kind, bonus);
  // La manœuvre entre AVEC sa suite (#1508) : ses effets authored attendent la touche RÉELLE et se jouent
  // à la reprise sur la touche telle qu'elle a survécu (`toucheSauvee`) — le coup a bien eu lieu (LDB 13
  // l.123), seul son EFFET est ignoré (LDB 85 l.98) ; l'Action, gratuite, est rendue par la reprise.
  const suite: SuiteDeCoup = { freeAttack: { kind, prevActed } };
  if (maybeOpenDefense(get, set, attacker, target, weapon, suite)) return true; // suspendu : resolve via défense
  const res = resolveMelee(attacker, target, weapon, battleRng(), { defense: cannotDefend(target) ? 'none' : bestDefenseMode(target) });
  if (applyAttackResult(get, set, attacker, target, weapon, res, false, undefined, suite)) return true;
  // La queue NON suspendue est LA MÊME écriture que celle de la reprise (effets de la manœuvre, Action
  // rendue) — et l'enchaînement absent y vaut `auto` (LDB 85 l.362).
  jouerLaSuiteDuCoup(get, set, attacker, target, res, suite);
  return false;
}


// ── Wrappers IA des manœuvres (jet d'attaquant + RÉSOLVEUR GÉNÉRIQUE + clôture). Source UNIQUE du
//    « rouler le jet d'attaquant PUIS résoudre PUIS checkBattleOver » pour l'IA : le flux JOUEUR
//    passe par `FLOWS.maneuver` (modale différée) qui appelle les MÊMES `rollManeuverAttacker` /
//    `resolveManeuver`. Les noms publics historiques sont conservés (tests + chemin du sort Souffle). ──

/** Souffle / Vomissement (IA & sort) : roule le jet d'attaquant (CT, +40 pour le Vomi) puis résout la
 *  zone via le RÉSOLVEUR GÉNÉRIQUE. `centerOverride` = point d'impact imposé du sort « Souffle » (LDB 47).
 *  Clôt par `checkBattleOver`. */
export function applyAreaAttack(get: Get, set: SetFn, attacker: Combatant, a: CreatureAttack, centerOverride?: Combatant): boolean {
  const atk = rollManeuverAttacker(attacker, a.stat ?? 'capacite-de-tir', battleRng(), maneuverAttackerDifficulty(a.kind));
  const suspended = resolveManeuver(get, set, attacker, a.def, a.indice, atk, a.avantage, centerOverride);
  if (!suspended) checkBattleOver(get, set); // la cascade de défense (héros) porte son propre checkBattleOver à la fermeture
  return suspended;
}

/** Langue préhensile (IA) : jet CT puis résolution ; gratuit (Action préservée). L'entraînement de la proie
 *  (pull) est une conséquence POST-TOUCHE (hook `maneuverPostHit`), jouée pour la voie silencieuse ET la voie
 *  cascade. Renvoie `true` si une défense de héros a suspendu (reprise à la fermeture). */
export function applyTongue(get: Get, set: SetFn, attacker: Combatant, a: CreatureAttack): boolean {
  const battle = get().battle;
  if (!battle || !attacker.pos) return false;
  // Cible = la plus proche (sélection IDENTIQUE à resolveManeuver pour une manœuvre à cible unique) ; on la
  // PASSE explicitement (chosenTarget) → la proie tirée = la proie touchée, sans ré-dériver.
  const foes = battle.combatants.filter((c) => c.kind !== attacker.kind && !isOutOfAction(c) && !!c.pos);
  const target = foes.length ? foes.reduce((p, c) => (chebyshev(attacker.pos!, p.pos!) <= chebyshev(attacker.pos!, c.pos!) ? p : c)) : undefined;
  const atk = rollManeuverAttacker(attacker, a.stat ?? 'capacite-de-tir', battleRng());
  const suspended = resolveManeuver(get, set, attacker, a.def, a.indice, atk, a.avantage, target);
  if (!suspended) checkBattleOver(get, set);
  return suspended;
}

/** Entraînement de la Langue préhensile (LDB 85 l.213) — conséquence POST-TOUCHE injectée dans
 *  `applyManeuverEffects` (hook `maneuverPostHit`) : sur une TOUCHE (un pion *Empêtré* posé ce tour) d'une
 *  proie plus PETITE, elle est tirée vers la créature (pathing impur : `pullToward` + traversées de zone).
 *  Joué à l'IDENTIQUE pour la voie silencieuse (non-héros/Surpris) ET la voie cascade (héros influençable). */
function maneuverPostHitImpl(get: Get, set: SetFn, attacker: Combatant, def: ManeuverDef, tgt: Combatant, hadEmpetre: number): string[] {
  if (def.kind !== 'langue' || !tgt.pos || !attacker.pos) return [];
  if (!(stacks(tgt, COND.empetre) > hadEmpetre && sizeGap(attacker.size, tgt.size) > 0)) return [];
  const b = get().battle;
  if (!b) return [];
  const r = pullToward(get().scene!, attacker.pos, tgt.pos, chebyshev(attacker.pos, tgt.pos), { blocked: occupied(b, tgt) });
  if (r.pulled <= 0) return [];
  const from = { ...tgt.pos };
  placeCombatant(tgt, get().scene, r.dest);
  bus.emit(EVT.ANIM_MOVE, { id: tgt.id, path: [{ ...r.dest }] });
  applyZoneCrossings(get, set, tgt, [...tilesBetween(from, r.dest), { ...r.dest }]); // une traction TRAVERSE (Mur de feu, L11)
  return [tr('cs.tonguePull', { name: attacker.label, foe: tgt.label })];
}
// Câble la conséquence POST-TOUCHE (entraînement de la Langue) dans le résolveur feuille (inversion de
// dépendance : combatManeuvers reste sans import de combatFlow). Enregistré à l'import, comme les appliers.
setManeuverPostHitHook(maneuverPostHitImpl);

/** Hurlement fantomatique (IA) : PAS de jet d'attaquant ; dépense TOUS les Avantages (min 2, LDB 85
 *  l.135). Renvoie false si pas assez d'Avantage. Clôt par `checkBattleOver`. */
export function applyWail(get: Get, set: SetFn, attacker: Combatant): boolean {
  if (!attacker.pos || attacker.advantage < 2) return false;
  const a = creatureAttacks(attacker.traits ?? []).find((x) => x.kind === 'hurlement');
  if (!a) return false;
  // Pas de jet d'attaquant ; dépense TOUT (l.135). Le « Test de Résistance ou Brisé » (nœud Flow `test`)
  // ouvre une cascade influençable pour un héros MANUEL → SUSPEND (checkBattleOver déféré à sa fermeture).
  const suspended = resolveManeuver(get, set, attacker, a.def, a.indice, null, attacker.advantage);
  if (!suspended) checkBattleOver(get, set);
  return true; // « a agi » (creatureFreeAttacks.test le vérifie en cadence auto) ; la suspension est lue via `maneuverCascadePending`
}

/** Regard pétrifiant (IA) : jet CT puis résolution ; l'IA dépense TOUT (min 1), +1 DR/Av (LDB 85 l.290).
 *  Consomme l'Action. Renvoie false si pas d'Avantage/cible. Clôt par `checkBattleOver`. */
export function applyGaze(get: Get, set: SetFn, attacker: Combatant): boolean {
  if (!attacker.pos || attacker.advantage < 1) return false;
  const a = creatureAttacks(attacker.traits ?? []).find((x) => x.kind === 'regard');
  if (!a) return false;
  const spent = attacker.advantage; // l'IA met tout (min 1)
  const atk = rollManeuverAttacker(attacker, a.stat ?? 'capacite-de-tir', battleRng());
  const suspended = resolveManeuver(get, set, attacker, a.def, a.indice, atk, spent);
  set({ battle: markActed(get, set, get().battle!) }); // Regard = Action de la créature (l.238)
  if (!suspended) checkBattleOver(get, set); // héros influençable → checkBattleOver à la fermeture de la cascade
  return true;
}

/** Étreinte glaciale (IA) : jet CC puis résolution ; 2 Av + Action (LDB 85 l.138). Renvoie false si pas
 *  assez d'Avantage / pas de cible adjacente. Clôt par `checkBattleOver`. */
export function applyChillGrasp(get: Get, set: SetFn, attacker: Combatant): boolean {
  if (!attacker.pos || attacker.advantage < 2) return false;
  const battle = get().battle;
  if (!battle || !battle.combatants.some((c) => c.kind !== attacker.kind && !isOutOfAction(c) && c.pos && combatDistance(attacker, c) <= 1)) return false;
  const a = creatureAttacks(attacker.traits ?? []).find((x) => x.kind === 'etreinte');
  if (!a) return false;
  const atk = rollManeuverAttacker(attacker, a.stat ?? 'capacite-de-combat', battleRng());
  const suspended = resolveManeuver(get, set, attacker, a.def, a.indice, atk, a.avantage);
  set({ battle: markActed(get, set, get().battle!) }); // Étreinte = Action de la créature (l.112)
  if (!suspended) checkBattleOver(get, set); // héros influençable → checkBattleOver à la fermeture de la cascade
  return true;
}

/** Attaque-ACTION spéciale de l'IA (Regard pétrifiant / Étreinte glaciale) à la place de l'attaque
 *  normale, si la créature en a le trait et l'Avantage requis. Renvoie true si elle a agi. */
export function aiMaybeSpecialAction(get: Get, set: SetFn, enemy: Combatant): boolean {
  if (enemy.kind !== 'enemy' || isOutOfAction(enemy)) return false;
  const atks = creatureAttacks(enemy.traits ?? []);
  if (atks.some((a) => a.kind === 'regard') && enemy.advantage >= 1) return applyGaze(get, set, enemy);
  if (atks.some((a) => a.kind === 'etreinte') && enemy.advantage >= 2) return applyChillGrasp(get, set, enemy);
  // Battement (LDB 10 l.103 / AA 13 l.17) : un PNJ Engagé qui porte le Talent retire de l'Avantage à un
  // adversaire ARMÉ pas plus grand que lui, quand la réserve/l'Avantage adverse est non nul (sinon inutile).
  if (hasBattement(enemy)) {
    const battle = get().battle;
    const foe = battle?.combatants.find((c) => battementEligible(enemy, c) && spendableAdvantage(get, c) > 0);
    if (foe) return aiBattement(get, set, enemy, foe);
  }
  // Distraire (LDB 10 l.364 / AA 13 l.51) : à défaut d'attaque productive, un PNJ qui porte le Talent nie
  // l'Avantage d'un adversaire adjacent (Mouvement) — cible non déjà distraite, avec de l'Avantage à nier.
  if (hasDistraire(enemy) && enemy.pos) {
    const battle = get().battle;
    const foe = battle?.combatants.find(
      (c) => distraireEligible(enemy, c) && !c.distractedRounds && spendableAdvantage(get, c) > 0 && !!c.pos && combatDistance(enemy, c) <= 1,
    );
    if (foe) return aiDistraire(get, set, enemy, foe);
  }
  return false;
}

/** L'IA exécute un Battement (Action, LDB 10 l.103) : jet de Corps à corps NON opposé (inline), retire de
 *  l'Avantage adverse via `resolveBattement`. Consomme l'Action. Clôt par `checkBattleOver`. */
function aiBattement(get: Get, set: SetFn, enemy: Combatant, foe: Combatant): boolean {
  const battle = get().battle;
  if (!battle) return false;
  const atk = rollManeuverAttacker(enemy, 'capacite-de-combat', battleRng());
  const line = resolveBattement(get, enemy, foe, atk);
  set({ battle: { ...markActed(get, set, get().battle!), action: null, log: [...get().battle!.log, ev('attack', line, enemy.id, foe.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
  return true;
}

/** L'IA exécute un Distraire (Mouvement, LDB 10 l.364) : Test OPPOSÉ Athlétisme vs Calme (inline). Sur
 *  victoire, la cible est distraite (ne génère plus d'Avantage jusqu'à la fin du prochain Round). Consomme
 *  l'Action (l'IA renonce à attaquer ce tour). Clôt par `checkBattleOver`. */
function aiDistraire(get: Get, set: SetFn, enemy: Combatant, foe: Combatant): boolean {
  const battle = get().battle;
  if (!battle) return false;
  // Athlétisme du mover / Calme du foe : ces valeurs SONT nues (carac effective + avances, LDB 09 l.17)
  // — elles se posent telles quelles en grandeur de départage (LDB 12 l.160).
  const atkValue = distraireAttackValue(enemy), defValue = distraireDefenseValue(foe);
  const atk = { ...rollSansPilote(get, enemy, atkValue, 'intermediaire', battleRng()), base: atkValue };
  const def = { ...rollTest(defValue, 'intermediaire', battleRng()), base: defValue };
  const line = resolveDistraire(enemy, foe, atk, def);
  set({ battle: { ...markActed(get, set, get().battle!), action: null, log: [...get().battle!.log, ev('attack', line, enemy.id, foe.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
  return true;
}

/**
 * REPRISE d'une attaque de MÊLÉE suspendue par une fenêtre de la victime (choix de Déviation, pose du
 * dé de sévérité) : RÉ-ENTRE `applyAttackResult` avec ce que la fenêtre a tranché, puis rejoue le tail
 * de l'attaque que l'appelant d'origine n'a pas atteint (balayage, Maladresse du défenseur). SOURCE
 * UNIQUE des deux reprises — une 3ᵉ fenêtre de mêlée n'ajoute pas une 3ᵉ copie de ce tail.
 */
function resumeMeleeAfterSuspension(
  get: Get, set: SetFn, attackerId: string, targetId: string, weapon: Weapon, res: AttackResult,
  deviated: boolean | undefined, crit: CriticalResolved | undefined,
  // Ce que la fenêtre de SAUVEGARDE (#1508) suspend EN PLUS du Critique : les drapeaux du coup que
  // l'applier doit rendre à l'identique (une Empoignade reprise sans son drapeau infligerait des
  // Dégâts, LDB 14 l.159), et la chaîne de balayage parquée par le maillon suspendu.
  opts?: SuiteDeCoup,
): void {
  const battle = get().battle;
  if (!battle) return;
  const attacker = inBattleId(battle, attackerId);
  const target = inBattleId(battle, targetId);
  if (!attacker || !target) return;
  // RE-SUSPENDU par la fenêtre SUIVANTE (sauvegarde ratée → Critique à dévier) : la suite lui est
  // REPASSÉE, elle voyage dans SA charge, et c'est la DERNIÈRE reprise qui la joue — une fois.
  if (applyAttackResult(get, set, attacker, target, weapon, res, deviated, crit, opts)) return;
  // Maladresse du défenseur héros (parade/esquive active ratée sur un double, LDB 14 l.19) : DUE dès ce
  // jet, et poussée AVANT la queue du coup — l'enchaînement que la queue joue peut rouvrir une fenêtre de
  // défense sur la cible SUIVANTE, et la Maladresse de CE défenseur s'intercalerait alors dans ce coup-là.
  if (target.kind === 'hero' && defenderFumbled(res, target.weapons[0], target) && !isOutOfAction(target)) {
    // Maladresse = étape APPENDUE à la cascade, et le SEUL jet hôte dont la donnée vit SUR l'étape
    // (`fumble` : arme + Oups ! à tirer) — la branche `jet:'fumble'` du mint l'exige, il n'y a pas de
    // pending à poser. La séquence avance déviation → Maladresse, et la reprise IA suit la fermeture
    // (fumbleConfirm → cascadeNext).
    pushHost(get, set, { id: `cons-fumble-${target.id}`, kind: 'fumbleJet', jet: 'fumble', actorId: target.id, fumble: { weapon: target.weapons[0], result: null } });
  }
  // La queue du coup — ÉCRITURE UNIQUE partagée avec les sites d'origine (`attackConfirm`,
  // `defenseConfirm`) : la reprise ne rejoue pas SA version de ce qui suit un coup.
  jouerLaSuiteDuCoup(get, set, attacker, target, res, opts);
}

/** Résout une Déviation Critique — invoquée par l'applier de l'étape de séquence 'deviation' (la reprise
 *  de l'IA est gérée par la FERMETURE de la séquence, pas ici). « Subir » applique le Critique pré-tiré
 *  (`dev.crit`) tel quel ; « Dévier » l'ignore (−1 PA). Union discriminée :
 *  - `melee` → RÉ-ENTRE `applyAttackResult` avec la décision (son tail décision-indépendant tourne UNE fois) ;
 *  - `self` → auto-contenu (opposé/magie n'ont pas de tail) : déflexion vs Critique pré-tiré directement. */
export function resolveDeviation(get: Get, set: SetFn, dev: PendingDeviation, deviate: boolean): void {
  const battle = get().battle;
  if (!battle) return;
  if (dev.mode === 'melee') {
    resumeMeleeAfterSuspension(get, set, dev.attackerId, dev.targetId, dev.weapon, dev.res, deviate, deviate ? undefined : dev.crit, dev.suite);
    return;
  }
  // mode 'self' (opposé/tir/magie) : auto-contenu — pas de ré-entrée d'attaque, pas de tail.
  const target = inBattleId(battle, dev.targetId);
  if (!target) return;
  const log: string[] = [];
  if (deviate) deflectCrit(target, dev.location, dev.deflectExtraWounds, log); // −1 PA, Critique ignoré, + Blessures recalculées
  else {
    applyCritAndFinalize(get, set, target, dev.location, dev.isCoupCritique, dev.overkill, log, dev.ctx, dev.woundsBefore, dev.crit, true); // Subir : Critique pré-tiré
    // 7bis (#316) : Subir un Critique OPPOSÉ dévié = Blessure Critique → le bus émet `onCrit` pour l'attaquant.
    emitOpposedCrit(get, set, inBattleId(battle, dev.ctx.attackerId), target, dev.location, dev.ctx.weaponObj, log);
  }
  // 0 PB → À Terre (LDB 18 l.15) ; cible neutralisée → on lève engagement + effets psy (parité avec la mêlée).
  if (target.wounds.current <= 0 && !target.dead && !hasCondition(target, COND.inconscient)) applyZeroWounds(target);
  if (isOutOfAction(target)) {
    clearEngagementOf(get().battle?.combatants ?? [], target.id);
    clearPsychOf(get().battle?.combatants ?? [], target.id);
      refreshAllDefendedPsych(get().battle?.combatants ?? []); // l’Amour ne se clôt pas à la chute d’UN aimé (l.75) : verdict re-mesuré
  }
  // Le rebond d'« Attaques en chaîne » (`LDB 47 l.340`) que la touche suspendue ici DÉCLARAIT : c'est
  // cette reprise qui le joue, sur les PB que Subir/Dévier vient de fixer.
  if (dev.touche) log.push(...jouerLeRebond(get, set, dev.touche));
  if (log.length) {
    const b = get().battle;
    if (b) set({ battle: { ...b, log: [...b.log, ...evLines(log, 'crit', dev.attackerId, dev.targetId)] } }); // acteur = attaquant, sujet = cible (parité mode melee)
  }
  checkBattleOver(get, set);
}

/** Applier UNIQUE de l'étape « Blessure critique » (#1426) : le Critique est celui que le PLI post-dé a
 *  posé (ou celui du mint quand aucune table n'est déclarée). L'étape offrait-elle ses voies ?
 *   · OUI — « Subir » applique le Critique montré, « Dévier » l'ignore (−1 PA) : `resolveDeviation` ;
 *   · NON — le Critique est subi, et sa RÉVÉLATION reste DUE (aucune fenêtre ne l'a montrée) : la
 *     reprise part sans décision (`deviated: undefined`), ce qui laisse le chemin normal la produire.
 *  `resume:false` → la reprise de l'IA part de la FERMETURE de séquence (`cascadeNext`/`cascadeFinish`
 *  → `resumeSuspendedAI`). Le reste de l'attaque re-déclenché APPEND ses conséquences à la séquence
 *  (préservées par le liveMerge de commitStep). */
registerCascadeApplier('deviation', (get, set, step) => {
  const dev = step.deviation;
  if (!dev) return;
  if (!step.options && dev.mode === 'melee') {
    resumeMeleeAfterSuspension(get, set, dev.attackerId, dev.targetId, dev.weapon, dev.res, undefined, dev.crit, dev.suite);
    return;
  }
  resolveDeviation(get, set, dev, step.chosen === 'devier');
});

/** L'IA enchaîne ses attaques gratuites de créature après l'attaque principale (chacune 1 Avantage,
 *  OPPOSÉE). File initialisée au 1er appel (Morsure/Attaque caudale des traits, PUIS Piétinement de
 *  Taille — les Indices d'abord), puis poursuivie après chaque modale de défense résolue. Retourne
 *  true si une modale s'est ouverte (tour SUSPENDU). */
export function aiCreatureFreeAttacks(get: Get, set: SetFn, enemy: Combatant): boolean {
  if (enemy.kind !== 'enemy' || isOutOfAction(enemy)) { enemy.pendingFreeAttacks = undefined; return false; }
  const battle = get().battle;
  if (!battle || battle.over) { enemy.pendingFreeAttacks = undefined; return false; }
  if (enemy.pendingFreeAttacks === undefined) {
    const atks = creatureAttacks(enemy.traits ?? []);
    // Empoignade tenue par un Tentacule (LDB 85 l.405) UNIQUEMENT : « vous pouvez utiliser une Action d'Attaque
    // GRATUITE pour résoudre l'Empoignade AU LIEU de l'Action de la créature » — le tentacule tient pendant que
    // le corps agit. Pour CHAQUE adversaire encore Empoigné et en vie : Test opposé de Force GRATUIT (résolveur
    // PARTAGÉ `resolveGrappleOpposed`), instantané. La créature N'EST PAS verrouillée (ai.ts saute le verrou
    // LOT B pour le trait tentacule) → elle CONSERVE son Action normale. La Langue préhensile (p.340) n'a PAS
    // cette dérogation (« voir page 163 ») → elle est verrouillée comme tout grappleur (LOT B), pas ici.
    if (atks.some((a) => a.kind === 'tentacules')) {
      for (const fid of [...(enemy.grapplingWith ?? [])]) {
        const foe = inBattleId(battle, fid);
        if (!foe || isOutOfAction(foe) || !areGrappling(enemy, foe)) continue;
        const line = resolveGrappleOpposed(get, enemy, foe);
        const b = get().battle; if (!b) break;
        set({ battle: { ...b, log: [...b.log, ev('attack', line, enemy.id, foe.id)] } });
        bus.emit(EVT.SCENE_DIRTY);
        checkBattleOver(get, set);
      }
    }
    // Attaques de ZONE/spéciales (Souffle/Vomi/Langue/Hurlement) : des UNITÉS de la file — une
    // manœuvre de zone qui touche des HÉROS ouvre une cascade de défense INFLUENÇABLE (elle SUSPEND), donc
    // elle doit être RÉSUMABLE : la file est persistée sur l'ennemi ; la reprise re-appelle
    // `aiCreatureFreeAttacks` (file DÉFINIE → bloc d'init sauté, on enchaîne l'unité suivante). Ordre RAW
    // conservé : Souffle → Vomi → Langue → Hurlement, AVANT les gratuites de mêlée.
    const zoneKinds = (['souffle', 'vomi', 'langue', 'hurlement'] as const).filter((k) => atks.some((a) => a.kind === k));
    const traitKinds: string[] = [];
    for (const a of atks) {
      if (a.trigger !== 'free') continue;
      if (a.kind === 'morsure' || a.kind === 'caudale') traitKinds.push(a.kind);
      // Tentacules (LDB 85 l.405 : « Gagnez une Action d'Attaque gratuite PAR tentacule ») :
      // count× entrées (« 8 Tentacules +9 » → 8), coût d'Avantage 0.
      if (a.kind === 'tentacules') for (let i = 0; i < (a.count ?? 1); i++) traitKinds.push('tentacules');
    }
    // Cornes : Attaque gratuite gagnée EN CHARGEANT (LDB 85), sans coût d'Avantage.
    const cornes = enemy.chargedThisTurn && atks.some((a) => a.kind === 'cornes') ? ['cornes'] : [];
    enemy.chargedThisTurn = false; // consommée
    enemy.pendingFreeAttacks = [...zoneKinds, ...cornes, ...traitKinds, 'pietinement']; // zone d'abord, Piétinement (Taille) en dernier
  }
  while (enemy.pendingFreeAttacks.length) {
    const kind = enemy.pendingFreeAttacks[0];
    const b2 = get().battle; if (!b2 || b2.over) break;
    if (defenseEnCours(get())) return true; // fenêtre vivante : l'unité reste EN TÊTE de file, reprise à la fermeture
    // Manœuvres de ZONE/spéciales : résolveur propre (opposé) — une défense de HÉROS ouvre une cascade
    // influençable et SUSPEND (return true → reprise à la fermeture via `resumeManeuverDefense`).
    if (kind === 'souffle' || kind === 'vomi' || kind === 'langue' || kind === 'hurlement') {
      enemy.pendingFreeAttacks.shift();
      const a = creatureAttacks(enemy.traits ?? []).find((x) => x.kind === kind);
      if (!a) continue;
      let suspended = false;
      // Hurlement : pas d'opposition, mais son « Test de Résistance ou Brisé » (nœud Flow `test`) ouvre une
      // cascade influençable pour un héros MANUEL → SUSPEND aussi (lue via `maneuverCascadePending`).
      if (kind === 'hurlement') { if (enemy.advantage >= 2) applyWail(get, set, enemy); suspended = maneuverCascadePending(get); }
      else if (enemy.advantage >= a.avantage) suspended = kind === 'langue' ? applyTongue(get, set, enemy, a) : applyAreaAttack(get, set, enemy, a);
      if (suspended) return true;
      continue;
    }
    // Coût en Avantage PAR TYPE (RAW, lu de creatureAttacks) : Cornes (Charge) et Tentacules = 0 ;
    // Morsure/Caudale = 1 ; Piétinement (Taille) = 1, SAUF Se cabrer (LDB 85 l.314, `freeTrample`) qui
    // paie l'Action de Piétinement de son Action de Mouvement au lieu d'1 Avantage → coût 0 Avantage,
    // MAIS exige l'Action de Mouvement encore ENTIÈRE ce Tour (`movementUsed === 0`) : une créature qui
    // a déjà bougé (approche vers sa cible, cf. `runEnemyAI` case 'move') a déjà dépensé la sienne —
    // le Piétinement gratuit lui est refusé (elle reste éligible au Piétinement normal à 1 Avantage).
    // Une entrée inabordable est SAUTÉE (pas de break : des Tentacules à coût 0 restent jouables
    // derrière une Morsure inabordable).
    const freeTrampleMove = kind === 'pietinement' && traitCapability(enemy.traits, 'freeTrample');
    if (freeTrampleMove && b2.movementUsed > 0) { enemy.pendingFreeAttacks.shift(); continue; }
    const cost = kind === 'pietinement' ? (freeTrampleMove ? 0 : 1) : creatureAttacks(enemy.traits ?? []).find((a) => a.kind === kind)?.avantage ?? 1;
    if (enemy.advantage < cost) { enemy.pendingFreeAttacks.shift(); continue; }
    const target = freeAttackTarget(b2, enemy, kind);
    if (!target) { enemy.pendingFreeAttacks.shift(); continue; }
    const bonus = kind === 'pietinement' ? 0 : creatureAttacks(enemy.traits ?? []).find((a) => a.kind === kind)?.bonus ?? 0;
    enemy.pendingFreeAttacks.shift();
    if (freeTrampleMove) set({ battle: { ...get().battle!, movementUsed: mountMovement(get().battle!, enemy) } }); // Se cabrer : dépense l'Action de Mouvement (LDB 85 l.314)
    if (applyFreeAttack(get, set, enemy, target, kind, bonus, cost)) return true; // modale ouverte → reprise via defenseConfirm
  }
  enemy.pendingFreeAttacks = undefined; // file épuisée
  return false;
}

/** Une cascade de DÉFENSE à une manœuvre de zone IA est-elle ouverte (le tour de la créature est SUSPENDU) ?
 *  Testé après `aiMaybeSpecialAction` (Regard/Étreinte peuvent l'ouvrir) pour ne pas AVANCER le tour. */
function maneuverCascadePending(get: Get): boolean {
  const p = get().pendingCascade;
  return !!p && p.purpose === 'combat' && !!p.maneuverResume;
}

/** Reprend le tour de la créature après la fermeture d'une cascade de DÉFENSE à sa manœuvre de zone
 *  (Souffle/Regard/…). Miroir du « tail » de `defenseConfirm` : les héros ont défendu (influençable), on
 *  vérifie la fin de combat, puis on enchaîne les attaques gratuites RESTANTES (file persistée) — qui peuvent
 *  ROUVRIR une cascade (souffle → vomi → …) — sinon on avance. `free` = manœuvre gratuite (ne re-déclenche
 *  PAS les libres d'Arme post-Action, comme `defenseConfirm` pour la gratuite que nomme la `suite` de sa fenêtre). */
export function resumeManeuverDefense(get: Get, set: SetFn, resume: { attackerId: string; free: boolean }): void {
  checkBattleOver(get, set);
  const battle = get().battle;
  if (!battle || battle.over) return;
  const attacker = inBattleId(battle, resume.attackerId);
  if (attacker && !isOutOfAction(attacker)) {
    // Manœuvre-ACTION (Regard/Étreinte) → libres d'Arme (Frénésie) après l'Action, puis la file de
    // créature : UN appel qui s'arrête à la première fenêtre ouverte (#1852).
    if (drainerLesGratuites(get, set, attacker, { disponibles: !resume.free })) return;
  }
  resumeEnemyTurn(get, set); // → advanceTurn
}


/**
 * Composant d'incantation (LDB 46 l.107-113, règle optionnelle `magic-composant`) — appelé UNE fois
 * au point d'incantation d'un Sort d'Arcane/Domaine par un lanceur qui suit les règles de PERSONNAGE
 * (#143 — `followsCharacterRules`, PAS un proxy `kind`). Si un composant pour ce Sort est possédé :
 * il est CONSUMÉ « même si aucune Incantation Imparfaite n'a été obtenue » (l.111), une ligne est
 * journalisée, et `true` est renvoyé → toute Imparfaite de ce lancement sera dégradée (passé en
 * `componentDowngrade` à `applyMiscast`). Mute `caster.componentSpells`. Renvoie `false` (sans effet)
 * si la règle est éteinte, le lanceur ne suit pas les règles de Personnage, ou aucun composant ne
 * couvre le Sort. `lines` reçoit la ligne « composant consumé » le cas échéant.
 */
export function useSpellComponent(caster: Combatant, spellId: string, lines: string[]): boolean {
  if (!followsCharacterRules(caster) || rule('magic-composant') !== true) return false;
  const owned = caster.componentSpells ?? [];
  if (!owned.includes(spellId)) return false;
  const i = owned.indexOf(spellId);
  const next = [...owned];
  next.splice(i, 1); // retire UNE occurrence (consommée par l'incantation)
  caster.componentSpells = next;
  lines.push(tr('cf.componentConsumed', { name: caster.label }));
  return true;
}

// ---------------------------------------------------------------------------
// Les tirages d'INCANTATION IMPARFAITE / COLÈRE en étapes à TABLE (#942 L6) — LDB 46 l.34-80 et
// LDB 40 l.52-89 ; les relances prescrites (l.54-55) sont des étapes INSÉRÉES.
// ---------------------------------------------------------------------------

// Une entrée par table RÉELLE de `miscast.json` (Mineure/Majeure LDB, leurs révisions VDM, Colère
// des dieux) : fourchettes et ids STABLES projetés depuis la donnée PAR RÉFÉRENCE (le moteur les
// expose), et la ligne d'affichage est le libellé de l'entrée atteinte par le dé EFFECTIF.
// La catégorie Codex où vivent les LIGNES est DÉCLARÉE par la table elle-même (`codexCategory`,
// miscast.json, #1117) : sans catégorie déclarée, l'enjeu reste au foyer du `kind` (repli déclaré).
for (const table of MISCAST_TABLES) {
  registerTableStep(table.id, {
    label: table.label,
    die: 100,
    rows: MISCAST_TABLE_ROWS[table.id],
    lines: (die) => [miscastRowAt(table.id, die).label],
    ...(table.codexCategory ? { entryCategory: table.codexCategory } : {}),
  });
}

/** DÉCLARATION du tirage d'une Imparfaite/Colère : la table de la sévérité EN VIGUEUR (LDB ou VDM),
 *  d100, et — pour la COLÈRE SEULE — le +10 par Point de Péché, déclaré en modificateur VIVANT
 *  (`modPerActor`, résolu au moment du jet par `liveTableDecl`) : LDB 40 l.46, « Lorsque vous
 *  effectuez un lancer sur le tableau de la Colère des dieux, ajoutez-y +10 pour chaque Point de
 *  Péché que vous avez déjà accumulé ». Hors Colère AUCUN modificateur n'est déclaré — c'est
 *  exactement ce que le moteur fait (`rollMiscast` n'ajoute les Péchés qu'à la Colère) ; en déclarer
 *  un afficherait une ligne que le contrecoup n'appliquerait pas. Le dé de la déclaration est le dé
 *  NATUREL, ce que `rollMiscast` attend en `forcedRoll`. La table de la Colère monte jusqu'à « 151+ »
 *  (LDB 40 l.89) : aucun plafond à borner, et son plancher est 01 (`clamp` inutile, `mod` positif). */
export function miscastTableDecl(ctx: PendingMiscastStep): CascadeTableDecl {
  return {
    tableId: miscastTableId(ctx.severity), spec: { n: 1, sides: 100 },
    ...(ctx.severity === 'colere' ? { modPerActor: { counter: 'sinPoints' as const, factor: 10 } } : {}),
  };
}

/** DÉCLARATION de l'étape à TABLE d'une Imparfaite/Colère (dé à poser), sous l'`id` que l'appelant
 *  lui donne : une relance pousse une étape de plus dans la MÊME séquence, chacune avec son id. La
 *  déclaration se rend NUE (jamais mintée ici) — l'append la passe à `pushTable`, la relance de
 *  l'applier à `tableStep` : deux fenêtres différentes, un seul mint chacune. */
function miscastTableSpec(caster: Combatant, ctx: PendingMiscastStep, id: string): TableSpec {
  const colere = ctx.severity === 'colere';
  return {
    id,
    kind: 'miscastTable', actorId: caster.id,
    icon: colere ? 'magic/power' : 'fire/blast',
    label: colere ? tr('step.colereDesDieux') : tr(ctx.severity === 'majeure' ? 'step.miscastMajeure' : 'step.miscastMineure'),
    table: miscastTableDecl(ctx),
    // Deux tirages de nature DIFFÉRENTE partagent ce `kind` d'étape : le contrecoup magique (LDB 46)
    // et la sanction divine (LDB 40, +10 par Point de Péché) ne mettent pas la même chose en jeu.
    stake: combatStakeRef(colere ? 'wrathTable' : 'miscastTable'),
    miscast: ctx,
  };
}

/** Points de Péché VIVANTS pesant sur CE tirage : ceux de la Colère du lanceur, 0 partout ailleurs
 *  (le moteur ne les ajoute qu'à la Colère). SOURCE UNIQUE lue par la déclaration (via `modPerActor`,
 *  au moment du jet) ET par le moteur (à l'application) — jamais un instantané pris à l'ouverture. */
function liveSinPoints(caster: Combatant, severity: MiscastSeverity): number {
  return severity === 'colere' ? caster.sinPoints ?? 0 : 0;
}

/**
 * La LIGNE tirée (`result.id` via le dé posé, jamais un re-lookup local) résout le contrecoup. Une
 * ligne à RELANCE n'applique RIEN : elle INSÈRE l'étape du lancer suivant, pilotable à son tour —
 * « Chaos en cascade : effectuez un nouveau lancer sur le Tableau des Incantations Imparfaites
 * Majeures » (LDB 46 l.55) ; « Multiplication d'infortune : effectuez deux lancers sur cette table,
 * en relançant tous les résultats entre 91-00 » (l.54, d'où les deux étapes filles `rerollHigh`, chez
 * qui un dé effectif ≥ 91 insère une étape de plus sur la même table).
 */
registerCascadeApplier('miscastTable', (get, set, step, caster) => {
  const ctx = step.miscast;
  const rolled = step.table?.result;
  if (!ctx || !rolled || !caster) return;
  const m = rollMiscast(ctx.severity, battleRng(), liveSinPoints(caster, ctx.severity), ctx.domainId, rolled.roll);
  // GARDE DE LIGNE : le moteur doit retomber sur la ligne AFFICHÉE par le résolveur d'étape. Les deux
  // lisent le même compteur vivant ; s'il bougeait entre le dé et la validation, on appliquerait une
  // autre ligne que celle montrée — ça s'arrête ici, ça ne se subit pas en silence.
  if (m.rowId !== rolled.id) {
    throw new Error(`Imparfaite : la ligne appliquée (« ${m.rowId} ») n'est pas celle affichée (« ${rolled.id} », dé ${rolled.roll}→${rolled.die}) — le modificateur a bougé entre le jet et sa validation.`);
  }
  if (m.reroll) {
    // Le JET de cette étape compte pour la Corruption de Sorcellerie même s'il ne fait que relancer
    // (LDB 49 l.5, verbatim au site de `finishMiscast`) : par JET, pas par Imparfaite résolue.
    const lines = sorceryCorruptionLines(get, set, caster, ctx, m.tableRolls);
    // Les lancers d'une relance ne portent PAS le +10 de Péché (la Colère ne relance jamais).
    const relance = (over: Partial<PendingMiscastStep>, suffixe: string) =>
      tableStep(miscastTableSpec(caster, { ...ctx, ...over }, `${step.id}-${suffixe}`));
    // Un mint qui REFUSE n'insère rien (politique de la porte : DEV throw, PROD dégradé) — le canal
    // `insert` ne porte donc que les étapes réellement montées.
    const sortie = (insert: readonly (BuiltCascadeStep | undefined)[]) =>
      ({ insert: insert.filter((s): s is BuiltCascadeStep => !!s), ...(lines.length ? { consequences: freeCons(lines) } : {}) });
    if (ctx.rerollHigh && rolled.die >= 91) return sortie([relance({}, 'relance')]);
    if (m.reroll === 'mineure-x2') return sortie([relance({ rerollHigh: true }, 'x2-0'), relance({ rerollHigh: true }, 'x2-1')]);
    return sortie([relance({ severity: 'majeure', rerollHigh: false }, 'majeure')]);
  }
  const fin = finishMiscast(get, set, caster, ctx, m);
  // L'étape de révélation porte déjà ces lignes quand elle est poussée : pas de doublon de rangée.
  return fin.affichee ? undefined : { consequences: freeCons(fin.lines) };
});

/**
 * Tire sur la table d'Incantation Imparfaite / Colère des dieux et applique au
 * LANCEUR les effets mécaniques modélisés (États, Blessures ignorant BE+PA,
 * réduction à 0 + Inconscient). Retourne les lignes de journal.
 */
export function applyMiscast(get: Get, set: SetFn, caster: Combatant, severity: MiscastSeverity, opts?: { suppressReveal?: boolean; componentDowngrade?: boolean; sorceryCorruption?: boolean; domainId?: string }): string[] {
  // Composant d'incantation (LDB 46 l.111, règle optionnelle) : si un composant adapté a été
  // SACRIFIÉ pour ce Sort (consommation décidée et journalisée au point d'incantation — cf.
  // `useSpellComponent`), il absorbe les pires effets du contrecoup : « toute Incantation Imparfaite
  // Majeure devient Mineure, et aucune Incantation Imparfaite Mineure n'a d'effet ». La transformation
  // de sévérité est PURE (engine/miscast.componentDowngrade) ; ne touche pas la Colère des dieux.
  if (opts?.componentDowngrade && severity !== 'colere') {
    const downgraded = componentDowngrade(severity);
    if (downgraded === null) {
      // Mineure → aucun effet : le composant a tout absorbé, on n'ouvre PAS d'Imparfaite.
      return [tr('cf.componentAbsorbs', { name: caster.label })];
    }
    return [
      tr('cf.componentDowngrade', { name: caster.label }),
      ...applyMiscast(get, set, caster, downgraded, { suppressReveal: opts.suppressReveal, sorceryCorruption: opts.sorceryCorruption, domainId: opts.domainId }),
    ];
  }
  const ctx: PendingMiscastStep = {
    casterId: caster.id, severity,
    ...(opts?.domainId ? { domainId: opts.domainId } : {}),
    ...(opts?.sorceryCorruption ? { sorceryCorruption: true } : {}),
    ...(opts?.suppressReveal ? { suppressReveal: true } : {}),
  };
  // Le tirage de la table est une étape à TABLE, poussée NON RÉSOLUE (#1426) : aucun effet n'est
  // appliqué avant que le DERNIER dé ne tombe (relances comprises), et il tombe au RANG de l'étape.
  // Ce qu'il advient de l'étape appartient au socle (`cascade.poserLeCurseur`) : fenêtre pour le
  // siège qui tient le LANCEUR (c'est SON Imparfaite), résolution d'office si nul siège ne le tient —
  // l'option « Dés fixés » n'y ajoute que la POSE. Le +10 par Point de Péché de la Colère (LDB 40
  // l.53) est lu par la déclaration au MOMENT du jet (`miscastTableDecl`, `modPerActor`).
  //
  // La porte est celle de la séquence de COMBAT (`pushTable`), comme la révélation qui la dénoue et
  // le Test imbriqué qui la suit (`triggeredTest` → `pushCombatStep`) : le sous-arbre d'un contrecoup
  // tient dans UNE séquence. Hors combat, une séquence d'un autre `purpose` en vol est donc PARQUÉE
  // puis reprise — doctrine du slot, jamais un écrasement.
  pushTable(set, (index) => miscastTableSpec(caster, ctx, `miscast-table-${caster.id}-${index}`));
  return emitMiscastTriggered(get, set, caster); // l'Imparfaite EST déclenchée, seule sa ligne reste à tirer
}

/**
 * Corruption de SORCELLERIE — LDB 49 l.5, verbatim : « À chaque fois qu'un pratiquant de la
 * Sorcellerie fait un jet sur le Tableau des Incantations Imparfaites, il gagne 1 Point de
 * Corruption. » C'est PAR JET : `jets` Points, gagnés UN PAR UN (chaque gain rejoue son seuil de
 * Corruption, LDB 19 l.70 — un gain groupé n'en jouerait qu'un). Compte identique dans les deux
 * modes (dé tiré inline : tous les jets de la cascade ; dé posé : le jet de CETTE étape).
 * #143 : personnage (`followsCharacterRules`), pas un proxy `kind`.
 */
function sorceryCorruptionLines(get: Get, set: SetFn, caster: Combatant, ctx: PendingMiscastStep, jets: number): string[] {
  if (!ctx.sorceryCorruption || !followsCharacterRules(caster)) return [];
  const lines: string[] = [];
  for (let i = 0; i < jets; i++) lines.push(...gainCorruption(get, set, caster, 1));
  return lines;
}

/** DÉNOUEMENT de l'étape à table (applier `miscastTable`) : expiation du Péché, ops
 *  immédiats, Corruption de Sorcellerie, étape de révélation, Test imbriqué. Le déclencheur
 *  `onMiscast` n'est PAS ici : il vaut par ÉVÉNEMENT d'Imparfaite, donc au site d'`applyMiscast`
 *  (`emitMiscastTriggered`) — une Multiplication d'infortune dénoue DEUX fois. */
function finishMiscast(get: Get, set: SetFn, caster: Combatant, ctx: PendingMiscastStep, m: MiscastResult): { lines: string[]; affichee: boolean } {
  const { severity } = ctx;
  const lines = [m.log];
  // « Après le lancer et avoir appliqué le résultat, réduisez vos Points de Péché
  // de 1, jusqu'à un minimum de 0 » (LDB 40 l.46). Le total DÉCROÎT depuis sa valeur VIVANTE : un
  // Péché gagné pendant la fenêtre de pose serait effacé par une réécriture depuis un instantané.
  if (severity === 'colere' && (caster.sinPoints ?? 0) > 0) {
    caster.sinPoints = Math.max(0, (caster.sinPoints ?? 0) - 1);
    lines.push(tr('cf.sinExpiated', { name: caster.label, n: caster.sinPoints }));
  }
  // Ops IMMÉDIATS de la rangée (États, Blessures et leur mitigation DÉCLARÉE, Corruption,
  // pénalités/blocages d'incantation, réduction à 0) — applicateur unique, AVANT le Test imbriqué
  // que la même rangée porte (LDB 46 l.55-75, LDB 40 l.56-89).
  const opsCtx: OpsCtx = {
    rng: battleRng(),
    label: m.label,
    now: get().gameTime,
    // ANCRAGE DE RÈGLE des effets posés par le contrecoup : la RANGÉE tirée (`m.rowId`, l'autorité de
    // ligne) dans la catégorie que sa table déclare — sans lui, la pastille d'un effet durable
    // (« Purifier la chair », `LDB 40 l.75`) s'afficherait nue, sans fiche ni popover.
    source: miscastRowSource(miscastTableId(severity), m.rowId),
    onCorruption: followsCharacterRules(caster) ? (n, align) => gainCorruption(get, set, caster, n, align) : undefined,
  };
  lines.push(...applyOps(caster, m.ops, opsCtx));
  // Sorcellerie : 1 Point de Corruption PAR JET de table (LDB 49 l.5, verbatim en tête de
  // `sorceryCorruptionLines`). Dé tiré inline → `m.tableRolls` compte TOUS les jets de la cascade
  // (relance 96-00, deux lancers d'une Multiplication et leurs relances 91-00) ; dé posé → 1, les
  // jets des étapes de relance ayant déjà été comptés par l'applier. Même total dans les deux modes.
  lines.push(...sorceryCorruptionLines(get, set, caster, ctx, m.tableRolls));
  // « Un jet = une modale » : le héros voit la conséquence (Colère/Imparfaite) INLINE dans la séquence
  // partagée (étape d'affichage). `suppressReveal` est un paramètre d'appel qu'AUCUN appelant ne pose
  // aujourd'hui (Focalisation interrompue comprise, l.2197) — cf. #942, ticket de suite.
  const affichee = caster.kind === 'hero' && !ctx.suppressReveal;
  if (affichee) {
    const colere = severity === 'colere';
    const title = colere ? 'Colère des dieux' : 'Incantation Imparfaite';
    // Charge riche `reveal` (table : dé + lignes) — comme le Critique ; le dé reste observable (Péché +10).
    const reveal: RevealEntry = { kind: 'miscast', title, dice: m.rolls[0], lines, subjectId: caster.id, severity: 'grave' };
    // FOLD : l'Imparfaite/Colère est une ÉTAPE de la cascade d'incantation ACTIVE (parité avec le
    // Critique d'attaque, appendu via pushReveal) — plus une cascade SÉPARÉE. L'append vise la
    // cascade `purpose:'combat'` en cours (jet d'incantation), ou démarre « Conséquences » si aucune
    // (Focalisation interrompue suppressReveal / contextes hors-cast) — la MÊME séquence que l'étape
    // à table qu'elle dénoue et que le Test imbriqué qui la suit. Le mint de révélation
    // (`revealToStep`) monte l'étape ; l'en-tête de la RANGÉE est plus court que le titre de la
    // charge, et son icône dit la sévérité — d'où les deux surcharges.
    pushCombatStep(set, (index) => revealToStep(reveal, index, {
      label: colere ? 'Colère des dieux' : 'Imparfaite',
      icon: colere ? 'magic/power' : 'fire/blast',
    }));
  }
  // Test imbriqué de l'entrée (« Résistance ou Sonné ») — résolu CADENCE-AWARE par l'exécuteur de Flow
  // UNIQUE, APRÈS les ops immédiats et l'étape de révélation : un lanceur HÉROS manuel le subit comme une
  // étape de cascade INFLUENÇABLE (Chance/Pacte/Résilience), appendue à la cascade d'incantation active ;
  // un ENNEMI/cadence auto le jette inline. Plus de jet imbriqué silencieux (fin du goal « aucun jet
  // silencieux héros »). `onFailHard` (Purifier la chair −4 DR → Inconscient) est honoré dans la branche
  // d'échec via la Condition Flow `slThreshold ≤ −4` (cf. `mkTest`).
  if (m.testFlow) runCombatFlow({ mode: 'combat', get, set, target: caster, caster, label: m.label, opsCtx }, m.testFlow);
  // `affichee` : l'étape de révélation PORTE déjà ces lignes — l'appelant en cascade ne doit pas les
  // rendre une SECONDE fois en conséquence de son étape (mêmes lignes, deux rangées à l'écran).
  return { lines, affichee };
}

/**
 * Effet déclenché « sur une Imparfaite » (`onMiscast`) — dispatcher générique via le bus. Émis UNE
 * fois par ÉVÉNEMENT d'Imparfaite (une par appel réel ; le repli-composant qui absorbe tout retourne
 * AVANT). C'est le déclencheur qui le dicte, pas le nombre de dés : son libellé joueur est « Sur une
 * Imparfaite » (`ui/compendium/triggerLabels.ts`), et ses consommateurs (hooks de machinerie +
 * `effects` de donnée) réagissent à l'ÉVÉNEMENT, pas à chaque lancer d'une cascade de relances.
 * D'où l'émission au site d'`applyMiscast` et NON dans le dénouement : sous l'option « Dés fixés »,
 * une Multiplication d'infortune dénoue DEUX fois et sur-déclencherait. Inerte sans donnée.
 */
function emitMiscastTriggered(get: Get, set: SetFn, caster: Combatant): string[] {
  const lines: string[] = [];
  emitCombatEvent('onMiscast', { get, set, battle: get().battle!, self: caster, sink: (line) => lines.push(line), triggerCtx: { rng: battleRng() } });
  return lines;
}

/**
 * Clôt une action JOUEUR résolue (soin / incantation / Focalisation, et futures actions hors combat) :
 * EN COMBAT consomme l'Action (`acted`/`action:null`/`selectedSpellId:null`), journalise dans `battle.log`
 * et vérifie la fin de combat ; HORS COMBAT trace le `journal`. C'est la SORTIE commune — `combatOrParty`
 * fournit la RÉSOLUTION des acteurs (`actorIn`/`touchActors`), ce helper la finalisation.
 * `selectedSpellId:null` est neutre pour une action non-incantation (déjà null).
 */
export function finishPlayerAction(get: Get, set: SetFn, lines: string[], kind: CombatEventKind = 'info'): void {
  const battle = get().battle;
  if (battle) {
    // Filet de sécurité (cf. applyAttackResult) : un hook profond (ex. `onGainCondition` d'un ennemi
    // touché par les ops d'un sort de soutien, OU un rider de Domaine) a pu pousser des lignes dans la
    // file différée APRÈS les drains inline d'`applyCast` → on les DRAINE ici et on les passe en `extra`
    // au routage unique, qui les écrit dans le MÊME `log` que `lines`. File vide (heal/focus) → no-op.
    const b = markActed(get, set, battle); // scellé AVANT la copie du journal : les lignes du Test d'approche en font partie
    const extra = drainPendingLog(get, set);
    set({ battle: { ...b, action: null, selectedSpellId: null } });
    journaliser(get, set, lines, kind, { extra });
    bus.emit(EVT.SCENE_DIRTY);
    checkBattleOver(get, set);
  } else {
    set({ party: [...get().party] });
    journaliser(get, set, lines, kind);
    bus.emit(EVT.SCENE_DIRTY);
  }
}

// (Le sommeil de groupe vit dans state/restFlow — `sleepParty`, source unique de la nuit.)

/** Refus d'un cast (sort introuvable, contrecoup bloquant, hors portée/LdV…) : EN COMBAT, poussé
 *  dans le FEED de combat (`battle.log`) — là où le joueur lit — au lieu du `journal` d'exploration
 *  (invisible pendant le combat). Hors combat (incantation hors combat, couture D), repli sur le
 *  journal. Sans ça, un cast refusé faisait un « clic muet » qui passait pour un bug (B4). */
/**
 * Ce qui met la CIBLE hors d'atteinte d'un Sort (portée LDB 47, puis Ligne de Vue LDB 46 l.121 :
 * « vous devez toujours être capable de voir […] votre cible » — binaire, pas de malus de couvert),
 * ou `null`. MESURE UNIQUE : `castSpell` la journalise (héros ET IA) et le CLIC du joueur
 * (`castClickCommit`) la DIT au point du geste. `range` null = portée non chiffrable (« le lanceur »,
 * « au toucher », spécial) → pas de gate. Un Souffle suit le TRAIT (BE+20 m, LDB 85), pas le champ Portée.
 */
export function castTargetBlock(get: Get, caster: Combatant, spell: SpellData, target: Combatant): { reason: 'range' | 'los'; detail: PlayerText } | null {
  if (!get().battle || !caster.pos || !target.pos || caster.id === target.id) return null;
  const range = spell.breathAttack
    ? Math.max(1, Math.ceil((bonus(effectiveChar(caster, 'endurance')) + 20) / 2))
    : spellRangeTiles(spell.range, caster);
  if (range != null && combatDistance(caster, target) > range)
    return { reason: 'range', detail: tr('cf.castOutOfRange', { spell: spell.label, range }) };
  if (castSightBlocked(get, caster.pos, target.pos))
    return { reason: 'los', detail: tr('cf.noLineOfSight', { spell: spell.label }) };
  return null;
}

export function castRefused(get: Get, set: SetFn, actor: Combatant, msg: string): void {
  journaliser(get, set, [msg], 'cast', { actorId: actor.id });
}

/** Incante un sort/prière sur une cible (résolution via src/engine/magic). */
/** Ouvre la modale d'incantation (jet différé, façon attaque) : pose `pendingCast` sans lancer. */
export function castSpell(
  get: Get,
  set: SetFn,
  caster: Combatant,
  target: Combatant,
  label: string,
  fromGrimoire = false,
) {
  const spell = resolveSpell(label);
  if (!spell) {
    castRefused(get, set, caster, tr('cf.spellNotFound', { spell: label }));
    return;
  }
  // Contrecoups bloquants (LDB 46/40) : « Propos ésotériques », « Vous abusez de ma patience »…
  const blocked = castBlockedBy(caster, castInfoIsPrayer(spell) ? 'priere' : 'langue');
  if (blocked) {
    castRefused(get, set, caster, tr(castInfoIsPrayer(spell) ? 'cf.cannotPray' : 'cf.cannotCast', { name: caster.label, reason: blocked }));
    return;
  }
  // Verrou de Péché du culte (MDG 11 l.148 — Stromfels : Invocation retirée à 2 Péchés, Béni à 5) —
  // lu en DONNÉE (`GodData.sinLocks`), générique à tout culte qui en porterait.
  const sinLock = prayerSinLock(caster, spell);
  if (sinLock) {
    castRefused(get, set, caster, tr('cf.sinLock', { cult: sinLock.cult, name: caster.label, talent: tr(sinLock.family === 'beni' ? 'cf.talentBeni' : 'cf.talentInvocation'), sin: String(caster.sinPoints ?? 0), threshold: String(sinLock.threshold) }));
    return;
  }
  // Lecture au grimoire (LDB 47 l.21) : sort NON mémorisé de son Domaine, NI doublé.
  if (fromGrimoire && !canCastFromGrimoire(caster, spell)) {
    castRefused(get, set, caster, tr('cf.grimoireRefused', { name: caster.label, spell: label }));
    return;
  }
  // Sort « Souffle » (LDB 47 l.509) : délégué à l'attaque de ZONE du Trait — la portée suit le
  // TRAIT (BE+20 m, LDB 85), pas le champ Portée du sort ; résolu comme zone, pas comme Projectile.
  const breathSpell = !!spell.breathAttack;
  const horsAtteinte = castTargetBlock(get, caster, spell, target);
  if (horsAtteinte) {
    castRefused(get, set, caster, horsAtteinte.detail);
    return;
  }
  const focusedNI0 = caster.focus?.spell === spell.id && caster.focus.dr >= (spell.cn ?? 0);
  set({
    pendingCast: {
      casterId: caster.id, targetId: target.id, spellId: spell.id, missile: breathSpell ? false : isMagicMissile(spell),
      focused: focusedNI0, result: null, ...(fromGrimoire ? { grimoire: true } : {}),
    },
  });
  openCastCascade(get, set, caster); // « Une situation = une modale » : hôte la situation d'incantation dans la cascade
  // Lanceur PILOTÉ PAR L'IA : le MOTEUR roule l'incantation (plus de « Lancer » joueur — on ne lance pas
  // le dé d'un combattant automate) ; `castRoll` aiguille ensuite le Contre-sort comme pour tout lanceur.
  // Sans fenêtre, la modale pré-roulée sert de RÉVÉLATION (résultat + « Appliquer », sans « Lancer »).
  if (aiDriven(get(), caster) && get().battle) get().castRoll();
}

// Effet d'auteur `castSpell` (#98, scene.ts) : EN COMBAT, route par CE flux standard — enregistré ici
// (pas dans combatEffects.ts, module FEUILLE qui n'importe rien de combatFlow).
registerCastSpellEffect(castSpell);
// INJECTION du walker de COMBAT dans la porte des dés (#1508) — `combatEffects` ne peut pas importer
// `combat/triggeredTest` (cycle), et l'injection depuis CE module-là arriverait TROP TÔT (il est évalué
// pendant l'init de `combatEffects` : TDZ mesurée sur le holder). Elle se fait donc ICI, au site
// ÉTABLI des injections de ce sens, où `combatEffects` est entièrement initialisé.
registerSuiteCombat((get, set, cible, caster, flow, label) => {
  runCombatFlow({ mode: 'combat', get, set, target: cible, caster: caster ?? cible, label }, flow);
});

/**
 * Le Sort FIGÉ de `pc` est-il encore dissipable ? GARDE UNIQUE du Contre-sort (`LDB 46 l.156`), lue
 * par l'aiguilleur ET par le jet inline — plus deux gardes divergentes.
 *  - `isDispellableSpell` : `LDB 46 l.156` (« Si un Sort vous cible ») ;
 *  - effet d'Incantation Critique EFFECTIVEMENT CHOISI (`pc.critChoice` ÉCRIT — aucun défaut lu ici,
 *    `LDB 46 l.28` : sans choix, l'effet retenu est le lancer sur les Imparfaites Mineures, pas un des
 *    trois) = Force inéluctable → indissipable. La CONDITION diffère par régime, point de lecture
 *    UNIQUE du delta (option `magic-vdm-incantation`) : OFF → `LDB 46 l.32` (DR suffisant requis,
 *    `pc.result.cast`) ; ON → `VDM 02 l.56` (le choix suffit).
 *    « Puissance totale » (`LDB 46 l.31`, `VDM 02 l.55`) reste dissipable, et l'ABOUTISSEMENT du Sort
 *    n'est PAS une condition : `l.156` fait de l'incantation l'objet du Test opposé et rend sa
 *    réussite POSTÉRIEURE.
 */
export function isDispellableCast(pc: PendingCast, spell: SpellLike): boolean {
  if (!pc.result || pc.result.dispelled) return false;
  if (!isDispellableSpell(spell)) return false;
  const ineluctable = pc.critChoice === 'ineluctable'
    && (rule('magic-vdm-incantation') === true || pc.result.cast);
  return !ineluctable;
}

/** Meilleur contre-lanceur d'un lot de candidats : le plus haut Langue (Magick). SOURCE UNIQUE de la
 *  sélection — chant inline (aucun surfacé) et repli IA quand les surfacés déclinent. */
export function bestCounterspeller(candidates: readonly Combatant[]): Combatant | undefined {
  return [...candidates].sort((a, b) => castingValue(b, 'langue', 'magick') - castingValue(a, 'langue', 'magick'))[0];
}

/** Une rangée de la fenêtre a-t-elle CHANTÉ ? Plusieurs contre-lanceurs peuvent tenter contre la
 *  MÊME incantation (#1040, cf. `counterspellConfirm` dans `src/state/combatSlice.ts`) — ce prédicat
 *  ne désigne donc personne : il dit que la fenêtre porte déjà une issue à appliquer, ce que
 *  « Laisser passer » jetterait. PUR (lu aussi par la modale). */
export function counterspellChanted(pcs: PendingCounterspell | null | undefined): boolean {
  return !!pcs?.participants.some((p) => !!p.result);
}

/** Combattants d'une fenêtre de Contre-sort (rangées → acteurs vivants de l'état). PUR. */
export function counterspellActors(s: GameState, pcs: PendingCounterspell | null | undefined): Combatant[] {
  return (pcs?.participants ?? []).map((p) => actorIn(s, p.id)).filter((c): c is Combatant => !!c);
}

/** Cette rangée peut-elle S'UNIR au Test Soutenu ? — au moins un AUTRE candidat de la fenêtre partage
 *  son Domaine sans lui être hostile (`soutenuPartners`, `LDB 46 l.162`). Prédicat UNIQUE, lu par
 *  l'affordance de la modale ET par la garde du geste (`counterspellDeclare`). */
export function counterspellJoinable(s: GameState, pcs: PendingCounterspell | null | undefined, id: string): boolean {
  const actors = counterspellActors(s, pcs);
  const me = actors.find((c) => c.id === id);
  return !!me && soutenuPartners(me, actors).length > 0;
}

/**
 * PHASE 1 (déclaration) en cours ? — une rangée au moins n'a pas encore déclaré. Les JETS y sont
 * VERROUILLÉS (`counterspellEngage`) : chacun choisit d'abord contrer seul / s'unir / passer, et la
 * dernière déclaration FIGE la composition (ni entrée, ni ralliement, ni retrait ensuite).
 * Arbitrage utilisateur 2026-08-04 [entériné 2026-08-04], verbatim aux tickets #1042/#1059. PUR.
 */
export function counterspellDeclarePhase(pcs: PendingCounterspell | null | undefined): boolean {
  return !!pcs?.participants.some((p) => !p.declared);
}

/** Groupe UNI d'une fenêtre : son meneur DÉRIVÉ (`soutenuLeaderOf`) et le Soutien qu'il reçoit
 *  (`soutenuBonusOf`). `null` tant qu'aucune rangée n'est unie. Re-dérivé à chaque lecture — une
 *  déclaration change le meneur tant que la phase de déclaration est ouverte. */
export function counterspellSoutenu(
  s: GameState,
  pcs: PendingCounterspell | null | undefined,
): { leader: Combatant; bonus: number; unis: Combatant[] } | null {
  const ids = new Set((pcs?.participants ?? []).filter((p) => p.declared === 'soutenu').map((p) => p.id));
  const unis = counterspellActors(s, pcs).filter((c) => ids.has(c.id));
  const leader = soutenuLeaderOf(unis);
  if (!leader) return null;
  return { leader, bonus: soutenuBonusOf(unis, leader), unis };
}

/** Soutien qui s'ajoute à la VALEUR du Test de CETTE rangée : le bonus du groupe pour son meneur, 0
 *  pour toute autre rangée. SOURCE UNIQUE — lue par le jet (`FLOWS.counterspell`) et par le
 *  breakdown de la modale, jamais recalculée. */
export function counterspellSoutienFor(s: GameState, pcs: PendingCounterspell | null | undefined, id: string): number {
  const grp = counterspellSoutenu(s, pcs);
  return grp && grp.leader.id === id ? grp.bonus : 0;
}

/** MÊME Soutien que `counterspellSoutienFor`, en DÉTAIL affichable : les contre-lanceurs unis QUI
 *  soutiennent ce meneur (`ids`), pour que la ligne de mod porte sa provenance. `undefined` hors
 *  meneur ou sans Soutien. */
export function counterspellSupportFor(s: GameState, pcs: PendingCounterspell | null | undefined, id: string): SupportDetail | undefined {
  const grp = counterspellSoutenu(s, pcs);
  if (!grp || grp.leader.id !== id || grp.bonus <= 0) return undefined;
  return { count: grp.bonus / 10, bonus: grp.bonus, ids: grp.unis.filter((c) => c.id !== grp.leader.id).map((c) => c.id) };
}

/** Cette rangée LANCE-t-elle le dé de la fenêtre ? — déclarée `solo`, ou MENEUR du groupe uni (le
 *  Soutenu n'a qu'un jet, `LDB 12 l.189`). `pass` ne lance jamais. Prédicat UNIQUE, lu par la garde
 *  du jet (`counterspellEngage`) ET par l'affordance de la rangée (`CastModal`). */
export function counterspellRolls(s: GameState, pcs: PendingCounterspell | null | undefined, part: CounterParticipant): boolean {
  if (part.declared === 'solo') return true;
  if (part.declared !== 'soutenu') return false;
  return counterspellSoutenu(s, pcs)?.leader.id === part.id;
}

/**
 * DÉCLARATION AUTOMATIQUE des rangées non surfacées à l'ouverture de la fenêtre : la fenêtre ne peut
 * pas attendre une décision d'un contrôleur qui n'en rendra jamais. Les rangées TÉMOIN suivent leur
 * repli existant — le meilleur contre-lanceur non surfacé (`bestCounterspeller`, la MÊME sélection que
 * `applyCounterspellFallback`) contrerait, les autres non : `solo` pour lui, `pass` pour elles.
 * Les rangées SURFACÉES restent vierges : c'est leur siège qui déclare.
 */
export function autoDeclareWitnessRows(participants: CounterParticipant[], actors: readonly Combatant[]): CounterParticipant[] {
  const witnesses = participants.filter((p) => !p.interactive);
  const ia = bestCounterspeller(witnesses.map((p) => actors.find((c) => c.id === p.id)).filter((c): c is Combatant => !!c));
  return participants.map((p) => (p.interactive ? p : { ...p, declared: (p.id === ia?.id ? 'solo' : 'pass') as CounterDeclaration }));
}

/** Un geste de dé PRÉ-ARMÉ est-il en cours ? (drapeau de module, cf. `withPreRollFixedDie`). */
let preRollFixedDiePending = false;
export const isPreRollFixedDiePending = (): boolean => preRollFixedDiePending;

/**
 * GESTE ATOMIQUE du dé pré-armé (socle des dés fixés #939 : « Fixer le dé » AVANT le jet, et Résilience
 * pré-jet) — SIÈGE UNIQUE. Le socle procède en deux temps : `roll()` produit un jet NATUREL, puis
 * `apply()` SUBSTITUE la valeur saisie/forcée. Entre les deux, le résultat posé est PROVISOIRE : tout
 * consommateur aval qui s'y branche décide sur un jet qui n'aura jamais existé pour le joueur —
 * trouvaille de recette navigateur (#1029) : dé saisi 99 sur cible 99, la fenêtre de Contre-sort
 * s'ouvrait et se résolvait sur le jet naturel, puis le résultat devenait Critique, laissant à l'écran
 * une Dissipation actée ET un choix d'effet encore dû. Ici : le geste est encadré, les routages
 * s'abstiennent (`routeCounterspell`), et l'aiguillage rejoue UNE fois sur le résultat FINAL.
 */
export function withPreRollFixedDie(get: Get, set: SetFn, roll: () => void, apply: () => void): void {
  preRollFixedDiePending = true;
  try {
    roll();
    apply();
  } finally {
    preRollFixedDiePending = false;
  }
  routeCounterspell(get, set); // no-op hors incantation (aucun `pendingCast`) ou si déjà routé
}

/**
 * Aiguillage UNIQUE du Contre-sort (Dissipation, `LDB 46 l.156`) contre l'incantation FIGÉE de
 * `pendingCast` — un seul MOMENT (le jet) et une seule garde (`isDispellableCast`), pour TOUT lanceur
 * (héros, ennemi IA, ennemi conduit par le siège MJ) : la répartition suit la POSSESSION, jamais le
 * `kind` (doctrine #989/#1005) —
 *  - au moins un contre-lanceur SURFACÉ (`jetSurfaced` : héros non-IA, ennemi sous siège MJ) → la
 *    FENÊTRE s'ouvre : chaque candidat y a sa rangée (surfacé = interactive, IA = témoin), chacun
 *    peut chanter la sienne (#1040, cf. `counterspellConfirm`) ; personne ne roule d'office ;
 *  - aucun surfacé → aucune fenêtre : le meilleur lanceur chante seul, jet inline.
 * DIFFÈRE tant que l'effet d'une Incantation Critique n'est pas ÉCRIT dans `pc.critChoice` (`LDB 46
 * l.28-32` : le choix décide de la dissipabilité) — un lanceur conduit par le moteur l'écrit à son jet
 * (`castRoll`), un lanceur surfacé le tranche dans sa modale, et `castConfirm` rappelle l'aiguilleur.
 * Renvoie `true` quand une FENÊTRE est ouverte (le flux appelant se suspend jusqu'à
 * `counterspellConfirm`/`Cancel`).
 * NE ROUTE PAS pendant un geste de dé PRÉ-ARMÉ (`preRollFixedDiePending`) : ce geste lance d'abord un
 * jet naturel puis SUBSTITUE la valeur saisie, et router entre les deux ouvrirait la Dissipation sur un
 * résultat périmé (trouvaille de recette navigateur #1029 : dé saisi 99 sur cible 99 → fenêtre déjà
 * résolue ET choix de Critique encore à faire). `withPreRollFixedDie` rappelle l'aiguilleur une fois le
 * résultat FINAL posé.
 */
export function routeCounterspell(get: Get, set: SetFn): boolean {
  const pc = get().pendingCast;
  const battle = get().battle;
  if (preRollFixedDiePending) return false; // résultat encore provisoire : ni fenêtre, ni marquage
  if (!pc?.result || pc.counterspellRouted || !battle) return false;
  const caster = inBattleId(battle, pc.casterId);
  const target = inBattleId(battle, pc.targetId);
  const spell = effectiveSpellOf(pc);
  if (!caster || !target || !spell) return false;
  // Choix d'effet de Critique encore DÛ (LDB 46 l.28-32) : la dissipabilité en dépend, la fenêtre attend.
  if (pc.result.isCritical && !pc.critChoice && !castInfoIsPrayer(spell)) return false;
  set({ pendingCast: { ...pc, counterspellRouted: true } });
  if (!isDispellableCast(pc, spell)) return false;
  // ZdE non posée : aucun point de zone à ce stade — l'ancre de la clause de distance est le LANCEUR.
  const anchor = pc.zone && !pc.zone.center ? caster : target;
  const candidates = counterspellCandidates(battle, get().scene, caster, anchor);
  const participants: CounterParticipant[] = candidates.map((c) => ({ id: c.id, interactive: jetSurfaced(get(), c), result: null }));
  if (participants.some((p) => p.interactive)) {
    // PHASE 1 : les rangées TÉMOIN déclarent d'office (leur contrôleur ne rendra jamais de décision) ;
    // les surfacées déclarent depuis leur siège, et les jets restent verrouillés jusque-là.
    set({ pendingCounterspell: { participants: autoDeclareWitnessRows(participants, candidates) } });
    // Contre-lanceurs joués ≠ lanceur → fenêtre partagée (MÊME couture que l'opposition de cible).
    shareCastStep(get, set, participants.filter((p) => p.interactive).map((p) => p.id), caster.id);
    return true;
  }
  const best = bestCounterspeller(candidates);
  if (best) applyCounterspell(get, set, best);
  return false;
}

/**
 * Bascule l'étape `jet:'cast'` COURANTE en étape de GROUPE (`groupOwner` → owner de modale '*') dès
 * qu'un participant JOUÉ de la fenêtre d'incantation n'est pas le lanceur : la fenêtre porte alors les
 * jets de PLUSIEURS sièges (opposition de cible, Contre-sort), et l'arbitre `cascade` doit l'ouvrir à
 * tous — chacun n'influence que SA rangée (gating par rangée + `intentAllowedFor` par participant).
 * SOURCE UNIQUE des deux ouvertures multi de la situation de cast. NB : lanceur ENNEMI → l'étape naît
 * déjà `groupOwner` (`openCastCascade`), cet appel est alors inerte.
 *
 * La bascule REMINTE l'étape au lieu de la muter : `hostStep` est le seul mint qui expose `groupOwner`
 * (#1262 B6), et il revérifie au passage que `pendingCast` — la donnée que la fenêtre partagée rend —
 * est toujours posé. Une étape hôte ne porte que sa déclaration : la situation vit dans `pendingCast`,
 * il n'y a donc rien à reprendre de plus que les champs redonnés ici.
 */
export function shareCastStep(get: Get, set: SetFn, playedIds: string[], casterId: string): void {
  const cascade = get().pendingCascade;
  if (!cascade) return;
  const cur = cascade.participants[cascade.cursor];
  if (cur?.jet !== 'cast' || cur.groupOwner) return;
  if (!playedIds.some((id) => id !== casterId)) return;
  const step = hostStep(get, {
    id: cur.id, kind: cur.kind, actorId: cur.actorId ?? casterId, jet: 'cast', groupOwner: true,
    ...(cur.label ? { label: cur.label } : {}),
    ...(cur.icon ? { icon: cur.icon } : {}),
    ...(cur.stake ? { stake: cur.stake } : {}),
    ...(cur.meta ? { meta: cur.meta } : {}),
  });
  if (!step) return;
  set({ pendingCascade: { ...cascade, participants: cascade.participants.map((s, i) => (i === cascade.cursor ? step : s)) } });
}

/** Ouvre le multijet d'OPPOSITION d'un Sort `spec.opposed` (Fauche-démon → FM, Parole de Tzeentch →
 *  Int) : chaque cible (vivante) oppose son Test à l'incantation FIGÉE, DANS la modale de cast.
 *  Cible dont un siège tient le jet (`jetSurfaced`) = rangée INTERACTIVE ; toute autre = rangée TÉMOIN
 *  (jet auto-roulé ici). MÊME table de vérité que le gate d'affichage de la rangée
 *  (`influencesLocally`, CastModal) : une rangée marquée interactive que personne ne peut jouer ne
 *  serait NI cliquable NI auto-roulée, et `oppositionConfirm` refuserait d'avancer. Renvoie false (→ le
 *  Sort s'applique normalement) si le Sort n'oppose pas ou s'il n'y a aucune cible. GARDE `pendingCast`. */
export function openCastOpposition(get: Get, set: SetFn, pc: PendingCast, targets: Combatant[]): boolean {
  const spell = effectiveSpellOf(pc);
  const opposed = spell?.opposed;
  if (!opposed) return false;
  const participants = targets
    .filter((t) => !isOutOfAction(t))
    .map((t) => ({ id: t.id, interactive: jetSurfaced(get(), t), result: null }));
  if (!participants.length) return false;
  // `menace: 'magie'` : le Test opposé « résiste au Sort » → Résistance (Menace : Magie) offerte (LDB 10).
  set({ pendingCastOpposition: { participants, kind: opposed.kind, skill: opposed.skill?.id, char: opposed.char, menace: 'magie' } });
  // Une rangée d'opposition INTERACTIVE tenue par un autre acteur joué que le lanceur → l'étape `cast`
  // devient de GROUPE (calque `disengage`/`forceDoor`) : sans cela l'owner de l'étape reste le lanceur,
  // la cible ne voit JAMAIS la fenêtre où se tient son Test et le sort s'appliquerait sans opposition.
  shareCastStep(get, set, participants.filter((p) => p.interactive).map((p) => p.id), pc.casterId);
  // Cibles IA (témoin) : jet auto-roulé immédiatement (révélé dans la modale, jamais caché).
  for (const p of participants) if (!p.interactive) get().oppositionRoll(p.id);
  return true;
}

/** Cibles SUPPLÉMENTAIRES d'une incantation figée (Surincantation, LDB 47 l.28-31) ; ZdE : toutes les
 *  cibles de la zone (pas de budget). SOURCE UNIQUE de l'application et de l'étape d'opposition. */
export function castExtraTargets(get: Get, pc: PendingCast): Combatant[] {
  return (pc.extraTargetIds ?? [])
    .map((id) => actorIn(get(), id))
    .filter((x): x is Combatant => !!x)
    .slice(0, pc.zone ? undefined : pc.overcast?.targets ?? 0);
}

/** Étape « Test opposé de la/des cible(s) » d'une incantation figée (`SpellSpec.opposed`) : ouvre le
 *  multijet DANS la modale de cast et renvoie true quand l'application doit être DIFFÉRÉE (GARDE
 *  `pendingCast`). Une ZdE non posée n'y entre pas : sa pose passe d'abord (`castConfirm`). */
export function openCastOppositionStep(get: Get, set: SetFn): boolean {
  const pc = get().pendingCast;
  if (!pc?.result?.cast || pc.opposedOutcome || !get().battle) return false;
  // IDEMPOTENT : une fenêtre d'opposition ouverte est CELLE de cette incantation — `pendingCast` suffit
  // comme clé d'identité (producteur UNIQUE `openCastOpposition`, terminal UNIQUE `oppositionConfirm`,
  // qui écrit `opposedOutcome` sur ce même `pendingCast` et interdit tout second passage par la garde
  // ci-dessus). Sans ceci, tout ré-appel (2ᵉ « Appliquer », intent réseau, beat d'auto-cadence) la
  // RECONSTRUISAIT participants NEUFS : les Tests déjà opposés étaient perdus. Ici : rien n'est touché,
  // et l'application reste DIFFÉRÉE (la fenêtre due est toujours là).
  if (get().pendingCastOpposition) return true;
  if (pc.zone && !pc.zone.center) return false;
  const caster = actorIn(get(), pc.casterId);
  const target = actorIn(get(), pc.targetId);
  const spell = effectiveSpellOf(pc);
  if (!caster || !target || !spell) return false;
  return openCastOpposition(get, set, pc, [target, ...castExtraTargets(get, pc)]);
}

/**
 * Chaîne d'incantation : route vers la première étape NON résolue — (1) Contre-sort, (2) Test opposé de
 * la/des cible(s), (3) application. Seul site qui porte (1)→(2) ; (2)→(3) est gardé ici ET dans
 * `castConfirm` (appelé aussi par la modale, l'auto-combat et les intentions réseau) par la MÊME
 * implémentation `openCastOppositionStep`. Les reprises de flux
 * (`counterspellConfirm`/`counterspellCancel`/`oppositionConfirm`) passent toutes par ici.
 * (1) avant (2)/(3) — LDB 46 l.156 : « Sur un succès, vous dissipez le Sort ; sur un échec, le Sort
 * utilise le DR du Test opposé pour déterminer si l'incantation a réussi normalement. »
 */
export function resolveCastChain(get: Get, set: SetFn): void {
  if (get().pendingCounterspell) return;
  if (!get().pendingCast) return;
  if (openCastOppositionStep(get, set)) return;
  get().castConfirm();
}

/**
 * Reprise APRÈS la fenêtre de Contre-sort (`counterspellConfirm`/`counterspellCancel`) : la chaîne ne
 * repart SEULE que si le lanceur n'est pas surfacé (Sort ennemi à l'IA — la fenêtre était la seule
 * étape jouée de sa situation). Un lanceur SURFACÉ tient encore SA modale d'incantation, ouverte AVANT
 * le Contre-sort (Surincantation, choix du Critique, « Appliquer ») : l'issue de la Dissipation revient
 * dans son `pendingCast` — exactement là où l'ancien jet inline la déposait — et c'est LUI qui applique.
 */
export function resumeAfterCounterspell(get: Get, set: SetFn): void {
  const pc = get().pendingCast;
  const caster = pc ? actorIn(get(), pc.casterId) : undefined;
  if (caster && jetSurfaced(get(), caster)) return;
  resolveCastChain(get, set);
}

/** Rayon INITIAL d'un sort de ZONE en mètres, depuis la cible STRUCTURÉE (`target.area`, source unique —
 *  le rayon de ZdE y est plié). `null` = pas un sort de ZdE chiffrable. */
export function zoneRadiusMeters(spell: NonNullable<ReturnType<typeof findSpell>>, caster: Combatant): number | null {
  const d = zdeDiameterMeters(spell.target, caster);
  return d == null ? null : d / 2;
}

/** Rayon en CASES après `alloc` Surincantations « +Zone » — multiplicateur SOURCE UNIQUE
 *  (`zoneDiameterMultiplier`, LDB 47 l.15 / `VDM 02 l.207-215`). La ZdE est réservée à l'arcane.
 *  `mpt` = l'échelle de la SCÈNE (#1507) : le rayon d'un sort est écrit en MÈTRES en donnée
 *  (`op zone`, `radiusMeters`), c'est ici qu'il devient un nombre de cases de gabarit. Arrondi au
 *  PLANCHER, minimum 0 — un gabarit plus petit que la case ne couvre aucune case au-delà du centre
 *  posé, et c'est la règle de POSE, pas celle d'une portée (cf. `porteeEnCases`). */
export const zoneRadiusTilesAt = (r0m: number, alloc: number, mpt: number): number =>
  Math.max(0, Math.floor((r0m * zoneDiameterMultiplier('arcane', alloc)) / mpt));

/** Ouvre la modale d'un sort de ZONE — flux « jet PUIS pose » (LDB 47 l.15/28) : pas de cible à
 *  désigner, le centre se choisit APRÈS le jet et la Surincantation (+Zone agrandit le gabarit).
 *  `targetId` = ancre lanceur (aucun effet ne lui est appliqué — les cibles réelles sont
 *  recensées à la pose). Retourne false si le sort n'est PAS une zone chiffrable. */
export function castZoneSpell(get: Get, set: SetFn, caster: Combatant, label: string): boolean {
  const spell = resolveSpell(label);
  if (!spell) return false;
  const r0m = zoneRadiusMeters(spell, caster);
  if (r0m == null) return false;
  const blocked = castBlockedBy(caster, castInfoIsPrayer(spell) ? 'priere' : 'langue');
  if (blocked) {
    castRefused(get, set, caster, tr(castInfoIsPrayer(spell) ? 'cf.cannotPray' : 'cf.cannotCast', { name: caster.label, reason: blocked }));
    return true; // c'était bien une zone — l'entrée est consommée (refus signalé)
  }
  // Verrou de Péché du culte (MDG 11 l.148) — même gate que `castSpell` (les miracles à ZdE passent ici).
  const sinLock = prayerSinLock(caster, spell);
  if (sinLock) {
    castRefused(get, set, caster, tr('cf.sinLock', { cult: sinLock.cult, name: caster.label, talent: tr(sinLock.family === 'beni' ? 'cf.talentBeni' : 'cf.talentInvocation'), sin: String(caster.sinPoints ?? 0), threshold: String(sinLock.threshold) }));
    return true;
  }
  const focusedNI0 = caster.focus?.spell === spell.id && caster.focus.dr >= (spell.cn ?? 0);
  set({
    pendingCast: {
      casterId: caster.id, targetId: caster.id, spellId: spell.id, missile: isMagicMissile(spell),
      focused: focusedNI0, result: null,
      zone: { center: null, radius: zoneRadiusTilesAt(r0m, 0, sceneMetresPerTile(get().scene)), r0m },
    },
  });
  openCastCascade(get, set, caster); // hôte la situation d'incantation (jet → pose de zone → effets) dans la cascade
  return true;
}

/** « Une situation = une modale » (pattern wrapper-fold) : OUVRE une cascade `combat` à UNE étape
 *  `jet:'cast'` qui HÔTE toute la situation d'incantation (jet → opposition de cible → Contre-sort →
 *  Surincantation/pose de zone → Critique → effets). `pendingCast` reste le porteur de données ; ses
 *  résolveurs (`castConfirm`/`castCancel`/`castCommitZone`/`oppositionConfirm`/`counterspellConfirm`)
 *  ferment LES DEUX au point terminal. La cascade reste OUVERTE pour TOUTE la situation. Lanceur
 *  ENNEMI → `groupOwner:true` (l'arbitre `cascade` met l'owner à '*' : moment partagé + Contre-sort
 *  multi en coop) ; HÉROS → owner dérivé de `actorId` (le lanceur). Hôte aussi l'incantation HORS
 *  COMBAT (couture D) : `CascadeModal` lit `battle?.combatants ?? party`, l'owner = le héros lanceur,
 *  et les résolveurs de cast ferment le pending directement (jamais `cascadeFinish` → pas de reprise IA).
 *
 *  RENVOIE si la fenêtre s'est ouverte : le mint refuse l'étape sans `pendingCast`, et l'appelant reste
 *  maître de la dégradation (il vient de poser le pending, il sait quoi en faire). */
export function openCastCascade(get: Get, set: SetFn, caster: Combatant): boolean {
  const step = hostStep(get, {
    id: idDansLaSequence(get, `cast-${caster.id}`, 'combat'), kind: 'cast', jet: 'cast', actorId: caster.id,
    ...(caster.kind === 'enemy' ? { groupOwner: true } : {}),
  });
  if (!step) return false;
  openSequence(get, set, { title: 'Incantation', icon: 'action/cast', purpose: 'combat', steps: [step] });
  return true;
}

/** Source UNIQUE de la « pose de zone » en cours — le gabarit qui suit le curseur. Couvre TOUT
 *  ce qui se pose librement : sorts ET miracles à ZdE (les prières passent par pendingCast).
 *  Le Souffle/Vomissement ne se posent PAS (LDB 85 : centre imposé — cible visible la plus
 *  proche, ou la cible du sort Souffle — cf. applyAreaAttack). Toute nouvelle source = une
 *  entrée ICI + un bras à `commitPlacedZone` ; l'UI (gabarit animé, survol, clic) est commune. */
export type PlacingZone = { source: 'cast' | 'siege'; label: string; casterId: string; radius: number; rangeTiles: number | null };
export function placingZoneOf(s: Pick<GameState, 'pendingCast' | 'pendingSiegeAim' | 'battle'>): PlacingZone | null {
  const pc = s.pendingCast;
  if (pc?.zone?.placing && !pc.zone.center) {
    const caster = inBattleId(s.battle, pc.casterId);
    const spell = effectiveSpellOf(pc);
    return {
      source: 'cast', label: spell?.label ?? pc.spellId, casterId: pc.casterId, radius: pc.zone.radius,
      rangeTiles: spell && caster ? spellRangeTiles(spell.range, caster) : null,
    };
  }
  // Pilonnage INDIRECT (« viser une case », AA 10 l.169/171) : pièce indirecte servie en attente du point
  // d'impact — MÊME gabarit/curseur/clic que les sorts de zone (l'ancre = le servant, `casterId`).
  const sa = s.pendingSiegeAim;
  if (sa) return { source: 'siege', label: 'Pilonnage', casterId: sa.gunnerId, radius: sa.radius, rangeTiles: sa.rangeTiles };
  return null;
}

/** La case `pt` est-elle une POSE valide pour la zone en cours ? Portée depuis l'ancre + Ligne
 *  de Vue vers le point (LDB 46 l.121) — partagé par le gabarit (couleur) et le clic. */
export function placedZoneValidAt(get: Get, pz: PlacingZone, pt: Pt): boolean {
  const caster = inBattleId(get().battle, pz.casterId);
  if (!caster?.pos) return false;
  if (pz.rangeTiles != null && chebyshev(caster.pos, pt) > pz.rangeTiles) return false;
  return !castSightBlocked(get, caster.pos, pt);
}

/** Dépose la zone en cours sur `pt` — dispatch par source (chaque consommateur garde ses gates). */
export function commitPlacedZone(get: Get, set: SetFn, pt: Pt): void {
  const pz = placingZoneOf(get());
  if (!pz) return;
  if (pz.source === 'cast') castCommitZone(get, set, pt);
  else if (pz.source === 'siege') get().siegeAimCommit(pt); // pilonnage indirect → ouvre la modale de tir sur la case
}

/** POSE de la zone d'un SORT (après le jet et la Surincantation) : gates portée (LDB 47) + Ligne
 *  de Vue vers le point (LDB 46 l.121), puis applique le MÊME jet à tous les combattants du
 *  rayon FINAL — parité avec l'ancien flux (premier = target, reste = extraTargets,
 *  evaluateMissile par cible). Zone posée dans le vide : Sort lancé, Action consommée. */
export function castCommitZone(get: Get, set: SetFn, pt: Pt): void {
  const pc = get().pendingCast;
  const battle = get().battle;
  if (!pc?.zone || !pc.result || !battle) return;
  const caster = inBattleId(battle, pc.casterId);
  const spell = effectiveSpellOf(pc);
  if (!caster?.pos || !spell) return;
  const res = pc.result;
  // « Puissance totale » (LDB 46 l.31) repêche un DR insuffisant — la pose reste permise (le
  // repêchage est appliqué par applyCast) ; tout autre échec ne se pose pas.
  const castable = res.cast || (!!res.isCritical && (pc.critChoice ?? 'puissance') === 'puissance');
  if (!castable) return;
  const range = spellRangeTiles(spell.range, caster);
  if (range != null && chebyshev(caster.pos, pt) > range) {
    get().log(tr('cf.zoneOutOfRange', { spell: spell.label, range }));
    return;
  }
  if (castSightBlocked(get, caster.pos, pt)) {
    get().log(tr('cf.noLineOfSight', { spell: spell.label }));
    return;
  }
  const radius = pc.zone.radius;
  // `excludesCaster` (SpellTarget kind:'area', src/engine/spellRange.ts:34) : le lanceur n'est pas
  // compté parmi les combattants touchés par sa propre Zone d'Effet.
  const excludesCaster = spell.target?.kind === 'area' && spell.target.excludesCaster === true;
  // `affects` (src/engine/spellRange.ts:34) : Condition évaluée PAR CANDIDAT (`target` = le candidat,
  // `caster` = le lanceur). Absente → LDB 47 l.28.
  const affects = spell.target?.kind === 'area' || spell.target?.kind === 'cone' ? spell.target.affects : undefined;
  // Le DR confronté par la Condition est celui que SUBIT le candidat (Résistance à la Magie, LDB 85
  // l.302 / LDB 10 l.1026). C'est ce filtre qui CONSTITUE la zone : chaque candidat est donc sa zone.
  const affected = (c: Combatant): boolean =>
    affects == null || evalCondition(affects, combatConditionCtx(c, { caster, now: get().gameTime, sl: spellSLFor(res.sl, c) }));
  const inZone = battle.combatants.filter((c) => !isOutOfAction(c) && c.pos && (c.pos.z ?? 0) === (pt.z ?? 0) && chebyshev(c.pos, pt) <= radius && (!excludesCaster || c.id !== caster.id) && affected(c));
  set({ pendingCast: { ...pc, zone: { ...pc.zone, center: { ...pt }, placing: false } } });
  if (!inZone.length) {
    set({ pendingCast: null, pendingCascade: null }); // TERMINAL : ferme data + cascade-hôte (zone à vide)
    if (pc.focused) caster.focus = undefined; // le sort focalisé est consommé même à vide
    finishPlayerAction(get, set, [`${spell.label} : la zone ne touche personne.`], 'cast');
    return;
  }
  const first = inZone[0];
  const r1 = pc.missile && res.cast ? evaluateMissile(caster, first, spell, res) : res;
  // FOLD (parité castConfirm) : ne ferme QUE le jet ; la cascade d'incantation reste active pour
  // qu'un Critique de Sort / Imparfaite s'y appendent. Repère l'étape `jet:'cast'` AVANT applyCast.
  const cascBefore = get().pendingCascade;
  const castStepIdx = cascBefore && cascBefore.purpose === 'combat' && cascBefore.participants[cascBefore.cursor]?.jet === 'cast'
    ? cascBefore.cursor : -1;
  set({ pendingCast: null }); // ferme le jet ; cascade d'incantation conservée
  const ocDur = overcastDurationParts(overcastSourceOf(spell), pc.overcast?.duration ?? 0);
  applyCast(get, set, caster, first, spell, r1, pc.missile, pc.focused, pc.critChoice, {
    durationMult: ocDur.mult,
    durationBonusRounds: ocDur.bonusRounds,
    overcastDurationSteps: pc.overcast?.duration ?? 0,
    overcastDamageSteps: pc.overcast?.damage ?? 0,
    chosenTableRolls: pc.chosenTableRolls,
    extraTargets: inZone.slice(1),
  });
  // Avance au-delà de l'étape cast (résolue) : conséquences appendues → jouées ; aucune → ferme.
  if (castStepIdx >= 0) {
    const casc = get().pendingCascade;
    if (casc && casc.purpose === 'combat' && casc.cursor === castStepIdx) {
      if (casc.participants.length > castStepIdx + 1) poserCurseurCascade(get, set, casc, castStepIdx + 1);
      else set({ pendingCascade: null });
    }
  }
}

/** Contexte de visibilité OPTIONNEL pour filtrer des cibles de sort par Ligne de Vue (LDB 46
 *  l.170). Absent/null (hors combat, tests purs) : pas de filtre — comportement historique. */
export type SpellSight = { scene: Scene; smoke?: Pt[] } | null;
const spellSightBlocked = (sight: SpellSight | undefined, caster: Combatant, t: Combatant): boolean =>
  !!sight && !!caster.pos && !!t.pos && !losClear(sight.scene, caster.pos, t.pos, sight.smoke ?? []);
/** SpellSight depuis l'état courant (scène + fumée du combat), null hors combat. */
export const spellSightOf = (get: Get): SpellSight =>
  get().scene && get().battle ? { scene: get().scene!, smoke: smokeOf(get().battle!) } : null;

/** Unicité RAW (arcane LDB 46 l.116-121 / divin 40 l.16-19) : un effet OU une invocation de CE sort est-il
 *  DÉJÀ actif du côté du lanceur ? `true` si un combattant ALLIÉ porte un effet de ce sort (par identité de
 *  sort, `sourceSpellId`/`spell.spellId`) OU si une créature invoquée par CE sort et CE lanceur est encore
 *  en jeu. Empêche le re-cast en boucle d'un buff durable / d'une invocation. */
function isSpellActive(spell: SpellData, caster: Combatant, battle: BattleState | null): boolean {
  if (!battle) return false;
  const buffed = battle.combatants.some(
    (c) => c.kind === caster.kind && (c.activeEffects ?? []).some((e) => e.sourceSpellId === spell.id || e.spell?.spellId === spell.id),
  );
  if (buffed) return true;
  return battle.combatants.some((c) => c.summon?.spellId === spell.id && c.summon?.byId === caster.id && !isOutOfAction(c));
}

/**
 * Construit l'entrée de l'IA pour `enemy` : la LISTE complète de ses sorts RÉSOLUS + enrichis
 * (`CastableSpell[]` — portée/forme/fiabilité d'incantation/Focalisation/Unicité), plus le contexte
 * tactique partagé (escouade/orientation/perception/mouvement/blocage/fumée/vol). MUTUALISÉ par
 * `runEnemyAI`, le frais d'`aiApproachPlan` et les replans de budget (qui surchargent juste `movement`).
 * Couche IMPURE : a les DONNÉES de sort + le `battle`. Le `movement` n'inclut PAS le cas « vient
 * d'enfourcher » (Mouvement consommé) — l'appelant le force à 0 le cas échéant.
 */
export function buildAiInput(enemy: Combatant, get: Get): EnemyTurnInput {
  const battle = get().battle!;
  const scene = get().scene!;
  const foeKind = enemy.kind === 'enemy' ? 'hero' : 'enemy';
  const heroes = battle.combatants.filter((c) => c.kind === foeKind && !isOutOfAction(c));
  const squad = battle.combatants.filter((c) => c.kind === enemy.kind && !isOutOfAction(c) && c.pos && c.id !== enemy.id);
  // Géométrie porteuse (Combat monté, LDB 14) → empreinte + Mouvement + cases bloquées.
  const geom = mountOf(battle, enemy) ?? enemy;
  const blocked = occupied(battle, geom);
  const cavalryCharge = !!enemy.mountId && !isEngaged(enemy); // cavalier non Engagé : portée de Course (2×)
  let movement = Math.floor(effectiveMovement(geom) * (cavalryCharge ? 2 * runMultiplier(geom.traits) : 1));
  const flyM = flyMeters(enemy.traits); // Vol (Indice) (LDB 85 l.433) : remplace la Marche s'il porte plus loin
  if (flyM != null) movement = Math.max(movement, Math.floor(flyM / 2));
  const perceived = perceivedTiles(
    { scene, battle, party: get().party, partyPos: get().partyPos, gameTime: get().gameTime, lightLevel: get().lightLevel },
    enemy,
  );
  // Sorts connus, résolus + enrichis (portée en cases, forme, fiabilité d'incantation, Focalisation, Unicité).
  const spells: CastableSpell[] = [];
  for (const id of enemy.spells ?? []) {
    const data = resolveSpell(id);
    if (!data) continue;
    const cn = data.cn ?? 0;
    // Focalisation prête (DR cumulé ≥ NI) → fiabilité calculée à NI 0 ; sinon fiabilité normale.
    const ready = enemy.focus?.spell === data.id && (enemy.focus?.dr ?? 0) >= cn;
    const landProb = castLandProbability(enemy, data, ready);
    // Un sort dont le payload est une INVOCATION alliée (`op:summon on:caster`) est routé 'self' (et JAMAIS
    // 'focusable' : on ne focalise pas une invocation, on la LANCE) AVANT toute logique de zone — la machinerie
    // `castArea` = zone de DÉGÂTS (centre sur un paquet d'ennemis) ne convient pas (un summon sans ennemi dans
    // la zone ne se résout pas, tour gâché). En 'self', le chemin `cast` normal déclenche le summon (`applyCast`)
    // et pose `spell.id` sur le lien → Unicité (plus de re-invocation en boucle). La `target.kind='area'` d'un
    // tel sort (Réanimation) est COSMÉTIQUE — `applySummon` place les invoqués près du lanceur.
    const hasAllySummon = spellOps(data.effects, 'caster').some((o) => o.op === 'summon' && o.allyOfCaster !== false);
    const focusState: CastableSpell['focusState'] = ready ? 'ready'
      : (!hasAllySummon && landProb < 0.5 && isArcaneSpell(data) && !!focusSkillFor(enemy, data)) ? 'focusable'
        : 'none';
    const radius = hasAllySummon ? null : zdeRadiusTiles(data.target, enemy);
    const shape: CastableSpell['shape'] = hasAllySummon ? 'self'
      : radius != null ? { area: { radius } }
        : (data.range?.kind === 'self' || data.target?.kind === 'self') ? 'self'
          : 'single';
    spells.push({
      id: data.id, data, cn, range: spellRangeTiles(data.range, enemy), shape, landProb, focusState,
      active: isSpellActive(data, enemy, battle),
    });
  }
  // Structures destructibles (porte/mur) offertes au choix de cible de l'IA. DEUX conditions, aucune autre :
  // la rencontre DÉCLARE le siège (`siegeActif`, défaut littéral false) ET le décideur est ENNEMI — un défenseur
  // allié-IA n'attaque pas sa propre porte, et `structureImmune` n'y suffirait pas (une pièce de siège alliée la
  // pourrait). Hors siège ou côté allié → `undefined`, aucun candidat. L'arme qui n'abîme pas la structure est
  // écartée plus bas (`ai.ts`, `structureImmune`).
  const structures = enemy.kind === 'enemy' && siegeActif(battle)
    ? battle.combatants.filter((c) => isStructure(c) && !isOutOfAction(c) && c.pos)
    : undefined;
  const smoke = smokeOf(battle);
  return {
    enemy, heroes, scene, blocked, noStop: cannotStopOn(battle, geom), movement, spells,
    smoke, flying: flyM != null, traverse: climbTraverseFor(enemy.traits), perceived, facing: get().facing, squad,
    // Mémo de Ligne de Vue de CETTE décision : posé ici parce que c'est ici que la scène et les fumées de
    // la décision sont fixées, et repassé tel quel aux ré-énumérations d'`aiApproachPlan`.
    losMemo: makeLosMemo(scene, smoke),
    // « Servir cette pièce » (MDG 12) : postes de siège NON servis adjacents — KIND-AGNOSTIQUE (l'appelant
    // impur a la liste complète des combattants). Vide en scène sans emplacement → aucun candidat (parité golden).
    servablePostes: servablePostes(enemy, battle.combatants).map(({ hull, poste }) => ({ hullId: hull.id, posteUid: poste.item.uid })),
    structures,
    // Tenue de FORMATION (#196) : crew d'un poste d'engin ACTIF (bélier, batterie de siège) → il ne charge
    // pas seul, c'est le poste qui le déplace (naval : le passager suit `shipOfCrew`, cas déjà distinct).
    holdsFormation: !!crewPosteOf(enemy.id, battle.combatants),
    // Restriction d'armes à distance de la rencontre (#537) — MÊME résolution que le gate joueur (`firedAttackBlock`),
    // aucune 2ᵉ source : `banRangedActive` reste l'unique point de vérité.
    banRanged: banRangedActive(battle),
  };
}

/** La meilleure action IA de `enemy` est-elle de PRÉPARER un sort (cast/castArea/focus) plutôt que d'agir
 *  au contact ? Peek DÉTERMINISTE lu par le hook de Frénésie (`aiMaybeFrenzy`) pour DIFFÉRER l'entrée en
 *  Frénésie tant qu'un sort (buff/invocation/dégâts) prime sur charger — RAW : l'entrée en Frénésie est un
 *  CHOIX (psychologie.md l.170). L'Unicité retire ces sorts un à un ; quand il ne reste que charger, la
 *  Frénésie passe au tour suivant. N'utilise AUCUN `battleRng` et ne mute rien (`buildAiInput`/
 *  `chooseEnemyAction` déterministes et purs) → planning de coop sans désync. */
export function aiWouldPrepareSpell(enemy: Combatant, get: Get): boolean {
  const a = chooseEnemyAction(buildAiInput(enemy, get));
  return a.kind === 'cast' || a.kind === 'castArea' || a.kind === 'focus';
}

/** Surincantation AUTOMATIQUE d'un lanceur ENNEMI (LDB 47 l.28-31 : « Pour chaque +2 DR […]
 *  vous pouvez ajouter une valeur de […] Cible égale à la valeur initiale ») : le surplus
 *  (DR − NI) est alloué à l'axe CIBLE d'un Projectile — adversaires actifs les plus proches,
 *  à PORTÉE du Sort, hors cible principale. Sous VDM (#885), le reliquat non consommé par l'axe
 *  Cible (aucune cible neuve à couvrir de plus) rejoint l'axe Dégâts — MÊME fonction `overcastAxes`
 *  que le joueur (`castAllocOvercast`), jamais une 2e liste d'axes. Retourne le patch de
 *  pendingCast ({} si rien). */
export function aiOvercastPlan(
  caster: Combatant,
  targetId: string,
  spell: { cn: number | null; range: SpellRange | null; family?: string },
  res: { cast: boolean; sl: number },
  combatants: Combatant[],
  focusedNI0 = false,
  sight?: SpellSight,
  missile = false,
): { overcast?: { range: number; zone: number; duration: number; targets: number; damage: number }; extraTargetIds?: string[] } {
  if (!res.cast || !caster.pos) return {};
  const ni = focusedNI0 ? 0 : spell.cn ?? 0;
  const source = overcastSourceOf(spell);
  const budget = overcastBudget(source, res.sl, ni);
  if (budget <= 0) return {};
  const axes = overcastAxes(source, missile);
  const range = spellRangeTiles(spell.range, caster) ?? Infinity;
  const extras = combatants
    .filter((t) => t.kind !== caster.kind && t.id !== targetId && !isOutOfAction(t) && t.pos && combatDistance(caster, t) <= range && !spellSightBlocked(sight, caster, t))
    .sort((a, b) => combatDistance(caster, a) - combatDistance(caster, b))
    .slice(0, extraTargetCapacity(source, budget, 1))
    .map((t) => t.id);
  // Allocation MINIMALE couvrant les cibles retenues — indépendante du modèle (LDB : 1 pas = 1 cible
  // pour une Cible initiale de 1 ; VDM : paliers du Tableau de Surincantation). 0 si aucune cible
  // supplémentaire n'est à portée (le reliquat entier reste alors disponible pour l'axe Dégâts).
  const targetSpend = extras.length
    ? Array.from({ length: budget }, (_, i) => i + 1).find((n) => extraTargetCapacity(source, n, 1) >= extras.length) ?? budget
    : 0;
  // Reliquat → Dégâts (Projectile magique, VDM seulement, `VDM 02 l.198`) : un pas de plus sur l'axe
  // Cible qui ne couvre AUCUNE cible neuve ne sert à rien — l'IA le redirige où le RAW l'autorise,
  // au lieu de le laisser inerte (#885 : le nerf du Projectile sans jamais sa contrepartie).
  const damageSpend = axes.includes('damage') ? budget - targetSpend : 0;
  if (!extras.length && !damageSpend) return {};
  return { overcast: { range: 0, zone: 0, duration: 0, targets: targetSpend, damage: damageSpend }, extraTargetIds: extras };
}

/** Cibles SUPPLÉMENTAIRES proposables pour la Surincantation « Cible » (LDB 47 l.28-31), côté
 *  modale : hors cible principale, À PORTÉE du Sort (quand les positions existent — hors combat
 *  le groupe n'est pas sur un plateau), et surtout EN ÉTAT D'ÊTRE CIBLÉES — un Projectile vise un
 *  adversaire encore en combat (un figurant à 0 PB est mort, LDB 18 l.42-46) ; un sort bénéfique
 *  vise un allié non mort/évacué (l'Inconscient reste soignable). Aligné sur aiOvercastPlan/ZdE. */
export function overcastTargetCandidates(
  pool: Combatant[],
  caster: Combatant,
  targetId: string,
  spell: { range: SpellRange | null },
  missile: boolean,
  // Surincantation (LDB 47/41/42) : SOURCE (×initial Sort/Miracle vs +6 m fixe Bénédiction) et pas de
  // Portée alloués — EXPLICITES (aucun défaut caché qui pourrait mal-appliquer l'×initial à un sort divin).
  // `rangeSteps` 0 = portée de base ; étendre la Portée élargit l'ensemble des cibles atteignables.
  source: OvercastSource,
  rangeSteps: number,
  sight?: SpellSight,
): Combatant[] {
  const range = effectiveSpellRangeTiles(spell.range, caster, source, rangeSteps);
  return pool.filter((m) => {
    if (m.id === targetId) return false;
    if (missile ? m.kind === caster.kind || isOutOfAction(m) : m.kind !== caster.kind || m.dead || m.outOfRencontre) return false;
    if (range != null && caster.pos && m.pos && combatDistance(caster, m) > range) return false;
    // Ligne de Vue (LDB 46 l.121) : une cible supplémentaire doit aussi être visible du lanceur.
    return !spellSightBlocked(sight, caster, m);
  });
}

/** NI d'un Sort lu au grimoire (LDB 47 l.21, `VDM 12 l.646-647`) — modificateurs en donnée, passés
 *  par la primitive UNIQUE `effectiveCastingNumber` comme tout autre porteur. */
export const GRIMOIRE_NI_MODS: CastingNumberMod[] = [
  {
    multiply: 2,
    scope: { kinds: ['sort'] },
    source: { book: 'vents-de-la-magie', page: 164 },
    desc: 'Lors du lancement de Sort son NI est doublé.',
  },
  {
    multiply: 4,
    scope: { kinds: ['rituel'] },
    source: { book: 'vents-de-la-magie', page: 164 },
    desc: "Dans le cas d'un Rituel, son NI est quadruplé.",
  },
];

/** Sort effectif d'un pendingCast : NI DOUBLÉ pour une lecture au grimoire (LDB 47 l.21), QUADRUPLÉ
 *  pour un Rituel (`VDM 12 l.647`, `VDM 02 l.369`). */
export function effectiveSpellOf(pc: { spellId: string; grimoire?: boolean }): ReturnType<typeof findSpell> {
  const spell = resolveSpell(pc.spellId);
  if (!spell || !pc.grimoire || spell.cn == null) return spell;
  const subject = { id: spell.id, domainId: spell.domainId, kind: spell.isRitual ? ('rituel' as const) : ('sort' as const) };
  return { ...spell, cn: effectiveCastingNumber(spell.cn, subject, GRIMOIRE_NI_MODS) };
}

/** Contre-lanceurs ÉLIGIBLES à la Dissipation contre un Sort de `caster` visant `target`.
 *  RAW (LDB 46 l.156) : actif, lanceur (Compétence Langue (Magick) ou Trait Lanceur de Sorts), pas
 *  encore de Contre-sort ce Round (« un seul Sort chaque Round »), et le Sort le CIBLE (« Si un Sort
 *  vous cible ») ou vise un point QU'IL PEUT VOIR « à une distance en mètres égale à votre Force
 *  Mentale » — portée RAW en MÈTRES, convertie en CASES à l'échelle du plateau (2 m par case) :
 *  `floor(FM / 2)` cases, comparées par `combatDistance`. Ligne de Vue scène + fumée.
 *  Restriction de camp par HOSTILITÉ effective, jamais par `kind` (#1029, cf. `effectivelyHostile`,
 *  `src/engine/relations.ts` — maison UNIQUE du camp) ; `l.156` ne porte aucune clause de camp. */
export function counterspellCandidates(
  battle: BattleState | null,
  scene: Scene | null | undefined,
  caster: Combatant,
  target: Combatant,
): Combatant[] {
  if (!battle || battle.over) return [];
  return battle.combatants.filter((c) => {
    if (!effectivelyHostile(c, caster) || c.id === caster.id || isOutOfAction(c) || c.dispelledThisRound) return false;
    if (!knowsCastingSkill(c, 'langue', 'magick')) return false;
    if (c.id === target.id) return true;
    if (!c.pos || !target.pos) return false;
    if (combatDistance(c, target) > Math.max(1, Math.floor(effectiveChar(c, 'force-mentale') / 2))) return false;
    return !scene || losClear(scene, c.pos, target.pos, smokeOf(battle));
  });
}

/** Applique une issue de Contre-sort DÉJÀ obtenue (`out`) au `pendingCast` FIGÉ : dissipé → le Sort
 *  échoue ; sinon l'incantation se re-détermine au DR NET (Projectile compris) et la Surincantation
 *  de l'IA est re-planifiée. SOURCE UNIQUE de l'application — partagée par le Contre-sort INLINE
 *  (aucun contre-lanceur possédé, `applyCounterspell`) et la FENÊTRE (chaque rangée a son jet déjà influencé,
 *  `counterspellConfirm`). N'effectue PAS le jet (déjà fait) ni la consommation d'essai (à l'appelant). */
export function applyCounterspellOutcome(get: Get, set: SetFn, counter: Combatant, out: CounterspellOutcome): boolean {
  const pc = get().pendingCast;
  if (!pc?.result || pc.result.dispelled) return false;
  const caster = inBattleId(get().battle, pc.casterId);
  const target = inBattleId(get().battle, pc.targetId);
  const spell = effectiveSpellOf(pc);
  if (!caster || !target || !spell) return false;
  const res = pc.result;
  // Zone NON POSÉE (flux « jet puis pose ») : re-dériver le jet PUR (Dégâts par cible dérivés du DR
  // net à la pose), jamais un Projectile contre l'ancre.
  const unplacedZone = !!pc.zone && !pc.zone.center;
  let next: typeof pc.result;
  if (out.dispelled) {
    next = { ...res, cast: false, dispelled: true, hit: false, damage: undefined, woundsLost: undefined, defenderDefeated: false, log: `${out.log}` };
  } else {
    next = rederiveCastSL(caster, target, spell, res, pc.missile && !unplacedZone, pc.focused, out.casterNetSL - res.sl);
    next.log = `${out.log} ${next.log}`;
  }
  // Surincantation : le surplus a changé — re-plan IA (lanceur ennemi), remise à zéro sinon.
  const oc = aiDriven(get(), caster) && pc.missile && !pc.zone
    ? aiOvercastPlan(caster, pc.targetId, spell, next, get().battle?.combatants ?? [], pc.focused, spellSightOf(get), !!pc.missile)
    : {};
  set({ pendingCast: { ...pc, result: next, overcast: undefined, extraTargetIds: undefined, ...oc } });
  const b = get().battle;
  if (b) set({ battle: { ...b, log: [...b.log, ev('info', out.log, counter.id, caster.id)] } });
  return true;
}

/** Contre-sort INLINE (contre-lanceur non possédé : l'IA dissipe seule) : roule le Test opposé de Langue (Magick)
 *  (LDB 46 l.156) puis applique l'issue. Marque l'essai du Round (consommé même raté, l.156).
 *  MÊME garde que l'aiguilleur (`isDispellableCast`) — jamais une seconde table de vérité. */
export function applyCounterspell(get: Get, set: SetFn, counter: Combatant): boolean {
  const pc = get().pendingCast;
  if (!pc?.result || pc.result.dispelled) return false;
  const caster = inBattleId(get().battle, pc.casterId);
  const spell = effectiveSpellOf(pc);
  if (!caster || !spell || !isDispellableCast(pc, spell)) return false;
  if (!effectivelyHostile(counter, caster) || counter.dispelledThisRound) return false;
  counter.dispelledThisRound = true; // l'essai est consommé même s'il échoue (LDB 46 l.156)
  const out = resolveCounterspell(counter, castTestOf(pc.result), battleRng());
  return applyCounterspellOutcome(get, set, counter, out);
}

/** Fenêtre de Contre-sort refermée SANS QU'AUCUNE rangée ait chanté : le meilleur contre-lanceur IA
 *  qu'elle recensait chante à leur place — le jet inline qu'il aurait eu sans siège possédant.
 *  SOURCE UNIQUE du repli, partagée par « Laisser passer » (`counterspellCancel`) et par
 *  « Appliquer » sur fenêtre vierge (`counterspellConfirm`) : deux boutons, même état → même issue. */
export function applyCounterspellFallback(get: Get, set: SetFn, pcs: PendingCounterspell): void {
  const ia = bestCounterspeller(pcs.participants
    .filter((p) => !p.interactive)
    .map((p) => actorIn(get(), p.id))
    .filter((c): c is Combatant => !!c));
  if (ia) applyCounterspell(get, set, ia);
}

/** Choix du lanceur sur une Incantation CRITIQUE (LDB 46 l.26-32). */
export type CastCritChoice = 'critique' | 'puissance' | 'ineluctable';

/**
 * Exécute un sous-Flow de sort EN COMBAT via l'exécuteur UNIQUE `runCombatFlow` (after-aware) puis
 * RAMÈNE ses lignes de journal pour qu'`applyCast` les place INLINE dans son `logLines` (ordre du
 * journal de sort préservé).
 *
 * Pourquoi ce détour file→drain : `runCombatFlow` est le seul exécuteur qui porte la CONTINUATION
 * `after` d'un nœud `test` enfoui — un sort à Test interne (Lot 4) suspend alors en APPENDANT une étape
 * `triggeredTest` à la cascade `cast` active (openCastCascade), comme Critique/Maladresse de sort. Il
 * pousse son journal dans la file différée `pendingLogQueue` ; `drainPendingLog` la vide ici et rend les
 * lignes (`.text`) — la file capte AUSSI les lignes des hooks profonds déclenchés par les ops du sort
 * (`onGainCondition` d'un ennemi → Mâchoires), donc elles ne sont plus orphelines. Aucun sort n'ayant
 * ENCORE de nœud Flow `test`, `runCombatFlow` s'exécute de bout en bout (do/if seulement).
 *
 * L'ENTITÉ PORTEUSE (`source: {kind:'spell', id}`) entre dans l'`opsCtx` ICI, une fois pour les trois
 * appelants : c'est elle que les `ActiveEffect` posés portent, et c'est d'elle que les 46 `FlowTest`
 * authorés dans `spells.json` DÉRIVENT leur enjeu (#1262 V2 L6d) — « ce qui se joue » EST le sort. */
function runCastFlow(get: Get, set: SetFn, target: Combatant, caster: Combatant, flow: Flow, opsCtx: OpsCtx): string[] {
  const source = opsCtx.source ?? (opsCtx.sourceSpellId ? { kind: 'spell' as const, id: opsCtx.sourceSpellId } : undefined);
  const withSpell: OpsCtx = { ...opsCtx, ...(source ? { source } : {}) };
  runCombatFlow({ mode: 'combat', get, set, target, caster, label: withSpell.label ?? caster.label, opsCtx: withSpell }, flow);
  return drainPendingLog(get, set).map((e) => e.text);
}

/** L'ÉTAT DE FENÊTRE d'une touche de Projectile (#1508) — ce que l'appelant doit savoir pour décider
 *  s'il joue MAINTENANT ce qui suit la touche (le rebond d'« Attaques en chaîne ») ou s'il le laisse à
 *  la reprise. `appliquee` = la touche est close (y compris « rien à appliquer » : immunité de Domaine,
 *  DR retombé sous le NI, coup ignoré par une sauvegarde) ; les deux `suspendue-*` NOMMENT la fenêtre
 *  qui rendra la main, et chacune porte la touche dans SA charge. */
type IssueDeTouche = 'appliquee' | 'suspendue-sauvegarde' | 'suspendue-deviation' | 'cible-absente';

/** Ce que rend l'application d'une touche : ses lignes de journal ET son état de fenêtre. */
interface ToucheAppliquee { issue: IssueDeTouche; lignes: string[] }

/**
 * LA TOUCHE d'un Projectile magique, APPLIQUÉE (#1508) — HISSÉE hors de la closure d'`applyCast` pour
 * être RÉ-ENTRANTE : la sauvegarde « 1d10 ≥ Indice » se joue à la porte (étape par cible, push SYNCHRONE :
 * la boucle multi-cibles de l'appelant continue), et l'applier de l'étape RAPPELLE cette fonction avec la
 * décision — exactement comme `resolveDeviation` rappelle `applyAttackResult` avec le Critique construit.
 * Sa charge est de la DONNÉE (`ToucheDeProjectile`) : elle voyage sur l'étape.
 *
 * RAMENE ses lignes de journal : l'appelant les place INLINE dans son `logLines` (application immédiate),
 * l'applier en fait les conséquences de l'étape (reprise). Aucune mutation avant la sauvegarde.
 *
 * Elle rend AUSSI son `issue` : une touche SUSPENDUE n'a rien appliqué (ou pas tout), et ce que
 * l'appelant fait APRÈS elle (le rebond d'« Attaques en chaîne ») ne se joue qu'à la reprise.
 */
function appliquerToucheDeProjectile(get: Get, set: SetFn, ch: ToucheDeProjectile, sauvegarde?: { sauve: boolean }): ToucheAppliquee {
  const lignes: string[] = [];
  let suspenduParDeviation = false;
  // `actorIn` (combat OU groupe) et non `inBattleId` : un Projectile se lance aussi HORS COMBAT
  // (couture D d'`applyCast`, `battle == null`) — les protagonistes y vivent dans le groupe.
  const caster = actorIn(get(), ch.casterId);
  const cible = actorIn(get(), ch.targetId);
  // Protagoniste disparu entre l'ouverture du dé et sa reprise : la conséquence se DIT (patron `opsDe`).
  if (!caster || !cible) return { issue: 'cible-absente', lignes: [tr('cascade.cibleDisparue', { label: ch.spell.label })] };
  const spell = ch.spell;
  let mres = ch.mres;
  // Sauvegardes « après la touche » — MÊME registre ordonné que le coup physique
  // (`state/combat/hitModifiers`), et c'est SON site unique : Démoniaque/Protection (LDB 85 l.98),
  // Dôme (LDB 47 l.410, qui nomme les attaques magiques), Martyr.
  // La touche est exprimée dans le vocabulaire partagé des touches (`AttackResult`) ; l'attaque
  // est MAGIQUE, elle n'a pas d'arme.
  const touche: AttackResult = {
    hit: !!mres.hit, attackerRoll: mres.roll ?? 0, netSL: 0, critical: false,
    advantageTo: null, defenderDefeated: false, log: '',
    ...(mres.location ? { location: mres.location } : {}),
    ...(mres.damage != null ? { damage: mres.damage } : {}),
    ...(mres.woundsLost != null ? { woundsLost: mres.woundsLost } : {}),
    ...(sauvegarde ? { sauvegarde } : {}),
  };
  const apresModifiers = runHitModifiers({
    get, set, attacker: caster, target: cible, res: touche, attaque: 'magique', sink: () => {},
    encaisse: (c) => { lignes.push(...checkFocusInterruption(get, set, c)); },
    ouvrirSauvegarde: (seuils) => { pousserSauvegarde(set, cible.id, seuils, { mode: 'projectile', touche: ch }); },
  });
  const apresSaves = apresModifiers.res;
  if (apresModifiers.suspendu) return { issue: 'suspendue-sauvegarde', lignes }; // suspendu AVANT toute mutation : cette cible reprendra par l'applier
  if (apresSaves.log) lignes.push(apresSaves.log);
  mres = { ...mres, woundsLost: apresSaves.woundsLost, damage: apresSaves.damage };
  if (!mres.hit || !mres.woundsLost) return { issue: 'appliquee', lignes };
  const currentBefore = cible.wounds.current;
  const overkill = mres.woundsLost - currentBefore;
  cible.wounds.current = Math.max(0, currentBefore - mres.woundsLost);
  // Réouverture d'une plaie critique (LDB 18 / AA 07) : jumeau du coup physique (applyAttackResult) —
  // un Projectile qui frappe une Localisation déjà porteuse d'une plaie non recousue y ajoute ses États Hémorragique.
  const mloc = mres.location ?? 'corps';
  const mReinj = reinjuryBleed(cible, mloc);
  if (mReinj > 0) { addCondition(cible, COND.hemorragique, mReinj); lignes.push(tr('cf.reinjuryBleed', { name: cible.label, n: mReinj, loc: locationLabel(mloc, cible.bodyShape) })); }
  // Blessure Critique : choix « Incantation Critique » du lanceur (LDB 46 l.30), ou overkill.
  const critWound = ch.critWound;
  if (critWound || overkill > 0) {
    const loc = mres.location ?? 'corps'; // double → loc re-tirée (#80) ; dépassement → loc de touche
    const ovk = Math.max(0, overkill);
    const c2: DeviationCtx = { attackerId: caster.id, attackerKind: caster.kind, weapon: spell.label, critTwice: critRollTwiceFor(caster) };
    const heroConcerned = cible.kind === 'hero' || caster.kind === 'hero';
    // Déviation Critique (LDB 63 l.30) : sur double (`critWound`) OU dépassement (`overkill`) — RAW complet,
    // parité avec la mêlée — pourvu que l'armure ABSORBE réellement (`magicDeviationEligible` : PA déviatable,
    // pas de bypass de Domaine Ombres/Métal/Cieux, sort qui n'ignore pas les PA).
    const elig = magicDeviationEligible(caster, cible, loc, spell, mres, mres.woundsLost ?? 0, ch.overcastDamageSteps);
    // MÊME prédicat que la mêlée et l'opposé (#1426) : l'automate ne tranche que pour un porteur
    // qu'aucun siège humain ne tient ; tenu, il choisit — quel que soit son kind.
    const tenu = tenuParUnHumain(get(), cible.id);
    if (elig.eligible && !tenu && autoDeviate(set, cible, loc, elig.extraWounds, { attackerId: caster.id, weapon: spell.label }, mres.roll ?? 0, lignes, heroConcerned)) {
      // déviation AUTO réussie (rule on + PA sacrifiable) → Critique ignoré. Sinon (règle OFF / pas
      // de PA), `autoDeviate` retourne false → on TOMBE sur `applyCritAndFinalize` (Critique subi).
    } else if (rule('combat-critical-deflect') && elig.eligible && tenu) {
      // Porteur blindé TENU : SUSPEND son choix (étape `self`, push SYNCHRONE — la boucle multi-cibles continue,
      // chaque cible porte SON propre step indépendant). Le Critique pré-tiré PORTE l'overkill (−20 table si
      // > BE, LDB 18 l.30) → un double qui dépasse garde sa sévérité au Subir.
      const cr2 = resolveCritSeverity(cible, loc, ovk, c2.critTwice).crit; // dé de sévérité par l'étape à table (seam UNIQUE)
      pushDeviationStep(set, { targetId: cible.id, offerte: true, pretire: {
        mode: 'self', attackerId: caster.id, targetId: cible.id, location: loc, crit: cr2,
        isCoupCritique: critWound, overkill: ovk, deflectExtraWounds: elig.extraWounds, woundsBefore: currentBefore,
        reveal: previewCritEntry(cible, cr2, { attackerId: caster.id, weapon: spell.label }), resumeAfter: true, ctx: c2,
        touche: ch, // la suite DÉCLARÉE par l'appelant (rebond) voyage dans la charge de CETTE fenêtre
      } });
      suspenduParDeviation = true;
    } else {
      applyCritAndFinalize(get, set, cible, loc, critWound, ovk, lignes, c2, currentBefore);
    }
    // 0 PB → À Terre (LDB 18 l.15) — SAUF si suspendu (le Critique du héros n'est pas encore résolu :
    // resolveDeviation `self` s'en charge). Parité avec la mêlée et resolveDeviation.
    if (!suspenduParDeviation && cible.wounds.current <= 0 && !cible.dead && !hasCondition(cible, COND.inconscient)) applyZeroWounds(cible);
  } else if (cible.wounds.current <= 0) {
    applyZeroWounds(cible);
  }
  // Effets ADDITIONNELS d'un Projectile sur la cible (« Grands feux d'U'Zhul » : +2 En flammes, À
  // Terre ; « Drain » : soigne le lanceur) — lus depuis `spell.effects` (Flow éditable, feuilles
  // `on:'target'`). Réservé aux sorts CURÉS : un sort sans spec n'a pas d'effet missile parsé (iso-POC).
  if (spell.curated && spellOps(spell.effects, 'target').length) {
    // Surincantation de DURÉE sur un PROJECTILE (#1695) : la touche transporte les pas alloués
    // (`ch.overcastDurationSteps`) — la règle se relit à sa SOURCE UNIQUE (`overcastDurationParts`),
    // comme la branche non-projectile (`rounds = base × mult + bonus`, plus bas). Sans elle, les effets
    // durables d'un Projectile (dont ses États PORTÉS) ignoraient les DR dépensés sur la Durée.
    const { mult: ocMult, bonusRounds: ocBonus } = overcastDurationParts(overcastSourceOf(spell), ch.overcastDurationSteps ?? 0);
    const baseRounds = spell.duration?.kind === 'rounds' ? resolveFormula(spell.duration.value, caster, battleRng()) : null;
    const rounds = baseRounds != null ? baseRounds * ocMult + ocBonus : null;
    const baseClockMin = baseRounds == null ? durationClockMinutes(spell.duration, caster, get().gameTime) : null;
    const clockMin = baseClockMin != null ? baseClockMin * ocMult : null;
    lignes.push(...runCastFlow(get, set, cible, caster, spellFlowFor(spell.effects, 'target'), {
      rng: battleRng(), caster, label: spell.label, now: get().gameTime, sl: spellSLFor(mres.sl, cible, ch.zoneTalentMod),
      overcastDurationSteps: ch.overcastDurationSteps, chosenTableRolls: ch.chosenTableRolls,
      ...(rounds != null ? { defaultDurationRounds: rounds } : {}),
      ...(clockMin != null ? { defaultUntilTime: get().gameTime + clockMin } : {}),
      ...(ch.sourceSpell ? { sourceSpell: ch.sourceSpell } : {}), sourceSpellId: spell.id,
      ...(ch.conjureForm ? { conjureForm: ch.conjureForm } : {}),
      onCorruption: followsCharacterRules(cible) ? (n, align) => gainCorruption(get, set, cible, n, align) : undefined, // #143 : personnage, pas un proxy `kind`
    }));
  }
  // Vol de vie (LDB 48 — Mort : Caresse de Laniph, Vol de vie) : op `lifeSteal` du Flow (on:'caster')
  // — le lanceur récupère une fraction des Blessures RÉELLEMENT infligées (`ctx.woundsDealt`, jamais
  // plus que les PB perdus par la cible). Le missile ne joue pas le sous-Flow `caster`, on applique
  // donc la/les op(s) lifeSteal directement avec les Blessures infligées en contexte.
  if (mres.woundsLost) {
    const dealt = Math.min(mres.woundsLost, currentBefore);
    const lifeStealOps = spellOps(spell.effects, 'caster').filter((o) => o.op === 'lifeSteal');
    if (lifeStealOps.length) lignes.push(...applyOps(caster, lifeStealOps, { rng: battleRng(), caster, label: spell.label, woundsDealt: dealt, source: { kind: 'spell', id: spell.id } }));
  }
  // Interruption de Focalisation : un Projectile magique blesse aussi un focaliseur (LDB 46 l.144).
  lignes.push(...checkFocusInterruption(get, set, cible));
  if (isOutOfAction(cible)) lignes.push(tr('cf.outOfAction', { name: cible.label }));
  return { issue: suspenduParDeviation ? 'suspendue-deviation' : 'appliquee', lignes };
}

/**
 * UNE touche de Projectile POUR UNE CIBLE (#1508) — ÉCRITURE UNIQUE des pré-traitements qui précèdent
 * l'application : immunité de Domaine (Middenheim, #18), re-localisation d'un Coup Critique
 * (`LDB 18 l.53-55`), Résistance à la Magie (`LDB 85 l.302` / `LDB 10 l.1026`). HISSÉE hors de la closure
 * d'`applyCast` pour être RÉ-ENTRANTE, comme `appliquerToucheDeProjectile` qu'elle appelle : la cible
 * initiale, une cible supplémentaire de Surincantation et un maillon de rebond passent tous par ICI.
 */
function appliquerTouchePourCible(get: Get, set: SetFn, cible: Combatant, touche: ToucheDeProjectile): ToucheAppliquee {
  const caster = actorIn(get(), touche.casterId);
  if (!caster) return { issue: 'cible-absente', lignes: [tr('cascade.cibleDisparue', { label: touche.spell.label })] };
  const spell = touche.spell;
  // Manifestation de Ghur (Middenheim, #18) : un Projectile du Domaine de la Bête n'affecte PAS le
  // porteur — ses Dégâts ET ses effets (effets négatifs du Sort de la Bête) sont sautés sur cette cible.
  if (immuneToSpellDomain(cible.traits, spell.domainId)) return { issue: 'appliquee', lignes: [tr('cf.spellDomainImmune', { name: cible.label, spell: spell.label })] };
  const lignes: string[] = [];
  let mres = touche.mres;
  // LDB 18 l.53/55 : un Projectile Coup Critique re-tire la Localisation (1d100 frais, MÊME primitive
  // que la mêlée — pas le dé inversé) et RÉ-ÉVALUE ses Dégâts à cette loc AVANT les atténuations
  // magiques ci-dessous (Résistance/Dôme/Martyr).
  if (touche.critWound) mres = evaluateMissile(caster, cible, spell, mres, critWoundLocation(battleRng(), cible.bodyShape), 0, touche.overcastDamageSteps);
  // Résistance à la Magie (LDB 85 l.302 / LDB 10 l.1026) : le DR du Sort est réduit CONTRE cette
  // cible — les Dégâts en découlent (`evaluateMissile`), le plancher de 1 Blessure reste celui du
  // RAW (LDB 13 l.155-163). Le jet figé (roll/Surincantation) n'est pas rejoué : seul le DR change.
  const drMod = spellDRModFor(cible, touche.zoneTalentMod);
  if (drMod !== 0) {
    lignes.push(tr('cf.resistMagic', { name: cible.label, mr: -drMod }));
    if (!spellLandsOn(mres, cible, touche.zoneTalentMod)) {
      lignes.push(tr('cf.resistMagicNI', { name: cible.label, spell: spell.label, dr: spellSLFor(mres.sl, cible, touche.zoneTalentMod), ni: mres.niRequired ?? 0 }));
      return { issue: 'appliquee', lignes };
    }
    mres = evaluateMissile(caster, cible, spell, { ...mres, zoneSpellDRMod: touche.zoneTalentMod }, mres.location, 0, touche.overcastDamageSteps);
  }
  const appliquee = appliquerToucheDeProjectile(get, set, { ...touche, mres });
  return { issue: appliquee.issue, lignes: [...lignes, ...appliquee.lignes] };
}

/**
 * LE REBOND d'« Attaques en chaîne » (`LDB 47 l.340`), JOUÉ depuis la touche qui le DÉCLARE — l'appelant
 * DÉCLARE, la reprise JOUE. Relit `get().battle` à CHAQUE maillon : « réduit la cible à 0 Blessure » se
 * juge sur l'état FRAIS, jamais sur celui d'avant une fenêtre en vol (sauvegarde, Déviation Critique).
 * Un maillon qui SUSPEND rend la main — sa charge porte le rebond RESTANT (`bounce`/`hitIds` avancés),
 * et c'est la reprise de CETTE fenêtre qui rappellera cette fonction : jamais deux fois le même maillon.
 */
function jouerLeRebond(get: Get, set: SetFn, touche: ToucheDeProjectile): string[] {
  const rebond = touche.rebond;
  if (!rebond) return [];
  const spell = touche.spell;
  const lignes: string[] = [];
  let prevId = touche.targetId;
  let hitIds = rebond.hitIds;
  for (let bounce = rebond.bounce; bounce < rebond.maxBounces; bounce++) {
    const battle = get().battle;
    if (!battle) break;
    const caster = inBattleId(battle, touche.casterId);
    const prev = inBattleId(battle, prevId);
    if (!caster?.pos || !prev) break;
    if (!(prev.wounds.current <= 0 || prev.dead)) break; // « réduit la cible à 0 Blessure »
    // La cible du maillon suivant (`LDB 47 l.340`).
    const next = battle.combatants
      .filter((c) => c.kind !== caster.kind && !hitIds.includes(c.id) && !isOutOfAction(c) && c.pos
        && combatDistance(prev, c) <= rebond.hopTiles
        && (rebond.initialRange == null || combatDistance(caster, c) <= rebond.initialRange))
      .sort((a, b) => combatDistance(prev, a) - combatDistance(prev, b))[0];
    if (!next) break;
    // « infligeant de nouveau les mêmes Dégâts » : le jet ORIGINAL du lancement, ré-évalué CONTRE cette
    // cible — le résultat déjà atténué de la précédente (Résistance à la Magie, loc de Critique) la
    // contaminerait. La cible d'un rebond est HORS de la zone du lancement : elle est SA propre zone.
    const r2 = evaluateMissile(caster, next, spell, rebond.res, undefined, 0, touche.overcastDamageSteps);
    lignes.push(tr('cf.spellBounces', { spell: spell.label, name: next.label }), r2.log);
    hitIds = [...hitIds, next.id];
    const maillon = appliquerTouchePourCible(get, set, next, {
      ...touche, targetId: next.id, mres: r2, zoneTalentMod: talentSpellDRMod(next),
      rebond: { ...rebond, bounce: bounce + 1, hitIds },
    });
    lignes.push(...maillon.lignes);
    bus.emit(EVT.ANIM_ATTACK, { from: prev.id, to: next.id, result: r2, kind: 'spell', spell: spell.label, defense: 'none' });
    if (maillon.issue !== 'appliquee') return lignes; // la reprise de cette fenêtre jouera le reste
    prevId = next.id;
  }
  return lignes;
}

/** Applique un résultat d'incantation DÉJÀ obtenu (mute caster/cible, consomme l'Action). */
export function applyCast(
  get: Get,
  set: SetFn,
  caster: Combatant,
  target: Combatant,
  spell: NonNullable<ReturnType<typeof findSpell>>,
  res: CastResult & Partial<MissileResult>,
  missile: boolean,
  focusedNI0: boolean,
  critChoice?: CastCritChoice,
  extras?: { durationMult?: number; durationBonusRounds?: number; overcastDurationSteps?: number; overcastDamageSteps?: number; chosenTableRolls?: number; extraTargets?: Combatant[]; conjureForm?: ConjureForm; opposedOutcome?: Record<string, { resisted: boolean; margin: number }> },
) {
  const battle = get().battle; // null = incantation HORS COMBAT (couture D) : même applyCast, sortie journal
  // Durée surincantée DÉCOMPOSÉE (engine/overcast) : `rounds = base × mult + bonus`. Arcane/Miracle :
  // mult = 1+pas, bonus = 0 (×initial, joue aussi sur une durée d'horloge). Bénédiction : mult = 1,
  // bonus = 6 Rounds × pas (FIXE, rounds-only — pas de Bénédiction à durée d'horloge).
  const durationMult = Math.max(1, extras?.durationMult ?? 1);
  const durationBonusRounds = Math.max(0, extras?.durationBonusRounds ?? 0);
  // Jets supplémentaires COUPLÉS au pas de Surincantation alloué à la Durée (EDOC 13 l.270-276) —
  // jamais au DR total du jet (`rollTable.extraRollsPerStep`, `OpsCtx.overcastDurationSteps`). Le jet est
  // DÉCLINABLE (l.276 « vous pouvez ») : `chosenTableRolls` (absent = tous les pas, IA/rétrocompat).
  const overcastDurationSteps = Math.max(0, extras?.overcastDurationSteps ?? 0);
  // DR alloués à la colonne « Dégât en plus » du Tableau de Surincantation (`VDM 02 l.198`,
  // `missileOvercastDamageBonus`) — le jet est FIGÉ avant l'allocation (`pc.result`) : la
  // réévaluation ci-dessous (et à chaque recalcul de Projectile) est le SEUL point qui verse ce DR.
  const overcastDamageSteps = Math.max(0, extras?.overcastDamageSteps ?? 0);
  const chosenTableRolls = extras?.chosenTableRolls;
  let teleportReach: Map<string, number> | null = null; // Téléportation (Jalon 2.6) : posé APRÈS finishPlayerAction
  const extraTargets = extras?.extraTargets ?? [];
  // Résistance à la Magie (LDB 85 l.302 / LDB 10 l.1026) : le modificateur du TALENT est celui de la
  // ZONE des cibles de ce lancement (un seul pour tout le Sort) ; celui du TRAIT reste per-cible. Une
  // cible touchée HORS de cette zone (rebond d'une attaque en chaîne) est sa propre zone.
  // « la zone de sa cible » (LDB 10 l.1026) est LUE comme les CIBLES du lancement, jamais l'aire
  // géométrique : un porteur du Talent présent sur le terrain mais NON ciblé ne confère rien
  // (rétrécissement assumé — lecture retenue, réf #1007).
  const zoneTargets = [target, ...extraTargets];
  // Projectile magique (LDB 46) : c'est une ATTAQUE (jet du lanceur opposé à la défense de la cible) —
  // trace orientée du Round posée par le MÊME helper que les armes (`markAttacked`, LDB 85 l.383). Les
  // autres Sorts passent ici aussi bien pour soigner que pour nuire : rien ne s'y marque.
  if (missile) for (const t of zoneTargets) markAttacked(caster, t);
  const zoneTalentMod = zoneTalentSpellDRMod(zoneTargets);
  const zoneMod = (t: Combatant): number => (zoneTargets.includes(t) ? zoneTalentMod : talentSpellDRMod(t));
  /** DR du Sort tel que le subit `t` — SITE UNIQUE lu par les Flows, les zones, l'invocation, le NI. */
  const slFor = (t: Combatant): number => spellSLFor(res.sl, t, zoneMod(t));

  // Incantation CRITIQUE (LDB 46 l.26-32) — SORTS seulement (Test de Langue (Magick)) :
  // les Vents octroient une puissance supplémentaire (choix du lanceur), mais cela a un
  // prix — Imparfaite Mineure, sauf Talent Diction instinctive.
  const isSort = !castInfoIsPrayer(spell);
  // DISSIPATION (LDB 46 l.158-160) : identité du Sort source, marquée sur ses ActiveEffect DURABLES (via
  // `OpsCtx.sourceSpell` → `applyOps`) pour autoriser un Test étendu de Langue (Magick) jusqu'au NI. Sorts
  // seulement (les Prières ne se dissipent pas par Contre-sort). Sort instantané → aucun effet → rien à marquer.
  // La ZdE RÉSOLUE voyage avec le sort source : une aura de garde (Dôme, Bouclier anti-flèches) LIT sa
  // zone au lieu de la re-déclarer — elle est écrite à UN endroit, la ligne « Cible » du sort. Les deux
  // lectures viennent de leurs sites uniques (`zdeDiameterMeters`, `zoneRadiusMeters` pour le ÷ 2).
  const zdeDiam = zdeDiameterMeters(spell.target, caster);
  const sourceSpell = isSort
    ? {
      spellId: spell.id, ni: spell.cn ?? 0, casterId: caster.id, label: spell.label,
      ...(zdeDiam != null ? { zde: { diametreM: zdeDiam, rayonM: zoneRadiusMeters(spell, caster)! } } : {}),
    }
    : undefined;
  // IDENTITÉ du sort (Unicité RAW / anti-spam IA) : posée sur TOUT effet durable de ce lancement — Prières
  // COMPRISES (≠ `sourceSpell`, réservé à la dissipation arcanique). Une bénédiction durable est ainsi
  // reconnue par `isSpellActive`/`buildAiInput` pour ne pas la re-lancer en boucle (LDB 46 l.116-121).
  const sourceSpellId = spell.id;
  // Un Sort DISSIPÉ (Contre-sort gagnant, LDB 46 l.156) n'est pas lancé : pas d'effet Critique
  // — « Puissance totale » (l.57) repêche un DR insuffisant, pas une Dissipation.
  const crit = !!res.isCritical && isSort && !res.dispelled;
  // Axe Dégâts de la Surincantation (`VDM 02 l.198`) : le résultat FIGÉ au jet (`pc.result`) ignorait
  // l'allocation (encore à venir) — on la reverse ici, avant tout autre recalcul de Projectile.
  if (missile && res.cast && overcastDamageSteps > 0) {
    res = evaluateMissile(caster, target, spell, res, undefined, 0, overcastDamageSteps);
  }
  let choice = critChoice;
  if (crit) {
    choice ??= defaultCritChoice(res, !!missile);
    if (choice === 'puissance') {
      const full = applyFullPower(res);
      if (full !== res) {
        res = missile
          ? evaluateMissile(caster, target, spell, full, undefined, 0, overcastDamageSteps)
          : { ...full, log: `${caster.label} lance ${spell.label} (Puissance totale — Critique).` };
      }
    }
  }
  const logLines: string[] = [res.log];
  // Composant d'incantation (LDB 46 l.107-113, règle optionnelle) : consommé UNE fois par lancement
  // d'un Sort d'Arcane/Domaine couvert, « même si aucune Incantation Imparfaite n'a été obtenue »
  // (l.111). `componentUsed` → toute Imparfaite de ce lancement est dégradée (Majeure→Mineure,
  // Mineure→annulée). N'a pas lieu pour une Prière (l.113 : composants = Sorts d'Arcane/Domaine).
  const componentUsed = isSort && useSpellComponent(caster, spell.id, logLines);
  // Malepierre PORTÉE (`VDM 02 l.163-165`) : le doublement du DR (déjà figé sur `res.malepierreConsumed`,
  // `engine/magic.ts`) décrémente ICI la réserve — seul point d'ÉCRITURE (`consumeMalepierre`).
  const malepierreItem = res.malepierreConsumed ? malepierreItemOf(caster) : undefined;
  consumeMalepierre(caster, res.malepierreConsumed);
  // LDB 46 l.173 : « Incanter ou Focaliser à l'aide d'une malepierre entraîne une influence
  // corruptrice ». Réutilise le `corruptionExposure` déjà porté par l'entrée du catalogue
  // (`TrappingData.consumable`) — MÊME chemin d'exécution qu'un consommable bu (`runConsumable`),
  // jamais un second chemin ad hoc.
  if (malepierreItem) runConsumable(get, set, caster, malepierreItem);
  // Influences malfaisantes (LDB 46 l.89 ; `VDM 02 l.157-159` sous option) & Sorcellerie (LDB 49) —
  // Sorts seulement, à résoudre APRÈS la résolution du Sort (bloc `applyExtraMiscast`). `nearCorruption`
  // = source de Corruption à proximité (lieu ou créature) ; `sorcery` = Sort du Domaine de la
  // Sorcellerie, règle optionnelle active.
  const nearCorruption = isSort && castNearCorruption(get);
  const sorcery = isSort && rule('magic-sorcellerie') === true && isSorceryDomain(spell);
  // Sévérité DÉCIDÉE UNE fois (source unique du delta) : quand elle tombe, l'Imparfaite Mineure du
  // fumble est SUBSUMÉE (`malevolentHandled`), sinon on l'appliquerait en double.
  const malevolent = malevolentInfluenceSeverity(res.roll, res.roll <= res.target, nearCorruption, res.isFumble);
  const malevolentHandled = malevolent !== null;
  /** Imparfaite ADDITIONNELLE due aux Influences malfaisantes / à la Sorcellerie, appliquée UNE fois après le Sort. */
  const applyExtraMiscast = (): void => {
    if (malevolent) logLines.push(...applyMiscast(get, set, caster, malevolent, { componentDowngrade: componentUsed && !sorcery, sorceryCorruption: sorcery, domainId: spell.domainId ?? undefined }));
    else if (sorceryMandatoryMiscast(sorcery, componentUsed) && !res.isFumble) logLines.push(...applyMiscast(get, set, caster, 'mineure', { sorceryCorruption: true, domainId: spell.domainId ?? undefined }));
  };
  if (crit) {
    logLines.push(
      choice === 'critique'
        ? tr('cf.castCritical')
        : choice === 'puissance'
          ? tr('cf.overcastFullPower')
          : tr('cf.overcastIrresistible'),
    );
    if (!hasInstinctiveDiction(caster)) logLines.push(...applyMiscast(get, set, caster, 'mineure', { componentDowngrade: componentUsed && !sorcery, sorceryCorruption: sorcery, domainId: spell.domainId ?? undefined }));
    else logLines.push(tr('cf.dictionInstinctive'));
  }
  // « Avantages et Magie » (LDB 46 l.123-125) : si la cible a déjà été visée par un Sort du
  // MÊME Domaine ce Round, le lanceur gagne +1 Avantage (le Vent converge). Sorts seulement.
  if (battle && isSort && spell.domainId && res.cast) {
    const marks = battle.domainCasts ?? [];
    if (marks.some((m) => m.targetId === target.id && m.domain === spell.domainId)) {
      campGain(get, caster);
      caster.gainedAdvThisRound = true;
      logLines.push(tr('cf.windConverges', { name: caster.label, wind: spell.subType ?? spell.domainId, target: target.label }));
    }
    battle.domainCasts = [...marks, ...[target, ...extraTargets].map((t) => ({ targetId: t.id, domain: spell.domainId! }))];
  }

  if (missile) {
    // Touche d'un Projectile : application des Blessures + Critique (choix/overkill).
    const missileSpec = spell;
    /** LA TOUCHE telle qu'elle voyage — bâtie ICI pour les trois sites de cible (initiale, cible
     *  supplémentaire de Surincantation, maillon de rebond), jamais recomposée à la reprise. */
    const toucheDe = (t: Combatant, mres: CastResult & Partial<MissileResult>, rebond?: RebondDeChaine): ToucheDeProjectile => ({
      casterId: caster.id, targetId: t.id, spell, mres, zoneTalentMod: zoneMod(t),
      // `crit` = double d'Incantation, `choice` = Incantation Critique (LDB 46 l.30).
      critWound: !!(crit && choice === 'critique'),
      overcastDamageSteps, overcastDurationSteps,
      ...(chosenTableRolls != null ? { chosenTableRolls } : {}),
      ...(extras?.conjureForm ? { conjureForm: extras.conjureForm } : {}),
      ...(sourceSpell ? { sourceSpell } : {}),
      ...(rebond ? { rebond } : {}),
    });
    // Attaques en chaîne (LDB 47 l.340) : « Si [le Projectile] réduit la cible à 0 Blessure, il
    // rebondit sur une autre cible » — DÉCLARÉ ici sur la touche initiale (max BFM rebonds, saut de
    // BFM m, portée INITIALE du sort), JOUÉ par `jouerLeRebond` une fois la touche close.
    const chainOp = spellOps(spell.effects, 'caster').find((o): o is Extract<GameOp, { op: 'chain' }> => o.op === 'chain');
    const rebond: RebondDeChaine | undefined = chainOp && res.cast && battle && caster.pos
      ? {
        hitIds: [target.id, ...extraTargets.map((t) => t.id)], bounce: 0,
        maxBounces: Math.max(0, resolveFormula(chainOp.maxBounces, caster, battleRng())),
        hopTiles: Math.max(1, Math.ceil(Math.max(0, resolveFormula(chainOp.hopMeters, caster, battleRng())) / 2)),
        initialRange: spellRangeTiles(spell.range, caster), res,
      }
      : undefined;
    const toucheInitiale = toucheDe(target, res, rebond);
    const initiale = appliquerTouchePourCible(get, set, target, toucheInitiale);
    logLines.push(...initiale.lignes);
    // Nerveux (effet déclenché onStartled : magie → +3 Brisé) — dispatcher générique (state/triggeredEffects).
    // Cause 'magic' (présence de magie) → exemption Dressé (Magie) lue par la Condition Flow `startleCause`.
    for (const t of [target, ...extraTargets]) {
      if (res.cast && !isOutOfAction(t)) emitCombatEvent('onStartled', { get, set, battle: get().battle!, self: t, sink: (line) => logLines.push(line), triggerCtx: { startleCause: 'magic' } });
    }
    // Surincantation « Cible » (LDB 47 l.28-31) : le MÊME jet frappe les cibles supplémentaires.
    for (const t2 of extraTargets) {
      if (!res.cast) break;
      const r2 = evaluateMissile(caster, t2, spell, res, undefined, 0, overcastDamageSteps);
      logLines.push(r2.log);
      logLines.push(...appliquerTouchePourCible(get, set, t2, toucheDe(t2, r2)).lignes);
      if (battle) bus.emit(EVT.ANIM_ATTACK, { from: caster.id, to: t2.id, result: r2, kind: 'spell', spell: spell.label, defense: 'none' });
    }
    // Le rebond DÉCLARÉ plus haut ne se joue ICI que si la touche initiale est CLOSE : suspendue
    // (sauvegarde, Déviation Critique), c'est SA reprise qui le jouera, sur des PB frais.
    if (rebond && initiale.issue === 'appliquee') logLines.push(...jouerLeRebond(get, set, toucheInitiale));
    // Zone persistante d'un Projectile (Grands feux d'U'Zhul : « le feu continue de brûler
    // dans la Zone d'Effet pour la durée du Sort ») — posée autour de la cible touchée.
    if (res.cast) placeSpellZone(get, caster, target, spell, missileSpec, slFor(target), durationMult, durationBonusRounds, logLines);
    // Maladresse d'un Sort → Incantation Imparfaite Mineure ; sort focalisé dont
    // l'incantation échoue → Imparfaite Mineure également (Livre de base l.183).
    if (res.isFumble && !malevolentHandled) logLines.push(...applyMiscast(get, set, caster, 'mineure', { componentDowngrade: componentUsed && !sorcery, sorceryCorruption: sorcery, domainId: spell.domainId ?? undefined }));
    else if (focusedNI0 && !res.cast && !malevolentHandled) logLines.push(...applyMiscast(get, set, caster, 'mineure', { componentDowngrade: componentUsed && !sorcery, sorceryCorruption: sorcery, domainId: spell.domainId ?? undefined }));
    applyExtraMiscast(); // Règle du 8 / Sorcellerie (LDB 46 l.89 / LDB 49)
    // Sort offensif : lanceur vers la cible, cible vers le lanceur.
    if (caster.pos && target.pos && caster.id !== target.id) {
      set((s: GameState) => ({ facing: { ...s.facing, [caster.id]: facingToward(caster.pos!, target.pos!), [target.id]: facingToward(target.pos!, caster.pos!) } }));
    }
    bus.emit(EVT.ANIM_ATTACK, { from: caster.id, to: target.id, result: res, kind: 'spell', spell: spell.label, defense: 'none' });
  } else {
    if (res.cast) {
      // Effets structurés du sort (spec curée du registre, sinon repli regex sur la
      // desc — iso-POC). Durée hors-rounds (minutes/heures/jours, LDB 47) : l'effet reçoit une durée
      // `{scale:'clock'}` (échéance d'HORLOGE `gameTime`, purgée par l'horloge), pas un nombre de
      // Rounds — on n'en invente PAS. Surincantation « Durée » : ×(1+n) (LDB 47).
      const spec = spell;
      const baseRounds = spec.duration?.kind === 'rounds' ? resolveFormula(spec.duration.value, caster, battleRng()) : null;
      const rounds = baseRounds != null ? baseRounds * durationMult + durationBonusRounds : null;
      const baseClockMin = baseRounds == null ? durationClockMinutes(spell.duration, caster, get().gameTime) : null;
      const clockMin = baseClockMin != null ? baseClockMin * durationMult : null;
      if ((durationMult > 1 || durationBonusRounds > 0) && baseRounds != null) logLines.push(tr('cf.overcastDuration', { rounds: String(rounds) }));
      if (durationMult > 1 && baseClockMin != null) logLines.push(tr('cf.overcastDurationMin', { mult: durationMult }));
      for (const t of [target, ...extraTargets]) {
        if (t !== target) logLines.push(tr('cf.spellExtends', { spell: spell.label, name: t.label }));
        // OPPOSITION (spec.opposed) résolue dans la modale : une cible qui l'a emporté RÉSISTE (aucune
        // op) ; sinon les ops portent sur la MARGE de DR (l'écart de l'opposition → échelles `perSL`).
        const opp = extras?.opposedOutcome?.[t.id];
        if (opp?.resisted) { logLines.push(tr('cf.spellResisted', { name: t.label, spell: spell.label })); continue; }
        // Manifestation de Ghur (Middenheim, #18) : un Sort du Domaine de la Bête n'applique aucun de ses
        // effets au porteur (immunité par lore — `spellDomainImmunity`, lue par id depuis ses Traits).
        if (immuneToSpellDomain(t.traits, spell.domainId)) { logLines.push(tr('cf.spellDomainImmune', { name: t.label, spell: spell.label })); continue; }
        // Résistance à la Magie (LDB 85 l.302 / LDB 10 l.1026) : le DR du Sort est réduit CONTRE cette
        // cible — magnitude et durée échelonnées sur `ctx.sl` suivent ; sous le NI, le Sort ne l'affecte plus.
        const drMod = spellDRModFor(t, zoneMod(t));
        if (drMod !== 0) {
          logLines.push(tr('cf.resistMagic', { name: t.label, mr: -drMod }));
          if (!spellLandsOn(res, t, zoneMod(t))) {
            logLines.push(tr('cf.resistMagicNI', { name: t.label, spell: spell.label, dr: slFor(t), ni: res.niRequired ?? 0 }));
            continue;
          }
        }
        logLines.push(
          // Tout sort passe par le système Flow/EffectOp : `spell.effects` (Flow éditable, feuilles
          // `on:'target'`) → `runCombatFlow` (exécuteur unique, after-aware) → applyOps. Les feuilles
          // `on:'caster'` sont appliquées à part.
          ...runCastFlow(get, set, t, caster, spellFlowFor(spell.effects, 'target'), {
            rng: battleRng(),
            caster,
            label: spell.label,
            now: get().gameTime,
            sl: opp ? opp.margin : slFor(t),
            overcastDurationSteps,
            chosenTableRolls,
            ...(rounds != null ? { defaultDurationRounds: rounds } : {}),
            ...(clockMin != null ? { defaultUntilTime: get().gameTime + clockMin } : {}),
            ...(sourceSpell ? { sourceSpell } : {}), sourceSpellId,
            ...(extras?.conjureForm ? { conjureForm: extras.conjureForm } : {}),
            onCorruption: followsCharacterRules(t) ? (n, align) => gainCorruption(get, set, t, n, align) : undefined, // #143 : personnage, pas un proxy `kind`
          }),
        );
        // Métamorphose (Forme bestiale, LDB 48) : op `polymorph` du Flow (on:'target') — appliquée
        // ci-dessus par runCastFlow → applyOps (expansion charMod différentiel + grantTrait via
        // engine/polymorph, auto-restitués à l'expiration). Plus de site dédié.
      }
      // POUSSÉE (Jalon 2.6 — « Toutes les créatures à BFM mètres sont repoussées de BFM
      // mètres », LDB 47 l.479) : recul en ligne (direction lanceur→cible) jusqu'à
      // l'obstacle ; la collision est journalisée (Dégâts = distance restante, MJ).
      for (const op of spellOps(spell.effects, 'caster')) {
        if (op.op !== 'push' || !battle || !caster.pos) continue;
        const pushTiles = Math.max(1, Math.floor(resolveFormula(op.meters, caster, battleRng()) / 2));
        for (const t of [target, ...extraTargets]) {
          if (t.id === caster.id || !t.pos || isOutOfAction(t)) continue;
          const r = pushAway(get().scene!, caster.pos, t.pos, pushTiles, { blocked: occupied(battle, t) });
          if (r.pushed > 0) {
            const fromPos = { ...t.pos };
            placeCombatant(t, get().scene, r.dest);
            bus.emit(EVT.ANIM_MOVE, { id: t.id, path: [{ ...r.dest }] });
            logLines.push(tr('cf.pushed', { name: t.label, m: r.pushed * 2 }));
            applyZoneCrossings(get, set, t, [...tilesBetween(fromPos, r.dest), { ...r.dest }]); // une poussée TRAVERSE (Mur de feu, L11)
          }
          if (r.collided) logLines.push(tr('cf.collided', { name: t.label }));
        }
      }
      // Sort « Souffle » (LDB 47 l.509) : « comme si vous aviez dépensé 2 Avantages pour activer
      // le Trait Souffle » — délégué à l'attaque de ZONE du Trait, centrée sur la CIBLE du sort,
      // Dégâts = Bonus d'Endurance du lanceur, Type mappé du Domaine. Sans coût d'Avantage (le
      // sort EST l'activation). Hors combat : pas de grille → journalisé.
      if (spec.breathAttack) {
        if (battle && caster.pos) {
          const type = domainBreathType(caster);
          // Manœuvre Souffle de 1ʳᵉ classe (données) choisie par le Type du Domaine ; défaut `souffle-feu`.
          // Indice = Bonus d'Endurance du lanceur (RAW : « Dégâts = Bonus d'Endurance »). Coût d'Avantage 0
          // (le sort EST l'activation).
          const sDef = (type && findManeuverById(`souffle-${norm(type)}`)) || findManeuverById('souffle-feu')!;
          const indice = bonus(effectiveChar(caster, 'endurance'));
          applyAreaAttack(get, set, caster, {
            kind: 'souffle', label: sDef.label, bonus: indice, indice, def: sDef,
            trigger: 'free', avantage: 0, aoe: true, magic: true, ...(type ? { type } : {}),
          }, target);
          if (!type) logLines.push(tr('cf.breathNoType'));
        } else {
          logLines.push(tr('cf.breathNarrative', { name: caster.label }));
        }
      }
      // Zone persistante d'un sort de soutien/zone (Mur de feu : « Quiconque traverse… »).
      if (res.cast) placeSpellZone(get, caster, target, spell, spec, slFor(target), durationMult, durationBonusRounds, logLines);
      // TÉLÉPORTATION (Jalon 2.6 — « vous vous téléportez de BFM mètres (+BFM par +2 DR) »,
      // LDB 47 l.517-519) : le choix de la case d'arrivée suit l'Appliquer (mode 'teleport',
      // cases = survol des obstacles, atterrissage libre — battleClickTile).
      const tpOp = spellOps(spell.effects, 'caster').find((o): o is Extract<GameOp, { op: 'teleport' }> => o.op === 'teleport');
      if (tpOp && res.cast) {
        let meters = Math.max(0, resolveFormula(tpOp.meters, caster, battleRng()));
        if (tpOp.perSL) {
          meters += Math.floor(slFor(caster) / Math.max(1, tpOp.perSL.every))
            * Math.max(0, resolveFormula(tpOp.perSL.metersFormula, caster, battleRng()));
        }
        if (battle && caster.pos) {
          const tpTiles = Math.max(1, Math.floor(meters / 2));
          teleportReach = flyReachable(get().scene!, caster.pos, tpTiles, moveEnv(battle, caster));
          logLines.push(tr('cf.teleportChoose', { name: caster.label, m: meters }));
        } else {
          logLines.push(tr('cf.teleportFree', { name: caster.label, m: meters }));
        }
      }
    } else if (res.isFumble) {
      // Prière → Colère des dieux ; Sort → Incantation Imparfaite Mineure (subsumée par la Règle du 8 sur « 88 »).
      if (castInfoIsPrayer(spell)) logLines.push(...applyMiscast(get, set, caster, 'colere', { componentDowngrade: componentUsed }));
      else if (!malevolentHandled) logLines.push(...applyMiscast(get, set, caster, 'mineure', { componentDowngrade: componentUsed && !sorcery, sorceryCorruption: sorcery, domainId: spell.domainId ?? undefined }));
    } else if (focusedNI0 && !malevolentHandled) {
      // Sort focalisé dont l'incantation échoue (sans Maladresse) → Imparfaite Mineure.
      logLines.push(...applyMiscast(get, set, caster, 'mineure', { componentDowngrade: componentUsed && !sorcery, sorceryCorruption: sorcery, domainId: spell.domainId ?? undefined }));
    }
    applyExtraMiscast(); // Règle du 8 / Sorcellerie (LDB 46 l.89 / LDB 49)
    // Sort de SOUTIEN (bénédiction/soin/buff) ou prière non-projectile : émet aussi l'event
    // d'incantation → geste de canalisation (RigToken) + halo/aura tinté à l'école (IsoStage).
    // Soutien : le lanceur se tourne vers la cible ; pas de réaction de la cible (ce n'est pas une frappe).
    // Hors combat (pas de file/token tactique), on n'anime pas le geste iso.
    if (battle && caster.pos && target.pos && caster.id !== target.id) {
      set((s: GameState) => ({ facing: { ...s.facing, [caster.id]: facingToward(caster.pos!, target.pos!) } }));
    }
    if (battle) bus.emit(EVT.ANIM_ATTACK, { from: caster.id, to: target.id, result: res, kind: 'spell', spell: spell.label, defense: 'none' });
  }

  // Attributs de Domaine (LDB 48 — L14) : riders post-lancement d'un Sort « issu du Domaine ».
  if (res.cast) {
    for (const t of [target, ...extraTargets]) {
      // Une cible qui a EMPORTÉ l'opposition (spec.opposed) résiste au Sort entier : pas de rider de Domaine.
      if (extras?.opposedOutcome?.[t.id]?.resisted) continue;
      // Riders « à la touche » du Domaine = DONNÉE (`domains.json`), dispatchés comme les autres onHit ;
      // le gating « cible adverse / vivante / résiste par Talent » vit dans les Conditions Flow.
      logLines.push(...applyTriggeredEffects(get, caster, domainOnHitEffects(spell), 'onHit', { victim: t, rng: battleRng(), set }));
    }
    // (L'arc de zone des Cieux/Azyr est un `effects` AUTHORÉ du domaine — ciblage `on:{near:'victim'}` +
    //  op `wounds bypassArmour:'metal'` — dispatché par le `domainOnHitEffects` ci-dessus, plus de code dédié.)
    // Ops post-incantation au LANCEUR (Bête → Peur 1) — paramètre en données (DomainData.casterOps).
    logLines.push(...domainCasterOps(caster, spell, battleRng()));
    // Effets sur le LANCEUR (op casterOps — Vol de vie « retirez tout État Exténué dont vous
    // souffrez », buffs de soi d'un sort offensif) : appliqués une seule fois par lancement.
    const castSpec = spell;
    // INVOCATION (op `summon` du Flow éditable — Nécromancie, Hurlement du loup, Manifestation de démon,
    // Roi de la Nature…) : la/les créature(s) entrent en combat près du lanceur et se dissipent à
    // l'expiration (state/summonFlow). Effet IMPUR du Flow résolu ici (grille/initiative) ; les feuilles
    // `on:'caster'` sont par ailleurs jouées par runCastFlow (où `summon` reste inerte → pas de doublon).
    const sumRounds = castSpec.duration?.kind === 'rounds' ? resolveFormula(castSpec.duration.value, caster, battleRng()) : null;
    for (const sOp of spellOps(spell.effects, 'caster')) {
      if (sOp.op !== 'summon') continue;
      logLines.push(...applySummon(get, set, caster, sOp, { sl: slFor(caster), rounds: sumRounds, label: spell.label, rng: battleRng(), spellId: spell.id }));
    }
    // Effets sur le LANCEUR (feuilles `on:'caster'` de `spell.effects` — Vol de vie « retirez tout État
    // Exténué dont vous souffrez », buffs de soi d'un sort offensif) : appliqués UNE seule fois par lancement.
    if (spellOps(spell.effects, 'caster').length) {
      // MÊME règle de Durée surincantée que les feuilles `on:'target'` (#1695) : `base × mult + bonus`.
      const base = castSpec.duration?.kind === 'rounds' ? resolveFormula(castSpec.duration.value, caster, battleRng()) : null;
      const baseRounds = base != null ? base * durationMult + durationBonusRounds : null;
      const brutClockMin = base == null ? durationClockMinutes(spell.duration, caster, get().gameTime) : null;
      const clockMin = brutClockMin != null ? brutClockMin * durationMult : null;
      logLines.push(...runCastFlow(get, set, caster, caster, spellFlowFor(spell.effects, 'caster'), {
        rng: battleRng(), caster, label: spell.label, now: get().gameTime, sl: slFor(caster), overcastDurationSteps, chosenTableRolls,
        ...(baseRounds != null ? { defaultDurationRounds: baseRounds } : {}),
        ...(clockMin != null ? { defaultUntilTime: get().gameTime + clockMin } : {}),
        ...(sourceSpell ? { sourceSpell } : {}), sourceSpellId,
        ...(extras?.conjureForm ? { conjureForm: extras.conjureForm } : {}),
        onCorruption: followsCharacterRules(caster) ? (n, align) => gainCorruption(get, set, caster, n, align) : undefined, // #143 : personnage, pas un proxy `kind`
      }));
    }
  }

  // Péché et Colère Divine (LDB 40 l.44-45) : à CHAQUE Test de Prière, si le dé des
  // unités ≤ Points de Péché → Colère des dieux, MÊME si le Test est réussi (la
  // Maladresse, elle, a déjà déclenché la sienne ci-dessus).
  if (castInfoIsPrayer(spell) && !res.isFumble && res.roll > 0 && prayerWrathTriggered(res.roll, caster.sinPoints ?? 0)) {
    logLines.push(tr('cf.wrathTriggered', { units: res.roll % 10, name: caster.label, sin: String(caster.sinPoints) }));
    logLines.push(...applyMiscast(get, set, caster, 'colere'));
  }

  // Le sort focalisé est consommé après le lancement.
  if (focusedNI0) caster.focus = undefined;
  // Effet déclenché « après incantation résolue » (réussie ou non) — dispatcher générique via le bus.
  // Point d'émission = incantation résolue (LDB 46, post-runCastFlow). Inerte sans donnée. Hors combat :
  // battle absent, runCombatHooks('onCastResolved') est un no-op (aucune machinerie abonnée).
  emitCombatEvent('onCastResolved', { get, set, battle: battle!, self: caster, sink: (line) => logLines.push(line), triggerCtx: { victim: target, rng: battleRng() } });
  finishPlayerAction(get, set, logLines, 'cast'); // sortie commune combat (log+conso Action) / hors combat (journal)
  // Téléportation (Jalon 2.6) : le choix de case suit la clôture du cast (qui remet action: null).
  if (teleportReach && get().battle) {
    set({ battle: { ...get().battle!, action: 'teleport', reachable: teleportReach } });
    bus.emit(EVT.SCENE_DIRTY);
  }
}

/** Pose la ZONE PERSISTANTE d'un sort (op `zone` du Flow, on:'caster' — L11 Mur de feu : mur
 *  perpendiculaire à l'axe lanceur→cible centré sur la cible ; Grands feux : disque autour de la
 *  cible). Durée = celle du sort, surincantée à la SOURCE UNIQUE (`overcastDurationParts` : `base × mult
 *  + bonus`, LDB 47 l.15), formules résolues contre le LANCEUR. Effet IMPUR du Flow résolu ici
 *  (grille) ; hors combat : narratif. */
function placeSpellZone(
  get: Get,
  caster: Combatant,
  target: Combatant,
  spell: { id?: string; label: string; effects?: Flow; duration?: import('../engine/spellDuration').SpellDuration | null; target?: import('../engine/spellRange').SpellTarget | null },
  _spec: unknown,
  sl: number,
  durationMult: number,
  durationBonusRounds: number,
  logLines: string[],
): void {
  const pz = spellOps(spell.effects, 'caster').find((o): o is Extract<GameOp, { op: 'zone' }> => o.op === 'zone');
  if (!pz) return;
  const baseRounds = spell.duration?.kind === 'rounds' ? resolveFormula(spell.duration.value, caster, battleRng()) : 1;
  const rounds = baseRounds * durationMult + durationBonusRounds;
  // Rayon par défaut (si l'op n'a pas de `radiusMeters`) : dérivé de la `target` du sort (« Zone Diamètre
  // BFM m » → rayon BFM/2). Protection de Phâ : Zone centrée sur le lanceur (range self).
  placeZoneFromOp(get, caster, target, pz, spell.label, rounds, sl, (zdeDiameterMeters(spell.target, caster) ?? 4) / 2, logLines,
    spell.id ? { kind: 'spell', id: spell.id } : undefined);
}

/** Pose une ZONE persistante depuis un op `zone` (op-based, réutilisable HORS sort : effets déclenchés —
 *  zone laissée à la mort/touche…). `label`/`rounds`/`fallbackRadiusM` sont fournis par l'appelant (un
 *  sort les tire de sa durée/ZdE ; un trigger fournit des défauts). `target.pos` = centre du disque.
 *  `source` = l'ENTITÉ qui pose la zone (ids) : elle voyage SUR la zone, et le Test de TRAVERSÉE
 *  (`crossTest`) en dérive son enjeu — ce qui se joue est le sort qui barre le passage (#1262 V2 L6d). */
function placeZoneFromOp(get: Get, caster: Combatant, target: Combatant, pz: Extract<GameOp, { op: 'zone' }>, label: string, rounds: number, sl: number, fallbackRadiusM: number, logLines: string[], source?: EffectSource): void {
  const battle = get().battle;
  if (!battle || !target.pos || !caster.pos) { logLines.push(tr('cf.zonePersists', { spell: label })); return; }
  const discRadiusM = pz.radiusMeters != null ? Math.max(0, resolveFormula(pz.radiusMeters, caster, battleRng())) : fallbackRadiusM;
  // Cases BORNÉES à la carte au SITE D'ÉCRITURE (`clampZoneTiles`) : la géométrie de pose est non
  // bornée, une zone posée au coin déborderait en cases négatives stockées dans `battle.zones`.
  const rawTiles = clampZoneTiles(pz.shape === 'wall'
    ? wallTiles(caster.pos, target.pos, metersToTiles(resolveZoneMeters(pz.lengthMeters ?? 2, pz.lengthPerSL, caster, sl, battleRng())))
    : discTiles(target.pos, metersToTiles(discRadiusM)), get().scene?.dimensions);
  // z propagé sur chaque case (défaut 0, cf. zoneAreaTiles §782/#799) : une zone posée à l'étage `target.pos.z`
  // ne couvre pas les cases de même (x,y) à un autre étage (zoneCovers compare `t.z ?? 0` / `p.z ?? 0`).
  const tiles = target.pos.z ? rawTiles.map((t) => ({ ...t, z: target.pos!.z })) : rawTiles;
  const zone: BattleZone = {
    label, tiles, rounds, casterId: caster.id,
    ...(pz.blocksLoS ? { blocksLoS: true } : {}),
    ...(pz.onCross ? { onCross: pz.onCross } : {}),
    ...(pz.perRound ? { perRound: pz.perRound } : {}),
    ...(pz.crossTest ? { crossTest: pz.crossTest } : {}),
    ...(pz.barrier ? { barrier: {} } : {}),
    ...(pz.gate ? { gate: pz.gate } : {}),
    ...(pz.noCorruption ? { noCorruption: true } : {}),
    ...(source ? { source } : {}),
  };
  battle.zones = [...(battle.zones ?? []), zone];
  logLines.push(tr('cf.zonePersistsRounds', { spell: label, rounds }));
  bus.emit(EVT.ANIM_AOE, { tiles, kind: 'spell' });
}

/** Résout les ops IMPURES (grille/initiative) d'un déclencheur — GÉNÉRIQUE, pas limité à summon : un
 *  effet de DONNÉE déclenché (Trait/Talent/Atout) qui invoque (Charnier : 3d10 Zombies à la mort) ou
 *  pose une zone est résolu ICI, comme au lancement d'un sort. `summon`/`zone` sont inertes dans
 *  `applyOps` (moteur pur) ; on les moissonne (`triggerEffectOps`) et on les dispatche vers leur
 *  résolveur state (applySummon / placeZoneFromOp). Les autres impures (grantFreeAttack, interruptFocus,
 *  breakBlade) fonctionnent déjà dans leur propre contexte (frappe gratuite / réactions de combat). */
export function resolveTriggerImpureOps(get: Get, set: SetFn, actor: Combatant, trigger: EffectTrigger): string[] {
  const lines: string[] = [];
  for (const { op, source } of triggerEffectOps(actor, trigger)) {
    if (op.op === 'summon') lines.push(...applySummon(get, set, actor, op, { rng: battleRng() }));
    else if (op.op === 'scheduleRespawn') lines.push(...scheduleRespawnFromOp(get, set, actor, op));
    // La ZONE garde l'ENTITÉ qui l'a posée (le Trait/Talent porteur) : son `crossTest` en dérive son
    // enjeu, exactement comme une zone de sort (#1262 V2 L6d).
    else if (op.op === 'zone') placeZoneFromOp(get, actor, actor, op, actor.label, op.perRound ? 3 : 1, 0, 2, lines, source);
  }
  return lines;
}

/** RECONSTITUTION DIFFÉRÉE (op `scheduleRespawn`, Gardien éternel — Bestiaire de Middenheim) : à la mort du
 *  porteur, PROGRAMME (file `scheduledEffects`, horloge) la ré-invocation de la créature à `gameTime + d10
 *  jours`. Le délai `delayDays` est ROULÉ ici (`battleRng`, donc déterministe en test) ; `ref:'self'` se
 *  résout au porteur de fiche du défunt (`Combatant.porteurDeFiche`, #1882). Un INSTANTANÉ minimal du défunt (id/name/kind/pos)
 *  sert de lanceur à `applySummon` au déclenchement. Le `cancelFlag` (précautions) reste désamorçable par un
 *  Effet de scène. Sans position (hors grille) : pas de point de reconstitution → no-op. */
function scheduleRespawnFromOp(
  _get: Get, set: SetFn, actor: Combatant, op: Extract<GameOp, { op: 'scheduleRespawn' }>,
): string[] {
  if (!actor.pos) return [];
  // `ref:'self'` : la fiche du défunt, quel qu'en soit le porteur (Middenheim 04 p.115, LDB 76 l.11, #1882).
  const porteur = op.ref === 'self' ? actor.porteurDeFiche : { ref: op.ref };
  if (!porteur) throw new Error(`[scheduleRespawn] « ${actor.id} » n'a été spawné d'aucune fiche : \`ref:'self'\` ne peut le reconstituer (#1882)`);
  const days = resolveFormula(op.delayDays, actor, battleRng());
  const count = Math.max(1, resolveFormula(op.count ?? 1, actor, battleRng()));
  const respawn: ScheduledRespawn = {
    caster: { id: actor.id, label: actor.label, kind: actor.kind, pos: { ...actor.pos } },
    summon: { porteur, count, allyOfCaster: op.allyOfCaster },
  };
  set((s: GameState) => ({ scheduledEffects: [...s.scheduledEffects, { executeAt: s.gameTime + days * MINUTES_PER_DAY, cancelFlag: op.cancelFlag, respawn }] }));
  return [tr('cf.sourceRebuilds', { name: actor.label, days, s: days > 1 ? 's' : '' })];
}

/** Type de Souffle « correspondant le mieux » au Domaine du lanceur (sort Souffle, LDB 47 l.509 :
 *  « Le MJ détermine quel type d'attaque de Souffle correspond le mieux à votre Talent Magie des
 *  Arcanes ») — jeu sans MJ : seuls les Domaines au Type canonique évident sont mappés
 *  (Feu→Feu, Cieux→Électricité, Métal→Corrosif, Ombres→Fumée) ; les autres soufflent des Dégâts purs. */
function domainBreathType(caster: Combatant): string | undefined {
  return findDomainById(arcaneDomainIdOf(caster))?.breathType;
}

/** Bonus d'incantation CONDITIONNEL du Domaine (Aqshy l.157 : +`bonus` par État `perCondition` situé à
 *  `radiusStat` m du lanceur) — PARAMÈTRE en données (`DomainData.castBonus`) ; géométrie résolue ici. */
export function domainCastBonus(s: GameState, caster: Combatant, spell: { domainId?: string | null }): number {
  const cb = findDomainById(spell.domainId)?.castBonus;
  if (!cb || !caster.pos) return 0;
  const radius = Math.max(1, Math.ceil(bonus(effectiveChar(caster, cb.radiusStat)) / 2));
  let pions = 0;
  for (const c of s.battle?.combatants ?? []) {
    if (!c.pos || isOutOfAction(c)) continue;
    if (combatDistance(caster, c) <= radius) pions += stacks(c, cb.perCondition);
  }
  return cb.bonus * pions;
}

/** Le lanceur est-il « à proximité d'une Influence corruptrice » (LDB 46 l.89 / page 182) ? Data-driven :
 *  soit le lieu est marqué corrompu (flag de scène/campagne `corruption`, posé par un Effet setFlag de
 *  l'éditeur — décision D1), soit un combattant présent rayonne la Corruption (Trait `corruption`, réutilise
 *  `worstCorruptionExposure`), soit un combattant présent PORTE une malepierre (« Se trouver à proximité
 *  d'une malepierre », `data/trappings.json`, reconnue par sa DONNÉE via `malepierreItemOf` — jamais par
 *  id). Consommé par la Règle du 8 (`applyCast`). */
export function castNearCorruption(get: Get): boolean {
  if (get().flags['corruption']) return true;
  const battle = get().battle;
  if (battle && worstCorruptionExposure(battle)) return true;
  const combatants = battle ? battle.combatants : get().party;
  return combatants.some((c) => !!malepierreItemOf(c));
}

/** Aura anti-Sort qui frappe la CIBLE d'un Sort (`ActiveEffect.castWard`, posé par l'op du même nom —
 *  `LDB 43 l.139-145`), rendue en ligne NOMMÉE : le libellé et le renvoi Codex sont ceux de l'ENTITÉ
 *  qui a posé l'aura (« N'écoutez point la Sorcière »), la provenance ceux de son PORTEUR. Sorts
 *  seulement (les Prières passent par Prière, pas Langue). Une SEULE ligne même sous plusieurs auras
 *  (elles valent toutes −20) : la première rencontrée la nomme, dans l'ordre des combattants puis de
 *  leurs effets. Hors combat (pas de géométrie), l'aura ne s'applique pas — limitation documentée.
 *  Aujourd'hui MONO-SOURCE en donnée : `n-ecoutez-point-la-sorciere` est la seule entrée porteuse de
 *  l'op `castWard` ; la ligne nomme quand même son émetteur, une 2ᵉ entrée n'exigera aucun code. */
export function castWardLine(s: GameState, target: Combatant, spell: SpellLike): ModLine | null {
  if (castInfoIsPrayer(spell)) return null;
  if (!target.pos) return null;
  for (const w of s.battle?.combatants ?? []) {
    if (isOutOfAction(w) || !w.pos) continue;
    for (const e of w.activeEffects ?? []) {
      if (!e.castWard) continue;
      if (combatDistance(w, target) > porteeEnCases(e.castWard.radiusMeters, sceneMetresPerTile(s.scene))) continue;
      return { label: e.label, value: -20, famille: 'jet', ref: effectRef(e), by: [{ id: w.id }] };
    }
  }
  return null;
}
/**
 * Modificateurs de CONTEXTE d'un Test d'Incantation, NOMMÉS et chiffrés — SOURCE UNIQUE de la somme
 * que le jet applique et que l'aperçu annonce : l'aura anti-Sort sur la CIBLE (`castWardLine`,
 * LDB 43 l.139-145), l'attribut de Domaine (Aqshy, LDB 48 l.157) et le bonus d'ENVIRONNEMENT de
 * Domaine (Ghyran, LDB 48 l.690). Les Vents Tourbillonnants restent HORS de cette somme : leur
 * révélation (Seconde vue) décide de leur présence dans l'APERÇU, pas dans le jet.
 * `skipWard` : Zone non encore posée — aucune cible désignée, donc pas de protection individuelle.
 */
export function castContextMods(
  s: GameState, caster: Combatant, target: Combatant, spell: SpellLike & { domainId?: string | null },
  opts?: { skipWard?: boolean },
): { mods: ModLine[]; total: number; ward: number; domain: number; env: number } {
  const wardLine = opts?.skipWard ? null : castWardLine(s, target, spell);
  const ward = wardLine?.value ?? 0;
  const domain = domainCastBonus(s, caster, spell);
  const env = domainEnvironmentBonus(spell, s.scene?.environment);
  // La ligne de Domaine (attribut ET environnement) porte SON Domaine en référence : c'est lui, pas une
  // règle générique, qui décrit le bonus (Aqshy/Ghyran — LDB 48 l.157/690).
  const dref = spell.domainId ? { category: 'domains', id: spell.domainId } : undefined;
  const mods: ModLine[] = [
    ...(wardLine ? [wardLine] : []),
    ...(domain ? [{ label: 'Domaine', value: domain, famille: 'jet' as const, ref: dref }] : []),
    ...(env ? [{ label: 'Environnement', value: env, famille: 'jet' as const, ref: dref }] : []),
  ];
  return { mods, total: ward + domain + env, ward, domain, env };
}

/** Σ de `castWardLine` — la VALEUR que le jet applique (l'affichage et le jet lisent la même aura). */
export function castWardPenalty(s: GameState, target: Combatant, spell: SpellLike): number {
  return castWardLine(s, target, spell)?.value ?? 0;
}

/**
 * ENTRÉE DE RÈGLE d'un Test de Contraction (LDB 20) — DISCRIMINANT de bande, jamais un libellé :
 *  - `infection` : Infection Mineure d'après Blessure critique (LDB 20 l.90) ;
 *  - `contagion` : exposition à une créature/source infectée (LDB 20 l.25/l.51) ;
 *  - `chirurgie` : suites d'une opération (LDB 10 l.184, hors combat).
 * Deux entrées peuvent réclamer la MÊME maladie au MÊME personnage — d'où deux fenêtres, pas une.
 */
export type ContractionEntry = 'infection' | 'contagion' | 'chirurgie';

/** Un Test de Contraction de fin de combat DÛ pour un héros (LDB 18/20) : l'entrée de règle qui
 *  l'appelle, la maladie, sa difficulté de Résistance (les crans de l'exposition — Contagieux : 2 plus
 *  difficile — DÉJÀ appliqués) et le libellé d'exposition. `instant` (Contagieux, EDO App.2 l.230) :
 *  contractée → incubation « Instantanée ». Le `resistVal` (Résistance effective) est figé à la décision. */
interface CombatEndDiseaseTest { entry: ContractionEntry; disease: string; difficulty: Difficulty; label: string; instant?: boolean }

/** Valeur de Résistance d'un héros pour les Tests de Contraction (E + avances de Résistance) — figée à la
 *  décision pour rester stable entre la pose de l'étape et sa résolution. */
function combatEndResistVal(c: Combatant): number {
  return effectiveChar(c, 'endurance') + (c.skills?.find((s) => s.id === 'resistance')?.advances ?? 0);
}

/**
 * DÉCIDE et CONSOMME les Tests de fin de combat DUS pour le PERSONNAGE `c` (héros, ou combattant flagué
 * #143 `followsCharacterRules` — LDB 18 l.298/20 l.90/20 l.25/51 + LDB 19 Corruption) — SOURCE UNIQUE de
 * la décision : les marqueurs (`tookCriticalThisFight`/`woundDressed`/`diseaseExposure`) sont purgés ICI
 * (idempotent). Retourne la LISTE des Tests de Contraction de maladie dus + le NIVEAU d'exposition à la
 * Corruption (worst des créatures affrontées), ou `null` pour la Corruption si aucune. PUR de RNG (aucun
 * jet) : le jet vit dans l'étape de cascade (manuel) OU dans la résolution inline (non-interactif).
 */
function decideCombatEndHeroTests(
  c: Combatant, worstCorruption: import('../engine/corruption').ExposureLevel | null,
): { diseases: CombatEndDiseaseTest[]; corruption: import('../engine/corruption').ExposureLevel | null } {
  const dm = rule('disease-mode') as string;
  const diseases: CombatEndDiseaseTest[] = [];
  // Infection Mineure post-critique (LDB 20 l.90) : Résistance Très Facile (+60) — sauf blessure PANSÉE
  // (LDB 18 l.298). Règle « Utilisation des Maladies » : seul 'full' (RAW) applique l'Infection Mineure.
  if (c.tookCriticalThisFight) {
    const dressed = c.woundDressed;
    if (!c.dead && !dressed && dm === 'full' && contractionDue(c, 'infection-mineure'))
      diseases.push({ entry: 'infection', disease: 'infection-mineure', difficulty: 'tresFacile', label: 'Infection (Blessure critique)' });
  }
  c.tookCriticalThisFight = false; // consommé (idempotent)
  c.woundDressed = false;
  // Exposition aux Maladies (LDB 20 l.25/51 ; LDB 85 l.187/225) — SOURCE UNIQUE `diseaseExposure` (Infecté/
  // Rongeur/Maladie/munition/Contagieux exposent via l'op `exposeDisease`). Difficulté = celle de la
  // maladie (`def.contractDifficulty`), décalée des crans de l'exposition (Contagieux, EDO App.2
  // l.228-230 : « 2 niveaux plus difficile » → shift −2 ; « incubation “Instantanée” » → `instant`).
  // 'off' : aucune contraction.
  if (dm !== 'off' && !c.dead) {
    for (const exp of c.diseaseExposure ?? []) {
      const def = diseaseDefs()[exp.disease];
      if (def && contractionDue(c, def.id)) diseases.push({
        entry: 'contagion',
        disease: def.id,
        difficulty: easeDifficulty(def.contractDifficulty, exp.difficultyShift ?? 0),
        label: `Contagion (${diseaseLabel(def.id)})`,
        ...(exp.instant ? { instant: true } : {}),
      });
    }
  }
  c.diseaseExposure = undefined;
  return { diseases, corruption: c.dead ? null : worstCorruption };
}

/** Pire Degré d'EXPOSITION à la Corruption des créatures affrontées (LDB 85 l.87 → LDB 19) — `null`
 *  si aucune créature corrompue. Le niveau s'applique à TOUS les héros survivants (avoir affronté). */
function worstCorruptionExposure(battle: BattleState): { level: import('../engine/corruption').ExposureLevel; label: string } | null {
  const degrees = battle.combatants
    .filter((c) => c.kind !== 'hero')
    .flatMap((c) => (c.traits ?? []).filter((t) => t.id === 'corruption').map((t) => t.arg).filter(Boolean));
  if (!degrees.length) return null;
  const rank = { mineure: 0, modérée: 1, majeure: 2 } as Record<string, number>;
  const worst = degrees.reduce((a, b) => (rank[b!.toLowerCase()] > rank[a!.toLowerCase()] ? b : a))!;
  const level = worst.toLowerCase() === 'majeure' ? 'majeure' : worst.toLowerCase() === 'modérée' ? 'moderee' : 'mineure';
  return { level, label: worst };
}

/**
 * ROUTE une bande par PILOTE : les rangées des porteurs pilotés à la main rejoignent la cascade
 * INFLUENÇABLE (`steps`), les autres (cadence auto, siège absent, hors d'action) forment une bande
 * RÉSOLUE D'OFFICE — jamais silencieuse : son applier applique et journalise. Une étape que la
 * fabrique a REFUSÉ de bander suit le chemin d'origine (elle ne peut pas se dissoudre dans une
 * scission de rangées). Couture COMMUNE aux deux familles que la fin de combat consomme : ses propres
 * jets de bilan et la file d'entretien différée.
 */
function routeBandByPilot(
  get: Get, set: SetFn, band: BuiltCascadeStep, steps: BuiltCascadeStep[], manual: (id: string) => boolean,
): void {
  if (!band.participants) {
    const c = band.actorId ? actorIn(get(), band.actorId) : undefined;
    if (c && manual(c.id)) steps.push(band);
    else runCascadeImmediate(get, set, [band]);
    return;
  }
  const { kept, others } = splitBandRows(band, manual);
  if (kept) steps.push(kept);
  if (others) runCascadeImmediate(get, set, [others]); // conséquence appliquée + journalisée par l'applier
}

/**
 * CASCADE de fin de combat (LDB 18/19/20) — extrait les JETS de PERSONNAGE de fin de combat de
 * `finalizeBattle` pour les rendre cadence-aware AVANT l'écran de victoire.
 *
 * « Une situation = une fenêtre » (#1117 L4) : les Tests dus sont bâtis pour TOUS les PERSONNAGES
 * vivants (héros, ou combattant flagué #143 `followsCharacterRules` — PAS un proxy `kind`), puis
 * REGROUPÉS par ENTRÉE DE RÈGLE (`combatEndBands`) — une bande par (Infection post-critique | Contagion
 * d'une maladie), UNE bande pour l'Exposition à la Corruption (le Degré est GLOBAL : le pire des
 * créatures affrontées). Chaque bande est ensuite SCINDÉE par pilote (`routeBandByPilot`) : rangées
 * pilotées à la main dans la cascade influençable (Chance/Résilience offertes, conséquence à la
 * validation), les autres résolues d'office.
 *
 * Les marqueurs sont CONSOMMÉS ici (source unique). La cascade ouverte porte `combatEndBoundary:true` :
 * à sa fermeture, le store enchaîne sur `finishCombatEnd` (writeback + écran de victoire).
 */
export function openCombatEndCascade(get: Get, set: SetFn): void {
  const battle = get().battle;
  if (!battle) return;
  const corr = worstCorruptionExposure(battle);
  const steps: BuiltCascadeStep[] = [];
  const monos: BuiltCascadeStep[] = [];
  const inlineLines: string[] = [];
  // Amputations DIFFÉRÉES à la fin de la rencontre (LDB 18 l.171 : « Une fois la rencontre terminée… ») :
  // le nœud ARMÉ au critique (`Trauma.pendingAmputation`, enjeu posé) part par la PORTE canonique — porteur
  // SURFACÉ : étape influençable APPENDÉE à la cascade 'combat' de fin de combat (`startCascade` OU-e la
  // borne quand `openSequence` suit) ; sinon voie inline de la porte, dont le journal est drainé ici.
  for (const c of battle.combatants) {
    if (c.dead) continue;
    for (const a of prendreAmputationsDifferees(c)) routeTriggeredTest(get, set, c, c, a.flow, { label: a.label });
  }
  inlineLines.push(...drainPendingLog(get, set).map((e) => e.text));
  for (const c of battle.combatants) {
    if (!followsCharacterRules(c) || c.dead) continue; // #143 : RAW « Personnage » (LDB 18 l.5, LDB 20 l.14/206) — les créatures génériques et les défaits n'ont pas de jet de maladie/Corruption de fin de combat
    const decided = decideCombatEndHeroTests(c, corr?.level ?? null);
    const resVal = combatEndResistVal(c);
    for (const d of decided.diseases) {
      // L'id porte l'ENTRÉE DE RÈGLE en plus de la maladie : l'Infection post-critique et la Contagion
      // peuvent viser la MÊME maladie chez le MÊME personnage (LDB 20 l.90 vs l.25/l.51) — deux étapes de
      // même id étaient injoignables (la surface de rangée keye par id nu).
      const step = monoStep({
        id: `combatEndDisease-${c.id}-${d.entry}-${d.disease}`, kind: 'combatEndDisease', actor: c, icon: 'medical/infection',
        rollLabel: 'Résistance', difficulty: d.difficulty,
        ligne: { valeur: resVal, surLaCible: conditionModLines(c) },
        label: dataLabel(d.label), meta: { entry: d.entry, disease: d.disease, ...(d.instant ? { instant: true } : {}) },
        stake: combatStakeRef('combatEndDisease', { entryId: d.disease }),
        menace: 'maladie', // Test de Contraction = « résister à la Maladie » (Résistance (Menace), LDB 10)
      });
      pousseSi(monos, step);
    }
    if (decided.corruption && corr) {
      const res = testValue(c, 'resistance');
      const step = monoStep({
        id: `combatEndCorruption-${c.id}`, kind: 'combatEndCorruption', actor: c, icon: 'nav/mutation',
        rollLabel: 'Résistance', difficulty: 'intermediaire',
        ligne: { test: { skill: 'resistance' }, valeur: res, surLaCible: conditionModLines(c) },
        label: stepPrecision(tr('step.expoCorruption'), dataLabel(corr.label)), meta: { level: corr.level, exposureLabel: corr.label },
        // L'enjeu DIT le coût de l'échec, lu à l'applier : `corruptionGain(niveau, false, …)` est constant
        // par niveau (1/2/3) — la valeur interpolée vient donc du MÊME calcul que la conséquence.
        stake: combatStakeRef('combatEndCorruption', { values: { niveau: corr.label, gainEchec: corruptionGain(corr.level, false, 0) } }),
        menace: 'corruption', // Test d'Exposition = « résister à la Corruption » (Résistance (Menace), LDB 10)
      });
      pousseSi(monos, step);
    }
  }
  // Rangée qui rejoint la cascade influençable : porteur SURFACÉ (#1262 — le héros d'un autre siège en
  // est, c'est SON joueur qui roule) et pas hors d'action. `isOutOfAction` est le critère MÉTIER du
  // site : ici il fait tomber le Test dans la voie RÉSOLUE D'OFFICE (il est jeté), là où la fin de Round
  // le SAUTE tout court (`openRoundEndCascade`) — divergence MESURÉE (#1265).
  const manual = (id: string) => { const c = actorIn(get(), id); return !!c && surfaceOf(get, c.id) && !isOutOfAction(c); };
  if (inlineLines.length) get().log(inlineLines);
  for (const band of combatEndBands(monos)) routeBandByPilot(get, set, band, steps, manual);
  // Tests d'entretien du FRANCHISSEMENT DE JOUR mis en file pendant le combat (#253) : consommés ICI, à la
  // MÊME cadence-awareness que les jets de fin de combat — la file porte des BANDES (#1117 L3), scindées
  // par le MÊME routage. 3ᵉ des TROIS bâtisseurs à passer par la fabrique — une file écrite par un build
  // antérieur y redevient bande au lieu de s'appliquer en MONO.
  // La file est VIDÉE (jamais rejouée) ; `lastUpkeepDay` garde l'anti-double-résolution.
  const queued = get().deferredUpkeepQueue;
  if (queued.length) {
    set({ deferredUpkeepQueue: [] });
    for (const st of nightBands(queued)) routeBandByPilot(get, set, st, steps, manual);
  }
  // TOUTE la séquence est MINTÉE : les jets bâtis ici (`monoStep`, `combatEndBands`/`splitBandRows` →
  // `bandStep`) comme ceux venus de la file, qui est elle-même typée à la marque (#1262 V2) — la dernière
  // ouverture de combat par littéral passe donc par la porte.
  if (steps.length) openSequence(get, set, { title: 'Conséquences du combat', icon: 'condition/bleeding', purpose: 'combat', steps, combatEndBoundary: true });
  // La BORNE porte sur la cascade RÉELLEMENT ouverte : un Test d'amputation surfacé peut l'avoir ouverte
  // à lui seul (`startCascade` renonce sur `steps` vide). Sans elle, sa fermeture rappellerait
  // `openCombatEndCascade` et rejouerait l'Exposition à la Corruption, dont le Degré n'est pas un marqueur.
  const ouverte = get().pendingCascade;
  if (ouverte && ouverte.purpose === 'combat' && !ouverte.combatEndBoundary) set({ pendingCascade: { ...ouverte, combatEndBoundary: true } });
}

/**
 * Enregistre la conséquence d'un `kind` de fin de combat SOUS FORME DE BANDE (#1117 L4) : la boucle
 * PAR RANGÉE (verdict sur SA rangée, conséquence attribuée à SON porteur) est écrite ICI une fois pour
 * toutes — calque de `registerNightBandApplier`. Une étape sans rangées RENONCE (fail-closed) : plus
 * aucun jet de bilan de combat ne s'applique en MONO depuis L4.
 *
 * `consequences: []` : les lignes partent au journal PAR RANGÉE (`row.outcome` les rend dans la
 * fenêtre), jamais en bloc d'étape — deux porteurs ne partagent pas une issue.
 */
function registerCombatEndBandApplier(
  kind: string,
  rowFn: (get: Get, set: SetFn, band: CascadeStep, row: BatchParticipant, hero: Combatant, meta: CascadeStepMeta) => string[],
): void {
  registerCascadeApplier(kind, (get, set, step) => {
    if (!step.participants) return;
    for (const row of step.participants) {
      const hero = actorIn(get(), row.id);
      if (!hero || !row.result) { row.outcome = []; continue; }
      const lines = rowFn(get, set as SetFn, step, row, hero, combatEndRowMeta(step, row));
      row.outcome = resultLines(freeCons(lines));
      for (const l of lines) get().log(l);
    }
    set({ party: [...get().party] });
    if (get().battle) set({ battle: { ...get().battle!, combatants: [...get().battle!.combatants] } });
    return { consequences: [] };
  });
}

/** Conséquence d'une RANGÉE de bande `combatEndDisease` (LDB 18/20) : Test de Résistance RÉSOLU →
 *  échec = contracte la maladie (`applyContraction`). La maladie et l'incubation « Instantanée »
 *  (Contagieux) sont lues dans la charge de rangée, la bande portant l'entrée de règle commune. */
registerCombatEndBandApplier('combatEndDisease', (_get, _set, _band, row, hero, meta) => {
  const disease = typeof meta.disease === 'string' ? meta.disease : undefined;
  if (!disease) return [];
  const lines = applyContraction(hero, disease, row.result!.success, battleRng(), meta.instant === true ? { instant: true } : undefined);
  return lines.length ? lines : [tr('cf.resistsInfection', { name: hero.label })];
});

/** Conséquence d'une RANGÉE de bande `combatEndCorruption` (LDB 19) : Test de Résistance RÉSOLU →
 *  `corruptionGain` selon le Degré et le DR, puis `gainCorruption` (seuil/mutation via sa propre
 *  modale, mise en file quand le slot est déjà pris). */
registerCombatEndBandApplier('combatEndCorruption', (get, set, _band, row, hero, meta) => {
  const level = meta.level as import('../engine/corruption').ExposureLevel | undefined;
  const label = typeof meta.exposureLabel === 'string' ? meta.exposureLabel : '';
  if (!level) return [];
  const gain = corruptionGain(level, row.result!.success, Math.max(0, row.result!.sl));
  // Le verdict (roll/target) est déjà porté par la rangée de jet (RollLine ✓/✗ ±DR) — la conséquence ne
  // re-décrit QUE ce qui a été appliqué (#295 Lot 1, Décision 1b) : le gain RÉEL, ou une résistance nue.
  // Le DEGRÉ affronté est nommé des DEUX côtés (#1281, critère 2) : il l'était sur la seule réussite,
  // et l'échec ne laissait qu'un « +N Point(s) de Corruption » qui ne disait pas à quoi le porteur avait cédé.
  if (gain <= 0) return [tr('out.corruptExposureResist', { name: hero.label, label })];
  return [tr('out.corruptExposureFail', { name: hero.label, label }), ...gainCorruption(get, set, hero, gain)];
});

/** Ouvre une cascade INFLUENÇABLE à UNE bande de Contraction de maladie pour `patient` (Test de
 *  Résistance `difficulty` → `applyContraction` à la validation, via l'applier `combatEndDisease`) —
 *  HORS combat. Réutilisé par la Chirurgie (infection post-opératoire, LDB 10 l.184) : Chance/Résilience
 *  + auto-succès Résistance (Menace : Maladie) offerts, jamais un jet silencieux. `combatEndResistVal`
 *  fige la Résistance. Une bande d'UN porteur — la forme est celle de l'applier, pas celle du nombre. */
export function openContractionCascade(get: Get, set: SetFn, patient: Combatant, disease: string, difficulty: Difficulty, title: string): void {
  openBand(get, set, {
    id: `infection-${patient.id}-${disease}`, kind: 'combatEndDisease', icon: 'medical/infection',
    label: dataLabel(title), menace: 'maladie', meta: { entry: 'chirurgie', disease },
    stake: combatStakeRef('combatEndDisease', { entryId: disease }),
    difficulty,
    porteurs: [{ actor: patient, ligne: { valeur: combatEndResistVal(patient) }, label: 'Résistance', menace: 'maladie' }],
    title, purpose: 'test',
  });
}

/**
 * COUTURE UNIQUE « la mort ou l'indisponibilité libère la place » — le seul endroit qui
 * traduise « ce corps est hors d'action » en « sa chaise est rendue ». Appelée là où la mise hors de
 * combat est ACTÉE : `notifySlain` (tous les chemins de mort d'un combattant, garde d'unicité
 * `slainNotified`) et l'entretien hors combat de `advanceTime` (agonie, Hémorragie, Poison, Flammes —
 * la seule voie par laquelle un corps s'éteint sans combat).
 *
 * L'oracle de disponibilité est bâti ICI, où le groupe ET le combat sont lisibles : un héros du
 * groupe doit être vivant et debout (`isOutOfAction` couvre mort, Inconscient, Mort Subite) ; un PNJ
 * de scène ne devient indisponible qu'en tant que combattant enrôlé (hors combat, sa disparition
 * passe par `removeEntities`, qui renormalise déjà).
 * No-op complet — et référence de scène INCHANGÉE — si personne n'est assis ou si tout le monde tient.
 */
export function releaseSeatsOfDowned(get: Get, set: SetFn): void {
  const scene = get().scene;
  if (!scene?.seatAssignments) return;
  const party = get().party;
  const combattants = get().battle?.combatants;
  const next = releaseUnavailableSeats(scene, (o) => {
    if (o.kind === 'party') {
      const hero = party[o.rang - 1];
      return !!hero && !hero.dead && !isOutOfAction(hero);
    }
    const c = combattants?.find((x) => x.id === o.entityId);
    return !c || !isOutOfAction(c);
  });
  if (next !== scene) set({ scene: next });
}

/**
 * Un combat MET DEBOUT ceux qu'il enrôle : chaque corps devenu combattant quitte la place assise
 * qu'il tenait — le PNJ attablé comme un HÉROS, dont le combattant porte l'id du membre de `party` :
 * son EMPLACEMENT (rang) se déduit de `party`, puisqu'une place de groupe désigne un rang, pas un id
 * (les deux formes d'occupant se lèvent donc pour un même combattant, et il n'y a pas deux coutures).
 * PURE — rend la scène à écrire, que l'appelant fond dans SA propre écriture (l'ouverture de combat
 * en a déjà une), donc AVANT toute capture de mutation ; la SUPPRESSION des corps hors d'action
 * passe, elle, par `removeEntities`, qui renormalise à son tour.
 * Rend la scène d'entrée, même référence, si personne n'était assis.
 */
export function releaseSeatsOfCombatants<S extends Scene | null>(
  scene: S,
  combatants: readonly Pick<Combatant, 'id'>[],
  party: readonly Pick<Combatant, 'id'>[],
): S {
  if (!scene?.seatAssignments) return scene;
  let next: Scene = scene;
  for (const c of combatants) {
    next = releaseSeat(next, { kind: 'entity', entityId: c.id });
    const rang = party.findIndex((h) => h.id === c.id) + 1;
    if (rang) next = releaseSeat(next, { kind: 'party', rang });
  }
  return next as S;
}

/** Fin de combat : réécrit l'état persistant de chaque héros (Blessures, critiques, mort, États
 *  persistants) vers `party`. Idempotent ; les champs non persistants du membre party sont conservés.
 *  Les JETS HÉROS de fin de combat (maladie/Corruption) sont résolus AVANT (cascade `openCombatEndCascade`
 *  ou inline) — ici, on ne fait QUE le writeback (les marqueurs ont déjà été consommés). */
export function finalizeBattle(get: Get, set: SetFn): void {
  const { battle, party } = get();
  if (!battle) return;
  // Effets « fin de combat » authorés de chaque combattant survivant (inerte tant qu'aucune donnée ne
  // porte un effet `onCombatEnd`) → collectés dans le journal de fin de combat.
  const endLines: string[] = [];
  emitCombatEvent('onCombatEnd', {
    get, set, battle, sink: (line) => endLines.push(line),
    audience: battle.combatants.filter((c) => !isOutOfAction(c)),
    triggerCtx: { rng: battleRng() },
  });
  // `activeEffects` (échelle `rounds`) N'EST JAMAIS reporté hors combat (les Rounds ne tickent pas hors
  // combat) — sans purge ICI, un `grantedMutation`/`grantedTrait` encore actif (Allure démoniaque, EDOC 13
  // l.270-276) laisserait sa DONNÉE portée (`c.mutations`/`c.traits`, carriées par `carryOverState`) orpheline
  // et PERMANENTE (plus aucun porteur pour la détacher). Détachement propre AVANT writeback, comme une
  // expiration normale (`removeActiveEffects` : MÊME couture que `tickDurations`).
  for (const c of battle.combatants) removeActiveEffects(c, (e) => e.duration.scale === 'rounds');
  // `outOfRencontre` est l'état de LA rencontre (éjection par le Destin, reddition, homme à la mer) :
  // il tombe avec elle — `LDB 17 l.31` / `LDB 17 l.35`. Sans cette remise à zéro AU TEARDOWN, le
  // héros éjecté restait exclu de tout ce qui filtre le groupe hors combat (quorum des ready-checks,
  // nuit de repos, voyage) ET du carry-in du combat suivant (`startCombat`).
  const newParty = party.map((h) => {
    const c = battle.combatants.find((x) => x.id === h.id && x.kind === 'hero');
    return c ? { ...h, ...carryOverState(c), outOfRencontre: false, exitReason: undefined } : h;
  });
  set({ party: newParty });
  if (endLines.length) get().log(endLines);
  // #30/#296 — Blessures de COQUE persistantes : si une coque du combat EST le navire de campagne
  // (creatureId = vehicleId), son état de fin de combat est écrit sur `CampaignVessel.wounds` (SOURCE
  // UNIQUE) — le voyage maritime/fluvial en repart, et `resumeTravel` recharge la copie de travail
  // (`travelPlan.vehicle`) restée en mémoire depuis AVANT ce combat.
  const vessel = get().vessel;
  const hull = vessel ? battle.combatants.find((c) => c.creatureId === vessel.vehicleId) : undefined;
  if (vessel && hull) setVesselHull(get, set, hull.wounds.current, hull.wounds.max);
  // Réconciliation de la scène : tout combattant ISSU d'une entité de scène (identité unifiée,
  // Combatant.id === SceneEntity.id) et hors d'action quitte la scène. Victoire → les ennemis sont tous
  // hors d'action = retirés ; défaite → ennemis vivants = conservés ; les héros du groupe ne sont jamais
  // des entités de scène (jamais touchés). Hook futur : fuite hors-carte, morts persistants.
  const scene = get().scene;
  if (scene) {
    const entIds = new Set(scene.entities.map((e) => e.id));
    const fallen = battle.combatants.filter((c) => entIds.has(c.id) && isOutOfAction(c)).map((c) => c.id);
    if (fallen.length) removeEntities(get, set, fallen);
  }
  // Possession en pièce (bête montée/de bât, #618 SOCLE POSSESSIONS) — convention `Combatant.id ===
  // Possession.uid` (`pos-N`), kind-agnostique (bête/serviteur/véhicule/navire portent tous `wounds?`).
  // Morte → `destroyed:true` (items/cargo restent CO-LOCALISÉS sur la Possession, jamais évaporés —
  // même patron que la bête abandonnée en voyage, `travelFlow.ts` : `{ ...p, destroyed: true }`) ;
  // sinon blessée → `wounds.current` écrit, clampé à SON max (pas celui, potentiellement différent,
  // du combattant de pièce).
  const possessions = get().possessions;
  if (possessions.length) {
    let changed = false;
    const nextPossessions = possessions.map((p) => {
      const c = inBattleId(battle, p.uid);
      if (!c) return p;
      if (c.dead) { changed = true; return { ...p, destroyed: true }; }
      if ('wounds' in p && p.wounds) {
        const current = Math.max(0, Math.min(c.wounds.current, p.wounds.max));
        if (current !== p.wounds.current) { changed = true; return { ...p, wounds: { ...p.wounds, current } }; }
      }
      return p;
    });
    if (changed) set({ possessions: nextPossessions });
  }
}

/** L'OBJECTIF de victoire de la rencontre en cours est-il rempli ? (#197) Absent = `allEnemiesDead`
 *  (équivalent à `!enemiesAlive`, comportement historique inchangé). `enemiesAlive` est passé par
 *  l'appelant (déjà calculé par `checkBattleOver`, hors engins INERTES). PUR (aucune écriture). */
function victoryConditionMet(vc: VictoryCondition | undefined, battle: BattleState, scene: Scene | null, enemiesAlive: boolean): boolean {
  switch (vc?.type) {
    case undefined:
    case 'allEnemiesDead':
      return !enemiesAlive;
    case 'destroyStructure':
      return !!scene && structureIsDown(scene, vc.edge);
    case 'surviveRounds':
      return battle.round > vc.rounds;
    case 'reachZone': {
      const kind = (vc.camp ?? 'party') === 'party' ? 'hero' : 'enemy';
      return battle.combatants.some((c) => c.kind === kind && !c.inert && !isOutOfAction(c) && c.pos && inRect(c.pos, vc.rect));
    }
    case 'woundsThreshold': {
      const target = inBattleId(battle, vc.targetId);
      if (!target?.wounds || target.wounds.max <= 0) return false;
      return target.wounds.current / target.wounds.max < vc.belowPercent / 100;
    }
    case 'firstBlood':
      // Les DEUX fins du RAW restent actives en parallèle (NADJ 06 l.175-177) : premier sang — marqué
      // PAR-COUP par `resolveFirstBlood` (applyAttackResult, au moment où les Blessures d'UN coup sont
      // connues), sweep déclaratif ici — OU incapacité standard à 0 Blessure (`!enemiesAlive`, MÊME
      // prédicat que `allEnemiesDead`, déjà porté par `isOutOfAction`).
      return !enemiesAlive || battle.combatants.some((c) => c.exitReason === 'firstBlood');
  }
}

/** REDDITION (#215) — sweep de `checkBattleOver` pour un objectif `woundsThreshold` : dès que la
 *  cible passe SOUS le seuil, elle sort du combat (`outOfRencontre`, même mécanisme que la coque
 *  PRISE de `resolveShipUnits` — kind-agnostique, aucun 2e flag de sortie de combat) et le journal
 *  reçoit une ligne de reddition. Idempotent (`outOfRencontre` déjà posé → no-op) ; muet si la cible
 *  est déjà hors d'action (mort/coulée) — `isOutOfAction` couvre alors seule la fin de rencontre. */
function resolveSurrenderThreshold(battle: BattleState, vc: VictoryCondition | undefined): string[] {
  if (vc?.type !== 'woundsThreshold') return [];
  const target = inBattleId(battle, vc.targetId);
  if (!target?.wounds || target.wounds.max <= 0 || isOutOfAction(target)) return [];
  if (target.wounds.current / target.wounds.max >= vc.belowPercent / 100) return [];
  target.outOfRencontre = true;
  target.exitReason = 'reddition'; // #237 : pavillon amené, lu « rendu » (endState)
  return [tr('cf.surrender', { name: target.label })];
}

/** DUEL JUDICIAIRE — premier sang (#471, NADJ 06 l.175-177) : « le premier sang est la première
 *  attaque qui cause une perte de plus de [threshold] Blessures » — testé PAR-COUP (`lostThisHit` =
 *  la perte RÉELLE infligée par CE coup, pas un seuil cumulatif comme `woundsThreshold`) au point où
 *  `applyAttackResult` connaît les Blessures du coup. La cible TOUCHÉE est la partie vaincue : sortie
 *  par le MÊME mécanisme que la reddition (`outOfRencontre`/`exitReason`, #215), lue « hors-combat »
 *  (endState). No-op si la cible est déjà sortie/morte, ou hors `firstBlood`. */
function resolveFirstBlood(target: Combatant, vc: VictoryCondition | undefined, lostThisHit: number, sink: string[]): void {
  if (vc?.type !== 'firstBlood' || target.outOfRencontre || target.dead) return;
  const threshold = vc.threshold ?? 3;
  if (lostThisHit <= threshold) return;
  target.outOfRencontre = true;
  target.exitReason = 'firstBlood';
  sink.push(tr('cf.firstBlood', { name: target.label }));
}

export function checkBattleOver(get: Get, set: SetFn): boolean {
  const battle = get().battle;
  if (!battle || battle.over) return true;
  // Combat monté (AA 9 l.124) : une monture mise hors de combat désarçonne son cavalier (strict
  // RAW : à pied, pas de chute). Balayage centralisé ici car checkBattleOver suit chaque résolution de combat.
  const scene = get().scene;
  if (scene) {
    const dismounted = sweepDismountDeaths(battle, scene);
    if (dismounted.length) {
      set({ battle: { ...battle, log: [...battle.log, ...evLines(dismounted, 'detail')] } });
      bus.emit(EVT.SCENE_DIRTY);
    }
  }
  // Navires comme UNITÉS (MDG 13-14) : une coque COULÉE emporte son équipage par-dessus bord, une coque
  // sans équipage en état est PRISE et sort du combat — les deux voies de victoire navale (naufrage OU
  // abordage) convergent ici (kind-agnostique, sweep centralisé comme le désarçonnement ci-dessus).
  const navalResolved = resolveShipUnits(battle.combatants);
  if (navalResolved.length) {
    set({ battle: { ...battle, log: [...battle.log, ...evLines(navalResolved, 'detail')] } });
    bus.emit(EVT.SCENE_DIRTY);
  }
  // Reddition à seuil de dommage (#215) : une cible sous le seuil de son objectif `woundsThreshold`
  // sort du combat AVANT le calcul de victoire (même sweep que le naufrage/l'abordage ci-dessus).
  const surrendered = resolveSurrenderThreshold(battle, battle.victoryCondition);
  if (surrendered.length) {
    set({ battle: { ...battle, log: [...battle.log, ...evLines(surrendered, 'detail')] } });
    bus.emit(EVT.SCENE_DIRTY);
  }
  // NAUFRAGE du NAVIRE DE CAMPAGNE (MDG 13 l.674) : détecté AVANT le calcul victoire/défaite — si la coque
  // du groupe a coulé sous ses héros (équipage passé par-dessus bord vivant, `resolveShipUnits`), l'issue
  // n'est ni victoire ni défaite mais une SÉQUENCE de survie (Natation → échouage, `beginShipwreck`),
  // quelle que soit la situation côté ennemis (on peut couler ET avoir coulé l'adversaire).
  const vessel = get().vessel;
  const campaignHull = vessel ? battle.combatants.find((c) => c.creatureId === vessel.vehicleId && c.bodyShape === 'vehicule') : undefined;
  if (campaignHull && isOutOfAction(campaignHull)) {
    const aboardIds = (campaignHull.crewIds ?? [])
      .map((id) => inBattleId(battle, id))
      .filter((c): c is Combatant => !!c && c.kind === 'hero' && !c.dead)
      .map((c) => c.id);
    const anyOverboardAlive = aboardIds.some((id) => inBattleId(battle, id)?.exitReason === 'naufrage');
    if (aboardIds.length && anyOverboardAlive) {
      openCombatEndCascade(get, set); // maladie/Corruption de fin de combat inline (aucun héros interactif)
      finalizeBattle(get, set);       // writeback party (Blessures/États/morts) AVANT la nage
      set({ battle: null });
      beginShipwreck(get, set, { aboardIds });
      return true;
    }
  }
  // Un engin INERTE (affût servi, immune) ne compte JAMAIS comme un combattant vivant — ni côté allié
  // (`kind:'hero'`) ni côté ennemi : la victoire/défaite se joue sur les créatures (l'équipage), pas l'objet.
  // Une MONTURE-possession (`mountable:true`, kind:'hero' allié — #621) n'est jamais un héros pour la
  // défaite : un cavalier hors d'action dont la monture survit encore n'empêche PAS la défaite (LDB 14).
  const heroesAlive = battle.combatants.some((c) => c.kind === 'hero' && !c.mountable && !c.inert && !isOutOfAction(c));
  const enemiesAlive = battle.combatants.some((c) => c.kind === 'enemy' && !c.inert && !isOutOfAction(c));
  // Objectif de victoire authorable (#197) : par défaut `allEnemiesDead` (équivalent à `!enemiesAlive`,
  // comportement historique inchangé) — un autre type NE termine PAS le combat à la mort du dernier
  // ennemi tant que sa propre condition n'est pas remplie (ex. porte intacte, bélier-porte).
  if (victoryConditionMet(battle.victoryCondition, battle, scene, enemiesAlive)) {
    // Tests de fin de combat des héros survivants (maladie/Corruption) AVANT l'écran de victoire (décision
    // utilisateur) : cadence-aware (héros manuel → cascade influençable). Si une cascade s'ouvre, on DIFFÈRE
    // la victoire — sa fermeture (`combatEndBoundary`) enchaîne sur `finishCombatEnd`/`finishVictory`.
    // Slot occupé par une cascade de SETUP (Surprise, purpose 'combat') : on DIFFÈRE sans ouvrir plutôt
    // que d'y APPENDRE les Tests de fin (`startCascade` appende à même `purpose`, #942 L1) —
    // l'écran de victoire ne doit pas dépendre de la résolution d'une séquence de setup. À la clôture de
    // cette cascade 'combat', `dispatchCascadeDone` (combatSlice) RE-VÉRIFIE `checkBattleOver` — slot LIBRE
    // → il OUVRE alors la cascade de fin (#345). C'est ce re-check déterministe (PAS `resumeSuspendedAI`, qui
    // est un no-op pour la Surprise hors-tour) qui porte la continuation, sans dépendre d'un clic joueur.
    if (!get().pendingCascade) openCombatEndCascade(get, set);
    // On DIFFÈRE la victoire tant qu'une cascade est ouverte — la cascade de fin de combat
    // (`combatEndBoundary`, dont la fermeture enchaîne `finishCombatEnd`→`finishVictory`) MAIS aussi
    // toute cascade de SETUP non résolue (Surprise, purpose 'combat') : l'écran de victoire (HORS_MODAL)
    // ne doit jamais s'empiler sur une modale de cascade (doctrine suspension/reprise, cascade.ts). La
    // clôture d'une cascade 'combat' non-boundary passe par `dispatchCascadeDone`, qui re-vérifie
    // `checkBattleOver` (slot libre) puis reprend l'IA si le combat continue.
    if (get().pendingCascade) return true; // l'écran de victoire suit la cascade
    finishVictory(get, set);
    return true;
  }
  if (!heroesAlive) {
    // Défaite : tous les héros hors d'action → les Tests de fin de combat se résolvent inline (aucun héros
    // interactif → pas de cascade), puis writeback. Pas d'écran de victoire à gater.
    openCombatEndCascade(get, set);
    finalizeBattle(get, set);
    set({ battle: { ...get().battle!, over: 'defeat', log: [...battle.log, ev('info', tr('cf.defeat'))] } });
    return true;
  }
  return false;
}

/**
 * Finalisation de la VICTOIRE : writeback (`finalizeBattle`) PUIS pose de `over:'victory'` + capture des
 * récompenses dans `pendingVictory` (l'écran de victoire les lit). Appelée DIRECTEMENT par `checkBattleOver`
 * quand aucun Test de fin de combat n'est influençable, OU par `finishCombatEnd` à la fermeture de la
 * cascade de fin de combat. Idempotente vis-à-vis d'un `battle.over` déjà posé (garde en tête).
 */
export function finishVictory(get: Get, set: SetFn): void {
  const battle = get().battle;
  if (!battle || battle.over) return;
  finalizeBattle(get, set); // writeback AVANT onVictory (qui ajoute XP/butin au groupe)
  set({ battle: { ...get().battle!, over: 'victory', log: [...get().battle!.log, ev('info', tr('cf.victory'))] } });
  bus.emit(EVT.BATTLE_OVER, { victory: true }); // gong audio + hooks futurs
  // Capture des récompenses pour l'écran de victoire : on mesure ce que onVictory octroie (XP/or/butin)
  // par diff avant/après, + la liste des vaincus (groupée par nom). L'écran (VictoryScreen) lit `pendingVictory`.
  const xpBefore = get().party[0]?.xp ?? 0;
  const brassBefore = toBrass(partyMoneyTotal(get));
  // #9 : on sépare les effets onVictory. Récompenses/flags/journal s'appliquent MAINTENANT (pour peupler
  // l'écran) ; ceux qui CHANGENT le contexte (téléport/dialogue/combat) sont DIFFÉRÉS au clic « Continuer »
  // (dismissVictory) — sinon le téléport masque l'écran de victoire (cas de l'arène).
  const CONTEXT = new Set(['transition', 'transitionBack', 'startDialogue', 'startCombat']);
  // onVictory est un Flow (UN format avec triggers/dialogues) — on l'APLATIT ici (les `if` résolus contre
  // l'état courant) pour garder la partition CONTEXT/immédiat + la mesure de récompense sur la séquence plate.
  const all = battle.onVictory ? flattenFlow(battle.onVictory, condCtx(get)) : [];
  const deferred = all.filter((e) => CONTEXT.has(e.type));
  // L'ÉQUIPEMENT (giveTrapping sans heroId) devient du butin ATTRIBUABLE sur l'écran (qualités
  // conservées) au lieu d'aller d'office au 1er héros — même brique que la fenêtre de loot
  // (gearFromEffects). Un giveTrapping ciblé (heroId d'auteur) s'applique directement.
  const { gear, rest: immediate } = gearFromEffects(all.filter((e) => !CONTEXT.has(e.type)));
  const messages = immediate.filter((e) => e.type === 'journal').map((e) => (e as { desc: string }).desc);
  const issue = immediate.length ? applyEffects(get, set, immediate) : undefined;
  const counts = new Map<string, { label: string; count: number; creatureId?: string }>();
  for (const c of battle.combatants) if (c.kind === 'enemy') {
    const key = c.creatureId ?? c.label; // regroupe par identité bestiaire (id), repli nom (statbloc custom)
    const e = counts.get(key);
    if (e) e.count++; else counts.set(key, { label: c.label, count: 1, creatureId: c.creatureId });
  }
  // L'écran de victoire est la CLÔTURE de ce verbe (#1508) : un Effet `onVictory` qui ouvre un dé à la
  // porte le ferait s'afficher DEVANT sa conséquence, et ses deltas de PX/bourse se liraient sur l'état
  // d'AVANT le dé. D'où les deux bornes de départ, relues à la pose de l'écran.
  cloturer(get, set, issue, [{
    verbe: 'ouvrirEcranDeVictoire',
    xpAvant: xpBefore,
    laitonAvant: brassBefore,
    ecran: {
      gear: gear.length ? gear : undefined,
      defeated: [...counts.values()].map(({ label, count, creatureId }) => ({ label, count, creatureId })),
      messages: messages.length ? messages : undefined,
      onContinue: deferred.length ? deferred : undefined,
    },
  }]);
}
registerCloture('ouvrirEcranDeVictoire', (get, set, c) => {
  set({
    pendingVictory: {
      ...c.ecran,
      xp: Math.max(0, (get().party[0]?.xp ?? 0) - c.xpAvant),
      gold: fromBrass(Math.max(0, toBrass(partyMoneyTotal(get)) - c.laitonAvant)),
    },
  });
});

/** Continuation à la FERMETURE de la cascade de fin de combat (`combatEndBoundary`) : l'écran de victoire
 *  suit les Tests de fin de combat influencés. Re-dérive l'issue depuis l'état COURANT (une damnation par
 *  mutation a pu tuer un héros) : ennemis tous hors d'action → victoire ; sinon (héros tombé) → défaite. */
export function finishCombatEnd(get: Get, set: SetFn): void {
  const battle = get().battle;
  if (!battle || battle.over) return;
  if (get().combatCursor) set({ combatCursor: null }); // fin de combat : plus de navigation au curseur
  const heroesAlive = battle.combatants.some((c) => c.kind === 'hero' && !isOutOfAction(c));
  if (heroesAlive) { finishVictory(get, set); return; }
  // Cas-limite : la mutation/damnation a achevé le dernier héros pendant la cascade → défaite.
  finalizeBattle(get, set);
  set({ battle: { ...get().battle!, over: 'defeat', log: [...get().battle!.log, ev('info', tr('cf.defeat'))] } });
}

/** Gantelet verrouillé (AA folio 94) — anti-lâcher GÉNÉRIQUE (capacité lue en DONNÉE `preventForcedDrop`,
 *  jamais par le nom de l'objet). Renvoie true si le porteur GARDE l'arme `drop` (la 1re fois dans la période
 *  de « 1 Round minimum » — il subit alors −20 pendant 1 Round, journalisé par l'appelant) ; false s'il doit
 *  la LÂCHER (aucun gantelet, ou SECOND évènement de lâcher pendant la période). Pose/réarme le marqueur
 *  transitoire `drop.gauntletSavedRound`. */
function lockedGauntletHolds(wielder: Combatant, drop: Weapon, round: number): boolean {
  const hasGauntlet = hasCapability(wielder, 'preventForcedDrop'); // capacité agrégée (gantelet PORTÉ/TENU)
  if (!hasGauntlet) return false;
  const saved = drop.gauntletSavedRound;
  if (saved != null && round <= saved + 1) { drop.gauntletSavedRound = undefined; return false; } // 2e évènement dans la période → lâche
  drop.gauntletSavedRound = round; // 1re sauvegarde (ou période écoulée → réarmement) : garde l'arme, −20/1 Round
  return true;
}

/**
 * Conséquence PROCÉDURALE d'un Test opposé de Piège-lame GAGNÉ par le défenseur (op `breakBlade`, hook
 * `bladeTrap`) : l'adversaire est désarmé de la lame visée (`bt.weaponUid`), arrachée de ses mains. Marge
 * NETTE `(DR final du défenseur + bt.defSL) − bt.attackerSL` ≥ 6 (Succès Stupéfiant, LDB 62 l.280) → la lame
 * est BRISÉE à moins qu'elle ne possède l'Atout Incassable (sauvegarde Solide gérée par `wearActiveWeapon`).
 * Échec/égalité au Test ⇒ branche `fail` (pas d'op, l'adversaire libère sa lame) → cette fonction n'est pas
 * appelée. La conséquence est EMPILÉE comme étape d'AFFICHAGE propre dans la cascade (`pushDisplay` →
 * `bladeTrapResult`, applier muet) — MÊME paradigme que le Coup Critique (une étape visible « l'un sous
 * l'autre », acquittée par « Continuer/Terminer ») plutôt qu'une ligne noyée. `defenderSL` = le DR PROPRE du
 * jet résolu (la marge nette se recompose avec `bt`). */
export function applyBladeTrap(get: Get, set: SetFn, defender: Combatant, bt: BladeTrapFreeze, defenderSL: number): void {
  const battle = get().battle;
  if (!battle) return;
  const attacker = inBattleId(battle, bt.attackerId);
  if (!attacker || isOutOfAction(attacker)) return;
  const drop = attacker.weapons.find((w) => w.uid === bt.weaponUid);
  if (!drop) return;
  const netSL = defenderSL + bt.defSL - bt.attackerSL; // marge nette du défenseur vainqueur (LDB 62 l.280)
  let line: string;
  if (netSL >= 6) {
    // Succès Stupéfiant : la lame est BRISÉE, à moins qu'elle ne possède l'Atout Incassable (l.280).
    wearActiveWeapon(attacker, drop, true);
    line = drop.destroyed
      ? tr('cf.bladeBroken', { name: attacker.label, weapon: drop.label })
      : tr('cf.bladeResists', { weapon: drop.label, name: attacker.label });
  } else {
    line = tr('cf.weaponDropped', { name: attacker.label, weapon: drop.label });
  }
  // Gantelet verrouillé (AA folio 94) : anti-lâcher — la lame DÉTRUITE échappe à cette grâce (un gantelet
  // ne sauve pas une arme brisée). Sinon, la 1re fois dans la période le porteur GARDE l'arme (−20/1 Round) ;
  // le 2e évènement de lâcher la fait tomber. Capacité lue en DONNÉE (`preventForcedDrop`), jamais par nom.
  if (!drop.destroyed && lockedGauntletHolds(attacker, drop, battle.round)) {
    pushDisplay(set, { id: idDansLaSequence(get, `cons-bladetrap-result-${defender.id}`, 'combat'), kind: 'bladeTrapResult', actorId: defender.id, icon: 'action/defend', label: tr('cf.bladeTrapLabel'), outcome: toRecapLines([tr('cf.lockedGauntletHold', { name: attacker.label, weapon: drop.label })]) });
    bus.emit(EVT.SCENE_DIRTY);
    checkBattleOver(get, set);
    return;
  }
  attacker.weapons = attacker.weapons.filter((w) => w !== drop);
  // Étape d'AFFICHAGE empilée (comme un Coup Critique) : visible « l'un sous l'autre », acquittée par le
  // joueur. `actorId` = le défenseur piégeur (propriétaire de la modale en coop). Applier muet (préserve `outcome`).
  pushDisplay(set, { id: idDansLaSequence(get, `cons-bladetrap-result-${defender.id}`, 'combat'), kind: 'bladeTrapResult', actorId: defender.id, icon: 'item/weapon', label: tr('cf.bladeTrapLabel'), outcome: toRecapLines([line]) });
  bus.emit(EVT.SCENE_DIRTY);
  checkBattleOver(get, set);
}

/** Applier MUET de l'étape d'AFFICHAGE de la conséquence Piège-lame : l'`outcome` (« lame brisée/arrachée »)
 *  est pré-posé sur l'étape (la mutation a déjà eu lieu dans `applyBladeTrap`) → rien à appliquer ici, seul
 *  l'affichage empilé reste (mirroir d'une révélation de Critique en étape de séquence). */
registerCascadeApplier('bladeTrapResult', () => {});

/** Applier de l'étape de CHOIX « piège-lame » (LDB 62 l.278-280). « Coup Critique » (défaut) inflige le
 *  critique normal sur sa défense (LDB 14 l.3). « Piéger » route un Test opposé de Force CADENCE-AWARE
 *  (le héros défenseur PEUT dépenser Chance/Résilience) via `runCombatFlow` : le défenseur jette, l'attaquant
 *  (porteur) oppose sa Force, en ajoutant le DR de la défense (`defSL`) au jet du défenseur (l.295) ; la
 *  branche de VICTOIRE porte l'op IMPURE `breakBlade` (désarme/brise, conséquence procédurale APRÈS le Test). */
registerCascadeApplier('bladeTrap', (get, set, step) => {
  const pbt = step.bladeTrap;
  if (!pbt) return;
  const battle = get().battle;
  const defender = inBattleId(battle, pbt.defenderId);
  const attacker = inBattleId(battle, pbt.attackerId);
  if (!defender || !attacker) return;
  if (step.chosen !== 'trap') {
    // Coup Critique normal sur la défense (le défenseur place le Critique sur l'attaquant).
    const parryWeaponObj = defender.weapons.find((w) => w.uid === pbt.parryWeaponUid);
    const parryWeaponName = parryWeaponObj?.label ?? 'arme';
    const lines = [tr('cf.critOnDefense', { name: defender.label })];
    applyOpposedCritical(get, set, attacker, pbt.roll, { attackerId: defender.id, weapon: parryWeaponName, weaponObj: parryWeaponObj }, lines);
    const b = get().battle!;
    set({ battle: { ...b, log: [...b.log, ...evLines(lines, 'info', defender.id, attacker.id)] } });
    bus.emit(EVT.SCENE_DIRTY);
    checkBattleOver(get, set);
    return;
  }
  if (isOutOfAction(attacker)) return;
  // Test opposé de Force CADENCE-AWARE : la branche success porte `breakBlade` (désarme/brise). Le bonus de DR
  // de la défense (`defSL`, l.295) s'ajoute au jet du défenseur via `opposed.bonusSL` (modifie vainqueur ET
  // marge nette) ; le contexte `bladeTrap` cible la lame de l'attaquant. `resolveFlowTest` complète le freeze
  // avec le DR de l'attaquant qu'IL jette (`attackerSL`) → la conséquence recompose la marge nette, sans
  // double-jet. `runCombatFlow` route le Test (héros manuel → cascade influençable ; ennemi/auto → inline).
  const bt: BladeTrapFreeze = { attackerId: attacker.id, weaponUid: pbt.weapon.uid!, defSL: pbt.defSL, attackerSL: 0 };
  const flow = testFlow(
    // `defenderMustWin` : ici « vous » (LDB 62 l.280 « Si vous l'emportez ») est le PIÉGEUR, qui est le
    // jeteur de ce Test — la lame ne s'arrache qu'à SA victoire, jamais sur une égalité.
    { characteristic: 'force', label: 'Piège-lame', stake: combatStakeRef('bladeTrapForce'), opposed: { attacker: 'force', bonusSL: pbt.defSL, defenderMustWin: true } },
    { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'breakBlade' }] } },
    EMPTY_FLOW,
  );
  runCombatFlow({ mode: 'combat', get, set, target: defender, caster: attacker, label: 'Piège-lame', bladeTrap: bt }, flow);
});

/** Fin du TÉLÉGRAPHE d'intention (`actorAim`) — le télégraphe appartient au GESTE : posé quand l'IA
 *  déclare son action, effacé au SEAM où naît la ligne de journal de ce geste (`applyAttackResult`,
 *  entonnoir UNIQUE de résolution d'attaque — c'est cette ligne que le bandeau prend ensuite,
 *  `ui/CombatBanner.tsx`) ou à son AVORTEMENT, quel que soit le chemin. Tant qu'une fenêtre de
 *  défense/d'incantation suspend le tour sans rien résoudre, il TIENT (#1143). Idempotent. */
function clearActorAim(get: Get, set: SetFn): void {
  if (get().actorAim) set({ actorAim: null });
}

/** Reprend le tour de l'IA suspendu par la modale de défense (= ce qu'aurait fait
 *  attackThenAdvance juste après doAttack). No-op si le combat est terminé. */
export function resumeEnemyTurn(get: Get, set: SetFn): void {
  clearActorAim(get, set); // reprise d'un tour qu'aucune attaque n'a résolu (incantation témoin, manœuvre) : le geste est fini
  if (combatAdvanceBlocked(get())) return;
  scheduleCombatTimer(() => advanceTurn(get, set), beatHold(get, 'enemyAdvance'));
}

/** Reprend un tour d'IA SUSPENDU par la séquence de conséquences de combat (jets, révélations) une
 *  fois qu'elle est CLOSE — appelée par la fin de cette séquence (`cascadeNext`/`cascadeFinish` →
 *  `dispatchCascadeDone`), seule couture depuis #942 L8. Garde alignée sur celle de `resumeEnemyTurn`. */
export function resumeSuspendedAI(get: Get, set: SetFn): void {
  const s = get();
  // `resumeSuspendedAI` ne surveillait historiquement PAS `pendingCast` → `{ cast: false }` (iso A1).
  if (combatAdvanceBlocked(s, { cast: false })) return;
  const battle = s.battle!;
  const active = activeCombatant(battle);
  if (!active || !aiDriven(s, active)) return;
  // L'acteur IA actif est MORT pendant la conséquence suspendue (ex. critique défensif du héros — un
  // démembrement — qui tue le chargeur PENDANT sa propre attaque) → son tour est terminé : AVANCER au
  // combattant suivant. Sans ça, `resumeEnemyTurn` ne serait jamais armé et la main ne reviendrait jamais
  // au héros (soft-lock observé). `advanceTurn` saute de lui-même les hors-combat.
  if (isOutOfAction(active)) { advanceTurn(get, set); return; }
  // Acteur IA ayant déjà agi (conséquence d'attaque) → fin de tour ; sinon début de tour (entretien) → IA.
  if (battle.acted) { resumeEnemyTurn(get, set); return; }
  // Tour suspendu AVANT d'avoir consommé son Action (entretien, Peur au contact) : il n'a RIEN joué,
  // le jeton de tour lui est RENDU (#1852). Le jeton dit « ce tour a déjà été joué » ; le laisser posé
  // sur un tour qui n'a rien décidé ferait refuser toute relance du même `round:turn:id` — le tour
  // gèlerait au lieu de reprendre.
  if (battle.aiTurnPlayed === cleDeTour(battle, active.id)) battle.aiTurnPlayed = undefined;
  maybeRunEnemyTurn(get, set);
}

export function advanceTurn(get: Get, set: SetFn) {
  // Pause de début de Round (PERSONNE n'est actif, turn -1) : un advanceTurn retardataire (timer
  // d'IA en vol) ne doit pas ré-incrémenter le tour SOUS la pause — confirmRoundStart le posera.
  if (get().pendingRoundStart) return;
  if (combatAdvanceBlocked(get())) return;
  if (get().combatCursor) set({ combatCursor: null }); // le curseur clavier/manette appartient au tour qui s'achève
  if (get().localIntent) set({ localIntent: null }); // l'intention armée appartient au tour qui s'achève
  clearActorAim(get, set); // le télégraphe appartient au geste du tour qui s'achève (filet : aucun chemin ne le laisse fuir)
  const battle = get().battle!; // non-null garanti par combatAdvanceBlocked ci-dessus
  // La Charge ne vaut que pour le tour où elle a lieu (Cornes LDB 85, Épuisante LDB 62 l.319) :
  // consommée au passage au combattant suivant (filet de sécurité, l'IA la consomme aussi en chemin).
  const prevActive = inBattleId(battle, battle.order[battle.turn]);
  // Seconde porte d'irrévocabilité du déplacement (la première étant l'Action prise, `markActed`) :
  // passer la main fige ce qui a été parcouru → les approches en attente sont dues (LDB 21 l.27).
  sealApproachMoves(get, set, prevActive);
  if (prevActive?.chargedThisTurn) prevActive.chargedThisTurn = false;
  if (prevActive?.freeAttacksThisTurn) prevActive.freeAttacksThisTurn = undefined; // Attaques gratuites de manœuvre : 1/tour (compteur remis à zéro)
  fireTurnEndTriggers(get, set, prevActive); // effets de bord « fin de tour » authorés (inerte sans donnée)

  let turn = battle.turn;
  for (let i = 0; i < battle.order.length; i++) {
    turn += 1;
    if (turn >= battle.order.length) {
      // Franchissement de Round : upkeep (dégâts périodiques + 0 PB→Inconscient), puis la résolution
      // (morts lentes avec sauvetage par Destin) est déléguée à resolveRoundBoundary — résumable,
      // car elle peut suspendre (pendingFateSave / pendingRoundStart).
      const round = battle.round + 1;
      get().advanceTime(TIME_COST.combatRound); // « tout est horodaté » : 1 Round franchi = +combatRound min
      battle.log.push(ev('round', tr('cf.roundHeader', { round })));
      // Ordre du Round : on REPART de l'ordre canonique (baseOrder) — donc tout réordonnancement
      // (Maladresse « agir en dernier » Oups! 21-40, pré-emption Chance) ne dure qu'UN Round (l.22-25).
      // Règle optionnelle « Relancer l'Initiative chaque Round » (LDB 13 l.43, « effectuer un lancer pour
      // chaque Round ») : on re-tire la VALEUR d'Initiative de chaque combattant via `rollInitiative` (même
      // méthode `combat-init-method` qu'à l'ouverture) puis on recalcule l'ordre — ce nouvel ordre devient
      // la base canonique de CE Round. OFF (défaut) : `baseOrder` est conservé (comportement inchangé).
      let base = battle.baseOrder ?? battle.order;
      if (rule('combat-init-reroll')) {
        for (const c of battle.combatants) c.initiative = rollInitiative(c, battleRng());
        base = combatOrder(battle.combatants, isMerScene(get().scene), battleRng());
        battle.baseOrder = base;
      }
      // Agir en dernier : Maladresse (Oups! 21-40, 1 Round) OU arme Lente active (LDB 62 l.331, permanent).
      const lastIds = battle.combatants.filter((c) => c.actLastNextRound || strikesLast(c.weapons)).map((c) => c.id);
      battle.order = [...base.filter((id) => !lastIds.includes(id)), ...base.filter((id) => lastIds.includes(id))];
      for (const c of battle.combatants) if (c.actLastNextRound) { c.actLastNextRound = false; battle.log.push(ev('detail', tr('cf.actLast', { name: c.label }), c.id)); }
      // Entretien de Round PARTITIONNÉ (spec coop §4bis) : TOUT va au journal de combat (bandeau) ;
      // seules les lignes CONCERNANT UN HÉROS alimentent la révélation (les ennemis : journal seul).
      const heroRoundLines: string[] = [];
      const tickLine = (line: string, c?: Combatant) => {
        battle.log.push(ev('condition', line, c?.id));
        if (c?.kind === 'hero') heroRoundLines.push(line);
      };
      // TOUTE la séquence de franchissement de Round est déléguée aux hooks `roundBoundary`
      // (state/combat/roundHooks), ordonnés par `order` : end-of-round 10 → poison-resist 15 →
      // refresh-wounds 20 → triggers 25 → Instable 30 → Bestial 40 → Perturbant 50 → Surnombre 55 →
      // Détermination 70/72 → broken-recovery 74 → tail 76-79.5 → règles optionnelles (se-fatiguer 80).
      // (Mâchoires d'acier n'est plus un hook de Round : c'est un effet `onGainCondition` data-driven.)
      // advanceTurn orchestre seulement le CADRE (Round, ordre, révélation) ; le CONTENU vit en hooks.
      // (Frénésie : l'Arme libre est un grant de DONNÉE plafonné par freeAttacksThisTurn, remis à zéro au tour.)
      // Unique porte (#316) : le site MÉTIER émet via le bus ; les boucles internes `fireTriggers`
      // (roundHooks, bus-owned) restent la machinerie du bus. Sans `audience`/`self` → diffusion data
      // vide ici : STRICTEMENT équivalent à l'ancien `runCombatHooks('onRoundEnd', …)`.
      emitCombatEvent('onRoundEnd', { get, set, battle, sink: tickLine });
      if (heroRoundLines.length) pushReveal(set, { kind: 'round', title: tr('cf.roundEndTitle', { n: round - 1 }), lines: heroRoundLines, severity: 'minor' }); // (entretien HÉROS — fermé au clic, #1270)
      // Maniement de deux armes : le −10 défensif expire au DÉBUT du prochain Tour de son porteur. Si ce
      // porteur est order[0] (il rejoue en premier), c'est ICI (le franchissement de Round) que son Tour démarre.
      const firstNext = inBattleId(battle, battle.order[0]);
      if (firstNext) firstNext.dualStrikeDefensePenalty = false;
      set({ battle: { ...battle, turn: 0, round } });
      resolveRoundBoundary(get, set);
      return;
    }
    const next = inBattleId(battle, battle.order[turn]);
    if (next && !isOutOfAction(next)) break;
  }
  // Tour suivant dans le MÊME Round. La posture « Sur la défensive » expire (LDB Combat l.118).
  const newActive = inBattleId(battle, battle.order[turn]);
  let movementUsed = 0;
  let acted = false;
  if (newActive) {
    newActive.defensiveStance = false;
    newActive.dualStrikeDefensePenalty = false; // Maniement de deux armes : expire au début de son Tour (LDB 10 l.767-773)
    // Maladresse (Oups! 61-80) : perte du Mouvement / de l'Action ce tour-ci.
    if (newActive.loseNextMovement) { movementUsed = mountMovement(battle, newActive); newActive.loseNextMovement = false; battle.log.push(ev('detail', tr('cf.loseMovement', { name: newActive.label }), newActive.id)); }
    if (newActive.loseNextAction) { acted = true; newActive.loseNextAction = false; battle.log.push(ev('detail', tr('cf.loseAction', { name: newActive.label }), newActive.id)); }
    fireTurnStartTriggers(get, set, newActive); // effets de bord « début de tour » authorés (inerte sans donnée)
    // Gate d'action par Round (op `actGate` — Racine de mandragore, LDB 71 l.35) : héros manuel → étape
    // de cascade influençable (issue appliquée sur la battle par l'applier) ; IA/auto → jet inline FOLDÉ
    // ici dans le budget du tour (l'Action est gardée, le Mouvement est perdu sur un échec).
    const gate = resolveActGates(get, set, newActive);
    for (const line of gate.lines) battle.log.push(ev('detail', line, newActive.id));
    if (gate.loseMovement && movementUsed === 0) movementUsed = mountMovement(battle, newActive);
  }
  set({ battle: { ...battle, turn, action: null, movementUsed, movedPreAction: false, acted, loadoutSwapped: false, stances: {}, reachable: new Map(), preview: null, runBudget: null, fearGate: null } });
  if (checkBattleOver(get, set)) return;
  bus.emit(EVT.SCENE_DIRTY);
  // La Psychologie ne se teste PLUS par tour (LDB 21 : Traits ciblés/Terreur au DÉBUT du Round l.14,
  // Peur à la FIN de chaque Round l.27) → cascades de Round (openRoundStartPsych/openRoundEndCascade).
  maybeRunEnemyTurn(get, set);
}

/**
 * Fin de Round, RÉSUMABLE : (1) résout les morts lentes une par une — pour un héros à Destin,
 * suspend (pendingFateSave 'slow') ; (2) finalise les morts restantes ; (3) décrément d'Avantage
 * + Engagement (une seule fois, après toutes les morts) ; (4) pré-emption d'initiative (Chance,
 * 3e usage) sinon sélection de l'acteur + IA. Rappelée par fate* après résolution d'une mort lente.
 */
export function resolveRoundBoundary(get: Get, set: SetFn): void {
  const battle = get().battle;
  if (!battle || battle.over) return;
  // (1) Un héros mourant à Destin non résolu → suspend (LDB 17 l.31-35).
  const dying = battle.combatants.find((c) => c.kind === 'hero' && (c.fate ?? 0) > 0 && inDeathCondition(c));
  if (dying) {
    set({ pendingFateSave: { heroId: dying.id, source: 'slow' } });
    return;
  }
  // (2) Finaliser les morts lentes restantes (héros sans Destin) — + effet « à la mort » (onSlain) éventuel.
  for (const c of battle.combatants) if (inDeathCondition(c)) { c.dead = true; for (const line of notifySlain(get, set, c)) battle.log.push(ev('death', line, c.id)); }
  // (2bis) Mort par Hémorragique (LDB 16 l.105) — combattants `bleedDoomed` (jet RNG du hook `bleed-death`).
  //        Un héros à Destin → SUSPEND (pendingFateSave 'slow', re-entre ici après résolution ; le sauvé est
  //        éjecté → filtré) ; sinon mort finalisée (annonce différée + onSlain). Une fois tous résolus, on purge.
  const doomedBleed = (battle.bleedDoomed ?? [])
    .map((d) => ({ c: inBattleId(battle, d.id), line: d.deathLine }))
    .filter((d): d is { c: Combatant; line: string } => !!d.c && !isOutOfAction(d.c));
  const bleedFateHero = doomedBleed.find((d) => d.c.kind === 'hero' && (d.c.fate ?? 0) > 0);
  if (bleedFateHero) { set({ pendingFateSave: { heroId: bleedFateHero.c.id, source: 'slow' } }); return; }
  for (const d of doomedBleed) { d.c.dead = true; battle.log.push(ev('death', d.line, d.c.id)); for (const line of notifySlain(get, set, d.c)) battle.log.push(ev('death', line, d.c.id)); }
  battle.bleedDoomed = undefined;
  // (3) Avantage : mode Livre de base → -1 si aucun gagné ce Round (LDB 14 l.219) ; mode « Avantage de
  //     groupe » (AA 11 l.44) → transfert de domination du camp majoritaire (REMPLACE décroissance +
  //     Surnombre). Engagé périmé (LDB 13 l.171).
  if (groupAdvantage()) roundEndAdvantageTransfer(battle);
  for (const c of battle.combatants) {
    if (!groupAdvantage() && !isOutOfAction(c) && c.advantage > 0 && !c.gainedAdvThisRound) c.advantage -= 1;
    c.gainedAdvThisRound = false;
    c.usedShieldReactionRound = false; // Porte-Bouclier (variante AA 13 l.84) : « une fois par Round »
    if (c.distractedRounds) c.distractedRounds = c.distractedRounds > 1 ? c.distractedRounds - 1 : undefined; // Distraire (LDB 10 l.364) : expire en fin de Round
    c.dispelledThisRound = undefined; // Dissipation : « un seul Sort chaque Round » (LDB 46 l.156)
  }
  // Nuée (LDB 85 l.253) : tout opposant ENGAGÉ avec une nuée perd 1 PB en fin de Round (submergé).
  const swarms = battle.combatants.filter((s) => s.swarm && !isOutOfAction(s));
  if (swarms.length)
    for (const c of battle.combatants) {
      if (c.swarm || isOutOfAction(c) || !(c.engagedWith ?? []).some((id) => swarms.some((s) => s.id === id))) continue;
      c.wounds.current = Math.max(0, c.wounds.current - 1);
      if (c.wounds.current <= 0) applyZeroWounds(c);
    }
  decayEngagement(battle.combatants);
  // Zones persistantes (L11) : un Round de moins ; les zones épuisées se dissipent (fumée, Mur de feu…).
  if (battle.zones?.length) {
    const d = decayZones(battle.zones);
    battle.zones = d.zones;
    for (const l of d.log) battle.log.push(ev('info', l));
  }
  // « Avantages et Magie » : la convergence de Domaine ne vaut que DANS le Round (LDB 46 l.123-125).
  if (battle.domainCasts?.length) battle.domainCasts = undefined;
  // (4) Le combat est-il terminé à ce franchissement ? (morts lentes finalisées ci-dessus → victoire/défaite,
  //     capture des récompenses incluse). On tranche AVANT de proposer la fenêtre d'initiative.
  if (checkBattleOver(get, set)) return;
  // (4bis) Psychologie de FIN de Round (LDB 21 l.25) : la PEUR est un Test ÉTENDU de Calme « à la fin
  //     de chaque Round ». APRÈS le Destin (résolu en (1), peut avoir suspendu/re-rappelé) ET les
  //     décomptes UNE-FOIS-PAR-ROUND ci-dessus (Avantage/Nuée/Engagement/zones — DÉJÀ appliqués), on
  //     ouvre UNE cascade (une BANDE par entrée de règle, applier 'combatPsych') qui SUSPEND la suite jusqu'à
  //     résolution. À sa fermeture (`roundBoundary`), le store enchaîne DIRECTEMENT sur `enterRoundStartPause`
  //     — surtout PAS `resolveRoundBoundary` (qui re-jouerait ces décomptes). Sinon (aucune Peur), on
  //     enchaîne ici même.
  openRoundEndCascade(get, set);
  if (get().pendingCascade) return;
  enterRoundStartPause(get, set);
}

/** Pause de DÉBUT DE ROUND (LDB 17 l.25) : on s'arrête à CHAQUE début de Round pour montrer
 *  l'initiative (frise d'initiative (InitiativeStrip)) et permettre la pré-emption (Chance, 3e usage ;
 *  futurs Atouts/talents). L'IA reste gelée jusqu'à « Commencer le round » (confirmRoundStart) — cf.
 *  garde de maybeRunEnemyTurn. EN COOP (arbitrage 2026-06-11) : seul le round 1 est gaté (ready-check
 *  de tous) — les rounds suivants S'ENCHAÎNENT sans pause. Point d'entrée à part de
 *  `resolveRoundBoundary` : il se rappelle après la cascade de Peur de fin de Round. */
export function enterRoundStartPause(get: Get, set: SetFn): void {
  const b = get().battle;
  if (!b || b.over) return;
  for (const c of b.combatants) if (c.shotsThisTurn) c.shotsThisTurn = 0; // Salve : compteur de tirs réinitialisé à chaque Round
  const reset = { ...b, action: null, selectedAttack: undefined, movementUsed: 0, movedPreAction: false, acted: false, crewActed: {}, loadoutSwapped: false, stances: {}, reachable: new Map(), preview: null, runBudget: null, fearGate: null };
  if (get().net.mode !== 'local' && b.round > 1 && !(b.handRaisedBy?.length)) {
    set({ battle: reset, pendingRoundStart: null });
    get().confirmRoundStart();
    return;
  }
  // Auto-combat SOLO : on enchaîne les Rounds sans pause (l'IA joue tout le groupe). On NE touche PAS la
  // branche coop (ready-check du Round 1 préservé ci-dessus) ni le mode manuel/Rapide (pause conservée).
  if (cadenceAutoCombat() && get().net.mode === 'local') {
    set({ battle: reset, pendingRoundStart: null });
    get().confirmRoundStart();
    return;
  }
  // Pause de début de Round : PERSONNE n'est actif (turn -1) — confirmRoundStart posera le tour.
  set({ battle: { ...reset, turn: -1, handRaisedBy: [] }, pendingRoundStart: { round: b.round } });
}

/** IA : si le combattant actif est PILOTÉ par l'IA (ennemi, ou héros en Auto-combat possédé localement),
 *  il agit puis passe la main — cf. `aiDriven`. */
export function maybeRunEnemyTurn(get: Get, set: SetFn) {
  if (combatAdvanceBlocked(get(), { roundStart: true })) return;
  const battle = get().battle!;
  const active = activeCombatant(battle);
  if (!active || !aiDriven(get(), active) || isOutOfAction(active)) return;
  // Ce point d'entrée est rappelé par tout ce qui « relance » le combat (changement de cadence, reprise
  // après fenêtre, scrutation de recette) : un tour DÉJÀ JOUÉ ne se replanifie pas (#1852). Les beats
  // REDONDANTS, eux, sont inoffensifs — le jeton de tour vit sur le TIR (`runEnemyAI`), pas sur la
  // planification : un beat qui arrive en second n'a plus rien à jouer, et celui qui ACCÉLÈRE la
  // cadence (recette) reste utile.
  if (battle.aiTurnPlayed === cleDeTour(battle, active.id)) return;
  scheduleCombatTimer(() => runEnemyAI(get, set, active.id), beatHold(get, 'turnHandoff'));
}

/** CLÉ d'un tour d'IA : CE combattant, à CE tour de CE Round — l'unité que le jeton protège. */
function cleDeTour(battle: BattleState, id: string): string {
  return `${battle.round}:${battle.turn}:${id}`;
}

/** LDB 21 (Psychologie) l.27 : « Si la source de votre Peur se rapproche de vous, vous devez réussir un
 *  Test de Calme Intermédiaire (+0) ou gagner un État Brisé. » L'unité de la règle est LE DÉPLACEMENT :
 *  appelé une fois, APRÈS le déplacement COMPLET de `mover`, il compare la position de DÉPART
 *  (`fromPos`) à sa position d'ARRIVÉE — les cases traversées n'existent pas pour la règle. Tout
 *  combattant qui le craint (Peur active non vaincue) et dont il a fini plus près fait un Test de
 *  Calme ; la source, elle, ne jette RIEN (Test simple, aucune opposition). Les craintifs appelés par
 *  CE déplacement et affrontant la MÊME entrée de règle (la Peur de cette source, à cet Indice) forment
 *  UNE BANDE influençable quand ils sont pilotés à la main ; les autres (ennemi, héros auto) restent
 *  résolus INLINE par le même Flow — patron EXACT de la Surprise (`resolveAmbush`). La conséquence PURE
 *  de l'échec (1 État Brisé) est une op `condition` portée par la branche `fail`. */
export function approachFearTrigger(get: Get, set: SetFn, mover: Combatant, fromPos: Pt, toPos?: Pt): void {
  const battle = get().battle;
  const arrivee = toPos ?? mover.pos;
  if (!battle || !arrivee) return;
  const dues: { c: Combatant; indice: number }[] = [];
  for (const c of battle.combatants) {
    if (c.id === mover.id || isOutOfAction(c) || !c.pos) continue; // la Peur portée nomme sa source, quel que soit son camp
    const peur = (c.psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === mover.id && (p.calmeDR ?? 0) < (p.indice ?? 0));
    if (!peur) continue;
    if (chebyshev(arrivee, c.pos) >= chebyshev(fromPos, c.pos)) continue; // n'a pas fini plus près
    dues.push({ c, indice: peur.indice ?? 0 });
  }
  if (!dues.length) return;
  // Le foyer est l'ENTRÉE de psychologie affrontée (`peur`), qui porte déjà son enjeu et sa fiche — pas
  // un gabarit de `kind` : c'est la MÊME Peur que celle des Tests de Round. Son Indice fait donc partie
  // de la CLÉ de bande (deux Indices = deux règles en jeu, donc deux fenêtres).
  const testFor = (indice: number): FlowTest => ({
    skill: { id: 'calme' }, difficulty: 'intermediaire', label: 'Approche menaçante',
    stake: combatStakeRef('combatPsych', { entryId: 'peur', values: { indice } }),
  });
  const branches = {
    onSuccess: EMPTY_FLOW, // réussite : garde son sang-froid, rien à faire
    onFail: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: COND.brise, value: 1 }] } } as Flow,
  };
  const bandes = new Map<number, Combatant[]>();
  for (const d of dues) {
    // SURFACE (#1262), pas affordance locale : le craintif d'un AUTRE siège a SA rangée dans la bande.
    if (!surfaceOf(get, d.c.id)) continue; // sa résolution reste inline (ci-dessous)
    bandes.set(d.indice, [...(bandes.get(d.indice) ?? []), d.c]);
  }
  for (const [indice, craintifs] of bandes) {
    // DEUX déplacements de la même source dans la même cascade = deux bandes de MÊME clé de règle : la
    // fabrique à `index` (pushStep) les distingue, sans quoi `cascadeBatchRoll` retrouverait la première.
    // La bande est MONTÉE DANS la fabrique (et non recopiée après coup) : l'id indexé fait partie de la
    // déclaration, et l'étape sort mintée du socle.
    pushCombatStep(set, (index) => simpleBatchTestStep(
      craintifs, testFor(indice), branches, EMPTY_FLOW, 'intermediaire', `approach-fear-${mover.id}-${indice}-${index}`,
    ));
  }
  for (const d of dues) {
    if (surfaceOf(get, d.c.id)) continue; // sa rangée est dans la bande
    runCombatFlow({ mode: 'combat', get, set, target: d.c, caster: d.c, label: 'Approche menaçante' }, testFlow(testFor(d.indice), branches.onSuccess, branches.onFail));
  }
  // Inline (mover ennemi → héros auto/ennemi craintif) : les lignes partent dans la file différée. Le héros
  // manuel suspend (cascade) et n'en pousse aucune. On les folde dans le `battle.log` que le `move` réécrit.
  battle.log.push(...drainPendingLog(get, set));
}

/** Enregistre le déplacement COMPLET de `c` (`from` → sa position d'arrivée) comme événement d'approche
 *  EN ATTENTE. Le déclencheur (LDB 21 l.27) ne s'évalue qu'à l'IRRÉVOCABILITÉ du déplacement : Action
 *  prise (`markActed`) ou fin de tour (`advanceTurn`) — le premier des deux. Un déplacement encore
 *  révocable (`cancelMove`, charge annulée avant le jet) est purgé par `clearApproachMoves`. Un
 *  déplacement = UN événement : deux déplacements dans le tour en laissent deux. */
export function noteApproachMove(c: Combatant, from: Pt): void {
  if (!c.pos) return;
  c.approachMoves = [...(c.approachMoves ?? []), { from: { x: from.x, y: from.y }, to: { x: c.pos.x, y: c.pos.y } }];
}

/** Purge les événements d'approche en attente de `c` — le déplacement a été DÉFAIT (la position d'avant
 *  est restaurée), il n'a donc jamais eu lieu. */
export function clearApproachMoves(c: Combatant | null | undefined): void {
  if (c) c.approachMoves = undefined;
}

/** Consomme les événements d'approche en attente de `c` : chacun rejoue `approachFearTrigger` sur SON
 *  déplacement complet (départ→arrivée de cet événement, la position courante ne décide pas). Consommés
 *  d'abord : jamais deux Tests pour le même déplacement. */
export function sealApproachMoves(get: Get, set: SetFn, c: Combatant | null | undefined): void {
  const moves = c?.approachMoves;
  if (!c || !moves?.length) return;
  c.approachMoves = undefined;
  for (const m of moves) approachFearTrigger(get, set, c, m.from, m.to);
}

/** SEULE couture qui pose `acted` (Action du Tour consommée) : elle scelle du même geste les
 *  déplacements en attente de l'acteur — une Action prise interdit `cancelMove`, donc le
 *  déplacement est irrévocable et son approche est due (LDB 21 l.27). Rend le `BattleState` à poser. */
export function markActed(get: Get, set: SetFn, battle: BattleState): BattleState {
  sealApproachMoves(get, set, inBattleId(battle, battle.order[battle.turn]));
  return { ...get().battle ?? battle, acted: true }; // RE-LU après le scellement : ce qu'il a écrit ne se réverte pas
}

/** Forme commune d'un Test de Psychologie de combat DÛ pour un héros (cumul `prevDR` = 0 sauf Peur étendue). */
type HeroPsychDue = { kind: PsychType; sourceId: string; sourceName: string; indice: number; prevDR: number; cible?: string };

/** Combattants en Ligne de Vue de `c` (hors lui-même, debout). Mutualisé par les deux collectes. */
function visibleFoesAndAllies(battle: BattleState, scene: import('./scene').Scene, c: Combatant): Combatant[] {
  return battle.combatants.filter((v) => v.id !== c.id && v.pos && !isOutOfAction(v) && losClear(scene, c.pos!, v.pos, smokeOf(battle)));
}

/** Test de Psychologie de DÉBUT de Round dû à `c` (LDB 21 l.9) : un Trait ciblé (re-test d'un actif
 *  OU nouveau déclenchement) ou une NOUVELLE Terreur en Ligne de Vue. Pur de lecture. La Peur (simple
 *  Taille/causesPeur) NE se teste PAS ici : c'est un Test étendu de FIN de Round (cf. collectHeroRoundEndPsych). */
export function collectHeroRoundStartPsych(get: Get, c: Combatant): HeroPsychDue | null {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !c.pos || isPsychImmune(c)) return null; // Immunité psy (trait/Frénésie/Détermination temp)
  const state = c.psychState ?? [];
  // NOUVELLE Terreur en Ligne de Vue (1ʳᵉ rencontre → Brisé, puis devient une Peur — LDB 21 l.54-56).
  for (const foe of battle.combatants) {
    if (foe.id === c.id || isOutOfAction(foe) || !foe.pos) continue; // « chez les autres créatures » (LDB 85 l.264-266) : seule exclusion, soi-même
    if (!losClear(scene, c.pos, foe.pos, smokeOf(battle))) continue;
    const src = fearSourceFor(c, foe, riderFearSize(battle, c)); // Cavalier émérite (AA 13 l.25) : Taille = monture face à la Peur de Taille
    if (!src || src.kind !== 'terreur' || state.some((p) => p.sourceId === foe.id)) continue;
    return { kind: 'terreur', sourceId: foe.id, sourceName: foe.label, indice: src.indice, prevDR: 0 };
  }
  // Traits psy CIBLÉS (Animosité/Haine/… — LDB 21) : re-test des actifs, puis nouveaux déclenchements.
  const visible = visibleFoesAndAllies(battle, scene, c);
  for (const p of state) {
    if (p.active && estCibleType(p.type) && p.cible && p.lastTestRound !== battle.round && visible.some((v) => groupMatch(p.cible!, v.groups ?? [])))
      return { kind: p.type, sourceId: p.sourceId ?? '', sourceName: '', indice: 0, prevDR: 0, cible: p.cible }; // affliction active à re-tester
  }
  const tt = targetedTrigger(c, visible);
  if (tt) return { kind: tt.type, sourceId: tt.sourceId, sourceName: '', indice: 0, prevDR: 0, cible: tt.cible };
  return null;
}

/** Test de Psychologie de FIN de Round dû à `c` (LDB 21 l.25) : une PEUR — nouvelle source de Peur en
 *  Ligne de Vue (Taille gap 1 / causesPeur), ou Peur active non encore vaincue ni testée ce Round. Test
 *  ÉTENDU de Calme (`prevDR` = DR cumulé). Pur de lecture. */
export function collectHeroRoundEndPsych(get: Get, c: Combatant): HeroPsychDue | null {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !c.pos || isPsychImmune(c)) return null;
  const state = c.psychState ?? [];
  // NOUVELLE source de Peur (pas Terreur — celle-ci passe par le début de Round) en Ligne de Vue.
  for (const foe of battle.combatants) {
    if (foe.id === c.id || isOutOfAction(foe) || !foe.pos) continue; // « chez les autres créatures » (LDB 85 l.264-266) : seule exclusion, soi-même
    if (!losClear(scene, c.pos, foe.pos, smokeOf(battle))) continue;
    const src = fearSourceFor(c, foe, riderFearSize(battle, c)); // Cavalier émérite (AA 13 l.25) : Taille = monture face à la Peur de Taille
    if (!src || src.kind !== 'peur' || state.some((p) => p.sourceId === foe.id)) continue;
    return { kind: 'peur', sourceId: foe.id, sourceName: foe.label, indice: src.indice, prevDR: 0 };
  }
  // Peur ACTIVE (DR cumulé < Indice) non encore testée ce Round → Test étendu (cumul vers l'Indice).
  for (const p of state) {
    if (p.type === 'peur' && (p.calmeDR ?? 0) < (p.indice ?? 0) && p.lastTestRound !== battle.round) {
      const src = inBattleId(battle, p.sourceId);
      return { kind: 'peur', sourceId: p.sourceId!, sourceName: libelleOuAbsence(src, 'combattant', p.sourceId!), indice: p.indice ?? 1, prevDR: p.calmeDR ?? 0 };
    }
  }
  return null;
}

/** DÉCLARATION COMMUNE d'une bande de Psychologie de combat — telle qu'elle vit sur l'ÉTAPE. */
type CombatPsychDecl = NonNullable<CascadeStep['combatPsych']>;

/** Ce qui DIVERGE d'un héros à l'autre DANS une bande (charge utile de RANGÉE, socle L0) : le DR déjà
 *  cumulé du Test étendu et l'allègement « Sans Peur ». */
interface CombatPsychRowMeta { prevDR: number; sansPeur: boolean }

/** Charge utile d'une RANGÉE, avec ses défauts neutres (aucun cumul, aucun allègement). */
function psychRowMeta(part: BatchParticipant): CombatPsychRowMeta {
  return { prevDR: Number(part.meta?.prevDR ?? 0), sansPeur: !!part.meta?.sansPeur };
}

/** Un Test de Psychologie de combat DÛ par un héros, avant regroupement : la déclaration de règle qui
 *  l'appelle (clé de bande), sa RANGÉE, et la présentation qui en découle (commune à toute la bande). */
interface CombatPsychDue { decl: CombatPsychDecl; row: BatchParticipant; icon: string; label: PlayerText }

/** Le Test de Psychologie de combat dû au héros `c` selon `collect` (début ou fin de Round), sous forme
 *  de RANGÉE + déclaration de règle. La sortie de Frénésie est un effet `onTurnStart` en DONNÉES
 *  (diffusé par `fireTurnStartTriggers`) — plus de force-exit ici. Renvoie `null` sinon. */
function psychDueFor(get: Get, c: Combatant, collect: (get: Get, c: Combatant) => HeroPsychDue | null): CombatPsychDue | null {
  const t = collect(get, c);
  if (!t) return null;
  const isCible = estCibleType(t.kind);
  const cl = isCible ? cibleLabel(t.kind) : null;
  // Paramètres du Test EN DONNÉES (psychology.json `test`) : compétence (défaut Calme) + difficulté
  // (défaut Intermédiaire). Plus de Calme/Intermédiaire codé en dur.
  const td = findPsychologyById(t.kind)?.test;
  const skill = td?.skill ?? { id: 'calme' };
  // Sans Peur (Ennemi) (LDB 10 l.1051) : face à une NOUVELLE Peur/Terreur de l'ennemi spécifié, « un
  // seul Test de Calme Accessible (+20) » pour l'ignorer. Pas sur les re-tests d'une Peur déjà subie
  // (entrée psychState existante → Test étendu normal +0) ni sur les Traits ciblés.
  const sourceFoe = !isCible ? inBattleId(get().battle, t.sourceId) : undefined;
  const isNewSource = !(c.psychState ?? []).some((p) => p.type === 'peur' && p.sourceId === t.sourceId);
  const sansPeur = !!sourceFoe && isNewSource && sansPeurVs(c, sourceFoe);
  // Sans Peur force Accessible (+20) ; sinon la difficulté déclarée (défaut Intermédiaire +0).
  const difficulty: Difficulty = sansPeur ? 'accessible' : (td?.difficulty ?? 'intermediaire');
  const skillLabel = refLabel('skills', skill);
  // Peur de combat = Test ÉTENDU (LDB 21 l.25) : le cumul `prevDR`→`indice` voyage SUR LA RANGÉE
  // (`extendedDrTarget`/`extendedDrDone` de `BatchParticipant`) — SOURCE UNIQUE de la présentation
  // « barre de DR cumulé » avec la cartographie de voyage (`travelPostes.ts`) : `CascadeModal` ne
  // recalcule rien depuis `combatPsych` (aucune arithmétique dupliquée, #329 marque 9).
  const extended = psychResolution(t.kind).mode === 'extended';
  return {
    decl: { kind: t.kind, sourceId: t.sourceId, sourceName: t.sourceName, indice: t.indice, cible: t.cible },
    row: {
      id: c.id, interactive: true, result: null,
      // Le Test allégé se lit SUR LA RANGÉE qui en profite (sa Difficulté, son libellé de ligne) : deux
      // héros face à la MÊME source ne partagent pas forcément le Talent.
      label: sansPeur ? `${skillLabel} · Sans Peur` : skillLabel,
      skillId: skill.id, difficulty,
      // Ligne montée par le monteur CANONIQUE (#1153), canal `combat` NON-attaque : base NUE, pénalité
      // d'États NOMMÉE (LDB 16 : « -10 à tous vos Tests » par palier) et comptée UNE fois dans la cible.
      // La calculer à la main ici l'oubliait : un héros Brisé ×2 testait sa Peur à pleine valeur.
      ...rollStep({ actor: c, test: { skill: skill.id, spec: skill.spec }, combat: { kind: 'test' }, difficulty }),
      ...(extended ? { extendedDrTarget: t.indice, extendedDrDone: t.prevDR } : {}),
      meta: { prevDR: t.prevDR, ...(sansPeur ? { sansPeur: true } : {}) },
    },
    icon: cl?.icon ?? (t.kind === 'terreur' ? 'creature/scream' : 'flag/fear'),
    label: cl ? (t.cible ? stepPrecision(dataLabel(cl.label), dataLabel(t.cible)) : dataLabel(cl.label)) : stepPsych(t.kind, t.indice),
  };
}

/**
 * BANDES de Psychologie de combat (#1117 L2) — la CLÉ d'une bande EST l'entrée de règle mise en jeu :
 * type psy + source + cible + Indice font UNE fenêtre, dont la DÉCLARATION vit sur l'ÉTAPE et dont les
 * héros appelés sont les RANGÉES (jets INDÉPENDANTS, `aggregate:'none'`). L'ordre des bandes est celui
 * de leur première rencontre en parcourant les combattants.
 *
 * DÉCLARATION au socle (`makeBandFactory`, #1262 V2) : Map keyée, dédoublement de clé, place réservée
 * et mint. La POSSESSION est celle du socle (`bandStep`) : plusieurs porteurs → `groupOwner`, un seul
 * → SON `actorId`. Les rangées sont déjà montées (`psychDueFor`) et leurs porteurs déjà SURFACÉS par
 * les collecteurs — c'est la seule chose que la bande ajoute.
 */
const combatPsychBands = makeBandFactory<CombatPsychDue>({
  cle: ({ decl: d }) => `${d.kind}|${d.sourceId}|${d.cible ?? ''}|${d.indice}`,
  rangee: (due) => due.row,
  situation: ({ decl: d, icon, label }, { index }) => ({
    id: `psych-${d.kind}-${index}`, kind: 'combatPsych', icon, label,
    combatPsych: d,
    // L'enjeu descend à l'AFFLICTION affrontée : ses conséquences lui sont propres (`psychResolution`
    // lit `failCondition`/`failAmount`/`becomes` de SON entrée), donc son texte vit sur SON entrée.
    stake: combatStakeRef('combatPsych', { entryId: d.kind, values: { indice: d.indice } }),
    // Les DEUX issues, dérivées des ops que l'applier appliquera (`psychBranchOps`) : la surface
    // les rend en chips codex-liées avant le jet, et le verdict est le MÊME bloc filtré (#1117).
    meta: { onSuccess: psychBranchFlow(d, true), onFail: psychBranchFlow(d, false) },
  }),
});

/** Une cascade de Round est-elle interdite (modale/cascade bloquante déjà ouverte) ? */
function roundCascadeBlocked(get: Get): boolean {
  const battle = get().battle;
  return !battle || !!battle.over || !!get().pendingCascade || !!get().pendingFateSave;
}

/** Construit la cascade de Psychologie de combat (UNE BANDE par entrée de règle, une RANGÉE par héros
 *  dû) à partir d'un collecteur. No-op si une cascade/modale bloquante est ouverte. Met l'IA en pause
 *  (purpose:'combat') jusqu'à résolution ; la reprise est gérée par `cascadeNext`/`cascadeFinish`
 *  (→ resumeSuspendedAI). */
function openCombatPsychCascade(
  get: Get,
  set: SetFn,
  collect: (get: Get, c: Combatant) => HeroPsychDue | null,
  title: string,
  icon: string,
  roundBoundary = false,
): void {
  if (roundCascadeBlocked(get)) return; // Maladresse = étape de pendingCascade (déjà couverte)
  const dues: CombatPsychDue[] = [];
  for (const c of get().battle!.combatants) {
    // SURFACE (#1262), pas affordance locale : le porteur d'un AUTRE siège entre dans la cascade — sa
    // rangée l'attend, c'est SON joueur qui la roule. `isOutOfAction` reste le critère MÉTIER du site.
    if (!surfaceOf(get, c.id) || isOutOfAction(c)) continue;
    const due = psychDueFor(get, c, collect);
    if (due) dues.push(due);
  }
  const steps = combatPsychBands(dues);
  if (!steps.length) return;
  openSequence(get, set, { title, icon, purpose: 'combat', steps, roundBoundary });
}

/** Cascade de Psychologie de DÉBUT de Round (Traits ciblés + nouvelles Terreurs, LDB 21 l.9) — une
 *  bande par entrée de règle. Appelée APRÈS `confirmRoundStart` (acteur posé) ; suspend l'IA jusqu'à
 *  résolution. */
export function openRoundStartPsych(get: Get, set: SetFn): void {
  // « tant que vous défendez les êtres aimés » (LDB 21 l.75) : le Round est l'un des DEUX seuls
  // détenteurs du roster — il rafraîchit ici le verdict de présence porté par `active`, que les
  // résolutions d'attaque (sans roster) liront ensuite.
  const battle = get().battle;
  if (battle && refreshAllDefendedPsych(battle.combatants)) {
    set({ battle: { ...get().battle!, combatants: [...get().battle!.combatants] } });
  }
  openCombatPsychCascade(get, set, collectHeroRoundStartPsych, 'Sang-froid', 'resource/resolve');
}

/**
 * Cascade de FIN de Round (combat) — un SEUL `pendingCascade` fusionnant les Tests d'upkeep
 * INFLUENÇABLES (Empoisonné → récupération du Brisé → se-fatiguer, LDB 16) PUIS les BANDES de Peur
 * (Test étendu de Calme, LDB 21 l.25). Les ENNEMIS sont déjà résolus en silence par les hooks
 * `roundBoundary` (poison-resist/broken-recovery/se-fatiguer). Ordre choisi : upkeep AVANT la
 * Peur (les effets de Round RAW — dont les hooks ennemi — précèdent la révélation/Psychologie de fin
 * de Round, et la sortie d'un État Sonné/Brisé peut influer sur l'état d'esprit) ; ENTRE familles cet
 * ordre est conservé, mais il vaut famille par famille (tous les upkeeps, puis les bandes)
 * et non plus héros par héros — une bande est UNE question posée à N héros, elle ne peut pas
 * s'entrelacer avec l'entretien de chacun d'eux. Appelée au franchissement de Round APRÈS
 * l'entretien/le Destin ; suspend l'IA jusqu'à résolution.
 *
 * Les conséquences d'upkeep RNG-free (retrait « caché » du Brisé, Exténué sans-Test) sont appliquées
 * DÉTERMINISTEment par le collecteur via le `sink` ci-dessous (journal de combat).
 */
export function openRoundEndCascade(get: Get, set: SetFn): void {
  if (roundCascadeBlocked(get)) return;
  const upkeepLines: { line: string; id?: string }[] = [];
  const sink = (line: string, c?: Combatant) => upkeepLines.push({ line, id: c?.id });
  const steps: BuiltCascadeStep[] = [];
  const dues: CombatPsychDue[] = [];
  for (const c of get().battle!.combatants) {
    // SURFACE (#1262), pas affordance locale : le porteur d'un AUTRE siège entre dans la cascade — c'est
    // SON joueur qui roulera. Prédicat MIROIR des hooks `roundBoundary` (roundHooks) et du dispatcher
    // (`deferInteractiveTest`) : décaler l'un des deux perdrait ou doublerait le Test. `isOutOfAction`
    // reste le critère MÉTIER du site : ici le porteur hors d'action est SAUTÉ, là où la fin de combat
    // (`openCombatEndCascade`) le fait tomber dans la voie INLINE — ÉCART AU RAW suivi par #1265
    // (Test d'entretien de fin de Round : LDB 16 l.68-78).
    if (!surfaceOf(get, c.id) || isOutOfAction(c)) continue;
    // 1) Upkeep du combattant (effets RNG-free). 2) Peur de fin de Round, regroupée en bandes ci-dessous.
    //    (La sortie de Frénésie est un effet `onTurnStart` en données, jouée au début du tour du héros.)
    steps.push(...collectHeroRoundEndUpkeep(get, c, sink));
    const due = psychDueFor(get, c, collectHeroRoundEndPsych);
    if (due) dues.push(due);
  }
  steps.push(...combatPsychBands(dues));
  // Lignes déterministes d'upkeep → journal de combat (les Tests influençables iront au journal de la
  // cascade à leur validation). On applique AVANT d'ouvrir la cascade pour garder l'ordre de lecture.
  if (upkeepLines.length) {
    const b = get().battle!;
    set({ battle: { ...b, log: [...b.log, ...upkeepLines.map((u) => ev('condition', u.line, u.id))] } });
  }
  if (!steps.length) return;
  openSequence(get, set, { title: 'Fin de Round', icon: 'time/clock', purpose: 'combat', steps, roundBoundary: true });
}

/**
 * Conséquence d'un Test de Calme de COMBAT POUR UNE RANGÉE : pose/met à jour le `psychState` du héros.
 * La résolution kind-agnostique (`rollTest(Calme)`) est faite par `FLOWS.cascadeBatch` ; ici on
 * interprète le résultat par `kind`, avec la déclaration COMMUNE de la bande (`cp`) et ce qui est
 * PROPRE au héros (`rm` : DR déjà cumulé, Sans Peur). Peur = Test ÉTENDU : cumule `prevDR + DR` vers
 * l'Indice (vainc à ≥ Indice). SOURCE UNIQUE de la résolution par héros — l'applier de bande l'appelle
 * pour CHACUNE de ses rangées.
 */
function resolveCombatPsychRow(get: Get, hero: Combatant, cp: CombatPsychDecl, rm: CombatPsychRowMeta, r: CascadeRoll, immune: boolean): Consequence[] {
  const battle = get().battle;
  // DÉTERMINATION (LDB 17 l.59) : immunité TEMPORAIRE — la Peur/Terreur/Trait est IGNORÉE ce Round,
  // PAS vaincue. On NE cumule PAS le DR, on NE pose PAS de Brisé, on N'active PAS le trait ciblé : le
  // `psychState` (et le `calmeDR` d'une Peur déjà entamée) reste INCHANGÉ. Le collecteur de Round saute
  // ce héros tant que `psychImmuneRoundsLeft > 0` ; à l'expiration, la source reprend.
  if (immune) return freeCons([tr('cf.psychImmune', { name: hero.label })]);
  let line: string;
  let phobieLine: string | null = null;
  const res = psychResolution(cp.kind);
  const cible = estCibleType(cp.kind);
  // Peur = Test ÉTENDU de Calme (LDB 21 l.25) : cumuler le DR vers l'Indice (calque resolvePeurTest).
  // Sans Peur (LDB 10 l.1051) : « un seul Test (+20) » → une réussite IGNORE la Peur d'emblée
  // (DR porté à l'Indice) ; un échec laisse le porteur sujet (re-tests suivants = Peur normale +0).
  // Sinon Test étendu LDB 12 MUTUALISÉ (`extendedTestStep`) — un Round raté RETIRE les DR négatifs
  // (planché à 0), au lieu de l'ancien cumul add-only (bug : la Peur ne pouvait jamais régresser).
  // C'est le SEUL terme que la donnée ne porte pas : il voyage dans l'op de pose de la branche.
  const calmeDR = res.mode === 'terreur' || cible ? undefined
    : rm.sansPeur && r.success
      ? Math.max(rm.prevDR, cp.indice)
      : extendedTestStep(rm.prevDR, r, cp.indice, !!rule('test-extended-min-sl')).total;
  // CONSÉQUENCES de la branche réalisée, en ops dérivées de `psychology.json` — les MÊMES que la
  // surface annonce (`meta.onSuccess`/`onFail`). Le DR du jet est versé au contexte : la quantité
  // d'État de l'échec (`valuePerSL{onFailure}`) s'y résout, même arithmétique que `failConditionAmount`.
  applyOps(hero, psychBranchOps(cp, { success: r.success, calmeDR, round: battle?.round }), { sl: r.sl, source: { kind: 'psychology', id: cp.kind } });
  if (res.mode === 'terreur') {
    // 1ʳᵉ rencontre (LDB 21 l.54-56) : échec → État `failCondition` = Indice + |DR négatifs| ; devient
    // l'état `becomes` (LDB 21 l.56, INCONDITIONNEL, à PLEIN Indice — #1190). Conséquences en DONNÉES.
    const brise = r.success ? 0 : failConditionAmount(res.failAmount, cp.indice, r.sl);
    line = r.success ? tr('out.terreurHold', { name: hero.label }) : tr('cf.terreurThenFear', { name: hero.label, foe: cp.sourceName, brise, indice: cp.indice });
    // Phobie du noir (ADE II Annexe I, règle facultative `psych-acquisition-optional`) : cumuler les États
    // Brisé subis À CAUSE de la Terreur ; à ≥ Bonus de FM → Phobie liée à la source (son Groupe si connu,
    // sinon son nom), puis remise à zéro du compteur. `gainPhobieIfThreshold` porte la garde de la règle.
    if (brise > 0 && res.failCondition === COND.brise) {
      hero.briseFromTerreur = (hero.briseFromTerreur ?? 0) + brise;
      const foe = inBattleId(battle, cp.sourceId);
      const gained = gainPhobieIfThreshold(hero, hero.briseFromTerreur, foe?.groups?.[0] ?? cp.sourceName ?? '');
      if (gained) {
        hero.psychTraits = [...(hero.psychTraits ?? []), gained.phobie];
        hero.briseFromTerreur = 0;
        phobieLine = `${hero.label} développe une Phobie durable : ${gained.phobie.cible}.`;
      }
    }
  } else if (cible) {
    // Trait ciblé : échec → affliction active ; succès → marqueur inerte (pas de re-déclenchement).
    const cl = cibleLabel(cp.kind);
    line = r.success ? tr('out.cibleMaster', { name: hero.label, kind: cl?.label.toLowerCase() ?? cp.kind }) : tr('out.cibleGrip', { name: hero.label, kind: cl?.label.toLowerCase() ?? cp.kind });
  } else {
    line = (calmeDR ?? 0) >= cp.indice
      ? `${hero.label} ${rm.sansPeur ? 'ignore la Peur' : 'surmonte sa peur'}${cp.sourceName ? ` de ${cp.sourceName}` : ''}${rm.sansPeur ? ' (Sans Peur)' : ''}.`
      : `${hero.label} reste sous l'emprise de la Peur (${calmeDR ?? 0}/${cp.indice} DR).`;
  }
  // Immunités croisées (LDB 21) : Animosité/Préjugé cèdent dès qu'on tombe sous un effet psy dominant.
  return freeCons([line, ...(phobieLine ? [phobieLine] : []), ...supersededLines(hero, hero.label)]);
}

/** Applier de BANDE de Psychologie de combat : la déclaration de règle est celle de l'ÉTAPE, la
 *  conséquence se joue RANGÉE PAR RANGÉE (résultat, charge utile et Détermination du porteur), et
 *  chaque verdict reste SUR SA rangée (le portrait attribue) — jamais un agrégat (`aggregate:'none'`). */
registerCascadeApplier('combatPsych', (get, set, step) => {
  const cp = step.combatPsych;
  if (!cp || !step.participants) return;
  for (const part of step.participants) {
    const hero = actorIn(get(), part.id);
    if (!hero || !part.result) { part.outcome = []; continue; }
    const lines = resultLines(resolveCombatPsychRow(get, hero, cp, psychRowMeta(part), part.result, !!part.immune));
    part.outcome = lines;
    for (const l of lines) get().log(l.text);
  }
  set({ party: [...get().party] });
  if (get().battle) set({ battle: { ...get().battle!, combatants: [...get().battle!.combatants] } });
  return { consequences: [] };
});

// === TRACE DE DÉCISION IA (DEV uniquement) ==================================================
// Buffer en anneau des derniers tours pilotés par l'IA : action CHOISIE + classement des candidats
// (l'« intention », via `consumeAiRanking`). Rempli au SEUL site d'enregistrement de `runEnemyAI`
// (jamais pollué par les appels secondaires aiApproachPlan / peek de Frénésie). Lu par les devtools
// (`__wfrp.aiLog`). N'a de contenu que si le flag `AI_TRACE` (ai.ts) est ON — sinon `top` reste vide.
export interface AiTurnRec { round: number; id: string; label: string; action: string; top: AiCandTrace[]; }
const AI_TURN_LOG: AiTurnRec[] = [];
export function aiTurnLog(): AiTurnRec[] { return AI_TURN_LOG; }
export function clearAiTurnLog() { AI_TURN_LOG.length = 0; }
/** Résumé COURT d'une action IA pour la trace (un coup d'œil = quoi/qui/où). */
function describeAiAction(a: EnemyAction): string {
  switch (a.kind) {
    case 'cast': return `cast ${a.spell}→${a.targetId}`;
    case 'castArea': return `castArea ${a.spell}@${a.center.x},${a.center.y}`;
    case 'focus': return `focus ${a.spell}`;
    case 'shoot': return `shoot ${a.targetId}`;
    case 'melee': return `melee ${a.targetId}`;
    case 'move': return `move→${a.thenTargetId}@${a.to.x},${a.to.y}`;
    case 'reload': return 'reload';
    case 'recover': return `recover ${a.state}`;
    case 'spendResource': return `spend ${a.resource}→${a.id}`;
    case 'grapple': return `grapple ${a.resolution}→${a.targetId}`;
    case 'manPoste': return `manPoste ${a.hullId}/${a.posteUid}`;
    case 'selfManeuver': return `selfManeuver ${a.maneuverId}`;
    case 'end': return 'end';
  }
}

/** Sélection de LOADOUT par l'IA (héros auto + ennemis à plusieurs sets d'armes). Un combattant qui porte un
 *  set À DISTANCE et un set de MÊLÉE dégaine le bon selon la situation : son arme à distance quand AUCUN
 *  adversaire ne l'engage (il tire/kite), son arme de mêlée au contact (ou en Frénésie, qui force la charge).
 *  Maneuver GRATUITE 1/tour (`cs.draw`, comme `battleSwitchLoadout`). Sans ça, un Chasseur dont la fronde est
 *  dans le set 2 (épée active en set 1) ne tirait JAMAIS (retour playtest 2026-06-27 : « le chasseur charge à
 *  l'arme simple alors qu'il a une fronde »). Les ennemis à statbloc (armes posées en dur, sans `loadouts`)
 *  ne passent pas ici. PUR-déterministe (aucun dé) → coop-safe ; seul l'état du combattant (set actif) change. */
function aiSelectLoadout(set: SetFn, enemy: Combatant, battle: BattleState): void {
  const sets = enemy.loadouts ?? [];
  if (sets.length < 2 || !enemy.pos) return;
  const items = enemy.items ?? [];
  const setKind = (lo: { main?: string }): 'ranged' | 'melee' | null => {
    const it = lo.main ? items.find((i) => i.uid === lo.main) : undefined;
    return it?.kind === 'ranged' ? 'ranged' : it?.kind === 'melee' ? 'melee' : null;
  };
  const rangedSet = sets.find((l) => setKind(l) === 'ranged');
  const meleeSet = sets.find((l) => setKind(l) === 'melee');
  if (!rangedSet || !meleeSet) return; // pas un hybride tir+mêlée → on ne touche pas au set choisi
  const foes = battle.combatants.filter((c) => c.kind !== enemy.kind && !isOutOfAction(c) && c.pos);
  const engaged = foes.some((f) => combatDistance(enemy, f) <= 1);
  const want = engaged || isFrenzied(enemy) ? meleeSet : rangedSet; // au contact / frénétique → mêlée ; sinon → tir
  if (enemy.activeLoadoutId === want.id) return; // déjà le bon set en main
  enemy.activeLoadoutId = want.id;
  recomputeLoadout(enemy);
  const drawn = enemy.weapons.find((w) => w.type === (want === meleeSet ? 'melee' : 'ranged'));
  battle.log.push(ev('detail', tr('cs.draw', { name: enemy.label, weapon: garanti(drawn, want.id, 'arme du set dégainé').label }), enemy.id));
  set({ battle: { ...battle } });
}

// ── IA DE COQUE (couche MER, navire-unité — MDG 13-14) ─────────────────────────────────────────────
/** Cap le plus court (crans signés d'octant) de `from` vers `to`, BORNÉ à ±2 (90°/manœuvre — RAW-sober : un navire
 *  ne pivote pas de 180° en un seul Test ; parité avec les options de `ShipManeuverModal`). PUR. */
function shipTurnToward(from: Dir8, to: Dir8): number {
  const d = (DIR8_ORDER.indexOf(to) - DIR8_ORDER.indexOf(from) + 8) % 8; // 0..7
  const signed = d <= 4 ? d : d - 8; // −3..4
  return Math.max(-2, Math.min(2, signed));
}

/** Portée NUMÉRIQUE (m) d'une pièce (une portée `{bf}` — arme perso résolue au BF — n'a pas cours pour une pièce de
 *  navire à portée fixe : traitée comme 0, hors du gate d'engagement naval). PUR. */
const posteRangeM = (p: ShipPoste): number => (typeof p.item.range === 'number' ? p.item.range : 0);

/** Portée maximale (m) des pièces CHARGÉES d'une coque, tous bords confondus. PUR. */
function shipMaxPosteRange(ship: Combatant): number {
  return Math.max(0, ...(ship.postes ?? []).filter((p) => p.loaded !== false).map(posteRangeM));
}

/** Clôt le tour d'une coque IA (readability : mêmes tenues que le tour ennemi). Ne progresse PAS si la bordée a
 *  conclu le combat (reddition/naufrage — `checkBattleOver` l'a déjà fermé). */
function endShipTurn(get: Get, set: SetFn, delay?: number): void {
  scheduleCombatTimer(() => { if (!get().battle?.over) advanceTurn(get, set); }, delay ?? beatHold(get, 'enemyAdvance'));
}

/**
 * IA d'une COQUE à son tour (échelle MER) — décision RAW-sensée, headless (aucune modale) :
 *  1. si un bord ARMÉ porte sur une coque adverse ET qu'elle est à portée → BORDÉE (`shipAutoBattery` : Test
 *     d'équipage des Artilleurs résolu sans modale, mêmes fns pures que le joueur) ;
 *  2. sinon MANŒUVRE (`maneuverShip`, barreur = meilleur de l'équipage APTE) : virer pour amener le bord le plus
 *     armé en batterie quand la cible est déjà à portée, sinon fermer la distance cap sur elle (la coque avance
 *     TOUJOURS le long du cap, MDG 13) — l'approche se joue donc sur plusieurs Rounds ;
 *  3. à défaut de barreur apte → la coque dérive le long de son cap (`shipAdvance`).
 * Les Tests d'équipage adverses sont auto-résolus par ces mêmes flux ; tout est journalisé (aucun jet silencieux).
 */
function runShipAI(get: Get, set: SetFn, ship: Combatant): void {
  const battle = get().battle!;
  const scene = get().scene!;
  const foeKind = ship.kind === 'enemy' ? 'hero' : 'enemy';
  const targets = battle.combatants.filter((c) => c.kind === foeKind && isVehicle(c) && !isOutOfAction(c) && c.pos);
  if (!ship.pos || !targets.length) return endShipTurn(get, set);
  const shipPos = ship.pos;
  const target = targets.reduce((a, b) => (chebyshev(shipPos, b.pos!) < chebyshev(shipPos, a.pos!) ? b : a));
  const targetPos = target.pos!;
  const mpt = sceneMetresPerTile(scene);
  const heading = get().facing[ship.id] ?? 'N';
  const bearing = facingToward(shipPos, targetPos);
  const distMetres = chebyshev(shipPos, targetPos) * mpt;
  // 1) Le bord qui porte (cap courant) est-il armé ET la cible à portée de ses pièces ? → FEU.
  const side = targetArc(heading, shipPos, targetPos);
  const bearingRange = Math.max(0, ...bearingPostes(ship, side).map(posteRangeM));
  if (bearingRange > 0 && distMetres <= bearingRange && get().shipAutoBattery(ship.id, target.id)) {
    return endShipTurn(get, set, TEMPO.aimTelegraph);
  }
  // 2) MANŒUVRE : aligner le bord le plus armé (si à portée) ou fermer la distance (hors portée).
  const helm = shipHelmsman(battle.combatants, ship);
  if (helm) {
    const primary = mostArmedSide(ship);
    const inRange = shipMaxPosteRange(ship) > 0 && distMetres <= shipMaxPosteRange(ship);
    const desired = inRange && primary ? headingToBear(primary, bearing) : bearing;
    maneuverShip(get, ship.id, shipTurnToward(heading, desired), helm.id); // vire (si Test réussi) + avance ; journalise
    return endShipTurn(get, set);
  }
  // 3) Aucun barreur apte : la coque dérive le long de son cap (approche minimale, MDG 13 M÷2 plancher).
  get().shipAdvance(ship.id, Math.max(1, Math.round(shipMaxPosteRange(ship) / mpt) || 1));
  endShipTurn(get, set);
}

export function runEnemyAI(get: Get, set: SetFn, enemyId: string) {
  const { battle, scene } = get();
  if (!battle || !scene || battle.over) return;
  const enemy = inBattleId(battle, enemyId);
  if (!enemy || isOutOfAction(enemy)) return advanceTurn(get, set);
  // Re-test du prédicat de contrôle À L'ENTRÉE : `maybeRunEnemyTurn` (l.5318) l'a évalué AVANT de
  // différer par `scheduleCombatTimer`, et `setGmSeat` (`netFlow.ts`) n'attend aucune fenêtre de combat —
  // un siège MJ pris entre la planification et le tir rend cet acteur conduit à la MAIN. On rend la main
  // sans jouer : le MJ le pilote via l'UI (`controlsCombatant`), l'IA n'a plus à décider pour lui.
  if (!aiDriven(get(), enemy)) return;
  // JETON DE TOUR (#1852) — un tour se joue UNE fois, et seulement quand c'est celui de son porteur :
  //  - un beat armé avant que le tour ne tourne tirerait un tour HORS de son rang (ordre d'initiative) ;
  //  - une fenêtre ouverte tient la main (`combatAdvanceBlocked`) : l'IA n'a rien à décider par-dessus ;
  //  - un second appel pour le MÊME « round:turn:id » est un DOUBLON.
  // Le refus est SILENCIEUX : ce n'est pas une violation d'invariant, c'est un appel qui arrive trop
  // tard (ou deux fois) — le tour, lui, reste porté par celui qui l'a joué.
  if (activeCombatant(battle)?.id !== enemyId) return;
  if (combatAdvanceBlocked(get())) return;
  const cleTour = cleDeTour(battle, enemyId);
  if (battle.aiTurnPlayed === cleTour) return;
  battle.aiTurnPlayed = cleTour;
  // Couche MER (navire-unité) : une coque IA agit en UNITÉ via des Tests d'équipage (manœuvre/bordée), pas comme
  // une créature (ni psychologie, ni marche de fantassin). Branche DÉDIÉE — `chooseEnemyAction` n'a aucun candidat naval.
  if (isVehicle(enemy)) return runShipAI(get, set, enemy);
  // Cycle de tour ennemi (LDB 21/85) en hooks `turnStart` ordonnés (state/combat/turnHooks) : fin de
  // Frénésie 10 → Rage 20 → tentative de Frénésie IA 30 → psychologie 40. La dépendance d'ordre RAW
  // (Frénésie/Rage AVANT la psychologie — la Frénésie en rend immunisé) est encodée par les `order`.
  // Ces hooks journalisent eux-mêmes (kinds `frenzy`/`fear`) ; `sink` n'est pas utilisé par eux.
  // Unique porte (#316) : émission via le bus. `self: enemy` alimente les hooks (Rage) ; `audience: []`
  // SUPPRIME la diffusion data ICI (l'`onTurnStart` DATA est diffusé par `fireTurnStartTriggers`, non
  // dupliqué) → STRICTEMENT équivalent à l'ancien `runCombatHooks('onTurnStart', …)`.
  emitCombatEvent('onTurnStart', { get, set, battle: get().battle!, self: enemy, audience: [], sink: (line, c) => { get().battle!.log.push(ev('detail', line, c?.id)); } });
  // Stupide (LDB 85 l.335) : sans allié non-Stupide à ses côtés (adjacent), Test d'Intelligence Facile
  // (+40) au début du Round ; sur un échec, elle perd son Mouvement ET son Action. RESTE INLINE (pas un
  // hook) : c'est un CONTRÔLE DE FLUX (`return advanceTurn` saute le tour) — un hook `run(ctx):void` ne
  // peut pas exprimer « sauter le tour ». Il s'exécute APRÈS le dispatch `turnStart`, avant l'action IA.
  if (isStupid(enemy.traits) && enemy.pos) {
    const guided = battle.combatants.some(
      (a) => a.kind === enemy.kind && a.id !== enemy.id && !isOutOfAction(a) && !isStupid(a.traits) && a.pos && chebyshev(a.pos, enemy.pos!) <= 1,
    );
    if (!guided && !rollSansPilote(get, enemy, effectiveChar(enemy, 'intelligence'), 'facile', battleRng()).success) {
      battle.log.push(ev('detail', tr('cf.stupid', { name: enemy.label }), enemy.id));
      set({ battle: { ...battle } });
      return advanceTurn(get, set);
    }
  }

  // Cible = camp OPPOSÉ à l'acteur : un ennemi vise les héros (inchangé) ; un héros auto-piloté (Auto-combat)
  // vise les ennemis. Les helpers Frénésie/psy ci-dessus s'appliquent à tout combattant piloté par l'IA
  // (`aiDriven`) — dont un héros auto ; Rage/Stupide restent gardés par leurs traits.
  const foeKind = enemy.kind === 'enemy' ? 'hero' : 'enemy';
  const heroes = battle.combatants.filter((c) => c.kind === foeKind && !isOutOfAction(c));
  if (heroes.length === 0) {
    // Aucun adversaire vivant mais le combat continue (`victoryCondition` non authorable atteinte,
    // ex. structure encore intacte) : `checkBattleOver` ne termine PAS forcément le combat → il n'y a
    // rien à jouer ce tour (aucune cible), mais le tour DOIT quand même se clore, sinon l'IA reste
    // bloquée indéfiniment (soft-lock). Si `checkBattleOver` a terminé/suspendu le combat
    // (victoire/défaite/cascade), ne pas avancer par-dessus.
    if (checkBattleOver(get, set)) return;
    return advanceTurn(get, set);
  }
  // Combat monté (LDB 14) : un PNJ à pied, non Engagé, adjacent à une monture LIBRE de son camp décide
  // de l'enfourcher (aucun jet → simple Mouvement ; il pourra ensuite ATTAQUER, mais pas se déplacer en plus).
  let justMounted = false;
  if (!enemy.mountId && !isEngaged(enemy) && canTakeAction(enemy)) {
    const freeMount = mountableNear(battle, enemy);
    if (freeMount) {
      mountUp(enemy, freeMount);
      justMounted = true;
      battle.log.push(ev('move', tr('cs.mount', { name: enemy.label, mount: freeMount.label }), enemy.id));
      set({ battle: { ...battle } });
      bus.emit(EVT.SCENE_DIRTY);
    }
  }
  // Sélection de loadout (avant de bâtir l'entrée IA) : dégaine l'arme à distance hors de portée de mêlée,
  // l'arme de mêlée au contact — pour que `buildAiInput` voie le bon `weapons` (le tireur tire sa fronde).
  aiSelectLoadout(set, enemy, battle);
  // Combat monté (LDB 14 l.179) : géométrie porteuse (monture) pour le déplacement réel — empreinte +
  // chemin ; le couple est solidaire (positions synchronisées à l'exécution du « move »).
  const geom = mountOf(battle, enemy) ?? enemy;
  // Entrée de l'IA MUTUALISÉE (sorts résolus + escouade/orientation/perception/mouvement/vol/blocage).
  // « Vient d'enfourcher » → Mouvement consommé ce tour (l'IA a seulement son Action).
  let input = buildAiInput(enemy, get);
  if (justMounted) input.movement = 0;
  let action = chooseEnemyAction(input);
  // Dépense PROACTIVE de Détermination (LDB 17 l.57-61) : si l'IA décide de se DÉVERROUILLER (action
  // `spendResource`, ex. Brisé), on dépense la Détermination via l'action store `spendResolveCondition`
  // (coop-safe, hôte-autoritaire, ne consomme PAS l'Action — retire 1 pion/dépense) PUIS on RE-CHOISIT
  // l'action, le tout AVANT le dispatch, pour que l'acteur DÉVERROUILLÉ joue sa vraie action (melee/cast/
  // move) le MÊME tour — sans ré-armer les hooks de début de tour. Borne anti-boucle STRICTE : 1 pion par
  // tour ; on s'arrête si la dépense est sans effet (état inchangé) ou après les pions initiaux (safety).
  // ... et MÊME boucle pour « Briser l'Empoignade » (LDB 14 l.161) : Briser est GRATUIT (par le Mouvement) et
  // n'épuise PAS l'Action → l'ennemi libéré RE-DÉCIDE et joue sa vraie action (tir/cast/charge) le même tour.
  // Multi-Empoignade : chaque tour de boucle dénoue UN lien ; `grapplingWith` se vide → la garde ne re-fire plus.
  for (let safety = 8; safety > 0; safety--) {
    if (action.kind === 'spendResource') {
      const before = stacks(enemy, action.id);
      get().spendResolveCondition(enemy.id, action.id);
      if (stacks(enemy, action.id) >= before) break; // dépense inopérante → on n'insiste pas (anti-boucle dure)
    } else if (action.kind === 'grapple' && action.resolution === 'break') {
      const targetId = action.targetId; // capture AVANT la closure (narrowing perdu sur un `let` réassigné)
      const foe = inBattleId(battle, targetId);
      if (!foe) break;
      clearGrapple(enemy, foe);
      removeCondition(enemy, COND.empetre, stacks(enemy, COND.empetre)); // se défait de l'*Empêtré* lié (LDB 14 l.161)
      battle.log.push(ev('dodge', tr('cs.grappleBreak', { name: enemy.label, foe: foe.label }), enemy.id, foe.id));
      set({ battle: { ...battle } });
      bus.emit(EVT.SCENE_DIRTY);
    } else break;
    input = buildAiInput(enemy, get);
    if (justMounted) input.movement = 0;
    action = chooseEnemyAction(input);
  }
  // TRACE IA (DEV) : SEUL site d'enregistrement → `consumeAiRanking` vide le classement de l'appel qui
  // précède immédiatement (pas de pollution par aiApproachPlan/peek de Frénésie). `top` vide si flag off.
  AI_TURN_LOG.push({ round: battle.round, id: enemy.id, label: enemy.label, action: describeAiAction(action), top: consumeAiRanking() });
  if (AI_TURN_LOG.length > 400) AI_TURN_LOG.shift();
  const targetOf = (id: string) => inBattleId(battle, id)!;
  const canAct = canTakeAction(enemy); // Sonné : pas d'Action — déplacement seul (LDB 16 l.125)

  // Attaque (mêlée ou tir, selon l'arme active) puis fin de tour — cadence préservée.
  const attackThenAdvance = (target: Combatant, delay: number = TEMPO.aimTelegraph) => {
    // Télégraphe (réticule + ligne — PLEINE en mêlée, pointillée au tir) pendant la pré-attaque :
    // même affordance que la visée du joueur, des deux côtés.
    const aimKind = firedWeapon(enemy, target).type === 'ranged' ? 'ranged' : enemy.chargedThisTurn ? 'charge' : 'melee';
    set({ actorAim: { fromId: enemy.id, toId: target.id, kind: aimKind } });
    bus.emit(EVT.SCENE_DIRTY);
    scheduleCombatTimer(() => {
      const b = get().battle;
      // Tour caduc (combat fini OU relancé pendant le télégraphe → `enemy` hors du combat courant).
      if (!b || b.over || !b.combatants.includes(enemy)) { clearActorAim(get, set); return; }
      // QUELQU'UN TIENT LA MAIN pendant le télégraphe (#1852) : une riposte `onCharged` du chargé
      // (Frappe réactive, LDB 10 l.496-500) a ouvert SA fenêtre sur ce chargeur SURFACÉ, ou une pause
      // de Round s'est posée. La frappe ne part pas par-dessus — LDB 85 l.41-43 : chaque Test d'attaque
      // se résout entièrement, fenêtre du défenseur comprise. Le tour, qui n'a rien consommé
      // (`battle.acted` faux), repart à la fermeture de la séquence : `resumeSuspendedAI` rend le jeton
      // et rappelle `maybeRunEnemyTurn`.
      if (combatAdvanceBlocked(get())) { clearActorAim(get, set); return; }
      // Attaque-ACTION spéciale (Regard pétrifiant / Étreinte glaciale) à la place de l'attaque
      // normale si la créature en a le trait + l'Avantage ; sinon attaque normale (opposée). Une manœuvre
      // spéciale qui touche des HÉROS ouvre une cascade de défense influençable → tour SUSPENDU (reprise
      // via `resumeManeuverDefense` à la fermeture), détectée par `maneuverCascadePending`.
      const suspended = aiMaybeSpecialAction(get, set, enemy) ? maneuverCascadePending(get) : doAttack(get, set, enemy, target);
      // Si la modale de défense s'ouvre, ne PAS armer advanceTurn ici : la reprise
      // est portée par defenseConfirm → resumeEnemyTurn (anti double-advance).
      if (!suspended) {
        // Attaques GRATUITES après l'attaque principale : d'Arme « disponibles » (Frénésie LDB 21 l.33 =
        // seule source en donnée) puis de créature (Morsure/Caudale/Piétinement, OPPOSÉES). La file
        // s'arrête à la première fenêtre ouverte ; ne PAS avancer alors (reprise via defenseConfirm).
        if (!drainerLesGratuites(get, set, enemy, { disponibles: true })) scheduleCombatTimer(() => advanceTurn(get, set), beatHold(get, 'postAttack'));
      }
    }, delay);
  };

  // Combat monté (LDB 14 l.182) : une monture MONTÉE est dirigée par son cavalier — elle ne se déplace
  // pas seule (le couple bouge au tour du cavalier). Sans le Trait Nerveux, elle peut consacrer SA propre
  // Action à attaquer un adversaire au contact ; sinon elle passe son tour.
  if (enemy.riderId) {
    const skittish = isSkittishMount(enemy.traits); // Nerveux (LDB 14 l.182) → la monture passe son tour
    const foe = skittish || !canAct ? undefined
      : battle.combatants.find((c) => c.kind !== enemy.kind && !isOutOfAction(c) && !!c.pos && combatDistance(enemy, c) <= meleeReachTiles(enemy.weapons));
    if (foe) { attackThenAdvance(foe); return; }
    return advanceTurn(get, set);
  }

  // Sonné : l'ennemi ne peut pas agir → il renonce à son Action (l'éventuel déplacement
  // a déjà été réduit de moitié via effectiveMovement). Le « move » plus bas garde son
  // déplacement mais n'attaque pas en arrivant.
  switch (action.kind) {
    case 'end':
      return advanceTurn(get, set);
    case 'spendResource':
      // La boucle de dépense ci-dessus n'a PAS pu déverrouiller (dépense inopérante — l'acteur reste
      // verrouillé) : il n'a aucune autre action légale ce tour → il passe la main (terminal anti-boucle).
      return advanceTurn(get, set);
    case 'cast': {
      if (!canAct) return advanceTurn(get, set);
      const ctgt = targetOf(action.targetId);
      // Télégraphe d'incantation (parité tir) : ligne pointillée + réticule ~0,7 s avant le jet.
      set({ actorAim: { fromId: enemy.id, toId: ctgt.id, kind: 'cast' } });
      bus.emit(EVT.SCENE_DIRTY);
      scheduleCombatTimer(() => {
        const b = get().battle;
        if (!b || b.over) { clearActorAim(get, set); return; }
        castSpell(get, set, enemy, ctgt, action.spell);
        // La modale d'incantation témoin (Lancer → Contre-sort → Appliquer) SUSPEND le tour de
        // l'IA : la reprise est portée par castConfirm/castCancel → resumeEnemyTurn (anti
        // double-advance, même pattern que la défense). castSpell peut refuser (contrecoup
        // bloquant, hors de portée…) → pas de modale → l'ennemi passe.
        if (!get().pendingCast) { clearActorAim(get, set); scheduleCombatTimer(() => advanceTurn(get, set), beatHold(get, 'enemyAdvance')); }
      }, TEMPO.aimTelegraph);
      return;
    }
    case 'selfManeuver': {
      // Capacité SUR SOI (forme de combat lycanthrope, op transform) : résolution IMMÉDIATE sur le porteur
      // (aucune cible adverse ni jet d'attaquant). Coûte l'Action ; la 2ᵉ vient du `loseTurn` de ses effets.
      if (!canAct) return advanceTurn(get, set);
      const def = selfManeuversOf(enemy).find((m) => m.id === action.maneuverId);
      if (!def || !selfManeuverApplicable(enemy, def)) return advanceTurn(get, set);
      resolveManeuver(get, set, enemy, def, 0, null, 0, enemy); // cible = soi
      set({ battle: markActed(get, set, get().battle!) });
      checkBattleOver(get, set);
      scheduleCombatTimer(() => advanceTurn(get, set), beatHold(get, 'enemyAdvance'));
      return;
    }
    case 'castArea': {
      if (!canAct) return advanceTurn(get, set);
      // Sort de ZONE (ZdE, LDB 47 l.28) d'un lanceur IA : MÊME drive que le missile (`case 'cast'`) — la
      // seule spécificité est de PORTER le centre décidé par l'IA pure (`action.center`, sur un paquet de
      // héros) dans `pendingCast.zone.autoCenter`. Ce centre est l'ÉQUIVALENT du curseur souris d'un héros :
      // le `castConfirm` PARTAGÉ le lira pour poser la zone tout seul (gardé par `aiDriven`), exactement
      // comme l'auto-combat fournit ses jets. PLUS de `castCommitZone` bespoke ici : la pose vit dans le
      // `castConfirm` UNIQUE. PARITÉ RAW (LDB 46 l.156) : la fenêtre de Contre-sort s'intercale AVANT la
      // pose (`routeCounterspell`, appelé par `castRoll`) ; dissipée → `castConfirm` ne pose RIEN.
      const center = action.center;
      // Télégraphe de ZONE (parité missile) : peint le DISQUE cible (centre + rayon) ~0,7 s avant la
      // résolution, au lieu de l'ancien `actorAim` dégénéré (ligne enemy→enemy, n'indiquait PAS l'aire).
      // Rayon = celui du sort CHOISI (forme `area` portée par `input.spells`), repli sur `zdeRadiusTiles`.
      const chosenAoe = input.spells.find((s) => s.id === action.spell);
      const aoeSp = resolveSpell(action.spell);
      const aoeRadius = (chosenAoe && typeof chosenAoe.shape === 'object' ? chosenAoe.shape.area.radius : undefined)
        ?? (aoeSp ? zdeRadiusTiles(aoeSp.target, enemy) ?? 1 : 1);
      set({ actorAoe: { casterId: enemy.id, center, radius: aoeRadius } });
      bus.emit(EVT.SCENE_DIRTY);
      scheduleCombatTimer(() => {
        set({ actorAoe: null });
        const b = get().battle;
        if (!b || b.over || !b.combatants.includes(enemy)) return;
        if (!castZoneSpell(get, set, enemy, action.spell)) { advanceTurn(get, set); return; } // pas une zone chiffrable → passe
        const pc = get().pendingCast;
        if (!pc) { resumeEnemyTurn(get, set); return; } // refus (contrecoup bloquant) — castZoneSpell a journalisé
        // Porte le centre auto-choisi sur le pending (zone non encore posée, `center` reste null pour que le
        // Contre-sort s'intercale) — `castConfirm` PARTAGÉ posera la zone dessus une fois la fenêtre close.
        if (pc.zone) set({ pendingCast: { ...pc, zone: { ...pc.zone, autoCenter: center } } });
        // Jet figé de l'IA (Surincantation no-op pour une ZdE — toutes cibles arrosées) ; `castRoll`
        // aiguille le Contre-sort : fenêtre ouverte → le tour de l'IA est SUSPENDU, repris par
        // counterspellConfirm/Cancel (→ resolveCastChain : pose & reprise).
        get().castRoll();
        if (get().pendingCounterspell) return;
        // Aucun Contre-sort : MÊME résolveur PARTAGÉ que le missile — castConfirm pose la zone sur autoCenter
        // (caster aiDriven) puis reprend le tour de l'IA. Zéro chemin spécial.
        get().castConfirm();
      }, TEMPO.aimTelegraph);
      return;
    }
    case 'focus': {
      // Focalisation (LDB 46) : on ouvre la modale comme le joueur ; en Auto le driver résout
      // focusRoll→focusConfirm (qui reprend le tour via aiDriven, cf. focusConfirm). Calqué sur reload.
      if (!canAct) return advanceTurn(get, set);
      get().battleFocusSpell(action.spell);
      if (!get().pendingFocus) advanceTurn(get, set);
      return;
    }
    case 'shoot': {
      if (!canAct) return advanceTurn(get, set);
      // Le télégraphe (réticule + ligne pointillée ~0,85 s) est porté par attackThenAdvance — même
      // affordance « qui va être frappé » que la mêlée et le sort (plus de double télégraphe).
      attackThenAdvance(targetOf(action.targetId));
      return;
    }
    case 'reload': {
      // Recharge (Test étendu de Projectiles, LDB 62 l.335) : résolution INLINE (pas de modale ni de Chance —
      // l'IA n'en a pas), MÊME cumul de DR vers l'Indice que le flux joueur (reloadConfirm). Interrompu →
      // recommence à zéro (géré à la prise de Blessure, applyAttackResult). Coûte l'Action ; calque de `recover`.
      if (!canAct) return advanceTurn(get, set);
      const rw = enemy.weapons.find((w) => w.type === 'ranged');
      if (!rw || (rw.reload ?? 0) <= 0 || weaponLoaded(enemy, rw)) return advanceTurn(get, set); // rien à recharger
      const reloadTarget = reloadDRTarget(rw);
      const progressBefore = reloadProgressOf(enemy, rw);
      const skillValue = combatValue(enemy, 'ranged', rw); // CT + avances Projectiles
      const test = rollSansPilote(get, enemy, skillValue, 'intermediaire', battleRng());
      const drBonus = test.success ? reloadDRBonus(enemy, rw) : 0; // Rechargement rapide / Artilleur (LDB 10)
      const progress = Math.max(0, progressBefore + test.sl + drBonus); // Test étendu : cumul, plancher 0
      if (progress >= reloadTarget) loadWeapon(enemy, rw); // MÊME couture que le flux joueur : état de charge + munition capturée
      else setReloadProgress(enemy, rw, progress);
      // ISSUE dérivée par le MÊME goulot que le flux joueur (`FLOWS.reload.apply`, canal COMBAT) : la voie
      // IA n'ouvre aucune fenêtre, elle FOURNIT son pending — même déclaration, même ligne.
      const pr: PendingReload = { actorId: enemy.id, actorName: enemy.label, weaponUid: rw.uid ?? '', reload: reloadTarget, progressBefore, skillValue, difficulty: 'intermediaire', roll: test.roll, target: test.target, sl: test.sl, success: test.success };
      const aiReloadIssue = FLOWS.reload.apply(get, { p: pr, ctx: { after: progress, weapon: rw.label } });
      set({ battle: { ...markActed(get, set, battle), log: [...battle.log, ...evLines(aiReloadIssue, 'reload', enemy.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      scheduleCombatTimer(() => advanceTurn(get, set), beatHold(get, 'afterMove'));
      return;
    }
    case 'melee':
      if (!canAct) return advanceTurn(get, set);
      attackThenAdvance(targetOf(action.targetId));
      return;
    case 'recover': {
      // Se libérer (Empêtré, Test opposé de Force, l.66) / se rouler (En flammes, Athlétisme, l.84).
      // Paramètres du Test lus de la DONNÉE (`EtatData.recover`) par la SOURCE UNIQUE `resolveRecoverTest`
      // (même résolution que le flux joueur). IA = résolution INSTANTANÉE (pas de modale ni de Chance). Coûte l'Action.
      if (!canAct) return advanceTurn(get, set);
      const rt = resolveRecoverTest(enemy, action.state, battle);
      if (!rt) return advanceTurn(get, set); // État non récupérable par Action (pas de `recover` en donnée)
      let success: boolean, netSL: number;
      if (rt.opposition) {
        // LDB 12 l.160 : les DEUX camps portent leur nue (`RecoverOpposition` les porte ENSEMBLE), comme la voie joueur (`FLOWS.recover`) — mêmes accesseurs.
        // Difficultés ASYMÉTRIQUES (LDB 12 l.166) : l'acteur honore `rec.difficulty` (donnée), l'entrave
        // roule `intermediaire` — MÊME choix qu'au flux joueur (`FLOWS.recover`), verrouillé par
        // `combat/ai-recover-departage-nue.test`.
        const opp = opposedTest(rt.skillValue, rt.opposition.value, battleRng(), rt.difficulty, 'intermediaire', {
          attacker: rt.skillBase, defender: rt.opposition.base,
        });
        success = opp.attackerWins; netSL = opp.netSL;
      } else {
        const t = rollSansPilote(get, enemy, rt.skillValue, rt.difficulty, battleRng());
        netSL = Math.max(0, t.sl);
        success = rt.requireSl != null ? t.success && netSL >= rt.requireSl : t.success; // Filets (Zoo Impérial p.29) : DR ≥ Indice
      }
      // Filets barbelés (Zoo Impérial p.29) : Dégâts ignorant l'armure à CHAQUE tentative, réussie ou ratée.
      const struggleLines: string[] = rt.struggleDamage != null
        ? applyOps(enemy, [{ op: 'wounds', amount: rt.struggleDamage, ignoreTB: false }], { caster: enemy })
        : [];
      const removed = recoveredStacks(netSL, stacks(enemy, action.state), success);
      if (removed > 0) removeCondition(enemy, action.state, removed);
      // Filets (Zoo Impérial p.29) : un échec de libération AGGRAVE l'Empêtré (≠ Immobilisante générique).
      if (!success && rt.entangleOnFail) addCondition(enemy, action.state, 1);
      const line = removed > 0
        ? (action.state === COND.empetre ? tr('cf.enemyFreed', { name: enemy.label, removed }) : tr('cf.enemyDouses', { name: enemy.label, removed }))
        : (action.state === COND.empetre ? tr('cf.enemyStaysEmpetre', { name: enemy.label }) : tr('cf.enemyStaysFlames', { name: enemy.label }));
      set({ battle: { ...battle, log: [...battle.log, ...struggleLines.map((l) => ev('condition', l, enemy.id)), ev('condition', line, enemy.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      scheduleCombatTimer(() => advanceTurn(get, set), beatHold(get, 'afterMove'));
      return;
    }
    case 'grapple': {
      // Empoignade (LDB 14 l.161) : l'Action d'un Empoigné = Test opposé de FORCE (le « Briser » a déjà été
      // résolu en amont par la boucle de re-décision, comme `spendResource`). Résolution INSTANTANÉE (pas de
      // modale ni de Chance) — calque du `recover` ; le `resolveGrappleWin` PARTAGÉ applique l'issue (joueur+IA).
      if (!canAct) return advanceTurn(get, set);
      const foe = targetOf(action.targetId);
      if (!foe || isOutOfAction(foe) || !areGrappling(enemy, foe)) return advanceTurn(get, set); // lien dénoué entre-temps
      // Politique IA : l'option DÉGÂTS (BF + DR, PA ignorés) — meilleure valeur garantie pour une créature qui
      // l'emporte (les options Empêtrer/Se libérer restent en DONNÉE, offertes au joueur). Test opposé PARTAGÉ
      // avec l'Attaque gratuite de tentacule/langue (`resolveGrappleOpposed`) ; ici il CONSOMME l'Action (l.161).
      const line = resolveGrappleOpposed(get, enemy, foe);
      set({ battle: { ...markActed(get, set, battle), action: null, log: [...battle.log, ev('attack', line, enemy.id, foe.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      checkBattleOver(get, set);
      scheduleCombatTimer(() => advanceTurn(get, set), beatHold(get, 'postAttack'));
      return;
    }
    case 'manPoste': {
      // « Servir cette pièce » (MDG 12) : rejoindre un poste de siège adjacent (chef si non servi, sinon support) —
      // MÊME mutation KIND-AGNOSTIQUE (`serveAtPoste`) que l'action joueur et l'author-time. Coûte l'Action. Re-garde
      // la staleness : disparu, ou déjà rejoint pendant la décision → passe la main (pas de double-ajout).
      if (!canAct) return advanceTurn(get, set);
      const hull = inBattleId(battle, action.hullId);
      const poste = hull?.postes?.find((p) => p.item.uid === action.posteUid);
      if (!poste || (poste.crewIds ?? []).includes(enemy.id)) return advanceTurn(get, set);
      serveAtPoste(enemy, poste, battle.combatants);
      set({ battle: { ...markActed(get, set, battle), action: null, log: [...battle.log, ev('detail', tr('cs.manPoste', { name: enemy.label, weapon: poste.item.label }), enemy.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      scheduleCombatTimer(() => advanceTurn(get, set), beatHold(get, 'afterMove'));
      return;
    }
    case 'move': {
      // Simplification IA assumée (sévérité mineure, relevée par la revue de fidélité) :
      //  • l'IA ne fait JAMAIS de Désengagement (option joueur, LDB 15 l.43-49) : un
      //    ennemi Engagé qui se repositionne ne paie pas l'Esquive/le sacrifice d'Avantage.
      // PARITÉ d'approche (LDB 15 l.35-41) : Charge à portée de Course si la Marche ne suffit pas,
      // sinon Course (Test d'Athlétisme instantané, pas d'attaque ce tour) — cf. aiApproachPlan.
      const { plan, ran } = aiApproachPlan(input, geom, action, battleRng());
      const mv = plan.kind === 'move' ? plan : action;
      if (ran) battle.log.push(ev('move', tr('cf.enemyRun', { name: enemy.label, skill: enemy.mountId ? tr('cf.skillRide') : tr('cf.skillAthletics'), roll: ran.roll === 100 ? '00' : ran.roll, budget: ran.budget }), enemy.id));
      const wasEngaged = isEngaged(enemy);
      const distBefore = combatDistance(enemy, targetOf(mv.thenTargetId)); // distance de combat AVANT le déplacement
      const fromPos = { ...enemy.pos! }; // position AVANT déplacement (déclenchement de Peur à l'approche)
      const path = pathTo(scene, enemy.pos!, mv.to, { blocked: input.blocked, foot: sizeFootprint(geom.size), traverse: input.traverse });
      // Télégraphe de DÉPLACEMENT (parité héros) : montrer le chemin + la destination AVANT que l'ennemi
      // bouge (« où il va »), puis il glisse dessus. Le mouvement réel + la suite (attaque/fin de tour)
      // sont DIFFÉRÉS après la tenue (beatHold moveTelegraph) — mêmes effets, juste annoncés d'abord.
      set({ actorMove: { id: enemy.id, path: path ?? [{ ...mv.to }] }, battle: { ...battle } });
      bus.emit(EVT.SCENE_DIRTY);
      scheduleCombatTimer(() => {
        set({ actorMove: null }); // toujours retirer le télégraphe (même si le tour est devenu caduc)
        const b = get().battle;
        // Tour caduc (combat fini OU combat/scène relancé pendant le télégraphe → `enemy` n'appartient
        // plus au combat courant) : abandonner SANS muter, sinon on réécrirait l'ancien combat.
        if (!b || b.over || !b.combatants.includes(enemy)) return;
        placeCombatant(enemy, get().scene, mv.to);
        if (geom !== enemy) placeCombatant(geom, get().scene, mv.to); // Combat monté : la monture suit le cavalier (couple solidaire)
        displaceSmaller(get, geom); // un grand « dégage » les plus petits sous son empreinte (85 l.373-374)
        get().faceFromPath(enemy.id, path);
        if (geom !== enemy) get().faceFromPath(geom.id, path);
        bus.emit(EVT.ANIM_MOVE, { id: enemy.id, path });
        if (geom !== enemy) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path });
        applyZoneCrossings(get, set, enemy, path ?? [{ ...mv.to }]); // Mur de feu & co (L11) : traverser coûte
        // Grimpant (LDB 85 l.160-162) : le pathing IA franchit une arête `WallSeg.climb` SANS Test —
        // pas un jet silencieux, journalisé comme le geste joueur `climbAcross` (#504, MÊME clé i18n).
        if (path && path.some((p, i) => i > 0 && climbEdgeBetween(scene, path[i - 1], p)?.climb)) {
          battle.log.push(ev('move', tr('climb.auto', { name: enemy.label }), enemy.id));
        }
        // #527 : l'approche IA doit se TRACER comme le Mouvement joueur (BFS à pas uniforme, `pathTo` — même
        // coût que `battleClickTile`/`stepCost`) sinon un gate qui exige `movementUsed === 0` (Se cabrer,
        // LDB 85 l.314) laisse passer approche + piétinement-gratuit du même tour.
        battle.movementUsed = (battle.movementUsed ?? 0) + Math.max(0, (path?.length ?? 1) - 1);
        approachFearTrigger(get, set, enemy, fromPos); // LDB 21 l.27 : source de Peur qui s'approche → Test de Calme ou Brisé
        set({ battle: { ...battle } });
        bus.emit(EVT.SCENE_DIRTY);
        const tgt = targetOf(mv.thenTargetId);
        // La Course a consommé l'Action (LDB 15 l.41) → pas d'attaque en arrivant.
        if (!ran && canAct && combatDistance(enemy, tgt) <= meleeReachTiles(enemy.weapons)) {
          // Charge de l'IA : se ruer au contact depuis une position non-Engagée donne l'Avantage (LDB 15 l.35-37).
          if (!wasEngaged) {
            const adv = chargeAdvantage(effectiveMovement(geom), distBefore);
            if (adv) {
              campGain(get, enemy, adv);
              enemy.gainedAdvThisRound = true;
              enemy.chargedThisTurn = true; // Charge → Attaque gratuite de Cornes (LDB 85), résolue par aiCreatureFreeAttacks
              // Effets `onCharged` NON-attaque-gratuite (donnée : Trait/État/Talent) → dispatcher générique
              // via le bus. Les Flows `grantFreeAttack` restent inertes ici (voie pure `applyTriggeredEffects`,
              // cf. ~2554) — pas de double frappe : la Frappe réactive part de `resolveFreeAttacks` ci-dessous.
              const chargedLines: string[] = [];
              emitCombatEvent('onCharged', { get, set, battle, self: tgt, sink: (line) => chargedLines.push(line), triggerCtx: { victim: enemy, rng: battleRng() } });
              if (chargedLines.length) set({ battle: { ...get().battle!, log: [...get().battle!.log, ...evLines(chargedLines, 'condition', tgt.id)] } });
              // Frappe réactive (LDB 10) : la cible CHARGÉE peut riposter HORS séquence (Test d'Init) avant
              // l'attaque du chargeur — talent d'attaque déclenchée en donnée (`grantFreeAttack onCharged`).
              resolveFreeAttacks(get, set, tgt, 'onCharged', enemy);
            }
          }
          attackThenAdvance(tgt, Math.max(TEMPO.preAttack, approachMs(get, path)));
        } else afterApproach(get, path, () => advanceTurn(get, set));
      }, beatHold(get, 'moveTelegraph'));
      return;
    }
  }
}


