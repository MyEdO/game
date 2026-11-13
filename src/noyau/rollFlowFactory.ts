/**
 * Fabrique générique des « flux de jet différé ».
 *
 * Chaque modale de jet (Piétinement, Course, Focalisation, Psychologie, Frénésie, Rechargement,
 * Se libérer/Étouffer, Test de compétence, Évaluation, Marchandage, Soin…) suit le MÊME cycle de
 * vie, jusqu'ici copié-collé par flux dans le store (~6 actions × ~10 lignes chacune) :
 *
 *   ouvrir (pending posé) → Lancer (`lancer`) → Chance : relancer (`relancer`, LDB 12 : jet propre
 *   raté, 1× max) ou +1 DR (`ajouterUnDR`, LDB 17 l.24) → Résilience : réussite garantie
 *   (`forcerLaReussite`, LDB 17 l.68 : AVANT le jet ou après un échec) → Appliquer / Annuler.
 *
 * La fabrique centralise la plomberie commune (gardes, dépense de Chance/Résilience, drapeau
 * `rerolled`, patch de re-rendu) ; chaque flux ne déclare QUE sa partie métier via `RollFlowSpec`
 * (cf. `rollFlowSpecs.ts`). Le corps de « Appliquer » (`CloturesDuJet`, joué par `jetValider(flux)`) reste écrit à la
 * main : ses effets sont tous différents — c'est la règle, pas la plomberie.
 *
 * Garde-fou : les primitives de résolution (RNG, moteur) ne sont appelées QUE par `resolve`/
 * `reresolve`/`bonus.derive`/`force.derive`, eux-mêmes invoqués uniquement par les résolveurs
 * générés ici — câblés dans le store sous des noms `*Roll`/`*Reroll`/… que le test statique
 * `roll-modal-invariant.hors-store.test.ts` continue de vérifier.
 */
import type { Jeu } from './etat';
import { refuserGeste, refuserGesteDuSiege } from './refusVisible';
import { libelleDeLaFermeture } from './libelles';
import type { Combatant, Difficulty, ReverseQuery } from '../engine/types';
import { canReroll } from '../engine/fortune';
import { availableResistance, markResistanceUsed, resistanceForcedSL, resistanceImproves, type MenaceId } from '../engine/menace';
import { consumeActiveFlag, freeRerollOf } from '../engine/activeFlags';
import { touchActors } from './combatOrParty';
import { journaliser } from './combatLog';
import { surfaceOf } from './rollSeam';
import { gainCorruption } from './corruptionFlow';

import type { Get, PatchDeFlux, Set } from './flowTypes';
import { PORTEURS_D_ETAPE } from './slotsDeJet';
import { bumpSL, evaluateTest, maxForcedRoll, forcedTR, bestForcedRoll, cibleBrute, type TestResult } from '../engine/tests';
import { applyReverse, reverseAvailable as engineReverseAvailable, reversePreview as engineReversePreview, type EvaluationDeRangee, type IssueDuDe } from '../engine/reverseToken';
import { clampFixedRoll } from '../engine/fixedDie';
import { TestOutcome } from '../engine/testOutcome';
import { canFixDie, influencesLocally } from './netOwnership';
import { VERBES_DE_JET, type RollVerb } from './flowVerbs';
import { tableTotale } from '../lib/tableTotale';
import { t } from '../i18n';
import { nomDe } from '../engine/nom';

/**
 * FENÊTRES D'INFLUENCE — prédicats PURS, écrits UNE fois, à côté des ops qui les exécutent
 * (`opReroll`, `opBonusSL`, `opDarkPact`, `opForceSuccess`) et qui les appellent pour se garder. Ils rendent
 * ce qui FERME le verbe (`FermetureDuJet`), `null` quand il est ouvert. La coquille d'affichage les consomme
 * (rangée, influence, Chance), et la fabrique les compose en `fermetures` pour le
 * lecteur des verbes ouverts (`verbesOuverts.ts`) : une modale ne déclare que les FAITS de son jet, jamais une
 * éligibilité.
 *
 * Ce qu'ils NE disent PAS : si le flux OFFRE le verbe. Cela se lit à la PRÉSENCE du handler
 * (`onReroll`/`onDarkPact`/`onForce`) — un flux qui n'offre pas la Résilience ne passe pas `onForce`,
 * et aucun booléen ne peut le rallumer.
 */

/** Ce qui ferme un verbe du cycle de jet, ou la sortie d'une fenêtre (`sortieFermee`, `modalArbiter.ts`), maintenant ;
 *  son libellé est `jet.ferme.<code>` (`libelleDeLaFermeture`). */
export type FermetureDuJet =
  | 'sansJet' | 'nonOffert' | 'sansActeur' | 'rangeeTemoin' | 'jetImpose'
  | 'jetNonLance' | 'jetLance' | 'jetReussi' | 'dejaRelance'
  | 'sansChance' | 'sansResilience' | 'reserveAuxHeros'
  | 'deNonFixable' | 'desFixesInactifs' | 'sansVoieDInversion' | 'sansMenace' | 'sansResistance'
  | 'declarationsDues' | 'oppositionsDues' | 'choixCritiqueDu' | 'actionEngagee'
  | 'choixDu' | 'etapesDues' | 'etapesJouees' | 'rienADeclarer' | 'contreSortDu' | 'soinEnCours' | 'acteAChanger' | 'paieDue' | 'halteDeVoyage' | 'herosADesigner'
  | 'quorumAttendu' | 'noteNonCouverte' | 'evenementsATirer' | 'rienARepartir' | 'seanceDuChapitre' | 'choixAReprendre'
  | 'preparationDeBataille' | 'batailleTerminee' | 'testSpectaculaireDu';

/** Les fermetures qui attendent une DÉCISION du joueur : le verbe se montre refusé, sa raison dite, au lieu de se taire. */
export const FERMETURES_DITES: ReadonlySet<FermetureDuJet> = new Set<FermetureDuJet>(['declarationsDues', 'oppositionsDues', 'choixCritiqueDu', 'actionEngagee']);

/** Ce qui ferme chaque verbe de jet (`null` : ouvert), clôture (`valider`) comprise, lu par `RollFlowHandlers.fermetures`. */
export type FermeturesDuJet = Record<RollVerb, FermetureDuJet | null>;

/** Ressources d'influence du jeteur — dérivées du `Combatant`, ou fournies en primitives par une
 *  vue pure (rangée sans objet `Combatant`). Construite par `actorInfluenceView`, jamais à la main. */
export interface RollActorView {
  kind?: Combatant['kind'];
  fortune: number;
  resilience: number;
  /** Relance GRATUITE armée (Bénédiction de Chance, `LDB 41`). */
  freeReroll: boolean;
}

/** État du jet de la rangée. `failed` se juge sur le jet PROPRE (`LDB 12 l.13`, cf. `canReroll`),
 *  jamais sur l'issue d'une opposition — celle-ci a son propre champ, `lost`. */
export interface RollInfluenceView {
  rolled: boolean;
  failed: boolean;
  rerolled?: boolean;
  /** Test OPPOSÉ : cette rangée PERD l'opposition, jet propre réussi compris. La Résilience s'y joue
   *  (`LDB 17 l.68` : « S'il s'agit d'un Test opposé, vous l'emportez avec au moins DR +1 ») ; la
   *  Chance, non (`canReroll` : le jet propre seul). */
  lost?: boolean;
}

/** Relance GRATUITE armée sur l'acteur (`LDB 41`). */
export function freeRerollAvailable(actor?: Combatant | null): boolean {
  return freeRerollOf(actor);
}

/** Construit la vue de ressources — CONSTRUCTEUR UNIQUE : l'acteur fait foi, les primitives ne
 *  servent qu'aux vues sans `Combatant` et priment quand elles sont fournies. */
export function actorInfluenceView(
  actor?: Combatant | null,
  over?: { fortune?: number; resilience?: number },
): RollActorView {
  return {
    ...(actor?.kind !== undefined ? { kind: actor.kind } : {}),
    fortune: over?.fortune ?? actor?.fortune ?? 0,
    resilience: over?.resilience ?? actor?.resilience ?? 0,
    freeReroll: freeRerollAvailable(actor),
  };
}

/** Chance — `LDB 17 l.23` + `LDB 12 l.40` ; ou relance gratuite `LDB 41`. Fenêtre de `opReroll`. */
export function fermetureDeLaRelance(a: RollActorView, v: RollInfluenceView): FermetureDuJet | null {
  if (!v.rolled) return 'jetNonLance';
  if (!canReroll(v.failed, !!v.rerolled)) return v.rerolled ? 'dejaRelance' : 'jetReussi';
  return a.freeReroll || a.fortune > 0 ? null : 'sansChance';
}

/** Chance « +1 DR » — `LDB 17 l.24`. Fenêtre de `opBonusSL`. */
export function fermetureDuBonus(a: RollActorView, v: RollInfluenceView): FermetureDuJet | null {
  if (!v.rolled) return 'jetNonLance';
  return a.fortune > 0 ? null : 'sansChance';
}

/** Sombre Pacte — `LDB 19 l.17`. Fenêtre de `opDarkPact`. */
export function fermetureDuPacte(a: RollActorView, v: RollInfluenceView): FermetureDuJet | null {
  if (!v.rolled) return 'jetNonLance';
  return a.kind === 'heros' ? null : 'reserveAuxHeros';
}

/** Résilience « Je ne faillirai pas ! » — `LDB 17 l.68` : avant le jet, ou après un échec. Composée par
 *  `fermetureDuForcage`, fenêtre de `forcerLaReussite`. */
export function fermetureDeLaResilience(a: RollActorView, v: RollInfluenceView): FermetureDuJet | null {
  if (v.rolled && !v.failed && !v.lost) return 'jetReussi';
  return a.resilience > 0 ? null : 'sansResilience';
}

