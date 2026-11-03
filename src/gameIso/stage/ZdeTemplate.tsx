import type { JSX } from 'react';
/**
 * Gabarit de ZONE D'EFFET (LDB 47 l.15/28) : pendant la POSE (rayon FINAL surincanté, le gabarit suit
 * le curseur) — ou aperçu au rayon initial si un sort de ZdE est sélectionné sans modale (re-cliquer
 * l'ouvre). Contour POINTILLÉ ROUGE ANIMÉ (fourmis) + remplissage ; gris quand la case est invalide
 * (hors portée OU hors Ligne de Vue). INTERACTION (suit le survol) → overlay du stage, hors builders.
 */
import { useGame } from '../../state/store';
import type { BattleState } from '../../noyau/etat';
import { type PendingCast, type PendingSiegeAim } from '../../noyau/pendings';
import { zoneSousLeCurseur } from '../../noyau/combatFlow';
import { Dims, diamondPath, diamondCorners } from '../../geometry/iso';
import type { Pt } from '../../noyau/monde/path';
import { ENEMY_CUE_TINT, INVALID_TINT } from '../highlightTints';

/** `battle`, `pendingCast` et `pendingSiegeAim` sont les abonnements du parent qui redessinent le gabarit : le verdict
 *  se lit au noyau (`zoneSousLeCurseur`). */
export function ZdeTemplate({ hover, dims }: {
  battle: BattleState;
  hover: Pt;
  pendingCast: PendingCast | null;
  pendingSiegeAim: PendingSiegeAim | null;
  dims: Dims;
}) {
  const zone = zoneSousLeCurseur(useGame.getState, hover);
  if (!zone) return null;
  const { radius, valide: ok } = zone;
  // Les deux branches lisent le MÊME régime (la façade de teintes) : une valeur hexa, lisible par le
  // SVG comme par le volumique — jamais un `var(--x)` que `THREE.Color` ne résout pas.
  const col = ok ? ENEMY_CUE_TINT : INVALID_TINT;
  const tiles: JSX.Element[] = [];
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      const x = hover.x + dx, y = hover.y + dy;
      if (x < 0 || y < 0 || x >= dims.w || y >= dims.h) continue;
      tiles.push(<path key={`zde${x}-${y}`} d={diamondPath(x, y, dims)} fill={col} opacity={0.22} pointerEvents="none" />);
    }
  // Contour du BLOC (2r+1)² : enveloppe des 4 tuiles d'angle — fourmis qui tournent (anim.css).
  const x0 = hover.x - radius, x1 = hover.x + radius, y0 = hover.y - radius, y1 = hover.y + radius;
  const pts = [diamondCorners(x0, y0, dims), diamondCorners(x1, y0, dims), diamondCorners(x1, y1, dims), diamondCorners(x0, y1, dims)]
    .flatMap((c) => [c.top, c.right, c.bot, c.left]);
  const top = pts.reduce((a, b) => (b[1] < a[1] ? b : a));
  const right = pts.reduce((a, b) => (b[0] > a[0] ? b : a));
  const bot = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
  const left = pts.reduce((a, b) => (b[0] < a[0] ? b : a));
  return (
    <g pointerEvents="none">
      {tiles}
      <path
        className="zde-ants"
        d={`M${top[0]},${top[1]} L${right[0]},${right[1]} L${bot[0]},${bot[1]} L${left[0]},${left[1]} Z`}
        fill="none"
        stroke={col}
        strokeWidth={2.5}
        strokeDasharray="9 7"
        opacity={0.95}
      />
    </g>
  );
}
