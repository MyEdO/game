/**
 * Projection isométrique (2.5D « à la Baldur's Gate ») — géométrie PURE (#161 :
 * hors du foyer `gameIso` car `state` (curseur de combat `combatCursor`, pas clavier d'exploration
 * `exploreNav`) en a besoin pour sa PROPRE logique — projection de tuile, pas du rendu SVG. Les dérivés
 * qui ont vraiment besoin du monde (métrique `WALL_H_M`/`isoPxToM`, via `noyau/monde/relief`) restent dans
 * `gameIso/iso.ts`, qui importe cette géométrie plutôt que la redéfinir.
 *
 * Une tuile occupe TW de large et TH de haut en losange. Conventions partagées par le rendu ET le
 * picking (clic → tuile).
 */
export const TW = 64; // largeur d'un losange (pleine)
export const TH = 32; // hauteur d'un losange (pleine)
const SPRITE_HEADROOM = 160; // place au-dessus des tuiles pour les sprites hauts (usage interne seul)
export const CELL = 56; // côté d'une case carrée (vue du dessus)
// Vue « de face » (edge-on, crans IMPAIRS de la rotation) : l'iso TOURNÉ DE 45° → cases axis-alignées
// (rangées horizontales), même foreshortening 2:1 et même 3D que l'iso (l'extrusion des murs reste).
// EDGE_W/EDGE_H = TW/TH·√½ → même aire de tuile que le losange iso.
export const EDGE_W = TW * Math.SQRT1_2; // ≈ 45.25
export const EDGE_H = TH * Math.SQRT1_2; // ≈ 22.63
export const LEVEL_H = 96; // hauteur écran (px) d'un étage : un niveau z>0 est dessiné soulevé d'autant
/** Hauteur écran (px) d'une cloison dressée sur une arête (mur `WallSeg`). UNIFIÉ : un mur = un ÉTAGE
 *  (`WALL_H = LEVEL_H` ⇒ `WALL_H_M = METRES_PER_LEVEL` dans `gameIso/iso.ts`, une seule échelle de
 *  hauteur dans tout le monde — un mur atteint le plafond, une herse remplit son ouverture, pas de
 *  « délire » mur 2,25 m / niveau 4 m). Le relief reste porté par le SOL, pas par les murs (un mur =
 *  cloison d'arête, pas une plateforme). */
export const WALL_H = LEVEL_H;
/** Profondeur de tri : la base (anti-diagonale ÉCRAN) PRIME (× BASE_SCALE) ; l'étage `z` n'est qu'un
 *  cran SECONDAIRE (Z_STEP) de départage, lui-même au-dessus des offsets de COUCHE ajoutés par les
 *  appelants (sol −0.5, prop 0, overlay +0.25, jeton +0.5, mur +0.45, escalier +0.42 / haut d'escalier
 *  +0.7, halos +0.55/+0.6). Hiérarchie STRICTE : base ≫ z ≫ couche → murs/escaliers verticaux
 *  s'interclassent par leur vraie position écran (plus de « bande z » dominante qui enterrait un mur
 *  sous le sol du dessus). Invariants tenus par ces valeurs :
 *    BASE_SCALE > maxLevels*Z_STEP + 1   (un cran d'anti-diagonale domine toute la pile d'étages)
 *    Z_STEP     > max|layerOffset| (≈ 0.7)  (le cran d'étage domine tout offset de couche) */
export const Z_STEP = 2;
export const BASE_SCALE = 64;

/** Marge à gauche pour que la tuile la plus à gauche reste visible (dimensions effectives). */
export function originX(dims: Dims) {
  const st = axisStep(dims);
  if (st) return st.sx; // marge gauche = 1 tuile
  const ed = effDims(dims);
  return (ed.h - 1) * (TW / 2) + TW / 2;
}
export function originY() {
  return SPRITE_HEADROOM;
}

export type Rot = 0 | 1 | 2 | 3;

/** Projection de la carte : 'iso' losange 2.5D (défaut) · 'top' grille carrée + pastilles (vue du dessus). */
export type ViewMode = 'iso' | 'top';

