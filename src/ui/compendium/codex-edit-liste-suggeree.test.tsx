// @vitest-environment jsdom
/**
 * Atelier du Codex — les séquelles d'un Critique (`refs('trauma')`, `defs/criticals.ts`) sont une liste
 * d'ids NUS du catalogue des Traumatismes : chaque rangée est le `<select>` du mode liste de `RefField`
 * (`cfgDeLaListe` → `ListRefField`), qui montre le libellé, écrit l'id, et suit les écritures au catalogue.
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
/** Les options proposées par une rangée : valeur stockée et libellé affiché. */
const optionsDe = (champ: HTMLSelectElement): [string, string][] =>
  [...champ.options].map((o) => [o.value, o.textContent ?? '']);

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

describe('CodexEdit — séquelles d’un Critique, liste de références au catalogue des Traumatismes', () => {
  const rangee = (n: number) => host.querySelector<HTMLSelectElement>(`select[aria-label="séquelles de nouvelle occurrence de aggravation — valeur ${n}"]`)!;

  it('chaque rangée propose les Traumatismes du catalogue par libellé, la valeur écrite inchangée', () => {
    setDataset('traumas', [traumaDeBanc('surdite', 'Surdité'), traumaDeBanc('fracture-mineure', 'Fracture mineure')]);
    setDataset('criticalsTete', [CRITIQUE_DE_BANC]);

    monter('criticalsTete', CRITIQUE_DE_BANC.id);
    expect(rangee(1).value).toBe('surdite');
    expect(optionsDe(rangee(1))).toEqual([['fracture-mineure', 'Fracture mineure'], ['surdite', 'Surdité']]);
  });

  it('un Traumatisme écrit au catalogue après le montage s’ajoute aux options', () => {
    setDataset('traumas', [traumaDeBanc('surdite', 'Surdité')]);
    setDataset('criticalsTete', [CRITIQUE_DE_BANC]);

    monter('criticalsTete', CRITIQUE_DE_BANC.id);
    act(() => setDataset('traumas', [traumaDeBanc('surdite', 'Surdité'), traumaDeBanc('cecite', 'Cécité')]));
    expect(optionsDe(rangee(1))).toEqual([['cecite', 'Cécité'], ['surdite', 'Surdité']]);
  });

  it('chaque rangée porte son id, et le choix d’une option écrit l’id dans la liste', () => {
    setDataset('traumas', [traumaDeBanc('surdite', 'Surdité'), traumaDeBanc('fracture-mineure', 'Fracture mineure')]);
    setDataset('criticalsTete', [{ ...CRITIQUE_DE_BANC, escalation: { onRepeat: { traumas: ['surdite', 'fracture-mineure'] } } }]);

    monter('criticalsTete', CRITIQUE_DE_BANC.id);
    expect([rangee(1).value, rangee(2).value]).toEqual(['surdite', 'fracture-mineure']);
    act(() => {
      rangee(2).value = 'surdite';
      rangee(2).dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect([rangee(1).value, rangee(2).value]).toEqual(['surdite', 'surdite']);
  });
});
