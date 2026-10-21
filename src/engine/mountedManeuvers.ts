/**
 * Manœuvres de selle EN SCÈNE (EDOC 7 « Montures et véhicules ») — moteur PUR : RNG injecté, toute
 * valeur testée fournie par l'appelant, aucun `d100` maison (tout passe par `engine/tests.ts`), aucun
 * État posé (les ids sont RENDUS, l'appelant les applique).
 *
 * Deux passages du chapitre, distincts du VOYAGE (`mountTravel.ts`, journée d'allure et incidents de
 * monte) et des mésaventures d'attelage (`drivingMishap.ts`) :
 *  - « ON NE S'ARRÊTE PAS ! » (EDOC 07 l.326-330) : embarquer sur un véhicule ou une monture en
 *    mouvement — `boardMovingVehicle` / `boardMovingMount`.
 *  - « TRAÎNÉ AU SOL » (EDOC 07 l.176-182) : le pied resté dans l'étrier — `resolveDraggedByStirrup`,
 *    `freeFootFromStirrupStep`, `cutStirrupStrap`.
 *
 * Sans consommateur à ce jour : ces résolveurs sont offerts au flux de scène qui les composera.
 */
import { COND } from './conditions';
import { type RNG } from './dice';
import { extendedTestStep, rollTest, opposedTest, type OpposedResult, type TestResult } from './tests';
import type { Difficulty } from './types';
import type { Allure } from './mountTravel';

/** Hauteur de chute de selle du chapitre, en mètres — EDOC 07 l.167, l.174, l.178, l.328. */
export const CHUTE_SELLE_M = 2;

/** Difficulté d'une manœuvre d'embarquement : à vitesse égale de la monture/du véhicule de départ,
 *  Intermédiaire (+0) ; depuis une position à l'arrêt, Difficile (−20) — EDOC 07 l.328, l.330. */
export function boardingDifficulty(depuisArret = false): Difficulty {
  return depuisArret ? 'difficile' : 'intermediaire';
}

export interface BoardingParams {
  /** Valeur TESTÉE d'Athlétisme du sauteur (résolue par l'appelant, `skills.testValue`). */
  valeurAthletisme: number;
  /** Le saut part d'une position immobile (EDOC 07 l.330). */
  depuisArret?: boolean;
  rng: RNG;
}

export interface BoardingResult {
  athletisme: TestResult;
  /** Le sauteur a-t-il atteint et gardé sa cible ? */
  aBord: boolean;
  /** Hauteur de chute à faire subir par l'appelant (`engine/movement.applyFall`) — celle de
   *  l'éjecté (`ejecte`) quand la selle est disputée, celle du sauteur sinon. */
  chuteM?: number;
}

/** Sauter sur un VÉHICULE en mouvement — EDOC 07 l.328. Échec : la cible est manquée, chute de 2 m. */
export function boardMovingVehicle(p: BoardingParams): BoardingResult {
  const athletisme = rollTest(p.valeurAthletisme, boardingDifficulty(p.depuisArret), p.rng);
  return athletisme.success ? { athletisme, aBord: true } : { athletisme, aBord: false, chuteM: CHUTE_SELLE_M };
}

export interface BoardMountParams extends BoardingParams {
  /** La monture porte le Trait Nerveux (EDOC 07 l.328) — impose le Test de Chevaucher qui suit. */
  montureNerveuse?: boolean;
  /** Valeur TESTÉE de Chevaucher du sauteur (Trait Nerveux et/ou dispute de selle). */
  valeurChevaucher?: number;
  /** Cavalier DÉJÀ en selle, s'il y en a un (EDOC 07 l.328). */
  cavalier?: { valeurChevaucher: number };
}

export interface BoardMountResult extends BoardingResult {
  /** Test de Chevaucher Intermédiaire (+0) exigé par le Trait Nerveux (EDOC 07 l.328). */
  controleMonture?: TestResult;
  /** Test opposé de Chevaucher contre le cavalier en place (EDOC 07 l.328). */
  disputeSelle?: OpposedResult;
  /** Qui est éjecté de la selle, à l'issue de la dispute. */
  ejecte?: 'sauteur' | 'cavalier';
}

/**
 * Sauter sur une MONTURE en mouvement — EDOC 07 l.328 : « Sauter sur une monture en mouvement sans
 * cavalier nécessite le même Test, suivi d'un Test de **Chevaucher Intermédiaire (+0)** si la monture a
 * le Trait Nerveux. Si vous tentez de sauter sur une monture qui a déjà un cavalier, vous devez
 * également faire un Test opposé de **Chevaucher** contre le cavalier actuel, le gagnant reste sur la
 * monture et le perdant est éjecté, subissant une chute de 2 mètres. »
 *
 * OÙ PORTE LE −20 DE L'ARRÊT (l.330 : « tenter l'une ou l'autre de ces manœuvres depuis une position à
 * l'arrêt augmente le malus de Difficulté à -20 ») : « ces manœuvres » désigne les deux sauts de
 * l.328 — sauter sur un véhicule, sauter sur une monture — donc le Test d'Athlétisme d'embarquement.
 * Le Chevaucher ENCHAÎNÉ n'est pas la manœuvre depuis l'arrêt : il ne se lance qu'après un
 * embarquement RÉUSSI, le sauteur étant déjà en selle, donc en mouvement avec la bête.
 *
 * Deux points de résolution que le passage ne chiffre pas :
 *  - échec au Test de Chevaucher du Trait Nerveux → le sauteur tombe de 2 m — arbitrage MAISON
 *    (AGENTS.md règle 7) : l.328 est muet sur cet échec, la hauteur est extrapolée des autres chutes
 *    de selle du chapitre (EDOC 07 l.167, l.174, l.178) ;
 *  - égalité au Test opposé → statu quo de `resolveOpposed` (`winner === 'tie'`) : nul n'est éjecté, la
 *    monture reste à son cavalier et le sauteur, qui n'a pas pris la selle, chute de 2 m.
 */
