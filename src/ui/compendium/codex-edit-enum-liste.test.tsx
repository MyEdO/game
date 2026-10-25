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
import type { z } from 'zod';

import { CodexEdit } from '../editor/codex/CodexEdit';
import { datasetArray, setDataset } from '../../data/overrides';
import { noeudDuChamp, noeudObjet } from '../../data/schemas/validate';
import { metaDesChamps } from '../../data/schemas/grammaire/meta';
import { valeursDe } from '../../data/schemas/grammaire/meta';
import { gateDActionSchema, modeDeCiblageSchema, modeArmableSchema } from '../../data/schemas/_domaines.generated';

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
const WHEN = metaDesChamps(noeudObjet(noeudDuChamp('domains.json', 'windModifiers')) as z.ZodObject, { exigees: true }).when.label;
const cases = (n: number) => [...container.querySelectorAll<HTMLInputElement>(`[role="group"][aria-label^="${WHEN} de la rangée ${n} "] input[type="checkbox"]`)];
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
      act(() => { setDataset('domains', avant as never); });
    }
  });
});

describe('#2968 — prédicats d’action dans le Codex', () => {
  const avant = datasetArray('actions').slice();
  const action = avant.find((a) => typeof a.gate === 'string')!;
  const groupe = () => container.querySelector<HTMLElement>('[role="group"][aria-label="Prédicat d’autorisation"]')!;
  const monterAction = () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<CodexEdit categoryKey="actions" id={action.id} onClose={() => {}} />); });
  };
  const enregistrer = () => container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;

  it('propose exactement les libellés du nœud et enregistre une ou plusieurs gates', async () => {
    try {
      monterAction();
      const attendus = valeursDe(gateDActionSchema)!;
      expect(groupe()).toBeTruthy();
      const cases = [...groupe().querySelectorAll<HTMLInputElement>('input')];
      expect(cases.map((c) => c.getAttribute('aria-label'))).toEqual(Object.values(attendus).map((l) => `${l} — Prédicat d’autorisation`));
      const libre = cases.find((c) => !c.checked)!;
      act(() => { libre.click(); });
      await act(async () => { enregistrer().click(); });
      expect(Array.isArray(datasetArray('actions').find((a) => a.id === action.id)!.gate)).toBe(true);
      act(() => { libre.click(); });
      await act(async () => { enregistrer().click(); });
      expect(datasetArray('actions').find((a) => a.id === action.id)!.gate).toBe(action.gate);
    } finally { act(() => { setDataset('actions', avant); }); }
  });

  it('édite et enregistre les deux domaines de ciblage avec les libellés du schéma', async () => {
    try {
      monterAction();
      for (const [champ, label, schema] of [
        ['mode', 'Mode de ciblage', modeDeCiblageSchema],
        ['armed', 'Valeur d’armement', modeArmableSchema],
      ] as const) {
        const controle = [...container.querySelectorAll('label.ed-field')]
          .find((l) => l.querySelector('span')?.textContent === label)?.querySelector('select');
        expect(controle).toBeTruthy();
        const options = [...controle!.options].filter((o) => o.value);
        expect(options.map((o) => [o.value, o.textContent])).toEqual(Object.entries(valeursDe(schema)!));
        const choix = options.find((o) => o.value !== controle!.value)!.value;
        act(() => {
          controle!.value = choix;
          controle!.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(enregistrer().disabled).toBe(false);
        await act(async () => { enregistrer().click(); });
        expect(datasetArray('actions').find((a) => a.id === action.id)![champ]).toBe(choix);
      }
    } finally { act(() => { setDataset('actions', avant); }); }
  });

  it.each([
    ['gate', 'Prédicat d’autorisation'],
    ['mode', 'Mode de ciblage'],
    ['armed', 'Valeur d’armement'],
  ] as const)('refuse à Enregistrer une référence inconnue de %s sans poser la retouche', async (champ, label) => {
    try {
      monterAction();
      const autre = avant.find((a) => a.id !== action.id)!;
      act(() => { setDataset('actions', avant.map((a) => a.id === autre.id ? { ...a, [champ]: 'inconnue' } : a) as never); });
      const libelle = [...container.querySelectorAll<HTMLInputElement>('input')].find((c) => c.value === action.label)!;
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(libelle, `${action.label} modifiée`);
        libelle.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(enregistrer().disabled).toBe(false);
      await act(async () => { enregistrer().click(); });
      expect(datasetArray('actions').find((a) => a.id === action.id)!.label).toBe(action.label);
      expect(container.querySelector('.codex-edit-errors')?.textContent).toContain(label);
    } finally { act(() => { setDataset('actions', avant); }); }
  });
});
