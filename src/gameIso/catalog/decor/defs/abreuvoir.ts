import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Abreuvoir de bois plein d'eau (place du bourg, écuries) — empreinte 2×1.
export const prop: PropViz = { id: "abreuvoir", render: ()=>`<g><ellipse cx="60" cy="147" rx="46" ry="9" fill="${P.ombre}" opacity="0.2"/><path d="M16 120 L104 120 L98 146 L22 146 Z" fill="${P.boisFonce21}"/><path d="M16 120 L104 120 L102 128 L18 128 Z" fill="${P.boisFonce25}"/><ellipse cx="60" cy="122" rx="42" ry="7" fill="${P.azurFonce2}"/><ellipse cx="60" cy="121" rx="38" ry="5" fill="${P.azurMoyen}" opacity="0.8"/><path d="M34 120 q8 3 16 0 M62 122 q9 3 18 0" stroke="${P.azurTresClair2}" stroke-width="1.5" fill="none" opacity="0.55"/><path d="M24 146 L24 152 M96 146 L96 152" stroke="${P.boisSombre15}" stroke-width="5"/><path d="M30 132 h60" stroke="${P.boisSombre15}" stroke-width="2" opacity="0.5"/></g>` };
