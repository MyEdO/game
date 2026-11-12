import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { rollTest, extendedTestStep, type TestResult } from './tests';
import { findTavernGameById, resolveTavernRound, rollTavernTest, TAVERN_GAMES, TAVERN_TEST_DIFFICULTY } from './tavernGame';

describe('Jeux de taverne — moteur générique (NADJ 16)', () => {
  it('les jeux sont en données, chacun avec une règle verbatim et une source', () => {
    expect(TAVERN_GAMES.length).toBeGreaterThan(0);
    for (const g of TAVERN_GAMES) {
      expect(g.desc.length).toBeGreaterThan(30); // règle recopiée
      expect(g.source.book).toBe('nuits-agitees-et-dures-journees');
      // Un jeu de MISE ne se résout pas au Test : il ne déclare aucun mode, mais ses règles de pot.
      if (g.pot) expect(g.mode).toBeUndefined();
      else expect(['oppose', 'etendu']).toContain(g.mode);
    }
  });

  it('variante rapide (l.11) : le plus de DR l’emporte — une compétence supérieure gagne le plus souvent', () => {
    const dominos = findTavernGameById('dominos')!;
    let pWins = 0;
    for (let seed = 0; seed < 60; seed++) {
      const rng = makeRNG(seed);
      const playerTR = rollTest(70, TAVERN_TEST_DIFFICULTY, rng);
      const opponentTR = rollTavernTest(25, rng);
      const r = resolveTavernRound(dominos, playerTR, opponentTR);
      if (r.winner === 'joueur') pWins++;
    }
    expect(pWins).toBeGreaterThan(40); // 70 % vs 25 % : le joueur fort domine
  });

  it('déterminisme : même seed → même issue', () => {
    const flechettes = findTavernGameById('flechettes')!;
    const rngA = makeRNG(3);
    const a = resolveTavernRound(flechettes, rollTest(45, TAVERN_TEST_DIFFICULTY, rngA), rollTavernTest(45, rngA));
    const rngB = makeRNG(3);
    const b = resolveTavernRound(flechettes, rollTest(45, TAVERN_TEST_DIFFICULTY, rngB), rollTavernTest(45, rngB));
    expect(a).toEqual(b);
  });

  /**
   * LE TEST OPPOSÉ ÉTENDU DU BRAS DE FER (l.34 : « faites un Test opposé étendu de Force ») — donc le
   * cumul du LDB 12 l.174 verbatim : « les DR obtenus à chaque Round sont additionnés jusqu'à
   * atteindre une valeur cible […]. Si le DR total passe en dessous de 0, vous pouvez recommencer
   * depuis le début ». Le DR d'une manche entre AVEC SON SIGNE ; c'est le TOTAL qui est planché.
   * Ce test remplace celui qui recopiait `Math.max(0, DR)` PAR MANCHE : cette forme-là n'est nulle
   * part dans la source, et elle rendait un cumul de 9 là où le Test étendu en rend 6.
   */
  it('mode ÉTENDU (Bras de fer, l.34) : le DR de chaque manche s’AJOUTE AVEC SON SIGNE, le TOTAL est planché (LDB 12 l.174)', () => {
    const bras = findTavernGameById('bras-de-fer')!;
    expect(bras.mode).toBe('etendu');
    expect(bras.target).toBe(10);
    const manches = [4, 3, -3, 2]; // DR de manche POSÉS : aucun dé, l'arithmétique seule est en cause
    let total = 0;
    for (const sl of manches) total = extendedTestStep(total, { success: sl >= 0, sl }, bras.target!).total;
    expect(total, 'le Test étendu : 4+3−3+2').toBe(6);
    // La forme ÉCARTÉE (plancher PAR MANCHE) ignorerait la manche perdue et rendrait 9 — l'écart est
    // exactement celui que la correction supprime.
    expect(manches.reduce((n, sl) => n + Math.max(0, sl), 0)).toBe(9);
    // Et le plancher du TOTAL, lui, existe bien : une chute sous 0 ramène à 0 (« recommencez »).
    expect(extendedTestStep(2, { success: false, sl: -9 }, 10)).toEqual({ total: 0, done: false, repart: true, sl: -9 });
  });

  /** « à chaque tour, ajoutez votre Bonus de Force au nombre de DR que vous avez obtenus » (l.34) —
   *  le Bonus s'ajoute APRÈS le plafond de manche, PAR CAMP, et peut renverser la manche. */
  it('mode ÉTENDU : le Bonus de Caractéristique s’ajoute au DR de la manche, par camp (l.34)', () => {
    const bras = findTavernGameById('bras-de-fer')!;
    expect(bras.drBonus).toBe('force');
    const fort: TestResult = { roll: 30, target: 45, sl: 1, success: true, isDouble: false, base: 45 };
    const faible: TestResult = { roll: 20, target: 35, sl: 2, success: true, isDouble: false, base: 35 };
    expect(resolveTavernRound(bras, fort, faible).winner, 'sans Bonus, 1 DR contre 2').toBe('adversaire');
    const avec = resolveTavernRound(bras, fort, faible, { joueur: 4, adversaire: 1 });
    expect(avec.dr.joueur).toBe(5);
    expect(avec.dr.adversaire).toBe(3);
    expect(avec.winner, 'Bonus de Force compris, la manche bascule').toBe('joueur');
  });

  it('plafond de DR par manche (Boules = 6, drCap)', () => {
    const boules = findTavernGameById('boules')!;
    expect(boules.drCap).toBe(6);
    for (let seed = 0; seed < 40; seed++) {
      const rng = makeRNG(seed);
      // valeurs énormes → DR bruts > 6
      const r = resolveTavernRound(boules, rollTest(100, TAVERN_TEST_DIFFICULTY, rng), rollTavernTest(100, rng));
      expect(r.dr.joueur).toBeLessThanOrEqual(6);
      expect(r.dr.adversaire).toBeLessThanOrEqual(6);
    }
  });

  it('Al-Zahr n’indique aucune Compétence → repli Pari (`skill` ABSENT, l.11)', () => {
    expect(findTavernGameById('al-zahr')!.skill).toBeUndefined();
  });
});
