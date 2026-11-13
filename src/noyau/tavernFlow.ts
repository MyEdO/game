/**
 * Jeux de taverne (Nuits agitées & dures journées, ch.16) — FLUX de jeu branché sur le SOCLE DE
 * SÉQUENCE (`noyau/sequenceCore`, #1279) : UN état de séquence, UNE fabrique de manche, UN réducteur
 * de clôture. Il n'y a plus de « mode qui s'enchaîne à part » — le Test opposé simple (variante
 * rapide, ch.16 l.9-11) et le Test opposé ÉTENDU (Bras de fer, l.34) sont la MÊME séquence, dont la
 * donnée règle la cible de cumul, le plafond de DR, le départage, le Bonus de Caractéristique et les
 * effets de manche.
 *
 * DEUX MONTAGES DE MANCHE, un seul réducteur :
 *  - HÉROS contre HÉROS → BANDE, une RANGÉE PAR CAMP (patron `pursuitFlow`) : chaque siège joue SON
 *    jet, avec ses influences (#1279 S1). Le camp adverse n'est plus roulé côté monde puis figé —
 *    ce montage-là volait le jet du second héros.
 *  - HÉROS contre un PNJ (de scène, ou habitué au profil standard) → MONO à jet adverse
 *    FIGÉ (`meta.opposed.aT`, #579) : chaque influence du joueur RÉ-OPPOSE contre ce jet, jamais un
 *    second tirage caché.
 *
 * LES DEUX RÉGIMES DU CHAPITRE (l.9-11) ne se jouent PAS ici : le catalogue les sert à la source
 * (`engine/tavernGame.findTavernGameById`, règle optionnelle `jeux-de-taverne-rapides`). Sous le régime
 * rapide, un jeu arrive sans forme de tour, sans mise, sans camps ni Test combiné — toutes les
 * familles ci-dessous restent donc au repos d'elles-mêmes, et la manche opposée ordinaire (sans cible
 * de cumul : elle dénoue à la première clôture) est ce qui se joue. Aucun `si` de régime dans ce
 * fichier, aucun jeu nommé au code.
 *
 * Réservé aux tables qui activent l'option `jeux-de-taverne`.
 */
import { DIFFICULTY_LABELS, type Combatant, type Difficulty } from '../engine/types';
import { nomDe, nomOuAbsence } from '../engine/nom';
import type { FlowTest } from '../engine/flowCore';
import type { Get, Set } from './flowTypes';
import {
  findTavernGameById, resolveTavernRound, rollTavernTest, roundSL,
  specialsApplicables, difficulteDuJoueur, difficulteDeBase,
  TAVERN_GAMES, TAVERN_TEST_DIFFICULTY, type CampDeTaverne, type TavernGame, type TavernGameResult, type TavernSpecial,
} from '../engine/tavernGame';
import { deDeLaTableTiree, findTableEntry } from '../engine/tables';
import { resolveOpposed, isDoubleRoll, evaluateTest, evaluateCombinedTest, estJete, type TestResult } from '../engine/tests';
import { isDrunk } from '../engine/drunkenness';
import { hasCondition } from '../engine/conditions';
import { applyOps, avantageDeCampSansFiche } from '../engine/ops';
import { testValue } from '../engine/skills';
import type { SujetDuJet } from '../data/schemas/grammaire/mecanique';
import { advantageCap, advantageCapFor } from '../engine/advantage';
import { groupAdvantage } from '../engine/advantagePool';
import { touchActors } from './combatOrParty';
import { battleRng } from './battleRng';
import { toBrass, fromBrass, formatMoney } from '../engine/money';
import { creditBourse, payWithAllocation, soloPayer } from './bourseFlow';
import { refuseSi } from './verrousDeFiche';
import { refuserGeste } from './refusVisible';
import { rule } from '../engine/policy';
import type { Jeu } from './etat';
import type { IdDEntiteDeScene, IdDeHeros, IdDeJeuDeTaverne, IdDeProfilStandard } from './designations';
import { bourseOf } from '../engine/bourse';
import {
  freeCons, opposedAttackerLabel, monoStep, bandStep, choiceStep, quantityStep, rollStep, composeRollLabel, surfaceOf, effectiveTarget, tableStep, displayStep,
} from './rollSeam';
import { type BuiltCascadeStep } from './stepBrand';
import type { CascadeSecondRead, CascadeStep, CascadeStepMeta, CascadeTableDecl } from './pendings';
import { advantageModLine, type ModLine } from '../engine/combat';
import type { BatchParticipant } from './pendings';
import { rollBatchParticipant, pushStep, rollTableStep, type TableStepDef } from './cascade';
import { combatStakeRef } from '../data/index';
import { memoParVersion } from '../data/versionDataset';
import { startSequence, resolveSequenceTie, recitDuDepartage, sequenceCumulsDeLaManche, sequenceDrBonus, sequencePhaseOf, sequenceScoreOf, sequenceTableRow, resolveSequencePotTurn, sequencePotIssue, resolveSequenceThrow, sequenceThrowGain, sequenceThrowRow, sequenceVolleyRounds, activeSequence, setSequenceChargeUtile, setSequenceCumuls, PERTE_DU_TOUR, DECROISSANCE_DU_TOUR } from './sequenceCore';
import { SEQUENCE_PURPOSE, SEQUENCE_BORNE, type SequenceBoard, type SequenceCloseCtx, type SequenceParams, type SequenceRound, type SequenceState, type SequenceVerdict } from './sequenceContract';
import { type SequencePotTurn, type SequenceThrowTurn, type SequenceThrowOutcome, type SequenceVolleyRules, type SequenceVolleyRow, type SequenceSide, type SequenceCombinedRules } from '../engine/sequenceVocab';
import type { RNG } from '../engine/dice';
import { actorIn } from './monde/combatants';
import { garanti } from '../lib/garanti';
import { pnjAuProfil, sceneNpc } from './monde/sceneNpc';
import { presetDuNarratif, type ResolveurDePreset } from './monde/resolveursDuNarratif';
import type { Scene } from './monde/scene';
import { jetSurfaced } from './sieges';
import { cadenceAuto } from '../engine/cadence';
import { t, interpolate, pluriel } from '../i18n';
import { dataLabel, testSkillLabel } from '../data';
import { stepDetail, stepFraction, stepPrecision, idDansLaSequence } from './rollSeam';
import type { PlayerText } from '../i18n/playerText';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { SortiesDeFenetre } from './sortieDeFenetre';
import type { FragmentDeTables, PartDeTable } from './tablesPosees';

/**
 * Adversaire d'une partie — TROIS formes, chacune JOUE une fiche (`tavernGameValue`) :
 *  · `heros` : un compagnon du groupe ;
 *  · `pnj` : un PNJ de la SCÈNE (`sceneNpc`) — `NADJ 04 l.72`, `EDO 01 l.200` ;
 *  · `profil` : un habitué sans entité de scène, au profil standard choisi (`pnjAuProfil`, `LDB 77 l.7`).
 */
export type TavernOpponent =
  | { kind: 'heros'; id: IdDeHeros }
  | { kind: 'pnj'; id: IdDEntiteDeScene }
  | { kind: 'profil'; id: IdDeProfilStandard };

/** Résultat de la dernière partie (affiché dans la modale). Étend l'issue moteur des libellés/mise. */
export interface TavernGamesResult extends TavernGameResult {
  gameLabel: string;
  challengerName: PlayerText;
  opponentName: PlayerText;
  /** Mise engagée (sous de cuivre) — 0 si le jeu n'a pas de mise, ou adversaire = compagnon. */
  stakeBrass: number;
  /** Variation de la bourse du groupe : +mise (gagné vs la maison) / −mise (perdu) / 0. */
  netBrass: number;
  /** Ligne de score DÉJÀ composée par le jeu, dans SON unité (DR, points, buts, pièces, chouettes,
   *  manches de mise) et son compte de manches, lancers ou tours — AFFICHAGE. */
  detail: string;
}

/** État de la modale de jeux de taverne (ouverte quand non-null ; `result` = dernière partie). */
export interface TavernGamesState {
  result: TavernGamesResult | null;
  /** PNJ PROPOSEUR (`SceneEntity.tavernGame`) quand c'est LUI qui ouvre la table : la modale s'ouvre
   *  alors sur SON offre, pré-sélectionnée. Absent : ouverture GÉNÉRIQUE (l'affordance du lieu), où
   *  le joueur choisit tout. */
  npcId?: string;
}

/** Id de la fiche d'un habitué au profil standard (`pnjAuProfil`) : il n'a aucune entité de scène. */
export const HABITUE = 'habitue';

/** Valeur des COÉQUIPIERS figurants d'un jeu d'équipe, posée à l'ouverture depuis `allyProfil`. */
function valeurDesCoequipiers(p: TavernPayload): number {
  if (p.allyValue === undefined) throw new Error(`[taverne] jeu d'équipe « ${p.gameId} » ouvert sans profil de coéquipier (#1882)`);
  return p.allyValue;
}

/**
 * Valeur EFFECTIVE d'un personnage pour un jeu (variante rapide, ch.16 l.9-11) : la Compétence indiquée
 * si le jeu en a une (spec-aware) ; sinon sa caractéristique propre (Bras de fer = Force) ; sinon le
 * Pari (« Si aucune Compétence n'est indiquée […] faites plutôt un Test opposé de Pari »).
 */
export function tavernGameValue(hero: Combatant, game: TavernGame): number {
  if (game.skill || game.characteristic) return testValue(hero, game);
  return testValue(hero, { skill: { id: 'pari' } }); // aucune Compétence indiquée → Pari (l.11)
}

/** L'ACTEUR d'un id de partie, quel que soit son banc : héros (combat ou groupe) ou PNJ de la scène.
 *  SOURCE UNIQUE — sans elle, un site lirait `party` seul et le PNJ à fiche redeviendrait anonyme. */
function tavernActor(get: Get, id: string | undefined): Combatant | undefined {
  if (!id) return undefined;
  return actorIn(get(), id) ?? sceneNpc(get().scene, id, presetDuNarratif(get().campaignNarratif));
}

/**
 * LES PNJ DE LA SCÈNE QUI PROPOSENT UNE PARTIE (`SceneEntity.tavernGame`) — ce que la CARTE décide,
 * lu par la modale pour offrir le troisième mode d'adversaire. Rend l'entité ET sa fiche dérivée :
 * le libellé affiché est celui que rend la projection (`sceneNpc`), jamais un id brut. Un personnage SANS
 * fiche n'a aucune valeur à opposer : il n'est pas proposé (sa faute est dite par `validateScene`, #1882).
 */
export function tavernNpcOffers(scene: Scene | null | undefined, presetDe: ResolveurDePreset): { id: string; label: string; gameId: string; stakeBrass?: number }[] {
  return (scene?.entities ?? [])
    .filter((e) => e.kind === 'personnage' && e.tavernGame)
    .flatMap((e) => {
      const fiche = sceneNpc(scene, e.id, presetDe);
      return fiche ? [{
        id: e.id,
        label: nomDe(fiche),
        gameId: e.tavernGame!.id,
        ...(e.tavernGame!.stakeBrass != null ? { stakeBrass: e.tavernGame!.stakeBrass } : {}),
      }] : [];
    });
}

/** Déclaration du Test (Compétence ou Caractéristique) d'un jeu — MÊME repli que `tavernGameValue` (Pari si rien
 *  d'indiqué), réutilisée par les mints (`req.test`, qui calculent eux-mêmes la valeur par acteur). */
/** Sujet d'un Test → `TavernOption` (Test de la DONNÉE). PURE. */
function enOption(t: SujetDuJet): TavernOption {
  return {
    test: {
      ...(t.skill ? { skill: t.skill } : {}),
      ...(t.characteristic ? { characteristic: t.characteristic } : {}),
    },
  };
}

/** Sujet du Test d'une séquence de la DONNÉE : sa Compétence, sinon sa Caractéristique. PURE. */
function testDeSequence(test: Pick<FlowTest, 'skill' | 'characteristic'>): SujetDuJet {
  return test.skill ? { skill: structuredClone(test.skill) } : { characteristic: test.characteristic }; // #2097
}

function tavernTestSpec(game: TavernGame): SujetDuJet {
  if (game.skill) return { skill: structuredClone(game.skill) }; // #2097
  if (game.characteristic) return { characteristic: game.characteristic };
  return { skill: { id: 'pari' } };
}

/** La table de taverne est PARTAGÉE (une seule séquence) : seul l'hôte l'ouvre et y fait jouer ; un siège
 *  invité est refusé. */
export function refusDeTableDHote(s: Pick<Jeu, 'net'>): string | null {
  return s.net.mode === 'invite' ? t('tavern.hoteSeul') : null;
}

/** Refus d'ouvrir la table : table d'hôte (`refusDeTableDHote`), puis option `jeux-de-taverne`
 *  éteinte. Verdict UNIQUE du geste, de l'Effet qui l'ouvre et de l'écran ; `null` s'il ouvre. */
export function refusDOuvrirLaTaverne(s: Pick<Jeu, 'net'>): string | null {
  return refusDeTableDHote(s) ?? (rule('jeux-de-taverne') ? null : t('tavern.optionEteinte'));
}

/** OUVRE la table. `entityId` = le PNJ qui PROPOSE la partie (son dialogue vient de l'ouvrir) : la
 *  modale s'ouvre sur SON offre. GÉNÉRIQUE — tout PNJ à `tavernGame` en hérite, aucun n'est nommé. */
export function ouvrirLesJeux(get: Get, set: Set, entityId?: string): void {
  if (refuseSi(get, set, refusDOuvrirLaTaverne)) return;
  set({ tavernGames: { result: null, ...(entityId ? { npcId: entityId } : {}) } });
}

/** Id de la définition de séquence des jeux de taverne (donnée : écrit dans les saves). */
export const TAVERN_SEQUENCE = 'tavern';

declare module './sequenceContract' {
  interface SequenceFamilies {
    [TAVERN_SEQUENCE]: TavernPayload;
  }
}

/** Kind de l'étape-jet d'une manche (bande OU mono) — UNIQUE depuis #1279 S1. */
export const TAVERN_ROUND_KIND = 'taverneRound';

/**
 * UNE PARTIE EST-ELLE EN COURS ? — lecture de l'UI, qui masque le formulaire de réglage tant que la
 * partie n'est pas dénouée (#370 point 4).
 *
 * Le signal est la SÉQUENCE elle-même, jamais le `kind` d'une étape : les onze jeux du chapitre
 * surfacent onze familles d'étapes (choix d'option, annonce de camp, effacement de marques, lancer de
 * volée, tour de pot, Résistance à l'alcool…), et un prédicat qui n'en connaissait qu'UNE laissait le
 * bouton « Jouer » vivant sur les cinq sixièmes du catalogue (mesuré : 4 jeux sondés sur 6).
 * `state.sequence` est vrai de la première manche au dénouement, quelle que soit l'étape surfacée —
 * c'est le seul signal qui ne se périme pas quand une famille de manche s'ajoute.
 */
export function tavernPartieEnCours(s: { sequence: { definition: string } | null }): boolean {
  return s.sequence?.definition === TAVERN_SEQUENCE;
}

/** CHARGE UTILE d'une partie jouée par le socle — la table, l'adversaire, la mise. */
export interface TavernPayload {
  gameId: string;
  challengerId: string;
  opponentValue: number;
  opponentName: PlayerText;
  opponentId?: string;
  stakeBrass: number;
  /** Scores de la manche close (lus par le dénouement d'une partie à manche unique). */
  last?: { dr: Record<CampDeTaverne, number>; departage?: string };
  /** JEU D'ÉQUIPE : les rangées de chaque camp (héros ET figurants), par id de rangée. */
  teams?: Record<CampDeTaverne, string[]>;
  /** JEU D'ÉQUIPE : option de Test retenue par chaque héros pour la manche EN COURS (clé d'option). */
  choices?: Record<string, number>;
  /** JEU D'ÉQUIPE : valeur de Test des COÉQUIPIERS figurants du groupe (`allyProfil`), distincte de
   *  celle du camp d'en face (`opponentValue`). Absente hors jeu d'équipe. */
  allyValue?: number;
  /** L'AVANTAGE des camps dont aucune fiche ne suit la séquence (figurants d'équipe, l.119 ; habitué ou
   *  PNJ de scène, l.34) — les héros portent le leur sur leur fiche (ops de manche). */
  advantage?: Record<CampDeTaverne, number>;
  /** TORCHON : l'ORDRE de passage des lanceurs (un tour = un lanceur, l.111), figé à l'ouverture. */
  throwers?: { id: string; label: string; camp: CampDeTaverne; value?: number }[];
  /** MISE : les joueurs assis à la table, dans l'ORDRE du tour (Al-zahr l.17). */
  seats?: TavernSeat[];
  /** MISE : joueurs SORTIS de la manche en cours (éliminés ou ayant abandonné) — ils ne roulent plus. */
  out?: string[];
  /** MISE : le pot en jeu (sous de cuivre). */
  pot?: number;
  /** MISE : ce que CHAQUE joueur a mis dans le pot COURANT (sous) — ce qui lui revient si la partie
   *  s'interrompt avant qu'un vainqueur ne le rafle. Somme = `pot`, par construction. */
  mises?: Record<string, number>;
  /** MISE : le nombre CIBLE en cours ; `null`/absent = la manche est à ouvrir (mises + cible). */
  target?: number | null;
  /** MISE : rang de la manche (1-based) et index du joueur DONT C'EST LE TOUR. */
  manche?: number;
  seat?: number;
  /** MISE : mouvement de bourse de chaque HÉROS depuis le début de la partie (sous, signé) — versé
   *  aux bourses au dénouement. */
  net?: Record<string, number>;
  /** MISE : manches remportées par joueur (tableau de marque). */
  gains?: Record<string, number>;
  /** MISE : la partie s'arrête (plus assez de joueurs pour ouvrir une manche). */
  fin?: boolean;
  /** VOLÉE : le passage en cours — qui lance, son rang de lancer, sa réserve, sa ligne, la manche. */
  volley?: TavernVolleyState;
  /** CAMPS ASYMÉTRIQUES : l'id du camp que mène le CHALLENGER (Alvatafl l.25) ; absent = le camp
   *  reste à annoncer. */
  side?: string;
  /** TEST COMBINÉ : marques, échecs de seconde lecture, effacements, rang du tour (Cerevis l.90). */
  combined?: TavernCombinedState;
  /** SPÉCIAUX de chaque siège à fiche, par id de fiche, figés à l'ouverture (`specialsApplicables`,
   *  NADJ 16 l.82). Un siège absent n'en a aucun. */
  specials?: Record<string, TavernSpecial[]>;
}

/** Id de la fiche du vis-à-vis : son id de banc, ou celui que `pnjAuProfil` donne à l'habitué. */
function idAdverse(p: TavernPayload): string {
  return p.opponentId ?? HABITUE;
}

/** La Difficulté d'un Test du jeu POUR CE SIÈGE — ses seuls Spéciaux (NADJ 16 l.82). */
function difficulteDuSiege(p: TavernPayload, base: Difficulty, siege: string): Difficulty {
  return difficulteDuJoueur(base, p.specials?.[siege] ?? []);
}

/** Clés de camp de l'accumulateur du socle — le challenger et son vis-à-vis. */
const CAMP_PLAYER = 'joueur' satisfies CampDeTaverne;
const CAMP_OPPONENT = 'adversaire' satisfies CampDeTaverne;
/** Issue d'un ABANDON du challenger (`SequenceDef.abandon`) : une défaite, qui se dit comme telle. */
const TAVERN_ABANDON = 'abandon';

/** Kind de l'étape de CHOIX d'option de Test (Middenball l.119) — une par héros surfacé. */
const TAVERN_CHOICE_KIND = 'taverneOption';

/** Kind de l'étape de Résistance à l'alcool d'un lancer RATÉ (Torchon l.111). */
const TAVERN_DRINK_KIND = 'taverneBoisson';

/**
 * PARAMÈTRES DE SÉQUENCE d'un jeu — TOUS lus de son entrée de données : aucune valeur de règle n'est
 * écrite ici, aucun `si` par id de jeu. Un jeu N+1 à mécanismes connus n'est qu'une entrée de plus.
 */
export function tavernParams(jeu: TavernGame, joueurs = 0): SequenceParams {
  const game = structuredClone(jeu); // #2097
  // BORNE : les familles dont la manche n'est QU'UN lancer (pot, volée) déclarent l'unité de la leur
  // — la borne effective en découle, et reste sous le plafond absolu du contrat.
  const pot = game.pot;
  const manches = joueurs * (pot?.manchesPerPlayer ?? 1);
  const bornePot = pot?.roundsPerManche && manches > 0 ? manches * pot.roundsPerManche : 0;
  // Une volée se joue à DEUX passages (le challenger et son vis-à-vis) — l'effectif de la table est
  // celui du jeu de pot, pas le sien.
  const borne = bornePot > 0 ? bornePot : (game.volley ? sequenceVolleyRounds(game.volley, 2) : 0);
  return {
    ...(borne > 0 ? { maxRounds: borne } : {}),
    ...(game.target != null ? { target: game.target } : {}),
    ...(game.drCap != null ? { drCap: game.drCap } : {}),
    ...(game.tieBreak ? { tieBreak: game.tieBreak } : {}),
    ...(game.drBonus ? { drBonus: game.drBonus } : {}),
    ...(game.roundOps ? { rounds: game.roundOps } : {}),
    ...(game.avantage ? { avantage: true } : {}),
    ...(game.phases ? { phases: game.phases } : {}),
    ...(game.scoreThreshold != null ? { scoreThreshold: game.scoreThreshold } : {}),
    ...(game.table ? { table: game.table } : {}),
    ...(game.campScore ? { score: { [CAMP_PLAYER]: game.campScore, [CAMP_OPPONENT]: game.campScore } } : {}),
    ...(game.pot ? { pot: game.pot } : {}),
    ...(game.volley ? { volley: game.volley } : {}),
    ...(game.sides ? { sides: game.sides } : {}),
    ...(game.combined ? { combined: game.combined } : {}),
    ...(game.throwerPenalty ? { throwerPenalty: game.throwerPenalty } : {}),
  };
}

