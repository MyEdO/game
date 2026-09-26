import type { CreatureDef } from '../types';

// Araignée géante (gabarit arachnide) — abdomen moucheté + 8 pattes velues segmentées, cluster
// d'yeux vernissés. Robe calée sur l'artwork officiel (art-ref/ldb/page316_img7309.png) : brun
// terreux, ombres presque noires, rehauts tan pâle (face/bandes de pattes) — pas d'orange.
export const creature: CreatureDef = {
  label: 'Araignée',
  id: "araignee",
  plan: 'arachnid',
  spider: {
    sl: 1.0, girth: 1.14, // gros abdomen bulbeux (LDB 78 : « effroyablement grandes »)
    palette: { corps: '#6a5138', corpsO: '#241a10', corpsH: '#c9ab77', cheveux: '#181210', cheveuxO: '#0e0a08', cuir: '#7a1010' },
  },
};
