/**
 * Fabrique générique des « flux de jet différé ».
 *
 * Chaque modale de jet (Piétinement, Course, Focalisation, Psychologie, Frénésie, Rechargement,
 * Se libérer/Étouffer, Test de compétence, Évaluation, Marchandage, Soin…) suit le MÊME cycle de
 * vie, jusqu'ici copié-collé par flux dans le store (~6 actions × ~10 lignes chacune) :
 *
 *   ouvrir (pending posé) → Lancer (`roll`) → Chance : relancer (`reroll`, LDB 12 : jet propre
 *   raté, 1× max) ou +1 DR (`bonusSL`, LDB 17 l.24) → Résilience : réussite garantie
 *   (`forceSuccess`, LDB 17 l.68 : AVANT le jet ou après un échec) → Appliquer / Annuler.
 *
 * La fabrique centralise la plomberie commune (gardes, dépense de Chance/Résilience, drapeau
 * `rerolled`, patch de re-rendu) ; chaque flux ne déclare QUE sa partie métier via `RollFlowSpec`
 * (cf. `rollFlows.ts`). L'action « Appliquer » (`xConfirm`) reste écrite à la main dans le store :
 * ses effets sont tous différents — c'est la règle, pas la plomberie.
 *
 * Garde-fou : les primitives de résolution (RNG, moteur) ne sont appelées QUE par `resolve`/
 * `reresolve`/`bonus.derive`/`force.derive`, eux-mêmes invoqués uniquement par les résolveurs
 * générés ici — câblés dans le store sous des noms `*Roll`/`*Reroll`/… que le test statique
 * `roll-modal-invariant.test.ts` continue de vérifier.
 */
import type { GameState } from './store';
import type { Combatant, Difficulty } from '../engine/types';
import { canReroll } from '../engine/fortune';
import { availableResistance, markResistanceUsed, resistanceForcedSL, resistanceImproves } from '../engine/menace';
import { hasActiveFlag, consumeActiveFlag, freeRerollOf } from '../engine/activeFlags';
import { touchActors } from './combatOrParty';
import { surfaceOf } from './rollSeam';
import { gainCorruption } from './corruptionFlow';

import type { Get, Set } from './flowTypes';
import { bumpSL, evaluateTest, maxForcedRoll, forcedTR, bestForcedRoll, type TestResult } from '../engine/tests';
import { applyReverse, reverseAvailable as engineReverseAvailable, reversePreview as engineReversePreview } from '../engine/reverseToken';
import { clampFixedRoll } from '../engine/fixedDie';
import { TestOutcome } from '../engine/testOutcome';
import { t } from '../i18n';

/**
 * FENÊTRES D'INFLUENCE — prédicats PURS, écrits UNE fois, à côté des ops qui les exécutent
 * (`opReroll`, `opDarkPact`, `opForceSuccess`). Ce sont EUX que la coquille d'affichage consomme
 * (`ui/RollRow` → `ui/InfluenceRow` → `ui/ChanceButtons`) : une modale ne déclare que les FAITS de
 * son jet, jamais une éligibilité.
 *
 * Ce qu'ils NE disent PAS : si le flux OFFRE le verbe. Cela se lit à la PRÉSENCE du handler
 * (`onReroll`/`onDarkPact`/`onForce`) — un flux qui n'offre pas la Résilience ne passe pas `onForce`,
 * et aucun booléen ne peut le rallumer.
 */

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
export function rerollAvailable(a: RollActorView, v: RollInfluenceView): boolean {
  if (!v.rolled || !canReroll(v.failed, !!v.rerolled)) return false;
  return a.freeReroll || a.fortune > 0;
}

/** Sombre Pacte — `LDB 19 l.17`. Fenêtre de `opDarkPact`. */
export function darkPactAvailable(a: RollActorView, v: RollInfluenceView): boolean {
  return v.rolled && a.kind === 'hero';
}

/** Résilience « Je ne faillirai pas ! » — `LDB 17 l.68`. Fenêtre de `opForceSuccess`. */
export function forceAvailable(a: RollActorView, v: RollInfluenceView): boolean {
  return (!v.rolled || v.failed || !!v.lost) && a.resilience > 0;
}

/** Champs communs à tous les objets `pending*` gérés par la fabrique. */
export interface PendingBase {
  rerolled?: boolean;
  /** Réussite forcée par Résilience (LDB 17 l.68) — posé par `forceSuccess`, ouvre `setForcedRoll`. */
  forced?: boolean;
  /** MENACE à laquelle ce Test RÉSISTE (« Résistance (Menace) », LDB 10 l.1016-1020 : `maladie` /
   *  `corruption` / `mutation` / `magie` / `poison`…) — posé par le SITE qui ouvre le pending/l'étape.
   *  Présent + talent disponible ⇒ le verbe `resist` offre l'auto-succès (1× par spec et par séance). */
  menace?: string;
  /** DÉ FIXÉ à la main (option de confort « Dés fixés », `engine/fixedDie.ts`) — PROVENANCE, pas une
   *  règle : distingue le dé saisi par le joueur (aucun coût, jet évalué au naturel) du dé CHOISI de la
   *  Résilience (`forced`, réussite garantie). Lu par l'UI (mention « dé fixé » sur la rangée). */
  fixed?: boolean;
}

