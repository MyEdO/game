/**
 * Calage 2 POINTS d'un calque de référence (planche de livre décalquée dans l'éditeur, #830) —
 * géométrie PURE, aucune dépendance React/DOM, de l'atelier de cartes (`COUCHES` : `state/traceLayer.ts`
 * en lit le type pour sa persistance). Le calque est affiché via une transformation SIMILITUDE
 * (translation + échelle uniforme + rotation), qui se déduit ENTIÈREMENT de deux points repérés sur
 * l'image et du NŒUD de grille correspondant pour chacun (méthode standard des tables virtuelles) :
 * plus de curseurs à tâtonner à la main.
 *
 * ROTATION VERROUILLÉE PAR DÉFAUT (retour user 2026-07-25) : une planche de livre est scannée droite ;
 * déduire un angle de deux clics au pixel près introduit une inclinaison parasite qu'on ne peut plus
 * rattraper à l'œil. Par défaut (`allowRotation` faux), seules translation+échelle sont résolues —
 * `computeLockedTransform` (angle figé à 0). L'option rare d'un scan de travers reste possible
 * (`allowRotation` vrai → `computeTransform`, similitude complète).
 */

export interface CalibPoint {
  x: number;
  y: number;
}

/** Un point de repère : sa position en pixels IMAGE (espace natif, origine coin haut-gauche) + le
 *  NŒUD de grille (intersection, PAS le centre d'une case — les murs vivent sur les arêtes) qu'il
 *  désigne. Coordonnée de nœud = demi-entière dans l'espace-tuile (cf. `nearestNode`), compatible
 *  telle quelle avec `tileCenterOf` (application affine, valable sur des flottants). */
export interface CalibPick {
  img: CalibPoint;
  tile: { x: number; y: number };
}

/** Transformation SVG appliquée au calque : `translate(tx,ty) rotate(rotateDeg) scale(scale)`, donc
 *  un point image `p` atterrit à l'écran en `R(rotateDeg)·scale·p + (tx,ty)`. */
export interface TraceTransform {
  tx: number;
  ty: number;
  scale: number;
  rotateDeg: number;
}

export function identityTransform(): TraceTransform {
  return { tx: 0, ty: 0, scale: 1, rotateDeg: 0 };
}

/** Inverse de la transformation courante : un clic en coordonnées ÉCRAN (viewBox du canevas) → le
 *  point IMAGE qu'il désigne réellement (nécessaire pour ré-étalonner un calque déjà placé — le clic
 *  de calibration tombe sur le calque tel qu'affiché, pas sur l'image brute). */
export function canvasToImagePoint(canvasPt: CalibPoint, t: TraceTransform): CalibPoint {
  const rad = (-t.rotateDeg * Math.PI) / 180;
  const dx = canvasPt.x - t.tx;
  const dy = canvasPt.y - t.ty;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;
  if (t.scale === 0) return { x: 0, y: 0 }; // garde de robustesse (échelle dégénérée, ne devrait jamais survenir)
  return { x: rx / t.scale, y: ry / t.scale };
}

/** Nœud de grille (intersection) le plus proche d'une coordonnée FRACTIONNAIRE en espace-tuile
 *  (`screenToTileF`) — les nœuds sont demi-entiers (`…, -0.5, 0.5, 1.5, …`), à l'image des coins de
 *  case déjà utilisés pour les arêtes de mur (`gc = tileCenter(gx-0.5, gy-0.5, …)` d'`EditorCanvas`).
 *  `Math.floor(v)+0.5` retombe TOUJOURS sur le demi-entier le plus proche (les nœuds sont espacés de
 *  1, chaque réel appartient à exactement un intervalle unité centré sur son nœud). */
export function nearestNode(f: CalibPoint): { x: number; y: number } {
  return { x: Math.floor(f.x) + 0.5, y: Math.floor(f.y) + 0.5 };
}

/**
 * Déduit la transformation COMPLÈTE (translation + échelle + rotation) qui envoie EXACTEMENT
 * `p1.img` sur le centre écran de `p1.tile`, et `p2.img` sur celui de `p2.tile` — la similitude 2
 * points des tables virtuelles. `tileCenterOf` fournit le centre écran d'une case (dépend de la
 * projection/rotation de caméra courante : iso losange ou plan carré, les deux étant des
 * applications AFFINES de la case vers l'écran, donc valables ici indifféremment). RÉSERVÉ au mode
 * `allowRotation` — le mode par défaut verrouillé passe par `computeLockedTransform`.
 */