/** Grille carrée PLATE (vue du dessus 'top', acteurs en pastilles) : distincte du losange iso ET de
 *  l'edge-on (qui garde la 3D). Sert UNIQUEMENT à router le rendu plat (murs/bâtiments sans extrusion). */
export const isSquareView = (view?: ViewMode): boolean => view === 'top';

export interface Dims {
  w: number;
  h: number;
  rot?: Rot; // orientation caméra (cran de 90° horaire) ; absent ⇒ 0
  view?: ViewMode; // projection ; absent ⇒ 'iso' (losange). Cf. ViewMode.
  edge?: boolean; // vue « de face » (edge-on) : grille axis-alignée MAIS 3D conservée (crans impairs). ⊥ view.
  /** LACET CONTINU de la caméra, en degrés, dans la cadence LOSANGE (#1176, P2-7 — voie volumique).
   *  Présent ⇒ la projection tourne librement autour du CENTRE de la grille et `rot`/`edge` ne
   *  décident plus rien de l'écran ; absent ⇒ crans (`rot`/`edge`), la voie affine, inchangée.
   *  L'edge-on y est le losange à `+45` : `edge(d) = iso(R(45°)·d)` (EDGE_W/EDGE_H = TW/TH·√½), donc
   *  les huit crans de production sont des lacets de cette MÊME famille — cf. `lacet-continu.test.ts`. */
  yawDeg?: number;
}

/** Famille de projection : losange 2.5D, « de face » (edge-on, 3D conservée), dessus plat. Mêmes trois
 *  familles pour les trois voies qui la consomment : la géométrie, les caméras du monde volumique
 *  (`backends/webgl/cameras.ts`) et la pose de stage (`stage/projection.ts`) — UN type, aucun alias. */
export type ProjKind = 'iso' | 'edge' | 'top';

/** Pas écran (sx, sy) d'une tuile en projection AXIS-ALIGNÉE — carré 'top' (CELL) ou « de face » edge-on
 *  (rectangle EDGE_W×EDGE_H = l'iso tourné de 45°) — ou null en iso losange (projection diagonale).
 *  SOURCE UNIQUE : top et edge partagent toute la géométrie axis-alignée, seul le pas diffère. */
export function stepOf(kind: ProjKind): { sx: number; sy: number } | null {
  if (kind === 'top') return { sx: CELL, sy: CELL };
  if (kind === 'edge') return { sx: EDGE_W, sy: EDGE_H };
  return null;
}

function axisStep(dims: Dims): { sx: number; sy: number } | null {
  return stepOf(dims.view === 'top' ? 'top' : dims.edge ? 'edge' : 'iso');
}

/** Rotation d'un offset de grille par un lacet en degrés. Un multiple de 90° emprunte le quart de tour
 *  ENTIER (aucun résidu de trigonométrie : les crans restent au pixel de la projection crantée) — même
 *  politique que `rightTiles` (`backends/webgl/cameras.ts`). */
export function rotOffset(yawDeg: number, d: { x: number; y: number }): { x: number; y: number } {
  const quarts = yawDeg / 90;
  if (Number.isInteger(quarts)) {
    let v = d;
    for (let i = 0, n = ((quarts % 4) + 4) % 4; i < n; i++) v = { x: v.y, y: -v.x };
    return v;
  }
  const a = (yawDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: d.x * cos + d.y * sin, y: -d.x * sin + d.y * cos };
}

/** Décalage ÉCRAN d'un offset de grille DÉJÀ tourné, à la cadence `step` (`null` = losange, diagonale). */
export function projectStep(step: { sx: number; sy: number } | null, p: { x: number; y: number }): { dx: number; dy: number } {
  return step
    ? { dx: p.x * step.sx, dy: p.y * step.sy }
    : { dx: (p.x - p.y) * (TW / 2), dy: (p.x + p.y) * (TH / 2) };
}

