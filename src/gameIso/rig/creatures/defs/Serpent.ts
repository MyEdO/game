import type { CreatureDef } from '../types';

// Serpent (gabarit serpentin) — vipère des forêts profondes de l'Empire (LDB 79 l.5-6) :
// venin mortel ou constriction, proportions potentiellement gigantesques. Corps lové massif
// (constricteur), pas de capuchon de cobra (rendait comme des « oreilles »). Calé sur l'artwork
// LDB 79 p.319 (art-ref/ldb/page319_img7471.png) : robe vert forêt à BANDES transversales sombres
// et mouchetures claires (markings 'bandes'), œil ROUGE, et queue PÂLE gris-lilas qui se déploie
// en S au-dessus du lové (tailUp, colorée par @cheveux/@cheveuxO).
export const creature: CreatureDef = {
  label: 'Serpent',
  id: "serpent",
  plan: 'serpentine',
  serpent: {
    sl: 1.0, girth: 1.12, hood: false,
    markings: 'bandes', eye: '#c42222', tailUp: true,
    palette: { corps: '#5e8a3f', corpsO: '#2c4520', corpsH: '#a9cc66', cheveux: '#c4c1d2', cheveuxO: '#8f8ba2', cuir: '#caa23a' },
  },
};
