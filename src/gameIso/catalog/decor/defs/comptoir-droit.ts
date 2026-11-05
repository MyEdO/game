import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Module DROIT du comptoir de taverne : caisson de chêne à quatre panneaux, plateau débordant,
// plinthe en retrait et barre de pied en fer. Vignette de PALETTE : le corps monde de cette ref est
// sa recette volumique (`props.json`), jamais ce dessin.
export const prop: PropViz = {
  id: 'comptoir-droit',
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="46" ry="8" fill="${P.ombre}" opacity="0.22"/>` +
    // caisson
    `<rect x="18" y="72" width="84" height="62" fill="${P.boisSombre4}"/>` +
    // quatre panneaux
    `<rect x="23" y="78" width="16" height="48" rx="2" fill="${P.boisFonce7}" stroke="${P.boisSombre7}" stroke-width="1.4"/>` +
    `<rect x="43" y="78" width="16" height="48" rx="2" fill="${P.boisFonce7}" stroke="${P.boisSombre7}" stroke-width="1.4"/>` +
    `<rect x="61" y="78" width="16" height="48" rx="2" fill="${P.boisFonce7}" stroke="${P.boisSombre7}" stroke-width="1.4"/>` +
    `<rect x="81" y="78" width="16" height="48" rx="2" fill="${P.boisFonce7}" stroke="${P.boisSombre7}" stroke-width="1.4"/>` +
    // plinthe en retrait
    `<rect x="22" y="134" width="76" height="10" fill="${P.boisTresSombre}"/>` +
    // plateau débordant
    `<path d="M12 72 L108 72 L100 62 L20 62 Z" fill="${P.boisFonce8}"/>` +
    `<rect x="12" y="72" width="96" height="8" rx="2" fill="${P.boisFonce7}"/>` +
    `<path d="M20 62 L100 62" stroke="${P.boisMoyen2}" stroke-width="1.5" opacity="0.7"/>` +
    // barre de pied
    `<path d="M24 122 H96" stroke="${P.ombre2}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M28 122 V134 M92 122 V134" stroke="${P.ombre2}" stroke-width="3"/></g>`,
};
