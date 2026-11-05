import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Ensemble de salle commune : table RONDE à plateau de chêne sur pied central de fer, et ses quatre
// tabourets intégrés (une seule ref, quatre places). Vignette de PALETTE : le corps monde de cette
// ref est sa recette volumique (`props.json`), jamais ce dessin.
export const prop: PropViz = {
  id: 'table-ronde-4-tabourets',
  render: () =>
    `<g><ellipse cx="60" cy="142" rx="50" ry="12" fill="${P.ombre}" opacity="0.2"/>` +
    // tabourets arrière
    `<g><ellipse cx="26" cy="104" rx="13" ry="5" fill="${P.boisFonce8}"/>` +
    `<path d="M26 106 V128" stroke="${P.ombre2}" stroke-width="4"/></g>` +
    `<g><ellipse cx="94" cy="104" rx="13" ry="5" fill="${P.boisFonce8}"/>` +
    `<path d="M94 106 V128" stroke="${P.ombre2}" stroke-width="4"/></g>` +
    // pied central
    `<path d="M60 78 V132" stroke="${P.ombre2}" stroke-width="8"/>` +
    `<ellipse cx="60" cy="133" rx="14" ry="5" fill="${P.ombre2}"/>` +
    // plateau
    `<ellipse cx="60" cy="82" rx="40" ry="15" fill="${P.boisFonce7}"/>` +
    `<ellipse cx="60" cy="78" rx="40" ry="15" fill="${P.boisFonce8}"/>` +
    `<ellipse cx="60" cy="78" rx="26" ry="9" fill="${P.boisMoyen2}" opacity="0.45"/>` +
    // tabourets avant
    `<g><ellipse cx="34" cy="122" rx="14" ry="6" fill="${P.boisFonce8}"/>` +
    `<path d="M34 124 V142" stroke="${P.ombre2}" stroke-width="5"/></g>` +
    `<g><ellipse cx="86" cy="122" rx="14" ry="6" fill="${P.boisFonce8}"/>` +
    `<path d="M86 124 V142" stroke="${P.ombre2}" stroke-width="5"/></g></g>`,
};
