import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Ensemble de salle commune : table MURALE (plateau de chêne porté par deux consoles) et ses deux
// tabourets intégrés (une seule ref, deux places). Vignette de PALETTE : le corps monde de cette
// ref est sa recette volumique (`props.json`), jamais ce dessin.
export const prop: PropViz = {
  id: 'table-murale-2-tabourets',
  render: () =>
    `<g><ellipse cx="60" cy="144" rx="46" ry="10" fill="${P.ombre}" opacity="0.2"/>` +
    // consoles sous le plateau
    `<path d="M26 86 L26 116 L44 86 Z" fill="${P.boisSombre7}"/>` +
    `<path d="M94 86 L94 116 L76 86 Z" fill="${P.boisSombre7}"/>` +
    // plateau mural
    `<rect x="14" y="76" width="92" height="10" rx="2" fill="${P.boisFonce7}"/>` +
    `<path d="M14 76 L106 76 L100 68 L20 68 Z" fill="${P.boisFonce8}"/>` +
    `<path d="M20 68 L100 68" stroke="${P.boisMoyen2}" stroke-width="1.5" opacity="0.7"/>` +
    // deux tabourets
    `<g><ellipse cx="40" cy="118" rx="14" ry="6" fill="${P.boisFonce8}"/>` +
    `<ellipse cx="40" cy="121" rx="14" ry="6" fill="${P.boisFonce7}"/>` +
    `<path d="M40 124 V142" stroke="${P.ombre2}" stroke-width="5"/>` +
    `<ellipse cx="40" cy="142" rx="9" ry="3" fill="${P.ombre2}"/></g>` +
    `<g><ellipse cx="80" cy="118" rx="14" ry="6" fill="${P.boisFonce8}"/>` +
    `<ellipse cx="80" cy="121" rx="14" ry="6" fill="${P.boisFonce7}"/>` +
    `<path d="M80 124 V142" stroke="${P.ombre2}" stroke-width="5"/>` +
    `<ellipse cx="80" cy="142" rx="9" ry="3" fill="${P.ombre2}"/></g></g>`,
};