export function computeTransform(
  p1: CalibPick,
  p2: CalibPick,
  tileCenterOf: (x: number, y: number) => { cx: number; cy: number },
): TraceTransform {
  const q1 = tileCenterOf(p1.tile.x, p1.tile.y);
  const q2 = tileCenterOf(p2.tile.x, p2.tile.y);
  const dpx = p2.img.x - p1.img.x;
  const dpy = p2.img.y - p1.img.y;
  const dqx = q2.cx - q1.cx;
  const dqy = q2.cy - q1.cy;
  const distP = Math.hypot(dpx, dpy);
  if (distP < 1e-6) return identityTransform(); // 2 points confondus : rien à en déduire, repli neutre
  const scale = Math.hypot(dqx, dqy) / distP;
  const rotateRad = Math.atan2(dqy, dqx) - Math.atan2(dpy, dpx);
  const rotateDeg = (rotateRad * 180) / Math.PI;
  const cos = Math.cos(rotateRad);
  const sin = Math.sin(rotateRad);
  const rx = p1.img.x * cos - p1.img.y * sin;
  const ry = p1.img.x * sin + p1.img.y * cos;
  return { tx: q1.cx - scale * rx, ty: q1.cy - scale * ry, scale, rotateDeg };
}

/**
 * Déduit la transformation VERROUILLÉE (angle figé à 0, translation + échelle SEULES) — mode par
 * DÉFAUT (#830 suite, retour user 2026-07-25). Sans rotation, les 2 points SURDÉTERMINENT le système
 * (4 équations, 3 inconnues) : on résout au MIEUX plutôt qu'en ancrant exactement le 1er point (ce qui
 * ferait pivoter toute erreur de clic autour de lui) — l'échelle vient de la DISTANCE entre les deux
 * points (seule grandeur qu'une rotation ne changerait pas), la translation cale le MILIEU image sur
 * le milieu écran : une imprécision de quelques pixels au clic se RÉPARTIT symétriquement au lieu
 * d'incliner l'image.
 */
export function computeLockedTransform(
  p1: CalibPick,
  p2: CalibPick,
  tileCenterOf: (x: number, y: number) => { cx: number; cy: number },
): TraceTransform {
  const q1 = tileCenterOf(p1.tile.x, p1.tile.y);
  const q2 = tileCenterOf(p2.tile.x, p2.tile.y);
  const dpx = p2.img.x - p1.img.x;
  const dpy = p2.img.y - p1.img.y;
  const dqx = q2.cx - q1.cx;
  const dqy = q2.cy - q1.cy;
  const distP = Math.hypot(dpx, dpy);
  if (distP < 1e-6) return identityTransform(); // 2 points confondus : rien à en déduire, repli neutre
  const scale = Math.hypot(dqx, dqy) / distP;
  const midImg = { x: (p1.img.x + p2.img.x) / 2, y: (p1.img.y + p2.img.y) / 2 };
  const midScreen = { x: (q1.cx + q2.cx) / 2, y: (q1.cy + q2.cy) / 2 };
  return { tx: midScreen.x - scale * midImg.x, ty: midScreen.y - scale * midImg.y, scale, rotateDeg: 0 };
}

/** Étape courante du calage 2 points (machine à états linéaire, jamais de retour arrière implicite —
 *  `idle` (ou `Escape`/annulation) remet à zéro). */
export type CalibStep = 'idle' | 'image1' | 'tile1' | 'image2' | 'tile2';

export interface CalibProgress {
  step: CalibStep;
  img1?: CalibPoint;
  tile1?: { x: number; y: number };
  img2?: CalibPoint;
}

export const CALIB_INSTRUCTIONS: Record<Exclude<CalibStep, 'idle'>, string> = {
  image1: 'Cliquez un 1ᵉʳ coin repérable sur l’image (angle de mur, coin de bâtiment)',
  tile1: 'Cliquez l’intersection de la grille qui correspond à ce coin',
  image2: 'Cliquez un 2ᵉ coin repérable sur l’image, loin du premier',
  tile2: 'Cliquez l’intersection de la grille qui correspond à ce 2ᵉ coin',
};

/**
 * Fait avancer la machine à états d'un clic de calibration (coordonnées ÉCRAN). Retourne l'état
 * suivant et, une fois les 2 points complets, la transformation déduite (`transform`) — sinon
 * `undefined` tant que le calage n'est pas achevé. `allowRotation` (faux par défaut) choisit
 * `computeLockedTransform` (angle 0) vs `computeTransform` (similitude complète, scan de travers).
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
      const tile2 = tileFromScreen(canvasPt);
      const p1: CalibPick = { img: progress.img1, tile: progress.tile1 };
      const p2: CalibPick = { img: progress.img2, tile: tile2 };
      const transform = allowRotation ? computeTransform(p1, p2, tileCenterOf) : computeLockedTransform(p1, p2, tileCenterOf);
      return { progress: { step: 'idle' }, transform };
    }
    case 'idle':
    default:
      return { progress };
  }
}
