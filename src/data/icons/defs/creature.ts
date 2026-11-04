import type { IconFamily } from '../types';

/* Attaques naturelles des créatures (hotbar de manœuvres — sens : src/noyau/combatManeuvers.ts).
   Charte : voir defs/action.ts (grille 24×24, trait 1.8 rond, silhouette pleine, une métaphore). */

/** Trait principal. */
const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
/** Trait fin (détail secondaire). */
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
/** Silhouette pleine. */
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'creature/bite',
    label: 'Morsure',
    svg:
      `<path ${F} d="M4.2 8.8 C5.2 4.9 18.8 4.9 19.8 8.8 L18 8.8 L16.5 11.9 L15 8.8 L13 8.8 L11.5 11.9 L10 8.8 L8 8.8 L6.5 11.9 L5 8.8 Z"/>` +
      `<path ${F} d="M4.8 15.4 C5.8 19.3 18.2 19.3 19.2 15.4 L17.2 15.4 L15.7 12.5 L14.2 15.4 L11.7 15.4 L10.2 12.5 L8.7 15.4 Z"/>`,
  },
  {
    id: 'creature/tail',
    label: 'Caudale',
    svg:
      `<path ${F} d="M3.6 21 C4.6 15.8 7.4 11.6 12 8.7 C14.8 6.9 17 5.4 18.9 3.6 C18.2 6.6 16.2 8.9 12.9 11.1 C9.3 13.5 7 16.8 6.6 21.2 Z"/>` +
      `<path ${KF} d="M15.9 12.4 C17.9 11 19.6 9.3 21 7.2"/>` +
      `<path ${KF} d="M17.7 14.7 C19.4 13.4 20.9 11.9 22 10.2"/>`,
  },
  {
    id: 'creature/horns',
    label: 'Cornes',
    svg:
      `<path ${F} d="M10.8 19.2 C6.8 17.6 4.6 13.6 4.9 8.6 C5 7 5.4 5.5 6.2 4.1 C6.3 6 6.9 7.6 8 9.1 C10 11.7 11 14.8 10.8 19.2 Z"/>` +
      `<path ${F} d="M13.2 19.2 C17.2 17.6 19.4 13.6 19.1 8.6 C19 7 18.6 5.5 17.8 4.1 C17.7 6 17.1 7.6 16 9.1 C14 11.7 13 14.8 13.2 19.2 Z"/>` +
      `<path ${KF} d="M10.6 20 C11.5 20.5 12.5 20.5 13.4 20"/>`,
  },
  {
    id: 'creature/breath',
    label: 'Souffle',
    svg:
      // Gueule béante (deux mâchoires courbes) + éventail de trois jets divergents.
      `<path ${F} d="M2.6 5.6 C6 5.2 8.8 7 9.8 10.2 L2.9 8.9 Z"/>` +
      `<path ${F} d="M2.6 18.4 C6 18.8 8.8 17 9.8 13.8 L2.9 15.1 Z"/>` +
      `<path ${K} d="M10.4 10.4 C13.6 8.8 16.9 7.7 20.6 7.1"/>` +
      `<path ${K} d="M10.8 12 C14.2 12 17.6 12 21 12"/>` +
      `<path ${K} d="M10.4 13.6 C13.6 15.2 16.9 16.3 20.6 16.9"/>`,
  },
  {
    id: 'creature/vomit',
    label: 'Vomi',
    svg:
      `<path ${F} d="M3.4 4.8 L11.2 8.6 L4 9.6 Z"/>` +
      `<path ${F} d="M3.6 12.6 L9.2 10.4 L3.9 9.9 Z"/>` +
      `<path ${F} d="M9.8 8.9 C13 10.2 14.6 12.8 14.7 16.4 L14.7 20.6 L11.8 20.6 L11.8 16.6 C11.7 13.9 10.5 11.9 8.2 10.6 Z"/>` +
      `<circle ${F} cx="17.2" cy="15.4" r="0.9"/>` +
      `<circle ${F} cx="16.6" cy="19.2" r="0.7"/>`,
  },
  {
    id: 'creature/tentacles',
    label: 'Tentacules',
    svg:
      `<path ${F} d="M5 21 C4.4 15.6 5.8 10.8 9 7.4 C10.4 5.9 12 5.2 13.2 5.8 C12.4 6.3 11.5 7 10.7 7.9 C7.9 11.2 6.8 15.6 7.6 20.9 Z"/>` +
      `<path ${F} d="M14.4 21 C14 17 15 13.6 17.4 11 C18.5 9.8 19.8 9.3 20.8 9.8 C20.1 10.2 19.4 10.8 18.7 11.6 C16.7 14 15.9 17.2 16.6 20.9 Z"/>` +
      `<circle ${F} cx="8.7" cy="17" r="0.6"/>` +
      `<circle ${F} cx="9.4" cy="13.8" r="0.6"/>` +
      `<circle ${F} cx="10.8" cy="10.9" r="0.6"/>` +
      `<circle ${F} cx="17.1" cy="17.5" r="0.55"/>` +
      `<circle ${F} cx="17.9" cy="14.6" r="0.55"/>`,
  },
  {
    id: 'creature/squeeze',
    label: 'Étreinte',
    svg:
      `<ellipse ${K} cx="12" cy="7" rx="5.4" ry="2.2"/>` +
      `<ellipse ${K} cx="12" cy="12.1" rx="6" ry="2.3"/>` +
      `<ellipse ${K} cx="12" cy="17.1" rx="5.2" ry="2.2"/>` +
      `<circle ${F} cx="17.6" cy="5.6" r="1.3"/>`,
  },
  {
    id: 'creature/gaze',
    label: 'Regard',
    svg:
      `<path ${K} d="M3.6 13.2 C6.2 9.2 9 7.3 12 7.3 C15 7.3 17.8 9.2 20.4 13.2 C17.8 17.2 15 19.1 12 19.1 C9 19.1 6.2 17.2 3.6 13.2 Z"/>` +
      `<circle ${F} cx="12" cy="13.2" r="2.4"/>` +
      `<path ${K} d="M12 4.9 V2.6 M6.6 6.4 L5.2 4.6 M17.4 6.4 L18.8 4.6"/>`,
  },
  {
    id: 'creature/tongue',
    label: 'Langue',
    svg:
      `<path ${F} d="M3.4 7.8 L10.2 10.9 L4 11.7 Z"/>` +
      `<path ${F} d="M3.6 15.4 L8.8 12.6 L4 12.1 Z"/>` +
      `<path ${K} d="M8.6 11.9 C12.4 12.6 15.4 11.9 17.5 9.7 C18.9 8.2 19.7 6.3 19.9 4.2"/>` +
      `<circle ${F} cx="19.9" cy="4" r="1.15"/>`,
  },
  {
    id: 'creature/scream',
    label: 'Hurlement',
    svg:
      `<path ${F} d="M3.4 5.8 L11 10.8 L4 11.5 Z"/>` +
      `<path ${F} d="M3.4 18.2 L11 13.2 L4 12.5 Z"/>` +
      `<path ${K} d="M13.8 8.6 C15.3 10.7 15.3 13.3 13.8 15.4"/>` +
      `<path ${K} d="M16.6 6.6 C18.7 9.6 18.7 14.4 16.6 17.4"/>` +
      `<path ${KF} d="M19.3 4.8 C21.9 8.8 21.9 15.2 19.3 19.2"/>`,
  },
];
