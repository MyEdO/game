import type { CreatureDef } from '../types';

// Crapaud géant : batracien trapu, sac très large et bas, gros yeux bombés dorés, large bouche,
// peau verruqueuse, pas de queue. Quadrupède à build `batracien` (nouveau) + tête `crapaud`.
// Sorti du monolithique : 1 fichier, rendu en jeu via AnimatedQuadToken.
export const creature: CreatureDef = {
  label: 'Crapaud',
  id: "crapaud",
  plan: 'quadruped',
  quad: {
    sl: 0.98, build: 'batracien', girth: 1.5, bodyLen: 0.95, neckLen: 0.06, neckAngle: 4,
    legLen: 0.45, head: 'crapaud', tail: 'sans', mane: 'sans', ears: 'rondes', foot: 'patte',
    headScale: 1.25, markings: 'taches',
    palette: { corps: '#6e7b3e', corpsO: '#3c431c', corpsH: '#9aa85f', cheveux: '#3a3a20', cheveuxO: '#23230f', cuir: '#4a5226', cuirO: '#2c3214' },
  },
};
