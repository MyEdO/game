// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { heightAt, sceneMetresPerTile } from '../../state/scene';
import type { Combatant } from '../../engine/types';
import type { Dims } from '../../geometry/iso';
import { diligenceCampaign } from '../../scenes/campaign';
import { buildRoofs } from '../builders/roofs';
import { elOccluder } from './occluders';
import { actorCapsuleOf } from './actorCapsule';
import type { ActorPose } from '../backends/webgl/sceneMeshes';
import {
  GameStage3D,
  setStageRendererFactory,
  type PercageEntrees,
  type StageFrame,
  type StageRenderer,
  type StageWalkAnim,
} from './GameStage3D';
import { PERCAGE_DEFINE, PERCAGE_FONDU_MS, PERCAGE_RAYON_PX, percerMateriau, trousPercage } from '../backends/webgl/percageLocal';
import { centrePercage, clePercage } from './percage';
import { frameRectOf } from './boardPose';
import { IsoStage } from '../IsoStage';
import { useGame } from '../../state/store';

/**
 * DÉCOUPE LOCALE PAR OCCLUSION — L'HÔTE (#1176, M3). Le CANAL (`percage-canal.test.ts`) et le VERDICT
 * (`percage.test.ts`) sont mesurés ailleurs ; ce banc mesure le CÂBLAGE, et rien d'autre : les
 * matériaux du monde savent-ils se trouer, la passe d'OMBRE partage-t-elle le discard, et un héros
 * réellement coiffé voit-il son trou s'ouvrir dans la frame que l'écran dessine.
 *
 * Sur La Diligence RÉELLE et au montage RÉEL (`createRoot`/`act`, renderer de banc) : un `creerPercage`
 * appelé à la main ne dirait rien du branchement.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };
const SCENE = diligenceCampaign.scenes[0];
const DIMS: Dims = { ...SCENE.dimensions, rot: 0, view: 'iso' };
const CADRE: StageFrame = { mode: 'plateau', dims: DIMS, cam: { x: 0, y: 0 }, zoom: 1 };

/** POSTE COIFFÉ et POSTE À DÉCOUVERT — les mêmes que le banc du verdict (`percage.test.ts`). */
const COIFFÉ = { x: 24, y: 22 } as const;
const DÉCOUVERT = { x: 31, y: 0 } as const;

/** Le montage du stage, mot pour mot (`IsoStage`) : une nappe par masse de toit, projetée. */
const LIDS = buildRoofs(SCENE).map((el) => ({
  sectionId: el.sectionId ?? el.key, z: el.cell.z, cells: el.cells, occluder: elOccluder(el, DIMS),
}));

function combattant(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: { 'capacite-de-combat': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

function poseDe(pos: { x: number; y: number }): ActorPose[] {
  return [{ c: combattant('h1', pos), x: pos.x, y: pos.y, z: 0, heroIndex: 0 }];
}

/** Les entrées que l'hôte de plateau fournit (`IsoStage`) pour ce héros-là. */
function entreesDe(pos: { x: number; y: number }): PercageEntrees {
  return {
    cle: clePercage({ tuiles: [{ id: 'h1', x: pos.x, y: pos.y, z: 0 }], rot: 0, view: 'iso', activeZ: 0 }),
    lids: LIDS,
    heros: [{ cid: 'h1', capsule: actorCapsuleOf({ x: pos.x, y: pos.y, h: heightAt(SCENE, pos.x, pos.y, 0) }, DIMS), z: 0 }],
  };
}

class BancRenderer implements StageRenderer {
  shadowMap = { enabled: false, autoUpdate: true, needsUpdate: false, type: THREE.PCFShadowMap };
  capabilities = { getMaxAnisotropy: () => 1 };
  setPixelRatio(): void {}
  setClearColor(): void {}
  setSize(): void {}
  dispose(): void {}
  render(scene: THREE.Scene, camera: THREE.Camera): void { scènes.push(scene); cameras.push(camera); }
}

let scènes: THREE.Scene[] = [];
/** La caméra de CHAQUE frame dessinée — le banc du lacet libre en compare deux. */
let cameras: THREE.Camera[] = [];
let root: Root | null = null;
let hôte: HTMLDivElement | null = null;
let urlAvant: { create: typeof URL.createObjectURL; revoke: typeof URL.revokeObjectURL } | null = null;

/** Ce que la BOUCLE DE MARCHE fait vivre hors de React : le battement abonné, le glissement du sujet
 *  et le cadrage de l'instant. Les trois sont pilotés par le banc. */
let battre: (() => void) | null = null;
let glissement: { dx: number; dy: number; dz: number } | null = null;
let cadrage = { x: 0, y: 0 };

const anim: StageWalkAnim = {
  subscribe: (onFrame) => { battre = onFrame; return () => { battre = null; }; },
  glide: (cid) => (cid === 'h1' ? glissement : null),
  cam: () => cadrage,
};

/** Rasterisation de billboard SIMULÉE au niveau du DOM (patron de `silhouette-corps.test.tsx`) : sans
 *  elle la promesse de texture reste pendante et AUCUN quad n'est monté — donc aucun centre de trou. */
function simulerRasterisation(): void {
  vi.stubGlobal('Image', class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) { queueMicrotask(() => this.onload?.()); }
  });
  urlAvant = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  URL.createObjectURL = () => 'blob:banc';
  URL.revokeObjectURL = () => undefined;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: () => undefined } as unknown as CanvasRenderingContext2D);
}

