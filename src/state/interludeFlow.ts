/**
 * « Entre deux aventures » (LDB 22-23 — Jalon 5) : flux d'interlude.
 *
 * Séquence RAW (ch.22 l.12) : Événement d100 par héros → Activités (« un maximum d'une Activité
 * par semaine, et […] un maximum de trois Activités au total », ch.23 l.6) → « Argent à
 * gaspiller » (ch.23 l.14 : tout l'argent non sécurisé disparaît ; les Revenus sont remis
 * « seulement une fois que vous avez disposé de l'argent de votre dernière aventure », l.179).
 *
 * Arbitrages jeu-sans-MJ (spec 2026-06-11) : les bourses étant PERSONNELLES (#531), les pertes
 * d'argent d'événements (`moneyPct`) s'appliquent UNE fois sur le total du groupe (le pire tirage,
 * ponctionné glouton par `payFromGroup`) ; le « +1 Chance max » est crédité directement ; la clôture
 * passe par le flux de repos standard (récupération, convalescence, horloge — weeks × 7 jours).
 */
import type { GameState } from './store';
import { battleRng } from './battleRng';
import { d100, deMonde, roll as rollDice } from '../engine/dice';
import { extendedTestStep, isImpressiveSuccess, isImpressiveFailure, isAstoundingSuccess, isAstoundingFailure } from '../engine/tests';
import { INTERLUDE_EVENTS, interludeEventFor, type InterludeEventFx } from '../data/interludeEvents';
import { registerCascadeApplier, registerTableStep, startCascade } from './cascade';
import { freeCons, rollLine } from './rollSeam';
import type { CascadeStep, CascadeTableDecl } from './pendings';
import { fromBrass, toBrass, toMoney, formatMoney, priceToMoney, canAfford, parseStatus, PA_PER_SC } from '../engine/money';
import { partyMoneyTotal, bourseOf, payWithAllocation, payFromGroup, soloPayer, creditBourse, debitBourse } from './bourseFlow';
import { itemFromTrappingById, recomputeLoadout, buildWeapon, autoStowNewItem } from '../engine/items';
import { sleepParty } from './restFlow';
import { purgeAdventureEffects } from './upkeep';
import { resetInterruptedFavorProgress } from './favorFlow';
import { confirmBattleActivity, massBattleBegin, battlePrepEntries } from './massBattleFlow';
import {
  craftTarget, craftSpecOf, orderBlockOf, metierOf, statusIncome, statusIncomeMax, bankWithdrawOutcome, bankPayout, apprenticeshipTutorCost,
  entrainementOptions, entrainementTutorCost,
  ACTIVITIES, activitiesFor, activityById, matchOutcomes, activityAvailableAt, activityTestMod, classGatedDifficulty,
  RESOLVER_OWNER,
  type PriceTier, type ActivityDef, type ActivityResolver, type ResolverOf,
} from '../engine/activities';
import { outOfTradeReason } from '../engine/disponibilite';
import { buildActivityWorldRollSteps } from './activityWorldRolls';
import { applyOps, type GameOp } from '../engine/ops';
import { isFumble } from '../engine/oups';
import { combatValue } from '../engine/combat';
import { spellCost, ritualReduction } from '../engine/grimoire';
import { focusSkillFor, castingValue, consumeMalepierre } from '../engine/magic';
import { gainCorruption, poseCorruptionPending, testDeCorruption } from './corruptionFlow';
import { fireOwnTestFailed } from './triggeredEffects';
import { applyMiscast } from './combatFlow';
import { buySpell as partyBuySpell } from './partyFlow';
import { testValue, type SupportDetail } from '../engine/skills';
import { rule } from '../engine/policy';
import { effectiveEntry } from '../engine/variants';
import { effectiveChar } from '../engine/characteristics';
import type { ChaosAlign, ExposureLevel } from '../engine/corruption';
import { buyTalent as engineBuyTalent, talentCost, buySkillAdvance as engineBuySkillAdvance, buyCharAdvance as engineBuyCharAdvance } from '../engine/advancement';
import { skillCharacteristicById } from '../engine/character';
import { applyTalentAcquisition, fortuneMax, resolveMax, heroMaxWounds } from '../engine/talentEffects';
import { findCareerById, levelsForCareer, findTrappingById, findTalentById, findSpellById, refLabel, skillInstanceLabel, advancementBaseId, qualityRefLabel, qualities, combatStakeRef, type ActivitySkill, libelleOuAbsence } from '../data';
import { findEffectTableById } from '../data/effectTables';
import { findTableEntry } from '../engine/tables';
import { CHAR_LABELS, type CharKey, type Combatant, type Difficulty, type QualityInstance } from '../engine/types';
import { resolveQualities } from '../engine/qualities/dispatch';
import type { PendingBase } from './rollFlowFactory';
import { t, t as msg } from '../i18n'; // `msg` : alias local — `t` est aussi le nom d'un trapping résolu dans plusieurs flux

import type { Get, Set } from './flowTypes';
import type { EffectSource } from '../engine/types';
import { dataLabel } from '../data';
import { stepDetail } from './rollSeam';

export interface InterludeHeroState {
  /** Jet d100 sur le Tableau des Événements (LDB 22). ABSENT tant que le dé n'est pas tombé (phase
   *  `'tirage'`, #942 L7) : l'état porte le DÉ, tout lecteur re-résout la ligne par `interludeEventFor`. */
  eventRoll?: number;
  /** Effets mécaniques de l'événement à consommer par les Activités (Revenus/banque). */
  fx?: InterludeEventFx;
  /** Activités restantes (min(3, semaines) − pertes d'événement/devoir elfique). */
  left: number;
  /** Activités OCTROYÉES à ce héros pour l'interlude (même calcul, AVANT toute dépense) — `left`
   *  ne dit plus, une fois dépensé, s'il en a jamais eu. Lu par `resetInterruptedFavorProgress`
   *  (state/favorFlow) : sans emplacement possible, aucune chaîne de Faveur ne casse. */
  granted: number;
  /** Devoir elfique APPLIQUÉ (règle optionnelle `interlude-elf-duty` active + elfe + ≥3 semaines) —
   *  source UNIQUE de la conséquence : l'UI rend ce drapeau, elle ne re-dérive jamais la règle. */
  elfDuty?: boolean;
  /** A entrepris Revenus — maintient les Niveaux 3-4 (« Avec le pouvoir », ch.23 l.30). */
  didRevenus?: boolean;
  /** Gains de Revenus, crédités APRÈS le gaspillage (ch.23 l.179) — en sous de cuivre. */
  revenueBrass: number;
   /** `InterludeState.perHero` est reconstruit à neuf à chaque ouverture d'interlude (`startInterlude`) :
   *  aucun état de progression LONGUE (Artisanat/Rituel en cours) n'y vit — celle-ci est portée par
   *  `Combatant.craft`/`Combatant.ritual` (`engine/types.ts`), qui survit à la clôture. */
  /** « +10 pour chaque tentative ratée » d'Apprentissage particulier (ch.23 l.63), par talent. */
  learnFails?: Record<string, number>;
  /** Issues d'Activité DIFFÉRÉES à la clôture (États « le premier jour de votre prochaine aventure »,
   *  ACE 12 l.15) — appliquées par `interludeEnd` APRÈS le repos de clôture (un État posé
   *  avant serait dissipé par la récupération des nuits écoulées). */
  closeOps?: GameOp[];
  /** Semer la dissension (LDB 23 l.236-248) : le Test de Ragot (1ʳᵉ des DEUX Activités requises) a
   *  identifié les personnalités influentes du coin — débloque la 2ᵉ Activité (Test de Charme) DANS
   *  CET interlude. Consommé (remis à `false`) à l'issue de la 2ᵉ Activité, succès ou échec. */
  dissensionReady?: boolean;
  /** Faveurs (LDB 23 l.139-151, #509) déjà créditées d'une Activité CET interlude — trace la
   *  « consécutivité » (`Favor.progress`) pour `resetInterruptedFavorProgress` (state/favorFlow). */
  favorProgress?: string[];
}

export interface InterludeState {
  weeks: number;
  /** `'tirage'` (#942 L7) : les dés d'Événement restent à poser (séquence `purpose:'interlude'`) — les
   *  Activités n'ouvrent qu'au dénouement du dernier dé. */
  phase: 'tirage' | 'activities' | 'closing';
  perHero: Record<string, InterludeHeroState>;
}

/** Dépôt bancaire (Opérations bancaires, ch.23 l.154-165 ; `mecenat` = variante d'ACE 12 l.45-49,
 *  retrait résolu par un Test d'Évaluation Intermédiaire) — survit aux interludes et aventures. */
export interface BankDeposit {
  heroId: string;
  kind: 'invest' | 'stash' | 'mecenat';
  /** Montant déposé, en sous de cuivre. */
  brass: number;
  /** Indice d'intérêts (1-10) — taux % ET risque de faillite (invest seulement). */
  rate: number;
  /** Planque liée à une Carte marine (MDG 15 l.292) : sûre tant que le dépositaire GARDE la carte
   *  (sinon découverte sur un jet ≤ `rate`). Absent = planque ordinaire (LDB 23 l.170). */
  chartSecured?: boolean;
}

// ---------------------------------------------------------------------------
// Le d100 d'ÉVÉNEMENT « Entre deux aventures » en étape à TABLE (#942 L7) — LDB 22 : un tirage PAR
// héros, puis le dénouement de GROUPE (les bourses) une fois tous les dés tombés.
// ---------------------------------------------------------------------------

/** Table d'étape du Tableau des Événements : fourchettes et ids STABLES pris PAR RÉFÉRENCE dans la
 *  donnée (`interludeEvents.json`), lookup mécanique inchangé (`interludeEventFor`). Le `label` est
 *  rendu au JOUEUR (rangée de tirage + grille du mode table), sans marque de livre. */
export const INTERLUDE_EVENT_TABLE = 'interlude-events';
registerTableStep(INTERLUDE_EVENT_TABLE, {
  label: msg('if.eventTableLabel'),
  die: 100,
  rows: INTERLUDE_EVENTS,
  lines: (die) => [interludeEventFor(die).label, interludeEventFor(die).desc],
  entryCategory: 'interludeEvents', // la ligne tirée EST l'Événement : sa fiche porte son texte
});

/** Aucun modificateur : le dé NATUREL est le dé du lookup — c'est aussi ce que `perHero.eventRoll`
 *  persiste, et donc ce que tout lecteur re-résout. */
const INTERLUDE_EVENT_DECL: CascadeTableDecl = { tableId: INTERLUDE_EVENT_TABLE, spec: { n: 1, sides: 100 } };

/** La séquence des tirages est SA propre séquence (`purpose:'interlude'`, doctrine du slot #942 L1) :
 *  l'interlude ne s'ouvre jamais en combat, et aucun autre `purpose` hors-combat ne doit y fusionner. */
const INTERLUDE_PURPOSE = 'interlude' as const;

/** Étape à TABLE de l'Événement d'UN héros (dé à poser) — une par héros, dans l'ordre du groupe. */
function eventStep(hero: Combatant): CascadeStep {
  return {
    id: `interlude-event-${hero.id}`,
    kind: 'interludeEvent', actorId: hero.id, icon: 'nav/dice',
    label: stepDetail(t('step.evenement'), dataLabel(hero.label)),
    table: INTERLUDE_EVENT_DECL,
    stake: combatStakeRef('interludeEvent'),
  };
}

/** Étape FINALE de la séquence : le dénouement de GROUPE (bourses), après TOUS les dénouements par
 *  héros — c'est le pire `moneyPct` de la période qui ponctionne, une fois. */
function purseStep(): CascadeStep {
  return {
    id: 'interlude-purse',
    kind: 'interludePurse', icon: 'resource/gold-purse',
    label: t('step.interludePurse'),
  };
}

/** La LIGNE tirée résout l'Événement du héros de l'étape. */
registerCascadeApplier('interludeEvent', (get, set, step, hero) => {
  const rolled = step.table?.result;
  if (!rolled || !hero) return;
  return { consequences: freeCons(finishInterludeEvent(get, set, hero, rolled.roll)) };
});

registerCascadeApplier('interludePurse', (get, set) => {
  const lines = finishInterludeDraw(get, set);
  return { consequences: freeCons(lines.length ? lines : [msg('if.noPurseEvent')]) };
});

