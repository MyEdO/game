// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../monterRacine.testkit';
import { useGame } from '../state/store';
import { App } from './App';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Le drill-in Codex (`openCodex`, modale `CodexOverlay`) se pose PAR-DESSUS l'écran courant : le
 *  premier chargement de son chunk ne remplace pas cet écran par le repli de chargement. */
describe('App — la modale Codex ne suspend pas l’écran dessous', () => {
  afterEach(() => {
    act(() => { useGame.setState({ codexOverlay: null }); });
    demonterRacines();
  });

  it('écran courant visible, sans « Chargement… », pendant que la modale se charge', async () => {
    useGame.setState({ screen: 'menu', codexOverlay: null });
    const { container } = monterRacine(<App />);
    const menu = container.querySelector<HTMLElement>('.menu')!;
    expect(menu).not.toBeNull();
    act(() => { useGame.getState().openCodex({ category: 'traits', id: 'marque-de-tzeentch', label: 'Marque de Tzeentch' }); });
    expect(container.querySelector('.lazy-fallback')).toBeNull();
    expect(container.querySelector<HTMLElement>('.menu')?.style.display).not.toBe('none');
    await act(async () => { await import('./compendium/CompendiumScreen'); });
  });
});
