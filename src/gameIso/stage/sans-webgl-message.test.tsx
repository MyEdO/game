// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useGame } from '../../state/store';
import { emptyScene } from '../../noyau/monde/scene';
import type { Combatant } from '../../engine/types';
import { MondeDeCampagne } from './MondeDeCampagne';
import { setStageRendererFactory, type StageRenderer } from './GameStage3D';
import { BancRenderer, brancherArdoise } from './banc-volumique';
import { webglRefusé } from './webglSupport';

/**
 * SANS CONTEXTE VOLUMIQUE, LE JEU LE DIT (#1176, P3-4, commit C5a). La voie volumique est le SEUL
 * peintre du monde : un joueur dont la machine refuse le contexte (GPU sur liste noire, machine
 * virtuelle, budget de contextes épuisé) n'a plus aucun décor. Jusqu'à C4 l'écran se repliait en
 * silence sur la voie affine ; celle-ci est morte, et le repli avec elle — l'échec doit donc se DIRE.
 *
 * Ce banc mesure l'ÉCRAN, pas l'intention, sur deux montages APPARIÉS qui ne diffèrent que par la
 * fabrique de renderer — l'une jette, l'autre rend. Contexte refusé : le MESSAGE est monté, et le stage
 * ne l'est pas. Contexte servi : le stage est là, et aucun message.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: {}, advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

brancherArdoise();

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
});
afterAll(() => setStageRendererFactory(null));

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
  setStageRendererFactory(null);
  // Le verdict est LATCHÉ : le `beforeEach` global (`src/test-setup.ts`) le remet à zéro.
});

/** Monte l'écran de jeu avec la fabrique donnée et rend ce que le joueur a sous les yeux. */
function monter(fabrique: (canvas: HTMLCanvasElement) => StageRenderer): HTMLDivElement {
  const scene = emptyScene(8, 8);
  scene.walls = [{ x: 3, y: 3, side: 'E' }];
  useGame.setState({
    scene,
    mode: 'exploration',
    partyPos: { x: 3, y: 3 },
    party: [hero('h1', { x: 3, y: 3 })],
    battle: null,
    dialogue: null,
    flags: {},
  } as never);
  setStageRendererFactory(fabrique);
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(<MondeDeCampagne />));
  return conteneur;
}

const message = (el: HTMLElement) => el.querySelector('.sans-webgl');

describe('Sans contexte WebGL, le joueur l’APPREND — pas un écran nu (#1176 P3-4 C5a)', () => {
  it('contexte REFUSÉ : le message est à l’écran, et le stage a laissé la place', () => {
    const el = monter(() => { throw new Error('aucun contexte WebGL'); });
    const dit = message(el);
    // L'ÉCRAN d'abord : c'est ce que le joueur perd, le verdict n'en est que le mécanisme.
    expect(dit, 'aucun message : l’écran resterait nu et muet').not.toBeNull();
    expect(dit!.textContent, 'le message doit nommer ce qui manque, en français').toContain('WebGL');
    expect(dit!.getAttribute('role'), 'un lecteur d’écran doit l’annoncer').toBe('alert');
    expect(el.querySelector('svg.iso-stage'), 'le stage ne se monte pas par-dessus le message').toBeNull();
    expect(webglRefusé(), 'le verdict doit être lisible par les autres hôtes de monde').toBe(true);
  });

  it('contre-épreuve APPARIÉE : contexte servi → le stage est monté, aucun message', () => {
    const el = monter(() => new BancRenderer());
    expect(message(el)).toBeNull();
    expect(el.querySelector('svg.iso-stage')).not.toBeNull();
    expect(el.querySelector('canvas.iso-stage')).not.toBeNull();
    expect(webglRefusé()).toBe(false);
  });
});
