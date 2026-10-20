/**
 * Mathématique PURE des BILLBOARDS (personnages + props en quads texturés).
 * Node-safe : aucune dépendance DOM/three ici, tout le décisionnel (taille monde, sélection de vue,
 * ancrage, palier de rasterisation) vit dans ce module ; `svgTexture.ts` n'est qu'une couture navigateur.
 *
 * Le SVG reste la source de vérité de l'art (`propSvg` / `bonesToSvg`) : ce module ne dessine rien.
 */
import { BB_W, BB_H, ENT_H_M, PROP_H_M } from '../../pov/billboardCore';
import { project, facingView, type View, type Dir8 } from '../../rig/facing';
import { povView } from '../../pov/camera';
import { DIR8_DELTA } from '../../../noyau/monde/dir8';
import { type Rot } from '../../../geometry/iso';
import { ISO_PX_PER_M } from '../../iso';

// ————————————————————————————————————————————————————————————————
// 1. TAILLE MONDE — convention CIBLE `jeu`, plus les deux presets de comparaison de planche (#1160)
// ————————————————————————————————————————————————————————————————

export type BillboardConvention = 'jeu' | 'heroique' | 'metrique';
export type BillboardKind = 'personnage' | 'prop';

/** Échelle de token iso par famille, MESURÉE aux sites de rendu (non exportées là-bas, littéraux en
 *  place) : rig = 0.58 ; prop (et sprite) = 0.55 — les échelles du repère SVG de référence.
 *  (`speciesScale`/`sizeTokenScale`/`foot.scale` sont des facteurs PAR ENTITÉ, hors de cette base.) */
const ISO_TOKEN_SCALE: Record<BillboardKind, number> = { personnage: 0.58, prop: 0.55 };

/** Hauteur d'un personnage debout dans la convention du moteur (m) — héroïque modéré,
 *  arbitrage user 2026-08-09 #1160. */
export const JEU_ENT_H_M = 2.3;

/** Facteur de la convention `jeu` sur le métrique : DÉRIVÉ de l'unique constante arbitrée
 *  `JEU_ENT_H_M` — toute autre famille (props…) s'y met à l'échelle, sans second nombre posé. */
export const JEU_SCALE = JEU_ENT_H_M / ENT_H_M;

/** Convention RENDUE par le monde volumique (#1160) — la taille des corps y est celle du JEU.
 *  Elle appartient à la mathématique des billboards, pas à l'écran qui les monte. */
export const CONVENTION = 'jeu' as const;

/**
 * Hauteur MONDE (m) d'un billboard selon la convention rendue.
 * - `jeu` : `JEU_ENT_H_M` pour un personnage, métrique × `JEU_SCALE` pour le reste.
 * - `heroique` : dérivée des sites iso — boîte locale `BB_H` px × échelle de token ÷ `ISO_PX_PER_M`.
 * - `metrique` : constantes du POV (`ENT_H_M` / `PROP_H_M`).
 */
export function billboardHeightM(convention: BillboardConvention, kind: BillboardKind): number {
  const metrique = kind === 'personnage' ? ENT_H_M : PROP_H_M;
  if (convention === 'metrique') return metrique;
  if (convention === 'jeu') return metrique * JEU_SCALE;
  return (BB_H * ISO_TOKEN_SCALE[kind]) / ISO_PX_PER_M;
}

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
 * ortho → `project` (`rig/facing.ts`), perspective → `povView` (`pov/camera.ts`).
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

/** Aspect (l/h) de la boîte locale d'un billboard — la même 120×150 pour un rig et pour un décor
 *  (`catalog/decor` dessine en 120×150, pieds en (60,150)). */
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

/** Ce qu'il faut d'un sujet pour en tailler le quad : sa famille, son échelle de jeton et sa BOÎTE
 *  LOCALE (celle du fragment SVG rendu — `BillboardSubject.box`). */
export interface QuadSubject {
  kind: BillboardKind;
  scaleK: number;
  box: { w: number; h: number };
}

/** Quad d'un sujet : la hauteur monde de sa famille × son échelle, RAPPORTÉE à sa boîte locale.
 *  L'échelle art→monde reste celle de la boîte canonique (`BB_H`) : une boîte plus haute AGRANDIT le
 *  quad d'autant — le sujet y garde sa taille apparente au lieu d'être écrasé dedans. Boîte canonique
 *  (tout sujet simple : rig, gabarit, décor) ⇒ facteur 1 et `BILLBOARD_BOX_ASPECT`. */
export function subjectQuad(convention: BillboardConvention, sub: QuadSubject): BillboardQuad {
  const heightM = (billboardHeightM(convention, sub.kind) * sub.scaleK * sub.box.h) / BB_H;
  return anchorAndSize(heightM, sub.box.w / sub.box.h);
}

/**
 * Unités de la BOÎTE de corps par MÈTRE, pour un sujet rendu — la réciproque exacte de l'échelle
 * art→monde de `subjectQuad` (`heightM / box.h` mètres par unité). C'est la conversion qui permet à
 * une hauteur du MONDE (la hauteur d'assise d'un siège) d'entrer dans le repère du RIG, où vit la
 * `Pose`. Un corps deux fois plus grand voit le même tabouret deux fois plus bas : `scaleK` y entre.
 */
