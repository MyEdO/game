import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { stage3dFraming } from './stage3dCamera';
import { stageCamAffine, stageCamTransform, stageScreenPixel, viewBoxScale } from './stageCam';
import { VH, VW } from './useStageCamera';
import { affineCamera, projectToScreen } from '../backends/webgl/cameras';
import { tileCenter, type Dims, type Rot } from '../../geometry/iso';
import { metricToLift } from '../../state/relief';
import { sceneMetresPerTile } from '../../state/scene';
import { buildScene } from '../../state/mapSpec';
import { spec as siegeSpec } from '../../scenes/test-scenarios/siege-enceinte';

/**
 * CÂBLAGE store → caméra volumique. `cameras.test.ts` prouve déjà la coïncidence des ÉCARTS de pixel à
 * ancrage commun ; ce qui reste à prouver ici, c'est que l'ANCRAGE dérivé de l'état de caméra du stage
 * (cran, edge-on, projection, zoom, décalage manuel) pose le monde volumique au MÊME pixel ABSOLU que la
 * chaîne de transformation de l'hôte du monde (`stage/MondeDeCampagne`) — cible ET échelle comprises. Un signe de rotation inversé, un
 * zoom appliqué au mauvais étage ou un `slice` oublié s'y voient au pixel.
 */
const scene = buildScene(siegeSpec());
const mpt = sceneMetresPerTile(scene);
/** L'écart mesuré est de l'ordre du flottant : la tolérance n'est pas un « à peu près ». */
const TOL = 1e-6;

const SAMPLES: { x: number; y: number; h: number }[] = [];
for (const x of [0, 7, 14.5, 22, 29]) for (const y of [0, 11, 23.5, 34, 45]) for (const h of [0, 1.7, 4, 9.25]) SAMPLES.push({ x, y, h });

/** Pixel de l'ÉLÉMENT rendu par la chaîne de la surcouche de plateau — la FONCTION DE PRODUCTION (`stageScreenPixel`,
 *  dont `stageCamTransform` que le stage rend est l'autre dérivée), jamais une réplique manuscrite. */
function pixelSvg(
  s: { x: number; y: number; h: number },
  dims: Dims,
  cam: { x: number; y: number },
  zoom: number,
  canvas: { w: number; h: number },
): { sx: number; sy: number } {
  return stageScreenPixel(tileCenter(s.x, s.y, dims, metricToLift(s.h)), cam, zoom, canvas);
}

/** Pixel de l'élément rendu par la caméra volumique cadrée depuis le MÊME état de stage. */
function pixelGl(
  s: { x: number; y: number; h: number },
  dims: Dims,
  cam: { x: number; y: number },
  zoom: number,
  canvas: { w: number; h: number },
): { sx: number; sy: number } {
  const f = stage3dFraming({ dims, mpt, cam, zoom, canvas });
  const { camera } = affineCamera(f.kind, f.yawDeg, mpt, f.viewport, { target: new Vector3(f.centre.x, f.centre.y, f.centre.z) });
  return projectToScreen(camera, new Vector3(s.x * mpt, s.h, s.y * mpt), canvas);
}

function ecartMax(dims: Dims, cam: { x: number; y: number }, zoom: number, canvas: { w: number; h: number }): number {
  let pire = 0;
  for (const s of SAMPLES) {
    const a = pixelSvg(s, dims, cam, zoom, canvas);
    const b = pixelGl(s, dims, cam, zoom, canvas);
    pire = Math.max(pire, Math.abs(a.sx - b.sx), Math.abs(a.sy - b.sy));
  }
  return pire;
}

const dimsFor = (rot: Rot, edge: boolean, top = false): Dims => ({
  w: scene.dimensions.w,
  h: scene.dimensions.h,
  rot,
  edge,
  view: top ? 'top' : 'iso',
});

