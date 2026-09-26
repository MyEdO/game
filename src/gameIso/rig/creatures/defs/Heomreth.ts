import type { CreatureDef } from '../types';

// Heomreth (Hibou Géant) (ZI) — grand-duc géant. Gabarit aviaire au corps rond et trapu (girth
// élevé), plumage brun-fauve moucheté, face/ventre crème, bec et serres ocre.
export const creature: CreatureDef = {
  label: 'Heomreth (Hibou Géant)',
  id: "heomreth-hibou-geant",
  plan: 'avian',
  bird: {
    sl: 1.0, girth: 1.28,
    palette: { corps: '#6e5a3e', corpsO: '#3e3120', corpsH: '#ddccaa', cheveux: '#4a3a26', cheveuxO: '#281e12', cuir: '#caa050' },
  },
};
