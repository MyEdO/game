import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Cheminée de forge : souche de pierre appareillée + chaperon, conduit sombre, et PANACHE de fumée qui
// s'élève (groupe `smoke`, dont la montée est ∝ hauteur du panache — cf. feu-camp). Ornement 'ridge'.
export const prop: PropViz = {
  id: 'cheminee',
  render: () =>
    `<g>` +
    `<g class="smoke">` +
    `<ellipse cx="60" cy="66" rx="9" ry="7" fill="${P.pierreClair}" opacity="0.5"/>` +
    `<ellipse cx="54" cy="50" rx="12" ry="9" fill="${P.pierreTresClair}" opacity="0.4"/>` +
    `<ellipse cx="65" cy="32" rx="14" ry="11" fill="${P.pierreClair}" opacity="0.3"/>` +
    `<ellipse cx="57" cy="16" rx="16" ry="12" fill="${P.pierreTresClair}" opacity="0.2"/>` +
    `</g>` +
    `<rect x="44" y="84" width="32" height="66" fill="${P.pierreFonce}"/>` +
    `<rect x="44" y="84" width="7" height="66" fill="${P.pierreMoyen2}"/>` +
    `<rect x="69" y="84" width="7" height="66" fill="${P.pierreFonce2}"/>` +
    `<path d="M44 104 H76 M44 124 H76" stroke="${P.pierreSombre4}" stroke-width="1.6"/>` +
    `<rect x="40" y="76" width="40" height="10" fill="${P.pierreMoyen}"/>` +
    `<rect x="52" y="76" width="16" height="6" fill="${P.ombre3}"/>` +
    `</g>`,
};
