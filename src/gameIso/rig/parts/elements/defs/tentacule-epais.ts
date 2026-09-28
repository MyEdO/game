import type { AppearanceElement } from '../types';
import { ARMS } from '../../monster';
import { viewOrFront } from '../../types';

// Tentacule épais : REMPLACE le bras gauche (part monstrueuse du registre monster/, couleur de peau
// du personnage via @peau) et efface le poing — un membre muté, pas un appendice posé.
const TENTACULE = `<g data-mut="tentacule-epais">${viewOrFront(ARMS['tentacule'], 'front')}</g>`;

export const element: AppearanceElement = {
  key: 'tentacule-epais', label: 'Tentacule épais', category: 'mutation',
  overlays: [
    { bone: 'epauleG', svg: TENTACULE, replace: true },
    { bone: 'mainG', svg: '', replace: true },
  ],
};
