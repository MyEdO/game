/**
 * Jeux de taverne (Nuits agitées & dures journées, ch.16 « Jeux de Taverne ») — MOTEUR GÉNÉRIQUE
 * data-driven : un jeu = une entrée de `tavernGames.json` (Compétence/carac du jeu, forme de tour,
 * mise, plafond de DR, départage…), sa règle recopiée VERBATIM.
 *
 * DEUX RÉGIMES OFFICIELS, qui coexistent (le second est une règle optionnelle, `tavern-games-rapides`) :
 *  - COMPLET : chaque jeu joue SES règles (manches, mises et pot, passages de lancers, camps, Test
 *    combiné), portées par sa donnée et jouées par le socle de séquence (`state/sequenceCore`) ;
 *  - RAPIDE (ch.16 l.9-11, verbatim l.11) : « effectuez un Test opposé de Compétence Intermédiaire (+0)
 *    en utilisant la Compétence indiquée dans la section "Jeu" du jeu en question. Si aucune Compétence
 *    n'est indiquée (comme pour Al-zahr), faites plutôt un Test opposé de Pari Intermédiaire (+0).
 *    Celui qui obtient le nombre le plus élevé de DR remporte la partie. » — servi par la projection
 *    `findTavernGameById`, seul accesseur du catalogue par id.
 * Moteur PUR (RNG seedable) : les valeurs de Compétence sont calculées par l'appelant.
 */
import { RNG, defaultRNG } from './dice';
import { rollTest, resolveOpposed, TestResult } from './tests';
import { Difficulty, CharKey } from './types';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { rule } from './policy';
import type {
  SequencePhases, SequencePotRules, SequenceRoundOps, SequenceTableRow, SequenceSide, SequenceVolleyRules,
  SequenceCombinedRules, SequenceThrowerPenalty,
} from './sequenceVocab';
import tavernGamesJson from '../data/tavernGames.json';
import { indexParId } from '../data/versionDataset';
import { t } from '../i18n';

