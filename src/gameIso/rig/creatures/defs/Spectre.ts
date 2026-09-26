import type { CreatureDef } from '../types';

// Spectre (de cairn) — gabarit spectral : esprit d'aspirant nécromancien (LDB 82 l.57-58
// « restes spectraux d'aspirants nécromanciens… volonté malveillante »), Éthéré + Étreinte
// glaciale + Terreur 3 (LDB 82 l.62). Faucheuse de l'illustration (LDB 82 p.331) : capuche-suaire
// quasi noire cerclée d'un liseré rivé, CRÂNE osseux doré-verdâtre dans l'ombre (hood + crane),
// FAUX tenue à deux mains squelettiques en diagonale (arme:'faux'), robe gris-vert terreuse
// très sombre qui se dissout en fumée. L'os doré + la faux le distinguent du Fantôme
// (bleu-blanc, cri) et de la Banshee (rousse, épée), tous deux tête nue.
export const creature: CreatureDef = {
  label: 'Spectre',
  id: "spectre",
  plan: 'spectral',
  spectre: {
    sl: 0.98, hood: true, face: 'crane', arme: 'faux',
    palette: { corps: '#4d5a46', corpsO: '#12160f', corpsH: '#98a690', cheveux: '#232b22', cheveuxO: '#12160f', cuir: '#c2b283' },
  },
};
