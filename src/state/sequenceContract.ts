/**
 * LE CONTRAT D'ORCHESTRATEUR (#1279) — ce qu'un SYSTÈME DÉCLARE pour se faire jouer en MANCHES, et
 * RIEN de ce qui le joue. Le cahier des charges du chantier tient en une phrase (#1279) : une
 * structure d'orchestrateur utilisée par l'ENSEMBLE des systèmes (énormément d'éléments y sont
 * dupliqués aujourd'hui), dont UNE implémentation gère les systèmes les plus simples sans surcharge.
 *
 * D'où la SÉPARATION, visible au type :
 *  - CE FICHIER = la STRUCTURE, destinée à TOUS les systèmes (poursuite, jeux, crises de mer, et
 *    demain les gros : combat, voyage, bataille de masse s'ils l'adoptent). Trois choses, pas une de
 *    plus : un ÉTAT (`SequenceState`, générique sur sa charge utile), une FABRIQUE DE MANCHE
 *    (`SequenceDef.round`), une CLÔTURE-SOUS-ID (`SequenceDef.close`, réducteur PUR enregistré sous
 *    l'id que porte l'état — patron `registerCascadeApplier` : l'id est la donnée, la fonction est du
 *    TS enregistré ; un état de séquence se snapshote en JSON, une closure y serait effacée en silence).
 *  - `sequenceCore.ts` = L'IMPLÉMENTATION LÉGÈRE de ce contrat : le registre, le cycle
 *    ouvrir→clore→rouvrir, l'accumulateur par camp, les formules de score, les départages, la borne.
 *    C'est celle que consomment les systèmes SIMPLES (un jeu de taverne opposé n'y coûte que son
 *    entrée de donnée). Un système lourd pourra en écrire une AUTRE sans toucher au contrat.
 *
 * Aucune fonction ici : ce fichier ne joue rien, il DIT. Les seules valeurs sont les invariants du
 * vocabulaire (borne dure, issue réservée, `purpose` de fenêtre) — ce sur quoi les deux côtés
 * s'accordent.
 */
import type { Get, Set } from './flowTypes';
import type { PendingCascade } from './pendings';
import type { BuiltCascadeStep } from './rollSeam';
import type { RNG } from '../engine/dice';
import type { CharKey } from '../engine/types';
import type { PlayerText } from '../i18n/playerText';
import type {
  SequencePhases, SequencePotRules, SequenceRoundOps, SequenceTableRow, SequenceSide, SequenceVolleyRules,
  SequenceCombinedRules, SequenceThrowerPenalty,
} from '../engine/sequenceVocab';

/** Borne PAR DÉFAUT de manches — une séquence dont aucun camp ne conclut S'ARRÊTE (le `round >= 50`
 *  que chaque jeu bricolait chez lui). C'est le plafond de qui ne déclare rien. */
export const SEQUENCE_MAX_ROUNDS = 50;

/** PLAFOND ABSOLU — invariant DU CONTRAT : aucune séquence, quoi qu'elle déclare, ne dépasse ce
 *  nombre de manches. Il existe parce que la MANCHE n'a pas le même prix partout : là où une manche
 *  est un Test opposé (50 suffit à dire « ça ne conclut pas »), une manche peut n'être qu'un lancer
 *  de dés d'un joueur autour d'une table — six joueurs y consomment leurs manches par dizaines, et
 *  50 couperait une partie NORMALE. Une séquence qui connaît le prix de sa manche déclare donc sa
 *  propre borne (`SequenceParams.maxRounds`) ; celle-ci reste bornée ici, une fois pour toutes. */
export const SEQUENCE_HARD_MAX_ROUNDS = 500;

/** Issue RÉSERVÉE rendue quand la borne est atteinte — le système la reçoit dans son `settle` et
 *  décide ce qu'elle vaut chez lui (nul, abandon…). */
export const SEQUENCE_BORNE = 'borne';

/** `purpose` des fenêtres ouvertes pour une manche : la clôture se route dessus (store). */
export const SEQUENCE_PURPOSE = 'sequence' as const;

