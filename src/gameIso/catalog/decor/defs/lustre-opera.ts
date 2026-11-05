import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Grand lustre d'opéra (en surplomb) : chaîne au plafond, monture dorée à deux couronnes, bras
// porte-bougies à flammes (`warm`), pampilles de cristal. Lit « lustre de théâtre » suspendu.
export const prop: PropViz = {
  id: 'lustre-opera',
  render: () =>
    `<g><ellipse cx="60" cy="146" rx="18" ry="5" fill="${P.ombre}" opacity="0.12"/>` +
    `<path d="M60 0 L60 30" stroke="${P.boisFonce49}" stroke-width="2"/><circle cx="60" cy="6" r="2" fill="${P.boisFonce49}"/>` +
    `<path d="M52 30 L68 30 L64 38 L56 38 Z" fill="${P.boisMoyen21}"/>` +
    `<rect x="57" y="38" width="6" height="42" fill="${P.boisMoyen23}"/><ellipse cx="60" cy="80" rx="9" ry="6" fill="${P.boisMoyen21}"/>` +
    `<ellipse cx="60" cy="58" rx="34" ry="9" fill="none" stroke="${P.boisMoyen21}" stroke-width="3"/>` +
    `<ellipse cx="60" cy="72" rx="22" ry="7" fill="none" stroke="${P.orMoyen9}" stroke-width="3"/>` +
    [26, 42, 60, 78, 94].map((x) => `<path d="M60 50 Q${x} 46 ${x} 56" stroke="${P.boisMoyen21}" stroke-width="2.4" fill="none"/><rect x="${x - 3}" y="48" width="6" height="9" rx="1" fill="${P.orTresClair13}"/>`).join('') +
    `<g class="warm">` +
    [26, 42, 60, 78, 94].map((x) => `<path d="M${x} 48 Q${x - 4} 40 ${x} 33 Q${x + 4} 40 ${x} 48 Z" fill="${P.boisMoyen}"/><path d="M${x} 47 Q${x - 2} 42 ${x} 37 Q${x + 2} 42 ${x} 47 Z" fill="${P.boisTresClair6}"/>`).join('') +
    `</g>` +
    [34, 48, 60, 72, 86].map((x) => `<path d="M${x} 78 L${x - 2} 84 L${x} 90 L${x + 2} 84 Z" fill="${P.azurTresClair}" opacity="0.85"/>`).join('') +
    `</g>`,
};
