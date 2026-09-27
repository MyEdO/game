// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import type { Combatant } from '../../engine/types';
import type { Dims } from '../../geometry/iso';
import { GameStage3D, setStageRendererFactory, type StageFrame, type StageWalkAnim } from './GameStage3D';
import { BancRenderer, brancherArdoise, quads, scènes, simulerRasterisation, viderCaptures } from './banc-volumique';
import {
  ALPHA_TEST,
  ATLAS_FRAMES_MAX,
  DPR_PLAFOND,
  FRAME_RECT_PLEIN,
  GROSSISSEMENT_BAS,
  GROSSISSEMENT_HAUT,
  atlasFrames,
  atlasPxHeight,
  attachBodySilhouette,
  billboardDepthMaterial,
  billboardMaterial,
  boardDepthMaterial,
  frameIndexAt,
  frameRectOf,
  palierAtlas,
  silhouetteMaterial,
  writeBoardFrames,
  type AtlasAt,
  type Board,
  type FramePick,
} from './boardPose';
import { ZOOM_MAX, atlasLayout, frameUvRect, rasterPxHeight, type AtlasLayout } from '../backends/webgl/billboardMath';
import { pxPerM } from '../backends/webgl/worldTris';
import * as atlasBake from '../backends/webgl/atlasBake';
import { clearAtlasCache, resetBakeQueue } from '../backends/webgl/atlasBake';
import * as svgTexture from '../backends/webgl/svgTexture';
import { COLLAPSE_MS, planDyingDef, rigIdleDef } from '../rig/anim/actorAnimSelect';
import { HERO_RING } from '../teamColors';
import type { ActorPose, BillboardSubject, SceneBillboardEls } from '../backends/webgl/sceneMeshes';
import type { TokenEl } from '../builders/types';

/**
 * LE BRANCHEMENT DU FLIPBOOK (#1176, L3) — la boucle volumique JOUE les frames.
 *
 * Quatre faits s'y mesurent, et chacun a une panne SILENCIEUSE en face :
 *  - le FRAGMENT échantillonne vraiment la cellule (une ligne ajoutée après l'include laisserait
 *    l'uniforme branché et sans effet) ;
 *  - le JUMEAU de silhouette reçoit la MÊME planche que son corps (il l'a captée à l'attache, et la
 *    passe de pose ne descend jamais dans les enfants d'un quad) ;
 *  - l'écrivain est IDEMPOTENT PAR IMAGE : il compare l'état courant, il ne suit pas des transitions
 *    (les boards se reconstruisent à chaque pas commité) ;
 *  - une image ne RASTERISE RIEN, et ne périme ni texture ni programme.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ————————————————————————————————————————————————————————————————
// Bancs partagés
// ————————————————————————————————————————————————————————————————

/** Le fragment tel que three le compilerait, avec les uniformes que le matériau y branche. */
function fragment(mat: THREE.MeshBasicMaterial): { uniforms: Record<string, unknown>; src: string } {
  const shader = {
    uniforms: {} as Record<string, unknown>,
    fragmentShader: 'uniform vec3 diffuse;\nvoid main() {\n#include <map_fragment>\n#include <alphatest_fragment>\n}',
  };
  mat.onBeforeCompile!(shader as never, null as never);
  return { uniforms: shader.uniforms, src: shader.fragmentShader };
}

/** Un board de sonde, monté comme l'écran le monte : matériau réel, matériau de PROFONDEUR de la
 *  passe d'ombres, jumeau de silhouette attaché. */
function board(cid: string): Board {
  const material = billboardMaterial(new THREE.Texture(), 1);
  const sub: BillboardSubject = {
    identity: `sonde:${cid}`, cid, teamColor: HERO_RING[0], kind: 'personnage',
    anchor: new THREE.Vector3(), facing: 'S', scaleK: 1, cell: { x: 0, y: 0, z: 0 }, box: { w: 120, h: 150 }, svg: () => '',
  };
  const b: Board = {
    sub,
    quad: { widthM: 2, heightM: 3, centerLiftM: 1.5 },
    mesh: new THREE.Mesh(new THREE.PlaneGeometry(2, 3), material),
    material,
  };
  b.mesh.castShadow = true;
  b.mesh.customDepthMaterial = billboardDepthMaterial(material);
  attachBodySilhouette(b, HERO_RING[0]);
  return b;
}

/** Une planche cuite de sonde : `n` cellules de 24×30 px. */
function planche(n: number): { texture: THREE.Texture; layout: AtlasLayout } {
  return { texture: new THREE.Texture(), layout: atlasLayout(24, 30, n) };
}

const jumeauMat = (b: Board) => b.jumeau!.material as THREE.MeshBasicMaterial;

// ————————————————————————————————————————————————————————————————
// 1. LE FRAGMENT — l'uniforme a-t-il un EFFET ?
// ————————————————————————————————————————————————————————————————

/** Méthode : jsdom n'a aucun contexte WebGL, donc aucun programme ne se compile ici. La garde mesure
 *  le SOURCE INJECTÉ — `onBeforeCompile` appelé sur un shader-témoin qui porte les mêmes directives
 *  que celui de three. C'est exactement ce qu'un `#include` non résolu masquerait. */