/** Champs communs à tous les objets `pending*` gérés par la fabrique. */
export interface PendingBase {
  rerolled?: boolean;
  /** Réussite forcée par Résilience (LDB 17 l.68) — posé par `forcerLaReussite`, ouvre `imposerLeResultat`. */
  forcee?: boolean;
  /** MENACE à laquelle ce Test RÉSISTE (« Résistance (Menace) », LDB 10 l.1016-1020 : `maladie` /
   *  `corruption` / `mutation` / `magie` / `poison`…) — posé par le SITE qui ouvre le pending/l'étape.
   *  Présent + talent disponible ⇒ le verbe `resister` offre l'auto-succès (1× par spec et par séance). */
  menace?: MenaceId;
  /** DÉ FIXÉ à la main (option de confort « Dés fixés », `engine/fixedDie.ts`) — PROVENANCE, pas une
   *  règle : distingue le dé saisi par le joueur (aucun coût, jet évalué au naturel) du dé CHOISI de la
   *  Résilience (`forcee`, réussite garantie). Lu par l'UI (mention « dé fixé » sur la rangée). */
  fixed?: boolean;
}

/**
 * Résolution FORCÉE — auto-succès du MÊME mécanisme pour DEUX sources RAW.
 * Passé en 5ᵉ argument de `resolve` :
 *  - `{}`               → `forcerLaReussite` (Résilience, LDB 17 l.68) : le flux applique son dé PAR
 *                          DÉFAUT (01 → DR max, ou, en Test opposé, le jet courant forcé à l'emporter) ;
 *  - `{ roll: n }`      → `imposerLeResultat` (Résilience) : le joueur a CHOISI le dé `n` (doit rester une réussite) ;
 *  - `{ sl: n }`        → `resister` (Résistance (Menace), LDB 10 l.1016-1020) : auto-succès à DR IMPOSÉ
 *                          (« utilisez votre Bonus d'Endurance comme DR pour le Test ») — pas de choix du dé.
 * Absent (`resolve` appelé sans ce paramètre) → jet NORMAL (RNG). Un seul résolveur porte donc tous
 * les cas, au lieu des dérives séparées `force`/`forceRoll` (le « code dérivé » d'avant).
 */
export interface ForcedResolve {
  roll?: number;
  /** DR imposé de l'auto-succès du talent Résistance (Menace) — seulement via le verbe `resister`
   *  (`caps.resister`) ; les flux qui ne le déclarent pas ne le reçoivent jamais. */
  sl?: number;
  /** Le dé `roll` est FIXÉ par le joueur (option « Dés fixés »), pas choisi au titre de la Résilience :
   *  le résolveur l'évalue AU NATUREL (`evaluateTest`) — réussite, DR et double se dérivent du dé, aucune
   *  réussite garantie ni plancher de DR. Jamais posé par `forcerLaReussite`/`resister`. */
  fixed?: boolean;
}

/**
 * Props du sélecteur de dé PARTAGÉ (« Je ne faillirai pas ! », LDB 17 l.68). Renvoyé par
 * `caps.picker` quand le Test forcé offre un CHOIX du dé (attaque/défense/incantation/piétinement/
 * Peur) — `null` = pas de picker (flux binaire, ou avant `forcerLaReussite`). Le dé choisi pilote le DR,
 * le Critique (11) ET la localisation inversée. Co-localisé avec `resolve` : un seul endroit connaît
 * la forme du résultat du flux.
 */
export interface ForcedPick {
  roll: number;
  /** Cible du dé AVANT bornage (`cibleBrute` d'un jet posé) : le constructeur qui réévalue le dé
   *  (`evaluateTest`/`forcedTR`) la borne et en mesure l'écrêtage lui-même. */
  target: number;
  /** Valeur NUE testée (avant Difficulté et modificateurs), quand le slot la porte : le `TestResult`
   *  reconstruit sur un dé CHOISI ou FIXÉ la reconduit, faute de quoi le départage d'un Test opposé
   *  (LDB 12 l.160) retombe sur les cibles modifiées des deux camps. */
  base?: number;
  /** Le double (11) a un effet (Coup/Incantation Critique) → bouton « 11 · Critique ». */
  critable?: boolean;
  /** FACES du dé quand ce n'est pas un d100 (dé de lot d'étal : d10…). Le champ s'y borne — sans quoi
   *  il accepterait un 73 sur un dé à 10 faces et afficherait une valeur intirable. */
  max?: number;
}

/** Dé LU sur un jet posé (`TestResult`, `RollBreakdown`, ou sa projection stockée) : sa cible AVANT
 *  bornage (`cibleBrute`) et sa valeur nue. SEULE forme de lecture des accesseurs de dé. */
export function deDuJet(t: { roll: number; target: number; base?: number; clamped?: number }, critable = false): ForcedPick {
  return { roll: t.roll, target: cibleBrute(t), ...(t.base != null ? { base: t.base } : {}), critable };
}

/**
 * Lentille de DÉRIVATION des verbes d'influence (Chance +1 DR / Résilience « Je ne faillirai pas ! » /
 * Résistance Menace). Ces règles sont GLOBALES (LDB 17 l.24/68) : quand un flux fournit sa lentille,
 * la fabrique compose `ajouterUnDR`/`forcerLaReussite`/`imposerLeResultat`/`resister` DEPUIS elle — la mécanique vit
 * seulement ICI, le flux ne déclare que SA FORME. Un flux sans lentille retombe sur le chemin `resolve(forced)`
 * / `bonus.derive` (repli). Le `+1 DR` passe TOUJOURS par `bumpSL`, qui n'écrit jamais `success`
 * (LDB 17 l.24 ; succès du Test : LDB 12 l.11).
 */
export interface RollFlowLens<P extends PendingBase, Slot extends PendingBase = P> {
  /** TestResult ACTEUR courant du slot (post-jet), ou `null` (pas encore lancé / rien à re-dériver). */
  actorTR: (slot: Slot) => TestResult | null;
  /** Re-dérive le patch du slot depuis un TestResult acteur canonique — FINISHER PUR (aucun RNG) : re-oppose
   *  contre le figé si opposé, projette vers la forme concrète. `null` = cas interdit (pas de dépense). */
  applyRoll: (s: Jeu, slot: Slot, actor: Combatant, get: Get, tr: TestResult, p: P) => Partial<Slot> | null;
  /** Cible du dé de l'acteur (valeur ≤ = réussite) → source de `maxForcedRoll`/`evaluateTest`. ABSENT ⇒ le
   *  flux ne construit jamais de dé forcé (opposé binaire → `forceWin` ; pas de picker → pas de setForcedRoll). */
  dieTarget?: (slot: Slot, actor: Combatant) => number | null;
  /** Plancher de DR d'une réussite forcée (défaut 1 ; opposé attaque/défense : DR de l'opposant + 1). */
  floorSL?: (slot: Slot, actor: Combatant) => number;
  /** forceSuccess « sans re-dériver le dé » : opposé BINAIRE (→ issue « success ») ou flip-success simple.
   *  PRÉSENT ⇒ forceSuccess l'utilise au lieu de `applyRoll(forcedTR(…))`. `null` = interdit / déjà réussi. */
  forceWin?: (slot: Slot, actor: Combatant, tr: TestResult | null) => Partial<Slot> | null;
}

/**
 * ISSUE CANONIQUE d'un jet — source UNIQUE de « a-t-il réussi + de combien ». `won` = la réussite
 * RÉELLE du flux (la MÊME que lit la narration et l'« Appliquer ») ; `sl` = le Degré de Réussite
 * courant. La fabrique en DÉRIVE le gating des verbes d'influence (`failed = !outcome(slot).won`) :
 * un flux ne déclare plus un prédicat `failed` SÉPARÉ, qui pouvait DIVERGER de l'issue (bug `activity` :
 * la narration lisait `combinedLevel`, l'ancien `failed` lisait skill-1 → Chance/Résilience mal gatées).
 *
 * SCELLÉE (#275 Décision 2, `TestOutcome`, `engine/testOutcome.ts`) — un flux ne peut plus renvoyer un
 * littéral `{won, sl}` forgé : seul `TestOutcome.seal(...)` construit cette issue.
 */
export type RollOutcome = TestOutcome;