export interface TavernGame {
  id: string;
  label: string;
  /** Règle du jeu recopiée VERBATIM (section « Jeu : » du livre). */
  desc: string;
  /** Référence de la Compétence du jeu (`{ id, spec? }`, skills.json) — l'appelant calcule la valeur.
   *  ABSENTE = aucune Compétence indiquée → Pari (variante rapide, l.11). */
  skill?: RefDesignee;
  /** Caractéristique du jeu quand il ne repose pas (ou pas seulement) sur une Compétence (Bras de fer = F,
   *  Bête = CT, Alvatafl/Cerevis = Int/I). Sert à l'appelant pour calculer la valeur. */
  characteristic?: CharKey;
  /** RÉGIME RAPIDE : le Test joué par CETTE entrée quand la table s'écarte de la lettre. Absent =
   *  `NADJ 16 l.11` mot à mot (la Compétence indiquée ; Pari si aucune n'est indiquée) — une
   *  Caractéristique n'est PAS une Compétence, donc le Bras de fer tombe sur Pari par défaut. Poser
   *  ici `{ char: 'force', maison: '…' }` est la lecture d'esprit, éditable au Codex et taguée. */
  fastSkill?: { skill?: RefDesignee; char?: CharKey; maison: string };
  /** Mode : `opposed` (un Test opposé, +DR l'emporte — variante rapide) ou `extended` (Test opposé étendu
   *  jusqu'à `target` DR cumulés — Bras de fer, l.34). */
  mode?: 'opposed' | 'extended';
  /** Test étendu : DR cumulés à atteindre (Bras de fer = 10). */
  target?: number;
  /** Plafond de DR d'une manche (Boules = 6 DR). */
  drCap?: number;
  /** DÉPARTAGE d'égalité DÉCLARÉ (id résolu par le socle de séquence, `state/sequenceCore`) : Dominos
   *  « En cas d'égalité, les joueurs comparent le résultat de leur dé d'unités pour ce Test. Celui qui
   *  a le nombre le plus bas gagne » (l.107) → `units-lowest` ; Boules « en cas d'égalité, la partie se
   *  solde par un match nul » (l.57) → `nul`. Absent : l'égalité reste. */
  tieBreak?: string;
  /** Bonus de CARACTÉRISTIQUE ajouté au DR de chaque manche — Bras de fer l.34 (Force), Alvatafl l.20
   *  (Intelligence), Bête l.42 (Capacité de Tir). Consommé par le socle (`SequenceParams.drBonus`). */
  drBonus?: CharKey;
  /** EFFETS PAR MANCHE en donnée (`GameOp[]`) — Bras de fer l.34-35 : +1 Avantage au vainqueur de
   *  chaque tour, +1 État Exténué tous les (Bonus d'Endurance) tours sans vainqueur. */
  roundOps?: SequenceRoundOps;
  /** JEU D'ÉQUIPE (Middenball l.119-121) : « Deux équipes de 11 joueurs s'affrontent », « tous les
   *  joueurs effectuent un Test », « On additionne le nombre de DR obtenus pour chaque équipe ».
   *  `size` = l'effectif RAW d'un camp ; le groupe le complète de FIGURANTS (arbitrage utilisateur
   *  2026-08-13 : « chaque camp complète à 11 avec des figurants PNJ (patrons de taverne, valeur
   *  simple éditable) — les héros portent leurs jets, les figurants roulent en témoins auto »). */
  team?: { size: number };
  /** FORME d'un tour — la CAPACITÉ que le jeu déclare, jamais déduite d'un effectif :
   *  · `team` : tous les joueurs testent le même tour, on somme par équipe (Middenball l.121) ;
   *  · `thrower` : un tour = UN lanceur, chacun le sien jusqu'au dernier (Torchon l.111) ;
   *  · `pot` : un tour = UN joueur qui lance les dés devant un pot (Al-zahr l.17) ;
   *  · `volley` : un tour = UN lancer d'un PASSAGE en nombre fixe (Bête l.42, Arène l.65,
   *    Fléchettes l.83, Boules l.57).
   *  Absente : une manche opposée ordinaire (variante rapide, l.9-11). */
  roundShape?: 'team' | 'thrower' | 'pot' | 'volley';
  /** OPTIONS de Test d'une manche quand la règle en offre plusieurs (Middenball l.121 : « un Test de
   *  Corps à corps (Bagarre) Accessible (+20) **ou** d'Athlétisme Intermédiaire (+0) »). Le RAW ne dit
   *  pas QUI choisit : le choix va au JOUEUR (credo « pas de MJ », jamais un défaut silencieux). La
   *  PREMIÈRE option est celle que jouent les porteurs qu'aucun siège ne tient, et les figurants. */
  options?: {
    skill?: RefDesignee; char?: CharKey; difficulty: Difficulty;
    /** Ce Test est-il un Test de COMBAT ? — c'est lui qui décide si l'Avantage s'y applique : « +10 à
     *  un Test de Combat ou de Psychologie approprié » (`LDB 14 l.215`). Middenball l.121 renvoie aux
     *  « règles habituelles relatives à l'Avantage » : Corps à corps (Bagarre) en est un, Athlétisme
     *  non. DÉCLARÉ par l'entrée (jamais déduit d'un id de Compétence au code). */
    combatTest?: boolean;
  }[];
  /** Formule de score d'un CAMP (id de `registerSequenceScore` : `sum` pour une équipe, l.121). */
  campScore?: string;
  /** Seuil d'un ACQUIS de manche (Middenball l.121 : « marquera un but si son total est de +25 ou plus »). */
  scoreThreshold?: number;
  /** PHASES de la partie (Middenball l.121 : « deux mi-temps de trois tours chacune »). */
  phases?: SequencePhases;
  /** Effectif du CERCLE qui esquive (Torchon l.109 : « deux cercles de 11 joueurs qui dansent main
   *  dans la main autour d'un membre de l'équipe adverse ») — la cible d'un lancer est tirée AU SORT
   *  parmi eux (l.111). */
  dancers?: number;
  /** TABLE de score par plage de DR (Torchon l.111 : jambe / corps ≥3 DR / tête ≥6 DR). */
  table?: SequenceTableRow[];
  /** VOLÉE de lancers (famille 7 du socle) : Bête l.42 (trois coups, quilles ÉCRÊTÉES à ce qu'il en
   *  reste), Arène l.65 (cinq lancers, cible CHOISIE), Fléchettes l.83 (trois fléchettes, total
   *  EXACT), Boules l.57 (trois boules, la meilleure compte). Consommé par `SequenceParams.volley`. */
  volley?: SequenceVolleyRules;
  /** CAMPS ASYMÉTRIQUES (famille 8 du socle) — Alvatafl l.27-28. Consommé par `SequenceParams.sides`. */
  sides?: SequenceSide[];
  /** TEST COMBINÉ à conséquences distinctes (famille 9 du socle) — Cerevis l.97. Consommé par
   *  `SequenceParams.combined`. */
  combined?: SequenceCombinedRules;
  /** SANCTION DU LANCEUR QUI MANQUE (famille 10 du socle) — Torchon l.111 : le Test à passer, ce que
   *  son échec coûte au camp et applique au lanceur, et le balayage final des trop sobres. Consommé
   *  par `SequenceParams.throwerPenalty`. */
  throwerPenalty?: SequenceThrowerPenalty;
  /** UNITÉ de ce que le jeu COMPTE, au pluriel (« quilles » l.42, « points » l.65/l.83, « pièces
   *  prises » l.27, « chouettes » l.97). AFFICHAGE : tableau de marque et dénouement l'écrivent telle
   *  quelle. Absente : des DR — l'unité du jeu rapide (l.11). */
  scoreUnit?: string;
  /** MISE, POT, ABANDON, ÉLIMINATION (Al-zahr, l.17) — famille (5) du socle de séquence : les dés du
   *  tour, la plage du nombre cible, les plages de résultat et leur effet de pot. Consommé par
   *  `SequenceParams.pot` (`state/sequenceCore`). */
  pot?: SequencePotRules;
  source: { book: string; page: number };
}

