// @vitest-environment jsdom
import { Profiler, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { heightAt, sceneMetresPerTile, type Scene } from '../../state/scene';
import type { Combatant } from '../../engine/types';
import { occludesActor, type Dims } from '../../geometry/iso';
import { diligenceCampaign, paquetDuJeu } from '../../scenes/campaign';
import { buildRoofs, massFootprintCells } from '../builders/roofs';
import { effectiveArchitecture } from '../../state/sceneEdit';
import { chebyshev } from '../../engine/grid';
import type { RoofEl, SceneEl } from '../builders/types';
import { elOccluder } from './occluders';
import { actorCapsuleOf } from './actorCapsule';
import * as sceneMeshes from '../backends/webgl/sceneMeshes';
import type { ActorPose } from '../backends/webgl/sceneMeshes';
import {
  GameStage3D,
  setStageRendererFactory,
  type PercageEntrees,
  type StageFrame,
  type StageWalkAnim,
} from './GameStage3D';
import { BancRenderer, attendreQuads, brancherArdoise, brancherImagesPilotees, caméras, respirer as respirerBanc, scènes, simulerRasterisation, viderCaptures } from './banc-volumique';
import { PERCAGE_DEFINE, PERCAGE_FONDU_MS, PERCAGE_RAYON_PX, percerMateriau, trousPercage } from '../backends/webgl/percageLocal';
import { centrePercage, clePercage, verdictPercage } from './percage';
import { sourcesDeFrames } from './stageFrames';
import { frameRectOf } from './boardPose';
import { resetBakeQueue } from '../backends/webgl/atlasBake';
import { MondeDeCampagne } from './MondeDeCampagne';
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
const SCENE = paquetDuJeu(diligenceCampaign).scenes[0];
const DIMS: Dims = { ...SCENE.dimensions, rot: 0, view: 'iso' };
const CADRE: StageFrame = { mode: 'plateau', dims: DIMS, cam: { x: 0, y: 0 }, zoom: 1 };
/** LA MÊME carte, sous l'averse : le semis d'intempéries est un motif CONTINU (`useBattementContinu`),
 *  donc une SECONDE source du battement, vivante en même temps que le fondu. */
const SCENE_PLUIE: Scene = { ...SCENE, weather: 'pluie', ambiance: 'exterieur' };

/** Le montage du stage, mot pour mot (`MondeDeCampagne`) : une nappe par masse de toit, projetée. */
const LIDS = buildRoofs(SCENE).map((el) => ({
  sectionId: el.sectionId ?? el.key, z: el.cell.z, cells: el.cells, occluder: elOccluder(el, DIMS),
}));

/**
 * LES TROIS POSTES SE DÉRIVENT DU PLAN, comme au banc du verdict (`percage.test.ts`) — aucune
 * coordonnée de la carte n'est recopiée, déplacer un bâtiment les déplace :
 *  · COIFFÉ — la case la plus PROFONDE (anneau de Chebyshev du premier voisin hors emprise) parmi
 *    celles que le verdict coiffe, dans la plus grande masse qui en porte ;
 *  · DÉCOUVERT — la case que la plus proche des masses laisse le plus loin ;
 *  · SOUS_LES_NAPPES — une case HORS de toute emprise que des nappes recouvrent pourtant : le cas
 *    « cachée sans être abritée », c'est-à-dire la définition même du contrat de `keepEl` ci-dessous.
 */
type Case = { x: number; y: number };
const cle = (p: Case) => `${p.x},${p.y}`;
const EMPRISES = effectiveArchitecture(SCENE)
  .flatMap((corps) => corps.masses.map((masse) => [...massFootprintCells(masse.footprint)].map((c) => { const [x, y] = c.split(',').map(Number); return { x, y }; })))
  .sort((a, b) => b.length - a.length || a[0].y - b[0].y || a[0].x - b[0].x);
const SOUS_MASSE = EMPRISES.flat();
const DANS_MASSE = new Set(SOUS_MASSE.map(cle));
const ECART = (p: Case) => Math.min(...SOUS_MASSE.map((m) => chebyshev(m, p)));
function profondeur(p: Case, dans: Set<string>): number {
  for (let k = 1; ; k++)
    for (let dy = -k; dy <= k; dy++)
      for (let dx = -k; dx <= k; dx++)
      { const voisin = { x: p.x + dx, y: p.y + dy }; if (chebyshev(p, voisin) === k && !dans.has(cle(voisin))) return k; }
}
const estCoiffé = (p: Case) => verdictPercage(LIDS, [{
  capsule: actorCapsuleOf({ x: p.x, y: p.y, h: heightAt(SCENE, p.x, p.y, 0) }, DIMS), z: 0,
  monde: new THREE.Vector3(p.x, heightAt(SCENE, p.x, p.y, 0), p.y),
}])[0];
const COIFFÉ = EMPRISES.flatMap((cells) => {
  const dans = new Set(cells.map(cle));
  const coiffees = cells.filter(estCoiffé);
  return coiffees.length
    ? [coiffees.reduce((m, p) => (profondeur(p, dans) - profondeur(m, dans) || m.y - p.y || m.x - p.x) > 0 ? p : m)]
    : [];
})[0];
if (!COIFFÉ) throw new Error('perçage (hôte) : aucune masse de la carte ne porte de case coiffée — le banc n’a plus de sujet');
const NUES = [...Array(SCENE.dimensions.h).keys()]
  .flatMap((y) => [...Array(SCENE.dimensions.w).keys()].map((x) => ({ x, y })))
  .filter((p) => !DANS_MASSE.has(cle(p)));
const DÉCOUVERT = NUES.reduce((loin, p) => (ECART(p) > ECART(loin) ? p : loin));
/** Les nappes qui recouvrent RÉELLEMENT la capsule d'un héros posté là — la géométrie du stage. */
const cacheursDe = (pos: Case) => {
  const capsule = actorCapsuleOf({ x: pos.x, y: pos.y, h: heightAt(SCENE, pos.x, pos.y, 0) }, DIMS);
  return LIDS.filter((lid) => lid.z >= 0 && occludesActor(lid.occluder, capsule));
};
const SOUS_LES_NAPPES = NUES.reduce((mieux, p) => (cacheursDe(p).length > cacheursDe(mieux).length ? p : mieux));

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

/** Les entrées que l'hôte de plateau fournit (`MondeDeCampagne`) pour ce héros-là. */
function entreesDe(pos: { x: number; y: number }): PercageEntrees {
  return {
    cle: clePercage({ tuiles: [{ id: 'h1', x: pos.x, y: pos.y, z: 0 }], rot: 0, view: 'iso', activeZ: 0 }),
    lids: LIDS,
    heros: [{ cid: 'h1', capsule: actorCapsuleOf({ x: pos.x, y: pos.y, h: heightAt(SCENE, pos.x, pos.y, 0) }, DIMS), z: 0 }],
  };
}

let root: Root | null = null;
let hôte: HTMLDivElement | null = null;

brancherArdoise();

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

/** Les commits React de l'écran monté par `rendre` — comptés par un `<Profiler>` posé AUTOUR de lui
 *  (même sonde que `walk-frame-loop.test.tsx`). Il ne voit que le SOUS-ARBRE profilé. */
let commitsReact = 0;

/** Rend (ou re-rend) l'écran volumique sous le cadre donné, sur la racine courante. */
async function rendre(pos: { x: number; y: number }, percage: PercageEntrees | null, cadre: StageFrame, heure = 720, scene = SCENE): Promise<void> {
  await act(async () => {
    root!.render(
      <Profiler id="stage" onRender={() => { commitsReact += 1; }}>
      <GameStage3D
        scene={scene}
        mpt={sceneMetresPerTile(scene)}
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
      />
      </Profiler>,
    );
  });
}

/** La file CADENCÉE du cuiseur servie en battant la boucle d'image de CE banc : depuis #1372 les
 *  textures du MONTAGE y passent aussi, donc aucun quad n'entre en scène dans le rendu qui l'a demandé. */
const respirer = (ms: number): Promise<void> => respirerBanc(ms, () => battre?.());

async function monter(pos: { x: number; y: number }, percage: PercageEntrees | null, scene = SCENE): Promise<void> {
  viderCaptures();
  commitsReact = 0;
  glissement = null;
  cadrage = { x: 0, y: 0 };
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  await rendre(pos, percage, CADRE, 720, scene);
  // Le quad du héros passe par la file CADENCÉE, où il partage la tranche avec les gabarits du monde
  // cuit depuis #1399 (colombages et périodes, mis en file par le montage du groupe monde) : la fenêtre
  // de montage se ferme sur le QUAD, jamais sur un budget de mur.
  await attendreQuads(1);
  await respirer(120);
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
  const camera = caméras[caméras.length - 1];
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
});