export interface RollFlowSpec<P extends PendingBase, Slot extends PendingBase = P, Ctx = void> {
  /** Clé du pending dans le store (ex. `'pendingBattement'`). */
  key: Exclude<keyof Jeu, 'journal'> & string;
  /**
   * MULTI (N jets dans une modale) : énumère les SLOTS de jet du pending, leur id, et les ré-injecte.
   * ABSENT ⇒ MONO : le pending EST le slot unique (`pid` ignoré par les handlers). Une SEULE fabrique
   * pour les deux — le mono est le cas dégénéré N=1 (plus de `makeMultiRollFlow` recopié).
   */
  multi?: {
    slots: (p: P) => Slot[];
    idOf: (slot: Slot) => string;
    replace: (p: P, slots: Slot[]) => P;
    /** Flux SÉQUENTIEL : le refus du slot `pid` qui ne se joue pas maintenant, `null` s'il se joue. Un verbe refusé
     *  le dit (`refuserGeste`) et ne fait rien ; une lecture (`reverseAvailable`) n'en écrit rien. Absent : tout slot
     *  se joue. */
    refusDuSlot?: (s: Jeu, pid: string) => string | null;
    /** Le jet sans rangée de la fenêtre, quand il n'est pas celui de chaque rangée à lancer (`rangeesALancer`) : la
     *  séquence entière (« Tout résoudre », `cascade`). Absent : chaque rangée à lancer. */
    sansRangee?: (get: Get, set: Set) => void;
  };
  /** Le jet a-t-il déjà été lancé ? (`slot.result != null` / `slot.roll != null`). */
  rolled: (slot: Slot) => boolean;
  /** L'acteur qui dépense Chance/Résilience. `undefined` → l'action de dépense est ignorée. */
  actor: (s: Jeu, slot: Slot, p: P) => Combatant | undefined;
  /**
   * Patch du SLOT qui pose le jet (appelle le moteur + RNG). `null` → abandon silencieux
   * (précondition manquante : cible disparue, sort introuvable…) — AVANT toute dépense de point.
   * `actor` peut être `undefined` au premier jet (certains flux n'en ont pas besoin pour lancer).
   * `get` : accès au store pour les résolveurs qui lisent l'environnement (resolveAttack). `forced`
   * (seulement si `caps.forcer`) : Résilience — cf. `ForcedResolve`. Absent → jet normal. `p` (dernier
   * arg) : le pending parent, pour un flux multi qui lit un contexte partagé (MONO : `slot === p`).
   */
  resolve: (s: Jeu, slot: Slot, actor: Combatant | undefined, get: Get, forced?: ForcedResolve, p?: P) => Partial<Slot> | null;
  /** Patch de RELANCE (défaut : `resolve`) — utile en Test opposé où l'adversaire garde son jet figé. */
  reresolve?: (s: Jeu, slot: Slot, actor: Combatant, get: Get, p?: P) => Partial<Slot> | null;
  /**
   * ISSUE CANONIQUE du slot (cf. `RollOutcome`) : SOURCE UNIQUE de « réussi + de combien ». La fabrique
   * DÉRIVE d'elle le gating de la Chance/Pacte/Résistance (`failed = !outcome(slot).won`), sans
   * prédicat `failed` séparé qui pourrait DIVERGER de l'issue réelle du flux. `won` lit un jet EXISTANT ;
   * le « a-t-il été lancé ? » reste porté par `rolled(slot)` (Chance : LDB 12, jet propre raté, 1× max).
   */
  outcome: (slot: Slot) => RollOutcome;
  /**
   * ISSUE JOURNALISÉE du flux — la MÊME donnée que la fenêtre montre (`describeX` de `flowOutcomes`),
   * DÉCLARÉE ici et rendue par le verbe terminal `apply` : le site d'acquittement ne compose plus la
   * ligne, il acquitte. `ctx` porte ce que seule l'APPLICATION connaît (le DR cumulé réalisé, le nom
   * résolu de l'arme) — des données, jamais du texte. Chaîne vide / `null` = rien à journaliser.
   */
  issue?: (p: P, s: Jeu, ctx: Ctx) => string | string[] | null | undefined;
  /**
   * CANAL de rendu de l'issue : `'log'` (journal narratif — défaut) ou `'battle'` (journal de combat,
   * `ev()`/`battle.log`) où `apply` REND les lignes sans les écrire : le site les tisse dans son propre
   * `set({ battle })` atomique (une écriture séparée écraserait le `battle` qu'il tient déjà).
   */
  issueChannel?: 'log' | 'battle';
  /** Chance « +1 DR » (absent → le flux ne l'offre pas). `guard` → cas interdits (ex. Test binaire). */
  bonus?: { guard?: (slot: Slot) => boolean; derive: (s: Jeu, slot: Slot, actor: Combatant, p?: P) => Partial<Slot> | null };
  /**
   * Inversion de Test (LDB 23 l.209/218, jeton d'Activité ; LDB 10, Talents « vous pouvez inverser ») :
   * un CHOIX du joueur (jamais automatique, #558). Deux gates DISTINCTES (`engine/reverseToken.ts`,
   * #508 réfutation) : le Talent seulement sur un jet RATÉ qu'elle transformerait en réussite ; le
   * jeton d'Activité SANS restriction (réussi ou raté — le choix, et son issue possiblement dégradée,
   * appartiennent au joueur). Absent → le flux n'offre pas l'inversion.
   */
  reverse?: {
    /** Test de CE jet (Compétence `{skill, spec}` et contexte), matché STRUCTURÉ contre Talent/jeton.
     *  `null` → non concerné. */
    skillOf: (s: Jeu, slot: Slot, actor: Combatant, get: Get<Jeu>, p: P) => ReverseQuery | null;
    /** Dé/cible ACTEUR courants (post-jet, avant inversion). `null` → rien à inverser. */
    current: (slot: Slot, p: P) => { roll: number; target: number } | null;
    /** ÉVALUATION de la rangée pour le Test naturel `tr` (dé contre la cible de `current`) : le patch du
     *  slot et l'issue qu'il porte. SOURCE UNIQUE de l'offre du Talent (« si cela entraîne un succès »),
     *  de l'aperçu et de l'application — `success` REFLÈTE le jet réel, jamais forcé. */
    evaluate: (s: Jeu, slot: Slot, actor: Combatant, get: Get<Jeu>, tr: IssueDuDe, p: P) => { patch: Partial<Slot>; issue: IssueDuDe } | null;
  };
  /** Lentille de dérivation des verbes d'influence (cf. `RollFlowLens`). PRÉSENTE ⇒ la fabrique compose
   *  bonusSL/forceSuccess/setForcedRoll/resist depuis elle (le `bonus` et la branche `if(forced)` de
   *  `resolve` deviennent inutiles pour ce flux). ABSENTE ⇒ repli byte-identique sur le chemin actuel. */
  lens?: RollFlowLens<P, Slot>;
  /**
   * ACCESSEUR DE DÉ — la SEULE chose qu'un flux déclare pour recevoir, du socle : le sélecteur de dé
   * (Résilience « vous choisissez le résultat », LDB 17 l.68), l'ÉVALUATION d'un dé FIXÉ (option de
   * confort) et son marquage. Aucune logique locale : `read` dit OÙ vivent `{roll, target}` du slot,
   * `write` PROJETTE un `TestResult` re-dérivé sur la forme de ce slot.
   *
   * Un flux à `lens` l'obtient GRATUITEMENT (`actorTR` → `read`, `applyRoll` → `write`) : ne le déclarer
   * que si la forme du résultat est propre au flux (attaque, incantation, étape de cascade…). Ajouter un
   * flux demain = déclarer cet accesseur, rien d'autre — l'évaluation, elle, vit dans `makeRollFlow`.
   *
   * `write` reçoit un `TestResult` NATUREL (issu d'`evaluateTest`) : aucune politique n'y est appliquée —
   * les planchers (DR +1 d'un Test opposé, NI d'une incantation) appartiennent au chemin RÉSILIENCE, pas
   * au dé fixé, dont l'issue est celle du dé, échec compris.
   */
  die?: {
    read: (slot: Slot, actor: Combatant | undefined, p?: P) => ForcedPick | null;
    write: (s: Jeu, slot: Slot, actor: Combatant | undefined, get: Get, tr: TestResult, p: P) => Partial<Slot> | null;
    /** POLITIQUE Résilience : plancher de DR d'une réussite forcée (défaut 1). Un Test OPPOSÉ le porte à
     *  « DR de l'opposant + 1 » — LDB 17 l.68 : « vous l'emportez avec au moins DR +1 ». PARAMÈTRE, pas
     *  une branche : il ne concerne QUE le dé choisi au titre de la Résilience (un dé FIXÉ n'a aucun
     *  plancher, son issue est celle du dé). */
    floorSL?: (slot: Slot, actor: Combatant | undefined, p: P) => number;
    /** ÉCRIVAIN de la seule voie RÉSILIENCE, quand la réussite achetée entraîne plus qu'une projection
     *  (incantation : DR de Talent, doublement de malepierre, plancher de NI). Absent = `write`. */
    resilience?: (s: Jeu, slot: Slot, actor: Combatant | undefined, get: Get, tr: TestResult, p: P) => Partial<Slot> | null;
  };
  /**
   * Traits déclaratifs du flux. `forcer` : ce flux offre la Résilience (LDB 17 l.68, GLOBALE),
   * résolue DANS `resolve(…, forced)` — un seul résolveur porte les trois cas (jet normal,
   * `forcerLaReussite` = dé par défaut, `imposerLeResultat` = dé choisi). Un flux qui NE pose PAS `forcer`
   * n'offre simplement pas la Résilience (`forcerLaReussite`/`imposerLeResultat` y sont des no-op : reload,
   * marchandage, évaluation…). Plus aucune dérive `force`/`forceRoll` séparée — cf. `ForcedResolve`.
   *
   * `selecteur` : OÙ vit le dé de ce flux — PARAMÈTRE de FORME, jamais une autorisation. Mesuré après
   * l'absorption du sélecteur dans `RollShell` : les flux à LENTILLE n'en déclarent PLUS (la fabrique le
   * dérive de `actorTR`/`dieTarget`) ; il ne subsiste que pour les résultats de forme PROPRE, non
   * exprimables par une lentille — attaque/défense/piétinement/coup dans le dos (`result.attackerDetail`),
   * incantation (`CastResult`, `critable` faux pour une Prière), étape de cascade (`step.result`/`target`),
   * Test `fuite` du fuyard (`slot.jet`). Le QUAND (Résilience vs dé fixé, avant/après le jet) ne s'écrit
   * plus ici : l'hôte l'arbitre une seule fois, à la pose du dé.
   */
  caps?: {
    forcer?: boolean;
    selecteur?: (slot: Slot, actor: Combatant | undefined) => ForcedPick | null;
    /** Ce flux accepte l'auto-succès du talent Résistance (Menace) (LDB 10) : son `resolve` porte la
     *  branche `forced.sl` (DR = Bonus d'Endurance). Offert seulement sur un slot tagué `menace`. */
    resister?: boolean;
  };
  /**
   * Undo MÉTIER optionnel de l'annulation (ex. défaire-charge de l'attaque…).
   * PRÉSENT ⇒ il OWN la fermeture (il fait lui-même tous les `set`, y compris nuller le pending et
   * avancer/nuller la cascade-hôte selon les cas) : `annuler` lui délègue tout et ne touche à rien
   * d'autre. ABSENT ⇒ `annuler` applique le teardown par défaut (nulle le pending, et la cascade
   * quand elle l'héberge, cf. `annuler`). */
  onCancel?: (get: Get, set: Set, p: P) => void;
  /** Refus de l'annulation, dit au joueur (`refuserGeste`), `null` quand elle se joue. Lu avant
   *  `onCancel` et le teardown par défaut. */
  refusDAnnuler?: (s: Jeu, p: P) => string | null;
  /** Jet INITIAL métier (garde de phase, effets avant le jet, journal), symétrique d'`onCancel`.
   *  PRÉSENT ⇒ il OWN le jet tant qu'il n'est pas lancé : `lancer` lui délègue tout. ABSENT ⇒ `lancer` résout par
   *  `spec.resolve`. */
  onRoll?: (get: Get, set: Set, p: P) => void;
  /** Le crochet du PREMIER jet d'un slot, joué au seul point d'écriture des ops (`Commit`) par tout geste qui le pose
   *  (lancer, dé choisi, Résilience, Résistance), avant la dépense du geste : `false` arrête l'écriture (refus dit, ou
   *  une autre voie que le crochet a prise). Absent : tout premier jet s'écrit. */
  premierJet?: (get: Get, set: Set, p: P) => boolean;
  /** Patch de re-rendu après mutation en place de l'acteur. Défaut : `touchActors` (combat ⇄ groupe). */
  touch?: (s: Jeu) => PatchDeFlux;
  /** Le jet du slot est IMPOSÉ (2ᵉ frappe du Maniement de deux armes, LDB 10 l.767-773) : ni relance, ni Pacte, ni
   *  inversion, ni annulation. Absent : aucun jet imposé. */
  jetImpose?: (slot: Slot) => boolean;
  /** MULTI : le jet de la FENÊTRE est posé, quand ce ne sont pas tous ses slots (une rangée déclarée sans Test, un
   *  Test du fuyard qui n'est pas dû). Absent : chaque slot est lancé. */
  jetPose?: (p: P) => boolean;
  /** QUAND la fenêtre se clôt (`valider`) et s'annule (`annuler`) : par défaut, la clôture une fois le jet posé
   *  (`jetPose`) et l'annulation tant qu'aucun jet n'est lancé ; `toujours`, à tout moment de la fenêtre. Les gardes
   *  de `annuler` et de `valider` (`fermetures(…)`) lisent cette déclaration. */
  clotures?: { valider?: 'toujours'; annuler?: 'toujours' };
  /** Ce qui ferme l'annulation du pending au-delà de son jet, lu sur l'état `s` (`null` : rien). Absent : rien. */
  annulation?: (p: P, s: Jeu) => FermetureDuJet | null;
  /** Ce qui ferme la clôture (`valider`) du jet posé, lu sur l'état `s` (`null` : rien). Absent : rien. */
  cloture?: (p: P, s: Jeu) => FermetureDuJet | null;
  /** Test OPPOSÉ : le slot PERD l'opposition, jet propre réussi compris (`RollInfluenceView.lost`, LDB 17 l.68). */
  perdu?: (slot: Slot) => boolean;
}