/** Ouvre l'interlude : événements tirés et appliqués, commandes livrées, écran dédié. */
export function startInterlude(get: Get, set: Set, weeks = 1): void {
  if (get().battle) {
    get().log(msg('if.inCombat'));
    return;
  }
  if (get().interlude) return; // déjà ouvert
  const party = get().party.filter((h) => !h.dead);
  if (!party.length) return;
  const w = Math.max(1, Math.floor(weeks));
  const lines: string[] = [msg('if.openBanner', { n: w, s: w > 1 ? 's' : '' })];
  // L'aventure qui vient de s'achever purge ses effets « pour la prochaine aventure » (LDB 23 l.209/
  // 218/234 — statusMod de Réputation, jetons d'inversion) : cet interlude EST la borne de fin.
  // (Journalise ses propres lignes — pas de double comptage dans `lines`.)
  purgeAdventureEffects(get, set);
  // Passer commande (ch.23 l.170) : « L'objet sera achevé après votre prochaine aventure » —
  // les commandes du cycle précédent sont livrées à l'ouverture de CET interlude.
  for (const o of get().pendingOrders ?? []) {
    const hero = party.find((h) => h.id === o.heroId);
    const it = hero ? itemFromTrappingById(o.trappingId) : null;
    if (hero && it) {
      hero.items = [...(hero.items ?? []), it];
      autoStowNewItem(hero, it); // #204 : rangement par défaut
      recomputeLoadout(hero);
      lines.push(msg('if.orderDelivered', { name: hero.label, label: trappingLabelOf(o.trappingId) }));
    }
  }
  const baseLeft = Math.min(3, w); // « 1/semaine, max 3 » (ch.23 l.6)
  const perHero: Record<string, InterludeHeroState> = {};
  for (const h of party) perHero[h.id] = { left: baseLeft, granted: baseLeft, revenueBrass: 0 };
  set({ interlude: { weeks: w, phase: 'tirage', perHero }, bank: get().bank ?? [], pendingOrders: [], screen: 'interlude' });
  for (const l of lines) get().log(l);
  // Le dé d'Événement de CHAQUE héros est une étape à TABLE, poussée NON RÉSOLUE (#1426) : aucun
  // effet ne lui est appliqué avant que SON dé ne tombe, et il tombe au RANG de l'étape (jamais à
  // l'appel). Ce qu'il advient de l'étape appartient au socle (`cascade.poserLeCurseur`) : une
  // fenêtre pour le siège qui tient le héros, une résolution d'office si nul siège ne le tient — et
  // l'option « Dés fixés » n'y ajoute que la POSE. Le dénouement de GROUPE ferme la séquence.
  const steps: CascadeStep[] = party.map(eventStep);
  startCascade(get, set, { title: msg('if.drawTitle'), icon: 'nav/dice', purpose: INTERLUDE_PURPOSE, steps: [...steps, purseStep()] });
  set({ party: [...get().party] });
}

/** DÉNOUEMENT d'un Événement pour UN héros, appelé par l'applier de son étape. Le dé est l'autorité : il est persisté (`eventRoll`) et re-résolu par `interludeEventFor`,
 *  la même lecture que les Activités en aval. Renvoie les lignes de journal. */
function finishInterludeEvent(get: Get, set: Set, hero: Combatant, roll: number): string[] {
  const itl = get().interlude;
  const st = itl?.perHero[hero.id];
  if (!itl || !st) return [];
  const ev = interludeEventFor(roll);
  const lines: string[] = [msg('if.eventLine', { name: hero.label, roll, label: ev.label, text: ev.desc })];
  let left = st.left;
  if (ev.fx?.loseActivity) left -= 1;
  // « les elfes ne perdent une Activité que si la durée est d'au moins trois semaines » (ch.23 l.50).
  // Règle optionnelle (LDB 23 l.54-56) : le devoir elfique peut être ignoré (désactiver `interlude-elf-duty`).
  const elfDuty = rule('interlude-elf-duty') && /elfe/i.test(hero.species ?? '') && itl.weeks >= 3;
  if (elfDuty) {
    left -= 1;
    lines.push(msg('if.elfDuty', { name: hero.label }));
  }
  if (ev.fx?.fortuneMaxDelta) {
    hero.fortune = (hero.fortune ?? 0) + ev.fx.fortuneMaxDelta;
    lines.push(msg('if.fortuneOmen', { name: hero.label, n: ev.fx.fortuneMaxDelta }));
  }
  let bank = get().bank ?? [];
  if (ev.fx?.stashRaided && bank.some((b) => b.heroId === hero.id && b.kind === 'stash')) {
    bank = bank.filter((b) => !(b.heroId === hero.id && b.kind === 'stash'));
    lines.push(msg('if.stashRaided', { name: hero.label }));
  }
  itl.perHero[hero.id] = { ...st, eventRoll: roll, fx: ev.fx, left: Math.max(0, left), granted: Math.max(0, left), ...(elfDuty && { elfDuty }) };
  set({ interlude: { ...itl }, bank, party: [...get().party] });
  return lines;
}

/** DÉNOUEMENT de GROUPE, une fois TOUS les dés tombés : le `moneyPct` de la période est ponctionné,
 *  puis les Activités ouvrent (`phase`, garde `refusedBeforeDraw`). Commun aux deux chemins (dernier
 *  maillon : après tous les dénouements par héros).
 *
 *  ARBITRAGE PROVISOIRE → #991 : les `moneyPct` de la donnée n'ont PAS tous la même PORTÉE au RAW —
 *  `LDB 22 l.34-36` (Le Prévôt arrive) vise tous les Personnages, `LDB 22 l.113-115` (Kleptomane) vise
 *  le seul héros qui l'a tiré ; le champ ne porte aucune portée. Ce que #991 tranche. Ici : le PIRE
 *  pourcentage, appliqué UNE fois au total du groupe (comportement d'avant #942 L7, préservé tel quel). */
function finishInterludeDraw(get: Get, set: Set): string[] {
  const itl = get().interlude;
  if (!itl) return [];
  const lines: string[] = [];
  const worstMoneyPct = Object.values(itl.perHero).reduce((worst, st) => Math.min(worst, st.fx?.moneyPct ?? 0), 0);
  if (worstMoneyPct < 0) {
    const lost = Math.floor((toBrass(partyMoneyTotal(get)) * -worstMoneyPct) / 100);
    payFromGroup(get, set, fromBrass(lost), { purpose: 'perte-evenement' });
    lines.push(msg('if.pursesLoss', { pct: -worstMoneyPct, money: formatMoney(fromBrass(lost)) }));
  }
  set({ interlude: { ...get().interlude!, phase: 'activities' } });
  return lines;
}

/** Libellé de l'Événement d'un héros pour le JOURNAL des Activités — appelé sous une garde `st.fx`
 *  (le dé et `fx` sont écrits ENSEMBLE au dénouement) ; sans dé, il se tait au lieu de nommer la
 *  première ligne du tableau. */
const eventLabelOf = (st: InterludeHeroState): string =>
  st.eventRoll == null ? msg('if.eventGeneric') : interludeEventFor(st.eventRoll).label;

// ── Activités (ch.23) — flux de jet par modale (fabrique rollFlow) ────────────────────────────

/** Grandeurs d'un Test OPPOSÉ d'Activité — Scène « Tenez votre position » (ADE II 8 l.161-163) —
 *  POSÉES D'UN BLOC à l'ouverture : `enemyValue` = cible du jet ennemi (bonus cumulatif de tenue
 *  l.163 déjà fondu), `enemyRoll` = son d100 FIGÉ, et les DEUX valeurs NUES que `resolveOpposed`
 *  compare à DR égal (LDB 12 l.160) — `enemyBase` (Puissance de l'armée) et `skillBase` (Niveau de
 *  Compétence du PJ, `LDB 09 l.17`, ni États ni Encombrement ni Soutien : la valeur que
 *  `skillBaseValue` calcule, JAMAIS une soustraction faite au site de lecture).
 *  Le TYPE porte le couplage : ces champs ne se posent qu'ENSEMBLE, ou aucun. Les deux nues restent
 *  optionnelles (un pending qui n'en porte pas → repli deux-cibles d'`openValues`).
 *  Forme PLATE parce que ces champs sont SÉRIALISÉS dans le snapshot de partie (`saves.ts`). */
export type ActivityOppositionOn = { enemyValue: number; enemyRoll: number; enemyBase?: number; skillBase?: number };
export type ActivityOpposition = ActivityOppositionOn | { enemyValue?: undefined; enemyRoll?: undefined; enemyBase?: undefined; skillBase?: undefined };

/** Jet d'Activité en attente (modale) : Revenus / lancer d'Artisanat (Test étendu) / Apprentissage /
 *  Identification d'artefact (ADE II 4) / Activité du CATALOGUE data-driven (`activities.json` —
 *  Convalescence ADE II, Activités d'Altdorf ACE Annexe I). */
export type PendingActivity = PendingActivityFields & ActivityOpposition;

/** Champs COMMUNS d'une `PendingActivity`, hors opposition ennemie : ce qu'assemble un producteur
 *  d'Activité d'interlude (jamais opposée). */
export interface PendingActivityFields extends PendingBase {
  heroId: string;
  /** TOUTES les Activités à jet passent par le CATALOGUE data-driven (`activities.json` + `resolver`). */
  kind: 'catalog';
  label: string;
  skillLabel: string;
  skillValue: number;
  difficulty: Difficulty;
  roll: number | null;
  target: number;
  sl: number;
  success: boolean;
  /** Test étendu (Artisanat/Rituel) : progression (avant ce jet) et cible. */
  drBefore?: number;
  drTarget?: number;
  /** Rituel (`VDM 02 l.377-393`) : id du Sort focalisé CE Round — branche `resolve` de `FLOWS.activity`
   *  (`state/rollFlowSpecs.ts`) vers `resolveFocus` (`engine/magic.ts`) au lieu du Test simple générique. */
  ritualSpell?: string;
  /** DR bonus consommé par la malepierre CE Round (`FocusResult.malepierreConsumed`) — écrit à la
   *  résolution (`consumeMalepierre`), comme le chemin de combat (`combatFlow.ts` `applyCast`). */
  malepierreConsumed?: number;
  /** Apprentissage particulier (ch.23 l.58-63) : `id` STABLE du talent visé + coûts (débités MÊME sur échec). */
  talent?: string;
  xpCost?: number;
  tutorBrass?: number;
  /** Identifier un artefact (ADE II) / Tester un objet magique / Entraînement d'arme (ACE) : objet visé
   *  dans l'inventaire du héros. */
  itemUid?: string;
  /** Activité du CATALOGUE (`kind:'catalog'`) : id de l'`ActivityDef` (`activities.json`). */
  activityId?: string;
  /** Recherche universitaire (ACE 12 l.55) : sort à mémoriser IMMÉDIATEMENT (remise = DR × 100 PX). */
  spellId?: string;
  /** Retrait de Mécénat (ACE 12 l.49) : index du dépôt `bank` soldé par le Test d'Évaluation. */
  depositIndex?: number;
  // ── Activité/Scène de BATAILLE de masse (ADE II 8 — contextes 'bataille'/'bataille-round') ──
  /** Activité de bataille : l'issue (delta de Puissance / modificateur de Test) porte sur l'ARMÉE, pas
   *  sur le héros — routée par `confirmActivity` vers le résolveur de bataille. `prep` = Activité de
   *  préparation ('bataille') ; `round` = Scène cinématique d'un Round ('bataille-round'). */
  battle?: 'prep' | 'round';
  /** Modificateur de SITUATION (fondu dans la cible, en LIGNE de mod pour la modale) : Menace −20 (l.219)
   *  ou bonus de Planification (l.75/100). */
  mod?: number;
  modLabel?: string;
  /** Détail du SOUTIEN multi-PJ fondu dans `skillValue` (l.153/157, LDB 12) — affiché en LIGNE de mod. */
  support?: SupportDetail;
  /** TOUS les PJ engagés dans une Scène/Activité MULTI-PJ (meneur `heroId` compris, l.116-118) — tous
   *  marqués « ayant agi » à la résolution. */
  heroIds?: string[];
  // ── Test COMBINÉ (Infiltration/Repérage, l.75/102 — un jet vs DEUX compétences, LDB 12 l.202-206) ──
  skill2?: string;
  skillValue2?: number;
  target2?: number;
  sl2?: number;
  success2?: boolean;
  /** Niveau du Test combiné : `full` = les deux réussies ; `partial` = une seule ; `fail` = aucune. */
  combinedLevel?: 'full' | 'partial' | 'fail';
  // ── Test OPPOSÉ de « Tenez votre position » (l.161) : l'opposition ennemie vit dans `ActivityOpposition` ──
  /** DR net de l'ennemi au Test opposé de tenue (positif = l'ennemi l'emporte). */
  enemySL?: number;
  forced?: boolean;
  /** Coût en sous de cuivre engagé par CETTE Activité (Réputation, LDB 23 l.228-234 : « le maximum de
   *  vos revenus standards », dépensé MÊME sur échec — calculé à l'ouverture, débité à la résolution). */
  costBrass?: number;
  /** Compétence CHOISIE par le résolveur (au-delà du libellé d'affichage) — Entraînement au Combat
   *  (LDB 23 l.205-209 : Corps à corps OU Projectiles) / Fabuleuse Vente du comte de Punchausen
   *  (AA 12 l.45-49 : Charme OU Divertissement (Narration)) : le jeton d'inversion octroyé SCOPE
   *  cette Compétence. */
  chosenSkill?: string;
  chosenSkillSpec?: string;
}

