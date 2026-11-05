import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

export const prop: PropViz = { id: "charrette", render: ()=>`<g><circle cx="44" cy="138" r="16" fill="${P.boisSombre16}"/><circle cx="44" cy="138" r="6" fill="${P.boisFonce12}"/><circle cx="86" cy="138" r="16" fill="${P.boisSombre16}"/><circle cx="86" cy="138" r="6" fill="${P.boisFonce12}"/><path d="M30 110 L96 110 L90 130 L36 130 Z" fill="${P.boisFonce7}"/><path d="M30 110 L96 110" stroke="${P.boisSombre2}" stroke-width="3"/><path d="M96 116 L112 122" stroke="${P.boisSombre2}" stroke-width="4"/></g>` };
