import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Établi de charpentier : plateau épais, pieds robustes entretoisés, étau de fer vissé en bout, planche
// + scie posées dessus. Pièce maîtresse de la charpenterie & décors du théâtre. Cf. plan officiel NADJ 08 folio 38 (image).
export const prop: PropViz = {
  id: 'etabli',
  label: 'Établi',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="44" ry="9" fill="${P.ombre}" opacity="0.22"/>` +
    // pieds robustes + entretoise
    `<rect x="22" y="100" width="9" height="46" fill="${P.boisSombre7}"/><rect x="89" y="100" width="9" height="46" fill="${P.boisSombre7}"/>` +
    `<rect x="46" y="102" width="8" height="44" fill="${P.boisSombre6}"/><rect x="66" y="102" width="8" height="44" fill="${P.boisSombre6}"/>` +
    `<rect x="24" y="128" width="72" height="7" rx="1.5" fill="${P.boisSombre4}"/>` +
    // plateau épais (perspective + tranche épaisse)
    `<path d="M16 96 L104 96 L96 84 L24 84 Z" fill="${P.boisFonce4}"/>` +
    `<rect x="16" y="96" width="88" height="13" rx="1.5" fill="${P.boisSombre4}"/>` +
    `<path d="M24 84 L96 84 L104 96" fill="none" stroke="${P.boisFonce8}" stroke-width="1.2" opacity="0.6"/>` +
    // étau de fer vissé en bout droit
    `<rect x="96" y="92" width="12" height="16" rx="1.5" fill="${P.pierreMoyen2}"/>` +
    `<rect x="92" y="94" width="6" height="12" rx="1" fill="${P.pierreMoyen}"/>` +
    `<circle cx="105" cy="100" r="3.5" fill="${P.pierreFonce2}"/><circle cx="105" cy="100" r="1.4" fill="${P.pierreClair}"/>` +
    // planche posée en diagonale sur le plateau
    `<path d="M28 90 L74 82 L76 87 L30 95 Z" fill="${P.boisMoyen2}"/>` +
    `<path d="M28 90 L74 82" stroke="${P.boisFonce4}" stroke-width="0.8"/>` +
    // scie posée (lame claire dentée + manche bois)
    `<path d="M40 80 L78 74 L78 78 L40 84 Z" fill="${P.pierreTresClair3}"/>` +
    `<path d="M40 84 L78 78" stroke="${P.pierreMoyen}" stroke-width="0.8"/>` +
    `<path d="M41 83 l2 2 l2 -2 l2 2 l2 -2 l2 2 l2 -2 l2 2 l2 -2 l2 2 l2 -2 l2 2 l2 -2 l2 2 l2 -2" fill="none" stroke="${P.pierreMoyen}" stroke-width="0.7"/>` +
    `<path d="M76 73 L86 71 L86 80 L78 78 Z" fill="${P.boisFonce7}"/></g>`,
};
