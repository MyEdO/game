// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import type { Combatant } from '../../engine/types';
import type { Dims } from '../../geometry/iso';
import { GameStage3D, setStageRendererFactory, type StageFrame } from './GameStage3D';
import { BancRenderer, brancherArdoise, scènes, simulerRasterisation, type Rasterisation } from './banc-volumique';
import { clearBillboardTextures } from '../backends/webgl/svgTexture';
import { setBudgetTrancheMs } from '../backends/webgl/atlasBake';
import type { ActorPose } from '../backends/webgl/sceneMeshes';

/**
 * JUMEAU SANS CORPS — la fenêtre de MONTAGE PAR SUJET (#1337).
 *
 * Ce que ce banc mesure : entre le vidage du groupe précédent et la résolution de la texture de CHAQUE
 * sujet (chacun entre en scène dès SA rasterisation, jamais au dernier du lot), aucun jumeau de
 * silhouette — aplat à la couleur d'équipe, test de profondeur retourné — ne peut se rendre sans le
 * corps qu'il double. Le montage est ATOMIQUE par construction : le jumeau est un ENFANT du quad,
 * attaché dans le même geste synchrone, donc il n'existe ni avant lui, ni après le vidage, et la
 * visibilité de three descend du parent à l'enfant.
 *
 * Les trois faits se mesurent sur la scène RÉELLEMENT rendue, image par image, avec les textures
 * résolues UNE PAR UNE — c'est la fenêtre elle-même, pas une reconstitution.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };
const SCENE: Scene = emptyScene(10, 10);
const DIMS: Dims = { w: SCENE.dimensions.w, h: SCENE.dimensions.h, rot: 0, view: 'iso' };
const AFFINE: StageFrame = { mode: 'plateau', dims: DIMS, cam: { x: 0, y: 0 }, zoom: 1 };

function combattant(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind, pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: { 'capacite-de-combat': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

/** Deux acteurs d'équipes différentes : deux quads, donc deux jumeaux, donc une fenêtre à deux temps. */
function acteurs(dx = 0): ActorPose[] {
  return [
    { c: combattant('h1', 'hero', { x: 2 + dx, y: 2 }), x: 2 + dx, y: 2, z: 0, heroIndex: 0 },
    { c: combattant('e1', 'enemy', { x: 5, y: 2 }), x: 5, y: 2, z: 0 },
  ];
}

let root: Root | null = null;
let hôte: HTMLDivElement | null = null;
/** La rasterisation RETENUE de ce banc : jsdom ne charge rien, et ici on décide QUAND chaque sujet
 *  obtient sa texture — sa file `enAttente` EST la fenêtre de montage que le banc mesure. */
let ras!: Rasterisation;

brancherArdoise();

/** Laisse la file CADENCÉE du cuiseur poser ses tâches (#1372 : les textures du montage y passent
 *  aussi, une par tranche d'inactivité) jusqu'à ce qu'au moins `n` rasterisations soient EN VOL. */
async function enVol(n: number): Promise<void> {
  for (let i = 0; i < 60 && ras.enAttente.length < n; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  }
}

/** Libère LA prochaine rasterisation en vol (texture de sujet ou planche de flipbook — l'écran en
 *  demande des deux sortes, et la fenêtre les entrelace) et laisse l'écran faire ce qu'elle déclenche. */
async function résoudreUneRasterisation(): Promise<void> {
  await enVol(1);
  const suivante = ras.enAttente.shift();
  if (!suivante) throw new Error('aucune rasterisation en vol : la fenêtre de montage ne s’ouvre pas');
  await act(async () => { suivante(); });
}

/** L'INVARIANT du ticket, mesuré sur la scène rendue À CET INSTANT : chaque jumeau a son corps en
 *  scène, et il n'y en a pas un de plus. Un jumeau sans corps est exactement la silhouette pleine
 *  d'équipe rapportée en recette. */
function invariant(quand: string): void {
  const c = corps();
  for (const j of jumeaux()) {
    expect(c, `${quand} — ${j.name} : jumeau SANS son corps`).toContain(j.parent);
    expect(j.parent, `${quand} — ${j.name} : le jumeau est ENFANT du quad, jamais frère`).toBe(
      c.find((m) => m === j.parent),
    );
  }
  expect(jumeaux().length, `${quand} : un jumeau de plus que de corps`).toBeLessThanOrEqual(c.length);
}

/** Fait avancer la fenêtre rasterisation par rasterisation, en vérifiant l'invariant après CHACUNE,
 *  jusqu'à ce que `attendus` corps soient montés. Rend le nombre de corps observés à chaque étape. */
async function dérouler(attendus: number, quand: string): Promise<number[]> {
  const étapes: number[] = [];
  for (let i = 0; corps().length < attendus && i < 12; i++) {
    await résoudreUneRasterisation();
    invariant(`${quand} #${i + 1}`);
    étapes.push(corps().length);
  }
  expect(corps(), `${quand} : les ${attendus} corps sont montés`).toHaveLength(attendus);
  return étapes;
}

