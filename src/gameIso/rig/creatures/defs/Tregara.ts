import type { CreatureDef } from '../types';

// Trégara (ZI) — arthropode des Montagnes Noires (mante × bernard-l'ermite) : pinces antérieures +
// mandibules + carapace, grimpant. Approximé par le gabarit crustacé (pinces frontales), robe gris-
// brun rocheuse de montagne. Plus svelte que les crabes marins (girth réduit).
export const creature: CreatureDef = {
  label: 'Trégara',
  id: "tregara",
  plan: 'crustace',
  crab: {
    sl: 0.95, girth: 0.94,
    palette: { corps: '#6e5a44', corpsO: '#3c3026', corpsH: '#9c8668', cheveux: '#3c3026', cheveuxO: '#221b14', cuir: '#b6a484' },
  },
};
