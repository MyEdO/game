// @vitest-environment jsdom
/**
 * `lancerScenario` (#1692) : le geste joueur « Lancer » du menu des scénarios de test passe par
 * l'unique lanceur. Ce que ce lanceur lit de la fiche (`interludeWeeks`, ADE II 8 l.65) se joue au banc du noyau
 * (`src/noyau/lancementDeScenario.hors-store.test.ts`).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from '../noyau/battleRng';
import { TestScenariosScreen } from '../ui/TestScenariosScreen';
import { testScenarios } from '../scenes/test-scenarios';

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
  it('chaque lancement CONSTRUIT à neuf : deux lancements ne partagent aucune scène', () => {
    const sc = testScenarios.find((s) => s.id === 'entrainement')!;
    expect(sc.construire().scene).not.toBe(sc.construire().scene);
    cliquerLancer(sc.id);
    expect(useGame.getState().screen).toBe('campaign');
    expect(useGame.getState().scene?.id).toBe(sc.construire().scene.id);
  });
});