/**
 * LES JOUEURS assis à une table de jeu de MISE (Al-zahr l.17), dans l'ordre du tour : le challenger,
 * son vis-à-vis (compagnon OU habitué de la salle), puis les habitués qui complètent la table. Le
 * NOMBRE de joueurs est une grandeur de TABLE (la source décrit un cercle sans en fixer l'effectif) :
 * il est fourni par l'appelant, éditable à la modale, jamais figé au code.
 */
function potSeats(challenger: Combatant, opponentHero: Combatant | undefined, opponentName: PlayerText, joueurs: number): TavernSeat[] {
  const seats: TavernSeat[] = [{ id: challenger.id, label: nomDe(challenger), hero: true }];
  if (opponentHero) seats.push({ id: opponentHero.id, label: nomDe(opponentHero), hero: true });
  else seats.push({ id: 'habitue-1', label: opponentName, hero: false });
  for (let i = seats.length; i < Math.max(2, joueurs); i++) {
    seats.push({ id: `habitue-${i}`, label: t('tavern.potHabitue', { rang: i }), hero: false });
  }
  return seats;
}

/** Réglage d'une partie : le jeu, le vis-à-vis du challenger, la mise unitaire (sous de cuivre),
 *  le coéquipier d'un jeu d'équipe, l'effectif d'une table de pot. */
export interface ReglageDePartie {
  gameId: IdDeJeuDeTaverne; opponent: TavernOpponent; stakeBrass?: number; allyProfil?: IdDeProfilStandard; tablePlayers?: number;
}

/** Partie prête à jouer : ses acteurs résolus et sa mise plafonnée à la bourse du challenger. */
interface PartiePrete {
  game: TavernGame; challenger: Combatant; opponentActor: Combatant; allie: Combatant | undefined; stakeBrass: number;
}

/** Pourquoi le vis-à-vis de genre `kind` n'est pas offert pour `gameId` au challenger : un jeu d'ÉQUIPE
 *  oppose la salle au groupe entier, aucun compagnon d'en face, aucun PNJ de la scène qui joue ; `null` s'il
 *  l'est. Lu par `preparerLaPartie` et par le choix d'adversaire de la modale. Un PNJ `designe` (le geste)
 *  se juge à sa présence dans la scène (`tavern.adversaireAbsent`), pas aux offres de la salle. */
export function refusDAdversaire(s: Jeu, gameId: string, challengerId: string, kind: TavernOpponent['kind'], designe?: string): string | null {
  if (kind === 'profil') return null;
  if (findTavernGameById(gameId)?.team) return t('tavern.equipeContreLaSalle');
  if (kind === 'heros') return s.party.some((h) => !h.dead && h.id !== challengerId) ? null : t('tavern.aucunCompagnon');
  if (designe !== undefined) return null;
  return tavernNpcOffers(s.scene, presetDuNarratif(s.campaignNarratif)).length ? null : t('tavern.personneDansLaSalle');
}

/**
 * Résout le réglage de la partie que le héros `heroId` défie, ou dit pourquoi elle ne s'ouvre pas : table d'hôte
 * (`refusDeTableDHote`), séquence déjà active, jeu inconnu, challenger absent, coéquipier d'un jeu
 * d'équipe, genre de vis-à-vis non offert (`refusDAdversaire`), vis-à-vis absent, profil de coéquipier inconnu, mise absente d'un jeu de pot. SOURCE
 * UNIQUE de `refusDeJouer` et de `jouerALaTaverne`.
 */
function preparerLaPartie(s: Jeu, heroId: string, opts: ReglageDePartie): PartiePrete | { refus: string } {
  const refusHote = refusDeTableDHote(s);
  if (refusHote) return { refus: refusHote };
  // RÉ-ENTRÉE REFUSÉE : `startSequence` ÉCRASE `state.sequence` — une partie en cours disparaîtrait
  // sans verdict, sa mise engagée perdue.
  if (s.sequence) return { refus: t('tavern.dejaEnCours') };
  const game = findTavernGameById(opts.gameId);
  if (!game) return { refus: t('tavern.jeuInconnu', { id: opts.gameId }) };
  const challenger = s.party.find((h) => h.id === heroId);
  if (!challenger) return { refus: t('tavern.challengerAbsent', { jeu: game.label }) };
  const opp = opts.opponent;
  const refusDuVisAVis = refusDAdversaire(s, game.id, challenger.id, opp.kind, opp.id);
  if (refusDuVisAVis) return { refus: refusDuVisAVis };
  const opponentActor = opp.kind === 'heros' ? s.party.find((h) => h.id === opp.id)
    : opp.kind === 'pnj' ? sceneNpc(s.scene, opp.id, presetDuNarratif(s.campaignNarratif))
      : pnjAuProfil(opp.id, HABITUE);
  if (!!game.team !== (opts.allyProfil !== undefined)) {
    return { refus: t(game.team ? 'tavern.equipeSansCoequipier' : 'tavern.coequipierHorsEquipe', { jeu: game.label }) };
  }
  const allie = opts.allyProfil === undefined ? undefined : pnjAuProfil(opts.allyProfil, HABITUE);
  if (!opponentActor) return { refus: t('tavern.adversaireAbsent', { jeu: game.label }) };
  if (opts.allyProfil !== undefined && !allie) return { refus: t('tavern.coequipierSansProfil', { jeu: game.label, profil: opts.allyProfil }) };
  // MISE : celle d'un jeu de POT (« chaque joueur ajoute une mise égale au pot », l.17), qui sort de la
  // bourse du CHALLENGER (il paie s'il perd, encaisse s'il gagne) : plafonnée à SA bourse.
  const wantStake = game.pot ? Math.max(0, Math.floor(opts.stakeBrass ?? 0)) : 0;
  const stakeBrass = Math.min(wantStake, toBrass(bourseOf(challenger)));
  // « on ne mise que ce qu'on a » (arbitrage en tête du bloc AL-ZAHR).
  if (game.pot && stakeBrass <= 0) return { refus: t('tavern.potSansMise', { who: nomDe(challenger) }) };
  return { game, challenger, opponentActor, allie, stakeBrass };
}

/** Pourquoi la partie réglée par `opts`, que défie `heroId`, ne s'ouvre pas, ou `null` — verdict UNIQUE de `jouerALaTaverne`
 *  et de la modale (`preparerLaPartie`). */
export function refusDeJouer(s: Jeu, heroId: string, opts: ReglageDePartie): string | null {
  const p = preparerLaPartie(s, heroId, opts);
  return 'refus' in p ? p.refus : null;
}

/**
 * Joue une partie : instancie le socle de séquence, qui ouvre la 1ʳᵉ manche. `stakeBrass` est la
 * MISE UNITAIRE d'un jeu de pot, plafonnée à la bourse du challenger (`preparerLaPartie`) ; refusée,
 * la partie le DIT (`refusDeJouer`).
 */
export function jouerALaTaverne(get: Get, set: Set, heroId: string, opts: ReglageDePartie): void {
  const p = preparerLaPartie(get(), heroId, opts);
  if ('refus' in p) { refuserGeste(get, set, p.refus); return; }
  const { game, challenger, opponentActor, allie, stakeBrass } = p;
  const opp = opts.opponent;
  const opponentValue = tavernGameValue(opponentActor, game);
  const opponentName = nomDe(opponentActor);
  // L'habitué n'a aucun banc (`tavernActor`) : ses lectures passent par `opponentValue`.
  const opponentId = opp.kind === 'profil' ? undefined : opponentActor.id;

  const seats = game.pot ? potSeats(challenger, opponentId ? opponentActor : undefined, opponentName, opts.tablePlayers ?? 2) : [];
  // LES SIÈGES À FICHE : le challenger, son vis-à-vis, et les héros d'un jeu d'équipe.
  const specials = Object.fromEntries(
    [challenger, opponentActor, ...(game.team ? equipiers(get) : [])]
      .map((a) => [a.id, structuredClone(specialsApplicables(game, a))] as const) // #2097
      .filter(([, liste]) => liste.length > 0),
  );

  startSequence<TavernPayload>(get, set, {
    definition: TAVERN_SEQUENCE,
    parametres: tavernParams(game, seats.length),
    chargeUtile: {
      gameId: game.id, challengerId: challenger.id, opponentValue, opponentName,
      ...(opponentId ? { opponentId } : {}), stakeBrass,
      ...(allie ? { allyValue: tavernGameValue(allie, game) } : {}),
      ...(Object.keys(specials).length ? { specials } : {}),
      ...(game.pot
        ? { seats, manche: 1, pot: 0, target: null }
        : {}),
    },
  });
}

/**
 * DÉCLARATION de la SECONDE LECTURE d'un jeu à Test COMBINÉ (`NADJ 16 l.90` : « un Test combiné
 * d'**Initiative** et de **Pari Accessible (+20)** ») — ce que la RANGÉE dit d'elle-même : la
 * Compétence/Caractéristique que le MÊME dé tranche aussi, sa valeur et sa cible. C'est la SEULE
 * source de la seconde ligne affichée ; le compte des échecs, lui, reste au réducteur de clôture
 * (`combinedClose`), qui juge sur la même primitive (`evaluateCombinedTest`). Absente quand le jeu ne
 * déclare aucun Test combiné.
 */
function combinedSecondRead(game: TavernGame, acteur: Combatant | undefined, difficulty: Difficulty, nue: number): CascadeSecondRead | undefined {
  const regles = game.combined;
  if (!regles) return undefined;
  const test = testDeSequence(regles.second);
  return {
    label: testSkillLabel(test) ?? game.label,
    base: acteur ? testValue(acteur, test) : nue,
    target: combinedSecondTarget(regles, acteur, difficulty, nue),
    difficulty,
  };
}

/** RANGÉE d'un camp HÉROS dans une bande de manche — patron `pursuitFlow.pursuitRow` : ligne montée
 *  par le monteur canonique (`rollStep`), surfaçage SEAT-AGNOSTIQUE (`jetSurfaced`) pour que le héros
 *  d'un AUTRE siège garde son jet À JOUER. Le porteur qu'aucun siège ne tient (ou toute rangée en
 *  cadence Auto/Rapide) naît TÉMOIN, son jet déjà roulé. */
function tavernRow(get: Get, p: TavernPayload, h: Combatant, game: TavernGame, choix?: number): BatchParticipant {
  // L'OPTION retenue porte le Test ET sa Difficulté (Alvatafl l.25, Cerevis l.90 : « Pari Accessible
  // (+20) ») ; sans option déclarée, le repli est celui du jeu rapide (Intermédiaire, l.11).
  const opt = optionOf(game, choix);
  const test = testDeSequence(opt.test);
  const difficulty = difficulteDuSiege(p, difficulteDeBase(game, choix), h.id);
  const second = combinedSecondRead(game, h, difficulty, 0);
  const surLaCible = avantageSurLaCible(opt, porteurDAvantage(get, p, h, h.id === p.challengerId ? CAMP_PLAYER : CAMP_OPPONENT));
  const row: BatchParticipant = {
    id: h.id,
    label: testSkillLabel(test) ?? game.label,
    ...(test.skill ? { skill: structuredClone(test.skill) } : {}),
    difficulty,
    result: null,
    interactive: true,
    ...rollStep({ actor: h, test, difficulty, ...(surLaCible.length ? { surLaCible } : {}) }),
    ...(second ? { second } : {}),
  };
  if (!cadenceAuto() && jetSurfaced(get(), h)) return row;
  return { ...row, interactive: false, result: rollBatchParticipant(row, battleRng()) };
}

/* ── JEUX D'ÉQUIPE (Middenball, NADJ 16 l.117-119) ──────────────────────────────────────────────
 * « Deux équipes de 11 joueurs s'affrontent », « chaque tour, tous les joueurs effectuent un Test […]
 * On additionne le nombre de DR obtenus pour chaque équipe ».
 *
 * COMPOSITION DES CAMPS — arbitrage UTILISATEUR (2026-08-13, verbatim au ticket #1279) : « Le RAW se
 * joue tel quel : chaque camp complète à 11 avec des figurants PNJ (patrons de taverne, valeur simple
 * éditable) — les héros portent leurs jets, les figurants roulent en témoins auto. Le but à +25 et les
 * 11 danseurs restent RAW. » L'effectif (11) vient donc de la DONNÉE du jeu (`team.size`, RAW) ; la
 * VALEUR des figurants est celle que la table fixe pour la partie (`opponent.value`, déjà éditable à
 * la modale) — c'est la seule grandeur maison, et elle est éditable, jamais figée au code. */

/** UNE OPTION de Test d'une manche (celle que l'entrée déclare, ou le repli du jeu). */
type TavernOption = { test: Pick<FlowTest, 'skill' | 'characteristic' | 'difficulty'>; combatTest?: boolean };

/**
 * L'AVANTAGE d'un camp, en ligne NOMMÉE sur la cible (`LDB 14 l.215`, NADJ 16 l.34, l.119). Deux
 * garde-fous, tous deux DÉCLARÉS :
 *  · l'option dit si son Test est un Test de Combat (`combatTest`) — Bagarre oui, Athlétisme non ;
 *  · la ligne est celle du moteur (`advantageModLine`), jamais un `×10` réécrit ici.
 * Le porteur est un Combatant (héros) OU un point d'Avantage de camp (figurant, qui n'en a pas).
 */
function avantageSurLaCible(opt: TavernOption, porteur: Combatant | number): ModLine[] {
  if (!opt.combatTest) return [];
  const ligne = advantageModLine(typeof porteur === 'number' ? { advantage: porteur } : porteur);
  return ligne ? [ligne] : [];
}

/** RANGÉE d'un FIGURANT : témoin AUTO (aucun siège ne le tient), son jet déjà roulé — patron des
 *  rangées témoins de la bande (`pursuitFlow.pursuitRow`). Aucun Combatant : sa valeur est celle que
 *  la table lui donne, montée par le monteur CANONIQUE en valeur ÉTRANGÈRE (ce n'est pas un Niveau de
 *  Compétence de fiche) — la Difficulté de l'option et l'Avantage DE SON CAMP entrent dans la cible
 *  comme pour un héros (l'Avantage est gagné par l'ÉQUIPE, l.119, pas par ses seuls héros). */
function figurantRow(id: string, label: string, valeur: number, opt: TavernOption, avantage: number): BatchParticipant {
  const surLaCible = avantageSurLaCible(opt, avantage);
  // LDB 12 l.166
  const difficulty = opt.test.difficulty ?? TAVERN_TEST_DIFFICULTY;
  const row: BatchParticipant = {
    id, label, difficulty, result: null, interactive: false,
    ...(opt.test.skill ? { skill: structuredClone(opt.test.skill) } : {}),
    ...rollStep({ valeur, valeurEtrangere: true, difficulty, ...(surLaCible.length ? { surLaCible } : {}) }),
  };
  return { ...row, result: rollBatchParticipant(row, battleRng()) };
}

/** L'option de Test retenue pour un héros : son CHOIX s'il en a fait un, sinon la PREMIÈRE option que
 *  l'entrée déclare — c'est ce que jouent les porteurs qu'aucun siège ne tient, et les figurants. */
function optionOf(game: TavernGame, choix: number | undefined): TavernOption {
  const options = game.options ?? [];
  return options[choix ?? 0] ?? { ...enOption(tavernTestSpec(game)), ...(game.avantage ? { combatTest: true } : {}) };
}

/** Le PORTEUR de l'Avantage d'un siège : sa fiche quand la séquence la suit (`actorIn`), sinon le
 *  point que son camp porte (`TavernPayload.advantage`) — un PNJ de scène (`sceneNpc`) ou un habitué
 *  n'a pas de fiche suivie. */
function porteurDAvantage(get: Get, p: TavernPayload, h: Combatant | undefined, camp: CampDeTaverne): Combatant | number {
  return h && actorIn(get(), h.id) ? h : (p.advantage?.[camp] ?? 0);
}

/**
 * FABRIQUE du tour de CHOIX d'option d'une manche ORDINAIRE (Alvatafl l.25) : une étape par porteur
 * TENU par un siège ; personne ne lance avant que chacun n'ait dit ce qu'il tente (« déclaration
 * avant jets »). Aucun siège : la politique déclarée s'applique (la PREMIÈRE option, patron
 * `optionOf`) et aucune fenêtre ne s'ouvre.
 */
function tavernOptionRound(get: Get, seq: SequenceState<TavernPayload>, game: TavernGame): SequenceRound<TavernPayload> | undefined {
  const p = seq.chargeUtile;
  const porteurs = [p.challengerId, ...(p.opponentId ? [p.opponentId] : [])]
    .map((id) => actorIn(get(), id))
    .filter((h): h is Combatant => !!h && !cadenceAuto() && jetSurfaced(get(), h));
  if (!porteurs.length) return undefined;
  const steps = porteurs.map((h) => choiceStep({
    id: `${TAVERN_CHOICE_KIND}-${seq.manche}-${h.id}`,
    kind: TAVERN_CHOICE_KIND,
    label: t('tavern.optionChoix', { who: nomDe(h) }),
    icon: 'navigation/des',
    actorId: h.id,
    options: (game.options ?? []).map((o, i) => ({
      key: String(i),
      label: testSkillLabel(testDeSequence(o.test)) ?? dataLabel(game.label),
      detail: DIFFICULTY_LABELS[difficulteDuSiege(p, o.test.difficulty, h.id)],
    })),
    defaultChoice: '0',
  })).filter((s): s is BuiltCascadeStep => !!s);
  if (!steps.length) return undefined;
  return { title: stepDetail(dataLabel(game.label), t('tavern.optionTitre')), icon: 'navigation/des', steps };
}

/** La charge SANS le choix d'option retenu : le tour suivant le REDEMANDE (« à chaque tour, faites
 *  un Test d'Intelligence OU de Savoir », l.25) — une option ne se choisit pas une fois pour toutes. */
function sansChoix(p: TavernPayload): TavernPayload {
  const copie: TavernPayload = { ...p };
  delete copie.choices;
  return copie;
}

/** Héros du groupe qui jouent la partie (vivants, dans la rencontre). */
function equipiers(get: Get): Combatant[] {
  return get().party.filter((h) => !h.dead && !h.outOfRencontre);
}

/** RANGÉE d'un héros d'équipe, sur l'option qu'il a RETENUE (Test et Difficulté de cette option) —
 *  son Avantage propre entre dans la cible quand ce Test est un Test de Combat. */
function equipierRow(get: Get, p: TavernPayload, h: Combatant, game: TavernGame, choix: number | undefined): BatchParticipant {
  const opt = optionOf(game, choix);
  const test = testDeSequence(opt.test);
  const surLaCible = avantageSurLaCible(opt, h);
  const difficulty = difficulteDuSiege(p, difficulteDeBase(game, choix), h.id);
  const row: BatchParticipant = {
    id: h.id,
    label: testSkillLabel(test) ?? game.label,
    ...(test.skill ? { skill: structuredClone(test.skill) } : {}),
    difficulty,
    result: null,
    interactive: true,
    ...rollStep({ actor: h, test, difficulty, ...(surLaCible.length ? { surLaCible } : {}) }),
  };
  if (!cadenceAuto() && jetSurfaced(get(), h)) return row;
  return { ...row, interactive: false, result: rollBatchParticipant(row, battleRng()) };
}

/** LA BANDE d'un tour d'équipe : les héros (rangées à jouer), puis les figurants des DEUX camps
 *  (témoins auto) — l'effectif de chaque camp est complété à `team.size` (l.119). Les camps sont
 *  mémorisés PAR ID DE RANGÉE dans la charge utile : la clôture somme sur eux. */
function equipeBande(get: Get, seq: SequenceState<TavernPayload>): { band: BuiltCascadeStep; teams: Record<CampDeTaverne, string[]> } | undefined {
  const p = seq.chargeUtile;
  const game = findTavernGameById(p.gameId);
  if (game?.roundShape !== 'team' || !game.team) return undefined;
  const heros = equipiers(get);
  if (!heros.length) return undefined;
  const rows: BatchParticipant[] = heros.map((h) => equipierRow(get, p, h, game, p.choices?.[h.id]));
  const optionDuFigurant = optionOf(game, 0);
  const optFigurant = { ...optionDuFigurant, test: { ...optionDuFigurant.test, difficulty: difficulteDeBase(game, 0) } };
  const mien = [...heros.map((h) => h.id)];
  const sien: string[] = [];
  // Les coéquipiers du groupe ont LEUR valeur (`allyValue`), distincte de celle du camp d'en face :
  // sans elle, vos figurants joueraient sur la valeur de l'ADVERSAIRE.
  for (let i = heros.length; i < game.team.size; i++) {
    const id = `figurant-p-${seq.manche}-${i}`;
    rows.push(figurantRow(id, t('tavern.equipier', { rang: i + 1 }), valeurDesCoequipiers(p), optFigurant, p.advantage?.joueur ?? 0));
    mien.push(id);
  }
  for (let i = 0; i < game.team.size; i++) {
    const id = `figurant-o-${seq.manche}-${i}`;
    rows.push(figurantRow(id, `${p.opponentName} ${i + 1}`, p.opponentValue, optFigurant, p.advantage?.adversaire ?? 0));
    sien.push(id);
  }
  const ph = sequencePhaseOf(seq.parametres, seq.manche);
  const band = bandStep({
    id: idDansLaSequence(get, TAVERN_ROUND_KIND), // id = ADRESSE ; la MANCHE voyage sur `meta.round` (#1852)
    kind: TAVERN_ROUND_KIND,
    icon: 'navigation/des',
    label: stepDetail(dataLabel(game.label), t('step.tavernMiTemps', { n: ph.roundInPhase, phase: ph.phase })),
    stake: combatStakeRef('taverne-partie', {
      values: { jeu: game.label, adversaire: p.opponentName, mise: 'aucune' },
    }),
    meta: { gameId: game.id, opponentName: p.opponentName, stakeBrass: 0, round: seq.manche },
  }, rows);
  return band ? { band, teams: { joueur: mien, adversaire: sien } } : undefined;
}