afterAll(() => setStageRendererFactory(null));

// Les quatre trous sont des uniformes PARTAGÉS par le module : un banc les remet à zéro, sans quoi le
// rayon laissé ouvert par le montage précédent se lirait comme celui du montage courant.
beforeEach(() => {
  for (const t of trousPercage()) t.set(0, 0, 0, 0);
  simulerRasterisation();
});

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
  it('héros COIFFÉ (cœur de masse) : son trou a un rayon, et sa profondeur écran est celle d’un point vu', async () => {
    await monter(COIFFÉ, entreesDe(COIFFÉ));
    const trous = trousPercage();
    expect(trous[0].w, 'rayon du trou du héros coiffé').toBeGreaterThan(0);
    expect(trous[0].z, 'profondeur écran du héros, dans [0,1]').toBeGreaterThan(0);
    expect(trous[0].z).toBeLessThan(1);
    expect(trous[1].w, 'aucun second héros : son emplacement reste éteint').toBe(0);
  });

  it('TÉMOIN — héros à DÉCOUVERT (le plus loin de toute masse) : aucun trou ne s’ouvre', async () => {
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
 * marche. La reprojection appartient au PILOTE (`Percage.avancer`, `stage/percage.ts`), qui tient les
 * positions monde par référence ; l'hôte ne fait que lui donner la caméra de la frame.
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
 * Ce banc tient l'horloge et le canal de frames à la main : il sert les rappels d'animation un par un,
 * et lit au battement unique (`sourcesDeFrames`) qui tient encore des images — le fondu y est une
 * SOURCE parmi les motifs de la scène (#1394), jamais une boucle à lui.
 */
describe('Le fondu obtient ses frames en scène IMMOBILE (#1176, M3)', () => {
  /** L'horloge du banc et sa file de rAF — le collecteur UNIQUE des bancs d'images du stage : ce banc
   *  sert les rappels d'animation image par image, et `battre` rend leur nombre (zéro = plus personne
   *  ne demande de frame). */
  const cadence = brancherImagesPilotees();

  beforeEach(() => {
    resetBakeQueue();
  });

  it('héros COIFFÉ, personne ne bouge : le rayon ATTEINT sa cible, et en ~PERCAGE_FONDU_MS', async () => {
    await monter(COIFFÉ, entreesDe(COIFFÉ));
    expect(trousPercage()[0].w, 'le fondu n’est pas fini au montage').toBeLessThan(PERCAGE_RAYON_PX);
    const t0 = cadence.maintenant();
    let images = 0;
    while (trousPercage()[0].w < PERCAGE_RAYON_PX && images < 200) { cadence.battre(); images++; }
    expect(trousPercage()[0].w, 'rayon atteint sans qu’aucun rendu React ni aucune marche ne survienne').toBe(PERCAGE_RAYON_PX);
    // Le fondu est une DURÉE, pas un compte d'images : le battement n'a fait que les fournir.
    expect(cadence.maintenant() - t0, 'durée du fondu').toBeGreaterThanOrEqual(PERCAGE_FONDU_MS);
    expect(cadence.maintenant() - t0).toBeLessThanOrEqual(PERCAGE_FONDU_MS + 32);
  });

  it('une fois convergé, le fondu RELÂCHE ses images : sa source quitte le battement', async () => {
    await monter(COIFFÉ, entreesDe(COIFFÉ));
    let images = 0;
    // EN PLEIN FONDU : le fondu tient SA source du battement, en plus de ce que la scène tient déjà
    // (un corps animé est un motif continu — #1396 —, et il en tient une).
    const sourcesPendant = sourcesDeFrames();
    expect(sourcesPendant, 'prémisse : le fondu ne tient aucune source du battement').toBeGreaterThan(0);
    expect(cadence.battre(), 'prémisse : aucune image servie, la mesure serait vraie du vide').toBeGreaterThan(0);
    images++;
    while (trousPercage()[0].w < PERCAGE_RAYON_PX && images < 200) { cadence.battre(); images++; }
    expect(trousPercage()[0].w).toBe(PERCAGE_RAYON_PX);
    // Le fondu a RELÂCHÉ ses images. Ce qui reste est le motif de la scène — un corps animé en est un
    // (#1396 : sa planche se choisit par image) —, et la boucle unique n'arme qu'UN rappel pour toutes
    // les sources : c'est donc le compte de SOURCES qui dit qui demande encore, jamais le compte de
    // rappels.
    expect(sourcesDeFrames(), 'le fondu convergé tient encore ses images').toBe(sourcesPendant - 1);
    expect(sourcesDeFrames(), 'et sa source ne revient pas à l’image suivante').toBe(sourcesPendant - 1);
    expect(trousPercage()[0].w, 'le trou reste ouvert').toBe(PERCAGE_RAYON_PX);
  });

  /**
   * UN SEUL BATTEMENT POUR LE FONDU ET POUR L'AVERSE (#1394). Le fondu n'a plus d'horloge à lui : il
   * TIENT une source du battement unique (`stage/stageFrames`) tant qu'un rayon court après sa cible,
   * et son pas de temps se prend à l'horodatage de l'image. Deux motifs vivants sur le même écran ne
   * coûtent donc qu'UN rappel d'image — et le fondu converge quand même, puis rend ses images.
   */
  it('fondu + averse : UN rAF par image, le fondu CONVERGE puis rend sa source', async () => {
    await monter(COIFFÉ, entreesDe(COIFFÉ), SCENE_PLUIE);
    const canevas = hôte!.querySelector('canvas.iso-stage') as HTMLCanvasElement;
    expect(Number(canevas.dataset.precip), 'prémisse : il ne pleut pas, le second motif serait éteint').toBeGreaterThan(0);
    expect(trousPercage()[0].w, 'prémisse : le fondu est déjà fini au montage').toBeLessThan(PERCAGE_RAYON_PX);
    const sourcesPendant = sourcesDeFrames();
    expect(sourcesPendant, 'prémisse : moins de deux motifs tiennent le battement').toBeGreaterThanOrEqual(2);

    let images = 0;
    let servisMax = 0;
    while (trousPercage()[0].w < PERCAGE_RAYON_PX && images < 200) {
      servisMax = Math.max(servisMax, cadence.battre());
      images++;
    }
    expect(trousPercage()[0].w, 'le fondu n’a pas convergé sous l’averse').toBe(PERCAGE_RAYON_PX);
    expect(servisMax, `${servisMax} rappels d’image servis dans une même image : deux horloges tournent`).toBe(1);
    expect(sourcesDeFrames(), 'le fondu convergé tient encore ses images').toBe(sourcesPendant - 1);
    expect(cadence.battre(), 'l’averse, elle, demande toujours son image').toBe(1);
  });

  it('RAFALE de re-rendus : le rayon monte quand même, malgré les dessins sans quad', async () => {
    const entrees = entreesDe(COIFFÉ);
    await monter(COIFFÉ, entrees);
    const rafale: number[] = [];
    for (let i = 0; i < 12; i++) {
      cadence.avancer(110); // la cadence mesurée sur l'aperçu : 12 re-rendus espacés de 110 ms
      await rendre(COIFFÉ, entrees, CADRE, 720 + i * 0.001); // ce qui remonte les boards, comme l'aperçu
      rafale.push(trousPercage()[0].w);
    }
    expect(rafale.some((w) => w > 1), `le rayon n’a jamais dépassé 1 px : ${JSON.stringify(rafale)}`).toBe(true);
    expect(rafale[rafale.length - 1], 'rayon au bout de la rafale').toBe(PERCAGE_RAYON_PX);
  });

  /**
   * P2 — L'HORLOGE D'IMAGES NE PILOTE JAMAIS REACT (#1401). Le fondu vit sur le battement unique du
   * stage (`stage/stageFrames`, #1394) : ce que ses images appellent est la passe de DESSIN de l'hôte
   * (`stage/GameStage3D.tsx`, l'abonné qui rejoue `dessinerRef.current()`), impérative. Un fondu est
   * donc un motif SANS aucun événement discret, et sa borne de commits est ZÉRO.
   *
   * CE QUE LA SONDE MESURE : les commits du SOUS-ARBRE PROFILÉ par `rendre`. ANGLE MORT : un commit
   * d'un parent de l'écran ne s'y verrait pas ; hors de ce banc, l'hôte de plateau reste soumis au
   * lacet (#1403).
   */
  it('P2 — fondu tenu sur 30 images : il PEINT et n’engendre aucun commit React', async () => {
    await monter(COIFFÉ, entreesDe(COIFFÉ));
    const rayonAvant = trousPercage()[0].w;
    expect(rayonAvant, 'le fondu n’est pas fini au montage : sans lui, « aucun commit » serait vrai du vide').toBeLessThan(PERCAGE_RAYON_PX);
    // Le compteur MORD : le montage, lui, a commis.
    expect(commitsReact, 'aucun commit compté au montage : la sonde de commits est débranchée').toBeGreaterThan(0);

    const IMAGES = 30;
    const PAS_MS = 8; // 30 × 8 ms < PERCAGE_FONDU_MS : le fondu est encore EN VOL à la dernière image
    const commitsAvant = commitsReact;
    let servies = 0;
    for (let i = 0; i < IMAGES; i++) if (cadence.battre(PAS_MS) > 0) servies++;

    expect(servies, `${servies} images servies sur ${IMAGES} : le fondu a lâché ses images en route`).toBe(IMAGES);
    expect(trousPercage()[0].w, 'le rayon n’a pas avancé : rien n’a été peint').toBeGreaterThan(rayonAvant);
    expect(trousPercage()[0].w, 'le fondu a convergé avant la fin : les images mesurées ne sont plus les siennes').toBeLessThan(PERCAGE_RAYON_PX);
    expect(
      commitsReact - commitsAvant,
      `${commitsReact - commitsAvant} commits React pour ${IMAGES} images de fondu — aucun événement discret, la borne est 0`,
    ).toBe(0);
  });
});

/**
 * LA CHAÎNE ENTIÈRE — l'hôte de plateau FOURNIT bien ses nappes et ses capsules. Les contrats
 * ci-dessus montent l'écran volumique seul, avec des entrées écrites à la main : ils resteraient verts
 * si `MondeDeCampagne` ne passait plus rien. Celui-ci monte le stage RÉEL sur la même carte.
 */
describe('L’hôte de plateau alimente la découpe (#1176, M3)', () => {
  it('groupe posé sous une masse : le trou s’ouvre sans qu’aucune entrée ne soit écrite à la main', async () => {
    viderCaptures();
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
    await act(async () => { root!.render(<MondeDeCampagne />); });
    // Le quad du héros entre en scène par la FILE cadencée (#1372), qu'il partage avec les gabarits du
    // monde cuit (#1399) : le trou n'a rien à percer avant, et la fenêtre se ferme sur le QUAD.
    await attendreQuads(1);
    await respirer(150);
    expect(trousPercage()[0].w, 'rayon du trou du groupe coiffé, chaîne MondeDeCampagne entière').toBeGreaterThan(0);
  });
});

/**
 * L'OCCLUSION D'ÉCRAN NE RETIRE RIEN — AU MONTAGE (#1176, M3). La loi elle-même se mesure sur ses
 * fonctions pures (`stage/architectureVisibility.test.ts`, balayage de la cour) ; ici c'est le
 * CÂBLAGE de l'hôte qui est en jeu : ce que `MondeDeCampagne` remet réellement au renderer par son `keepEl`.
 * Une levée d'écran rebranchée dans l'hôte seul laisserait la loi verte et l'écran troué.
 *
 * Le poste est `SOUS_LES_NAPPES`, DÉRIVÉ du plan : hors de toute emprise (rien ne l'abrite) et
 * pourtant recouvert par des nappes — la prémisse se re-mesure DANS le contrat.
 */
describe('L’hôte de plateau garde les nappes qui CACHENT sans abriter (#1176, M3)', () => {
  const COUR = SOUS_LES_NAPPES;

  it('groupe hors de toute emprise mais SOUS des nappes : celles qui le cachent sont REMISES au renderer, toutes', async () => {
    const cachées = new Set(cacheursDe(COUR).map((lid) => lid.sectionId));
    expect(cachées.size, 'des nappes recouvrent bien la capsule du héros à ce poste').toBeGreaterThan(0);

    // Ce que l'hôte remet au monde cuit : le masque de dégagement est LE point de passage
    // (`applyCutawayMask`) — on l'observe passe par passe et on le laisse s'appliquer pour de bon.
    // La passe qui compte est la DERNIÈRE : l'exploration s'accumule au premier rendu (#950 — une
    // section jamais vue n'est pas peinte), et c'est l'image POSÉE que l'écran garde.
    const passes: { remis: SceneEl[]; écartés: SceneEl[] }[] = [];
    const vrai = sceneMeshes.applyCutawayMask;
    const espion = vi.spyOn(sceneMeshes, 'applyCutawayMask').mockImplementation((baked, keepEl) => {
      const passe = { remis: [] as SceneEl[], écartés: [] as SceneEl[] };
      for (const span of baked.spans) (keepEl(span.el) ? passe.remis : passe.écartés).push(span.el);
      passes.push(passe);
      return vrai(baked, keepEl);
    });
    try {
      useGame.setState({
        scene: SCENE,
        mode: 'exploration',
        partyPos: { x: COUR.x, y: COUR.y },
        party: [combattant('h1', COUR)],
        battle: null,
        dialogue: null,
        flags: {},
      });
      hôte = document.createElement('div');
      document.body.appendChild(hôte);
      root = createRoot(hôte);
      await act(async () => { root!.render(<MondeDeCampagne />); });

      expect(passes.length, 'le masque de dégagement a bien tourné').toBeGreaterThan(0);
      const posée = passes[passes.length - 1];
      const nappeDeCacheur = (el: SceneEl): el is RoofEl => el.kind === 'roof' && cachées.has(el.sectionId ?? el.key);
      const sections = new Set(posée.remis.filter(nappeDeCacheur).map((el) => el.sectionId ?? el.key));
      expect(sections, 'chaque section qui cache le héros est remise au renderer').toEqual(cachées);
      expect(posée.écartés.filter(nappeDeCacheur).map((el) => el.key), 'aucune nappe cacheuse écartée').toEqual([]);
    } finally {
      espion.mockRestore();
    }
  });
});