export function boardMovingMount(p: BoardMountParams): BoardMountResult {
  const rng = p.rng;
  const athletisme = rollTest(p.valeurAthletisme, boardingDifficulty(p.depuisArret), rng);
  if (!athletisme.success) return { athletisme, aBord: false, chuteM: CHUTE_SELLE_M };

  if (p.cavalier) {
    const disputeSelle = opposedTest(
      p.valeurChevaucher ?? 0,
      p.cavalier.valeurChevaucher,
      rng,
      'intermediaire',
      'intermediaire',
      { attacker: p.valeurChevaucher ?? 0, defender: p.cavalier.valeurChevaucher },
    );
    const ejecte =
      disputeSelle.winner === 'attacker' ? 'cavalier' : disputeSelle.winner === 'defender' ? 'sauteur' : undefined;
    return {
      athletisme,
      disputeSelle,
      aBord: disputeSelle.winner === 'attacker',
      ...(ejecte ? { ejecte } : {}),
      chuteM: CHUTE_SELLE_M,
    };
  }

  if (p.montureNerveuse) {
    const controleMonture = rollTest(p.valeurChevaucher ?? 0, 'intermediaire', rng);
    return controleMonture.success
      ? { athletisme, controleMonture, aBord: true }
      : { athletisme, controleMonture, aBord: false, chuteM: CHUTE_SELLE_M };
  }

  return { athletisme, aBord: true };
}

// ── TRAÎNÉ AU SOL (EDOC 07 l.176-182) ────────────────────────────────────────────────────────────

/** Degrés de Réussite du Test étendu d'Athlétisme qui libère le pied de l'étrier (EDOC 07 l.180). */
export const STIRRUP_FREE_DR = 3;

/** État de la monture au moment où le cavalier est à terre, pied pris — `'immobile'` ouvre le Test
 *  étendu de libération, les trois allures chiffrent les Dégâts par Round (EDOC 07 l.180-182). */
export type DragAllure = Allure | 'immobile';

export interface DraggedByStirrupResult {
  esquive: TestResult;
  /** Échec à l'Esquive : un pied reste dans l'étrier (EDOC 07 l.180). */
  piedPris: boolean;
  /** États à poser sur le cavalier traîné, par id STABLE (EDOC 07 l.182). */
  etats: string[];
  /** Dégâts subis à chaque Round tant que le cavalier est traîné (EDOC 07 l.182). */
  degatsParRound: number;
  /** La monture est immobile : le Test étendu de `freeFootFromStirrupStep` est ouvert (EDOC 07 l.180). */
  liberationOuverte: boolean;
}

/**
 * Le cavalier vient de tomber de sa monture sur un Échec Stupéfiant — EDOC 07 l.180-182. Rend le Test
 * d'Esquive Intermédiaire (+0), les États et les Dégâts par Round de la situation qui en découle.
 * `mouvementMonture` = la Caractéristique de Mouvement de la bête, prise en Dégâts au trot/galop.
 */
export function resolveDraggedByStirrup(p: {
  /** Valeur TESTÉE d'Esquive du cavalier. */
  valeurEsquive: number;
  allure: DragAllure;
  mouvementMonture: number;
  rng: RNG;
}): DraggedByStirrupResult {
  const esquive = rollTest(p.valeurEsquive, 'intermediaire', p.rng);
  if (esquive.success) {
    return { esquive, piedPris: false, etats: [], degatsParRound: 0, liberationOuverte: false };
  }
  const immobile = p.allure === 'immobile';
  return {
    esquive,
    piedPris: true,
    etats: immobile ? [] : [COND.aTerre, COND.empetre],
    degatsParRound: immobile ? 0 : p.allure === 'pas' ? 1 : p.mouvementMonture,
    liberationOuverte: immobile,
  };
}

/**
 * Une passe du Test ÉTENDU d'Athlétisme Intermédiaire (+0) qui libère le pied, 3 DR — EDOC 07 l.180.
 * Le cumul passe par la primitive partagée `extendedTestStep` (source unique de l'arithmétique).
 */
export function freeFootFromStirrupStep(
  prevDR: number,
  valeurAthletisme: number,
  rng: RNG,
): { test: TestResult; total: number; done: boolean } {
  const test = rollTest(valeurAthletisme, 'intermediaire', rng);
  return { test, ...extendedTestStep(prevDR, test, STIRRUP_FREE_DR) };
}

/**
 * Trancher la sangle de l'étrier — EDOC 07 l.182 : Test de Capacité de Combat Très Difficile (−30),
 * possible seulement avec une arme tranchante à portée de main. Sans arme : aucun jet.
 */
export function cutStirrupStrap(
  valeurCC: number,
  armeTranchanteEnMain: boolean,
  rng: RNG,
): { test?: TestResult; tranche: boolean } {
  if (!armeTranchanteEnMain) return { tranche: false };
  const test = rollTest(valeurCC, 'tresDifficile', rng);
  return { test, tranche: test.success };
}
