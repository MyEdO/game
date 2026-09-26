/**
 * Jeux de taverne (Nuits agitées & dures journées, ch.16) — FLUX de jeu branché sur le SOCLE DE
 * SÉQUENCE (`state/sequenceCore`, #1279) : UN état de séquence, UNE fabrique de manche, UN réducteur
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
 * (`engine/tavernGame.findTavernGameById`, règle optionnelle `tavern-games-rapides`). Sous le régime
 * rapide, un jeu arrive sans forme de tour, sans mise, sans camps ni Test combiné — toutes les
 * familles ci-dessous restent donc au repos d'elles-mêmes, et la manche opposée ordinaire (sans cible
 * de cumul : elle dénoue à la première clôture) est ce qui se joue. Aucun `if` de régime dans ce
 * fichier, aucun jeu nommé au code.
 *
 * Réservé aux tables qui activent l'option `tavern-games`.
 */
import { CHAR_LABELS, DIFFICULTY_LABELS, type CharKey, type Combatant, type Difficulty } from '../engine/types';
import type { Get, Set } from './flowTypes';
import {
  findTavernGameById, resolveTavernRound, rollTavernTest, tavernOpposedLog, tavernExtendedLog, roundSL,
  TAVERN_GAMES, TAVERN_TEST_DIFFICULTY, type TavernGame, type TavernGameResult,
} from '../engine/tavernGame';
import { findTableEntry } from '../engine/tables';
import { resolveOpposed, isDoubleRoll, evaluateCombinedTest, type TestResult } from '../engine/tests';
import { isDrunk } from '../engine/drunkenness';
import { hasCondition } from '../engine/conditions';
import { applyOps } from '../engine/ops';
import { testValue } from '../engine/skills';
import { effectiveChar } from '../engine/characteristics';
import { battleRng } from './battleRng';
import { toBrass, fromBrass, formatMoney } from '../engine/money';
import { bourseOf, creditBourse, payWithAllocation, soloPayer } from './bourseFlow';
import {
  freeCons, testSkillLabel, opposedAttackerLabel, monoStep, bandStep, choiceStep, quantityStep, rollStep, composeRollLabel, surfaceOf, effectiveTarget,
  tableStep, displayStep,
  type BuiltCascadeStep, type Consequence,
} from './rollSeam';
import type { CascadeSecondRead, CascadeStep, CascadeStepMeta, CascadeTableDecl } from './pendings';
import { advantageModLine, type ModLine } from '../engine/combat';
import type { BatchParticipant } from './pendings';
import { registerCascadeApplier, rollBatchParticipant, pushStep, registerTableStepFamily, rollTableStep, type TableStepDef } from './cascade';
import { combatStakeRef, refLabel } from '../data/index';
import { memoParVersion } from '../data/versionDataset';
import {
  registerSequence, startSequence, resolveSequenceTie, sequenceCumRound, sequenceDrBonus,
  sequencePhaseOf, sequenceScoreOf, sequenceTableRow, resolveSequencePotTurn, sequencePotIssue,
  resolveSequenceThrow, sequenceThrowGain, sequenceThrowRow, sequenceVolleyRounds,
  activeSequence, setSequencePayload, setSequenceCum, SEQUENCE_PURPOSE,
  type SequenceBoard, type SequenceCloseCtx, type SequenceParams, type SequenceRound,
  type SequencePotTurn, type SequenceState, type SequenceVerdict,
  type SequenceThrowTurn, type SequenceThrowOutcome, type SequenceVolleyRules, type SequenceVolleyRow,
  type SequenceSide, type SequenceCombinedRules,
} from './sequenceCore';
import type { RNG } from '../engine/dice';
import { actorIn, garanti } from './combatants';
import { pnjAuProfil, sceneNpc } from './sceneNpc';
import type { Scene } from './scene';
import { jetSurfaced } from './netOwnership';
import { cadenceAuto } from '../engine/cadence';
import { t, interpolate } from '../i18n';
import { dataLabel } from '../data';
import { stepDetail, stepFraction, stepPrecision, idDansLaSequence } from './rollSeam';
import type { PlayerText } from '../i18n/playerText';

/**
 * Adversaire d'une partie — TROIS formes, chacune JOUE une fiche (`tavernGameValue`) :
 *  · `hero` : un compagnon du groupe ;
 *  · `npc` : un PNJ de la SCÈNE (`sceneNpc`) — `NADJ 04 l.72`, `EDO 01 l.200` ;
 *  · `profil` : un habitué sans entité de scène, au profil standard choisi (`pnjAuProfil`, `LDB 77 l.7`).
 */
export type TavernOpponent =
  | { kind: 'hero'; id: string }
  | { kind: 'npc'; id: string }
  | { kind: 'profil'; id: string };

/** Résultat de la dernière partie (affiché dans la modale). Étend l'issue moteur des libellés/mise. */
export interface TavernGamesResult extends TavernGameResult {
  gameLabel: string;
  challengerName: string;
  opponentName: string;
  /** Mise engagée (sous de cuivre) — 0 si le jeu n'a pas de mise, ou adversaire = compagnon. */
  stakeBrass: number;
  /** Variation de la bourse du groupe : +mise (gagné vs la maison) / −mise (perdu) / 0. */
  netBrass: number;
  /** Ligne de détail DÉJÀ composée par le jeu, quand son score ne se dit pas en DR (jeu de MISE :
   *  ce qui compte est ce que la bourse a fait sur N manches) — AFFICHAGE. */
  detail?: string;
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
  if (game.skill) return testValue(hero, game.skill.id, game.characteristic, game.skill.spec);
  if (game.characteristic) return effectiveChar(hero, game.characteristic);
  return testValue(hero, 'pari'); // aucune Compétence indiquée → Pari (l.11)
}

/** L'ACTEUR d'un id de partie, quel que soit son banc : héros (combat ou groupe) ou PNJ de la scène.
 *  SOURCE UNIQUE — sans elle, un site lirait `party` seul et le PNJ à fiche redeviendrait anonyme. */
function tavernActor(get: Get, id: string | undefined): Combatant | undefined {
  if (!id) return undefined;
  return actorIn(get(), id) ?? sceneNpc(get().scene, id);
}

/**
 * LES PNJ DE LA SCÈNE QUI PROPOSENT UNE PARTIE (`SceneEntity.tavernGame`) — ce que la CARTE décide,
 * lu par la modale pour offrir le troisième mode d'adversaire. Rend l'entité ET sa fiche dérivée :
 * le libellé affiché est celui que rend la projection (`sceneNpc`), jamais un id brut. Un personnage SANS
 * fiche n'a aucune valeur à opposer : il n'est pas proposé (sa faute est dite par `validateScene`, #1882).
 */
export function tavernNpcOffers(scene: Scene | null | undefined): { id: string; label: string; gameId: string; stakeBrass?: number }[] {
  return (scene?.entities ?? [])
    .filter((e) => e.kind === 'personnage' && e.tavernGame)
    .flatMap((e) => {
      const fiche = sceneNpc(scene, e.id);
      return fiche ? [{
        id: e.id,
        label: fiche.label,
        gameId: e.tavernGame!.gameId,
        ...(e.tavernGame!.stakeBrass != null ? { stakeBrass: e.tavernGame!.stakeBrass } : {}),
      }] : [];
    });
}

/** Déclaration du Test (skill/char/spec) d'un jeu — MÊME repli que `tavernGameValue` (Pari si rien
 *  d'indiqué), réutilisée par les mints (`req.test`, qui calculent eux-mêmes la valeur par acteur). */
/** Déclaration de Test RUNTIME (`skill`/`spec` à plat, forme des monteurs de ligne) → `TavernOption`
 *  (référence de Compétence EMBOÎTÉE, forme de la DONNÉE). PURE. */
function enOption(t: { skill?: string; spec?: string; char?: CharKey }): TavernOption {
  return {
    ...(t.skill ? { skill: { id: t.skill, ...(t.spec ? { spec: t.spec } : {}) } } : {}),
    ...(t.char ? { char: t.char } : {}),
  };
}

function tavernTestSpec(game: TavernGame): { skill?: string; char?: CharKey; spec?: string } {
  if (game.skill) return { skill: game.skill.id, spec: game.skill.spec };
  if (game.characteristic) return { char: game.characteristic };
  return { skill: 'pari' };
}

/** OUVRE la table. `npcId` = le PNJ qui PROPOSE la partie (son dialogue vient de l'ouvrir) : la
 *  modale s'ouvre sur SON offre. GÉNÉRIQUE — tout PNJ à `tavernGame` en hérite, aucun n'est nommé. */
export function openTavernGames(_get: Get, set: Set, npcId?: string): void {
  set({ tavernGames: { result: null, ...(npcId ? { npcId } : {}) } });
}

export function closeTavernGames(_get: Get, set: Set): void {
  set({ tavernGames: null });
}

/** Id de la définition de séquence des jeux de taverne (donnée : écrit dans les saves). */
export const TAVERN_SEQUENCE = 'tavern';

/** Kind de l'étape-jet d'une manche (bande OU mono) — UNIQUE depuis #1279 S1. */
export const TAVERN_ROUND_KIND = 'tavern-round';

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
export function tavernPartieEnCours(s: { sequence: { def: string } | null }): boolean {
  return s.sequence?.def === TAVERN_SEQUENCE;
}

/** CHARGE UTILE d'une partie jouée par le socle — la table, l'adversaire, la mise. */
export interface TavernPayload {
  gameId: string;
  challengerId: string;
  opponentValue: number;
  opponentName: string;
  opponentId?: string;
  stakeBrass: number;
  /** Scores de la manche close (lus par le dénouement d'une partie à manche unique). */
  last?: { playerSL: number; opponentSL: number };
  /** JEU D'ÉQUIPE : les rangées de chaque camp (héros ET figurants), par id de rangée. */
  teams?: { player: string[]; opponent: string[] };
  /** JEU D'ÉQUIPE : option de Test retenue par chaque héros pour la manche EN COURS (clé d'option). */
  choices?: Record<string, number>;
  /** JEU D'ÉQUIPE : valeur de Test des COÉQUIPIERS figurants du groupe (`allyProfil`), distincte de
   *  celle du camp d'en face (`opponentValue`). Absente hors jeu d'équipe. */
  allyValue?: number;
  /** JEU D'ÉQUIPE : l'AVANTAGE gagné par chaque camp POUR LE TOUR SUIVANT (l.121). Les héros portent
   *  le leur sur leur fiche (op `gainAdvantage`) ; la fiche d'un figurant ne suit pas la séquence, son camp le
   *  porte ici — sans quoi une équipe de figurants ne pourrait JAMAIS gagner d'Avantage. */
  advantage?: { player: number; opponent: number };
  /** TORCHON : l'ORDRE de passage des lanceurs (un tour = un lanceur, l.111), figé à l'ouverture. */
  throwers?: { id: string; label: string; camp: 'player' | 'opponent'; value?: number }[];
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
  /** CAMPS ASYMÉTRIQUES : l'id du camp que mène le CHALLENGER (Alvatafl l.27) ; absent = le camp
   *  reste à annoncer. */
  side?: string;
  /** TEST COMBINÉ : marques, échecs de seconde lecture, effacements, rang du tour (Cerevis l.97). */
  combined?: TavernCombinedState;
}

/** Clés de camp de l'accumulateur du socle — le challenger et son vis-à-vis. */
const CAMP_PLAYER = 'player';
const CAMP_OPPONENT = 'opponent';

/** Kind de l'étape de CHOIX d'option de Test (Middenball l.121) — une par héros surfacé. */
const TAVERN_CHOICE_KIND = 'tavern-option';

/** Kind de l'étape de Résistance à l'alcool d'un lancer RATÉ (Torchon l.111). */
const TAVERN_DRINK_KIND = 'tavern-drink';

/**
 * PARAMÈTRES DE SÉQUENCE d'un jeu — TOUS lus de son entrée de données : aucune valeur de règle n'est
 * écrite ici, aucun `if` par id de jeu. Un jeu N+1 à mécanismes connus n'est qu'une entrée de plus.
 */
