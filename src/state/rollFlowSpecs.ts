/**
 * Specs des flux de jet différé (cf. `rollFlow.ts` pour le cycle de vie générique).
 *
 * Chaque entrée de `FLOWS` déclare la partie MÉTIER d'un flux (comment résoudre le jet, quand il
 * est relançable, comment la Chance « +1 DR » et la Résilience re-dérivent le résultat) ; le store
 * câble les handlers générés sous les noms canoniques (`trampleRoll`, `trampleReroll`…) et garde
 * la main sur « Appliquer » (`xConfirm`) et « Annuler ».
 *
 * Fidélité : chaque `resolve`/`derive` reprend À L'IDENTIQUE le code historique du store
 * (références RAW en place). Ne rien y « simplifier » sans citer la source.
 */
import type {
  GameState,
  PendingTrample, PendingBattement, PendingDistraire, PendingManeuver, PendingRun, PendingFall, PendingShipManeuver, ShipManeuverParticipant, PendingShipBattery, ShipBatteryParticipant, PendingCrewTest, PendingShanty, PendingFocus, PendingDispel, PendingFrenzy, PendingApproach, PendingWard,
  PendingReload, PendingStateRecovery, PendingTest, PendingSteamSave, PendingAppraise, PendingBargain, PendingHeal, PendingSurgery,
  PendingCorruption, PendingAttack, PendingHandGate, PendingDefense, PendingCast, PendingDisengage, FleeSlot, FleeBackstabSlot, PendingAuContact, PendingGrapple,
  PendingCounterspell, CounterParticipant, PendingExtendedTest, ExtendedTestRound,
  PendingForceDoor, PendingEtalLot, EtalLotRow, ForceDoorParticipant,
  PendingCastOpposition, OppositionParticipant,
  PendingCascade, CascadeStep, BatchParticipant,
} from './store';
import type { PendingActivity, ActivityOppositionOn } from './interludeFlow';
import type { Combatant, Weapon } from '../engine/types';
import type { Get, Set } from './flowTypes';
import { FLOW_VERBS, type RollVerb, type FlowVerbs } from './flowVerbs';
import type { ForcedPick, RollFlowSpec } from './rollFlowFactory';
import { makeRollFlow, type RollFlowHandlers, type RollFlowLens, type PendingBase } from './rollFlowFactory';
import { TestOutcome } from '../engine/testOutcome';
import type { RollBreakdown } from '../engine/combat';
import { battleRng } from './battleRng';
import { touchActors, seaMagicContext, windsMagicModOf } from './combatOrParty';
import { actorIn, garanti, inBattleId } from './combatants';
import {
  TRAMPLE_WEAPON, resolveAttack, firedWeapon, bestDefenseMode, effectiveSpellOf,
  disengageOutcome, castContextMods,
  rollManeuverAttacker, maneuverAttackerDifficulty, distraireAttackValue,
  counterspellDeclarePhase, counterspellRolls, counterspellSoutenu, counterspellSoutienFor,
  clearApproachMoves,
} from './combatFlow';
import { bus, EVT } from './bus';
import { campSpend } from './combat/advantagePool';
import { creatureAttacks } from '../engine/creatureAttacks';
import { mountMovement, mountedDodgePenalty } from './mount';
import { sceneCombatModifiers } from './sceneRules';
import { sceneMetresPerTile } from './scene';
import { REDERIVATIONS, resolveTrample, rederivePassiveAttack, resolveBackstabAttack, backstabWeapon, finishMelee, finishRanged, rollMeleeDefender, rollDisengageAttack, rollGrappleForce, combatValue, frozenDifficulty, type AttackResult, type DefenseSub } from '../engine/combat';
import { runMovementBonus } from '../engine/combatFeatures/dispatch';
import { rollTest, resolveOpposed, opposedBranchSuccess, bumpSL, type TestResult, evaluateTest, evaluateCombinedTest, bestForcedRoll, forcedTR, hydrateTR } from '../engine/tests';
import { DIFFICULTY_MODIFIERS, type Difficulty } from '../engine/types';
import { d100, defaultRNG, type RNG } from '../engine/dice';
import { resolveRun, resolveDeliberateFall, runFromTest, fallFromTest } from '../engine/movement';
import { rollCrewRole, forceCrewRole } from './shipManeuver';
import { rollBatchParticipant, forceBatchParticipant, opposedCascadeRoll, stepOpposedFreeze, lireDeEtape, roulerDeEtape } from './cascade';
import { rollLine } from './rollSeam';
import { activityModLines } from '../engine/activities';
import { testValue, effectiveSkillCharKey, skillBaseValue } from '../engine/skills';
import { skillDRBonus, charDRBonusOf, offTerrainTestDR } from '../engine/ops';
import { resolveFocus, resolveMagicMissile, resolveCasting, rederiveCastSL, castTestDRMods, talentTestSLBonus, resolveCounterspell, counterspellOutcomeFrom, withCastTestDRMods, castTestOf, castTestTarget, castingValue, castInfoIsPrayer, malepierreDR, malepierreReserveOf } from '../engine/magic';
import { discreetPrayerDifficulty } from '../engine/prayer';
import { rule } from '../engine/policy';
import { effectiveChar, bonus } from '../engine/characteristics';
import { resolveFrenzyEntry, calmeValue, spendResolveForPsychImmunity } from '../engine/psychology';
import { t } from '../i18n';
import { describeTest, describeBargain, describeReload, describeStateRecovery, describeFrenzy } from './flowOutcomes';
import { findSpellById, byId } from '../data/index';

/** Re-dérive une attaque FIGÉE avec un jet d'attaquant modifié (Chance +1 DR / Résilience / dé
 *  choisi) : Test opposé si un défenseur a joué, attaque passive sinon — partagé attaque/force.
 *  La Difficulté VOYAGE avec le résultat d'origine (`frozenDifficulty`) : ce re-jet n'a plus le
 *  contexte (distance, env, flanc/dos) qui l'a composée, et dépenser un point ne la change pas. */
function rederiveAttack(attacker: Combatant, target: Combatant, p: PendingAttack, atk2: TestResult, combatants?: Combatant[]): AttackResult {
  // L'arme FIGÉE au jet prime : `Combatant.weapons` ne porte que le loadout ACTIF, donc un uid seul
  // peut être introuvable et rendre la main à l'auto-choix (un tir au contact redeviendrait une frappe).
  const weapon = p.weapon ?? firedWeapon(attacker, target, p.weaponUid, combatants, p.harpoonRopeCut);
  const r = p.result!;
  const compo = frozenDifficulty(r.attackerDetail);
  if (!compo) {
    // Symétrie avec `rederivePassiveAttack` : une re-dérivation qui recompose faute de Difficulté
    // transportée ne peut pas être SILENCIEUSE (patron `REDERIVATIONS`).
    REDERIVATIONS.recomposees += 1;
    console.error('[combat] rederiveAttack : re-dérivation SANS Difficulté transportée — le détail d’origine n’en portait pas.');
  }
  if (r.defenderDetail) {
    const dd = r.defenderDetail;
    const def: TestResult = hydrateTR(dd);
    // BRANCHER PAR LE TYPE DE L'ARME FIGÉE, comme `finishDefenseResult` : un TIR défendu (Bout
    // Portant, `LDB 14 l.40`) reste un Test de Projectiles. `finishMelee` le rendait « Corps à corps »
    // avec une base de Capacité de Combat, quelle que soit l'arme en main.
    // Mode et arme de parade viennent du jet du DÉFENSEUR (figés dans son détail), la pénalité
    // d'esquive du contexte de la résolution — jamais un défaut forgé.
    // p.withhold (Retenir ses coups, AA) propagé : la re-dérivation Chance/Résilience garde le coup non létal.
    const mode = dd.mode ?? bestDefenseMode(target);
    const dodge = p.dodgeMod ?? 0;
    // Substitution sociale (Intimidation/Dressage, LDB 09 l.207/287) : base et libelle viennent du jet
    // de defense FIGE. Sans eux, la rangee defenseur repartait sur une Parade a base 0.
    const sub = mode === 'social' ? { base: dd.base, label: dd.label } : undefined;
    return weapon.type === 'ranged'
      ? finishRanged(attacker, target, weapon, atk2, def, mode, p.distanceTiles, p.location ?? undefined, [], r.parryWeapon, dodge, 2, compo)
      : finishMelee(attacker, target, weapon, atk2, def, mode, p.location ?? undefined, [], dodge, undefined, r.parryWeapon, p.withhold, sub, compo);
  }
  return rederivePassiveAttack(attacker, target, weapon, atk2, weapon.type === 'ranged' ? 'ranged' : 'melee', p.location ?? undefined, p.withhold, compo);
}

/** Résout le résultat d'une défense réactive : TIR DÉFENDU (`finishRanged`, opposition RAW à distance —
 *  Protectrice 2+/Bout Portant/tireur Engagé) OU mêlée (`finishMelee`), selon le type d'arme FIGÉE de
 *  l'attaquant. `p.distanceTiles` sert au breakdown Projectiles ; `parry` = arme de parade choisie. */
function finishDefenseResult(attacker: Combatant, defender: Combatant, p: PendingDefense, def: TestResult, dodgeMod = 0, parry?: Weapon, metresPerTile = 2): AttackResult {
  const sub = defenseSubOf(defender, p);
  const atk = forcedOpposedAtk(p, def);
  // La Difficulté de l'attaque a été FIGÉE à l'ouverture de la fenêtre (`atkCompo`) : le jet est
  // antérieur, et son contexte (flanc/dos notamment) ne voyage pas jusqu'ici.
  return p.weapon.type === 'ranged'
    ? finishRanged(attacker, defender, p.weapon, atk, def, p.mode, p.distanceTiles, p.location ?? undefined, p.env ?? [], parry, dodgeMod, metresPerTile, p.atkCompo)
    : finishMelee(attacker, defender, p.weapon, atk, def, p.mode, p.location ?? undefined, p.env ?? [], dodgeMod, p.dmgProxy, parry, !!p.withhold, sub, p.atkCompo);
}

/**
 * ANNULATION MUTUELLE : quand les DEUX camps dépensent « Je ne faillirai pas ! » — la garantie de
 * REMPORTER le Test opposé d'office, au plancher DR adverse +1 (`LDB 17 l.68`) — les deux
 * s'annulent : personne ne gagne d'office, les deux Points restent brûlés, le Test se résout aux
 * dés (arbitrage utilisateur 2026-07-31 [entériné 2026-08-03], verbatim au ticket #1000).
 * Le dé posé et la localisation restent (RAW).
 * `attaquantForce` = forçage de l'attaquant (voyage sur l'attaque figée) ; `p.forced` = forçage du
 * défenseur — `defenderForcing` couvre le forçage EN COURS, dont le drapeau n'est posé qu'APRÈS le
 * patch (`opForceSuccess`).
 */
export function opposedForcingCancelled(p: PendingDefense, defenderForcing = false): boolean {
  return attaquantForce(p) && (defenderForcing || !!p.forced);
}
/** L'ATTAQUANT a-t-il dépensé « Je ne faillirai pas ! » (LDB 17 l.68) sur le jet figé de cette fenêtre ?
 *  Le forçage vit sur l'attaque elle-même, que seule la suite PILOTÉE porte — une frappe de la machine
 *  n'a pas d'attaque en attente, donc pas de garantie à honorer ici. */
function attaquantForce(p: PendingDefense): boolean {
  return p.suite.mode === 'pilotee' && !!p.suite.pa.forced;
}
/** Ligne factuelle rendue au joueur qui dépense le SECOND Point (#1000) — l'annulation n'est jamais
 *  silencieuse. Consommateur : la fenêtre de défense (`useDefenseJetProps`). */
export const OPPOSED_FORCING_CANCELLED_NOTE = 'Les deux Résiliences s’annulent — le Test se résout aux dés.';

/** Plancher de DR du dé forcé en Test OPPOSÉ. Garantie ACTIVE (LDB 17 l.68 : « S'il s'agit d'un Test
 *  opposé, vous l'emportez avec au moins DR +1 ») → DR de l'opposant + 1, au minimum 1 : c'est la
 *  garantie elle-même qui fonde ce minimum. Garanties ANNULÉES (#1000) → plancher NUL : le dé posé
 *  s'évalue au naturel, DR 0 compris (LDB 12 l.94). */
function opposedForcedFloor(opponentSL: number, cancelled: boolean): number {
  return cancelled ? 0 : Math.max(opponentSL + 1, 1);
}

/** Jet du MARCHANDEUR prêt pour l'opposition (LDB 59 l.43) : `playerSkill` porte le Soutien et TOUS les
 *  modificateurs de la valeur de Test (États, mutation, qualité d'objet… — `skills.testValueParts` en
 *  tient l'inventaire), qui restent dans la CIBLE mais ne départagent pas à DR égal (LDB 12 l.160) — la
 *  grandeur comparée est le Niveau de Compétence NU posé à l'accesseur canon par `startBargain`
 *  (`PendingBargain.playerBase`), jamais reconstitué ici par soustraction. SOURCE UNIQUE des jets
 *  joueur du flux `bargain` (lancer, relance, dé de Résilience). */
function bargainPlayerTR(p: PendingBargain, tr: TestResult): TestResult {
  return { ...tr, base: p.playerBase };
}

/** Jet d'attaque figé, HONORANT « Je ne faillirai pas ! » (LDB 17 l.68 : « S'il s'agit d'un Test opposé,
 *  vous l'emportez avec au moins DR +1 »). La garantie est une propriété de l'OPPOSITION, pas du jet :
 *  sur le chemin INTERPOSÉ elle voyage MARQUÉE sur l'attaque figée (suite `pilotee`) et se règle ICI, au
 *  moment où la défense est connue — même formule que le chemin inline (`FLOWS.attack.resolve` : DR du
 *  défenseur + 1). Attaque non forcée, ou garanties annulées (#1000) → jet rendu TEL QUEL. */
function forcedOpposedAtk(p: PendingDefense, def: TestResult): TestResult {
  if (!attaquantForce(p) || opposedForcingCancelled(p)) return p.atk;
  return { ...p.atk, sl: Math.max(p.atk.sl, def.sl + 1, 1) };
}

/** Descripteur de la défense par SUBSTITUTION sociale (Intimidation/Dressage, LDB 09 l.207/287), ou
 *  `undefined` hors mode 'social'. Base = valeur de Test de la Compétence figée au choix
 *  (`substituteSkillId`, `skillBaseValue`) ; libellé = son nom d'affichage. */
function defenseSubOf(defender: Combatant, p: PendingDefense): DefenseSub | undefined {
  if (p.mode !== 'social' || !p.substituteSkillId) return undefined;
  return { base: skillBaseValue(defender, p.substituteSkillId), label: byId('skill', p.substituteSkillId)?.label ?? DEFENSE_LABEL_FALLBACK };
}
const DEFENSE_LABEL_FALLBACK = 'Intimidation';

/** Opposition FIGÉE de l'étape de cascade COURANTE (celle dont le flux `cascadeBatch` lance les
 *  rangées) — la lecture, jamais une seconde source : `stepOpposedFreeze` (state/cascade.ts) décide
 *  seul de ce qu'est un freeze. `undefined` hors cascade ou sur une étape non opposée. */
function currentStepFreeze(s: GameState) {
  const p = s.pendingCascade;
  return p ? stepOpposedFreeze(p.participants[p.cursor]) : undefined;
}

// ── Délégués de jet du store : générateur + types (fin de la duplication ~113 lignes) ──
//
// Chaque flux de `FLOWS` est câblé dans le store sous des noms canoniques `<prefix><Verbe>`
// (`trampleRoll`, `trampleReroll`…). Ces délégués étaient écrits À LA MAIN, un par ligne — un
// SOUS-ENSEMBLE hétérogène des 6 verbes par flux (un flux sans `caps.forced` n'expose pas
// `…ForceSuccess`/`…SetForcedRoll`, etc.). `rollFlowActions`/`rollFlowActionsMulti` reproduisent
// EXACTEMENT le même ensemble de clés (le store passe la liste des verbes voulus) sans rien
// recopier ; le runtime est byte-identique (mêmes appels `FLOWS.<x>.<m>(get, set[, …])`).

/** Verbes du cycle de jet différé, définis avec la table de flux dans `flowVerbs.ts`. */
export type { RollVerb, FlowVerbs, FlowKey } from './flowVerbs';