/** Statut « Échelon Standing » d'un héros (CareerLevelData.status, ex. « Argent 2 »), + modificateur
 *  TEMPORAIRE « pour la prochaine aventure » (LDB 23 l.228-234 « Réputation » : op `statusMod`,
 *  `ActiveEffect.duration.scale === 'adventure'`) — plancher 1 (jamais sous Bronze 1). */
export function heroStatus(h: Combatant): { tier: PriceTier; standing: number } {
  const levels = levelsForCareer(h.career ?? '');
  const lvl = levels[Math.max(0, (h.careerLevel ?? 1) - 1)];
  const st = parseStatus(lvl?.status) ?? { tier: 'bronze' as const, standing: 1 };
  const tempMod = (h.activeEffects ?? []).reduce((s, e) => s + (e.statusMod ?? 0), 0);
  return { tier: st.tier, standing: Math.max(1, st.standing + tempMod) };
}

/** Classe du héros, `id` STABLE (`ClassData.id`) — les événements visent une Classe par id
 *  (`revenueClasses`/`revenueBlockedClasses`, eux aussi en id). Carrière → id de classe. */
export function heroClass(h: Combatant): string {
  return findCareerById(h.career ?? '')?.class ?? '';
}

/** Compétence de carrière « qui permet de Gagner de l'argent » (LDB 08 l.110 : celle en italique
 *  du premier Niveau — l'italique n'est pas dans les données : on prend la première compétence du
 *  Niveau 1 que le héros POSSÈDE, sinon la première listée. Approximation documentée). */
export function incomeSkillOf(h: Combatant): string {
  const lvl1 = levelsForCareer(h.career ?? '')[0];
  const ids = (lvl1?.skills ?? []).map(advancementBaseId).filter((x): x is string => !!x); // AdvancementRef → skillId
  const owned = ids.find((id) => h.skills.some((k) => k.id === id));
  return owned ?? ids[0] ?? 'athletisme';
}

const heroState = (s: GameState, heroId: string) => s.interlude?.perHero[heroId];

/** Ancrage de regle des effets d'une Activite d'interlude — l'`ActivityDef` du catalogue
 *  (`activities.json`), par id STABLE. Absent quand la demande n'en porte pas : on n'en fabrique pas. */
const activitySource = (pa: PendingActivity): EffectSource | undefined =>
  (pa.activityId ? { kind: 'activity', id: pa.activityId } : undefined);

/** Décrémente le budget d'Activités d'un héros (`interlude.perHero[id].left`) — SOURCE UNIQUE du budget
 *  de downtime (LDB 23 l.5 / ADE II 8 l.65). No-op si aucun interlude / budget épuisé. */
export function consumeActivity(get: Get, set: Set, heroId: string): void {
  const itl = get().interlude;
  const st = itl?.perHero[heroId];
  if (!itl || !st || st.left <= 0) return;
  itl.perHero[heroId] = { ...st, left: st.left - 1 };
  set({ interlude: { ...itl } });
}

/** Les Événements de la période sont-ils encore à tirer (phase `'tirage'`, #942 L7) ? LDB 22 l.5 —
 *  SOURCE UNIQUE lue par le MOTEUR (garde ci-dessous) et par l'écran (rappel visuel) : le champ
 *  `InterludeState.phase` n'est pas un décor d'UI, il verrouille l'engagement d'une Activité. */
export function interludeDrawPending(s: GameState): boolean {
  return s.interlude?.phase === 'tirage';
}

/** GARDE d'engagement d'une Activité pendant le tirage (LDB 22 l.5) — refus JOURNALISÉ (jamais un
 *  abandon muet), posé à CHAQUE porte d'entrée d'Activité : le bouton de l'écran n'est qu'un rappel,
 *  c'est ici que la règle tient (coop, devtools, raccourcis compris). Vrai = la demande est refusée. */
function refusedBeforeDraw(get: Get, who: string): boolean {
  if (!interludeDrawPending(get())) return false;
  get().log(t('if.drawPending', { name: who }));
  return true;
}

/** Engage un Artisanat (ch.23 l.66) : exige une Compétence Métier (≥1 avance) ; les matériaux
 *  coûtent ¼ du prix listé, payés AVANT (« devront être achetées avant le début de l'Activité »). */
/** Libellé d'affichage d'un trapping de catalogue par id (repli sur l'id). */
const trappingLabelOf = (id: string): string => findTrappingById(id)?.label ?? id;
/** Libellé d'affichage d'une qualité runtime (id → label, ex. « solide » → « Solide »). */
const craftQualLabel = (id: string): string => qualityRefLabel({ id });

export function craftStart(get: Get, set: Set, heroId: string, trappingId: string, atouts: string[], defauts: string[]): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  if (!st || !h) return;
  if (refusedBeforeDraw(get, h.label)) return;
  if (h.craft) {
    get().log(msg('if.craftBusy', { name: h.label, label: trappingLabelOf(h.craft.trappingId) }));
    return;
  }
  const metier = metierOf(h);
  if (!metier) {
    get().log(msg('if.craftNoSkill', { name: h.label }));
    return;
  }
  const t = findTrappingById(trappingId);
  if (!t) {
    get().log(msg('if.trappingUnknown', { id: trappingId }));
    return;
  }
  // Gamme/Disponibilité/matériaux : dérivation PARTAGÉE avec le catalogue UI (craftSpecOf).
  const spec = craftSpecOf(t);
  if (!spec) {
    get().log(msg('trade.craftRefused', { reason: outOfTradeReason(t.label) }));
    return;
  }
  const { tier, avail, materialsBrass: materials } = spec;
  if (!canAfford(bourseOf(h), fromBrass(materials))) {
    get().log(msg('if.craftMaterialsKo', { cost: formatMoney(fromBrass(materials)), name: h.label }));
    return;
  }
  const target = craftTarget(tier, avail, atouts.length, defauts.length);
  payWithAllocation(get, set, { debits: soloPayer(heroId, fromBrass(materials)), recipient: heroId, purpose: 'artisanat' });
  // `payWithAllocation` remplace l'entrée `party` du héros débité (nouvelle référence) — re-résoudre
  // AVANT de muter `craft`, sinon la mutation porterait sur l'objet PÉRIMÉ (perdue au `set` suivant).
  const h2 = get().party.find((x) => x.id === heroId)!;
  h2.craft = { trappingId, tier, avail, atouts, defauts, drDone: 0, drTarget: target.dr, difficulty: target.difficulty };
  set({ party: [...get().party] });
  get().log(msg('if.craftStart', {
    name: h.label, cost: formatMoney(fromBrass(materials)), label: t.label, dr: target.dr, skill: skillInstanceLabel(metier),
  }));
}

// ── Catalogue d'Activités data-driven (`activities.json`, contexte 'interlude') ────────────────

/** Lieu courant sur la carte du monde : la place dont la scène EST la scène courante (« Être dans
 *  `scene` = être à ce lieu », worldMap.ts). `null` hors carte — les Activités à gate `where`
 *  (ACE = « à Altdorf ») y sont alors indisponibles. */
export function currentPlaceId(s: Pick<GameState, 'scene' | 'worldMap'>): string | null {
  const sid = s.scene?.id;
  return (sid && s.worldMap?.places.find((p) => p.scene === sid)?.id) || null;
}

/** Activités du catalogue proposables ICI (contexte 'interlude' + gate géographique `where`). Quand une
 *  bataille de masse est en attente de préparation (`massBattle.phase === 'prep'`), les Activités de
 *  PRÉPARATION (contexte 'bataille' + Discours) sont AJOUTÉES au catalogue : « Interlude c'est interlude »,
 *  la préparation de bataille se joue DANS le menu d'Activités, pas sur un écran à part (ADE II 8 l.65 :
 *  budget d'Activités UNIQUE). Le rendu gate les prérequis (Infiltration ⇐ Planification, Sabotage ⇐
 *  Repérage) et l'anti-répétition — cf. `battlePrepEntries`. Sans bataille pendante, catalogue inchangé. */
export function interludeCatalog(s: Pick<GameState, 'scene' | 'worldMap' | 'massBattle'>): ActivityDef[] {
  const place = currentPlaceId(s);
  const base = activitiesFor('interlude').filter((d) => activityAvailableAt(d, place));
  if (s.massBattle?.phase !== 'prep') return base;
  return [...base, ...battlePrepEntries(s.massBattle).map((e) => e.def)];
}

/** Meilleure Compétence AU CHOIX de `def.skills` pour un héros, par CIBLE effective (compétence +
 *  Difficulté PROPRE à la voie — `ActivitySkill.difficulty`, repli `def.difficulty`) : généralise la
 *  sélection « meilleure valeur brute » (identique tant que toutes les voies partagent la même
 *  Difficulté, comme Entraînement au combat/« au choix » ci-dessous) au cas où le RAW attache une
 *  Difficulté DIFFÉRENTE par voie (Punchausen, AA 12 l.45-49) — sans quoi le volet (qui doit
 *  prévisualiser la MÊME voie) et le flux divergeraient. SOURCE UNIQUE, partagée avec `InterludeScreen`. */
export function bestActivitySkill(
  h: Combatant,
  def: { skills?: ActivitySkill[]; difficulty?: Difficulty },
): { ref: ActivitySkill; value: number; target: number; difficulty: Difficulty } | undefined {
  const options = def.skills ?? [];
  if (!options.length) return undefined;
  return options
    .map((ref) => {
      const difficulty = ref.difficulty ?? def.difficulty ?? 'intermediaire';
      const value = testValue(h, ref.id, undefined, ref.spec);
      return { ref, value, difficulty, target: rollLine({ actor: h, test: { skill: ref.id, spec: ref.spec }, difficulty }).target };
    })
    .sort((a, b) => b.target - a.target)[0];
}

/** Round de Focalisation d'un Rituel engagé/à engager (Activité « Accomplir un Rituel »,
 *  `VDM 02 l.777`) — résolveur `ritualFocus` à part d'`openCatalogActivity`, pour tenir sa
 *  complexité cognitive. `h.ritual` persiste entre Activités comme l'Artisanat (`h.craft`) ;
 *  le sort visé vient d'`opts.spellId` au 1er Round, puis du Rituel déjà engagé. NI formule
 *  (`cn: null`, `ritual.cnFrom`) = volet 2 (#879), non engageable ici. `null` = refus (déjà
 *  loggé) — le Test étendu de Focalisation lui-même (`VDM 02 l.129-141`) est orchestré par
 *  `resolveFocus` (`engine/magic.ts`), branché dans `FLOWS.activity` (rollFlowSpecs.ts). */
