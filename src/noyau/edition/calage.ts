/**
 * LE CALAGE DEUX POINTS D'UN CALQUE DE RÉFÉRENCE (#830, #3508), une planche de livre décalquée dans l'éditeur de carte :
 * géométrie pure. Le calque se pose par une similitude (translation, échelle uniforme, rotation) qui se déduit de deux
 * points repérés sur l'image et du nœud de grille qui correspond à chacun. Le repère d'arrivée est celui que nomme
 * `tileCenterOf` : l'écran du canevas web, ou la carte elle-même pour l'éditeur Godot (`./calque`).
 *
 * Rotation verrouillée par défaut (retour user 2026-07-25) : sans `allowRotation`, seules la translation et l'échelle
 * se résolvent (`computeLockedTransform`) ; avec, la similitude complète (`computeTransform`).
 */

export interface CalibPoint {
  x: number;
  y: number;
}

/** Un point de repère : sa position en pixels de l'image (origine au coin haut-gauche) et le nœud de grille qu'il
 *  désigne, un coin de case et jamais son centre (les murs vivent sur les arêtes) : demi-entier dans le repère des cases
 *  (`nearestNode`). */
export interface CalibPick {
  img: CalibPoint;
  tile: { x: number; y: number };
}

/** La similitude du calque, `translate(tx, ty) rotate(rotateDeg) scale(scale)` : un point image `p` arrive en
 *  `R(rotateDeg)·scale·p + (tx, ty)` (`pointDeLImage`). */
export interface TraceTransform {
  tx: number;
  ty: number;
  scale: number;
  rotateDeg: number;
}

export function identityTransform(): TraceTransform {
  return { tx: 0, ty: 0, scale: 1, rotateDeg: 0 };
}

/** Le point d'arrivée du point image (`px`, `py`) par la transformation `t`. */
export function pointDeLImage(t: TraceTransform, px: number, py: number): CalibPoint {
  const a = (t.rotateDeg * Math.PI) / 180;
  const sx = px * t.scale;
  const sy = py * t.scale;
  return { x: t.tx + sx * Math.cos(a) - sy * Math.sin(a), y: t.ty + sx * Math.sin(a) + sy * Math.cos(a) };
}

/** Le point image qu'un point d'arrivée désigne par la transformation `t`, son inverse : le clic de calage tombe sur
 *  le calque tel qu'il est posé, pas sur l'image brute. */
export function canvasToImagePoint(canvasPt: CalibPoint, t: TraceTransform): CalibPoint {
  const rad = (-t.rotateDeg * Math.PI) / 180;
  const dx = canvasPt.x - t.tx;
  const dy = canvasPt.y - t.ty;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: (dx * cos - dy * sin) / t.scale, y: (dx * sin + dy * cos) / t.scale };
}

/** Le nœud de grille le plus proche du point `f`, en cases continues (une case centrée sur l'entier) : ses coordonnées
 *  sont demi-entières, `floor(v) + 0.5`. */
export function nearestNode(f: CalibPoint): { x: number; y: number } {
  return { x: Math.floor(f.x) + 0.5, y: Math.floor(f.y) + 0.5 };
}

/** L'écart sous lequel deux points du calage sont confondus. */
const CONFONDUS = 1e-6;

/**
 * La similitude complète (translation, échelle, rotation) qui envoie exactement `p1.img` sur le centre de `p1.tile` et
 * `p2.img` sur celui de `p2.tile` (`tileCenterOf`, une application affine de la case vers le repère d'arrivée) ;
 * `null` si les deux points image, ou les deux nœuds, sont confondus. Réservée au calage qui déduit une rotation.
 */
export function computeTransform(
  p1: CalibPick,
  p2: CalibPick,
  tileCenterOf: (x: number, y: number) => { cx: number; cy: number },
): TraceTransform | null {
  const q1 = tileCenterOf(p1.tile.x, p1.tile.y);
  const q2 = tileCenterOf(p2.tile.x, p2.tile.y);
  const dpx = p2.img.x - p1.img.x;
  const dpy = p2.img.y - p1.img.y;
  const dqx = q2.cx - q1.cx;
  const dqy = q2.cy - q1.cy;
  const distP = Math.hypot(dpx, dpy);
  const distQ = Math.hypot(dqx, dqy);
  if (distP < CONFONDUS || distQ < CONFONDUS) return null;
  const scale = distQ / distP;
  const rotateRad = Math.atan2(dqy, dqx) - Math.atan2(dpy, dpx);
  const rotateDeg = (rotateRad * 180) / Math.PI;
  const cos = Math.cos(rotateRad);
  const sin = Math.sin(rotateRad);
  const rx = p1.img.x * cos - p1.img.y * sin;
  const ry = p1.img.x * sin + p1.img.y * cos;
  return { tx: q1.cx - scale * rx, ty: q1.cy - scale * ry, scale, rotateDeg };
}

