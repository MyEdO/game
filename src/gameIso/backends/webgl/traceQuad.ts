/**
 * PLAQUE DE DÉCALQUAGE au MONDE (#1176, P3-3, vague B) — la planche que l'auteur cale sous sa carte
 * (`ui/editor`, #830), portée de la surcouche SVG au volume.
 *
 * ANCRAGE : ÉCRAN, comme la surcouche SVG qu'elle remplace — la sémantique ne change PAS. Le calage
 * (`ui/editor/traceCalibration.ts`) fige un `transform` dans le repère de PROJECTION, pas dans le monde :
 * les coins MONDE calculés ici en sont l'INVERSE par la projection COURANTE, donc ils se déplacent
 * quand la vue tourne (mesuré : 62,17 m d'écart à un cran) et le quad se rebâtit à chaque changement
 * de cadrage pour retomber aux MÊMES pixels. La plaque reste donc collée à l'écran, exactement comme
 * avant. Un ancrage MONDE véritable (la planche figée sur ses cases, qui tournerait avec la carte)
 * demanderait de caler en coordonnées de grille : c'est une amélioration à part, pas ce lot.
 *
 * MÉTHODE : le calage donne l'image en pixels ÉCRAN (repère de `worldToScreen`). Trois coins suffisent
 * à retrouver le quadrilatère MONDE — l'inverse de la projection est affine (`screenToWorldAtLift`),
 * donc un rectangle image devient un PARALLÉLOGRAMME au sol, exactement celui que le SVG dessinait.
 * Le quad est posé au niveau 0 (le sol de la carte), la hauteur du relief ne le porte pas : c'est un
 * plan de référence, pas une surface de terrain.
 */
import * as THREE from 'three';
import type { Dims } from '../../../geometry/iso';
import { poseFromDims, screenToWorldAtLift } from '../../stage/projection';
import type { TraceTransform } from '../../../ui/editor/traceCalibration';

/** Coin de l'image (pixels natifs) → pixel ÉCRAN, par la MÊME transformation que le `<g>` SVG :
 *  `translate(tx,ty) rotate(deg) scale(k)`, appliquée dans cet ordre (droite à gauche sur le point). */
export function traceImagePointToScreen(t: TraceTransform, px: number, py: number): { x: number; y: number } {
  const a = (t.rotateDeg * Math.PI) / 180;
  const sx = px * t.scale;
  const sy = py * t.scale;
  return { x: t.tx + sx * Math.cos(a) - sy * Math.sin(a), y: t.ty + sx * Math.sin(a) + sy * Math.cos(a) };
}

/** Les QUATRE coins MONDE (mètres, repère three : X est, Z sud) de la plaque, dans l'ordre
 *  haut-gauche, haut-droit, bas-droit, bas-gauche de l'IMAGE. PUR. */
export function traceQuadCorners(
  t: TraceTransform,
  image: { width: number; height: number },
  dims: Dims,
  mpt: number,
): { x: number; z: number }[] {
  const pose = poseFromDims(dims);
  return ([[0, 0], [image.width, 0], [image.width, image.height], [0, image.height]] as const).map(([px, py]) => {
    const écran = traceImagePointToScreen(t, px, py);
    const tuile = screenToWorldAtLift(pose, écran, 0);
    return { x: tuile.x * mpt, z: tuile.y * mpt };
  });
}

/** ÉLÉVATION de la plaque au-dessus du sol (m) : de quoi ne pas rivaliser en profondeur avec la nappe
 *  de terrain du rez lorsqu'elle est posée AU-DESSUS, sans décoller visiblement du plan. */
export const TRACE_LIFT_M = 0.02;

/**
 * Géométrie de la plaque : deux triangles sur les quatre coins monde, UV de l'image. `lift` = 0 pour
 * le mode SOUS (le sol la couvrira là où il en écrit un — cf. `renderRanks`), un cheveu au-dessus du
 * sol pour le mode AU-DESSUS.
 */
export function buildTraceQuad(
  t: TraceTransform,
  image: { width: number; height: number },
  dims: Dims,
  mpt: number,
  liftM = 0,
): THREE.BufferGeometry {
  const c = traceQuadCorners(t, image, dims, mpt);
  const pos = new Float32Array(4 * 3);
  c.forEach((p, i) => {
    pos[i * 3] = p.x;
    pos[i * 3 + 1] = liftM;
    pos[i * 3 + 2] = p.z;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2));
  geo.setIndex([0, 2, 1, 0, 3, 2]);
  geo.computeVertexNormals();
  return geo;
}
