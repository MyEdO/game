// @vitest-environment jsdom
/**
 * La surcouche du Codex (`CodexOverlay`, chunk différé) a SA frontière `Suspense` dans `App` : pendant
 * que la fiche se charge, l'écran qu'elle couvre reste monté et visible — jamais remplacé par
 * « Chargement… », avec l'infobulle et le focus du joueur dedans. Module froid : le premier rendu d'un
 * `lazy` suspend toujours, même si son module est déjà en cache.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { resetDismissLayers } from './useDismissLayer';
import { App } from './App';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(() => {
  act(() => { useGame.getState().closeCodexOverlay(); });
  act(() => { root?.unmount(); });
  container?.remove();
  root = null;
  container = null;
  resetDismissLayers();
});

describe('App — la surcouche du Codex ne suspend pas l’écran qu’elle couvre', () => {
  it('à l’ouverture de la fiche, le menu reste visible et aucun « Chargement… » ne le remplace', async () => {
    act(() => { useGame.setState({ screen: 'menu', codexOverlay: null }); });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root!.render(<App />); });
    const menu = () => container!.querySelector<HTMLElement>('.menu');
    expect(menu(), 'témoin : l’écran menu est monté').not.toBeNull();

    act(() => { useGame.getState().openCodex({ category: 'talents', id: 'affable', label: 'Affable' }); });
    expect(container.querySelector('.lazy-fallback'), 'la fiche en chargement a remplacé l’écran par « Chargement… »').toBeNull();
    expect(menu()?.style.display, 'la fiche en chargement a masqué l’écran qu’elle couvre').not.toBe('none');

    for (let i = 0; i < 100 && !document.querySelector('.codex-modal'); i++) {
      await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    }
    expect(document.querySelector('.codex-modal'), 'la fiche chargée s’affiche').not.toBeNull();
  });
});
