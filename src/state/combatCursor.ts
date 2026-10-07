/**
 * Curseur de combat unifié (clavier + manette) — logique PURE (lit l'état, ne mute rien). Le store
 * (`combatSlice`) porte l'état `combatCursor` et appelle ces fonctions ; clavier ET manette alimentent
 * le MÊME curseur, qui pilote le réticule existant (`hoverTargeting`/`movePreviewAt`) et commet via les
 * actions existantes `battleClickEntity`/`battleClickTile`. Zéro chemin parallèle.
 */
import type { Pt } from './path';
import type { Get } from './flowTypes';
import type { Combatant } from '../engine/types';
import { tileCenter, type Dims } from '../geometry/iso';
import { isWalkable, liftDe, tileAt, type Scene } from './scene';
import { estAbsent } from './terrain';
import { combatantAtTile } from './combatGeometry';
import { combatantClickActs } from './combatOrParty';
import type { TargetingMode } from './targetingModes';

export interface CombatCursor {
  tile: Pt;
  /** Cible aimantée (Tab / gâchettes) — sert au rendu fiable du réticule, pas au commit (qui dérive de la case). */
  snappedId?: string;
}

export type ScreenDir = 'up' | 'down' | 'left' | 'right';

export type CursorIntent =
  | { kind: 'entity'; id: string }
  | { kind: 'tile'; pt: Pt };

/** Construit une case en omettant `z` quand il vaut 0 (byte-identique à `{x,y}`, comme `path.ts`). */
const mk = (x: number, y: number, z = 0): Pt => (z ? { x, y, z } : { x, y });

/** Vecteur ÉCRAN (y vers le bas) de la direction poussée. */
const DIR_VEC: Record<ScreenDir, [number, number]> = {
  right: [1, 0],
  left: [-1, 0],
  up: [0, -1],
  down: [0, 1],
};

/**
 * Alignement ÉCRAN du pas `from`→`to` avec la direction poussée : produit scalaire NORMALISÉ du vecteur
 * écran (origine→candidat, via `tileCenter`) avec le vecteur écran de `dir`. C'est la projection « le
 * curseur suit les yeux », SOURCE UNIQUE partagée par `nextCursorTile` (curseur de combat) ET
 * `exploreStepDest` (pas clavier d'exploration) — rien n'est codé en dur (rotation/vue comprises).
 * Le LIFT vertical d'une case est celui du socle (`scene.liftDe`, hauteur MÉTRIQUE), PAS l'index de
 * couche `z` : une case d'une couche haute mais de même hauteur réelle (tablier rejoint par une rampe)
 * se projette au MÊME écran que sa voisine — sinon le candidat cross-couche serait scoré à une hauteur
 * fantôme et perdrait l'alignement (le pas clavier ne montait alors pas sur le chemin de ronde).
 * >0 ⇒ `to` part bien dans le sens poussé à l'écran. PUR.
 */
export function screenStepDot(scene: Scene, from: Pt, to: Pt, dir: ScreenDir, dims: Dims): number {
  const o = tileCenter(from.x, from.y, dims, liftDe(scene, from));
  const c = tileCenter(to.x, to.y, dims, liftDe(scene, to));
  const sx = c.cx - o.cx;
  const sy = c.cy - o.cy;
  const mag = Math.hypot(sx, sy) || 1;
  const [vx, vy] = DIR_VEC[dir];
  return (sx / mag) * vx + (sy / mag) * vy;
}

/**
 * Couche RÉSOLUE de la case (x,y) : la plus HAUTE couche y portant une SURFACE RÉELLE, SANS borne d'étage
 * `≤ activeZ` — SOURCE UNIQUE partagée par le curseur de combat (clavier/manette, `nextCursorTile`) ET le
 * picking SOURIS (`stage/useStagePointer`) : les deux doivent pouvoir VISER le chemin de ronde z1
 * depuis la cour z0 (là où se tiennent défenseurs et pièces). On prend d'abord la couche MARCHABLE la plus
 * haute (chemin de ronde > sol), sinon la couche RÉELLE la plus haute (tuile NON absente : eau/mur visables) ;
 * à défaut, la base z0. Mono-couche ⇒ toujours z0 (byte-identique au sol plat). PUR.
 */