const capitalize = <S extends string>(s: S): Capitalize<S> =>
  (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<S>;

/** Délégués MONO : `setForcedRoll` prend `(roll)`, les autres `()`. Clé = `${prefix}${Verbe}`. */
export type MonoRollActions<P extends string, A extends RollVerb> = {
  [K in A as `${P}${Capitalize<K>}`]: K extends 'setForcedRoll' ? (roll: number) => void : () => void;
};
/** Délégués MULTI : `pid` en tête (slot ciblé) ; `setForcedRoll` prend `(pid, roll)` ; `cancel` reste
 *  sans argument (il ferme la situation entière, pas un participant). */
export type MultiRollActions<P extends string, A extends RollVerb> = {
  [K in A as `${P}${Capitalize<K>}`]: K extends 'setForcedRoll' ? (pid: string, roll: number) => void : K extends 'cancel' ? () => void : (pid: string) => void;
};

/** Délégués MONO d'un flux : les verbes listés, byte-identiques aux anciens `() => FLOWS.x.m(get, set)`. */
export function rollFlowActions<P extends string, const A extends readonly RollVerb[]>(
  prefix: P, flow: RollFlowHandlers, get: Get, set: Set, verbs: A,
): MonoRollActions<P, A[number]> {
  const out: Record<string, (roll?: number) => void> = {};
  for (const v of verbs) {
    out[`${prefix}${capitalize(v)}`] = v === 'setForcedRoll'
      ? (roll?: number) => flow.setForcedRoll(get, set, roll as number)
      : () => flow[v](get, set);
  }
  return out as MonoRollActions<P, A[number]>;
}

/** Délégués MULTI d'un flux : `pid` en tête, byte-identiques aux anciens `(pid) => FLOWS.x.m(get, set, pid)`. */
export function rollFlowActionsMulti<P extends string, const A extends readonly RollVerb[]>(
  prefix: P, flow: RollFlowHandlers, get: Get, set: Set, verbs: A,
): MultiRollActions<P, A[number]> {
  const out: Record<string, (a?: string | number, b?: number) => void> = {};
  for (const v of verbs) {
    out[`${prefix}${capitalize(v)}`] = v === 'setForcedRoll'
      ? (pid?: string | number, roll?: number) => flow.setForcedRoll(get, set, roll as number, pid as string)
      : v === 'cancel'
        ? () => flow.cancel(get, set) // « Annuler » ferme la situation entière (pas de `pid`)
        : (pid?: string | number) => flow[v](get, set, pid as string);
  }
  return out as MultiRollActions<P, A[number]>;
}

// `RollFlowActionsMap` (surface EXACTE des délégués de jet du store) est DÉRIVÉE de `FLOW_WIRING` —
// voir sa définition en bas de fichier (après la table). Fin de la recopie à la main des 36 lignes.

/** Spec PARTAGÉE des Tests d'équipage MULTI (MDG 14) : un jet PAR RÔLE tenu (`rollCrewRole`), Résilience
 *  = DR max du contributeur (`forceCrewRole`), Chance « +1 DR » sur SON jet. Consommée par les 3 flux jumeaux
 *  (manœuvre / bordée / Test d'équipage générique) — la spec n'est écrite qu'UNE fois. */
function crewRoleFlowSpec<P extends import('./rollFlowFactory').PendingBase & { participants: ShipManeuverParticipant[] }>(
  key: 'pendingShipManeuver' | 'pendingShipBattery' | 'pendingCrewTest',
): import('./rollFlowFactory').RollFlowSpec<P, ShipManeuverParticipant> {
  return {
    key,
    multi: { slots: (p) => p.participants, idOf: (r) => r.id, replace: (p, parts) => ({ ...p, participants: parts }) },
    rolled: (r) => !!r.result,
    die: roll3Die<ShipManeuverParticipant, P>(),
    actor: (s, r) => actorIn(s, r.id),
    caps: { forced: true },
    resolve: (_s, r, actor, _get, forced) => {
      if (!actor) return null;
      const rr = forced ? forceCrewRole(actor, r.roleId, r.cumul, r.sense) : rollCrewRole(actor, r.roleId, battleRng(), r.cumul, r.sense);
      return rr ? { result: rr } : null;
    },
    outcome: (r) => cleanRollOutcome(r.result), // d100 propre réussi (roll ≤ cible)
    // Chance « +1 DR » sur CE contributeur (LDB 17 l.24).
    bonus: { derive: (_s, r) => bumpResultSL(r) },
  };
}

/** Une Activité/Scène de bataille est-elle GAGNÉE ? Test COMBINÉ (l.75/102) : `full` seulement — un
 *  `partial` (skill-1 réussie mais skill-2 ratée) est un ÉCHEC GLOBAL RAW (LDB 12 l.206). Tenue (l.161,
 *  Test opposé) et cas simple → le `success` du résolveur (tenue : `holdVerdict` / réussite numérique).
 *  Gouverne le GARDE de la Résilience (rien à forcer si déjà gagné), en écho au `failed` du flux `activity`. */
function activityWon(p: PendingActivity): boolean {
  return p.combinedLevel != null ? p.combinedLevel === 'full' : p.success;
}

/** Verdict du Test OPPOSÉ de « Tenez votre position » (ADE II 8 l.161 : « l'ennemi effectue un Test
 *  opposé contre les Personnages ») : `resolveOpposed` est le SEUL juge (LDB 12 l.160) entre le jet du
 *  PJ et le jet FIGÉ de l'ennemi. `held` = l'ennemi ne l'emporte pas ; `enemySL` = DR net de l'ennemi
 *  (positif = il progresse), cumulé en Point de rupture. SOURCE UNIQUE des trois sites (1ᵉʳ jet, dé
 *  choisi, Chance « +1 DR »).
 *  Les DEUX `base` sont les valeurs NUES POSÉES par l'opener (`skillBase` = Niveau de Compétence du
 *  PJ au sens `LDB 09 l.17` — ni État, ni Encombrement, ni passif, ni Soutien ; `enemyBase` = Puissance
 *  de l'armée hors bonus de tenue) : ce site les LIT, il n'en dérive aucune. Une nue absente (save
 *  antérieure aux champs) fait retomber les DEUX camps sur leurs cibles (tout-ou-rien d'`openValues`). */
function holdVerdict(p: PendingActivity & ActivityOppositionOn, jet: { roll: number; sl: number; success: boolean }): { held: boolean; enemySL: number } {
  const et = evaluateTest(p.enemyRoll, p.enemyValue, p.enemyBase);
  const pj = { roll: jet.roll, target: p.target, base: p.skillBase, success: jet.success, sl: jet.sl, isDouble: false };
  const opp = resolveOpposed(pj, et);
  return { held: opp.winner !== 'defender', enemySL: et.sl - jet.sl };
}

// ── Fabriques d'ISSUE CANONIQUE (cf. `TestOutcome`) — les DEUX formes récurrentes, écrites UNE fois.
//    Chaque flux passe SON champ de résultat ; les cas particuliers (attaque/opposition/DR de Course/
//    Focalisation…) gardent leur `outcome` explicite en dessous. ──

/** Choke-point PARTAGÉ du scellement (#275 Décision 2) : reconstruit le `TestResult` minimal exigé par
 *  `TestOutcome.seal` depuis les formes hétérogènes de résultat des flux — `isDouble` n'est jamais tracé
 *  ICI (non lu par `TestOutcome`, cf. `engine/testOutcome.ts`). `detail` transite TEL QUEL quand le flux
 *  possède un vrai `RollBreakdown` (attaque/défense/piétinement…) — jamais fabriqué de toutes pièces. */
const sealOutcome = (won: boolean, sl: number, roll = 0, target = 0, detail?: RollBreakdown): TestOutcome =>
  TestOutcome.seal({ roll, target, success: won, sl, isDouble: false }, detail);

/** Issue d'un Test dont le résultat est déjà un `{ success, sl }` (jet simple ou opposé résolu) : la
 *  réussite RÉELLE + son Degré. Couvre défense/désengagement/agrippe/battement/manœuvre/psy/dissipation… */
const testOutcome = (r: { roll?: number; target?: number; success?: boolean; sl?: number } | null | undefined): TestOutcome =>
  sealOutcome(!!r?.success, r?.sl ?? 0, r?.roll ?? 0, r?.target ?? 0);

/** Issue d'un Test dont on lit le d100 BRUT (réussite propre = `roll ≤ cible`, LDB 12) + son DR — les
 *  flux qui gatent la Chance sur le jet propre (soin/rechargement/évaluation/marchandage/corruption…). */
const rollOutcome = (roll: number | null | undefined, target: number, sl: number | null | undefined): TestOutcome =>
  sealOutcome((roll ?? 0) <= target, sl ?? 0, roll ?? 0, target);

/** Issue d'un Test dont le résultat est un `{ roll, target, sl }` SANS champ `success` (réussite propre
 *  = `roll ≤ cible`) : incantation, enfoncement de porte, Test d'équipage — un résultat absent = échec. */
const cleanRollOutcome = (r: { roll: number; target: number; sl?: number } | null | undefined): TestOutcome =>
  sealOutcome(!!r && r.roll <= r.target, r?.sl ?? 0, r?.roll ?? 0, r?.target ?? 0);

/** Réussite forcée d'un Test BINAIRE (Résilience « Je ne faillirai pas ! », LDB 17 l.68) : renvoie le
 *  `{ success, roll, target, sl }` forcé — avant le jet (pas de résultat → dé 01), ou après un échec
 *  (réussite au DR courant, planché à 0) — ou `null` si le Test est DÉJÀ réussi (rien à forcer). Partagé
 *  par Frénésie/Approche/Bénédiction (sur `p.result`) et Fuir (sur le `calme` de son slot). */
const forcedBinarySuccess = (r: { success?: boolean; roll?: number; target?: number; sl?: number } | null | undefined) =>
  r?.success ? null : { success: true, roll: r?.roll ?? 1, target: r?.target, sl: Math.max(r?.sl ?? 0, 0) };

/** Réussite forcée BINAIRE d'un flux dont le jet vit sous `result` (Frénésie/Approche/Bénédiction) :
 *  `{ result }` ou `null` si le Test est DÉJÀ réussi — l'emballage `result` partagé par les 3 branches `if (forced)`. */
const forcedBinaryResult = (r: { success?: boolean; roll?: number; target?: number; sl?: number } | null | undefined) => {
  const f = forcedBinarySuccess(r);
  return f ? { result: f } : null;
};

/** Slots de la phase « Fuir » après un commit : le Test de Calme n'est dû QUE si le coup dans le dos
 *  a fait perdre des PB (LDB 15 l.66) — une fois le coup résolu sans Blessure, son slot est retiré
 *  (plus de rangée morte dans la modale, plus rien à lancer avant « Appliquer »). */
const prunedFleeSlots = (slots: FleeSlot[]): FleeSlot[] => {
  const bs = slots.find((s): s is FleeBackstabSlot => s.kind === 'backstab');
  if (!bs?.result) return slots; // coup pas encore résolu : on ne présume rien
  return bs.result.hit && (bs.result.woundsLost ?? 0) > 0 ? slots : slots.filter((s) => s.kind !== 'calme');
};

/** Chance « +1 DR » d'un slot dont le jet vit sous `result` (`{ …, sl }`, jamais opposé) : `bumpSL` du seul
 *  DR, `success`/`roll` INTACTS (LDB 17 l.24 ; succès du Test : LDB 12 l.11).
 *  `null` = pas encore lancé (rien à améliorer). Partagé par les flux `result` NON opposés (Test d'équipage /
 *  Test Étendu / cascade simple) dont le `bonus.derive` répétait `{ result: { ...r.result, sl: r.result.sl + 1 } }`. */
const bumpResultSL = <R extends { sl: number }>(slot: { result?: R | null }): { result: R } | null =>
  slot.result ? { result: { ...slot.result, sl: slot.result.sl + 1 } } : null;

/** Lentille PARTAGÉE des Tests PLATS (le jet vit au niveau du pending : `roll`/`target`/`sl`/`success`) —
 *  `actorTR` reconstruit le TestResult, `applyRoll` re-projette roll/sl/success (identiques d'un flux à
 *  l'autre) ; seul `dieTarget` (cible du dé forcé ; `null` = déjà réussi → rien à forcer) varie. Soin/
 *  Chirurgie/Rechargement/Évaluation. Chance « +1 DR » par `bumpSL` (success intact), Résilience LDB 17 l.68. */
const flatRollLens = <P extends import('./rollFlowFactory').PendingBase & { roll: number | null; target: number; sl: number; success: boolean }>(
  dieTarget: (p: P) => number | null,
): RollFlowLens<P> => ({
  actorTR: (p) => p.roll != null ? hydrateTR({ roll: p.roll, target: p.target, success: p.success, sl: p.sl }) : null,
  applyRoll: (_s, _slot, _actor, _get, tr) => ({ roll: tr.roll, sl: tr.sl, success: tr.success } as Partial<P>),
  dieTarget,
});

/** Lentille PARTAGÉE des Tests dont le jet vit sous `p.result` (`{ roll, target, sl, success }`) — même
 *  `actorTR`/`applyRoll` que `flatRollLens` mais imbriqués sous `result` ; seul `dieTarget` varie (Chanson/Dissipation). */
const resultRollLens = <P extends import('./rollFlowFactory').PendingBase & { result: { roll: number; target: number; sl: number; success: boolean } | null | undefined }>(
  dieTarget: (p: P, actor: Combatant) => number | null,
): RollFlowLens<P> => ({
  actorTR: (p) => p.result ? hydrateTR(p.result) : null,
  applyRoll: (_s, _slot, _actor, _get, tr) => ({ result: { roll: tr.roll, target: tr.target, success: tr.success, sl: tr.sl } } as Partial<P>),
  dieTarget,
});

/** Fabrique PARTAGÉE des Tests opposés BINAIRES (issue success/tie/fail) où SEUL le jet de l'ACTEUR se
 *  (re)joue tandis que le foe reste FIGÉ — le jet de l'acteur est l'« attaquant » du Test opposé
 *  (`resolveOpposed`/`disengageOutcome`). Désengagement (Esquive), Au Contact (Corps à corps), Empoignade
 *  (Force), Distraire (Athlétisme) : ces flux ne différaient QUE par le champ du jet acteur, la fonction
 *  de jet et le champ du foe figé (les commentaires les appelaient « CALQUE EXACT »). Chance « +1 DR »
 *  re-oppose (lentille `bumpSL`) ; Résilience « Je ne faillirai pas ! » = l'emporter (issue 'success'). */
function opposedBinaryFlow<P extends import('./rollFlowFactory').PendingBase & { result?: unknown }>(cfg: {
  key: keyof GameState & string;
  actorId: (p: P) => string;
  rollActor: (actor: Combatant) => TestResult;
  /** Jet de l'ACTEUR : lecture (`p.def` — Désengagement/Au Contact/Empoignade ; `p.atk` — Distraire) et pose. */
  actorTR: (p: P) => TestResult | null | undefined;
  putActorTR: (tr: TestResult) => Partial<P>;
  /** Jet FIGÉ du foe (`p.atk` ; `p.defRoll` pour Distraire). */
  foeTR: (p: P) => TestResult | null | undefined;
  /** Le jet a-t-il été lancé ? Défaut : le jet de l'acteur est posé. */
  rolled?: (p: P) => boolean;
}): RollFlowHandlers {
  const opposedPatch = (p: P, tr: TestResult): Partial<P> => {
    const foe = cfg.foeTR(p)!; // présent sur tous les chemins (resolve garde `foeTR != null` ; applyRoll = post-jet)
    return { ...cfg.putActorTR(tr), result: disengageOutcome(resolveOpposed(tr, foe).winner) } as Partial<P>;
  };
  return makeRollFlow<P>({
    key: cfg.key,
    rolled: cfg.rolled ?? ((p) => cfg.actorTR(p) != null),
    actor: (s, p) => actorIn(s, cfg.actorId(p)),
    caps: { forced: true },
    resolve: (_s, p, actor) => (actor && cfg.foeTR(p) != null ? opposedPatch(p, cfg.rollActor(actor)) : null),
    outcome: (p) => testOutcome(cfg.actorTR(p)),
    lens: {
      actorTR: (p) => cfg.actorTR(p) ?? null,
      applyRoll: (_s, slot, _actor, _get, tr) => opposedPatch(slot, tr),
      // LDB 17 l.68 : « S'il s'agit d'un Test opposé, vous l'emportez avec au moins DR +1 ». Le dé CHOISI
      // au titre de la Résilience passe par le socle : sans ce plancher, la ré-opposition contre le jet
      // FIGÉ de l'adversaire DÉTRUIRAIT la réussite déjà payée par le point.
      // `cancelled:false` STRUCTUREL : le foe est figé, aucun verbe ne lui ouvre de forçage (#1000).
      floorSL: (p) => opposedForcedFloor(cfg.foeTR(p)?.sl ?? 0, false),
      forceWin: (slot, _actor, tr) => (slot.result && tr ? ({ result: 'success' as const } as Partial<P>) : null),
    },
  });
}

/**
 * Cœur PARTAGÉ du jet d'un Test SIMPLE (jet vs cible unique, LDB 12) : `rollTest(valeur, Difficulté, rng)`
 * → le TestResult à 4 champs `{roll,target,sl,success}` (ou `null` sans acteur). `value` lit le pending +
 * l'acteur ; `difficulty` fixe ou fonction du pending (défaut Intermédiaire, +0) ; `rng` = le générateur
 * COURANT du flux (combat → `battleRng` ; hors-combat → `defaultRNG`) — PARAMÉTRÉ, pas imposé, pour que
 * chaque flux garde SON jet byte-identique (le rng d'un Test est CONTEXTUEL, on ne le normalise pas). Les
 * 3 poses ci-dessous (FLAT / `result` / `calme` du slot de `flee`) ne diffèrent QUE par l'ENDROIT où elles
 * rangent ce résultat : un Test DÉCLARE sa valeur, sa Difficulté et son rng — il n'a PAS à re-coder sa
 * résolution. Cf. `opposedBinaryFlow` pour les Tests OPPOSÉS.
 *
 * `actorless` : le Test roule sur une valeur BAKÉE (`p.skillValue` fixé à l'ouverture) → il n'a PAS besoin
 * d'un acteur LIVE, car le lanceur peut être HORS du champ d'`actorIn` (Soin/Chirurgie par un Médecin PNJ
 * de scène : `healerId` absent des combattants). Sans le drapeau, un acteur absent ANNULE le jet (défaut
 * conservateur des Tests dont la VALEUR vient de l'acteur : Calme/FM/`testValue`). L'INFLUENCE
 * (Chance/Résilience) reste gérée à part par la fabrique via `spec.actor` (no-op si l'acteur est un PNJ).
 */
function simpleRoll<P extends PendingBase>(
  p: P, actor: Combatant | undefined,
  value: (p: P, actor: Combatant) => number,
  difficulty: Difficulty | ((p: P) => Difficulty),
  rng: () => RNG,
  opts?: { actorless?: boolean },
): { roll: number; target: number; sl: number; success: boolean } | null {
  if (!actor && !opts?.actorless) return null; // Test à valeur d'acteur : pas d'acteur live → pas de jet
  const t = rollTest(value(p, actor as Combatant), typeof difficulty === 'function' ? difficulty(p) : difficulty, rng());
  return { roll: t.roll, target: t.target, sl: t.sl, success: t.success };
}

/** Chemin NORMAL d'un Test simple, jet APLATI au niveau du pending. Un flux à branche `forced`/`bonus`
 *  garde ces branches et ne délègue QUE son chemin normal. Cast large : les pendings portent ces champs
 *  sous des formes hétérogènes (certains `target`/`sl` optionnels — PendingCorruption) → un `P` étroit les
 *  exclurait ; la contrainte de forme est portée par le flux. */
const simpleTestResolve = <P extends PendingBase>(
  value: (p: P, actor: Combatant) => number,
  difficulty: Difficulty | ((p: P) => Difficulty) = 'intermediaire',
  rng: () => RNG = battleRng,
  opts?: { actorless?: boolean },
) => (_s: GameState, p: P, actor: Combatant | undefined): Partial<P> | null =>
  simpleRoll(p, actor, value, difficulty, rng, opts) as unknown as Partial<P> | null;

/** Idem mais le jet vit sous `result` (même distinction FLAT vs `result` que `flatRollLens`/`resultRollLens`).
 *  Pas d'`actorless` : les flux `result` migrés (dispel/shanty/approach/ward) ont TOUS un acteur LIVE. */
const simpleTestResultResolve = <P extends PendingBase>(
  value: (p: P, actor: Combatant) => number,
  difficulty: Difficulty | ((p: P) => Difficulty) = 'intermediaire',
  rng: () => RNG = battleRng,
) => (_s: GameState, p: P, actor: Combatant | undefined): Partial<P> | null => {
  const r = simpleRoll(p, actor, value, difficulty, rng);
  return r ? ({ result: r } as unknown as Partial<P>) : null;
};

/**
 * ADAPTATEURS DE FORME de l'ACCESSEUR DE DÉ (`RollFlowSpec.die`) — un flux déclare SA forme, jamais une
 * résolution : l'évaluation d'un dé saisi vit dans `makeRollFlow`. Trois formes couvrent le catalogue,
 * les mêmes que celles des lentilles : jet sous `result`, jet APLATI sur le pending, jet d'un
 * PARTICIPANT. Un flux à `lens` n'a rien à déclarer (le socle dérive l'accesseur de `actorTR`/`applyRoll`).
 */
type Die4 = { roll: number; target?: number; sl?: number; success: boolean };
const die4 = (tr: TestResult): Die4 => ({ roll: tr.roll, target: tr.target, sl: tr.sl, success: tr.success });
const pick4 = (d: { roll: number; target?: number } | null | undefined): ForcedPick | null =>
  (d && d.target != null ? { roll: d.roll, target: d.target, critable: false } : null);

/** Jet rangé sous `result` (4 champs). */
const resultDie = <P extends PendingBase & { result?: Die4 | null }>() => ({
  read: (p: P) => pick4(p.result),
  write: (_s: GameState, _p: P, _a: Combatant | undefined, _g: Get, tr: TestResult) => ({ result: die4(tr) } as Partial<P>),
});

/** Le `TestResult` ENTIER vit sous `roll` (Récupération d'État, Marchandage). La valeur NUE du jet
 *  voyage avec le dé (`ForcedPick.base`) : un dé CHOISI ou FIXÉ la reconduit au lieu de la perdre
 *  (départage d'un Test opposé, LDB 12 l.160). */
const trDie = <P extends PendingBase & { roll?: TestResult | null }>() => ({
  read: (p: P) => (p.roll ? { roll: p.roll.roll, target: p.roll.target, base: p.roll.base, critable: false } : null),
  write: (_s: GameState, _p: P, _a: Combatant | undefined, _g: Get, tr: TestResult) => ({ roll: tr } as Partial<P>),
});

/** Jet d'un PARTICIPANT rangé sous `result` à 3 champs ({roll,target,sl}) — le socle re-dérive le DR. */
const roll3Die = <Slot extends PendingBase & { result?: { roll: number; target: number; sl: number } | null }, P extends PendingBase>() => ({
  read: (r: Slot) => (r.result ? { roll: r.result.roll, target: r.result.target, critable: false } : null),
  write: (_s: GameState, _r: Slot, _a: Combatant | undefined, _g: Get, tr: TestResult) =>
    ({ result: { roll: tr.roll, target: tr.target, sl: tr.sl } } as unknown as Partial<Slot>),
} as NonNullable<RollFlowSpec<P, Slot>['die']>);

/** Jet APLATI au niveau du pending (4 champs). */
const flatDie = <P extends PendingBase & { roll?: number | null; target?: number }>() => ({
  read: (p: P) => (p.roll != null ? pick4({ roll: p.roll, target: p.target }) : null),
  write: (_s: GameState, _p: P, _a: Combatant | undefined, _g: Get, tr: TestResult) => (die4(tr) as unknown as Partial<P>),
});

/** Le DR d'un Test de compétence franchit-il le seuil EXIGÉ (`PendingTest.requireSL`, authoré) ?
 *  Le DR mesure l'efficacité, il ne décide pas de l'issue (LDB 12 l.92-94/l.104-112 : un succès peut
 *  porter DR 0, un échec DR −1) — sans seuil authoré (0), un DR négatif ne défait pas le d100 réussi.
 *  SOURCE UNIQUE du gate de DR du flux `test` : résolution, Chance, inversion ET acquittement
 *  (`store.resolveTest`, ajustement d'outil Pratique/Peu Fiable). */
export const meetsRequiredSL = (requireSL: number, sl: number): boolean => (requireSL > 0 ? sl >= requireSL : true);

export const FLOWS = {
  /**
   * Attaque (modale différée). Le JET INITIAL reste métier (`attackRoll` : +1 Avantage si cible
   * Sonnée, annulation hors portée/LdV, victime de déviation dans la mêlée) — comme `attackConfirm`.
   * Le cycle Chance/Pacte/Résilience/dé choisi vit ICI, identique à tous les flux.
   */
  attack: makeRollFlow<PendingAttack>({
    key: 'pendingAttack',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.attackerId),
    // Résolveur UNIQUE (`caps.forced`) : jet normal (relance Chance/Pacte = re-résolution complète,
    // mêmes environnement et options de tir) OU Résilience (LDB 17 l.68) selon `forced`.
    // Dé choisi (`picker`) : le d100 de l'attaquant — son inverse donne la localisation (LDB 13 l.142).
    caps: {
      forced: true,
    },
    // ACCESSEUR DE DÉ : le d100 de l'attaquant (son inverse donne la localisation, LDB 13 l.142).
    die: {
      read: (p) => (p.result?.attackerDetail ? { roll: p.result.attackerRoll, target: p.result.attackerDetail.target, base: p.result.attackerDetail.base } : null),
      write: (s, p, actor, _g, tr) => {
        const t = actorIn(s, p.targetId);
        return actor && t ? { result: rederiveAttack(actor, t, p, tr, s.battle?.combatants) } : null;
      },
      // Test opposé : « vous l'emportez avec au moins DR +1 » (LDB 17 l.68) — cf. INVARIANT de `resolve`.
      floorSL: (p) => opposedForcedFloor(p.result?.defenderDetail?.sl ?? 0, false),
    },
    resolve: (s, p, actor, get, forced) => {
      const target = actorIn(s, p.targetId);
      if (!actor || !target) return null;
      if (forced) {
        const ad = p.result?.attackerDetail;
        if (!ad) return null; // rien à forcer sans jet d'attaque
        // INVARIANT (#1000) : ce forçage-ci porte TOUJOURS sa garantie, car un `pendingAttack` ne vit
        // jamais face à une défense déjà forcée — `defenseConfirm` repose le pending puis appelle
        // `attackConfirm` dans le MÊME tour de boucle, qui le nulle avant tout retour (combatSlice.ts).
        // Un chemin qui rouvrirait l'attaque après la fenêtre devra composer `opposedForcingCancelled`.
        const defSL = p.result!.defenderDetail?.sl ?? 0;
        // Dé PAR DÉFAUT : « vous choisissez le résultat » (LDB 17 l.68) = LE MEILLEUR (`bestForcedRoll`,
        // policy-aware), jamais le dé raté courant. Test opposé : « vous l'emportez avec au moins DR +1 ».
        const aDie = bestForcedRoll(ad.target);
        const atk2 = forcedTR(aDie, ad.target, Math.max(evaluateTest(aDie, ad.target).sl, opposedForcedFloor(defSL, false)), ad.base);
        return { result: rederiveAttack(actor, target, p, atk2, s.battle?.combatants) };
      }
      const r = resolveAttack(get, actor, target, p.location ?? undefined, p.fromCharge, p.intoCrowd, p.heldGround, p.weaponUid, p.withhold);
      // MÊME gel que `attackRoll` : l'OBJET arme réellement tiré (jamais l'uid, qui porte le choix du
      // joueur et discrimine l'attaque naturelle) — sans lui, toute re-dérivation re-passe par
      // `pickAttackWeaponList`, qui reprend la MÊLÉE dès qu'elle est à portée (`mount.ts`).
      return r ? { result: r.res, victimId: r.victim?.id, weapon: r.weapon } : null;
    },
    // Issue CANONIQUE : l'attaquant l'emporte (`attackerDetail.success`). La 2ᵉ frappe du Maniement de
    // deux armes est un jet IMPOSÉ (d100 inversé) — ni relance ni Pacte : `won:true` verrouille son gating.
    outcome: (p) => sealOutcome(!!p.dualSecond || !!p.result?.attackerDetail?.success, p.result?.attackerDetail?.sl ?? 0, p.result?.attackerDetail?.roll ?? 0, p.result?.attackerDetail?.target ?? 0, p.result?.attackerDetail),
    bonus: {
      guard: (p) => !!p.result?.attackerDetail,
      derive: (s, p, actor) => {
        const target = actorIn(s, p.targetId);
        if (!target) return null;
        const ad = p.result!.attackerDetail!;
        const atk2 = bumpSL(hydrateTR(ad));
        return { result: rederiveAttack(actor, target, p, atk2, s.battle?.combatants) };
      },
    },
    // Inversion de Test (LDB 23 l.209 « Entraînement au Combat » : Corps à corps/Projectiles — CHOIX
    // du joueur, #558). La 2ᵉ frappe du Maniement de deux armes est un jet IMPOSÉ (l.638, comme
    // ci-dessus « ni relance ni Pacte ») : `dualSecond` exclut aussi l'inversion.
    reverse: {
      skillOf: (s, p, actor) => {
        if (p.dualSecond) return null;
        const target = actorIn(s, p.targetId); if (!target) return null;
        // Le Talent d'Inversion porte sur la COMPETENCE reellement lancee (LDB 23 l.209) : l'arme
        // FIGEE au jet fait foi, jamais un re-choix qui pourrait basculer melee/distance.
        const weapon = p.weapon ?? firedWeapon(actor, target, p.weaponUid, s.battle?.combatants, p.harpoonRopeCut);
        return { skill: weapon.type === 'ranged' ? 'projectiles' : 'corps-a-corps' };
      },
      current: (p) => (p.result?.attackerDetail ? { roll: p.result.attackerDetail.roll, target: p.result.attackerDetail.target } : null),
      applyRoll: (s, p, actor, _get, tr) => {
        const target = actorIn(s, p.targetId); if (!target) return null;
        const ad = p.result!.attackerDetail!;
        // `tr.success` = issue RÉELLE du dé renversé (le jeton, libre, peut ne PAS convertir un échec
        // — ni forcer un succès, `forcedTR`) ; seule la voie Talent (gate stricte échec→succès dans
        // `applyReverse`) garantit `tr.success:true` par construction.
        const atk2 = hydrateTR({ roll: tr.roll, target: ad.target, base: ad.base, success: tr.success, sl: tr.sl });
        return { result: rederiveAttack(actor, target, p, atk2, s.battle?.combatants) };
      },
    },
    // « Annuler » : défaire la charge misclic AVANT le jet
    // (positions/orientation/Mouvement/Avantage +1 rendu/chargedThisTurn), no-op sur une 2ᵉ frappe
    // imposée, fin de balayage pour un cleave, sinon fermeture (+ cascade combat étape 0).
    onCancel: (get, set) => {
      const pa = get().pendingAttack;
      if (pa?.dualSecond) return; // 2ᵉ frappe d'un dual : engagée dès que la cible est choisie (le jet est imposé)
      // Charge : Annuler AVANT tout jet (`result===null`) DÉFAIT le misclic — comme annuler un déplacement,
      // mais pour la manœuvre combinée « déplacement + attaque ». On restaure positions, orientation, Mouvement,
      // Avantage (+1 de charge rendu) et `chargedThisTurn`. Une fois le dé lancé, la charge est ENGAGÉE (RAW LDB 15).
      if (pa?.fromCharge) {
        const battle = get().battle;
        if (pa.result || !pa.chargeUndo || !battle) { if (!pa.result) set({ pendingAttack: null }); return; } // dé lancé → engagé (pas d'undo)
        const u = pa.chargeUndo;
        for (const c of battle.combatants) { const p = u.pos[c.id]; if (p) c.pos = { ...p }; } // restaure TOUS (un grand a pu en déplacer d'autres)
        const attacker = inBattleId(battle, pa.attackerId);
        if (attacker) { attacker.gainedAdvThisRound = u.gainedAdvBefore; attacker.chargedThisTurn = u.chargedBefore; if (u.advGained) campSpend(get, attacker, u.advGained); } // rend le +1 Avantage de la charge
        clearApproachMoves(attacker); // la charge est DÉFAITE (position d'avant restaurée) : aucune approche due (LDB 21 l.27)
        set({ facing: { ...u.facing }, battle: { ...battle, movementUsed: u.movementUsed, movedPreAction: u.movedPreAction, action: null, reachable: new Map(), preview: null }, pendingAttack: null });
        bus.emit(EVT.SCENE_DIRTY);
        return;
      }
      if (pa?.cleave) { set({ pendingAttack: null }); return get().cleaveEnd(); } // annuler = terminer le balayage (cleaveEnd clôt la cascade)
      // Annuler ferme aussi la séquence-jet de combat (étape 0 non encore validée).
      const seq = get().pendingCascade;
      const closeSeq = seq?.purpose === 'combat' && seq.participants[seq.cursor]?.jet === 'attack';
      set({ pendingAttack: null, ...(closeSeq ? { pendingCascade: null } : {}) });
    },
  }),

  /**
   * Défense réactive (héros attaqué par l'IA) : le jet d'attaque (`p.atk`) reste FIGÉ ; seul le jet
   * du défenseur se (re)joue. `defenseConfirm` (reprise du tour IA) reste au store. PAS de « Subir » :
   * le RAW n'offre aucune non-défense volontaire (mêlée = Test opposé, LDB 13 l.123) — la résolution
   * non opposée est réservée aux cas IMPOSÉS (Surpris/Inconscient/Fuir/inanimé), traités hors de ce flux.
   */
  defense: makeRollFlow<PendingDefense>({
    key: 'pendingDefense',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.defenderId),
    // Résolveur UNIQUE (`caps.forced`) : seul le jet du défenseur se (re)joue (`p.atk` figé).
    caps: {
      forced: true,
    },
    die: {
      read: (p) => (p.def ? { roll: p.def.roll, target: p.def.target, base: p.def.base } : null),
      write: (s, p, actor, _g, tr) => {
        const att = actorIn(s, p.attackerId);
        return att && actor ? { def: tr, result: finishDefenseResult(att, actor, p, tr, 0, undefined, sceneMetresPerTile(s.scene)) } : null;
      },
      // Test opposé : le défenseur forcé l'emporte avec au moins DR +1 (LDB 17 l.68) — sauf annulation
      // mutuelle (#1000 : `opposedForcingCancelled`), le dé CHOISI restant posé.
      floorSL: (p) => opposedForcedFloor(p.atk.sl, opposedForcingCancelled(p)),
    },
    resolve: (s, p, actor, _get, forced) => {
      const attacker = actorIn(s, p.attackerId);
      if (!attacker || !actor) return null;
      const mpt = sceneMetresPerTile(s.scene);
      if (forced) {
        const dd = p.result?.defenderDetail;
        if (!dd || !p.def) return null; // rien à forcer sans jet de défense
        // Second forçage du MÊME Test opposé (#1000) : ACCEPTÉ — le Point se dépense, le dé se pose, et
        // les DEUX garanties s'éteignent (`opposedForcingCancelled`, lue aussi par `forcedOpposedAtk` via
        // le `forced` que la fabrique posera juste après ce patch — transmis ici en avance).
        const cancelled = opposedForcingCancelled(p, true);
        const pForced: PendingDefense = { ...p, forced: true };
        // Dé PAR DÉFAUT : « vous choisissez le résultat » (LDB 17 l.68) = LE MEILLEUR (`bestForcedRoll`,
        // policy-aware), jamais le dé raté courant. Le plancher est celui de `opposedForcedFloor` : la
        // garantie (LDB 17 l.68) si elle vit encore, RIEN si elle est annulée (#1000).
        const dDie = bestForcedRoll(p.def.target);
        const def2 = forcedTR(dDie, p.def.target, Math.max(evaluateTest(dDie, p.def.target).sl, opposedForcedFloor(p.atk.sl, cancelled)), p.def.base);
        return { def: def2, result: finishDefenseResult(attacker, actor, pForced, def2, 0, undefined, mpt) };
      }
      // Neige −30 (LDB 14 l.82) + cavalier −20 (l.184) ; Rapide : −10 à la parade d'une arme non-Rapide (LDB 62 l.298-302).
      const dodgeMod = (s.scene ? sceneCombatModifiers(s.scene, s.gameTime).dodgeMod : 0) + mountedDodgePenalty(actor);
      const parry = p.parryWeaponUid ? actor.weapons.find((w) => w.uid === p.parryWeaponUid) : undefined;
      const def = rollMeleeDefender(actor, p.mode, battleRng(), dodgeMod, parry, p.weapon, defenseSubOf(actor, p));
      return { def, result: finishDefenseResult(attacker, actor, p, def, dodgeMod, parry, mpt) };
    },
    outcome: (p) => testOutcome(p.def),
    bonus: {
      guard: (p) => !!p.result?.defenderDetail,
      derive: (s, p, actor) => {
        const attacker = actorIn(s, p.attackerId);
        if (!attacker) return null;
        const dd = p.result!.defenderDetail!;
        const def2 = bumpSL(hydrateTR(dd));
        const parry = p.parryWeaponUid ? actor.weapons.find((w) => w.uid === p.parryWeaponUid) : undefined;
        return { def: def2, result: finishDefenseResult(attacker, actor, p, def2, 0, parry, sceneMetresPerTile(s.scene)) };
      },
    },
    // Inversion de Test (LDB 23 l.209 « Entraînement au Combat » : Corps à corps/Projectiles — CHOIX
    // du joueur, #558). Parade → Corps à corps ; Esquive → Esquive (compétence propre, hors périmètre
    // « Corps à corps/Projectiles » de l'Activité mais couverte par un jeton « tout Test », l.218) ;
    // substitution sociale (`mode:'social'`) exclue de tout skill spécifique — seul un jeton générique
    // (sans `skill`) peut s'y appliquer.
    reverse: {
      skillOf: (_s, p) => ({ skill: p.mode === 'parade' ? 'corps-a-corps' : p.mode === 'esquive' ? 'esquive' : undefined }),
      current: (p) => (p.def ? { roll: p.def.roll, target: p.def.target } : null),
      applyRoll: (s, p, actor, _get, tr) => {
        const attacker = actorIn(s, p.attackerId); if (!attacker) return null;
        // `tr.success` = issue RÉELLE du dé renversé (voir attack.reverse.applyRoll — jamais forcé).
        const def2 = hydrateTR({ roll: tr.roll, target: p.def!.target, base: p.def!.base, success: tr.success, sl: tr.sl });
        const parry = p.parryWeaponUid ? actor.weapons.find((w) => w.uid === p.parryWeaponUid) : undefined;
        return { def: def2, result: finishDefenseResult(attacker, actor, p, def2, 0, parry, sceneMetresPerTile(s.scene)) };
      },
    },
  }),

  /**
   * Incantation / Prière. Le JET INITIAL reste métier (`castRoll` : wards journalisés,
   * Surincantation automatique de l'IA, déclaration de Contre-sort ennemi) — le cycle
   * Chance/Pacte/Résilience/dé choisi vit ici.
   */
  cast: makeRollFlow<PendingCast>({
    key: 'pendingCast',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.casterId),
    // Résolveur UNIQUE (`caps.forced`) : jet normal (Relance Chance/Pacte) OU Résilience
    // (LDB 17 l.68) selon `forced` — plus de dérives `force`/`forceRoll` séparées. La localisation d'un
    // Projectile suit le dé inversé (LDB 46 l.156) : choisir le dé le re-dérive (socle + accesseur).
    // Picker : 11 → Incantation Critique seulement pour un sort (les Prières n'ont pas de Critique).
    caps: {
      forced: true,
    },
    // ACCESSEUR DE DÉ : le d100 d'incantation ; `critable` faux pour une Prière (aucun Critique).
    die: {
      read: (p) => {
        if (!p.result || p.result.target <= 0) return null;
        const spell = effectiveSpellOf(p);
        return { roll: p.result.roll, target: p.result.target, critable: !(spell && castInfoIsPrayer(spell)) };
      },
      write: (s, p, actor, _g, tr) => {
        const t = actorIn(s, p.targetId); const spell = effectiveSpellOf(p);
        if (!actor || !t || !spell || !p.result) return null;
        const sl = tr.sl + castTestDRMods(actor, 'incantation', { success: tr.success, spell, sea: seaMagicContext(s) });
        return { result: rederiveCastSL(actor, t, spell, { ...p.result, roll: tr.roll, sl }, p.missile, p.focused, 0) };
      },
      // Voie RÉSILIENCE : le point acheté fait PARTIR le sort (DR ≥ NI, LDB 17 l.75), et la Malepierre
      // (LDB 46 l.173, INCONDITIONNELLE) se re-calcule sur CE DR — celle figée au jet d'origine est périmée.
      resilience: (s, p, actor, _g, tr) => {
        const t = actorIn(s, p.targetId); const spell = effectiveSpellOf(p);
        if (!actor || !t || !spell || !p.result) return null;
        const ni = p.focused ? 0 : spell.cn ?? 0;
        const sl0 = tr.sl + castTestDRMods(actor, 'incantation', { success: tr.success, spell, sea: seaMagicContext(s) });
        const malepierreConsumed = malepierreDR(Math.max(0, sl0), malepierreReserveOf(actor));
        const sl = sl0 + malepierreConsumed;
        return { result: rederiveCastSL(actor, t, spell, { ...p.result, roll: tr.roll, sl, malepierreConsumed }, p.missile, p.focused, Math.max(0, ni - sl)) };
      },
    },
    resolve: (s, p, actor, _get, forced) => {
      const target = actorIn(s, p.targetId);
      const spell = effectiveSpellOf(p); // NI ×2 si lecture au grimoire (LDB 47 l.21)
      if (!actor || !target || !spell) return null;
      if (forced) {
        // — Résilience « Je ne faillirai pas ! » (LDB 17 l.68) —
        const ni = p.focused ? 0 : spell.cn ?? 0;
        // FENÊTRE PRÉ-JET : sans jet posé, la cible du dé choisi est celle que le jet naturel aurait
        // employée — `castTestTarget` (miroir de `resolveCasting`) avec le MÊME ward et la MÊME
        // Difficulté que la branche de jet normal ci-dessous. Jet posé : sa cible fait foi.
        const discreet = !!p.discreet && castInfoIsPrayer(spell) && !!rule('prayer-conviction');
        const tgt = p.result?.target ?? castTestTarget(
          actor, spell,
          p.missile ? 'intermediaire' : discreetPrayerDifficulty('intermediaire', discreet),
          castContextMods(s, actor, target, spell).total + windsMagicModOf(s.battle),
        );
        if (tgt <= 0) return null; // Compétence d'incantation non maîtrisée : rien à forcer
        // Dé PAR DÉFAUT = LE MEILLEUR (LDB 17 l.68 « vous choisissez le résultat »), jamais le dé raté
        // courant — plancher conservé : le sort PART (DR ≥ NI).
        const cDie = bestForcedRoll(tgt);
        const cTR = evaluateTest(cDie, tgt);
        const cSL = cTR.sl + castTestDRMods(actor, 'incantation', { success: cTR.success, spell, sea: seaMagicContext(s) });
        // Le jet posé (s'il existe) reste la base du re-dérivé — malepierre déjà consommée comprise.
        const cur = p.result ?? { cast: false, roll: cDie, target: tgt, sl: cSL, isCritical: false, isFumble: false, log: '' };
        // `Math.max(0, …)` : le DR du MEILLEUR dé suffit — un +1 fantôme au-dessus du maximum
        // nourrirait la Surincantation (LDB 47) sans rien dans la source pour le justifier.
        return { result: rederiveCastSL(actor, target, spell, { ...cur, roll: cDie, target: tgt, sl: cSL }, p.missile, p.focused, Math.max(0, ni - cSL)) };
      }
      // — Jet NORMAL (relance Chance/Pacte) : re-jet complet — wards recalculés (Sorcière LDB 42 + Aqshy LDB 48). —
      // Ward = pénalité « Sorcière » (LDB 42) + bonus conditionnel de Domaine (Aqshy près des flammes,
      // LDB 48) + bonus d'ENVIRONNEMENT (Vie/Ghyran +10 en zone rurale/sauvage, LDB 48 l.690).
      const ward = castContextMods(s, actor, target, spell).total + windsMagicModOf(s.battle);
      // « Prêchez, ma sœur ! » (LDB 40 l.40-42, option `prayer-conviction`) : une Prière murmurée
      // subit une Difficulté d'un cran plus dure. Ne concerne QUE les Prières (`castInfoIsPrayer`).
      const discreet = !!p.discreet && castInfoIsPrayer(spell) && !!rule('prayer-conviction');
      const difficulty = discreetPrayerDifficulty('intermediaire', discreet);
      const res = p.missile
        ? resolveMagicMissile(actor, target, spell, battleRng(), p.focused, ward, seaMagicContext(s))
        : resolveCasting(actor, spell, battleRng(), difficulty, p.focused, ward, seaMagicContext(s));
      return { result: res };
    },
    // Issue CANONIQUE = d100 propre réussi (roll ≤ cible) — relance/Pacte alignés sur le jet propre.
    outcome: (p) => cleanRollOutcome(p.result),
    bonus: {
      // Chance « +1 DR » : peut franchir le NI, cumulable.
      derive: (s, p, actor) => {
        const target = actorIn(s, p.targetId);
        const spell = effectiveSpellOf(p);
        if (!target || !spell) return null;
        return { result: rederiveCastSL(actor, target, spell, p.result!, p.missile, p.focused, 1) };
      },
    },
  }),

  /**
   * Contre-sort (Dissipation, LDB 46 l.156) — flux MULTI : le jet d'incantation est figé (`p.cast`) ;
   * les contre-lanceurs éligibles ont chacun leur rangée, avec son PROPRE cycle Chance/+1 DR/Pacte/
   * Résilience. PLUSIEURS peuvent tenter contre la même incantation (#1040, cf. `counterspellConfirm`
   * dans `src/state/combatSlice.ts`) : `counterspellEngage` consomme l'essai du Round de chaque
   * chanteur au moment de SON jet, et `counterspellConfirm` (store) agrège les issues.
   */
  counterspell: makeRollFlow<PendingCounterspell, CounterParticipant>({
    key: 'pendingCounterspell',
    // PARALLÈLE : chaque participant est un contre-lanceur (slot indépendant).
    multi: { slots: (p) => p.participants, idOf: (part) => part.id, replace: (p, parts) => ({ ...p, participants: parts }) },
    rolled: (part) => !!part.result,
    actor: (s, part) => actorIn(s, part.id),
    // Le jet d'incantation ENNEMI vit dans `pendingCast` (figé) ; le participant oppose son Langue
    // (Magick). Jet NORMAL (RNG) ou Résilience (`forced`).
    resolve: (s, part, actor, _get, forced) => {
      const pcCast = s.pendingCast?.result;
      if (!actor || !pcCast) return null;
      if (!counterspellEngage(s, part, actor)) return null;
      const castT = castTestOf(pcCast);
      // Test SOUTENU du groupe uni (`LDB 12 l.189`) : le meneur lance, +10 par uni éligible, plafonné
      // (`counterspellSoutienFor` — 0 pour un lanceur seul, le pipeline aval est le MÊME).
      const soutien = counterspellSoutienFor(s, s.pendingCounterspell, part.id);
      if (forced) {
        // Résilience « Je ne faillirai pas ! » : le Contre-sort l'emporte (dissipe). Rien à forcer si déjà dissipé.
        const cur = part.result;
        if (cur?.dispelled) return null;
        const value = castingValue(actor, 'langue', 'magick') + soutien;
        const roll = cur ? cur.counter.roll : 1; // 01 = jet propre garanti (LDB 17 l.68)
        // Le dé passé par la MÊME source de modificateurs que les deux autres voies (`castTestDRMods`),
        // puis planché : Test opposé → l'emporter d'au moins DR +1, minimum 1 (LDB 17 l.68).
        const nat = withCastTestDRMods(actor, 'dissipation', evaluateTest(roll, value));
        const sl = Math.max(nat.sl, cur?.counter.sl ?? 1, castT.sl + 1, 1);
        // `base` non fourni : la valeur NUE du chanteur est RELUE par `counterspellOutcomeFrom` — `value`
        // porte le Soutien du groupe uni (LDB 12 l.189), qui n'est pas un Niveau de Compétence.
        const counterT = forcedTR(roll, value, sl);
        return { result: counterspellOutcomeFrom(actor, counterT, castT) };
      }
      return { result: resolveCounterspell(actor, castT, battleRng(), {}, soutien) };
    },
    // Issue CANONIQUE : le Contre-sort du contre-lanceur RÉUSSIT (son jet propre passe) → sinon Chance (LDB 12).
    outcome: (part) => testOutcome(part.result?.counter),
    caps: { forced: true },
    // ACCESSEUR DE DÉ : le dé du Contre-sort vit dans `result.counter`. LDB 17 l.68 — « au lieu de lancer
    // les dés pour un Test, vous choisissez le résultat » ; Test opposé → « vous l'emportez avec au moins
    // DR +1 » (`resilience`). Un dé FIXÉ (option de confort) s'évalue au naturel, modificateurs propres
    // du Contre-sort compris (`castTestDRMods`, la même source que le jet RNG et que la Résilience).
    die: {
      read: (part) => part.result ? { roll: part.result.counter.roll, target: part.result.counter.target, critable: false } : null,
      write: (s, part, actor, _get, tr) => {
        const pcCast = s.pendingCast?.result;
        if (!actor || !pcCast) return null;
        if (!counterspellEngage(s, part, actor)) return null;
        return { result: counterspellOutcomeFrom(actor, withCastTestDRMods(actor, 'dissipation', tr), castTestOf(pcCast)) };
      },
      resilience: (s, part, actor, _get, tr) => {
        const pcCast = s.pendingCast?.result;
        if (!actor || !pcCast) return null;
        if (!counterspellEngage(s, part, actor)) return null;
        const castT = castTestOf(pcCast);
        const adj = withCastTestDRMods(actor, 'dissipation', tr);
        const counterT = forcedTR(tr.roll, tr.target, Math.max(adj.sl, castT.sl + 1, 1));
        return { result: counterspellOutcomeFrom(actor, counterT, castT) };
      },
    },
    bonus: {
      // Chance « +1 DR » : améliore le DR du Contre-sort, peut basculer l'opposition (LDB 17 l.24).
      derive: (s, part, actor) => {
        const pcCast = s.pendingCast?.result;
        const cur = part.result;
        if (!cur || !pcCast) return null;
        const counterT = bumpSL(cur.counter);
        return { result: counterspellOutcomeFrom(actor, counterT, castTestOf(pcCast)) };
      },
    },
  }),

  /**
   * Incantation OPPOSÉE (Fauche-démon → FM, Parole de Tzeentch → Intelligence) — flux MULTI : le jet
   * d'incantation est FIGÉ (`pendingCast.result`) ; chaque CIBLE oppose son Test, avec son propre cycle
   * Chance/+1 DR/Pacte/Résilience. `oppositionConfirm` agrège (résisté + marge de DR par cible). Cible
   * IA = rangée témoin (jet auto-roulé à l'ouverture, openCastOpposition).
   */
  castOpposition: makeRollFlow<PendingCastOpposition, OppositionParticipant>({
    key: 'pendingCastOpposition',
    multi: { slots: (p) => p.participants, idOf: (part) => part.id, replace: (p, parts) => ({ ...p, participants: parts }) },
    rolled: (part) => !!part.result,
    actor: (s, part) => actorIn(s, part.id),
    resolve: (s, part, actor, _get, forced) => {
      const pcCast = s.pendingCast?.result;
      const pco = s.pendingCastOpposition;
      if (!actor || !pcCast || !pco) return null;
      const castT = castTestOf(pcCast); // l'incantation figée = l'« attaquant » de l'opposition
      const oppVal = testValue(actor, pco.skill, pco.char); // FM / Intelligence de la cible
      // Valeur NUE de la cible (`LDB 09 l.17`) : le lanceur porte déjà la sienne (`castingBaseValue` via
      // `evaluateCasting`), les DEUX camps la portent donc au départage à DR égal (`LDB 12 l.160`).
      const oppBase = skillBaseValue(actor, pco.skill, undefined, pco.char);
      if (forced?.sl != null) {
        // Résistance (Magie), LDB 10 l.1016-1020 : le Test pour résister au Sort réussit d'office —
        // la cible RÉSISTE (interprétation : « réussir le Test pour résister » = l'opposition est
        // tenue), DR imposé = Bonus d'Endurance (nourrit la marge).
        const oppose = forcedTR(1, oppVal, forced.sl, oppBase); // dé 01 → double=false
        return { result: { oppose, resisted: true, margin: Math.max(0, castT.sl - forced.sl) } };
      }
      if (forced) {
        // Résilience « Je ne faillirai pas ! » : la cible force sa réussite → résiste (l'emporte).
        const cur = part.result;
        const roll = cur ? cur.oppose.roll : 1; // 01 = jet propre garanti (LDB 17 l.68)
        const sl = Math.max(cur?.oppose.sl ?? 1, castT.sl + 1, 1);
        const oppose = forcedTR(roll, oppVal, sl, oppBase);
        return { result: { oppose, resisted: true, margin: Math.max(0, castT.sl - sl) } };
      }
      const oppose = { ...rollTest(oppVal, 'intermediaire', battleRng()), base: oppBase };
      const o = resolveOpposed(castT, oppose);
      return { result: { oppose, resisted: o.winner !== 'attacker', margin: Math.max(0, castT.sl - oppose.sl) } };
    },
    // Issue CANONIQUE : la cible RÉSISTE au sort (`resisted`) ; sinon le lanceur l'emporte → SA Chance (héros défenseur).
    outcome: (part) => sealOutcome(!!part.result?.resisted, part.result?.oppose.sl ?? 0, part.result?.oppose.roll ?? 0, part.result?.oppose.target ?? 0),
    // `resist` : « résister aux sorts » = la menace 'Magie' du talent (tag posé par openCastOpposition).
    caps: { forced: true, resist: true },
    // ACCESSEUR DE DÉ : le dé de la cible vit dans `result.oppose`. LDB 17 l.68 — « vous choisissez le
    // résultat » ; Test opposé contre l'incantation FIGÉE → « vous l'emportez avec au moins DR +1 »
    // (`resilience` : la cible résiste). Un dé FIXÉ s'évalue au naturel — l'opposition tranche.
    die: {
      read: (part) => part.result ? { roll: part.result.oppose.roll, target: part.result.oppose.target, base: part.result.oppose.base, critable: false } : null,
      write: (s, _part, _actor, _get, tr) => {
        const pcCast = s.pendingCast?.result;
        if (!pcCast) return null;
        const castT = castTestOf(pcCast);
        const o = resolveOpposed(castT, tr);
        return { result: { oppose: tr, resisted: o.winner !== 'attacker', margin: Math.max(0, castT.sl - tr.sl) } };
      },
      resilience: (s, _part, _actor, _get, tr) => {
        const pcCast = s.pendingCast?.result;
        if (!pcCast) return null;
        const castT = castTestOf(pcCast);
        const sl = Math.max(tr.sl, castT.sl + 1, 1);
        const oppose = forcedTR(tr.roll, tr.target, sl, tr.base);
        return { result: { oppose, resisted: true, margin: Math.max(0, castT.sl - sl) } };
      },
    },
    bonus: {
      derive: (s, part, actor) => {
        const pcCast = s.pendingCast?.result;
        const cur = part.result;
        if (!cur || !pcCast || !actor) return null;
        const castT = castTestOf(pcCast);
        const oppose = bumpSL(cur.oppose);
        const o = resolveOpposed(castT, oppose);
        return { result: { oppose, resisted: o.winner !== 'attacker', margin: Math.max(0, castT.sl - oppose.sl) } };
      },
    },
  }),

  /**
   * Test Étendu (LDB 12 l.172-174) — flux multi SÉQUENTIEL : un Round à la fois, chacun son cycle
   * Chance/+1 DR/Pacte/Résilience. Ici `resolve` ne fait QUE le jet du Round ; le CUMUL du DR (et la
   * dépendance au total des Rounds précédents) vit dans `extendedTestNext` (store). Même fabrique
   * que le Contre-sort PARALLÈLE — seule la progression (un slot après l'autre) change.
   */
  extendedTest: makeRollFlow<PendingExtendedTest, ExtendedTestRound>({
    key: 'pendingExtendedTest',
    // Le Round porte {roll, sl, success} SANS cible (elle vit sur le pending) : accesseur explicite.
    die: {
      read: (r, _a, p) => (r.result && p ? { roll: r.result.roll, target: p.target, critable: false } : null),
      write: (_s, _r, _a, _g, tr) => ({ result: { roll: tr.roll, sl: tr.sl, success: tr.success } }),
    },
    multi: { slots: (p) => p.rounds, idOf: (r) => r.id, replace: (p, rounds) => ({ ...p, rounds }) },
    rolled: (r) => !!r.result,
    actor: (s, _r, p) => (p ? actorIn(s, p.actorId) : undefined),
    resolve: (_s, _r, _actor, _get, forced, p) => {
      if (!p) return null;
      if (forced) {
        // Résilience « Je ne faillirai pas ! » : Round garanti réussi (dé MEILLEUR → DR max), LDB 17 l.68.
        const die = bestForcedRoll(p.target);
        return { result: { roll: die, sl: evaluateTest(die, p.target).sl, success: true } };
      }
      // Cible déjà ajustée à la difficulté → Test « +0 » sur `p.target`.
      const t = rollTest(p.target, 'intermediaire', battleRng());
      return { result: { roll: t.roll, sl: t.sl, success: t.success } };
    },
    outcome: (r) => testOutcome(r.result),
    caps: { forced: true },
    bonus: {
      derive: (_s, r) => bumpResultSL(r),
    },
  }),

  /**
   * CASCADE séquentielle (jets de NUIT / VOYAGE) — flux multi SÉQUENTIEL générique : une étape à la
   * fois (l'étape courante = `participants[cursor]`), chacune son cycle Chance/+1 DR/Pacte/Résilience.
   * Le JET est kind-agnostique (Test « +0 » sur `step.target`, difficulté déjà appliquée) ; la
   * CONSÉQUENCE par `kind` + l'avancée du curseur vivent dans `cascadeNext`/`advanceCascade`
   * (state/cascade.ts). Même fabrique que le Test Étendu — seule la sémantique d'étape change.
   */
  cascade: makeRollFlow<PendingCascade, CascadeStep>({
    key: 'pendingCascade',
    multi: { slots: (p) => p.participants, idOf: (st) => st.id, replace: (p, parts) => ({ ...p, participants: parts }) },
    rolled: (st) => !!st.result,
    actor: (s, st) => (st.actorId ? actorIn(s, st.actorId) : undefined),
    // ACCESSEUR DE DÉ de l'étape (une étape sans jet — `target` nul — n'en a pas). En Test OPPOSÉ,
    // l'issue reste celle de l'opposition contre le jet FIGÉ de l'attaquant. Aucun `base` ici : le
    // Niveau de Compétence du défenseur est imposé au SEUL point d'opposition (`opposedCascadeRoll`,
    // depuis `st.base`) — l'accesseur n'en est pas une seconde source (LDB 12 l.160).
    die: {
      read: (st) => (st.target != null && st.result ? { roll: st.result.roll, target: st.target, critable: false } : null),
      write: (_s, st, _a, _g, tr) => {
        if (st.target == null) return null;
        const opp = stepOpposedFreeze(st);
        if (st.evaluation === 'seuil') return { result: lireDeEtape(tr.roll, st.target, st.evaluation) };
        return opp
          ? { result: opposedCascadeRoll(tr, opp, st.target, st.base) }
          : { result: { roll: tr.roll, target: st.target, sl: tr.sl, success: tr.success } };
      },
      // Dé CHOISI au titre de la Résilience sur une étape OPPOSÉE : le DR est planché À EMPORTER
      // (LDB 17 l.68 « S'il s'agit d'un Test opposé, vous l'emportez avec au moins DR +1 ») — sans ce
      // plancher, la ré-opposition ci-dessus rendrait la réussite ACHETÉE au dé, donc au hasard.
      floorSL: (st) => { const opp = stepOpposedFreeze(st); return opp ? opposedForcedFloor(opp.aT.sl, false) : 1; },
    },
    resolve: (_s, st, _actor, _get, forced) => {
      if (st.target == null) return null; // étape sans jet → rien à lancer
      const opp = stepOpposedFreeze(st); // Test OPPOSÉ figé (Assommante) → l'issue vient de resolveOpposed.
      if (forced?.sl != null) {
        // Résistance (Menace), LDB 10 l.1016-1020 : auto-succès du Test de l'étape (Contraction,
        // Exposition à la Corruption, Venin…) — DR IMPOSÉ = Bonus d'Endurance (pas de choix du dé).
        return { result: { roll: 1, target: st.target, sl: forced.sl, success: true } };
      }
      if (forced) {
        // Résilience « Je ne faillirai pas ! » (LDB 17 l.68) : « au lieu de lancer les dés, vous
        // choisissez le résultat ». Le dé CHOISI passe par le socle (accesseur) ; ICI, le dé PAR
        // DÉFAUT (le MEILLEUR, policy-aware). Le choix doit RESTER une réussite. En Test
        // OPPOSÉ, le défenseur RÉSISTE (binaire, comme `disengage` forcé) — l'attaquant figé ne l'emporte plus.
        // Sur une étape BINAIRE (Terreur, Test de scène), le dé choisi ne change QUE le DR affiché :
        // `success` reste vrai — c'est la réussite achetée par le point de Résilience. Le dé FIXÉ, lui
        // (branche `forced.fixed` plus haut), n'achète rien : son issue est celle du dé, échec compris.
        // Mode SEUIL : aucun DR à maximiser — la Résilience achète la seule chose qu'un pourcentage
        // offre, la réussite, sur le dé le plus bas.
        if (st.evaluation === 'seuil') return { result: { roll: 1, target: st.target, sl: 0, success: true } };
        const die = bestForcedRoll(st.target);
        const e = evaluateTest(die, st.target);
        return { result: { roll: die, target: st.target, sl: e.sl, success: true } };
      }
      if (st.evaluation === 'seuil') return { result: roulerDeEtape(st.target, battleRng(), st.evaluation) };
      const t = rollTest(st.target, 'intermediaire', battleRng());
      // Test OPPOSÉ : l'issue success/sl du défenseur vient de `resolveOpposed(jetDéfenseur, aT figé)`
      // (l'attaquant garde son jet — calque `recover`/`disengage`), PAS de `roll ≤ target`. Le défenseur
      // RÉSISTE si l'attaquant ne l'emporte PAS (défenseur OU égalité). Simple sinon (réussite ≤ cible).
      if (opp) return { result: opposedCascadeRoll(t, opp, st.target, st.base) };
      return { result: { roll: t.roll, target: st.target, sl: t.sl, success: t.success } };
    },
    outcome: (st) => testOutcome(st.result),
    // Résilience GLOBALE + Résistance (Menace) sur les étapes taguées `menace` (Contraction/Corruption/
    // Venin) ; `picker` (dé choisi) UNIQUEMENT sur une Peur de COMBAT (Test ÉTENDU, le DR
    // gagné dépend du dé, LDB 21 l.27) — pas sur une étape BINAIRE (Terreur/cible/Test de scène/nuit/opposé).
    caps: {
      forced: true,
      resist: true,
    },
    bonus: {
      derive: (_s, st) => {
        if (!st.result) return null;
        const opp = stepOpposedFreeze(st);
        // Chance « +1 DR » (LDB 17 l.24) sur un Test OPPOSÉ : on RE-OPPOSE le jet défenseur amélioré (+1 DR)
        // à l'attaquant FIGÉ (1ʳᵉ position) — le +1 peut FAIRE BASCULER l'issue (calque `disengage.bonus.derive`).
        // `bonusSL` (Piège-lame, LDB 62 l.280) s'AJOUTE en plus au DR du défenseur dans l'opposition (pas au
        // `sl` reporté, qui reste le DR propre +1).
        if (opp) {
          const def2 = bumpSL(hydrateTR({ roll: st.result.roll, target: st.target!, base: st.base, success: st.result.success, sl: st.result.sl }));
          const o = resolveOpposed(opp.aT, bumpSL(def2, opp.bonusSL ?? 0));
          // La BRANCHE et le statu quo se lisent au socle (`opposedBranchSuccess`, LDB 12 l.160) : la Chance
          // peut amener à l'ÉGALITÉ, qui n'est une victoire pour personne.
          return {
            result: {
              roll: def2.roll, target: st.target!, sl: def2.sl,
              success: opposedBranchSuccess(o, opp.defenderMustWin),
              ...(o.winner === 'tie' ? { statuQuo: true as const } : {}),
            },
          };
        }
        return bumpResultSL(st);
      },
    },
  }),

  /**
   * LOT DE DÉS D'UN ÉTAL (#1426) — flux multi PARALLÈLE dégénéré : les dés sont DÉJÀ TOMBÉS (le
   * générateur les a tirés à l'ouverture), chaque rangée n'offre donc que la POSE, jamais un
   * relancement. D'où `rolled: () => true` (aucune phase pré-jet, aucun bouton « Lancer ») et
   * `resolve: () => null` (rien à résoudre — le dé ne se re-jette pas, il se REMPLACE).
   *
   * Aucun acteur : ce sont des dés du MONDE. `actor` rend `undefined`, et c'est le sentinel
   * `WORLD_STEP_OWNER` qui porte la fenêtre (cf. `modalArbiter`) — même possession que toute étape de
   * monde. Le cycle d'influence (Chance/Pacte/Résilience) n'existe pas ici : on n'influence pas la
   * météo d'un étal, on la POSE ou on la subit.
   */
  etalLot: makeRollFlow<PendingEtalLot, EtalLotRow>({
    key: 'pendingEtalLot',
    multi: { slots: (p) => p.participants, idOf: (r) => r.id, replace: (p, parts) => ({ ...p, participants: parts }) },
    rolled: () => true,
    actor: () => undefined,
    die: {
      read: (r) => ({ roll: r.value, target: r.max, critable: false, max: r.max }),
      write: (_s, _r, _a, _g, tr) => ({ value: Math.max(1, Math.min(tr.roll, tr.target)) } as unknown as Partial<EtalLotRow>),
    },
    // La POSE passe par l'ACCESSEUR (`die.write` ci-dessus), jamais par ici : le socle réévalue le dé
    // saisi lui-même. `resolve` n'a donc rien à faire — le dé est déjà tombé, il ne se re-jette pas.
    resolve: () => null,
    // `caps.forced` OUVRE le geste de pose (`setForcedRoll` y est gardé). La Résilience, elle, n'est pas
    // offerte : le flux ne déclare pas le verbe `forceSuccess` — on n'achète pas la marchandise d'un étal.
    caps: { forced: true },
    // Un dé de lot ne REUSSIT ni n’ECHOUE : il tombe. L’issue est scellée neutre sur sa valeur —
    // le socle exige une issue, le domaine n’en a pas à donner.
    outcome: (r) => sealOutcome(true, 0, r.value, r.max),
  }),

  /**
   * Enfoncer une porte À PLUSIEURS (EDO Appendice 2, « Portes ») — flux multi PARALLÈLE (même
   * fabrique que le Contre-sort, métier = DÉGÂTS sur objet) : chaque héros frappe indépendamment
   * (Test de Corps à corps (Bagarre)), dégâts = max(0, DR + Bonus de Force − BE) ; objets : PAS de
   * minimum 1 (l.92). Le cumul des dégâts vs B vit dans `forceDoorConfirm` (store).
   */
  forceDoor: makeRollFlow<PendingForceDoor, ForceDoorParticipant>({
    key: 'pendingForceDoor',
    die: roll3Die<ForceDoorParticipant, PendingForceDoor>(),
    multi: { slots: (p) => p.participants, idOf: (r) => r.id, replace: (p, parts) => ({ ...p, participants: parts }) },
    rolled: (r) => !!r.result,
    actor: (s, r) => actorIn(s, r.id),
    resolve: (_s, _r, actor, _get, forced, p) => {
      if (!actor || !p) return null;
      const value = testValue(actor, 'corps-a-corps'); // Bagarre (CC + avances)
      const bf = bonus(effectiveChar(actor, 'force'));
      if (forced) {
        // Résilience « Je ne faillirai pas ! » : DR maximal (dé MEILLEUR) → dégâts max (LDB 17 l.68).
        const die = bestForcedRoll(value);
        const sl = evaluateTest(die, value).sl;
        return { result: { roll: die, target: value, sl, damage: Math.max(0, sl + bf - p.doorBE) } };
      }
      const t = rollTest(value, 'intermediaire', battleRng());
      return { result: { roll: t.roll, target: t.target, sl: t.sl, damage: Math.max(0, t.sl + bf - p.doorBE) } };
    },
    outcome: (r) => cleanRollOutcome(r.result), // d100 propre réussi (roll ≤ cible)
    caps: { forced: true },
    bonus: {
      // Chance « +1 DR » : +1 au DR → +1 dégât (avant réduction par le BE).
      derive: (_s, r, actor, p) => {
        if (!r.result || !p) return null;
        const bf = bonus(effectiveChar(actor, 'force'));
        const sl = r.result.sl + 1;
        return { result: { ...r.result, sl, damage: Math.max(0, sl + bf - p.doorBE) } };
      },
    },
  }),

  /**
   * Désengagement — Test opposé d'Esquive (LDB 15 l.43-68). Le JET INITIAL reste métier
   * (`disengageRoll` : transition de phase choice → esquive) ; le jet du foe (`p.atk`) reste figé.
   * Issue BINAIRE (success/tie/fail) → pas de choix du dé.
   */
  disengage: opposedBinaryFlow<PendingDisengage>({
    key: 'pendingDisengage',
    rolled: (p) => !!p.result,
    actorId: (p) => p.moverId,
    rollActor: (actor) => rollMeleeDefender(actor, 'esquive', battleRng()), // Esquive du mover (= « attaquant »)
    actorTR: (p) => p.def, putActorTR: (tr) => ({ def: tr }),
    foeTR: (p) => p.atk, // jet du foe FIGÉ (LDB 15 l.43-68)
  }),

  /**
   * « Au Contact » — Test opposé de Corps à corps (LDB 62 l.176, Option « Longueur d'arme »). CALQUE
   * EXACT du Désengagement : le jet INITIAL du mover reste métier (`auContactRoll`) ; le jet du foe
   * (`p.atk`) reste FIGÉ ; seul le jet de Corps à corps du mover se (re)joue (Chance/+1 DR/Pacte/
   * Résilience). Issue BINAIRE (success/tie/fail) → la Résilience fait simplement l'emporter.
   */
  auContact: opposedBinaryFlow<PendingAuContact>({
    key: 'pendingAuContact',
    rolled: (p) => !!p.result,
    actorId: (p) => p.moverId,
    rollActor: (actor) => rollDisengageAttack(actor, battleRng()), // Corps à corps du mover (LDB 62 l.176)
    actorTR: (p) => p.def, putActorTR: (tr) => ({ def: tr }),
    foeTR: (p) => p.atk,
  }),

  /**
   * Empoignade — Test opposé de FORCE (LDB 14 l.161). CALQUE EXACT d'Au Contact : le jet de Force du foe
   * (`p.atk`) reste FIGÉ ; seul le jet de Force de l'acteur (`p.def`) se (re)joue (Chance/+1 DR/Pacte/
   * Résilience). Issue BINAIRE (success/tie/fail) → la Résilience fait simplement l'emporter (Dégâts/Empêtré).
   */
  grapple: opposedBinaryFlow<PendingGrapple>({
    key: 'pendingGrapple',
    rolled: (p) => !!p.result,
    actorId: (p) => p.actorId,
    rollActor: (actor) => rollGrappleForce(actor, battleRng()), // Force de l'acteur (LDB 14 l.161)
    actorTR: (p) => p.def, putActorTR: (tr) => ({ def: tr }),
    foeTR: (p) => p.atk,
  }),

  /**
   * « Fuir » (LDB 15 l.63-66) — flux MULTI HÉTÉROGÈNE à 2 slots, un par ACTEUR :
   *  - `backstab` : le coup dans le dos du FRAPPEUR (Test de Corps à corps NON opposé, +20 dos tourné,
   *    `resolveBackstabAttack`) — son `AttackResult` COMPLET est porté par le slot et appliqué par
   *    l'applicateur canonique d'attaque (`fleeConfirm`), Critique et dépassement compris ;
   *  - `calme` : le Test de Calme du FUYARD, dû seulement si le coup lui a fait perdre des PB —
   *    échec → États Brisés (1 + DR négatif), appliqués par `fleeConfirm`.
   * Chaque slot porte SON cycle d'influence, et son `interactive` suit le contrôleur de SON acteur.
   * Le slot `calme` est RETIRÉ dès que le coup dans le dos est résolu sans Blessure (plus de jet dû).
   */
  flee: makeRollFlow<PendingDisengage, FleeSlot>({
    key: 'pendingDisengage',
    multi: {
      slots: (p) => p.fuir?.participants ?? [],
      idOf: (slot) => slot.id,
      replace: (p, slots) => ({ ...p, fuir: { participants: prunedFleeSlots(slots) } }),
    },
    rolled: (slot) => (slot.kind === 'backstab' ? !!slot.result : !!slot.calme),
    actor: (s, slot) => actorIn(s, slot.id),
    caps: {
      forced: true,
    },
    // ACCESSEUR DE DÉ de CHAQUE slot — coup dans le dos (un double 11 y inflige un Coup Critique,
    // LDB 13 l.183) comme Test de Calme (binaire : le dé en fixe le DR, jamais l'issue forcée).
    die: {
      read: (slot) => (slot.kind === 'backstab'
        ? (slot.result?.attackerDetail
          ? { roll: slot.result.attackerDetail.roll, target: slot.result.attackerDetail.target, critable: true }
          : null)
        : (slot.calme?.target != null ? { roll: slot.calme.roll, target: slot.calme.target, critable: false } : null)),
      write: (s, slot, actor, _g, tr, p) => {
        if (slot.kind === 'calme') return { calme: { roll: tr.roll, target: tr.target, sl: tr.sl, success: tr.success } };
        const t = p ? actorIn(s, p.moverId) : undefined;
        return actor && t ? { result: rederivePassiveAttack(actor, t, backstabWeapon(actor), tr, 'melee', undefined, false, frozenDifficulty(slot.result?.attackerDetail)) } : null;
      },
    },
    resolve: (s, slot, actor, _get, forced, p) => {
      if (!actor || !p) return null;
      if (slot.kind === 'calme') {
        // RAW LDB 17 l.68 : avant le jet (calme==null → dé par défaut) OU après un échec. Le choix du dé
        // vaut AUSSI ici (Test binaire : le dé fixe le DR affiché, l'issue forcée reste une réussite).
        if (forced) { const f = forcedBinarySuccess(slot.calme); return f ? { calme: f } : null; }
        const calme = simpleRoll(slot, actor, (_x, a) => calmeValue(a), 'intermediaire', battleRng);
        return calme ? { calme } : null;
      }
      const target = actorIn(s, p.moverId); // le fuyard reçoit le coup
      if (!target) return null;
      const weapon = backstabWeapon(actor); // Test de CORPS À CORPS (l.63) : arme de mêlée, jamais l'arc en main
      if (forced) {
        const ad = slot.result?.attackerDetail;
        if (!ad) return null; // rien à forcer avant le jet (la modale lance puis force)
        // Dé PAR DÉFAUT = LE MEILLEUR (LDB 17 l.68), jamais le dé raté courant.
        const bDie = bestForcedRoll(ad.target);
        const atk2 = forcedTR(bDie, ad.target, Math.max(evaluateTest(bDie, ad.target).sl, 1));
        return { result: rederivePassiveAttack(actor, target, weapon, atk2, 'melee', undefined, false, frozenDifficulty(ad)) };
      }
      return { result: resolveBackstabAttack(actor, target, battleRng()) };
    },
    outcome: (slot) => (slot.kind === 'backstab' ? testOutcome(slot.result?.attackerDetail) : testOutcome(slot.calme)),
    bonus: {
      // Chance « +1 DR » (LDB 17 l.24) : sur le coup dans le dos, le DR nourrit les Dégâts (re-dérivation
      // complète) ; sur le Calme, il réduit le nombre d'États Brisés (`broken = 1 + max(0,-sl)`) sans
      // toucher à `success`, qui reste dérivé du d100 (LDB 12 l.11).
      guard: (slot) => (slot.kind === 'backstab' ? !!slot.result?.attackerDetail : !!slot.calme),
      derive: (s, slot, actor, p) => {
        if (slot.kind === 'calme') return { calme: { ...slot.calme!, sl: slot.calme!.sl + 1 } };
        const target = p ? actorIn(s, p.moverId) : undefined;
        if (!target) return null;
        const atk2 = bumpSL(hydrateTR(slot.result!.attackerDetail!));
        return { result: rederivePassiveAttack(actor, target, backstabWeapon(actor), atk2, 'melee', undefined, false, frozenDifficulty(slot.result!.attackerDetail)) };
      },
    },
  }),

  /** Piétinement (LDB 85 l.320-321) : attaque de Bagarre, action gratuite à 1 Avantage. */
  trample: makeRollFlow<PendingTrample>({
    key: 'pendingTrample',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.attackerId),
    caps: {
      forced: true,
    },
    die: {
      read: (p) => (p.result?.attackerDetail ? { roll: p.result.attackerDetail.roll, target: p.result.attackerDetail.target } : null),
      write: (s, p, actor, _g, tr) => {
        const t = actorIn(s, p.targetId);
        return actor && t ? { result: rederivePassiveAttack(actor, t, TRAMPLE_WEAPON, tr, 'melee', undefined, false, frozenDifficulty(p.result?.attackerDetail)) } : null;
      },
    },
    resolve: (s, p, actor, _get, forced) => {
      const target = actorIn(s, p.targetId);
      if (!actor || !target) return null;
      if (forced) {
        const ad = p.result?.attackerDetail;
        if (!ad) return null; // rien à forcer sans jet d'attaque
        // Dé PAR DÉFAUT = LE MEILLEUR (LDB 17 l.68), jamais le dé raté courant.
        const tDie = bestForcedRoll(ad.target);
        const atk2 = forcedTR(tDie, ad.target, Math.max(evaluateTest(tDie, ad.target).sl, 1));
        return { result: rederivePassiveAttack(actor, target, TRAMPLE_WEAPON, atk2, 'melee', undefined, false, frozenDifficulty(ad)) };
      }
      return { result: resolveTrample(actor, target, battleRng()) };
    },
    outcome: (p) => testOutcome(p.result?.attackerDetail),
    bonus: {
      guard: (p) => !!p.result?.attackerDetail,
      derive: (s, p, actor) => {
        const target = actorIn(s, p.targetId);
        if (!target) return null;
        const ad = p.result!.attackerDetail!;
        const atk2 = bumpSL(hydrateTR(ad));
        return { result: rederivePassiveAttack(actor, target, TRAMPLE_WEAPON, atk2, 'melee', undefined, false, frozenDifficulty(ad)) };
      },
    },
  }),

  /**
   * Battement (LDB 10 l.103 / AA 13 l.17) : Action, Test de Corps à corps NON opposé. CALQUE de
   * `trample` (jet MONO d'attaquant influençable) — la seule différence est l'issue métier
   * (`resolveBattement` dans `battementConfirm`, pas une attaque à Dégâts). Le jet de CC est figé ici ;
   * `caps.forced` autorise la Résilience (dé PAR DÉFAUT = DR max → retire le plus d'Avantage). PAS de
   * `picker` : l'Avantage retiré ne dépend que du DR (`battementRemoval`), aucun Coup Critique ni
   * localisation ne rend un dé PRÉCIS meilleur que le DR max — le choix du dé n'apporterait rien (≠ trample).
   */
  battement: makeRollFlow<PendingBattement>({
    key: 'pendingBattement',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.attackerId),
    caps: { forced: true },
    resolve: (_s, _p, actor) => {
      if (!actor) return null;
      return { result: rollManeuverAttacker(actor, 'capacite-de-combat', battleRng()) };
    },
    outcome: (p) => testOutcome(p.result),
    // Test de CC NON opposé. Résilience (dé PAR DÉFAUT = DR max, LDB 17 l.68) + Chance « +1 DR » par `bumpSL`
    // (success intact — le vieux `bonus` forçait `success:true` : bug, LDB 17 l.24 ; LDB 12 l.11) via la lentille.
    lens: {
      actorTR: (p) => p.result ?? null,
      applyRoll: (_s, _slot, _actor, _get, tr) => ({ result: tr }),
      dieTarget: (p, actor) => p.result?.target ?? combatValue(actor, 'melee'),
    },
  }),

  /**
   * Distraire (LDB 10 l.364 / AA 13 l.51) : Mouvement, Test OPPOSÉ Athlétisme (mover) vs Calme (foe).
   * CALQUE EXACT du Désengagement/Au Contact : le jet de Calme du foe (`p.defRoll`) reste FIGÉ ; seul le
   * jet d'Athlétisme du mover (`p.atk`) se (re)joue. Issue BINAIRE (success/tie/fail) → la Résilience fait
   * simplement l'emporter. L'issue métier (`resolveDistraire` → `distractedRounds`) vit dans `distraireConfirm`.
   */
  distraire: opposedBinaryFlow<PendingDistraire>({
    key: 'pendingDistraire',
    actorId: (p) => p.moverId,
    // Athlétisme du mover (LDB 10 l.364) : la valeur EST nue (carac effective + avances, LDB 09 l.17)
    // — elle se pose en grandeur de départage (LDB 12 l.160), comme le Calme figé du foe.
    rollActor: (actor) => { const v = distraireAttackValue(actor); return { ...rollTest(v, 'intermediaire', battleRng()), base: v }; },
    actorTR: (p) => p.atk, putActorTR: (tr) => ({ atk: tr }), // mover = « attaquant » : son jet = `p.atk`
    foeTR: (p) => p.defRoll, // Calme du foe FIGÉ
  }),

  /** Manœuvre de créature (Souffle/Vomi/Langue/Regard/Étreinte — LDB 85) qu'un héros active. Le jet
   *  INFLUENÇABLE est celui de l'ATTAQUANT (CC/CT) ; l'APPLICATION (jets des défenseurs + opposition)
   *  vit dans `maneuverConfirm`/`applyMan<X>`, pas ici. Un seul effort de souffle → un jet d'attaquant
   *  (LDB 85 l.251/376, relu influençable). Vomi : +40 d'attaquant (l.376) baked dans le jet. PAS de
   *  `picker` : le jet d'attaquant ne nourrit que le DR de l'OPPOSITION (`resolveManeuver` → `resolveOpposed`
   *  → marge), aucun Coup Critique ni localisation ne dépend du dé PRÉCIS (≠ attaque/trample) → un dé
   *  choisi n'apporte rien de plus que le DR max de la Résilience par défaut. */
  maneuver: makeRollFlow<PendingManeuver>({
    key: 'pendingManeuver',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.attackerId),
    caps: { forced: true },
    resolve: (_s, p, actor) => {
      if (!actor) return null;
      const stat = creatureAttacks(actor.traits ?? []).find((a) => a.def.id === p.maneuverId)?.stat ?? 'capacite-de-tir';
      return { result: rollManeuverAttacker(actor, stat, battleRng(), maneuverAttackerDifficulty(p.kind)) };
    },
    outcome: (p) => testOutcome(p.result),
    // Test de CC/CT NON opposé (le dé ne nourrit que le DR d'OPPOSITION, aucun Critique). Résilience (dé
    // PAR DÉFAUT = DR max, LDB 17 l.68) + Chance « +1 DR » par `bumpSL` (success intact — LDB 17 l.24) via
    // la lentille — CALQUE `battement`. Cette lentille FOURNIT l'ACCESSEUR DE DÉ : le joueur CHOISIT son dé
    // (LDB 17 l.68, inconditionnel) et peut le FIXER (option de confort) ; la cible = combatValue(stat) +
    // Difficulté de la manœuvre, correcte avant le jet comme après.
    lens: {
      actorTR: (p) => p.result ?? null,
      applyRoll: (_s, _slot, _actor, _get, tr) => ({ result: tr }),
      dieTarget: (p, actor) => {
        if (p.result?.target != null) return p.result.target;
        const stat = creatureAttacks(actor.traits ?? []).find((a) => a.def.id === p.maneuverId)?.stat ?? 'capacite-de-tir';
        return combatValue(actor, stat === 'capacite-de-combat' ? 'melee' : 'ranged') + DIFFICULTY_MODIFIERS[maneuverAttackerDifficulty(p.kind)];
      },
    },
  }),

  /** Course (LDB 15 l.41) : Athlétisme (+20) — à cheval, Chevaucher + Mouvement de la monture (LDB 14 l.179). */
  run: makeRollFlow<PendingRun>({
    key: 'pendingRun',
    // ACCESSEUR DE DÉ : le d100 d'Athlétisme ; la distance se REPROJETTE par `runFromTest` (engine).
    die: {
      read: (p) => (p.result?.target != null ? { roll: p.result.roll, target: p.result.target, critable: false } : null),
      write: (s, _p, actor, _g, tr) => (s.battle && actor ? { result: runFromTest(tr, mountMovement(s.battle, actor) + runMovementBonus(actor)) } : null),
    },
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.combatantId),
    caps: { forced: true },
    resolve: (s, p, actor, _get, forced) => {
      if (!s.battle || !actor) return null;
      if (forced) {
        if (p.result?.success) return null; // rien à forcer si déjà réussi
        const m = mountMovement(s.battle, actor); // à cheval : Mouvement de la monture (LDB 14 l.179)
        const base = p.result;
        // RAW LDB 17 l.68 : avant le jet (result==null → on choisit 01) OU après un échec.
        return { result: { success: true, roll: base?.roll ?? 1, target: base?.target, dr: Math.max(0, base?.dr ?? 0), bonusCases: Math.max(base?.bonusCases ?? 0, 2 * m) } };
      }
      // Sprinter (LDB 10) : « Votre Attribut de Mouvement compte comme plus élevé de 1 lorsque vous Courez. »
      return { result: resolveRun(testValue(actor, actor.mountId ? 'chevaucher' : 'athletisme'), mountMovement(s.battle, actor) + runMovementBonus(actor), battleRng()) };
    },
    outcome: (p) => sealOutcome(!!p.result?.success, p.result?.dr ?? 0, p.result?.roll ?? 0, p.result?.target ?? 0),
    // Chance « +1 DR » (LDB 17 l.24) s'applique à TOUT Test : sur une Course, +1 DR ALLONGE la distance.
    // Le porteur du DR est `dr`/`bonusCases` (PAS `sl`) → dérive BESPOKE (pas lentillée). Le DR de Course est
    // en MÈTRES (LDB 15 l.82), converti en cases comme `resolveRun` (÷2 arrondi, la CONSTANTE réelle — pas +2) :
    // +1 DR = +[round((dr+1)/2) − round(dr/2)] case(s). N'écrit PAS `success`, qui reste dérivé du d100
    // (LDB 12 l.11).
    bonus: {
      guard: (p) => !!p.result, // pas de +DR avant le jet
      derive: (_s, p) => {
        if (!p.result) return null;
        const dr = p.result.dr + 1;
        const bonusCases = p.result.bonusCases + Math.round(dr / 2) - Math.round(p.result.dr / 2);
        return { result: { ...p.result, dr, bonusCases } };
      },
    },
  }),

  /** Chute VOLONTAIRE (LDB 15 l.82) : Athlétisme Accessible (+20) — DR-driven comme `run` (Chance « +1 DR »
   *  = 1 m de chute en moins, pas binaire). `p.attempt` (choix pré-jet, `fallChoose`) gate le jet : `false`
   *  = saut direct SANS Test, résolu immédiatement par `fallChoose` (jamais de `roll`) ; ce flux ne roule
   *  QUE la branche « Tenter » (`attempt===true`). */
  fall: makeRollFlow<PendingFall>({
    key: 'pendingFall',
    die: {
      read: (p) => (p.result?.target != null ? { roll: p.result.roll, target: p.result.target, critable: false } : null),
      write: (_s, p, _a, _g, tr) => ({ result: fallFromTest(tr, p.metres) }),
    },
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.combatantId),
    caps: { forced: true },
    resolve: (_s, p, actor, _get, forced) => {
      if (!actor || !p.attempt) return null;
      if (forced) {
        if (p.result?.success) return null; // rien à forcer si déjà réussi
        const base = p.result;
        const dr = Math.max(0, base?.dr ?? 0);
        return { result: { success: true, roll: base?.roll ?? 1, target: base?.target, dr, effectiveMetres: Math.max(0, p.metres - dr) } };
      }
      return { result: resolveDeliberateFall(testValue(actor, 'athletisme'), p.metres, battleRng()) };
    },
    outcome: (p) => sealOutcome(!!p.result?.success, p.result?.dr ?? 0, p.result?.roll ?? 0, p.result?.target ?? 0),
    // Chance « +1 DR » (LDB 17 l.24) réduit la chute d'1 m de plus (LDB 15 l.82 : « pour chaque DR, 1 m
    // de moins ») — porteur BESPOKE `dr`/`effectiveMetres` (comme `run`/`bonusCases`), pas `sl`.
    bonus: {
      guard: (p) => !!p.result,
      derive: (_s, p) => {
        if (!p.result) return null;
        const dr = p.result.dr + 1;
        return { result: { ...p.result, dr, effectiveMetres: Math.max(0, p.metres - Math.max(0, dr)) } };
      },
    },
  }),

  /** Manœuvre navale = TEST D'ÉQUIPAGE (MDG 14) : chaque rôle tenu lance SON Test (multi-jets). PJ = interactif
   *  (Chance/+1 DR/Pacte/Résilience sur SON jet) ; marin PNJ = témoin (auto-roulé à l'ouverture). La SOMME des DR
   *  (essentiel ×2) + Moral nourrit la Progression — calculée à la confirmation (`shipManeuverConfirm`). Forced
   *  (Résilience) = DR max du contributeur. Patron `forceDoor`. */
  shipManeuver: makeRollFlow<PendingShipManeuver, ShipManeuverParticipant>(crewRoleFlowSpec('pendingShipManeuver')),

  /** TIR DE BATTERIE = Test d'équipage des Artilleurs (MDG 14 l.128) — JUMEAU de `shipManeuver` (mêmes
   *  `rollCrewRole`/`forceCrewRole`) ; le total (`maneuverCrewTotal`) = DR PARTAGÉ de la volée, appliqué par
   *  `shipBatteryConfirm`. Forced (Résilience) = DR max du contributeur. */
  battery: makeRollFlow<PendingShipBattery, ShipBatteryParticipant>(crewRoleFlowSpec('pendingShipBattery')),

  /** TEST D'ÉQUIPAGE GÉNÉRIQUE (MDG 14, « Types de Test d'équipage ») — 3ᵉ consommateur de la MÊME spec
   *  de jet par rôle ; l'issue par type (Rude épreuve → Moral, l.110) vit dans `crewTestConfirm`. */
  crewTest: makeRollFlow<PendingCrewTest, ShipManeuverParticipant>(crewRoleFlowSpec('pendingCrewTest')),

  /** Étape-PARTICIPANTS d'une CASCADE (batch multi, seam de jet #275 Décision 4 cran 1) : UNE rangée par
   *  contributeur GÉNÉRIQUE de l'étape COURANTE (`pendingCascade.participants[cursor].participants`,
   *  `BatchParticipant`) — chaque participant lance un Test « +0 » sur sa cible EFFECTIVE bakée à la
   *  construction (`rollBatchParticipant` / `forceBatchParticipant` pour la Résilience). AUCUN concept de
   *  domaine : le flux ne connaît ni rôle ni navire, seule la LOCALISATION des slots diverge (au cursor,
   *  pas au top-level du pending). L'AGRÉGAT (`step.aggregate`) est calculé par `cascade.commitStep` à la
   *  validation de l'étape — ce flux ne fait QUE le jet individuel.
   *
   *  Étape OPPOSÉE (`meta.opposed`) : le jet d'adversaire est FIGÉ, jeté UNE fois par le producteur, et
   *  chaque rangée s'y oppose (LDB 13 l.77) — l'issue vient d'`opposedCascadeRoll`, jamais de
   *  `roll ≤ cible`, au premier jet comme à chaque influence (calque de l'étape MONO `cascade`). */
  cascadeBatch: makeRollFlow<PendingCascade, BatchParticipant>({
    key: 'pendingCascade',
    // ACCESSEUR DE DÉ propre à ce flux (calque de l'étape MONO `cascade`) : un dé CHOISI/FIXÉ doit
    // écrire une issue COMPLÈTE. L'accesseur générique `roll3Die` n'écrit que `{roll,target,sl}` ;
    // la rangée porte SON verdict (`CascadeRoll.success`, lu par `outcome`), donc un `success` absent
    // vaudrait échec — la Résilience se dépenserait pour rien. Étape OPPOSÉE : on RÉ-OPPOSE le dé posé
    // au jet figé (le dé choisi doit peser sur l'opposition, pas sur un `roll ≤ cible` qui n'est pas
    // la règle du site) ; sinon l'issue est celle du dé.
    die: {
      read: (r: BatchParticipant) => (r.result ? { roll: r.result.roll, target: r.result.target, critable: false } : null),
      write: (s: GameState, r: BatchParticipant, _a: Combatant | undefined, _g: Get, tr: TestResult) => {
        const opp = currentStepFreeze(s);
        return {
          result: opp
            ? opposedCascadeRoll(tr, opp, r.target, r.base)
            : { roll: tr.roll, target: r.target, sl: tr.sl, success: tr.success },
        } as Partial<BatchParticipant>;
      },
      // Même plancher que l'étape MONO : sur une bande OPPOSÉE, le dé choisi par la Résilience EMPORTE
      // l'opposition (LDB 17 l.68), il ne la retente pas.
      floorSL: (_r: BatchParticipant, _a: Combatant | undefined, p: PendingCascade) => {
        const opp = stepOpposedFreeze(p.participants[p.cursor]);
        return opp ? opposedForcedFloor(opp.aT.sl, false) : 1;
      },
    },
    multi: {
      slots: (p) => p.participants[p.cursor]?.participants ?? [],
      idOf: (r) => r.id,
      replace: (p, parts) => ({
        ...p,
        participants: p.participants.map((st, i) => (i === p.cursor ? { ...st, participants: parts } : st)),
      }),
    },
    rolled: (r) => !!r.result,
    actor: (s, r) => actorIn(s, r.id),
    // Une bande met en jeu les mêmes règles qu'une étape seule, et chaque rangée les joue POUR ELLE :
    // Résilience (`forced`), Résistance (Menace) (`resist`, LDB 10 l.1016-1020) et Détermination
    // (`determine`, LDB 17 l.59 — la Psychologie ne se teste qu'en bandes).
    caps: {
      forced: true,
      // Le tag `menace` de la rangée (`PendingBase.menace`, posé à la construction par le producteur de
      // la bande — comme sur l'étape mono) ouvre le verbe ; `resolve` reçoit alors `{ sl: BE }`.
      resist: true,
      // Détermination : immunité TEMPORAIRE marquée SUR LA RANGÉE (`BatchParticipant.immune`), pas une
      // réussite forcée (≠ `resist`) — l'applier de bande lit ce flag par rangée. La bande vaut UNE
      // entrée de règle : la DÉCLARATION de Psychologie (type/source/indice) vit sur l'ÉTAPE courante,
      // ce qui diverge par héros vit sur la rangée (`BatchParticipant.meta`). Le `result` synthétique
      // (DR 0) ne sert qu'à faire avancer la bande.
      determine: (slot, actor, get, _set, commit) => {
        if (slot.result) return; // rangée déjà résolue
        const pc = get().pendingCascade;
        const st = pc?.participants[pc.cursor];
        if (!st || (!st.combatPsych && !st.encounterPsych)) return; // Détermination = immunité PSYCHOLOGIQUE seulement
        if ((actor.resolve ?? 0) <= 0) return;
        const msg = spendResolveForPsychImmunity(actor); // dépense + psychImmuneRoundsLeft (ActiveEffect 2 Rounds)
        if (!msg) return;
        commit({ immune: true, result: { roll: slot.target, target: slot.target, sl: 0, success: true } }, { touch: true });
        get().log(msg);
      },
    },
    resolve: (s, r, actor, _get, forced) => {
      if (!actor) return null; // rangée sans acteur résoluble (parité historique) — pas de jet
      // Résistance (Menace), LDB 10 l.1016-1020 : auto-succès de CETTE rangée à DR IMPOSÉ (aucun dé,
      // aucune ré-opposition — calque de l'étape MONO) ; les autres rangées de la bande sont intactes.
      if (forced?.sl != null) return { result: { roll: 1, target: r.target, sl: forced.sl, success: true } };
      // Résilience : le défenseur d'une opposition RÉSISTE (binaire, `forceBatchParticipant` rend
      // `success:true`) — l'attaquant figé ne l'emporte plus, comme sur l'étape MONO.
      return { result: forced ? forceBatchParticipant(r) : rollBatchParticipant(r, battleRng(), currentStepFreeze(s)) };
    },
    // La rangée PORTE son verdict (`CascadeRoll.success` — opposition comprise) : l'issue le LIT au
    // lieu de recomparer dé et cible, qui ne décrit qu'un Test simple.
    outcome: (r) => testOutcome(r.result),
    // Chance « +1 DR » (LDB 17 l.24) : sur une rangée OPPOSÉE, on RE-OPPOSE le jet amélioré au jet figé
    // (le +1 peut faire BASCULER l'issue) — sinon simple report du DR.
    bonus: {
      derive: (s, r) => {
        const opp = currentStepFreeze(s);
        if (!opp || !r.result) return bumpResultSL(r);
        const def2 = bumpSL(hydrateTR({ roll: r.result.roll, target: r.target, base: r.base, success: r.result.success, sl: r.result.sl }));
        return { result: opposedCascadeRoll(def2, opp, r.target, r.base) };
      },
    },
  }),

  /** CHANSON DE MARIN (Talent, MDG 09 l.32-40) : Test de **Divertissement (Chant)** du chanteur — la
   *  chanson doit être CHOISIE au pré-jet (OptionChooser). Réussi → effet 3 min + DR sur l'équipage
   *  (`shantyConfirm`). Résilience : 01 → DR max (durée maximale). */
  shanty: makeRollFlow<PendingShanty>({
    key: 'pendingShanty',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.singerId),
    caps: { forced: true },
    resolve: (s, p, actor) => p.shantyId // chanson non choisie → pas de jet
      ? simpleTestResultResolve((_p, a) => testValue(a, 'divertissement', undefined, 'chant'), 'intermediaire')(s, p, actor)
      : null,
    outcome: (p) => testOutcome(p.result),
    // Chance/Résilience GLOBALES via la lentille `result` (LDB 17) : +1 DR = +1 min de chant (MDG 09 l.38, durée ∝ DR).
    lens: resultRollLens((_p, actor) => testValue(actor, 'divertissement', undefined, 'chant')),
  }),

  /** Focalisation (Test étendu de magie) — vaut en combat ET hors combat (`actorIn`). */
  focus: makeRollFlow<PendingFocus>({
    key: 'pendingFocus',
    die: {
      read: (p) => (p.result?.target != null ? { roll: p.result.roll, target: p.result.target, critable: false } : null),
      // Un dé SAISI s'évalue au naturel, modificateurs propres du Test compris (`castTestDRMods`,
      // la même source que la voie naturelle `resolveFocus`).
      write: (s, p, actor, _g, tr) => {
        const spell = findSpellById(p.spellId);
        if (!p.result || !actor || !spell) return null;
        const adj = withCastTestDRMods(actor, 'focalisation', tr, { spell, sea: { atSea: seaMagicContext(s).atSea } });
        return { result: { ...p.result, roll: adj.roll, target: adj.target, sl: adj.sl, dr: Math.max(0, adj.sl), isCritical: adj.isDouble && adj.success, isFumble: adj.isDouble && !adj.success } };
      },
    },
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.casterId),
    caps: { forced: true },
    resolve: (s, p, actor, _get, forced) => {
      const spell = findSpellById(p.spellId);
      if (!actor || !spell) return null;
      if (forced) {
        const base = p.result;
        // RAW LDB 17 l.68 « vous choisissez le résultat » : sans enjeu de double, le choix
        // rationnel = LE MEILLEUR dé (`bestForcedRoll`, policy-aware) → DR MAXIMUM quand la cible du
        // Test est connue (post-échec) ; pré-jet (résultat synthétique sans cible), plancher DR 1.
        // Le dé passe par la MÊME source de modificateurs que les deux autres voies.
        const die = base?.target != null ? bestForcedRoll(base.target) : 1;
        const sea = { atSea: seaMagicContext(s).atSea };
        const sl = base?.target != null
          ? Math.max(withCastTestDRMods(actor, 'focalisation', evaluateTest(die, base.target), { spell, sea }).sl, 1)
          : Math.max(base?.sl ?? 1, 1);
        // `base?.malepierreConsumed` (déjà figé au Round précédent) est REPORTÉ : forcer le résultat
        // ne consomme ni ne restitue une seconde fois la réserve de malepierre.
        return { result: { dr: Math.max(base?.dr ?? 0, sl), isCritical: base?.isCritical ?? false, isFumble: false, roll: die, target: base?.target, sl, log: `${actor.label} force la focalisation (Résilience).`, ...(base?.malepierreConsumed ? { malepierreConsumed: base.malepierreConsumed } : {}) } };
      }
      return { result: resolveFocus(actor, spell, battleRng(), 'intermediaire', seaMagicContext(s).atSea, windsMagicModOf(s.battle)) };
    },
    outcome: (p) => sealOutcome((p.result?.dr ?? -1) > 0, p.result?.dr ?? 0, p.result?.roll ?? 0, p.result?.target ?? 0), // DR nul = raté (aucun DR gagné → rejouable)
    bonus: {
      derive: (_s, p) => ({ result: { ...p.result!, dr: p.result!.dr + 1, log: `${p.result!.log} (+1 DR)` } }),
    },
  }),

  /** Dissipation permanente (LDB 46 l.158-160) : un Round du Test étendu de Langue (Magick). `value` porte
   *  déjà le Soutien « même Domaine ». Le DR cumule sur `caster.dispel` au confirm. Calque `focus`. */
  dispel: makeRollFlow<PendingDispel>({
    key: 'pendingDispel',
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.casterId),
    caps: { forced: true },
    resolve: simpleTestResultResolve((p) => p.value, 'intermediaire'),
    outcome: (p) => testOutcome(p.result), // Round réussi → pas de Chance ; le cumul gère le DR négatif
    // Chance « +1 DR » (`bumpSL`) + Résilience GLOBALES via la lentille `result` (LDB 17) ; cible = valeur de Langue (Magick).
    lens: resultRollLens((p) => p.value),
  }),

  // (Test de Psychologie héros (Peur/Terreur/Traits ciblés, LDB 21) : PLUS de flux `psych` dédié. C'est
  //  une CASCADE de Round — résolue par le `FLOWS.cascade` générique, applier 'combatPsych'. La Peur
  //  forcée (Résilience) prend le DR maximal du `forceSuccess` générique, comme la psy de rencontre.)

  /** Entrée en Frénésie (LDB 21 l.31-35) : Test de FM. */
  frenzy: makeRollFlow<PendingFrenzy>({
    key: 'pendingFrenzy',
    die: resultDie<PendingFrenzy>(),
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.combatantId),
    caps: { forced: true },
    resolve: (s, p, actor, _get, forced) => {
      if (!s.battle || !actor) return null;
      if (forced) return forcedBinaryResult(p.result); // Résilience (LDB 17 l.68)
      return { result: resolveFrenzyEntry(effectiveChar(actor, 'force-mentale'), battleRng()) };
    },
    outcome: (p) => testOutcome(p.result),
    // ISSUE au goulot (`apply`) — canal COMBAT (`frenzyConfirm` la tisse dans son `set({ battle })`).
    // Le porteur est garanti au site (`if (!c) return` avant l'appel).
    issueChannel: 'battle',
    issue: (p, s) => describeFrenzy(p, garanti(actorIn(s, p.combatantId), p.combatantId, 'frénésie').label),
  }),

  /** Approche d'une source de Peur (LDB 21 l.27) : Test SEC de Calme Intermédiaire (+0) pour oser
   *  se rapprocher — distinct du Test étendu qui VAINC la Peur (flux `psych`). */
  approach: makeRollFlow<PendingApproach>({
    key: 'pendingApproach',
    die: resultDie<PendingApproach>(),
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.combatantId),
    caps: { forced: true },
    resolve: (s, p, actor, _get, forced) => {
      if (!actor) return null;
      if (forced) return forcedBinaryResult(p.result); // Résilience (LDB 17 l.68)
      return simpleTestResultResolve((_p, a) => calmeValue(a), 'intermediaire')(s, p, actor);
    },
    outcome: (p) => testOutcome(p.result),
  }),

  /** Bénédiction de Protection (LDB 41 l.142) : Test de Force Mentale Accessible (+20) qui DIFFÈRE la
   *  déclaration d'attaque d'un héros sur une cible bénie — succès → l'attaque est relancée ; échec →
   *  l'attaque n'a pas lieu (« choisir une cible ou une Action différente »). Frère du flux `approach`. */
  ward: makeRollFlow<PendingWard>({
    key: 'pendingWard',
    die: resultDie<PendingWard>(),
    rolled: (p) => !!p.result,
    actor: (s, p) => actorIn(s, p.attackerId),
    caps: { forced: true },
    resolve: (s, p, actor, _get, forced) => {
      if (!actor) return null;
      // Résilience « Je ne faillirai pas ! » (LDB 17 l.68) : avant le jet (choisit 01) OU après un échec.
      if (forced) return forcedBinaryResult(p.result);
      return simpleTestResultResolve((_p, a) => effectiveChar(a, 'force-mentale'), 'accessible')(s, p, actor);
    },
    outcome: (p) => testOutcome(p.result),
  }),

  /** Activité (LDB 23 interlude / EDOC voyage / MDG mer / ADE II 8 BATAILLE) : Test de Compétence
   *  dont l'issue est appliquée par `confirmActivity`. Cas SIMPLE (la vaste majorité) = un jet vs une
   *  cible. Cas de BATAILLE : Test COMBINÉ (Infiltration/Repérage, l.75/102 — un jet vs DEUX compétences,
   *  LDB 12 l.206) ou Test OPPOSÉ de « Tenez votre position » (l.161, l'ennemi a un jet FIGÉ). Le cycle
   *  Chance/Pacte/Résilience vit ICI ; l'application (Puissance/héros) vit dans `confirmActivity`. */
  activity: makeRollFlow<PendingActivity>({
    // ACCESSEUR DE DÉ — le d100 de l'Activité, quelle que soit sa forme : simple (une cible), COMBINÉ
    // (LDB 12 l.206 : UN dé confronté à DEUX valeurs → les deux issues se re-dérivent) ou OPPOSÉ de
    // « Tenez votre position » (l'ennemi garde son jet FIGÉ, seul le DR net se recalcule).
    die: {
      read: (p) => (p.roll != null && p.target != null ? { roll: p.roll, target: p.target, critable: false } : null),
      write: (_s, p, _a, _g, tr) => {
        if (p.target2 != null) {
          const c = evaluateCombinedTest(tr.roll, p.target, p.target2);
          return { roll: c.roll, sl: c.a.sl, success: c.a.success, sl2: c.b.sl, success2: c.b.success, combinedLevel: c.level };
        }
        if (p.battle === 'round' && p.enemyValue != null) {
          const v = holdVerdict(p, { roll: tr.roll, sl: tr.sl, success: tr.success });
          return { roll: tr.roll, sl: tr.sl, success: v.held, enemySL: v.enemySL };
        }
        return { roll: tr.roll, target: tr.target, sl: tr.sl, success: tr.success };
      },
    },
    key: 'pendingActivity',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.heroId),
    // Vrai Test joueur → Résilience GLOBALE (LDB 17 l.68, `caps.forced` + verbe `forceSuccess`) ; Chance
    // « +1 DR » (success intact). Cas simple + combiné/opposé unifiés dans `resolve`/`bonus` (pas de lentille :
    // le combiné/opposé porte deux issues, hors du cadre mono-jet de la lentille).
    // Le dé se CHOISIT (LDB 17 l.68, inconditionnel) via l'accesseur déclaré plus haut — `critable` reste
    // faux : un Test d'Activité/Scène n'a AUCUN Coup Critique (concept de COMBAT seul). Le dé PAR DÉFAUT
    // (`bestForcedRoll`, DR MAX) donne la meilleure issue (Succès Stupéfiant DR ≥ 6, l.208/217).
    caps: { forced: true },
    resolve: (_s, p, actor, _get, forced) => {
      // Cible EFFECTIVE d'un jet SIMPLE : compétence + Difficulté + Modificateur de SITUATION (Menace −20
      // l.219 / Planification l.75). Les openers de BATAILLE la pré-cuisent dans `p.target` (mod fondu) ; les
      // openers d'interlude ouvrent avec `target: 0` (rempli ici au 1ᵉʳ jet). On la (re)calcule pour NE JAMAIS
      // relâcher le mod : IDENTIQUE à `p.target` en bataille, renseignée en interlude.
      // `skillValue` est BAKÉE dans le pending (le Test d'Activité n'en porte pas les ids) — valeur
      // déclarée étrangère ; le mod de situation pèse SUR LA CIBLE et se nomme.
      const effTarget = rollLine({
        valeur: p.skillValue, valeurEtrangere: true, difficulty: p.difficulty,
        surLaCible: activityModLines(p.mod, p.modLabel),
      }).target;
      if (p.ritualSpell) {
        // Rituel (Test étendu de Focalisation, `VDM 02 l.129-141`) : ce Round est un Round de
        // Focalisation — orchestré par `resolveFocus` (`engine/magic.ts`, malepierre/Talent/armure
        // inclus), pas le Test simple générique ci-dessous. `resolveFocus` n'expose aucune Résilience.
        if (forced || !actor) return null;
        const spell = findSpellById(p.ritualSpell);
        if (!spell) return null;
        const res = resolveFocus(actor, spell, battleRng(), p.difficulty);
        return { roll: res.roll, target: res.target ?? effTarget, sl: res.dr, success: res.dr > 0, ...(res.malepierreConsumed ? { malepierreConsumed: res.malepierreConsumed } : {}) };
      }
      if (forced) {
        if (activityWon(p)) return null; // rien à forcer si DÉJÀ gagnée (combiné full / tenue tenue / simple réussi)
        // Résilience « vous choisissez le résultat » (LDB 17 l.68) : LE MEILLEUR dé (`bestForcedRoll`,
        // policy-aware) → DR MAXIMUM. En Test COMBINÉ, le jet forcé doit réussir les DEUX cibles → dé ≤
        // min(cibles) (`bestForcedRoll(min)`) → niveau `full` ; en tenue, le PJ l'emporte sur l'opposition.
        if (p.target2 != null) {
          const die2 = bestForcedRoll(Math.min(p.target, p.target2));
          return { roll: die2, success: true, sl: Math.max(evaluateTest(die2, p.target).sl, 1), success2: true, sl2: Math.max(evaluateTest(die2, p.target2).sl, 1), combinedLevel: 'full' as const, forced: true };
        }
        const die = bestForcedRoll(effTarget);
        const primary = { roll: die, target: effTarget, success: true, sl: Math.max(evaluateTest(die, effTarget).sl, 1), forced: true };
        if (p.battle === 'round' && p.enemyValue != null) return { ...primary, enemySL: Math.min(-1, (p.enemySL ?? 0)) };
        return primary;
      }
      // Test COMBINÉ (Infiltration/Repérage, l.75/102) : UN jet confronté aux DEUX valeurs (LDB 12 l.206 ;
      // le mod de SITUATION est déjà fondu dans `p.target`/`p.target2` par l'opener de bataille).
      if (p.target2 != null) {
        const c = evaluateCombinedTest(d100(battleRng()), p.target, p.target2);
        return { roll: c.roll, sl: c.a.sl, success: c.a.success, sl2: c.b.sl, success2: c.b.success, combinedLevel: c.level };
      }
      // Test OPPOSÉ de « Tenez votre position » (l.161) : le PJ jette (`p.target` = mod fondu), l'ennemi a un
      // jet FIGÉ ; `holdVerdict` (→ `resolveOpposed`) tranche et donne le DR net de l'ennemi (`enemySL`,
      // positif = l'ennemi progresse) qui alimente le Point de rupture à la résolution.
      if (p.battle === 'round' && p.enemyValue != null) {
        const pt = evaluateTest(d100(battleRng()), p.target);
        const v = holdVerdict(p, { roll: pt.roll, sl: pt.sl, success: pt.success });
        return { roll: pt.roll, sl: pt.sl, success: v.held, enemySL: v.enemySL };
      }
      // Simple : d100 vs la cible EFFECTIVE (mod inclus) — renseigne `p.target` (interlude) sans jamais
      // l'écraser par une cible SANS mod (fin du « Menace relâchée » des Scènes simples).
      const t = evaluateTest(d100(battleRng()), effTarget);
      return { roll: t.roll, target: effTarget, sl: t.sl, success: t.success };
    },
    // Issue CANONIQUE = `activityWon` (la MÊME source que la narration/l'Appliquer) : combiné `full`
    // seulement (un `partial` = ÉCHEC GLOBAL RAW), tenue tenue (opposition), ou simple réussi. Le gating
    // Chance/Pacte/Résilience en DÉRIVE, sans prédicat `failed` séparé qui lirait skill-1.
    outcome: (p) => sealOutcome(activityWon(p), p.sl ?? 0, p.roll ?? 0, p.target ?? 0),
    bonus: {
      // Chance « +1 DR » (LDB 17 l.24) : `success` n'est jamais réécrit ici (il reste dérivé du d100, LDB 12 l.11).
      derive: (_s, p) => {
        // Combiné : +1 DR sur la 1ʳᵉ cible ; les réussites (donc le NIVEAU) restent INTACTES — on ré-affiche
        // le niveau depuis les réussites figées (`p.success`/`p.success2`), jamais depuis un re-jet numérique.
        if (p.target2 != null) {
          const passed = (p.success ? 1 : 0) + (p.success2 ? 1 : 0);
          return { sl: p.sl + 1, combinedLevel: passed === 2 ? 'full' as const : passed === 1 ? 'partial' as const : 'fail' as const };
        }
        // Tenue (Test OPPOSÉ) : +1 DR au PJ réduit d'autant le DR net de l'ennemi ; l'issue se RE-DÉRIVE
        // par le MÊME juge que le 1ᵉʳ jet (`holdVerdict` → `resolveOpposed`), jamais par une 2ᵉ règle.
        if (p.battle === 'round' && p.enemyValue != null) {
          const sl = p.sl + 1;
          const v = holdVerdict(p, { roll: p.roll ?? 0, sl, success: p.success });
          return { sl, success: v.held, enemySL: v.enemySL };
        }
        // Simple : +1 DR, `success` INTACT (bumpSL ; LDB 17 l.24).
        return { sl: p.sl + 1 };
      },
    },
    touch: touchActors,
  }),

  /** Rechargement (LDB 62 l.335) : Test ÉTENDU de Projectiles — le DR se cumule à l'Appliquer. */
  reload: makeRollFlow<PendingReload, PendingReload, { after: number; weapon: string }>({
    key: 'pendingReload',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.actorId),
    // Vrai Test joueur → Résilience GLOBALE (LDB 17 l.68) via la lentille (`caps.forced` + verbe
    // `forceSuccess`) ; Chance « +1 DR » par `bumpSL` (success intact). Calque `heal`.
    caps: { forced: true },
    resolve: simpleTestResolve((p) => p.skillValue, (p) => p.difficulty, battleRng, { actorless: true }), // Test étendu de Projectiles (battleRng) ; valeur bakée → actorless
    outcome: (p) => rollOutcome(p.roll, p.target, p.sl),
    // Chance « +1 DR » (le Test étendu cumule le DR) + Résilience GLOBALE via la lentille plate ; le garde du
    // forceSuccess (déjà réussi → rien à forcer, LDB 17 l.68) vit dans `dieTarget` (→ null), pas dans `actorTR`.
    lens: flatRollLens((p) => p.success ? null : p.target),
    // ISSUE au goulot (`apply`) — canal COMBAT : le site tisse la ligne rendue dans son `set({ battle })`.
    // `ctx` : le DR cumulé RÉALISÉ (bonus de Talent compris) et le NOM résolu de l'arme, connus de la
    // seule application. La voie IA (aucune fenêtre) acquitte le MÊME goulot avec son pending fourni.
    issueChannel: 'battle',
    issue: (p, _s, ctx: { after: number; weapon: string }) => describeReload(p, ctx.after, ctx.weapon),
  }),

  /** Main ensanglantée (AA 07 l.117) : Test de Dextérité Accessible (+20) PAR ACTION, AVANT d'ouvrir une
   *  attaque avec l'arme tenue dans la main gatée. Vrai Test joueur → Résilience GLOBALE (LDB 17 l.68) via
   *  la lentille (`caps.forced` + verbe `forceSuccess`) ; Chance « +1 DR » par `bumpSL`. Calque `reload`.
   *  L'issue (RÉUSSITE → ouvre l'attaque ; ÉCHEC → `disarm` + Action consommée) vit dans `handGateConfirm`. */
  handGate: makeRollFlow<PendingHandGate>({
    key: 'pendingHandGate',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.attackerId),
    caps: { forced: true },
    resolve: simpleTestResolve((p) => p.skillValue, (p) => p.difficulty, battleRng, { actorless: true }), // valeur Dextérité BAKÉE → actorless
    outcome: (p) => rollOutcome(p.roll, p.target, p.sl),
    lens: flatRollLens((p) => p.success ? null : p.target),
  }),

  /** « Se libérer » (Empêtré, Test opposé de Force, LDB 16 l.66) / « se rouler au sol » (En flammes,
   *  Athlétisme, LDB 16 l.84). */
  recover: makeRollFlow<PendingStateRecovery>({
    key: 'pendingStateRecovery',
    die: trDie<PendingStateRecovery>(),
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.actorId),
    // Test opposé de héros (Force/Athlétisme) → Résilience GLOBALE (LDB 17 l.68) : le résolveur forcé
    // fait L'EMPORTER l'acteur sur la source FIGÉE (`p.opponentRoll`), calque `disengage`/`bargain`.
    caps: { forced: true },
    resolve: (_s, p, _actor, _get, forced) => {
      if (forced) {
        if (p.success) return null; // déjà réussi → rien à forcer
        // Cible effective du repli (cf. `rollTest`) : valeur BAKÉE au pending — montée, écrêtée comprise.
        const target = p.roll?.target ?? rollLine({ valeur: p.skillValue, valeurEtrangere: true, difficulty: p.difficulty }).target;
        const die = bestForcedRoll(target); // dé DR-MAX policy-aware (JAMAIS 01 en dur)
        const actorT = forcedTR(die, target, Math.max(evaluateTest(die, target).sl, p.requireSl ?? 1, 1), p.skillBase);
        if (p.opposition && p.opponentRoll) {
          const opp = resolveOpposed(actorT, p.opponentRoll); // re-oppose vs la source FIGÉE
          return { roll: actorT, netSL: Math.max(1, opp.netSL), success: true }; // l'emporte (DR +1 mini)
        }
        return { roll: actorT, netSL: Math.max(p.requireSl ?? 1, 1), success: true };
      }
      const actorT = { ...rollTest(p.skillValue, p.difficulty, battleRng()), base: p.skillBase };
      if (p.opposition) {
        // LDB 12 l.160 : les DEUX camps portent leur nue (`resolveRecoverTest`), jamais un seul.
        // Difficultés ASYMÉTRIQUES (LDB 12 l.166) : l'acteur honore `p.difficulty` (donnée), l'entrave
        // roule `intermediaire` — MÊME choix qu'à la voie IA (`runEnemyAI`, `case 'recover'`),
        // verrouillé par `combat/ai-recover-departage-nue.test`.
        const oppT = { ...rollTest(p.opposition.value, 'intermediaire', battleRng()), base: p.opposition.base };
        const opp = resolveOpposed(actorT, oppT);
        return { roll: actorT, opponentRoll: oppT, netSL: opp.netSL, success: opp.attackerWins };
      }
      const netSL = Math.max(0, actorT.sl);
      // Filets (Zoo Impérial p.29) : Test NON opposé, réussite exige DR ≥ Indice du filet (`requireSl`).
      return { roll: actorT, netSL, success: p.requireSl != null ? actorT.success && netSL >= p.requireSl : actorT.success };
    },
    reresolve: (_s, p) => {
      const actorT = { ...rollTest(p.skillValue, p.difficulty, battleRng()), base: p.skillBase };
      if (p.opposition && p.opponentRoll) {
        const opp = resolveOpposed(actorT, p.opponentRoll); // la source garde son jet figé
        return { roll: actorT, netSL: opp.netSL, success: opp.attackerWins };
      }
      const netSL = Math.max(0, actorT.sl);
      return { roll: actorT, netSL, success: p.requireSl != null ? actorT.success && netSL >= p.requireSl : actorT.success };
    },
    outcome: (p) => sealOutcome(!!p.success, p.netSL ?? 0, p.roll?.roll ?? 0, p.roll?.target ?? 0),
    bonus: { derive: (_s, p) => ({ netSL: p.netSL + 1, success: p.requireSl != null ? (p.netSL + 1 >= p.requireSl) : p.success }) },
    // ISSUE au goulot (`apply`) — canal COMBAT : `recoverConfirm` la tisse dans ses lignes d'Action.
    issueChannel: 'battle',
    issue: (p, s) => describeStateRecovery(p, actorIn(s, p.actorId)?.label ?? p.actorName),
  }),

  /** Test de compétence interactif (Effet de scène `test`). `requireSL` = seuil de DR exigé. */
  test: makeRollFlow<PendingTest>({
    key: 'pendingTest',
    die: flatDie<PendingTest>(),
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.actorId),
    touch: touchActors,
    // ISSUE au goulot (`apply`) — canal NARRATIF : `resolveTest` acquitte, il ne compose plus sa ligne.
    issue: (p) => describeTest(p),
    caps: {
      forced: true,
      // Détermination (LDB 17 l.59) sur un Test de scène grevé d'un malus PSYCHOLOGIQUE social.
      // MÊME verbe `determine` que la bande de cascade psy, et MÊME source unique de dépense —
      // `spendResolveForPsychImmunity` (engine/psychology) : elle débite le point ET pose l'immunité
      // de Round (`ActiveEffect` psychImmune). La part SPÉCIFIQUE au flux est la répercussion sur le
      // Test EN COURS : `psychMod` est déjà intégré à `skillValue` ET `target` par `openSkillTest`
      // (cf. `PendingTest`) — un acteur immunisé ne le porte plus, on le retranche des deux.
      determine: (p, actor, get, _set, commit) => {
        if (p.roll != null || !p.psychMod) return; // avant le jet, et seulement si un malus psy pèse
        const msg = spendResolveForPsychImmunity(actor); // null = plus de Détermination → rien ne se passe
        if (!msg) return;
        commit({ skillValue: p.skillValue - p.psychMod, target: p.target - p.psychMod, psychMod: 0, psychDetail: undefined }, { touch: true });
        get().log(msg);
        get().log(t('psy.determinationSocial', { name: actor.label }));
      },
    },
    resolve: (_s, p, actor, _get, forced) => {
      // +DR de Talent (LDB 10) sur un Test RÉUSSI — règle UNIVERSELLE `talentTestSLBonus` (matcher
      // STRUCTURÉ `test.matches`, par id). Le contexte `when` n'est pas
      // évalué ici (défaut conservateur ; cf. plan). PLUS les +DR d'effet actif/trait : par Compétence
      // (`skillDRBonus` — chanson « De toutes les terreurs » : +1 DR Calme, MDG 09 l.232) et par
      // Caractéristique (`charDRBonusOf` — « Camarades d'équipage » : +1 DR Sociabilité, l.236).
      const tDR = actor
        ? talentTestSLBonus(actor, { skill: p.skillId, char: p.char, spec: p.spec })
          + (p.skillId ? skillDRBonus(actor, p.skillId, p.spec) : 0)
          + charDRBonusOf(actor, p.char ?? (p.skillId ? effectiveSkillCharKey(actor, p.skillId, { spec: p.spec }) : undefined))
          + offTerrainTestDR(actor) // hors de son terrain : −DR à TOUS les Tests (Créature marine, MDG 16 l.17)
        : 0;
      // Capricieux (MSRC 15 l.149-159) : delta de DR de la table du d10 de l'interlocuteur, tiré à
      // l'ouverture du Test (`openSkillTest`) et appliqué ICI, au DR du Test RÉSOLU.
      const capDR = p.capriciousDR ?? 0;
      // Le gate de DR exigé est la SOURCE UNIQUE `meetsRequiredSL` (également Chance et inversion).
      if (forced) {
        if (p.success) return null; // rien à forcer si déjà réussi
        // RAW LDB 17 l.68 « vous choisissez le résultat » : sans enjeu de double sur un Test de
        // compétence, le choix rationnel = LE MEILLEUR dé (`bestForcedRoll`, policy-aware) → DR MAXIMUM
        // (les talents à bonus de DR s'ajoutent comme sur un jet naturel, le seuil `requireSL` reste garanti).
        const die = bestForcedRoll(p.target);
        return {
          roll: die, success: true,
          sl: Math.max(evaluateTest(die, p.target).sl + tDR + capDR, p.requireSL, 1),
          forced: true,
        };
      }
      const res = rollTest(p.skillValue, p.difficulty, battleRng());
      const sl = res.sl + (res.success ? tDR : 0) + capDR;
      return { roll: res.roll, sl, isDouble: res.isDouble, success: res.success && meetsRequiredSL(p.requireSL, sl) };
    },
    outcome: (p) => rollOutcome(p.roll, p.target, p.sl), // d100 propre réussi (LDB 12 l.11)
    bonus: { derive: (_s, p) => ({ sl: p.sl + 1, success: (p.roll ?? 0) <= p.target && meetsRequiredSL(p.requireSL, p.sl + 1) }) },
    // Inversion de Test (LDB 23 l.209/218 « vous POUVEZ inverser » ; LDB 10 — Talents Sociable/
    // Studieux/Lecture rapide/Pharmacologie/Chat de gouttière/Noctambule/Pansement de fortune, MÊME
    // formule « vous pouvez ») : CHOIX du joueur (#558), offert par la rangée d'influence — jamais
    // automatique. `applyReverse` (engine/reverseToken.ts) tente le Talent (gratuit, illimité) PUIS le
    // jeton d'Activité (consommé) ; les +DR de Talent/effet actif (`tDR`) s'appliquent PAR-DESSUS,
    // comme sur un jet naturel.
    reverse: {
      skillOf: (_s, p) => ({ skill: p.skillId, spec: p.spec }),
      current: (p) => (p.roll != null ? { roll: p.roll, target: p.target } : null),
      applyRoll: (_s, p, actor, _get, tr) => {
        const tDR = talentTestSLBonus(actor, { skill: p.skillId, char: p.char, spec: p.spec })
          + (p.skillId ? skillDRBonus(actor, p.skillId, p.spec) : 0)
          + charDRBonusOf(actor, p.char ?? (p.skillId ? effectiveSkillCharKey(actor, p.skillId, { spec: p.spec }) : undefined))
          + offTerrainTestDR(actor);
        const sl = tr.sl + tDR + (p.capriciousDR ?? 0);
        return { roll: tr.roll, sl, success: tr.success && meetsRequiredSL(p.requireSL, sl) };
      },
    },
  }),

  /** Sauvegarde d'Initiative d'une PANNE DE VAPEUR « Fuite de vapeur » (MDG 12 l.326-328) : la personne
   *  au moteur teste l'Initiative sous peine d'être ébouillantée. Vrai Test JOUEUR → Résilience GLOBALE
   *  (LDB 17 l.68) via la lentille plate ; Chance « +1 DR » par `bumpSL`. L'ébouillantage (échec) est
   *  appliqué par `steamSaveConfirm`, qui reprend ensuite la boucle maritime. */
  steamSave: makeRollFlow<PendingSteamSave>({
    key: 'pendingSteamSave',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.actorId),
    caps: { forced: true },
    resolve: simpleTestResolve((p) => p.skillValue, (p) => p.difficulty),
    outcome: (p) => rollOutcome(p.roll, p.target, p.sl),
    lens: flatRollLens((p) => p.success ? null : p.target), // rien à forcer si déjà réussi
  }),

  /** Exposition à une Influence corruptrice (LDB 19 l.23-75) : Test de Résistance ou de Calme
   *  Intermédiaire (+0) ; le gain de Points dépend du niveau ET du DR (cf. corruptionGain) —
   *  la Chance « +1 DR » peut donc réduire le gain d'une exposition modérée/majeure. */
  corruption: makeRollFlow<PendingCorruption>({
    key: 'pendingCorruption',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.heroId),
    // Résistance (Menace) (LDB 10, `caps.resist`) : exposition → menace 'Corruption' ; seuil (échec =
    // mutation) → menace 'Mutation'. Résilience (LDB 17 l.68, `caps.forced`) : ce Test en est un comme
    // un autre. Test SIMPLE → aucun plancher opposé ; l'accesseur de dé vient de la lentille.
    caps: { forced: true, resist: true },
    resolve: simpleTestResolve((p, actor) => testValue(actor, p.skill), 'intermediaire'),
    outcome: (p) => rollOutcome(p.roll, p.target ?? 0, p.sl),
    // Chance « +1 DR » (`bumpSL`, success intact), Résilience (LDB 17 l.68 — dé par défaut ET dé choisi,
    // l'accesseur étant dérivé d'`actorTR`/`applyRoll`) et Résistance (Menace) GLOBALES via la lentille :
    // le resist force l'auto-succès à DR = Bonus d'Endurance (LDB 10 l.1016-1020), cible = valeur du Test.
    lens: {
      actorTR: (p) => p.roll != null ? hydrateTR({ roll: p.roll, target: p.target ?? 0, success: !!p.success, sl: p.sl ?? 0 }) : null,
      applyRoll: (_s, _slot, _actor, _get, tr) => ({ roll: tr.roll, target: tr.target, sl: tr.sl, success: tr.success }),
      dieTarget: (p, actor) => testValue(actor, p.skill),
    },
  }),

  /** Évaluation (LDB 59 l.41) : révèle la qualité cachée + estime le prix. */
  appraise: makeRollFlow<PendingAppraise>({
    key: 'pendingAppraise',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.actorId),
    touch: touchActors,
    // Vrai Test joueur → Résilience GLOBALE (LDB 17 l.68) via la lentille (`caps.forced` + verbe
    // `forceSuccess`) ; Chance « +1 DR » par `bumpSL` (success intact).
    caps: { forced: true },
    resolve: simpleTestResolve((p) => p.skillValue, (p) => p.difficulty, () => defaultRNG, { actorless: true }), // Évaluation HORS combat → defaultRNG (le rng actuel) ; valeur bakée → actorless
    outcome: (p) => rollOutcome(p.roll, p.target, p.sl),
    lens: flatRollLens((p) => p.target),
  }),

  /** Marchandage (LDB 59 l.43) : Test OPPOSÉ joueur vs marchand — le marchand garde son jet figé. */
  bargain: makeRollFlow<PendingBargain>({
    key: 'pendingBargain',
    // ISSUE au goulot (`apply`) — canal NARRATIF : `bargainConfirm` acquitte, il ne compose plus sa ligne.
    issue: (p) => describeBargain(p) + '.',
    die: {
      ...trDie<PendingBargain>(),
      // Test opposé vs un marchand FIGÉ : le plancher RAW est « l'emporter d'au moins DR +1 » (LDB 17 l.68).
      // `cancelled:false` STRUCTUREL : le marchand est figé, aucun verbe ne lui ouvre de forçage (#1000).
      floorSL: (p) => opposedForcedFloor(p.merchantRoll?.sl ?? 0, false),
      resilience: (_s, p, _a, _g, chosen) => {
        if (p.merchantRoll == null) return null;
        const tr = bargainPlayerTR(p, chosen);
        const result = resolveOpposed(tr, p.merchantRoll);
        return { roll: tr, result: { ...result, winner: 'attacker' as const, attackerWins: true, netSL: Math.max(1, result.netSL), decidedBy: 'force' as const } };
      },
    },
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.playerId),
    touch: touchActors,
    // Test opposé de héros vs marchand FIGÉ → Résilience GLOBALE (LDB 17 l.68) : le résolveur forcé fait
    // L'EMPORTER le joueur sur le marchand figé (`p.merchantRoll`), calque `recover`/`disengage`.
    caps: { forced: true },
    resolve: (_s, p, _actor, _get, forced) => {
      if (forced) {
        if (p.result?.attackerWins) return null; // le joueur l'emporte déjà → rien à forcer
        if (p.merchantRoll == null) return null; // pas de jet marchand figé (avant le 1er Lancer) → rien à opposer
        const target = p.roll?.target ?? p.playerSkill + DIFFICULTY_MODIFIERS.intermediaire; // cible effective (cf. rollTest)
        const die = bestForcedRoll(target); // dé DR-MAX policy-aware (JAMAIS 01 en dur)
        const player = bargainPlayerTR(p, forcedTR(die, target, Math.max(evaluateTest(die, target).sl, 1)));
        const result = resolveOpposed(player, p.merchantRoll); // re-oppose vs le marchand FIGÉ
        // Résilience = le joueur l'emporte d'au moins un Degré (LDB 17 l.68).
        return { roll: player, result: { ...result, winner: 'attacker' as const, attackerWins: true, netSL: Math.max(1, result.netSL), decidedBy: 'force' as const } };
      }
      const player = bargainPlayerTR(p, rollTest(p.playerSkill, 'intermediaire'));
      // `merchantValue` = valeur NUE du marchand (archétype tiré, aucun modificateur) — grandeur du
      // départage à DR égal (LDB 12 l.160), face à la nue du joueur posée par `bargainPlayerTR`.
      const merchant = { ...rollTest(p.merchantValue, 'intermediaire'), base: p.merchantValue };
      return { roll: player, merchantRoll: merchant, result: resolveOpposed(player, merchant) };
    },
    reresolve: (_s, p) => {
      if (p.merchantRoll == null) return null;
      const player = bargainPlayerTR(p, rollTest(p.playerSkill, 'intermediaire'));
      return { roll: player, result: resolveOpposed(player, p.merchantRoll) };
    },
    outcome: (p) => rollOutcome(p.roll?.roll, p.roll?.target ?? 0, p.roll?.sl),
    bonus: {
      derive: (_s, p) => {
        if (p.roll == null || p.merchantRoll == null) return null;
        const boosted = bargainPlayerTR(p, bumpSL(p.roll));
        return { roll: boosted, result: resolveOpposed(boosted, p.merchantRoll) };
      },
    },
  }),

  /** Soin de Guérison (LDB 09) — combat ⇄ hors combat (`actorIn`). La Chirurgie (Test étendu
   *  multi-passes) a son propre flux `surgery` ci-dessous (une passe = une modale influençable). */
  heal: makeRollFlow<PendingHeal>({
    key: 'pendingHeal',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.healerId),
    caps: { forced: true },
    resolve: simpleTestResolve((p) => p.skillValue, (p) => p.difficulty, battleRng, { actorless: true }), // Médecine bakée : le soigneur peut être un PNJ hors actorIn → actorless (jamais nul faute d'acteur live)
    outcome: (p) => rollOutcome(p.roll, p.target, p.sl),
    // Résilience GLOBALE via la lentille plate ; le garde du forceSuccess (déjà réussi OU mode chirurgie :
    // rien à forcer) vit dans `dieTarget` (→ null), pas dans `actorTR` (qui sert aussi le `bonusSL`).
    lens: flatRollLens((p) => (p.success || p.mode === 'surgery') ? null : p.target),
  }),

  /** Chirurgie — le Test de Médecine d'UNE passe (Test ÉTENDU, LDB 10 l.184 / 12 l.200). Calque
   *  `heal` : acteur = le chirurgien (héros → Chance/Pacte/Résilience ; PNJ → influence no-op). Ici
   *  `resolve` ne fait QUE le jet de la passe (DR = `sl`) ; le CUMUL du DR + 1d10 PB + Hémorragie +
   *  le Test d'infection vivent dans `surgeryNext` (medicFlow), comme `extendedTestNext`. */
  surgery: makeRollFlow<PendingSurgery>({
    key: 'pendingSurgery',
    rolled: (p) => p.roll != null,
    actor: (s, p) => actorIn(s, p.healerId),
    caps: { forced: true },
    resolve: simpleTestResolve((p) => p.skillValue, (p) => p.difficulty, battleRng, { actorless: true }), // Médecine bakée : le soigneur peut être un PNJ hors actorIn → actorless (jamais nul faute d'acteur live)
    outcome: (p) => rollOutcome(p.roll, p.target, p.sl),
    // Résilience GLOBALE via la lentille plate ; le garde du forceSuccess (déjà réussi → rien à forcer)
    // vit dans `dieTarget` (→ null), pas dans `actorTR` (qui sert aussi le `bonusSL`).
    lens: flatRollLens((p) => p.success ? null : p.target),
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE UNIQUE du câblage des flux de jet différé : la table `FLOW_VERBS` vit dans `flowVerbs.ts`
// (données pures, sans import runtime) et se ré-exporte ici pour ses consommateurs de flux.
// ─────────────────────────────────────────────────────────────────────────────

export { FLOW_VERBS } from './flowVerbs';

/** Handler (runtime) par flux — préfixe → `FLOWS.x`. `satisfies Record<keyof typeof FLOW_VERBS, …>`
 *  force l'EXHAUSTIVITÉ : tout flux de `FLOW_VERBS` doit avoir son handler ici (sinon `tsc` casse).
 *  Décorrélé de la clé `FLOWS` (shipBattery→battery, opposition→castOpposition). */
export const FLOW_HANDLERS = {
  attack: FLOWS.attack, defense: FLOWS.defense, cast: FLOWS.cast, disengage: FLOWS.disengage, flee: FLOWS.flee,
  auContact: FLOWS.auContact, grapple: FLOWS.grapple, trample: FLOWS.trample, battement: FLOWS.battement,
  distraire: FLOWS.distraire, maneuver: FLOWS.maneuver, run: FLOWS.run, fall: FLOWS.fall, reload: FLOWS.reload, handGate: FLOWS.handGate, recover: FLOWS.recover,
  focus: FLOWS.focus, dispel: FLOWS.dispel, frenzy: FLOWS.frenzy, approach: FLOWS.approach, ward: FLOWS.ward,
  heal: FLOWS.heal, surgery: FLOWS.surgery, corruption: FLOWS.corruption, test: FLOWS.test, steamSave: FLOWS.steamSave,
  activity: FLOWS.activity, bargain: FLOWS.bargain, appraise: FLOWS.appraise, shanty: FLOWS.shanty,
  counterspell: FLOWS.counterspell, cascade: FLOWS.cascade, opposition: FLOWS.castOpposition, extendedTest: FLOWS.extendedTest,
  forceDoor: FLOWS.forceDoor, shipManeuver: FLOWS.shipManeuver, shipBattery: FLOWS.battery, crewTest: FLOWS.crewTest,
  cascadeBatch: FLOWS.cascadeBatch, etalLot: FLOWS.etalLot,
} satisfies Record<keyof typeof FLOW_VERBS, RollFlowHandlers>;

/** Un flux → ses délégués (Mono ou Multi selon `kind`) ; verbes lus depuis `FLOW_VERBS`. */
type WiringActions<P extends string, W extends FlowVerbs> =
  W['kind'] extends 'multi'
    ? MultiRollActions<P, W['verbs'][number]>
    : MonoRollActions<P, W['verbs'][number]>;

/** Aplatit une union d'objets en leur intersection (`{a} | {b}` → `{a} & {b}`). */
type UnionToIntersection<U> =
  (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

/** Matérialise une intersection CALCULÉE en objet PLAT — sinon `interface GameState extends …` n'en
 *  voit pas les membres (une intersection issue de `UnionToIntersection` reste « lazy »). */
type FlattenActions<T> = { [K in keyof T]: T[K] };

/**
 * Surface EXACTE des délégués de jet du store (`<prefix><Verbe>`), DÉRIVÉE de `FLOW_VERBS` (sans le
 * handler → aucune réf à `GameState`, donc PAS de cycle) : une entrée par flux → l'intersection de tous
 * les `Mono/MultiRollActions`, aplatie. `GameState extends RollFlowActionsMap` (store.ts) rend l'invariant
 * BIDIRECTIONNEL : ajouter/retirer un flux ou un verbe dans `FLOW_VERBS` change ce type → le store doit
 * tout réimplémenter (via `buildRollFlowActions`), sinon `tsc` casse.
 */
export type RollFlowActionsMap = FlattenActions<UnionToIntersection<{
  [P in keyof typeof FLOW_VERBS]: WiringActions<P & string, (typeof FLOW_VERBS)[P]>
}[keyof typeof FLOW_VERBS]>>;

/** Assemble les ~113 délégués de jet du store (`<prefix><Verbe>`) depuis `FLOW_VERBS` + `FLOW_HANDLERS`
 *  — remplace les 40 spreads `rollFlowActions(Multi)` éparpillés dans le store. Neutre : les délégués ne
 *  dépendent que de `(get, set)`. */
export function buildRollFlowActions(get: Get, set: Set): RollFlowActionsMap {
  const out: Record<string, unknown> = {};
  for (const [prefix, w] of Object.entries(FLOW_VERBS)) {
    const flow = FLOW_HANDLERS[prefix as keyof typeof FLOW_HANDLERS];
    Object.assign(out, w.kind === 'multi'
      ? rollFlowActionsMulti(prefix, flow, get, set, w.verbs)
      : rollFlowActions(prefix, flow, get, set, w.verbs));
  }
  return out as RollFlowActionsMap;
}

/**
 * ENTRÉE EN LICE d'un contre-lanceur (`FLOWS.counterspell`) — couture UNIQUE partagée par le jet
 * (`resolve`) ET les chemins de dé (`die.write` / `die.resilience`), pour qu'aucun n'ait sa propre
 * table de vérité :
 *  - REFUSE le geste, SANS consommation, quand une AUTRE rangée a déjà DISSIPÉ : il n'y a plus de
 *    Sort à opposer (`LDB 46 l.156` : « Sur un succès, vous dissipez le Sort »), et l'essai du Round
 *    du suivant (« Vous ne pouvez tenter de dissiper qu'un seul Sort chaque Round ») reste intact.
 *    Un ÉCHEC, lui, ne ferme rien : les autres DÉCLARÉS chantent à leur tour, dans n'importe quel
 *    ordre (#1040) ;
 *  - VERROU DE PHASE : aucun jet tant qu'une rangée n'a pas déclaré (`counterspellDeclarePhase`) —
 *    la composition se règle AVANT les dés (arbitrage utilisateur 2026-08-04 [entériné 2026-08-04],
 *    verbatims aux tickets #1042/#1059) ;
 *  - REFUSE une rangée qui ne LANCE pas (`counterspellRolls`) : `pass` ne tente rien, et le groupe
 *    soutenu n'a QU'UN jet (`LDB 12 l.189`), celui de son meneur ;
 *  - consomme l'essai du Round de CELUI qui chante, au moment de SON jet — limite PAR PERSONNAGE,
 *    consommée même sur un échec (`LDB 46 l.156`) — et, pour un jet de GROUPE, celui de CHAQUE uni :
 *    s'unir EST tenter (arbitrage utilisateur 2026-08-04 [entériné 2026-08-04], ticket #1042).
 *    PASSER ne consomme rien : passer n'est pas tenter.
 * Ré-entrante : la rangée qui a dissipé garde SON cycle d'influence (Chance, dé choisi, Résilience)
 * — c'est son propre jet qu'elle retouche, pas une seconde tentative.
 */
function counterspellEngage(
  s: GameState,
  part: CounterParticipant,
  actor: Combatant,
): boolean {
  const pcs = s.pendingCounterspell;
  if (pcs?.participants.some((x) => x.id !== part.id && x.result?.dispelled)) return false;
  if (counterspellDeclarePhase(pcs)) return false;
  if (!counterspellRolls(s, pcs, part)) return false;
  const grp = part.declared === 'soutenu' ? counterspellSoutenu(s, pcs) : null;
  for (const c of grp ? grp.unis : [actor]) c.dispelledThisRound = true;
  return true;
}
