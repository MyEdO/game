import type { CreatureDef } from '../types';

// Ours — réf art : art-ref/ldb/page317_img7357.png : masse ÉNORME portée bas sur pattes-poteaux
// courtes, bosse d'épaule musclée dominant la ligne du dos, tête focale rugissante (front bombé,
// museau COURT et large, petites oreilles rondes, gueule béante à 4 canines), pelage brun
// grisonnant (dos paille clair, dessous sombre) balafré de coups de griffes à l'épaule.
// Build 'ursine' + tête 'ours' ; mane 'sans' (la toison est dessinée en touffes COUCHÉES dans
// le tronc/la tête — 'hirsute' plantait des piquants de loup sur le dos, verdict sans-rapport).
export const creature: CreatureDef = {
  label: 'Ours',
  id: "ours",
  plan: 'quadruped',
  quad: {
    sl: 1.05, build: 'ursine', girth: 1.32, bodyLen: 0.92, neckLen: 0.36, neckAngle: -12, legLen: 0.68,
    head: 'ours', tail: 'courte', ears: 'rondes', foot: 'patte', mane: 'sans', headScale: 1.34,
    palette: { corps: '#6f5c3a', corpsO: '#392a10', corpsH: '#b29b62', cheveux: '#93805a', cheveuxO: '#4a3a22', cuir: '#15100a' },
  },
};
