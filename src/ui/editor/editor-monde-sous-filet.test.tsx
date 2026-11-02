// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Editor } from './Editor';
import { emptyScene, type Scene } from '../../noyau/monde/scene';
import { editeur } from '../../state/editeurBridge';
import { __resetAutosaveForTest, autosaveSave } from '../../state/editorAutosave';
import { __setFabriqueIdbForTest } from '../../web/indexedDb';
import { brancherBasesSimulees } from '../../web/indexedDb.testkit';

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
 * Une espèce d'auteur hors domaine reste éditable : le canevas monte et l'onglet Validation nomme
 * la faute portée par l'entité.
 */
describe('Éditeur — une espèce hors domaine se voit, elle ne lève pas', () => {
  it('le canevas et l’entité restent montés, la Validation nomme l’espèce', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const initialScene: Scene = {
      ...emptyScene('scene-test', 6, 6),
      id: 'filet',
      entities: [{ id: 'pnj-faute', kind: 'personnage', ref: 'humain', pos: { x: 2, y: 2 }, appearance: { species: 'espece-hors-vocabulaire' } }],
    };
    const container = await monter(initialScene);

    expect(container.textContent).not.toContain(MESSAGE);
    expect(container.querySelector('.editor-canvas-wrap svg'), 'le canevas est monté').not.toBeNull();
    expect(editeur.listerEntites!().map((e) => e.id)).toEqual(['pnj-faute']);

    const onglet = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Validation'))!;
    await act(async () => { onglet.click(); });
    expect(container.querySelector('.ed-validation')?.textContent).toContain('espèce « espece-hors-vocabulaire » inconnue : ni espèce jouable, ni créature, ni race de rendu, ni forme de corps.');
  });
});

/**
 * La relecture de l'autosave passe par le schéma de scène (`parseSceneDeProjet`) : un décor volumique
 * au cap refusé écarte la sauvegarde, et la modale de reprise nomme la faute et son lieu.
 */
describe('Éditeur — une sauvegarde locale fautive est écartée', () => {
  it('la modale dit la scène d’un autre format, la faute et son lieu au détail, sans « Restaurer » ; la scène chargée reste', async () => {
    brancherBasesSimulees();
    await __resetAutosaveForTest();
    const fautive: Scene = {
      ...emptyScene('scene-test', 6, 6),
      id: 'scene-autosave-fautive',
      entities: [{ id: 'p3', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'tonneau', facing: 'NE' }],
    };
    await autosaveSave({ sceneId: fautive.id, scene: fautive, savedAt: 999 });
    const container = await monter({ ...emptyScene('scene-test', 6, 6), id: fautive.id });

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
