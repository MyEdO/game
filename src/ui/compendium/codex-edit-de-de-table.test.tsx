// @vitest-environment jsdom
/**
 * Atelier du Codex — le DÉ DE TIRAGE d'une table que porte un ANCÊTRE de ses rangées (document de
 * Critiques, racine des Rencontres…) s'édite avec une rangée et s'enregistre par son seam
 * (`setEnTete`, #1667) ; une table dont le dé est un champ de l'entrée n'offre pas ce champ.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from '../editor/codex/CodexEdit';
import { datasetArray, deDeLaTable, resetData } from '../../data/overrides';

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

function monter(categoryKey: string, id: string) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<CodexEdit categoryKey={categoryKey} id={id} onClose={() => {}} />); });
}

const champDuDe = () => container.querySelector<HTMLInputElement>('input[aria-label="Dé de tirage"]');

function saisir(champ: HTMLInputElement, valeur: string) {
  act(() => {
    champ.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, valeur);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => { champ.blur(); });
}

describe('atelier du Codex — dé de tirage de la table', () => {
  it('le dé du document de Critiques s’édite avec une rangée et s’enregistre par le seam', async () => {
    const rangee = (datasetArray('criticalsCorps') as { id: string }[])[0];
    monter('criticalsCorps', rangee.id);
    expect(champDuDe()!.value).toBe('d100');
    saisir(champDuDe()!, '2d10');
    const enregistrer = container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;
    expect(enregistrer.disabled, 'le dé saisi n’a rien rendu modifié').toBe(false);
    await act(async () => { enregistrer.click(); });
    expect(deDeLaTable('criticalsCorps')).toBe('2d10');
  });

  it('une expression illisible n’est pas retenue', () => {
    const rangee = (datasetArray('criticalsCorps') as { id: string }[])[0];
    monter('criticalsCorps', rangee.id);
    saisir(champDuDe()!, 'beaucoup');
    expect(champDuDe()!.value).toBe('d100');
  });

  it('une Table de Corruption, dont le dé est un champ de l’entrée, n’offre pas le dé de la table', () => {
    const table = (datasetArray('mutationTables') as { id: string }[])[0];
    monter('mutationTables', table.id);
    expect(champDuDe()).toBeNull();
  });
});
