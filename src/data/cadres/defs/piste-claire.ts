import type { CadreDef } from '../types';

/** Piste claire : le lit d'une glissière sur parchemin, un creux brun. */
export const cadre: CadreDef = {
  id: 'piste-claire',
  label: 'Piste claire',
  tranches: [2, 1, 2, 1],
  svg: `<rect x="0" y="0" width="128" height="128" rx="2" fill="var(--encre-de-page)" opacity="0.5"/><rect x="0" y="0" width="128" height="1" fill="var(--shadow-ink)" opacity="0.4"/>`,
};
