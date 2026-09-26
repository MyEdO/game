import type { CreatureDef } from '../types';

// Vers (lombric, LDB 306 — Taille minuscule). Gabarit serpentin, variante MINCE et PÂLE :
// tube fin (girth ↓↓ vs Sangsue 1.35), robe rose-brun de chair, bandes @corpsO = annulations
// de segmentation. Pas de capuchon, pas de queue dressée ; `blunt` = extrémité aveugle de ver
// (ni yeux, ni langue, ni calotte sombre).
export const creature: CreatureDef = {
  label: 'Vers',
  id: "vers",
  plan: 'serpentine',
  serpent: {
    sl: 0.7, girth: 0.9, hood: false, markings: 'bandes', blunt: true,
    palette: { corps: '#c98d78', corpsO: '#8a5a48', corpsH: '#e0b6a4', cheveux: '#8a5a48', cheveuxO: '#5c3a2e', cuir: '#a8785e' },
  },
};