/* ── LE TORCHON TREMPÉ (NADJ 16 l.109-111) ──────────────────────────────────────────────────────
 * « Il fait intervenir deux équipes de 12 personnes, placées en deux cercles de 11 joueurs qui dansent
 * main dans la main autour d'un membre de l'équipe adverse » (l.109) — d'où `team.size` 12 et
 * `dancers` 11, tous deux en donnée. « lorsque vous balancez le torchon, faites un Test opposé
 * Projectiles (Lancer) / Esquive d'un joueur choisi aléatoirement parmi les 11 danseurs » (l.111).
 *
 * UN TOUR = UN LANCEUR, et « le jeu se termine lorsque tous les joueurs ont lancé la serviette »
 * (l.111) : la borne de la séquence EST l'effectif des deux camps. L'ORDRE de passage n'est pas dit
 * par la source ; il est ici l'ordre des camps en alternance — et c'est sans conséquence mesurable :
 * chaque lancer est indépendant (cible tirée au sort, points additifs, un lancer par personne), donc
 * aucune décision de jeu n'en dépend. Seuls les lancers des HÉROS ouvrent une fenêtre ; les lancers de
 * figurants se résolvent sans en montrer aucune. */

/** L'ORDRE de passage, figé à l'ouverture : les héros et les figurants de votre camp, puis ceux d'en
 *  face, en ALTERNANCE (l.109 : deux équipes qui se font face). */
function torchonThrowers(get: Get, p: TavernPayload, game: TavernGame): TavernPayload['throwers'] {
  const taille = game.team?.size ?? 1;
  const heros = equipiers(get);
  const mien: NonNullable<TavernPayload['throwers']> = heros.map((h) => ({ id: h.id, label: nomDe(h), camp: 'joueur' as const }));
  for (let i = heros.length; i < taille; i++) {
    mien.push({ id: `figurant-p-${i}`, label: t('tavern.equipier', { rang: i + 1 }), camp: 'joueur', value: valeurDesCoequipiers(p) });
  }
  const sien: NonNullable<TavernPayload['throwers']> = [];
  for (let i = 0; i < taille; i++) {
    sien.push({ id: `figurant-o-${i}`, label: `${p.opponentName} ${i + 1}`, camp: 'adversaire', value: p.opponentValue });
  }
  const ordre: NonNullable<TavernPayload['throwers']> = [];
  for (let i = 0; i < taille; i++) {
    if (mien[i]) ordre.push(mien[i]);
    if (sien[i]) ordre.push(sien[i]);
  }
  return ordre;
}

/** FABRIQUE d'un tour de Torchon : le lanceur du rang, et LE DANSEUR tiré au sort dans le cercle d'en
 *  face (l.111) — les deux dans la MÊME bande, le danseur en témoin (son Esquive est roulée côté
 *  monde). La comparaison est faite à la clôture, comme toute bande. */
function torchonRound(get: Get, seq: SequenceState<TavernPayload>, rng: RNG): SequenceRound<TavernPayload> | undefined {
  const game = findTavernGameById(seq.chargeUtile.gameId);
  if (game?.roundShape !== 'thrower' || !game.dancers) return undefined;
  const throwers = seq.chargeUtile.throwers?.length ? seq.chargeUtile.throwers : torchonThrowers(get, seq.chargeUtile, game);
  const lanceur = throwers?.[seq.manche - 1];
  if (!lanceur) return undefined;
  const p: TavernPayload = { ...seq.chargeUtile, throwers };
  const test = tavernTestSpec(game);
  const heros = lanceur.camp === 'joueur' ? get().party.find((h) => h.id === lanceur.id) : undefined;
  const difficulty = difficulteDuSiege(p, difficulteDeBase(game), lanceur.id);
  const lanceurRow: BatchParticipant = heros
    ? {
      id: lanceur.id, label: testSkillLabel(test) ?? game.label, ...(test.skill ? { skill: structuredClone(test.skill) } : {}),
      difficulty, result: null, interactive: true,
      ...rollStep({ actor: heros, test, difficulty }),
    }
    : figurantRow(lanceur.id, lanceur.label, lanceur.value ?? p.opponentValue, { test: { difficulty } }, 0);
  const jouable = !!heros && !cadenceAuto() && jetSurfaced(get(), heros);
  // Un héros qu'aucun siège ne tient reste monté sur SA fiche (`equipierRow` l'a déjà roulé) : seule
  // sa rangée devient témoin. Il ne passe jamais par la porte des figurants, dont la fiche ne suit pas la séquence.
  const rows: BatchParticipant[] = [jouable ? lanceurRow : { ...lanceurRow, interactive: false, result: lanceurRow.result ?? rollBatchParticipant(lanceurRow, rng) }];
  // LE DANSEUR : tiré AU SORT parmi les 11 du cercle d'en face (l.111), il ESQUIVE (témoin). Le RANG
  // tiré est COSMÉTIQUE, et c'est fidèle : la source ne distingue les 11 danseurs par AUCUN trait —
  // ni valeur propre, ni effet de cible (l.109-111). Il ne sert donc qu'à nommer la rangée ; c'est
  // l'Esquive du cercle (valeur du camp) qui s'oppose au lancer. Le jour où une source distinguerait
  // les danseurs, ce tirage deviendrait mécanique et cette phrase tomberait.
  const rang = rng.int(1, game.dancers);
  const camp = lanceur.camp === 'joueur' ? p.opponentName : t('tavern.campMien');
  const valeur = lanceur.camp === 'joueur' ? p.opponentValue : valeurDesCoequipiers(p);
  rows.push(figurantRow(`danseur-${seq.manche}`, t('tavern.danseur', { rang, camp }), valeur, { test: { skill: { id: 'esquive' } } }, 0));
  const band = bandStep({
    id: idDansLaSequence(get, TAVERN_ROUND_KIND), // id = ADRESSE ; la MANCHE voyage sur `meta.round` (#1852)
    kind: TAVERN_ROUND_KIND,
    icon: 'navigation/des',
    label: stepDetail(dataLabel(game.label), t('step.tavernTorchon', { lanceur: lanceur.label })),
    stake: combatStakeRef('taverne-partie', { values: { jeu: game.label, adversaire: p.opponentName, mise: 'aucune' } }),
    meta: { gameId: game.id, opponentName: p.opponentName, stakeBrass: 0, round: seq.manche },
  }, rows);
  if (!band) return undefined;
  return {
    title: t('tavern.volleyLancer', { jeu: game.label, n: seq.manche, total: throwers!.length }),
    icon: 'navigation/des',
    steps: [band],
    immediate: !jouable,
    chargeUtile: p,
  };
}

/** `meta` de l'étape `taverneBoisson` : le camp et le nom du lanceur puni. */
interface PinteDuLanceur { camp: CampDeTaverne; who: string }

/** Lit le lanceur posé par `torchonRate`, SEUL producteur de l'étape (#1906). */
function lirePinte(meta: CascadeStepMeta | undefined): PinteDuLanceur {
  const camp = meta?.camp;
  if ((camp !== 'joueur' && camp !== 'adversaire') || typeof meta?.who !== 'string')
    throw new Error('[taverneBoisson] étape sans lanceur alors que `torchonRate` le pose (#1906)');
  return { camp, who: meta.who };
}

/** Le Test PROPRE d'une rangée de taverne : le verdict du d100 (`evaluateTest`, LDB 12 l.25-28), jamais
 *  l'issue d'opposition déjà portée par la rangée (`CascadeRoll.success`). */
function asTest(r: { roll: number; target: number; sl: number }, base?: number): TestResult {
  return { roll: r.roll, target: r.target, ...(base != null ? { base } : {}), success: evaluateTest(r.roll, r.target).success, sl: r.sl, isDouble: false };
}

/**
 * LE RATÉ d'un lancer — la SANCTION est DÉCLARÉE (famille 10, `SequenceParams.throwerPenalty`) :
 * le Test imposé, sa Difficulté, ce que l'échec applique au lanceur et ce qu'il coûte à son camp
 * viennent tous de l'entrée du jeu. Torchon l.111 : « vous devez descendre une pinte de bière et
 * faire un Test de **Résistance à l'alcool Intermédiaire (+0)** ». Un HÉROS tenu par un siège reçoit
 * son étape, APPENDÉE à la fenêtre du lancer (patron du choix d'option) ; tout autre lanceur
 * (figurant, héros sans siège) le passe d'office, sans fenêtre. Aucune sanction déclarée : le raté ne
 * coûte rien. Rendu : les lignes de récit du chemin d'office (vide sinon).
 */
function torchonRate(get: Get, set: Set, rows: readonly BatchParticipant[]): string[] {
  const seq = activeSequence<TavernPayload>(get);
  const p = seq?.chargeUtile;
  const game = p ? findTavernGameById(p.gameId) : undefined;
  const regles = seq?.parametres.throwerPenalty;
  if (!seq || !p || !game || !regles || game.roundShape !== 'thrower') return [];
  const test = testDeSequence(regles.test);
  const difficulty = regles.test.difficulty ?? TAVERN_TEST_DIFFICULTY;
  const lanceur = p.throwers?.[seq.manche - 1];
  const jet = rows.find((r) => r.id === lanceur?.id);
  const danseur = rows.find((r) => r.id.startsWith('danseur-'));
  if (!lanceur || !jet || !danseur || !estJete(jet.result) || !estJete(danseur.result)) return [];
  if (resolveOpposed(asTest(jet.result, jet.base), asTest(danseur.result, danseur.base)).attackerWins) return [];
  const heros = actorIn(get(), lanceur.id);
  const id = `${TAVERN_DRINK_KIND}-${seq.manche}`;
  const etape = heros && !cadenceAuto() && jetSurfaced(get(), heros)
    ? monoStep({
      id,
      kind: TAVERN_DRINK_KIND,
      icon: 'navigation/des',
      label: composeRollLabel(heros, regles.label ?? game.label, test),
      actor: heros,
      difficulty,
      ligne: { test },
      stake: combatStakeRef('taverne-partie', { values: { jeu: game.label, adversaire: p.opponentName, mise: 'aucune' } }),
      meta: { camp: lanceur.camp, who: lanceur.label } satisfies PinteDuLanceur,
    })
    : undefined;
  if (etape) {
    pushStep(set, etape, SEQUENCE_PURPOSE);
    return [];
  }
  // Aucun siège : le Test se joue d'office, monté par le MÊME monteur que partout — sur la FICHE du
  // héros quand il y en a une (chemin acteur, patron `equipierRow`), en valeur de table pour un
  // figurant, dont la fiche ne suit pas la séquence (valeur dérivée à l'ouverture). Jamais un jet forgé à la main.
  const pinte: BatchParticipant = heros
    ? {
      id, label: testSkillLabel(test) ?? lanceur.label, ...(test.skill ? { skill: structuredClone(test.skill) } : {}),
      difficulty, result: null, interactive: false,
      ...rollStep({ actor: heros, test, difficulty }),
    }
    : figurantRow(id, lanceur.label, lanceur.value ?? p.opponentValue, { test: { ...regles.test, difficulty } }, 0);
  const jete = pinte.result ?? rollBatchParticipant(pinte, battleRng());
  return torchonBoit(get, set, lanceur.id, lanceur.camp, lanceur.label, jete.success);
}

/** CE QUE COÛTE le Test raté de la sanction : ses `ops` au lanceur, ses `points` à son camp — retirés
 *  de l'ACCUMULATEUR du socle EN COURS DE MANCHE (`setSequenceCumuls`), la clôture les relit là. Le RÉCIT
 *  est celui que la sanction DÉCLARE (`lines`) : aucune phrase n'est écrite ici. */
function torchonBoit(get: Get, set: Set, lanceurId: string, camp: CampDeTaverne, label: string, success: boolean): string[] {
  const seq = activeSequence<TavernPayload>(get);
  const regles = seq?.parametres.throwerPenalty;
  if (!seq || !regles) return [];
  if (success) return regles.lines?.reussite ? [interpolate(regles.lines.reussite, { who: label })] : [];
  const perte = regles.points ?? 0;
  const acteur = actorIn(get(), lanceurId);
  const lignes: string[] = regles.lines?.echec
    ? [interpolate(regles.lines.echec, { who: label, points: perte, s: pluriel(perte) })]
    : [];
  if (acteur && regles.ops?.length) {
    // ANCRAGE DE RÈGLE : ce que la sanction applique se relie à la FICHE DU JEU, qui porte sa règle
    // verbatim — un effet actif sans ancrage s'affiche NU (`effect-rule-anchor`).
    lignes.push(...applyOps(acteur, [...regles.ops], { idNeuf: get().forgerUnId, rng: battleRng(), source: { kind: 'jeuDeTaverne', id: seq.chargeUtile.gameId } }));
  }
  if (perte) setSequenceCumuls(get, set, { ...seq.cumuls, [camp]: (seq.cumuls[camp] ?? 0) - perte });
  return lignes;
}

/** FABRIQUE d'un TOUR d'équipe : les CHOIX d'option des héros surfacés (la bande suivra, appendée par
 *  le dernier choix) ; sans aucun siège humain, la bande se monte d'office sur la politique déclarée
 *  et se résout sans fenêtre. */
function tavernTeamRound(get: Get, seq: SequenceState<TavernPayload>): SequenceRound<TavernPayload> | undefined {
  const p = seq.chargeUtile;
  const game = findTavernGameById(p.gameId);
  if (!game?.team) return undefined;
  const ph = sequencePhaseOf(seq.parametres, seq.manche);
  const titre = t('tavern.miTempsTitre', { jeu: game.label, phase: ph.phase, n: ph.roundInPhase, total: ph.rounds });
  const aChoisir = (game.options?.length ?? 0) > 1
    ? equipiers(get).filter((h) => !cadenceAuto() && jetSurfaced(get(), h))
    : [];
  if (!aChoisir.length) {
    const monte = equipeBande(get, { ...seq, chargeUtile: { ...p, choices: {} } });
    if (!monte) return undefined;
    return { title: titre, icon: 'navigation/des', steps: [monte.band], immediate: true, chargeUtile: { ...p, teams: monte.teams, choices: {} } };
  }
  const steps = aChoisir.map((h) => choiceStep({
    id: `${TAVERN_CHOICE_KIND}-${seq.manche}-${h.id}`,
    kind: TAVERN_CHOICE_KIND,
    label: t('step.tavernCommentJouer'),
    icon: 'navigation/des',
    actorId: h.id,
    options: (game.options ?? []).map((o, i) => ({
      key: String(i),
      label: testSkillLabel(testDeSequence(o.test)) ?? dataLabel(game.label),
      detail: DIFFICULTY_LABELS[difficulteDuSiege(p, o.test.difficulty, h.id)],
    })),
    defaultChoice: '0',
  })).filter((s): s is BuiltCascadeStep => !!s);
  if (!steps.length) return undefined;
  return { title: titre, icon: 'navigation/des', steps, chargeUtile: { ...p, choices: {} } };
}

/** La partie et son challenger, validés par `jouerALaTaverne` à l'ouverture : leur absence en cours de
 *  séquence est un défaut, jamais un retour muet (#1906). */
function partieEnCours(get: Get, p: TavernPayload, site: string): { game: TavernGame; challenger: Combatant } {
  return {
    game: garanti(findTavernGameById(p.gameId), p.gameId, `${site} — jeu`),
    challenger: garanti(actorIn(get(), p.challengerId), p.challengerId, `${site} — challenger`),
  };
}

/**
 * FABRIQUE DE MANCHE (socle). Héros contre HÉROS : une BANDE, une rangée par camp — chaque siège joue
 * SON jet. Héros contre la SALLE : l'adversaire abstrait est roulé ICI et FIGÉ (`meta.opposed`, #579),
 * puis l'étape du challenger est MINTÉE (`monoStep`) ; `immediate` quand aucun siège humain ne tient
 * le challenger (cadence Auto/Rapide, héros conduit par l'IA).
 */
function tavernRound(get: Get, seq: SequenceState<TavernPayload>, rng: RNG): SequenceRound<TavernPayload> | undefined {
  const p = seq.chargeUtile;
  const { game, challenger } = partieEnCours(get, p, 'manche de taverne');
  if (game.roundShape === 'thrower') return torchonRound(get, seq, rng);
  if (game.roundShape === 'team') return tavernTeamRound(get, seq);
  if (game.roundShape === 'pot') return potRound(get, seq, rng);
  if (game.roundShape === 'volley') return volleyRound(get, seq, rng);
  // CAMPS ASYMÉTRIQUES : le camp mené s'annonce AVANT la première manche (sa conversion en dépend).
  if (game.sides?.length && p.side == null) return sideRound(get, seq, game, rng);
  // MARQUES à EFFACER (Cerevis l.88) : le geste appartient au joueur, il précède le tour.
  if (game.combined && !p.combined?.efface) {
    const efface = combinedEraseRound(get, seq, game);
    if (efface) return efface;
  }
  // OPTIONS de Test d'une manche ORDINAIRE (Alvatafl l.25 : « un Test d'**Intelligence** ou de
  // **Savoir (Art de la Guerre)** ») — MÊME capacité déclarée que le jeu d'équipe, autre forme de
  // manche : la décision précède le jet, dont elle règle le Test ET la Difficulté.
  if ((game.options?.length ?? 0) > 1 && p.choices == null) {
    const choix = tavernOptionRound(get, seq, game);
    if (choix) return choix;
  }
  // L’adversaire INCARNÉ de la manche — compagnon OU PNJ de scène : la même couture, sinon un
  // adversaire à fiche perdrait sa rangée et retomberait sur le montage à jet adverse figé.
  const opponentHero = tavernActor(get, p.opponentId);
  const title = stepDetail(dataLabel(game.label), t('tavern.contre', { who: nomDe(challenger), adversaire: p.opponentName }));
  const stake = combatStakeRef('taverne-partie', {
    values: {
      jeu: game.label, adversaire: p.opponentName,
      mise: p.stakeBrass > 0 ? formatMoney(fromBrass(p.stakeBrass)) : 'aucune',
    },
  });

  if (opponentHero) {
    const rows = [
      tavernRow(get, p, challenger, game, p.choices?.[challenger.id]),
      tavernRow(get, p, opponentHero, game, p.choices?.[opponentHero.id]),
    ];
    const band = bandStep({
      id: idDansLaSequence(get, TAVERN_ROUND_KIND), // id = ADRESSE ; la MANCHE voyage sur `meta.round` (#1852)
      kind: TAVERN_ROUND_KIND,
      icon: 'navigation/des',
      label: stepDetail(dataLabel(game.label), t('step.tavernManche', { n: seq.manche })),
      stake,
      meta: { gameId: game.id, opponentName: p.opponentName, stakeBrass: p.stakeBrass, round: seq.manche },
    }, rows);
    if (!band) return undefined;
    return {
      title, icon: 'navigation/des', steps: [band],
      immediate: rows.every((r) => r.interactive === false),
    };
  }

  const optMien = optionOf(game, p.choices?.[challenger.id]);
  const difficulty = difficulteDuSiege(p, difficulteDeBase(game, p.choices?.[challenger.id]), challenger.id);
  const test = testDeSequence(optMien.test);
  // L'adversaire de la SALLE joue l'option retenue, à SA Difficulté (NADJ 16 l.82), avec l'Avantage de
  // son camp quand le Test l'admet (l.34).
  const difficulteAdverse = difficulteDuSiege(p, difficulteDeBase(game, p.choices?.[challenger.id]), idAdverse(p));
  const avantageAdverse = avantageSurLaCible(optMien, p.advantage?.[CAMP_OPPONENT] ?? 0).reduce((s, l) => s + l.value, 0);
  const rolled = rollTavernTest(p.opponentValue, rng, difficulteAdverse, avantageAdverse);
  const surLaCible = avantageSurLaCible(optMien, challenger);
  // TEST COMBINÉ (Cerevis l.90) : la fenêtre annonce SES DEUX cibles — sans quoi le second Test ne se
  // découvrait qu'en le ratant (friction mesurée en recette, #1279 S3).
  const second = combinedSecondRead(game, challenger, difficulty, p.opponentValue);
  const step = monoStep({
    id: idDansLaSequence(get, TAVERN_ROUND_KIND), // id = ADRESSE ; la MANCHE voyage sur `meta.round` (#1852)
    kind: TAVERN_ROUND_KIND,
    icon: 'navigation/des',
    label: composeRollLabel(challenger, game.label, test),
    actor: challenger,
    difficulty,
    ligne: { test, ...(surLaCible.length ? { surLaCible } : {}) },
    ...(second ? { second } : {}),
    stake,
    meta: {
      gameId: game.id, opponentValue: p.opponentValue, opponentName: p.opponentName,
      stakeBrass: p.stakeBrass, round: seq.manche,
      // L'adversaire de la salle joue le MÊME Test que le challenger : la STRUCTURE voyage, le
      // libellé de sa ligne s'écrit au rendu.
      opposed: { aT: rolled, attackerName: p.opponentName, test, difficulty: difficulteAdverse },
    },
  });
  if (!step) return undefined;
  return {
    title, icon: 'navigation/des', steps: [step],
    immediate: !surfaceOf(get, challenger.id),
  };
}

/** Les DEUX jets d'une manche close, quel que soit son montage — SOURCE UNIQUE de lecture du
 *  réducteur (bande : une rangée par camp ; mono : le jet du challenger et le jet adverse FIGÉ). */
function tavernSides(ctx: SequenceCloseCtx<TavernPayload>): {
  joueur: TestResult; adversaire: TestResult; acteurDuJoueur?: Combatant; acteurDeLAdversaire?: Combatant;
} | undefined {
  const { get, seq, mancheClose } = ctx;
  const p = seq.chargeUtile;
  const step = mancheClose.participants.find((s) => s.kind === TAVERN_ROUND_KIND);
  if (!step) return undefined;
  if (step.participants) {
    const mien = step.participants.find((r) => r.id === p.challengerId);
    const sien = step.participants.find((r) => r.id === p.opponentId);
    if (!mien || !sien || !estJete(mien.result) || !estJete(sien.result)) return undefined;
    return {
      joueur: asTest(mien.result, mien.base), adversaire: asTest(sien.result, sien.base),
      acteurDuJoueur: tavernActor(get, p.challengerId), acteurDeLAdversaire: tavernActor(get, p.opponentId),
    };
  }
  if (!estJete(step.result)) return undefined;
  return {
    joueur: asTest(step.result, step.base),
    adversaire: garanti(step.meta?.opposed?.aT, step.id, 'jet adverse figé de la manche'),
    acteurDuJoueur: actorIn(get(), p.challengerId),
  };
}

