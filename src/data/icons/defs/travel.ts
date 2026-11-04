import type { IconFamily } from '../types';

/* Famille « voyage » (sélecteur de mode de la carte du monde + `vehicle.icon` de vehicles.json —
   remplace les emojis diligence/barge/barque/charrette/voilier/pied/monture/ancre). Charte de
   dessin : voir defs/action.ts. Pictogrammes de TRANSPORT clairs et reconnaissables (un bateau
   ressemble à un bateau) ; métaphores Renaissance-fantasy monochromes, pas de glyphe moderne. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'travel/coach',
    label: 'Diligence',
    // Caisse d'attelage fermée sur ses deux grandes roues à rayons, timon vers l'avant.
    svg:
      `<path ${K} d="M4.4 7.2 H15.6 C16.4 7.2 17 7.8 17 8.6 V13.4 H4.4 Z"/>` +
      `<path ${KF} d="M7.2 7.4 V13.2 M11.2 7.4 V13.2"/>` +
      `<path ${K} d="M17 10 L20.4 8.6"/>` +
      `<circle ${K} cx="7.2" cy="16.6" r="3.1"/>` +
      `<circle ${K} cx="14.4" cy="16.6" r="3.1"/>` +
      `<path ${KF} d="M7.2 13.7 V19.5 M4.3 16.6 H10.1 M14.4 13.7 V19.5 M11.5 16.6 H17.3"/>`,
  },
  {
    id: 'travel/barge',
    label: 'Barge',
    // Chaland fluvial à fond plat, cabine centrale et longue perche du batelier.
    svg:
      `<path ${K} d="M3 14.5 C3.6 17.3 6.3 19.2 9.4 19.2 H14.6 C17.7 19.2 20.4 17.3 21 14.5 Z"/>` +
      `<path ${K} d="M8.2 14.2 V9.4 H15.8 V14.2"/>` +
      `<path ${KF} d="M10.6 9.5 V14 M13.4 9.5 V14"/>` +
      `<path ${K} d="M17.6 6 L6.4 17"/>`,
  },
  {
    id: 'travel/rowboat',
    label: 'Barque à rames',
    // Coque de barque à clins, une rame croisée dans le tolet.
    svg:
      `<path ${K} d="M3.4 13.6 C4.4 16.6 7.4 18.6 12 18.6 C16.6 18.6 19.6 16.6 20.6 13.6 Z"/>` +
      `<path ${KF} d="M5.5 15.9 C9.5 17 14.5 17 18.5 15.9"/>` +
      `<path ${K} d="M9.6 13.4 L18.9 5.6"/>` +
      `<path ${KF} d="M17.8 4.3 L20.3 6.7"/>`,
  },
  {
    id: 'travel/cart',
    label: 'Charrette',
    // Plateau ouvert à ridelles sur une roue, brancard de trait vers l'avant.
    svg:
      `<path ${K} d="M5 9.4 H16.2 L15 14.2 H5 Z"/>` +
      `<path ${KF} d="M5.9 9.6 V13.9 M8.7 9.6 L8.2 13.9 M11.5 9.6 L11.5 13.9 M14.3 9.6 L13.7 13.9"/>` +
      `<path ${K} d="M16.2 9.4 L20.6 7.8"/>` +
      `<circle ${K} cx="9.6" cy="17.3" r="2.6"/>` +
      `<path ${KF} d="M9.6 14.9 V19.7 M7.2 17.3 H12"/>`,
  },
  {
    id: 'travel/sail-ship',
    label: 'Navire à voile',
    // Coque de haute mer, mât et grande voile gonflée, fanion en tête de mât.
    svg:
      `<path ${K} d="M3.2 15.5 C4.3 18.3 7.3 20 12 20 C16.7 20 19.7 18.3 20.8 15.5 Z"/>` +
      `<path ${K} d="M12 4 V15"/>` +
      `<path ${F} d="M12.9 4.7 C15.1 5.3 16.9 6.5 18.3 8.2 L12.9 8.2 Z"/>` +
      `<path ${F} d="M11.1 5.2 C8.6 6.3 6.9 8.2 6.1 10.9 C7.7 11.6 9.4 11.9 11.1 11.9 Z"/>` +
      `<path ${KF} d="M12 4 L15.4 4.6 L12 5.4"/>`,
  },
  {
    id: 'travel/foot',
    label: 'À pied',
    // Empreinte de pied nu : plante et cinq orteils (marche du groupe).
    svg:
      `<path ${F} d="M9.4 5.6 C11.9 5.6 13.6 7.8 13.6 11 C13.6 13.4 12.9 15.4 11.3 16.6 C10 17.6 8.6 17.9 7.3 17.4 C6 16.9 5.3 15.7 5.3 14 C5.3 12.6 5.6 11 6 9.3 C6.5 7 7.6 5.6 9.4 5.6 Z"/>` +
      `<circle ${F} cx="15.7" cy="8" r="1.5"/>` +
      `<circle ${F} cx="17.4" cy="10.9" r="1.35"/>` +
      `<circle ${F} cx="17.7" cy="14" r="1.25"/>` +
      `<circle ${F} cx="16.6" cy="16.7" r="1.15"/>`,
  },
  {
    id: 'travel/mount',
    label: 'En selle',
    // Tête et encolure de cheval en « cavalier d'échecs » : oreille dressée, chanfrein concave, museau
    // saillant, encolure arquée et crinière, posée sur un socle. Silhouette monochrome NON ambiguë avec
    // un sanglier (dont la tête basse groin-en-avant piégeait l'ancien dessin).
    svg:
      `<path ${F} d="M10 3 C10.6 4.4 10.7 5.7 10.3 7 C11.7 6.6 12.9 7.1 13.7 8.1 C14.7 9.4 15.1 11.2 15.1 13.4 L15.1 16.5 C15.1 17.4 15.6 18.1 16.5 18.5 L16.5 19.7 L6.4 19.7 L6.4 18.5 C7.3 18.1 7.8 17.4 7.8 16.5 L7.8 13.4 C6.3 14.2 4.8 14.2 3.4 13.4 C4.3 11.5 5.5 9.9 7.2 8.8 L5 8.1 C5.7 7 6.7 6.3 8 6.1 C8 4.9 8.3 3.9 8.9 3 Z"/>`,
  },
  {
    id: 'travel/anchor',
    label: 'En mer',
    // Ancre de marine : jas, tige et pattes recourbées, anneau en tête (traversée maritime).
    svg:
      `<circle ${K} cx="12" cy="5" r="1.9"/>` +
      `<path ${K} d="M12 6.9 V18.8"/>` +
      `<path ${K} d="M8.6 9.4 H15.4"/>` +
      `<path ${K} d="M5 12.4 C5 16.2 8.1 18.9 12 18.9 C15.9 18.9 19 16.2 19 12.4"/>` +
      `<path ${K} d="M5 12.4 L3.3 13.6 M5 12.4 L6.9 13.3 M19 12.4 L20.7 13.6 M19 12.4 L17.1 13.3"/>`,
  },
  {
    id: 'travel/repair',
    label: 'Réparer',
    // Clé plate posée en diagonale (chantier naval).
    svg:
      `<path ${K} d="M7.3 16.7 C5.4 16.7 3.9 15.1 3.9 13.3 C3.9 12.7 4.1 12.1 4.4 11.6 L8 15.1 L9.4 13.7 L5.9 10.2 C6.4 9.9 7 9.7 7.6 9.7 C9.4 9.7 11 11.2 11 13.1 C11 13.5 10.9 13.9 10.8 14.3 L16.9 20.4 L19.7 17.6 L13.6 11.5 C13.8 11.1 13.9 10.7 13.9 10.3 C13.9 8.4 12.3 6.9 10.4 6.9 C10.1 6.9 9.8 6.9 9.6 7 L12.4 9.7 L11 11.1 L8.2 8.3 C8 8.6 7.9 8.9 7.9 9.3"/>`,
  },
  {
    id: 'travel/careen',
    label: 'Caréner',
    // Coquillage de salissure gratté (racloir).
    svg:
      `<path ${K} d="M8.6 15.3 C6.4 13.8 5.6 11.4 6.6 8.9 C7.6 6.4 10.3 5.1 12.9 5.9 C15.5 6.7 17 9.3 16.4 11.9"/>` +
      `<path ${KF} d="M9.6 12.3 C9.1 11.1 9.3 9.9 10.1 9 M12.6 13.1 C12 11.7 12.1 10.2 13.1 9"/>` +
      `<path ${K} d="M16 15.3 L19.6 18.9 M19.6 15.3 L16 18.9"/>`,
  },
  {
    id: 'travel/world',
    label: 'Port cosmopolite',
    // Globe : méridien et parallèle sur un disque.
    svg:
      `<circle ${K} cx="12" cy="12" r="8.1"/>` +
      `<path ${K} d="M3.9 12 H20.1"/>` +
      `<path ${KF} d="M12 3.9 C14.7 6.4 16.1 9.1 16.1 12 C16.1 14.9 14.7 17.6 12 20.1 C9.3 17.6 7.9 14.9 7.9 12 C7.9 9.1 9.3 6.4 12 3.9 Z"/>`,
  },
  {
    id: 'travel/lighthouse',
    label: 'Phare',
    // Tour de phare rayée, faisceau de lumière.
    svg:
      `<path ${K} d="M9.7 21.1 L10.6 6.3 H13.4 L14.3 21.1 Z"/>` +
      `<path ${F} d="M10.3 10.6 H13.7 V13 H10.3 Z M9.9 16.6 H14.1 V19 H9.9 Z"/>` +
      `<path ${F} d="M9.4 4.4 H14.6 L13.7 6.3 H10.3 Z"/>` +
      `<path ${KF} d="M15.3 8.4 L19.3 6.6 M15.6 12 H20.1"/>`,
  },
  {
    id: 'travel/wave',
    label: 'Eau / immersion',
    // Deux lignes de houle superposées.
    svg:
      `<path ${K} d="M2.6 10 C4.8 7.8 7.2 7.8 9.4 10 C11.6 12.2 14 12.2 16.2 10 C18.4 7.8 20.8 7.8 21.4 8.4"/>` +
      `<path ${K} d="M2.6 15.4 C4.8 13.2 7.2 13.2 9.4 15.4 C11.6 17.6 14 17.6 16.2 15.4 C18.4 13.2 20.8 13.2 21.4 13.8"/>`,
  },
  {
    id: 'travel/compass',
    label: 'Survie en extérieur',
    // Rose des vents : cercle, aiguille losange, graduations cardinales.
    svg:
      `<circle ${K} cx="12" cy="12" r="8.1"/>` +
      `<path ${F} d="M12 6 L14.2 12 L12 18 L9.8 12 Z"/>` +
      `<path ${K} d="M12 3.6 V5.4 M12 18.6 V20.4 M3.6 12 H5.4 M18.6 12 H20.4"/>`,
  },
  {
    id: 'travel/encounter',
    label: 'Rencontre fortuite',
    // Deux masques de théâtre superposés.
    svg:
      `<circle ${K} cx="9" cy="12" r="5.4"/>` +
      `<circle ${K} cx="15" cy="12" r="5.4"/>` +
      `<path ${KF} d="M7 10.4 C7.6 9.8 8.4 9.8 9 10.4 M11.6 13.6 C10.6 14.6 8.4 14.6 7.4 13.6"/>` +
      `<path ${KF} d="M13.2 10.8 L14.4 9.6 M16.6 10.8 L15.4 9.6 M13.4 14 C14.4 13.2 15.6 13.2 16.6 14"/>`,
  },
];
