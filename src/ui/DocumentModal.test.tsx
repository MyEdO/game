// @vitest-environment jsdom
/**
 * La modale d'un document remis (#679) rend, sous son texte et DANS le parchemin, le même badge de
 * source que le Carnet (`SourceBadge`) : le même document n'a qu'une présentation.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { DocumentModal } from './DocumentModal';
import { bookAbr } from '../data';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  useGame.setState({ document: null });
});

function monte() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<DocumentModal />); });
}

describe('DocumentModal — la source du document', () => {
  it('document sourcé : le badge « abréviation du livre p.page » sous le texte, dans le parchemin', () => {
    useGame.setState({ document: { title: 'L’affiche', text: 'VOYAGEURS', source: { book: 'livre-de-base', page: 90 } } });
    monte();
    const badge = document.querySelector('.parchment-card .source-badge');
    expect(badge?.textContent).toBe(`${bookAbr('livre-de-base')} p.90`);
  });

  it('document sans source : aucun badge', () => {
    useGame.setState({ document: { title: 'L’affiche', text: 'VOYAGEURS' } });
    monte();
    expect(document.querySelector('.parchment-card')).toBeTruthy();
    expect(document.querySelector('.source-badge')).toBeNull();
  });
});
