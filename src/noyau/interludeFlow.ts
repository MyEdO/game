/**
 * « Entre deux aventures » (LDB 22-23 — Jalon 5) : flux d'interlude.
 *
 * Séquence : Événements (LDB 22 l.5), Activités (LDB 23 l.5), pertes d'argent des Événements
 * (`pertesDArgentDuTirage`), clôture (`devisDeCloture` ; LDB 23 l.15, l.191).
 */
import type { Jeu } from './etat';
import type { CloturesDuJet } from './rollFlowSpecs';
import { garanti } from '../lib/garanti';
import { battleRng } from './battleRng';
import { d10, d100, roll, rollDice } from '../engine/dice';
import { isImpressiveSuccess, isImpressiveFailure, isAstoundingSuccess, isAstoundingFailure } from '../engine/tests';
import { INTERLUDE_EVENTS, interludeEventDie, interludeEventFor, type InterludeEventFx } from '../data/interludeEvents';
import { startCascade } from './cascade';
import { freeCons } from './rollSeam';
import { type RollLineParts } from './ligneDeJet';
import type { CascadeStep, CascadeTableDecl } from './pendings';
import { fromBrass, toBrass, formatMoney, priceToMoney, PA_PER_SC } from '../engine/money';
import { payWithAllocation, soloPayer, creditBourse, debitBourse, refusDeBourse } from './bourseFlow';
import { contexteDeNaissanceDObjet, itemFromTrappingRef, itemFromTrappingById, recomputeLoadout, autoStowNewItem } from '../engine/items';
import type { IdDeDepot } from './designations';
import { sleepParty } from './restFlow';
import { purgeAdventureEffects } from './upkeep';
import { refuseSi } from './verrousDeFiche';
import { progresDActivite } from './progresEtendu';
import { refuserGeste } from './refusVisible';
import {
  brouillonDe, ciblesDActivite, devisDeDepot, poserDansLeBrouillon, optionDEntrainement, refusDActivite,
  refusDeCommande, refusDeConfirmerLActivite, refusDeRetrait, opsCiblees, viseDuTrait, preJetDActivite, devisDeCloture, pertesDArgentDuTirage, effetsDeLaPeriode, revenusDeLaPeriode, activitesPerduesAuGroupe, verificationDeFaillite, type AxeDuBrouillon, type CiblesChoisies, type CompositionDActivite, type TraitPsyVise,
} from './verdictsDInterlude';
import { resetInterruptedFavorProgress } from './favorFlow';
import { confirmBattleActivity, engagerLaBataille, battlePrepEntries, soutienCouteUneActivite } from './massBattleFlow';
import {
  craftTarget, craftSpecOf, metierOf, qualitesDArtisanat, statusIncome, statusIncomeMax, bankWithdrawOutcome, seuilDePerteBancaire, bankPayout, apprenticeshipTutorCost,
  entrainementTutorCost,
  ACTIVITIES, activitiesFor, activityById, learnOptionOf, matchOutcomes, activityAvailableAt,
  RESOLVER_OWNER,
  type ActivityDef, type ActivityResolver, type GenreDeDepot, type ResolverOf,
} from '../engine/activities';
import { buildActivityWorldRollSteps } from './activityWorldRolls';
import { actorStatus } from '../engine/social';
import { applyOps, gelerOpsCtx, reussiteSansObjet, type GameOp, type OpsCtxGele } from '../engine/ops';
import { isFumble } from '../engine/oups';
import { ritualReduction } from '../engine/grimoire';
import { focusSkillFor, consumeMalepierre } from '../engine/magic';
import { gainCorruption, poseCorruptionPending, expositionPending } from './corruptionFlow';
import { fireOwnTestFailed } from './triggeredEffects';
import { applyMiscast } from './combatFlow';
import { acheterLeSort as partyBuySpell, depenserPx } from './partyFlow';
import type { SupportDetail } from '../engine/skills';
import { rule } from '../engine/policy';
import { groupsFor } from '../engine/groups';
import type { ChaosAlign, ExposureLevel } from '../engine/corruption';
import type { NatureDInfluence } from '../data/schemas/grammaire/valeurs';
import { buyTalent as engineBuyTalent, buySkillAdvance as engineBuySkillAdvance, buyCharAdvance as engineBuyCharAdvance } from '../engine/advancement';
import { skillCharacteristicById } from '../engine/character';
import { applyTalentAcquisition, fortuneMax, resolveMax } from '../engine/talentEffects';
import { findTrappingById, findTalentById, findSpellById, refLabel, skillInstanceLabel, qualityRefLabel, qualities, combatStakeRef, libelleOuAbsence, testSkillLabel } from '../data';
import { effectTableDie, findEffectTableById } from '../data/effectTables';
import { findTableEntry } from '../engine/tables';
import { type CharKey, type Combatant, type Difficulty, type QualityInstance } from '../engine/types';
import { resolveQualities } from '../engine/qualities/dispatch';
import type { PendingBase } from './rollFlowFactory';
import { t, t as msg } from '../i18n'; // `msg` : alias local — `t` est aussi le nom d'un trapping résolu dans plusieurs flux

import type { Get, Set } from './flowTypes';
import type { EffectSource } from '../engine/types';
import { dataLabel } from '../data';
import { stepDetail } from './rollSeam';
import { memeSpecialisation, type RefDesignee } from '../data/schemas/grammaire/ref';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { ValidationsDeFenetre } from './validationDeFenetre';
import type { CorpsDesChoix } from './choixDesFenetres';
import type { FragmentDeTables, PartDeTable } from './tablesPosees';

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
   *  (noyau/favorFlow) : sans emplacement possible, aucune chaîne de Faveur ne casse. */
  granted: number;
  /** Devoir elfique APPLIQUÉ (règle optionnelle `interlude-devoir-elfique` active + elfe + ≥3 semaines) —
   *  source UNIQUE de la conséquence : l'UI rend ce drapeau, elle ne re-dérive jamais la règle. */
  elfDuty?: boolean;
  /** A entrepris Revenus — maintient les Niveaux 3-4 (« Avec le pouvoir », LDB 23 l.33). */
  didRevenus?: boolean;
  /** Gains de Revenus, crédités APRÈS le gaspillage (LDB 23 l.191) — en sous de cuivre. */
  revenueBrass: number;
  /** « +10 pour chaque tentative ratée » d'Apprentissage particulier (LDB 23 l.72), par talent. */
  learnFails?: Record<string, number>;
  /** Issues d'Activité DIFFÉRÉES à la clôture (États « le premier jour de votre prochaine aventure »,
   *  ACE 12 l.15 ; Standing de Réputation, LDB 23 l.234) — appliquées par `cloreLInterlude` APRÈS le repos de
   *  clôture (un État posé avant serait dissipé par la récupération des nuits écoulées). */
  closeOps?: LotDeCloture[];
  /** Semer la dissension (LDB 23 l.236-248) : le Test de Ragot (1ʳᵉ des DEUX Activités requises) a
   *  identifié les personnalités influentes du coin — débloque la 2ᵉ Activité (Test de Charme) DANS
   *  CET interlude. Consommé (remis à `false`) à l'issue de la 2ᵉ Activité, succès ou échec. */
  dissensionReady?: boolean;
  /** Faveurs (LDB 23 l.139-151, #509) déjà créditées d'une Activité CET interlude — trace la
   *  « consécutivité » (`Favor.progress`) pour `resetInterruptedFavorProgress` (noyau/favorFlow). */
  favorProgress?: string[];
  /** L'Activité que le héros compose (`fenetreChoisir('interlude', …)`), que le choix `pratiquer` conclut. */
  composition?: CompositionDActivite;
}

/** Un lot d'issues différées à la clôture, et le contexte gelé de l'Activité qui l'a produit (libellé,
 *  source, DR) : la clôture l'applique sous ce contexte. */
export interface LotDeCloture {
  ops: GameOp[];
  ctx: OpsCtxGele;
}

export interface InterludeState {
  weeks: number;
  /** `'tirage'` (#942 L7) : les dés d'Événement restent à poser (séquence `purpose:'interlude'`) — les
   *  Activités n'ouvrent qu'au dénouement du dernier dé. */
  phase: 'tirage' | 'activities';
  /** Reconstruit à neuf à chaque ouverture d'interlude (`ouvrirLInterlude`) : aucun état de progression
   *  LONGUE (Artisanat/Rituel en cours) n'y vit — celle-ci est portée par `Combatant.craft`/`Combatant.ritual`
   *  (`engine/types.ts`), qui survit à la clôture. */
  perHero: Record<string, InterludeHeroState>;
}

/** Dépôt bancaire (Opérations bancaires, LDB 23 l.164-176 ; `mecenat` = variante d'ACE 12 l.45-49,
 *  retrait résolu par un Test d'Évaluation Intermédiaire) — survit aux interludes et aventures. */
