// @vitest-environment jsdom
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveLoadModal } from './SaveLoadModal';
import { FORMAT_SAVE } from '../state/formats.generated';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

const ls = () => (globalThis as { localStorage: Storage }).localStorage;
const save = (version: string | number) => JSON.stringify({ version, savedAt: '2026-08-17', sceneLabel: 'Ancienne', gameTime: 3, data: {} });

let root: Root | null = null;
let container: HTMLDivElement | null = null;

/** Monte l'écran de chargement sous StrictMode et rend son texte visible. */
function monter(): string {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<StrictMode><SaveLoadModal mode="load" onClose={() => {}} /></StrictMode>));
  return container.textContent ?? '';
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
});

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (container) { container.remove(); container = null; }
  vi.unstubAllGlobals();
});

/** Les messages de retrait rendus par `ChipDeRefus`, dans l'ordre de l'écran. */
const retraitsAffiches = (): string[] =>
  [...(container?.querySelectorAll('[role="alert"] p.chip.tone-danger.chip-phrase') ?? [])].map((p) => p.textContent ?? '');

describe('écran de chargement — une sauvegarde jetée le DIT au joueur, emplacement NOMMÉ (sous StrictMode)', () => {
  it('save d’un AUTRE FORMAT : le message nomme l’emplacement, par `ChipDeRefus`, et l’emplacement est vidé', () => {
    ls().setItem('wfrp4.save.1', save('autre-format'));
    monter();
    expect(retraitsAffiches()).toEqual(['Emplacement 1 : sauvegarde d’un autre format, retirée.']);
    expect(ls().getItem('wfrp4.save.1')).toBeNull();
  });

  it('save à numéro de version : même message, sous SON emplacement', () => {
    ls().setItem('wfrp4.save.2', save(66));
    monter();
    expect(retraitsAffiches()).toEqual(['Emplacement 2 : sauvegarde d’un autre format, retirée.']);
    expect(ls().getItem('wfrp4.save.2')).toBeNull();
  });

  it('emplacement AUTOMATIQUE : nommé comme tel', () => {
    ls().setItem('wfrp4.save.auto', save('autre-format'));
    monter();
    expect(retraitsAffiches()).toEqual(['Emplacement automatique : sauvegarde d’un autre format, retirée.']);
    expect(ls().getItem('wfrp4.save.auto')).toBeNull();
  });

  it('deux emplacements retirés : un message chacun', () => {
    ls().setItem('wfrp4.save.1', save('autre-format'));
    ls().setItem('wfrp4.save.3', 'pas du json');
    monter();
    expect(retraitsAffiches()).toEqual([
      'Emplacement 1 : sauvegarde d’un autre format, retirée.',
      'Emplacement 3 : sauvegarde illisible, retirée.',
    ]);
    const piles = new Set([...container!.querySelectorAll('[role="alert"]')].map((a) => a.parentElement));
    expect([...piles].map((p) => p?.className), 'les pastilles dans UNE pile `Stack`, espacées par son gap').toEqual(['stack']);
  });

  it('contenu ILLISIBLE : le message le dit tel quel, sans invoquer un format', () => {
    ls().setItem('wfrp4.save.1', 'pas du json');
    const texte = monter();
    expect(retraitsAffiches()).toEqual(['Emplacement 1 : sauvegarde illisible, retirée.']);
    expect(texte).not.toContain('format');
    expect(ls().getItem('wfrp4.save.1')).toBeNull();
  });

  it('save au format COURANT : aucun message de rejet, la save reste chargeable', () => {
    ls().setItem('wfrp4.save.1', save(FORMAT_SAVE));
    const texte = monter();
    expect(retraitsAffiches()).toEqual([]);
    expect(texte).not.toContain('retirée');
    expect(ls().getItem('wfrp4.save.1')).not.toBeNull();
  });
});