describe('Cadre de frame — le fragment échantillonne la CELLULE (#1176 L3)', () => {
  const ECHANTILLON_CADRE = 'texture2D( map, vMapUv * uFrameRect.zw + uFrameRect.xy )';
  const ECHANTILLON_NU = 'texture2D( map, vMapUv )';

  it('le CORPS : le texel se prend au rectangle de cellule, et plus jamais à la planche entière', () => {
    const mat = billboardMaterial(new THREE.Texture(), 1);
    const { src, uniforms } = fragment(mat);
    expect(src, 'sans cette expression, la cellule n’est jamais échantillonnée').toContain(ECHANTILLON_CADRE);
    // LA mesure qui tue l'ajout-après-include : le texel NU ne doit plus subsister nulle part, et
    // l'`#include` doit avoir été REMPLACÉ (three le résoudrait ensuite en version non cadrée).
    expect(src.replace(ECHANTILLON_CADRE, ''), 'un texel nu subsiste : l’uniforme serait sans effet').not.toContain(ECHANTILLON_NU);
    expect(src, 'l’include survivant = le chunk d’origine réinjecté par three').not.toContain('#include <map_fragment>');
    expect(src).toContain('uniform vec4 uFrameRect;');
    expect(uniforms.uFrameRect, 'l’uniforme branché EST celui que l’écrivain pilote').toBe(frameRectOf(mat));
  });

  it('le JUMEAU de silhouette porte la MÊME réécriture, sur le MÊME objet uniforme', () => {
    const corps = billboardMaterial(new THREE.Texture(), 1);
    const jumeau = silhouetteMaterial(corps, HERO_RING[0]);
    const { src, uniforms } = fragment(jumeau);
    expect(src).toContain(ECHANTILLON_CADRE);
    expect(src.replace(ECHANTILLON_CADRE, '')).not.toContain(ECHANTILLON_NU);
    expect(uniforms.uFrameRect, 'l’uniforme du CORPS, jamais une copie').toBe(frameRectOf(corps));
    expect(frameRectOf(jumeau)).toBe(frameRectOf(corps));
  });

  it('un corps monté HORS de l’écran garde un cadre PLEIN — jamais un jumeau sans uniforme', () => {
    const nu = new THREE.MeshBasicMaterial();
    const mat = silhouetteMaterial(nu, HERO_RING[0]);
    expect(frameRectOf(mat)!.value.toArray()).toEqual([...FRAME_RECT_PLEIN]);
  });

  it('le cadre par DÉFAUT est la texture entière : un sujet sans flipbook rend comme avant', () => {
    expect(frameRectOf(billboardMaterial(new THREE.Texture(), 1))!.value.toArray()).toEqual([...FRAME_RECT_PLEIN]);
  });

  /** Méthode : même shader-témoin que ci-dessus, monté sur le matériau que la passe d'OMBRES rend.
   *  C'est le seul endroit où l'omission se voit — le matériau de profondeur par défaut de three
   *  recopie `map` et `alphaTest`, donc rien ne manque à l'œil du code : l'ombre découpe simplement
   *  la PLANCHE ENTIÈRE (#1334). */
  it('la PASSE DE PROFONDEUR échantillonne la cellule, sur le MÊME objet uniforme que le corps', () => {
    const corps = billboardMaterial(new THREE.Texture(), 1);
    const { src, uniforms } = fragment(billboardDepthMaterial(corps) as unknown as THREE.MeshBasicMaterial);
    expect(src, 'l’ombre se découperait sur la planche entière : une grille de corps au sol').toContain(ECHANTILLON_CADRE);
    expect(src.replace(ECHANTILLON_CADRE, '')).not.toContain(ECHANTILLON_NU);
    expect(src, 'l’include survivant = le chunk d’origine réinjecté par three').not.toContain('#include <map_fragment>');
    expect(uniforms.uFrameRect, 'l’uniforme du CORPS, jamais une copie — sinon l’ombre joue une autre frame').toBe(frameRectOf(corps));
  });

  it('le matériau de profondeur est EMPAQUETÉ pour la carte d’ombre, et découpe au même seuil', () => {
    const mat = billboardDepthMaterial(billboardMaterial(new THREE.Texture(), 1));
    expect(mat.depthPacking).toBe(THREE.RGBADepthPacking);
    expect(mat.alphaTest).toBe(ALPHA_TEST);
    expect(mat.customProgramCacheKey!()).toBe(billboardDepthMaterial(billboardMaterial(new THREE.Texture(), 1)).customProgramCacheKey!());
  });

  it('la clé de PROGRAMME est explicite et CONSTANTE — un programme pour tous les corps', () => {
    const a = billboardMaterial(new THREE.Texture(), 1);
    const b = billboardMaterial(new THREE.Texture(), 1);
    expect(a.customProgramCacheKey()).toBe(b.customProgramCacheKey());
    expect(a.customProgramCacheKey()).not.toBe(silhouetteMaterial(a, HERO_RING[0]).customProgramCacheKey());
  });
});

// ————————————————————————————————————————————————————————————————
// 2. L'ÉCRIVAIN — planche, cellule, idempotence, repli
// ————————————————————————————————————————————————————————————————

