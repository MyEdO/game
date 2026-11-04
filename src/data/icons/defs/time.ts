import type { IconFamily } from '../types';

/* Phases du jour (src/data/calendarPhases.json) — charte : voir defs/action.ts.
   Série à HORIZON COMMUN : même ligne d'horizon partout, le soleil se lit gauche→droite
   (levant→couchant) puis la lune prend le relais. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

/** Ligne d'horizon partagée par les 7 phases. */
const HORIZON = `<path ${K} d="M3.2 16.4 C9 15.7 15 15.7 20.8 16.4"/>`;

export const icons: IconFamily = [
  {
    id: 'time/dawn',
    label: 'Aube',
    svg:
      HORIZON +
      `<path ${F} d="M8.1 16 A3.9 3.9 0 0 1 15.9 16 Z"/>` +
      `<path ${K} d="M12 10.7 V8.3 M6.9 12.5 L5.3 10.9 M17.1 12.5 L18.7 10.9"/>`,
  },
  {
    id: 'time/morning',
    label: 'Matin',
    svg:
      HORIZON +
      `<circle ${F} cx="8.9" cy="10.9" r="3.2"/>` +
      `<path ${KF} d="M8.9 6.4 V4.7 M4.5 9.2 L3.1 8.4 M12.9 8 L14.3 6.9"/>`,
  },
  {
    id: 'time/noon',
    label: 'Midi',
    svg:
      HORIZON +
      `<circle ${F} cx="12" cy="8.7" r="3.3"/>` +
      `<path ${K} d="M12 3.7 V2.2 M6.8 8.7 H5 M17.2 8.7 H19 M8.3 5 L7.1 3.8 M15.7 5 L16.9 3.8 M8.5 12.5 L7.3 13.6 M15.5 12.5 L16.7 13.6"/>`,
  },
  {
    id: 'time/afternoon',
    label: 'Après-midi',
    svg:
      HORIZON +
      `<circle ${F} cx="15.1" cy="10.9" r="3.2"/>` +
      `<path ${KF} d="M15.1 6.4 V4.7 M19.5 9.2 L20.9 8.4 M18.9 13.6 L20.2 14.6"/>` +
      `<path ${K} d="M4.9 13.6 C4.6 12.4 5.5 11.4 6.7 11.6 C7.1 10.4 8.5 9.9 9.6 10.5 C10.7 10.2 11.7 11 11.6 12.1 C11.5 12.9 11 13.5 10.2 13.7 C8.5 14 6.7 13.9 4.9 13.6 Z"/>`,
  },
  {
    id: 'time/dusk',
    label: 'Crépuscule',
    svg:
      HORIZON +
      `<path ${F} d="M8.3 16 A5.4 5.4 0 0 1 15.7 16 Z"/>` +
      `<path ${K} d="M12 18.2 V20.3 M8 17.9 L6.9 19.6 M16 17.9 L17.1 19.6"/>`,
  },
  {
    id: 'time/evening',
    label: 'Soir',
    svg:
      HORIZON +
      `<path ${F} d="M16.6 7.5 C14.2 7.4 12.2 9.1 11.9 11.4 C11.6 13.7 13.3 15.7 15.6 16 C16 16.1 16.4 16.1 16.8 16 C15 14.9 14.1 13.3 14.1 11.7 C14.1 10 15 8.5 16.6 7.5 Z"/>` +
      `<path ${F} d="M7.3 5.9 C7.5 6.9 7.9 7.3 8.9 7.5 C7.9 7.7 7.5 8.1 7.3 9.1 C7.1 8.1 6.7 7.7 5.7 7.5 C6.7 7.3 7.1 6.9 7.3 5.9 Z"/>`,
  },
  {
    id: 'time/night',
    label: 'Nuit',
    svg:
      HORIZON +
      `<path ${F} d="M13.9 2.8 C10.4 2.6 7.4 5.1 7 8.5 C6.6 11.9 9 14.9 12.4 15.3 C13 15.4 13.6 15.3 14.1 15.2 C11.5 13.6 10.2 11.3 10.2 8.9 C10.2 6.5 11.5 4.3 13.9 2.8 Z"/>` +
      `<path ${F} d="M18.6 5.1 C18.8 6.3 19.3 6.8 20.5 7 C19.3 7.2 18.8 7.7 18.6 8.9 C18.4 7.7 17.9 7.2 16.7 7 C17.9 6.8 18.4 6.3 18.6 5.1 Z"/>` +
      `<circle ${F} cx="17.4" cy="11.9" r="0.8"/>`,
  },
  {
    id: 'time/clock',
    label: 'Heure',
    // Cadran d'horloge, aiguilles pointant une heure précise (réglage manuel, distinct des phases du jour).
    svg:
      `<circle ${K} cx="12" cy="12" r="8.1"/>` +
      `<path ${K} d="M12 7.4 V12.3 L15.6 14.5"/>`,
  },
  {
    id: 'time/calendar',
    label: 'Calendrier',
    // Page de calendrier à anneaux, jours pointés.
    svg:
      `<path ${K} d="M5.4 5.6 H18.6 C19.4 5.6 20 6.2 20 7 V19 C20 19.8 19.4 20.4 18.6 20.4 H5.4 C4.6 20.4 4 19.8 4 19 V7 C4 6.2 4.6 5.6 5.4 5.6 Z"/>` +
      `<path ${K} d="M8 3.6 V7.6 M16 3.6 V7.6"/>` +
      `<path ${KF} d="M4 10.2 H20"/>` +
      `<circle ${F} cx="8.6" cy="14.4" r="1"/>` +
      `<circle ${F} cx="12" cy="14.4" r="1"/>` +
      `<circle ${F} cx="15.4" cy="14.4" r="1"/>`,
  },
];
