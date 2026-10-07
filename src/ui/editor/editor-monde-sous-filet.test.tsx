// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Editor } from './Editor';
import { emptyScene, type Scene } from '../../state/scene';
import { editeur } from '../../state/editeurBridge';
import { __resetAutosaveForTest, autosaveSave } from '../../state/editorAutosave';
import { __setFabriqueIdbForTest } from '../../lib/indexedDb';
import { brancherBasesSimulees } from '../../lib/indexedDb.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  container?.remove();
  root = null;
  container = null;
  vi.restoreAllMocks();
  __setFabriqueIdbForTest(null);
});

async function monter(initialScene: Scene): Promise<HTMLDivElement> {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root!.render(<Editor initialScene={initialScene} />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return container;
}

const MESSAGE = "Le monde de l'éditeur a rencontré une erreur de rendu";

/**
 * UNE ESPÈCE D'AUTEUR HORS DOMAINE NE FAIT PLUS TOMBER LE MONDE — le schéma la nomme (onglet
 * Validation), le rendu la route vers le corps d'erreur `manquant` (`resolveRender`) : le canevas reste
 * monté, aucune levée n'atteint le filet (`SceneErrorBoundary`).
 */
describe('Éditeur — une espèce hors domaine se voit, elle ne lève pas', () => {
  it('le canevas tient, le rendu signale le corps d’erreur, la Validation nomme l’espèce', async () => {
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const initialScene: Scene = {
      ...emptyScene(6, 6),
      id: 'filet',
      entities: [{ id: 'pnj-faute', kind: 'personnage', ref: 'humain', pos: { x: 2, y: 2 }, appearance: { species: 'espece-hors-vocabulaire' } }],
    };
    const container = await monter(initialScene);

    expect(container.textContent).not.toContain(MESSAGE);
    expect(container.querySelector('.editor-canvas-wrap svg'), 'le canevas est monté').not.toBeNull();
    expect(erreurs.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('« espece-hors-vocabulaire »') && m.includes("silhouette d'erreur")).length).toBeGreaterThan(0);

    const onglet = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Validation'))!;
    await act(async () => { onglet.click(); });
    expect(container.querySelector('.ed-validation')?.textContent).toContain('espèce « espece-hors-vocabulaire » inconnue : ni espèce jouable, ni espèce dessinée');
  });
});

/**
 * LE FILET DE CRASH NE CONTOURNE PLUS RIEN — la relecture de l'autosave passe par le schéma de scène
 * (`parseSceneDeProjet`) : une scène qui porte un décor volumique au cap refusé est ÉCARTÉE, la
 * modale de reprise la dit d'un autre format, la faute et son lieu au détail, et rien n'entre dans
 * l'éditeur.
 */
describe('Éditeur — une sauvegarde locale fautive est écartée', () => {
  it('la modale dit la scène d’un autre format, la faute et son lieu au détail, sans « Restaurer » ; la scène chargée reste', async () => {
    brancherBasesSimulees();
    await __resetAutosaveForTest();
    const fautive: Scene = {
      ...emptyScene(6, 6),
      id: 'scene-autosave-fautive',
      entities: [{ id: 'p3', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'tonneau', facing: 'NE' }],
    };
    await autosaveSave({ sceneId: fautive.id, scene: fautive, savedAt: 999 });
    const container = await monter({ ...emptyScene(6, 6), id: fautive.id });

    expect([...container.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Restaurer'), 'rien à restaurer').toBe(false);
    expect(container.textContent, 'le titre dit l’état, sans question').toContain('Sauvegarde locale impossible à restaurer');
    expect(container.textContent, 'aucune question à laquelle on ne peut répondre oui').not.toContain('Reprendre une sauvegarde locale ?');
    expect(container.querySelector('[role="alert"] .chip.tone-danger')?.textContent).toBe(
      'Restauration refusée : scène d’un autre format, ou mal formée.',
    );
    expect(container.querySelector('[role="alert"] .fold-body')?.textContent).toContain(
      "entité « p3 » › orientation: décor volumique « tonneau » au cap NE — un décor volumique ne prend qu'un cap cardinal (N/E/S/O)",
    );
    expect(editeur.listerEntites!().find((e) => e.id === 'p3'), 'la scène fautive n’entre pas').toBeUndefined();
  });
});
