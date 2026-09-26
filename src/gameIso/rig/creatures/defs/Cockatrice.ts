import type { CreatureDef } from '../types';

// Cockatrice (ZI) — artwork art-ref/zi/page068_img1.png : dragon BIPÈDE dressé sur ses pattes
// arrière (buste redressé, petits bras griffus), GRANDES AILES MEMBRANEUSES de chauve-souris
// déployées, longue queue SERPENTINE effilée, tête et cou de coq/rapace emplumés hirsutes à BEC
// CROCHU ouvert, œil pâle fixe. Gabarit `theropode` + traits optionnels wings/beak/plumage/
// serpentTail. Robe vert-jaune maladive, plumage sombre, bec et serres de cuir orange.
export const creature: CreatureDef = {
  label: 'Cockatrice',
  id: "cockatrice",
  plan: 'theropode',
  thero: {
    sl: 1.05, girth: 0.95, horns: 0, muzzle: 1.0,
    wings: 1.0, beak: 1.0, plumage: 1.0, serpentTail: true,
    palette: {
      corps: '#8a8a3e', corpsO: '#454618', corpsH: '#c8cc78',
      cheveux: '#3f4520', cheveuxO: '#1f2410', cuir: '#c87a2a',
      voilure: '#9a9c74', voilureO: '#4a4c30',
    },
  },
};