export interface BankDeposit {
  /** Son identité, posée au dépôt. */
  uid: string;
  heroId: string;
  kind: GenreDeDepot;
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

/** Le dé de la table (`interludeEventDie`), sans modificateur : le dé NATUREL est le dé du lookup —
 *  c'est aussi ce que `perHero.eventRoll` persiste, et donc ce que tout lecteur re-résout. */
const interludeEventDecl = (): CascadeTableDecl => ({ tableId: INTERLUDE_EVENT_TABLE });

/** La séquence des tirages est SA propre séquence (`purpose:'interlude'`, doctrine du slot #942 L1) :
 *  l'interlude ne s'ouvre jamais en combat, et aucun autre `purpose` hors-combat ne doit y fusionner. */
const INTERLUDE_PURPOSE = 'interlude' as const;

/** Étape à TABLE de l'Événement d'UN héros (dé à poser) — une par héros, dans l'ordre du groupe. */
function eventStep(hero: Combatant): CascadeStep {
  return {
    id: `interlude-event-${hero.id}`,
    kind: 'evenementDInterlude', actorId: hero.id, icon: 'navigation/des',
    label: t('step.evenement'),
    table: interludeEventDecl(),
    stake: combatStakeRef('interlude-evenement'),
  };
}

/** Étape FINALE de la séquence : le dénouement de GROUPE (bourses), après TOUS les dénouements par
 *  héros (`pertesDArgentDuTirage`). */
function purseStep(): CascadeStep {
  return {
    id: 'interlude-purse',
    kind: 'bourseDInterlude', icon: 'ressource/bourse',
    label: t('step.bourseDInterlude'),
  };
}

/** Ouvre l'interlude : événements tirés et appliqués, commandes livrées, écran dédié. */
export function ouvrirLInterlude(get: Get, set: Set, weeks = 1): void {
  if (!rule('interlude-actif')) return; // LDB 21 l.108
  if (get().battle) {
    get().ecrireAuJournal(msg('if.inCombat'));
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
  // Passer commande (LDB 23 l.182) : « L'objet sera achevé après votre prochaine aventure » —
  // les commandes du cycle précédent sont livrées à l'ouverture de CET interlude.
  for (const o of get().pendingOrders ?? []) {
    const hero = party.find((h) => h.id === o.heroId);
    const it = hero ? itemFromTrappingById(o.trappingId, get().forgerUnId, undefined, contexteDeNaissanceDObjet(hero)) : null;
    if (hero && it) {
      hero.items = [...(hero.items ?? []), it];
      autoStowNewItem(hero, it); // #204 : rangement par défaut
      recomputeLoadout(hero);
      lines.push(msg('if.orderDelivered', { name: hero.label, label: trappingLabelOf(o.trappingId) }));
    }
  }
  const baseLeft = Math.min(3, w); // « 1/semaine, max 3 » (LDB 23 l.5)
  const perHero: Record<string, InterludeHeroState> = {};
  for (const h of party) perHero[h.id] = { left: baseLeft, granted: baseLeft, revenueBrass: 0 };
  set({ interlude: { weeks: w, phase: 'tirage', perHero }, bank: get().bank ?? [], pendingOrders: [], screen: 'interlude' });
  for (const l of lines) get().ecrireAuJournal(l);
  // Le dé d'Événement de CHAQUE héros est une étape à TABLE, poussée NON RÉSOLUE (#1426) : aucun
  // effet ne lui est appliqué avant que SON dé ne tombe, et il tombe au RANG de l'étape (jamais à
  // l'appel). Ce qu'il advient de l'étape appartient au socle (`cascade.poserLeCurseur`) : une
  // fenêtre pour le siège qui tient le héros, une résolution d'office si nul siège ne le tient — et
  // l'option « Dés fixés » n'y ajoute que la POSE. Le dénouement de GROUPE ferme la séquence.
  const steps: CascadeStep[] = party.map(eventStep);
  startCascade(get, set, { title: msg('if.drawTitle'), icon: 'navigation/des', purpose: INTERLUDE_PURPOSE, steps: [...steps, purseStep()] });
  set({ party: [...get().party] });
}

/** DÉNOUEMENT d'un Événement pour UN héros, appelé par l'applier de son étape. Le dé est l'autorité : il est persisté (`eventRoll`) et re-résolu par `interludeEventFor`,
 *  la même lecture que les Activités en aval. Renvoie les lignes de journal. */
function finishInterludeEvent(get: Get, set: Set, hero: Combatant, roll: number): string[] {
  const itl = get().interlude;
  const st = itl?.perHero[hero.id];
  if (!itl || !st) return [];
  const ev = structuredClone(interludeEventFor(roll)); // #2097
  const lines: string[] = [msg('if.eventLine', { name: hero.label, roll, label: ev.label, text: ev.desc })];
  let left = st.left;
  if (ev.fx?.loseActivity && !ev.fx.partyWide) left -= 1; // l'Événement de groupe ôte au dénouement de groupe
  // LDB 23 l.56 ; règle optionnelle `interlude-devoir-elfique` (LDB 23 l.54).
  const elfDuty = rule('interlude-devoir-elfique') && groupsFor({ speciesId: hero.species }).includes('elfe') && itl.weeks >= 3;
  if (elfDuty) {
    left -= 1;
    lines.push(msg('if.elfDuty', { name: hero.label }));
  }
  if (ev.fx?.fortuneMaxDelta) {
    hero.fortune = (hero.fortune ?? 0) + ev.fx.fortuneMaxDelta;
    lines.push(msg('if.fortuneOmen', { name: hero.label, n: ev.fx.fortuneMaxDelta }));
  }
  let bank = get().bank ?? [];
  if (ev.fx?.stashRaided && bank.some((b) => b.heroId === hero.id && b.kind === 'planque')) {
    bank = bank.filter((b) => !(b.heroId === hero.id && b.kind === 'planque'));
    lines.push(msg('if.stashRaided', { name: hero.label }));
  }
  itl.perHero[hero.id] = { ...st, eventRoll: roll, fx: ev.fx, left: Math.max(0, left), granted: Math.max(0, left), ...(elfDuty && { elfDuty }) };
  set({ interlude: { ...itl }, bank, party: [...get().party] });
  return lines;
}

/** Le DÉNOUEMENT de GROUPE du tirage, lu sur l'état une fois TOUS les dés tombés : les pertes d'argent,
 *  les Activités qu'ôtent les Événements de groupe, et si les placements en banque vérifient leur
 *  faillite. Lu par l'annonce de l'étape et par son application. LDB 22 l.36, l.111, l.115, l.123 */
function denouementDuTirage(s: Jeu) {
  const heros = Object.keys(s.interlude?.perHero ?? {});
  return {
    pertes: pertesDArgentDuTirage(s),
    perdues: heros.map((heroId) => ({ heroId, effets: activitesPerduesAuGroupe(s, heroId) })).filter((p) => p.effets.length),
    faillite: heros.some((heroId) => verificationDeFaillite(s, heroId)) && (s.bank ?? []).some((d) => d.kind === 'investir'),
  };
}

/** Les lignes des pertes du dénouement `d` : l'argent, puis les Activités. */
function lignesDesPertes(s: Jeu, d: ReturnType<typeof denouementDuTirage>): string[] {
  const nom = (heroId: string) => libelleOuAbsence(s.party.find((h) => h.id === heroId), 'heros', heroId);
  return [
    ...d.pertes.map(({ heroId, pct, brass }) => msg('if.purseLoss', { name: nom(heroId), pct, money: formatMoney(fromBrass(brass)) })),
    ...d.perdues.flatMap(({ heroId, effets }) => effets.map(({ label }) => msg('if.groupActivityLost', { name: nom(heroId), event: label }))),
  ];
}

/** Le dénouement appliqué, puis les Activités ouvrent (`phase`, verdict `refusDuTirage`). Commun aux deux
 *  chemins (dernier maillon : après tous les dénouements par héros). */
function finishInterludeDraw(get: Get, set: Set): string[] {
  const itl = get().interlude;
  if (!itl) return [];
  const d = denouementDuTirage(get());
  const lines = lignesDesPertes(get(), d);
  for (const { heroId, brass } of d.pertes) debitBourse(get, set, heroId, fromBrass(brass));
  const perHero = { ...itl.perHero };
  for (const { heroId, effets } of d.perdues) {
    const left = Math.max(0, perHero[heroId].left - effets.length);
    perHero[heroId] = { ...perHero[heroId], left, granted: left };
  }
  set({ interlude: { ...get().interlude!, perHero } });
  if (d.faillite) {
    for (const dep of [...(get().bank ?? [])].reverse()) {
      if (dep.kind === 'investir') lines.push(...bankWithdrawInner(get, set, dep.uid, true));
    }
  }
  set({ interlude: { ...get().interlude!, phase: 'activities' } });
  return lines;
}

// ── Activités (LDB 23) — flux de jet par modale (fabrique rollFlow) ────────────────────────────

/** Grandeurs d'un Test OPPOSÉ d'Activité — Scène « Tenez votre position » (ADE II 8 l.161-163) —
 *  POSÉES D'UN BLOC à l'ouverture : `enemyValue` = cible du jet ennemi (bonus cumulatif de tenue
 *  l.163 déjà fondu), `enemyRoll` = son d100 FIGÉ, et les DEUX valeurs NUES que `resolveOpposed`
 *  compare à DR égal (LDB 12 l.160) — `enemyBase` (Puissance de l'armée) et `skillBase` (Niveau de
 *  Compétence du PJ, `LDB 09 l.17`, ni États ni Encombrement ni Soutien : la valeur que
 *  `skillBaseValue` calcule, JAMAIS une soustraction faite au site de lecture).
 *  Le TYPE porte le couplage : ces champs ne se posent qu'ENSEMBLE, ou aucun. Les deux nues restent
 *  optionnelles (un pending qui n'en porte pas → repli deux-cibles d'`openValues`).
 *  Forme PLATE parce que ces champs sont SÉRIALISÉS dans le snapshot de partie (`persistance/save.ts`). */
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
  /** Ligne du Test montée à l'ouverture (`rollLine` : pré-jet d'Activité, Test de bataille) — lue par la fenêtre. */
  ligne: RollLineParts;
  roll: number | null;
  target: number;
  sl: number;
  success: boolean;
  /** Test étendu (Artisanat/Rituel) : progression (avant ce jet) et cible. */
  drBefore?: number;
  drTarget?: number;
  /** Rituel (`VDM 02 l.377-393`) : id du Sort focalisé CE Round — branche `resolve` de `FLOWS.activite`
   *  (`noyau/rollFlowSpecs.ts`) vers `resolveFocus` (`engine/magic.ts`) au lieu du Test simple générique. */
  ritualSpell?: string;
  /** DR bonus consommé par la malepierre CE Round (`FocusResult.malepierreConsumed`) — écrit à la
   *  résolution (`consumeMalepierre`), comme le chemin de combat (`combatFlow.ts` `applyCast`). */
  malepierreConsumed?: number;
  /** Apprentissage particulier (LDB 23 l.66-72) : `id` STABLE du talent visé + coûts (débités MÊME sur échec). */
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
  /** Retrait de Mécénat (ACE 12 l.49) : le dépôt `bank` soldé par le Test d'Évaluation. */
  depotId?: IdDeDepot;
  /** Convalescence (ADE II 09 l.33) : la visée du Trait psychologique « de votre choix » à éliminer
   *  (`viseDuTrait`). */
  traitPsy?: TraitPsyVise;
  // ── Activité/Scène de BATAILLE de masse (ADE II 8 — contextes 'bataille'/'bataille-round') ──
  /** Activité de bataille : l'issue (delta de Puissance / modificateur de Test) porte sur l'ARMÉE, pas
   *  sur le héros — routée par `jetValider('activite')` vers le résolveur de bataille. `prep` = Activité de
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
  forcee?: boolean;
  /** Coût en sous de cuivre engagé par CETTE Activité (Réputation, LDB 23 l.228-234 : « le maximum de
   *  vos revenus standards », dépensé MÊME sur échec — calculé à l'ouverture, débité à la résolution). */
  costBrass?: number;
  /** Compétence du Test retenue par le pré-jet (`preJetDActivite`) ou par l'ouverture d'un Test de
   *  bataille : l'Entraînement au Combat (LDB 23 l.205-209) en SCOPE son jeton d'inversion, l'inversion
   *  (LDB 12 l.42) la lit, la modale en décompose la valeur. */
  chosenSkill?: RefDesignee;
}

const heroState = (s: Jeu, heroId: string) => s.interlude?.perHero[heroId];

/** Ancrage de regle des effets d'une Activite d'interlude — l'`ActivityDef` du catalogue
 *  (`activities.json`), par id STABLE. Absent quand la demande n'en porte pas : on n'en fabrique pas. */
const activitySource = (pa: PendingActivity): EffectSource | undefined =>
  (pa.activityId ? { kind: 'activite', id: pa.activityId } : undefined);

/** Décrémente le budget d'Activités d'un héros (`interlude.perHero[id].left`) — SOURCE UNIQUE du budget
 *  de downtime (LDB 23 l.5 / ADE II 8 l.65). No-op si aucun interlude / budget épuisé. */
export function consumeActivity(get: Get, set: Set, heroId: string): void {
  const itl = get().interlude;
  const st = itl?.perHero[heroId];
  if (!itl || !st || st.left <= 0) return;
  itl.perHero[heroId] = { ...st, left: st.left - 1 };
  set({ interlude: { ...itl } });
}

/** Libellé d'affichage d'un trapping de catalogue par id (repli sur l'id). */
const trappingLabelOf = (id: string): string => findTrappingById(id)?.label ?? id;
/** Libellé d'affichage d'une qualité runtime (id → label, ex. « solide » → « Solide »). */
const craftQualLabel = (id: string): string => qualityRefLabel({ id });

/** Engage un Artisanat : Compétence Métier, matériaux payés avant l'Activité ; l'engagement n'en consomme
 *  aucune (verdict `refusDArtisanat`, que juge le choix `pratiquer`). LDB 23 l.76 */
function craftStart(get: Get, set: Set, heroId: string, trappingId: string, atouts: string[], defauts: string[]): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  const metier = h && metierOf(h);
  const t = findTrappingById(trappingId);
  // Gamme/Disponibilité/matériaux : dérivation PARTAGÉE avec le catalogue UI (craftSpecOf).
  const spec = t && craftSpecOf(t);
  if (!st || !h || !metier || !t || !spec) return;
  const { tier, avail, materialsBrass: materials } = spec;
  const target = craftTarget(tier, avail, atouts.length, defauts.length);
  payWithAllocation(get, set, { debits: soloPayer(heroId, fromBrass(materials)), recipient: heroId, purpose: 'artisanat' });
  // `payWithAllocation` remplace l'entrée `party` du héros débité (nouvelle référence) — re-résoudre
  // AVANT de muter `craft`, sinon la mutation porterait sur l'objet PÉRIMÉ (perdue au `set` suivant).
  const h2 = get().party.find((x) => x.id === heroId)!;
  h2.craft = { trappingId, tier, avail, atouts, defauts, drDone: 0, drTarget: target.dr, difficulty: target.difficulty };
  set({ party: [...get().party] });
  get().ecrireAuJournal(msg('if.craftStart', {
    name: h.label, cost: formatMoney(fromBrass(materials)), label: t.label, dr: target.dr, skill: skillInstanceLabel(metier),
  }));
}

