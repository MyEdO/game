import type { CreatureDef } from '../types';

// Hydre : grand reptile à SIX têtes serpentines (artwork LDB 79 p.323). Quadrupède `draconic` +
// tête `hydre` (cluster de 6 cous dessiné dans l'os encolure — rang lointain sombre + rang
// proche, gueules béantes rouge sang) + queue `reptile` portant la crête. La crête de flammes
// rouge-orangé du dos/queue est colorée par @cheveux/@cheveuxO (éditable ici). Robe vert olive
// à reflets métalliques (@corpsH clair). Sortie du monolithique : rendu via AnimatedQuadToken.
export const creature: CreatureDef = {
  label: 'Hydre',
  id: "hydre",
  plan: 'quadruped',
  quad: {
    // Canon LDB 79 l.96-98 : « corps massif » (girth↑, pattes courtes), « entrelacs de cous »
    // (neckLen↑), Constricteur (tailLen↑), Furtif des marais (robe tachetée), Armure 3.
    sl: 1.2, build: 'draconic', girth: 1.2, bodyLen: 1.14, neckLen: 1.55, neckAngle: -12,
    legLen: 0.66, head: 'hydre', tail: 'reptile', mane: 'sans', ears: 'pointues', foot: 'patte',
    tailLen: 1.35, markings: 'taches', tailCrest: true,
    palette: { corps: '#5a6a34', corpsO: '#2a3616', corpsH: '#a9b56a', cheveux: '#c2571e', cheveuxO: '#6e2410', cuir: '#8a7a4e' },
  },
};