describe('Écrivain de frames — deux écritures, aucune péremption (#1176 L3)', () => {
  const CLE = 'planche:sonde';
  const rect = (b: Board) => frameRectOf(b.material)!.value.toArray();

  it('pose la planche sur le CORPS **et** sur le JUMEAU, et la cellule demandée', () => {
    const b = board('h1');
    const p = planche(8);
    const atlasAt: AtlasAt = (k) => (k === CLE ? p : undefined);
    writeBoardFrames([b], () => ({ key: CLE, frame: 3 }), atlasAt);
    expect(b.material.map, 'le corps montre la planche').toBe(p.texture);
    // MUTATION : retirer l'écriture du jumeau laisse la silhouette sur l'atlas périmé — c'est ici
    // que ça se voit, et nulle part ailleurs (la passe de pose ne descend pas dans les enfants).
    expect(jumeauMat(b).map, 'la silhouette doit suivre le corps, jamais rester sur sa texture d’attache').toBe(p.texture);
    // MÊME loi pour la passe d'OMBRES (#1334) : sa planche laissée derrière découperait l'ombre d'un
    // geste révolu — et le cadre, lui, avance (l'uniforme est partagé).
    expect(boardDepthMaterial(b)!.map, 'l’ombre doit se découper sur la planche COURANTE').toBe(p.texture);
    const r = frameUvRect(p.layout, 3);
    expect(rect(b)).toEqual([r.x, r.y, r.w, r.h]);
  });

  it('IDEMPOTENCE : quatre images sans changement ne périment ni texture ni matériau', () => {
    const b = board('h1');
    const p = planche(8);
    const atlasAt: AtlasAt = () => p;
    writeBoardFrames([b], () => ({ key: CLE, frame: 2 }), atlasAt);
    const vTex = p.texture.version;
    const vMat = b.material.version;
    const vJum = jumeauMat(b).version;
    const vProf = boardDepthMaterial(b)!.version;
    const clé = b.material.customProgramCacheKey!();
    for (let i = 0; i < 4; i++) writeBoardFrames([b], () => ({ key: CLE, frame: 2 }), atlasAt);
    expect(p.texture.version, 'un `needsUpdate` par image re-téléverserait la planche au GPU').toBe(vTex);
    expect(b.material.version, 'un `needsUpdate` par image recompilerait le programme').toBe(vMat);
    expect(jumeauMat(b).version).toBe(vJum);
    expect(boardDepthMaterial(b)!.version, 'le swap de planche d’ombre ne périme pas le matériau').toBe(vProf);
    expect(b.material.customProgramCacheKey!()).toBe(clé);
  });

  it('REBUILD : un board NEUF (pas commité) reprend sa planche à la première image', () => {
    const p = planche(8);
    const atlasAt: AtlasAt = () => p;
    const pick = () => ({ key: CLE, frame: 5 });
    writeBoardFrames([board('h1')], pick, atlasAt);
    // `actorPoseKey` porte x,y,facing : les sujets se reconstruisent à CHAQUE pas. Un écrivain piloté
    // par TRANSITION ne verrait aucun changement de clip ici, et laisserait le quad neuf sur sa
    // texture statique.
    const neuf = board('h1');
    writeBoardFrames([neuf], pick, atlasAt);
    expect(neuf.material.map, 'le board neuf doit RECEVOIR la planche, sans aucune transition').toBe(p.texture);
    const r = frameUvRect(p.layout, 5);
    expect(rect(neuf)).toEqual([r.x, r.y, r.w, r.h]);
  });

  it('REPLI à cache froid : la planche COURANTE reste, l’index se CLAMPE, la cuisson est DEMANDÉE', () => {
    const b = board('h1');
    const p = planche(4);
    writeBoardFrames([b], () => ({ key: CLE, frame: 1 }), () => p);
    const demandes: FramePick[] = [];
    // La planche du palier supérieur manque au cache : l'écrivain garde celle-ci.
    writeBoardFrames([b], () => ({ key: 'planche:absente', frame: 9 }), () => undefined, (pick) => demandes.push(pick));
    expect(b.material.map, 'le quad garde sa planche : rien ne clignote').toBe(p.texture);
    const r = frameUvRect(p.layout, 3); // clampé à n-1 = 3, jamais 9
    expect(rect(b), 'un index hors planche pointerait à côté de toute cellule').toEqual([r.x, r.y, r.w, r.h]);
    expect(demandes.map((d) => d.key)).toEqual(['planche:absente']);
  });

  it('REPLI sur texture STATIQUE (rebuild froid) : cadre PLEIN, jamais une cellule inexistante', () => {
    const b = board('h1'); // aucun `atlasLayout` : la texture de montage est une image d'UNE frame
    writeBoardFrames([b], () => ({ key: 'planche:absente', frame: 6 }), () => undefined);
    expect(rect(b), 'une cellule ≥ 1 sur une texture 1-frame montrerait du vide').toEqual([...FRAME_RECT_PLEIN]);
  });

  it('un sujet SANS flipbook ne demande RIEN : cadre plein s’il n’a pas de planche, cellule 0 sinon', () => {
    // Décor, gabarit de créature, figurant : leur texture est une image d'UNE frame.
    const nu = board('d1');
    const demandes: FramePick[] = [];
    writeBoardFrames([nu], () => null, () => undefined, (p) => demandes.push(p));
    expect(rect(nu)).toEqual([...FRAME_RECT_PLEIN]);
    // Un sujet qui CESSE de jouer (le résolveur ne le connaît plus) garde sa planche et revient à sa
    // première cellule : le cadre plein y montrerait la planche ENTIÈRE, soit huit corps miniatures.
    const b = board('h1');
    const p = planche(8);
    writeBoardFrames([b], () => ({ key: CLE, frame: 2 }), () => p);
    writeBoardFrames([b], () => null, () => undefined, (q) => demandes.push(q));
    const r = frameUvRect(p.layout, 0);
    expect(rect(b)).toEqual([r.x, r.y, r.w, r.h]);
    expect(demandes, 'aucune cuisson ne se demande pour un sujet qui ne joue rien').toEqual([]);
  });
});

// ————————————————————————————————————————————————————————————————
// 3. LE PALIER — la mesure du facteur DPR, et l'hystérésis
// ————————————————————————————————————————————————————————————————

describe('Palier de cuisson — la sous-résolution mesurée du rapport de pixels (#1328)', () => {
  const MPT = sceneMetresPerTile(emptyScene(8, 8));
  const HAUTEUR_M = 2.3; // un personnage debout, convention `jeu`

  it('MESURE : à zoom MAX, un quad couvre `min(2, dpr)` fois plus de pixels que sa texture n’en porte', () => {
    const pxm = pxPerM(MPT);
    // La texture est cuite en pixels CSS (`rasterPxHeight` : hauteur écran au zoom maximal)…
    const texturePx = rasterPxHeight(HAUTEUR_M, pxm);
    // …alors que le renderer peint en pixels de DISPOSITIF (`setPixelRatio(min(2, dpr))`).
    for (const dpr of [1, 1.5, 2, 3]) {
      const attendu = Math.min(DPR_PLAFOND, dpr);
      const écranPx = HAUTEUR_M * pxm * ZOOM_MAX * attendu;
      // Écart admis : l'arrondi au pixel ENTIER du palier (`rasterPxHeight` plafonne au supérieur).
      expect(Math.abs(écranPx / texturePx - attendu), `dpr ${dpr}`).toBeLessThan(2 / texturePx);
    }
    // …et c'est exactement ce que le palier de cuisson comble.
    expect(atlasPxHeight(HAUTEUR_M, pxm, 2)).toBe(texturePx * 2);
    expect(atlasPxHeight(HAUTEUR_M, pxm, 1)).toBe(texturePx);
    expect(atlasPxHeight(HAUTEUR_M, pxm, 3), 'le plafond du rendu borne aussi la cuisson').toBe(texturePx * 2);
  });

  it('le palier reste sous le plafond de TEXTURE, quel que soit le rapport de pixels', () => {
    expect(atlasPxHeight(400, pxPerM(MPT), 2)).toBeLessThanOrEqual(2048);
  });

  it('HYSTÉRÉSIS : deux seuils, donc aucune oscillation sur la frontière', () => {
    const px = 128;
    expect(palierAtlas(px, px * (GROSSISSEMENT_HAUT + 0.1)), 'grossi : le palier du dessus').toBe(256);
    expect(palierAtlas(px, px * (GROSSISSEMENT_HAUT - 0.1)), 'sous le seuil haut : rien ne bouge').toBe(px);
    expect(palierAtlas(px, px * (GROSSISSEMENT_BAS + 0.05)), 'entre les deux seuils : rien ne bouge').toBe(px);
    expect(palierAtlas(px, px * (GROSSISSEMENT_BAS - 0.05)), 'nettement plus petit : on redescend').toBe(64);
    // Un seuil UNIQUE ferait basculer un quad posé dessus à chaque image : ici, le palier atteint après
    // une montée ne redescend pas à la mesure qui vient de le faire monter.
    const monté = palierAtlas(px, px * 1.6);
    expect(palierAtlas(monté, px * 1.6)).toBe(monté);
  });

  it('le nombre de frames d’une planche est BORNÉ — une planche ne coûte pas la seconde entière', () => {
    expect(atlasFrames(rigIdleDef())).toBeLessThanOrEqual(ATLAS_FRAMES_MAX);
    expect(atlasFrames(rigIdleDef())).toBeGreaterThanOrEqual(2);
  });

  it('la cellule d’un geste EN BOUCLE tourne, celle d’un geste UNIQUE se clampe à la dernière', () => {
    expect([0, 0.5, 1, 1.5].map((t) => frameIndexAt(t * 400, 400, 8, true))).toEqual([0, 4, 0, 4]);
    expect([0, 0.5, 1, 3].map((t) => frameIndexAt(t * 400, 400, 8, false))).toEqual([0, 4, 7, 7]);
  });
});

