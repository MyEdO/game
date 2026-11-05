import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Enseigne suspendue de taverne : ferrure murale (potence + jambe de force) d'où pend, par deux anneaux,
// une planche de bois peinte d'une chope moussue. Masse dans le bas de la boîte (près des pieds) pour se
// poser JUSTE au-dessus de la porte quand elle est surélevée sur la façade (ornement 'facade').
export const prop: PropViz = {
  id: 'enseigne',
  render: () =>
    `<g>` +
    `<rect x="43" y="104" width="4" height="40" fill="${P.pierreSombre5}"/>` +
    `<path d="M45 108 L86 108" stroke="${P.pierreSombre5}" stroke-width="3.5" stroke-linecap="round"/>` +
    `<path d="M45 130 L82 110" stroke="${P.pierreSombre5}" stroke-width="2.5"/>` +
    `<circle cx="56" cy="111" r="2.6" fill="none" stroke="${P.pierreSombre5}" stroke-width="1.6"/>` +
    `<circle cx="80" cy="111" r="2.6" fill="none" stroke="${P.pierreSombre5}" stroke-width="1.6"/>` +
    `<rect x="49" y="113" width="38" height="30" rx="2" fill="${P.boisFonce7}" stroke="${P.boisSombre16}" stroke-width="2"/>` +
    `<rect x="52" y="116" width="32" height="24" rx="1.5" fill="${P.boisFonce3}"/>` +
    `<rect x="60" y="121" width="12" height="15" rx="1.5" fill="${P.orMoyen}"/>` +
    `<rect x="60" y="121" width="12" height="4" fill="${P.orTresClair6}"/>` +
    `<path d="M72 124 q6 1 6 5.5 q0 4.5 -6 5.5" fill="none" stroke="${P.orFonce4}" stroke-width="2"/>` +
    `</g>`,
};
