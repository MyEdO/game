// @vitest-environment jsdom
/** #1463 S3 — le nom du marchand affiché par `MerchantPanel` est celui de son entité (`nomDEntite`). */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MerchantPanel } from './MerchantPanel';
import { useGame } from '../state/store';
import { placeEntity } from './editor/editorState';
import { emptyScene } from '../noyau/monde/scene';
import { creatureLabel } from '../data';
import { MERCHANTS } from '../noyau/monde/merchants/archetypes';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement | undefined;
let root: Root | undefined;
afterEach(() => {
  if (root) act(() => { root!.unmount(); });
  container?.remove();
  container = undefined; root = undefined;
  useGame.setState({ merchant: null, scene: null });
});

describe('MerchantPanel — nom du marchand (#1463 S3)', () => {
  it('un marchand POSÉ à l’éditeur sans libellé se nomme de sa fiche, pas de son archétype', () => {
    const pose = placeEntity(emptyScene('scene-test', 4, 4), { mode: 'entity', kind: 'personnage', ref: 'humain' }, { x: 1, y: 1 });
    expect(pose.scene.entities.find((e) => e.id === pose.id)).not.toHaveProperty('label');
    useGame.setState({
      scene: pose.scene, party: [],
      merchant: { entityId: pose.id, archetype: 'armurier', settlement: 'ville', resaleRate: 0.5, stock: [], cart: [], bargainLocked: false } as never,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root!.render(<MerchantPanel />); });
    expect(MERCHANTS.armurier.label).not.toBe(creatureLabel('humain'));
    expect(container.querySelector('.dlg-speaker')?.textContent).toBe(creatureLabel('humain'));
  });
});