// ————————————————————————————————————————————————————————————————
// 4. LA BOUCLE MONTÉE — une image ne rasterise RIEN
// ————————————————————————————————————————————————————————————————

const TAILLE = { w: 800, h: 600 };
const SCENE: Scene = emptyScene(10, 10);
const DIMS: Dims = { w: SCENE.dimensions.w, h: SCENE.dimensions.h, rot: 0, view: 'iso' };
const AFFINE: StageFrame = { mode: 'plateau', dims: DIMS, cam: { x: 0, y: 0 }, zoom: 1 };
/** Le MÊME cadre au zoom maximal — celui sur lequel le palier de cuisson est taillé (`rasterPxHeight`). */
const AFFINE_ZOOM_MAX: StageFrame = { mode: 'plateau', dims: DIMS, cam: { x: 0, y: 0 }, zoom: ZOOM_MAX };

function combattant(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: { 'capacite-de-combat': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    advantage: 0, conditions: [], armour: {}, skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

const ACTEURS: ActorPose[] = [{ c: combattant('h1', { x: 2, y: 2 }), x: 2, y: 2, z: 0, heroIndex: 0 }];

let root: Root | null = null;
let hôte: HTMLDivElement | null = null;
let glissement: { dx: number; dy: number; dz: number } | null = null;
let battre: (() => void) | null = null;

brancherArdoise();

const anim: StageWalkAnim = {
  subscribe: (onFrame) => { battre = onFrame; return () => { battre = null; }; },
  glide: (cid) => (cid === 'h1' ? glissement : null),
  cam: () => ({ x: 0, y: 0 }),
};

interface OptsVue { actors?: ActorPose[]; els?: SceneBillboardEls; frame?: StageFrame }

function vue(opts: OptsVue): JSX.Element {
  return (
    <GameStage3D
      scene={SCENE}
      mpt={sceneMetresPerTile(SCENE)}
      frame={opts.frame ?? AFFINE}
      tintAt={() => 1}
      keepEl={() => true}
      els={opts.els ?? { tokens: [], props: [] }}
      actors={opts.actors ?? ACTEURS}
      gameTime={720}
      lightLevel={null}
      lights={[]}
      anim={anim}
    />
  );
}

/** Ce que les faux timers de vitest remplacent PAR DÉFAUT — `performance` n'en est pas, et
 *  `requestAnimationFrame` non plus (la boucle d'images s'arme par rAF, `stageFrames.ts:90-97` : la
 *  faker la figerait). Un banc qui a besoin de l'horloge d'animation (`animNow()` =
 *  `performance.now()`, `fx/animTracks.ts:39-40`) ajoute `'performance'` à cette liste. */
const TIMERS_PAR_DÉFAUT = [
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'Date',
] as const;

/** UNE TRANCHE laissée à la file cadencée du cuiseur — le seul point de passage du temps de ce
 *  fichier. Simulée quand le banc a posé de faux timers, réelle sinon : un banc qui veut un écoulé
 *  EXACT n'a donc rien à réécrire, il pose ses faux timers et les tranches suivent. */
let msSimulées = 0;
const tranche = async (ms: number): Promise<void> => {
  await act(async () => {
    if (vi.isFakeTimers()) { msSimulées += ms; await vi.advanceTimersByTimeAsync(ms); }
    else await new Promise((r) => setTimeout(r, ms));
  });
};

/** Laisse la file CADENCÉE du cuiseur servir ses tâches (#1372 : les textures du montage y passent) —
 *  jusqu'à ce que `attendus` corps soient en scène, dans un budget BORNÉ. */
async function attendreMontage(attendus: number): Promise<void> {
  for (let i = 0; i < 60 && corps().length < attendus; i++) {
    await tranche(20);
    if (battre) act(() => battre!());
  }
}

async function monter(opts: OptsVue = {}): Promise<void> {
  viderCaptures();
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  await act(async () => {
    root!.render(vue(opts));
  });
  await attendreMontage((opts.actors ?? ACTEURS).length);
}

/** REBUILD des boards de l'écran déjà monté : une nouvelle identité de tableau d'acteurs suffit — c'est
 *  ce que produit chaque pas commité (`actorPoseKey` porte x, y, facing). */
async function remonter(opts: OptsVue = {}): Promise<void> {
  await act(async () => {
    root!.render(vue({ ...opts, actors: [...(opts.actors ?? ACTEURS)] }));
  });
  await tranche(20);
}

/** Les corps de jeton de la dernière frame dessinée (les quads, pas leurs jumeaux). */
function corps(): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  scènes[scènes.length - 1]?.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.name.startsWith('silhouette:')) out.push(o.parent as THREE.Mesh);
  });
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
  // Les faux timers sont un SINGLETON de worker : un banc qui simule le temps le rend, sinon le
  // banc suivant attend un réveil que plus personne ne déclenche.
  vi.useRealTimers();
});