export function openRitualFocus(
  get: Get, set: Set, h: Combatant, spellId: string | undefined,
): { skillValue: number; skillLabel: string; extra: Partial<PendingActivityFields> & { label: string } } | undefined {
  const id = spellId ?? h.ritual?.spellId;
  const sp = id ? findSpellById(id) : undefined;
  if (!sp?.isRitual || !(h.spells ?? []).includes(sp.id)) { get().log(id ? t('if.rituelUnknown', { id }) : t('if.rituelNoSelection', { name: h.label })); return undefined; }
  if (sp.cn == null) { get().log(t('if.rituelNoFormula', { label: sp.label, cnFrom: sp.ritual?.cnFrom ?? '?' })); return undefined; }
  if (h.ritual && h.ritual.spellId !== sp.id) { get().log(t('if.rituelAlreadyStarted', { name: h.label, label: findSpellById(h.ritual.spellId)?.label ?? h.ritual.spellId })); return undefined; }
  const sk = focusSkillFor(h, sp);
  if (!sk) { get().log(t('if.rituelNoFocusSkill', { name: h.label, label: sp.label })); return undefined; }
  if (!h.ritual) {
    const ni = ritualReduction(h, sp)?.cn ?? sp.cn;
    const drTarget = Math.ceil(ni / 2); // NI réduit de moitié en Activité (desc `accomplir-un-rituel`)
    h.ritual = { spellId: sp.id, drDone: 0, drTarget };
    set({ party: [...get().party] });
  }
  const ritualNow = h.ritual!;
  return {
    skillValue: castingValue(h, 'focalisation', sk.spec),
    skillLabel: skillInstanceLabel(sk),
    extra: {
      difficulty: 'intermediaire', // Difficulté non fixée par le RAW (`VDM 02 l.379`) — repli aligné sur `resolveFocus` (rollFlowSpecs.ts, combat)
      drBefore: ritualNow.drDone,
      drTarget: ritualNow.drTarget,
      ritualSpell: sp.id,
      label: sp.label,
    },
  };
}

/** Ouvre la modale d'une Activité du CATALOGUE (TOUTES les Activités à jet d'interlude passent ici).
 *  Le Test et ses paramètres viennent de la DONNÉE, dérivés PAR résolveur : compétences « au choix »
 *  → la MEILLEURE de l'acteur ; `masterWeapon` IMPOSE la compétence d'après l'arme visée (« selon la
 *  spécialisation de l'arme », ACE 12 l.21) ; `income` la compétence de carrière ; `craftExtended` le
 *  Métier (+ DR du Test étendu en cours) ; `learnTalent` la Caractéristique/Compétence du Talent
 *  (+10 par tentative ratée) ; `identify` Savoir (Magie). Cibles éventuelles : objet (`itemUid`),
 *  sort (`spellId` — achat immédiat), dépôt (`depositIndex`), Talent (`talentId`). */
export function openCatalogActivity(get: Get, set: Set, heroId: string, activityId: string, opts: { itemUid?: string; spellId?: string; depositIndex?: number; talentId?: string } = {}): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  const def = activityById(activityId);
  if (!st || !h || st.left <= 0 || !def?.contexts.includes('interlude') || def.blocked) return;
  if (refusedBeforeDraw(get, h.label)) return;
  if (!activityAvailableAt(def, currentPlaceId(get()))) {
    get().log(msg('if.placeOnly', { label: def.label }));
    return;
  }
  if (def.resolver === 'dissensionEmeute' && !st.dissensionReady) {
    get().log(msg('if.dissensionNotReady', { name: h.label }));
    return;
  }
  let skillLabel: string;
  let skillValue: number;
  // Champs de pending dérivés par résolveur (Test étendu, Talent, item…) — annexés à la fin.
  const extra: Partial<PendingActivityFields> = {};
  if (def.resolver === 'income') {
    // Revenus (« Gagner de l'argent grâce au Statut », LDB 08 l.107-118) : Test de la Compétence de
    // Carrière « en italique du premier Niveau » (approximée par `incomeSkillOf`). Gate : événement
    // qui bloque les Revenus pour la Classe du héros (Fausse monnaie & co, LDB 22).
    const blocked = st.fx?.revenueBlockedClasses;
    if (blocked && (blocked.includes('*') || blocked.includes(heroClass(h)))) {
      get().log(msg('if.incomeBlocked', { name: h.label, event: eventLabelOf(st) }));
      return;
    }
    const skill = incomeSkillOf(h);
    skillValue = testValue(h, skill);
    skillLabel = refLabel('skills', { id: skill });
  } else if (def.resolver === 'craftExtended') {
    // Artisanat (ch.23 l.74-92) : Test ÉTENDU de Métier, DR cumulé par Activité — l'ouvrage doit avoir
    // été engagé (`craftStart` : matériaux ¼ prix + `h.craft`). La Difficulté et la cible de DR
    // viennent de l'ouvrage en cours.
    if (!h.craft) return;
    const metier = h.skills.find((k) => k.id === 'metier');
    skillValue = testValue(h, 'metier', undefined, metier?.spec);
    skillLabel = metier ? skillInstanceLabel(metier) : refLabel('skills', { id: 'metier' });
    extra.difficulty = h.craft.difficulty;
    extra.drBefore = h.craft.drDone;
    extra.drTarget = h.craft.drTarget;
    extra.label = stepDetail(dataLabel(def.label), dataLabel(trappingLabelOf(h.craft.trappingId)));
  } else if (def.resolver === 'ritualFocus') {
    const r = openRitualFocus(get, set, h, opts.spellId);
    if (!r) return;
    skillValue = r.skillValue;
    skillLabel = r.skillLabel;
    // eslint-disable-next-line no-restricted-syntax -- La cible est `Partial<PendingActivityFields>` (le pending d'activité), PAS une étape de cascade : ce `label` n'est pas le champ marqué #1318.
    Object.assign(extra, r.extra, { label: stepDetail(dataLabel(def.label), dataLabel(r.extra.label)) });
  } else if (def.resolver === 'learnTalent') {
    // Apprentissage particulier (ch.23 l.66-72) : Talent HORS carrière. Test « Difficile (-20) en
    // utilisant la Caractéristique ou la Compétence la plus pertinente » (sans MJ : la Caractéristique
    // du Maxi du Talent, sinon Int) « +10 pour chaque tentative ratée ». Prix du tuteur : « 2D10
    // pistoles d'argent par 100PX » ; PX + argent gatés AVANT (dépensés MÊME sur échec, cf. resolver).
    const t = opts.talentId ? findTalentById(opts.talentId) : undefined;
    if (!t) { get().log(msg('if.talentUnknown', { id: opts.talentId ?? '' })); return; }
    const xpCost = talentCost(h.talents.find((k) => k.talentId === t.id)?.times ?? 0);
    if ((h.xp ?? 0) < xpCost) {
      get().log(msg('if.entrainementXpKo', { name: h.label, cost: xpCost, label: refLabel('talents', { id: t.id }) }));
      return;
    }
    const tutorBrass = toBrass(apprenticeshipTutorCost(xpCost, battleRng()));
    if (!canAfford(bourseOf(h), fromBrass(tutorBrass))) {
      get().log(msg('if.entrainementTutorKo', { cost: formatMoney(fromBrass(tutorBrass)) }));
      return;
    }
    const tMax = effectiveEntry(t).max; // entrée EFFECTIVE (engine/variants.ts) — une variante réglée republie le Maxi
    const ck: CharKey = tMax && typeof tMax !== 'number' ? tMax.bonusOf : 'intelligence'; // Maxi « Bonus de X » → carac
    const fails = st.learnFails?.[t.id] ?? 0; // clé = id stable du Talent
    skillValue = effectiveChar(h, ck) + 10 * fails;
    skillLabel = `${CHAR_LABELS[ck]}${fails ? ` (+${fails * 10} d'acharnement)` : ''}`;
    extra.talent = t.id;
    extra.xpCost = xpCost;
    extra.tutorBrass = tutorBrass;
    extra.label = stepDetail(dataLabel(def.label), dataLabel(refLabel('talents', { id: t.id })));
  } else if (def.resolver === 'masterWeapon') {
    const item = (h.items ?? []).find((i) => i.uid === opts.itemUid);
    if (!item?.requiresMastery || !item.trappingId || (h.masteredWeapons ?? []).includes(item.trappingId)) return;
    // Compétence IMPOSÉE par l'arme visée : valeur de combat RAW avec cette arme (combatValue —
    // Spé du Groupe si possédée). L'arme synthétique n'a pas d'uid retrouvable → le gate de
    // maîtrise est inerte pour le TEST d'entraînement (c'est l'arme qui est inhabituelle, pas la Spé).
    const kind = item.kind === 'ranged' ? ('ranged' as const) : ('melee' as const);
    skillValue = combatValue(h, kind, buildWeapon({ label: item.label, type: kind, damage: item.damage ?? { plusBF: true, flat: 0 }, subType: item.subType }));
    skillLabel = refLabel('skills', { id: kind === 'melee' ? 'corps-a-corps' : 'projectiles' });
  } else if (def.resolver === 'identify') {
    // Identifier un artefact (ADE II 4 l.41) : « Pour d'autres sorciers » (sans le Talent Détection
    // d'artefact) → Test de Savoir (Magie) Intermédiaire (+0). Savoir est AVANCÉE : il faut l'avoir.
    const item = (h.items ?? []).find((i) => i.uid === opts.itemUid);
    if (!item || item.identified !== false) return; // rien à identifier
    const savoir = h.skills.find((k) => k.id === 'savoir' && (k.spec ?? '') === 'magie' && k.advances >= 1);
    if (!savoir) {
      get().log(msg('if.noSavoirMagie', { name: h.label }));
      return;
    }
    skillValue = testValue(h, savoir.id, undefined, savoir.spec);
    skillLabel = skillInstanceLabel(savoir);
    extra.label = stepDetail(dataLabel(def.label), dataLabel(item.label));
  } else if (def.resolver === 'combatTraining') {
    // Entraînement au Combat (LDB 23 l.205-209) : « une Compétence de Corps à corps ou Projectiles »
    // au choix du joueur — approximée par `bestActivitySkill` (convention partagée avec la branche
    // « au choix » ci-dessous et Punchausen) ; le jeton d'inversion octroyé SCOPE cette Compétence.
    const best = bestActivitySkill(h, def);
    if (!best) return;
    skillValue = best.value;
    skillLabel = refLabel('skills', { id: best.ref.id });
    extra.chosenSkill = best.ref.id;
    extra.chosenSkillSpec = best.ref.spec;
  } else if (def.resolver === 'punchausen') {
    // Fabuleuse Vente du comte de Punchausen (AA 12 l.45-49) : « Test de Charme Complexe (−10) OU
    // Divertissement (Narration) Intermédiaire (+0) » — Difficulté PROPRE à chaque voie
    // (`skills[].difficulty`) ; `bestActivitySkill` retient la CIBLE effective la plus favorable.
    const best = bestActivitySkill(h, def);
    if (!best) return;
    skillValue = best.value;
    skillLabel = refLabel('skills', { id: best.ref.id, spec: best.ref.spec });
    extra.difficulty = best.difficulty;
    extra.chosenSkill = best.ref.id;
    extra.chosenSkillSpec = best.ref.spec;
  } else if (def.resolver === 'knowledgeResearch') {
    // Recherche de savoir (LDB 23 l.220-226) : Savoir Accessible (+20) dans la bonne spécialisation ;
    // « sans la bonne spécialisation […] et que vous êtes instruit » (approximé : possède au moins
    // une avance de Savoir, quelle que soit la spécialisation) → Intelligence Complexe (−10).
    const savoirs = h.skills.filter((k) => k.id === 'savoir' && (k.advances ?? 0) > 0);
    if (savoirs.length) {
      const best = savoirs.map((k) => ({ k, v: testValue(h, 'savoir', undefined, k.spec) })).sort((a, b) => b.v - a.v)[0];
      skillValue = best.v;
      skillLabel = skillInstanceLabel(best.k);
      extra.difficulty = 'accessible';
    } else {
      skillValue = effectiveChar(h, 'intelligence');
      skillLabel = CHAR_LABELS.intelligence;
      extra.difficulty = 'complexe';
    }
  } else if (def.resolver === 'reputation') {
    // Réputation (LDB 23 l.228-234) : Test de la Compétence de Carrière (comme Revenus) ; coût =
    // « le maximum de vos revenus standards », dépensé DANS TOUS LES CAS (même sur échec).
    const skill = incomeSkillOf(h);
    skillValue = testValue(h, skill);
    skillLabel = refLabel('skills', { id: skill });
    const { tier, standing } = heroStatus(h);
    const cost = toBrass(statusIncomeMax(tier, standing));
    if (!canAfford(bourseOf(h), fromBrass(cost))) {
      get().log(msg('if.reputationPurseKo', { name: h.label, cost: formatMoney(fromBrass(cost)) }));
      return;
    }
    extra.costBrass = cost;
    extra.label = stepDetail(dataLabel(def.label), dataLabel(formatMoney(fromBrass(cost))));
  } else {
    // « Au choix » parmi les compétences déclarées : `bestActivitySkill` (convention partagée avec
    // combatTraining/Punchausen ci-dessus).
    const best = bestActivitySkill(h, def);
    if (!best) return;
    skillValue = best.value;
    skillLabel = refLabel('skills', { id: best.ref.id });
  }
  if (def.resolver === 'memorizeDiscount') {
    // Achat IMMÉDIAT obligatoire (ACE 12 l.55) : le sort est choisi AVANT le jet — la remise
    // s'appliquera à CET achat seul, à la validation.
    const sp = opts.spellId ? findSpellById(opts.spellId) : undefined;
    if (!sp || !((spellCost(h, sp) ?? 0) > 0)) return;
  }
  if (def.resolver === 'mecenat') {
    const dep = (get().bank ?? [])[opts.depositIndex ?? -1];
    if (dep?.kind !== 'mecenat' || dep.heroId !== heroId) return;
  }
  // Gate de Classe GÉNÉRIQUE (LDB 23 l.197 / AA 12 l.5) — appliquée EN DERNIER, sur la Difficulté
  // effectivement retenue (celle du résolveur si elle en a dérivé une, sinon celle de la donnée).
  const gatedDifficulty = classGatedDifficulty({ difficulty: extra.difficulty ?? def.difficulty, classGate: def.classGate }, h);
  // Modificateurs de SITUATION en DONNÉE (`testMods`) — UNE seule ligne de mod à l'écran, fondue dans
  // `pa.mod`/`modLabel` comme la Menace ou le bonus de Planification (LDB 09 l.97 : discours + apparence).
  const situation = activityTestMod(def, h);
  const ligneDeMod = situation.mod ? { mod: situation.mod, ...(situation.label ? { modLabel: situation.label } : {}) } : {};
  set({
    pendingActivity: {
      heroId, kind: 'catalog', activityId, label: def.label,
      skillLabel, skillValue,
      roll: null, target: 0, sl: 0, success: false,
      ...ligneDeMod,
      ...(opts.itemUid ? { itemUid: opts.itemUid } : {}),
      ...(opts.spellId ? { spellId: opts.spellId } : {}),
      ...(opts.depositIndex != null ? { depositIndex: opts.depositIndex } : {}),
      ...extra,
      difficulty: gatedDifficulty,
    },
  });
}

