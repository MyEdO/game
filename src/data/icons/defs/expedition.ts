import type { IconFamily } from '../types';

/* Famille « Activités de voyage » (postes d'Étape EDOC 8 — grand air, rumeurs, cartographie,
   entraînement, chance en Rencontre). Distincte de `travel.ts` (modes de transport) et `rest.ts`
   (gîte/météo). Charte : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'expedition/outdoors',
    label: 'Grand air',
    // Soleil rayonnant.
    svg:
      `<circle ${F} cx="12" cy="12" r="4.4"/>` +
      `<path ${K} d="M12 3.6 V6 M12 18 V20.4 M3.6 12 H6 M18 12 H20.4 M6 6 L7.7 7.7 M16.3 16.3 L18 18 M18 6 L16.3 7.7 M7.7 16.3 L6 18"/>`,
  },
  {
    id: 'expedition/rumor',
    label: 'Rumeurs',
    // Bulle de parole, trois points de suspension.
    svg:
      `<path ${K} d="M4 6.6 H20 V15.4 H10.5 L6.5 19 V15.4 H4 Z"/>` +
      `<circle ${F} cx="8.6" cy="11" r="1.1"/><circle ${F} cx="12" cy="11" r="1.1"/><circle ${F} cx="15.4" cy="11" r="1.1"/>`,
  },
  {
    id: 'expedition/cartography',
    label: 'Cartographie',
    // Carte pliée à trois panneaux, itinéraire en pointillés.
    svg:
      `<path ${K} d="M4 6 L9 4 L15 6 L20 4 V18 L15 20 L9 18 L4 20 Z"/>` +
      `<path ${K} d="M9 4 V18 M15 6 V20"/>` +
      `<path ${KF} d="M6 14 L11 10 L14 12 L18 8"/>`,
  },
  {
    id: 'expedition/practice',
    label: 'Entraînement',
    // Cible concentrique.
    svg:
      `<circle ${K} cx="12" cy="12" r="8.4"/>` +
      `<circle ${K} cx="12" cy="12" r="5"/>` +
      `<circle ${F} cx="12" cy="12" r="2"/>`,
  },
  {
    id: 'expedition/clover',
    label: 'Chance (Rencontre positive)',
    // Trèfle à quatre feuilles sur sa tige.
    svg:
      `<path ${F} d="M12 11 C12 8.8 10.2 7 8 7 C6.3 7 5 8.3 5 10 C5 12.2 6.8 13 9 13 Z"/>` +
      `<path ${F} d="M12 11 C12 8.8 13.8 7 16 7 C17.7 7 19 8.3 19 10 C19 12.2 17.2 13 15 13 Z"/>` +
      `<path ${F} d="M12 13 C12 15.2 10.2 17 8 17 C6.3 17 5 15.7 5 14 C5 11.8 6.8 11 9 11 Z"/>` +
      `<path ${F} d="M12 13 C12 15.2 13.8 17 16 17 C17.7 17 19 15.7 19 14 C19 11.8 17.2 11 15 11 Z"/>` +
      `<path ${K} d="M12 12 V21"/>`,
  },
];