describe('Boucle volumique — une image joue une frame, elle n’en cuit aucune (#1176 L3)', () => {
  it('quatre images de MARCHE et de GESTE : zéro rasterisation, zéro péremption', async () => {
    // CACHE FROID CONSTRUIT, jamais supposé (#1619) : la cuisson tourne (la file sert ses tranches,
    // la pré-cuisson rasterise), mais AUCUNE planche n'est jamais SERVIE au quad. Sans ce gel, la
    // froideur n'était qu'une course gagnée d'avance sur une machine rapide : sur un runner à 2 cœurs
    // la cuisson livrait entre la capture et les images, le quad échangeait sa planche, et l'identité
    // mesurée plus bas tombait (mesuré sur CI, run 33413153943 passes 1 et 3).
    vi.spyOn(atlasBake, 'getCachedAtlas').mockReturnValue(undefined);
    const raster = vi.spyOn(svgTexture, 'rasterizeSvg');
    await monter();
    const quads = corps();
    // PRÉMISSE — sans elle, la mesure porterait sur une scène vide (jsdom saute tout board dont la
    // texture ne se résout pas).
    expect(quads.length, 'aucun board monté : rien à mesurer').toBeGreaterThan(0);
    const mats = quads.map((q) => q.material as THREE.MeshBasicMaterial);
    const états = mats.map((m) => ({
      mat: m.version,
      tex: (m.map as THREE.Texture).version,
      clé: m.customProgramCacheKey!(),
      map: m.map,
    }));
    // PRÉMISSE — la sonde MORD : la pré-cuisson du montage, elle, rasterise bien par ce point-là.
    // Sans cette mesure, « zéro appel » ne dirait rien d'autre que « la sonde est branchée ailleurs ».
    await tranche(40);
    expect(raster.mock.calls.length, 'la pré-cuisson doit passer par `rasterizeSvg`').toBeGreaterThan(0);
    raster.mockClear();
    // MARCHE : le sujet glisse, la boucle rejoue des images sans aucun rendu React.
    glissement = { dx: 1.2, dy: 0, dz: 0 };
    for (let i = 0; i < 4; i++) { glissement = { dx: 1.2 - i * 0.3, dy: 0, dz: 0 }; act(() => battre!()); }
    // GESTE : plus de glissement, le registre de pistes décide (ou le repos).
    glissement = null;
    for (let i = 0; i < 4; i++) act(() => battre!());
    expect(raster, 'une image qui rasterise, c’est ~10 ms de mur par frame (sonde #1176)').not.toHaveBeenCalled();
    mats.forEach((m, i) => {
      expect(m.version, 'un matériau périmé = un programme recompilé en pleine marche').toBe(états[i].mat);
      expect((m.map as THREE.Texture).version, 'une texture périmée = un téléversement GPU par image').toBe(états[i].tex);
      expect(m.customProgramCacheKey!()).toBe(états[i].clé);
      // À cache d'atlas FROID, le quad garde sa planche de montage : rien ne clignote.
      expect(m.map).toBe(états[i].map);
    });
  });

  it('le CADRE reste PLEIN tant qu’aucune planche n’est cuite — le sujet ne montre pas du vide', async () => {
    await monter();
    const quads = corps();
    expect(quads.length).toBeGreaterThan(0);
    act(() => battre!());
    for (const q of quads) {
      expect(frameRectOf(q.material as THREE.Material)!.value.toArray()).toEqual([...FRAME_RECT_PLEIN]);
    }
  });

  /** CÂBLAGE de la passe d'ombres (#1334) : sans `customDepthMaterial`, three rend la passe de
   *  profondeur avec le SIEN — `map` et `alphaTest` recopiés, cadre de frame ABSENT — et l'ombre
   *  portée d'un corps animé devient sa PLANCHE entière (grille de silhouettes grises au sol,
   *  signalement utilisateur avec capture). Ça ne se voit sur AUCUNE autre mesure : le corps, lui,
   *  reste juste. */
  it('CASTEUR : tout quad qui projette porte le matériau de profondeur À CADRE, uniforme partagé', async () => {
    await monter();
    const quads = corps();
    expect(quads.length, 'aucun board monté : rien à mesurer').toBeGreaterThan(0);
    for (const q of quads) {
      expect(q.castShadow, 'PRÉMISSE : ce quad doit projeter').toBe(true);
      const profondeur = q.customDepthMaterial as THREE.MeshDepthMaterial | undefined;
      expect(profondeur, 'la passe d’ombre découperait la planche ENTIÈRE').toBeDefined();
      expect(profondeur!.map, 'l’ombre doit se découper sur la planche du corps').toBe((q.material as THREE.MeshBasicMaterial).map);
      expect(frameRectOf(profondeur!), 'l’ombre jouerait une autre cellule que le corps').toBe(frameRectOf(q.material as THREE.Material));
    }
  });

  it('MONTAGE PAR SUJET : un board entre en scène dès SA texture — il n’attend pas les autres', async () => {
    // Une SEULE rasterisation aboutit ; toutes les suivantes restent en suspens (une chaîne de
    // rasterisation qui ne rend jamais la main : le cas que le tout-ou-tien masquait).
    let servies = 0;
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) { if (servies++ === 0) queueMicrotask(() => this.onload?.()); }
    });
    viderCaptures();
    hôte = document.createElement('div');
    document.body.appendChild(hôte);
    root = createRoot(hôte);
    await act(async () => {
      root!.render(
        <GameStage3D
          scene={SCENE}
          mpt={sceneMetresPerTile(SCENE)}
          frame={AFFINE}
          tintAt={() => 1}
          keepEl={() => true}
          els={{ tokens: [], props: [] }}
          actors={[ACTEURS[0], { c: combattant('e1', { x: 5, y: 2 }), x: 5, y: 2, z: 0 }]}
          gameTime={720}
          lightLevel={null}
          lights={[]}
          anim={anim}
        />,
      );
    });
    // Le montage passe par la file cadencée (#1372) : la seule texture qui aboutira arrive à sa tranche.
    await attendreMontage(1);
    // Sous un `allSettled`, AUCUN board n'existerait : le groupe entier attendait le dernier sujet.
    expect(corps(), 'le sujet résolu doit être à l’écran, seul').toHaveLength(1);
  });
});

