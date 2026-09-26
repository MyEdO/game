import type { CreatureDef } from '../types';

// Poulet de basse-cour (gabarit aviaire, LDB « Animaux et véhicules ») — mode `comb` du
// plan avian : crête rouge dentelée + barbillon, queue de poule redressée, corps dodu.
export const creature: CreatureDef = {
  label: 'Poulet',
  id: "poulet",
  plan: 'avian',
  bird: {
    sl: 0.7, girth: 1.2, // corps dodu de poule fermière
    comb: true,
    tailLen: 0.85, // faucille courte, dressée
    // Plumage brun chaud de poule rousse, pattes+bec jaune-ocre (cuir)
    palette: { corps: '#a5764f', corpsO: '#5e4026', corpsH: '#d8b483', cheveux: '#6b4a2c', cheveuxO: '#3d2a17', cuir: '#d9a441' },
  },
};
