import type { IconFamily } from '../types';

/* Famille « meteo » : la météo du jour d'un trajet (`Weather`, `src/data/schemas/defs/weather.ts`), en pictogramme
   devant sa ligne dans l'objet du temps du voyage. Charte de dessin : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';

/** Le nuage commun aux temps couverts. */
const NUAGE = `<path ${K} d="M7 15.5a4 4 0 0 1 .7-7.9 5.2 5.2 0 0 1 10 1.4 3.3 3.3 0 0 1-.5 6.5z"/>`;

export const icons: IconFamily = [
  {
    id: 'meteo/sec',
    label: 'Temps sec',
    // Un soleil voilé derrière un nuage.
    svg: `<circle ${K} cx="8.5" cy="8" r="3"/><path ${KF} d="M8.5 2.6v1.2M3.1 8h1.2M4.7 4.2l.9.9M12.3 4.2l-.9.9"/>` +
      `<path ${K} d="M10 19a3.4 3.4 0 0 1 .6-6.7 4.4 4.4 0 0 1 8.4 1.2 2.8 2.8 0 0 1-.4 5.5z"/>`,
  },
  {
    id: 'meteo/beau',
    label: 'Beau temps',
    // Un soleil franc et ses rayons.
    svg: `<circle ${K} cx="12" cy="12" r="4"/><path ${K} d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/>`,
  },
  {
    id: 'meteo/pluie',
    label: 'Pluie',
    // Un nuage et trois traits de pluie fine.
    svg: `${NUAGE}<path ${KF} d="M8.5 18l-.8 2.6M12 18l-.8 2.6M15.5 18l-.8 2.6"/>`,
  },
  {
    id: 'meteo/pluie-diluvienne',
    label: 'Pluie diluvienne',
    // Un nuage sous une pluie serrée.
    svg: `${NUAGE}<path ${K} d="M7.5 17.8l-1.2 3.4M10.5 17.8l-1.2 3.4M13.5 17.8l-1.2 3.4M16.5 17.8l-1.2 3.4"/>`,
  },
  {
    id: 'meteo/neige',
    label: 'Neige',
    // Un nuage et ses flocons.
    svg: `${NUAGE}<path ${KF} d="M8.5 18.2v2.4M7.3 19.4h2.4M15.5 18.2v2.4M14.3 19.4h2.4M12 19.6v2.2M10.9 20.7h2.2"/>`,
  },
  {
    id: 'meteo/blizzard',
    label: 'Blizzard',
    // Des rafales chargées de flocons.
    svg: `<path ${K} d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5M3 12h15a2.5 2.5 0 1 1-2.5 2.5M3 16h7"/>` +
      `<path ${KF} d="M14 18.6v2.4M12.8 19.8h2.4M19 17.2v2.4M17.8 18.4h2.4"/>`,
  },
];
