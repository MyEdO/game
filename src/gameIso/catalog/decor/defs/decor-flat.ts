import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Châssis de décor (toile peinte sur cadre) appuyé de profil : un panneau de scène peint d'une colonne
// et d'un ciel, posé en attente. Le contenu emblématique du « Stockage des décors » (20), des coulisses
// (16) et de la charpenterie (26) du théâtre. Cf. plan officiel NADJ 08 folio 38, image (longs panneaux/toiles rangés).
export const prop: PropViz = {
  id: 'decor-flat',
  label: 'Châssis de décor',
  searchable: true,
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="32" ry="7" fill="${P.ombre}" opacity="0.2"/>` +
    // cadre incliné contre le mur
    `<path d="M34 146 L40 40 L66 36 L62 146 Z" fill="${P.boisFonce33}"/>` +
    `<path d="M40 44 L62 41 L59 140 L40 142 Z" fill="${P.feuillageMoyen8}"/>` + // toile peinte (fond ciel/paysage)
    // motif peint : une colonne + arche stylisée
    `<rect x="46" y="58" width="8" height="74" fill="${P.orClair8}"/>` +
    `<path d="M44 58 Q50 50 56 58 Z" fill="${P.orClair13}"/>` +
    `<path d="M40 96 L62 93" stroke="${P.feuillageMoyen7}" stroke-width="2" opacity="0.6"/>` +
    // traverse de cadre + équerre
    `<path d="M34 146 L40 40 L66 36 L62 146" fill="none" stroke="${P.boisSombre11}" stroke-width="2.5"/>` +
    `<path d="M52 60 L70 30" stroke="${P.boisSombre21}" stroke-width="3" stroke-linecap="round"/></g>`,
};
