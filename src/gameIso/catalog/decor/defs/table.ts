import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Table en bois : plateau (dessus en perspective) + quatre pieds. Meuble de base des pièces de service
// du théâtre (salle verte, loges d'artistes, costumiers). Cf. plan officiel NADJ 08 folio 38 (image).
export const prop: PropViz = {
  id: 'table',
  label: 'Table',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="42" ry="9" fill="${P.ombre}" opacity="0.2"/>` +
    `<rect x="34" y="106" width="6" height="42" fill="${P.boisSombre4}"/><rect x="80" y="106" width="6" height="42" fill="${P.boisSombre4}"/>` + // pieds avant
    `<rect x="47" y="104" width="5" height="40" fill="${P.boisSombre7}"/><rect x="68" y="104" width="5" height="40" fill="${P.boisSombre7}"/>` + // pieds arrière
    `<path d="M22 102 L98 102 L90 94 L30 94 Z" fill="${P.boisFonce8}"/>` + // dessus (perspective)
    `<rect x="22" y="102" width="76" height="8" rx="2" fill="${P.boisFonce7}"/>` + // tranche du plateau
    `<path d="M30 94 L90 94 L98 102" fill="none" stroke="${P.boisMoyen2}" stroke-width="1.5" opacity="0.7"/></g>`,
};