// ————————————————————————————————————————————————————————————————
// 5. LES DEUX POPULATIONS QUI NE JOUAIENT PAS (#1176, L4)
// ————————————————————————————————————————————————————————————————
//
// Un GABARIT de créature (`BodyPlan` — la moitié du bestiaire) restait une statue qui glisse, et les
// clips d'AMBIANCE authorés d'une entité de scène (`SceneEntity.anim`, donnée éditable) étaient morts
// en volumique. Les deux se mesurent ICI, sur l'écran monté : ce que le cuiseur reçoit à cuire, et ce
// que le quad montre au fil du temps.

/** Un combattant à corps de GABARIT (quadrupède) — `glide` du banc suit l'id `h1`. */
function bête(id: string): Combatant {
  return { ...combattant(id, { x: 3, y: 3 }), kind: 'enemy', creatureId: 'loup', species: undefined } as unknown as Combatant;
}

/** Une entité de scène FIGURANTE, avec (ou sans) ambiance authorée. */
function figurantEl(id: string, anim?: string): TokenEl {
  const ent = { id, kind: 'personnage', ref: 'humain', pos: { x: 4, y: 4 }, facing: 'S', appearance: { species: 'humain' }, ...(anim ? { anim } : {}) };
  return {
    kind: 'token', key: `fig:${id}`, id, cell: { x: 4, y: 4, z: 0 },
    subject: { kind: 'figurant', ent, enrolled: false, inBattle: false },
  } as unknown as TokenEl;
}

const cadre = (m: THREE.Mesh) => frameRectOf(m.material as THREE.Material)!.value.toArray().join(',');

/**
 * Laisse la file de cuisson tourner : un nombre BORNÉ de tranches, la boucle d'image battue à
 * chacune. Jamais une fenêtre de MUR — la longueur d'une fenêtre ne dit rien du travail fait, et
 * une machine chargée en sort autrement qu'une machine au repos.
 *
 * `jusquÀ` sort au FAIT accompli dès qu'il est vrai. Sans lui, les `tours` sont joués en entier :
 * c'est le cas d'une ABSENCE à observer (aucune planche cuite), qu'aucune convergence ne peut
 * annoncer — seule une borne d'itérations la borne.
 */
async function laisserCuire(tours: number, jusquÀ?: () => boolean): Promise<void> {
  for (let i = 0; i < tours; i++) {
    if (jusquÀ?.()) return;
    await tranche(30);
    if (battre) act(() => battre!());
  }
}

describe('Gabarits de créature — le flipbook n’est plus réservé aux bipèdes (#1176 L4)', () => {
  it('un gabarit est PRÉ-CUIT comme un rig — il n’est plus laissé à sa texture statique', async () => {
    const raster = vi.spyOn(svgTexture, 'rasterizeSvg');
    await monter({ actors: [{ c: bête('b1'), x: 3, y: 3, z: 0 }] });
    await laisserCuire(10, () => raster.mock.calls.length > 1);
    // Toutes ces rasterisations sont des CELLULES de planche : la texture statique d'un billboard
    // passe, elle, par `getBillboardTexture` (appel interne au module, hors de cette sonde). Avant ce
    // lot, un corps de gabarit n'en produisait AUCUNE — l'écran le sautait faute de couture de frame.
    // Que ces cellules DIFFÈRENT entre elles se mesure sur la couture (`billboard-frameSvg.test.ts`),
    // seule à pouvoir isoler les frames d'UNE planche.
    expect(raster.mock.calls.length, 'aucune cuisson : le gabarit n’a pas de couture de frame').toBeGreaterThan(1);
  });

  it('un gabarit qui MARCHE ne rasterise rien par image, et ne périme ni texture ni programme', async () => {
    await monter({ actors: [{ c: bête('h1'), x: 3, y: 3, z: 0 }] });
    await laisserCuire(10, () => quads().length > 0);
    const quad = quads();
    expect(quad.length, 'aucun board monté : rien à mesurer').toBeGreaterThan(0);
    const mats = quad.map((q) => q.material as THREE.MeshBasicMaterial);
    const états = mats.map((m) => ({ mat: m.version, tex: (m.map as THREE.Texture).version, clé: m.customProgramCacheKey!() }));
    const raster = vi.spyOn(svgTexture, 'rasterizeSvg');
    for (let i = 0; i < 4; i++) { glissement = { dx: 1.2 - i * 0.3, dy: 0, dz: 0 }; act(() => battre!()); }
    expect(raster, 'une image qui rasterise, c’est ~10 ms de mur par frame (sonde #1176)').not.toHaveBeenCalled();
    mats.forEach((m, i) => {
      expect(m.version).toBe(états[i].mat);
      expect((m.map as THREE.Texture).version).toBe(états[i].tex);
      expect(m.customProgramCacheKey!()).toBe(états[i].clé);
    });
  });
});

