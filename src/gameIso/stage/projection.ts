/**
 * PROJECTION DU STAGE — source UNIQUE des conversions monde↔écran, paramétrée par un lacet RÉEL
 * (degrés) dont les quatre crans de production (`Dims.rot`) sont les cas particuliers EXACTS.
 *
 * Module PUR : aucun import de `three` (garde `projection.test.ts`), aucun DOM, aucun store — il doit
 * rester consommable par le picking (`useStagePointer`) et par les overlays SVG sans tirer le moteur
 * volumique. Il ne dépend que de la géométrie de `geometry/iso.ts`, dont il généralise `tileCenter` /
 * `screenToTileAtZ` : à pose crantée, les deux chemins rendent le même pixel (mesuré à 1e-6 px).
 *
 * Forme affine, dérivée des deux références qu'elle réconcilie (`geometry/iso.ts` : `Dims`/`effDims`/
 * `originX` — `backends/webgl/cameras.ts` : `affineCamera`, dont le JSDoc note que l'ancrage écran
 * `originX`/`originY` face au couple `target`/`zoom` « n'existe que dans le test ») :
 *
 *   écran = origin + Proj( R(yaw) · (monde − pivot) ) − lift·LEVEL_H
 *
 * `R(yaw)` tourne la GRILLE dans le plan écran autour du pivot (un quart de tour y est appliqué en
 * entier, sans résidu de trigonométrie) ; `Proj` est la cadence de la vue — losange `TW/2`×`TH/2`,
 * « de face » `EDGE_W`×`EDGE_H`, dessus `CELL`×`CELL`. L'élévation est un décalage écran vertical pur
 * (la vue du dessus regarde à la verticale : elle n'en décale rien).
 *
 * PORTÉE (#1176, plan de Phase 2 au commentaire du ticket) : ce module EST le livrable du lot P2-0,
 * avec ses preuves d'égalité. Ses consommateurs de production l'ont rejoint depuis : la caméra de stage
 * (P2-2, `stage3dCamera.ts`), le picking (P2-3, `useStagePointer.ts`) et les overlays SVG (P2-7, par
 * `Dims.yawDeg` → `tileCenter`, qui partage désormais SA rotation et SA cadence).
 */
import {
  LEVEL_H,
  freeYaw,
  isSquareView,
  projectStep,
  rotOffset,
  stepOf,
  tileCenter,
  unprojectStep,
  type Dims,
  type ProjKind,
} from '../../geometry/iso';

/** Pose de la caméra de stage : la vue, son lacet RÉEL en degrés, le PIVOT de grille autour duquel ce
 *  lacet tourne, et le point ÉCRAN où ce pivot atterrit (l'ANCRAGE — ce que l'affine tient par
 *  `originX`/`originY` et la caméra volumique par `target`). */
export interface StagePose {
  kind: ProjKind;
  /** Lacet en degrés ; `rot·90` reproduit exactement le cran `rot` de `Dims`. */
  yawDeg: number;
  /** Case-pivot de la rotation, en grille CONTINUE. */
  pivot: { x: number; y: number };
  /** Pixel du pivot à l'écran. */
  origin: { x: number; y: number };
}

/** Point de GRILLE CONTINUE : `x`/`y` en tuiles, `lift` en NIVEAUX d'étage — la même unité que le `z`
 *  de `tileCenter`/`screenToTileAtZ`, celle que rend `metricToLift` (`noyau/monde/relief.ts`). */
export interface StageWorld {
  x: number;
  y: number;
  lift?: number;
}

export interface StageScreen {
  x: number;
  y: number;
}

/** Vue de la pose correspondant à des dimensions de carte. Sous lacet LIBRE (`Dims.yawDeg`), la vue est
 *  le LOSANGE : l'edge-on n'est pas une seconde famille mais le même losange à `+45` — `edge(d) =
 *  iso(R(45°)·d)`, EDGE_W/EDGE_H valant TW/TH·√½ (mesuré : `lacet-continu.test.ts`). */