/**
 * RÉDUCTEUR DE CLÔTURE d'un lancer de TORCHON (`NADJ 16 l.111` — la règle vit à l'Atlas et dans
 * la `desc` de l'entrée, ici ce qu'en fait le code) :
 *  · Test OPPOSÉ lanceur / danseur, barème de points par la TABLE déclarée en donnée, lue par le socle
 *    (`sequenceTableRow`, famille 2) sur le DR NET de l'opposition ;
 *  · lancer manqué : la SANCTION DÉCLARÉE (famille 10, `throwerPenalty`) — étape APPENDÉE à la même
 *    fenêtre pour un héros, résolue d'office sinon ; ce qu'elle coûte est compté par son applier ;
 *  · dernier lanceur : BALAYAGE final sur les lanceurs de CHAQUE camp, au prix DÉCLARÉ
 *    (`throwerPenalty.sobrietyPoints`) par lanceur qui n'a pas roulé sur le Tableau Ivre.
 * Les points d'un camp sont l'ACCUMULATEUR du socle (`seq.cumuls`) — aucun compteur jumeau.
 */
function torchonClose(ctx: SequenceCloseCtx<TavernPayload>): SequenceVerdict<TavernPayload> {
  const { get, seq, mancheClose } = ctx;
  const p = seq.chargeUtile;
  const band = mancheClose.participants.find((s) => s.kind === TAVERN_ROUND_KIND);
  const lanceur = p.throwers?.[seq.manche - 1];
  if (!band?.participants || !lanceur) return { suite: 'fin', issue: 'egalite' };
  const jet = band.participants.find((r) => r.id === lanceur.id);
  const danseur = band.participants.find((r) => r.id.startsWith('danseur-'));
  const cumuls = { ...seq.cumuls };
  const log: string[] = [];
  if (jet && danseur && estJete(jet.result) && estJete(danseur.result)) {
    const opp = resolveOpposed(asTest(jet.result, jet.base), asTest(danseur.result, danseur.base));
    if (opp.attackerWins) {
      const ligne = sequenceTableRow(seq.parametres, opp.netSL);
      const touche = garanti(ligne, opp.netSL, 'ligne de touche');
      const gain = touche.points;
      cumuls[lanceur.camp] = (cumuls[lanceur.camp] ?? 0) + gain;
      log.push(t('tavern.torchonTouche', { who: lanceur.label, ou: touche.label, points: gain, s: pluriel(gain), dr: opp.netSL }));
    } else if (seq.parametres.throwerPenalty?.lines?.manque) {
      log.push(interpolate(seq.parametres.throwerPenalty.lines.manque, { who: lanceur.label }));
    }
  }
  // La perte du pot non vidé (l.111) est comptée par l'applier de la sanction, qui la pose dans
  // l'accumulateur : elle est donc DÉJÀ dans `seq.cumuls` quand la clôture le relit.
  const dernier = seq.manche >= (p.throwers?.length ?? 0);
  const marque = (): TavernPayload => ({ ...p, last: { dr: { joueur: cumuls[CAMP_PLAYER] ?? 0, adversaire: cumuls[CAMP_OPPONENT] ?? 0 } } });
  if (!dernier) return { suite: 'poursuivre', cumuls, chargeUtile: marque(), log };

  // BALAYAGE FINAL (`NADJ 16 l.111`) : le critère porte sur le jet du Tableau d'Ivresse, sans borne
  // de partie — c'est donc l'ÉTAT du personnage qui répond (`isDrunk`, `engine/drunkenness` : un
  // résultat du Tableau a été tiré), y compris pour un lanceur arrivé ivre à la taverne. Un figurant
  // n'a pas de fiche dans la séquence : il n'a jamais bu, il compte — pour les DEUX camps (symétrie). Le PRIX du
  // lanceur trop sobre est DÉCLARÉ ; sans déclaration, aucun balayage.
  const prix = seq.parametres.throwerPenalty?.sobrietyPoints ?? 0;
  if (prix) {
    const sobres = { [CAMP_PLAYER]: 0, [CAMP_OPPONENT]: 0 };
    for (const lanceurDuBalayage of p.throwers ?? []) {
      const fiche = actorIn(get(), lanceurDuBalayage.id);
      if (!fiche || !isDrunk(fiche)) sobres[lanceurDuBalayage.camp] += 1;
    }
    cumuls[CAMP_PLAYER] = (cumuls[CAMP_PLAYER] ?? 0) - sobres[CAMP_PLAYER] * prix;
    cumuls[CAMP_OPPONENT] = (cumuls[CAMP_OPPONENT] ?? 0) - sobres[CAMP_OPPONENT] * prix;
    const dit = seq.parametres.throwerPenalty?.lines?.balayage;
    if (dit) {
      log.push(interpolate(dit, {
        mien: sobres[CAMP_PLAYER], sien: sobres[CAMP_OPPONENT],
        perteMien: sobres[CAMP_PLAYER] * prix, perteSien: sobres[CAMP_OPPONENT] * prix,
      }));
    }
  }
  const mien = cumuls[CAMP_PLAYER] ?? 0;
  const sien = cumuls[CAMP_OPPONENT] ?? 0;
  const issue: TavernGameResult['winner'] = mien > sien ? 'joueur' : sien > mien ? 'adversaire' : 'egalite';
  return { suite: 'fin', issue, cumuls, chargeUtile: marque(), log };
}

/**
 * RÉDUCTEUR DE CLÔTURE d'un TOUR D'ÉQUIPE (Middenball NADJ 16 l.119, verbatim) : « On additionne le
 * nombre de DR obtenus pour chaque équipe. L'équipe qui obtient le total le plus élevé gagne +1
 * Avantage pour le tour suivant […], et marquera un but si son total est de +25 ou plus. Une partie
 * dure deux mi-temps de trois tours chacune. »
 *  · la SOMME par camp est la formule DÉCLARÉE en donnée (`campScore: 'sum'`, famille 3 du socle) ;
 *  · le +1 Avantage est l'op de manche DÉCLARÉE, appliquée par le socle aux héros du camp vainqueur ;
 *  · le BUT est le seuil DÉCLARÉ (`scoreThreshold`), et il n'est marqué que par le camp qui l'emporte ;
 *  · la partie s'achève à la DERNIÈRE manche des phases déclarées, sur le compte des buts.
 * Les figurants n'ont aucun Combatant : leur camp porte son Avantage (`campsSansFiche`).
 */
function tavernTeamClose(ctx: SequenceCloseCtx<TavernPayload>, game: TavernGame): SequenceVerdict<TavernPayload> {
  const { seq, mancheClose } = ctx;
  const p = seq.chargeUtile;
  const band = mancheClose.participants.find((s) => s.kind === TAVERN_ROUND_KIND);
  const teams = p.teams;
  if (!band?.participants || !teams) return { suite: 'fin', issue: 'egalite' };
  const drOf = (ids: readonly string[]): number[] => ids
    .map((id) => band.participants!.find((r) => r.id === id))
    .filter((r): r is BatchParticipant => !!r)
    .map((r) => r.result?.sl ?? 0);
  const total = {
    [CAMP_PLAYER]: sequenceScoreOf(seq.parametres.score?.[CAMP_PLAYER], drOf(teams.joueur)),
    [CAMP_OPPONENT]: sequenceScoreOf(seq.parametres.score?.[CAMP_OPPONENT], drOf(teams.adversaire)),
  };
  const tp = total[CAMP_PLAYER];
  const to = total[CAMP_OPPONENT];
  const gagnant: TavernGameResult['winner'] = tp > to ? 'joueur' : to > tp ? 'adversaire' : 'egalite';
  const seuil = seq.parametres.scoreThreshold;
  const but = seuil != null && gagnant !== 'egalite' && Math.max(tp, to) >= seuil;
  // LES BUTS sont l'ACCUMULATEUR du socle (`seq.cumuls`) : un but marqué par le camp qui l'emporte.
  const buts = {
    ...seq.cumuls,
    [CAMP_PLAYER]: (seq.cumuls[CAMP_PLAYER] ?? 0) + (but && gagnant === 'joueur' ? 1 : 0),
    [CAMP_OPPONENT]: (seq.cumuls[CAMP_OPPONENT] ?? 0) + (but && gagnant === 'adversaire' ? 1 : 0),
  };
  const ph = sequencePhaseOf(seq.parametres, seq.manche);
  const heros = new Set(equipiers(ctx.get).map((h) => h.id));
  const herosDuCamp = teams.joueur.filter((id) => heros.has(id));
  const porteurs = {
    vainqueurs: gagnant === 'joueur' ? herosDuCamp : [],
    perdants: gagnant === 'adversaire' ? herosDuCamp : [],
    tous: herosDuCamp,
  };
  const tour = { jeu: game.label, n: seq.manche, mien: tp, sien: to };
  const log = [but
    ? t('tavern.equipeTourBut', { ...tour, qui: gagnant === 'joueur' ? t('tavern.equipeQui') : p.opponentName })
    : t('tavern.equipeTour', tour)];
  const chargeUtile: TavernPayload = { ...campsSansFiche(ctx, gagnant), last: { dr: { joueur: tp, adversaire: to } } };
  if (!ph.last) return { suite: 'poursuivre', cumuls: buts, chargeUtile, log, porteurs };
  const bp = buts[CAMP_PLAYER] ?? 0;
  const bo = buts[CAMP_OPPONENT] ?? 0;
  const issue: TavernGameResult['winner'] = bp > bo ? 'joueur' : bo > bp ? 'adversaire' : 'egalite';
  return { suite: 'fin', issue, cumuls: buts, chargeUtile, log, porteurs };
}

/* ── L'AL-ZAHR : MISE, POT, ABANDON, ÉLIMINATION (`NADJ 16 l.15-17`) ────────────────────────────
 * Un tour = UN joueur qui lance les dés DÉCLARÉS devant le pot ; la plage où tombe le total déclare
 * son effet (famille 5 du socle, `resolveSequencePotTurn`). Ici vivent les joueurs, l'ordre, les
 * manches et l'ARGENT : chaque mouvement est porté par la charge utile, et versé aux bourses au
 * dénouement — le pot n'est jamais un chiffre sans contrepartie.
 *
 * DEUX POLITIQUES pour les joueurs qu'aucun siège ne tient (habitués de la salle, héros sans siège,
 * cadence auto) — le RAW ne dit pas ce qu'ILS choisissent, et un jeu sans MJ ne s'en remet à
 * personne : le nombre cible est TIRÉ dans la plage déclarée, et la remise se paie tant que la
 * bourse suit. Un joueur tenu par un siège, lui, tranche par une fenêtre de choix.
 *
 * BOURSE VIDE : la source ne dit rien du joueur qui ne peut pas suivre. Arbitrage EXPLICITE, tenu à
 * un seul endroit (`potSolvable`) : on ne mise que ce qu'on a — sans mise, aucune table ne s'ouvre ;
 * qui ne peut pas payer sa mise n'entre pas dans la manche ; qui ne peut pas payer une remise
 * abandonne.
 *
 * ARGENT DES HABITUÉS : leur mise entre au pot sans sortir d'aucune bourse, et ce qu'ils raflent ne
 * revient à personne. C'est un CHOIX (la salle n'a pas de bourse modélisée) : le groupe peut donc
 * encaisser de l'argent qui n'existait pas avant la partie, et en perdre qui ne va nulle part. La
 * symétrie serait une bourse de PNJ — elle n'existe pas, et l'inventer serait du contenu maison.
 *
 * `NADJ 16 l.11` — le régime RAPIDE (Test opposé de Pari, dont la source nomme l'Al-zahr en
 * exemple) est la règle optionnelle `jeux-de-taverne-rapides` : active, le catalogue ne rend plus de
 * mise ni de pot (`findTavernGameById`), et la table entière ci-dessous reste au repos.
 * `NADJ 16 l.19` — le « Spécial » (Chance en relance du lancer, Maîtrise des dés) -> #1306.
 */

/** Étape du LANCER d'un tour (table à poser pour un héros tenu par un siège, affichage sinon). */
const TAVERN_POT_KIND = 'tavernePotTour';
/** Étape du choix « remettre ou abandonner ». */
const TAVERN_FOLD_KIND = 'tavernePotCoucher';
/** Étape du choix du NOMBRE CIBLE, en ouverture de manche. */
const TAVERN_TARGET_KIND = 'tavernePotCible';

/** UN JOUEUR assis à la table. `hero` = un Combatant du groupe : sa bourse joue, il peut tenir un
 *  siège. Les autres sont les habitués de la salle, dont la table fixe le nombre. */
export interface TavernSeat {
  id: string;
  label: PlayerText;
  hero: boolean;
}

/** Id de la table des plages d'un jeu de MISE — une par entrée qui en déclare : le catalogue est
 *  PARCOURU, aucun jeu n'est nommé au code. */
function potTableId(gameId: string): string {
  return `tavern-pot:${gameId}`;
}

/** Les tables de MISE du catalogue — FAMILLE dérivée de `tavernGames` (#1692) : un jeu ajouté au
 *  Codex a SA table et un jeu retiré n'en a plus, à la première lecture des tables qui suit
 *  l'édition, pour TOUS ses lecteurs — pas seulement pour le site qui ouvre le lancer. */
const tablesDePot = memoParVersion('tavernGames', () => {
  const tables = new Map<string, TableStepDef>();
  for (const jeu of TAVERN_GAMES) {
    const regles = jeu.pot;
    if (!regles) continue;
    tables.set(potTableId(jeu.id), {
      label: jeu.label,
      die: deDeLaTableTiree(regles),
      rows: regles.rows.map((r) => ({ min: r.min, max: r.max, id: r.potEffectId, label: r.label })),
      // L'ENCART de résultat (ce que le joueur lit juste après « Lancer ») dit l'ISSUE du lancer, pas
      // la fourchette où il tombe : la cible est celle du TOUR, lue à la RÉSOLUTION via le contexte du
      // tirage — jamais figée ici, à la déclaration. Même fonction que le journal (`sequencePotIssue`),
      // donc une seule vérité ; sans contexte ni séquence, la fourchette reste le libellé.
      lines: (total, ctx) => {
        const plage = findTableEntry([...regles.rows], total);
        const seq = ctx ? activeSequence<TavernPayload>(ctx.get) : null;
        if (!seq || seq.chargeUtile.gameId !== jeu.id) return [plage.label];
        const cible = seq.chargeUtile.target ?? regles.targetRange?.min ?? 0;
        const { outcome } = resolveSequencePotTurn(seq.parametres, potTurnOf(seq.chargeUtile, total, cible));
        return [sequencePotIssue(outcome) ?? plage.label];
      },
    });
  }
  return tables;
});

/** La DÉCLARATION de tirage d'un tour : sa table, qui porte le dé de la donnée (#1667). */
function potDecl(game: TavernGame): CascadeTableDecl {
  return { tableId: potTableId(game.id) };
}

/** Ce qui RESTE à un joueur : sa bourse, corrigée des mouvements déjà engagés dans la partie (les
 *  bourses ne bougent qu'au dénouement). Un habitué joue la sienne, hors partie. */
function potSolvable(get: Get, net: Record<string, number>, seat: TavernSeat, montant: number): boolean {
  if (!seat.hero) return true;
  const hero = actorIn(get(), seat.id);
  return !!hero && toBrass(bourseOf(hero)) + (net[seat.id] ?? 0) >= montant;
}

/** Mouvement d'argent d'un joueur (signé, sous) — seuls les héros ont une bourse à mouvoir. */
function potMouvement(net: Record<string, number>, seat: TavernSeat, delta: number): Record<string, number> {
  return seat.hero ? { ...net, [seat.id]: (net[seat.id] ?? 0) + delta } : net;
}

/** Le prochain joueur ENCORE EN JEU, dans l'ordre du tour (« dans le sens des aiguilles d'une
 *  montre », l.17) — un joueur sorti ne relance jamais. */
export function potProchain(seats: readonly TavernSeat[], depuis: number, out: readonly string[]): number {
  for (let i = 1; i <= seats.length; i++) {
    const k = (depuis + i) % seats.length;
    if (!out.includes(seats[k].id)) return k;
  }
  return depuis;
}

/** L'ENJEU d'une étape de tour — la mise réelle, jamais « aucune ». */
function potStake(game: TavernGame, p: TavernPayload) {
  return combatStakeRef('taverne-partie', {
    values: { jeu: game.label, adversaire: p.opponentName, mise: formatMoney(fromBrass(p.stakeBrass)) },
  });
}

/** La cible TIRÉE dans la plage déclarée, pour un joueur qu'aucun siège ne tient (l.17) ; sans plage,
 *  aucun nombre n'est annoncé. */
function potCibleTiree(game: TavernGame, rng: RNG): number {
  const plage = game.pot!.targetRange;
  return plage ? rng.int(plage.min, plage.max) : 0;
}

/** Le TOTAL des dés d'un tour, quel que soit son montage : table posée par le joueur, ou lancer
 *  résolu côté monde et rapporté par l'étape d'affichage. */
function potTotalOf(step: BuiltCascadeStep | CascadeStep): number | null {
  const pose = step.table?.result?.roll;
  if (pose != null) return pose;
  const rapporte = step.meta?.potRoll;
  return typeof rapporte === 'number' ? rapporte : null;
}

/** Le tour tel que le voit un effet de pot (famille 5) : total, cible, mise, pot — le paramètre
 *  `mises` de la plage est versé par le socle, qui seul sait quelle plage a été trouvée. */
function potTurnOf(p: TavernPayload, total: number, cible: number): Omit<SequencePotTurn, 'mises'> {
  return { roll: total, target: cible, ante: p.stakeBrass, pot: p.pot ?? 0 };
}

/** ISSUE de la partie du point de vue du challenger : ce que sa bourse a gagné ou perdu. */
function potIssue(p: TavernPayload): TavernGameResult['winner'] {
  const mien = p.net?.[p.challengerId] ?? 0;
  return mien > 0 ? 'joueur' : mien < 0 ? 'adversaire' : 'egalite';
}

/** MANCHE d'arrêt : « Une partie complète dure généralement autant de manches qu'il y a de joueurs »
 *  (l.17) — le nombre par joueur est DÉCLARÉ par l'entrée. */
function potManches(game: TavernGame, p: TavernPayload): number {
  return (p.seats?.length ?? 0) * (game.pot?.manchesPerPlayer ?? 1);
}

/** Manche IMPOSSIBLE à ouvrir (moins de deux joueurs peuvent miser) : la partie s'arrête sur une
 *  étape d'affichage, et la clôture la dénoue. */
function potFin(p: TavernPayload, log: string[]): SequenceRound<TavernPayload> {
  return {
    title: t('tavern.potTable'),
    icon: 'navigation/des',
    steps: [displayStep({
      id: `${TAVERN_POT_KIND}-fin-${p.manche ?? 1}`,
      kind: TAVERN_POT_KIND,
      label: t('tavern.potPlusDeJoueurs'),
      icon: 'navigation/des',
      worldOwner: true,
    })],
    immediate: true,
    chargeUtile: { ...p, fin: true },
    log,
  };
}

/**
 * OUVERTURE D'UNE MANCHE (NADJ 16 l.17) : le QUORUM (qui peut miser), puis la fenêtre d'entre-deux-
 * manches où le premier joueur ENCORE EN JEU annonce la cible — choix s'il tient un siège, annonce
 * sinon. Rien n'est prélevé ici : la mise et la cible passent à la CLÔTURE de cette manche
 * (`potClose`) : une manche quittée à sa fenêtre ne coûte rien.
 */
function potOuvreManche(get: Get, seq: SequenceState<TavernPayload>, game: TavernGame): SequenceRound<TavernPayload> | undefined {
  const p = seq.chargeUtile;
  const regles = game.pot!;
  const seats = p.seats ?? [];
  const manche = p.manche ?? 1;
  const ante = p.stakeBrass;
  const out = seats.filter((s) => !potSolvable(get, p.net ?? {}, s, ante)).map((s) => s.id);
  const log = seats.filter((s) => out.includes(s.id)).map((s) => t('tavern.potInsolvable', { who: s.label }));
  const enJeu = seats.filter((s) => !out.includes(s.id));
  if (enJeu.length < 2) return potFin({ ...p, out, pot: 0, mises: {} }, [...log, t('tavern.potPlusDeJoueurs')]);
  // Le socle ne journalise le `log` d'une manche que si elle est résolue d'office : une sortie de
  // table doit rester au journal.
  for (const ligne of log) get().ecrireAuJournal(ligne);
  // Le premier joueur d'une manche est celui du rang (chacun ouvre la sienne, l.17) ; s'il n'est pas
  // en jeu, le suivant dans l'ordre du tour ouvre à sa place.
  const depart = (manche - 1) % seats.length;
  const premier = out.includes(seats[depart].id) ? potProchain(seats, depart, out) : depart;
  const joueur = seats[premier];
  const base: TavernPayload = { ...p, out, pot: 0, mises: {}, manche, seat: premier };
  const hero = joueur.hero ? actorIn(get(), joueur.id) : undefined;
  const title = t('tavern.potMancheTitre', { jeu: game.label, n: manche });
  // La CIBLE n'existe que si la séquence en déclare la plage : sans elle, aucun nombre n'est annoncé.
  const plage = regles.targetRange;
  if (plage && hero && !cadenceAuto() && jetSurfaced(get(), hero)) {
    const cibles: number[] = [];
    for (let n = plage.min; n <= plage.max; n++) cibles.push(n);
    const etape = choiceStep({
      id: `${TAVERN_TARGET_KIND}-${seq.manche}`,
      kind: TAVERN_TARGET_KIND,
      label: t('tavern.potCibleChoix', { who: joueur.label }),
      icon: 'navigation/des',
      actorId: hero.id,
      options: cibles.map((n) => ({ key: String(n), label: dataLabel(String(n)) })),
      defaultChoice: String(plage.min),
    });
    if (etape) return { title, icon: 'navigation/des', steps: [etape], chargeUtile: base };
  }
  const etape = displayStep({
    id: `${TAVERN_TARGET_KIND}-${seq.manche}`,
    kind: TAVERN_TARGET_KIND,
    label: t('tavern.potOuverture', { n: manche, mise: formatMoney(fromBrass(ante)), who: joueur.label }),
    icon: 'navigation/des',
    actorId: p.challengerId,
  });
  return { title, icon: 'navigation/des', steps: [etape], chargeUtile: base };
}

