import type { IconFamily } from '../types';

/* Famille « outils de l'éditeur de carte » (Palette/Inspector/StatusBar/EditorCanvas — rail
   d'outils : peindre, murs, hauteur, personnage/décor, départ, zone, gomme, porte, épingle).
   Charte de dessin : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';
/** Silhouette pleine à trou (evenodd) — le trou reste transparent (fond visible), jamais de couleur en dur. */
const FE = 'fill="currentColor" fill-rule="evenodd" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'map-tool/paint',
    label: 'Peindre le terrain',
    // Pinceau incliné, touche de peinture à la pointe.
    svg:
      `<path ${K} d="M6.6 17.4 L15.4 8.6 C16.4 7.6 17.9 7.6 18.7 8.4 C19.5 9.2 19.5 10.7 18.5 11.7 L9.7 20.4"/>` +
      `<path ${F} d="M6.6 17.4 C5.3 17.6 4.4 18.6 4.3 20 C5.7 19.9 6.7 19 6.9 17.7 Z"/>` +
      `<path ${KF} d="M14.3 9.7 L17.4 12.8"/>`,
  },
  {
    id: 'map-tool/wall',
    label: 'Mur — cloison / porte',
    // Appareillage de briques en quinconce.
    svg:
      `<path ${K} d="M3.6 5.6 H20.4 V18.4 H3.6 Z"/>` +
      `<path ${KF} d="M3.6 9.9 H20.4 M3.6 14.2 H20.4 M8.6 5.6 V9.9 M15.4 5.6 V9.9 M4.6 9.9 V14.2 M12 9.9 V14.2 M19.4 9.9 V14.2 M8.6 14.2 V18.4 M15.4 14.2 V18.4"/>`,
  },
  {
    id: 'map-tool/height',
    label: 'Hauteur',
    // Deux crêtes de relief, courbe de niveau.
    svg:
      `<path ${F} d="M3.4 18.6 L9 8.9 L12.4 14.4 L15.1 10.1 L20.6 18.6 Z"/>` +
      `<path ${KF} d="M6.6 18.6 L9.3 13.9 L11.4 17.1"/>`,
  },
  {
    id: 'map-tool/npc',
    label: 'Personnage',
    // Tête/buste stylisé, un visage neutre posé sur la carte.
    svg:
      `<circle ${F} cx="12" cy="8.4" r="4"/>` +
      `<path ${F} d="M12 13.4 C16 13.4 18.8 15.8 19.3 19.8 C14.5 20.6 9.5 20.6 4.7 19.8 C5.2 15.8 8 13.4 12 13.4 Z"/>`,
  },
  {
    id: 'map-tool/prop',
    label: 'Décor (arbre)',
    // Conifère simplifié, tronc court.
    svg:
      `<path ${F} d="M12 3.1 L17.3 11 H14.7 L18.4 16.6 H14.9 L17.6 20.6 H6.4 L9.1 16.6 H5.6 L9.3 11 H6.7 Z"/>` +
      `<path ${K} d="M12 20.6 V22.9"/>`,
  },
  {
    id: 'map-tool/start-flag',
    label: 'Départ des héros',
    // Fanion à damier planté au sol.
    svg:
      `<path ${K} d="M6.4 3.4 V20.6"/>` +
      `<path ${F} d="M6.4 4.1 H16.6 L14 7.6 L16.6 11.1 H6.4 Z"/>` +
      `<path ${KF} d="M6.4 5.5 H8.9 V6.9 H6.4 Z M9.9 5.5 H12.4 V6.9 H9.9 Z M6.4 8.3 H8.9 V9.7 H6.4 Z M9.9 8.3 H12.4 V9.7 H9.9 Z M12.9 5.5 H15.4 V6.9 H12.9 Z M11.4 8.3 H13.9 V9.7 H11.4 Z"/>`,
  },
  {
    id: 'map-tool/crenel',
    label: 'Crénelage',
    // Couronne de merlons (parapet crénelé).
    svg:
      `<path ${F} d="M3.6 20.6 V15.4 H6.4 V12.6 H9.4 V15.4 H12.2 V12.6 H15.2 V15.4 H18 V12.6 H20.4 V20.6 Z"/>`,
  },
  {
    id: 'map-tool/zone',
    label: 'Zone (trigger / repos)',
    // Rectangle en pointillés (empreinte au sol).
    svg:
      `<path ${K} d="M4.5 4.5 H10 M14 4.5 H19.5 V10 M19.5 14 V19.5 H14 M10 19.5 H4.5 V14"/>` +
      `<rect ${F} x="9.7" y="9.7" width="4.6" height="4.6" rx="0.8"/>`,
  },
  {
    id: 'map-tool/erase',
    label: 'Gomme',
    // Gomme biseautée, trait effacé.
    svg:
      `<path ${F} d="M14.3 3.9 L20.1 9.7 L11.6 18.2 H6.1 L3.6 15.7 Z"/>` +
      `<path ${K} d="M6.1 18.2 H17.9"/>` +
      `<path ${KF} d="M11.9 8.1 L16 12.2"/>`,
  },
  {
    id: 'map-tool/door',
    label: 'Porte',
    // Battant entrouvert, poignée.
    svg:
      `<path ${K} d="M6.4 20.4 V3.9 L17.6 6 V20.4"/>` +
      `<path ${K} d="M4.6 20.4 H19.4"/>` +
      `<circle ${F} cx="15" cy="12.6" r="1"/>`,
  },
  {
    id: 'map-tool/pin',
    label: 'Point sur la carte',
    // Épingle de localisation classique, cœur évidé (evenodd — jamais de couleur en dur).
    svg:
      `<path ${FE} d="M12 2.9 C15.6 2.9 18.4 5.7 18.4 9.2 C18.4 13.6 12 20.6 12 20.6 C12 20.6 5.6 13.6 5.6 9.2 C5.6 5.7 8.4 2.9 12 2.9 Z M12 6.7 C10.6 6.7 9.5 7.8 9.5 9.1 C9.5 10.5 10.6 11.6 12 11.6 C13.4 11.6 14.5 10.5 14.5 9.1 C14.5 7.8 13.4 6.7 12 6.7 Z"/>`,
  },
];
