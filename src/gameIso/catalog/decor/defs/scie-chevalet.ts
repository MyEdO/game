import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Chevalet de sciage (tréteau) portant une planche en cours de débit, avec une scie posée dessus. Le
// poste de travail de la « Charpenterie et décors » (26) du théâtre. Cf. plan officiel NADJ 08 folio 38 (image)
// (tréteaux et bois de charpente).
export const prop: PropViz = {
  id: 'scie-chevalet',
  label: 'Chevalet de sciage',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="38" ry="8" fill="${P.ombre}" opacity="0.2"/>` +
    // tréteau (pieds en X)
    `<path d="M34 146 L52 104 M50 146 L36 104" stroke="${P.boisSombre4}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M72 146 L88 104 M86 146 L70 104" stroke="${P.boisSombre4}" stroke-width="6" stroke-linecap="round"/>` +
    `<rect x="34" y="100" width="56" height="8" rx="2" fill="${P.boisFonce7}"/>` +
    // planche en débit posée dessus
    `<path d="M24 96 L102 90 L102 99 L24 105 Z" fill="${P.boisMoyen10}"/>` +
    `<path d="M24 96 L102 90" stroke="${P.boisFonce24}" stroke-width="1.5" opacity="0.7"/>` +
    // scie posée
    `<path d="M58 90 L86 84 L86 88 L58 94 Z" fill="${P.pierreTresClair}"/>` +
    `<path d="M58 94 L86 88" stroke="${P.pierreMoyen}" stroke-width="1" opacity="0.8"/>` +
    `<rect x="54" y="88" width="8" height="6" rx="2" fill="${P.boisSombre4}"/></g>`,
};