/** Inverse de `projectStep` : décalage écran → offset de grille TOURNÉ. */
export function unprojectStep(step: { sx: number; sy: number } | null, o: { dx: number; dy: number }): { x: number; y: number } {
  if (step) return { x: o.dx / step.sx, y: o.dy / step.sy };
  const a = o.dx / (TW / 2);
  const b = o.dy / (TH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Lacet CONTINU actif d'une carte, ou `null` si sa projection est CRANTÉE. La vue du DESSUS n'en a
 *  pas : son plan carré reste au cran (le lacet libre est la famille losange). */
export function freeYaw(dims: Dims): number | null {
  return dims.yawDeg == null || isSquareView(dims.view) ? null : dims.yawDeg;
}

/** Case-PIVOT de la rotation continue : le centre de la grille. */
function freePivot(dims: Dims): { x: number; y: number } {
  return { x: (dims.w - 1) / 2, y: (dims.h - 1) / 2 };
}

/** ANCRAGE ÉCRAN du pivot sous lacet libre : sa position CRANTÉE en losange, la même aux quatre crans
 *  (`originX` compense exactement le quart de tour : `cx = TW/4·(w+h)` — mesuré au cran par
 *  `lacet-continu.test.ts`). C'est ce qui fait tourner le monde AUTOUR de son centre au lieu de le
 *  faire dériver avec la boîte englobante. */
function freeOrigin(dims: Dims): { cx: number; cy: number } {
  const p = freePivot(dims);
  return crantedCenter(p.x, p.y, { w: dims.w, h: dims.h }, 0);
}

/** Facteur d'échelle d'un BILLBOARD (token/prop ancré aux pieds) selon la projection : la tuile « de
 *  face » (edge-on) est plus ÉTROITE (EDGE_W) que le losange iso (TW) → on réduit le sprite d'autant
 *  pour qu'il remplisse SA tuile dans les deux vues (sinon il déborde et chevauche ses voisins en vue
 *  de face → « décor placé aléatoirement »). 1 en iso ; la vue du dessus 'top' garde sa propre échelle. */
export function billboardScale(dims: Dims): number {
  return dims.edge && dims.view !== 'top' ? EDGE_W / TW : 1;
}

/** Dimensions effectives à l'écran : pour rot impair, une grille W×H tournée occupe H×W. */
export function effDims(dims: Dims): { w: number; h: number } {
  return (dims.rot ?? 0) % 2 === 0 ? { w: dims.w, h: dims.h } : { w: dims.h, h: dims.w };
}

/** Coordonnée de tuile tournée (grille → espace écran tourné). PUR. */
export function rotTile(x: number, y: number, dims: Dims): { x: number; y: number } {
  const W = dims.w,
    H = dims.h;
  switch (dims.rot ?? 0) {
    case 1:
      return { x: y, y: W - 1 - x };
    case 2:
      return { x: W - 1 - x, y: H - 1 - y };
    case 3:
      return { x: H - 1 - y, y: x };
    default:
      return { x, y };
  }
}

/** Inverse de rotTile (espace écran tourné → grille). PUR. */
export function unrotTile(x: number, y: number, dims: Dims): { x: number; y: number } {
  const W = dims.w,
    H = dims.h;
  switch (dims.rot ?? 0) {
    case 1:
      return { x: W - 1 - y, y: x };
    case 2:
      return { x: W - 1 - x, y: H - 1 - y };
    case 3:
      return { x: y, y: H - 1 - x };
    default:
      return { x, y };
  }
}

/** Centre écran d'une tuile (x,y) à la projection CRANTÉE (`rot`/`edge`/`view`) et à l'élévation `z`
 *  (niveau d'étage) : un niveau plus haut est soulevé de `z·LEVEL_H` px (cy plus petit), cx inchangé. */
function crantedCenter(x: number, y: number, dims: Dims, z: number): { cx: number; cy: number } {
  const r = rotTile(x, y, dims);
  const lift = isSquareView(dims.view) ? 0 : z * LEVEL_H; // vue du dessus : regard vertical, une élévation NE décale RIEN à l'écran
  const st = axisStep(dims);
  if (st) {
    return { cx: originX(dims) + r.x * st.sx, cy: originY() + r.y * st.sy - lift };
  }
  return {
    cx: originX(dims) + (r.x - r.y) * (TW / 2),
    cy: originY() + (r.x + r.y) * (TH / 2) - lift,
  };
}

/** Centre écran d'une tuile (x,y) — de GRILLE CONTINUE (les coins de case `±0.5` en dépendent) — en
 *  tenant compte de la rotation caméra (cran OU lacet libre, cf. `Dims.yawDeg`), de la projection et de
 *  l'élévation `z`. z=0 (défaut) = comportement plan-sol historique. SEULE porte de projection des
 *  overlays du stage : leur faire suivre un lacet libre se joue ICI, jamais chez chacun d'eux. */
export function tileCenter(x: number, y: number, dims: Dims, z = 0): { cx: number; cy: number } {
  const yaw = freeYaw(dims);
  if (yaw == null) return crantedCenter(x, y, dims, z);
  const pivot = freePivot(dims);
  const o = projectStep(stepOf('iso'), rotOffset(yaw, { x: x - pivot.x, y: y - pivot.y }));
  const a = freeOrigin(dims);
  return { cx: a.cx + o.dx, cy: a.cy + o.dy - z * LEVEL_H };
}

/** Taille totale du canvas SVG pour une carte donnée (dimensions effectives). */
export function stageSize(dims: Dims): { w: number; h: number } {
  const ed = effDims(dims);
  const st = axisStep(dims);
  if (st) {
    return { w: ed.w * st.sx + 2 * st.sx, h: ed.h * st.sy + SPRITE_HEADROOM + st.sy };
  }
  return {
    w: (ed.w + ed.h) * (TW / 2) + TW,
    h: (ed.w + ed.h) * (TH / 2) + SPRITE_HEADROOM + TH,
  };
}

/** Inverse : point écran (relatif au SVG) → coordonnées de tuile entières (dé-tourne). Sous lacet
 *  LIBRE l'arrondi tombe APRÈS la dé-rotation (il n'y a plus de grille écran à arrondir avant). */
export function screenToTile(px: number, py: number, dims: Dims): { x: number; y: number } {
  if (freeYaw(dims) != null) {
    const f = screenToTileF(px, py, dims, 0);
    return { x: Math.round(f.x), y: Math.round(f.y) };
  }
  const st = axisStep(dims);
  if (st) {
    const rx = Math.round((px - originX(dims)) / st.sx);
    const ry = Math.round((py - originY()) / st.sy);
    return unrotTile(rx, ry, dims);
  }
  const dx = px - originX(dims);
  const dy = py - originY();
  const a = dx / (TW / 2);
  const b = dy / (TH / 2);
  const rx = Math.round((a + b) / 2);
  const ry = Math.round((b - a) / 2);
  return unrotTile(rx, ry, dims);
}

/** Inverse de `tileCenter` POUR UN NIVEAU DONNÉ `z` : ré-applique l'élévation (le point écran a été
 *  soulevé de z·LEVEL_H) avant l'inversion plan-sol. Le picking 3D itère z du haut vers le bas et
 *  retient la 1re tuile occupée. z=0 (défaut) ≡ screenToTile. */
export function screenToTileAtZ(px: number, py: number, dims: Dims, z = 0): { x: number; y: number } {
  return screenToTile(px, py + (isSquareView(dims.view) ? 0 : z * LEVEL_H), dims);
}

/** Inverse de `tileCenter` SANS arrondi : coordonnées de tuile FRACTIONNAIRES (l'offset au centre d'une
 *  case ∈ [-0.5,0.5] sert au picking d'ARÊTE de l'éditeur de murs). Dé-tourne en continu (unrotTile est
 *  une transformée linéaire, valable sur des flottants). z = étage visé. */
export function screenToTileF(px: number, py: number, dims: Dims, z = 0): { x: number; y: number } {
  const qy = py + (isSquareView(dims.view) ? 0 : z * LEVEL_H);
  const yaw = freeYaw(dims);
  if (yaw != null) {
    const a = freeOrigin(dims);
    const p = unprojectStep(stepOf('iso'), { dx: px - a.cx, dy: qy - a.cy });
    const d = rotOffset(-yaw, p);
    const pivot = freePivot(dims);
    return { x: d.x + pivot.x, y: d.y + pivot.y };
  }
  const st = axisStep(dims);
  if (st) {
    return unrotTile((px - originX(dims)) / st.sx, (qy - originY()) / st.sy, dims);
  }
  const a = (px - originX(dims)) / (TW / 2);
  const b = (qy - originY()) / (TH / 2);
  return unrotTile((a + b) / 2, (b - a) / 2, dims);
}

/** Les 4 sommets (et le centre) d'une tuile — source unique de la géométrie, partagée par
 *  diamondPath et le raccord d'arêtes (ground.ts). Losange (TW/TH) en iso ; carré (CELL) en
 *  vue du dessus, où top=NO, right=NE, bot=SE, left=SO (l'ordre compose avec groundTile/diamondPath).
 *  Sous lacet LIBRE les quatre sommets sont les COINS DE GRILLE (`±0.5`) projetés — ce qui rend
 *  exactement les demi-diagonales ci-dessous à chaque cran, et fait tourner le losange avec la vue. */
export function diamondCorners(x: number, y: number, dims: Dims, z = 0) {
  const { cx, cy } = tileCenter(x, y, dims, z);
  if (freeYaw(dims) != null) {
    const coin = (dx: number, dy: number): [number, number] => {
      const q = tileCenter(x + dx, y + dy, dims, z);
      return [q.cx, q.cy];
    };
    return { cx, cy, top: coin(-0.5, -0.5), right: coin(0.5, -0.5), bot: coin(0.5, 0.5), left: coin(-0.5, 0.5) };
  }
  const st = axisStep(dims);
  if (st) {
    const hx = st.sx / 2, hy = st.sy / 2;
    return {
      cx,
      cy,
      top: [cx - hx, cy - hy] as [number, number],
      right: [cx + hx, cy - hy] as [number, number],
      bot: [cx + hx, cy + hy] as [number, number],
      left: [cx - hx, cy + hy] as [number, number],
    };
  }
  return {
    cx,
    cy,
    top: [cx, cy - TH / 2] as [number, number],
    right: [cx + TW / 2, cy] as [number, number],
    bot: [cx, cy + TH / 2] as [number, number],
    left: [cx - TW / 2, cy] as [number, number],
  };
}

export type EdgeSide = 'N' | 'E' | 'S' | 'O';

/** Les 2 extrémités-ÉCRAN de l'ARÊTE cardinale `side` de la case (x,y) au LIFT donné (z + élévation).
 *  Calculé sur les COINS DE GRILLE projetés AVEC la rotation (un coin (gx,gy) = `tileCenter(gx-0.5,gy-0.5)`).
 *  SOURCE UNIQUE de la géométrie d'arête : MURS, JUPES d'élévation et ESCALIERS s'en servent → ils tournent
 *  TOUS de la même façon avec la caméra (zéro duplication ; corriger ici corrige partout). */
export function tileEdge(x: number, y: number, side: EdgeSide, dims: Dims, lift = 0): [{ cx: number; cy: number }, { cx: number; cy: number }] {
  const gc = (gx: number, gy: number) => tileCenter(gx - 0.5, gy - 0.5, dims, lift);
  switch (side) {
    case 'N': return [gc(x, y), gc(x + 1, y)];
    case 'E': return [gc(x + 1, y), gc(x + 1, y + 1)];
    case 'S': return [gc(x + 1, y + 1), gc(x, y + 1)];
    default: return [gc(x, y + 1), gc(x, y)]; // O
  }
}

/** Chemin SVG d'un losange de sol centré sur la tuile. */
export function diamondPath(x: number, y: number, dims: Dims, z = 0): string {
  const { top, right, bot, left } = diamondCorners(x, y, dims, z);
  return `M${top[0]},${top[1]} L${right[0]},${right[1]} L${bot[0]},${bot[1]} L${left[0]},${left[1]} Z`;
}

/** Profondeur de tri (plus grand = devant), dans l'orientation courante, niveau `z` compris.
 *  iso : diagonale écran (r.x+r.y) ; top/edge : par rangée écran (r.y prime, r.x départage). La base
 *  (anti-diagonale écran) est mise à l'échelle BASE_SCALE et l'étage `z` n'ajoute qu'un cran SECONDAIRE
 *  (Z_STEP) : à position écran ÉGALE, l'étage haut passe devant, mais un élément plus AVANT (base plus
 *  grande) à un étage bas reste devant un élément plus arrière d'un étage haut → murs/escaliers
 *  verticaux s'interclassent par leur vraie position écran. z=0 (défaut) = base × BASE_SCALE
 *  (plan-sol historique, à l'échelle près — le tri relatif est inchangé). Sous lacet LIBRE, la base est
 *  la PROFONDEUR ÉCRAN continue de la case (`p.x+p.y` du losange, dont `cy` est l'image directe) :
 *  comptée depuis le pivot, elle ne diffère du cran que d'une constante commune à toutes les cases. */
export function depth(x: number, y: number, dims: Dims, z = 0) {
  const yaw = freeYaw(dims);
  if (yaw != null) {
    const pivot = freePivot(dims);
    const p = rotOffset(yaw, { x: x - pivot.x, y: y - pivot.y });
    return (p.x + p.y) * BASE_SCALE + z * Z_STEP;
  }
  const r = rotTile(x, y, dims);
  const st = axisStep(dims); // null en iso losange — la branche r.x+r.y est VIVANTE
  const base = st ? r.y * (dims.w + dims.h) + r.x : r.x + r.y;
  return base * BASE_SCALE + z * Z_STEP;
}

/** Profondeur de tri d'un élément à EMPREINTE (w×h, ancre NO) à l'étage z : MAX de `depth` sur les 4 coins
 *  → la case « proche caméra » est correcte aux 4 rotations (généralise le MAX-2-cases de wallDepth). */
export function footprintDepth(x: number, y: number, w: number, h: number, dims: Dims, z = 0): number {
  const xs = [x, x + Math.max(1, w) - 1], ys = [y, y + Math.max(1, h) - 1];
  let d = -Infinity;
  for (const cx of xs) for (const cy of ys) d = Math.max(d, depth(cx, cy, dims, z));
  return d;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ScreenBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface OccluderPanel {
  polygons: readonly (readonly { x: number; y: number; lift: number }[])[];
}

export interface ProjectedOccluderPolygon {
  points: ScreenPoint[];
  bounds: ScreenBounds;
}

export interface ProjectedOccluder {
  polygons: ProjectedOccluderPolygon[];
  bounds: ScreenBounds;
}

export interface ActorCapsule {
  segment: [ScreenPoint, ScreenPoint];
}

/** Centre ÉCRAN d'une capsule d'acteur : milieu du segment pieds→tête. Ce que la CAMÉRA doit viser —
 *  viser le sol de la case décale le cadre d'une demi-capsule vers le haut de la scène. */
export function capsuleCenter(capsule: ActorCapsule): ScreenPoint {
  const [foot, head] = capsule.segment;
  return { x: (foot.x + head.x) / 2, y: (foot.y + head.y) / 2 };
}

export function projectOccluder(panel: OccluderPanel, dims: Dims): ProjectedOccluder {
  const polygons = panel.polygons.map((poly): ProjectedOccluderPolygon => {
    const points = poly.map((point) => {
      const { cx, cy } = tileCenter(point.x, point.y, dims, point.lift);
      return { x: cx, y: cy };
    });
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      points,
      bounds: {
        left: Math.min(...xs),
        right: Math.max(...xs),
        top: Math.min(...ys),
        bottom: Math.max(...ys),
      },
    };
  });
  return {
    polygons,
    bounds: {
      left: Math.min(...polygons.map((polygon) => polygon.bounds.left)),
      right: Math.max(...polygons.map((polygon) => polygon.bounds.right)),
      top: Math.min(...polygons.map((polygon) => polygon.bounds.top)),
      bottom: Math.max(...polygons.map((polygon) => polygon.bounds.bottom)),
    },
  };
}
