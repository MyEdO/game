/**
 * Actions de COMBAT du jeu (#2817 D5) — `createCombatSlice(get, set)`, fabrique du noyau : clic de
 * combat (`cliquerLeCombattant`, `cliquerLaCaseDuCombat`), attaque, défense et cascade, désengagement, monture, fin de tour, pause de
 * Round, Destin, magie de combat. Le propriétaire de l'état l'étale parmi ses actions.
 */
import type { Get, Set } from './flowTypes';
import { tickCombatAuto } from './combatAuto';
import type { Jeu, BattleState, ShootingStanceKey } from './etat';
import { ACTION_GATES, actionGate, armeADistanceParDefaut, etatDeLaBarre, refusDeLOffreHorsDuTour, type ContexteDOffre, type EtatDeLaBarre } from './actionRegistry';
import type { BattleActionMode } from '../data/schemas/defs/actions';
import type { CounterParticipant, CounterDeclaration, IssueDEmpoignade, SuiteDeCoup, PendingAttack, EnchainementDuCoup } from './pendings';
import { fleeBackstab, fleeTouche, fleeToucheDu } from './pendings';
import { SceneEntity, porteMasquee, structureIsDown } from './monde/scene';
import * as travelFlow from './travelFlow';
import { continueRestNights } from './restFlow';
import { continueRiverDayAfterCascade, continueRiverDayAfterExposure } from './riverVoyageFlow';
import { Combatant, CHAR_LABELS, type FireArc } from '../engine/types';
import { hostStep, pushDisplay, temoinSiSansJet } from './rollSeam';
import { rollLine, type RollLineParts } from './ligneDeJet';
import { toRecapLines } from './recapLine';
import { attaqueDeCle, type AttackKind, selfManeuversOf, selfManeuverApplicable } from '../engine/creatureAttacks';
import { battleRng } from './battleRng';
import { activeCombatant, jetDeRecharge, appliquerLaRecharge, advanceCombatJet, STANCE_BLOCK, firedWeapon, openAttackCascade, poserLeTestDeMain, poserLEtapeDAttaque, startDisengage, completeFlee, startAuContact, startGrapple, resolveGrappleWin, applyAttackResult, jouerLesTirsDeBordee, openSurfacedDefense, castSpell, applyCast, effectiveSpellOf, finishPlayerAction, applyMiscast, useSpellComponent, checkBattleOver, resumeEnemyTurn, poursuivreLaSerie, advanceTurn, resolveRoundBoundary, enterRoundStartPause, lancerLeRound, inFiringBand, maybeRunEnemyTurn, resumeSuspendedAI, resumeManeuverDefense, attackerFumbled, applyOups, jouerLApresCoup, ciblesDuBalayage, ciblesDeLaDoubleFrappe, resolveDualSecond, overcastTargetCandidates, overcastReset, drainerLesGratuites, attackWeaponOf, victimeDuCoup, applyWail, spellSightOf, castZoneSpell, castCommitZone, zoneRadiusTilesAt, routeCounterspell, applyCounterspellOutcome, applyCounterspellFallback, counterspellJoinable, counterspellDeclarePhase, counterspellRolls, resumeAfterCounterspell, openCastOppositionStep, castExtraTargets, resolveCastChain, applySurprise, resolveMovement, retenuParLaPeur, markActed, noteApproachMove, clearApproachMoves, frenzyTarget, finishCombatEnd, battleAreaTargets, siegeBlastRadiusTiles, startleOnStormAtCombatStart, stampEnvWeatherAtCombatStart, windsOfMagicAtCombatStart, releaseSeatsOfCombatants } from './combatFlow';
import { auContactEligible, grappleActionEligible, hasFreeWeaponAttack, resolveManeuver, availableAttacks, attaqueImmediate, startBattement, startDistraire, resolveBattement, resolveDistraire, battementFoes, distraireFoes, adversairesDuBattement, adversairesADistraire } from './combatManeuvers';
import { resolveWeaponArea } from './combatArea';
import { removeEntity, applyZoneCrossings, displaceSmaller } from './combatPlacement';
import { hasBattement, hasDistraire, dualStrikeDefensePenalty } from '../engine/combatFeatures/dispatch';
import { milieuDuVoyage } from '../engine/shipBuild';
import { losClear } from './monde/lineOfSight';
import { smokeOf, captureMoveSnapshot, formationDeCombat, moveEnv, campAuContact } from './monde/combatGeometry';
import { emitCombatEvent } from './combatEvents';
import { endTurnArmed, turnEconomyStamp, wastesAction } from './endTurnGuard';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import { EMPTY_FLOW, flowEffects } from '../engine/flowCore';
import { pickActiveModalKey } from './modalArbiter';
import { champAttendSaFenetre } from './targetingHolder';
import { refusActionDepensee, refusDeCourse, refusHorsDEtatDAgir } from './refusDuTour';
import { mountMovement, movementRemaining, mountUp, dismount, mountOf, mountablesNear, isControlledMount, insertByInitiative } from './mount';
import { heroCombatMount } from '../engine/mountTravel';
import { ev, evLines, journaliser } from './combatLog';
import type { FateSaveSource } from '../engine/fortune';
import { traceLineOf, testTraceLabel } from '../engine/traceLine';
import { libelleDeTest, libelleDuTestNomme } from './jetsEnVue';
import { courseArmee, intentionDuClic, intentionDuProprietaire } from './localIntent';
import { refuserGeste, refuserGesteDuSiege } from './refusVisible';
import { refuseSi } from './verrousDeFiche';
import { crochetDuSol, ramasserDuSol, ramasserHorsCombat } from './objetsAuSol';
import { nePeutPasDifferer, jouerFlowEntier, OPS_DIFFEREES, entityPickables, cleFeuilleRamassee, applyEffects, openSkillTest, drainPendingLog } from './combatEffects';
import { combatConditionCtx } from './combat/flowEval';
import type { MovementBlockReason } from './combatFlow';
import { t } from '../i18n';
import { backstabWeapon, attackHandGate, issueAuJet, coupAApplique } from '../engine/combat';
import { disengageFrom, isEngaged, setContact, clearContact, meleeReachRank } from '../engine/engagement';
import { clearGrapple } from '../engine/grapple';
import { applyOps } from '../engine/ops';
import { groupAdvantage, mirrorPools } from '../engine/advantagePool';
import { campGain, campSpend, startAdvantagePools } from './combat/advantagePool';
import { combatSubstitute, skillAdvantageCap } from '../engine/skillCombatApps';
import { byId } from '../data/index';
import { rule } from '../engine/policy';
import { isArcaneSpell, isMagicMissile, castBlockedBy, spellTargetCount, castAfterCrit, focusCriticalDR, consumeMalepierre, malepierreItemOf, castingNumberOf } from '../engine/magic';
import { domainSeaFocusCritMiscastMajeure } from '../engine/domainAttributes';
import { type OvercastAxis, overcastSourceOf, extraTargetCapacity, overcastDurationParts } from '../engine/overcast';
import { resolveOpposed, ligneSansJet, cibleMesuree } from '../engine/tests';
import { dispellableSpellsOn, dissipateSpell } from '../engine/dispel';
import { effectiveChar, bonus } from '../engine/characteristics';
import { spendResolveForPsychImmunity, calmeDeLAnimositeAcquise, ciblesDAnimositeAcquise } from '../engine/psychology';
import { recomputeLoadout, loadWeapon, unloadWeapon, choisirLaMunition, loadoutSetActive, loadoutLabel, mannedPosteWeapon } from '../engine/items';
import { objetDuNarratif, presetDuNarratif } from './monde/resolveursDuNarratif';
import { canPushback } from '../engine/qualities/dispatch';
import { talentFearIndice, hasCommandTeam, retreatAdvantageCost, keptAdvantageOnDisengage, hasFocusHarmony } from '../engine/combatFeatures/dispatch';
import { teamCommandTargets } from './monde/commandTeam';
import { isConsumable } from '../engine/consumables';
import { refusDeConsommer, runConsumable } from './consumableFlow';
import { effectiveMovement } from '../engine/encumbrance';
import { isOutOfAction, addCondition, removeCondition, canTakeAction, peutEntrerEnFrenesie, stacks, recoveredStacks, COND, releaseConditionLocks, raisonRefusDetermination, refusDeDetermination, fenetreDetermination, syncDerivedConditions, isConditionLocked, soinDeDetermination } from '../engine/conditions';
import { modesDOuverture, HEAL_MODES, raisonDeModeDeSoinEnCombat, resolveWoundsHeal, resolveBleedHeal, resolveExtractLodgedAmmo, applyHealWounds, soinDOuverture, refusDuTestDeSoin, difficulteDuSoin, actePanse, retirerUnBandage, IDS_DU_TEST_DE_SOIN } from '../engine/healing';
import { jetDuSoigneur, refusDesBandages, refusDuModeDuSoin, refusDuTestDuSoin } from './soin';
import { soinDeLActe } from './acteDeSoin';
import { hasWaterContainer, waterSprayCandidates } from '../engine/suffocation';
import { treatTrauma, receiveMedicalAid, poseDeterminationCanceller } from '../engine/trauma';
import { suspendSource } from '../engine/suspension';
import { entreeEnRencontre } from '../engine/persistence';
import { testValue, actorHasSkill, soutienDetail, type SupportDetail } from '../engine/skills';
import { spawnEnemy, placeCombatant } from './monde/spawn';
import { ficheDEntite } from './monde/sceneNpc';
import { applyShipPostes, autoFormCrews, shipOfCrew, servablePostes, serveAtPoste, leaveChef, isPosteManned, rechargeDuTour, posteDeLaBataille } from './monde/shipPostes';
import { pushEligible, pushCrewOk, pushReachable } from './siegePush';
import { applyShipManeuver, maneuverCrewTotal, deriveManeuverFromCrew } from './shipManeuver';
import { crewTestContributors, navigationDuNavire, shipCrewAssignments, shipMoraleScore, shipUndercrew, shipSaboteurDR, applyShantyToCrew, quartIndex, quartChante, chanteurDuNavire, withCrewActed, chansonsDuChanteur } from './shipCrew';
import { freeActFirst } from './turnEconomy';
import { preemptShooterIds } from './targeting';
import { resolveSteamSave, continueSeaDayAfterCascade, continueSeaDayAfterScorbut, continueSeaDayAfterExposure, continueSeaDayAfterExhaustion, runSeaDay, finalizePortArrival } from './seaVoyageFlow';
import { continueSeaActivitiesAfterCascade } from './seaActivities';
import { resolveCrewTestByRoles, crewTestSuccess, capToSuccesMinime, crewRoleValue } from '../engine/crewMorale';
import { knownShanties } from '../engine/combatFeatures/dispatch';
import { findSeaShantyById, conditionLabel, libelleOuAbsence } from '../data';
import { acquerirLeTrait } from './cibleAcquise';
import { findCrewTestTypeById, findCrewRoleById, findStructureById, combatStakeRef } from '../data';
import { structureCombatant } from '../engine/structures';
import { targetArc, headingToBear } from './monde/fireArc';
import { facingToward } from '../geometry/dir8';
import { bearingPostes, mostArmedSide } from './monde/shipBattery';
import { resolveVolley } from '../engine/volley';
import type { ShipManeuverParticipant } from './pendings';
import { estNavire } from '../engine/coque';
import { navalTestTypeDR, hullNavalTraits } from '../engine/navalTraits';
import { sceneZonesToBattle } from './monde/zones';
import { resetFields } from './stateFields';
import { seaMagicContext, touchActors } from './combatOrParty';
import { actorIn, inBattleId, porteurParId } from './monde/combatants';
import { refusDImmunite } from './determinationDuJet';
import { porteurDeLObjet } from './monde/carrier';
import { garanti } from '../lib/garanti';
import { armeDuJetDeRecharge, progresDeDissipation, progresDeFocalisation } from './progresEtendu';
import { aPorteeDe } from './monde/exploreNav';
import { aiDriven, controlsCombatant, influencesLocally, decidingSeat } from './netOwnership';
import { batteryBlock, currentTargetingMode, type BattleClickOpts, type OptionsDuClic } from './targetingModes';
import { resolveRecoverTest } from './combat/recover';
import { conjureFormOptions } from '../engine/conjuredWeapons';
import { declarationDuReglageNomme, type CorpsDesReglages } from './reglagesDuJet';
import type { ChoixDesFenetres, CorpsDesChoix } from './choixDesFenetres';
import { refusDeLaForme, refusDeLaPose, refusDuChoixCritique, refusDuPasDeSurincantation } from './fenetreDIncantation';
import { findSpellById } from '../data/index';
import { reachable, moveReachFor, tileKey, Pt } from './monde/path';
import { chebyshev } from '../engine/grid';
import { distanceDeCombat, distanceDeContact } from './monde/footprint';
import { combatOrder, rollInitiative } from './combatSetup';
import { isMerScene, sceneMetresPerTile } from './monde/scene';
import { bus, EVT } from './bus';
import { advanceCascade, maladresseCourante, finalizeCascade, setCascadeChoice, setCascadeAmount, suspendActiveCascade, resumeSuspendedCascade, poserCurseurCascade } from './cascade';
import { abandonSequence, closeSequenceRound, pasVersLAbandon } from './sequenceCore';
import { checkPartyWiped } from './partyWipe';
import { FLOWS, jetImmunise, rangeesAReglerIci, type CloturesDuJet } from './rollFlowSpecs';
import type { SortiesDeFenetre } from './sortieDeFenetre';
import type { ValidationsDeFenetre } from './validationDeFenetre';
import { actionsAuthorees } from './monde/usable';
import { testDeRegle } from '../engine/reglesChiffrees';
import { testDuCavalier } from '../engine/movement';

/** Un flux DIFFÉRÉ tient la main (modale de jet/révélation, ciblage par carte : Frappe Mortelle,
 *  2ᵉ frappe, Surincantation +Cible, pose de zone) :
 *  toutes les actions d'INTENTION de la hotbar sont inertes — on ne change pas d'action au milieu
 *  d'un jet. La console masque ses cases, mais ce garde-fou couvre AUSSI le clavier, les
 *  intents coop et la recette. (La PAUSE de début de Round, elle, est gatée à l'entrée UI —
 *  performClick d'IsoStage — pour rester neutre vis-à-vis des harnais de test sans UI.) */
/** La ligne du jet de Dissipation, figée à son ouverture sur sa valeur, Soutien « même Domaine » compris. LDB 46 l.158-162 */
const ligneDeDissipation = (lanceur: Combatant, value: number, soutien: SupportDetail): RollLineParts =>
  rollLine({ actor: lanceur, test: { skill: { id: 'langue', spec: 'magick' } }, difficulty: 'intermediaire', valeur: value, ...(soutien.bonus > 0 ? { soutien } : {}) });

const combatBusy = (s: Pick<Jeu, 'pendingCleave' | 'pendingDualStrike' | 'pendingCast'>): boolean =>
  !!(pickActiveModalKey(s) || s.pendingCleave || s.pendingDualStrike || s.pendingCast);

/** La barre d'un geste de combat hors des verbes de la barre (#3700) : son verdict (`etatDeLaBarre`), et un Sort qui
 *  désigne ses cibles ou pose sa zone (`pendingCast`), qu'elle ne compte pas, tient la main. */
function barreDuGeste(s: Jeu): EtatDeLaBarre {
  const barre = etatDeLaBarre(s);
  return barre.forme === 'ouverte' && s.pendingCast ? { forme: 'tenue', raison: t('barre.mainTenue') } : barre;
}

/** Le refus du geste de combat de l'acteur `acteurId` (#3700) : la barre (`barreDuGeste`), puis l'actif, dit par
 *  `horsDuTour`. `null` = admis. */
function refusDuTourDe(s: Jeu, acteurId: string, horsDuTour: string): string | null {
  const barre = barreDuGeste(s);
  return barre.forme !== 'ouverte' ? barre.raison : barre.active.id !== acteurId ? horsDuTour : null;
}

/** Le verdict de l'ENTRÉE du registre (`actionGate`) que ce commit exécute, lu au commit comme à l'offre.
 *  Refusé, il se dit par `refuserGesteDuSiege` quand l'acteur est piloté (`controlsCombatant`) : au siège
 *  local seulement, jamais chez l'hôte pour un invité. Un acteur de l'IA est refusé sans bandeau. `true` = refusé. */
function refuseParSonEntree(get: Get, set: Set, entree: string, active: Combatant, battle: BattleState, args?: ContexteDOffre): boolean {
  const verdict = actionGate(entree, { active, battle, netMode: get().net.mode, gameTime: get().gameTime, args });
  if (verdict.ok) return false;
  if (controlsCombatant(get(), active)) refuserGesteDuSiege(get, set, verdict.reason!);
  return true;
}

/** Animosité & Haine sur Destin dépensé (ADE II 09 l.15) : sur un Test de Calme raté (`calmeDeLAnimositeAcquise`), le
 *  Trait envers l'une des Cibles qu'offre le tueur `foeId` (`ciblesDAnimositeAcquise`, `acquerirLeTrait`) ; rend
 *  sa ligne de journal, `null` sans Trait posé d'office. */
function acquireAnimositeOnFate(get: Get, set: Set, hero: Combatant, foeId: string | undefined): string | null {
  const tueur = foeId === undefined ? undefined : porteurParId(get(), foeId);
  if (!tueur) return null;
  const calme = calmeDeLAnimositeAcquise(hero, battleRng());
  if (!calme || calme.success) return null;
  return acquerirLeTrait(get, set, hero, 'animosite', ciblesDAnimositeAcquise(hero, tueur));
}

/** Hors bataille, le Destin résolu rend la main à la série d'attaques subies ouverte (`poursuivreLaSerie`), qui l'attendait.
 *  LDB 17 l.29-32 ; MDG 15 l.163-164 */
function reprendreHorsBatailleApresLeDestin(get: Get, set: Set): void {
  set(touchActors(get()));
  if (get().serieSubie) jouerFlowEntier(poursuivreLaSerie(get, set));
}

/** La bataille reprend après le Destin : la limite de Round pour une mort lente, le tour adverse sinon. */
function reprendreApresLeDestin(get: Get, set: Set, source: FateSaveSource): void {
  if (source === 'slow') resolveRoundBoundary(get, set);
  else resumeEnemyTurn(get, set);
}

/** OUVERTURE partagée d'un Test d'équipage MULTI (MDG 14) : contributeurs par rôle (`crewTestContributors` —
 *  UN jet par poste, PJ interactifs, l.9/39/41), Moral, Manque de bras (l.55) et SABOTAGE (l.45-47) dérivés du
 *  navire. SOURCE UNIQUE des flux jumeaux (manœuvre / bordée) — le pending appelant y ajoute ses champs propres
 *  (turnSteps, targetId+side). `null` si aucun rôle tenu. */
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
  const navigation = navigationDuNavire(get, ship);
  const contributors = crewTestContributors(ship, battle.combatants, testTypeId, partyIds, navigation);
  if (!contributors.length) return null;
  const essentialRoleId = findCrewTestTypeById(testTypeId)?.essential.id;
  const participants: ShipManeuverParticipant[] = contributors.map((a) => {
    const role = findCrewRoleById(a.roleId);
    // LDB 09 l.30 ; #2588 Q1.
    const refus = role ? crewRoleValue(a.crew, role, navigation).refus : undefined;
    return temoinSiSansJet({
      id: a.crew.id,
      interactive: partyIds.has(a.crew.id),
      roleId: a.roleId,
      essential: a.roleId === essentialRoleId,
      navigation,
      cumul: (battle.crewActed?.[ship.id] ?? []).includes(a.crew.id), // déjà engagé dans un Test ce Round → cumul +2 crans (l.53)
      ...(refus != null ? ligneSansJet(refus) : { result: null }),
    });
  });
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
    ? shipCrewAssignments(ship, battle.combatants, 'batterie', navigationDuNavire(get, ship)).find((a) => a.roleId === 'artilleur' && partyIds.has(a.crew.id))?.crew
    : undefined;
  return chief
    ? t('cs.bordeeGunnersChief', { chief: chief.label, side, ship: ship.label })
    : t('cs.bordeeGunnersCrew', { side, ship: ship.label });
}

/**
 * APPLIQUE une bordée (MDG 14 l.128) — corps PARTAGÉ par le confirm JOUEUR (`jetValider('tirDeBatterie')`) ET l'auto-pilote
 * NAVIRE (`tirerLaBordee`). Chaque pièce du bord qui porte a fait feu : elle se décharge (LDB 62 l.335) ; chaque
 * coup, touché ou raté, passe ensuite par la couture du coup (`jouerLesTirsDeBordee` → `applyAttackResult`), qui
 * le résout selon sa cible et consomme la munition. NE touche PAS au pending ni à `crewActed`. Rend `true` quand
 * un coup a suspendu la résolution (ses suivants reprennent à la fermeture de sa fenêtre).
 */
function applyBatteryVolley(get: Get, set: Set, ship: Combatant, target: Combatant, side: FireArc, dr: number, success: boolean): boolean {
  const battle = get().battle;
  if (!battle) return false;
  const crew = (ship.crewIds ?? []).map((id) => inBattleId(battle, id)).filter((c): c is Combatant => !!c);
  const shots = resolveVolley(ship, bearingPostes(ship, side), dr, success, crew, battleRng(), { merScale: isMerScene(get().scene) });
  for (const s of shots) { // la PIÈCE a fait feu (l.128), touchée ou non
    const poste = ship.postes?.find((pp) => pp.item.uid === s.posteUid);
    if (poste) unloadWeapon(undefined, undefined, poste);
  }
  get().ecrireAuJournal(bordeeGunnersLine(get, ship, side)); // MDG 14 l.39
  const n = shots.length;
  const drTxt = dr >= 0 ? `+${dr}` : `${dr}`;
  get().ecrireAuJournal(success
    ? t('cs.bordee', { side, ship: ship.label, target: target.label, dr: drTxt, n })
    : t('cs.bordeeManque', { side, ship: ship.label, target: target.label, dr: drTxt, n }));
  return jouerLesTirsDeBordee(get, set, { targetId: target.id, actedAvant: get().battle!.acted, tirs: shots.map((s) => ({ tireurId: s.tireur.id, weapon: s.weapon, jet: s.jet })) });
}

/**
 * SURPRISE NAVALE (couche Mer) traduite en AVANTAGE DE POSITION — PAS de tour gratuit (une coque n'a ni Action ni
 * psychologie ; l'État Surpris LDB 16 ne s'y transpose pas → arbitrage sobre, maison). L'assaillant NON repéré a eu le
 * temps de se PLACER : chaque coque ambusher se rapproche à ~portée MOYENNE du canon (75 m, MDG 12 l.401) de sa
 * cible et vire pour amener son bord le plus armé EN BATTERIE. Repérés (Perception réussie, `noSurprise`) → non appelée :
 * placement authoré (~150 m, aucun avantage). Mute pos + facing.
 */
