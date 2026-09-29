/**
 * TRANSFORMATION D'ÉCRAN du stage — source UNIQUE de la chaîne « point de viewBox → pixel de
 * l'élément » que le stage SVG applique, et dont la caméra volumique (`stage3dCamera.ts`) est la
 * traduction. Module PUR : aucun `three`, aucun DOM, aucun store.
 *
 * Deux étages, jamais recopiés ailleurs :
 *  1. CAMÉRA du groupe (pan/zoom, unités de viewBox) — `SurcoucheIso` la pose en `transform` CSS ;
 *  2. RECOUVREMENT du viewBox (`preserveAspectRatio="xMidYMid slice"` de `.iso-stage`) : le viewBox
 *     `0 0 VW VH` RECOUVRE l'élément, donc son échelle est le MAX des deux rapports (un `meet` en
 *     prendrait le min) et son centre coïncide avec le centre de l'élément (`xMidYMid`).
 *
 * `stageCamTransform` (la CSS que le stage rend, par `stageCamStyle`) et `stageScreenPixel` (le pixel que les gardes
 * mesurent) DÉRIVENT toutes deux de `stageCamAffine` : une retouche de l'une ne peut pas laisser
 * l'autre en arrière. Le PICKING remonte la même chaîne à l'envers (`viewBoxPointAt` puis
 * `stagePointAt`) — pixel de l'élément → point de projection — sans jamais interroger un CTM de SVG,
 * que la voie volumique n'a pas.
 */
import type { Dims } from '../../geometry/iso';
import { poseFromDims, screenToWorldAtLift, worldToScreen } from './projection';
import { VH, VW } from './useStageCamera';
import { ECHELLE_ECRAN } from '../echelleEcran';

/** Cadre en pixels CSS de la surface de rendu. */
export interface StageCanvas {
  w: number;
  h: number;
}

/** Affine viewBox→viewBox du groupe caméra : `q = k·p + t`. */
export interface StageCamAffine {
  k: number;
  tx: number;
  ty: number;
}

/** Caméra du groupe : zoom APPLIQUÉ (creux de transition de cran compris) autour du CENTRE du viewBox,
 *  puis translation `cam` (unités de viewBox). Soit `q = k·(p − C + cam) + C`. */
export function stageCamAffine(cam: { x: number; y: number }, zoom: number): StageCamAffine {
  return {
    k: zoom,
    tx: zoom * cam.x + (1 - zoom) * (VW / 2),
    ty: zoom * cam.y + (1 - zoom) * (VH / 2),
  };
}

/** La `transform` CSS du groupe caméra du stage — l'affine ci-dessus, écrite en `matrix()` (ses deux
 *  derniers termes sont des px, comme les `translate` qu'elle remplace). */
export function stageCamTransform(cam: { x: number; y: number }, zoom: number): string {
  const { k, tx, ty } = stageCamAffine(cam, zoom);
  return `matrix(${k}, 0, 0, ${k}, ${tx}, ${ty})`;
}

/** STYLE portant l'échelle écran `k` (px par unité de viewBox) d'un groupe SVG — seul compositeur de
 *  `ECHELLE_ECRAN`, que lisent les planchers des traits de la vue du dessus. */
export function styleDEchelleEcran(k: number): { [ECHELLE_ECRAN]: string } {
  return { [ECHELLE_ECRAN]: String(k) };
}

/** STYLE du groupe caméra du stage — SEUL écrivain de sa `transform` et de son échelle écran
 *  (`viewBoxUnitPx`). `apres` = transformation d'écran composée APRÈS la caméra (`stageYawCorrection`). */
export function stageCamStyle(cam: { x: number; y: number }, zoom: number, canvas: StageCanvas, apres = ''): { transform: string; [ECHELLE_ECRAN]: string } {
  return { transform: `${stageCamTransform(cam, zoom)} ${apres}`.trim(), ...styleDEchelleEcran(viewBoxUnitPx(zoom, canvas)) };
}

/**
 * REPROJECTION D'ÉCRAN d'un lacet qui a AVANCÉ depuis le dernier rendu (#1403). Les overlays SVG sont
 * projetés au lacet du COMMIT (`Dims.yawDeg`, relu à chaque rendu), le monde volumique tourne à
 * l'IMAGE : entre deux commits, ce facteur remet les uns sur l'autre, et le commit suivant reprojette
 * exactement.
 *
 * C'est l'affine qui envoie un point de projection du lacet `rendu` sur son homologue du lacet `vif`
 * AU SOL : `worldToScreen` étant affine en la case à lift constant, elle se lit entièrement sur l'image
 * de l'origine et des deux vecteurs unitaires d'écran. Ce qui est ÉLEVÉ y est emporté comme le sol —
 * son décalage écran vertical ne dépend pas du lacet (cf. `stage/projection.ts`) : là est
 * l'approximation, bornée par le quart de tour et soldée à chaque COMMIT (franchissement de cran,
 * départ et arrêt du régime, pose au pointeur) — elle ne vit donc que le temps d'un maintien entre
 * deux crans. Mesurée : `stage/walk-frame-loop.test.tsx`.
 *
 * Chaîne VIDE quand les deux lacets coïncident : hors rotation, le groupe ne porte que sa caméra.
 */
