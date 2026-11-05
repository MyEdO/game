import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Stalle d'écurie : poteau d'angle massif (avec anneau d'attache de fer) + PAROI PLEINE de planches
// verticales dressée derrière (une vraie cloison de box, pas un portillon), et une MANGEOIRE en auge
// en V garnie de foin au pied. Distincte de l'abreuvoir (auge d'eau basse). Ancrée aux pieds, ombre au sol.
export const prop: PropViz = {
  id: 'stalle-ecurie',
  render: () =>
    `<g>` +
    `<ellipse cx="60" cy="147" rx="44" ry="9" fill="${P.ombre}" opacity="0.22"/>` +
    // paroi PLEINE de planches VERTICALES (cloison de box dressée), derrière le poteau
    `<rect x="44" y="54" width="60" height="84" fill="${P.boisFonce15}"/>` +
    // planche de tête (chapeau, arête haute éclairée)
    `<rect x="42" y="49" width="62" height="7" fill="${P.boisFonce4}"/>` +
    `<rect x="42" y="49" width="62" height="2" fill="${P.boisMoyen8}" opacity="0.7"/>` +
    // joints verticaux des planches
    `<path d="M56 56 L56 138 M68 56 L68 138 M80 56 L80 138 M92 56 L92 138" stroke="${P.boisSombre7}" stroke-width="1.6" opacity="0.7"/>` +
    // ombre basse (volume : planches plus sombres près du sol)
    `<rect x="44" y="118" width="60" height="20" fill="${P.boisSombre7}" opacity="0.35"/>` +
    // arête droite ombrée (épaisseur de la paroi)
    `<rect x="100" y="54" width="4" height="84" fill="${P.boisSombre3}" opacity="0.55"/>` +
    // poteau d'angle massif (avant-gauche, DEVANT la paroi)
    `<rect x="28" y="52" width="14" height="94" fill="${P.boisSombre7}"/>` +
    `<rect x="28" y="52" width="5" height="94" fill="${P.boisFonce12}"/>` +
    `<rect x="38" y="52" width="4" height="94" fill="${P.boisSombre6}"/>` +
    `<path d="M27 52 L35 47 L43 52 Z" fill="${P.boisFonce18}"/>` +
    // anneau d'attache en fer
    `<rect x="31" y="90" width="8" height="5" rx="1" fill="${P.pierreFonce2}"/>` +
    `<circle cx="35" cy="101" r="5.5" fill="none" stroke="${P.pierreFonce}" stroke-width="2.4"/>` +
    // MANGEOIRE en auge en V (à fourrage), sous l'anneau — devant
    `<path d="M43 120 L89 116 L84 129 L50 133 Z" fill="${P.boisFonce7}"/>` +       // face avant qui se resserre vers le keel (section en V)
    `<path d="M43 120 L50 133 L46 126 Z" fill="${P.boisSombre7}"/>` +               // bout gauche (ombre) — montre le V
    `<path d="M89 116 L84 129 L88 122 Z" fill="${P.boisSombre7}" opacity="0.8"/>` + // bout droit (ombre)
    `<ellipse cx="66" cy="118" rx="23" ry="5" fill="${P.boisTresSombre}"/>` +       // ouverture (intérieur sombre)
    `<ellipse cx="66" cy="118" rx="23" ry="5" fill="none" stroke="${P.boisFonce18}" stroke-width="1.2" opacity="0.7"/>` + // liseré du rebord
    // foin DANS l'auge (lisible, plus de chevrons au premier plan)
    `<path d="M52 118 l6 -4 l-1 4 l6 -3 l-2 4 l6 -3 l-1 4 l6 -3" stroke="${P.boisMoyen11}" stroke-width="1.4" fill="none" opacity="0.9"/>` +
    `<path d="M58 120 l5 -3 l0 3 l5 -2" stroke="${P.orClair11}" stroke-width="1.2" fill="none" opacity="0.75"/>` +
    `</g>`,
};
