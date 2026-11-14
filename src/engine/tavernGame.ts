/**
 * Jeux de taverne (Nuits agitées & dures journées, ch.16 « Jeux de Taverne ») — MOTEUR GÉNÉRIQUE
 * data-driven : un jeu = une entrée de `tavernGames.json` (Compétence/carac du jeu, forme de tour,
 * mise, plafond de DR, départage…), sa règle recopiée VERBATIM.
 *
 * DEUX RÉGIMES OFFICIELS, qui coexistent (le second est une règle optionnelle, `jeux-de-taverne-rapides`) :
 *  - COMPLET : chaque jeu joue SES règles (manches, mises et pot, passages de lancers, camps, Test
 *    combiné), portées par sa donnée et jouées par le socle de séquence (`noyau/sequenceCore`) ;
 *  - RAPIDE (ch.16 l.9-11, verbatim l.11) : « effectuez un Test opposé de Compétence Intermédiaire (+0)
 *    en utilisant la Compétence indiquée dans la section "Jeu" du jeu en question. Si aucune Compétence
 *    n'est indiquée (comme pour Al-zahr), faites plutôt un Test opposé de Pari Intermédiaire (+0).
 *    Celui qui obtient le nombre le plus élevé de DR remporte la partie. » — servi par la projection
 *    `findTavernGameById`, seul accesseur du catalogue par id.
 * Moteur PUR (RNG seedable) : les valeurs de Compétence sont calculées par l'appelant.
 */
import { RNG } from './dice';
import { rollTest, resolveOpposed, easeDifficulty, TestResult } from './tests';
import { Difficulty, type Combatant } from './types';
import { hasTalent } from './magic';
import { rule } from './policy';
import { TAVERN_GAMES } from '../data';
import type { EntreeDe } from '../data/datasets';
import type * as tavernGamesDef from '../data/schemas/defs/tavernGames';
import { indexParId } from '../data/versionDataset';

/** Un jeu de taverne du catalogue (`schemas/defs/tavernGames.ts`). */
export type TavernGame = EntreeDe<typeof tavernGamesDef>;
/** Un Spécial d'un jeu (`specialSchema`, NADJ 16 l.82) ; `steps` suit `easeDifficulty` (positif = plus facile). */
export type TavernSpecial = NonNullable<TavernGame['specials']>[number];

const jeuParId = indexParId('tavernGames', TAVERN_GAMES);

/** Id de la règle optionnelle du RÉGIME RAPIDE (`engine/policy.ts`) — DISTINCTE de `jeux-de-taverne`,
 *  qui ouvre la fonctionnalité : le régime ne se déduit pas de l'ouverture. */
export const TAVERN_FAST_RULE = 'jeux-de-taverne-rapides';

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
 * toujours (`tavernTestSpec`/`tavernGameValue`, `noyau/tavernFlow.ts`).
 */
