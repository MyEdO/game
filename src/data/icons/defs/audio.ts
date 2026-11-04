import type { IconFamily } from '../types';

/* Famille « audio » (AudioControls — remplace les anciens emoji haut-parleur muet/haut-parleur/
   note de musique). Charte de dessin : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'audio/mute',
    label: 'Son coupé',
    // Pavillon de haut-parleur, croix de sourdine.
    svg:
      `<path ${F} d="M4.4 9.6 H7.6 L12.4 5.4 V18.6 L7.6 14.4 H4.4 Z"/>` +
      `<path ${K} d="M15.4 9.8 L19.8 14.2 M19.8 9.8 L15.4 14.2"/>`,
  },
  {
    id: 'audio/volume',
    label: 'Volume',
    // Pavillon de haut-parleur, ondes sonores croissantes.
    svg:
      `<path ${F} d="M4.4 9.6 H7.6 L12.4 5.4 V18.6 L7.6 14.4 H4.4 Z"/>` +
      `<path ${K} d="M15.6 9.4 C17.4 10.8 17.4 13.2 15.6 14.6"/>` +
      `<path ${KF} d="M17.6 6.9 C21 9.6 21 14.4 17.6 17.1"/>`,
  },
  {
    id: 'audio/music',
    label: 'Musique',
    // Croche double (deux notes reliées par une barre).
    svg:
      `<path ${K} d="M9.6 16.4 V6.3 L16.6 4.8 V14.9"/>` +
      `<circle ${F} cx="7.8" cy="16.9" r="2.4"/>` +
      `<circle ${F} cx="14.8" cy="15.4" r="2.4"/>`,
  },
];