export function stageYawCorrection(rendu: Dims, vif: Dims): string {
  const poseRendu = poseFromDims(rendu);
  const poseVif = poseFromDims(vif);
  if (poseRendu.yawDeg === poseVif.yawDeg) return '';
  const image = (x: number, y: number) => {
    const w = screenToWorldAtLift(poseRendu, { x, y }, 0);
    return worldToScreen(poseVif, { x: w.x, y: w.y });
  };
  const o = image(0, 0);
  const ex = image(1, 0);
  const ey = image(0, 1);
  return `matrix(${ex.x - o.x}, ${ex.y - o.y}, ${ey.x - o.x}, ${ey.y - o.y}, ${o.x}, ${o.y})`;
}

/** Facteur du `preserveAspectRatio="xMidYMid slice"` de `.iso-stage` : le viewBox RECOUVRE l'élément,
 *  donc MAX des deux rapports (`meet` en prendrait le min, et laisserait des bandes). */
export function viewBoxScale(canvas: StageCanvas): number {
  return Math.max(canvas.w / VW, canvas.h / VH);
}

/** PIXELS ÉCRAN que vaut UNE unité de viewBox pour ce qui vit DANS le groupe caméra : les deux étages
 *  de la chaîne, la caméra du groupe (`k`) puis le recouvrement du viewBox — le même facteur que
 *  `stageScreenPixel` applique aux distances. Ce qui doit rester à TAILLE ÉCRAN dans ce groupe (chrome
 *  cliquable) s'en contre-échelonne ; sans quoi une cible de 44 unités ne mesure que 39 px à 1280×720
 *  et 15,6 px à zoom 0,4. */
export function viewBoxUnitPx(zoom: number, canvas: StageCanvas): number {
  return stageCamAffine({ x: 0, y: 0 }, zoom).k * viewBoxScale(canvas);
}

/** VIEWBOX MOBILE — la seconde convention du dépôt (`ui/editor/EditorCanvas.tsx` : viewBox de taille
 *  variable `${vb.x} ${vb.y} ${w/zoom} ${h/zoom}`, `preserveAspectRatio` par DÉFAUT donc
 *  `xMidYMid meet`). Le rectangle rendu est le viewBox lui-même, à l'échelle MIN des deux rapports
 *  (le `meet` tient le viewBox ENTIER dans l'élément ; le `slice` du jeu, lui, le recouvre). */
export function viewBoxMeetScale(viewBox: { w: number; h: number }, canvas: StageCanvas): number {
  return Math.min(canvas.w / viewBox.w, canvas.h / viewBox.h);
}

/** Pixel de l'ÉLÉMENT où tombe un point de PROJECTION `p` sous un VIEWBOX MOBILE (`meet` centré,
 *  `xMidYMid`) : aucune caméra de groupe à défaire — le viewBox EST le cadrage. */
export function viewBoxScreenPixel(
  p: { cx: number; cy: number },
  viewBox: { x: number; y: number; w: number; h: number },
  canvas: StageCanvas,
): { sx: number; sy: number } {
  const s = viewBoxMeetScale(viewBox, canvas);
  return {
    sx: (p.cx - (viewBox.x + viewBox.w / 2)) * s + canvas.w / 2,
    sy: (p.cy - (viewBox.y + viewBox.h / 2)) * s + canvas.h / 2,
  };
}

/** Pixel de l'ÉLÉMENT où tombe un point de viewBox `p` (typiquement la sortie de `tileCenter`) :
 *  caméra du groupe, puis recouvrement du viewBox centré (`xMidYMid`). */
export function stageScreenPixel(
  p: { cx: number; cy: number },
  cam: { x: number; y: number },
  zoom: number,
  canvas: StageCanvas,
): { sx: number; sy: number } {
  const { k, tx, ty } = stageCamAffine(cam, zoom);
  const s = viewBoxScale(canvas);
  return {
    sx: (k * p.cx + tx - VW / 2) * s + canvas.w / 2,
    sy: (k * p.cy + ty - VH / 2) * s + canvas.h / 2,
  };
}

/** Point de VIEWBOX sous un pixel de l'ÉLÉMENT — premier étage de l'inverse de `stageScreenPixel`
 *  (recouvrement `slice` centré, seul). C'est le repère qu'un `getScreenCTM()` de SVG rendait ; il ne
 *  se lit plus d'un CTM, parce qu'un CANEVAS n'en a pas et que les deux voies doivent inverser la MÊME
 *  chaîne. `px` est relatif au coin haut-gauche de l'élément. */
export function viewBoxPointAt(px: { sx: number; sy: number }, canvas: StageCanvas): { x: number; y: number } {
  const s = viewBoxScale(canvas);
  return {
    x: (px.sx - canvas.w / 2) / s + VW / 2,
    y: (px.sy - canvas.h / 2) / s + VH / 2,
  };
}

/** Point de PROJECTION (le repère de `tileCenter`/`worldToScreen`) sous un point de viewBox — second
 *  étage de l'inverse : la caméra du groupe défaite, `p = (q − t)/k`. */
export function stagePointAt(
  q: { x: number; y: number },
  cam: { x: number; y: number },
  zoom: number,
): { x: number; y: number } {
  const { k, tx, ty } = stageCamAffine(cam, zoom);
  return { x: (q.x - tx) / k, y: (q.y - ty) / k };
}
