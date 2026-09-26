import type { CreatureDef } from '../types';

// Pigeon VOYAGEUR (gabarit aviaire, réf. art LDB 79 p.318) — message roulé sur le dos,
// clochette dorée à la patte, gorge irisée vert/violet (mode `messenger` du plan avian).
export const creature: CreatureDef = {
  label: 'Pigeon',
  id: "pigeon",
  plan: 'avian',
  bird: {
    sl: 0.62, girth: 1.15, // jabot plein du pigeon biset
    messenger: true,
    // Plumage gris-violet, pattes rouge-rosé (cuir)
    palette: { corps: '#8b89a6', corpsO: '#45415c', cheveux: '#3a3550', cheveuxO: '#221f33', cuir: '#c2545e' },
  },
};
