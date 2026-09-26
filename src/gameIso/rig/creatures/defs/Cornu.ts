import type { CreatureDef } from '../types';

// Cornu (ZI 80) — artwork p.80 : théropode BIPÈDE dressé sur ses pattes arrière (petits bras
// avant griffus), longue gueule de prédateur bardée de rangées de dents, crête d'épines
// OSSEUSES multiples sur le sommet du crâne (les « cornes pointues » de la source — pas une
// grande corne recourbée unique), épines continuant de la nuque à la queue, œil sombre discret,
// robe vert-écaille mouchetée à ventre jaune-vert. Gabarit `theropode` dédié.
export const creature: CreatureDef = {
  label: 'Cornu',
  id: "cornu",
  plan: 'theropode',
  thero: {
    sl: 1.12, girth: 1.05, horns: 1.15, muzzle: 1.0,
    palette: { corps: '#55703c', corpsO: '#28381d', corpsH: '#a3bd68', cheveux: '#39502a', cheveuxO: '#1c2a13', cuir: '#7a755c' },
  },
};
