import type { CreatureDef } from '../types';

// Rat Loup (ZI) — rongeur de la taille d'un loup. Quadrupède 'rodent' à tête 'rat', longue queue
// 'nue' écailleuse, oreilles pointues. Pelage galeux brun-gris, queue/oreilles rosâtres (cuir).
export const creature: CreatureDef = {
  label: 'Rat Loup',
  id: "rat-loup",
  plan: 'quadruped',
  quad: {
    sl: 0.85, build: 'rodent', girth: 0.92, bodyLen: 1.12, neckLen: 0.48, neckAngle: -6, legLen: 0.6,
    head: 'rat', tail: 'nue', mane: 'sans', ears: 'pointues', foot: 'patte', headScale: 1.1, tailLen: 1.7,
    palette: { corps: '#6a5e4a', corpsO: '#3a3226', corpsH: '#8c7e64', cheveux: '#46402f', cheveuxO: '#262018', cuir: '#caa090' },
  },
};
