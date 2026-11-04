import type { IconFamily } from '../types';

/* Famille « coop » (CoopPanels — code de room, lien d'invitation, hôte, présence connecté/away).
   Charte de dessin : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'coop/code',
    label: 'Code de partie',
    // Écritoire à pince, lignes de code.
    svg:
      `<path ${K} d="M6.6 5.6 H17.4 V19.4 H6.6 Z"/>` +
      `<path ${F} d="M9.1 3.6 H14.9 V6.6 H9.1 Z"/>` +
      `<path ${KF} d="M8.9 10.6 H15.1 M8.9 13.3 H15.1 M8.9 16 H12.6"/>`,
  },
  {
    id: 'coop/invite',
    label: 'Lien d’invitation',
    // Deux maillons de chaîne entrelacés.
    svg:
      `<path ${K} d="M10.1 13.9 L13.9 10.1"/>` +
      `<path ${K} d="M13.1 6.9 L14.9 5.1 C16.4 3.6 18.7 3.6 20.1 5.1 C21.6 6.6 21.6 8.9 20.1 10.4 L18.3 12.1"/>` +
      `<path ${K} d="M10.9 17.1 L9.1 18.9 C7.6 20.4 5.3 20.4 3.9 18.9 C2.4 17.4 2.4 15.1 3.9 13.6 L5.7 11.9"/>`,
  },
  {
    id: 'coop/host',
    label: 'Hôte',
    // Couronne à trois pointes.
    svg:
      `<path ${F} d="M4.1 18.4 L3.1 8.3 L7.7 11.6 L12 5.3 L16.3 11.6 L20.9 8.3 L19.9 18.4 Z"/>` +
      `<path ${KF} d="M5.4 15.7 H18.6"/>`,
  },
  {
    id: 'coop/online',
    label: 'Connecté',
    // Point plein — présence active.
    svg: `<circle ${F} cx="12" cy="12" r="6"/>`,
  },
  {
    id: 'coop/away',
    label: 'Reconnexion',
    // Anneau ouvert (spinner) — présence en reconnexion, distinct du point plein « connecté ».
    svg: `<path ${K} d="M12 5.8 C15.4 5.8 18.2 8.6 18.2 12 C18.2 15.4 15.4 18.2 12 18.2 C9 18.2 6.5 16 6 13.1"/>`,
  },
];
