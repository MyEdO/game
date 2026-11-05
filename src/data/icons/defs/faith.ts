import type { IconFamily } from '../types';

/* Famille « foi » (ChanceButtons/CastModal/ManannPriestModal — Prière, chapelle, trident de Manann).
   Charte de dessin : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'faith/prayer',
    label: 'Prière',
    // Mains jointes en prière, vues de face.
    svg:
      `<path ${K} d="M12 4.3 V19.4"/>` +
      `<path ${K} d="M12 6.1 C9.6 6.7 8.3 8.7 8.3 11.6 C8.3 14.4 9.4 16.8 12 18.9"/>` +
      `<path ${K} d="M12 6.1 C14.4 6.7 15.7 8.7 15.7 11.6 C15.7 14.4 14.6 16.8 12 18.9"/>` +
      `<path ${KF} d="M9.3 10.3 C10 10.9 10.9 11.2 12 11.2 C13.1 11.2 14 10.9 14.7 10.3"/>`,
  },
  {
    id: 'faith/church',
    label: 'Chapelle',
    // Façade de chapelle : porche en arc, clocher et croix.
    svg:
      `<path ${K} d="M11.2 2.9 V5.3 M9.8 3.8 H12.6"/>` +
      `<path ${F} d="M11.2 5.5 C11.2 8 12.3 9.8 14.4 11.4 L8 11.4 C10.1 9.8 11.2 8 11.2 5.5 Z"/>` +
      `<path ${K} d="M5.2 20.7 V12.8 C6 11 8.3 10 11.2 10 C14.1 10 16.4 11 17.2 12.8 V20.7"/>` +
      `<path ${KF} d="M9.7 20.7 V16.6 C9.7 15.4 10.3 14.7 11.2 14.7 C12.1 14.7 12.7 15.4 12.7 16.6 V20.7"/>` +
      `<path ${KF} d="M3.9 20.9 H18.5"/>`,
  },
  {
    id: 'faith/trident',
    label: 'Trident',
    // Trident de Manann : trois dents, hampe et garde.
    svg:
      `<path ${K} d="M12 6.6 V21.1"/>` +
      `<path ${K} d="M9 20 H15"/>` +
      `<path ${K} d="M12 3 V8.1 M8.6 3.6 C8.5 5.2 9.4 6.6 10.7 7.3 M15.4 3.6 C15.5 5.2 14.6 6.6 13.3 7.3"/>`,
  },
];
