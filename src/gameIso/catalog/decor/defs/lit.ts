import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Lit de repos : tête de lit panneautée, matelas, couverture sobre, oreiller. Banquette de repos des
// artistes dans les loges du théâtre. Meuble large (2×1) — le sprite remplit la largeur. Cf. plan NADJ 08 folio 38 (image).
export const prop: PropViz = {
  id: 'lit',
  label: 'Lit',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="56" ry="9" fill="${P.ombre}" opacity="0.22"/>` +
    // cadre + pieds
    `<rect x="8" y="128" width="104" height="14" rx="2" fill="${P.boisSombre4}"/>` +
    `<rect x="12" y="140" width="8" height="7" fill="${P.boisSombre6}"/><rect x="100" y="140" width="8" height="7" fill="${P.boisSombre6}"/>` +
    // tête de lit panneautée (côté droit, plus haute)
    `<rect x="98" y="66" width="14" height="74" rx="2" fill="${P.boisFonce7}"/>` +
    `<rect x="98" y="60" width="14" height="10" rx="3" fill="${P.boisFonce4}"/>` +
    `<rect x="101" y="78" width="8" height="50" rx="2" fill="none" stroke="${P.boisSombre7}" stroke-width="1.5"/>` +
    // pied de lit (côté gauche, bas)
    `<rect x="8" y="108" width="12" height="34" rx="2" fill="${P.boisFonce7}"/>` +
    // matelas
    `<path d="M20 116 L98 108 L98 124 L20 130 Z" fill="${P.boisClair10}"/>` +
    `<path d="M20 116 L98 108" stroke="${P.boisClair12}" stroke-width="1.2"/>` +
    // couverture sobre (drapé)
    `<path d="M20 122 L78 116 L78 132 L20 136 Z" fill="${P.boisFonce6}"/>` +
    `<path d="M20 122 L78 116" stroke="${P.boisFonce9}" stroke-width="1"/>` +
    `<path d="M34 120 L34 134 M50 118 L50 133 M64 117 L64 132" stroke="${P.boisFonce9}" stroke-width="0.9" opacity="0.6"/>` +
    // oreiller côté tête
    `<path d="M82 110 L98 108 L98 120 L82 122 Z" fill="${P.boisTresClair5}"/>` +
    `<path d="M84 111 Q90 109 96 110" stroke="${P.orClair5}" stroke-width="1" fill="none"/></g>`,
};