export interface RollFlowHandlers {
  /** `pid` : id du slot ciblé (MULTI). Absent ⇒ MONO (le pending est le slot unique). */
  lancer: (get: Get, set: Set, pid?: string) => void;
  relancer: (get: Get, set: Set, pid?: string) => void;
  ajouterUnDR: (get: Get, set: Set, pid?: string) => void;
  /** Résilience (LDB 17 l.68). Avant le jet, `auJet` encadre le geste pré-jet (`creerVerbesDeJet`) : `forcer` se passe
   *  du dé quand le flux le sait (vrai : un point dépensé), sinon le jet du flux tombe d'abord, puis il est forcé. */
  forcerLaReussite: (get: Get, set: Set, pid?: string, auJet?: (forcer: () => boolean) => void) => void;
  /** Choix du dé d'un Test forcé (no-op sans `caps.forced` ou avant `forcerLaReussite`). */
  imposerLeResultat: (get: Get, set: Set, roll: number, pid?: string) => void;
  /** Résistance (Menace), LDB 10 l.1016-1020 : auto-succès du premier Test qui résiste à la menace
   *  taguée sur le slot (`menace`), DR = Bonus d'Endurance, 1× par spec et par séance. No-op sans
   *  `caps.resister`, sans tag, sans talent disponible, ou si le Test est déjà réussi. */
  resister: (get: Get, set: Set, pid?: string) => void;
  /** Ce flux sait-il RÉÉVALUER un dé saisi (option « Dés fixés ») ? Vrai ssi son ACCESSEUR DE DÉ est
   *  complet (lire où vit le dé ET réécrire l'issue re-dérivée). Faux ⇒ aucune affordance côté UI et
   *  verbe inerte côté store — jamais une réussite gratuite. */
  fixable: boolean;
  /** Où vit le dé du slot (l'ACCESSEUR `read`). `slot` est le pending/participant CONCRET ; `s` (l'état)
   *  permet au socle de retrouver le pending PARENT — certaines formes multi y rangent la cible (Test
   *  Étendu). `any` ici : les handlers ne portent pas `Slot`. */
  picker?: (slot: any, actor: Combatant | undefined, s?: Jeu) => ForcedPick | null;
  /** Slot CONCRET visé (MONO : le pending ; MULTI : le participant `pid`, ou le premier). Accesseur
   *  PUR en LECTURE SEULE — extraction de `locate` sans son `commit`. Il ouvre à l'UI la provenance du
   *  slot (`forcee`/`fixed`) et sa forme, sans qu'elle ait à connaître la clé de pending du flux :
   *  c'est ce qui permet à `RollShell` de dériver le sélecteur de dé pour TOUT flux. `null` si le
   *  pending est fermé ou le `pid` inconnu. */
  slotOf: (get: Get, pid?: string) => PendingBase | null;
  /** Les ids des rangées du flux ouvert (`multi.idOf` de chaque slot) ; vide : un flux à un jet, ou fermé. */
  rangees: (get: Get<Jeu>) => string[];
  /** Refus du slot `pid` d'un flux multi (`spec.multi.refusDuSlot`), `null` s'il se joue : le texte que TOUT verbe
   *  du slot dit en se refusant (`locate`), lu tel quel par la rangée qui ferme ses gestes. */
  refusDuSlot: (get: Get, pid?: string) => string | null;
  /** Le jet sans rangée d'un flux multi : son corps propre (`multi.sansRangee`), sinon chaque rangée à lancer, sans jet
   *  et que le flux ne refuse pas ; `duSiege` (la rangée est son acteur, `pidIsActor`), les seules rangées `interactive`
   *  que le siège qui décide influence (`influencesLocally`). */
  lancerSansRangee: (get: Get, set: Set, duSiege: boolean) => void;
  /** ACTEUR du slot visé — celui que les verbes d'influence DÉBITENT (`spec.actor`, l'entrée de
   *  `opReroll`/`opBonusSL`/`opForceSuccess`/`opDarkPact`). Accesseur PUR en LECTURE SEULE, même
   *  patron que `slotOf` ci-dessus (extraction de `locate` sans son `commit`). Il ouvre le PORTEUR
   *  du jet sans connaître la clé de pending du flux — c'est ce qui permet de CONFRONTER la table
   *  de possession (`FLOW_VERBS.jetOwner`) au site qui dépense. `undefined` si le pending est fermé,
   *  le `pid` inconnu, ou l'acteur absent de l'état. */
  actorOf: (get: Get, pid?: string) => Combatant | undefined;
  /** ISSUE CANONIQUE du slot visé (`spec.outcome`) — accesseur PUR en LECTURE SEULE, même patron que
   *  `slotOf`/`actorOf`. Elle porte le VERDICT (`won`) **et les chiffres qui le fondent**
   *  (`roll`/`target`) : c'est ce qui rend CONFRONTABLE le ✓/✗ que la rangée imprime et la fenêtre
   *  que le seam ouvre (`isFailed = !won`). Un flux dont le `won` contredit ses propres chiffres ne
   *  peut avoir de ligne à la fois VRAIE et alignée sur le seam — d'où la garde
   *  `rollflow-outcome-invariant`. `null` si le pending est fermé ou le `pid` inconnu. */
  outcomeOf: (get: Get, pid?: string) => RollOutcome | null;
  /**
   * VERBE TERMINAL — acquittement : DÉRIVE l'issue du flux (`spec.issue`) et la rend, UNE fois, sur
   * son canal (`spec.issueChannel`). C'est LE point de journalisation des flux à fenêtre : un site
   * d'acquittement ne compose plus de ligne, il appelle `apply` (avant de fermer le pending — l'issue
   * se lit sur le pending qui l'a produite).
   *
   * `p` : pending FOURNI (voie sans fenêtre — l'IA qui rejoue le même flux sans pending posé) ; sinon
   * le pending du store. `ctx` : les données que seule l'application connaît (`spec.issue`).
   * Renvoie TOUJOURS les lignes (le canal `'battle'` laisse le site les tisser dans son `set`).
   */
  apply(get: Get, opts?: { p?: PendingBase; ctx?: unknown }): string[];
  annuler: (get: Get, set: Set) => void;
  /** Sombre Pacte (LDB 19 l.17) : +1 Point de Corruption pour RELANCER un Test déjà jeté, répétable
   *  (chaque usage corrompt). Héros only. */
  pactiser: (get: Get, set: Set, pid?: string) => void;
  /** Inversion de Test (LDB 23/LDB 10, `spec.reverse`) : CHOIX du joueur. Talent = jet raté qu'elle
   *  transformerait en réussite ; jeton = libre (réussi ou raté). No-op sans `spec.reverse`, jet non
   *  lancé, ou aucune voie applicable. */
  inverser: (get: Get, set: Set, pid?: string) => void;
  /** Le verbe `inverser` est-il OFFERT (Talent ET/OU jeton applicable) ? Pure (aucune consommation) —
   *  pilote l'affichage du bouton « Inverser » dans la rangée d'influence. `false` sans `spec.reverse`. */
  reverseAvailable: (get: Get<Jeu>, pid?: string) => boolean;
  /** Prévisualisation PURE de l'issue de l'inversion (dé renversé, DR, succès) — rend le choix LISIBLE
   *  avant le clic. `null` sans `spec.reverse`, jet non lancé, ou aucune voie applicable (miroir de
   *  `reverseAvailable`, jamais appelé sans elle en pratique). */
  reversePreview: (get: Get<Jeu>, pid?: string) => IssueDuDe | null;
  /** Ce qui FERME chaque verbe du cycle sur le slot `pid` maintenant (`null` : ouvert), d'après les gardes des ops
   *  (`opRoll`, `opReroll`, `opBonusSL`, `opDarkPact`, `opForceSuccess`, `opSetForcedRoll`, `opResist`, inversion,
   *  annulation) et la clôture `valider`. Sans `pid`, un flux MULTI se juge en fenêtre : son jet posé (`jetPose`), son
   *  annulation tant qu'aucun slot n'est lancé. PUR, lu par `verbesOuverts.ts`. */
  fermetures: (get: Get<Jeu>, pid?: string) => FermeturesDuJet;
}

