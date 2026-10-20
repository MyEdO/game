/**
 * LES TABLES POSÉES DU JEU (#2889) — ce que le socle lit, et le seul endroit où il le lit. Chaque
 * registre d'hier est une table statique, déclarée par le module qui en possède les entrées et
 * rassemblée par `tablesDuJeu` (`noyau/tablesDuJeu.ts`) ; le propriétaire de l'état la pose par
 * `brancherLeJeu` (`noyau/branchement.ts`). Le socle ne lit jamais un module de tables : un test du
 * socle pose une fixture par le même seam (`avecLesTables`, `noyau/noyau.testkit.ts`).
 *
 * Module FEUILLE : il n'importe que des types — les listes de clés des modules comprises, lues par
 * `typeof` —, si bien que tout lecteur du socle peut le lire sans cycle d'évaluation.
 */
import type { Get, Set } from './flowTypes';
import type { Combatant } from '../engine/types';
import type { CascadeApplier, CascadeTableFold, ExtendedTestOutcomeApplier, TableStepDef, TableStepFamily } from './cascade';
import type { CombatHook } from './combatHooks';
import type { HitModifier } from './combat/hitModifiers';
import type { Cloture, RevealEntry } from './pendings';
import type { ManeuverPostHitHook } from './combatManeuvers';
import type { SequenceDef, SequenceFamilies } from './sequenceContract';
import type { SequenceScore, SequenceTieBreak, SequenceTieSide, SequencePotEffectFn, SequenceThrowFn } from './sequenceCore';
import type { PerilInterruptHandler } from './authorPerils';
import type { EtalGenerateur, CibleDEtal } from './etalLotFlow';
import type * as activityWorldRolls from './activityWorldRolls';
import type * as authorPerils from './authorPerils';
import type * as roundHooks from './combat/roundHooks';
import type * as triggeredTest from './combat/triggeredTest';
import type * as turnHooks from './combat/turnHooks';
import type * as combatEffects from './combatEffects';
import type * as combatFlow from './combatFlow';
import type * as combatManeuvers from './combatManeuvers';
import type * as testsDeScene from './testsDeScene';
import type * as corruptionFlow from './corruptionFlow';
import type * as embrigadementFlow from './embrigadementFlow';
import type * as encounterPsychFlow from './encounterPsychFlow';
import type * as innFlow from './innFlow';
import type * as interludeFlow from './interludeFlow';
import type * as landMarketFlow from './landMarketFlow';
import type * as merchantFlow from './merchantFlow';
import type * as portFlow from './portFlow';
import type * as pursuitFlow from './pursuitFlow';
import type * as restFlow from './restFlow';
import type * as riverVoyageFlow from './riverVoyageFlow';
import type * as seaActivities from './seaActivities';
import type * as seaVoyageFlow from './seaVoyageFlow';
import type * as shipwreck from './shipwreck';
import type * as tavernFlow from './tavernFlow';
import type * as travelFlow from './travelFlow';
import type * as travelPostes from './travelPostes';

/** La fonction qui JOUE un verbe de clôture (#1508). */
export type ClotureApplier<K extends Cloture['verbe']> = (get: Get, set: Set, c: Extract<Cloture, { verbe: K }>) => void;

/** L'exécuteur EN COMBAT du flux d'incantation standard, pour l'Effet `castSpell` (#98). */
export type LanceurDeSort = (get: Get, set: Set, caster: Combatant, target: Combatant, spellId: string) => void;

/** Un départage d'égalité déclaré, et le récit de ce qu'il a lu quand il en tient un. */
export interface Departage {
  departage: SequenceTieBreak;
  recit?: (a: SequenceTieSide, b: SequenceTieSide) => string;
}

/** Le générateur d'un étal, et ce qui le suit une fois posé. */
export interface EntreeDEtal {
  gen: EtalGenerateur;
  apres?: (get: Get, set: Set) => void;
}

/** Les clés de CODE d'une table fermée : l'union des listes `as const` que ses modules déclarent, chacun
 *  sa part de table TOTALE sur sa liste (`PartDeTable`). Un producteur de production est typé par elle ;
 *  le lecteur du socle reste ouvert (`TablesDuJeu`), ce qu'une fixture de test nomme y entre. */
