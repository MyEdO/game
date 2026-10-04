import type { JSX } from 'react';
/**
 * Télégraphes ENNEMIS (IA) : déplacement (chemin + destination en rouge, montré avant le glissé),
 * visée (réticule + ligne — PLEINE en mêlée, pointillée tir/sort) et ZONE (disque Chebyshev peint
 * ~0,7 s avant la résolution d'une ZdE — « où l'aire va tomber », parité avec le réticule du missile).
 * INTERACTION/mise en scène → overlays du stage, hors builders.
 */
import { Combatant } from '../../engine/types';
import { Dims, diamondPath } from '../../geometry/iso';
import { TargetReticle } from '../TargetReticle';
import { movePreviewEls } from './movePreview';
import { ENEMY_CUE_TINT, THREAT_TINT } from '../highlightTints';
import type { Pt } from '../../state/path';

export function EnemyMoveTelegraph({ actorMove, dims, footN, lift }: { actorMove: { path: Pt[] } | null; dims: Dims; footN: number; lift: (p: Pt) => number }) {
  if (!actorMove || actorMove.path.length === 0) return null;
  // Même tracé que l'aperçu héros (movePreviewEls), teinté ennemi.
  return <>{movePreviewEls(actorMove.path, actorMove.path[actorMove.path.length - 1], null, dims, 'enmv', ENEMY_CUE_TINT, footN, lift)}</>;
}

export function EnemyAimTelegraph({ targeting, anchor }: { targeting: { from: Combatant; to: Combatant; melee?: boolean } | null; anchor: (c: Combatant) => { cx: number; cy: number } }) {
  if (!targeting) return null;
  return <TargetReticle from={anchor(targeting.from)} to={anchor(targeting.to)} line={targeting.melee ? 'solid' : 'dashed'} lineColor={ENEMY_CUE_TINT} />;
}

export function EnemyAoeTelegraph({ actorAoe, dims }: { actorAoe: { center: Pt; radius: number } | null; dims: Dims }) {
  if (!actorAoe) return null;
  const { center, radius } = actorAoe;
  const tiles: JSX.Element[] = [];
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) {
      const x = center.x + dx, y = center.y + dy;
      if (x < 0 || y < 0 || x >= dims.w || y >= dims.h) continue;
      tiles.push(<path key={`aoe${x}-${y}`} d={diamondPath(x, y, dims)} fill={THREAT_TINT} opacity={0.25} pointerEvents="none" />);
    }
  // Teinte de MENACE rouge (≠ orange/bleu de l'aperçu joueur).
  return <g pointerEvents="none">{tiles}</g>;
}
