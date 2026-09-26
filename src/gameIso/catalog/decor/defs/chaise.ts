import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Chaise en bois : assise, dossier à barreaux, quatre pieds. Le siège des pièces de service du théâtre
// (loges d'artistes, bureaux, costumiers) — distincte du fauteuil de loge capitonné. Cf. plan NADJ 08 folio 38 (image).
export const prop: PropViz = {
  id: 'chaise',
  label: 'Chaise',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="27" ry="7" fill="${P.ombre}" opacity="0.2"/>` +
    // pieds avant + arrière
    `<rect x="42" y="100" width="5" height="46" fill="${P.boisSombre4}"/><rect x="73" y="100" width="5" height="46" fill="${P.boisSombre4}"/>` +
    `<rect x="50" y="98" width="4" height="44" fill="${P.boisSombre7}"/><rect x="66" y="98" width="4" height="44" fill="${P.boisSombre7}"/>` +
    // assise (dessus en perspective)
    `<path d="M40 98 L80 98 L74 92 L46 92 Z" fill="${P.boisFonce8}"/>` +
    `<rect x="40" y="98" width="40" height="6" rx="1.5" fill="${P.boisFonce7}"/>` +
    // montants du dossier
    `<rect x="44" y="48" width="5" height="50" fill="${P.boisSombre4}"/><rect x="71" y="48" width="5" height="50" fill="${P.boisSombre4}"/>` +
    // barreaux du dossier
    `<rect x="44" y="52" width="32" height="6" rx="2" fill="${P.boisFonce4}"/>` +
    `<rect x="53" y="58" width="4" height="34" fill="${P.boisFonce7}"/><rect x="63" y="58" width="4" height="34" fill="${P.boisFonce7}"/>` +
    `<rect x="44" y="86" width="32" height="5" rx="2" fill="${P.boisFonce4}"/>` +
    // barre d'entretoise entre pieds
    `<rect x="44" y="124" width="32" height="4" rx="1.5" fill="${P.boisSombre7}"/></g>`,
};