/** Rend (ou re-rend) l'écran volumique sous le cadre donné, sur la racine courante. */
async function rendre(pos: { x: number; y: number }, percage: PercageEntrees | null, cadre: StageFrame, heure = 720): Promise<void> {
  await act(async () => {
    root!.render(
      <GameStage3D
        scene={SCENE}
        mpt={sceneMetresPerTile(SCENE)}
        frame={cadre}
        tintAt={() => 1}
        keepEl={() => true}
        els={{ tokens: [], props: [] }}
        actors={poseDe(pos)}
        gameTime={heure}
        lightLevel={null}
        lights={[]}
        anim={anim}
        percage={percage}
      />,
    );
  });
}

async function monter(pos: { x: number; y: number }, percage: PercageEntrees | null): Promise<void> {
  scènes = [];
  cameras = [];
  glissement = null;
  cadrage = { x: 0, y: 0 };
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  await rendre(pos, percage, CADRE);
}

/** Le maillage du MONDE de la dernière frame : le seul à porter UN MATÉRIAU PAR GROUPE DE SURFACE
 *  (`worldSurfaceMaterials`) tout en empruntant sa géométrie au bake — les jumeaux de silhouette
 *  empruntent la leur eux aussi, mais n'ont qu'un matériau. */
function mailleMonde(): THREE.Mesh {
  const scene = scènes[scènes.length - 1];
  if (!scene) throw new Error('aucune frame dessinée');
  let trouvé: THREE.Mesh | null = null;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.userData.emprunte === true && Array.isArray(m.material)) trouvé = m;
  });
  if (!trouvé) throw new Error('aucun maillage de monde dans la scène rendue');
  return trouvé;
}

/** Le QUAD du héros de la dernière frame — un mesh dont le matériau porte un cadre de frame de
 *  flipbook (`billboardMaterial`). C'est SA position que la découpe reprojette. Le JUMEAU de
 *  silhouette porte le même cadre mais est ENFANT du corps, donc posé à l'origine locale : on garde le
 *  premier trouvé, la traversée descendant du parent vers l'enfant. */
function quadHeros(): THREE.Mesh {
  const scene = scènes[scènes.length - 1];
  if (!scene) throw new Error('aucune frame dessinée');
  let trouvé: THREE.Mesh | null = null;
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    const mat = m.isMesh && !Array.isArray(m.material) ? (m.material as THREE.Material | undefined) : undefined;
    if (!trouvé && mat && frameRectOf(mat)) trouvé = m;
  });
  if (!trouvé) throw new Error('aucun quad de billboard dans la scène rendue');
  return trouvé;
}

/** Le centre écran que le shader DOIT lire : la position du quad, projetée par la caméra de la
 *  DERNIÈRE frame dessinée. Algèbre pure (`uPercageVP` × position monde) — aucun pixel en jeu. */
function centreAttendu(): THREE.Vector3 {
  const camera = cameras[cameras.length - 1];
  if (!camera) throw new Error('aucune caméra de frame');
  return centrePercage(camera, quadHeros().position, TAILLE.w, TAILLE.h);
}