/** Retrait d'un dépôt de Mécénat (ACE 12 l.57-65) : le dépôt est SOLDÉ, le rendu suit la bande du Test
 *  d'Évaluation (« profit de 20 % » / investissement / moitié / perte). */
function mecenatPayout(get: Get, set: Set, h: Combatant, depositIndex: number, payoutPct: number): string[] {
  const dep = (get().bank ?? [])[depositIndex];
  if (dep?.kind !== 'mecenat') return [];
  set({ bank: (get().bank ?? []).filter((_, i) => i !== depositIndex) });
  const payout = Math.floor((dep.brass * payoutPct) / 100);
  if (payout > 0) creditBourse(get, set, dep.heroId, fromBrass(payout));
  return [payout > 0
    ? msg('if.mecenatPayout', { name: h.label, money: formatMoney(fromBrass(payout)), pct: payoutPct, invested: formatMoney(fromBrass(dep.brass)) })
    : msg('if.mecenatLoss', { name: h.label, invested: formatMoney(fromBrass(dep.brass)) })];
}

/** Issue d'un résolveur d'Activité : les lignes de journal + un `patch` de l'état d'interlude du
 *  héros (deltas NON exprimables en `GameOp` : DR du Test étendu, crédit différé des Revenus,
 *  compteur d'acharnement — fusionnés dans l'écriture finale de `confirmActivity`). */
interface ResolverResult { lines: string[]; patch?: Partial<InterludeHeroState> }

/** Ce résolveur appartient-il à la famille INTERLUDE (`RESOLVER_OWNER`) ? */
const ownedByInterlude = (r: ActivityResolver): r is ResolverOf<'interlude'> => RESOLVER_OWNER[r] === 'interlude';

/** Dispatch des résolveurs BESPOKE d'issue d'Activité (`ActivityDef.resolver` + bandes `resolver`) —
 *  chacun RÉUTILISE une logique PURE existante et implémente la règle RAW vérifiée. Le `patch` porte
 *  les deltas d'état d'interlude (le `set` final est fait par `confirmActivity`). FERMÉ sur le
 *  sous-ensemble POSSÉDÉ par l'interlude (`RESOLVER_OWNER`) : un résolveur d'une autre famille qui
 *  arriverait ici est une erreur de routage, elle CRIE. */
