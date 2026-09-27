import type { CreatureDef } from '../types';

// Stégadon (ZI) — énorme reptile cuirassé. Gabarit quadrupède draconique (sans ailes) : corps massif
// et bas, tête 'dragon', queue 'reptile', pieds 'serre', dorsale en plaques. Robe gris-vert blindée.
export const creature: CreatureDef = {
  label: 'Stégadon',
  id: "stegadon",
  plan: 'quadruped',
  quad: {
    sl: 1.3, build: 'draconic', girth: 1.32, bodyLen: 1.16, neckLen: 0.55, neckAngle: -12, legLen: 0.74,
    head: 'dragon', tail: 'reptile', mane: 'sans', ears: 'courtes', foot: 'serre', ridge: 'plaques', headScale: 1.08, tailLen: 1.05,
    palette: { corps: '#6b7355', corpsO: '#3a402a', corpsH: '#9ba07c', cheveux: '#4a5036', cheveuxO: '#2a2e1c', cuir: '#8a7250' },
  },
};