/**
 * UN TOUR : « À votre tour, lancez 2d10 et totalisez le résultat affiché sur les deux dés » (l.17).
 * Le joueur tenu par un siège POSE son tirage (étape à table, dés déclarés) ; tout autre joueur voit
 * ses dés roulés côté monde et rapportés par une étape d'affichage, sans fenêtre.
 */
function potTour(get: Get, seq: SequenceState<TavernPayload>, game: TavernGame, rng: RNG): SequenceRound<TavernPayload> | undefined {
  const p = seq.chargeUtile;
  const joueur = p.seats?.[p.seat ?? 0];
  if (!joueur) return undefined;
  const cible = p.target ?? game.pot!.targetRange?.min ?? 0;
  const title = t('tavern.potTour', { who: joueur.label, cible });
  const decl = potDecl(game);
  const hero = joueur.hero ? actorIn(get(), joueur.id) : undefined;
  if (hero && !cadenceAuto() && jetSurfaced(get(), hero)) {
    const etape = tableStep({
      id: `${TAVERN_POT_KIND}-${seq.manche}`,
      kind: TAVERN_POT_KIND,
      label: title,
      icon: 'navigation/des',
      actorId: hero.id,
      table: decl,
      stake: potStake(game, p),
      meta: { gameId: game.id, seat: p.seat ?? 0, cible },
    });
    if (etape) return { title, icon: 'navigation/des', steps: [etape] };
  }
  const tire = rollTableStep(decl, rng, { get });
  const etape = displayStep({
    id: `${TAVERN_POT_KIND}-${seq.manche}`,
    kind: TAVERN_POT_KIND,
    label: title,
    icon: 'navigation/des',
    ...(hero ? { actorId: hero.id } : { worldOwner: true as const }),
    meta: { gameId: game.id, seat: p.seat ?? 0, cible, potRoll: tire.roll },
  });
  return { title, icon: 'navigation/des', steps: [etape], immediate: true };
}

/** FABRIQUE DE MANCHE d'un jeu de MISE : ouverture de manche (mises + nombre cible) tant qu'aucune
 *  cible n'est posée, tour du joueur courant ensuite. */
function potRound(get: Get, seq: SequenceState<TavernPayload>, rng: RNG): SequenceRound<TavernPayload> | undefined {
  const game = findTavernGameById(seq.chargeUtile.gameId);
  if (!game?.pot || !seq.chargeUtile.seats?.length) return undefined;
  return seq.chargeUtile.target == null ? potOuvreManche(get, seq, game) : potTour(get, seq, game, rng);
}

/** La MANCHE en vol : pot, mouvements engagés, mises du pot courant, joueurs sortis, cible, et son
 *  gagnant une fois tranchée. */
interface MancheEnVol {
  pot: number;
  net: Record<string, number>;
  mises: Record<string, number>;
  out: string[];
  cible: number;
  gagnant?: TavernSeat;
}

/** La manche en vol telle que la charge utile la porte. */
function potMancheEnVol(p: TavernPayload, cibleParDefaut: number): MancheEnVol {
  return {
    pot: p.pot ?? 0, net: { ...(p.net ?? {}) }, mises: { ...(p.mises ?? {}) }, out: [...(p.out ?? [])],
    cible: p.target ?? cibleParDefaut,
  };
}

/** La ligne de ce qu'un lancer produit (issue rendue par la famille), pas seulement la plage où il
 *  tombe : sans elle, une cible atteinte se lit comme une manche qui passe. */
function potTotalLigne(params: SequenceParams, p: TavernPayload, joueur: TavernSeat, total: number, cible: number): string {
  const { row, outcome } = resolveSequencePotTurn(params, potTurnOf(p, total, cible));
  const quoi = sequencePotIssue(outcome) ?? garanti(row, total, 'plage du pot').label;
  return t('tavern.potTotal', { who: joueur.label, total, quoi });
}

/** FIN DE MANCHE (`NADJ 16 l.17`) : le gagnant, ou le seul joueur encore en jeu, empoche le pot ; un pot
 *  vide sans gagnant clôt la manche. */
function potFinDeManche(seats: readonly TavernSeat[], m: MancheEnVol, log: string[]): MancheEnVol {
  const enJeu = seats.filter((s) => !m.out.includes(s.id));
  const gagnant = m.gagnant ?? (enJeu.length === 1 ? enJeu[0] : undefined);
  if (gagnant && m.pot > 0) {
    log.push(t('tavern.potRafle', { who: gagnant.label, montant: formatMoney(fromBrass(m.pot)) }));
    return { ...m, gagnant, net: potMouvement(m.net, gagnant, m.pot), pot: 0 };
  }
  if (!gagnant && m.pot <= 0) log.push(t('tavern.potVide'));
  return { ...m, gagnant };
}

/** UN TOUR joué (`NADJ 16 l.17`) : l'effet de pot DÉCLARÉ par la plage du total, puis la fin de manche.
 *  `choix` = le pli committé par un siège ; absent, la remise se paie tant que la bourse suit (politique
 *  des joueurs qu'aucun siège ne tient). */
function potJoueTour(
  get: Get, params: SequenceParams, p: TavernPayload, seats: readonly TavernSeat[], m: MancheEnVol,
  joueur: TavernSeat, total: number, choix: string | undefined, log: string[],
): MancheEnVol {
  let { pot, net, cible } = m;
  const mises = { ...m.mises };
  const out = [...m.out];
  const { outcome } = resolveSequencePotTurn(params, potTurnOf({ ...p, pot }, total, cible));
  const gagnant: TavernSeat | undefined = outcome.wins ? joueur : undefined;
  if (outcome.takes) {
    pot -= outcome.takes;
    mises[joueur.id] = (mises[joueur.id] ?? 0) - outcome.takes;
    net = potMouvement(net, joueur, outcome.takes);
    log.push(t('tavern.potReprend', { who: joueur.label, montant: formatMoney(fromBrass(outcome.takes)) }));
  }
  if (outcome.target != null) {
    cible = outcome.target;
    log.push(t('tavern.potNouvelleCible', { who: joueur.label, cible }));
  }
  if (outcome.out) {
    out.push(joueur.id);
    log.push(t('tavern.potQuitte', { who: joueur.label }));
  }
  if (outcome.choose) {
    // Ce que coûte le maintien dans la manche est PARAMÉTRÉ par la plage (`owes`), jamais supposé.
    const du = outcome.owes ?? p.stakeBrass;
    const remet = potSolvable(get, net, joueur, du) && (choix == null || choix === 'remise');
    if (remet) {
      pot += du;
      mises[joueur.id] = (mises[joueur.id] ?? 0) + du;
      net = potMouvement(net, joueur, -du);
      log.push(t('tavern.potRemise', { who: joueur.label, montant: formatMoney(fromBrass(du)) }));
    } else {
      out.push(joueur.id);
      log.push(t('tavern.potAbandon', { who: joueur.label }));
    }
  }
  return potFinDeManche(seats, { pot, net, mises, out, cible, ...(gagnant ? { gagnant } : {}) }, log);
}

/**
 * RÉDUCTEUR DE CLÔTURE d'un jeu de MISE : lit le tour clos, applique l'effet de
 * pot DÉCLARÉ par sa plage, puis tient la manche — « La manche continue jusqu'à ce que le pot soit
 * vide, ou jusqu'à ce qu'il n'y ait plus qu'un seul joueur en jeu, qui empoche alors toutes les
 * mises restant dans le pot. » (`NADJ 16 l.17`). La partie s'achève au nombre de manches déclaré.
 */
function potClose(ctx: SequenceCloseCtx<TavernPayload>): SequenceVerdict<TavernPayload> {
  const { get, seq, mancheClose, rng } = ctx;
  const p = seq.chargeUtile;
  const game = findTavernGameById(p.gameId);
  const regles = game?.pot;
  const seats = p.seats;
  if (!game || !regles || !seats?.length) return { suite: 'fin', issue: 'egalite' };
  if (p.fin) return { suite: 'fin', issue: potIssue(p) };

  // MISE puis CIBLE (NADJ 16 l.17) : chaque joueur encore en jeu mise, et `mises` compte ce que
  // chacun a mis au pot courant.
  const cibleStep = mancheClose.participants.find((s) => s.kind === TAVERN_TARGET_KIND);
  if (cibleStep) {
    const ante = p.stakeBrass;
    const mises: Record<string, number> = {};
    let net = { ...(p.net ?? {}) };
    let pot = 0;
    for (const s of seats.filter((x) => !(p.out ?? []).includes(x.id))) {
      pot += ante;
      mises[s.id] = ante;
      net = potMouvement(net, s, -ante);
    }
    const cible = cibleStep.chosen != null ? Number(cibleStep.chosen) : potCibleTiree(game, rng);
    const joueur = seats[p.seat ?? 0];
    return {
      suite: 'poursuivre',
      chargeUtile: { ...p, net, pot, mises, target: cible },
      log: [
        t('tavern.potManche', { n: p.manche ?? 1, mise: formatMoney(fromBrass(ante)), pot: formatMoney(fromBrass(pot)) }),
        t('tavern.potCible', { who: garanti(joueur, p.seat ?? 0, 'siège du pot').label, cible }),
      ],
    };
  }

  const tour = mancheClose.participants.find((s) => s.kind === TAVERN_POT_KIND);
  const total = tour ? potTotalOf(tour) : null;
  const joueur = seats[p.seat ?? 0];
  if (total == null || !joueur) return { suite: 'fin', issue: potIssue(p) };

  const log: string[] = [];
  const choix = mancheClose.participants.find((s) => s.kind === TAVERN_FOLD_KIND)?.chosen;
  const { pot, net, mises, out, cible, gagnant } = potJoueTour(get, seq.parametres, p, seats, potMancheEnVol(p, regles.targetRange?.min ?? 0), joueur, total, choix, log);
  const gains = gagnant
    ? { ...(p.gains ?? {}), [gagnant.id]: (p.gains?.[gagnant.id] ?? 0) + 1 }
    : (p.gains ?? {});
  if (!gagnant && pot > 0) {
    const suivant = potProchain(seats, p.seat ?? 0, out);
    return { suite: 'poursuivre', chargeUtile: { ...p, pot, net, mises, out, target: cible, seat: suivant }, log };
  }
  const manche = (p.manche ?? 1) + 1;
  const suite: TavernPayload = { ...p, pot: 0, net, mises: {}, out: [], gains, target: null, manche, seat: 0 };
  if (manche > potManches(game, p)) return { suite: 'fin', issue: potIssue(suite), chargeUtile: suite, log };
  return { suite: 'poursuivre', chargeUtile: suite, log };
}

/** Ce qui termine une partie de MISE : son issue jouée, l'abandon du challenger (entre deux manches,
 *  pot vide), ou l'interruption anti-boucle du socle (`SEQUENCE_BORNE`). */
type FinDePot = 'issue' | 'abandon' | 'interruption';

/** INTERRUPTION : la manche en vol est ANNULÉE — chaque joueur, sorti ou non, reprend ce que `mises`
 *  compte pour lui (signé : une reprise dans le pot s'y déduit), et la somme rendue est le pot. */
function potRendLesMises(get: Get, p: TavernPayload): Record<string, number> {
  let rendu = { ...(p.net ?? {}) };
  for (const seat of p.seats ?? []) rendu = potMouvement(rendu, seat, p.mises?.[seat.id] ?? 0);
  if ((p.pot ?? 0) > 0) get().ecrireAuJournal(t('tavern.potRendu', { montant: formatMoney(fromBrass(p.pot ?? 0)) }));
  return rendu;
}

/**
 * DÉNOUEMENT d'un jeu de MISE : les mouvements de la partie passent aux bourses — un gain crédite,
 * une perte débite, et rien ne bouge pour qui n'a ni gagné ni perdu. Le pot EN VOL n'existe qu'à
 * l'INTERRUPTION (`potRendLesMises`) ; le solde du challenger décide alors de l'issue affichée : une
 * bourse qui a bougé ne se raconte jamais « Égalité ».
 */
function potSettle(
  get: Get, set: Set, game: TavernGame, challenger: Combatant, p: TavernPayload,
  outcome: string, fin: FinDePot,
): void {
  const rendu = fin === 'interruption' ? potRendLesMises(get, p) : { ...(p.net ?? {}) };
  const solde = { ...p, net: rendu };
  const winner: TavernGameResult['winner'] = outcome === 'joueur' || outcome === 'adversaire'
    ? outcome
    : potIssue(solde);
  for (const [heroId, montant] of Object.entries(rendu)) {
    if (montant > 0) creditBourse(get, set, heroId, fromBrass(montant));
    else if (montant < 0) payWithAllocation(get, set, { debits: soloPayer(heroId, fromBrass(-montant)), purpose: 'jeu de taverne' });
  }
  const mien = rendu[p.challengerId] ?? 0;
  const abandon = fin === 'abandon';
  const manches = Math.max(abandon ? 0 : 1, (p.manche ?? 1) - 1);
  const detail = t('tavern.potFinal', { manches, mise: formatMoney(fromBrass(p.stakeBrass)), s: pluriel(manches) });
  finalizeTavernGame(get, set, game, challenger, p.opponentName, winner,
    { joueur: p.gains?.[p.challengerId] ?? 0, adversaire: 0 }, manches, p.stakeBrass,
    { netBrass: mien, verse: false, detail, abandon });
}

/** TABLEAU DE MARQUE d'un jeu de MISE : le POT en jeu, et une ligne par joueur — manches remportées,
 *  bourse engagée pour les héros, et la marque de ceux qui ont quitté la manche. */
function potBoard(game: TavernGame, p: TavernPayload): SequenceBoard {
  const out = p.out ?? [];
  return {
    title: dataLabel(game.label),
    pot: t('tavern.potEnJeu', { montant: formatMoney(fromBrass(p.pot ?? 0)) }),
    camps: (p.seats ?? []).map((s) => {
      const mouvement = p.net?.[s.id];
      return {
        id: s.id,
        label: dataLabel(s.label),
        score: p.gains?.[s.id] ?? 0,
        ...(out.includes(s.id) ? { note: t('tavern.potSorti') } : {}),
        ...(mouvement != null && !out.includes(s.id)
          ? { note: t('tavern.potSolde', { montant: formatMoney(fromBrass(Math.abs(mouvement))), signe: mouvement < 0 ? '−' : '+' }) }
          : {}),
      };
    }),
    manche: p.manche ?? 1,
    manches: potManches(game, p),
  };
}

/**
 * RÉDUCTEUR DE CLÔTURE (socle) — LE SEUL juge d'une manche, quel que soit son montage :
 *  1. DR de manche de chaque camp = DR du jet (plafonné `drCap`) + Bonus de Caractéristique DÉCLARÉ
 *     (Bras de fer l.34 : « à chaque tour, ajoutez votre Bonus de Force au nombre de DR ») ;
 *  2. vainqueur de la manche par `resolveTavernRound`, égalité DÉPARTAGÉE par le paramètre déclaré
 *     (Dominos l.105) ;
 *  3. sans cible de cumul : la partie s'achève sur cette manche (variante rapide, l.11) ;
 *  4. avec cible : CUMUL par le socle (`sequenceCumulsDeLaManche` → `extendedTestStep`, LDB 12 l.174 — le DR
 *     du Round s'ajoute AVEC SON SIGNE, seul le TOTAL est planché à 0) jusqu'à `target`.
 * Ne mute rien : les effets de manche déclarés (famille 4) sont DÉCLENCHÉS par le socle sur les
 * porteurs que le verdict nomme.
 */
function tavernClose(ctx: SequenceCloseCtx<TavernPayload>): SequenceVerdict<TavernPayload> {
  const { seq } = ctx;
  const p = seq.chargeUtile;
  const game = findTavernGameById(p.gameId);
  if (game?.roundShape === 'thrower') return torchonClose(ctx);
  if (game?.roundShape === 'team') return tavernTeamClose(ctx, game);
  if (game?.roundShape === 'pot') return potClose(ctx);
  if (game?.roundShape === 'volley') return volleyClose(ctx);
  // CHOIX d'option d'une manche ORDINAIRE : la décision se pose, le jet suivra (l.25).
  const choix = ctx.mancheClose.participants.filter((s) => s.kind === TAVERN_CHOICE_KIND);
  if (game && choix.length && game.roundShape !== 'team') {
    const retenu = Object.fromEntries(choix.map((s) => [s.actorId ?? '', Number(s.chosen ?? 0)]));
    return { suite: 'poursuivre', chargeUtile: { ...p, choices: { ...(p.choices ?? {}), ...retenu } } };
  }
  if (game?.sides?.length) return sidesClose(ctx, game);
  if (game?.combined) return combinedClose(ctx, game);
  const sides = tavernSides(ctx);
  if (!game || !sides) return { suite: 'fin', issue: 'egalite' };

  const bonusPlayer = sequenceDrBonus(seq.parametres, sides.acteurDuJoueur);
  const bonusOpponent = sequenceDrBonus(seq.parametres, sides.acteurDeLAdversaire, p.opponentValue);
  const { winner, dr } = resolveTavernRound(game, sides.joueur, sides.adversaire, {
    joueur: bonusPlayer, adversaire: bonusOpponent,
  });
  const mien = { roll: sides.joueur.roll, sl: dr.joueur };
  const sien = { roll: sides.adversaire.roll, sl: dr.adversaire };
  const departage = winner === 'egalite' ? resolveSequenceTie(seq.parametres.tieBreak, mien, sien) : 'egalite';
  const recit = winner === 'egalite' ? recitDuDepartage(seq.parametres.tieBreak, mien, sien) : undefined;
  const manche: TavernGameResult['winner'] = winner !== 'egalite'
    ? winner
    : departage === 'a' ? 'joueur' : departage === 'b' ? 'adversaire' : 'egalite';

  // PORTEURS des effets de manche (famille 4) : le vainqueur et le perdant de la manche (l.34, LDB 14
  // l.219), et tous les participants pour l'attrition d'intervalle (l.34). Aucun perdant sur égalité.
  const tous = [p.challengerId, ...(p.opponentId ? [p.opponentId] : [])];
  const gagnantId = manche === 'joueur' ? p.challengerId : manche === 'adversaire' ? p.opponentId : undefined;
  const perdantId = manche === 'joueur' ? p.opponentId : manche === 'adversaire' ? p.challengerId : undefined;
  const porteurs = { ...(gagnantId ? { vainqueurs: [gagnantId] } : {}), ...(perdantId ? { perdants: [perdantId] } : {}), tous };
  const suite = campsSansFiche(ctx, manche);

  if (seq.parametres.target == null) {
    return { suite: 'fin', issue: manche, chargeUtile: { ...suite, last: { dr, ...(recit ? { departage: recit } : {}) } }, porteurs };
  }

  const { cumuls, atteints } = sequenceCumulsDeLaManche(seq, {
    [CAMP_PLAYER]: { success: sides.joueur.success, sl: dr.joueur },
    [CAMP_OPPONENT]: { success: sides.adversaire.success, sl: dr.adversaire },
  });
  if (!atteints.length) return { suite: 'poursuivre', cumuls, chargeUtile: { ...suite, last: { dr } }, porteurs };
  const cp = cumuls[CAMP_PLAYER] ?? 0;
  const co = cumuls[CAMP_OPPONENT] ?? 0;
  const issue: TavernGameResult['winner'] = cp > co ? 'joueur' : co > cp ? 'adversaire' : 'egalite';
  return { suite: 'fin', issue, cumuls, chargeUtile: { ...suite, last: { dr } }, porteurs };
}

/** L'Avantage des CAMPS SANS FICHE (`TavernPayload.advantage` : habitué, figurants), lu des MÊMES
 *  déclarations que le socle applique aux héros (`rounds.winner`, `PERTE_DU_TOUR`, `DECROISSANCE_DU_TOUR`),
 *  sous le même gating. #2333 */
function campsSansFiche(ctx: SequenceCloseCtx<TavernPayload>, manche: TavernGameResult['winner']): TavernPayload {
  const { seq } = ctx;
  const p = seq.chargeUtile;
  if (!seq.parametres.avantage) return p;
  const tour = (camp: CampDeTaverne) => manche === camp ? seq.parametres.rounds?.winner ?? []
    : groupAdvantage() ? [] : manche === 'egalite' ? DECROISSANCE_DU_TOUR : PERTE_DU_TOUR;
  const lire = (camp: CampDeTaverne, fiche: Combatant | undefined): number =>
    avantageDeCampSansFiche(p.advantage?.[camp] ?? 0, tour(camp), fiche ? advantageCapFor(fiche) : advantageCap(), battleRng(), fiche);
  return { ...p, advantage: { [CAMP_PLAYER]: lire(CAMP_PLAYER, undefined), [CAMP_OPPONENT]: lire(CAMP_OPPONENT, tavernActor(ctx.get, p.opponentId)) } };
}

/** Remet à zéro l'Avantage des sièges à fiche au dénouement (fin ou abandon). LDB 14 l.219, NADJ 16 l.34. */
function avantagesRemisAZero(get: Get, set: Set, p: TavernPayload, game: TavernGame): void {
  const ids = [p.challengerId, ...(p.opponentId ? [p.opponentId] : []), ...(game.team ? equipiers(get).map((h) => h.id) : [])];
  for (const id of ids) {
    const c = actorIn(get(), id);
    if (c) c.advantage = 0;
  }
  set(touchActors(get()));
}