describe('Ambiance authorée d’une entité — la donnée éditable joue en volumique (#1176 L4)', () => {
  it('avec `anim` : la CELLULE change au fil du temps — la boucle est vivante', async () => {
    await monter({ actors: [], els: { tokens: [figurantEl('f1', 'feed')], props: [] } });
    const vus = new Set<string>();
    // La planche se cuit une cellule par tranche : on bat la boucle jusqu'à voir DEUX cellules
    // différentes, sous un budget borné (une planche de 12 frames ≈ 100 ms par cellule jouée).
    for (let i = 0; i < 24 && vus.size < 2; i++) {
      await tranche(60);
      act(() => battre!());
      for (const q of quads()) vus.add(cadre(q));
    }
    expect(vus.size, 'le figurant reste figé : son ambiance authorée est morte').toBeGreaterThan(1);
  });

  it('sans `anim` : STATIQUE — cadre PLEIN, AUCUNE planche cuite, aucun coût nouveau', async () => {
    const raster = vi.spyOn(svgTexture, 'rasterizeSvg');
    await monter({ actors: [], els: { tokens: [figurantEl('f2')], props: [] } });
    // Aucune convergence à observer : ce banc prouve une ABSENCE de cuisson. Les tours sont donc
    // joués en entier — c'est la borne d'itérations qui est le budget, pas une fenêtre de mur.
    await laisserCuire(8);
    const quad = quads();
    expect(quad.length).toBeGreaterThan(0);
    for (const q of quad) expect(cadre(q), 'un figurant sans ambiance ne montre pas de cellule').toBe(FRAME_RECT_PLEIN.join(','));
    expect(raster, 'une entité sans ambiance ne cuit aucune planche (sa texture statique ne passe pas par ici)').not.toHaveBeenCalled();
  });
});

// ————————————————————————————————————————————————————————————————
// 6. LE PALIER DU CHEMIN STATIQUE, ET L'EFFONDREMENT QUI SE REJOUAIT
// ————————————————————————————————————————————————————————————————

describe('Palier du chemin STATIQUE — texture de montage et planches au MÊME palier (#1328)', () => {
  /** Les paliers RÉELLEMENT demandés à la rasterisation sous ce rapport de pixels : la texture de
   *  MONTAGE d'un billboard (`svgToTexture`) et les CELLULES de ses planches (`rasterizeSvg`).
   *
   *  Mesure prise au ZOOM MAXIMAL, celui sur lequel le palier de cuisson est taillé (`rasterPxHeight`) :
   *  la taille projetée du quad y tombe sur son palier, donc l'hystérésis (`palierAtlas`) ne réclame
   *  aucune autre planche et tout ce qui se cuit dérive de la même hauteur. Sous un zoom plus lâche, un
   *  palier plus bas apparaîtrait — le système qui travaille, pas l'incohérence cherchée ici. */
  async function paliers(dpr: number): Promise<{ statiques: number[]; planches: number[] }> {
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: dpr });
    svgTexture.clearBillboardTextures();
    const statique = vi.spyOn(svgTexture, 'svgToTexture');
    const cellule = vi.spyOn(svgTexture, 'rasterizeSvg');
    await monter({ frame: AFFINE_ZOOM_MAX });
    for (let i = 0; i < 10; i++) await tranche(30);
    const mesure = {
      statiques: statique.mock.calls.map((c) => c[2]),
      planches: cellule.mock.calls.map((c) => c[2]),
    };
    statique.mockRestore();
    cellule.mockRestore();
    if (root) { act(() => root!.unmount()); root = null; }
    if (hôte) { hôte.remove(); hôte = null; }
    resetBakeQueue();
    clearAtlasCache();
    return mesure;
  }

  it('un même sujet au même zoom : UN seul palier, et il porte le facteur DPR du renderer', async () => {
    const deux = await paliers(2);
    const un = await paliers(1);
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
    // PRÉMISSES — sans elles, « un seul palier » serait vrai d'un ensemble vide.
    expect(deux.statiques.length, 'aucune texture de montage : rien à mesurer').toBeGreaterThan(0);
    expect(deux.planches.length, 'aucune planche cuite : rien à comparer').toBeGreaterThan(0);
    expect(un.statiques.length).toBeGreaterThan(0);
    // Le saut de netteté que le DPR absent du chemin statique fabriquait : le quad passe de sa texture
    // de montage à sa première planche, et change de résolution en route.
    expect(
      new Set([...deux.statiques, ...deux.planches]).size,
      `paliers statiques ${[...new Set(deux.statiques)]} contre planches ${[...new Set(deux.planches)]}`,
    ).toBe(1);
    // …et ce palier unique SUIT le rapport de pixels : à DPR 1, le même sujet se cuit deux fois plus bas.
    expect(deux.statiques[0], 'le palier de montage ignore le rapport de pixels du rendu').toBe(un.statiques[0] * DPR_PLAFOND);
  });
});

describe('Effondrement — la chute se compte depuis l’ENTRÉE AU SOL (#1176 L4)', () => {
  /** Un combattant À TERRE (`groundStateOf` : État `a-terre`) — son sujet porte `anim.ground`. */
  function àTerre(id: string): Combatant {
    return { ...combattant(id, { x: 2, y: 2 }), conditions: [{ id: 'a-terre', value: 1 }] } as unknown as Combatant;
  }

  /** Planches SERVIES SANS RASTERISATION : une cellule coûte ~10 ms de mur (sonde #1176), et une chute
   *  de 420 ms n'a pas le temps de se cuire dans un banc. La GRILLE reste réelle (`atlasLayout`). */
  function servirLesPlanches(): void {
    vi.spyOn(atlasBake, 'bakeAtlas').mockImplementation(async (_draw, _box, n) => {
      const layout = atlasLayout(24, 30, n);
      return { texture: new THREE.CanvasTexture(document.createElement('canvas')), layout, bytes: layout.texW * layout.texH * 4 };
    });
  }

  /** Rang de la cellule montrée par le quad dans une planche de `n` cellules — `null` = aucune (le quad
   *  est resté sur sa texture statique, cadre plein). */
  function celluleMontrée(n: number): number | null {
    const l = atlasLayout(24, 30, n);
    for (const q of quads()) {
      for (let k = 0; k < l.n; k++) {
        const r = frameUvRect(l, k);
        if (cadre(q) === [r.x, r.y, r.w, r.h].join(',')) return k;
      }
    }
    return null;
  }

  it('REBUILD à mi-chute : la chute REPREND où elle en est ; après la fin, la dernière cellule TIENT', async () => {
    // L'écoulé est SIMULÉ, donc EXACT — plus de tolérance à accorder à l'ordonnanceur. La cellule est
    // lue par `animNow()` = `performance.now()` (`fx/animTracks.ts:39-40`), que les faux timers de
    // vitest NE couvrent PAS par défaut : `performance` s'ajoute explicitement aux `toFake`. Jamais
    // `requestAnimationFrame` : la boucle d'images s'arme par rAF (`stageFrames.ts:90-97`) et se
    // figerait — c'est `battre()` qui la bat ici, à la main. Les faux timers sont posés AVANT le
    // montage : l'origine de la piste d'animation doit être prise sur la MÊME horloge que la lecture.
    vi.useFakeTimers({ toFake: [...TIMERS_PAR_DÉFAUT, 'performance'] });
    servirLesPlanches();
    const N = atlasFrames(planDyingDef('prone'));
    const acteurs: ActorPose[] = [{ c: àTerre('h1'), x: 2, y: 2, z: 0, heroIndex: 0 }];
    const départ = msSimulées;
    await monter({ actors: acteurs });

    await tranche(20);
    act(() => battre!());
    await tranche(20);
    act(() => battre!());
    expect(celluleMontrée(N), 'PRÉMISSE : la planche d’effondrement doit être servie').not.toBeNull();
    // MI-CHUTE : les boards se rebâtissent (un pas commité) — la chute ne redémarre pas.
    await tranche(150);
    await remonter({ actors: acteurs });
    act(() => battre!());
    // L'écoulé est la SOMME des avances simulées depuis le montage — un compte, pas une horloge lue.
    const écoulé = msSimulées - départ;
    const attendu = frameIndexAt(écoulé, COLLAPSE_MS, N, false);
    expect(attendu, 'PRÉMISSE : la chute doit être ENGAGÉE au moment du rebuild').toBeGreaterThan(1);
    expect(celluleMontrée(N), `cellule montrée à ${écoulé} ms simulés (attendu ${attendu})`).toBe(attendu);
    // APRÈS LA FIN : le cadavre reste au sol — un rebuild qui rejoue la chute le relèverait.
    await tranche(COLLAPSE_MS);
    await remonter({ actors: acteurs });
    act(() => battre!());
    expect(celluleMontrée(N), 'la chute se rejoue à chaque rebuild de board').toBe(N - 1);
  });
});

