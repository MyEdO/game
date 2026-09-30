// @vitest-environment jsdom
/**
 * LE STYLE DE LA VUE DU DESSUS SUR LE CHEMIN RÉEL (#1176, P3-5) — `MondeDeCampagne` monté en voie volumique,
 * mesuré sur ce qui part au GPU, jamais sur une intention :
 *  - D1, TOITS : en vue du dessus, AUCUN span de toiture n'est dessiné (découvert PERMANENT) ; en
 *    plateau iso, le MÊME monde garde ses toits — la loi de dégagement y vit entière ;
 *  - D5, OMBRES : la directionnelle n'est pas montée (trace `data-sun`), alors que la même scène à la
 *    même heure en monte une en iso ;
 *  - NAPPES : le plateau du dessus n'en monte aucune (trace `data-brume`) — l'écrêtage météo de #1247
 *    garde sa raison propre, et son banc (`weather-ecretage.test.tsx`) reste inchangé.
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
import { BancRenderer, brancherArdoise, canevas as canevasDe, scènes, viderCaptures } from './banc-volumique';
import { stageLightScalars } from './stageLights';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };
const MIDI = 12 * 60;

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
/** Le groupe se tient DEHORS et devant : en iso, la toiture est donc bien DESSINÉE (aucune levée
 *  d'écran ne vient masquer le témoin). */
const DEHORS = { x: 10, y: 10 };

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

brancherArdoise();

function scèneCoiffée(): Scene {
  const scene = { ...emptyScene(12, 12), ambiance: 'exterieur' as const };
  scene.architecture = [{ id: 'maison', label: 'Maison', style: 'maison', storeys: [], facades: [], masses: [TOIT] }];
  return scene;
}

function monter(scene: Scene, view: ViewMode): HTMLDivElement {
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
  } as never);
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(<MondeDeCampagne />));
  return conteneur;
}

/** Démonte l'arbre courant et remonte sous un AUTRE regard — le geste de comparaison de ce banc. */
function remonter(scene: Scene, view: ViewMode): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
  monter(scene, view);
}

const canevas = () => canevasDe(conteneur!);

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

/** Les SOMMETS réellement dessinés : l'index compacté par le dégagement, lu groupe par groupe — ce
 *  que le GPU parcourt, et rien d'autre. */
function sommetsDessinés(mesh: THREE.Mesh): Set<number> {
  const index = mesh.geometry.getIndex() as THREE.BufferAttribute;
  const arr = index.array as Uint32Array;
  const vus = new Set<number>();
  for (const g of mesh.geometry.groups) {
    for (let i = g.start; i < g.start + g.count; i++) vus.add(arr[i]);
  }
  return vus;
}

/** Les sommets que la cuisson attribue aux TOITURES de cette scène. Cuisson à part (contrat de
 *  propriété de `BakedWorld`) : on n'y lit que l'index des spans, jamais la géométrie rendue. */
function sommetsDeToiture(scene: Scene): Set<number> {
  const baked = bakeWorldGeometry(scene, sceneMetresPerTile(scene), 'jeu');
  const out = new Set<number>();
  for (const span of baked.spans) {
    if (span.el.kind !== 'roof') continue;
    for (let v = span.start; v < span.start + span.count; v++) out.add(v);
  }
  baked.geometry.dispose();
  return out;
}

const toituresDessinées = (scene: Scene): number => {
  const dessinés = sommetsDessinés(mondeRendu());
  return [...sommetsDeToiture(scene)].filter((v) => dessinés.has(v)).length;
};

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
afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
});

describe('D1 — les toits en vue du dessus : découvert PERMANENT', () => {
  it('PLATEAU ISO (témoin) : la toiture d’une maison non levée est bien DESSINÉE', () => {
    const scene = scèneCoiffée();
    monter(scene, 'iso');
    expect(sommetsDeToiture(scene).size, 'témoin : la scène doit vraiment porter des spans de toit').toBeGreaterThan(0);
    expect(toituresDessinées(scene)).toBeGreaterThan(0);
  });

  it('VUE DU DESSUS : plus AUCUN sommet de toiture dans ce que le monde dessine', () => {
    const scene = scèneCoiffée();
    monter(scene, 'top');
    expect(sommetsDeToiture(scene).size).toBeGreaterThan(0);
    expect(toituresDessinées(scene)).toBe(0);
    // …et le monde n'est pas vide pour autant : le plancher et les murs restent dessinés.
    expect(sommetsDessinés(mondeRendu()).size).toBeGreaterThan(0);
  });
});

describe('D5 — le RÉGIME SANS SOLEIL de la vue du dessus, sur le canevas', () => {
  it('ISO à midi : une directionnelle (témoin) ; DESSUS : aucune, et l’exposition est celle du régime', () => {
    const scene = scèneCoiffée();
    monter(scene, 'iso');
    expect(canevas().dataset.sun, 'témoin : un extérieur de midi monte un soleil').toBeTruthy();
    const isoLum = Number(canevas().dataset.lum);

    remonter(scene, 'top');
    expect(canevas().dataset.sun).toBeUndefined();
    // L'exposition attendue se LIT SUR LA LOI (le régime sans soleil de `stageLightScalars`), jamais
    // sur ce que la frame a rendu : le monde et les pions y sont appariés par construction.
    const régime = stageLightScalars({ scene, gameTime: MIDI, lightLevel: null, ombreSoleil: false });
    expect(canevas().dataset.lum).toBe(régime.surfaceLuminance.toFixed(4));
    expect(régime.surfaceLuminance).toBeLessThan(isoLum); // la part solaire est partie AVEC sa lampe
  });
});

describe('Météo en vue du dessus — pas de particule, mais la météo pèse toujours', () => {
  it('NAPPES : des nappes en iso (témoin) ; aucune au-dessus', () => {
    const scene = { ...scèneCoiffée(), weather: 'brouillard' as const };
    monter(scene, 'iso');
    expect(canevas().dataset.brume, 'témoin : une météo à nappes en monte en iso').toBeTruthy();

    remonter(scene, 'top');
    expect(canevas().dataset.brume).toBeUndefined();
  });

  it('SEMIS : la pluie tombe en iso (témoin) ; au-dessus, aucune particule — donc rien à écrêter', () => {
    const scene = { ...scèneCoiffée(), weather: 'pluie' as const };
    monter(scene, 'iso');
    expect(Number(canevas().dataset.precip), 'témoin : l’averse sème bien en iso').toBeGreaterThan(0);

    remonter(scene, 'top');
    expect(canevas().dataset.precip).toBeUndefined();
  });

  it('les canaux NON PARTICULAIRES de la météo restent vivants au-dessus (teinte, exposition)', () => {
    const clair = scèneCoiffée();
    monter(clair, 'top');
    const [lumClair, fondClair] = [canevas().dataset.lum, canevas().dataset.bg];

    const orage = { ...scèneCoiffée(), weather: 'pluie' as const };
    remonter(orage, 'top');
    // Même regard, même heure : seule la météo change — et elle change encore l'écran, sans particule.
    expect([canevas().dataset.lum, canevas().dataset.bg]).not.toEqual([lumClair, fondClair]);
    expect(canevas().dataset.precip).toBeUndefined();
  });
});
