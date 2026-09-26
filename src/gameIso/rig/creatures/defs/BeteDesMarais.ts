import type { CreatureDef } from '../types';

// Bête des marais — gabarit amorphe/hulk, forme `brute` (fidèle à l'artwork officiel,
// art-ref/ldb/page320_img7524.png) : colosse voûté et asymétrique de mousse et de racines,
// humanoïde massif — bras-troncs évasés aux doigts-racines posés au sol, pas de jambes (le bas
// du corps fond en jupe de vase + flaque à tendrons), matière filandreuse, masque végétal
// (lueurs pâles, alvéoles, gueule-fente). LDB 79 l.26-31 : « constitués de boue, d'os,
// de branches et de mucus », Taille (Grande).
export const creature: CreatureDef = {
  label: 'Bête des marais',
  id: "bete-des-marais",
  plan: 'amorphous',
  // Palette relevée sur l'illustration : mousse vert-jaune, creux presque noirs, plaques de
  // mousse claire en lumière, touffes pendantes vert profond, racines/serres brun d'écorce.
  hulk: {
    sl: 1.15, girth: 1.15, form: 'brute',
    palette: { corps: '#67743a', corpsO: '#20240e', corpsH: '#a9b25c', cheveux: '#3d4a1e', cheveuxO: '#161a08', cuir: '#5c4c28' },
  },
};
