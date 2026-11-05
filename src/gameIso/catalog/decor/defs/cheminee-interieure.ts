import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Cheminée INTÉRIEURE de salle commune : âtre de pierre appareillée (socle, deux jambages, manteau
// débordant), fond d'âtre sombre, chenets de fer et lit de braises. Vignette de PALETTE : le corps
// monde de cette ref est sa recette volumique (`props.json`), jamais ce dessin.
export const prop: PropViz = {
  id: 'cheminee-interieure',
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="46" ry="8" fill="${P.ombre}" opacity="0.22"/>` +
    // manteau débordant
    `<rect x="12" y="40" width="96" height="14" fill="${P.pierreMoyen}"/>` +
    `<rect x="12" y="52" width="96" height="4" fill="${P.pierreSombre4}" opacity="0.8"/>` +
    // jambages
    `<rect x="16" y="56" width="24" height="82" fill="${P.pierreFonce}"/>` +
    `<rect x="80" y="56" width="24" height="82" fill="${P.pierreFonce2}"/>` +
    `<path d="M16 78 H40 M16 100 H40 M80 78 H104 M80 100 H104" stroke="${P.pierreSombre}" stroke-width="1.6"/>` +
    // fond d'âtre
    `<rect x="40" y="56" width="40" height="82" fill="${P.ombre3}"/>` +
    // socle
    `<rect x="12" y="132" width="96" height="12" fill="${P.pierreMoyen2}"/>` +
    // chenets de fer
    `<path d="M48 132 V118 M72 132 V118" stroke="${P.ombre2}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M46 124 H74" stroke="${P.ombre2}" stroke-width="3"/>` +
    // lit de braises
    `<ellipse cx="60" cy="130" rx="18" ry="6" fill="${P.sangFonce}"/>` +
    `<ellipse cx="60" cy="129" rx="11" ry="4" fill="${P.sangMoyen}" opacity="0.9"/>` +
    `<ellipse cx="60" cy="128" rx="5" ry="2" fill="${P.orMoyen}" opacity="0.8"/></g>`,
};