function materiauxMonde(): THREE.Material[] {
  const m = mailleMonde().material;
  return Array.isArray(m) ? m : [m];
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
  simulerRasterisation();
});

afterAll(() => {
  setStageRendererFactory(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (urlAvant) { URL.createObjectURL = urlAvant.create; URL.revokeObjectURL = urlAvant.revoke; }
});

// Les quatre trous sont des uniformes PARTAGÉS par le module : un banc les remet à zéro, sans quoi le
// rayon laissé ouvert par le montage précédent se lirait comme celui du montage courant.
beforeEach(() => { for (const t of trousPercage()) t.set(0, 0, 0, 0); });

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
});

describe('Le MONDE sait se trouer (#1176, M3)', () => {
  it('chaque matériau du monde porte le define et LA MÊME référence de branchement', async () => {
    await monter(COIFFÉ, entreesDe(COIFFÉ));
    const mats = materiauxMonde();
    expect(mats.length).toBeGreaterThan(0);
    // La référence PARTAGÉE : `customProgramCacheKey` la sérialise, deux matériaux qui la portent
    // gardent le même programme. Un témoin percé à la main donne la référence attendue.
    const témoin = new THREE.MeshBasicMaterial();
    percerMateriau(témoin);
    for (const m of mats) {
      expect(m.defines?.[PERCAGE_DEFINE], 'define de découpe locale').toBe('');
      expect(m.onBeforeCompile).toBe(témoin.onBeforeCompile);
    }
    témoin.dispose();
  });

  it('la passe d’OMBRE partage le discard : le monde porte un matériau de profondeur percé', async () => {
    await monter(COIFFÉ, entreesDe(COIFFÉ));
    const profondeur = mailleMonde().customDepthMaterial as THREE.MeshDepthMaterial | undefined;
    expect(profondeur, 'customDepthMaterial du monde').toBeTruthy();
    expect(profondeur!.defines?.[PERCAGE_DEFINE]).toBe('');
    expect(profondeur!.isMeshDepthMaterial).toBe(true);
  });
});

describe('Le TROU s’ouvre sur le héros coiffé, et sur lui seul (#1176, M3)', () => {
  it('héros COIFFÉ (24,22) : son trou a un rayon, et sa profondeur écran est celle d’un point vu', async () => {
    await monter(COIFFÉ, entreesDe(COIFFÉ));
    const trous = trousPercage();
    expect(trous[0].w, 'rayon du trou du héros coiffé').toBeGreaterThan(0);
    expect(trous[0].z, 'profondeur écran du héros, dans [0,1]').toBeGreaterThan(0);
    expect(trous[0].z).toBeLessThan(1);
    expect(trous[1].w, 'aucun second héros : son emplacement reste éteint').toBe(0);
  });

  it('TÉMOIN — héros à DÉCOUVERT (31,0) : aucun trou ne s’ouvre', async () => {
    await monter(DÉCOUVERT, entreesDe(DÉCOUVERT));
    expect(trousPercage()[0].w, 'rayon du trou du héros à découvert').toBe(0);
  });

  it('TÉMOIN — sans entrées d’hôte (première personne, éditeur) : aucun trou, même coiffé', async () => {
    await monter(COIFFÉ, null);
    expect(trousPercage()[0].w).toBe(0);
  });
});

/**
 * LE CENTRE EST UNE GRANDEUR DE FRAME — LA nouveauté de ce lot par rapport au verdict M2, et sa raison
 * d'être. Depuis la rotation continue (#1176, a5c6129c) et depuis la boucle de marche (P2-4), le
 * CADRAGE et la position du sujet vivent HORS des rendus React : la caméra se redemande à `anim.cam()`
 * et le quad glisse à `anim.glide()`, à chaque battement. La clé du verdict (`clePercage` : pas franchi,
 * cran, étage), elle, ne bouge pas d'un iota. Le trou doit donc se REPROJETER à la frame, sans attendre
 * un verdict — sinon il reste cloué à sa position d'ouverture pendant toute la rotation et toute la
 * marche.
 *
 * Ce banc bat la boucle HORS React (aucun re-rendu, donc aucun quad remonté, aucune clé neuve) : c'est
 * la seule mesure qui distingue « reprojeté à la frame » de « recalculé parce que tout a été refait ».
 * De l'algèbre pure (`uPercageVP` × position monde) — l'absence de contexte GL n'y change rien.
 */
