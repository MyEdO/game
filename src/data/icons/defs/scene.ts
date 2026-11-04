import type { IconFamily } from '../types';

/* Famille « effets de scène/campagne » (EffectList — éclairage, ambiance). Charte de dessin :
   voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';

export const icons: IconFamily = [
  {
    id: 'scene/light',
    label: 'Lumière de scène',
    // Ampoule rayonnante, culot à filets.
    svg:
      `<circle ${K} cx="12" cy="10.4" r="5.4"/>` +
      `<path ${K} d="M9.8 15.4 H14.2 V17.6 C14.2 18.4 13.6 19 12.8 19 H11.2 C10.4 19 9.8 18.4 9.8 17.6 Z"/>` +
      `<path ${KF} d="M11 20.6 H13"/>` +
      `<path ${K} d="M12 2.4 V4.4 M4.6 5 L6 6.4 M19.4 5 L18 6.4"/>`,
  },
];
