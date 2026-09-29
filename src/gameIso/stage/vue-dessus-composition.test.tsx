// @vitest-environment jsdom
/**
 * LA COMPOSITION DE LA VUE DU DESSUS SUR LE CHEMIN RÉEL (#1176, P3-5b) — `MondeDeCampagne` monté en voie
 * volumique, mesuré sur ce qui part au GPU ET sur le DOM réellement émis :
 *  - D4, MURS AU TRAIT : le monde cuit ne dessine plus AUCUN sommet de mur (ni de toit) au-dessus, et
 *    la surcouche SVG porte les traits ; en plateau iso, l'inverse exact — murs peints par le monde,
 *    aucun trait SVG ;
 *  - le masque garde bien TOUS les sols de l'étage actif (le plan reste plein, ce n'est pas un monde
 *    amputé) ;
 *  - D3, GRILLE TACTIQUE : présente au-dessus, absente en iso, et posée SOUS la structure au trait ;
 *  - ORDRE D'EMPILEMENT : grille, puis murs, puis les affordances d'interaction (portes, chrome) —
 *    l'état d'une porte se lit SUR son mur.
 *
 * ÉCART CONNU, mesuré ici comme tel : les PIONS sont peints par le canevas volumique, qui vit SOUS le
 * SVG entier — aucune surcouche SVG ne peut passer sous eux. L'ordre garanti est donc celui des
 * surcouches entre elles.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useGame } from '../../state/store';
import { emptyScene, sceneMetresPerTile, type BuildingMass, type Scene } from '../../state/scene';
import { setRevealAll } from '../../state/visionState';
import type { ViewMode } from '../../geometry/iso';
import { bakeWorldGeometry, type WorldGeometry } from '../backends/webgl/sceneMeshes';
import { MondeDeCampagne } from './MondeDeCampagne';
import { setStageRendererFactory } from './GameStage3D';
import { BancRenderer, brancherArdoise, scènes, viderCaptures } from './banc-volumique';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };
const MIDI = 12 * 60;
/** Le groupe se tient DEHORS et devant : en iso, rien n'est levé par la loi de dégagement. */
const DEHORS = { x: 10, y: 10 };

/** La masse qui coiffe le carré de cases (3,3)-(6,6) — la fixture des bancs de cutaway. */
const TOIT: BuildingMass = {
  id: 'toit-maison',
  z: 0,
  footprint: [{ x: 3, y: 3, w: 4, h: 4 }],
  levels: 1,
  profile: 'gable',
  ridge: 'x',
  pitchDeg: 45,
  material: 'tuile',
};

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

brancherArdoise();

/** Une scène de CLOISONS : des murs sur arêtes, aucune masse — le masque n'a donc rien à dégager, et
 *  « tous les sols de l'étage » y est une affirmation vérifiable. */
function scèneDeCloisons(): Scene {
  const scene = { ...emptyScene(10, 10), ambiance: 'exterieur' as const };
  scene.walls = [
    { x: 2, y: 2, side: 'N' }, { x: 3, y: 2, side: 'N' }, { x: 2, y: 2, side: 'E' },
    { x: 5, y: 6, side: 'N' }, { x: 6, y: 6, side: 'E' },
  ];
  return scene;
}

/** La même, coiffée d'une masse : de quoi mesurer que les TOITS ne se dessinent pas non plus. */
function scèneCoiffée(): Scene {
  const scene = scèneDeCloisons();
  scene.architecture = [{ id: 'maison', label: 'Maison', style: 'maison', storeys: [], facades: [], masses: [TOIT] }];
  return scene;
}

function monter(scene: Scene, view: ViewMode, debugLabels = false): HTMLDivElement {
  viderCaptures();
  const { w, h } = scene.dimensions;
  const toutes: string[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) toutes.push(`${x},${y},0`);
  useGame.setState({
    screen: 'campaign',
    scene,
    mode: 'exploration',
    partyPos: DEHORS,
    party: [],
    explored: { [scene.id]: toutes },
    battle: null,
    dialogue: null,
    flags: {},
    gameTime: MIDI,
    lightLevel: null,
    viewMode: view,
    debugLabels,
  } as never);
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(<MondeDeCampagne />));
  return conteneur;
}

function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
}

/** Démonte l'arbre courant et remonte sous un AUTRE regard — le geste de comparaison de ce banc. */
function remonter(scene: Scene, view: ViewMode): void {
  démonter();
  monter(scene, view);
}

/** Le maillage du MONDE dans la dernière frame rendue : le seul qui porte l'index de la masse cuite. */
function mondeRendu(): THREE.Mesh {
  const scène = scènes[scènes.length - 1];
  let trouvé: THREE.Mesh | null = null;
  scène.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && (m.geometry as WorldGeometry).userData?.surfaceGroups) trouvé = m;
  });
  if (!trouvé) throw new Error('aucun maillage de monde dans la frame');
  return trouvé;
}

/** Les SOMMETS réellement dessinés : l'index compacté par le masque, lu groupe par groupe — ce que le
 *  GPU parcourt, et rien d'autre. */
