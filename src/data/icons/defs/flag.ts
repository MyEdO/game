import type { IconFamily } from '../types';

/* États-drapeaux (postures/psychologie hors conditions[]) — charte : voir defs/action.ts.
   NB : « Visée » (En joue) réutilise `action/aim` (même sens exact) — pas de doublon ici. */

/** Trait principal. */
const K = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
/** Trait fin (détail secondaire). */
const KF = 'fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"';
/** Silhouette pleine. */
const F = 'fill="currentColor" stroke="none"';
/** Silhouette pleine à trous (evenodd). */
const FE = 'fill="currentColor" fill-rule="evenodd" stroke="none"';

export const icons: IconFamily = [
  {
    id: 'flag/frenzy',
    label: 'Frénésie',
    svg:
      // Visage de face hurlant : yeux bridés de rage + gueule béante (trous evenodd), mèches hérissées.
      `<path ${FE} d="M12 3.6 C16 3.6 18.6 6.3 18.6 9.9 C18.6 12.8 17.1 15.1 14.7 16.1 L14.7 18.2 L9.3 18.2 L9.3 16.1 C6.9 15.1 5.4 12.8 5.4 9.9 C5.4 6.3 8 3.6 12 3.6 Z M8.1 8 L11 9.5 C10.4 10.5 9.2 10.8 8.2 10.2 C7.4 9.7 7.4 8.8 8.1 8 Z M15.9 8 C16.6 8.8 16.6 9.7 15.8 10.2 C14.8 10.8 13.6 10.5 13 9.5 Z M8.9 12 C11 11.4 13 11.4 15.1 12 C14.7 14.2 13.6 15.3 12 15.3 C10.4 15.3 9.3 14.2 8.9 12 Z"/>` +
      `<path ${KF} d="M7 3.9 L5.5 2.3 M10.1 2.7 L9.5 1.1 M13.9 2.7 L14.5 1.1 M17 3.9 L18.5 2.3"/>`,
  },
  {
    id: 'flag/focus',
    label: 'Focalisation',
    svg:
      `<circle ${K} cx="12" cy="12" r="5.3"/>` +
      `<circle ${F} cx="12" cy="12" r="2"/>` +
      `<path ${KF} d="M4.7 4.7 L7.5 7.5 M19.3 4.7 L16.5 7.5 M4.7 19.3 L7.5 16.5 M19.3 19.3 L16.5 16.5"/>`,
  },
  {
    id: 'flag/hungry',
    label: 'Affamé',
    svg:
      `<path ${K} d="M4.5 11 H19.5 C19.3 15.7 16.3 18.8 12 18.8 C7.7 18.8 4.7 15.7 4.5 11 Z"/>` +
      `<path ${KF} d="M9.8 20.6 H14.2"/>` +
      `<circle ${F} cx="7" cy="4.7" r="1.8"/>` +
      `<path ${K} d="M8.2 6 L12.7 11"/>`,
  },
  {
    id: 'flag/fear',
    label: 'Peur',
    svg:
      `<path ${KF} d="M4.2 6.2 L7.2 7.9 M3.6 11 L7 11.4 M4.2 15.8 L7.2 14.2"/>` +
      `<circle ${F} cx="15.6" cy="6.8" r="2.1"/>` +
      `<path ${K} d="M14.9 9.4 C14.2 11.5 14.6 13.9 16 16 C16.6 17.3 16.6 18.7 16 20.2"/>` +
      `<path ${K} d="M15.3 13.3 C17.2 14.6 18.4 16.6 18.9 20.1"/>` +
      `<path ${K} d="M14.9 10.3 C13.2 9.9 11.8 9.1 10.7 7.8"/>`,
  },
  {
    id: 'flag/defensive',
    label: 'Posture défensive',
    svg:
      `<path ${F} d="M12 3.2 C14.7 4.6 17.2 5.3 19.7 5.5 C19.6 12.4 17.1 17.5 12 20.7 C6.9 17.5 4.4 12.4 4.3 5.5 C6.8 5.3 9.3 4.6 12 3.2 Z"/>` +
      `<circle fill="var(--gold)" stroke="none" cx="12" cy="10.4" r="1.6"/>` +
      `<path ${KF} d="M2.4 9.9 L4.9 11 M2.9 14.4 L5.2 14"/>`,
  },
  {
    id: 'flag/hidden',
    label: 'Embusqué',
    // Capuche d'embuscade : yeux plissés seuls visibles.
    svg:
      `<path ${F} d="M12 3.6 C16.6 3.6 20.1 7.4 20.1 12.3 C20.1 16 18.1 19.1 15.1 20.6 C15.6 19.3 15.4 18.1 14.4 17.3 C13.4 18.4 12.6 18.4 11.6 17.3 C10.6 18.1 10.4 19.3 10.9 20.6 C7.9 19.1 5.9 16 5.9 12.3 C5.9 7.4 9.4 3.6 12 3.6 Z"/>` +
      `<path ${KF} d="M9.1 11.3 C9.7 10.7 10.6 10.7 11.1 11.3 M12.9 11.3 C13.4 10.7 14.3 10.7 14.9 11.3"/>`,
  },
  {
    id: 'flag/anger',
    label: 'Hostilité / colère',
    // Poing serré, jointures marquées, deux traits de vapeur rageuse.
    svg:
      `<path ${F} d="M8.6 12 C8.6 10 9.4 8.6 11 8.2 C11 7.4 11.6 6.8 12.4 6.8 C13.2 6.8 13.8 7.4 13.8 8.2 C15.2 8.7 15.9 10 15.9 12 C15.9 14.4 15.9 17 15.9 19.6 H8.6 C8.6 17 8.6 14.4 8.6 12 Z"/>` +
      `<path ${KF} d="M10.6 8.4 V11.6 M13.2 8.4 V11.6"/>` +
      `<path ${K} d="M9.4 4.6 L10.3 6.4 M14.6 4.6 L13.7 6.4"/>`,
  },
  {
    id: 'flag/bond',
    label: 'Attachement (amour / camaraderie)',
    // Cœur plein, non fendu — attachement positif (distinct des cœurs fendus de Blessures/Ambition).
    svg:
      `<path ${F} d="M12 19.6 C6.8 15.8 3.8 12.2 3.8 8.9 C3.8 6.2 5.9 4.2 8.4 4.2 C10 4.2 11.4 5 12 6.4 C12.6 5 14 4.2 15.6 4.2 C18.1 4.2 20.2 6.2 20.2 8.9 C20.2 12.2 17.2 15.8 12 19.6 Z"/>`,
  },
];
