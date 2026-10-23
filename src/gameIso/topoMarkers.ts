/**
 * GÉOMÉTRIE PURE des marqueurs « station » d'une vue top-down (cf. TopoScene) : centre écran (projection
 * partagée `tileCenter`), teinte de faction (source unique `teamColors`), anneau de sélection, badge
 * d'équipage et wedge d'arc d'orientation. AUCUN React ici — la composition SVG/JSX vit dans TopoScene ;
 * ces primitives restent unit-testables sans rendu. PUR.
 */
import { tileCenter, type Dims } from '../geometry/iso';
import { ALLY_TINT, ENEMY_TINT, NEUTRAL_TINT } from './teamColors';
import type { Station } from '../noyau/stations';
import type { FireArc } from '../engine/types';

/** Rayon écran (px) du disque d'un marqueur — assez grand pour porter l'icône à ~0.4 échelle. */
export const MARKER_R = 15;
/** Longueur écran (px) du wedge d'arc (indice de direction, pas une géométrie de tir). */
const WEDGE_LEN = 22;
/** Demi-ouverture (px) de la base du wedge. */
const WEDGE_HALF = 8;

export interface StationMarker {
  cx: number;
  cy: number;
  tint: string;
  /** Path SVG du wedge d'arc (relatif au canvas), ou absent si la station n'a pas de `side`. */
  wedge?: string;
  ring: boolean;
  /** Nombre d'équipiers assignés (badge), ou absent si aucun. */
  badge?: number;
}

/** Teinte d'un marqueur selon sa faction (source unique `teamColors`). */
export function stationTint(faction: Station['faction']): string {
  return faction === 'ally' ? ALLY_TINT : faction === 'enemy' ? ENEMY_TINT : NEUTRAL_TINT;
}

/** Direction ÉCRAN (dx,dy unitaires) d'un arc relatif au marqueur — convention fixe, heading-agnostique
 *  (TopoScene reçoit une position déjà résolue) : proue=haut, poupe=bas, tribord=droite, babord=gauche. */
export const ARC_DIR: Record<FireArc, readonly [number, number]> = {
  proue: [0, -1],
  poupe: [0, 1],
  tribord: [1, 0],
  babord: [-1, 0],
};

/** GABARIT du triangle : rayon du disque qu'il coiffe, longueur au-delà du bord, demi-ouverture de sa
 *  base — tous en pixels d'écran. Défaut = le marqueur de station. */
export interface WedgeGeom {
  r: number;
  len: number;
  half: number;
}

const WEDGE_STATION: WedgeGeom = { r: MARKER_R, len: WEDGE_LEN, half: WEDGE_HALF };

/**
 * Petit triangle (indice d'orientation) posé au bord d'un disque de centre `(cx, cy)` et pointant vers
 * la direction ÉCRAN unitaire `dir`.
 *
 * UN SEUL triangle pour les deux populations qui en portent un : le marqueur de STATION du plan de
 * bord (qui passe `ARC_DIR[side]`) et le PION-DISQUE de la vue du dessus (qui passe son Dir8 projeté,
 * `builders/dynamicMarks.discCapPath`). La direction est le paramètre, le gabarit une option — deux
 * tracés séparés divergeraient au premier réglage de forme.
 */
export function wedgePath(cx: number, cy: number, dir: readonly [number, number], geom: WedgeGeom = WEDGE_STATION): string {
  const [dx, dy] = dir;
  const tipX = cx + dx * (geom.r + geom.len), tipY = cy + dy * (geom.r + geom.len);
  const bx = cx + dx * geom.r, by = cy + dy * geom.r; // pied du wedge, au bord du disque
  // Perpendiculaire (−dy, dx) pour la base du triangle.
  const px = -dy * geom.half, py = dx * geom.half;
  return `M${bx + px},${by + py} L${tipX},${tipY} L${bx - px},${by - py} Z`;
}

/** Géométrie d'un marqueur de station : centre au `tileCenter` de sa case (+ `offset` d'évitement des
 *  co-localisés), teinte de faction, anneau de sélection si `selectedId` la désigne, badge = nombre
 *  d'équipiers, wedge d'arc si la station porte un `side`. */
export function stationMarker(s: Station, dims: Dims, selectedId?: string, offset?: { dx: number; dy: number }): StationMarker {
  const base = tileCenter(s.pos.x, s.pos.y, dims, s.pos.z ?? 0);
  const cx = base.cx + (offset?.dx ?? 0), cy = base.cy + (offset?.dy ?? 0);
  return {
    cx,
    cy,
    tint: stationTint(s.faction),
    ...(s.side ? { wedge: wedgePath(cx, cy, ARC_DIR[s.side]) } : {}),
    ring: s.id === selectedId,
    ...(s.assignedIds.length ? { badge: s.assignedIds.length } : {}),
  };
}

/** Offsets d'ÉVITEMENT : plusieurs pièces d'un même bord tombent sur la MÊME case (RAW : placement libre
 *  par bord). Pour qu'elles restent toutes VISIBLES et CLIQUABLES, on évente les stations co-localisées
 *  (même centre écran) sur un petit cercle ; une station seule reste au centre. PUR. */
export function colocationOffsets(stations: Station[], dims: Dims): Map<string, { dx: number; dy: number }> {
  const groups = new Map<string, Station[]>();
  for (const s of stations) {
    const { cx, cy } = tileCenter(s.pos.x, s.pos.y, dims, s.pos.z ?? 0);
    const key = `${Math.round(cx)},${Math.round(cy)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(s);
  }
  const out = new Map<string, { dx: number; dy: number }>();
  for (const grp of groups.values()) {
    if (grp.length === 1) { out.set(grp[0].id, { dx: 0, dy: 0 }); continue; }
    const R = MARKER_R * 1.35;
    grp.forEach((s, i) => {
      const a = (i / grp.length) * Math.PI * 2 - Math.PI / 2; // départ en haut, sens horaire
      out.set(s.id, { dx: Math.cos(a) * R, dy: Math.sin(a) * R });
    });
  }
  return out;
}
