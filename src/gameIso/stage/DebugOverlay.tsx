import type { JSX } from 'react';
/**
 * OVERLAY DEBUG (recette `__wfrp.labels`) — annotation PARTAGÉE de la carte, rendue EN DERNIER dans le
 * groupe caméra (au-dessus de TOUTE la scène) et UNIQUEMENT quand le flag est ON (zéro coût off).
 * Pour chaque case NON ABSENTE de CHAQUE couche : coordonnées `x,y` (+`z{n}`) en blanc cerné de noir +
 * teinte par couche (z1 cyan / z2 violet). Pastilles de rôle de structure sur les arêtes (porte jaune /
 * courtine rouge). Purement additif : n'altère NI le rendu NI le tri.
 */
import { Scene, type WallSeg } from '../../state/scene';
import { findStructureById } from '../../data';
import { estAbsent } from '../../state/terrain';
import { wallEnds } from '../builders/walls';
import { Dims, tileCenter, diamondPath } from '../../geometry/iso';

export function DebugMapLabels({ scene, dims, liftAt }: { scene: Scene; dims: Dims; liftAt: (x: number, y: number, z?: number) => number }) {
  const W = scene.dimensions.w, H = scene.dimensions.h;
  const els: JSX.Element[] = [];
  // 1) Teinte par couche + coordonnées centrées (lift = HAUTEUR MÉTRIQUE → posé sur le sol réel).
  for (const lvl of scene.layers) {
    const z = lvl.z;
    const tint = z >= 2 ? 'var(--dbg-z2)' : z === 1 ? 'var(--dbg-z1)' : null; // z0 : aucune teinte
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (estAbsent(lvl.tiles[y * W + x])) continue;
        const lift = liftAt(x, y, z);
        if (tint) els.push(<path key={`dbgtint-${z}-${x}-${y}`} d={diamondPath(x, y, dims, lift)} fill={tint} opacity={0.18} pointerEvents="none" />);
        // Coord UNIQUEMENT sur la couche la plus HAUTE de la case → un seul label par colonne.
        const isTop = !scene.layers.some((l) => l.z > z && !estAbsent(l.tiles[y * W + x]));
        if (isTop) {
          const { cx, cy } = tileCenter(x, y, dims, lift);
          els.push(
            <text key={`dbgxy-${z}-${x}-${y}`} x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
              fontSize={10} fontWeight={700} fill="var(--dbg-fg)" stroke="var(--dbg-ink)" strokeWidth={3}
              style={{ paintOrder: 'stroke' }} pointerEvents="none">
              {z > 0 ? `${x},${y}z${z}` : `${x},${y}`}
            </text>,
          );
        }
      }
  }
  // 2) Rôle des MURS/structures : porte jaune / courtine rouge ; marqueur dressé sur l'arête à sa
  //    couche. Extrémités = l'aiguillage UNIQUE du builder (`wallEnds`, cardinales + diagonales).
  const edgePts = (w: WallSeg, z: number): [{ cx: number; cy: number }, { cx: number; cy: number }] =>
    wallEnds(w).map((p) => tileCenter(p.x, p.y, dims, z)) as [{ cx: number; cy: number }, { cx: number; cy: number }];
  for (const w of scene.walls ?? []) {
    const role = findStructureById(w.structure ?? '')?.kind === 'porte' ? 'var(--dbg-door)' : 'var(--dbg-wall)';
    const z = w.z ?? 0;
    const [a, b] = edgePts(w, z);
    const key = `${w.x}-${w.y}-${w.side}-${w.z ?? 0}`;
    els.push(<line key={`dbgwall-${key}`} x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke={role} strokeWidth={4} strokeLinecap="round" opacity={0.92} pointerEvents="none" />);
    els.push(<circle key={`dbgwalldot-${key}`} cx={(a.cx + b.cx) / 2} cy={(a.cy + b.cy) / 2} r={3.2} fill={role} stroke="var(--dbg-ink)" strokeWidth={0.8} pointerEvents="none" />);
  }
  return <g pointerEvents="none">{els}</g>;
}

/** Légende DEBUG — FIXE dans un coin (hors groupe caméra : ne pan/zoome pas). */
export function DebugLegend() {
  const items: [string, string][] = [
    ['couche z1 (teinte cyan)', 'var(--dbg-z1)'],
    ['couche z2 (teinte violet)', 'var(--dbg-z2)'],
    ['courtine (mur)', 'var(--dbg-wall)'],
    ['porte', 'var(--dbg-door)'],
  ];
  const x0 = 12, y0 = 12, rowH = 18, w = 200, h = 30 + items.length * rowH;
  return (
    <g pointerEvents="none">
      <rect x={x0} y={y0} width={w} height={h} rx={6} fill="var(--dbg-ink)" opacity={0.82} stroke="var(--dbg-border)" strokeWidth={1} />
      <text x={x0 + 10} y={y0 + 18} fill="var(--dbg-fg)" fontSize={11} fontWeight={700}>Debug carte (labels)</text>
      {items.map(([label, col], i) => {
        const ly = y0 + 28 + i * rowH;
        return (
          <g key={`dbgleg-${i}`}>
            <rect x={x0 + 10} y={ly} width={14} height={12} fill={col} stroke="var(--dbg-ink)" strokeWidth={0.8} />
            <text x={x0 + 30} y={ly + 10} fill="var(--dbg-fg)" fontSize={10.5}>{label}</text>
          </g>
        );
      })}
    </g>
  );
}
