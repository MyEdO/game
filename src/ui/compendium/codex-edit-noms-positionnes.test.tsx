// @vitest-environment jsdom
/**
 * #1993 — les champs d'une entrée du Codex rendus EN RANGÉE portent chacun un nom accessible UNIQUE :
 * `JsonField` et `DescRefField` reçoivent la position (`sujet`) comme les autres champs, les clés et
 * valeurs d'un record de textes (`RecordTextField`) sont nommées. Et une clé de record frappée lettre à
 * lettre ne remonte pas sa rangée (identité STABLE) ; ses conflits : `codex-edit-cles-de-record.test.tsx`.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from './CodexEdit';
import { datasetArray, setDataset, resetData } from '../../data/overrides';
import { defautsDeNoms } from '../nomsAccessibles.testkit';

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

function monter(categoryKey: string, entree: { id: string; label: string }) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<CodexEdit categoryKey={categoryKey} id={entree.id} onClose={() => {}} />); });
}

function saisir(champ: HTMLInputElement, valeur: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, valeur);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** Noms accessibles CALCULÉS portés par plusieurs contrôles (boutons compris). */
const nomsDupliques = (): string[] => defautsDeNoms(container).doublons;

type Domaine = { id: string; label: string; windModifiers?: Record<string, unknown>[] };

describe('atelier du Codex — noms positionnés des champs en rangée (#1993)', () => {
  it('rangées à JsonField et DescRefField : chaque champ de chaque rangée a son nom, tous uniques', () => {
    const domaines = datasetArray('domains') as Domaine[];
    const d = domaines.find((x) => (x.windModifiers?.length ?? 0) >= 2);
    expect(d, 'aucun domaine à deux rangées windModifiers — la mesure ne porte sur rien').toBeTruthy();
    // Un sous-champ tableau-de-tableaux retombe sur `JsonField` ; `descRef` monte `DescRefField`.
    const rangees = d!.windModifiers!.map((m) => ({ ...m, grille: [[1, 2], [3]], descRef: { book: '', ch: '', parts: [] } }));
    // Les éditeurs d'op des effets déclenchés sont hors de cette mesure (#2100).
    setDataset('domains', domaines.map((x) => (x === d ? { ...x, effects: [], windModifiers: rangees } : x)) as never);
    monter('domains', d!);

    // Un `JsonField` se reconnaît à la mention « (JSON) » de son libellé.
    const jsons = [...container.querySelectorAll<HTMLTextAreaElement>('textarea')].filter((t) => t.closest('label')?.querySelector('em')?.textContent === '(JSON)');
    expect(jsons.length, 'aucun JsonField monté dans les rangées').toBeGreaterThanOrEqual(2);
    for (const n of [1, 2]) {
      expect(jsons.some((t) => t.getAttribute('aria-label')?.includes(`de la rangée ${n} de`)), `le JsonField de la rangée ${n} n’a pas de nom positionné`).toBe(true);
      expect(container.querySelector(`select[aria-label^="Livre du passage de la rangée ${n} de"]`), `le DescRefField de la rangée ${n} n’a pas de nom positionné`).toBeTruthy();
    }
    expect(nomsDupliques()).toEqual([]);
  });

  type Yeux = { id: string; label: string; color?: Record<string, string> };
  const yeuxARecord = (): Yeux => {
    const e = (datasetArray('eyes') as Yeux[]).find((x) => Object.keys(x.color ?? {}).length >= 2);
    expect(e, 'aucune couleur d’yeux à record de deux clés — la mesure ne porte sur rien').toBeTruthy();
    return e!;
  };
  const cle = (n: number) => container.querySelector<HTMLInputElement>(`input[aria-label$=" — clé ${n}"]`)!;
  const valeur = (n: number) => container.querySelector<HTMLInputElement>(`input[aria-label$=" — valeur ${n}"]`)!;

  it('record de textes : clés et valeurs nommées, tous noms uniques', () => {
    const e = yeuxARecord();
    monter('eyes', e);
    const n = Object.keys(e.color!).length;
    for (let i = 1; i <= n; i++) {
      expect(cle(i), `la clé ${i} du record n’a pas de nom`).toBeTruthy();
      expect(valeur(i), `la valeur ${i} du record n’a pas de nom`).toBeTruthy();
    }
    expect(nomsDupliques()).toEqual([]);
  });

  it('record de textes : la clé frappée garde sa rangée et le focus', () => {
    const e = yeuxARecord();
    const [k1] = Object.keys(e.color!);
    monter('eyes', e);
    const champ = cle(1);
    act(() => { champ.focus(); });
    saisir(champ, `${k1}x`);
    expect(champ.isConnected, 'la rangée renommée a été remontée : le champ frappé a disparu').toBe(true);
    expect(document.activeElement, 'la clé frappée a perdu le focus').toBe(champ);
    expect(cle(1).value).toBe(`${k1}x`);
  });
});
