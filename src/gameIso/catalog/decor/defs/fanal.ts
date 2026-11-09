import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Fanal de bord : une lanterne vitrée à cage de fer au bout d'une hampe de bois plantée dans le plancher — halo chaud
// (groupe « warm »).
export const prop: PropViz = {
  id: 'fanal',
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="12" ry="4" fill="${P.ombre}" opacity="0.25"/>` +
    // Sabot de fer et hampe
    `<path d="M54 148 h12 v-5 h-12 Z" fill="${P.pierreSombre7}"/>` +
    `<path d="M58 143 L58 78 L62 78 L62 143 Z" fill="${P.boisFonce12}"/>` +
    // Socle, corps vitré (halo + flamme), chapeau
    `<path d="M50 78 h20 v-4 h-20 Z" fill="${P.pierreSombre6}"/>` +
    `<g class="warm"><path d="M52 74 L68 74 L67 50 L53 50 Z" fill="${P.orClair3}"/>` +
    `<path d="M60 70 Q55 61 60 54 Q63 62 65 59 Q66 67 60 70 Z" fill="${P.boisTresClair6}"/></g>` +
    `<path d="M56 74 L56 50 M64 74 L64 50 M52.5 62 h15" stroke="${P.pierreSombre7}" stroke-width="1.8"/>` +
    `<path d="M49 50 h22 v-4 h-22 Z" fill="${P.pierreSombre6}"/>` +
    `<path d="M50 46 L60 38 L70 46 Z" fill="${P.pierreSombre7}"/>` +
    `</g>`,
};
