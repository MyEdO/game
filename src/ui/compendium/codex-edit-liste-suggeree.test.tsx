// @vitest-environment jsdom
/**
 * Atelier du Codex — une liste de chaînes dont la clé désigne un dataset (`REF_LIST_DATASET`,
 * `CodexEdit.tsx`) propose à chaque rangée les libellés de ce dataset, chacun UNE fois : deux entrées
 * homonymes ne font qu'une suggestion, et une écriture au catalogue les rafraîchit. Les rangées d'un champ partagent UNE datalist. La rangée compose `SaisieSuggeree` (`refField/RefField.tsx`)
 * et garde la valeur écrite.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CodexEdit } from '../editor/codex/CodexEdit';
import { resetData, setDataset } from '../../data/overrides';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => { root.unmount(); });
  host.remove();
  resetData();
});

function monter(categoryKey: string, id: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root.render(<CodexEdit categoryKey={categoryKey} id={id} onClose={() => {}} />); });
}
/** Les valeurs de la datalist que le DOCUMENT résout pour ce champ. */
const suggestionsDe = (champ: HTMLInputElement): string[] =>
  [...(document.getElementById(champ.getAttribute('list') ?? '')?.querySelectorAll('option') ?? [])].map((o) => (o as HTMLOptionElement).value);

/** Critique NOMMÉ du banc : une séquelle de nouvelle occurrence, rien d'autre de la table réelle. */
const CRITIQUE_DE_BANC = {
  id: 'critique-de-banc',
  min: 1,
  max: 100,
  label: 'Critique de banc',
  ops: [],
  escalation: { onRepeat: { traumas: ['surdite'] } },
  desc: 'Description de banc.',
  source: { book: 'livre-de-base', page: 1 },
};

/** Traumatisme NOMMÉ du banc, écrit à la main : seuls `id` et `label` portent le contrat. */
const traumaDeBanc = (id: string, label: string) => ({
  id, type: 'traumas' as const, label, ops: [], desc: 'Description de banc.', source: { book: 'livre-de-base', page: 1 },
});

describe('CodexEdit — liste de références à saisie suggérée', () => {
  it('séquelles d’un Critique : chaque libellé de Traumatisme proposé une fois, la valeur écrite inchangée', () => {
    setDataset('traumas', [traumaDeBanc('surdite', 'Surdité'), traumaDeBanc('fracture-mineure', 'Fracture'), traumaDeBanc('fracture-majeure', 'Fracture')]);
    setDataset('criticalsTete', [CRITIQUE_DE_BANC]);

    monter('criticalsTete', CRITIQUE_DE_BANC.id);
    const champ = host.querySelector<HTMLInputElement>('input[aria-label="séquelles de nouvelle occurrence de escalation — valeur 1"]')!;
    expect(champ.value).toBe('surdite');
    expect(suggestionsDe(champ)).toEqual(['Surdité', 'Fracture']);
  });

  it('un Traumatisme écrit au catalogue après le montage s’ajoute aux suggestions', () => {
    setDataset('traumas', [traumaDeBanc('surdite', 'Surdité')]);
    setDataset('criticalsTete', [CRITIQUE_DE_BANC]);

    monter('criticalsTete', CRITIQUE_DE_BANC.id);
    act(() => setDataset('traumas', [traumaDeBanc('surdite', 'Surdité'), traumaDeBanc('cecite', 'Cécité')]));
    const champ = host.querySelector<HTMLInputElement>('input[aria-label="séquelles de nouvelle occurrence de escalation — valeur 1"]')!;
    expect(suggestionsDe(champ)).toEqual(['Surdité', 'Cécité']);
  });

  it('les rangées d’un même champ désignent UNE datalist partagée', () => {
    setDataset('traumas', [traumaDeBanc('surdite', 'Surdité'), traumaDeBanc('fracture-mineure', 'Fracture')]);
    setDataset('criticalsTete', [{ ...CRITIQUE_DE_BANC, escalation: { onRepeat: { traumas: ['surdite', 'fracture-mineure'] } } }]);

    monter('criticalsTete', CRITIQUE_DE_BANC.id);
    const rangees = [1, 2].map((n) => host.querySelector<HTMLInputElement>(`input[aria-label="séquelles de nouvelle occurrence de escalation — valeur ${n}"]`)!);
    expect(rangees.map((r) => r.value)).toEqual(['surdite', 'fracture-mineure']);
    expect(rangees[0].getAttribute('list')).toBeTruthy();
    expect(rangees[1].getAttribute('list')).toBe(rangees[0].getAttribute('list'));
    expect(rangees[0].closest('.ed-field')!.querySelectorAll('datalist')).toHaveLength(1);
  });
});
