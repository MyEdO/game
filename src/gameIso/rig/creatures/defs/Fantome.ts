import type { CreatureDef } from '../types';

// Fantôme — gabarit spectral calé sur l'artwork LDB 82 p.330 : crâne DÉCHARNÉ hurlant (orbites
// creuses, gouffre denté — LDB 82 « esprits d'âmes tourmentées… répandent la peur »), longues
// mèches vaporeuses pâles flottant autour de la tête, mains squelettiques griffues vert livide
// au bout des manches, linceul blanc-vert spectral translucide qui se dissout en brume vers le
// bas (trait Éthéré, LDB 85). Le blanc-vert livide tête nue le distingue de la Banshee
// (suaire violet, visage féminin) et du Spectre de cairn (capuche sombre + crâne).
export const creature: CreatureDef = {
  label: 'Fantôme',
  id: "fantome",
  plan: 'spectral',
  spectre: {
    sl: 0.95, hood: false, face: 'crane-cri', cheveux: true, griffes: true, brume: true,
    palette: { corps: '#dcefe3', corpsO: '#7c9c8b', corpsH: '#f6fff8', cheveux: '#cfe4d4', cheveuxO: '#98b5a4', cuir: '#6f9070' },
  },
};