/**
 * Résolution FORCÉE — auto-succès du MÊME mécanisme pour DEUX sources RAW.
 * Passé en 5ᵉ argument de `resolve` :
 *  - `{}`               → `forceSuccess` (Résilience, LDB 17 l.68) : le flux applique son dé PAR
 *                          DÉFAUT (01 → DR max, ou, en Test opposé, le jet courant forcé à l'emporter) ;
 *  - `{ roll: n }`      → `setForcedRoll` (Résilience) : le joueur a CHOISI le dé `n` (doit rester une réussite) ;
 *  - `{ sl: n }`        → `resist` (Résistance (Menace), LDB 10 l.1016-1020) : auto-succès à DR IMPOSÉ
 *                          (« utilisez votre Bonus d'Endurance comme DR pour le Test ») — pas de choix du dé.
 * Absent (`resolve` appelé sans ce paramètre) → jet NORMAL (RNG). Un seul résolveur porte donc tous
 * les cas, au lieu des dérives séparées `force`/`forceRoll` (le « code dérivé » d'avant).
 */
export interface ForcedResolve {
  roll?: number;
  /** DR imposé de l'auto-succès du talent Résistance (Menace) — seulement via le verbe `resist`
   *  (`caps.resist`) ; les flux qui ne le déclarent pas ne le reçoivent jamais. */
  sl?: number;
  /** Le dé `roll` est FIXÉ par le joueur (option « Dés fixés »), pas choisi au titre de la Résilience :
   *  le résolveur l'évalue AU NATUREL (`evaluateTest`) — réussite, DR et double se dérivent du dé, aucune
   *  réussite garantie ni plancher de DR. Jamais posé par `forceSuccess`/`resist`. */
  fixed?: boolean;
}

/**
 * Props du sélecteur de dé PARTAGÉ (« Je ne faillirai pas ! », LDB 17 l.68). Renvoyé par
 * `caps.picker` quand le Test forcé offre un CHOIX du dé (attaque/défense/incantation/piétinement/
 * Peur) — `null` = pas de picker (flux binaire, ou avant `forceSuccess`). Le dé choisi pilote le DR,
 * le Critique (11) ET la localisation inversée. Co-localisé avec `resolve` : un seul endroit connaît
 * la forme du résultat du flux.
 */