function rendre(actors: ActorPose[]): Promise<void> {
  return act(async () => {
    root!.render(
      <GameStage3D lecture="jeu"
        scene={SCENE}
        mpt={sceneMetresPerTile(SCENE)}
        frame={AFFINE}
        tintAt={() => 1}
        keepEl={() => true}
        els={{ tokens: [], props: [] }}
        actors={actors}
        gameTime={720}
        lightLevel={null}
        lights={[]}
      />,
    );
  });
}

/** La scène montée (une seule instance pour la vie de l'écran), ou `null` avant la première image. */
function scène(): THREE.Scene | null {
  return scènes[scènes.length - 1] ?? null;
}

/** Les jumeaux de silhouette portés par la scène. */
function jumeaux(): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  scène()?.traverse((o) => { if (o.name.startsWith('silhouette:')) out.push(o as THREE.Mesh); });
  return out;
}

/** Les CORPS de billboard : les quads dont le matériau porte le cadre de frame (le jumeau le partage,
 *  mais il porte un nom ; l'ombre de contact et le décor du monde n'en ont pas). */
function corps(): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  scène()?.traverse((o) => {
    const m = o as THREE.Mesh;
    const mat = m.material as THREE.Material | undefined;
    if (!o.name.startsWith('silhouette:') && mat && !Array.isArray(mat) && mat.userData.frameRect) out.push(m);
  });
  return out;
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

beforeEach(async () => {
  // CADENCE STRICTE (une tâche par tranche) : ce banc déroule la FENÊTRE DE MONTAGE rasterisation par
  // rasterisation, et ses rasterisations sont des modèles à coût NUL — sous le budget de temps d'une
  // tranche, toute la file partirait en vol d'un coup et il n'y aurait plus de fenêtre à dérouler.
  setBudgetTrancheMs(0);
  ras = simulerRasterisation('retenue');
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  await rendre(acteurs());
  await enVol(2);
});
afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
});

describe('Jumeau de silhouette — jamais rendu sans son corps (#1337)', () => {
  it('FENÊTRE DE MONTAGE : à chaque rasterisation résolue, jamais un jumeau de plus que de corps', async () => {
    // La fenêtre est RÉELLE : deux textures de sujet en vol, aucun quad encore monté.
    expect(ras.enAttente, 'un sujet, une rasterisation : sans deux temps, ce banc ne mesure rien').toHaveLength(2);
    expect(corps()).toHaveLength(0);
    expect(jumeaux()).toHaveLength(0);

    const étapes = await dérouler(2, 'montage');
    // …et le montage s'est bien fait PAR SUJET : la scène a porté UN corps seul avant d'en porter deux.
    expect(étapes, 'sans palier à un seul corps, la fenêtre du ticket n’a pas été traversée').toContain(1);
    expect(jumeaux(), 'un jumeau par corps à l’arrivée').toHaveLength(2);
  });

  it('VIDAGE : le groupe refait à neuf ne laisse AUCUN jumeau orphelin en attendant les corps suivants', async () => {
    await dérouler(2, 'montage initial');
    // Une POPULATION neuve (deux autres combattants) : les sujets changent, le groupe se vide, les
    // textures repartent en vol. C'est bien un rebuild qu'il faut ici, et un PAS n'en est plus un
    // (#1396 : la case appartient à la pose, elle se repose sur les quads montés). Le cache est vidé
    // d'abord — sur un HIT, la texture revient dans la microtâche suivante et la fenêtre se referme
    // trop vite pour qu'on y mesure quoi que ce soit.
    clearBillboardTextures();
    await rendre([
      { c: combattant('h2', 'hero', { x: 3, y: 2 }), x: 3, y: 2, z: 0, heroIndex: 0 },
      { c: combattant('e2', 'enemy', { x: 6, y: 2 }), x: 6, y: 2, z: 0 },
    ]);
    await enVol(1);
    expect(ras.enAttente.length, 'le rebuild rasterise à nouveau : la fenêtre se rouvre').toBeGreaterThan(0);
    expect(corps(), 'le groupe précédent est vidé').toHaveLength(0);
    expect(jumeaux(), 'un jumeau survivant au vidage se rendrait seul, en aplat d’équipe').toHaveLength(0);
    await dérouler(2, 'après vidage');
    expect(jumeaux()).toHaveLength(2);
  });

  it('VISIBILITÉ LIÉE : un corps masqué emmène son jumeau — three ne descend pas dans un parent invisible', async () => {
    await dérouler(1, 'montage');
    const [j] = jumeaux();
    const c = j.parent as THREE.Mesh;
    const vus = (): string[] => {
      const out: string[] = [];
      scène()!.traverseVisible((o) => out.push(o.name));
      return out;
    };
    expect(vus()).toContain(j.name);
    c.visible = false;
    expect(vus(), 'le jumeau se rend sans son corps : c’est exactement la silhouette pleine du ticket').not.toContain(j.name);
    c.visible = true;
    expect(vus()).toContain(j.name);
  });
});