export const TAVERN_GAMES = tavernGamesJson as TavernGame[];
const jeuParId = indexParId('tavernGames', TAVERN_GAMES);

/** Id de la règle optionnelle du RÉGIME RAPIDE (`engine/policy.ts`) — DISTINCTE de `tavern-games`,
 *  qui ouvre la fonctionnalité : le régime ne se déduit pas de l'ouverture. */
export const TAVERN_FAST_RULE = 'tavern-games-rapides';

/** La table joue-t-elle au régime RAPIDE (`NADJ 16 l.9-11`) ? Lecture UNIQUE de la règle. */
export function tavernFastRegime(): boolean {
  return rule(TAVERN_FAST_RULE) === true;
}

/**
 * LE JEU TEL QU'IL SE JOUE au régime RAPIDE (`NADJ 16 l.11`) — projection par LISTE BLANCHE : ne
 * survivent que l'identité, le Test indiqué et la source. Tout ce qui décrit les règles PROPRES du
 * jeu (forme de tour, mise et pot, passages de lancers, camps, Test combiné, options, cible de
 * cumul, plafond de DR, Bonus de Caractéristique, effets de manche, phases, tables, unité de score)
 * disparaît : le régime rapide n'en joue AUCUNE — « effectuez un Test opposé de Compétence
 * Intermédiaire (+0) […] Celui qui obtient le nombre le plus élevé de DR remporte la partie » (l.11).
 * Une liste blanche parce qu'une famille de règles AJOUTÉE plus tard doit être admise EXPLICITEMENT :
 * en liste noire, elle fuirait dans le régime rapide sans que personne ne le voie.
 *
 * LE TEST JOUÉ suit la LETTRE, et rien d'autre : « en utilisant la Compétence indiquée dans la
 * section "Jeu" du jeu en question. Si aucune Compétence n'est indiquée (comme pour Al-zahr), faites
 * plutôt un Test opposé de Pari » (l.11). Une CARACTÉRISTIQUE n'est pas une Compétence : le Bras de
 * fer (l.34, « un Test opposé étendu de Force ») n'en indique donc aucune et tombe sur Pari — la
 * `characteristic` de l'entrée ne franchit PAS la projection. Jouer la Force à sa place est une
 * lecture d'ESPRIT, légitime mais hors texte : elle s'écrit en DONNÉE (`fastSkill`, taguée maison,
 * éditable au Codex), jamais en défaut de code. La valeur, elle, se calcule là où elle se calcule
 * toujours (`tavernTestSpec`/`tavernGameValue`, `state/tavernFlow.ts`).
 */
export function fastTavernGame(g: TavernGame): TavernGame {
  const test: { skill?: RefDesignee; char?: CharKey } = g.fastSkill ?? { skill: g.skill ?? { id: 'pari' } };
  return {
    id: g.id,
    label: g.label,
    desc: g.desc,
    ...(test.skill ? { skill: test.skill } : {}),
    ...(test.char ? { characteristic: test.char } : {}),
    mode: 'opposed',
    source: g.source,
  };
}

/**
 * Un jeu de taverne par son `id`, TEL QU'IL SE JOUE sous le régime en vigueur — SEUL accessseur
 * exporté du catalogue par id : le catalogue brut (`jeuParId`) reste privé, de sorte qu'aucune surface
 * (flux, modale) ne puisse lire un jeu « hors régime » et jouer les deux à la fois. Les deux régimes
 * du RAW coexistent donc sans qu'aucun site ne les arbitre : ils sont servis à la source.
 */
export function findTavernGameById(id: string): TavernGame | undefined {
  const g = jeuParId(id);
  return g && tavernFastRegime() ? fastTavernGame(g) : g;
}

export interface TavernGameResult {
  winner: 'player' | 'opponent' | 'tie';
  /** Score du joueur (DR de la manche, ou DR cumulés en mode étendu). */
  playerSL: number;
  opponentSL: number;
  /** Nombre de manches jouées (1 en mode opposé). */
  rounds: number;
  log: string;
}

/** Difficulté du Test de jeu de taverne (variante rapide, l.9-11 / Bras de fer l.34) — Intermédiaire (+0). */
export const TAVERN_TEST_DIFFICULTY: Difficulty = 'intermediaire';

