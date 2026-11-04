import type { IconFamily } from '../types';

/* Famille « repos / gîte / météo » (RestModal, Inspector/Palette — lieux de repos et intempéries).
   Charte de dessin : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'rest/bed',
    label: 'Auberge (lit)',
    // Lit une place, tête de lit et oreiller.
    svg:
      `<path ${K} d="M3.6 19.6 V10.3 H20.4 V19.6"/>` +
      `<path ${K} d="M3.6 15.4 H20.4"/>` +
      `<path ${F} d="M5.1 11.4 H9.7 C10.2 11.4 10.6 11.8 10.6 12.3 V15.4 H5.1 Z"/>` +
      `<path ${K} d="M3.6 10.3 V6.9 M20.4 10.3 V6.9"/>`,
  },
  {
    id: 'rest/couch',
    label: 'Commune (canapé)',
    // Canapé bas à deux accoudoirs.
    svg:
      `<path ${K} d="M4.3 12.6 V19.6 M19.7 12.6 V19.6"/>` +
      `<path ${F} d="M3.6 12.9 C3.6 11.4 4.6 10.4 6 10.4 H18 C19.4 10.4 20.4 11.4 20.4 12.9 V16.3 H3.6 Z"/>` +
      `<path ${K} d="M4.3 16.3 V13.7 C4.3 13 4.9 12.6 5.6 12.6 H18.4 C19.1 12.6 19.7 13 19.7 13.7 V16.3"/>` +
      `<path ${K} d="M3.1 16.3 H20.9 V17.7 C20.9 18.7 20.1 19.6 19 19.6 H5 C3.9 19.6 3.1 18.7 3.1 17.7 Z"/>`,
  },
  {
    id: 'rest/home',
    label: 'Chez soi',
    // Petite maison, toit à deux pans.
    svg:
      `<path ${F} d="M12 3.6 L20.4 10.6 H17.9 V19.4 H6.1 V10.6 H3.6 Z"/>` +
      `<path ${KF} d="M9.7 19.4 V14.1 H14.3 V19.4"/>`,
  },
  {
    id: 'rest/camp',
    label: 'Campement (tente)',
    // Tente triangulaire, entrée ouverte.
    svg:
      `<path ${F} d="M12 4.1 L20.1 19.6 H15.6 L12 12.6 L8.4 19.6 H3.9 Z"/>` +
      `<path ${KF} d="M12 12.6 L10 19.6 M12 12.6 L14 19.6"/>`,
  },
  {
    id: 'rest/stew',
    label: 'Repas (ragoût)',
    // Marmite sur trépied, vapeur montante.
    svg:
      `<path ${F} d="M6 12.1 H18 C17.8 15.9 17.1 18.4 15.7 19.9 H8.3 C6.9 18.4 6.2 15.9 6 12.1 Z"/>` +
      `<path ${K} d="M4.7 11.2 H19.3"/>` +
      `<path ${K} d="M6.6 12.1 L4.6 8.3 M17.4 12.1 L19.4 8.3"/>` +
      `<path ${KF} d="M9.8 9.1 C9.6 7.9 10.1 7 11 6.1 C10.4 7.9 10.8 8.9 12 9.7"/>`,
  },
  {
    id: 'rest/feast',
    label: 'Repas fait maison',
    // Assiette garnie vue de dessus, couverts croisés.
    svg:
      `<circle ${K} cx="12" cy="12.4" r="7.3"/>` +
      `<circle ${K} cx="12" cy="12.4" r="3.2"/>` +
      `<path ${K} d="M6.2 6.6 L9.4 9.8 M9.4 6.6 L6.2 9.8"/>`,
  },
  {
    id: 'rest/cold',
    label: 'Froid extrême',
    // Flocon à six branches.
    svg:
      `<path ${K} d="M12 3.4 V20.6 M4.6 7.7 L19.4 16.3 M19.4 7.7 L4.6 16.3"/>` +
      `<path ${KF} d="M12 5.9 L9.8 4.4 M12 5.9 L14.2 4.4 M12 18.1 L9.8 19.6 M12 18.1 L14.2 19.6"/>`,
  },
  {
    id: 'rest/storm',
    label: 'Temps de chien',
    // Nuage lourd, éclair frappant.
    svg:
      `<path ${F} d="M6.6 13.4 C4.7 13.1 3.5 11.6 3.7 9.9 C3.9 8.3 5.4 7.2 7.1 7.4 C7.7 5.3 9.7 4 11.9 4.3 C14.2 4.6 15.8 6.6 15.7 8.8 C17.6 8.9 19 10.3 18.9 12.1 C18.8 13.7 17.3 14.9 15.6 14.7 Z"/>` +
      `<path ${K} d="M12.4 12.6 L9.6 17.3 H12.6 L10.4 21.6"/>`,
  },
  {
    id: 'rest/rain',
    label: 'Mauvais temps',
    // Nuage, traits de pluie.
    svg:
      `<path ${F} d="M6.6 12.6 C4.7 12.3 3.5 10.8 3.7 9.1 C3.9 7.5 5.4 6.4 7.1 6.6 C7.7 4.5 9.7 3.2 11.9 3.5 C14.2 3.8 15.8 5.8 15.7 8 C17.6 8.1 19 9.5 18.9 11.3 C18.8 12.9 17.3 14.1 15.6 13.9 Z"/>` +
      `<path ${K} d="M8 15.9 L6.6 19.9 M12.4 15.9 L11 20.6 M16.4 15.9 L15 19.9"/>`,
  },
];
