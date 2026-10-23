import type { CSSProperties, ReactNode } from 'react';

/**
 * Jauge à CRANS générique (segments discrets gravés, pas une barre continue) — porte les jauges du
 * navire partout (Coque, Moral d'équipage, Humeur de Manann, surcharge de soute). Sans adaptation :
 * le domaine (`min`/`max`), le nombre de crans, le ton sémantique et l'affichage sont paramétrables.
 * Ton dérivable d'un ton fixe OU d'une fonction `(value,max)→ton` (bande de Moral, palier de soute).
 */

export type GaugeTone = 'ok' | 'warn' | 'danger' | 'neutral' | 'corruption' | 'resource';

export interface NotchGaugeProps {
  value: number;
  max: number;
  /** Borne basse du domaine (défaut 0) — domaines à valeurs négatives (Humeur de Manann). */
  min?: number;
  label?: string;
  icon?: ReactNode;
  /** Ton fixe, OU fonction `(value,max)→ton` (bande de Moral, palier de surcharge). Défaut `neutral`. */
  tone?: GaugeTone | ((value: number, max: number) => GaugeTone);
  /** Nombre de crans gravés. Défaut 10. */
  notches?: number;
  /** Valeurs de SEUIL gravées sur la piste (paliers de surcharge 100/120/140…). */
  marks?: number[];
  /** Rendu de la valeur. Défaut `${value} / ${max}`. */
  format?: (value: number, max: number) => string;
  /** Variante empilée : label au-dessus de la piste (défaut : une ligne). */
  stacked?: boolean;
  /** Taille FIXE (px) par cran — la piste se dimensionne à SES crans (`notches × cellSize`), jamais
   *  étirée au conteneur. Sans cette prop : piste flexible pleine largeur,
   *  adaptée aux jauges à nombreux crans. Réservé aux jauges à PEU de crans (Destin, Corruption). */
  cellSize?: number;
  className?: string;
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

export function NotchGauge({
  value,
  max,
  min = 0,
  label,
  icon,
  tone,
  notches = 10,
  marks,
  format,
  stacked,
  cellSize,
  className,
}: NotchGaugeProps) {
  const span = Math.max(1, max - min);
  const frac = clamp01((value - min) / span);
  const n = Math.max(1, Math.round(notches));
  const filled = Math.round(frac * n);
  const t: GaugeTone = typeof tone === 'function' ? tone(value, max) : tone ?? 'neutral';
  const display = format ? format(value, max) : `${value} / ${max}`;

  return (
    <div
      className={`notch-gauge${className ? ` ${className}` : ''}`}
      data-tone={t}
      data-stacked={stacked ? '' : undefined}
      data-fixed={cellSize != null ? '' : undefined}
    >
      {(icon != null || label != null) && (
        <div className="notch-gauge__head">
          {icon != null && <span className="notch-gauge__icon">{icon}</span>}
          {label != null && <span className="notch-gauge__label">{label}</span>}
        </div>
      )}
      <div
        className="notch-gauge__track"
        role="meter"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div
          className="notch-gauge__notches"
          style={{ '--notch-w': cellSize != null ? `${n * cellSize + (n - 1) * 2}px` : 'initial' } as CSSProperties}
        >
          {Array.from({ length: n }, (_, i) => (
            <span
              key={i}
              className="notch-gauge__notch"
              data-on={i < filled ? '' : undefined}
              style={{ '--cell-w': cellSize != null ? `${cellSize}px` : 'initial' } as CSSProperties}
            />
          ))}
        </div>
        {marks?.map((m, i) => (
          <span
            key={i}
            className="notch-gauge__mark"
            data-mark={m}
            style={{ '--mark-at': `${clamp01((m - min) / span) * 100}%` } as CSSProperties}
          />
        ))}
      </div>
      <span className="notch-gauge__value">{display}</span>
    </div>
  );
}