function runActivityResolver(get: Get, set: Set, resolver: ActivityResolver, pa: PendingActivity, h: Combatant, st: InterludeHeroState): ResolverResult {
  if (!ownedByInterlude(resolver)) {
    throw new Error(`résolveur ${resolver} (famille ${RESOLVER_OWNER[resolver]}) invoqué par le dispatch d'INTERLUDE`);
  }
  switch (resolver) {
    case 'income': {
      // Revenus = « Gagner de l'argent grâce au Statut » (LDB 08 l.110-118) : « Sur un succès, vous
      // gagnez l'argent indiqué […]. Sur un Échec, vous ne gagnez que la moitié de la somme. Sur un
      // Échec Stupéfiant (-6), […] vous n'avez rien gagné. » Le crédit est DIFFÉRÉ (l.191 : « remis une
      // fois que vous avez disposé de l'argent de votre dernière aventure ») → `revenueBrass`, jamais
      // `money`. Revenus maintient aussi le Statut des Niveaux 3-4 (l.193 → `didRevenus`).
      const outcome = pa.success ? 'success' : isAstoundingFailure(pa.success, pa.sl) ? 'astoundingFail' : 'fail';
      const { tier, standing } = heroStatus(h);
      let brass = toBrass(statusIncome(tier, standing, battleRng(), outcome));
      const lines: string[] = [];
      // Événements : ±% sur les Revenus (Fausse monnaie −20, Profits +50 pour une Classe…, LDB 22).
      if (st.fx?.revenuePct && (!st.fx.revenueClasses || st.fx.revenueClasses.includes(heroClass(h)))) {
        brass = Math.max(0, Math.floor((brass * (100 + st.fx.revenuePct)) / 100));
        lines.push(msg('if.eventRevenue', { event: eventLabelOf(st), sign: st.fx.revenuePct > 0 ? '+' : '', pct: st.fx.revenuePct }));
      }
      lines.push(msg('if.incomeWeek', { name: h.label, money: formatMoney(fromBrass(brass)) }));
      return { lines, patch: { didRevenus: true, revenueBrass: st.revenueBrass + brass } };
    }
    case 'craftExtended': {
      // Artisanat = Test ÉTENDU de Métier (ch.23 l.78-92) : « les DR obtenus à chaque Round sont
      // additionnés jusqu'à atteindre une valeur cible » (LDB 12 l.174), 1 lancer par Activité —
      // qui progresse (ou régresse) MÊME sur échec. À l'achèvement, l'objet est créé avec ses
      // Atouts/Défauts choisis. Le travail inachevé est conservé (l.102) via `h.craft` (Combatant —
      // survit à la clôture de l'interlude, #897).
      if (!h.craft) return { lines: [] };
      const { total: drDone, done } = extendedTestStep(pa.drBefore ?? 0, { success: !!pa.success, sl: pa.sl }, h.craft.drTarget);
      if (done) {
        const it = itemFromTrappingById(h.craft.trappingId);
        if (it) {
          it.qualities = [...(it.qualities ?? []), ...h.craft.atouts.map((id) => ({ id })), ...h.craft.defauts.map((id) => ({ id }))]; // ids → QualityInstance
          h.items = [...(h.items ?? []), it];
          autoStowNewItem(h, it); // #204 : rangement par défaut
          recomputeLoadout(h);
        }
        const atL = h.craft.atouts.map(craftQualLabel), dfL = h.craft.defauts.map(craftQualLabel);
        const doneLabel = trappingLabelOf(h.craft.trappingId);
        h.craft = undefined;
        return {
          lines: [msg('if.craftDone', {
            name: h.label, label: doneLabel,
            atouts: atL.length ? ` (${atL.join(', ')})` : '', defauts: dfL.length ? ` [${dfL.join(', ')}]` : '',
          })],
        };
      }
      const advanceLabel = trappingLabelOf(h.craft.trappingId);
      h.craft = { ...h.craft, drDone };
      return {
        lines: [msg('if.craftProgress', { name: h.label, dr: drDone, target: h.craft.drTarget, label: advanceLabel })],
      };
    }
    case 'ritualFocus': {
      // Rituel (Activité « Accomplir un Rituel », `VDM 02 l.777`) : Round de Focalisation cumulé —
      // `extendedTestStep` (Test étendu,
      // LDB 12 l.174) partagé avec l'Artisanat ci-dessus. `pa.sl` porte déjà `FocusResult.dr` (CLAMPÉ
      // ≥ 0 par `resolveFocus`, branché dans `FLOWS.activity`), jamais le SL brut d'un Test de
      // Compétence ordinaire. Composants/Conditions/Sacrifices/Conséquences restent en PROSE non
      // structurée (`SpellData['ritual']`) — non consommés/appliqués ici. `h.ritual` (Combatant) —
      // survit à la clôture de l'interlude, #897.
      if (!h.ritual) return { lines: [] };
      if (pa.malepierreConsumed) consumeMalepierre(h, pa.malepierreConsumed);
      const { total: drDone, done } = extendedTestStep(pa.drBefore ?? 0, { success: !!pa.success, sl: pa.sl }, h.ritual.drTarget);
      const label = findSpellById(h.ritual.spellId)?.label ?? h.ritual.spellId;
      if (done) {
        h.ritual = undefined;
        return {
          lines: [t('if.rituelDone', { name: h.label, label })],
        };
      }
      h.ritual = { ...h.ritual, drDone };
      return {
        lines: [msg('if.ritualProgress', { name: h.label, label, dr: drDone, target: h.ritual.drTarget })],
      };
    }
    case 'learnTalent': {
      // Apprentissage particulier (ch.23 l.66-72) : « Sur un succès, vous avez appris le Talent. Sinon,
      // vous avez échoué […] et gagnez un modificateur de +10 pour chaque tentative ratée » ; « dépensant
      // en vain des PX et de l'argent » → argent du tuteur ET PX consommés MÊME sur échec.
      const talentId = pa.talent;
      if (!talentId) return { lines: [] };
      const talentLabel = refLabel('talents', { id: talentId });
      // Tuteur payé dans TOUS les cas — débité APRÈS les mutations de `h` (l'allocation clone le
      // héros, capturant l'acquisition du Talent au passage).
      const payTutor = () => payWithAllocation(get, set, { debits: soloPayer(h.id, fromBrass(pa.tutorBrass ?? 0)), recipient: h.id, purpose: 'tuteur' });
      if (pa.success) {
        const fortuneBefore = fortuneMax(h);
        const resolveBefore = resolveMax(h);
        const r = engineBuyTalent(h, talentId); // débite les PX + acquiert le Talent
        if (r.ok) {
          applyTalentAcquisition(h, talentId);
          h.wounds.max = heroMaxWounds(h); // Dur à cuire & co
          h.wounds.current = Math.min(h.wounds.current, h.wounds.max);
          h.fortune = (h.fortune ?? 0) + (fortuneMax(h) - fortuneBefore); // Chanceux
          h.resolve = (h.resolve ?? 0) + (resolveMax(h) - resolveBefore); // Obstiné
          payTutor();
          return { lines: [msg('if.learnTalentOk', { name: h.label, label: talentLabel, cost: r.cost, tutor: formatMoney(fromBrass(pa.tutorBrass ?? 0)) })] };
        }
        payTutor();
        return { lines: [] };
      }
      h.xp = Math.max(0, (h.xp ?? 0) - (pa.xpCost ?? 0)); // PX perdus en vain (échec)
      const learnFails = { ...(st.learnFails ?? {}) };
      learnFails[talentId] = (learnFails[talentId] ?? 0) + 1; // clé = id stable du Talent, +10 à la reprise
      payTutor();
      return {
        lines: [msg('if.learnTalentKo', { name: h.label, label: talentLabel })],
        patch: { learnFails },
      };
    }
    case 'identify': {
      // Identifier un artefact magique (ADE II 4 l.43-52) — table de DR complète, mappée sur le modèle
      // `identified`/`magicKnown`/`suspectedQualities` :
      //   +6 ou plus (Stupéfiant) : identifie parfaitement + TOUTES ses Particularités.
      //   +4 à +5 (Impressionnant) : identifie l'objet et sait s'il a des Particularités.
      //   +2 à +3 (Succès) : identifie l'objet, voit les Particularités visibles (pas les cachées).
      //   0 à +1 (Succès Minime) : identifie l'objet ET découvre UNE Particularité cachée.
      //   0 à -1 (Échec Minime) : incapable d'identifier, conscient de l'échec.
      //   -2 à -3 (Échec) : confond l'artefact avec un type similaire.
      //   -4 à -5 (Échec Impressionnant) : soupçonne UNE Particularité qu'il n'a pas.
      //   -6 ou moins (Échec Stupéfiant) : soupçonne AU MOINS DEUX Particularités qu'il n'a pas.
      const it = (h.items ?? []).find((i) => i.uid === pa.itemUid);
      if (!it) return { lines: [] };
      if (pa.success) {
        it.identified = true; // « le Personnage est capable d'identifier l'objet » (tout succès l'identifie)
        if (isImpressiveSuccess(pa.success, pa.sl)) {
          // +4 ou plus : sait s'il a des Particularités — le Stupéfiant (+6) les révèle TOUTES.
          it.magicKnown = true;
          delete it.suspectedQualities;
          return { lines: [msg(isAstoundingSuccess(pa.success, pa.sl) ? 'if.identifyAstounding' : 'if.identifyImpressive', { name: h.label, item: it.label })] };
        }
        if (pa.sl <= 1) {
          // 0 à +1 (Succès Minime) : identifie l'objet ET découvre UNE Particularité cachée (RAW).
          it.magicKnown = true;
          delete it.suspectedQualities;
          return { lines: [msg('if.identifyMinimal', { name: h.label, item: it.label })] };
        }
        // +2 à +3 : identifie l'objet, connaît les Particularités visibles, pas les cachées.
        return { lines: [msg('if.identifySuccess', { name: h.label, item: it.label })] };
      }
      // Échec : les rangs Impressionnant/Stupéfiant ancrent 1 / au moins 2 FAUSSES Particularités.
      if (isImpressiveFailure(pa.success, pa.sl)) {
        const fakes = falseQualities(it, isAstoundingFailure(pa.success, pa.sl) ? 2 : 1);
        if (fakes.length) {
          it.suspectedQualities = [...new Set([...(it.suspectedQualities ?? []), ...fakes])];
          return { lines: [msg('if.identifyFakes', { name: h.label, item: it.label, fakes: fakes.join(msg('if.fakesJoin')) })] };
        }
        return { lines: [msg('if.identifyConfusedWeek', { name: h.label, item: it.label })] };
      }
      // -2 à -3 (Échec, l.50) : confond l'artefact avec un type d'objet SIMILAIRE (méprise sur sa nature ; pas de fausse Particularité).
      if (pa.sl <= -2) {
        return { lines: [msg('if.identifyConfusedType', { name: h.label, item: it.label })] };
      }
      // 0 à -1 (Échec Minime, l.49) : incapable d'identifier, mais conscient de son échec, sans se tromper sur la nature.
      return { lines: [msg('if.identifyFailAware', { name: h.label, item: it.label })] };
    }
    case 'wrathOfTheGods':
      // « réalisez un Test sur le Tableau de la Colère des Dieux […] à la place » (ACE 12 l.15) —
      // point d'entrée hors-Prière sur la table existante (engine/miscast).
      return { lines: applyMiscast(get, set, h, 'colere') };
    case 'masterWeapon': {
      const it = (h.items ?? []).find((i) => i.uid === pa.itemUid);
      if (!it?.trappingId) return { lines: [] };
      h.masteredWeapons = [...new Set([...(h.masteredWeapons ?? []), it.trappingId])];
      return { lines: [msg('if.masterWeapon', { name: h.label, item: it.label })] };
    }
    case 'identifyByResearch': {
      // ACE 12 l.33-42 : ≥ +4 DR = étude en profondeur (plein potentiel + dangers) ; succès ≤ +3 =
      // fonction principale — mappés sur le modèle EXISTANT identified/magicKnown (comme l'ADE II).
      const it = (h.items ?? []).find((i) => i.uid === pa.itemUid);
      if (!it) return { lines: [] };
      if (pa.sl >= 4) {
        it.identified = true;
        it.magicKnown = true;
        delete it.suspectedQualities;
        return { lines: [msg('if.researchDeep', { name: h.label, item: it.label })] };
      }
      if (pa.success) {
        it.magicKnown = true;
        return { lines: [msg('if.researchMain', { name: h.label, item: it.label })] };
      }
      return { lines: [] };
    }
    case 'memorizeDiscount': {
      if (!pa.spellId) return { lines: [] };
      // « Chaque +DR vous permet de mémoriser un sort pour 100PX de moins […] vous devez acheter le
      // sort immédiatement » (ACE 12 l.55) : remise = DR × 100, appliquée à CET achat seul par buySpell.
      const r = partyBuySpell(get, set, h.id, pa.spellId, { discountXp: Math.max(0, pa.sl) * 100 });
      if (r.ok && r.chaos) return { lines: gainCorruption(get, set, h, 1) }; // sort du Chaos : +1 Corruption (LDB 51)
      return { lines: [] };
    }
    case 'combatTraining': {
      // Entraînement au Combat (LDB 23 l.205-209) : « sur un succès, vous pouvez inverser un Test de
      // la Compétence associée une fois pendant votre prochaine aventure » — jeton d'inversion SCOPÉ
      // (op existant, MÊME canal que « Observer une cible »).
      if (!pa.chosenSkill) return { lines: [] };
      const skillLabel = refLabel('skills', { id: pa.chosenSkill, spec: pa.chosenSkillSpec });
      if (!pa.success) return { lines: [msg('if.combatTrainingKo', { name: h.label, skill: skillLabel })] };
      return { lines: applyOps(h, [{ op: 'grantReverseToken', skill: { id: pa.chosenSkill, ...(pa.chosenSkillSpec ? { spec: pa.chosenSkillSpec } : {}) } }], { rng: battleRng(), label: pa.label, source: activitySource(pa) }) };
    }
    case 'punchausen': {
      // Fabuleuse Vente du comte de Punchausen (AA 12 l.45-49) : « vous recevez 2d10 pistoles et […]
      // vous pouvez inverser les dés sur un Test de Charme ou de Divertissement (Narration) » — même
      // canal de jeton que « Entraînement au Combat », SCOPÉ à la Compétence utilisée pour la vente.
      if (!pa.success || !pa.chosenSkill) return { lines: [msg('if.punchausenKo', { name: h.label })] };
      const pistoles = rollDice(2, 10, battleRng());
      const gain = fromBrass(pistoles * PA_PER_SC);
      // Jeton posé AVANT le crédit : `creditBourse` clone le groupe et capte la mutation de `h`.
      const tokenLines = applyOps(h, [{ op: 'grantReverseToken', skill: { id: pa.chosenSkill, ...(pa.chosenSkillSpec ? { spec: pa.chosenSkillSpec } : {}) } }], { rng: battleRng(), label: pa.label, source: activitySource(pa) });
      creditBourse(get, set, h.id, gain); // revenu PERSO (vente du récit DE ce héros), pas partagé par tête
      return { lines: [msg('if.punchausenOk', { name: h.label, money: formatMoney(gain) }), ...tokenLines] };
    }
    case 'reputation': {
      // Réputation (LDB 23 l.228-234) : coût dépensé DANS TOUS LES CAS ; +1 Standing sur succès (+2 sur
      // Succès Stupéfiant, DR ≥ 6), −1 sur Échec Stupéfiant (DR ≤ −6) — op `statusMod` existant,
      // durée `{scale:'adventure'}` déjà portée par l'op (purgée à l'interlude suivant).
      const lines: string[] = [msg('if.reputationSpend', { name: h.label, money: formatMoney(fromBrass(pa.costBrass ?? 0)) })];
      const delta = isAstoundingSuccess(pa.success, pa.sl) ? 2 : pa.success ? 1 : isAstoundingFailure(pa.success, pa.sl) ? -1 : 0;
      if (delta !== 0) lines.push(...applyOps(h, [{ op: 'statusMod', amount: delta }], { rng: battleRng(), label: pa.label, source: activitySource(pa) }));
      else lines.push(msg('if.reputationWasted', { name: h.label }));
      // Coût débité APRÈS le `statusMod` — l'allocation clone `h` et capte la modification de Statut.
      payWithAllocation(get, set, { debits: soloPayer(h.id, fromBrass(pa.costBrass ?? 0)), recipient: h.id, purpose: 'reputation' });
      return { lines };
    }
    case 'dissensionScout': {
      // Semer la dissension (LDB 23 l.236-248), 1ʳᵉ des DEUX Activités requises : Ragot Accessible
      // pour repérer les personnalités influentes du coin — débloque la 2ᵉ Activité (Charme) CETTE
      // interlude ; aucun effet mécanique en soi (pas de GameOp : la 2ᵉ Activité seule agit).
      if (!pa.success) return { lines: [msg('if.dissensionScoutKo', { name: h.label })] };
      return { lines: [msg('if.dissensionScoutOk', { name: h.label })], patch: { dissensionReady: true } };
    }
    case 'dissensionEmeute': {
      // Semer la dissension, 2ᵉ Activité (Charme) : consomme `dissensionReady` dans TOUS les cas.
      // « Pendant votre prochaine aventure, vous pouvez tenter un Test de Charme pour rassembler une
      // foule contre la même cible » (l.244) — capacité NARRATIVE (aucune Difficulté chiffrée, « fixée
      // par le MJ selon la constitution de la foule ») : AUCUNE Scène de mobilisation de foule n'existe
      // dans le moteur pour porter cet appel à une future Scène — mesuré, non fabriqué (#508).
      if (!pa.success) return { lines: [msg('if.dissensionRiotKo', { name: h.label })], patch: { dissensionReady: false } };
      return {
        lines: [
          msg('if.dissensionRiotOk', { name: h.label }),
          msg('if.dissensionRiotNote', { name: h.label }),
        ],
        patch: { dissensionReady: false },
      };
    }
    case 'contremaitre': {
      // Remaniement du contremaître (AA 12 l.51-61) : Test de Ragot pour localiser l'ancien associé —
      // en cas de succès, tire les TROIS tables du Générateur de mission (l.63-144, `tables.json`).
      // La mission elle-même (Test de Corps à corps/Projectiles Complexe, objet + Blessure Critique
      // HORS dégâts de combat) exigerait une couture « Blessure Critique isolée » absente du moteur
      // (les Blessures Critiques sont posées par la résolution de DÉGÂTS de combat, jamais hors
      // combat) — mesuré, non fabriqué (#510).
      if (!pa.success) return { lines: [msg('if.contremaitreKo', { name: h.label })] };
      const rng = battleRng();
      // Trois tirages de MONDE par la porte du canal (`deMonde`, `engine/dice`) : ils sont la
      // CONSÉQUENCE du Test de Ragot déjà joué et surfacé (`pa`), pas une occasion de pose de plus.
      const lieu = findTableEntry(findEffectTableById('contremaitre-lieu').rows, deMonde(rng));
      const objectif = findTableEntry(findEffectTableById('contremaitre-objectif').rows, deMonde(rng));
      const perso = findTableEntry(findEffectTableById('contremaitre-personnalite').rows, deMonde(rng));
      return {
        lines: [
          msg('if.contremaitreOk', { name: h.label, lieu: ligneNommee(lieu, 'contremaitre-lieu'), objectif: ligneNommee(objectif, 'contremaitre-objectif'), perso: ligneNommee(perso, 'contremaitre-personnalite') }),
          msg('if.contremaitreNote'),
        ],
      };
    }
    // Résolveurs d'interlude SANS branche ici : leur issue est produite en amont (`entrainement` et
    // `mecenat` ont un volet dédié d'`InterludeScreen` ; `knowledgeResearch` est gaté à l'ouverture,
    // son issue vient de ses bandes `outcomes`). Cas ÉNUMÉRÉS, jamais un `default` qui avale.
    case 'entrainement':
    case 'mecenat':
    case 'knowledgeResearch':
      return { lines: [] };
    default: {
      const jamais: never = resolver;
      throw new Error(`résolveur d'interlude non dispatché : ${String(jamais)}`);
    }
  }
}

/** Fausses Particularités (ADE II : échec Impressionnant/Stupéfiant — « soupçonne que l'objet possède
 *  une/au moins deux Particularité(s) qu'il n'a pas réellement ») : Atouts plausibles du registre,
 *  hors qualités réellement portées par l'objet. */