/**
 * La transformation à angle nul (translation et échelle) du calage par défaut (retour user 2026-07-25), `null` si les
 * points sont confondus. Deux points surdéterminent ses trois inconnues : l'échelle vient de la distance entre eux,
 * la translation cale le milieu image sur le milieu d'arrivée, et l'imprécision d'un clic se répartit sur les deux
 * points au lieu d'incliner l'image.
 */
export function computeLockedTransform(
  p1: CalibPick,
  p2: CalibPick,
  tileCenterOf: (x: number, y: number) => { cx: number; cy: number },
): TraceTransform | null {
  const q1 = tileCenterOf(p1.tile.x, p1.tile.y);
  const q2 = tileCenterOf(p2.tile.x, p2.tile.y);
  const distP = Math.hypot(p2.img.x - p1.img.x, p2.img.y - p1.img.y);
  const distQ = Math.hypot(q2.cx - q1.cx, q2.cy - q1.cy);
  if (distP < CONFONDUS || distQ < CONFONDUS) return null;
  const scale = distQ / distP;
  const midImg = { x: (p1.img.x + p2.img.x) / 2, y: (p1.img.y + p2.img.y) / 2 };
  const midScreen = { x: (q1.cx + q2.cx) / 2, y: (q1.cy + q2.cy) / 2 };
  return { tx: midScreen.x - scale * midImg.x, ty: midScreen.y - scale * midImg.y, scale, rotateDeg: 0 };
}

/** L'étape du calage : un point sur l'image, son nœud, un second point, son nœud ; `idle` hors du calage. */
export type CalibStep = 'idle' | 'image1' | 'tile1' | 'image2' | 'tile2';

export interface CalibProgress {
  step: CalibStep;
  img1?: CalibPoint;
  tile1?: { x: number; y: number };
  img2?: CalibPoint;
}

/**
 * Le calage `progress` avancé d'un clic au point `canvasPt` du repère d'arrivée, le calque posé par `current` : l'étape
 * suivante et, au second nœud, la transformation déduite (`computeTransform` si `allowRotation`, sinon
 * `computeLockedTransform`), aucune si ses points sont confondus.
 */
export function advanceCalibration(
  progress: CalibProgress,
  canvasPt: CalibPoint,
  current: TraceTransform,
  tileFromScreen: (pt: CalibPoint) => { x: number; y: number },
  tileCenterOf: (x: number, y: number) => { cx: number; cy: number },
  allowRotation = false,
): { progress: CalibProgress; transform?: TraceTransform } {
  switch (progress.step) {
    case 'image1':
      return { progress: { step: 'tile1', img1: canvasToImagePoint(canvasPt, current) } };
    case 'tile1':
      if (!progress.img1) return { progress: { step: 'image1' } };
      return { progress: { step: 'image2', img1: progress.img1, tile1: tileFromScreen(canvasPt) } };
    case 'image2':
      if (!progress.img1 || !progress.tile1) return { progress: { step: 'image1' } };
      return {
        progress: { step: 'tile2', img1: progress.img1, tile1: progress.tile1, img2: canvasToImagePoint(canvasPt, current) },
      };
    case 'tile2': {
      if (!progress.img1 || !progress.tile1 || !progress.img2) return { progress: { step: 'image1' } };
      const p1: CalibPick = { img: progress.img1, tile: progress.tile1 };
      const p2: CalibPick = { img: progress.img2, tile: tileFromScreen(canvasPt) };
      const transform = allowRotation ? computeTransform(p1, p2, tileCenterOf) : computeLockedTransform(p1, p2, tileCenterOf);
      return transform ? { progress: { step: 'idle' }, transform } : { progress: { step: 'idle' } };
    }
    case 'idle':
      return { progress };
  }
}
