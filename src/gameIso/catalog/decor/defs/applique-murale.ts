import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Applique murale dorée : platine, trois bras à bougies et flammes vacillantes (`warm`) —
// l'éclairage des couloirs et loges de l'Opéra. (Sans empreinte : fixée au mur.)
export const prop: PropViz = {
  id: 'applique-murale',
  render: () =>
    `<g><ellipse cx="60" cy="146" rx="14" ry="4" fill="${P.ombre}" opacity="0.12"/>` +
    `<path d="M55 72 L65 72 L63 100 L57 100 Z" fill="${P.boisMoyen23}"/><ellipse cx="60" cy="72" rx="8" ry="4" fill="${P.boisMoyen21}"/><ellipse cx="60" cy="100" rx="6" ry="3" fill="${P.orFonce2}"/>` +
    `<path d="M60 84 Q42 80 38 64" stroke="${P.boisMoyen21}" stroke-width="2.6" fill="none"/><path d="M60 84 Q78 80 82 64" stroke="${P.boisMoyen21}" stroke-width="2.6" fill="none"/><path d="M60 88 L60 62" stroke="${P.boisMoyen21}" stroke-width="2.6"/>` +
    `<rect x="35" y="56" width="6" height="9" rx="1" fill="${P.orTresClair13}"/><rect x="79" y="56" width="6" height="9" rx="1" fill="${P.orTresClair13}"/><rect x="57" y="52" width="6" height="9" rx="1" fill="${P.orTresClair13}"/>` +
    `<g class="warm">` +
    [38, 82, 60].map((x, i) => `<path d="M${x} ${56 - (i === 2 ? 4 : 0)} Q${x - 4} ${48 - (i === 2 ? 4 : 0)} ${x} ${41 - (i === 2 ? 5 : 0)} Q${x + 4} ${48 - (i === 2 ? 4 : 0)} ${x} ${56 - (i === 2 ? 4 : 0)} Z" fill="${P.boisMoyen}"/><path d="M${x} ${55 - (i === 2 ? 4 : 0)} Q${x - 2} ${50 - (i === 2 ? 4 : 0)} ${x} ${45 - (i === 2 ? 4 : 0)} Q${x + 2} ${50 - (i === 2 ? 4 : 0)} ${x} ${55 - (i === 2 ? 4 : 0)} Z" fill="${P.boisTresClair6}"/>`).join('') +
    `</g></g>`,
};