function falseQualities(item: { kind: string; qualities: QualityInstance[]; subType?: string | null; weaponGroup?: string | null }, count: number): string[] {
  const have = new Set(resolveQualities(item).map((r) => r.id)); // qualités RÉELLEMENT portées (propres + de FAMILLE), par id
  const pool = qualities
    .filter((q) => q.polarite === 'atout')
    .filter((q) => (item.kind === 'armor' ? q.subType !== 'arme' : q.subType !== 'armure'))
    .filter((q) => !have.has(q.id)) // dédup par ID (corrige le bug : comparait un libellé à un tableau d'ids)
    .map((q) => q.label);
  const out: string[] = [];
  while (out.length < count && pool.length) {
    const i = (d100(battleRng()) - 1) % pool.length; // tirage registre (biais négligeable — pur cosmétique)
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/** Passer commande (ch.23 l.167-172) : marchandise chiffrée hors du stock ordinaire (`orderBlockOf`,
 *  porte d'entrée PARTAGÉE avec `orderCatalog`) payée MAINTENANT, « achevé après votre prochaine
 *  aventure » (livré à l'ouverture du prochain interlude). 1 objet par Activité. */
export function orderItem(get: Get, set: Set, heroId: string, trappingId: string): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  if (!st || !h || st.left <= 0) return;
  if (refusedBeforeDraw(get, h.label)) return;
  const t = findTrappingById(trappingId);
  if (!t) {
    get().log(msg('if.trappingUnknown', { id: trappingId }));
    return;
  }
  const block = orderBlockOf(t);
  if (block === 'sans-prix') {
    get().log(msg('trade.orderRefused', { reason: outOfTradeReason(t.label) }));
    return;
  }
  if (block === 'stock-ordinaire') {
    get().log(msg('if.orderInShops', { label: t.label, availability: String(t.availability) }));
    return;
  }
  const price = toBrass(priceToMoney(t.price));
  if (!canAfford(bourseOf(h), fromBrass(price))) {
    get().log(msg('if.orderTooExpensive', { cost: formatMoney(fromBrass(price)) }));
    return;
  }
  payWithAllocation(get, set, { debits: soloPayer(heroId, fromBrass(price)), recipient: heroId, purpose: 'commande' });
  set({ pendingOrders: [...(get().pendingOrders ?? []), { heroId, trappingId: t.id }] });
  const itl = get().interlude!;
  itl.perHero[heroId] = { ...st, left: st.left - 1 };
  set({ interlude: { ...itl } });
  get().log(msg('if.orderPlaced', { name: h.label, label: t.label, cost: formatMoney(fromBrass(price)) }));
}
/** Entraînement (ch.23 l.130-136) : « vous entraîner dans une Compétence ou une Caractéristique en
 *  dehors de votre Carrière » — PAS de Test (achat direct comme Passer commande/Banque). Coût en PX
 *  NORMAL (hors carrière, déjà doublé par `advanceCost`/`buyCharAdvance`/`buySkillAdvance`, LDB 07 l.91)
 *  + tuteur 1D10 sc (doublé pour une Compétence Avancée, l.135). `opt` recalculée ICI depuis les
 *  données du héros (`entrainementOptions`) — jamais fait confiance à un id client non revérifié.
 *  Une Compétence de Base hors carrière encore inconnue est ACQUISE à 0 Augmentation puis augmentée
 *  (même geste que `buySkillAdvance`, LDB 09 l.42). */
export function entrainementStart(get: Get, set: Set, heroId: string, kind: 'skill' | 'characteristic', id: string, spec?: string): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  if (!st || !h || st.left <= 0) return;
  if (refusedBeforeDraw(get, h.label)) return;
  const opt = entrainementOptions(h).find((o) => o.kind === kind && o.id === id && (o.spec ?? '') === (spec ?? ''));
  if (!opt) {
    get().log(t('if.entrainementUnknown', { name: h.label }));
    return;
  }
  if ((h.xp ?? 0) < opt.xpCost) {
    get().log(t('if.entrainementXpKo', { name: h.label, cost: opt.xpCost, label: opt.label }));
    return;
  }
  const tutor = toBrass(entrainementTutorCost(opt.advanced, battleRng()));
  if (!canAfford(bourseOf(h), fromBrass(tutor))) {
    get().log(t('if.entrainementTutorKo', { cost: formatMoney(fromBrass(tutor)) }));
    return;
  }
  const fortuneBefore = fortuneMax(h);
  const resolveBefore = resolveMax(h);
  const r = kind === 'characteristic'
    ? engineBuyCharAdvance(h, id as CharKey, false)
    : (() => {
        if (!h.skills.some((k) => k.id === id && (k.spec ?? '') === (spec ?? ''))) {
          h.skills.push({ id: id, spec, characteristic: skillCharacteristicById(id), advances: 0 });
        }
        return engineBuySkillAdvance(h, id, spec, false);
      })();
  if (!r.ok) {
    get().log(t('if.entrainementRefused', { name: h.label, label: opt.label, reason: r.reason ?? '' }));
    return;
  }
  h.wounds.max = heroMaxWounds(h); // Résistance/Endurance : le max de Blessures peut augmenter
  h.wounds.current = Math.min(h.wounds.current, h.wounds.max);
  h.fortune = (h.fortune ?? 0) + (fortuneMax(h) - fortuneBefore); // Sociabilité (Chance/Fortune)
  h.resolve = (h.resolve ?? 0) + (resolveMax(h) - resolveBefore); // Volonté (Résilience/Détermination)
  // Tuteur débité APRÈS les Augmentations : l'allocation clone `h` et capte les avances acquises.
  payWithAllocation(get, set, { debits: soloPayer(heroId, fromBrass(tutor)), recipient: heroId, purpose: 'tuteur' });
  const itl = get().interlude!;
  itl.perHero[heroId] = { ...st, left: st.left - 1 };
  set({ interlude: { ...itl }, party: [...get().party] });
  get().log(t('if.entrainementDone', { name: h.label, label: opt.label, cost: r.cost, tutor: formatMoney(fromBrass(tutor)) }));
}

/** Applique le jet d'Activité confirmé (consomme l'Activité). CHEMIN UNIQUE data-driven :
 *  l'issue vient de la DONNÉE de l'`ActivityDef` — bandes `outcomes`/`onSuccess` (GameOp + `resolver`
 *  de bande) OU `resolver` DIRECT (Revenus/Artisanat/Apprentissage/Identification, sans table). Les
 *  `patch` des résolveurs sont ACCUMULÉS puis fusionnés dans l'unique écriture finale. */
export function confirmActivity(get: Get, set: Set): void {
  const pa = get().pendingActivity;
  if (!pa || pa.roll == null || !pa.activityId) return;
  // Activité/Scène de BATAILLE de masse (ADE II 8) : l'issue porte sur l'ARMÉE (application distincte
  // par `confirmBattleActivity`, canal de jet identique). BUDGET UNIQUE (l.65 : « comme à l'accoutumée,
  // ils ne peuvent participer qu'à un maximum de trois Activités ») : une prépa de bataille EST une
  // Activité d'interlude → elle DÉCRÉMENTE `interlude.perHero[id].left` comme toute Activité. Les Scènes
  // de Round (`battle === 'round'`) sont HORS budget downtime (illimitées par Round) — jamais décomptées.
  if (pa.battle) {
    // Budget partagé (l.65) : une préparation (`'prep'`) EST une Activité d'interlude → refuser en AMONT
    // si le héros n'a plus de créneau (comme le chemin interlude via `st.left <= 0` plus bas), sinon l'issue
    // s'appliquerait « gratuitement » (`consumeActivity` no-op à 0). Les Scènes de Round (`'round'`) hors budget.
    if (pa.battle === 'prep' && (get().interlude?.perHero[pa.heroId]?.left ?? 0) <= 0) {
      set({ pendingActivity: null });
      return;
    }
    set({ pendingActivity: null });
    confirmBattleActivity(get, set, pa);
    if (pa.battle === 'prep') {
      consumeActivity(get, set, pa.heroId);
      // #257 (flag `interlude-assist-costs-activity`, LDB 23 l.5 / ADE II 8 l.65/l.81) : les
      // assistants d'une Entreprise SOUTENUE dépensent aussi un créneau. `consumeActivity` no-op à 0.
      if (rule('interlude-assist-costs-activity')) {
        for (const hid of pa.heroIds ?? []) if (hid !== pa.heroId) consumeActivity(get, set, hid);
      }
    }
    return;
  }
  const itl = get().interlude;
  const st = itl?.perHero[pa.heroId];
  const h = get().party.find((x) => x.id === pa.heroId);
  const def = activityById(pa.activityId);
  set({ pendingActivity: null });
  if (!itl || !st || !h || st.left <= 0 || !def) return;
  const lines: string[] = [];
  const closeOps: GameOp[] = [];
  let patch: Partial<InterludeHeroState> = {};
  // Maladresse d'Activité (LDB 12 : double raté) — porte les bandes `on:'fumble'` (Pénitence :
  // Colère des dieux « à la place », ACE 12 l.15).
  const fumble = isFumble(pa.roll, pa.success);
  // Résolveur DIRECT (pas de table d'issues) : Revenus/Artisanat/Apprentissage/Identification —
  // ils agissent/consomment MÊME sur échec (RAW). Les résolveurs de BANDE restent dans la boucle.
  if (def.resolver && !def.outcomes?.length && !def.onSuccess?.length) {
    const r = runActivityResolver(get, set, def.resolver, pa, h, st);
    lines.push(...r.lines);
    if (r.patch) patch = { ...patch, ...r.patch };
  } else {
    // Défs à TABLE d'issues (bandes de DR) ou binaires (`onSuccess`, ex. Convalescence) — même chemin.
    const bands = def.outcomes?.length
      ? matchOutcomes(def, { success: pa.success, sl: pa.sl, fumble })
      : pa.success && def.onSuccess?.length ? [{ ops: def.onSuccess }] : [];
    if (fumble && def.outcomes?.some((b) => b.on === 'fumble')) lines.push(msg('if.fumble', { name: h.label, roll: String(pa.roll) }));
    for (const band of bands) {
      if (band.note) lines.push(band.note); // résultat VERBATIM de la table source
      // Les ÉTATS d'issue tombent à la CLÔTURE de l'interlude (règle de CLASSE du contexte : les
      // semaines ne s'écoulent qu'à la fermeture, et le repos de clôture dissiperait un État posé
      // maintenant — « vous subissez 1 État Exténué le premier jour de votre prochaine aventure »,
      // ACE 12 l.15). Le reste (Péché, Exposition, soins…) s'applique tout de suite.
      const immediate = (band.ops ?? []).filter((o) => o.op !== 'condition');
      closeOps.push(...(band.ops ?? []).filter((o) => o.op === 'condition'));
      if (immediate.length) {
        lines.push(...applyOps(h, immediate, {
          rng: battleRng(), label: def.label, now: get().gameTime, source: { kind: 'activity', id: def.id }, sl: pa.sl,
          onCorruption: (n: number, align?: ChaosAlign) => gainCorruption(get, set, h, n, align),
          onCorruptionExposure: (level: ExposureLevel, skill?: import('../engine/skills').SkillRef) => {
            // LA PORTE du slot (#1282) : un Test de Corruption déjà affiché ne se fait plus écraser — celui-ci prend rang.
            poseCorruptionPending(get, set, { heroId: h.id, level, skill: testDeCorruption(skill), skillLocked: skill != null, menace: 'corruption' });
            return [msg('if.corruptionTest', { name: h.label, level })];
          },
        }));
      }
      if (band.payoutPct != null && pa.depositIndex != null) lines.push(...mecenatPayout(get, set, h, pa.depositIndex, band.payoutPct));
      if (band.resolver) {
        const r = runActivityResolver(get, set, band.resolver, pa, h, st);
        lines.push(...r.lines);
        if (r.patch) patch = { ...patch, ...r.patch };
      }
    }
  }
  // SEAM `onOwnTestFailed` (chemin JOUEUR hors combat — Activité d'interlude) : un Test d'Activité RATÉ émet
  // le trigger (Crampes abdominales : rate l'Artisanat → Sonné, MSRC 16 l.152). AVANT l'écriture UNIQUE : les
  // mutations Sonné (palier 1/3) sont captées par l'écriture party ci-dessous, aucun set brut de plus.
  // CADENCE-AWARE : `set` threadé → le sous-Test de FM (palier 2) d'un héros s'ouvre en MODALE de jet scène
  // (`routeTriggeredTest` hors combat), jamais inline (« un jet = une modale » vaut hors combat) ; la modale
  // ouverte ici SURVIT à l'écriture interlude/party finale (clés disjointes). PNJ/auto → inline (early-out sinon).
  if (!pa.success) lines.push(...fireOwnTestFailed(get, pa.heroId, { sl: pa.sl, rng: battleRng(), set }));
  // Écriture UNIQUE : consomme l'Activité + fusionne closeOps différés + patch des résolveurs.
  itl.perHero[pa.heroId] = {
    ...st,
    left: st.left - 1,
    ...(closeOps.length ? { closeOps: [...(st.closeOps ?? []), ...closeOps] } : {}),
    ...patch,
  };
  set({ interlude: { ...itl }, party: [...get().party] });
  for (const l of lines) get().log(l);
  // DÉS DE MONDE de l'Activité (`worldRolls`) — APRÈS l'écriture : ce que l'environnement roule sur
  // l'acteur une fois son Test résolu (« surpris à mendier par ses pairs », LDB 09 l.99). Bâtis par la
  // PORTE (`worldStep`), donc fixables ; un acteur exempté n'a aucune étape (rien ne se tire).
  const worldSteps = buildActivityWorldRollSteps(def, h);
  if (worldSteps.length) startCascade(get, set, { title: def.label, icon: def.icon, purpose: 'interlude', steps: worldSteps });
}

