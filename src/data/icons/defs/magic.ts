import type { IconFamily } from '../types';

/* Famille « magie — Surincantation » (CastModal : axes Portée/Zone/Durée-souffle/Puissance,
   composant d'incantation) — distincte de action/cast (incanter). Charte : voir defs/action.ts. */

const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'magic/range',
    label: 'Portée',
    // Règle graduée en diagonale.
    svg:
      `<path ${K} d="M4.6 17.7 L17.7 4.6 L19.4 6.3 L6.3 19.4 Z"/>` +
      `<path ${KF} d="M8.1 15.9 L9.6 17.4 M10.9 13.1 L12.4 14.6 M13.7 10.3 L15.2 11.8"/>`,
  },
  {
    id: 'magic/area',
    label: 'Zone / puissance',
    // Spirale d'énergie qui s'étend depuis un centre.
    svg:
      `<path ${K} d="M12 12 C12 9.4 13.9 7.8 16.1 8.6 C18.3 9.4 19.3 12.3 17.9 14.6 C16.3 17.3 12.5 18.2 9.4 16.4 C5.9 14.4 4.7 9.7 6.9 6.1"/>` +
      `<circle ${F} cx="12" cy="12" r="1.7"/>`,
  },
  {
    id: 'magic/gust',
    label: 'Souffle',
    // Trois lignes de vent ondulées, portées croissantes.
    svg:
      `<path ${K} d="M3.6 8.6 C7.3 7.1 9.4 8 9 10 C8.7 11.4 6.9 11.4 6.7 10.1"/>` +
      `<path ${K} d="M3.6 13 H15.4 C17.6 13 18.6 14.7 18 16.3 C17.5 17.7 15.4 17.7 15.1 16.2"/>` +
      `<path ${KF} d="M3.6 17.4 H11.4"/>`,
  },
  {
    id: 'magic/power',
    label: 'Puissance critique',
    // Éclair d'incantation critique.
    svg: `<path ${F} d="M13.1 2.4 L5.9 13.6 L10.6 13.6 L8.9 21.6 L18.4 9.4 L13.4 9.4 Z"/>`,
  },
  {
    id: 'magic/component',
    label: 'Composant d’incantation',
    // Symbole alchimique du feu (triangle) au sommet d'une fiole.
    svg:
      `<path ${K} d="M12 3.4 L15.2 9.1 H8.8 Z"/>` +
      `<path ${K} d="M9.4 10.4 L7.6 13.6 C6.4 15.7 7.7 18.4 10.2 18.9 C11.4 19.1 12.6 19.1 13.8 18.9 C16.3 18.4 17.6 15.7 16.4 13.6 L14.6 10.4"/>` +
      `<path ${KF} d="M8.4 15.3 C10.7 16.2 13.3 16.2 15.6 15.3"/>`,
  },
];
