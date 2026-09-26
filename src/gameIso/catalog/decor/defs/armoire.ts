import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Armoire : haut meuble de rangement à deux portes panneautées, corniche en saillie, poignées de laiton.
// Garde-robes des loges d'artistes et rangements des costumes du théâtre. Cf. plan officiel NADJ 08 folio 38 (image).
export const prop: PropViz = {
  id: 'armoire',
  label: 'Armoire',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="32" ry="8" fill="${P.ombre}" opacity="0.22"/>` +
    // petits pieds
    `<rect x="30" y="138" width="7" height="9" fill="${P.boisSombre6}"/><rect x="83" y="138" width="7" height="9" fill="${P.boisSombre6}"/>` +
    // caisson
    `<rect x="28" y="38" width="64" height="102" rx="2" fill="${P.boisFonce7}"/>` +
    `<rect x="28" y="38" width="64" height="102" rx="2" fill="none" stroke="${P.boisSombre6}" stroke-width="2"/>` +
    // corniche en saillie
    `<rect x="24" y="30" width="72" height="10" rx="2" fill="${P.boisFonce4}"/>` +
    `<rect x="24" y="30" width="72" height="4" rx="2" fill="${P.boisFonce8}"/>` +
    // deux portes panneautées
    `<rect x="32" y="44" width="27" height="90" rx="1.5" fill="${P.boisSombre4}"/>` +
    `<rect x="61" y="44" width="27" height="90" rx="1.5" fill="${P.boisSombre4}"/>` +
    `<rect x="36" y="50" width="19" height="36" rx="2" fill="none" stroke="${P.boisSombre7}" stroke-width="2"/>` +
    `<rect x="36" y="92" width="19" height="36" rx="2" fill="none" stroke="${P.boisSombre7}" stroke-width="2"/>` +
    `<rect x="65" y="50" width="19" height="36" rx="2" fill="none" stroke="${P.boisSombre7}" stroke-width="2"/>` +
    `<rect x="65" y="92" width="19" height="36" rx="2" fill="none" stroke="${P.boisSombre7}" stroke-width="2"/>` +
    `<path d="M36 50 L55 86 M55 50 L36 86 M65 50 L84 86 M84 50 L65 86" stroke="${P.boisSombre7}" stroke-width="0.8" opacity="0.4"/>` +
    // poignées laiton au centre
    `<rect x="56" y="84" width="3" height="14" rx="1.5" fill="${P.orMoyen}"/><rect x="61" y="84" width="3" height="14" rx="1.5" fill="${P.orMoyen}"/></g>`,
};