export function stageKindOf(dims: Dims): ProjKind {
  if (isSquareView(dims.view)) return 'top';
  if (freeYaw(dims) != null) return 'iso';
  return dims.edge ? 'edge' : 'iso';
}

/** Pose d'une carte — le cas particulier de `Dims`. Le pivot est le centre de la grille, dont `rotTile`
 *  est le point fixe aux quatre crans ; son ancrage écran se lit donc directement dans `tileCenter`,
 *  cran OU lacet libre, ce qui fait de cette pose l'exact équivalent de `dims` dans les deux régimes
 *  (cf. `projection.test.ts` pour les crans, `lacet-continu.test.ts` pour le lacet libre). */
export function poseFromDims(dims: Dims): StagePose {
  const pivot = { x: (dims.w - 1) / 2, y: (dims.h - 1) / 2 };
  const { cx, cy } = tileCenter(pivot.x, pivot.y, dims, 0);
  return {
    kind: stageKindOf(dims),
    yawDeg: freeYaw(dims) ?? (dims.rot ?? 0) * 90,
    pivot,
    origin: { x: cx, y: cy },
  };
}

/** Grille continue → pixel écran. Généralise `tileCenter` à un lacet réel. */
export function worldToScreen(pose: StagePose, world: StageWorld): StageScreen {
  const p = rotOffset(pose.yawDeg, { x: world.x - pose.pivot.x, y: world.y - pose.pivot.y });
  const { dx, dy } = projectStep(stepOf(pose.kind), p);
  return { x: pose.origin.x + dx, y: pose.origin.y + dy - liftPx(pose, world.lift ?? 0) };
}

/** Pixel écran → grille continue AU NIVEAU `lift` donné (niveaux d'étage, cf. `StageWorld`). Inverse
 *  exact de `worldToScreen` ; généralise `screenToTileF`/`screenToTileAtZ`, dont le picking
 *  multi-hypothèses itère les lifts.
 *  DÉGÉNÉRESCENCE EN VUE DU DESSUS : `liftPx` y est nul (l'élévation ne décale rien à l'écran, la
 *  projection est verticale) → tous les lifts rendent la MÊME case. Itérer les hypothèses d'étage n'y
 *  départage donc rien : en `top`, l'étage se résout AUTREMENT (couche active, occupation de la case),
 *  pas par la projection. */
export function screenToWorldAtLift(pose: StagePose, screen: StageScreen, lift = 0): { x: number; y: number } {
  const p = unprojectStep(stepOf(pose.kind), {
    dx: screen.x - pose.origin.x,
    dy: screen.y - pose.origin.y + liftPx(pose, lift),
  });
  const d = rotOffset(-pose.yawDeg, p);
  return { x: d.x + pose.pivot.x, y: d.y + pose.pivot.y };
}

/** CASE ENTIÈRE sous un pixel, au niveau `lift` : l'arrondi de `screenToWorldAtLift`. C'est la forme
 *  que consomme le picking (`stage/useStagePointer.ts`), dont les trois chemins itèrent les lifts
 *  d'une scène pour retrouver la case DESSINÉE sous le pixel. Elle rend `screenToTileAtZ`
 *  (`geometry/iso.ts`) case pour case ; l'arrondi y tombe après la dé-rotation, là où l'ancienne
 *  l'appliquait avant — les deux ne peuvent se séparer que sur la frontière EXACTE de deux cases, où
 *  elles nomment deux voisines (mesuré : `stage/pick-parity.test.tsx`). */
export function screenToTileAtLift(pose: StagePose, screen: StageScreen, lift = 0): { x: number; y: number } {
  const w = screenToWorldAtLift(pose, screen, lift);
  return { x: Math.round(w.x), y: Math.round(w.y) };
}

/** Décalage écran vertical d'une élévation : `LEVEL_H` px par niveau, nul en vue du dessus (une caméra
 *  à la verticale ne sépare pas les étages à l'écran — cf. `screenToWorldAtLift`). */
function liftPx(pose: StagePose, lift: number): number {
  return pose.kind === 'top' ? 0 : lift * LEVEL_H;
}
