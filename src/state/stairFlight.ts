/**
 * VOLÉE d'escalier — INVARIANT UNIQUE, partagé par le compilateur ASCII (`mapSpec.ts`, recettes
 * `cells.stair`) et par l'outil « Volée » de l'éditeur (`ui/editor`).
 *
 * Une volée n'est PAS un objet : c'est une file LINÉAIRE de cases dont les cotes montent par crans
 * franchissables (`STEP_MAX_M`, `relief.ts`) entre deux surfaces déjà cotées. La connexité verticale
 * se DÉRIVE ensuite des hauteurs (`surfaceLink`/`walkNeighbors`) — rien n'entre au pathfinding, aucun
 * décor n'est posé ici.
 *
 * Chaque refus porte sa RAISON en français, lisible telle quelle : `buildScene` la lève en `Error`
 * (fail-fast d'authoring), l'éditeur l'affiche sous le bouton de pose (`GatedAction`). Jamais un
 * silence, jamais une carte incohérente compilée.
 */
import type { Scene } from '../noyau/monde/scene';
import { heightAt, tileAt, isWalkable } from '../noyau/monde/scene';
import { estAbsent } from '../noyau/monde/terrain';
import { paintHeight } from './sceneEdit';
import { STEP_MAX_M } from '../noyau/monde/relief';

/** Case d'une volée (la couche `z` est portée par la volée entière, jamais par la case). */
export type StairCell = { x: number; y: number };

/** Case de la volée avec la cote (mètres) que la rampe lui assigne. */
export type StairStep = { x: number; y: number; height: number };

export type StairFlightPlan =
  | { ok: true; steps: StairStep[]; from: number; to: number }
  | { ok: false; reason: string };

const cellKey = (c: StairCell) => `${c.x},${c.y}`;
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Voisinage de Chebyshev (8 cases) — une volée peut affleurer son palier en diagonale. */
function chebyNeighbours(x: number, y: number): StairCell[] {
  const ns: StairCell[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      ns.push({ x: x + dx, y: y + dy });
    }
  return ns;
}

/** Nombre MINIMAL de cases pour franchir `delta` mètres par crans ≤ `STEP_MAX_M`. */
export function minFlightCells(delta: number): number {
  return Math.ceil(Math.abs(delta) / STEP_MAX_M);
}

/** Ordonne un ensemble de cases en FILE simple (une extrémité → l'autre). Refuse un tracé discontinu,
 *  ramifié ou cyclique : une volée est une file, pas un réseau. */
export function orderStairRun(cells: readonly StairCell[]): { ok: true; ordered: StairCell[] } | { ok: false; reason: string } {
  const byKey = new Map(cells.map((c) => [cellKey(c), { x: c.x, y: c.y }]));
  const run = [...byKey.values()];
  if (!run.length) return { ok: false, reason: 'aucune case désignée — tracez la file de cases de la volée' };
  if (run.length === 1) return { ok: true, ordered: run };

  const adj = new Map<string, string[]>();
  for (const c of run) {
    const ns: string[] = [];
    for (const [dx, dy] of NEIGHBOURS) {
      const nk = `${c.x + dx},${c.y + dy}`;
      if (byKey.has(nk)) ns.push(nk);
    }
    adj.set(cellKey(c), ns);
  }

  const seen = new Set([cellKey(run[0])]);
  const queue = [cellKey(run[0])];
  for (let i = 0; i < queue.length; i++)
    for (const nk of adj.get(queue[i])!)
      if (!seen.has(nk)) { seen.add(nk); queue.push(nk); }
  if (seen.size !== run.length) return { ok: false, reason: 'volée discontinue — les cases doivent se toucher par un côté' };

  const ends = run.filter((c) => adj.get(cellKey(c))!.length === 1);
  const mids = run.filter((c) => adj.get(cellKey(c))!.length === 2);
  if (run.some((c) => adj.get(cellKey(c))!.length >= 3) || ends.length !== 2 || mids.length !== run.length - 2)
    return { ok: false, reason: 'volée non-linéaire/ramifiée — une volée est une file simple de cases' };

  const orderedKeys: string[] = [];
  let prevKey: string | null = null;
  let curKey: string | null = cellKey(ends[0]);
  while (curKey) {
    orderedKeys.push(curKey);
    const nextKey: string | null = adj.get(curKey)!.find((k) => k !== prevKey) ?? null;
    prevKey = curKey;
    curKey = nextKey;
  }
  return { ok: true, ordered: orderedKeys.map((k) => byKey.get(k)!) };
}