/**
 * Plomberie d'influence PARTAGÉE (mono ET multi). Chaque opération agit sur un « slot » de jet
 * (`PendingBase` : le pending entier en mono, un participant en multi) et écrit son patch via un
 * `commit` qui sait OÙ ranger le résultat. Les résolveurs métier sont passés PRÉ-LIÉS (closures sur
 * s/p/actor/get) → le même corps sert les deux fabriques sans rien recopier. Comportement IDENTIQUE
 * à l'ancien `makeRollFlow` (garde-fou : suite + `roll-modal-invariant.hors-store.test.ts`).
 */
/** L'écriture d'un patch sur le slot — SEUL point d'écriture des ops. Rend `false` quand le premier jet du slot est
 *  arrêté par le crochet du flux (`RollFlowSpec.premierJet`) : rien ne s'écrit, et la dépense `depense` (la ressource
 *  que le geste brûle) n'est jouée qu'une fois l'écriture admise. */
type Commit<P> = (patch: Partial<P>, opts?: { rerolled?: boolean; forced?: boolean; fixed?: boolean; touch?: boolean; depense?: () => void }) => boolean;

/** Lancer : le slot n'est pas encore lancé. Fenêtre de `opRoll`. */
const fermetureDuLancer = (rolled: boolean): FermetureDuJet | null => (rolled ? 'jetLance' : null);

/** Résistance (Menace), LDB 10 l.1016-1020 : un slot tagué `menace`, un auto-succès qui AMÉLIORE l'issue posée
 *  (`resistanceImproves`), une spec du talent encore disponible ce jour. Fenêtre de `opResist`. */
function fermetureDeLaResistance(actor: Combatant, menace: string | undefined, rolled: boolean, outcome: RollOutcome): FermetureDuJet | null {
  if (!menace) return 'sansMenace';
  if (!resistanceImproves(actor, rolled ? { won: outcome.won, sl: outcome.sl } : null)) return 'jetReussi';
  return availableResistance(actor, menace) == null ? 'sansResistance' : null;
}

/** Lance un slot non encore lancé (pas de dépense de point, pas de re-rendu). */
function opRoll<P extends PendingBase>(
  rolled: boolean, resolveNormal: () => Partial<P> | null, commit: Commit<P>,
): void {
  if (fermetureDuLancer(rolled)) return;
  const patch = resolveNormal();
  if (patch) commit(patch);
}

/** Chance : relance d'un jet propre RATÉ (1× max), ou Bénédiction de Chance gratuite (LDB 12/41). */
export function opReroll<P extends PendingBase>(
  slot: P, actor: Combatant | undefined, rolled: boolean, failed: boolean,
  reresolve: () => Partial<P> | null, get: Get, commit: Commit<P>,
): void {
  if (!actor || fermetureDeLaRelance(actorInfluenceView(actor), { rolled, failed, rerolled: slot.rerolled })) return;
  const free = freeRerollAvailable(actor);
  const patch = reresolve();
  if (!patch) return;
  if (free) {
    const label = consumeActiveFlag(actor, 'freeReroll');
    get().ecrireAuJournal(t('roll.freeReroll', { name: nomDe(actor), src: label ?? t('roll.blessingFallback') }));
  } else {
    actor.fortune = (actor.fortune ?? 0) - 1;
  }
  commit(patch, { rerolled: true, touch: true });
}

/** Chance « +1 DR » (LDB 17 l.24). */
export function opBonusSL<P extends PendingBase>(
  actor: Combatant | undefined, rolled: boolean, allowed: boolean,
  derive: () => Partial<P> | null, commit: Commit<P>,
): void {
  if (!allowed || !actor || fermetureDuBonus(actorInfluenceView(actor), { rolled, failed: false })) return;
  const patch = derive();
  if (!patch) return;
  actor.fortune = (actor.fortune ?? 0) - 1;
  commit(patch, { touch: true });
}

/** Résilience « Je ne faillirai pas ! » — dé PAR DÉFAUT (LDB 17 l.68), AVANT ou après le jet ; sa fenêtre est
 *  `fermetureDuForcage`, jugée par l'appelant. */
function opForceSuccess<P extends PendingBase>(
  actor: Combatant, resolveForced: () => Partial<P> | null, commit: Commit<P>,
): boolean {
  const patch = resolveForced();
  if (!patch) return false; // `null` = rien à forcer sur ce dé → pas de dépense
  return commit(patch, { forced: true, touch: true, depense: () => { actor.resilience = (actor.resilience ?? 0) - 1; } });
}

/** Résistance (Menace), LDB 10 l.1020 : auto-succès du premier Test qui résiste à la menace du
 *  slot — MÊME mécanisme que `forcerLaReussite` (le résolveur reçoit `{ sl: BE }`), autre RESSOURCE : la
 *  spec du talent, consommée 1× par séance (compteur `resistanceUsed`, remis par `restoreFortune`).
 *  Fenêtre : avant le jet comme après (`resistanceImproves` — l'auto-succès REMPLACE l'issue posée). */
function opResist<P extends PendingBase>(
  slot: P, actor: Combatant | undefined, rolled: boolean, outcome: RollOutcome,
  resolveResist: (sl: number) => Partial<P> | null, commit: Commit<P>,
): void {
  if (!actor || fermetureDeLaResistance(actor, slot.menace, rolled, outcome)) return;
  const spec = availableResistance(actor, slot.menace!)!;
  const patch = resolveResist(resistanceForcedSL(actor));
  if (!patch) return; // précondition manquante → pas de dépense
  commit(patch, { touch: true, depense: () => markResistanceUsed(actor, spec) });
}

/**
 * Dé CHOISI d'un jet. DEUX provenances, un seul mécanisme :
 *  - Résilience (LDB 17 l.68 : « au lieu de lancer les dés pour un Test, vous choisissez le résultat ») —
 *    slot `forcee`, le point est déjà dépensé par `forcerLaReussite`, le dé doit rester une réussite ;
 *  - option de confort « Dés fixés » (`fixed`) — aucune ressource, tout le d100 est permis, l'issue est
 *    celle du dé saisi, évaluée NORMALEMENT (réussite/échec, DR, doubles réels).
 *
 * AUCUNE gate de possession ici : l'option « Dés fixés » est CLIENT-SIDE (elle n'arme que l'affordance
 * de CELUI qui clique, `netOwnership.canFixDie`), et l'autorisation d'un geste reçu par le réseau est
 * celle du SIÈGE ÉMETTEUR (`netOwnership.intentAllowedFor`) — la ré-évaluer ici avec l'état LOCAL de
 * l'hôte faisait tomber en silence le geste légitime d'un invité sur son propre héros.
 * Renvoie `true` si un patch a été commis (l'appelant journalise la valeur RÉELLEMENT appliquée).
 */
function opSetForcedRoll<P extends PendingBase>(
  roll: number, resolveChosen: (roll: number) => Partial<P> | null, commit: Commit<P>,
  fixed = false,
): boolean {
  const chosen = fixed ? clampFixedRoll(roll) : Math.floor(roll);
  if (chosen < 1) return false;
  const patch = resolveChosen(chosen);
  if (!patch) return false;
  return commit(patch, fixed ? { fixed: true } : undefined);
}

/** Sombre Pacte : +1 Corruption pour relancer un Test déjà jeté, répétable (LDB 19 l.17). Héros only. */
function opDarkPact<P extends PendingBase>(
  actor: Combatant | undefined, rolled: boolean,
  reresolve: () => Partial<P> | null, get: Get, set: Set, commit: Commit<P>,
): void {
  if (!actor || fermetureDuPacte(actorInfluenceView(actor), { rolled, failed: false })) return;
  const patch = reresolve();
  if (!patch) return;
  const lines = gainCorruption(get, set, actor, 1);
  for (const l of lines) get().ecrireAuJournal(l);
  commit(patch, { touch: true });
}

/**
 * Fabrique UNIQUE des flux de jet (mono ET multi). `locate(p, pid)` trouve le SLOT ciblé + un
 * `commit` qui ré-injecte le patch au bon endroit : MONO → le slot EST le pending (`pid` ignoré) ;
 * MULTI → `participants[pid]` (ou le 1er), ré-inséré via la lentille `spec.multi`. Le câblage des
 * 7 verbes est écrit UNE fois — plus de `makeMultiRollFlow` qui recopiait la structure.
 */
