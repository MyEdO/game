import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Pupitre du chef d'orchestre : estrade de bois, pupitre tripode à plan incliné portant une
// partition — la fosse d'orchestre de l'Opéra. Se lit « pupitre/orchestre » au premier coup d'œil.
export const prop: PropViz = {
  id: 'pupitre-chef',
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="24" ry="7" fill="${P.ombre}" opacity="0.2"/>` +
    `<path d="M38 138 L82 138 L86 149 L34 149 Z" fill="${P.boisFonce21}"/><rect x="38" y="129" width="44" height="10" rx="1" fill="${P.boisFonce22}"/><path d="M38 129 L82 129" stroke="${P.boisSombre15}" stroke-width="1.5"/>` +
    `<rect x="58" y="86" width="4" height="44" fill="${P.pierreSombre5}"/><path d="M60 128 L49 138 M60 128 L71 138 M60 128 L60 138" stroke="${P.pierreSombre5}" stroke-width="2.6" fill="none"/>` +
    `<path d="M43 80 L79 71 L81 85 L45 94 Z" fill="${P.pierreSombre7}"/><path d="M43 80 L79 71" stroke="${P.pierreSombre3}" stroke-width="2"/>` +
    `<path d="M47 82 L75 74 L76 84 L48 91 Z" fill="${P.orTresClair13}"/><path d="M50 83 L73 77 M50 85 L73 79 M50 87 L73 81" stroke="${P.boisMoyen17}" stroke-width="0.8"/></g>`,
};
