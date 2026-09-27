import { DIR8_ORDER, type Dir8 } from '../state/dir8';
import { windForces, windForceLabel, type SeaWindForceId } from '../engine/seaWeather';

/**
 * Rose des vents compacte (SVG) — 8 directions (vocabulaire `Dir8` du projet), flèche de PROVENANCE
 * du vent, force affichée, cap du navire en second index optionnel. La force (échelle des 6 vents,
 * MDG 13) mappe à une intensité visuelle par token via `data-force`. Lisible dès 48px.
 */

export interface WindRoseProps {
  /** Provenance du vent sur la rose (rose des vents, MDG 13) — la flèche pointe vers ce cap. */
  dir: Dir8;
  /** Force du vent (`SeaWindForceId`, MDG 13). */
  force: SeaWindForceId;
  /** Cap du navire (second index optionnel, aiguille dorée). */
  heading?: Dir8;
  size?: 'sm' | 'md';
  className?: string;
}

/** Cap Dir8 → angle horaire depuis le nord (0° = haut de la rose). */
const DIR8_DEG: Record<Dir8, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SO: 225, O: 270, NO: 315,
};

const point = (deg: number, r: number): { x: number; y: number } => {
  const a = (deg * Math.PI) / 180;
  return { x: 50 + Math.sin(a) * r, y: 50 - Math.cos(a) * r };
};

export function WindRose({ dir, force, heading, size = 'md', className }: WindRoseProps) {
  const intensity = Math.max(0, windForces().indexOf(force)); // 0..5 (calme-plat → violente-tempête)
  const forceLabel = windForceLabel(force);

  return (
    <div
      className={`wind-rose wind-rose--${size}${className ? ` ${className}` : ''}`}
      data-force={force}
      data-dir={dir}
    >
      <svg
        viewBox="0 0 100 100"
        className="wind-rose__svg"
        role="img"
        aria-label={`Vent ${forceLabel} de ${dir}${heading != null ? `, cap ${heading}` : ''}`}
      >
        <circle className="wind-rose__ring" cx="50" cy="50" r="46" />
        {DIR8_ORDER.map((d) => {
          const p = point(DIR8_DEG[d], 46);
          return (
            <circle
              key={d}
              className="wind-rose__tick"
              data-card={d === 'N' ? '' : undefined}
              cx={p.x}
              cy={p.y}
              r={d === 'N' ? 3 : 1.6}
            />
          );
        })}
        {heading != null && (
          <line
            className="wind-rose__heading"
            data-heading={heading}
            x1={50}
            y1={50}
            x2={point(DIR8_DEG[heading], 40).x}
            y2={point(DIR8_DEG[heading], 40).y}
          />
        )}
        <g
          className="wind-rose__wind"
          data-intensity={intensity}
          transform={`rotate(${DIR8_DEG[dir]} 50 50)`}
        >
          <line className="wind-rose__shaft" x1="50" y1="50" x2="50" y2="22" />
          <path className="wind-rose__head" d="M50 12 L44 26 L50 21 L56 26 Z" />
        </g>
      </svg>
      <span className="wind-rose__force">{forceLabel}</span>
    </div>
  );
}
