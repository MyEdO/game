import type { IconFamily } from '../types';

/* États (LDB 16) — charte : voir defs/action.ts (grille 24×24, trait 1.8 rond, currentColor). */

/** Trait principal. */
const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
/** Trait fin (détail secondaire). */
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
/** Silhouette pleine. */
const F = 'fill="currentColor" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'condition/unconscious',
    label: 'Inconscient',
    svg:
      `<path ${KF} d="M4 20.6 C9.4 20.2 14.6 20.2 20 20.6"/>` +
      `<circle ${F} cx="8.4" cy="17" r="3.1"/>` +
      `<path ${K} d="M18.6 8.1 C18.6 5.9 16.7 4.4 14.7 5 C12.9 5.6 12 7.6 12.8 9.3 C13.6 10.8 15.5 11.3 16.8 10.4 C17.9 9.7 18.1 8.2 17.2 7.5 C16.4 6.9 15.2 7.2 14.9 8.1"/>`,
  },
  {
    id: 'condition/petrified',
    label: 'Pétrifié',
    svg:
      `<path ${F} d="M8.3 20.5 C7.8 14.2 8 8.3 9.5 5 C9.9 4 10.9 3.5 11.7 3.5 L10.4 8.1 L12.5 11.5 L10.4 15.6 L11.8 20.5 Z"/>` +
      `<path ${F} d="M12.9 3.6 C13.8 3.7 14.5 4.2 14.9 5 C16.4 8.3 16.6 14.2 16.1 20.5 L13.2 20.5 L11.8 15.6 L13.9 11.5 L11.8 8.1 Z"/>` +
      `<path ${KF} d="M6.3 20.7 C10 20.4 14 20.4 17.7 20.7"/>`,
  },
  {
    id: 'condition/stunned',
    label: 'Sonné',
    svg:
      `<circle ${F} cx="12" cy="15.7" r="4.3"/>` +
      `<path ${KF} d="M4.7 8.6 C6.5 11.4 17.5 11.4 19.3 8.6"/>` +
      `<path ${F} d="M5.6 6.7 L6.7 7.9 L5.6 9.1 L4.5 7.9 Z"/>` +
      `<path ${F} d="M12 4.4 L13.2 5.7 L12 7 L10.8 5.7 Z"/>` +
      `<path ${F} d="M18.4 6.7 L19.5 7.9 L18.4 9.1 L17.3 7.9 Z"/>`,
  },
  {
    id: 'condition/prone',
    label: 'À Terre',
    svg:
      `<path ${KF} d="M3.6 20.6 C9 20.2 15 20.2 20.4 20.6"/>` +
      `<circle ${F} cx="5.8" cy="16.5" r="2.1"/>` +
      `<path ${F} d="M8.3 15.6 C10.9 14.8 13.3 14.9 15.5 15.5 L19.8 17.4 C20.3 17.7 20.2 18.4 19.7 18.4 L8.7 18.2 C7.7 18.1 7.6 16.1 8.3 15.6 Z"/>`,
  },
  {
    id: 'condition/broken',
    label: 'Brisé',
    svg:
      `<path ${F} d="M8.2 15.9 L13.7 9.8 L12.9 8.8 L15.2 8.4 L9.7 17.4 Z"/>` +
      `<path ${F} d="M16.2 7.2 L19 3.9 C19.6 3.3 20.4 3 21 3 C21 3.6 20.7 4.5 20.1 5.1 L17.3 8.4 L16 9.1 L16.6 7.8 Z"/>` +
      `<path ${K} d="M6.1 13.7 L10.9 18.5"/>` +
      `<path ${K} d="M8.3 16.2 L4.9 19.7"/>` +
      `<circle ${F} cx="4.3" cy="20.3" r="1.3"/>`,
  },
  {
    id: 'condition/blinded',
    label: 'Aveugle',
    svg:
      `<path ${K} d="M3.8 12 C6.3 8.3 9 6.6 12 6.6 C15 6.6 17.7 8.3 20.2 12 C17.7 15.7 15 17.4 12 17.4 C9 17.4 6.3 15.7 3.8 12 Z"/>` +
      `<circle ${F} cx="12" cy="12" r="2.4"/>` +
      `<path ${K} d="M5.4 18.9 L18.6 5.1"/>`,
  },
  {
    id: 'condition/entangled',
    label: 'Empêtré',
    svg:
      `<circle ${F} cx="12" cy="5.2" r="2.1"/>` +
      `<path ${K} d="M9.4 8.2 C8.6 12 8.7 16.3 9.4 20.2 M14.6 8.2 C15.4 12 15.3 16.3 14.6 20.2"/>` +
      `<path ${K} d="M7.5 10.6 C10.5 12 13.5 12 16.5 10.6 M7.4 13.9 C10.4 15.3 13.6 15.3 16.6 13.9 M7.6 17.1 C10.5 18.5 13.5 18.5 16.4 17.1"/>`,
  },
  {
    id: 'condition/ablaze',
    label: 'En flammes',
    svg:
      `<path ${F} d="M12 2.9 C15.4 6.3 17.2 9.4 17.2 12.7 C17.2 16.9 15 19.9 12 19.9 C9 19.9 6.8 16.9 6.8 12.7 C6.8 10.7 7.5 8.8 9 6.9 C9.1 9.1 10.2 10.5 11.8 11.3 C10.9 8.4 11 5.6 12 2.9 Z"/>` +
      `<circle ${F} cx="17.7" cy="5.4" r="0.9"/>`,
  },
  {
    id: 'condition/poisoned',
    label: 'Empoisonné',
    svg:
      // Serpent dressé, langue fourchue (le crâne est réservé à journal/death).
      `<path ${K} d="M9.4 6.4 C9.4 8.9 14.7 9.7 14.7 12.6 C14.7 15.4 9.6 15.9 9.6 18.3 C9.6 20.2 11.8 20.9 14 20.2"/>` +
      `<path ${F} d="M9.5 6.8 C7.9 6.8 6.8 5.7 6.9 4.3 C7 3.3 8 2.5 9.2 2.6 C10.9 2.8 11.9 4.1 11.7 5.6 C11.6 6.3 10.7 6.8 9.5 6.8 Z"/>` +
      `<path ${KF} d="M6.8 4.4 L4.8 3.5 M6.8 4.4 L5.1 5.5"/>`,
  },
  {
    id: 'condition/bleeding',
    label: 'Hémorragique',
    svg:
      `<path ${F} d="M4.9 6.2 C9.4 4.7 14.6 4.7 19.1 6.2 C14.6 7.8 9.4 7.8 4.9 6.2 Z"/>` +
      `<path ${F} d="M12 9.9 C14.2 13.1 15.3 15.3 15.3 17.1 C15.3 19.2 13.9 20.7 12 20.7 C10.1 20.7 8.7 19.2 8.7 17.1 C8.7 15.3 9.8 13.1 12 9.9 Z"/>`,
  },
  {
    id: 'condition/surprised',
    label: 'Surpris',
    svg:
      `<path ${F} d="M12.2 3.1 C13.2 3.1 14 3.9 13.9 4.9 L12.9 14.2 C12.9 14.8 12.4 15.2 11.9 15.2 C11.4 15.2 11 14.8 10.9 14.2 L10.4 4.8 C10.3 3.9 11.2 3.1 12.2 3.1 Z"/>` +
      `<circle ${F} cx="11.9" cy="19.1" r="1.7"/>`,
  },
  {
    id: 'condition/deafened',
    label: 'Assourdi',
    svg:
      `<path ${K} d="M8.3 8.9 C8.3 6 10.4 4 13.2 4 C15.9 4 17.9 6 17.9 8.6 C17.9 10.4 17 11.6 15.7 13 C14.8 14 14.3 15 14.2 16.4 C14.1 18.4 12.8 19.9 10.9 19.9 C9.4 19.9 8.2 19 7.9 17.6"/>` +
      `<path ${KF} d="M11.6 8.7 C11.7 7.4 12.7 6.5 13.9 6.7"/>` +
      `<path ${K} d="M5.2 19.3 L19 4.7"/>`,
  },
  {
    id: 'condition/fatigued',
    label: 'Exténué',
    svg:
      `<path ${KF} d="M4.4 20.6 C9.4 20.3 14.6 20.3 19.6 20.6"/>` +
      `<path ${K} d="M6.9 20 C6.7 15.3 8.5 11.4 12.3 9.8 C14.5 8.9 16.4 9.5 17.4 11"/>` +
      `<circle ${F} cx="17.8" cy="13.4" r="2.2"/>` +
      `<path ${K} d="M12.7 12.6 C13 15.3 13.2 17.7 13.4 19.9"/>`,
  },
];
