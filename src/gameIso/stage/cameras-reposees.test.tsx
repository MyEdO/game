import type { JSX } from 'react';
// @vitest-environment jsdom
/**
 * LES CAMÉRAS SONT REPOSÉES, JAMAIS RECONSTRUITES (#1404) — l'écran volumique tient UNE caméra par
 * REGARD (affine de plateau, perspective de première personne) et lui écrit, à chaque image, sa pose,
 * son frustum et sa projection. Une image ne fabrique donc plus d'objet.
 *
 * CE QUI SE MESURE : l'`uuid` des caméras réellement passées au rendu, image par image
 * (`banc-volumique` en capture une COPIE qui porte l'uuid de sa source). Soixante images d'un même
 * regard = un seul uuid ; le regard voisin en a un autre, et le retour au premier RETROUVE le sien.
 *
 * LES IMAGES sont battues par le battement du stage (`battreStageFrames`) — le chemin RÉEL de la
 * marche, hors de tout rendu React : c'est là que la reconstruction par image se payait.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import type { Dims } from '../../geometry/iso';
import { GameStage3D, setStageRendererFactory } from './GameStage3D';
import { battreStageFrames } from './stageFrames';
import { BancRenderer, brancherArdoise, caméras, viderCaptures } from './banc-volumique';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };
const IMAGES = 60;

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

brancherArdoise();

const SCENE: Scene = emptyScene(10, 10);
const MPT = sceneMetresPerTile(SCENE);
const DIMS: Dims = { w: SCENE.dimensions.w, h: SCENE.dimensions.h, rot: 0, view: 'iso' };

/** L'écran, sur l'un ou l'autre regard — les deux seuls cadres que `dessiner` sait dériver. */
function écran(pov: boolean): JSX.Element {
  return (
    <GameStage3D lecture="jeu"
      scene={SCENE}
      mpt={MPT}
      frame={pov
        ? { mode: 'pov', partyPos: { x: 4, y: 4 }, facing: 'N', indoor: false, cid: null }
        : { mode: 'plateau', dims: DIMS, cam: { x: 0, y: 0 }, zoom: 1 }}
      tintAt={() => 1}
      keepEl={() => true}
      els={{ tokens: [], props: [] }}
      actors={[]}
      gameTime={720}
      lightLevel={1}
      lights={[]}
    />
  );
}

/** `n` images battues par le battement du stage, comme la marche les bat. */
function battre(n: number): void {
  act(() => { for (let i = 0; i < n; i++) battreStageFrames(); });
}

/** Les uuid DISTINCTS des caméras passées au rendu depuis la dernière ardoise. */
const uuidsVus = (): string[] => [...new Set(caméras.map((c) => c.uuid))];

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));
afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
});

function monter(pov: boolean): void {
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(écran(pov)));
}

describe('Caméras REPOSÉES par image (#1404)', () => {
  it.each([['plateau', false], ['première personne', true]] as const)(
    '%s : 60 images, UNE seule caméra',
    (_regard, pov) => {
      monter(pov);
      viderCaptures();
      battre(IMAGES);

      // PRÉMISSE — sans images peintes, « une seule caméra » serait vrai du vide.
      expect(caméras.length, 'aucune image peinte : ce banc ne mesure rien').toBeGreaterThanOrEqual(IMAGES);
      const attendu = pov ? THREE.PerspectiveCamera : THREE.OrthographicCamera;
      expect(caméras[0] instanceof attendu, 'le regard mesuré n’est pas celui qu’on croit').toBe(true);
      expect(uuidsVus(), `${caméras.length} images peintes`).toHaveLength(1);
    },
  );

  it('le REGARD change de caméra, et le retour retrouve la SIENNE', () => {
    monter(false);
    viderCaptures();
    battre(4);
    const plateau = uuidsVus();
    expect(plateau).toHaveLength(1);

    act(() => root!.render(écran(true)));
    viderCaptures();
    battre(4);
    const pov = uuidsVus();
    expect(pov, 'la première personne a SA caméra').toHaveLength(1);
    expect(pov[0]).not.toBe(plateau[0]);

    act(() => root!.render(écran(false)));
    viderCaptures();
    battre(4);
    expect(uuidsVus(), 'le retour au plateau reprend la caméra du plateau, il n’en monte pas une neuve')
      .toEqual(plateau);
  });
});
