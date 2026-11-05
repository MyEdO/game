import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Barque de pêcheur échouée (rive, ponton) — rames livrées, fouillable. Empreinte 2×1.
export const prop: PropViz = { id: "barque", render: ()=>`<g><ellipse cx="60" cy="146" rx="48" ry="10" fill="${P.ombre}" opacity="0.2"/><path d="M12 122 Q60 110 108 122 Q98 144 60 146 Q22 144 12 122 Z" fill="${P.boisFonce17}"/><path d="M12 122 Q60 110 108 122 Q60 132 12 122 Z" fill="${P.boisFonce19}"/><path d="M20 126 Q60 136 100 126 M26 132 Q60 142 94 132" stroke="${P.boisSombre15}" stroke-width="2" fill="none" opacity="0.7"/><path d="M36 122 L40 138 M82 122 L78 138" stroke="${P.boisSombre15}" stroke-width="3"/><path d="M30 116 L86 134" stroke="${P.boisMoyen4}" stroke-width="3" stroke-linecap="round"/><ellipse cx="89" cy="135" rx="6" ry="3" fill="${P.boisMoyen4}"/><path d="M50 118 q6 -2 12 0" stroke="${P.boisSombre16}" stroke-width="1.5" fill="none" opacity="0.5"/></g>` };
