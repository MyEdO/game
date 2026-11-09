import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Cargaison bâchée : une pile de marchandises sur sa palette de bois, couverte d'une bâche écrue que trois sangles de
// corde serrent.
export const prop: PropViz = {
  id: 'cargaison-bachee',
  render: () =>
    `<g><ellipse cx="60" cy="146" rx="54" ry="8" fill="${P.ombre}" opacity="0.25"/>` +
    // Palette
    `<path d="M6 146 h108 v-8 h-108 Z" fill="${P.boisFonce12}"/>` +
    // Bâche : flancs, faîte
    `<path d="M9 138 L9 92 Q10 78 30 72 L90 72 Q110 78 111 92 L111 138 Z" fill="${P.boisClair10}"/>` +
    `<path d="M14 92 Q30 80 60 80 Q90 80 106 92" stroke="${P.boisClair12}" stroke-width="2" fill="none"/>` +
    `<path d="M24 136 Q22 112 26 96 M96 136 Q98 112 94 96" stroke="${P.boisFonce9}" stroke-width="1" fill="none" opacity="0.5"/>` +
    // Sangles
    `<path d="M30 138 L30 73 M60 138 L60 72 M90 138 L90 73" stroke="${P.boisMoyen8}" stroke-width="3"/>` +
    `</g>`,
};