describe('Le centre du trou se reprojette À LA FRAME, hors de tout rendu React (#1176, M3)', () => {
  it('un battement de la boucle : cadrage et glissement bougent, le trou suit — clé de verdict inchangée', async () => {
    await monter(COIFFÉ, entreesDe(COIFFÉ));
    const avant = trousPercage()[0].clone();
    const attenduAvant = centreAttendu();
    expect(avant.w, 'le trou est ouvert avant le battement').toBeGreaterThan(0);
    expect(avant.x).toBeCloseTo(attenduAvant.x, 6);
    expect(avant.y).toBeCloseTo(attenduAvant.y, 6);
    expect(battre, 'la boucle de marche est bien abonnée').toBeTruthy();

    // UNE frame de plus, sans React : la caméra s'est déplacée et le sujet a glissé de deux mètres.
    cadrage = { x: 120, y: -80 };
    glissement = { dx: 2, dy: 0, dz: 1 };
    battre!();

    const apres = trousPercage()[0].clone();
    const attenduApres = centreAttendu();
    expect(attenduApres.x, 'le héros a RÉELLEMENT changé de place à l’écran').not.toBeCloseTo(attenduAvant.x, 1);
    expect(apres.x, 'le centre du trou a suivi').toBeCloseTo(attenduApres.x, 6);
    expect(apres.y).toBeCloseTo(attenduApres.y, 6);
    expect(apres.z).toBeCloseTo(attenduApres.z, 6);
    expect(apres.w, 'le rayon ne se referme pas pour un simple battement').toBeGreaterThan(0);
  });

  it('LACET : deux cadres de lacets différents laissent le trou d’accord avec la caméra rendue', async () => {
    const entrees = entreesDe(COIFFÉ); // MÊME référence : la clé de verdict est identique aux deux cadres
    await monter(COIFFÉ, entrees);
    const attenduAvant = centreAttendu();
    // Lacet de 37° : SOUS le quart, donc le cran d'art ne bouge pas (`artRot`) — seule la caméra tourne.
    await rendre(COIFFÉ, entrees, { ...CADRE, dims: { ...DIMS, yawDeg: 37 } });
    const apres = trousPercage()[0].clone();
    const attenduApres = centreAttendu();
    expect(attenduApres.x, 'la rotation déplace RÉELLEMENT le héros à l’écran').not.toBeCloseTo(attenduAvant.x, 1);
    expect(apres.x, 'le centre du trou est celui de la caméra COURANTE').toBeCloseTo(attenduApres.x, 6);
    expect(apres.y).toBeCloseTo(attenduApres.y, 6);
    expect(apres.w).toBeGreaterThan(0);
  });
});

/**
 * LE FONDU DEMANDE SES FRAMES (#1176, M3, correctif). Deux mesures faites sur l'aperçu, scène
 * IMMOBILE, groupe posé sous la Diligence :
 *  - le rendu de l'hôte est ÉVÉNEMENTIEL — 39 dessins à la mise en place, puis plus AUCUN. Le rayon
 *    restait figé à 0,672 px (un pas de 2,1 ms), pour toujours ;
 *  - pendant une rafale de re-rendus, un dessin sur cinq seulement retrouvait le quad du héros (les
 *    quatre autres tombent DANS le commit React qui remonte les boards) : la clé du verdict battait,
 *    la cible retombait à 0, et le rayon oscillait sous 1 px sans jamais monter.
 *
 * Ce banc tient l'horloge et le canal de frames à la main : il sert les rappels d'animation un par un
 * et voit donc exactement combien le fondu en demande, et quand il cesse d'en demander.
 */
