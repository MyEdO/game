import type { JSX } from 'react';
/**
 * Gabarit de ZONE D'EFFET (LDB 47 l.15/28) : pendant la POSE (rayon FINAL surincanté, le gabarit suit
 * le curseur) — ou aperçu au rayon initial si un sort de ZdE est sélectionné sans modale (re-cliquer
 * l'ouvre). Contour POINTILLÉ ROUGE ANIMÉ (fourmis) + remplissage ; gris quand la case est invalide
 * (hors portée OU hors Ligne de Vue). INTERACTION (suit le survol) → overlay du stage, hors builders.
 */
import { useGame, type BattleState, type PendingCast, type PendingSiegeAim } from '../../state/store';
import { Combatant } from '../../engine/types';
import { zdeRadiusTiles, spellRangeTiles } from '../../engine/magic';
import { findSpellById } from '../../data';
import { placingZoneOf, placedZoneValidAt, castSightBlocked } from '../../state/combatFlow';
import { Dims, diamondPath, diamondCorners } from '../../geometry/iso';
import { chebyshev } from '../../state/path';
import type { Pt } from '../../state/path';
import { ENEMY_CUE_TINT, INVALID_TINT } from '../highlightTints';

export function ZdeTemplate({ battle, hover, pendingCast, pendingSiegeAim, activeC, dims }: {
  battle: BattleState;
  hover: Pt;
  pendingCast: PendingCast | null;
  pendingSiegeAim: PendingSiegeAim | null;
  activeC: Combatant | undefined;
  dims: Dims;
}) {
  // Source UNIQUE de pose (placingZoneOf — toute zone à poser librement) ; sinon aperçu
  // au rayon initial quand un sort de ZdE est sélectionné sans modale ouverte.
  const pz = placingZoneOf({ pendingCast, pendingSiegeAim, battle });
  let radius: number | null = null;
  let caster: Combatant | undefined;
  let ok: boolean | null = null;
  if (pz) {
    radius = pz.radius;
    caster = battle.combatants.find((c) => c.id === pz.casterId);
    ok = placedZoneValidAt(useGame.getState, pz, hover);
  } else if (battle.action === 'cast' && battle.selectedSpellId && activeC?.kind === 'hero' && !pendingCast) {
    const spell = findSpellById(battle.selectedSpellId);
    // Rayon depuis la cible STRUCTURÉE (source unique — gère les spans rayon ET diamètre).
    radius = spell ? zdeRadiusTiles(spell.target, activeC) : null;
    caster = activeC;
    if (radius != null && spell && caster?.pos) {
      const range = spellRangeTiles(spell.range, caster);
      ok = (range == null || chebyshev(caster.pos, hover) <= range) && !castSightBlocked(useGame.getState, caster.pos, hover);
    }
  }
  if (radius == null || !caster?.pos || ok == null) return null;
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
