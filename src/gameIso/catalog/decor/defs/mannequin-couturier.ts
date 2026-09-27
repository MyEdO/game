import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Mannequin de couturier : buste de toile sur tige, piètement de bois en croix.
export const prop: PropViz = {
  id: 'mannequin-couturier',
  label: 'Mannequin de couturier',
  render: () =>
    `<g><ellipse cx="60" cy="146" rx="22" ry="6" fill="${P.ombre}" opacity="0.2"/>` +
    `<path d="M38 146 L60 138 L82 146" stroke="${P.boisFonce7}" stroke-width="4" fill="none"/>` +
    `<rect x="58" y="86" width="4" height="54" fill="${P.boisFonce4}"/>` +
    `<path d="M44 52 L76 52 Q80 62 72 70 Q68 76 72 84 Q66 92 60 92 Q54 92 48 84 Q52 76 48 70 Q40 62 44 52 Z" fill="${P.sangFonce10}"/>` +
    `<path d="M60 52 L60 92" stroke="${P.sangFonce5}" stroke-width="1.2"/>` +
    `<rect x="57" y="42" width="6" height="10" fill="${P.boisFonce4}"/><circle cx="60" cy="40" r="3" fill="${P.orMoyen10}"/></g>`,
};
