// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import type { Dims } from '../../geometry/iso';
import { GameStage3D, setStageRendererFactory, type StageWalkAnim } from './GameStage3D';
import { BancRenderer, brancherArdoise, scènes, viderCaptures } from './banc-volumique';
import { COMBAT_TOKEN_BASE, teamRingRadiusK, type DynamicMarks } from '../builders/dynamicMarks';
import { HERO_RING } from '../teamColors';
import { SILHOUETTE_TWIN_OPACITY } from '../backends/webgl/dynamicMarkMeshes';
import { RENDER_ORDER } from '../backends/webgl/renderRanks';

/**
 * SILHOUETTE À TRAVERS LES MURS (#1297, LOT A) — l'anneau d'équipe d'un jeton occlus par la géométrie
 * du monde reste lisible. Le mécanisme est un JUMEAU DE POOL (un draw call pour tous les acteurs) au
 * test de profondeur retourné, qui LIT les buffers de l'original : ce banc vérifie les trois faits dont
 * dépend la lisibilité — l'état de profondeur, le PARTAGE des buffers (aucune seconde écriture par
 * frame), et la libération sans double `dispose` de la géométrie empruntée.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };
const SCENE: Scene = emptyScene(10, 10);
const DIMS: Dims = { w: SCENE.dimensions.w, h: SCENE.dimensions.h, rot: 0, view: 'iso' };

const MARQUES: DynamicMarks = {
  tethers: [],
  active: null,
  party: null,
  rings: [{ id: 'h1', cell: { x: 2, y: 2, z: 0 }, rK: teamRingRadiusK(COMBAT_TOKEN_BASE), color: HERO_RING[0] }],
};

let root: Root | null = null;
let hôte: HTMLDivElement | null = null;

brancherArdoise();

let glissement: { dx: number; dy: number; dz: number } | null = null;
let battre: (() => void) | null = null;

const anim: StageWalkAnim = {
  subscribe: (onFrame) => { battre = onFrame; return () => { battre = null; }; },
  glide: (cid) => (cid === 'h1' ? glissement : null),
  cam: () => ({ x: 0, y: 0 }),
};

function pool(nom: string): THREE.InstancedMesh {
  const scene = scènes[scènes.length - 1];
  let trouvé: THREE.InstancedMesh | null = null;
  scene.traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (m.isInstancedMesh && m.name === nom) trouvé = m;
  });
  if (!trouvé) throw new Error(`pool ${nom} absent de la scène rendue`);
  return trouvé;
}

function monter(): void {
  viderCaptures();
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  act(() => root!.render(
    <GameStage3D lecture="jeu"
      scene={SCENE}
      mpt={sceneMetresPerTile(SCENE)}
      frame={{ mode: 'plateau', dims: DIMS, cam: { x: 0, y: 0 }, zoom: 1 }}
      tintAt={() => 1}
      keepEl={() => true}
      els={{ tokens: [], props: [] }}
      actors={[]}
      gameTime={720}
      lightLevel={null}
      lights={[]}
      dynMarks={MARQUES}
      anim={anim}
    />,
  ));
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
  glissement = null;
  battre = null;
});

describe('Anneau d’équipe à travers les murs — jumeau de POOL (#1297 LOT A)', () => {
  it('le groupe porte le jumeau, à test de profondeur RETOURNÉ et rendu AVANT les billboards', () => {
    monter();
    const jumeau = pool('marquesDyn:anneau:silhouette');
    const mat = jumeau.material as THREE.MeshBasicMaterial;
    expect(mat.depthFunc, 'sans GreaterDepth le jumeau repeint ce qui est DÉJÀ visible').toBe(THREE.GreaterDepth);
    expect(mat.depthWrite).toBe(false);
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBe(SILHOUETTE_TWIN_OPACITY);
    expect(mat.fog, 'chrome d’interface : la brume du POV ne le mange pas (#1176 P3-1c)').toBe(false);
    expect(mat.color.getHex(), 'la teinte vient de instanceColor, pas du matériau').toBe(0xffffff);
    expect(jumeau.renderOrder, 'AVANT les billboards : rendu après, il peindrait par-dessus des corps VISIBLES').toBe(RENDER_ORDER.jumeau);
    expect(RENDER_ORDER.jumeau, 'le rang vient du registre, jamais d’un littéral au site').toBeLessThan(RENDER_ORDER.pions);
    expect(jumeau.frustumCulled).toBe(false);
  });

  it('les buffers sont PARTAGÉS avec l’original — mêmes références, aucune copie', () => {
    monter();
    const anneau = pool('marquesDyn:anneau');
    const jumeau = pool('marquesDyn:anneau:silhouette');
    expect(jumeau.geometry).toBe(anneau.geometry);
    expect(jumeau.instanceMatrix).toBe(anneau.instanceMatrix);
    expect(anneau.instanceColor, 'l’anneau porte sa teinte PAR INSTANCE (P3-0e)').not.toBeNull();
    expect(jumeau.instanceColor).toBe(anneau.instanceColor);
    expect(jumeau.material, 'le matériau, lui, est DÉDIÉ : c’est lui qui porte l’état de profondeur').not.toBe(anneau.material);
  });

  it('une frame de marche alimente les DEUX sans seconde écriture : seul le compte se propage', () => {
    monter();
    const anneau = pool('marquesDyn:anneau');
    const jumeau = pool('marquesDyn:anneau:silhouette');
    expect(anneau.count, 'le témoin doit VRAIMENT peindre un anneau').toBeGreaterThan(0);
    expect(jumeau.count).toBe(anneau.count);

    const écrireMat = vi.spyOn(jumeau, 'setMatrixAt');
    const écrireCol = vi.spyOn(jumeau, 'setColorAt');
    glissement = { dx: 3, dy: 0, dz: 0 };
    battre!();
    expect(écrireMat, 'le jumeau LIT les buffers de l’original — il n’y écrit rien').not.toHaveBeenCalled();
    expect(écrireCol).not.toHaveBeenCalled();
    // …et pourtant sa pose a suivi : c'est le même buffer d'instances.
    const m = new THREE.Matrix4();
    jumeau.getMatrixAt(0, m);
    const mo = new THREE.Matrix4();
    anneau.getMatrixAt(0, mo);
    expect(m.elements).toEqual(mo.elements);
    expect(jumeau.count).toBe(anneau.count);

    // Population qui retombe à zéro : le jumeau ne garde pas la frame précédente à l'écran.
    act(() => root!.render(
      <GameStage3D lecture="jeu"
        scene={SCENE}
        mpt={sceneMetresPerTile(SCENE)}
        frame={{ mode: 'plateau', dims: DIMS, cam: { x: 0, y: 0 }, zoom: 1 }}
        tintAt={() => 1}
        keepEl={() => true}
        els={{ tokens: [], props: [] }}
        actors={[]}
        gameTime={720}
        lightLevel={null}
        lights={[]}
        dynMarks={{ ...MARQUES, rings: [] }}
        anim={anim}
      />,
    ));
    expect(anneau.count).toBe(0);
    expect(jumeau.count).toBe(0);
  });

  it('démontage : la géométrie empruntée n’est libérée qu’UNE fois, chaque matériau une fois', () => {
    monter();
    const anneau = pool('marquesDyn:anneau');
    const jumeau = pool('marquesDyn:anneau:silhouette');
    const geo = vi.spyOn(anneau.geometry, 'dispose');
    const matOrig = vi.spyOn(anneau.material as THREE.Material, 'dispose');
    const matJumeau = vi.spyOn(jumeau.material as THREE.Material, 'dispose');

    act(() => root!.unmount());
    root = null;

    expect(geo, 'géométrie PARTAGÉE : deux libérations seraient un double-free').toHaveBeenCalledTimes(1);
    expect(matOrig).toHaveBeenCalledTimes(1);
    expect(matJumeau, 'le matériau du jumeau lui appartient : il se libère').toHaveBeenCalledTimes(1);
  });
});
