import type { CadreDef } from '../types';

/** Nu : aucun cadre, la seule matière du panneau qui le porte (le bois d'une table). */
export const cadre: CadreDef = {
  id: 'nu',
  label: 'Nu',
  tranches: [1, 1, 1, 1],
  svg: '<rect x="0" y="0" width="128" height="128" fill="none"/>',
};
