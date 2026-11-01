/**
 * Mathématique PURE des BILLBOARDS de décor en quads texturés.
 * Node-safe : aucune dépendance DOM/three ici, tout le décisionnel (taille monde, sélection de vue,
 * ancrage, palier de rasterisation) vit dans ce module ; `svgTexture.ts` n'est qu'une couture navigateur.
 *
 * Le SVG reste la source de vérité de l'art (`propSvg`) : ce module ne dessine rien.
 */
import { BB_W, BB_H, ENT_H_M, PROP_H_M } from '../../pov/billboardCore';
import { project, facingView, type View } from '../../facing';
import { povView } from '../../pov/camera';
import { DIR8_DELTA, type Dir8 } from '../../../geometry/dir8';
import { type Rot } from '../../../geometry/iso';

// ————————————————————————————————————————————————————————————————
// 1. TAILLE MONDE (#1160)
// ————————————————————————————————————————————————————————————————

/** Hauteur de référence de l'échelle du moteur (m). #1160. */
export const JEU_ENT_H_M = 2.3;

/** Échelle des décors du moteur par rapport au métrique. */
export const JEU_SCALE = JEU_ENT_H_M / ENT_H_M;

/** Hauteur MONDE (m) d'un billboard de décor, à échelle 1 dans sa boîte canonique. #1160. */
export const BILLBOARD_H_M = PROP_H_M * JEU_SCALE;

// ————————————————————————————————————————————————————————————————
// 2. SÉLECTION DE VUE — délégation aux DEUX résolveurs de prod, aucun seuil recopié (#1161)
// ————————————————————————————————————————————————————————————————

/** Caméra du monde volumique : `ortho` = familles top/iso/edge (lacet RÉEL en degrés, les crans de production en
 *  sont les multiples de 90°), `perspective` = famille POV. */
export type BillboardCamera =
  | { kind: 'ortho'; yawDeg: number }
  | { kind: 'perspective'; fwd: { x: number; y: number }; right: { x: number; y: number } };

/**
 * Vue + miroir d'un billboard : reproduit ce que fait CHAQUE famille de caméra aujourd'hui —
 * ortho → `project` (`facing.ts`), perspective → `povView` (`pov/camera.ts`).
 */
export function billboardView(cam: BillboardCamera, entFacing: Dir8): { view: View; mirror: boolean } {
  return cam.kind === 'ortho'
    ? orthoView(cam.yawDeg, entFacing)
    : povView(cam.fwd, cam.right, entFacing);
}

/** Vue ortho à un lacet RÉEL. Multiple de 90° : délégation ENTIÈRE à `project` (le résolveur de cran de
 *  la prod). Entre deux crans : le delta d'orientation est tourné du même lacet, puis remis au MÊME juge
 *  d'écran `facingView` — aucun seuil recopié, aucune table de vue propre au volumique. */
function orthoView(yawDeg: number, entFacing: Dir8): { view: View; mirror: boolean } {
  const quarts = yawDeg / 90;
  if (Number.isInteger(quarts)) return project(entFacing, ((((quarts % 4) + 4) % 4) as Rot));
  const a = (yawDeg * Math.PI) / 180;
  const d = DIR8_DELTA[entFacing];
  const gx = d.gx * Math.cos(a) + d.gy * Math.sin(a);
  const gy = -d.gx * Math.sin(a) + d.gy * Math.cos(a);
  return facingView(gx - gy, gx + gy);
}

// ————————————————————————————————————————————————————————————————
// 3. ANCRAGE — quad face caméra, pieds au sol
// ————————————————————————————————————————————————————————————————

/** Aspect (l/h) de la boîte locale de décor (`catalog/decor` : 120×150, pieds en (60,150)). */
export const BILLBOARD_BOX_ASPECT = BB_W / BB_H;

/** Quad d'un billboard, exprimé dans le plan face-caméra (u = droite écran, v = haut monde),
 *  en MÈTRES relatifs à l'ancre PIEDS (0,0). */
export interface BillboardQuad {
  widthM: number;
  heightM: number;
  /** Centre du quad au-dessus de l'ancre pieds (m) — position du plan `PlaneGeometry`. */
  centerLiftM: number;
  /** Coins BL, BR, TR, TL (u,v) en mètres depuis l'ancre pieds. */
  corners: [[number, number], [number, number], [number, number], [number, number]];
}

/** Géométrie d'un quad de hauteur `heightM` et d'aspect `aspectRatio` (l/h de la boîte SVG source),
 *  centré horizontalement sur l'ancre, base posée dessus. */
export function anchorAndSize(heightM: number, aspectRatio: number): BillboardQuad {
  if (!(heightM > 0) || !(aspectRatio > 0)) {
    throw new Error(`anchorAndSize: hauteur/aspect invalides (${heightM}, ${aspectRatio})`);
  }
  const widthM = heightM * aspectRatio;
  const hw = widthM / 2;
  return {
    widthM,
    heightM,
    centerLiftM: heightM / 2,
    corners: [
      [-hw, 0],
      [hw, 0],
      [hw, heightM],
      [-hw, heightM],
    ],
  };
}

/** Ce qu'il faut d'un sujet pour en tailler le quad : son échelle de jeton et sa BOÎTE
 *  LOCALE (celle du fragment SVG rendu — `BillboardSubject.box`). */
export interface QuadSubject {
  scaleK: number;
  box: { w: number; h: number };
}

/** Quad d'un décor : sa hauteur monde × son échelle, RAPPORTÉE à sa boîte locale.
 *  L'échelle art→monde reste celle de la boîte canonique (`BB_H`) : une boîte plus haute AGRANDIT le
 *  quad d'autant — le sujet y garde sa taille apparente au lieu d'être écrasé dedans. Boîte canonique
 *  de décor ⇒ facteur 1 et `BILLBOARD_BOX_ASPECT`. */
export function subjectQuad(sub: QuadSubject): BillboardQuad {
  const heightM = (BILLBOARD_H_M * sub.scaleK * sub.box.h) / BB_H;
  return anchorAndSize(heightM, sub.box.w / sub.box.h);
}

// ————————————————————————————————————————————————————————————————
// 4. PALIER DE RASTERISATION
// ————————————————————————————————————————————————————————————————

/** Zoom maximal du jeu — borne haute de `setZoom` (`src/state/store.ts`, littéral non exporté). */
export const ZOOM_MAX = 2.6;
/** Garde-fous de texture : sous 16 px un billboard n'est plus lisible, au-delà de 2048 px on sort des
 *  tailles de texture sûres. */
export const RASTER_PX_MIN = 16;
export const RASTER_PX_MAX = 2048;

/** Les pixels écran par mètre monde en iso à zoom 1 sont ceux de `pxPerM` (`worldTris.ts`) : SOURCE
 *  UNIQUE, à passer à `rasterPxHeight` — ce module n'en refait pas une seconde. */

/** Hauteur de rasterisation (px) d'un billboard : sa taille écran au palier de zoom MAX, bornée. */
export function rasterPxHeight(heightM: number, pxPerM: number, maxZoom: number = ZOOM_MAX): number {
  const px = Math.ceil(heightM * pxPerM * maxZoom);
  return Math.min(RASTER_PX_MAX, Math.max(RASTER_PX_MIN, px));
}

/** Clé de cache d'une texture de billboard : une entrée par (identité, vue, miroir, palier). */
export function billboardTextureKey(
  identity: string,
  view: View,
  mirror: boolean,
  pxHeight: number,
): string {
  return `${identity}|${view}|${mirror ? 'm' : 'd'}|${pxHeight}`;
}

