import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Bastingage (segment composable en rangée, pleine largeur de boîte) : plat-bord au pied,
// montants trapus, lisse épaisse en main courante et filets de cordage croisés entre les deux —
// le garde-corps en bois d'un pont de navire.
export const prop: PropViz = {
  id: 'bastingage',
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="56" ry="7" fill="${P.ombre}" opacity="0.2"/>` +
    [4, 26, 48, 70, 92]
      .map(
        (x) =>
          `<path d="M${x} 100 L${x + 24} 136 M${x + 24} 100 L${x} 136" stroke="${P.boisClair11}" stroke-width="1.8" opacity="0.85" fill="none"/>`,
      )
      .join('') +
    `<rect x="0" y="115" width="120" height="5" fill="${P.boisFonce12}"/>` +
    `<path d="M0 117.5 L120 117.5" stroke="${P.boisSombre16}" stroke-width="1.2"/>` +
    [16, 60, 104]
      .map(
        (x) =>
          `<rect x="${x - 4.5}" y="92" width="9" height="50" fill="${P.boisSombre16}"/><path d="M${x - 1.5} 94 L${x - 1.5} 140" stroke="${P.boisFonce12}" stroke-width="2" opacity="0.6"/>`,
      )
      .join('') +
    `<rect x="0" y="86" width="120" height="11" rx="3" fill="${P.boisFonce24}"/>` +
    `<rect x="0" y="86" width="120" height="3.5" rx="1.5" fill="${P.boisFonce36}"/>` +
    `<path d="M0 96 L120 96" stroke="${P.boisSombre16}" stroke-width="1.4"/>` +
    `<rect x="0" y="138" width="120" height="9" fill="${P.boisSombre16}"/>` +
    `<rect x="0" y="138" width="120" height="2.5" fill="${P.boisFonce12}"/></g>`,
};