export function fastTavernGame(g: TavernGame): TavernGame {
  const test: Pick<TavernGame, 'skill' | 'characteristic'> = g.fastSkill ?? { skill: g.skill ?? { id: 'pari' } };
  return {
    id: g.id,
    type: g.type,
    label: g.label,
    desc: g.desc,
    ...(test.skill ? { skill: test.skill } : {}),
    ...(test.characteristic ? { characteristic: test.characteristic } : {}),
    mode: 'oppose',
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

/** Le camp d'une partie de taverne : le challenger et son vis-à-vis. */
export type CampDeTaverne = 'joueur' | 'adversaire';
/** L'issue d'une partie ou d'une manche de taverne. */
export type VainqueurDeTaverne = CampDeTaverne | 'egalite';

export interface TavernGameResult {
  winner: VainqueurDeTaverne;
  /** Score de chaque camp (DR de la manche, ou DR cumulés en mode étendu). */
  dr: Record<CampDeTaverne, number>;
  /** Nombre de manches jouées (1 en mode opposé). */
  rounds: number;
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
 * l'APPLIER (`noyau/tavernFlow.ts`, POST-COMMIT du jet du joueur déjà surfacé par `openRoll`) pour
 * rouler le côté ADVERSAIRE (« l'adversaire roule côté monde » — jamais le côté joueur, qui passe par
 * le seam). N'accepte QU'un rng — ne décide rien (#370).
 * `value` d'un adversaire ABSTRAIT est déjà la valeur NUE de la table : elle se pose en grandeur de
 * départage (LDB 12 l.160). Un adversaire INCARNÉ (héros) a une valeur de Test fondue — son porteur
 * (`noyau/tavernFlow.ts`) réécrit alors `base` à l'accesseur canon.
 */
export function rollTavernTest(value: number, rng: RNG, difficulty: Difficulty = TAVERN_TEST_DIFFICULTY, modifier = 0): TestResult {
  return { ...rollTest(value, difficulty, rng, modifier), base: value };
}

/** Issue d'UNE manche entre deux `TestResult` DÉJÀ roulés — PUR (aucun rng, aucune décision de
 *  surfaçage) : compare via `resolveOpposed`, plafonne par `game.drCap` (Boules). */
export interface TavernRoundOutcome {
  winner: VainqueurDeTaverne;
  dr: Record<CampDeTaverne, number>;
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
 * manche, au mode `extended` (Bras de fer, l'appelant cumule `dr` de chaque camp jusqu'à `target`).
 */
export function resolveTavernRound(
  game: TavernGame, playerTR: TestResult, opponentTR: TestResult,
  drBonus: Partial<Record<CampDeTaverne, number>> = {},
): TavernRoundOutcome {
  const ps = roundSL(playerTR, game.drCap) + (drBonus.joueur ?? 0);
  const os = roundSL(opponentTR, game.drCap) + (drBonus.adversaire ?? 0);
  const opp = resolveOpposed({ ...playerTR, sl: ps }, { ...opponentTR, sl: os });
  // NADJ 16 l.105 ; #1921 c.6233078802.
  const departageGeneral = game.tieBreak === undefined || opp.decidedBy === 'dr';
  const winner = !departageGeneral || opp.winner === 'egalite' ? 'egalite' : opp.winner === 'attaquant' ? 'joueur' : 'adversaire';
  return { winner, dr: { joueur: ps, adversaire: os } };
}

/**
 * Les Spéciaux du jeu qui valent POUR CE JOUEUR (NADJ 16 l.82 : « si vous avez le Talent ») — lus une
 * fois, à l'ouverture de la partie, sur sa fiche (`hasTalent`). Un siège sans fiche n'en a aucun.
 */
export function specialsApplicables(game: TavernGame, actor: Combatant | undefined): TavernSpecial[] {
  if (!actor) return [];
  return (game.specials ?? []).filter((s) => hasTalent(actor, s.hasTalent));
}

/** La Difficulté DE BASE d'un Test du jeu : celle de l'option retenue, sinon celle du jeu (NADJ 16
 *  l.90, l.105, l.125, l.145), sinon Intermédiaire (LDB 12 l.166). PUR. */
export function difficulteDeBase(game: TavernGame, choix?: number): Difficulty {
  return game.options?.[choix ?? 0]?.test.difficulty ?? game.difficulty ?? TAVERN_TEST_DIFFICULTY;
}

/** La Difficulté d'un Test du jeu POUR UN JOUEUR : la Difficulté de base, transformée par SES
 *  Spéciaux dans leur ordre de déclaration (NADJ 16 l.82). PUR. */
export function difficulteDuJoueur(base: Difficulty, specials: readonly TavernSpecial[]): Difficulty {
  return specials.reduce<Difficulty>(
    (d, s) => (s.effet === 'cran' ? easeDifficulty(d, s.steps) : s.difficulty),
    base,
  );
}

