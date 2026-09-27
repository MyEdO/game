import type { CreatureDef } from '../types';

// Pieuvre des tourbières (gabarit céphalopode) — masse charnue basse + forêt de tentacules fins
// et sinueux en volutes dressées, petits yeux noyés dans les replis (artwork LDB 79 p.325). 1 fichier.
export const creature: CreatureDef = {
  label: 'Pieuvre',
  id: "pieuvre",
  plan: 'cephalopod',
  // LDB 79 l.130-135 : « marbrées de vert et de brun » (camouflage de marécage),
  // tentacules robustes, Taille (Grande). Robe brun/ocre terreux de l'artwork,
  // marbrures vertes portées par @cheveux, iris terne @cuir.
  octopus: {
    sl: 1.05, girth: 1.1,
    palette: { corps: '#8a6238', corpsO: '#452e16', corpsH: '#c2a068', cheveux: '#6b6d3a', cheveuxO: '#3a3c1f', cuir: '#b98f47' },
  },
};
