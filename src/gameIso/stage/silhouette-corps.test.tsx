// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import type { Combatant } from '../../engine/types';
import type { Dims } from '../../geometry/iso';
import { GameStage3D, setStageRendererFactory, type StageFrame, type StageWalkAnim } from './GameStage3D';
import { BancRenderer, PLAFOND_ATTENTE_MS, attendreQuads, brancherArdoise, quads, scènes, simulerRasterisation, viderCaptures } from './banc-volumique';
import { RENDER_ORDER } from '../backends/webgl/renderRanks';
import {
  ALPHA_TEST,
  GHOST_OPACITY,
  SILHOUETTE_BODY_OPACITY,
  attachBodySilhouette,
  billboardMaterial,
  boardChromeOpacity,
  silhouetteMaterial,
  type Board,
  type BoardChrome,
} from './boardPose';
import { teamRingDecor } from '../builders/dynamicMarks';
import { ENEMY_RING, HERO_RING } from '../teamColors';
import { actorBillboards, actorPoses, type ActorPose, type BillboardSubject } from '../backends/webgl/sceneMeshes';
import { buildTokens } from '../builders/tokens';
import type { BattleState } from '../../state/store';

/**
 * SILHOUETTE DU CORPS À TRAVERS LES MURS (#1297, LOT C) — le pendant, pour le corps, du jumeau
 * d'anneau du LOT A. Ce banc mesure les quatre faits dont dépend la lisibilité d'un jeton occulté par
 * la matière du monde : l'ÉTAT DE PROFONDEUR (test retourné, rendu avant les corps), le PARTAGE (même
 * géométrie, même uniforme d'allure — donc aucune écriture de plus par frame), la TEINTE D'ÉQUIPE, et
 * la présence du jumeau sous les DEUX regards du cadre (plateau et première personne).
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Budget de test calé AU-DESSUS du plafond d'attente du harnais (`PLAFOND_ATTENTE_MS`) : sous un
 *  budget plus court, un montage qui ne pose aucun corps meurt sur le chronomètre de Vitest, et le
 *  banc accuse une lenteur là où sa PRÉMISSE a la réponse. */
vi.setConfig({ testTimeout: PLAFOND_ATTENTE_MS + 10_000 });

const TAILLE = { w: 800, h: 600 };
const SCENE: Scene = emptyScene(10, 10);
const DIMS: Dims = { w: SCENE.dimensions.w, h: SCENE.dimensions.h, rot: 0, view: 'iso' };
const AFFINE: StageFrame = { mode: 'plateau', dims: DIMS, cam: { x: 0, y: 0 }, zoom: 1 };
const POV: StageFrame = { mode: 'pov', partyPos: { x: 2, y: 2, z: 0 }, facing: 'S', indoor: false, cid: 'h1' };

