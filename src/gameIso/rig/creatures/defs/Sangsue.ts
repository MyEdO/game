import type { CreatureDef } from '../types';

// Sangsue géante (gabarit serpentin, variante SANS capuchon, brun-rouge, plus épaisse). 1 fichier.
export const creature: CreatureDef = {
  label: 'Sangsue',
  id: "sangsue",
  plan: 'serpentine',
  serpent: {
    // Ver gorgé de sang : masse trapue (girth ↑), robe brun-noir humide, anneaux très contrastés
    // (les stries @corpsO du gabarit lisent comme des annulations), reflet rougeâtre luisant.
    sl: 0.92, girth: 1.35, hood: false,
    palette: { corps: '#5c2a24', corpsO: '#260c08', corpsH: '#a8503c', cheveux: '#260c08', cheveuxO: '#140503', cuir: '#6a3a2a' },
  },
};