/** DÉNOUEMENT (socle) : mise, modale de résultat, journal. */
function tavernSettle(get: Get, set: Set, seq: SequenceState<TavernPayload>, outcome: string): void {
  const p = seq.chargeUtile;
  const { game, challenger } = partieEnCours(get, p, 'dénouement de taverne');
  avantagesRemisAZero(get, set, p, game);
  const abandon = outcome === TAVERN_ABANDON;
  const issue = abandon ? CAMP_OPPONENT : outcome;
  const winner: TavernGameResult['winner'] = issue === 'joueur' || issue === 'adversaire' ? issue : 'egalite';
  // Manches JOUÉES : `seq.manche` est la dernière jouée (`SequenceDef.denouer`) ; un abandon peut n'en
  // compter aucune.
  const plancher = abandon ? 0 : 1;
  const rounds = Math.max(plancher, seq.manche);
  // JEU DE MISE : ce qui se solde, ce sont les BOURSES (l.17) — chaque joueur repart avec ce que ses
  // manches lui ont laissé, jamais avec un écart de DR.
  if (game.roundShape === 'pot') {
    potSettle(get, set, game, challenger, p, issue, abandon ? 'abandon' : outcome === SEQUENCE_BORNE ? 'interruption' : 'issue');
    return;
  }
  // TORCHON (l.111) : ce qui se compte, ce sont les POINTS d'équipe — jamais des DR ni des buts.
  if (game.roundShape === 'thrower') {
    const mien = seq.cumuls[CAMP_PLAYER] ?? 0;
    const sien = seq.cumuls[CAMP_OPPONENT] ?? 0;
    const ligne = t('tavern.torchonFinal', { mien, sien, lancers: rounds, sm: pluriel(mien), sl: pluriel(rounds) });
    finalizeTavernGame(get, set, game, challenger, p.opponentName, winner, { joueur: mien, adversaire: sien }, rounds, 0,
      { netBrass: 0, verse: false, detail: ligne, abandon });
    return;
  }
  // JEU D'ÉQUIPE : ce qui se dit à la fin, ce sont les BUTS (l.119) — la somme de DR n'était que le
  // moyen de les marquer. Le score affiché est donc le compte de buts de chaque camp.
  if (game.roundShape === 'team') {
    const mien = seq.cumuls[CAMP_PLAYER] ?? 0;
    const sien = seq.cumuls[CAMP_OPPONENT] ?? 0;
    const ligne = t('tavern.equipeFinal', { mien, sien, tours: rounds, sm: pluriel(mien), st: pluriel(rounds) });
    finalizeTavernGame(get, set, game, challenger, p.opponentName, winner, { joueur: mien, adversaire: sien }, rounds, 0,
      { netBrass: 0, verse: false, detail: ligne, abandon });
    return;
  }
  // VOLÉE : ce qui se compte, ce sont les points acquis par les lancers (l.42, l.57, l.70, l.97).
  // CAMPS ASYMÉTRIQUES : ce sont les PIÈCES prises à l'autre camp (l.25-28).
  const drJoueur = p.last?.dr.joueur ?? 0;
  const drAdversaire = p.last?.dr.adversaire ?? 0;
  if (game.combined) {
    const mien = seq.cumuls[CAMP_PLAYER] ?? 0;
    const sien = seq.cumuls[CAMP_OPPONENT] ?? 0;
    const tours = Math.max(plancher, (p.combined?.tour ?? 1) - 1);
    const ligne = t('tavern.sideFinal', { mien, sien, tours, unite: uniteDeScore(game, mien), st: pluriel(tours) });
    finalizeTavernGame(get, set, game, challenger, p.opponentName, winner, { joueur: mien, adversaire: sien }, tours, 0,
      { netBrass: 0, verse: false, detail: ligne, abandon });
    return;
  }
  if (game.roundShape === 'volley' || game.sides?.length) {
    // MANCHES ANNONCÉES = celles que le tableau de marque a montrées (« Manche 1/1 »), jamais les
    // tours internes de séquence : un lancer n'est pas une manche, et deux unités de narration pour
    // une seule partie, c'est une de trop.
    const manches = Math.max(plancher, (p.volley?.manche ?? 1) - (game.roundShape === 'volley' ? 1 : 0));
    const tours = game.sides?.length ? Math.max(plancher, rounds - 1) : manches;
    const unite = uniteDeScore(game, drJoueur);
    const ligne = game.sides?.length
      ? t('tavern.sideFinal', { mien: drJoueur, sien: drAdversaire, tours, unite, st: pluriel(tours) })
      : t('tavern.volleyFinal', { mien: drJoueur, sien: drAdversaire, manches, unite, sm: pluriel(manches) });
    finalizeTavernGame(get, set, game, challenger, p.opponentName, winner, { joueur: drJoueur, adversaire: drAdversaire }, tours, 0,
      { netBrass: 0, verse: false, detail: ligne, abandon });
    return;
  }
  const departage = p.last?.departage;
  // TEST ÉTENDU : le total est le cumul de la séquence, celui du tableau de marque (LDB 12 l.174).
  const etendu = seq.parametres.target != null;
  const mien = etendu ? seq.cumuls[CAMP_PLAYER] ?? 0 : drJoueur;
  const sien = etendu ? seq.cumuls[CAMP_OPPONENT] ?? 0 : drAdversaire;
  const detail = departage ? t('tavern.departageDetail', { mien, sien, departage })
    : etendu ? t('tavern.extendedDetail', { mien, sien, rounds, s: pluriel(rounds) })
      : t('tavern.opposedDetail', { mien, sien });
  finalizeTavernGame(get, set, game, challenger, p.opponentName, winner, { joueur: mien, adversaire: sien }, rounds, p.stakeBrass,
    { netBrass: tavernNetBrass(winner, p.stakeBrass), verse: true, detail, abandon });
}

/** TABLEAU DE MARQUE d'une partie EN COURS (affichage) : score par camp, cible, manche, phase. Une
 *  partie à manche UNIQUE sans cible n'a rien à montrer avant son verdict — pas de tableau.
 *  JEU D'ÉQUIPE : le score d'un camp est son compte de BUTS (l.119), et la note porte la SOMME de DR
 *  du dernier tour — c'est elle qui décide le but, elle se lit donc à côté. */
function tavernBoard(get: Get, seq: SequenceState<TavernPayload>): SequenceBoard | undefined {
  const p = seq.chargeUtile;
  const { game, challenger } = partieEnCours(get, p, 'tableau de taverne');
  const ph = sequencePhaseOf(seq.parametres, seq.manche);
  const phase = ph.total > 0 ? { manches: ph.total, phase: stepFraction(ph.phase, ph.count) } : {};
  if (game.roundShape === 'pot') return potBoard(game, p);
  // VOLÉE : le score d'un camp est ce que ses lancers lui ont acquis — la note dit où en est le
  // passage (quel lancer, et ce qu'il reste à prendre quand la règle en tient une réserve).
  if (game.roundShape === 'volley' && game.volley) {
    const v = game.volley;
    const st = p.volley;
    const jauge = v.exact != null ? { target: v.exact } : {};
    const note = st ? t('tavern.volleyNote', { n: st.jet, total: v.throws }) : undefined;
    return {
      title: dataLabel(game.label),
      camps: [
        { id: CAMP_PLAYER, label: dataLabel(challenger.label), score: volleyScore(seq, CAMP_PLAYER), ...jauge, ...(st?.seat === 0 && note ? { note } : {}) },
        { id: CAMP_OPPONENT, label: dataLabel(p.opponentName), score: volleyScore(seq, CAMP_OPPONENT), ...jauge, ...(st?.seat === 1 && note ? { note } : {}) },
      ],
      manche: st?.manche ?? 1,
      ...(v.manches != null ? { manches: v.manches } : {}),
      ...(game.scoreUnit ? { unit: dataLabel(game.scoreUnit) } : {}),
    };
  }
  // TEST COMBINÉ : le score d'un camp est son compte de MARQUES (l.90) — le PLUS BAS l'emporte, la
  // jauge n'a donc pas de cible.
  if (game.combined) {
    return {
      title: dataLabel(game.label),
      camps: [
        { id: CAMP_PLAYER, label: dataLabel(challenger.label), score: seq.cumuls[CAMP_PLAYER] ?? 0, note: t('tavern.cerevisNote') },
        { id: CAMP_OPPONENT, label: dataLabel(p.opponentName), score: seq.cumuls[CAMP_OPPONENT] ?? 0 },
      ],
      manche: p.combined?.tour ?? 1,
      ...(game.combined.tours != null ? { manches: game.combined.tours } : {}),
      ...(game.scoreUnit ? { unit: dataLabel(game.scoreUnit) } : {}),
    };
  }
  // CAMPS ASYMÉTRIQUES : le score d'un camp est ce qu'il a PRIS à l'autre, et sa cible la moitié des
  // pièces d'en face (l.28) — « plus de la moitié », donc le premier entier au-dessus.
  const camps = game.sides?.length ? sidesOf(game, p) : undefined;
  if (camps) {
    return {
      title: dataLabel(game.label),
      camps: [
        { id: CAMP_PLAYER, label: stepPrecision(dataLabel(challenger.label), dataLabel(camps.mien.label)), score: seq.cumuls[CAMP_PLAYER] ?? 0, target: Math.floor(camps.sien.pieces / 2) + 1 },
        { id: CAMP_OPPONENT, label: stepPrecision(dataLabel(p.opponentName), dataLabel(camps.sien.label)), score: seq.cumuls[CAMP_OPPONENT] ?? 0, target: Math.floor(camps.mien.pieces / 2) + 1 },
      ],
      manche: seq.manche,
      ...(game.scoreUnit ? { unit: dataLabel(game.scoreUnit) } : {}),
    };
  }
  // TORCHON : le score d'un camp EST son total de points (l.111) — aucun cumul, aucune cible.
  if (game.roundShape === 'thrower') {
    return {
      title: dataLabel(game.label),
      camps: [
        { id: CAMP_PLAYER, label: t('tavern.campMien'), score: seq.cumuls[CAMP_PLAYER] ?? 0 },
        { id: CAMP_OPPONENT, label: dataLabel(p.opponentName), score: seq.cumuls[CAMP_OPPONENT] ?? 0 },
      ],
      manche: seq.manche,
      ...(p.throwers?.length ? { manches: p.throwers.length } : {}),
    };
  }
  if (game.roundShape === 'team') {
    const somme = (n: number | undefined): PlayerText => t('tavern.sommeTour', { n: n ?? 0 });
    return {
      title: dataLabel(game.label),
      camps: [
        { id: CAMP_PLAYER, label: t('tavern.campMien'), score: seq.cumuls[CAMP_PLAYER] ?? 0, note: somme(p.last?.dr.joueur) },
        { id: CAMP_OPPONENT, label: dataLabel(p.opponentName), score: seq.cumuls[CAMP_OPPONENT] ?? 0, note: somme(p.last?.dr.adversaire) },
      ],
      manche: seq.manche,
      ...phase,
    };
  }
  if (seq.parametres.target == null && ph.total === 0) return undefined;
  return {
    title: dataLabel(game.label),
    camps: [
      { id: CAMP_PLAYER, label: dataLabel(challenger.label), score: seq.cumuls[CAMP_PLAYER] ?? 0, ...(seq.parametres.target != null ? { target: seq.parametres.target } : {}) },
      { id: CAMP_OPPONENT, label: dataLabel(p.opponentName), score: seq.cumuls[CAMP_OPPONENT] ?? 0, ...(seq.parametres.target != null ? { target: seq.parametres.target } : {}) },
    ],
    manche: seq.manche,
    ...phase,
  };
}

/* ── LA VOLÉE : un PASSAGE de lancers en nombre fixe (famille 7 du socle) ────────────────────────
 * `NADJ 16 l.42` (trois coups, les quilles ÉCRÊTÉES à ce qu'il en reste), `l.70` (cinq lancers, la
 * cible CHOISIE avant chacun), `l.97` (trois fléchettes, un total EXACT), `l.57` (trois boules, la
 * meilleure compte). Un tour de séquence = UN lancer d'UN lanceur : c'est la seule granularité qui
 * tienne, parce que la Difficulté du lancer suivant dépend de ce que celui-ci a produit (l.42) et
 * qu'un dépassement coupe le passage en cours de route (l.97).
 *
 * CE QUI VIT ICI : les deux lanceurs, l'ordre, les passages, le tableau de marque. CE QUI VIT AU
 * SOCLE : ce que RAPPORTE un lancer (effets DÉCLARÉS, `resolveSequenceThrow`), ce qu'un gain
 * DEVIENT face à une cible exacte (`sequenceThrowGain`), la ligne que désigne la réserve
 * (`sequenceThrowRow`), et la formule de score d'un camp (famille 3, `sequenceScoreOf`).
 *
 * `NADJ 16 l.57` — l'ÉCARTAGE des boules adverses (« vous pouvez réduire le nombre de DR de cette
 * boule de –1 par DR que vous dépensez ») et la variante en points sur trois manches ne sont pas
 * joués : ils demandent une dépense de DR ciblée sur la boule d'autrui, mécanisme qu'aucune famille
 * ne porte encore -> #2688.
 * `NADJ 16 l.99` -> #1306.
 *
 * DEUX ARBITRAGES MAISON, portés par la DONNÉE et dits ici (jamais prêtés au RAW) :
 *  · `NADJ 16 l.42` ne donne de Difficulté QUE de 15 à 2 quilles restantes (« 12-15 », …, « 2 ») :
 *    aucune ligne ne couvre les 16 quilles DEBOUT, alors que le premier coup s'y joue Très facile
 *    (+60) par la lettre du texte. La ligne haute est donc ÉTENDUE à 16 en donnée — la seule lecture
 *    qui garde le premier coup à son palier RAW. Toute autre valeur reste éditable au Codex.
 *  · `l.42` décrit un jeu SOLO (« vous avez droit à trois coups ») : la source ne dit NULLE PART
 *    comment deux joueurs se départagent. Arbitrage : le plus de quilles abattues l'emporte (somme
 *    des coups, formule de camp par défaut) — c'est la seule grandeur que la règle produise.
 */

/** Kind de l'étape du LANCER d'une volée. */
const TAVERN_THROW_KIND = 'taverneLancer';
/** Kind de l'étape de CHOIX de la ligne visée (`pick: 'choix'`). */
const TAVERN_AIM_KIND = 'taverneLancerVisee';
/** Kind de l'étape de CHOIX du gain, quand l'effet du lancer en offre plusieurs. */
const TAVERN_GAIN_KIND = 'taverneLancerGain';
/** Kind de l'étape de CHOIX du camp mené par le challenger (famille 8). */
const TAVERN_SIDE_KIND = 'taverneCamp';

/** LE PASSAGE EN COURS d'une volée — qui lance, à quel rang, avec quelle réserve et quelle ligne. */
export interface TavernVolleyState {
  /** Rang du lanceur courant dans `throwers`. */
  seat: number;
  /** Rang du lancer dans le passage (1-based). */
  jet: number;
  /** Rang du passage complet (1-based). */
  manche: number;
  /** Réserve restante DU LANCEUR courant (écrêtage) — remise à neuf à chaque passage. */
  reserve?: number;
  /** Ligne VISÉE du lancer en cours (`pick: 'choix'`) ; absente = elle reste à désigner. */
  row?: number;
  /** Gains de chaque lancer du passage, PAR CAMP — la formule de camp les réduit à la clôture. */
  gains: Record<string, number[]>;
}

/** LES DEUX LANCEURS, dans l'ordre du passage : le challenger et son vis-à-vis. L'ordre est celui que
 *  la donnée déclare — TIRÉ AU SORT quand elle le dit (`NADJ 16 l.97` : « jetez une pièce de monnaie
 *  pour déterminer qui joue en premier »). */
function volleyThrowers(get: Get, p: TavernPayload, ordre: SequenceVolleyRules['ordre'], rng: RNG): NonNullable<TavernPayload['throwers']> {
  const mien = { id: p.challengerId, label: nomOuAbsence(actorIn(get(), p.challengerId), 'combattant', p.challengerId), camp: 'joueur' as const };
  const sien = {
    id: idAdverse(p), label: p.opponentName, camp: 'adversaire' as const,
    ...(p.opponentId ? {} : { value: p.opponentValue }),
  };
  return ordre === 'tirage' && rng.int(1, 2) === 2 ? [sien, mien] : [mien, sien];
}

/** La LIGNE d'un lancer : celle que le lanceur a VISÉE, ou celle que DÉSIGNE la réserve restante. */
function volleyRow(v: SequenceVolleyRules, st: TavernVolleyState): { row?: SequenceVolleyRow; rowIndex?: number } {
  if (v.pick === 'choix') {
    const i = st.row ?? 0;
    const row = v.rows?.[i];
    return row ? { row, rowIndex: i } : {};
  }
  return v.pick === 'reserve' ? sequenceThrowRow(v, st.reserve ?? 0) : {};
}

/** SCORE VIVANT d'un camp : ce que ses passages CLOS lui ont acquis (l'ACCUMULATEUR du socle), plus
 *  la formule DÉCLARÉE (famille 3) appliquée aux gains du passage EN COURS. La MÊME grandeur décide le
 *  dépassement de la cible exacte, le tableau de marque et le vainqueur — il n'y a pas deux comptes. */
function volleyScore(seq: SequenceState<TavernPayload>, camp: string): number {
  const p = seq.chargeUtile;
  return (seq.cumuls[camp] ?? 0) + sequenceScoreOf(seq.parametres.score?.[camp], p.volley?.gains?.[camp] ?? []);
}

/** POLITIQUE du gain pour un lanceur qu'aucun siège ne tient (habitué de la salle, cadence auto) : le
 *  plus GRAND gain qui ne dépasse pas la cible exacte, le plus PETIT à défaut. Le RAW laisse le choix
 *  au lanceur ; un jeu sans MJ ne s'en remet à personne, il déclare sa politique. */
function volleyPolitique(v: SequenceVolleyRules, turn: SequenceThrowTurn, choix: readonly number[]): number {
  const ordre = [...choix].sort((a, b) => b - a);
  const cible = v.exact;
  if (cible == null) return ordre[0] ?? 0;
  return ordre.find((n) => turn.points + n <= cible) ?? ordre[ordre.length - 1] ?? 0;
}

/** MÊME POLITIQUE sur une PLAGE libre (`NADJ 16 l.97`) : le plus grand nombre de la plage qui ne
 *  dépasse pas la cible exacte, son minimum à défaut. Sert au lanceur qu'aucun siège ne tient ET de
 *  valeur d'OUVERTURE du compteur pour celui qui saisit — la fenêtre s'ouvre donc sur le coup que le
 *  jeu jouerait, jamais sur une borne arbitraire. */
function volleyPolitiqueLibre(v: SequenceVolleyRules, turn: SequenceThrowTurn, plage: { min: number; max: number }): number {
  const cible = v.exact;
  if (cible == null) return plage.max;
  return Math.min(plage.max, Math.max(plage.min, cible - turn.points));
}

/** CE QUE PRODUIT le lancer clos — lu par l'APPLIER (qui propose le choix de gain) et par la CLÔTURE
 *  (qui l'applique) : une seule vérité, jamais deux calculs jumeaux. */
function volleyTurnOf(get: Get, seq: SequenceState<TavernPayload>, step: CascadeStep | BuiltCascadeStep):
{ camp: string; turn: SequenceThrowTurn; outcome: SequenceThrowOutcome } | undefined {
  const p = seq.chargeUtile;
  const v = seq.parametres.volley;
  const st = p.volley;
  const jet = step.participants?.[0];
  if (!v || !st || !jet || !estJete(jet.result)) return undefined;
  const camp = step.meta?.camp === CAMP_OPPONENT ? CAMP_OPPONENT : CAMP_PLAYER;
  const acteur = actorIn(get(), jet.id);
  const tr: TestResult = {
    roll: jet.result.roll, target: jet.result.target, sl: jet.result.sl,
    success: evaluateTest(jet.result.roll, jet.result.target).success, isDouble: isDoubleRoll(jet.result.roll),
    ...(jet.base != null ? { base: jet.base } : {}),
  };
  const turn: SequenceThrowTurn = {
    roll: tr.roll,
    // Le DR du lancer, plafond de manche et Bonus de Caractéristique compris (l.42 : « ajoutez votre
    // Bonus de Capacité de Tir au nombre de DR obtenus ») — l'effet ne voit que ce total.
    sl: roundSL(tr, seq.parametres.drCap) + sequenceDrBonus(seq.parametres, acteur, p.opponentValue),
    success: tr.success,
    critique: tr.success && tr.isDouble,
    maladresse: !tr.success && tr.isDouble,
    ...(st.reserve != null ? { reserve: st.reserve } : {}),
    points: volleyScore(seq, camp),
    ...volleyRow(v, st),
    rows: v.rows ?? [],
  };
  return { camp, turn, outcome: resolveSequenceThrow(v, turn) };
}