export interface ForcedPick {
  roll: number;
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

/**
 * Lentille de DÉRIVATION des verbes d'influence (Chance +1 DR / Résilience « Je ne faillirai pas ! » /
 * Résistance Menace). Ces règles sont GLOBALES (LDB 17 l.24/68) : quand un flux fournit sa lentille,
 * la fabrique compose `bonusSL`/`forceSuccess`/`setForcedRoll`/`resist` DEPUIS elle — la mécanique vit
 * seulement ICI, le flux ne déclare que SA FORME. Un flux sans lentille retombe sur le chemin `resolve(forced)`
 * / `bonus.derive` (repli). Le `+1 DR` passe TOUJOURS par `bumpSL`, qui n'écrit jamais `success`
 * (LDB 17 l.24 ; succès du Test : LDB 12 l.11).
 */
export interface RollFlowLens<P extends PendingBase, Slot extends PendingBase = P> {
  /** TestResult ACTEUR courant du slot (post-jet), ou `null` (pas encore lancé / rien à re-dériver). */
  actorTR: (slot: Slot) => TestResult | null;
  /** Re-dérive le patch du slot depuis un TestResult acteur canonique — FINISHER PUR (aucun RNG) : re-oppose
   *  contre le figé si opposé, projette vers la forme concrète. `null` = cas interdit (pas de dépense). */
  applyRoll: (s: GameState, slot: Slot, actor: Combatant, get: Get, tr: TestResult, p: P) => Partial<Slot> | null;
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
  /** Clé du pending dans le store (ex. `'pendingTrample'`). */
  key: keyof GameState & string;
  /**
   * MULTI (N jets dans une modale) : énumère les SLOTS de jet du pending, leur id, et les ré-injecte.
   * ABSENT ⇒ MONO : le pending EST le slot unique (`pid` ignoré par les handlers). Une SEULE fabrique
   * pour les deux — le mono est le cas dégénéré N=1 (plus de `makeMultiRollFlow` recopié).
   */
  multi?: { slots: (p: P) => Slot[]; idOf: (slot: Slot) => string; replace: (p: P, slots: Slot[]) => P };
  /** Le jet a-t-il déjà été lancé ? (`slot.result != null` / `slot.roll != null`). */
  rolled: (slot: Slot) => boolean;
  /** L'acteur qui dépense Chance/Résilience. `undefined` → l'action de dépense est ignorée. */
  actor: (s: GameState, slot: Slot, p: P) => Combatant | undefined;
  /**
   * Patch du SLOT qui pose le jet (appelle le moteur + RNG). `null` → abandon silencieux
   * (précondition manquante : cible disparue, sort introuvable…) — AVANT toute dépense de point.
   * `actor` peut être `undefined` au premier jet (certains flux n'en ont pas besoin pour lancer).
   * `get` : accès au store pour les résolveurs qui lisent l'environnement (resolveAttack). `forced`
   * (seulement si `caps.forced`) : Résilience — cf. `ForcedResolve`. Absent → jet normal. `p` (dernier
   * arg) : le pending parent, pour un flux multi qui lit un contexte partagé (MONO : `slot === p`).
   */
  resolve: (s: GameState, slot: Slot, actor: Combatant | undefined, get: Get, forced?: ForcedResolve, p?: P) => Partial<Slot> | null;
  /** Patch de RELANCE (défaut : `resolve`) — utile en Test opposé où l'adversaire garde son jet figé. */
  reresolve?: (s: GameState, slot: Slot, actor: Combatant, get: Get, p?: P) => Partial<Slot> | null;
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
  issue?: (p: P, s: GameState, ctx: Ctx) => string | string[] | null | undefined;
  /**
   * CANAL de rendu de l'issue : `'log'` (journal narratif — défaut) ou `'battle'` (journal de combat,
   * `ev()`/`battle.log`) où `apply` REND les lignes sans les écrire : le site les tisse dans son propre
   * `set({ battle })` atomique (une écriture séparée écraserait le `battle` qu'il tient déjà).
   */
  issueChannel?: 'log' | 'battle';
  /** Chance « +1 DR » (absent → le flux ne l'offre pas). `guard` → cas interdits (ex. Test binaire). */
  bonus?: { guard?: (slot: Slot) => boolean; derive: (s: GameState, slot: Slot, actor: Combatant, p?: P) => Partial<Slot> | null };
  /**
   * Inversion de Test (LDB 23 l.209/218, jeton d'Activité ; LDB 10, Talents « vous pouvez inverser ») :
   * un CHOIX du joueur (jamais automatique, #558). Deux gates DISTINCTES (`engine/reverseToken.ts`,
   * #508 réfutation) : le Talent seulement sur un jet RATÉ qu'elle transformerait en réussite ; le
   * jeton d'Activité SANS restriction (réussi ou raté — le choix, et son issue possiblement dégradée,
   * appartiennent au joueur). Absent → le flux n'offre pas l'inversion.
   */
  reverse?: {
    /** Compétence de CE jet (`{skill, spec}`), matchée STRUCTURÉE contre Talent/jeton. `null` → non concerné. */
    skillOf: (s: GameState, slot: Slot, actor: Combatant, get: Get, p: P) => { skill?: string; spec?: string } | null;
    /** Dé/cible ACTEUR courants (post-jet, avant inversion). `null` → rien à inverser. */
    current: (slot: Slot) => { roll: number; target: number } | null;
    /** Re-dérive le patch du slot depuis le nouveau `{roll, sl, success}` inversé — `success` REFLÈTE
     *  le jet réel (jeton, libre, n'est PAS forcé réussi ; seule la voie Talent le garantit par sa gate). */
    applyRoll: (s: GameState, slot: Slot, actor: Combatant, get: Get, tr: { roll: number; sl: number; success: boolean }, p: P) => Partial<Slot> | null;
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
    write: (s: GameState, slot: Slot, actor: Combatant | undefined, get: Get, tr: TestResult, p: P) => Partial<Slot> | null;
    /** POLITIQUE Résilience : plancher de DR d'une réussite forcée (défaut 1). Un Test OPPOSÉ le porte à
     *  « DR de l'opposant + 1 » — LDB 17 l.68 : « vous l'emportez avec au moins DR +1 ». PARAMÈTRE, pas
     *  une branche : il ne concerne QUE le dé choisi au titre de la Résilience (un dé FIXÉ n'a aucun
     *  plancher, son issue est celle du dé). */
    floorSL?: (slot: Slot, actor: Combatant | undefined, p: P) => number;
    /** ÉCRIVAIN de la seule voie RÉSILIENCE, quand la réussite achetée entraîne plus qu'une projection
     *  (incantation : DR de Talent, doublement de malepierre, plancher de NI). Absent = `write`. */
    resilience?: (s: GameState, slot: Slot, actor: Combatant | undefined, get: Get, tr: TestResult, p: P) => Partial<Slot> | null;
  };
  /**
   * Traits déclaratifs du flux. `forced` : ce flux offre la Résilience (LDB 17 l.68, GLOBALE),
   * résolue DANS `resolve(…, forced)` — un seul résolveur porte les trois cas (jet normal,
   * `forceSuccess` = dé par défaut, `setForcedRoll` = dé choisi). Un flux qui NE pose PAS `forced`
   * n'offre simplement pas la Résilience (`forceSuccess`/`setForcedRoll` y sont des no-op : reload,
   * marchandage, évaluation…). Plus aucune dérive `force`/`forceRoll` séparée — cf. `ForcedResolve`.
   *
   * `picker` : OÙ vit le dé de ce flux — PARAMÈTRE de FORME, jamais une autorisation. Mesuré après
   * l'absorption du sélecteur dans `RollShell` : les flux à LENTILLE n'en déclarent PLUS (la fabrique le
   * dérive de `actorTR`/`dieTarget`) ; il ne subsiste que pour les résultats de forme PROPRE, non
   * exprimables par une lentille — attaque/défense/piétinement/coup dans le dos (`result.attackerDetail`),
   * incantation (`CastResult`, `critable` faux pour une Prière), étape de cascade (`step.result`/`target`),
   * Test de Calme du fuyard (`slot.calme`). Le QUAND (Résilience vs dé fixé, avant/après le jet) ne s'écrit
   * plus ici : il est arbitré une seule fois par `ui/forcedDieRow.ts`.
   */
  caps?: {
    forced?: boolean;
    picker?: (slot: Slot, actor: Combatant | undefined) => ForcedPick | null;
    /** Ce flux accepte l'auto-succès du talent Résistance (Menace) (LDB 10) : son `resolve` porte la
     *  branche `forced.sl` (DR = Bonus d'Endurance). Offert seulement sur un slot tagué `menace`. */
    resist?: boolean;
    /** Détermination (immunité PSY temporaire, LDB 17 l.59) : MÊME catégorie que `resist` (dépenser une
     *  ressource pour infléchir un Test psy), PAS une réussite forcée. Le flux DÉCLARE l'effet SPÉCIFIQUE
     *  (dépense de Détermination + marqueur `immune` sur le slot psy), la fabrique fournit le CÂBLAGE
     *  (interface store/intent/modale via le verbe `determine` → action `<prefix>Determine`, le handler
     *  ci-dessous GATE `actor` puis dispatche). Exposé par les seuls flux à `caps.determine`. */
    determine?: (slot: Slot, actor: Combatant, get: Get, set: Set, commit: Commit<Slot>) => void;
  };
  /**
   * Undo MÉTIER optionnel de l'annulation (ex. défaire-charge de l'attaque…).
   * PRÉSENT ⇒ il OWN la fermeture (il fait lui-même tous les `set`, y compris nuller le pending et
   * avancer/nuller la cascade-hôte selon les cas) : `cancel` lui délègue tout et ne touche à rien
   * d'autre — byte-identique aux anciennes actions bespoke. ABSENT ⇒ `cancel` applique le teardown
   * par défaut (nulle le pending ET la cascade-hôte, cf. `cancel`). */
  onCancel?: (get: Get, set: Set, p: P) => void;
  /** Patch de re-rendu après mutation en place de l'acteur. Défaut : `touchActors` (combat ⇄ groupe). */
  touch?: (s: GameState) => Partial<GameState>;
}

export interface RollFlowHandlers {
  /** `pid` : id du slot ciblé (MULTI). Absent ⇒ MONO (le pending est le slot unique). */
  roll: (get: Get, set: Set, pid?: string) => void;
  reroll: (get: Get, set: Set, pid?: string) => void;
  bonusSL: (get: Get, set: Set, pid?: string) => void;
  forceSuccess: (get: Get, set: Set, pid?: string) => void;
  /** Choix du dé d'un Test forcé (no-op sans `caps.forced` ou avant `forceSuccess`). */
  setForcedRoll: (get: Get, set: Set, roll: number, pid?: string) => void;
  /** Résistance (Menace), LDB 10 l.1016-1020 : auto-succès du premier Test qui résiste à la menace
   *  taguée sur le slot (`menace`), DR = Bonus d'Endurance, 1× par spec et par séance. No-op sans
   *  `caps.resist`, sans tag, sans talent disponible, ou si le Test est déjà réussi. */
  resist: (get: Get, set: Set, pid?: string) => void;
  /** Détermination (immunité PSY temporaire, LDB 17 l.59) : dépense 1 Détermination pour rendre l'acteur
   *  IMMUNISÉ ce Round sur le slot psy ciblé (marqueur `immune`) — PAS une réussite forcée (≠ `resist`).
   *  No-op sans `caps.determine`, sans acteur. La fabrique GATE `actor` + dispatche ; la garde d'éligibilité
   *  fine (slot psy, non résolu) + la dépense vivent dans le handler du spec (`caps.determine`). */
  determine: (get: Get, set: Set, pid?: string) => void;
  /** Ce flux sait-il RÉÉVALUER un dé saisi (option « Dés fixés ») ? Vrai ssi son ACCESSEUR DE DÉ est
   *  complet (lire où vit le dé ET réécrire l'issue re-dérivée). Faux ⇒ aucune affordance côté UI et
   *  verbe inerte côté store — jamais une réussite gratuite. */
  fixable: boolean;
  /** Où vit le dé du slot (l'ACCESSEUR `read`). `slot` est le pending/participant CONCRET ; `s` (l'état)
   *  permet au socle de retrouver le pending PARENT — certaines formes multi y rangent la cible (Test
   *  Étendu). `any` ici : les handlers ne portent pas `Slot`. */
  picker?: (slot: any, actor: Combatant | undefined, s?: GameState) => ForcedPick | null;
  /** Slot CONCRET visé (MONO : le pending ; MULTI : le participant `pid`, ou le premier). Accesseur
   *  PUR en LECTURE SEULE — extraction de `locate` sans son `commit`. Il ouvre à l'UI la provenance du
   *  slot (`forced`/`fixed`) et sa forme, sans qu'elle ait à connaître la clé de pending du flux :
   *  c'est ce qui permet à `RollShell` de dériver le sélecteur de dé pour TOUT flux. `null` si le
   *  pending est fermé ou le `pid` inconnu. */
  slotOf: (get: Get, pid?: string) => PendingBase | null;
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
  cancel: (get: Get, set: Set) => void;
  /** Sombre Pacte (LDB 19 l.17) : +1 Point de Corruption pour RELANCER un Test déjà jeté, répétable
   *  (chaque usage corrompt). Héros only. */
  darkPact: (get: Get, set: Set, pid?: string) => void;
  /** Inversion de Test (LDB 23/LDB 10, `spec.reverse`) : CHOIX du joueur. Talent = jet raté qu'elle
   *  transformerait en réussite ; jeton = libre (réussi ou raté). No-op sans `spec.reverse`, jet non
   *  lancé, ou aucune voie applicable. */
  reverse: (get: Get, set: Set, pid?: string) => void;
  /** Le verbe `reverse` est-il OFFERT (Talent ET/OU jeton applicable) ? Pure (aucune consommation) —
   *  pilote l'affichage du bouton « Inverser » dans la rangée d'influence. `false` sans `spec.reverse`. */
  reverseAvailable: (get: Get, set: Set, pid?: string) => boolean;
  /** Prévisualisation PURE de l'issue de l'inversion (dé renversé, DR, succès) — rend le choix LISIBLE
   *  avant le clic. `null` sans `spec.reverse`, jet non lancé, ou aucune voie applicable (miroir de
   *  `reverseAvailable`, jamais appelé sans elle en pratique). */
  reversePreview: (get: Get, set: Set, pid?: string) => { roll: number; sl: number; success: boolean } | null;
}

/**
 * Plomberie d'influence PARTAGÉE (mono ET multi). Chaque opération agit sur un « slot » de jet
 * (`PendingBase` : le pending entier en mono, un participant en multi) et écrit son patch via un
 * `commit` qui sait OÙ ranger le résultat. Les résolveurs métier sont passés PRÉ-LIÉS (closures sur
 * s/p/actor/get) → le même corps sert les deux fabriques sans rien recopier. Comportement IDENTIQUE
 * à l'ancien `makeRollFlow` (garde-fou : suite + `roll-modal-invariant.test.ts`).
 */
type Commit<P> = (patch: Partial<P>, opts?: { rerolled?: boolean; forced?: boolean; fixed?: boolean; touch?: boolean }) => void;

/** Lance un slot non encore lancé (pas de dépense de point, pas de re-rendu). */
function opRoll<P extends PendingBase>(
  rolled: boolean, resolveNormal: () => Partial<P> | null, commit: Commit<P>,
): void {
  if (rolled) return;
  const patch = resolveNormal();
  if (patch) commit(patch);
}

/** Chance : relance d'un jet propre RATÉ (1× max), ou Bénédiction de Chance gratuite (LDB 12/41). */
function opReroll<P extends PendingBase>(
  slot: P, actor: Combatant | undefined, rolled: boolean, failed: boolean,
  reresolve: () => Partial<P> | null, get: Get, commit: Commit<P>,
): void {
  if (!rolled || !canReroll(failed, !!slot.rerolled) || !actor) return;
  const free = hasActiveFlag(actor, 'freeReroll');
  if (!free && (actor.fortune ?? 0) <= 0) return;
  const patch = reresolve();
  if (!patch) return;
  if (free) {
    const label = consumeActiveFlag(actor, 'freeReroll');
    get().log(t('roll.freeReroll', { name: actor.label, src: label ?? t('roll.blessingFallback') }));
  } else {
    actor.fortune = (actor.fortune ?? 0) - 1;
  }
  commit(patch, { rerolled: true, touch: true });
}

/** Chance « +1 DR » (LDB 17 l.24). */
function opBonusSL<P extends PendingBase>(
  actor: Combatant | undefined, rolled: boolean, allowed: boolean,
  derive: () => Partial<P> | null, commit: Commit<P>,
): void {
  if (!rolled || !allowed || !actor || (actor.fortune ?? 0) <= 0) return;
  const patch = derive();
  if (!patch) return;
  actor.fortune = (actor.fortune ?? 0) - 1;
  commit(patch, { touch: true });
}

/** Résilience « Je ne faillirai pas ! » — dé PAR DÉFAUT (LDB 17 l.68), AVANT ou après le jet. */
function opForceSuccess<P extends PendingBase>(
  actor: Combatant | undefined, resolveForced: () => Partial<P> | null, commit: Commit<P>,
): void {
  if (!actor || (actor.resilience ?? 0) <= 0) return;
  const patch = resolveForced();
  if (!patch) return; // `null` = cas interdit/déjà réussi → pas de dépense
  actor.resilience = (actor.resilience ?? 0) - 1;
  commit(patch, { forced: true, touch: true });
}

/** Résistance (Menace), LDB 10 l.1020 : auto-succès du premier Test qui résiste à la menace du
 *  slot — MÊME mécanisme que `forceSuccess` (le résolveur reçoit `{ sl: BE }`), autre RESSOURCE : la
 *  spec du talent, consommée 1× par séance (compteur `resistanceUsed`, remis par `restoreFortune`).
 *  Fenêtre : avant le jet comme après (`resistanceImproves` — l'auto-succès REMPLACE l'issue posée). */
function opResist<P extends PendingBase>(
  slot: P, actor: Combatant | undefined, rolled: boolean, outcome: RollOutcome,
  resolveResist: (sl: number) => Partial<P> | null, commit: Commit<P>,
): void {
  if (!actor || !slot.menace) return;
  if (!resistanceImproves(actor, rolled ? { won: outcome.won, sl: outcome.sl } : null)) return;
  const spec = availableResistance(actor, slot.menace);
  if (spec == null) return;
  const patch = resolveResist(resistanceForcedSL(actor));
  if (!patch) return; // précondition manquante → pas de dépense
  markResistanceUsed(actor, spec);
  commit(patch, { touch: true });
}

/**
 * Dé CHOISI d'un jet. DEUX provenances, un seul mécanisme :
 *  - Résilience (LDB 17 l.68 : « au lieu de lancer les dés pour un Test, vous choisissez le résultat ») —
 *    slot `forced`, le point est déjà dépensé par `forceSuccess`, le dé doit rester une réussite ;
 *  - option de confort « Dés fixés » (`fixed`) — aucune ressource, tout le d100 est permis, l'issue est
 *    celle du dé saisi, évaluée NORMALEMENT (réussite/échec, DR, doubles réels).
 *
 * AUCUNE gate de possession ici : l'option « Dés fixés » est CLIENT-SIDE (elle n'arme que l'affordance
 * de CELUI qui clique, cf. `ui/forcedDieRow.ts`), et l'autorisation d'un geste reçu par le réseau est
 * celle du SIÈGE ÉMETTEUR (`netOwnership.intentAllowedFor`) — la ré-évaluer ici avec l'état LOCAL de
 * l'hôte faisait tomber en silence le geste légitime d'un invité sur son propre héros.
 * Renvoie `true` si un patch a été commis (l'appelant journalise la valeur RÉELLEMENT appliquée).
 */
function opSetForcedRoll<P extends PendingBase>(
  slot: P, actor: Combatant | undefined, roll: number,
  resolveChosen: (roll: number) => Partial<P> | null, commit: Commit<P>,
  fixed = false,
): boolean {
  if (!slot.forced && !fixed) return false;
  if (!fixed && !actor) return false; // Résilience : l'acteur porte le point dépensé (une étape MONDE n'en a pas)
  const chosen = fixed ? clampFixedRoll(roll) : Math.floor(roll);
  if (chosen < 1) return false;
  const patch = resolveChosen(chosen);
  if (!patch) return false;
  commit(patch, fixed ? { fixed: true } : undefined);
  return true;
}

/** Sombre Pacte : +1 Corruption pour relancer un Test déjà jeté, répétable (LDB 19 l.17). Héros only. */
function opDarkPact<P extends PendingBase>(
  actor: Combatant | undefined, rolled: boolean,
  reresolve: () => Partial<P> | null, get: Get, set: Set, commit: Commit<P>,
): void {
  if (!rolled || !actor || actor.kind !== 'hero') return;
  const patch = reresolve();
  if (!patch) return;
  const lines = gainCorruption(get, set, actor, 1);
  for (const l of lines) get().log(l);
  commit(patch, { touch: true });
}

/**
 * Fabrique UNIQUE des flux de jet (mono ET multi). `locate(p, pid)` trouve le SLOT ciblé + un
 * `commit` qui ré-injecte le patch au bon endroit : MONO → le slot EST le pending (`pid` ignoré) ;
 * MULTI → `participants[pid]` (ou le 1er), ré-inséré via la lentille `spec.multi`. Le câblage des
 * 7 verbes est écrit UNE fois — plus de `makeMultiRollFlow` qui recopiait la structure.
 */
export function makeRollFlow<P extends PendingBase, Slot extends PendingBase = P, Ctx = void>(spec: RollFlowSpec<P, Slot, Ctx>): RollFlowHandlers {
  const pendingOf = (s: GameState) => s[spec.key] as P | null | undefined;
  const touch = spec.touch ?? touchActors;
  const locate = (set: Set, get: Get, p: P, pid?: string): { slot: Slot; commit: Commit<Slot> } | null => {
    if (!spec.multi) {
      const slot = p as unknown as Slot;
      return { slot, commit: (patch, opts) => set({
        [spec.key]: { ...slot, ...patch, ...(opts?.rerolled ? { rerolled: true } : {}), ...(opts?.forced ? { forced: true, fixed: false } : {}), ...(opts?.fixed ? { fixed: true } : {}) },
        ...(opts?.touch ? touch(get()) : {}),
      } as Partial<GameState>) };
    }
    const slots = spec.multi.slots(p);
    const slot = pid != null ? slots.find((x) => spec.multi!.idOf(x) === pid) : slots[0];
    if (!slot) return null;
    return { slot, commit: (patch, opts) => set({
      [spec.key]: spec.multi!.replace(p, slots.map((x) => x === slot
        ? { ...x, ...patch, ...(opts?.rerolled ? { rerolled: true } : {}), ...(opts?.forced ? { forced: true, fixed: false } : {}), ...(opts?.fixed ? { fixed: true } : {}) }
        : x)),
      ...(opts?.touch ? touch(get()) : {}),
    } as Partial<GameState>) };
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
  const passive = (slot: Slot, s: GameState, get: Get, p: P) =>
    !!spec.multi && spec.rolled(slot) && !surfaceOf(get, spec.actor(s, slot, p)?.id);
  const reresolveOf = (s: GameState, slot: Slot, actor: Combatant, get: Get, p: P) =>
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
    L?.actorTR(slot)?.target ?? (actor && L?.dieTarget ? L.dieTarget(slot, actor) : null);
  // ACCESSEUR DE DÉ, dérivé UNE fois : déclaré par la spec, sinon obtenu de la lentille (le jet POSÉ fait
  // foi — sa cible reste vraie une fois le Test réussi, là où `dieTarget` encode « reste-t-il à forcer ? »
  // et s'éteint) ; `caps.picker` reste accepté comme `read` seul (flux historique sans écrivain).
  const dieRead: ((slot: Slot, actor: Combatant | undefined, p?: P) => ForcedPick | null) | undefined =
    spec.die?.read
    ?? spec.caps?.picker
    ?? (L
      ? (slot: Slot, actor: Combatant | undefined) => {
          const tr = L.actorTR(slot);
          if (tr) return { roll: tr.roll, target: tr.target, base: tr.base, critable: false };
          const tgt = lensDieTarget(slot, actor);
          return tgt == null ? null : { roll: bestForcedRoll(tgt), target: tgt, critable: false };
        }
      : undefined);
  // Un écrivain de lentille exige un acteur LIVE ; l'accesseur déclaré, lui, peut s'en passer
  // (étape MONDE d'une cascade : aucun acteur à porter).
  const dieWrite: ((s2: GameState, slot: Slot, a: Combatant | undefined, g: Get, tr: TestResult, p2: P) => Partial<Slot> | null) | undefined =
    spec.die?.write ?? (L ? (s2, slot, a, g, tr, p2) => (a ? L.applyRoll(s2, slot, a, g, tr, p2) : null) : undefined);
  /** Ce flux sait-il RÉÉVALUER un dé saisi ? (lire où vit le dé ET réécrire l'issue re-dérivée.) */
  const fixable = !!dieRead && !!dieWrite;
  /** Plancher de DR d'une réussite forcée par la Résilience (défaut 1, cf. `die.floorSL`). */
  const dieFloor = (slot: Slot, actor: Combatant | undefined, p: P): number =>
    spec.die?.floorSL?.(slot, actor, p) ?? (actor ? L?.floorSL?.(slot, actor) : undefined) ?? 1;
  const handlers: RollFlowHandlers = {
    slotOf(get, pid) {
      const p = pendingOf(get());
      if (!p) return null;
      if (!spec.multi) return p as unknown as PendingBase;
      const slots = spec.multi.slots(p);
      return (pid != null ? slots.find((x) => spec.multi!.idOf(x) === pid) : slots[0]) ?? null;
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
      if (spec.issueChannel !== 'battle') for (const l of lines) s.log(l);
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
    picker: ((slot: Slot, actor: Combatant | undefined, st?: GameState) =>
      dieRead?.(slot, actor, st ? pendingOf(st) ?? undefined : undefined) ?? null) as RollFlowHandlers['picker'],
    fixable,
    roll(get, set, pid) {
      const s = get(); const p = pendingOf(s); if (!p) return;
      // PAS de garde `passive` : le jet INITIAL d'un témoin doit être résolu (auto-roll IA à l'ouverture).
      const loc = locate(set, get, p, pid); if (!loc) return;
      opRoll(spec.rolled(loc.slot), () => spec.resolve(s, loc.slot, spec.actor(s, loc.slot, p), get, undefined, p), loc.commit);
    },
    reroll(get, set, pid) {
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc) return;
      const actor = spec.actor(s, loc.slot, p);
      opReroll(loc.slot, actor, spec.rolled(loc.slot), isFailed(loc.slot), () => reresolveOf(s, loc.slot, actor!, get, p), get, loc.commit);
    },
    bonusSL(get, set, pid) {
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
    forceSuccess(get, set, pid) {
      if (!spec.caps?.forced) return;
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc || passive(loc.slot, s, get, p)) return;
      const actor = spec.actor(s, loc.slot, p);
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
      opForceSuccess(actor, resolveForced, loc.commit);
    },
    setForcedRoll(get, set, roll, pid) {
      if (!spec.caps?.forced) return;
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc) return;
      const actor = spec.actor(s, loc.slot, p);
      // PROVENANCE du dé : slot `forced` ⇒ Résilience (le point est déjà dépensé, le dé doit rester une
      // réussite) ; sinon ⇒ « dé fixé » (option de confort).
      const fixed = !loc.slot.forced;
      // GARDE STRUCTURELLE : un dé fixé exige que le moteur sache le RÉÉVALUER (une cible à confronter).
      // `picker` EST ce contrat. Sans lui, `spec.resolve(…, {roll, fixed})` retomberait sur la branche
      // `if (forced)` du flux — auto-succès GRATUIT, saisie ignorée : on refuse le geste (l'UI ne l'offre
      // déjà pas ; cette garde tient aussi face à un intent réseau).
      if (fixed && !fixable) return;
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
      if (!opSetForcedRoll(loc.slot, actor, roll, resolveChosen, loc.commit, fixed) || !fixed) return;
      // Journal : la valeur RÉELLEMENT APPLIQUÉE, relue sur le slot FRAIS par le même `picker` qui dit où
      // vit le dé — jamais la valeur saisie (le résolveur peut en appliquer une autre).
      const fresh = handlers.slotOf(get, pid);
      const applied = fresh ? handlers.picker?.(fresh, actor)?.roll : undefined;
      if (applied != null) get().log(actor ? t('roll.dieFixedBy', { name: actor.label, n: applied }) : t('roll.dieFixed', { n: applied }));
    },
    resist(get, set, pid) {
      if (!spec.caps?.resist) return;
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
    determine(get, set, pid) {
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc) return;
      const actor = spec.actor(s, loc.slot, p);
      // La fabrique GATE `actor` + dispatche ; l'éligibilité fine (étape psy/non résolue) + la dépense
      // (Détermination) vivent dans le handler du spec (`caps.determine`).
      if (actor) spec.caps?.determine?.(loc.slot, actor, get, set, loc.commit);
    },
    cancel(get, set) {
      const p = pendingOf(get());
      if (!p) return; // rien d'ouvert : no-op (pas d'undo à jouer, pas de cascade à toucher)
      // Undo métier présent ⇒ il OWN toute la fermeture (nulle le pending, avance/nulle la cascade
      // selon les cas). SINON teardown par défaut, CASCADE-AWARE : nuller `pendingCascade` est un
      // no-op quand le flux est autonome (pending seul) et correct quand il est l'étape d'une cascade
      // (l'arbitre garantit une seule modale active → toute `pendingCascade` présente est SON hôte).
      if (spec.onCancel) { spec.onCancel(get, set, p); return; }
      set({ [spec.key]: null, pendingCascade: null } as Partial<GameState>);
    },
    darkPact(get, set, pid) {
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc) return;
      const actor = spec.actor(s, loc.slot, p);
      opDarkPact(actor, spec.rolled(loc.slot), () => reresolveOf(s, loc.slot, actor!, get, p), get, set, loc.commit);
    },
    reverse(get, set, pid) {
      if (!spec.reverse) return;
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc || passive(loc.slot, s, get, p)) return;
      if (!spec.rolled(loc.slot)) return;
      const actor = spec.actor(s, loc.slot, p); if (!actor) return;
      const cur = spec.reverse.current(loc.slot); if (!cur) return;
      const q = spec.reverse.skillOf(s, loc.slot, actor, get, p); if (!q) return;
      const applied = applyReverse(actor, q, cur.roll, cur.target); if (!applied) return;
      const patch = spec.reverse.applyRoll(s, loc.slot, actor, get, applied, p); if (!patch) return;
      loc.commit(patch, { touch: true });
    },
    reverseAvailable(get, set, pid) {
      if (!spec.reverse) return false;
      const s = get(); const p = pendingOf(s); if (!p) return false;
      const loc = locate(set, get, p, pid); if (!loc || passive(loc.slot, s, get, p)) return false;
      if (!spec.rolled(loc.slot)) return false;
      const actor = spec.actor(s, loc.slot, p); if (!actor) return false;
      const cur = spec.reverse.current(loc.slot); if (!cur) return false;
      const q = spec.reverse.skillOf(s, loc.slot, actor, get, p); if (!q) return false;
      return engineReverseAvailable(actor, q, cur.roll, cur.target);
    },
    reversePreview(get, set, pid) {
      if (!spec.reverse) return null;
      const s = get(); const p = pendingOf(s); if (!p) return null;
      const loc = locate(set, get, p, pid); if (!loc || passive(loc.slot, s, get, p)) return null;
      if (!spec.rolled(loc.slot)) return null;
      const actor = spec.actor(s, loc.slot, p); if (!actor) return null;
      const cur = spec.reverse.current(loc.slot); if (!cur) return null;
      const q = spec.reverse.skillOf(s, loc.slot, actor, get, p); if (!q) return null;
      return engineReversePreview(actor, q, cur.roll, cur.target);
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
