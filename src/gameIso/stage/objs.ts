/**
 * Objets du TRI DE PROFONDEUR global du stage iso + fusion statique/dynamique.
 * Fix du `objs.sort` à 60 Hz : les couches STATIQUES (sols/murs/décor/toits/props/figurants/
 * surbrillances) sont PRÉ-TRIÉES une fois par leurs memos ; à la frame, seuls les éléments DYNAMIQUES
 * (tokens qui marchent, halos/tethers/aperçus) s'insèrent par DICHOTOMIE — plus de retri global.
 */
import type { CellSide } from '../../data/schemas/defs-scenes/communs';
import type { ScreenBounds } from '../../geometry/iso';

/** Un objet du tri de profondeur.
 *  `x,y` (tuile) = culling écran (absent ⇒ toujours rendu) ; `z` = étage (z < activeZ ⇒ filtre
 *  `lower-floor-dim`) ; `vis` = dessiné AU-DESSUS du voile de brouillard ; `acc` = thunk PARESSEUX de
 *  la couche d'accents matériaux v2 (étendu APRÈS le culling, avec l'opacité `op` de son élément). */
export interface StageObj {
  d: number;
  el: JSX.Element;
  x?: number;
  y?: number;
  z?: number;
  vis?: boolean;
  svg?: () => string;
  acc?: () => string;
  op?: number;
  h?: number;
  ghost?: boolean;
  kind?: 'floor' | 'wall' | 'roof' | 'prop';
  side?: CellSide;
  roomZoneIds?: readonly string[];
  bounds?: ScreenBounds;
  roofCell?: { x: number; y: number; z: number };
  roofSpan?: { w: number; h: number };
  roofCells?: readonly { x: number; y: number; z: number }[];
}

/** Concatène puis trie par profondeur (tri STABLE : l'ordre d'émission départage les ex æquo, comme le
 *  push historique) — appelé UNE fois par memo de couches statiques, jamais à la frame. */
export function sortByDepth(...layers: StageObj[][]): StageObj[] {
  return ([] as StageObj[]).concat(...layers).sort((a, b) => a.d - b.d);
}

/** Insère les éléments DYNAMIQUES dans la couche statique PRÉ-TRIÉE, par dichotomie. À égalité de
 *  profondeur le STATIQUE passe d'abord (les dynamiques étaient historiquement poussés après) et les
 *  dynamiques gardent leur ordre d'émission (tri stable). `dyn` vide ⇒ identité (réf stable). */
export function mergeByDepth(stat: StageObj[], dyn: StageObj[]): StageObj[] {
  if (!dyn.length) return stat;
  const sorted = [...dyn].sort((a, b) => a.d - b.d);
  const out: StageObj[] = new Array(stat.length + sorted.length);
  let si = 0, oi = 0;
  for (const d of sorted) {
    // Dichotomie bornée [si, n) : premier statique STRICTEMENT plus profond que l'élément inséré.
    let lo = si, hi = stat.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (stat[mid].d <= d.d) lo = mid + 1;
      else hi = mid;
    }
    while (si < lo) out[oi++] = stat[si++];
    out[oi++] = d;
  }
  while (si < stat.length) out[oi++] = stat[si++];
  return out;
}
