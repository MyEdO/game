/**
 * POSE PAR FRAME des billboards du monde volumique (#1176, P2-4) — la passe que chaque image rejoue,
 * hors de tout rendu React. Elle ne construit RIEN : ni géométrie, ni matériau, ni texture ; elle ne
 * fait que ré-orienter des quads déjà montés face à la caméra de l'image et les exposer.
 *
 * Module à part de `GameStage3D` — et c'est STRUCTUREL : cette passe est PURE (aucun DOM, aucun
 * contexte WebGL), donc mesurable telle quelle, là où la frame complète de l'écran demande un
 * renderer que jsdom ne sait pas fournir.
 *
 * Les billboards sont le DÉCOR (#3160) : aucun personnage n'y est un sujet.
 */
import * as THREE from 'three';
import type { EndState } from '../../engine/conditions';
import { billboardDepthOffsetUnits, billboardViewDepth, type BillboardSubject, type TintAt } from '../backends/webgl/sceneMeshes';
import { billboardExposure } from './stagePointLights';
import { materiauPlanTransparent } from '../backends/webgl/worldMaterials';
import { RASTER_PX_MAX, rasterPxHeight } from '../backends/webgl/billboardMath';

/** Un billboard monté : ce qu'il faut pour le RE-POSER quand la caméra bouge, sans le reconstruire. */
export interface Board {
  sub: BillboardSubject;
  quad: { widthM: number; heightM: number; centerLiftM: number };
  mesh: THREE.Mesh;
  /** Matériau du quad — jamais lambertien (P2-5) : la normale d'un quad aligné écran est l'axe caméra.
   *  Le type reste ouvert : un hôte peut monter les siens. */
  material: THREE.MeshBasicMaterial | THREE.MeshLambertMaterial;
}

/** Caméra de la frame — l'offset de profondeur des quads se dérive de son plan (`near`/`far`), et de la
 *  DISTANCE à l'œil quand elle est en perspective (la profondeur fenêtre n'y est pas linéaire).
 *  `isPerspectiveCamera` est le drapeau que three pose lui-même sur ses caméras. */
export type FrameCamera = THREE.Camera & { near: number; far: number; isPerspectiveCamera?: boolean };

/** SEUIL de découpe des texels d'un sprite : sous lui, le fragment est REJETÉ (le sprite garde sa
 *  silhouette au lieu d'un rectangle voilé). */
export const ALPHA_TEST = 0.5;

/**
 * MATÉRIAU d'un billboard du stage (#1176, P2-5) — TOUJOURS `MeshBasicMaterial`, et c'est structurel :
 * un quad aligné écran a pour normale l'axe caméra, donc un matériau lambertien y mesure l'angle
 * caméra↔soleil et la luminosité d'un décor change quand la vue tourne (mesuré : ×2,36 entre deux
 * crans). Sa lumière est donc un SCALAIRE : `luminance` = l'exposition du sujet À CET ENDROIT
 * (`billboardExposure` : l'exposition globale de la frame, plus les flaques de lampe qui l'atteignent),
 * multipliée par la teinte de visibilité du sujet.
 */
export function billboardMaterial(map: THREE.Texture, luminance: number): THREE.MeshBasicMaterial {
  const mat = materiauPlanTransparent({ map, alphaTest: ALPHA_TEST });
  mat.color.setScalar(luminance);
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -1;
  return mat;
}

/** Ce que le CHROME d'un jeton change à son ALLURE (#1176, P3-0f) — la même donnée que la surcouche
 *  SVG porte en style CSS sur son disque (`stage/TokenChromeOverlay.allureStyle`), et que l'anneau
 *  d'équipe reprend (`stage/dynamicMarkPose`). */
export interface BoardChrome {
  ghost: boolean;
  endState: EndState | null;
  highlight: string | null;
}

/** Atténuation de l'anneau hors Ligne de Vue. */
export const GHOST_OPACITY = 0.45;

/** VERTICALE MONDE, et le HAUT D'ÉCRAN de travail — deux ancres, jamais réallouées. */
const VERTICALE = new THREE.Vector3(0, 1, 0);
const HAUT_ECRAN = new THREE.Vector3();

/**
 * SEUIL sous lequel le HAUT D'ÉCRAN de la caméra est COUCHÉ dans le plan du sol : sa composante
 * verticale monde. 0,05 ≈ 87° de tangage — la vue du DESSUS regarde à 90°, l'iso à 30° (`up.y` ≈ 0,87).
 * Aucune vue de ce jeu ne se pose entre les deux : le seuil ne coupe pas une transition, il nomme un
 * régime.
 */
export const UP_ECRAN_COUCHE = 0.05;

/**
 * CENTRE MONDE du quad d'un billboard ancré aux PIEDS.
 *
 * DEUX RÉGIMES, et c'est structurel — la grandeur `centerLiftM` est une DEMI-HAUTEUR, donc une
 * élévation :
 *  - caméra INCLINÉE (iso, POV) : le quad monte le long du HAUT D'ÉCRAN, pour que l'arête basse reste
 *    exactement sur l'ancre quelle que soit la rotation ;
 *  - caméra à la VERTICALE (vue du dessus) : ce haut d'écran est couché dans le plan du sol, et la
 *    même montée deviendrait une TRANSLATION HORIZONTALE, TOURNANT avec le lacet. Le quad se lève alors
 *    selon la VERTICALE MONDE : son centre reste à l'aplomb de son ancre, donc de sa case.
 *
 * Le lift est CONSERVÉ (jamais annulé) : à zéro, le quad se retrouve coplanaire du plancher cuit et les
 * deux se disputent la profondeur.
 */