/** FABRIQUE d'un tour de VOLÉE : la ligne à viser tant qu'elle n'est pas désignée, le lancer ensuite. */
function volleyRound(get: Get, seq: SequenceState<TavernPayload>, rng: RNG): SequenceRound<TavernPayload> | undefined {
  const p = seq.chargeUtile;
  const game = findTavernGameById(p.gameId);
  const v = game?.volley;
  if (!game || !v) return undefined;
  const throwers = p.throwers?.length ? p.throwers : volleyThrowers(get, p, v.ordre, rng);
  const st: TavernVolleyState = p.volley
    ?? { seat: 0, jet: 1, manche: 1, gains: {}, ...(v.reserve != null ? { reserve: v.reserve } : {}) };
  const lanceur = throwers[st.seat];
  if (!lanceur) return undefined;
  const base: TavernPayload = { ...p, throwers, volley: st };
  const heros = actorIn(get(), lanceur.id);
  const surface = !!heros && !cadenceAuto() && jetSurfaced(get(), heros);
  const titre = t('tavern.volleyTour', { who: lanceur.label, n: st.jet, total: v.throws });
  const stake = combatStakeRef('taverne-partie', { values: { jeu: game.label, adversaire: p.opponentName, mise: 'aucune' } });

  // 1) LA LIGNE VISÉE : « avant de lancer un anneau, choisissez une cible » (l.70) — la décision
  //    précède le jet, dont elle règle la Difficulté ET les points.
  if (v.pick === 'choix' && st.row == null) {
    const lignes = v.rows ?? [];
    if (!lignes.length) return undefined;
    const id = `${TAVERN_AIM_KIND}-${seq.manche}`;
    if (heros && surface) {
      const etape = choiceStep({
        id, kind: TAVERN_AIM_KIND, icon: 'navigation/des',
        label: t('tavern.volleyViseChoix', { who: lanceur.label }),
        actorId: heros.id,
        // Le `detail` d'une option ne descend qu'en attribut `title` (`OptionChooser`) : muet au
        // doigt comme au lecteur d'écran. Ce qui DÉCIDE du choix — les points et la Difficulté —
        // entre donc dans le LIBELLÉ visible.
        options: lignes.map((r, i) => ({
          key: String(i),
          label: t('tavern.volleyViseOption', {
            cible: r.label, points: r.points ?? 0,
            difficulte: DIFFICULTY_LABELS[difficulteDuSiege(base, r.difficulty ?? difficulteDeBase(game), lanceur.id)],
          }),
        })),
        defaultChoice: '0',
      });
      if (etape) return { title: titre, icon: 'navigation/des', steps: [etape], chargeUtile: base };
    }
    // POLITIQUE des lanceurs qu'aucun siège ne tient : la PREMIÈRE ligne déclarée (patron `optionOf`).
    const etape = displayStep({
      id, kind: TAVERN_AIM_KIND, icon: 'navigation/des',
      label: t('tavern.volleyVise', { who: lanceur.label, cible: lignes[0].label }),
      ...(heros ? { actorId: heros.id } : { worldOwner: true as const }),
      meta: { row: 0 },
    });
    return { title: titre, icon: 'navigation/des', steps: [etape], immediate: true, chargeUtile: base };
  }

  // 2) LE LANCER — monté par les monteurs CANONIQUES : sur la FICHE d'un héros, en valeur de table
  //    pour un habitué de la salle, dont la fiche (`pnjAuProfil`) ne suit pas la séquence : sa valeur en est dérivée à l'ouverture (`opponentValue`).
  const ligne = volleyRow(v, st);
  const difficulty = difficulteDuSiege(base, ligne.row?.difficulty ?? difficulteDeBase(game), lanceur.id);
  const test = tavernTestSpec(game);
  const rowJet: BatchParticipant = heros
    ? {
      id: lanceur.id, label: testSkillLabel(test) ?? game.label, ...(test.skill ? { skill: structuredClone(test.skill) } : {}),
      difficulty, result: null, interactive: true,
      ...rollStep({ actor: heros, test, difficulty }),
    }
    : figurantRow(lanceur.id, lanceur.label, lanceur.value ?? p.opponentValue, { test: { ...enOption(test).test, difficulty } }, 0);
  const rows: BatchParticipant[] = [
    surface ? rowJet : { ...rowJet, interactive: false, result: rowJet.result ?? rollBatchParticipant(rowJet, rng) },
  ];
  const band = bandStep({
    id: `${TAVERN_THROW_KIND}-${seq.manche}`,
    kind: TAVERN_THROW_KIND,
    icon: 'navigation/des',
    label: ligne.row
      ? t('tavern.volleyLancerVise', { jeu: game.label, cible: ligne.row.label })
      : t('tavern.volleyLancer', { jeu: game.label, n: st.jet, total: v.throws }),
    stake,
    meta: { gameId: game.id, opponentName: p.opponentName, stakeBrass: 0, round: seq.manche, camp: lanceur.camp },
  }, rows);
  if (!band) return undefined;
  return { title: titre, icon: 'navigation/des', steps: [band], immediate: !surface, chargeUtile: base };
}

/** ISSUE d'une volée : le camp au plus haut score ; à ÉGALITÉ, le départage DÉCLARÉ tranche (famille
 *  1bis du socle, `resolveSequenceTie`) — jamais une égalité recodée ici. Boules déclare `nul`
 *  (« en cas d'égalité, la partie se solde par un match nul », l.57) ; un jeu de lancers N+1 qui
 *  déclarerait un autre départage serait donc SERVI, pas ignoré. Une volée n'oppose pas deux jets
 *  mais deux SCORES : ce sont eux qui sont soumis au départage. */
function volleyIssue(params: SequenceParams, mien: number, sien: number): TavernGameResult['winner'] {
  if (mien > sien) return 'joueur';
  if (sien > mien) return 'adversaire';
  const departage = resolveSequenceTie(params.tieBreak, { roll: 0, sl: mien }, { roll: 0, sl: sien });
  return departage === 'a' ? 'joueur' : departage === 'b' ? 'adversaire' : 'egalite';
}

/**
 * RÉDUCTEUR DE CLÔTURE d'un tour de VOLÉE : lit le lancer clos, applique l'effet DÉCLARÉ de sa forme,
 * puis fait avancer le passage — lancer suivant, lanceur suivant, manche suivante. La partie s'achève
 * sur la cible EXACTE atteinte (l.97) ou au bout des passages déclarés (l.57, l.70).
 */
function volleyClose(ctx: SequenceCloseCtx<TavernPayload>): SequenceVerdict<TavernPayload> {
  const { get, seq, mancheClose } = ctx;
  const p = seq.chargeUtile;
  const v = seq.parametres.volley;
  const st = p.volley;
  if (!v || !st) return { suite: 'fin', issue: 'egalite' };
  const qui = garanti(p.throwers?.[st.seat], st.seat, 'lanceur de volée').label;

  // 1) LA LIGNE VISÉE se pose ; le lancer suivra (sa Difficulté en dépend).
  const vise = mancheClose.participants.find((s) => s.kind === TAVERN_AIM_KIND);
  if (vise) {
    const i = Number(vise.chosen ?? vise.meta?.row ?? 0);
    const ligne = v.rows?.[i];
    return {
      suite: 'poursuivre',
      chargeUtile: { ...p, volley: { ...st, row: i } },
      log: ligne ? [t('tavern.volleyVise', { who: qui, cible: ligne.label })] : [],
    };
  }

  const band = mancheClose.participants.find((s) => s.kind === TAVERN_THROW_KIND);
  const lu = band ? volleyTurnOf(get, seq, band) : undefined;
  if (!lu) return { suite: 'fin', issue: volleyIssue(seq.parametres, volleyScore(seq, CAMP_PLAYER), volleyScore(seq, CAMP_OPPONENT)) };

  // 2) LE GAIN : celui que le lanceur a tranché quand le RAW le lui laisse — une valeur ÉLUE parmi
  //    celles que le dé offre (`chosen`) ou un nombre SAISI dans la plage libre (`amount`) — celui de
  //    sa politique sinon ; puis ce que ce gain DEVIENT face à la cible exacte (socle, famille 7).
  const decision = mancheClose.participants.find((s) => s.kind === TAVERN_GAIN_KIND);
  const libre = lu.outcome.libre;
  const brut = libre
    ? (decision?.amount != null ? decision.amount : volleyPolitiqueLibre(v, lu.turn, libre))
    : lu.outcome.choix?.length
      ? (decision?.chosen != null ? Number(decision.chosen) : volleyPolitique(v, lu.turn, lu.outcome.choix))
      : (lu.outcome.gain ?? 0);
  const fin = sequenceThrowGain(v, lu.turn, brut);
  const gain = fin.gain ?? 0;
  const log = [t('tavern.volleyGain', { who: qui, gain })];
  if (fin.ends) log.push(t('tavern.volleyDepasse', { who: qui, exact: v.exact ?? 0 }));

  const gains = { ...st.gains, [lu.camp]: [...(st.gains[lu.camp] ?? []), gain] };
  const reserve = st.reserve != null ? Math.max(0, st.reserve - gain) : undefined;
  // FIN DU PASSAGE : ses lancers sont épuisés, le dépassement l'a coupé (l.97 : « votre tour est
  // terminé »), ou il ne reste plus rien à prendre.
  const finPassage = !!fin.ends || st.jet >= v.throws || (reserve != null && reserve <= 0);
  let apres: TavernVolleyState = finPassage
    ? { seat: st.seat + 1, jet: 1, manche: st.manche, gains, ...(v.reserve != null ? { reserve: v.reserve } : {}) }
    : { seat: st.seat, jet: st.jet + 1, manche: st.manche, gains, ...(reserve != null ? { reserve } : {}) };

  let cumuls = { ...seq.cumuls };
  if (apres.seat >= (p.throwers?.length ?? 2)) {
    // MANCHE CLOSE : la formule de camp DÉCLARÉE (famille 3) réduit les gains du passage en score
    // acquis — somme pour qui compte ses points, meilleur lancer pour qui ne garde que sa boule.
    cumuls = {
      ...cumuls,
      [CAMP_PLAYER]: (cumuls[CAMP_PLAYER] ?? 0) + sequenceScoreOf(seq.parametres.score?.[CAMP_PLAYER], apres.gains[CAMP_PLAYER] ?? []),
      [CAMP_OPPONENT]: (cumuls[CAMP_OPPONENT] ?? 0) + sequenceScoreOf(seq.parametres.score?.[CAMP_OPPONENT], apres.gains[CAMP_OPPONENT] ?? []),
    };
    apres = { seat: 0, jet: 1, manche: st.manche + 1, gains: {}, ...(v.reserve != null ? { reserve: v.reserve } : {}) };
  }

  const suite: TavernPayload = { ...p, volley: apres };
  const etat = { ...seq, cumuls, chargeUtile: suite } as SequenceState<TavernPayload>;
  const mien = volleyScore(etat, CAMP_PLAYER);
  const sien = volleyScore(etat, CAMP_OPPONENT);
  const chargeUtile: TavernPayload = { ...suite, last: { dr: { joueur: mien, adversaire: sien } } };
  // CIBLE EXACTE (l.97) : le camp qui la touche conclut — un seul lancer tombe à la fois.
  if (v.exact != null && (mien === v.exact || sien === v.exact)) {
    return { suite: 'fin', issue: mien === v.exact ? 'joueur' : 'adversaire', cumuls, chargeUtile, log };
  }
  if (v.manches != null && apres.manche > v.manches) {
    return { suite: 'fin', issue: volleyIssue(seq.parametres, mien, sien), cumuls, chargeUtile, log };
  }
  return { suite: 'poursuivre', cumuls, chargeUtile, log };
}

/* ── LES CAMPS ASYMÉTRIQUES (Alvatafl, `NADJ 16 l.25-28`) ───────────────────────────────────────
 * « Le total obtenu par le joueur elfe indique combien de pièces naines sont prises ce tour. Le total
 * obtenu par le joueur nain est divisé par quatre (arrondi au supérieur) pour indiquer combien de
 * pièces elfes sont prises ce tour. […] Sinon, le premier camp à prendre plus de la moitié des pièces
 * de son adversaire l'emporte. Si les deux équipes atteignent la condition gagnante dans le même
 * tour, la partie se solde par un match nul. »
 *
 * LE CAMP MENÉ n'est dit par aucune ligne de la source : il est CHOISI par le challenger (credo « pas
 * de MJ » — jamais un défaut silencieux), et TIRÉ AU SORT quand aucun siège ne le tient.
 * LE MOMENT de la condition de Critique (« le nombre de pièces elfes que vous avez prises ») se lit
 * sur les prises du camp CE TOUR COMPRIS : c'est le tour du Critique qui les compte.
 */

/** OUVERTURE d'une partie à camps asymétriques : le challenger annonce le camp qu'il mène. */
function sideRound(get: Get, seq: SequenceState<TavernPayload>, game: TavernGame, rng: RNG): SequenceRound<TavernPayload> | undefined {
  const sides = game.sides ?? [];
  const challenger = actorIn(get(), seq.chargeUtile.challengerId);
  if (!challenger || !sides.length) return undefined;
  const id = `${TAVERN_SIDE_KIND}-${seq.manche}`;
  const titre = t('tavern.sideTitre', { jeu: game.label });
  if (!cadenceAuto() && jetSurfaced(get(), challenger)) {
    const etape = choiceStep({
      id, kind: TAVERN_SIDE_KIND, icon: 'navigation/des',
      label: t('tavern.sideChoix', { who: nomDe(challenger) }),
      actorId: challenger.id,
      options: sides.map((s) => ({ key: s.id, label: dataLabel(s.label), detail: t('tavern.sidePieces', { pieces: s.pieces }) })),
      defaultChoice: sides[0].id,
    });
    if (etape) return { title: titre, icon: 'navigation/des', steps: [etape] };
  }
  const tire = sides[rng.int(1, sides.length) - 1];
  const etape = displayStep({
    id, kind: TAVERN_SIDE_KIND, icon: 'navigation/des',
    label: t('tavern.side', { who: nomDe(challenger), camp: tire.label }),
    actorId: challenger.id,
    meta: { side: tire.id },
  });
  return { title: titre, icon: 'navigation/des', steps: [etape], immediate: true };
}

/** Le camp MENÉ par le challenger, et celui d'en face. */
function sidesOf(game: TavernGame, p: TavernPayload): { mien: SequenceSide; sien: SequenceSide } | undefined {
  const sides = game.sides ?? [];
  if (sides.length < 2) return undefined;
  const mien = sides.find((s) => s.id === p.side) ?? sides[0];
  const sien = sides.find((s) => s.id !== mien.id)!;
  return { mien, sien };
}

/** RÉDUCTEUR DE CLÔTURE d'une manche à camps asymétriques (`NADJ 16 l.25-28`). */
function sidesClose(ctx: SequenceCloseCtx<TavernPayload>, game: TavernGame): SequenceVerdict<TavernPayload> {
  const { seq, mancheClose } = ctx;
  const p = seq.chargeUtile;
  const camps = sidesOf(game, p);
  if (!camps) return { suite: 'fin', issue: 'egalite' };
  const choix = mancheClose.participants.find((s) => s.kind === TAVERN_SIDE_KIND);
  if (choix) {
    const id = String(choix.chosen ?? choix.meta?.side ?? camps.mien.id);
    const elu = (game.sides ?? []).find((s) => s.id === id) ?? camps.mien;
    return {
      suite: 'poursuivre',
      chargeUtile: { ...p, side: elu.id },
      log: [t('tavern.side', { who: nomDe(garanti(actorIn(ctx.get(), p.challengerId), p.challengerId, 'choix de camp')), camp: elu.label })],
    };
  }
  const jets = tavernSides(ctx);
  if (!jets) return { suite: 'fin', issue: 'egalite' };
  const { mien, sien } = camps;
  const total = (tr: TestResult, acteur: Combatant | undefined, nue?: number): number =>
    roundSL(tr, seq.parametres.drCap) + sequenceDrBonus(seq.parametres, acteur, nue);
  const prise = (t2: number, side: SequenceSide): number => Math.max(0, Math.ceil(t2 / Math.max(1, side.div)));
  const cumuls = {
    [CAMP_PLAYER]: (seq.cumuls[CAMP_PLAYER] ?? 0) + prise(total(jets.joueur, jets.acteurDuJoueur), mien),
    [CAMP_OPPONENT]: (seq.cumuls[CAMP_OPPONENT] ?? 0) + prise(total(jets.adversaire, jets.acteurDeLAdversaire, p.opponentValue), sien),
  };
  // VICTOIRE AU CRITIQUE, sous la condition DÉCLARÉE du camp : le dé des unités, multiplié par ce que
  // le camp porte, ne dépasse pas ce qu'il a pris.
  const auCritique = (tr: TestResult, side: SequenceSide, pris: number): boolean =>
    tr.success && isDoubleRoll(tr.roll) && (tr.roll % 10) * Math.max(1, side.mult) <= pris;
  const critMien = auCritique(jets.joueur, mien, cumuls[CAMP_PLAYER]);
  const critSien = auCritique(jets.adversaire, sien, cumuls[CAMP_OPPONENT]);
  // « plus de la moitié des pièces de son adversaire » : STRICTEMENT plus.
  const gagneMien = critMien || cumuls[CAMP_PLAYER] > sien.pieces / 2;
  const gagneSien = critSien || cumuls[CAMP_OPPONENT] > mien.pieces / 2;
  const chargeUtile: TavernPayload = { ...p, last: { dr: { joueur: cumuls[CAMP_PLAYER], adversaire: cumuls[CAMP_OPPONENT] } } };
  const log = [t('tavern.sidePrises', {
    mien: mien.label, prisesMien: cumuls[CAMP_PLAYER], sien: sien.label, prisesSien: cumuls[CAMP_OPPONENT],
    unite: uniteDeScore(game, cumuls[CAMP_PLAYER]),
  })];
  if (critMien || critSien) log.push(t('tavern.sideCritique', { camp: critMien ? mien.label : sien.label }));
  if (!gagneMien && !gagneSien) return { suite: 'poursuivre', cumuls, chargeUtile, log };
  return {
    suite: 'fin',
    issue: gagneMien && gagneSien ? 'egalite' : gagneMien ? 'joueur' : 'adversaire',
    cumuls: cumuls, chargeUtile, log,
  };
}

/* ── LE TEST COMBINÉ À CONSÉQUENCES DISTINCTES (Cerevis, `NADJ 16 l.90`) ────────────────────────
 * « à chaque tour de Cerevis, chaque joueur effectue un Test combiné d'**Initiative** et de **Pari
 * Accessible (+20)**. Le joueur qui a obtenu le moins de DR à son Test de **Pari** perd le tour, et
 * doit marquer une chouette. En cas d'échec du Test d'Initiative, le joueur utilise accidentellement
 * le nom correct d'une des cartes et doit prendre une grosse gorgée. Pour chaque 3 Tests d'Initiative
 * auxquels vous échouez et pour chaque 2 chouettes que vous effacez, faites un Test de **Résistance à
 * l'alcool Intermédiaire (+0)**. »
 *
 * UN SEUL DÉ, DEUX LECTURES (`LDB 12 l.202-208`) : le jet du tour est celui de la première lecture
 * (le Test que la manche joue déjà) ; la seconde est ÉVALUÉE sur LE MÊME dé par la primitive du
 * moteur (`evaluateCombinedTest`) — aucun second tirage n'existe.
 *
 * CE QUE LA FENÊTRE MONTRE : SES DEUX cibles. La rangée porte sa seconde lecture (`second`,
 * `noyau/pendings.ts`) — annoncée AVANT le dé, tranchée après par le socle (`cascade.secondReadOf`,
 * même `evaluateCombinedTest` que la clôture) et rendue sous la ligne du jet. C'est une zone du
 * contrat d'affichage, pas un montage de taverne : tout jet à deux lectures en hérite.
 *
 * EFFACER UNE CHOUETTE est un GESTE DU JOUEUR : « chaque chouette est effacé lorsque le joueur boit
 * une demi-chope de bière » (l.88) — la source dit le prix, pas le moment. Le moment revient donc au
 * joueur (règle 7), par une fenêtre de choix en ouverture de tour.
 *
 * FIN DE PARTIE — ARBITRAGE MAISON (le RAW est MUET, l.90 s'achève sur le Tableau Ivre) : la partie
 * dure le nombre de tours DÉCLARÉ EN DONNÉE (`combined.tours`, éditable au Codex), et le vainqueur est
 * celui qui a le MOINS de chouettes. Elle s'arrête AVANT terme si un joueur tombe Inconscient — c'est
 * la seule issue que le texte lui-même nomme (l.88 : « peuvent envoyer même les buveurs les plus
 * chevronnés rouler sous la table »). Rien de tout cela n'est prêté au RAW.
 */

/** Kind de l'étape de CHOIX « effacer une marque » (l.88). */
const TAVERN_ERASE_KIND = 'taverneEffacement';

/** LE COMPTE d'un camp dans un jeu à Test combiné : ses échecs de seconde lecture et ses effacements.
 *  Les MARQUES, elles, sont l'ACCUMULATEUR PAR CAMP du socle (`SequenceState.cumuls`). */
export interface TavernCombinedState {
  echecs: Record<CampDeTaverne, number>;
  effacements: Record<CampDeTaverne, number>;
  tour: number;
  /** La question de l'effacement est POSÉE pour ce tour (elle ne se repose pas au même tour). */
  efface?: boolean;
}

/** Compte NEUF (aucun camp n'a rien marqué). */
function combinedInit(): TavernCombinedState {
  return { echecs: { joueur: 0, adversaire: 0 }, effacements: { joueur: 0, adversaire: 0 }, tour: 1 };
}

/** Le porteur d'un camp : le challenger, ou son vis-à-vis quand c'est un compagnon. */
function combinedActor(get: Get, p: TavernPayload, camp: string): Combatant | undefined {
  return tavernActor(get, camp === CAMP_PLAYER ? p.challengerId : p.opponentId);
}

/** ÉCHÉANCE d'un compteur : l'intervalle DÉCLARÉ est-il atteint à ce compte ? (l.90 : « pour chaque 3
 *  Tests […] auxquels vous échouez »). Intervalle absent ou nul : chaque unité échoit. */
function combinedEcheance(compte: number, intervalle: number | undefined): boolean {
  const pas = Math.max(1, intervalle ?? 1);
  return compte > 0 && compte % pas === 0;
}

/** FABRIQUE du tour d'EFFACEMENT : le porteur qui a des marques décide s'il en efface une (et boit).
 *  Aucun siège pour le tenir : il n'efface pas (le RAW ne l'y oblige jamais). */
function combinedEraseRound(get: Get, seq: SequenceState<TavernPayload>, game: TavernGame): SequenceRound<TavernPayload> | undefined {
  const p = seq.chargeUtile;
  const etat = p.combined ?? combinedInit();
  const heros = combinedActor(get, p, CAMP_PLAYER);
  const marques = seq.cumuls[CAMP_PLAYER] ?? 0;
  if (!heros || marques <= 0 || cadenceAuto() || !jetSurfaced(get(), heros)) return undefined;
  const etape = choiceStep({
    id: `${TAVERN_ERASE_KIND}-${seq.manche}`,
    kind: TAVERN_ERASE_KIND,
    icon: 'navigation/des',
    label: t('tavern.cerevisEffaceChoix', { who: nomDe(heros), marques, s: pluriel(marques) }),
    actorId: heros.id,
    options: [
      { key: 'efface', label: t('tavern.cerevisEfface') },
      { key: 'garde', label: t('tavern.cerevisGarde') },
    ],
    defaultChoice: 'garde',
  });
  return etape ? { title: t('tavern.cerevisTour', { jeu: game.label, n: etat.tour }), icon: 'navigation/des', steps: [etape] } : undefined;
}