export function resolveCursorZ(scene: Scene, x: number, y: number): number {
  const zsDesc = scene.layers.map((l) => l.z).sort((a, b) => b - a);
  for (const z of zsDesc) if (isWalkable(scene, x, y, z)) return z; // surface marchable réelle
  for (const z of zsDesc) { if (!estAbsent(tileAt(scene, x, y, z))) return z; } // case réelle non marchable
  return 0;
}

/**
 * Voisin de grille (8-connexe) dont le CENTRE projeté à l'écran colle le mieux à la direction poussée
 * (« le curseur suit les yeux ») : chaque voisin (x,y) est résolu à SA couche (`resolveCursorZ` — chemin
 * de ronde z1 / sol z0, comme le picking souris), projeté via `screenStepDot` (au LIFT métrique de cette
 * couche), et on prend le produit scalaire maximal. CROSS-COUCHE : survoler le dessus du rempart donne
 * z1 (le réticule monte sur le chemin de ronde, là où le BFS grimpe la rampe). En iso une « droite » est
 * un pas DIAGONAL de grille, en vue du dessus un pas cardinal — la projection arbitre, rien n'est codé en
 * dur (rotation comprise). Curseur null = 1er appui : le curseur APPARAÎT sur le combattant actif. PUR.
 */
export function nextCursorTile(scene: Scene, cur: CombatCursor | null, dir: ScreenDir, dims: Dims, activePos: Pt): Pt {
  const start = cur?.tile ?? activePos;
  if (!cur) return mk(start.x, start.y, start.z ?? 0); // le curseur se pose sur l'actif au 1er appui
  let best: Pt | null = null;
  let bestDot = 0; // strictement positif requis → sinon on reste sur place (bord/coin)
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = start.x + dx;
      const ny = start.y + dy;
      if (nx < 0 || nx >= dims.w || ny < 0 || ny >= dims.h) continue;
      const cand = mk(nx, ny, resolveCursorZ(scene, nx, ny)); // couche résolue (z1 chemin de ronde / z0 sol)
      const dot = screenStepDot(scene, start, cand, dir, dims);
      if (dot > bestDot) {
        bestDot = dot;
        best = cand;
      }
    }
  return best ?? mk(start.x, start.y, start.z ?? 0);
}

/**
 * Décision de commit du curseur — RÉPLIQUE EXACTE de la branche `battle` de `performClick` (IsoStage) :
 * occupant d'une tuile de l'empreinte, `combatantClickActs` (mode courant) → attaque/cible, sinon allié/soi
 * → aucun commit (jamais de clic-case sous un combattant), case libre → déplacement. PUR (lit `get`).
 */
export function cursorCommitIntent(get: Get, cur: CombatCursor): CursorIntent | null {
  const b = get().battle;
  if (!b || b.over) return null;
  const { x, y } = cur.tile;
  const z = cur.tile.z ?? 0;
  const occ = combatantAtTile(b.combatants, x, y, z);
  if (occ && combatantClickActs(get, occ)) return { kind: 'entity', id: occ.id };
  if (occ) return null;
  return { kind: 'tile', pt: mk(x, y, z) };
}

/**
 * Ensemble des cases VALIDES d'un mode-CASE (#198, résidus) : balaie la scène et filtre par
 * `tileValidAt` — GÉNÉRIQUE à tout mode-case (Pousser/Téléportation/pose de zone…), jamais une liste
 * ad hoc par mode. O(w·h), appelé au déplacement clavier/manette (pas par frame) : coût négligeable
 * face aux dimensions de scène courantes. PUR (lit `get`).
 */