export function boardCenter(anchor: THREE.Vector3, centerLiftM: number, camQuat: THREE.Quaternion, out: THREE.Vector3): THREE.Vector3 {
  HAUT_ECRAN.copy(VERTICALE).applyQuaternion(camQuat);
  return Math.abs(HAUT_ECRAN.y) < UP_ECRAN_COUCHE
    ? out.copy(anchor).addScaledVector(VERTICALE, centerLiftM)
    : out.copy(anchor).addScaledVector(HAUT_ECRAN, centerLiftM);
}

/** Centre de travail de la pose — une ancre, jamais réallouée. */
const CENTRE = new THREE.Vector3();

/** Décalage MONDE du sujet `cid` à l'instant de la frame, `null` s'il ne marche pas. */
export type GlideAt = (cid: string) => { dx: number; dy: number; dz: number } | null;

/** ALLURE du sujet `cid` à l'instant de la frame, `null` s'il n'a rien de particulier à montrer. */
export type ChromeAt = (cid: string) => BoardChrome | null;

/** Aucune allure particulière — la valeur d'une voie qui n'en fournit pas (planches QC). */
export const AUCUN_CHROME: ChromeAt = () => null;

/** Aucun brouillard — la teinte d'une voie qui n'échantillonne aucun champ de vision (planches QC,
 *  bancs de pose). */
export const TEINTE_PLEINE: TintAt = () => 1;

/** Les FLAQUES de la frame (#1245, L3) : le POOL de lampes ponctuelles monté, plus l'exposition
 *  globale du moment (`stage/stagePointLights.ts`). */
export interface FrameLights {
  /** Le pool monté — ce que l'exposition d'un quad mesure. */
  pool: readonly THREE.PointLight[];
  /** Exposition globale de la frame (`stageLights.surfaceLuminance`), que les flaques COMPLÈTENT. */
  surfaceLuminance: number;
}

/** Re-pose tous les quads face à la caméra de la frame.
 *
 *  L'EXPOSITION des quads se recalcule ici (#1245, L3) : elle dépend des lampes montées à l'instant de
 *  l'image (le vacillement les fait battre).
 *
 *  Le BIAIS DE PROFONDEUR des quads (#1176, P3-1b) se prend PAR BOARD sous une caméra perspective :
 *  la profondeur fenêtre n'y est pas linéaire, donc un même biais métrique ne vaut pas le même nombre
 *  d'unités à 1 m et à 30 m (`billboardDepthOffsetUnits`, branche `depthM`). En ortho, la profondeur EST
 *  linéaire : une seule valeur pour toute la frame.
 *
 *  La TEINTE DE VISIBILITÉ du quad (#1396) se prend ici aussi, à la case du sujet (`sub.cell`) : c'est
 *  une valeur de FRAME, au même titre que l'exposition. Cuite dans le sujet, elle entrerait dans
 *  l'identité des sujets, et un pas du groupe — qui change le champ de vision — remonterait tous les
 *  quads du monde. */
export function poseBoards(boards: readonly Board[], camera: FrameCamera, lights: FrameLights, tintAt: TintAt): void {
  const perspective = camera.isPerspectiveCamera === true;
  const unitsOrtho = perspective ? 0 : billboardDepthOffsetUnits(camera.near, camera.far);
  for (const b of boards) {
    b.mesh.quaternion.copy(camera.quaternion);
    b.mesh.position.copy(boardCenter(b.sub.anchor, b.quad.centerLiftM, camera.quaternion, CENTRE));
    b.material.polygonOffsetUnits = perspective
      ? billboardDepthOffsetUnits(camera.near, camera.far, billboardViewDepth(camera, b.mesh.position))
      : unitsOrtho;
    const teinte = tintAt(b.sub.cell.x, b.sub.cell.y, b.sub.cell.z);
    b.material.color.setScalar(teinte * billboardExposure(b.sub.anchor, lights.pool, lights.surfaceLuminance));
  }
}

/**
 * PLAFOND de rapport de pixels du rendu — la valeur que le renderer reçoit (`setPixelRatio`). Elle vit
 * ICI parce que le PALIER de rasterisation en dépend : le renderer peint le canevas en pixels de
 * DISPOSITIF, là où `rasterPxHeight` se mesure en pixels CSS. Mesuré (#1328) : à zoom maximal et DPR 2,
 * un quad couvre exactement deux fois plus de pixels que sa texture n'en porte.
 */
export const DPR_PLAFOND = 2;

/** Rapport de pixels EFFECTIF du rendu (celui que le renderer reçoit). */
function dprEffectif(dpr: number): number {
  return Math.min(DPR_PLAFOND, dpr > 0 ? dpr : 1);
}

/** Palier de rasterisation d'une texture : le palier CSS du billboard, porté au rapport de pixels réel
 *  du rendu, sous le même plafond de texture. */
export function atlasPxHeight(heightM: number, pxPerM: number, dpr: number): number {
  return Math.min(RASTER_PX_MAX, Math.round(rasterPxHeight(heightM, pxPerM) * dprEffectif(dpr)));
}

/**
 * ÉCHANGE EN PLACE de la texture STATIQUE d'un board déjà monté — la REPOSE d'un sujet dont l'art
 * change de vue sans que rien de sa géométrie ne bouge (franchissement d'un cran de caméra : le décor
 * n'a d'art qu'aux quarts de tour).
 */
export function poserTextureStatique(b: Board, texture: THREE.Texture): void {
  if (b.material.map !== texture) b.material.map = texture;
}
