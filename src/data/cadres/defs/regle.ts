import type { CadreDef } from '../types';

/** Règle : la rangée d'un registre, que sépare de la suivante un trait d'encre pâle à son pied. */
export const cadre: CadreDef = {
  id: 'regle',
  label: 'Règle',
  tranches: [1, 1, 1, 2],
  svg: '<rect x="0" y="127" width="128" height="1" fill="var(--encre-de-page)" opacity="0.28"/>',
};