export function tavernParams(game: TavernGame, joueurs = 0): SequenceParams {
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
function potSeats(challenger: Combatant, opponentHero: Combatant | undefined, opponentName: string, joueurs: number): TavernSeat[] {
  const seats: TavernSeat[] = [{ id: challenger.id, label: challenger.label, hero: true }];
  if (opponentHero) seats.push({ id: opponentHero.id, label: opponentHero.label, hero: true });
  else seats.push({ id: 'habitue-1', label: opponentName, hero: false });
  for (let i = seats.length; i < Math.max(2, joueurs); i++) {
    seats.push({ id: `habitue-${i}`, label: t('tavern.potHabitue', { rang: i }), hero: false });
  }
  return seats;
}

/**
 * Joue une partie : instancie le socle de séquence, qui ouvre la 1ʳᵉ manche. `stakeBrass` est la
 * MISE UNITAIRE d'un jeu de pot (« chaque joueur ajoute une mise égale au pot », l.17), plafonnée à
 * la bourse du challenger ; sans mise, une table de pot ne s'ouvre pas.
 */
export function playTavernGame(
  get: Get, set: Set,
  opts: { gameId: string; challengerId: string; opponent: TavernOpponent; stakeBrass?: number; allyProfil?: string; tablePlayers?: number },
): void {
  // RÉ-ENTRÉE REFUSÉE : `startSequence` ÉCRASE `state.sequence`. Une seconde partie ouverte pendant
  // qu'une première court la faisait donc disparaître SANS verdict — sa mise engagée perdue, son
  // étape orpheline restant dans la fenêtre à côté de celle de la nouvelle. Le slot de séquence est
  // unique : on le dit ici plutôt que de laisser l'écrasement le découvrir.
  if (activeSequence(get)) {
    get().log(t('tavern.dejaEnCours'));
    return;
  }
  const game = findTavernGameById(opts.gameId);
  const party = get().party;
  const challenger = party.find((h) => h.id === opts.challengerId);
  if (!game) { get().log(t('tavern.jeuInconnu', { id: opts.gameId })); return; }
  if (!challenger) { get().log(t('tavern.challengerAbsent', { jeu: game.label })); return; }
  const opp = opts.opponent;
  const opponentActor = opp.kind === 'hero' ? party.find((h) => h.id === opp.id)
    : opp.kind === 'npc' ? sceneNpc(get().scene, opp.id)
      : pnjAuProfil(opp.id, HABITUE);
  if (!!game.team !== (opts.allyProfil !== undefined)) {
    get().log(t(game.team ? 'tavern.equipeSansCoequipier' : 'tavern.coequipierHorsEquipe', { jeu: game.label }));
    return;
  }
  const allie = opts.allyProfil === undefined ? undefined : pnjAuProfil(opts.allyProfil, HABITUE);
  if (!opponentActor) { get().log(t('tavern.adversaireAbsent', { jeu: game.label })); return; }
  if (opts.allyProfil !== undefined && !allie) { get().log(t('tavern.coequipierSansProfil', { jeu: game.label, profil: opts.allyProfil })); return; }

  const opponentValue = tavernGameValue(opponentActor, game);
  const opponentName = opponentActor.label;
  // L'habitué n'a aucun banc (`tavernActor`) : ses lectures passent par `opponentValue`.
  const opponentId = opp.kind === 'profil' ? undefined : opponentActor.id;

  // MISE : elle est celle d'un jeu de POT (« chaque joueur ajoute une mise égale au pot », l.17), et
  // elle joue quel que soit le vis-à-vis — l'argent change vraiment de bourse, compagnons compris.
  const wantStake = game.pot ? Math.max(0, Math.floor(opts.stakeBrass ?? 0)) : 0;
  // La mise sort de la bourse du CHALLENGER (il paie s'il perd, encaisse s'il gagne) : plafonnée à SA bourse.
  const stakeBrass = Math.min(wantStake, toBrass(bourseOf(challenger)));
  // « on ne mise que ce qu'on a » (arbitrage en tête du bloc AL-ZAHR) : première porte de la règle,
  // celle de la table elle-même.
  if (game.pot && stakeBrass <= 0) {
    get().log(t('tavern.potSansMise', { who: challenger.label }));
    return;
  }
  const seats = game.pot ? potSeats(challenger, opponentId ? opponentActor : undefined, opponentName, opts.tablePlayers ?? 2) : [];

  startSequence<TavernPayload>(get, set, {
    def: TAVERN_SEQUENCE,
    params: tavernParams(game, seats.length),
    payload: {
      gameId: game.id, challengerId: challenger.id, opponentValue, opponentName,
      ...(opponentId ? { opponentId } : {}), stakeBrass,
      ...(allie ? { allyValue: tavernGameValue(allie, game) } : {}),
      ...(game.pot
        ? { seats, manche: 1, pot: 0, target: null }
        : {}),
    },
  });
}

/** Applier de la manche : MUET côté conséquence (l'issue est GLOBALE — elle se décide à la clôture,
 *  dans le réducteur du socle) ; ne pousse que la ligne de récit de ce qui est tombé. */
registerCascadeApplier(TAVERN_ROUND_KIND, (get, set, step) => {
  const dr = (n: number) => `${n >= 0 ? '+' : ''}${n} DR`;
  if (step.participants) {
    const lines = step.participants.map((row) => {
      // Le porteur se résout par l'accesseur de la TABLE (`tavernActor`), pas par celui du combat :
      // un adversaire à FICHE est une entité de SCÈNE, qu'`actorIn` ne trouve pas — sa rangée
      // retombait alors sur `row.label`, qui est le libellé de son TEST. Le journal disait « Force :
      // −4 DR. » là où l'écran disait « Négociant : 0/10 » : deux surfaces, deux noms, un joueur qui
      // attribue le score au mauvais camp.
      const who = tavernActor(get, row.id)?.label ?? row.label ?? row.id;
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
  const mien = step.actorId ? actorIn(get(), step.actorId)?.label : undefined;
  const lignes = [`${mien ? `${mien} — ` : ''}${step.rollLabel ?? 'Jeu'} : ${dr(step.result.sl)}.`];
  if (opp?.aT) {
    const sien = opposedAttackerLabel(opp);
    lignes.push(`${opp.attackerName}${sien ? ` — ${sien}` : ''} : ${dr(opp.aT.sl)}.`);
  }
  return { consequences: freeCons(lignes) };
});

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
  return {
    label: testSkillLabel(regles.second) ?? game.label,
    base: acteur ? testValue(acteur, regles.second.skill, regles.second.char, regles.second.spec) : nue,
    target: combinedSecondTarget(regles, acteur, difficulty, nue),
    difficulty,
  };
}

/** RANGÉE d'un camp HÉROS dans une bande de manche — patron `pursuitFlow.pursuitRow` : ligne montée
 *  par le monteur canonique (`rollStep`), surfaçage SEAT-AGNOSTIQUE (`jetSurfaced`) pour que le héros
 *  d'un AUTRE siège garde son jet À JOUER. Le porteur qu'aucun siège ne tient (ou toute rangée en
 *  cadence Auto/Rapide) naît TÉMOIN, son jet déjà roulé. */
function tavernRow(get: Get, h: Combatant, game: TavernGame, choix?: number): BatchParticipant {
  // L'OPTION retenue porte le Test ET sa Difficulté (Alvatafl l.25, Cerevis l.97 : « Pari Accessible
  // (+20) ») ; sans option déclarée, le repli est celui du jeu rapide (Intermédiaire, l.11).
  const opt = optionOf(game, choix);
  const test = { ...(opt.skill ? { skill: opt.skill.id } : {}), ...(opt.skill?.spec ? { spec: opt.skill.spec } : {}), ...(opt.char ? { char: opt.char } : {}) };
  const difficulty = difficulteOf(opt);
  const second = combinedSecondRead(game, h, difficulty, 0);
  const row: BatchParticipant = {
    id: h.id,
    label: testSkillLabel(test) ?? game.label,
    ...(test.skill ? { skillId: test.skill } : {}),
    difficulty,
    result: null,
    interactive: true,
    ...rollStep({ actor: h, test, difficulty }),
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
type TavernOption = { skill?: import('../engine/skills').SkillRef; char?: CharKey; difficulty?: Difficulty; combatTest?: boolean };

/** La Difficulté d'une option : la sienne, ou celle du jeu rapide (« Test opposé de Compétence
 *  Intermédiaire (+0) », l.11) quand l'option n'en nomme pas — un camp qui se contente d'ESQUIVER ne
 *  porte pas de Difficulté propre. */
function difficulteOf(opt: TavernOption): Difficulty {
  return opt.difficulty ?? TAVERN_TEST_DIFFICULTY;
}

/**
 * L'AVANTAGE d'un camp, en ligne NOMMÉE sur la cible (`LDB 14 l.215` : +10 par point à un Test de
 * Combat ou de Psychologie APPROPRIÉ ; Middenball l.121 : « en utilisant les règles habituelles
 * relatives à l'Avantage »). Deux garde-fous, tous deux DÉCLARÉS :
 *  · l'option dit si son Test est un Test de Combat (`combatTest`) — Bagarre oui, Athlétisme non ;
 *  · la ligne est celle du moteur (`advantageModLine`), jamais un `×10` réécrit ici.
 * Le porteur est un Combatant (héros) OU un point d'Avantage de camp (figurant, qui n'en a pas).
 */
function avantageSurLaCible(opt: TavernOption, porteur: Combatant | number): ModLine[] {
  if (!opt.combatTest) return [];
  const ligne = typeof porteur === 'number'
    ? advantageModLine({ advantage: porteur } as Combatant)
    : advantageModLine(porteur);
  return ligne ? [ligne] : [];
}

/** RANGÉE d'un FIGURANT : témoin AUTO (aucun siège ne le tient), son jet déjà roulé — patron des
 *  rangées témoins de la bande (`pursuitFlow.pursuitRow`). Aucun Combatant : sa valeur est celle que
 *  la table lui donne, montée par le monteur CANONIQUE en valeur ÉTRANGÈRE (ce n'est pas un Niveau de
 *  Compétence de fiche) — la Difficulté de l'option et l'Avantage DE SON CAMP entrent dans la cible
 *  comme pour un héros (l'Avantage est gagné par l'ÉQUIPE, l.121, pas par ses seuls héros). */
function figurantRow(id: string, label: string, valeur: number, opt: TavernOption, avantage: number): BatchParticipant {
  const surLaCible = avantageSurLaCible(opt, avantage);
  const difficulty = difficulteOf(opt);
  const row: BatchParticipant = {
    id, label, difficulty, result: null, interactive: false,
    ...(opt.skill ? { skillId: opt.skill.id } : {}),
    ...rollStep({ valeur, valeurEtrangere: true, difficulty, ...(surLaCible.length ? { surLaCible } : {}) }),
  };
  return { ...row, result: rollBatchParticipant(row, battleRng()) };
}

/** L'option de Test retenue pour un héros : son CHOIX s'il en a fait un, sinon la PREMIÈRE option que
 *  l'entrée déclare — c'est ce que jouent les porteurs qu'aucun siège ne tient, et les figurants. */
function optionOf(game: TavernGame, choix: number | undefined): TavernOption {
  const options = game.options ?? [];
  return options[choix ?? 0] ?? { ...enOption(tavernTestSpec(game)), difficulty: TAVERN_TEST_DIFFICULTY };
}

/**
 * FABRIQUE du tour de CHOIX d'option d'une manche ORDINAIRE (Alvatafl l.25) : une étape par porteur
 * TENU par un siège ; personne ne lance avant que chacun n'ait dit ce qu'il tente (« déclaration
 * avant jets »). Aucun siège : la politique déclarée s'applique (la PREMIÈRE option, patron
 * `optionOf`) et aucune fenêtre ne s'ouvre.
 */
function tavernOptionRound(get: Get, seq: SequenceState<TavernPayload>, game: TavernGame): SequenceRound<TavernPayload> | undefined {
  const p = seq.payload;
  const porteurs = [p.challengerId, ...(p.opponentId ? [p.opponentId] : [])]
    .map((id) => actorIn(get(), id))
    .filter((h): h is Combatant => !!h && !cadenceAuto() && jetSurfaced(get(), h));
  if (!porteurs.length) return undefined;
  const steps = porteurs.map((h) => choiceStep({
    id: `${TAVERN_CHOICE_KIND}-${seq.round}-${h.id}`,
    kind: TAVERN_CHOICE_KIND,
    label: t('tavern.optionChoix', { who: h.label }),
    icon: 'nav/dice',
    actorId: h.id,
    options: (game.options ?? []).map((o, i) => ({
      key: String(i),
      label: o.skill ? refLabel('skills', o.skill) : dataLabel(CHAR_LABELS[o.char ?? 'intelligence']),
      detail: DIFFICULTY_LABELS[o.difficulty],
    })),
    defaultChoice: '0',
  })).filter((s): s is BuiltCascadeStep => !!s);
  if (!steps.length) return undefined;
  return { title: stepDetail(dataLabel(game.label), t('tavern.optionTitre')), icon: 'nav/dice', steps };
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
function equipierRow(get: Get, h: Combatant, game: TavernGame, choix: number | undefined): BatchParticipant {
  const opt = optionOf(game, choix);
  const test = { ...(opt.skill ? { skill: opt.skill.id } : {}), ...(opt.skill?.spec ? { spec: opt.skill.spec } : {}), ...(opt.char ? { char: opt.char } : {}) };
  const surLaCible = avantageSurLaCible(opt, h);
  const difficulty = difficulteOf(opt);
  const row: BatchParticipant = {
    id: h.id,
    label: testSkillLabel(test) ?? game.label,
    ...(opt.skill ? { skillId: opt.skill.id } : {}),
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
function equipeBande(get: Get, seq: SequenceState<TavernPayload>): { band: BuiltCascadeStep; teams: { player: string[]; opponent: string[] } } | undefined {
  const p = seq.payload;
  const game = findTavernGameById(p.gameId);
  if (game?.roundShape !== 'team' || !game.team) return undefined;
  const heros = equipiers(get);
  if (!heros.length) return undefined;
  const rows: BatchParticipant[] = heros.map((h) => equipierRow(get, h, game, p.choices?.[h.id]));
  const optFigurant = optionOf(game, 0);
  const mien = [...heros.map((h) => h.id)];
  const sien: string[] = [];
  // Les coéquipiers du groupe ont LEUR valeur (`allyValue`), distincte de celle du camp d'en face :
  // sans elle, vos figurants joueraient sur la valeur de l'ADVERSAIRE.
  for (let i = heros.length; i < game.team.size; i++) {
    const id = `figurant-p-${seq.round}-${i}`;
    rows.push(figurantRow(id, t('tavern.equipier', { rang: i + 1 }), valeurDesCoequipiers(p), optFigurant, p.advantage?.player ?? 0));
    mien.push(id);
  }
  for (let i = 0; i < game.team.size; i++) {
    const id = `figurant-o-${seq.round}-${i}`;
    rows.push(figurantRow(id, `${p.opponentName} ${i + 1}`, p.opponentValue, optFigurant, p.advantage?.opponent ?? 0));
    sien.push(id);
  }
  const ph = sequencePhaseOf(seq.params, seq.round);
  const band = bandStep({
    id: idDansLaSequence(get, TAVERN_ROUND_KIND), // id = ADRESSE ; la MANCHE voyage sur `meta.round` (#1852)
    kind: TAVERN_ROUND_KIND,
    icon: 'nav/dice',
    label: stepDetail(dataLabel(game.label), t('step.tavernMiTemps', { n: ph.roundInPhase, phase: ph.phase })),
    stake: combatStakeRef('tavernGame', {
      values: { jeu: game.label, adversaire: p.opponentName, mise: 'aucune' },
    }),
    meta: { gameId: game.id, opponentName: p.opponentName, stakeBrass: 0, round: seq.round },
  }, rows);
  return band ? { band, teams: { player: mien, opponent: sien } } : undefined;
}

/** APPLIER du CHOIX d'option : le dernier choix committé APPEND la bande du tour à la MÊME fenêtre —
 *  les rangées ne peuvent être montées qu'une fois toutes les options connues (la Difficulté et la
 *  Compétence de chaque rangée en dépendent). « Déclaration AVANT jets » : personne ne lance avant que
 *  chacun n'ait dit ce qu'il tente. */
registerCascadeApplier(TAVERN_CHOICE_KIND, (get, set, step) => {
  const seq = activeSequence<TavernPayload>(get);
  const encours = get().pendingCascade;
  if (!seq || !encours) return {};
  const choix = encours.participants.filter((s) => s.kind === TAVERN_CHOICE_KIND);
  const reste = choix.some((s) => s.chosen == null && s.id !== step.id);
  const retenu = Object.fromEntries(choix.map((s) => [s.actorId ?? '', Number(s.chosen ?? 0)]));
  const apres: TavernPayload = { ...seq.payload, choices: { ...retenu, ...(step.actorId ? { [step.actorId]: Number(step.chosen ?? 0) } : {}) } };
  setSequencePayload(get, set, apres);
  const option = step.options?.find((o) => o.key === step.chosen);
  if (reste) return option ? { consequences: freeCons([option.label]) } : {};
  const monte = equipeBande(get, { ...seq, payload: apres });
  if (monte) {
    setSequencePayload(get, set, { ...apres, teams: monte.teams });
    pushStep(set, monte.band, SEQUENCE_PURPOSE);
  }
  return option ? { consequences: freeCons([option.label]) } : {};
});

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
  const mien: NonNullable<TavernPayload['throwers']> = heros.map((h) => ({ id: h.id, label: h.label, camp: 'player' as const }));
  for (let i = heros.length; i < taille; i++) {
    mien.push({ id: `figurant-p-${i}`, label: t('tavern.equipier', { rang: i + 1 }), camp: 'player', value: valeurDesCoequipiers(p) });
  }
  const sien: NonNullable<TavernPayload['throwers']> = [];
  for (let i = 0; i < taille; i++) {
    sien.push({ id: `figurant-o-${i}`, label: `${p.opponentName} ${i + 1}`, camp: 'opponent', value: p.opponentValue });
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
  const game = findTavernGameById(seq.payload.gameId);
  if (game?.roundShape !== 'thrower' || !game.dancers) return undefined;
  const throwers = seq.payload.throwers?.length ? seq.payload.throwers : torchonThrowers(get, seq.payload, game);
  const lanceur = throwers?.[seq.round - 1];
  if (!lanceur) return undefined;
  const p: TavernPayload = { ...seq.payload, throwers };
  const test = tavernTestSpec(game);
  const heros = lanceur.camp === 'player' ? get().party.find((h) => h.id === lanceur.id) : undefined;
  const lanceurRow: BatchParticipant = heros
    ? {
      id: lanceur.id, label: testSkillLabel(test) ?? game.label, ...(test.skill ? { skillId: test.skill } : {}),
      difficulty: TAVERN_TEST_DIFFICULTY, result: null, interactive: true,
      ...rollStep({ actor: heros, test, difficulty: TAVERN_TEST_DIFFICULTY }),
    }
    : figurantRow(lanceur.id, lanceur.label, lanceur.value ?? p.opponentValue, { difficulty: TAVERN_TEST_DIFFICULTY }, 0);
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
  const camp = lanceur.camp === 'player' ? p.opponentName : t('tavern.campMien');
  const valeur = lanceur.camp === 'player' ? p.opponentValue : valeurDesCoequipiers(p);
  rows.push(figurantRow(`danseur-${seq.round}`, t('tavern.danseur', { rang, camp }), valeur, { skill: { id: 'esquive' } }, 0));
  const band = bandStep({
    id: idDansLaSequence(get, TAVERN_ROUND_KIND), // id = ADRESSE ; la MANCHE voyage sur `meta.round` (#1852)
    kind: TAVERN_ROUND_KIND,
    icon: 'nav/dice',
    label: stepDetail(dataLabel(game.label), t('step.tavernTorchon', { lanceur: lanceur.label })),
    stake: combatStakeRef('tavernGame', { values: { jeu: game.label, adversaire: p.opponentName, mise: 'aucune' } }),
    meta: { gameId: game.id, opponentName: p.opponentName, stakeBrass: 0, round: seq.round },
  }, rows);
  if (!band) return undefined;
  return {
    title: t('tavern.volleyLancer', { jeu: game.label, n: seq.round, total: throwers!.length }),
    icon: 'nav/dice',
    steps: [band],
    immediate: !jouable,
    payload: p,
  };
}

/** `meta` de l'étape `tavern-drink` : le camp et le nom du lanceur puni. */
interface PinteDuLanceur { camp: 'player' | 'opponent'; who: string }

/** Lit le lanceur posé par `torchonRate`, SEUL producteur de l'étape (#1906). */
function lirePinte(meta: CascadeStepMeta | undefined): PinteDuLanceur {
  const camp = meta?.camp;
  if ((camp !== 'player' && camp !== 'opponent') || typeof meta?.who !== 'string')
    throw new Error('[tavern-drink] étape sans lanceur alors que `torchonRate` le pose (#1906)');
  return { camp, who: meta.who };
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
  const p = seq?.payload;
  const game = p ? findTavernGameById(p.gameId) : undefined;
  const regles = seq?.params.throwerPenalty;
  if (!seq || !p || !game || !regles || game.roundShape !== 'thrower') return [];
  const lanceur = p.throwers?.[seq.round - 1];
  const jet = rows.find((r) => r.id === lanceur?.id);
  const danseur = rows.find((r) => r.id.startsWith('danseur-'));
  if (!lanceur || !jet?.result || !danseur?.result) return [];
  const asTest = (r: BatchParticipant): TestResult => ({
    roll: r.result!.roll, target: r.result!.target, base: r.base,
    success: r.result!.roll <= r.result!.target, sl: r.result!.sl, isDouble: false,
  });
  if (resolveOpposed(asTest(jet), asTest(danseur)).attackerWins) return [];
  const heros = actorIn(get(), lanceur.id);
  const id = `${TAVERN_DRINK_KIND}-${seq.round}`;
  const etape = heros && !cadenceAuto() && jetSurfaced(get(), heros)
    ? monoStep({
      id,
      kind: TAVERN_DRINK_KIND,
      icon: 'nav/dice',
      label: composeRollLabel(heros, regles.label ?? game.label, regles.test),
      actor: heros,
      difficulty: regles.difficulty,
      ligne: { test: regles.test },
      stake: combatStakeRef('tavernGame', { values: { jeu: game.label, adversaire: p.opponentName, mise: 'aucune' } }),
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
      id, label: testSkillLabel(regles.test) ?? lanceur.label, ...(regles.test.skill ? { skillId: regles.test.skill } : {}),
      difficulty: regles.difficulty, result: null, interactive: false,
      ...rollStep({ actor: heros, test: regles.test, difficulty: regles.difficulty }),
    }
    : figurantRow(id, lanceur.label, lanceur.value ?? p.opponentValue, { ...enOption(regles.test), difficulty: regles.difficulty }, 0);
  const jete = pinte.result ?? rollBatchParticipant(pinte, battleRng());
  return torchonBoit(get, set, lanceur.id, lanceur.camp, lanceur.label, jete.success);
}

/** CE QUE COÛTE le Test raté de la sanction : ses `ops` au lanceur, ses `points` à son camp — retirés
 *  de l'ACCUMULATEUR du socle EN COURS DE MANCHE (`setSequenceCum`), la clôture les relit là. Le RÉCIT
 *  est celui que la sanction DÉCLARE (`lines`) : aucune phrase n'est écrite ici. */
function torchonBoit(get: Get, set: Set, lanceurId: string, camp: 'player' | 'opponent', label: string, success: boolean): string[] {
  const seq = activeSequence<TavernPayload>(get);
  const regles = seq?.params.throwerPenalty;
  if (!seq || !regles) return [];
  if (success) return regles.lines?.reussite ? [interpolate(regles.lines.reussite, { who: label })] : [];
  const perte = regles.points ?? 0;
  const acteur = actorIn(get(), lanceurId);
  const lignes: string[] = regles.lines?.echec
    ? [interpolate(regles.lines.echec, { who: label, points: perte, s: perte > 1 ? 's' : '' })]
    : [];
  if (acteur && regles.ops?.length) {
    // ANCRAGE DE RÈGLE : ce que la sanction applique se relie à la FICHE DU JEU, qui porte sa règle
    // verbatim — un effet actif sans ancrage s'affiche NU (`effect-rule-anchor`).
    lignes.push(...applyOps(acteur, [...regles.ops], { rng: battleRng(), source: { kind: 'tavernGame', id: seq.payload.gameId } }));
  }
  if (perte) setSequenceCum(get, set, { ...seq.cum, [camp]: (seq.cum[camp] ?? 0) - perte });
  return lignes;
}

registerCascadeApplier(TAVERN_DRINK_KIND, (get, set, step) => {
  if (!step.result || !step.actorId) return {};
  const { camp, who } = lirePinte(step.meta);
  return { consequences: freeCons(torchonBoit(get, set, step.actorId, camp, who, step.result.success)) };
});

/** FABRIQUE d'un TOUR d'équipe : les CHOIX d'option des héros surfacés (la bande suivra, appendée par
 *  le dernier choix) ; sans aucun siège humain, la bande se monte d'office sur la politique déclarée
 *  et se résout sans fenêtre. */
function tavernTeamRound(get: Get, seq: SequenceState<TavernPayload>): SequenceRound<TavernPayload> | undefined {
  const p = seq.payload;
  const game = findTavernGameById(p.gameId);
  if (!game?.team) return undefined;
  const ph = sequencePhaseOf(seq.params, seq.round);
  const titre = t('tavern.miTempsTitre', { jeu: game.label, phase: ph.phase, n: ph.roundInPhase, total: ph.rounds });
  const aChoisir = (game.options?.length ?? 0) > 1
    ? equipiers(get).filter((h) => !cadenceAuto() && jetSurfaced(get(), h))
    : [];
  if (!aChoisir.length) {
    const monte = equipeBande(get, { ...seq, payload: { ...p, choices: {} } });
    if (!monte) return undefined;
    return { title: titre, icon: 'nav/dice', steps: [monte.band], immediate: true, payload: { ...p, teams: monte.teams, choices: {} } };
  }
  const steps = aChoisir.map((h) => choiceStep({
    id: `${TAVERN_CHOICE_KIND}-${seq.round}-${h.id}`,
    kind: TAVERN_CHOICE_KIND,
    label: stepDetail(dataLabel(h.label), t('step.tavernCommentJouer')),
    icon: 'nav/dice',
    actorId: h.id,
    options: (game.options ?? []).map((o, i) => ({
      key: String(i),
      label: refLabel('skills', o.skill ?? { id: '' }),
      detail: DIFFICULTY_LABELS[o.difficulty],
    })),
    defaultChoice: '0',
  })).filter((s): s is BuiltCascadeStep => !!s);
  if (!steps.length) return undefined;
  return { title: titre, icon: 'nav/dice', steps, payload: { ...p, choices: {} } };
}

/** La partie et son challenger, validés par `playTavernGame` à l'ouverture : leur absence en cours de
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
  const p = seq.payload;
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
  const title = stepDetail(dataLabel(game.label), t('tavern.contre', { who: challenger.label, adversaire: p.opponentName }));
  const stake = combatStakeRef('tavernGame', {
    values: {
      jeu: game.label, adversaire: p.opponentName,
      mise: p.stakeBrass > 0 ? formatMoney(fromBrass(p.stakeBrass)) : 'aucune',
    },
  });

  if (opponentHero) {
    const rows = [
      tavernRow(get, challenger, game, p.choices?.[challenger.id]),
      tavernRow(get, opponentHero, game, p.choices?.[opponentHero.id]),
    ];
    const band = bandStep({
      id: idDansLaSequence(get, TAVERN_ROUND_KIND), // id = ADRESSE ; la MANCHE voyage sur `meta.round` (#1852)
      kind: TAVERN_ROUND_KIND,
      icon: 'nav/dice',
      label: stepDetail(dataLabel(game.label), t('step.tavernManche', { n: seq.round })),
      stake,
      meta: { gameId: game.id, opponentName: p.opponentName, stakeBrass: p.stakeBrass, round: seq.round },
    }, rows);
    if (!band) return undefined;
    return {
      title, icon: 'nav/dice', steps: [band],
      immediate: rows.every((r) => r.interactive === false),
    };
  }

  const optMien = optionOf(game, p.choices?.[challenger.id]);
  const difficulty = difficulteOf(optMien);
  const test = { ...(optMien.skill ? { skill: optMien.skill.id } : {}), ...(optMien.skill?.spec ? { spec: optMien.skill.spec } : {}), ...(optMien.char ? { char: optMien.char } : {}) };
  // L'adversaire de la SALLE joue à la MÊME Difficulté que le challenger — un Test opposé se joue au
  // même palier des deux côtés (l.11), et ce palier est celui de l'option retenue.
  const rolled = rollTavernTest(p.opponentValue, rng, difficulty);
  // TEST COMBINÉ (Cerevis l.97) : la fenêtre annonce SES DEUX cibles — sans quoi le second Test ne se
  // découvrait qu'en le ratant (friction mesurée en recette, #1279 S3).
  const second = combinedSecondRead(game, challenger, difficulty, p.opponentValue);
  const step = monoStep({
    id: idDansLaSequence(get, TAVERN_ROUND_KIND), // id = ADRESSE ; la MANCHE voyage sur `meta.round` (#1852)
    kind: TAVERN_ROUND_KIND,
    icon: 'nav/dice',
    label: composeRollLabel(challenger, game.label, test),
    actor: challenger,
    difficulty,
    ligne: { test },
    ...(second ? { second } : {}),
    stake,
    meta: {
      gameId: game.id, opponentValue: p.opponentValue, opponentName: p.opponentName,
      stakeBrass: p.stakeBrass, round: seq.round,
      // L'adversaire de la salle joue le MÊME Test que le challenger : la STRUCTURE voyage, le
      // libellé de sa ligne s'écrit au rendu.
      opposed: { aT: rolled, attackerName: p.opponentName, test },
    },
  });
  if (!step) return undefined;
  return {
    title, icon: 'nav/dice', steps: [step],
    immediate: !surfaceOf(get, challenger.id),
  };
}

/** Les DEUX jets d'une manche close, quel que soit son montage — SOURCE UNIQUE de lecture du
 *  réducteur (bande : une rangée par camp ; mono : le jet du challenger et le jet adverse FIGÉ). */
function tavernSides(ctx: SequenceCloseCtx<TavernPayload>): {
  player: TestResult; opponent: TestResult; playerActor?: Combatant; opponentActor?: Combatant;
} | undefined {
  const { get, seq, done } = ctx;
  const p = seq.payload;
  const step = done.participants.find((s) => s.kind === TAVERN_ROUND_KIND);
  if (!step) return undefined;
  const asTest = (r: { roll: number; target: number; sl: number }, base?: number): TestResult => ({
    roll: r.roll, target: r.target, ...(base != null ? { base } : {}),
    // Succès BRUT (roll ≤ target) : la comparaison de manche ne connaît QUE le succès propre au jet —
    // jamais l'issue d'opposition déjà tranchée ailleurs (tie distinct, plafond `drCap` de Boules).
    success: r.roll <= r.target, sl: r.sl, isDouble: false,
  });
  if (step.participants) {
    const mien = step.participants.find((r) => r.id === p.challengerId);
    const sien = step.participants.find((r) => r.id === p.opponentId);
    if (!mien?.result || !sien?.result) return undefined;
    return {
      player: asTest(mien.result, mien.base), opponent: asTest(sien.result, sien.base),
      playerActor: tavernActor(get, p.challengerId), opponentActor: tavernActor(get, p.opponentId),
    };
  }
  if (!step.result) return undefined;
  return {
    player: asTest(step.result, step.base),
    opponent: step.meta?.opposed?.aT ?? rollTavernTest(p.opponentValue, ctx.rng),
    playerActor: actorIn(get(), p.challengerId),
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
 * Les points d'un camp sont l'ACCUMULATEUR du socle (`seq.cum`) — aucun compteur jumeau.
 */
function torchonClose(ctx: SequenceCloseCtx<TavernPayload>): SequenceVerdict<TavernPayload> {
  const { get, seq, done } = ctx;
  const p = seq.payload;
  const band = done.participants.find((s) => s.kind === TAVERN_ROUND_KIND);
  const lanceur = p.throwers?.[seq.round - 1];
  if (!band?.participants || !lanceur) return { go: 'end', outcome: 'tie' };
  const jet = band.participants.find((r) => r.id === lanceur.id);
  const danseur = band.participants.find((r) => r.id.startsWith('danseur-'));
  const cum = { ...seq.cum };
  const log: string[] = [];
  const asTest = (r: BatchParticipant): TestResult => ({
    roll: r.result!.roll, target: r.result!.target, base: r.base,
    success: r.result!.roll <= r.result!.target, sl: r.result!.sl, isDouble: false,
  });
  if (jet?.result && danseur?.result) {
    const opp = resolveOpposed(asTest(jet), asTest(danseur));
    if (opp.attackerWins) {
      const ligne = sequenceTableRow(seq.params, opp.netSL);
      const touche = garanti(ligne, opp.netSL, 'ligne de touche');
      const gain = touche.points;
      cum[lanceur.camp] = (cum[lanceur.camp] ?? 0) + gain;
      log.push(t('tavern.torchonTouche', { who: lanceur.label, ou: touche.label, points: gain, s: gain > 1 ? 's' : '', dr: opp.netSL }));
    } else if (seq.params.throwerPenalty?.lines?.manque) {
      log.push(interpolate(seq.params.throwerPenalty.lines.manque, { who: lanceur.label }));
    }
  }
  // La perte du pot non vidé (l.111) est comptée par l'applier de la sanction, qui la pose dans
  // l'accumulateur : elle est donc DÉJÀ dans `seq.cum` quand la clôture le relit.
  const dernier = seq.round >= (p.throwers?.length ?? 0);
  const marque = (): TavernPayload => ({ ...p, last: { playerSL: cum[CAMP_PLAYER] ?? 0, opponentSL: cum[CAMP_OPPONENT] ?? 0 } });
  if (!dernier) return { go: 'continue', cum, payload: marque(), log };

  // BALAYAGE FINAL (`NADJ 16 l.111`) : le critère porte sur le jet du Tableau d'Ivresse, sans borne
  // de partie — c'est donc l'ÉTAT du personnage qui répond (`isDrunk`, `engine/drunkenness` : un
  // résultat du Tableau a été tiré), y compris pour un lanceur arrivé ivre à la taverne. Un figurant
  // n'a pas de fiche dans la séquence : il n'a jamais bu, il compte — pour les DEUX camps (symétrie). Le PRIX du
  // lanceur trop sobre est DÉCLARÉ ; sans déclaration, aucun balayage.
  const prix = seq.params.throwerPenalty?.sobrietyPoints ?? 0;
  if (prix) {
    const sobres = { [CAMP_PLAYER]: 0, [CAMP_OPPONENT]: 0 };
    for (const lanceurDuBalayage of p.throwers ?? []) {
      const fiche = actorIn(get(), lanceurDuBalayage.id);
      if (!fiche || !isDrunk(fiche)) sobres[lanceurDuBalayage.camp] += 1;
    }
    cum[CAMP_PLAYER] = (cum[CAMP_PLAYER] ?? 0) - sobres[CAMP_PLAYER] * prix;
    cum[CAMP_OPPONENT] = (cum[CAMP_OPPONENT] ?? 0) - sobres[CAMP_OPPONENT] * prix;
    const dit = seq.params.throwerPenalty?.lines?.balayage;
    if (dit) {
      log.push(interpolate(dit, {
        mien: sobres[CAMP_PLAYER], sien: sobres[CAMP_OPPONENT],
        perteMien: sobres[CAMP_PLAYER] * prix, perteSien: sobres[CAMP_OPPONENT] * prix,
      }));
    }
  }
  const mien = cum[CAMP_PLAYER] ?? 0;
  const sien = cum[CAMP_OPPONENT] ?? 0;
  const issue: TavernGameResult['winner'] = mien > sien ? 'player' : sien > mien ? 'opponent' : 'tie';
  return { go: 'end', outcome: issue, cum, payload: marque(), log };
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
 * Les figurants n'ont aucun Combatant : ils comptent dans la somme, jamais dans les ops de manche.
 */
function tavernTeamClose(ctx: SequenceCloseCtx<TavernPayload>, game: TavernGame): SequenceVerdict<TavernPayload> {
  const { seq, done } = ctx;
  const p = seq.payload;
  const band = done.participants.find((s) => s.kind === TAVERN_ROUND_KIND);
  const teams = p.teams;
  if (!band?.participants || !teams) return { go: 'end', outcome: 'tie' };
  const drOf = (ids: readonly string[]): number[] => ids
    .map((id) => band.participants!.find((r) => r.id === id))
    .filter((r): r is BatchParticipant => !!r)
    .map((r) => r.result?.sl ?? 0);
  const total = {
    [CAMP_PLAYER]: sequenceScoreOf(seq.params.score?.[CAMP_PLAYER], drOf(teams.player)),
    [CAMP_OPPONENT]: sequenceScoreOf(seq.params.score?.[CAMP_OPPONENT], drOf(teams.opponent)),
  };
  const tp = total[CAMP_PLAYER];
  const to = total[CAMP_OPPONENT];
  const gagnant: TavernGameResult['winner'] = tp > to ? 'player' : to > tp ? 'opponent' : 'tie';
  const seuil = seq.params.scoreThreshold;
  const but = seuil != null && gagnant !== 'tie' && Math.max(tp, to) >= seuil;
  // LES BUTS sont l'ACCUMULATEUR du socle (`seq.cum`) : un but marqué par le camp qui l'emporte.
  const buts = {
    ...seq.cum,
    [CAMP_PLAYER]: (seq.cum[CAMP_PLAYER] ?? 0) + (but && gagnant === 'player' ? 1 : 0),
    [CAMP_OPPONENT]: (seq.cum[CAMP_OPPONENT] ?? 0) + (but && gagnant === 'opponent' ? 1 : 0),
  };
  const ph = sequencePhaseOf(seq.params, seq.round);
  const heros = new Set(equipiers(ctx.get).map((h) => h.id));
  const vainqueurs = gagnant === 'player' ? teams.player.filter((id) => heros.has(id)) : [];
  const roundActors = { winners: vainqueurs, all: [...teams.player.filter((id) => heros.has(id))] };
  const tour = { jeu: game.label, n: seq.round, mien: tp, sien: to };
  const log = [but
    ? t('tavern.equipeTourBut', { ...tour, qui: gagnant === 'player' ? t('tavern.equipeQui') : p.opponentName })
    : t('tavern.equipeTour', tour)];
  // AVANTAGE « pour le tour suivant » (l.121), SYMÉTRIQUE : les héros le reçoivent en op de manche
  // (le socle), les camps le portent ici pour leurs figurants. Il ne s'accumule pas — c'est +1 pour
  // LE tour suivant, et le camp qui ne gagne pas ce tour retombe à 0.
  const advantage = { player: gagnant === 'player' ? 1 : 0, opponent: gagnant === 'opponent' ? 1 : 0 };
  const payload: TavernPayload = { ...p, advantage, last: { playerSL: tp, opponentSL: to } };
  if (!ph.last) return { go: 'continue', cum: buts, payload, log, roundActors };
  const bp = buts[CAMP_PLAYER] ?? 0;
  const bo = buts[CAMP_OPPONENT] ?? 0;
  const issue: TavernGameResult['winner'] = bp > bo ? 'player' : bo > bp ? 'opponent' : 'tie';
  return { go: 'end', outcome: issue, cum: buts, payload, log, roundActors };
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
 * exemple) est la règle optionnelle `tavern-games-rapides` : active, le catalogue ne rend plus de
 * mise ni de pot (`findTavernGameById`), et la table entière ci-dessous reste au repos.
 * `NADJ 16 l.19` — le « Spécial » (Chance en relance du lancer, Maîtrise des dés) -> #1306.
 */

/** Étape du LANCER d'un tour (table à poser pour un héros tenu par un siège, affichage sinon). */
const TAVERN_POT_KIND = 'tavern-pot-turn';
/** Étape du choix « remettre ou abandonner ». */
const TAVERN_FOLD_KIND = 'tavern-pot-fold';
/** Étape du choix du NOMBRE CIBLE, en ouverture de manche. */
const TAVERN_TARGET_KIND = 'tavern-pot-target';

/** UN JOUEUR assis à la table. `hero` = un Combatant du groupe : sa bourse joue, il peut tenir un
 *  siège. Les autres sont les habitués de la salle, dont la table fixe le nombre. */
export interface TavernSeat {
  id: string;
  label: string;
  hero: boolean;
}

/** Id de la table des plages d'un jeu de MISE — une par entrée qui en déclare : le catalogue est
 *  PARCOURU, aucun jeu n'est nommé au code. */
function potTableId(gameId: string): string {
  return `tavern-pot:${gameId}`;
}

/** Les tables de MISE du catalogue — FAMILLE dérivée de `tavernGames` (#1692) : un jeu ajouté au
 *  Codex a SA table et un jeu retiré n'en a plus, à la première lecture du registre qui suit
 *  l'édition, pour TOUS ses lecteurs — pas seulement pour le site qui ouvre le lancer. */
const tablesDePot = memoParVersion('tavernGames', () => {
  const tables = new Map<string, TableStepDef>();
  for (const jeu of TAVERN_GAMES) {
    const regles = jeu.pot;
    if (!regles) continue;
    tables.set(potTableId(jeu.id), {
      label: jeu.label,
      die: regles.dice.faces,
      rows: regles.rows.map((r) => ({ min: r.min, max: r.max, id: r.potEffectId, label: r.label })),
      // L'ENCART de résultat (ce que le joueur lit juste après « Lancer ») dit l'ISSUE du lancer, pas
      // la fourchette où il tombe : la cible est celle du TOUR, lue à la RÉSOLUTION via le contexte du
      // tirage — jamais figée ici, à l'enregistrement. Même fonction que le journal (`sequencePotIssue`),
      // donc une seule vérité ; sans contexte ni séquence, la fourchette reste le libellé.
      lines: (total, ctx) => {
        const plage = findTableEntry([...regles.rows], total);
        const seq = ctx ? activeSequence<TavernPayload>(ctx.get) : null;
        if (!seq || seq.payload.gameId !== jeu.id) return [plage.label];
        const cible = seq.payload.target ?? regles.targetRange?.min ?? 0;
        const { outcome } = resolveSequencePotTurn(seq.params, potTurnOf(seq.payload, total, cible));
        return [sequencePotIssue(outcome) ?? plage.label];
      },
    });
  }
  return tables;
});

registerTableStepFamily(tablesDePot);

/** La DÉCLARATION de tirage d'un tour : les dés de la donnée, jamais un dé écrit ici. */
function potDecl(game: TavernGame): CascadeTableDecl {
  const dice = game.pot!.dice;
  return { tableId: potTableId(game.id), spec: { n: dice.count, sides: dice.faces } };
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
  return combatStakeRef('tavernGame', {
    values: { jeu: game.label, adversaire: p.opponentName, mise: formatMoney(fromBrass(p.stakeBrass)) },
  });
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
  return mien > 0 ? 'player' : mien < 0 ? 'opponent' : 'tie';
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
    icon: 'nav/dice',
    steps: [displayStep({
      id: `${TAVERN_POT_KIND}-fin-${p.manche ?? 1}`,
      kind: TAVERN_POT_KIND,
      label: t('tavern.potPlusDeJoueurs'),
      icon: 'nav/dice',
      worldOwner: true,
    })],
    immediate: true,
    payload: { ...p, fin: true },
    log,
  };
}

/**
 * OUVERTURE D'UNE MANCHE : « chaque joueur ajoute une mise égale au pot. Le premier joueur choisit
 * alors un nombre cible compris entre 7 et 15 » (l.17) — la mise de chacun entre au pot, puis le
 * premier joueur ENCORE EN JEU choisit la cible (fenêtre s'il tient un siège, tirage sinon).
 *
 * QUORUM D'ABORD, DÉBIT ENSUITE : on constate qui peut suivre AVANT de prendre quoi que ce soit. Une
 * manche qui ne peut pas s'ouvrir ne doit coûter à personne — débiter puis renoncer détruirait la
 * mise de ceux qui avaient payé.
 */
function potOuvreManche(get: Get, seq: SequenceState<TavernPayload>, game: TavernGame, rng: RNG): SequenceRound<TavernPayload> | undefined {
  const p = seq.payload;
  const regles = game.pot!;
  const seats = p.seats ?? [];
  const manche = p.manche ?? 1;
  const ante = p.stakeBrass;
  let net = { ...(p.net ?? {}) };
  const out = seats.filter((s) => !potSolvable(get, net, s, ante)).map((s) => s.id);
  const log = seats.filter((s) => out.includes(s.id)).map((s) => t('tavern.potInsolvable', { who: s.label }));
  const enJeu = seats.filter((s) => !out.includes(s.id));
  if (enJeu.length < 2) return potFin({ ...p, net, out, pot: 0, mises: {} }, [...log, t('tavern.potPlusDeJoueurs')]);
  // MISES par joueur du pot COURANT : ce que chacun y a mis, et donc ce qui lui revient si la partie
  // s'interrompt avant qu'un vainqueur ne le rafle (aucune part n'est inventée, elle est comptée).
  const mises: Record<string, number> = {};
  let pot = 0;
  for (const s of enJeu) {
    pot += ante;
    mises[s.id] = ante;
    net = potMouvement(net, s, -ante);
  }
  log.unshift(t('tavern.potManche', {
    n: manche, mise: formatMoney(fromBrass(ante)), pot: formatMoney(fromBrass(pot)),
  }));
  // Les mises passent au JOURNAL ici, et pas par le `log` de la manche : le socle ne journalise
  // celui-ci que pour une manche résolue d'office (ailleurs, il ne vit que dans la fenêtre). Un
  // mouvement d'argent qui ne laisse aucune trace au journal serait invérifiable pour le joueur.
  for (const ligne of log) get().log(ligne);
  // Le premier joueur d'une manche est celui du rang (chacun ouvre la sienne, l.17) ; s'il n'est pas
  // en jeu, le suivant dans l'ordre du tour ouvre à sa place.
  const depart = (manche - 1) % seats.length;
  const premier = out.includes(seats[depart].id) ? potProchain(seats, depart, out) : depart;
  const joueur = seats[premier];
  const base: TavernPayload = { ...p, net, out, pot, mises, manche, seat: premier };
  const hero = joueur.hero ? actorIn(get(), joueur.id) : undefined;
  const title = t('tavern.potMancheTitre', { jeu: game.label, n: manche });
  // La CIBLE n'existe que si la séquence en déclare la plage : sans elle, aucun nombre n'est annoncé.
  const plage = regles.targetRange;
  if (plage && hero && !cadenceAuto() && jetSurfaced(get(), hero)) {
    const cibles: number[] = [];
    for (let n = plage.min; n <= plage.max; n++) cibles.push(n);
    const etape = choiceStep({
      id: `${TAVERN_TARGET_KIND}-${seq.round}`,
      kind: TAVERN_TARGET_KIND,
      label: t('tavern.potCibleChoix', { who: joueur.label }),
      icon: 'nav/dice',
      actorId: hero.id,
      options: cibles.map((n) => ({ key: String(n), label: dataLabel(String(n)) })),
      defaultChoice: String(plage.min),
    });
    if (etape) return { title, icon: 'nav/dice', steps: [etape], payload: base };
  }
  const tire = plage ? rng.int(plage.min, plage.max) : 0;
  const etape = displayStep({
    id: `${TAVERN_TARGET_KIND}-${seq.round}`,
    kind: TAVERN_TARGET_KIND,
    label: t('tavern.potCible', { who: joueur.label, cible: tire }),
    icon: 'nav/dice',
    ...(hero ? { actorId: hero.id } : { worldOwner: true as const }),
    meta: { cible: tire },
  });
  return { title, icon: 'nav/dice', steps: [etape], immediate: true, payload: base };
}

/**
 * UN TOUR : « À votre tour, lancez 2d10 et totalisez le résultat affiché sur les deux dés » (l.17).
 * Le joueur tenu par un siège POSE son tirage (étape à table, dés déclarés) ; tout autre joueur voit
 * ses dés roulés côté monde et rapportés par une étape d'affichage, sans fenêtre.
 */
function potTour(get: Get, seq: SequenceState<TavernPayload>, game: TavernGame, rng: RNG): SequenceRound<TavernPayload> | undefined {
  const p = seq.payload;
  const joueur = p.seats?.[p.seat ?? 0];
  if (!joueur) return undefined;
  const cible = p.target ?? game.pot!.targetRange?.min ?? 0;
  const title = t('tavern.potTour', { who: joueur.label, cible });
  const decl = potDecl(game);
  const hero = joueur.hero ? actorIn(get(), joueur.id) : undefined;
  if (hero && !cadenceAuto() && jetSurfaced(get(), hero)) {
    const etape = tableStep({
      id: `${TAVERN_POT_KIND}-${seq.round}`,
      kind: TAVERN_POT_KIND,
      label: title,
      icon: 'nav/dice',
      actorId: hero.id,
      table: decl,
      stake: potStake(game, p),
      meta: { gameId: game.id, seat: p.seat ?? 0, cible },
    });
    if (etape) return { title, icon: 'nav/dice', steps: [etape] };
  }
  const tire = rollTableStep(decl, rng, { get });
  const etape = displayStep({
    id: `${TAVERN_POT_KIND}-${seq.round}`,
    kind: TAVERN_POT_KIND,
    label: title,
    icon: 'nav/dice',
    ...(hero ? { actorId: hero.id } : { worldOwner: true as const }),
    meta: { gameId: game.id, seat: p.seat ?? 0, cible, potRoll: tire.roll },
  });
  return { title, icon: 'nav/dice', steps: [etape], immediate: true };
}

/** FABRIQUE DE MANCHE d'un jeu de MISE : ouverture de manche (mises + nombre cible) tant qu'aucune
 *  cible n'est posée, tour du joueur courant ensuite. */
function potRound(get: Get, seq: SequenceState<TavernPayload>, rng: RNG): SequenceRound<TavernPayload> | undefined {
  const game = findTavernGameById(seq.payload.gameId);
  if (!game?.pot || !seq.payload.seats?.length) return undefined;
  return seq.payload.target == null ? potOuvreManche(get, seq, game, rng) : potTour(get, seq, game, rng);
}

/** APPLIER du lancer : la ligne de récit de ce qui est tombé, et — pour un joueur tenu par un siège
 *  dont la plage OFFRE le choix — l'étape « remettre ou abandonner » appendée à la MÊME fenêtre
 *  (patron du choix d'option d'équipe). La décision, elle, est appliquée par la clôture. */
registerCascadeApplier(TAVERN_POT_KIND, (get, set, step) => {
  const seq = activeSequence<TavernPayload>(get);
  const p = seq?.payload;
  const game = p ? findTavernGameById(p.gameId) : undefined;
  if (!seq || !p || !game?.pot) return {};
  const total = potTotalOf(step);
  if (total == null) return {};
  const joueur = p.seats?.[Number(step.meta?.seat ?? p.seat ?? 0)];
  const cible = Number(step.meta?.cible ?? p.target ?? 0);
  const { row, outcome } = resolveSequencePotTurn(seq.params, potTurnOf(p, total, cible));
  const du = outcome.owes ?? p.stakeBrass;
  if (outcome.choose && joueur) {
    const hero = joueur.hero ? actorIn(get(), joueur.id) : undefined;
    if (hero && !cadenceAuto() && jetSurfaced(get(), hero) && potSolvable(get, p.net ?? {}, joueur, du)) {
      const etape = choiceStep({
        id: `${TAVERN_FOLD_KIND}-${seq.round}`,
        kind: TAVERN_FOLD_KIND,
        label: t('tavern.potChoix', { who: joueur.label }),
        icon: 'nav/dice',
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
  const quoi = sequencePotIssue(outcome) ?? garanti(row, total, 'plage du pot').label;
  return { consequences: freeCons([t('tavern.potTotal', { who: garanti(joueur, Number(step.meta?.seat ?? p.seat ?? 0), 'siège du pot').label, total, quoi })]) };
});

/** APPLIERS des deux CHOIX d'un jeu de mise : ils n'appliquent rien — le choix committé est LU par
 *  la clôture, seul juge de la manche (patron du réducteur unique). */
registerCascadeApplier(TAVERN_TARGET_KIND, () => ({}));
registerCascadeApplier(TAVERN_FOLD_KIND, () => ({}));

/**
 * RÉDUCTEUR DE CLÔTURE d'un jeu de MISE : lit le tour clos, applique l'effet de
 * pot DÉCLARÉ par sa plage, puis tient la manche — « La manche continue jusqu'à ce que le pot soit
 * vide, ou jusqu'à ce qu'il n'y ait plus qu'un seul joueur en jeu, qui empoche alors toutes les
 * mises restant dans le pot. » (`NADJ 16 l.17`). La partie s'achève au nombre de manches déclaré.
 */
function potClose(ctx: SequenceCloseCtx<TavernPayload>): SequenceVerdict<TavernPayload> {
  const { get, seq, done } = ctx;
  const p = seq.payload;
  const game = findTavernGameById(p.gameId);
  const regles = game?.pot;
  const seats = p.seats;
  if (!game || !regles || !seats?.length) return { go: 'end', outcome: 'tie' };
  if (p.fin) return { go: 'end', outcome: potIssue(p) };

  const cibleStep = done.participants.find((s) => s.kind === TAVERN_TARGET_KIND);
  if (cibleStep) {
    const choisie = Number(cibleStep.chosen ?? cibleStep.meta?.cible ?? regles.targetRange?.min ?? 0);
    const joueur = seats[p.seat ?? 0];
    return {
      go: 'continue',
      payload: { ...p, target: choisie },
      log: [t('tavern.potCible', { who: garanti(joueur, p.seat ?? 0, 'siège du pot').label, cible: choisie })],
    };
  }

  const tour = done.participants.find((s) => s.kind === TAVERN_POT_KIND);
  const total = tour ? potTotalOf(tour) : null;
  const joueur = seats[p.seat ?? 0];
  if (total == null || !joueur) return { go: 'end', outcome: potIssue(p) };

  let pot = p.pot ?? 0;
  let net = { ...(p.net ?? {}) };
  const mises = { ...(p.mises ?? {}) };
  const out = [...(p.out ?? [])];
  let cible = p.target ?? regles.targetRange?.min ?? 0;
  const log: string[] = [];
  const { outcome } = resolveSequencePotTurn(seq.params, potTurnOf(p, total, cible));
  let gagnant: TavernSeat | undefined = outcome.wins ? joueur : undefined;
  if (outcome.takes) {
    pot -= outcome.takes;
    mises[joueur.id] = Math.max(0, (mises[joueur.id] ?? 0) - outcome.takes);
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
    const choix = done.participants.find((s) => s.kind === TAVERN_FOLD_KIND)?.chosen;
    // Ce que coûte le maintien dans la manche est PARAMÉTRÉ par la plage (`owes`), jamais supposé.
    const du = outcome.owes ?? p.stakeBrass;
    const peut = potSolvable(get, net, joueur, du);
    const remet = peut && (choix == null || choix === 'remise');
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

  const enJeu = seats.filter((s) => !out.includes(s.id));
  if (!gagnant && enJeu.length === 1) gagnant = enJeu[0];
  if (gagnant && pot > 0) {
    net = potMouvement(net, gagnant, pot);
    log.push(t('tavern.potRafle', { who: gagnant.label, montant: formatMoney(fromBrass(pot)) }));
    pot = 0;
  }
  const gains = gagnant
    ? { ...(p.gains ?? {}), [gagnant.id]: (p.gains?.[gagnant.id] ?? 0) + 1 }
    : (p.gains ?? {});
  if (!gagnant && pot <= 0) log.push(t('tavern.potVide'));
  if (!gagnant && pot > 0) {
    const suivant = potProchain(seats, p.seat ?? 0, out);
    return { go: 'continue', payload: { ...p, pot, net, mises, out, target: cible, seat: suivant }, log };
  }
  const manche = (p.manche ?? 1) + 1;
  const suite: TavernPayload = { ...p, pot: 0, net, mises: {}, out: [], gains, target: null, manche, seat: 0 };
  if (manche > potManches(game, p)) return { go: 'end', outcome: potIssue(suite), payload: suite, log };
  return { go: 'continue', payload: suite, log };
}

/**
 * DÉNOUEMENT d'un jeu de MISE : les mouvements de la partie passent aux bourses — un gain crédite,
 * une perte débite, et rien ne bouge pour qui n'a ni gagné ni perdu.
 *
 * PARTIE INTERROMPUE (issue réservée du socle : l'anti-boucle a coupé) : le pot EN VOL n'a pas de
 * vainqueur, et il n'est pas à la maison — chacun reprend EXACTEMENT ce qu'il y avait mis
 * (`p.mises`), et le journal le dit. Le solde du challenger décide alors de l'issue affichée : une
 * bourse qui a bougé ne se raconte jamais « Égalité ».
 */
function potSettle(get: Get, set: Set, game: TavernGame, challenger: Combatant, p: TavernPayload, outcome: string): void {
  const rendu = { ...(p.net ?? {}) };
  const seats = p.seats ?? [];
  if ((p.pot ?? 0) > 0) {
    for (const [id, montant] of Object.entries(p.mises ?? {})) {
      const seat = seats.find((s) => s.id === id);
      if (seat && montant > 0) Object.assign(rendu, potMouvement(rendu, seat, montant));
    }
    get().log(t('tavern.potRendu', { montant: formatMoney(fromBrass(p.pot ?? 0)) }));
  }
  const solde = { ...p, net: rendu };
  const winner: TavernGameResult['winner'] = outcome === 'player' || outcome === 'opponent'
    ? outcome
    : potIssue(solde);
  for (const [heroId, montant] of Object.entries(rendu)) {
    if (montant > 0) creditBourse(get, set, heroId, fromBrass(montant));
    else if (montant < 0) payWithAllocation(get, set, { debits: soloPayer(heroId, fromBrass(-montant)), purpose: 'jeu de taverne' });
  }
  const mien = rendu[p.challengerId] ?? 0;
  const manches = Math.max(1, (p.manche ?? 1) - 1);
  const detail = t('tavern.potFinal', { manches, mise: formatMoney(fromBrass(p.stakeBrass)) });
  finalizeTavernGame(get, set, game, challenger, p.opponentName, winner,
    p.gains?.[p.challengerId] ?? 0, 0, manches, p.stakeBrass, detail,
    { netBrass: mien, verse: false, detail });
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
    round: p.manche ?? 1,
    rounds: potManches(game, p),
  };
}

/**
 * RÉDUCTEUR DE CLÔTURE (socle) — LE SEUL juge d'une manche, quel que soit son montage :
 *  1. DR de manche de chaque camp = DR du jet (plafonné `drCap`) + Bonus de Caractéristique DÉCLARÉ
 *     (Bras de fer l.34 : « à chaque tour, ajoutez votre Bonus de Force au nombre de DR ») ;
 *  2. vainqueur de la manche par `resolveTavernRound`, égalité DÉPARTAGÉE par le paramètre déclaré
 *     (Dominos l.107) ;
 *  3. sans cible de cumul : la partie s'achève sur cette manche (variante rapide, l.11) ;
 *  4. avec cible : CUMUL par le socle (`sequenceCumRound` → `extendedTestStep`, LDB 12 l.174 — le DR
 *     du Round s'ajoute AVEC SON SIGNE, seul le TOTAL est planché à 0) jusqu'à `target`.
 * Ne mute rien : les effets de manche déclarés (famille 4) sont DÉCLENCHÉS par le socle sur les
 * porteurs que le verdict nomme.
 */
function tavernClose(ctx: SequenceCloseCtx<TavernPayload>): SequenceVerdict<TavernPayload> {
  const { seq } = ctx;
  const p = seq.payload;
  const game = findTavernGameById(p.gameId);
  if (game?.roundShape === 'thrower') return torchonClose(ctx);
  if (game?.roundShape === 'team') return tavernTeamClose(ctx, game);
  if (game?.roundShape === 'pot') return potClose(ctx);
  if (game?.roundShape === 'volley') return volleyClose(ctx);
  // CHOIX d'option d'une manche ORDINAIRE : la décision se pose, le jet suivra (l.25).
  const choix = ctx.done.participants.filter((s) => s.kind === TAVERN_CHOICE_KIND);
  if (game && choix.length && game.roundShape !== 'team') {
    const retenu = Object.fromEntries(choix.map((s) => [s.actorId ?? '', Number(s.chosen ?? 0)]));
    return { go: 'continue', payload: { ...p, choices: { ...(p.choices ?? {}), ...retenu } } };
  }
  if (game?.sides?.length) return sidesClose(ctx, game);
  if (game?.combined) return combinedClose(ctx, game);
  const sides = tavernSides(ctx);
  if (!game || !sides) return { go: 'end', outcome: 'tie' };

  const bonusPlayer = sequenceDrBonus(seq.params, sides.playerActor);
  const bonusOpponent = sequenceDrBonus(seq.params, sides.opponentActor, p.opponentValue);
  const { winner, playerSL, opponentSL } = resolveTavernRound(game, sides.player, sides.opponent, {
    player: bonusPlayer, opponent: bonusOpponent,
  });
  const departage = winner === 'tie'
    ? resolveSequenceTie(seq.params.tieBreak, { roll: sides.player.roll, sl: playerSL }, { roll: sides.opponent.roll, sl: opponentSL })
    : 'tie';
  const manche: TavernGameResult['winner'] = winner !== 'tie'
    ? winner
    : departage === 'a' ? 'player' : departage === 'b' ? 'opponent' : 'tie';

  // PORTEURS des effets de manche (famille 4) : le vainqueur de la manche (Bras de fer l.34, +1
  // Avantage), et tous les participants pour l'attrition d'intervalle (l.35, +1 Exténué).
  const all = [p.challengerId, ...(p.opponentId ? [p.opponentId] : [])];
  const gagnantId = manche === 'player' ? p.challengerId : manche === 'opponent' ? p.opponentId : undefined;
  const roundActors = { ...(gagnantId ? { winners: [gagnantId] } : {}), all };

  if (seq.params.target == null) {
    return { go: 'end', outcome: manche, payload: { ...p, last: { playerSL, opponentSL } }, roundActors };
  }

  const { cum, done } = sequenceCumRound(seq, {
    [CAMP_PLAYER]: { success: sides.player.success, sl: playerSL },
    [CAMP_OPPONENT]: { success: sides.opponent.success, sl: opponentSL },
  });
  if (!done.length) return { go: 'continue', cum, payload: { ...p, last: { playerSL, opponentSL } }, roundActors };
  const cp = cum[CAMP_PLAYER] ?? 0;
  const co = cum[CAMP_OPPONENT] ?? 0;
  const issue: TavernGameResult['winner'] = cp > co ? 'player' : co > cp ? 'opponent' : 'tie';
  return { go: 'end', outcome: issue, cum, payload: { ...p, last: { playerSL: cp, opponentSL: co } }, roundActors };
}

/** DÉNOUEMENT (socle) : mise, modale de résultat, journal. */
function tavernSettle(get: Get, set: Set, seq: SequenceState<TavernPayload>, outcome: string): void {
  const p = seq.payload;
  const { game, challenger } = partieEnCours(get, p, 'dénouement de taverne');
  const winner: TavernGameResult['winner'] = outcome === 'player' || outcome === 'opponent' ? outcome : 'tie';
  const rounds = Math.max(1, seq.round);
  // JEU DE MISE : ce qui se solde, ce sont les BOURSES (l.17) — chaque joueur repart avec ce que ses
  // manches lui ont laissé, jamais avec un écart de DR.
  if (game.roundShape === 'pot') {
    potSettle(get, set, game, challenger, p, outcome);
    return;
  }
  // TORCHON (l.111) : ce qui se compte, ce sont les POINTS d'équipe — jamais des DR ni des buts.
  if (game.roundShape === 'thrower') {
    const mien = seq.cum[CAMP_PLAYER] ?? 0;
    const sien = seq.cum[CAMP_OPPONENT] ?? 0;
    finalizeTavernGame(get, set, game, challenger, p.opponentName, winner, mien, sien, rounds, 0,
      t('tavern.torchonFinal', { mien, sien, lancers: rounds }), { netBrass: 0, verse: false });
    return;
  }
  // JEU D'ÉQUIPE : ce qui se dit à la fin, ce sont les BUTS (l.121) — la somme de DR n'était que le
  // moyen de les marquer. Le score affiché est donc le compte de buts de chaque camp.
  if (game.roundShape === 'team') {
    const mien = seq.cum[CAMP_PLAYER] ?? 0;
    const sien = seq.cum[CAMP_OPPONENT] ?? 0;
    finalizeTavernGame(get, set, game, challenger, p.opponentName, winner, mien, sien, rounds, 0,
      `${game.label} : ${mien} but${mien > 1 ? 's' : ''} contre ${sien} en ${rounds} tour${rounds > 1 ? 's' : ''}.`,
      { netBrass: 0, verse: false });
    return;
  }
  // VOLÉE : ce qui se compte, ce sont les points acquis par les lancers (l.42, l.57, l.65, l.83).
  // CAMPS ASYMÉTRIQUES : ce sont les PIÈCES prises à l'autre camp (l.27-28).
  const playerSL = p.last?.playerSL ?? 0;
  const opponentSL = p.last?.opponentSL ?? 0;
  if (game.combined) {
    const mien = seq.cum[CAMP_PLAYER] ?? 0;
    const sien = seq.cum[CAMP_OPPONENT] ?? 0;
    const tours = Math.max(1, (p.combined?.tour ?? 1) - 1);
    const ligne = t('tavern.cerevisFinal', { mien, sien, tours });
    finalizeTavernGame(get, set, game, challenger, p.opponentName, winner, mien, sien, tours, 0,
      ligne, { netBrass: 0, verse: false, detail: ligne });
    return;
  }
  if (game.roundShape === 'volley' || game.sides?.length) {
    // MANCHES ANNONCÉES = celles que le tableau de marque a montrées (« Manche 1/1 »), jamais les
    // tours internes de séquence : un lancer n'est pas une manche, et deux unités de narration pour
    // une seule partie, c'est une de trop.
    const manches = Math.max(1, (p.volley?.manche ?? 1) - (game.roundShape === 'volley' ? 1 : 0));
    const tours = game.sides?.length ? Math.max(1, rounds - 1) : manches;
    const unite = game.scoreUnit ?? 'DR';
    const ligne = game.sides?.length
      ? t('tavern.sideFinal', { mien: playerSL, sien: opponentSL, tours, unite })
      : t('tavern.volleyFinal', { mien: playerSL, sien: opponentSL, manches, unite });
    finalizeTavernGame(get, set, game, challenger, p.opponentName, winner, playerSL, opponentSL, tours, 0,
      ligne, { netBrass: 0, verse: false, detail: ligne });
    return;
  }
  const log = seq.params.target != null
    ? tavernExtendedLog(game, playerSL, opponentSL, rounds)
    : tavernOpposedLog(game, playerSL, opponentSL, winner);
  finalizeTavernGame(get, set, game, challenger, p.opponentName, winner, playerSL, opponentSL, rounds, p.stakeBrass, log,
    { netBrass: tavernNetBrass(winner, p.stakeBrass), verse: true });
}

/** TABLEAU DE MARQUE d'une partie EN COURS (affichage) : score par camp, cible, manche, phase. Une
 *  partie à manche UNIQUE sans cible n'a rien à montrer avant son verdict — pas de tableau.
 *  JEU D'ÉQUIPE : le score d'un camp est son compte de BUTS (l.121), et la note porte la SOMME de DR
 *  du dernier tour — c'est elle qui décide le but, elle se lit donc à côté. */
function tavernBoard(get: Get, seq: SequenceState<TavernPayload>): SequenceBoard | undefined {
  const p = seq.payload;
  const { game, challenger } = partieEnCours(get, p, 'tableau de taverne');
  const ph = sequencePhaseOf(seq.params, seq.round);
  const phase = ph.total > 0 ? { rounds: ph.total, phase: stepFraction(ph.phase, ph.count) } : {};
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
      round: st?.manche ?? 1,
      ...(v.manches != null ? { rounds: v.manches } : {}),
      ...(game.scoreUnit ? { unit: dataLabel(game.scoreUnit) } : {}),
    };
  }
  // TEST COMBINÉ : le score d'un camp est son compte de MARQUES (l.97) — le PLUS BAS l'emporte, la
  // jauge n'a donc pas de cible.
  if (game.combined) {
    return {
      title: dataLabel(game.label),
      camps: [
        { id: CAMP_PLAYER, label: dataLabel(challenger.label), score: seq.cum[CAMP_PLAYER] ?? 0, note: t('tavern.cerevisNote') },
        { id: CAMP_OPPONENT, label: dataLabel(p.opponentName), score: seq.cum[CAMP_OPPONENT] ?? 0 },
      ],
      round: p.combined?.tour ?? 1,
      ...(game.combined.tours != null ? { rounds: game.combined.tours } : {}),
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
        { id: CAMP_PLAYER, label: stepPrecision(dataLabel(challenger.label), dataLabel(camps.mien.label)), score: seq.cum[CAMP_PLAYER] ?? 0, target: Math.floor(camps.sien.pieces / 2) + 1 },
        { id: CAMP_OPPONENT, label: stepPrecision(dataLabel(p.opponentName), dataLabel(camps.sien.label)), score: seq.cum[CAMP_OPPONENT] ?? 0, target: Math.floor(camps.mien.pieces / 2) + 1 },
      ],
      round: seq.round,
      ...(game.scoreUnit ? { unit: dataLabel(game.scoreUnit) } : {}),
    };
  }
  // TORCHON : le score d'un camp EST son total de points (l.111) — aucun cumul, aucune cible.
  if (game.roundShape === 'thrower') {
    return {
      title: dataLabel(game.label),
      camps: [
        { id: CAMP_PLAYER, label: t('tavern.campMien'), score: seq.cum[CAMP_PLAYER] ?? 0 },
        { id: CAMP_OPPONENT, label: dataLabel(p.opponentName), score: seq.cum[CAMP_OPPONENT] ?? 0 },
      ],
      round: seq.round,
      ...(p.throwers?.length ? { rounds: p.throwers.length } : {}),
    };
  }
  if (game.roundShape === 'team') {
    const somme = (n: number | undefined): PlayerText => t('tavern.sommeTour', { n: n ?? 0 });
    return {
      title: dataLabel(game.label),
      camps: [
        { id: CAMP_PLAYER, label: t('tavern.campMien'), score: seq.cum[CAMP_PLAYER] ?? 0, note: somme(p.last?.playerSL) },
        { id: CAMP_OPPONENT, label: dataLabel(p.opponentName), score: seq.cum[CAMP_OPPONENT] ?? 0, note: somme(p.last?.opponentSL) },
      ],
      round: seq.round,
      ...phase,
    };
  }
  if (seq.params.target == null && ph.total === 0) return undefined;
  return {
    title: dataLabel(game.label),
    camps: [
      { id: CAMP_PLAYER, label: dataLabel(challenger.label), score: seq.cum[CAMP_PLAYER] ?? 0, ...(seq.params.target != null ? { target: seq.params.target } : {}) },
      { id: CAMP_OPPONENT, label: dataLabel(p.opponentName), score: seq.cum[CAMP_OPPONENT] ?? 0, ...(seq.params.target != null ? { target: seq.params.target } : {}) },
    ],
    round: seq.round,
    ...phase,
  };
}

/* ── LA VOLÉE : un PASSAGE de lancers en nombre fixe (famille 7 du socle) ────────────────────────
 * `NADJ 16 l.42` (trois coups, les quilles ÉCRÊTÉES à ce qu'il en reste), `l.70` (cinq lancers, la
 * cible CHOISIE avant chacun), `l.83` (trois fléchettes, un total EXACT), `l.57` (trois boules, la
 * meilleure compte). Un tour de séquence = UN lancer d'UN lanceur : c'est la seule granularité qui
 * tienne, parce que la Difficulté du lancer suivant dépend de ce que celui-ci a produit (l.42) et
 * qu'un dépassement coupe le passage en cours de route (l.83).
 *
 * CE QUI VIT ICI : les deux lanceurs, l'ordre, les passages, le tableau de marque. CE QUI VIT AU
 * SOCLE : ce que RAPPORTE un lancer (effets ENREGISTRÉS, `resolveSequenceThrow`), ce qu'un gain
 * DEVIENT face à une cible exacte (`sequenceThrowGain`), la ligne que désigne la réserve
 * (`sequenceThrowRow`), et la formule de score d'un camp (famille 3, `sequenceScoreOf`).
 *
 * `NADJ 16 l.57` — l'ÉCARTAGE des boules adverses (« vous pouvez réduire le nombre de DR de cette
 * boule de –1 par DR que vous dépensez ») et la variante en points sur trois manches ne sont pas
 * joués : ils demandent une dépense de DR ciblée sur la boule d'autrui, mécanisme qu'aucune famille
 * ne porte encore -> #1279 (lot Sf).
 * `NADJ 16 l.82` / `l.99` — les « Spécial » (Tireur d'élite : d'un cran plus facile ; ±1 au dé des
 * unités) -> #1306, avec les Points de Chance de l'Al-zahr.
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
const TAVERN_THROW_KIND = 'tavern-throw';
/** Kind de l'étape de CHOIX de la ligne visée (`pick: 'choix'`). */
const TAVERN_AIM_KIND = 'tavern-throw-aim';
/** Kind de l'étape de CHOIX du gain, quand l'effet du lancer en offre plusieurs. */
const TAVERN_GAIN_KIND = 'tavern-throw-gain';
/** Kind de l'étape de CHOIX du camp mené par le challenger (famille 8). */
const TAVERN_SIDE_KIND = 'tavern-side';

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
  const mien = { id: p.challengerId, label: actorIn(get(), p.challengerId)?.label ?? p.challengerId, camp: 'player' as const };
  const sien = {
    id: p.opponentId ?? 'salle', label: p.opponentName, camp: 'opponent' as const,
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
  const p = seq.payload;
  return (seq.cum[camp] ?? 0) + sequenceScoreOf(seq.params.score?.[camp], p.volley?.gains?.[camp] ?? []);
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
  const p = seq.payload;
  const v = seq.params.volley;
  const st = p.volley;
  const jet = step.participants?.[0];
  if (!v || !st || !jet?.result) return undefined;
  const camp = step.meta?.camp === CAMP_OPPONENT ? CAMP_OPPONENT : CAMP_PLAYER;
  const acteur = actorIn(get(), jet.id);
  const tr: TestResult = {
    roll: jet.result.roll, target: jet.result.target, sl: jet.result.sl,
    success: jet.result.roll <= jet.result.target, isDouble: isDoubleRoll(jet.result.roll),
    ...(jet.base != null ? { base: jet.base } : {}),
  };
  const turn: SequenceThrowTurn = {
    roll: tr.roll,
    // Le DR du lancer, plafond de manche et Bonus de Caractéristique compris (l.42 : « ajoutez votre
    // Bonus de Capacité de Tir au nombre de DR obtenus ») — l'effet ne voit que ce total.
    sl: roundSL(tr, seq.params.drCap) + sequenceDrBonus(seq.params, acteur, p.opponentValue),
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
  const p = seq.payload;
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
  const stake = combatStakeRef('tavernGame', { values: { jeu: game.label, adversaire: p.opponentName, mise: 'aucune' } });

  // 1) LA LIGNE VISÉE : « avant de lancer un anneau, choisissez une cible » (l.65) — la décision
  //    précède le jet, dont elle règle la Difficulté ET les points.
  if (v.pick === 'choix' && st.row == null) {
    const lignes = v.rows ?? [];
    if (!lignes.length) return undefined;
    const id = `${TAVERN_AIM_KIND}-${seq.round}`;
    if (heros && surface) {
      const etape = choiceStep({
        id, kind: TAVERN_AIM_KIND, icon: 'nav/dice',
        label: t('tavern.volleyViseChoix', { who: lanceur.label }),
        actorId: heros.id,
        // Le `detail` d'une option ne descend qu'en attribut `title` (`OptionChooser`) : muet au
        // doigt comme au lecteur d'écran. Ce qui DÉCIDE du choix — les points et la Difficulté —
        // entre donc dans le LIBELLÉ visible.
        options: lignes.map((r, i) => ({
          key: String(i),
          label: t('tavern.volleyViseOption', {
            cible: r.label, points: r.points ?? 0,
            difficulte: DIFFICULTY_LABELS[r.difficulty ?? TAVERN_TEST_DIFFICULTY],
          }),
        })),
        defaultChoice: '0',
      });
      if (etape) return { title: titre, icon: 'nav/dice', steps: [etape], payload: base };
    }
    // POLITIQUE des lanceurs qu'aucun siège ne tient : la PREMIÈRE ligne déclarée (patron `optionOf`).
    const etape = displayStep({
      id, kind: TAVERN_AIM_KIND, icon: 'nav/dice',
      label: t('tavern.volleyVise', { who: lanceur.label, cible: lignes[0].label }),
      ...(heros ? { actorId: heros.id } : { worldOwner: true as const }),
      meta: { row: 0 },
    });
    return { title: titre, icon: 'nav/dice', steps: [etape], immediate: true, payload: base };
  }

  // 2) LE LANCER — monté par les monteurs CANONIQUES : sur la FICHE d'un héros, en valeur de table
  //    pour un habitué de la salle, dont la fiche (`pnjAuProfil`) ne suit pas la séquence : sa valeur en est dérivée à l'ouverture (`opponentValue`).
  const ligne = volleyRow(v, st);
  const difficulty = ligne.row?.difficulty ?? TAVERN_TEST_DIFFICULTY;
  const test = tavernTestSpec(game);
  const rowJet: BatchParticipant = heros
    ? {
      id: lanceur.id, label: testSkillLabel(test) ?? game.label, ...(test.skill ? { skillId: test.skill } : {}),
      difficulty, result: null, interactive: true,
      ...rollStep({ actor: heros, test, difficulty }),
    }
    : figurantRow(lanceur.id, lanceur.label, lanceur.value ?? p.opponentValue, { ...enOption(test), difficulty }, 0);
  const rows: BatchParticipant[] = [
    surface ? rowJet : { ...rowJet, interactive: false, result: rowJet.result ?? rollBatchParticipant(rowJet, rng) },
  ];
  const band = bandStep({
    id: `${TAVERN_THROW_KIND}-${seq.round}`,
    kind: TAVERN_THROW_KIND,
    icon: 'nav/dice',
    label: ligne.row
      ? t('tavern.volleyLancerVise', { jeu: game.label, cible: ligne.row.label })
      : t('tavern.volleyLancer', { jeu: game.label, n: st.jet, total: v.throws }),
    stake,
    meta: { gameId: game.id, opponentName: p.opponentName, stakeBrass: 0, round: seq.round, camp: lanceur.camp },
  }, rows);
  if (!band) return undefined;
  return { title: titre, icon: 'nav/dice', steps: [band], immediate: !surface, payload: base };
}

/** APPLIER du lancer : la ligne de récit de ce qui est tombé, et — quand le RAW laisse le gain au
 *  lanceur — l'étape de décision appendée à la MÊME fenêtre (patron du choix d'option d'équipe). Deux
 *  formes, parce que le RAW en donne deux : un CHOIX entre des valeurs nommées (« 2, 6, 20 ou 60 »,
 *  l.83) et une SAISIE dans une plage (« autant de points que vous le souhaitez, entre 1 et 100 »,
 *  l.83 — interaction `'quantite'` de la coquille). La décision, elle, est appliquée par la clôture,
 *  seul juge du tour. */
registerCascadeApplier(TAVERN_THROW_KIND, (get, set, step) => {
  const seq = activeSequence<TavernPayload>(get);
  if (!seq) return {};
  const lu = volleyTurnOf(get, seq, step);
  const jet = step.participants?.[0];
  if (!lu || !jet) return {};
  const heros = actorIn(get(), jet.id);
  const qui = heros?.label ?? jet.label ?? jet.id;
  const tranche = heros && !cadenceAuto() && jetSurfaced(get(), heros);
  const id = `${TAVERN_GAIN_KIND}-${seq.round}`;
  const libre = lu.outcome.libre;
  if (libre && tranche) {
    const etape = quantityStep({
      id, kind: TAVERN_GAIN_KIND, icon: 'nav/dice',
      label: t('tavern.volleyGainChoix', { who: qui }),
      actorId: heros!.id,
      min: libre.min, max: libre.max, unit: t('tavern.volleyUnitePoints'),
      value: volleyPolitiqueLibre(seq.params.volley!, lu.turn, libre),
    });
    if (etape) pushStep(set, etape, SEQUENCE_PURPOSE);
  } else if (lu.outcome.choix?.length && tranche) {
    const etape = choiceStep({
      id, kind: TAVERN_GAIN_KIND, icon: 'nav/dice',
      label: t('tavern.volleyGainChoix', { who: qui }),
      actorId: heros!.id,
      options: lu.outcome.choix.map((n) => ({ key: String(n), label: t('tavern.volleyPoints', { n }) })),
      defaultChoice: String(volleyPolitique(seq.params.volley!, lu.turn, lu.outcome.choix)),
    });
    if (etape) pushStep(set, etape, SEQUENCE_PURPOSE);
  }
  return { consequences: freeCons([t('tavern.volleyJet', { who: qui, dr: lu.turn.sl })]) };
});

/** APPLIERS des CHOIX d'une volée (ligne visée, gain) et du camp mené : ils n'appliquent rien — le
 *  choix committé est LU par la clôture, seul juge (patron du réducteur unique). */
registerCascadeApplier(TAVERN_AIM_KIND, () => ({}));
registerCascadeApplier(TAVERN_GAIN_KIND, () => ({}));
registerCascadeApplier(TAVERN_SIDE_KIND, () => ({}));

/** ISSUE d'une volée : le camp au plus haut score ; à ÉGALITÉ, le départage DÉCLARÉ tranche (famille
 *  1bis du socle, `resolveSequenceTie`) — jamais une égalité recodée ici. Boules déclare `nul`
 *  (« en cas d'égalité, la partie se solde par un match nul », l.57) ; un jeu de lancers N+1 qui
 *  déclarerait un autre départage serait donc SERVI, pas ignoré. Une volée n'oppose pas deux jets
 *  mais deux SCORES : ce sont eux qui sont soumis au départage. */
function volleyIssue(params: SequenceParams, mien: number, sien: number): TavernGameResult['winner'] {
  if (mien > sien) return 'player';
  if (sien > mien) return 'opponent';
  const departage = resolveSequenceTie(params.tieBreak, { roll: 0, sl: mien }, { roll: 0, sl: sien });
  return departage === 'a' ? 'player' : departage === 'b' ? 'opponent' : 'tie';
}

/**
 * RÉDUCTEUR DE CLÔTURE d'un tour de VOLÉE : lit le lancer clos, applique l'effet DÉCLARÉ de sa forme,
 * puis fait avancer le passage — lancer suivant, lanceur suivant, manche suivante. La partie s'achève
 * sur la cible EXACTE atteinte (l.83) ou au bout des passages déclarés (l.57, l.65).
 */
function volleyClose(ctx: SequenceCloseCtx<TavernPayload>): SequenceVerdict<TavernPayload> {
  const { get, seq, done } = ctx;
  const p = seq.payload;
  const v = seq.params.volley;
  const st = p.volley;
  if (!v || !st) return { go: 'end', outcome: 'tie' };
  const qui = garanti(p.throwers?.[st.seat], st.seat, 'lanceur de volée').label;

  // 1) LA LIGNE VISÉE se pose ; le lancer suivra (sa Difficulté en dépend).
  const vise = done.participants.find((s) => s.kind === TAVERN_AIM_KIND);
  if (vise) {
    const i = Number(vise.chosen ?? vise.meta?.row ?? 0);
    const ligne = v.rows?.[i];
    return {
      go: 'continue',
      payload: { ...p, volley: { ...st, row: i } },
      log: ligne ? [t('tavern.volleyVise', { who: qui, cible: ligne.label })] : [],
    };
  }

  const band = done.participants.find((s) => s.kind === TAVERN_THROW_KIND);
  const lu = band ? volleyTurnOf(get, seq, band) : undefined;
  if (!lu) return { go: 'end', outcome: volleyIssue(seq.params, volleyScore(seq, CAMP_PLAYER), volleyScore(seq, CAMP_OPPONENT)) };

  // 2) LE GAIN : celui que le lanceur a tranché quand le RAW le lui laisse — une valeur ÉLUE parmi
  //    celles que le dé offre (`chosen`) ou un nombre SAISI dans la plage libre (`amount`) — celui de
  //    sa politique sinon ; puis ce que ce gain DEVIENT face à la cible exacte (socle, famille 7).
  const decision = done.participants.find((s) => s.kind === TAVERN_GAIN_KIND);
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
  // FIN DU PASSAGE : ses lancers sont épuisés, le dépassement l'a coupé (l.83 : « votre tour est
  // terminé »), ou il ne reste plus rien à prendre.
  const finPassage = !!fin.ends || st.jet >= v.throws || (reserve != null && reserve <= 0);
  let apres: TavernVolleyState = finPassage
    ? { seat: st.seat + 1, jet: 1, manche: st.manche, gains, ...(v.reserve != null ? { reserve: v.reserve } : {}) }
    : { seat: st.seat, jet: st.jet + 1, manche: st.manche, gains, ...(reserve != null ? { reserve } : {}) };

  let cum = { ...seq.cum };
  if (apres.seat >= (p.throwers?.length ?? 2)) {
    // MANCHE CLOSE : la formule de camp DÉCLARÉE (famille 3) réduit les gains du passage en score
    // acquis — somme pour qui compte ses points, meilleur lancer pour qui ne garde que sa boule.
    cum = {
      ...cum,
      [CAMP_PLAYER]: (cum[CAMP_PLAYER] ?? 0) + sequenceScoreOf(seq.params.score?.[CAMP_PLAYER], apres.gains[CAMP_PLAYER] ?? []),
      [CAMP_OPPONENT]: (cum[CAMP_OPPONENT] ?? 0) + sequenceScoreOf(seq.params.score?.[CAMP_OPPONENT], apres.gains[CAMP_OPPONENT] ?? []),
    };
    apres = { seat: 0, jet: 1, manche: st.manche + 1, gains: {}, ...(v.reserve != null ? { reserve: v.reserve } : {}) };
  }

  const suite: TavernPayload = { ...p, volley: apres };
  const etat = { ...seq, cum, payload: suite } as SequenceState<TavernPayload>;
  const mien = volleyScore(etat, CAMP_PLAYER);
  const sien = volleyScore(etat, CAMP_OPPONENT);
  const payload: TavernPayload = { ...suite, last: { playerSL: mien, opponentSL: sien } };
  // CIBLE EXACTE (l.83) : le camp qui la touche conclut — un seul lancer tombe à la fois.
  if (v.exact != null && (mien === v.exact || sien === v.exact)) {
    return { go: 'end', outcome: mien === v.exact ? 'player' : 'opponent', cum, payload, log };
  }
  if (v.manches != null && apres.manche > v.manches) {
    return { go: 'end', outcome: volleyIssue(seq.params, mien, sien), cum, payload, log };
  }
  return { go: 'continue', cum, payload, log };
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
  const challenger = actorIn(get(), seq.payload.challengerId);
  if (!challenger || !sides.length) return undefined;
  const id = `${TAVERN_SIDE_KIND}-${seq.round}`;
  const titre = t('tavern.sideTitre', { jeu: game.label });
  if (!cadenceAuto() && jetSurfaced(get(), challenger)) {
    const etape = choiceStep({
      id, kind: TAVERN_SIDE_KIND, icon: 'nav/dice',
      label: t('tavern.sideChoix', { who: challenger.label }),
      actorId: challenger.id,
      options: sides.map((s) => ({ key: s.id, label: dataLabel(s.label), detail: t('tavern.sidePieces', { pieces: s.pieces }) })),
      defaultChoice: sides[0].id,
    });
    if (etape) return { title: titre, icon: 'nav/dice', steps: [etape] };
  }
  const tire = sides[rng.int(1, sides.length) - 1];
  const etape = displayStep({
    id, kind: TAVERN_SIDE_KIND, icon: 'nav/dice',
    label: t('tavern.side', { who: challenger.label, camp: tire.label }),
    actorId: challenger.id,
    meta: { side: tire.id },
  });
  return { title: titre, icon: 'nav/dice', steps: [etape], immediate: true };
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
  const { seq, done } = ctx;
  const p = seq.payload;
  const camps = sidesOf(game, p);
  if (!camps) return { go: 'end', outcome: 'tie' };
  const choix = done.participants.find((s) => s.kind === TAVERN_SIDE_KIND);
  if (choix) {
    const id = String(choix.chosen ?? choix.meta?.side ?? camps.mien.id);
    const elu = (game.sides ?? []).find((s) => s.id === id) ?? camps.mien;
    return {
      go: 'continue',
      payload: { ...p, side: elu.id },
      log: [t('tavern.side', { who: garanti(actorIn(ctx.get(), p.challengerId), p.challengerId, 'choix de camp').label, camp: elu.label })],
    };
  }
  const jets = tavernSides(ctx);
  if (!jets) return { go: 'end', outcome: 'tie' };
  const { mien, sien } = camps;
  const total = (tr: TestResult, acteur: Combatant | undefined, nue?: number): number =>
    roundSL(tr, seq.params.drCap) + sequenceDrBonus(seq.params, acteur, nue);
  const prise = (t2: number, side: SequenceSide): number => Math.max(0, Math.ceil(t2 / Math.max(1, side.div)));
  const cum = {
    [CAMP_PLAYER]: (seq.cum[CAMP_PLAYER] ?? 0) + prise(total(jets.player, jets.playerActor), mien),
    [CAMP_OPPONENT]: (seq.cum[CAMP_OPPONENT] ?? 0) + prise(total(jets.opponent, jets.opponentActor, p.opponentValue), sien),
  };
  // VICTOIRE AU CRITIQUE, sous la condition DÉCLARÉE du camp : le dé des unités, multiplié par ce que
  // le camp porte, ne dépasse pas ce qu'il a pris.
  const auCritique = (tr: TestResult, side: SequenceSide, pris: number): boolean =>
    tr.success && isDoubleRoll(tr.roll) && (tr.roll % 10) * Math.max(1, side.mult) <= pris;
  const critMien = auCritique(jets.player, mien, cum[CAMP_PLAYER]);
  const critSien = auCritique(jets.opponent, sien, cum[CAMP_OPPONENT]);
  // « plus de la moitié des pièces de son adversaire » : STRICTEMENT plus.
  const gagneMien = critMien || cum[CAMP_PLAYER] > sien.pieces / 2;
  const gagneSien = critSien || cum[CAMP_OPPONENT] > mien.pieces / 2;
  const payload: TavernPayload = { ...p, last: { playerSL: cum[CAMP_PLAYER], opponentSL: cum[CAMP_OPPONENT] } };
  const log = [t('tavern.sidePrises', {
    mien: mien.label, prisesMien: cum[CAMP_PLAYER], sien: sien.label, prisesSien: cum[CAMP_OPPONENT],
  })];
  if (critMien || critSien) log.push(t('tavern.sideCritique', { camp: critMien ? mien.label : sien.label }));
  if (!gagneMien && !gagneSien) return { go: 'continue', cum, payload, log };
  return {
    go: 'end',
    outcome: gagneMien && gagneSien ? 'tie' : gagneMien ? 'player' : 'opponent',
    cum, payload, log,
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
 * `state/pendings.ts`) — annoncée AVANT le dé, tranchée après par le socle (`cascade.secondReadOf`,
 * même `evaluateCombinedTest` que la clôture) et rendue sous la ligne du jet. C'est une zone du
 * contrat d'affichage, pas un montage de taverne : tout jet à deux lectures en hérite.
 *
 * EFFACER UNE CHOUETTE est un GESTE DU JOUEUR : « chaque chouette est effacé lorsque le joueur boit
 * une demi-chope de bière » (l.88) — la source dit le prix, pas le moment. Le moment revient donc au
 * joueur (règle 7), par une fenêtre de choix en ouverture de tour.
 *
 * FIN DE PARTIE — ARBITRAGE MAISON (le RAW est MUET, l.97 s'achève sur le Tableau Ivre) : la partie
 * dure le nombre de tours DÉCLARÉ EN DONNÉE (`combined.tours`, éditable au Codex), et le vainqueur est
 * celui qui a le MOINS de chouettes. Elle s'arrête AVANT terme si un joueur tombe Inconscient — c'est
 * la seule issue que le texte lui-même nomme (l.88 : « peuvent envoyer même les buveurs les plus
 * chevronnés rouler sous la table »). Rien de tout cela n'est prêté au RAW.
 */

/** Kind de l'étape de CHOIX « effacer une marque » (l.88). */
const TAVERN_ERASE_KIND = 'tavern-erase';

/** LE COMPTE d'un camp dans un jeu à Test combiné : ses échecs de seconde lecture et ses effacements.
 *  Les MARQUES, elles, sont l'ACCUMULATEUR PAR CAMP du socle (`SequenceState.cum`). */
export interface TavernCombinedState {
  fails: Record<string, number>;
  erased: Record<string, number>;
  tour: number;
  /** La question de l'effacement est POSÉE pour ce tour (elle ne se repose pas au même tour). */
  efface?: boolean;
}

/** Compte NEUF (aucun camp n'a rien marqué). */
function combinedInit(): TavernCombinedState {
  return { fails: {}, erased: {}, tour: 1 };
}

/** Le porteur d'un camp : le challenger, ou son vis-à-vis quand c'est un compagnon. */
function combinedActor(get: Get, p: TavernPayload, camp: string): Combatant | undefined {
  return tavernActor(get, camp === CAMP_PLAYER ? p.challengerId : p.opponentId);
}

/** ÉCHÉANCE d'un compteur : l'intervalle DÉCLARÉ est-il atteint à ce compte ? (l.97 : « pour chaque 3
 *  Tests […] auxquels vous échouez »). Intervalle absent ou nul : chaque unité échoit. */
function combinedEcheance(compte: number, intervalle: number | undefined): boolean {
  const pas = Math.max(1, intervalle ?? 1);
  return compte > 0 && compte % pas === 0;
}

/** FABRIQUE du tour d'EFFACEMENT : le porteur qui a des marques décide s'il en efface une (et boit).
 *  Aucun siège pour le tenir : il n'efface pas (le RAW ne l'y oblige jamais). */
function combinedEraseRound(get: Get, seq: SequenceState<TavernPayload>, game: TavernGame): SequenceRound<TavernPayload> | undefined {
  const p = seq.payload;
  const etat = p.combined ?? combinedInit();
  const heros = combinedActor(get, p, CAMP_PLAYER);
  const marques = seq.cum[CAMP_PLAYER] ?? 0;
  if (!heros || marques <= 0 || cadenceAuto() || !jetSurfaced(get(), heros)) return undefined;
  const etape = choiceStep({
    id: `${TAVERN_ERASE_KIND}-${seq.round}`,
    kind: TAVERN_ERASE_KIND,
    icon: 'nav/dice',
    label: t('tavern.cerevisEffaceChoix', { who: heros.label, marques }),
    actorId: heros.id,
    options: [
      { key: 'efface', label: t('tavern.cerevisEfface') },
      { key: 'garde', label: t('tavern.cerevisGarde') },
    ],
    defaultChoice: 'garde',
  });
  return etape ? { title: t('tavern.cerevisTour', { jeu: game.label, n: etat.tour }), icon: 'nav/dice', steps: [etape] } : undefined;
}

/** La SECONDE cible d'un camp : la valeur DÉCLARÉE (`combined.second`) montée par l'accesseur canon
 *  pour un porteur, ou la valeur de table pour un adversaire abstrait. */
function combinedSecondTarget(regles: SequenceCombinedRules, acteur: Combatant | undefined, difficulty: Difficulty, nue: number): number {
  return acteur
    ? effectiveTarget(acteur, regles.second, difficulty)
    : effectiveTarget(undefined, regles.second, difficulty, nue);
}

/**
 * RÉDUCTEUR DE CLÔTURE d'un tour à Test COMBINÉ (`NADJ 16 l.90`) : la première lecture désigne le
 * perdant du tour (une marque), la seconde — LE MÊME DÉ, `evaluateCombinedTest` — compte les échecs et
 * paie ce que la donnée déclare à chaque échéance.
 */
function combinedClose(ctx: SequenceCloseCtx<TavernPayload>, game: TavernGame): SequenceVerdict<TavernPayload> {
  const { get, seq, done } = ctx;
  const p = seq.payload;
  const regles = seq.params.combined;
  if (!regles) return { go: 'end', outcome: 'tie' };
  const etat = p.combined ?? combinedInit();
  const log: string[] = [];

  // 1) L'EFFACEMENT tranché : la marque part, la demi-chope se boit, et l'échéance se paie.
  const efface = done.participants.find((s) => s.kind === TAVERN_ERASE_KIND);
  if (efface) {
    if (efface.chosen !== 'efface') return { go: 'continue', payload: { ...p, combined: { ...etat, efface: true } } };
    // La demi-chope se boit, la marque part, et l'échéance déclarée se paie — le journal DIT tout
    // cela (un mouvement d'ivresse muet serait invérifiable pour le joueur).
    const marques = { ...seq.cum, [CAMP_PLAYER]: Math.max(0, (seq.cum[CAMP_PLAYER] ?? 0) - 1) };
    const erased = { ...etat.erased, [CAMP_PLAYER]: (etat.erased[CAMP_PLAYER] ?? 0) + 1 };
    const heros = combinedActor(get, p, CAMP_PLAYER);
    log.push(t('tavern.cerevisEffacee', { who: garanti(heros, p.challengerId, 'cérévis').label }));
    if (heros && combinedEcheance(erased[CAMP_PLAYER] ?? 0, regles.eraseEvery) && regles.ops?.length) {
      log.push(...applyOps(heros, [...regles.ops], { rng: battleRng(), source: { kind: 'tavernGame', id: game.id } }));
    }
    return { go: 'continue', cum: marques, payload: { ...p, combined: { ...etat, erased, efface: true } }, log };
  }

  const sides = tavernSides(ctx);
  if (!sides) return { go: 'end', outcome: 'tie' };
  const opt = optionOf(game, p.choices?.[p.challengerId]);
  const difficulty = difficulteOf(opt);
  // LES MARQUES sont l'ACCUMULATEUR du socle (`seq.cum`) ; le compte des échecs reste à la charge utile.
  const marques = { ...seq.cum };
  const fails = { ...etat.fails };

  // 2) LA PREMIÈRE LECTURE : le plus BAS DR prend la marque (l.97). À égalité, personne ne perd le
  //    tour — la source ne désigne QUE « le joueur qui a obtenu le moins de DR ».
  const drMien = sides.player.sl;
  const drSien = sides.opponent.sl;
  const perdant = regles.markLoser
    ? (drMien < drSien ? CAMP_PLAYER : drSien < drMien ? CAMP_OPPONENT : undefined)
    : undefined;
  if (perdant) {
    marques[perdant] = (marques[perdant] ?? 0) + 1;
    const qui = perdant === CAMP_PLAYER ? garanti(sides.playerActor, p.challengerId, 'cérévis').label : p.opponentName;
    log.push(t('tavern.cerevisChouette', { who: qui, dr: perdant === CAMP_PLAYER ? drMien : drSien }));
  }

  // 3) LA SECONDE LECTURE, sur LE MÊME dé (`LDB 12 l.202-208`) : chaque échec compte, et l'échéance
  //    déclarée paie ce que la donnée dit.
  for (const camp of [CAMP_PLAYER, CAMP_OPPONENT]) {
    const jet = camp === CAMP_PLAYER ? sides.player : sides.opponent;
    const acteur = camp === CAMP_PLAYER ? sides.playerActor : sides.opponentActor;
    const cible2 = combinedSecondTarget(regles, acteur, difficulty, p.opponentValue);
    const combine = evaluateCombinedTest(jet.roll, jet.target, cible2);
    if (combine.b.success) continue;
    fails[camp] = (fails[camp] ?? 0) + 1;
    const qui = camp === CAMP_PLAYER ? garanti(sides.playerActor, p.challengerId, 'cérévis').label : p.opponentName;
    log.push(t('tavern.cerevisGorgee', { who: qui }));
    const porteur = combinedActor(get, p, camp);
    if (porteur && combinedEcheance(fails[camp] ?? 0, regles.failEvery) && regles.ops?.length) {
      log.push(t('tavern.cerevisAlcool', { who: qui }));
      // ANCRAGE DE RÈGLE : ce que la partie fait boire se relie à la FICHE DU JEU, qui porte sa règle
      // verbatim — une pastille d'ivresse sans fiche ne dirait pas d'où elle vient.
      log.push(...applyOps(porteur, [...regles.ops], { rng: battleRng(), source: { kind: 'tavernGame', id: game.id } }));
    }
  }

  const suite: TavernCombinedState = { fails, erased: etat.erased, tour: etat.tour + 1 };
  const mien = marques[CAMP_PLAYER] ?? 0;
  const sien = marques[CAMP_OPPONENT] ?? 0;
  const payload: TavernPayload = {
    ...sansChoix(p), combined: suite,
    last: { playerSL: mien, opponentSL: sien },
  };
  // FIN : sous la table (l.88), ou au bout des tours DÉCLARÉS (arbitrage maison éditable).
  const arret = regles.stopCondition;
  const sousLaTable = !!arret && [CAMP_PLAYER, CAMP_OPPONENT].some((c) => {
    const porteur = combinedActor(get, p, c);
    return !!porteur && hasCondition(porteur, arret);
  });
  if (!sousLaTable && etat.tour < (regles.tours ?? 0)) return { go: 'continue', cum: marques, payload, log };
  if (sousLaTable) log.push(t('tavern.cerevisSousLaTable'));
  // Le MOINS de chouettes l'emporte (arbitrage maison : le RAW ne nomme aucun vainqueur).
  return { go: 'end', outcome: mien < sien ? 'player' : sien < mien ? 'opponent' : 'tie', cum: marques, payload, log };
}

/** APPLIER de l'effacement : la clôture seule en tire les conséquences (patron du réducteur unique). */
registerCascadeApplier(TAVERN_ERASE_KIND, () => ({}));

registerSequence<TavernPayload>(TAVERN_SEQUENCE, {
  round: tavernRound, close: tavernClose, settle: tavernSettle, board: tavernBoard,
});

/** MOUVEMENT de bourse d'une partie à mise SIMPLE (une mise contre la maison) : gagné, la mise est
 *  gagnée ; perdu, elle est perdue ; égalité, rien ne bouge. */
function tavernNetBrass(winner: TavernGameResult['winner'], stakeBrass: number): number {
  if (stakeBrass <= 0) return 0;
  return winner === 'player' ? stakeBrass : winner === 'opponent' ? -stakeBrass : 0;
}

/**
 * Dénoue la partie : pose le résultat affiché par la modale, journalise, et verse le mouvement de
 * bourse du challenger quand c'est ICI qu'il se joue (`verse`). Un jeu de POT a déjà versé les siens
 * — un par joueur, sur toute la partie : ce mouvement-là n'est pas dérivable d'un vainqueur.
 */
function finalizeTavernGame(
  get: Get, set: Set, game: TavernGame, challenger: Combatant, opponentName: string,
  winner: TavernGameResult['winner'], playerSL: number, opponentSL: number, rounds: number, stakeBrass: number, log: string,
  fin: { netBrass: number; verse: boolean; detail?: string },
): { consequences: Consequence[] } {
  const netBrass = fin.netBrass;
  // Gain → crédit du challenger ; perte → débit de SA bourse (soloPayer, plafonné à la mise déjà bornée à sa bourse).
  if (fin.verse && netBrass > 0) creditBourse(get, set, challenger.id, fromBrass(netBrass));
  else if (fin.verse && netBrass < 0) payWithAllocation(get, set, { debits: soloPayer(challenger.id, fromBrass(-netBrass)), purpose: 'jeu de taverne' });
  const result: TavernGamesResult = {
    winner, playerSL, opponentSL, rounds, log,
    gameLabel: game.label,
    challengerName: challenger.label,
    opponentName,
    stakeBrass,
    netBrass,
    ...(fin.detail ? { detail: fin.detail } : {}),
  };
  set({ tavernGames: { result } });
  const stakeTxt = netBrass > 0 ? ` — gain ${formatMoney(fromBrass(netBrass))}` : netBrass < 0 ? ` — perte ${formatMoney(fromBrass(-netBrass))}` : '';
  return { consequences: freeCons([`${game.label} — ${challenger.label} contre ${opponentName} : ${log}${stakeTxt}`]) };
}