export function makeRollFlow<P extends PendingBase, Slot extends PendingBase = P, Ctx = void>(spec: RollFlowSpec<P, Slot, Ctx>): RollFlowHandlers {
  const pendingOf = (s: Jeu) => s[spec.key] as P | null | undefined;
  const touch = spec.touch ?? touchActors;
  /** Le SLOT ciblé, en LECTURE : un slot que le flux séquentiel refuse n'est pas lu, et rien ne s'écrit. */
  const slotLu = (get: Get<Jeu>, p: P, pid?: string): Slot | null => {
    if (!spec.multi) return p as unknown as Slot;
    if (pid != null && spec.multi.refusDuSlot?.(get(), pid)) return null;
    return slotDe(p, pid);
  };
  /** Le slot `pid` (le premier sans `pid`) d'un flux séquentiel, sans juger son refus. */
  const slotDe = (p: P, pid?: string): Slot | null => {
    const slots = spec.multi!.slots(p);
    return (pid != null ? slots.find((x) => spec.multi!.idOf(x) === pid) : slots[0]) ?? null;
  };
  /** Le PREMIER jet du slot (non lancé, que le patch pose), quel que soit le geste qui le pose — lancer, dé choisi,
   *  Résilience, Résistance : le crochet du flux (`premierJet`) l'admet ou l'arrête. Puis la dépense du geste. */
  const admis = (get: Get, set: Set, p: P, slot: Slot, patch: Partial<Slot>, opts: Parameters<Commit<Slot>>[1]): boolean => {
    if (spec.premierJet && !spec.rolled(slot) && spec.rolled({ ...slot, ...patch } as Slot) && !spec.premierJet(get, set, p)) return false;
    opts?.depense?.();
    return true;
  };
  const locate = (set: Set, get: Get, p: P, pid?: string): { slot: Slot; commit: Commit<Slot> } | null => {
    if (!spec.multi) {
      const slot = p as unknown as Slot;
      return { slot, commit: (patch, opts) => {
        if (!admis(get, set, p, slot, patch, opts)) return false;
        set({
          [spec.key]: { ...slot, ...patch, ...(opts?.rerolled ? { rerolled: true } : {}), ...(opts?.forced ? { forcee: true, fixed: false } : {}), ...(opts?.fixed ? { fixed: true } : {}) },
          ...(opts?.touch ? touch(get()) : {}),
        } as PatchDeFlux);
        return true;
      } };
    }
    const refus = pid != null ? spec.multi.refusDuSlot?.(get(), pid) : null;
    if (refus) {
      refuserGeste(get, set, refus);
      return null;
    }
    const slot = slotDe(p, pid);
    if (!slot) return null;
    const slots = spec.multi.slots(p);
    return { slot, commit: (patch, opts) => {
      if (!admis(get, set, p, slot, patch, opts)) return false;
      set({
        [spec.key]: spec.multi!.replace(p, slots.map((x) => x === slot
          ? { ...x, ...patch, ...(opts?.rerolled ? { rerolled: true } : {}), ...(opts?.forced ? { forcee: true, fixed: false } : {}), ...(opts?.fixed ? { fixed: true } : {}) }
          : x)),
        ...(opts?.touch ? touch(get()) : {}),
      } as PatchDeFlux);
      return true;
    } };
  };
  // Slot TÉMOIN d'un multi (façon MultiRollList) : pas d'INFLUENCE joueur (Résilience, Résistance
  // (Menace), renversement). Son jet est NÉ ROULÉ chez un porteur qu'aucun siège ne surface (cible IA
  // d'une incantation opposée, marin PNJ d'un Test d'équipage, nageur d'un naufrage non piloté) — il n'y
  // a personne, devant aucun écran, à qui offrir de le retoucher.
  //
  // DÉRIVÉ, jamais DÉCLARÉ (#1262 V2 L4) : jet POSÉ (`spec.rolled`) + porteur NON SURFACÉ (`surfaceOf`,
  // LA définition de surface du seam). Le drapeau d'étape `interactive` qui portait ce rôle était
  // write-only côté rangée et n'était posé à `false` que par un seul producteur — un booléen dont
  // personne ne garantissait la cohérence avec le jet réellement posé.
  //
  // `spec.rolled` SEUL ne suffit pas — MESURÉ : la Résilience (LDB 17 l.68) et la Résistance (Menace)
  // (LDB 10 l.1016-1020) se jouent APRÈS un échec, et les trois verbes de renversement EXIGENT un jet
  // posé (`spec.rolled`, ci-dessous). Un `passive = rolled` fermerait le cas nominal et tuerait le
  // renversement entier. C'est la POSSESSION qui tranche, pas la seule présence du dé.
  const passive = (slot: Slot, s: Jeu, get: Get<Jeu>, p: P) =>
    !!spec.multi && spec.rolled(slot) && !surfaceOf(get, spec.actor(s, slot, p)?.id);
  const reresolveOf = (s: Jeu, slot: Slot, actor: Combatant, get: Get, p: P) =>
    spec.reresolve ? spec.reresolve(s, slot, actor, get, p) : spec.resolve(s, slot, actor, get, undefined, p);
  const L = spec.lens; // lentille de dérivation des verbes d'influence (Chance/Résilience/Résistance)
  // « Échec » (gating de la Chance/Pacte/Résistance) DÉRIVÉ de l'issue canonique, sans prédicat
  // `failed` séparé qui pourrait diverger de l'issue réelle du flux (`won`). `won` est lu sur un jet
  // EXISTANT — les consommateurs (opReroll/opDarkPact/opResist) court-circuitent tous sur `rolled` d'abord.
  const isFailed = (slot: Slot) => !spec.outcome(slot).won;
  // CIBLE du dé de l'acteur pour un flux à lentille. Le jet POSÉ fait foi (`actorTR().target`) : sa cible
  // reste vraie même une fois le Test réussi, alors que `dieTarget` encode « reste-t-il quelque chose à
  // forcer ? » et renvoie `null` sur une réussite — le joueur pourrait alors CHOISIR son dé de Résilience
  // (LDB 17 l.68) sur un Test qu'il vient de forcer, et le sélecteur disparaîtrait sous ses doigts.
  // Avant le jet, repli sur `dieTarget` (la cible n'existe encore nulle part ailleurs).
  const lensDieTarget = (slot: Slot, actor: Combatant | undefined): number | null =>
    (L?.actorTR(slot) ? cibleBrute(L.actorTR(slot)!) : null) ?? (actor && L?.dieTarget ? L.dieTarget(slot, actor) : null);
  // ACCESSEUR DE DÉ, dérivé UNE fois : déclaré par la spec, sinon obtenu de la lentille (le jet POSÉ fait
  // foi — sa cible reste vraie une fois le Test réussi, là où `dieTarget` encode « reste-t-il à forcer ? »
  // et s'éteint) ; `caps.picker` reste accepté comme `read` seul (flux historique sans écrivain).
  const dieRead: ((slot: Slot, actor: Combatant | undefined, p?: P) => ForcedPick | null) | undefined =
    spec.die?.read
    ?? spec.caps?.selecteur
    ?? (L
      ? (slot: Slot, actor: Combatant | undefined) => {
          const tr = L.actorTR(slot);
          if (tr) return deDuJet(tr);
          const tgt = lensDieTarget(slot, actor);
          return tgt == null ? null : { roll: bestForcedRoll(tgt), target: tgt, critable: false };
        }
      : undefined);
  // Un écrivain de lentille exige un acteur LIVE ; l'accesseur déclaré, lui, peut s'en passer
  // (étape MONDE d'une cascade : aucun acteur à porter).
  const dieWrite: ((s2: Jeu, slot: Slot, a: Combatant | undefined, g: Get, tr: TestResult, p2: P) => Partial<Slot> | null) | undefined =
    spec.die?.write ?? (L ? (s2, slot, a, g, tr, p2) => (a ? L.applyRoll(s2, slot, a, g, tr, p2) : null) : undefined);
  /** Ce flux sait-il RÉÉVALUER un dé saisi ? (lire où vit le dé ET réécrire l'issue re-dérivée.) */
  const fixable = !!dieRead && !!dieWrite;
  /** Plancher de DR d'une réussite forcée par la Résilience (défaut 1, cf. `die.floorSL`). */
  const dieFloor = (slot: Slot, actor: Combatant | undefined, p: P): number =>
    spec.die?.floorSL?.(slot, actor, p) ?? (actor ? L?.floorSL?.(slot, actor) : undefined) ?? 1;
  /** Le jet de la fenêtre est POSÉ : chaque slot l'est (mono : le pending). */
  const jetPose = (p: P): boolean =>
    (spec.multi ? spec.jetPose?.(p) ?? spec.multi.slots(p).every(spec.rolled) : spec.rolled(p as unknown as Slot));
  /** L'annulation du pending, sauf ce que ferme sa déclaration (`annulation`), selon la clôture déclarée
   *  (`clotures.cancel`) : tant qu'aucun jet de la fenêtre n'est lancé ; avant le jet, l'action engagée
   *  (`refusDAnnuler`, refus dit au joueur) puis le jet imposé la ferment. */
  const fermetureDeLAnnulation = (s: Jeu, p: P): FermetureDuJet | null => {
    const propre = spec.annulation?.(p, s);
    if (propre) return propre;
    const toujours = spec.clotures?.annuler === 'toujours';
    if (!toujours && (spec.multi ? spec.multi.slots(p).some(spec.rolled) : spec.rolled(p as unknown as Slot))) return 'jetLance';
    if (spec.refusDAnnuler?.(s, p)) return 'actionEngagee';
    if (toujours) return null;
    return !spec.multi && spec.jetImpose?.(p as unknown as Slot) ? 'jetImpose' : null;
  };
  /** La voie d'INVERSION du slot (LDB 23 l.209/218 ; LDB 10) : l'acteur, le dé courant, le Test visé et l'ÉVALUATION
   *  de la rangée, ou ce qui la ferme. La MÊME pour le verbe, sa disponibilité, son aperçu et `fermetures`. */
  const voieDInversion = (s: Jeu, get: Get<Jeu>, p: P, slot: Slot):
    { actor: Combatant; cur: { roll: number; target: number }; q: ReverseQuery; evaluer: EvaluationDeRangee } | FermetureDuJet => {
    const rev = spec.reverse;
    if (!rev) return 'nonOffert';
    if (spec.jetImpose?.(slot)) return 'jetImpose';
    if (passive(slot, s, get, p)) return 'rangeeTemoin';
    if (!spec.rolled(slot)) return 'jetNonLance';
    const actor = spec.actor(s, slot, p); if (!actor) return 'sansActeur';
    const cur = rev.current(slot, p);
    const q = cur && rev.skillOf(s, slot, actor, get, p);
    if (!cur || !q) return 'sansVoieDInversion';
    const evaluer: EvaluationDeRangee = (tr) => rev.evaluate(s, slot, actor, get, tr, p)?.issue ?? null;
    // L'aperçu nul (rangée sans évaluation : cible ou porteur absent) ferme la voie : le jeton ne se dépense jamais pour rien.
    const voieOuverte = engineReverseAvailable(actor, q, cur.roll, cur.target, evaluer) && !!engineReversePreview(actor, q, cur.roll, cur.target, evaluer);
    return voieOuverte ? { actor, cur, q, evaluer } : 'sansVoieDInversion';
  };
  /** Le dé CHOISI (Résilience, slot `forcee`) ou FIXÉ (option « Dés fixés ») : un accesseur qui lit le dé du slot et
   *  sait réécrire son issue. Fenêtre de `opSetForcedRoll` ; l'option, elle, se juge au siège (`canFixDie`). */
  const fermetureDuDeChoisi = (slot: Slot, actor: Combatant | undefined, p: P): FermetureDuJet | null => {
    if (!spec.caps?.forcer) return 'nonOffert';
    if (slot.forcee && !actor) return 'sansActeur';
    if (!fixable) return 'deNonFixable';
    return dieRead?.(slot, actor, p) ? null : 'jetNonLance';
  };
  /** Résilience (LDB 17 l.68) : fenêtre UNIQUE de `forcerLaReussite`, lue par l'op et par `fermetures`. Avant le jet, le
   *  geste force sans dé quand le flux le sait, sinon il lance puis force. */
  const fermetureDuForcage = (s: Jeu, get: Get<Jeu>, p: P, slot: Slot, actor: Combatant | undefined): FermetureDuJet | null => {
    if (!spec.caps?.forcer) return 'nonOffert';
    if (passive(slot, s, get, p)) return 'rangeeTemoin';
    if (!actor) return 'sansActeur';
    return fermetureDeLaResilience(actorInfluenceView(actor), { rolled: spec.rolled(slot), failed: isFailed(slot), rerolled: slot.rerolled, lost: !!spec.perdu?.(slot) });
  };
  /** Le flux offre « +1 DR » sur ce slot (lentille, ou `bonus` sans garde ou dont la garde l'admet). */
  const bonusOffert = (slot: Slot): boolean => !!L || (!!spec.bonus && (!spec.bonus.guard || spec.bonus.guard(slot)));
  /** Force le slot `pid` par la Résilience, sans juger sa fenêtre : son appelant l'a jugée (`fermetureDuForcage`). Vrai
   *  quand un point est dépensé. */
  const forcer = (get: Get, set: Set, pid?: string): boolean => {
    const s = get(); const p = pendingOf(s); if (!p) return false;
    const loc = locate(set, get, p, pid); if (!loc) return false;
    const actor = spec.actor(s, loc.slot, p); if (!actor) return false;
    // Résilience « Je ne faillirai pas ! » (LDB 17 l.68) : réussite MINIMALE forcée (DR planché). Lentille :
    // opposé binaire/flip → `forceWin` ; sinon `applyRoll(forcedTR au plancher)`. Repli = `resolve(…,{})`.
    const resolveForced = L
      ? () => {
          const cur = L.actorTR(loc.slot);
          if (L.forceWin) return L.forceWin(loc.slot, actor!, cur);
          const tgt = L.dieTarget?.(loc.slot, actor!); if (tgt == null) return null;
          const floor = L.floorSL?.(loc.slot, actor!) ?? 1;
          // « Vous choisissez le résultat » = LE MEILLEUR (LDB 17 l.68) : `bestForcedRoll` donne le dé DR-max
          // SELON la policy (01 en standard, le plus haut en Fast DR). Opposé : `floorSL` garantit d'emporter
          // (oppSL+1, LDB 17 l.68). Le plancher de DR vient DU FLUX (`floorSL`, défaut 1) — jamais un
          // résiduel en dur : un flux peut déclarer 0 (Test rendu aux dés, #1000). Le dé porte l'`isDouble`
          // (Critique) correct.
          const die = bestForcedRoll(tgt);
          const sl = Math.max(evaluateTest(die, tgt).sl, floor);
          return L.applyRoll(s, loc.slot, actor!, get, forcedTR(die, tgt, sl, cur?.base), p);
        }
      : () => spec.resolve(s, loc.slot, actor, get, {}, p);
    return opForceSuccess(actor, resolveForced, loc.commit);
  };
  const handlers: RollFlowHandlers = {
    fermetures(get, pid) {
      const s = get(); const p = pendingOf(s);
      const partout = (f: FermetureDuJet): FermeturesDuJet => tableTotale(VERBES_DE_JET, () => f);
      if (!p) return partout('sansJet');
      const fenetre = !!spec.multi && pid == null;
      const valider = spec.clotures?.valider === 'toujours' || jetPose(p) ? spec.cloture?.(p, s) ?? null : 'jetNonLance';
      const slot = fenetre ? slotDe(p) : slotLu(get, p, pid);
      if (!slot) return fenetre ? { ...partout('sansJet'), annuler: fermetureDeLAnnulation(s, p), valider } : partout('sansJet');
      const actor = spec.actor(s, slot, p);
      const rolled = spec.rolled(slot);
      const faits: RollInfluenceView = { rolled, failed: isFailed(slot), rerolled: slot.rerolled };
      const vue = actorInfluenceView(actor);
      const impose = !!spec.jetImpose?.(slot);
      const temoin = passive(slot, s, get, p);
      const parActeur = (f: (a: Combatant) => FermetureDuJet | null): FermetureDuJet | null => (actor ? f(actor) : 'sansActeur');
      const voie = voieDInversion(s, get, p, slot);
      const menace = slot.menace ?? (p as PendingBase).menace;
      return {
        lancer: fenetre ? (jetPose(p) ? 'jetLance' : null) : fermetureDuLancer(rolled),
        relancer: impose ? 'jetImpose' : parActeur(() => fermetureDeLaRelance(vue, faits)),
        ajouterUnDR: parActeur(() => fermetureDuBonus(vue, faits) ?? (bonusOffert(slot) ? null : 'nonOffert')),
        pactiser: impose ? 'jetImpose' : parActeur(() => fermetureDuPacte(vue, faits)),
        forcerLaReussite: fermetureDuForcage(s, get, p, slot, actor),
        // Le dé FIXÉ se juge au siège qui le pose (`canFixDie`) ; l'op ne le rejuge pas (`VerbesDeJet.jetImposerLeResultat`).
        imposerLeResultat: fermetureDuDeChoisi(slot, actor, p) ?? (!slot.forcee && !canFixDie(s, actor?.id) ? 'desFixesInactifs' : null),
        resister: !spec.caps?.resister ? 'nonOffert' : temoin ? 'rangeeTemoin' : parActeur((a) => fermetureDeLaResistance(a, menace, rolled, spec.outcome(slot))),
        annuler: fermetureDeLAnnulation(s, p),
        inverser: typeof voie === 'string' ? voie : null,
        valider: fenetre || !spec.multi ? valider : spec.clotures?.valider === 'toujours' || rolled ? null : 'jetNonLance',
      };
    },
    slotOf(get, pid) {
      const p = pendingOf(get());
      if (!p) return null;
      if (!spec.multi) return p as unknown as PendingBase;
      const slots = spec.multi.slots(p);
      return (pid != null ? slots.find((x) => spec.multi!.idOf(x) === pid) : slots[0]) ?? null;
    },
    rangees(get) {
      const p = pendingOf(get());
      return p && spec.multi ? spec.multi.slots(p).map(spec.multi.idOf) : [];
    },
    refusDuSlot: (get, pid) => (pid != null ? spec.multi?.refusDuSlot?.(get(), pid) ?? null : null),
    lancerSansRangee(get, set, duSiege) {
      const s = get(); const p = pendingOf(s);
      if (!p || !spec.multi) return;
      const multi = spec.multi;
      if (multi.sansRangee) { multi.sansRangee(get, set); return; }
      const aLancer = multi.slots(p)
        .filter((slot) => !spec.rolled(slot) && (!duSiege || (!!(slot as { interactive?: boolean }).interactive && influencesLocally(s, multi.idOf(slot)))))
        .map((slot) => multi.idOf(slot))
        .filter((id) => !multi.refusDuSlot?.(s, id));
      for (const id of aLancer) handlers.lancer(get, set, id);
    },
    // GOULOT d'acquittement des flux à fenêtre : l'issue est DÉRIVÉE de la déclaration du flux
    // (`spec.issue`), jamais composée au site. La LIGNE DE DÉ n'y est pas ré-émise : la fenêtre l'a
    // montrée (les jets SANS fenêtre reçoivent la leur du dériveur, au goulot des cascades).
    apply(get, opts) {
      const s = get();
      const p = (opts?.p as P | undefined) ?? pendingOf(s);
      if (!p || !spec.issue) return [];
      const out = spec.issue(p, s, opts?.ctx as Ctx);
      const lines = (Array.isArray(out) ? out : [out]).filter((l): l is string => !!l);
      if (spec.issueChannel !== 'battle') for (const l of lines) s.ecrireAuJournal(l);
      return lines;
    },
    actorOf(get, pid) {
      const s = get(); const p = pendingOf(s); if (!p) return undefined;
      const slot = handlers.slotOf(get, pid); if (!slot) return undefined;
      return spec.actor(s, slot as unknown as Slot, p);
    },
    outcomeOf(get, pid) {
      const slot = handlers.slotOf(get, pid);
      return slot ? spec.outcome(slot as unknown as Slot) : null;
    },
    // OÙ vit le dé de ce slot (LDB 17 l.68 : « vous choisissez le résultat ») : l'ACCESSEUR, point.
    picker: ((slot: Slot, actor: Combatant | undefined, st?: Jeu) =>
      dieRead?.(slot, actor, st ? pendingOf(st) ?? undefined : undefined) ?? null) as RollFlowHandlers['picker'],
    fixable,
    lancer(get, set, pid) {
      const s = get(); const p = pendingOf(s); if (!p) return;
      if (spec.onRoll) { if (!fermetureDuLancer(jetPose(p))) spec.onRoll(get, set, p); return; }
      // PAS de garde `passive` : le jet INITIAL d'un témoin doit être résolu (auto-roll IA à l'ouverture).
      const loc = locate(set, get, p, pid); if (!loc) return;
      opRoll(spec.rolled(loc.slot), () => spec.resolve(s, loc.slot, spec.actor(s, loc.slot, p), get, undefined, p), loc.commit);
    },
    relancer(get, set, pid) {
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc) return;
      if (spec.jetImpose?.(loc.slot)) return;
      const actor = spec.actor(s, loc.slot, p);
      opReroll(loc.slot, actor, spec.rolled(loc.slot), isFailed(loc.slot), () => reresolveOf(s, loc.slot, actor!, get, p), get, loc.commit);
    },
    ajouterUnDR(get, set, pid) {
      if (!spec.bonus && !L) return;
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc) return;
      const actor = spec.actor(s, loc.slot, p);
      const allowed = L ? true : (!spec.bonus!.guard || spec.bonus!.guard(loc.slot));
      // +1 DR de Chance (LDB 17 l.24) : lentille = `applyRoll(bumpSL)` — `bumpSL` n'écrit jamais `success`
      // (celui-ci reste dérivé du d100, LDB 12 l.11). Repli = le `bonus.derive` du flux.
      const derive = L
        ? () => { const cur = L.actorTR(loc.slot); return cur ? L.applyRoll(s, loc.slot, actor!, get, bumpSL(cur), p) : null; }
        : () => spec.bonus!.derive(s, loc.slot, actor!, p);
      opBonusSL(actor, spec.rolled(loc.slot), allowed, derive, loc.commit);
    },
    forcerLaReussite(get, set, pid, auJet) {
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc) return;
      const fermee = fermetureDuForcage(s, get, p, loc.slot, spec.actor(s, loc.slot, p));
      if (fermee) { refuserGesteDuSiege(get, set, libelleDeLaFermeture(fermee)); return; }
      // Avant le jet, le geste s'encadre par `auJet`, sa fenêtre jugée avant le jet.
      if (auJet && !spec.rolled(loc.slot)) auJet(() => forcer(get, set, pid));
      else forcer(get, set, pid);
    },
    imposerLeResultat(get, set, roll, pid) {
      if (!spec.caps?.forcer) return;
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc) return;
      const actor = spec.actor(s, loc.slot, p);
      const fermee = fermetureDuDeChoisi(loc.slot, actor, p);
      if (fermee) { refuserGesteDuSiege(get, set, libelleDeLaFermeture(fermee)); return; }
      // PROVENANCE du dé : slot `forcee` ⇒ Résilience (le point est déjà dépensé, le dé doit rester une
      // réussite) ; sinon ⇒ « dé fixé » (option de confort).
      const fixed = !loc.slot.forcee;
      // GARDE STRUCTURELLE (`fermetureDuDeChoisi`) : un dé fixé exige que le moteur sache le RÉÉVALUER (une cible
      // à confronter). `picker` EST ce contrat. Sans lui, `spec.resolve(…, {roll, fixed})` retomberait sur la branche
      // `if (forced)` du flux — auto-succès GRATUIT, saisie ignorée : le geste est refusé (cette garde tient aussi
      // face à un intent réseau).
      // DÉ CHOISI — UN seul chemin pour les DEUX provenances : la cible vient de l'ACCESSEUR (`read`),
      // l'issue s'y réécrit par le même accesseur (`write`). Aucun résolveur de flux n'est sollicité :
      // ils traitent `forced` comme un auto-succès et IGNORENT la valeur (les Tests opposés binaires
      // relançaient même un dé ALÉATOIRE, faisant perdre le point de Résilience).
      //  - dé FIXÉ (option de confort) : évaluation NATURELLE, aucune politique — l'issue est celle du dé ;
      //  - dé de RÉSILIENCE (LDB 17 l.68) : le dé doit RESTER une réussite (`maxForcedRoll`), le DR est
      //    planché (`floorSL` — Test opposé : « vous l'emportez avec au moins DR +1 »), la réussite ACHETÉE
      //    est conservée (`forcedTR`). Le flux ne déclare que sa POLITIQUE, jamais une branche.
      const resolveChosen = (r: number) => {
        const cur = dieRead?.(loc.slot, actor, p);
        if (!cur || !dieWrite) return null;
        if (fixed) return dieWrite(s, loc.slot, actor, get, evaluateTest(r, cur.target, cur.base), p);
        if (r > maxForcedRoll(cur.target)) return null;
        const floor = dieFloor(loc.slot, actor, p);
        const tr = forcedTR(r, cur.target, Math.max(evaluateTest(r, cur.target).sl, floor), cur.base);
        return (spec.die?.resilience ?? dieWrite)(s, loc.slot, actor, get, tr, p);
      };
      if (!opSetForcedRoll(roll, resolveChosen, loc.commit, fixed) || !fixed) return;
      // Journal : la valeur RÉELLEMENT APPLIQUÉE, relue sur le slot FRAIS par le même `picker` qui dit où
      // vit le dé — jamais la valeur saisie (le résolveur peut en appliquer une autre).
      const fresh = handlers.slotOf(get, pid);
      const applied = fresh ? handlers.picker?.(fresh, actor)?.roll : undefined;
      if (applied != null) journaliser(get, set, [actor ? t('roll.dieFixedBy', { name: nomDe(actor), n: applied }) : t('roll.dieFixed', { n: applied })], 'information', { actorId: actor?.id });
    },
    resister(get, set, pid) {
      if (!spec.caps?.resister) return;
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc || passive(loc.slot, s, get, p)) return;
      // Le tag `menace` vit sur le SLOT (étape de cascade, RANGÉE d'une bande) ou sur le PENDING entier
      // (opposition de sort : ses participants ne sont pas tagués, la FENÊTRE l'est). PRÉCÉDENCE : le tag
      // du slot PRIME ; le repli ne sert qu'aux flux dont les rangées n'en portent pas. Une BANDE tague
      // ses rangées à la construction (`frozenOpposedBatchStep`) — une rangée nue n'y résiste donc pas.
      const slot = loc.slot.menace != null ? loc.slot : { ...loc.slot, menace: (p as PendingBase).menace } as Slot;
      const actor = spec.actor(s, loc.slot, p);
      // Résistance (Menace) : réussite forcée à DR = Bonus d'Endurance (LDB 10 l.1020). Repli = `resolve(…,{sl})`.
      // CIBLE : `lensDieTarget` (le jet POSÉ fait foi) — `dieTarget` seul s'éteint sur un Test déjà réussi,
      // et l'auto-succès du talent, offert APRÈS une réussite, se serait forcé contre une cible 0.
      const resolveResist = L
        ? (sl: number) => { const cur = L.actorTR(loc.slot); const tgt = lensDieTarget(loc.slot, actor) ?? 0; return L.applyRoll(s, loc.slot, actor!, get, forcedTR(1, tgt, sl, cur?.base), p); }
        : (sl: number) => spec.resolve(s, loc.slot, actor, get, { sl }, p);
      opResist(slot, actor, spec.rolled(loc.slot), spec.outcome(loc.slot), resolveResist, loc.commit);
    },
    annuler(get, set) {
      const p = pendingOf(get());
      if (!p) return; // rien d'ouvert : no-op (pas d'undo à jouer, pas de cascade à toucher)
      const refus = spec.refusDAnnuler?.(get(), p);
      if (refus) { refuserGeste(get, set, refus); return; }
      // Le jet posé (ou imposé) engage la fenêtre (`clotures.cancel`), ou la déclaration du flux la ferme : le refus se dit.
      const fermee = fermetureDeLAnnulation(get(), p);
      if (fermee) { refuserGesteDuSiege(get, set, libelleDeLaFermeture(fermee)); return; }
      // Undo métier présent ⇒ il OWN toute la fermeture. SINON teardown par défaut : le pending, et
      // la cascade seulement si ce pending porte l'une de ses étapes-jets (`PORTEURS_D_ETAPE`) ; une
      // cascade étrangère au flux reste ouverte.
      if (spec.onCancel) { spec.onCancel(get, set, p); return; }
      set({ [spec.key]: null, ...((PORTEURS_D_ETAPE as readonly string[]).includes(spec.key) ? { pendingCascade: null } : {}) } as PatchDeFlux);
    },
    pactiser(get, set, pid) {
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc) return;
      if (spec.jetImpose?.(loc.slot)) return;
      const actor = spec.actor(s, loc.slot, p);
      opDarkPact(actor, spec.rolled(loc.slot), () => reresolveOf(s, loc.slot, actor!, get, p), get, set, loc.commit);
    },
    inverser(get, set, pid) {
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc) return;
      const voie = voieDInversion(s, get, p, loc.slot); if (typeof voie === 'string') return;
      const tr = applyReverse(voie.actor, voie.q, voie.cur.roll, voie.cur.target, voie.evaluer); if (!tr) return;
      const ev = spec.reverse!.evaluate(s, loc.slot, voie.actor, get, tr, p); if (!ev) return;
      loc.commit(ev.patch, { touch: true });
    },
    reverseAvailable(get, pid) {
      return handlers.fermetures(get, pid).inverser === null;
    },
    reversePreview(get, pid) {
      const s = get(); const p = pendingOf(s); if (!p) return null;
      const slot = slotLu(get, p, pid); if (!slot) return null;
      const voie = voieDInversion(s, get, p, slot);
      return typeof voie === 'string' ? null : engineReversePreview(voie.actor, voie.q, voie.cur.roll, voie.cur.target, voie.evaluer);
    },
  };
  return handlers;
}