export type GenreDEtape =
  | (typeof activityWorldRolls.GENRES_D_ETAPE)[number]
  | (typeof authorPerils.GENRES_D_ETAPE)[number]
  | (typeof roundHooks.GENRES_D_ETAPE)[number]
  | (typeof triggeredTest.GENRES_D_ETAPE)[number]
  | (typeof turnHooks.GENRES_D_ETAPE)[number]
  | (typeof combatEffects.GENRES_D_ETAPE)[number]
  | (typeof combatFlow.GENRES_D_ETAPE)[number]
  | (typeof combatManeuvers.GENRES_D_ETAPE)[number]
  | (typeof corruptionFlow.GENRES_D_ETAPE)[number]
  | (typeof embrigadementFlow.GENRES_D_ETAPE)[number]
  | (typeof encounterPsychFlow.GENRES_D_ETAPE)[number]
  | (typeof innFlow.GENRES_D_ETAPE)[number]
  | (typeof interludeFlow.GENRES_D_ETAPE)[number]
  | (typeof landMarketFlow.GENRES_D_ETAPE)[number]
  | (typeof merchantFlow.GENRES_D_ETAPE)[number]
  | (typeof portFlow.GENRES_D_ETAPE)[number]
  | (typeof pursuitFlow.GENRES_D_ETAPE)[number]
  | (typeof restFlow.GENRES_D_ETAPE)[number]
  | (typeof riverVoyageFlow.GENRES_D_ETAPE)[number]
  | (typeof seaActivities.GENRES_D_ETAPE)[number]
  | (typeof seaVoyageFlow.GENRES_D_ETAPE)[number]
  | (typeof shipwreck.GENRES_D_ETAPE)[number]
  | (typeof tavernFlow.GENRES_D_ETAPE)[number]
  | (typeof travelFlow.GENRES_D_ETAPE)[number]
  | (typeof travelPostes.GENRES_D_ETAPE)[number];
/** Les genres d'étape SANS applier, que l'hôte ou le jet traite : l'union des `GENRES_HOTES` des
 *  modules, et les genres de révélation (`RevealEntry['kind']`, minteur `revealToStep`). */
export type GenreHote =
  | (typeof combatEffects.GENRES_HOTES)[number]
  | (typeof combatFlow.GENRES_HOTES)[number]
  | (typeof testsDeScene.GENRES_HOTES)[number]
  | (typeof travelPostes.GENRES_HOTES)[number]
  | RevealEntry['kind'];

/** `A | B`, à condition que `A` et `B` soient DISJOINTES : un genre partagé rend `B` inassignable. */
type UnionDisjointe<A extends string, B extends string & ([A & B] extends [never] ? unknown : never)> = A | B;

/** Le genre d'une étape de cascade : à table (`GenreDEtape`), ou à l'hôte (`GenreHote`), jamais les deux. */
export type GenreDeCascade = UnionDisjointe<GenreDEtape, GenreHote>;
export type RegleDeSucces = (typeof seaVoyageFlow.REGLES_DE_SUCCES)[number];
export type IssueDeTestEtendu = (typeof seaActivities.ISSUES_DE_TEST_ETENDU)[number];
export type InterruptionDePeril =
  | (typeof seaVoyageFlow.INTERRUPTIONS_DE_PERIL)[number]
  | (typeof travelFlow.INTERRUPTIONS_DE_PERIL)[number];

/** La valeur d'une entrée de chaque table fermée. */
interface EntreesDesTables {
  appliers: CascadeApplier;
  plis: CascadeTableFold;
  reglesDeSucces: (sl: number) => boolean;
  issuesDeTestEtendu: ExtendedTestOutcomeApplier;
  tablesTirables: TableStepDef;
  scoresDeSequence: SequenceScore;
  departages: Departage;
  effetsDePot: SequencePotEffectFn;
  lancers: SequenceThrowFn;
  interruptionsDePeril: PerilInterruptHandler;
}

/** La part d'une table fermée qu'un module déclare : TOTALE sur sa liste de clés (une clé sans entrée,
 *  une entrée hors liste ne compilent pas). */
export type PartDeTable<T extends keyof EntreesDesTables, L extends readonly string[]> = { readonly [K in L[number]]: EntreesDesTables[T] };