export function boxUnitsPerM(kind: BillboardKind, scaleK: number): number {
  return BB_H / (billboardHeightM(CONVENTION, kind) * scaleK);
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

// ————————————————————————————————————————————————————————————————
// 5. ATLAS DE FLIPBOOK — géométrie pure d'une planche de frames (#1176)
// ————————————————————————————————————————————————————————————————

/** Gouttière (px) réservée DANS chaque cellule, de chaque côté — la géométrie ci-dessous la réserve,
 *  le cuiseur (`atlasBake.ts`) y DUPLIQUE les texels de bord de la frame, pour qu'un filtrage linéaire
 *  au bord ne ramène jamais la frame voisine. */
export const ATLAS_GUTTER_PX = 2;

/** Une frame dans la planche, en PIXELS : le rectangle de CONTENU (gouttière exclue) où le cuiseur
 *  dessine — sa cellule l'entoure de `ATLAS_GUTTER_PX` de chaque côté. Origine en HAUT à gauche
 *  (repère canevas). */
export interface AtlasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Planche de frames : grille régulière de cellules, une texture au plus `RASTER_PX_MAX` de côté. */
export interface AtlasLayout {
  cols: number;
  rows: number;
  /** Pas de la grille (px) — la cellule, gouttière COMPRISE. */
  cellW: number;
  cellH: number;
  texW: number;
  texH: number;
  /** Nombre EFFECTIF de frames tenant dans la planche (≤ le `n` demandé). */
  n: number;
  /** Rectangles de contenu, dans l'ordre des frames (rangées de gauche à droite, de haut en bas). */
  rects: AtlasRect[];
}

/**
 * Grille d'un flipbook : `n` frames de cellule `frameW`×`frameH` (gouttière COMPRISE — le contenu
 * occupe `frameW − 2·ATLAS_GUTTER_PX` au centre) rangées en lignes.
 *
 * La texture ne dépasse JAMAIS `RASTER_PX_MAX` en largeur NI en hauteur : si les `n` frames n'y
 * tiennent pas, la planche en porte moins et `layout.n` dit combien (l'appelant ré-échantillonne son
 * geste sur ce nombre de frames). Une cellule qui excède le plafond À ELLE SEULE ne peut pas tenir
 * cette promesse : c'est un défaut d'appelant (palier de rasterisation mal borné) → erreur, comme
 * une cellule invalide.
 */
export function atlasLayout(frameW: number, frameH: number, n: number): AtlasLayout {
  if (!Number.isFinite(frameW) || !Number.isFinite(frameH) || frameW <= 2 * ATLAS_GUTTER_PX || frameH <= 2 * ATLAS_GUTTER_PX) {
    throw new Error(`atlasLayout: cellule invalide (${frameW}×${frameH}, gouttière ${ATLAS_GUTTER_PX})`);
  }
  const cellW = Math.ceil(frameW);
  const cellH = Math.ceil(frameH);
  if (cellW > RASTER_PX_MAX || cellH > RASTER_PX_MAX) {
    throw new Error(`atlasLayout: cellule ${cellW}×${cellH} au-delà du plafond de texture ${RASTER_PX_MAX}`);
  }
  const maxCols = Math.max(1, Math.floor(RASTER_PX_MAX / cellW));
  const maxRows = Math.max(1, Math.floor(RASTER_PX_MAX / cellH));
  const want = Math.max(1, Math.floor(n));
  const kept = Math.min(want, maxCols * maxRows);
  const cols = Math.min(maxCols, kept);
  const rows = Math.ceil(kept / cols);
  const rects: AtlasRect[] = [];
  for (let k = 0; k < kept; k++) {
    rects.push({
      x: (k % cols) * cellW + ATLAS_GUTTER_PX,
      y: Math.floor(k / cols) * cellH + ATLAS_GUTTER_PX,
      w: cellW - 2 * ATLAS_GUTTER_PX,
      h: cellH - 2 * ATLAS_GUTTER_PX,
    });
  }
  return { cols, rows, cellW, cellH, texW: cols * cellW, texH: rows * cellH, n: kept, rects };
}

/**
 * Rectangle UV de la frame `k`, en [0..1], CONVENTION THREE : v = 0 en BAS de la texture (la planche,
 * elle, se range du haut vers le bas comme un canevas — la rangée 0 est donc en HAUT de l'image,
 * soit les v les plus GRANDS).
 *
 * INSET d'un demi-texel : le rectangle va du CENTRE du premier texel de contenu au centre du dernier.
 * Avec la gouttière dupliquée, un filtrage linéaire au bord ne mélange alors que la couleur du bord
 * avec elle-même — ni bavure de la frame voisine, ni frange transparente.
 */
export function frameUvRect(layout: AtlasLayout, k: number): { x: number; y: number; w: number; h: number } {
  const r = layout.rects[k];
  if (!r) throw new Error(`frameUvRect: frame ${k} hors planche (${layout.n} frames)`);
  return {
    x: (r.x + 0.5) / layout.texW,
    y: 1 - (r.y + r.h - 0.5) / layout.texH,
    w: (r.w - 1) / layout.texW,
    h: (r.h - 1) / layout.texH,
  };
}
