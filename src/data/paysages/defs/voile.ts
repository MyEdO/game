import type { FamilleDeCouches } from '../types';

/* Le voile qui ferme les coins du paysage, par-dessus tout le reste. */
export const couches: FamilleDeCouches = [
  {
    id: 'voile-coins',
    label: 'Vignette',
    svg: `<defs><radialGradient id="voile-coins-fondu" cx="0.5" cy="0.48" r="0.72"><stop offset="0.45" stop-color="var(--shadow-ink)" stop-opacity="0"/><stop offset="0.8" stop-color="var(--shadow-ink)" stop-opacity="0.38"/><stop offset="1" stop-color="var(--shadow-ink)" stop-opacity="0.82"/></radialGradient></defs>
    <rect x="0" y="0" width="1600" height="900" fill="url(#voile-coins-fondu)"/>` },
];