/**
 * Les tables du jeu, telles que le socle les LIT. Trois sont TOTALES au type sur une union fermée :
 * `clotures` (verbes de `Cloture`), `sequences` (familles de `SequenceFamilies`) et `generateursDEtal`
 * (`CibleDEtal`). Dix sont FERMÉES à la déclaration : `appliers`, `plis`, `reglesDeSucces`,
 * `issuesDeTestEtendu`, `tablesTirables`, `scoresDeSequence`, `departages`, `effetsDePot`, `lancers` et
 * `interruptionsDePeril` — chaque module y déclare une part TOTALE sur sa liste de clés (`PartDeTable`),
 * et leurs producteurs de production sont typés par l'union des listes (`GenreDEtape`…) ; leur lecteur
 * reste indexé par chaîne, ce qu'une fixture nomme y entre (`avecLesTables`). Un genre d'étape SANS
 * applier se déclare à l'hôte (`GenreHote`) ; le genre d'une étape (`CascadeStep.kind`) est l'union
 * DISJOINTE des deux (`GenreDeCascade`). Une famille de tables
 * tirables dont les clés sont des ids de données reste un ACCESSEUR vivant (#1692), ouverte : la table
 * porte l'accesseur, jamais son évaluation.
 */
export interface TablesDuJeu {
  /** Conséquence d'une étape de cascade, par `kind`. */
  readonly appliers: Readonly<Record<string, CascadeApplier>>;
  /** Pli « après le dé » d'une étape à table, par `kind`. */
  readonly plis: Readonly<Record<string, CascadeTableFold>>;
  /** Prédicat de succès d'une étape batch sommée, par id de règle d'agrégat. */
  readonly reglesDeSucces: Readonly<Record<string, (sl: number) => boolean>>;
  /** Issue de domaine d'un Test étendu, par `kind`. */
  readonly issuesDeTestEtendu: Readonly<Record<string, ExtendedTestOutcomeApplier>>;
  /** Tables tirables dont l'id est écrit au code. */
  readonly tablesTirables: Readonly<Record<string, TableStepDef>>;
  /** Familles de tables tirables dérivées d'un dataset, lues après les tables écrites au code. */
  readonly famillesTirables: readonly TableStepFamily[];
  /** Hooks de cycle de vie de combat, dans leur ordre de déclaration (trié par `order` à la lecture). */
  readonly crochetsDeCombat: readonly CombatHook[];
  /** Sauvegardes post-touche, dans leur ordre de déclaration (trié par `order` à la lecture). */
  readonly modificateursDeTouche: readonly HitModifier[];
  /** Les verbes de clôture, TOUS (#1508). */
  readonly clotures: { readonly [K in Cloture['verbe']]: ClotureApplier<K> };
  readonly lancerLeSort: LanceurDeSort;
  /** Conséquence post-touche d'une manœuvre (LDB 85 l.213). */
  readonly apresToucheDeManoeuvre: ManeuverPostHitHook;
  /** Définitions de séquence, TOUTES (`SequenceFamilies`). */
  readonly sequences: { readonly [K in keyof SequenceFamilies]: SequenceDef<SequenceFamilies[K]> };
  readonly scoresDeSequence: Readonly<Record<string, SequenceScore>>;
  readonly departages: Readonly<Record<string, Departage>>;
  readonly effetsDePot: Readonly<Record<string, SequencePotEffectFn>>;
  readonly lancers: Readonly<Record<string, SequenceThrowFn>>;
  /** Protocole de reprise d'un péril d'auteur interrompant, par id. */
  readonly interruptionsDePeril: Readonly<Record<string, PerilInterruptHandler>>;
  readonly generateursDEtal: { readonly [K in CibleDEtal]: EntreeDEtal };
}

/** La part des tables qu'un module déclare. */
export type FragmentDeTables = Partial<Omit<TablesDuJeu, 'clotures' | 'generateursDEtal' | 'sequences'>> & {
  readonly clotures?: Partial<TablesDuJeu['clotures']>;
  readonly sequences?: Partial<TablesDuJeu['sequences']>;
  readonly generateursDEtal?: Partial<TablesDuJeu['generateursDEtal']>;
};

let posees: TablesDuJeu | null = null;

/** Les tables posées par le propriétaire de l'état. Rien de posé : aucun jeu ne tourne, et le socle
 *  qui les lit le dit. */
export function tablesPosees(): TablesDuJeu {
  if (!posees) throw new Error('[noyau] tables du jeu non posées (`brancherLeJeu`)');
  return posees;
}

/** Pose les tables — réservé à `brancherLeJeu`, qui garantit le propriétaire unique. */
export function poserLesTables(tables: TablesDuJeu): void { posees = tables; }

/** Retire les tables — réservé à `debrancherLeJeu`. */
export function retirerLesTables(): void { posees = null; }

