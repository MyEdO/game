import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Nénuphars (à poser SUR l'eau du marais) — décor plat, fleur ouverte.
export const prop: PropViz = { id: "nenuphars", render: ()=>`<g><ellipse cx="44" cy="138" rx="18" ry="8" fill="${P.feuillageFonce18}"/><path d="M44 138 L58 134" stroke="${P.feuillageSombre7}" stroke-width="2"/><ellipse cx="44" cy="138" rx="18" ry="8" fill="none" stroke="${P.feuillageSombre7}" stroke-width="1"/><ellipse cx="76" cy="128" rx="15" ry="7" fill="${P.feuillageFonce19}"/><path d="M76 128 L88 124" stroke="${P.feuillageSombre7}" stroke-width="2"/><ellipse cx="58" cy="146" rx="13" ry="6" fill="${P.feuillageSombre6}"/><g transform="translate(72 126)"><path d="M0 0 l-5 -8 l5 3 l0 -9 l3 8 l5 -6 l-2 9 l8 -2 l-7 5 z" fill="${P.pourpreTresClair}"/><circle cx="1" cy="-2" r="2.2" fill="${P.orMoyen}"/></g><path d="M30 132 q6 2 12 0 M62 142 q7 2 14 0" stroke="${P.azurTresClair2}" stroke-width="1.2" fill="none" opacity="0.4"/></g>` };
