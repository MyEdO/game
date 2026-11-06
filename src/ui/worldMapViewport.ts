/**
 * Géométrie PURE de la caméra de la carte du monde (`WorldMapView`) — cadre logique du viewBox,
 * zoom/pan bornés, et cadrage initial « fit-to-content » (ref #234 : aucune route authorée ne doit
 * naître masquée sous la bordure décorative, quelle que soit la worldMap).
 */
import { CADRE } from '../noyau/worldMap';

export const VB_W = CADRE.w, VB_H = CADRE.h;
export const Z_MIN = 1, Z_MAX = 4;

/** Vue caméra de la carte : zoom `z` + translation `panX/panY` (unités viewBox). Le CONTENU est
 *  transformé par `translate(panX panY) scale(z)` ; le parchemin reste plein cadre. */
export interface Viewport { z: number; panX: number; panY: number }

/** Borne le pan pour garder le contenu à l'écran : à `z`, le contenu couvre `VB_*·z` ; on autorise
 *  un débordement translaté dans `[VB_*·(1−z), 0]` (jamais de vide d'un côté au-delà du cadre). */
export function clampViewport(v: Viewport): Viewport {
  const z = Math.min(Z_MAX, Math.max(Z_MIN, v.z));
  const minX = VB_W * (1 - z), minY = VB_H * (1 - z);
  return {
    z,
    panX: Math.min(0, Math.max(minX, v.panX)),
    panY: Math.min(0, Math.max(minY, v.panY)),
  };
}

/** Vue centrée+zoomée sur un point logique `(cx, cy)` (unités viewBox) à un zoom donné. */
export function viewOn(cx: number, cy: number, z: number): Viewport {
  return clampViewport({ z, panX: VB_W / 2 - cx * z, panY: VB_H / 2 - cy * z });
}

/** Marge SCREEN-CONSTANTE (unités viewBox À L'ÉCRAN, indépendantes du zoom : lieux et badges sont
 *  rendus en `scale(1/z)`) réservée entre un point cadré et le bord du parchemin — cadre orné
 *  (~3.1) + demi-largeur d'un badge de route (rect 10 + icône ≈ 8) / cartouche de lieu (≈ 5). */
const FIT_MARGIN_X = 12, FIT_MARGIN_Y = 8;

/**
 * Cadrage initial qui englobe TOUS les `points` fournis (lieux ET milieux d'étiquette de route,
 * en coordonnées de RENDU) — le zoom par défaut ne les cadre QUE s'ils y tiennent déjà ; sinon on
 * dézoome juste assez pour les faire rentrer (jamais plus serré que `fallback.z`, jamais en dehors
 * de `[Z_MIN, Z_MAX]`). Sans point (lieu isolé, aucune route), repli sur le cadrage par défaut.
 */
export function fitViewport(
  points: { x: number; y: number }[],
  fallback: { x: number; y: number; z: number },
): Viewport {
  if (points.length === 0) return viewOn(fallback.x, fallback.y, fallback.z);
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 0.001), spanY = Math.max(maxY - minY, 0.001);
  const zx = (VB_W - 2 * FIT_MARGIN_X) / spanX;
  const zy = (VB_H - 2 * FIT_MARGIN_Y) / spanY;
  const z = Math.max(Z_MIN, Math.min(fallback.z, zx, zy));
  return clampViewport({
    z,
    panX: VB_W / 2 - ((minX + maxX) / 2) * z,
    panY: VB_H / 2 - ((minY + maxY) / 2) * z,
  });
}
