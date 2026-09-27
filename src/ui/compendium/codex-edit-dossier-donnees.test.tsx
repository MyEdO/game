// @vitest-environment jsdom
/**
 * #1956 — la base IndexedDB du dossier `src/data` (`fsPersist`) qui échoue laisse l'atelier du Codex
 * « non connecté » et DIT l'échec ; l'annulation du sélecteur de dossier ne dit rien ; un refus de
 * l'autorisation d'écriture est dit, et l'autorisation reste à demander.
 */
import { describe, it, expect, afterEach, beforeAll, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from './CodexEdit';
import { datasetArray } from '../../data/overrides';
import { __setOuvertureIdbForTest } from '../../lib/indexedDb';
import { baseSimulee, ouvertureSimulee } from '../../lib/indexedDb.testkit';

type FenetreFs = { showDirectoryPicker?: () => Promise<unknown> };

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (window as FenetreFs).showDirectoryPicker = () => Promise.resolve({ kind: 'directory' });
  __setOuvertureIdbForTest(() => {
    const o = ouvertureSimulee(baseSimulee());
    queueMicrotask(() => o.echouer(new DOMException('base illisible', 'UnknownError')));
    return o.req;
  });
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  delete (window as FenetreFs).showDirectoryPicker;
  __setOuvertureIdbForTest(null);
});

async function monter(): Promise<void> {
  const cible = datasetArray('seaShanties')[0] as { id: string; label: string };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<CodexEdit categoryKey="seaShanties" label={cible.label} id={cible.id} onClose={() => {}} />);
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

const boutonConnecter = () =>
  [...container.querySelectorAll<HTMLButtonElement>('.codex-edit-bar button')].find((b) => b.textContent?.includes('Connecter src/data'));
const message = () => container.querySelector('.codex-edit-bar .de-msg')?.textContent ?? '';

describe('atelier du Codex — la base du dossier src/data qui échoue (#1956)', () => {
  it('restauration au montage en échec : reste « non connecté » et dit l’échec', async () => {
    await monter();
    expect(boutonConnecter(), 'le bouton « Connecter src/data… » a disparu').toBeTruthy();
    expect(container.querySelector('.de-ok'), 'l’écran se dit connecté').toBeNull();
    expect(message()).toContain('Échec de la reconnexion à src/data');
    expect(message()).toContain('base illisible');
  });

  it('connexion : l’annulation du sélecteur ne dit rien, l’échec de la base est dit', async () => {
    await monter();
    const auMontage = message();
    (window as FenetreFs).showDirectoryPicker = () => Promise.reject(new DOMException('annulé', 'AbortError'));
    await act(async () => { boutonConnecter()!.click(); });
    expect(message(), 'l’annulation du sélecteur a été dite').toBe(auMontage);

    (window as FenetreFs).showDirectoryPicker = () => Promise.resolve({ kind: 'directory' });
    await act(async () => { boutonConnecter()!.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(message()).toContain('Échec de la connexion à src/data');
    expect(boutonConnecter(), 'le bouton « Connecter src/data… » a disparu').toBeTruthy();
  });

  it('autorisation d’écriture refusée par une erreur : dite, et le bouton « Autoriser l’écriture » reste', async () => {
    const base = baseSimulee({ handles: {} });
    base.magasins.get('handles')!.contenu.set('dataDir', {
      kind: 'directory',
      queryPermission: async () => 'prompt',
      requestPermission: async () => { throw new DOMException('permission refusée', 'SecurityError'); },
    });
    __setOuvertureIdbForTest(() => {
      const o = ouvertureSimulee(base);
      queueMicrotask(() => o.reussir());
      return o.req;
    });
    await monter();
    const autoriser = () =>
      [...container.querySelectorAll<HTMLButtonElement>('.codex-edit-bar button')].find((b) => b.textContent?.includes('Autoriser'));
    expect(autoriser(), 'le handle restauré ne demande pas l’autorisation — le geste ne mesure rien').toBeTruthy();
    await act(async () => { autoriser()!.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(message()).toContain('Échec de l’autorisation d’écriture dans src/data');
    expect(message()).toContain('permission refusée');
    expect(autoriser(), 'le bouton « Autoriser l’écriture » a disparu').toBeTruthy();
  });
});