/** DR d'une manche, plafonné par `drCap` sur une réussite (Boules : « Le DR maximal est de 6 DR »). */
export function roundSL(t: TestResult, cap?: number): number {
  return cap != null && t.success ? Math.min(t.sl, cap) : t.sl;
}

/**
 * Roule UN côté (Intermédiaire (+0)) — PRIMITIVE `roll*` (convention du dépôt : `roll*` = un seul jet,
 * jamais une décision de confrontation ; cf. `rollMerchantOpposition`/`rollTest`). Utilisée par
 * l'APPLIER (`state/tavernFlow.ts`, POST-COMMIT du jet du joueur déjà surfacé par `openRoll`) pour
 * rouler le côté ADVERSAIRE (« l'adversaire roule côté monde » — jamais le côté joueur, qui passe par
 * le seam). N'accepte QU'un rng — ne décide rien (#370).
 * `value` d'un adversaire ABSTRAIT est déjà la valeur NUE de la table : elle se pose en grandeur de
 * départage (LDB 12 l.160). Un adversaire INCARNÉ (héros) a une valeur de Test fondue — son porteur
 * (`state/tavernFlow.ts`) réécrit alors `base` à l'accesseur canon.
 */
export function rollTavernTest(value: number, rng: RNG = defaultRNG, difficulty: Difficulty = TAVERN_TEST_DIFFICULTY): TestResult {
  return { ...rollTest(value, difficulty, rng), base: value };
}

/** Issue d'UNE manche entre deux `TestResult` DÉJÀ roulés — PUR (aucun rng, aucune décision de
 *  surfaçage) : compare via `resolveOpposed`, plafonne par `game.drCap` (Boules). */
export interface TavernRoundOutcome {
  winner: 'player' | 'opponent' | 'tie';
  playerSL: number;
  opponentSL: number;
}

/**
 * `drBonus` = Bonus de Caractéristique AJOUTÉ au DR de la manche, PAR CAMP (Bras de fer NADJ 16
 * l.34 : « à chaque tour, ajoutez votre Bonus de Force au nombre de DR que vous avez obtenus »).
 * Son ORDRE vis-à-vis du plafond de manche (`drCap`) est une DÉCISION D'INGÉNIERIE, pas une règle :
 * aucune entrée du catalogue ne porte les deux à la fois, l'écart est donc inobservable en jeu. Le
 * choix retenu — plafonner le DR OBTENU au Test, puis ajouter le Bonus — suit la seule entrée qui
 * plafonne (Boules l.57 : « Le DR maximal est de 6 DR », dit du DR du jet). À réexaminer le jour où
 * une entrée cumule les deux.
 *
 * Décide UNE manche depuis deux `TestResult` DÉJÀ roulés par l'appelant (#370) : elle ne roule RIEN —
 * rouler ET décider ici contournerait le seam de jet côté joueur. Elle ne fait QUE décider, comme
 * `resolveOpposed`. Sert au mode `opposed` (manche unique) et, manche par
 * manche, au mode `extended` (Bras de fer, l'appelant cumule `playerSL`/`opponentSL` jusqu'à `target`).
 */
export function resolveTavernRound(
  game: TavernGame, playerTR: TestResult, opponentTR: TestResult,
  drBonus: { player?: number; opponent?: number } = {},
): TavernRoundOutcome {
  const ps = roundSL(playerTR, game.drCap) + (drBonus.player ?? 0);
  const os = roundSL(opponentTR, game.drCap) + (drBonus.opponent ?? 0);
  const opp = resolveOpposed({ ...playerTR, sl: ps }, { ...opponentTR, sl: os });
  const winner = opp.winner === 'attacker' ? 'player' : opp.winner === 'defender' ? 'opponent' : 'tie';
  return { winner, playerSL: ps, opponentSL: os };
}

/** Ligne de journal d'une manche `opposed` (variante rapide, l.11) — DR contre DR. */
export function tavernOpposedLog(game: TavernGame, playerSL: number, opponentSL: number, winner: TavernRoundOutcome['winner']): string {
  return t('tavern.opposedLog', {
    jeu: game.label, mien: playerSL, sien: opponentSL,
    issue: t(winner === 'player' ? 'tavern.issueWon' : winner === 'opponent' ? 'tavern.issueLost' : 'tavern.issueTie'),
  });
}

/** Ligne de journal d'une partie `extended` (Bras de fer, l.34) — DR cumulés sur N manches. */
export function tavernExtendedLog(game: TavernGame, playerSL: number, opponentSL: number, rounds: number): string {
  return t('tavern.extendedLog', { jeu: game.label, mien: playerSL, sien: opponentSL, rounds, s: rounds > 1 ? 's' : '' });
}
