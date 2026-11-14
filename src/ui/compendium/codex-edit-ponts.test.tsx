// @vitest-environment jsdom
/**
 * Atelier du Codex — les PONTS d'un navire (`vehicles.ponts`, #3686) s'éditent par leur éditeur dédié : une carte
 * par pont, puis la hauteur de chaque glyphe de case que les cartes portent ; la paire s'enregistre ensemble.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from '../editor/codex/CodexEdit';
import { datasetArray, resetData } from '../../data/overrides';
import { grilleDesPonts } from '../../data/schemas/grammaire/carte-ascii';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  resetData();
});

const caraque = () => datasetArray('vehicles').find((v) => v.id === 'caraque')!;

function monter() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<CodexEdit categoryKey="vehicles" id="caraque" onClose={() => {}} />); });
}

describe('atelier du Codex — ponts d’un navire', () => {
  it('une carte par pont et une hauteur par glyphe de case ; une hauteur saisie s’enregistre avec ses cartes', async () => {
    const [cartes, hauteurs] = caraque().ponts!;
    monter();
    expect([...container.querySelectorAll<HTMLTextAreaElement>('textarea[aria-label^="Pont "]')].map((t) => t.value)).toEqual(cartes);
    const glyphes = [...new Set(grilleDesPonts(cartes).cases.map((c) => c.glyphe))];
    const champ = (g: string) => container.querySelector<HTMLInputElement>(`input[aria-label="Hauteur du glyphe ${g} (m)"]`)!;
    expect(glyphes.map((g) => Number(champ(g).value))).toEqual(glyphes.map((g) => hauteurs[g]));

    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ('c'), '-2.5');
      champ('c').dispatchEvent(new Event('input', { bubbles: true }));
    });
    const enregistrer = container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;
    expect(enregistrer.disabled, 'la hauteur saisie n’a rien rendu modifié').toBe(false);
    await act(async () => { enregistrer.click(); });
    expect(caraque().ponts).toEqual([cartes, { ...hauteurs, c: -2.5 }]);
  });
});
