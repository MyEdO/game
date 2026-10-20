// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Editor } from './Editor';
import { emptyScene, type Scene } from '../../noyau/monde/scene';
import { tileCenter, type Dims } from '../../geometry/iso';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** Monte l'éditeur et rend le survol de carte pilotable : la case visée par l'auteur est la cible de
 *  création, comme elle est déjà celle du collage (`hoverRef`). */
async function montage(initialScene: Scene) {
  let savedScene = initialScene;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(<Editor initialScene={initialScene} onSceneChange={(scene) => { savedScene = scene; }} />);
  });
  const button = (label: string) => Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === label || candidate.getAttribute('aria-label') === label,
  )!;
  const click = async (label: string) => {
    await act(async () => {
      button(label).click();
    });
  };
  const svg = container.querySelector('svg.editor-iso') as SVGSVGElement;
  const point = { x: 0, y: 0, matrixTransform: () => ({ x: point.x, y: point.y }) };
  Object.defineProperty(svg, 'createSVGPoint', { value: () => point });
  Object.defineProperty(svg, 'getScreenCTM', { value: () => ({ inverse: () => ({}) }) });
  const dims: Dims = { ...initialScene.dimensions, rot: 0, view: 'top' };
  const hover = async (x: number, y: number) => {
    const { cx, cy } = tileCenter(x, y, dims, 0);
    await act(async () => {
      svg.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: cx, clientY: cy }));
    });
  };
  const teardown = async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  };
  return { click, hover, teardown, sceneOf: () => savedScene };
}

describe('Éditeur — l’architecture naît sur la case SURVOLÉE (jamais à l’origine de la scène)', () => {
  it('le CORPS naît sur la case survolée', async () => {
    const h = await montage(emptyScene('scene-test', 8, 8));
    await h.click('Architecture');
    await h.hover(3, 2);
    await h.click('Nouveau corps');

    expect(h.sceneOf().architecture?.[0]?.storeys[0]?.parts[0]?.foot).toEqual({ x: 3, y: 2, w: 1, h: 1 });
    await h.teardown();
  });

  it('la PARTIE et la SECTION DE TOITURE naissent sur la case survolée', async () => {
    const initialScene: Scene = {
      ...emptyScene('scene-test', 8, 8),
      architecture: [{
        id: 'corps',
        style: 'maison',
        storeys: [{ id: 'z0', z: 0, parts: [], roomZoneIds: [] }],
        facades: [],
        masses: [],
      }],
    };
    const h = await montage(initialScene);
    await h.click('Architecture');

    await h.hover(5, 4);
    await h.click('Nouvelle partie');
    expect(h.sceneOf().architecture?.[0]?.storeys[0]?.parts[0]?.foot).toEqual({ x: 5, y: 4, w: 1, h: 1 });

    await h.hover(2, 6);
    await h.click('Section de toiture');
    expect(h.sceneOf().architecture?.[0]?.masses[0]?.footprint[0]).toEqual({ x: 2, y: 6, w: 1, h: 1 });
    await h.teardown();
  });
});
