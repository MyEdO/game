import type { IconFamily } from '../types';

/* Caractéristiques WFRP (chips 14px) — silhouettes PLEINES très simples.
   Charte : voir defs/action.ts (grille 24×24, trait 1.8 rond, currentColor). */

/** Trait principal. */
const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
/** Silhouette pleine. */
const F = 'fill="currentColor" stroke="none"';
/** Silhouette pleine à trous (evenodd). */
const FE = 'fill="currentColor" fill-rule="evenodd" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'char/cc',
    label: 'Capacité de Combat',
    svg:
      `<path ${F} d="M8.2 15.9 L18.7 4.3 C19.3 3.7 20.1 3.4 20.7 3.4 C20.7 4 20.4 4.9 19.8 5.5 L9.7 17.4 Z"/>` +
      `<path ${F} d="M15.8 15.9 L5.3 4.3 C4.7 3.7 3.9 3.4 3.3 3.4 C3.3 4 3.6 4.9 4.2 5.5 L14.3 17.4 Z"/>` +
      `<path ${K} d="M6.1 13.7 L10.9 18.5 M17.9 13.7 L13.1 18.5"/>` +
      `<path ${K} d="M8.3 16.2 L5.9 18.7 M15.7 16.2 L18.1 18.7"/>`,
  },
  {
    id: 'char/ct',
    label: 'Capacité de Tir',
    svg:
      `<circle ${K} cx="10.6" cy="13.4" r="6.7"/>` +
      `<circle ${F} cx="10.6" cy="13.4" r="2.3"/>` +
      `<path ${K} d="M10.9 13.1 L19.6 4.4"/>` +
      `<path ${F} d="M20.9 3.1 L16.9 3.9 L20.1 7.1 Z"/>`,
  },
  {
    id: 'char/f',
    label: 'Force',
    svg:
      `<path ${F} d="M6.3 4.9 L17.7 4.9 C18.5 4.9 19.1 5.5 19.1 6.3 L19.1 9.5 C19.1 10.3 18.5 10.9 17.7 10.9 L6.3 10.9 C5.5 10.9 4.9 10.3 4.9 9.5 L4.9 6.3 C4.9 5.5 5.5 4.9 6.3 4.9 Z"/>` +
      `<path ${F} d="M10.9 11.1 L13.1 11.1 L12.9 20.1 C12.9 20.9 11.1 20.9 11.1 20.1 Z"/>`,
  },
  {
    id: 'char/e',
    label: 'Endurance',
    svg:
      `<path ${F} d="M3 7.3 C4.6 6.4 6.8 5.9 9.2 5.9 L20 5.9 L20 9.8 L14.4 9.8 L14.4 13.1 C14.4 14.2 15.1 15 16.2 15.5 L17.4 16 L17.4 18.6 L6.6 18.6 L6.6 16 L7.8 15.5 C8.9 15 9.6 14.2 9.6 13.1 L9.6 9.7 C6.9 9.5 4.5 8.7 3 7.3 Z"/>`,
  },
  {
    id: 'char/ag',
    label: 'Agilité',
    svg:
      `<circle ${F} cx="16.1" cy="5.5" r="2"/>` +
      `<path ${K} d="M15 7.9 C13 9.3 11.7 11 11.2 13.1"/>` +
      `<path ${K} d="M11.2 13.1 C9.4 13.6 7.4 15.1 5.3 17.5"/>` +
      `<path ${K} d="M11.2 13.1 C12.9 14.4 14.3 16.3 15.2 18.8"/>` +
      `<path ${K} d="M14.8 8.6 C16.9 9.6 18.9 9.4 20.6 8"/>`,
  },
  {
    id: 'char/int',
    label: 'Intelligence',
    svg:
      `<path ${F} d="M11.3 6.1 C9.6 4.9 7.2 4.3 4.3 4.4 L4.3 17.6 C7.2 17.5 9.6 18.1 11.3 19.3 Z"/>` +
      `<path ${F} d="M12.7 6.1 C14.4 4.9 16.8 4.3 19.7 4.4 L19.7 17.6 C16.8 17.5 14.4 18.1 12.7 19.3 Z"/>`,
  },
  {
    id: 'char/fm',
    label: 'Force Mentale',
    svg:
      `<path ${FE} d="M12 3.3 C8.1 3.3 5.4 6.1 5.4 10 L5.4 19.3 C7.4 20.4 9.6 20.9 12 20.9 C14.4 20.9 16.6 20.4 18.6 19.3 L18.6 10 C18.6 6.1 15.9 3.3 12 3.3 Z M7.3 10.2 L11.1 10.2 L11.1 11.9 L7.3 11.9 Z M12.9 10.2 L16.7 10.2 L16.7 11.9 L12.9 11.9 Z"/>`,
  },
  {
    id: 'char/soc',
    label: 'Sociabilité',
    svg:
      `<path ${F} d="M4.6 19.8 C4.3 16 4.6 12.4 5.6 9.5 C6.3 7.4 7.9 6.2 9.3 6.6 C10.5 7 11.1 8.4 10.8 9.8 L11.7 10.9 L10.7 11.6 C10.8 12.9 10.3 14.1 9.4 14.7 C9.2 16.3 9.4 18 9.9 19.8 Z"/>` +
      `<path ${F} d="M19.4 19.8 C19.7 16 19.4 12.4 18.4 9.5 C17.7 7.4 16.1 6.2 14.7 6.6 C13.5 7 12.9 8.4 13.2 9.8 L12.3 10.9 L13.3 11.6 C13.2 12.9 13.7 14.1 14.6 14.7 C14.8 16.3 14.6 18 14.1 19.8 Z"/>`,
  },
];