// ── Catalogue d'Activités data-driven (`activities.json`, contexte 'interlude') ────────────────

/** Activités du catalogue proposables ICI (contexte 'interlude' + gate géographique `where`). Quand une
 *  bataille de masse est en attente de préparation (`massBattle.phase === 'prep'`), les Activités de
 *  PRÉPARATION (contexte 'bataille' + Discours) sont AJOUTÉES au catalogue : « Interlude c'est interlude »,
 *  la préparation de bataille se joue DANS le menu d'Activités, pas sur un écran à part (ADE II 8 l.65 :
 *  budget d'Activités UNIQUE). Le rendu gate les prérequis (Infiltration ⇐ Planification, Sabotage ⇐
 *  Repérage) et l'anti-répétition — cf. `battlePrepEntries`. Sans bataille pendante, catalogue inchangé. */
export function interludeCatalog(s: Pick<Jeu, 'lieu' | 'massBattle'>): ActivityDef[] {
  const place = s.lieu;
  const base = activitiesFor('interlude').filter((d) => activityAvailableAt(d, place));
  if (s.massBattle?.phase !== 'prep') return base;
  return [...base, ...battlePrepEntries(s.massBattle).map((e) => e.def)];
}

/** Round de Focalisation d'un Rituel engagé/à engager (Activité « Accomplir un Rituel »,
 *  `VDM 02 l.777`) — résolveur `ritualFocus` à part d'`openCatalogActivity`, pour tenir sa
 *  complexité cognitive. `h.ritual` persiste entre Activités comme l'Artisanat (`h.craft`) ;
 *  le sort visé vient d'`opts.spellId` au 1er Round, puis du Rituel déjà engagé. NI formule
 *  (`cn: null`, `ritual.cnFrom`) = volet 2 (#879), non engageable ici. `null` = refus (déjà
 *  loggé) — le Test étendu de Focalisation lui-même (`VDM 02 l.129-141`) est orchestré par
 *  `resolveFocus` (`engine/magic.ts`), branché dans `FLOWS.activite` (rollFlowSpecs.ts). */
