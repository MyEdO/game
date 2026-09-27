// @vitest-environment jsdom
/**
 * `lancerScenario` (#1692) : le geste joueur « Lancer » du menu des scénarios de test passe par
 * l'unique lanceur, qui lit la fiche ET le contenu construit — dont `interludeWeeks` (ADE II 8 l.65).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { TestScenariosScreen } from '../ui/TestScenariosScreen';
import { testScenarios } from '../scenes/test-scenarios';
import { resetRule, setRule } from '../engine/policy';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;
beforeEach(() => { seedBattleRng(1234); });
afterEach(() => { act(() => root?.unmount()); container?.remove(); root = null; container = null; });

function cliquerLancer(id: string): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<TestScenariosScreen />));
  const bouton = container.querySelector<HTMLButtonElement>(`[data-testid="scenario-launch-${id}"]`);
  expect(bouton, `bouton « Lancer » de ${id}`).not.toBeNull();
  act(() => bouton!.click());
}

describe('menu des scénarios de test → lancerScenario', () => {
  it('« Lancer » une bataille de masse dont la fiche porte `interludeWeeks` ouvre l’interlude AVANT la bataille', () => {
    const sc = testScenarios.find((s) => s.id === 'bataille-de-masse')!;
    expect(sc.interludeWeeks).toBe(3);
    cliquerLancer(sc.id);
    const s = useGame.getState();
    expect(s.interlude?.weeks).toBe(3);
    expect(s.screen).toBe('interlude');
    expect(s.massBattle?.round).toBe(1);
    expect(s.party.map((h) => h.id)).toEqual(sc.construire().party.map((h) => h.id));
    expect(s.scene?.id).toBe('test-bataille-de-masse');
  });

  it('règle `interlude-enabled` coupée (LDB 21 l.108) : « Lancer » n’ouvre aucun interlude, la bataille démarre', () => {
    setRule('interlude-enabled', false);
    try {
      cliquerLancer('bataille-de-masse');
      const s = useGame.getState();
      expect(s.interlude).toBeNull();
      expect(s.massBattle?.round).toBe(1);
      expect(s.screen).toBe('massBattle');
    } finally {
      resetRule('interlude-enabled');
    }
  });

  it('chaque lancement CONSTRUIT à neuf : deux lancements ne partagent aucune scène', () => {
    const sc = testScenarios.find((s) => s.id === 'entrainement')!;
    expect(sc.construire().scene).not.toBe(sc.construire().scene);
    cliquerLancer(sc.id);
    expect(useGame.getState().screen).toBe('campaign');
    expect(useGame.getState().scene?.id).toBe(sc.construire().scene.id);
  });
});
