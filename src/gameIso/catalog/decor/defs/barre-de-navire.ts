import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Barre à roue de navire (#342, chantier A2) : roue de gouvernail à 8 rayons sur son piédestal de pont.
// Prop ORIENTÉ : trois vues déclarées ; la machinerie (`propSvg`) sélectionne la vue + le miroir
// via `project(dir, camRot)` (cf. `PropViz.views`). Le profil est dessiné tourné vers la DROITE.

/** Piédestal de pont : socle trapèze + colonne, centré sur cx, pieds ~y=147. */
const pedestal = (cx: number) =>
  `<rect x="${cx - 8}" y="98" width="16" height="38" rx="3" fill="${P.boisSombre5}"/>` +
  `<rect x="${cx - 6}" y="100" width="5" height="34" fill="${P.boisFonce4}" opacity="0.7"/>` +
  `<path d="M${cx - 20} 147 L${cx + 20} 147 L${cx + 13} 132 L${cx - 13} 132 Z" fill="${P.boisSombre7}"/>` +
  `<path d="M${cx - 20} 147 L${cx + 20} 147 L${cx + 18} 142 L${cx - 18} 142 Z" fill="${P.boisTresSombre2}"/>`;

/** Roue pleine face caméra : 8 rayons traversants dont les poignées DÉPASSENT la jante, jante double,
 *  moyeu de laiton. Centre (cx, cy). Rayons jusqu'à r=46 (poignées), jante à r=33. */
const wheel = (cx: number, cy: number, hub: string) => {
  const spokes =
    `<g stroke="${P.boisFonce12}" stroke-width="5.5" stroke-linecap="round">` +
    `<line x1="${cx}" y1="${cy - 46}" x2="${cx}" y2="${cy + 46}"/>` +
    `<line x1="${cx - 46}" y1="${cy}" x2="${cx + 46}" y2="${cy}"/>` +
    `<line x1="${cx - 32}" y1="${cy - 32}" x2="${cx + 32}" y2="${cy + 32}"/>` +
    `<line x1="${cx + 32}" y1="${cy - 32}" x2="${cx - 32}" y2="${cy + 32}"/></g>`;
  return (
    spokes +
    `<circle cx="${cx}" cy="${cy}" r="33" fill="none" stroke="${P.boisSombre5}" stroke-width="9"/>` +
    `<circle cx="${cx}" cy="${cy}" r="33" fill="none" stroke="${P.boisMoyen21}" stroke-width="2.5"/>` +
    `<circle cx="${cx}" cy="${cy}" r="9" fill="${hub}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${P.boisTresSombre2}"/>`
  );
};

/** FACE : la roue pleine devant son piédestal, moyeu de laiton bien visible. */
const front = (cx: number) => pedestal(cx) + wheel(cx, 84, P.orMoyen9);

/** DOS : revers du support — panneau arrière large qui occulte le bas de la roue, moyeu de bois
 *  (le laiton est côté barreur), entretoise en croix sur le panneau. */
const back = (cx: number) =>
  pedestal(cx) +
  wheel(cx, 84, P.boisSombre5) +
  `<rect x="${cx - 14}" y="96" width="28" height="42" rx="4" fill="${P.boisSombre7}"/>` +
  `<line x1="${cx - 12}" y1="100" x2="${cx + 12}" y2="134" stroke="${P.boisTresSombre2}" stroke-width="3"/>` +
  `<line x1="${cx + 12}" y1="100" x2="${cx - 12}" y2="134" stroke="${P.boisTresSombre2}" stroke-width="3"/>`;

/** PROFIL (regarde à droite) : le piédestal de côté, la roue en TRANCHE (ellipse étroite) à l'avant,
 *  moyeu/axe en saillie et poignées qui dépassent haut et bas. */
const profile = (cx: number) =>
  `<rect x="${cx - 16}" y="98" width="14" height="38" rx="3" fill="${P.boisSombre5}"/>` +
  `<path d="M${cx - 26} 147 L${cx + 8} 147 L${cx + 3} 132 L${cx - 21} 132 Z" fill="${P.boisSombre7}"/>` +
  `<line x1="${cx - 9}" y1="98" x2="${cx + 8}" y2="86" stroke="${P.boisFonce12}" stroke-width="6" stroke-linecap="round"/>` +
  `<ellipse cx="${cx + 10}" cy="84" rx="6" ry="40" fill="${P.boisFonce12}" stroke="${P.boisSombre5}" stroke-width="3"/>` +
  `<ellipse cx="${cx + 10}" cy="84" rx="2.5" ry="33" fill="${P.boisFonce24}"/>` +
  `<line x1="${cx + 10}" y1="38" x2="${cx + 10}" y2="30" stroke="${P.boisFonce12}" stroke-width="5" stroke-linecap="round"/>` +
  `<line x1="${cx + 10}" y1="130" x2="${cx + 10}" y2="138" stroke="${P.boisFonce12}" stroke-width="5" stroke-linecap="round"/>` +
  `<circle cx="${cx + 10}" cy="84" r="6" fill="${P.orMoyen9}"/>`;

/** Ombre au sol + dessin d'une vue, dans la boîte 120×150. */
const body = (view: (cx: number) => string) =>
  `<g><ellipse cx="60" cy="147" rx="26" ry="7" fill="${P.ombre}" opacity="0.22"/>${view(60)}</g>`;

export const prop: PropViz = {
  id: 'barre-de-navire',
  label: 'Barre à roue',
  searchable: false,
  views: {
    front: () => body(front),
    profile: () => body(profile),
    back: () => body(back),
  },
};
