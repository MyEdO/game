// @vitest-environment jsdom
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveLoadModal } from './SaveLoadModal';
import { SAVE_VERSION, takeObsoleteNotice } from '../state/saves';

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
const save = (version: number) => JSON.stringify({ version, savedAt: '2026-08-17', sceneLabel: 'Ancienne', gameTime: 3, data: {} });

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
  takeObsoleteNotice(); // témoin remis à zéro entre les cas
});

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (container) { container.remove(); container = null; }
  vi.unstubAllGlobals();
});

describe('écran de chargement — une sauvegarde jetée le DIT au joueur (sous StrictMode)', () => {
  it('save d’une version ANTÉRIEURE : le message parle de version antérieure, et l’emplacement est vidé', () => {
    ls().setItem('wfrp4.save.1', save(SAVE_VERSION - 1));
    const texte = monter();
    expect(texte).toContain('version antérieure');
    expect(texte).toContain('retirée');
    expect(ls().getItem('wfrp4.save.1')).toBeNull();
  });

  it('save d’une version PLUS RÉCENTE : le message ne ment pas (« plus récente », jamais « antérieure »)', () => {
    ls().setItem('wfrp4.save.2', save(SAVE_VERSION + 1));
    const texte = monter();
    expect(texte).toContain('version plus récente');
    expect(texte).not.toContain('version antérieure');
  });

  it('clé de QUARANTAINE historique (`wfrp4.save.future.N`) : purgée, et annoncée comme plus récente', () => {
    ls().setItem('wfrp4.save.future.3', save(SAVE_VERSION + 1));
    const texte = monter();
    expect(texte).toContain('version plus récente');
    expect(ls().getItem('wfrp4.save.future.3')).toBeNull();
  });

  it('contenu ILLISIBLE : le message le dit tel quel, sans invoquer une version', () => {
    ls().setItem('wfrp4.save.1', 'pas du json');
    const texte = monter();
    expect(texte).toContain('Sauvegarde illisible');
    expect(texte).not.toContain('version');
    expect(ls().getItem('wfrp4.save.1')).toBeNull();
  });

  it('save à la version COURANTE : aucun message de rejet, la save reste chargeable', () => {
    ls().setItem('wfrp4.save.1', save(SAVE_VERSION));
    const texte = monter();
    expect(texte).not.toContain('retirée');
    expect(ls().getItem('wfrp4.save.1')).not.toBeNull();
  });
});
