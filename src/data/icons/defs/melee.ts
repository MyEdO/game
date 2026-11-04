import type { IconFamily } from '../types';

/* Famille « corps-à-corps rapproché » (Empoignade/Au contact/Fuite/Retenir ses coups —
   AuContactModal, GrappleModal, DisengageModal, RunModal, useAttackJetProps). Distincte des
   silhouettes d'armes d'action.ts (ici : mains nues, mouvement). Charte : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'melee/grapple',
    label: 'Empoignade',
    // Deux avant-bras entrelacés en lutte.
    svg:
      `<path ${K} d="M4.6 6.3 C6.8 8.6 8.3 10.9 9.1 13.2 C10.4 11.6 12.1 10.7 14.2 10.6 C13.1 12.6 12.6 14.6 12.9 16.7"/>` +
      `<path ${K} d="M19.4 6.3 C17.2 8.6 15.7 10.9 14.9 13.2 C13.6 11.6 11.9 10.7 9.8 10.6 C10.9 12.6 11.4 14.6 11.1 16.7"/>` +
      `<circle ${F} cx="12" cy="18.4" r="1.6"/>`,
  },
  {
    id: 'melee/tumble',
    label: 'Roulé-boulé',
    // Figure en boule roulant sur elle-même.
    svg:
      `<path ${K} d="M6.4 15.6 C6.1 12 8.2 9 11.7 8.3 C15.2 7.6 18.4 9.7 19.1 13.2"/>` +
      `<path ${K} d="M19.1 13.2 L19.6 10.1 M19.1 13.2 L16.1 12.3"/>` +
      `<circle ${F} cx="9.2" cy="16.9" r="3.1"/>` +
      `<path ${KF} d="M4.4 19.8 C6.5 18.5 9 18 11.7 18.3"/>`,
  },
  {
    id: 'melee/disengage',
    label: 'Se désengager',
    // Trajectoire qui revient en arrière, hors de la portée de la lame restée plantée.
    svg:
      `<path ${K} d="M17.4 18.6 C18.4 13.4 16.1 9.4 11.2 8.6"/>` +
      `<path ${F} d="M12.2 4.9 L6.4 8.6 L12.4 12.1 Z"/>` +
      `<path ${KF} d="M20.6 3.4 L20.6 12.4 M18.5 12.7 L22.6 12.7"/>`,
  },
  {
    id: 'melee/close-in',
    label: 'Au contact',
    // Poing tendu qui vient au contact.
    svg:
      `<path ${F} d="M7.4 9.2 C7.4 7.9 8.4 6.9 9.6 6.9 C10.9 6.9 11.9 7.9 11.9 9.2 V11.6 C13 10.9 14.3 10.9 15.3 11.7 C16.3 12.5 16.6 13.9 16.1 15.2 L14.8 18.4 C14.1 19.9 12.6 20.9 10.9 20.9 H9.6 C7.6 20.9 5.9 19.6 5.3 17.7 L4.3 14.5 C4 13.5 4.7 12.5 5.7 12.4 C6.4 12.3 7 12.7 7.3 13.4 L7.4 13.6 Z"/>` +
      `<path ${K} d="M17.9 5.4 L19.7 3.6 M19.4 8.1 L21.7 7.6 M15.6 3.3 L15.9 1"/>`,
  },
  {
    id: 'melee/flee',
    label: 'Fuir',
    // Silhouette en pleine course.
    svg:
      `<circle ${F} cx="13.4" cy="4.6" r="1.9"/>` +
      `<path ${K} d="M11.6 8.6 L14.6 10.1 L17.6 8.9 M14.6 10.1 L13.3 14.4 L16.6 18.9 M13.3 14.4 L8.7 16.3 L6.1 20.3 M13.3 14.4 L10.3 12.6 L7.3 13.4"/>`,
  },
  {
    id: 'melee/pulled-punch',
    label: 'Retenir ses coups',
    // Poing serré levé, retenu (non létal).
    svg:
      `<path ${F} d="M8.4 10.3 C8.4 9.3 9.1 8.6 10 8.6 C10.9 8.6 11.6 9.3 11.6 10.3 V12.4 H8.4 Z"/>` +
      `<path ${F} d="M11.9 9.6 C11.9 8.6 12.6 7.9 13.5 7.9 C14.4 7.9 15.1 8.6 15.1 9.6 V12.4 H11.9 Z"/>` +
      `<path ${F} d="M15.4 10.1 C15.4 9.1 16 8.5 16.8 8.5 C17.6 8.5 18.2 9.1 18.2 10.1 V12.9 H15.4 Z"/>` +
      `<path ${F} d="M7.8 13 H18.6 C18.9 15.9 18.4 18.4 16.9 20.6 C13.9 21.7 10.5 21.7 7.5 20.6 C6 18.4 5.5 15.9 7.8 13 Z"/>` +
      `<path ${K} d="M7.4 13.6 C5.7 14.3 4.9 15.6 5 17.1"/>`,
  },
  {
    id: 'melee/trample',
    label: 'Piétinement',
    // Botte qui s'écrase au sol, impact en dessous.
    svg:
      `<path ${F} d="M9.2 3.8 C10.3 3.1 11.9 3.1 13 3.8 C13.9 5.3 14.1 7.6 13.6 10.1 C15.5 10.3 16.9 11.2 17.5 12.7 C18.1 14.2 17.5 15.9 15.9 16.6 L10.2 18.9 C8.3 19.6 6.4 18.6 5.9 16.8 C5.5 15.3 6.2 13.9 7.6 13.2 L8.6 12.7 C7.9 10.3 7.9 7.1 9.2 3.8 Z"/>` +
      `<path ${KF} d="M5.6 21 C8.7 20.1 12.1 20.1 15.1 21 M3.4 21 L4.7 19.6 M19.3 21 L18 19.6"/>`,
  },
];