export function openRitualFocus(
  get: Get, set: Set, h: Combatant, spellId: string | undefined,
): (Partial<PendingActivityFields> & { label: string }) | undefined {
  const id = spellId ?? h.ritual?.spellId;
  const sp = id ? findSpellById(id) : undefined;
  if (!sp?.isRitual || !(h.spells ?? []).includes(sp.id)) { get().ecrireAuJournal(id ? t('if.rituelUnknown', { id }) : t('if.rituelNoSelection', { name: h.label })); return undefined; }
  if (sp.cn == null) { get().ecrireAuJournal(t('if.rituelNoFormula', { label: sp.label, cnFrom: sp.ritual?.cnFrom ?? '?' })); return undefined; }
  if (h.ritual && h.ritual.spellId !== sp.id) { get().ecrireAuJournal(t('if.rituelAlreadyStarted', { name: h.label, label: findSpellById(h.ritual.spellId)?.label ?? h.ritual.spellId })); return undefined; }
  if (!focusSkillFor(h, sp)) { get().ecrireAuJournal(t('if.rituelNoFocusSkill', { name: h.label, label: sp.label })); return undefined; }
  if (!h.ritual) {
    const ni = ritualReduction(h, sp)?.cn ?? sp.cn;
    const drTarget = Math.ceil(ni / 2); // NI réduit de moitié en Activité (desc `accomplir-un-rituel`)
    h.ritual = { spellId: sp.id, drDone: 0, drTarget };
    set({ party: [...get().party] });
  }
  const ritualNow = h.ritual!;
  return { drBefore: ritualNow.drDone, drTarget: ritualNow.drTarget, ritualSpell: sp.id, label: sp.label };
}

/** Une Activité que `refusDOuvertureDActivite` a ouverte porte sa cible et sa compétence : leur absence ici
 *  est une faute du verdict, jamais un refus à taire. */
function ouverteSansCible(def: ActivityDef): never {
  throw new Error(`Activité « ${def.id} » ouverte par refusDOuvertureDActivite sans la cible ou la compétence que son ouverture lit.`);
}

/** Ouvre la modale d'une Activité du CATALOGUE (TOUTES les Activités à jet d'interlude passent ici), que le verdict
 *  `refusDOuvertureDActivite` ouvre : le choix `pratiquer` et le retrait de Mécénat le jugent.
 *  Le Test (voie, valeur, Difficulté, modificateurs) est le PRÉ-JET de l'Activité (`preJetDActivite`),
 *  celui qu'affiche son volet ; le résolveur n'annexe que ses champs propres : Test étendu en cours
 *  (`craftExtended`, `ritualFocus`), Talent et tuteur tiré (`learnTalent`), coût (`reputation`), objet
 *  étudié (`identify`). Cibles éventuelles : objet (`itemUid`), sort (`spellId` — achat immédiat), dépôt
 *  (`depotId`), Talent (`talentId`). */
function openCatalogActivity(get: Get, set: Set, heroId: string, def: ActivityDef, opts: CiblesChoisies): void {
  const activityId = def.id;
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  if (!st || !h) return ouverteSansCible(def);
  // Champs de pending propres au résolveur (Test étendu, Talent, item…) — annexés à la fin.
  const extra: Partial<PendingActivityFields> = {};
  if (def.resolver === 'craftExtended') {
    // Artisanat (LDB 23 l.74-102) : Test ÉTENDU de Métier, DR cumulé par Activité — l'ouvrage doit avoir
    // été engagé (`craftStart` : matériaux ¼ prix + `h.craft`).
    if (!h.craft) return ouverteSansCible(def);
    extra.drBefore = h.craft.drDone;
    extra.drTarget = h.craft.drTarget;
    extra.label = stepDetail(dataLabel(def.label), dataLabel(trappingLabelOf(h.craft.trappingId)));
  } else if (def.resolver === 'ritualFocus') {
    const r = openRitualFocus(get, set, h, opts.spellId);
    if (!r) return;
    // eslint-disable-next-line murs/conteneur -- La cible est `Partial<PendingActivityFields>` (le pending d'activité), PAS une étape de cascade : ce `label` n'est pas le champ marqué #1318.
    Object.assign(extra, r, { label: stepDetail(dataLabel(def.label), dataLabel(r.label)) });
  } else if (def.resolver === 'learnTalent') {
    // Apprentissage particulier : tuteur tiré, puis jugé. LDB 23 l.66-72
    const talent = findTalentById(opts.talentId ?? '');
    const xpCost = learnOptionOf(h, opts.talentId ?? '')?.xpCost;
    if (!talent || xpCost == null) return ouverteSansCible(def);
    const tutorBrass = toBrass(apprenticeshipTutorCost(xpCost, battleRng()));
    const tuteurHorsBourse = refusDeBourse(h, fromBrass(tutorBrass), 'if.tuteurKo');
    if (tuteurHorsBourse) { refuserGeste(get, set, tuteurHorsBourse); return; }
    extra.talent = talent.id;
    extra.xpCost = xpCost;
    extra.tutorBrass = tutorBrass;
    extra.label = stepDetail(dataLabel(def.label), dataLabel(refLabel('talents', { id: talent.id })));
  } else if (def.resolver === 'identify') {
    const item = ciblesDActivite(h, def).artefacts.find((i) => i.uid === opts.itemUid);
    if (!item) return ouverteSansCible(def);
    extra.label = stepDetail(dataLabel(def.label), dataLabel(item.label));
  } else if (def.resolver === 'reputation') {
    // Réputation (LDB 23 l.228-234) : coût = « le maximum de vos revenus standards », dépensé DANS TOUS
    // LES CAS (même sur échec).
    const { tier, standing } = actorStatus(h);
    const cost = toBrass(statusIncomeMax(tier, standing));
    extra.costBrass = cost;
    extra.label = stepDetail(dataLabel(def.label), dataLabel(formatMoney(fromBrass(cost))));
  }
  const preJet = preJetDActivite(get(), heroId, def, opts) ?? ouverteSansCible(def);
  // Modificateurs NOMMÉS du pré-jet, fondus en UNE ligne de mod (`pa.mod`/`modLabel`), comme la Menace.
  const mod = preJet.mods.reduce((n, m) => n + m.value, 0);
  const ligneDeMod = mod ? { mod, modLabel: preJet.mods.map((m) => m.label).join(' + ') } : {};
  const competence = preJet.test.skill ? { chosenSkill: structuredClone(preJet.test.skill) } : {}; // #2097
  set({
    pendingActivity: {
      heroId, kind: 'catalog', activityId, label: def.label,
      skillLabel: testSkillLabel(preJet.test), skillValue: preJet.value, ligne: preJet.ligne,
      roll: null, target: 0, sl: 0, success: false,
      ...ligneDeMod,
      ...competence,
      ...(opts.itemUid ? { itemUid: opts.itemUid } : {}),
      ...(opts.spellId ? { spellId: opts.spellId } : {}),
      ...(opts.depotId ? { depotId: opts.depotId } : {}),
      ...(opts.traitPsy !== undefined ? { traitPsy: viseDuTrait(h, opts.traitPsy) } : {}),
      ...extra,
      difficulty: preJet.difficulty,
    },
  });
}

/** Retrait d'un dépôt de Mécénat (ACE 12 l.57-65) : le dépôt est SOLDÉ, le rendu suit la bande du Test
 *  d'Évaluation (« profit de 20 % » / investissement / moitié / perte). */
function mecenatPayout(get: Get, set: Set, h: Combatant, depotId: IdDeDepot, payoutPct: number): string[] {
  const dep = (get().bank ?? []).find((d) => d.uid === depotId);
  if (dep?.kind !== 'mecenat') return [];
  set({ bank: (get().bank ?? []).filter((d) => d.uid !== depotId) });
  const payout = Math.floor((dep.brass * payoutPct) / 100);
  if (payout > 0) creditBourse(get, set, dep.heroId, fromBrass(payout));
  return [payout > 0
    ? msg('if.mecenatPayout', { name: h.label, money: formatMoney(fromBrass(payout)), pct: payoutPct, invested: formatMoney(fromBrass(dep.brass)) })
    : msg('if.mecenatLoss', { name: h.label, invested: formatMoney(fromBrass(dep.brass)) })];
}

/** Issue d'un résolveur d'Activité : les lignes de journal + un `patch` de l'état d'interlude du
 *  héros (deltas NON exprimables en `GameOp` : DR du Test étendu, crédit différé des Revenus,
 *  compteur d'acharnement — fusionnés dans l'écriture finale de `jetValider('activite')`). */
interface ResolverResult { lines: string[]; patch?: Partial<InterludeHeroState>; closeOps?: GameOp[] }

/** Ce résolveur appartient-il à la famille INTERLUDE (`RESOLVER_OWNER`) ? */
const ownedByInterlude = (r: ActivityResolver): r is ResolverOf<'interlude'> => RESOLVER_OWNER[r] === 'interlude';