/**
 * PLAN d'une volée : la file `cells` posée sur la couche `z` relie la surface d'appui de son extrémité
 * basse au plancher de la couche `toZ`, par une rampe de cotes interpolées (cran ≤ `STEP_MAX_M`).
 * Chaque surface est lue dans la scène TELLE QU'ELLE EST — la volée ne cote que ses propres cases.
 */
export function planStairFlight(scene: Scene, cells: readonly StairCell[], z: number, toZ: number): StairFlightPlan {
  const run = orderStairRun(cells);
  if (!run.ok) return run;
  const ordered = run.ordered;
  const runSet = new Set(ordered.map(cellKey));

  if (!scene.layers.some((l) => l.z === toZ)) return { ok: false, reason: `étage to=z${toZ} inexistant` };

  // Extrémité HAUTE = celle qui affleure le plancher de `toZ` ; hauteurs MINIMALES des candidats
  // (déterministe quand plusieurs planchers de hauteurs différentes jouxtent la même extrémité).
  const toNeighbours = (p: StairCell) =>
    chebyNeighbours(p.x, p.y).filter((n) => !estAbsent(tileAt(scene, n.x, n.y, toZ)) && isWalkable(scene, n.x, n.y, toZ));
  const touchesTo = (p: StairCell) => toNeighbours(p).length > 0;
  const minToNeighbourHeight = (p: StairCell) => Math.min(...toNeighbours(p).map((n) => heightAt(scene, n.x, n.y, toZ)));
  const minLowSupportHeight = (p: StairCell) => {
    const cands = chebyNeighbours(p.x, p.y).filter((n) => !runSet.has(cellKey(n)) && isWalkable(scene, n.x, n.y, z));
    return cands.length ? Math.min(...cands.map((n) => heightAt(scene, n.x, n.y, z))) : null;
  };

  let low: StairCell;
  let hHigh: number;
  let hLow: number;
  if (ordered.length === 1) {
    const cell = ordered[0];
    if (!touchesTo(cell)) return { ok: false, reason: "la volée d'une case ne touche pas le plancher de to (grilles décalées ? cf. #778)" };
    const l = minLowSupportHeight(cell);
    if (l === null) return { ok: false, reason: "volée d'une case sans surface d'appui basse" };
    low = cell;
    hHigh = minToNeighbourHeight(cell);
    hLow = l;
  } else {
    const a = ordered[0];
    const b = ordered[ordered.length - 1];
    const aHigh = touchesTo(a);
    const bHigh = touchesTo(b);
    if (aHigh && bHigh) return { ok: false, reason: 'les deux extrémités atteignent to — volée ambiguë' };
    if (!aHigh && !bHigh) return { ok: false, reason: "aucune extrémité n'atteint le plancher de to (grilles décalées ? cf. #778)" };
    low = aHigh ? b : a;
    hHigh = minToNeighbourHeight(aHigh ? a : b);
    const l = minLowSupportHeight(low);
    if (l === null) return { ok: false, reason: "extrémité basse sans surface d'appui" };
    hLow = l;
  }

  const delta = hHigh - hLow;
  const L = ordered.length;
  const minCells = minFlightCells(delta);
  if (L < minCells)
    return { ok: false, reason: `volée de ${L} case${L > 1 ? 's' : ''} insuffisante pour Δh=${delta} m ; minimum = ${minCells} (STEP_MAX_M=${STEP_MAX_M} m)` };

  for (const c of ordered)
    if (!estAbsent(tileAt(scene, c.x, c.y, toZ)))
      return { ok: false, reason: 'trémie bouchée — la case de to au-dessus de la volée doit être vide (surface fantôme)' };

  // Crans depuis l'extrémité BASSE (k=1..L) : la case du haut affleure exactement le plancher visé.
  const seq = cellKey(low) === cellKey(ordered[0]) ? ordered : [...ordered].reverse();
  const steps = seq.map((c, i) => ({ x: c.x, y: c.y, height: hLow + (delta * (i + 1)) / L }));
  return { ok: true, steps, from: hLow, to: hHigh };
}

/** Écrit les cotes d'un plan de volée (primitive de relief `paintHeight`, comme tout le reste). */
export function applyStairFlight(scene: Scene, steps: readonly StairStep[], z: number): Scene {
  let out = scene;
  for (const s of steps) out = paintHeight(out, { x: s.x, y: s.y }, s.height, 1, z);
  return out;
}