/** Le VOCABULAIRE DE DONNÉE des familles (2) table par plage, (4) effets de manche, (5) mise/pot,
 *  (6) phases, (7) volée de lancers et (8) camps asymétriques vit dans le MOTEUR
 *  (`engine/sequenceVocab`) : ce sont des formes de RÈGLE, déclarées par les catalogues et republiées
 *  ici en paramètres — un catalogue du moteur ne dépend jamais du store. */
export type {
  SequenceTableRow, SequenceRoundOps, SequencePhases,
  SequencePotRow, SequencePotRules, SequencePotTurn, SequencePotOutcome,
  SequenceVolleyRow, SequenceVolleyRules, SequenceThrowTurn, SequenceThrowOutcome, SequenceSide,
  SequenceCombinedRules, SequenceThrowerPenalty,
} from '../engine/sequenceVocab';

/** PARAMÈTRES D'AUTEUR d'une séquence — de la DONNÉE, sérialisée avec l'état : ce qui règle la
 *  machinerie sans la recompiler (cible de cumul, plafond, départage, borne, formules de score).
 *  C'est ce qui permet à un jeu N+1 à mécanismes CONNUS de n'être qu'une entrée de donnée. */
export interface SequenceParams {
  /** Cumul vers cible (Test opposé étendu, LDB 12 l.170-179) — ex. Bras de fer : 10 DR. */
  target?: number;
  /** Plafond de DR d'une manche (Boules NADJ 16 l.57 : 6 DR). */
  drCap?: number;
  /** Id du départage d'égalité ENREGISTRÉ. Absent = l'égalité reste une égalité. */
  tieBreak?: string;
  /** Borne de manches propre à la séquence — jamais au-dessus de `SEQUENCE_HARD_MAX_ROUNDS`. Absente :
   *  `SEQUENCE_MAX_ROUNDS`. C'est ici qu'une famille dont la manche est BON MARCHÉ (un lancer, pas un
   *  Test opposé) dit ce que « ça ne conclut pas » veut dire chez elle. */
  maxRounds?: number;
  /** Formule de score PAR CAMP (id enregistré : `min`/`max`/`sum`/`first`), keyée par camp. */
  score?: Record<string, string>;
  /** (2) Table de score par plage de DR. */
  table?: readonly SequenceTableRow[];
  /** (3bis) Bonus de Caractéristique AJOUTÉ au DR de chaque manche (Bras de fer NADJ 16 l.34,
   *  Alvatafl l.20, Bête l.42) — la Caractéristique est nommée, le Bonus est son chiffre des
   *  dizaines (`engine/characteristics.bonus`). */
  drBonus?: CharKey;
  /** (4) Effets par manche. */
  rounds?: SequenceRoundOps;
  /** (6) Phases (mi-temps). */
  phases?: SequencePhases;
  /** Seuil de score d'un ACQUIS de manche (Middenball NADJ 16 l.119 : but à 25 DR d'équipe). */
  scoreThreshold?: number;
  /** (5) Mise, pot, abandon, élimination (Al-zahr NADJ 16 l.17). */
  pot?: SequencePotRules;
  /** (7) Volée de lancers (Bête NADJ 16 l.42, Arène l.70, Fléchettes l.97, Boules l.57). */
  volley?: SequenceVolleyRules;
  /** (8) Camps asymétriques (Alvatafl NADJ 16 l.25-28). */
  sides?: readonly SequenceSide[];
  /** (9) Test combiné à conséquences distinctes (Cerevis NADJ 16 l.90). */
  combined?: SequenceCombinedRules;
  /** (10) Sanction du lanceur qui MANQUE (Torchon NADJ 16 l.111). */
  throwerPenalty?: SequenceThrowerPenalty;
}

/** ÉTAT d'une séquence EN COURS — GÉNÉRIQUE sur sa charge utile : l'orchestrateur ne lit JAMAIS
 *  `payload`, il le transporte. C'est ce qui rend la MÊME structure instanciable par une poursuite,
 *  un jeu de taverne ou une crise de mer sans qu'aucun champ de l'un n'entre ici. */
export interface SequenceState<P = unknown> {
  /** Id de la DÉFINITION enregistrée — la donnée qui nomme les fonctions. */
  def: string;
  /** Manche courante (0 = aucune encore ouverte). */
  round: number;
  /** ACCUMULATEUR PAR CAMP — source UNIQUE des cumuls (aucun système n'en tient un second). */
  cum: Record<string, number>;
  params: SequenceParams;
  payload: P;
}

