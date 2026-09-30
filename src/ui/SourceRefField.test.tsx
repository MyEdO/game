// @vitest-environment jsdom
/**
 * Contrats de la primitive `SourceRefField` (#679) : le livre se CHOISIT dans `books` (id stocké, libellé
 * affiché), livre et page vides = aucune source, la `note` posée survit. Dernier volet : le site
 * générique du Codex (kind `source`) la monte.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SourceRefField } from './SourceRefField';
import { CodexEdit } from './compendium/CodexEdit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

function mount(node: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(node); });
}

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

const selecteurDeLivre = () => container.querySelector('.source-ref select') as HTMLSelectElement;

function choisir(select: HTMLSelectElement, valeur: string) {
  act(() => {
    select.value = valeur;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('SourceRefField — une SourceRef éditée', () => {
  it('le livre se choisit dans `books` : le LIBELLÉ s’affiche, l’id est stocké, la note survit', () => {
    const onChange = vi.fn();
    mount(<SourceRefField label="Source" value={{ book: '', page: 12, note: 'ch. 3' }} onChange={onChange} avecNote />);
    const select = selecteurDeLivre();
    const option = [...select.options].find((o) => o.value === 'livre-de-base');
    expect(option?.textContent).toBe('Livre de Base');
    choisir(select, 'livre-de-base');
    expect(onChange).toHaveBeenLastCalledWith({ book: 'livre-de-base', page: 12, note: 'ch. 3' });
  });

  it('livre remis à vide sur une page vide : AUCUNE source', () => {
    const onChange = vi.fn();
    mount(<SourceRefField label="Source" value={{ book: 'livre-de-base', page: 0 }} onChange={onChange} />);
    choisir(selecteurDeLivre(), '');
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('la note ne se saisit que si le site la demande', () => {
    mount(<SourceRefField label="Source" value={undefined} onChange={vi.fn()} />);
    expect(container.querySelector('input[aria-label="Source — note"]')).toBeNull();
  });
});

describe('le site générique du Codex monte la primitive', () => {
  it('talent neuf : la source se choisit dans les livres, pas en texte libre', () => {
    mount(<CodexEdit categoryKey="talents" label="" isNew onClose={() => {}} />);
    const select = selecteurDeLivre();
    expect(select, 'aucun sélecteur de livre sur la source d’un talent neuf').toBeTruthy();
    expect([...select.options].map((o) => o.value)).toContain('livre-de-base');
  });
});
