import { describe, it, expect } from 'vitest';
import type { RNG } from './dice';
import {
  boardMovingVehicle,
  boardMovingMount,
  boardingDifficulty,
  resolveDraggedByStirrup,
  freeFootFromStirrupStep,
  cutStirrupStrap,
  CHUTE_SELLE_M,
  STIRRUP_FREE_DR,
} from './mountedManeuvers';
import { desEnSuite } from './dice.testkit';

/** RNG SCRIPTÉ : rend les jets dans l'ordre exact où les résolveurs les consomment (aucun clamp — un
 *  jet de trop ou de moins rend `undefined` et fait échouer le test, ce qui EST le contrat mesuré). */
const script = (...vals: number[]): RNG => desEnSuite(vals);

describe('« ON NE S\'ARRÊTE PAS ! » — embarquement en mouvement (EDOC 07 l.326-330)', () => {
  it('Difficulté : Intermédiaire à vitesse égale, Difficile (−20) depuis l\'arrêt', () => {
    expect(boardingDifficulty(false)).toBe('intermediaire');
    expect(boardingDifficulty(true)).toBe('difficile');
  });

  it('véhicule : Athlétisme réussi → à bord, aucune chute', () => {
    const r = boardMovingVehicle({ valeurAthletisme: 50, rng: script(30) });
    expect(r.athletisme.target).toBe(50);
    expect(r.aBord).toBe(true);
    expect(r.chuteM).toBeUndefined();
  });

  it('véhicule depuis l\'arrêt : cible à −20, échec → chute de 2 m', () => {
    const r = boardMovingVehicle({ valeurAthletisme: 50, depuisArret: true, rng: script(40) });
    expect(r.athletisme.target).toBe(30);
    expect(r.aBord).toBe(false);
    expect(r.chuteM).toBe(CHUTE_SELLE_M);
  });

  it('monture sans cavalier NI Trait Nerveux : le seul Test d\'Athlétisme suffit', () => {
    const r = boardMovingMount({ valeurAthletisme: 50, rng: script(20) });
    expect(r.aBord).toBe(true);
    expect(r.controleMonture).toBeUndefined();
    expect(r.disputeSelle).toBeUndefined();
  });

  it('monture NERVEUSE : Chevaucher Intermédiaire (+0) enchaîné — réussi puis raté (chute MAISON)', () => {
    const ok = boardMovingMount({ valeurAthletisme: 50, montureNerveuse: true, valeurChevaucher: 40, rng: script(20, 30) });
    expect(ok.controleMonture?.target).toBe(40); // Intermédiaire (+0) — l.328
    expect(ok.aBord).toBe(true);
    expect(ok.chuteM).toBeUndefined();

    const ko = boardMovingMount({ valeurAthletisme: 50, montureNerveuse: true, valeurChevaucher: 40, rng: script(20, 55) });
    expect(ko.controleMonture?.success).toBe(false);
    expect(ko.aBord).toBe(false);
    expect(ko.chuteM).toBe(CHUTE_SELLE_M);
  });

  it('depuis l\'arrêt : le −20 de l.330 porte sur le SAUT, pas sur le Chevaucher enchaîné', () => {
    // l.330 vise « l'une ou l'autre de ces manœuvres » (= les deux sauts de l.328) ; le Chevaucher ne
    // se lance qu'après un embarquement RÉUSSI — le sauteur est en selle, plus à l'arrêt.
    const r = boardMovingMount({ valeurAthletisme: 50, depuisArret: true, montureNerveuse: true, valeurChevaucher: 40, rng: script(20, 30) });
    expect(r.athletisme.target).toBe(30); // 50 − 20
    expect(r.controleMonture?.target).toBe(40); // Intermédiaire (+0), NON cumulé
    expect(r.aBord).toBe(true);
  });

  it('monture DÉJÀ montée : Test opposé de Chevaucher, le perdant est éjecté', () => {
    // Sauteur 50 (jet 10, +4 DR) contre cavalier 50 (jet 60, −1 DR).
    const gagne = boardMovingMount({ valeurAthletisme: 50, valeurChevaucher: 50, cavalier: { valeurChevaucher: 50 }, rng: script(20, 10, 60) });
    expect(gagne.disputeSelle?.winner).toBe('attacker');
    expect(gagne.ejecte).toBe('cavalier');
    expect(gagne.aBord).toBe(true);
    expect(gagne.chuteM).toBe(CHUTE_SELLE_M);

    const perd = boardMovingMount({ valeurAthletisme: 50, valeurChevaucher: 50, cavalier: { valeurChevaucher: 50 }, rng: script(20, 60, 10) });
    expect(perd.ejecte).toBe('sauteur');
    expect(perd.aBord).toBe(false);
  });

  it('égalité au Test opposé : nul n\'est éjecté, et le sauteur — resté sans selle — chute (MAISON)', () => {
    const r = boardMovingMount({ valeurAthletisme: 50, valeurChevaucher: 50, cavalier: { valeurChevaucher: 50 }, rng: script(20, 30, 30) });
    expect(r.disputeSelle?.winner).toBe('tie');
    expect(r.ejecte).toBeUndefined();
    expect(r.aBord).toBe(false);
    // EDOC 07 l.328 nomme « le gagnant » et « le perdant » ; l'égalité n'y figure pas. Comportement
    // mesuré : le sauteur, resté sans selle, subit la chute de 2 m (EDOC 07 l.167, l.174, l.178).
    expect(r.chuteM).toBe(CHUTE_SELLE_M);
  });

  it('Athlétisme raté : aucun Test de Chevaucher n\'est lancé (chute immédiate)', () => {
    const r = boardMovingMount({ valeurAthletisme: 30, valeurChevaucher: 50, cavalier: { valeurChevaucher: 50 }, rng: script(80) });
    expect(r.aBord).toBe(false);
    expect(r.chuteM).toBe(CHUTE_SELLE_M);
    expect(r.disputeSelle).toBeUndefined();
  });
});

