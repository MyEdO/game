import type { CreatureDef } from '../types';

// Carnosaure (ZI 80) — artwork p.80 : grand théropode BIPÈDE (le « grand lézard des Terres du
// Sud », plus grand que le Cornu) : pattes arrière massives digitigrades, petits bras avant
// griffus, queue-balancier horizontale à crête, énorme gueule de reptile bardée de rangées de
// dents, crâne NU (sans cornes — c'est le trait qui le distingue du Cornu), crête d'épines de la
// nuque à la queue, robe vert forêt mouchetée de sombre à gorge/ventre vert-jaune pâle.
export const creature: CreatureDef = {
  label: 'Carnosaure',
  id: "carnosaure",
  plan: 'theropode',
  thero: {
    sl: 1.35, girth: 1.12, horns: 0, muzzle: 1.25,
    palette: { corps: '#4a6338', corpsO: '#20301a', corpsH: '#a8bd74', cheveux: '#324a22', cheveuxO: '#182611', cuir: '#6d7250' },
  },
};