/** Opérations bancaires (ch.23 l.154-165) — dépôt (1 Activité). Invest : Statut Or/Argent.
 *  `mecenat` (ACE 12 l.49) : variante d'Opération bancaire — « au moins 5 CO » (minInvest de
 *  la donnée), gate géographique de l'Activité ; le retrait se résout par un Test d'Évaluation. */
export function bankDeposit(get: Get, set: Set, heroId: string, kind: 'invest' | 'stash' | 'mecenat', amountBrass: number, rate?: number): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  if (!st || !h || st.left <= 0) return;
  if (refusedBeforeDraw(get, h.label)) return;
  if (kind === 'invest' && heroStatus(h).tier === 'bronze') {
    get().log(msg('if.bankTierKo', { name: h.label }));
    return;
  }
  if (kind === 'mecenat') {
    const def = ACTIVITIES.find((a) => a.resolver === 'mecenat');
    if (!def || !activityAvailableAt(def, currentPlaceId(get()))) return;
    const min = toBrass(toMoney(def.minInvest ?? {}));
    if (Math.floor(amountBrass) < min) {
      get().log(msg('if.mecenatMin', { min: formatMoney(fromBrass(min)) }));
      return;
    }
  }
  const amount = Math.max(1, Math.floor(amountBrass));
  if (!canAfford(bourseOf(h), fromBrass(amount))) {
    get().log(msg('if.depositPurseKo', { name: h.label }));
    return;
  }
  let deposited = amount;
  const lines: string[] = [];
  // Fausse monnaie (LDB 22) : « perdront 20 % de l'argent placé ».
  if (st.fx?.bankPct) {
    deposited = Math.max(0, Math.floor((deposited * (100 + st.fx.bankPct)) / 100));
    lines.push(msg('if.eventBankPct', { pct: st.fx.bankPct, event: eventLabelOf(st) }));
  }
  const r = kind === 'invest' ? Math.max(1, Math.min(10, rate ?? d100(battleRng()) % 10 + 1)) : 0;
  payWithAllocation(get, set, { debits: soloPayer(heroId, fromBrass(amount)), recipient: heroId, purpose: 'dépôt-banque' });
  set({ bank: [...(get().bank ?? []), { heroId, kind, brass: deposited, rate: r }] });
  const itl = get().interlude!;
  itl.perHero[heroId] = { ...st, left: st.left - 1 };
  set({ interlude: { ...itl } });
  lines.push(msg(
    kind === 'invest' ? 'if.bankInvest' : kind === 'mecenat' ? 'if.bankMecenat' : 'if.bankStash',
    { name: h.label, money: formatMoney(fromBrass(deposited)), rate: r },
  ));
  // Émeutes (LDB 22) : « les dépôts des banques réputées doivent vérifier immédiatement la faillite ».
  if (kind === 'invest' && st.fx?.bankCrashCheck) {
    lines.push(...bankWithdrawInner(get, set, get().bank.length - 1, true));
  }
  for (const l of lines) get().log(l);
}

/** Retrait (invest : coûte 1 Activité, « Retirer des fonds nécessite une autre Activité » l.157 ;
 *  planque : libre, l.159). Le d100 est journalisé (résolution directe — pas un Test de compétence). */
export function bankWithdraw(get: Get, set: Set, index: number): void {
  const dep = (get().bank ?? [])[index];
  if (!dep) return;
  if (refusedBeforeDraw(get, libelleOuAbsence(get().party.find((x) => x.id === dep.heroId), 'heros', dep.heroId))) return;
  if (dep.kind === 'mecenat') {
    // Retrait de Mécénat (ACE 12 l.49) = 1 Activité résolue par un Test d'Évaluation Intermédiaire :
    // la modale d'Activité applique la bande (payoutPct) et consomme l'Activité à la validation.
    const def = ACTIVITIES.find((a) => a.resolver === 'mecenat');
    if (def) openCatalogActivity(get, set, dep.heroId, def.id, { depositIndex: index });
    return;
  }
  if (dep.kind === 'invest') {
    const st = heroState(get(), dep.heroId);
    if (!st || st.left <= 0) {
      get().log(msg('if.withdrawNeedsActivity'));
      return;
    }
    const itl = get().interlude!;
    itl.perHero[dep.heroId] = { ...st, left: st.left - 1 };
    set({ interlude: { ...itl } });
  }
  for (const l of bankWithdrawInner(get, set, index, false)) get().log(l);
}

function bankWithdrawInner(get: Get, set: Set, index: number, crashCheckOnly: boolean): string[] {
  const dep = (get().bank ?? [])[index];
  if (!dep || dep.kind === 'mecenat') return []; // Mécénat : soldé par le Test d'Évaluation (bande payoutPct)
  const h = get().party.find((x) => x.id === dep.heroId);
  const roll = d100(battleRng());
  // Planque de Carte marine (MDG 15 l.292) : « en sûreté tant que vous gardez la carte » → tant que le
  // dépositaire PORTE encore une carte-marine, le trésor n'est pas à découvert ; il ne l'est (jet ≤ rate)
  // que si la carte est perdue/volée.
  const chartHeld = !!h?.items?.some((it) => it.trappingId === 'carte-marine');
  const outcome = dep.chartSecured && chartHeld ? 'ok' : bankWithdrawOutcome(dep.kind, dep.rate, roll);
  const rest = (get().bank ?? []).filter((_, i) => i !== index);
  if (outcome === 'lost') {
    set({ bank: rest });
    const threshold = dep.kind === 'invest' ? dep.rate : (dep.rate > 0 ? dep.rate : 10);
    return [msg('if.bankLost', {
      name: libelleOuAbsence(h, 'heros', dep.heroId), roll, threshold,
      what: msg(dep.kind === 'invest' ? 'if.bankFailBank' : 'if.bankFailStash'),
      money: formatMoney(fromBrass(dep.brass)),
    })];
  }
  if (crashCheckOnly) return [msg('if.bankCrashOk', { roll, rate: dep.rate })];
  const payout = bankPayout(dep.kind, dep.brass, dep.rate);
  set({ bank: rest });
  creditBourse(get, set, dep.heroId, fromBrass(payout)); // retrait PERSONNEL : recrédité au déposant
  return [msg('if.bankWithdraw', {
    name: libelleOuAbsence(h, 'heros', dep.heroId), money: formatMoney(fromBrass(payout)), roll,
    extra: dep.kind === 'invest' ? msg('if.bankInterest', { rate: dep.rate }) : '',
  })];
}

/** Clôture : « Avec le pouvoir » (Niveaux 3-4 sans Revenus → −1 Niveau, ch.23 l.30), Argent à
 *  gaspiller (l.14), crédit des Revenus (l.179), puis le temps passe (repos standard). */
export function interludeEnd(get: Get, set: Set): void {
  const itl = get().interlude;
  if (!itl) return;
  // Issues d'Activité DIFFÉRÉES (« le premier jour de votre prochaine aventure », ACE 12 l.15) —
  // capturées avant de fermer, appliquées APRÈS le repos de clôture (cf. plus bas). On mémorise
  // l'ID (pas la référence) : l'Argent à gaspiller ré-instancie les bourses (clone), le héros est
  // re-résolu au moment de l'application.
  const deferred = get().party
    .map((h) => ({ id: h.id, dead: h.dead, ops: itl.perHero[h.id]?.closeOps ?? [] }))
    .filter((x) => x.ops.length > 0 && !x.dead);
  const lines: string[] = [];
  for (const h of get().party) {
    const st = itl.perHero[h.id];
    if (!st) continue;
    if ((h.careerLevel ?? 1) >= 3 && !st.didRevenus) {
      h.careerLevel = (h.careerLevel ?? 1) - 1;
      lines.push(msg('if.careerDemotion', { name: h.label, level: h.careerLevel }));
    }
  }
  const wastedBefore = partyMoneyTotal(get);
  if (toBrass(wastedBefore) > 0) {
    lines.push(msg('if.moneyWasted', { money: formatMoney(wastedBefore) }));
  }
  let revenue = 0;
  for (const h of get().party) revenue += itl.perHero[h.id]?.revenueBrass ?? 0;
  // Chaque bourse est REMISE à son revenu de période (arbitrage user 2026-07-20, #531) : le solde
  // antérieur est gaspillé individuellement, le revenu perso crédité — plus aucune bourse commune.
  for (const h of get().party) {
    const prior = bourseOf(h);
    if (toBrass(prior) > 0) debitBourse(get, set, h.id, prior);
    const rev = itl.perHero[h.id]?.revenueBrass ?? 0;
    if (rev > 0) creditBourse(get, set, h.id, fromBrass(rev));
  }
  if (revenue > 0) lines.push(msg('if.revenueAvailable', { money: formatMoney(fromBrass(revenue)) }));
  // Faveurs (LDB 23 l.149, #509) : la « consécutivité » se mesure à l'interlude — granularité posée
  // par `Favor.progress` (`favorFlow.ts`), reset AVANT de refermer l'interlude, pendant qu'il est
  // encore lisible.
  resetInterruptedFavorProgress(get, set);
  set({ interlude: null, screen: 'campaign', party: [...get().party] });
  for (const l of lines) get().log(l);
  // Le temps de l'interlude s'écoule (récupération, convalescence, horloge — moteur de nuit
  // unique). `fedDaily` : la vie en ville (gîte ET couvert) est couverte par l'Argent à
  // gaspiller — la Faim RAW ne s'applique pas à la période (LDB 23, « le coût de la vie »).
  sleepParty(get, set, itl.weeks * 7, { fedDaily: true });
  // Issues DIFFÉRÉES à la clôture (États « le premier jour de votre prochaine aventure », ACE 12 l.15) :
  // posées APRÈS le repos de clôture — un État posé avant serait dissipé par la récupération.
  if (deferred.length) {
    const after: string[] = [];
    for (const { id, ops } of deferred) {
      const h = get().party.find((x) => x.id === id);
      if (h) after.push(...applyOps(h, ops, { rng: battleRng(), now: get().gameTime }));
    }
    set({ party: [...get().party] });
    for (const l of after) get().log(l);
  }
  // Bataille en attente de préparation à la clôture de l'interlude (ADE II 8) : la fin de l'interlude
  // ENGAGE la bataille (transition vers les Rounds avec les bonus de prépa acquis). `massBattleBegin`
  // rebascule sur l'écran de bataille. Une bataille sans prépa faite démarre au Round 1 sans bonus.
  if (get().massBattle?.phase === 'prep') {
    massBattleBegin(get, set);
    set({ screen: 'massBattle' });
  }
}

/** Le libellé d'une ligne de table DESCRIPTIVE (le contremaître) : une ligne muette y est un défaut de donnée (#1906). */
function ligneNommee(ligne: { label?: string }, table: string): string {
  const { label } = ligne;
  if (label === undefined) throw new Error(`[${table}] ligne sans libellé dans une table descriptive (#1906)`);
  return label;
}
