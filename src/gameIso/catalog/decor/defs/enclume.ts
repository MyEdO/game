import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Enclume de forgeron sur billot de bois : masse de fer sombre (corne effilée à droite, table polie,
// taille étroite, base évasée) posée sur une souche ronde. Silhouette d'enclume — à ne pas confondre
// avec l'établi (table à pieds). Ancrée aux pieds, ombre au sol.
export const prop: PropViz = {
  id: 'enclume',
  render: () =>
    `<g>` +
    `<ellipse cx="60" cy="147" rx="40" ry="8" fill="${P.ombre}" opacity="0.22"/>` +
    // billot de bois (souche ronde)
    `<path d="M38 116 L40 144 Q60 150 80 144 L82 116 Z" fill="${P.boisSombre7}"/>` +
    `<path d="M46 118 L47 145 M60 120 L60 148 M74 118 L73 145" stroke="${P.boisTresSombre2}" stroke-width="2" opacity="0.6"/>` +
    `<ellipse cx="60" cy="116" rx="22" ry="7" fill="${P.boisFonce12}"/>` +
    `<ellipse cx="60" cy="116" rx="14" ry="4" fill="none" stroke="${P.boisSombre6}" stroke-width="1.4" opacity="0.7"/>` +
    // enclume — base évasée
    `<path d="M42 110 L78 110 L72 99 L48 99 Z" fill="${P.pierreSombre5}"/>` +
    // taille (pilier étroit)
    `<path d="M50 99 L52 90 L68 90 L70 99 Z" fill="${P.pierreFonce2}"/>` +
    // corps sous la table
    `<path d="M36 90 L84 90 L84 82 L36 82 Z" fill="${P.pierreFonce}"/>` +
    // corne effilée (droite)
    `<path d="M84 82 L106 85 L84 90 Z" fill="${P.pierreFonce2}"/>` +
    `<path d="M84 83 L104 85" stroke="${P.pierreMoyen2}" stroke-width="1" opacity="0.7"/>` +
    // talon carré (gauche)
    `<path d="M30 82 L36 82 L36 91 L30 88 Z" fill="${P.pierreFonce}"/>` +
    // table polie (dessus)
    `<rect x="34" y="77" width="50" height="6" rx="1.5" fill="${P.pierreMoyen2}"/>` +
    `<rect x="34" y="77" width="50" height="2.4" rx="1" fill="${P.pierreMoyen}"/>` +
    // trou de la hardie
    `<rect x="70" y="78" width="4" height="3.2" fill="${P.pierreTresSombre}"/>` +
    // arête d'ombre base / billot
    `<path d="M42 110 L78 110" stroke="${P.ombre}" stroke-width="1.4" opacity="0.4"/>` +
    `</g>`,
};
