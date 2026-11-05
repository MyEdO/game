import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Cuve de brassage TRONCONIQUE : grand récipient de cuivre ÉVASÉ (plus large en haut qu'en bas, à la
// différence d'un tonneau au galbe fermé), cerclé de trois bandes de fer, OUVERT au sommet sur le moût
// sombre coiffé de mousse, d'où s'échappe une buée rasante enracinée au rebord (classe `smoke`).
// Ancrée aux pieds, ombre au sol.
export const prop: PropViz = {
  id: 'cuve-brasserie',
  render: () =>
    `<g>` +
    `<ellipse cx="60" cy="147" rx="34" ry="8" fill="${P.ombre}" opacity="0.22"/>` +
    // corps de cuivre tronconique (large en haut, resserré en bas — cuve de brassage, pas un fût)
    `<path d="M28 88 L42 143 Q60 148 78 143 L92 88 Z" fill="${P.boisMoyen8}"/>` +
    // moitié droite ombrée
    `<path d="M60 88 L60 146 Q70 147 78 143 L92 88 Z" fill="${P.orFonce4}" opacity="0.5"/>` +
    // reflets de cuivre (bandes claires suivant la fuite des parois)
    `<path d="M40 92 L47 140" stroke="${P.orClair7}" stroke-width="3" fill="none" opacity="0.55"/>` +
    `<path d="M50 92 L54 141" stroke="${P.orClair11}" stroke-width="1.6" fill="none" opacity="0.5"/>` +
    // cercles de fer (3, se resserrant vers le bas)
    `<path d="M31 100 Q60 108 89 100" stroke="${P.pierreSombre7}" stroke-width="5" fill="none"/>` +
    `<path d="M31 100 Q60 107 89 100" stroke="${P.pierreMoyen2}" stroke-width="1.4" fill="none" opacity="0.7"/>` +
    `<path d="M36 120 Q60 127 84 120" stroke="${P.pierreSombre7}" stroke-width="5" fill="none"/>` +
    `<path d="M36 120 Q60 126 84 120" stroke="${P.pierreMoyen2}" stroke-width="1.4" fill="none" opacity="0.7"/>` +
    `<path d="M41 138 Q60 144 79 138" stroke="${P.pierreSombre7}" stroke-width="5" fill="none"/>` +
    // rebord supérieur ÉVASÉ (large anneau de cuivre)
    `<ellipse cx="60" cy="86" rx="33" ry="9.5" fill="${P.orFonce4}"/>` +
    `<ellipse cx="60" cy="86" rx="33" ry="9.5" fill="none" stroke="${P.orClair7}" stroke-width="1.4" opacity="0.7"/>` +
    // ouverture / moût sombre (discriminant fort vs tonneau fermé)
    `<ellipse cx="60" cy="86" rx="27" ry="7" fill="${P.terreTresSombre}"/>` +
    `<ellipse cx="60" cy="85" rx="23" ry="5.6" fill="${P.boisFonce}"/>` +
    // bourrelet de mousse/écume À LA SURFACE du moût (attaché, pas de disque flottant)
    `<path d="M45 85 q5 -5 10 0 z" fill="${P.orTresClair6}" opacity="0.55"/>` +
    `<path d="M54 84 q5.5 -5 11 0 z" fill="${P.orTresClair}" opacity="0.5"/>` +
    `<path d="M63 85 q4 -4 8 0 z" fill="${P.orTresClair2}" opacity="0.5"/>` +
    // buée rasante ENRACINÉE au rebord (volute, jamais un disque détaché)
    `<g class="smoke" style="transform-box:fill-box;transform-origin:72px 82px">` +
    `<path d="M72 82 q9 -6 5 -13 q-2 -6 5 -8" stroke="${P.orTresClair}" stroke-width="4" fill="none" opacity="0.3" stroke-linecap="round"/>` +
    `</g>` +
    `</g>`,
};
