import type { CadreDef } from '../types';

/** Piste : le lit d'une glissière, un creux d'encre que borde un filet d'or. */
export const cadre: CadreDef = {
  id: 'piste',
  label: 'Piste',
  tranches: [2, 1, 2, 1],
  svg: `<rect x="0" y="0" width="128" height="128" rx="2" fill="var(--filet-or)" opacity="0.3"/><rect x="1" y="1" width="126" height="126" rx="1.5" fill="var(--nuit-de-bois)"/>`,
};
