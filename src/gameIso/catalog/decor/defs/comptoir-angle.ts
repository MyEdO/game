import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Module d'ANGLE du comptoir de taverne : deux bras de caisson raccordés par un plateau continu
// (aucune fente au coin) et montant d'angle en fer. Vignette de PALETTE : le corps monde de cette
// ref est sa recette volumique (`props.json`), jamais ce dessin.
export const prop: PropViz = {
  id: 'comptoir-angle',
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="48" ry="9" fill="${P.ombre}" opacity="0.22"/>` +
    // bras de retour (fuyant), puis bras de face
    `<path d="M62 70 L106 58 L106 116 L62 130 Z" fill="${P.boisSombre7}"/>` +
    `<rect x="14" y="70" width="48" height="62" fill="${P.boisSombre4}"/>` +
    // panneaux
    `<rect x="19" y="76" width="18" height="48" rx="2" fill="${P.boisFonce7}" stroke="${P.boisSombre7}" stroke-width="1.4"/>` +
    `<rect x="41" y="76" width="18" height="48" rx="2" fill="${P.boisFonce7}" stroke="${P.boisSombre7}" stroke-width="1.4"/>` +
    `<path d="M70 74 L100 66 L100 108 L70 118 Z" fill="${P.boisFonce9}" opacity="0.9"/>` +
    // plinthes
    `<rect x="18" y="132" width="44" height="10" fill="${P.boisTresSombre}"/>` +
    `<path d="M62 130 L106 116 L106 124 L62 140 Z" fill="${P.boisTresSombre2}"/>` +
    // plateau continu : le coin ne montre aucune fente
    `<path d="M8 70 L62 70 L106 58 L100 50 L20 60 Z" fill="${P.boisFonce8}"/>` +
    `<path d="M8 70 L62 70 L106 58 L106 66 L62 78 L8 78 Z" fill="${P.boisFonce7}"/>` +
    `<path d="M20 60 L100 50" stroke="${P.boisMoyen2}" stroke-width="1.5" opacity="0.7"/>` +
    // montant d'angle en fer
    `<rect x="59" y="70" width="5" height="62" fill="${P.ombre2}"/></g>`,
};
