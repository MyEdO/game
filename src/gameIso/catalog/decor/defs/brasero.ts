import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Brasero de fer sur trépied (crypte, donjon) — flamme chaude (groupe « warm »).
export const prop: PropViz = { id: "brasero", render: ()=>`<g><ellipse cx="60" cy="147" rx="22" ry="8" fill="${P.ombre}" opacity="0.25"/><path d="M48 146 L58 116 M72 146 L62 116 M60 146 L60 118" stroke="${P.pierreSombre7}" stroke-width="4" stroke-linecap="round"/><path d="M40 104 Q60 96 80 104 L76 120 Q60 126 44 120 Z" fill="${P.pierreFonce4}"/><ellipse cx="60" cy="104" rx="20" ry="7" fill="${P.pierreSombre6}"/><path d="M44 112 h32" stroke="${P.pierreSombre4}" stroke-width="2" opacity="0.7"/><g class="warm"><path d="M60 104 Q50 86 60 68 Q65 82 71 76 Q76 94 60 104 Z" fill="${P.boisMoyen}"/><path d="M60 102 Q55 90 60 80 Q64 90 60 102 Z" fill="${P.boisTresClair6}"/></g><circle cx="52" cy="102" r="2" fill="${P.boisClair2}" opacity="0.9"/><circle cx="68" cy="103" r="1.6" fill="${P.boisClair4}" opacity="0.9"/></g>` };