/**
 * UNE MANCHE déclarée par le système : sa fenêtre et ses étapes MINTÉES. `immediate` = aucune surface
 * à montrer (cadence auto, aucun siège humain sur le porteur) — l'orchestrateur résout d'office au
 * lieu d'ouvrir une fenêtre que personne ne joue.
 *
 * LE TEXTE DES POSITIONS D'AFFICHAGE d'un système (#1318 V8b₂) — `title` ici,
 * `SequenceBoard.title`/`phase`/`unit`/`pot` et `SequenceBoardCamp.label`/`note` plus bas : ces huit
 * positions sont MARQUÉES `PlayerText`, donc seul un minteur les remplit (catalogue `t()`, fabriques
 * t()-backed de `rollSeam` — `stepDetail`, `stepPrecision`, `stepManche`, `stepFraction`… — ou
 * `dataLabel` pour un libellé authoré). Un gabarit FR écrit au flux NE COMPILE PLUS. Le murage
 * S'ARRÊTE AU CONTRAT : `PlayerText` reste assignable vers `string`, donc l'UI, `PendingCascade.title`
 * et la réhydratation des saves ne changent ni de type ni de cast. Garde de parité octet de la
 * migration : `state/sequence-parite-catalogue.test.ts`.
 *
 * `log` (ici et au verdict) reste `string[]` — ce N'EST PAS une position d'affichage du contrat, mais
 * l'entrée d'un TUYAU : ses lignes vont à `GameState.log(msg: string)` (`state/store.ts`), et sa
 * seconde source est le journal du MOTEUR (`applyOps`, `engine/ops.ts`, `string[]`, alimenté par une
 * dizaine de familles d'aides). Marquer ce champ SEUL murerait un segment dont ni le puits ni l'autre
 * affluent ne le sont, et forcerait un blanchiment aux deux sites qui y déversent le moteur. Le
 * journal est un AXE à part (mesuré : 17 sites d'aides dans `ops.ts` au premier niveau), pas une
 * position de plus dans ce lot.
 *
 * LIMITE v1 — un titre minté est du FR GELÉ dans les saves : un état de séquence se snapshote en JSON
 * (cf. en-tête de ce fichier), donc ce que ce lot libère est la PRODUCTION du texte, pas sa
 * PERSISTANCE. Le critère « persisté → référence » n'est donc PAS satisfait : une save reprise après
 * un changement de locale rendrait ses titres dans la langue de la partie qui les a mintés. La vraie
 * 2ᵉ langue demande de persister une RÉFÉRENCE (clé + paramètres) rejouée À L'AFFICHAGE — chantier
 * NOMMÉ, hors de ce lot.
 */
export interface SequenceRound<P = unknown> {
  title: PlayerText;
  icon?: string;
  steps: readonly BuiltCascadeStep[];
  log?: string[];
  immediate?: boolean;
  /** Charge utile MISE À JOUR par l'ouverture (le système compte ce qu'il veut dans sa manche — rang
   *  de manche, phase…). Omise : inchangée. Appliquée AVANT l'ouverture de la fenêtre. */
  payload?: P;
}

/** VERDICT du réducteur de clôture : la séquence continue (avec son état à jour) ou s'achève sur une
 *  issue NOMMÉE par le système (`outcome`, lue par son `settle`). `cum`/`payload` omis = inchangés. */
export type SequenceVerdict<P> =
  | { go: 'continue'; cum?: Record<string, number>; payload?: P; log?: string[]; roundActors?: SequenceRoundActors }
  | { go: 'end'; outcome: string; cum?: Record<string, number>; payload?: P; log?: string[]; roundActors?: SequenceRoundActors };

/** PORTEURS de la manche close, NOMMÉS PAR ID (un verdict se snapshote : aucune référence d'objet n'y
 *  entre). C'est sur eux que l'implémentation DÉCLENCHE les effets de manche DÉCLARÉS
 *  (`SequenceParams.rounds`) — le réducteur reste PUR, il ne mute rien lui-même. */
export interface SequenceRoundActors {
  /** Vainqueur(s) de la MANCHE (pas de la partie) — `winner` leur est appliqué. */
  winners?: readonly string[];
  /** Tous les porteurs de la manche — `attrition` s'applique à ceux dont l'intervalle échoit. */
  all?: readonly string[];
}

