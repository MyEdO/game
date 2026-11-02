// @vitest-environment jsdom
/**
 * LE CAP DU GROUPE, SUR L'ÉCRAN MONTÉ (#1362 L1a) — l'hôte réel (`MondeDeCampagne`) dérive le jeton de
 * groupe (`partyTokenOf`), et le disque de la vue du dessus en porte le quartier de cap.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { emptyScene, type Scene } from '../../noyau/monde/scene';
import { useGame } from '../../state/store';
import { capDuGroupe, meneurDuMonde } from '../../noyau/monde/combatants';
import { createHero } from '../../engine/character';
import type { Combatant } from '../../engine/types';
import type { Dims } from '../../geometry/iso';
import { discCapPath } from '../builders/dynamicMarks';
import { MondeDeCampagne } from './MondeDeCampagne';
import { setStageRendererFactory } from './GameStage3D';
import { BancRenderer, brancherArdoise, respirer, simulerRasterisation, viderCaptures } from './banc-volumique';


(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };
let root: Root | null = null;
let hôte: HTMLDivElement | null = null;

brancherArdoise();

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

beforeEach(() => { simulerRasterisation(); });
afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
});

const héros = (label: string, graine: number): Combatant =>
  ({ ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, seed: graine }), id: label }) as Combatant;

function scène(): Scene {
  return emptyScene('scene-test', 12, 12);
}

/** L'hôte RÉEL, en exploration, groupe de deux héros posté au centre. */
async function monter(vue: 'iso' | 'top' = 'iso'): Promise<void> {
  viderCaptures();
  useGame.setState({
    screen: 'campaign',
    scene: scène(),
    mode: 'exploration',
    partyPos: { x: 5, y: 5 },
    party: [héros('a', 3), héros('b', 4)],
    battle: null,
    dialogue: null,
    explored: {},
    facing: {},
    camRot: 0,
    viewMode: vue,
    camEdge: false,
    povActive: false,
  } as never);
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  await act(async () => { root!.render(<MondeDeCampagne />); });
  await respirer(40);
}

describe('Cap du GROUPE — sur l’écran MONTÉ (#1362)', () => {
  it('VUE DU DESSUS : le disque du groupe, monté par l’hôte, porte le quartier du cap de GROUPE', async () => {
    await monter('top');
    await act(async () => { useGame.getState().pivotParty(1); });
    await respirer(80);
    const cap = capDuGroupe(useGame.getState())!;
    const meneur = meneurDuMonde(useGame.getState())!;
    const dims = { ...useGame.getState().scene!.dimensions, rot: 0, view: 'top', edge: false } as Dims;
    const tracés = [...hôte!.querySelectorAll(`g[data-pion-cid="${meneur.id}"] path`)].map((p) => p.getAttribute('d'));
    expect(tracés.length, 'prémisse : le disque du groupe est bien monté').toBeGreaterThan(0);
    expect(tracés, 'le quartier de cap suit le GROUPE').toContain(discCapPath(cap, 1, dims));
  });
});
