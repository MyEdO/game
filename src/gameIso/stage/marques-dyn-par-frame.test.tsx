// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import type { Dims } from '../../geometry/iso';
import { GameStage3D, setStageRendererFactory, type StageWalkAnim } from './GameStage3D';
import { BancRenderer, brancherArdoise, scènes, viderCaptures } from './banc-volumique';
import { COMBAT_TOKEN_BASE, teamRingRadiusK, type DynamicMarks } from '../builders/dynamicMarks';
import { HERO_RING } from '../teamColors';

/**
 * PAR FRAME, PAS PAR ÉVÉNEMENT (#1176, P3-0d) — le fait qui distingue une marque DYNAMIQUE d'une
 * marque de case : sa position se relit à la CADENCE DE LA FRAME, sur le glissement de l'instant, et
 * aucun rendu React n'a lieu entre deux pas (c'est tout l'acquis du lot P2-4, que ces trois repères ne
 * doivent pas défaire). Le banc n'appelle donc `root.render` qu'UNE fois : tout ce qui bouge ensuite
 * passe par le battement de marche, et par lui seul.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };
const SCENE: Scene = emptyScene(10, 10);
const DIMS: Dims = { w: SCENE.dimensions.w, h: SCENE.dimensions.h, rot: 0, view: 'iso' };

/** Un lien d'engagement, le contour de l'actif et l'anneau d'équipe, sur `h1` — le sujet que le banc
 *  fait glisser. */
const MARQUES: DynamicMarks = {
  tethers: [{ a: { id: 'h1', cell: { x: 2, y: 2, z: 0 } }, b: { id: 'e1', cell: { x: 4, y: 2, z: 0 } } }],
  active: { id: 'h1', cell: { x: 2, y: 2, z: 0 }, n: 1 },
  party: null,
  rings: [{ id: 'h1', cell: { x: 2, y: 2, z: 0 }, rK: teamRingRadiusK(COMBAT_TOKEN_BASE), color: HERO_RING[0] }],
};

let root: Root | null = null;
let hôte: HTMLDivElement | null = null;

brancherArdoise();

/** Le glissement que la boucle lira — une variable de MODULE, hors de tout état React. */
let glissement: { dx: number; dy: number; dz: number } | null = null;
/** La callback de frame que l'écran a souscrite au battement de marche. */
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

/** Position monde de l'instance `i` d'un pool. */
function positionDe(nom: string, i: number): THREE.Vector3 {
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  pool(nom).getMatrixAt(i, m);
  return pos.setFromMatrixPosition(m);
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

describe('Marques dynamiques — la pose se prend à la FRAME (#1176 P3-0d)', () => {
  it('un battement de marche déplace les marques ; aucun rendu React n’y participe', () => {
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

    expect(battre, 'l’écran doit s’être abonné au battement de marche').toBeTypeOf('function');
    const départTether = positionDe('marquesDyn:tether', 0).clone();
    const départActif = positionDe('marquesDyn:actif', 0).clone();
    const départAnneau = positionDe('marquesDyn:anneau', 0).clone();
    expect(pool('marquesDyn:anneau').count, 'le témoin doit VRAIMENT peindre un anneau').toBeGreaterThan(0);
    expect(pool('marquesDyn:tether').count, 'le témoin doit VRAIMENT peindre un lien').toBeGreaterThan(0);

    // Le glissement change SANS aucune écriture React (ni store, ni prop, ni état) : tant que la frame
    // ne se rejoue pas, la scène montée garde la pose précédente.
    const rendusAvant = scènes.length;
    glissement = { dx: 3, dy: 0, dz: 0 };
    expect(positionDe('marquesDyn:tether', 0).x).toBe(départTether.x);
    expect(scènes.length, 'changer le glissement ne déclenche à lui seul aucune frame').toBe(rendusAvant);

    // UNE frame de marche, et rien d'autre : la pose suit.
    battre!();
    expect(scènes.length).toBe(rendusAvant + 1);
    expect(positionDe('marquesDyn:tether', 0).x).toBeCloseTo(départTether.x + 3, 4);
    expect(positionDe('marquesDyn:actif', 0).x).toBeCloseTo(départActif.x + 3, 4);
    expect(positionDe('marquesDyn:anneau', 0).x, 'l’anneau d’équipe suit son porteur').toBeCloseTo(départAnneau.x + 3, 4);
    // L'autre extrémité du lien ne glisse pas : le dernier tiret reste où il était.
    const dernier = pool('marquesDyn:tether').count - 1;
    expect(positionDe('marquesDyn:tether', dernier).x).toBeLessThanOrEqual(4 * sceneMetresPerTile(SCENE));

    // Le pas suivant repart de la pose de l'instant, jamais d'un cumul.
    glissement = null;
    battre!();
    expect(positionDe('marquesDyn:tether', 0).x).toBeCloseTo(départTether.x, 4);
    expect(positionDe('marquesDyn:actif', 0).x).toBeCloseTo(départActif.x, 4);
    expect(positionDe('marquesDyn:anneau', 0).x).toBeCloseTo(départAnneau.x, 4);
  });
});