/** Ce que le réducteur de clôture REÇOIT : l'état, les rangées CLOSES de la manche, et un RNG injecté
 *  (les jets d'un camp sans porteur jouable s'y roulent — un réducteur ne tire jamais son propre dé). */
/** Ce que la clôture LIT de la manche close : ses étapes, rien d'autre. */
export type MancheClose = Pick<PendingCascade, 'participants'>;

export interface SequenceCloseCtx<P> {
  get: Get;
  seq: SequenceState<P>;
  done: MancheClose;
  rng: RNG;
}

/** UN CAMP au TABLEAU DE MARQUE d'une séquence — ce qu'une fenêtre de manche montre du score en
 *  cours. `label` est de l'AFFICHAGE ; `id` est la clé de camp de l'accumulateur. */
export interface SequenceBoardCamp {
  id: string;
  label: PlayerText;
  score: number;
  /** Score à atteindre (cumul vers cible) — absent : le camp n'a pas de jauge, juste un score. */
  target?: number;
  /** Complément d'une ligne (buts marqués, acquis de manche, joueur sorti de la manche) — AFFICHAGE. */
  note?: PlayerText;
}

/** TABLEAU DE MARQUE d'une séquence EN COURS : ce que le système accepte de montrer pendant ses
 *  manches (score par camp, manche N/M, phase). Sans lui, une partie de six manches est AVEUGLE. */
export interface SequenceBoard {
  title: PlayerText;
  camps: readonly SequenceBoardCamp[];
  round: number;
  /** (5) POT en jeu, DÉJÀ LIBELLÉ par le système (l'argent se formate chez lui, `engine/money`) —
   *  AFFICHAGE : l'UI ne convertit ni ne totalise rien. Absent : la séquence ne joue pas d'argent. */
  pot?: PlayerText;
  /** Nombre de manches PRÉVUES (phases × manches, ou borne déclarée) — absent : partie ouverte. */
  rounds?: number;
  /** Phase courante, déjà libellée par le système (« 1ʳᵉ mi-temps »). */
  phase?: PlayerText;
  /** UNITÉ du score, au pluriel, déjà libellée par le système (« quilles », « points », « pièces
   *  prises »). AFFICHAGE : l'UI l'écrit telle quelle. Absente : des DR (l'unité par défaut d'une
   *  séquence de Tests). Une famille qui ne compte pas des DR le DIT — sinon le tableau ment. */
  unit?: PlayerText;
}

/**
 * LA DÉCLARATION D'UN SYSTÈME — les trois seules choses qu'il doit à l'orchestrateur.
 *  · `round`  : sa manche (des étapes MINTÉES — un littéral d'étape n'entre pas) ;
 *  · `close`  : son réducteur PUR sur les rangées closes (lire → juger → boucler/clore) ;
 *  · `settle` : son dénouement (bourse, combat, modale) — joué APRÈS le retrait de l'état.
 * Tout le reste (persistance, cycle, cumuls, borne) appartient à l'implémentation.
 */
export interface SequenceDef<P = unknown> {
  /** Fabrique la manche `seq.round` (déjà incrémentée). `undefined` = plus rien à ouvrir : la
   *  séquence s'éteint sans issue (aucun participant). */
  round: (get: Get, seq: SequenceState<P>, rng: RNG) => SequenceRound<P> | undefined;
  /** RÉDUCTEUR de clôture : lit les rangées closes, rend le verdict. Ne mute RIEN du store. */
  close: (ctx: SequenceCloseCtx<P>) => SequenceVerdict<P>;
  /** DÉNOUEMENT terminal (bourse, combat, modale de résultat) — appelé APRÈS le retrait de l'état. */
  settle?: (get: Get, set: Set, seq: SequenceState<P>, outcome: string) => void;
  /** TABLEAU DE MARQUE (affichage seul, PUR) — le système NOMME ses camps ; l'UI ne dérive rien. Il les
   *  nomme VIA LE CATALOGUE (fabriques t()-backed) : le littéral FR inline au flux est proscrit, avec
   *  l'angle mort et la limite v1 dits plus haut (#1318 V8b). */
  board?: (get: Get, seq: SequenceState<P>) => SequenceBoard | undefined;
}
