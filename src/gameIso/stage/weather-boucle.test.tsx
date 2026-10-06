// @vitest-environment jsdom
/**
 * BOUCLE DE CHUTE de l'écran de jeu volumique (#1176, P2-6) — deux propriétés que seul le MONTAGE
 * réel montre, la physique du semis étant pure par ailleurs (`weatherParticles.test.ts`) :
 *
 *  1. la boucle météo bat HORS des rendus React : elle doit donc peindre la frame COURANTE, jamais
 *     celle du rendu où le semis a changé — sinon une caméra qui tourne sous la pluie se dessine au
 *     cadrage périmé tant que rien ne re-monte le semis ;
 *  2. le semis SURVIT aux mutations de scène : une nouvelle référence de scène qui ne change ni la
 *     météo ni l'emprise (un pas de combattant en produit une par frame) ne re-monte aucun semis.
 *
 * Le canevas n'a pas de contexte WebGL en jsdom : la passe de dessin s'arrêterait à sa première garde
 * et ne mesurerait RIEN. Le banc en fournit un par le REGISTRE de l'écran (`setStageRendererFactory`),
 * jamais par un mock de module (la suite partage son graphe, `src/vi-mock-isolate-guard.test.ts`) —
 * tout le reste (cadrage, caméra, semis, composant) est de production.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Dims } from '../../geometry/iso';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import { GameStage3D, setStageRendererFactory, type StageWalkAnim } from './GameStage3D';
import { BancRenderer, brancherArdoise, brancherImagesPilotees } from './banc-volumique';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Ce que le banc retient de chaque frame DESSINÉE : la projection de sa caméra (donc son cadrage,
 *  donc son zoom) et la scène three montée à cet instant. */
interface Frame {
  projection: string;
  scene: THREE.Scene;
}
let frames: Frame[] = [];

brancherArdoise();
/** L'horloge du banc et sa file de rAF : ce banc COMPTE les boucles armées et les images peintes, il
 *  ne mesure ni la vitesse de la machine ni l'ordre des fichiers du worker. */
const images = brancherImagesPilotees();

/** Le canevas de jsdom n'a aucune boîte : la passe de dessin sort sur `!w || !h` sans elle. */
const TAILLE = { w: 800, h: 600 };

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer((scene, camera) => {
    frames.push({ projection: [...camera.projectionMatrix.elements].join(','), scene });
  }));
});

afterAll(() => setStageRendererFactory(null));

const scenePluie = (): Scene => {
  const scene = emptyScene(8, 8);
  scene.weather = 'pluie';
  scene.ambiance = 'exterieur';
  return scene;
};

const dimsDe = (scene: Scene): Dims => ({ w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' });

/** Le stage tel que l'hôte volumique le monte : aucun pilote d'images — l'écran s'abonne lui-même au
 *  battement du module, que l'averse TIENT tant qu'elle tombe. */
const ANIM: StageWalkAnim = {
  glide: () => null,
  cam: () => ({ x: 0, y: 0 }),
};

const props = (scene: Scene, zoom: number) => ({
  scene,
  mpt: sceneMetresPerTile(scene),
  frame: { mode: 'plateau', dims: dimsDe(scene), cam: { x: 0, y: 0 }, zoom } as const,
  tintAt: () => 1,
  keepEl: () => true,
  els: { tokens: [], props: [] },
  actors: [],
  gameTime: 12 * 60,
  lightLevel: null,
  lights: [],
  // Câblage de PRODUCTION (`VolumetricWorld`) : l'écran reçoit ses images du battement UNIQUE du stage,
  // que l'averse TIENT tant qu'elle tombe (#1378) — c'est par là que la boucle de chute passe désormais.
  anim: ANIM,
});

let root: Root | null = null;
let hôte: HTMLDivElement | null = null;

function monter(scene: Scene, zoom: number): void {
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  act(() => root!.render(<GameStage3D lecture="jeu" {...props(scene, zoom)} />));
}

const rendre = (scene: Scene, zoom: number) => act(() => root!.render(<GameStage3D lecture="jeu" {...props(scene, zoom)} />));

const derniere = (): Frame | undefined => frames[frames.length - 1];
/** Le semis MONTÉ dans la scène three de la dernière frame (`null` = rien ne tombe). */
const semisMonte = (): THREE.Object3D | null => derniere()?.scene.getObjectByName('precip') ?? null;

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
  frames = [];
});

describe('Boucle de chute — elle peint la frame COURANTE (#1176 P2-6)', () => {
  it('un zoom changé sans toucher au semis est celui que la boucle dessine', () => {
    const scene = scenePluie();
    monter(scene, 1);
    // Le banc mesure quelque chose : il tombe bien un semis, et la frame est bien dessinée.
    expect(semisMonte()).not.toBeNull();
    const cadrage1 = derniere()!.projection;

    // Le zoom change, la scène (donc le semis) non : aucun effet ne se rejoue, la boucle reste celle
    // du montage — c'est exactement le cas où une closure périmée peindrait l'ancien cadrage.
    rendre(scene, 2);
    const cadrage2 = derniere()!.projection;
    expect(cadrage2).not.toBe(cadrage1); // le zoom EST discriminable dans la projection

    frames = [];
    // PRÉMISSE : une boucle armée, et UNE seule — deux rappels en vol diraient deux boucles
    // concurrentes, et le compte d'images ci-dessous ne vaudrait plus rien.
    expect(images.enVol.length).toBe(1);

    const IMAGES = 3;
    for (let i = 0; i < IMAGES; i++) { images.battre(); expect(images.enVol.length).toBe(1); }
    // UN écran abonné, UNE image peinte par battement : le compte est EXACT. « Au moins une » laissait
    // passer une boucle qui s'éteint après la première, comme une boucle qui repeint en rafale.
    expect(frames.length).toBe(IMAGES);
    expect([...new Set(frames.map((f) => f.projection))]).toEqual([cadrage2]);
  });
});

describe('Semis retenu — une mutation de scène ne re-sème pas l’averse (#1176 P2-6)', () => {
  it('deux références du MÊME plan gardent le semis monté ; la météo authorée le renouvelle', () => {
    const scene = scenePluie();
    monter(scene, 1);
    const semis = semisMonte();
    expect(semis).not.toBeNull();

    // Ce que produit le store à chaque pas d'un combattant : le même plan, une autre référence. Le
    // semis monté est le MÊME objet — donc le champ n'a pas été re-semé (le groupe d'intempéries ne se
    // remonte qu'au changement de champ).
    rendre({ ...scene }, 1);
    expect(semisMonte()).toBe(semis);

    // …et ce qui DOIT le renouveler : la météo authorée change.
    rendre({ ...scene, weather: 'neige' }, 1);
    expect(semisMonte()).not.toBe(semis);
  });
});
