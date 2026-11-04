import type { IconFamily } from '../types';

/* Famille « feu » (ForcedRollPicker/ResilienceButton — intensité de la Résilience/Critique ;
   ShipBatteryModal — bordée ; ShipSheet — poudre). Charte de dessin : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'fire/flame',
    label: 'Flamme',
    // Flamme simple à double lobe (braise interne).
    svg:
      `<path ${F} d="M12 2.9 C14.9 6.1 16.3 9 16.3 11.6 C16.3 14.8 14.4 16.9 12 16.9 C9.6 16.9 7.7 14.8 7.7 11.6 C7.7 10.1 8.4 8.6 9.6 7.2 C9.7 8.9 10.5 10 11.7 10.6 C11.1 8.3 11.2 5.6 12 2.9 Z"/>` +
      `<path ${K} d="M6.3 20.6 C9.4 21.4 14.6 21.4 17.7 20.6"/>`,
  },
  {
    id: 'fire/blast',
    label: 'Poudre / explosif',
    // Bâton de poudre, mèche allumée.
    svg:
      `<path ${K} d="M9.1 9.4 H14.9 V20.4 H9.1 Z"/>` +
      `<path ${K} d="M9.1 12.9 H14.9 M9.1 16.4 H14.9"/>` +
      `<path ${K} d="M12 9.4 V5.6 C12 5.6 10.3 5.1 10.6 3.6 C11.7 4.3 12.7 3.7 12.6 2.6"/>` +
      `<circle ${F} cx="12.9" cy="4.4" r="1.1"/>`,
  },
];
