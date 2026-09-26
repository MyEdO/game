// @vitest-environment jsdom
/**
 * DialogueBox — résolution du locuteur 100 % PAR ID (#669) : `DialogueNode.speakerId` (nœud) ou
 * `dialogue.speakerId` (session) référence une `SceneEntity` de la scène → SON `label` sert de nom
 * affiché. Preuve : deux entités distinctes (e1/e2), deux nœuds — un sans `speakerId` (retombe sur
 * la session) puis un avec `speakerId: 'e2'` — le nom affiché passe d'Alice à Bob. Patron réel du
 * repo pour les tests interactifs (`createRoot`/`act`, cf. `EtatPanel.behavior.test.tsx`) —
 * `@testing-library` n'est pas une dépendance de ce dépôt.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DialogueBox } from './DialogueBox';
import { useGame } from '../state/store';
import { campaignStart } from '../engine/clock';
import type { Dialogue, SceneEntity } from '../state/scene';
import type { Scene } from '../state/scene';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const alice: SceneEntity = { id: 'e1', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, label: 'Alice' };
const bob: SceneEntity = { id: 'e2', kind: 'personnage', ref: 'humain', pos: { x: 1, y: 0 }, label: 'Bob' };

const dlg: Dialogue = {
  id: 'dlg-test',
  start: 'n1',
  nodes: [
    { id: 'n1', desc: 'Réplique de session.', choices: [{ label: 'Suite', next: 'n2' }] },
    { id: 'n2', speakerId: 'e2', desc: 'Réplique de Bob.', choices: [] },
  ],
};

const scene: Scene = { id: 'scn', nom: 'Scène de test', desc: '', size: [4, 4], entities: [alice, bob], dialogues: [dlg], triggers: [], encounters: [] } as unknown as Scene;

describe('DialogueBox — résolution du locuteur PAR ID (#669)', () => {
  let container: HTMLDivElement;
  let root: Root;

  function mount(nodeId: string) {
    useGame.setState({
      scene,
      flags: {},
      gameTime: campaignStart(),
      party: [],
      dialogue: { dialogue: dlg, nodeId, speakerId: 'e1' },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<DialogueBox />); });
  }

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
    useGame.setState({ dialogue: null });
  });

  it('nœud SANS speakerId : retombe sur le locuteur de SESSION (Alice)', () => {
    mount('n1');
    expect(container.querySelector('.dlg-speaker')?.textContent).toBe('Alice');
  });

  it('nœud AVEC speakerId : alterne vers l’entité référencée (Bob), sans toucher la session', () => {
    mount('n2');
    expect(container.querySelector('.dlg-speaker')?.textContent).toBe('Bob');
  });
});
