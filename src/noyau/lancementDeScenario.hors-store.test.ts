/**
 * Le lancement d'un scénario de test (#1692, `lancerLeScenario`) lit la fiche ET le contenu construit, dont
 * `interludeWeeks` (ADE II 8 l.65). Le geste « Lancer » du menu des scénarios se joue en `src/state/scenarioFlow.test.tsx`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { seedBattleRng } from './battleRng';
import { lancerLeScenario } from './lancementDeScenario';
import { lancementDuScenario } from '../scenes/test-scenarios/_shared';
import { testScenarios } from '../scenes/test-scenarios';
import { resetRule, setRule } from '../engine/policy';
import { ouvrirLeBanc, type Banc } from './banc.testkit';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
  seedBattleRng(1234);
});

/** Lance le scénario `id` par l'unique séquence que joue aussi le menu. */
function lancer(id: string): void {
  lancerLeScenario(banc.getState, banc.setState, lancementDuScenario(testScenarios.find((s) => s.id === id)!));
}

describe('menu des scénarios de test → lancerScenario', () => {
  it('« Lancer » une bataille de masse dont la fiche porte `interludeWeeks` ouvre l’interlude AVANT la bataille', () => {
    const sc = testScenarios.find((s) => s.id === 'bataille-de-masse')!;
    expect(sc.interludeWeeks).toBe(3);
    lancer(sc.id);
    const s = banc.getState();
    expect(s.interlude?.weeks).toBe(3);
    expect(s.screen).toBe('interlude');
    expect(s.massBattle?.round).toBe(1);
    expect(s.party.map((h) => h.id)).toEqual(sc.construire().party.map((h) => h.id));
    expect(s.scene?.id).toBe('test-bataille-de-masse');
  });

  it('règle `interlude-enabled` coupée (LDB 21 l.108) : « Lancer » n’ouvre aucun interlude, la bataille démarre', () => {
    setRule('interlude-enabled', false);
    try {
      lancer('bataille-de-masse');
      const s = banc.getState();
      expect(s.interlude).toBeNull();
      expect(s.massBattle?.round).toBe(1);
      expect(s.screen).toBe('massBattle');
    } finally {
      resetRule('interlude-enabled');
    }
  });
});
