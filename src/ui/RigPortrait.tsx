import type { CSSProperties } from 'react';
import { tokenBodyKind } from '../gameIso/tokenBodyKind';
import type { Combatant } from '../engine/types';
import { useVersionDesDatasets } from './useVersionDesDatasets';

/**
 * Vignette-portrait d'un combattant : gros plan sur le VISAGE vu de FACE (pose neutre), bordure =
 * couleur d'identité/équipe. Pas d'initiales (retours playtest).
 *
 * Le corps + le viewBox cadré sur le visage viennent de `tokenBodyKind(…, 'top')` — SOURCE UNIQUE
 * partagée avec le pion-portrait de la carte (vue du dessus). Humanoïde = gros plan tête (cadré sur
 * l'os `tete` résolu de chaque race) ; créature non-bipède = haut-avant du gabarit.
 *
 * Taille, anneau et trait du contour passent en VARIABLES CSS consommées par `rig-portrait.css`
 * (arbitrage A2 du 2026-09-18).
 */
export function RigPortrait({ combatant, size = 42, ring }: { combatant: Combatant; size?: number; ring?: string }) {
  useVersionDesDatasets();
  const r = tokenBodyKind({ kind: 'combatant', combatant }, 'top');
  // R9 (daltonisme) : la FORME du contour encode l'équipe en plus de la couleur — héros = plein, ennemi = tirets.
  const borderStyle = combatant.kind === 'hero' ? 'solid' : 'dashed';
  return (
    <span
      className="rig-portrait"
      style={{ '--rp-taille': `${size}px`, '--rp-anneau': ring, '--rp-trait': borderStyle } as CSSProperties}
    >
      <svg viewBox={r.portraitBox} width={size} height={size} preserveAspectRatio="xMidYMid slice">
        {r.body}
      </svg>
    </span>
  );
}
