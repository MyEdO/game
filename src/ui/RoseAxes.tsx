/**
 * RoseAxes — la « rose des forces » (mini-radar gravé, langage Atelier). Rend N branches (N = axes
 * ACTIFS de la campagne, `src/data/axes.json`), PARAMÉTRABLE (jamais figé à 6). Tracé/dimensions
 * repris à l'identique du kit ratifié « Atelier du scribe », § « La rose des forces » (arbitrage
 * axes 2026-07-13, #409).
 * AUCUN placement en jeu dans ce lot (#417) : ce fichier n'expose que la primitive + son spécimen
 * galerie.
 */

/** Une branche de la rose : `value` = score normalisé 0..1 (`axisScore`, `src/engine/axes.ts`) ;
 *  `null`/`undefined` = axe non calculable (rendu comme « — », jamais un 0 trompeur). */
export interface RoseAxisValue {
  id: string;
  label: string;
  value: number | null | undefined;
}

/** `glyph` (44px, coin de carte — sans étiquette), `medal` (90×86 médaillon — initiale par
 *  branche), `grand` (280×196 rendu plein — libellé complet + valeur). Dimensions du kit ratifié. */
export type RoseSize = 'glyph' | 'medal' | 'grand';

const SIZE_CFG: Record<RoseSize, { w: number; h: number; r: number; labR?: number; fontSize?: number; labelMode?: 'init' | 'full' }> = {
  glyph: { w: 44, h: 44, r: 18 },
  medal: { w: 100, h: 96, r: 30, labR: 38.5, fontSize: 8, labelMode: 'init' },
  grand: { w: 280, h: 196, r: 70, labR: 84, fontSize: 10.5, labelMode: 'full' },
};

/** Point sur le cercle de rayon `r`, branche `i`/`n` — départ au zénith, sens horaire (même
 *  convention que le kit : toutes les roses d'un écran partagent le même ordre d'axes). */
function pointOn(cx: number, cy: number, r: number, i: number, n: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export function RoseAxes({ axes, size = 'glyph', title, className }: {
  axes: RoseAxisValue[];
  size?: RoseSize;
  /** Titre a11y (`<title>` SVG) — sinon un intitulé générique. */
  title?: string;
  className?: string;
}) {
  const n = axes.length;
  if (n < 3) return null; // une rose a besoin d'au moins 3 branches pour avoir un sens géométrique.
  const cfg = SIZE_CFG[size];
  const cx = cfg.w / 2;
  const cy = cfg.h / 2;
  const empty = axes.every((a) => a.value == null);
  const pts = axes.map((a, i) => pointOn(cx, cy, (cfg.r * Math.max((a.value ?? 0) * 100, 6)) / 100, i, n));
  const desc = axes.map((a) => `${a.label} : ${a.value == null ? 'inconnu' : `${Math.round(a.value * 100)} %`}`).join(', ');

  return (
    <svg
      viewBox={`0 0 ${cfg.w} ${cfg.h}`}
      width={cfg.w}
      height={cfg.h}
      className={`rose${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={title ?? `Rose des forces (${axes.length} axes)`}
    >
      <title>{title ?? 'Rose des forces'}</title>
      <desc>{desc}</desc>
      <defs>
        <radialGradient id="rose-well" cx="40%" cy="35%">
          <stop offset="0" stopColor="var(--atelier-rose-well-hi)" />
          <stop offset="1" stopColor="var(--atelier-rose-well-lo)" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={cfg.r} fill="url(#rose-well)" stroke={empty ? 'var(--atelier-wood-etch)' : 'var(--atelier-brass-hover)'} strokeWidth={size === 'glyph' ? 1.3 : 1.6} />
      <circle cx={cx} cy={cy + 0.8} r={cfg.r} fill="none" stroke={empty ? 'var(--atelier-rose-rim-empty)' : 'var(--atelier-rose-rim)'} strokeWidth={0.8} />
      {[2 / 3, 1 / 3].map((f) => (
        <circle key={f} cx={cx} cy={cy} r={cfg.r * f} fill="none" stroke={empty ? 'var(--atelier-wood-top)' : 'var(--atelier-wood-hollow)'} strokeWidth={0.7} />
      ))}
      {axes.map((a, i) => {
        const [px, py] = pointOn(cx, cy, cfg.r, i, n);
        return (
          <g key={a.id}>
            <line x1={cx} y1={cy} x2={px} y2={py} stroke={empty ? 'var(--atelier-wood-top)' : 'var(--atelier-wood-etch)'} strokeWidth={0.8} />
            <circle cx={px} cy={py} r={size === 'glyph' ? 1.1 : 1.4} fill={empty ? 'var(--atelier-wood-hollow)' : 'var(--atelier-brass-hover)'} />
          </g>
        );
      })}
      {empty ? (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="var(--atelier-rose-empty-ink)" fontSize={size === 'glyph' ? 11 : 14}>—</text>
      ) : (
        <>
          <polygon
            points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
            fill="var(--atelier-rose-fill)"
            stroke="var(--atelier-rose-stroke)"
            strokeWidth={size === 'glyph' ? 1.1 : 1.3}
            strokeLinejoin="round"
          />
          {pts.map(([x, y], i) => (
            <circle key={axes[i].id} cx={x} cy={y} r={size === 'glyph' ? 1.2 : 1.7} fill="var(--atelier-brass-light)" />
          ))}
        </>
      )}
      {cfg.labelMode && axes.map((a, i) => {
        const [lx, ly] = pointOn(cx, cy, cfg.labR!, i, n);
        const anchor = Math.abs(lx - cx) < 4 ? 'middle' : lx > cx ? 'start' : 'end';
        const ink = empty ? 'var(--atelier-rose-empty-ink)' : 'var(--atelier-brass-rubric)';
        return (
          <text key={a.id} x={lx.toFixed(1)} y={ly.toFixed(1)} textAnchor={anchor} dominantBaseline="central" fill={ink} fontSize={cfg.fontSize} letterSpacing=".4">
            {cfg.labelMode === 'init' ? a.label.charAt(0).toUpperCase() : (
              <>
                {`${a.label} `}
                <tspan fill={empty ? 'var(--atelier-rose-empty-ink)' : 'var(--atelier-brass-elu)'} fontWeight={600}>
                  {a.value == null ? '—' : Math.round(a.value * 100)}
                </tspan>
              </>
            )}
          </text>
        );
      })}
    </svg>
  );
}
