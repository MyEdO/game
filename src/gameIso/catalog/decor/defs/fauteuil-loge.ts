import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Fauteuil de loge : siège capitonné de velours rouge à haut dossier, crête et accoudoirs dorés,
// clous d'or — le siège d'honneur d'une loge (distinct des bancs du parterre `rangee-sieges`).
export const prop: PropViz = {
  id: 'fauteuil-loge',
  render: () =>
    `<g><ellipse cx="60" cy="146" rx="26" ry="8" fill="${P.ombre}" opacity="0.22"/>` +
    `<rect x="38" y="52" width="44" height="66" rx="16" fill="${P.sangFonce5}"/><rect x="44" y="58" width="32" height="54" rx="11" fill="${P.sangFonce14}"/>` +
    `<path d="M46 58 Q60 46 74 58" stroke="${P.boisMoyen21}" stroke-width="3" fill="none"/><circle cx="60" cy="52" r="4" fill="${P.orMoyen9}"/>` +
    `<path d="M38 108 Q60 120 82 108 L82 126 Q60 135 38 126 Z" fill="${P.sangFonce11}"/><path d="M38 108 Q60 120 82 108" stroke="${P.boisMoyen21}" stroke-width="2" fill="none"/>` +
    `<path d="M34 92 Q28 112 38 128 L44 128 Q36 112 42 96 Z" fill="${P.boisMoyen23}"/><path d="M86 92 Q92 112 82 128 L76 128 Q84 112 78 96 Z" fill="${P.boisMoyen23}"/>` +
    `<circle cx="34" cy="92" r="4" fill="${P.orMoyen9}"/><circle cx="86" cy="92" r="4" fill="${P.orMoyen9}"/>` +
    `<g fill="${P.boisMoyen21}"><circle cx="50" cy="66" r="1.8"/><circle cx="70" cy="66" r="1.8"/><circle cx="50" cy="100" r="1.8"/><circle cx="70" cy="100" r="1.8"/></g>` +
    `<rect x="42" y="126" width="5" height="16" rx="1" fill="${P.boisFonce21}"/><rect x="73" y="126" width="5" height="16" rx="1" fill="${P.boisFonce21}"/></g>`,
};