describe('Le fondu obtient ses frames en scène IMMOBILE (#1176, M3)', () => {
  let horloge = 0;
  let file: FrameRequestCallback[] = [];
  let nowAvant: (() => number) | null = null;

  /** UNE image d'horloge : 16 ms plus tard, on sert les rappels d'animation en attente. Rend leur
   *  nombre — zéro veut dire que plus personne ne demande de frame. */
  const image = (): number => {
    horloge += 16;
    const dus = file;
    file = [];
    for (const cb of dus) cb(horloge);
    return dus.length;
  };

  beforeEach(() => {
    horloge = 0;
    file = [];
    nowAvant = performance.now.bind(performance);
    performance.now = () => horloge;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { file.push(cb); return file.length; });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
  });

  afterEach(() => {
    if (nowAvant) performance.now = nowAvant;
    vi.unstubAllGlobals();
    simulerRasterisation(); // `unstubAllGlobals` emporte aussi le stub d'`Image` du banc
  });

  it('héros COIFFÉ, personne ne bouge : le rayon ATTEINT sa cible, et en ~PERCAGE_FONDU_MS', async () => {
    await monter(COIFFÉ, entreesDe(COIFFÉ));
    expect(trousPercage()[0].w, 'le fondu n’est pas fini au montage').toBeLessThan(PERCAGE_RAYON_PX);
    const t0 = horloge;
    let images = 0;
    while (trousPercage()[0].w < PERCAGE_RAYON_PX && images < 200) { image(); images++; }
    expect(trousPercage()[0].w, 'rayon atteint sans qu’aucun rendu React ni aucune marche ne survienne').toBe(PERCAGE_RAYON_PX);
    // Le fondu est une DURÉE, pas un compte d'images : la pompe n'a fait que les fournir.
    expect(horloge - t0, 'durée du fondu').toBeGreaterThanOrEqual(PERCAGE_FONDU_MS);
    expect(horloge - t0).toBeLessThanOrEqual(PERCAGE_FONDU_MS + 32);
  });

  it('une fois convergé, la pompe s’ÉTEINT : plus une seule frame n’est demandée', async () => {
    await monter(COIFFÉ, entreesDe(COIFFÉ));
    let images = 0;
    while (trousPercage()[0].w < PERCAGE_RAYON_PX && images < 200) { image(); images++; }
    expect(trousPercage()[0].w).toBe(PERCAGE_RAYON_PX);
    // La dernière image servie est celle qui a convergé : elle n'en a pas redemandé.
    expect(image(), 'rappels d’animation en attente après convergence').toBe(0);
    expect(image(), 'et toujours aucun à l’image suivante').toBe(0);
    expect(trousPercage()[0].w, 'le trou reste ouvert').toBe(PERCAGE_RAYON_PX);
  });

  it('RAFALE de re-rendus : le rayon monte quand même, malgré les dessins sans quad', async () => {
    const entrees = entreesDe(COIFFÉ);
    await monter(COIFFÉ, entrees);
    const rafale: number[] = [];
    for (let i = 0; i < 12; i++) {
      horloge += 110; // la cadence mesurée sur l'aperçu : 12 re-rendus espacés de 110 ms
      await rendre(COIFFÉ, entrees, CADRE, 720 + i * 0.001); // ce qui remonte les boards, comme l'aperçu
      rafale.push(trousPercage()[0].w);
    }
    expect(rafale.some((w) => w > 1), `le rayon n’a jamais dépassé 1 px : ${JSON.stringify(rafale)}`).toBe(true);
    expect(rafale[rafale.length - 1], 'rayon au bout de la rafale').toBe(PERCAGE_RAYON_PX);
  });
});

/**
 * LA CHAÎNE ENTIÈRE — l'hôte de plateau FOURNIT bien ses nappes et ses capsules. Les contrats
 * ci-dessus montent l'écran volumique seul, avec des entrées écrites à la main : ils resteraient verts
 * si `IsoStage` ne passait plus rien. Celui-ci monte le stage RÉEL sur la même carte.
 */
describe('L’hôte de plateau alimente la découpe (#1176, M3)', () => {
  it('groupe posé sous une masse : le trou s’ouvre sans qu’aucune entrée ne soit écrite à la main', async () => {
    scènes = [];
    useGame.setState({
      scene: SCENE,
      mode: 'exploration',
      partyPos: { x: COIFFÉ.x, y: COIFFÉ.y },
      party: [combattant('h1', COIFFÉ)],
      battle: null,
      dialogue: null,
      flags: {},
    });
    hôte = document.createElement('div');
    document.body.appendChild(hôte);
    root = createRoot(hôte);
    await act(async () => { root!.render(<IsoStage />); });
    expect(trousPercage()[0].w, 'rayon du trou du groupe coiffé, chaîne IsoStage entière').toBeGreaterThan(0);
  });
});