/** Dispatch des résolveurs BESPOKE d'issue d'Activité (`ActivityDef.resolver` + bandes `resolver`) —
 *  chacun RÉUTILISE une logique PURE existante et implémente la règle RAW vérifiée. Le `patch` porte
 *  les deltas d'état d'interlude (le `set` final est fait par `jetValider('activite')`). FERMÉ sur le
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
      const outcome = pa.success ? 'reussite' : isAstoundingFailure(pa.success, pa.sl) ? 'echecStupefiant' : 'echec';
      const { tier, standing } = actorStatus(h);
      let brass = toBrass(statusIncome(tier, standing, battleRng(), outcome));
      const lines: string[] = [];
      // Événements de la période : leurs pourcentages s'additionnent sur le gain de base. LDB 22
      const parEvenement = revenusDeLaPeriode(get(), h.id);
      if (parEvenement.effets.length) {
        brass = Math.max(0, Math.floor((brass * (100 + parEvenement.pct)) / 100));
        for (const { label, fx } of parEvenement.effets) lines.push(msg('if.eventRevenue', { event: label, sign: fx.revenuePct! > 0 ? '+' : '', pct: fx.revenuePct! }));
      }
      lines.push(msg('if.incomeWeek', { name: h.label, money: formatMoney(fromBrass(brass)) }));
      return { lines, patch: { didRevenus: true, revenueBrass: st.revenueBrass + brass } };
    }
    case 'craftExtended': {
      // Artisanat = Test ÉTENDU de Métier (LDB 23 l.78, l.102) : « les DR obtenus à chaque Round sont
      // additionnés jusqu'à atteindre une valeur cible » (LDB 12 l.174), 1 lancer par Activité —
      // qui progresse (ou régresse) MÊME sur échec. À l'achèvement, l'objet est créé avec ses
      // Atouts/Défauts choisis. Le travail inachevé est conservé (l.102) via `h.craft` (Combatant —
      // survit à la clôture de l'interlude, #897).
      if (!h.craft) return { lines: [] };
      const { total: drDone, done } = garanti(progresDActivite(pa), h.id, 'cible d’Artisanat');
      if (done) {
        const it = itemFromTrappingRef({ id: h.craft.trappingId, qualities: [...h.craft.atouts, ...h.craft.defauts].map((id) => ({ id })) }, get().forgerUnId, undefined, contexteDeNaissanceDObjet(h));
        if (it) {
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
      // Rituel (Activité « Accomplir un Rituel », `VDM 02 l.777`) : Round de Focalisation cumulé par
      // `progresDActivite` (LDB 12 l.174). `pa.sl` porte le DR du Round (`FocusResult` via
      // `FLOWS.activite`) : `dr` sur une réussite, le DR brut sur un échec. Composants/Conditions/
      // Sacrifices/Conséquences restent en PROSE non structurée (`SpellData['ritual']`), non appliqués
      // ici. `h.ritual` (Combatant) survit à la clôture de l'interlude, #897.
      if (!h.ritual) return { lines: [] };
      if (pa.malepierreConsumed) consumeMalepierre(h, pa.malepierreConsumed);
      const { total: drDone, done } = garanti(progresDActivite(pa), h.id, 'cible de Rituel');
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
      // Apprentissage particulier (LDB 23 l.66-72) : « Sur un succès, vous avez appris le Talent. Sinon,
      // vous avez échoué […] et gagnez un modificateur de +10 pour chaque tentative ratée » ; « dépensant
      // en vain des PX et de l'argent » → argent du tuteur ET PX consommés MÊME sur échec.
      const talentId = pa.talent;
      if (!talentId) return { lines: [] };
      const talentLabel = refLabel('talents', { id: talentId });
      // Tuteur payé dans TOUS les cas — débité APRÈS l'écriture des PX (`depenserPx`) : la Bourse se lit
      // sur l'acteur écrit (`actorIn`).
      const payTutor = () => payWithAllocation(get, set, { debits: soloPayer(h.id, fromBrass(pa.tutorBrass ?? 0)), recipient: h.id, purpose: 'tuteur' });
      if (pa.success) {
        let r: ReturnType<typeof engineBuyTalent> = { ok: false, cost: 0 };
        depenserPx(get, set, h.id, (lu) => {
          const appris = structuredClone(lu);
          const fortuneBefore = fortuneMax(appris);
          const resolveBefore = resolveMax(appris);
          r = engineBuyTalent(appris, talentId); // débite les PX + acquiert le Talent
          if (!r.ok) return lu;
          applyTalentAcquisition(appris, talentId);
          appris.fortune = (appris.fortune ?? 0) + (fortuneMax(appris) - fortuneBefore); // Chanceux
          appris.resolve = (appris.resolve ?? 0) + (resolveMax(appris) - resolveBefore); // Obstiné
          return appris;
        });
        // Achat jugé avant la confirmation (`refusDeConfirmerLActivite`) : sans Talent acquis, rien n'est débité.
        if (!r.ok) return { lines: [] };
        payTutor();
        return { lines: [msg('if.learnTalentOk', { name: h.label, label: talentLabel, cost: r.cost, tutor: formatMoney(fromBrass(pa.tutorBrass ?? 0)) })] };
      }
      depenserPx(get, set, h.id, (lu) => ({ ...lu, xp: Math.max(0, (lu.xp ?? 0) - (pa.xpCost ?? 0)) })); // PX perdus en vain (échec)
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
      // sort immédiatement » (ACE 12 l.55) : remise = DR × 100, appliquée à CET achat seul par acheterLeSort.
      const r = partyBuySpell(get, set, h.id, pa.spellId, { discountXp: Math.max(0, pa.sl) * 100 });
      if (r.ok && r.chaos) return { lines: gainCorruption(get, set, h, 1) }; // sort du Chaos : +1 Corruption (LDB 51)
      return { lines: [] };
    }
    case 'combatTraining': {
      // Entraînement au Combat (LDB 23 l.205-209) : « sur un succès, vous pouvez inverser un Test de
      // la Compétence associée une fois pendant votre prochaine aventure » — jeton d'inversion SCOPÉ
      // (op existant, MÊME canal que « Observer une cible »).
      if (!pa.chosenSkill) return { lines: [] };
      const skillLabel = refLabel('skills', pa.chosenSkill);
      if (!pa.success) return { lines: [msg('if.combatTrainingKo', { name: h.label, skill: skillLabel })] };
      return { lines: applyOps(h, [{ op: 'grantReverseToken', skill: pa.chosenSkill }], { idNeuf: get().forgerUnId, rng: battleRng(), label: pa.label, source: activitySource(pa) }) };
    }
    case 'punchausen': {
      // Fabuleuse Vente du comte de Punchausen (AA 12 l.45-49) : « vous recevez 2d10 pistoles et […]
      // vous pouvez inverser les dés sur un Test de Charme ou de Divertissement (Narration) » — même
      // canal de jeton que « Entraînement au Combat », SCOPÉ à la Compétence utilisée pour la vente.
      if (!pa.success || !pa.chosenSkill) return { lines: [msg('if.punchausenKo', { name: h.label })] };
      const pistoles = roll(2, 10, battleRng());
      const gain = fromBrass(pistoles * PA_PER_SC);
      // Jeton posé AVANT le crédit : `creditBourse` clone le groupe et capte la mutation de `h`.
      const tokenLines = applyOps(h, [{ op: 'grantReverseToken', skill: pa.chosenSkill }], { idNeuf: get().forgerUnId, rng: battleRng(), label: pa.label, source: activitySource(pa) });
      creditBourse(get, set, h.id, gain); // revenu PERSO (vente du récit DE ce héros), pas partagé par tête
      return { lines: [msg('if.punchausenOk', { name: h.label, money: formatMoney(gain) }), ...tokenLines] };
    }
    case 'reputation': {
      // Réputation : le `statusMod` vaut « pour la prochaine aventure », il se pose à la clôture
      // (`closeOps`, appliqués par `cloreLInterlude`). LDB 23 l.228-234
      const lines: string[] = [msg('if.reputationSpend', { name: h.label, money: formatMoney(fromBrass(pa.costBrass ?? 0)) })];
      const delta = isAstoundingSuccess(pa.success, pa.sl) ? 2 : pa.success ? 1 : isAstoundingFailure(pa.success, pa.sl) ? -1 : 0;
      payWithAllocation(get, set, { debits: soloPayer(h.id, fromBrass(pa.costBrass ?? 0)), recipient: h.id, purpose: 'reputation' });
      if (delta === 0) return { lines: [...lines, msg('if.reputationWasted', { name: h.label })] };
      lines.push(msg('if.reputationAPoser', { name: h.label, delta: `${delta > 0 ? '+' : ''}${delta}` }));
      return { lines, closeOps: [{ op: 'statusMod', amount: delta }] };
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
      // Trois tirages de MONDE au dé de chaque table (`effectTableDie`) : ils sont la CONSÉQUENCE du
      // Test de Ragot déjà joué et surfacé (`pa`), pas une occasion de pose de plus.
      const tirer = (id: string) => findTableEntry(findEffectTableById(id).entries, rollDice(effectTableDie(id), rng));
      const lieu = tirer('contremaitre-lieu');
      const objectif = tirer('contremaitre-objectif');
      const perso = tirer('contremaitre-personnalite');
      return {
        lines: [
          msg('if.contremaitreOk', { name: h.label, lieu: ligneNommee(lieu, 'contremaitre-lieu'), objectif: ligneNommee(objectif, 'contremaitre-objectif'), perso: ligneNommee(perso, 'contremaitre-personnalite') }),
          msg('if.contremaitreNote'),
        ],
      };
    }
    // Résolveurs d'interlude SANS branche ici : leur issue est produite en amont (`entrainement` par
    // `entrainementStart`, `mecenat` par `bankDeposit`/`bankWithdraw` ; `knowledgeResearch` est gaté à
    // l'ouverture, son issue vient de ses bandes `outcomes`). Cas ÉNUMÉRÉS, jamais un `default` qui avale.
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
    const i = roll(1, pool.length, battleRng()) - 1;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/** Passer commande (LDB 23 l.178-184) : marchandise chiffrée hors du stock ordinaire (`orderBlockOf`,
 *  porte d'entrée PARTAGÉE avec `orderCatalog`) payée MAINTENANT, « achevé après votre prochaine
 *  aventure » (livré à l'ouverture du prochain interlude). 1 objet par Activité. */
