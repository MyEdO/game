import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { buildTraceQuad, traceImagePointToScreen, traceQuadCorners, TRACE_LIFT_M } from './traceQuad';
import { affineCamera, projectToScreen } from './cameras';
import { RENDER_ORDER } from './renderRanks';
import { stage3dFramingFor, viewBoxScreen } from '../../stage/stage3dCamera';
import { viewBoxScreenPixel } from '../../stage/stageCam';
import { stageSize, type Dims, type Rot } from '../../../geometry/iso';
import type { TraceTransform } from '../../../ui/editor/traceCalibration';

/**
 * PLAQUE DE DÉCALQUAGE en QUAD MONDE (#1176, P3-3, vague B). Ce qui se prouve : la plaque tombe au
 * MÊME endroit que la surcouche SVG qu'elle remplace — coin pour coin, au pixel — tant que la vue ne
 * tourne pas. Et ce qui CHANGE, volontairement : sous rotation, l'ancrage monde suit la carte là où
 * l'ancrage de contenu du SVG restait cloué à l'écran.
 */
const DIMS = (rot: Rot = 0, view: 'iso' | 'top' = 'iso'): Dims => ({ w: 20, h: 14, rot, edge: false, view });
const MPT = 2;
const IMAGE = { width: 900, height: 600 };
const CALAGE: TraceTransform = { tx: 140, ty: -60, scale: 0.8, rotateDeg: 0 };
const TOL = 1e-6;

/** Le cadre d'écran de l'éditeur, comme au montage (viewBox mobile, échelle mesurée). */
function cadre(dims: Dims) {
  const stage = stageSize(dims);
  const viewBox = { x: 0, y: 0, w: stage.w, h: stage.h };
  const canvas = { w: stage.w, h: stage.h };
  return { viewBox, canvas, f: stage3dFramingFor({ dims, mpt: MPT, screen: viewBoxScreen(viewBox, canvas), canvas }) };
}

describe('Plaque de décalquage — quad MONDE, ancrage prouvé au pixel (#1176, P3-3)', () => {
  it('les quatre coins du quad retombent au pixel des quatre coins de la plaque SVG', () => {
    const dims = DIMS();
    const { viewBox, canvas, f } = cadre(dims);
    const { camera } = affineCamera(f.kind, f.yawDeg, MPT, f.viewport, { target: new Vector3(f.centre.x, f.centre.y, f.centre.z) });
    const coins = traceQuadCorners(CALAGE, IMAGE, dims, MPT);
    const imgCoins = [[0, 0], [IMAGE.width, 0], [IMAGE.width, IMAGE.height], [0, IMAGE.height]] as const;
    coins.forEach((c, i) => {
      // Côté SVG : le coin d'image passe par le `transform` du calque, puis par le viewBox rendu.
      const écran = traceImagePointToScreen(CALAGE, imgCoins[i][0], imgCoins[i][1]);
      const svg = viewBoxScreenPixel({ cx: écran.x, cy: écran.y }, viewBox, canvas);
      // Côté volume : le coin MONDE passe par la caméra de la frame.
      const gl = projectToScreen(camera, new Vector3(c.x, 0, c.z), canvas);
      expect(Math.abs(svg.sx - gl.sx), `coin ${i} en x`).toBeLessThanOrEqual(TOL);
      expect(Math.abs(svg.sy - gl.sy), `coin ${i} en y`).toBeLessThanOrEqual(TOL);
    });
  });

  it('le quad est un PARALLÉLOGRAMME au sol (l’inverse de la projection est affine)', () => {
    const c = traceQuadCorners(CALAGE, IMAGE, DIMS(), MPT);
    // haut-gauche→haut-droit doit égaler bas-gauche→bas-droit : les côtés opposés sont parallèles.
    expect(c[1].x - c[0].x).toBeCloseTo(c[2].x - c[3].x, 9);
    expect(c[1].z - c[0].z).toBeCloseTo(c[2].z - c[3].z, 9);
  });

  /**
   * L'ANCRAGE EST À L'ÉCRAN, comme celui du SVG remplacé — et c'est mesurable des deux côtés : les
   * coins MONDE changent quand la vue tourne (le calage est figé dans le repère de projection), mais
   * le quad rebâti retombe aux MÊMES pixels. Rien n'a changé pour l'auteur ; ce que le lot déplace,
   * c'est la voie qui peint, pas la sémantique du calage.
   */
  it('sous ROTATION : les coins MONDE bougent, les PIXELS ne bougent pas', () => {
    const a = traceQuadCorners(CALAGE, IMAGE, DIMS(0), MPT);
    const b = traceQuadCorners(CALAGE, IMAGE, DIMS(1), MPT);
    expect(Math.hypot(a[0].x - b[0].x, a[0].z - b[0].z)).toBeGreaterThan(1); // le monde, lui, a bougé
    for (const rot of [0, 1, 2, 3] as Rot[]) {
      const dims = DIMS(rot);
      const { viewBox, canvas, f } = cadre(dims);
      const { camera } = affineCamera(f.kind, f.yawDeg, MPT, f.viewport, { target: new Vector3(f.centre.x, f.centre.y, f.centre.z) });
      const coin = traceQuadCorners(CALAGE, IMAGE, dims, MPT)[0];
      const px = projectToScreen(camera, new Vector3(coin.x, 0, coin.z), canvas);
      const attendu = viewBoxScreenPixel(
        { cx: traceImagePointToScreen(CALAGE, 0, 0).x, cy: traceImagePointToScreen(CALAGE, 0, 0).y },
        viewBox,
        canvas,
      );
      expect(Math.abs(px.sx - attendu.sx), `cran ${rot}`).toBeLessThanOrEqual(TOL);
      expect(Math.abs(px.sy - attendu.sy), `cran ${rot}`).toBeLessThanOrEqual(TOL);
    }
  });

  it('la géométrie porte 4 sommets, 2 triangles, et son élévation de mode', () => {
    const sous = buildTraceQuad(CALAGE, IMAGE, DIMS(), MPT, 0);
    expect(sous.getAttribute('position').count).toBe(4);
    expect(sous.getIndex()!.count).toBe(6);
    const y = (g: ReturnType<typeof buildTraceQuad>) => (g.getAttribute('position').array as Float32Array)[1];
    expect(y(sous)).toBe(0);
    expect(y(buildTraceQuad(CALAGE, IMAGE, DIMS(), MPT, TRACE_LIFT_M))).toBeCloseTo(TRACE_LIFT_M, 9);
  });

  it('les deux modes ont leur RANG : la plaque SOUS passe avant la matière, la plaque AU-DESSUS après le chrome des affordances', () => {
    expect(RENDER_ORDER.decalque).toBeLessThan(RENDER_ORDER.monde);
    expect(RENDER_ORDER.chrome).toBeGreaterThan(RENDER_ORDER.pions);
  });
});
