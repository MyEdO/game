import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { runFlow } from './combatFlow';
import { testFlow, EMPTY_FLOW } from './flow';
import { seedBattleRng } from './battleRng';
import { createHero } from '../engine/character';
import { adresseDeCreation } from '../engine/adresseDeCreation';

/** Humains (Reiklander), « Affable *ou* Perspicace » (LDB 05 l.490) : Perspicace, la Sociabilité reste nue. */
const PERSPICACE = { [adresseDeCreation.especeTalent(0)]: { id: 'perspicace' } };

/**
 * Capricieux (Trait de créature, MSRC 15 l.149-159) : « Lorsqu'un Personnage effectue un Test de
 * Sociabilité en traitant avec la créature, lancez un dé selon le Tableau suivant : » — « 1 →
 * Soustraire 2 au DR ; 2-3 → Soustraire 1 au DR ; 4-7 → Utiliser le DR indiqué ; 8-9 → Ajouter 1 au
 * DR ; 10 → Ajouter 2 au DR ».
 *
 * Le delta porte sur le DR du Test résolu, réussi ou raté : la valeur testée et la cible du d100
 * restent celles du personnage, et l'issue reste celle du dé.
 */
describe('Capricieux — delta de DR sur le Test de Sociabilité résolu (MSRC 15 l.149-159)', () => {
  function openCharme(vsCapricieux?: boolean) {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Felix', seed: 1, speciesTalentChoices: PERSPICACE });
    h.characteristics.sociabilite = 60;
    h.skills = []; // pas d'avances → testValue = Sociabilité brute
    useGame.setState({ party: [h], pendingTest: null, battle: null });
    runFlow(useGame.getState, useGame.setState, testFlow(
      { skill: { id: 'charme' }, difficulty: 'intermediaire', ...(vsCapricieux ? { vsCapricieux: true } : {}) },
      EMPTY_FLOW, EMPTY_FLOW,
    ));
    return useGame.getState().pendingTest!;
  }

  beforeEach(() => {
    useGame.setState({ pendingTest: null, battle: null });
  });

  it('la table ne touche NI la valeur testée NI la cible du d100 (elle est portée à part, en DR)', () => {
    seedBattleRng(7); // d10 de l'interlocuteur = 1 → « Soustraire 2 au DR »
    const pt = openCharme(true);
    expect(pt.capriciousRoll).toBe(1);
    expect(pt.capriciousDR).toBe(-2);
    expect(pt.skillValue).toBe(60); // Sociabilité brute
    expect(pt.target).toBe(60); // Intermédiaire (+0)
  });

  it('jet RÉUSSI + table à 1 → DR −2, la réussite est INCHANGÉE', () => {
    seedBattleRng(7); // d10 = 1, puis d100 = 7 → DR 6 réussi
    openCharme(true);
    useGame.getState().testRoll();
    const pt = useGame.getState().pendingTest!;
    expect(pt.roll).toBe(7);
    expect(pt.success).toBe(true);
    expect(pt.sl).toBe(4); // 6 − 2
  });

  it('jet réussi DE JUSTESSE + table à 1 → DR −1 (le RAW ne pose aucun plancher), la réussite tient', () => {
    seedBattleRng(35); // d10 = 1, puis d100 = 51 (cible 60) → DR 1 réussi
    openCharme(true);
    useGame.getState().testRoll();
    const pt = useGame.getState().pendingTest!;
    expect(pt.roll).toBe(51);
    expect(pt.success).toBe(true); // le d100 est passé : la table ne défait pas l'issue
    expect(pt.sl).toBe(-1); // 1 − 2, appliqué tel quel
  });

  it('jet RATÉ + table à 10 → DR +2, l’échec est INCHANGÉ (aucune réussite créée)', () => {
    seedBattleRng(36); // d10 = 10, puis d100 = 95 → DR −3 raté
    openCharme(true);
    useGame.getState().testRoll();
    const pt = useGame.getState().pendingTest!;
    expect(pt.roll).toBe(95);
    expect(pt.success).toBe(false);
    expect(pt.sl).toBe(-1); // −3 + 2
  });

  it('MÊME jet, trois entrées de table : l’issue est identique, seul le DR se décale', () => {
    const run = (capDR: number) => {
      openCharme();
      useGame.setState({ pendingTest: { ...useGame.getState().pendingTest!, capriciousDR: capDR } });
      seedBattleRng(24); // MÊME graine → MÊME d100 pour les trois entrées
      useGame.getState().testRoll();
      const pt = useGame.getState().pendingTest!;
      return { roll: pt.roll, sl: pt.sl, success: pt.success };
    };
    const indique = run(0); // 4-7 : « Utiliser le DR indiqué »
    const moins2 = run(-2); // 1 : « Soustraire 2 au DR »
    const plus2 = run(2); // 10 : « Ajouter 2 au DR »
    expect(indique).toEqual({ roll: 34, sl: 3, success: true });
    expect(moins2).toEqual({ roll: 34, sl: 1, success: true });
    expect(plus2).toEqual({ roll: 34, sl: 5, success: true });
  });
});
