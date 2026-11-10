// @vitest-environment jsdom
/**
 * Atelier du Codex — les tables tirées s'éditent (#1667) : la rangée d'une table d'effets (`tables.json`)
 * s'enregistre et le lecteur du moteur la tire ; une rangée d'Incantation Imparfaite révisée (VDM) offre le
 * dé de son document et s'enregistre par le seam.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from '../editor/codex/CodexEdit';
import { datasetArray, deDeLaTable, resetData } from '../../data/overrides';
import { findEffectTableById } from '../../data/effectTables';
import { findTableEntry } from '../../engine/tables';

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

function saisir(champ: HTMLInputElement, valeur: string) {
  act(() => {
    champ.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, valeur);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => { champ.blur(); });
}

async function enregistrer() {
  const bouton = container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;
  expect(bouton.disabled, 'la saisie n’a rien rendu modifié').toBe(false);
  await act(async () => { bouton.click(); });
}

describe('atelier du Codex — tables tirées', () => {
  it('la rangée d’une table d’effets s’édite, et le moteur tire la rangée enregistrée', async () => {
    monter('effectTables', 'allure-demoniaque-nurgle');
    const libelle = container.querySelector<HTMLInputElement>('input[aria-label="Libellé de la rangée 10"]');
    expect(libelle, 'les rangées de la table s’éditent').not.toBeNull();
    saisir(libelle!, 'Rangée éditée');
    await enregistrer();
    expect(findTableEntry(findEffectTableById('allure-demoniaque-nurgle').entries, 10).label).toBe('Rangée éditée');
  });

  it('une rangée d’Incantation Imparfaite révisée offre le dé de son document et s’enregistre par le seam', async () => {
    const rangee = (datasetArray('miscastMinorVdm') as { id: string }[])[0];
    monter('miscastMinorVdm', rangee.id);
    const de = container.querySelector<HTMLInputElement>('input[aria-label="Dé de tirage"]')!;
    expect(de.value).toBe('d100');
    saisir(de, '2d50');
    await enregistrer();
    expect(deDeLaTable('miscastMinorVdm')).toBe('2d50');
  });
});