function combattant(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, extra: Partial<Combatant> = {}): Combatant {
  return {
    id, label: id, kind, pos, size: 'moyenne', species: 'humains-reiklander',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: { 'capacite-de-combat': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
    ...extra,
  } as unknown as Combatant;
}

/** Les deux acteurs du banc : un héros (premier ordinal d'anneau) et un ennemi. */
const ACTEURS: ActorPose[] = [
  { c: combattant('h1', 'hero', { x: 2, y: 2 }), x: 2, y: 2, z: 0, heroIndex: 0 },
  { c: combattant('e1', 'enemy', { x: 5, y: 2 }), x: 5, y: 2, z: 0 },
];

let root: Root | null = null;
let hôte: HTMLDivElement | null = null;
let glissement: { dx: number; dy: number; dz: number } | null = null;
let battre: (() => void) | null = null;
let allures: Record<string, BoardChrome> = {};

brancherArdoise();

const anim: StageWalkAnim = {
  subscribe: (onFrame) => { battre = onFrame; return () => { battre = null; }; },
  glide: (cid) => (cid === 'h1' ? glissement : null),
  cam: () => ({ x: 0, y: 0 }),
};

/** Monte l'écran volumique sous le cadre donné et attend que les CORPS soient en scène — prémisse de
 *  tout ce que ce banc mesure, jamais une assertion (l'appelant affirme lui-même ce qu'il en attend).
 *
 *  Le compte porte sur les CORPS, pas sur les jumeaux : `quads()` écarte la géométrie EMPRUNTÉE, dont
 *  la silhouette. Le banc attend donc que les quads soient montés, puis affirme que chacun porte son
 *  jumeau — un câblage de silhouette débranché fait toujours rougir l'assertion, jamais l'attente. */
async function monter(frame: StageFrame): Promise<void> {
  viderCaptures();
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  await act(async () => {
    root!.render(
      <GameStage3D lecture="jeu"
        scene={SCENE}
        mpt={sceneMetresPerTile(SCENE)}
        frame={frame}
        tintAt={() => 1}
        keepEl={() => true}
        els={{ tokens: [], props: [] }}
        actors={ACTEURS}
        gameTime={720}
        lightLevel={null}
        lights={[]}
        chromeAt={(cid) => allures[cid] ?? null}
        anim={anim}
      />,
    );
  });
  await attendreQuads(ACTEURS.length, PLAFOND_ATTENTE_MS, () => battre?.());
  expect(quads(), `PRÉMISSE : les ${ACTEURS.length} corps doivent être en scène — sans eux, rien de ce que ce banc affirme ensuite n'est mesuré`)
    .toHaveLength(ACTEURS.length);
}

/** Le quad d'un combattant et son jumeau de silhouette, tels que la scène rendue les porte. */
function jeton(cid: string): { corps: THREE.Mesh; jumeau: THREE.Mesh } {
  const scene = scènes[scènes.length - 1];
  if (!scene) throw new Error('aucune frame dessinée');
  let jumeau: THREE.Mesh | null = null;
  scene.traverse((o) => { if (o.name === `silhouette:${cid}`) jumeau = o as THREE.Mesh; });
  if (!jumeau) throw new Error(`le corps de ${cid} est en scène sans son jumeau : le câblage de silhouette est débranché`);
  return { corps: (jumeau as THREE.Mesh).parent as THREE.Mesh, jumeau };
}

/** Tous les jumeaux de silhouette de la dernière frame. */
function jumeaux(): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  scènes[scènes.length - 1]?.traverse((o) => { if (o.name.startsWith('silhouette:')) out.push(o as THREE.Mesh); });
  return out;
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

beforeEach(() => { simulerRasterisation(); });
afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
  glissement = null;
  battre = null;
  allures = {};
});