describe('« TRAÎNÉ AU SOL » — pied pris dans l\'étrier (EDOC 07 l.176-182)', () => {
  it('Esquive réussie : le pied se dégage, rien à poser', () => {
    const r = resolveDraggedByStirrup({ valeurEsquive: 40, allure: 'galop', mouvementMonture: 8, rng: script(20) });
    expect(r.piedPris).toBe(false);
    expect(r.etats).toEqual([]);
    expect(r.degatsParRound).toBe(0);
    expect(r.liberationOuverte).toBe(false);
  });

  it('monture IMMOBILE : pied pris, aucun État ni Dégât, Test étendu ouvert', () => {
    const r = resolveDraggedByStirrup({ valeurEsquive: 40, allure: 'immobile', mouvementMonture: 8, rng: script(70) });
    expect(r.piedPris).toBe(true);
    expect(r.liberationOuverte).toBe(true);
    expect(r.etats).toEqual([]);
    expect(r.degatsParRound).toBe(0);
  });

  it('monture au PAS : À Terre + Empêtré, 1 Dégât par Round', () => {
    const r = resolveDraggedByStirrup({ valeurEsquive: 40, allure: 'pas', mouvementMonture: 8, rng: script(70) });
    expect(r.etats).toEqual(['a-terre', 'empetre']);
    expect(r.degatsParRound).toBe(1);
    expect(r.liberationOuverte).toBe(false);
  });

  it('monture au TROT/GALOP : le Mouvement de la monture en Dégâts par Round', () => {
    expect(resolveDraggedByStirrup({ valeurEsquive: 40, allure: 'trot', mouvementMonture: 8, rng: script(70) }).degatsParRound).toBe(8);
    expect(resolveDraggedByStirrup({ valeurEsquive: 40, allure: 'galop', mouvementMonture: 6, rng: script(70) }).degatsParRound).toBe(6);
  });

  it('libération : Test ÉTENDU d\'Athlétisme à 3 DR (cumul `extendedTestStep`)', () => {
    expect(STIRRUP_FREE_DR).toBe(3);
    const un = freeFootFromStirrupStep(0, 50, script(10)); // +4 DR d'un coup
    expect(un.total).toBe(4);
    expect(un.done).toBe(true);

    const partiel = freeFootFromStirrupStep(1, 50, script(45)); // +1 DR → cumul 2 < 3
    expect(partiel.total).toBe(2);
    expect(partiel.done).toBe(false);
  });

  it('trancher la sangle : Capacité de Combat Très Difficile (−30), et seulement arme en main', () => {
    const sansArme = cutStirrupStrap(60, false, script(25));
    expect(sansArme.test).toBeUndefined();
    expect(sansArme.tranche).toBe(false);

    const avecArme = cutStirrupStrap(60, true, script(25));
    expect(avecArme.test?.target).toBe(30);
    expect(avecArme.tranche).toBe(true);
  });
});
