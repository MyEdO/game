import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Banc en bois : longue assise sans dossier sur quatre pieds. Mobilier le long des murs de la salle
// verte et des vestiaires des chœurs du théâtre (les artistes s'y assoient pour se changer). Cf. plan
// officiel NADJ 08 folio 38, image (longues banquettes contre les cloisons).
export const prop: PropViz = {
  id: 'banc',
  label: 'Banc',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="46" ry="8" fill="${P.ombre}" opacity="0.2"/>` +
    // pieds
    `<rect x="30" y="116" width="6" height="30" fill="${P.boisSombre4}"/><rect x="84" y="116" width="6" height="30" fill="${P.boisSombre4}"/>` +
    `<rect x="46" y="116" width="5" height="28" fill="${P.boisSombre7}"/><rect x="69" y="116" width="5" height="28" fill="${P.boisSombre7}"/>` +
    // assise (planche en perspective)
    `<path d="M22 112 L98 112 L92 104 L28 104 Z" fill="${P.boisFonce8}"/>` +
    `<rect x="22" y="112" width="76" height="7" rx="2" fill="${P.boisFonce7}"/>` +
    `<path d="M28 104 L92 104" stroke="${P.boisMoyen2}" stroke-width="1.2" opacity="0.7"/></g>`,
};
