// @vitest-environment jsdom
/**
 * #1993 — un champ LISTE d'un enum (nœud `array` d'enum, ex. `domains.windModifiers[].when`) est un
 * ENSEMBLE : une case par valeur de l'enum (`EnsembleDeCases`, le rendu des autres ensembles de
 * l'atelier). Vidé, un champ que son nœud laisse absent (domains.ts:116-118) émet `undefined` :
 * l'entrée s'enregistre, sans le `when: []` que `.min(1)` refuse.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from './CodexEdit';
import { datasetArray, setDataset } from '../../data/overrides';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  vi.restoreAllMocks();
});

type Domaine = { id: string; label: string; windModifiers?: { when?: string[] }[] };

function monter(d: Domaine) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<CodexEdit categoryKey="domains" id={d.id} onClose={() => {}} />); });
}
const cases = (n: number) => [...container.querySelectorAll<HTMLInputElement>(`[role="group"][aria-label^="when de la rangée ${n} "] input[type="checkbox"]`)];
const cochees = (n: number) => cases(n).filter((c) => c.checked);

describe('atelier du Codex — une liste de valeurs d’enum est un ensemble de cases', () => {
  const avant = (datasetArray('domains') as Domaine[]).slice();
  const d = avant.find((x) => (x.windModifiers?.length ?? 0) >= 2 && x.windModifiers!.every((m) => m.when?.length));

  it('domaine à modificateurs de vent : aucun contrôle ne reçoit de tableau, chaque rangée coche ses valeurs', () => {
    expect(d, 'aucun domaine ne porte deux `windModifiers[].when` — la mesure ne porte sur rien').toBeTruthy();
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {});
    monter(d!);
    expect(erreurs.mock.calls.filter((c) => String(c[0]).includes('must be a scalar')), 'un contrôle simple reçoit encore une liste').toEqual([]);
    for (const n of [1, 2]) {
      expect(cochees(n)).toHaveLength(d!.windModifiers![n - 1].when!.length);
      expect(cases(n).length, 'la rangée ne propose pas toutes les valeurs de l’enum').toBeGreaterThan(cochees(n).length);
    }
  });

  it('vidé, `when` retourne à l’absence : Enregistrer passe le schéma, la rangée ne porte plus de `when`', async () => {
    try {
      monter(d!);
      const enregistrer = () => container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;
      for (const c of cochees(1)) act(() => { c.click(); });
      expect(cochees(1)).toEqual([]);
      expect(enregistrer().disabled, 'le vidage n’a rien émis').toBe(false);
      await act(async () => { enregistrer().click(); });
      const posee = (datasetArray('domains') as Domaine[]).find((x) => x.id === d!.id)!;
      expect(posee.windModifiers![0].when, 'le schéma a refusé l’enregistrement, ou `when: []` a été posé').toBeUndefined();
      expect(posee.windModifiers![1].when).toEqual(d!.windModifiers![1].when);
    } finally {
      setDataset('domains', avant as never);
    }
  });
});