export function tileModeValidTiles(get: Get, mode: Required<Pick<TargetingMode, 'tileValidAt'>>, active: Combatant): Pt[] {
  const scene = get().scene;
  if (!scene) return [];
  const { w, h } = scene.dimensions;
  const out: Pt[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const pt = mk(x, y, resolveCursorZ(scene, x, y));
      if (mode.tileValidAt(get, active, pt)) out.push(pt);
    }
  return out;
}

/**
 * Voisin CLAVIER en mode-CASE (#198, résidus ; BUG-B suite #198 : cases CARDINALES inatteignables) :
 * contrairement à `nextCursorTile` (curseur LIBRE, 8 voisins de grille bruts — comportement voulu pour
 * cibler un combattant), ne considère QUE l'ensemble `valid` (cases commettables du mode courant). `cur`
 * hors de `valid` (entrée dans le mode, ou curseur désynchronisé) → la case valide la plus PROCHE de
 * `anchor` (position de l'acteur). `null` si `valid` est vide (rien à naviguer).
 *
 * Filtre directionnel par DEMI-PLAN LARGE (`dot > 0`, pas un cône étroit sur le max d'alignement) : en vue
 * iso, une flèche ÉCRAN projette EXACTEMENT sur une DIAGONALE de grille (dot=1) tandis qu'une case
 * CARDINALE de grille n'atteint jamais que ≈0.45-0.89 sur ce même axe — un tri PAR ALIGNEMENT seul (l'ex-
 * comportement, « argmax dot ») fait donc TOUJOURS gagner une diagonale plus ÉLOIGNÉE sur une cardinale
 * plus PROCHE, qui n'est alors JAMAIS sélectionnable (cône structurellement aveugle aux cardinales). Le
 * tri retenu est la DISTANCE (la case valide la plus PROCHE dans le demi-plan poussé), l'alignement ne
 * départageant qu'une ÉGALITÉ de distance. Reste un cas GENUINEMENT symétrique (ex. un ensemble en croix
 * radius-1 : N et E sont à la MÊME distance et au MÊME alignement pour une poussée « droite », miroirs
 * l'un de l'autre autour de la diagonale NE) : un DERNIER départage préfère la case dont le déplacement de
 * GRILLE porte sur l'axe NOMMÉ par la touche (|dx| pour gauche/droite, |dy| pour haut/bas) — sans lui,
 * « droite » retomberait arbitrairement sur une cardinale du MAUVAIS axe (N au lieu d'Est) selon l'ordre de
 * `valid`. Ainsi les 8 directions de grille d'un ensemble en croix (cardinales + diagonales à coût 1)
 * restent toutes atteignables en 1-2 pressions. PUR.
 */
export function nextCaseCursorTile(scene: Scene, cur: Pt | null, dir: ScreenDir, dims: Dims, anchor: Pt, valid: Pt[]): Pt | null {
  if (!valid.length) return null;
  const sameTile = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y && (a.z ?? 0) === (b.z ?? 0);
  const from = cur && valid.some((v) => sameTile(v, cur)) ? cur : null;
  if (!from) {
    let best = valid[0];
    let bestD = Infinity;
    for (const v of valid) {
      const d = Math.abs(v.x - anchor.x) + Math.abs(v.y - anchor.y);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }
  const horizontal = dir === 'left' || dir === 'right';
  let best: Pt | null = null;
  let bestDist = Infinity;
  let bestDot = 0;
  let bestAxis = -1;
  for (const v of valid) {
    if (sameTile(v, from)) continue;
    const dot = screenStepDot(scene, from, v, dir, dims);
    if (dot <= 0) continue; // demi-plan LARGE : jamais de saut arrière, mais aucun cône étroit sur le max
    const dist = Math.hypot(v.x - from.x, v.y - from.y);
    const axis = horizontal ? Math.abs(v.x - from.x) : Math.abs(v.y - from.y); // départage GENUINEMENT symétrique
    if (dist < bestDist || (dist === bestDist && (dot > bestDot || (dot === bestDot && axis > bestAxis)))) {
      bestDist = dist;
      bestDot = dot;
      bestAxis = axis;
      best = v;
    }
  }
  return best ?? from;
}