function applyNavalSurprisePosition(get: Get, set: Set, surprisedSide: 'groupe' | 'ennemis'): void {
  const { battle, scene } = get();
  if (!battle || !scene) return;
  const surprisedKind = surprisedSide === 'groupe' ? 'heros' : 'ennemi';
  const ambushers = battle.combatants.filter((c) => estNavire(c) && c.kind !== surprisedKind && c.pos);
  const victims = battle.combatants.filter((c) => estNavire(c) && c.kind === surprisedKind && c.pos);
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


/** Le curseur de la séquence de COMBAT est-il posé sur une étape de défense ? Porte d'entrée de
 *  `jetValider('defense')`, et verdict de sa sortie (`quitterLaDefense`). */
function surLEtapeDeDefense(s: Jeu): boolean {
  const casc = s.pendingCascade;
  return casc?.purpose === 'combat' && casc.participants[casc.cursor]?.jet === 'defense';
}

/** FRAPPE SUIVANTE d'un enchaînement (balayage, 2ᵉ frappe du Maniement de deux armes) : elle se rend dans
 *  l'étape `attack` courante encore ouverte ; sinon (étape validée — la défense surfacée de la frappe
 *  précédente, #998 —, autre jet au curseur, ou aucune séquence de combat) elle reçoit SA propre étape,
 *  sur laquelle passe le curseur. */
function poserLaFrappeSuivante(get: Get, set: Set, pa: PendingAttack): void {
  const seq = get().pendingCascade;
  const cur = seq?.purpose === 'combat' ? seq.participants[seq.cursor] : undefined;
  if (cur?.jet === 'attaque' && !cur.committed) { set({ pendingAttack: pa }); return; }
  if (!poserLEtapeDAttaque(get, set, pa, seq?.title ?? 'Attaque', seq?.icon ?? 'action/attaquer')) return;
  const apres = get().pendingCascade!;
  if (apres.cursor !== apres.participants.length - 1) validerLEtape(get, set);
}

/** Lignes de dé (`traceLineOf`) des jets d'une fuite lancés et clos dans le même geste : aucune rangée ne
 *  les a montrés, le journal est leur seule surface. */
function tracerLaFuite(get: Get, set: Set, mover: Combatant, foe: Combatant, jets: { dos: boolean; touche: boolean }): void {
  const pd = get().pendingDisengage;
  if (!pd) return;
  const d = jets.dos ? fleeBackstab(pd)?.result?.attackerDetail : undefined;
  const slot = jets.touche ? fleeTouche(pd) : undefined;
  const jet = slot?.jet;
  journaliser(get, set, [
    ...(d ? [traceLineOf({ who: foe.label, label: libelleDeTest('dans-le-dos'), roll: d.roll, target: d.target, sl: d.sl, success: d.success })] : []),
    ...(slot && jet?.target != null ? [traceLineOf({ who: mover.label, label: testTraceLabel(libelleDuTestNomme(slot.test), slot.test.difficulty), roll: jet.roll, target: jet.target, sl: jet.sl, success: jet.success })] : []),
  ], 'information', { actorId: mover.id });
}

/** Applique l'issue d'« Au Contact » (LDB 62 l.176) : pose/retire l'état au contact selon le choix du
 *  vainqueur (`'contact'`/`'normal'`, ou `null` = égalité → statu quo), CONSOMME l'Action (le Test
 *  opposé EST l'Action) et ferme la modale. Pas de jet ici — pose une relation symétrique. */
function applyAuContact(get: Get, set: Set, mover: Combatant, foe: Combatant, choice: 'normal' | 'contact' | null): void {
  if (choice === 'contact') setContact(mover, foe);
  else if (choice === 'normal') clearContact(mover, foe);
  const key = choice === 'contact' ? 'cs.auContactClose' : choice === 'normal' ? 'cs.auContactNormal' : 'cs.auContactTie';
  const b = markActed(get, set); // scellé AVANT la copie du journal (le déclencheur y pousse ses lignes)
  const log = [...b.log, ev('attaque', t(key, { name: mover.label, foe: foe.label }), mover.id, foe.id)];
  set({ pendingAuContact: null, battle: { ...b, action: null, log } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** Applique le CHOIX du vainqueur d'un Test opposé d'Empoignade gagné (LDB 14 l.161) côté JOUEUR : délègue
 *  l'issue au cœur PARTAGÉ `resolveGrappleWin` (`degats` = BF+DR PA ignorés / `empetrer` / `liberer`, tout en
 *  DONNÉE) puis ferme le pending. Le Test opposé EST l'Action → `acted`. `dr` = DR net du Test (→ `ctx.sl`). */
function applyGrapple(get: Get, set: Set, actor: Combatant, foe: Combatant, mode: IssueDEmpoignade, dr: number, forceRoll: number): void {
  // Application 100% en DONNÉE, PARTAGÉE avec le résolveur IA (`resolveGrappleWin`) : une SEULE voie d'issue,
  // deux orchestrations (cette modale joueur / instantané IA). Le flux n'orchestre ICI que la fermeture du pending.
  const line = resolveGrappleWin(actor, foe, mode, dr, forceRoll, get().forgerUnId);
  set({ pendingGrapple: null, battle: { ...markActed(get, set), action: null, log: [...get().battle!.log, ev('attaque', line, actor.id, foe.id)] } });
  bus.emit(EVT.SCENE_DIRTY);
}

/** Ce qu'un clic-sol REFUSÉ dit au joueur, par raison du résolveur (`resolveMovement`). Les raisons
 *  ABSENTES sont des verrous structurels (pas de combat/scène, ciblage armé, tour d'un autre joueur,
 *  Engagement — routé vers le Désengagement avant d'arriver ici) : elles ne répondent à aucun geste, et
 *  ne disent donc rien. */
const REFUS_DEPLACEMENT: Partial<Record<MovementBlockReason, (get: Get, active: Combatant) => string>> = {
  horsDePortee: () => t('cs.refusCaseHorsPortee'),
  mouvementEpuise: () => t('cs.refusMouvementEpuise'),
  sansChemin: () => t('cs.refusAucunChemin'),
  courseNonArmee: () => t('cs.refusCourseNonArmee'),
  frenesieEloigne: (get, active) => t('cs.frenzyMustCharge', { name: active.label, foe: garanti(frenzyTarget(get, active), active.id, 'cible de Frénésie').label }),
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
  if (soigne > 0) applyHealWounds(c, soigne, { wake: false, log: () => [] });
  const src = c.conditions.find((x) => x.id === conditionName)?.derivedFrom?.src;
  const fenetre = src ? fenetreDetermination(c, conditionName, now, battleRng()) : undefined;
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

/** Les trois options de la dépense d'un Point de Détermination (LDB 17 l.59-61). */
export type OptionDeDetermination = 'immuniserALaPsychologie' | 'ignorerLesCritiques' | 'retirerUnEtat';

/** Dépense d'un Point de Détermination de `c` pour `option`, l'État `etat` pour le retrait : la ligne du journal, ou
 *  `null` quand rien n'est levé et que le point n'est pas débité. Le verdict (`refusDeDetermination`) précède. */
function depenseDeDetermination(c: Combatant, option: OptionDeDetermination, etat: string | undefined, now: number): string | null {
  switch (option) {
    case 'immuniserALaPsychologie': return spendResolveForPsychImmunity(c);
    case 'ignorerLesCritiques':
      c.resolve = (c.resolve ?? 0) - 1;
      poseDeterminationCanceller(c, { scale: 'rounds', left: 1 }, 'Détermination (Critique)');
      return t('cs.determinationCrit', { name: c.label });
    case 'retirerUnEtat': {
      const { retire, soigne } = retireEtatParDetermination(c, garanti(etat, c.id, 'État retiré par Détermination'), now);
      if (!retire) return null;
      c.resolve = (c.resolve ?? 0) - 1;
      return t('cs.determinationRemove', { name: c.label, cond: conditionLabel(etat!), extra: soigne > 0 ? t('cs.fragGettingUp') : '' });
    }
    default: return option satisfies never;
  }
}

/** `effectId` de la fenêtre ci-dessus — PRÉFIXE commun, que les lecteurs retrouvent par ce nom. */
export const DETERMINATION_CONSCIENCE_ID = 'determination-conscience';

/** IDENTITÉ d'une fenêtre de Détermination : une par ÉTAT visé (#1695). Une nouvelle dépense sur le MÊME
 *  État REMPLACE la sienne ; deux dépenses sur deux États d'une même source (LDB 17 l.61, « Retirez un
 *  État » par point) ouvrent DEUX fenêtres — la seconde n'écrase plus la première. */
export const determinationWindowId = (conditionId: string): string => `${DETERMINATION_CONSCIENCE_ID}:${conditionId}`;

/** CLÔTURE d'une cascade — partagée par la validation d'étape (`validerLEtape`) et la sortie de son bilan (`terminerLaCascade`),
 *  posée par `brancherLeJeu` pour la reprise d'une séquence parquée. Le JOUR de voyage
 *  (`purpose:'travelDay'`) se ROUTE par domaine — fluvial (recalcul des km puis halte/arrivée) OU
 *  terrestre (marche forcée eager/nuit + halte/arrivée) : le domaine se lit sur le plan (`river`
 *  présent = descente fluviale), pas par deux chemins ad hoc. */
export function dispatchCascadeDone(get: Get, set: Set, done: ReturnType<typeof advanceCascade>): void {
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
    else if (get().travelPlan?.sea) continueSeaDayAfterCascade(get, set, done.piloteImmediat?.rowSurface === 'pv' ? done.participants : []);
    else travelFlow.continueTravelDayAfterCascade(get, set, done);
  }
  // Exposition hydrique fluviale (MSRC 16) surfacée APRÈS le jour (#344) : la clôture reprend la fin du
  // jour (halte de nuit / arrivée), DIFFÉRÉE le temps du Test de Résistance — sinon le Repos et l'Exposition
  // se court-circuitent et la journée suivante ne se ré-arme jamais (patron du sibling `seaScorbut`).
  else if (done?.purpose === 'riverExposure') { continueRiverDayAfterExposure(get, set); handled = true; }
  else if (done?.purpose === 'sequence') { closeSequenceRound(get, set, done); handled = true; } // manche de SÉQUENCE close → le socle résout puis rouvre/dénoue (noyau/sequenceCore)
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
  // a sa propre reprise `resolvePortArrival`) ; `runSeaDay` garde de son côté combat/steamSave.
  else if (done?.purpose === 'test' && get().travelPlan?.sea) { runSeaDay(get, set); handled = true; }
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
  // joué les décomptes une-fois-par-Round (combatFlow.ts:5242-5243 → `resolveRoundBoundary` →
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
  // dépendre d'un clic (`fenetreValider('debutDuRound')`). Le garde `!pendingCascade` (checkBattleOver) protège la
  // double-ouverture. `handled` (dénouement déjà joué : pause de Round, reprise de manœuvre…) garde
  // la main sur son propre enchaînement.
  if (!handled && get().battle) {
    if (!checkBattleOver(get, set)) resumeSuspendedAI(get, set); // combat non terminé → reprendre l'IA
  }
  // REPRISE d'une séquence PARQUÉE (couture de CLÔTURE, #942 L1) : `suspendedCascades` ne se vidait qu'au
  // teardown de combat — une séquence parquée par une AUTRE séquence (`startCascade`/`pushStep` d'un
  // `purpose` différent) n'était reprise NULLE PART. Gaté sur slot LIBRE (le dénouement ci-dessus a pu
  // ouvrir la suite : elle passe d'abord) ET hors combat (une séquence parquée par `lancerLeCombat` reste
  // propriété du teardown, cf. les sorties de la victoire et de la défaite, `issueDeCombat.ts`).
  if (!get().battle && !get().pendingCascade) resumeSuspendedCascade(get, set);
}

/** « Terminer » : ferme la cascade et enchaîne la suite (reprise de voyage…). Le joueur ne la joue qu'au bilan
 *  (`fenetreFermer('cascade')`, `MODAL_DEFS.cascade.sortieFermee`) ; l'abandon d'une manche à son ouverture la joue
 *  d'emblée (`jetRegler('cascade', 'abandon', true)`, `sequenceCore.ts`). */
function terminerLaCascade(get: Get, set: Set): void {
  dispatchCascadeDone(get, set, finalizeCascade(get, set));
}

/** Valide l'étape courante de la cascade (`advanceCascade`) et joue le dénouement de la dernière : la clôture du flux
 *  `cascade` (`jetValider('cascade')`), et la suite d'un geste de combat qui rend la main au curseur. */
function validerLEtape(get: Get, set: Set): void {
  dispatchCascadeDone(get, set, advanceCascade(get, set));
}

/** Actions de combat inline du store — déplacées VERBATIM. Spreadées EN TÊTE du `create`. */
/** La 2ᵉ frappe du Maniement de deux armes sur `targetId` (LDB 10 l.767-773) ; `testPasse` : le Test de main de
 *  l'Action est déjà passé (reprise de `jetValider('mainEnsanglantee')`). */
function frapperDeLaSeconde(get: Get, set: Set, targetId: string, testPasse: boolean): void {
  const { battle, pendingDualStrike: ds } = get();
  if (!battle || !ds) return;
  const attacker = inBattleId(battle, ds.attackerId);
  const target = inBattleId(battle, targetId);
  if (!attacker || !target) return;
  const off = attacker.weapons.find((w) => w.uid === ds.offWeaponUid);
  if (!off) { set({ pendingDualStrike: null }); return; }
  if (!ciblesDeLaDoubleFrappe(get()).some((t) => t.id === targetId)) return;
  // Main ensanglantée (AA 07 l.117) : « des deux armes » est UNE Action impliquant les DEUX mains → UN SEUL Test
  // avant l'Action. La main directrice est testée à la déclaration (`openAttackCascade`) ; si SEULE la 2nde est
  // gatée (la main directrice a déjà consommé le Test le cas échéant), la 2ᵉ frappe joue le Test ICI. Échec →
  // l'objet de la 2nde main glisse (`disarm`), la 2ᵉ frappe est renoncée. `testPasse` : Test déjà PASSÉ (reprise).
  if (!testPasse && attackHandGate(attacker, off.uid) && !attackHandGate(attacker)) {
    poserLeTestDeMain(set, attacker, 'secondaire', { attackerId: attacker.id, targetId, location: null, result: null, weaponUid: off.uid, dualSecond: true }, 'Des deux armes', 'action/attaquer');
    return;
  }
  // 2ᵉ frappe : jet IMPOSÉ + pénalité main 2nde + nouveau jet de défense (LDB 10 l.767-773).
  const res = resolveDualSecond(get, attacker, target, off, ds.jet);
  poserLaFrappeSuivante(get, set, { attackerId: attacker.id, targetId, location: res.location ?? null, result: res, dualSecond: true, weaponUid: off.uid });
}

export function createCombatSlice(get: Get, set: Set) {
  /** Dissout l'INTENTION LOCALE armée et dit s'il y en avait une (spec zone 4) : le clic du champ qui
   *  la consomme reste, lui, le geste par défaut. */
  const consumeIntent = (): boolean => {
    if (!intentionDuProprietaire(get)) return false;
    set({ localIntent: null });
    return true;
  };

  return {
    // ── Combat monté : Monter / Descendre — MAISON [entériné 2026-07-17] (« Met les en Maison pour le
    // moment », #526) : aucune clause de coût citable (LDB 14/15/09 + AA 9 fouillés en entier) ;
    // cadre RAW du combat monté : LDB 14 l.175-187. ──
    // Enfourcher/descendre ne demande AUCUN jet (Chevaucher sans Test si l'on a la Compétence, LDB 09 l.112)
    // → ce n'est PAS une Action (critère : tout jet = une Action) : c'est juste du MOUVEMENT (repositionnement
    // sur/hors la monture). On consomme donc le Mouvement du tour, pas l'Action — on peut enfourcher PUIS attaquer.
    monterEnSelle: (mountId?: string) => {
      const { battle, scene } = get();
      if (!battle || !scene || battle.over || battle.movementUsed > 0) return;
      const active = activeCombatant(battle);
      if (!active || active.mountId) return;
      const montures = mountablesNear(battle, active);
      // Monture EXPLICITE (pastille de CETTE monture) → elle, et seulement si elle est enfourchable ;
      // sinon (touche du registre) → la plus proche. Même patron que `servirLePoste`.
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
      set({ battle: { ...battle, ...orderPatch, movementUsed: mountMovement(battle, active), action: null, reachable: new Map(), log: [...battle.log, ev('deplacement', t('cs.mount', { name: active.label, mount: mount.label }), active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    mettrePiedATerre: () => {
      const { battle, scene } = get();
      if (!battle || !scene || battle.over || battle.movementUsed > 0) return;
      const active = activeCombatant(battle);
      if (!active || !active.mountId) return;
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
      set({ battle: { ...battle, ...orderPatch, movementUsed: mountMovement(battle, active), action: null, reachable: new Map(), log: [...battle.log, ev('deplacement', t('cs.dismount', { name: active.label, mount: mountName }), active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Désengagement (héros Engagé qui veut quitter le combat, LDB 15 l.43-49) ──
    rompreLEngagement: () => {
      const battle = get().battle;
      if (!battle || battle.over) return; // option A (Sacrifier l'Avantage) reste possible même après avoir agi
      const active = activeCombatant(battle);
      if (!active || !isEngaged(active)) return;
      startDisengage(get, set, active);
    },
    // Cycle Chance/Pacte UNIFIÉ (spec `disengage`) : foe (atk) figé, seule l'Esquive du mover se (re)joue.

    // ── « Au Contact » (LDB 62 l.176, Option « Longueur d'arme », règle `combat-longueur-arme`) :
    //    Test opposé de Corps à corps mover vs foe pour entrer dans la longueur d'arme ; le VAINQUEUR
    //    choisit « combat normal » ou « au contact » (toute arme > Courte y devient improvisée). ──
    ouvrirLAuContact: (targetId: string) => {
      const barre = barreDuGeste(get());
      if (barre.forme !== 'ouverte') return void refuserGesteDuSiege(get, set, barre.raison);
      const { active, battle } = barre;
      // Le Test opposé coûte l'Action.
      const refus = refusActionDepensee(battle) ?? refusHorsDEtatDAgir(active);
      if (refus) return void refuserGesteDuSiege(get, set, refus);
      const foe = inBattleId(battle, targetId);
      if (!foe || !auContactEligible(active, foe)) return void refuserGesteDuSiege(get, set, t('offre.sansCandidatDuContexte'));
      startAuContact(get, set, active, foe);
    },
    // ── Empoignade (LDB 14 l.161) : action à son tour entre deux Empoignés. Test opposé de FORCE OU
    //    « Briser » (Avantage supérieur, gratuit) ; le VAINQUEUR choisit Dégâts / Empêtrer / Se libérer. ──
    ouvrirLEmpoignade: (targetId: string) => {
      const barre = barreDuGeste(get());
      if (barre.forme !== 'ouverte') return void refuserGesteDuSiege(get, set, barre.raison);
      const { active, battle } = barre;
      // Le Test opposé coûte l'Action.
      const refus = refusActionDepensee(battle) ?? refusHorsDEtatDAgir(active);
      if (refus) return void refuserGesteDuSiege(get, set, refus);
      const foe = inBattleId(battle, targetId);
      if (!foe || !grappleActionEligible(active, foe)) return void refuserGesteDuSiege(get, set, t('offre.sansCandidatDuContexte'));
      startGrapple(get, set, active, foe);
    },
    cliquerLaCaseDuCombat: (pt: Pt, opts?: OptionsDuClic) => {
      const { battle, scene } = get();
      if (!battle || !scene || battle.over || champAttendSaFenetre(get())) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active)) return;
      // INTENTION LOCALE armée (spec zone 4) : ce clic EST son commit — elle se dissout et vaut
      // confirmation (la case a été choisie sciemment). L'intention du clic (`intentionDuClic`) se lit AVANT que
      // `consumeIntent` ne l'efface.
      const intention = intentionDuClic(get, opts);
      if ('refus' in intention) return void refuserGesteDuSiege(get, set, intention.refus);
      const { intentionId } = intention;
      const courseDemandee = courseArmee(intentionId);
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
      const movement = resolveMovement(get, dest, { courseArmee: courseDemandee });
      if (movement.status === 'bloque') {
        // Le clic-sol REFUSÉ le DIT (modèle de gestes 2026-08-19 ; le survol, lui, ne peint plus rien sur
        // une case injouable — arbitrage 2026-08-24). Seules les raisons qui répondent à un GESTE du
        // joueur parlent : les verrous structurels (pas de combat, ciblage armé, tour d'autrui) ne sont
        // pas des refus, ils n'ont rien à dire. Table locale à UN consommateur (ce site est le clic-sol).
        const dit = REFUS_DEPLACEMENT[movement.reason];
        if (dit) refuserGeste(get, set, dit(get, active));
        get().effacerLApercu();
        return;
      }
      // Peur (LDB 21 l.27) : `retenuParLaPeur`. L'intention rejoue le clic BRUT (`pt`) après le Test →
      // `cliquerLaCaseDuCombat` re-résout l'escalier ; le contrôle, lui, porte sur la destination réelle (`dest`).
      const fearGateBlocks = (): boolean =>
        retenuParLaPeur(get, set, active, dest, { kind: 'tile', pt: { ...pt }, intentionId: intentionId ?? undefined });
      const geom = mountOf(battle, active) ?? active;
      const prev = battle.preview;
      if (movement.kind === 'course') {
        // Zone de Course : tap 1 = aperçu « Courir » ; tap 2 = Test de `course` (pendingRun + destination).
        if (!clickOpts?.confirm && !(prev?.kind === 'course' && prev.path === movement.path)) {
          set({ battle: { ...battle, preview: { kind: 'course', tile: { ...dest }, path: movement.path, cost: movement.cost } } });
          bus.emit(EVT.SCENE_DIRTY);
          return;
        }
        if (fearGateBlocks()) return;
        get().ouvrirLaCourse({ ...dest }, { path: movement.path, cost: movement.cost });
        return;
      }
      // Tap 1 : APERÇU (chemin + coût) — sauf confirmation directe ou re-tap de la même case.
      if (!clickOpts?.confirm && !(prev?.kind === 'deplacement' && prev.path === movement.path)) {
        set({ battle: { ...battle, preview: { kind: 'deplacement', tile: { ...dest }, path: movement.path, cost: movement.cost } } });
        bus.emit(EVT.SCENE_DIRTY);
        return;
      }
      // Tap 2 : COMMIT.
      if (fearGateBlocks()) return;
      // Annulation (R6/LOT 6) : au PREMIER segment du Tour (movementUsed === 0), on capture l'état
      // positionnel AVANT de bouger, pour pouvoir tout annuler tant qu'aucune Action n'a été prise.
      const snapshot =
        (battle.movementUsed ?? 0) === 0 ? captureMoveSnapshot(battle, get().facing) : battle.moveSnapshot ?? null;
      const path = movement.path;
      const fromPos = { ...active.pos! };
      placeCombatant(active, scene, dest);
      if (geom !== active) placeCombatant(geom, scene, dest); // déplace la monture sous le cavalier (couple solidaire)
      displaceSmaller(get, geom); // un grand « dégage » les plus petits sous son empreinte (85 l.373-374)
      get().orienterSelonLeChemin(active.id, path);
      if (geom !== active) get().orienterSelonLeChemin(geom.id, path);
      bus.emit(EVT.ANIM_MOVE, { id: active.id, path });
      if (geom !== active) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path });
      applyZoneCrossings(get, set, active, path ?? [{ ...dest }]); // Mur de feu & co (L11) : traverser coûte
      noteApproachMove(active, fromPos); // LDB 21 l.27 — événement EN ATTENTE : scellé à l'Action ou à la fin du tour
      // Mouvement décomposable : cumule le coût du segment ; reste en mode neutre → le joueur peut
      // re-cliquer une case (s'il reste du Mouvement) OU enchaîner une Action. Si ce segment précède
      // l'Action, on marque `movedPreAction` (verrouille tout Mouvement post-Action).
      set({ battle: { ...battle, moveSnapshot: snapshot, movementUsed: (battle.movementUsed ?? 0) + movement.cost, movedPreAction: battle.movedPreAction || !battle.acted, action: null, reachable: new Map(), preview: null } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    annulerLeDeplacement: () => {
      const { battle } = get();
      if (!battle || battle.over) return;
      const snap = battle.moveSnapshot;
      const active = activeCombatant(battle);
      // Aide PRÉ-Action uniquement : on n'annule que tant qu'aucune Action n'a été prise ce Tour (sinon
      // l'Action aurait été résolue depuis une position effacée). Rien à annuler sans segment.
      if (!snap || !active || battle.acted || (battle.movementUsed ?? 0) === 0) return;
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
        // `annulerLeDeplacement` est l'INVERSE de l'économie du tour : il la rend à son état d'avant le segment,
        // empreinte comprise (`endTurnGuard.ts`) — donc il désarme la fin de tour.
        battle: { ...battle, movementUsed: 0, movedPreAction: snap.movedPreAction, moveSnapshot: null, action: null, reachable: new Map(), preview: null, endTurnArmed: undefined },
      });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // INTENTION LOCALE (spec zone 4) : la case d'action ARME le geste que le prochain clic du champ
    // commettra, et sa PORTÉE se peint aussitôt (`localIntent.ts` → `HighlightsView.intentReach`).
    // Purement locale : aucun intent réseau ne part d'ici (seul le COMMIT du geste en émet un).
    poserLIntention: (actionId: string | null) => {
      set({ localIntent: actionId ? { actionId } : null });
      bus.emit(EVT.SCENE_DIRTY);
    },
    cliquerLeCombattant: (id: string, opts?: BattleClickOpts) => {
      const battle = get().battle;
      if (!battle || battle.over) return;
      // Tir rapide ARMÉ (pause de début de Round, LDB 11 l.97-103) : cliquer un adversaire — token de carte OU portrait
      // de frise, tous deux passent ICI — déclenche l'interruption hors du tour (le tireur n'est pas l'actif).
      const aiming = get().preemptAiming;
      if (aiming) {
        set({ preemptAiming: null }); // désarme avant d'ouvrir la modale de tir
        get().declencherLeTirPreventif(aiming, id);
        return;
      }
      if (champAttendSaFenetre(get())) return;
      const active = activeCombatant(battle);
      if (!active || !controlsCombatant(get(), active)) return;
      // INTENTION LOCALE armée (spec zone 4) : ce clic EST son commit — elle se dissout, et vaut
      // confirmation (la cible a déjà été choisie sciemment). L'intention du clic (`intentionDuClic`), seule à autoriser
      // l'approche vers la cible (spec § 2026-08-19), se lit avant que `consumeIntent` ne l'efface.
      const intention = intentionDuClic(get, opts);
      if ('refus' in intention) return void refuserGesteDuSiege(get, set, intention.refus);
      const armed = consumeIntent();
      const clickOpts: BattleClickOpts = { ...opts, intentionId: intention.intentionId ?? undefined, ...(armed ? { confirm: true } : {}) };
      // Le MODE de ciblage courant possède le commit-COMBATTANT (attaque/cast/soin/bordée, ou flux
      // différés : Surincantation +Cible / Frappe Mortelle / 2ᵉ frappe, ou pose de zone sur la case
      // d'un combattant). Source UNIQUE : targetingModes (réticule au survol = ce même mode).
      currentTargetingMode(get).commitCombatant?.(get, set, active, id, clickOpts);
    },
    // ── Sélection d'ATTAQUE (« Attaque ▾ ») : arme une `AttackOption` (Arme + gratuites/zone/Piétinement/
    // Tentacule). Source des entrées : `availableAttacks` (combatFlow). Le clic-ennemi résout l'armée. ──
    armerLAttaque: (attaqueId: string) => {
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active) return;
      // Arme une attaque pour le clic-ennemi (mode neutre : `action===null`). Re-sélectionner revient à l'Arme.
      const next = battle.selectedAttack === attaqueId ? 'arme' : attaqueId;
      set({ battle: { ...battle, action: null, selectedAttack: next, selectedSpellId: null, preview: null }, pendingSiegeAim: null });
      // Pièce INDIRECTE servie (mortier/catapulte, AA 10 l.169/171) : ARMER l'option « Servir … » ouvre le PLACEUR
      // DE CASE (le tir vise un point au sol, pas un combattant) ; le désarmer (retour à 'arme') le referme.
      if (next === attaqueId) {
        const opt = availableAttacks(active, battle).find((o) => o.id === attaqueId);
        if (opt?.indirect && opt.weaponUid) {
          const w = active.weapons.find((x) => x.uid === opt.weaponUid);
          if (w?.uid) set({ pendingSiegeAim: { gunnerId: active.id, weaponUid: w.uid, radius: siegeBlastRadiusTiles(active, w, get().scene), rangeTiles: null } });
        }
      }
    },
    lancerLAttaqueDeZone: (kind: AttackKind) => {
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active) return;
      // Les attaques IMMÉDIATES que l'offre `attaque-zone` énumère (`attaques-de-zone`), abordables (`availableAttacks`).
      if (!availableAttacks(active, battle).some((x) => x.kind === kind && attaqueImmediate(x))) return;
      set({ battle: { ...battle, action: null } }); // referme le menu avant la résolution
      // Hurlement (LDB 85 l.170) : PAS de jet d'attaquant — chaque cible tire son 1d10 + Test de
      // Résistance (jets SUBIS montrés au feed). Aucune modale différable → résolution immédiate (le
      // wrapper roule les jets subis + checkBattleOver). Dépense TOUS les Avantages (min 2).
      applyWail(get, set, active);
    },
    manoeuvrerSurSoi: (maneuverId: string) => {
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return; // coûte l'Action du tour (2ᵉ via loseTurn des effets)
      const active = activeCombatant(battle);
      if (!active || !canTakeAction(active)) return;
      const def = selfManeuversOf(active).find((m) => m.id === maneuverId);
      if (!def || !selfManeuverApplicable(active, def)) return; // périmée (déjà dans/hors de la forme)
      set({ battle: { ...battle, action: null } }); // referme le menu
      resolveManeuver(get, set, active, def, 0, null, 0, active); // cible = SOI (transformation, mue…)
      set({ battle: markActed(get, set) }); // Action consommée
      checkBattleOver(get, set);
    },

    // ── Battement (LDB 10 l.103 / AA 13 l.17) : Action, Test de Corps à corps NON opposé retirant de
    //    l'Avantage adverse. Le jet passe par FLOWS.battement (Lancer/Chance/Pacte/Résilience) ;
    //    « Appliquer » (`jetValider('battement')`) appelle `resolveBattement` et consomme l'Action. ──
    faireUnBattement: (foeId?: string) => {
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return; // l'Action de Battement est indisponible si déjà agi
      const active = activeCombatant(battle);
      if (!active || !canTakeAction(active) || !hasBattement(active)) return;
      const foes = battementFoes(active, battle);
      const foe = foeId ? foes.find((c) => c.id === foeId) : foes[0]; // défaut = 1er éligible ; picker via réglage `battement.adversaire`
      if (!foe) return;
      startBattement(get, set, active, foe);
    },

    // ── Distraire (LDB 10 l.364 / AA 13 l.51) : MOUVEMENT, Test OPPOSÉ Athlétisme vs Calme. Le jet de
    //    Calme du foe est figé à l'ouverture (`startDistraire`) ; l'Athlétisme du mover passe par
    //    FLOWS.distraire (Lancer/Chance/Pacte/Résilience) ; « Appliquer » pose `distractedRounds` et
    //    consomme le MOUVEMENT (pas l'Action). ──
    tenterDeDistraire: (foeId?: string) => {
      const { battle } = get();
      if (!battle || battle.over || battle.movementUsed > 0) return; // le Distraire coûte le Mouvement
      const active = activeCombatant(battle);
      if (!active || !active.pos || !hasDistraire(active)) return;
      const foes = distraireFoes(active, battle);
      const foe = foeId ? foes.find((c) => c.id === foeId) : foes[0]; // défaut = 1er éligible ; picker via réglage `distraire.adversaire`
      if (!foe) return;
      startDistraire(get, set, active, foe);
    },


    // ── Course (LDB 15 l.41) : utilise l'Action + le Test de la fiche `course` → déplacement
    //    étendu (Mouvement restant + Course + DR) vers la destination cliquée dans la zone de Course. « Un jet = une
    //    modale » : le Test passe par pendingRun. ──
    ouvrirLaCourse: (dest?: Pt, movement?: { path: Pt[]; cost: number }) => {
      const barre = barreDuGeste(get());
      if (barre.forme !== 'ouverte') return void refuserGesteDuSiege(get, set, barre.raison);
      const { active, battle } = barre;
      const refus = refusDeCourse(battle, active);
      if (refus) return void refuserGesteDuSiege(get, set, refus);
      const resolved = dest && !movement ? resolveMovement(get, dest) : null;
      if (resolved?.status === 'bloque') return;
      const plan = movement ?? (resolved?.status === 'possible' ? { path: resolved.path, cost: resolved.cost } : undefined);
      set({ pendingRun: { combatantId: active.id, test: testDuCavalier(active, testDeRegle('course', 'courir')), dest, ...plan, result: null }, battle: { ...battle, action: null, preview: null } });
    },

    // ── Manœuvre navale (MDG 13) : le barreur (héros ACTIF, à la barre) dépense son Action pour un Test
    //    de Navigation → vire le cap (re-mappe les bordées) + avance la coque. « Un jet = une Action » : le
    //    jet passe par pendingShipManeuver, `acted` consommé au confirm. La direction se choisit au pré-jet. ──
    manoeuvrerLeNavire: (id: string) => {
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || active.id !== id || !canTakeAction(active)) return;
      // À l'échelle MER, le NAVIRE est l'acteur (`id` = la coque, barreur = meilleur de l'équipage) ; au person-scale,
      // un héros-équipage prend la barre (`id` = le héros, navire dérivé via `shipOfCrew`).
      const ship = estNavire(active) ? active : shipOfCrew(battle.combatants, id);
      if (!ship) return;
      const opened = openCrewTestPending(get, ship, 'manoeuvre');
      if (!opened) return; // aucun rôle tenu → le navire ne peut pas manœuvrer
      set({
        pendingShipManeuver: { shipId: ship.id, turnSteps: 0, ...opened },
        battle: { ...battle, action: null, preview: null },
      });
      // Auto-roule les TÉMOINS (marins PNJ) — leur jet initial est résolu sans influence (cf. makeRollFlow).
      for (const part of opened.participants) if (!part.interactive) get().jetLancer('manoeuvreDuNavire', part.id);
    },

    // ── BORDÉE (« Tir de batterie », MDG 14 l.128) — JUMEAU de la manœuvre : Test d'équipage MULTI des Artilleurs (★),
    //    dont le DR PARTAGÉ remplace le jet de chaque pièce du bord qui porte. `ouvrirLaBordee(shipId, targetId)` ouvre
    //    la modale (le bord est dérivé de la cible via `targetArc`) ; `jetValider('tirDeBatterie')` résout la volée (`resolveVolley`). ──
    ouvrirLaBordee: (shipId: string, targetId: string) => {
      const battle = get().battle;
      if (!battle) return;
      const ship = inBattleId(battle, shipId);
      const target = inBattleId(battle, targetId);
      if (!ship || !target || !ship.pos || !target.pos) return;
      if (!estNavire(ship)) return void refuserGeste(get, set, t('cs.bordeeSansNavire', { ship: ship.label })); // MDG 14 l.128
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
      for (const part of opened.participants) if (!part.interactive) get().jetLancer('tirDeBatterie', part.id); // témoins (marins PNJ) auto-roulés
    },

    // ── AUTO-PILOTE : bordée HEADLESS (aucun pending) — l'IA de coque (couche Mer) lâche une bordée sur un navire
    //    ennemi. Le Test d'équipage des Artilleurs se résout SANS modale (`resolveCrewTestByRoles`, équipage abstrait
    //    l.39 : les rôles nominaux tenus arment les pièces, le Manque de bras est LA pénalité RAW) → DR partagé,
    //    puis le MÊME corps de bordée que le joueur (`applyBatteryVolley`). Renvoie true si des pièces ont fait feu. ──
    tirerLaBordee: (shipId: string, targetId: string): boolean => {
      const battle = get().battle;
      if (!battle) return false;
      const ship = inBattleId(battle, shipId);
      const target = inBattleId(battle, targetId);
      if (!ship || !target || !ship.pos || !target.pos || !estNavire(ship)) return false; // MDG 14 l.128
      const side = targetArc(get().facing[ship.id] ?? 'N', ship.pos, target.pos); // bord qui porte (auto-dérivé de la cible)
      if (!bearingPostes(ship, side).length) return false; // aucune pièce chargée sur ce bord → rien à lâcher
      const navigation = navigationDuNavire(get, ship);
      const assignments = shipCrewAssignments(ship, battle.combatants, 'batterie', navigation); // équipage abstrait → rôles tenus (Artilleur ★)
      const undercrew = shipUndercrew(get, ship, battle.combatants);
      const traits = hullNavalTraits(ship);
      const extraDR = shipSaboteurDR(ship) + navalTestTypeDR(traits, 'batterie');
      // DR partagé calé sur le chemin JOUEUR (`maneuverCrewTotal`) : Σ contributions (essentiel ×2) + Moral +
      // Manque de bras (−2/tranche) + sabotage/traits ; plafonné à un Succès Minime dès qu'une tranche manque (l.55).
      const crewTest = resolveCrewTestByRoles(assignments, 'batterie', 'intermediaire', shipMoraleScore(get, ship), navigation, battleRng(), { extraDR: undercrew.dr + extraDR });
      const dr = undercrew.capSuccesMinime ? capToSuccesMinime(crewTest.total) : crewTest.total;
      const gunners = assignments.map((a) => a.crew.id);
      const bA = markActed(get, set); // AVANT la volée : `actedAvant` le capture, chaque reprise de coup le rend (#1852 ; #1595)
      set({ battle: { ...bA, crewActed: withCrewActed(bA.crewActed, shipId, gunners) } }); // équipage engagé ce Round (Manque de bras / cumul, l.53)
      const suspendu = applyBatteryVolley(get, set, ship, target, side, dr, crewTestSuccess(dr));
      if (!suspendu) checkBattleOver(get, set);
      bus.emit(EVT.SCENE_DIRTY);
      return true;
    },

    // ── CHANSON DE MARIN (Talent, MDG 09 l.32-40) : le chanteur (équipage doté du Talent) choisit une
    //    chanson CONNUE (spec du Talent) puis lance son Test de Divertissement (Chant) ; réussi → l'effet
    //    (`crewOps`/`captainOps`) couvre l'équipage 3 min + DR. Tâche PARALLÈLE du tour du navire (comme
    //    Recharger : le chant occupe le CHANTEUR, pas l'Action du navire) ; une chanson par QUART (l.40). ──
    chanterLaChanson: (shipId: string) => {
      const battle = get().battle;
      if (!battle || battle.over) return;
      const ship = inBattleId(battle, shipId);
      if (!ship || quartChante(ship, get().gameTime)) return;
      const singer = chanteurDuNavire(ship, battle);
      if (!singer) return;
      const known = knownShanties(singer);
      set({
        pendingShanty: { shipId: ship.id, singerId: singer.id, shantyId: known.length === 1 ? findSeaShantyById(known[0])?.id ?? null : null, result: null },
        battle: { ...battle, action: null, preview: null },
      });
    },



    // ── Se relever d'À Terre — LDB 16 l.35 · LDB 18 l.15. Le Mouvement, pas l'Action. ──
    seRelever: () => {
      const battle = get().battle;
      if (!battle || battle.over || battle.movementUsed > 0) return;
      const active = activeCombatant(battle);
      // MÊME lecture que la case du registre (gate `remede-atteignable`) : hors d'état d'agir, aucun
      // geste ; État verrouillé, aucun retrait (LDB 18 l.15).
      if (!active || isOutOfAction(active)) return;
      const inst = active.conditions.find((c) => c.id === COND.aTerre);
      if (!inst || isConditionLocked(inst, active)) return;
      removeCondition(active, COND.aTerre);
      set({ battle: { ...battle, movementUsed: mountMovement(battle, active), action: null, log: [...battle.log, ev('deplacement', t('cs.standUp', { name: active.label }), active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // « Servir cette pièce » (MDG 12-13) : le héros ACTIF REJOINT un poste de siège adjacent — CHEF s'il est
    // non servi (arme octroyée, taguée mountSide ; tire au tour suivant via l'option 'poste'), sinon SUPPORT (Arme
    // d'équipe : occupe la pièce, compte dans l'Indice contre le sous-effectif, mais ne tire pas). MÊME mutation
    // KIND-AGNOSTIQUE (`serveAtPoste`) que l'IA et l'author-time ; `recomputeLoadout` canonicalise l'arme du chef.
    // GRATUIT (LDB 13 l.106). « Tout le monde peut servir une arme de siège » (cf. l'IA `manPoste`).
    servirLePoste: (posteUid?: string) => {
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || isOutOfAction(active)) return;
      const servable = servablePostes(active, battle.combatants);
      // Pièce DÉSIGNÉE (clic sur la pièce) → ce poste ; sinon (bouton hotbar) → le 1er servable.
      const chosen = posteUid === undefined ? servable[0] : servable.find((sp) => sp.poste.item.uid === posteUid);
      if (!chosen) return;
      const joining = isPosteManned(chosen.poste, battle.combatants); // pièce déjà servie → on REJOINT en renfort
      serveAtPoste(active, chosen.poste, battle.combatants);
      recomputeLoadout(active);
      set({ battle: { ...battle, action: null, log: [...battle.log, ev('detail', t(joining ? 'cs.joinPoste' : 'cs.manPoste', { name: active.label, weapon: chosen.poste.item.label }), active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    // « Quitter la pièce » (release) : le héros actif lâche le poste qu'il sert → il redevient servable par un autre.
    // `leaveChef` retire le lien + l'équipage + l'arme ; `recomputeLoadout` re-dérive sans la pièce. GRATUIT
    // (LDB 13 l.106). Symétrique de `servirLePoste`.
    quitterLePoste: () => {
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active) return;
      const poste = active.mannedPoste;
      if (!poste) return;
      const weapon = poste.item.label;
      leaveChef(active, poste, battle.combatants);
      recomputeLoadout(active);
      set({ battle: { ...battle, action: null, log: [...battle.log, ev('detail', t('cs.leavePoste', { name: active.label, weapon }), active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    // « Pousser » un engin de siège CREWÉ à roues (ADE II 8 l.258, Lot 2 #156) : ouvre le mode de
    // ciblage-CASE 'poussee' — le clic-sol suivant (PUSH_MODE.commitTile, targetingModes.ts) commet la
    // translation de la formation. Gate : chef d'un poste MOBILE (`pushEligible`), Action dispo, Équipe ≥
    // moitié requise (`pushCrewOk`, sinon no-op — comme un tir sous-effectif refusé, `firedAttackBlock`).
    // Ne consomme RIEN ici (la dépense de l'Action a lieu au COMMIT, comme `cliquerLaCaseDuCombat`/`servirLePoste`).
    pousserLEngin: () => {
      const battle = get().battle;
      const scene = get().scene;
      if (!battle || battle.over || !scene) return;
      // Toggle (parité cast/heal) : re-cliquer « Pousser » alors qu'on est déjà en mode 'poussee' ferme le mode sans consommer
      // l'Action, comme le re-clic de sa case (`desarmerLeMode`).
      if (battle.action === 'poussee') return void get().desarmerLeMode();
      const active = activeCombatant(battle);
      // Pousser = le MOUVEMENT (pas l'Action) : bloqué si le Mouvement du chef est déjà dépensé, PAS si l'Action
      // a été prise (on peut pousser puis assener, ou l'inverse — ordre libre, LDB 13 l.79). Et pas davantage
      // si l'Action lui est INTERDITE : un chef Sonné garde son Mouvement (LDB 16 l.125 — « incapable
      // d'effectuer votre Action […] vous ne pouvez vous déplacer que de la moitié de votre Mouvement »),
      // il pousse donc, à demi-budget. Ce que l'engin exige, c'est du MOUVEMENT — et le budget d'un
      // porteur cloué (Inconscient/Surpris, `gating.movement:'none'`) vaut déjà 0, ce que la ligne suivante
      // refuse. Exiger `canTakeAction` ici faisait mentir le coût déclaré au registre.
      if (!active || !pushEligible(active) || (battle.movementUsed ?? 0) >= mountMovement(battle, active)) return;
      const poste = active.mannedPoste!;
      const hull = posteDeLaBataille(poste.item.uid, battle.combatants)?.porteur;
      const w = mannedPosteWeapon(active, poste);
      if (!hull || !hull.pos || !active.pos || !w || !pushCrewOk(poste, w, battle.combatants)) return;
      const reach = pushReachable(battle, scene, active, hull);
      set({ battle: { ...battle, action: 'poussee', reachable: reach, preview: null } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    // « Diriger l'équipe » (Commandant d'équipe, AA 13 l.29-35) : le Personnage doté du Talent aide une équipe
    // servant une Arme d'équipe à portée de voix — Test de Commandement Intermédiaire (+0) RÉUTILISÉ (openSkillTest/
    // pendingTest, LANCEUR restreint à l'acteur actif ; Soutien laissé au régime général du § Soutien,
    // LDB 12 l.187-198). Sur réussite, chaque chef dirigé est lié au commandant (op
    // `teamCommander`) → son équipe tire ensuite au score de Projectiles du commandant (substitution `attackEnv`).
    aiderLEquipe: () => {
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || isOutOfAction(active) || !canTakeAction(active) || !hasCommandTeam(active)) return;
      const chiefs = teamCommandTargets(active, battle.combatants);
      if (!chiefs.length) return;
      const onSuccess: Flow = {
        kind: 'sequence',
        etapes: chiefs.map((c) => ({ kind: 'effet', effet: { type: 'ops', on: 'heros', heroId: c.id, ops: [{ op: 'teamCommander', commanderId: active.id }] } })),
      };
      set({ battle: { ...markActed(get, set), action: null } }); // le Test EST l'Action (réussite ou non)
      openSkillTest(get, set,
        { skill: { id: 'commandement' }, difficulty: 'intermediaire', label: t('cs.teamCommandTest'), stake: combatStakeRef('equipe-direction') },
        combatConditionCtx(active, {}), onSuccess, EMPTY_FLOW, EMPTY_FLOW, { actorId: active.id });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // Le garde-fou « tour gâché » (spec §1c-bis COIN) : finir avec l'Action intacte ARME la fin, le geste suivant
    // passe la main. L'IA et les flux internes passent, eux, par `advanceTurn`.
    terminerLeTour: () => {
      const s = get();
      const b = s.battle;
      const active = b ? activeCombatant(b) : undefined;
      if (b && active && wastesAction(active, b, s.pendingCleave) && !endTurnArmed(b)) { s.armerLaFinDuTour(); return; }
      advanceTurn(get, set);
    },
    /** ARMEMENT du garde-fou « tour gâché » : le 1er geste de fin de tour EMPREINT l'économie du tour
     *  (`turnEconomyStamp`), le 2ᵉ passe la main. L'état vit dans `battle` — donc répliqué (l'invité
     *  voit son propre armement revenir de l'hôte) et lisible par la plaque de sortie. */
    armerLaFinDuTour: () => {
      const barre = barreDuGeste(get());
      if (barre.forme !== 'ouverte') return void refuserGesteDuSiege(get, set, barre.raison);
      set({ battle: { ...barre.battle, endTurnArmed: turnEconomyStamp(barre.battle) } });
    },
    /** Retire l'aperçu armé par un premier clic (`battle.preview`), celui que le second clic commettrait. */
    effacerLApercu: () => {
      const b = get().battle;
      if (!b?.preview) return;
      set({ battle: { ...b, preview: null } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Tir rapide (talent, LDB 11 l.97-103) : INTERRUPTION à distance en début de Round, hors de l'ordre d'Initiative ──
    declencherLeTirPreventif: (heroId: string, targetId: string) => {
      const battle = get().battle;
      if (!battle || get().pendingAttack || !preemptShooterIds(get).includes(heroId)) return;
      const hero = garanti(inBattleId(battle, heroId), heroId, 'tireur');
      const target = inBattleId(battle, targetId);
      if (!target || target.kind === hero.kind || isOutOfAction(target)) return;
      // Cible VALIDE seulement (arme à distance + bande de portée + Ligne de Vue) — sinon on N'OUVRE PAS la
      // modale (le tir résolu hors-tour heurterait la cascade). Le refus se DIT au point du geste
      // (`refusVisible`) : le survol, lui, ne montre plus rien sur une cible invalide (arbitrage 2026-08-24).
      const weapon = firedWeapon(hero, target, undefined, battle.combatants);
      const scene = get().scene;
      const blocked = !!(hero.pos && target.pos && scene) && !losClear(scene, hero.pos, target.pos, smokeOf(battle));
      // Chaque cause dit LA SIENNE : une cible hors de portée n'annonce pas un mur qui n'existe pas.
      if (weapon.type !== 'distance') return void refuserGeste(get, set, t('cs.refusTirArmeDeMelee', { weapon: weapon.label }));
      if (!inFiringBand(hero, target, weapon, sceneMetresPerTile(scene))) return void refuserGeste(get, set, t('cf.horsDePortee'));
      if (blocked) return void refuserGeste(get, set, t('cf.ligneDeVueMasquee'));
      // Le tir se résout par la modale de jet NORMALE (jetLancer('attaque')/jetValider('attaque')) ; le tireur n'est PAS actif.
      // `pendingAttack.interrupt` → jetValider('attaque') applique le tir sans avancer le tour + épuise son tour normal.
      // La modale d'attaque est rendue par la CASCADE (CascadeModal → useAttackJetProps), comme TOUTE attaque :
      // on ouvre donc une cascade à une étape `jet:'attaque'` pour le tireur (refermée par jetValider('attaque')).
      // `tirImmobile: true` : l'interruption est un tir IMMOBILE d'office (elle coûte le Mouvement du tour) → pas
      // de pénalité « Tir en bougeant » (LDB 14), qui n'aurait aucun sens hors du tour du tireur.
      openAttackCascade(get, set, { attackerId: hero.id, targetId: target.id, location: null, result: null, interrupt: true, tirImmobile: true }, 'Tir rapide', 'action/tirer');
    },
    /** DEMANDE DE PAUSE au prochain Round, POSÉE (`levee`) ou RETIRÉE PAR SON SIÈGE : le siège vient de `decidingSeat`
     *  (le siège agissant quand l'hôte applique l'intent d'un invité, sinon le siège local), jamais d'un argument — la
     *  demande d'un joueur ne peut pas être signée d'un autre. Le retrait est gratuit : tant que le Round n'a pas tourné,
     *  un joueur qui s'est ravisé rend la table à son enchaînement ; il ne retire QUE son siège, la pause tient tant
     *  qu'un autre siège la demande. Refusée, et dite, au verdict de l'offre qui la déclare (`pause`). */
    leverLaMain: (levee: boolean) => {
      const b = get().battle;
      if (!b) return;
      const refus = refusDeLOffreHorsDuTour(get(), 'pause');
      if (refus) return void refuserGesteDuSiege(get, set, refus);
      const seat = decidingSeat(get());
      const deja = b.handRaisedBy ?? [];
      if (deja.includes(seat) === levee) return;
      const handRaisedBy = levee ? [...deja, seat] : deja.filter((s) => s !== seat);
      set({ battle: { ...b, handRaisedBy, log: [...b.log, ev('information', t(levee ? 'store.handRaised' : 'store.handLowered'))] } });
    },

    /** Reprise après un CHANGEMENT DE CADENCE en plein combat. La cadence vit dans le registre de RÈGLES
     *  (engine/policy), pas dans le store → la passer en Auto/Rapide ne traverse NI la boucle de tours NI la
     *  souscription de `combatAuto` (aucun `set`) : le combat se figeait sur le tour courant. On RÉ-ENTRE donc
     *  explicitement : `tickCombatAuto` auto-résout une éventuelle modale ouverte, `maybeRunEnemyTurn` joue le
     *  tour de l'acteur si l'IA le pilote. No-op en mode manuel / hors combat (gardes internes). */
    reprendreLaCadence: () => {
      const b = get().battle;
      if (!b || b.over) return;
      tickCombatAuto(get, set);
      maybeRunEnemyTurn(get, set);
    },

    prendreLaDefensive: () => {
      if (!rule('combat-sur-la-defensive')) return; // règle optionnelle : Action « Sur la Défensive » désactivée (LDB 13 l.118)
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active) return;
      if (!canTakeAction(active)) return; // Sonné : pas d'Action (LDB 16 l.125)
      active.defensiveStance = true;
      active.aiming = false; // une autre action que le tir gâche la visée
      set({ battle: { ...markActed(get, set), action: null, log: [...get().battle!.log, ev('defensive', t('cs.defensive', { name: active.label }), active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    /** Prend le set d'armes `loadoutId` de `heroId`, Action gratuite (LDB 13 l.106) : en combat, l'actif, au plafond
     *  MAISON de 1×/tour, AUTORISÉ même Engagé (`panoplie`, `actions.json`) ; hors combat, depuis la fiche. */
    prendreLaPanoplie: (heroId: string, loadoutId: string) => {
      const s = get();
      const hero = actorIn(s, heroId);
      if (!hero) return;
      if (s.battle) {
        const refus = refusDuTourDe(s, heroId, t('cs.horsDuTour', { name: hero.label })) ?? (s.battle.loadoutSwapped ? t('agate.loadoutSwapped') : null);
        if (refus) return void refuserGesteDuSiege(get, set, refus);
      }
      if (hero.activeLoadoutId === loadoutId) return;
      const lo = hero.loadouts?.find((l) => l.id === loadoutId);
      if (!lo) return;
      loadoutSetActive(hero, loadoutId);
      recomputeLoadout(hero); // re-dérive les armes actives
      set(touchActors(get()));
      const b = get().battle;
      if (b) set({ battle: { ...b, loadoutSwapped: true, log: [...b.log, ev('detail', t('cs.draw', { name: hero.label, weapon: loadoutLabel(lo, hero) }), hero.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Action Viser (LDB table des Difficultés, 14 - _GoBack.md l.90 : +20 au prochain tir, sans jet) ──
    prendreLaVisee: () => {
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || !canTakeAction(active)) return;
      if (!active.weapons.some((w) => w.type === 'distance')) return; // viser = pour le tir
      active.aiming = true;
      set({ battle: { ...markActed(get, set), action: null, log: [...get().battle!.log, ev('visee', t('cs.aim', { name: active.label }), active.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    // Perturbante (LDB 62 l.272-274) : arme le mode « Repousser » — la prochaine attaque réussie
    // repousse d'1 m/DR AU LIEU de causer des Dégâts. Simple bascule (pas une Action).
    basculerLaRepousse: () => {
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || !active.weapons.some((w) => w.type === 'melee' && canPushback(w))) return;
      active.pushbackMode = !active.pushbackMode;
      set({ battle: { ...battle } });
    },

    // Posture de TIR pré-armée (spec HUD §1a G5) : le choix se pose AVANT toute cible, sur le
    // combattant actif (`battle.stances`), et la construction du `PendingAttack` le consomme
    // (`withArmedStance`, combatFlow). Bascule, pas une Action ; le gate est le prédicat unique de
    // la posture (`STANCE_BLOCK`), celui-là même que la case de console affiche.
    basculerLaPosture: (stance: ShootingStanceKey) => {
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active) return;
      if (STANCE_BLOCK[stance](battle, active)) return;
      const armee = battle.stances?.[active.id] ?? {};
      set({ battle: { ...battle, stances: { ...battle.stances, [active.id]: { ...armee, [stance]: !armee[stance] } } } });
    },

    // `weaponUid` DÉSIGNE l'arme rechargée, chacune son cycle (arbitrage utilisateur 2026-08-16, #2998,
    // `docs/plans/2026-08-16-hud-combat.md` : « si j ai 2 armes à distance elles gèrent chacune leur propre rechargement
    // et munition ») ; absent, la première à recharger. LDB 62 l.335 ; LDB 12 l.170-174
    rechargerLArme: (weaponUid?: string) => {
      const { battle } = get();
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active) return;
      const recharge = rechargeDuTour(active, battle, weaponUid);
      if (recharge) set({ pendingReload: jetDeRecharge(recharge.porteur, recharge.arme, battle.combatants) });
    },
    seRemettreDeLEtat: (etat: string) => {
      const { battle } = get();
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || !canTakeAction(active)) return;
      const inst = active.conditions.find((c) => c.id === etat);
      const n = inst?.value ?? 0;
      if (!inst || n <= 0) return; // pas porteur de l'État
      if (isConditionLocked(inst, active)) return; // État verrouillé : le Test ne l'ôterait pas (LDB 18)
      // Test de récupération (Empêtré « se libérer »/En flammes « se rouler », LDB 16 l.66/l.84) lu de la
      // DONNÉE (`EtatData.recover`) par la SOURCE UNIQUE `resolveRecoverTest` — Empêtré = opposé de Force
      // (escapeStrength figée prioritaire, sinon source vivante) ; En flammes = Athlétisme simple.
      const rt = resolveRecoverTest(active, etat, battle);
      if (!rt) return; // État non récupérable par Action (pas de `recover` en donnée)
      set({
        pendingStateRecovery: {
          actorId: active.id, actorName: active.label, state: etat,
          skillLabel: rt.skillLabel, skillValue: rt.skillValue, skillBase: rt.skillBase, difficulty: rt.difficulty,
          opposition: rt.opposition, requireSl: rt.requireSl,
          entangleOnFail: rt.entangleOnFail, struggleDamage: rt.struggleDamage, stacks: n,
          roll: null, opponentRoll: null, netSL: 0, success: false,
        },
      });
    },
    // La munition de `weaponUid` (absent → la 1re arme à distance), deux armes à distance portant chacune la sienne :
    // `choisirLaMunition` en dit la règle.
    approvisionnerLArme: (uid: string, weaponUid?: string) => {
      const { battle } = get();
      if (!battle) return;
      const active = activeCombatant(battle);
      if (!active) return;
      const rw = weaponUid
        ? active.weapons.find((w) => w.uid === weaponUid && w.type === 'distance')
        : armeADistanceParDefaut(active);
      if (!rw) return; // aucune arme à distance : rien à choisir
      // Chef qui SERT cette pièce : le cycle de charge vit sur la PIÈCE — la bascule doit la décharger ELLE.
      choisirLaMunition(active, rw, uid, active.mannedPoste?.item.uid === rw.uid ? active.mannedPoste : undefined);
      set({ battle: { ...battle } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    /** Dépense un Point de Détermination du combattant `combattantId` pour l'une de ses trois options (LDB 17 l.59-61),
     *  l'actif à sa barre, un défenseur à sa modale, le porteur d'un jet de Psychologie dans sa fenêtre
     *  (`fenetreDeDetermination`), un acteur de l'IA Brisé qui se ressaisit : verdict `refusDeDetermination`, celui de
     *  l'immunité `refusDImmunite`, dit au siège qui pilote le porteur (`controlsCombatant`), muet pour un acteur de
     *  l'IA ; les Critiques ignorés durent des Rounds, et se refusent hors combat. L'immunité frappe le jet de
     *  Psychologie ouvert du porteur (`jetImmunise`). */
    depenserLaDetermination: (combattantId: string, option: OptionDeDetermination, etat?: string) => {
      const s = get();
      const porteur = actorIn(s, combattantId);
      if (!porteur) return;
      const refus = option === 'immuniserALaPsychologie' ? refusDImmunite(s, porteur)
        : refusDeDetermination(porteur, option === 'retirerUnEtat' ? etat : undefined)
          ?? (option === 'retirerUnEtat' ? (etat ? undefined : t('agate.stateNotCarried')) : s.battle ? undefined : t('cs.determinationHorsCombat'));
      if (refus) {
        if (controlsCombatant(s, porteur)) refuserGesteDuSiege(get, set, refus);
        return;
      }
      const ligne = depenseDeDetermination(porteur, option, etat, s.gameTime);
      if (!ligne) return; // rien à lever : le point n'est pas débité
      const jet = option === 'immuniserALaPsychologie' ? jetImmunise(get(), porteur) : null;
      set({ ...jet?.patch, ...touchActors(get()) });
      journaliser(get, set, [ligne, ...(jet?.ligne ? [jet.ligne] : [])], 'information', { actorId: porteur.id });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Ramasser un objet d'un décor : en combat, un à la fois, au prix de l'Action (`ramassage` de `actions.json`) ──
    /** Ramasse l'objet `key` du décor `entityId`. Hors combat, un objet posé au sol (`ramasserHorsCombat`). En combat,
     *  l'actif (`heroId`, s'il est nommé) au verdict de l'offre `ramassage` (`refuseParSonEntree`), à portée (`aPorteeDe`). */
    ramasserLObjet: (entityId: string, key: string, heroId?: string) => {
      const s = get();
      if (!s.battle) return ramasserHorsCombat(get, set, entityId, key, heroId);
      const barre = barreDuGeste(s);
      if (barre.forme !== 'ouverte') return void refuserGesteDuSiege(get, set, barre.raison);
      const { active, battle } = barre;
      if (heroId !== undefined && heroId !== active.id) return void refuserGesteDuSiege(get, set, t('cs.ramasserHorsDuTour', { name: actorIn(s, heroId)?.label ?? heroId }));
      if (refuseParSonEntree(get, set, 'ramassage', active, battle, { entityId, pickKey: key })) return;
      const scene = s.scene!;
      const ent = scene.entities.find((e) => e.id === entityId && e.kind === 'prop');
      const pickable = ent && entityPickables(ent, s.flags, objetDuNarratif(s.campaignNarratif), s.objetsAuSol).find((p) => p.key === key);
      if (!ent || !pickable) return void refuserGesteDuSiege(get, set, t('pf.ramasserInconnu'));
      if (!active.pos || !aPorteeDe(active.pos, ent)) return void refuserGesteDuSiege(get, set, t('pf.ramasserHorsDePortee', { item: pickable.label }));
      if (s.objetsAuSol[entityId]) {
        const label = ramasserDuSol(get, set, entityId, active.id);
        set({ battle: { ...markActed(get, set), action: null, log: [...get().battle!.log, ev('objet', t('cs.pickup', { name: active.label, label }), active.id)] } });
        bus.emit(EVT.SCENE_DIRTY);
        return;
      }
      // Clé = `<actionId>:eff:<index dans flowEffects(action.flow)>` (cf. `entityPickables`) : c'est l'ACTION authorée
      // qu'on grappille, une feuille donneuse (`giveTrapping`, `giveMoney`) encore jouable. L'effet de JEU donne (#2312) ;
      // une feuille LITTÉRALE ne porte aucun canal de dés : le retrait de la feuille ramassée qui suit ne peut pas passer
      // devant un dé (#1508).
      const [actionId, , idxStr] = key.split(':');
      const action = actionsAuthorees(ent, s.flags).find((a) => a.id === actionId)!;
      const idx = Number(idxStr);
      const eff = flowEffects(action.flow)[idx];
      const label = pickable.label;
      nePeutPasDifferer(applyEffects(get, set, [eff.type === 'giveTrapping' ? { ...eff, heroId: active.id } : eff]), 'combatSlice.pickupItem');
      // La feuille prise se FERME par un drapeau (`cleFeuilleRamassee`), jamais en réécrivant le Flow de
      // l'action : le document de scène est de la DONNÉE d'auteur, l'état de la partie vit dans les
      // drapeaux — et c'est le même drapeau que la fouille en exploration lit pour ne pas redonner ce
      // qui est déjà pris (`flowRestant`).
      set((s) => ({ flags: { ...s.flags, [cleFeuilleRamassee(entityId, action.id, idx)]: true } }));
      // Pool de ramassables vidé : `consume` → le décor disparaît ; sinon il reste (ses Effets non-objet
      // — journal/document — restent fouillables en exploration ; pas de sens à les grappiller en combat).
      if (entityPickables(ent, get().flags, objetDuNarratif(get().campaignNarratif), get().objetsAuSol).length === 0 && action.consume) {
        removeEntity(get, set, entityId);
        set({ battle: { ...markActed(get, set), action: null, log: [...get().battle!.log, ev('objet', t('cs.pickup', { name: active.label, label }), active.id)] } });
      } else {
        set({ scene: { ...scene }, battle: { ...markActed(get, set), action: null, log: [...get().battle!.log, ev('objet', t('cs.pickup', { name: active.label, label }), active.id)] } });
      }
      bus.emit(EVT.SCENE_DIRTY);
    },

    // `jetAnnuler('attaque')` (« Annuler » / défaire-charge) est GÉNÉRÉ par la fabrique
    // (`FLOWS.attaque.onCancel`, cf. la liste de verbes ci-dessus) — plus d'action bespoke ici.
    // PILONNAGE INDIRECT (« viser une case », AA 10 l.169/171) : la case d'impact est déposée par le placeur
    // ('siege', commitPlacedZone). Ouvre la modale de tir de la pièce indirecte servie (`pendingAttack` siège) :
    // le JET de tir (DR) reste l'attaque NORMALE (Chance/Résilience par la cascade), mais la touche DÉTONE sur
    // la case — l'Explosion frappe tout le rayon (résolution dans jetValider('attaque')). Cible-repère = ennemi le plus
    // proche de l'impact (bande de portée/DR) ; aucune dans le rayon → tir à vide annoncé, sans détonation.
    poserLePointDImpact: (pt: Pt) => {
      const { battle, pendingSiegeAim: sa } = get();
      if (!battle || battle.over || !sa) return;
      const gunner = inBattleId(battle, sa.gunnerId);
      get().fenetreFermer('viseeDeSiege'); // referme le placeur — MÊME porte que la sortie d'interlude
      if (!gunner || isOutOfAction(gunner) || !canTakeAction(gunner) || battle.acted) return;
      const aim = battle.combatants
        .filter((c) => c.kind !== gunner.kind && !isOutOfAction(c) && c.pos && chebyshev(pt, c.pos) <= sa.radius)
        .sort((a, b) => chebyshev(pt, a.pos!) - chebyshev(pt, b.pos!))[0];
      if (!aim) { get().ecrireAuJournal(t('cf.siegeSansCible', { name: gunner.label })); return; }
      // Pilonnage : la pièce est SERVIE (hors loadout main/secondaire) → `openAttackCascade` ne gate jamais un
      // canon monté (`attackHandGate` = null), mais passe par le MÊME point partagé que les autres attaques.
      openAttackCascade(get, set, { attackerId: gunner.id, targetId: aim.id, location: null, result: null, weaponUid: sa.weaponUid, center: { ...pt }, siege: true }, 'Pilonnage', 'feu/explosif');
    },
    frapperEnBalayage: (targetId: string) => {
      const pc = get().pendingCleave;
      if (!pc || !ciblesDuBalayage(get()).some((t) => t.id === targetId)) return;
      poserLaFrappeSuivante(get, set, { attackerId: pc.attackerId, targetId, location: null, result: null, cleave: true });
    },
    frapperDeLaSecondeArme: (targetId: string) => frapperDeLaSeconde(get, set, targetId, false),


    lancerLeCombat: (encounterId: string, onVictory?: Flow, opts?: { noSurprise?: boolean }) => {
      const { scene, party, partyPos } = get();
      if (!scene) return;
      const rencontre = scene.encounters.find((e) => e.id === encounterId);
      if (!rencontre) return;
      const { enc, victoire } = structuredClone({ enc: rencontre, victoire: onVictory }); // #2097
      // Couture UNIVERSELLE de suspension (noyau/cascade.ts) : un combat qui s'ouvre PENDANT une
      // cascade active (ex. un abordage déclenché par l'applier d'une étape de voyage) la PARQUE au
      // lieu de la perdre au `resetFields('combatStart')` ci-dessous — jamais un cas spécial « mer ».
      suspendActiveCascade(get, set);
      // Placer les héros près de leur position de groupe, les ennemis selon l'encounter.
      // Couture d'ENTRÉE (`entreeEnRencontre`, #2312) ; on n'instancie pas les morts/éjectés.
      const livingParty = party.filter((h) => !h.dead && !h.outOfRencontre);
      // Les cases des membres de la rencontre ne reçoivent aucun héros (`formationDeCombat`).
      const prises = new Set((enc.members ?? []).flatMap((m) => {
        const ent = scene.entities.find((e) => e.id === m.entityId);
        return ent?.pos ? [tileKey(ent.pos.x, ent.pos.y, ent.z ?? 0)] : [];
      }));
      const formation = formationDeCombat(scene, partyPos, livingParty.length, prises);
      const heroes = livingParty.map((h, i) => {
        const c: Combatant = { ...entreeEnRencontre(h), pos: formation[i] };
        // Re-dérive les armes ACTIVES depuis les items persistés : une arme usée/détruite au combat
        // précédent (damageTaken/destroyed sur l'ItemInstance) reste usée/détruite (LDB 62 l.135).
        if (c.items?.length) recomputeLoadout(c);
        // Armes à distance CHARGÉES au début du combat (le cycle de charge ne joue que pour les armes à
        // Recharge) — CHACUNE la sienne. Le CHOIX de munition n'est PAS réinitialisé : la munition est un
        // état de l'ARME (arbitrage utilisateur 2026-08-16, #2998 : « si j ai 2 armes à distance elles gèrent
        // chacune leur propre rechargement et munition ») et se fixe au chargement
        // (AskUserQuestion 2026-08-16), donc celui posé au
        // combat précédent (ou à l'équipement) tient ; `loadWeapon` capture le choix courant, et
        // `selectedAmmo` retombe sur la 1re compatible quand il n'y en a aucun.
        for (const rw of c.weapons.filter((w) => w.type === 'distance')) loadWeapon(c, rw);
        return c;
      });
      // Chaque membre RÉFÉRENCE une entité de la scène. L'entité PORTE le profil/apparence/arme/traits
      // — on résout (membre + entité appariés), puis on spawne en CONSERVANT l'id de l'entité :
      // identité UNIFIÉE explo↔combat (Combatant.id === SceneEntity.id),
      // pas de figurant dupliqué, et réconciliation post-combat directe (finalizeBattle).
      const byEntity = new Map(scene.entities.map((e) => [e.id, e]));
      const roster = (enc.members ?? [])
        .map((m) => ({ m, ent: byEntity.get(m.entityId) }))
        .filter((r): r is { m: typeof r.m; ent: SceneEntity } => !!r.ent);
      const enemies = roster.map(({ ent }) => ficheDEntite(ent, presetDuNarratif(get().campaignNarratif)));
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
        if (m.side === 'allie') enemies[i].kind = 'heros';
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
      // un Combattant inerte à PV (kind 'pnj' → ne fausse pas la fin de combat, cf. checkBattleOver qui ne
      // compte que les 'ennemi'). Son `structureEdge` mémorise l'arête à ABATTRE (BRÈCHE) à sa destruction ;
      // une structure déjà abattue n'est pas ré-instanciée, une porte secrète masquée (`porteMasquee`) non plus.
      // Source = WallSeg (≠ SceneEntity) → enrôlée ICI.
      const structures = (scene.walls ?? [])
        .filter((w) => !!w.structure && !structureIsDown(scene, w) && !porteMasquee(scene, w))
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
          'id' in mp.ref ? { ref: mp.ref.id } : { statblock: mp.ref.custom },
          mp.uid,
          hero.pos ? { ...hero.pos } : { x: 0, y: 0 },
          { charsRolled: mp.charsRolled, learnedTraits: mp.learnedTraits },
        );
        mount.kind = 'heros'; // allié — exclue des DEUX bornes de fin de combat : `enemiesAlive` (kind:'ennemi'
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
        const allyHull = all.find((c) => estNavire(c) && c.kind === 'heros' && (!vessel0 || c.creatureId === vessel0.vehicleId))
          ?? all.find((c) => estNavire(c) && c.kind === 'heros');
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
        // et se taisent d'elles-mêmes ; `lancerLeRound` pose le vrai tour (LDB 17 l.25).
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
        onVictory: victoire ?? enc.onVictory,
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
      // Météo du JOUR estampillée sur chaque combattant (#341 ; Précipitations MDG 13 l.185) : SOURCE des
      // canaux `weatherTestMods` et `precipitationTestMods` — AVANT tout jet de ce combat.
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
      get().orienterLesCombattants();
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Écran de victoire : assignation du butin (même flux que le marchand) + fermeture ──

    armerLeMode: (a: BattleActionMode | null) => {
      const barre = barreDuGeste(get());
      if (barre.forme !== 'ouverte') return void refuserGesteDuSiege(get, set, barre.raison);
      const { active, battle } = barre;
      // État qui verrouille l'Action (LDB 16 l.52) : le gate du registre `hors-verrou-d-etat`, celui des offres.
      // Seule la fermeture (null) passe.
      const verrou = ACTION_GATES['hors-verrou-d-etat']({ active, battle, gameTime: get().gameTime });
      if (!verrou.ok && a !== null) return void refuserGesteDuSiege(get, set, garanti(verrou.reason, 'hors-verrou-d-etat', 'refus du mode'));
      // Pas d'Action ce tour (Sonné LDB 16 l.125 / Surpris l.135 — lu en DONNÉES via `canTakeAction`/gating,
      // jamais une branche par-nom) ; les manœuvres gratuites (Se relever, Se désengager…) sont des slots
      // DIRECTS qui n'appellent pas armerLeMode.
      const horsDEtat = a !== null ? refusHorsDEtatDAgir(active) : null;
      if (horsDEtat) return void refuserGesteDuSiege(get, set, horsDEtat);
      // Quitter le mode incantation oublie le sort sélectionné. Le déplacement et l'attaque sont
      // implicites au clic (cliquerLaCaseDuCombat/cliquerLeCombattant), sans mode : le reachable stocké ne
      // porte que les budgets spéciaux (Course, post-Désengagement), on ne le touche pas ici.
      const selectedSpellId = a === 'incantation' ? battle.selectedSpellId : null;
      // Changer (ou quitter) le mode armé oublie le PORTEUR élu du mode Dissiper : son panneau de
      // paramètre n'a plus de déclencheur allumé d'où naître.
      // Le mode Pousser peint SA portée (`reachable`, `pousserLEngin`) : le quitter la purge.
      const reachable = battle.action === 'poussee' && a !== 'poussee' ? new Map() : battle.reachable;
      set({ battle: { ...battle, action: a, selectedSpellId, preview: null, reachable }, dispelCarrierId: null });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // ── Guérison (LDB 09 l.254-269) — soin de Blessures / arrêt d'Hémorragie ──
    // Variante AA (AA 07 l.9) : retirer un État Hémorragique passe par un Test de Guérison
    // Accessible (+20) au lieu d'Intermédiaire (+0) — le soin de Blessures reste Intermédiaire dans
    // les deux versions. Gaté par la règle optionnelle `combat-aa-blessures` (policy.ts).

    ouvrirLaGuerison: (targetId: string) => {
      // La barre du geste (`barreDuGeste`) ; le Soin armé.
      const barre = barreDuGeste(get());
      if (barre.forme !== 'ouverte') return void refuserGesteDuSiege(get, set, barre.raison);
      const { active: healer, battle } = barre;
      if (refuseParSonEntree(get, set, 'soins', healer, battle)) return;
      if (battle.action !== 'soins') return void refuserGesteDuSiege(get, set, t('heal.soinNonArme')); // le commit du mode armé (`HEAL_MODE`)
      const target = inBattleId(battle, targetId);
      if (!target) return void refuserGesteDuSiege(get, set, t('medic.patientIntrouvable'));
      // L'acte d'ouverture : le premier que le soigneur ouvre sur la cible ; il se change par `jetRegler('soins', 'mode')`.
      const mode = modesDOuverture(target, healer)[0] ?? HEAL_MODES[0];
      const ouverture = soinDOuverture(healer, mode);
      const raison = raisonDeModeDeSoinEnCombat(target, mode) ?? (ouverture ? null : refusDuTestDeSoin(healer, mode, { test: 'guerison', bandages: false }));
      if (raison || !ouverture) return void refuserGesteDuSiege(get, set, garanti(raison, mode, 'refus du soin'));
      const { skillValue, difficulty, ligne } = jetDuSoigneur(healer, ouverture.test, mode);
      set({
        pendingHeal: {
          healerId: healer.id, healerName: healer.label, targetId: target.id, targetName: target.label,
          mode, intBonus: bonus(effectiveChar(healer, 'intelligence')),
          // Le siège du soigneur ouvre : il n'engage que les Bandages de son héros (réglage `soins.bandages`).
          test: ouverture.test, bandagesDe: ouverture.bandages ? healer.id : null,
          skillValue, difficulty, roll: null, success: false, sl: 0,
          ligne, ...cibleMesuree(ligne),
        },
        battle: { ...battle, action: null },
      });
    },

    // ── Contre-mesure « Asperger d'eau » (MDG 16 l.19, #497) — Créature marine hors de l'eau ──

    /** « Asperger d'eau » : Action DIRECTE (aucun jet, aucune modale) — pose `wateredThisRound` sur
     *  une Créature marine adjacente hors de l'eau, consomme l'Action. `cibleId` explicite (choix
     *  parmi plusieurs candidats) sinon le 1ᵉʳ candidat éligible (MÊME patron que `servirLePoste`).
     *  Gate : l'aspergeur PORTE un contenant d'eau (`hasWaterContainer`, trapping `waterContainer`). */
    aspergerDEau: (cibleId?: string) => {
      const battle = get().battle;
      if (!battle || battle.over) return;
      const active = activeCombatant(battle);
      if (!active || battle.acted || !canTakeAction(active) || !hasWaterContainer(active)) return;
      const candidates = waterSprayCandidates(active, campAuContact(battle, active));
      const target = cibleId ? candidates.find((c) => c.id === cibleId) : candidates[0];
      if (!target) return;
      target.wateredThisRound = true;
      finishPlayerAction(get, set, [t('cs.waterSpray', { name: active.label, target: target.label })], 'detail');
    },

    /** Incante le sort `spellId` de `lanceurId` (LDB 46). En combat, la cible se désigne au clic : le sort ARME le mode
     *  d'incantation de l'actif, et un sort de ZONE ouvre sa modale DIRECTEMENT (flux « jet puis pose », LDB 47 l.15).
     *  Hors combat, le lanceur du groupe cible `cibleId` (lui-même par défaut), un sort NON offensif : les Projectiles
     *  magiques exigent une cible ennemie. */
    incanterLeSort: (lanceurId: string, spellId: string, cibleId?: string, fromGrimoire?: boolean) => {
      const s = get();
      const battle = s.battle;
      const lanceur = actorIn(s, lanceurId);
      const spell = findSpellById(spellId);
      if (!lanceur || !spell) return;
      if (battle) {
        const refus = refusDuTourDe(s, lanceur.id, t('cs.horsDuTour', { name: lanceur.label })) ?? refusActionDepensee(battle);
        if (refus) return void refuserGesteDuSiege(get, set, refus);
        set({ battle: { ...battle, action: 'incantation', selectedSpellId: spellId, reachable: new Map() } });
        castZoneSpell(get, set, lanceur, spellId); // no-op si le sort n'est pas une ZdE chiffrable
        bus.emit(EVT.SCENE_DIRTY);
        return;
      }
      if (isMagicMissile(spell)) {
        get().ecrireAuJournal(t('cs.magicMissileNeedsTarget', { spell: spell.label }));
        return;
      }
      const cible = s.party.find((c) => c.id === cibleId) ?? lanceur;
      castSpell(get, set, lanceur, cible, spellId, fromGrimoire); // pose `pendingCast` (missile:false, focused selon caster.focus)
    },

    /** Le porteur du consommable `uid` (`porteurDeLObjet`) l'utilise (potion, drogue, bandage), Action gratuite
     *  (LDB 13 l.106) : consommé AVANT l'effet (dose unique), son Flow joué par la voie du contexte (`runConsumable` : un
     *  Test « au boire » devient en combat une étape de cascade influençable, hors combat il ouvre sa modale). En combat,
     *  l'actif à sa barre ; hors combat, un héros du groupe depuis sa fiche. */
    utiliserLObjet: (uid: string) => {
      const porteurId = porteurDeLObjet(get(), uid);
      if (!porteurId) return void refuserGesteDuSiege(get, set, t('pf.objetSansPorteur'));
      const s = get();
      const battle = s.battle;
      const porteur = actorIn(s, porteurId);
      if (!porteur) {
        const heros = s.party.find((h) => h.id === porteurId);
        return void refuserGesteDuSiege(get, set, heros ? t('cs.consommableHorsRencontre', { name: heros.label }) : t('pf.objetHorsDesHeros'));
      }
      if (battle) {
        const refus = refusDuTourDe(s, porteurId, t('cs.consommableHorsDuTour', { name: porteur.label }));
        if (refus) return void refuserGesteDuSiege(get, set, refus);
      }
      const it = (porteur.items ?? []).find((i) => i.uid === uid)!;
      if (!isConsumable(it)) return void refuserGesteDuSiege(get, set, t('cs.objetNonConsommable', { item: it.label }));
      if (refuseSi(get, set, () => refusDeConsommer(porteur, it))) return;
      porteur.items = (porteur.items ?? []).filter((i) => i.uid !== uid);
      porteur.aiming = false; // une autre action que le tir gâche la visée
      set(touchActors(get()));
      journaliser(get, set, [t('cs.useConsumable', { name: porteur.label, item: it.label })], 'objet', { actorId: porteur.id });
      runConsumable(get, set, porteur, it);
      const b = get().battle;
      // Les lignes du Flow (inline) rejoignent le journal du combat.
      if (b) set({ battle: { ...b, action: null, log: [...b.log, ...drainPendingLog(get, set)] } });
      bus.emit(EVT.SCENE_DIRTY);
    },

    // Test Étendu SÉQUENTIEL (LDB 12) : chaque Round est un slot du flux multi (fabrique UNIQUE).
    // « Une situation = une modale » : le Test étendu EST une cascade à une étape `jet:'testEtendu'`,
    // rendue par `CascadeModal` (via `useExtendedTestJetProps`). `pendingExtendedTest` coexiste comme
    // porteur de données (les Rounds y vivent) ; `jetValider('testEtendu')` ferme les deux à la réussite.

    // Incantation OPPOSÉE (multijet `FLOWS.opposition`) : chaque cible oppose son Test ; cible IA
    // = rangée témoin (jet auto-roulé à l'ouverture, cf. openCastOpposition). Mêmes 6 verbes que les autres flux.
    // Préfixe store `opposition` ≠ clé de flux `castOpposition` (handler passé explicitement).
    /** Focalise le sort d'Arcane ou de Domaine `spellId` de `lanceurId` (Test étendu de Focalisation, LDB 46) : OUVRE
     *  la modale. En combat, l'actif à sa barre ou l'IA pour elle-même (`runEnemyAI`), au verdict de l'entrée
     *  `focalisation` ; hors combat, un lanceur du groupe. */
    focaliserLeSort: (lanceurId: string, spellId: string) => {
      const s = get();
      const battle = s.battle;
      const lanceur = actorIn(s, lanceurId);
      const spell = findSpellById(spellId);
      if (!lanceur || !spell) return;
      if (battle) {
        if (aiDriven(s, lanceur)) {
          // L'IA pour elle-même (`runEnemyAI`) : aucun siège ne la pilote, à qui le refus se dirait.
          if (combatBusy(s) || battle.over || activeCombatant(battle)?.id !== lanceur.id) return;
        } else {
          const refus = refusDuTourDe(s, lanceur.id, t('cs.horsDuTour', { name: lanceur.label }));
          if (refus) return void refuserGesteDuSiege(get, set, refus);
        }
        // Action, sort focalisable, Compétence, contrecoup (LDB 46/40) : le verdict de l'entrée `focalisation`.
        if (refuseParSonEntree(get, set, 'focalisation', lanceur, battle, { spellId })) return;
      } else {
        if (!isArcaneSpell(spell)) {
          get().ecrireAuJournal(t('cs.cannotFocus'));
          return;
        }
        const fblocked = castBlockedBy(lanceur, 'focalisation');
        if (fblocked) {
          get().ecrireAuJournal(t('cs.focusBlocked', { name: lanceur.label, reason: fblocked }));
          return;
        }
      }
      set({ pendingFocus: { casterId: lanceur.id, spellId: spell.id, result: null } });
    },

    /** ÉLIT (ou oublie) le PORTEUR dont on va dissiper un Sort — porte UNIQUE de `dispelCarrierId` :
     *  le clic-token du mode Dissiper l'appelle, la fermeture du panneau-paramètre aussi. Aucun jet,
     *  aucune ressource : c'est un choix d'écran, annulable gratuitement. */
    designerLeSupport: (carrierId: string | null) => set({ dispelCarrierId: carrierId }),
    /** Dissipe le Sort permanent `spellId` que porte `porteurId` (LDB 46 l.158-160), pour l'Action de `lanceurId` :
     *  en combat comme hors combat, la règle n'étant pas bornée au combat (#461). Action RÉPÉTÉE chaque Round en combat
     *  (comme la Focalisation) ; le DR cumule sur `caster.dispel` jusqu'au NI. */
    dissiperLeSort: (lanceurId: string, spellId: string, porteurId: string) => {
      const s = get();
      const battle = s.battle;
      const lanceur = actorIn(s, lanceurId);
      if (!lanceur) return;
      if (battle) {
        const refus = refusDuTourDe(s, lanceur.id, t('cs.horsDuTour', { name: lanceur.label }));
        if (refus) return void refuserGesteDuSiege(get, set, refus);
        if (refuseParSonEntree(get, set, 'dissipation', lanceur, battle)) return;
      }
      if (!actorHasSkill(lanceur, { id: 'langue', spec: 'magick' })) return void refuserGesteDuSiege(get, set, t('cs.cannotDispel'));
      const population = battle ? battle.combatants : s.party;
      const target = dispellableSpellsOn(population).find((d) => d.spellId === spellId && d.casterId === porteurId);
      if (!target) return void refuserGesteDuSiege(get, set, t('offre.sansCandidatDuContexte'));
      // SOUTIEN « même Domaine » (LDB 46 l.162) : les AUTRES héros possédant Langue (Magick) ET partageant un Domaine
      // (Vent) avec le meneur l'assistent (+10 chacun, plafond Bonus d'Int), par la primitive `soutienBonus` (LDB 12) ;
      // en combat, l'adjacence (l.196) par le MÊME prédicat `distanceDeContact` que `openSkillTest`.
      // `Combatant.spells` = ids STABLES au runtime → résolution par id SEULE (pas de repli libellé : interdit).
      const domainsOf = (h: Combatant) => new Set((h.spells ?? []).map((id) => findSpellById(id)?.subType).filter(Boolean) as string[]);
      const mine = domainsOf(lanceur);
      const sup = soutienDetail(population, lanceur, { skill: { id: 'langue', spec: 'magick' }, characteristic: 'intelligence' },
        (c) => c.kind === lanceur.kind && [...domainsOf(c)].some((d) => mine.has(d))
          && (!battle || !lanceur.pos || (!!c.pos && distanceDeContact(lanceur, c) <= 1)));
      const value = testValue(lanceur, { skill: { id: 'langue', spec: 'magick' } }) + sup.bonus;
      set({
        pendingDispel: {
          casterId: lanceur.id, spellId, spellCasterId: porteurId, label: target.label, ni: target.ni, value,
          ligne: ligneDeDissipation(lanceur, value, sup),
          result: null,
        },
        // Le paramètre est choisi : le panneau borné qui l'a servi n'a plus lieu d'être.
        dispelCarrierId: null,
      });
    },
    // Psychologie de COMBAT (LDB 21 l.9, l.25) : passes de Round openRoundStartPsych / openRoundEndCascade,
    // applier 'psychologieDeCombat', résolue par les verbes de jet de la cascade. La Détermination (LDB 17 l.59) est offerte
    // dans la fenêtre de la bande (`fenetreDeDetermination`), jouée par `depenserLaDetermination` sur la rangée.
    // Psychologie À LA RENCONTRE (couture C, LDB 21) : cascade équivalente, applier 'psychologieDeRencontre',
    // ouverte par `openEncounterPsych` à l'entrée de scène.

    // ── Entrée en Frénésie d'un héros (LDB 21 l.31-35) : Test de FM, succès → +1 BF / immunité psy / attaque obligatoire ──

    entrerEnFrenesie: () => {
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || !peutEntrerEnFrenesie(active)) return;
      // OUVRE la modale — le Test de FM se fait au clic « Lancer ».
      set({ pendingFrenzy: { combatantId: active.id, result: null }, battle: { ...battle, action: null } });
    },

    // ── Cumuler l'Avantage par une Compétence (LDB 09 l.305-308 : Intuition/Savoir/Survie → Int, Prière → Soc) ──
    // « Chaque Round que vous passez à [observer/prier]… réussissant un Test… vous gagnez +1 Avantage »
    // → une ACTION dont la modale de Test STANDARD (cascade, `pendingTest`) octroie l'Avantage plafonné
    // (`combatAdvantage` lu par `jetValider('test')`). Data-driven : l'action n'existe que si `skillAdvantageCap`
    // (donnée `SkillData.combatAdvantage`) est > 0 — aucune Compétence nommée en dur.
    gagnerLAvantage: (skillId: string) => {
      const battle = get().battle;
      if (!battle || battle.over || battle.acted) return;
      const active = activeCombatant(battle);
      if (!active || !canTakeAction(active)) return;
      const cap = skillAdvantageCap(active, skillId);
      if (cap <= 0 || (active.advantage ?? 0) >= cap) return; // pas d'application « Avantage », ou déjà au plafond de la méthode
      const sd = byId('skill', skillId);
      // Le plafond est une DONNÉE PAR COMPÉTENCE (`SkillData.combatAdvantage.cap`, appliquée par
      // `skillAdvantageCap`) : Intuition relève de l'Initiative mais plafonne au Bonus d'Intelligence
      // (LDB 09 l.305+308). L'enjeu nomme donc CETTE Caractéristique — id en donnée, label à l'affichage.
      const capChar = sd?.combatAdvantage ? CHAR_LABELS[sd.combatAdvantage.cap] : '';
      set({ battle: { ...battle, action: null } });
      // COUTURE UNIQUE (`openSkillTest`) : l'observateur reste l'acteur imposé (`actorId`), et son
      // Test est PERSONNEL — `noSupport` (LDB 09 l.308, LDB 12 l.197).
      openSkillTest(get, set,
        { skill: { id: skillId }, difficulty: 'intermediaire', label: t('cs.skillAdvantageTest'), noSupport: true, stake: combatStakeRef('competence-avantage', { entryId: skillId, values: { capChar } }) },
        combatConditionCtx(active, {}), EMPTY_FLOW, EMPTY_FLOW, EMPTY_FLOW,
        { actorId: active.id, combatAdvantage: { combatantId: active.id, cap }, cancellable: true });
    },

    // Résilience « Je ne faillirai pas ! » (LDB 17 l.68) du flux `incantation` (forceSuccess/dé choisi) —
    // cycle UNIFIÉ par la fabrique rollFlow. (`attack`/`defense` plus haut ; `test` reste côté store.)
  };
}

/** Les choix des fenêtres du combat (`CorpsDesChoix`) : `fenetreChoisir` les joue, parmi les valeurs que l'état ouvre
 *  (`OUVERTS_DU_CHOIX`). */
export function choixDuCombat(get: Get, set: Set): Pick<CorpsDesChoix, 'destin' | 'cibleDeMonture' | 'debutDuRound'> {
  /** Le Point de Destin sacrifié (LDB 17 l.29-32) résout la suspension `pendingFateSave`. */
  const issues = {
    eviter: () => {
      const p = get().pendingFateSave;
      if (!p) return;
      const hero = porteurParId(get(), p.heroId);
      set({ pendingFateSave: null });
      if (!hero) return;
      hero.fate = (hero.fate ?? 0) - 1;
      if (p.restoreWounds != null) hero.wounds.current = p.restoreWounds; // annule tout le coup (restaure les PB)
      hero.criticalWounds = Math.max(0, (hero.criticalWounds ?? 0) - 1);
      const anim = acquireAnimositeOnFate(get, set, hero, p.foeId); // ADE II 09 l.15
      journaliser(get, set, [t('cs.fateDodge', { name: hero.label })], 'information', { actorId: hero.id });
      if (anim) journaliser(get, set, [anim], 'peur', { actorId: hero.id });
      if (get().battle) resumeEnemyTurn(get, set);
      else reprendreHorsBatailleApresLeDestin(get, set);
    },
    survivre: () => {
      const p = get().pendingFateSave;
      if (!p) return;
      const hero = porteurParId(get(), p.heroId);
      set({ pendingFateSave: null });
      if (!hero) return;
      hero.fate = (hero.fate ?? 0) - 1;
      if (get().battle) {
        hero.outOfRencontre = true; // survit mais éjecté de la rencontre (vivant)
        hero.exitReason = 'destin'; // #237 : lu « hors-combat » (endState)
      }
      if (!hero.conditions.some((c) => c.id === COND.inconscient)) addCondition(hero, COND.inconscient);
      const anim = acquireAnimositeOnFate(get, set, hero, p.foeId); // ADE II 09 l.15
      journaliser(get, set, [t('cs.fateFlee', { name: hero.label })], 'information', { actorId: hero.id });
      if (anim) journaliser(get, set, [anim], 'peur', { actorId: hero.id });
      if (get().battle) reprendreApresLeDestin(get, set, p.source);
      else reprendreHorsBatailleApresLeDestin(get, set);
    },
    accepter: () => {
      const p = get().pendingFateSave;
      if (!p) return;
      const hero = porteurParId(get(), p.heroId);
      set({ pendingFateSave: null });
      if (hero) {
        hero.dead = true;
        journaliser(get, set, [t('cs.succumb', { name: hero.label })], 'mort', { actorId: hero.id });
      }
      if (get().battle) reprendreApresLeDestin(get, set, p.source);
      else reprendreHorsBatailleApresLeDestin(get, set);
    },
  } satisfies Record<ChoixDesFenetres['destin']['issue'], () => void>;
  return {
    destin: { issue: (issue) => issues[issue]() },
    // LDB 14 l.181 : l'attaque ou la charge se relance sur l'id choisi, la modale court-circuitée (`skipMountChoice`).
    cibleDeMonture: {
      cible: (id) => {
        const pm = garanti(get().pendingMountTarget, id, 'cible du couple monté');
        set({ pendingMountTarget: null });
        // L'intention du clic d'origine revient avec la relance (même raison que le gate de Peur).
        get().cliquerLeCombattant(id, { skipMountChoice: true, intentionId: pm.intentionId });
      },
    },
    debutDuRound: {
      // LDB 17 l.25, LDB 62 l.298-300 : en tête de l'ordre du Round, 1 Chance sauf arme Rapide.
      promouvoir: (heroId) => {
        const battle = garanti(get().battle, heroId, 'bataille de la pause');
        const hero = garanti(inBattleId(battle, heroId), heroId, 'héros promu');
        const free = freeActFirst(hero);
        if (!free) hero.fortune = (hero.fortune ?? 0) - 1;
        const order = [heroId, ...battle.order.filter((id) => id !== heroId)];
        set({ battle: { ...battle, order, log: [...battle.log, ev('information', t('cs.actFirst', { name: hero.label, reason: free ? t('cs.reasonFast') : t('cs.reasonLuck') }), hero.id)] } });
        bus.emit(EVT.SCENE_DIRTY);
      },
      // LDB 11 l.97-103 : le tir part au clic du combattant visé (`declencherLeTirPreventif`).
      viser: (heroId) => set({ preemptAiming: heroId }),
    },
  };
}

/** Les réglages des jets du combat (`CorpsDesReglages`) : `jetRegler` les joue, dans leur phase (`REGLAGES_DU_JET`). */
export function reglagesDuCombat(get: Get, set: Set): Pick<CorpsDesReglages, 'attaque' | 'defense' | 'incantation' | 'cascade' | 'contreSort' | 'desengagement' | 'auContact' | 'empoignade' | 'soins' | 'battement' | 'distraire' | 'manoeuvre' | 'manoeuvreDuNavire' | 'chansonDeMarin'> {
  /** Un champ de `pendingAttack` posé tel quel. */
  const attaque = <K extends 'location' | 'harpoonRopeCut' | 'withhold' | 'grapple'>(champ: K) => (v: PendingAttack[K]) => {
    const pa = get().pendingAttack;
    if (pa) set({ pendingAttack: { ...pa, [champ]: v } });
  };
  /** Les pas de Surincantation de l'axe `axis` (`REGLAGE_DE_L_AXE`), refusés par `refusDuPasDeSurincantation`, que la
   *  fenêtre lit aussi. L'EFFET d'un pas est SOURCE-AWARE (`engine/overcast.ts`). */
  const surincantation = (axis: OvercastAxis) => (pas: number) => {
    if (refuseSi(get, set, (s) => refusDuPasDeSurincantation(s, axis, pas))) return;
    const pc = garanti(get().pendingCast, 'pendingCast', 'Surincantation');
    const spell = garanti(findSpellById(pc.spellId), pc.spellId, 'Surincantation');
    const source = overcastSourceOf(spell);
    const oc = pc.overcast ?? { range: 0, zone: 0, duration: 0, targets: 0, damage: 0 };
    const next = { ...oc, [axis]: pas };
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
  };
  /**
   * DÉCLARATION d'une rangée de la fenêtre — PHASE 1 : contrer SEUL, s'UNIR au Test Soutenu
   * (`LDB 46 l.162`, transposé à la fenêtre réactive — cf. `jetValider('contreSort')` ci-dessous) ou
   * PASSER. Le MENEUR n'est pas un choix : il se DÉRIVE des rangées unies (`counterspellSoutenu`)
   * et se re-dérive à chaque déclaration. Chaque rangée choisit pour elle (mix libre : unis et
   * lanceurs seuls coexistent dans la MÊME fenêtre) — arbitrages utilisateur 2026-08-04
   * [entériné 2026-08-04], verbatims aux tickets #1042/#1059.
   * GARDES : rangée jouable au siège qui agit (`influencesLocally`, la table de possession de
   * l'affordance), éligibilité de Domaine pour `soutenu` (`counterspellJoinable`), et PHASE encore
   * ouverte (`counterspellDeclarePhase`) — la dernière déclaration FIGE la composition.
   */
  const declarerLaRangee = (pid: string, choice: CounterDeclaration): void => {
    const s = get();
    const pcs = s.pendingCounterspell;
    if (!pcs || !counterspellDeclarePhase(pcs)) return;
    const part = pcs.participants.find((p) => p.id === pid);
    if (!part || !part.interactive || !influencesLocally(s, pid)) return;
    if (choice === 'soutenu' && !counterspellJoinable(s, pcs, pid)) return;
    set({ pendingCounterspell: { ...pcs, participants: pcs.participants.map((p) => (p.id === pid ? { ...p, declared: choice } : p)) } });
    // PORTE UNIQUE : la phase close SANS aucun lanceur (tout le monde passe) n'a plus rien à jouer —
    // la fenêtre se referme par le résolveur CANONIQUE (`jetValider('contreSort')`, qui agrège et retombe
    // sur le repli IA), jamais par un troisième chemin de fermeture.
    const fresh = get().pendingCounterspell;
    if (fresh && !counterspellDeclarePhase(fresh) && !fresh.participants.some((p) => counterspellRolls(get(), fresh, p))) {
      get().jetValider('contreSort');
    }
  };
  return {
    attaque: {
      localisation: attaque('location'),
      arme: (uid) => {
        const pa = get().pendingAttack;
        if (pa) set({ pendingAttack: { ...pa, weaponUid: uid ?? undefined } });
      },
      deuxArmes: (on) => {
        const pa = get().pendingAttack;
        if (!pa) return;
        // Mode « des deux armes » : l'attaque-Action utilise la MAIN DIRECTRICE (la 2ᵉ frappe suit, off-hand).
        const a = inBattleId(get().battle, pa.attackerId);
        const mainUid = a?.weapons.find((w) => w.hand === 'main' && w.type === 'melee' && (w.hands ?? 1) === 1)?.uid;
        set({ pendingAttack: { ...pa, dualMode: on, weaponUid: on ? (mainUid ?? pa.weaponUid) : pa.weaponUid } });
      },
      sansLaCorde: attaque('harpoonRopeCut'),
      retenirSesCoups: attaque('withhold'),
      empoigner: attaque('grapple'),
      localisationDuCritique: (loc) => {
        const pa = get().pendingAttack;
        // LDB 17 l.68 ; #1595 c.6226467544, c.6228496170 R1.
        const battle = get().battle;
        const cible = pa ? inBattleId(battle, pa.targetId) : undefined;
        const attaquant = pa ? inBattleId(battle, pa.attackerId) : undefined;
        if (!battle || !pa || !pa.forcee || !pa.result || !cible || !attaquant) return;
        const victime = victimeDuCoup(battle, cible, pa);
        if (!issueAuJet(victime, coupAApplique(pa.result, pa.grapple, victime), attackWeaponOf(battle, attaquant, cible, pa), attaquant).compte.relance) return;
        set({ pendingAttack: { ...pa, result: { ...pa.result, critLocation: loc } } });
      },
    },
    defense: {
      reaction: (mode) => {
        const { pendingDefense: pd, battle } = get();
        if (!pd || !battle) return;
        const defenseur = inBattleId(battle, pd.defenderId);
        const attaquant = inBattleId(battle, pd.attackerId);
        // LDB 09 l.207, l.287
        const substitut = mode === 'social' && defenseur && attaquant ? combatSubstitute(defenseur, attaquant, 'defense')?.skillId : undefined;
        set({ pendingDefense: { ...pd, mode, substituteSkillId: substitut } });
      },
      armeDeParade: (uid) => {
        const pd = get().pendingDefense;
        if (pd) set({ pendingDefense: { ...pd, parryWeaponUid: uid ?? undefined } });
      },
      porteBouclier: (kind) => {
        const pd = get().pendingDefense;
        if (pd) set({ pendingDefense: { ...pd, shieldReaction: kind ?? undefined } });
      },
      riposte: (riposte) => {
        const pd = get().pendingDefense;
        if (pd) set({ pendingDefense: { ...pd, riposte } });
      },
    },
    soins: {
      /** Jugé par `refusDuModeDuSoin`. Hors combat, l'acte recalcule son soin entier (`soinDeLActe` : soigneur,
       *  ligne, Difficulté) ; en combat, la Difficulté dépend du mode (variante AA, cf. `healDifficulty`). */
      mode: (mode) => {
        const ph = garanti(get().pendingHeal, mode, 'soin de l’acte');
        const raison = refusDuModeDuSoin(get(), mode);
        if (raison) return void refuserGesteDuSiege(get, set, raison);
        const bandagesDe = actePanse(mode) ? ph.bandagesDe : null;
        if (!get().battle) return void set({ pendingHeal: { ...soinDeLActe(get(), mode), bandagesDe } });
        const soigneur = actorIn(get(), ph.healerId);
        const difficulty = difficulteDuSoin(ph.test, mode);
        const ligne = rollLine({
          actor: soigneur, ...(soigneur ? { test: IDS_DU_TEST_DE_SOIN[ph.test] } : {}),
          difficulty, valeur: ph.skillValue, soutien: ph.test === 'guerison' ? ph.support : undefined,
        });
        set({ pendingHeal: { ...ph, mode, bandagesDe, difficulty, clamped: undefined, ligne, ...cibleMesuree(ligne) } });
      },
      /** Jugé par `refusDuTestDuSoin` ; valeur, Difficulté et ligne re-dérivées du soigneur combattant (un PNJ soigneur
       *  ne jette que sa Guérison). */
      test: (test) => {
        const ph = get().pendingHeal;
        if (!ph) return;
        if (refuseSi(get, set, () => refusDuTestDuSoin(get(), test))) return;
        const soigneur = garanti(actorIn(get(), ph.healerId), ph.healerId, 'soigneur combattant');
        const { skillValue, difficulty, ligne } = jetDuSoigneur(soigneur, test, ph.mode, ph.support);
        set({ pendingHeal: { ...ph, test, skillValue, difficulty, clamped: undefined, ligne, ...cibleMesuree(ligne) } });
      },
      /** Jugé par `refusDesBandages` ; la route coop n'admet que le siège du porteur (`porteurDeLaValeur`). */
      bandages: (porteurId) => {
        const ph = get().pendingHeal;
        if (!ph) return;
        if (refuseSi(get, set, () => refusDesBandages(get(), porteurId))) return;
        set({ pendingHeal: { ...ph, bandagesDe: porteurId } });
      },
    },
    incantation: {
      /** Refusé par `refusDuChoixCritique`, que la fenêtre lit aussi. Le budget de Surincantation en dépend
       *  (`castOvercastBudget`) : l'allocation retombe (`overcastReset`). */
      effetCritique: (choice) => {
        if (refuseSi(get, set, (s) => refusDuChoixCritique(s, choice))) return;
        const pc = garanti(get().pendingCast, 'pendingCast', 'Incantation Critique');
        const inchange = pc.critChoice === choice;
        set({ pendingCast: { ...pc, critChoice: choice, ...(inchange ? {} : overcastReset(pc, sceneMetresPerTile(get().scene))) } });
      },
      /** Refusé par `refusDeLaForme`, que la fenêtre lit aussi. */
      formeConjuree: (arme) => {
        if (refuseSi(get, set, (s) => refusDeLaForme(s, arme))) return;
        const pc = garanti(get().pendingCast, 'pendingCast', 'forme d’arme invoquée');
        const lanceur = garanti(actorIn(get(), pc.casterId), pc.casterId, 'forme d’arme invoquée');
        set({ pendingCast: { ...pc, conjureForm: garanti(conjureFormOptions(lanceur).find((f) => f.weapon === arme), arme, 'forme d’arme invoquée') } });
      },
      discret: (discreet) => {
        const pc = get().pendingCast;
        if (pc) set({ pendingCast: { ...pc, discreet } });
      },
      jetsDeTable: (n) => {
        const pc = get().pendingCast;
        if (!pc || !pc.result?.cast) return;
        const max = pc.overcast?.duration ?? 0;
        set({ pendingCast: { ...pc, chosenTableRolls: Math.max(0, Math.min(n, max)) } });
      },
      surincantationPortee: surincantation('range'),
      surincantationZone: surincantation('zone'),
      surincantationDuree: surincantation('duration'),
      surincantationCibles: surincantation('targets'),
      surincantationDegats: surincantation('damage'),
      /** Les cibles ÉLIGIBLES (portée surincantée comprise, éveillées, LDB 47), dans la capacité SOURCE-AWARE : pas ×
       *  cible initiale (×initial arcane/miracle) ; pas × 1 (bénédiction). Une liste hors de ces bornes est refusée. */
      ciblesSupplementaires: (ids) => {
        const pc = get().pendingCast;
        if (!pc || !pc.result?.cast) return;
        const pool = get().battle?.combatants ?? get().party;
        const caster = pool.find((c) => c.id === pc.casterId);
        const spell = findSpellById(pc.spellId);
        if (!caster || !spell) return;
        const eligibles = new Set(overcastTargetCandidates(pool, caster, pc.targetId, spell, !!pc.missile, overcastSourceOf(spell), pc.overcast?.range ?? 0, spellSightOf(get)).map((c) => c.id));
        const cap = extraTargetCapacity(overcastSourceOf(spell), pc.overcast?.targets ?? 0, spellTargetCount(spell, caster));
        const refus = ids.length > cap ? t('cast.refus.ciblesAuDela', { cap })
          : new Set(ids).size < ids.length ? t('cast.refus.cibleRepetee')
            : ids.some((id) => id === pc.targetId || !eligibles.has(id)) ? t('cast.refus.cibleIneligible') : null;
        if (refus) return void refuserGeste(get, set, refus);
        set({ pendingCast: { ...pc, extraTargetIds: [...ids] } });
      },
      /** La carte prend la main : la désignation des cibles (en combat seulement, hors combat la fenêtre les nomme), la
       *  pose de la zone, refusée par `refusDeLaPose` ; `null` rend la main à la fenêtre. */
      carte: (tenue) => {
        const placant = !!get().pendingCast?.zone?.placing;
        if (tenue === 'zone' || (tenue === null && placant)) {
          if (refuseSi(get, set, (s) => refusDeLaPose(s, tenue === 'zone'))) return;
          const pc = garanti(get().pendingCast, 'pendingCast', 'pose de la zone');
          const zone = garanti(pc.zone, pc.spellId, 'pose de la zone');
          set({ pendingCast: { ...pc, zone: { ...zone, placing: tenue === 'zone' } } });
          return;
        }
        const pc = get().pendingCast;
        if (!pc || !pc.result?.cast || !get().battle) return;
        set({ pendingCast: { ...pc, pickingTargets: tenue === 'cibles' } });
      },
    },
    cascade: {
      /** L'abandon est DEMANDÉ (`abandonSequence`), et la manche se clôt par les gestes du joueur (« Suivant »,
       *  « Terminer ») jusqu'à la clôture, qui le joue, ou jusqu'à une étape due, que le joueur joue avant. Une manche
       *  sans jet posé se ferme d'emblée. */
      abandon: () => {
        abandonSequence(get, set);
        for (let pas = pasVersLAbandon(get); pas; pas = pasVersLAbandon(get)) {
          if (pas === 'terminer') terminerLaCascade(get, set);
          else validerLEtape(get, set);
        }
      },
      choix: (cle, pid) => setCascadeChoice(get, set, garanti(pid, 'cascade', 'étape du choix'), cle),
      quantite: (n, pid) => setCascadeAmount(get, set, garanti(pid, 'cascade', 'étape de la quantité'), n),
    },
    /** Sans rangée, « contrer seul » ou la valeur dite pour chaque rangée encore vierge de CE siège (le drive
     *  d'auto-cadence, `FENETRE_DU_JET`) ; les rangées TÉMOIN sont déjà déclarées à l'ouverture
     *  (`autoDeclareWitnessRows`). */
    contreSort: {
      declaration: (choice, pid) => {
        if (pid !== undefined) { declarerLaRangee(pid, choice); return; }
        for (const id of rangeesAReglerIci(get(), declarationDuReglageNomme('contreSort', 'declaration'))) declarerLaRangee(id, choice);
      },
    },
    desengagement: {
      // « Sacrifier l'Avantage » (l.87) → ramener l'Avantage à 0, partir libre. L'Action N'EST PAS consommée.
      sacrifier: () => {
        const { battle, scene, pendingDisengage: pd } = get();
        if (!battle || !scene || !pd) return;
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
            log: [...battle.log, ev('fuite', t('cs.disengageSacrifice', { name: mover.label }), mover.id)],
          },
        });
        bus.emit(EVT.SCENE_DIRTY);
      },
      // ── « Fuir » (LDB 15 l.59-68) : OUVRE le flux MULTI `flee` — un slot par acteur (coup dans le dos
      //    du FRAPPEUR, Test de la fiche `fuite` du FUYARD). Aucun jet ni aucune conséquence ici : `jetValider('fuite')`
      //    applique tout. La modale s'ouvre dès qu'UN des deux acteurs est JOUÉ (symétrie). ──
      fuir: () => {
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
        const partagee = cascade && cur?.jet === 'desengagement' && played(foe) && played(mover)
          ? hostStep(get, {
            id: cur.id, kind: cur.kind, jet: 'desengagement', actorId: cur.actorId ?? mover.id, groupOwner: true,
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
                { id: mover.id, kind: 'touche', interactive: played(mover), test: testDeRegle('fuite', 'touche-en-fuyant'), jet: null },
              ],
            },
          },
          ...(cascade && partagee
            ? { pendingCascade: { ...cascade, participants: cascade.participants.map((s, i) => (i === cascade.cursor ? partagee : s)) } }
            : {}),
        });
        bus.emit(EVT.SCENE_DIRTY);
        // Rangée TÉMOIN auto-roulée à l'ouverture (comme les témoins d'`openCrewTestPending`) : le coup dans le dos d'un
        // frappeur non joué est résolu tout de suite ; celui d'un héros l'attend (il porte son cycle).
        if (!played(foe)) get().jetLancer('fuite', foe.id);
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
        if (!fleeBackstab(pdOpen)?.result) get().jetLancer('fuite', foe.id);
        const pdRolled = get().pendingDisengage;
        if (pdRolled && fleeToucheDu(pdRolled) && !fleeTouche(pdRolled)?.jet) get().jetLancer('fuite', mover.id);
        tracerLaFuite(get, set, mover, foe, { dos: true, touche: true });
        get().jetValider('fuite');
      },
    },
    auContact: {
      // Le vainqueur HÉROS tranche : « au contact » pose l'état, « combat normal » le retire.
      issue: (mode) => {
        const { battle, pendingAuContact: pd } = get();
        if (!battle || !pd) return;
        const mover = inBattleId(battle, pd.moverId);
        const foe = inBattleId(battle, pd.foeId);
        if (!mover || !foe) return set({ pendingAuContact: null });
        applyAuContact(get, set, mover, foe, mode);
      },
    },
    empoignade: {
      // « Briser l'Empoignade » (l.161) : gratuit (via le Mouvement), réservé à un Avantage SUPÉRIEUR, AVANT
      // tout jet. Libère les deux + retire l'*Empêtré* lié de l'acteur. NE consomme PAS l'Action.
      briser: () => {
        const { battle, pendingGrapple: pd } = get();
        if (!battle || !pd) return;
        const actor = inBattleId(battle, pd.actorId);
        const foe = inBattleId(battle, pd.foeId);
        if (!actor || !foe) return set({ pendingGrapple: null });
        clearGrapple(actor, foe);
        removeCondition(actor, COND.empetre, stacks(actor, COND.empetre)); // l'acteur se libère de l'*Empêtré* de l'Empoignade
        const log = [...battle.log, ev('esquive', t('cs.grappleBreak', { name: actor.label, foe: foe.label }), actor.id, foe.id)];
        set({ pendingGrapple: null, battle: { ...battle, log } }); // gratuit : pas d'`acted`
        bus.emit(EVT.SCENE_DIRTY);
      },
      // Le vainqueur tranche : Dégâts (BF+DR, PA ignorés) / Empêtrer l'adversaire / Se libérer (LDB 14 l.161).
      issue: (mode) => {
        const { battle, pendingGrapple: pd } = get();
        if (!battle || !pd) return;
        const actor = inBattleId(battle, pd.actorId);
        const foe = inBattleId(battle, pd.foeId);
        if (!actor || !foe || !pd.def || !pd.atk) return set({ pendingGrapple: null });
        const dr = Math.max(0, resolveOpposed(pd.def, pd.atk).netSL); // DR net du Test gagné
        applyGrapple(get, set, actor, foe, mode, dr, pd.def.roll);
      },
    },
    battement: {
      /** Re-ouvre sur l'adversaire choisi. */
      adversaire: (foeId) => {
        const { battle, pendingBattement: pb } = get();
        if (!battle || !pb) return;
        const active = inBattleId(battle, pb.attackerId);
        const foe = adversairesDuBattement(get()).find((c) => c.id === foeId);
        if (!active || !foe) return;
        startBattement(get, set, active, foe);
      },
    },
    distraire: {
      /** Re-fige le Calme de l'adversaire choisi. */
      adversaire: (foeId) => {
        const { battle, pendingDistraire: pd } = get();
        if (!battle || !pd) return;
        const mover = inBattleId(battle, pd.moverId);
        const foe = adversairesADistraire(get()).find((c) => c.id === foeId);
        if (!mover || !foe) return;
        startDistraire(get, set, mover, foe);
      },
    },
    manoeuvre: {
      avantage: (n) => {
        const { battle, pendingManeuver: pm } = get();
        if (!battle || !pm) return;
        const attacker = inBattleId(battle, pm.attackerId);
        if (!attacker) return;
        const clamped = Math.max(1, Math.min(n, attacker.advantage)); // 1..Avantage (LDB 85 l.290)
        set({ pendingManeuver: { ...pm, avantageSpent: clamped } });
      },
    },
    manoeuvreDuNavire: {
      virage: (steps) => {
        const p = get().pendingShipManeuver;
        if (p) set({ pendingShipManeuver: { ...p, turnSteps: steps } });
      },
    },
    chansonDeMarin: {
      chanson: (shantyId) => {
        const p = get().pendingShanty;
        if (p && chansonsDuChanteur(get()).includes(shantyId)) set({ pendingShanty: { ...p, shantyId } });
      },
    },
  };
}

/** Les sorties des fenêtres du combat : le bilan de la cascade, le choix de monture, le placeur du pilonnage. */
export function sortiesDuCombat(get: Get, set: Set) {
  return {
    cascade: () => terminerLaCascade(get, set),
    cibleDeMonture: () => set({ pendingMountTarget: null }),
    /** REFERME le placeur de case du pilonnage SANS tirer : le pending tombe et l'option « Servir … »
     *  se désarme (l'attaque redevient celle de l'Arme) — l'état exact que laisse un re-clic sur la
     *  case d'attaque (`armerLAttaque`). Sortie de l'interlude `poseDeLaZone` quand la zone en cours
     *  vient du siège (`placingZoneOf` source `siege`), et point de fermeture unique de `poserLePointDImpact`.
     *  Aucun coût : rien n'a été jeté. */
    viseeDeSiege: () => set((s) => ({ pendingSiegeAim: null, ...(s.battle && { battle: { ...s.battle, selectedAttack: undefined, preview: null } }) })),
    /** Fin du balayage : la restitution que la chaîne portait, puis la clôture de l'étape-jet de la cascade (reprise). */
    frappeMortelle: () => {
      const { battle, pendingCleave: pc } = get();
      set({ pendingCleave: null, ...(battle && pc?.restitution ? { battle: { ...battle, acted: pc.restitution.prevActed } } : {}) });
      advanceCombatJet(get);
    },
    /** Renoncer à la 2ᵉ frappe : pas de 2ᵉ attaque, pas d'Avantage. LDB 10 l.767-773 */
    secondeFrappe: () => { set({ pendingDualStrike: null }); advanceCombatJet(get); },
  } satisfies Partial<SortiesDeFenetre>;
}

/** La validation de la pause de début de Round : le Round se lance (`lancerLeRound`). */
export function validationsDuCombat(get: Get, set: Set) {
  return { debutDuRound: () => lancerLeRound(get, set) } satisfies Partial<ValidationsDeFenetre>;
}

/** Les clôtures des flux du combat (`CloturesDuJet`) : `jetValider` les joue, tant que le flux les ouvre. */
export function cloturesDuCombat(get: Get, set: Set) {
  return {
    // Valider l'étape courante de la cascade, quelle que soit son interaction.
    cascade: () => validerLEtape(get, set),
    // Maladresse (LDB 14) : les Oups ! tirés sur l'étape COURANTE (`step.maladresse`) s'appliquent.
    maladresse: () => {
      const step = maladresseCourante(get().pendingCascade);
      if (!step) return;
      const oups = garanti(step.maladresse.result, step.actorId, 'tirage des Oups !');
      const c = step.actorId ? porteurParId(get(), step.actorId) : undefined;
      // La queue du coup dont cette Maladresse est un temps d'après-coup (#1508 T3b-4) : elle reprend
      // une fois la Maladresse appliquée — ou voyage avec le dé de casse qui la diffère.
      const coup = step.maladresse.coup;
      if (!c) journaliser(get, set, [t('cascade.cibleDisparue', { label: step.maladresse.weapon.label })], 'information');
      // Une casse d'arme peut partir à la porte (#1508 T3b-4) : la Maladresse n'est alors PAS appliquée,
      // son dé l'appliquera. L'étape de casse s'APPEND DERRIÈRE cette étape (`cascade.pushStep`), donc
      // le curseur y ARRIVE — la suite de ce verbe est le curseur, jamais une application.
      const differee = !!c && applyOups(get, set, c, step.maladresse.weapon, oups, new Map(), coup) === OPS_DIFFEREES;
      const suite = get().pendingCascade;
      // Fail-fast : une casse différée sans étape derrière elle ferait FERMER la cascade au curseur
      // (`advanceCascade`, curseur au bout) — le dé en vol serait perdu avec sa Maladresse.
      if (differee && (suite ? suite.participants.length - (suite.cursor + 1) : 0) <= 0) {
        throw new Error('#1508 — casse d’arme différée sans étape derrière la Maladresse : le curseur fermerait la cascade sur un dé jamais servi.');
      }
      // L'après-coup qui tient la main a poussé ses étapes DERRIÈRE celle-ci : la suite est le curseur.
      if (!differee && coup) jouerFlowEntier(jouerLApresCoup(get, set, coup) ? OPS_DIFFEREES : undefined);
      // La Maladresse est l'étape COURANTE de la cascade combat → enchaîner le curseur (sa clôture reprend l'IA).
      validerLEtape(get, set);
    },
    // « Appliquer » : l'Esquive consomme l'Action dans les DEUX issues (l.89).
    desengagement: () => {
      const { battle, scene, pendingDisengage: pd } = get();
      if (!battle || !scene || !pd) return;
      const mover = inBattleId(battle, pd.moverId);
      const foe = inBattleId(battle, pd.foeId);
      set({ pendingDisengage: null, pendingCascade: null });
      if (!mover || !foe) return;
      const b = markActed(get, set); // le Test d'Esquive EST l'Action : scellé AVANT la copie du journal
      const log = [...b.log];
      if (pd.result === 'reussite') {
        campGain(get, mover); // +1 Avantage (l.89)
        mover.gainedAdvThisRound = true;
        // Esquive réussie = on s'extrait du corps à corps → libéré de TOUS les Engagements
        // (cohérent avec l'option A, qui libère aussi tous les foes).
        const foes = (mover.engagedWith ?? [])
          .map((id) => inBattleId(battle, id))
          .filter((c): c is Combatant => !!c);
        for (const f of foes) disengageFrom(mover, f);
        log.push(ev('fuite', t('cs.disengageDodge', { name: mover.label }), mover.id, foe.id));
        set({
          battle: { ...b, action: null, reachable: moveReachFor(mover, scene, mover.pos!, effectiveMovement(mover), moveEnv(battle, mover)), log },
        });
      } else if (pd.result === 'egalite') {
        // Égalité parfaite du Test opposé : statu quo — pas de fuite, mais pas d'avantage à
        // l'adversaire non plus (LDB Tests). L'Action est consommée par la tentative d'Esquive.
        log.push(ev('fuite', t('cs.disengageNeutral', { name: mover.label }), mover.id, foe.id));
        set({ battle: { ...b, action: null, reachable: new Map(), log } });
      } else {
        campGain(get, foe); // l'adversaire gagne +1, la fuite échoue (l.89)
        foe.gainedAdvThisRound = true;
        log.push(ev('fuite', t('cs.disengageFail', { name: mover.label, foe: foe.label }), mover.id, foe.id));
        set({ battle: { ...b, action: null, reachable: new Map(), log } });
      }
      bus.emit(EVT.SCENE_DIRTY);
    },
    // ── « Fuir » — « Appliquer » : applique le coup dans le dos par l'applicateur CANONIQUE d'attaque
    //    (Coup Critique sur double LDB 13 l.183, Blessure critique + À Terre au dépassement LDB 13 l.161,
    //    Avantage, Frappe Mortelle), PUIS la fuite elle-même (`completeFlee` : États Brisés du Test `fuite` raté
    //    l.66 + libération des Engagements + budget de Course l.68). Le coup gratuit consomme des tirages
    //    de `battleRng` (localisation, Critique, effets déclenchés) : à graine égale, la suite d'un combat
    //    où l'on fuit DIVERGE de l'ancienne — assumé (l'application canonique prime sur la reproductibilité
    //    d'une graine historique). ──
    fuite: () => {
      const { battle, scene, pendingDisengage: pd } = get();
      if (!battle || !scene || !pd?.fuir) return;
      const mover = inBattleId(battle, pd.moverId);
      const foe = inBattleId(battle, pd.foeId);
      if (!mover || !foe) return set({ pendingDisengage: null, pendingCascade: null });
      const res = garanti(fleeBackstab(pd)?.result, pd.moverId, 'coup dans le dos de la Fuite');
      const toucheSlot = fleeTouche(pd);
      if (fleeToucheDu(pd) && !toucheSlot?.jet) {
        get().jetLancer('fuite', mover.id); // fuyard non joué : sa rangée témoin se résout par le flux, puis on applique
        tracerLaFuite(get, set, mover, foe, { dos: false, touche: true });
        return get().jetValider('fuite');
      }
      const seqBefore = get().pendingCascade;
      const stepsBefore = seqBefore?.participants.length ?? 0;
      set({
        pendingDisengage: null, // la modale se ferme AVANT l'application (une conséquence peut ouvrir la sienne)
        battle: { ...battle, log: [...battle.log, ev('fuite', t('cs.fleeBackstab', { name: mover.label, foe: foe.label }), mover.id, foe.id)] },
      });
      // Attaque GRATUITE (elle ne consomme pas l'Action du fuyard, dont c'est le tour) : l'Action rendue
      // est la SUITE du coup, jouée par son après-coup — à la reprise quand le coup est suspendu.
      // Enchaînement déclaré par le conducteur du frappeur, partition de `aiDriven` (`applyTalentFreeAttack`).
      const enchainement: EnchainementDuCoup = aiDriven(get(), foe) ? { mode: 'auto' } : { mode: 'heros', wasChain: false };
      const suspended = applyAttackResult(get, set, foe, mover, backstabWeapon(foe), res,
        { suite: { restitution: { prevActed: battle.acted }, manoeuvre: { kind: 'dos' }, enchainement } });
      const jet = toucheSlot?.jet;
      const broken = jet && !jet.success ? 1 + Math.max(0, -jet.sl) : 0; // échec → 1 + DR négatif (LDB 15 l.66)
      if (suspended) {
        // Le coup gratuit n'est PAS résolu : `applyAttackResult` a EMPILÉ une étape qui tient la main (Déviation
        // Critique du fuyard, Test ou choix poussé par la touche, qui porte l'après-coup). La fuite (Brisé + Course)
        // attend SA résolution, dans la même fenêtre, via l'étape de reprise `mouvementDeFuite` (LDB 15 l.68 :
        // « une fois que ce coup gratuit est résolu… »).
        pushDisplay(set, { id: `flee-move-${mover.id}`, kind: 'mouvementDeFuite', actorId: mover.id, icon: 'melee/fuir', label: t('step.fuite'),
          outcome: toRecapLines([
            t('cs.fuiteReprise', { name: mover.label, foe: foe.label }),
            ...(broken > 0 ? [t('cs.panic', { name: mover.label, broken })] : []),
          ]),
          fuite: { moverId: mover.id, foeId: foe.id, broken } });
        const casc = get().pendingCascade;
        if (casc?.participants[casc.cursor]?.jet === 'desengagement') validerLEtape(get, set); // avancer sur l'étape de Déviation
        return;
      }
      completeFlee(get, set, mover.id, foe.id, broken);
      // Cascade-hôte : on ne ferme QUE si l'application n'a rien empilé (Coup Critique…) — jamais une
      // cascade FRAÎCHE créée par la conséquence elle-même (une porte d'append en ouvre une s'il n'y en a pas).
      const seq = get().pendingCascade;
      if (!seq) return; // rien à fermer
      if (!seqBefore) return; // cascade FRAÎCHE ouverte par la conséquence (Coup Critique) : elle est déjà sur SON étape
      if (seq.participants.length > stepsBefore) validerLEtape(get, set); // conséquence APPENDUE → avancer dessus
      else set({ pendingCascade: null }); // rien d'empilé : la cascade-hôte du Désengagement se ferme
    },
    // Cycle Chance/+1 DR/Pacte/Résilience (spec `auContact`) : foe (atk) figé, seul le jet du mover se (re)joue.
    // « Appliquer » : le Test opposé EST l'Action. Le mover (héros) gagne → IL choisit (phase 'choix') ;
    // le foe gagne → l'IA tranche par heuristique (arme la plus courte = au contact) ; égalité → statu quo.
    auContact: () => {
      const { battle, pendingAuContact: pd } = get();
      if (!battle || !pd) return;
      const mover = inBattleId(battle, pd.moverId);
      const foe = inBattleId(battle, pd.foeId);
      if (!mover || !foe) return set({ pendingAuContact: null });
      if (pd.result === 'reussite') return set({ pendingAuContact: { ...pd, phase: 'choix' } }); // le héros tranche
      if (pd.result === 'egalite') return applyAuContact(get, set, mover, foe, null); // statu quo, Action consommée
      // Le foe (IA) l'emporte → au contact si SON arme est plus COURTE (il neutralise l'allonge adverse).
      // Sans arme de mêlée, il frappe à Mains nues (« Personnelle », LDB 62 l.28/l.158) ; deux longueurs
      // comparables sont requises pour conclure (l.172), sinon statu quo.
      const fr = meleeReachRank(foe.weapons.find((w) => w.type === 'melee'));
      const mr = meleeReachRank(mover.weapons.find((w) => w.type === 'melee'));
      applyAuContact(get, set, mover, foe, fr != null && mr != null && fr < mr ? 'contact' : 'normal');
    },
    // Cycle Chance/+1 DR/Pacte/Résilience (spec `grapple`) : foe (atk) figé, seul le jet de l'acteur se (re)joue.
    // « Appliquer » : le Test opposé EST l'Action. Succès → l'acteur choisit (phase 'options') ; échec →
    // +1 Avantage au foe (l.161) ; égalité → statu quo.
    empoignade: () => {
      const { battle, pendingGrapple: pd } = get();
      if (!battle || !pd) return;
      const actor = inBattleId(battle, pd.actorId);
      const foe = inBattleId(battle, pd.foeId);
      if (!actor || !foe) return set({ pendingGrapple: null });
      if (pd.result === 'reussite') return set({ pendingGrapple: { ...pd, phase: 'options' }, battle: { ...markActed(get, set), action: null } }); // l'acteur tranche ; Action dépensée
      if (pd.result === 'echec') campGain(get, foe, 1); // l'adversaire l'emporte → +1 Avantage
      const key = pd.result === 'echec' ? 'cs.grappleLose' : 'cs.grappleTie';
      const b = markActed(get, set); // scellé AVANT la copie du journal (le déclencheur y pousse ses lignes)
      const log = [...b.log, ev('attaque', t(key, { name: actor.label, foe: foe.label }), actor.id, foe.id)];
      set({ pendingGrapple: null, battle: { ...b, action: null, log } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    // Cycle Lancer/Chance/+1 DR/Pacte/Résilience (spec `battement`) : jet de CC de l'attaquant, non opposé.
    // « Appliquer » : `resolveBattement` retire l'Avantage adverse (LDB 10 l.103) ; consomme l'Action.
    battement: () => {
      const { battle, pendingBattement: pb } = get();
      if (!battle || !pb) return;
      const lance = garanti(pb.result, pb.attackerId, 'jet du Battement');
      const attacker = inBattleId(battle, pb.attackerId);
      const foe = inBattleId(battle, pb.foeId);
      set({ pendingBattement: null });
      if (!attacker || !foe) return;
      const line = resolveBattement(get, attacker, foe, lance); // MUTE le foe (et la réserve du camp)
      set({ battle: { ...markActed(get, set), action: null, log: [...get().battle!.log, ev('attaque', line, attacker.id, foe.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      checkBattleOver(get, set);
    },
    // « Lancer » : jet d'Athlétisme du mover, opposé au jet de Calme figé du foe (spec `distraire`).
    // Cycle Chance/+1 DR/Pacte/Résilience : foe (defRoll) figé, seul l'Athlétisme du mover se (re)joue.
    // « Appliquer » : `resolveDistraire` pose `distractedRounds` sur une victoire ; consomme le MOUVEMENT.
    distraire: () => {
      const { battle, pendingDistraire: pd } = get();
      if (!battle || !pd) return;
      const lance = garanti(pd.atk, pd.moverId, 'jet de Distraire');
      const mover = inBattleId(battle, pd.moverId);
      const foe = inBattleId(battle, pd.foeId);
      set({ pendingDistraire: null });
      if (!mover || !foe) return;
      const line = resolveDistraire(mover, foe, lance, pd.defRoll); // MUTE le foe (distractedRounds) sur une victoire
      set({ battle: { ...get().battle!, action: null, movementUsed: mountMovement(get().battle!, mover), reachable: new Map(), log: [...get().battle!.log, ev('attaque', line, mover.id, foe.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      checkBattleOver(get, set);
    },
    // ── Manœuvre de créature par modale (Souffle/Vomi/Langue/Regard/Étreinte — LDB 85) : le jet de
    //    l'ATTAQUANT passe par FLOWS.manoeuvre (Lancer/Chance/Pacte/Résilience) ; « Appliquer » roule les
    //    défenseurs et résout l'opposition au feed via le RÉSOLVEUR GÉNÉRIQUE `resolveManeuver`. ──
    manoeuvre: () => {
      const { battle, pendingManeuver: pm } = get();
      if (!battle || !pm) return;
      const attacker = inBattleId(battle, pm.attackerId);
      set({ pendingManeuver: null });
      if (!attacker) return;
      const a = attaqueDeCle(attacker.traits ?? [], pm.attaque);
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
    course: () => {
      const { battle, scene, pendingRun: pr } = get();
      if (!battle || !scene || !pr || !pr.dest) return;
      const lance = garanti(pr.result, pr.combatantId, 'jet de la Course');
      const c = inBattleId(battle, pr.combatantId);
      set({ pendingRun: null });
      if (!c) return;
      // Combat monté : Course au Mouvement de la monture, empreinte/collisions de la monture (couple solidaire).
      const geom = mountOf(battle, c) ?? c;
      // LDB 15 l.41 : budget du Tour = Marche + (Course + DR) ; portée depuis la case courante = restant + (Course + DR).
      const runBudget = mountMovement(battle, c) + lance.bonusCases;
      const range = movementRemaining(battle, c) + lance.bonusCases;
      const env = moveEnv(battle, geom);
      // Le jet peut porter MOINS loin que la destination demandée : on suit le chemin et on s'arrête au
      // dernier point que le budget permet (« au max qu'il puisse faire »).
      const reach = reachable(scene, c.pos!, range, env);
      const fallback = pr.path ? null : resolveMovement(get, pr.dest);
      const path = pr.path ?? (fallback?.status === 'possible' ? fallback.path : []);
      let stopIdx = -1;
      for (let i = path.length - 1; i >= 0; i--) {
        if (reach.has(`${path[i].x},${path[i].y}`)) { stopIdx = i; break; }
      }
      const stop = stopIdx >= 0 ? path[stopIdx] : null;
      if (!stop || (stop.x === c.pos!.x && stop.y === c.pos!.y)) {
        // Jet désastreux : aucun pas possible — l'Action est tout de même consommée (le Test a eu lieu).
        const b = markActed(get, set); // scellé AVANT la copie du journal (le déclencheur y pousse ses lignes)
        const log = [...b.log, ev('deplacement', t('cs.runStumble', { name: c.label }), c.id)];
        set({ battle: { ...b, action: null, runBudget, reachable: new Map(), preview: null, log } });
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
      get().orienterSelonLeChemin(c.id, sub);
      if (geom !== c) get().orienterSelonLeChemin(geom.id, sub);
      bus.emit(EVT.ANIM_MOVE, { id: c.id, path: sub });
      if (geom !== c) bus.emit(EVT.ANIM_MOVE, { id: geom.id, path: sub });
      const short = stop.x !== pr.dest.x || stop.y !== pr.dest.y;
      // Budget du Tour = Marche + Course + DR (LDB 15 l.41), lu par `movementRemaining` ; le reliquat ne se
      // dépense en segments que si `canMove` l'admet (aucune Marche avant l'Action).
      const b = markActed(get, set); // scellé AVANT la copie du journal (le déclencheur y pousse ses lignes)
      const log = [...b.log, ev('deplacement', t('cs.run', { name: c.label, cost, short: short ? t('cs.fragRunShort') : '' }), c.id)];
      set({ battle: { ...b, action: null, runBudget, movementUsed: (battle.movementUsed ?? 0) + cost, reachable: new Map(), preview: null, log } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    manoeuvreDuNavire: () => {
      const { battle, pendingShipManeuver: p } = get();
      if (!battle || !p) return;
      const ship = inBattleId(battle, p.shipId);
      if (!ship) return;
      const total = maneuverCrewTotal(p.participants, p.essentialRoleId, p.moraleScore, p.undercrew, p.extraDR); // Σ DR (essentiel ×2) + Moral + Manque de bras + sabotage
      const result = deriveManeuverFromCrew(ship, total, milieuDuVoyage(get().travelPlan)); // virage si le Test d'équipage est réussi (MDG 14 l.13)
      set({ pendingShipManeuver: null });
      applyShipManeuver(get, p.shipId, result, p.turnSteps); // vire (si succès) + avance ; logue
      const bM = get().battle!;
      set({ battle: { ...markActed(get, set), action: null, preview: null, crewActed: withCrewActed(bM.crewActed, p.shipId, p.participants.map((x) => x.id)) } }); // un jet = une Action ; marins engagés ce Round
      bus.emit(EVT.SCENE_DIRTY);
    },
    tirDeBatterie: () => {
      const { battle, pendingShipBattery: p } = get();
      if (!battle || !p) return;
      const ship = inBattleId(battle, p.shipId);
      const target = inBattleId(battle, p.targetId);
      if (!ship || !target) { set({ pendingShipBattery: null }); return; }
      const dr = maneuverCrewTotal(p.participants, p.essentialRoleId, p.moraleScore, p.undercrew, p.extraDR); // DR PARTAGÉ (Σ, essentiel ×2, + Moral, + Manque de bras, + sabotage)
      set({ pendingShipBattery: null });
      const suspendu = applyBatteryVolley(get, set, ship, target, p.side, dr, crewTestSuccess(dr)); // corps de bordée PARTAGÉ — cf. tirerLaBordee
      const bB = get().battle!;
      set({ battle: { ...bB, action: null, preview: null, crewActed: withCrewActed(bB.crewActed, p.shipId, p.participants.map((x) => x.id)) } }); // Artilleurs engagés ce Round
      if (!suspendu) checkBattleOver(get, set);
      bus.emit(EVT.SCENE_DIRTY);
    },
    chansonDeMarin: () => {
      const { battle, pendingShanty: p } = get();
      if (!battle || !p || !p.shantyId) return;
      const lance = garanti(p.result, p.singerId, 'jet de la Chanson');
      const ship = inBattleId(battle, p.shipId);
      const singer = inBattleId(battle, p.singerId);
      set({ pendingShanty: null });
      if (!ship || !singer) return;
      if (lance.success) {
        for (const l of applyShantyToCrew(get, ship, singer, p.shantyId, lance.sl)) get().ecrireAuJournal(l);
      } else {
        ship.lastShantyQuart = quartIndex(get().gameTime); // la chanson a été chantée (30 s) — le quart est consommé, sans effet
        get().ecrireAuJournal(t('cs.shantyFail', { name: singer.label }));
      }
      set({ battle: { ...get().battle! } });
      bus.emit(EVT.SCENE_DIRTY);
    },
    // ── Approche d'une source de Peur (LDB 21 l.27) : le Test `pendingApproach.test` qui DIFFÈRE le
    //    clic d'approche. Succès → fearGate 'passed' (approches libres ce Tour) + l'intention est relancée ;
    //    échec → fearGate 'failed' (aucune approche ce Tour). « Un jet = une modale ». ──
    approche: () => {
      const { battle, pendingApproach: pa } = get();
      if (!battle || !pa) return;
      const lance = garanti(pa.result, pa.combatantId, 'jet de l’Approche');
      const c = inBattleId(battle, pa.combatantId);
      const src = inBattleId(battle, pa.sourceId);
      set({ pendingApproach: null });
      if (!c) return;
      const ok = lance.success;
      const log = [...battle.log, ev('peur', ok
        ? t('cs.courageYes', { name: c.label, src: pa.sourceName })
        : t('cs.courageNo', { name: c.label, src: pa.sourceName }), c.id, src?.id)];
      set({ battle: { ...get().battle!, fearGate: ok ? 'passed' : 'failed', log } });
      if (ok) {
        // Relance le geste différé (le gate est 'passed') AVEC l'intention de son clic d'origine, que ce clic a dissoute.
        if (pa.intent.kind === 'tile') get().cliquerLaCaseDuCombat(pa.intent.pt, { confirm: true, intentionId: pa.intent.intentionId });
        else get().cliquerLeCombattant(pa.intent.id, { confirm: true, intentionId: pa.intent.intentionId });
      }
      bus.emit(EVT.SCENE_DIRTY);
    },
    // ── Bénédiction de Protection (LDB 41 l.142) : Test de FM Accessible (+20) qui DIFFÈRE la déclaration
    //    d'attaque sur une cible bénie. Succès → l'attaque est relancée (`wardCleared` saute ce gate) ;
    //    échec → l'attaque n'a pas lieu (rien n'est consommé). « Un jet = une modale ». ──
    protection: () => {
      const { battle, pendingWard: pw } = get();
      if (!battle || !pw) return;
      const lance = garanti(pw.result, pw.attackerId, 'jet de la Protection');
      const attacker = inBattleId(battle, pw.attackerId);
      const target = inBattleId(battle, pw.targetId);
      set({ pendingWard: null });
      if (!attacker || !target) return;
      const ok = lance.success;
      const log = [...battle.log, ev('information', ok
        ? t('cs.shameOvercome', { name: attacker.label, roll: lance.roll, target: String(lance.target ?? '?'), foe: target.label })
        : t('cs.shameBlocked', { name: attacker.label, foe: target.label }), attacker.id, target.id)];
      set({ battle: { ...get().battle!, log } });
      // Succès : relance la déclaration d'attaque (le gate est franchi pour CE clic via `wardCleared`).
      if (ok) get().cliquerLeCombattant(pw.targetId, { confirm: true, wardCleared: true, intentionId: pw.intentionId });
      bus.emit(EVT.SCENE_DIRTY);
    },
    rechargement: () => {
      const { battle, pendingReload: pr } = get();
      if (!battle || !pr) return;
      set({ pendingReload: null });
      const porteur = inBattleId(battle, pr.actorId);
      if (!porteur) return;
      appliquerLaRecharge(get, set, pr, garanti(armeDuJetDeRecharge(pr, porteur), pr.weaponUid, 'arme rechargée'));
      // Acteur PILOTÉ par l'IA (Auto-combat) : son tour était suspendu par la modale → reprise (comme cast/défense).
      const active = activeCombatant(get().battle!);
      if (active && aiDriven(get(), active)) resumeEnemyTurn(get, set);
    },
    // Main ensanglantée (AA 07 l.117) : « Appliquer » le Test de Dextérité PAR ACTION.
    mainEnsanglantee: () => {
      const { battle, pendingHandGate: pg } = get();
      if (!battle || !pg) return;
      const attacker = inBattleId(battle, pg.attackerId);
      set({ pendingHandGate: null });
      if (!attacker) return;
      if (pg.success) {
        // Réussite : l'Action déclarée s'ouvre TELLE QUELLE (`skipGate` pour ne pas re-tester). Une 2ᵉ frappe
        // « des deux armes » reprend sa résolution pré-figée (`frapperDeLaSeconde`) ; sinon la cascade d'attaque.
        if (pg.pa.dualSecond) frapperDeLaSeconde(get, set, pg.pa.targetId, true);
        else openAttackCascade(get, set, pg.pa, pg.title, pg.icon, true);
        return;
      }
      // Échec : l'objet glisse (op `disarm`, main gatée). Comme le gate de Bénédiction (`attackWardGate`),
      // rien d'AUTRE n'est consommé — le joueur choisit une autre cible ou Action (mais l'arme est perdue).
      const lines = applyOps(attacker, [{ op: 'disarm' }], { idNeuf: get().forgerUnId, rng: battleRng(), location: pg.hand === 'secondaire' ? 'brasG' : 'brasD', ...crochetDuSol(get, set) });
      const b1 = get().battle!;
      set({ battle: { ...touchActors(get()).battle!, log: [...b1.log, ...evLines(lines, 'attaque', attacker.id)] } });
      bus.emit(EVT.SCENE_DIRTY);
      // 2ᵉ frappe « des deux armes » ratée : la 2ᵉ est renoncée (l'Action reste dépensée par la 1ʳᵉ frappe) →
      // on clôt le sous-flux dual et on reprend la cascade (calque `fenetreFermer('secondeFrappe')`).
      if (pg.pa.dualSecond) { set({ pendingDualStrike: null }); advanceCombatJet(get); return; }
      // Héros PILOTÉ par l'IA (Auto-combat) : son tour était suspendu par la modale → reprise (calque jetValider('rechargement')).
      if (aiDriven(get(), attacker) && get().battle) resumeEnemyTurn(get, set);
    },
    recuperation: () => {
      const { battle, pendingStateRecovery: sr } = get();
      if (!battle || !sr) return;
      const a = inBattleId(battle, sr.actorId);
      set({ pendingStateRecovery: null });
      if (!a) return;
      // Filets barbelés (Zoo Impérial p.29) : Dégâts ignorant l'armure à CHAQUE tentative, réussie ou ratée.
      const struggleLines = sr.struggleDamage != null
        ? applyOps(a, [{ op: 'wounds', amount: sr.struggleDamage, ignoreTB: false }], { idNeuf: get().forgerUnId, rng: battleRng(), caster: a })
        : [];
      const removed = recoveredStacks(sr.netSL, stacks(a, sr.state), sr.success); // 1 + DR, borné
      if (removed > 0) removeCondition(a, sr.state, removed);
      // Filets (Zoo Impérial p.29) : un échec de libération AGGRAVE l'Empêtré (≠ Immobilisante générique).
      if (!sr.success && sr.entangleOnFail) addCondition(a, sr.state, 1);
      // ISSUE dérivée par le goulot (`FLOWS.recuperation.apply`, canal COMBAT) : le pending est FOURNI (fermé
      // juste avant), les Dégâts de débattement restent la conséquence propre du site.
      const recoverIssue = FLOWS.recuperation.apply(get, { p: sr });
      finishPlayerAction(get, set, [...struggleLines, ...recoverIssue], 'etat'); // consomme l'Action
    },
    fuiteDeVapeur: () => {
      const p = get().pendingSteamSave;
      if (!p) return;
      set({ pendingSteamSave: null });
      resolveSteamSave(get, set, p); // échec → ébouillanté (scaldOps), puis la boucle maritime reprend
    },
    // Cycle Chance/Pacte UNIFIÉ (spec `attack`) — Résilience (forceSuccess/setForcedRoll) plus bas.
    // `annuler` = « Annuler » unifié (défaire-charge dans `FLOWS.attaque.onCancel`) — regénère `jetAnnuler('attaque')`.
    attaque: () => {
      const { battle, pendingAttack: pa } = get();
      if (!battle || !pa) return;
      const lance = garanti(pa.result, pa.attackerId, 'jet de l’attaque');
      const attacker = inBattleId(battle, pa.attackerId);
      const target = inBattleId(battle, pa.targetId);
      // Tir dévié dans la mêlée (LDB 14 l.116) : la touche est appliquée à l'allié intercalé, pas à la cible.
      const victim = target && victimeDuCoup(battle, target, pa);
      const wasChain = !!pa.cleave; // cette attaque faisait-elle partie d'un balayage en cours ?
      const restitutionDeChaine = wasChain ? get().pendingCleave?.restitution : undefined;
      const dualBefore = get().pendingDualStrike; // données de la 1ʳᵉ frappe (présentes quand on confirme la 2ᵉ)
      set({ pendingAttack: null });
      // Arme RÉELLEMENT employée (arme naturelle d'une manœuvre de trait comprise) : primitive
      // PARTAGÉE avec la modale d'attaque (#1026) — deux résolutions divergentes rendraient deux
      // verdicts d'interposition opposés pour le même `pa`.
      const weapon = attacker && target ? attackWeaponOf(battle, attacker, target, pa) : undefined;
      // Défense SURFACÉE du défenseur (#989) : le jet d'attaquant est FINAL (influence jouée) — on interpose
      // SA fenêtre de défense AVANT toute application, dans la cascade d'attaque EN COURS (le curseur passe
      // sur l'étape 'defense'). `jetValider('defense')` rend la main ICI avec le résultat opposé (`pa.defended`) →
      // un seul chemin d'application, l'interruption Tir rapide comprise (#997). Un tir DÉVIÉ (victime ≠
      // cible) et le pilonnage de zone n'opposent personne (LDB 14 l.116) : gardes portées par
      // `surfacedDefensePending`, prédicat PARTAGÉ avec l'affichage de la modale d'attaque (#1004).
      if (attacker && target && victim && weapon && openSurfacedDefense(get, set, attacker, target, weapon, pa)) {
        // Curseur : étape 'attack' (résolue) → étape 'defense' que la fenêtre vient d'appendre. Sans
        // cascade d'attaque en cours, la fenêtre a ouvert la sienne (curseur DÉJÀ sur la défense).
        const seq = get().pendingCascade;
        if (seq?.purpose === 'combat' && seq.participants[seq.cursor]?.jet === 'attaque') validerLEtape(get, set);
        return;
      }
      if (attacker && target && victim && weapon && pa.interrupt) {
        // Tir rapide (INTERRUPTION, LDB 11 l.97-103) : le tireur n'est PAS actif (on est à pendingRoundStart). On
        // applique le tir puis on N'AVANCE PAS le tour ; on épuise son tour NORMAL — l'Action (= ce tir) et
        // le Mouvement, consommés à l'ouverture de son slot normal (loseNext*). Aucun effet début/fin de tour
        // n'est déplacé (ils vivent dans `advanceTurn` et `ouvrirLeRound`). La fenêtre du
        // défenseur surfacé s'est interposée plus haut (#997) : on arrive ici avec le résultat opposé.
        attacker.loseNextAction = true; attacker.loseNextMovement = true; // PRIX du tir, payé AVANT le coup (LDB 11 l.97-103)
        const suspendu = applyAttackResult(get, set, attacker, victim, weapon, lance, { suite: { enchainement: { mode: 'aucun' } } });
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
      if (attacker && target && victim && weapon) {
        // PILONNAGE INDIRECT (« viser une case », AA 10 l.169/171) : la touche DÉTONE sur la CASE choisie
        // (`pa.center`). L'Atout Explosion/Tir de zone frappe UNIFORMÉMENT le rayon (RAW LDB 62 l.254) — AUCUNE
        // touche directe « primaire » ni Critique par victime (l'aire ne re-teste pas) ; `target` (l'ennemi le
        // plus proche de l'impact) n'a servi qu'à la BANDE DE PORTÉE/au DR. Réutilise le résolveur d'aire UNIQUE.
        if (pa.siege && pa.center) {
          const lines = lance.hit && lance.damage != null
            ? [t('cf.impactDeSiege', { name: attacker.label }), ...resolveWeaponArea(get, set,
                { attacker, weapon, damage: lance.damage, location: lance.location ?? 'corps', distanceTiles: distanceDeCombat(attacker, target), center: pa.center },
                battleAreaTargets(get), battleRng()).lines]
            : [t('cf.siegeRate', { name: attacker.label })];
          set({ battle: { ...markActed(get, set), action: null, preview: null, log: [...get().battle!.log, ...evLines(lines, 'tir', attacker.id)] } });
          bus.emit(EVT.SCENE_DIRTY);
          checkBattleOver(get, set);
          advanceCombatJet(get);
          return;
        }
        const prevActed = battle.acted; // restitution de la Frénésie (LDB 21 l.33)
        const isDualMain = !!pa.dualMode && !pa.dualSecond && attacker.kind === 'heros'; // main directrice d'un dual
        const isDualSecond = !!pa.dualSecond; // 2ᵉ frappe (off-hand)
        // Maladresse de l'attaquant (LDB 14 l.19) : ÉCRITE par le temps `oupsAttaquant` de l'après-coup ;
        // mesurée ICI parce qu'elle exclut le balayage que ce site déclare ci-dessous.
        const fumbled = attackerFumbled(lance, weapon, attacker);
        const off = attacker.weapons.find((w) => w.hand === 'secondaire' && w.type === 'melee' && (w.hands ?? 1) === 1);
        const mainRoll = lance.attackerDetail?.roll;
        const coupPrincipal = attacker.kind === 'heros' && !wasChain && !isDualSecond && !pa.freeKind;
        // Frénésie (LDB 21 l.33), `grantFreeAttack{available}` : la suite rend l'Action (`restitution`) ;
        // plafond /Round via `freeAttacksThisTurn['arme']`.
        const frenesie = coupPrincipal && hasFreeWeaponAttack(attacker);
        // LES PRIX DE LA DÉCLARATION, dus quelle que soit l'issue du coup : payés AVANT lui.
        if (fumbled) set({ pendingCleave: null }); // la Maladresse interrompt le balayage
        // Maniement de deux armes, pénalité de défense (LDB 10 l.773) : `dualStrikeDefensePenalty`.
        if (isDualMain) {
          attacker.dualStrikeDefensePenalty = dualStrikeDefensePenalty(attacker);
          set({ battle: { ...get().battle! } });
        }
        // 2ᵉ frappe, Avantage du Maniement de deux armes (LDB 10 l.773), gagné au jet (LDB 13 l.123). `dualBefore` n'existe que si la 1ʳᵉ a touché ; `lance.hit` = la 2ᵉ touche.
        if (isDualSecond) {
          if (dualBefore && lance.hit) { campGain(get, attacker); attacker.gainedAdvThisRound = true; }
          set({ pendingDualStrike: null, battle: { ...get().battle! } });
        }
        // Attaque gratuite de mêlée : compteur dû dès la déclaration, plafond `plafondParTour`. LDB 85 l.237
        if (pa.freeKind) {
          attacker.freeAttacksThisTurn = { ...attacker.freeAttacksThisTurn, [pa.freeKind]: (attacker.freeAttacksThisTurn?.[pa.freeKind] ?? 0) + 1 };
          set({ battle: { ...get().battle! } });
        }
        if (frenesie) {
          attacker.freeAttacksThisTurn = { ...attacker.freeAttacksThisTurn, arme: (attacker.freeAttacksThisTurn?.['arme'] ?? 0) + 1 };
          set({ battle: { ...get().battle!, log: [...get().battle!.log, ev('frenesie', t('cs.freeAttack', { name: attacker.label }), attacker.id)] } });
        }
        // Tir IMMOBILE (LDB 14 l.70) : le héros a renoncé à bouger pour annuler le −10 → on consomme son
        // Mouvement du Tour. Seule CETTE posture tombe : elle a un PRIX (le Mouvement). « Dans le tas » ne
        // coûte rien (`LDB 14 l.106`). HÉROS SEUL — parité stricte avec `attackEnv` et `heldGroundStanceBlock`.
        if (pa.tirImmobile && weapon.type === 'distance' && attacker.kind === 'heros') {
          const b2 = get().battle;
          if (b2) {
            const { tirImmobile: _depensee, ...restantes } = b2.stances?.[attacker.id] ?? {};
            set({ battle: { ...b2, movementUsed: mountMovement(b2, attacker), stances: { ...b2.stances, [attacker.id]: restantes } } });
          }
        }
        // CE QUE CE SITE FERA APRÈS LE COUP (#1508) — donnée d'ENTRÉE : tout ce qui DÉPEND de l'issue du
        // coup (Frappe Mortelle qui exige la mort LDB 14 l.9, ouverture de la 2ᵉ frappe qui lit l'étape de
        // Critique, effets de la manœuvre gratuite, Action rendue, gratuites « à la touche ») voyage avec
        // lui et se joue quand elle est connue — une fenêtre ouverte ici l'emporte dans sa charge.
        // Maniement de deux armes : l'Avantage des deux frappes est différé. `pa.grapple` = Empoignade
        // (LDB 14 l.159) : pose l'Empoignade au lieu des Dégâts.
        const suite: SuiteDeCoup = {
          deferAttackerAdvantage: isDualMain || isDualSecond,
          grapple: pa.grapple,
          ...(pa.freeKind || frenesie ? { restitution: { prevActed } } : restitutionDeChaine ? { restitution: restitutionDeChaine } : {}),
          ...(pa.freeKind ? { manoeuvre: { kind: pa.freeKind } } : {}),
          // Talents d'attaque DÉCLENCHÉE (Assaut féroce, LDB 10 l.72) : `grantFreeAttack{onHit, immediate}`.
          ...(coupPrincipal ? { gratuitesALaTouche: true } : {}),
          // L'ENCHAÎNEMENT se DÉCLARE, toujours : une Maladresse de l'attaquant ou une frappe du Maniement
          // de deux armes n'en ouvrent AUCUN (`aucun`) — sans déclaration, la queue partagée tomberait dans
          // le balayage de la machine (LDB 85 l.362), que ce site écarte. Manœuvre gratuite : LDB 14 l.9.
          enchainement: !fumbled && !isDualMain && !isDualSecond ? { mode: 'heros', wasChain } : { mode: 'aucun' },
          ...(isDualMain && off?.uid && mainRoll != null ? { dualMain: { offWeaponUid: off.uid, mainRoll } } : {}),
          ...(pa.reaction ? { reaction: pa.reaction } : {}),
          ...(pa.riposte != null ? { riposte: pa.riposte } : {}),
        };
        jouerFlowEntier(applyAttackResult(get, set, attacker, victim, weapon, lance, { suite }));
      }
      // Séquence de combat (jet = étape 0) : enchaîner sur les conséquences empilées par applyAttackResult,
      // ou clore (resume) si aucune. La cascade RESTE ouverte tant qu'un enchaînement est en cours
      // (balayage `pendingCleave` / 2ᵉ frappe `pendingDualStrike`) → la frappe suivante se rend dans la MÊME
      // étape `attack` (`pendingAttack` mis à jour par frapperEnBalayage/frapperDeLaSecondeArme) ; on n'avance qu'au bout.
      advanceCombatJet(get);
    },
    // Cycle unifié (spec `defense`) : jet initial = résolution pure (`atk` figé) ; Chance/Pacte ici,
    // Résilience (forcerLaReussite/imposerLeResultat) plus bas. PAS de `annuler` : le RAW n'offre aucun « Subir »
    // volontaire (mêlée = Test opposé, LDB 13 l.123) → une fois offerte, la défense est obligatoire.
    defense: () => {
      // « Appliquer » : applique le résultat puis REPREND le tour de l'IA suspendu.
      const pd = get().pendingDefense;
      if (!pd) return;
      const lance = garanti(pd.result, pd.defenderId, 'jet de la défense');
      // La fenêtre ne se ferme que depuis SON étape : le curseur posé sur la défense de la séquence de combat.
      if (!surLEtapeDeDefense(get())) return;
      // Hors bataille, l'assaillant est celui de la série d'attaques subies (`porteurParId`). MDG 15 l.163-164
      const attacker = porteurParId(get(), pd.attackerId);
      const defender = porteurParId(get(), pd.defenderId);
      // LE SLOT SE VIDE ET L'ÉTAPE SE FERME DANS LE MÊME ÉTAT (#1852) : `committed` DIT à l'état que
      // cette étape a rendu sa donnée. Sans lui, l'état intermédiaire (slot vide, curseur encore posé
      // dessus) est un hôte ORPHELIN pour tout lecteur — le rendu, l'arbitre, la garde du curseur —,
      // et seul le batching React le masquait. Le curseur, lui, quitte l'étape plus bas (`quitterLaDefense`),
      // une fois les conséquences du coup appliquées.
      set((s) => {
        const casc = s.pendingCascade!;
        return {
          pendingDefense: null, // null AVANT la reprise → ré-entrance/double-advance impossibles
          pendingCascade: { ...casc, participants: casc.participants.map((st, i) => (i === casc.cursor ? { ...st, committed: true } : st)) },
        };
      });
      /**
       * QUITTER L'ÉTAPE DE DÉFENSE (#1852) — SOURCE UNIQUE de « cette fenêtre a rendu sa donnée, le
       * curseur n'a plus rien à y faire », pour les sorties de `jetValider('defense')`. Un slot
       * `pendingDefense` REPOSÉ entre-temps appartient à l'étape SUIVANTE (la frappe d'après) : on
       * avance TOUJOURS, sans quoi la donnée neuve s'afficherait dans la fenêtre de la précédente.
       * Rend `false` quand l'étape courante n'est plus la défense (la Maladresse a ouvert SA séquence).
       */
      const quitterLaDefense = (): boolean => {
        if (!surLEtapeDeDefense(get())) return false;
        validerLEtape(get, set);
        return true;
      };
      // Défense SURFACÉE d'une attaque PILOTÉE (#989, `openSurfacedDefense`) : l'issue OPPOSÉE rejoint le
      // chemin d'application UNIQUE de l'attaque — `jetValider('attaque')` reprend avec le résultat défendu. Le
      // curseur est TOUJOURS sur l'étape 'defense' de la MÊME cascade d'attaque : aucun tour n'avance ici
      // (c'est `advanceCombatJet`, au bout de `jetValider('attaque')`, qui enchaîne le curseur).
      // CE QUE CETTE FENÊTRE FERA APRÈS LE COUP (#1858) : la DÉCLARATION de celui qui l'a ouverte, lue
      // ICI et nulle part ailleurs. Une sauvegarde « 1d10 ≥ Indice » (LDB 85 l.98) ou une Déviation
      // ouverte par l'application l'emporte dans SA charge (#1508) : c'est la reprise qui la joue.
      const suite = pd.suite;
      // Réaction de Porte-Bouclier (variante AA 13 l.84) DÉCLARÉE à cette fenêtre : elle entre avec le
      // coup, et son temps d'après-coup la joue APRÈS l'application.
      const reaction = pd.shieldReaction && pd.mode === 'parade' ? pd.shieldReaction : undefined;
      const riposte = pd.riposte != null ? { riposte: pd.riposte } : {};
      if (suite.mode === 'pilotee' && attacker && defender) {
        set({ pendingAttack: { ...suite.pa, result: lance, location: lance.location ?? suite.pa.location, ...(reaction ? { reaction } : {}), ...riposte } });
        get().jetValider('attaque');
        return;
      }
      // Le coup ENTIER (application + après-coup) : `true` = une fenêtre tient la main (sauvegarde,
      // Déviation, Maladresse, dé de casse), et c'est sa reprise qui jouera le reste.
      const tient = suite.mode === 'machine' && !!attacker && !!defender
        && applyAttackResult(get, set, attacker, defender, pd.weapon, lance, { suite: { ...suite.coup, ...(reaction ? { reaction } : {}), ...riposte } });
      // Attaques GRATUITES de l'attaquant après CE coup (`drainerLesGratuites`) : UNE file, qui S'ARRÊTE à la
      // première fenêtre ouverte : la fenêtre qui suit est celle de la gratuite SUIVANTE, sur SA propre étape
      // (LDB 85 l.41-43). Une fenêtre qui tient la main laisse la file à sa reprise (`resumeSuspendedAI`).
      // LDB 11 l.103 : la suite DÉCLARÉE par `runPreemptShots` tranche.
      const tirRapide = suite.mode === 'machine' && suite.coup.enchainement?.mode === 'tirRapide';
      if (!tient && !tirRapide && attacker && drainerLesGratuites(get, set, attacker)) { quitterLaDefense(); return; }
      // La défense est l'étape de SA cascade combat → enchaîner le curseur (les conséquences empilées —
      // Critique/Maladresse — s'affichent inline ; la clôture reprend l'IA). Rien derrière elle : reprise.
      if (!quitterLaDefense()) resumeEnemyTurn(get, set);
    },
    /** « Appliquer » : applique le soin (le jet est déjà figé). Coûte l'Action en combat. L'infirmerie
     *  (`infirmerie`) n'est PAS touchée : la modale persistante reste ouverte pour l'acte suivant. */
    soins: () => {
      const ph = get().pendingHeal;
      if (!ph) return;
      set({ pendingHeal: null });
      const st = get();
      const target = actorIn(st, ph.targetId);
      if (!target) return;
      const log: string[] = [];
      // Bandages engagés : une unité s'use réussite ou échec (décision de l'orchestrateur, 2026-11-03, #3059, maison).
      const porteur = ph.bandagesDe ? actorIn(st, ph.bandagesDe) : undefined;
      const panse = !!porteur && retirerUnBandage(porteur);
      if (panse && porteur) log.push(t('heal.bandageUtilise', { name: porteur.label }));
      const params = { test: ph.test, bandages: panse };
      if (ph.mode === 'blessures') {
        const r = resolveWoundsHeal(target, ph.intBonus, ph.sl, ph.success, battleRng(), panse);
        log.push(...r.log);
        if (r.healed > 0) bus.emit(EVT.ANIM_FLOAT, { to: target.id, text: t('fx.soin', { n: r.healed }), kind: 'soin' });
      } else if (ph.mode === 'hemorragie') {
        log.push(...resolveBleedHeal(target, ph.sl, ph.success, params));
      } else if (ph.mode === 'munition') {
        log.push(...resolveExtractLodgedAmmo(target, ph.success)); // LDB 62 l.250 — Test de Guérison Intermédiaire
      } else {
        log.push(...treatTrauma(target, ph.sl, ph.success)); // mode 'traumatisme' — l'échec consomme aussi le jet (LDB 18 l.222)
      }
      // Aide Médicale (LDB 18 l.308-311) : le soin réussi, ou le bandage appliqué, réussi ou non.
      if (ph.success || panse) log.push(...receiveMedicalAid(target), ...releaseConditionLocks(target, 'medicalAid'));
      finishPlayerAction(get, set, log, 'soin'); // sortie commune combat / hors combat
    },
    // Cycle Chance/Pacte UNIFIÉ (spec `cast`) — Résilience (forceSuccess/setForcedRoll) plus bas.
    incantation: () => {
      const { pendingCast: pc } = get();
      if (!pc) return;
      const lance = garanti(pc.result, pc.casterId, 'jet d’incantation');
      // Choix tranché : l'aiguilleur du Contre-sort, différé au jet, s'exécute maintenant.
      if (lance.isCritical && !pc.counterspellRouted && routeCounterspell(get, set)) return;
      // ZONE non posée → la confirmation NE résout JAMAIS en mono-cible sur l'ancre lanceur : ce bloc est
      // l'UNIQUE sortie d'une ZdE non posée (héros comme IA), exactement la même pour tous. Seul l'éventuel
      // « clic » de pose change de SOURCE (souris du héros / décision de l'IA), comme l'auto-combat fournit
      // déjà ses jets.
      if (pc.zone && !pc.zone.center) {
        const castable = castAfterCrit(lance, pc.critChoice);
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
        get().jetRegler('incantation', 'carte', 'zone');
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
      // `jetValider('opposition')` repose `opposedOutcome` puis reprend la chaîne (`resolveCastChain`, ce bloc est alors sauté).
      if (openCastOppositionStep(get, set)) return;
      // FOLD : on ne ferme PLUS la cascade d'incantation ici — seulement le JET (CastModal disparaît).
      // La cascade `purpose:'combat'` (étape `jet:'incantation'`) reste ACTIVE pour qu'un Critique de Sort
      // (pushReveal 'critical') ou une Imparfaite/Colère (étape appendue) s'y APPENDENT comme l'attaque.
      // On repère l'étape `jet:'incantation'` SOUS le curseur AVANT applyCast (présente seulement si l'incantation
      // a été ouverte par openCastCascade ; absente quand un test/IA pose pendingCast à la main).
      const cascBefore = get().pendingCascade;
      const castStepIdx = cascBefore && cascBefore.purpose === 'combat' && cascBefore.participants[cascBefore.cursor]?.jet === 'incantation'
        ? cascBefore.cursor : -1;
      set({ pendingCast: null }); // ferme le JET ; la cascade d'incantation reste active (cursor sur 'incantation')
      if (caster && target && spell) {
        const ocDur = overcastDurationParts(overcastSourceOf(spell), pc.overcast?.duration ?? 0);
        applyCast(get, set, caster, target, spell, lance, pc.missile, pc.focused, pc.critChoice, {
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
      // Avance la cascade au-delà de l'étape `jet:'incantation'` (résolue, CastModal éteint) : des conséquences
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
      // ouverte) — elle reprendra elle-même (validation d'étape → resumeSuspendedAI à la clôture).
      if (caster && aiDriven(get(), caster) && get().battle) resumeEnemyTurn(get, set);
    },
    contreSort: () => {
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
    opposition: () => {
      const pco = get().pendingCastOpposition;
      const pc = get().pendingCast;
      if (!pco || !pc) return;
      // Issue par cible (résisté + marge de DR) → portée par `pendingCast.opposedOutcome`, lue par applyCast.
      const outcome: Record<string, { resisted: boolean; margin: number }> = {};
      for (const part of pco.participants) if (part.result) outcome[part.id] = { resisted: part.result.resisted, margin: part.result.margin };
      set({ pendingCastOpposition: null, pendingCast: { ...pc, opposedOutcome: outcome } });
      resolveCastChain(get, set); // opposition résolue → application (cibles résistantes ignorées, autres à la marge)
    },
    // Focalisation COMMUNE combat/hors-combat (couture D) : acteur via `actorIn`, sortie journal hors combat.
    focalisation: () => {
      const { pendingFocus: pf } = get();
      if (!pf) return;
      const caster = actorIn(get(), pf.casterId);
      const spell = findSpellById(pf.spellId);
      set({ pendingFocus: null });
      if (!caster || !spell) return;
      const res = garanti(pf.result, pf.casterId, 'jet de Focalisation');
      const ni = castingNumberOf(spell, false, {}, [], caster);
      caster.focus = { spell: pf.spellId, dr: garanti(progresDeFocalisation(pf, caster, ni).step, pf.spellId, 'jet de Focalisation').total };
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
          if (seaMajeure) logLines.push(...applyMiscast(get, set, caster, 'mineure', { componentDowngrade: compUsed, domainId: spell.domainId?.id }));
          else logLines.push(t('cs.focusHarmonized'));
        } else {
          logLines.push(...applyMiscast(get, set, caster, seaMajeure ? 'majeure' : 'mineure', { componentDowngrade: compUsed, domainId: spell.domainId?.id }));
        }
      }
      logLines.push(caster.focus.dr >= ni ? t('cs.focusEnough', { name: caster.label, spell: spell.label }) : t('cs.focusProgress', { dr: caster.focus.dr, ni }));
      // Maladresse en Focalisation → Incantation Imparfaite Majeure (LDB 46 l.140).
      if (res.isFumble) logLines.push(...applyMiscast(get, set, caster, 'majeure', { componentDowngrade: compUsed, domainId: spell.domainId?.id }));
      finishPlayerAction(get, set, logLines, 'focalisation'); // sortie commune combat / hors combat (pose `acted:true`)
      // Lanceur ENNEMI (modale auto-pilotée) : le tour de l'IA était suspendu → reprise (calqué sur
      // jetValider('incantation')). No-op si une interaction bloquante s'est ouverte (Imparfaite/révélation) — elle
      // reprendra elle-même (resumeSuspendedAI à la clôture).
      if (aiDriven(get(), caster) && get().battle) resumeEnemyTurn(get, set);
    },
    // Dissipation COMMUNE combat/hors-combat (couture D, #461) : acteur via `actorIn`, sortie
    // journal hors combat (calque `jetValider('focalisation')`).
    dissipation: () => {
      const { pendingDispel: pd } = get();
      if (!pd) return;
      const caster = actorIn(get(), pd.casterId);
      set({ pendingDispel: null });
      if (!caster) return;
      const res = garanti(pd.result, pd.casterId, 'jet de Dissipation');
      const { sl: ownSl, step } = progresDeDissipation(pd, caster);
      const { total, done } = garanti(step, pd.spellId, 'jet de Dissipation');
      const logLines = [t('cs.dispelRoll', { name: caster.label, spell: pd.label, roll: res.roll, target: res.target, sl: `${ownSl >= 0 ? '+' : ''}${ownSl}`, total, ni: pd.ni })];
      if (done) {
        // Réussite (DR cumulé ≥ NI, LDB 46 l.160) : retire les effets du sort de tous ses porteurs.
        // Dissipation COMMUNE combat/hors-combat (couture D, #461) : le porteur du sort peut être
        // hors du `battle.combatants` courant (cible du groupe hors combat) → cible la BONNE liste.
        caster.dispel = undefined;
        const b = get().battle;
        // Les États PORTÉS par le Sort partent à ce geste (#1695) : leurs lignes rejoignent CELLES de
        // l'Action (`finishPlayerAction` ci-dessous). Pas de récepteur `ConditionEmit` ici : le canal
        // déclaré du store (`pendingLogQueue.stateId`, `noyau/etat.ts:496`) n'a encore AUCUN producteur.
        const n = dissipateSpell(b ? b.combatants : get().party, pd.spellId, pd.spellCasterId, undefined, logLines);
        set(touchActors(get()));
        logLines.push(t('cs.dispelDone', { spell: pd.label, extra: n > 1 ? t('cs.fragTargetsFreed', { n }) : '' }));
      } else {
        caster.dispel = { spellId: pd.spellId, spellCasterId: pd.spellCasterId, total };
      }
      finishPlayerAction(get, set, logLines, 'sort'); // Action consommée (catégorie magie au journal)
    },
    frenesie: () => {
      const { battle, pendingFrenzy: pf } = get();
      if (!battle || !pf) return;
      const lance = garanti(pf.result, pf.combatantId, 'jet de Frénésie');
      const c = inBattleId(battle, pf.combatantId);
      set({ pendingFrenzy: null });
      if (!c) return;
      // ISSUE dérivée par le goulot (`FLOWS.frenesie.apply`, canal COMBAT) : pending FOURNI (fermé juste avant).
      const log = FLOWS.frenesie.apply(get, { p: pf });
      if (lance.success) (c.psychState ??= []).push({ type: 'frenesie' });
      set({ battle: { ...markActed(get, set), action: null, log: [...get().battle!.log, ...evLines(log, 'frenesie', c.id)] } });
      checkBattleOver(get, set);
    },
  } satisfies Partial<CloturesDuJet>;
}
