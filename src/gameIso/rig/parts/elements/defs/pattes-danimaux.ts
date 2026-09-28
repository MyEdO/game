import type { AppearanceElement } from '../types';
import { LEGS } from '../../monster';
import { viewOrFront } from '../../types';

// Pattes d'animaux : les JAMBES sont REMPLACÉES par les pattes de chèvre du registre monster/
// (couleur de peau du perso via @peau, sabot inclus) et les bottes effacées — traitement « membre
// muté » appliqué aux jambes (comme un Gor).
const PATTES = `<g data-mut="pattes-danimaux">${viewOrFront(LEGS['chevre'], 'front')}</g>`;

export const element: AppearanceElement = {
  key: 'pattes-danimaux', label: 'Pattes d’animaux', category: 'mutation',
  overlays: [
    { bone: 'cuisseG', svg: PATTES, replace: true },
    { bone: 'cuisseD', svg: PATTES, replace: true },
    { bone: 'piedG', svg: '', replace: true }, // le sabot est dans la patte — bottes effacées
    { bone: 'piedD', svg: '', replace: true },
  ],
};