describe('Corps à travers les murs — le jumeau MONTÉ sur le quad (#1297 LOT C)', () => {
  it('chaque corps de combattant porte SON jumeau, à test de profondeur RETOURNÉ et rendu AVANT les corps', { timeout: 30_000 }, async () => {
    await monter(AFFINE);
    expect(jumeaux(), 'un jumeau par acteur, et pas un de plus').toHaveLength(ACTEURS.length);
    const { corps, jumeau } = jeton('h1');
    const mat = jumeau.material as THREE.MeshBasicMaterial;
    const matCorps = corps.material as THREE.MeshBasicMaterial;
    expect(mat.depthFunc, 'sans GreaterDepth le jumeau repeint ce qui est DÉJÀ visible').toBe(THREE.GreaterDepth);
    expect(mat.depthWrite).toBe(false);
    expect(jumeau.renderOrder, 'AVANT les corps : rendu après, il peindrait par-dessus des corps VISIBLES').toBe(RENDER_ORDER.jumeau);
    expect(RENDER_ORDER.jumeau, 'le rang vient du registre, jamais d’un littéral au site').toBeLessThan(RENDER_ORDER.pions);
    expect(mat.transparent).toBe(true);
    expect(mat.alphaTest, 'la découpe suit le texel BRUT du rig, comme le corps').toBe(ALPHA_TEST);
    expect(mat.map, 'même texture de rig que le corps qu’il double').toBe(matCorps.map);
    expect(mat.fog, 'la silhouette s’embrume comme le corps : ce n’est pas du chrome d’interface').toBe(matCorps.fog);
    expect(mat.fog).toBe(true);
    expect(mat.polygonOffset, 'aucun biais de profondeur : c’est le test retourné qui décide').toBe(false);
    // Banc volumique mesuré à 15,3 s sur runner 4 cœurs à 96 % de mémoire ([diag] #1619) — borne de banc.
  });

  it('la GÉOMÉTRIE est celle du corps, et la pose se transmet par la parenté — aucune écriture de plus', async () => {
    await monter(AFFINE);
    const { corps, jumeau } = jeton('h1');
    expect(jumeau.geometry, 'géométrie EMPRUNTÉE : jamais une seconde copie du quad').toBe(corps.geometry);
    expect(jumeau.userData.emprunte, 'sans ce drapeau le démontage libérerait deux fois la même géométrie').toBe(true);
    expect(jumeau.parent).toBe(corps);

    const avant = corps.getWorldPosition(new THREE.Vector3());
    glissement = { dx: 3, dy: 0, dz: 1.5 };
    act(() => battre!());
    const après = corps.getWorldPosition(new THREE.Vector3());
    expect(après.distanceTo(avant), 'le témoin doit VRAIMENT avoir glissé').toBeGreaterThan(1);
    // …et le jumeau a suivi sans qu'on lui écrive quoi que ce soit : sa transformation LOCALE est
    // restée l'identité, c'est celle de son parent qui l'emmène.
    expect(jumeau.position.toArray()).toEqual([0, 0, 0]);
    expect(jumeau.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    corps.updateMatrixWorld(true);
    expect(jumeau.getWorldPosition(new THREE.Vector3()).toArray()).toEqual(après.toArray());
    expect(jumeau.matrixWorld.elements).toEqual(corps.matrixWorld.elements);
  });

  it('la TEINTE est la couleur d’ÉQUIPE du jeton — la même dérivation que son anneau aux pieds', async () => {
    await monter(AFFINE);
    const teinte = (cid: string) => (jeton(cid).jumeau.material as THREE.MeshBasicMaterial).color.getHex();
    expect(teinte('h1')).toBe(new THREE.Color(HERO_RING[0]).getHex());
    expect(teinte('e1')).toBe(new THREE.Color(ENEMY_RING).getHex());
    // …et c'est bien `teamRingDecor` qui tranche, ordinal de héros compris.
    for (const a of ACTEURS)
      expect(teinte(a.c.id), a.c.id).toBe(new THREE.Color(teamRingDecor(a.c, a.heroIndex).color).getHex());
    expect(teinte('h1')).not.toBe(teinte('e1'));
  });

  it('l’ALPHA suit l’allure du corps : un fantôme reste fantôme à travers le mur', async () => {
    allures = { e1: { ghost: true, dim: false, highlight: null } };
    await monter(AFFINE);
    for (const cid of ['h1', 'e1']) {
      const { corps, jumeau } = jeton(cid);
      const uCorps = (corps.material as THREE.Material).userData.allureAlpha as { value: number };
      const uJumeau = (jumeau.material as THREE.Material).userData.allureAlpha as { value: number };
      expect(uJumeau, `${cid} : l’uniforme du corps, pas une copie`).toBe(uCorps);
      expect(uJumeau.value, cid).toBe(boardChromeOpacity(allures[cid] ?? null));
    }
    expect((jeton('e1').jumeau.material as THREE.Material).userData.allureAlpha).not.toBe(
      (jeton('h1').jumeau.material as THREE.Material).userData.allureAlpha,
    );
    expect(((jeton('e1').jumeau.material as THREE.Material).userData.allureAlpha as { value: number }).value).toBe(GHOST_OPACITY);
  });

  it('les DEUX regards du cadre en héritent : le jumeau est monté au quad, pas à une passe de vue', async () => {
    await monter(POV);
    expect(jumeaux().map((j) => j.name).sort()).toEqual(['silhouette:e1', 'silhouette:h1']);
    expect((jeton('h1').jumeau.material as THREE.MeshBasicMaterial).depthFunc).toBe(THREE.GreaterDepth);
  });

  it('démontage : la géométrie empruntée n’est libérée qu’UNE fois, chaque matériau une fois', async () => {
    await monter(AFFINE);
    const { corps, jumeau } = jeton('h1');
    const geo = vi.spyOn(corps.geometry, 'dispose');
    const matCorps = vi.spyOn(corps.material as THREE.Material, 'dispose');
    const matJumeau = vi.spyOn(jumeau.material as THREE.Material, 'dispose');
    act(() => root!.unmount());
    root = null;
    expect(geo, 'géométrie PARTAGÉE : deux libérations seraient un double-free').toHaveBeenCalledTimes(1);
    expect(matCorps).toHaveBeenCalledTimes(1);
    expect(matJumeau, 'le matériau du jumeau lui appartient : il se libère').toHaveBeenCalledTimes(1);
  });
});

describe('Corps à travers les murs — ce que le FRAGMENT porte (#1297 LOT C)', () => {
  /** Un board de sonde, monté comme l'écran le monte (matériau de billboard réel). */
  function board(cid: string): Board {
    const material = billboardMaterial(new THREE.Texture(), 1);
    const sub: BillboardSubject = {
      identity: `sonde:${cid}`, cid, teamColor: HERO_RING[0], kind: 'personnage',
      anchor: new THREE.Vector3(), facing: 'S', scaleK: 1, cell: { x: 0, y: 0, z: 0 }, box: { w: 120, h: 150 }, svg: () => '',
    };
    return {
      sub,
      quad: { widthM: 2, heightM: 3, centerLiftM: 1.5 },
      mesh: new THREE.Mesh(new THREE.PlaneGeometry(2, 3), material),
      material,
    };
  }

  /** Le fragment tel que three le compilerait, avec les uniformes que le matériau y branche. */
  function fragment(mat: THREE.MeshBasicMaterial): { uniforms: Record<string, unknown>; src: string } {
    const shader = {
      uniforms: {} as Record<string, unknown>,
      fragmentShader: 'uniform vec3 diffuse;\nvoid main() {\n#include <map_fragment>\n#include <alphatest_fragment>\n}',
    };
    mat.onBeforeCompile!(shader as never, null as never);
    return { uniforms: shader.uniforms, src: shader.fragmentShader };
  }

  it('APLAT : la teinte d’équipe REMPLACE le texel, dont seul l’alpha survit', () => {
    const b = board('h1');
    const { src } = fragment(silhouetteMaterial(b.material, ENEMY_RING));
    // Le corps de `map_fragment` est EXPANSÉ à l'injection (#1176, L3 : la cellule de flipbook s'y
    // échantillonne) — l'ancre est donc le texel lui-même, plus la directive d'inclusion.
    const map = src.indexOf('diffuseColor *= sampledDiffuseColor;');
    const aplat = src.indexOf('diffuseColor.rgb = diffuse;');
    expect(map).toBeGreaterThanOrEqual(0);
    // Après le texel : `map_fragment` MULTIPLIE, donc l'écraser avant ne servirait à rien.
    expect(aplat).toBeGreaterThan(map);
  });

  it('l’alpha de silhouette se multiplie APRÈS l’alphatest, et vaut la CONSTANTE × l’allure du corps', () => {
    const b = board('h1');
    const mat = silhouetteMaterial(b.material, HERO_RING[0]);
    const { uniforms, src } = fragment(mat);
    expect(uniforms.uAllureAlpha, 'l’uniforme du CORPS, partagé').toBe(b.material.userData.allureAlpha);
    const découpe = src.indexOf('#include <alphatest_fragment>');
    const produit = src.indexOf(`diffuseColor.a *= uAllureAlpha * ${SILHOUETTE_BODY_OPACITY.toFixed(4)};`);
    expect(découpe).toBeGreaterThanOrEqual(0);
    // Avant la découpe, une allure sous le seuil (fantôme à 0,45 pour 0,5) effacerait le sujet ENTIER.
    expect(produit).toBeGreaterThan(découpe);
    expect(SILHOUETTE_BODY_OPACITY.toFixed(4), 'littéral GLSL : un entier nu ne compile pas').toContain('.');
  });

  it('la clé de PROGRAMME est explicite : un fragment injecté, un programme pour tous les jumeaux', () => {
    const a = silhouetteMaterial(board('h1').material, HERO_RING[0]);
    const b = silhouetteMaterial(board('e1').material, ENEMY_RING);
    expect(a.customProgramCacheKey()).toBe(b.customProgramCacheKey());
    expect(a.customProgramCacheKey()).toContain('silhouette');
    expect(a.customProgramCacheKey()).not.toBe(billboardMaterial(new THREE.Texture(), 1).customProgramCacheKey());
  });

  it('un corps monté HORS de l’écran (spike, planche QC) garde une allure PLEINE, jamais un jumeau muet', () => {
    const nu = new THREE.MeshBasicMaterial(); // aucun uniforme d'allure : matériau d'un autre appelant
    const mat = silhouetteMaterial(nu, HERO_RING[0]);
    expect((mat.userData.allureAlpha as { value: number }).value).toBe(1);
  });

  it('le jumeau ne se lance pas au RAYON : le picking suit le corps, jamais son doublon de rendu', () => {
    const b = board('h1');
    const jumeau = attachBodySilhouette(b, HERO_RING[0]);
    const rayon = new THREE.Raycaster();
    // Hors de la DIAGONALE du quad : au centre exact, les deux triangles du `PlaneGeometry` répondent
    // tous les deux et la mesure ne dirait plus rien du jumeau.
    rayon.set(new THREE.Vector3(0.3, 0.3, 5), new THREE.Vector3(0, 0, -1));
    const touches = rayon.intersectObject(b.mesh, true);
    expect(touches, 'le corps répond, et lui seul').toHaveLength(1);
    expect(touches[0].object, 'le corps, jamais son doublon').toBe(b.mesh);
    expect(jumeau.name).toBe('silhouette:h1');
  });
});

describe('Corps à travers les murs — la TEINTE le long de la chaîne RÉELLE (#1297 LOT C)', () => {
  const MPT = sceneMetresPerTile(SCENE);
  const TOUT_VU = () => {
    const v = new Set<string>();
    for (let y = 0; y < SCENE.dimensions.h; y++) for (let x = 0; x < SCENE.dimensions.w; x++) v.add(`${x},${y},0`);
    return v;
  };

  /** `buildTokens → actorPoses → actorBillboards` : la chaîne que l'écran monte VRAIMENT. Les bancs
   *  qui fabriquent leurs `ActorPose` à la main court-circuitent le passage de l'ordinal d'anneau du
   *  builder au billboard — c'est là que la teinte d'équipe se décide. */
  function teintes(combatants: Combatant[]): Record<string, string | undefined> {
    const els = buildTokens(SCENE, TOUT_VU(), { combatants } as unknown as BattleState, { activeZ: 0, viewZ: null, top: false });
    const out: Record<string, string | undefined> = {};
    for (const b of actorBillboards(actorPoses(els, {}), SCENE, MPT)) out[b.cid!] = b.teamColor;
    return out;
  }

  const h1 = () => combattant('h1', 'hero', { x: 0, y: 0 });
  const h2 = () => combattant('h2', 'hero', { x: 1, y: 1 }, { mountId: 'm1' } as Partial<Combatant>);
  const monture = (kind: 'hero' | 'enemy') =>
    combattant('m1', kind, { x: 1, y: 1 }, { riderId: 'h2', creatureId: 'cheval', species: 'cheval', size: 'grande' } as Partial<Combatant>);

  it('à PIED : chaque héros prend SON ordinal d’anneau, l’ennemi le rouge', () => {
    const t = teintes([h1(), combattant('h2', 'hero', { x: 1, y: 1 }), combattant('e1', 'enemy', { x: 5, y: 5 })]);
    expect(t.h1).toBe(HERO_RING[0]);
    expect(t.h2).toBe(HERO_RING[1]);
    expect(t.e1).toBe(ENEMY_RING);
  });

  it('MONTÉ : le couple se peint au CAVALIER — une monture au record ENNEMI ne rougit pas le héros en selle', () => {
    const t = teintes([h1(), h2(), monture('enemy')]);
    // Le billboard du couple porte l'id de la MONTURE (il est à sa case et à son échelle).
    expect(Object.keys(t).sort()).toEqual(['h1', 'm1']);
    expect(t.m1, 'la teinte du couple est celle de h2, pas celle du record de la monture').toBe(HERO_RING[1]);
    expect(t.m1).not.toBe(ENEMY_RING);
  });

  it('MONTÉ : l’ORDINAL est celui que le cavalier a réservé — jamais le premier par défaut', () => {
    const t = teintes([h1(), h2(), monture('hero')]);
    expect(t.m1, 'h2 a réservé l’ordinal 1 sans être dessiné : le couple le porte').toBe(HERO_RING[1]);
    expect(t.m1, 'la couleur de h1 sur le couple de h2 serait une confusion de héros').not.toBe(t.h1);
  });
});