/**
 * UN MIS HORS DE COMBAT EST À TERRE (#1334) — mesuré sur l'ÉCRAN monté, du vivant à sa mort.
 *
 * Deux faits, et deux pannes silencieuses en face : la planche que l'écrivain choisit à chaque image
 * (une planche de repos, et le mort reste debout à respirer), et l'INSTANT qu'il y joue (un geste
 * bouclé, et le cadavre se relève toutes les 420 ms).
 */
describe('Hors de combat — l’écrivain joue l’EFFONDREMENT et le TIENT (#1334)', () => {
  function servirLesPlanches(): void {
    vi.spyOn(atlasBake, 'bakeAtlas').mockImplementation(async (_draw, _box, n) => {
      const layout = atlasLayout(24, 30, n);
      return { texture: new THREE.CanvasTexture(document.createElement('canvas')), layout, bytes: layout.texW * layout.texH * 4 };
    });
  }

  /** Les planches que les images ont RÉCLAMÉES au cache — la clé porte l'état au sol visé
   *  (`atlasKey`), donc elle dit quelle planche le corps joue. */
  function espionnerLesClés(): string[] {
    const clés: string[] = [];
    const orig = atlasBake.getCachedAtlas;
    vi.spyOn(atlasBake, 'getCachedAtlas').mockImplementation((k: string) => { clés.push(k); return orig(k); });
    return clés;
  }

  const dernière = (clés: string[]) => clés[clés.length - 1] ?? '';

  it('du VIVANT au MORT : la planche passe du repos à l’EFFONDREMENT, et n’en revient pas', async () => {
    servirLesPlanches();
    const clés = espionnerLesClés();
    // Le store MUTE le combattant en place : c'est cet objet-là que le builder repasse à l'écran.
    const c = { ...combattant('e1', { x: 2, y: 2 }), kind: 'enemy' } as unknown as Combatant;
    await monter({ actors: [{ c, x: 2, y: 2, z: 0 }] });
    await tranche(80);
    act(() => battre!());
    // PRÉMISSE : vivant, il joue un geste DEBOUT — aucun état au sol dans sa clé.
    expect(dernière(clés), 'PRÉMISSE : le vivant ne doit pas déjà jouer sa chute').toContain('|-|');
    // MIS HORS DE COMBAT (`isOutOfAction` : figurant à 0 PB, achevé) — ce que `groundStateOf` lit.
    (c as { dead?: boolean }).dead = true;
    c.wounds.current = 0;
    await remonter({ actors: [{ c, x: 2, y: 2, z: 0 }] });
    act(() => battre!());
    expect(dernière(clés), 'un hors de combat qui joue encore son repos reste DEBOUT à l’écran').toContain('|corpse|');
    // …et il y RESTE : deux secondes plus tard, toujours l'effondrement, jamais un retour au repos.
    await tranche(500);
    act(() => battre!());
    expect(dernière(clés)).toContain('|corpse|');
  });

  it('la chute JOUÉE se TIENT à sa dernière cellule — le cadavre ne se relève pas en boucle', async () => {
    servirLesPlanches();
    const c = { ...combattant('e1', { x: 2, y: 2 }), kind: 'enemy', dead: true, wounds: { current: 0, max: 12 } } as unknown as Combatant;
    const acteurs: ActorPose[] = [{ c, x: 2, y: 2, z: 0 }];
    await monter({ actors: acteurs });
    // La chute (COLLAPSE_MS) est passée depuis longtemps : la cellule montrée est la DERNIÈRE.
    await tranche(COLLAPSE_MS + 200);
    act(() => battre!());
    const n = atlasFrames(planDyingDef('corpse'));
    const l = atlasLayout(24, 30, n);
    const vues = quads().map((q) => {
      for (let k = 0; k < l.n; k++) {
        const r = frameUvRect(l, k);
        if (cadre(q) === [r.x, r.y, r.w, r.h].join(',')) return k;
      }
      return null;
    });
    expect(vues.filter((k) => k !== null).length, 'PRÉMISSE : la planche d’effondrement doit être servie et jouée').toBeGreaterThan(0);
    expect(vues.every((k) => k === n - 1), `cellules montrées ${vues} (attendu ${n - 1})`).toBe(true);
  });
});