/** La MÊME carte sous lacet LIBRE (#1176, P2-7) : la voie volumique n'a plus de cran, elle a un angle. */
const dimsLibre = (yawDeg: number): Dims => ({ ...dimsFor(0, false), yawDeg });

describe('Caméra volumique du stage — le pixel de l’écran de jeu, pas seulement l’écart', () => {
  const CADRE = { w: 1600, h: 900 };
  const CAM = { x: 137, y: -62 };

  for (const rot of [0, 1, 2, 3] as Rot[])
    for (const edge of [false, true])
      it(`cran ${rot}${edge ? ' edge-on' : ''} : le monde volumique tombe au pixel de la projection SVG`, () => {
        expect(ecartMax(dimsFor(rot, edge), CAM, 1, CADRE)).toBeLessThanOrEqual(TOL);
      });

  // LACET LIBRE : le cas de production de la voie volumique, où le cran ne dit plus rien de l'écran.
  // Ce n'est pas la répétition de `lacet-continu.test.tsx` (qui compare des ÉCARTS à ancrage commun,
  // le pivot annulé de part et d'autre) : ici, l'ANCRAGE lui-même est en jeu — l'overlay SVG et le
  // monde three sont mesurés au pixel ABSOLU de l'élément, depuis le MÊME état de caméra du stage.
  for (const yawDeg of [45, 22.5, 137, -68.25, 312.75])
    it(`lacet libre ${yawDeg}° : le monde volumique et l’overlay SVG partagent leur ancrage`, () => {
      expect(ecartMax(dimsLibre(yawDeg), CAM, 1, CADRE)).toBeLessThanOrEqual(TOL);
    });

  it('…et ce lacet libre DÉPLACE vraiment le pixel (l’ancrage commun n’est pas une projection figée)', () => {
    const p = (dims: Dims) => pixelSvg(SAMPLES[SAMPLES.length - 1], dims, CAM, 1, CADRE);
    const a = p(dimsLibre(0));
    const b = p(dimsLibre(45));
    expect(Math.max(Math.abs(a.sx - b.sx), Math.abs(a.sy - b.sy))).toBeGreaterThan(50);
  });

  it('vue du dessus : même coïncidence (regard vertical, l’élévation ne décale rien)', () => {
    expect(ecartMax(dimsFor(0, false, true), CAM, 1, CADRE)).toBeLessThanOrEqual(TOL);
  });

  it('le ZOOM du store (bornes 0,4 → 2,6) reste au pixel, y compris le creux de transition de cran', () => {
    for (const zoom of [0.4, 0.97, 1, 1.6, 2.6]) expect(ecartMax(dimsFor(1, true), CAM, zoom, CADRE)).toBeLessThanOrEqual(TOL);
  });

  it('le DÉCALAGE manuel (camPan) déplace la cible, jamais l’échelle', () => {
    for (const cam of [{ x: 0, y: 0 }, { x: -400, y: 220 }, { x: 900, y: -510 }])
      expect(ecartMax(dimsFor(2, false), cam, 1.3, CADRE)).toBeLessThanOrEqual(TOL);
  });

  // `preserveAspectRatio="xMidYMid slice"` : le viewBox RECOUVRE l'élément, donc son échelle est le
  // MAX des deux rapports (un `meet` en prendrait le MIN et laisserait des bandes). Les deux valeurs
  // sont ÉPINGLÉES, pas recalculées : un facteur qui alimente les deux côtés d'une égalité y est
  // invariant, et la garde ne mordrait plus.
  //   640×900  → max(640/1100 = 0,5818… ; 900/720 = 1,25)       = 1,25       (la HAUTEUR déborde)
  //   1920×500 → max(1920/1100 = 1,7454… ; 500/720 = 0,6944…)   = 1,7454…    (la LARGEUR déborde)
  it('le recouvrement du viewBox (slice) vaut le MAX des deux rapports — valeurs épinglées', () => {
    expect(viewBoxScale({ w: 640, h: 900 })).toBeCloseTo(1.25, 12);
    expect(viewBoxScale({ w: 1920, h: 500 })).toBeCloseTo(1.7454545454545454, 12);
    expect(viewBoxScale({ w: VW, h: VH })).toBeCloseTo(1, 12);
    // …et le pixel du CENTRE de l'élément est bien celui du centre du viewBox (`xMidYMid`).
    for (const canvas of [{ w: 640, h: 900 }, { w: 1920, h: 500 }]) {
      const p = stageScreenPixel({ cx: VW / 2, cy: VH / 2 }, { x: 0, y: 0 }, 1, canvas);
      expect([p.sx, p.sy]).toEqual([canvas.w / 2, canvas.h / 2]);
    }
  });

  it('le cadre RECOUVRE le viewBox (slice) : un élément plus étroit ou plus large reste au pixel', () => {
    for (const canvas of [{ w: 640, h: 900 }, { w: 1920, h: 500 }, { w: VW, h: VH }])
      expect(ecartMax(dimsFor(3, false), CAM, 1, canvas)).toBeLessThanOrEqual(TOL);
  });

  it('la `transform` CSS que le stage rend EST l’affine que les gardes mesurent (une seule source)', () => {
    for (const [cam, zoom] of [[{ x: 0, y: 0 }, 1], [{ x: 137, y: -62 }, 1.6], [{ x: -400, y: 220 }, 0.97]] as const) {
      const { k, tx, ty } = stageCamAffine(cam, zoom);
      expect(stageCamTransform(cam, zoom)).toBe(`matrix(${k}, 0, 0, ${k}, ${tx}, ${ty})`);
    }
    // Elle vaut EXACTEMENT la chaîne translate·scale·translate·translate qu'elle remplace, au centre
    // du viewBox comme sur un point quelconque.
    const cam = { x: 137, y: -62 };
    const zoom = 1.6;
    const a = stageCamAffine(cam, zoom);
    for (const p of [{ x: VW / 2, y: VH / 2 }, { x: 0, y: 0 }, { x: 903, y: 211 }]) {
      expect(a.k * p.x + a.tx).toBeCloseTo(zoom * (p.x - VW / 2 + cam.x) + VW / 2, 9);
      expect(a.k * p.y + a.ty).toBeCloseTo(zoom * (p.y - VH / 2 + cam.y) + VH / 2, 9);
    }
  });

  it('l’échelle effective EST le zoom × le recouvrement du viewBox (aucun étage d’échelle oublié)', () => {
    const canvas = { w: 1920, h: 500 };
    const f = stage3dFraming({ dims: dimsFor(0, false), mpt, cam: { x: 0, y: 0 }, zoom: 1.5, canvas });
    expect(f.scale).toBeCloseTo(1.5 * Math.max(canvas.w / VW, canvas.h / VH), 12);
    expect(f.viewport.w).toBeCloseTo(canvas.w / f.scale, 12);
    expect(f.viewport.h).toBeCloseTo(canvas.h / f.scale, 12);
  });

  it('le cran du store devient le lacet de la caméra (un cran = un quart de tour)', () => {
    const f = ([0, 1, 2, 3] as Rot[]).map((rot) => stage3dFraming({ dims: dimsFor(rot, false), mpt, cam: { x: 0, y: 0 }, zoom: 1, canvas: CADRE }));
    expect(f.map((x) => x.yawDeg)).toEqual([0, 90, 180, 270]);
    expect(f.map((x) => x.kind)).toEqual(['iso', 'iso', 'iso', 'iso']);
    expect(stage3dFraming({ dims: dimsFor(0, true), mpt, cam: { x: 0, y: 0 }, zoom: 1, canvas: CADRE }).kind).toBe('edge');
    expect(stage3dFraming({ dims: dimsFor(0, false, true), mpt, cam: { x: 0, y: 0 }, zoom: 1, canvas: CADRE }).kind).toBe('top');
  });
});
