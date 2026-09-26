import type { CreatureDef } from '../types';

// Macareux à Bec Tranchant (ZI) — petit oiseau marin (Taille Petite). Gabarit aviaire compact,
// dos noir, ventre blanc, bec et pattes orange vif.
export const creature: CreatureDef = {
  label: 'Macareux à Bec Tranchant',
  id: "macareux-a-bec-tranchant",
  plan: 'avian',
  bird: {
    sl: 0.6, girth: 1.12,
    palette: { corps: '#23262b', corpsO: '#101216', corpsH: '#eef1f4', cheveux: '#1a1c20', cheveuxO: '#0a0b0d', cuir: '#e8782a' },
  },
};
