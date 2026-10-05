// @vitest-environment jsdom
/**
 * #1993 — un JSON invalide tapé dans un `JsonField` (repli d'un champ hors gabarit) est une SAISIE EN
 * COURS non retenue : marqué `aria-invalid`, dit par son message, et il bloque « Enregistrer », qui
 * poserait sinon la dernière valeur valide sans rien dire.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from './CodexEdit';
import { datasetArray, setDataset, resetData } from '../../data/overrides';

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

function saisir(champ: HTMLTextAreaElement, valeur: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(champ, valeur);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

type Domaine = { id: string; label: string; windModifiers?: Record<string, unknown>[] };

describe('atelier du Codex — JSON invalide en saisie', () => {
  it('marqué, expliqué, et Enregistrer bloqué tant qu’il reste invalide', () => {
    const domaines = datasetArray('domains') as Domaine[];
    const d = domaines.find((x) => (x.windModifiers?.length ?? 0) >= 1);
    expect(d, 'aucun domaine à rangée windModifiers — la mesure ne porte sur rien').toBeTruthy();
    // Un sous-champ tableau-de-tableaux n'a pas de gabarit : il retombe sur `JsonField`.
    setDataset('domains', domaines.map((x) => (x === d ? { ...x, windModifiers: x.windModifiers!.map((m) => ({ ...m, grille: [[1, 2], [3]] })) } : x)) as never);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<CodexEdit categoryKey="domains" id={d!.id} onClose={() => {}} />); });

    const json = [...container.querySelectorAll<HTMLTextAreaElement>('textarea')].find((t) => t.closest('label')?.querySelector('em')?.textContent === '(JSON)');
    expect(json, 'aucun JsonField monté').toBeTruthy();
    const enregistrer = () => container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;

    saisir(json!, '[[9]]');
    expect(json!.getAttribute('aria-invalid')).toBeNull();
    expect(enregistrer().disabled, 'un JSON valide n’a rien émis').toBe(false);

    saisir(json!, '[[9');
    expect(json!.getAttribute('aria-invalid')).toBe('true');
    const message = document.getElementById(json!.getAttribute('aria-describedby') ?? '');
    expect(message?.textContent).toBe('JSON invalide : cette saisie n\'est pas retenue.');
    expect(enregistrer().disabled, 'Enregistrer poserait la dernière valeur valide en silence').toBe(true);

    saisir(json!, '[[9, 8]]');
    expect(json!.getAttribute('aria-invalid')).toBeNull();
    expect(enregistrer().disabled).toBe(false);
  });
});
