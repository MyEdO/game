import type { CadreDef } from '../types';

/** Piste pleine : la part d'une glissière déjà parcourue, de cire rouge. */
export const cadre: CadreDef = {
  id: 'piste-pleine',
  label: 'Piste pleine',
  tranches: [2, 1, 2, 1],
  svg: `<linearGradient id="piste-pleine-cire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--cire-claire)"/><stop offset="1" stop-color="var(--cire)"/></linearGradient><rect x="0" y="0" width="128" height="128" rx="2" fill="url(#piste-pleine-cire)"/>`,
};