export function orderItem(get: Get, set: Set, heroId: string, trappingId: string): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  if (refuseSi(get, set, (s) => refusDeCommande(s, heroId, trappingId))) return;
  const t = findTrappingById(trappingId);
  if (!st || !h || !t) return;
  const price = toBrass(priceToMoney(t.price));
  payWithAllocation(get, set, { debits: soloPayer(heroId, fromBrass(price)), recipient: heroId, purpose: 'commande' });
  set({ pendingOrders: [...(get().pendingOrders ?? []), { heroId, trappingId: t.id }] });
  const itl = get().interlude!;
  itl.perHero[heroId] = { ...st, left: st.left - 1 };
  set({ interlude: { ...itl } });
  get().ecrireAuJournal(msg('if.orderPlaced', { name: h.label, label: t.label, cost: formatMoney(fromBrass(price)) }));
}
/** Entraînement (LDB 23 l.132-136) : « vous entraîner dans une Compétence ou une Caractéristique en
 *  dehors de votre Carrière » — PAS de Test (achat direct comme Passer commande/Banque). Coût en PX
 *  NORMAL (hors carrière, déjà doublé par `advanceCost`/`acheterLaCaracteristique`/`acheterLaCompetence`, LDB 07 l.91)
 *  + tuteur 1D10 sc (doublé pour une Compétence Avancée, l.135). `opt` recalculée ICI depuis les
 *  données du héros (`optionDEntrainement`), que le choix `pratiquer` a jugée (`refusDEntrainement`).
 *  Une Compétence de Base hors carrière encore inconnue est ACQUISE à 0 Augmentation puis augmentée
 *  (même geste qu'`acheterLaCompetence`, LDB 09 l.42). */
function entrainementStart(get: Get, set: Set, heroId: string, cle: string): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  const opt = h && optionDEntrainement(h, cle);
  if (!st || !h || !opt) return;
  const { kind, id, spec } = opt;
  const tutor = toBrass(entrainementTutorCost(opt.advanced, battleRng()));
  const tuteurHorsBourse = refusDeBourse(h, fromBrass(tutor), 'if.tuteurKo');
  if (tuteurHorsBourse) { refuserGeste(get, set, tuteurHorsBourse); return; }
  let r: ReturnType<typeof engineBuyCharAdvance> = { ok: false, cost: 0 };
  const accepte = depenserPx(get, set, heroId, (lu) => {
    const entraine = structuredClone(lu);
    const fortuneBefore = fortuneMax(entraine);
    const resolveBefore = resolveMax(entraine);
    if (kind === 'caracteristique') r = engineBuyCharAdvance(entraine, id as CharKey, false);
    else {
      if (!entraine.skills.some((k) => k.id === id && memeSpecialisation(k.spec, spec))) {
        entraine.skills.push({ id: id, spec, characteristic: skillCharacteristicById(id), advances: 0 });
      }
      r = engineBuySkillAdvance(entraine, { id, spec }, false);
    }
    if (!r.ok) return lu;
    entraine.fortune = (entraine.fortune ?? 0) + (fortuneMax(entraine) - fortuneBefore); // Sociabilité (Chance/Fortune)
    entraine.resolve = (entraine.resolve ?? 0) + (resolveMax(entraine) - resolveBefore); // Volonté (Résilience/Détermination)
    return entraine;
  });
  if (!accepte) return;
  if (!r.ok) {
    get().ecrireAuJournal(t('if.entrainementRefused', { name: h.label, label: opt.label, reason: r.reason ?? '' }));
    return;
  }
  // Tuteur débité APRÈS les Augmentations : la Bourse se lit sur l'acteur écrit (`actorIn`).
  payWithAllocation(get, set, { debits: soloPayer(heroId, fromBrass(tutor)), recipient: heroId, purpose: 'tuteur' });
  const itl = get().interlude!;
  itl.perHero[heroId] = { ...st, left: st.left - 1 };
  set({ interlude: { ...itl } });
  get().ecrireAuJournal(t('if.entrainementDone', { name: h.label, label: opt.label, cost: r.cost, tutor: formatMoney(fromBrass(tutor)) }));
}

/** Applique le jet d'Activité confirmé (consomme l'Activité). CHEMIN UNIQUE data-driven :
 *  l'issue vient de la DONNÉE de l'`ActivityDef` — bandes `outcomes`/`onSuccess` (GameOp + `resolver`
 *  de bande) OU `resolver` DIRECT (Revenus/Artisanat/Apprentissage/Identification, sans table). Les
 *  `patch` des résolveurs sont ACCUMULÉS puis fusionnés dans l'unique écriture finale. */