// ── Multi-participants : types des SLOTS d'un flux multi (le câblage vit dans `makeRollFlow` via
//    `spec.multi`). Cf. docs/superpowers/specs/2026-06-14-multi-roll-modal-design.md. ──

/** État d'UN jet dans un groupe (mêmes drapeaux d'influence que le mono). Les flux concrets
 *  l'ÉTENDENT pour porter leur résultat (ex. `CounterParticipant` ajoute `counter`). */
export interface RollParticipant extends PendingBase {
  /** Combattant qui lance ce jet. */
  id: string;
  /** Libellé de rangée (sinon le nom du combattant). */
  label?: string;
  /** Rangée TÉMOIN (lecture seule, façon `MultiRollList`) si faux/absent → pas d'influence. */
  interactive?: boolean;
  /** Difficulté du Test de CE jet — donnée de LIGNE (#1072) : `RollLine` la rend en texte + valeur,
   *  elle n'est JAMAIS une chip de `mods` (réservées au circonstanciel). Sa valeur reste comprise
   *  dans la cible déjà calculée par le flux. */
  difficulty?: Difficulty;
  /** Difficulté ALLÉGÉE (`FlowTest.easierIf`) : libellé de la Compétence/du Talent qui l'a permis. */
  easedBy?: string;
}

/** Le pending d'un flux multi (parallèle ou séquentiel) porte SES slots. Le câblage vit dans
 *  `makeRollFlow` via `spec.multi = { slots: (p) => p.participants, idOf, replace }`. Étend
 *  `PendingBase` pour satisfaire la contrainte de la fabrique (ses drapeaux d'influence restent
 *  inutilisés au niveau conteneur — l'influence vit sur chaque participant). */
export interface MultiPending<Part extends RollParticipant = RollParticipant> extends PendingBase {
  participants: Part[];
}
