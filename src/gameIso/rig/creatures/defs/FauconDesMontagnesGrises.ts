import type { CreatureDef } from '../types';

// Faucon des Montagnes Grises (ZI) — rapace de montagne. Gabarit aviaire (silhouette d'oiseau),
// plumage gris-brun ardoise, ventre clair moucheté, bec et serres jaunes.
export const creature: CreatureDef = {
  label: 'Faucon des Montagnes Grises',
  id: "faucon-des-montagnes-grises",
  plan: 'avian',
  bird: {
    sl: 0.78, girth: 0.92,
    palette: { corps: '#6c6a62', corpsO: '#3c3a34', corpsH: '#c2bca8', cheveux: '#43413a', cheveuxO: '#26241f', cuir: '#d8a838' },
  },
};
