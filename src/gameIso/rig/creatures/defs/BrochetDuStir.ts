import type { CreatureDef } from '../types';

// Brochet du Stir (ZI 4 p.36-38) — brochet géant (vrai poisson fusiforme, ~3,5 m, Taille Grande),
// « Queue mortelle » (grande caudale) + Morsure. Gabarit poisson (squelette DÉDIÉ fish/composeFish,
// seule espèce du plan) : LONG museau plat en bec de canard, gueule entrouverte hérissée de dents,
// robe gris-vert MOUCHETÉE de taches claires (corpsH), dorsale reculée face à l'anale.
// Réf art : art-ref/zi/page039_full.png.
export const creature: CreatureDef = {
  label: 'Brochet du Stir',
  id: "brochet-du-stir",
  plan: 'fish',
  fish: {
    sl: 1.05, girth: 1.0,
    palette: { corps: '#5a6850', corpsO: '#32402a', corpsH: '#c9d0ac', cheveux: '#32402a', cheveuxO: '#1e2818', cuir: '#7c8868' },
  },
};
