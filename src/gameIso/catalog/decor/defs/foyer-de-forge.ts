import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Foyer de forge maçonné : bloc de pierre appareillée surmonté d'une cuve de charbons ardents (braise
// rougeoyante, classe `warm`), hotte basse + conduit qui montent derrière, soufflet de cuir vissé à
// gauche. Composite 1×1. Ancré aux pieds, ombre au sol.
export const prop: PropViz = {
  id: 'foyer-de-forge',
  render: () =>
    `<g>` +
    `<ellipse cx="60" cy="147" rx="42" ry="9" fill="${P.ombre}" opacity="0.22"/>` +
    // conduit (flue)
    `<rect x="54" y="16" width="14" height="28" fill="${P.pierreSombre5}"/>` +
    `<rect x="54" y="16" width="5" height="28" fill="${P.pierreFonce2}"/>` +
    `<rect x="50" y="13" width="22" height="6" rx="1" fill="${P.pierreMoyen2}"/>` +
    // hotte (trapèze)
    `<path d="M46 44 L74 44 L88 76 L32 76 Z" fill="${P.pierreFonce2}"/>` +
    `<path d="M46 44 L74 44 L88 76" fill="none" stroke="${P.pierreSombre4}" stroke-width="1.4" opacity="0.6"/>` +
    `<path d="M32 76 L88 76" stroke="${P.pierreMoyen2}" stroke-width="2"/>` +
    // bloc maçonné (foyer)
    `<path d="M26 92 L94 92 L90 144 L30 144 Z" fill="${P.pierreFonce}"/>` +
    `<path d="M26 92 L36 92 L34 144 L30 144 Z" fill="${P.pierreMoyen2}" opacity="0.5"/>` +
    `<path d="M28 108 H92 M29 126 H91" stroke="${P.pierreSombre4}" stroke-width="1.6" opacity="0.7"/>` +
    `<path d="M60 92 V108 M46 108 V126 M74 108 V126" stroke="${P.pierreSombre4}" stroke-width="1.2" opacity="0.5"/>` +
    // soufflet de cuir (gauche) + buse vers le foyer
    `<path d="M8 104 L30 99 L30 117 L8 122 Z" fill="${P.boisFonce12}"/>` +
    `<path d="M8 104 L30 99 L30 117 L8 122 Z" fill="none" stroke="${P.boisSombre7}" stroke-width="1.4"/>` +
    `<circle cx="26" cy="108" r="2" fill="${P.boisSombre7}"/>` +
    `<rect x="30" y="104" width="13" height="5" rx="1.5" fill="${P.pierreFonce2}"/>` +
    // cuve de charbons — rebord de fer
    `<ellipse cx="60" cy="92" rx="30" ry="8" fill="${P.pierreSombre5}"/>` +
    // braises rougeoyantes (warm)
    `<g class="warm">` +
    `<ellipse cx="60" cy="92" rx="24" ry="6" fill="${P.sangSombre11}"/>` +
    `<ellipse cx="52" cy="92" rx="7" ry="3" fill="${P.boisMoyen}"/>` +
    `<ellipse cx="66" cy="93" rx="6" ry="2.6" fill="${P.boisClair2}"/>` +
    `<ellipse cx="60" cy="91" rx="5" ry="2.2" fill="${P.boisClair4}"/>` +
    `<circle cx="58" cy="91" r="1.8" fill="${P.boisTresClair6}"/>` +
    `<circle cx="64" cy="92" r="1.4" fill="${P.boisTresClair6}"/>` +
    `</g>` +
    `</g>`,
};
