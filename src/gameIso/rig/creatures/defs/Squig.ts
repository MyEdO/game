import type { CreatureDef } from '../types';

// Squig (des cavernes) — gabarit squig : boule rouge dominée par une gueule à crocs qui claque,
// crête d'épines, petites pattes. 1 fichier rempli (plus de sprite monolithique).
export const creature: CreatureDef = {
  label: 'Squig',
  id: "squig",
  plan: 'squig',
  squig: {
    // LDB 79 l.138 : « de forme ronde … gueule béante et de grandes dents pointues » —
    // girth resserré (la gueule/crocs sont de taille fixe → boule plus petite = gueule qui DOMINE,
    // crocs plus grands en proportion) ; rouge sang mat (highlight discret, fini l'effet jouet),
    // contour/épines/sourcils presque noirs (méchant), pattes en corne sombre (plus « moignon brun »).
    sl: 0.85, girth: 0.82,
    palette: { corps: '#a8200f', corpsO: '#3c0a04', corpsH: '#c44526', cheveux: '#5a1010', cheveuxO: '#3a0a0a', cuir: '#241910' },
  },
};