/** La SECONDE cible d'un camp : la valeur DÉCLARÉE (`combined.second`) montée par l'accesseur canon
 *  pour un porteur, ou la valeur de table pour un adversaire abstrait. */
function combinedSecondTarget(regles: SequenceCombinedRules, acteur: Combatant | undefined, difficulty: Difficulty, nue: number): number {
  const test = testDeSequence(regles.second);
  return acteur
    ? effectiveTarget(acteur, test, difficulty)
    : effectiveTarget(undefined, test, difficulty, nue);
}

/**
 * RÉDUCTEUR DE CLÔTURE d'un tour à Test COMBINÉ (`NADJ 16 l.90`) : la première lecture désigne le
 * perdant du tour (une marque), la seconde — LE MÊME DÉ, `evaluateCombinedTest` — compte les échecs et
 * paie ce que la donnée déclare à chaque échéance.
 */
function combinedClose(ctx: SequenceCloseCtx<TavernPayload>, game: TavernGame): SequenceVerdict<TavernPayload> {
  const { get, seq, mancheClose } = ctx;
  const p = seq.chargeUtile;
  const regles = seq.parametres.combined;
  if (!regles) return { suite: 'fin', issue: 'egalite' };
  const etat = p.combined ?? combinedInit();
  const log: string[] = [];

  // 1) L'EFFACEMENT tranché : la marque part, la demi-chope se boit, et l'échéance se paie.
  const efface = mancheClose.participants.find((s) => s.kind === TAVERN_ERASE_KIND);
  if (efface) {
    if (efface.chosen !== 'efface') return { suite: 'poursuivre', chargeUtile: { ...p, combined: { ...etat, efface: true } } };
    // La demi-chope se boit, la marque part, et l'échéance déclarée se paie — le journal DIT tout
    // cela (un mouvement d'ivresse muet serait invérifiable pour le joueur).
    const marques = { ...seq.cumuls, [CAMP_PLAYER]: Math.max(0, (seq.cumuls[CAMP_PLAYER] ?? 0) - 1) };
    const effacements = { ...etat.effacements, [CAMP_PLAYER]: etat.effacements[CAMP_PLAYER] + 1 };
    const heros = combinedActor(get, p, CAMP_PLAYER);
    log.push(t('tavern.cerevisEffacee', { who: nomDe(garanti(heros, p.challengerId, 'cérévis')) }));
    if (heros && combinedEcheance(effacements[CAMP_PLAYER], regles.effacementsParEcheance) && regles.ops?.length) {
      log.push(...applyOps(heros, [...regles.ops], { idNeuf: get().forgerUnId, rng: battleRng(), source: { kind: 'jeuDeTaverne', id: game.id } }));
    }
    return { suite: 'poursuivre', cumuls: marques, chargeUtile: { ...p, combined: { ...etat, effacements, efface: true } }, log };
  }

  const sides = tavernSides(ctx);
  if (!sides) return { suite: 'fin', issue: 'egalite' };
  // LES MARQUES sont l'ACCUMULATEUR du socle (`seq.cumuls`) ; le compte des échecs reste à la charge utile.
  const marques = { ...seq.cumuls };
  const echecs = { ...etat.echecs };

  // 2) LA PREMIÈRE LECTURE : le plus BAS DR prend la marque (l.90). À égalité, personne ne perd le
  //    tour — la source ne désigne QUE « le joueur qui a obtenu le moins de DR ».
  const drMien = sides.joueur.sl;
  const drSien = sides.adversaire.sl;
  const perdant = regles.markLoser
    ? (drMien < drSien ? CAMP_PLAYER : drSien < drMien ? CAMP_OPPONENT : undefined)
    : undefined;
  if (perdant) {
    marques[perdant] = (marques[perdant] ?? 0) + 1;
    const qui = perdant === CAMP_PLAYER ? nomDe(garanti(sides.acteurDuJoueur, p.challengerId, 'cérévis')) : p.opponentName;
    log.push(t('tavern.cerevisChouette', { who: qui, dr: perdant === CAMP_PLAYER ? drMien : drSien }));
  }

  // 3) LA SECONDE LECTURE, sur LE MÊME dé (`LDB 12 l.202-208`) : chaque échec compte, et l'échéance
  //    déclarée paie ce que la donnée dit.
  for (const camp of [CAMP_PLAYER, CAMP_OPPONENT] as const) {
    const jet = camp === CAMP_PLAYER ? sides.joueur : sides.adversaire;
    const acteur = camp === CAMP_PLAYER ? sides.acteurDuJoueur : sides.acteurDeLAdversaire;
    const difficulty = difficulteDuSiege(p, difficulteDeBase(game, p.choices?.[p.challengerId]), camp === CAMP_PLAYER ? p.challengerId : idAdverse(p));
    const cible2 = combinedSecondTarget(regles, acteur, difficulty, p.opponentValue);
    const combine = evaluateCombinedTest(jet.roll, jet.target, cible2);
    if (combine.b.success) continue;
    echecs[camp] += 1;
    const qui = camp === CAMP_PLAYER ? nomDe(garanti(sides.acteurDuJoueur, p.challengerId, 'cérévis')) : p.opponentName;
    log.push(t('tavern.cerevisGorgee', { who: qui }));
    const porteur = combinedActor(get, p, camp);
    if (porteur && combinedEcheance(echecs[camp], regles.echecsParEcheance) && regles.ops?.length) {
      log.push(t('tavern.cerevisAlcool', { who: qui }));
      // ANCRAGE DE RÈGLE : ce que la partie fait boire se relie à la FICHE DU JEU, qui porte sa règle
      // verbatim — une pastille d'ivresse sans fiche ne dirait pas d'où elle vient.
      log.push(...applyOps(porteur, [...regles.ops], { idNeuf: get().forgerUnId, rng: battleRng(), source: { kind: 'jeuDeTaverne', id: game.id } }));
    }
  }

  const suite: TavernCombinedState = { echecs, effacements: etat.effacements, tour: etat.tour + 1 };
  const mien = marques[CAMP_PLAYER] ?? 0;
  const sien = marques[CAMP_OPPONENT] ?? 0;
  const chargeUtile: TavernPayload = {
    ...sansChoix(p), combined: suite,
    last: { dr: { joueur: mien, adversaire: sien } },
  };
  // FIN : sous la table (l.88), ou au bout des tours DÉCLARÉS (arbitrage maison éditable).
  const arret = regles.stopCondition;
  const sousLaTable = !!arret && [CAMP_PLAYER, CAMP_OPPONENT].some((c) => {
    const porteur = combinedActor(get, p, c);
    return !!porteur && hasCondition(porteur, arret);
  });
  if (!sousLaTable && etat.tour < (regles.tours ?? 0)) return { suite: 'poursuivre', cumuls: marques, chargeUtile, log };
  if (sousLaTable) log.push(t('tavern.cerevisSousLaTable'));
  // Le MOINS de chouettes l'emporte (arbitrage maison : le RAW ne nomme aucun vainqueur).
  return { suite: 'fin', issue: mien < sien ? 'joueur' : sien < mien ? 'adversaire' : 'egalite', cumuls: marques, chargeUtile, log };
}

/** L'unité de score d'un jeu accordée à un compte (`scoreUnit`/`scoreUnitSingular`) ; des DR sans unité
 *  déclarée (l.11). */
function uniteDeScore(game: TavernGame, n: number): string {
  if (!game.scoreUnit) return 'DR';
  return pluriel(n) ? game.scoreUnit : (game.scoreUnitSingular ?? game.scoreUnit);
}

/** MOUVEMENT de bourse d'une partie à mise SIMPLE (une mise contre la maison) : gagné, la mise est
 *  gagnée ; perdu, elle est perdue ; égalité, rien ne bouge. */
function tavernNetBrass(winner: TavernGameResult['winner'], stakeBrass: number): number {
  if (stakeBrass <= 0) return 0;
  return winner === 'joueur' ? stakeBrass : winner === 'adversaire' ? -stakeBrass : 0;
}

/**
 * Dénoue la partie : pose le résultat affiché par la modale, journalise, et verse le mouvement de
 * bourse du challenger quand c'est ICI qu'il se joue (`verse`). Un jeu de POT a déjà versé les siens
 * — un par joueur, sur toute la partie : ce mouvement-là n'est pas dérivable d'un vainqueur.
 */
function finalizeTavernGame(
  get: Get, set: Set, game: TavernGame, challenger: Combatant, opponentName: PlayerText,
  winner: TavernGameResult['winner'], dr: Record<CampDeTaverne, number>, rounds: number, stakeBrass: number,
  fin: { netBrass: number; verse: boolean; detail: string; abandon: boolean },
): void {
  const netBrass = fin.netBrass;
  // Gain → crédit du challenger ; perte → débit de SA bourse (soloPayer, plafonné à la mise déjà bornée à sa bourse).
  if (fin.verse && netBrass > 0) creditBourse(get, set, challenger.id, fromBrass(netBrass));
  else if (fin.verse && netBrass < 0) payWithAllocation(get, set, { debits: soloPayer(challenger.id, fromBrass(-netBrass)), purpose: 'jeu de taverne' });
  // LE texte de la partie, lu par la modale (`detail`) ET par le journal : l'abandon y est dit une fois.
  const texte = !fin.abandon ? fin.detail
    : rounds > 0 ? t('tavern.abandonDetail', { who: nomDe(challenger), detail: fin.detail }) : t('tavern.abandonSeul', { who: nomDe(challenger) });
  const result: TavernGamesResult = {
    winner, dr, rounds,
    gameLabel: game.label,
    challengerName: nomDe(challenger),
    opponentName,
    stakeBrass,
    netBrass,
    detail: texte,
  };
  set({ tavernGames: { result } });
  const enjeu = netBrass > 0 ? t('tavern.enjeuGain', { montant: formatMoney(fromBrass(netBrass)) }) : netBrass < 0 ? t('tavern.enjeuPerte', { montant: formatMoney(fromBrass(-netBrass)) }) : '';
  const issue = t(winner === 'joueur' ? 'tavern.issueWon' : winner === 'adversaire' ? 'tavern.issueLost' : 'tavern.issueTie');
  get().ecrireAuJournal(t('tavern.finDePartie', { jeu: game.label, who: nomDe(challenger), adversaire: opponentName, issue, texte, enjeu }));
}

export function creerActionsDeTaverne(get: Get, set: Set) {
  return {
    ouvrirLesJeux: (entityId?: string) => ouvrirLesJeux(get, set, entityId),
    jouerALaTaverne: (heroId, partie) => jouerALaTaverne(get, set, heroId, partie),
  } satisfies FabriqueDuNoyau;
}

export function sortiesDeLaTaverne(_get: Get, set: Set) {
  return { jeuxDeTaverne: () => set({ tavernGames: null }) } satisfies Partial<SortiesDeFenetre>;
}

/** Les genres d'étape que ce module déclare (table `appliers`). */
export const GENRES_D_ETAPE = [
  TAVERN_ROUND_KIND, TAVERN_CHOICE_KIND, TAVERN_DRINK_KIND, TAVERN_POT_KIND, TAVERN_TARGET_KIND,
  TAVERN_FOLD_KIND, TAVERN_THROW_KIND, TAVERN_AIM_KIND, TAVERN_GAIN_KIND, TAVERN_SIDE_KIND,
  TAVERN_ERASE_KIND,
] as const;

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  appliers: {
    /** Applier de la manche : MUET côté conséquence (l'issue est GLOBALE — elle se décide à la clôture,
     *  dans le réducteur du socle) ; ne pousse que la ligne de récit de ce qui est tombé. */
    [TAVERN_ROUND_KIND]: (get, set, step) => {
      const dr = (n: number) => `${n >= 0 ? '+' : ''}${n} DR`;
      if (step.participants) {
        const lines = step.participants.map((row) => {
          // Le porteur se résout par l'accesseur de la TABLE (`tavernActor`), pas par celui du combat :
          // un adversaire à FICHE est une entité de SCÈNE, qu'`actorIn` ne trouve pas — sa rangée
          // retombait alors sur `row.label`, qui est le libellé de son TEST. Le journal disait « Force :
          // −4 DR. » là où l'écran disait « Négociant : 0/10 » : deux surfaces, deux noms, un joueur qui
          // attribue le score au mauvais camp.
          const acteur = tavernActor(get, row.id);
          const who = acteur ? nomDe(acteur) : row.label ?? row.id;
          return `${who} : ${dr(row.result?.sl ?? 0)}.`;
        });
        lines.push(...torchonRate(get, set, step.participants));
        return { consequences: freeCons(lines) };
      }
      if (!step.result) return {};
      // MANCHE MONO à jet adverse FIGÉ : le journal nomme les DEUX camps, comme la BANDE ci-dessus et
      // comme la rangée de la fenêtre — même dérivation du côté adverse (`opposedAttackerLabel`, source
      // unique). Sans elle, la manche se racontait par un libellé nu (« Force : +4 DR. ») où ni le
      // joueur, ni son vis-à-vis, ni ce que chacun a obtenu n'étaient lisibles.
      const opp = step.meta?.opposed;
      const acteur = step.actorId ? actorIn(get(), step.actorId) : undefined;
      const mien = acteur && nomDe(acteur);
      const lignes = [`${mien ? `${mien} — ` : ''}${step.rollLabel ?? 'Jeu'} : ${dr(step.result.sl)}.`];
      if (opp?.aT) {
        const sien = opposedAttackerLabel(opp);
        lignes.push(`${opp.attackerName}${sien ? ` — ${sien}` : ''} : ${dr(opp.aT.sl)}.`);
      }
      return { consequences: freeCons(lignes) };
    },
    /** APPLIER du CHOIX d'option : le dernier choix committé APPEND la bande du tour à la MÊME fenêtre —
     *  les rangées ne peuvent être montées qu'une fois toutes les options connues (la Difficulté et la
     *  Compétence de chaque rangée en dépendent). « Déclaration AVANT jets » : personne ne lance avant que
     *  chacun n'ait dit ce qu'il tente. */
    [TAVERN_CHOICE_KIND]: (get, set, step) => {
      const seq = activeSequence<TavernPayload>(get);
      const encours = get().pendingCascade;
      if (!seq || !encours) return {};
      const choix = encours.participants.filter((s) => s.kind === TAVERN_CHOICE_KIND);
      const reste = choix.some((s) => s.chosen == null && s.id !== step.id);
      const retenu = Object.fromEntries(choix.map((s) => [s.actorId ?? '', Number(s.chosen ?? 0)]));
      const apres: TavernPayload = { ...seq.chargeUtile, choices: { ...retenu, ...(step.actorId ? { [step.actorId]: Number(step.chosen ?? 0) } : {}) } };
      setSequenceChargeUtile(get, set, apres);
      const option = step.options?.find((o) => o.key === step.chosen);
      if (reste) return option ? { consequences: freeCons([option.label]) } : {};
      const monte = equipeBande(get, { ...seq, chargeUtile: apres });
      if (monte) {
        setSequenceChargeUtile(get, set, { ...apres, teams: monte.teams });
        pushStep(set, monte.band, SEQUENCE_PURPOSE);
      }
      return option ? { consequences: freeCons([option.label]) } : {};
    },
    [TAVERN_DRINK_KIND]: (get, set, step) => {
      if (!step.result || !step.actorId) return {};
      const { camp, who } = lirePinte(step.meta);
      return { consequences: freeCons(torchonBoit(get, set, step.actorId, camp, who, step.result.success)) };
    },
    /** APPLIER du lancer : la ligne de récit de ce qui est tombé, et — pour un joueur tenu par un siège
     *  dont la plage OFFRE le choix — l'étape « remettre ou abandonner » appendée à la MÊME fenêtre
     *  (patron du choix d'option d'équipe). La décision, elle, est appliquée par la clôture. */
    [TAVERN_POT_KIND]: (get, set, step) => {
      const seq = activeSequence<TavernPayload>(get);
      const p = seq?.chargeUtile;
      const game = p ? findTavernGameById(p.gameId) : undefined;
      if (!seq || !p || !game?.pot) return {};
      const total = potTotalOf(step);
      if (total == null) return {};
      const joueur = p.seats?.[Number(step.meta?.seat ?? p.seat ?? 0)];
      const cible = Number(step.meta?.cible ?? p.target ?? 0);
      const { outcome } = resolveSequencePotTurn(seq.parametres, potTurnOf(p, total, cible));
      const du = outcome.owes ?? p.stakeBrass;
      if (outcome.choose && joueur) {
        const hero = joueur.hero ? actorIn(get(), joueur.id) : undefined;
        if (hero && !cadenceAuto() && jetSurfaced(get(), hero) && potSolvable(get, p.net ?? {}, joueur, du)) {
          const etape = choiceStep({
            id: `${TAVERN_FOLD_KIND}-${seq.manche}`,
            kind: TAVERN_FOLD_KIND,
            label: t('tavern.potChoix', { who: joueur.label }),
            icon: 'navigation/des',
            actorId: hero.id,
            options: [
              { key: 'remise', label: t('tavern.potChoixRemise', { montant: formatMoney(fromBrass(du)) }) },
              { key: 'abandon', label: t('tavern.potChoixAbandon') },
            ],
            defaultChoice: 'remise',
          });
          if (etape) pushStep(set, etape, SEQUENCE_PURPOSE);
        }
      }
      // La fenêtre dit ce que CE lancer produit (issue rendue par la famille), pas seulement la plage où
      // il tombe : sans elle, une cible atteinte se lit comme une manche qui passe.
      return { consequences: freeCons([potTotalLigne(seq.parametres, p, garanti(joueur, Number(step.meta?.seat ?? p.seat ?? 0), 'siège du pot'), total, cible)]) };
    },
    /** APPLIERS des deux CHOIX d'un jeu de mise : ils n'appliquent rien — le choix committé est LU par
     *  la clôture, seul juge de la manche (patron du réducteur unique). */
    [TAVERN_TARGET_KIND]: () => ({}),
    [TAVERN_FOLD_KIND]: () => ({}),
    /** APPLIER du lancer : la ligne de récit de ce qui est tombé, et — quand le RAW laisse le gain au
     *  lanceur — l'étape de décision appendée à la MÊME fenêtre (patron du choix d'option d'équipe). Deux
     *  formes, parce que le RAW en donne deux : un CHOIX entre des valeurs nommées (« 2, 6, 20 ou 60 »,
     *  l.97) et une SAISIE dans une plage (« autant de points que vous le souhaitez, entre 1 et 100 »,
     *  l.97 — interaction `'quantite'` de la coquille). La décision, elle, est appliquée par la clôture,
     *  seul juge du tour. */
    [TAVERN_THROW_KIND]: (get, set, step) => {
      const seq = activeSequence<TavernPayload>(get);
      if (!seq) return {};
      const lu = volleyTurnOf(get, seq, step);
      const jet = step.participants?.[0];
      if (!lu || !jet) return {};
      const heros = actorIn(get(), jet.id);
      const qui = heros ? nomDe(heros) : jet.label ?? jet.id;
      const tranche = heros && !cadenceAuto() && jetSurfaced(get(), heros);
      const id = `${TAVERN_GAIN_KIND}-${seq.manche}`;
      const libre = lu.outcome.libre;
      if (libre && tranche) {
        const etape = quantityStep({
          id, kind: TAVERN_GAIN_KIND, icon: 'navigation/des',
          label: t('tavern.volleyGainChoix', { who: qui }),
          actorId: heros!.id,
          min: libre.min, max: libre.max, unit: t('tavern.volleyUnitePoints'),
          value: volleyPolitiqueLibre(seq.parametres.volley!, lu.turn, libre),
        });
        if (etape) pushStep(set, etape, SEQUENCE_PURPOSE);
      } else if (lu.outcome.choix?.length && tranche) {
        const etape = choiceStep({
          id, kind: TAVERN_GAIN_KIND, icon: 'navigation/des',
          label: t('tavern.volleyGainChoix', { who: qui }),
          actorId: heros!.id,
          options: lu.outcome.choix.map((n) => ({ key: String(n), label: t('tavern.volleyPoints', { n }) })),
          defaultChoice: String(volleyPolitique(seq.parametres.volley!, lu.turn, lu.outcome.choix)),
        });
        if (etape) pushStep(set, etape, SEQUENCE_PURPOSE);
      }
      return { consequences: freeCons([t('tavern.volleyJet', { who: qui, dr: lu.turn.sl })]) };
    },
    /** APPLIERS des CHOIX d'une volée (ligne visée, gain) et du camp mené : ils n'appliquent rien — le
     *  choix committé est LU par la clôture, seul juge (patron du réducteur unique). */
    [TAVERN_AIM_KIND]: () => ({}),
    [TAVERN_GAIN_KIND]: () => ({}),
    [TAVERN_SIDE_KIND]: () => ({}),
    /** APPLIER de l'effacement : la clôture seule en tire les conséquences (patron du réducteur unique). */
    [TAVERN_ERASE_KIND]: () => ({}),
  } satisfies PartDeTable<'appliers', typeof GENRES_D_ETAPE>,
  famillesTirables: [
    tablesDePot,
  ],
  sequences: {
    [TAVERN_SEQUENCE]: {
      manche: tavernRound, clore: tavernClose, denouer: tavernSettle, tableau: tavernBoard,
      abandon: (seq) => ({
        label: t('tavern.abandon'), title: t('tavern.abandonTitre'), issue: TAVERN_ABANDON,
        // Manche de MISE en vol (cible annoncée) : on n'en sort que par le pli (NADJ 16 l.17).
        ...(seq.chargeUtile.pot !== undefined && seq.chargeUtile.target != null ? { refus: t('tavern.abandonEntreDeuxManches') } : {}),
      }),
    },
  },
} satisfies FragmentDeTables;