function appliquerLActivite(get: Get, set: Set): void {
  const pa = get().pendingActivity;
  if (!pa || !pa.activityId) return;
  // Activité/Scène de BATAILLE de masse (ADE II 8) : l'issue porte sur l'ARMÉE (application distincte
  // par `confirmBattleActivity`, canal de jet identique). BUDGET UNIQUE (l.65 : « comme à l'accoutumée,
  // ils ne peuvent participer qu'à un maximum de trois Activités ») : une prépa de bataille EST une
  // Activité d'interlude → elle DÉCRÉMENTE `interlude.perHero[id].left` comme toute Activité. Les Scènes
  // de Round (`battle === 'round'`) sont HORS budget downtime (illimitées par Round) — jamais décomptées.
  if (pa.battle) {
    // Budget partagé (l.65) : une préparation (`'prep'`) EST une Activité d'interlude, refusée en AMONT
    // par `refusDActivite` comme le chemin interlude plus bas. Les Scènes de Round (`'round'`) hors budget.
    set({ pendingActivity: null });
    if (pa.battle === 'prep' && refuseSi(get, set, (s) => refusDActivite(s, pa.heroId))) return;
    confirmBattleActivity(get, set, pa);
    if (pa.battle === 'prep') {
      consumeActivity(get, set, pa.heroId);
      // #257, LDB 23 l.5, ADE II 8 l.65/l.81 ; `consumeActivity` no-op à 0.
      if (soutienCouteUneActivite()) {
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
  if (refuseSi(get, set, (s) => refusDeConfirmerLActivite(s, pa))) return;
  if (!itl || !st || !h || !def) return;
  const lines: string[] = [];
  const closeOps: GameOp[] = [];
  let patch: Partial<InterludeHeroState> = {};
  const source: EffectSource = { kind: 'activite', id: def.id };
  // Maladresse d'Activité (LDB 12 : double raté) — porte les bandes `on:'maladresse'` (Pénitence :
  // Colère des dieux « à la place », ACE 12 l.15).
  const fumble = isFumble(garanti(pa.roll, pa.heroId, 'jet de l’Activité'), pa.success);
  // Résolveur DIRECT (pas de table d'issues) : Revenus/Artisanat/Apprentissage/Identification —
  // ils agissent/consomment MÊME sur échec (RAW). Les résolveurs de BANDE restent dans la boucle.
  if (def.resolver && !def.outcomes?.length && !def.onSuccess?.length) {
    const r = runActivityResolver(get, set, def.resolver, pa, h, st);
    lines.push(...r.lines);
    closeOps.push(...(r.closeOps ?? []));
    if (r.patch) patch = { ...patch, ...r.patch };
  } else {
    // Défs à TABLE d'issues (bandes de DR) ou binaires (`onSuccess`, ex. Convalescence) — même chemin.
    const bands = (def.outcomes?.length
      ? matchOutcomes(def, { success: pa.success, sl: pa.sl, fumble })
      : pa.success && def.onSuccess?.length ? [{ ops: def.onSuccess }] : [])
      .map((b) => (b.ops ? { ...b, ops: opsCiblees(b.ops, pa.traitPsy) } : b));
    if (fumble && def.outcomes?.some((b) => b.on === 'maladresse')) lines.push(msg('if.fumble', { name: h.label, roll: String(pa.roll) }));
    for (const band of bands) {
      if (band.note) lines.push(band.note); // résultat VERBATIM de la table source
      // L'Activité est un geste délibéré : une issue sans objet pour le héros se DIT, `applyOps` la tait.
      const sansObjet = reussiteSansObjet(h, band.ops ?? [], { sl: pa.sl, source });
      if (sansObjet) lines.push(sansObjet);
      // Les ÉTATS d'issue tombent à la CLÔTURE de l'interlude (règle de CLASSE du contexte : les
      // semaines ne s'écoulent qu'à la fermeture, et le repos de clôture dissiperait un État posé
      // maintenant — « vous subissez 1 État Exténué le premier jour de votre prochaine aventure »,
      // ACE 12 l.15). Le reste (Péché, Exposition, soins…) s'applique tout de suite.
      const immediate = (band.ops ?? []).filter((o) => o.op !== 'condition');
      closeOps.push(...(band.ops ?? []).filter((o) => o.op === 'condition'));
      if (immediate.length) {
        lines.push(...applyOps(h, immediate, { idNeuf: get().forgerUnId,
          rng: battleRng(), label: def.label, now: get().gameTime, source, sl: pa.sl,
          onCorruption: (n: number, align?: ChaosAlign) => gainCorruption(get, set, h, n, align),
          onCorruptionExposure: (level: ExposureLevel, nature?: NatureDInfluence) => {
            // LA PORTE du slot (#1282) : un Test de Corruption déjà affiché ne se fait plus écraser — celui-ci prend rang.
            poseCorruptionPending(get, set, expositionPending(h.id, level, nature));
            return [msg('if.corruptionTest', { name: h.label, level })];
          },
        }));
      }
      if (band.payoutPct != null && pa.depotId) lines.push(...mecenatPayout(get, set, h, pa.depotId, band.payoutPct));
      if (band.resolver) {
        const r = runActivityResolver(get, set, band.resolver, pa, h, st);
        lines.push(...r.lines);
        closeOps.push(...(r.closeOps ?? []));
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
    ...(closeOps.length ? { closeOps: [...(st.closeOps ?? []), { ops: closeOps, ctx: gelerOpsCtx({ idNeuf: get().forgerUnId, rng: battleRng(), label: def.label, source, sl: pa.sl }) }] } : {}),
    ...patch,
  };
  set({ interlude: { ...itl }, party: [...get().party] });
  for (const l of lines) get().ecrireAuJournal(l);
  // DÉS DE MONDE de l'Activité (`worldRolls`) — APRÈS l'écriture : ce que l'environnement roule sur
  // l'acteur une fois son Test résolu (« surpris à mendier par ses pairs », LDB 09 l.99). Bâtis par la
  // PORTE (`worldStep`), donc fixables ; un acteur exempté n'a aucune étape (rien ne se tire).
  const worldSteps = buildActivityWorldRollSteps(def, h);
  if (worldSteps.length) startCascade(get, set, { title: def.label, icon: def.icon, purpose: 'interlude', steps: worldSteps });
}

/** Refus de l'Indice d'intérêts `indice` d'un dépôt `kind` : seul un placement en porte un, entier de 1 à 10. LDB 23 l.168 */
export function refusDIndice(kind: GenreDeDepot, indice: number | undefined): string | null {
  if (indice === undefined) return null;
  if (kind !== 'investir') return msg('if.bankIndiceHorsPlacement');
  return Number.isInteger(indice) && indice >= 1 && indice <= 10 ? null : msg('if.bankIndiceHorsBornes', { indice });
}

/** Opérations bancaires (LDB 23 l.164-170) — dépôt (1 Activité). Invest : Statut Or/Argent.
 *  `mecenat` (ACE 12 l.49) : variante d'Opération bancaire — « au moins 5 CO » (minInvest de
 *  la donnée), gate géographique de l'Activité ; le retrait se résout par un Test d'Évaluation. */
export function bankDeposit(get: Get, set: Set, heroId: string, kind: GenreDeDepot, amountBrass: number, indice?: number): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  if (refuseSi(get, set, (s) => (kind ? devisDeDepot(s, heroId, kind, amountBrass).refus : msg('interlude.choisir.depot')))) return;
  if (refuseSi(get, set, () => refusDIndice(kind, indice))) return;
  if (!st || !h) return;
  const { debite: amount, depose: deposited } = devisDeDepot(get(), heroId, kind, amountBrass);
  const lines: string[] = [];
  for (const { label, fx } of effetsDeLaPeriode(get(), heroId)) if (fx.bankPct) lines.push(msg('if.eventBankPct', { pct: fx.bankPct, event: label }));
  const r = kind === 'investir' ? indice ?? d10(battleRng()) : 0;
  payWithAllocation(get, set, { debits: soloPayer(heroId, fromBrass(amount)), recipient: heroId, purpose: 'dépôt-banque' });
  const uid = get().forgerUnId('it');
  set({ bank: [...(get().bank ?? []), { uid, heroId, kind, brass: deposited, rate: r }] });
  const itl = get().interlude!;
  itl.perHero[heroId] = { ...st, left: st.left - 1 };
  set({ interlude: { ...itl } });
  lines.push(msg(
    kind === 'investir' ? 'if.bankInvest' : kind === 'mecenat' ? 'if.bankMecenat' : 'if.bankStash',
    { name: h.label, money: formatMoney(fromBrass(deposited)), rate: r },
  ));
  // Un dépôt en banque réputée vérifie la faillite sous la période qui l'exige. LDB 22 l.111
  if (kind === 'investir' && verificationDeFaillite(get(), heroId)) {
    lines.push(...bankWithdrawInner(get, set, uid, true));
  }
  for (const l of lines) get().ecrireAuJournal(l);
}

/** Retrait d'un dépôt, refusé par `refusDeRetrait` (investissement : une Activité, LDB 23 l.168 ; planque :
 *  aucune, l.170). Le d100 est journalisé (résolution directe — pas un Test de compétence). */
export function bankWithdraw(get: Get, set: Set, depotId: IdDeDepot): void {
  if (refuseSi(get, set, (s) => refusDeRetrait(s, depotId))) return;
  const dep = (get().bank ?? []).find((d) => d.uid === depotId);
  if (!dep) return;
  if (dep.kind === 'mecenat') {
    // Retrait de Mécénat (ACE 12 l.49) = 1 Activité résolue par un Test d'Évaluation Intermédiaire :
    // la modale d'Activité applique la bande (payoutPct) et consomme l'Activité à la validation.
    const def = ACTIVITIES.find((a) => a.resolver === 'mecenat');
    if (def) openCatalogActivity(get, set, dep.heroId, def, { depotId });
    return;
  }
  if (dep.kind === 'investir') {
    const st = heroState(get(), dep.heroId);
    if (!st) return;
    const itl = get().interlude!;
    itl.perHero[dep.heroId] = { ...st, left: st.left - 1 };
    set({ interlude: { ...itl } });
  }
  for (const l of bankWithdrawInner(get, set, depotId, false)) get().ecrireAuJournal(l);
}

function bankWithdrawInner(get: Get, set: Set, depotId: IdDeDepot, crashCheckOnly: boolean): string[] {
  const dep = (get().bank ?? []).find((d) => d.uid === depotId);
  if (!dep || dep.kind === 'mecenat') return []; // Mécénat : soldé par le Test d'Évaluation (bande payoutPct)
  const h = get().party.find((x) => x.id === dep.heroId);
  const roll = d100(battleRng());
  // Planque de Carte marine (MDG 15 l.292) : « en sûreté tant que vous gardez la carte » → tant que le
  // dépositaire PORTE encore une carte-marine, le trésor n'est pas à découvert ; il ne l'est (jet ≤ rate)
  // que si la carte est perdue/volée.
  const chartHeld = !!h?.items?.some((it) => it.trappingId === 'carte-marine');
  const outcome = dep.chartSecured && chartHeld ? 'recu' : bankWithdrawOutcome(dep.kind, dep.rate, roll);
  const rest = (get().bank ?? []).filter((d) => d.uid !== depotId);
  if (outcome === 'perdu') {
    set({ bank: rest });
    const threshold = seuilDePerteBancaire(dep.kind, dep.rate);
    return [msg('if.bankLost', {
      name: libelleOuAbsence(h, 'heros', dep.heroId), roll, threshold,
      what: msg(dep.kind === 'investir' ? 'if.bankFailBank' : 'if.bankFailStash'),
      money: formatMoney(fromBrass(dep.brass)),
    })];
  }
  if (crashCheckOnly) return [msg('if.bankCrashOk', { roll, rate: dep.rate })];
  const payout = bankPayout(dep.kind, dep.brass, dep.rate);
  set({ bank: rest });
  creditBourse(get, set, dep.heroId, fromBrass(payout)); // retrait PERSONNEL : recrédité au déposant
  return [msg('if.bankWithdraw', {
    name: libelleOuAbsence(h, 'heros', dep.heroId), money: formatMoney(fromBrass(payout)), roll,
    extra: dep.kind === 'investir' ? msg('if.bankInterest', { rate: dep.rate }) : '',
  })];
}

/** Clôture : applique le devis (`devisDeCloture`) que le récap affiche, puis le temps passe (repos
 *  standard). Touche toutes les bourses : geste du groupe, la validation de l'interlude (`fenetreValider('interlude')`).
 *  LDB 23 l.15, l.33, l.191 */
function cloreLInterlude(get: Get, set: Set): void {
  const devis = devisDeCloture(get());
  if (!devis) return;
  const lines: string[] = [];
  for (const { heroId, niveau } of devis.retrogradations) {
    const h = get().party.find((x) => x.id === heroId)!;
    h.careerLevel = niveau;
    lines.push(msg('if.careerDemotion', { name: h.label, level: niveau }));
  }
  if (devis.gaspille > 0) lines.push(msg('if.moneyWasted', { money: formatMoney(fromBrass(devis.gaspille)) }));
  for (const g of devis.gaspillages) debitBourse(get, set, g.heroId, fromBrass(g.brass));
  for (const r of devis.revenus) creditBourse(get, set, r.heroId, fromBrass(r.brass));
  if (devis.revenu > 0) lines.push(msg('if.revenueAvailable', { money: formatMoney(fromBrass(devis.revenu)) }));
  // Faveurs (LDB 23 l.149, #509) : la « consécutivité » se mesure à l'interlude — granularité posée
  // par `Favor.progress` (`favorFlow.ts`), reset AVANT de refermer l'interlude, pendant qu'il est
  // encore lisible.
  resetInterruptedFavorProgress(get, set);
  set({ interlude: null, screen: 'campaign', party: [...get().party] });
  for (const l of lines) get().ecrireAuJournal(l);
  // Le temps de l'interlude s'écoule par le moteur de nuit unique ; `fedDaily` : le gîte et le couvert
  // de la période sont payés par l'argent gaspillé. LDB 23 l.15-17
  sleepParty(get, set, devis.jours, { fedDaily: true });
  // Issues DIFFÉRÉES à la clôture (ACE 12 l.15) : posées APRÈS le repos de clôture — un État posé avant
  // serait dissipé par la récupération. Le héros se relit par son id : les bourses ont été réécrites.
  if (devis.lots.length) {
    const after: string[] = [];
    for (const { heroId, lots } of devis.lots) {
      const h = get().party.find((x) => x.id === heroId);
      if (!h) continue;
      for (const lot of lots) after.push(...applyOps(h, lot.ops, { idNeuf: get().forgerUnId, ...lot.ctx, rng: battleRng(), now: get().gameTime }));
    }
    set({ party: [...get().party] });
    for (const l of after) get().ecrireAuJournal(l);
  }
  // Bataille en attente de préparation à la clôture de l'interlude (ADE II 8) : la fin de l'interlude
  // ENGAGE la bataille (transition vers les Rounds avec les bonus de prépa acquis). `engagerLaBataille`
  // rebascule sur l'écran de bataille. Une bataille sans prépa faite démarre au Round 1 sans bonus.
  if (get().massBattle?.phase === 'prep') {
    engagerLaBataille(get, set);
    set({ screen: 'massBattle' });
  }
}

/** Le libellé d'une ligne de table DESCRIPTIVE (le contremaître) : une ligne muette y est un défaut de donnée (#1906). */
function ligneNommee(ligne: { label?: string }, table: string): string {
  const { label } = ligne;
  if (label === undefined) throw new Error(`[${table}] ligne sans libellé dans une table descriptive (#1906)`);
  return label;
}

export function creerActionsDInterlude(get: Get, set: Set) {
  return {
    ouvrirLInterlude: (weeks) => ouvrirLInterlude(get, set, weeks),
    deposerALaBanque: (heroId, kind, amountBrass, indice) => bankDeposit(get, set, heroId, kind, amountBrass, indice),
    retirerDeLaBanque: (depotId) => bankWithdraw(get, set, depotId),
    commanderLObjet: (heroId, trapping) => orderItem(get, set, heroId, trapping),
  } satisfies FabriqueDuNoyau;
}

/** Pratique l'Activité `c` que compose le héros `heroId`, que le choix `pratiquer` a jugée (`refusDeLaComposition`) :
 *  engage l'ouvrage d'Artisanat qu'il n'a pas en cours, suit l'Entraînement, sinon ouvre l'Activité sur ses cibles.
 *  LDB 23 l.5 */
function pratiquer(get: Get, set: Set, heroId: string, c: CompositionDActivite): void {
  const def = garanti(activityById(c.activite), c.activite, 'Activité composée');
  if (def.resolver === 'craftExtended' && !get().party.find((h) => h.id === heroId)?.craft) {
    craftStart(get, set, heroId, garanti(c.ouvrage, heroId, 'ouvrage composé'), c.atouts, c.defauts);
  } else if (def.resolver === 'entrainement') {
    entrainementStart(get, set, heroId, garanti(c.entrainement, heroId, 'Entraînement composé'));
  } else {
    openCatalogActivity(get, set, heroId, def, c.cibles);
  }
}

/** Le corps des choix de l'interlude (`fenetreChoisir('interlude', …)`) : le héros `pid` compose son Activité — une autre
 *  Activité recommence la composition —, puis la pratique. */
export function choixDInterlude(get: Get, set: Set) {
  const composer = (pid: string, c: CompositionDActivite) => {
    const itl = garanti(get().interlude, pid, 'interlude ouvert');
    set({ interlude: { ...itl, perHero: { ...itl.perHero, [pid]: { ...garanti(itl.perHero[pid], pid, 'héros de l’interlude'), composition: c } } } });
  };
  const composee = (pid: string): CompositionDActivite => garanti(get().interlude?.perHero[pid]?.composition, pid, 'Activité composée');
  const poser = (axe: AxeDuBrouillon) => (valeur: string, pid: string) => composer(pid, poserDansLeBrouillon(composee(pid), axe, valeur));
  return {
    interlude: {
      activite: (activite, pid) => composer(pid, brouillonDe(get().interlude?.perHero[pid]?.composition, activite)),
      talent: poser('talent'),
      entrainement: poser('entrainement'),
      ouvrage: poser('ouvrage'),
      ajouterLaQualite: (q, pid) => {
        const c = composee(pid);
        composer(pid, qualitesDArtisanat().atouts.includes(q) ? { ...c, atouts: [...c.atouts, q] } : { ...c, defauts: [...c.defauts, q] });
      },
      retirerLaQualite: (q, pid) => {
        const c = composee(pid);
        composer(pid, { ...c, atouts: c.atouts.filter((x) => x !== q), defauts: c.defauts.filter((x) => x !== q) });
      },
      objet: poser('objet'),
      sort: poser('sort'),
      traitPsychologique: poser('traitPsychologique'),
      pratiquer: (_vrai, pid) => pratiquer(get, set, pid, composee(pid)),
    },
  } satisfies Partial<CorpsDesChoix>;
}

export function validationsDInterlude(get: Get, set: Set) {
  return { interlude: () => cloreLInterlude(get, set) } satisfies Partial<ValidationsDeFenetre>;
}

export function cloturesDInterlude(get: Get, set: Set) {
  return { activite: () => appliquerLActivite(get, set) } satisfies Partial<CloturesDuJet>;
}

/** Les genres d'étape que ce module déclare (table `appliers`). */
export const GENRES_D_ETAPE = ['evenementDInterlude', 'bourseDInterlude'] as const;
/** Les tables tirables que ce module déclare (table `tablesTirables`). */
export const TABLES_TIRABLES = [INTERLUDE_EVENT_TABLE] as const;

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  appliers: {
    /** La LIGNE tirée résout l'Événement du héros de l'étape. */
    evenementDInterlude: (get, set, step, hero) => {
      const rolled = step.table?.result;
      if (!rolled || !hero) return;
      return { consequences: freeCons(finishInterludeEvent(get, set, hero, rolled.roll)) };
    },
    bourseDInterlude: (get, set) => {
      const lines = finishInterludeDraw(get, set);
      return { consequences: freeCons(lines.length ? lines : [msg('if.noPurseEvent')]) };
    },
  } satisfies PartDeTable<'appliers', typeof GENRES_D_ETAPE>,
  annonces: {
    /** Ce que les bourses vont perdre, et la vérification de faillite que les placements vont passer. */
    bourseDInterlude: (get) => {
      const d = denouementDuTirage(get());
      const lines = [...lignesDesPertes(get(), d), ...(d.faillite ? [msg('if.bankCrashDue')] : [])];
      return lines.length ? lines : [msg('if.noPurseEvent')];
    },
  } satisfies PartDeTable<'annonces', readonly ['bourseDInterlude']>,
  tablesTirables: {
    [INTERLUDE_EVENT_TABLE]: {
      label: msg('if.eventTableLabel'),
      get die() { return interludeEventDie(); },
      rows: INTERLUDE_EVENTS,
      lines: (die) => [interludeEventFor(die).label, interludeEventFor(die).desc],
      entryCategory: 'interludeEvents', // la ligne tirée EST l'Événement : sa fiche porte son texte
    },
  } satisfies PartDeTable<'tablesTirables', typeof TABLES_TIRABLES>,
} satisfies FragmentDeTables;
