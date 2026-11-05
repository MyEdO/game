import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Clocheton / campanile de chapelle : fût de pierre, flèche d'ardoise à deux faces, baie abritant une
// cloche de bronze, croix dorée en faîteau — silhouette qui se lit de loin (ornement 'ridge').
export const prop: PropViz = {
  id: 'clocheton',
  render: () =>
    `<g>` +
    `<rect x="58" y="14" width="4" height="16" fill="${P.orFonce4}"/>` +
    `<rect x="52" y="18" width="16" height="3.5" fill="${P.orFonce4}"/>` +
    `<circle cx="60" cy="12" r="3" fill="${P.orMoyen4}"/>` +
    `<path d="M60 26 L44 66 L60 66 Z" fill="${P.pierreFonce3}"/>` +
    `<path d="M60 26 L76 66 L60 66 Z" fill="${P.pierreSombre4}"/>` +
    `<rect x="42" y="63" width="36" height="7" fill="${P.pierreMoyen}"/>` +
    `<rect x="46" y="70" width="28" height="80" fill="${P.pierreFonce}"/>` +
    `<rect x="46" y="70" width="6" height="80" fill="${P.pierreMoyen2}"/>` +
    `<rect x="68" y="70" width="6" height="80" fill="${P.pierreFonce2}"/>` +
    `<path d="M46 100 H74 M46 126 H74" stroke="${P.pierreSombre4}" stroke-width="1.5"/>` +
    `<path d="M52 102 L52 88 Q60 78 68 88 L68 102 Z" fill="${P.ombre3}"/>` +
    `<rect x="55" y="85" width="10" height="2.5" fill="${P.orFonce}"/>` +
    `<path d="M56 89 Q56 86 60 86 Q64 86 64 89 L65 97 Q60 99 55 97 Z" fill="${P.orFonce4}"/>` +
    `<path d="M58 89 Q58 87 60 87 L60 96 Q58 96 57 95 Z" fill="${P.orMoyen4}"/>` +
    `<circle cx="60" cy="99" r="1.4" fill="${P.orFonce}"/>` +
    `</g>`,
};