function sommetsDessinés(mesh: THREE.Mesh): Set<number> {
  const index = mesh.geometry.getIndex() as THREE.BufferAttribute;
  const arr = index.array as Uint32Array;
  const vus = new Set<number>();
  for (const g of mesh.geometry.groups) {
    for (let i = g.start; i < g.start + g.count; i++) vus.add(arr[i]);
  }
  return vus;
}

/** Les sommets que la cuisson attribue aux éléments de ce genre, à cet étage (`z` absent = tous). */
function sommetsDeGenre(scene: Scene, kind: 'floor' | 'wall' | 'roof', z?: number): Set<number> {
  const baked = bakeWorldGeometry(scene, sceneMetresPerTile(scene));
  const out = new Set<number>();
  for (const span of baked.spans) {
    if (span.el.kind !== kind) continue;
    if (z != null && span.el.cell.z !== z) continue;
    for (let v = span.start; v < span.start + span.count; v++) out.add(v);
  }
  baked.geometry.dispose();
  return out;
}

const dessinésDeGenre = (scene: Scene, kind: 'floor' | 'wall' | 'roof', z?: number): number => {
  const dessinés = sommetsDessinés(mondeRendu());
  return [...sommetsDeGenre(scene, kind, z)].filter((v) => dessinés.has(v)).length;
};

const groupeCam = (): SVGGElement => conteneur!.querySelector('svg.iso-stage > g') as SVGGElement;
const traits = (): SVGGElement | null => conteneur!.querySelector('[data-murs-trait]');
const grille = (): SVGGElement | null => conteneur!.querySelector('[data-grille-jeu]');

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
  setRevealAll(true);
});
afterAll(() => {
  setStageRendererFactory(null);
  setRevealAll(false);
});
afterEach(démonter);

describe('D4 — les murs de la vue du dessus : au TRAIT, et une seule fois', () => {
  it('PLATEAU ISO (témoin) : le monde peint ses murs, et AUCUN trait SVG ne les double', () => {
    const scene = scèneDeCloisons();
    monter(scene, 'iso');
    expect(sommetsDeGenre(scene, 'wall').size, 'témoin : la scène doit vraiment porter des murs').toBeGreaterThan(0);
    expect(dessinésDeGenre(scene, 'wall')).toBeGreaterThan(0);
    expect(traits()).toBeNull();
  });

  it('VUE DU DESSUS : plus aucun sommet de mur au GPU, et les traits SVG portent la structure', () => {
    const scene = scèneDeCloisons();
    monter(scene, 'top');
    expect(dessinésDeGenre(scene, 'wall')).toBe(0);
    expect(Number(traits()!.dataset.mursTrait), 'un trait par élément de mur de l’étage').toBeGreaterThan(0);
    // Le trait est bien le trait de COUPE du peintre de la vue du dessus, pas une face projetée, sous le
    // groupe caméra qui porte son échelle écran (`stageCamStyle`).
    expect(traits()!.innerHTML).toContain('class="mur-coupe mur-coeur"');
    expect(Number(traits()!.parentElement!.style.getPropertyValue('--k'))).toBeGreaterThan(0);
  });

  it('le masque garde TOUS les sols de l’étage actif : le plan est plein, pas amputé', () => {
    const scene = scèneDeCloisons();
    monter(scene, 'top');
    const dessinés = sommetsDessinés(mondeRendu());
    const sols = sommetsDeGenre(scene, 'floor', 0);
    expect(sols.size).toBeGreaterThan(0);
    expect([...sols].filter((v) => !dessinés.has(v))).toEqual([]);
    // …et rien d'autre que des sols : ni mur, ni toit.
    expect([...dessinés].filter((v) => !sols.has(v))).toEqual([]);
  });

  it('les TOITS ne reviennent pas par la surcouche : ni au GPU, ni au trait', () => {
    const scene = scèneCoiffée();
    monter(scene, 'top');
    expect(sommetsDeGenre(scene, 'roof').size).toBeGreaterThan(0);
    expect(dessinésDeGenre(scene, 'roof')).toBe(0);
    expect(dessinésDeGenre(scene, 'wall')).toBe(0);
  });
});

describe('D3 — la grille tactique', () => {
  it('présente au-dessus (un trait par rangée et par colonne), absente en iso', () => {
    const scene = scèneDeCloisons();
    monter(scene, 'top');
    const d = scene.dimensions;
    expect(Number(grille()!.dataset.grilleJeu)).toBe(d.w + d.h + 2);
    expect(grille()!.querySelectorAll('line').length).toBe(d.w + d.h + 2);

    remonter(scene, 'iso');
    expect(grille()).toBeNull();
  });
});

describe('ORDRE D’EMPILEMENT de la surcouche de plateau', () => {
  it('la grille est SOUS la structure, la structure SOUS ce qui se peint par-dessus le monde', () => {
    const scene = scèneDeCloisons();
    // Une surcouche TÉMOIN qui rend quelque chose sans combat ni portail : l'annotation de carte, émise
    // en fin de groupe comme les affordances (portes, escaliers, télégraphes, chrome des jetons).
    monter(scene, 'top', true);
    const enfants = [...groupeCam().children];
    expect(enfants.indexOf(grille()!)).toBe(0); // fond de plateau : rien ne se peint dessous
    expect(enfants.indexOf(traits()!)).toBe(1);
    expect(enfants.length).toBeGreaterThan(2); // …et le témoin est bien APRÈS les deux
  });
});
