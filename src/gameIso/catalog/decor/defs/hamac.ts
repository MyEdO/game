import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Hamac de marin (MDG 09 l.87) : toile écrue tendue entre deux bâtons d'écarteur, suspendue par ses cordes à deux montants.
export const prop: PropViz = {
  id: 'hamac',
  render: () =>
    `<g><ellipse cx="60" cy="146" rx="50" ry="8" fill="${P.ombre}" opacity="0.2"/>` +
    // montants
    `<rect x="10" y="82" width="7" height="62" rx="1.5" fill="${P.boisFonce7}"/><rect x="103" y="82" width="7" height="62" rx="1.5" fill="${P.boisFonce7}"/>` +
    `<rect x="9" y="80" width="9" height="5" rx="1.5" fill="${P.boisSombre4}"/><rect x="102" y="80" width="9" height="5" rx="1.5" fill="${P.boisSombre4}"/>` +
    // cordes d'attache, des montants aux écarteurs
    `<path d="M17 88 L27 104 M17 88 L27 112 M103 88 L93 104 M103 88 L93 112" stroke="${P.boisMoyen8}" stroke-width="1.6" fill="none"/>` +
    // écarteurs
    `<rect x="25" y="100" width="4" height="16" rx="1" fill="${P.boisSombre6}"/><rect x="91" y="100" width="4" height="16" rx="1" fill="${P.boisSombre6}"/>` +
    // toile, creusée au milieu
    `<path d="M29 102 Q60 128 91 102 L91 114 Q60 140 29 114 Z" fill="${P.boisClair10}"/>` +
    `<path d="M29 102 Q60 128 91 102" stroke="${P.boisClair12}" stroke-width="1.4" fill="none"/>` +
    `<path d="M40 110 Q42 122 40 128 M60 115 Q61 126 60 133 M80 110 Q78 122 80 128" stroke="${P.boisFonce9}" stroke-width="0.9" fill="none" opacity="0.5"/></g>`,
};
